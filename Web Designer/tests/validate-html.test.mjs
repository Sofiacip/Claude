import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateHTML } from '../utils/validate-html.mjs';

// ─── Helpers ────────────────────────────────────────────

/** Minimal valid HTML page */
function validPage(body = '<section><h1>Hello</h1></section>') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond&family=Montserrat&display=swap" rel="stylesheet">
</head>
<body>${body}</body>
</html>`;
}

function hasError(result, rule) {
  return result.errors.some(e => e.rule === rule);
}

function hasWarning(result, rule) {
  return result.warnings.some(e => e.rule === rule);
}

function errorMessage(result, rule) {
  return result.errors.find(e => e.rule === rule)?.message ?? '';
}

function warningMessage(result, rule) {
  return result.warnings.find(e => e.rule === rule)?.message ?? '';
}

// ─── Tests ──────────────────────────────────────────────

describe('validateHTML', () => {

  describe('valid HTML', () => {
    it('returns valid for a well-formed page', () => {
      const result = validateHTML(validPage());
      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
    });

    it('returns the correct shape', () => {
      const result = validateHTML(validPage());
      assert.ok(Array.isArray(result.errors));
      assert.ok(Array.isArray(result.warnings));
      assert.equal(typeof result.valid, 'boolean');
    });
  });

  describe('doctype', () => {
    it('errors when DOCTYPE is missing', () => {
      const html = '<html><head><script src="https://cdn.tailwindcss.com"></script></head><body><section>Hi</section></body></html>';
      const result = validateHTML(html);
      assert.ok(hasError(result, 'doctype'));
      assert.equal(result.valid, false);
    });

    it('passes with case-insensitive DOCTYPE', () => {
      const html = '<!doctype html><html><head><script src="https://cdn.tailwindcss.com"></script></head><body><section>Hi</section></body></html>';
      const result = validateHTML(html);
      assert.ok(!hasError(result, 'doctype'));
    });
  });

  describe('structure tags', () => {
    it('errors when <html> tag is missing', () => {
      const html = '<!DOCTYPE html><head><script src="https://cdn.tailwindcss.com"></script></head><body><section>Hi</section></body>';
      const result = validateHTML(html);
      assert.ok(hasError(result, 'structure'));
      assert.ok(errorMessage(result, 'structure').includes('<html>'));
    });

    it('errors when <head> tag is missing', () => {
      const html = '<!DOCTYPE html><html><script src="https://cdn.tailwindcss.com"></script><body><section>Hi</section></body></html>';
      const result = validateHTML(html);
      assert.ok(hasError(result, 'structure'));
      assert.ok(errorMessage(result, 'structure').includes('<head>'));
    });

    it('errors when <body> tag is missing', () => {
      const html = '<!DOCTYPE html><html><head><script src="https://cdn.tailwindcss.com"></script></head><section>Hi</section></html>';
      const result = validateHTML(html);
      assert.ok(hasError(result, 'structure'));
      assert.ok(errorMessage(result, 'structure').includes('<body>'));
    });

    it('passes with attributes on structure tags', () => {
      const html = '<!DOCTYPE html><html lang="en"><head><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-white"><section>Hi</section></body></html>';
      const result = validateHTML(html);
      assert.ok(!hasError(result, 'structure'));
    });
  });

  describe('tailwind CDN', () => {
    it('errors when Tailwind CDN is missing', () => {
      const html = '<!DOCTYPE html><html><head></head><body><section>Hi</section></body></html>';
      const result = validateHTML(html);
      assert.ok(hasError(result, 'tailwind'));
    });

    it('passes with Tailwind CDN present', () => {
      const result = validateHTML(validPage());
      assert.ok(!hasError(result, 'tailwind'));
    });
  });

  describe('content blocks', () => {
    it('errors when no content blocks are found', () => {
      const html = '<!DOCTYPE html><html><head><script src="https://cdn.tailwindcss.com"></script></head><body><p>Just a paragraph</p></body></html>';
      const result = validateHTML(html);
      assert.ok(hasError(result, 'content'));
    });

    it('passes with <section> tag', () => {
      const result = validateHTML(validPage('<section>Content</section>'));
      assert.ok(!hasError(result, 'content'));
    });

    it('passes with <main> tag', () => {
      const result = validateHTML(validPage('<main>Content</main>'));
      assert.ok(!hasError(result, 'content'));
    });

    it('passes with <article> tag', () => {
      const result = validateHTML(validPage('<article>Content</article>'));
      assert.ok(!hasError(result, 'content'));
    });

    it('passes with <div> tag', () => {
      const result = validateHTML(validPage('<div>Content</div>'));
      assert.ok(!hasError(result, 'content'));
    });
  });

  describe('placeholder text', () => {
    it('warns on Lorem ipsum', () => {
      const result = validateHTML(validPage('<section>Lorem ipsum dolor sit amet</section>'));
      assert.ok(hasWarning(result, 'placeholder'));
    });

    it('warns on [Your text here]', () => {
      const result = validateHTML(validPage('<section>[Your text here]</section>'));
      assert.ok(hasWarning(result, 'placeholder'));
    });

    it('warns on [placeholder]', () => {
      const result = validateHTML(validPage('<section>[placeholder text]</section>'));
      assert.ok(hasWarning(result, 'placeholder'));
    });

    it('warns on TODO', () => {
      const result = validateHTML(validPage('<section>TODO fix this later</section>'));
      assert.ok(hasWarning(result, 'placeholder'));
    });

    it('warns on {{ handlebars }}', () => {
      const result = validateHTML(validPage('<section>{{company_name}}</section>'));
      assert.ok(hasWarning(result, 'placeholder'));
    });

    it('warns on [INSERT text]', () => {
      const result = validateHTML(validPage('<section>[INSERT your headline]</section>'));
      assert.ok(hasWarning(result, 'placeholder'));
    });

    it('warns on [REPLACE ...]', () => {
      const result = validateHTML(validPage('<section>[REPLACE with real content]</section>'));
      assert.ok(hasWarning(result, 'placeholder'));
    });

    it('does not warn on normal text', () => {
      const result = validateHTML(validPage('<section>Welcome to our amazing course</section>'));
      assert.ok(!hasWarning(result, 'placeholder'));
    });

    it('placeholder warnings do not make result invalid', () => {
      const result = validateHTML(validPage('<section>Lorem ipsum content</section>'));
      assert.equal(result.valid, true);
      assert.ok(result.warnings.length > 0);
    });
  });

  describe('image sources', () => {
    it('passes for absolute URLs', () => {
      const result = validateHTML(validPage('<section><img src="https://placehold.co/400x300" alt="test"></section>'));
      assert.ok(!hasError(result, 'img-src'));
      assert.ok(!hasWarning(result, 'img-src'));
    });

    it('passes for data URIs', () => {
      const result = validateHTML(validPage('<section><img src="data:image/png;base64,abc123" alt="test"></section>'));
      assert.ok(!hasError(result, 'img-src'));
    });

    it('errors on empty src', () => {
      const result = validateHTML(validPage('<section><img src="" alt="test"></section>'));
      assert.ok(hasError(result, 'img-src'));
      assert.ok(errorMessage(result, 'img-src').includes('empty'));
    });

    it('warns on relative paths', () => {
      const result = validateHTML(validPage('<section><img src="photos/hero.jpg" alt="hero"></section>'));
      assert.ok(hasWarning(result, 'img-src'));
      assert.ok(warningMessage(result, 'img-src').includes('photos/hero.jpg'));
    });

    it('warns on paths starting with /', () => {
      const result = validateHTML(validPage('<section><img src="/images/logo.png" alt="logo"></section>'));
      assert.ok(hasWarning(result, 'img-src'));
    });

    it('warns on paths starting with ./', () => {
      const result = validateHTML(validPage('<section><img src="./assets/bg.jpg" alt="bg"></section>'));
      assert.ok(hasWarning(result, 'img-src'));
    });

    it('checks multiple images', () => {
      const body = `<section>
        <img src="https://placehold.co/200x200" alt="ok">
        <img src="" alt="bad">
        <img src="local.jpg" alt="relative">
      </section>`;
      const result = validateHTML(validPage(body));
      assert.ok(hasError(result, 'img-src'));
      assert.ok(hasWarning(result, 'img-src'));
    });
  });

  describe('CSS url() detection', () => {
    it('warns on empty url() in <style> block', () => {
      const body = `<style>.hero { background-image: url(); }</style><section>Content</section>`;
      const result = validateHTML(validPage(body));
      assert.ok(hasWarning(result, 'css-url'));
      assert.ok(warningMessage(result, 'css-url').includes('empty'));
    });

    it('warns on url with empty single quotes in <style> block', () => {
      const body = `<style>.hero { background-image: url(''); }</style><section>Content</section>`;
      const result = validateHTML(validPage(body));
      assert.ok(hasWarning(result, 'css-url'));
      assert.ok(warningMessage(result, 'css-url').includes('empty'));
    });

    it('warns on url with empty double quotes in <style> block', () => {
      const body = `<style>.hero { background-image: url(""); }</style><section>Content</section>`;
      const result = validateHTML(validPage(body));
      assert.ok(hasWarning(result, 'css-url'));
      assert.ok(warningMessage(result, 'css-url').includes('empty'));
    });

    it('warns on placeholder domain in <style> block', () => {
      const body = `<style>.bg { background: url('https://example.com/img.jpg'); }</style><section>Content</section>`;
      const result = validateHTML(validPage(body));
      assert.ok(hasWarning(result, 'css-url'));
      assert.ok(warningMessage(result, 'css-url').includes('placeholder domain'));
    });

    it('warns on placeholder filename in inline style', () => {
      const body = `<section style="background: url(placeholder.jpg)">Content</section>`;
      const result = validateHTML(validPage(body));
      assert.ok(hasWarning(result, 'css-url'));
      assert.ok(warningMessage(result, 'css-url').includes('placeholder'));
    });

    it('passes for valid absolute URL in <style> block', () => {
      const body = `<style>.hero { background-image: url('https://cdn.example.com/img.jpg'); }</style><section>Content</section>`;
      const result = validateHTML(validPage(body));
      assert.ok(!hasWarning(result, 'css-url'));
    });

    it('passes for valid absolute URL in inline style', () => {
      const body = `<section style="background-image: url('https://cdn.mysite.com/hero.jpg')">Content</section>`;
      const result = validateHTML(validPage(body));
      assert.ok(!hasWarning(result, 'css-url'));
    });

    it('passes for data URI in CSS', () => {
      const body = `<style>.bg { background: url('data:image/svg+xml,<svg></svg>'); }</style><section>Content</section>`;
      const result = validateHTML(validPage(body));
      assert.ok(!hasWarning(result, 'css-url'));
    });

    it('detects url() without quotes in <style> block', () => {
      const body = `<style>.hero { background-image: url(https://example.com/bg.png); }</style><section>Content</section>`;
      const result = validateHTML(validPage(body));
      assert.ok(hasWarning(result, 'css-url'));
      assert.ok(warningMessage(result, 'css-url').includes('placeholder domain'));
    });

    it('warns on placehold.co domain in CSS', () => {
      const body = `<style>.card { background: url('https://placehold.co/800x400'); }</style><section>Content</section>`;
      const result = validateHTML(validPage(body));
      assert.ok(hasWarning(result, 'css-url'));
    });

    it('css-url warnings do not make result invalid', () => {
      const body = `<style>.hero { background-image: url(); }</style><section>Content</section>`;
      const result = validateHTML(validPage(body));
      assert.equal(result.valid, true);
      assert.ok(result.warnings.length > 0);
    });
  });

  describe('google fonts', () => {
    it('skips check when no brandFonts provided', () => {
      const result = validateHTML(validPage());
      assert.ok(!hasError(result, 'google-fonts'));
      assert.ok(!hasWarning(result, 'google-fonts'));
    });

    it('errors when Google Fonts link is missing but fonts are expected', () => {
      const html = '<!DOCTYPE html><html><head><script src="https://cdn.tailwindcss.com"></script></head><body><section>Hi</section></body></html>';
      const result = validateHTML(html, { brandFonts: ['Montserrat'] });
      assert.ok(hasError(result, 'google-fonts'));
      assert.ok(errorMessage(result, 'google-fonts').includes('Montserrat'));
    });

    it('passes when all brand fonts are present in the link', () => {
      const result = validateHTML(validPage(), {
        brandFonts: ['Cormorant Garamond', 'Montserrat'],
      });
      assert.ok(!hasError(result, 'google-fonts'));
      assert.ok(!hasWarning(result, 'google-fonts'));
    });

    it('warns when a brand font is missing from the link', () => {
      const result = validateHTML(validPage(), {
        brandFonts: ['Cormorant Garamond', 'Montserrat', 'Playfair Display'],
      });
      assert.ok(!hasError(result, 'google-fonts'));
      assert.ok(hasWarning(result, 'google-fonts'));
      assert.ok(warningMessage(result, 'google-fonts').includes('Playfair Display'));
    });

    it('font name matching is case-insensitive', () => {
      const result = validateHTML(validPage(), {
        brandFonts: ['cormorant garamond'],
      });
      assert.ok(!hasWarning(result, 'google-fonts'));
    });
  });

  describe('file size', () => {
    it('passes for small files', () => {
      const result = validateHTML(validPage());
      assert.ok(!hasError(result, 'file-size'));
      assert.ok(!hasWarning(result, 'file-size'));
    });

    it('warns when size exceeds warning threshold', () => {
      const padding = 'x'.repeat(600 * 1024);
      const html = validPage(`<section><!-- ${padding} --></section>`);
      const result = validateHTML(html);
      assert.ok(hasWarning(result, 'file-size'));
      assert.ok(!hasError(result, 'file-size'));
    });

    it('errors when size exceeds error threshold', () => {
      const padding = 'x'.repeat(2.5 * 1024 * 1024);
      const html = validPage(`<section><!-- ${padding} --></section>`);
      const result = validateHTML(html);
      assert.ok(hasError(result, 'file-size'));
      assert.equal(result.valid, false);
    });

    it('respects custom size thresholds', () => {
      const html = validPage('<section>' + 'a'.repeat(200) + '</section>');
      const result = validateHTML(html, { maxWarnSize: 100, maxErrorSize: 1000 });
      assert.ok(hasWarning(result, 'file-size'));
      assert.ok(!hasError(result, 'file-size'));
    });

    it('custom error threshold triggers error', () => {
      const html = validPage('<section>' + 'a'.repeat(2000) + '</section>');
      const result = validateHTML(html, { maxWarnSize: 100, maxErrorSize: 500 });
      assert.ok(hasError(result, 'file-size'));
    });
  });

  describe('combined validation', () => {
    it('reports multiple errors at once', () => {
      const html = '<p>just text</p>';
      const result = validateHTML(html);
      assert.equal(result.valid, false);
      assert.ok(result.errors.length >= 3); // doctype, structure (html/head/body), tailwind, content
    });

    it('errors and warnings are independent', () => {
      // Valid structure but with placeholder text
      const result = validateHTML(validPage('<section>Lorem ipsum content here</section>'));
      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
      assert.ok(result.warnings.length > 0);
    });
  });

  // ─── Brand compliance checks ───────────────────────────

  describe('brand colors', () => {
    it('skips check when brandColors is not provided', () => {
      const result = validateHTML(validPage());
      assert.ok(!hasError(result, 'brand-colors'));
      assert.ok(!hasWarning(result, 'brand-colors'));
    });

    it('passes when all brand colors are present', () => {
      const body = `<section style="color: #8B1A3A; background: #C9963A;">Content</section>`;
      const result = validateHTML(validPage(body), {
        brandColors: { primary: '#8B1A3A', secondary: '#C9963A' },
      });
      assert.ok(!hasError(result, 'brand-colors'));
    });

    it('errors when primary color is missing', () => {
      const result = validateHTML(validPage('<section>No colors</section>'), {
        brandColors: { primary: '#8B1A3A' },
      });
      assert.ok(hasError(result, 'brand-colors'));
      assert.ok(errorMessage(result, 'brand-colors').includes('#8B1A3A'));
    });

    it('errors when secondary color is missing', () => {
      const result = validateHTML(validPage('<section>No colors</section>'), {
        brandColors: { secondary: '#C9963A' },
      });
      assert.ok(hasError(result, 'brand-colors'));
    });

    it('warns when accent color is missing (not primary/secondary)', () => {
      const body = `<section style="color: #8B1A3A;">Content</section>`;
      const result = validateHTML(validPage(body), {
        brandColors: { primary: '#8B1A3A', accent: '#E8C4B0' },
      });
      assert.ok(!hasError(result, 'brand-colors'));
      assert.ok(hasWarning(result, 'brand-colors'));
      assert.ok(warningMessage(result, 'brand-colors').includes('#E8C4B0'));
    });

    it('matching is case-insensitive', () => {
      const body = `<section style="color: #8b1a3a;">Content</section>`;
      const result = validateHTML(validPage(body), {
        brandColors: { primary: '#8B1A3A' },
      });
      assert.ok(!hasError(result, 'brand-colors'));
    });

    it('detects colors in Tailwind config', () => {
      const body = `<script>tailwind.config = { theme: { colors: { brand: '#FF5733' } } }</script><section>Content</section>`;
      const result = validateHTML(validPage(body), {
        brandColors: { primary: '#FF5733' },
      });
      assert.ok(!hasError(result, 'brand-colors'));
    });
  });

  describe('brand fonts', () => {
    it('skips check when brandFontSpec is not provided', () => {
      const result = validateHTML(validPage());
      assert.ok(!hasError(result, 'brand-fonts'));
    });

    it('passes when both heading and body fonts are present', () => {
      const body = `<style>h1 { font-family: 'Cormorant Garamond', serif; } p { font-family: Montserrat, sans-serif; }</style><section>Hi</section>`;
      const result = validateHTML(validPage(body), {
        brandFontSpec: { heading: 'Cormorant Garamond', body: 'Montserrat' },
      });
      assert.ok(!hasError(result, 'brand-fonts'));
    });

    it('errors when heading font is missing', () => {
      const body = `<style>p { font-family: Montserrat; }</style><section>Hi</section>`;
      const result = validateHTML(validPage(body), {
        brandFontSpec: { heading: 'Playfair Display', body: 'Montserrat' },
      });
      assert.ok(hasError(result, 'brand-fonts'));
      assert.ok(errorMessage(result, 'brand-fonts').includes('Playfair Display'));
    });

    it('errors when body font is missing', () => {
      const body = `<style>h1 { font-family: 'Cormorant Garamond'; }</style><section>Hi</section>`;
      const result = validateHTML(validPage(body), {
        brandFontSpec: { heading: 'Cormorant Garamond', body: 'Lato' },
      });
      assert.ok(hasError(result, 'brand-fonts'));
      assert.ok(errorMessage(result, 'brand-fonts').includes('Lato'));
    });

    it('detects fonts in Tailwind config', () => {
      const body = `<script>tailwind.config = { theme: { fontFamily: { display: ['"Cormorant Garamond"'] } } }</script><section>Hi</section>`;
      const result = validateHTML(validPage(body), {
        brandFontSpec: { heading: 'Cormorant Garamond' },
      });
      assert.ok(!hasError(result, 'brand-fonts'));
    });

    it('matching is case-insensitive', () => {
      const body = `<style>h1 { font-family: 'cormorant garamond'; }</style><section>Hi</section>`;
      const result = validateHTML(validPage(body), {
        brandFontSpec: { heading: 'Cormorant Garamond' },
      });
      assert.ok(!hasError(result, 'brand-fonts'));
    });
  });

  describe('real assets', () => {
    it('skips check when brandAssetsPath is not provided', () => {
      const body = `<section><img src="data:image/svg+xml,%3Csvg%3E%3C/svg%3E" alt="x"></section>`;
      const result = validateHTML(validPage(body));
      assert.ok(!hasError(result, 'real-assets'));
      assert.ok(!hasWarning(result, 'real-assets'));
    });

    it('warns for SVG data URI placeholders', () => {
      const body = `<section><img src="data:image/svg+xml,%3Csvg%3E%3C/svg%3E" alt="placeholder"></section>`;
      const result = validateHTML(validPage(body), { brandAssetsPath: '/assets' });
      assert.ok(hasWarning(result, 'real-assets'));
    });

    it('errors when ALL images are SVG placeholders', () => {
      const body = `<section>
        <img src="data:image/svg+xml,%3Csvg%3E%3C/svg%3E" alt="a">
        <img src="data:image/svg+xml,%3Csvg%3E%3C/svg%3E" alt="b">
      </section>`;
      const result = validateHTML(validPage(body), { brandAssetsPath: '/assets' });
      assert.ok(hasError(result, 'real-assets'));
      assert.ok(errorMessage(result, 'real-assets').includes('All'));
    });

    it('does not error when some images are real', () => {
      const body = `<section>
        <img src="data:image/svg+xml,%3Csvg%3E%3C/svg%3E" alt="placeholder">
        <img src="https://cdn.example.com/real-photo.jpg" alt="real">
      </section>`;
      const result = validateHTML(validPage(body), { brandAssetsPath: '/assets' });
      assert.ok(hasWarning(result, 'real-assets'));
      assert.ok(!hasError(result, 'real-assets'));
    });

    it('passes when no SVG placeholders exist', () => {
      const body = `<section><img src="photos/hero.jpg" alt="hero"></section>`;
      const result = validateHTML(validPage(body), { brandAssetsPath: '/assets' });
      assert.ok(!hasWarning(result, 'real-assets'));
      assert.ok(!hasError(result, 'real-assets'));
    });
  });

  describe('default tailwind colors', () => {
    it('errors when default blue palette color is found', () => {
      const body = `<section style="color: #3B82F6;">Blue text</section>`;
      const result = validateHTML(validPage(body));
      assert.ok(hasError(result, 'default-tailwind-colors'));
      assert.ok(errorMessage(result, 'default-tailwind-colors').includes('#3b82f6'));
    });

    it('errors when default indigo palette color is found', () => {
      const body = `<section style="background: #6366F1;">Indigo bg</section>`;
      const result = validateHTML(validPage(body));
      assert.ok(hasError(result, 'default-tailwind-colors'));
      assert.ok(errorMessage(result, 'default-tailwind-colors').includes('#6366f1'));
    });

    it('passes when no default palette colors are used', () => {
      const body = `<section style="color: #8B1A3A;">Custom color</section>`;
      const result = validateHTML(validPage(body));
      assert.ok(!hasError(result, 'default-tailwind-colors'));
    });

    it('reports only the first default color match', () => {
      const body = `<section style="color: #3B82F6; background: #6366F1;">Both</section>`;
      const result = validateHTML(validPage(body));
      const defaultColorErrors = result.errors.filter(e => e.rule === 'default-tailwind-colors');
      assert.equal(defaultColorErrors.length, 1);
    });
  });

  describe('required terms', () => {
    it('skips check when requiredTerms is not provided', () => {
      const result = validateHTML(validPage());
      assert.ok(!hasWarning(result, 'required-terms'));
    });

    it('passes when all required terms are present', () => {
      const body = `<section><h1>AccompliSHE</h1><p>Never Date a Broke Dude</p></section>`;
      const result = validateHTML(validPage(body), {
        requiredTerms: ['AccompliSHE', 'Never Date a Broke Dude'],
      });
      assert.ok(!hasWarning(result, 'required-terms'));
    });

    it('warns when a required term is missing', () => {
      const result = validateHTML(validPage('<section>Hello world</section>'), {
        requiredTerms: ['AccompliSHE'],
      });
      assert.ok(hasWarning(result, 'required-terms'));
      assert.ok(warningMessage(result, 'required-terms').includes('AccompliSHE'));
    });

    it('term matching is case-sensitive', () => {
      const body = `<section>accomplishe</section>`;
      const result = validateHTML(validPage(body), {
        requiredTerms: ['AccompliSHE'],
      });
      assert.ok(hasWarning(result, 'required-terms'));
    });

    it('does not warn when term appears in visible text', () => {
      const body = `<section><p>Welcome to AccompliSHE — your journey starts here</p></section>`;
      const result = validateHTML(validPage(body), {
        requiredTerms: ['AccompliSHE'],
      });
      assert.ok(!hasWarning(result, 'required-terms'));
    });
  });

  // ─── Typography metrics checks ─────────────────────────

  describe('typography metrics', () => {
    it('skips check when checkTypography is false (default)', () => {
      const body = `<section><h1 style="font-size: 10px;">Tiny heading</h1></section>`;
      const result = validateHTML(validPage(body));
      assert.ok(!hasWarning(result, 'typography-hierarchy'));
      assert.ok(!hasWarning(result, 'typography-line-height'));
      assert.ok(!hasWarning(result, 'typography-letter-spacing'));
    });

    it('warns when heading font-size is smaller than body text', () => {
      const body = `<section>
        <h1 style="font-size: 14px;">Small heading</h1>
        <p style="font-size: 16px;">Regular body</p>
      </section>`;
      const result = validateHTML(validPage(body), { checkTypography: true });
      assert.ok(hasWarning(result, 'typography-hierarchy'));
      assert.ok(warningMessage(result, 'typography-hierarchy').includes('h1'));
    });

    it('passes when heading font-size is larger than body text', () => {
      const body = `<section>
        <h1 style="font-size: 54px; line-height: 1.07;">Big heading</h1>
        <p style="font-size: 15px; line-height: 1.8;">Body text</p>
      </section>`;
      const result = validateHTML(validPage(body), { checkTypography: true });
      assert.ok(!hasWarning(result, 'typography-hierarchy'));
    });

    it('warns when heading line-height is outside 1.0–1.3', () => {
      const body = `<section>
        <h2 style="font-size: 44px; line-height: 1.8;">Heading with too much line-height</h2>
      </section>`;
      const result = validateHTML(validPage(body), { checkTypography: true });
      assert.ok(hasWarning(result, 'typography-line-height'));
      assert.ok(warningMessage(result, 'typography-line-height').includes('h2'));
    });

    it('passes when heading line-height is within 1.0–1.3', () => {
      const body = `<section>
        <h2 style="font-size: 44px; line-height: 1.2;">Good heading</h2>
      </section>`;
      const result = validateHTML(validPage(body), { checkTypography: true });
      const headingLhWarnings = result.warnings.filter(w =>
        w.rule === 'typography-line-height' && w.message.includes('h2')
      );
      assert.equal(headingLhWarnings.length, 0);
    });

    it('warns when body text line-height is below 1.5', () => {
      const body = `<section>
        <p style="font-size: 15px; line-height: 1.2;">Tight body text</p>
      </section>`;
      const result = validateHTML(validPage(body), { checkTypography: true });
      assert.ok(hasWarning(result, 'typography-line-height'));
      assert.ok(warningMessage(result, 'typography-line-height').includes('1.5'));
    });

    it('warns when body text line-height exceeds 2.0', () => {
      const body = `<section>
        <p style="font-size: 15px; line-height: 2.5;">Very loose body text</p>
      </section>`;
      const result = validateHTML(validPage(body), { checkTypography: true });
      assert.ok(hasWarning(result, 'typography-line-height'));
    });

    it('passes when body text line-height is within 1.5–2.0', () => {
      const body = `<section>
        <p style="font-size: 15px; line-height: 1.8;">Good body text</p>
      </section>`;
      const result = validateHTML(validPage(body), { checkTypography: true });
      const bodyLhWarnings = result.warnings.filter(w =>
        w.rule === 'typography-line-height' && w.message.includes('<p>')
      );
      assert.equal(bodyLhWarnings.length, 0);
    });

    it('warns when uppercase text has no letter-spacing in inline style', () => {
      const body = `<section>
        <span style="text-transform: uppercase;">NO TRACKING</span>
      </section>`;
      const result = validateHTML(validPage(body), { checkTypography: true });
      assert.ok(hasWarning(result, 'typography-letter-spacing'));
      assert.ok(warningMessage(result, 'typography-letter-spacing').includes('uppercase'));
    });

    it('warns when uppercase text has letter-spacing: 0', () => {
      const body = `<section>
        <span style="text-transform: uppercase; letter-spacing: 0;">ZERO TRACKING</span>
      </section>`;
      const result = validateHTML(validPage(body), { checkTypography: true });
      assert.ok(hasWarning(result, 'typography-letter-spacing'));
    });

    it('passes when uppercase text has positive letter-spacing', () => {
      const body = `<section>
        <span style="text-transform: uppercase; letter-spacing: 0.1em;">GOOD TRACKING</span>
      </section>`;
      const result = validateHTML(validPage(body), { checkTypography: true });
      const lsWarnings = result.warnings.filter(w =>
        w.rule === 'typography-letter-spacing' && w.message.includes('<span>')
      );
      assert.equal(lsWarnings.length, 0);
    });

    it('warns when CSS rule has uppercase without letter-spacing', () => {
      const body = `<style>.label { text-transform: uppercase; font-weight: 700; }</style>
        <section><span class="label">LABEL TEXT</span></section>`;
      const result = validateHTML(validPage(body), { checkTypography: true });
      assert.ok(hasWarning(result, 'typography-letter-spacing'));
      assert.ok(warningMessage(result, 'typography-letter-spacing').includes('.label'));
    });

    it('passes when CSS rule has uppercase with letter-spacing', () => {
      const body = `<style>.label { text-transform: uppercase; letter-spacing: 0.1em; }</style>
        <section><span class="label">LABEL TEXT</span></section>`;
      const result = validateHTML(validPage(body), { checkTypography: true });
      const cssLsWarnings = result.warnings.filter(w =>
        w.rule === 'typography-letter-spacing' && w.message.includes('.label')
      );
      assert.equal(cssLsWarnings.length, 0);
    });

    it('handles rem font-size values', () => {
      const body = `<section>
        <h1 style="font-size: 3rem; line-height: 1.1;">Big heading</h1>
        <p style="font-size: 1rem; line-height: 1.7;">Body text</p>
      </section>`;
      const result = validateHTML(validPage(body), { checkTypography: true });
      assert.ok(!hasWarning(result, 'typography-hierarchy'));
    });

    it('typography warnings do not make result invalid', () => {
      const body = `<section>
        <h1 style="font-size: 10px;">Tiny heading</h1>
        <p style="font-size: 16px;">Body text</p>
      </section>`;
      const result = validateHTML(validPage(body), { checkTypography: true });
      assert.equal(result.valid, true);
      assert.ok(result.warnings.length > 0);
    });
  });

  // ─── Spacing consistency checks ────────────────────────

  describe('spacing consistency', () => {
    it('skips check when checkSpacing is false (default)', () => {
      const body = `
        <section style="padding: 20px 0;">A</section>
        <section style="padding: 200px 0;">B</section>
        <section style="padding: 20px 0;">C</section>`;
      const result = validateHTML(validPage(body));
      assert.ok(!hasWarning(result, 'spacing-consistency'));
      assert.ok(!hasWarning(result, 'spacing-max-width'));
    });

    it('warns when section paddings vary more than 3:1', () => {
      const body = `
        <section style="padding: 20px 0;">A</section>
        <section style="padding: 120px 0;">B</section>
        <section style="padding: 20px 0;">C</section>`;
      const result = validateHTML(validPage(body), { checkSpacing: true });
      assert.ok(hasWarning(result, 'spacing-consistency'));
      assert.ok(warningMessage(result, 'spacing-consistency').includes('20px'));
      assert.ok(warningMessage(result, 'spacing-consistency').includes('120px'));
    });

    it('passes when section paddings are consistent (within 3:1 ratio)', () => {
      const body = `
        <section style="padding: 48px 0;">A</section>
        <section style="padding: 96px 0;">B</section>
        <section style="padding: 96px 0;">C</section>`;
      const result = validateHTML(validPage(body), { checkSpacing: true });
      assert.ok(!hasWarning(result, 'spacing-consistency'));
    });

    it('does not check spacing when fewer than 3 sections', () => {
      const body = `
        <section style="padding: 10px 0;">A</section>
        <section style="padding: 200px 0;">B</section>`;
      const result = validateHTML(validPage(body), { checkSpacing: true });
      assert.ok(!hasWarning(result, 'spacing-consistency'));
    });

    it('warns when no max-width is found', () => {
      const body = `<section style="padding: 96px 0;"><p>Content</p></section>`;
      const result = validateHTML(validPage(body), { checkSpacing: true });
      assert.ok(hasWarning(result, 'spacing-max-width'));
    });

    it('passes when max-width is in inline style', () => {
      const body = `<section style="padding: 96px 0;"><div style="max-width: 1080px; margin: 0 auto;"><p>Content</p></div></section>`;
      const result = validateHTML(validPage(body), { checkSpacing: true });
      assert.ok(!hasWarning(result, 'spacing-max-width'));
    });

    it('passes when max-width is in a <style> block', () => {
      const body = `<style>.inner { max-width: 1080px; margin: 0 auto; }</style>
        <section><div class="inner"><p>Content</p></div></section>`;
      const result = validateHTML(validPage(body), { checkSpacing: true });
      assert.ok(!hasWarning(result, 'spacing-max-width'));
    });

    it('passes when Tailwind max-w class is used', () => {
      const body = `<section><div class="max-w-6xl mx-auto"><p>Content</p></div></section>`;
      const result = validateHTML(validPage(body), { checkSpacing: true });
      assert.ok(!hasWarning(result, 'spacing-max-width'));
    });

    it('passes when Tailwind container class is used', () => {
      const body = `<section><div class="container mx-auto"><p>Content</p></div></section>`;
      const result = validateHTML(validPage(body), { checkSpacing: true });
      assert.ok(!hasWarning(result, 'spacing-max-width'));
    });

    it('passes when Tailwind arbitrary max-w is used', () => {
      const body = `<section><div class="max-w-[1080px] mx-auto"><p>Content</p></div></section>`;
      const result = validateHTML(validPage(body), { checkSpacing: true });
      assert.ok(!hasWarning(result, 'spacing-max-width'));
    });

    it('handles padding-top and padding-bottom individually', () => {
      const body = `
        <section style="padding-top: 20px; padding-bottom: 20px;">A</section>
        <section style="padding-top: 96px; padding-bottom: 96px;">B</section>
        <section style="padding-top: 20px; padding-bottom: 20px;">C</section>`;
      const result = validateHTML(validPage(body), { checkSpacing: true });
      assert.ok(hasWarning(result, 'spacing-consistency'));
    });

    it('spacing warnings do not make result invalid', () => {
      const body = `
        <section style="padding: 10px 0;">A</section>
        <section style="padding: 200px 0;">B</section>
        <section style="padding: 10px 0;">C</section>`;
      const result = validateHTML(validPage(body), { checkSpacing: true });
      assert.equal(result.valid, true);
    });
  });

  // ─── Color contrast checks ────────────────────────────

  describe('color contrast', () => {
    it('skips check when checkContrast is false (default)', () => {
      const body = `<section><p style="color: #ffffff; background-color: #ffffff;">Invisible</p></section>`;
      const result = validateHTML(validPage(body));
      assert.ok(!hasWarning(result, 'color-contrast'));
    });

    it('warns when text/background contrast is below 4.5:1', () => {
      // Light gray text on white background — ratio ~1.5:1
      const body = `<section><p style="color: #cccccc; background-color: #ffffff;">Low contrast</p></section>`;
      const result = validateHTML(validPage(body), { checkContrast: true });
      assert.ok(hasWarning(result, 'color-contrast'));
      assert.ok(warningMessage(result, 'color-contrast').includes('4.5:1'));
    });

    it('passes when text/background contrast meets 4.5:1', () => {
      // Dark text on white background — high contrast
      const body = `<section><p style="color: #000000; background-color: #ffffff;">High contrast</p></section>`;
      const result = validateHTML(validPage(body), { checkContrast: true });
      assert.ok(!hasWarning(result, 'color-contrast'));
    });

    it('detects low contrast with colored pairs', () => {
      // Yellow text on white — very low contrast
      const body = `<section><p style="color: #FFFF00; background-color: #FFFFFF;">Yellow on white</p></section>`;
      const result = validateHTML(validPage(body), { checkContrast: true });
      assert.ok(hasWarning(result, 'color-contrast'));
    });

    it('passes when dark text on light background', () => {
      // Charcoal text on ivory background
      const body = `<section><p style="color: #2C2C2C; background-color: #FAF5EE;">Brand colors</p></section>`;
      const result = validateHTML(validPage(body), { checkContrast: true });
      assert.ok(!hasWarning(result, 'color-contrast'));
    });

    it('handles shorthand hex colors', () => {
      // #000 on #fff — high contrast
      const body = `<section><p style="color: #000; background-color: #fff;">Short hex</p></section>`;
      const result = validateHTML(validPage(body), { checkContrast: true });
      assert.ok(!hasWarning(result, 'color-contrast'));
    });

    it('skips elements without both color and background-color', () => {
      const body = `<section><p style="color: #cccccc;">Only foreground</p></section>`;
      const result = validateHTML(validPage(body), { checkContrast: true });
      assert.ok(!hasWarning(result, 'color-contrast'));
    });

    it('skips non-hex color values', () => {
      const body = `<section><p style="color: red; background-color: white;">Named colors</p></section>`;
      const result = validateHTML(validPage(body), { checkContrast: true });
      assert.ok(!hasWarning(result, 'color-contrast'));
    });

    it('warns on white text on light background', () => {
      // White on light pink
      const body = `<section><p style="color: #ffffff; background-color: #F5E6D0;">White on champagne</p></section>`;
      const result = validateHTML(validPage(body), { checkContrast: true });
      assert.ok(hasWarning(result, 'color-contrast'));
    });

    it('handles rgb() color values', () => {
      // Light gray on white — low contrast
      const body = `<section><p style="color: rgb(204, 204, 204); background-color: rgb(255, 255, 255);">Low contrast rgb</p></section>`;
      const result = validateHTML(validPage(body), { checkContrast: true });
      assert.ok(hasWarning(result, 'color-contrast'));
    });

    it('handles rgba() color values (ignores alpha)', () => {
      // Semi-transparent light gray on white — still low contrast
      const body = `<section><p style="color: rgba(204, 204, 204, 0.9); background-color: rgba(255, 255, 255, 1);">Low contrast rgba</p></section>`;
      const result = validateHTML(validPage(body), { checkContrast: true });
      assert.ok(hasWarning(result, 'color-contrast'));
    });

    it('passes high-contrast rgb() pairs', () => {
      const body = `<section><p style="color: rgb(0, 0, 0); background-color: rgb(255, 255, 255);">High contrast rgb</p></section>`;
      const result = validateHTML(validPage(body), { checkContrast: true });
      assert.ok(!hasWarning(result, 'color-contrast'));
    });

    it('handles mixed hex and rgb() formats', () => {
      // Light gray hex on white rgb — low contrast
      const body = `<section><p style="color: #cccccc; background-color: rgb(255, 255, 255);">Mixed formats</p></section>`;
      const result = validateHTML(validPage(body), { checkContrast: true });
      assert.ok(hasWarning(result, 'color-contrast'));
    });

    it('uses 3:1 threshold for large text (>=18px)', () => {
      // Contrast ratio ~3.9:1 — fails 4.5:1 but passes 3:1
      const body = `<section><p style="font-size: 24px; color: #777777; background-color: #ffffff;">Large text</p></section>`;
      const result = validateHTML(validPage(body), { checkContrast: true });
      assert.ok(!hasWarning(result, 'color-contrast'));
    });

    it('uses 3:1 threshold for bold text >=14px', () => {
      // Same ratio ~3.9:1 — passes 3:1 for bold 14px+
      const body = `<section><p style="font-size: 14px; font-weight: 700; color: #777777; background-color: #ffffff;">Bold large text</p></section>`;
      const result = validateHTML(validPage(body), { checkContrast: true });
      assert.ok(!hasWarning(result, 'color-contrast'));
    });

    it('uses 4.5:1 threshold for small non-bold text', () => {
      // Same ratio ~3.9:1 — fails 4.5:1 for small text
      const body = `<section><p style="font-size: 14px; color: #777777; background-color: #ffffff;">Small text</p></section>`;
      const result = validateHTML(validPage(body), { checkContrast: true });
      assert.ok(hasWarning(result, 'color-contrast'));
    });

    it('warns when large text contrast is below 3:1', () => {
      // Very low contrast — fails even 3:1
      const body = `<section><h1 style="font-size: 36px; color: #cccccc; background-color: #ffffff;">Heading</h1></section>`;
      const result = validateHTML(validPage(body), { checkContrast: true });
      assert.ok(hasWarning(result, 'color-contrast'));
      assert.ok(warningMessage(result, 'color-contrast').includes('3:1'));
    });

    it('contrast warnings do not make result invalid', () => {
      const body = `<section><p style="color: #cccccc; background-color: #ffffff;">Low contrast</p></section>`;
      const result = validateHTML(validPage(body), { checkContrast: true });
      assert.equal(result.valid, true);
      assert.ok(result.warnings.length > 0);
    });
  });
});
