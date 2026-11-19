import type { CartItem, DiscountType, PaymentBreakdown, PaymentMode } from '../types';

export const MASKED_CURRENCY = '₹ •••••';

export function rupeesToPaise(rupees: number): number {
  if (!Number.isFinite(rupees)) return 0;
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: number): number {
  if (!Number.isFinite(paise)) return 0;
  return Math.round(paise) / 100;
}

export function formatINR(
  paise: number,
  options?: { decimals?: boolean; compact?: boolean }
): string {
  const safePaise = Number.isFinite(paise) ? Math.round(paise) : 0;
  const rupees = safePaise / 100;
  const hasFraction = safePaise % 100 !== 0;
  const showDecimals = options?.decimals ?? hasFraction;

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
    notation: options?.compact ? 'compact' : 'standard',
  }).format(rupees);
}

export interface LineTotalResult {
  grossPaise: number;
  lineDiscountPaise: number;
  netTotalPaise: number;
  effectiveUnitPaise: number;
  unitPriceBelowCost: boolean;
  effectiveBelowCost: boolean;
}

export function calculateLineTotals(item: {
  qty: number;
  unitPricePaise: number;
  costPaise: number;
  discountType: DiscountType;
  discountValue: number;
}): LineTotalResult {
  const qty = Math.max(0, Math.round(item.qty));
  const unitPricePaise = Math.max(0, Math.round(item.unitPricePaise));
  const costPaise = Math.max(0, Math.round(item.costPaise));
  const grossPaise = qty * unitPricePaise;

  let lineDiscountPaise = 0;
  if (item.discountType === 'percent') {
    const pct = Math.min(100, Math.max(0, item.discountValue));
    lineDiscountPaise = Math.round((grossPaise * pct) / 100);
  } else {
    const flat = Math.max(0, Math.round(item.discountValue));
    lineDiscountPaise = Math.min(grossPaise, flat);
  }

  const netTotalPaise = Math.max(0, grossPaise - lineDiscountPaise);
  const effectiveUnitPaise = qty > 0 ? Math.round(netTotalPaise / qty) : unitPricePaise;

  return {
    grossPaise,
    lineDiscountPaise,
    netTotalPaise,
    effectiveUnitPaise,
    unitPriceBelowCost: qty > 0 && unitPricePaise < costPaise,
    effectiveBelowCost: qty > 0 && netTotalPaise < qty * costPaise,
  };
}

export interface CartTotalsResult {
  grossSubtotalPaise: number;
  itemDiscountTotalPaise: number;
  subtotalAfterItemDiscountsPaise: number;
  overallDiscountPaise: number;
  totalPaise: number;
  totalCostPaise: number;
  estimatedProfitPaise: number;
  hasBelowCostItem: boolean;
  lineResults: Record<string, LineTotalResult>;
}

/**
 * Applies per-item discounts FIRST, then overall bill discount (% or flat paise).
 */
export function calculateCartTotals(
  items: CartItem[],
  overallDiscountType: DiscountType,
  overallDiscountValue: number
): CartTotalsResult {
  let grossSubtotalPaise = 0;
  let itemDiscountTotalPaise = 0;
  let subtotalAfterItemDiscountsPaise = 0;
  let totalCostPaise = 0;
  let hasBelowCostItem = false;
  const lineResults: Record<string, LineTotalResult> = {};

  for (const item of items) {
    const line = calculateLineTotals(item);
    lineResults[item.productId] = line;
    grossSubtotalPaise += line.grossPaise;
    itemDiscountTotalPaise += line.lineDiscountPaise;
    subtotalAfterItemDiscountsPaise += line.netTotalPaise;
    totalCostPaise += Math.max(0, Math.round(item.qty)) * Math.max(0, Math.round(item.costPaise));
    if (line.unitPriceBelowCost || line.effectiveBelowCost) {
      hasBelowCostItem = true;
    }
  }

  let overallDiscountPaise = 0;
  if (overallDiscountType === 'percent') {
    const pct = Math.min(100, Math.max(0, overallDiscountValue));
    overallDiscountPaise = Math.round((subtotalAfterItemDiscountsPaise * pct) / 100);
  } else {
    const flat = Math.max(0, Math.round(overallDiscountValue));
    overallDiscountPaise = Math.min(subtotalAfterItemDiscountsPaise, flat);
  }

  const totalPaise = Math.max(0, subtotalAfterItemDiscountsPaise - overallDiscountPaise);
  const estimatedProfitPaise = totalPaise - totalCostPaise;

  return {
    grossSubtotalPaise,
    itemDiscountTotalPaise,
    subtotalAfterItemDiscountsPaise,
    overallDiscountPaise,
    totalPaise,
    totalCostPaise,
    estimatedProfitPaise,
    hasBelowCostItem,
    lineResults,
  };
}

export interface CheckoutValidationResult {
  valid: boolean;
  error?: string;
  normalizedPayment: PaymentBreakdown;
}

export function validateCheckout(params: {
  itemCount: number;
  totalPaise: number;
  paymentMode: PaymentMode;
  payment: PaymentBreakdown;
  customerId?: string;
}): CheckoutValidationResult {
  const { itemCount, totalPaise, paymentMode, payment, customerId } = params;
  const total = Math.max(0, Math.round(totalPaise));

  if (itemCount <= 0) {
    return {
      valid: false,
      error: 'Add at least one item to the bill before completing.',
      normalizedPayment: { cashPaise: 0, upiPaise: 0, creditPaise: 0 },
    };
  }

  if (paymentMode === 'cash') {
    return {
      valid: true,
      normalizedPayment: { cashPaise: total, upiPaise: 0, creditPaise: 0 },
    };
  }

  if (paymentMode === 'upi') {
    return {
      valid: true,
      normalizedPayment: { cashPaise: 0, upiPaise: total, creditPaise: 0 },
    };
  }

  if (paymentMode === 'credit') {
    if (!customerId) {
      return {
        valid: false,
        error: 'Select or add a customer to record an Udhaar (Credit) bill.',
        normalizedPayment: { cashPaise: 0, upiPaise: 0, creditPaise: total },
      };
    }
    return {
      valid: true,
      normalizedPayment: { cashPaise: 0, upiPaise: 0, creditPaise: total },
    };
  }

  // Split payment validation
  const cashPaise = Math.round(payment.cashPaise);
  const upiPaise = Math.round(payment.upiPaise);
  const creditPaise = Math.round(payment.creditPaise);

  if (cashPaise < 0 || upiPaise < 0 || creditPaise < 0) {
    return {
      valid: false,
      error: 'Split payment amounts cannot be negative.',
      normalizedPayment: { cashPaise, upiPaise, creditPaise },
    };
  }

  const splitSum = cashPaise + upiPaise + creditPaise;
  if (splitSum !== total) {
    return {
      valid: false,
      error: `Split payments (${formatINR(splitSum)}) must equal bill total (${formatINR(total)}).`,
      normalizedPayment: { cashPaise, upiPaise, creditPaise },
    };
  }

  if (creditPaise > 0 && !customerId) {
    return {
      valid: false,
      error: 'Select a customer when including Udhaar (Credit) in split payment.',
      normalizedPayment: { cashPaise, upiPaise, creditPaise },
    };
  }

  return {
    valid: true,
    normalizedPayment: { cashPaise, upiPaise, creditPaise },
  };
}
