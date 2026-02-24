/**
 * mapper.js — Stage 2: Parse copy documents into structured content blocks.
 * Parses copy into heading/content blocks that Claude Code uses alongside
 * the reference HTML when building pages.
 */

/**
 * Normalize a heading string for matching.
 */
function normalize(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
}

/**
 * Check if a line looks like a heading (not content).
 * A heading is: short, looks like a title, and ideally matches a known pattern.
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
 * Detect the semantic type of a content block based on heading and content patterns.
 * Checks in priority order — first match wins.
 *
 * @param {string} heading - The block heading
 * @param {string} content - The block content
 * @param {number} index - The block's position (0-based) in the page
 * @returns {string} The detected block type
 */
function detectBlockType(heading, content, index) {
  const h = (heading || '').toLowerCase();
  const c = (content || '').toLowerCase();
  const combined = h + ' ' + c;

  // 1. Testimonial — quoted text with attributions, star ratings
  if (/testimonial/.test(h)) return 'testimonial';
  if (/["""].+?["""]/.test(content) && /[—–-]\s*[A-Z]/.test(content)) return 'testimonial';
  if ((content.match(/[★⭐☆]/g) || []).length >= 3) return 'testimonial';
  if (/\bstar(s)?\b.*\brating/.test(c)) return 'testimonial';
  // Multiple lines starting with quotes followed by attribution patterns
  const lines = (content || '').split('\n').filter(l => l.trim());
  if (lines.length >= 2) {
    const quotedLines = lines.filter(l => /^[""\u201C]/.test(l.trim()) || /[—–-]\s*[A-Z]/.test(l));
    if (quotedLines.length >= 2) return 'testimonial';
  }
  // Pattern: "Name — quote" or "Name. — quote" on multiple lines
  const attrLines = lines.filter(l => /^[A-Z][a-zA-Z.]+\s*[—–-]\s*.+/.test(l.trim()));
  if (attrLines.length >= 2) return 'testimonial';

  // 2. FAQ — heading ends with ? or starts with Q:
  if (/\?\s*$/.test(heading)) return 'faq_item';
  if (/^q:/i.test(h)) return 'faq_item';
  if (/\bfaq\b|\bfrequently asked/.test(h)) return 'faq_item';
  // Content is question-answer pairs
  const qaLines = lines.filter(l => /\?\s*$/.test(l.trim()));
  if (qaLines.length >= 2 && /\banswer|\bfaq|\bquestion/.test(h)) return 'faq_item';

  // 3. Pricing / value stack — dollar amounts, pricing language
  if (/\$\d/.test(combined)) {
    if (/value of|worth|regular price|today only|total value|bonus/i.test(combined)) return 'value_stack_item';
    if (/price|pricing|payment|pay\b|cost/i.test(combined)) return 'pricing';
    return 'pricing';
  }
  if (/\bvalue of\b|\bworth\b|\bregular price\b|\btoday only\b/i.test(combined)) return 'value_stack_item';

  // 4. CTA — action words for buttons/calls to action
  if (/\bcta\b/.test(h)) return 'cta';
  if (/\b(register now|click here|buy now|join now|get instant access|add to cart|yes,?\s*i want|reserve my spot|claim your|start now|save my|enroll now|enrol now|sign up|get access|save your free spot|add to order)\b/i.test(combined)) return 'cta';

  // 5. Bio / About — about the host/guide
  if (/\b(about|meet your|your host|your guide|your teacher|your coach|who is|bio\b)/i.test(h)) return 'bio';
  if (/\babout\b.*\b[A-Z][a-z]+\b/.test(heading)) return 'bio';

  // 6. Bullet benefits — 3+ lines starting with bullets, dashes, numbers, checkmarks
  const bulletLines = lines.filter(l => /^(\d+[\.\)]\s|[-•*✓✔☑→▸]\s|—\s)/.test(l.trim()));
  if (bulletLines.length >= 3) return 'bullet_benefits';

  // 7. Guarantee — money-back, risk-free language
  if (/\b(guarantee|money.?back|refund|risk.?free|no risk)\b/i.test(combined)) return 'guarantee';

  // 8. Countdown / urgency — time-pressure language
  if (/\b(expires|limited time|only \d+ spots?|closing soon|deadline|hurry|act now|offer ends|spots remaining|last chance)\b/i.test(combined)) return 'urgency';
  if (/\bcountdown\b/i.test(h)) return 'countdown';

  // 9. Social proof — media mentions, trust signals
  if (/\b(as seen in|featured in|trusted by|featured on|appeared in|social proof)\b/i.test(combined)) return 'social_proof';
  // Check for multiple known media outlet names
  const mediaNames = ['forbes', 'abc', 'bbc', 'nbc', 'cnn', 'huffpost', 'newsweek', 'msnbc', 'good morning america', 'new york times', 'wall street journal'];
  const mediaHits = mediaNames.filter(m => combined.includes(m));
  if (mediaHits.length >= 2) return 'social_proof';

  // 10. Hero — first substantial block
  if (index === 0) return 'hero';

  // 11. Default
  return 'content';
}

/**
 * Parse a raw text document into heading→content blocks.
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

    if (isHeading) {
      if (currentHeading && currentContent.length > 0) {
        blocks.push({ heading: currentHeading, content: currentContent.join('\n').trim() });
      }
      currentHeading = cleanLine;
      currentContent = [];
    } else {
      currentContent.push(trimmed);
    }
  }

  // Push last block
  if (currentHeading && currentContent.length > 0) {
    blocks.push({ heading: currentHeading, content: currentContent.join('\n').trim() });
  }

  // Add type field to each block
  for (let i = 0; i < blocks.length; i++) {
    blocks[i].type = detectBlockType(blocks[i].heading, blocks[i].content, i);
  }

  return blocks;
}

/**
 * Parse copy for a single page into content blocks.
 */
function mapPageCopy(pageEntry, emit) {
  const blocks = parseBlocks(pageEntry.copyRaw);
  pageEntry.copyBlocks = blocks;

  // Build type summary for logging
  const typeCounts = {};
  for (const b of blocks) {
    typeCounts[b.type] = (typeCounts[b.type] || 0) + 1;
  }
  const summary = Object.entries(typeCounts).map(([t, n]) => `${n} ${t}`).join(', ');

  emit(`  ${pageEntry.pageType}: Parsed ${blocks.length} content blocks (${summary}).`);
}

/**
 * Main mapper function. Processes all pages in the job.
 */
export async function mapCopy(job, emit) {
  for (const page of job.pages) {
    if (page.copyRaw === null) {
      emit(`  ${page.pageType}: No copy document — skipping.`);
      continue;
    }
    mapPageCopy(page, emit);
  }

  const totalBlocks = job.pages.reduce((sum, p) => sum + (p.copyBlocks?.length || 0), 0);
  emit(`Mapping complete. ${totalBlocks} content blocks parsed across all pages. ✓`);
}
