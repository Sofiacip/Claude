/**
 * builder.js — Stage 3: Generate HTML pages using Claude API.
 * Each page gets a single index.html with all styles inline, Tailwind CDN.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, basename } from 'path';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

/**
 * Build the system prompt with all CLAUDE.md rules baked in.
 */
function buildSystemPrompt() {
  return `You are a senior frontend developer for Scale for Impact, a marketing agency.
You generate complete, production-ready HTML pages for high-converting funnels.

RULES YOU MUST FOLLOW:
1. Output a single, complete index.html file. All styles inline. Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"></script>
2. Mobile-first responsive. Single column at 375px, no horizontal overflow.
3. Use ONLY the brand colors provided. Never use default Tailwind palette (no indigo-500, blue-600, etc.).
4. Use the exact fonts specified. Load via Google Fonts CDN.
5. Near-black (#0f0f0f) instead of pure black. Off-white (#f5f5f5) instead of pure white.
6. Build EXACTLY the sections listed in the template JSON, in the exact order given. Do not add, remove, or reorder sections.
7. Fill every copy slot with the provided content. No [brackets] or placeholder text may remain.
8. All CTA buttons must link to the correct URL or anchor. No # placeholders.
9. Layered, color-tinted shadows (not flat shadow-md). Use box-shadow with brand color at low opacity.
10. Two font families: display/serif for headings, clean sans for body. Tight tracking (-0.03em) on large headings, generous line-height (1.7) on body.
11. Only animate transform and opacity. Never transition-all. Use spring-style easing.
12. Every clickable element needs hover, focus-visible, and active states.
13. Images: add gradient overlay (bg-gradient-to-t from-black/60) and mix-blend-multiply layer where appropriate.
14. Intentional, consistent spacing — not random Tailwind steps.
15. Layered surface system: base → elevated → floating. Not all elements at same z-plane.
16. Placeholder images: use https://placehold.co/WIDTHxHEIGHT only where no real asset exists.
17. For countdown timers: build a working JavaScript countdown. Format per template spec.
18. For forms: style with brand colors, full width on mobile, stacked fields.

OUTPUT: Return ONLY the complete HTML document starting with <!DOCTYPE html>. No explanation, no markdown fences, no extra text.`;
}

/**
 * Build the user prompt for a specific page.
 */
function buildUserPrompt(job, pageIndex) {
  const page = job.pages[pageIndex];
  const template = page._template; // attached during build

  // Brand info
  const brandColors = job.brand.colors.map(c =>
    `${c.name || 'Color'}: ${c.hex} — ${c.usage || ''}`
  ).join('\n');

  const brandFonts = job.brand.fonts.map(f =>
    `${f.role}: ${f.name} (weight: ${f.weight || '400'})`
  ).join('\n');

  // Logo path (relative, for HTML src)
  const logoFilename = job.brand.logoPath ? basename(job.brand.logoPath) : null;

  // Photo filenames
  const photoFilenames = job.brand.photoPaths.map(p => basename(p));

  // Copy slots
  const slotsStr = JSON.stringify(page.copySlots, null, 2);

  // Page-specific design rules
  const designRules = template.sections
    .filter(s => s.design_rules)
    .map(s => `${s.id} ${s.name}: ${s.design_rules.join('; ')}`)
    .join('\n');

  let prompt = `Build the ${template.page_type} for the ${template.funnel} funnel.

## Template Specification
${JSON.stringify(template, null, 2)}

## Brand Package
Colors:
${brandColors || 'No colors specified — use sophisticated, non-default palette.'}

Fonts:
${brandFonts || 'No fonts specified — use Cormorant Garamond (heading) + Montserrat (body).'}

Logo: ${logoFilename ? `<img src="logos/${logoFilename}"> (use relative path)` : 'No logo provided — use text wordmark.'}

Available photos: ${photoFilenames.length > 0 ? photoFilenames.map(f => `photos/${f}`).join(', ') : 'None — use placehold.co for images.'}

Brand Guide Notes:
${job.brand.brandGuide || 'No brand guide available.'}

## Copy Content (Fill Every Slot)
${slotsStr}

## Page Configuration
- Navigation: ${template.nav ? 'YES — full brand navigation' : 'NO — no navigation links, no exit points'}
- Sticky CTA: ${template.sticky_cta ? 'YES — full width on mobile, centered on desktop, primary brand color, disappears when main CTA section is in view' : 'NO'}

## Design Rules for Specific Sections
${designRules || 'None specified.'}`;

  // Add QA feedback if this is a rebuild
  if (page.qaFeedback.length > 0) {
    prompt += `\n\n## Revision Feedback (Fix These Issues)
${page.qaFeedback.map((f, i) => `${i + 1}. ${f}`).join('\n')}

IMPORTANT: Address every issue listed above. This is a revision — the previous version had these problems.`;
  }

  prompt += '\n\nGenerate the complete index.html now.';
  return prompt;
}

/**
 * Generate HTML for a single page.
 */
export async function buildPage(job, pageIndex, emit) {
  const page = job.pages[pageIndex];

  // Load template
  const templateJson = await readFile(page.templatePath, 'utf-8');
  const template = JSON.parse(templateJson);
  page._template = template; // attach for prompt building

  emit(`  Generating HTML for ${page.pageType} (${template.sections.length} sections)...`);

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(job, pageIndex);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 16000,
    temperature: 0,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }]
  });

  let html = response.content[0]?.text || '';

  // Strip markdown fences if present
  if (html.startsWith('```')) {
    html = html.replace(/^```html?\n?/m, '').replace(/\n?```$/m, '').trim();
  }

  // Validate: must start with <!DOCTYPE or <html
  if (!html.trim().toLowerCase().startsWith('<!doctype') && !html.trim().toLowerCase().startsWith('<html')) {
    throw new Error(`Builder returned invalid HTML for ${page.pageType}. Response starts with: "${html.slice(0, 50)}..."`);
  }

  // Validate: must end with </html>
  if (!html.trim().toLowerCase().endsWith('</html>')) {
    emit(`  Warning: HTML may be truncated for ${page.pageType} (missing </html>). Appending closing tags.`);
    html += '\n</body>\n</html>';
  }

  // Write output
  const outputDir = join(job.tempDir, 'output', page.pageType);
  await mkdir(outputDir, { recursive: true });
  const htmlPath = join(outputDir, 'index.html');
  await writeFile(htmlPath, html, 'utf-8');
  page.htmlPath = htmlPath;

  emit(`  ${page.pageType} HTML written (${html.length} chars).`);

  // Clean up attached template
  delete page._template;
}
