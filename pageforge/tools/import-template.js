/**
 * @fileoverview Template importer tool.
 *
 * Takes an existing HTML file (or a live URL) and:
 *   1. Fetches / reads the HTML
 *   2. Asks Claude to identify all dynamic content areas and add data-slot attributes
 *   3. Generates a matching elementor-schema.json
 *   4. Saves both files to /templates/{name}/
 *
 * Usage:
 *   node tools/import-template.js <name> <source>
 *
 * Examples:
 *   node tools/import-template.js my-landing ./my-page.html
 *   node tools/import-template.js my-landing https://mysite.com/landing-page
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// Load config / env
const { config } = await import('../config.js');
const client = new Anthropic({ apiKey: config.anthropicApiKey });

// ── CLI args ──────────────────────────────────────────────────────────────────
const [,, templateName, source] = process.argv;

if (!templateName || !source) {
  console.error(`
Usage:
  node tools/import-template.js <name> <source>

Arguments:
  name    Template folder name (letters, numbers, hyphens only)
  source  Path to a local .html file  OR  a https:// URL

Examples:
  node tools/import-template.js my-landing ./my-page.html
  node tools/import-template.js hero-v2 https://mysite.com/landing
`);
  process.exit(1);
}

if (!/^[a-z0-9-]+$/.test(templateName)) {
  console.error(`Template name must be lowercase letters, numbers, and hyphens only. Got: "${templateName}"`);
  process.exit(1);
}

const templateDir = resolve(ROOT, 'templates', templateName);
if (existsSync(templateDir)) {
  console.error(`Template "${templateName}" already exists at ${templateDir}`);
  console.error('Choose a different name or delete the existing folder first.');
  process.exit(1);
}

// ── Step 1: Fetch HTML ────────────────────────────────────────────────────────
const ts = () => new Date().toISOString();

let rawHtml;

if (source.startsWith('http://') || source.startsWith('https://')) {
  console.log(`[${ts()}] Fetching URL: ${source}`);
  const res = await fetch(source);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${source}`);
  rawHtml = await res.text();
  console.log(`[${ts()}] Fetched ${rawHtml.length} chars`);
} else {
  const localPath = resolve(process.cwd(), source);
  console.log(`[${ts()}] Reading local file: ${localPath}`);
  rawHtml = await readFile(localPath, 'utf-8');
  console.log(`[${ts()}] Read ${rawHtml.length} chars`);
}

// ── Step 1b: Strip bloat so actual content fits in context window ─────────────
/**
 * Remove WordPress/Elementor page noise so only visible content reaches Claude.
 * Order matters: head first (largest chunk), then scripts/styles, then compress.
 * @param {string} html
 * @returns {string}
 */
function cleanPageHtml(html) {
  // 1. Remove entire <head> block
  html = html.replace(/<head[\s\S]*?<\/head>/gi, '');

  // 2. Remove all <script> blocks (inline JS, tracking, etc.)
  html = html.replace(/<script[\s\S]*?<\/script>/gi, '');

  // 3. Remove all <style> blocks
  html = html.replace(/<style[\s\S]*?<\/style>/gi, '');

  // 4. Remove HTML comments
  html = html.replace(/<!--[\s\S]*?-->/g, '');

  // 5. Remove <noscript> blocks
  html = html.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');

  // 6. Replace <svg>…</svg> with a placeholder (icons bloat the payload)
  html = html.replace(/<svg[\s\S]*?<\/svg>/gi, '[svg-icon]');

  // 7. Try to isolate the main Elementor/page content area.
  //    Elementor wraps everything in <div class="elementor …">
  const elMatch = html.match(/<div[^>]*class="[^"]*\belementor\b[^"]*"[\s\S]*/i);
  if (elMatch) {
    html = elMatch[0];
    console.log(`[${ts()}] Elementor container found — isolated content`);
  } else {
    // Fall back: strip the nav/footer wrappers and keep <main> or <body>
    const mainMatch = html.match(/<main[\s\S]*<\/main>/i) || html.match(/<body[\s\S]*/i);
    if (mainMatch) html = mainMatch[0];
  }

  // 8. Remove verbose data-settings / data-model-cid / data-elementor-* JSON blobs
  //    These are huge but useless for our purposes
  html = html.replace(/ data-settings="[^"]{200,}"/g, ' data-settings="[…]"');
  html = html.replace(/ data-model-cid="[^"]*"/g, '');
  html = html.replace(/ data-elementor-settings="[^"]{100,}"/g, '');

  // 9. Collapse excessive whitespace
  html = html.replace(/[ \t]{2,}/g, ' ');
  html = html.replace(/\n{3,}/g, '\n\n');

  return html.trim();
}

const cleanedHtml = cleanPageHtml(rawHtml);
console.log(`[${ts()}] Cleaned HTML: ${rawHtml.length} → ${cleanedHtml.length} chars`);

// ── Step 2: Ask Claude to annotate data-slots ─────────────────────────────────
console.log(`[${ts()}] Asking Claude to annotate dynamic content areas…`);

const annotatePrompt = `You are a front-end developer converting a static HTML landing page into a PageForge template.

PageForge templates use data-slot attributes to mark every piece of content that changes between clients.

YOUR TASK:
1. Analyse the HTML below and identify ALL dynamic content areas:
   - Main headline (h1)
   - Subheadline / tagline
   - Body copy / description paragraphs
   - CTA button text and href
   - Section titles and subtitles
   - Benefit/feature card titles and descriptions
   - Testimonial quotes, author names, author roles
   - Statistics / numbers (stat number + label)
   - Countdown timer date/time
   - Host/speaker name and bio
   - Webinar date and time text
   - Bonus item titles and descriptions
   - Any other text that would differ from client to client

2. Add data-slot="<slot-name>" to every identified element using these naming conventions:
   - headline, subheadline, body, cta, cta-secondary
   - pre-headline (small text above main headline)
   - webinar-date, webinar-time
   - host-name, host-bio, host-title
   - pain-1, pain-2, pain-3 … (pain point bullet items)
   - benefit-1, benefit-2, benefit-3 … (outcome/benefit bullet items)
   - stat-1-number, stat-1-label, stat-2-number, stat-2-label, etc.
   - testimonial-1-quote, testimonial-1-name, testimonial-1-role, etc.
   - bonus-1-title, bonus-1-value, bonus-1-text, bonus-2-title … etc.
   - total-value, offer-text
   - section titles: section-pain-title, section-benefits-title, section-host-title,
     section-testimonials-title, section-bonuses-title, section-cta-headline
   - footer-text

3. Also add data-section="<section-name>" to each top-level section or wrapper div:
   (hero, stats, pain-points, benefits, host-bio, testimonials, bonuses, closing-cta, footer)

4. PRESERVE the original HTML structure, CSS classes, inline styles, images, and all existing attributes.
   Only ADD data-slot and data-section attributes — do not remove or change anything else.

5. Keep all existing text content exactly as-is — do NOT replace it with placeholder labels.
   The real content serves as the default/example for this template.

Return ONLY the complete annotated HTML — no explanation, no markdown fences.

HTML TO ANNOTATE:
${cleanedHtml.slice(0, 80000)}`;

const annotateMsg = await client.messages.create({
  model: config.claudeModel,
  max_tokens: 8192,
  messages: [{ role: 'user', content: annotatePrompt }],
});

let annotatedHtml = annotateMsg.content[0].type === 'text' ? annotateMsg.content[0].text : '';
annotatedHtml = annotatedHtml.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim();
console.log(`[${ts()}] Annotation complete (${annotatedHtml.length} chars)`);

// ── Step 3: Ask Claude to generate elementor-schema.json ──────────────────────
console.log(`[${ts()}] Generating elementor-schema.json…`);

const schemaPrompt = `You are an Elementor developer. Based on this annotated HTML template, generate a JSON schema file
that maps each data-slot to the correct Elementor widget type.

ANNOTATED HTML:
${annotatedHtml.slice(0, 40000)}

Generate a JSON object with this structure:
{
  "version": "3.21.0",
  "description": "Elementor widget schema for the ${templateName} template",
  "widgets": {
    "heading":      { "widgetType": "heading",      "description": "Headings h1-h6", "settings": { "title": "string", "header_size": "h1|h2|h3|h4", "align": "left|center|right" } },
    "text-editor":  { "widgetType": "text-editor",  "description": "Paragraphs and body text", "settings": { "editor": "string — HTML content" } },
    "button":       { "widgetType": "button",        "description": "CTA buttons", "settings": { "text": "string", "url": { "url": "string" }, "background_color": "#hex" } },
    "icon-box":     { "widgetType": "icon-box",      "description": "Feature cards with icon+title+text", "settings": { "title_text": "string", "description_text": "string" } },
    "testimonial":  { "widgetType": "testimonial",   "description": "Client quotes", "settings": { "content": "string", "name": "string", "job": "string" } },
    "counter":      { "widgetType": "counter",       "description": "Animated stats", "settings": { "ending_number": 0, "suffix": "string", "title": "string" } },
    "image":        { "widgetType": "image",         "description": "Images", "settings": { "image": { "url": "string", "alt": "string" } } }
  },
  "slotToWidget": {
    "<slot-name>": { "widget": "<widget-type>", "settings_key": "<settings-field>" }
  },
  "sectionLayout": {
    "<section-name>": { "background_color": "#hex or brand_color", "columns": 1 }
  }
}

Fill in slotToWidget with ALL data-slot values found in the HTML, mapping each to the most appropriate widget type.
Fill in sectionLayout with all data-section values found in the HTML.

Return ONLY the JSON — no explanation, no markdown fences.`;

const schemaMsg = await client.messages.create({
  model: config.claudeModel,
  max_tokens: 4096,
  messages: [{ role: 'user', content: schemaPrompt }],
});

let schemaRaw = schemaMsg.content[0].type === 'text' ? schemaMsg.content[0].text : '{}';
schemaRaw = schemaRaw.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim();

let schema;
try {
  schema = JSON.parse(schemaRaw);
} catch (e) {
  console.warn(`[${ts()}] Schema JSON parse failed — saving raw output. Error: ${e.message}`);
  schema = { raw: schemaRaw, error: 'parse failed — check and fix manually' };
}

// ── Step 4: Write files ───────────────────────────────────────────────────────
await mkdir(templateDir, { recursive: true });

const htmlPath   = resolve(templateDir, 'index.html');
const schemaPath = resolve(templateDir, 'elementor-schema.json');

await writeFile(htmlPath,   annotatedHtml);
await writeFile(schemaPath, JSON.stringify(schema, null, 2));

// List the slots that were found
const slots = [...annotatedHtml.matchAll(/data-slot=["']([^"']+)["']/g)].map(m => m[1]);
const unique = [...new Set(slots)];

console.log(`\n✅ Template "${templateName}" created successfully!`);
console.log(`   📄 HTML:   ${htmlPath}`);
console.log(`   📋 Schema: ${schemaPath}`);
console.log(`\n   Found ${unique.length} data-slots:`);
unique.forEach(s => console.log(`     · ${s}`));
console.log(`\n   To use this template, set "templateName": "${templateName}" in your brief.`);
console.log(`   Then run: node pipeline.js ./briefs/your-brief.json\n`);
