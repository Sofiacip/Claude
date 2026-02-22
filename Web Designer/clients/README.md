# PageCraft — Client Setup Guide

## Starting a New Client

### 1. Copy the template
```bash
cp -r clients/_template clients/[client-name]
```
Use lowercase, hyphenated names: `acme-corp`, `jane-coaching`, `product-launch`

### 2. Fill in `brief.md`
Open `clients/[client-name]/brief.md` and set:
- **Copy Source** — your published Google Doc URL
  - In Google Docs: File → Share → Publish to web → select "Entire document" → Publish → copy the URL
- **Reference Design** — either a screenshot file path or a URL to replicate
- **Notes** — any special instructions

### 3. Add brand assets
Edit `clients/[client-name]/brand/brand.md`:
- Fill in all hex color values
- Set heading and body font names (must be available on Google Fonts)
- Add logo file path

Drop your logo into `clients/[client-name]/brand/` (SVG preferred, PNG accepted).

### 4. Add reference design (if using screenshot)
Drop your reference screenshot into:
```
clients/[client-name]/reference/reference.png
```
Accepted formats: `.png`, `.jpg`, `.webp`

### 5. Run the pipeline
Tell Claude:
```
Run the PageCraft pipeline for client: [client-name]
```

Claude will automatically run all 5 stages:
1. Ingest (fetch copy + reference + brand)
2. Build (generate index.html)
3. QA loop (screenshot → compare → fix, min 2 rounds)
4. Approval gate (you review and confirm)
5. Deploy (push to GitHub + Vercel)

---

## Folder Structure (per client)

```
clients/[name]/
├── brief.md              ← 3 inputs: copy URL, reference, brand path
├── brand/
│   ├── brand.md          ← Colors, fonts, design rules
│   └── logo.svg          ← Logo file (SVG or PNG)
├── reference/
│   └── reference.png     ← Reference design screenshot
└── output/
    └── index.html        ← Final built page (auto-generated, do not edit manually)
```

---

## Existing Clients

| Client | Status | Live URL |
|--------|--------|----------|
| _(none yet)_ | — | — |

---

## Requirements

- Google Doc must be published to web (not just shared with link)
- Logo should be SVG for best quality, but PNG works
- Reference screenshot should be at least 1440px wide
- All brand hex colors must be 6-digit format: `#1A2B3C`
