/**
 * ingest.js — Stage 1: Parse brand package (.zip) and copy documents (.docx).
 * Extracts brand assets (colors, fonts, logos, photos) and raw copy text.
 */

import { mkdir, readFile, readdir, copyFile } from 'fs/promises';
import { join, basename, extname } from 'path';
import AdmZip from 'adm-zip';
import mammoth from 'mammoth';

/**
 * Map common filenames to page types.
 */
const FILENAME_TO_PAGE = {
  'landing': 'landing',
  'registration': 'landing',
  'upgrade': 'upgrade',
  'oto1': 'upgrade',
  'upsell': 'upsell',
  'oto2': 'upsell',
  'thank_you': 'thank_you',
  'thankyou': 'thank_you',
  'thank-you': 'thank_you',
  'replay': 'replay',
  'sales': 'sales'
};

/**
 * Detect page type from filename.
 */
function detectPageType(filename) {
  const name = basename(filename, extname(filename)).toLowerCase().replace(/[\s_-]+/g, '_');
  for (const [key, pageType] of Object.entries(FILENAME_TO_PAGE)) {
    if (name.includes(key)) return pageType;
  }
  return null;
}

/**
 * Parse a brand colors.md file into structured color array.
 * Expected format: lines like "Primary: #8B1A3A (Burgundy) — CTAs, headlines"
 */
function parseColors(text) {
  const colors = [];
  const lines = text.split('\n').filter(l => l.trim());
  for (const line of lines) {
    const hexMatch = line.match(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})/);
    if (hexMatch) {
      const hex = hexMatch[0];
      const nameMatch = line.match(/\(([^)]+)\)/);
      const name = nameMatch ? nameMatch[1] : '';
      const usage = line.replace(hexMatch[0], '').replace(nameMatch ? nameMatch[0] : '', '').replace(/[-—:]/g, '').trim();
      colors.push({ hex, name, usage });
    }
  }
  return colors;
}

/**
 * Parse a brand fonts.md file into structured font array.
 * Expected format: lines like "Heading: Cormorant Garamond (serif)"
 */
function parseFonts(text) {
  const fonts = [];
  const lines = text.split('\n').filter(l => l.trim());
  for (const line of lines) {
    const lower = line.toLowerCase();
    let role = 'body';
    if (lower.includes('heading') || lower.includes('display') || lower.includes('title')) role = 'heading';
    else if (lower.includes('body') || lower.includes('text') || lower.includes('paragraph')) role = 'body';
    else if (lower.includes('accent') || lower.includes('mono')) role = 'accent';

    // Extract font name — typically after a colon
    const colonIdx = line.indexOf(':');
    const fontPart = colonIdx >= 0 ? line.slice(colonIdx + 1).trim() : line.trim();
    // Remove parenthetical notes
    const name = fontPart.replace(/\([^)]*\)/g, '').replace(/[-—].*/g, '').trim();
    if (name) fonts.push({ name, role, weight: '400' });
  }
  return fonts;
}

/**
 * Main ingest function.
 * Extracts brand zip, parses copy docs, populates job.brand and job.pages.
 */
export async function ingest(job, emit) {
  const { tempDir, brandZipPath, copyDocPaths, funnelType } = job;

  // ── Extract brand zip ─────────────────────────────────────────────────
  emit('Extracting brand package...');
  const brandDir = join(tempDir, 'brand');
  await mkdir(brandDir, { recursive: true });

  const zip = new AdmZip(brandZipPath);
  zip.extractAllTo(brandDir, true);

  // Find the actual content root (some zips have a top-level folder)
  let brandRoot = brandDir;
  const topEntries = await readdir(brandDir);
  if (topEntries.length === 1) {
    const { stat } = await import('fs/promises');
    const singlePath = join(brandDir, topEntries[0]);
    const s = await stat(singlePath);
    if (s.isDirectory()) brandRoot = singlePath;
  }

  // ── Parse brand files ─────────────────────────────────────────────────
  emit('Parsing brand assets...');

  // Colors
  try {
    const colorsText = await readFile(join(brandRoot, 'colors.md'), 'utf-8');
    job.brand.colors = parseColors(colorsText);
    emit(`  Found ${job.brand.colors.length} brand colors.`);
  } catch { emit('  No colors.md found — will rely on brand_guide.md.'); }

  // Fonts
  try {
    const fontsText = await readFile(join(brandRoot, 'fonts.md'), 'utf-8');
    job.brand.fonts = parseFonts(fontsText);
    emit(`  Found ${job.brand.fonts.length} brand fonts.`);
  } catch { emit('  No fonts.md found — will rely on brand_guide.md.'); }

  // Brand guide
  try {
    const guide = await readFile(join(brandRoot, 'brand_guide.md'), 'utf-8');
    job.brand.brandGuide = guide;
    emit('  Brand guide loaded.');
  } catch { emit('  No brand_guide.md found.'); }

  // Logos
  const logosDir = join(brandRoot, 'logos');
  try {
    const logoFiles = await readdir(logosDir);
    const imageExts = ['.png', '.jpg', '.jpeg', '.svg', '.webp'];
    const logos = logoFiles.filter(f => imageExts.includes(extname(f).toLowerCase()));
    if (logos.length > 0) {
      job.brand.logoPath = join(logosDir, logos[0]);
      emit(`  Found ${logos.length} logo file(s). Using: ${logos[0]}`);
    }
  } catch { emit('  No logos/ directory found.'); }

  // Photos
  const photosDir = join(brandRoot, 'photos');
  try {
    const photoFiles = await readdir(photosDir);
    const imageExts = ['.png', '.jpg', '.jpeg', '.webp'];
    job.brand.photoPaths = photoFiles
      .filter(f => imageExts.includes(extname(f).toLowerCase()))
      .map(f => join(photosDir, f));
    emit(`  Found ${job.brand.photoPaths.length} photo(s).`);
  } catch { emit('  No photos/ directory found.'); }

  // ── Copy brand assets to output-ready location ────────────────────────
  const outputAssets = join(tempDir, 'output_assets');
  await mkdir(join(outputAssets, 'logos'), { recursive: true });
  await mkdir(join(outputAssets, 'photos'), { recursive: true });

  if (job.brand.logoPath) {
    const dest = join(outputAssets, 'logos', basename(job.brand.logoPath));
    await copyFile(job.brand.logoPath, dest);
  }
  for (const photoPath of job.brand.photoPaths) {
    const dest = join(outputAssets, 'photos', basename(photoPath));
    await copyFile(photoPath, dest);
  }

  // ── Parse copy documents ──────────────────────────────────────────────
  emit('Parsing copy documents...');

  // Load template config to know expected pages
  const templateDir = join(process.cwd(), 'templates', funnelType);
  const expectedPages = [];
  try {
    const templateFiles = await readdir(templateDir);
    for (const tf of templateFiles) {
      if (tf.endsWith('.json')) {
        expectedPages.push(tf.replace('.json', ''));
      }
    }
  } catch (err) {
    throw new Error(`Template directory not found: templates/${funnelType}/`);
  }

  for (const docInfo of copyDocPaths) {
    const pageType = detectPageType(docInfo.originalName);
    if (!pageType) {
      emit(`  Warning: Could not detect page type for "${docInfo.originalName}" — skipping.`);
      continue;
    }

    // Parse docx with mammoth
    const buffer = await readFile(docInfo.path);
    const result = await mammoth.extractRawText({ buffer });
    const rawText = result.value;

    // Create page entry
    const pageEntry = {
      pageType,
      templatePath: join(templateDir, `${pageType}.json`),
      copyRaw: rawText,
      copySlots: {},
      missingSlots: [],
      htmlPath: null,
      qaRounds: 0,
      qaStatus: 'pending',
      qaFeedback: [],
      screenshots: { mobile: null, tablet: null, desktop: null },
      deployedUrl: null
    };

    job.pages.push(pageEntry);
    emit(`  Parsed ${docInfo.originalName} → ${pageType} (${rawText.length} chars)`);
  }

  // Check for missing pages
  const foundTypes = job.pages.map(p => p.pageType);
  const missing = expectedPages.filter(ep => !foundTypes.includes(ep));
  if (missing.length > 0) {
    emit(`  Warning: Missing copy docs for: ${missing.join(', ')}`);
  }

  emit(`Ingest complete: ${job.brand.colors.length} colors, ${job.brand.fonts.length} fonts, ${job.pages.length} pages.`);
}
