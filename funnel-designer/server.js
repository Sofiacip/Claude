/**
 * server.js — Impact OS Funnel Designer backend.
 * Express server with SSE progress streaming, job management.
 * Automated stages: Ingest → Map (heuristic). Then pauses for Claude Code
 * to take over Build → QA → Deploy.
 */

import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { mkdir, readFile, readdir, writeFile } from 'fs/promises';
import { existsSync, createReadStream } from 'fs';
import { join, extname, basename } from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import multer from 'multer';
import mime from 'mime-types';
import session from 'express-session';

import { ingest } from './ingest.js';
import { mapCopy } from './mapper.js';
import { deployAll } from './deploy.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3002');
const APP_PASSWORD = process.env.APP_PASSWORD;

if (!APP_PASSWORD) {
  console.error('ERROR: APP_PASSWORD is not set. Add it to your .env file.');
  process.exit(1);
}

// ── In-memory job store ───────────────────────────────────────────────────────

/** @type {Map<string, object>} */
const jobs = new Map();

/** @type {Map<string, Set<import('express').Response>>} */
const sseClients = new Map();

/**
 * Page types for the webinar funnel, in pipeline order.
 */
const WEBINAR_PAGES = ['landing', 'upgrade', 'upsell', 'thank_you', 'replay', 'sales'];

function createJob(id, clientName, funnelType) {
  const job = {
    id,
    status: 'pending', // pending | ingesting | mapping | building | qa | review | deploying | complete | error
    clientName,
    funnelType,
    brand: {
      colors: [],
      fonts: [],
      logoPath: null,
      photoPaths: [],
      brandGuide: ''
    },
    pages: [], // populated during ingest
    progress: [],
    tempDir: `/tmp/funnel-${id}`,
    createdAt: Date.now(),
    error: null
  };
  jobs.set(id, job);
  return job;
}

function createPageEntry(pageType) {
  return {
    pageType,
    templatePath: null,
    copyRaw: '',
    copySlots: {},
    missingSlots: [],
    htmlPath: null,
    qaRounds: 0,
    qaStatus: 'pending', // pending | building | qa | approved | changes_requested
    qaFeedback: [],
    screenshots: { mobile: null, tablet: null, desktop: null },
    deployedUrl: null
  };
}

// ── SSE helpers ───────────────────────────────────────────────────────────────

function emitProgress(jobId, message) {
  const job = jobs.get(jobId);
  if (job) job.progress.push(message);

  const clients = sseClients.get(jobId);
  if (!clients) return;
  const data = JSON.stringify({ message, ts: Date.now() });
  for (const res of clients) {
    res.write(`data: ${data}\n\n`);
  }
}

function emitStatus(jobId, status, extra = {}) {
  const job = jobs.get(jobId);
  if (job) job.status = status;

  const clients = sseClients.get(jobId);
  if (!clients) return;
  const data = JSON.stringify({ status, ...extra, ts: Date.now() });
  for (const res of clients) {
    res.write(`event: status\ndata: ${data}\n\n`);
  }
}

function emitPageStatus(jobId, pageIndex, pageStatus, extra = {}) {
  const job = jobs.get(jobId);
  if (job && job.pages[pageIndex]) {
    job.pages[pageIndex].qaStatus = pageStatus;
  }

  const clients = sseClients.get(jobId);
  if (!clients) return;
  const data = JSON.stringify({ pageIndex, status: pageStatus, ...extra, ts: Date.now() });
  for (const res of clients) {
    res.write(`event: page\ndata: ${data}\n\n`);
  }
}

// ── Pipeline orchestrator ─────────────────────────────────────────────────────

async function runPipeline(job) {
  const { id, tempDir } = job;
  const emit = msg => emitProgress(id, msg);

  try {
    await mkdir(tempDir, { recursive: true });
    emit('Pipeline started.');

    // Stage 1 — Ingest
    emitStatus(id, 'ingesting');
    emit('Stage 1/5 — Ingesting brand package + copy documents...');
    await ingest(job, emit);

    // Stage 2 — Map (heuristic heading→slot matching)
    emitStatus(id, 'mapping');
    emit('Stage 2/5 — Mapping copy to template slots...');
    await mapCopy(job, emit);

    // Pipeline pauses here — Claude Code handles Build → QA → Deploy
    emitStatus(id, 'mapped');
    emit('Ingest + Map complete. Ready for Claude Code to build pages.');

  } catch (err) {
    console.error(`[job ${id}] Pipeline error:`, err);
    job.status = 'error';
    job.error = err.message;
    emit(`Error: ${err.message}`);
    emitStatus(id, 'error', { error: err.message });
  }
}

// ── Express setup ─────────────────────────────────────────────────────────────

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'funnel-designer-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));
app.use(express.static(join(__dirname, 'public')));

// Multer: store uploads in project uploads/ dir keyed by job id
const uploadStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const dir = join(__dirname, 'uploads', req.uploadJobId || 'tmp');
    await mkdir(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max
});

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth
 */
app.post('/api/auth', (req, res) => {
  const { password } = req.body;
  if (password === APP_PASSWORD) {
    req.session.authed = true;
    res.json({ ok: true });
  } else {
    res.status(401).json({ ok: false, error: 'Incorrect password' });
  }
});

/**
 * GET /api/auth/check
 */
app.get('/api/auth/check', (req, res) => {
  res.json({ authed: !!req.session?.authed });
});

// Auth guard — protect all /api/* routes below this point
app.use('/api', (req, res, next) => {
  if (req.path === '/auth' || req.path === '/auth/check') return next();
  if (!req.session?.authed) return res.status(401).json({ error: 'Not authenticated' });
  next();
});

/**
 * POST /api/funnel
 * Multipart: brand (zip), copies (docx files), clientName, funnelType
 */
app.post('/api/funnel', (req, res, next) => {
  const jobId = randomUUID().split('-')[0];
  req.uploadJobId = jobId;
  next();
}, upload.fields([
  { name: 'brand', maxCount: 1 },
  { name: 'copies', maxCount: 10 }
]), (req, res) => {
  const { clientName, funnelType } = req.body;

  if (!clientName) {
    return res.status(400).json({ error: 'clientName is required' });
  }
  if (!req.files?.brand?.[0]) {
    return res.status(400).json({ error: 'Brand package (.zip) is required' });
  }
  if (!req.files?.copies?.length) {
    return res.status(400).json({ error: 'At least one copy document (.docx) is required' });
  }

  const jobId = req.uploadJobId;
  const job = createJob(jobId, clientName.trim(), funnelType || 'webinar');

  // Attach upload paths to job for ingest stage
  job.uploadDir = join(__dirname, 'uploads', jobId);
  job.brandZipPath = req.files.brand[0].path;
  job.copyDocPaths = req.files.copies.map(f => ({
    path: f.path,
    originalName: f.originalname
  }));

  // Run pipeline in background
  runPipeline(job).catch(err => console.error('Unhandled pipeline error:', err));

  res.json({ jobId });
});

/**
 * GET /api/jobs/:id
 */
app.get('/api/jobs/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  // Strip large fields for the response
  const safeJob = {
    id: job.id,
    status: job.status,
    clientName: job.clientName,
    funnelType: job.funnelType,
    brand: {
      colors: job.brand.colors,
      fonts: job.brand.fonts,
      hasLogo: !!job.brand.logoPath,
      photoCount: job.brand.photoPaths.length
    },
    pages: job.pages.map(p => ({
      pageType: p.pageType,
      qaStatus: p.qaStatus,
      qaRounds: p.qaRounds,
      missingSlots: p.missingSlots,
      deployedUrl: p.deployedUrl,
      hasScreenshots: !!(p.screenshots.mobile || p.screenshots.desktop),
      hasCopy: p.copyRaw !== null
    })),
    progress: job.progress,
    createdAt: job.createdAt,
    error: job.error
  };

  res.json(safeJob);
});

/**
 * GET /api/jobs/:id/stream
 */
app.get('/api/jobs/:id/stream', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Register SSE client
  if (!sseClients.has(req.params.id)) sseClients.set(req.params.id, new Set());
  sseClients.get(req.params.id).add(res);

  // Replay past messages
  for (const msg of job.progress) {
    res.write(`data: ${JSON.stringify({ message: msg, ts: Date.now() })}\n\n`);
  }

  // Replay current page statuses
  job.pages.forEach((page, i) => {
    const data = JSON.stringify({ pageIndex: i, status: page.qaStatus, ts: Date.now() });
    res.write(`event: page\ndata: ${data}\n\n`);
  });

  // If terminal state, emit status immediately
  if (['mapped', 'review', 'complete', 'error'].includes(job.status)) {
    const payload = { status: job.status, ts: Date.now() };
    if (job.error) payload.error = job.error;
    res.write(`event: status\ndata: ${JSON.stringify(payload)}\n\n`);
  }

  // Heartbeat
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.get(req.params.id)?.delete(res);
  });
});

/**
 * GET /api/jobs/:id/pages/:idx/screenshot/:viewport
 * Serves a QA screenshot image.
 */
app.get('/api/jobs/:id/pages/:idx/screenshot/:viewport', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const page = job.pages[parseInt(req.params.idx)];
  if (!page) return res.status(404).json({ error: 'Page not found' });

  const viewport = req.params.viewport; // mobile, tablet, desktop
  const screenshotPath = page.screenshots[viewport];
  if (!screenshotPath || !existsSync(screenshotPath)) {
    return res.status(404).json({ error: 'Screenshot not found' });
  }

  res.setHeader('Content-Type', 'image/png');
  createReadStream(screenshotPath).pipe(res);
});

/**
 * GET /api/jobs/:id/assets/*
 * Serves brand assets (logos, photos) from the job's output_assets directory.
 */
app.get('/api/jobs/:id/assets/*', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const assetPath = req.params[0];
  if (assetPath.includes('..')) return res.status(400).json({ error: 'Invalid path' });

  const fullPath = join(job.tempDir, 'output_assets', assetPath);
  if (!existsSync(fullPath)) return res.status(404).json({ error: 'Asset not found' });

  res.setHeader('Content-Type', mime.lookup(fullPath) || 'application/octet-stream');
  createReadStream(fullPath).pipe(res);
});

/**
 * GET /api/jobs/:id/pages/:idx/html
 * Serves the generated HTML for preview.
 */
app.get('/api/jobs/:id/pages/:idx/html', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const page = job.pages[parseInt(req.params.idx)];
  if (!page || !page.htmlPath || !existsSync(page.htmlPath)) {
    return res.status(404).json({ error: 'HTML not found' });
  }

  res.setHeader('Content-Type', 'text/html');
  createReadStream(page.htmlPath).pipe(res);
});

/**
 * POST /api/jobs/:id/pages/:idx/approve
 */
app.post('/api/jobs/:id/pages/:idx/approve', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const page = job.pages[parseInt(req.params.idx)];
  if (!page) return res.status(404).json({ error: 'Page not found' });

  page.qaStatus = 'approved';
  emitPageStatus(job.id, parseInt(req.params.idx), 'approved');
  emitProgress(job.id, `${page.pageType} page approved. ✓`);

  res.json({ ok: true });
});

/**
 * POST /api/jobs/:id/pages/:idx/request-changes
 */
app.post('/api/jobs/:id/pages/:idx/request-changes', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const idx = parseInt(req.params.idx);
  const page = job.pages[idx];
  if (!page) return res.status(404).json({ error: 'Page not found' });

  const { feedback } = req.body;
  if (!feedback) return res.status(400).json({ error: 'feedback is required' });

  page.qaFeedback.push(feedback);
  page.qaStatus = 'changes_requested';
  emitPageStatus(job.id, idx, 'changes_requested');
  emitProgress(job.id, `${page.pageType}: changes requested — "${feedback}"`);

  res.json({ ok: true });
});

/**
 * GET /api/jobs/:id/full
 * Returns full job data including raw copy, brand paths, slots — for Claude Code.
 */
app.get('/api/jobs/:id/full', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  // Return the full job object (minus SSE internals) with asset URLs
  const assetBaseUrl = `/api/jobs/${job.id}/assets`;
  const fullJob = {
    id: job.id,
    status: job.status,
    clientName: job.clientName,
    funnelType: job.funnelType,
    brand: {
      ...job.brand,
      assetBaseUrl,
      logoUrl: job.brand.logoPath ? `${assetBaseUrl}/logos/${basename(job.brand.logoPath)}` : null,
      photoUrls: (job.brand.photoPaths || []).map(p => ({
        filename: basename(p),
        url: `${assetBaseUrl}/photos/${basename(p)}`
      }))
    },
    pages: job.pages,
    tempDir: job.tempDir,
    progress: job.progress,
    error: job.error
  };

  res.json(fullJob);
});

/**
 * POST /api/jobs/:id/pages/:idx/html
 * Upload generated HTML for a page. Body: { html: "..." }
 */
app.post('/api/jobs/:id/pages/:idx/html', async (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const idx = parseInt(req.params.idx);
  const page = job.pages[idx];
  if (!page) return res.status(404).json({ error: 'Page not found' });

  const { html } = req.body;
  if (!html) return res.status(400).json({ error: 'html is required' });

  // Save HTML to output dir
  const outputDir = join(job.tempDir, 'output', page.pageType);
  await mkdir(outputDir, { recursive: true });
  const htmlPath = join(outputDir, 'index.html');
  await writeFile(htmlPath, html, 'utf-8');
  page.htmlPath = htmlPath;
  page.qaStatus = 'pending';

  emitProgress(job.id, `${page.pageType} HTML saved. ✓`);
  emitPageStatus(job.id, idx, 'pending');

  res.json({ ok: true, htmlPath });
});

/**
 * POST /api/jobs/:id/pages/:idx/screenshot
 * Trigger Playwright screenshots for a page. Returns screenshot paths.
 */
app.post('/api/jobs/:id/pages/:idx/screenshot', async (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const idx = parseInt(req.params.idx);
  const page = job.pages[idx];
  if (!page) return res.status(404).json({ error: 'Page not found' });
  if (!page.htmlPath) return res.status(400).json({ error: 'No HTML generated yet' });

  try {
    const { screenshotPage } = await import('./qa.js');
    const round = (page.qaRounds || 0) + 1;
    const screenshots = await screenshotPage(job, idx, round);
    emitProgress(job.id, `${page.pageType} screenshots taken (round ${round}). ✓`);
    res.json({ ok: true, screenshots });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/jobs/:id/deploy
 */
app.post('/api/jobs/:id/deploy', async (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  // Check all pages are approved
  const unapproved = job.pages.filter(p => p.qaStatus !== 'approved');
  if (unapproved.length > 0) {
    return res.status(400).json({
      error: `${unapproved.length} page(s) not yet approved: ${unapproved.map(p => p.pageType).join(', ')}`
    });
  }

  const emit = msg => emitProgress(job.id, msg);

  emitStatus(job.id, 'deploying');
  emit('Stage 5/5 — Deploying to Vercel...');

  try {
    const urls = await deployAll(job, emit);
    job.status = 'complete';
    emitStatus(job.id, 'complete', { urls });
    emit('All pages deployed. ✓');
    res.json({ ok: true, urls });
  } catch (err) {
    emit(`Deploy error: ${err.message}`);
    emitStatus(job.id, 'error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ── Start server ──────────────────────────────────────────────────────────────

const server = createServer(app);
server.listen(PORT, () => {
  console.log(`\n  Impact OS — Funnel Designer`);
  console.log(`  Running at http://localhost:${PORT}\n`);
});
