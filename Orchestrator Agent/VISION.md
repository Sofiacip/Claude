# Impact OS — Vision & Architecture Document

> This document provides persistent context to the AI agent working on Impact OS.
> Update it as the project evolves so the agent always has accurate context.

---

## What is Impact OS?

Impact OS is a comprehensive suite of AI-powered marketing tools built by Scale for Impact.
It automates the creation of complete marketing funnels for course creators and digital education companies.

## Modules

### 1. Web Designer
- Generates high-converting marketing pages from copy documents
- Outputs production-ready HTML/CSS
- Supports: landing pages, sales pages, thank-you pages, upsell pages

### 2. Funnel Designer
- End-to-end funnel generation from client intake documents
- Processes complete marketing funnels with QA loops
- Image processing and optimization built in

### 3. Brand Creator
- Analyzes client content to extract brand voice and visual identity
- Generates brand guidelines documents

### 4. AI Copywriter
- Uses 17 proprietary copywriting skills/SOPs
- Generates 30+ deliverables per funnel (landing pages, sales pages, email sequences, ad copy)
- Inputs: Product Interview Doc, Funnel Interview Doc, Brand Assets

### 5. Doc Factory
- Document generation and processing pipeline
- Google Drive API integration for automated delivery

## Tech Stack

- **Runtime:** Node.js
- **Architecture:** Standalone modules, each self-contained
- **Deployment:** Local development + ngrok tunnels for team demos
- **Integrations:** Google Drive API, ClickUp API
- **AI:** Anthropic Claude API for content generation

## Coding Standards

- ES Modules (import/export, .mjs extension)
- Async/await for all asynchronous operations
- Descriptive variable names, minimal comments (code should be self-documenting)
- Error handling: try/catch with meaningful error messages
- File structure: one module per file, index.mjs as entry point per module
- No TypeScript (plain JavaScript)

## Project Structure

```
impact-os/
├── web-designer/       # Page generation module
├── funnel-designer/    # Full funnel pipeline
├── brand-creator/      # Brand analysis & guidelines
├── copywriter/         # AI copy generation with skills
├── doc-factory/        # Document processing
├── shared/             # Shared utilities across modules
└── config/             # Configuration files
```

## Key Context for the Agent

- This is a production system used for real client work
- Changes should be backward-compatible
- When in doubt, ask (mark task as "blocked" with a clear question)
- Test with real-world inputs when possible
- Performance matters — these tools process large documents

---

*Last updated: [DATE]*
*Maintained by: Alessio Pieroni, Scale for Impact*
