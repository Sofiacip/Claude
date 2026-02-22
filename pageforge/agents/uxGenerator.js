/**
 * @fileoverview Stage 2 — UX Generator
 * Reads the HTML template, fills data-slot elements with brief values,
 * then asks Claude to complete any remaining gaps with on-brief content.
 * Writes the final wireframe to /output/ux/{runId}.html.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { resolve } from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';

const client = new Anthropic({ apiKey: config.anthropicApiKey });

/**
 * Map brief fields to their corresponding data-slot attribute values.
 * Flattens nested structures (webinarSpecific, etc.) into a flat slot→value map.
 * @param {Object} brief
 * @returns {Record<string, string>}
 */
function buildSlotMap(brief) {
  const map = {
    headline:       brief.headline      ?? '',
    subheadline:    brief.subheadline   ?? '',
    body:           brief.bodyCopy      ?? '',
    'body-copy':    brief.bodyCopy      ?? '',
    cta:            brief.ctaText       ?? '',
    'cta-text':     brief.ctaText       ?? '',
    'cta-url':      brief.ctaUrl        ?? '/',
    'brand-color':  brief.brandColor    ?? '#2563EB',
  };

  // ── Flatten webinarSpecific nested fields into slot names ────────────────────
  const ws = brief.webinarSpecific;
  if (!ws) return map;

  if (ws.preHeadline)       map['pre-headline']       = ws.preHeadline;
  if (ws.webinarDate)       map['webinar-date']        = ws.webinarDate;
  if (ws.webinarStatus)     map['webinar-status']      = ws.webinarStatus;
  if (ws.waitlistText)      map['waitlist-text']       = ws.waitlistText;
  if (ws.webinarCountdownDate) map['webinar-countdown-date'] = ws.webinarCountdownDate;

  // Stats: stat-1-number, stat-1-label, etc.
  (ws.stats ?? []).forEach((stat, i) => {
    const n = i + 1;
    if (stat.number) map[`stat-${n}-number`] = String(stat.number);
    if (stat.label)  map[`stat-${n}-label`]  = stat.label;
  });

  // Pain points section
  const pain = ws.painSection ?? ws.painPoints ?? {};
  if (pain.title)    map['section-pain-title']    = pain.title;
  if (pain.subtitle) map['section-pain-subtitle'] = pain.subtitle;
  (pain.items ?? []).forEach((item, i) => {
    map[`pain-${i + 1}`] = typeof item === 'string' ? item : item.text ?? '';
  });

  // Benefits section
  const benefits = ws.benefitsSection ?? ws.benefits ?? {};
  if (benefits.title) map['section-benefits-title'] = benefits.title;
  (benefits.items ?? []).forEach((item, i) => {
    const n = i + 1;
    if (item.title) map[`benefit-${n}-title`] = item.title;
    if (item.text)  map[`benefit-${n}-text`]  = item.text;
  });

  // Testimonials section
  const testi = ws.testimonialSection ?? ws.testimonials ?? {};
  if (testi.title) map['section-testimonials-title'] = testi.title;
  (testi.items ?? []).forEach((item, i) => {
    const n = i + 1;
    if (item.quote) map[`testimonial-${n}-quote`] = item.quote;
    if (item.name)  map[`testimonial-${n}-name`]  = item.name;
    if (item.role)  map[`testimonial-${n}-role`]   = item.role;
  });

  // Bonuses section
  const bonuses = ws.bonusSection ?? ws.bonuses ?? {};
  if (bonuses.title) map['section-bonuses-title'] = bonuses.title;
  (bonuses.items ?? []).forEach((item, i) => {
    const n = i + 1;
    if (item.title)       map[`bonus-${n}-title`] = item.title;
    if (item.value)       map[`bonus-${n}-value`] = item.value;
    if (item.description) map[`bonus-${n}-text`]  = item.description;
  });
  if (bonuses.totalValue) map['total-value'] = bonuses.totalValue;
  if (bonuses.offerText)  map['offer-text']  = bonuses.offerText;

  // Host section
  const host = ws.host ?? {};
  if (host.name)  map['host-name']  = host.name;
  if (host.title) map['host-title'] = host.title;
  if (host.bio)   map['host-bio']   = host.bio;

  // Closing CTA
  const closing = ws.closingCta ?? {};
  if (closing.headline)  map['section-cta-headline'] = closing.headline;
  if (closing.buttonText) map['cta-closing']          = closing.buttonText;

  // Registration form
  const form = ws.registrationForm ?? {};
  if (form.submitLabel) map['form-submit-label'] = form.submitLabel;

  // Pricing
  const pricing = ws.pricing ?? {};
  if (pricing.totalValue)  map['total-value'] = pricing.totalValue;
  if (pricing.yourPrice)   map['offer-text']  = pricing.yourPrice;
  if (pricing.urgencyText) map['urgency-text'] = pricing.urgencyText;

  return map;
}

/**
 * Replace all data-slot elements in the HTML with brief values.
 * Handles both inner text and href attributes.
 * @param {string} html
 * @param {Record<string, string>} slotMap
 * @returns {string}
 */
function fillSlots(html, slotMap) {
  let result = html;

  for (const [slot, value] of Object.entries(slotMap)) {
    // Replace text content of elements with this slot
    result = result.replace(
      new RegExp(`(<[^>]+data-slot=["']${slot}["'][^>]*>)[^<]*(</[^>]+>)`, 'gi'),
      (_, open, close) => {
        // Handle <a> tags — also patch href if it's a cta
        let tag = open;
        if (slot === 'cta' && slotMap['cta-url']) {
          tag = tag.replace(/href=["'][^"']*["']/, `href="${slotMap['cta-url']}"`);
          if (!tag.includes('href=')) {
            tag = tag.replace('>', ` href="${slotMap['cta-url']}">`);
          }
        }
        return `${tag}${value}${close}`;
      }
    );

    // Also patch CSS custom properties for brand color
    if (slot === 'brand-color') {
      result = result.replace(/var\(--brand-color\)/g, value);
      result = result.replace(/--brand-color:\s*[^;]+;/g, `--brand-color: ${value};`);
    }
  }

  return result;
}

/**
 * Detect data-slots in the HTML that still contain the original template content.
 * Counts slots in template vs slots that were successfully mapped from the brief.
 * @param {string} html
 * @param {Record<string, string>} slotMap - Slots that were filled from brief
 * @returns {{ needsFill: boolean, totalSlots: number, unmapped: string[] }}
 */
function detectUnfilledSlots(html, slotMap) {
  const allSlots = [...html.matchAll(/data-slot=["']([^"']+)["']/g)].map(m => m[1]);
  const unique = [...new Set(allSlots)];
  const unmapped = unique.filter(s => !(s in slotMap) || !slotMap[s]);
  const hasPlaceholders = /Placeholder|Lorem ipsum|TBD|FIXME|\[insert/i.test(html);
  return { needsFill: hasPlaceholders || unmapped.length > 0, totalSlots: unique.length, unmapped };
}

/**
 * Ask Claude to fill any remaining content gaps while staying on-brief.
 * Passes the FULL brief (including webinarSpecific and other nested data)
 * so Claude can write appropriate copy for all unfilled sections.
 * @param {string} html - Partially filled HTML
 * @param {Object} brief - Full brief data
 * @param {string[]} unmappedSlots - Slot names that weren't filled from brief
 * @returns {Promise<string>} - Improved HTML
 */
async function fillWithClaude(html, brief, unmappedSlots = []) {
  const prompt = `You are a professional UX copywriter. Below is a landing page HTML wireframe
that has been partially filled with client brief content. Some sections still have leftover
content from the template that doesn't match this client's brand or messaging.

CLIENT BRIEF (COMPLETE):
${JSON.stringify(brief, null, 2)}

${unmappedSlots.length > 0 ? `SLOTS THAT STILL NEED UPDATED COPY (data-slot names):
${unmappedSlots.map(s => `  - ${s}`).join('\n')}` : ''}

YOUR TASK:
1. Replace any remaining placeholder text ("Placeholder", "Lorem ipsum", "TBD", etc.)
   with compelling, on-brief marketing copy that matches the brand voice.
2. Replace any leftover template content that clearly doesn't match this client's brief
   (e.g. wrong names, wrong product, wrong industry) with on-brief copy.
3. For body paragraphs (body-1, body-2, body-3, body-4), write persuasive copy that
   expands on the brief's bodyCopy field.
4. Do NOT change any data-slot or data-section attributes — preserve them exactly.
5. Do NOT remove or restructure HTML elements, CSS classes, or styles.
6. Return ONLY the complete HTML — no explanation, no markdown fences.

WIREFRAME HTML:
${html.slice(0, 60000)}`;

  const message = await client.messages.create({
    model: config.claudeModel,
    max_tokens: 16384,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== 'text') throw new Error('Claude returned non-text response in uxGenerator');

  // Strip markdown code fences if Claude wrapped the output
  return content.text
    .replace(/^```html?\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim();
}

/**
 * Stage 2: Generate HTML wireframe from template and brief.
 * @param {import('../pipeline.js').RunContext} ctx
 * @returns {Promise<import('../pipeline.js').RunContext>}
 */
export async function run(ctx) {
  const ts = () => new Date().toISOString();

  const templateDir = resolve(config.paths.templates, ctx.templateName);
  const templatePath = resolve(templateDir, 'index.html');

  console.log(`[${ts()}] [uxGenerator   ] Loading template: ${templatePath}`);

  // --- Read template ---
  let html;
  try {
    html = await readFile(templatePath, 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`Template not found: ${templatePath}. Available templates are subdirectories of /templates/.`);
    }
    throw err;
  }

  // --- Fill data-slots with brief values ---
  const slotMap = buildSlotMap(ctx.briefData);
  html = fillSlots(html, slotMap);
  console.log(`[${ts()}] [uxGenerator   ] data-slot substitution complete — ${Object.keys(slotMap).length} slots mapped`);

  // --- Detect unfilled slots and ask Claude to fill gaps ---
  const { needsFill, totalSlots, unmapped } = detectUnfilledSlots(html, slotMap);
  if (needsFill) {
    console.log(`[${ts()}] [uxGenerator   ] ${unmapped.length} unfilled slots of ${totalSlots} total — asking Claude to fill gaps…`);
    if (unmapped.length > 0) {
      console.log(`[${ts()}] [uxGenerator   ]   Unfilled: ${unmapped.join(', ')}`);
    }
    html = await fillWithClaude(html, ctx.briefData, unmapped);
    console.log(`[${ts()}] [uxGenerator   ] Claude fill complete`);
  } else {
    console.log(`[${ts()}] [uxGenerator   ] All ${totalSlots} slots filled from brief — skipping Claude fill`);
  }

  // --- Inject brand color into <head> if CSS var not already present ---
  if (ctx.briefData.brandColor && !html.includes('--brand-color')) {
    html = html.replace(
      '</head>',
      `<style>:root { --brand-color: ${ctx.briefData.brandColor}; }</style>\n</head>`
    );
  }

  // --- Write output ---
  await mkdir(config.paths.outputUx, { recursive: true });
  const outputPath = resolve(config.paths.outputUx, `${ctx.runId}.html`);
  await writeFile(outputPath, html);
  console.log(`[${ts()}] [uxGenerator   ] Wireframe written → ${outputPath}`);

  return { ...ctx, uxOutputPath: outputPath };
}
