import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  relativeLuminance,
  isLightColor,
  transformColorForDarkMode,
  generateDarkPalette,
  buildThemeCSS,
  buildThemeToggle,
  injectDarkMode,
} from '../utils/dark-mode.mjs';

// ─── Helpers ────────────────────────────────────────────

function makeHtml(body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Test</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
${body}
</body>
</html>`;
}

const BRAND_COLORS = {
  primary: '#8B1A3A',
  gold: '#C9963A',
  champagne: '#F5E6D0',
  blush: '#E8C4B0',
  ivory: '#FAF5EE',
  charcoal: '#2C2C2C',
};

// ─── hexToRgb ───────────────────────────────────────────

describe('hexToRgb', () => {
  it('parses 6-digit hex', () => {
    assert.deepEqual(hexToRgb('#FF0000'), { r: 255, g: 0, b: 0 });
    assert.deepEqual(hexToRgb('#00FF00'), { r: 0, g: 255, b: 0 });
    assert.deepEqual(hexToRgb('#0000FF'), { r: 0, g: 0, b: 255 });
  });

  it('parses 3-digit hex', () => {
    assert.deepEqual(hexToRgb('#F00'), { r: 255, g: 0, b: 0 });
    assert.deepEqual(hexToRgb('#FFF'), { r: 255, g: 255, b: 255 });
  });

  it('parses without # prefix', () => {
    assert.deepEqual(hexToRgb('8B1A3A'), { r: 139, g: 26, b: 58 });
  });

  it('returns null for invalid hex', () => {
    assert.equal(hexToRgb(''), null);
    assert.equal(hexToRgb('xyz'), null);
    assert.equal(hexToRgb('#GGHHII'), null);
    assert.equal(hexToRgb('#12345'), null);
  });
});

// ─── rgbToHex ───────────────────────────────────────────

describe('rgbToHex', () => {
  it('converts RGB to hex', () => {
    assert.equal(rgbToHex({ r: 255, g: 0, b: 0 }), '#ff0000');
    assert.equal(rgbToHex({ r: 0, g: 255, b: 0 }), '#00ff00');
    assert.equal(rgbToHex({ r: 0, g: 0, b: 255 }), '#0000ff');
  });

  it('clamps values to 0–255', () => {
    assert.equal(rgbToHex({ r: 300, g: -10, b: 128 }), '#ff0080');
  });

  it('pads single-digit hex values', () => {
    assert.equal(rgbToHex({ r: 0, g: 0, b: 0 }), '#000000');
    assert.equal(rgbToHex({ r: 15, g: 15, b: 15 }), '#0f0f0f');
  });
});

// ─── rgbToHsl / hslToRgb roundtrip ─────────────────────

describe('rgbToHsl / hslToRgb', () => {
  it('roundtrips pure red', () => {
    const rgb = { r: 255, g: 0, b: 0 };
    const hsl = rgbToHsl(rgb);
    assert.ok(Math.abs(hsl.h - 0) < 1);
    assert.ok(Math.abs(hsl.s - 1) < 0.01);
    assert.ok(Math.abs(hsl.l - 0.5) < 0.01);
    const back = hslToRgb(hsl);
    assert.ok(Math.abs(back.r - 255) <= 1);
    assert.ok(Math.abs(back.g - 0) <= 1);
    assert.ok(Math.abs(back.b - 0) <= 1);
  });

  it('roundtrips white', () => {
    const rgb = { r: 255, g: 255, b: 255 };
    const hsl = rgbToHsl(rgb);
    assert.ok(Math.abs(hsl.l - 1) < 0.01);
    assert.equal(hsl.s, 0);
  });

  it('roundtrips brand burgundy', () => {
    const rgb = hexToRgb('#8B1A3A');
    const hsl = rgbToHsl(rgb);
    const back = hslToRgb(hsl);
    assert.ok(Math.abs(back.r - rgb.r) <= 1);
    assert.ok(Math.abs(back.g - rgb.g) <= 1);
    assert.ok(Math.abs(back.b - rgb.b) <= 1);
  });

  it('handles achromatic colors', () => {
    const gray = { r: 128, g: 128, b: 128 };
    const hsl = rgbToHsl(gray);
    assert.equal(hsl.s, 0);
    const back = hslToRgb(hsl);
    assert.ok(Math.abs(back.r - 128) <= 1);
  });
});

// ─── relativeLuminance ──────────────────────────────────

describe('relativeLuminance', () => {
  it('returns ~1 for white', () => {
    assert.ok(relativeLuminance({ r: 255, g: 255, b: 255 }) > 0.99);
  });

  it('returns ~0 for black', () => {
    assert.ok(relativeLuminance({ r: 0, g: 0, b: 0 }) < 0.01);
  });

  it('returns moderate value for mid-gray', () => {
    const lum = relativeLuminance({ r: 128, g: 128, b: 128 });
    assert.ok(lum > 0.1 && lum < 0.5);
  });
});

// ─── isLightColor ───────────────────────────────────────

describe('isLightColor', () => {
  it('returns true for white', () => {
    assert.equal(isLightColor('#FFFFFF'), true);
  });

  it('returns true for ivory', () => {
    assert.equal(isLightColor('#FAF5EE'), true);
  });

  it('returns false for black', () => {
    assert.equal(isLightColor('#000000'), false);
  });

  it('returns false for dark charcoal', () => {
    assert.equal(isLightColor('#2C2C2C'), false);
  });

  it('returns false for invalid hex', () => {
    assert.equal(isLightColor('not-a-color'), false);
  });
});

// ─── transformColorForDarkMode ──────────────────────────

describe('transformColorForDarkMode', () => {
  it('makes light backgrounds dark', () => {
    const dark = transformColorForDarkMode('#FAF5EE', 'background');
    assert.ok(!isLightColor(dark), `Expected ${dark} to be dark`);
  });

  it('makes dark text light', () => {
    const light = transformColorForDarkMode('#2C2C2C', 'text');
    assert.ok(isLightColor(light), `Expected ${light} to be light`);
  });

  it('keeps already-light text unchanged', () => {
    const result = transformColorForDarkMode('#FFFFFF', 'text');
    assert.equal(result, '#FFFFFF');
  });

  it('lightens dark accent colors', () => {
    const original = hexToRgb('#8B1A3A');
    const transformed = hexToRgb(transformColorForDarkMode('#8B1A3A', 'accent'));
    const originalHsl = rgbToHsl(original);
    const transformedHsl = rgbToHsl(transformed);
    assert.ok(transformedHsl.l > originalHsl.l, 'Accent should be lightened for dark mode');
  });

  it('returns original hex for invalid input', () => {
    assert.equal(transformColorForDarkMode('not-valid', 'accent'), 'not-valid');
  });
});

// ─── generateDarkPalette ────────────────────────────────

describe('generateDarkPalette', () => {
  it('generates dark variants for all brand colors', () => {
    const dark = generateDarkPalette(BRAND_COLORS);
    assert.equal(Object.keys(dark).length, Object.keys(BRAND_COLORS).length);
    for (const key of Object.keys(BRAND_COLORS)) {
      assert.ok(dark[key], `Missing dark variant for ${key}`);
      assert.ok(hexToRgb(dark[key]), `Invalid hex for dark ${key}: ${dark[key]}`);
    }
  });

  it('auto-detects background role from name patterns', () => {
    const colors = { ivory: '#FAF5EE', text: '#2C2C2C' };
    const dark = generateDarkPalette(colors);
    // ivory should become dark (background role)
    assert.ok(!isLightColor(dark.ivory), `Expected dark ivory: ${dark.ivory}`);
    // text should become light (text role)
    assert.ok(isLightColor(dark.text), `Expected light text: ${dark.text}`);
  });

  it('respects explicit role overrides', () => {
    const colors = { mycolor: '#FAF5EE' };
    const darkAsAccent = generateDarkPalette(colors, {});
    const darkAsBg = generateDarkPalette(colors, { mycolor: 'background' });
    // Different roles should produce different results
    assert.notEqual(darkAsAccent.mycolor, darkAsBg.mycolor);
  });

  it('returns empty object for null/undefined input', () => {
    assert.deepEqual(generateDarkPalette(null), {});
    assert.deepEqual(generateDarkPalette(undefined), {});
  });

  it('skips invalid hex values', () => {
    const colors = { good: '#FF0000', bad: 'not-a-color', also_bad: 42 };
    const dark = generateDarkPalette(colors);
    assert.ok(dark.good);
    assert.ok(!dark.bad);
    assert.ok(!dark.also_bad);
  });
});

// ─── buildThemeCSS ──────────────────────────────────────

describe('buildThemeCSS', () => {
  it('generates CSS with custom properties', () => {
    const light = { primary: '#8B1A3A', background: '#FAF5EE' };
    const dark = { primary: '#CC4466', background: '#1A1A1A' };
    const css = buildThemeCSS(light, dark);
    assert.ok(css.includes(':root'));
    assert.ok(css.includes('--color-primary'));
    assert.ok(css.includes('--color-background'));
    assert.ok(css.includes('#8B1A3A'));
    assert.ok(css.includes('#CC4466'));
  });

  it('includes prefers-color-scheme media query', () => {
    const light = { primary: '#8B1A3A' };
    const dark = { primary: '#CC4466' };
    const css = buildThemeCSS(light, dark);
    assert.ok(css.includes('prefers-color-scheme: dark'));
  });

  it('includes data-theme selector for manual override', () => {
    const light = { primary: '#8B1A3A' };
    const dark = { primary: '#CC4466' };
    const css = buildThemeCSS(light, dark);
    assert.ok(css.includes('[data-theme="dark"]'));
  });

  it('uses not selector to allow manual light override', () => {
    const light = { primary: '#8B1A3A' };
    const dark = { primary: '#CC4466' };
    const css = buildThemeCSS(light, dark);
    assert.ok(css.includes(':root:not([data-theme="light"])'));
  });

  it('returns empty string when no valid colors', () => {
    const css = buildThemeCSS({}, {});
    assert.equal(css, '');
  });

  it('converts camelCase names to kebab-case CSS vars', () => {
    const light = { backgroundColor: '#FAF5EE' };
    const dark = { backgroundColor: '#1A1A1A' };
    const css = buildThemeCSS(light, dark);
    assert.ok(css.includes('--color-background-color'));
  });
});

// ─── buildThemeToggle ───────────────────────────────────

describe('buildThemeToggle', () => {
  it('returns HTML with toggle button', () => {
    const html = buildThemeToggle();
    assert.ok(html.includes('id="theme-toggle"'));
    assert.ok(html.includes('aria-label'));
  });

  it('includes localStorage persistence script', () => {
    const html = buildThemeToggle();
    assert.ok(html.includes('localStorage'));
    assert.ok(html.includes('data-theme'));
  });

  it('includes sun and moon icons', () => {
    const html = buildThemeToggle();
    assert.ok(html.includes('theme-icon-sun'));
    assert.ok(html.includes('theme-icon-moon'));
  });

  it('respects prefers-color-scheme as default', () => {
    const html = buildThemeToggle();
    assert.ok(html.includes('prefers-color-scheme'));
  });
});

// ─── injectDarkMode ─────────────────────────────────────

describe('injectDarkMode', () => {
  it('returns null for empty/null HTML', () => {
    assert.equal(injectDarkMode(null), null);
    assert.equal(injectDarkMode(''), null);
  });

  it('returns null when no lightColors provided', () => {
    const result = injectDarkMode(makeHtml('<section>Content</section>'), {});
    assert.equal(result, null);
  });

  it('returns null when page already has dark mode', () => {
    const html = makeHtml('<style>@media (prefers-color-scheme: dark) { body { background: #000; } }</style><section>Content</section>');
    const result = injectDarkMode(html, { lightColors: BRAND_COLORS });
    assert.equal(result, null);
  });

  it('injects dark mode CSS before </head>', () => {
    const html = makeHtml('<section>Content</section>');
    const result = injectDarkMode(html, { lightColors: BRAND_COLORS });
    assert.ok(result);
    assert.ok(result.patched.includes('dark-mode-theme'));
    assert.ok(result.patched.includes('prefers-color-scheme: dark'));
    // CSS should be before </head>
    const cssIdx = result.patched.indexOf('dark-mode-theme');
    const headIdx = result.patched.indexOf('</head>');
    assert.ok(cssIdx < headIdx);
  });

  it('injects toggle button before </body>', () => {
    const html = makeHtml('<section>Content</section>');
    const result = injectDarkMode(html, { lightColors: BRAND_COLORS, toggle: true });
    assert.ok(result);
    assert.ok(result.patched.includes('theme-toggle'));
    // Toggle should be before </body>
    const toggleIdx = result.patched.indexOf('theme-toggle');
    const bodyIdx = result.patched.indexOf('</body>');
    assert.ok(toggleIdx < bodyIdx);
  });

  it('skips toggle when toggle=false', () => {
    const html = makeHtml('<section>Content</section>');
    const result = injectDarkMode(html, { lightColors: BRAND_COLORS, toggle: false });
    assert.ok(result);
    assert.ok(!result.patched.includes('theme-toggle'));
  });

  it('returns generated dark colors', () => {
    const html = makeHtml('<section>Content</section>');
    const result = injectDarkMode(html, { lightColors: BRAND_COLORS });
    assert.ok(result.darkColors);
    assert.equal(Object.keys(result.darkColors).length, Object.keys(BRAND_COLORS).length);
  });

  it('uses provided darkColors instead of auto-generating', () => {
    const customDark = { primary: '#FF0000', gold: '#00FF00' };
    const html = makeHtml('<section>Content</section>');
    const result = injectDarkMode(html, {
      lightColors: { primary: '#8B1A3A', gold: '#C9963A' },
      darkColors: customDark,
    });
    assert.ok(result);
    assert.ok(result.patched.includes('#FF0000'));
    assert.ok(result.patched.includes('#00FF00'));
  });

  it('includes description with color count', () => {
    const html = makeHtml('<section>Content</section>');
    const result = injectDarkMode(html, { lightColors: BRAND_COLORS });
    assert.ok(result.description.includes('6 colors'));
    assert.ok(result.description.includes('toggle'));
  });

  it('handles HTML without </head>', () => {
    const html = '<body><section>Content</section></body>';
    const result = injectDarkMode(html, { lightColors: { primary: '#8B1A3A' } });
    assert.ok(result);
    assert.ok(result.patched.includes('dark-mode-theme'));
  });

  it('handles HTML without </body>', () => {
    const html = '<section>Content</section>';
    const result = injectDarkMode(html, { lightColors: { primary: '#8B1A3A' } });
    assert.ok(result);
    assert.ok(result.patched.includes('theme-toggle'));
  });
});
