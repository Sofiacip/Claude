import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';
import { GeminiBuilder } from './gemini-builder.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const eq = line.indexOf('=');
    if (eq > 0 && !line.trimStart().startsWith('#')) {
      process.env[line.substring(0, eq).trim()] = line.substring(eq + 1).trim();
    }
  }
}

// Parse --dir argument
const dirArgIndex = process.argv.indexOf('--dir');
const serveDir = dirArgIndex !== -1
  ? path.resolve(process.argv[dirArgIndex + 1])
  : path.resolve(__dirname);

const PORT = process.env.PORT || 3000;
const APP_PASSWORD = process.env.APP_PASSWORD || '';

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

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp']);
const FONT_EXTS = new Set(['.woff2', '.ttf', '.otf', '.woff']);

// ─── Helpers ────────────────────────────────────────────

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

// ─── Auth ───────────────────────────────────────────────

function checkAuth(req, res) {
  if (!APP_PASSWORD) return true;
  const auth = req.headers.authorization;
  if (auth === `Bearer ${APP_PASSWORD}`) return true;
  // Also accept password in JSON body (handled per-route) or query param
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.searchParams.get('password') === APP_PASSWORD) return true;
  sendError(res, 401, 'Unauthorized');
  return false;
}

// ─── API Handlers ───────────────────────────────────────

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

async function handleGetClients(req, res) {
  const clientsDir = path.join(serveDir, 'clients');
  if (!fs.existsSync(clientsDir)) { sendJSON(res, []); return; }
  const clients = fs.readdirSync(clientsDir)
    .filter(name => {
      if (name === '_template' || name.startsWith('.') || name === 'README.md') return false;
      const cDir = path.join(clientsDir, name);
      return fs.statSync(cDir).isDirectory();
    })
    .map(name => {
      const cDir = path.join(clientsDir, name);
      const hasOutput = fs.existsSync(path.join(cDir, 'output', 'index.html'));
      const hasBrand = fs.existsSync(path.join(cDir, 'brand', 'brand.md'));
      const hasCopy = fs.existsSync(path.join(cDir, 'copy')) &&
        fs.readdirSync(path.join(cDir, 'copy')).length > 0;
      return { name, hasOutput, hasBrand, hasCopy };
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

// ─── Brand ZIP Extraction ───────────────────────────────

function extractBrandZip(zipPath, clientDir) {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  const extracted = [];

  const brandDir = path.join(clientDir, 'brand');
  const assetsDir = path.join(brandDir, 'assets');

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    const entryName = entry.entryName;
    // Normalize: strip the top-level folder (e.g. "pattie-ehsaei-brand/")
    const parts = entryName.split('/');
    // If the zip has a single root folder, strip it
    const relativePath = parts.length > 1 ? parts.slice(1).join('/') : parts[0];
    if (!relativePath) continue;

    const lowerPath = relativePath.toLowerCase();
    const fileName = path.basename(relativePath);
    const ext = path.extname(fileName).toLowerCase();
    let destPath = null;

    if (lowerPath === 'brand_guide.md' || lowerPath === 'brand-guide.md') {
      destPath = path.join(brandDir, 'brand.md');
    } else if (lowerPath === 'brand-guide.json') {
      destPath = path.join(brandDir, 'brand-guide.json');
    } else if (lowerPath === 'assets/colors.md') {
      destPath = path.join(assetsDir, 'colors.md');
    } else if (lowerPath === 'testimonials.json') {
      destPath = path.join(brandDir, 'testimonials.json');
    } else if (lowerPath === 'testimonials.md') {
      destPath = path.join(brandDir, 'testimonials.md');
    } else if (lowerPath.startsWith('assets/logos/') && IMAGE_EXTS.has(ext)) {
      destPath = path.join(assetsDir, 'logos', fileName);
    } else if (lowerPath.startsWith('assets/photos/people/') && IMAGE_EXTS.has(ext)) {
      destPath = path.join(assetsDir, 'photos', 'people', fileName);
    } else if (lowerPath.startsWith('assets/photos/other/') && IMAGE_EXTS.has(ext)) {
      destPath = path.join(assetsDir, 'photos', 'other', fileName);
    } else if (lowerPath.startsWith('assets/photos/') && IMAGE_EXTS.has(ext)) {
      // Photos not in people/ or other/ subfolder — put in photos root
      destPath = path.join(assetsDir, 'photos', fileName);
    } else if (lowerPath.startsWith('assets/fonts/') && FONT_EXTS.has(ext)) {
      destPath = path.join(assetsDir, 'fonts', fileName);
    } else if (lowerPath.startsWith('assets/uploads/')) {
      destPath = path.join(assetsDir, 'uploads', fileName);
    } else if (lowerPath.startsWith('brand-assets/')) {
      // Brand Creator format: brand-assets/[subfolder]/[file]
      const brandAssetRel = relativePath.replace(/^brand-assets\//, '');
      if (brandAssetRel) {
        destPath = path.join(assetsDir, brandAssetRel);
      }
    } else {
      // Fallback: preserve relative structure under brand/
      destPath = path.join(brandDir, relativePath);
    }

    if (destPath) {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(destPath, entry.getData());
      extracted.push(destPath.replace(clientDir + '/', ''));
    }
  }

  return extracted;
}

// ─── Upload Handler ─────────────────────────────────────

async function handleUpload(req, res) {
  const body = await readBody(req);
  let parsed;
  try { parsed = JSON.parse(body); } catch { sendError(res, 400, 'Invalid JSON in request body'); return; }

  const { client, type } = parsed;
  if (!client || !type) { sendError(res, 400, 'Missing required fields: client, type'); return; }
  if (type !== 'brand' && type !== 'copy') { sendError(res, 400, 'Type must be "brand" or "copy"'); return; }

  const clientDir = path.join(serveDir, 'clients', client);
  if (!clientDir.startsWith(serveDir)) { sendError(res, 403, 'Forbidden'); return; }

  // ── Multi-file copy upload ──
  if (type === 'copy' && parsed.files && Array.isArray(parsed.files)) {
    const copyDir = path.join(clientDir, 'copy');
    fs.mkdirSync(copyDir, { recursive: true });
    const saved = [];
    for (const fileObj of parsed.files) {
      const safeName = fileObj.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const fp = path.join(copyDir, safeName);
      fs.writeFileSync(fp, Buffer.from(fileObj.data, 'base64'));
      saved.push(safeName);
    }
    sendJSON(res, { success: true, files: saved, count: saved.length });
    return;
  }

  // ── Single-file upload (backwards compatible) ──
  const { filename, data } = parsed;
  if (!filename || !data) { sendError(res, 400, 'Missing required fields: filename, data'); return; }
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

  if (type === 'brand' && safeName.toLowerCase().endsWith('.zip')) {
    // Save raw ZIP
    const uploadsDir = path.join(clientDir, 'brand', 'uploads');
    fs.mkdirSync(uploadsDir, { recursive: true });
    const zipPath = path.join(uploadsDir, safeName);
    fs.writeFileSync(zipPath, Buffer.from(data, 'base64'));

    // Extract and map brand assets
    try {
      const extracted = extractBrandZip(zipPath, clientDir);
      sendJSON(res, { success: true, path: zipPath, filename: safeName, extracted, extractedCount: extracted.length });
    } catch (err) {
      sendJSON(res, { success: true, path: zipPath, filename: safeName, extractionError: err.message, extracted: [] });
    }
    return;
  }

  // Default: save single file
  const dir = type === 'brand'
    ? path.join(clientDir, 'brand', 'uploads')
    : path.join(clientDir, 'copy');
  fs.mkdirSync(dir, { recursive: true });
  const fp = path.join(dir, safeName);
  fs.writeFileSync(fp, Buffer.from(data, 'base64'));
  sendJSON(res, { success: true, path: fp, filename: safeName });
}

// ─── Build Handler (Gemini-powered) ─────────────────────

const activeBuilds = new Map(); // client → { status, listeners[] }

async function handleBuild(req, res) {
  const body = await readBody(req);
  let parsed;
  try { parsed = JSON.parse(body); } catch { sendError(res, 400, 'Invalid JSON in request body'); return; }
  const { client, referenceUrl } = parsed;
  if (!client) { sendError(res, 400, 'Missing client'); return; }
  if (!referenceUrl) { sendError(res, 400, 'Missing referenceUrl'); return; }

  const clientDir = path.join(serveDir, 'clients', client);
  if (!clientDir.startsWith(serveDir)) { sendError(res, 403, 'Forbidden'); return; }
  if (!fs.existsSync(path.join(clientDir, 'brand', 'brand.md'))) {
    sendError(res, 400, 'No brand guide found. Upload a brand ZIP first.'); return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) { sendError(res, 500, 'GEMINI_API_KEY not configured'); return; }

  // Prevent duplicate builds
  if (activeBuilds.has(client)) {
    sendError(res, 409, 'Build already in progress for this client'); return;
  }

  // Save build config
  const configPath = path.join(clientDir, 'build-config.json');
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify({ client, referenceUrl, createdAt: new Date().toISOString() }, null, 2));

  // Start build in background, respond immediately
  const buildState = { status: 'running', listeners: [], events: [] };
  activeBuilds.set(client, buildState);

  const emitBuildEvent = (data) => {
    const event = { ...data, timestamp: Date.now() };
    buildState.events.push(event);
    for (const listener of buildState.listeners) {
      try { listener.write(`data: ${JSON.stringify(event)}\n\n`); } catch (e) {}
    }
  };

  sendJSON(res, { success: true, message: 'Build started', client, referenceUrl });

  // Run Gemini pipeline
  const builder = new GeminiBuilder(apiKey, {
    onProgress: (msg) => {
      console.log(`[build:${client}] [${msg.type}] ${msg.message || ''}`);
      emitBuildEvent(msg);
    },
  });

  try {
    const result = await builder.build(clientDir, referenceUrl);
    emitBuildEvent({ type: 'done', message: 'Build complete', outputPath: result.outputPath, duration: result.duration });
    buildState.status = 'done';
  } catch (err) {
    console.error(`[build:${client}] Error:`, err);
    emitBuildEvent({ type: 'error', message: err.message });
    buildState.status = 'error';
  } finally {
    // Close all SSE listeners
    for (const listener of buildState.listeners) {
      try { listener.end(); } catch (e) {}
    }
    // Clean up after 5 min
    setTimeout(() => activeBuilds.delete(client), 300000);
  }
}

// SSE endpoint for build progress
async function handleBuildProgress(req, res, params) {
  const client = params.get('client');
  if (!client) { sendError(res, 400, 'Missing client parameter'); return; }

  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
  res.write('\n');

  const buildState = activeBuilds.get(client);
  if (!buildState) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'No active build for this client' })}\n\n`);
    res.end();
    return;
  }

  // Replay past events
  for (const event of buildState.events) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  // If build is already done, close
  if (buildState.status !== 'running') {
    res.end();
    return;
  }

  // Subscribe to future events
  buildState.listeners.push(res);
  const heartbeat = setInterval(() => { try { res.write(':ping\n\n'); } catch(e) {} }, 15000);
  req.on('close', () => {
    clearInterval(heartbeat);
    const idx = buildState.listeners.indexOf(res);
    if (idx >= 0) buildState.listeners.splice(idx, 1);
  });
}

// ─── SSE File Watcher ───────────────────────────────────

let activeWatcherCount = 0;
const MAX_WATCHERS = 50;

async function handleWatch(req, res, params) {
  const client = params.get('client');
  if (!client) { sendError(res, 400, 'Missing client parameter'); return; }
  if (activeWatcherCount >= MAX_WATCHERS) { sendError(res, 503, `Too many active watchers (limit: ${MAX_WATCHERS})`); return; }
  const outputDir = path.join(serveDir, 'clients', client, 'output');
  if (!outputDir.startsWith(serveDir) || !fs.existsSync(outputDir)) { sendError(res, 404, 'Output directory not found'); return; }
  activeWatcherCount++;
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
  res.write('\n');
  const heartbeat = setInterval(() => { try { res.write(':ping\n\n'); } catch(e) {} }, 30000);
  let debounceTimer;
  const watcher = fs.watch(outputDir, { recursive: true }, (event, filename) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => { try { res.write(`data: ${JSON.stringify({ event, filename: filename || 'unknown' })}\n\n`); } catch(e) {} }, 500);
  });
  req.on('close', () => { clearInterval(heartbeat); clearTimeout(debounceTimer); watcher.close(); activeWatcherCount--; });
}

// ─── Server ─────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  try {
    const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
    const urlPath = parsedUrl.pathname;

    // ── API Routes ──
    if (urlPath.startsWith('/api/')) {
      if (!checkAuth(req, res)) return;

      const route = `${req.method} ${urlPath}`;
      switch (route) {
        case 'GET /api/health': handleHealth(req, res); return;
        case 'GET /api/clients': await handleGetClients(req, res); return;
        case 'GET /api/page': await handleGetPage(req, res, parsedUrl.searchParams); return;
        case 'POST /api/update-text': await handleUpdateText(req, res); return;
        case 'POST /api/upload': await handleUpload(req, res); return;
        case 'POST /api/build': await handleBuild(req, res); return;
        case 'GET /api/build-progress': await handleBuildProgress(req, res, parsedUrl.searchParams); return;
        case 'GET /api/watch': await handleWatch(req, res, parsedUrl.searchParams); return;
        default: sendError(res, 404, `API route not found: ${route}`); return;
      }
    }

    // ── Static Files ──
    let staticPath = urlPath;
    if (staticPath === '/') staticPath = '/ui.html';
    if (staticPath.endsWith('/')) staticPath += 'index.html';

    const filePath = path.join(serveDir, staticPath);

    // Security: prevent directory traversal
    if (!filePath.startsWith(serveDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        if (err.code === 'ENOENT') {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end(`404 Not Found: ${urlPath}`);
        } else {
          res.writeHead(500);
          res.end('Internal Server Error');
        }
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  } catch (err) {
    console.error('Request error:', err);
    if (!res.headersSent) sendError(res, 500, 'Internal server error');
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Server may already be running.`);
    process.exit(0);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log(`Serving ${serveDir}`);
  console.log(`http://localhost:${PORT}`);
});
