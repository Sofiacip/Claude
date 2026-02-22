/**
 * builder.js — Stage 3 utilities for page generation.
 *
 * This module provides helper functions for Claude Code to use when
 * generating pages. Claude Code writes the HTML directly — no API calls.
 *
 * Usage (by Claude Code during pipeline):
 *   1. Read the job state: GET /api/jobs/:id
 *   2. Read template + brand + mapped copy
 *   3. Generate HTML using frontend-design skill
 *   4. Write HTML to output dir via: POST /api/jobs/:id/pages/:idx/html (upload)
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, basename } from 'path';

/**
 * Prepare the build context for a single page.
 * Returns all data Claude Code needs to generate the HTML.
 */
export async function prepareBuildContext(job, pageIndex) {
  const page = job.pages[pageIndex];

  // Load template
  const templateJson = await readFile(page.templatePath, 'utf-8');
  const template = JSON.parse(templateJson);

  // Brand info
  const brandColors = job.brand.colors.map(c =>
    `${c.name || 'Color'}: ${c.hex} — ${c.usage || ''}`
  ).join('\n');

  const brandFonts = job.brand.fonts.map(f =>
    `${f.role}: ${f.name} (weight: ${f.weight || '400'})`
  ).join('\n');

  const logoFilename = job.brand.logoPath ? basename(job.brand.logoPath) : null;
  const photoFilenames = job.brand.photoPaths.map(p => basename(p));

  return {
    template,
    brand: {
      colors: brandColors,
      fonts: brandFonts,
      logoFilename,
      photoFilenames,
      brandGuide: job.brand.brandGuide
    },
    copySlots: page.copySlots,
    missingSlots: page.missingSlots,
    qaFeedback: page.qaFeedback
  };
}

/**
 * Save generated HTML for a page.
 */
export async function savePageHtml(job, pageIndex, html) {
  const page = job.pages[pageIndex];
  const outputDir = join(job.tempDir, 'output', page.pageType);
  await mkdir(outputDir, { recursive: true });
  const htmlPath = join(outputDir, 'index.html');
  await writeFile(htmlPath, html, 'utf-8');
  page.htmlPath = htmlPath;
  return htmlPath;
}
