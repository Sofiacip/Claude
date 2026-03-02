# For Impact OS — Vision & Architecture Document

> This document is loaded as context for every task the AI agent executes.
> Keep it accurate and up to date — it directly affects the quality of the agent's work.

---

## What is For Impact OS?

For Impact OS is an AI-powered marketing platform built by Scale for Impact (founded by Alessio Pieroni). It lives at app.scaleforimpact.co and automates the creation of complete marketing funnels for course creators and digital education companies.

The platform currently has six modules, with several more planned. The long-term vision is that a user answers a few questions, and the entire marketing funnel — brand guidelines, market research, copy, designed pages, videos, and ads — gets built automatically by an AI agent.

---

## Current Architecture

### Hosting & Infrastructure
- **Platform URL:** app.scaleforimpact.co
- **Frontend:** Next.js (React) with Tailwind CSS + shadcn/ui
- **Backend/Database:** Supabase (PostgreSQL + Auth + Storage)
- **Deployment:** Vercel (frontend), Hetzner VPS (backend processing)
- **AI Engine:** Claude Code CLI, authenticated with Claude Max subscription on the VPS
- **IMPORTANT:** There is NO Anthropic API integration. Everything runs through Claude Code CLI. Never reference or use the Anthropic API directly.

### How Processing Works
The web app (Next.js on Vercel) is the user interface. When a user triggers a generation (e.g., "create brand guidelines"), the request goes to the Hetzner VPS where Claude Code CLI runs the actual processing. Results are stored and displayed back in the web app.

---

## Current Modules (Live in Sidebar)

All modules are accessible from the sidebar in app.scaleforimpact.co:

### 1. Brand Creator
- **Status:** Working well
- **What it does:** Analyzes client content (sales pages, emails, webinar transcripts) to extract brand voice and visual identity
- **Output:** Brand tone of voice guidelines document
- **Code location:** `/Users/Administrator/Claude/brand creator/`

### 2. Market Researcher
- **Status:** Working well
- **What it does:** Research automation for competitive analysis and market insights
- **Output:** Market research reports
- **Code location:** `/Users/Administrator/Claude/market researcher/`

### 3. Doc Factory
- **Status:** Has technical issues — outputs fail frequently
- **What it does:** Document generation and processing pipeline with Google Drive integration for automated delivery
- **Output:** Formatted documents delivered to Google Drive
- **Code location:** `/Users/Administrator/Claude/doc factory/`

### 4. Copywriter
- **Status:** Working well (Copywriter and UI are merged into one module)
- **What it does:** Uses 17 proprietary copywriting skills/SOPs to generate 30+ marketing deliverables per funnel
- **Inputs:** Product Interview Doc, Funnel Interview Doc, Brand Assets
- **Outputs:** Landing pages, sales pages, email sequences, video scripts, ad copy, and more
- **Code location:** `/Users/Administrator/Claude/Copywriter/`

### 5. Web Designer
- **Status:** Needs significant work — many bugs and issues
- **What it does:** Generates high-converting marketing pages from copy documents
- **Outputs:** Production-ready HTML/CSS pages (landing pages, sales pages, thank-you pages, upsell pages)
- **Code location:** `/Users/Administrator/Claude/Web Designer/`

### 6. Funnel Designer
- **Status:** Needs significant work — many bugs and issues
- **What it does:** End-to-end funnel generation pipeline — orchestrates intake docs through to finished pages
- **Outputs:** Complete multi-page marketing funnels
- **Code location:** `/Users/Administrator/Claude/funnel-designer/`

---

## Priority #1: Fix What's Broken

The most urgent work is making Web Designer, Funnel Designer, and Doc Factory reliable. Common problems:
- Outputs fail frequently due to technical errors
- No self-healing — when something breaks, it stays broken until manually fixed
- No automated testing to catch regressions

The agent should focus on:
1. Understanding WHY outputs fail (run tests, read error logs)
2. Fixing the root causes
3. Adding self-healing logic so processes recover from errors automatically
4. Adding automated tests to prevent regressions

---

## Planned Feature: Unified Outputs System

Currently, outputs appear inside each module separately. The vision is a centralized **Outputs** section in the sidebar (below the modules) where the team can see ALL outputs across all modules.

### How it should work:
- New "Outputs" section at the bottom of the sidebar
- Shows all outputs in a table/list view
- Each output has a client assignment — team manually assigns outputs to clients using an "Add to Client" button
- All outputs for a given client (e.g., Growth Institute) are grouped together: brand guidelines, market research, copywriting, web designs
- Modules can pull from the Outputs library directly — for example, Web Designer can load the copywriting output for a client from Outputs instead of requiring a file upload
- This makes the workflow faster and cleaner, and enables Agent Mode

---

## Planned Feature: Bug Report Form

A form inside the platform (accessible via a button in the sidebar) that allows team members to submit bugs and feature requests.

### How it should work:
- Button in the sidebar labeled something like "Report Bug" or "Submit Feedback"
- Form fields:
  - Module selector (Web Designer, Funnel Designer, Doc Factory, Copywriter, Brand Creator, Market Researcher, UX/UI)
  - Description of the issue
  - Screenshot upload capability
  - Priority/severity indicator
- On submission, automatically creates a task in the ClickUp "For Impact OS" list (list ID: 901521692113)
- The Orchestrator Agent picks up the task and attempts to fix it
- Results are reported back on the ClickUp task as comments

---

## Planned Feature: Agent Mode

The flagship future feature. A conversational interface where a user answers a few questions, and the entire marketing funnel gets built automatically.

### The flow:
1. User provides: client website URL + product description + answers to intake questions
2. → **Brand Creator** analyzes the client and builds brand guidelines
3. → **Market Researcher** does competitive and market research
4. → **Copywriter** uses brand guidelines + research to generate all copy (landing page, sales page, emails, scripts, ads)
5. → **Funnel Designer / Web Designer** takes the copy and builds the actual designed pages
6. → Everything lands in the **Outputs** library, organized under that client

### Two modes:
- **Fully automatic:** Runs end-to-end without stopping. User gets notified when everything is done.
- **Human-in-the-loop:** Pauses at each step for approval. "Here's the brand guide — approve before I continue to copywriting?"

### Prerequisites (must be built first):
- All current modules working reliably (Priority #1)
- Unified Outputs system (so outputs flow between modules)
- A pipeline orchestrator that chains modules together

---

## Planned Future Modules

### Graphic Designer
- Template-based design system (not AI image generation)
- Uses the Nano Banana MCP for template rendering
- Creates images for funnels, ad creatives, social media assets
- Applies client branding from Brand Creator output

### Advertiser
- Manages ad campaigns across Meta (Facebook/Instagram) and Google Ads
- Future integration with Meta Ads API and Google Ads API to launch campaigns directly from the platform
- Tests different ad creatives
- Analyzes campaign performance and suggests optimizations
- Currently the team manages ads manually in Meta and Google platforms

### Videographer
- Takes scripts generated by the Copywriter
- Uses **ElevenLabs** for AI voiceover generation
- Uses **HeyGen** for AI avatar video creation
- Outputs ready-to-use marketing videos (VSLs, upsell videos, tripwire videos)

---

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js (React) + Tailwind CSS + shadcn/ui |
| Backend/DB | Supabase (PostgreSQL + Auth + Storage) |
| Frontend Hosting | Vercel |
| Processing Server | Hetzner VPS |
| AI Engine | Claude Code CLI (Max subscription) — NO Anthropic API |
| Integrations | Google Drive API, ClickUp API |
| Future Integrations | Meta Ads API, Google Ads API, ElevenLabs, HeyGen, Nano Banana MCP |

---

## Coding Standards

- ES Modules (import/export syntax, .mjs extension for standalone modules)
- Next.js conventions for the web app (App Router, TypeScript where the app uses it)
- Async/await for all asynchronous operations
- Descriptive variable names — code should be self-documenting
- Minimal comments, only where logic is non-obvious
- Error handling: try/catch with meaningful, user-friendly error messages
- Console logging for progress tracking (tools process large documents, users need feedback)
- Environment variables via .env files (never hardcode secrets)

---

## Key Business Context

- This is a **production system** used for real client work at Scale for Impact
- The agency serves course creators and digital education companies
- Clients include: Tony Robbins, Marisa Peer, Jordan Peterson, Ken Honda, Pattie Ehsaei, Humanity's Team, Terry Real, and many others
- Changes must be backward-compatible — don't break existing client workflows
- Performance matters — these tools process large documents
- The 17 copywriting skills/SOPs are core IP — treat them with care
- Currently 1 user (Alessio), but the platform will scale to ~20 team members soon

---

## Team

- **Alessio Pieroni** — Founder, reviews all agent output
- **Borcha (Borce)** — MarTech specialist, integrations and technical setup
- **Kim Mazza** — Client projects and copy
- Team of ~20 people across client delivery, design, copy, and operations

---

## Orchestrator Agent

This platform is supported by an Orchestrator Agent that:
- Watches the ClickUp "For Impact OS" list for new tasks
- Picks up tasks by priority (urgent → high → normal → low)
- Detects which module to work in based on tags, task name, or description
- Executes work via Claude Code CLI on the Hetzner VPS
- Runs QA checks after each task
- Reports results back to ClickUp as task comments
- Moves completed tasks to "Ready for Review"

### ClickUp Statuses:
- **Not Started** — ready for the agent to pick up
- **In Progress** — agent is working on it
- **Ready for Review** — agent finished, needs human review
- **Blocked** — agent couldn't complete, needs human help (comment explains why)
- **Completed** — reviewed and approved

### Important rules for the agent:
1. Read existing code before making changes
2. Make minimal, focused changes — don't refactor unrelated code
3. Test after changes — run existing tests, verify builds work
4. If a task is ambiguous, mark as "Blocked" with a clear question
5. Never modify .env files
6. Never commit secrets
7. All AI processing uses Claude Code CLI — never the Anthropic API

---

## Roadmap (In Order of Priority)

1. **Fix Web Designer, Funnel Designer, Doc Factory** — make outputs reliable and self-healing
2. **Bug Report Form** — let the team submit bugs that the agent auto-fixes
3. **Unified Outputs System** — centralized, client-organized output library
4. **Agent Mode** — fully automated funnel building from intake to finished pages
5. **Graphic Designer** — template-based design with Nano Banana MCP
6. **Advertiser** — Meta and Google Ads management and automation
7. **Videographer** — AI video production with ElevenLabs + HeyGen

---

*Last updated: March 2026*
*Maintained by: Alessio Pieroni, Scale for Impact*