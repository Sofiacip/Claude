/**
 * @fileoverview Stage 4 — Notifier
 * Renders a 1200px screenshot of the approved wireframe via Playwright,
 * builds an HTML review email with approve/revise CTA buttons,
 * and sends it via Resend to the configured REVIEWER_EMAIL.
 */

import { readFile } from 'fs/promises';
import { chromium } from 'playwright';
import { Resend } from 'resend';
import { config } from '../config.js';

const resend = new Resend(config.resendApiKey);

/**
 * Render the UX wireframe at 1200px width and return the PNG buffer.
 * @param {string} htmlPath - Absolute path to the HTML wireframe
 * @returns {Promise<Buffer>} PNG buffer
 */
async function captureReviewScreenshot(htmlPath) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });

  // Brief scroll to trigger lazy assets
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(600);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);

  const screenshot = await page.screenshot({ fullPage: true });
  await browser.close();

  return screenshot; // return Buffer, not base64 string
}

/**
 * Build the HTML review email body.
 * Screenshot is sent as an attachment (cid:wireframe) to avoid Gmail blocking base64.
 * @param {Object} brief - Brief data
 * @param {string} runId - Run ID for approval links
 * @returns {string} HTML email string
 */
function buildEmailHtml(brief, runId) {
  const approveUrl = `${config.webhookBaseUrl}/approve/${runId}`;
  const reviseUrl  = `${config.webhookBaseUrl}/revise/${runId}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PageForge Review — ${brief.headline}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f4f5; margin: 0; padding: 20px; }
    .container { max-width: 700px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,.08); }
    .header { background: #1e1e2e; color: #fff; padding: 28px 32px; }
    .header h1 { margin: 0 0 6px; font-size: 22px; font-weight: 700; }
    .header p  { margin: 0; opacity: .7; font-size: 14px; }
    .body { padding: 28px 32px; }
    .brief-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .brief-table td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; vertical-align: top; }
    .brief-table td:first-child { font-weight: 600; color: #6b7280; width: 36%; }
    .screenshot { width: 100%; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 28px; }
    .cta-row { display: flex; gap: 12px; margin-bottom: 24px; }
    .btn { display: inline-block; padding: 14px 28px; border-radius: 8px; font-size: 15px; font-weight: 600; text-decoration: none; text-align: center; flex: 1; }
    .btn-approve { background: #16a34a; color: #fff; }
    .btn-revise  { background: #fff; color: #374151; border: 2px solid #d1d5db; }
    .footer { background: #f9fafb; padding: 16px 32px; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>PageForge — Landing Page Ready for Review</h1>
      <p>Run ID: ${runId} &bull; ${new Date().toUTCString()}</p>
    </div>
    <div class="body">
      <h2 style="margin:0 0 16px;font-size:18px;">Brief Summary</h2>
      <table class="brief-table">
        <tr><td>Headline</td><td>${brief.headline}</td></tr>
        <tr><td>Subheadline</td><td>${brief.subheadline}</td></tr>
        <tr><td>CTA</td><td>${brief.ctaText} → ${brief.ctaUrl}</td></tr>
        <tr><td>Template</td><td>${brief.templateName}</td></tr>
        <tr><td>Slug</td><td>${brief.targetSlug}</td></tr>
        <tr><td>Brand Color</td><td><span style="display:inline-block;width:12px;height:12px;background:${brief.brandColor};border-radius:2px;margin-right:6px;vertical-align:middle;"></span>${brief.brandColor}</td></tr>
      </table>

      <h2 style="margin:0 0 16px;font-size:18px;">Wireframe Preview (1200px)</h2>
      <img src="cid:wireframe" alt="Wireframe preview" class="screenshot">

      <div class="cta-row">
        <a href="${approveUrl}" class="btn btn-approve">✅ Approve &amp; Deploy</a>
        <a href="${reviseUrl}?notes=" class="btn btn-revise">✏️ Request Revisions</a>
      </div>
      <p style="font-size:13px;color:#6b7280;">
        Clicking <strong>Approve</strong> will trigger automatic Elementor code generation and deployment to WordPress.<br>
        Clicking <strong>Request Revisions</strong> will stop the pipeline — add your notes to the URL's <code>?notes=</code> parameter.
      </p>
    </div>
    <div class="footer">
      Sent by PageForge &bull; Review expires in ${config.approvalTimeoutHours} hours &bull; Run ${runId}
    </div>
  </div>
</body>
</html>`;
}

/**
 * Stage 4: Send review email with approve/revise links.
 * @param {import('../pipeline.js').RunContext} ctx
 * @returns {Promise<import('../pipeline.js').RunContext>}
 */
export async function run(ctx) {
  const ts = () => new Date().toISOString();
  const reviewerEmail = ctx.briefData.reviewerEmail ?? config.reviewerEmail;

  console.log(`[${ts()}] [notifier      ] Capturing review screenshot at 1200px…`);
  const screenshotBuffer = await captureReviewScreenshot(ctx.uxOutputPath);

  console.log(`[${ts()}] [notifier      ] Building review email…`);
  const emailHtml = buildEmailHtml(ctx.briefData, ctx.runId);

  console.log(`[${ts()}] [notifier      ] Sending to ${reviewerEmail} via Resend…`);
  const { data, error } = await resend.emails.send({
    from:    'PageForge <onboarding@resend.dev>',
    to:      [reviewerEmail],
    subject: `[PageForge] Review: "${ctx.briefData.headline}" — Run ${ctx.runId}`,
    html:    emailHtml,
    attachments: [
      {
        filename:    `wireframe-${ctx.runId}.png`,
        content:     screenshotBuffer.toString('base64'),
        contentType: 'image/png',
      },
    ],
  });

  if (error) {
    throw new Error(`Resend failed: ${JSON.stringify(error)}`);
  }

  console.log(`[${ts()}] [notifier      ] Email sent. Resend ID: ${data.id}`);
  console.log(`[${ts()}] [notifier      ] Approve URL: ${config.webhookBaseUrl}/approve/${ctx.runId}`);
  console.log(`[${ts()}] [notifier      ] Revise URL:  ${config.webhookBaseUrl}/revise/${ctx.runId}`);

  return { ...ctx, notifierEmailId: data.id };
}
