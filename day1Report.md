# Trexo Repository Capabilities Report

**Inspection date:** 2026-11-19  
**Scope:** Current repository files, scripts, test code, documentation, and the checked-in/generated demo validation artifacts. Line references refer to the inspected working tree. “Implemented” below means there is executable source in this repository; UI copy and README claims are identified separately where they do not correspond to a full implementation.

## 1. Repository overview and directory map

### Directory map

| Path | Actual contents and purpose |
|---|---|
| `src/` | React/TypeScript browser application. `src/main.tsx:1-24` mounts the app; `src/App.tsx:1-35` defines routing and global drawers/toasts. |
| `src/components/` | UI components for navigation, counter/inventory actions, forms, receipt, restock recommendations, toast and dialogs. Examples: `AppShell`, `ActionDrawers`, `RestockRecommendations`, `ProductFormModal`. |
| `src/data/` | Seed generators and forecast display configuration: `mockProducts.ts`, `mockSales.ts`, `mockCustomers.ts`, `mockSuppliers.ts`, `mockForecasts.ts`. `createSeedSales` and its deterministic synthetic history are in `src/data/mockSales.ts:9-77,79-…`. |
| `src/pages/` | Routed screens: `CounterPage` (`/`), `InventoryPage` (`/inventory`), and `TrexoPage` (`/restock`), routed in `src/App.tsx:20-24`. |
| `src/selectors/` | Derived ledger calculations and UI classifications, principally `ledgerSelectors.ts` (`getProductStatus`, dead-stock, trapped cash, alerts, local forecast summary). |
| `src/services/` | Typed async service interfaces and local mock service implementations, plus localStorage initialization/persistence. `getServices()` returns the mock implementation (`src/services/index.ts:8-12`). |
| `src/store/` | Zustand ledger and UI state/actions in `useMunimStore.ts`; `src/store/__tests__/` tests cart/store behavior. |
| `src/utils/` | Date and paise/money arithmetic utilities, with `src/utils/__tests__/` tests. |
| `backend/` | Flask HTTP application, Python inference calculations, unittest suite, report generator, requirements, JSON demo export, generated validation report, and retained legacy FMCG CSV. |
| `backend/data/` | `demo_ledger_export.json` is the current reproducible ledger snapshot. `fmcg_observations_clean.csv` is present but is not read by active backend code. |
| `scripts/` | `export-demo-ledger.ts` invokes the frontend ledger seed path; `.mjs` bundles/runs it with esbuild. `ui-smoke.mjs` is a Playwright browser smoke workflow. |
| `docs/` | No `docs/` directory exists in the inspected repository. |
| `tests/` | No top-level `tests/` directory exists. Tests are nested under `backend/`, `src/store/__tests__/`, and `src/utils/__tests__/`. |
| `dist/`, `node_modules/`, `screenshots/` | Generated/dependency/output directories may exist locally; `dist/`, `node_modules/`, and screenshots are ignored by `.gitignore`. They are not source-of-truth data. |

### Entry points and workflows

- Browser entry: `index.html:1-19` loads `/src/main.tsx`; `src/main.tsx:1-24` imports styles/fonts, creates the React root and renders `App` in `StrictMode`.
- UI routes: `src/App.tsx:20-24` routes `/` to counter, `/inventory` to inventory, `/restock` to Trexo, and redirects unmatched paths to `/`.
- Frontend dev/build/test: `package.json:6-13` defines `npm run dev`, `build`, `preview`, `lint` (TypeScript check), `test` (Vitest), and `test:ui` (Node/Playwright script).
- Backend entry: `backend/app.py:37-70` defines recommendation, health, and validation endpoints; `backend/app.py:73-74` runs Flask on `PORT` or 5000.
- Demo export: `scripts/export-demo-ledger.ts:1-19` calls `createInitialLedger` with a fixed reference date and writes products/sales/suppliers JSON. `scripts/export-demo-ledger.mjs:1-25` bundles and runs that TypeScript script using esbuild and removes its temporary directory.
- Validation artifact: `backend/generate_validation_report.py:1-29` reads the export (or a supplied path), computes a report through `InferenceService`, and writes `backend/validation_report.json`.
- Python tests: `backend/test_inference_service.py:16-…` uses `unittest` and Flask's test client.
- UI smoke: `scripts/ui-smoke.mjs:5-8,39-…` launches Chromium against `UI_BASE_URL` (default port 3000), checks `/`, `/inventory`, `/restock` at 360/768/1024/1440 widths and writes screenshots to ignored `screenshots/`.

## 2. Tech stack and dependencies

### Used by executable code

- **Frontend:** TypeScript/JavaScript, React 19, React DOM, React Router, Zustand, Recharts, Lucide icons, Vite, Tailwind CSS 4 Vite plugin, JetBrains Mono / Plus Jakarta Sans / Noto Sans Devanagari / Noto Sans Kannada font packages. Versions/declarations are in `package.json:15-45`.
- **Backend:** Python, Flask, flask-cors; only these Python packages are declared in `backend/requirements.txt:1-2`. Backend computations use Python standard library (`datetime`, `collections`, `math`, `json`, `functools`, `pathlib`, `unittest`).
- **Data interchange/persistence:** JSON over HTTP and a JSON export; browser `localStorage`; ISO date strings; CSV file exists but is inactive for current inference. Monetary values are represented as integer paise in frontend ledger objects (`src/types/index.ts:35-37,81-114`).
- **Testing/tooling:** Vitest, jsdom, TypeScript compiler (`npm run lint`), Python `unittest`, Flask test client, Playwright Chromium smoke script, esbuild wrapper (`package.json:6-13,31-45`).
- **Build/config:** `vite.config.ts` uses React and Tailwind plugins and contains asset-copy build hook; `tsconfig.json` enables strict checking, ES2022, bundler module resolution and JSX transform; `index.html` is Vite document shell.

### Mentioned/proposed but not evidenced as active dependencies

No pandas, NumPy, scikit-learn, statsmodels, Prophet, database driver, ORM, job queue, model-serving framework, cloud SDK, or model registry is declared or used in the inspected Python backend. README’s service contracts describe future replaceable backend interfaces, while `src/services/index.ts:8-12` selects local mocks. There is no `docs/` design corpus in this checkout to establish further planned dependencies.

## 3. End-to-end data and ML pipelines

### Frontend ledger pipeline

`src/services/storage.ts:8-32` creates a ledger from `createSeedProducts`, `createSeedSales`, customers, and suppliers, then derives each product’s `lastSoldAt` from the latest matching sale line. `loadLedger` (`storage.ts:34-64`) reads the single `APP_CONFIG.STORAGE_KEY` localStorage record, seeds on absent/broken/empty-product data, and fills omitted collection arrays. `saveLedger` (`storage.ts:66-72`) serializes the ledger and suppresses storage quota errors. `resetLedgerStorage` (`storage.ts:74-78`) generates and persists a fresh relative-date seed.

The frontend ledger schema is `LedgerState` (`src/types/index.ts:218-228`), with products, sales, customers, suppliers, returns, purchase orders, parked bills, PO draft and seed timestamp. Product identifiers/SKUs are in `Product` (`types/index.ts:26-48`); sale line items link by `productId` and carry SKU/quantity (`types/index.ts:81-93`).

`src/data/mockSales.ts:9-77` generates 120 days of synthetic, daily grouped transactions. Deterministic weekday and demand factor arrays introduce variation; the deterministic modulo condition creates occasional no-sale days. Product line items retain product ID/SKU; each generated sale has `isSynthetic: true`. Products designated stale based on their seed `lastSoldAt` stop receiving generated demand after that day. The three named invoice examples in `mockSales.ts` are also synthetic and appended to generated history (`:79-end`). These retrospective transactions are not decremented from the seed stock snapshot; actual completed bills flow through mock billing/store logic and update stock.

### Backend ledger and recommendation pipeline

`RestockRecommendations` (`src/components/RestockRecommendations.tsx:6-…`) posts the current Zustand ledger’s `{products, sales, suppliers}` to the configured Flask API base URL (default `http://127.0.0.1:5000`). It expects a JSON recommendation array and `X-Total-Count` for pagination. This is the active frontend-to-Python data handoff; CSV is not the source.

`backend/app.py:28-35` parses and validates a JSON object with product and sale arrays and canonicalizes it using sorted compact JSON. The two `lru_cache(maxsize=4)` wrappers (`app.py:19-26`) reuse recommendation/report output for identical canonical payloads. The service builds a `productId → product` map, supplier map, and daily quantity buckets by sale `createdAt` and item `productId` (`backend/inference_service.py:31-75`). Only positive finite quantities for known product IDs count. Its history window is the calendar range between earliest and latest parseable sale dates; intervening absent days become zeros (`:57-79`).

### Forecast and holdout evaluation

`InferenceService._ses` (`backend/inference_service.py:82-89`) implements simple exponential smoothing with default alpha 0.3, initializing level from the first observation and applying each subsequent actual. `forecast` (`:91-109`) uses the last 14 daily observations as holdout when history length exceeds 14. It estimates one constant daily demand at the training endpoint and repeats it across the holdout. MAE is mean absolute daily error. WAPE is sum absolute daily error divided by total absolute actual holdout units; it is `None` when the denominator is zero. It also reports actual units and predicted units over the horizon.

The demand used in recommendations is SES level fitted on the full available series, while the reported validation prediction is trained only on the preceding train portion. This separation avoids holdout leakage into the validation prediction, but the reported error is a single frozen-origin 14-day evaluation, not rolling-origin backtesting. `validation_report` (`:168-end`) aggregates per-product MAE and the arithmetic mean of non-null product WAPEs (macro WAPE), and includes sample recommendations. Products with ≤14 observations have no validation entry. Synthetic history means these metrics assess agreement with generated data only.

### Report artifact provenance

`backend/data/demo_ledger_export.json` is produced from the frontend seed path. `backend/validation_report.json` is output of `backend/generate_validation_report.py`. The checked-in report currently records 47 products, 123 transactions (all synthetic), 120 calendar days from 2026-07-22 through 2026-11-18, 47 validated products, macro MAE **0.7787474778127712 units/day**, macro WAPE **0.2592667493908484**. These values were read from the artifact; they are not claims of real-world performance. The fixed export reference date in `scripts/export-demo-ledger.ts:7` is 2026-11-18, so rerunning today does not rebase its end date to today.

## 4. Core capabilities and business logic

### Transaction, billing, returns

The codebase has typed sales/billing records and mock billing actions, but no general transaction classifier that labels raw bank/POS records. Payment mode is a user-selected typed value (`src/types/index.ts:13,95-114`). `Sale` holds one completed bill and line items; there is no transaction audit pipeline or import reconciliation pipeline. Supplier returns are explicit records with reasons `dead_stock`, `near_expiry`, or `damaged` (`types/index.ts:136-149`). No cancellation/return-to-original-sale matching algorithm is present in the inspected service/backend pipeline. Special transaction audits (void, reversal, suspicious transaction) are not implemented.

### Demand forecasting

The backend SES and holdout behavior are described above. It is a univariate constant-level method with no weekday/calendar/product features in the model; those factors affect synthetic data generation only. No candidate model comparison, learned feature engineering, parameter calibration, automated fallback model selection, or model training artifact exists. For short histories the service uses full-series SES for demand and omits validation. For zero history, recommendation average is zero. Separately, `computeForecastSummary` in `src/selectors/ledgerSelectors.ts:256-…` is a local UI estimate based on seeded `avgDailySales`, growth multipliers, catalog price totals and sales totals; it is not the backend SES model. `src/data/mockForecasts.ts:3-…` supplies horizon buckets/multipliers.

### Dead-stock and trapped inventory

Frontend classification is based on the product snapshot: `getDaysWithoutSales`, `isDeadStock`, `isNearExpiry`, `getProductStatus` (`src/selectors/ledgerSelectors.ts:18-46`). Dead stock means positive stock and at least `APP_CONFIG.DEADSTOCK_DAYS` (30) elapsed from `lastSoldAt` (`src/config.ts:1-13`). Trapped capital is `max(0, stockQty) * max(0, costPaise)` (`ledgerSelectors.ts:52-56`); total trapped cash sums dead-stock items (`:88-94`). The dead stock queue sorts by trapped capital (`:59-63`).

Backend risk is a separate heuristic: `InferenceService.dead_stock_risk` (`backend/inference_service.py:111-115`) sets a demand-dependent threshold `max(14, 2/max(daily_demand, 0.05))`, scores elapsed days relative to it, clamps 0–100 and labels high at 100, medium at 60, else low. No-sales products use elapsed age from the end of the dataset and zero average demand, producing threshold 40 days; risk does not calculate trapped inventory value. Backend response includes score/status-risk fields, not a probability calibrated against outcomes. Calibration curves and a priority queue from calibrated failure probabilities are absent. No-sales history status is handled as `No sales history`.

### Movement, reorder and purchase order

There is no ABC/XYZ segmentation or statistical trend/velocity classifier in the service. The frontend has boolean `fastMover` and seeded `avgDailySales`, and local low/out-of-stock selectors rank by these existing values (`ledgerSelectors.ts:65-73`). These are seed/product attributes, not computed ABC/XYZ classes.

Backend `recommendations` (`backend/inference_service.py:117-166`) computes each ledger product’s observed average as total positive units divided by the full calendar history window. Current stock is `stockQty` clamped to nonnegative. Lead time uses product `leadTimeDays`, otherwise supplier `leadTimeDays`, otherwise 3 days; negative lead is clamped to zero. Reorder quantity is `max(0, average_daily_sales * (lead_time + 3) - current_stock)`. There is no separate standard-deviation safety stock calculation: the `+3` is a fixed three-day buffer, matching the requested formula. No MOQ is present in frontend Product or Supplier schemas (`types/index.ts:26-48,126-134`) and backend does not round quantities. No-history results in zero demand/reorder; zero stock with positive demand gets positive reorder; excess stock yields zero.

The browser also has a separate local purchase-order/demand heuristic in `computeForecastSummary` (`ledgerSelectors.ts:256-…`), and mock PO drafting/building through `src/services/mockServices.ts` and `src/store/useMunimStore.ts`. It should not be conflated with the backend recommendation formula.

### Anomaly, financial readiness, simulation/backtesting

No anomaly-detection module, financial readiness check, cash-flow simulation, inventory simulation, Monte Carlo test, or multi-window backtest was found in executable source. Existing “cash trapped”/“lost sales” values are UI business heuristics (`ledgerSelectors.ts:88-115`); the lost-sales number uses configured penalty-day constants and seeded fast-mover/average-demand fields. The only model evaluation is the SES frozen 14-day holdout.

## 5. Inference service and API contracts

### Methods

- `InferenceService._ledger_series(ledger)` (`backend/inference_service.py:31-75`): requires `products` and `sales` lists; maps products/suppliers by string ID; accepts sale dates parseable as ISO date prefix and line items with known `productId` and finite positive `qty`; builds the global date span and unit buckets. Malformed individual sales/items are mostly skipped; malformed top-level arrays raise `ValueError`.
- `daily_series(product_id, daily_sales, first_day, history_days)` (`:77-80`): returns a dense daily sequence, inserting zero on missing dates.
- `_ses(values, alpha=0.3)` (`:82-89`): returns last exponentially smoothed level, or zero for empty input.
- `forecast(values, holdout_days=14, alpha=0.3)` (`:91-109`): returns `daily_demand` and either `validation: null` for too-short data or validation counts/error metrics/actual and predicted units.
- `dead_stock_risk(days_since_sale, daily_demand)` (`:111-115`): returns `{score, days_since_sale, risk}`.
- `recommendations(ledger)` (`:117-166`): emits one row per valid mapped product, sorted by suggested quantity descending. Fields: `product_id`, `sku`, `brand`, `category`, `region`, `sales_channel`, `pack_type`, `as_of_date`, `current_stock`, `average_daily_sales`, `supplier_lead_time_days`, `suggested_reorder_quantity`, `status`, `dead_stock_risk`.
- `validation_report(ledger)` (`:168-end`): returns dataset description, counts/date span/method, validated product count, holdout length, macro metrics, per-product validations, and top sample recommendations.

### HTTP routes and validation

- `POST /api/restock/recommendations?limit=100&offset=0`: JSON object with `products` array and `sales` array; optional suppliers. Returns JSON array page and `X-Total-Count`. Limit integer is clamped to 0..1000, offset clamped to ≥0. The route is also registered for GET, but without a JSON payload it returns 400; GET is not a query-backed read API (`backend/app.py:37-54`).
- `GET /api/health`: `{"status":"ok"}` (`app.py:56-59`).
- `POST /api/validation/report`: same payload schema and JSON report (`app.py:61-70`).
- Invalid top-level payload/query parameters and caught `TypeError`, `ValueError`, `KeyError` return 400 JSON errors. CORS defaults to localhost/127.0.0.1 ports 3000 and 3001 and can be overridden with comma-separated `CORS_ORIGINS` (`app.py:11-16`). `PORT` defaults to 5000.

No formal JSON Schema/OpenAPI document, auth, request-size limit, database, model registry, serialized model, checksum verification, or model artifact loading is implemented. “Registry/checksum verification” therefore has no applicable implementation contract.

## 6. Missing or proposed-only functionality

- No `docs/` directory or design specification set is present. README’s “future backend can replace them” wording is architectural intent, not a running remote service.
- No backend implementation of the frontend’s broad typed service interfaces; current `getServices()` selects local mock services.
- No database/server persistence, authentication, roles, cloud deployment, background job queue, external supplier/POS integration, or offline service worker. README explicitly notes no service worker and no cold-refresh offline loading (`README.md:5`).
- No transaction classification/audit, cancellation/return matching, ABC/XYZ segmentation, demand trend model, calibrated dead-stock probability/curve, anomaly detection, financial readiness engine, or simulation/backtest framework beyond the described holdout.
- No ML framework, model registry, model checksum/signature verification, saved model weights, model training CLI, or model comparison pipeline.
- `backend/data/fmcg_observations_clean.csv` remains in the repository but active backend code does not reference it. It is neither frontend storage nor current inference source. The current backend reads ledger JSON only.
- No top-level `tests/`; test files live within backend and frontend source directories. No docs-specific API schema.

## 7. Limitations, bugs and risks

- **Synthetic accuracy:** All export metrics are based on deterministic synthetic transactions. They cannot establish real demand or real-world forecast accuracy. Export date is fixed at 2026-11-18, not “today”; the README’s wording about latest observations should be read as relative to this fixed export workflow.
- **Evaluation scope:** Holdout is a single 14-day frozen-origin evaluation; it does not refit each day, compare models, quantify confidence intervals, or guard against product selection bias. Macro WAPE averages only products whose holdout actual total is nonzero, unlike global pooled WAPE.
- **Series alignment:** `_ledger_series` uses one global first/last sale date across all products. Products introduced later or with no sales are padded with zeros before their first sale, which may depress product average demand. It also uses latest valid sale date as as-of date rather than current wall-clock date.
- **Validation/inputs:** Top-level shape is checked, but there is no strict schema validation for product identifiers/stock, dates, duplicate IDs, absurd quantities, or payload size. A malformed product missing `id` is skipped when building the map; duplicate IDs overwrite. Negative quantities are excluded; returns/voids are not reconciled.
- **Risk score:** Backend dead-stock score is a hand-set threshold heuristic, not calibrated risk. A product with no sales uses `history_days - 1` as elapsed inactivity rather than a true last-sale timestamp; frontend dead-stock uses product `lastSoldAt` and a fixed 30 days, so their classifications can differ.
- **Reorder interpretation:** Backend formula uses sales-history mean, ledger stock and a fixed three-day buffer. No supplier lead-time/MOQ values exist in current frontend schema, so seeded requests use the 3-day fallback and no MOQ rounding. The endpoint does not exclude stop-reordering products or dead stock; caller/UI must interpret results accordingly.
- **Potential request-cache memory:** `lru_cache(maxsize=4)` keys are full canonical ledger JSON strings and values can include all recommendation rows/reports. This is small for demo payloads but no byte limit or cache invalidation policy exists beyond LRU eviction.
- **Concurrency / locking:** localStorage save is synchronous but there is no cross-tab lock/merge protocol. Flask in-process LRU cache has no explicit application-level coordination/invalidation; multiple worker processes have independent caches. `useMunimStore.ts` has a module-level `completingBill` guard (`:107-108`) but it does not provide distributed concurrency control.
- **Import-time side effects:** `src/store/useMunimStore.ts:107` calls `loadLedger()` during module evaluation; importing the store accesses `window.localStorage` through storage. The tests run in jsdom. Backend app import creates Flask app/CORS/service/cache wrappers but does not start listener unless run as main (`app.py:73-74`).
- **Hardcoded/environment-specific settings:** Frontend recommendation default host is `127.0.0.1:5000` (`RestockRecommendations.tsx:6`); Flask fallback port is 5000. `scripts/export-demo-ledger.ts:7` hardcodes snapshot reference date. UI smoke default is port 3000 and screenshot output is repository-relative.
- **Documentation/data mismatch:** README reports TypeScript setup/test and backend startup but its top “npm test” comment describes only paise/cart math; actual frontend tests cover three files (money, stock, cart). README includes the retained FMCG CSV history only as inactive-file clarification (the active pipeline is ledger JSON). The README formula has appeared with text-encoding mojibake in the inspected console rendering; mathematical expression in source is `max(0, avg * (lead + 3) - stock)`.
- **Build/test status:** At the time of the prior recorded verification, Python backend suite passed 5 tests, Vitest passed 33 tests in 3 files, TypeScript lint and Vite build passed, with a large-chunk warning. Browser integration was previously exercised against Flask and Vite at alternate ports with 47 recommendation rows and no console errors. These are prior session observations, not rerun as part of this report-writing pass; rerun commands below for fresh verification.

## Reproduction commands

From repository root (PowerShell examples):

```powershell
npm install
npm run dev
npm test
npm run lint
npm run build
npm run test:ui
```

Backend and generated artifact workflow:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
node scripts/export-demo-ledger.mjs
python -m unittest backend.test_inference_service -v
python backend/generate_validation_report.py
python backend/app.py
```

The Vite command binds port 3000 by default, Flask binds port 5000. If port 5000 is occupied, run `$env:PORT='5055'; python backend/app.py`, and in a separate PowerShell terminal set `$env:VITE_API_BASE_URL='http://127.0.0.1:5055'` before `npm run dev -- --port 3001`. Backend CORS permits localhost/127.0.0.1 on frontend ports 3000/3001 by default.
