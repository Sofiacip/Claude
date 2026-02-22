# PageForge

An AI-powered landing page automation pipeline for marketing agencies.
Takes a written client brief and automatically generates, QA-validates, and deploys a fully functional Elementor landing page to WordPress.

---

## Pipeline Overview

```
Brief JSON  →  [1] briefParser
            →  [2] uxGenerator   (Claude fills template slots)
            →  [3] uxQA          (Playwright screenshot + Claude vision QA)
            →  [4] notifier      (Resend email with approve/revise buttons)
            →  [5] approvalGate  (webhook — human clicks Approve or Revise)
            →  [6] codeGenerator (Claude maps HTML → Elementor JSON)
            →  [7] codeQA        (element map diff + Claude fix loop)
            →  [8] deployer      (WordPress REST API POST + live check)
```

Each stage passes a `RunContext` object to the next. Logs are written to `logs/{runId}.json` on success or failure.

---

## Requirements

- **Node.js 20 LTS** or later
- **npm** (or your preferred package manager)
- **Anthropic API key** — [console.anthropic.com](https://console.anthropic.com)
- **WordPress site** with Application Passwords enabled and Elementor installed
- **Resend account** — [resend.com](https://resend.com) (free tier is sufficient)
- A publicly reachable URL for the webhook server (ngrok works for local dev)

---

## Setup

### 1. Install dependencies

```bash
cd pageforge
npm install
npx playwright install chromium
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in every value:

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `WP_URL` | Full WordPress URL, e.g. `https://yoursite.com` |
| `WP_USER` | WordPress username |
| `WP_APP_PASSWORD` | WordPress Application Password (Settings → Users → Application Passwords) |
| `RESEND_API_KEY` | Resend API key |
| `REVIEWER_EMAIL` | Email address to receive review notifications |
| `WEBHOOK_BASE_URL` | Publicly reachable base URL for approval webhooks, e.g. `https://abc.ngrok.io` |
| `WEBHOOK_PORT` | Local port for webhook server (default: `3001`) |
| `UX_QA_MAX_ITERATIONS` | Max UX QA retry loops (default: `3`) |
| `CODE_QA_MAX_ITERATIONS` | Max Elementor code QA loops (default: `2`) |
| `APPROVAL_TIMEOUT_HOURS` | Hours before auto-rejecting an unanswered review (default: `4`) |

### 3. Enable WordPress Application Passwords

1. In WordPress admin go to **Users → Profile**
2. Scroll to **Application Passwords**
3. Enter a name (e.g. `PageForge`) and click **Add New Application Password**
4. Copy the generated password into `WP_APP_PASSWORD` in your `.env`

> **Note:** Elementor must be installed and activated on the target WordPress site for the deployed pages to render correctly.

---

## Running the Pipeline

```bash
node pipeline.js ./briefs/example.json
```

Or with a custom brief:

```bash
node pipeline.js ./briefs/my-client-brief.json
```

The pipeline will:
1. Parse and validate your brief
2. Generate an HTML wireframe using the specified template
3. QA the wireframe with a Playwright screenshot + Claude vision review
4. Email the wireframe to your reviewer with Approve / Revise buttons
5. **Wait** for the reviewer to click one of those buttons (webhook)
6. If approved: generate Elementor JSON, QA it, and deploy to WordPress
7. Log the full run to `logs/{runId}.json`

---

## Brief Format

Create a JSON file in `briefs/`. All fields below are required unless marked optional:

```json
{
  "headline":      "Stop Guessing. Start Growing.",
  "subheadline":   "We help SaaS companies double revenue in 90 days.",
  "bodyCopy":      "Our proven growth system combines...",
  "ctaText":       "Book Your Free Strategy Call",
  "ctaUrl":        "/strategy-call",
  "templateName":  "hero-single",
  "targetSlug":    "strategy-call-lp-v1",
  "brandColor":    "#2563EB",
  "reviewerEmail": "creative@agency.com"
}
```

| Field | Required | Notes |
|---|---|---|
| `headline` | ✅ | Main hero heading |
| `subheadline` | ✅ | Hero subheading |
| `bodyCopy` | ✅ | Body paragraph text |
| `ctaText` | ✅ | Button label |
| `ctaUrl` | ✅ | Button destination URL |
| `templateName` | ✅ | Subdirectory name under `templates/` |
| `targetSlug` | ✅ | WordPress page slug (lowercase, hyphens only) |
| `brandColor` | optional | Hex color, defaults to `#2563EB` |
| `reviewerEmail` | optional | Overrides `REVIEWER_EMAIL` env var for this run |

---

## Webhook Server

The approval gate requires an Express server to receive reviewer callbacks.

The server starts automatically when the pipeline reaches Stage 5. To start it independently (e.g. in a separate process before running multiple pipelines):

```bash
node server.js
```

**Endpoints:**

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness check — returns `{ status: "ok" }` |
| `GET` | `/approve/:runId` | Approve the run and proceed to code generation |
| `GET` | `/revise/:runId?notes=…` | Stop the pipeline; capture revision notes |

For local development, expose the server with [ngrok](https://ngrok.com):

```bash
ngrok http 3001
# Copy the https://…ngrok.io URL into WEBHOOK_BASE_URL in .env
```

---

## Templates

Templates live in `templates/{templateName}/` and contain two files:

### `index.html`
Standard landing page HTML with `data-slot` attributes on all dynamic elements:

```html
<h1 data-slot="headline">Placeholder</h1>
<p  data-slot="subheadline">Placeholder</p>
<a  data-slot="cta" href="#">Click here</a>
```

The UX Generator replaces slot content with brief values, then asks Claude to fill any remaining placeholders.

### `elementor-schema.json`
Defines the Elementor widget types available in this template and maps each `data-slot` to the correct widget + settings key. The Code Generator uses this schema to produce valid Elementor page JSON.

**Included template:** `hero-single` — full landing page with hero, stats bar, benefits grid, how-it-works, testimonials, and final CTA section.

---

## Project Structure

```
pageforge/
  agents/
    briefParser.js       # Stage 1: Parse + validate brief
    uxGenerator.js       # Stage 2: Generate HTML wireframe
    uxQA.js              # Stage 3: Screenshot QA loop
    notifier.js          # Stage 4: Send review email via Resend
    approvalGate.js      # Stage 5: Wait for webhook approval
    codeGenerator.js     # Stage 6: HTML → Elementor JSON via Claude
    codeQA.js            # Stage 7: Element map diff + fix loop
    deployer.js          # Stage 8: POST to WordPress REST API
  templates/
    hero-single/
      index.html             # Annotated HTML template
      elementor-schema.json  # Widget type definitions + slot mapping
  briefs/                # Input brief JSON files
  output/
    ux/                  # Generated HTML wireframes  ({runId}.html)
    elementor/           # Generated Elementor JSON   ({runId}.json)
  logs/                  # Run logs                   ({runId}.json)
  pipeline.js            # Main orchestrator
  server.js              # Express webhook server
  config.js              # Environment variable loader + validation
  .env.example           # Environment variable template
  package.json
  README.md
```

---

## Logs

Every run writes a structured log to `logs/{runId}.json`:

```json
{
  "runId": "a1b2c3d4",
  "outcome": "success",
  "startedAt": 1700000000000,
  "finishedAt": 1700000120000,
  "durationMs": 120000,
  "briefPath": "/…/briefs/example.json",
  "templateName": "hero-single",
  "deployedUrl": "https://yoursite.com/strategy-call-lp-v1/",
  "uxQAScore": 97,
  "stageLog": [
    { "stage": "briefParser",   "status": "ok", "durationMs": 45 },
    { "stage": "uxGenerator",   "status": "ok", "durationMs": 3200 },
    { "stage": "uxQA",          "status": "ok", "durationMs": 18400 },
    { "stage": "notifier",      "status": "ok", "durationMs": 4100 },
    { "stage": "approvalGate",  "status": "ok", "durationMs": 62000 },
    { "stage": "codeGenerator", "status": "ok", "durationMs": 8700 },
    { "stage": "codeQA",        "status": "ok", "durationMs": 6200 },
    { "stage": "deployer",      "status": "ok", "durationMs": 1900 }
  ],
  "error": null
}
```

---

## Tech Stack

| Concern | Library |
|---|---|
| AI / LLM | `@anthropic-ai/sdk` — `claude-sonnet-4-5` |
| Browser automation / screenshots | `playwright` (Chromium) |
| Webhook server | `express` |
| Transactional email | `resend` |
| Runtime | Node.js 20 LTS, ES modules |
| Storage | Local filesystem (no database) |

---

## Troubleshooting

**`Missing required environment variables`**
→ Ensure `.env` exists and all variables in `.env.example` are filled in.

**`Template not found`**
→ Check that `templateName` in your brief matches a subdirectory under `templates/`.

**`WordPress API returned 401`**
→ Verify `WP_USER` and `WP_APP_PASSWORD`. Application Passwords must be enabled in WordPress (Settings → General → check that it's not disabled by a plugin).

**Reviewer never receives email**
→ Check that your Resend sending domain is verified. For testing, use a Resend-verified address or the Resend sandbox.

**Webhook approval never fires**
→ Ensure `WEBHOOK_BASE_URL` is publicly reachable (use ngrok for local dev). The reviewer's browser must be able to reach that URL.

**Playwright `browser.launch()` fails**
→ Run `npx playwright install chromium` to install the browser binary.
