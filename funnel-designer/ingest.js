/**
 * ingest.js — Stage 1: Parse brand package (.zip) and copy documents (.docx).
 * Extracts brand assets (colors, fonts, logos, photos) and raw copy text.
 */

import { mkdir, readFile, readdir, copyFile, stat } from 'fs/promises';
import { join, basename, extname } from 'path';
import { existsSync } from 'fs';
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
 * Recursively collect all image files from a directory.
 */
async function collectImages(dir, exts) {
  const results = [];
  try {
    const entries = await readdir(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const s = await stat(fullPath);
      if (s.isDirectory()) {
        results.push(...await collectImages(fullPath, exts));
      } else if (exts.includes(extname(entry).toLowerCase())) {
        results.push(fullPath);
      }
    }
  } catch { /* dir doesn't exist */ }
  return results;
}

/**
 * Try multiple paths and return the first that exists.
 */
function findDir(brandRoot, candidates) {
  for (const candidate of candidates) {
    const p = join(brandRoot, ...candidate.split('/'));
    if (existsSync(p)) return p;
  }
  return null;
}

/**
 * Try to read a file from multiple possible paths.
 */
async function readBrandFile(brandRoot, candidates) {
  for (const candidate of candidates) {
    try {
      return await readFile(join(brandRoot, ...candidate.split('/')), 'utf-8');
    } catch { /* try next */ }
  }
  return null;
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
    const singlePath = join(brandDir, topEntries[0]);
    const s = await stat(singlePath);
    if (s.isDirectory()) brandRoot = singlePath;
  }

  // ── Parse brand files ─────────────────────────────────────────────────
  emit('Parsing brand assets...');

  // Colors — try multiple locations
  const colorsText = await readBrandFile(brandRoot, ['colors.md', 'assets/colors.md']);
  if (colorsText) {
    job.brand.colors = parseColors(colorsText);
    emit(`  Found ${job.brand.colors.length} brand colors.`);
  } else {
    emit('  No colors.md found — will rely on brand_guide.md.');
  }

  // Fonts — try multiple locations
  const fontsText = await readBrandFile(brandRoot, ['fonts.md', 'assets/fonts.md']);
  if (fontsText) {
    job.brand.fonts = parseFonts(fontsText);
    emit(`  Found ${job.brand.fonts.length} brand fonts.`);
  } else {
    emit('  No fonts.md found — will rely on brand_guide.md.');
  }

  // Brand guide
  const guideText = await readBrandFile(brandRoot, ['brand_guide.md', 'assets/brand_guide.md']);
  if (guideText) {
    job.brand.brandGuide = guideText;
    emit('  Brand guide loaded.');
  } else {
    emit('  No brand_guide.md found.');
  }

  // Logos — try multiple locations, collect all images
  const logosDir = findDir(brandRoot, ['logos', 'assets/logos']);
  const imageExts = ['.png', '.jpg', '.jpeg', '.svg', '.webp'];
  if (logosDir) {
    const allLogos = await collectImages(logosDir, imageExts);
    if (allLogos.length > 0) {
      job.brand.logoPath = allLogos[0];
      emit(`  Found ${allLogos.length} logo file(s). Using: ${basename(allLogos[0])}`);
      // Store all logos for reference
      job.brand.allLogoPaths = allLogos;
    }
  } else {
    emit('  No logos/ directory found.');
  }

  // Photos — try multiple locations, recurse into subdirectories
  const photosDir = findDir(brandRoot, ['photos', 'assets/photos']);
  const photoExts = ['.png', '.jpg', '.jpeg', '.webp'];
  if (photosDir) {
    job.brand.photoPaths = await collectImages(photosDir, photoExts);
    emit(`  Found ${job.brand.photoPaths.length} photo(s).`);
  } else {
    emit('  No photos/ directory found.');
  }

  // ── Copy brand assets to output-ready location ────────────────────────
  const outputAssets = join(tempDir, 'output_assets');
  await mkdir(join(outputAssets, 'logos'), { recursive: true });
  await mkdir(join(outputAssets, 'photos'), { recursive: true });

  // Copy all logos (not just the primary one)
  const logosToCopy = job.brand.allLogoPaths || (job.brand.logoPath ? [job.brand.logoPath] : []);
  for (const logoPath of logosToCopy) {
    const dest = join(outputAssets, 'logos', basename(logoPath));
    await copyFile(logoPath, dest);
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

  // Create placeholder entries for missing pages (so all 6 always exist)
  const foundTypes = job.pages.map(p => p.pageType);
  const missing = expectedPages.filter(ep => !foundTypes.includes(ep));
  if (missing.length > 0) {
    emit(`  Creating placeholder entries for: ${missing.join(', ')}`);
    for (const pageType of missing) {
      job.pages.push({
        pageType,
        templatePath: join(templateDir, `${pageType}.json`),
        copyRaw: null,   // null = no copy uploaded
        copySlots: {},
        missingSlots: [],
        htmlPath: null,
        qaRounds: 0,
        qaStatus: 'pending',
        qaFeedback: [],
        screenshots: { mobile: null, tablet: null, desktop: null },
        deployedUrl: null
      });
    }
  }

  // Sort pages into canonical funnel flow order
  const FUNNEL_ORDER = ['landing', 'upgrade', 'upsell', 'thank_you', 'replay', 'sales'];
  job.pages.sort((a, b) => {
    const ai = FUNNEL_ORDER.indexOf(a.pageType);
    const bi = FUNNEL_ORDER.indexOf(b.pageType);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  emit(`Ingest complete: ${job.brand.colors.length} colors, ${job.brand.fonts.length} fonts, ${job.pages.length} pages (${job.pages.length - missing.length} with copy).`);
}
