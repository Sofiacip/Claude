/**
 * qa.js — Stage 4 utilities for QA screenshots.
 *
 * Takes Playwright screenshots of both the REFERENCE page and the BUILT page
 * at 3 viewports (375, 768, 1280). Claude Code reads the screenshots and
 * performs the visual comparison directly. No external API calls.
 */

import { mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { chromium } from 'playwright';
import http from 'http';

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 900 }
];

/**
 * Serve a local HTML file on a temporary port and return the server + URL.
 * Used to serve reference HTML so Playwright can load it via localhost
 * (Tailwind CDN and other resources require HTTP, not file://).
 */
async function serveLocalFile(htmlPath) {
  const html = await readFile(htmlPath, 'utf-8');
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    });
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
    server.on('error', reject);
  });
}

/**
 * Take screenshots of a URL at all 3 viewports using a shared browser instance.
 * Returns { mobile: path, tablet: path, desktop: path }
 */
async function screenshotUrl(browser, pageUrl, outputDir, prefix) {
  await mkdir(outputDir, { recursive: true });
  const screenshots = {};

  for (const vp of VIEWPORTS) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });

    // Wait for fonts and images
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle').catch(() => {});

    const filename = `${prefix}_${vp.width}.png`;
    const screenshotPath = join(outputDir, filename);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    screenshots[vp.name] = screenshotPath;

    await page.close();
  }

  return screenshots;
}

/**
 * Take screenshots of a page at all 3 viewports.
 * Loads the HTML from the server URL so asset references resolve correctly.
 * Returns { mobile: path, tablet: path, desktop: path }
 */
export async function takeScreenshots(pageUrl, outputDir, round = 1) {
  await mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const screenshots = {};

  try {
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage();
      await page.setViewportSize({ width: vp.width, height: vp.height });

      // Load from server URL so /api/jobs/.../assets/... URLs resolve
      await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });

      // Wait for fonts and images
      await page.waitForTimeout(2000);
      await page.waitForLoadState('networkidle').catch(() => {});

      const screenshotPath = join(outputDir, `round${round}-${vp.name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      screenshots[vp.name] = screenshotPath;

      await page.close();
    }
  } finally {
    await browser.close();
  }

  return screenshots;
}

/**
 * Take comparison screenshots: both reference and built page at all 3 viewports.
 * Returns { reference: { mobile, tablet, desktop }, built: { mobile, tablet, desktop } }
 */
export async function takeComparisonScreenshots(job, pageIndex, round = 1) {
  const page = job.pages[pageIndex];
  if (!page.htmlPath) throw new Error(`No HTML for ${page.pageType}`);

  const screenshotDir = join(job.tempDir, 'screenshots', page.pageType);
  await mkdir(screenshotDir, { recursive: true });

  const port = process.env.PORT || 3002;
  const builtUrl = `http://localhost:${port}/api/jobs/${job.id}/pages/${pageIndex}/html`;

  // Find the reference HTML file
  const referencePath = page.referencePath;
  if (!referencePath || !existsSync(referencePath)) {
    throw new Error(
      `Reference HTML not found for ${page.pageType} at ${referencePath || '(no path)'}. ` +
      `Cannot perform comparison QA without a reference.`
    );
  }

  const browser = await chromium.launch({ headless: true });
  let refServer = null;

  try {
    // Serve the reference HTML on a temporary port
    refServer = await serveLocalFile(referencePath);

    // Screenshot reference at all 3 widths
    const referenceScreenshots = await screenshotUrl(
      browser, refServer.url, screenshotDir, `${page.pageType}_reference`
    );

    // Screenshot built page at all 3 widths
    const builtScreenshots = await screenshotUrl(
      browser, builtUrl, screenshotDir, `${page.pageType}_built`
    );

    // Store on page entry
    page.screenshots = {
      reference: referenceScreenshots,
      built: builtScreenshots
    };
    page.qaRounds = round;

    return page.screenshots;
  } finally {
    await browser.close();
    if (refServer) refServer.server.close();
  }
}

/**
 * Take screenshots for a job page and store paths on the page entry.
 * (Legacy single-page screenshot — still available for backward compat.)
 */
export async function screenshotPage(job, pageIndex, round = 1) {
  const page = job.pages[pageIndex];
  if (!page.htmlPath) throw new Error(`No HTML for ${page.pageType}`);

  const screenshotDir = join(job.tempDir, 'screenshots', page.pageType);
  const port = process.env.PORT || 3002;
  const pageUrl = `http://localhost:${port}/api/jobs/${job.id}/pages/${pageIndex}/html`;
  const screenshots = await takeScreenshots(pageUrl, screenshotDir, round);
  page.screenshots = screenshots;
  page.qaRounds = round;
  return screenshots;
}
