# PageCraft Pipeline — Orchestration Instructions

When a user says "Run the PageCraft pipeline for client: [name]", follow these 5 stages in order.

---

## Stage 1 — Ingest

**Goal:** Collect all source material before touching any code.

1. Read `clients/[name]/brief.md` — extract the 3 inputs:
   - Copy source (Google Doc URL)
   - Reference design (file path or URL)
   - Brand document path

2. **Fetch copy** from the Google Doc:
   - Use `WebFetch` on the published Google Doc URL
   - Extract all headings, body text, CTAs, and labels
   - Organize the copy by section (hero, features, testimonials, CTA, footer, etc.)
   - If the URL is not published (returns HTML login page), stop and tell the user:
     > "The Google Doc isn't published. Go to File → Share → Publish to web, copy the link, and update brief.md."

3. **Get reference design:**
   - If `Type: screenshot` → `Read` the file at the given path (Claude will see it directly)
   - If `Type: url` → use `playwright_navigate` to load the URL, then `playwright_screenshot` to capture it; save label as `reference`
   - Study the reference carefully: note layout sections, column counts, spacing rhythm, color palette, type scale, component patterns

4. **Read brand document:**
   - Read `clients/[name]/brand/brand.md`
   - Scan `clients/[name]/brand/` with Glob for any logo/image files
   - Extract: primary color, secondary color, accent color (all as hex), heading font, body font, logo path, any design constraints

---

## Stage 2 — Build

**Goal:** Produce `clients/[name]/output/index.html`.

1. Invoke the `frontend-design` skill (mandatory before writing any HTML)

2. Follow **all** rules in `CLAUDE.md` strictly — especially:
   - No default Tailwind palette (use brand colors)
   - Layered shadows with color tinting
   - Two font families (heading ≠ body)
   - Animations on `transform`/`opacity` only
   - Every interactive element needs hover + focus-visible + active states

3. Structure the page from the reference design:
   - Match the reference layout section-by-section
   - Do NOT add sections, features, or copy not present in the reference
   - Do NOT improve or redesign — match it

4. Apply brand:
   - Use exact hex colors from brand.md — no Tailwind color shorthands for brand colors
   - Load fonts from Google Fonts CDN using the names from brand.md
   - If a logo file exists, embed it (inline SVG or `<img>` with relative path)

5. Fill in all copy from Stage 1 — replace every placeholder with real text

6. Create the output directory if it doesn't exist, then write:
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

4. **Fix all mismatches** in `clients/[name]/output/index.html`

5. After Round 2, if differences remain, continue. Stop only when:
   - No visible differences remain, OR
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
