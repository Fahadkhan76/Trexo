import { APP_CONFIG } from '../config';
import { createSeedCustomers } from '../data/mockCustomers';
import { createSeedProducts } from '../data/mockProducts';
import { createSeedSales } from '../data/mockSales';
import { createSeedSuppliers } from '../data/mockSuppliers';
import type { LedgerState } from '../types';

export function createInitialLedger(now: Date = new Date()): LedgerState {
  const products = createSeedProducts(now);
  const sales = createSeedSales(now, products);
  const lastSaleByProduct = new Map<string, string>();
  for (const sale of sales) {
    for (const item of sale.items) {
      const prior = lastSaleByProduct.get(item.productId);
      if (!prior || sale.createdAt > prior) lastSaleByProduct.set(item.productId, sale.createdAt);
    }
  }
  return {
    products: products.map((product) => ({
      ...product,
      lastSoldAt: lastSaleByProduct.get(product.id) ?? product.lastSoldAt,
    })),
    sales,
    customers: createSeedCustomers(now),
    suppliers: createSeedSuppliers(now),
    supplierReturns: [],
    purchaseOrders: [],
    parkedBills: [],
    poDraft: [],
    seededAt: now.toISOString(),
  };
}

export function loadLedger(): LedgerState {
  try {
    const raw = window.localStorage.getItem(APP_CONFIG.STORAGE_KEY);
    if (!raw) {
      const seed = createInitialLedger();
      saveLedger(seed);
      return seed;
    }
    const parsed = JSON.parse(raw) as Partial<LedgerState>;
    if (!Array.isArray(parsed.products) || parsed.products.length === 0) {
      const seed = createInitialLedger();
      saveLedger(seed);
      return seed;
    }
    return {
      products: parsed.products ?? [],
      sales: parsed.sales ?? [],
      customers: parsed.customers ?? [],
      suppliers: parsed.suppliers ?? [],
      supplierReturns: parsed.supplierReturns ?? [],
      purchaseOrders: parsed.purchaseOrders ?? [],
      parkedBills: parsed.parkedBills ?? [],
      poDraft: parsed.poDraft ?? [],
      seededAt: parsed.seededAt ?? new Date().toISOString(),
    };
  } catch {
    const seed = createInitialLedger();
    saveLedger(seed);
    return seed;
  }
}

export function saveLedger(state: LedgerState): void {
  try {
    window.localStorage.setItem(APP_CONFIG.STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors in demo mode
  }
}

export function resetLedgerStorage(): LedgerState {
  const seed = createInitialLedger(new Date());
  saveLedger(seed);
  return seed;
}
