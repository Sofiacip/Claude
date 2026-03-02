/**
 * Self-healing wrapper for page generation pipeline.
 *
 * Detects common failures in generated HTML and either auto-fixes them
 * or produces a targeted prompt for re-generation via Claude Code CLI.
 *
 * Usage:
 *   import { selfHeal } from './utils/self-heal.mjs';
 *   const result = await selfHeal(htmlPath, brandSpec, validationErrors);
 *   // result: { healed: boolean, fixes: [...], prompt: string }
 */

import fs from 'fs';
import path from 'path';
import { createContext } from './logger.mjs';

// ─── Structured Logger ───────────────────────────────────

function log(level, action, detail) {
  const entry = {
    ts: new Date().toISOString(),
    module: 'self-heal',
    level,
    action,
    ...(detail != null ? { detail } : {}),
  };
  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

// ─── Healing Strategies ──────────────────────────────────

/**
 * Auto-fix: inject Tailwind CDN if missing.
 * @returns {{ type: string, description: string, patched: string } | null}
 */
export function healMissingTailwind(html) {
  if (html.includes('cdn.tailwindcss.com')) return null;

  const tag = '<script src="https://cdn.tailwindcss.com"></script>';
  let patched;

  if (html.includes('</head>')) {
    patched = html.replace('</head>', `  ${tag}\n</head>`);
  } else if (html.includes('<body')) {
    patched = html.replace('<body', `${tag}\n<body`);
  } else {
    patched = `${tag}\n${html}`;
  }

  return {
    type: 'missing-tailwind',
    description: 'Injected Tailwind CSS CDN script tag',
    patched,
  };
}

/**
 * Auto-fix: replace incorrect font-family declarations to match brand spec.
 * @param {string} html
 * @param {{ headingFont?: string, bodyFont?: string }} brandSpec
 * @returns {{ type: string, description: string, patched: string, replacements: string[] } | null}
 */
export function healWrongFonts(html, brandSpec) {
  if (!brandSpec) return null;
  const { headingFont, bodyFont } = brandSpec;
  if (!headingFont && !bodyFont) return null;

  let patched = html;
  const replacements = [];

  // Common generic fonts that should be replaced
  const genericFonts = [
    'Arial', 'Helvetica', 'Verdana', 'Georgia', 'Times New Roman',
    'Times', 'Courier New', 'Courier', 'Trebuchet MS', 'Impact',
    'Comic Sans MS', 'Palatino', 'Garamond', 'Bookman', 'Tahoma',
    'system-ui', 'Roboto', 'Open Sans', 'Lato', 'Poppins', 'Inter',
    'Playfair Display', 'Merriweather', 'Raleway', 'Oswald', 'Nunito',
  ];

  // Filter out brand fonts from generic list to avoid replacing the correct ones
  const headingLower = headingFont?.toLowerCase() || '';
  const bodyLower = bodyFont?.toLowerCase() || '';
  const nonBrandFonts = genericFonts.filter(f => {
    const fLower = f.toLowerCase();
    return fLower !== headingLower && fLower !== bodyLower
      && !headingLower.includes(fLower) && !bodyLower.includes(fLower);
  });

  // Match font-family in inline styles
  const fontFamilyRe = /font-family:\s*(['"]?)([^;'"]+)\1/gi;
  let match;
  const seen = new Set();

  while ((match = fontFamilyRe.exec(html)) !== null) {
    const fullMatch = match[0];
    const fontValue = match[2].trim();

    // Check if font value contains a non-brand font as primary
    const primaryFont = fontValue.split(',')[0].trim().replace(/['"]/g, '');
    const primaryLower = primaryFont.toLowerCase();

    if (nonBrandFonts.some(f => f.toLowerCase() === primaryLower) && !seen.has(fullMatch)) {
      seen.add(fullMatch);

      // Determine if this is likely a heading or body context
      const idx = match.index;
      const surroundingStart = Math.max(0, idx - 200);
      const surrounding = html.substring(surroundingStart, idx).toLowerCase();
      const isHeading = /<h[1-6][\s>]|class="[^"]*(?:heading|display)[^"]*"/.test(surrounding);

      const replacement = isHeading && headingFont
        ? `font-family: '${headingFont}', serif`
        : bodyFont
          ? `font-family: '${bodyFont}', sans-serif`
          : null;

      if (replacement) {
        patched = patched.split(fullMatch).join(replacement);
        replacements.push(`${primaryFont} → ${isHeading && headingFont ? headingFont : bodyFont}`);
      }
    }
  }

  // Also fix Tailwind config font declarations if present
  if (headingFont) {
    const displayRe = /fontFamily:\s*\{[^}]*display:\s*\[([^\]]+)\]/;
    const displayMatch = patched.match(displayRe);
    if (displayMatch && !displayMatch[1].includes(headingFont)) {
      const newDisplay = `['"${headingFont}"', 'serif']`;
      patched = patched.replace(displayMatch[0],
        displayMatch[0].replace(displayMatch[1], newDisplay));
      replacements.push(`Tailwind display font → ${headingFont}`);
    }
  }

  if (bodyFont) {
    const sansRe = /fontFamily:\s*\{[^}]*sans:\s*\[([^\]]+)\]/;
    const sansMatch = patched.match(sansRe);
    if (sansMatch && !sansMatch[1].includes(bodyFont)) {
      const newSans = `['${bodyFont}', 'sans-serif']`;
      patched = patched.replace(sansMatch[0],
        sansMatch[0].replace(sansMatch[1], newSans));
      replacements.push(`Tailwind sans font → ${bodyFont}`);
    }
  }

  if (replacements.length === 0) return null;

  return {
    type: 'wrong-fonts',
    description: `Replaced ${replacements.length} incorrect font declaration(s)`,
    patched,
    replacements,
  };
}

/**
 * Auto-fix: resolve broken image references by checking brand/assets/.
 * @param {string} html
 * @param {string} htmlPath - absolute path to the HTML file
 * @param {{ warn?: Function }} [logger] - optional logger for unresolved image warnings
 * @returns {{ type: string, description: string, patched: string, fixes: Array<{from: string, to: string}>, unresolved: string[] } | null}
 */
export function healBrokenImages(html, htmlPath, logger) {
  const outputDir = path.dirname(htmlPath);
  // Walk up from output/ to the client dir, then into brand/assets/
  const clientDir = path.resolve(outputDir, '..');
  const brandAssetsDir = path.join(clientDir, 'brand', 'assets');

  if (!fs.existsSync(brandAssetsDir)) return null;

  // Collect all available asset files recursively
  const availableAssets = collectFiles(brandAssetsDir);

  // Find all image references in the HTML
  const imgSrcRe = /(?:src|href)=["']([^"']*(?:\.(?:png|jpg|jpeg|gif|svg|webp))[^"']*)["']/gi;
  let patched = html;
  const fixes = [];
  const unresolved = [];
  let match;

  while ((match = imgSrcRe.exec(html)) !== null) {
    const src = match[1];

    // Skip external URLs and data URIs
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) continue;

    // Check if the referenced file exists relative to output dir
    const resolvedPath = path.resolve(outputDir, src);
    if (fs.existsSync(resolvedPath)) continue;

    // Try to find a matching file in brand/assets/
    const filename = path.basename(src);
    const matchingAsset = findBestMatch(filename, availableAssets, brandAssetsDir);

    if (matchingAsset) {
      // Compute relative path from output dir to the asset
      const relativePath = path.relative(outputDir, matchingAsset);
      patched = patched.split(src).join(relativePath);
      fixes.push({ from: src, to: relativePath });
    } else {
      unresolved.push(src);
      if (logger?.warn) {
        logger.warn('Image resolution failed', {
          searchedFilename: filename,
          originalSrc: src,
          directoriesScanned: [brandAssetsDir],
          filesFound: availableAssets.length,
        });
      } else {
        log('warn', 'image-unresolved', {
          searchedFilename: filename,
          originalSrc: src,
          directoriesScanned: [brandAssetsDir],
          filesFound: availableAssets.length,
        });
      }
    }
  }

  if (fixes.length === 0 && unresolved.length === 0) return null;

  return {
    type: 'broken-images',
    description: fixes.length > 0
      ? `Fixed ${fixes.length} broken image reference(s)${unresolved.length > 0 ? `, ${unresolved.length} unresolved` : ''}`
      : `${unresolved.length} broken image(s) could not be resolved`,
    patched,
    fixes,
    unresolved,
  };
}

/**
 * Detect placeholder text that needs re-generation.
 * @param {string} html
 * @returns {{ type: string, description: string, locations: Array<{pattern: string, line: number, context: string}> } | null}
 */
export function detectPlaceholderText(html) {
  const placeholderPatterns = [
    { re: /lorem ipsum/gi, name: 'Lorem ipsum' },
    { re: /\[(?:your |placeholder|insert |add |client |company )[^\]]*\]/gi, name: 'Bracket placeholder' },
    { re: /\{\{[^}]+\}\}/g, name: 'Template variable' },
    { re: /XXX+|TODO|FIXME|PLACEHOLDER/g, name: 'Marker text' },
    { re: /dolor sit amet|consectetur adipiscing|sed do eiusmod|tempor incididunt/gi, name: 'Lorem ipsum fragment' },
  ];

  const locations = [];
  const lines = html.split('\n');

  for (const { re, name } of placeholderPatterns) {
    let match;
    while ((match = re.exec(html)) !== null) {
      // Find line number
      const beforeMatch = html.substring(0, match.index);
      const lineNum = beforeMatch.split('\n').length;
      const lineContent = lines[lineNum - 1]?.trim() || '';

      // Skip matches inside <script> or <style> tags
      const tagContext = getContainingTag(html, match.index);
      if (tagContext === 'script' || tagContext === 'style') continue;

      locations.push({
        pattern: name,
        matched: match[0].substring(0, 60),
        line: lineNum,
        context: lineContent.substring(0, 100),
      });
    }
  }

  if (locations.length === 0) return null;

  return {
    type: 'placeholder-text',
    description: `Found ${locations.length} placeholder text occurrence(s) needing re-generation`,
    locations,
  };
}

/**
 * Detect missing sections from validation errors and build a targeted prompt.
 * @param {Array<{type: string, message: string, section?: string}>} validationErrors
 * @returns {{ type: string, description: string, sections: string[] } | null}
 */
export function detectMissingSections(validationErrors) {
  if (!validationErrors?.length) return null;

  const missingSections = validationErrors
    .filter(e => e.type === 'missing-section')
    .map(e => e.section || e.message);

  if (missingSections.length === 0) return null;

  return {
    type: 'missing-sections',
    description: `${missingSections.length} required section(s) missing from the page`,
    sections: missingSections,
  };
}

// ─── Brand Color Enforcement ─────────────────────────────

/**
 * Auto-fix: ensure brand colors are present in Tailwind config and body background.
 * If the primary brand color doesn't appear in inline styles at all, flag for re-generation.
 *
 * @param {string} html
 * @param {{ colors?: Record<string, string> }} brandSpec
 * @returns {{ type: string, description: string, patched: string, injectedColors: string[], bodyBgFixed: boolean, missingPrimary: boolean } | null}
 */
export function healBrandColors(html, brandSpec) {
  if (!brandSpec?.colors || Object.keys(brandSpec.colors).length === 0) return null;

  let patched = html;
  const injectedColors = [];
  let bodyBgFixed = false;
  let missingPrimary = false;

  // Determine primary color (first entry or explicit "primary" key)
  const primaryKey = brandSpec.colors.primary ? 'primary' : Object.keys(brandSpec.colors)[0];
  const primaryColor = brandSpec.colors[primaryKey];

  // Determine background color — look for ivory, background, bg, cream, or last light color
  const bgKey = findBgColorKey(brandSpec.colors);
  const bgColor = bgKey ? brandSpec.colors[bgKey] : null;

  // ── 0. Pre-check: does primary brand color appear in inline styles / body? ──
  // Must check BEFORE injecting colors into Tailwind config
  if (primaryColor) {
    const hexNormalized = primaryColor.toLowerCase();
    // Check the original HTML (not patched) for usage in inline styles or CSS rules
    // Exclude script blocks (Tailwind config) — we only care about actual visual usage
    const htmlWithoutScripts = html.replace(/<script[\s>][\s\S]*?<\/script>/gi, '');
    if (!htmlWithoutScripts.toLowerCase().includes(hexNormalized)) {
      missingPrimary = true;
    }
  }

  // ── 1. Inject missing brand colors into Tailwind config ──
  const twConfigRe = /tailwind\.config\s*=\s*\{[\s\S]*?\n\s*\}\s*(?=\n|<\/script>)/;
  const twConfigMatch = patched.match(twConfigRe);

  if (twConfigMatch) {
    // Check which brand colors are missing from the config
    const configBlock = twConfigMatch[0];
    for (const [name, hex] of Object.entries(brandSpec.colors)) {
      if (!configBlock.includes(hex)) {
        injectedColors.push(`${name}: ${hex}`);
      }
    }

    if (injectedColors.length > 0) {
      // Find the colors extend block and inject missing colors
      const colorsBlockRe = /colors:\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/;
      const colorsMatch = configBlock.match(colorsBlockRe);

      if (colorsMatch) {
        // Build new color entries
        const newEntries = [];
        for (const [name, hex] of Object.entries(brandSpec.colors)) {
          if (!colorsMatch[0].includes(hex)) {
            const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '-');
            newEntries.push(`              '${safeName}': '${hex}'`);
          }
        }

        if (newEntries.length > 0) {
          // Check if there's a nested brand object
          const hasBrandObj = /brand:\s*\{/.test(colorsMatch[0]);
          if (hasBrandObj) {
            // Inject into existing brand object
            const brandCloseRe = /(brand:\s*\{[^}]*)(})/;
            const brandMatch = configBlock.match(brandCloseRe);
            if (brandMatch) {
              const injected = brandMatch[1] + ',\n' + newEntries.join(',\n') + '\n            ' + brandMatch[2];
              const newConfig = configBlock.replace(brandMatch[0], injected);
              patched = patched.replace(configBlock, newConfig);
            }
          } else {
            // Add a brand colors block
            const brandBlock = `brand: {\n${newEntries.join(',\n')}\n            }`;
            const colorsClose = colorsMatch[0];
            const injected = colorsClose.replace(/\}$/, `,\n            ${brandBlock}\n          }`);
            const newConfig = configBlock.replace(colorsClose, injected);
            patched = patched.replace(configBlock, newConfig);
          }
        }
      }
    }
  } else if (patched.includes('cdn.tailwindcss.com')) {
    // Tailwind CDN present but no config — inject a config with brand colors
    const colorEntries = Object.entries(brandSpec.colors)
      .map(([name, hex]) => {
        const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '-');
        return `              '${safeName}': '${hex}'`;
      })
      .join(',\n');

    const configScript = `<script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            brand: {
${colorEntries}
            }
          }
        }
      }
    }
  </script>`;

    // Insert after Tailwind CDN script tag
    patched = patched.replace(
      /<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>/,
      `<script src="https://cdn.tailwindcss.com"></script>\n  ${configScript}`
    );

    for (const [name, hex] of Object.entries(brandSpec.colors)) {
      injectedColors.push(`${name}: ${hex}`);
    }
  }

  // ── 2. Fix body background if it's white or generic gray ──
  if (bgColor) {
    const bodyStyleRe = /(body\s*\{[^}]*background\s*:\s*)(#(?:fff(?:fff)?|ffffff|f5f5f5|fafafa|e5e5e5|eee(?:eee)?|white)\b)/i;
    const bodyMatch = patched.match(bodyStyleRe);
    if (bodyMatch) {
      patched = patched.replace(bodyStyleRe, `$1${bgColor}`);
      bodyBgFixed = true;
    }

    // Also check for bg-white or bg-gray-* on <body> tag
    const bodyTagRe = /(<body[^>]*class="[^"]*)\b(bg-white|bg-gray-\d{2,3})\b/;
    const bodyTagMatch = patched.match(bodyTagRe);
    if (bodyTagMatch) {
      const bgClass = bgKey ? `bg-brand-${bgKey.replace(/[^a-zA-Z0-9_-]/g, '-')}` : `bg-[${bgColor}]`;
      patched = patched.replace(bodyTagRe, `$1${bgClass}`);
      bodyBgFixed = true;
    }
  }

  // If nothing changed and no issues found, return null
  if (injectedColors.length === 0 && !bodyBgFixed && !missingPrimary) return null;

  const descParts = [];
  if (injectedColors.length > 0) descParts.push(`injected ${injectedColors.length} brand color(s) into Tailwind config`);
  if (bodyBgFixed) descParts.push('fixed body background to brand color');
  if (missingPrimary) descParts.push('primary brand color missing from page styles (needs re-generation)');

  return {
    type: 'brand-colors',
    description: descParts.join('; '),
    patched,
    injectedColors,
    bodyBgFixed,
    missingPrimary,
  };
}

/**
 * Find the most appropriate background color key from a colors object.
 * Looks for keys like 'ivory', 'background', 'bg', 'cream', or picks the lightest color.
 */
function findBgColorKey(colors) {
  const bgKeywords = ['ivory', 'background', 'bg', 'cream', 'base', 'light', 'surface'];
  for (const keyword of bgKeywords) {
    for (const key of Object.keys(colors)) {
      if (key.toLowerCase().includes(keyword)) return key;
    }
  }
  return null;
}

// ─── Placeholder Image Replacement ──────────────────────

/**
 * Auto-fix: replace SVG data URI placeholder images with real brand asset files.
 *
 * Scans all <img> tags for src attributes containing data:image/svg+xml data URIs,
 * then attempts to match them to real photos/logos in the brand assets folder.
 *
 * @param {string} html
 * @param {string} brandAssetsPath - Absolute path to brand/assets/ directory
 * @returns {{ type: string, description: string, patched: string, replacements: Array<{from: string, to: string, reason: string}> } | null}
 */
export function healPlaceholderImages(html, brandAssetsPath) {
  if (!brandAssetsPath || !fs.existsSync(brandAssetsPath)) return null;

  // Collect available real assets by category
  const photosDir = path.join(brandAssetsPath, 'photos');
  const logosDir = path.join(brandAssetsPath, 'logos');

  const photos = fs.existsSync(photosDir) ? collectFiles(photosDir) : [];
  const logos = fs.existsSync(logosDir) ? collectFiles(logosDir) : [];

  if (photos.length === 0 && logos.length === 0) return null;

  // Find all <img> tags with SVG data URI src
  const imgDataUriRe = /<img\s[^>]*src=["'](data:image\/svg\+xml[^"']*?)["'][^>]*>/gi;
  let patched = html;
  const replacements = [];
  const matches = [];

  let match;
  while ((match = imgDataUriRe.exec(html)) !== null) {
    matches.push({
      fullTag: match[0],
      dataUri: match[1],
      index: match.index,
    });
  }

  if (matches.length === 0) return null;

  // Track which assets have been assigned to avoid duplicates
  const assignedAssets = new Set();
  let photoIndex = 0;
  let logoIndex = 0;

  for (const m of matches) {
    const tag = m.fullTag;

    // Extract alt text and dimensions for context
    const altMatch = tag.match(/alt=["']([^"']*)["']/i);
    const widthMatch = tag.match(/width=["'](\d+)["']/i);
    const heightMatch = tag.match(/height=["'](\d+)["']/i);
    const classMatch = tag.match(/class=["']([^"']*)["']/i);

    const alt = altMatch?.[1]?.toLowerCase() || '';
    const width = widthMatch ? parseInt(widthMatch[1]) : 0;
    const height = heightMatch ? parseInt(heightMatch[1]) : 0;
    const classes = classMatch?.[1]?.toLowerCase() || '';

    // Determine if this is a logo or photo slot
    const isLogo = inferIsLogo(alt, classes, width, height);

    let assetPath;
    let reason;

    if (isLogo && logos.length > 0) {
      // Try to match by alt text first (excluding already-assigned)
      const available = logos.filter(l => !assignedAssets.has(l));
      const altMatched = matchByAltText(alt, available);
      if (altMatched) {
        assetPath = altMatched;
        reason = `matched logo by alt text "${alt}"`;
      } else {
        // Fall back to next unassigned logo in order
        while (logoIndex < logos.length && assignedAssets.has(logos[logoIndex])) logoIndex++;
        if (logoIndex < logos.length) {
          assetPath = logos[logoIndex++];
          reason = `assigned logo by order (index ${logoIndex - 1})`;
        }
      }
    } else if (photos.length > 0) {
      // Try to match by alt text first (excluding already-assigned)
      const available = photos.filter(p => !assignedAssets.has(p));
      const altMatched = matchByAltText(alt, available);
      if (altMatched) {
        assetPath = altMatched;
        reason = `matched photo by alt text "${alt}"`;
      } else {
        // Fall back to next unassigned photo in order
        while (photoIndex < photos.length && assignedAssets.has(photos[photoIndex])) photoIndex++;
        if (photoIndex < photos.length) {
          assetPath = photos[photoIndex++];
          reason = `assigned photo by order (index ${photoIndex - 1})`;
        }
      }
    }

    if (assetPath) {
      assignedAssets.add(assetPath);
    }

    if (assetPath) {
      // Compute relative path from the HTML file's perspective
      // brandAssetsPath is like .../brand/assets — we need path relative to output dir
      const relPath = path.basename(path.dirname(assetPath)) + '/' + path.basename(assetPath);

      // Replace the data URI src with the real asset path
      const newTag = tag.replace(m.dataUri, relPath);
      patched = patched.replace(tag, newTag);

      replacements.push({
        from: `data:image/svg+xml... (${alt || 'no alt'})`,
        to: relPath,
        reason,
      });
    }
  }

  if (replacements.length === 0) return null;

  return {
    type: 'placeholder-images',
    description: `Replaced ${replacements.length} SVG data URI placeholder(s) with real brand assets`,
    patched,
    replacements,
  };
}

/**
 * Infer whether an image slot is for a logo based on context clues.
 */
function inferIsLogo(alt, classes, width, height) {
  // Check alt text for logo-related keywords
  if (/logo|brand|icon|badge|seal|emblem/i.test(alt)) return true;
  // Check classes for logo-related keywords
  if (/logo|brand|icon|badge/i.test(classes)) return true;
  // Logos tend to be smaller and/or wider than tall
  if (width > 0 && height > 0 && width <= 200 && height <= 100) return true;
  return false;
}

/**
 * Try to match an alt text to a file in the assets list.
 * Returns the best matching file path or null.
 */
function matchByAltText(alt, assets) {
  if (!alt || alt.length < 3) return null;

  // Generic words that are less useful for matching
  const genericWords = new Set(['logo', 'image', 'photo', 'icon', 'picture', 'img', 'badge', 'pic']);

  // Normalize alt text into searchable tokens
  const tokens = alt.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3);

  if (tokens.length === 0) return null;

  let bestMatch = null;
  let bestScore = 0;

  for (const assetPath of assets) {
    const filename = path.basename(assetPath).toLowerCase()
      .replace(/^[a-f0-9]+_/, '')  // strip hash prefix
      .replace(/\.[^.]+$/, '')     // strip extension
      .replace(/[-_]/g, ' ');      // normalize separators

    let score = 0;
    for (const token of tokens) {
      if (filename.includes(token)) {
        // Specific tokens (non-generic) get higher weight
        score += genericWords.has(token) ? 1 : 3;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = assetPath;
    }
  }

  // Only return if at least one token matched
  return bestScore > 0 ? bestMatch : null;
}

// ─── Prompt Builder ──────────────────────────────────────

/**
 * Build a structured prompt for Claude Code CLI to address remaining issues.
 * @param {object[]} issues - non-auto-fixable issues
 * @param {string} htmlPath
 * @param {{ headingFont?: string, bodyFont?: string, colors?: object }} brandSpec
 * @param {string[]} [unresolvedImages] - image paths that could not be resolved
 * @returns {string}
 */
export function buildPrompt(issues, htmlPath, brandSpec, unresolvedImages) {
  const hasIssues = issues.length > 0;
  const hasUnresolved = unresolvedImages?.length > 0;

  if (!hasIssues && !hasUnresolved) return '';

  const lines = [
    `Fix the following issues in ${htmlPath}:`,
    '',
  ];

  const placeholders = issues.filter(i => i.type === 'placeholder-text');
  const missingSections = issues.filter(i => i.type === 'missing-sections');
  const other = issues.filter(i => i.type !== 'placeholder-text' && i.type !== 'missing-sections');

  if (missingSections.length > 0) {
    lines.push('## Missing Sections');
    lines.push('Add the following sections to the page (match the existing design style):');
    for (const issue of missingSections) {
      for (const section of issue.sections) {
        lines.push(`- ${section}`);
      }
    }
    lines.push('');
  }

  if (placeholders.length > 0) {
    lines.push('## Placeholder Text');
    lines.push('Replace placeholder text with real copy at these locations:');
    for (const issue of placeholders) {
      for (const loc of issue.locations) {
        lines.push(`- Line ${loc.line}: "${loc.matched}" (${loc.pattern})`);
      }
    }
    lines.push('');
  }

  if (other.length > 0) {
    lines.push('## Other Issues');
    for (const issue of other) {
      lines.push(`- ${issue.description}`);
    }
    lines.push('');
  }

  if (hasUnresolved) {
    lines.push('## Unresolved Images');
    lines.push('The following image paths could not be resolved to any file in brand/assets/. Replace them with valid image paths or appropriate placeholders:');
    for (const imgPath of unresolvedImages) {
      lines.push(`- ${imgPath}`);
    }
    lines.push('');
  }

  if (brandSpec) {
    lines.push('## Brand Spec (must follow)');
    if (brandSpec.headingFont) lines.push(`- Heading font: ${brandSpec.headingFont}`);
    if (brandSpec.bodyFont) lines.push(`- Body font: ${brandSpec.bodyFont}`);
    if (brandSpec.colors) {
      lines.push('- Colors:');
      for (const [name, hex] of Object.entries(brandSpec.colors)) {
        lines.push(`  - ${name}: ${hex}`);
      }
    }
  }

  return lines.join('\n');
}

// ─── Helpers ─────────────────────────────────────────────

function collectFiles(dir) {
  const results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...collectFiles(fullPath));
      } else {
        results.push(fullPath);
      }
    }
  } catch {
    // Directory not readable
  }
  return results;
}

function findBestMatch(filename, availableAssets, brandAssetsDir) {
  const nameLower = filename.toLowerCase();
  const nameNoExt = path.parse(filename).name.toLowerCase();
  const ext = path.extname(filename).toLowerCase();

  // Priority 1: Exact full filename match (case-insensitive)
  const exact = availableAssets.find(f => path.basename(f).toLowerCase() === nameLower);
  if (exact) return exact;

  // Priority 2: Exact basename match ignoring directory path (case-insensitive)
  // This catches cases where the file exists in a different subdirectory
  const basenameMatch = availableAssets.find(f => {
    const base = path.basename(f).toLowerCase();
    return base === nameLower;
  });
  if (basenameMatch) return basenameMatch;

  // Priority 3: Hash-prefix match — brand assets often have "abc123_originalname.ext" format
  const hashPrefixMatches = availableAssets.filter(f => {
    const base = path.basename(f).toLowerCase();
    const withoutHash = base.replace(/^[a-f0-9]+_/, '');
    return withoutHash === nameLower || path.parse(withoutHash).name === nameNoExt;
  });
  if (hashPrefixMatches.length === 1) return hashPrefixMatches[0];
  if (hashPrefixMatches.length > 1) {
    log('warn', 'image-match-ambiguous', {
      search: filename,
      matches: hashPrefixMatches.map(f => path.basename(f)),
      strategy: 'hash-prefix',
    });
    return null;
  }

  // Priority 4: Fuzzy substring match — last resort, with warnings
  const candidates = availableAssets.filter(f => path.extname(f).toLowerCase() === ext);
  const fuzzyMatches = [];
  for (const candidate of candidates) {
    const candidateName = path.parse(path.basename(candidate)).name.toLowerCase().replace(/^[a-f0-9]+_/, '');
    if (candidateName.includes(nameNoExt) || nameNoExt.includes(candidateName)) {
      fuzzyMatches.push(candidate);
    }
  }

  if (fuzzyMatches.length === 1) {
    log('warn', 'image-match-fuzzy', {
      search: filename,
      matched: path.basename(fuzzyMatches[0]),
      strategy: 'fuzzy-substring',
    });
    return fuzzyMatches[0];
  }

  if (fuzzyMatches.length > 1) {
    log('warn', 'image-match-ambiguous', {
      search: filename,
      matches: fuzzyMatches.map(f => path.basename(f)),
      strategy: 'fuzzy-substring',
    });
    return null;
  }

  return null;
}

function getContainingTag(html, index) {
  // Walk backward to find the nearest opening tag
  let depth = 0;
  const scriptOpen = /<script[^>]*>/gi;
  const scriptClose = /<\/script>/gi;
  const styleOpen = /<style[^>]*>/gi;
  const styleClose = /<\/style>/gi;

  // Check if index is inside a <script> block
  let sMatch;
  while ((sMatch = scriptOpen.exec(html)) !== null) {
    if (sMatch.index > index) break;
    scriptClose.lastIndex = sMatch.index;
    const closeMatch = scriptClose.exec(html);
    if (closeMatch && closeMatch.index > index) return 'script';
  }

  // Check if index is inside a <style> block
  let stMatch;
  while ((stMatch = styleOpen.exec(html)) !== null) {
    if (stMatch.index > index) break;
    styleClose.lastIndex = stMatch.index;
    const closeMatch = styleClose.exec(html);
    if (closeMatch && closeMatch.index > index) return 'style';
  }

  return null;
}

// ─── HTML Recovery ───────────────────────────────────────

/**
 * Recover catastrophically broken HTML by reconstructing a valid skeleton
 * and transplanting salvageable content from the broken output.
 *
 * @param {string} html - The broken HTML string
 * @param {{ headingFont?: string, bodyFont?: string, colors?: object }} brandConfig
 * @returns {{ recovered: boolean, html: string, issues: string[] }}
 */
export function recoverHTML(html, brandConfig) {
  // Bail out if HTML is empty or too short to salvage
  if (!html || html.length < 50) {
    return { recovered: false, html: html || '', issues: ['HTML is empty or too short to recover (< 50 characters)'] };
  }

  const issues = [];
  let needsRecovery = false;

  // Detect what's missing
  const hasDoctype = /<!DOCTYPE\s+html\s*>/i.test(html);
  const hasHtmlTag = /<html[\s>]/i.test(html);
  const hasHeadTag = /<head[\s>]/i.test(html);
  const hasBodyTag = /<body[\s>]/i.test(html);
  const hasContentBlocks = /<(?:section|main|article|div)[\s>]/i.test(html);

  if (!hasDoctype) { issues.push('Added missing <!DOCTYPE html>'); needsRecovery = true; }
  if (!hasHtmlTag) { issues.push('Wrapped content in <html> tag'); needsRecovery = true; }
  if (!hasHeadTag) { issues.push('Added missing <head> section'); needsRecovery = true; }
  if (!hasBodyTag) { issues.push('Wrapped content in <body> tag'); needsRecovery = true; }
  if (!hasContentBlocks) { issues.push('Wrapped raw text in <section> elements'); needsRecovery = true; }

  if (!needsRecovery) {
    return { recovered: false, html, issues: [] };
  }

  // Extract salvageable parts from the broken HTML
  const styleBlocks = extractBlocks(html, /<style[\s>][\s\S]*?<\/style>/gi);
  const scriptBlocks = extractBlocks(html, /<script[\s>][\s\S]*?<\/script>/gi);

  // Build font imports for brand config
  const fontFamilies = [];
  if (brandConfig?.headingFont) fontFamilies.push(brandConfig.headingFont);
  if (brandConfig?.bodyFont) fontFamilies.push(brandConfig.bodyFont);

  const fontLink = fontFamilies.length > 0
    ? `  <link href="https://fonts.googleapis.com/css2?${fontFamilies.map(f => `family=${f.replace(/\s+/g, '+')}`).join('&')}&display=swap" rel="stylesheet">`
    : '';

  // Extract body content — try to get it from an existing <body> tag, otherwise use the whole string
  let bodyContent;
  if (hasBodyTag) {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)(?:<\/body>|$)/i);
    bodyContent = bodyMatch ? bodyMatch[1].trim() : html;
  } else {
    // Strip out doctype, html, head tags and their content to get remaining content
    bodyContent = html
      .replace(/<!DOCTYPE[^>]*>/gi, '')
      .replace(/<html[^>]*>/gi, '')
      .replace(/<\/html>/gi, '')
      .replace(/<head[\s>][\s\S]*?<\/head>/gi, '')
      .replace(/<style[\s>][\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s>][\s\S]*?<\/script>/gi, '')
      .trim();
  }

  // If no content blocks exist, wrap text content in sections
  if (!hasContentBlocks && bodyContent) {
    bodyContent = wrapInSections(bodyContent);
    issues.push('Content wrapped in semantic <section> elements');
  }

  // Reconstruct the HTML skeleton
  const recoveredHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recovered Page</title>
${fontLink ? fontLink + '\n' : ''}  <script src="https://cdn.tailwindcss.com"></script>
${styleBlocks.length > 0 ? styleBlocks.join('\n') + '\n' : ''}</head>
<body>
${bodyContent}
${scriptBlocks.length > 0 ? scriptBlocks.join('\n') + '\n' : ''}</body>
</html>`;

  return { recovered: true, html: recoveredHtml, issues };
}

/**
 * Extract all matching blocks from HTML.
 */
function extractBlocks(html, regex) {
  const matches = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    matches.push(match[0]);
  }
  return matches;
}

/**
 * Wrap raw text/HTML fragments in <section> elements.
 * Splits on double newlines or <br> sequences to create logical sections.
 */
function wrapInSections(content) {
  // Split on double newlines, <br> pairs, or <hr> tags
  const chunks = content
    .split(/(?:\s*<br\s*\/?>\s*){2,}|(?:\n\s*){2,}|<hr\s*\/?>/)
    .map(c => c.trim())
    .filter(c => c.length > 0);

  if (chunks.length === 0) return content;

  return chunks
    .map(chunk => `  <section>\n    ${chunk}\n  </section>`)
    .join('\n');
}

// ─── Main Entry Point ────────────────────────────────────

/**
 * Self-heal a generated HTML page.
 *
 * @param {string} htmlPath - Absolute path to the HTML file
 * @param {{ headingFont?: string, bodyFont?: string, colors?: object }} brandSpec - Parsed brand spec
 * @param {Array<{type: string, message: string, section?: string}>} validationErrors - Errors from validate-html.mjs
 * @returns {Promise<{ healed: boolean, fixes: Array<{type: string, description: string}>, prompt: string, unresolvedImages: string[] }>}
 */
export async function selfHeal(htmlPath, brandSpec, validationErrors) {
  const ctx = createContext();
  const logger = ctx.createLogger('self-heal');

  log('info', 'start', { htmlPath, correlationId: ctx.correlationId, errorCount: validationErrors?.length || 0 });

  if (!fs.existsSync(htmlPath)) {
    log('error', 'file-not-found', { htmlPath });
    return {
      healed: false,
      fixes: [],
      prompt: `File not found: ${htmlPath}. Re-generate the page from scratch.`,
      unresolvedImages: [],
    };
  }

  let html = fs.readFileSync(htmlPath, 'utf-8');
  const autoFixes = [];
  const manualIssues = [];
  let unresolvedImages = [];

  // ── Strategy 1: Missing Tailwind CDN ──
  const tailwindFix = healMissingTailwind(html);
  if (tailwindFix) {
    html = tailwindFix.patched;
    autoFixes.push({ type: tailwindFix.type, description: tailwindFix.description });
    log('info', 'auto-fix', { type: 'missing-tailwind' });
  }

  // ── Strategy 2: Wrong fonts ──
  const fontFix = healWrongFonts(html, brandSpec);
  if (fontFix) {
    html = fontFix.patched;
    autoFixes.push({ type: fontFix.type, description: fontFix.description });
    log('info', 'auto-fix', { type: 'wrong-fonts', replacements: fontFix.replacements });
  }

  // ── Strategy 3: Broken image references ──
  const imageFix = healBrokenImages(html, htmlPath, logger);
  if (imageFix) {
    html = imageFix.patched;
    unresolvedImages = imageFix.unresolved || [];
    if (imageFix.fixes.length > 0) {
      autoFixes.push({ type: imageFix.type, description: imageFix.description });
      log('info', 'auto-fix', { type: 'broken-images', fixes: imageFix.fixes });
    }
    if (unresolvedImages.length > 0) {
      log('warn', 'unresolved-images', {
        correlationId: ctx.correlationId,
        count: unresolvedImages.length,
        paths: unresolvedImages,
      });
    }
  }

  // ── Strategy 4: Brand color enforcement ──
  const brandColorFix = healBrandColors(html, brandSpec);
  if (brandColorFix) {
    html = brandColorFix.patched;
    if (brandColorFix.injectedColors.length > 0 || brandColorFix.bodyBgFixed) {
      autoFixes.push({ type: brandColorFix.type, description: brandColorFix.description });
      log('info', 'auto-fix', {
        type: 'brand-colors',
        injectedColors: brandColorFix.injectedColors,
        bodyBgFixed: brandColorFix.bodyBgFixed,
      });
    }
    if (brandColorFix.missingPrimary) {
      manualIssues.push({
        type: 'missing-primary-color',
        description: `Primary brand color ${brandSpec.colors.primary || Object.values(brandSpec.colors)[0]} not found in page styles — needs re-generation`,
      });
      log('info', 'needs-regen', { type: 'missing-primary-color' });
    }
  }

  // ── Strategy 5: SVG data URI placeholder replacement ──
  const outputDir = path.dirname(htmlPath);
  const clientDir = path.resolve(outputDir, '..');
  const brandAssetsPath = path.join(clientDir, 'brand', 'assets');
  const placeholderImageFix = healPlaceholderImages(html, brandAssetsPath);
  if (placeholderImageFix) {
    html = placeholderImageFix.patched;
    autoFixes.push({ type: placeholderImageFix.type, description: placeholderImageFix.description });
    log('info', 'auto-fix', {
      type: 'placeholder-images',
      replacements: placeholderImageFix.replacements,
    });
  }

  // ── Strategy 6: Placeholder text (flag for re-generation) ──
  const placeholders = detectPlaceholderText(html);
  if (placeholders) {
    manualIssues.push(placeholders);
    log('info', 'needs-regen', { type: 'placeholder-text', count: placeholders.locations.length });
  }

  // ── Strategy 7: Missing sections (from validation errors) ──
  const missingSections = detectMissingSections(validationErrors);
  if (missingSections) {
    manualIssues.push(missingSections);
    log('info', 'needs-regen', { type: 'missing-sections', sections: missingSections.sections });
  }

  // Write back auto-fixed HTML
  if (autoFixes.length > 0) {
    fs.writeFileSync(htmlPath, html, 'utf-8');
    log('info', 'wrote-fixes', { count: autoFixes.length, path: htmlPath });
  }

  // Build prompt for remaining issues (include unresolved images)
  const prompt = buildPrompt(manualIssues, htmlPath, brandSpec, unresolvedImages);
  const healed = manualIssues.length === 0 && unresolvedImages.length === 0;

  log('info', 'complete', {
    healed,
    autoFixCount: autoFixes.length,
    manualIssueCount: manualIssues.length,
    unresolvedImageCount: unresolvedImages.length,
  });

  return {
    healed,
    fixes: autoFixes,
    prompt,
    unresolvedImages,
  };
}
