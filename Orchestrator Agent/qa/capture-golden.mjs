#!/usr/bin/env node

/**
 * capture-golden.mjs — Generate golden output screenshots from existing funnel pages.
 *
 * Usage: node qa/capture-golden.mjs [source-dir]
 *
 * Serves the source directory (defaults to funnel-designer/output/) on a temp port,
 * then screenshots each page type at 3 breakpoints (375, 768, 1280).
 *
 * Saves to:
 *   qa/golden-inputs/reference/{page_type}.png      (desktop 1280px — single reference)
 *   qa/golden-outputs/{page_type}/mobile-375.png
 *   qa/golden-outputs/{page_type}/tablet-768.png
 *   qa/golden-outputs/{page_type}/desktop-1280.png
 */

import http from 'http';
import { readFile, mkdir } from 'fs/promises';
import { join, extname, dirname } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const QA_ROOT = __dirname;

// Default source: funnel-designer output
const SOURCE_DIR = process.argv[2] || join(__dirname, '..', '..', 'funnel-designer', 'output');

const PAGE_TYPES = [
  'landing_page',
  'sales_page',
  'thank_you_page',
  'upgrade_page',
  'upsell_page',
  'replay_page',
];

const BREAKPOINTS = [
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1280', width: 1280, height: 900 },
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

// ─── Static Server ──────────────────────────────────────────────

function startServer(rootDir) {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      let urlPath = decodeURIComponent(req.url.split('?')[0]);
      let filePath;

      if (urlPath === '/' || urlPath === '') {
        filePath = join(rootDir, 'index.html');
      } else {
        filePath = join(rootDir, urlPath);
      }

      // Directory → try index.html
      if (!extname(filePath)) {
        const withIndex = join(filePath, 'index.html');
        if (existsSync(withIndex)) filePath = withIndex;
        else filePath = filePath + '.html';
      }

      try {
        const data = await readFile(filePath);
        const ext = extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
      } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      }
    });

    server.listen(0, () => {
      const port = server.address().port;
      resolve({ server, port });
    });
  });
}

// ─── Screenshot ─────────────────────────────────────────────────

async function captureScreenshots() {
  // Dynamic import — Playwright lives in funnel-designer's node_modules
  const { createRequire } = await import('module');
  const require = createRequire(import.meta.url);
  const playwright = require(join(__dirname, '..', '..', 'funnel-designer', 'node_modules', 'playwright'));
  const { chromium } = playwright;

  console.log(`\nSource directory: ${SOURCE_DIR}`);

  // Verify source exists
  if (!existsSync(SOURCE_DIR)) {
    console.error(`❌ Source directory not found: ${SOURCE_DIR}`);
    process.exit(1);
  }

  // Start local server
  const { server, port } = await startServer(SOURCE_DIR);
  console.log(`Server running on http://localhost:${port}\n`);

  const browser = await chromium.launch();

  try {
    for (const pageType of PAGE_TYPES) {
      const pageDir = join(SOURCE_DIR, pageType);
      if (!existsSync(join(pageDir, 'index.html'))) {
        console.log(`⚠️  Skipping ${pageType} — no index.html found`);
        continue;
      }

      const url = `http://localhost:${port}/${pageType}/`;
      console.log(`📸 ${pageType}`);

      // Ensure output directories exist
      await mkdir(join(QA_ROOT, 'golden-outputs', pageType), { recursive: true });

      for (const bp of BREAKPOINTS) {
        const page = await browser.newPage({
          viewport: { width: bp.width, height: bp.height },
        });

        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
        // Wait for fonts and images
        await page.waitForTimeout(2000);

        const screenshotPath = join(QA_ROOT, 'golden-outputs', pageType, `${bp.name}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`   ✅ ${bp.name} (${bp.width}px)`);

        // Save desktop as reference too
        if (bp.width === 1280) {
          const refPath = join(QA_ROOT, 'golden-inputs', 'reference', `${pageType}.png`);
          await page.screenshot({ path: refPath, fullPage: true });
          console.log(`   ✅ reference (desktop)`);
        }

        await page.close();
      }
    }
  } finally {
    await browser.close();
    server.close();
  }

  console.log('\n✅ Golden screenshots captured successfully.\n');
}

captureScreenshots().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
