import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE_URL = process.env.UI_BASE_URL ?? 'http://127.0.0.1:3000';
const WIDTHS = [360, 768, 1024, 1440];
const ROUTES = ['/', '/inventory', '/restock'];
const SCREENSHOT_DIR = path.resolve('screenshots');
const results = [];
const screenshots = [];

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function check(name, action) {
  try {
    await action();
    record(name, true);
    return true;
  } catch (error) {
    record(name, false, error instanceof Error ? error.message.split('\n')[0] : String(error));
    return false;
  }
}

function routeSlug(route) {
  return route === '/' ? 'home' : route.replace(/^\/|\/$/g, '').replaceAll('/', '-');
}

function parseStock(text) {
  const healthy = text.match(/(\d+)\s+in stock/i);
  if (healthy) return Number(healthy[1]);
  const status = text.match(/(?:Low Stock|Dead Stock|Near Expiry)\s*·\s*(\d+)/i);
  return status ? Number(status[1]) : null;
}

const browser = await chromium.launch();

try {
  await rm(SCREENSHOT_DIR, { recursive: true, force: true });
  await mkdir(SCREENSHOT_DIR, { recursive: true });

  const context = await browser.newContext();
  for (const width of WIDTHS) {
    for (const route of ROUTES) {
      const page = await context.newPage();
      await page.setViewportSize({ width, height: 900 });
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      page.on('pageerror', (error) => pageErrors.push(error.message));

      const label = `${route} @ ${width}px`;
      await check(`load ${label}`, async () => {
        await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle', timeout: 30000 });
        await page.evaluate(() => document.fonts.ready);
      });

      const screenshotPath = path.join(SCREENSHOT_DIR, `${routeSlug(route)}-${width}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      screenshots.push(screenshotPath);

      await check(`no horizontal page scroll ${label}`, async () => {
        const dimensions = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        if (dimensions.scrollWidth > dimensions.innerWidth) {
          throw new Error(
            `scrollWidth ${dimensions.scrollWidth} > innerWidth ${dimensions.innerWidth}`
          );
        }
      });

      if (width === 360) {
        const smallButtons = await page.evaluate(() =>
          Array.from(document.querySelectorAll('button'))
            .filter((button) => {
              const rect = button.getBoundingClientRect();
              const style = window.getComputedStyle(button);
              return (
                rect.width > 0 &&
                rect.height > 0 &&
                style.visibility !== 'hidden' &&
                style.display !== 'none' &&
                rect.height < 40
              );
            })
            .map((button) => {
              const label =
                button.getAttribute('aria-label') || button.textContent?.trim().slice(0, 40) || '';
              return `${label || '<icon>'} (${Math.round(button.getBoundingClientRect().height)}px)`;
            })
        );
        record(
          `buttons at least 40px tall ${route} @ 360px`,
          smallButtons.length === 0,
          smallButtons.join(', ')
        );
      }

      record(`no page errors ${label}`, pageErrors.length === 0, pageErrors.join(' | '));
      record(`no console errors ${label}`, consoleErrors.length === 0, consoleErrors.join(' | '));
      await page.close();
    }
  }

  const page = await context.newPage();
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });

  const productCard = page
    .locator('section[aria-label="Product catalog"] button.khata-surface:not([disabled])')
    .filter({ hasText: /in stock/i })
    .first();
  let stockQty = null;

  await check('add a product to the cart', async () => {
    await productCard.waitFor({ timeout: 10000 });
    const cardText = await productCard.innerText();
    stockQty = parseStock(cardText);
    if (stockQty === null) throw new Error('Could not read product stock from card');
    await productCard.click();
    await page.locator('#current-bill').getByText(/Current Bill \(1\)/).waitFor();
  });

  const cart = page.locator('#current-bill');
  const plusButton = cart.getByRole('button', { name: 'Increase quantity' });

  await check('cart quantity stops at available stock', async () => {
    if (stockQty === null) throw new Error('Stock quantity was not detected');
    let guard = 0;
    while ((await plusButton.isEnabled()) && guard <= stockQty + 2) {
      await plusButton.click();
      guard += 1;
    }
    const qtyText = (await plusButton.locator('xpath=preceding-sibling::span[1]').innerText()).trim();
    if (qtyText !== String(stockQty)) {
      throw new Error(`Cart qty ${qtyText} did not stop at stock ${stockQty}`);
    }
    if (await plusButton.isEnabled()) throw new Error('“+” button is still enabled at max stock');
  });

  await check('“+” past stock does not increase quantity', async () => {
    const qtyBefore = (
      await plusButton.locator('xpath=preceding-sibling::span[1]').innerText()
    ).trim();
    await plusButton.evaluate((element) => element.click());
    const qtyAfter = (
      await plusButton.locator('xpath=preceding-sibling::span[1]').innerText()
    ).trim();
    if (qtyBefore !== qtyAfter) throw new Error(`Qty changed from ${qtyBefore} to ${qtyAfter}`);
  });

  await check('park the current bill', async () => {
    await cart.getByRole('button', { name: /Park Bill/i }).click();
    await cart.getByText(/Current Bill \(0\)/).waitFor();
  });

  await check('parked bill survives reload', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByText(/Parked Bills \(1\)/).waitFor({ timeout: 10000 });
  });

  await check('confirm a purchase order from the PO drawer', async () => {
    await page.goto(`${BASE_URL}/restock`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Add to Purchase Order' }).first().click();
    await page.getByRole('button', { name: /PO Draft \(1\)/ }).click();
    await page.getByRole('button', { name: /Confirm 1 order\(s\)/ }).click();
    await page.getByRole('button', { name: /PO Draft \(0\)/ }).waitFor({ timeout: 10000 });
  });

  await check('create a supplier return', async () => {
    await page.getByRole('button', { name: 'Return to Supplier' }).first().click();
    await page.getByRole('button', { name: 'Confirm Return' }).click();
    await page.getByText(/Added \d+ × .+ to Supplier Return List/).waitFor({ timeout: 10000 });
  });

  await check('clear a return from the supplier-returns drawer', async () => {
    await page.goto(`${BASE_URL}/inventory`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Supplier Action Due/ }).click();
    const drawer = page.locator('[role="dialog"]');
    await drawer.getByRole('button', { name: /Generate Return Slip/ }).last().click();
    const markReturned = drawer.getByRole('button', { name: 'Mark as returned' });
    await markReturned.first().waitFor({ timeout: 10000 });
    const beforeClear = await markReturned.count();
    await markReturned.first().click();
    await page.getByRole('button', { name: 'Confirm Returned' }).click();
    await page.getByText('Supplier return marked as completed').waitFor({ timeout: 5000 });
    await page.waitForTimeout(250);
    const afterClear = await markReturned.count();
    if (afterClear !== beforeClear - 1) {
      throw new Error(`Expected ${beforeClear - 1} remaining return rows, found ${afterClear}`);
    }
    await page.keyboard.press('Escape');
  });

  await check('switch EN / HI / KN', async () => {
    await page.getByRole('button', { name: 'हिं', exact: true }).click();
    await page.getByRole('link', { name: 'काउंटर' }).waitFor({ timeout: 5000 });
    await page.getByRole('button', { name: 'ಕ', exact: true }).click();
    await page.getByRole('link', { name: 'ಕೌಂಟರ್' }).waitFor({ timeout: 5000 });
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await page.getByRole('link', { name: 'Counter' }).waitFor({ timeout: 5000 });
  });

  await check('toggle privacy', async () => {
    await page.getByRole('button', { name: 'Hide cost & profit' }).click();
    await page.getByRole('button', { name: 'Show sensitive figures' }).waitFor({ timeout: 5000 });
  });

  await check('open reset confirmation and cancel', async () => {
    await page.getByRole('button', { name: 'Reset demo data' }).click();
    await page.getByRole('heading', { name: 'Reset demo data?' }).waitFor({ timeout: 5000 });
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.getByRole('heading', { name: 'Reset demo data?' }).waitFor({ state: 'hidden' });
  });

  await page.close();
} finally {
  await browser.close();
}

const failures = results.filter((result) => !result.ok);
console.log(`\n${results.length - failures.length}/${results.length} checks passed.`);
console.log('\nScreenshots:');
for (const screenshot of screenshots) console.log(`- ${path.relative(process.cwd(), screenshot)}`);

if (failures.length > 0) {
  console.log('\nFailures:');
  for (const failure of failures) {
    console.log(`- ${failure.name}${failure.detail ? `: ${failure.detail}` : ''}`);
  }
  process.exitCode = 1;
}
