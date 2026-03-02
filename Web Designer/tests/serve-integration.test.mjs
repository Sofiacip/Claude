/**
 * Integration tests for serve.mjs — starts the real server process
 * and tests all API routes with actual HTTP requests.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';

// ─── Helpers ────────────────────────────────────────────

// Pick a random port to avoid conflicts
const PORT = 30000 + Math.floor(Math.random() * 10000);

const TEST_PASSWORD = 'impact2024';

function request(urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, `http://localhost:${PORT}`);
    const headers = { ...options.headers };
    // Auto-add auth header unless explicitly set to null
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

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'serve-integ-'));
let serverProcess;

before(async () => {
  // Create test fixtures
  const acme = path.join(tmpDir, 'clients', 'acme-corp', 'output');
  fs.mkdirSync(acme, { recursive: true });
  fs.writeFileSync(path.join(acme, 'index.html'), '<h1>Acme Corp</h1>');

  const beta = path.join(tmpDir, 'clients', 'beta-inc', 'output');
  fs.mkdirSync(beta, { recursive: true });
  fs.writeFileSync(path.join(beta, 'index.html'), '<h1>Beta Inc</h1>');

  // _template and .hidden should be excluded
  const tpl = path.join(tmpDir, 'clients', '_template', 'output');
  fs.mkdirSync(tpl, { recursive: true });
  fs.writeFileSync(path.join(tpl, 'index.html'), '<h1>Template</h1>');

  const hidden = path.join(tmpDir, 'clients', '.secret', 'output');
  fs.mkdirSync(hidden, { recursive: true });
  fs.writeFileSync(path.join(hidden, 'index.html'), '<h1>Secret</h1>');

  // Incomplete client (no output/index.html)
  fs.mkdirSync(path.join(tmpDir, 'clients', 'no-output'), { recursive: true });

  // Static files
  fs.writeFileSync(path.join(tmpDir, 'style.css'), 'body{}');
  fs.writeFileSync(path.join(tmpDir, 'app.js'), 'console.log(1)');

  // Start the REAL serve.mjs
  const serveMjs = path.join(process.cwd(), 'serve.mjs');
  serverProcess = spawn('node', [serveMjs, '--dir', tmpDir], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(PORT), LOG_LEVEL: 'error', MAX_UPLOAD_SIZE: '2048', APP_PASSWORD: TEST_PASSWORD },
  });

  // Poll until the server is reachable
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

// ─── GET /api/health ────────────────────────────────────

describe('GET /api/health', () => {
  it('returns 200 with expected JSON structure', async () => {
    const res = await requestJSON('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.json.status, 'ok');
    assert.equal(typeof res.json.uptime, 'number');
    assert.equal(typeof res.json.clientCount, 'number');
    assert.equal(res.json.clientCount, 2); // acme-corp, beta-inc
    assert.ok(res.json.serveDir);
  });
});

// ─── GET /api/clients ───────────────────────────────────

describe('GET /api/clients', () => {
  it('returns array of valid clients', async () => {
    const res = await requestJSON('/api/clients');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.json));
    assert.ok(res.json.includes('acme-corp'));
    assert.ok(res.json.includes('beta-inc'));
    assert.equal(res.json.length, 2);
  });

  it('excludes _template, hidden, and incomplete clients', async () => {
    const res = await requestJSON('/api/clients');
    assert.ok(!res.json.includes('_template'));
    assert.ok(!res.json.includes('.secret'));
    assert.ok(!res.json.includes('no-output'));
  });
});

// ─── GET /api/page ──────────────────────────────────────

describe('GET /api/page', () => {
  it('returns HTML for valid client', async () => {
    const res = await request('/api/page?client=acme-corp');
    assert.equal(res.status, 200);
    assert.ok(res.headers['content-type'].includes('text/html'));
    assert.equal(res.body, '<h1>Acme Corp</h1>');
  });

  it('returns 400 when client param is missing', async () => {
    const res = await requestJSON('/api/page');
    assert.equal(res.status, 400);
    assert.match(res.json.error, /Missing client/);
  });

  it('returns 404 for nonexistent client', async () => {
    const res = await requestJSON('/api/page?client=nonexistent');
    assert.equal(res.status, 404);
    assert.equal(res.json.error, 'Page not found');
  });

  it('returns 403 or 404 for directory traversal attempt', async () => {
    const res = await requestJSON('/api/page?client=../../etc');
    assert.ok(
      res.status === 403 || res.status === 404,
      `Expected 403 or 404, got ${res.status}`
    );
  });
});

// ─── POST /api/update-text ──────────────────────────────

describe('POST /api/update-text', () => {
  it('applies valid text replacements', async () => {
    const res = await requestJSON('/api/update-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: 'acme-corp',
        replacements: [{ oldText: 'Acme Corp', newText: 'Acme Updated' }],
      }),
    });
    assert.equal(res.status, 200);
    assert.equal(res.json.success, true);
    assert.equal(res.json.applied, 1);

    // Verify change
    const page = await request('/api/page?client=acme-corp');
    assert.ok(page.body.includes('Acme Updated'));

    // Restore
    await requestJSON('/api/update-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: 'acme-corp',
        replacements: [{ oldText: 'Acme Updated', newText: 'Acme Corp' }],
      }),
    });
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await requestJSON('/api/update-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{broken json!!!',
    });
    assert.equal(res.status, 400);
    assert.equal(res.json.error, 'Invalid JSON in request body');
  });

  it('returns 400 for empty body', async () => {
    const res = await requestJSON('/api/update-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '',
    });
    assert.equal(res.status, 400);
    assert.equal(res.json.error, 'Invalid JSON in request body');
  });

  it('returns 400 when replacements is missing', async () => {
    const res = await requestJSON('/api/update-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client: 'acme-corp' }),
    });
    assert.equal(res.status, 400);
    assert.match(res.json.error, /Missing client or replacements/);
  });
});

// ─── POST /api/upload ───────────────────────────────────

describe('POST /api/upload', () => {
  it('uploads a brand file successfully', async () => {
    // PNG magic bytes (89 50 4E 47) followed by test content
    const fileContent = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47]), Buffer.from('test content')]).toString('base64');
    const res = await requestJSON('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: 'acme-corp',
        type: 'brand',
        filename: 'logo.png',
        data: fileContent,
      }),
    });
    assert.equal(res.status, 200);
    assert.equal(res.json.success, true);
    assert.equal(res.json.filename, 'logo.png');
    // Verify file exists on disk
    assert.ok(fs.existsSync(res.json.path));
  });

  it('uploads a copy file successfully', async () => {
    const fileContent = Buffer.from('copy document').toString('base64');
    const res = await requestJSON('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: 'acme-corp',
        type: 'copy',
        filename: 'sales-page.docx',
        data: fileContent,
      }),
    });
    assert.equal(res.status, 200);
    assert.equal(res.json.success, true);
    assert.equal(res.json.filename, 'sales-page.docx');
  });

  it('sanitizes filenames with special characters', async () => {
    const res = await requestJSON('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: 'acme-corp',
        type: 'brand',
        filename: '../../../etc/passwd',
        data: Buffer.from('x').toString('base64'),
      }),
    });
    assert.equal(res.status, 200);
    assert.equal(res.json.filename, '.._.._.._etc_passwd');
    // The sanitizer keeps dots/dashes but the path.join still writes inside the uploads dir
    assert.ok(res.json.path.includes('uploads'));
  });

  it('returns 400 for invalid type', async () => {
    const res = await requestJSON('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: 'acme-corp',
        type: 'malicious',
        filename: 'f.txt',
        data: Buffer.from('x').toString('base64'),
      }),
    });
    assert.equal(res.status, 400);
    assert.match(res.json.error, /Type must be "brand" or "copy"/);
  });

  it('returns 400 for missing required fields', async () => {
    const res = await requestJSON('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client: 'acme-corp' }),
    });
    assert.equal(res.status, 400);
    assert.match(res.json.error, /Missing required fields/);
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await requestJSON('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    assert.equal(res.status, 400);
    assert.equal(res.json.error, 'Invalid JSON in request body');
  });
});

// ─── POST /api/upload — base64 validation ────────────────

describe('POST /api/upload — base64 validation', () => {
  it('returns 400 for invalid base64 string', async () => {
    const res = await requestJSON('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: 'acme-corp',
        type: 'brand',
        filename: 'doc.txt',
        data: '!!!not-base64-at-all***',
      }),
    });
    assert.equal(res.status, 400);
    assert.match(res.json.error, /Invalid base64/);
  });

  it('returns 400 for oversized file with size info', async () => {
    // Server started with MAX_UPLOAD_SIZE=2048 (2KB), send ~3KB decoded
    const oversized = Buffer.alloc(3000, 0x41).toString('base64');
    const res = await requestJSON('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: 'acme-corp',
        type: 'brand',
        filename: 'big-file.txt',
        data: oversized,
      }),
    });
    assert.equal(res.status, 400);
    assert.match(res.json.error, /File too large/);
    assert.match(res.json.error, /MB/);
  });

  it('returns 400 for PNG with wrong magic bytes', async () => {
    const fakePng = Buffer.from('this is not a png').toString('base64');
    const res = await requestJSON('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: 'acme-corp',
        type: 'brand',
        filename: 'bad-image.png',
        data: fakePng,
      }),
    });
    assert.equal(res.status, 400);
    assert.match(res.json.error, /Invalid .png file/);
  });

  it('returns 400 for JPEG with wrong magic bytes', async () => {
    const fakeJpg = Buffer.from('not a jpeg file').toString('base64');
    const res = await requestJSON('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: 'acme-corp',
        type: 'brand',
        filename: 'bad.jpg',
        data: fakeJpg,
      }),
    });
    assert.equal(res.status, 400);
    assert.match(res.json.error, /Invalid .jpg file/);
  });

  it('accepts valid SVG content', async () => {
    const svgData = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>').toString('base64');
    const res = await requestJSON('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: 'acme-corp',
        type: 'brand',
        filename: 'icon.svg',
        data: svgData,
      }),
    });
    assert.equal(res.status, 200);
    assert.equal(res.json.success, true);
  });

  it('returns 400 for SVG with non-SVG content', async () => {
    const fakeSvg = Buffer.from('just some random text').toString('base64');
    const res = await requestJSON('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: 'acme-corp',
        type: 'brand',
        filename: 'fake.svg',
        data: fakeSvg,
      }),
    });
    assert.equal(res.status, 400);
    assert.match(res.json.error, /Invalid .svg file/);
  });

  it('allows non-image files without magic byte checks', async () => {
    const txtData = Buffer.from('plain text content').toString('base64');
    const res = await requestJSON('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: 'acme-corp',
        type: 'copy',
        filename: 'notes.txt',
        data: txtData,
      }),
    });
    assert.equal(res.status, 200);
    assert.equal(res.json.success, true);
  });
});

// ─── POST /api/build ────────────────────────────────────

describe('POST /api/build', () => {
  it('saves build config for valid client', async () => {
    const res = await requestJSON('/api/build', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: 'acme-corp',
        templateUrl: 'https://example.com/template',
        brandUploaded: true,
        copyUploaded: false,
      }),
    });
    assert.equal(res.status, 200);
    assert.equal(res.json.success, true);
    assert.ok(res.json.message.includes('acme-corp'));

    // Verify config file was written
    const configPath = path.join(tmpDir, 'clients', 'acme-corp', 'build-config.json');
    assert.ok(fs.existsSync(configPath));
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assert.equal(config.client, 'acme-corp');
    assert.equal(config.templateUrl, 'https://example.com/template');
    assert.equal(config.brandUploaded, true);
    assert.equal(config.copyUploaded, false);
    assert.ok(config.createdAt);
  });

  it('returns 400 when client is missing', async () => {
    const res = await requestJSON('/api/build', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
    assert.match(res.json.error, /Missing client/);
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await requestJSON('/api/build', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{{invalid',
    });
    assert.equal(res.status, 400);
    assert.equal(res.json.error, 'Invalid JSON in request body');
  });
});

// ─── Directory Traversal ────────────────────────────────

describe('directory traversal prevention', () => {
  it('blocks ../ in static file paths', async () => {
    const res = await request('/../../../etc/passwd');
    assert.ok(
      res.status === 403 || res.status === 404,
      `Expected 403 or 404, got ${res.status}`
    );
  });

  it('blocks encoded traversal', async () => {
    const res = await request('/..%2F..%2Fetc%2Fpasswd');
    assert.ok(
      res.status === 403 || res.status === 404,
      `Expected 403 or 404, got ${res.status}`
    );
  });
});

// ─── Static File Serving / MIME Types ───────────────────

describe('static file serving', () => {
  it('serves .css with text/css', async () => {
    const res = await request('/style.css');
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'text/css');
    assert.equal(res.body, 'body{}');
  });

  it('serves .js with text/javascript', async () => {
    const res = await request('/app.js');
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'text/javascript');
  });

  it('serves index.html for trailing slash', async () => {
    const res = await request('/clients/acme-corp/output/');
    assert.equal(res.status, 200);
    assert.ok(res.body.includes('Acme Corp'));
  });

  it('returns 404 for nonexistent static file', async () => {
    const res = await request('/does-not-exist.txt');
    assert.equal(res.status, 404);
  });
});

// ─── Unknown API Route ──────────────────────────────────

describe('unknown API routes', () => {
  it('returns 404 JSON for unknown API path', async () => {
    const res = await requestJSON('/api/nonexistent');
    assert.equal(res.status, 404);
    assert.match(res.json.error, /API route not found/);
  });

  it('returns 404 for wrong method on existing route', async () => {
    const res = await requestJSON('/api/health', { method: 'POST' });
    assert.equal(res.status, 404);
    assert.match(res.json.error, /API route not found/);
  });
});

// ─── Authentication ─────────────────────────────────────

describe('POST /api/auth', () => {
  it('returns ok for correct password', async () => {
    const res = await requestJSON('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: TEST_PASSWORD }),
      noAuth: true,
    });
    assert.equal(res.status, 200);
    assert.equal(res.json.ok, true);
  });

  it('returns 401 for wrong password', async () => {
    const res = await requestJSON('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'wrong-password' }),
      noAuth: true,
    });
    assert.equal(res.status, 401);
    assert.equal(res.json.error, 'Unauthorized');
  });
});

describe('authentication enforcement', () => {
  it('allows /api/health without auth', async () => {
    const res = await requestJSON('/api/health', { noAuth: true });
    assert.equal(res.status, 200);
    assert.equal(res.json.status, 'ok');
  });

  it('blocks /api/clients without auth', async () => {
    const res = await requestJSON('/api/clients', { noAuth: true });
    assert.equal(res.status, 401);
    assert.equal(res.json.error, 'Unauthorized');
  });

  it('blocks /api/page without auth', async () => {
    const res = await requestJSON('/api/page?client=acme-corp', { noAuth: true });
    assert.equal(res.status, 401);
  });

  it('blocks /api/update-text without auth', async () => {
    const res = await requestJSON('/api/update-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client: 'acme-corp', replacements: [] }),
      noAuth: true,
    });
    assert.equal(res.status, 401);
  });

  it('allows auth via query param (for SSE)', async () => {
    const res = await requestJSON(`/api/clients?password=${TEST_PASSWORD}`, { noAuth: true });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.json));
  });
});
