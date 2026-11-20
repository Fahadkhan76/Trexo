import { useMemo, useState } from 'react';
import {
  Copy,
  MessageCircle,
  Printer,
  RotateCcw,
  Tag,
  Truck,
  X,
  CheckCircle2,
  ShoppingCart,
} from 'lucide-react';
import { APP_CONFIG } from '../config';
import { getDictionary, getProductDisplayName } from '../i18n';
import {
  getDaysWithoutSales,
  getDeadStockItems,
  getEffectiveCounterPricePaise,
  getLowAndOutOfStockItems,
  getSupplierReturnsSummary,
  getTrappedCapitalPaise,
} from '../selectors/ledgerSelectors';
import { useMunimStore } from '../store/useMunimStore';
import type { Product, SupplierReturnItem } from '../types';
import { formatShortDate } from '../utils/dates';
import { formatINR, MASKED_CURRENCY, paiseToRupees, rupeesToPaise } from '../utils/money';
import { ConfirmDialog } from './ConfirmDialog';

export function ActionDrawers() {
  const activeDrawer = useMunimStore((s) => s.activeDrawer);
  const setActiveDrawer = useMunimStore((s) => s.setActiveDrawer);
  const ledger = useMunimStore((s) => s.ledger);
  const language = useMunimStore((s) => s.language);
  const privacyHidden = useMunimStore((s) => s.privacyHidden);

  const applyCounterDiscount = useMunimStore((s) => s.applyCounterDiscount);
  const returnToSupplier = useMunimStore((s) => s.returnToSupplier);
  const markReturnSlipGenerated = useMunimStore((s) => s.markReturnSlipGenerated);
  const clearReturnedItem = useMunimStore((s) => s.clearReturnedItem);
  const poDraft = useMunimStore((s) => s.poDraft);
  const updatePoDraftQty = useMunimStore((s) => s.updatePoDraftQty);
  const removeFromPoDraft = useMunimStore((s) => s.removeFromPoDraft);
  const submitPurchaseOrder = useMunimStore((s) => s.submitPurchaseOrder);
  const pushToast = useMunimStore((s) => s.pushToast);

  const [customDiscounts, setCustomDiscounts] = useState<Record<string, string>>({});
  const [returnTarget, setReturnTarget] = useState<Product | null>(null);
  const [clearReturnTarget, setClearReturnTarget] = useState<SupplierReturnItem | null>(null);
  const [showSlipPreview, setShowSlipPreview] = useState(false);

  const dict = getDictionary(language);
  const deadItems = useMemo(() => getDeadStockItems(ledger.products), [ledger.products]);
  const lowOrOos = useMemo(() => getLowAndOutOfStockItems(ledger.products), [ledger.products]);
  const supSummary = useMemo(() => getSupplierReturnsSummary(ledger), [ledger]);
  const poGroups = useMemo(() => {
    const groups = new Map<
      string,
      { supplierId: string; supplierName: string; items: typeof poDraft; subtotalPaise: number }
    >();
    for (const item of poDraft) {
      const supplier = ledger.suppliers.find((sup) => sup.id === item.supplierId);
      const supplierName = supplier?.name ?? 'Wholesale Supplier';
      const group = groups.get(item.supplierId) ?? {
        supplierId: item.supplierId,
        supplierName,
        items: [],
        subtotalPaise: 0,
      };
      group.items.push(item);
      group.subtotalPaise += item.totalCostPaise;
      groups.set(item.supplierId, group);
    }
    return Array.from(groups.values());
  }, [poDraft, ledger.suppliers]);

  if (!activeDrawer) return null;

  const close = () => {
    setShowSlipPreview(false);
    setActiveDrawer(null);
  };

  const buildReorderMessage = () => {
    const lines = lowOrOos.map((p) => {
      const needQty = Math.max(p.reorderPoint * 2 - p.stockQty, 5);
      return `• ${p.name} (${p.unit}) — Current: ${p.stockQty}, Order: ${needQty}`;
    });
    return `Restock Order — ${APP_CONFIG.STORE_NAME}\n${lines.join('\n')}`;
  };

  const handleCopyReorderList = async () => {
    const text = buildReorderMessage();
    try {
      await navigator.clipboard.writeText(text);
      pushToast({ message: 'Low-stock reorder list copied to clipboard', tone: 'success' });
    } catch {
      pushToast({ message: 'Clipboard unavailable in this browser context', tone: 'warning' });
    }
  };

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(buildReorderMessage())}`;

  const buildPoMessage = () =>
    `Purchase Order — ${APP_CONFIG.STORE_NAME}\n${poGroups
      .map(
        (group) =>
          `${group.supplierName}:\n${group.items
            .map((item) => `• ${item.productName} × ${item.qty}`)
            .join('\n')}`
      )
      .join('\n\n')}`;
  const poWhatsappUrl = `https://wa.me/?text=${encodeURIComponent(buildPoMessage())}`;

  return (
    <>
      <div
        className="fixed inset-0 z-40 flex justify-end bg-slate-900/40 no-print"
        role="dialog"
        aria-modal="true"
        onClick={close}
      >
        <div
          className="flex h-full w-full max-w-2xl flex-col bg-[#FFFDF8] border-l border-[#E5DFD3] shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drawer Header */}
          <div className="flex items-center justify-between gap-3 border-b border-[#E5DFD3] bg-[#FAF7F0] px-6 py-4">
            <h2 className="text-xl font-bold text-[#0F172A]">
              {activeDrawer === 'rescue' && dict.rescueStuckCash}
              {activeDrawer === 'supplier_due' && dict.supplierActionDue}
              {activeDrawer === 'low_stock' && dict.lowStockAction}
              {activeDrawer === 'purchase_order' && 'Purchase Order Draft'}
            </h2>
            <button
              type="button"
              onClick={close}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-[#475569] hover:bg-[#E5DFD3]"
              aria-label="Close drawer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* 1. RESCUE STUCK CASH */}
            {activeDrawer === 'rescue' && (
              <>
                <p className="text-base text-[#475569]">
                  Items unsold for 30+ days, sorted by trapped capital. Apply a counter discount to move them fast at the billing counter, or queue them for supplier return.
                </p>

                {deadItems.length === 0 ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-700" />
                    <p className="mt-2 text-lg font-bold text-emerald-950">
                      Zero dead stock trapped!
                    </p>
                    <p className="mt-1 text-sm text-emerald-800">
                      All shelf items have moved within the last 30 days.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {deadItems.map((product) => {
                      const daysIdle = getDaysWithoutSales(product);
                      const trapped = getTrappedCapitalPaise(product);
                      const effectivePrice = getEffectiveCounterPricePaise(product);
                      const hasDiscount =
                        product.counterPricePaise !== undefined &&
                        product.counterPricePaise < product.sellingPricePaise;
                      const tenOff = Math.round(product.sellingPricePaise * 0.9);
                      const twentyOff = Math.round(product.sellingPricePaise * 0.8);
                      const draftVal =
                        customDiscounts[product.id] ?? String(paiseToRupees(effectivePrice));

                      return (
                        <div
                          key={product.id}
                          className="rounded-xl border border-[#E5DFD3] bg-[#FAF7F0]/70 p-4 space-y-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="text-3xl shrink-0">{product.emoji}</span>
                              <div className="min-w-0">
                                <div className="text-base font-bold text-[#0F172A]">
                                  {getProductDisplayName(product, language)}
                                </div>
                                <div className="text-sm text-[#475569]">
                                  {product.stockQty} units · {daysIdle} days unsold · MRP{' '}
                                  <span className="font-mono">
                                    {formatINR(product.sellingPricePaise)}
                                  </span>
                                  {!privacyHidden && (
                                    <>
                                      {' '}
                                      · Cost{' '}
                                      <span className="font-mono">
                                        {formatINR(product.costPaise)}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-xs font-semibold text-red-800">Trapped</div>
                              <div className="font-mono text-lg font-bold text-red-700 tabular-nums">
                                {privacyHidden
                                  ? MASKED_CURRENCY
                                  : formatINR(trapped, { decimals: false })}
                              </div>
                            </div>
                          </div>

                          {/* Apply Counter Discount controls */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E5DFD3]">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => void applyCounterDiscount(product.id, tenOff)}
                                className="min-h-[40px] rounded-lg border border-[#D6CFC0] bg-white px-2.5 py-1 text-sm font-semibold text-[#0F172A] hover:bg-[#F4EFE4]"
                              >
                                10% off ({formatINR(tenOff)})
                              </button>
                              <button
                                type="button"
                                onClick={() => void applyCounterDiscount(product.id, twentyOff)}
                                className="min-h-[40px] rounded-lg border border-[#D6CFC0] bg-white px-2.5 py-1 text-sm font-semibold text-[#0F172A] hover:bg-[#F4EFE4]"
                              >
                                20% off ({formatINR(twentyOff)})
                              </button>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="1"
                                  aria-label={`Counter price for ${product.name}`}
                                  value={draftVal}
                                  onChange={(e) =>
                                    setCustomDiscounts((d) => ({
                                      ...d,
                                      [product.id]: e.target.value,
                                    }))
                                  }
                                  className="h-[38px] w-20 rounded-lg border border-[#D6CFC0] bg-white px-2 font-mono text-sm tabular-nums"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const val = Number(draftVal);
                                    if (Number.isFinite(val) && val > 0) {
                                      void applyCounterDiscount(product.id, rupeesToPaise(val));
                                    }
                                  }}
                                  className="flex min-h-[40px] items-center gap-1 rounded-lg bg-[#0F172A] px-3 py-1 text-sm font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
                                >
                                  <Tag className="h-3.5 w-3.5" />
                                  <span>{dict.applyCounterDiscount}</span>
                                </button>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setReturnTarget(product)}
                              className="flex min-h-[40px] items-center gap-1 rounded-lg border border-red-300 bg-red-50 px-3 py-1 text-sm font-semibold text-red-800 hover:bg-red-100 whitespace-nowrap"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              <span>{dict.addToReturnList}</span>
                            </button>
                          </div>

                          {hasDiscount && (
                            <div className="flex items-center justify-between text-xs font-semibold text-emerald-800">
                              <span>
                                Active counter price: {formatINR(effectivePrice)} (live on Counter)
                              </span>
                              <button
                                type="button"
                                onClick={() => void applyCounterDiscount(product.id, undefined)}
                                className="underline hover:text-emerald-950"
                              >
                                Clear discount
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* 2. SUPPLIER ACTION DUE */}
            {activeDrawer === 'supplier_due' && (
              <>
                <div className="rounded-xl border border-[#E5DFD3] bg-[#FAF7F0] p-4">
                  <div className="text-sm font-semibold text-[#475569]">
                    Total Pending Supplier Balances
                  </div>
                  <div className="mt-1 font-mono text-2xl font-bold text-[#0F172A] tabular-nums">
                    {privacyHidden
                      ? MASKED_CURRENCY
                      : formatINR(supSummary.totalSupplierPendingPaise)}
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-bold text-[#0F172A] mb-2">
                    Suppliers ({ledger.suppliers.length})
                  </h3>
                  <div className="space-y-2">
                    {ledger.suppliers.map((sup) => (
                      <div
                        key={sup.id}
                        className="flex items-center justify-between rounded-xl border border-[#E5DFD3] bg-white p-3.5"
                      >
                        <div>
                          <div className="font-bold text-[#0F172A]">{sup.name}</div>
                          <div className="text-sm text-[#475569]">
                            {sup.contactName} · {sup.phone}
                            {sup.paymentDueDate && ` · Due ${formatShortDate(sup.paymentDueDate)}`}
                          </div>
                        </div>
                        <div className="font-mono text-base font-bold text-[#0F172A] tabular-nums">
                          {privacyHidden ? MASKED_CURRENCY : formatINR(sup.pendingBalancePaise)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-base font-bold text-[#0F172A]">
                      Supplier Return List ({ledger.supplierReturns.length})
                    </h3>
                    {ledger.supplierReturns.length > 0 && (
                      <button
                        type="button"
                        onClick={async () => {
                          await markReturnSlipGenerated(
                            ledger.supplierReturns.map((r) => r.id)
                          );
                          setShowSlipPreview(true);
                        }}
                        className="flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#0F172A] px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-slate-800"
                      >
                        <Truck className="h-4 w-4" />
                        <span>{dict.generateReturnSlip}</span>
                      </button>
                    )}
                  </div>

                  {ledger.supplierReturns.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[#D6CFC0] p-6 text-center text-sm text-[#475569]">
                      No items queued for return yet. Use “Add to Supplier Return List” on dead or near-expiry items.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {ledger.supplierReturns.map((ret) => (
                        <div
                          key={ret.id}
                          className="flex items-center justify-between rounded-xl border border-[#E5DFD3] bg-white p-3.5"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-2xl">{ret.emoji}</span>
                            <div>
                              <div className="font-semibold text-[#0F172A]">
                                {ret.productName} × {ret.qty}
                              </div>
                              <div className="text-xs text-[#475569]">
                                {ret.supplierName} ·{' '}
                                {ret.slipGenerated ? 'Return slip generated' : 'Pending slip'}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="font-mono font-bold text-emerald-800 tabular-nums">
                              {privacyHidden ? MASKED_CURRENCY : formatINR(ret.totalCostPaise)}
                            </div>
                            {ret.slipGenerated ? (
                              <button
                                type="button"
                                onClick={() => setClearReturnTarget(ret)}
                                className="flex min-h-[40px] items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 whitespace-nowrap"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>Mark as returned</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={async () => {
                                  await markReturnSlipGenerated([ret.id]);
                                  setShowSlipPreview(true);
                                }}
                                className="flex min-h-[40px] items-center gap-1 rounded-lg border border-[#D6CFC0] bg-[#FAF7F0] px-2.5 py-1 text-xs font-semibold text-[#0F172A] hover:bg-[#F4EFE4] whitespace-nowrap"
                              >
                                <Truck className="h-3.5 w-3.5" />
                                <span>{dict.generateReturnSlip}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {showSlipPreview && ledger.supplierReturns.length > 0 && (
                  <div className="rounded-xl border border-emerald-300 bg-emerald-50/40 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-[#0F172A]">
                        Return Slip Ready ({ledger.supplierReturns.length} items)
                      </h4>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#0F172A] px-3 py-1.5 text-sm font-semibold text-white"
                      >
                        <Printer className="h-4 w-4" />
                        <span>Print Slip</span>
                      </button>
                    </div>
                    <p className="text-sm text-[#475569]">
                      Credit Claim Total:{' '}
                      <span className="font-mono font-bold text-[#0F172A]">
                        {privacyHidden
                          ? MASKED_CURRENCY
                          : formatINR(supSummary.totalReturnValuePaise)}
                      </span>
                    </p>
                  </div>
                )}
              </>
            )}

            {/* 3. LOW STOCK REORDER */}
            {activeDrawer === 'low_stock' && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-[#475569]">
                    {lowOrOos.length} low or out-of-stock items ready to share with your distributor.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={lowOrOos.length === 0}
                      onClick={() => void handleCopyReorderList()}
                      className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#D6CFC0] bg-white px-3.5 py-1.5 text-sm font-semibold text-[#0F172A] hover:bg-[#F4EFE4] disabled:opacity-45"
                    >
                      <Copy className="h-4 w-4" />
                      <span>{dict.copyList}</span>
                    </button>
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-[40px] items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800"
                    >
                      <MessageCircle className="h-4 w-4" />
                      <span>{dict.shareWhatsApp}</span>
                    </a>
                  </div>
                </div>

                {lowOrOos.length === 0 ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center text-emerald-950 font-semibold">
                    All tracked items are currently above their reorder point.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {lowOrOos.map((p) => {
                      const suggestedOrder = Math.max(p.reorderPoint * 2 - p.stockQty, 5);
                      return (
                        <div
                          key={p.id}
                          className="flex items-center justify-between rounded-xl border border-[#E5DFD3] bg-white p-3.5"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-2xl">{p.emoji}</span>
                            <div className="min-w-0">
                              <div className="font-semibold text-[#0F172A] truncate">
                                {getProductDisplayName(p, language)}
                              </div>
                              <div className="text-xs text-[#475569]">
                                Current: <span className="font-mono font-bold">{p.stockQty}</span> · Reorder point:{' '}
                                <span className="font-mono">{p.reorderPoint}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span
                              className={`inline-block rounded-md border px-2 py-0.5 text-xs font-semibold ${
                                p.stockQty === 0
                                  ? 'border-red-200 bg-red-50 text-red-800'
                                  : 'border-amber-200 bg-amber-50 text-amber-900'
                              }`}
                            >
                              {p.stockQty === 0 ? dict.outOfStock : dict.lowStock}
                            </span>
                            <div className="mt-1 text-xs font-mono font-semibold text-[#0F172A]">
                              Order: {suggestedOrder}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* 4. PURCHASE ORDER DRAFT */}
            {activeDrawer === 'purchase_order' && (
              <>
                {poDraft.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#D6CFC0] p-8 text-center">
                    <ShoppingCart className="mx-auto h-8 w-8 text-[#475569]" />
                    <p className="mt-2 font-semibold text-[#0F172A]">
                      Purchase Order draft is empty
                    </p>
                    <p className="mt-1 text-sm text-[#475569]">
                      Use “Add to Purchase Order” on Restock recommendations to build an order.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-end">
                      <a
                        href={poWhatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-h-[40px] items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800"
                      >
                        <MessageCircle className="h-4 w-4" />
                        <span>Share PO on WhatsApp</span>
                      </a>
                    </div>

                    {poGroups.map((group) => (
                      <div key={group.supplierId} className="space-y-2">
                        <div className="flex items-center justify-between rounded-lg bg-[#F4EFE4] px-3 py-2">
                          <div className="font-bold text-[#0F172A]">{group.supplierName}</div>
                          <div className="font-mono text-sm font-semibold text-[#0F172A] tabular-nums">
                            {privacyHidden ? MASKED_CURRENCY : formatINR(group.subtotalPaise)}
                          </div>
                        </div>
                        {group.items.map((item) => (
                          <div
                            key={item.productId}
                            className="flex items-center justify-between gap-3 rounded-xl border border-[#E5DFD3] bg-white p-3.5"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="text-2xl">{item.emoji}</span>
                              <div className="min-w-0">
                                <div className="font-semibold text-[#0F172A] truncate">
                                  {item.productName}
                                </div>
                                <div className="text-xs text-[#475569] font-mono">
                                  Unit cost:{' '}
                                  {privacyHidden
                                    ? MASKED_CURRENCY
                                    : formatINR(item.unitCostPaise)}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <input
                                type="number"
                                min="1"
                                value={item.qty}
                                onChange={(e) =>
                                  updatePoDraftQty(
                                    item.productId,
                                    Math.max(1, Math.floor(Number(e.target.value) || 1))
                                  )
                                }
                                className="h-10 w-20 rounded-lg border border-[#D6CFC0] px-2 text-right font-mono text-sm tabular-nums"
                              />
                              <div className="w-24 text-right font-mono font-bold tabular-nums">
                                {privacyHidden
                                  ? MASKED_CURRENCY
                                  : formatINR(item.totalCostPaise)}
                              </div>
                              <button
                                type="button"
                                onClick={() => removeFromPoDraft(item.productId)}
                                className="h-10 w-10 rounded-lg text-[#475569] hover:bg-red-50 hover:text-red-700"
                                aria-label="Remove item from PO"
                              >
                                <X className="h-4 w-4 mx-auto" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}

                    <div className="flex items-center justify-between border-t border-[#E5DFD3] pt-4">
                      <div>
                        <div className="text-sm text-[#475569]">Estimated PO Total</div>
                        <div className="font-mono text-xl font-bold text-[#0F172A] tabular-nums">
                          {privacyHidden
                            ? MASKED_CURRENCY
                            : formatINR(poDraft.reduce((s, i) => s + i.totalCostPaise, 0))}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void submitPurchaseOrder()}
                        className="min-h-[44px] rounded-xl bg-emerald-700 px-5 py-2 text-base font-bold text-white hover:bg-emerald-800"
                      >
                        {dict.confirmOrders.replace('{count}', String(poGroups.length))}
                      </button>
                    </div>
                  </div>
                )}

                {poDraft.length === 0 && (
                  <div className="space-y-2">
                    <button
                      type="button"
                      disabled
                      className="min-h-[44px] w-full rounded-xl bg-emerald-700 px-5 py-2 text-base font-bold text-white opacity-45"
                    >
                      {dict.confirmOrders.replace('{count}', '0')}
                    </button>
                    <p className="text-center text-xs text-[#475569]">
                      Add at least one draft line before confirming.
                    </p>
                  </div>
                )}

                {ledger.purchaseOrders.length > 0 && (
                  <div className="border-t border-[#E5DFD3] pt-4">
                    <h4 className="mb-2 text-sm font-bold text-[#0F172A]">
                      Recent Purchase Orders
                    </h4>
                    <div className="space-y-2">
                      {ledger.purchaseOrders.slice(0, 5).map((po) => (
                        <div
                          key={po.id}
                          className="flex items-center justify-between rounded-lg border border-[#E5DFD3] bg-white px-3 py-2 text-sm"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-[#0F172A]">{po.poNumber}</div>
                            <div className="truncate text-xs text-[#475569]">
                              {po.supplierName ?? 'Supplier'} · {formatShortDate(po.createdAt)}
                            </div>
                          </div>
                          <div className="ml-3 shrink-0 font-mono font-bold text-[#0F172A] tabular-nums">
                            {privacyHidden ? MASKED_CURRENCY : formatINR(po.totalCostPaise)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Printable Supplier Return Slip sheet when previewing */}
      {showSlipPreview && ledger.supplierReturns.length > 0 && (
        <div className="hidden print:block print-only-sheet p-6">
          <h2 className="text-xl font-bold">{APP_CONFIG.STORE_NAME} — Supplier Return Slip</h2>
          <p className="text-sm text-[#475569]">Date: {formatShortDate(new Date().toISOString())}</p>
          <table className="mt-4 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-400">
                <th className="py-2 text-left">Item</th>
                <th className="py-2 text-left">Supplier</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Credit Value</th>
              </tr>
            </thead>
            <tbody>
              {ledger.supplierReturns.map((r) => (
                <tr key={r.id} className="border-b border-slate-200">
                  <td className="py-2">{r.productName}</td>
                  <td className="py-2">{r.supplierName}</td>
                  <td className="py-2 text-right font-mono">{r.qty}</td>
                  <td className="py-2 text-right font-mono">{formatINR(r.totalCostPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(clearReturnTarget)}
        title="Mark supplier return as completed?"
        description={
          clearReturnTarget
            ? `Remove ${clearReturnTarget.qty} × ${clearReturnTarget.productName} from the pending Supplier Return List? Stock and supplier balance were already adjusted when this item was queued.`
            : ''
        }
        confirmLabel="Confirm Returned"
        tone="neutral"
        onCancel={() => setClearReturnTarget(null)}
        onConfirm={() => {
          if (!clearReturnTarget) return;
          const target = clearReturnTarget;
          setClearReturnTarget(null);
          void clearReturnedItem(target.id);
        }}
      />

      <ConfirmDialog
        open={Boolean(returnTarget)}
        title="Move stock to Supplier Return List?"
        description={
          returnTarget
            ? `This will move all ${returnTarget.stockQty} units of ${returnTarget.name} from shelf stock to the Supplier Return List and offset the supplier's pending balance.`
            : ''
        }
        confirmLabel="Confirm Return"
        tone="danger"
        onCancel={() => setReturnTarget(null)}
        onConfirm={() => {
          if (!returnTarget) return;
          const target = returnTarget;
          setReturnTarget(null);
          void returnToSupplier({
            productId: target.id,
            qty: target.stockQty,
            reason: 'dead_stock',
          });
        }}
      />
    </>
  );
}
