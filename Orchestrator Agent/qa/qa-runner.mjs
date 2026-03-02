#!/usr/bin/env node

/**
 * qa-runner.mjs — Output QA Runner for funnel pages.
 *
 * Runs structural checks (Playwright) and visual comparison (Claude Code CLI)
 * against golden screenshots to verify page quality.
 *
 * Usage:
 *   node qa/qa-runner.mjs landing_page              # QA one page (~15s structural, ~2min with visual)
 *   node qa/qa-runner.mjs --all                      # QA all 6 pages
 *   node qa/qa-runner.mjs landing_page --html-dir /p # Custom HTML source
 *   node qa/qa-runner.mjs --generate                 # Generate from golden inputs then QA
 *
 * Exit codes: 0=PASS, 1=FAIL, 2=Fatal
 */

import http from 'http';
import { readFile, mkdir, writeFile, cp, rm } from 'fs/promises';
import { join, extname, dirname, resolve } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { tmpdir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const QA_ROOT = __dirname;

// ─── Constants ──────────────────────────────────────────────────

const PAGE_TYPES = [
  'landing_page',
  'sales_page',
  'thank_you_page',
  'upgrade_page',
  'upsell_page',
  'replay_page',
];

const BREAKPOINTS = [
  { name: 'mobile', suffix: 'mobile-375', width: 375, height: 812 },
  { name: 'tablet', suffix: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop', suffix: 'desktop-1280', width: 1280, height: 900 },
];

const VISUAL_DIMENSIONS = [
  'layout_match',
  'visual_quality',
  'brand_consistency',
  'mobile_readiness',
  'content_completeness',
];

// Visual pass thresholds
const VISUAL_MIN_SCORE = 5;
const VISUAL_MIN_AVG = 7;
const VISUAL_MIN_EACH = 7;

// Brand colors extracted from Pattie Ehsaei funnel pages
const BRAND_COLORS = [
  '#34161B', // brand-dark
  '#6B1A2C', // burgundy
  '#F2C5C8', // blush
  '#F5D8D9', // blush-light
  '#FAF0E6', // ivory
  '#C9A84C', // gold
  '#E8556D', // coral
  '#F48A96', // coral-soft
];

const PLACEHOLDER_PATTERNS = [
  /\{\{[^}]+\}\}/,
  /\[TBD\]/i,
  /lorem ipsum/i,
  /placeholder/i,
  /\[INSERT/i,
  /\[YOUR/i,
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
};

// Default funnel-designer output path
const DEFAULT_OUTPUT_DIR = join(__dirname, '..', '..', 'funnel-designer', 'output');

// ─── OutputQARunner Class ───────────────────────────────────────

export class OutputQARunner {
  constructor(opts = {}) {
    this.qaRoot = opts.qaRoot || QA_ROOT;
    this.goldenDir = join(this.qaRoot, 'golden-outputs');
    this.resultsDir = join(this.qaRoot, 'results');
    this.screenshotsDir = join(this.qaRoot, 'task-screenshots');
    this.goldenInputsDir = join(this.qaRoot, 'golden-inputs');
    this.verbose = opts.verbose ?? true;
  }

  // ─── Public API ─────────────────────────────────────────────

  /**
   * QA a single page type.
   * @param {string} pageType - e.g. 'landing_page'
   * @param {string} htmlDir - root dir containing {pageType}/index.html, logos/, photos/
   * @returns {object} result JSON
   */
  async runPage(pageType, htmlDir) {
    const startTime = Date.now();
    htmlDir = htmlDir || DEFAULT_OUTPUT_DIR;

    this.log(`\n${'='.repeat(60)}`);
    this.log(`QA: ${pageType}`);
    this.log(`Source: ${htmlDir}`);
    this.log('='.repeat(60));

    // Validate page exists
    const htmlPath = join(htmlDir, pageType, 'index.html');
    if (!existsSync(htmlPath)) {
      return this._fatalResult(pageType, `HTML not found: ${htmlPath}`, startTime);
    }

    // Resolve workspace root (for brand_assets serving)
    const workspaceRoot = this._resolveWorkspaceRoot(htmlDir, pageType);

    // Ensure output dirs exist
    await mkdir(this.screenshotsDir, { recursive: true });
    await mkdir(this.resultsDir, { recursive: true });

    let server, port, browser;
    try {
      // 1. Start server
      ({ server, port } = await this._startServer(htmlDir, workspaceRoot));
      this.log(`Server running on http://localhost:${port}`);

      // 2. Load Playwright
      const pw = await this._loadPlaywright();
      browser = await pw.chromium.launch();

      // 3. Screenshot at 3 breakpoints
      const url = `http://localhost:${port}/${pageType}/`;
      const screenshots = await this._screenshotBreakpoints(browser, url, pageType);

      // 4. Run structural checks
      const structural = await this._runStructuralChecks(browser, url, htmlPath);

      // 5. Visual comparison
      const visual = await this._runVisualComparison(pageType);

      // 6. Build result
      const passed = structural.passed && visual.passed;
      const result = {
        pageType,
        passed,
        timestamp: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        structural,
        visual,
        screenshots,
      };

      // 7. Write result
      await this._writeResult(pageType, result);

      this.log(`\n${passed ? 'PASS' : 'FAIL'}: ${pageType} (${result.duration_ms}ms)`);
      return result;
    } finally {
      if (browser) await browser.close().catch(() => {});
      if (server) server.close();
    }
  }

  /**
   * QA all 6 page types sequentially.
   */
  async runAll(htmlDir) {
    htmlDir = htmlDir || DEFAULT_OUTPUT_DIR;
    const results = {};
    let allPassed = true;

    for (const pageType of PAGE_TYPES) {
      const htmlPath = join(htmlDir, pageType, 'index.html');
      if (!existsSync(htmlPath)) {
        this.log(`\nSkipping ${pageType} — no index.html`);
        continue;
      }
      const result = await this.runPage(pageType, htmlDir);
      results[pageType] = result;
      if (!result.passed) allPassed = false;
    }

    this.log(`\n${'='.repeat(60)}`);
    this.log(`Overall: ${allPassed ? 'ALL PASSED' : 'SOME FAILED'}`);
    for (const [pt, r] of Object.entries(results)) {
      this.log(`  ${r.passed ? 'PASS' : 'FAIL'} ${pt}`);
    }
    this.log('='.repeat(60));

    return { passed: allPassed, results };
  }

  /**
   * Generate pages from golden inputs then QA them.
   * Uses Claude Code CLI to build each page, then runs QA.
   */
  async generateAndValidate(pageTypes) {
    pageTypes = pageTypes || PAGE_TYPES;
    const workspace = await this._setupGenerationWorkspace();
    this.log(`Generation workspace: ${workspace}`);

    const results = {};
    let allPassed = true;

    for (const pageType of pageTypes) {
      this.log(`\nGenerating ${pageType}...`);
      try {
        await this._generatePage(workspace, pageType);
        const result = await this.runPage(pageType, join(workspace, 'output'));
        results[pageType] = result;
        if (!result.passed) allPassed = false;
      } catch (err) {
        this.log(`Generation failed for ${pageType}: ${err.message}`);
        results[pageType] = this._fatalResult(pageType, `Generation failed: ${err.message}`, Date.now());
        allPassed = false;
      }
    }

    // Cleanup workspace
    try { await rm(workspace, { recursive: true, force: true }); } catch {}

    return { passed: allPassed, results };
  }

  // ─── Server ─────────────────────────────────────────────────

  _startServer(htmlDir, workspaceRoot) {
    return new Promise((resolve) => {
      const server = http.createServer(async (req, res) => {
        let urlPath = decodeURIComponent(req.url.split('?')[0]);
        let filePath;

        // Serve brand_assets from workspace root if available
        if (urlPath.startsWith('/brand_assets/') && workspaceRoot) {
          filePath = join(workspaceRoot, urlPath);
        } else if (urlPath === '/' || urlPath === '') {
          filePath = join(htmlDir, 'index.html');
        } else {
          filePath = join(htmlDir, urlPath);
        }

        // Directory → try index.html
        if (!extname(filePath)) {
          const withIndex = join(filePath, 'index.html');
          if (existsSync(withIndex)) filePath = withIndex;
          else filePath = filePath + '.html';
        }

        try {
          const data = await readFile(filePath);
          const ext = extname(filePath).toLowerCase();
          res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
          res.end(data);
        } catch {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found');
        }
      });

      server.listen(0, () => {
        resolve({ server, port: server.address().port });
      });
    });
  }

  // ─── Playwright ─────────────────────────────────────────────

  async _loadPlaywright() {
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const pwPath = join(__dirname, '..', '..', 'funnel-designer', 'node_modules', 'playwright');
    return require(pwPath);
  }

  async _screenshotBreakpoints(browser, url, pageType) {
    this.log('\nCapturing screenshots...');
    const screenshots = {};

    for (const bp of BREAKPOINTS) {
      const page = await browser.newPage({
        viewport: { width: bp.width, height: bp.height },
      });

      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1000); // Wait for fonts/images

      // Freeze animations and force all scroll-reveal elements visible
      await page.evaluate(() => {
        // Disable all CSS animations and transitions for deterministic screenshots
        const style = document.createElement('style');
        style.textContent = '*, *::before, *::after { animation: none !important; transition: none !important; }';
        document.head.appendChild(style);

        document.querySelectorAll('.reveal').forEach(el => {
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
          el.classList.add('visible');
        });
      });
      await page.waitForTimeout(500);

      const filename = `${pageType}-${bp.suffix}.png`;
      const screenshotPath = join(this.screenshotsDir, filename);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      await page.close();

      screenshots[bp.name] = `task-screenshots/${filename}`;
      this.log(`  ${bp.name} (${bp.width}px)`);
    }

    return screenshots;
  }

  // ─── Structural Checks ─────────────────────────────────────

  async _runStructuralChecks(browser, url, htmlPath) {
    this.log('\nRunning structural checks...');
    const checks = [];

    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();

    // Collect console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Track failed requests
    const failedRequests = [];
    page.on('requestfailed', req => {
      failedRequests.push(req.url());
    });

    // 1. page_loads
    try {
      const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      const status = response?.status() || 0;
      checks.push({
        name: 'page_loads',
        passed: status === 200,
        detail: `HTTP ${status}`,
      });
    } catch (err) {
      checks.push({ name: 'page_loads', passed: false, detail: err.message });
      // Can't continue if page didn't load
      await page.close();
      await context.close();
      return { passed: false, checks };
    }

    await page.waitForTimeout(2000); // Let fonts/images settle

    // 2. no_console_errors
    checks.push({
      name: 'no_console_errors',
      passed: consoleErrors.length === 0,
      detail: consoleErrors.length === 0
        ? 'No console errors'
        : `${consoleErrors.length} error(s): ${consoleErrors.slice(0, 3).join('; ')}`,
    });

    // 3. all_images_load
    const brokenImages = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return imgs.filter(img => !img.complete || img.naturalWidth === 0).map(img => img.src);
    });
    const allBrokenImages = [...brokenImages, ...failedRequests.filter(u => /\.(png|jpg|jpeg|gif|svg|webp)(\?|$)/i.test(u))];
    checks.push({
      name: 'all_images_load',
      passed: allBrokenImages.length === 0,
      detail: allBrokenImages.length === 0
        ? 'All images loaded'
        : `${allBrokenImages.length} broken: ${allBrokenImages.slice(0, 3).join(', ')}`,
    });

    // 4. has_content
    const elementCount = await page.evaluate(() => document.querySelectorAll('*').length);
    checks.push({
      name: 'has_content',
      passed: elementCount >= 50,
      detail: `${elementCount} elements`,
    });

    // 5. mobile_viewport
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(500);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    checks.push({
      name: 'mobile_viewport',
      passed: scrollWidth <= 375,
      detail: `scrollWidth=${scrollWidth} at 375px viewport`,
    });
    // Reset viewport
    await page.setViewportSize({ width: 1280, height: 900 });

    // 6. brand_colors — check raw HTML source
    const htmlSource = await readFile(htmlPath, 'utf-8');
    const htmlUpper = htmlSource.toUpperCase();
    const foundColors = BRAND_COLORS.filter(c => htmlUpper.includes(c.toUpperCase()));
    checks.push({
      name: 'brand_colors',
      passed: foundColors.length >= 3,
      detail: `${foundColors.length}/${BRAND_COLORS.length} brand colors found: ${foundColors.join(', ')}`,
    });

    // 7. copy_filled — check for placeholder text
    const bodyText = await page.evaluate(() => document.body.innerText);
    const foundPlaceholders = PLACEHOLDER_PATTERNS.filter(p => p.test(bodyText));
    checks.push({
      name: 'copy_filled',
      passed: foundPlaceholders.length === 0,
      detail: foundPlaceholders.length === 0
        ? 'No placeholder text found'
        : `Placeholders found: ${foundPlaceholders.map(p => p.source).join(', ')}`,
    });

    // 8. links_work — check internal anchors
    const brokenAnchors = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href^="#"]'));
      return anchors.filter(a => {
        const id = a.getAttribute('href').slice(1);
        return id && !document.getElementById(id);
      }).map(a => a.getAttribute('href'));
    });
    checks.push({
      name: 'links_work',
      passed: brokenAnchors.length === 0,
      detail: brokenAnchors.length === 0
        ? 'All internal anchors valid'
        : `${brokenAnchors.length} broken: ${brokenAnchors.slice(0, 5).join(', ')}`,
    });

    // 9. responsive_meta
    const hasViewportMeta = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="viewport"]');
      return meta?.content?.includes('width=device-width') || false;
    });
    checks.push({
      name: 'responsive_meta',
      passed: hasViewportMeta,
      detail: hasViewportMeta ? 'viewport meta present' : 'Missing width=device-width',
    });

    // 10. fonts_loaded — check for Google Fonts or @font-face
    const hasFonts = htmlSource.includes('fonts.googleapis.com') ||
      htmlSource.includes('@font-face') ||
      htmlSource.includes('fonts.gstatic.com');
    checks.push({
      name: 'fonts_loaded',
      passed: hasFonts,
      detail: hasFonts ? 'Font loading detected' : 'No font loading found',
    });

    await page.close();
    await context.close();

    const allPassed = checks.every(c => c.passed);
    for (const c of checks) {
      this.log(`  ${c.passed ? 'PASS' : 'FAIL'} ${c.name}: ${c.detail}`);
    }

    return { passed: allPassed, checks };
  }

  // ─── Visual Comparison ──────────────────────────────────────

  async _runVisualComparison(pageType) {
    this.log('\nRunning visual comparison...');

    // Check if golden outputs exist
    const goldenPageDir = join(this.goldenDir, pageType);
    if (!existsSync(goldenPageDir)) {
      this.log('  Skipped — no golden outputs found');
      return { passed: true, skipped: true, breakpoints: {}, aggregate: {} };
    }

    const breakpointResults = {};
    const allScores = [];

    for (const bp of BREAKPOINTS) {
      const goldenPath = join(goldenPageDir, `${bp.suffix}.png`);
      const testPath = join(this.screenshotsDir, `${pageType}-${bp.suffix}.png`);

      if (!existsSync(goldenPath)) {
        this.log(`  Skipped ${bp.name} — no golden screenshot`);
        breakpointResults[bp.name] = { skipped: true };
        continue;
      }

      if (!existsSync(testPath)) {
        this.log(`  Skipped ${bp.name} — no test screenshot`);
        breakpointResults[bp.name] = { skipped: true };
        continue;
      }

      try {
        const scores = await this._compareVisual(testPath, goldenPath, bp.name);
        const avg = VISUAL_DIMENSIONS.reduce((s, d) => s + (scores[d] || 0), 0) / VISUAL_DIMENSIONS.length;
        const bpPassed = VISUAL_DIMENSIONS.every(d => (scores[d] || 0) >= VISUAL_MIN_SCORE) &&
          avg >= VISUAL_MIN_AVG;

        breakpointResults[bp.name] = {
          ...scores,
          average: Math.round(avg * 10) / 10,
          passed: bpPassed,
        };

        allScores.push(...VISUAL_DIMENSIONS.map(d => scores[d] || 0));
        this.log(`  ${bp.name}: avg=${breakpointResults[bp.name].average} ${bpPassed ? 'PASS' : 'FAIL'}`);
      } catch (err) {
        this.log(`  ${bp.name}: comparison failed — ${err.message}`);
        breakpointResults[bp.name] = { error: err.message, passed: false };
        allScores.push(0);
      }
    }

    const aggregate = this._aggregateVisualScores(allScores);
    const passed = Object.values(breakpointResults).every(b => b.skipped || b.passed) && aggregate.passed;

    return { passed, skipped: false, breakpoints: breakpointResults, aggregate };
  }

  async _compareVisual(testPath, goldenPath, breakpointName) {
    const prompt = `You are a visual QA comparison tool. Compare two screenshots of the SAME web page rendered from identical HTML source code. Minor rendering differences (subpixel shifts, font hinting, anti-aliasing) are expected and should NOT lower scores.

GOLDEN (reference) screenshot: ${goldenPath}
TEST (new) screenshot: ${testPath}

Read both image files and compare them. Score each dimension from 1-10:

1. layout_match — Same section order, same grid/flex structure, same element positioning? Minor pixel shifts are fine (9-10). Score low only for missing sections, collapsed layouts, or broken grids.
2. visual_quality — No rendering glitches, broken images, or overlapping text? Score high (8-10) if both look polished. Score low only for visible defects.
3. brand_consistency — Same color palette, same fonts, same imagery? If the pages use the same colors and fonts, score 9-10.
4. mobile_readiness — Content readable and properly sized for the "${breakpointName}" breakpoint? No horizontal overflow?
5. content_completeness — Same number of content sections visible in both? Score 9-10 if all sections match. Score low only if whole sections are missing or empty.

IMPORTANT: These screenshots are from the same HTML file. If they look substantially the same, scores should be 8-10. Only score below 7 if there are REAL defects (missing content, broken layout, wrong colors).

Respond with ONLY a JSON object, no markdown fences, no explanation:
{"layout_match":N,"visual_quality":N,"brand_consistency":N,"mobile_readiness":N,"content_completeness":N}`;

    const stdout = await this._runClaudeCode(prompt);
    return this._parseVisualScores(stdout);
  }

  _parseVisualScores(stdout) {
    // Extract JSON from Claude output — may contain extra text
    const jsonMatch = stdout.match(/\{[^{}]*"layout_match"[^{}]*\}/);
    if (!jsonMatch) {
      throw new Error(`Could not parse visual scores from output: ${stdout.slice(0, 200)}`);
    }

    const scores = JSON.parse(jsonMatch[0]);

    // Validate all dimensions present and numeric
    for (const dim of VISUAL_DIMENSIONS) {
      if (typeof scores[dim] !== 'number' || scores[dim] < 1 || scores[dim] > 10) {
        throw new Error(`Invalid score for ${dim}: ${scores[dim]}`);
      }
    }

    return scores;
  }

  _aggregateVisualScores(allScores) {
    if (allScores.length === 0) return { passed: true, min_score: 0, overall_average: 0 };

    const min = Math.min(...allScores);
    const avg = allScores.reduce((s, v) => s + v, 0) / allScores.length;
    const passed = min >= VISUAL_MIN_SCORE && avg >= VISUAL_MIN_AVG;

    return {
      min_score: min,
      overall_average: Math.round(avg * 10) / 10,
      passed,
    };
  }

  // ─── Claude Code CLI ────────────────────────────────────────

  _runClaudeCode(prompt) {
    return new Promise((resolve, reject) => {
      const childEnv = { ...process.env };
      delete childEnv.CLAUDECODE;

      const proc = spawn('claude', [
        '--print',
        '--dangerously-skip-permissions',
        '--output-format', 'text',
        '--max-turns', '3',
      ], {
        cwd: this.qaRoot,
        env: childEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', d => { stdout += d.toString(); });
      proc.stderr.on('data', d => { stderr += d.toString(); });

      proc.stdin.write(prompt);
      proc.stdin.end();

      const timeout = setTimeout(() => {
        proc.kill('SIGTERM');
        reject(new Error('Visual comparison timed out after 5 minutes'));
      }, 5 * 60 * 1000);

      proc.on('close', code => {
        clearTimeout(timeout);
        if (code === 0) resolve(stdout.trim());
        else reject(new Error(`Claude Code exited with code ${code}: ${stderr.slice(-300)}`));
      });

      proc.on('error', err => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  // ─── Result Writing ─────────────────────────────────────────

  async _writeResult(pageType, result) {
    await mkdir(this.resultsDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${timestamp}_${pageType}.json`;
    const filePath = join(this.resultsDir, filename);
    await writeFile(filePath, JSON.stringify(result, null, 2));
    this.log(`Result written to: ${filePath}`);
  }

  // ─── Generation Helpers ─────────────────────────────────────

  _resolveWorkspaceRoot(htmlDir, pageType) {
    // Walk up from htmlDir looking for brand_assets/
    let dir = resolve(htmlDir);
    for (let i = 0; i < 5; i++) {
      if (existsSync(join(dir, 'brand_assets'))) return dir;
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    // Fall back to funnel-designer root
    const funnelRoot = join(__dirname, '..', '..', 'funnel-designer');
    if (existsSync(join(funnelRoot, 'brand_assets'))) return funnelRoot;
    return null;
  }

  async _setupGenerationWorkspace() {
    const workspace = join(tmpdir(), `qa-gen-${Date.now()}`);
    await mkdir(join(workspace, 'output'), { recursive: true });

    // Copy golden inputs
    const brandZip = join(this.goldenInputsDir, 'brand_package.zip');
    if (existsSync(brandZip)) {
      await cp(brandZip, join(workspace, 'brand_package.zip'));
    }

    const copyDir = join(this.goldenInputsDir, 'copy');
    if (existsSync(copyDir)) {
      await cp(copyDir, join(workspace, 'copy'), { recursive: true });
    }

    const refDir = join(this.goldenInputsDir, 'reference');
    if (existsSync(refDir)) {
      await cp(refDir, join(workspace, 'reference'), { recursive: true });
    }

    return workspace;
  }

  async _generatePage(workspace, pageType) {
    const prompt = `Build a funnel page of type "${pageType}" using the brand assets in ${workspace}/brand_package.zip, the copy document for this page in ${workspace}/copy/, and the reference screenshot in ${workspace}/reference/${pageType}.png.

Output the finished HTML file to ${workspace}/output/${pageType}/index.html.

The page should be a complete, self-contained HTML file using Tailwind CDN, Google Fonts, and inline assets where needed.`;

    const stdout = await this._runClaudeCode(prompt);
    const outputPath = join(workspace, 'output', pageType, 'index.html');
    if (!existsSync(outputPath)) {
      throw new Error(`Generation did not produce ${outputPath}`);
    }
    return outputPath;
  }

  // ─── Fatal Result Helper ────────────────────────────────────

  _fatalResult(pageType, message, startTime) {
    return {
      pageType,
      passed: false,
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      error: message,
      structural: { passed: false, checks: [] },
      visual: { passed: false, skipped: true, breakpoints: {}, aggregate: {} },
      screenshots: {},
    };
  }

  // ─── Logging ────────────────────────────────────────────────

  log(msg) {
    if (this.verbose) console.log(msg);
  }
}

// ─── CLI Entry Point ──────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`Usage:
  node qa/qa-runner.mjs <page_type>              # QA one page
  node qa/qa-runner.mjs --all                     # QA all 6 pages
  node qa/qa-runner.mjs <page_type> --html-dir /p # Custom HTML source
  node qa/qa-runner.mjs --generate                # Generate from golden inputs then QA

Page types: ${PAGE_TYPES.join(', ')}
Exit codes: 0=PASS, 1=FAIL, 2=Fatal`);
    process.exit(0);
  }

  const isAll = args.includes('--all');
  const isGenerate = args.includes('--generate');
  const htmlDirIdx = args.indexOf('--html-dir');
  const htmlDir = htmlDirIdx >= 0 ? args[htmlDirIdx + 1] : undefined;

  const runner = new OutputQARunner();

  try {
    if (isGenerate) {
      // Filter to specific page types if provided
      const pageTypes = args.filter(a => !a.startsWith('--') && PAGE_TYPES.includes(a));
      const result = await runner.generateAndValidate(pageTypes.length ? pageTypes : undefined);
      process.exit(result.passed ? 0 : 1);
    }

    if (isAll) {
      const result = await runner.runAll(htmlDir);
      process.exit(result.passed ? 0 : 1);
    }

    // Single page type
    const pageType = args.find(a => !a.startsWith('--') && PAGE_TYPES.includes(a));
    if (!pageType) {
      console.error(`Error: specify a page type or --all\nValid types: ${PAGE_TYPES.join(', ')}`);
      process.exit(2);
    }

    const result = await runner.runPage(pageType, htmlDir);
    process.exit(result.passed ? 0 : 1);
  } catch (err) {
    console.error(`Fatal error: ${err.message}`);
    if (runner.verbose) console.error(err.stack);
    process.exit(2);
  }
}

// Run CLI if invoked directly
const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith('qa-runner.mjs') ||
  process.argv[1].endsWith('qa/qa-runner.mjs')
);
if (isDirectRun) {
  main();
}
