/**
 * @fileoverview Stage 3 — UX QA
 * Uses Playwright to render the wireframe and take a screenshot,
 * then asks Claude to evaluate quality against the brief.
 * If score < 95, applies Claude-generated fixes and retries.
 * Max iterations: UX_QA_MAX_ITERATIONS.
 */

import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { chromium } from 'playwright';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';

const client = new Anthropic({ apiKey: config.anthropicApiKey });

/**
 * @typedef {Object} QAResult
 * @property {number}   score  - 0–100 quality score
 * @property {string[]} issues - List of identified issues
 * @property {boolean}  pass   - true if score >= 95
 */

/**
 * Render HTML to a screenshot using Playwright.
 * @param {string} htmlPath - Absolute path to the HTML file
 * @returns {Promise<Buffer>} PNG screenshot buffer
 */
async function renderScreenshot(htmlPath) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });

  // Scroll to trigger lazy-load images
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);

  const screenshot = await page.screenshot({ fullPage: true });
  await browser.close();
  return screenshot;
}

/**
 * Ask Claude (vision) to evaluate the wireframe screenshot against the brief.
 * @param {Buffer} screenshot - PNG buffer
 * @param {Object} brief - Brief data
 * @param {string} html - Current HTML source
 * @returns {Promise<QAResult>}
 */
async function evaluateWithClaude(screenshot, brief, html) {
  const base64 = screenshot.toString('base64');

  const message = await client.messages.create({
    model: config.claudeModel,
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: base64 },
          },
          {
            type: 'text',
            text: `You are a senior UX QA reviewer for a marketing agency.

Evaluate this landing page wireframe screenshot against the following client brief.
This is a MULTI-SECTION landing page (e.g. webinar funnel, sales page) — the brief
specifies content for MANY page sections including hero, stats, pain points, benefits,
testimonials, bonuses, and closing CTA. ALL of these sections are intentional.

CLIENT BRIEF:
${JSON.stringify(brief, null, 2).slice(0, 4000)}

EVALUATION CRITERIA (each worth points):
1. Hero section has the correct headline, subheadline, and primary CTA (25 pts)
2. No placeholder text remains ("Placeholder", "Lorem ipsum", "TBD", "[insert", etc.) (25 pts)
3. All major page sections are present and visible per the brief (20 pts)
4. Content is on-brand and relevant to the brief topic — no leftover template content
   from a different product/client (20 pts)
5. Page is well-structured and professional (10 pts)

DO NOT penalize the page for having extra sections like pain points, benefits,
testimonials, bonuses, host bio, or a closing CTA — these are specified in the brief
and are intentional. Focus on whether the CONTENT matches the brief.

Respond ONLY with valid JSON matching this exact schema:
{
  "score": <integer 0-100>,
  "issues": ["<issue 1>", "<issue 2>"]
}

If there are no issues, return "issues": [].`,
          },
        ],
      },
    ],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '{}';

  // Extract JSON from response (Claude sometimes adds commentary)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Claude QA returned non-JSON response: ${text.slice(0, 200)}`);

  const result = JSON.parse(jsonMatch[0]);
  return {
    score: Number(result.score ?? 0),
    issues: Array.isArray(result.issues) ? result.issues : [],
    pass: Number(result.score ?? 0) >= 95,
  };
}

/**
 * Ask Claude to fix identified QA issues in the HTML.
 * @param {string} html - Current HTML
 * @param {QAResult} qa - QA evaluation result
 * @param {Object} brief - Brief data
 * @returns {Promise<string>} Fixed HTML
 */
async function fixWithClaude(html, qa, brief) {
  const issueList = qa.issues.map((i, n) => `${n + 1}. ${i}`).join('\n');

  const message = await client.messages.create({
    model: config.claudeModel,
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: `You are a senior front-end developer fixing a landing page wireframe.

The QA reviewer identified these issues (score: ${qa.score}/100):
${issueList}

CLIENT BRIEF (COMPLETE — including all page sections):
${JSON.stringify(brief, null, 2).slice(0, 4000)}

Fix ALL issues in the HTML below. Rules:
1. Preserve all data-slot and data-section attributes exactly as-is.
2. Do NOT change the page structure or remove sections.
3. Replace any remaining placeholder text or leftover template content
   with on-brief content matching the client's product/industry.
4. Return ONLY the complete corrected HTML — no markdown, no explanation.

CURRENT HTML:
${html.slice(0, 60000)}`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== 'text') throw new Error('Claude fix returned non-text response');

  return content.text
    .replace(/^```html?\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim();
}

/**
 * Stage 3: QA loop — validate UX wireframe vs. brief, fix issues, retry.
 * @param {import('../pipeline.js').RunContext} ctx
 * @returns {Promise<import('../pipeline.js').RunContext>}
 */
export async function run(ctx) {
  const ts = () => new Date().toISOString();
  const maxIter = config.uxQaMaxIterations;

  let html = await readFile(ctx.uxOutputPath, 'utf-8');
  let lastQA = null;

  for (let iter = 1; iter <= maxIter; iter++) {
    console.log(`[${ts()}] [uxQA          ] Iteration ${iter}/${maxIter} — rendering screenshot…`);

    const screenshot = await renderScreenshot(ctx.uxOutputPath);

    console.log(`[${ts()}] [uxQA          ] Evaluating with Claude…`);
    const qa = await evaluateWithClaude(screenshot, ctx.briefData, html);
    lastQA = qa;

    console.log(`[${ts()}] [uxQA          ] Score: ${qa.score}/100 | Issues: ${qa.issues.length}`);
    if (qa.issues.length > 0) {
      qa.issues.forEach((issue, i) => console.log(`[${ts()}] [uxQA          ]   ${i + 1}. ${issue}`));
    }

    if (qa.pass) {
      console.log(`[${ts()}] [uxQA          ] PASS — score ${qa.score} >= 95`);
      break;
    }

    if (iter < maxIter) {
      console.log(`[${ts()}] [uxQA          ] Requesting Claude fix…`);
      html = await fixWithClaude(html, qa, ctx.briefData);
      await writeFile(ctx.uxOutputPath, html);
      console.log(`[${ts()}] [uxQA          ] Fixed HTML written → ${ctx.uxOutputPath}`);
    } else {
      // Final iteration — log warning but continue (don't block the pipeline)
      console.warn(
        `[${ts()}] [uxQA          ] WARNING: Max iterations reached. Final score: ${qa.score}. Proceeding with best version.`
      );
    }
  }

  return { ...ctx, uxQAScore: lastQA?.score ?? 0 };
}
