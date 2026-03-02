/**
 * Dark mode utilities for page generation pipeline.
 *
 * Provides color palette generation (light → dark) and HTML injection
 * for dark mode support using CSS custom properties + prefers-color-scheme.
 *
 * Usage:
 *   import { generateDarkPalette, injectDarkMode } from './utils/dark-mode.mjs';
 *
 *   const darkColors = generateDarkPalette({ primary: '#8B1A3A', background: '#FAF5EE', text: '#2C2C2C' });
 *   const result = injectDarkMode(html, { lightColors: brandColors, darkColors, toggle: true });
 */

// ─── Color Math ──────────────────────────────────────────

/**
 * Parse a hex color string to { r, g, b } (0–255).
 * Accepts #RGB, #RRGGBB, RGB, RRGGBB.
 */
export function hexToRgb(hex) {
  let h = hex.replace(/^#/, '');
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  if (h.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/**
 * Convert { r, g, b } (0–255) to #RRGGBB hex string.
 */
export function rgbToHex({ r, g, b }) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [clamp(r), clamp(g), clamp(b)]
    .map(v => v.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert { r, g, b } (0–255) to { h, s, l } (h: 0–360, s/l: 0–1).
 */
export function rgbToHsl({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;

  if (max === min) return { h: 0, s: 0, l };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;

  return { h: h * 360, s, l };
}

/**
 * Convert { h, s, l } (h: 0–360, s/l: 0–1) to { r, g, b } (0–255).
 */
export function hslToRgb({ h, s, l }) {
  const hn = h / 360;
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }

  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return {
    r: Math.round(hue2rgb(p, q, hn + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, hn) * 255),
    b: Math.round(hue2rgb(p, q, hn - 1 / 3) * 255),
  };
}

/**
 * Compute relative luminance of a color (0–1) per WCAG 2.1.
 */
export function relativeLuminance({ r, g, b }) {
  const linearize = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/**
 * Check if a color is perceptually "light" (luminance > 0.5).
 */
export function isLightColor(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  return relativeLuminance(rgb) > 0.5;
}

// ─── Palette Generation ──────────────────────────────────

/**
 * Transform a single hex color for dark mode.
 * - Light backgrounds → dark backgrounds (invert lightness)
 * - Dark text → light text (invert lightness)
 * - Accent/primary colors → slightly brighter for dark backgrounds
 *
 * @param {string} hex - The color to transform
 * @param {'background' | 'text' | 'accent'} role - Semantic role of the color
 * @returns {string} Dark mode hex color
 */
export function transformColorForDarkMode(hex, role = 'accent') {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const hsl = rgbToHsl(rgb);

  switch (role) {
    case 'background': {
      // Invert lightness: light bg → dark bg
      // Map 0.85–1.0 → 0.06–0.12 (very dark surfaces)
      const newL = Math.max(0.06, Math.min(0.15, 1 - hsl.l));
      // Reduce saturation for dark surfaces
      const newS = hsl.s * 0.4;
      return rgbToHex(hslToRgb({ h: hsl.h, s: newS, l: newL }));
    }

    case 'text': {
      // Dark text → light text
      if (hsl.l < 0.5) {
        // Dark text: push lightness to 0.85–0.95
        const newL = 0.85 + (1 - hsl.l) * 0.1;
        const newS = hsl.s * 0.3;
        return rgbToHex(hslToRgb({ h: hsl.h, s: newS, l: Math.min(0.95, newL) }));
      }
      // Already light text: keep it (e.g. white-on-dark)
      return hex;
    }

    case 'accent':
    default: {
      // Accent/primary: increase lightness to ensure contrast on dark bg
      if (hsl.l < 0.45) {
        // Saturated dark accents: lighten by ~20-30%
        const newL = Math.min(0.65, hsl.l + 0.2);
        const newS = Math.min(1, hsl.s * 1.1);
        return rgbToHex(hslToRgb({ h: hsl.h, s: newS, l: newL }));
      }
      // Already light accents: minimal adjustment
      return hex;
    }
  }
}

/**
 * Generate a full dark mode color palette from brand colors.
 *
 * @param {Record<string, string>} colors - Brand color map (name → hex)
 * @param {Record<string, 'background' | 'text' | 'accent'>} [roles] - Optional role hints
 * @returns {Record<string, string>} Dark mode color map (same keys, dark hex values)
 */
export function generateDarkPalette(colors, roles = {}) {
  if (!colors || typeof colors !== 'object') return {};

  // Auto-detect roles based on color name patterns
  const bgPatterns = /^(background|bg|ivory|champagne|blush|surface|canvas|base|white)/i;
  const textPatterns = /^(text|charcoal|ink|body|copy|dark|black|gray|grey)/i;

  const result = {};
  for (const [name, hex] of Object.entries(colors)) {
    if (typeof hex !== 'string' || !hexToRgb(hex)) continue;

    let role = roles[name];
    if (!role) {
      if (bgPatterns.test(name)) role = 'background';
      else if (textPatterns.test(name)) role = 'text';
      else role = 'accent';
    }

    result[name] = transformColorForDarkMode(hex, role);
  }

  return result;
}

// ─── CSS Generation ──────────────────────────────────────

/**
 * Build CSS custom properties block for light + dark themes.
 *
 * @param {Record<string, string>} lightColors - Light mode color map
 * @param {Record<string, string>} darkColors - Dark mode color map
 * @returns {string} CSS string with :root and prefers-color-scheme rules
 */
export function buildThemeCSS(lightColors, darkColors) {
  const toVarName = (name) => `--color-${name.replace(/[A-Z]/g, m => '-' + m.toLowerCase()).replace(/[^a-z0-9-]/g, '-')}`;

  const lightVars = Object.entries(lightColors)
    .filter(([, v]) => typeof v === 'string' && hexToRgb(v))
    .map(([name, hex]) => `    ${toVarName(name)}: ${hex};`)
    .join('\n');

  const darkVars = Object.entries(darkColors)
    .filter(([name, v]) => typeof v === 'string' && hexToRgb(v) && lightColors[name])
    .map(([name, hex]) => `    ${toVarName(name)}: ${hex};`)
    .join('\n');

  if (!lightVars && !darkVars) return '';

  let css = '';

  if (lightVars) {
    css += `  :root {\n${lightVars}\n  }\n`;
  }

  if (darkVars) {
    css += `\n  @media (prefers-color-scheme: dark) {\n    :root:not([data-theme="light"]) {\n${darkVars}\n    }\n  }\n`;
    css += `\n  [data-theme="dark"] {\n${darkVars}\n  }\n`;
  }

  return css;
}

/**
 * Build the theme toggle button HTML + JS.
 * Uses localStorage for persistence, respects prefers-color-scheme as default.
 *
 * @returns {string} HTML string for the toggle button and script
 */
export function buildThemeToggle() {
  return `<!-- Dark mode toggle -->
<button
  id="theme-toggle"
  aria-label="Toggle dark mode"
  style="position:fixed;bottom:24px;right:24px;z-index:9999;width:48px;height:48px;border-radius:50%;border:2px solid var(--color-primary, #666);background:var(--color-background, #fff);color:var(--color-text, #333);cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.15);transition:transform 0.2s ease,opacity 0.2s ease;"
  onmouseenter="this.style.transform='scale(1.1)'"
  onmouseleave="this.style.transform='scale(1)'"
  onfocus="this.style.outline='2px solid var(--color-primary, #666)';this.style.outlineOffset='2px'"
  onblur="this.style.outline='none'"
>
  <svg id="theme-icon-sun" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none">
    <circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
  </svg>
  <svg id="theme-icon-moon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
</button>
<script>
(function() {
  var toggle = document.getElementById('theme-toggle');
  var sunIcon = document.getElementById('theme-icon-sun');
  var moonIcon = document.getElementById('theme-icon-moon');
  function getPreferred() {
    var stored = localStorage.getItem('theme');
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (sunIcon && moonIcon) {
      sunIcon.style.display = theme === 'dark' ? 'block' : 'none';
      moonIcon.style.display = theme === 'dark' ? 'none' : 'block';
    }
  }
  apply(getPreferred());
  if (toggle) {
    toggle.addEventListener('click', function() {
      var current = document.documentElement.getAttribute('data-theme') || getPreferred();
      var next = current === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', next);
      apply(next);
    });
  }
})();
</script>`;
}

// ─── HTML Injection ──────────────────────────────────────

/**
 * Inject dark mode support into an existing HTML page.
 *
 * Adds CSS custom properties for light/dark themes, a prefers-color-scheme
 * media query, and optionally a toggle button.
 *
 * @param {string} html - The HTML string to transform
 * @param {object} options
 * @param {Record<string, string>} options.lightColors - Light mode brand colors
 * @param {Record<string, string>} [options.darkColors] - Dark mode overrides (auto-generated if omitted)
 * @param {Record<string, 'background' | 'text' | 'accent'>} [options.roles] - Color role hints for auto-generation
 * @param {boolean} [options.toggle=true] - Whether to inject the theme toggle button
 * @returns {{ patched: string, description: string, darkColors: Record<string, string> } | null}
 */
export function injectDarkMode(html, options = {}) {
  if (!html || typeof html !== 'string') return null;

  const { lightColors, roles, toggle = true } = options;
  if (!lightColors || Object.keys(lightColors).length === 0) return null;

  // Already has dark mode support — skip
  if (html.includes('prefers-color-scheme: dark') || html.includes('data-theme="dark"')) {
    return null;
  }

  const darkColors = options.darkColors || generateDarkPalette(lightColors, roles);
  const themeCSS = buildThemeCSS(lightColors, darkColors);

  if (!themeCSS) return null;

  let patched = html;
  const styleBlock = `<style id="dark-mode-theme">\n${themeCSS}</style>`;

  // Inject the theme style block
  if (patched.includes('</head>')) {
    patched = patched.replace('</head>', `${styleBlock}\n</head>`);
  } else if (patched.includes('<body')) {
    patched = patched.replace('<body', `${styleBlock}\n<body`);
  } else {
    patched = `${styleBlock}\n${patched}`;
  }

  // Inject toggle button before </body>
  if (toggle) {
    const toggleHtml = buildThemeToggle();
    if (patched.includes('</body>')) {
      patched = patched.replace('</body>', `${toggleHtml}\n</body>`);
    } else {
      patched += `\n${toggleHtml}`;
    }
  }

  const colorCount = Object.keys(darkColors).length;
  const description = `Injected dark mode support (${colorCount} color${colorCount !== 1 ? 's' : ''}${toggle ? ' + toggle' : ''})`;

  return { patched, description, darkColors };
}
