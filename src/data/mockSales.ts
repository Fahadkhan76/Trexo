import type { Product, Sale, SaleLineItem } from '../types';
import { daysAgoISO } from '../utils/dates';
import { createSeedProducts } from './mockProducts';

const WEEKDAY_FACTORS = [0.82, 0.88, 0.94, 1, 1.04, 1.2, 1.28];
const DEMAND_FACTORS = [0.84, 1.08, 0.96, 1.16, 0.91, 1.03, 1.22, 0.87, 1.11, 0.98];
const SALES_HISTORY_DAYS = 120;

function createSyntheticHistory(now: Date, products: Product[]): Sale[] {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const staleAfterDays = 30;
  const deadProducts = new Set(products
    .filter((product) => Math.floor((today.getTime() - new Date(product.lastSoldAt).getTime()) / 86_400_000) >= staleAfterDays)
    .map((product) => product.id));
  const sales: Sale[] = [];

  for (let age = SALES_HISTORY_DAYS - 1; age >= 0; age -= 1) {
    const day = new Date(today.getTime() - age * 86_400_000);
    const dayKey = day.toISOString().slice(0, 10);
    const items: SaleLineItem[] = [];

    products.forEach((product, productIndex) => {
      const rate = Math.max(0, product.avgDailySales ?? 0);
      const lastSoldDay = product.lastSoldAt.slice(0, 10);
      if (deadProducts.has(product.id) && dayKey > lastSoldDay) return;

      const factor = WEEKDAY_FACTORS[day.getUTCDay()] * DEMAND_FACTORS[(age + productIndex * 3) % DEMAND_FACTORS.length];
      const expected = rate * factor;
      const whole = Math.floor(expected);
      const fractional = expected - whole;
      const variedUnits = whole + (fractional * 100 >= (productIndex * 37 + age * 19) % 100 ? 1 : 0);
      // One deterministic no-sale day about every 23 days creates realistic zeros.
      const occasionalZero = (productIndex * 11 + age * 7) % 23 === 0;
      let qty = occasionalZero ? 0 : variedUnits;
      if (dayKey === lastSoldDay) qty = Math.max(1, qty);
      if (qty <= 0) return;

      const unitPricePaise = product.sellingPricePaise;
      const lineTotalPaise = unitPricePaise * qty;
      items.push({
        productId: product.id,
        sku: product.sku,
        name: product.name,
        emoji: product.emoji,
        qty,
        unitPricePaise,
        costPaise: product.costPaise,
        discountType: 'flat',
        discountValue: 0,
        lineDiscountPaise: 0,
        lineTotalPaise,
      });
    });

    if (items.length === 0) continue;
    const grossSubtotalPaise = items.reduce((sum, item) => sum + item.lineTotalPaise, 0);
    const totalCostPaise = items.reduce((sum, item) => sum + item.costPaise * item.qty, 0);
    sales.push({
      id: `sale-synthetic-${dayKey}`,
      billNumber: `DEMO-${dayKey.replaceAll('-', '')}`,
      createdAt: day.toISOString(),
      isSynthetic: true,
      items,
      grossSubtotalPaise,
      itemDiscountTotalPaise: 0,
      subtotalAfterItemDiscountsPaise: grossSubtotalPaise,
      overallDiscountType: 'flat',
      overallDiscountValue: 0,
      overallDiscountPaise: 0,
      totalPaise: grossSubtotalPaise,
      totalCostPaise,
      paymentMode: 'cash',
      payment: { cashPaise: grossSubtotalPaise, upiPaise: 0, creditPaise: 0 },
    });
  }
  return sales;
}

export function createSeedSales(now: Date = new Date(), products: Product[] = createSeedProducts(now)): Sale[] {
  const seedSales: Sale[] = [
    {
      id: 'sale-seed-1',
      billNumber: 'INV-1001',
      createdAt: daysAgoISO(0, now),
      isSynthetic: true,
      items: [
        {
          productId: 'prod-107',
          sku: 'SKU-401',
          name: 'Sona Masoori Raw Rice 5kg',
          emoji: '🍚',
          qty: 2,
          unitPricePaise: 31000,
          costPaise: 26500,
          discountType: 'flat',
          discountValue: 0,
          lineDiscountPaise: 0,
          lineTotalPaise: 62000,
        },
        {
          productId: 'prod-123',
          sku: 'SKU-417',
          name: 'Brooke Bond Red Label Tea 250g',
          emoji: '🍵',
          qty: 1,
          unitPricePaise: 14000,
          costPaise: 11800,
          discountType: 'flat',
          discountValue: 0,
          lineDiscountPaise: 0,
          lineTotalPaise: 14000,
        },
      ],
      grossSubtotalPaise: 76000,
      itemDiscountTotalPaise: 0,
      subtotalAfterItemDiscountsPaise: 76000,
      overallDiscountType: 'flat',
      overallDiscountValue: 0,
      overallDiscountPaise: 0,
      totalPaise: 76000,
      totalCostPaise: 64800,
      paymentMode: 'upi',
      payment: { cashPaise: 0, upiPaise: 76000, creditPaise: 0 },
    },
    {
      id: 'sale-seed-2',
      billNumber: 'INV-1002',
      createdAt: daysAgoISO(1, now),
      isSynthetic: true,
      items: [
        {
          productId: 'prod-fast-3',
          sku: 'SKU-203',
          name: 'Aashirvaad Whole Wheat Atta 5kg',
          emoji: '🫓',
          qty: 2,
          unitPricePaise: 25500,
          costPaise: 21800,
          discountType: 'flat',
          discountValue: 0,
          lineDiscountPaise: 0,
          lineTotalPaise: 51000,
        },
        {
          productId: 'prod-113',
          sku: 'SKU-407',
          name: 'Nandini Pure Cow Ghee 500ml',
          emoji: '🧈',
          qty: 1,
          unitPricePaise: 32500,
          costPaise: 28500,
          discountType: 'flat',
          discountValue: 0,
          lineDiscountPaise: 0,
          lineTotalPaise: 32500,
        },
      ],
      grossSubtotalPaise: 83500,
      itemDiscountTotalPaise: 0,
      subtotalAfterItemDiscountsPaise: 83500,
      overallDiscountType: 'flat',
      overallDiscountValue: 0,
      overallDiscountPaise: 0,
      totalPaise: 83500,
      totalCostPaise: 72100,
      paymentMode: 'credit',
      payment: { cashPaise: 0, upiPaise: 0, creditPaise: 83500 },
      customerId: 'cust-ramesh',
      customerName: 'Ramesh Gowda',
    },
    {
      id: 'sale-seed-3',
      billNumber: 'INV-1003',
      createdAt: daysAgoISO(2, now),
      isSynthetic: true,
      items: [
        {
          productId: 'prod-127',
          sku: 'SKU-421',
          name: 'Surf Excel Easy Wash 1kg',
          emoji: '🧺',
          qty: 2,
          unitPricePaise: 13500,
          costPaise: 11200,
          discountType: 'flat',
          discountValue: 0,
          lineDiscountPaise: 0,
          lineTotalPaise: 27000,
        },
        {
          productId: 'prod-118',
          sku: 'SKU-412',
          name: 'Maggi 2-Minute Masala Noodles 4-Pack',
          emoji: '🍜',
          qty: 3,
          unitPricePaise: 5600,
          costPaise: 4800,
          discountType: 'flat',
          discountValue: 0,
          lineDiscountPaise: 0,
          lineTotalPaise: 16800,
        },
      ],
      grossSubtotalPaise: 43800,
      itemDiscountTotalPaise: 0,
      subtotalAfterItemDiscountsPaise: 43800,
      overallDiscountType: 'flat',
      overallDiscountValue: 0,
      overallDiscountPaise: 0,
      totalPaise: 43800,
      totalCostPaise: 36800,
      paymentMode: 'cash',
      payment: { cashPaise: 43800, upiPaise: 0, creditPaise: 0 },
    },
  ];
  return [...createSyntheticHistory(now, products), ...seedSales]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
