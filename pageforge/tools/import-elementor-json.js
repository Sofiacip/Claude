/**
 * @fileoverview Elementor JSON template importer.
 *
 * Takes an Elementor JSON export (.json) and:
 *   1. Parses the widget tree
 *   2. Asks Claude to identify all dynamic text slots and replace values with {{slot-name}} markers
 *   3. Generates an HTML preview with data-slot attributes (for the UX wireframe stage)
 *   4. Writes:
 *        templates/{name}/elementor-base.json  — Elementor JSON with {{slot}} placeholders
 *        templates/{name}/elementor-schema.json — slot → widget type mapping
 *        templates/{name}/index.html            — HTML preview with data-slot attributes
 *
 * Usage:
 *   node tools/import-elementor-json.js <name> <path-to-export.json>
 *
 * Example:
 *   node tools/import-elementor-json.js hero-full ./my-export.json
 *
 * How to export from Elementor:
 *   Elementor editor → hamburger menu → Save as Template → My Templates
 *   → Export (downloads a .json file)
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const { config } = await import('../config.js');
const client = new Anthropic({ apiKey: config.anthropicApiKey });

// ── CLI args ───────────────────────────────────────────────────────────────────
const [,, templateName, jsonSource] = process.argv;

if (!templateName || !jsonSource) {
  console.error(`
Usage:
  node tools/import-elementor-json.js <name> <elementor-export.json>

Arguments:
  name    Template folder name (letters, numbers, hyphens only)
  source  Path to an Elementor JSON export file

How to export from Elementor:
  Elementor editor → ☰ menu → "Save as Template" → My Templates tab → Export (.json)

Example:
  node tools/import-elementor-json.js hero-full ./my-template.json
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

// ── Step 1: Read + Parse the Elementor JSON ────────────────────────────────────
const ts = () => new Date().toISOString();

const jsonPath = resolve(process.cwd(), jsonSource);
console.log(`[${ts()}] Reading Elementor JSON: ${jsonPath}`);

if (!existsSync(jsonPath)) {
  console.error(`File not found: ${jsonPath}`);
  process.exit(1);
}

const rawJson = await readFile(jsonPath, 'utf-8');
let elementorData;
try {
  const parsed = JSON.parse(rawJson);
  // Elementor exports can be { content: [...] } or directly an array
  elementorData = Array.isArray(parsed) ? parsed : (parsed.content ?? parsed);
  if (!Array.isArray(elementorData)) {
    throw new Error('Expected an array of sections at the root (or inside .content)');
  }
} catch (e) {
  console.error(`Failed to parse Elementor JSON: ${e.message}`);
  process.exit(1);
}
console.log(`[${ts()}] Parsed JSON — ${elementorData.length} top-level sections`);

// ── Step 2: Ask Claude to identify slots and add {{slot}} markers ──────────────
console.log(`[${ts()}] Asking Claude to identify dynamic content slots…`);

const analyzePrompt = `You are a PageForge template developer working with an Elementor JSON export.

Your task is to turn this static Elementor template into a reusable PageForge template by:

1. Identifying ALL text values that change from client to client:
   - Main headline, subheadline, body/description paragraphs
   - CTA button text and href/url values
   - Section headings and subtitles
   - Feature/benefit card titles and body text
   - Testimonial quotes, author names, author roles/job titles
   - Stats/numbers and their labels
   - Navigation logo text, nav CTA label
   - Footer text, copyright notice
   - Any other client-specific text

2. Replacing those string values in the JSON with {{slot-name}} markers.
   Naming conventions:
   - headline, subheadline, body, cta, cta-url, cta-secondary, cta-secondary-url
   - benefit-1-title, benefit-1-text, benefit-2-title, benefit-2-text … (continue pattern)
   - testimonial-1-quote, testimonial-1-name, testimonial-1-role … (continue pattern)
   - stat-1-number, stat-1-label, stat-2-number, stat-2-label … (continue pattern)
   - section-benefits-title, section-hiw-title, section-sp-title, section-cta-headline
   - nav-logo, nav-cta, footer-text

3. Keeping ALL other values (IDs, CSS classes, font sizes, colors, images) EXACTLY as-is.
   Replace ONLY text content strings with {{slot-name}} markers.

4. Returning a JSON object with EXACTLY two keys:
   {
     "template": [ ...the modified Elementor sections array with {{slot}} markers... ],
     "slots": [
       { "slot": "headline", "widgetType": "heading", "settingsKey": "title", "description": "Main hero headline" },
       ...
     ]
   }

ELEMENTOR JSON:
${JSON.stringify(elementorData, null, 2).slice(0, 80000)}

Return ONLY valid JSON — no markdown fences, no explanation, nothing else.`;

const analyzeMsg = await client.messages.create({
  model: config.claudeModel,
  max_tokens: 8192,
  messages: [{ role: 'user', content: analyzePrompt }],
});

let analysisRaw = analyzeMsg.content[0].type === 'text' ? analyzeMsg.content[0].text : '{}';
analysisRaw = analysisRaw.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim();

let analysis;
try {
  analysis = JSON.parse(analysisRaw);
} catch (e) {
  console.error(`Claude returned invalid JSON: ${e.message}`);
  console.error('First 600 chars of raw output:\n', analysisRaw.slice(0, 600));
  process.exit(1);
}

if (!analysis.template || !Array.isArray(analysis.slots)) {
  console.error('Unexpected response shape — expected { template, slots }');
  console.error('Got keys:', Object.keys(analysis));
  process.exit(1);
}

const elementorTemplate = analysis.template;
const slots = analysis.slots;
console.log(`[${ts()}] Found ${slots.length} dynamic slots`);

// ── Step 3: Generate HTML preview with data-slot attributes ────────────────────
console.log(`[${ts()}] Generating HTML wireframe preview…`);

const slotList = slots.map(s => `- {{${s.slot}}} — ${s.description}`).join('\n');

const htmlPrompt = `You are a front-end developer. Based on this Elementor template and its slot list,
generate a clean HTML wireframe preview that shows the page layout.

Requirements:
1. Create a complete, valid HTML document with inline CSS for layout.
2. Represent the visual structure of the Elementor template faithfully.
3. Add data-slot="<slot-name>" to elements corresponding to each slot.
4. Add data-section="<section-name>" to major page sections.
5. Show placeholder text for each slot (e.g. "Headline goes here", "CTA button text").
6. Keep the HTML clean — no external CDN links needed, just simple inline styles.

SLOT DEFINITIONS:
${slotList}

ELEMENTOR STRUCTURE (sections summary):
${JSON.stringify(elementorTemplate.map(s => ({
  id: s.id,
  elType: s.elType,
  columns: s.elements?.length ?? 0,
})), null, 2)}

Return ONLY the complete HTML — no markdown fences, no explanation.`;

const htmlMsg = await client.messages.create({
  model: config.claudeModel,
  max_tokens: 8192,
  messages: [{ role: 'user', content: htmlPrompt }],
});

let previewHtml = htmlMsg.content[0].type === 'text' ? htmlMsg.content[0].text : '';
previewHtml = previewHtml.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim();
console.log(`[${ts()}] HTML preview generated (${previewHtml.length} chars)`);

// ── Step 4: Build elementor-schema.json ───────────────────────────────────────
const slotToWidget = {};
for (const s of slots) {
  slotToWidget[s.slot] = { widget: s.widgetType, settings_key: s.settingsKey };
}

const schema = {
  version: '3.21.0',
  description: `Elementor widget schema for the ${templateName} template`,
  sourceType: 'elementor-json-import',
  widgets: {
    heading:       { widgetType: 'heading',      description: 'Headings h1-h6',           settings: { title: 'string', header_size: 'h1|h2|h3|h4', align: 'left|center|right' } },
    'text-editor': { widgetType: 'text-editor',  description: 'Paragraphs and body text', settings: { editor: 'string — HTML content' } },
    button:        { widgetType: 'button',        description: 'CTA buttons',              settings: { text: 'string', url: { url: 'string' }, background_color: '#hex' } },
    'icon-box':    { widgetType: 'icon-box',      description: 'Feature cards',            settings: { title_text: 'string', description_text: 'string' } },
    testimonial:   { widgetType: 'testimonial',   description: 'Client quotes',            settings: { content: 'string', name: 'string', job: 'string' } },
    counter:       { widgetType: 'counter',       description: 'Animated stats',           settings: { ending_number: 0, suffix: 'string', title: 'string' } },
    image:         { widgetType: 'image',         description: 'Images',                   settings: { image: { url: 'string', alt: 'string' } } },
  },
  slotToWidget,
  sectionLayout: {},
};

// ── Step 5: Write all three files ─────────────────────────────────────────────
await mkdir(templateDir, { recursive: true });

const htmlPath   = resolve(templateDir, 'index.html');
const schemaPath = resolve(templateDir, 'elementor-schema.json');
const basePath   = resolve(templateDir, 'elementor-base.json');

await writeFile(htmlPath,   previewHtml);
await writeFile(schemaPath, JSON.stringify(schema, null, 2));
await writeFile(basePath,   JSON.stringify(elementorTemplate, null, 2));

console.log(`\n✅ Template "${templateName}" imported from Elementor JSON!`);
console.log(`   📄 HTML Preview:   ${htmlPath}`);
console.log(`   📋 Schema:         ${schemaPath}`);
console.log(`   🧩 Elementor Base: ${basePath}`);
console.log(`\n   ${slots.length} dynamic slots found:`);
slots.forEach(s => console.log(`     · {{${s.slot}}} → ${s.widgetType}.${s.settingsKey}  (${s.description})`));
console.log(`\n   To use this template, set "templateName": "${templateName}" in your brief.`);
console.log(`   Then run: node pipeline.js ./briefs/your-brief.json\n`);
