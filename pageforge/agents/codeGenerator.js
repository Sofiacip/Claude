/**
 * @fileoverview Stage 6 — Code Generator
 * Reads the approved UX HTML and the template's elementor-schema.json,
 * asks Claude to map each HTML element to the correct Elementor widget,
 * validates the resulting JSON structure, and writes it to
 * /output/elementor/{runId}.json.
 *
 * Elementor page JSON structure:
 *   Array<Section> where each Section has:
 *     { id, elType:"section", settings:{}, elements: Array<Column> }
 *   Each Column:
 *     { id, elType:"column", settings:{}, elements: Array<Widget> }
 *   Each Widget:
 *     { id, elType:"widget", widgetType:<string>, settings:{}, elements:[] }
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { randomUUID } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';

const client = new Anthropic({ apiKey: config.anthropicApiKey });

/**
 * Generate a short unique ID compatible with Elementor's ID format.
 * @returns {string} 8-character hex string
 */
function eid() {
  return randomUUID().replace(/-/g, '').slice(0, 8);
}

/**
 * Validate the top-level Elementor JSON structure.
 * Accepts both legacy (section > column > widget) and modern (container) layouts.
 * @param {unknown} json
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateElementorJson(json) {
  const errors = [];

  if (!Array.isArray(json)) {
    errors.push('Root must be an array of sections/containers');
    return { valid: false, errors };
  }

  if (json.length === 0) {
    errors.push('Elementor JSON must contain at least one section or container');
  }

  const VALID_ROOT = new Set(['section', 'container']);
  const VALID_CHILD = new Set(['column', 'container', 'widget']);

  json.forEach((section, si) => {
    if (!VALID_ROOT.has(section.elType)) {
      errors.push(`elements[${si}].elType must be "section" or "container", got "${section.elType}"`);
    }
    if (!section.id) errors.push(`elements[${si}] missing id`);
    if (!Array.isArray(section.elements)) {
      errors.push(`elements[${si}].elements must be an array`);
    } else {
      section.elements.forEach((child, ci) => {
        if (!VALID_CHILD.has(child.elType)) {
          errors.push(`elements[${si}].elements[${ci}].elType must be column/container/widget, got "${child.elType}"`);
        }
        // Recurse one more level for nested containers/columns
        if (Array.isArray(child.elements)) {
          child.elements.forEach((widget, wi) => {
            if (!widget.elType) {
              errors.push(`elements[${si}].elements[${ci}].elements[${wi}] missing elType`);
            }
          });
        }
      });
    }
  });

  return { valid: errors.length === 0, errors };
}

/**
 * Strip CSS, SVGs, and verbose attributes from HTML to reduce prompt size
 * while preserving all content-bearing elements and data-slot attributes.
 * @param {string} html
 * @returns {string}
 */
function compactHtmlForPrompt(html) {
  let h = html;
  // Remove <style> blocks
  h = h.replace(/<style[\s\S]*?<\/style>/gi, '');
  // Remove inline style attributes (keep data-slot, class, id, href)
  h = h.replace(/ style="[^"]*"/gi, '');
  // Remove SVG elements
  h = h.replace(/<svg[\s\S]*?<\/svg>/gi, '[icon]');
  // Collapse whitespace
  h = h.replace(/[ \t]{2,}/g, ' ');
  h = h.replace(/\n{3,}/g, '\n\n');
  return h.trim();
}

/**
 * Build a prompt asking Claude to generate Elementor JSON from the HTML + schema.
 * Passes the FULL brief (including webinarSpecific and all nested data) so Claude
 * can generate widgets for all page sections.
 * @param {string} html - Approved UX wireframe HTML
 * @param {Object} schema - elementor-schema.json content
 * @param {Object} brief - Brief data
 * @returns {string}
 */
function buildPrompt(html, schema, brief) {
  // Compact the HTML to fit within prompt limits
  const compactHtml = compactHtmlForPrompt(html).slice(0, 50000);

  return `You are an expert Elementor developer. Convert the HTML wireframe below into a valid Elementor page JSON array.

ELEMENTOR WIDGET SCHEMA (available widget types and their settings):
${JSON.stringify(schema, null, 2)}

CLIENT BRIEF (COMPLETE — including all page sections):
${JSON.stringify(brief, null, 2).slice(0, 6000)}

This is a MULTI-SECTION landing page (webinar funnel) with the following sections:
- Hero with headline, subheadline, and primary CTA button
- Stats/social proof counters
- Pain points section (icon-list or text items)
- Benefits section (image-box or text items with titles + descriptions)
- Testimonials section (testimonial widgets with quotes, names, roles)
- Bonuses section (text items with titles + values)
- Host/speaker bio section
- Closing CTA section with registration form
- Registration form

HTML WIREFRAME (data-slot attributes mark dynamic content fields):
${compactHtml}

REQUIREMENTS:
1. Map EACH HTML section (identified by data-section attributes) to an Elementor section > column > widget hierarchy.
2. Use ONLY widget types defined in the schema above.
3. Every element must have a unique "id" (8 alphanumeric chars).
4. Every element must have "elType", "settings", and "elements" fields.
5. Preserve ALL text content from EVERY section — hero, stats, pain points, benefits, testimonials, bonuses, host bio, closing CTA.
6. Widget text mapping:
   - heading → settings.title
   - text-editor → settings.editor (HTML text)
   - button → settings.text + settings.url.url + settings.background_color
   - image → settings.image.url (use "" if no real image)
   - icon-list → settings.icon_list (array of {text, icon})
   - counter → settings.starting_number, settings.ending_number, settings.suffix, settings.title
   - testimonial → settings.testimonial_content, settings.testimonial_name, settings.testimonial_job
   - image-box → settings.title_text, settings.description_text
   - form → settings.form_fields (array)
   - countdown → settings.countdown_type, settings.due_date
7. Set brand color ${brief.brandColor} on hero section background and CTA buttons.
8. Create a COMPLETE JSON covering ALL sections visible in the HTML wireframe.

Return ONLY a valid JSON array — no explanation, no markdown fences, no trailing commas.`;
}

/**
 * Extract all unique {{slot-name}} markers from a string.
 * @param {string} str
 * @returns {string[]}
 */
function extractSlotMarkers(str) {
  const matches = str.matchAll(/\{\{([a-z0-9-]+)\}\}/g);
  return [...new Set([...matches].map(m => m[1]))];
}

/**
 * Build a prompt asking Claude to provide values for all slots based on the brief.
 * @param {string[]} slots - Slot names found in the base JSON
 * @param {Object} schema  - elementor-schema.json
 * @param {Object} brief   - Brief data
 * @returns {string}
 */
function buildSlotFillPrompt(slots, schema, brief) {
  const slotDescriptions = slots.map(slot => {
    const mapping = schema.slotToWidget?.[slot];
    return `- ${slot}: ${mapping ? `${mapping.widget}.${mapping.settings_key}` : 'text content'}`;
  }).join('\n');

  return `You are filling in a PageForge Elementor template with real client content.

CLIENT BRIEF (COMPLETE — use ALL fields including webinarSpecific for slot values):
${JSON.stringify(brief, null, 2).slice(0, 6000)}

SLOTS TO FILL (slot name → widget type):
${slotDescriptions}

INSTRUCTIONS:
1. Use the EXACT text from the brief for each slot when available (e.g. headline, subheadline, ctaText, pain points, benefits, testimonials, stats, bonuses, host bio, etc.)
2. The brief contains nested data under "webinarSpecific" — map those fields to the corresponding slots:
   - Pain points: painSection.items → pain-1, pain-2, etc.
   - Benefits: benefitsSection.items[].title/text → benefit-N-title, benefit-N-text
   - Testimonials: testimonialSection.items[].quote/name → testimonial-N-quote, testimonial-N-name
   - Bonuses: bonusSection.items[].title/value → bonus-N-title, bonus-N-value
   - Stats: stats[].number/label → stat-N-number, stat-N-label
   - Host: host.name/title/bio → host-name, host-title, host-bio
   - Closing CTA: closingCta.headline/buttonText → section-cta-headline, cta-closing
3. For any slot not directly in the brief, write professional, on-brand copy consistent with the brief topic.

Return ONLY a JSON object mapping each slot name to its text value:
{
  "headline": "Stop Guessing. Start Growing.",
  "subheadline": "Join our FREE webinar...",
  ...
}

Fill in ALL ${slots.length} slots. Return ONLY valid JSON — no markdown, no explanation.`;
}

/**
 * Fill {{slot-name}} markers in a JSON string using the provided values map.
 * @param {string} jsonStr     - Stringified JSON with {{slot}} markers
 * @param {Object} slotValues  - Map of slot name → replacement text
 * @returns {string}
 */
function fillSlotMarkers(jsonStr, slotValues) {
  return jsonStr.replace(/\{\{([a-z0-9-]+)\}\}/g, (match, slot) => {
    const value = slotValues[slot];
    if (value === undefined) {
      console.warn(`    ⚠ No value provided for slot "{{${slot}}}" — leaving as-is`);
      return match;
    }
    // Convert numbers to string, then escape for JSON string context
    const str = String(value);
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  });
}

/**
 * Stage 6: Convert UX HTML to Elementor JSON.
 *
 * Two modes:
 *  A) elementor-base.json exists → slot-substitution mode (imported templates)
 *  B) no base JSON              → Claude generation mode (built-in templates)
 *
 * @param {import('../pipeline.js').RunContext} ctx
 * @returns {Promise<import('../pipeline.js').RunContext>}
 */
export async function run(ctx) {
  const ts = () => new Date().toISOString();

  const basePath = resolve(config.paths.templates, ctx.templateName, 'elementor-base.json');
  const hasBase  = existsSync(basePath);

  const schemaPath = resolve(config.paths.templates, ctx.templateName, 'elementor-schema.json');
  let schema = {};
  try {
    schema = JSON.parse(await readFile(schemaPath, 'utf-8'));
    console.log(`[${ts()}] [codeGenerator ] Schema loaded: ${Object.keys(schema.widgets ?? {}).length} widget types`);
  } catch (err) {
    if (!hasBase) throw new Error(`Elementor schema not found: ${schemaPath}`);
    // Schema is optional when using Mode A with brief.slots
    console.log(`[${ts()}] [codeGenerator ] No schema file (optional in Mode A)`);
  }

  let elementorJson;

  // ── Mode A: Slot substitution (imported Elementor JSON templates) ─────────────
  if (hasBase) {
    console.log(`[${ts()}] [codeGenerator ] elementor-base.json detected — using slot-substitution mode`);

    const baseJsonStr = await readFile(basePath, 'utf-8');
    const slots = extractSlotMarkers(baseJsonStr);
    console.log(`[${ts()}] [codeGenerator ] Found ${slots.length} slots to fill: ${slots.join(', ')}`);

    // Use brief.slots directly if available (no Claude call needed)
    let slotValues = ctx.briefData.slots ?? {};

    // Fallback: map top-level brief fields to common slot names
    if (!ctx.briefData.slots) {
      slotValues = {
        headline: ctx.briefData.headline,
        subheadline: ctx.briefData.subheadline,
        'cta-text': ctx.briefData.ctaText,
        'cta-url': ctx.briefData.ctaUrl,
        ...slotValues,
      };
      console.log(`[${ts()}] [codeGenerator ] No brief.slots found — using top-level fields + Claude`);
      // Only call Claude for unfilled slots
      const unfilled = slots.filter(s => !slotValues[s]);
      if (unfilled.length > 0) {
        console.log(`[${ts()}] [codeGenerator ] Asking Claude to fill ${unfilled.length} remaining slots…`);
        const fillPrompt = buildSlotFillPrompt(unfilled, schema, ctx.briefData);
        const fillMsg = await client.messages.create({
          model: config.claudeModel,
          max_tokens: 4096,
          messages: [{ role: 'user', content: fillPrompt }],
        });
        let fillRaw = fillMsg.content[0].type === 'text' ? fillMsg.content[0].text : '{}';
        fillRaw = fillRaw.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim();
        const claudeValues = JSON.parse(fillRaw);
        slotValues = { ...slotValues, ...claudeValues };
      }
    } else {
      console.log(`[${ts()}] [codeGenerator ] Using brief.slots directly — no Claude call needed`);
    }

    const filled = slots.filter(s => slotValues[s] !== undefined);
    console.log(`[${ts()}] [codeGenerator ] Filled ${filled.length}/${slots.length} slots`);
    const missing = slots.filter(s => slotValues[s] === undefined);
    if (missing.length > 0) {
      console.warn(`[${ts()}] [codeGenerator ] ⚠ Missing slots: ${missing.join(', ')}`);
    }

    // Substitute markers and parse
    const filledJsonStr = fillSlotMarkers(baseJsonStr, slotValues);
    try {
      elementorJson = JSON.parse(filledJsonStr);
    } catch (err) {
      throw new Error(`JSON parse failed after slot substitution: ${err.message}`);
    }

  // ── Mode B: Claude generation (built-in HTML templates) ──────────────────────
  } else {
    const html = await readFile(ctx.uxOutputPath, 'utf-8');
    console.log(`[${ts()}] [codeGenerator ] UX HTML loaded (${html.length} chars)`);

    console.log(`[${ts()}] [codeGenerator ] Asking Claude to generate Elementor JSON from HTML…`);
    const prompt = buildPrompt(html, schema, ctx.briefData);
    const message = await client.messages.create({
      model: config.claudeModel,
      max_tokens: 16384,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = message.content[0].type === 'text' ? message.content[0].text : '';
    const cleaned = raw.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim();

    try {
      elementorJson = JSON.parse(cleaned);
    } catch (err) {
      throw new Error(`Claude returned invalid JSON: ${err.message}\n\nRaw output:\n${cleaned.slice(0, 500)}`);
    }
  }

  // ── Validate structure (both modes) ──────────────────────────────────────────
  const { valid, errors } = validateElementorJson(elementorJson);
  if (!valid) {
    throw new Error(
      `Elementor JSON structure invalid:\n${errors.map((e) => `  • ${e}`).join('\n')}`
    );
  }
  console.log(`[${ts()}] [codeGenerator ] JSON structure valid — ${elementorJson.length} sections`);

  // ── Write output ──────────────────────────────────────────────────────────────
  await mkdir(config.paths.outputElementor, { recursive: true });
  const outputPath = resolve(config.paths.outputElementor, `${ctx.runId}.json`);
  await writeFile(outputPath, JSON.stringify(elementorJson, null, 2));
  console.log(`[${ts()}] [codeGenerator ] Elementor JSON written → ${outputPath}`);

  return { ...ctx, elementorOutputPath: outputPath };
}
