# Quality Patterns — Web Designer → Funnel Designer Propagation Guide

> Reference document for replicating Web Designer quality improvements in funnel-designer.
> Each section includes the pattern, key file paths, and adaptation notes.

---

## 1. Input Separation Pattern

**Problem solved:** Claude mixes text from the reference design into output, uses reference colors instead of brand colors, or invents content not in the copy doc.

**How it works:** Three inputs have strictly non-overlapping roles, enforced by CLAUDE.md rules and PIPELINE.md data contracts.

| Input | Provides | Never provides |
|-------|----------|----------------|
| Reference design | Layout structure, section order, grid patterns, component types | Any text content (treat all reference text as lorem ipsum) |
| Copy document | ALL text — headings, body, CTAs, testimonials, stats, bios | Colors, fonts, visual tokens |
| Brand document | ALL visual tokens — hex colors, font names, logos, spacing | Text content |

**Conflict resolution priority:** Copy > Brand > Reference.

**Key enforcement points:**
- `PIPELINE.md` Stage 1 produces three locked artifacts: `copyMap` (verbatim text), `layoutAnalysis` (structure only), `brandTokens` (visual tokens only)
- `PIPELINE.md` Stage 2 has a 7-item Brand Application Checklist confirmed before writing HTML
- `CLAUDE.md` "Input Separation Rules" section defines the three roles explicitly
- `utils/qa-scorer.mjs` → `scoreContentQuality()` penalizes contamination patterns (example.com, John Doe, ACME Corp)

**Common failure modes:**
- Headline text copied from reference instead of copy doc
- Brand colors ignored in favor of reference screenshot colors
- Sections added that exist in reference but have no matching copy

**Detection:** `scoreContentQuality()` checks for placeholder markers (`[COPY NEEDED: ...]`), contamination patterns, and missing brand terms.

**Funnel-designer adaptation:** Apply per-page. Each page in a funnel has its own copy doc section, its own reference URL, but shares the same brand tokens. The `copyMap` contract needs a page-level wrapper: `{ landing: { hero, features, ... }, sales: { hero, features, ... } }`.

---

## 2. Brand Compliance Validation

**Problem solved:** Output uses default Tailwind blues, generic fonts, or placeholder SVGs instead of real brand assets.

**Key file:** `utils/validate-html.mjs`

**Functions to port:**

| Function | What it checks | Severity |
|----------|---------------|----------|
| `checkBrandColors(html, brandColors, errors, warnings)` | Every brand hex present in HTML (case-insensitive). Primary/secondary missing = error; others = warning | High |
| `checkBrandFonts(html, brandFontSpec, errors, warnings)` | Both heading and body font names present in HTML. Missing = error | High |
| `checkRealAssets(html, brandAssetsPath, errors, warnings)` | SVG data URI placeholders detected. All images being SVG = error | Medium |
| `checkDefaultTailwindColors(html, errors)` | 20+ default Tailwind blue/indigo hex values. First match = error | High |

**Brand spec parsing:** `qa-scorer.mjs` → `parseBrandSpec(markdown)` extracts colors (role → hex), fonts (heading/body), brand terms, and don'ts from a `brand.md` file. Role normalization handles labels like "Primary (Duchess Burgundy)" → `primary`.

**Funnel-designer adaptation:** Brand validation runs identically per page — the brand spec is shared across all funnel pages. Run `checkBrandColors` + `checkBrandFonts` + `checkDefaultTailwindColors` on every generated HTML file. The `brandAssetsPath` should point to the shared `brand/assets/` directory.

---

## 3. Typography & Spacing Validation

**Problem solved:** Headings and body text are visually indistinguishable, line-heights are cramped or ballooned, uppercase text lacks tracking, content stretches edge-to-edge on wide screens.

**Key file:** `utils/validate-html.mjs`

**Typography checks** (`checkTypographyMetrics`, opt-in via `{ checkTypography: true }`):
- Font-size hierarchy: warns if smallest heading size <= largest body size
- Line-height ranges: headings 1.0–1.3, body 1.5–2.0 (unitless)
- Letter-spacing on uppercase: warns if `text-transform: uppercase` lacks `letter-spacing`
- Uses `parseSizeToPx()` to normalize rem/em to px (16px base)

**Spacing checks** (`checkSpacingConsistency`, opt-in via `{ checkSpacing: true }`):
- Section padding consistency: warns when max/min vertical padding ratio > 3:1
- Max-width containment: warns if no `max-width`, `max-w-*`, or `container` class found

**Contrast check** (`checkColorContrast`, opt-in via `{ checkContrast: true }`):
- Parses inline `color` + `background-color` pairs
- Warns when contrast ratio < 4.5:1 (WCAG AA)

**Acceptable ranges (currently hardcoded):**
- Heading line-height: 1.0–1.3
- Body line-height: 1.5–2.0
- Section padding ratio: <= 3:1
- Contrast: >= 4.5:1

**Funnel-designer adaptation:** These checks are content-agnostic — they work on any HTML. Enable all three opt-in checks when scoring funnel pages. Consider per-brand overrides for line-height ranges if a brand's typography system uses tighter or looser defaults.

---

## 4. QA Scoring System

**Problem solved:** No objective measure of output quality. "Looks good" is subjective; the scorer provides a repeatable numeric gate.

**Key file:** `utils/qa-scorer.mjs` — exports `scoreOutput(htmlPath, options)`

**Weighted formula (score 0–10):**

| Category | Weight | Key penalties |
|----------|--------|---------------|
| Structure | 15% | -2.5/structural error, -1.0 missing viewport, -0.5 missing lang/title/charset |
| Brand Fidelity | 25% | -1.5/missing primary color, -3.0 no Google Fonts link, -2.0 default Tailwind color |
| Content Quality | 20% | -1.5/placeholder text (cap -5), -2.0/`[COPY NEEDED]` (cap -6), -1.0/contamination |
| Typography | 15% | -2.0 same heading+body font, -2.0 no font-size declarations, -1.0 no letter-spacing on uppercase |
| Asset Quality | 10% | -3.0 no images, -4.0 all SVG placeholders, -1.5/SVG when real assets exist |
| Spacing/Layout | 10% | -2.0 no max-width, -1.5 few responsive breakpoints, -1.0 no grid/flex |
| Accessibility | 5% | -2.0 few semantic elements, -2.0 no focus styles, -3.0 light-on-light text |

**Pass threshold:** Score >= 9.

**CLI usage:** `node utils/qa-scorer.mjs path/to/index.html --brand brand.md --assets brand/assets/`

**Funnel-designer adaptation:** Run the scorer on each page independently. A funnel passes only when ALL pages score >= 9. Consider a funnel-level aggregation: weighted average across pages, or minimum-page-score as the funnel score. The scorer is a standalone module — copy `utils/qa-scorer.mjs` (and its dependency `utils/validate-html.mjs`) directly into funnel-designer.

---

## 5. Self-Heal Strategies

**Problem solved:** Small, predictable errors (missing Tailwind CDN, wrong fonts, broken image paths) previously required full regeneration. Self-heal fixes them automatically.

**Key file:** `utils/self-heal.mjs` — exports `selfHeal(htmlPath, options)`

**Auto-fix strategies (write the file back):**

| Strategy | Function | What it fixes |
|----------|----------|---------------|
| 1 | `healMissingTailwind(html)` | Injects Tailwind CDN `<script>` before `</head>` |
| 2 | `healWrongFonts(html, brandSpec)` | Replaces 25+ generic fonts (Arial, Roboto, Inter...) with brand heading/body fonts in both inline styles and Tailwind config |
| 3 | `healBrokenImages(html, htmlPath)` | Resolves broken image paths using a 4-tier match: exact filename → basename → hash-prefix → fuzzy substring |
| 4 | `healBrandColors(html, brandSpec)` | Injects missing brand colors into Tailwind config, fixes `body { background: #fff }` → brand background |
| 5 | `healPlaceholderImages(html, brandAssetsPath)` | Replaces `data:image/svg+xml` placeholders with real assets, using alt-text matching and logo/photo slot inference |

**Detect-and-flag strategies (produce prompt for regeneration):**

| Strategy | Function | What it detects |
|----------|----------|-----------------|
| 6 | `detectPlaceholderText(html)` | Lorem ipsum, bracket placeholders, template variables, TODO/FIXME markers |
| 7 | `detectMissingSections(errors)` | Sections expected from copy but absent in output |

**Emergency recovery:** `recoverHTML(html, brandConfig)` rebuilds a valid HTML5 skeleton for catastrophically broken output, transplanting salvageable content.

**Prompt generation:** `buildPrompt(issues, htmlPath, brandSpec, unresolvedImages)` creates a targeted fix prompt listing missing sections, placeholder text locations (with line numbers), unresolved images, and brand spec reminders.

**Funnel-designer adaptation:** Self-heal runs per-page, so the existing functions work without modification. The key change is orchestration: funnel-designer must loop `selfHeal()` across all pages in the funnel. `healBrokenImages` needs the correct `htmlPath` per page so relative path resolution works. Share `brandSpec` across all pages. Consider a funnel-level `selfHealAll(pages, brandSpec)` wrapper that collects all unresolved issues into a single prompt.

---

## 6. Pipeline Enhancement Patterns

**Problem solved:** Unstructured instructions led to inconsistent output. Structured data contracts and explicit checklists eliminated ambiguity.

**Key file:** `PIPELINE.md`

### Pattern A: Structured Copy Extraction

Instead of "read the copy doc and build a page," the pipeline extracts copy into a typed `copyMap`:

```
copyMap = {
  hero:         { headline, subheadline, bodyText, cta },
  features:     [{ title, description }],
  testimonials: [{ quote, author, role }],
  about:        { headline, bodyText },
  stats:        [{ value, label }],
  cta:          { headline, bodyText, buttonText },
  footer:       { copyright, links }
}
```

**Rule:** Copy verbatim — no paraphrasing, no shortening, no grammar correction.

### Pattern B: Brand Application Checklist

7 items confirmed before writing any HTML:
1. Tailwind config has brand hex values as custom colors
2. Google Fonts link loads both brand fonts
3. Primary color on all CTA buttons
4. Backgrounds alternate between brand bg and bgAlt (never plain `#fff`/`#000`)
5. Text color uses brand token, not hardcoded black
6. Accent color applied to highlights
7. Zero default Tailwind palette colors

### Pattern C: Asset Resolution Priority

```
Priority 1: Real file from brand/assets/ (photos/, logos/)
Priority 2: placehold.co URL fallback
Never:      Inline SVG data URIs or base64
```

Assets are copied into the output directory before build so relative paths work.

### Pattern D: QA Loop (Minimum 2 Rounds)

Each round: screenshot → compare vs reference (specific measurements) → run scorer → fix → repeat. Stop only when no visible differences AND score >= 9.

### Pattern E: Pre-Deploy Gate

`validatePreDeploy(stagingDir)` checks: valid vercel.json, no zero-byte images, HTML passes validation, no placeholder text. Returns `{ pass, issues }`.

**Funnel-designer adaptation:** Pattern A needs a page-level wrapper. Pattern B is identical per page. Pattern C must resolve assets relative to each page's output directory. Pattern D runs per page, with an additional cross-page consistency check (shared header/footer, consistent navigation). Pattern E runs once on the full funnel staging directory.

---

## 7. Common Regressions

**Source:** `clients/test-client/baseline-report.md`, `tests/pipeline-failures.test.mjs`

### Content Regressions

| Symptom | Root cause | Validation catch |
|---------|------------|-----------------|
| Heading text from reference, not copy doc | Input separation violated — copyMap not used | `scoreContentQuality()` contamination check |
| Paragraph truncated or missing | Copy doc section skipped during extraction | `detectMissingSections()` + `[COPY NEEDED]` penalty |
| `[COPY NEEDED: ...]` in output | Copy doc lacks content for a reference section | Content quality score penalty (-2.0 each) |
| Sections added that aren't in reference | Claude "improved" the design | Manual review required; CLAUDE.md "Hard Rules" prohibits this |

### Visual Regressions

| Symptom | Root cause | Validation catch |
|---------|------------|-----------------|
| Default Tailwind blue/indigo as primary | Brand tokens not applied | `checkDefaultTailwindColors()` error |
| Same font for headings and body | Brand font spec ignored | `scoreBrandFidelity()` -1.5 per missing font, `scoreTypography()` -2.0 same font |
| SVG data URI placeholders instead of photos | Asset resolution failed | `checkRealAssets()` + `healPlaceholderImages()` |
| Body background is plain white | `body { background: #fff }` not overridden | `healBrandColors()` auto-fixes this |
| Inline styles dominate instead of Tailwind | Build process used raw CSS | Structure score penalty for missing responsive classes |

### Structural Regressions

| Symptom | Root cause | Validation catch |
|---------|------------|-----------------|
| Tailwind config before CDN script | Build order error | `healMissingTailwind()` checks and reorders |
| Missing viewport meta | Skeleton incomplete | Structure score -1.0 |
| No responsive breakpoints | Desktop-only build | Spacing score -1.5 for few breakpoint classes |

### Pipeline Failure Scenarios (Tested)

From `tests/pipeline-failures.test.mjs`:
- Corrupt file upload → 400 with descriptive error
- EBUSY file lock → `withRetry()` retries 3x with exponential backoff
- Broken HTML → `selfHeal()` auto-fixes Tailwind + fonts
- Missing brand asset → `healBrokenImages()` returns `unresolved[]`
- SSE connection drop → watcher cleanup, server stays healthy
- Screenshot timeout → retry with backoff
- Deploy failure → retries exhaust → throws with `err.attempts`

**Funnel-designer adaptation:** All regressions apply per-page. Additional funnel-specific regressions to watch for:
- Inconsistent navigation across pages (different menu items or styles)
- Broken inter-page links (e.g., `/upgrade/` linking to wrong path)
- Brand drift between pages (first page uses brand colors, later pages revert to defaults)
- Shared components (header, footer) diverging across pages

Run validation on every page and add a cross-page consistency check that compares nav structure, header/footer HTML, and color usage across all funnel pages.

---

## File Reference

| File | What to copy/adapt |
|------|-------------------|
| `utils/validate-html.mjs` | Copy directly. All checks are HTML-in, results-out — no Web Designer coupling. |
| `utils/qa-scorer.mjs` | Copy directly. Add page-level and funnel-level aggregation wrappers. |
| `utils/self-heal.mjs` | Copy directly. Wrap in a multi-page loop for funnel use. |
| `utils/retry.mjs` | Copy directly. Generic retry utility with no module coupling. |
| `utils/logger.mjs` | Copy directly. Structured logger with correlation IDs. |
| `utils/pipeline-stage.mjs` | Copy directly. Stage wrapper with timing, error handling, abort. |
| `PIPELINE.md` | Adapt. Add per-page stage execution and cross-page consistency stage. |
| `CLAUDE.md` | Adapt. Input Separation Rules and Anti-Generic Guardrails apply as-is. Add funnel-specific rules (page linking, shared components). |
| `publish-assets.mjs` | Adapt. `validatePreDeploy()` needs to check all pages in the funnel output directory. |
