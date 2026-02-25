import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import multer from 'multer';
import AdmZip from 'adm-zip';
import mammoth from 'mammoth';
import { chromium } from 'playwright';
import { randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const PORT = parseInt(process.env.PORT || '3002', 10);
const PASSWORD = process.env.APP_PASSWORD || 'impact2024';
const ROOT = process.cwd();
const funnelConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'funnel-config.json'), 'utf8'));

// ── In-memory job store ─────────────────────────────────────────────────────
const jobs = new Map();

// ── Express setup ───────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(session({
  secret: randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Multer — preserve original filenames
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(ROOT, 'uploads', 'tmp');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

// Static files
app.use('/output', express.static(path.join(ROOT, 'output')));
app.use('/brand_assets', express.static(path.join(ROOT, 'brand_assets')));
app.use(express.static(path.join(ROOT, 'public')));

// ── Auth middleware ──────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (!req.session?.authed) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

// ── SSE helpers ─────────────────────────────────────────────────────────────
function emitSSE(jobId, event, data) {
  const job = jobs.get(jobId);
  if (!job) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of job.sseClients) {
    try { client.write(payload); } catch { /* client gone */ }
  }
}

function emitMessage(jobId, message) {
  emitSSE(jobId, 'message', { message });
}

// ── 1. POST /api/auth — Login ───────────────────────────────────────────────
app.post('/api/auth', (req, res) => {
  if (req.body.password === PASSWORD) {
    req.session.authed = true;
    return res.json({ ok: true });
  }
  res.json({ ok: false });
});

// ── 2. GET /api/auth/check — Session check ──────────────────────────────────
app.get('/api/auth/check', (req, res) => {
  res.json({ authed: !!req.session?.authed });
});

// Auth gate for all remaining /api/* routes
app.use('/api', requireAuth);

// ── 3. POST /api/funnel — Create job ────────────────────────────────────────
app.post('/api/funnel', upload.fields([
  { name: 'brand', maxCount: 1 },
  { name: 'copies', maxCount: 10 }
]), async (req, res) => {
  try {
    const { clientName, funnelType } = req.body;
    if (!clientName || !funnelType) return res.status(400).json({ error: 'Missing fields' });

    const config = funnelConfig[funnelType];
    if (!config) return res.status(400).json({ error: `Unknown funnel type: ${funnelType}` });

    const jobId = randomBytes(4).toString('hex');
    const jobDir = path.join(ROOT, 'uploads', jobId);
    fs.mkdirSync(jobDir, { recursive: true });

    // Move uploaded files to job directory
    const brandFile = req.files?.brand?.[0];
    const copyFilesList = req.files?.copies || [];

    let brandZipPath = null;
    if (brandFile) {
      brandZipPath = path.join(jobDir, 'brand.zip');
      fs.renameSync(brandFile.path, brandZipPath);
    }

    const copyPaths = [];
    for (const f of copyFilesList) {
      const dest = path.join(jobDir, f.originalname.replace(/^\d+-/, ''));
      fs.renameSync(f.path, dest);
      copyPaths.push(dest);
    }

    // Build pages array from funnel config
    const pages = config.pages.map(p => {
      const shortType = p.type.replace(/_page$/, '');
      return {
        pageType: shortType,
        name: p.name,
        outputDir: p.output_dir,
        configType: p.type,
        hasCopy: false,
        copyText: '',
        qaStatus: 'pending',
        feedback: null
      };
    });

    const job = {
      id: jobId,
      clientName,
      funnelType,
      status: 'ingesting',
      brandZipPath,
      copyPaths,
      pages,
      sseClients: new Set(),
      deployUrl: null
    };
    jobs.set(jobId, job);

    // Respond immediately, process async
    res.json({ jobId });

    // ── Async ingestion pipeline ──
    try {
      emitSSE(jobId, 'status', { status: 'ingesting' });
      emitMessage(jobId, `Starting funnel: ${clientName} (${funnelType})`);

      // Extract brand ZIP → brand_assets/
      if (brandZipPath) {
        emitMessage(jobId, 'Extracting brand package...');
        const zip = new AdmZip(brandZipPath);
        const entries = zip.getEntries();
        const brandDir = path.join(ROOT, 'brand_assets');
        fs.mkdirSync(brandDir, { recursive: true });

        // Detect nested top-level folder
        const topFolders = new Set();
        for (const e of entries) {
          const first = e.entryName.split('/')[0];
          if (first) topFolders.add(first);
        }
        const hasWrapper = topFolders.size === 1 &&
          entries.every(e => e.entryName.startsWith([...topFolders][0] + '/') || e.entryName === [...topFolders][0]);
        const prefix = hasWrapper ? [...topFolders][0] + '/' : '';

        for (const entry of entries) {
          if (entry.isDirectory) continue;
          let entryPath = entry.entryName;
          if (prefix && entryPath.startsWith(prefix)) entryPath = entryPath.slice(prefix.length);
          if (!entryPath) continue;
          const destPath = path.join(brandDir, entryPath);
          fs.mkdirSync(path.dirname(destPath), { recursive: true });
          fs.writeFileSync(destPath, entry.getData());
        }
        emitMessage(jobId, '\u2713 Brand assets extracted');

        // Copy photos/logos to output/ for page preview
        const photosDir = path.join(brandDir, 'photos');
        const logosDir = path.join(brandDir, 'logos');
        if (fs.existsSync(photosDir)) {
          const dest = path.join(ROOT, 'output', 'photos');
          fs.mkdirSync(dest, { recursive: true });
          fs.cpSync(photosDir, dest, { recursive: true });
          emitMessage(jobId, `\u2713 Photos copied to output/ (${fs.readdirSync(dest).length} files)`);
        }
        if (fs.existsSync(logosDir)) {
          const dest = path.join(ROOT, 'output', 'logos');
          fs.mkdirSync(dest, { recursive: true });
          fs.cpSync(logosDir, dest, { recursive: true });
          emitMessage(jobId, `\u2713 Logos copied to output/ (${fs.readdirSync(dest).length} files)`);
        }
      }

      // Parse each .docx with mammoth → map to pages
      emitMessage(jobId, 'Processing copy documents...');
      for (const cp of copyPaths) {
        const fname = path.basename(cp, '.docx');
        try {
          const result = await mammoth.extractRawText({ path: cp });
          const text = result.value;
          for (const page of pages) {
            if (fname === page.pageType || fname === page.configType || page.configType.startsWith(fname)) {
              page.hasCopy = true;
              page.copyText = text;
              emitMessage(jobId, `\u2713 Mapped ${fname}.docx \u2192 ${page.name}`);
              break;
            }
          }
        } catch {
          emitMessage(jobId, `Warning: Could not parse ${fname}.docx`);
        }
      }

      job.status = 'mapped';
      emitSSE(jobId, 'status', { status: 'mapped' });
      emitMessage(jobId, '\u2713 All copy mapped. Ready for Claude Code to build pages.');
      emitMessage(jobId, 'Waiting for pages to be built...');
    } catch (err) {
      job.status = 'error';
      emitSSE(jobId, 'status', { status: 'error', error: err.message });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 4. GET /api/jobs/:jobId — Get job state ─────────────────────────────────
app.get('/api/jobs/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  const { sseClients, ...safe } = job;
  res.json(safe);
});

// ── GET /api/jobs — List all jobs (session restore) ─────────────────────────
app.get('/api/jobs', (_req, res) => {
  const list = [];
  for (const [, job] of jobs) {
    const { sseClients, ...safe } = job;
    list.push(safe);
  }
  res.json(list);
});

// ── 5. GET /api/jobs/:jobId/stream — SSE stream ────────────────────────────
app.get('/api/jobs/:jobId/stream', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  job.sseClients.add(res);

  // Send current status on connect
  res.write(`event: status\ndata: ${JSON.stringify({ status: job.status })}\n\n`);

  // Send current page statuses
  job.pages.forEach((p, i) => {
    if (p.qaStatus !== 'pending') {
      res.write(`event: page\ndata: ${JSON.stringify({ pageIndex: i, status: p.qaStatus })}\n\n`);
    }
  });

  req.on('close', () => job.sseClients.delete(res));
});

// ── 6. GET /api/jobs/:jobId/pages/:idx/screenshot/:viewport ─────────────────
app.get('/api/jobs/:jobId/pages/:idx/screenshot/:viewport', async (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const idx = parseInt(req.params.idx, 10);
  const page = job.pages[idx];
  if (!page) return res.status(404).json({ error: 'Page not found' });

  const viewport = req.params.viewport;
  const width = viewport === 'mobile' ? 375 : 1280;

  const screenshotDir = path.join(ROOT, 'temporary screenshots');
  fs.mkdirSync(screenshotDir, { recursive: true });
  const cachePath = path.join(screenshotDir, `${job.id}-${page.pageType}-${viewport}.png`);

  // Serve cached screenshot
  if (fs.existsSync(cachePath)) {
    return res.sendFile(cachePath);
  }

  // Check page exists
  const htmlPath = path.join(ROOT, page.outputDir, 'index.html');
  if (!fs.existsSync(htmlPath)) {
    return res.status(404).json({ error: 'Page not built yet' });
  }

  let browser;
  try {
    browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width, height: 800 } });
    const bp = await ctx.newPage();
    await bp.goto(`http://localhost:${PORT}/output/${page.configType}/`, { waitUntil: 'networkidle', timeout: 30000 });
    await bp.screenshot({ path: cachePath, fullPage: true });
    await browser.close();
    browser = null;
    res.sendFile(cachePath);
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    res.status(500).json({ error: `Screenshot failed: ${err.message}` });
  }
});

// ── 7. POST /api/jobs/:jobId/pages/:idx/approve ─────────────────────────────
app.post('/api/jobs/:jobId/pages/:idx/approve', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const idx = parseInt(req.params.idx, 10);
  const page = job.pages[idx];
  if (!page) return res.status(404).json({ error: 'Page not found' });

  page.qaStatus = 'approved';
  page.feedback = null;
  emitSSE(job.id, 'page', { pageIndex: idx, status: 'approved' });

  // If all approved → transition to review
  if (job.pages.every(p => p.qaStatus === 'approved')) {
    job.status = 'review';
    emitSSE(job.id, 'status', { status: 'review' });
    emitMessage(job.id, '\u2713 All pages approved \u2014 ready for deploy');
  }

  res.json({ ok: true });
});

// ── 8. POST /api/jobs/:jobId/pages/:idx/request-changes ─────────────────────
app.post('/api/jobs/:jobId/pages/:idx/request-changes', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const idx = parseInt(req.params.idx, 10);
  const page = job.pages[idx];
  if (!page) return res.status(404).json({ error: 'Page not found' });

  page.qaStatus = 'changes_requested';
  page.feedback = req.body.feedback || '';

  // Invalidate screenshot cache
  const screenshotDir = path.join(ROOT, 'temporary screenshots');
  for (const vp of ['mobile', 'desktop']) {
    const cp = path.join(screenshotDir, `${job.id}-${page.pageType}-${vp}.png`);
    if (fs.existsSync(cp)) fs.unlinkSync(cp);
  }

  emitSSE(job.id, 'page', { pageIndex: idx, status: 'changes_requested' });
  emitMessage(job.id, `Changes requested for ${page.name}: ${page.feedback}`);

  if (job.status === 'review') {
    job.status = 'building';
    emitSSE(job.id, 'status', { status: 'building' });
  }

  res.json({ ok: true });
});

// ── 9. POST /api/jobs/:jobId/deploy — Vercel deploy ─────────────────────────
app.post('/api/jobs/:jobId/deploy', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const clientSlug = job.clientName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const tmpDir = `/tmp/vercel-deploy-${clientSlug}-funnel`;

  try {
    // Clean and create temp directory
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
    fs.mkdirSync(tmpDir, { recursive: true });

    // Copy each page, rewriting asset paths
    for (const page of job.pages) {
      const srcHtml = path.join(ROOT, page.outputDir, 'index.html');
      if (!fs.existsSync(srcHtml)) {
        return res.status(400).json({ error: `Page not built: ${page.name}` });
      }

      const destDir = path.join(tmpDir, page.configType);
      fs.mkdirSync(destDir, { recursive: true });

      let html = fs.readFileSync(srcHtml, 'utf8');
      // Rewrite all photo/logo paths to relative ../photos/ and ../logos/
      html = html.replace(/(["'(])(?:\.\.\/)*(?:output\/)?(?:brand_assets\/)?photos\//g, '$1../photos/');
      html = html.replace(/(["'(])(?:\.\.\/)*(?:output\/)?(?:brand_assets\/)?logos\//g, '$1../logos/');
      fs.writeFileSync(path.join(destDir, 'index.html'), html);
    }

    // Copy photos and logos from both output/ and brand_assets/
    fs.mkdirSync(path.join(tmpDir, 'photos'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'logos'), { recursive: true });

    for (const src of [path.join(ROOT, 'brand_assets', 'photos'), path.join(ROOT, 'output', 'photos')]) {
      if (fs.existsSync(src)) fs.cpSync(src, path.join(tmpDir, 'photos'), { recursive: true });
    }
    for (const src of [path.join(ROOT, 'brand_assets', 'logos'), path.join(ROOT, 'output', 'logos')]) {
      if (fs.existsSync(src)) fs.cpSync(src, path.join(tmpDir, 'logos'), { recursive: true });
    }

    // Root redirect → landing_page
    fs.writeFileSync(path.join(tmpDir, 'index.html'),
      '<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=/landing_page/"></head><body>Redirecting...</body></html>');

    emitMessage(job.id, 'Deploying to Vercel...');

    const output = execSync('npx vercel deploy --prod --yes', {
      cwd: tmpDir,
      encoding: 'utf8',
      timeout: 120000
    });

    const deployUrl = output.trim().split('\n').pop().trim();
    job.deployUrl = deployUrl;
    job.status = 'deployed';

    emitSSE(job.id, 'status', { status: 'deployed' });
    emitMessage(job.id, `\u2713 Deployed to ${deployUrl}`);

    // Build per-page URLs
    const urls = {};
    for (const page of job.pages) {
      urls[page.pageType] = `${deployUrl}/${page.configType}/`;
    }

    // Cleanup temp dir
    fs.rmSync(tmpDir, { recursive: true, force: true });

    res.json({ urls });
  } catch (err) {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    res.status(500).json({ error: `Deploy failed: ${err.message}` });
  }
});

// ── 10. POST /api/jobs/:jobId/progress — Internal helper for Claude Code ────
app.post('/api/jobs/:jobId/progress', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const { message, pageIndex, pageStatus, jobStatus } = req.body;

  if (message) emitMessage(job.id, message);

  if (pageIndex !== undefined && pageStatus) {
    const page = job.pages[pageIndex];
    if (page) {
      page.qaStatus = pageStatus;
      emitSSE(job.id, 'page', { pageIndex, status: pageStatus });

      // Invalidate screenshot cache when page changes
      if (['building', 'qa', 'changes_requested'].includes(pageStatus)) {
        const screenshotDir = path.join(ROOT, 'temporary screenshots');
        for (const vp of ['mobile', 'desktop']) {
          const cp = path.join(screenshotDir, `${job.id}-${page.pageType}-${vp}.png`);
          if (fs.existsSync(cp)) fs.unlinkSync(cp);
        }
      }
    }
  }

  if (jobStatus) {
    job.status = jobStatus;
    emitSSE(job.id, 'status', { status: jobStatus });
  }

  res.json({ ok: true });
});

// ── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Funnel Designer server running at http://localhost:${PORT}`);
});
