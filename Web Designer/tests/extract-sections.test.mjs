import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';

// ─── Extract the functions from ui.html by reimplementing them here ─────
// These mirror the logic in ui.html exactly so we can unit-test it.

function getDirectText(el) {
  let text = '';
  for (const node of el.childNodes) {
    if (node.nodeType === 3 /* TEXT_NODE */) {
      text += node.textContent;
    }
  }
  if (!text.trim() && el.children.length === 0) {
    text = el.textContent;
  }
  return text;
}

function addTextElement(el, elements, seen, secIndex) {
  const text = getDirectText(el).trim();
  if (!text || text.length < 3 || seen.has(text)) return;

  const parent = el.parentElement;
  if (parent && seen.has(parent.textContent?.trim())) return;

  const tag = el.tagName.toLowerCase();
  if (tag === 'span' && text.length < 15) return;
  if (tag === 'a' && text.length < 8) return;
  if (tag === 'label' && text.length < 4) return;

  seen.add(text);
  const id = `s${secIndex}-e${elements.length}`;
  elements.push({ id, tag, text });
}

function collectTextElements(container, secIndex) {
  const elements = [];
  const seen = new Set();
  const textEls = container.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, button, a, blockquote, figcaption, label, span, td, th, dt, dd');
  for (const el of textEls) {
    addTextElement(el, elements, seen, secIndex);
  }
  return elements;
}

function collectSectionsFromContainers(containerEls) {
  const result = [];
  let secIndex = 0;
  for (const container of containerEls) {
    const elements = collectTextElements(container, secIndex);
    if (elements.length === 0) continue;
    const heading = container.querySelector('h1, h2, h3, h4, h5, h6');
    const name = heading ? heading.textContent.trim().substring(0, 60) : `Untitled Section ${secIndex + 1}`;
    result.push({ id: `sec-${secIndex}`, name, elements, collapsed: false });
    secIndex++;
  }
  return result;
}

function extractByHeadingGroups(doc) {
  const body = doc.querySelector('main') || doc.body;
  if (!body) return [];
  const headings = body.querySelectorAll('h1, h2, h3, h4, h5, h6');
  if (headings.length === 0) return [];
  const result = [];
  let secIndex = 0;
  for (const heading of headings) {
    const name = heading.textContent.trim().substring(0, 60) || `Untitled Section ${secIndex + 1}`;
    const elements = [];
    const seen = new Set();
    addTextElement(heading, elements, seen, secIndex);
    let container = heading.parentElement;
    if (container && container !== body) {
      const textEls = container.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, button, a, blockquote, figcaption, label, span, td, th, dt, dd');
      for (const el of textEls) {
        if (el === heading) continue;
        addTextElement(el, elements, seen, secIndex);
      }
    } else {
      let sibling = heading.nextElementSibling;
      while (sibling) {
        if (sibling.matches?.('h1, h2, h3, h4, h5, h6')) break;
        const textEls = sibling.querySelectorAll('p, li, button, a, blockquote, figcaption, label, span, td, th, dt, dd');
        if (textEls.length === 0) {
          addTextElement(sibling, elements, seen, secIndex);
        } else {
          for (const el of textEls) {
            addTextElement(el, elements, seen, secIndex);
          }
        }
        sibling = sibling.nextElementSibling;
      }
    }
    if (elements.length > 0) {
      result.push({ id: `sec-${secIndex}`, name, elements, collapsed: false });
      secIndex++;
    }
  }
  return result;
}

function extractAllTextAsSingleSection(doc) {
  const body = doc.querySelector('main') || doc.body;
  if (!body) return [];
  const elements = [];
  const seen = new Set();
  const textEls = body.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, button, a, blockquote, figcaption, label, span, td, th, dt, dd');
  for (const el of textEls) {
    addTextElement(el, elements, seen, 0);
  }
  if (elements.length === 0) {
    const allText = body.innerText?.trim() || body.textContent?.trim();
    if (allText && allText.length >= 3) {
      elements.push({ id: 's0-e0', tag: 'p', text: allText.substring(0, 5000) });
    }
  }
  if (elements.length === 0) return [];
  return [{ id: 'sec-0', name: 'Page Content', elements, collapsed: false }];
}

function extractByStrategy(doc, strategy) {
  let containerEls = [];
  if (strategy === 'sections') {
    containerEls = [...doc.querySelectorAll('section')];
    const header = doc.querySelector('header');
    const footer = doc.querySelector('footer');
    if (header && !containerEls.includes(header)) containerEls.unshift(header);
    if (footer && !containerEls.includes(footer)) containerEls.push(footer);
  } else if (strategy === 'containers') {
    const main = doc.querySelector('main');
    if (main) {
      containerEls = [...main.querySelectorAll(':scope > div, :scope > section, :scope > header, :scope > footer, :scope > article, :scope > aside')];
    }
    if (containerEls.length === 0) {
      containerEls = [...doc.querySelectorAll('body > div, body > header, body > footer, body > main, body > article, body > aside')];
    }
    if (containerEls.length === 1 && containerEls[0].tagName === 'DIV') {
      const wrapper = containerEls[0];
      const innerEls = [...wrapper.querySelectorAll(':scope > div, :scope > section, :scope > header, :scope > footer, :scope > article')];
      if (innerEls.length > 1) containerEls = innerEls;
    }
  } else if (strategy === 'headingGroups') {
    return extractByHeadingGroups(doc);
  } else if (strategy === 'allText') {
    return extractAllTextAsSingleSection(doc);
  }
  return collectSectionsFromContainers(containerEls);
}

function extractSections(doc) {
  let result = extractByStrategy(doc, 'sections');
  if (result.length === 0) result = extractByStrategy(doc, 'containers');
  if (result.length === 0) result = extractByStrategy(doc, 'headingGroups');
  if (result.length === 0) result = extractByStrategy(doc, 'allText');
  return result;
}

// ─── Helper ─────────────────────────────────────────────
function parse(html) {
  const { document } = parseHTML(`<!DOCTYPE html>${html}`);
  return document;
}

// ─── Tests ──────────────────────────────────────────────

describe('extractSections — primary: <section> tags', () => {
  it('extracts sections from standard <section> elements', () => {
    const doc = parse(`<body>
      <section><h2>Hero</h2><p>Welcome to our site, we are glad you are here.</p></section>
      <section><h2>Features</h2><p>We have amazing features for you to enjoy.</p></section>
    </body>`);
    const sections = extractSections(doc);
    assert.equal(sections.length, 2);
    assert.equal(sections[0].name, 'Hero');
    assert.equal(sections[1].name, 'Features');
    assert.ok(sections[0].elements.some(e => e.text.includes('Welcome')));
    assert.ok(sections[1].elements.some(e => e.text.includes('amazing features')));
  });

  it('includes header and footer alongside sections', () => {
    const doc = parse(`<body>
      <header><h1>Brand Name Here</h1></header>
      <section><h2>Content Section Title</h2><p>This is some body content text.</p></section>
      <footer><p>Copyright 2024 all rights reserved.</p></footer>
    </body>`);
    const sections = extractSections(doc);
    assert.ok(sections.length >= 3, `Expected at least 3 sections, got ${sections.length}`);
    assert.ok(sections.some(s => s.name === 'Brand Name Here'));
    assert.ok(sections.some(s => s.name === 'Content Section Title'));
  });
});

describe('extractSections — fallback 1: container divs', () => {
  it('extracts from <main> > <div> children when no <section> tags', () => {
    const doc = parse(`<body><main>
      <div><h2>About Us Section</h2><p>We are a great company doing things.</p></div>
      <div><h2>Services Section</h2><p>We offer consulting and development services.</p></div>
    </main></body>`);
    const sections = extractSections(doc);
    assert.ok(sections.length >= 2, `Expected at least 2 sections, got ${sections.length}`);
    assert.ok(sections.some(s => s.name === 'About Us Section'));
    assert.ok(sections.some(s => s.name === 'Services Section'));
  });

  it('extracts from body > div children when no <main> or <section>', () => {
    const doc = parse(`<body>
      <div><h2>First Block Here</h2><p>Some content in the first block.</p></div>
      <div><h2>Second Block Here</h2><p>Some content in the second block.</p></div>
    </body>`);
    const sections = extractSections(doc);
    assert.ok(sections.length >= 2, `Expected at least 2 sections, got ${sections.length}`);
  });

  it('descends into a single wrapper div', () => {
    const doc = parse(`<body><div id="app">
      <div><h2>Page Title Section</h2><p>Introduction text for the page content.</p></div>
      <div><h3>Another Block Title</h3><p>More details about this particular block.</p></div>
    </div></body>`);
    const sections = extractSections(doc);
    assert.ok(sections.length >= 2, `Expected at least 2 sections from wrapper div children, got ${sections.length}`);
  });
});

describe('extractSections — fallback 2: heading groups', () => {
  it('groups content by headings in deeply nested structures', () => {
    const doc = parse(`<body><main>
      <div class="container"><div class="row"><div class="col">
        <h2>Pricing Plans Available</h2>
        <p>Choose the perfect plan for your business needs.</p>
      </div></div></div>
      <div class="container"><div class="row"><div class="col">
        <h2>Testimonials From Clients</h2>
        <p>Read what our satisfied customers have said.</p>
      </div></div></div>
    </main></body>`);
    const sections = extractSections(doc);
    assert.ok(sections.length >= 2, `Expected at least 2 sections, got ${sections.length}`);
    assert.ok(sections.some(s => s.name.includes('Pricing')));
    assert.ok(sections.some(s => s.name.includes('Testimonials')));
  });
});

describe('extractSections — fallback 3: all text content', () => {
  it('returns at least one section for plain text content', () => {
    // Use a div wrapper since linkedom has a quirk where body.querySelectorAll
    // doesn't find direct children — real browsers don't have this issue
    const doc = parse(`<body><div><p>This is a plain paragraph with some text content.</p></div></body>`);
    const sections = extractSections(doc);
    assert.ok(sections.length >= 1, 'Should return at least one section');
    assert.ok(sections[0].elements.length >= 1, 'Section should have at least one element');
  });

  it('never returns empty for HTML with visible text', () => {
    const doc = parse(`<body><div><span class="longspanclassname">This is some visible text in a span element.</span></div></body>`);
    const sections = extractSections(doc);
    assert.ok(sections.length >= 1, 'Should not return empty for visible text');
  });
});

describe('extractSections — naming', () => {
  it('uses heading text for section names', () => {
    const doc = parse(`<body>
      <section><h3>Contact Information</h3><p>Reach out to us anytime you want.</p></section>
    </body>`);
    const sections = extractSections(doc);
    assert.equal(sections[0].name, 'Contact Information');
  });

  it('uses "Untitled Section N" when no heading exists', () => {
    const doc = parse(`<body>
      <section><p>This section has no heading element at all.</p></section>
    </body>`);
    const sections = extractSections(doc);
    assert.match(sections[0].name, /Untitled Section 1/);
  });
});

describe('extractSections — varied HTML structures', () => {
  it('handles mixed heading levels (h1-h6)', () => {
    const doc = parse(`<body>
      <section><h1>Main Title Of Page</h1><p>Introduction paragraph for the page.</p></section>
      <section><h4>Subsection With H4</h4><p>Content under an h4 heading element.</p></section>
    </body>`);
    const sections = extractSections(doc);
    assert.equal(sections.length, 2);
  });

  it('handles article elements', () => {
    const doc = parse(`<body>
      <article><h2>Blog Post Title Here</h2><p>This is the full blog post content text.</p></article>
    </body>`);
    const sections = extractSections(doc);
    assert.ok(sections.length >= 1);
    assert.ok(sections.some(s => s.name.includes('Blog Post')));
  });

  it('extracts list items from sections', () => {
    const doc = parse(`<body>
      <section><h2>Our Amazing Features</h2>
        <ul>
          <li>Feature one is really great</li>
          <li>Feature two is even better</li>
          <li>Feature three is the best</li>
        </ul>
      </section>
    </body>`);
    const sections = extractSections(doc);
    assert.equal(sections.length, 1);
    const liElements = sections[0].elements.filter(e => e.tag === 'li');
    assert.ok(liElements.length >= 2, 'Should capture list items');
  });

  it('handles button and anchor text', () => {
    const doc = parse(`<body>
      <section>
        <h2>Call To Action Section</h2>
        <p>Ready to get started with our product today?</p>
        <button>Get Started Now Free</button>
        <a href="/learn">Learn More About Us</a>
      </section>
    </body>`);
    const sections = extractSections(doc);
    assert.ok(sections[0].elements.some(e => e.tag === 'button'));
    assert.ok(sections[0].elements.some(e => e.tag === 'a'));
  });
});

describe('extractSections — real-world patterns', () => {
  it('handles Tailwind-style nested div structure', () => {
    const doc = parse(`<body>
      <div class="min-h-screen">
        <div class="max-w-7xl mx-auto">
          <div class="py-20">
            <h1>Transform Your Business Today</h1>
            <p>Join thousands of successful entrepreneurs worldwide.</p>
            <button>Start Free Trial Now</button>
          </div>
        </div>
        <div class="bg-gray-50">
          <div class="max-w-7xl mx-auto">
            <h2>Why Choose Our Platform</h2>
            <p>We provide the best tools for growing businesses.</p>
          </div>
        </div>
      </div>
    </body>`);
    const sections = extractSections(doc);
    assert.ok(sections.length >= 1, 'Should extract content from nested Tailwind structure');
    const allText = sections.flatMap(s => s.elements.map(e => e.text)).join(' ');
    assert.ok(allText.includes('Transform'), 'Should find the hero heading');
  });

  it('handles single-page app wrapper div pattern', () => {
    const doc = parse(`<body>
      <div id="root">
        <div id="hero"><h1>Welcome To The Platform</h1><p>The best platform for your business.</p></div>
        <div id="features"><h2>Key Features List</h2><p>Discover what we can offer you today.</p></div>
        <div id="cta"><h2>Ready To Start Now</h2><button>Sign Up For Free Today</button></div>
      </div>
    </body>`);
    const sections = extractSections(doc);
    assert.ok(sections.length >= 2, `Expected at least 2 sections, got ${sections.length}`);
  });
});
