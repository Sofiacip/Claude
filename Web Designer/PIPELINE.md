# PageCraft Pipeline — Orchestration Instructions

When a user says "Run the PageCraft pipeline for client: [name]", follow these 5 stages in order.

---

## Stage 1 — Ingest

**Goal:** Collect all source material before touching any code. Produce three structured artifacts: a **copy map**, a **layout analysis**, and a **brand token map**.

1. Read `clients/[name]/brief.md` — extract the 3 inputs:
   - Copy source (Google Doc URL)
   - Reference design (file path or URL)
   - Brand document path

2. **Fetch copy** from the Google Doc:
   - Use `WebFetch` on the published Google Doc URL
   - Extract all headings, body text, CTAs, and labels
   - If the URL is not published (returns HTML login page), stop and tell the user:
     > "The Google Doc isn't published. Go to File → Share → Publish to web, copy the link, and update brief.md."
   - **Organize copy into a structured section map** — assign every piece of extracted text to a named page section:
     ```
     copyMap = {
       hero:          { headline, subheadline, bodyText, cta },
       features:      [ { title, description, icon? }, ... ],
       testimonials:  [ { quote, author, role? }, ... ],
       about:         { headline, bodyText, image? },
       stats:         [ { value, label }, ... ],
       pricing:       { headline, bodyText, plans: [...] },
       faq:           [ { question, answer }, ... ],
       cta:           { headline, bodyText, buttonText },
       footer:        { copyright, links: [...] }
     }
     ```
   - Include only sections that exist in the doc — omit empty keys
   - If a piece of copy doesn't clearly map to a section, create a descriptive key for it (e.g., `mediaLogos`, `guarantee`, `bonuses`)
   - **Preserve copy verbatim** — do not paraphrase, shorten, expand, or correct grammar/spelling

3. **Get reference design:**
   - If `Type: screenshot` → `Read` the file at the given path (Claude will see it directly)
   - If `Type: url` → use `playwright_navigate` to load the URL, then `playwright_screenshot` to capture it; save label as `reference`
   - **Produce a structured layout analysis** of the reference:
     ```
     layoutAnalysis = {
       sectionCount: N,
       sections: [
         { name: "hero", type: "full-width", columns: 2, components: ["headline", "subheadline", "cta-button", "hero-image"] },
         { name: "social-proof", type: "logo-bar", columns: 1, components: ["media-logos"] },
         { name: "features", type: "card-grid", columns: 3, components: ["icon", "title", "description"] },
         ...
       ],
       decorativeElements: ["gradient-overlay", "divider-line", "background-pattern"],
       colorPalette: ["#hex1", "#hex2", ...],
       typographyScale: ["~64px hero", "~24px section heading", "~16px body"],
       spacingRhythm: "consistent ~80px section padding"
     }
     ```
   - **IMPORTANT: Extract structure ONLY — do not record any text content from the reference.** All copy must come from the Google Doc, never from the reference page.

4. **Read brand document and scan assets:**
   - Read `clients/[name]/brand/brand.md`
   - Scan `clients/[name]/brand/assets/` with Glob for all subdirectories and files
   - Scan `clients/[name]/brand/assets/photos/` for photo files
   - Scan `clients/[name]/brand/assets/logos/` for logo files
   - **Produce a brand token map:**
     ```
     brandTokens = {
       colors: {
         primary:   "#hex",
         secondary: "#hex",
         accent:    "#hex",
         bg:        "#hex",
         bgAlt:     "#hex",
         text:      "#hex"
       },
       fonts: {
         heading: "Font Name",
         body:    "Font Name"
       },
       logo: {
         header: "logos/filename.ext",
         footer: "logos/filename.ext"
       },
       assets: {
         photos: ["photos/file1.jpg", "photos/file2.png", ...],
         logos:  ["logos/file1.png", "logos/file2.svg", ...]
       }
     }
     ```
   - List every file found in `assets/photos/` and `assets/logos/` — these are available for use in Stage 2
   - If brand.md defines specific roles for assets (e.g., "header logo", "footer logo"), note those mappings

---

## Stage 2 — Build

**Goal:** Produce `clients/[name]/output/index.html` with correct brand, layout, and copy.

### Pre-build: Brand Application Checklist

Before writing any HTML, verify all of these. Do not proceed until every item is confirmed:

- [ ] **Tailwind config** includes brand hex values as custom colors (e.g., `colors: { brand: { primary: '#8B1A3A', ... } }`)
- [ ] **Google Fonts `<link>`** loads both heading and body fonts from `brandTokens.fonts`
- [ ] **Primary color** is used on all CTA buttons and primary interactive elements
- [ ] **Background colors** alternate between brand bg and bgAlt across sections (never plain white `#fff` or plain black `#000` unless those are the brand colors)
- [ ] **Text color** uses `brandTokens.colors.text` — not hardcoded black (`#000`) or Tailwind's default gray
- [ ] **Accent color** is used for highlights, links, decorative elements
- [ ] **No default Tailwind palette** colors appear anywhere (no `blue-600`, `indigo-500`, etc.)

### Build Steps

1. **Invoke the `frontend-design` skill** (mandatory before writing any HTML)

2. **Follow all rules in `CLAUDE.md`** strictly — especially:
   - No default Tailwind palette (use brand colors)
   - Layered shadows with color tinting
   - Two font families (heading ≠ body)
   - Animations on `transform`/`opacity` only
   - Every interactive element needs hover + focus-visible + active states

3. **Structure the page from the layout analysis:**
   - Match the reference layout section-by-section using `layoutAnalysis.sections`
   - Reproduce the same section count, section order, column configurations, and component patterns
   - Do NOT add sections, features, or copy not present in the reference
   - Do NOT improve or redesign — match it

4. **Resolve assets** for each image slot in the layout:
   - **Priority order:** real asset from `brandTokens.assets` > placeholder
   - For each image slot, check `brand/assets/photos/` and `brand/assets/logos/` for a matching file
   - Use relative paths from the output directory: `<img src="photos/filename.ext">` or `<img src="logos/filename.ext">`
   - When the output file is at `clients/[name]/output/index.html`, asset paths are relative to `clients/[name]/output/`
   - **Before building, copy (or symlink) all brand assets into the output directory** so relative paths resolve:
     - Copy `clients/[name]/brand/assets/photos/` → `clients/[name]/output/photos/`
     - Copy `clients/[name]/brand/assets/logos/` → `clients/[name]/output/logos/`
   - Only use `https://placehold.co/WIDTHxHEIGHT` placeholder SVGs when no real asset exists for a slot
   - For the header logo, use `brandTokens.logo.header`; for the footer logo, use `brandTokens.logo.footer`

5. **Map copy to sections** — for each section in the layout:
   - Find the corresponding entry in `copyMap` from Stage 1
   - Insert the **exact copy text** — do not paraphrase, shorten, expand, or rewrite
   - If a layout section has no matching copy (e.g., a decorative divider), leave it as a visual-only element
   - If copy exists for a section not in the layout, do NOT add a new section for it — skip that copy
   - **Checklist after copy insertion:**
     - [ ] Every `copyMap` section that has a layout match is represented on the page
     - [ ] No placeholder text (`Lorem ipsum`, `Your headline here`, etc.) remains
     - [ ] CTA button text matches `copyMap` exactly
     - [ ] Testimonial quotes, names, and roles match `copyMap` exactly

6. **Create the output directory** if it doesn't exist, then write:
   ```
   clients/[name]/output/index.html
   ```
   Single file, all styles inline (no external CSS files), Tailwind via CDN.

---

## Stage 3 — QA Loop

**Goal:** No visible differences between the built page and the reference. Minimum 2 rounds.

### Each round:

1. **Start the dev server** (if not already running):
   ```
   node serve.mjs --dir clients/[name]/output
   ```
   Run in background. If port 3000 is in use, skip this step.

2. **Take a screenshot** of the built page:
   - Use `playwright_navigate` → `http://localhost:3000`
   - Use `playwright_screenshot` with `fullPage: true`
   - Save with label `round-N` (e.g., `round-1`, `round-2`)

3. **Compare** the screenshot against the reference:
   - Read both images with the Read tool
   - Check each category and note specific differences:
     - **Layout:** column count, section order, element positioning
     - **Spacing:** padding, margins, gaps between elements
     - **Typography:** font size, weight, line-height, letter-spacing
     - **Colors:** exact hex values for backgrounds, text, borders, buttons
     - **Border radius:** on cards, buttons, images
     - **Shadows:** presence, color, spread
     - **Images:** sizing, aspect ratio, overlay treatments
   - Be specific: "hero heading is 48px, reference shows ~64px" — not "heading is too small"

4. **Run the QA scorer** after taking the screenshot:
   ```
   node utils/qa-scorer.mjs clients/[name]/output/index.html
   ```
   - Include the score in your comparison notes
   - **Target score: ≥ 9**
   - If the score is below 9, the issues flagged by the scorer should be prioritized in fixes

5. **Fix all mismatches** in `clients/[name]/output/index.html`

6. After Round 2, if differences remain or the QA score is below 9, continue. Stop only when:
   - No visible differences remain AND QA score ≥ 9, OR
   - The user says to stop

---

## Stage 4 — Approval Gate

**Goal:** Get explicit user sign-off before deploying.

1. Take a final screenshot (label: `final`)
2. Read the screenshot with the Read tool so the user can see it
3. Present it to the user and ask:

   > **PageCraft QA Complete**
   >
   > Here's the final screenshot. How would you like to proceed?
   > - `yes` — deploy to Vercel
   > - `no` — discard, don't deploy
   > - `request changes: [describe what to fix]` — go back to Stage 3

4. Wait for the user's reply.
   - `yes` → proceed to Stage 5
   - `no` → stop
   - `request changes:` → apply changes, re-run QA loop, come back to Stage 4

---

## Stage 5 — Deploy

**Goal:** Push to GitHub and deploy to Vercel. Return the live URL.

1. **Ensure a git repo exists.** Check for `pagecraft-sites` remote:
   ```bash
   git remote -v
   ```
   If no remote named `pagecraft-sites` exists, ask the user:
   > "Please create a GitHub repo named `pagecraft-sites` and share the URL so I can add it as the remote."

2. **Stage and commit the client output:**
   ```bash
   git add clients/[name]/output/
   git commit -m "feat([name]): initial landing page build"
   ```

3. **Push:**
   ```bash
   git push origin main
   ```

4. **Deploy via Vercel MCP:**
   - Call `deploy_to_vercel`
   - If this is the first deploy for this client, a new Vercel project will be created
   - The project should be named `pagecraft-[name]`

5. **Return the live URL** to the user:
   > "Deployed! Live at: https://pagecraft-[name].vercel.app"

---

## Triggering the Pipeline

User command format:
```
Run the PageCraft pipeline for client: [name]
```

Claude will find the brief at `clients/[name]/brief.md` and execute all 5 stages.

---

## Error Reference

| Problem | Resolution |
|---------|-----------|
| Google Doc returns login page | User must publish to web (File → Share → Publish to web) |
| Port 3000 already in use | Skip `node serve.mjs` — server already running |
| Logo file not found | Check brand/ folder, ask user to add it, or skip logo |
| Vercel deploy fails | Check Vercel MCP connection; try re-running deploy_to_vercel |
| Git push rejected | Pull first: `git pull origin main --rebase`, then push again |
