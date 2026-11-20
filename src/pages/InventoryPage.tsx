import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Edit3, Plus, RotateCcw, Search, X } from 'lucide-react';
import { CashActionStrip } from '../components/CashActionStrip';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { HeroStrip } from '../components/HeroStrip';
import { ProductFormModal } from '../components/ProductFormModal';
import { getCategoryLabel, getDictionary, getProductDisplayName } from '../i18n';
import {
  getDaysWithoutSales,
  getEffectiveCounterPricePaise,
  getProductStatus,
  getTrappedCapitalPaise,
  isDeadStock,
  isLowStock,
  isOutOfStock,
} from '../selectors/ledgerSelectors';
import { useMunimStore } from '../store/useMunimStore';
import type { Product, ProductCategory, SupplierReturnItem } from '../types';
import { formatShortDate } from '../utils/dates';
import { formatINR, MASKED_CURRENCY, paiseToRupees, rupeesToPaise } from '../utils/money';

type InventoryTab = 'all' | 'low_stock' | 'out_of_stock' | 'dead_stock';
type SortOption = 'trapped_desc' | 'name_asc' | 'stock_asc' | 'price_desc' | 'expiry_asc';

const CATEGORIES: ProductCategory[] = [
  'Staples & Grains',
  'Oils & Ghee',
  'Snacks & Biscuits',
  'Beverages & Dairy',
  'Personal & Home Care',
  'Spices & Masalas',
];

export function InventoryPage() {
  const products = useMunimStore((s) => s.ledger.products);
  const supplierReturns = useMunimStore((s) => s.ledger.supplierReturns);
  const language = useMunimStore((s) => s.language);
  const privacyHidden = useMunimStore((s) => s.privacyHidden);
  const adjustStock = useMunimStore((s) => s.adjustStock);
  const updateProduct = useMunimStore((s) => s.updateProduct);
  const returnToSupplier = useMunimStore((s) => s.returnToSupplier);
  const markReturnSlipGenerated = useMunimStore((s) => s.markReturnSlipGenerated);
  const clearReturnedItem = useMunimStore((s) => s.clearReturnedItem);

  const [activeTab, setActiveTab] = useState<InventoryTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | ProductCategory>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('name_asc');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState('');
  const [returnTarget, setReturnTarget] = useState<Product | null>(null);
  const [clearReturnTarget, setClearReturnTarget] = useState<SupplierReturnItem | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const dict = getDictionary(language);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT';
      if (e.key === '/' && !isInput) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const counts = useMemo(
    () => ({
      all: products.length,
      low: products.filter((p) => isLowStock(p)).length,
      oos: products.filter((p) => isOutOfStock(p)).length,
      dead: products.filter((p) => isDeadStock(p)).length,
    }),
    [products]
  );

  const displayedProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = products.filter((p) => {
      if (activeTab === 'low_stock' && !isLowStock(p)) return false;
      if (activeTab === 'out_of_stock' && !isOutOfStock(p)) return false;
      if (activeTab === 'dead_stock' && !isDeadStock(p)) return false;
      if (categoryFilter !== 'ALL' && p.category !== categoryFilter) return false;
      if (q) {
        const hit =
          p.name.toLowerCase().includes(q) ||
          (p.nameHi?.toLowerCase().includes(q) ?? false) ||
          (p.nameKn?.toLowerCase().includes(q) ?? false) ||
          p.sku.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });

    // Dead Stock tab ALWAYS prioritizes trapped capital highest first unless explicitly sorted otherwise
    const effectiveSort: SortOption = activeTab === 'dead_stock' ? 'trapped_desc' : sortBy;

    return [...list].sort((a, b) => {
      if (effectiveSort === 'trapped_desc') {
        return getTrappedCapitalPaise(b) - getTrappedCapitalPaise(a);
      }
      if (effectiveSort === 'stock_asc') {
        return a.stockQty - b.stockQty;
      }
      if (effectiveSort === 'price_desc') {
        return getEffectiveCounterPricePaise(b) - getEffectiveCounterPricePaise(a);
      }
      if (effectiveSort === 'expiry_asc') {
        const ta = a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity;
        const tb = b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity;
        return ta - tb;
      }
      return a.name.localeCompare(b.name);
    });
  }, [products, activeTab, categoryFilter, searchQuery, sortBy]);

  const handleSaveInlinePrice = async (product: Product) => {
    const num = Number(priceDraft);
    if (Number.isFinite(num) && num > 0) {
      await updateProduct(product.id, { sellingPricePaise: rupeesToPaise(num) });
    }
    setEditingPriceId(null);
  };

  return (
    <div className="space-y-4">
      <HeroStrip />
      <CashActionStrip />

      {/* Inventory Controls */}
      <section className="khata-surface rounded-xl p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5" role="tablist">
            {(
              [
                { id: 'all', label: `All (${counts.all})` },
                { id: 'low_stock', label: `${dict.lowStock} (${counts.low})` },
                { id: 'out_of_stock', label: `${dict.outOfStock} (${counts.oos})` },
                { id: 'dead_stock', label: `${dict.deadStock} (${counts.dead})` },
              ] as { id: InventoryTab; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-[40px] rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-[#0F172A] text-white'
                    : 'border border-[#E5DFD3] bg-[#FAF7F0] text-[#475569] hover:text-[#0F172A]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setEditingProduct(null);
              setModalOpen(true);
            }}
            className="flex min-h-[42px] items-center gap-1.5 rounded-xl bg-[#0F172A] px-4 py-2 text-base font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>Add Product</span>
          </button>
        </div>

        {/* Search, Category Filter, Sort */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto]">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#475569]" />
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search inventory by name or SKU..."
              className="w-full min-h-[42px] rounded-lg border border-[#D6CFC0] bg-white pl-9 pr-9 text-base text-[#0F172A]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#475569]"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <select
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as 'ALL' | ProductCategory)}
            className="min-h-[42px] rounded-lg border border-[#D6CFC0] bg-white px-3 text-sm font-semibold text-[#0F172A]"
          >
            <option value="ALL">All Categories</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {getCategoryLabel(cat, language)}
              </option>
            ))}
          </select>

          <select
            aria-label="Sort products"
            value={activeTab === 'dead_stock' ? 'trapped_desc' : sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            disabled={activeTab === 'dead_stock'}
            className="min-h-[42px] rounded-lg border border-[#D6CFC0] bg-white px-3 text-sm font-semibold text-[#0F172A] disabled:opacity-70"
          >
            <option value="name_asc">Sort: Name (A–Z)</option>
            <option value="trapped_desc">Sort: Trapped / Value (High–Low)</option>
            <option value="stock_asc">Sort: Stock (Low–High)</option>
            <option value="price_desc">Sort: Selling Price (High–Low)</option>
            <option value="expiry_asc">Sort: Earliest Expiry</option>
          </select>
        </div>

        {/* Inventory Table */}
        {displayedProducts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#D6CFC0] bg-[#FAF7F0] p-8 text-center">
            <p className="text-base font-semibold text-[#0F172A]">
              No products in this view
            </p>
            <p className="mt-1 text-sm text-[#475569]">
              Try switching tabs or clearing your search filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#E5DFD3] text-[#475569]">
                  <th className="py-2.5 pr-2 font-semibold">Product</th>
                  <th className="hidden xl:table-cell py-2.5 px-2 font-semibold">Category</th>
                  <th className="py-2.5 px-2 font-semibold text-center">Stock</th>
                  <th className="py-2.5 px-2 font-semibold text-right">Cost</th>
                  <th className="py-2.5 px-2 font-semibold text-right">Sell Price</th>
                  <th className="py-2.5 px-2 font-semibold text-right">Stock Value</th>
                  <th className="py-2.5 px-2 font-semibold">Status</th>
                  <th className="hidden xl:table-cell py-2.5 px-2 font-semibold">Expiry</th>
                  <th className="py-2.5 pl-2 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedProducts.map((product) => {
                  const status = getProductStatus(product);
                  const stockValuePaise = getTrappedCapitalPaise(product);
                  const effectiveSell = getEffectiveCounterPricePaise(product);
                  const daysIdle = getDaysWithoutSales(product);

                  const statusBadgeClass =
                    status === 'dead_stock' || status === 'out_of_stock'
                      ? 'border-red-200 bg-red-50 text-red-800'
                      : status === 'low_stock' || status === 'near_expiry'
                        ? 'border-amber-200 bg-amber-50 text-amber-900'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-800';

                  const statusText =
                    status === 'dead_stock'
                      ? `${dict.deadStock} (${daysIdle}d)`
                      : status === 'out_of_stock'
                        ? dict.outOfStock
                        : status === 'low_stock'
                          ? dict.lowStock
                          : status === 'near_expiry'
                            ? dict.nearExpiry
                            : dict.healthy;

                  return (
                    <tr
                      key={product.id}
                      className="border-b border-[#E5DFD3] hover:bg-[#FAF7F0]/80"
                    >
                      <td className="py-2.5 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl leading-none">{product.emoji}</span>
                          <div className="min-w-0">
                            <div className="font-semibold text-[#0F172A]">
                              {getProductDisplayName(product, language)}
                            </div>
                            <div className="text-xs text-[#475569] font-mono">
                              {product.sku} · {product.unit}
                              <span className="xl:hidden"> · {getCategoryLabel(product.category, language)}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="hidden xl:table-cell py-2.5 px-2 text-[#475569] whitespace-nowrap">
                        {getCategoryLabel(product.category, language)}
                      </td>

                      <td className="py-2.5 px-1.5">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => void adjustStock(product.id, -1)}
                            disabled={product.stockQty <= 0}
                            className="h-10 w-10 rounded-lg border border-[#D6CFC0] bg-white font-bold hover:bg-[#F4EFE4] disabled:opacity-40"
                            aria-label={`Decrease stock of ${product.name}`}
                          >
                            −
                          </button>
                          <span className="w-8 text-center font-mono text-base font-bold tabular-nums">
                            {product.stockQty}
                          </span>
                          <button
                            type="button"
                            onClick={() => void adjustStock(product.id, 1)}
                            className="h-10 w-10 rounded-lg border border-[#D6CFC0] bg-white font-bold hover:bg-[#F4EFE4]"
                            aria-label={`Increase stock of ${product.name}`}
                          >
                            +
                          </button>
                        </div>
                      </td>

                      <td className="py-2.5 px-1.5 text-right font-mono tabular-nums text-[#475569] whitespace-nowrap">
                        {privacyHidden ? MASKED_CURRENCY : formatINR(product.costPaise)}
                      </td>

                      <td className="py-2.5 px-1.5 text-right font-mono tabular-nums whitespace-nowrap">
                        {editingPriceId === product.id ? (
                          <div className="inline-flex items-center gap-1">
                            <input
                              type="number"
                              min="1"
                              value={priceDraft}
                              onChange={(e) => setPriceDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') void handleSaveInlinePrice(product);
                                if (e.key === 'Escape') setEditingPriceId(null);
                              }}
                              className="h-10 w-20 rounded-lg border border-[#0F172A] bg-white px-2 text-right font-mono text-sm"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => void handleSaveInlinePrice(product)}
                              className="h-10 rounded-lg bg-[#0F172A] px-2 text-xs font-semibold text-white"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPriceId(product.id);
                              setPriceDraft(String(paiseToRupees(product.sellingPricePaise)));
                            }}
                            className="inline-flex min-h-10 items-center font-semibold text-[#0F172A] hover:underline"
                            title="Click to edit selling price"
                          >
                            {formatINR(effectiveSell)}
                            {product.counterPricePaise !== undefined &&
                              product.counterPricePaise < product.sellingPricePaise && (
                                <span className="ml-1 text-xs text-emerald-800">(Disc)</span>
                              )}
                          </button>
                        )}
                      </td>

                      <td className="py-2.5 px-1.5 text-right font-mono font-semibold tabular-nums whitespace-nowrap">
                        {privacyHidden ? MASKED_CURRENCY : formatINR(stockValuePaise)}
                      </td>

                      <td className="py-2.5 px-1.5 whitespace-nowrap">
                        <span
                          className={`inline-block rounded-md border px-2 py-0.5 text-xs font-semibold ${statusBadgeClass}`}
                        >
                          {statusText}
                        </span>
                        {product.expiryDate && (
                          <div className="xl:hidden mt-0.5 text-xs text-[#475569]">
                            Exp {formatShortDate(product.expiryDate)}
                          </div>
                        )}
                      </td>

                      <td className="hidden xl:table-cell py-2.5 px-2 text-[#475569] whitespace-nowrap">
                        {product.expiryDate ? formatShortDate(product.expiryDate) : '—'}
                      </td>

                      <td className="py-2.5 pl-1.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingProduct(product);
                              setModalOpen(true);
                            }}
                            className="inline-flex h-10 items-center gap-1 rounded-lg border border-[#D6CFC0] bg-white px-2.5 text-xs font-semibold text-[#0F172A] hover:bg-[#F4EFE4]"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            <span>Edit</span>
                          </button>
                          {product.stockQty > 0 && (
                            <button
                              type="button"
                              onClick={() => setReturnTarget(product)}
                              className="inline-flex h-10 items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 text-xs font-semibold text-red-800 hover:bg-red-100"
                              title="Return stock to supplier"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              <span>Return</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {supplierReturns.length > 0 && (
        <section className="khata-surface rounded-xl p-4 space-y-3">
          <div>
            <h2 className="text-lg font-bold text-[#0F172A]">
              Supplier Returns ({supplierReturns.length})
            </h2>
            <p className="text-sm text-[#475569]">
              Pending → slip generated → returned. Marking as returned removes it from this list.
            </p>
          </div>
          <div className="space-y-2">
            {supplierReturns.map((ret) => (
              <div
                key={ret.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E5DFD3] bg-white p-3.5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-2xl">{ret.emoji}</span>
                  <div className="min-w-0">
                    <div className="font-semibold text-[#0F172A]">
                      {ret.productName} × {ret.qty}
                    </div>
                    <div className="text-xs text-[#475569]">
                      {ret.supplierName} ·{' '}
                      {ret.slipGenerated ? 'Slip generated' : 'Pending slip'} ·{' '}
                      {formatShortDate(ret.createdAt)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-emerald-800 tabular-nums">
                    {privacyHidden ? MASKED_CURRENCY : formatINR(ret.totalCostPaise)}
                  </span>
                  {ret.slipGenerated ? (
                    <button
                      type="button"
                      onClick={() => setClearReturnTarget(ret)}
                      className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 whitespace-nowrap"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Mark as returned</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void markReturnSlipGenerated([ret.id])}
                      className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#D6CFC0] bg-[#FAF7F0] px-3 py-1.5 text-sm font-semibold text-[#0F172A] hover:bg-[#F4EFE4] whitespace-nowrap"
                    >
                      <RotateCcw className="h-4 w-4" />
                      <span>{dict.generateReturnSlip}</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <ProductFormModal
        open={modalOpen}
        editingProduct={editingProduct}
        onClose={() => setModalOpen(false)}
      />

      <ConfirmDialog
        open={Boolean(clearReturnTarget)}
        title="Mark supplier return as completed?"
        description={
          clearReturnTarget
            ? `Remove ${clearReturnTarget.qty} × ${clearReturnTarget.productName} from the pending Supplier Return List? Stock and supplier balance were already adjusted when it was queued.`
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
        title="Return stock to supplier?"
        description={
          returnTarget
            ? `Queue all ${returnTarget.stockQty} units of ${returnTarget.name} for supplier return? Shelf stock will reduce to 0 and Supplier Action Due will update immediately.`
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
            reason: isDeadStock(t) ? 'dead_stock' : 'near_expiry',
          });
        }}
      />
    </div>
  );
}
