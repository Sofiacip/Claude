/**
 * @fileoverview Stage 5 — Approval Gate
 * Starts (or reuses) an Express server on WEBHOOK_PORT.
 * Blocks the pipeline until a GET /approve/:runId or /revise/:runId is received,
 * or until APPROVAL_TIMEOUT_HOURS elapses (auto-reject + escalation).
 *
 * Uses globalThis.__pageforgeHandlers registry (set up by server.js) instead of
 * registering Express routes directly, avoiding route-ordering conflicts.
 */

import { config } from '../config.js';

/**
 * @typedef {Object} ApprovalResult
 * @property {boolean} approved
 * @property {string}  [notes] - Revision notes from reviewer
 */

/**
 * Wait for the approval webhook for this runId.
 * Resolves when /approve or /revise is hit, or rejects on timeout.
 *
 * Registers handler callbacks in globalThis.__pageforgeHandlers which the
 * single parameterized Express routes in server.js dispatch to.
 *
 * @param {string} runId
 * @returns {Promise<ApprovalResult>}
 */
function waitForWebhook(runId) {
  return new Promise((resolve, reject) => {
    const timeoutMs = config.approvalTimeoutHours * 60 * 60 * 1000;

    // Auto-reject timer
    const timer = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          `Approval timeout after ${config.approvalTimeoutHours}h for run ${runId}. ` +
          `Operator: check reviewer email and resend if needed.`
        )
      );
    }, timeoutMs);

    const handlers = globalThis.__pageforgeHandlers;
    if (!handlers) {
      clearTimeout(timer);
      reject(new Error('Handler registry not initialised. Ensure server.js createApp() ran first.'));
      return;
    }

    let consumed = false;

    function cleanup() {
      clearTimeout(timer);
      consumed = true;
      delete handlers[`approve:${runId}`];
      delete handlers[`revise:${runId}`];
    }

    // Register approve handler in the registry
    handlers[`approve:${runId}`] = (_req, res) => {
      if (consumed) { res.status(410).send('Already processed'); return; }
      cleanup();
      res.send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:60px">
          <h1 style="color:#16a34a">✅ Approved!</h1>
          <p>The landing page will now be generated and deployed automatically.</p>
          <p>Run ID: <code>${runId}</code></p>
        </body></html>
      `);
      resolve({ approved: true });
    };

    // Register revise handler in the registry
    handlers[`revise:${runId}`] = (req, res) => {
      if (consumed) { res.status(410).send('Already processed'); return; }
      cleanup();
      const notes = String(req.query.notes ?? '').trim();
      res.send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:60px">
          <h1 style="color:#d97706">✏️ Revision Requested</h1>
          <p>The pipeline has been stopped. The team will review your notes and resubmit.</p>
          ${notes ? `<p><strong>Your notes:</strong> ${notes}</p>` : ''}
          <p>Run ID: <code>${runId}</code></p>
        </body></html>
      `);
      resolve({ approved: false, notes });
    };
  });
}

/**
 * Ensure the Express server is running on WEBHOOK_PORT.
 * If server.js already started it, this is a no-op.
 * Stores the app reference on globalThis.__pageforgeApp.
 */
async function ensureServerRunning() {
  if (globalThis.__pageforgeServer) return; // already up

  const { createApp } = await import('../server.js');
  const { app, server } = await createApp();
  globalThis.__pageforgeApp    = app;
  globalThis.__pageforgeServer = server;
}

/**
 * Stage 5: Wait for human approval via webhook.
 * @param {import('../pipeline.js').RunContext} ctx
 * @returns {Promise<import('../pipeline.js').RunContext>}
 */
export async function run(ctx) {
  const ts = () => new Date().toISOString();

  console.log(`[${ts()}] [approvalGate  ] Ensuring webhook server is running on port ${config.webhookPort}…`);
  await ensureServerRunning();

  console.log(`[${ts()}] [approvalGate  ] Waiting for reviewer action (timeout: ${config.approvalTimeoutHours}h)…`);
  console.log(`[${ts()}] [approvalGate  ] Approve: ${config.webhookBaseUrl}/approve/${ctx.runId}`);
  console.log(`[${ts()}] [approvalGate  ] Revise:  ${config.webhookBaseUrl}/revise/${ctx.runId}`);

  const result = await waitForWebhook(ctx.runId);

  if (result.approved) {
    console.log(`[${ts()}] [approvalGate  ] APPROVED — proceeding to code generation`);
    return { ...ctx, approvalStatus: 'approved' };
  } else {
    const notes = result.notes ?? '(no notes provided)';
    console.log(`[${ts()}] [approvalGate  ] REVISION REQUESTED — "${notes}"`);
    // Surface as a structured error so the pipeline logs it cleanly
    throw new Error(`Reviewer requested revisions: ${notes}`);
  }
}
