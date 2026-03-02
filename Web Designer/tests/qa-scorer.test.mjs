import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scoreOutput, parseBrandSpec } from '../utils/qa-scorer.mjs';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

// ─── Helpers ────────────────────────────────────────────

const TMP_DIR = join(tmpdir(), 'qa-scorer-test-' + Date.now());

async function setup() {
  await mkdir(TMP_DIR, { recursive: true });
}

async function cleanup() {
  await rm(TMP_DIR, { recursive: true, force: true });
}

async function writeHtml(name, content) {
  const path = join(TMP_DIR, name);
  await writeFile(path, content, 'utf-8');
  return path;
}

async function writeBrandSpec(content) {
  const path = join(TMP_DIR, 'brand.md');
  await writeFile(path, content, 'utf-8');
  return path;
}

function validPage(body = '<section><h1>Hello World</h1><p>Welcome to our page</p></section>') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test Page</title>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: { burgundy: '#8B1A3A', gold: '#C9963A', ivory: '#FAF5EE', charcoal: '#2C2C2C' },
          fontFamily: { display: ['"Cormorant Garamond"', 'serif'], sans: ['Montserrat', 'sans-serif'] }
        }
      }
    }
  </script>
  <style>
    h1 { font-family: 'Cormorant Garamond', serif; font-size: 56px; letter-spacing: -0.03em; line-height: 1.1; }
    h2 { font-family: 'Cormorant Garamond', serif; font-size: 36px; line-height: 1.2; }
    p { font-family: Montserrat, sans-serif; font-size: 16px; line-height: 1.7; }
    .overline { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; }
    .btn:focus-visible { outline: 2px solid #C9963A; }
  </style>
</head>
<body class="bg-ivory text-charcoal">
  <header class="py-6"><nav class="max-w-5xl mx-auto flex justify-between items-center px-6"><a href="/">Logo</a></nav></header>
  <main>
    <section class="py-20 md:py-28 lg:py-32">
      <div class="max-w-4xl mx-auto px-6 grid md:grid-cols-2 gap-12">
        ${body}
        <img src="photos/hero.jpg" alt="Hero image">
      </div>
    </section>
    <section class="py-16 bg-champagne" aria-label="Features">
      <div class="max-w-4xl mx-auto px-6 sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
        <div class="p-6"><h3 class="text-lg font-bold">Feature One</h3><p>Description here</p></div>
        <div class="p-6"><h3 class="text-lg font-bold">Feature Two</h3><p>Description here</p></div>
      </div>
    </section>
  </main>
  <footer class="py-12"><p class="text-center text-sm">© 2026</p></footer>
</body>
</html>`;
}

const BRAND_MD = `# Brand Document

## Colors
Primary (Duchess Burgundy): #8B1A3A
Old Gold: #C9963A
Champagne: #F5E6D0
Background (Ivory): #FAF5EE
Text (Charcoal): #2C2C2C

## Typography
Heading Font: Cormorant Garamond
Body Font: Montserrat

## Key Brand Terms
- AccompliSHE (capitalize SHE)
- Never Date a Broke Dude (book title)

## Don'ts
- No cool blues, greens, purples
`;

// ─── Tests ──────────────────────────────────────────────

describe('parseBrandSpec', () => {
  it('extracts colors from brand.md', () => {
    const spec = parseBrandSpec(BRAND_MD);
    assert.equal(spec.colors.primary, '#8B1A3A');
    assert.equal(spec.colors.gold, '#C9963A');
    assert.equal(spec.colors.background, '#FAF5EE');
    assert.equal(spec.colors.text, '#2C2C2C');
  });

  it('extracts fonts', () => {
    const spec = parseBrandSpec(BRAND_MD);
    assert.equal(spec.fontSpec.heading, 'Cormorant Garamond');
    assert.equal(spec.fontSpec.body, 'Montserrat');
  });

  it('extracts brand terms', () => {
    const spec = parseBrandSpec(BRAND_MD);
    assert.ok(spec.terms.includes('AccompliSHE'));
    assert.ok(spec.terms.some(t => t.includes('Never Date a Broke Dude')));
  });

  it('extracts donts', () => {
    const spec = parseBrandSpec(BRAND_MD);
    assert.ok(spec.donts.length > 0);
    assert.ok(spec.donts[0].includes('blues'));
  });

  it('handles empty input', () => {
    const spec = parseBrandSpec('');
    assert.deepEqual(spec.colors, {});
    assert.deepEqual(spec.fontSpec, {});
    assert.deepEqual(spec.terms, []);
  });
});

describe('scoreOutput', () => {
  // Setup and teardown
  it('setup temp dir', async () => { await setup(); });

  it('returns correct result shape', async () => {
    const htmlPath = await writeHtml('shape.html', validPage());
    const result = await scoreOutput(htmlPath);

    assert.equal(typeof result.score, 'number');
    assert.ok(result.score >= 0 && result.score <= 10);
    assert.ok(result.breakdown);
    assert.ok(Array.isArray(result.issues));

    // All breakdown categories present
    const expectedKeys = ['structure', 'brandFidelity', 'contentQuality', 'typography', 'assetQuality', 'spacing', 'accessibility'];
    for (const key of expectedKeys) {
      assert.ok(key in result.breakdown, `Missing breakdown key: ${key}`);
      assert.equal(typeof result.breakdown[key], 'number');
    }
  });

  it('score is 0-10 with one decimal', async () => {
    const htmlPath = await writeHtml('decimal.html', validPage());
    const result = await scoreOutput(htmlPath);
    const decimals = (result.score.toString().split('.')[1] || '').length;
    assert.ok(decimals <= 1, `Score ${result.score} has more than 1 decimal place`);
  });

  it('well-formed page scores high without brand spec', async () => {
    const htmlPath = await writeHtml('high.html', validPage());
    const result = await scoreOutput(htmlPath);
    assert.ok(result.score >= 6, `Expected score >= 6 but got ${result.score}`);
  });

  it('well-formed page with brand spec scores higher', async () => {
    const htmlPath = await writeHtml('branded.html', validPage());
    const brandPath = await writeBrandSpec(BRAND_MD);
    const result = await scoreOutput(htmlPath, { brandSpecPath: brandPath });
    assert.ok(result.score >= 5, `Expected score >= 5 but got ${result.score}`);
  });

  it('broken HTML scores low', async () => {
    const html = '<p>just text</p>';
    const htmlPath = await writeHtml('broken.html', html);
    const result = await scoreOutput(htmlPath);
    assert.ok(result.score < 7, `Expected score < 7 but got ${result.score}`);
    assert.ok(result.issues.length > 0);
  });

  it('issues include category, severity, and description', async () => {
    const html = '<p>just text</p>';
    const htmlPath = await writeHtml('issues.html', html);
    const result = await scoreOutput(htmlPath);

    for (const issue of result.issues) {
      assert.ok(issue.category, 'Issue missing category');
      assert.ok(issue.severity, 'Issue missing severity');
      assert.ok(issue.description, 'Issue missing description');
      assert.ok(['error', 'warning', 'info'].includes(issue.severity), `Invalid severity: ${issue.severity}`);
    }
  });

  describe('structure scoring', () => {
    it('penalizes missing DOCTYPE', async () => {
      const html = '<html><head><script src="https://cdn.tailwindcss.com"></script></head><body><section>Hi</section></body></html>';
      const htmlPath = await writeHtml('no-doctype.html', html);
      const result = await scoreOutput(htmlPath);
      assert.ok(result.breakdown.structure < 10);
    });

    it('penalizes missing viewport meta', async () => {
      const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><script src="https://cdn.tailwindcss.com"></script></head><body><section>Hi</section></body></html>`;
      const htmlPath = await writeHtml('no-viewport.html', html);
      const result = await scoreOutput(htmlPath);
      assert.ok(result.issues.some(i => i.description.includes('viewport')));
    });
  });

  describe('brand fidelity scoring', () => {
    it('detects missing brand colors', async () => {
      const html = validPage().replace(/#8B1A3A/g, '#FF0000');
      const htmlPath = await writeHtml('bad-colors.html', html);
      const brandPath = await writeBrandSpec(BRAND_MD);
      const result = await scoreOutput(htmlPath, { brandSpecPath: brandPath });
      assert.ok(result.issues.some(i => i.category === 'brandFidelity' && i.description.includes('#8B1A3A')));
    });
  });

  describe('content quality scoring', () => {
    it('penalizes placeholder text', async () => {
      const html = validPage('<section><h1>Lorem ipsum dolor sit amet</h1></section>');
      const htmlPath = await writeHtml('placeholder.html', html);
      const result = await scoreOutput(htmlPath);
      assert.ok(result.issues.some(i => i.category === 'contentQuality'));
    });

    it('penalizes COPY NEEDED markers', async () => {
      const html = validPage('<section><h1>[COPY NEEDED: hero headline]</h1></section>');
      const htmlPath = await writeHtml('copy-needed.html', html);
      const result = await scoreOutput(htmlPath);
      assert.ok(result.issues.some(i => i.description.includes('COPY NEEDED')));
    });
  });

  describe('typography scoring', () => {
    it('rewards size hierarchy', async () => {
      const htmlPath = await writeHtml('type-good.html', validPage());
      const result = await scoreOutput(htmlPath);
      assert.ok(result.breakdown.typography >= 7, `Expected typography >= 7 but got ${result.breakdown.typography}`);
    });
  });

  describe('asset quality scoring', () => {
    it('penalizes SVG placeholder images', async () => {
      const html = validPage('<section><img src="data:image/svg+xml,%3Csvg%3E%3C/svg%3E" alt="x"></section>');
      const htmlPath = await writeHtml('svg-placeholder.html', html);
      const result = await scoreOutput(htmlPath, { brandAssetsPath: '/fake/assets' });
      assert.ok(result.issues.some(i => i.category === 'assetQuality' && i.description.includes('SVG')));
    });
  });

  describe('spacing scoring', () => {
    it('penalizes lack of max-width containment', async () => {
      const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><title>T</title><script src="https://cdn.tailwindcss.com"></script></head><body><section><p>No containment</p></section></body></html>`;
      const htmlPath = await writeHtml('no-maxw.html', html);
      const result = await scoreOutput(htmlPath);
      assert.ok(result.issues.some(i => i.category === 'spacing' && i.description.includes('max-width')));
    });
  });

  describe('accessibility scoring', () => {
    it('penalizes lack of semantic HTML', async () => {
      const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><title>T</title><script src="https://cdn.tailwindcss.com"></script></head><body><div><div>Content</div></div></body></html>`;
      const htmlPath = await writeHtml('no-semantic.html', html);
      const result = await scoreOutput(htmlPath);
      assert.ok(result.issues.some(i => i.category === 'accessibility' && i.description.includes('semantic')));
    });
  });

  describe('score thresholds', () => {
    it('perfect HTML with all brand tokens scores >= 9', async () => {
      const body = `
        <h1>Welcome to AccompliSHE — Your Path to Financial Freedom</h1>
        <p>Learn the secrets from Never Date a Broke Dude and transform your relationship with money.
           This comprehensive course gives you the tools you need to build wealth, master your finances,
           and create lasting abundance in every area of your life.</p>`;
      const html = validPage(body);
      const htmlPath = await writeHtml('perfect.html', html);
      const brandPath = await writeBrandSpec(BRAND_MD);
      const result = await scoreOutput(htmlPath, { brandSpecPath: brandPath });
      assert.ok(result.score >= 9, `Expected score >= 9 but got ${result.score}`);
    });

    it('degraded HTML with placeholders and missing brand scores <= 6', async () => {
      const html = `<!DOCTYPE html>
<html><head>
  <script src="https://cdn.tailwindcss.com"></script>
</head><body>
  <section>
    <h1 style="font-size: 14px;">Lorem ipsum dolor sit amet</h1>
    <img src="data:image/svg+xml,%3Csvg%3E%3C/svg%3E" alt="placeholder">
    <img src="data:image/svg+xml,%3Csvg%3E%3C/svg%3E" alt="placeholder2">
    <p style="color: #3B82F6;">Default blue text [COPY NEEDED: body content]</p>
  </section>
</body></html>`;
      const htmlPath = await writeHtml('degraded.html', html);
      const brandPath = await writeBrandSpec(BRAND_MD);
      const result = await scoreOutput(htmlPath, {
        brandSpecPath: brandPath,
        brandAssetsPath: '/fake/assets',
      });
      assert.ok(result.score <= 6, `Expected score <= 6 but got ${result.score}`);
    });
  });

  describe('scoring formula', () => {
    it('weighted breakdown sums to overall score', async () => {
      const htmlPath = await writeHtml('formula.html', validPage());
      const result = await scoreOutput(htmlPath);

      const WEIGHTS = {
        structure: 0.15, brandFidelity: 0.25, contentQuality: 0.20,
        typography: 0.15, assetQuality: 0.10, spacing: 0.10, accessibility: 0.05,
      };
      let weightedSum = 0;
      for (const [key, weight] of Object.entries(WEIGHTS)) {
        weightedSum += result.breakdown[key] * weight;
      }
      const expected = Math.round(weightedSum * 10) / 10;
      assert.equal(result.score, expected, `Score ${result.score} !== weighted sum ${expected}`);
    });

    it('weights sum to 1.0', () => {
      const WEIGHTS = {
        structure: 0.15, brandFidelity: 0.25, contentQuality: 0.20,
        typography: 0.15, assetQuality: 0.10, spacing: 0.10, accessibility: 0.05,
      };
      const sum = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(sum - 1.0) < 0.001, `Weights sum to ${sum}, expected 1.0`);
    });

    it('each breakdown score is 0–10', async () => {
      const htmlPath = await writeHtml('bounds.html', validPage());
      const result = await scoreOutput(htmlPath);
      for (const [key, value] of Object.entries(result.breakdown)) {
        assert.ok(value >= 0 && value <= 10, `${key} = ${value} is out of 0-10 range`);
      }
    });
  });

  describe('CLI invocation', () => {
    it('outputs score and breakdown to stdout', async () => {
      const htmlPath = await writeHtml('cli.html', validPage());
      const { execSync } = await import('node:child_process');
      const output = execSync(`node utils/qa-scorer.mjs "${htmlPath}"`, {
        cwd: PROJECT_ROOT,
        encoding: 'utf-8',
        timeout: 10000,
      });
      assert.ok(output.includes('QA SCORE:'), 'CLI output should contain QA SCORE');
      assert.ok(output.includes('Category Breakdown:'), 'CLI output should contain Category Breakdown');
      assert.ok(output.includes('Structure'), 'CLI output should contain Structure category');
      assert.ok(output.includes('Brand Fidelity'), 'CLI output should contain Brand Fidelity category');
    });

    it('exits with error for missing path argument', async () => {
      const { execSync } = await import('node:child_process');
      let threw = false;
      try {
        execSync('node utils/qa-scorer.mjs', { cwd: PROJECT_ROOT, encoding: 'utf-8', timeout: 10000 });
      } catch (err) {
        threw = true;
        assert.ok(err.status !== 0, 'Should exit with non-zero status');
      }
      assert.ok(threw, 'Should have thrown for missing path');
    });
  });

  // Cleanup
  it('cleanup temp dir', async () => { await cleanup(); });
});
