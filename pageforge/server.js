/**
 * @fileoverview PageForge Express webhook server.
 *
 * Can be run standalone (`node server.js`) or imported by approvalGate.js
 * when the pipeline spins up the server on demand.
 *
 * Uses a callback registry instead of dynamic route registration so that
 * the approval gate can add per-run handlers without Express routing conflicts.
 *
 * Endpoints:
 *   GET /health                  → liveness check
 *   GET /approve/:runId          → approve a pipeline run (dispatched via registry)
 *   GET /revise/:runId?notes=…   → request revisions on a run (dispatched via registry)
 */

import express from 'express';
import { createServer } from 'http';
import { config } from './config.js';

/**
 * Create and configure the Express app + HTTP server.
 * Stores references on globalThis so approvalGate.js can register
 * per-run callback handlers dynamically.
 *
 * @returns {Promise<{ app: import('express').Application, server: import('http').Server }>}
 */
export async function createApp() {
  const app = express();

  // ── Middleware ────────────────────────────────────────────────────────────
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logger
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] [server        ] ${req.method} ${req.path}`);
    next();
  });

  // ── Callback registry for dynamic per-run handlers ──────────────────────
  // approvalGate.js registers callbacks here: globalThis.__pageforgeHandlers
  globalThis.__pageforgeHandlers = globalThis.__pageforgeHandlers || {};

  // ── Static routes ─────────────────────────────────────────────────────────

  /** Health check — used by load balancers and uptime monitors */
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'pageforge-webhook', ts: new Date().toISOString() });
  });

  /**
   * Single parameterized route for approvals.
   * Checks the handler registry first; if no handler exists, returns 404.
   */
  app.get('/approve/:runId', (req, res) => {
    const { runId } = req.params;
    const handler = globalThis.__pageforgeHandlers[`approve:${runId}`];
    if (handler) {
      handler(req, res);
    } else {
      res.status(404).send(errorPage(
        'Run Not Found',
        `No active pipeline run with ID <code>${runId}</code> was found.`,
        'The run may have already been approved, rejected, or timed out.'
      ));
    }
  });

  app.get('/revise/:runId', (req, res) => {
    const { runId } = req.params;
    const handler = globalThis.__pageforgeHandlers[`revise:${runId}`];
    if (handler) {
      handler(req, res);
    } else {
      res.status(404).send(errorPage(
        'Run Not Found',
        `No active pipeline run with ID <code>${runId}</code> was found.`,
        'The run may have already been processed or timed out.'
      ));
    }
  });

  // ── Start listening ───────────────────────────────────────────────────────
  const server = createServer(app);

  await new Promise((resolve, reject) => {
    server.listen(config.webhookPort, () => {
      console.log(`[${new Date().toISOString()}] [server        ] Webhook server listening on port ${config.webhookPort}`);
      console.log(`[${new Date().toISOString()}] [server        ] Health: ${config.webhookBaseUrl}/health`);
      resolve();
    });
    server.on('error', reject);
  });

  // Expose on globalThis so approvalGate can register handlers without re-importing
  globalThis.__pageforgeApp    = app;
  globalThis.__pageforgeServer = server;

  return { app, server };
}

/**
 * Build a simple branded error HTML page.
 * @param {string} title
 * @param {string} message
 * @param {string} [detail]
 * @returns {string}
 */
function errorPage(title, message, detail = '') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>PageForge — ${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: #f4f4f5; display: flex; align-items: center;
           justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #fff; border-radius: 12px; padding: 48px 40px;
            max-width: 480px; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,.08); }
    h1 { margin: 0 0 16px; font-size: 22px; color: #111827; }
    p  { color: #6b7280; font-size: 15px; margin: 0 0 10px; }
    code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
  </style>
</head>
<body>
  <div class="card">
    <div style="font-size:48px;margin-bottom:20px">⚠️</div>
    <h1>${title}</h1>
    <p>${message}</p>
    ${detail ? `<p>${detail}</p>` : ''}
  </div>
</body>
</html>`;
}

// ── Standalone entry point ────────────────────────────────────────────────────
import { fileURLToPath } from 'url';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createApp().catch((err) => {
    console.error('[server] Failed to start:', err);
    process.exit(1);
  });
}
