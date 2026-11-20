from functools import lru_cache
import json
import os

from flask import Flask, jsonify, request
from flask_cors import CORS

from inference_service import InferenceService

app = Flask(__name__)
CORS_ORIGINS = [origin.strip() for origin in os.getenv(
    "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001"
).split(",") if origin.strip()]
CORS(app, resources={r"/api/*": {"origins": CORS_ORIGINS}}, expose_headers=["X-Total-Count"])
inference_service = InferenceService()


@lru_cache(maxsize=4)
def cached_recommendations(ledger_json):
    return inference_service.recommendations(json.loads(ledger_json))


@lru_cache(maxsize=4)
def cached_validation_report(ledger_json):
    return inference_service.validation_report(json.loads(ledger_json))


def canonical_ledger_payload():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return None, (jsonify({"error": "POST a ledger JSON object with products and sales arrays"}), 400)
    if not isinstance(payload.get("products"), list) or not isinstance(payload.get("sales"), list):
        return None, (jsonify({"error": "ledger payload must contain products and sales arrays"}), 400)
    return json.dumps(payload, sort_keys=True, separators=(",", ":")), None


@app.route("/api/restock/recommendations", methods=["GET", "POST"])
def get_recommendations():
    ledger_json, error = canonical_ledger_payload()
    if error:
        return error
    try:
        limit, offset = int(request.args.get("limit", 100)), int(request.args.get("offset", 0))
    except ValueError:
        return jsonify({"error": "limit and offset must be integers"}), 400
    limit, offset = max(0, min(limit, 1000)), max(0, offset)
    try:
        rows = cached_recommendations(ledger_json)
    except (TypeError, ValueError, KeyError) as exc:
        return jsonify({"error": f"Invalid ledger payload: {exc}"}), 400
    response = jsonify(rows[offset:offset + limit])
    response.headers["X-Total-Count"] = str(len(rows))
    return response


@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.post("/api/validation/report")
def validation_report():
    ledger_json, error = canonical_ledger_payload()
    if error:
        return error
    try:
        return jsonify(cached_validation_report(ledger_json))
    except (TypeError, ValueError, KeyError) as exc:
        return jsonify({"error": f"Invalid ledger payload: {exc}"}), 400


if __name__ == "__main__":
    app.run(debug=os.getenv("FLASK_DEBUG") == "1", port=int(os.getenv("PORT", "5000")))
