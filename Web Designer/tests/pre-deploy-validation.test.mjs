import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(__dirname);

// Import the function under test
const { validatePreDeploy } = await import('../publish-assets.mjs');

const STAGING = path.join(ROOT, '_test-staging');
const CLIENTS_DIR = path.join(ROOT, 'clients');
const TEST_CLIENT = '_test-predeploy';

// ─── Helpers ─────────────────────────────────────────────

function createStaging({ vercelJson, images = [], clientHtml } = {}) {
  // Clean previous staging
  if (fs.existsSync(STAGING)) fs.rmSync(STAGING, { recursive: true, force: true });
  fs.mkdirSync(STAGING, { recursive: true });

  // Write vercel.json (raw string to allow invalid JSON)
  if (vercelJson !== undefined) {
    fs.writeFileSync(path.join(STAGING, 'vercel.json'), vercelJson);
  }

  // Write image files
  for (const img of images) {
    const imgPath = path.join(STAGING, img.path);
    fs.mkdirSync(path.dirname(imgPath), { recursive: true });
    fs.writeFileSync(imgPath, img.content || '');
  }

  // Write client HTML if provided
  if (clientHtml !== undefined) {
    const htmlDir = path.join(CLIENTS_DIR, TEST_CLIENT, 'output');
    fs.mkdirSync(htmlDir, { recursive: true });
    fs.writeFileSync(path.join(htmlDir, 'index.html'), clientHtml);
  }
}

function cleanup() {
  if (fs.existsSync(STAGING)) fs.rmSync(STAGING, { recursive: true, force: true });
  const clientDir = path.join(CLIENTS_DIR, TEST_CLIENT);
  if (fs.existsSync(clientDir)) fs.rmSync(clientDir, { recursive: true, force: true });
}

// ─── Tests ───────────────────────────────────────────────

describe('pre-deploy validation gate', () => {
  after(() => cleanup());

  describe('vercel.json validation', () => {
    it('passes with valid vercel.json containing version field', () => {
      createStaging({ vercelJson: JSON.stringify({ version: 2 }) });
      const result = validatePreDeploy(STAGING, null);
      const jsonIssues = result.issues.filter(i => i.check === 'vercel-json');
      assert.equal(jsonIssues.length, 0);
    });

    it('blocks deploy when vercel.json is missing', () => {
      createStaging({ vercelJson: undefined });
      const result = validatePreDeploy(STAGING, null);
      assert.equal(result.pass, false);
      assert.ok(result.issues.some(i => i.check === 'vercel-json' && i.message.includes('not found')));
    });

    it('blocks deploy when vercel.json is invalid JSON', () => {
      createStaging({ vercelJson: '{ invalid json !!' });
      const result = validatePreDeploy(STAGING, null);
      assert.equal(result.pass, false);
      assert.ok(result.issues.some(i => i.check === 'vercel-json' && i.message.includes('not valid JSON')));
    });

    it('blocks deploy when vercel.json has no version field', () => {
      createStaging({ vercelJson: JSON.stringify({ buildCommand: null }) });
      const result = validatePreDeploy(STAGING, null);
      assert.equal(result.pass, false);
      assert.ok(result.issues.some(i => i.check === 'vercel-json' && i.message.includes('missing required "version"')));
    });
  });

  describe('staged image validation', () => {
    it('passes with valid non-zero image files', () => {
      createStaging({
        vercelJson: JSON.stringify({ version: 2 }),
        images: [
          { path: 'clients/x/brand/assets/logos/logo.png', content: 'VALID_PNG_DATA' },
          { path: 'clients/x/brand/assets/photos/pic.jpg', content: 'VALID_JPG_DATA' },
        ],
      });
      const result = validatePreDeploy(STAGING, null);
      const imgIssues = result.issues.filter(i => i.check === 'image-validation');
      assert.equal(imgIssues.length, 0);
    });

    it('blocks deploy when an image file is zero bytes', () => {
      createStaging({
        vercelJson: JSON.stringify({ version: 2 }),
        images: [
          { path: 'clients/x/logos/empty.png', content: '' }, // 0 bytes
        ],
      });
      const result = validatePreDeploy(STAGING, null);
      assert.equal(result.pass, false);
      assert.ok(result.issues.some(i => i.check === 'image-validation' && i.message.includes('Zero-byte')));
    });

    it('ignores non-image files (no false positives)', () => {
      createStaging({
        vercelJson: JSON.stringify({ version: 2 }),
        images: [
          { path: 'readme.txt', content: '' }, // empty txt is fine — not an image
        ],
      });
      const result = validatePreDeploy(STAGING, null);
      const imgIssues = result.issues.filter(i => i.check === 'image-validation');
      assert.equal(imgIssues.length, 0);
    });
  });

  describe('HTML validation', () => {
    it('passes with valid HTML', () => {
      const html = `<!DOCTYPE html>
<html><head><script src="https://cdn.tailwindcss.com"></script></head>
<body><main><section><h1>Hello World</h1></section></main></body></html>`;
      createStaging({
        vercelJson: JSON.stringify({ version: 2 }),
        clientHtml: html,
      });
      const result = validatePreDeploy(STAGING, TEST_CLIENT);
      const htmlIssues = result.issues.filter(i => i.check === 'html-validation');
      assert.equal(htmlIssues.length, 0);
    });

    it('blocks deploy when HTML has validation errors', () => {
      // Missing DOCTYPE, missing structure tags, missing Tailwind
      createStaging({
        vercelJson: JSON.stringify({ version: 2 }),
        clientHtml: '<p>Just a paragraph</p>',
      });
      const result = validatePreDeploy(STAGING, TEST_CLIENT);
      assert.equal(result.pass, false);
      assert.ok(result.issues.some(i => i.check === 'html-validation'));
    });

    it('skips HTML checks when clientName is null', () => {
      createStaging({
        vercelJson: JSON.stringify({ version: 2 }),
      });
      const result = validatePreDeploy(STAGING, null);
      const htmlIssues = result.issues.filter(i => i.check === 'html-validation');
      assert.equal(htmlIssues.length, 0);
    });
  });

  describe('placeholder text detection', () => {
    it('blocks deploy when placeholder text is found', () => {
      const html = `<!DOCTYPE html>
<html><head><script src="https://cdn.tailwindcss.com"></script></head>
<body><main><section><h1>Lorem ipsum dolor sit amet</h1></section></main></body></html>`;
      createStaging({
        vercelJson: JSON.stringify({ version: 2 }),
        clientHtml: html,
      });
      const result = validatePreDeploy(STAGING, TEST_CLIENT);
      assert.equal(result.pass, false);
      assert.ok(result.issues.some(i => i.check === 'placeholder-text'));
    });

    it('passes with real content (no placeholders)', () => {
      const html = `<!DOCTYPE html>
<html><head><script src="https://cdn.tailwindcss.com"></script></head>
<body><main><section><h1>Welcome to Our Real Brand</h1><p>Genuine marketing copy here.</p></section></main></body></html>`;
      createStaging({
        vercelJson: JSON.stringify({ version: 2 }),
        clientHtml: html,
      });
      const result = validatePreDeploy(STAGING, TEST_CLIENT);
      const placeholderIssues = result.issues.filter(i => i.check === 'placeholder-text');
      assert.equal(placeholderIssues.length, 0);
    });
  });

  describe('correlation ID tracking', () => {
    it('returns a correlationId with every result', () => {
      createStaging({ vercelJson: JSON.stringify({ version: 2 }) });
      const result = validatePreDeploy(STAGING, null);
      assert.ok(result.correlationId);
      assert.ok(typeof result.correlationId === 'string');
      assert.ok(result.correlationId.length > 0);
    });
  });

  describe('combined validation', () => {
    it('reports all issues at once (does not short-circuit)', () => {
      createStaging({
        vercelJson: '{ broken json',
        images: [{ path: 'logos/bad.png', content: '' }],
        clientHtml: '<p>Lorem ipsum</p>',
      });
      const result = validatePreDeploy(STAGING, TEST_CLIENT);
      assert.equal(result.pass, false);
      // Should have issues from multiple checks
      const checks = new Set(result.issues.map(i => i.check));
      assert.ok(checks.has('vercel-json'), 'Should report vercel.json issue');
      assert.ok(checks.has('image-validation'), 'Should report image issue');
      // HTML validation errors (missing doctype, etc.) or placeholder
      assert.ok(checks.size >= 2, `Should report issues from multiple checks, got: ${[...checks].join(', ')}`);
    });
  });
});
