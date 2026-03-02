/**
 * End-to-end pipeline test for Web Designer.
 *
 * Exercises: server startup → health check → page serving →
 * HTML validation → screenshot capture → cleanup.
 *
 * Uses the real serve.mjs and test-client fixtures.
 * Run: npm run test:e2e
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

const PORT = 3098; // Dedicated port to avoid conflicts
const BASE_URL = `http://localhost:${PORT}`;
const AUTH_HEADER = { 'Authorization': 'Bearer impact2024' };

// ─── HTTP helpers ────────────────────────────────────────

function fetch(urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const req = http.get(url, {
      timeout: 5000,
      headers: { ...AUTH_HEADER, ...options.headers },
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf-8'),
        });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
  });
}

// ─── Setup / Teardown ────────────────────────────────────

let serverProcess;
let screenshotPath;

before(async () => {
  // Start the real serve.mjs on a dedicated port
  serverProcess = spawn('node', [path.join(PROJECT_ROOT, 'serve.mjs')], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(PORT), LOG_LEVEL: 'error' },
    cwd: PROJECT_ROOT,
  });

  // Wait for server to be ready via /api/health
  const maxWait = 10000;
  const start = Date.now();
  let ready = false;

  while (Date.now() - start < maxWait) {
    try {
      const res = await fetch('/api/health');
      if (res.status === 200) {
        ready = true;
        break;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise(r => setTimeout(r, 200));
  }

  if (!ready) {
    serverProcess.kill();
    throw new Error('Server failed to start within 10 seconds');
  }
});

after(() => {
  if (serverProcess) serverProcess.kill();
  if (screenshotPath && fs.existsSync(screenshotPath)) {
    fs.unlinkSync(screenshotPath);
  }
});

// ─── Tests ───────────────────────────────────────────────

describe('E2E pipeline — test-client', { timeout: 30000 }, () => {

  it('health endpoint returns 200 with status ok', async () => {
    const res = await fetch('/api/health');
    assert.equal(res.status, 200);
    const json = JSON.parse(res.body);
    assert.equal(json.status, 'ok');
    assert.ok(json.clientCount >= 1, `Expected at least 1 client, got ${json.clientCount}`);
  });

  it('serves test-client page with HTML content', async () => {
    const res = await fetch('/api/page?client=test-client');
    assert.equal(res.status, 200);
    assert.ok(
      res.headers['content-type'].includes('text/html'),
      `Expected text/html, got ${res.headers['content-type']}`
    );
    assert.ok(res.body.length > 100, 'HTML body should be non-trivial');
    assert.ok(res.body.includes('<!DOCTYPE html'), 'Should contain DOCTYPE');
  });

  it('HTML passes validate-html checks with no errors', async () => {
    const { validateHTML } = await import(path.join(PROJECT_ROOT, 'utils', 'validate-html.mjs'));

    const res = await fetch('/api/page?client=test-client');
    const result = validateHTML(res.body);

    assert.ok(
      result.valid,
      `HTML validation failed with errors:\n${result.errors.map(e => `  [${e.rule}] ${e.message}`).join('\n')}`
    );
  });

  it('takes a screenshot via Playwright and produces a non-zero file', async () => {
    const { chromium } = await import('playwright');

    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`${BASE_URL}/api/page?client=test-client&password=impact2024`, {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });

      // Save screenshot to a temp location
      screenshotPath = path.join(PROJECT_ROOT, 'temporary screenshots', `e2e-test-${Date.now()}.png`);
      fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
      await page.screenshot({ path: screenshotPath, fullPage: true });

      assert.ok(fs.existsSync(screenshotPath), 'Screenshot file should exist');
      const stat = fs.statSync(screenshotPath);
      assert.ok(stat.size > 0, `Screenshot should be non-zero bytes, got ${stat.size}`);
    } finally {
      await browser.close();
    }
  });

});
