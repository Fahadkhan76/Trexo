import { computeForecastSummary } from '../selectors/ledgerSelectors';
import type {
  Customer,
  ForecastHorizon,
  ForecastSummary,
  LedgerState,
  Product,
  PurchaseOrder,
  PurchaseOrderItem,
  Sale,
  SaleLineItem,
  Supplier,
  SupplierReturnItem,
} from '../types';
import { calculateCartTotals, validateCheckout } from '../utils/money';
import type {
  CreateSaleInput,
  IBillingService,
  ICustomerService,
  IForecastService,
  IInventoryService,
  IProductService,
  IReportsService,
  ISupplierService,
  MunimServices,
  ProductInput,
} from './interfaces';
import { loadLedger, resetLedgerStorage, saveLedger } from './storage';

function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const mockProductService: IProductService = {
  async getAll(): Promise<Product[]> {
    return loadLedger().products;
  },

  async create(input: ProductInput): Promise<Product> {
    const ledger = loadLedger();
    const now = new Date().toISOString();
    const product: Product = {
      id: nextId('prod'),
      sku: input.sku.trim() || `SKU-${Math.floor(500 + Math.random() * 499)}`,
      name: input.name.trim(),
      nameHi: input.nameHi?.trim() || undefined,
      nameKn: input.nameKn?.trim() || undefined,
      category: input.category,
      emoji: input.emoji || '📦',
      unit: input.unit.trim() || '1 unit',
      costPaise: Math.max(0, Math.round(input.costPaise)),
      sellingPricePaise: Math.max(0, Math.round(input.sellingPricePaise)),
      stockQty: Math.max(0, Math.round(input.stockQty)),
      reorderPoint: Math.max(0, Math.round(input.reorderPoint)),
      supplierId: input.supplierId,
      lastSoldAt: now,
      createdAt: now,
      expiryDate: input.expiryDate || undefined,
      fastMover: Boolean(input.fastMover),
      avgDailySales: input.fastMover ? 4 : 1.5,
      isCustom: input.isCustom,
    };
    ledger.products = [product, ...ledger.products];
    saveLedger(ledger);
    return product;
  },

  async update(productId: string, patch: Partial<Product>): Promise<Product> {
    const ledger = loadLedger();
    const index = ledger.products.findIndex((p) => p.id === productId);
    if (index === -1) throw new Error('Product not found');
    const updated = { ...ledger.products[index], ...patch };
    ledger.products[index] = updated;
    saveLedger(ledger);
    return updated;
  },

  async setCounterDiscount(productId: string, discountedPricePaise: number | undefined): Promise<Product> {
    return mockProductService.update(productId, {
      counterPricePaise:
        discountedPricePaise !== undefined ? Math.max(0, Math.round(discountedPricePaise)) : undefined,
    });
  },

  async setStopReordering(productId: string, stopReordering: boolean): Promise<Product> {
    return mockProductService.update(productId, { stopReordering });
  },
};

const mockBillingService: IBillingService = {
  async getSales(): Promise<Sale[]> {
    return loadLedger().sales;
  },

  async completeSale(input: CreateSaleInput): Promise<{ sale: Sale; ledger: LedgerState }> {
    const ledger = loadLedger();
    const nowISO = new Date().toISOString();

    const cartItems = input.items.map((item) => {
      const product = ledger.products.find((p) => p.id === item.productId);
      if (!product) throw new Error(`Product ${item.productId} not found`);
      return {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        emoji: product.emoji,
        unit: product.unit,
        qty: item.qty,
        unitPricePaise: item.unitPricePaise,
        originalPricePaise: product.sellingPricePaise,
        costPaise: product.costPaise,
        discountType: item.discountType,
        discountValue: item.discountValue,
      };
    });

    const totals = calculateCartTotals(
      cartItems,
      input.overallDiscountType,
      input.overallDiscountValue
    );

    const validation = validateCheckout({
      itemCount: cartItems.length,
      totalPaise: totals.totalPaise,
      paymentMode: input.paymentMode,
      payment: input.payment,
      customerId: input.customerId,
    });

    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid checkout payload');
    }

    const customer = input.customerId
      ? ledger.customers.find((c) => c.id === input.customerId)
      : undefined;

    const saleItems: SaleLineItem[] = cartItems.map((ci) => {
      const line = totals.lineResults[ci.productId];
      return {
        productId: ci.productId,
        sku: ci.sku,
        name: ci.name,
        emoji: ci.emoji,
        qty: ci.qty,
        unitPricePaise: ci.unitPricePaise,
        costPaise: ci.costPaise,
        discountType: ci.discountType,
        discountValue: ci.discountValue,
        lineDiscountPaise: line.lineDiscountPaise,
        lineTotalPaise: line.netTotalPaise,
      };
    });

    const billNumber = `INV-${1001 + ledger.sales.length}`;
    const sale: Sale = {
      id: nextId('sale'),
      billNumber,
      createdAt: nowISO,
      items: saleItems,
      grossSubtotalPaise: totals.grossSubtotalPaise,
      itemDiscountTotalPaise: totals.itemDiscountTotalPaise,
      subtotalAfterItemDiscountsPaise: totals.subtotalAfterItemDiscountsPaise,
      overallDiscountType: input.overallDiscountType,
      overallDiscountValue: input.overallDiscountValue,
      overallDiscountPaise: totals.overallDiscountPaise,
      totalPaise: totals.totalPaise,
      totalCostPaise: totals.totalCostPaise,
      paymentMode: input.paymentMode,
      payment: validation.normalizedPayment,
      customerId: customer?.id,
      customerName: customer?.name,
    };

    // Reduce stock and refresh lastSoldAt for sold items (removes from dead stock if sold)
    ledger.products = ledger.products.map((product) => {
      const sold = saleItems.find((si) => si.productId === product.id);
      if (!sold) return product;
      return {
        ...product,
        stockQty: Math.max(0, product.stockQty - sold.qty),
        lastSoldAt: nowISO,
      };
    });

    // Update customer udhaar if credit portion > 0
    if (customer && validation.normalizedPayment.creditPaise > 0) {
      ledger.customers = ledger.customers.map((c) =>
        c.id === customer.id
          ? { ...c, udhaarPaise: c.udhaarPaise + validation.normalizedPayment.creditPaise }
          : c
      );
    }

    ledger.sales = [sale, ...ledger.sales];
    saveLedger(ledger);
    return { sale, ledger };
  },
};

const mockInventoryService: IInventoryService = {
  async adjustStock(productId: string, deltaQty: number): Promise<Product> {
    const ledger = loadLedger();
    const index = ledger.products.findIndex((p) => p.id === productId);
    if (index === -1) throw new Error('Product not found');
    const current = ledger.products[index];
    const updated: Product = {
      ...current,
      stockQty: Math.max(0, current.stockQty + Math.round(deltaQty)),
    };
    ledger.products[index] = updated;
    saveLedger(ledger);
    return updated;
  },

  async returnToSupplier(params: {
    productId: string;
    qty: number;
    reason: SupplierReturnItem['reason'];
  }): Promise<{ returnItem: SupplierReturnItem; ledger: LedgerState }> {
    const ledger = loadLedger();
    const product = ledger.products.find((p) => p.id === params.productId);
    if (!product) throw new Error('Product not found');

    const returnQty = Math.min(product.stockQty, Math.max(1, Math.round(params.qty)));
    const supplier = ledger.suppliers.find((s) => s.id === product.supplierId);
    const totalCostPaise = returnQty * product.costPaise;

    const returnItem: SupplierReturnItem = {
      id: nextId('ret'),
      productId: product.id,
      productName: product.name,
      emoji: product.emoji,
      supplierId: product.supplierId,
      supplierName: supplier?.name ?? 'Wholesale Supplier',
      qty: returnQty,
      unitCostPaise: product.costPaise,
      totalCostPaise,
      reason: params.reason,
      createdAt: new Date().toISOString(),
      slipGenerated: false,
    };

    // Reduce stock on shelf & offset supplier pending balance
    ledger.products = ledger.products.map((p) =>
      p.id === product.id ? { ...p, stockQty: Math.max(0, p.stockQty - returnQty) } : p
    );

    if (supplier) {
      ledger.suppliers = ledger.suppliers.map((s) =>
        s.id === supplier.id
          ? { ...s, pendingBalancePaise: Math.max(0, s.pendingBalancePaise - totalCostPaise) }
          : s
      );
    }

    ledger.supplierReturns = [returnItem, ...ledger.supplierReturns];
    saveLedger(ledger);
    return { returnItem, ledger };
  },
};

const mockSupplierService: ISupplierService = {
  async getAll(): Promise<Supplier[]> {
    return loadLedger().suppliers;
  },

  async getReturnList(): Promise<SupplierReturnItem[]> {
    return loadLedger().supplierReturns;
  },

  async markReturnSlipGenerated(returnIds: string[]): Promise<SupplierReturnItem[]> {
    const ledger = loadLedger();
    const idSet = new Set(returnIds);
    ledger.supplierReturns = ledger.supplierReturns.map((item) =>
      idSet.has(item.id) ? { ...item, slipGenerated: true } : item
    );
    saveLedger(ledger);
    return ledger.supplierReturns;
  },

  async clearReturnedItem(returnId: string): Promise<SupplierReturnItem[]> {
    const ledger = loadLedger();
    ledger.supplierReturns = ledger.supplierReturns.filter((item) => item.id !== returnId);
    saveLedger(ledger);
    return ledger.supplierReturns;
  },
};

const mockCustomerService: ICustomerService = {
  async getAll(): Promise<Customer[]> {
    return loadLedger().customers;
  },

  async create(input: { name: string; phone: string; village?: string; notes?: string }): Promise<Customer> {
    const ledger = loadLedger();
    const customer: Customer = {
      id: nextId('cust'),
      name: input.name.trim(),
      phone: input.phone.trim(),
      village: input.village?.trim() || undefined,
      udhaarPaise: 0,
      notes: input.notes?.trim() || undefined,
    };
    ledger.customers = [customer, ...ledger.customers];
    saveLedger(ledger);
    return customer;
  },

  async recordPartialPayment(customerId: string, amountPaise: number): Promise<Customer> {
    const ledger = loadLedger();
    const index = ledger.customers.findIndex((c) => c.id === customerId);
    if (index === -1) throw new Error('Customer not found');
    const current = ledger.customers[index];
    const paid = Math.max(0, Math.round(amountPaise));
    const updated: Customer = {
      ...current,
      udhaarPaise: Math.max(0, current.udhaarPaise - paid),
      lastPaymentAt: new Date().toISOString(),
    };
    ledger.customers[index] = updated;
    saveLedger(ledger);
    return updated;
  },
};

const mockForecastService: IForecastService = {
  async getForecast(horizon: ForecastHorizon): Promise<ForecastSummary> {
    const ledger = loadLedger();
    return computeForecastSummary(ledger.products, ledger.sales, horizon);
  },

  async getPurchaseOrders(): Promise<PurchaseOrder[]> {
    return loadLedger().purchaseOrders;
  },

  async createPurchaseOrder(items: PurchaseOrderItem[]): Promise<PurchaseOrder> {
    const ledger = loadLedger();
    const po: PurchaseOrder = {
      id: nextId('po'),
      poNumber: `PO-${201 + ledger.purchaseOrders.length}`,
      createdAt: new Date().toISOString(),
      status: 'ordered',
      items,
      totalCostPaise: items.reduce((s, i) => s + i.totalCostPaise, 0),
    };
    ledger.purchaseOrders = [po, ...ledger.purchaseOrders];
    saveLedger(ledger);
    return po;
  },
};

const mockReportsService: IReportsService = {
  async getSalesSummary() {
    const ledger = loadLedger();
    return {
      totalRevenuePaise: ledger.sales.reduce((s, x) => s + x.totalPaise, 0),
      totalProfitPaise: ledger.sales.reduce((s, x) => s + (x.totalPaise - x.totalCostPaise), 0),
      billCount: ledger.sales.length,
      udhaarIssuedPaise: ledger.sales.reduce((s, x) => s + x.payment.creditPaise, 0),
    };
  },

  async resetDemoData(): Promise<LedgerState> {
    return resetLedgerStorage();
  },
};

export const mockServices: MunimServices = {
  products: mockProductService,
  billing: mockBillingService,
  inventory: mockInventoryService,
  suppliers: mockSupplierService,
  customers: mockCustomerService,
  forecast: mockForecastService,
  reports: mockReportsService,
};
