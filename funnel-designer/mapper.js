/**
 * mapper.js — Stage 2: Match copy from Word docs to template slots.
 * Uses heuristic heading-to-slot matching. No external API calls.
 * Claude Code reviews and refines the mapping after this stage completes.
 */

import { readFile } from 'fs/promises';

/**
 * Normalize a heading string for matching.
 */
function normalize(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
}

/**
 * Heading-to-slot keyword map.
 * Maps common headings/keywords found in copy docs to template slot names.
 */
const HEADING_SLOT_MAP = {
  // Landing page
  'webinar_title': ['webinar title', 'title', 'headline', 'main headline'],
  'webinar_date': ['webinar date', 'date', 'event date', 'when'],
  'host_name': ['host name', 'presenter', 'your host', 'your guide'],
  'host_credentials': ['host credentials', 'credentials', 'bio tagline'],
  'hero_subheadline': ['hero subheadline', 'subheadline', 'sub headline', 'subtitle'],
  'pain_points': ['pain points', 'pain', 'does this feel familiar', 'struggling with'],
  'bridge_paragraph': ['bridge paragraph', 'bridge', 'transition', 'the truth'],
  'outcomes': ['what you\'ll learn', 'outcomes', 'you\'ll learn', 'you will learn', 'you\'ll discover'],
  'bio_text': ['bio text', 'bio', 'about', 'meet your guide', 'biography'],
  'testimonials': ['testimonials', 'testimonial', 'what people say', 'results', 'success stories'],
  'bonuses': ['bonuses', 'bonus', 'what you get', 'included'],
  'total_value': ['total value', 'total', 'value'],
  'cta_text': ['cta text', 'cta', 'button text', 'call to action', 'register', 'reserve'],
  'social_proof_stats': ['social proof stats', 'stats', 'social proof', 'numbers', 'by the numbers'],
  'media_logos': ['media logos', 'media', 'as seen in', 'featured in', 'press'],

  // Upgrade page (OTO1)
  'oto1_headline': ['oto1 headline', 'offer headline', 'upgrade headline', 'special offer'],
  'oto1_benefits': ['oto1 benefits', 'benefits', 'bullet benefits', 'why upgrade'],
  'oto1_items': ['oto1 items', 'product details', 'what you get', 'includes'],
  'oto1_price': ['oto1 price', 'sale price', 'price', 'today only', 'special price'],
  'oto1_regular_price': ['oto1 regular price', 'regular price', 'original price', 'normally'],
  'oto1_checkout_url': ['oto1 checkout url', 'checkout url', 'payment link', 'buy link'],
  'thankyou_url': ['thankyou url', 'thank you url', 'decline url', 'no thanks url'],

  // Upsell page (OTO2)
  'oto2_headline': ['oto2 headline', 'transformation headline', 'upsell headline'],
  'program_name': ['program name', 'program', 'course name'],
  'program_overview': ['program overview', 'overview', 'about the program'],
  'program_outcomes': ['program outcomes', 'numbered outcomes', 'what you\'ll achieve'],
  'program_components': ['program components', 'what\'s inside', 'components', 'modules'],
  'learning_outcomes': ['learning outcomes', 'detailed learning', 'detailed outcomes'],
  'oto2_testimonials': ['oto2 testimonials'],
  'oto2_items': ['oto2 items', 'value stack items'],
  'oto2_price': ['oto2 price'],
  'oto2_regular_price': ['oto2 regular price'],
  'oto2_checkout_url': ['oto2 checkout url'],

  // Thank you page
  'confirmation_headline': ['confirmation headline', 'confirmation', 'you\'re in'],
  'acknowledgment_text': ['acknowledgment text', 'acknowledgment', 'congratulations'],
  'webinar_time': ['webinar time', 'time', 'event time'],
  'webinar_zoom_url': ['webinar zoom url', 'zoom url', 'zoom link', 'join link'],
  'calendar_link': ['calendar link', 'add to calendar', 'google calendar'],
  'referral_copy': ['referral copy', 'referral', 'invite a friend', 'share'],

  // Replay page
  'video_embed_url': ['video embed url', 'video url', 'replay url', 'video embed', 'vimeo', 'youtube'],
  'replay_cta_text': ['replay cta text', 'replay cta', 'watch now'],
  'replay_cta_url': ['replay cta url', 'replay url', 'sales url'],
  'newsletter_headline': ['newsletter headline', 'newsletter', 'signup'],

  // Sales page
  'program_headline': ['program headline', 'main headline', 'sales headline'],
  'program_subheadline': ['program subheadline', 'subheadline'],
  'problem_observation': ['problem observation', 'problem', 'the problem'],
  'pain_bullets': ['pain bullets', 'pain points', 'struggling'],
  'root_cause': ['root cause', 'root cause reframe', 'real reason', 'the truth is'],
  'conditioning_story': ['conditioning story', 'story', 'my story', 'personal story', 'journey'],
  'program_pillars': ['program pillars', 'pillars', 'core pillars', 'transformation pillars'],
  'host_bio': ['host bio', 'meet your coach', 'about the coach', 'your coach'],
  'testimonials_r1': ['testimonials round 1', 'testimonials r1', 'client results'],
  'curriculum': ['curriculum', 'curriculum breakdown', 'module breakdown', 'modules'],
  'guarantee_name': ['guarantee name', 'guarantee', 'money back'],
  'guarantee_days': ['guarantee days', 'guarantee period'],
  'guarantee_terms': ['guarantee terms'],
  'value_stack_items': ['value stack items', 'value stack', 'full value stack'],
  'price_full': ['price full', 'full price', 'one time price', 'pay in full'],
  'price_plan': ['price plan', 'payment plan', 'monthly payments'],
  'checkout_url': ['checkout url', 'enroll now', 'buy now', 'enrollment link'],
  'faq_items': ['faq items', 'faq', 'frequently asked', 'questions'],
  'enrollment_close_date': ['enrollment close date', 'closes', 'deadline', 'enrollment closes']
};

/**
 * Check if a line looks like a heading (not content).
 * A heading is: short, looks like a title, and ideally matches a known slot.
 */
function looksLikeHeading(trimmed) {
  // Markdown headings
  if (/^#+\s/.test(trimmed)) return true;

  // Too long for a heading
  if (trimmed.length > 50) return false;

  // Ends with punctuation that suggests content
  if (/[.!?,;:]$/.test(trimmed)) return false;

  // Starts with a numbered list item (1. 2. etc.) — content, not heading
  if (/^\d+\.\s/.test(trimmed)) return false;

  // Starts with a bullet — content, not heading
  if (/^[-•*]\s/.test(trimmed)) return false;

  // Contains double quotes or single quotes around phrases — likely content (testimonials)
  // But allow apostrophes in contractions (You'll, What's, etc.)
  if (/"/.test(trimmed)) return false;
  if (/'.+?'/.test(trimmed) && !/\w'\w/.test(trimmed)) return false;

  // Contains em dash followed by text — likely content (testimonials, items)
  if (/[—–]\s/.test(trimmed) && trimmed.length > 20) return false;

  // Starts with a contraction like "You're", "You've" — content
  if (/^(You|I|We|They|He|She|It|This|That|The |A |An |My |Our )/i.test(trimmed) && trimmed.length > 25) return false;

  // Starts with $ — price/value content
  if (/^\$/.test(trimmed)) return false;

  // ALL CAPS lines are typically CTA button text or labels, not headings
  if (/^[A-Z\s!]+$/.test(trimmed) && trimmed.length > 5) return false;

  // Short, title-like text that could be a heading
  if (trimmed.length < 50 && /^[A-Z]/.test(trimmed)) return true;

  return false;
}

/**
 * Parse a raw text document into heading→content blocks.
 * Uses the known slot map to validate heading candidates.
 */
function parseBlocks(rawText) {
  const lines = rawText.split('\n');
  const blocks = [];
  let currentHeading = null;
  let currentContent = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const cleanLine = trimmed.replace(/^#+\s*/, '');
    const isHeading = looksLikeHeading(trimmed);

    // A heading line that matches a known slot — start a new block
    if (isHeading && matchSlot(cleanLine) !== null) {
      if (currentHeading && currentContent.length > 0) {
        blocks.push({ heading: currentHeading, content: currentContent.join('\n').trim() });
      }
      currentHeading = cleanLine;
      currentContent = [];
    } else if (isHeading && !currentHeading) {
      // First heading in the doc — might not match a slot but still act as heading
      currentHeading = cleanLine;
    } else {
      currentContent.push(trimmed);
    }
  }

  // Push last block
  if (currentHeading && currentContent.length > 0) {
    blocks.push({ heading: currentHeading, content: currentContent.join('\n').trim() });
  }

  return blocks;
}

/**
 * Match a heading to a slot name using keyword matching.
 * Prefers longer (more specific) keyword matches first.
 */
function matchSlot(heading) {
  const normalized = heading.toLowerCase();
  const normalizedKey = normalize(heading);

  // Collect all matches with their keyword length, pick the longest (most specific)
  let bestMatch = null;
  let bestLength = 0;

  for (const [slotName, keywords] of Object.entries(HEADING_SLOT_MAP)) {
    // Exact normalized match
    if (normalizedKey === normalize(slotName)) return slotName;

    for (const keyword of keywords) {
      if (normalized.includes(keyword) && keyword.length > bestLength) {
        bestMatch = slotName;
        bestLength = keyword.length;
      }
    }
  }
  return bestMatch;
}

/**
 * Parse array-style content (numbered lists, bullet points, testimonials).
 */
function parseArrayContent(content, slotName) {
  const lines = content.split('\n').filter(l => l.trim());

  // Testimonials: "Name — 'quote'"
  if (slotName === 'testimonials' || slotName === 'oto2_testimonials' || slotName === 'testimonials_r1') {
    return lines.map(line => {
      const match = line.match(/^([^—–\-]+)[—–\-]+\s*['"]?(.+?)['"]?\s*$/);
      if (match) return { name: match[1].trim(), result: match[2].trim() };
      return { name: '', result: line.trim() };
    });
  }

  // Bonuses / items: "Name — Value: $X"
  if (slotName === 'bonuses' || slotName.includes('items') || slotName === 'value_stack_items') {
    return lines.map(line => {
      const match = line.match(/^(.+?)\s*[—–\-]+\s*(?:Value:\s*)?(\$[\d,]+)/i);
      if (match) return { name: match[1].trim(), value: match[2].trim() };
      return { name: line.trim(), value: '' };
    });
  }

  // FAQ items: "Q: ... A: ..."
  if (slotName === 'faq_items') {
    const items = [];
    for (let i = 0; i < lines.length; i += 2) {
      items.push({
        question: lines[i]?.replace(/^Q:\s*/i, '').trim() || '',
        answer: lines[i + 1]?.replace(/^A:\s*/i, '').trim() || ''
      });
    }
    return items;
  }

  // Numbered lists: strip leading numbers
  if (lines.every(l => /^\d+[\.\)]\s/.test(l))) {
    return lines.map(l => l.replace(/^\d+[\.\)]\s*/, '').trim());
  }

  // Plain bullet list
  return lines.map(l => l.replace(/^[-•*]\s*/, '').trim());
}

// Slots that should be parsed as arrays
const ARRAY_SLOTS = [
  'pain_points', 'outcomes', 'testimonials', 'bonuses', 'social_proof_stats',
  'oto1_benefits', 'oto1_items', 'oto2_testimonials', 'oto2_items',
  'program_outcomes', 'program_components', 'learning_outcomes',
  'program_pillars', 'pain_bullets', 'testimonials_r1',
  'curriculum', 'value_stack_items', 'faq_items'
];

/**
 * Collect all slot names required by a template.
 */
function collectSlots(template) {
  const slots = new Set();
  for (const section of template.sections) {
    if (section.slots) section.slots.forEach(s => slots.add(s));
  }
  return Array.from(slots);
}

/**
 * Map copy for a single page using heuristic matching.
 */
async function mapPageCopy(pageEntry, emit) {
  const templateJson = await readFile(pageEntry.templatePath, 'utf-8');
  const template = JSON.parse(templateJson);
  const requiredSlots = collectSlots(template);

  if (requiredSlots.length === 0) {
    emit(`  ${pageEntry.pageType}: No slots to fill.`);
    return;
  }

  emit(`  ${pageEntry.pageType}: Matching ${requiredSlots.length} slots from copy...`);

  // Parse copy into blocks
  const blocks = parseBlocks(pageEntry.copyRaw);
  emit(`  ${pageEntry.pageType}: Found ${blocks.length} content blocks in document.`);

  // Match blocks to slots
  const matched = {};
  const usedBlocks = new Set();

  for (const block of blocks) {
    const slotName = matchSlot(block.heading);
    if (slotName && requiredSlots.includes(slotName) && !matched[slotName]) {
      if (ARRAY_SLOTS.includes(slotName)) {
        matched[slotName] = parseArrayContent(block.content, slotName);
      } else {
        matched[slotName] = block.content;
      }
      usedBlocks.add(block.heading);
    }
  }

  pageEntry.copySlots = matched;
  pageEntry.missingSlots = requiredSlots.filter(s => !matched[s]);

  const mappedCount = Object.keys(matched).length;
  if (pageEntry.missingSlots.length > 0) {
    emit(`  ${pageEntry.pageType}: Mapped ${mappedCount}/${requiredSlots.length} slots. Missing: ${pageEntry.missingSlots.join(', ')}`);
  } else {
    emit(`  ${pageEntry.pageType}: All ${requiredSlots.length} slots mapped. ✓`);
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
    emit(`Mapping complete with ${totalMissing} unmapped slot(s). Claude Code will review and fill these.`);
  } else {
    emit('Mapping complete. All slots filled. ✓');
  }
}
