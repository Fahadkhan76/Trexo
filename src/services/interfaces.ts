import type {
  Customer,
  DiscountType,
  ForecastHorizon,
  ForecastSummary,
  LedgerState,
  PaymentBreakdown,
  PaymentMode,
  Product,
  PurchaseOrder,
  PurchaseOrderItem,
  Sale,
  Supplier,
  SupplierReturnItem,
} from '../types';

export interface CreateSaleInput {
  items: {
    productId: string;
    qty: number;
    unitPricePaise: number;
    discountType: DiscountType;
    discountValue: number;
  }[];
  overallDiscountType: DiscountType;
  overallDiscountValue: number;
  paymentMode: PaymentMode;
  payment: PaymentBreakdown;
  customerId?: string;
}

export interface ProductInput {
  sku: string;
  name: string;
  nameHi?: string;
  nameKn?: string;
  category: Product['category'];
  emoji: string;
  unit: string;
  costPaise: number;
  sellingPricePaise: number;
  stockQty: number;
  reorderPoint: number;
  supplierId: string;
  expiryDate?: string;
  fastMover?: boolean;
  isCustom?: boolean;
}

export interface IProductService {
  getAll(): Promise<Product[]>;
  create(input: ProductInput): Promise<Product>;
  update(productId: string, patch: Partial<Product>): Promise<Product>;
  setCounterDiscount(productId: string, discountedPricePaise: number | undefined): Promise<Product>;
  setStopReordering(productId: string, stopReordering: boolean): Promise<Product>;
}

export interface IBillingService {
  getSales(): Promise<Sale[]>;
  completeSale(input: CreateSaleInput): Promise<{ sale: Sale; ledger: LedgerState }>;
}

export interface IInventoryService {
  adjustStock(productId: string, deltaQty: number): Promise<Product>;
  returnToSupplier(params: {
    productId: string;
    qty: number;
    reason: SupplierReturnItem['reason'];
  }): Promise<{ returnItem: SupplierReturnItem; ledger: LedgerState }>;
}

export interface ISupplierService {
  getAll(): Promise<Supplier[]>;
  getReturnList(): Promise<SupplierReturnItem[]>;
  markReturnSlipGenerated(returnIds: string[]): Promise<SupplierReturnItem[]>;
  clearReturnedItem(returnId: string): Promise<SupplierReturnItem[]>;
}

export interface ICustomerService {
  getAll(): Promise<Customer[]>;
  create(input: { name: string; phone: string; village?: string; notes?: string }): Promise<Customer>;
  recordPartialPayment(customerId: string, amountPaise: number): Promise<Customer>;
}

export interface IForecastService {
  getForecast(horizon: ForecastHorizon): Promise<ForecastSummary>;
  getPurchaseOrders(): Promise<PurchaseOrder[]>;
  createPurchaseOrder(items: PurchaseOrderItem[]): Promise<PurchaseOrder>;
}

export interface IReportsService {
  getSalesSummary(): Promise<{
    totalRevenuePaise: number;
    totalProfitPaise: number;
    billCount: number;
    udhaarIssuedPaise: number;
  }>;
  resetDemoData(): Promise<LedgerState>;
}

export interface MunimServices {
  products: IProductService;
  billing: IBillingService;
  inventory: IInventoryService;
  suppliers: ISupplierService;
  customers: ICustomerService;
  forecast: IForecastService;
  reports: IReportsService;
}
