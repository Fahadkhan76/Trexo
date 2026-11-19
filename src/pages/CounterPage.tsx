import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Mic,
  MicOff,
  PauseCircle,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { AddCustomerModal } from '../components/AddCustomerModal';
import { CashActionStrip } from '../components/CashActionStrip';
import { CustomItemModal } from '../components/CustomItemModal';
import { HeroStrip } from '../components/HeroStrip';
import { ReceiptModal } from '../components/ReceiptModal';
import { getCategoryLabel, getDictionary, getProductDisplayName } from '../i18n';
import {
  getDeadStockBundleSuggestion,
  getEffectiveCounterPricePaise,
  getProductStatus,
} from '../selectors/ledgerSelectors';
import { useMunimStore } from '../store/useMunimStore';
import type { DiscountType, PaymentMode, Product, ProductCategory } from '../types';
import {
  calculateCartTotals,
  formatINR,
  MASKED_CURRENCY,
  paiseToRupees,
  rupeesToPaise,
  validateCheckout,
} from '../utils/money';

const CATEGORIES: ProductCategory[] = [
  'Staples & Grains',
  'Oils & Ghee',
  'Snacks & Biscuits',
  'Beverages & Dairy',
  'Personal & Home Care',
  'Spices & Masalas',
];

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

export function CounterPage() {
  const products = useMunimStore((s) => s.ledger.products);
  const customers = useMunimStore((s) => s.ledger.customers);
  const language = useMunimStore((s) => s.language);
  const privacyHidden = useMunimStore((s) => s.privacyHidden);

  const cart = useMunimStore((s) => s.cart);
  const overallDiscountType = useMunimStore((s) => s.overallDiscountType);
  const overallDiscountValue = useMunimStore((s) => s.overallDiscountValue);
  const paymentMode = useMunimStore((s) => s.paymentMode);
  const paymentBreakdown = useMunimStore((s) => s.paymentBreakdown);
  const selectedCustomerId = useMunimStore((s) => s.selectedCustomerId);
  const parkedBills = useMunimStore((s) => s.parkedBills);
  const lastCompletedSale = useMunimStore((s) => s.lastCompletedSale);

  const addToCart = useMunimStore((s) => s.addToCart);
  const updateCartQty = useMunimStore((s) => s.updateCartQty);
  const updateCartUnitPrice = useMunimStore((s) => s.updateCartUnitPrice);
  const updateCartItemDiscount = useMunimStore((s) => s.updateCartItemDiscount);
  const removeFromCart = useMunimStore((s) => s.removeFromCart);
  const setOverallDiscount = useMunimStore((s) => s.setOverallDiscount);
  const setPaymentMode = useMunimStore((s) => s.setPaymentMode);
  const setPaymentBreakdown = useMunimStore((s) => s.setPaymentBreakdown);
  const setSelectedCustomerId = useMunimStore((s) => s.setSelectedCustomerId);
  const clearCart = useMunimStore((s) => s.clearCart);
  const parkCurrentBill = useMunimStore((s) => s.parkCurrentBill);
  const resumeParkedBill = useMunimStore((s) => s.resumeParkedBill);
  const deleteParkedBill = useMunimStore((s) => s.deleteParkedBill);
  const completeBill = useMunimStore((s) => s.completeBill);
  const clearLastSale = useMunimStore((s) => s.clearLastSale);
  const recordCustomerPayment = useMunimStore((s) => s.recordCustomerPayment);
  const pushToast = useMunimStore((s) => s.pushToast);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | ProductCategory>('ALL');
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [partialPayRupees, setPartialPayRupees] = useState('');
  const [listening, setListening] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const dict = getDictionary(language);

  const speechSupported = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const win = window as unknown as Record<string, unknown>;
    return Boolean(win.SpeechRecognition || win.webkitSpeechRecognition);
  }, []);

  // Keyboard shortcut: "/" focuses search input
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT';
      if (e.key === '/' && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (selectedCategory !== 'ALL' && p.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.nameHi?.toLowerCase().includes(q) ?? false) ||
        (p.nameKn?.toLowerCase().includes(q) ?? false) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [products, searchQuery, selectedCategory]);

  const cartTotals = useMemo(
    () => calculateCartTotals(cart, overallDiscountType, overallDiscountValue),
    [cart, overallDiscountType, overallDiscountValue]
  );

  const deadBundle = useMemo(() => getDeadStockBundleSuggestion(products), [products]);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId),
    [customers, selectedCustomerId]
  );

  // Keep split breakdown initialized nicely when switching modes or totals
  useEffect(() => {
    setCheckoutError('');
    if (paymentMode === 'cash') {
      setPaymentBreakdown({ cashPaise: cartTotals.totalPaise, upiPaise: 0, creditPaise: 0 });
    } else if (paymentMode === 'upi') {
      setPaymentBreakdown({ cashPaise: 0, upiPaise: cartTotals.totalPaise, creditPaise: 0 });
    } else if (paymentMode === 'credit') {
      setPaymentBreakdown({ cashPaise: 0, upiPaise: 0, creditPaise: cartTotals.totalPaise });
    }
  }, [paymentMode, cartTotals.totalPaise, setPaymentBreakdown]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const q = searchQuery.trim().toLowerCase();
      if (!q) return;
      const exactSku = filteredProducts.find((p) => p.sku.toLowerCase() === q);
      const firstMatch = exactSku ?? filteredProducts.find((p) => p.stockQty > 0) ?? filteredProducts[0];
      if (!firstMatch) return;
      if (firstMatch.stockQty <= 0) {
        pushToast({ message: `${firstMatch.name} is out of stock`, tone: 'warning' });
        return;
      }
      addToCart(firstMatch);
      setSearchQuery('');
    }
  };

  const handleStartVoiceSearch = () => {
    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = win.SpeechRecognition ?? win.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = language === 'hi' ? 'hi-IN' : language === 'kn' ? 'kn-IN' : 'en-IN';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    setListening(true);
    rec.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      setSearchQuery(transcript);
      setListening(false);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
  };

  const handleAddBundle = () => {
    if (!deadBundle) return;
    const { deadProduct, companionProduct, savingsPaise } = deadBundle;
    const deadEffective = getEffectiveCounterPricePaise(deadProduct);
    const discountedDeadPrice = Math.max(deadProduct.costPaise, deadEffective - savingsPaise);
    addToCart(deadProduct, discountedDeadPrice);
    addToCart(companionProduct);
    pushToast({
      message: `Added ${deadProduct.name} + ${companionProduct.name} bundle`,
      tone: 'success',
    });
  };

  const handleCompleteBill = async () => {
    const check = validateCheckout({
      itemCount: cart.length,
      totalPaise: cartTotals.totalPaise,
      paymentMode,
      payment: paymentBreakdown,
      customerId: selectedCustomerId,
    });
    if (!check.valid) {
      setCheckoutError(check.error ?? 'Check payment details');
      return;
    }
    setCheckoutError('');
    try {
      await completeBill();
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Unable to complete bill');
    }
  };

  const handleRecordPartialPayment = async () => {
    if (!selectedCustomer) return;
    const rupees = Number(partialPayRupees);
    if (!Number.isFinite(rupees) || rupees <= 0) return;
    await recordCustomerPayment(selectedCustomer.id, rupeesToPaise(rupees));
    setPartialPayRupees('');
  };

  const splitSumPaise =
    paymentBreakdown.cashPaise + paymentBreakdown.upiPaise + paymentBreakdown.creditPaise;
  const splitRemainingPaise = cartTotals.totalPaise - splitSumPaise;

  return (
    <div className="space-y-4">
      <HeroStrip />
      <CashActionStrip />

      {/* 60% / 40% Counter Split */}
      <div className="grid grid-cols-[3fr_2fr] gap-4 items-start">
        {/* LEFT 60%: Catalog & Search */}
        <section className="min-w-0 space-y-3" aria-label="Product catalog">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#475569]" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder={dict.searchPlaceholder}
                className="w-full min-h-[44px] rounded-xl border border-[#D6CFC0] bg-[#FFFDF8] pl-10 pr-20 text-base text-[#0F172A] placeholder:text-[#475569] focus:border-[#0F172A] focus:outline-none"
              />
              <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[#475569] hover:bg-[#F4EFE4]"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                {speechSupported && (
                  <button
                    type="button"
                    onClick={handleStartVoiceSearch}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      listening
                        ? 'bg-red-100 text-red-700'
                        : 'text-[#475569] hover:bg-[#F4EFE4]'
                    }`}
                    title="Voice search"
                    aria-label="Voice search"
                  >
                    {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </button>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCustomModalOpen(true)}
              className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl border border-[#0F172A] bg-[#FFFDF8] px-3.5 py-2 text-base font-semibold text-[#0F172A] hover:bg-[#F4EFE4] whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              <span>{dict.customItem}</span>
            </button>
          </div>

          {/* Category Filter Bar */}
          <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Categories">
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className={`min-h-[40px] rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors whitespace-nowrap ${
                selectedCategory === 'ALL'
                  ? 'bg-[#0F172A] text-white'
                  : 'border border-[#E5DFD3] bg-[#FFFDF8] text-[#475569] hover:text-[#0F172A]'
              }`}
            >
              {dict.allCategories} ({products.length})
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`min-h-[40px] rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-[#0F172A] text-white'
                    : 'border border-[#E5DFD3] bg-[#FFFDF8] text-[#475569] hover:text-[#0F172A]'
                }`}
              >
                {getCategoryLabel(cat, language)}
              </button>
            ))}
          </div>

          {/* Dead-Stock Bundle Suggestion */}
          {deadBundle && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50/75 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-sm font-bold text-amber-950">
                  <Sparkles className="h-4 w-4 shrink-0 text-amber-700" />
                  <span>Dead-Stock Counter Bundle Idea</span>
                </div>
                <p className="mt-0.5 text-sm text-[#0F172A] truncate">
                  Pair {deadBundle.deadProduct.emoji} {getProductDisplayName(deadBundle.deadProduct, language)} +{' '}
                  {deadBundle.companionProduct.emoji} {getProductDisplayName(deadBundle.companionProduct, language)} at{' '}
                  <span className="font-mono font-bold">
                    {formatINR(deadBundle.bundlePricePaise)}
                  </span>{' '}
                  <span className="text-emerald-800 font-semibold">
                    (Save {formatINR(deadBundle.savingsPaise)})
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddBundle}
                className="min-h-[40px] shrink-0 rounded-lg bg-[#0F172A] px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
              >
                Add Bundle
              </button>
            </div>
          )}

          {/* Product Grid */}
          {filteredProducts.length === 0 ? (
            <div className="khata-surface rounded-xl p-8 text-center">
              <p className="text-base font-semibold text-[#0F172A]">
                No items match “{searchQuery}”
              </p>
              <p className="mt-1 text-sm text-[#475569]">
                Clear your search or add it as a new custom item right away.
              </p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('ALL');
                  }}
                  className="min-h-[40px] rounded-lg border border-[#D6CFC0] bg-white px-4 py-2 text-sm font-semibold text-[#0F172A] hover:bg-[#F4EFE4]"
                >
                  Clear Filters
                </button>
                <button
                  type="button"
                  onClick={() => setCustomModalOpen(true)}
                  className="min-h-[40px] rounded-lg bg-[#0F172A] px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  + Add “{searchQuery || 'Custom Item'}”
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredProducts.map((product: Product) => {
                const status = getProductStatus(product);
                const effectivePrice = getEffectiveCounterPricePaise(product);
                const hasCounterDiscount =
                  product.counterPricePaise !== undefined &&
                  product.counterPricePaise < product.sellingPricePaise;
                const inCartQty =
                  cart.find((c) => c.productId === product.id)?.qty ?? 0;

                const statusStyles =
                  status === 'dead_stock'
                    ? 'text-red-800 bg-red-50 border-red-200'
                    : status === 'out_of_stock'
                      ? 'text-red-800 bg-red-50 border-red-200'
                      : status === 'low_stock' || status === 'near_expiry'
                        ? 'text-amber-900 bg-amber-50 border-amber-200'
                        : 'text-emerald-800 bg-emerald-50 border-emerald-200';

                const statusLabel =
                  status === 'out_of_stock'
                    ? dict.outOfStock
                    : status === 'dead_stock'
                      ? `${dict.deadStock} · ${product.stockQty}`
                      : status === 'low_stock'
                        ? `${dict.lowStock} · ${product.stockQty}`
                        : status === 'near_expiry'
                          ? `${dict.nearExpiry} · ${product.stockQty}`
                          : `${product.stockQty} in stock`;

                return (
                  <button
                    key={product.id}
                    type="button"
                    disabled={product.stockQty <= 0}
                    onClick={() => addToCart(product)}
                    className={`khata-surface relative flex flex-col justify-between rounded-xl p-3.5 text-left transition-colors min-h-[132px] ${
                      product.stockQty <= 0
                        ? 'opacity-65 cursor-not-allowed bg-[#F4EFE4]'
                        : 'hover:border-[#0F172A] hover:bg-white active:scale-[0.99]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-3xl leading-none" aria-hidden="true">
                        {product.emoji}
                      </span>
                      <span
                        className={`rounded-md border px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${statusStyles}`}
                      >
                        {statusLabel}
                      </span>
                    </div>

                    <div className="mt-2.5">
                      <div className="text-base font-semibold leading-snug text-[#0F172A] line-clamp-2">
                        {getProductDisplayName(product, language)}
                      </div>
                      <div className="mt-0.5 text-xs text-[#475569]">
                        {product.sku} · {product.unit}
                      </div>
                    </div>

                    <div className="mt-3 flex items-baseline justify-between gap-2">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-mono text-lg font-bold text-[#0F172A] tabular-nums">
                          {formatINR(effectivePrice)}
                        </span>
                        {hasCounterDiscount && (
                          <span className="font-mono text-xs text-[#475569] line-through tabular-nums">
                            {formatINR(product.sellingPricePaise)}
                          </span>
                        )}
                      </div>
                      {inCartQty > 0 && (
                        <span className="rounded-md bg-[#0F172A] px-2 py-0.5 font-mono text-xs font-bold text-white tabular-nums">
                          ×{inCartQty}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* RIGHT 40%: Cart & Checkout */}
        <aside
          className="khata-surface min-w-0 rounded-xl p-4 space-y-4 sticky top-4"
          aria-label="Active bill cart"
        >
          {/* Cart Header & Park Actions */}
          <div className="flex items-center justify-between gap-2 border-b border-[#E5DFD3] pb-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-[#0F172A]" />
              <h2 className="text-lg font-bold text-[#0F172A]">
                Current Bill ({cart.reduce((s, c) => s + c.qty, 0)})
              </h2>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={cart.length === 0}
                onClick={() => parkCurrentBill()}
                className="flex min-h-[38px] items-center gap-1 rounded-lg border border-[#D6CFC0] bg-white px-2.5 py-1 text-sm font-semibold text-[#0F172A] hover:bg-[#F4EFE4] disabled:opacity-45 whitespace-nowrap"
              >
                <PauseCircle className="h-4 w-4" />
                <span>{dict.parkBill}</span>
              </button>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={clearCart}
                  className="flex min-h-[38px] items-center gap-1 rounded-lg border border-[#D6CFC0] bg-white px-2.5 py-1 text-sm font-semibold text-red-700 hover:bg-red-50 whitespace-nowrap"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>

          {/* Parked Bills Switcher */}
          {parkedBills.length > 0 && (
            <div className="rounded-lg bg-[#F4EFE4] border border-[#E5DFD3] p-2.5">
              <div className="text-xs font-semibold text-[#475569] mb-1.5">
                {dict.parkedBills} ({parkedBills.length}) — click to restore
              </div>
              <div className="flex flex-wrap gap-1.5">
                {parkedBills.map((pb) => {
                  const pbTotal = calculateCartTotals(
                    pb.items,
                    pb.overallDiscountType,
                    pb.overallDiscountValue
                  ).totalPaise;
                  return (
                    <div
                      key={pb.id}
                      className="flex items-center rounded-lg border border-[#D6CFC0] bg-white overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => resumeParkedBill(pb.id)}
                        className="px-2.5 py-1.5 text-xs font-semibold text-[#0F172A] hover:bg-[#FAF7F0] whitespace-nowrap"
                      >
                        {pb.label} · {pb.items.length} items ·{' '}
                        <span className="font-mono">{formatINR(pbTotal)}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteParkedBill(pb.id)}
                        className="px-1.5 py-1.5 text-[#475569] hover:text-red-700 hover:bg-red-50"
                        aria-label={`Remove ${pb.label}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Cart Items */}
          {cart.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#D6CFC0] bg-[#FAF7F0] px-4 py-10 text-center">
              <p className="text-base font-semibold text-[#0F172A]">Bill is empty</p>
              <p className="mt-1 text-sm text-[#475569]">
                Tap a product on the left, or press <kbd className="rounded border px-1.5 py-0.5 font-mono text-xs bg-white">/</kbd> to search and <kbd className="rounded border px-1.5 py-0.5 font-mono text-xs bg-white">Enter</kbd> to add.
              </p>
            </div>
          ) : (
            <div className="max-h-[340px] space-y-2.5 overflow-y-auto pr-1">
              {cart.map((item) => {
                const line = cartTotals.lineResults[item.productId];
                const belowCost = line.unitPriceBelowCost || line.effectiveBelowCost;
                const matchedProd = products.find((p) => p.id === item.productId);
                const itemDisplayName = matchedProd
                  ? getProductDisplayName(matchedProd, language)
                  : item.name;
                const discountInputDisplay =
                  item.discountType === 'percent'
                    ? item.discountValue
                    : paiseToRupees(item.discountValue);

                return (
                  <div
                    key={item.productId}
                    className={`rounded-xl border p-3 ${
                      belowCost
                        ? 'border-red-300 bg-red-50/50'
                        : 'border-[#E5DFD3] bg-[#FAF7F0]/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xl shrink-0">{item.emoji}</span>
                        <div className="min-w-0">
                          <div className="text-base font-semibold text-[#0F172A] truncate">
                            {itemDisplayName}
                          </div>
                          <div className="text-xs text-[#475569]">{item.unit}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.productId)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#475569] hover:bg-red-50 hover:text-red-700"
                        aria-label={`Remove ${item.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                      {/* Qty Stepper */}
                      <div className="flex items-center rounded-lg border border-[#D6CFC0] bg-white">
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.productId, item.qty - 1)}
                          className="h-10 w-10 text-lg font-bold text-[#0F172A] hover:bg-[#F4EFE4]"
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="w-9 text-center font-mono text-base font-bold tabular-nums">
                          {item.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.productId, item.qty + 1)}
                          className="h-10 w-10 text-lg font-bold text-[#0F172A] hover:bg-[#F4EFE4]"
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>

                      {/* Editable Unit Price (₹) */}
                      <label className="flex items-center gap-1 text-xs text-[#475569]">
                        <span>Rate ₹</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={paiseToRupees(item.unitPricePaise)}
                          onChange={(e) =>
                            updateCartUnitPrice(
                              item.productId,
                              rupeesToPaise(Number(e.target.value) || 0)
                            )
                          }
                          className="h-10 w-20 rounded-lg border border-[#D6CFC0] bg-white px-2 text-right font-mono text-sm font-semibold text-[#0F172A] tabular-nums"
                        />
                      </label>

                      {/* Per-Item Discount */}
                      <div className="flex items-center gap-1">
                        <select
                          aria-label="Item discount type"
                          value={item.discountType}
                          onChange={(e) =>
                            updateCartItemDiscount(
                              item.productId,
                              e.target.value as DiscountType,
                              0
                            )
                          }
                          className="h-10 rounded-lg border border-[#D6CFC0] bg-white px-1.5 text-xs font-semibold text-[#0F172A]"
                        >
                          <option value="flat">₹ off</option>
                          <option value="percent">% off</option>
                        </select>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          aria-label="Item discount value"
                          value={discountInputDisplay || ''}
                          placeholder="0"
                          onChange={(e) => {
                            const raw = Number(e.target.value) || 0;
                            updateCartItemDiscount(
                              item.productId,
                              item.discountType,
                              item.discountType === 'percent' ? raw : rupeesToPaise(raw)
                            );
                          }}
                          className="h-10 w-16 rounded-lg border border-[#D6CFC0] bg-white px-2 text-right font-mono text-sm text-[#0F172A] tabular-nums"
                        />
                      </div>

                      {/* Line Total */}
                      <div className="ml-auto font-mono text-base font-bold text-[#0F172A] tabular-nums">
                        {formatINR(line.netTotalPaise)}
                      </div>
                    </div>

                    {belowCost && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-red-700">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>
                          {dict.belowCostWarning}
                          {!privacyHidden && ` (Cost: ${formatINR(item.costPaise)})`}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Overall Discount (Applied AFTER Item Discounts) */}
          <div className="flex items-center justify-between gap-2 border-t border-[#E5DFD3] pt-3">
            <span className="text-sm font-semibold text-[#0F172A]">
              {dict.overallDiscount}
            </span>
            <div className="flex items-center gap-1.5">
              <select
                aria-label="Overall discount type"
                value={overallDiscountType}
                onChange={(e) =>
                  setOverallDiscount(e.target.value as DiscountType, 0)
                }
                className="h-10 rounded-lg border border-[#D6CFC0] bg-white px-2 text-sm font-semibold text-[#0F172A]"
              >
                <option value="flat">Flat ₹</option>
                <option value="percent">Percent %</option>
              </select>
              <input
                type="number"
                min="0"
                step="1"
                aria-label="Overall discount value"
                value={
                  overallDiscountType === 'percent'
                    ? overallDiscountValue || ''
                    : paiseToRupees(overallDiscountValue) || ''
                }
                placeholder="0"
                onChange={(e) => {
                  const raw = Number(e.target.value) || 0;
                  setOverallDiscount(
                    overallDiscountType,
                    overallDiscountType === 'percent' ? raw : rupeesToPaise(raw)
                  );
                }}
                className="h-10 w-24 rounded-lg border border-[#D6CFC0] bg-white px-2.5 text-right font-mono text-base text-[#0F172A] tabular-nums"
              />
            </div>
          </div>

          {/* Bill Totals Summary */}
          <div className="space-y-1.5 rounded-xl bg-[#FAF7F0] border border-[#E5DFD3] p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-[#475569]">{dict.billSubtotal}</span>
              <span className="font-mono tabular-nums">
                {formatINR(cartTotals.grossSubtotalPaise)}
              </span>
            </div>
            {cartTotals.itemDiscountTotalPaise > 0 && (
              <div className="flex justify-between text-emerald-800">
                <span>{dict.itemDiscounts}</span>
                <span className="font-mono tabular-nums">
                  -{formatINR(cartTotals.itemDiscountTotalPaise)}
                </span>
              </div>
            )}
            {cartTotals.overallDiscountPaise > 0 && (
              <div className="flex justify-between text-emerald-800">
                <span>{dict.overallDiscount}</span>
                <span className="font-mono tabular-nums">
                  -{formatINR(cartTotals.overallDiscountPaise)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm text-[#475569]">
              <span>Estimated Bill Profit</span>
              <span className="font-mono font-semibold tabular-nums">
                {privacyHidden ? MASKED_CURRENCY : formatINR(cartTotals.estimatedProfitPaise)}
              </span>
            </div>
            <div className="flex justify-between border-t border-[#E5DFD3] pt-2 text-lg font-bold text-[#0F172A]">
              <span>{dict.grandTotal}</span>
              <span className="font-mono text-2xl tabular-nums">
                {formatINR(cartTotals.totalPaise)}
              </span>
            </div>
          </div>

          {/* Payment Modes */}
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-1.5">
              {(
                [
                  { id: 'cash', label: dict.cash },
                  { id: 'upi', label: dict.upi },
                  { id: 'credit', label: dict.creditUdhaar },
                  { id: 'split', label: dict.split },
                ] as { id: PaymentMode; label: string }[]
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPaymentMode(m.id)}
                  className={`min-h-[42px] rounded-lg border px-2 py-1.5 text-sm font-semibold transition-colors whitespace-nowrap ${
                    paymentMode === m.id
                      ? 'border-[#0F172A] bg-[#0F172A] text-white'
                      : 'border-[#D6CFC0] bg-white text-[#0F172A] hover:bg-[#F4EFE4]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Split Payment Inputs */}
            {paymentMode === 'split' && (
              <div className="rounded-xl border border-[#E5DFD3] bg-[#FAF7F0] p-3 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <label className="text-xs font-semibold text-[#0F172A]">
                    Cash ₹
                    <input
                      type="number"
                      min="0"
                      value={paiseToRupees(paymentBreakdown.cashPaise) || ''}
                      placeholder="0"
                      onChange={(e) =>
                        setPaymentBreakdown({
                          ...paymentBreakdown,
                          cashPaise: rupeesToPaise(Number(e.target.value) || 0),
                        })
                      }
                      className="mt-1 h-10 w-full rounded-lg border border-[#D6CFC0] bg-white px-2 font-mono text-sm tabular-nums"
                    />
                  </label>
                  <label className="text-xs font-semibold text-[#0F172A]">
                    UPI ₹
                    <input
                      type="number"
                      min="0"
                      value={paiseToRupees(paymentBreakdown.upiPaise) || ''}
                      placeholder="0"
                      onChange={(e) =>
                        setPaymentBreakdown({
                          ...paymentBreakdown,
                          upiPaise: rupeesToPaise(Number(e.target.value) || 0),
                        })
                      }
                      className="mt-1 h-10 w-full rounded-lg border border-[#D6CFC0] bg-white px-2 font-mono text-sm tabular-nums"
                    />
                  </label>
                  <label className="text-xs font-semibold text-[#0F172A]">
                    Udhaar ₹
                    <input
                      type="number"
                      min="0"
                      value={paiseToRupees(paymentBreakdown.creditPaise) || ''}
                      placeholder="0"
                      onChange={(e) =>
                        setPaymentBreakdown({
                          ...paymentBreakdown,
                          creditPaise: rupeesToPaise(Number(e.target.value) || 0),
                        })
                      }
                      className="mt-1 h-10 w-full rounded-lg border border-[#D6CFC0] bg-white px-2 font-mono text-sm tabular-nums"
                    />
                  </label>
                </div>
                <div
                  className={`text-xs font-semibold ${
                    splitRemainingPaise === 0 ? 'text-emerald-800' : 'text-amber-800'
                  }`}
                >
                  {splitRemainingPaise === 0
                    ? 'Split matches grand total'
                    : `Remaining to allocate: ${formatINR(splitRemainingPaise)}`}
                </div>
              </div>
            )}

            {/* Customer / Udhaar Ledger Selector */}
            <div className="rounded-xl border border-[#E5DFD3] bg-[#FAF7F0] p-3 space-y-2">
              <div className="flex items-center gap-2">
                <select
                  aria-label={dict.selectCustomer}
                  value={selectedCustomerId ?? ''}
                  onChange={(e) => setSelectedCustomerId(e.target.value || undefined)}
                  className="h-10 flex-1 min-w-0 rounded-lg border border-[#D6CFC0] bg-white px-2.5 text-sm font-medium text-[#0F172A]"
                >
                  <option value="">
                    {paymentMode === 'credit' || (paymentMode === 'split' && paymentBreakdown.creditPaise > 0)
                      ? 'Select customer (Required for Udhaar)...'
                      : 'Walk-in / Optional customer...'}
                  </option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone}) — Udhaar {formatINR(c.udhaarPaise)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setCustomerModalOpen(true)}
                  className="flex h-10 shrink-0 items-center gap-1 rounded-lg border border-[#D6CFC0] bg-white px-2.5 text-sm font-semibold text-[#0F172A] hover:bg-[#F4EFE4] whitespace-nowrap"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>New</span>
                </button>
              </div>

              {selectedCustomer && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#E5DFD3] text-sm">
                  <div>
                    <span className="text-[#475569]">Outstanding Udhaar: </span>
                    <span className="font-mono font-bold text-amber-800 tabular-nums">
                      {formatINR(selectedCustomer.udhaarPaise)}
                    </span>
                  </div>
                  {selectedCustomer.udhaarPaise > 0 && (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        placeholder="Pay ₹"
                        value={partialPayRupees}
                        onChange={(e) => setPartialPayRupees(e.target.value)}
                        className="h-9 w-24 rounded-lg border border-[#D6CFC0] bg-white px-2 font-mono text-sm tabular-nums"
                      />
                      <button
                        type="button"
                        onClick={() => void handleRecordPartialPayment()}
                        className="h-9 rounded-lg bg-emerald-700 px-2.5 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap"
                      >
                        Collect Payment
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {checkoutError && (
            <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
              {checkoutError}
            </div>
          )}

          <button
            type="button"
            disabled={cart.length === 0}
            onClick={() => void handleCompleteBill()}
            className="w-full min-h-[48px] rounded-xl bg-emerald-700 px-4 py-3 text-lg font-bold text-white transition-colors hover:bg-emerald-800 disabled:opacity-45 disabled:cursor-not-allowed"
          >
            {dict.completeBill} · {formatINR(cartTotals.totalPaise)}
          </button>
        </aside>
      </div>

      <CustomItemModal open={customModalOpen} onClose={() => setCustomModalOpen(false)} />
      <AddCustomerModal open={customerModalOpen} onClose={() => setCustomerModalOpen(false)} />
      <ReceiptModal sale={lastCompletedSale} onClose={clearLastSale} />
    </div>
  );
}
