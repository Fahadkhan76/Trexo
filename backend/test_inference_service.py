import json
import sys
import unittest
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from app import app, cached_recommendations
from inference_service import DEFAULT_LEAD_TIME_DAYS, InferenceService


ROOT = Path(__file__).parent
LEDGER_PATH = ROOT / "data" / "demo_ledger_export.json"


class LedgerInferenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ledger = json.loads(LEDGER_PATH.read_text(encoding="utf-8"))
        cls.service = InferenceService()

    def test_frontend_export_covers_all_products_and_history(self):
        products = self.ledger["products"]
        sales = self.ledger["sales"]
        self.assertEqual(len(products), 47)
        self.assertGreaterEqual(len(sales), 90)
        self.assertTrue(all(sale.get("isSynthetic") for sale in sales))
        self.assertEqual(len({product["id"] for product in products}), 47)
        sku_by_id = {product["id"]: product["sku"] for product in products}
        units_by_id = {product["id"]: 0 for product in products}
        for sale in sales:
            for item in sale["items"]:
                self.assertIn(item["productId"], sku_by_id)
                self.assertEqual(item["sku"], sku_by_id[item["productId"]])
                units_by_id[item["productId"]] += item["qty"]
        self.assertTrue(all(units > 0 for units in units_by_id.values()))
        product_by_id, _, daily_sales, first_day, _, history_days = self.service._ledger_series(self.ledger)
        self.assertEqual(len(product_by_id), 47)
        for product_id in product_by_id:
            daily = self.service.daily_series(product_id, daily_sales, first_day, history_days)
            self.assertGreaterEqual(len(daily), 90)
            self.assertIn(0, daily)
            self.assertGreater(len(set(daily)), 1)

    def test_recommendations_match_ledger_formula_for_every_product(self):
        products = {product["id"]: product for product in self.ledger["products"]}
        recommendations = self.service.recommendations(self.ledger)
        self.assertEqual(len(recommendations), len(products))
        self.assertEqual({row["product_id"] for row in recommendations}, set(products))

        days = [date.fromisoformat(sale["createdAt"][:10]) for sale in self.ledger["sales"]]
        history_days = (max(days) - min(days)).days + 1
        total_by_product = {product_id: 0 for product_id in products}
        for sale in self.ledger["sales"]:
            for item in sale["items"]:
                total_by_product[item["productId"]] += item["qty"]

        for row in recommendations:
            product = products[row["product_id"]]
            average = total_by_product[product["id"]] / history_days
            expected = max(0, average * (DEFAULT_LEAD_TIME_DAYS + 3) - product["stockQty"])
            self.assertEqual(row["current_stock"], product["stockQty"])
            self.assertAlmostEqual(row["average_daily_sales"], average)
            self.assertAlmostEqual(row["suggested_reorder_quantity"], expected)
            self.assertEqual(row["supplier_lead_time_days"], DEFAULT_LEAD_TIME_DAYS)

    def test_missing_history_zero_stock_excess_stock_and_lead_override(self):
        products = [
            {"id": "p-zero", "sku": "Z", "name": "Zero", "stockQty": 0},
            {"id": "p-excess", "sku": "E", "name": "Excess", "stockQty": 500},
            {"id": "p-none", "sku": "N", "name": "No history", "stockQty": 0},
            {"id": "p-lead", "sku": "L", "name": "Lead", "stockQty": 0,
             "supplierId": "supplier", "leadTimeDays": 5},
        ]
        sales = []
        start = date(2026, 1, 1)
        for index in range(30):
            sales.append({
                "createdAt": (start + timedelta(days=index)).isoformat(),
                "items": ([{"productId": product_id, "qty": 2, "sku": sku}
                           for product_id, sku in (("p-zero", "Z"), ("p-excess", "E"), ("p-lead", "L"))]),
            })
        ledger = {"products": products, "sales": sales,
                  "suppliers": [{"id": "supplier", "leadTimeDays": 4}]}
        rows = {row["product_id"]: row for row in self.service.recommendations(ledger)}
        self.assertEqual(rows["p-none"]["average_daily_sales"], 0)
        self.assertEqual(rows["p-none"]["suggested_reorder_quantity"], 0)
        self.assertGreater(rows["p-zero"]["suggested_reorder_quantity"], 0)
        self.assertEqual(rows["p-excess"]["suggested_reorder_quantity"], 0)
        self.assertEqual(rows["p-lead"]["supplier_lead_time_days"], 5)
        self.assertNotIn("moq", rows["p-zero"])

    def test_ses_validation_uses_only_training_values_and_actual_holdout(self):
        values = [float(index % 7) for index in range(100)]
        result = self.service.forecast(values)
        train, holdout = values[:-14], values[-14:]
        level = train[0]
        for actual in train[1:]:
            level = 0.3 * actual + 0.7 * level
        errors = [actual - level for actual in holdout]
        validation = result["validation"]
        self.assertEqual(validation["train_days"], 86)
        self.assertEqual(validation["holdout_days"], 14)
        self.assertAlmostEqual(validation["mae"], sum(abs(e) for e in errors) / 14)
        self.assertAlmostEqual(validation["wape"], sum(abs(e) for e in errors) / sum(holdout))
        self.assertAlmostEqual(validation["actual_units"], sum(holdout))
        self.assertAlmostEqual(validation["predicted_units"], level * 14)

    def test_flask_accepts_ledger_payload_and_caches_same_input(self):
        cached_recommendations.cache_clear()
        client = app.test_client()
        first = client.post("/api/restock/recommendations?limit=100", json=self.ledger)
        second = client.post("/api/restock/recommendations?limit=100", json=self.ledger)
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.headers["X-Total-Count"], "47")
        self.assertEqual(len(first.get_json()), 47)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(cached_recommendations.cache_info().misses, 1)
        self.assertEqual(cached_recommendations.cache_info().hits, 1)
        report = client.post("/api/validation/report", json=self.ledger)
        self.assertEqual(report.status_code, 200)
        self.assertEqual(report.get_json()["product_count"], 47)
        self.assertEqual(report.get_json()["history_days"], 120)
        self.assertEqual(client.get("/api/restock/recommendations").status_code, 400)


if __name__ == "__main__":
    unittest.main()
