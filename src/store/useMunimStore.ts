import { create } from 'zustand';
import { getEffectiveCounterPricePaise } from '../selectors/ledgerSelectors';
import { services } from '../services';
import type { CreateSaleInput, ProductInput } from '../services/interfaces';
import { loadLedger } from '../services/storage';
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
  addToCart: (product: Product, customUnitPricePaise?: number) => void;
  updateCartQty: (productId: string, qty: number) => void;
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
  addCustomer: (input: { name: string; phone: string; village?: string; notes?: string }) => Promise<Customer>;
  recordCustomerPayment: (customerId: string, amountPaise: number) => Promise<Customer>;
  addToPoDraft: (product: Product, qty: number) => void;
  updatePoDraftQty: (productId: string, qty: number) => void;
  removeFromPoDraft: (productId: string) => void;
  submitPurchaseOrder: () => Promise<void>;
  resetDemoData: () => Promise<void>;
}

const initialLedger = loadLedger();

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
  parkedBills: [],
  lastCompletedSale: null,

  poDraft: [],

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
    const effectivePrice = customUnitPricePaise ?? getEffectiveCounterPricePaise(product);
    set((state) => {
      const existing = state.cart.find((c) => c.productId === product.id);
      if (existing) {
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
  },

  updateCartQty: (productId, qty) => {
    if (qty <= 0) {
      get().removeFromCart(productId);
      return;
    }
    set((s) => ({
      cart: s.cart.map((c) => (c.productId === productId ? { ...c, qty: Math.round(qty) } : c)),
    }));
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
      cart: s.cart.map((c) =>
        c.productId === productId
          ? { ...c, discountType, discountValue: Math.max(0, discountValue) }
          : c
      ),
    }));
  },

  removeFromCart: (productId) => {
    set((s) => ({ cart: s.cart.filter((c) => c.productId !== productId) }));
  },

  setOverallDiscount: (overallDiscountType, overallDiscountValue) => {
    set({ overallDiscountType, overallDiscountValue: Math.max(0, overallDiscountValue) });
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
    set({
      parkedBills: [parked, ...s.parkedBills],
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

    set({
      parkedBills: nextParked,
      cart: target.items,
      overallDiscountType: target.overallDiscountType,
      overallDiscountValue: target.overallDiscountValue,
      selectedCustomerId: target.customerId,
    });
  },

  deleteParkedBill: (parkedId) => {
    set((s) => ({ parkedBills: s.parkedBills.filter((b) => b.id !== parkedId) }));
  },

  completeBill: async () => {
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
    set((s) => {
      const existing = s.poDraft.find((i) => i.productId === product.id);
      if (existing) {
        const nextQty = existing.qty + safeQty;
        return {
          poDraft: s.poDraft.map((i) =>
            i.productId === product.id
              ? { ...i, qty: nextQty, totalCostPaise: nextQty * i.unitCostPaise }
              : i
          ),
        };
      }
      const next: PurchaseOrderItem = {
        productId: product.id,
        sku: product.sku,
        productName: product.name,
        emoji: product.emoji,
        supplierId: product.supplierId,
        qty: safeQty,
        unitCostPaise: product.costPaise,
        totalCostPaise: safeQty * product.costPaise,
      };
      return { poDraft: [...s.poDraft, next] };
    });
    get().pushToast({ message: `Added ${product.name} (${safeQty}) to Purchase Order`, tone: 'success' });
  },

  updatePoDraftQty: (productId, qty) => {
    if (qty <= 0) {
      get().removeFromPoDraft(productId);
      return;
    }
    set((s) => ({
      poDraft: s.poDraft.map((i) =>
        i.productId === productId
          ? { ...i, qty: Math.round(qty), totalCostPaise: Math.round(qty) * i.unitCostPaise }
          : i
      ),
    }));
  },

  removeFromPoDraft: (productId) => {
    set((s) => ({ poDraft: s.poDraft.filter((i) => i.productId !== productId) }));
  },

  submitPurchaseOrder: async () => {
    const s = get();
    if (s.poDraft.length === 0) return;
    const po = await services.forecast.createPurchaseOrder(s.poDraft);
    set((state) => ({
      ledger: { ...state.ledger, purchaseOrders: [po, ...state.ledger.purchaseOrders] },
      poDraft: [],
      activeDrawer: null,
    }));
    s.pushToast({ message: `Purchase Order ${po.poNumber} saved`, tone: 'success' });
  },

  resetDemoData: async () => {
    const fresh = await services.reports.resetDemoData();
    set({
      ledger: fresh,
      cart: [],
      parkedBills: [],
      poDraft: [],
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
