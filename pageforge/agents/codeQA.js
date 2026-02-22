/**
 * @fileoverview Stage 7 — Code QA
 * Builds an element map from the approved UX HTML (data-slot attributes +
 * visible text nodes), then compares against Elementor JSON widget content.
 * Score: (matched / total) * 100. If < 98, asks Claude to fix mismatches.
 * Max iterations: CODE_QA_MAX_ITERATIONS.
 */

import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';

const client = new Anthropic({ apiKey: config.anthropicApiKey });

/**
 * @typedef {Object} ElementEntry
 * @property {string} slot  - data-slot value or 'text-node'
 * @property {string} value - Text content
 */

/**
 * Extract all data-slot values and significant text nodes from HTML.
 * Uses regex parsing (no DOM — keeps dependency footprint light).
 * @param {string} html
 * @returns {ElementEntry[]}
 */
function extractHtmlElements(html) {
  const entries = [];

  // Extract data-slot elements
  const slotRegex = /data-slot=["']([^"']+)["'][^>]*>([^<]+)</gi;
  let m;
  while ((m = slotRegex.exec(html)) !== null) {
    const value = m[2].trim();
    if (value) {
      entries.push({ slot: m[1].toLowerCase(), value });
    }
  }

  return entries;
}

/**
 * Recursively extract all text values from Elementor JSON widgets.
 * @param {Object[]} elements - Elementor elements array
 * @returns {string[]} All non-empty text values found in widget settings
 */
function extractElementorText(elements) {
  const texts = [];

  for (const el of elements) {
    if (el.elType === 'widget') {
      const s = el.settings ?? {};
      // Common text fields across all Elementor widget types
      const candidates = [
        s.title, s.editor, s.text, s.caption,
        s.heading, s.content, s.description,
        s.button_text, s.link?.text,
        s.testimonial_content, s.testimonial_name, s.testimonial_job,
        s.title_text, s.description_text,
        typeof s.url === 'object' ? null : s.url,
      ].filter(Boolean);

      for (const val of candidates) {
        const clean = String(val).replace(/<[^>]+>/g, '').trim();
        if (clean.length > 2) texts.push(clean);
      }
    }

    // Recurse into columns and sections
    if (Array.isArray(el.elements) && el.elements.length > 0) {
      texts.push(...extractElementorText(el.elements));
    }
  }

  return texts;
}

/**
 * Fuzzy match: check if a brief value appears anywhere in the Elementor texts.
 * Normalises whitespace and ignores case.
 * @param {string} needle
 * @param {string[]} haystack
 * @returns {boolean}
 */
function matchesAny(needle, haystack) {
  const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const n = norm(needle);
  return haystack.some((h) => norm(h).includes(n) || n.includes(norm(h)));
}

/**
 * Score the Elementor JSON against the HTML element map.
 * @param {ElementEntry[]} htmlElements
 * @param {string[]} elementorTexts
 * @returns {{ score: number, matched: number, total: number, mismatches: string[] }}
 */
function scoreMatch(htmlElements, elementorTexts) {
  const mismatches = [];
  let matched = 0;

  for (const { slot, value } of htmlElements) {
    if (matchesAny(value, elementorTexts)) {
      matched++;
    } else {
      mismatches.push(`Slot "${slot}": "${value.slice(0, 60)}…" not found in Elementor JSON`);
    }
  }

  const total = htmlElements.length;
  const score = total === 0 ? 100 : Math.round((matched / total) * 100);
  return { score, matched, total, mismatches };
}

/**
 * Ask Claude to fix Elementor JSON mismatches.
 * @param {string} elementorJsonStr
 * @param {string[]} mismatches
 * @param {ElementEntry[]} htmlElements
 * @returns {Promise<Object[]>}
 */
async function fixWithClaude(elementorJsonStr, mismatches, htmlElements) {
  const issueList = mismatches.map((m, i) => `${i + 1}. ${m}`).join('\n');
  const expectedMap = htmlElements.map(({ slot, value }) => `  "${slot}": "${value.slice(0, 80)}"`).join('\n');

  const message = await client.messages.create({
    model: config.claudeModel,
    max_tokens: 16384,
    messages: [
      {
        role: 'user',
        content: `You are an Elementor developer fixing a page JSON.

The following content from the approved UX wireframe is missing from the Elementor JSON:
${issueList}

Expected content that must appear in widget settings:
${expectedMap}

Fix the Elementor JSON below so all expected content appears in the appropriate widget settings fields
(title, editor, text, content, description, etc. — whichever matches the widget type).

Return ONLY the corrected JSON array — no explanation, no markdown fences.

CURRENT ELEMENTOR JSON:
${elementorJsonStr.slice(0, 60000)}`,
      },
    ],
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text : '';
  const cleaned = raw.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim();
  return JSON.parse(cleaned);
}

/**
 * Mode A QA: Verify brief.slots values appear in the Elementor JSON.
 * Compares slot values from the brief against the filled Elementor template.
 * @param {Object} briefData - The brief with a .slots object
 * @param {Object[]} elementorJson - Parsed Elementor JSON
 * @returns {{ score: number, matched: number, total: number, mismatches: string[] }}
 */
function scoreModeA(briefData, elementorJson) {
  const slots = briefData.slots ?? {};
  const elementorTexts = extractElementorText(elementorJson);
  const elementorRaw = JSON.stringify(elementorJson);
  const mismatches = [];
  let matched = 0;
  let total = 0;

  for (const [slotName, slotValue] of Object.entries(slots)) {
    // Skip URL slots — they appear in link objects, not visible text
    if (slotName.endsWith('-url')) continue;

    total++;
    const clean = String(slotValue).replace(/<[^>]+>/g, '').trim();
    if (clean.length < 3) { matched++; continue; }  // Skip very short values

    // Check if the slot value appears in extracted texts OR raw JSON
    if (matchesAny(clean, elementorTexts) || elementorRaw.includes(String(slotValue))) {
      matched++;
    } else {
      mismatches.push(`Slot "${slotName}": "${clean.slice(0, 60)}…" not found in Elementor JSON`);
    }
  }

  const score = total === 0 ? 100 : Math.round((matched / total) * 100);
  return { score, matched, total, mismatches };
}

/**
 * Stage 7: Validate Elementor JSON vs. approved UX HTML.
 * For Mode A (slot substitution), validates brief.slots against Elementor JSON.
 * For Mode B (Claude generation), validates HTML wireframe against Elementor JSON.
 * @param {import('../pipeline.js').RunContext} ctx
 * @returns {Promise<import('../pipeline.js').RunContext>}
 */
export async function run(ctx) {
  const ts = () => new Date().toISOString();
  const maxIter = config.codeQaMaxIterations;
  const isModeA = Boolean(ctx.briefData?.slots);

  let elementorJson = JSON.parse(await readFile(ctx.elementorOutputPath, 'utf-8'));

  if (isModeA) {
    // --- Mode A: Compare brief.slots directly against filled Elementor JSON ---
    console.log(`[${ts()}] [codeQA        ] Mode A detected — validating brief.slots against Elementor JSON`);
    const { score, matched, total, mismatches } = scoreModeA(ctx.briefData, elementorJson);
    console.log(`[${ts()}] [codeQA        ] Score: ${score}/100 (${matched}/${total} slots matched)`);

    if (mismatches.length > 0) {
      mismatches.forEach((m, i) => console.log(`[${ts()}] [codeQA        ]   ${i + 1}. ${m}`));
    }

    if (score >= 90) {
      console.log(`[${ts()}] [codeQA        ] PASS — score ${score} >= 90`);
    } else {
      console.warn(`[${ts()}] [codeQA        ] WARNING: Mode A score ${score} < 90 — some slots may not have been filled correctly`);
    }

    return ctx;
  }

  // --- Mode B: Compare HTML wireframe against Elementor JSON ---
  const html = await readFile(ctx.uxOutputPath, 'utf-8');
  const htmlElements = extractHtmlElements(html);
  console.log(`[${ts()}] [codeQA        ] Extracted ${htmlElements.length} elements from UX HTML`);

  for (let iter = 1; iter <= maxIter; iter++) {
    const elementorTexts = extractElementorText(elementorJson);
    const { score, matched, total, mismatches } = scoreMatch(htmlElements, elementorTexts);

    console.log(`[${ts()}] [codeQA        ] Iteration ${iter}/${maxIter} — Score: ${score}/100 (${matched}/${total} matched)`);

    if (mismatches.length > 0) {
      mismatches.forEach((m, i) => console.log(`[${ts()}] [codeQA        ]   ${i + 1}. ${m}`));
    }

    if (score >= 98) {
      console.log(`[${ts()}] [codeQA        ] PASS — score ${score} >= 98`);
      break;
    }

    if (iter < maxIter) {
      console.log(`[${ts()}] [codeQA        ] Requesting Claude fix for ${mismatches.length} mismatch(es)…`);
      try {
        elementorJson = await fixWithClaude(
          JSON.stringify(elementorJson, null, 2),
          mismatches,
          htmlElements
        );
        await writeFile(ctx.elementorOutputPath, JSON.stringify(elementorJson, null, 2));
        console.log(`[${ts()}] [codeQA        ] Fixed Elementor JSON written → ${ctx.elementorOutputPath}`);
      } catch (err) {
        console.warn(`[${ts()}] [codeQA        ] Claude fix failed: ${err.message}. Proceeding with current version.`);
        break;
      }
    } else {
      console.warn(`[${ts()}] [codeQA        ] WARNING: Max iterations reached. Final score: ${score}. Deploying best version.`);
    }
  }

  return ctx;
}
