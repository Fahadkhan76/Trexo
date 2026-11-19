import { Lock, TrendingDown, EyeOff } from 'lucide-react';
import { getDictionary } from '../i18n';
import {
  getDeadStockItems,
  getEstimatedLostSalesPaise,
  getLowAndOutOfStockItems,
  getTotalTrappedCashPaise,
} from '../selectors/ledgerSelectors';
import { useMunimStore } from '../store/useMunimStore';
import { formatINR, MASKED_CURRENCY } from '../utils/money';

export function HeroStrip() {
  const products = useMunimStore((s) => s.ledger.products);
  const privacyHidden = useMunimStore((s) => s.privacyHidden);
  const language = useMunimStore((s) => s.language);
  const setActiveDrawer = useMunimStore((s) => s.setActiveDrawer);

  const dict = getDictionary(language);
  const deadItems = getDeadStockItems(products);
  const trappedCashPaise = getTotalTrappedCashPaise(products);
  const lowOrOos = getLowAndOutOfStockItems(products);
  const lostSalesPaise = getEstimatedLostSalesPaise(products);

  return (
    <section className="grid grid-cols-2 gap-4" aria-label="Store cash health summary">
      {/* Hero 1: Cash trapped in dead stock */}
      <button
        type="button"
        onClick={() => setActiveDrawer('rescue')}
        className="group khata-surface flex items-center justify-between gap-4 rounded-xl px-5 py-4 text-left transition-colors hover:border-red-300 hover:bg-red-50/40 focus-visible:outline-2 focus-visible:outline-slate-900 min-h-[84px]"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-base font-semibold text-red-800">
            <Lock className="h-4 w-4 shrink-0" />
            <span className="truncate">{dict.heroTrappedCash}</span>
          </div>
          <p className="mt-1 text-sm text-[#475569]">
            {deadItems.length} idle items · {dict.heroTrappedSub}
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono text-2xl font-bold tracking-tight text-red-700 tabular-nums flex items-center justify-end gap-1.5">
            {privacyHidden ? (
              <>
                <EyeOff className="h-4 w-4 text-[#475569]" />
                <span>{MASKED_CURRENCY}</span>
              </>
            ) : (
              formatINR(trappedCashPaise, { decimals: false })
            )}
          </div>
          <span className="mt-0.5 inline-block text-sm font-medium text-red-800 underline-offset-2 group-hover:underline">
            {dict.rescueStuckCash} →
          </span>
        </div>
      </button>

      {/* Hero 2: Estimated sales lost to stockouts */}
      <button
        type="button"
        onClick={() => setActiveDrawer('low_stock')}
        className="group khata-surface flex items-center justify-between gap-4 rounded-xl px-5 py-4 text-left transition-colors hover:border-amber-300 hover:bg-amber-50/40 focus-visible:outline-2 focus-visible:outline-slate-900 min-h-[84px]"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-base font-semibold text-amber-800">
            <TrendingDown className="h-4 w-4 shrink-0" />
            <span className="truncate">{dict.heroLostSales}</span>
          </div>
          <p className="mt-1 text-sm text-[#475569]">
            {lowOrOos.length} fast/low items · Seeded estimate
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono text-2xl font-bold tracking-tight text-amber-800 tabular-nums">
            {formatINR(lostSalesPaise, { decimals: false })}
          </div>
          <span className="mt-0.5 inline-block text-sm font-medium text-amber-900 underline-offset-2 group-hover:underline">
            {dict.lowStockAction} →
          </span>
        </div>
      </button>
    </section>
  );
}
