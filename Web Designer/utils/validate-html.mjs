/**
 * HTML output validator for the build pipeline.
 *
 * Usage:
 *   import { validateHTML } from './utils/validate-html.mjs';
 *   const result = validateHTML(htmlString, { brandFonts: ['Cormorant Garamond', 'Montserrat'] });
 *   // { valid: boolean, errors: [...], warnings: [...] }
 */

const PLACEHOLDER_PATTERNS = [
  /Lorem ipsum/i,
  /dolor sit amet/i,
  /\[your\s+\w+.*?\]/i,
  /\[placeholder.*?\]/i,
  /\[insert\s+\w+.*?\]/i,
  /\{\{.*?\}\}/,
  /TODO\b/,
  /FIXME\b/,
  /XXX\b/,
  /\[REPLACE\b.*?\]/i,
  /\[YOUR\s/i,
  /sample\s+text\s+here/i,
  /click\s+here\s+to\s+edit/i,
];

const SIZE_WARN_DEFAULT = 500 * 1024;  // 500 KB
const SIZE_ERROR_DEFAULT = 2 * 1024 * 1024;  // 2 MB

/**
 * @param {string} html - The full HTML string to validate
 * @param {object} [options]
 * @param {string[]} [options.brandFonts]      - Expected Google Fonts family names
 * @param {number}   [options.maxWarnSize]     - File size warning threshold in bytes (default 500KB)
 * @param {number}   [options.maxErrorSize]    - File size error threshold in bytes (default 2MB)
 * @param {boolean}  [options.expectDarkMode]  - If true, warn when dark mode support is missing
 * @param {object}   [options.brandColors]     - Map of color roles to hex values, e.g. { primary: '#8B1A3A', secondary: '#C9963A', accent: '#E8C4B0' }
 * @param {object}   [options.brandFontSpec]   - { heading: 'Cormorant Garamond', body: 'Montserrat' }
 * @param {string}   [options.brandAssetsPath] - Path to brand assets directory — triggers SVG placeholder detection
 * @param {string[]} [options.requiredTerms]   - Brand terms that must appear in text content
 * @param {boolean}  [options.checkTypography] - If true, run typography metrics checks (font-size hierarchy, line-height, letter-spacing)
 * @param {boolean}  [options.checkSpacing]    - If true, run section spacing consistency checks
 * @param {boolean}  [options.checkContrast]   - If true, run color contrast checks on inline-styled text/background pairs
 * @returns {{ valid: boolean, errors: Array<{rule: string, message: string}>, warnings: Array<{rule: string, message: string}> }}
 */
export function validateHTML(html, options = {}) {
  const {
    brandFonts = [],
    maxWarnSize = SIZE_WARN_DEFAULT,
    maxErrorSize = SIZE_ERROR_DEFAULT,
    expectDarkMode = false,
    brandColors = null,
    brandFontSpec = null,
    brandAssetsPath = null,
    requiredTerms = null,
    checkTypography = false,
    checkSpacing = false,
    checkContrast = false,
  } = options;

  const errors = [];
  const warnings = [];

  checkDoctype(html, errors);
  checkStructureTags(html, errors);
  checkTailwindCDN(html, errors);
  checkContentBlocks(html, errors);
  checkPlaceholderText(html, warnings);
  checkImageSources(html, errors, warnings);
  checkCssUrls(html, warnings);
  checkGoogleFonts(html, brandFonts, errors, warnings);
  checkFileSize(html, maxWarnSize, maxErrorSize, errors, warnings);
  if (expectDarkMode) checkDarkMode(html, warnings);

  // Brand compliance checks
  if (brandColors) checkBrandColors(html, brandColors, errors, warnings);
  if (brandFontSpec) checkBrandFonts(html, brandFontSpec, errors, warnings);
  if (brandAssetsPath) checkRealAssets(html, brandAssetsPath, errors, warnings);
  checkDefaultTailwindColors(html, errors);
  if (requiredTerms) checkRequiredTerms(html, requiredTerms, warnings);

  // Typography, spacing, and contrast checks
  if (checkTypography) checkTypographyMetrics(html, options, warnings);
  if (checkSpacing) checkSpacingConsistency(html, warnings);
  if (checkContrast) checkColorContrast(html, warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ─── Individual checks ───────────────────────────────────

function checkDoctype(html, errors) {
  if (!/<!DOCTYPE\s+html\s*>/i.test(html)) {
    errors.push({ rule: 'doctype', message: 'Missing <!DOCTYPE html> declaration' });
  }
}

function checkStructureTags(html, errors) {
  if (!/<html[\s>]/i.test(html)) {
    errors.push({ rule: 'structure', message: 'Missing <html> tag' });
  }
  if (!/<head[\s>]/i.test(html)) {
    errors.push({ rule: 'structure', message: 'Missing <head> tag' });
  }
  if (!/<body[\s>]/i.test(html)) {
    errors.push({ rule: 'structure', message: 'Missing <body> tag' });
  }
}

function checkTailwindCDN(html, errors) {
  if (!/cdn\.tailwindcss\.com/i.test(html)) {
    errors.push({ rule: 'tailwind', message: 'Missing Tailwind CSS CDN script tag' });
  }
}

function checkContentBlocks(html, errors) {
  const hasSection = /<section[\s>]/i.test(html);
  const hasMain = /<main[\s>]/i.test(html);
  const hasArticle = /<article[\s>]/i.test(html);
  const hasDiv = /<div[\s>]/i.test(html);

  if (!hasSection && !hasMain && !hasArticle && !hasDiv) {
    errors.push({ rule: 'content', message: 'No content blocks found (expected <section>, <main>, <article>, or <div>)' });
  }
}

function checkPlaceholderText(html, warnings) {
  // Strip HTML tags to check visible text content only
  const textContent = html.replace(/<[^>]*>/g, ' ');

  for (const pattern of PLACEHOLDER_PATTERNS) {
    const match = textContent.match(pattern);
    if (match) {
      warnings.push({
        rule: 'placeholder',
        message: `Placeholder text detected: "${match[0]}"`,
      });
    }
  }
}

function checkImageSources(html, errors, warnings) {
  const imgRegex = /<img\s[^>]*?src\s*=\s*["']([^"']*)["'][^>]*>/gi;
  let match;

  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1].trim();

    if (!src) {
      errors.push({ rule: 'img-src', message: 'Found <img> with empty src attribute' });
      continue;
    }

    // Absolute URLs are acceptable
    if (/^https?:\/\//i.test(src)) continue;

    // Data URIs are acceptable
    if (/^data:/i.test(src)) continue;

    // Relative paths — flag as warning (cannot verify file existence from string alone)
    if (src.startsWith('/') || src.startsWith('./') || src.startsWith('../') || /^[a-zA-Z0-9]/.test(src)) {
      warnings.push({
        rule: 'img-src',
        message: `Relative image path "${src}" — verify the file exists`,
      });
      continue;
    }

    errors.push({ rule: 'img-src', message: `Invalid image src: "${src}"` });
  }
}

function checkCssUrls(html, warnings) {
  const PLACEHOLDER_DOMAINS = [
    'example.com', 'example.org', 'example.net',
    'placehold.co', 'placeholder.com', 'via.placeholder.com',
    'placekitten.com', 'picsum.photos',
  ];

  const PLACEHOLDER_FILENAME_PATTERNS = [
    /placeholder/i,
    /example[-_]?image/i,
    /sample[-_]?image/i,
  ];

  const urlValues = [];

  // Extract url() from <style> blocks
  const styleBlockRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let styleMatch;
  while ((styleMatch = styleBlockRegex.exec(html)) !== null) {
    extractCssUrlValues(styleMatch[1], urlValues);
  }

  // Extract url() from inline style="" attributes
  const inlineStyleRegex = /style\s*=\s*["']([^"']*)["']/gi;
  let inlineMatch;
  while ((inlineMatch = inlineStyleRegex.exec(html)) !== null) {
    extractCssUrlValues(inlineMatch[1], urlValues);
  }

  for (const raw of urlValues) {
    const trimmed = raw.trim();

    // Empty url()
    if (!trimmed) {
      warnings.push({ rule: 'css-url', message: 'Found empty CSS url() value' });
      continue;
    }

    // Strip surrounding quotes
    const unquoted = trimmed.replace(/^['"]|['"]$/g, '').trim();

    // Empty after removing quotes: url('') or url("")
    if (!unquoted) {
      warnings.push({ rule: 'css-url', message: 'Found empty CSS url() value' });
      continue;
    }

    // Data URIs are fine
    if (/^data:/i.test(unquoted)) continue;

    // Absolute URLs — check for placeholder domains
    if (/^https?:\/\//i.test(unquoted)) {
      try {
        const hostname = new URL(unquoted).hostname;
        if (PLACEHOLDER_DOMAINS.includes(hostname)) {
          warnings.push({
            rule: 'css-url',
            message: `CSS url() points to placeholder domain: "${unquoted}"`,
          });
        }
      } catch {
        warnings.push({
          rule: 'css-url',
          message: `CSS url() contains invalid URL: "${unquoted}"`,
        });
      }
      continue;
    }

    // Non-URL values (gradients, none, etc.) — skip
    if (/^(linear-gradient|radial-gradient|conic-gradient|none)\b/i.test(unquoted)) continue;

    // Relative path or bare filename — check for placeholder patterns
    for (const pattern of PLACEHOLDER_FILENAME_PATTERNS) {
      if (pattern.test(unquoted)) {
        warnings.push({
          rule: 'css-url',
          message: `CSS url() contains placeholder path: "${unquoted}"`,
        });
        break;
      }
    }
  }
}

function extractCssUrlValues(cssText, results) {
  const urlRegex = /url\(\s*([^)]*?)\s*\)/gi;
  let match;
  while ((match = urlRegex.exec(cssText)) !== null) {
    results.push(match[1]);
  }
}

function checkGoogleFonts(html, brandFonts, errors, warnings) {
  if (brandFonts.length === 0) return;

  const fontLinkRegex = /fonts\.googleapis\.com\/css2?\?[^"']*/gi;
  const fontLinks = html.match(fontLinkRegex) || [];

  if (fontLinks.length === 0) {
    errors.push({
      rule: 'google-fonts',
      message: `No Google Fonts link found — expected: ${brandFonts.join(', ')}`,
    });
    return;
  }

  const allFontText = fontLinks.join(' ');

  for (const font of brandFonts) {
    // Google Fonts URLs encode spaces as + signs
    const fontEncoded = font.replace(/\s+/g, '\\+');
    const fontPattern = new RegExp(fontEncoded, 'i');
    if (!fontPattern.test(allFontText)) {
      warnings.push({
        rule: 'google-fonts',
        message: `Brand font "${font}" not found in Google Fonts link`,
      });
    }
  }
}

function checkFileSize(html, maxWarnSize, maxErrorSize, errors, warnings) {
  const sizeBytes = Buffer.byteLength(html, 'utf8');

  if (sizeBytes > maxErrorSize) {
    errors.push({
      rule: 'file-size',
      message: `File size ${formatBytes(sizeBytes)} exceeds ${formatBytes(maxErrorSize)} limit`,
    });
  } else if (sizeBytes > maxWarnSize) {
    warnings.push({
      rule: 'file-size',
      message: `File size ${formatBytes(sizeBytes)} exceeds ${formatBytes(maxWarnSize)} recommended limit`,
    });
  }
}

function checkDarkMode(html, warnings) {
  const hasMediaQuery = /prefers-color-scheme:\s*dark/i.test(html);
  const hasDataTheme = /data-theme\s*=\s*["']dark["']/i.test(html);
  const hasCssVars = /--color-[\w-]+\s*:/i.test(html);
  const hasToggle = /theme-toggle/i.test(html);

  if (!hasMediaQuery && !hasDataTheme) {
    warnings.push({
      rule: 'dark-mode',
      message: 'Dark mode expected but no prefers-color-scheme media query or data-theme attribute found',
    });
  }

  if (!hasCssVars) {
    warnings.push({
      rule: 'dark-mode',
      message: 'Dark mode expected but no CSS custom properties (--color-*) found for theming',
    });
  }

  if (!hasToggle) {
    warnings.push({
      rule: 'dark-mode',
      message: 'Dark mode enabled but no theme toggle element found — users cannot manually switch themes',
    });
  }
}

// ─── Brand compliance checks ─────────────────────────────

const PRIMARY_ROLES = ['primary', 'secondary'];

/**
 * Verify each hex color from brandColors appears at least once in the HTML.
 * Error for primary/secondary missing; warn for other roles missing.
 */
function checkBrandColors(html, brandColors, errors, warnings) {
  const htmlLower = html.toLowerCase();

  for (const [role, hex] of Object.entries(brandColors)) {
    if (!hex || typeof hex !== 'string') continue;
    const normalizedHex = hex.toLowerCase().trim();

    // Check for the hex value anywhere in the HTML (inline styles, Tailwind config, CSS)
    if (!htmlLower.includes(normalizedHex)) {
      const isPrimary = PRIMARY_ROLES.includes(role.toLowerCase());
      const entry = {
        rule: 'brand-colors',
        message: `Brand ${role} color ${hex} not found in HTML`,
      };
      if (isPrimary) {
        errors.push(entry);
      } else {
        warnings.push(entry);
      }
    }
  }
}

/**
 * Verify brand heading and body fonts appear in font-family declarations
 * (inline styles or Tailwind config).
 */
function checkBrandFonts(html, brandFontSpec, errors, warnings) {
  const htmlLower = html.toLowerCase();

  for (const [role, fontName] of Object.entries(brandFontSpec)) {
    if (!fontName || typeof fontName !== 'string') continue;
    const fontLower = fontName.toLowerCase().trim();

    // Check font-family in inline styles, <style> blocks, and Tailwind config
    if (!htmlLower.includes(fontLower)) {
      errors.push({
        rule: 'brand-fonts',
        message: `Brand ${role} font "${fontName}" not found in HTML (expected in font-family or Tailwind config)`,
      });
    }
  }
}

/**
 * Detect SVG data URI placeholder images when a brandAssetsPath is provided.
 * Warn for each SVG placeholder found. Error if ALL images are placeholders.
 */
function checkRealAssets(html, brandAssetsPath, errors, warnings) {
  const imgRegex = /<img\s[^>]*?src\s*=\s*["']([^"']*)["'][^>]*>/gi;
  let match;
  let totalImages = 0;
  let svgPlaceholders = 0;

  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1].trim();
    if (!src) continue;
    totalImages++;

    if (/^data:image\/svg\+xml/i.test(src)) {
      svgPlaceholders++;
      warnings.push({
        rule: 'real-assets',
        message: `SVG data URI placeholder found — use a real asset from ${brandAssetsPath}`,
      });
    }
  }

  if (totalImages > 0 && svgPlaceholders === totalImages) {
    errors.push({
      rule: 'real-assets',
      message: `All ${totalImages} image(s) are SVG data URI placeholders — no real assets used`,
    });
  }
}

const DEFAULT_TAILWIND_COLORS = [
  // Blue palette
  '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#1e3a8a',
  '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe', '#eff6ff',
  // Indigo palette
  '#6366f1', '#4f46e5', '#4338ca', '#3730a3', '#312e81',
  '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff', '#eef2ff',
];

/**
 * Error if default Tailwind blue/indigo palette colors appear as primary colors.
 */
function checkDefaultTailwindColors(html, errors) {
  const htmlLower = html.toLowerCase();

  for (const color of DEFAULT_TAILWIND_COLORS) {
    if (htmlLower.includes(color)) {
      errors.push({
        rule: 'default-tailwind-colors',
        message: `Default Tailwind color ${color} detected — use custom brand colors instead`,
      });
      // Report only the first match to avoid noisy output
      return;
    }
  }
}

/**
 * Verify required brand terms appear in the text content.
 */
function checkRequiredTerms(html, terms, warnings) {
  // Strip tags to get visible text content
  const textContent = html.replace(/<[^>]*>/g, ' ');

  for (const term of terms) {
    if (!term || typeof term !== 'string') continue;
    if (!textContent.includes(term)) {
      warnings.push({
        rule: 'required-terms',
        message: `Required brand term "${term}" not found in page content`,
      });
    }
  }
}

// ─── Typography metrics checks ───────────────────────────

/** Heading tag names for hierarchy detection */
const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

/**
 * Parse a CSS size value to pixels. Handles px, rem, em (assumes 16px base).
 * Returns null for unparseable values.
 */
function parseSizeToPx(value) {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  const num = parseFloat(trimmed);
  if (isNaN(num)) return null;
  if (trimmed.endsWith('rem') || trimmed.endsWith('em')) return num * 16;
  if (trimmed.endsWith('px') || /^\d+(\.\d+)?$/.test(trimmed)) return num;
  return null;
}

/**
 * Extract inline style property value from a style string.
 * Returns null if the property is not found.
 */
function getStyleProp(styleStr, prop) {
  const regex = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i');
  const m = styleStr.match(regex);
  return m ? m[1].trim() : null;
}

/**
 * Check typography metrics: font-size hierarchy, line-height ranges,
 * and letter-spacing on uppercase text.
 */
function checkTypographyMetrics(html, options, warnings) {
  // 1. Extract font-size values from elements with inline styles
  const headingSizes = [];
  const bodySizes = [];

  // Match elements with inline style containing font-size
  const elementRegex = /<([\w]+)([^>]*?)>/gi;
  let elMatch;
  while ((elMatch = elementRegex.exec(html)) !== null) {
    const tagName = elMatch[1].toLowerCase();
    const attrs = elMatch[2];

    const styleMatch = attrs.match(/style\s*=\s*["']([^"']*)["']/i);
    if (!styleMatch) continue;
    const style = styleMatch[1];

    const fontSize = getStyleProp(style, 'font-size');
    const fontSizePx = parseSizeToPx(fontSize);

    if (fontSizePx !== null) {
      if (HEADING_TAGS.has(tagName)) {
        headingSizes.push({ tag: tagName, size: fontSizePx });
      } else if (['p', 'span', 'li', 'td', 'dd', 'blockquote'].includes(tagName)) {
        bodySizes.push({ tag: tagName, size: fontSizePx });
      }
    }

    // 2. Line-height range checks
    const lineHeight = getStyleProp(style, 'line-height');
    if (lineHeight) {
      const lhNum = parseFloat(lineHeight);
      if (!isNaN(lhNum) && lhNum < 10) { // unitless or small em values (not px)
        if (HEADING_TAGS.has(tagName)) {
          if (lhNum < 1.0 || lhNum > 1.3) {
            warnings.push({
              rule: 'typography-line-height',
              message: `<${tagName}> has line-height ${lineHeight} — expected 1.0–1.3 for headings`,
            });
          }
        } else if (['p', 'li', 'span', 'blockquote'].includes(tagName)) {
          if (lhNum < 1.5 || lhNum > 2.0) {
            warnings.push({
              rule: 'typography-line-height',
              message: `<${tagName}> has line-height ${lineHeight} — expected 1.5–2.0 for body text`,
            });
          }
        }
      }
    }

    // 3. Letter-spacing on uppercase text
    const textTransform = getStyleProp(style, 'text-transform');
    if (textTransform && textTransform.toLowerCase() === 'uppercase') {
      const letterSpacing = getStyleProp(style, 'letter-spacing');
      if (!letterSpacing) {
        warnings.push({
          rule: 'typography-letter-spacing',
          message: `<${tagName}> uses text-transform: uppercase but has no letter-spacing — add tracking for readability`,
        });
      } else {
        const lsValue = parseFloat(letterSpacing);
        if (!isNaN(lsValue) && lsValue <= 0) {
          warnings.push({
            rule: 'typography-letter-spacing',
            message: `<${tagName}> uses uppercase text with letter-spacing ${letterSpacing} — should be > 0 for readability`,
          });
        }
      }
    }
  }

  // Also check <style> blocks for uppercase rules without letter-spacing
  const styleBlockRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let styleBlockMatch;
  while ((styleBlockMatch = styleBlockRegex.exec(html)) !== null) {
    const css = styleBlockMatch[1];
    // Find rules with text-transform: uppercase
    const ruleRegex = /([^{}]+)\{([^}]+)\}/g;
    let ruleMatch;
    while ((ruleMatch = ruleRegex.exec(css)) !== null) {
      const selector = ruleMatch[1].trim();
      const body = ruleMatch[2];
      if (/text-transform\s*:\s*uppercase/i.test(body)) {
        if (!/letter-spacing\s*:/i.test(body)) {
          warnings.push({
            rule: 'typography-letter-spacing',
            message: `CSS rule "${selector}" uses text-transform: uppercase but has no letter-spacing`,
          });
        }
      }
    }
  }

  // Font-size hierarchy check: heading sizes should be > body sizes
  if (headingSizes.length > 0 && bodySizes.length > 0) {
    const minHeadingSize = Math.min(...headingSizes.map(h => h.size));
    const maxBodySize = Math.max(...bodySizes.map(b => b.size));

    if (minHeadingSize <= maxBodySize) {
      const offender = headingSizes.find(h => h.size <= maxBodySize);
      warnings.push({
        rule: 'typography-hierarchy',
        message: `<${offender.tag}> font-size ${offender.size}px is not larger than body text (${maxBodySize}px) — headings should be visually distinct`,
      });
    }
  }
}

// ─── Spacing consistency checks ──────────────────────────

/**
 * Parse a padding shorthand value and return vertical padding (top + bottom) in px.
 * Handles: padding: Npx; padding: Npx Npx; padding: Npx Npx Npx Npx;
 */
function parseVerticalPadding(paddingStr) {
  if (!paddingStr) return null;
  const parts = paddingStr.trim().split(/\s+/);
  const values = parts.map(p => parseSizeToPx(p)).filter(v => v !== null);
  if (values.length === 0) return null;
  if (values.length === 1) return values[0]; // all sides equal — vertical = that value
  if (values.length === 2) return values[0]; // padding: vertical horizontal
  if (values.length === 3) return (values[0] + values[2]) / 2; // top right bottom — avg of top+bottom
  if (values.length >= 4) return (values[0] + values[2]) / 2; // top right bottom left — avg of top+bottom
  return null;
}

/**
 * Check section padding consistency and max-width containment.
 */
function checkSpacingConsistency(html, warnings) {
  // 1. Extract padding from <section> elements
  const sectionRegex = /<section([^>]*)>/gi;
  const sectionPaddings = [];
  let secMatch;

  while ((secMatch = sectionRegex.exec(html)) !== null) {
    const attrs = secMatch[1];
    const styleMatch = attrs.match(/style\s*=\s*["']([^"']*)["']/i);
    if (!styleMatch) continue;
    const style = styleMatch[1];

    // Check padding shorthand
    const padding = getStyleProp(style, 'padding');
    const vPad = parseVerticalPadding(padding);
    if (vPad !== null) {
      sectionPaddings.push(vPad);
      continue;
    }

    // Check padding-top / padding-bottom individually
    const pt = parseSizeToPx(getStyleProp(style, 'padding-top'));
    const pb = parseSizeToPx(getStyleProp(style, 'padding-bottom'));
    if (pt !== null || pb !== null) {
      sectionPaddings.push(((pt || 0) + (pb || 0)) / 2);
    }
  }

  // Warn if section paddings are wildly inconsistent
  if (sectionPaddings.length >= 3) {
    const sorted = [...sectionPaddings].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    // Allow a ratio of up to 3:1 between max and min before warning
    // (e.g., 48px vs 96px is 2:1 — that's fine; 20px vs 120px is 6:1 — that's not)
    if (min > 0 && max / min > 3) {
      warnings.push({
        rule: 'spacing-consistency',
        message: `Section vertical padding varies from ${min}px to ${max}px (${(max / min).toFixed(1)}:1 ratio) — consider a more consistent spacing rhythm`,
      });
    }
  }

  // 2. Max-width containment check
  // Look for max-width on content-wrapping elements (section-inner, container, wrapper classes, or direct section children)
  const hasMaxWidth =
    /max-width\s*:\s*\d/i.test(html) ||
    /max-w-\[?\d/i.test(html) ||            // Tailwind arbitrary max-w-[1080px]
    /\bmax-w-(xs|sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|screen-sm|screen-md|screen-lg|screen-xl|screen-2xl)\b/.test(html) ||
    /\bcontainer\b/.test(html);              // Tailwind container class

  if (!hasMaxWidth) {
    warnings.push({
      rule: 'spacing-max-width',
      message: 'No max-width constraint found — text may stretch across full viewport width on large screens, exceeding ~80 characters per line',
    });
  }
}

// ─── Color contrast checks ───────────────────────────────

/**
 * Parse a hex color (#RGB or #RRGGBB) to { r, g, b } (0-255).
 * Returns null for unparseable values.
 */
function parseHexColor(hex) {
  if (!hex || typeof hex !== 'string') return null;
  const h = hex.trim().replace(/^#/, '');
  if (h.length === 3) {
    return { r: parseInt(h[0] + h[0], 16), g: parseInt(h[1] + h[1], 16), b: parseInt(h[2] + h[2], 16) };
  }
  if (h.length === 6) {
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }
  return null;
}

/**
 * Parse rgb() or rgba() color to { r, g, b } (0-255).
 * Handles: rgb(255, 0, 0), rgba(255, 0, 0, 0.5), rgb(255 0 0), rgba(255 0 0 / 0.5)
 * Returns null for unparseable values.
 */
function parseRgbColor(value) {
  if (!value || typeof value !== 'string') return null;
  const m = value.trim().match(/^rgba?\(\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})(?:\s*[,/]\s*[\d.]+%?)?\s*\)$/i);
  if (!m) return null;
  const r = parseInt(m[1], 10);
  const g = parseInt(m[2], 10);
  const b = parseInt(m[3], 10);
  if (r > 255 || g > 255 || b > 255) return null;
  return { r, g, b };
}

/**
 * Parse any supported CSS color value to { r, g, b }.
 * Supports: #RGB, #RRGGBB, rgb(), rgba().
 */
function parseColorValue(value) {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.startsWith('#')) return parseHexColor(trimmed);
  if (/^rgba?\(/i.test(trimmed)) return parseRgbColor(trimmed);
  return null;
}

/**
 * WCAG relative luminance of a color { r, g, b } (0-255).
 */
function relativeLuminance({ r, g, b }) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * WCAG contrast ratio between two luminances. Returns a value >= 1.
 */
function contrastRatio(l1, l2) {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Determine if an element qualifies as "large text" per WCAG 2.1:
 * ≥ 18px (any weight) or ≥ 14px and bold (font-weight ≥ 700).
 */
function isLargeText(style, tagName) {
  const fontSize = getStyleProp(style, 'font-size');
  const fontSizePx = parseSizeToPx(fontSize);
  const fontWeight = getStyleProp(style, 'font-weight');

  // Headings h1-h3 default to large text when no explicit font-size
  const isHeadingTag = ['h1', 'h2', 'h3'].includes(tagName);

  const isBold = fontWeight && (
    parseInt(fontWeight, 10) >= 700 ||
    /^bold/i.test(fontWeight)
  );

  if (fontSizePx !== null) {
    if (fontSizePx >= 18) return true;
    if (fontSizePx >= 14 && isBold) return true;
    return false;
  }

  // No explicit font-size — headings h1-h3 are large by default
  return isHeadingTag;
}

/**
 * Check color contrast on elements with both color and background-color in inline styles.
 * Warns when the contrast ratio is below WCAG AA thresholds:
 * - 4.5:1 for normal text
 * - 3:1 for large text (≥ 18px or ≥ 14px bold)
 */
function checkColorContrast(html, warnings) {
  const elementRegex = /<([\w]+)([^>]*?)>/gi;
  let elMatch;

  while ((elMatch = elementRegex.exec(html)) !== null) {
    const tagName = elMatch[1].toLowerCase();
    const attrs = elMatch[2];

    const styleMatch = attrs.match(/style\s*=\s*["']([^"']*)["']/i);
    if (!styleMatch) continue;
    const style = styleMatch[1];

    const fgRaw = getStyleProp(style, 'color');
    const bgRaw = getStyleProp(style, 'background-color') || getStyleProp(style, 'background');

    if (!fgRaw || !bgRaw) continue;

    const fg = parseColorValue(fgRaw);
    const bg = parseColorValue(bgRaw);
    if (!fg || !bg) continue;

    const fgLum = relativeLuminance(fg);
    const bgLum = relativeLuminance(bg);
    const ratio = contrastRatio(fgLum, bgLum);

    const largeText = isLargeText(style, tagName);
    const threshold = largeText ? 3 : 4.5;

    if (ratio < threshold) {
      const req = largeText ? '3:1 (large text)' : '4.5:1';
      warnings.push({
        rule: 'color-contrast',
        message: `<${tagName}> has low contrast (${ratio.toFixed(1)}:1) between color ${fgRaw} and background ${bgRaw} — WCAG AA requires ${req}`,
      });
    }
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
