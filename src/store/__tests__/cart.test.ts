// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDeadStockItems } from '../../selectors/ledgerSelectors';
import { services } from '../../services';
import { loadLedger, resetLedgerStorage } from '../../services/storage';
import type { CartItem } from '../../types';
import { useMunimStore } from '../useMunimStore';

function resetStore() {
  window.localStorage.clear();
  const ledger = resetLedgerStorage();
  useMunimStore.setState({
    ledger,
    cart: [],
    overallDiscountType: 'flat',
    overallDiscountValue: 0,
    paymentMode: 'cash',
    paymentBreakdown: { cashPaise: 0, upiPaise: 0, creditPaise: 0 },
    selectedCustomerId: undefined,
    parkedBills: ledger.parkedBills ?? [],
    poDraft: ledger.poDraft ?? [],
    lastCompletedSale: null,
    activeDrawer: null,
  });
}

function cartItemFromProduct(productId: string, qty: number): CartItem {
  const product = useMunimStore.getState().ledger.products.find((p) => p.id === productId);
  if (!product) throw new Error('Missing test product');
  return {
    productId: product.id,
    sku: product.sku,
    name: product.name,
    emoji: product.emoji,
    unit: product.unit,
    qty,
    unitPricePaise: product.sellingPricePaise,
    originalPricePaise: product.sellingPricePaise,
    costPaise: product.costPaise,
    discountType: 'flat',
    discountValue: 0,
  };
}

beforeEach(() => {
  resetStore();
});

describe('Cart stock enforcement', () => {
  it('adds up to stock and rejects one more without changing quantity', () => {
    const product = [...useMunimStore.getState().ledger.products]
      .filter((p) => p.stockQty > 0)
      .sort((a, b) => a.stockQty - b.stockQty)[0];

    for (let i = 0; i < product.stockQty; i += 1) {
      expect(useMunimStore.getState().addToCart(product).ok).toBe(true);
    }

    const result = useMunimStore.getState().addToCart(product);
    expect(result.ok).toBe(false);
    expect(useMunimStore.getState().cart[0].qty).toBe(product.stockQty);
  });

  it('clamps updateCartQty above stock and reports the limit', () => {
    const product = useMunimStore.getState().ledger.products.find((p) => p.stockQty > 0);
    if (!product) throw new Error('No stocked product in seed data');

    useMunimStore.getState().addToCart(product);
    const result = useMunimStore.getState().updateCartQty(product.id, product.stockQty + 5);

    expect(result.ok).toBe(false);
    expect(result.message).toBeTruthy();
    expect(useMunimStore.getState().cart[0].qty).toBe(product.stockQty);
  });

  it('clamps percent discounts above 100 and flat discounts above gross', () => {
    const product = useMunimStore.getState().ledger.products.find((p) => p.stockQty > 0);
    if (!product) throw new Error('No stocked product in seed data');

    useMunimStore.getState().addToCart(product);
    useMunimStore.getState().updateCartItemDiscount(product.id, 'percent', 150);
    expect(useMunimStore.getState().cart[0].discountValue).toBe(100);

    useMunimStore.getState().updateCartItemDiscount(product.id, 'flat', 99999999);
    const item = useMunimStore.getState().cart[0];
    expect(item.discountValue).toBe(item.unitPricePaise * item.qty);
  });

  it('throws on oversell and leaves ledger stock unchanged', async () => {
    const product = useMunimStore.getState().ledger.products.find((p) => p.stockQty > 0);
    if (!product) throw new Error('No stocked product in seed data');

    const stockBefore = loadLedger().products.find((p) => p.id === product.id)?.stockQty;
    useMunimStore.setState({ cart: [cartItemFromProduct(product.id, product.stockQty + 1)] });

    await expect(useMunimStore.getState().completeBill()).rejects.toThrow();
    expect(loadLedger().products.find((p) => p.id === product.id)?.stockQty).toBe(stockBefore);
  });
});

describe('Checkout completion', () => {
  it('decrements stock and records the sale', async () => {
    const product = useMunimStore.getState().ledger.products.find((p) => p.stockQty > 1);
    if (!product) throw new Error('No stocked product in seed data');
    const salesBefore = loadLedger().sales.length;

    useMunimStore.getState().addToCart(product);
    const sale = await useMunimStore.getState().completeBill();

    const after = loadLedger();
    expect(after.products.find((p) => p.id === product.id)?.stockQty).toBe(product.stockQty - 1);
    expect(after.sales).toHaveLength(salesBefore + 1);
    expect(after.sales[0].id).toBe(sale.id);
    expect(sale.items[0].qty).toBe(1);
  });

  it('increases customer udhaar by exactly the split credit amount', async () => {
    const product = useMunimStore.getState().ledger.products.find((p) => p.stockQty > 0);
    const customer = useMunimStore.getState().ledger.customers[0];
    if (!product || !customer) throw new Error('Need seeded product and customer');

    useMunimStore.getState().addToCart(product);
    const totalPaise = useMunimStore.getState().cart[0].unitPricePaise;
    const creditPaise = Math.min(totalPaise, 100);
    const udhaarBefore = customer.udhaarPaise;

    useMunimStore.setState({
      selectedCustomerId: customer.id,
      paymentMode: 'split',
      paymentBreakdown: {
        cashPaise: totalPaise - creditPaise,
        upiPaise: 0,
        creditPaise,
      },
    });
    const sale = await useMunimStore.getState().completeBill();

    const afterCustomer = loadLedger().customers.find((c) => c.id === customer.id);
    expect(sale.payment.creditPaise).toBe(creditPaise);
    expect(afterCustomer?.udhaarPaise).toBe(udhaarBefore + creditPaise);
  });

  it('does not create two sales when completeBill is called twice', async () => {
    const product = useMunimStore.getState().ledger.products.find((p) => p.stockQty > 0);
    if (!product) throw new Error('No stocked product in seed data');
    const salesBefore = loadLedger().sales.length;

    useMunimStore.getState().addToCart(product);
    const results = await Promise.allSettled([
      useMunimStore.getState().completeBill(),
      useMunimStore.getState().completeBill(),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(loadLedger().sales).toHaveLength(salesBefore + 1);
  });
});

describe('Persisted workflow state', () => {
  it('keeps parkedBills and poDraft mirrors equal to ledger after every action', async () => {
    const assertMirrors = () => {
      const state = useMunimStore.getState();
      expect(state.parkedBills).toEqual(state.ledger.parkedBills ?? []);
      expect(state.poDraft).toEqual(state.ledger.poDraft ?? []);
    };
    const products = useMunimStore
      .getState()
      .ledger.products.filter((p) => p.stockQty > 0);
    const [first, second] = products;
    if (!first || !second) throw new Error('Need two stocked products');

    useMunimStore.getState().addToCart(first);
    useMunimStore.getState().parkCurrentBill('Mirror A');
    assertMirrors();

    useMunimStore.getState().addToCart(second);
    useMunimStore.getState().parkCurrentBill('Mirror B');
    assertMirrors();

    const [parkedA, parkedB] = useMunimStore.getState().parkedBills;
    useMunimStore.getState().resumeParkedBill(parkedA.id);
    assertMirrors();
    useMunimStore.getState().deleteParkedBill(parkedB.id);
    assertMirrors();

    useMunimStore.getState().addToPoDraft(first, 2);
    assertMirrors();
    useMunimStore.getState().updatePoDraftQty(first.id, 3);
    assertMirrors();
    useMunimStore.getState().removeFromPoDraft(first.id);
    assertMirrors();
    useMunimStore.getState().addToPoDraft(second, 1);
    await useMunimStore.getState().submitPurchaseOrder();
    assertMirrors();

    await useMunimStore.getState().resetDemoData();
    assertMirrors();
  });

  it('persists parked bills in localStorage', () => {
    const product = useMunimStore.getState().ledger.products.find((p) => p.stockQty > 0);
    if (!product) throw new Error('No stocked product in seed data');

    useMunimStore.getState().addToCart(product);
    useMunimStore.getState().parkCurrentBill('Persistence test');

    const reloaded = loadLedger();
    expect(reloaded.parkedBills).toHaveLength(1);
    expect(reloaded.parkedBills[0].label).toBe('Persistence test');
    expect(reloaded.parkedBills[0].items[0].productId).toBe(product.id);
  });

  it('persists PO drafts, confirms a PO, and clears the draft', async () => {
    const product = useMunimStore.getState().ledger.products.find((p) => p.stockQty > 0);
    if (!product) throw new Error('No stocked product in seed data');

    useMunimStore.getState().addToPoDraft(product, 2);
    expect(loadLedger().poDraft).toHaveLength(1);

    await useMunimStore.getState().submitPurchaseOrder();

    const reloaded = loadLedger();
    expect(reloaded.poDraft).toEqual([]);
    expect(reloaded.purchaseOrders).toHaveLength(1);
    expect(reloaded.purchaseOrders[0].supplierId).toBe(product.supplierId);
    expect(reloaded.purchaseOrders[0].items[0].qty).toBe(2);
    expect(useMunimStore.getState().poDraft).toEqual([]);
  });

  it('does not persist partial purchase orders when one supplier build fails', async () => {
    const stocked = useMunimStore.getState().ledger.products.filter((p) => p.stockQty > 0);
    const first = stocked[0];
    const second = stocked.find((p) => p.supplierId !== first?.supplierId);
    if (!first || !second) throw new Error('Need stocked products from two suppliers');

    useMunimStore.getState().addToPoDraft(first, 1);
    useMunimStore.getState().addToPoDraft(second, 1);
    const before = loadLedger();
    const originalBuild = services.forecast.buildPurchaseOrder;
    const spy = vi
      .spyOn(services.forecast, 'buildPurchaseOrder')
      .mockImplementationOnce((...args) => originalBuild(...args))
      .mockRejectedValueOnce(new Error('supplier build failed'));

    try {
      await expect(useMunimStore.getState().submitPurchaseOrder()).rejects.toThrow(
        'supplier build failed'
      );
    } finally {
      spy.mockRestore();
    }

    const after = loadLedger();
    expect(after.purchaseOrders).toHaveLength(before.purchaseOrders.length);
    expect(after.poDraft).toHaveLength(2);
  });

  it('decrements stock once when returning and never again when clearing', async () => {
    const product = useMunimStore.getState().ledger.products.find((p) => p.stockQty > 0);
    if (!product) throw new Error('No stocked product in seed data');

    const supplierBefore = loadLedger().suppliers.find((s) => s.id === product.supplierId);
    const returned = await useMunimStore.getState().returnToSupplier({
      productId: product.id,
      qty: 1,
      reason: 'damaged',
    });

    const afterReturn = loadLedger();
    const stockAfterReturn = afterReturn.products.find((p) => p.id === product.id)?.stockQty;
    const pendingAfterReturn = afterReturn.suppliers.find((s) => s.id === product.supplierId)
      ?.pendingBalancePaise;
    expect(stockAfterReturn).toBe(product.stockQty - returned.qty);
    expect(pendingAfterReturn).toBe(
      Math.max(0, (supplierBefore?.pendingBalancePaise ?? 0) - returned.totalCostPaise)
    );

    const deadStockAfterReturn = getDeadStockItems(afterReturn.products).map((p) => p.id);
    await useMunimStore.getState().markReturnSlipGenerated([returned.id]);
    expect(loadLedger().supplierReturns.find((r) => r.id === returned.id)?.slipGenerated).toBe(true);

    await useMunimStore.getState().clearReturnedItem(returned.id);

    const afterClear = loadLedger();
    expect(afterClear.supplierReturns).toHaveLength(0);
    expect(afterClear.products.find((p) => p.id === product.id)?.stockQty).toBe(stockAfterReturn);
    expect(afterClear.suppliers.find((s) => s.id === product.supplierId)?.pendingBalancePaise).toBe(
      pendingAfterReturn
    );
    expect(getDeadStockItems(afterClear.products).map((p) => p.id)).toEqual(deadStockAfterReturn);
  });
});
