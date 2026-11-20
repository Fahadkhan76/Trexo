"""Ledger-driven demand and reorder calculations; no external product catalog."""
from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
import math
from typing import Any


DEFAULT_LEAD_TIME_DAYS = 3.0
REORDER_BUFFER_DAYS = 3.0


def _day(value: Any) -> date | None:
    if not isinstance(value, str) or len(value) < 10:
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        return None


def _number(value: Any, fallback: float = 0.0) -> float:
    try:
        parsed = float(value)
    except (ValueError, TypeError):
        return fallback
    return parsed if math.isfinite(parsed) else fallback


class InferenceService:
    @staticmethod
    def _ledger_series(ledger: dict[str, Any]):
        products = ledger.get("products")
        sales = ledger.get("sales")
        suppliers = ledger.get("suppliers", [])
        if not isinstance(products, list) or not isinstance(sales, list):
            raise ValueError("ledger payload must contain products and sales arrays")

        product_by_id = {
            product["id"]: product for product in products
            if isinstance(product, dict) and isinstance(product.get("id"), str)
        }
        suppliers_by_id = {
            supplier["id"]: supplier for supplier in suppliers
            if isinstance(supplier, dict) and isinstance(supplier.get("id"), str)
        }
        units_by_product_day = defaultdict(lambda: defaultdict(float))
        all_days = []

        for sale in sales:
            if not isinstance(sale, dict):
                continue
            sold_on = _day(sale.get("createdAt"))
            items = sale.get("items")
            if sold_on is None or not isinstance(items, list):
                continue
            all_days.append(sold_on)
            for item in items:
                if not isinstance(item, dict):
                    continue
                product_id = item.get("productId")
                qty = _number(item.get("qty"), -1)
                if product_id in product_by_id and qty > 0:
                    units_by_product_day[product_id][sold_on] += qty

        if all_days:
            first_day, as_of = min(all_days), max(all_days)
            history_days = (as_of - first_day).days + 1
        else:
            first_day = as_of = date.today()
            history_days = 1

        return product_by_id, suppliers_by_id, units_by_product_day, first_day, as_of, history_days

    @staticmethod
    def daily_series(product_id, daily_sales, first_day, history_days):
        return [daily_sales.get(product_id, {}).get(first_day + timedelta(days=index), 0.0)
                for index in range(history_days)]

    @staticmethod
    def _ses(values, alpha=0.3):
        if not values:
            return 0.0
        level = values[0]
        for actual in values[1:]:
            level = alpha * actual + (1 - alpha) * level
        return level

    @staticmethod
    def forecast(values, holdout_days=14, alpha=0.3):
        if len(values) <= holdout_days:
            return {"daily_demand": InferenceService._ses(values, alpha), "validation": None}
        train, holdout = values[:-holdout_days], values[-holdout_days:]
        prediction = InferenceService._ses(train, alpha)
        errors = [actual - prediction for actual in holdout]
        denominator = sum(abs(actual) for actual in holdout)
        return {
            "daily_demand": InferenceService._ses(values, alpha),
            "validation": {
                "train_days": len(train),
                "holdout_days": len(holdout),
                "mae": sum(abs(error) for error in errors) / len(errors),
                "wape": sum(abs(error) for error in errors) / denominator if denominator else None,
                "actual_units": sum(holdout),
                "predicted_units": prediction * len(holdout),
            },
        }

    @staticmethod
    def dead_stock_risk(days_since_sale, daily_demand):
        threshold = max(14.0, 2.0 / max(daily_demand, 0.05))
        score = min(100.0, max(0.0, days_since_sale / threshold * 100))
        return {"score": round(score, 1), "days_since_sale": days_since_sale,
                "risk": "high" if score >= 100 else "medium" if score >= 60 else "low"}

    def recommendations(self, ledger: dict[str, Any]):
        products, suppliers, daily_sales, first_day, as_of, history_days = self._ledger_series(ledger)
        output = []
        for product in products.values():
            product_id = product["id"]
            daily = self.daily_series(product_id, daily_sales, first_day, history_days)
            total_units = sum(daily)
            average_daily_sales = total_units / history_days if history_days else 0.0
            current_stock = max(0.0, _number(product.get("stockQty")))

            supplier = suppliers.get(product.get("supplierId"), {})
            lead_value = product.get("leadTimeDays", supplier.get("leadTimeDays"))
            lead_time = max(0.0, _number(lead_value, DEFAULT_LEAD_TIME_DAYS)) if lead_value is not None else DEFAULT_LEAD_TIME_DAYS
            reorder_qty = max(
                0.0,
                average_daily_sales * (lead_time + REORDER_BUFFER_DAYS) - current_stock,
            )

            sale_days = [day for day, units in daily_sales.get(product_id, {}).items() if units > 0]
            days_since_sale = (as_of - max(sale_days)).days if sale_days else history_days - 1
            risk = self.dead_stock_risk(days_since_sale, average_daily_sales)
            if total_units == 0:
                status = "No sales history"
            elif current_stock == 0:
                status = "Out of stock in recorded data"
            elif risk["risk"] == "high":
                status = "Dead-stock risk"
            elif reorder_qty > 0:
                status = "Possible stockout risk"
            else:
                status = "Monitor"

            name = product.get("name", "")
            output.append({
                "product_id": product_id,
                "sku": product.get("sku", ""),
                "brand": name.split()[0] if name else "",
                "category": product.get("category", ""),
                "region": "Kanakapura",
                "sales_channel": "Kirana",
                "pack_type": "Retail unit",
                "as_of_date": as_of.isoformat(),
                "current_stock": current_stock,
                "average_daily_sales": average_daily_sales,
                "supplier_lead_time_days": lead_time,
                "suggested_reorder_quantity": round(reorder_qty, 8),
                "status": status,
                "dead_stock_risk": risk,
            })
        return sorted(output, key=lambda row: row["suggested_reorder_quantity"], reverse=True)

    def validation_report(self, ledger: dict[str, Any]):
        products, _, daily_sales, first_day, as_of, history_days = self._ledger_series(ledger)
        per_product = {}
        for product_id, product in products.items():
            values = self.daily_series(product_id, daily_sales, first_day, history_days)
            per_product[product_id] = self.forecast(values)["validation"]
        validated = [entry for entry in per_product.values() if entry]
        valid_wape = [entry["wape"] for entry in validated if entry["wape"] is not None]
        report = {
            "dataset": "frontend ledger payload; synthetic seed transactions are marked isSynthetic",
            "product_count": len(products),
            "sales_count": len(ledger.get("sales", [])),
            "synthetic_sales_count": sum(
                bool(sale.get("isSynthetic")) for sale in ledger.get("sales", [])
                if isinstance(sale, dict)
            ),
            "history_start": first_day.isoformat(),
            "history_end": as_of.isoformat(),
            "history_days": history_days,
            "forecast_method": "SES alpha=0.3, frozen-origin 14-day holdout",
            "validated_product_count": len(validated),
            "holdout_days": 14,
            "macro_mae": sum(entry["mae"] for entry in validated) / len(validated) if validated else None,
            "macro_wape": sum(valid_wape) / len(valid_wape) if valid_wape else None,
            "per_product": per_product,
            "sample_recommendations": self.recommendations(ledger)[:10],
        }
        return report
