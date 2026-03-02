/**
 * Integration tests for POST /api/dark-mode endpoint.
 * Starts the real serve.mjs and tests dark mode injection via HTTP.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';

// ─── Helpers ────────────────────────────────────────────

const PORT = 30000 + Math.floor(Math.random() * 10000);
const TEST_PASSWORD = 'impact2024';

function request(urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, `http://localhost:${PORT}`);
    const headers = { ...options.headers };
    if (options.noAuth !== true && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${TEST_PASSWORD}`;
    }
    const req = http.request(url, {
      method: options.method || 'GET',
      headers,
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf-8');
        resolve({ status: res.statusCode, headers: res.headers, body });
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

function requestJSON(urlPath, options = {}) {
  return request(urlPath, options).then(res => ({
    ...res,
    json: JSON.parse(res.body),
  }));
}

// ─── Setup / Teardown ───────────────────────────────────

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dark-mode-api-'));
let serverProcess;

/** Minimal valid HTML page for testing */
function validPage(body = '<section><h1>Hello</h1></section>') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>${body}</body>
</html>`;
}

before(async () => {
  // Client with valid HTML output
  const clientDir = path.join(tmpDir, 'clients', 'test-brand', 'output');
  fs.mkdirSync(clientDir, { recursive: true });
  fs.writeFileSync(path.join(clientDir, 'index.html'), validPage());

  // Client with page that already has dark mode
  const dmClient = path.join(tmpDir, 'clients', 'already-dark', 'output');
  fs.mkdirSync(dmClient, { recursive: true });
  fs.writeFileSync(path.join(dmClient, 'index.html'), validPage(
    '<style>@media (prefers-color-scheme: dark) { body { background: #000; } }</style><section>Content</section>'
  ));

  // Start the real serve.mjs
  const serveMjs = path.join(process.cwd(), 'serve.mjs');
  serverProcess = spawn('node', [serveMjs, '--dir', tmpDir], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(PORT), LOG_LEVEL: 'error', APP_PASSWORD: TEST_PASSWORD },
  });

  await new Promise((resolve, reject) => {
    const deadline = Date.now() + 8000;
    serverProcess.on('error', reject);
    serverProcess.on('exit', (code) => reject(new Error(`Server exited with code ${code}`)));

    const tryConnect = () => {
      if (Date.now() > deadline) { reject(new Error('Server start timeout')); return; }
      const req = http.get(`http://localhost:${PORT}/api/health`, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => setTimeout(tryConnect, 100));
      req.end();
    };
    setTimeout(tryConnect, 200);
  });
});

after(() => {
  if (serverProcess) serverProcess.kill('SIGTERM');
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ─── Tests ──────────────────────────────────────────────

describe('POST /api/dark-mode', () => {
  it('injects dark mode into a valid page', async () => {
    const res = await requestJSON('/api/dark-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: 'test-brand',
        colors: { primary: '#8B1A3A', background: '#FAF5EE', text: '#2C2C2C' },
      }),
    });
    assert.equal(res.status, 200);
    assert.equal(res.json.success, true);
    assert.ok(res.json.description);
    assert.ok(res.json.darkColors);
    assert.ok(res.json.darkColors.primary);

    // Verify the file was actually modified
    const page = await request('/api/page?client=test-brand');
    assert.ok(page.body.includes('prefers-color-scheme: dark'), 'Should contain dark mode media query');
    assert.ok(page.body.includes('theme-toggle'), 'Should contain toggle button');
    assert.ok(page.body.includes('dark-mode-theme'), 'Should contain theme style block');
  });

  it('returns success=false when page already has dark mode', async () => {
    const res = await requestJSON('/api/dark-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: 'already-dark',
        colors: { primary: '#8B1A3A' },
      }),
    });
    assert.equal(res.status, 200);
    assert.equal(res.json.success, false);
    assert.ok(res.json.message.includes('already'));
  });

  it('returns success=false when no colors provided', async () => {
    const res = await requestJSON('/api/dark-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client: 'already-dark' }),
    });
    assert.equal(res.status, 200);
    assert.equal(res.json.success, false);
  });

  it('returns 400 when client is missing', async () => {
    const res = await requestJSON('/api/dark-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ colors: { primary: '#FF0000' } }),
    });
    assert.equal(res.status, 400);
    assert.match(res.json.error, /Missing client/);
  });

  it('returns 404 for nonexistent client', async () => {
    const res = await requestJSON('/api/dark-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client: 'nonexistent', colors: { primary: '#FF0000' } }),
    });
    assert.equal(res.status, 404);
    assert.equal(res.json.error, 'Page not found');
  });

  it('returns 400 for invalid JSON', async () => {
    const res = await requestJSON('/api/dark-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    assert.equal(res.status, 400);
    assert.equal(res.json.error, 'Invalid JSON in request body');
  });

  it('requires authentication', async () => {
    const res = await requestJSON('/api/dark-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client: 'test-brand', colors: { primary: '#FF0000' } }),
      noAuth: true,
    });
    assert.equal(res.status, 401);
    assert.equal(res.json.error, 'Unauthorized');
  });
});

describe('POST /api/build — darkMode flag', () => {
  it('includes darkMode in build config when set to true', async () => {
    const res = await requestJSON('/api/build', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: 'test-brand',
        darkMode: true,
      }),
    });
    assert.equal(res.status, 200);
    assert.equal(res.json.success, true);

    const configPath = path.join(tmpDir, 'clients', 'test-brand', 'build-config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assert.equal(config.darkMode, true);
  });

  it('defaults darkMode to false when not provided', async () => {
    const res = await requestJSON('/api/build', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: 'test-brand',
      }),
    });
    assert.equal(res.status, 200);

    const configPath = path.join(tmpDir, 'clients', 'test-brand', 'build-config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assert.equal(config.darkMode, false);
  });
});
