import { build } from 'esbuild';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'trexo-ledger-export-'));
const bundledScript = join(temporaryDirectory, 'export-demo-ledger.mjs');

try {
  const result = await build({
    entryPoints: [resolve('scripts/export-demo-ledger.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
    outfile: bundledScript,
    external: ['node:*'],
    packages: 'external',
  });
  writeFileSync(bundledScript, result.outputFiles?.[0]?.contents ?? '');
  await import(pathToFileURL(bundledScript).href);
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
