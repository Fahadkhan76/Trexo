from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
import csv
import math

from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Allows your frontend to call this backend

DATA_FILE = Path(__file__).parent / "data" / "fmcg_observations_clean.csv"


def load_recommendations():
    # Each series is kept separate by product and its source dimensions.
    groups = defaultdict(list)

    with DATA_FILE.open("r", encoding="utf-8-sig", newline="") as file:
        for row in csv.DictReader(file):
            try:
                date = datetime.strptime(row["observation_date"], "%Y-%m-%d").date()
                stock = float(row["stock_available"])
                sold = float(row["units_sold"])
                lead_days = float(row["supplier_lead_time_days"])
            except (ValueError, TypeError):
                continue

            # Skip invalid physical values for this demo calculation.
            if stock < 0 or sold < 0 or lead_days < 0:
                continue

            key = (
                row["sku"],
                row["region"],
                row["sales_channel"],
                row["pack_type"],
            )

            groups[key].append({
                "date": date,
                "stock": stock,
                "sold": sold,
                "lead_days": lead_days,
                "brand": row["brand"],
                "category": row["category"],
            })

    results = []

    for key, records in groups.items():
        records.sort(key=lambda item: item["date"])
        latest_date = records[-1]["date"]
        cutoff = latest_date - timedelta(days=27)

        recent = [record for record in records if record["date"] >= cutoff]
        if not recent:
            continue

        # This is a simple baseline, not an ML prediction.
        average_daily_sales = sum(r["sold"] for r in recent) / 28
        current_stock = recent[-1]["stock"]
        lead_time = sum(r["lead_days"] for r in recent) / len(recent)

        # Keep roughly 3 extra days of stock as a simple safety buffer.
        target_stock = math.ceil(average_daily_sales * (lead_time + 3))
        reorder_quantity = max(0, target_stock - current_stock)

        if current_stock == 0:
            status = "Out of stock in recorded data"
        elif average_daily_sales > 0 and current_stock / average_daily_sales <= lead_time:
            status = "Possible stockout risk"
        elif average_daily_sales == 0:
            status = "No recent recorded sales"
        else:
            status = "Monitor"

        results.append({
            "sku": key[0],
            "brand": recent[-1]["brand"],
            "category": recent[-1]["category"],
            "region": key[1],
            "sales_channel": key[2],
            "pack_type": key[3],
            "as_of_date": latest_date.isoformat(),
            "current_stock": round(current_stock, 2),
            "average_daily_sales": round(average_daily_sales, 2),
            "supplier_lead_time_days": round(lead_time, 1),
            "suggested_reorder_quantity": reorder_quantity,
            "status": status,
        })

    return sorted(
        results,
        key=lambda item: item["suggested_reorder_quantity"],
        reverse=True,
    )


@app.get("/api/restock/recommendations")
def get_recommendations():
    if not DATA_FILE.exists():
        return jsonify({"error": f"CSV not found: {DATA_FILE}"}), 500

    return jsonify(load_recommendations())


@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(debug=True, port=5000)