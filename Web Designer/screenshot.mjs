/**
 * screenshot.mjs
 * Usage: node screenshot.mjs <url> [label]
 * Saves to: ./temporary screenshots/screenshot-N[-label].png
 *
 * Uses Playwright (installed via npm). Run `npm install` first.
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const url   = process.argv[2];
const label = process.argv[3] || null;

if (!url) {
  console.error('Usage: node screenshot.mjs <url> [label]');
  process.exit(1);
}

// Ensure output directory exists
const outDir = path.join(__dirname, 'temporary screenshots');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// Auto-increment: find next available screenshot-N.png
function nextScreenshotPath() {
  let n = 1;
  while (true) {
    const name = label ? `screenshot-${n}-${label}.png` : `screenshot-${n}.png`;
    const full = path.join(outDir, name);
    if (!fs.existsSync(full)) return { name, full };
    n++;
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page    = await browser.newPage();

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  // Extra wait for fonts and images to render
  await page.waitForTimeout(1500);

  // Wait a moment for any CSS animations to settle
  await page.waitForTimeout(500);

  const { name, full } = nextScreenshotPath();
  await page.screenshot({ path: full, fullPage: true });
  await browser.close();

  console.log(`Screenshot saved: temporary screenshots/${name}`);
})();
