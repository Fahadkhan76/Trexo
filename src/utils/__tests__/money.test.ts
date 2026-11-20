import { describe, expect, it } from 'vitest';
import type { CartItem } from '../../types';
import {
  calculateCartTotals,
  calculateLineTotals,
  formatINR,
  rupeesToPaise,
  validateCheckout,
} from '../money';

function makeCartItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    productId: 'p-1',
    sku: 'SKU-1',
    name: 'Test Item',
    emoji: '📦',
    unit: '1 kg',
    qty: 2,
    unitPricePaise: 10000, // ₹100
    originalPricePaise: 10000,
    costPaise: 8000, // ₹80
    discountType: 'flat',
    discountValue: 0,
    ...overrides,
  };
}

describe('Integer Paise & Cart Math Utility', () => {
  it('converts rupees to integer paise cleanly without float drift', () => {
    expect(rupeesToPaise(19.99)).toBe(1999);
    expect(rupeesToPaise(100.1)).toBe(10010);
    expect(formatINR(125000)).toBe('₹1,250');
  });

  it('applies per-item discount FIRST, then overall bill discount', () => {
    const itemA = makeCartItem({
      productId: 'a',
      qty: 2,
      unitPricePaise: 10000, // gross ₹200
      discountType: 'percent',
      discountValue: 10, // 10% off = ₹20 -> net ₹180
    });
    const itemB = makeCartItem({
      productId: 'b',
      qty: 1,
      unitPricePaise: 12000, // gross ₹120
      discountType: 'flat',
      discountValue: 2000, // ₹20 off -> net ₹100
    });

    // After item discounts: 18000 + 10000 = 28000 (₹280)
    // Overall 10% discount applies to 28000 -> ₹28 off -> ₹252 (25200 paise)
    const totals = calculateCartTotals([itemA, itemB], 'percent', 10);
    expect(totals.grossSubtotalPaise).toBe(32000);
    expect(totals.itemDiscountTotalPaise).toBe(4000);
    expect(totals.subtotalAfterItemDiscountsPaise).toBe(28000);
    expect(totals.overallDiscountPaise).toBe(2800);
    expect(totals.totalPaise).toBe(25200);
  });

  it('applies overall flat discount after item discounts and clamps at 0', () => {
    const item = makeCartItem({
      qty: 1,
      unitPricePaise: 5000,
      discountType: 'flat',
      discountValue: 1000, // net 4000
    });
    const totals = calculateCartTotals([item], 'flat', 5000);
    expect(totals.overallDiscountPaise).toBe(4000);
    expect(totals.totalPaise).toBe(0);
  });

  it('warns when selling price or discounted effective price is below cost', () => {
    const directBelowCost = calculateLineTotals(
      makeCartItem({ qty: 1, unitPricePaise: 7500, costPaise: 8000 })
    );
    expect(directBelowCost.unitPriceBelowCost).toBe(true);
    expect(directBelowCost.effectiveBelowCost).toBe(true);

    const discountBelowCost = calculateLineTotals(
      makeCartItem({
        qty: 1,
        unitPricePaise: 10000,
        costPaise: 8500,
        discountType: 'percent',
        discountValue: 20, // effective 8000 < 8500
      })
    );
    expect(discountBelowCost.unitPriceBelowCost).toBe(false);
    expect(discountBelowCost.effectiveBelowCost).toBe(true);
  });

  it('requires a customer for Credit (Udhaar) checkout', () => {
    const missingCustomer = validateCheckout({
      itemCount: 1,
      totalPaise: 15000,
      paymentMode: 'credit',
      payment: { cashPaise: 0, upiPaise: 0, creditPaise: 15000 },
    });
    expect(missingCustomer.valid).toBe(false);

    const withCustomer = validateCheckout({
      itemCount: 1,
      totalPaise: 15000,
      paymentMode: 'credit',
      payment: { cashPaise: 0, upiPaise: 0, creditPaise: 15000 },
      customerId: 'cust-ramesh',
    });
    expect(withCustomer.valid).toBe(true);
  });

  it('validates split payments must sum exactly to bill total and require customer if credit > 0', () => {
    const mismatch = validateCheckout({
      itemCount: 2,
      totalPaise: 50000,
      paymentMode: 'split',
      payment: { cashPaise: 20000, upiPaise: 25000, creditPaise: 0 },
    });
    expect(mismatch.valid).toBe(false);

    const splitCreditNoCustomer = validateCheckout({
      itemCount: 2,
      totalPaise: 50000,
      paymentMode: 'split',
      payment: { cashPaise: 20000, upiPaise: 20000, creditPaise: 10000 },
    });
    expect(splitCreditNoCustomer.valid).toBe(false);

    const validSplit = validateCheckout({
      itemCount: 2,
      totalPaise: 50000,
      paymentMode: 'split',
      payment: { cashPaise: 20000, upiPaise: 20000, creditPaise: 10000 },
      customerId: 'cust-ramesh',
    });
    expect(validSplit.valid).toBe(true);
  });

  it('rejects negative split payment amounts', () => {
    const result = validateCheckout({
      itemCount: 1,
      totalPaise: 10000,
      paymentMode: 'split',
      payment: { cashPaise: -100, upiPaise: 10100, creditPaise: 0 },
    });
    expect(result.valid).toBe(false);
  });

  it('mentions both paid and bill totals when split payments mismatch', () => {
    const result = validateCheckout({
      itemCount: 1,
      totalPaise: 50000,
      paymentMode: 'split',
      payment: { cashPaise: 20000, upiPaise: 25000, creditPaise: 0 },
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('₹450');
    expect(result.error).toContain('₹500');
  });

  it('leaves totals unchanged with a zero percent overall discount', () => {
    const totals = calculateCartTotals([makeCartItem()], 'percent', 0);
    expect(totals.overallDiscountPaise).toBe(0);
    expect(totals.totalPaise).toBe(totals.subtotalAfterItemDiscountsPaise);
  });

  it('makes the total zero with a 100 percent overall discount', () => {
    const totals = calculateCartTotals([makeCartItem()], 'percent', 100);
    expect(totals.totalPaise).toBe(0);
  });

  it('clamps a flat item discount above gross to a zero net line', () => {
    const line = calculateLineTotals(
      makeCartItem({ qty: 1, unitPricePaise: 5000, discountType: 'flat', discountValue: 99999 })
    );
    expect(line.lineDiscountPaise).toBe(5000);
    expect(line.netTotalPaise).toBe(0);
  });

  it('clamps an overall discount above subtotal to a zero total', () => {
    const totals = calculateCartTotals([makeCartItem()], 'flat', 99999);
    expect(totals.overallDiscountPaise).toBe(totals.subtotalAfterItemDiscountsPaise);
    expect(totals.totalPaise).toBe(0);
  });

  it('returns all zero totals for an empty cart', () => {
    const totals = calculateCartTotals([], 'percent', 10);
    expect(totals.grossSubtotalPaise).toBe(0);
    expect(totals.itemDiscountTotalPaise).toBe(0);
    expect(totals.subtotalAfterItemDiscountsPaise).toBe(0);
    expect(totals.overallDiscountPaise).toBe(0);
    expect(totals.totalPaise).toBe(0);
    expect(totals.totalCostPaise).toBe(0);
    expect(totals.estimatedProfitPaise).toBe(0);
    expect(totals.lineResults).toEqual({});
  });

  it('rounds 3 x 3333 at 10% item and 10% overall to explicit paise', () => {
    // Gross: 3 × 3333 = 9999. Item discount: round(999.9) = 1000 → 8999.
    // Overall discount: round(899.9) = 900 → 8099.
    const item = makeCartItem({
      qty: 3,
      unitPricePaise: 3333,
      discountType: 'percent',
      discountValue: 10,
    });
    const totals = calculateCartTotals([item], 'percent', 10);

    expect(totals.grossSubtotalPaise).toBe(9999);
    expect(totals.lineResults['p-1'].lineDiscountPaise).toBe(1000);
    expect(totals.subtotalAfterItemDiscountsPaise).toBe(8999);
    expect(totals.overallDiscountPaise).toBe(900);
    expect(totals.totalPaise).toBe(8099);
  });

  it('requires a customer for credit mode and accepts cash mode', () => {
    const credit = validateCheckout({
      itemCount: 1,
      totalPaise: 5000,
      paymentMode: 'credit',
      payment: { cashPaise: 0, upiPaise: 0, creditPaise: 5000 },
    });
    expect(credit.valid).toBe(false);

    const cash = validateCheckout({
      itemCount: 1,
      totalPaise: 5000,
      paymentMode: 'cash',
      payment: { cashPaise: 5000, upiPaise: 0, creditPaise: 0 },
    });
    expect(cash.valid).toBe(true);
  });
});
