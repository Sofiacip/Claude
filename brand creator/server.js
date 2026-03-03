/**
 * server.js — Impact OS Brand Creator backend.
 * Express server with SSE progress streaming, job management, and zip delivery.
 * Produces brand guides following the AI Page Building template.
 */

import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { mkdir, writeFile, unlink } from 'fs/promises';
import { existsSync, createReadStream } from 'fs';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import multer from 'multer';
import mime from 'mime-types';

import { scrapeWebsite } from './scraper.js';
import { analyzeBrand } from './analyzer.js';
import { buildZip } from './packager.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3000');
// No per-module auth — authentication is handled at the platform level

// ── In-memory job store ───────────────────────────────────────────────────────

const jobs = new Map();
const sseClients = new Map();

function createJob(id, url, clientName) {
  const job = {
    id,
    status: 'pending',
    url,
    clientName,
    progress: [],

    // Section 1: Brand Identity
    brandIdentity: {
      brandName: clientName,
      tagline: '',
      industry: '',
      targetAudience: '',
      brandPersonality: '',
    },

    // Section 2: Color System (function-mapped)
    colorSystem: {
      primary: [],
      utility: []
    },

    // Section 3: Typography
    fontFamilies: [],
    typeScale: [],

    // Section 4: Component Styles
    buttons: { primary: {}, secondary: {} },
    cards: {},
    formInputs: {},

    // Section 5: Spacing & Layout
    spacing: {},

    // Section 6: Decorative Effects
    effects: [],

    // Section 7: Image Library
    imageLibrary: {
      logos: [], logos_partners: [],
      hero: [], instructors: [], instructors_team: [],
      testimonials: [], courses: [], icons: [],
      lifestyle: [], misc: [], uploads: []
    },
    imagePlacementMap: [],

    // Section 8: Logo Usage
    logoUsage: [],

    // Meta
    screenshots: [],
    tempDir: `/tmp/brand-${id}`,
    createdAt: Date.now(),
    error: null
  };
  jobs.set(id, job);
  return job;
}

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

// ── Pipeline orchestrator ─────────────────────────────────────────────────────

async function runPipeline(job) {
  const { id, url, tempDir } = job;
  job.status = 'running';

  try {
    await mkdir(tempDir, { recursive: true });
    emitProgress(id, 'Pipeline started.');

    // Stage 1 — Scrape
    emitProgress(id, 'Stage 1/3 — Scraping website (downloading all images)...');
    const scraped = await scrapeWebsite(url, tempDir, msg => emitProgress(id, msg));

    // Store image library
    job.imageLibrary = { ...job.imageLibrary, ...scraped.imageLibrary };
    job.screenshots = scraped.pages.map(p => ({ url: p.url, title: p.title, b64: p.screenshotB64 }));

    // Stage 2 — Analyse
    emitProgress(id, 'Stage 2/3 — Analysing brand with Claude (generating 8-section guide)...');
    const brandGuide = await analyzeBrand(scraped, msg => emitProgress(id, msg));

    // Map analyzer output to job fields
    job.brandIdentity = brandGuide.brandIdentity || job.brandIdentity;
    job.colorSystem = brandGuide.colorSystem || job.colorSystem;
    job.fontFamilies = brandGuide.fontFamilies || job.fontFamilies;
    job.typeScale = brandGuide.typeScale || job.typeScale;
    job.buttons = brandGuide.buttons || job.buttons;
    job.cards = brandGuide.cards || job.cards;
    job.formInputs = brandGuide.formInputs || job.formInputs;
    job.spacing = brandGuide.spacing || job.spacing;
    job.effects = brandGuide.effects || job.effects;
    job.logoUsage = brandGuide.logoUsage || job.logoUsage;
    job.imagePlacementMap = brandGuide.imagePlacementMap || job.imagePlacementMap;

    // Stage 3 — Done
    emitProgress(id, 'Stage 3/3 — Brand guide ready for review.');
    job.status = 'complete';
    emitStatus(id, 'complete');
  } catch (err) {
    console.error(`[job ${id}] Pipeline error:`, err);
    job.status = 'error';
    job.error = err.message;
    emitProgress(id, `Error: ${err.message}`);
    emitStatus(id, 'error', { error: err.message });
  }
}

// ── Express setup ─────────────────────────────────────────────────────────────

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

const upload = multer({
  storage: multer.diskStorage({
    destination: async (req, file, cb) => {
      const job = jobs.get(req.params.id);
      if (!job) return cb(new Error('Job not found'), '');
      const dir = join(job.tempDir, 'brand-assets', 'misc');
      await mkdir(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = extname(file.originalname) || '.bin';
      const name = file.originalname
        .replace(ext, '')
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 50);
      cb(null, `${name}-${Date.now().toString(36)}${ext}`);
    }
  }),
  limits: { fileSize: MAX_UPLOAD_BYTES }
});

// ── Routes ────────────────────────────────────────────────────────────────────

app.post('/api/generate', (req, res) => {
  const { url, clientName } = req.body;
  if (!url || !clientName) {
    return res.status(400).json({ error: 'url and clientName are required' });
  }
  try { new URL(url); } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  const jobId = randomUUID().split('-')[0];
  const job = createJob(jobId, url, clientName.trim());
  runPipeline(job).catch(err => console.error('Unhandled pipeline error:', err));
  res.json({ jobId });
});

app.get('/api/jobs/:id/stream', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  if (!sseClients.has(req.params.id)) sseClients.set(req.params.id, new Set());
  sseClients.get(req.params.id).add(res);

  for (const msg of job.progress) {
    res.write(`data: ${JSON.stringify({ message: msg, ts: Date.now() })}\n\n`);
  }

  if (job.status === 'complete' || job.status === 'error') {
    const payload = { status: job.status, ts: Date.now() };
    if (job.error) payload.error = job.error;
    res.write(`event: status\ndata: ${JSON.stringify(payload)}\n\n`);
  }

  const heartbeat = setInterval(() => res.write(': ping\n\n'), 20000);
  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.get(req.params.id)?.delete(res);
  });
});

app.get('/api/jobs/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  const { screenshots, ...safeJob } = job;
  res.json({ ...safeJob, screenshotCount: screenshots.length });
});

app.get('/api/jobs/:id/screenshots', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  const index = parseInt(req.query.index || '0');
  const screenshot = job.screenshots[index];
  if (!screenshot) return res.status(404).json({ error: 'Screenshot not found' });
  res.json({ url: screenshot.url, title: screenshot.title, b64: screenshot.b64, total: job.screenshots.length });
});

// ── Section update routes ────────────────────────────────────────────────────

app.put('/api/jobs/:id/identity', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  job.brandIdentity = { ...job.brandIdentity, ...req.body };
  res.json({ ok: true });
});

app.put('/api/jobs/:id/colors', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  job.colorSystem = req.body.colorSystem || job.colorSystem;
  res.json({ ok: true });
});

app.put('/api/jobs/:id/typography', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (req.body.fontFamilies) job.fontFamilies = req.body.fontFamilies;
  if (req.body.typeScale) job.typeScale = req.body.typeScale;
  res.json({ ok: true });
});

app.put('/api/jobs/:id/components', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (req.body.buttons) job.buttons = req.body.buttons;
  if (req.body.cards) job.cards = req.body.cards;
  if (req.body.formInputs) job.formInputs = req.body.formInputs;
  res.json({ ok: true });
});

app.put('/api/jobs/:id/spacing', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  job.spacing = { ...job.spacing, ...req.body };
  res.json({ ok: true });
});

app.put('/api/jobs/:id/effects', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  job.effects = req.body.effects || [];
  res.json({ ok: true });
});

app.put('/api/jobs/:id/logos', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (req.body.logoUsage) job.logoUsage = req.body.logoUsage;
  if (req.body.imagePlacementMap) job.imagePlacementMap = req.body.imagePlacementMap;
  res.json({ ok: true });
});

// ── Asset management routes ──────────────────────────────────────────────────

app.delete('/api/jobs/:id/assets/:category/:index', async (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const { category, index } = req.params;
  const list = job.imageLibrary[category];
  if (!list) return res.status(400).json({ error: 'Invalid category' });

  const idx = parseInt(index);
  if (idx < 0 || idx >= list.length) return res.status(400).json({ error: 'Index out of range' });

  const [removed] = list.splice(idx, 1);
  if (removed?.localPath) unlink(removed.localPath).catch(() => {});
  res.json({ ok: true });
});

app.post('/api/jobs/:id/assets', (req, res, next) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  next();
}, upload.single('file'), (req, res) => {
  const job = jobs.get(req.params.id);
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const category = req.body.category || 'uploads';
  const asset = {
    url: 'manual-upload',
    localPath: req.file.path,
    filename: req.file.filename,
    alt: req.file.originalname,
    context: { sectionText: 'Uploaded', sectionClass: '', dimensions: {}, isBackground: false }
  };

  if (job.imageLibrary[category]) {
    job.imageLibrary[category].push(asset);
  } else {
    job.imageLibrary.uploads = job.imageLibrary.uploads || [];
    job.imageLibrary.uploads.push(asset);
  }

  res.json({ ok: true, asset });
});

app.get('/api/jobs/:id/asset-file/:category/:filename', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).send('Job not found');

  const { category, filename } = req.params;
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).send('Invalid filename');
  }

  // Map category keys to disk folder paths
  const categoryToDir = {
    logos: 'logos',
    logos_partners: join('logos', 'partners'),
    hero: 'hero',
    instructors: 'instructors',
    instructors_team: join('instructors', 'team'),
    testimonials: 'testimonials',
    courses: 'courses',
    icons: 'icons',
    lifestyle: 'lifestyle',
    misc: 'misc',
    uploads: 'misc'
  };

  const dir = categoryToDir[category];
  if (!dir) return res.status(400).send('Invalid category');

  const filePath = join(job.tempDir, 'brand-assets', dir, filename);
  if (!existsSync(filePath)) return res.status(404).send('File not found');

  res.setHeader('Content-Type', mime.lookup(filename) || 'application/octet-stream');
  createReadStream(filePath).pipe(res);
});

// ── Download ─────────────────────────────────────────────────────────────────

app.get('/api/jobs/:id/download', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.status !== 'complete') return res.status(400).json({ error: 'Job not complete yet' });

  const filename = `${job.clientName.toLowerCase().replace(/\s+/g, '-')}-brand.zip`;
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  buildZip(job, res).catch(err => {
    console.error('Zip error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to build zip' });
    }
  });
});

// ── Health check ─────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({ ok: true, module: 'brand-creator', version: '2.0.0' });
});

// ── Start server ──────────────────────────────────────────────────────────────

const server = createServer(app);
server.listen(PORT, () => {
  console.log(`\n  Impact OS — Brand Creator v2.0`);
  console.log(`  Running at http://localhost:${PORT}\n`);
});
