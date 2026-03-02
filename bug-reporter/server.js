/**
 * server.js — Impact OS Bug Reporter backend.
 * Express server with CORS, bug report submission via ClickUp API,
 * and screenshot attachment uploads.
 */

import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import { unlinkSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { ClickUpClient, formatModuleName } from './clickup.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3007');
const APP_PASSWORD = process.env.APP_PASSWORD;
const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN;
const CLICKUP_LIST_ID = process.env.CLICKUP_LIST_ID || '901521692113';

if (!APP_PASSWORD) {
  console.error('ERROR: APP_PASSWORD is not set. Add it to your .env file.');
  process.exit(1);
}

if (!CLICKUP_API_TOKEN) {
  console.warn('WARNING: CLICKUP_API_TOKEN is not set. Bug reports will fail until configured.');
}

const clickup = CLICKUP_API_TOKEN ? new ClickUpClient(CLICKUP_API_TOKEN, CLICKUP_LIST_ID) : null;

// ── Multer setup ─────────────────────────────────────────────────────────────

const UPLOAD_DIR = '/tmp/bug-reporter-uploads';
mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'file'));
    }
  },
});

// ── Valid values ─────────────────────────────────────────────────────────────

const VALID_MODULES = new Set([
  'web-designer', 'funnel-designer', 'copywriter', 'copywriter-ui',
  'brand-creator', 'doc-factory', 'pageforge', 'ux-ui',
  'market-researcher', 'other',
]);

// Map sidebar module slugs to ClickUp tag names (must match MODULE_MAP keys in executor.mjs)
const MODULE_TAG_MAP = {
  'web-designer': 'web designer',
  'funnel-designer': 'funnel designer',
  'copywriter': 'copywriter',
  'copywriter-ui': 'copywriter-ui',
  'brand-creator': 'brand creator',
  'doc-factory': 'doc factory',
  'pageforge': 'pageforge',
  'ux-ui': 'ux/ui',
  'market-researcher': 'market researcher',
  'other': 'other',
};

const VALID_SEVERITIES = new Set(['critical', 'high', 'medium', 'low']);

// Legacy priority field → severity mapping for backward compatibility
const LEGACY_SEVERITY_MAP = { urgent: 'critical', normal: 'medium' };

const PRIORITY_MAP = { critical: 1, high: 2, medium: 3, low: 4 };

// ── Auth middleware ──────────────────────────────────────────────────────────

function requireAuth(req, res, next) {
  const password = req.headers['x-password'] || req.body?.password;
  if (password === APP_PASSWORD) return next();
  res.status(401).json({ ok: false, error: 'Unauthorized' });
}

// ── Express setup ────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// CORS — sidebar.js runs on different origins
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-Password');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /api/auth
 * Body: { password: string }
 */
app.post('/api/auth', (req, res) => {
  const { password } = req.body;
  if (password === APP_PASSWORD) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ ok: false, error: 'Incorrect password' });
  }
});

/**
 * GET /api/health
 * Health check endpoint (no auth required).
 */
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'bug-reporter' });
});

/**
 * POST /api/report
 * Accepts multipart/form-data from the standalone bug report form.
 * Fields: module, description, priority (urgent|high|normal|low)
 * File: screenshot (optional)
 * Creates a ClickUp task, attaches screenshot if present.
 * Returns { success, taskId, taskUrl }.
 */
app.post('/api/report', requireAuth, (req, res, next) => {
  upload.single('screenshot')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, error: 'File must be under 10MB' });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ success: false, error: 'File must be an image or PDF' });
      }
      return res.status(400).json({ success: false, error: err.message });
    }
    if (err) return next(err);
    handleReport(req, res);
  });
});

async function handleReport(req, res) {
  const tmpFile = req.file?.path;

  try {
    if (!clickup) {
      return res.status(503).json({ success: false, error: 'ClickUp API not configured' });
    }

    const { module: moduleName, description, priority } = req.body;

    // Map form priority (urgent/high/normal/low) → severity (critical/high/medium/low)
    const severity = LEGACY_SEVERITY_MAP[priority] || priority || 'medium';

    // Validate
    const errors = [];
    if (!moduleName) errors.push('module is required');
    else if (!VALID_MODULES.has(moduleName)) errors.push(`Invalid module: ${moduleName}`);
    if (!description || description.trim().length < 10) errors.push('Description must be at least 10 characters');
    if (!VALID_SEVERITIES.has(severity)) errors.push(`Invalid priority: ${priority}`);

    if (errors.length > 0) {
      return res.status(400).json({ success: false, error: errors.join('; ') });
    }

    const moduleTag = MODULE_TAG_MAP[moduleName] || moduleName;
    const task = await clickup.createBugReport({
      moduleName,
      moduleTag,
      description: description.trim(),
      severity,
      hasScreenshot: !!tmpFile,
    });

    const taskUrl = task.url || `https://app.clickup.com/t/${task.id}`;
    console.log(`[Bug] report created: ${task.id} — ${task.name}`);

    // Upload screenshot if provided
    if (tmpFile) {
      try {
        const fileName = req.file.originalname || 'screenshot.png';
        await clickup.attachFile(task.id, tmpFile, fileName);
        console.log(`  Screenshot attached: ${fileName}`);
      } catch (attachErr) {
        console.error(`  Screenshot upload failed: ${attachErr.message}`);
      }
    }

    res.json({ success: true, taskId: task.id, taskUrl });
  } catch (err) {
    console.error('Report submission failed:', err.message);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    if (tmpFile) try { unlinkSync(tmpFile); } catch {}
  }
}

/**
 * POST /api/bug-report
 * Accepts JSON bug/feature reports from the sidebar form.
 * Body: { module, type, description, severity, priority (legacy), reporter, hasScreenshot }
 * Creates a ClickUp task and returns { success, taskId, taskUrl }.
 */
app.post('/api/bug-report', async (req, res) => {
  if (!clickup) {
    return res.status(503).json({ success: false, error: 'ClickUp integration not configured' });
  }
  try {
    const { module: moduleName, type, title, description, reporter, hasScreenshot } = req.body;

    // Accept severity or legacy priority field
    const rawSeverity = req.body.severity
      || LEGACY_SEVERITY_MAP[req.body.priority]
      || req.body.priority;

    // Validate required fields
    const errors = [];
    if (!moduleName) errors.push('module is required');
    else if (!VALID_MODULES.has(moduleName)) errors.push(`module must be one of: ${[...VALID_MODULES].join(', ')}`);

    if (!description) errors.push('description is required');
    else if (description.length < 10) errors.push('description must be at least 10 characters');

    if (!rawSeverity) errors.push('severity is required');
    else if (!VALID_SEVERITIES.has(rawSeverity)) errors.push(`severity must be one of: ${[...VALID_SEVERITIES].join(', ')}`);

    if (errors.length > 0) {
      return res.status(400).json({ success: false, error: errors.join('; ') });
    }

    let task;

    if (type === 'feature') {
      // Feature requests use generic createTask
      const displayModule = formatModuleName(moduleName);
      const taskName = title
        ? `Feature Request: ${title}`
        : `[Feature] ${displayModule}: ${description.slice(0, 60).trim()}`;
      const body = [
        '## Feature Request',
        '',
        `**Module:** ${displayModule}`,
        `**Priority:** ${rawSeverity}`,
        '',
        '### Description',
        '',
        description,
      ].join('\n');

      const moduleTag = MODULE_TAG_MAP[moduleName] || moduleName;
      task = await clickup.createTask({
        name: taskName,
        description: body,
        priority: PRIORITY_MAP[rawSeverity],
        tags: [moduleTag, 'feature-request'],
        status: 'not started',
      });
    } else {
      // Bug reports use structured createBugReport with full metadata
      const moduleTag = MODULE_TAG_MAP[moduleName] || moduleName;
      task = await clickup.createBugReport({
        moduleName,
        moduleTag,
        title,
        description,
        severity: rawSeverity,
        reporter: reporter || undefined,
        hasScreenshot: !!hasScreenshot,
      });
    }

    const taskUrl = task.url || `https://app.clickup.com/t/${task.id}`;
    const prefix = type === 'feature' ? '[Feature]' : '[Bug]';
    console.log(`${prefix} report created: ${task.id} — ${task.name}`);

    res.json({ success: true, taskId: task.id, taskUrl });
  } catch (err) {
    console.error('Bug report failed:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/bug-report/:taskId/attachment
 * Uploads a screenshot/file attachment to an existing ClickUp task.
 * Accepts multipart/form-data with a "file" field.
 */
app.post('/api/bug-report/:taskId/attachment', (req, res, next) => {
  if (!clickup) {
    return res.status(503).json({ success: false, error: 'ClickUp integration not configured' });
  }
  upload.single('screenshot')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, error: 'File must be under 10MB' });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ success: false, error: 'File must be an image or PDF' });
      }
      return res.status(400).json({ success: false, error: err.message });
    }
    if (err) return next(err);
    handleAttachment(req, res);
  });
});

async function handleAttachment(req, res) {
  const tmpFile = req.file?.path;
  if (!tmpFile) {
    return res.status(400).json({ success: false, error: 'No file uploaded' });
  }

  try {
    const { taskId } = req.params;
    const fileName = req.file.originalname || 'screenshot.png';
    await clickup.attachFile(taskId, tmpFile, fileName);
    console.log(`Attachment uploaded to task ${taskId}: ${fileName}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Attachment upload failed:', err.message);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    if (tmpFile) try { unlinkSync(tmpFile); } catch {}
  }
}

// ── Start server ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n  Impact OS — Bug Reporter`);
  console.log(`  Running at http://localhost:${PORT}\n`);
});
