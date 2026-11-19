import { ArrowUpRight, ClipboardList, RefreshCw, Truck } from 'lucide-react';
import { getDictionary } from '../i18n';
import {
  getDeadStockItems,
  getLowAndOutOfStockItems,
  getSupplierReturnsSummary,
} from '../selectors/ledgerSelectors';
import { useMunimStore } from '../store/useMunimStore';
import { formatINR, MASKED_CURRENCY } from '../utils/money';

export function CashActionStrip() {
  const ledger = useMunimStore((s) => s.ledger);
  const privacyHidden = useMunimStore((s) => s.privacyHidden);
  const language = useMunimStore((s) => s.language);
  const setActiveDrawer = useMunimStore((s) => s.setActiveDrawer);

  const dict = getDictionary(language);
  const deadItems = getDeadStockItems(ledger.products);
  const lowOrOos = getLowAndOutOfStockItems(ledger.products);
  const supSummary = getSupplierReturnsSummary(ledger);

  return (
    <section
      className="grid grid-cols-3 gap-3"
      aria-label="Today's Cash Action Strip"
    >
      {/* 1. Rescue Stuck Cash */}
      <button
        type="button"
        onClick={() => setActiveDrawer('rescue')}
        className="khata-surface flex min-h-[68px] items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition-colors hover:border-red-400 hover:bg-red-50/35"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-700 border border-red-200">
            <RefreshCw className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-base font-bold text-[#0F172A] truncate">
              {dict.rescueStuckCash}
            </div>
            <div className="text-sm text-[#475569] truncate">
              {deadItems.length} dead items · Apply discount or return
            </div>
          </div>
        </div>
        <ArrowUpRight className="h-5 w-5 shrink-0 text-[#475569]" />
      </button>

      {/* 2. Supplier Action Due */}
      <button
        type="button"
        onClick={() => setActiveDrawer('supplier_due')}
        className="khata-surface flex min-h-[68px] items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition-colors hover:border-slate-500 hover:bg-[#F4EFE4]/60"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F4EFE4] text-[#0F172A] border border-[#D6CFC0]">
            <Truck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-base font-bold text-[#0F172A] truncate">
              {dict.supplierActionDue}
            </div>
            <div className="text-sm text-[#475569] truncate font-mono tabular-nums">
              {supSummary.totalItemsCount} returns · Bal{' '}
              {privacyHidden
                ? MASKED_CURRENCY
                : formatINR(supSummary.totalSupplierPendingPaise, { decimals: false })}
            </div>
          </div>
        </div>
        <ArrowUpRight className="h-5 w-5 shrink-0 text-[#475569]" />
      </button>

      {/* 3. Low Stock Reorder */}
      <button
        type="button"
        onClick={() => setActiveDrawer('low_stock')}
        className="khata-surface flex min-h-[68px] items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition-colors hover:border-amber-400 hover:bg-amber-50/40"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-base font-bold text-[#0F172A] truncate">
              {dict.lowStockAction}
            </div>
            <div className="text-sm text-[#475569] truncate">
              {lowOrOos.length} items need reorder · WhatsApp / Copy
            </div>
          </div>
        </div>
        <ArrowUpRight className="h-5 w-5 shrink-0 text-[#475569]" />
      </button>
    </section>
  );
}
