import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { createInitialLedger } from '../src/services/storage';

const outputPath = resolve(process.argv[2] ?? 'backend/data/demo_ledger_export.json');
const referenceDate = new Date('2026-11-18T12:00:00.000Z');
const ledger = createInitialLedger(referenceDate);
const exportPayload = {
  products: ledger.products,
  sales: ledger.sales,
  suppliers: ledger.suppliers,
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(exportPayload, null, 2)}\n`, 'utf8');
console.log(`Exported ${ledger.products.length} products and ${ledger.sales.length} sales to ${outputPath}`);
