export type Language = 'en' | 'hi' | 'kn';

export type ProductCategory =
  | 'Staples & Grains'
  | 'Oils & Ghee'
  | 'Snacks & Biscuits'
  | 'Beverages & Dairy'
  | 'Personal & Home Care'
  | 'Spices & Masalas';

export type DiscountType = 'flat' | 'percent';

export type PaymentMode = 'cash' | 'upi' | 'credit' | 'split';

export type ForecastHorizon = '1W' | '1M' | '6M' | '1Y';

export type AlertType =
  | 'dead_stock'
  | 'out_of_stock'
  | 'low_stock'
  | 'near_expiry'
  | 'supplier_due';

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface Product {
  id: string;
  sku: string;
  name: string;
  nameHi?: string;
  nameKn?: string;
  category: ProductCategory;
  emoji: string;
  unit: string;
  costPaise: number;
  sellingPricePaise: number;
  counterPricePaise?: number;
  stockQty: number;
  reorderPoint: number;
  supplierId: string;
  lastSoldAt: string;
  createdAt: string;
  expiryDate?: string;
  fastMover?: boolean;
  avgDailySales?: number;
  stopReordering?: boolean;
  isCustom?: boolean;
}

export interface CartItem {
  productId: string;
  sku: string;
  name: string;
  emoji: string;
  unit: string;
  qty: number;
  unitPricePaise: number;
  originalPricePaise: number;
  costPaise: number;
  discountType: DiscountType;
  discountValue: number; // percent (0-100) or paise for flat
}

export interface ParkedBill {
  id: string;
  label: string;
  createdAt: string;
  items: CartItem[];
  overallDiscountType: DiscountType;
  overallDiscountValue: number;
  customerId?: string;
  note?: string;
}

export interface PaymentBreakdown {
  cashPaise: number;
  upiPaise: number;
  creditPaise: number;
}

export interface SaleLineItem {
  productId: string;
  sku: string;
  name: string;
  emoji: string;
  qty: number;
  unitPricePaise: number;
  costPaise: number;
  discountType: DiscountType;
  discountValue: number;
  lineDiscountPaise: number;
  lineTotalPaise: number;
}

export interface Sale {
  id: string;
  billNumber: string;
  createdAt: string;
  items: SaleLineItem[];
  grossSubtotalPaise: number;
  itemDiscountTotalPaise: number;
  subtotalAfterItemDiscountsPaise: number;
  overallDiscountType: DiscountType;
  overallDiscountValue: number;
  overallDiscountPaise: number;
  totalPaise: number;
  totalCostPaise: number;
  paymentMode: PaymentMode;
  payment: PaymentBreakdown;
  customerId?: string;
  customerName?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  village?: string;
  udhaarPaise: number;
  lastPaymentAt?: string;
  notes?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactName: string;
  phone: string;
  pendingBalancePaise: number;
  paymentDueDate?: string;
  categories: ProductCategory[];
}

export interface SupplierReturnItem {
  id: string;
  productId: string;
  productName: string;
  emoji: string;
  supplierId: string;
  supplierName: string;
  qty: number;
  unitCostPaise: number;
  totalCostPaise: number;
  reason: 'dead_stock' | 'near_expiry' | 'damaged';
  createdAt: string;
  slipGenerated: boolean;
}

export interface PurchaseOrderItem {
  productId: string;
  sku: string;
  productName: string;
  emoji: string;
  supplierId: string;
  qty: number;
  unitCostPaise: number;
  totalCostPaise: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  createdAt: string;
  status: 'draft' | 'ordered';
  items: PurchaseOrderItem[];
  totalCostPaise: number;
}

export interface ForecastChartPoint {
  label: string;
  expectedSalesInr: number;
  baselineSalesInr: number;
}

export interface ForecastRecommendation {
  productId: string;
  currentStock: number;
  predictedDemand: number;
  recommendedQty: number;
  estimatedValuePaise: number;
  confidence: 'High' | 'Medium' | 'Low';
  reason: string;
}

export interface ForecastSummary {
  horizon: ForecastHorizon;
  expectedSalesPaise: number;
  recommendedPurchasePaise: number;
  demandGrowthPct: number;
  chartSeries: ForecastChartPoint[];
  recommendations: ForecastRecommendation[];
}

export interface StoreAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  productId?: string;
  supplierId?: string;
  amountPaise?: number;
  daysValue?: number;
}

export interface DeadStockBundle {
  deadProduct: Product;
  companionProduct: Product;
  regularComboPaise: number;
  bundlePricePaise: number;
  savingsPaise: number;
}

export interface LedgerState {
  products: Product[];
  sales: Sale[];
  customers: Customer[];
  suppliers: Supplier[];
  supplierReturns: SupplierReturnItem[];
  purchaseOrders: PurchaseOrder[];
  seededAt: string;
}
