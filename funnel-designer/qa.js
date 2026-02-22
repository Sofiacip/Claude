/**
 * qa.js — Stage 4 utilities for QA screenshots.
 *
 * Takes Playwright screenshots at 3 viewports. Claude Code reads
 * the screenshots and performs the visual review directly.
 * No external API calls.
 */

import { readFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { chromium } from 'playwright';

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 900 }
];

/**
 * Take screenshots of a page at all 3 viewports.
 * Loads the HTML file directly (no server needed).
 * Returns { mobile: path, tablet: path, desktop: path }
 */
export async function takeScreenshots(htmlPath, outputDir, round = 1) {
  await mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const screenshots = {};

  try {
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage();
      await page.setViewportSize({ width: vp.width, height: vp.height });

      // Load HTML directly from file
      const htmlContent = await readFile(htmlPath, 'utf-8');
      await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });

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
 * Take screenshots for a job page and store paths on the page entry.
 */
export async function screenshotPage(job, pageIndex, round = 1) {
  const page = job.pages[pageIndex];
  if (!page.htmlPath) throw new Error(`No HTML for ${page.pageType}`);

  const screenshotDir = join(job.tempDir, 'screenshots', page.pageType);
  const screenshots = await takeScreenshots(page.htmlPath, screenshotDir, round);
  page.screenshots = screenshots;
  page.qaRounds = round;
  return screenshots;
}
