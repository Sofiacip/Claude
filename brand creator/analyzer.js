/**
 * analyzer.js — Claude vision-based brand analysis.
 * Produces a structured brand guide matching the AI Page Building template.
 * Uses Claude Code CLI with Max subscription authentication.
 */

import { spawn } from 'child_process';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

function parseJSON(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
    }
    return null;
  }
}

function runClaude(prompt, options = {}) {
  const { addDirs = [], timeout = 600000 } = options; // 10 min timeout for thorough analysis

  return new Promise((resolve, reject) => {
    const args = [
      '-p', prompt,
      '--output-format', 'json',
      '--no-session-persistence',
      '--model', 'sonnet',
      '--allowedTools', 'Read',
    ];

    for (const dir of addDirs) {
      args.push('--add-dir', dir);
    }

    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;
    delete env.CLAUDECODE;

    let stdout = '';
    let stderr = '';

    const child = spawn('claude', args, {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('Claude CLI timed out after ' + (timeout / 1000) + 's'));
    }, timeout);

    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to spawn claude CLI: ${err.message}. Is Claude Code installed?`));
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`Claude CLI exited with code ${code}\n${stderr}`));
        return;
      }
      try {
        const output = JSON.parse(stdout);
        resolve(output.result || stdout);
      } catch {
        resolve(stdout);
      }
    });

    child.stdin.end();
  });
}

/**
 * Analyse a scraped website and produce a structured brand guide
 * matching the AI Page Building template (8 sections).
 *
 * @param {object} scrapedData - Output from scraper.scrapeWebsite()
 * @param {function} emit - Progress callback
 * @returns {object} Complete brand guide data
 */
export async function analyzeBrand(scrapedData, emit) {
  const { pages, colors, fonts, copyText, products, imageLibrary } = scrapedData;

  emit('Saving screenshots for Claude analysis...');

  const tempDir = join(tmpdir(), `brand-analysis-${randomBytes(4).toString('hex')}`);
  mkdirSync(tempDir, { recursive: true });

  const imagePaths = [];
  for (const [i, page] of pages.slice(0, 5).entries()) {
    if (page.screenshotB64) {
      const filePath = join(tempDir, `screenshot-${i}.jpg`);
      writeFileSync(filePath, Buffer.from(page.screenshotB64, 'base64'));
      imagePaths.push(filePath);
    }
  }

  const colorList = colors.map(c => `${c.hex} (frequency: ${c.count})`).join(', ');
  const fontList = fonts.slice(0, 8).join(', ');
  const pageTitles = pages.map(p => p.title || p.url).join(', ');

  // Summarize discovered images for the analyzer
  const imageStats = Object.entries(imageLibrary || {})
    .filter(([, arr]) => arr.length > 0)
    .map(([key, arr]) => `${key}: ${arr.length} files`)
    .join(', ');

  const imageInstructions = imagePaths.map(p => `  - ${p}`).join('\n');

  const prompt = `You are a senior brand strategist and UI designer creating a comprehensive Brand Guide for AI-Powered Page Building.

IMPORTANT: First, use the Read tool to view each of these screenshot image files:
${imageInstructions}

I've scraped ${pages.length} pages from this website: ${pageTitles}

Extracted CSS colors (by frequency): ${colorList || 'none found'}
Detected font families: ${fontList || 'none detected'}
Discovered images: ${imageStats || 'none'}
${products.length > 0 ? `\nProducts/courses found: ${products.join(', ')}` : ''}

Sample copy from the website:
---
${copyText?.slice(0, 2000) || '(no copy extracted)'}
---

After viewing the screenshots, produce a COMPLETE brand guide following the template below. This guide will be used by AI assistants to build landing pages, sales pages, and funnels that are perfectly on-brand.

The MOST IMPORTANT thing is mapping colors to FUNCTIONS (e.g., "Primary CTA = #6453E5") instead of just listing hex codes. When the AI knows what a color is FOR, it never has to guess.

Return your analysis as a single valid JSON object with EXACTLY this structure:

{
  "brandIdentity": {
    "brandName": "The brand/company name",
    "tagline": "Their tagline or positioning statement",
    "industry": "e.g. Online Education, SaaS, E-commerce",
    "targetAudience": "e.g. Founders scaling from $500K-$5M revenue",
    "brandPersonality": "e.g. Bold, Premium, Warm, Authoritative"
  },
  "colorSystem": {
    "primary": [
      { "name": "Page Background", "hex": "#hex", "usedFor": "Main page background, dark sections" },
      { "name": "Card Background", "hex": "#hex", "usedFor": "Cards, containers, elevated surfaces" },
      { "name": "Primary CTA", "hex": "#hex", "usedFor": "All buttons, links, active states, focus rings" },
      { "name": "Accent / Highlight", "hex": "#hex", "usedFor": "Headline accent words, urgency, sale tags" },
      { "name": "Body Text", "hex": "#hex", "usedFor": "Primary text on backgrounds" },
      { "name": "Secondary Text", "hex": "#hex", "usedFor": "Subtitles, captions, helper text, dates" },
      { "name": "Border / Divider", "hex": "#hex", "usedFor": "Card borders, horizontal rules, separators" }
    ],
    "utility": [
      { "name": "Success", "hex": "#22C55E", "usedFor": "Success states, confirmations, check marks" },
      { "name": "Warning", "hex": "#F59E0B", "usedFor": "Alerts, caution messages" },
      { "name": "Error", "hex": "#EF4444", "usedFor": "Form errors, destructive actions" },
      { "name": "Glow / Aura", "hex": "rgba(r,g,b,0.15)", "usedFor": "Ambient background gradients, hover glows — use the Primary CTA color at 15% opacity" }
    ]
  },
  "fontFamilies": [
    { "role": "Headings", "family": "Font Name", "source": "Google Fonts / Adobe Fonts / self-hosted" },
    { "role": "Body", "family": "Font Name", "source": "Google Fonts / Adobe Fonts / self-hosted" },
    { "role": "Accent / Display", "family": "Font Name or empty if none", "source": "Source or empty" }
  ],
  "typeScale": [
    { "element": "H1 / Hero", "size": "64px", "weight": "800", "lineHeight": "0.95", "transform": "uppercase or none", "colorToken": "Body Text" },
    { "element": "H2 / Section", "size": "48px", "weight": "800", "lineHeight": "1.05", "transform": "none", "colorToken": "Body Text" },
    { "element": "H3 / Card Title", "size": "20px", "weight": "700", "lineHeight": "1.3", "transform": "none", "colorToken": "Body Text" },
    { "element": "Body", "size": "16px", "weight": "400", "lineHeight": "1.65", "transform": "none", "colorToken": "Secondary Text" },
    { "element": "Label / Overline", "size": "14px", "weight": "600", "lineHeight": "1.4", "transform": "uppercase", "colorToken": "Primary CTA" },
    { "element": "Caption / Small", "size": "13px", "weight": "400", "lineHeight": "1.5", "transform": "none", "colorToken": "Secondary Text" }
  ],
  "buttons": {
    "primary": {
      "background": "Primary CTA color hex",
      "textColor": "#FFFFFF",
      "border": "none",
      "borderRadius": "999px or 12px or 0px",
      "padding": "18px 42px",
      "fontSize": "16px",
      "fontWeight": "700",
      "hoverEffect": "translateY(-2px) + box-shadow or other effect"
    },
    "secondary": {
      "background": "transparent",
      "textColor": "Body Text color hex",
      "border": "2px solid rgba(255,255,255,0.3)",
      "borderRadius": "same as primary",
      "padding": "14px 36px",
      "fontSize": "15px",
      "fontWeight": "600",
      "hoverEffect": "border-color change or other effect"
    }
  },
  "cards": {
    "background": "Card Background color hex",
    "border": "1px solid rgba(100,83,229,0.15) — use brand-appropriate values",
    "borderRadius": "16px for cards, 20px for large sections",
    "padding": "32px 28px standard, 48px 40px large",
    "shadow": "none or subtle or medium — describe or give CSS"
  },
  "formInputs": {
    "background": "rgba(255,255,255,0.06) or appropriate",
    "border": "1px solid rgba(255,255,255,0.12) or appropriate",
    "borderRadius": "999px or 12px or 0px",
    "focusState": "border-color changes to Primary CTA",
    "placeholderColor": "Secondary Text color hex"
  },
  "spacing": {
    "maxContentWidth": "1140px or 1200px or 960px",
    "sectionPadding": "100px top/bottom desktop, 60px mobile",
    "containerSidePadding": "24px",
    "gridGap": "20px-24px between cards",
    "desktopColumns": "2-col default for feature grids, 3-col for testimonials",
    "mobileBreakpoint": "768px — everything stacks to 1 column"
  },
  "effects": [
    { "name": "Background Glow", "description": "radial-gradient with glow color, positioned top-right" },
    { "name": "Card Top Accent", "description": "2px gradient line on top edge of cards" },
    { "name": "Left Accent Bar", "description": "4px solid Primary CTA on left edge of pain-point cards" },
    { "name": "Hover Lift", "description": "translateY(-2px) + box-shadow on buttons" }
  ],
  "logoUsage": [
    { "context": "Page Header", "versionAndSize": "logo-light.svg, height: 32px, top-left or centered" },
    { "context": "Footer", "versionAndSize": "logo-light.svg, height: 28px, centered" },
    { "context": "Favicon", "versionAndSize": "logo-icon.svg or .ico file" },
    { "context": "Minimum Clear Space", "versionAndSize": "At least 16px on all sides" }
  ],
  "imagePlacementMap": [
    { "pageSection": "Hero Background", "imageFile": "hero/hero-homepage-bg.jpg", "notes": "Full-width, dark overlay 60%" },
    { "pageSection": "About Instructor", "imageFile": "instructors/instructor-name.png", "notes": "Circle mask, 150px" },
    { "pageSection": "CTA Split Left", "imageFile": "lifestyle/lifestyle-01.jpg", "notes": "Square crop, cover fit" }
  ]
}

CRITICAL INSTRUCTIONS:

1. **Color System**: Map EVERY color to a specific UI function. Use the extracted CSS colors as evidence — the most frequent background color is likely the Page Background, the most frequent text color is the Body Text, etc. Look at the screenshots to identify CTA button colors, accent colors, and borders.

2. **Type Scale**: Extract ACTUAL values from the screenshots and CSS data. Look at heading sizes, body text sizes, button text sizes. Reference the Color Token by name (e.g., "Body Text", "Primary CTA") — this creates a direct link to the color system.

3. **Component Styles**: Look at the actual buttons, cards, and form inputs in the screenshots. Extract real values — border radius, padding, hover effects.

4. **Effects**: Only include effects you actually observe. If the site is clean and flat, return an empty array. If it has gradients, glows, accent lines, describe them with CSS.

5. **Image Placement Map**: Based on how images are used in the screenshots, suggest where key images should be placed. Reference actual image filenames from the brand-assets folders when possible.

6. **Logo Usage**: Describe how logos appear in the header, footer, and favicon based on the screenshots.

7. **Be specific and precise**: Use exact hex codes, pixel values, and CSS properties. This guide will be used by AI to generate pixel-perfect pages.

Do NOT include markdown fences, prose, or any text outside the JSON object.`;

  emit('Sending data to Claude for brand analysis (this takes 2-5 minutes)...');

  let raw;
  try {
    raw = await runClaude(prompt, { addDirs: [tempDir] });
  } finally {
    try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
  }

  emit('Parsing brand guide output...');

  const parsed = parseJSON(raw);

  if (!parsed) {
    emit('Warning: Could not parse Claude output as JSON — using fallback data');
    return buildFallback(colors, fonts);
  }

  // Validate and fill in missing sections
  ensureSection(parsed, 'brandIdentity', {
    brandName: 'Unknown Brand',
    tagline: '',
    industry: '',
    targetAudience: '',
    brandPersonality: ''
  });

  ensureSection(parsed, 'colorSystem', {
    primary: colors.slice(0, 7).map((c, i) => ({
      name: ['Page Background', 'Card Background', 'Primary CTA', 'Accent / Highlight', 'Body Text', 'Secondary Text', 'Border / Divider'][i] || `Color ${i + 1}`,
      hex: c.hex,
      usedFor: ''
    })),
    utility: [
      { name: 'Success', hex: '#22C55E', usedFor: 'Success states, confirmations' },
      { name: 'Warning', hex: '#F59E0B', usedFor: 'Alerts, caution messages' },
      { name: 'Error', hex: '#EF4444', usedFor: 'Form errors, destructive actions' },
      { name: 'Glow / Aura', hex: 'rgba(100,100,100,0.15)', usedFor: 'Ambient background gradients' }
    ]
  });

  ensureSection(parsed, 'fontFamilies', [
    { role: 'Headings', family: fonts[0] || 'Sans-serif', source: 'Detected from CSS' },
    { role: 'Body', family: fonts[1] || fonts[0] || 'Sans-serif', source: 'Detected from CSS' }
  ]);

  ensureSection(parsed, 'typeScale', [
    { element: 'H1 / Hero', size: '64px', weight: '800', lineHeight: '0.95', transform: 'none', colorToken: 'Body Text' },
    { element: 'H2 / Section', size: '48px', weight: '700', lineHeight: '1.05', transform: 'none', colorToken: 'Body Text' },
    { element: 'H3 / Card Title', size: '20px', weight: '700', lineHeight: '1.3', transform: 'none', colorToken: 'Body Text' },
    { element: 'Body', size: '16px', weight: '400', lineHeight: '1.65', transform: 'none', colorToken: 'Secondary Text' },
    { element: 'Label / Overline', size: '14px', weight: '600', lineHeight: '1.4', transform: 'uppercase', colorToken: 'Primary CTA' },
    { element: 'Caption / Small', size: '13px', weight: '400', lineHeight: '1.5', transform: 'none', colorToken: 'Secondary Text' }
  ]);

  ensureSection(parsed, 'buttons', {
    primary: { background: '', textColor: '#FFFFFF', border: 'none', borderRadius: '12px', padding: '18px 42px', fontSize: '16px', fontWeight: '700', hoverEffect: 'translateY(-2px)' },
    secondary: { background: 'transparent', textColor: '', border: '2px solid rgba(255,255,255,0.3)', borderRadius: '12px', padding: '14px 36px', fontSize: '15px', fontWeight: '600', hoverEffect: 'border-color change' }
  });

  ensureSection(parsed, 'cards', {
    background: '', border: '', borderRadius: '16px', padding: '32px 28px', shadow: 'none'
  });

  ensureSection(parsed, 'formInputs', {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', focusState: '', placeholderColor: ''
  });

  ensureSection(parsed, 'spacing', {
    maxContentWidth: '1140px', sectionPadding: '100px top/bottom desktop, 60px mobile', containerSidePadding: '24px', gridGap: '24px', desktopColumns: '2-col default, 3-col for testimonials', mobileBreakpoint: '768px'
  });

  if (!parsed.effects) parsed.effects = [];
  if (!parsed.logoUsage) parsed.logoUsage = [];
  if (!parsed.imagePlacementMap) parsed.imagePlacementMap = [];

  emit('Brand analysis complete.');
  return parsed;
}

function ensureSection(obj, key, fallback) {
  if (!obj[key] || (typeof obj[key] === 'object' && Object.keys(obj[key]).length === 0)) {
    obj[key] = fallback;
  }
}

function buildFallback(colors, fonts) {
  return {
    brandIdentity: { brandName: 'Unknown Brand', tagline: '', industry: '', targetAudience: '', brandPersonality: '' },
    colorSystem: {
      primary: colors.slice(0, 7).map((c, i) => ({
        name: ['Page Background', 'Card Background', 'Primary CTA', 'Accent / Highlight', 'Body Text', 'Secondary Text', 'Border / Divider'][i] || `Color ${i + 1}`,
        hex: c.hex, usedFor: ''
      })),
      utility: [
        { name: 'Success', hex: '#22C55E', usedFor: 'Success states' },
        { name: 'Warning', hex: '#F59E0B', usedFor: 'Alerts' },
        { name: 'Error', hex: '#EF4444', usedFor: 'Form errors' },
        { name: 'Glow / Aura', hex: 'rgba(100,100,100,0.15)', usedFor: 'Ambient gradients' }
      ]
    },
    fontFamilies: [
      { role: 'Headings', family: fonts[0] || 'Sans-serif', source: 'Detected' },
      { role: 'Body', family: fonts[1] || fonts[0] || 'Sans-serif', source: 'Detected' }
    ],
    typeScale: [
      { element: 'H1 / Hero', size: '64px', weight: '800', lineHeight: '0.95', transform: 'none', colorToken: 'Body Text' },
      { element: 'H2 / Section', size: '48px', weight: '700', lineHeight: '1.05', transform: 'none', colorToken: 'Body Text' },
      { element: 'H3 / Card Title', size: '20px', weight: '700', lineHeight: '1.3', transform: 'none', colorToken: 'Body Text' },
      { element: 'Body', size: '16px', weight: '400', lineHeight: '1.65', transform: 'none', colorToken: 'Secondary Text' },
      { element: 'Label / Overline', size: '14px', weight: '600', lineHeight: '1.4', transform: 'uppercase', colorToken: 'Primary CTA' },
      { element: 'Caption / Small', size: '13px', weight: '400', lineHeight: '1.5', transform: 'none', colorToken: 'Secondary Text' }
    ],
    buttons: {
      primary: { background: '', textColor: '#FFFFFF', border: 'none', borderRadius: '12px', padding: '18px 42px', fontSize: '16px', fontWeight: '700', hoverEffect: 'translateY(-2px)' },
      secondary: { background: 'transparent', textColor: '', border: '2px solid rgba(255,255,255,0.3)', borderRadius: '12px', padding: '14px 36px', fontSize: '15px', fontWeight: '600', hoverEffect: 'border-color change' }
    },
    cards: { background: '', border: '', borderRadius: '16px', padding: '32px 28px', shadow: 'none' },
    formInputs: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', focusState: '', placeholderColor: '' },
    spacing: { maxContentWidth: '1140px', sectionPadding: '100px top/bottom desktop, 60px mobile', containerSidePadding: '24px', gridGap: '24px', desktopColumns: '2-col default', mobileBreakpoint: '768px' },
    effects: [],
    logoUsage: [],
    imagePlacementMap: []
  };
}
