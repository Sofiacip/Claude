/**
 * mapper.js — Stage 2: Match copy from Word docs to template slots.
 * Uses Claude API for intelligent extraction from unstructured text.
 */

import { readFile } from 'fs/promises';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

/**
 * Extract all slot names from a template's sections.
 */
function collectSlots(template) {
  const slots = new Set();
  for (const section of template.sections) {
    if (section.slots) {
      section.slots.forEach(s => slots.add(s));
    }
  }
  return Array.from(slots);
}

/**
 * Map copy from a single page's raw text to its template slots.
 */
async function mapPageCopy(pageEntry, emit) {
  // Load template
  const templateJson = await readFile(pageEntry.templatePath, 'utf-8');
  const template = JSON.parse(templateJson);
  const slotNames = collectSlots(template);

  if (slotNames.length === 0) {
    emit(`  ${pageEntry.pageType}: No slots to fill.`);
    return;
  }

  emit(`  ${pageEntry.pageType}: Extracting ${slotNames.length} copy slots...`);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    temperature: 0,
    system: `You are a copy extraction assistant for a marketing funnel builder.
You receive raw text extracted from a Word document and a list of slot names.
Your job is to find the content that belongs to each slot.

Rules:
- Return valid JSON only. No explanation, no markdown fences.
- The JSON shape: { "slot_name": "content_value", ... }
- For array slots (like pain_points, outcomes, benefits, testimonials, faq_items), return a JSON array.
- For testimonials, each item should have: { "name": string, "result": string }
- For faq_items, each item should have: { "question": string, "answer": string }
- For value stack / bonus items, each item should have: { "name": string, "value": string }
- If a slot cannot be found in the text, set its value to null.
- Extract the content as-is from the document. Do not rephrase or improve the copy.
- Be generous in matching — headings like "What You'll Discover" should match an "outcomes" slot.`,
    messages: [{
      role: 'user',
      content: `Extract the following slots from this copy document.

SLOT NAMES:
${slotNames.map(s => `- ${s}`).join('\n')}

TEMPLATE SECTIONS (for context on what each slot is):
${template.sections.map(s => `${s.id} ${s.name}: slots=[${(s.slots || []).join(', ')}]`).join('\n')}

RAW COPY TEXT:
---
${pageEntry.copyRaw}
---

Return the JSON object with all slot values extracted.`
    }]
  });

  // Parse response
  const text = response.content[0]?.text || '';
  try {
    // Strip markdown fences if present
    const jsonStr = text.replace(/^```json?\n?/m, '').replace(/\n?```$/m, '').trim();
    const slots = JSON.parse(jsonStr);

    pageEntry.copySlots = slots;

    // Flag missing slots
    const missing = slotNames.filter(s => slots[s] === null || slots[s] === undefined);
    pageEntry.missingSlots = missing;

    if (missing.length > 0) {
      emit(`  ${pageEntry.pageType}: Mapped ${slotNames.length - missing.length}/${slotNames.length} slots. Missing: ${missing.join(', ')}`);
    } else {
      emit(`  ${pageEntry.pageType}: All ${slotNames.length} slots mapped. ✓`);
    }
  } catch (err) {
    emit(`  ${pageEntry.pageType}: Failed to parse Claude response. Using raw text fallback.`);
    // Fallback: store raw text as a single slot
    pageEntry.copySlots = { _raw: pageEntry.copyRaw };
    pageEntry.missingSlots = slotNames;
  }
}

/**
 * Main mapper function. Processes all pages in the job.
 */
export async function mapCopy(job, emit) {
  for (const page of job.pages) {
    await mapPageCopy(page, emit);
  }

  const totalMissing = job.pages.reduce((sum, p) => sum + p.missingSlots.length, 0);
  if (totalMissing > 0) {
    emit(`Mapping complete with ${totalMissing} missing slot(s) across all pages.`);
  } else {
    emit('Mapping complete. All slots filled. ✓');
  }
}
