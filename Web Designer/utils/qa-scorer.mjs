/**
 * Automated visual QA scoring tool for Web Designer output.
 *
 * Produces a numerical quality score (1-10) across 7 weighted categories:
 *   Structure (15%), Brand Fidelity (25%), Content Quality (20%),
 *   Typography (15%), Asset Quality (10%), Spacing & Layout (10%),
 *   Accessibility (5%)
 *
 * Usage (programmatic):
 *   import { scoreOutput } from './utils/qa-scorer.mjs';
 *   const result = await scoreOutput('clients/test-client/output/index.html', {
 *     brandSpecPath: 'clients/test-client/brand/brand.md',
 *     brandAssetsPath: 'clients/test-client/brand/assets',
 *     requiredTerms: ['AccompliSHE'],
 *   });
 *
 * Usage (CLI):
 *   node utils/qa-scorer.mjs clients/test-client/output/index.html
 *   node utils/qa-scorer.mjs clients/test-client/output/index.html --brand clients/test-client/brand/brand.md
 */

import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateHTML } from './validate-html.mjs';

// ─── Category weights ────────────────────────────────────
const WEIGHTS = {
  structure:      0.15,
  brandFidelity:  0.25,
  contentQuality: 0.20,
  typography:     0.15,
  assetQuality:   0.10,
  spacing:        0.10,
  accessibility:  0.05,
};

// ─── Brand spec parser ───────────────────────────────────

/**
 * Parse a brand.md file into structured data for scoring.
 * Returns { colors, fonts, fontSpec, terms, donts }.
 */
export function parseBrandSpec(markdown) {
  const colors = {};
  const fonts = {};
  const fontSpec = {};
  const terms = [];
  const donts = [];

  const lines = markdown.split('\n');
  let currentSection = '';

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect section headers
    if (/^##\s+Colors/i.test(trimmed)) { currentSection = 'colors'; continue; }
    if (/^##\s+Typography/i.test(trimmed)) { currentSection = 'typography'; continue; }
    if (/^##\s+Key Brand Terms/i.test(trimmed)) { currentSection = 'terms'; continue; }
    if (/^##\s+Don'ts/i.test(trimmed)) { currentSection = 'donts'; continue; }
    if (/^##\s/.test(trimmed)) { currentSection = 'other'; continue; }

    if (currentSection === 'colors') {
      // Match lines like: "Primary (Duchess Burgundy): #8B1A3A"
      const colorMatch = trimmed.match(/^([^:]+?):\s*(#[0-9A-Fa-f]{3,8})/);
      if (colorMatch) {
        const rawLabel = colorMatch[1].trim().toLowerCase();
        const hex = colorMatch[2].trim();
        // Derive a clean role name
        let role = rawLabel;
        if (rawLabel.includes('primary')) role = 'primary';
        else if (rawLabel.includes('secondary')) role = 'secondary';
        else if (rawLabel.includes('gold')) role = 'gold';
        else if (rawLabel.includes('champagne')) role = 'champagne';
        else if (rawLabel.includes('blush')) role = 'blush';
        else if (rawLabel.includes('background') || rawLabel.includes('ivory')) role = 'background';
        else if (rawLabel.includes('text') || rawLabel.includes('charcoal')) role = 'text';
        else if (rawLabel.includes('white')) role = 'white';
        else if (rawLabel.includes('gray') || rawLabel.includes('grey')) role = 'midgray';
        else if (rawLabel.includes('black')) role = 'black';
        colors[role] = hex;
      }
    }

    if (currentSection === 'typography') {
      const headingMatch = trimmed.match(/^Heading Font:\s*(.+)/i);
      const bodyMatch = trimmed.match(/^Body Font:\s*(.+)/i);
      if (headingMatch) {
        fonts.heading = headingMatch[1].trim();
        fontSpec.heading = headingMatch[1].trim();
      }
      if (bodyMatch) {
        fonts.body = bodyMatch[1].trim();
        fontSpec.body = bodyMatch[1].trim();
      }
    }

    if (currentSection === 'terms') {
      // Lines like: "- AccompliSHE (capitalize SHE — her program name)"
      const termMatch = trimmed.match(/^-\s+(.+?)(?:\s*\(|$)/);
      if (termMatch) {
        // Extract the term before any parenthetical explanation
        let term = termMatch[1].trim();
        // Remove surrounding quotes if present
        term = term.replace(/^["'""]|["'""]$/g, '');
        if (term) terms.push(term);
      }
    }

    if (currentSection === 'donts') {
      if (trimmed.startsWith('-')) {
        donts.push(trimmed.replace(/^-\s*/, ''));
      }
    }
  }

  return { colors, fonts, fontSpec, terms, donts };
}

// ─── Individual scoring functions ────────────────────────

/**
 * Structure (15%): DOCTYPE, HTML structure, Tailwind CDN, content blocks
 */
function scoreStructure(html, validationResult) {
  const issues = [];
  let score = 10;

  const structureRules = ['doctype', 'structure', 'tailwind', 'content'];
  for (const err of validationResult.errors) {
    if (structureRules.includes(err.rule)) {
      score -= 2.5;
      issues.push({ category: 'structure', severity: 'error', description: err.message });
    }
  }

  // Check for meta viewport
  if (!/meta\s[^>]*name\s*=\s*["']viewport["']/i.test(html)) {
    score -= 1;
    issues.push({ category: 'structure', severity: 'warning', description: 'Missing <meta name="viewport"> for responsive design' });
  }

  // Check for lang attribute on <html>
  if (/<html(?:\s[^>]*)?>/.test(html) && !/<html\s[^>]*lang\s*=/i.test(html)) {
    score -= 0.5;
    issues.push({ category: 'structure', severity: 'warning', description: 'Missing lang attribute on <html> tag' });
  }

  // Check for <title> tag
  if (!/<title[^>]*>.+?<\/title>/is.test(html)) {
    score -= 0.5;
    issues.push({ category: 'structure', severity: 'warning', description: 'Missing or empty <title> tag' });
  }

  // Check for charset
  if (!/meta\s[^>]*charset/i.test(html)) {
    score -= 0.5;
    issues.push({ category: 'structure', severity: 'warning', description: 'Missing <meta charset> declaration' });
  }

  return { score: clamp(score), issues };
}

/**
 * Brand Fidelity (25%): Brand colors used, brand fonts loaded and applied, no default Tailwind palette
 */
function scoreBrandFidelity(html, validationResult, brandSpec) {
  const issues = [];
  let score = 10;

  if (!brandSpec) {
    // No brand spec available — can only check for default Tailwind colors
    const twErrors = validationResult.errors.filter(e => e.rule === 'default-tailwind-colors');
    if (twErrors.length > 0) {
      score -= 3;
      for (const err of twErrors) {
        issues.push({ category: 'brandFidelity', severity: 'error', description: err.message });
      }
    }
    return { score: clamp(score), issues };
  }

  const htmlLower = html.toLowerCase();

  // Check brand colors presence
  const colorEntries = Object.entries(brandSpec.colors);
  if (colorEntries.length > 0) {
    let colorsMissing = 0;
    const primaryColors = ['primary', 'secondary', 'gold', 'text', 'background'];

    for (const [role, hex] of colorEntries) {
      const hexLower = hex.toLowerCase();
      if (!htmlLower.includes(hexLower)) {
        const isPrimary = primaryColors.includes(role);
        const severity = isPrimary ? 'error' : 'warning';
        const penalty = isPrimary ? 1.5 : 0.5;
        score -= penalty;
        colorsMissing++;
        issues.push({ category: 'brandFidelity', severity, description: `Brand ${role} color ${hex} not found in HTML` });
      }
    }
  }

  // Check brand fonts loaded via Google Fonts
  const fontNames = Object.values(brandSpec.fontSpec);
  if (fontNames.length > 0) {
    const fontLinkRegex = /fonts\.googleapis\.com\/css2?\?[^"']*/gi;
    const fontLinks = html.match(fontLinkRegex) || [];

    if (fontLinks.length === 0) {
      score -= 3;
      issues.push({ category: 'brandFidelity', severity: 'error', description: `No Google Fonts link found — expected: ${fontNames.join(', ')}` });
    } else {
      const allFontText = fontLinks.join(' ');
      for (const font of fontNames) {
        const fontEncoded = font.replace(/\s+/g, '\\+');
        if (!new RegExp(fontEncoded, 'i').test(allFontText)) {
          score -= 1.5;
          issues.push({ category: 'brandFidelity', severity: 'error', description: `Brand font "${font}" not loaded via Google Fonts` });
        }
      }
    }

    // Check fonts are actually applied in CSS / Tailwind config
    for (const [role, font] of Object.entries(brandSpec.fontSpec)) {
      if (!htmlLower.includes(font.toLowerCase())) {
        score -= 1;
        issues.push({ category: 'brandFidelity', severity: 'warning', description: `Brand ${role} font "${font}" not applied in CSS/Tailwind config` });
      }
    }
  }

  // Check for default Tailwind palette colors (bad)
  const twErrors = validationResult.errors.filter(e => e.rule === 'default-tailwind-colors');
  if (twErrors.length > 0) {
    score -= 2;
    for (const err of twErrors) {
      issues.push({ category: 'brandFidelity', severity: 'error', description: err.message });
    }
  }

  return { score: clamp(score), issues };
}

/**
 * Content Quality (20%): No placeholder text, no reference copy contamination, required brand terms present
 */
function scoreContentQuality(html, validationResult, brandSpec, options) {
  const issues = [];
  let score = 10;

  // Check placeholder text warnings
  const placeholderWarnings = validationResult.warnings.filter(w => w.rule === 'placeholder');
  if (placeholderWarnings.length > 0) {
    score -= Math.min(placeholderWarnings.length * 1.5, 5);
    for (const w of placeholderWarnings) {
      issues.push({ category: 'contentQuality', severity: 'warning', description: w.message });
    }
  }

  // Check [COPY NEEDED: ...] markers
  const textContent = html.replace(/<[^>]*>/g, ' ');
  const copyNeeded = textContent.match(/\[COPY NEEDED[^\]]*\]/gi);
  if (copyNeeded) {
    score -= Math.min(copyNeeded.length * 2, 6);
    for (const m of copyNeeded) {
      issues.push({ category: 'contentQuality', severity: 'error', description: `Unfilled copy marker: ${m}` });
    }
  }

  // Check required brand terms
  const terms = options.requiredTerms || brandSpec?.terms || [];
  if (terms.length > 0) {
    let termsFound = 0;
    for (const term of terms) {
      if (textContent.includes(term)) {
        termsFound++;
      } else {
        score -= 1;
        issues.push({ category: 'contentQuality', severity: 'warning', description: `Required brand term "${term}" not found in page content` });
      }
    }
  }

  // Check for common reference copy contamination patterns
  const contaminationPatterns = [
    /example\.com/i,
    /your-?company/i,
    /company\s*name\s*here/i,
    /john\s+doe/i,
    /jane\s+doe/i,
    /acme\s+corp/i,
    /test\s+user/i,
  ];
  for (const pattern of contaminationPatterns) {
    if (pattern.test(textContent)) {
      score -= 1;
      issues.push({ category: 'contentQuality', severity: 'warning', description: `Possible reference contamination: "${textContent.match(pattern)?.[0]}"` });
    }
  }

  // Check text content density — a real page should have meaningful content
  const cleanText = textContent.replace(/\s+/g, ' ').trim();
  if (cleanText.length < 200) {
    score -= 2;
    issues.push({ category: 'contentQuality', severity: 'warning', description: `Very little text content (${cleanText.length} chars) — page may be incomplete` });
  }

  return { score: clamp(score), issues };
}

/**
 * Typography (15%): Font size hierarchy, line-height ranges, letter-spacing on uppercase
 */
function scoreTypography(html, brandSpec) {
  const issues = [];
  let score = 10;

  // Check that heading and body use DIFFERENT fonts
  if (brandSpec?.fontSpec?.heading && brandSpec?.fontSpec?.body) {
    const headingFont = brandSpec.fontSpec.heading.toLowerCase();
    const bodyFont = brandSpec.fontSpec.body.toLowerCase();
    if (headingFont === bodyFont) {
      score -= 2;
      issues.push({ category: 'typography', severity: 'warning', description: 'Heading and body fonts are identical — pair a display/serif with a clean sans' });
    }
  }

  // Check for font-size declarations showing size hierarchy
  const fontSizes = [];
  const sizeRegex = /font-size:\s*(\d+(?:\.\d+)?)\s*px/gi;
  let match;
  while ((match = sizeRegex.exec(html)) !== null) {
    fontSizes.push(parseFloat(match[1]));
  }

  // Also check Tailwind text-* classes
  const twSizes = html.match(/\btext-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)\b/g) || [];

  if (fontSizes.length === 0 && twSizes.length === 0) {
    score -= 2;
    issues.push({ category: 'typography', severity: 'warning', description: 'No font-size declarations found — typography hierarchy unclear' });
  } else {
    const uniqueSizes = [...new Set(fontSizes)].sort((a, b) => a - b);
    const uniqueTwSizes = [...new Set(twSizes)];
    const totalUnique = uniqueSizes.length + uniqueTwSizes.length;
    if (totalUnique < 3) {
      score -= 1;
      issues.push({ category: 'typography', severity: 'warning', description: `Only ${totalUnique} distinct font sizes — limited typographic hierarchy` });
    }
  }

  // Check for line-height on body text
  const lineHeightMatches = html.match(/line-height:\s*([0-9.]+)/g) || [];
  const leadingClasses = html.match(/\bleading-(?:none|tight|snug|normal|relaxed|loose|\d+)\b/g) || [];
  if (lineHeightMatches.length === 0 && leadingClasses.length === 0) {
    score -= 1;
    issues.push({ category: 'typography', severity: 'warning', description: 'No line-height declarations found — readability may suffer' });
  }

  // Check for letter-spacing on uppercase text (best practice for ALL CAPS)
  const hasUppercase = /text-transform:\s*uppercase/i.test(html) || /\buppercase\b/.test(html);
  const hasLetterSpacing = /letter-spacing:\s*\d/i.test(html) || /\btracking-/.test(html);
  if (hasUppercase && !hasLetterSpacing) {
    score -= 1;
    issues.push({ category: 'typography', severity: 'warning', description: 'Uppercase text found without letter-spacing — readability suffers without tracking' });
  }

  // Check for tight tracking on large headings (anti-generic guardrail)
  const hasLargeHeading = fontSizes.some(s => s >= 36) || twSizes.some(s => /[3-9]xl/.test(s));
  if (hasLargeHeading) {
    const tightTracking = /letter-spacing:\s*-/i.test(html) || /\btracking-tight(er)?\b/.test(html);
    if (!tightTracking) {
      score -= 0.5;
      issues.push({ category: 'typography', severity: 'info', description: 'Large headings without negative tracking — consider -0.03em for tighter display type' });
    }
  }

  return { score: clamp(score), issues };
}

/**
 * Asset Quality (10%): Real images used (not SVG placeholders), no broken image src
 */
function scoreAssetQuality(html, validationResult, brandAssetsPath) {
  const issues = [];
  let score = 10;

  // Collect all image sources
  const imgRegex = /<img\s[^>]*?src\s*=\s*["']([^"']*)["'][^>]*>/gi;
  let match;
  let totalImages = 0;
  let svgPlaceholders = 0;
  let placeHolderUrls = 0;
  let emptyOrBroken = 0;
  let realImages = 0;

  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1].trim();
    totalImages++;

    if (!src) {
      emptyOrBroken++;
      continue;
    }

    if (/^data:image\/svg\+xml/i.test(src)) {
      svgPlaceholders++;
    } else if (/placehold\.co|placeholder\.com|via\.placeholder\.com|picsum\.photos/i.test(src)) {
      placeHolderUrls++;
    } else {
      realImages++;
    }
  }

  if (totalImages === 0) {
    score -= 3;
    issues.push({ category: 'assetQuality', severity: 'warning', description: 'No images found — page may be missing visual content' });
  } else {
    if (emptyOrBroken > 0) {
      score -= emptyOrBroken * 2;
      issues.push({ category: 'assetQuality', severity: 'error', description: `${emptyOrBroken} image(s) with empty/broken src` });
    }

    if (svgPlaceholders > 0 && brandAssetsPath) {
      const penalty = svgPlaceholders === totalImages ? 4 : Math.min(svgPlaceholders * 1.5, 3);
      score -= penalty;
      issues.push({ category: 'assetQuality', severity: svgPlaceholders === totalImages ? 'error' : 'warning', description: `${svgPlaceholders}/${totalImages} images are SVG data URI placeholders` });
    }

    if (placeHolderUrls > 0) {
      // Placeholder URLs are acceptable fallback but not ideal when real assets exist
      if (brandAssetsPath) {
        score -= Math.min(placeHolderUrls * 0.5, 2);
        issues.push({ category: 'assetQuality', severity: 'info', description: `${placeHolderUrls} placeholder URL(s) used — check if real assets are available` });
      }
    }

    // Check for alt attributes on images
    const imgsWithoutAlt = (html.match(/<img\s(?![^>]*\balt\s*=)[^>]*>/gi) || []).length;
    if (imgsWithoutAlt > 0) {
      score -= Math.min(imgsWithoutAlt * 0.5, 2);
      issues.push({ category: 'assetQuality', severity: 'warning', description: `${imgsWithoutAlt} image(s) missing alt attribute` });
    }
  }

  return { score: clamp(score), issues };
}

/**
 * Spacing & Layout (10%): Section padding consistency, max-width containment
 */
function scoreSpacing(html) {
  const issues = [];
  let score = 10;

  // Check for max-width containment (brand spec says 900-1100px)
  const hasMaxWidth = /max-width:\s*\d/i.test(html)
    || /\bmax-w-(screen-xl|screen-lg|screen-md|7xl|6xl|5xl|4xl|3xl|2xl|xl|lg|md)\b/.test(html)
    || /\bcontainer\b/.test(html);

  if (!hasMaxWidth) {
    score -= 2;
    issues.push({ category: 'spacing', severity: 'warning', description: 'No max-width or container class found — content may stretch too wide' });
  }

  // Check section count — a real page should have multiple sections
  const sectionCount = (html.match(/<section[\s>]/gi) || []).length;
  if (sectionCount < 2) {
    score -= 1;
    issues.push({ category: 'spacing', severity: 'warning', description: `Only ${sectionCount} <section> tag(s) — expected multiple sections for a landing page` });
  }

  // Check for section padding — should have consistent vertical spacing
  const paddingYPatterns = [
    /\bpy-\d+\b/g,
    /\bpt-\d+\b/g,
    /\bpb-\d+\b/g,
    /padding(?:-top|-bottom)?:\s*\d+/gi,
  ];
  let paddingDeclarations = 0;
  for (const pat of paddingYPatterns) {
    paddingDeclarations += (html.match(pat) || []).length;
  }

  if (sectionCount >= 2 && paddingDeclarations < sectionCount) {
    score -= 1;
    issues.push({ category: 'spacing', severity: 'warning', description: 'Some sections may lack vertical padding — ensure consistent spacing' });
  }

  // Check for responsive classes (mobile-first)
  const responsiveBreakpoints = /\b(sm|md|lg|xl|2xl):/g;
  const responsiveCount = (html.match(responsiveBreakpoints) || []).length;
  if (responsiveCount < 5) {
    score -= 1.5;
    issues.push({ category: 'spacing', severity: 'warning', description: `Only ${responsiveCount} responsive breakpoint classes — page may not be properly responsive` });
  }

  // Check for grid or flex layout usage
  const hasGrid = /\bgrid\b/.test(html) || /display:\s*grid/i.test(html);
  const hasFlex = /\bflex\b/.test(html) || /display:\s*flex/i.test(html);
  if (!hasGrid && !hasFlex) {
    score -= 1;
    issues.push({ category: 'spacing', severity: 'warning', description: 'No grid or flex layout detected — layout may be fragile' });
  }

  return { score: clamp(score), issues };
}

/**
 * Accessibility (5%): Color contrast ratios, alt attributes, semantic HTML
 */
function scoreAccessibility(html) {
  const issues = [];
  let score = 10;

  // Check for semantic HTML elements
  const semanticElements = ['<header', '<nav', '<main', '<footer', '<section', '<article', '<aside'];
  let semanticCount = 0;
  for (const el of semanticElements) {
    if (html.toLowerCase().includes(el)) semanticCount++;
  }
  if (semanticCount < 3) {
    score -= 2;
    issues.push({ category: 'accessibility', severity: 'warning', description: `Only ${semanticCount} semantic HTML elements found — use header, nav, main, footer, section, article` });
  }

  // Check for focus-visible styles
  const hasFocusStyles = /focus-visible/i.test(html) || /focus:/i.test(html) || /:focus\b/i.test(html);
  if (!hasFocusStyles) {
    score -= 2;
    issues.push({ category: 'accessibility', severity: 'warning', description: 'No focus-visible styles detected — keyboard navigation will be invisible' });
  }

  // Check for aria attributes or roles
  const hasAria = /\baria-/i.test(html) || /\brole\s*=/i.test(html);
  if (!hasAria) {
    score -= 1;
    issues.push({ category: 'accessibility', severity: 'info', description: 'No ARIA attributes found — consider adding for complex interactive elements' });
  }

  // Check color contrast for text on brand backgrounds
  // We do a simplified check: look for white text on light backgrounds
  const lightOnLight = /(?:color:\s*#(?:fff|ffffff|faf5ee|f5e6d0))[^}]*(?:background(?:-color)?:\s*#(?:fff|ffffff|faf5ee|f5e6d0))/i;
  const lightOnLight2 = /(?:background(?:-color)?:\s*#(?:fff|ffffff|faf5ee|f5e6d0))[^}]*(?:color:\s*#(?:fff|ffffff|faf5ee|f5e6d0))/i;
  if (lightOnLight.test(html) || lightOnLight2.test(html)) {
    score -= 3;
    issues.push({ category: 'accessibility', severity: 'error', description: 'Light text on light background detected — fails WCAG AA contrast' });
  }

  // Check for skip-to-content link (nice to have)
  const hasSkipLink = /skip.*content/i.test(html) || /#main-content/i.test(html);
  if (!hasSkipLink) {
    score -= 0.5;
    issues.push({ category: 'accessibility', severity: 'info', description: 'No skip-to-content link found' });
  }

  // Check form labels
  const formInputs = (html.match(/<input\s/gi) || []).length;
  const formLabels = (html.match(/<label[\s>]/gi) || []).length;
  const ariaLabels = (html.match(/aria-label\s*=/gi) || []).length;
  if (formInputs > 0 && (formLabels + ariaLabels) < formInputs) {
    score -= 1;
    issues.push({ category: 'accessibility', severity: 'warning', description: `${formInputs} form input(s) but only ${formLabels + ariaLabels} label(s)/aria-label(s)` });
  }

  return { score: clamp(score), issues };
}

// ─── Main scoring function ───────────────────────────────

/**
 * Score an HTML output file across all quality categories.
 *
 * @param {string} htmlPath - Path to the HTML file
 * @param {object} [options]
 * @param {string} [options.brandSpecPath] - Path to brand.md
 * @param {string} [options.brandAssetsPath] - Path to brand assets directory
 * @param {string[]} [options.requiredTerms] - Brand terms that must appear
 * @returns {Promise<{score: number, breakdown: object, issues: Array}>}
 */
export async function scoreOutput(htmlPath, options = {}) {
  const resolvedPath = resolve(htmlPath);
  const html = await readFile(resolvedPath, 'utf-8');

  // Parse brand spec if provided
  let brandSpec = null;
  if (options.brandSpecPath) {
    const brandMd = await readFile(resolve(options.brandSpecPath), 'utf-8');
    brandSpec = parseBrandSpec(brandMd);
  }

  // Run validate-html for its checks (we reuse its results)
  const validationOpts = {};
  if (brandSpec) {
    validationOpts.brandColors = brandSpec.colors;
    validationOpts.brandFontSpec = brandSpec.fontSpec;
    validationOpts.brandFonts = Object.values(brandSpec.fontSpec);
    if (brandSpec.terms.length > 0) validationOpts.requiredTerms = brandSpec.terms;
  }
  if (options.brandAssetsPath) {
    validationOpts.brandAssetsPath = options.brandAssetsPath;
  }
  if (options.requiredTerms) {
    validationOpts.requiredTerms = options.requiredTerms;
  }

  const validationResult = validateHTML(html, validationOpts);

  // Score each category
  const structureResult = scoreStructure(html, validationResult);
  const brandResult = scoreBrandFidelity(html, validationResult, brandSpec);
  const contentResult = scoreContentQuality(html, validationResult, brandSpec, options);
  const typographyResult = scoreTypography(html, brandSpec);
  const assetResult = scoreAssetQuality(html, validationResult, options.brandAssetsPath);
  const spacingResult = scoreSpacing(html);
  const accessibilityResult = scoreAccessibility(html);

  const breakdown = {
    structure:      structureResult.score,
    brandFidelity:  brandResult.score,
    contentQuality: contentResult.score,
    typography:     typographyResult.score,
    assetQuality:   assetResult.score,
    spacing:        spacingResult.score,
    accessibility:  accessibilityResult.score,
  };

  // Weighted average
  const weightedSum =
    breakdown.structure      * WEIGHTS.structure +
    breakdown.brandFidelity  * WEIGHTS.brandFidelity +
    breakdown.contentQuality * WEIGHTS.contentQuality +
    breakdown.typography     * WEIGHTS.typography +
    breakdown.assetQuality   * WEIGHTS.assetQuality +
    breakdown.spacing        * WEIGHTS.spacing +
    breakdown.accessibility  * WEIGHTS.accessibility;

  const finalScore = round1(weightedSum);

  // Collect all issues
  const allIssues = [
    ...structureResult.issues,
    ...brandResult.issues,
    ...contentResult.issues,
    ...typographyResult.issues,
    ...assetResult.issues,
    ...spacingResult.issues,
    ...accessibilityResult.issues,
  ];

  return { score: finalScore, breakdown, issues: allIssues };
}

// ─── Helpers ─────────────────────────────────────────────

function clamp(value, min = 0, max = 10) {
  return Math.max(min, Math.min(max, value));
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

// ─── CLI ─────────────────────────────────────────────────

const isMainModule = (() => {
  try {
    if (!process.argv[1]) return false;
    return resolve(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();

if (isMainModule) {
  const args = process.argv.slice(2);
  const htmlPath = args.find(a => !a.startsWith('--'));

  if (!htmlPath) {
    console.error('Usage: node utils/qa-scorer.mjs <html-path> [--brand <brand.md>] [--assets <assets-dir>] [--terms term1,term2]');
    process.exit(1);
  }

  const opts = {};

  const brandIdx = args.indexOf('--brand');
  if (brandIdx !== -1 && args[brandIdx + 1]) {
    opts.brandSpecPath = args[brandIdx + 1];
  } else {
    // Auto-detect brand spec from sibling directories
    const htmlDir = dirname(resolve(htmlPath));
    const possibleBrand = resolve(htmlDir, '..', 'brand', 'brand.md');
    try {
      await readFile(possibleBrand, 'utf-8');
      opts.brandSpecPath = possibleBrand;
    } catch { /* no brand spec found */ }
  }

  const assetsIdx = args.indexOf('--assets');
  if (assetsIdx !== -1 && args[assetsIdx + 1]) {
    opts.brandAssetsPath = args[assetsIdx + 1];
  } else if (opts.brandSpecPath) {
    const brandDir = dirname(resolve(opts.brandSpecPath));
    opts.brandAssetsPath = resolve(brandDir, 'assets');
  }

  const termsIdx = args.indexOf('--terms');
  if (termsIdx !== -1 && args[termsIdx + 1]) {
    opts.requiredTerms = args[termsIdx + 1].split(',').map(t => t.trim());
  }

  try {
    const result = await scoreOutput(htmlPath, opts);

    console.log('\n╔══════════════════════════════════════════╗');
    console.log(`║  QA SCORE: ${result.score.toFixed(1)}/10${result.score >= 9 ? ' ✓ PASSING' : ' ✗ NEEDS WORK'}  `);
    console.log('╚══════════════════════════════════════════╝\n');

    console.log('Category Breakdown:');
    const labels = {
      structure:      'Structure      (15%)',
      brandFidelity:  'Brand Fidelity (25%)',
      contentQuality: 'Content Quality(20%)',
      typography:     'Typography     (15%)',
      assetQuality:   'Asset Quality  (10%)',
      spacing:        'Spacing/Layout (10%)',
      accessibility:  'Accessibility  ( 5%)',
    };

    for (const [key, label] of Object.entries(labels)) {
      const val = result.breakdown[key];
      const bar = '█'.repeat(Math.round(val)) + '░'.repeat(10 - Math.round(val));
      console.log(`  ${label}: ${bar} ${val.toFixed(1)}`);
    }

    if (result.issues.length > 0) {
      console.log(`\nIssues (${result.issues.length}):`);
      const byCategory = {};
      for (const issue of result.issues) {
        if (!byCategory[issue.category]) byCategory[issue.category] = [];
        byCategory[issue.category].push(issue);
      }

      for (const [cat, catIssues] of Object.entries(byCategory)) {
        console.log(`\n  [${cat}]`);
        for (const issue of catIssues) {
          const icon = issue.severity === 'error' ? '✗' : issue.severity === 'warning' ? '⚠' : 'ℹ';
          console.log(`    ${icon} ${issue.description}`);
        }
      }
    }

    console.log('');
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}
