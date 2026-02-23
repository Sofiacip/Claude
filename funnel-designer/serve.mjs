import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Parse --dir argument
const dirArgIndex = process.argv.indexOf('--dir');
const serveDir = dirArgIndex !== -1
  ? path.resolve(process.argv[dirArgIndex + 1])
  : path.resolve(__dirname);

const PORT = 3000;
const API_PORT = 3002; // server.js backend

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
};

const server = http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];

  // ── Reverse proxy: /api/* → localhost:3002 ──────────────────────────────
  if (req.url.startsWith('/api/') || req.url === '/api') {
    const proxyOpts = {
      hostname: 'localhost',
      port: API_PORT,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: `localhost:${API_PORT}` },
    };

    const proxyReq = http.request(proxyOpts, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });

    proxyReq.on('error', (err) => {
      console.error('Proxy error:', err.message);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Backend unavailable. Is server.js running on port ' + API_PORT + '?' }));
    });

    req.pipe(proxyReq, { end: true });
    return;
  }

  // ── Root → ui.html ─────────────────────────────────────────────────────
  if (urlPath === '/') urlPath = '/ui.html';

  const filePath = path.join(serveDir, urlPath);

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
  console.log(`Funnel Designer UI → http://localhost:${PORT}`);
  console.log(`API proxy → localhost:${API_PORT}`);
  console.log(`Serving static files from ${serveDir}`);
});
