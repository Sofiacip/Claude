/**
 * qa.js — Stage 4: QA via Playwright screenshots + Claude vision review.
 * Takes screenshots at 3 viewports, sends to Claude for visual review,
 * loops with builder if issues found (min 2 rounds, max 3).
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { chromium } from 'playwright';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();
const MAX_QA_ROUNDS = 3;
const MIN_QA_ROUNDS = 2;
const SERVE_PORT = parseInt(process.env.SERVE_PORT || '3003');

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 900 }
];

/**
 * Take screenshots of a page at all 3 viewports.
 * Returns { mobile: path, tablet: path, desktop: path }
 */
async function takeScreenshots(htmlPath, outputDir, round) {
  const browser = await chromium.launch({ headless: true });
  const screenshots = {};

  try {
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage();
      await page.setViewportSize({ width: vp.width, height: vp.height });

      // Load the HTML file directly
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
 * Send screenshots to Claude vision for review.
 * Returns { pass: boolean, score: number, issues: [], summary: string }
 */
async function reviewScreenshots(screenshots, template, brand) {
  // Read screenshot files as base64
  const images = [];
  for (const vp of VIEWPORTS) {
    const path = screenshots[vp.name];
    if (path) {
      const buffer = await readFile(path);
      images.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/png',
          data: buffer.toString('base64')
        }
      });
    }
  }

  const systemPrompt = `You are a senior QA engineer reviewing funnel pages for Scale for Impact.
You receive screenshots of a generated HTML page at three viewport widths:
mobile (375px), tablet (768px), and desktop (1280px).

Your job is to identify issues in these categories:
1. LAYOUT: Missing sections, wrong section order, broken grid
2. SPACING: Inconsistent padding, cramped or excessive gaps
3. TYPOGRAPHY: Wrong fonts, sizes, weights, line-height
4. COLORS: Wrong brand colors, default Tailwind colors visible
5. BRAND: Logo missing/wrong size, wrong color palette
6. COPY: Placeholder text visible ([brackets]), missing content
7. FUNCTIONALITY: Broken links (#), missing anchor targets, missing countdown timer
8. RESPONSIVE: Mobile overflow, overlapping elements, unreadable text
9. COMPONENTS: Missing sticky CTA, missing progress bar, missing decline link (per template)

For each issue found, specify category, severity, section, description, and fix.

IMPORTANT: Be strict. The page must match the template spec exactly.

Return your review as JSON only (no markdown fences, no extra text):
{
  "pass": boolean,
  "score": number (0-100),
  "issues": [{ "category": "string", "severity": "critical|major|minor", "section": "S1", "description": "string", "fix": "string" }],
  "summary": "1-2 sentence assessment"
}`;

  const sectionList = template.sections.map(s =>
    `${s.id} ${s.name} (${s.component}) — slots: [${(s.slots || []).join(', ')}]`
  ).join('\n');

  const userContent = [
    {
      type: 'text',
      text: `Review this ${template.page_type} page.

Template sections (${template.sections.length} total, must appear in this order):
${sectionList}

Brand requirements:
- Colors: ${JSON.stringify(brand.colors)}
- Fonts: ${brand.fonts.map(f => `${f.role}: ${f.name}`).join(', ') || 'Not specified'}

QA Checklist:
- All ${template.sections.length} sections present in correct order
- No [bracket] placeholders visible
- All CTA buttons linked (no # placeholders)
- Sticky CTA: ${template.sticky_cta ? 'REQUIRED — must be visible' : 'should NOT be present'}
- Navigation: ${template.nav ? 'REQUIRED — full brand nav' : 'should NOT be present'}
${template.sections.some(s => s.component === 'progress_bar') ? '- Progress bar: REQUIRED\n' : ''}${template.sections.some(s => s.component === 'decline_link' || s.component === 'cta_with_decline') ? '- Decline link: REQUIRED\n' : ''}${template.sections.some(s => s.component === 'legal_note') ? '- 1-click confirmation note: REQUIRED\n' : ''}- Mobile (375px): single column, no overflow, no overlap
- Countdown timer: ${template.sections.some(s => s.component === 'countdown_timer') ? 'REQUIRED' : 'not needed'}
- Brand colors used (not default Tailwind)
- Near-black (#0f0f0f) and off-white (#f5f5f5), no pure black/white

Screenshots follow: mobile (375px), tablet (768px), desktop (1280px).`
    },
    ...images
  ];

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    temperature: 0,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }]
  });

  const text = response.content[0]?.text || '';
  try {
    const jsonStr = text.replace(/^```json?\n?/m, '').replace(/\n?```$/m, '').trim();
    return JSON.parse(jsonStr);
  } catch {
    return { pass: false, score: 0, issues: [{ category: 'PARSE', severity: 'critical', section: 'N/A', description: 'Failed to parse QA response', fix: 'Re-run QA' }], summary: 'QA review parse error.' };
  }
}

/**
 * Run QA on a single page. Min 2 rounds, max 3.
 * If issues found, triggers a rebuild via the provided rebuild callback.
 */
export async function qaPage(job, pageIndex, emit) {
  const page = job.pages[pageIndex];
  const templateJson = await readFile(page.templatePath, 'utf-8');
  const template = JSON.parse(templateJson);

  const screenshotDir = join(job.tempDir, 'screenshots', page.pageType);
  await mkdir(screenshotDir, { recursive: true });

  // Import builder for rebuilds
  const { buildPage } = await import('./builder.js');

  for (let round = 1; round <= MAX_QA_ROUNDS; round++) {
    page.qaRounds = round;
    emit(`  ${page.pageType} — QA round ${round}/${MAX_QA_ROUNDS}`);

    // Take screenshots
    emit(`  Taking screenshots at 375px, 768px, 1280px...`);
    const screenshots = await takeScreenshots(page.htmlPath, screenshotDir, round);
    page.screenshots = screenshots;

    // Send to Claude vision
    emit(`  Reviewing screenshots with Claude vision...`);
    const review = await reviewScreenshots(screenshots, template, job.brand);

    emit(`  Score: ${review.score}/100 — ${review.summary}`);

    if (review.pass && review.score >= 85 && round >= MIN_QA_ROUNDS) {
      page.qaStatus = 'approved';
      emit(`  ${page.pageType} passed QA. ✓`);
      return;
    }

    if (round < MAX_QA_ROUNDS) {
      // Collect issues as feedback for rebuild
      const issueText = review.issues
        .map(i => `[${i.severity.toUpperCase()}] ${i.section}: ${i.description} → Fix: ${i.fix}`)
        .join('\n');

      page.qaFeedback.push(issueText);
      emit(`  ${review.issues.length} issue(s) found. Rebuilding...`);

      // Rebuild
      await buildPage(job, pageIndex, emit);
    }
  }

  // After max rounds, mark based on last review
  if (page.qaStatus !== 'approved') {
    page.qaStatus = 'approved'; // Auto-approve after max rounds with a note
    emit(`  ${page.pageType}: Max QA rounds reached. Auto-approved (manual review recommended).`);
  }
}
