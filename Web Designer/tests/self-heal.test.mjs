import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';

import {
  selfHeal,
  healMissingTailwind,
  healWrongFonts,
  healBrokenImages,
  healBrandColors,
  healPlaceholderImages,
  detectPlaceholderText,
  detectMissingSections,
  buildPrompt,
  recoverHTML,
} from '../utils/self-heal.mjs';

// ─── Test Fixtures ───────────────────────────────────────

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'self-heal-test-'));

const BRAND_SPEC = {
  headingFont: 'Cormorant Garamond',
  bodyFont: 'Montserrat',
  colors: {
    primary: '#8B1A3A',
    gold: '#C9963A',
    champagne: '#F5E6D0',
    ivory: '#FAF5EE',
    charcoal: '#2C2C2C',
  },
};

function makeHtml(body, { tailwind = true, fonts = true } = {}) {
  const tailwindTag = tailwind ? '<script src="https://cdn.tailwindcss.com"></script>' : '';
  const fontLink = fonts
    ? '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond&family=Montserrat&display=swap" rel="stylesheet">'
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Test Page</title>
  ${fontLink}
  ${tailwindTag}
</head>
<body>
${body}
</body>
</html>`;
}

function writeHtml(filename, content) {
  const filePath = path.join(tmpDir, filename);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ─── healMissingTailwind ─────────────────────────────────

describe('healMissingTailwind', () => {
  it('returns null when Tailwind CDN is already present', () => {
    const html = makeHtml('<h1>Hello</h1>');
    const result = healMissingTailwind(html);
    assert.equal(result, null);
  });

  it('injects Tailwind script before </head>', () => {
    const html = makeHtml('<h1>Hello</h1>', { tailwind: false });
    const result = healMissingTailwind(html);
    assert.ok(result);
    assert.equal(result.type, 'missing-tailwind');
    assert.ok(result.patched.includes('cdn.tailwindcss.com'));
    assert.ok(result.patched.indexOf('cdn.tailwindcss.com') < result.patched.indexOf('</head>'));
  });

  it('handles HTML without </head> tag', () => {
    const html = '<body><h1>No head</h1></body>';
    const result = healMissingTailwind(html);
    assert.ok(result);
    assert.ok(result.patched.includes('cdn.tailwindcss.com'));
    assert.ok(result.patched.indexOf('cdn.tailwindcss.com') < result.patched.indexOf('<body'));
  });

  it('handles HTML with neither </head> nor <body>', () => {
    const html = '<h1>Bare HTML</h1>';
    const result = healMissingTailwind(html);
    assert.ok(result);
    assert.ok(result.patched.includes('cdn.tailwindcss.com'));
    assert.ok(result.patched.startsWith('<script'));
  });
});

// ─── healWrongFonts ──────────────────────────────────────

describe('healWrongFonts', () => {
  it('returns null when no brand spec provided', () => {
    const result = healWrongFonts('<h1>Hello</h1>', null);
    assert.equal(result, null);
  });

  it('returns null when brand spec has no fonts', () => {
    const result = healWrongFonts('<h1>Hello</h1>', {});
    assert.equal(result, null);
  });

  it('returns null when correct fonts are used', () => {
    const html = '<h1 style="font-family: \'Cormorant Garamond\', serif">Hello</h1>';
    const result = healWrongFonts(html, BRAND_SPEC);
    assert.equal(result, null);
  });

  it('replaces generic font with body font', () => {
    const html = '<p style="font-family: Arial, sans-serif">Some text</p>';
    const result = healWrongFonts(html, BRAND_SPEC);
    assert.ok(result);
    assert.equal(result.type, 'wrong-fonts');
    assert.ok(result.patched.includes('Montserrat'));
    assert.ok(!result.patched.includes('font-family: Arial'));
    assert.ok(result.replacements.length > 0);
  });

  it('replaces heading-context font with heading font', () => {
    const html = `<style>h1 { font-family: Roboto, sans-serif; }</style>
    <h1 style="font-family: Roboto, sans-serif">Title</h1>`;
    const result = healWrongFonts(html, BRAND_SPEC);
    assert.ok(result);
    assert.ok(result.patched.includes('Cormorant Garamond') || result.patched.includes('Montserrat'));
  });

  it('handles multiple font replacements', () => {
    const html = `
      <h1 style="font-family: Inter, sans-serif">Title</h1>
      <p style="font-family: Lato, sans-serif">Body text</p>
    `;
    const result = healWrongFonts(html, BRAND_SPEC);
    assert.ok(result);
    assert.ok(result.replacements.length >= 2);
  });

  it('does not replace the correct brand font', () => {
    const html = '<p style="font-family: Montserrat, sans-serif">Correct font</p>';
    const result = healWrongFonts(html, BRAND_SPEC);
    assert.equal(result, null);
  });
});

// ─── healBrokenImages ────────────────────────────────────

describe('healBrokenImages', () => {
  let clientDir;
  let outputDir;
  let htmlFilePath;

  before(() => {
    clientDir = path.join(tmpDir, 'clients', 'img-test');
    outputDir = path.join(clientDir, 'output');
    const brandDir = path.join(clientDir, 'brand', 'assets', 'photos');
    const logoDir = path.join(clientDir, 'brand', 'assets', 'logos');
    fs.mkdirSync(outputDir, { recursive: true });
    fs.mkdirSync(brandDir, { recursive: true });
    fs.mkdirSync(logoDir, { recursive: true });

    // Create some brand assets
    fs.writeFileSync(path.join(brandDir, 'abc123_hero.jpg'), 'fake-jpg');
    fs.writeFileSync(path.join(brandDir, 'def456_team.png'), 'fake-png');
    fs.writeFileSync(path.join(logoDir, 'aaa111_logo.svg'), '<svg></svg>');

    // Create an image that exists in output
    fs.writeFileSync(path.join(outputDir, 'existing.png'), 'fake-png');

    htmlFilePath = path.join(outputDir, 'index.html');
  });

  it('returns null when no broken images', () => {
    const html = '<img src="existing.png"><img src="https://example.com/img.jpg">';
    fs.writeFileSync(htmlFilePath, html);
    const result = healBrokenImages(html, htmlFilePath);
    assert.equal(result, null);
  });

  it('fixes broken image by matching asset filename', () => {
    const html = '<img src="hero.jpg">';
    fs.writeFileSync(htmlFilePath, html);
    const result = healBrokenImages(html, htmlFilePath);
    assert.ok(result);
    assert.equal(result.type, 'broken-images');
    assert.ok(result.fixes.length > 0);
    assert.ok(result.patched.includes('brand/assets/photos'));
  });

  it('skips external URLs', () => {
    const html = '<img src="https://example.com/broken.jpg">';
    const result = healBrokenImages(html, htmlFilePath);
    assert.equal(result, null);
  });

  it('skips data URIs', () => {
    const html = '<img src="data:image/png;base64,abc">';
    const result = healBrokenImages(html, htmlFilePath);
    assert.equal(result, null);
  });

  it('fixes multiple broken images', () => {
    const html = '<img src="hero.jpg"><img src="logo.svg">';
    const result = healBrokenImages(html, htmlFilePath);
    assert.ok(result);
    assert.ok(result.fixes.length >= 2);
  });

  it('returns null when brand/assets/ does not exist', () => {
    const noAssetsDir = path.join(tmpDir, 'clients', 'no-assets', 'output');
    fs.mkdirSync(noAssetsDir, { recursive: true });
    const fp = path.join(noAssetsDir, 'index.html');
    fs.writeFileSync(fp, '<img src="missing.jpg">');
    const result = healBrokenImages('<img src="missing.jpg">', fp);
    assert.equal(result, null);
  });
});

// ─── healBrokenImages: collision & priority tests ────────

describe('healBrokenImages — filename collision handling', () => {
  let clientDir;
  let outputDir;
  let htmlFilePath;

  before(() => {
    clientDir = path.join(tmpDir, 'clients', 'collision-test');
    outputDir = path.join(clientDir, 'output');
    const logoDir = path.join(clientDir, 'brand', 'assets', 'logos');
    fs.mkdirSync(outputDir, { recursive: true });
    fs.mkdirSync(logoDir, { recursive: true });

    // Create multiple similar logo files that could collide
    fs.writeFileSync(path.join(logoDir, 'my_logo.png'), 'fake-my-logo');
    fs.writeFileSync(path.join(logoDir, 'new_logo.png'), 'fake-new-logo');
    fs.writeFileSync(path.join(logoDir, 'old_logo.png'), 'fake-old-logo');

    htmlFilePath = path.join(outputDir, 'index.html');
  });

  it('returns unresolved for ambiguous fuzzy matches (multiple similar filenames)', () => {
    // "logo.png" would fuzzy-match my_logo.png, new_logo.png, and old_logo.png
    const html = '<img src="logo.png">';
    fs.writeFileSync(htmlFilePath, html);
    const result = healBrokenImages(html, htmlFilePath);
    assert.ok(result);
    assert.equal(result.fixes.length, 0);
    assert.deepEqual(result.unresolved, ['logo.png']);
  });
});

describe('healBrokenImages — exact match priority over fuzzy', () => {
  let clientDir;
  let outputDir;
  let htmlFilePath;

  before(() => {
    clientDir = path.join(tmpDir, 'clients', 'priority-test');
    outputDir = path.join(clientDir, 'output');
    const assetsDir = path.join(clientDir, 'brand', 'assets');
    fs.mkdirSync(outputDir, { recursive: true });
    fs.mkdirSync(assetsDir, { recursive: true });

    // Create an exact-match file and a fuzzy-match file
    fs.writeFileSync(path.join(assetsDir, 'banner.jpg'), 'fake-exact-banner');
    fs.writeFileSync(path.join(assetsDir, 'hero_banner.jpg'), 'fake-hero-banner');

    htmlFilePath = path.join(outputDir, 'index.html');
  });

  it('exact basename match takes priority over fuzzy substring match', () => {
    const html = '<img src="banner.jpg">';
    fs.writeFileSync(htmlFilePath, html);
    const result = healBrokenImages(html, htmlFilePath);
    assert.ok(result);
    assert.equal(result.fixes.length, 1);
    // The fix should point to banner.jpg (exact match), not hero_banner.jpg
    assert.ok(result.fixes[0].to.endsWith('banner.jpg'));
    assert.ok(!result.fixes[0].to.includes('hero_banner'));
  });
});

describe('healBrokenImages — hash-prefix match priority', () => {
  let clientDir;
  let outputDir;
  let htmlFilePath;

  before(() => {
    clientDir = path.join(tmpDir, 'clients', 'hash-priority-test');
    outputDir = path.join(clientDir, 'output');
    const assetsDir = path.join(clientDir, 'brand', 'assets');
    fs.mkdirSync(outputDir, { recursive: true });
    fs.mkdirSync(assetsDir, { recursive: true });

    // Create a hash-prefixed file and a fuzzy-match file
    fs.writeFileSync(path.join(assetsDir, 'abc123_headshot.jpg'), 'fake-hash-headshot');
    fs.writeFileSync(path.join(assetsDir, 'team_headshot.jpg'), 'fake-team-headshot');

    htmlFilePath = path.join(outputDir, 'index.html');
  });

  it('hash-prefix match resolves correctly for single match', () => {
    const html = '<img src="headshot.jpg">';
    fs.writeFileSync(htmlFilePath, html);
    const result = healBrokenImages(html, htmlFilePath);
    assert.ok(result);
    assert.equal(result.fixes.length, 1);
    // Should resolve to hash-prefixed asset (abc123_headshot.jpg)
    assert.ok(result.fixes[0].to.includes('abc123_headshot.jpg'));
  });
});

describe('healBrokenImages — ambiguous hash-prefix returns null', () => {
  let clientDir;
  let outputDir;
  let htmlFilePath;

  before(() => {
    clientDir = path.join(tmpDir, 'clients', 'hash-ambiguous-test');
    outputDir = path.join(clientDir, 'output');
    const assetsDir = path.join(clientDir, 'brand', 'assets');
    fs.mkdirSync(outputDir, { recursive: true });
    fs.mkdirSync(assetsDir, { recursive: true });

    // Create multiple hash-prefixed files with the same original name
    fs.writeFileSync(path.join(assetsDir, 'abc123_photo.jpg'), 'fake-photo-1');
    fs.writeFileSync(path.join(assetsDir, 'def456_photo.jpg'), 'fake-photo-2');

    htmlFilePath = path.join(outputDir, 'index.html');
  });

  it('returns unresolved when multiple hash-prefix matches exist', () => {
    const html = '<img src="photo.jpg">';
    fs.writeFileSync(htmlFilePath, html);
    const result = healBrokenImages(html, htmlFilePath);
    // Ambiguous — can't pick between abc123_photo.jpg and def456_photo.jpg
    assert.ok(result);
    assert.equal(result.fixes.length, 0);
    assert.deepEqual(result.unresolved, ['photo.jpg']);
  });
});

// ─── healBrandColors ─────────────────────────────────────

describe('healBrandColors', () => {
  it('returns null when no brand spec colors', () => {
    const result = healBrandColors('<h1>Hello</h1>', {});
    assert.equal(result, null);
  });

  it('returns null when brandSpec is null', () => {
    const result = healBrandColors('<h1>Hello</h1>', null);
    assert.equal(result, null);
  });

  it('returns null when all brand colors are already in Tailwind config', () => {
    const html = `<script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            brand: {
              primary: '#8B1A3A',
              gold: '#C9963A',
              champagne: '#F5E6D0',
              ivory: '#FAF5EE',
              charcoal: '#2C2C2C',
            }
          }
        }
      }
    }
    </script>
    <body style="background: #FAF5EE"><h1 style="color: #8B1A3A">Hello</h1></body>`;
    const result = healBrandColors(html, BRAND_SPEC);
    assert.equal(result, null);
  });

  it('injects missing brand colors into existing Tailwind config', () => {
    const html = `<script src="https://cdn.tailwindcss.com"></script>
    <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            brand: {
              primary: '#8B1A3A',
            }
          }
        }
      }
    }
    </script>
    <body><h1 style="color: #8B1A3A">Hello</h1></body>`;
    const result = healBrandColors(html, BRAND_SPEC);
    assert.ok(result);
    assert.equal(result.type, 'brand-colors');
    assert.ok(result.injectedColors.length > 0);
    // Should inject the missing colors (gold, champagne, ivory, charcoal)
    assert.ok(result.injectedColors.some(c => c.includes('#C9963A')));
  });

  it('creates Tailwind config when CDN present but no config exists', () => {
    const html = `<script src="https://cdn.tailwindcss.com"></script>
    <body><h1 style="color: #8B1A3A">Hello</h1></body>`;
    const result = healBrandColors(html, BRAND_SPEC);
    assert.ok(result);
    assert.ok(result.patched.includes('tailwind.config'));
    assert.ok(result.patched.includes('#8B1A3A'));
    assert.ok(result.patched.includes('#C9963A'));
  });

  it('fixes body background from white to brand ivory', () => {
    const html = `<script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            brand: {
              primary: '#8B1A3A',
              gold: '#C9963A',
              champagne: '#F5E6D0',
              ivory: '#FAF5EE',
              charcoal: '#2C2C2C',
            }
          }
        }
      }
    }
    </script>
    <style>body { background: #ffffff; color: #2C2C2C; }</style>
    <body><h1 style="color: #8B1A3A">Hello</h1></body>`;
    const result = healBrandColors(html, BRAND_SPEC);
    assert.ok(result);
    assert.ok(result.bodyBgFixed);
    assert.ok(result.patched.includes('#FAF5EE'));
    assert.ok(!result.patched.includes('background: #ffffff'));
  });

  it('fixes body background from generic gray to brand color', () => {
    const html = `<script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            brand: {
              primary: '#8B1A3A',
              gold: '#C9963A',
              champagne: '#F5E6D0',
              ivory: '#FAF5EE',
              charcoal: '#2C2C2C',
            }
          }
        }
      }
    }
    </script>
    <style>body { background: #f5f5f5; }</style>
    <body><h1 style="color: #8B1A3A">Hello</h1></body>`;
    const result = healBrandColors(html, BRAND_SPEC);
    assert.ok(result);
    assert.ok(result.bodyBgFixed);
  });

  it('flags missing primary color when it does not appear anywhere', () => {
    const html = `<script src="https://cdn.tailwindcss.com"></script>
    <body><h1 style="color: blue">Hello</h1></body>`;
    const result = healBrandColors(html, BRAND_SPEC);
    assert.ok(result);
    assert.ok(result.missingPrimary);
    assert.ok(result.description.includes('primary brand color missing'));
  });

  it('does not flag missing primary when hex is present', () => {
    const html = `<script src="https://cdn.tailwindcss.com"></script>
    <body><h1 style="color: #8b1a3a">Hello</h1></body>`;
    const result = healBrandColors(html, BRAND_SPEC);
    // Primary is present (case-insensitive), so missingPrimary should be false
    assert.ok(!result?.missingPrimary);
  });
});

// ─── healPlaceholderImages ───────────────────────────────

describe('healPlaceholderImages', () => {
  let brandAssetsDir;
  let photosDir;
  let logosDir;

  before(() => {
    brandAssetsDir = path.join(tmpDir, 'brand-assets-test');
    photosDir = path.join(brandAssetsDir, 'photos');
    logosDir = path.join(brandAssetsDir, 'logos');
    fs.mkdirSync(photosDir, { recursive: true });
    fs.mkdirSync(logosDir, { recursive: true });

    // Create test brand asset files
    fs.writeFileSync(path.join(photosDir, 'abc123_hero-photo.png'), 'fake-hero');
    fs.writeFileSync(path.join(photosDir, 'def456_team-shot.jpg'), 'fake-team');
    fs.writeFileSync(path.join(photosDir, 'ghi789_speaker-headshot.png'), 'fake-speaker');
    fs.writeFileSync(path.join(logosDir, 'aaa111_company-logo.svg'), '<svg></svg>');
    fs.writeFileSync(path.join(logosDir, 'bbb222_forbes.png'), 'fake-forbes-logo');
  });

  it('returns null when brandAssetsPath does not exist', () => {
    const html = '<img src="data:image/svg+xml,..." alt="photo">';
    const result = healPlaceholderImages(html, '/nonexistent/path');
    assert.equal(result, null);
  });

  it('returns null when brandAssetsPath is null', () => {
    const html = '<img src="data:image/svg+xml,..." alt="photo">';
    const result = healPlaceholderImages(html, null);
    assert.equal(result, null);
  });

  it('returns null when no SVG data URI images found', () => {
    const html = '<img src="photos/real-photo.jpg" alt="photo"><img src="https://placehold.co/800x600">';
    const result = healPlaceholderImages(html, brandAssetsDir);
    assert.equal(result, null);
  });

  it('replaces SVG data URI with real photo asset', () => {
    const svgDataUri = 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%22800%22%20height%3D%22600%22%3E%3Crect%20fill%3D%22%23ddd%22%20width%3D%22800%22%20height%3D%22600%22/%3E%3C/svg%3E';
    const html = `<img src="${svgDataUri}" alt="hero photo" width="800" height="600">`;
    const result = healPlaceholderImages(html, brandAssetsDir);
    assert.ok(result);
    assert.equal(result.type, 'placeholder-images');
    assert.ok(result.replacements.length === 1);
    assert.ok(result.patched.includes('photos/'));
    assert.ok(!result.patched.includes('data:image/svg+xml'));
  });

  it('matches logo slot to logos directory based on alt text', () => {
    const svgDataUri = 'data:image/svg+xml,%3Csvg%20width%3D%22200%22%20height%3D%2280%22%3E%3C/svg%3E';
    const html = `<img src="${svgDataUri}" alt="company logo" width="200" height="80" class="logo">`;
    const result = healPlaceholderImages(html, brandAssetsDir);
    assert.ok(result);
    assert.ok(result.replacements.length === 1);
    assert.ok(result.patched.includes('logos/'));
  });

  it('replaces multiple SVG data URIs in order', () => {
    const svgUri1 = 'data:image/svg+xml,%3Csvg%20width%3D%22800%22%20height%3D%22600%22%3E%3C/svg%3E';
    const svgUri2 = 'data:image/svg+xml,%3Csvg%20width%3D%22400%22%20height%3D%22400%22%3E%3C/svg%3E';
    const html = `<img src="${svgUri1}" alt="main photo"><img src="${svgUri2}" alt="second photo">`;
    const result = healPlaceholderImages(html, brandAssetsDir);
    assert.ok(result);
    assert.ok(result.replacements.length === 2);
    // Each replacement should use a different photo
    assert.notEqual(result.replacements[0].to, result.replacements[1].to);
  });

  it('uses alt text to match specific assets', () => {
    const svgUri = 'data:image/svg+xml,%3Csvg%20width%3D%22300%22%20height%3D%22100%22%3E%3C/svg%3E';
    const html = `<img src="${svgUri}" alt="forbes logo" class="logo-img">`;
    const result = healPlaceholderImages(html, brandAssetsDir);
    assert.ok(result);
    assert.ok(result.replacements[0].to.includes('forbes'));
  });

  it('does not touch non-SVG data URIs', () => {
    const html = '<img src="data:image/png;base64,iVBORw0KGgo=" alt="png placeholder">';
    const result = healPlaceholderImages(html, brandAssetsDir);
    assert.equal(result, null);
  });

  it('handles empty photos and logos directories', () => {
    const emptyAssetsDir = path.join(tmpDir, 'empty-brand-assets');
    fs.mkdirSync(path.join(emptyAssetsDir, 'photos'), { recursive: true });
    fs.mkdirSync(path.join(emptyAssetsDir, 'logos'), { recursive: true });
    const html = '<img src="data:image/svg+xml,%3Csvg%3E%3C/svg%3E" alt="test">';
    const result = healPlaceholderImages(html, emptyAssetsDir);
    assert.equal(result, null);
  });
});

// ─── detectPlaceholderText ───────────────────────────────

describe('detectPlaceholderText', () => {
  it('returns null when no placeholders found', () => {
    const html = makeHtml('<h1>Real Headline</h1><p>Real body copy about our product.</p>');
    const result = detectPlaceholderText(html);
    assert.equal(result, null);
  });

  it('detects Lorem ipsum text', () => {
    const html = makeHtml('<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>');
    const result = detectPlaceholderText(html);
    assert.ok(result);
    assert.equal(result.type, 'placeholder-text');
    assert.ok(result.locations.length > 0);
    assert.ok(result.locations.some(l => l.pattern === 'Lorem ipsum' || l.pattern === 'Lorem ipsum fragment'));
  });

  it('detects bracket placeholders', () => {
    const html = makeHtml('<h1>[Your Company Name]</h1><p>[Insert description here]</p>');
    const result = detectPlaceholderText(html);
    assert.ok(result);
    assert.ok(result.locations.some(l => l.pattern === 'Bracket placeholder'));
  });

  it('detects template variables', () => {
    const html = makeHtml('<h1>Welcome to {{company_name}}</h1>');
    const result = detectPlaceholderText(html);
    assert.ok(result);
    assert.ok(result.locations.some(l => l.pattern === 'Template variable'));
  });

  it('detects marker text (XXX, TODO, etc)', () => {
    const html = makeHtml('<p>TODO: add real content here</p>');
    const result = detectPlaceholderText(html);
    assert.ok(result);
    assert.ok(result.locations.some(l => l.pattern === 'Marker text'));
  });

  it('skips placeholders inside <script> tags', () => {
    const html = `<html><head><script>const x = 'Lorem ipsum';</script></head>
<body><p>Real content here that is fine.</p></body></html>`;
    const result = detectPlaceholderText(html);
    assert.equal(result, null);
  });

  it('skips placeholders inside <style> tags', () => {
    const html = `<html><head><style>/* TODO: add theme */</style></head>
<body><p>Real content here that is fine.</p></body></html>`;
    const result = detectPlaceholderText(html);
    assert.equal(result, null);
  });

  it('includes line number and context', () => {
    const html = '<html><body>\n<p>This is line 2</p>\n<p>Lorem ipsum text</p>\n</body></html>';
    const result = detectPlaceholderText(html);
    assert.ok(result);
    const loc = result.locations[0];
    assert.ok(typeof loc.line === 'number');
    assert.ok(loc.line > 0);
    assert.ok(loc.context.length > 0);
  });
});

// ─── detectMissingSections ───────────────────────────────

describe('detectMissingSections', () => {
  it('returns null when no validation errors', () => {
    assert.equal(detectMissingSections(null), null);
    assert.equal(detectMissingSections([]), null);
    assert.equal(detectMissingSections(undefined), null);
  });

  it('returns null when no missing-section errors', () => {
    const errors = [
      { type: 'wrong-font', message: 'Wrong font used' },
      { type: 'broken-image', message: 'Image not found' },
    ];
    const result = detectMissingSections(errors);
    assert.equal(result, null);
  });

  it('extracts missing section names', () => {
    const errors = [
      { type: 'missing-section', message: 'Missing testimonials section', section: 'testimonials' },
      { type: 'missing-section', message: 'Missing footer section', section: 'footer' },
    ];
    const result = detectMissingSections(errors);
    assert.ok(result);
    assert.equal(result.type, 'missing-sections');
    assert.deepEqual(result.sections, ['testimonials', 'footer']);
  });

  it('falls back to message when section field is absent', () => {
    const errors = [
      { type: 'missing-section', message: 'Hero section is missing' },
    ];
    const result = detectMissingSections(errors);
    assert.ok(result);
    assert.deepEqual(result.sections, ['Hero section is missing']);
  });
});

// ─── selfHeal (integration) ─────────────────────────────

describe('selfHeal', () => {
  it('returns healed=false and a prompt for missing file', async () => {
    const result = await selfHeal('/nonexistent/path/index.html', BRAND_SPEC, []);
    assert.equal(result.healed, false);
    assert.equal(result.fixes.length, 0);
    assert.ok(result.prompt.includes('File not found'));
  });

  it('auto-fixes missing Tailwind and returns healed=true', async () => {
    const html = makeHtml('<h1>Hello World</h1>', { tailwind: false });
    const filePath = writeHtml('clients/heal-tw/output/index.html', html);
    const result = await selfHeal(filePath, BRAND_SPEC, []);
    assert.ok(result.fixes.some(f => f.type === 'missing-tailwind'));

    // Verify file was written
    const fixed = fs.readFileSync(filePath, 'utf-8');
    assert.ok(fixed.includes('cdn.tailwindcss.com'));
  });

  it('auto-fixes wrong fonts and returns healed=true', async () => {
    const html = makeHtml('<p style="font-family: Arial, sans-serif">Text</p>');
    const filePath = writeHtml('clients/heal-font/output/index.html', html);
    const result = await selfHeal(filePath, BRAND_SPEC, []);
    assert.ok(result.fixes.some(f => f.type === 'wrong-fonts'));

    const fixed = fs.readFileSync(filePath, 'utf-8');
    assert.ok(fixed.includes('Montserrat'));
  });

  it('flags placeholder text and returns healed=false with prompt', async () => {
    const html = makeHtml('<h1>Lorem ipsum dolor sit amet</h1><p>consectetur adipiscing elit</p>');
    const filePath = writeHtml('clients/heal-placeholder/output/index.html', html);
    const result = await selfHeal(filePath, BRAND_SPEC, []);
    assert.equal(result.healed, false);
    assert.ok(result.prompt.includes('Placeholder Text'));
  });

  it('handles missing sections from validation errors', async () => {
    const html = makeHtml('<section><h1>Hero</h1></section>');
    const filePath = writeHtml('clients/heal-sections/output/index.html', html);
    const errors = [
      { type: 'missing-section', section: 'testimonials', message: 'Missing testimonials' },
      { type: 'missing-section', section: 'pricing', message: 'Missing pricing' },
    ];
    const result = await selfHeal(filePath, BRAND_SPEC, errors);
    assert.equal(result.healed, false);
    assert.ok(result.prompt.includes('testimonials'));
    assert.ok(result.prompt.includes('pricing'));
    assert.ok(result.prompt.includes('Missing Sections'));
  });

  it('returns healed=true when only auto-fixable issues exist', async () => {
    // Page missing Tailwind but uses brand primary color in styles (only auto-fixable issues)
    const html = makeHtml('<h1 style="color: #8B1A3A">Clean Page</h1><p>No issues here at all.</p>', { tailwind: false });
    const filePath = writeHtml('clients/heal-clean/output/index.html', html);
    const result = await selfHeal(filePath, BRAND_SPEC, []);
    assert.equal(result.healed, true);
    assert.ok(result.fixes.length > 0);
    assert.equal(result.prompt, '');
  });

  it('returns healed=true and empty prompt when page is perfect', async () => {
    // A truly perfect page already has brand colors in Tailwind config
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Test Page</title>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond&family=Montserrat&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: { extend: { colors: { brand: {
        primary: '#8B1A3A', gold: '#C9963A', champagne: '#F5E6D0', ivory: '#FAF5EE', charcoal: '#2C2C2C'
      }}}}
    }
  </script>
</head>
<body style="background: #FAF5EE">
<h1 style="color: #8B1A3A">Perfect Page</h1><p>No issues at all in this page.</p>
</body>
</html>`;
    const filePath = writeHtml('clients/heal-perfect/output/index.html', html);
    const result = await selfHeal(filePath, BRAND_SPEC, []);
    // No fixes needed, no issues
    assert.equal(result.fixes.length, 0);
    assert.equal(result.prompt, '');
  });

  it('combines multiple auto-fixes in a single pass', async () => {
    const html = `<!DOCTYPE html>
<html><head><title>Test</title></head>
<body>
  <p style="font-family: Roboto, sans-serif">Wrong font text here.</p>
</body></html>`;
    const filePath = writeHtml('clients/heal-multi/output/index.html', html);
    const result = await selfHeal(filePath, BRAND_SPEC, []);
    // Should fix both missing tailwind and wrong fonts
    assert.ok(result.fixes.some(f => f.type === 'missing-tailwind'));
    assert.ok(result.fixes.some(f => f.type === 'wrong-fonts'));

    const fixed = fs.readFileSync(filePath, 'utf-8');
    assert.ok(fixed.includes('cdn.tailwindcss.com'));
    assert.ok(fixed.includes('Montserrat'));
  });

  it('includes brand spec in the prompt', async () => {
    const html = makeHtml('<p>Lorem ipsum dolor sit amet content here.</p>');
    const filePath = writeHtml('clients/heal-brand-prompt/output/index.html', html);
    const result = await selfHeal(filePath, BRAND_SPEC, []);
    assert.ok(result.prompt.includes('Cormorant Garamond'));
    assert.ok(result.prompt.includes('Montserrat'));
    assert.ok(result.prompt.includes('#8B1A3A'));
  });

  it('returns unresolvedImages array with unresolved image paths', async () => {
    // Set up a client with brand/assets/ but no matching files for the referenced image
    const clientDir = path.join(tmpDir, 'clients', 'heal-unresolved');
    const outputDir = path.join(clientDir, 'output');
    const assetsDir = path.join(clientDir, 'brand', 'assets');
    fs.mkdirSync(outputDir, { recursive: true });
    fs.mkdirSync(assetsDir, { recursive: true });
    // Create one asset that won't match
    fs.writeFileSync(path.join(assetsDir, 'abc123_hero.jpg'), 'fake');

    const html = makeHtml('<img src="nonexistent-photo.png"><img src="missing-banner.webp">');
    const filePath = path.join(outputDir, 'index.html');
    fs.writeFileSync(filePath, html, 'utf-8');

    const result = await selfHeal(filePath, BRAND_SPEC, []);
    assert.ok(Array.isArray(result.unresolvedImages));
    assert.equal(result.unresolvedImages.length, 2);
    assert.ok(result.unresolvedImages.includes('nonexistent-photo.png'));
    assert.ok(result.unresolvedImages.includes('missing-banner.webp'));
  });

  it('returns healed=false when there are unresolved images even with auto-fixes', async () => {
    // Set up a client with brand/assets/ that has one matching and one non-matching
    const clientDir = path.join(tmpDir, 'clients', 'heal-partial-resolve');
    const outputDir = path.join(clientDir, 'output');
    const assetsDir = path.join(clientDir, 'brand', 'assets');
    fs.mkdirSync(outputDir, { recursive: true });
    fs.mkdirSync(assetsDir, { recursive: true });
    fs.writeFileSync(path.join(assetsDir, 'abc123_hero.jpg'), 'fake');

    const html = makeHtml('<img src="hero.jpg"><img src="totally-unknown.png">', { tailwind: false });
    const filePath = path.join(outputDir, 'index.html');
    fs.writeFileSync(filePath, html, 'utf-8');

    const result = await selfHeal(filePath, BRAND_SPEC, []);
    // Has auto-fixes (tailwind + broken image fix) but also unresolved images
    assert.equal(result.healed, false);
    assert.ok(result.unresolvedImages.length > 0);
    assert.ok(result.unresolvedImages.includes('totally-unknown.png'));
  });

  it('returns empty unresolvedImages when all images resolve', async () => {
    const html = makeHtml('<h1>No broken images</h1>');
    const filePath = writeHtml('clients/heal-no-unresolved/output/index.html', html);
    const result = await selfHeal(filePath, BRAND_SPEC, []);
    assert.ok(Array.isArray(result.unresolvedImages));
    assert.equal(result.unresolvedImages.length, 0);
  });

  it('returns unresolvedImages in file-not-found case', async () => {
    const result = await selfHeal('/nonexistent/path/index.html', BRAND_SPEC, []);
    assert.ok(Array.isArray(result.unresolvedImages));
    assert.equal(result.unresolvedImages.length, 0);
  });
});

// ─── buildPrompt (unresolved images) ────────────────────

describe('buildPrompt', () => {
  it('includes unresolved images section in output', () => {
    const issues = [];
    const unresolvedImages = ['photos/missing-hero.jpg', 'icons/unknown.svg'];
    const result = buildPrompt(issues, '/test/index.html', null, unresolvedImages);
    assert.ok(result.includes('Unresolved Images'));
    assert.ok(result.includes('photos/missing-hero.jpg'));
    assert.ok(result.includes('icons/unknown.svg'));
  });

  it('returns empty string when no issues and no unresolved images', () => {
    const result = buildPrompt([], '/test/index.html', null, []);
    assert.equal(result, '');
  });

  it('returns empty string when unresolvedImages is undefined', () => {
    const result = buildPrompt([], '/test/index.html', null, undefined);
    assert.equal(result, '');
  });

  it('includes both issues and unresolved images', () => {
    const issues = [{
      type: 'placeholder-text',
      locations: [{ line: 5, matched: 'Lorem ipsum', pattern: 'Lorem ipsum', context: '<p>Lorem ipsum</p>' }],
    }];
    const unresolvedImages = ['bg-pattern.png'];
    const result = buildPrompt(issues, '/test/index.html', BRAND_SPEC, unresolvedImages);
    assert.ok(result.includes('Placeholder Text'));
    assert.ok(result.includes('Unresolved Images'));
    assert.ok(result.includes('bg-pattern.png'));
    assert.ok(result.includes('Cormorant Garamond'));
  });
});

// ─── recoverHTML ─────────────────────────────────────────

describe('recoverHTML', () => {
  it('returns recovered: false for empty HTML', () => {
    const result = recoverHTML('', BRAND_SPEC);
    assert.equal(result.recovered, false);
    assert.equal(result.html, '');
    assert.ok(result.issues.length > 0);
  });

  it('returns recovered: false for HTML shorter than 50 characters', () => {
    const result = recoverHTML('<p>Short</p>', BRAND_SPEC);
    assert.equal(result.recovered, false);
    assert.ok(result.issues[0].includes('too short'));
  });

  it('returns recovered: false for null/undefined input', () => {
    const result = recoverHTML(null, BRAND_SPEC);
    assert.equal(result.recovered, false);
    assert.equal(result.html, '');
  });

  it('returns recovered: false when HTML is already valid', () => {
    const html = makeHtml('<section><h1>Valid Page</h1><p>This is a properly structured page.</p></section>');
    const result = recoverHTML(html, BRAND_SPEC);
    assert.equal(result.recovered, false);
    assert.equal(result.issues.length, 0);
  });

  it('recovers HTML missing DOCTYPE', () => {
    const html = `<html lang="en"><head><meta charset="UTF-8"><title>Test</title></head>
<body><section><h1>Hello World</h1><p>Content goes here in this paragraph that needs enough chars.</p></section></body></html>`;
    const result = recoverHTML(html, BRAND_SPEC);
    assert.equal(result.recovered, true);
    assert.ok(result.html.includes('<!DOCTYPE html>'));
    assert.ok(result.issues.some(i => i.includes('DOCTYPE')));
  });

  it('recovers HTML missing body tag', () => {
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Test</title></head>
<section><h1>Hello World</h1><p>Some content that is long enough to be recovered by the system.</p></section></html>`;
    const result = recoverHTML(html, BRAND_SPEC);
    assert.equal(result.recovered, true);
    assert.ok(result.html.includes('<body>'));
    assert.ok(result.html.includes('</body>'));
    assert.ok(result.issues.some(i => i.includes('body')));
  });

  it('wraps raw text in section elements when no content blocks exist', () => {
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Test</title></head>
<body><h1>Just a heading</h1><p>And a paragraph without any section or div wrapper around it all.</p></body></html>`;
    const result = recoverHTML(html, BRAND_SPEC);
    assert.equal(result.recovered, true);
    assert.ok(result.html.includes('<section>'));
    assert.ok(result.issues.some(i => i.toLowerCase().includes('section')));
  });

  it('preserves <style> blocks from original HTML', () => {
    const html = `<style>.hero { background: red; }</style>
<h1>Broken page</h1><p>This is content from a broken page that had styles defined inline in a style block.</p>`;
    const result = recoverHTML(html, BRAND_SPEC);
    assert.equal(result.recovered, true);
    assert.ok(result.html.includes('.hero { background: red; }'));
  });

  it('preserves <script> blocks from original HTML', () => {
    const html = `<script>console.log("hello world from the page");</script>
<h1>Broken page</h1><p>This is content from a page that had scripts which we want to preserve in the output.</p>`;
    const result = recoverHTML(html, BRAND_SPEC);
    assert.equal(result.recovered, true);
    assert.ok(result.html.includes('console.log("hello world from the page")'));
  });

  it('includes Tailwind CDN in recovered output', () => {
    const html = `<h1>No structure at all just a heading</h1><p>And some body text that makes up the full content of this partially generated page.</p>`;
    const result = recoverHTML(html, BRAND_SPEC);
    assert.equal(result.recovered, true);
    assert.ok(result.html.includes('cdn.tailwindcss.com'));
  });

  it('includes brand fonts in recovered output', () => {
    const html = `<h1>Missing everything except content</h1><p>A paragraph of text long enough to pass the minimum character threshold for recovery.</p>`;
    const result = recoverHTML(html, BRAND_SPEC);
    assert.equal(result.recovered, true);
    assert.ok(result.html.includes('Cormorant+Garamond'));
    assert.ok(result.html.includes('Montserrat'));
  });

  it('works with null brandConfig', () => {
    const html = `<h1>Missing everything, no brand config at all</h1><p>Still needs to produce a valid HTML5 skeleton for this recovered content.</p>`;
    const result = recoverHTML(html, null);
    assert.equal(result.recovered, true);
    assert.ok(result.html.includes('<!DOCTYPE html>'));
    assert.ok(result.html.includes('<body>'));
    // No font link should be present
    assert.ok(!result.html.includes('fonts.googleapis.com'));
  });

  it('returns the correct shape: { recovered, html, issues }', () => {
    const html = `<h1>Some content that is broken and missing all structural HTML tags but has enough text to recover.</h1>`;
    const result = recoverHTML(html, BRAND_SPEC);
    assert.ok('recovered' in result);
    assert.ok('html' in result);
    assert.ok('issues' in result);
    assert.ok(Array.isArray(result.issues));
    assert.equal(typeof result.recovered, 'boolean');
    assert.equal(typeof result.html, 'string');
  });
});
