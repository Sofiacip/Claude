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

  return blocks;
}

/**
 * Parse copy for a single page into content blocks.
 */
function mapPageCopy(pageEntry, emit) {
  const blocks = parseBlocks(pageEntry.copyRaw);
  pageEntry.copyBlocks = blocks;

  emit(`  ${pageEntry.pageType}: Parsed ${blocks.length} content blocks from copy document.`);
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
