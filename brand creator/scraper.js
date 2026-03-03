/**
 * scraper.js — Playwright-based website scraper for brand asset extraction.
 * Visits homepage + key pages, downloads ALL images, organizes into brand-assets folder structure.
 */

import { chromium } from 'playwright';
import { mkdir, writeFile, readdir, unlink } from 'fs/promises';
import { join, extname, basename } from 'path';
import { createHash } from 'crypto';
import { existsSync } from 'fs';

const MIN_PAGES = 5;
const MAX_PAGES = 10;
const MAX_ASSET_BYTES = 10 * 1024 * 1024; // 10MB

const KEY_PATH_KEYWORDS = [
  'about', 'webinar', 'course', 'coaching', 'sales', 'contact',
  'services', 'work', 'portfolio', 'blog', 'testimonial', 'review',
  'event', 'program', 'team', 'story', 'mission', 'media', 'press',
  'clients', 'results', 'case-stud', 'faq', 'pricing', 'products',
  'resources', 'speakers', 'instructors', 'trainers', 'podcast',
  'gallery', 'partners', 'sponsors', 'features', 'landing'
];

const PRIORITY_KEYWORDS = ['about', 'team', 'sales', 'testimonial', 'review', 'blog', 'webinar', 'event', 'products', 'courses'];

const SYSTEM_FONTS = new Set([
  'arial', 'helvetica', 'helvetica neue', 'verdana', 'georgia',
  'times new roman', 'times', 'courier', 'courier new',
  'tahoma', 'trebuchet ms', 'lucida grande', 'lucida sans',
  'lucida sans unicode', 'palatino linotype', 'book antiqua',
  'palatino', 'garamond', 'ms sans serif', 'ms serif',
  'comic sans ms', 'impact', 'arial black', 'arial narrow',
  'century gothic', 'gill sans', 'geneva', 'optima', 'avenir',
  'segoe ui', 'roboto', 'system-ui', '-apple-system',
  'blinkmacsystemfont', 'apple color emoji', 'segoe ui emoji',
  'segoe ui symbol', 'noto color emoji', 'ui-sans-serif',
  'ui-serif', 'ui-monospace', 'ui-rounded', 'droid serif',
  'droid sans', 'open sans', 'noto sans', 'noto serif',
  'san francisco', 'inter', 'ubuntu',
]);

// ── Brand-assets folder categories ─────────────────────────────────────────

const ASSET_FOLDERS = [
  'logos', 'logos/partners', 'hero', 'instructors', 'instructors/team',
  'testimonials', 'courses', 'icons', 'lifestyle', 'misc'
];

// ── Color helpers ──────────────────────────────────────────────────────────

function rgbToHex(rgb) {
  const m = rgb.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!m) return null;
  const r = parseInt(m[1]).toString(16).padStart(2, '0');
  const g = parseInt(m[2]).toString(16).padStart(2, '0');
  const b = parseInt(m[3]).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

function normalizeColor(raw) {
  raw = raw.trim().toLowerCase();
  if (/^#([0-9a-f]{3}){1,2}$/.test(raw)) {
    if (raw.length === 4) raw = `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
    return raw;
  }
  if (raw.startsWith('rgb')) return rgbToHex(raw);
  return null;
}

function isNoise(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const brightness = (r + g + b) / 3;
  if (brightness < 30 || brightness > 230) return true;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 15 && brightness > 50 && brightness < 210) return true;
  return false;
}

function extractColorsFromCSS(css, freqMap) {
  const hexMatches = css.match(/#([0-9a-fA-F]{3}){1,2}\b/g) || [];
  for (const h of hexMatches) {
    const norm = normalizeColor(h);
    if (norm && !isNoise(norm)) freqMap.set(norm, (freqMap.get(norm) || 0) + 1);
  }
  const rgbMatches = css.match(/rgba?\([^)]+\)/g) || [];
  for (const r of rgbMatches) {
    const norm = normalizeColor(r);
    if (norm && !isNoise(norm)) freqMap.set(norm, (freqMap.get(norm) || 0) + 1);
  }
}

function extractFontsFromCSS(css) {
  const fonts = new Set();
  const matches = css.match(/font-family\s*:\s*([^;}{]+)/gi) || [];
  for (const m of matches) {
    const value = m.replace(/font-family\s*:\s*/i, '').trim();
    for (const f of value.split(',')) {
      const name = f.trim().replace(/['"]/g, '').replace(/\s+/g, ' ');
      const lower = name.toLowerCase();
      if (!name || name.length <= 1) continue;
      if (['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'inherit', 'initial', 'unset'].includes(lower)) continue;
      if (SYSTEM_FONTS.has(lower)) continue;
      if (name.startsWith('var(') || name.startsWith('-')) continue;
      fonts.add(name);
    }
  }
  return [...fonts];
}

// ── Download helper ────────────────────────────────────────────────────────

async function downloadAsset(url, destPath) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return false;
    const contentLength = parseInt(res.headers.get('content-length') || '0');
    if (contentLength > MAX_ASSET_BYTES) return false;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength > MAX_ASSET_BYTES || buffer.byteLength === 0) return false;
    await writeFile(destPath, buffer);
    return true;
  } catch {
    return false;
  }
}

// ── Image classification ───────────────────────────────────────────────────

/**
 * Classify an image into one of the brand-assets folder categories.
 * Priority order matches the spec's sorting rules.
 */
function classifyImage(img) {
  const url = (img.src || '').toLowerCase();
  const alt = (img.alt || '').toLowerCase();
  const cls = (img.className || '').toLowerCase();
  const section = (img.sectionClass || '').toLowerCase();
  const sectionText = (img.sectionText || '').toLowerCase();
  const combined = `${url} ${alt} ${cls} ${section} ${sectionText}`;
  const w = img.naturalWidth || 0;
  const h = img.naturalHeight || 0;
  const isSvg = url.endsWith('.svg') || img.isSvg;

  // 1. Logo detection (highest priority)
  const isLogo = /logo|brand[-_]?mark|favicon/i.test(combined) ||
    (isSvg && w > 0 && w < 300 && h > 0 && h < 150 && /header|nav|footer/i.test(section));

  if (isLogo) {
    // Partner/trust logo?
    if (/partner|client|featured|as.seen|trust|press|media|sponsor|seen.in|featured.in/i.test(combined)) {
      return 'partners';
    }
    return 'logos';
  }

  // 2. Partner logos (in "as seen in" / trust sections, multiple small similar images)
  if (/partner|client|featured|as.seen|trust|press|media|sponsor/i.test(combined) && w < 300) {
    return 'partners';
  }

  // 3. Icons (very small images, SVGs with icon patterns)
  if ((w > 0 && w <= 80 && h > 0 && h <= 80) ||
    /icon[-_]|social[-_]|check[-_]|arrow[-_]|play[-_]|close[-_]/i.test(url) ||
    (isSvg && w > 0 && w <= 100 && !/logo/i.test(combined))) {
    return 'icons';
  }

  // 4. Social media icons
  if (/facebook|twitter|instagram|linkedin|youtube|tiktok|pinterest|x\.com/i.test(url) && (w <= 100 || isSvg)) {
    return 'icons';
  }

  // 5. Testimonial photos (in review/testimonial sections, typically small avatars)
  if (/testimonial|review|feedback|client.say|quote|endorsement/i.test(combined)) {
    return 'testimonials';
  }

  // 6. Instructor/founder/speaker headshots
  const personPatterns = /headshot|portrait|founder|author|speaker|coach|mentor|ceo|president|director|instructor|trainer|facilitator/;
  if (personPatterns.test(combined)) {
    return 'instructors';
  }
  // Person in about/bio section (square/portrait aspect ratio)
  if (/about|bio|story|our.founder|meet/i.test(combined) && w >= 150 && h >= 150) {
    const ratio = w / h;
    if (ratio >= 0.5 && ratio <= 1.8) return 'instructors';
  }

  // 7. Team member photos
  if (/team|staff|our.people|leadership/i.test(combined) && w >= 80) {
    return 'team';
  }

  // 8. Course/product thumbnails
  if (/product|course|program|pricing|offering|workshop|class|module|bundle|membership|masterclass/i.test(combined)) {
    return 'courses';
  }

  // 9. Hero/background (very large or explicit hero patterns)
  if (w >= 1200 || img.isBackground ||
    /hero|banner|header.bg|background|bg[-_]|cover[-_]|jumbotron|parallax/i.test(combined)) {
    return 'hero';
  }

  // 10. Lifestyle photography (medium-large general images)
  if (w >= 400 && h >= 300) return 'lifestyle';

  // 11. Small-to-medium uncategorized
  if (w >= 100 || h >= 100) return 'misc';

  return 'misc';
}

// ── Naming conventions ─────────────────────────────────────────────────────

function slugify(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

function generateFilename(category, img, existingNames) {
  let ext;
  try {
    ext = extname(new URL(img.src).pathname).toLowerCase();
  } catch {
    ext = '';
  }
  if (!ext || ext === '.') ext = img.isSvg ? '.svg' : '.jpg';

  const altSlug = img.alt ? slugify(img.alt) : '';

  let base;
  switch (category) {
    case 'logos':
      base = altSlug || `logo-${Date.now().toString(36)}`;
      break;
    case 'partners':
      base = altSlug ? `${altSlug}-logo` : `partner-logo-${Date.now().toString(36)}`;
      break;
    case 'hero':
      base = img.sectionText ? `hero-${slugify(img.sectionText)}-bg` : `hero-bg-${Date.now().toString(36)}`;
      break;
    case 'instructors':
      base = altSlug ? `instructor-${altSlug}` : `instructor-${Date.now().toString(36)}`;
      break;
    case 'team':
      base = altSlug || `team-member-${Date.now().toString(36)}`;
      break;
    case 'testimonials':
      base = altSlug ? `testimonial-${altSlug}` : `testimonial-${Date.now().toString(36)}`;
      break;
    case 'courses':
      base = altSlug || `course-${Date.now().toString(36)}`;
      break;
    case 'icons':
      base = altSlug ? `icon-${altSlug}` : `icon-${Date.now().toString(36)}`;
      break;
    case 'lifestyle':
      base = altSlug ? `lifestyle-${altSlug}` : `lifestyle-${Date.now().toString(36)}`;
      break;
    default:
      base = altSlug || `asset-${Date.now().toString(36)}`;
  }

  // Truncate and ensure uniqueness
  base = base.slice(0, 60);
  let filename = `${base}${ext}`;
  if (existingNames.has(filename)) {
    const hash = createHash('md5').update(img.src || '').digest('hex').slice(0, 6);
    filename = `${base}-${hash}${ext}`;
  }
  existingNames.add(filename);
  return filename;
}

// ── Main scrape function ───────────────────────────────────────────────────

/**
 * Scrape a website and extract all brand assets into organized folders.
 *
 * @param {string} url - Target website URL
 * @param {string} tempDir - Path to temp directory for storing assets
 * @param {function} emit - Progress callback
 * @returns {object} { pages, imageLibrary, colors, fonts, copyText, products }
 */
export async function scrapeWebsite(url, tempDir, emit) {
  // Create brand-assets folder structure
  const assetsBase = join(tempDir, 'brand-assets');
  for (const folder of ASSET_FOLDERS) {
    await mkdir(join(assetsBase, folder), { recursive: true });
  }

  emit('Launching browser...');
  const browser = await chromium.launch({ headless: true });

  const colorFreq = new Map();
  const fontsFound = new Set();
  const copyText = [];
  const pagesVisited = [];
  const productsFound = new Set();
  const seenUrls = new Set();
  const seenAssetUrls = new Set();
  const usedFilenames = new Map(); // category -> Set of filenames

  // Initialize image library
  const imageLibrary = {};
  for (const folder of ASSET_FOLDERS) {
    const key = folder.replace('/', '_'); // 'logos/partners' -> 'logos_partners'
    imageLibrary[key] = [];
    usedFilenames.set(key, new Set());
  }
  // Map folder paths to keys
  const folderToKey = {};
  for (const folder of ASSET_FOLDERS) {
    folderToKey[folder] = folder.replace('/', '_');
  }

  // Category name to folder path mapping
  const categoryToFolder = {
    logos: 'logos',
    partners: 'logos/partners',
    hero: 'hero',
    instructors: 'instructors',
    team: 'instructors/team',
    testimonials: 'testimonials',
    courses: 'courses',
    icons: 'icons',
    lifestyle: 'lifestyle',
    misc: 'misc'
  };

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const rootUrl = new URL(url);
    const origin = rootUrl.origin;

    // ── Discover pages to visit ──────────────────────────────────────────
    const pagesToVisit = [url];
    seenUrls.add(url);
    let allHomepageLinks = [];

    emit(`Visiting homepage: ${url}`);
    const homePage = await context.newPage();

    try {
      await homePage.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await homePage.waitForTimeout(1500);

      const links = await homePage.$$eval('a[href]', els =>
        els.map(el => ({ href: el.href, text: el.textContent?.trim() || '' }))
      );
      allHomepageLinks = links;

      for (const { href, text } of links) {
        if (pagesToVisit.length >= MAX_PAGES) break;
        try {
          const linkUrl = new URL(href);
          if (linkUrl.origin !== origin) continue;
          if (seenUrls.has(linkUrl.href)) continue;
          const combined = (linkUrl.pathname + text).toLowerCase();
          if (KEY_PATH_KEYWORDS.some(k => combined.includes(k))) {
            pagesToVisit.push(linkUrl.href);
            seenUrls.add(linkUrl.href);
          }
        } catch {}
      }

      // Add /about if not found
      const aboutUrl = `${origin}/about`;
      if (!seenUrls.has(aboutUrl) && pagesToVisit.length < MAX_PAGES) {
        pagesToVisit.push(aboutUrl);
        seenUrls.add(aboutUrl);
      }

      // Fallback: fill up to MIN_PAGES with any internal links
      if (pagesToVisit.length < MIN_PAGES) {
        for (const { href } of allHomepageLinks) {
          if (pagesToVisit.length >= MIN_PAGES) break;
          try {
            const linkUrl = new URL(href);
            if (linkUrl.origin !== origin || seenUrls.has(linkUrl.href)) continue;
            if (linkUrl.pathname === '/' || linkUrl.pathname === rootUrl.pathname) continue;
            if (/\.(pdf|zip|jpg|png|gif|svg|mp4|mp3|doc|xls)$/i.test(linkUrl.pathname)) continue;
            pagesToVisit.push(linkUrl.href);
            seenUrls.add(linkUrl.href);
          } catch {}
        }
      }
    } catch (err) {
      emit(`Warning: Could not fully load homepage — ${err.message}`);
    } finally {
      await homePage.close();
    }

    // Priority sort
    if (pagesToVisit.length > 1) {
      const homepage = pagesToVisit[0];
      const rest = pagesToVisit.slice(1);
      rest.sort((a, b) => {
        const aScore = PRIORITY_KEYWORDS.some(k => a.toLowerCase().includes(k)) ? 0 : 1;
        const bScore = PRIORITY_KEYWORDS.some(k => b.toLowerCase().includes(k)) ? 0 : 1;
        return aScore - bScore;
      });
      pagesToVisit.length = 0;
      pagesToVisit.push(homepage, ...rest);
    }

    emit(`Found ${pagesToVisit.length} pages to scrape.`);

    // ── Visit each page ──────────────────────────────────────────────────

    for (const pageUrl of pagesToVisit) {
      emit(`Scraping: ${pageUrl}`);
      const page = await context.newPage();

      try {
        await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(1200);

        // Scroll to trigger lazy-load
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(600);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(400);

        // Screenshot
        const screenshotBuffer = await page.screenshot({ fullPage: true, type: 'jpeg', quality: 55 });
        const screenshotB64 = screenshotBuffer.toString('base64');

        // ── Extract CSS ──────────────────────────────────────────────────

        const cssContent = await page.evaluate(async () => {
          let css = '';
          for (const el of document.querySelectorAll('style')) {
            css += el.textContent + '\n';
          }
          for (const sel of ['body', 'h1', 'h2', 'h3', 'p', 'a', 'button', '.btn', '.cta', 'header', 'footer', 'nav', 'section']) {
            try {
              const el = document.querySelector(sel);
              if (el) {
                const s = window.getComputedStyle(el);
                css += `${sel}{color:${s.color};background-color:${s.backgroundColor};font-family:${s.fontFamily};font-size:${s.fontSize};font-weight:${s.fontWeight};line-height:${s.lineHeight};}\n`;
              }
            } catch {}
          }
          const sheetUrls = [];
          for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
            if (link.href) sheetUrls.push(link.href);
          }
          return { css, sheetUrls };
        });

        extractColorsFromCSS(cssContent.css, colorFreq);
        const pageFonts = extractFontsFromCSS(cssContent.css);
        for (const f of pageFonts) fontsFound.add(f);

        // Fetch linked stylesheets
        for (const sheetUrl of (cssContent.sheetUrls || []).slice(0, 5)) {
          try {
            const res = await fetch(sheetUrl);
            if (res.ok) {
              const sheetCss = await res.text();
              extractColorsFromCSS(sheetCss, colorFreq);
              const sf = extractFontsFromCSS(sheetCss);
              for (const f of sf) fontsFound.add(f);
            }
          } catch {}
        }

        // ── Extract copy text ────────────────────────────────────────────

        const pageText = await page.evaluate(() => {
          const textEls = document.querySelectorAll('h1, h2, h3, p, li, blockquote');
          return Array.from(textEls).map(el => el.textContent?.trim()).filter(Boolean).join(' ').slice(0, 2000);
        });
        if (pageText) copyText.push(pageText);

        // ── Discover products ────────────────────────────────────────────

        const pageProducts = await page.evaluate(() => {
          const products = new Set();
          const productSelectors = [
            '[class*="product"] h2, [class*="product"] h3',
            '[class*="course"] h2, [class*="course"] h3',
            '[class*="program"] h2, [class*="program"] h3',
            '[class*="offering"] h2, [class*="offering"] h3',
            '[class*="pricing"] h2, [class*="pricing"] h3',
          ];
          for (const sel of productSelectors) {
            for (const el of document.querySelectorAll(sel)) {
              const name = el.textContent?.trim();
              if (name && name.length > 3 && name.length < 80 && name.split(/\s+/).length <= 8) products.add(name);
            }
          }
          for (const h of document.querySelectorAll('h1, h2, h3')) {
            const text = h.textContent?.trim() || '';
            if (/course|program|masterclass|bootcamp|workshop|coaching|membership|academy|method|blueprint|formula|bundle/i.test(text)) {
              if (text.length > 3 && text.length < 80 && text.split(/\s+/).length <= 8) products.add(text);
            }
          }
          return [...products];
        });
        for (const p of pageProducts) productsFound.add(p);

        // ── Extract ALL images ───────────────────────────────────────────

        const images = await page.$$eval('img', els =>
          els.map(el => {
            let section = el.closest('section, [class*="about"], [class*="team"], [class*="bio"], [class*="testimonial"], [class*="hero"], [class*="partner"], [class*="client"], [class*="course"], [class*="product"], article, header, footer, main');
            return {
              src: el.src,
              alt: el.alt || '',
              className: el.className || '',
              naturalWidth: el.naturalWidth,
              naturalHeight: el.naturalHeight,
              sectionClass: section?.className || '',
              sectionText: section?.querySelector('h1, h2, h3')?.textContent?.trim()?.slice(0, 100) || '',
              isSvg: false,
              isBackground: false
            };
          })
        );

        // ── Extract background images from CSS ───────────────────────────

        const bgImages = await page.evaluate(() => {
          const results = [];
          const elements = document.querySelectorAll('section, div, header, footer, [class*="hero"], [class*="banner"], [class*="bg"], [class*="background"], [class*="cover"]');
          for (const el of elements) {
            try {
              const style = window.getComputedStyle(el);
              const bg = style.backgroundImage;
              if (bg && bg !== 'none') {
                const matches = bg.match(/url\(["']?([^"')]+)["']?\)/g) || [];
                for (const match of matches) {
                  const bgUrl = match.replace(/url\(["']?/, '').replace(/["']?\)/, '');
                  if (bgUrl && !bgUrl.startsWith('data:')) {
                    results.push({
                      src: bgUrl,
                      alt: '',
                      className: '',
                      naturalWidth: el.offsetWidth || 0,
                      naturalHeight: el.offsetHeight || 0,
                      sectionClass: el.className || '',
                      sectionText: el.querySelector('h1, h2, h3')?.textContent?.trim()?.slice(0, 100) || '',
                      isSvg: bgUrl.endsWith('.svg'),
                      isBackground: true
                    });
                  }
                }
              }
            } catch {}
          }
          return results;
        });

        // ── Extract inline SVGs ──────────────────────────────────────────

        const inlineSvgs = await page.$$eval('svg', els =>
          els.slice(0, 15).map((el, i) => {
            const section = el.closest('section, header, footer, nav, [class*="icon"], [class*="logo"]');
            return {
              content: el.outerHTML,
              width: parseInt(el.getAttribute('width') || el.getBoundingClientRect().width || '0'),
              height: parseInt(el.getAttribute('height') || el.getBoundingClientRect().height || '0'),
              sectionClass: section?.className || '',
              sectionText: ''
            };
          })
        );

        // ── Download and classify all images ─────────────────────────────

        const allImages = [...images, ...bgImages];

        for (const img of allImages) {
          if (!img.src || seenAssetUrls.has(img.src)) continue;
          try { new URL(img.src); } catch { continue; }
          seenAssetUrls.add(img.src);

          // Allow all common image formats
          const ext = extname(new URL(img.src).pathname).toLowerCase();
          if (ext && !['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.avif', '.ico'].includes(ext)) continue;

          const category = classifyImage(img);
          const folder = categoryToFolder[category];
          const key = folderToKey[folder];
          const filename = generateFilename(category, img, usedFilenames.get(key));
          const destPath = join(assetsBase, folder, filename);

          const ok = await downloadAsset(img.src, destPath);
          if (ok) {
            imageLibrary[key].push({
              url: img.src,
              localPath: destPath,
              filename,
              alt: img.alt || '',
              context: {
                sectionText: img.sectionText || '',
                sectionClass: img.sectionClass || '',
                dimensions: { w: img.naturalWidth, h: img.naturalHeight },
                isBackground: img.isBackground || false
              }
            });
          }
        }

        // Save inline SVGs as icon/logo files
        for (let i = 0; i < inlineSvgs.length; i++) {
          const svg = inlineSvgs[i];
          if (svg.content.length < 100) continue; // Skip trivial SVGs

          const isLogo = /logo|brand/i.test(svg.sectionClass);
          const category = isLogo ? 'logos' : 'icons';
          const folder = categoryToFolder[category];
          const key = folderToKey[folder];
          const nameSet = usedFilenames.get(key);
          const prefix = isLogo ? 'logo' : 'icon';
          let filename = `${prefix}-inline-${i + 1}.svg`;
          if (nameSet.has(filename)) filename = `${prefix}-inline-${i + 1}-${Date.now().toString(36)}.svg`;
          nameSet.add(filename);

          const destPath = join(assetsBase, folder, filename);
          await writeFile(destPath, svg.content);
          imageLibrary[key].push({
            url: `inline-svg-${i}`,
            localPath: destPath,
            filename,
            alt: isLogo ? 'Extracted logo SVG' : 'Extracted icon SVG',
            context: { sectionText: '', sectionClass: svg.sectionClass, dimensions: { w: svg.width, h: svg.height }, isBackground: false }
          });
        }

        pagesVisited.push({ url: pageUrl, screenshotB64, title: await page.title() });
        emit(`Done: ${await page.title() || pageUrl}`);
      } catch (err) {
        emit(`Warning: Failed to scrape ${pageUrl} — ${err.message}`);
      } finally {
        await page.close();
      }
    }

    await context.close();
  } finally {
    await browser.close();
  }

  // Remove empty files (failed downloads)
  for (const folder of ASSET_FOLDERS) {
    const dir = join(assetsBase, folder);
    try {
      const files = await readdir(dir);
      for (const file of files) {
        const filePath = join(dir, file);
        try {
          const { size } = await import('fs').then(fs => fs.promises.stat(filePath));
          if (size === 0) await unlink(filePath);
        } catch {}
      }
    } catch {}
  }

  // Sort colors by frequency
  const sortedColors = [...colorFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15) // Keep more colors for the analyzer to map to functions
    .map(([hex, count]) => ({ hex, count }));

  // Count totals
  const totalImages = Object.values(imageLibrary).reduce((sum, arr) => sum + arr.length, 0);
  const breakdown = Object.entries(imageLibrary)
    .filter(([, arr]) => arr.length > 0)
    .map(([key, arr]) => `${key}: ${arr.length}`)
    .join(', ');

  emit(`Extraction complete — ${pagesVisited.length} pages, ${sortedColors.length} colors, ${fontsFound.size} fonts, ${totalImages} images (${breakdown})`);

  return {
    pages: pagesVisited,
    imageLibrary,
    colors: sortedColors,
    fonts: [...fontsFound].slice(0, 8),
    copyText: copyText.join('\n\n'),
    products: [...productsFound]
  };
}
