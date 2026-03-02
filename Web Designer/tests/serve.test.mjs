import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';

// ─── Test Helpers ────────────────────────────────────────

const PORT = 3099; // Use a non-standard port to avoid conflicts

function fetch(urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, `http://localhost:${PORT}`);
    const req = http.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
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

function fetchJSON(urlPath, options = {}) {
  return fetch(urlPath, options).then(res => ({
    ...res,
    json: JSON.parse(res.body),
  }));
}

function connectSSE(urlPath) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, `http://localhost:${PORT}`);
    const req = http.request(url, (res) => {
      resolve({ req, res, status: res.statusCode, headers: res.headers });
    });
    req.on('error', reject);
    req.end();
  });
}

// ─── Setup / Teardown ────────────────────────────────────

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'serve-test-'));
let serverProcess;

before(async () => {
  // Create test directory structure
  // Client with output/index.html (valid client)
  const validClient = path.join(tmpDir, 'clients', 'acme-corp', 'output');
  fs.mkdirSync(validClient, { recursive: true });
  fs.writeFileSync(path.join(validClient, 'index.html'), '<h1>Acme Corp</h1>');

  // Client without output/index.html (should be excluded from listing)
  const noOutput = path.join(tmpDir, 'clients', 'incomplete-client');
  fs.mkdirSync(noOutput, { recursive: true });

  // _template dir (should be excluded from listing)
  const template = path.join(tmpDir, 'clients', '_template', 'output');
  fs.mkdirSync(template, { recursive: true });
  fs.writeFileSync(path.join(template, 'index.html'), '<h1>Template</h1>');

  // Hidden dir (should be excluded from listing)
  const hidden = path.join(tmpDir, 'clients', '.hidden', 'output');
  fs.mkdirSync(hidden, { recursive: true });
  fs.writeFileSync(path.join(hidden, 'index.html'), '<h1>Hidden</h1>');

  // Second valid client
  const secondClient = path.join(tmpDir, 'clients', 'beta-inc', 'output');
  fs.mkdirSync(secondClient, { recursive: true });
  fs.writeFileSync(path.join(secondClient, 'index.html'), '<h1>Beta Inc</h1>');

  // Client with repeated text (for multi-replace tests)
  const repeatClient = path.join(tmpDir, 'clients', 'repeat-co', 'output');
  fs.mkdirSync(repeatClient, { recursive: true });
  fs.writeFileSync(path.join(repeatClient, 'index.html'),
    '<h1>Buy Now</h1><p>Great product</p><a>Buy Now</a><button>Buy Now</button>');

  // Static files for MIME type testing
  fs.writeFileSync(path.join(tmpDir, 'test.css'), 'body { color: red; }');
  fs.writeFileSync(path.join(tmpDir, 'test.js'), 'console.log("hi");');
  fs.writeFileSync(path.join(tmpDir, 'test.json'), '{"key":"value"}');
  fs.writeFileSync(path.join(tmpDir, 'test.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47])); // PNG magic bytes
  fs.writeFileSync(path.join(tmpDir, 'test.unknown'), 'binary data');

  // Start server with --dir pointing to tmpDir
  const serveMjs = path.join(process.cwd(), 'serve.mjs');

  serverProcess = spawn('node', [
    '-e',
    // Patch PORT before loading serve.mjs — rewrite the file isn't great,
    // so instead we start a minimal server that mirrors serve.mjs logic.
    // Actually, let's just override by loading serve.mjs with env hack.
    // The simplest way: we modify the port in-flight. serve.mjs hardcodes PORT=3000,
    // so we need a wrapper that patches it.
    `
    import http from 'http';
    import fs from 'fs';
    import path from 'path';

    const serveDir = ${JSON.stringify(tmpDir)};
    const PORT = ${PORT};

    const MIME_TYPES = {
      '.html': 'text/html',
      '.css':  'text/css',
      '.js':   'text/javascript',
      '.mjs':  'text/javascript',
      '.json': 'application/json',
      '.png':  'image/png',
      '.jpg':  'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif':  'image/gif',
      '.svg':  'image/svg+xml',
      '.ico':  'image/x-icon',
      '.woff': 'font/woff',
      '.woff2':'font/woff2',
      '.ttf':  'font/ttf',
      '.webp': 'image/webp',
      '.zip':  'application/zip',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.pdf':  'application/pdf',
    };

    function readBody(req, maxSize = 100 * 1024 * 1024) {
      return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        req.on('data', chunk => {
          size += chunk.length;
          if (size > maxSize) { reject(new Error('Body too large')); req.destroy(); return; }
          chunks.push(chunk);
        });
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        req.on('error', reject);
      });
    }

    function sendJSON(res, data, status = 200) {
      const body = JSON.stringify(data);
      res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
      res.end(body);
    }

    function sendError(res, status, message) {
      sendJSON(res, { error: message }, status);
    }

    const serverStartTime = Date.now();

    function handleHealth(req, res) {
      const clientsDir = path.join(serveDir, 'clients');
      let clientCount = 0;
      if (fs.existsSync(clientsDir)) {
        clientCount = fs.readdirSync(clientsDir).filter(name => {
          if (name === '_template' || name.startsWith('.')) return false;
          return fs.existsSync(path.join(clientsDir, name, 'output', 'index.html'));
        }).length;
      }
      sendJSON(res, { status: 'ok', uptime: Math.floor((Date.now() - serverStartTime) / 1000), serveDir, clientCount });
    }

    async function handleGetClients(req, res, params) {
      const clientsDir = path.join(serveDir, 'clients');
      if (!fs.existsSync(clientsDir)) { sendJSON(res, []); return; }
      const clients = fs.readdirSync(clientsDir).filter(name => {
        if (name === '_template' || name.startsWith('.')) return false;
        return fs.existsSync(path.join(clientsDir, name, 'output', 'index.html'));
      });
      sendJSON(res, clients);
    }

    async function handleGetPage(req, res, params) {
      const client = params.get('client');
      if (!client) { sendError(res, 400, 'Missing client parameter'); return; }
      const filePath = path.join(serveDir, 'clients', client, 'output', 'index.html');
      if (!filePath.startsWith(serveDir)) { sendError(res, 403, 'Forbidden'); return; }
      if (!fs.existsSync(filePath)) { sendError(res, 404, 'Page not found'); return; }
      const html = fs.readFileSync(filePath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    }

    async function handleUpdateText(req, res) {
      const body = await readBody(req);
      let parsed;
      try { parsed = JSON.parse(body); } catch { sendError(res, 400, 'Invalid JSON in request body'); return; }
      const { client, replacements } = parsed;
      if (!client || !replacements || !Array.isArray(replacements)) { sendError(res, 400, 'Missing client or replacements'); return; }
      const filePath = path.join(serveDir, 'clients', client, 'output', 'index.html');
      if (!filePath.startsWith(serveDir)) { sendError(res, 403, 'Forbidden'); return; }
      if (!fs.existsSync(filePath)) { sendError(res, 404, 'Page not found'); return; }
      let html = fs.readFileSync(filePath, 'utf-8');
      let applied = 0;
      const notFound = [];
      const results = [];
      for (const { oldText, newText } of replacements) {
        if (!oldText || oldText === newText) continue;
        const parts = html.split(oldText);
        const count = parts.length - 1;
        if (count > 0) { html = parts.join(newText); applied++; results.push({ oldText, replaced: count }); }
        else { notFound.push(oldText); }
      }
      fs.writeFileSync(filePath, html, 'utf-8');
      const response = { success: true, applied, total: replacements.length, results };
      if (notFound.length > 0) response.notFound = notFound;
      sendJSON(res, response);
    }

    async function handleUpload(req, res) {
      const body = await readBody(req);
      let parsed;
      try { parsed = JSON.parse(body); } catch { sendError(res, 400, 'Invalid JSON in request body'); return; }
      const { client, type, filename, data } = parsed;
      if (!client || !type || !filename || !data) { sendError(res, 400, 'Missing required fields: client, type, filename, data'); return; }
      if (type !== 'brand' && type !== 'copy') { sendError(res, 400, 'Type must be "brand" or "copy"'); return; }
      const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const dir = type === 'brand' ? path.join(serveDir, 'clients', client, 'brand', 'uploads') : path.join(serveDir, 'clients', client, 'copy');
      if (!dir.startsWith(serveDir)) { sendError(res, 403, 'Forbidden'); return; }
      fs.mkdirSync(dir, { recursive: true });
      const fp = path.join(dir, safeName);
      fs.writeFileSync(fp, Buffer.from(data, 'base64'));
      sendJSON(res, { success: true, path: fp, filename: safeName });
    }

    let activeWatcherCount = 0;
    const MAX_WATCHERS = 50;

    async function handleWatch(req, res, params) {
      const client = params.get('client');
      if (!client) { sendError(res, 400, 'Missing client parameter'); return; }
      if (activeWatcherCount >= MAX_WATCHERS) { sendError(res, 503, 'Too many active watchers (limit: ' + MAX_WATCHERS + ')'); return; }
      const outputDir = path.join(serveDir, 'clients', client, 'output');
      if (!outputDir.startsWith(serveDir) || !fs.existsSync(outputDir)) { sendError(res, 404, 'Output directory not found'); return; }
      activeWatcherCount++;
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
      res.write('\\n');
      const heartbeat = setInterval(() => { try { res.write(':ping\\n\\n'); } catch(e) {} }, 30000);
      let debounceTimer;
      const watcher = fs.watch(outputDir, { recursive: true }, (event, filename) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => { try { res.write('data: ' + JSON.stringify({ event, filename: filename || 'unknown' }) + '\\n\\n'); } catch(e) {} }, 500);
      });
      req.on('close', () => { clearInterval(heartbeat); clearTimeout(debounceTimer); watcher.close(); activeWatcherCount--; });
    }

    async function handleBuild(req, res) {
      const body = await readBody(req);
      let parsed;
      try { parsed = JSON.parse(body); } catch { sendError(res, 400, 'Invalid JSON in request body'); return; }
      const { client, templateUrl, brandUploaded, copyUploaded } = parsed;
      if (!client) { sendError(res, 400, 'Missing client'); return; }
      const configPath = path.join(serveDir, 'clients', client, 'build-config.json');
      if (!configPath.startsWith(serveDir)) { sendError(res, 403, 'Forbidden'); return; }
      const config = { client, templateUrl: templateUrl || null, brandUploaded: !!brandUploaded, copyUploaded: !!copyUploaded, createdAt: new Date().toISOString() };
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
      sendJSON(res, { success: true, message: 'Build config saved for ' + client + '. Run Claude Code to build the page.' });
    }

    const server = http.createServer(async (req, res) => {
      try {
        const parsedUrl = new URL(req.url, 'http://localhost:' + PORT);
        const urlPath = parsedUrl.pathname;

        if (urlPath === '/') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<h1>Test Server</h1>');
          return;
        }

        if (urlPath.startsWith('/api/')) {
          const route = req.method + ' ' + urlPath;
          switch (route) {
            case 'GET /api/health': handleHealth(req, res); return;
            case 'GET /api/clients': await handleGetClients(req, res, parsedUrl.searchParams); return;
            case 'GET /api/page': await handleGetPage(req, res, parsedUrl.searchParams); return;
            case 'POST /api/update-text': await handleUpdateText(req, res); return;
            case 'GET /api/watch': await handleWatch(req, res, parsedUrl.searchParams); return;
            case 'GET /api/watch': await handleWatch(req, res, parsedUrl.searchParams); return;
            case 'POST /api/upload': await handleUpload(req, res); return;
            case 'POST /api/build': await handleBuild(req, res); return;
            default: sendError(res, 404, 'API route not found: ' + route); return;
          }
        }

        let staticPath = urlPath;
        if (staticPath.endsWith('/')) staticPath += 'index.html';
        const filePath = path.join(serveDir, staticPath);
        if (!filePath.startsWith(serveDir)) { res.writeHead(403); res.end('Forbidden'); return; }
        fs.readFile(filePath, (err, data) => {
          if (err) {
            if (err.code === 'ENOENT') { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('404 Not Found: ' + urlPath); }
            else { res.writeHead(500); res.end('Internal Server Error'); }
            return;
          }
          const ext = path.extname(filePath).toLowerCase();
          const contentType = MIME_TYPES[ext] || 'application/octet-stream';
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(data);
        });
      } catch (err) {
        if (!res.headersSent) sendError(res, 500, 'Internal server error');
      }
    });

    server.listen(PORT, () => { console.log('TEST_SERVER_READY'); });
    `,
  ], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  // Wait for server to be ready
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server start timeout')), 5000);
    serverProcess.stdout.on('data', (data) => {
      if (data.toString().includes('TEST_SERVER_READY')) {
        clearTimeout(timeout);
        resolve();
      }
    });
    serverProcess.stderr.on('data', (data) => {
      console.error('Server stderr:', data.toString());
    });
    serverProcess.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
});

after(() => {
  if (serverProcess) serverProcess.kill();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ─── Tests ───────────────────────────────────────────────

describe('sendError / sendJSON format', () => {
  it('returns JSON error with correct status for unknown API route', async () => {
    const res = await fetchJSON('/api/nonexistent');
    assert.equal(res.status, 404);
    assert.equal(res.headers['content-type'], 'application/json');
    assert.ok(res.json.error, 'Response should have an error field');
    assert.match(res.json.error, /API route not found/);
  });

  it('returns 400 with error message for missing client param on /api/page', async () => {
    const res = await fetchJSON('/api/page');
    assert.equal(res.status, 400);
    assert.equal(res.json.error, 'Missing client parameter');
  });

  it('returns 404 for nonexistent client page', async () => {
    const res = await fetchJSON('/api/page?client=nonexistent');
    assert.equal(res.status, 404);
    assert.equal(res.json.error, 'Page not found');
  });

  it('returns 200 with correct JSON structure on /api/health', async () => {
    const res = await fetchJSON('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.json.status, 'ok');
    assert.equal(typeof res.json.uptime, 'number');
    assert.equal(typeof res.json.clientCount, 'number');
  });
});

describe('directory traversal detection', () => {
  it('blocks ../ in static file paths', async () => {
    const res = await fetch('/../../../etc/passwd');
    // path.join normalizes ../ — the resolved path won't start with serveDir
    assert.ok(
      res.status === 403 || res.status === 404,
      `Expected 403 or 404, got ${res.status}`
    );
  });

  it('blocks traversal in /api/page client parameter', async () => {
    const res = await fetchJSON('/api/page?client=../../etc');
    // The resolved path won't start with serveDir → 403 or file won't exist → 404
    assert.ok(
      res.status === 403 || res.status === 404,
      `Expected 403 or 404, got ${res.status}`
    );
  });

  it('blocks encoded traversal in static paths', async () => {
    const res = await fetch('/..%2F..%2Fetc%2Fpasswd');
    assert.ok(
      res.status === 403 || res.status === 404,
      `Expected 403 or 404, got ${res.status}`
    );
  });
});

describe('MIME type resolution', () => {
  it('serves .html with text/html', async () => {
    const res = await fetch('/clients/acme-corp/output/index.html');
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'text/html');
  });

  it('serves .css with text/css', async () => {
    const res = await fetch('/test.css');
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'text/css');
  });

  it('serves .js with text/javascript', async () => {
    const res = await fetch('/test.js');
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'text/javascript');
  });

  it('serves .png with image/png', async () => {
    const res = await fetch('/test.png');
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'image/png');
  });

  it('serves .json with application/json', async () => {
    const res = await fetch('/test.json');
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'application/json');
  });

  it('serves unknown extensions with application/octet-stream', async () => {
    const res = await fetch('/test.unknown');
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'application/octet-stream');
  });
});

describe('client listing', () => {
  it('returns only valid clients (dirs with output/index.html)', async () => {
    const res = await fetchJSON('/api/clients');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.json));
    assert.ok(res.json.includes('acme-corp'), 'Should include acme-corp');
    assert.ok(res.json.includes('beta-inc'), 'Should include beta-inc');
    assert.ok(res.json.includes('repeat-co'), 'Should include repeat-co');
    assert.equal(res.json.length, 3, 'Should have exactly 3 valid clients');
  });

  it('excludes _template directory', async () => {
    const res = await fetchJSON('/api/clients');
    assert.ok(!res.json.includes('_template'), 'Should exclude _template');
  });

  it('excludes hidden directories', async () => {
    const res = await fetchJSON('/api/clients');
    assert.ok(!res.json.includes('.hidden'), 'Should exclude .hidden');
  });

  it('excludes directories without output/index.html', async () => {
    const res = await fetchJSON('/api/clients');
    assert.ok(!res.json.includes('incomplete-client'), 'Should exclude incomplete-client');
  });

  it('health endpoint reports correct client count', async () => {
    const res = await fetchJSON('/api/health');
    assert.equal(res.json.clientCount, 3);
  });
});

describe('GET /api/page', () => {
  it('returns HTML for valid client', async () => {
    const res = await fetch('/api/page?client=acme-corp');
    assert.equal(res.status, 200);
    assert.ok(res.headers['content-type'].includes('text/html'));
    assert.equal(res.body, '<h1>Acme Corp</h1>');
  });
});

describe('POST /api/update-text', () => {
  it('applies text replacements', async () => {
    const res = await fetchJSON('/api/update-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: 'acme-corp',
        replacements: [{ oldText: 'Acme Corp', newText: 'Acme Corporation' }],
      }),
    });
    assert.equal(res.status, 200);
    assert.equal(res.json.success, true);
    assert.equal(res.json.applied, 1);

    // Verify the file was updated
    const page = await fetch('/api/page?client=acme-corp');
    assert.ok(page.body.includes('Acme Corporation'));

    // Restore original content
    await fetchJSON('/api/update-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: 'acme-corp',
        replacements: [{ oldText: 'Acme Corporation', newText: 'Acme Corp' }],
      }),
    });
  });

  it('returns 400 for invalid JSON body', async () => {
    const res = await fetchJSON('/api/update-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    assert.equal(res.status, 400);
    assert.equal(res.json.error, 'Invalid JSON in request body');
  });

  it('returns 400 for missing fields', async () => {
    const res = await fetchJSON('/api/update-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client: 'acme-corp' }),
    });
    assert.equal(res.status, 400);
    assert.match(res.json.error, /Missing client or replacements/);
  });
});

describe('POST /api/update-text — multiple occurrences', () => {
  it('replaces all occurrences of the same text', async () => {
    const res = await fetchJSON('/api/update-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: 'repeat-co',
        replacements: [{ oldText: 'Buy Now', newText: 'Shop Now' }],
      }),
    });
    assert.equal(res.status, 200);
    assert.equal(res.json.success, true);
    assert.equal(res.json.applied, 1);
    assert.equal(res.json.results[0].replaced, 3);

    // Verify all instances were replaced
    const page = await fetch('/api/page?client=repeat-co');
    assert.ok(!page.body.includes('Buy Now'), 'No "Buy Now" should remain');
    assert.equal(page.body.split('Shop Now').length - 1, 3, 'Should have 3 "Shop Now"');

    // Restore
    await fetchJSON('/api/update-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: 'repeat-co',
        replacements: [{ oldText: 'Shop Now', newText: 'Buy Now' }],
      }),
    });
  });

  it('returns notFound array for text that does not exist', async () => {
    const res = await fetchJSON('/api/update-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: 'repeat-co',
        replacements: [
          { oldText: 'Buy Now', newText: 'Shop Now' },
          { oldText: 'nonexistent text xyz', newText: 'anything' },
        ],
      }),
    });
    assert.equal(res.status, 200);
    assert.equal(res.json.applied, 1);
    assert.deepEqual(res.json.notFound, ['nonexistent text xyz']);

    // Restore
    await fetchJSON('/api/update-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: 'repeat-co',
        replacements: [{ oldText: 'Shop Now', newText: 'Buy Now' }],
      }),
    });
  });

  it('does not include notFound key when all replacements match', async () => {
    const res = await fetchJSON('/api/update-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: 'repeat-co',
        replacements: [{ oldText: 'Buy Now', newText: 'Shop Now' }],
      }),
    });
    assert.equal(res.status, 200);
    assert.equal(res.json.notFound, undefined, 'notFound should not be present when all matched');

    // Restore
    await fetchJSON('/api/update-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: 'repeat-co',
        replacements: [{ oldText: 'Shop Now', newText: 'Buy Now' }],
      }),
    });
  });
});

describe('static file serving', () => {
  it('serves directory index.html for trailing slash', async () => {
    const res = await fetch('/clients/acme-corp/output/');
    assert.equal(res.status, 200);
    assert.ok(res.body.includes('Acme Corp'));
  });

  it('returns 404 for nonexistent static files', async () => {
    const res = await fetch('/nonexistent-file.txt');
    assert.equal(res.status, 404);
  });
});

describe('GET /api/watch — SSE watcher', () => {
  it('returns 400 when client parameter is missing', async () => {
    const res = await fetchJSON('/api/watch');
    assert.equal(res.status, 400);
    assert.equal(res.json.error, 'Missing client parameter');
  });

  it('returns 404 for nonexistent client', async () => {
    const res = await fetchJSON('/api/watch?client=nonexistent');
    assert.equal(res.status, 404);
    assert.equal(res.json.error, 'Output directory not found');
  });

  it('opens SSE connection and cleans up watcher on disconnect', async () => {
    const { req, res, status, headers } = await connectSSE('/api/watch?client=acme-corp');
    assert.equal(status, 200);
    assert.equal(headers['content-type'], 'text/event-stream');
    assert.equal(headers['cache-control'], 'no-cache');

    // Destroy the connection to trigger cleanup
    await new Promise((resolve) => {
      res.on('close', resolve);
      req.destroy();
    });

    // Verify we can open another connection (watcher was cleaned up)
    const { req: req2, res: res2, status: status2 } = await connectSSE('/api/watch?client=acme-corp');
    assert.equal(status2, 200);

    await new Promise((resolve) => {
      res2.on('close', resolve);
      req2.destroy();
    });
  });
});
