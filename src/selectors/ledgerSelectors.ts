import { APP_CONFIG } from '../config';
import { FORECAST_HORIZON_CONFIG } from '../data/mockForecasts';
import type {
  DeadStockBundle,
  ForecastChartPoint,
  ForecastHorizon,
  ForecastRecommendation,
  ForecastSummary,
  LedgerState,
  Product,
  Sale,
  StoreAlert,
} from '../types';
import { daysBetween, daysUntil } from '../utils/dates';

export type ProductStockStatus = 'out_of_stock' | 'low_stock' | 'dead_stock' | 'near_expiry' | 'healthy';

export function getDaysWithoutSales(product: Product, now: Date = new Date()): number {
  return Math.max(0, daysBetween(product.lastSoldAt, now));
}

export function isOutOfStock(product: Product): boolean {
  return product.stockQty <= 0;
}

export function isLowStock(product: Product): boolean {
  return product.stockQty > 0 && product.stockQty <= product.reorderPoint;
}

export function isDeadStock(product: Product, now: Date = new Date()): boolean {
  return product.stockQty > 0 && getDaysWithoutSales(product, now) >= APP_CONFIG.DEADSTOCK_DAYS;
}

export function isNearExpiry(product: Product, now: Date = new Date()): boolean {
  if (!product.expiryDate || product.stockQty <= 0) return false;
  const remaining = daysUntil(product.expiryDate, now);
  return remaining <= APP_CONFIG.NEAR_EXPIRY_DAYS;
}

export function getProductStatus(product: Product, now: Date = new Date()): ProductStockStatus {
  if (isOutOfStock(product)) return 'out_of_stock';
  if (isDeadStock(product, now)) return 'dead_stock';
  if (isNearExpiry(product, now)) return 'near_expiry';
  if (isLowStock(product)) return 'low_stock';
  return 'healthy';
}

export function getEffectiveCounterPricePaise(product: Product): number {
  return product.counterPricePaise ?? product.sellingPricePaise;
}

export function getTrappedCapitalPaise(product: Product): number {
  return Math.max(0, product.stockQty) * Math.max(0, product.costPaise);
}

/**
 * Dead stock items sorted by trapped capital (highest first).
 */
export function getDeadStockItems(products: Product[], now: Date = new Date()): Product[] {
  return products
    .filter((p) => isDeadStock(p, now))
    .sort((a, b) => getTrappedCapitalPaise(b) - getTrappedCapitalPaise(a));
}

export function getLowAndOutOfStockItems(products: Product[]): Product[] {
  return products
    .filter((p) => (isOutOfStock(p) || isLowStock(p)) && !p.stopReordering)
    .sort((a, b) => {
      if (a.stockQty === 0 && b.stockQty > 0) return -1;
      if (b.stockQty === 0 && a.stockQty > 0) return 1;
      return (b.avgDailySales ?? 0) - (a.avgDailySales ?? 0);
    });
}

export function getNearExpiryItems(products: Product[], now: Date = new Date()): Product[] {
  return products
    .filter((p) => isNearExpiry(p, now))
    .sort((a, b) => {
      const da = a.expiryDate ? daysUntil(a.expiryDate, now) : Infinity;
      const db = b.expiryDate ? daysUntil(b.expiryDate, now) : Infinity;
      return da - db;
    });
}

/**
 * Hero KPI 1: Sum of (unsold qty * cost price) for all dead stock items.
 */
export function getTotalTrappedCashPaise(products: Product[], now: Date = new Date()): number {
  return getDeadStockItems(products, now).reduce(
    (sum, product) => sum + getTrappedCapitalPaise(product),
    0
  );
}

/**
 * Hero KPI 2: Seeded estimate of sales lost from out-of-stock / low-stock fast movers.
 */
export function getEstimatedLostSalesPaise(products: Product[]): number {
  return products.reduce((sum, product) => {
    if (!product.fastMover && product.stockQty > product.reorderPoint) return sum;
    if (product.stopReordering) return sum;
    const daily = product.avgDailySales ?? 2;
    if (product.stockQty <= 0) {
      return sum + Math.round(APP_CONFIG.LOW_STOCK_PENALTY_DAYS_OOS * daily * product.sellingPricePaise);
    }
    if (product.stockQty <= product.reorderPoint) {
      return sum + Math.round(APP_CONFIG.LOW_STOCK_PENALTY_DAYS_LOW * daily * product.sellingPricePaise);
    }
    return sum;
  }, 0);
}

/**
 * Counter Dead-Stock Bundle Suggestion:
 * Pairs the top dead-stock item (by trapped capital) with a fast-moving healthy staple.
 */
export function getDeadStockBundleSuggestion(
  products: Product[],
  now: Date = new Date()
): DeadStockBundle | null {
  const deadItems = getDeadStockItems(products, now);
  if (deadItems.length === 0) return null;

  const deadProduct = deadItems[0];
  const companionProduct =
    products.find(
      (p) =>
        p.id !== deadProduct.id &&
        p.stockQty > 0 &&
        !isDeadStock(p, now) &&
        p.fastMover
    ) ??
    products.find((p) => p.id !== deadProduct.id && p.stockQty > 0 && !isDeadStock(p, now));

  if (!companionProduct) return null;

  const deadEffective = getEffectiveCounterPricePaise(deadProduct);
  const companionEffective = getEffectiveCounterPricePaise(companionProduct);
  const regularComboPaise = deadEffective + companionEffective;
  // Offer 12% bundle discount on the dead item, never below cost floor if avoidable
  const rawSavings = Math.round(deadEffective * 0.15);
  const savingsPaise = Math.max(1000, Math.round(rawSavings / 100) * 100); // rounded to ₹1
  const bundlePricePaise = Math.max(
    deadProduct.costPaise + companionProduct.costPaise,
    regularComboPaise - savingsPaise
  );

  return {
    deadProduct,
    companionProduct,
    regularComboPaise,
    bundlePricePaise,
    savingsPaise: Math.max(0, regularComboPaise - bundlePricePaise),
  };
}

/**
 * Unified Alert Feed derived strictly from the single ledger state.
 */
export function getUnifiedAlerts(state: LedgerState, now: Date = new Date()): StoreAlert[] {
  const alerts: StoreAlert[] = [];

  for (const product of getDeadStockItems(state.products, now)) {
    const days = getDaysWithoutSales(product, now);
    const trapped = getTrappedCapitalPaise(product);
    alerts.push({
      id: `alert-dead-${product.id}`,
      type: 'dead_stock',
      severity: 'critical',
      title: `${product.name} unsold for ${days} days`,
      description: `${product.stockQty} units sitting idle — rescue trapped cash via discount or supplier return.`,
      productId: product.id,
      amountPaise: trapped,
      daysValue: days,
    });
  }

  for (const product of state.products) {
    if (isOutOfStock(product) && !product.stopReordering) {
      alerts.push({
        id: `alert-oos-${product.id}`,
        type: 'out_of_stock',
        severity: 'critical',
        title: `${product.name} is out of stock`,
        description: product.fastMover
          ? `Fast-moving staple (~${product.avgDailySales ?? 4}/day) is losing counter sales.`
          : `Zero stock remaining on shelf.`,
        productId: product.id,
      });
    } else if (isLowStock(product) && !product.stopReordering) {
      alerts.push({
        id: `alert-low-${product.id}`,
        type: 'low_stock',
        severity: 'warning',
        title: `${product.name} running low (${product.stockQty} left)`,
        description: `Below reorder point of ${product.reorderPoint} units.`,
        productId: product.id,
      });
    }
  }

  for (const product of getNearExpiryItems(state.products, now)) {
    const daysLeft = product.expiryDate ? daysUntil(product.expiryDate, now) : 0;
    alerts.push({
      id: `alert-exp-${product.id}`,
      type: 'near_expiry',
      severity: daysLeft <= 5 ? 'critical' : 'warning',
      title: `${product.name} expires in ${Math.max(0, daysLeft)} days`,
      description: `${product.stockQty} units in stock — prioritize counter push or supplier credit.`,
      productId: product.id,
      daysValue: Math.max(0, daysLeft),
    });
  }

  for (const supplier of state.suppliers) {
    if (supplier.pendingBalancePaise > 0) {
      const daysDue = supplier.paymentDueDate ? daysUntil(supplier.paymentDueDate, now) : 7;
      alerts.push({
        id: `alert-sup-${supplier.id}`,
        type: 'supplier_due',
        severity: daysDue <= 3 ? 'warning' : 'info',
        title: `Supplier balance due: ${supplier.name}`,
        description: daysDue <= 0 ? 'Payment due today' : `Payment due in ${daysDue} days`,
        supplierId: supplier.id,
        amountPaise: supplier.pendingBalancePaise,
        daysValue: daysDue,
      });
    }
  }

  const severityRank = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}

export function getSupplierReturnsSummary(state: LedgerState): {
  totalItemsCount: number;
  totalUnits: number;
  totalReturnValuePaise: number;
  totalSupplierPendingPaise: number;
} {
  const totalItemsCount = state.supplierReturns.length;
  const totalUnits = state.supplierReturns.reduce((s, r) => s + r.qty, 0);
  const totalReturnValuePaise = state.supplierReturns.reduce((s, r) => s + r.totalCostPaise, 0);
  const totalSupplierPendingPaise = state.suppliers.reduce(
    (s, sup) => s + Math.max(0, sup.pendingBalancePaise),
    0
  );
  return {
    totalItemsCount,
    totalUnits,
    totalReturnValuePaise,
    totalSupplierPendingPaise,
  };
}

export function computeForecastSummary(
  products: Product[],
  sales: Sale[],
  horizon: ForecastHorizon,
  now: Date = new Date()
): ForecastSummary {
  const cfg = FORECAST_HORIZON_CONFIG[horizon];
  const growthMultiplier = 1 + cfg.growthPct / 100;

  // Compute baseline daily store sales from active products & recent ledger sales
  const catalogDailyPaise = products.reduce((sum, p) => {
    if (isDeadStock(p, now)) return sum;
    return sum + (p.avgDailySales ?? 1) * p.sellingPricePaise;
  }, 0);
  const recentSalesBoostPaise =
    sales.length > 0 ? Math.round(sales.reduce((s, x) => s + x.totalPaise, 0) / Math.max(3, sales.length)) : 0;
  const effectiveDailyPaise = Math.max(catalogDailyPaise, recentSalesBoostPaise * 2);

  const expectedSalesPaise = Math.round(effectiveDailyPaise * cfg.days * growthMultiplier);

  // Reorder recommendations exclude stopReordering products and dead stock
  const recommendations: ForecastRecommendation[] = products
    .filter((p) => !p.stopReordering && !isDeadStock(p, now))
    .map((p) => {
      const daily = p.avgDailySales ?? 1.5;
      const predictedDemand = Math.max(1, Math.round(daily * cfg.days * growthMultiplier));
      const targetBuffer = Math.round(predictedDemand + p.reorderPoint * 0.5);
      const recommendedQty = Math.max(0, targetBuffer - p.stockQty);
      const estimatedValuePaise = recommendedQty * p.costPaise;

      let confidence: 'High' | 'Medium' | 'Low' = 'Medium';
      if (p.fastMover || daily >= 4) confidence = 'High';
      else if (daily < 1.5) confidence = 'Low';

      let reason = 'Steady daily turnover';
      if (p.stockQty === 0) reason = 'Out of stock fast mover — immediate restock';
      else if (p.stockQty <= p.reorderPoint) reason = 'Below reorder point';
      else if (p.fastMover) reason = 'High-velocity staple';

      return {
        productId: p.id,
        currentStock: p.stockQty,
        predictedDemand,
        recommendedQty,
        estimatedValuePaise,
        confidence,
        reason,
      };
    })
    .filter((rec) => rec.recommendedQty > 0)
    .sort((a, b) => {
      // Out of stock first, then highest estimated value
      if (a.currentStock === 0 && b.currentStock > 0) return -1;
      if (b.currentStock === 0 && a.currentStock > 0) return 1;
      return b.estimatedValuePaise - a.estimatedValuePaise;
    });

  const recommendedPurchasePaise = recommendations.reduce(
    (sum, rec) => sum + rec.estimatedValuePaise,
    0
  );

  const bucketBasePaise = Math.round(effectiveDailyPaise * (cfg.days / cfg.buckets.length));
  const chartSeries: ForecastChartPoint[] = cfg.buckets.map((bucket) => {
    const baselineSalesInr = Math.round(bucketBasePaise / 100);
    const expectedSalesInr = Math.round((bucketBasePaise * bucket.factor * growthMultiplier) / 100);
    return {
      label: bucket.label,
      baselineSalesInr,
      expectedSalesInr,
    };
  });

  return {
    horizon,
    expectedSalesPaise,
    recommendedPurchasePaise,
    demandGrowthPct: cfg.growthPct,
    chartSeries,
    recommendations,
  };
}
