// gemini-builder.mjs — 4-step Gemini-powered page building pipeline
// Step 1: Reference Audit → Step 2: Asset Mapping → Step 3: Build HTML → Step 4: Verification

import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mammoth from 'mammoth';

export class GeminiBuilder {
  constructor(apiKey, options = {}) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.modelName = options.model || 'gemini-2.5-flash';
    this.onProgress = options.onProgress || (() => {});
  }

  emit(type, data) {
    this.onProgress({ type, ...data });
  }

  getModel(maxTokens = 65536) {
    return this.genAI.getGenerativeModel({
      model: this.modelName,
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.1 },
    });
  }

  async generate(prompt, maxTokens = 65536, retries = 3) {
    const model = this.getModel(maxTokens);
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const result = await model.generateContent(prompt);
        return result.response.text();
      } catch (err) {
        const is429 = err.message?.includes('429') || err.message?.includes('quota');
        if (is429 && attempt < retries - 1) {
          const delay = Math.pow(2, attempt + 1) * 5000; // 10s, 20s, 40s
          this.emit('log', { message: `Rate limited — retrying in ${delay / 1000}s (attempt ${attempt + 2}/${retries})` });
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw err;
      }
    }
  }

  // ─── Main Build Pipeline ───────────────────────────────

  async build(clientDir, referenceUrl) {
    const startTime = Date.now();
    this.emit('start', { step: 0, total: 4, message: 'Starting Gemini build pipeline' });

    // Step 1: Reference Audit
    this.emit('step', { step: 1, total: 4, message: 'Fetching and auditing reference page...' });
    const referenceHtml = await this.fetchReference(referenceUrl);
    const cleanRef = this.cleanHtml(referenceHtml);
    const audit = await this.auditReference(cleanRef);
    this.emit('step', { step: 1, total: 4, message: `Audit complete — ${(audit.match(/^Section \d+/gm) || []).length} sections found` });

    // Step 2: Asset Mapping
    this.emit('step', { step: 2, total: 4, message: 'Mapping brand assets and colors...' });
    const brandGuide = this.readBrandGuide(clientDir);
    const assetInventory = this.scanAssets(clientDir);
    const copyText = await this.readCopyDocs(clientDir);
    const mapping = await this.mapAssets(audit, brandGuide, assetInventory);
    this.emit('step', { step: 2, total: 4, message: 'Asset mapping complete' });

    // Step 3: Build HTML
    this.emit('step', { step: 3, total: 4, message: 'Generating HTML with Gemini...' });
    let html = await this.generateFullPage(audit, mapping, brandGuide, assetInventory, copyText);

    // Check for truncation — if no </html>, build section-by-section
    if (!html.includes('</html>')) {
      this.emit('step', { step: 3, total: 4, message: 'Output truncated — rebuilding in sections...' });
      html = await this.generateInSections(audit, mapping, brandGuide, assetInventory, copyText);
    }

    // Write output + link assets
    this.writeOutput(clientDir, html);
    this.linkAssets(clientDir);
    this.emit('step', { step: 3, total: 4, message: 'HTML generated and saved' });

    // Step 4: Verification
    this.emit('step', { step: 4, total: 4, message: 'Verifying output against audit...' });
    const verification = await this.verifyOutput(audit, html);

    if (verification.issues && verification.issues.length > 0) {
      this.emit('step', { step: 4, total: 4, message: `Fixing ${verification.issues.length} issues...` });
      html = await this.fixIssues(html, audit, verification, brandGuide, assetInventory, copyText);
      this.writeOutput(clientDir, html);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    this.emit('complete', { step: 4, total: 4, message: `Build complete in ${duration}s`, duration });

    return {
      audit,
      mapping,
      verification,
      outputPath: path.join(clientDir, 'output', 'index.html'),
      duration: parseFloat(duration),
    };
  }

  // ─── Step 1: Fetch & Audit Reference ──────────────────

  async fetchReference(url) {
    this.emit('log', { message: `Fetching ${url}` });
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`Failed to fetch reference: ${res.status} ${res.statusText}`);
    return await res.text();
  }

  cleanHtml(html) {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  async auditReference(cleanHtml) {
    const prompt = `You are analyzing a reference web page to produce a structural audit.

Given the HTML below, identify every visual section on the page from top to bottom.
For EACH section, document:

1. Section number and descriptive name
2. Layout type: full-width, contained (max-width), grid columns (how many), flex direction
3. Background treatment: solid color (which), image overlay, gradient, transparent
4. All interactive elements: form fields (input types, selects, textareas), buttons (text & style), accordions, tabs, modals
5. All media elements: images (describe what they show — hero photo, headshot, logo bar, icon, etc.), video embeds, SVG icons
6. All text elements: headings (H1-H6 with approximate text), paragraphs, lists, testimonial quotes
7. Spacing/divider to next section: wave SVG, hard color cut, gradient fade, overlap, whitespace gap

Be extremely thorough. Do NOT skip any section, sidebar, sticky header, footer, or popup.
Format as plain text with clear "Section N:" headers.

REFERENCE HTML:
${cleanHtml.substring(0, 200000)}`;

    return await this.generate(prompt, 16384);
  }

  // ─── Step 2: Asset Mapping ────────────────────────────

  readBrandGuide(clientDir) {
    const brandPath = path.join(clientDir, 'brand', 'brand.md');
    if (!fs.existsSync(brandPath)) throw new Error('brand.md not found');
    return fs.readFileSync(brandPath, 'utf-8');
  }

  scanAssets(clientDir) {
    const assetsDir = path.join(clientDir, 'brand', 'assets');
    if (!fs.existsSync(assetsDir)) return 'No assets found.';

    const lines = [];
    const walk = (dir, prefix = '') => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue;
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          walk(path.join(dir, entry.name), rel);
        } else {
          const ext = path.extname(entry.name).toLowerCase();
          if (['.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif'].includes(ext)) {
            const size = fs.statSync(path.join(dir, entry.name)).size;
            lines.push(`./assets/${rel} (${(size / 1024).toFixed(0)}KB)`);
          }
        }
      }
    };
    walk(assetsDir);
    return lines.join('\n');
  }

  async readCopyDocs(clientDir) {
    const copyDir = path.join(clientDir, 'copy');
    if (!fs.existsSync(copyDir)) return '';

    const texts = [];
    for (const file of fs.readdirSync(copyDir).sort()) {
      const ext = path.extname(file).toLowerCase();
      const filePath = path.join(copyDir, file);

      if (ext === '.docx') {
        const result = await mammoth.extractRawText({ path: filePath });
        texts.push(`=== ${file} ===\n${result.value}`);
      } else if (ext === '.txt' || ext === '.md') {
        texts.push(`=== ${file} ===\n${fs.readFileSync(filePath, 'utf-8')}`);
      }
    }
    return texts.join('\n\n');
  }

  async mapAssets(audit, brandGuide, assetInventory) {
    const prompt = `You are mapping brand assets to a reference page structure.

REFERENCE PAGE AUDIT:
${audit}

BRAND GUIDE (color system, typography):
${brandGuide}

AVAILABLE IMAGE ASSETS:
${assetInventory}

TASK:
1. For each image slot identified in the audit (hero images, headshots, logos, icons, background images, etc.), assign the BEST matching file from the available assets. Use the file path exactly as listed (starting with ./assets/).
2. For each reference page color, identify the equivalent brand guide color.
3. List any gaps — image slots that have no good match in the assets.

Format your response as plain text with clear sections:
IMAGE MAPPING:
- [reference slot description] → [asset path]

COLOR MAPPING:
- [reference color/role] → [brand color hex + name]

GAPS:
- [anything missing]`;

    return await this.generate(prompt, 8192);
  }

  // ─── Step 3: Build HTML ───────────────────────────────

  async generateFullPage(audit, mapping, brandGuide, assetInventory, copyText) {
    const prompt = `You are a front-end developer. Your job is to replicate a reference page exactly, applying a new brand and substituting copy.

REFERENCE PAGE AUDIT (your structural blueprint — replicate every section):
${audit}

ASSET MAPPING (use these exact file paths for images):
${mapping}

BRAND GUIDE (apply these colors, fonts, spacing, and component styles):
${brandGuide}

COPY DOCUMENT (substitute ALL text content with this copy — use it VERBATIM):
${copyText}

AVAILABLE IMAGES (full list):
${assetInventory}

BUILD INSTRUCTIONS:
1. Create a SINGLE complete HTML file with ALL CSS embedded in a <style> tag in <head>
2. Include Google Fonts <link> for: Plus Jakarta Sans (weights 400,600,700,800)
3. Replicate the reference structure SECTION-FOR-SECTION, ELEMENT-FOR-ELEMENT
4. Apply brand colors, fonts, border radii, shadows, and component styles from the brand guide
5. Use images from available assets with paths starting with ./assets/
6. For hero/background images, use CSS background-image with overlay gradients matching the brand
7. All form fields from the reference MUST appear in the output
8. Responsive design: mobile breakpoint at 768px, all grids collapse to single column
9. Include smooth scroll behavior and hover states on interactive elements
10. If the copy document has {{TBD}} placeholders, use reasonable placeholder text that fits the context

STRICT RULES:
- Match the reference layout direction (horizontal vs vertical, overlay vs grid) EXACTLY
- If reference has a background image on a section, output MUST have a background image
- Do NOT skip, merge, or reorder sections
- Do NOT add sections that aren't in the reference
- Do NOT simplify forms — every field must appear
- Brand guide overrides colors and fonts ONLY — not layout or structure
- Return ONLY the complete HTML. No markdown code fences. No explanation. Start with <!DOCTYPE html> and end with </html>.`;

    let result = await this.generate(prompt, 65536);
    result = this.stripCodeFences(result);
    return result;
  }

  async generateInSections(audit, mapping, brandGuide, assetInventory, copyText) {
    // Parse section count from audit
    const sectionMatches = audit.match(/^Section \d+/gm) || [];
    const sectionCount = sectionMatches.length || 8;

    // Generate CSS + skeleton first
    const skeletonPrompt = `Generate the HTML skeleton for a landing page. Include:
1. <!DOCTYPE html>, <html>, <head> with:
   - Meta charset, viewport
   - Google Fonts link for Plus Jakarta Sans (400,600,700,800)
   - Complete <style> tag with ALL CSS for the page based on this brand guide:
   ${brandGuide}

   The CSS must include:
   - CSS custom properties for all brand colors
   - Typography styles (h1-h6, body, labels)
   - Button styles (primary + secondary)
   - Card styles
   - Form input styles
   - Responsive breakpoints at 768px
   - Layout utilities (container, grid, flex)
   - Hover/focus states
   - Section spacing (96px desktop, 60px mobile)

2. Opening <body> tag
3. ${sectionCount} empty <!-- Section N --> comment placeholders
4. Closing </body></html>

Return ONLY HTML. No markdown. No explanation.`;

    let skeleton = await this.generate(skeletonPrompt, 16384);
    skeleton = this.stripCodeFences(skeleton);

    // Extract the <head> and CSS
    const headMatch = skeleton.match(/<head[\s\S]*?<\/head>/i);
    const head = headMatch ? headMatch[0] : '<head><meta charset="UTF-8"></head>';

    // Generate each section
    const sections = [];
    for (let i = 0; i < sectionCount; i++) {
      this.emit('log', { message: `Generating section ${i + 1}/${sectionCount}...` });

      const sectionPrompt = `Generate HTML for section ${i + 1} of a landing page.

SECTION FROM AUDIT:
${this.extractAuditSection(audit, i + 1)}

ASSET MAPPING:
${mapping}

COPY TO USE (use content relevant to this section):
${copyText}

AVAILABLE IMAGES:
${assetInventory}

Generate ONLY the <section> HTML (no <html>, <head>, or <body> tags).
Use class names consistent with the brand guide styles.
Include all images, form fields, and interactive elements described in the audit.
Return ONLY HTML. No markdown.`;

      let sectionHtml = await this.generate(sectionPrompt, 8192);
      sectionHtml = this.stripCodeFences(sectionHtml);
      sections.push(sectionHtml);
    }

    // Combine
    return `<!DOCTYPE html>
<html lang="en">
${head}
<body>
${sections.join('\n\n')}
</body>
</html>`;
  }

  extractAuditSection(audit, sectionNum) {
    const lines = audit.split('\n');
    let start = -1;
    let end = lines.length;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(new RegExp(`^\\s*Section\\s+${sectionNum}[:\\s]`, 'i'))) {
        start = i;
      } else if (start >= 0 && lines[i].match(/^\s*Section\s+\d+[:\s]/i)) {
        end = i;
        break;
      }
    }

    if (start === -1) return `Section ${sectionNum} (no audit details available)`;
    return lines.slice(start, end).join('\n');
  }

  // ─── Step 4: Verification ─────────────────────────────

  async verifyOutput(audit, html) {
    const prompt = `You are verifying a generated HTML page against a reference audit.

REFERENCE AUDIT:
${audit}

GENERATED HTML:
${html.substring(0, 200000)}

TASK:
Check every section from the audit and verify it exists in the generated HTML.
For each section, check:
1. Is the section present?
2. Are all interactive elements (forms, buttons) present?
3. Are media elements (images, icons) present?
4. Is the layout direction correct?

Return your response in this exact format:
PASSED: [yes/no]
ISSUES:
- [issue description] (if any)
- ...

If all sections are present with correct elements, return:
PASSED: yes
ISSUES: none`;

    const result = await this.generate(prompt, 4096);
    const passed = /PASSED:\s*yes/i.test(result);
    const issueLines = result.split('\n').filter(l => l.trim().startsWith('-') && !l.includes('none'));
    return { passed, issues: issueLines.map(l => l.trim().replace(/^-\s*/, '')), raw: result };
  }

  async fixIssues(html, audit, verification, brandGuide, assetInventory, copyText) {
    const prompt = `You are fixing a generated HTML page. The following issues were found:

ISSUES TO FIX:
${verification.issues.join('\n')}

REFERENCE AUDIT (what the page should contain):
${audit}

BRAND GUIDE:
${brandGuide}

COPY DOCUMENT:
${copyText}

AVAILABLE IMAGES:
${assetInventory}

CURRENT HTML:
${html}

Fix ALL listed issues. Add any missing sections, form fields, or elements.
Return the COMPLETE fixed HTML page. No markdown. No explanation.
Start with <!DOCTYPE html> and end with </html>.`;

    let result = await this.generate(prompt, 65536);
    result = this.stripCodeFences(result);
    // Only use the fix if it looks complete
    if (result.includes('</html>')) return result;
    return html; // fallback to original if fix is truncated
  }

  // ─── Output ───────────────────────────────────────────

  writeOutput(clientDir, html) {
    const outputDir = path.join(clientDir, 'output');
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, 'index.html'), html, 'utf-8');
  }

  linkAssets(clientDir) {
    const src = path.join(clientDir, 'brand', 'assets');
    const dest = path.join(clientDir, 'output', 'assets');

    if (!fs.existsSync(src)) return;

    // Remove existing link/dir
    if (fs.existsSync(dest)) {
      const stat = fs.lstatSync(dest);
      if (stat.isSymbolicLink()) fs.unlinkSync(dest);
      else fs.rmSync(dest, { recursive: true });
    }

    // Create symlink
    fs.symlinkSync(src, dest, 'dir');
  }

  // ─── Utilities ────────────────────────────────────────

  stripCodeFences(text) {
    // Remove ```html ... ``` or ``` ... ``` wrappers
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:html|HTML)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    return cleaned.trim();
  }
}

// ─── CLI entry point for standalone testing ─────────────

const isMain = process.argv[1] && (
  process.argv[1].endsWith('gemini-builder.mjs') ||
  process.argv[1].includes('gemini-builder')
);

if (isMain) {
  const args = process.argv.slice(2);
  const clientName = args[0];
  const referenceUrl = args[1];

  if (!clientName || !referenceUrl) {
    console.error('Usage: node gemini-builder.mjs <client-name> <reference-url>');
    process.exit(1);
  }

  // Load .env
  const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
      const [key, ...rest] = line.split('=');
      if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
    }
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) { console.error('GEMINI_API_KEY not set'); process.exit(1); }

  const clientDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'clients', clientName);
  if (!fs.existsSync(clientDir)) { console.error(`Client dir not found: ${clientDir}`); process.exit(1); }

  const builder = new GeminiBuilder(apiKey, {
    onProgress: (msg) => console.log(`[${msg.type}] ${msg.message || ''}`),
  });

  try {
    const result = await builder.build(clientDir, referenceUrl);
    console.log('\nBuild result:', JSON.stringify({ ...result, audit: '[truncated]', mapping: '[truncated]' }, null, 2));
  } catch (err) {
    console.error('Build failed:', err.message);
    process.exit(1);
  }
}
