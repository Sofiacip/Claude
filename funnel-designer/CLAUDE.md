# CLAUDE.md — Funnel Designer

## Foundation
This project inherits ALL rules from the Web Designer CLAUDE.md.
The full Web Designer ruleset applies here without exception. This file adds
funnel-specific rules on top — it overrides nothing.

## Always Do First
- Invoke the `frontend-design` skill before writing any frontend code, every session, no exceptions.
- Read this entire CLAUDE.md before starting any page build.

## Reference Images
- If a reference image or URL is provided: match layout, spacing, typography, and color exactly.
- Reference design takes priority over brand guide when they conflict.
- Do at least 2 comparison rounds minimum. In funnel QA, do at least 3 rounds.

## Local Server
- Always serve on localhost — never screenshot a `file:///` URL.
- Start: `node serve.mjs` (serves project root at http://localhost:3000)
- Each page served at sequential ports: 3000–3005 (one per funnel page).
- If the server is already running, do not start a second instance.

## Screenshot Workfloys screenshot from localhost: `node screenshot.mjs http://localhost:3000`
- Screenshots saved to `./temporary screenshots/screenshot-N.png` (auto-incremented)
- Screenshot at 375px (mobile), 768px (tablet), and 1280px (desktop) for every page
- After screenshotting, read the PNG with the Read tool and analyze it
- Be specific when comparing: "heading is 32px but template shows ~24px", etc.

## Output Defaults
- Single `index.html` per page, all styles inline
- Tailwind CSS via CDN: `<script src="https://cdn.tailwindcss.com"></script>`
- Placeholder images: `https://placehold.co/WIDTHxHEIGHT` — only where no real asset exists
- Mobile-first responsive — always

## Brand Assets
- Always check `brand_assets/` before designing. Use real assets — no placeholders where real assets exist.
- If a logo is present, use it. If a color palette is defined, use those exact values.
- Brand asset folder structure: logos/, photos/, colors.md, fonts.md, brand_guide.md

## Anti-Generic Guardrails (inherited — never ovhese)
- Colors: Never use default Tailwind palette. All colors come from brand package.
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

Sticky CTA specs: full width on mobile, centektop, primary brand
color, disappears or merges when user reaches the main CTA section.

## Funnel Types
This tool supports multiple funnel types. Each funnel type has its own folder
inside `templates/` with one JSON file per page. The pipeline is identical for
all funnel types — only the templates change.

Current funnel types:
- webinar (6 pages: landing, upgrade, upsell, thank_you, replay, sales)

Planned funnel types (templates to be added later):
- low_ticket
- summit
- challenge

When a new funnel type is added, create a new folder under `templates/` with
the appropriate JSON files. No other part of the system changes.

## Funnel-Specific QA Checklist
In addition to standard visual QA, verify per page:
- [ ] All template sections present in correct order (per JSON template file)
- [ ] No copy slots remaining unfilled (no [brackets] in live page)
- [ ] All CTA buttons have correct href — no `#` placeholders
- [ ] Anchor links work (#form scrolls to form, etc.)
- [ ] Countdown timer present where tete requires it (landing, upgrade, upsell)
- [ ] Progress bar present on upgrade and upsell pages
- [ ] Decline link present on upgrade and upsell pages (loss-framing copy)
- [ ] 1-click note present on upsell page
- [ ] Value stack shows struck-through original price
- [ ] No navigation on: landing_page, upgrade_page, upsell_page, thank_you_page
- [ ] Full navigation on: replay_page, sales_page (optional)

## Hard Rules
- Do not add sections not in the template
- Do not improve a template — follow it
- Do not stop after one screenshot pass
- Do not use `transition-all`
- Do not use default Tailwind blue/indigo as primary color
- Do not use pure black (#000) or pure white (#fff) — use #0f0f0f and #f5f5f5
- Do not leave placeholder copy in any deployed page
- Do not deploy without passing the approval gate