# CLAUDE.md — Frontend Website Rules

## Always Do First
- **Invoke the `frontend-design` skill** before writing any frontend code, every session, no exceptions.

## Reference Images
- If a reference image is provided: match layout, spacing, typography, and color exactly. Swap in placeholder content (images via `https://placehold.co/`, generic copy). Do not improve or add to the design.
- If no reference image: design from scratch with high craft (see guardrails below).
- Screenshot your output, compare against reference, fix mismatches, re-screenshot. Do at least 2 comparison rounds. Stop only when no visible differences remain or user says so.

## Input Separation Rules

Three inputs feed every page build. Each has a strict, non-overlapping role:

### 1. Reference Design → Structure Only
The reference provides ONLY visual structure:
- Section layout and ordering
- Column counts and grid patterns
- Visual hierarchy (what's big, what's small, what's emphasized)
- Component patterns (hero style, card layout, testimonial format, CTA placement)
- Spacing rhythm and decorative elements (dividers, background shapes, icons)

**NEVER copy from the reference:** headings, subheadings, body text, button labels, CTAs, testimonials, stats, bios, product names, company names, or any written content. The reference is a visual blueprint — treat all its text as if it were lorem ipsum.

### 2. Uploaded Copy → All Text Content
The uploaded copy document (Google Doc, .docx, or text file) provides ALL text:
- Every heading and subheading
- All body paragraphs
- Button labels and CTA text
- Testimonials and social proof
- Stats, numbers, and data points
- Speaker/author bios
- Navigation labels and footer text

**Copy completeness rule:** Every text element in the output must come from the uploaded copy document. If the copy document doesn't have content for a section that the reference shows, use a clearly marked placeholder: `[COPY NEEDED: section description]`. Never fill gaps with text from the reference.

### 3. Brand Document → All Visual Tokens
The brand document (`brand.md`, style guide, or brand assets folder) provides ALL visual styling:
- Colors — use exact hex values from the brand document
- Fonts — use exact font names from the brand document
- Logo files and usage rules
- Spacing conventions and design patterns
- Decorative patterns, textures, or motifs

**Never derive colors or fonts from the reference.** If the reference uses blue and the brand document specifies burgundy, the output must be burgundy. The brand document always wins for visual tokens.

### 4. Real Assets Rule
Always check `clients/[name]/brand/assets/` for photos, logos, and images before using any placeholder. Use real asset files — NEVER generate inline SVG placeholders or base64 data URIs when real files exist in the assets folder. Only fall back to `https://placehold.co/WIDTHxHEIGHT` when no real asset is available for that slot.

### Conflict Resolution
If inputs conflict, this is the priority order:
1. **Uploaded copy** wins for all text content
2. **Brand document** wins for all visual tokens (colors, fonts, logos)
3. **Reference design** wins for layout structure only

## Local Server
- **Always serve on localhost** — never screenshot a `file:///` URL.
- Start the dev server: `node serve.mjs` (serves the project root at `http://localhost:3000`)
- `serve.mjs` lives in the project root. Start it in the background before taking any screets.
- If the server is already running, do not start a second instance.

## Screenshot Workflow
- Puppeteer is installed at `C:/Users/nateh/AppData/Local/Temp/puppeteer-test/`. Chrome cache is at `C:/Users/nateh/.cache/puppeteer/`.
- **Always screenshot from localhost:** `node screenshot.mjs http://localhost:3000`
- Screenshots are saved automatically to `./temporary screenshots/screenshot-N.png` (auto-incremented, never overwritten).
- Optional label suffix: `node screenshot.mjs http://localhost:3000 label` → saves as `screenshot-N-label.png`
- `screenshot.mjs` lives in the project root. Use it as-is.
- After screenshotting, read the PNG from `temporary screenshots/` with the Read tool — Claude can see and analyze the image directly.
- When comparing, be specific: "heading is 32px but reference shows ~24px", "card gap is 16px but should be 24px"
- Check: spacing/padding, font size/weight/line-height, colors (exact hex), alignment, border-radius, shadows, image sizing

## Output Defaults
- Single `indexl` file, all styles inline, unless user says otherwise
- Tailwind CSS via CDN: `<script src="https://cdn.tailwindcss.com"></script>`
- Placeholder images: `https://placehold.co/WIDTHxHEIGHT`
- Mobile-first responsive

## Brand Assets
- Always check the `brand_assets/` folder before designing. It may contain logos, color guides, style guides, or images.
- If assets exist there, use them. Do not use placeholders where real assets are available.
- If a logo is present, use it. If a color palette is defined, use those exact values — do not invent brand colors.

## Anti-Generic Guardrails
- **Colors:** Never use default Tailwind palette (indigo-500, blue-600, etc.). Pick a custom brand color and derive from it.
- **Shadows:** Never use flat `shadow-md`. Use layered, color-tinted shadows with low opacity.
- **Typography:** Never use the same font for headings and body. Pair a display/serif with a clean sans. Apply tight tracking (`-0.03em`) on large headings, generous line-height (`1.7`) on body.
- **Gradients: Layer multiple radial gradients. Add grain/texture via SVG noise filter for depth.
- **Animations:** Only animate `transform` and `opacity`. Never `transition-all`. Use spring-style easing.
- **Interactive states:** Every clickable element needs hover, focus-visible, and active states. No exceptions.
- **Images:** Add a gradient overlay (`bg-gradient-to-t from-black/60`) and a color treatment layer with `mix-blend-multiply`.
- **Spacing:** Use intentional, consistent spacing tokens — not random Tailwind steps.
- **Depth:** Surfaces should have a layering system (base → elevated → floating), not all sit at the same z-plane.

## Hard Rules
- Do not add sections, features, or content not in the reference
- Do not "improve" a reference design — match it
- Do not stop after one screenshot pass
- Do not use `transition-all`
- Do not use default Tailwind blue/indigo as primary color
