import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  EyeOff,
  RotateCcw,
  ShoppingCart,
  Sparkles,
  Tag,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { RestockRecommendations } from '../components/RestockRecommendations';
import { getDictionary, getProductDisplayName } from '../i18n';
import {
  computeForecastSummary,
  getDaysWithoutSales,
  getDeadStockItems,
  getTrappedCapitalPaise,
  getUnifiedAlerts,
} from '../selectors/ledgerSelectors';
import { useMunimStore } from '../store/useMunimStore';
import type { ForecastHorizon, Product } from '../types';
import { formatINR, MASKED_CURRENCY } from '../utils/money';

const HORIZONS: { id: ForecastHorizon; label: string }[] = [
  { id: '1W', label: '1 Week' },
  { id: '1M', label: '1 Month' },
  { id: '6M', label: '6 Months' },
  { id: '1Y', label: '1 Year' },
];

export function TrexoPage() {
  const ledger = useMunimStore((s) => s.ledger);
  const language = useMunimStore((s) => s.language);
  const privacyHidden = useMunimStore((s) => s.privacyHidden);
  const poDraft = useMunimStore((s) => s.poDraft);
  const setActiveDrawer = useMunimStore((s) => s.setActiveDrawer);
  const addToPoDraft = useMunimStore((s) => s.addToPoDraft);
  const applyCounterDiscount = useMunimStore((s) => s.applyCounterDiscount);
  const returnToSupplier = useMunimStore((s) => s.returnToSupplier);
  const setStopReordering = useMunimStore((s) => s.setStopReordering);

  const [horizon, setHorizon] = useState<ForecastHorizon>('1M');
  const [returnTarget, setReturnTarget] = useState<Product | null>(null);

  const dict = getDictionary(language);

  const forecast = useMemo(
    () => computeForecastSummary(ledger.products, ledger.sales, horizon),
    [ledger.products, ledger.sales, horizon]
  );

  const deadItems = useMemo(() => getDeadStockItems(ledger.products), [ledger.products]);
  const alerts = useMemo(() => getUnifiedAlerts(ledger), [ledger]);

  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of ledger.products) map.set(p.id, p);
    return map;
  }, [ledger.products]);

  const stoppedProducts = useMemo(
    () => ledger.products.filter((p) => p.stopReordering),
    [ledger.products]
  );

  return (
    <div className="space-y-5">
      {/* Header & Horizon Selector */}
      <div className="khata-surface flex flex-wrap items-center justify-between gap-4 rounded-xl px-5 py-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-5 w-5 text-[#0F172A]" />
            <h2 className="text-xl font-bold text-[#0F172A]">{dict.navRestock}</h2>
            <span className="rounded-md border border-[#D6CFC0] bg-[#F4EFE4] px-2.5 py-0.5 text-xs font-semibold text-[#475569]">
              {dict.demoForecastBadge}
            </span>
          </div>
          <p className="mt-1 text-sm text-[#475569]">
            Forward demand estimate based on seeded kirana turnover and recent counter sales.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div
            className="flex items-center rounded-lg border border-[#D6CFC0] bg-[#FAF7F0] p-1"
            role="group"
            aria-label="Forecast range"
          >
            {HORIZONS.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => setHorizon(h.id)}
                className={`min-h-[38px] rounded-md px-3 py-1 text-sm font-semibold transition-colors whitespace-nowrap ${
                  horizon === h.id
                    ? 'bg-[#0F172A] text-white'
                    : 'text-[#475569] hover:text-[#0F172A]'
                }`}
              >
                {h.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setActiveDrawer('purchase_order')}
            className="flex min-h-[42px] items-center gap-2 rounded-xl bg-[#0F172A] px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
          >
            <ShoppingCart className="h-4 w-4" />
            <span>PO Draft ({poDraft.length})</span>
          </button>
        </div>
      </div>

      <RestockRecommendations />

      {/* 3 Summary Cards */}
      <section className="grid grid-cols-3 gap-4" aria-label="Forecast summary">
        <div className="khata-surface rounded-xl p-4">
          <div className="flex items-center justify-between text-sm text-[#475569]">
            <span className="font-semibold">{dict.expectedSales}</span>
            <span>{dict.demoForecastBadge}</span>
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-[#0F172A] tabular-nums">
            {formatINR(forecast.expectedSalesPaise, { decimals: false })}
          </div>
        </div>

        <div className="khata-surface rounded-xl p-4">
          <div className="flex items-center justify-between text-sm text-[#475569]">
            <span className="font-semibold">{dict.recommendedPurchase}</span>
            <span>{dict.demoForecastBadge}</span>
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-[#0F172A] tabular-nums flex items-center gap-2">
            {privacyHidden ? (
              <>
                <EyeOff className="h-4 w-4 text-[#475569]" />
                <span>{MASKED_CURRENCY}</span>
              </>
            ) : (
              formatINR(forecast.recommendedPurchasePaise, { decimals: false })
            )}
          </div>
        </div>

        <div className="khata-surface rounded-xl p-4">
          <div className="flex items-center justify-between text-sm text-[#475569]">
            <span className="font-semibold">{dict.demandGrowth}</span>
            <span>{dict.demoForecastBadge}</span>
          </div>
          <div className="mt-2 flex items-center gap-2 font-mono text-2xl font-bold text-emerald-700 tabular-nums">
            <TrendingUp className="h-6 w-6" />
            <span>+{forecast.demandGrowthPct}%</span>
          </div>
        </div>
      </section>

      {/* Demand Chart + Unified Alert Feed */}
      <div className="grid grid-cols-12 gap-4 items-start">
        <section className="col-span-12 xl:col-span-7 khata-surface rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-[#0F172A]">
              Projected Demand vs Baseline ({HORIZONS.find((h) => h.id === horizon)?.label})
            </h3>
            <span className="text-xs text-[#475569]">{dict.demoForecastBadge} · INR</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={forecast.chartSeries} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5DFD3" />
                <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 12 }} />
                <YAxis tick={{ fill: '#475569', fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => [`₹${Number(value).toLocaleString('en-IN')}`, '']}
                  contentStyle={{
                    backgroundColor: '#FFFDF8',
                    borderColor: '#D6CFC0',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="baselineSalesInr" name="Current Pace" fill="#CBD5E1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expectedSalesInr" name="Forecast Sales" fill="#15803D" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Unified Alert Feed */}
        <section className="col-span-12 xl:col-span-5 khata-surface rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-[#0F172A]">
              Unified Alert Feed ({alerts.length})
            </h3>
          </div>
          {alerts.length === 0 ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-center text-sm font-semibold text-emerald-900">
              All clear — no active stock or supplier alerts.
            </div>
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {alerts.map((alert) => {
                const style =
                  alert.severity === 'critical'
                    ? 'border-red-200 bg-red-50/70 text-red-950'
                    : alert.severity === 'warning'
                      ? 'border-amber-200 bg-amber-50/70 text-amber-950'
                      : 'border-[#E5DFD3] bg-[#FAF7F0] text-[#0F172A]';
                return (
                  <div key={alert.id} className={`rounded-lg border p-3 ${style}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <div className="text-sm font-bold leading-snug">{alert.title}</div>
                          <div className="text-xs opacity-85 mt-0.5">{alert.description}</div>
                        </div>
                      </div>
                      {alert.amountPaise !== undefined && (
                        <span className="font-mono text-xs font-bold shrink-0 tabular-nums">
                          {privacyHidden
                            ? MASKED_CURRENCY
                            : formatINR(alert.amountPaise, { decimals: false })}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Reorder Recommendations */}
      <section className="khata-surface rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold text-[#0F172A]">
              Local Reorder Recommendations ({forecast.recommendations.length})
            </h3>
            <p className="text-sm text-[#475569]">
              Fast movers and low/out-of-stock staples prioritized first. {dict.demoForecastBadge}.
            </p>
          </div>
          {stoppedProducts.length > 0 && (
            <div className="text-xs text-[#475569]">
              {stoppedProducts.length} item(s) excluded via Stop Reordering ·{' '}
              <button
                type="button"
                onClick={() => {
                  for (const p of stoppedProducts) {
                    void setStopReordering(p.id, false, false);
                  }
                }}
                className="font-semibold text-[#0F172A] underline"
              >
                Restore all
              </button>
            </div>
          )}
        </div>

        {forecast.recommendations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#D6CFC0] p-6 text-center text-sm text-[#475569]">
            No reorder recommendations for this horizon.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#E5DFD3] text-[#475569]">
                  <th className="py-2.5 pr-3 font-semibold">Product</th>
                  <th className="py-2.5 px-2 font-semibold text-right">Current Stock</th>
                  <th className="py-2.5 px-2 font-semibold text-right">Predicted Demand</th>
                  <th className="py-2.5 px-2 font-semibold text-right">Recommended Qty</th>
                  <th className="py-2.5 px-2 font-semibold text-right">Est. Value</th>
                  <th className="py-2.5 px-2 font-semibold">Confidence</th>
                  <th className="py-2.5 pl-2 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {forecast.recommendations.slice(0, 14).map((rec) => {
                  const product = productMap.get(rec.productId);
                  if (!product) return null;
                  const inDraft = poDraft.some((i) => i.productId === product.id);
                  const stockClass =
                    rec.currentStock === 0
                      ? 'text-red-700 font-bold'
                      : rec.currentStock <= product.reorderPoint
                        ? 'text-amber-800 font-bold'
                        : 'text-[#0F172A]';

                  return (
                    <tr key={rec.productId} className="border-b border-[#E5DFD3] hover:bg-[#FAF7F0]/75">
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-2.5">
                          <span className="text-2xl leading-none">{product.emoji}</span>
                          <div>
                            <div className="font-semibold text-[#0F172A]">
                              {getProductDisplayName(product, language)}
                            </div>
                            <div className="text-xs text-[#475569]">{rec.reason}</div>
                          </div>
                        </div>
                      </td>
                      <td className={`py-2.5 px-2 text-right font-mono tabular-nums ${stockClass}`}>
                        {rec.currentStock}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums text-[#0F172A]">
                        {rec.predictedDemand}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-bold tabular-nums text-emerald-800">
                        +{rec.recommendedQty}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums text-[#0F172A]">
                        {privacyHidden ? MASKED_CURRENCY : formatINR(rec.estimatedValuePaise)}
                      </td>
                      <td className="py-2.5 px-2 whitespace-nowrap">
                        <span
                          className={`inline-block rounded-md border px-2 py-0.5 text-xs font-semibold ${
                            rec.confidence === 'High'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                              : rec.confidence === 'Medium'
                                ? 'border-amber-200 bg-amber-50 text-amber-900'
                                : 'border-[#D6CFC0] bg-[#FAF7F0] text-[#475569]'
                          }`}
                        >
                          {rec.confidence}
                        </span>
                      </td>
                      <td className="py-2.5 pl-2 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => addToPoDraft(product, rec.recommendedQty)}
                          className={`min-h-[38px] rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                            inDraft
                              ? 'border border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                              : 'bg-[#0F172A] text-white hover:bg-slate-800'
                          }`}
                        >
                          {inDraft ? 'Added (+Add More)' : dict.addToPO}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Dead-Stock Warnings */}
      <section className="khata-surface rounded-xl p-4 space-y-3">
        <div>
          <h3 className="text-lg font-bold text-[#0F172A]">
            Dead-Stock Warnings ({deadItems.length})
          </h3>
          <p className="text-sm text-[#475569]">
            Take immediate action to free trapped cash or stop automatic reordering.
          </p>
        </div>

        {deadItems.length === 0 ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-700" />
            <p className="mt-1.5 font-semibold text-emerald-950">
              No dead-stock warnings right now.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {deadItems.map((product) => {
              const daysIdle = getDaysWithoutSales(product);
              const atRisk = getTrappedCapitalPaise(product);
              const fifteenOff = Math.max(product.costPaise, Math.round(product.sellingPricePaise * 0.85));

              return (
                <div
                  key={product.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50/35 p-3.5"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl">{product.emoji}</span>
                    <div className="min-w-0">
                      <div className="font-bold text-[#0F172A]">
                        {getProductDisplayName(product, language)}
                      </div>
                      <div className="text-sm text-[#475569] font-mono tabular-nums">
                        Unsold: {product.stockQty} · {daysIdle} days without sales · Capital at risk:{' '}
                        <span className="font-bold text-red-700">
                          {privacyHidden ? MASKED_CURRENCY : formatINR(atRisk, { decimals: false })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void applyCounterDiscount(product.id, fifteenOff)}
                      className="flex min-h-[38px] items-center gap-1 rounded-lg bg-[#0F172A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
                    >
                      <Tag className="h-3.5 w-3.5" />
                      <span>Apply 15% Discount</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setReturnTarget(product)}
                      className="flex min-h-[38px] items-center gap-1 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-50 whitespace-nowrap"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Return to Supplier</span>
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(product.stopReordering)}
                      onClick={() => void setStopReordering(product.id, true, true)}
                      className="flex min-h-[38px] items-center gap-1 rounded-lg border border-[#D6CFC0] bg-white px-3 py-1.5 text-xs font-semibold text-[#0F172A] hover:bg-[#F4EFE4] disabled:opacity-50 whitespace-nowrap"
                    >
                      <Ban className="h-3.5 w-3.5" />
                      <span>
                        {product.stopReordering ? 'Reordering Stopped' : dict.stopReordering}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(returnTarget)}
        title="Return stock to supplier?"
        description={
          returnTarget
            ? `Queue all ${returnTarget.stockQty} units of ${returnTarget.name} for supplier return? This removes it from shelf stock and updates Supplier Action Due.`
            : ''
        }
        confirmLabel="Confirm Return"
        tone="danger"
        onCancel={() => setReturnTarget(null)}
        onConfirm={() => {
          if (!returnTarget) return;
          const t = returnTarget;
          setReturnTarget(null);
          void returnToSupplier({
            productId: t.id,
            qty: t.stockQty,
            reason: 'dead_stock',
          });
        }}
      />
    </div>
  );
}
