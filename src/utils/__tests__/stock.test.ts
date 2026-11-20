import { describe, expect, it } from 'vitest';
import { findStockIssues, formatStockIssue } from '../money';

const products = [
  { id: 'p1', stockQty: 5 },
  { id: 'p2', stockQty: 0 },
  { id: 'p3', stockQty: 2 },
];

describe('Stock validation', () => {
  it('returns no issues when requested quantity is within stock', () => {
    expect(findStockIssues([{ productId: 'p1', name: 'Rice', qty: 3 }], products)).toEqual([]);
  });

  it('returns no issues when requested quantity equals stock exactly', () => {
    expect(findStockIssues([{ productId: 'p1', name: 'Rice', qty: 5 }], products)).toEqual([]);
  });

  it('reports requested and available quantities when over stock', () => {
    expect(findStockIssues([{ productId: 'p1', name: 'Rice', qty: 6 }], products)).toEqual([
      { productId: 'p1', name: 'Rice', requested: 6, available: 5 },
    ]);
  });

  it('reports multiple over-stock lines', () => {
    const issues = findStockIssues(
      [
        { productId: 'p1', name: 'Rice', qty: 6 },
        { productId: 'p3', name: 'Oil', qty: 3 },
      ],
      products
    );
    expect(issues).toHaveLength(2);
    expect(issues.map((issue) => issue.productId)).toEqual(['p1', 'p3']);
  });

  it('formats an out-of-stock message', () => {
    const [issue] = findStockIssues([{ productId: 'p2', name: 'Ghee', qty: 1 }], products);
    expect(formatStockIssue(issue)).toBe('Ghee is out of stock.');
  });

  it('skips unknown/custom products that cannot be validated', () => {
    expect(findStockIssues([{ productId: 'custom-1', name: 'Custom', qty: 99 }], products)).toEqual(
      []
    );
  });
});
