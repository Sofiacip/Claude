/**
 * @fileoverview Stage 1 — Brief Parser
 * Reads the input brief JSON, validates all required fields,
 * and writes a normalised copy to /briefs/{runId}.json.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { resolve, extname } from 'path';
import { config } from '../config.js';

/** Fields that must be present in every brief */
const REQUIRED_FIELDS = [
  'headline',
  'subheadline',
  'ctaText',
  'templateName',
  'targetSlug',
];

/** Fields with default fallbacks */
const DEFAULTS = {
  ctaUrl: '/',
  brandColor: '#2563EB',
  status: 'draft',
};

/**
 * Validate and normalise a raw brief object.
 * @param {Object} raw - Parsed JSON from the brief file
 * @returns {{ valid: boolean, brief: Object, errors: string[] }}
 */
function validateBrief(raw) {
  const errors = [];

  for (const field of REQUIRED_FIELDS) {
    if (!raw[field] || String(raw[field]).trim() === '') {
      errors.push(`Missing required field: "${field}"`);
    }
  }

  // Validate slug format (lowercase, hyphens only)
  if (raw.targetSlug && !/^[a-z0-9-]+$/.test(raw.targetSlug)) {
    errors.push(`"targetSlug" must contain only lowercase letters, digits, and hyphens. Got: "${raw.targetSlug}"`);
  }

  // Validate brandColor if present
  if (raw.brandColor && !/^#[0-9A-Fa-f]{3,6}$/.test(raw.brandColor)) {
    errors.push(`"brandColor" must be a valid hex color (e.g. #2563EB). Got: "${raw.brandColor}"`);
  }

  const brief = { ...DEFAULTS, ...raw };

  return {
    valid: errors.length === 0,
    brief,
    errors,
  };
}

/**
 * Stage 1: Parse and validate brief input.
 * @param {import('../pipeline.js').RunContext} ctx
 * @returns {Promise<import('../pipeline.js').RunContext>}
 */
export async function run(ctx) {
  const ts = () => new Date().toISOString();

  console.log(`[${ts()}] [briefParser   ] Reading brief from: ${ctx.briefPath}`);

  // --- Read file ---
  let raw;
  try {
    const content = await readFile(ctx.briefPath, 'utf-8');
    raw = JSON.parse(content);
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`Brief file not found: ${ctx.briefPath}`);
    }
    if (err instanceof SyntaxError) {
      throw new Error(`Brief file contains invalid JSON: ${err.message}`);
    }
    throw err;
  }

  // --- Validate ---
  const { valid, brief, errors } = validateBrief(raw);
  if (!valid) {
    throw new Error(
      `Brief validation failed with ${errors.length} error(s):\n` +
      errors.map((e) => `  • ${e}`).join('\n')
    );
  }

  console.log(`[${ts()}] [briefParser   ] Validation passed. Template: "${brief.templateName}", Slug: "${brief.targetSlug}"`);

  // --- Persist validated brief ---
  await mkdir(config.paths.briefs, { recursive: true });
  const outPath = resolve(config.paths.briefs, `${ctx.runId}.json`);
  await writeFile(outPath, JSON.stringify(brief, null, 2));
  console.log(`[${ts()}] [briefParser   ] Validated brief written → ${outPath}`);

  return {
    ...ctx,
    templateName: brief.templateName,
    briefData: brief,
  };
}
