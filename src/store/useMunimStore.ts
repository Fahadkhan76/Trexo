import { create } from 'zustand';
import { APP_CONFIG } from '../config';
import { getEffectiveCounterPricePaise } from '../selectors/ledgerSelectors';
import { services } from '../services';
import type { CreateSaleInput, ProductInput } from '../services/interfaces';
import { loadLedger, saveLedger } from '../services/storage';
import { calculateCartTotals } from '../utils/money';
import type {
  CartItem,
  Customer,
  DiscountType,
  Language,
  LedgerState,
  ParkedBill,
  PaymentBreakdown,
  PaymentMode,
  Product,
  PurchaseOrder,
  PurchaseOrderItem,
  Sale,
  SupplierReturnItem,
} from '../types';

export interface ToastMessage {
  id: string;
  message: string;
  tone: 'success' | 'warning' | 'error' | 'info';
  undoLabel?: string;
  onUndo?: () => void;
}

export type ActiveDrawer = 'rescue' | 'supplier_due' | 'low_stock' | 'purchase_order' | null;

export interface CartActionResult {
  ok: boolean;
  message?: string;
}

interface MunimStore {
  ledger: LedgerState;
  language: Language;
  privacyHidden: boolean;
  isOnline: boolean;
  activeDrawer: ActiveDrawer;
  toasts: ToastMessage[];

  // Counter & Cart state
  cart: CartItem[];
  overallDiscountType: DiscountType;
  overallDiscountValue: number;
  paymentMode: PaymentMode;
  paymentBreakdown: PaymentBreakdown;
  selectedCustomerId?: string;
  parkedBills: ParkedBill[];
  lastCompletedSale: Sale | null;

  // Trexo Purchase Order draft
  poDraft: PurchaseOrderItem[];

  // Actions
  setLanguage: (lang: Language) => void;
  togglePrivacy: () => void;
  setOnlineStatus: (online: boolean) => void;
  setActiveDrawer: (drawer: ActiveDrawer) => void;
  pushToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
  clearLastSale: () => void;

  // Cart actions
  addToCart: (product: Product, customUnitPricePaise?: number) => CartActionResult;
  updateCartQty: (productId: string, qty: number) => CartActionResult;
  updateCartUnitPrice: (productId: string, unitPricePaise: number) => void;
  updateCartItemDiscount: (productId: string, discountType: DiscountType, discountValue: number) => void;
  removeFromCart: (productId: string) => void;
  setOverallDiscount: (discountType: DiscountType, discountValue: number) => void;
  setPaymentMode: (mode: PaymentMode) => void;
  setPaymentBreakdown: (breakdown: PaymentBreakdown) => void;
  setSelectedCustomerId: (customerId?: string) => void;
  clearCart: () => void;
  parkCurrentBill: (label?: string) => void;
  resumeParkedBill: (parkedId: string) => void;
  deleteParkedBill: (parkedId: string) => void;

  // Ledger-mutating async actions (backed by typed services)
  completeBill: () => Promise<Sale>;
  addProduct: (input: ProductInput) => Promise<Product>;
  updateProduct: (productId: string, patch: Partial<Product>) => Promise<Product>;
  adjustStock: (productId: string, deltaQty: number) => Promise<Product>;
  applyCounterDiscount: (productId: string, discountedPricePaise: number | undefined) => Promise<void>;
  setStopReordering: (productId: string, stop: boolean, withUndoToast?: boolean) => Promise<void>;
  returnToSupplier: (params: {
    productId: string;
    qty: number;
    reason: SupplierReturnItem['reason'];
  }) => Promise<SupplierReturnItem>;
  markReturnSlipGenerated: (returnIds: string[]) => Promise<void>;
  clearReturnedItem: (returnId: string) => Promise<void>;
  addCustomer: (input: { name: string; phone: string; village?: string; notes?: string }) => Promise<Customer>;
  recordCustomerPayment: (customerId: string, amountPaise: number) => Promise<Customer>;
  addToPoDraft: (product: Product, qty: number) => void;
  updatePoDraftQty: (productId: string, qty: number) => void;
  removeFromPoDraft: (productId: string) => void;
  submitPurchaseOrder: () => Promise<void>;
  resetDemoData: () => Promise<void>;
}

const initialLedger = loadLedger();
let completingBill = false;

function stockLimitMessage(name: string, available: number): string {
  return available <= 0 ? `${name} is out of stock` : `Only ${available} of ${name} in stock`;
}

export const useMunimStore = create<MunimStore>((set, get) => ({
  ledger: initialLedger,
  language: 'en',
  privacyHidden: false,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  activeDrawer: null,
  toasts: [],

  cart: [],
  overallDiscountType: 'flat',
  overallDiscountValue: 0,
  paymentMode: 'cash',
  paymentBreakdown: { cashPaise: 0, upiPaise: 0, creditPaise: 0 },
  selectedCustomerId: undefined,
  parkedBills: initialLedger.parkedBills ?? [],
  lastCompletedSale: null,

  poDraft: initialLedger.poDraft ?? [],

  setLanguage: (language) => set({ language }),
  togglePrivacy: () => set((s) => ({ privacyHidden: !s.privacyHidden })),
  setOnlineStatus: (isOnline) => set({ isOnline }),
  setActiveDrawer: (activeDrawer) => set({ activeDrawer }),

  pushToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    window.setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 5000);
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clearLastSale: () => set({ lastCompletedSale: null }),

  addToCart: (product, customUnitPricePaise) => {
    const existing = get().cart.find((c) => c.productId === product.id);
    const available = Math.max(0, Math.round(product.stockQty));
    const nextQty = (existing?.qty ?? 0) + 1;
    if (nextQty > available) {
      return { ok: false, message: stockLimitMessage(product.name, available) };
    }

    const effectivePrice = customUnitPricePaise ?? getEffectiveCounterPricePaise(product);
    set((state) => {
      const current = state.cart.find((c) => c.productId === product.id);
      if (current) {
        return {
          cart: state.cart.map((c) =>
            c.productId === product.id
              ? {
                  ...c,
                  qty: c.qty + 1,
                  unitPricePaise: customUnitPricePaise ?? c.unitPricePaise,
                }
              : c
          ),
        };
      }
      const nextItem: CartItem = {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        emoji: product.emoji,
        unit: product.unit,
        qty: 1,
        unitPricePaise: effectivePrice,
        originalPricePaise: product.sellingPricePaise,
        costPaise: product.costPaise,
        discountType: 'flat',
        discountValue: 0,
      };
      return { cart: [...state.cart, nextItem] };
    });
    return { ok: true };
  },

  updateCartQty: (productId, qty) => {
    if (!Number.isFinite(qty)) return { ok: false };
    if (qty <= 0) {
      get().removeFromCart(productId);
      return { ok: true };
    }

    const wanted = Math.round(qty);
    const product = get().ledger.products.find((p) => p.id === productId);
    if (product) {
      const available = Math.max(0, Math.round(product.stockQty));
      if (wanted > available) {
        set((s) => ({
          cart: s.cart.map((c) => (c.productId === productId ? { ...c, qty: available } : c)),
        }));
        return { ok: false, message: stockLimitMessage(product.name, available) };
      }
    }

    set((s) => ({
      cart: s.cart.map((c) => (c.productId === productId ? { ...c, qty: wanted } : c)),
    }));
    return { ok: true };
  },

  updateCartUnitPrice: (productId, unitPricePaise) => {
    set((s) => ({
      cart: s.cart.map((c) =>
        c.productId === productId
          ? { ...c, unitPricePaise: Math.max(0, Math.round(unitPricePaise)) }
          : c
      ),
    }));
  },

  updateCartItemDiscount: (productId, discountType, discountValue) => {
    set((s) => ({
      cart: s.cart.map((c) => {
        if (c.productId !== productId) return c;
        const safe = Number.isFinite(discountValue) ? Math.max(0, discountValue) : 0;
        const clamped =
          discountType === 'percent'
            ? Math.min(100, safe)
            : Math.min(Math.round(safe), c.unitPricePaise * c.qty);
        return { ...c, discountType, discountValue: clamped };
      }),
    }));
  },

  removeFromCart: (productId) => {
    set((s) => ({ cart: s.cart.filter((c) => c.productId !== productId) }));
  },

  setOverallDiscount: (overallDiscountType, overallDiscountValue) => {
    const safe = Number.isFinite(overallDiscountValue) ? Math.max(0, overallDiscountValue) : 0;
    let clamped = safe;
    if (overallDiscountType === 'percent') {
      clamped = Math.min(100, safe);
    } else {
      const totals = calculateCartTotals(get().cart, 'flat', 0);
      clamped = Math.min(Math.round(safe), totals.subtotalAfterItemDiscountsPaise);
    }
    set({ overallDiscountType, overallDiscountValue: clamped });
  },

  setPaymentMode: (paymentMode) => set({ paymentMode }),
  setPaymentBreakdown: (paymentBreakdown) => set({ paymentBreakdown }),
  setSelectedCustomerId: (selectedCustomerId) => set({ selectedCustomerId }),

  clearCart: () =>
    set({
      cart: [],
      overallDiscountType: 'flat',
      overallDiscountValue: 0,
      paymentMode: 'cash',
      paymentBreakdown: { cashPaise: 0, upiPaise: 0, creditPaise: 0 },
      selectedCustomerId: undefined,
    }),

  parkCurrentBill: (label) => {
    const s = get();
    if (s.cart.length === 0) return;
    const parked: ParkedBill = {
      id: `park-${Date.now()}`,
      label: label || `Bill #${s.parkedBills.length + 1}`,
      createdAt: new Date().toISOString(),
      items: s.cart,
      overallDiscountType: s.overallDiscountType,
      overallDiscountValue: s.overallDiscountValue,
      customerId: s.selectedCustomerId,
    };
    const parkedBills = [parked, ...s.parkedBills];
    const ledger = { ...s.ledger, parkedBills };
    saveLedger(ledger);
    set({
      ledger,
      parkedBills,
      cart: [],
      overallDiscountType: 'flat',
      overallDiscountValue: 0,
      paymentMode: 'cash',
      paymentBreakdown: { cashPaise: 0, upiPaise: 0, creditPaise: 0 },
      selectedCustomerId: undefined,
    });
    s.pushToast({ message: `Parked ${parked.label}`, tone: 'info' });
  },

  resumeParkedBill: (parkedId) => {
    const s = get();
    const target = s.parkedBills.find((b) => b.id === parkedId);
    if (!target) return;

    const nextParked = s.parkedBills.filter((b) => b.id !== parkedId);
    // If current cart has items, park it automatically so nothing is lost
    if (s.cart.length > 0) {
      nextParked.unshift({
        id: `park-${Date.now()}`,
        label: `Held Bill #${nextParked.length + 1}`,
        createdAt: new Date().toISOString(),
        items: s.cart,
        overallDiscountType: s.overallDiscountType,
        overallDiscountValue: s.overallDiscountValue,
        customerId: s.selectedCustomerId,
      });
    }

    const ledger = { ...s.ledger, parkedBills: nextParked };
    saveLedger(ledger);
    set({
      ledger,
      parkedBills: nextParked,
      cart: target.items,
      overallDiscountType: target.overallDiscountType,
      overallDiscountValue: target.overallDiscountValue,
      selectedCustomerId: target.customerId,
    });
  },

  deleteParkedBill: (parkedId) => {
    const s = get();
    const parkedBills = s.parkedBills.filter((b) => b.id !== parkedId);
    const ledger = { ...s.ledger, parkedBills };
    saveLedger(ledger);
    set({ ledger, parkedBills });
  },

  completeBill: async () => {
    if (completingBill) throw new Error('A bill is already being completed.');
    completingBill = true;
    try {
      const s = get();
      const payload: CreateSaleInput = {
        items: s.cart.map((c) => ({
          productId: c.productId,
          qty: c.qty,
          unitPricePaise: c.unitPricePaise,
          discountType: c.discountType,
          discountValue: c.discountValue,
        })),
        overallDiscountType: s.overallDiscountType,
        overallDiscountValue: s.overallDiscountValue,
        paymentMode: s.paymentMode,
        payment: s.paymentBreakdown,
        customerId: s.selectedCustomerId,
      };

      const { sale, ledger } = await services.billing.completeSale(payload);
      set({
        ledger,
        lastCompletedSale: sale,
        cart: [],
        overallDiscountType: 'flat',
        overallDiscountValue: 0,
        paymentMode: 'cash',
        paymentBreakdown: { cashPaise: 0, upiPaise: 0, creditPaise: 0 },
        selectedCustomerId: undefined,
      });
      s.pushToast({ message: `Bill ${sale.billNumber} completed`, tone: 'success' });
      return sale;
    } finally {
      completingBill = false;
    }
  },

  addProduct: async (input) => {
    const product = await services.products.create(input);
    set((s) => ({
      ledger: { ...s.ledger, products: [product, ...s.ledger.products] },
    }));
    get().pushToast({ message: `Added ${product.name}`, tone: 'success' });
    return product;
  },

  updateProduct: async (productId, patch) => {
    const updated = await services.products.update(productId, patch);
    set((s) => ({
      ledger: {
        ...s.ledger,
        products: s.ledger.products.map((p) => (p.id === productId ? updated : p)),
      },
    }));
    get().pushToast({ message: `Updated ${updated.name}`, tone: 'success' });
    return updated;
  },

  adjustStock: async (productId, deltaQty) => {
    const updated = await services.inventory.adjustStock(productId, deltaQty);
    set((s) => ({
      ledger: {
        ...s.ledger,
        products: s.ledger.products.map((p) => (p.id === productId ? updated : p)),
      },
    }));
    return updated;
  },

  applyCounterDiscount: async (productId, discountedPricePaise) => {
    const updated = await services.products.setCounterDiscount(productId, discountedPricePaise);
    set((s) => ({
      ledger: {
        ...s.ledger,
        products: s.ledger.products.map((p) => (p.id === productId ? updated : p)),
      },
    }));
    get().pushToast({
      message:
        discountedPricePaise !== undefined
          ? `Counter discount active for ${updated.name}`
          : `Counter discount cleared for ${updated.name}`,
      tone: 'success',
    });
  },

  setStopReordering: async (productId, stop, withUndoToast = true) => {
    const updated = await services.products.setStopReordering(productId, stop);
    set((s) => ({
      ledger: {
        ...s.ledger,
        products: s.ledger.products.map((p) => (p.id === productId ? updated : p)),
      },
    }));
    if (withUndoToast) {
      get().pushToast({
        message: stop
          ? `Stopped reordering ${updated.name}`
          : `Resumed reordering ${updated.name}`,
        tone: 'info',
        undoLabel: stop ? 'Undo' : undefined,
        onUndo: stop
          ? () => {
              void get().setStopReordering(productId, false, false);
            }
          : undefined,
      });
    }
  },

  returnToSupplier: async (params) => {
    const { returnItem, ledger } = await services.inventory.returnToSupplier(params);
    set({ ledger });
    get().pushToast({
      message: `Added ${returnItem.qty} × ${returnItem.productName} to Supplier Return List`,
      tone: 'success',
    });
    return returnItem;
  },

  markReturnSlipGenerated: async (returnIds) => {
    const updatedReturns = await services.suppliers.markReturnSlipGenerated(returnIds);
    set((s) => ({
      ledger: { ...s.ledger, supplierReturns: updatedReturns },
    }));
    get().pushToast({ message: 'Supplier return slip marked generated', tone: 'success' });
  },

  clearReturnedItem: async (returnId) => {
    const supplierReturns = await services.suppliers.clearReturnedItem(returnId);
    set((s) => ({
      ledger: { ...s.ledger, supplierReturns },
    }));
    get().pushToast({ message: 'Supplier return marked as completed', tone: 'success' });
  },

  addCustomer: async (input) => {
    const customer = await services.customers.create(input);
    set((s) => ({
      ledger: { ...s.ledger, customers: [customer, ...s.ledger.customers] },
      selectedCustomerId: customer.id,
    }));
    get().pushToast({ message: `Added customer ${customer.name}`, tone: 'success' });
    return customer;
  },

  recordCustomerPayment: async (customerId, amountPaise) => {
    const updated = await services.customers.recordPartialPayment(customerId, amountPaise);
    set((s) => ({
      ledger: {
        ...s.ledger,
        customers: s.ledger.customers.map((c) => (c.id === customerId ? updated : c)),
      },
    }));
    get().pushToast({ message: `Updated Udhaar balance for ${updated.name}`, tone: 'success' });
    return updated;
  },

  addToPoDraft: (product, qty) => {
    const safeQty = Math.max(1, Math.round(qty));
    const s = get();
    const existing = s.poDraft.find((i) => i.productId === product.id);
    const poDraft = existing
      ? s.poDraft.map((i) =>
          i.productId === product.id
            ? { ...i, qty: i.qty + safeQty, totalCostPaise: (i.qty + safeQty) * i.unitCostPaise }
            : i
        )
      : [
          ...s.poDraft,
          {
            productId: product.id,
            sku: product.sku,
            productName: product.name,
            emoji: product.emoji,
            supplierId: product.supplierId,
            qty: safeQty,
            unitCostPaise: product.costPaise,
            totalCostPaise: safeQty * product.costPaise,
          },
        ];
    const ledger = { ...s.ledger, poDraft };
    saveLedger(ledger);
    set({ ledger, poDraft });
    s.pushToast({ message: `Added ${product.name} (${safeQty}) to Purchase Order`, tone: 'success' });
  },

  updatePoDraftQty: (productId, qty) => {
    if (!Number.isFinite(qty) || qty <= 0) {
      get().removeFromPoDraft(productId);
      return;
    }
    const s = get();
    const safeQty = Math.max(1, Math.round(qty));
    const poDraft = s.poDraft.map((i) =>
      i.productId === productId
        ? { ...i, qty: safeQty, totalCostPaise: safeQty * i.unitCostPaise }
        : i
    );
    const ledger = { ...s.ledger, poDraft };
    saveLedger(ledger);
    set({ ledger, poDraft });
  },

  removeFromPoDraft: (productId) => {
    const s = get();
    const poDraft = s.poDraft.filter((i) => i.productId !== productId);
    const ledger = { ...s.ledger, poDraft };
    saveLedger(ledger);
    set({ ledger, poDraft });
  },

  submitPurchaseOrder: async () => {
    const s = get();
    if (s.poDraft.length === 0) return;

    const groups = new Map<string, PurchaseOrderItem[]>();
    for (const item of s.poDraft) {
      const existing = groups.get(item.supplierId) ?? [];
      groups.set(item.supplierId, [...existing, item]);
    }

    const created: PurchaseOrder[] = [];
    const groupEntries = Array.from(groups.entries());
    for (let index = 0; index < groupEntries.length; index += 1) {
      const [supplierId, items] = groupEntries[index];
      const supplier = s.ledger.suppliers.find((sup) => sup.id === supplierId);
      const po = await services.forecast.buildPurchaseOrder(
        items,
        supplier ? { id: supplier.id, name: supplier.name } : undefined,
        s.ledger.purchaseOrders.length + index
      );
      created.push(po);
    }

    const ledger = {
      ...s.ledger,
      purchaseOrders: [...created, ...s.ledger.purchaseOrders],
      poDraft: [],
    };
    saveLedger(ledger);
    set({
      ledger,
      poDraft: [],
      activeDrawer: null,
    });
    s.pushToast({
      message:
        created.length === 1
          ? `Purchase Order ${created[0].poNumber} saved`
          : `${created.length} Purchase Orders saved`,
      tone: 'success',
    });
  },

  resetDemoData: async () => {
    const fresh = await services.reports.resetDemoData();
    set({
      ledger: fresh,
      cart: [],
      parkedBills: fresh.parkedBills ?? [],
      poDraft: fresh.poDraft ?? [],
      overallDiscountType: 'flat',
      overallDiscountValue: 0,
      paymentMode: 'cash',
      paymentBreakdown: { cashPaise: 0, upiPaise: 0, creditPaise: 0 },
      selectedCustomerId: undefined,
      lastCompletedSale: null,
      activeDrawer: null,
    });
    get().pushToast({ message: 'Demo data restored to starting scenario', tone: 'info' });
  },
}));

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== APP_CONFIG.STORAGE_KEY) return;
    const ledger = loadLedger();
    useMunimStore.setState({
      ledger,
      parkedBills: ledger.parkedBills ?? [],
      poDraft: ledger.poDraft ?? [],
    });
  });
}
