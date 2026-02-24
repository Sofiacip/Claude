# CLAUDE.md — Funnel Designer

## Always Do First
- Invoke the `frontend-design` skill before writing any frontend code, every session, no exceptions.
- Read this entire CLAUDE.md before starting any page build.
- Complete the Photo Audit (see Photo Placement Rules) before writing any HTML for a page build.

## Core Architecture: Reference-Based Design
This tool builds funnel pages by **matching reference designs**. Every page type has a reference HTML file in `references/{funnel_type}/{page_type}.html`. Your job:

1. Load the reference page for the page type being built
2. Study its layout, spacing, typography hierarchy, color usage, component composition, and visual flow
3. Build the new page matching the reference layout exactly
4. Swap in the client's brand assets (logo, photos, colors, fonts) and copy
5. Screenshot, compare against reference, fix mismatches, re-screenshot
6. Do at least 3 comparison rounds per page before moving on

**The reference is your design blueprint.** Match its layout composition, spatial relationships, section groupings, and visual hierarchy. Do not simplify, flatten, or reinterpret the layout. If the reference uses a split-hero with image left and form right, your output must use a split-hero with image left and form right.

## What to Match from Reference
- Layout patterns (split columns, overlapping elements, asymmetric compositions)
- Spatial relationships between elements (what's grouped together, what's separated)
- Typography hierarchy (relative sizes, weights, font pairing pattern)
- Component composition (e.g., form embedded in hero vs. form as separate section)
- Visual density and whitespace balance
- Section background treatments and transitions
- Responsive breakpoint behavior

## What to Swap for Each Client
- Logo → from `brand_assets/logos/`
- Author/host photo → from `brand_assets/photos/`
- Color palette → from `brand_assets/colors.md`
- Font pairing → from `brand_assets/fonts.md`
- All copy (headlines, subheadlines, body text, CTA text, testimonials, etc.)
- Social proof numbers and credentials
- Media logos (As Seen In)

## Reference Images (External)
- If the user provides an external reference image or URL ON TOP of the stored reference: prioritize the external reference over the stored one.
- Match external references with the same rigor: layout, spacing, typography, color.

## Local Server
- Always serve on localhost — never screenshot a `file:///` URL.
- Start: `node serve.mjs` (serves project root at http://localhost:3000)
- Each page served at sequential ports: 3000–3005 (one per funnel page).
- If the server is already running, do not start a second instance.

## Screenshot Workflow
- Always screenshot from localhost: `node screenshot.mjs http://localhost:3000`
- Screenshots saved to `./temporary screenshots/screenshot-N.png` (auto-incremented)
- Screenshot at 375px (mobile), 768px (tablet), and 1280px (desktop) for every page
- After screenshotting, read the PNG with the Read tool and analyze it
- When comparing against reference, be specific: "heading is 32px but reference shows ~24px", "hero uses split layout but output is single-column", "form is below fold but reference has it embedded in hero"
- Check: layout composition, spacing/padding, font size/weight/line-height, colors (exact hex), alignment, border-radius, shadows, image sizing, element grouping

## Output Defaults
- Single `index.html` per page, all styles inline
- Tailwind CSS via CDN: `<script src="https://cdn.tailwindcss.com"></script>`
- Placeholder images: `https://placehold.co/WIDTHxHEIGHT` — only where no real asset exists
- Mobile-first responsive — always

## Brand Assets
- Always check `brand_assets/` before designing. Use real assets — no placeholders where real assets exist.
- If a logo is present, use it. If a color palette is defined, use those exact values.
- Brand asset folder structure: logos/, photos/, colors.md, fonts.md, brand_guide.md

## Brand Asset URLs (Pipeline)
When building funnel pages via the pipeline:
- Preview/QA: `/api/jobs/{JOB_ID}/assets/logos/{filename}` and `/api/jobs/{JOB_ID}/assets/photos/{filename}`
- Use these server-relative URLs in HTML so images render during preview and QA screenshots.
- Deploy: `../logos/{filename}` and `../photos/{filename}` (auto-rewritten by deploy.js)
- The build context from `prepareBuildContext()` includes `logoUrl` and `photoUrls` with both `preview` and `deploy` paths.
- NEVER use placehold.co for logos or author photos when real assets exist in the brand package.

## Photo Placement Rules (MANDATORY)

Before building ANY page, you MUST complete this photo audit:

### Step 1: Inventory All Brand Photos
List every file in the brand package's photos/ directory.
For each photo, note:
- Filename
- Dimensions (read the actual file)
- Content description (what/who is in the photo)
- Orientation (portrait, landscape, square)
- Best use (headshot, hero background, lifestyle, product, logo)

### Step 2: Read the Page Spec's Photo Placement Map
Open the .spec.md file for the page type you are building.
Find the '## Photo Placement Map' section.
This lists every photo slot with required dimensions and style.

### Step 3: Assign Photos to Slots
Match brand photos to page slots. Rules:
- Author/guide headshots go in Hero and About/Bio sections
- Lifestyle/action photos go as section backgrounds with overlay
- Testimonial headshots go in testimonial sections
- Brand logos go in social proof / 'As Seen In' sections
- If multiple author photos exist, use different ones in different
  sections — do not repeat the same photo

### Step 4: Log Assignments Before Building
Write out your assignments like this:
  S1 Hero → author-speaking.jpg (landscape, 1200x800, gradient overlay)
  S5 Bio → author-headshot.jpg (portrait, 600x800, rounded frame)
  S7 Testimonials → no headshots in brand package, use initials

### Hard Rules
- NEVER build a page without completing the photo audit first
- NEVER use a placeholder image when a real brand photo exists
  that fits the slot
- NEVER skip a photo slot — if the spec says a section has a
  photo, it MUST have a photo (real or placeholder)
- ALWAYS use gradient overlays on background photos
  (bg-gradient-to-t from-black/60 or brand-color variant)
- ALWAYS use the author's real photo in the hero or bio section — it is the single most impactful visual element
- Photos must use object-cover and proper aspect ratios
- Apply mix-blend-multiply for photos on colored backgrounds

## Anti-Generic Guardrails
- Colors: Never use default Tailwind palette. All colors come from brand package or derived from it.
- Shadows: Never flat `shadow-md`. Use layered, color-tinted shadows with low opacity.
- Typography: Never same font for headings and body. Pair display/serif with clean sans.
- Gradients: Layer multiple radial gradients. Add grain/texture for depth.
- Animations: Only animate `transform` and `opacity`. Never `transition-all`.
- Interactive states: Every clickable element needs hover, focus-visible, and active states.
- Images: Add gradient overlay (`bg-gradient-to-t from-black/60`) and mix-blend-multiply layer.
- Spacing: Intentional, consistent spacing tokens — not random Tailwind steps.
- Depth: Layered surface system (base → elevated → floating).

## Sticky CTA Rules
Add a sticky CTA button on these page types:
- landing_page ✓
- upgrade_page ✓
- upsell_page ✓
- sales_page ✓

Do NOT add a sticky CTA on:
- thank_you_page ✗
- replay_page ✗
- live_page ✗

Sticky CTA specs: full width on mobile, centered on desktop, fixed to top, primary brand color, disappears or merges when user reaches the main CTA section.

## Funnel Types
Current funnel types:
- webinar (6 pages: landing, upgrade, upsell, thank_you, replay, sales)

Planned funnel types (references to be added later):
- low_ticket
- summit
- challenge

When a new funnel type is added, create reference HTML pages under `references/{funnel_type}/`. No other part of the system changes.

## Funnel-Specific QA Checklist
After matching the reference design, also verify:
- [ ] All CTA buttons have correct href — no `#` placeholders
- [ ] Anchor links work (#form scrolls to form, etc.)
- [ ] Countdown timer present where page type requires it (landing, upgrade, upsell)
- [ ] Progress bar present on upgrade and upsell pages
- [ ] Decline link present on upgrade and upsell pages (loss-framing copy)
- [ ] 1-click note present on upsell page
- [ ] Value stack shows struck-through original price where applicable
- [ ] No navigation on: landing_page, upgrade_page, upsell_page, thank_you_page
- [ ] Full navigation on: replay_page, sales_page (optional)
- [ ] No placeholder copy remaining — no [brackets] in live page
- [ ] All brand assets loaded (no broken images, no placehold.co where real assets exist)

## QA Comparison Rules (MANDATORY)

During QA, you must compare the built page against the reference
side by side. For each QA round:

1. Look at the reference screenshot and the built screenshot
   at the same viewport width
2. Compare section by section. For each section, check:
   - Does the layout match? (columns, alignment, spacing)
   - Does the visual weight match? (photo size, heading size)
   - Are photos present where the reference has them?
   - Are shadows, gradients, and depth consistent?
   - Is the typography hierarchy the same?
3. Write specific feedback: 'Section 3 in built page is missing
   the author photo that appears in the reference' — not vague
   feedback like 'looks different'.
4. Fix all identified differences before the next QA round.
5. Minimum 3 comparison rounds per page. Do not approve until
   the built page visually matches the reference at all 3 widths.

The reference screenshot is the source of truth for layout.
The .spec.md file is the source of truth for design values.
The brand package is the source of truth for colors and fonts.

## Hard Rules
- Match the reference layout — do not simplify or flatten it
- Do not stop after one screenshot pass — minimum 3 rounds per page
- Do not use `transition-all`
- Do not use default Tailwind blue/indigo as primary color
- Do not use pure black (#000) or pure white (#fff) — use near-black and near-white from brand palette
- Do not leave placeholder copy in any deployed page
- Do not deploy without passing the approval gate
