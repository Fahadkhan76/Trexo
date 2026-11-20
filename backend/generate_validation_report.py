from pathlib import Path
import json
import sys

from inference_service import InferenceService

ROOT = Path(__file__).resolve().parent
ledger_path = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "data" / "demo_ledger_export.json"
if not ledger_path.is_absolute():
    ledger_path = Path.cwd() / ledger_path
if not ledger_path.exists():
    raise SystemExit(
        f"Ledger export not found: {ledger_path}. Run: npx tsx scripts/export-demo-ledger.ts"
    )
ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
report = InferenceService().validation_report(ledger)
report["sales_count"] = len(ledger.get("sales", []))
report["synthetic_sales_count"] = sum(bool(sale.get("isSynthetic")) for sale in ledger.get("sales", []))
destination = ROOT / "validation_report.json"
destination.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(f"Wrote {destination} using {ledger_path}")
print(
    f"Validated {report['validated_product_count']} products; "
    f"macro MAE={report['macro_mae']:.3f}; macro WAPE={report['macro_wape']:.3f}"
)
print("Top reorder recommendations:")
for row in report["sample_recommendations"][:5]:
    print(f"  {row['product_id']} {row['sku']}: average={row['average_daily_sales']:.3f}/day, "
          f"stock={row['current_stock']}, reorder={row['suggested_reorder_quantity']:.3f}")
