# Bug Reporter — For Impact OS

Internal bug and feature request reporting service. Creates tasks in the ClickUp "For Impact OS" list with structured descriptions, tags, and optional screenshot attachments.

## Setup

```bash
cd bug-reporter
npm install
cp .env.example .env   # then fill in values
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3007` | Server port |
| `APP_PASSWORD` | Yes | — | Password for the standalone UI |
| `CLICKUP_API_TOKEN` | Yes | — | ClickUp personal API token |
| `CLICKUP_LIST_ID` | No | `901521692113` | ClickUp list ID for task creation |

## Running

```bash
# Development
node server.js

# Production (PM2)
pm2 start server.js --name bug-reporter
```

The server starts at `http://localhost:3007`.

## API Endpoints

### `GET /api/health`
Health check. No auth required.

**Response:** `{ "ok": true, "service": "bug-reporter" }`

### `POST /api/auth`
Validate password for the standalone UI.

**Body:** `{ "password": "string" }`
**Response:** `{ "ok": true }` or `401`

### `POST /api/report`
Submit a bug report via multipart form (used by the standalone UI).

**Auth:** `X-Password` header or `password` form field.
**Fields:** `module`, `description`, `priority` (urgent|high|normal|low)
**File:** `screenshot` (optional, image or PDF, max 10MB)
**Response:** `{ "success": true, "taskId": "...", "taskUrl": "..." }`

### `POST /api/bug-report`
Submit a bug or feature report via JSON (used by the sidebar modal).

**Body:**
```json
{
  "module": "web-designer",
  "type": "bug",
  "title": "Brief summary",
  "description": "Detailed description (min 10 chars)",
  "priority": "normal",
  "severity": "medium"
}
```
**Response:** `{ "success": true, "taskId": "...", "taskUrl": "..." }`

### `POST /api/bug-report/:taskId/attachment`
Upload a screenshot to an existing task.

**Body:** multipart form with `screenshot` field.
**Response:** `{ "success": true }`

## Valid Modules

`web-designer`, `funnel-designer`, `copywriter`, `copywriter-ui`, `brand-creator`, `doc-factory`, `pageforge`, `ux-ui`, `market-researcher`, `other`

## Valid Severities

`critical`, `high`, `medium`, `low`

Legacy priority values `urgent` and `normal` are mapped to `critical` and `medium` respectively.

## Testing

```bash
# Server must be running first
node test-e2e.mjs

# Or auto-start the server for the test
node test-e2e.mjs --start-server
```

The e2e test creates a real ClickUp task, verifies all fields, then deletes it.

## Architecture

- **server.js** — Express server with CORS, auth, file upload (multer), and route handlers
- **clickup.mjs** — ClickUp API client (task creation, file attachment)
- **public/index.html** — Standalone bug report form UI
- **test-e2e.mjs** — End-to-end integration test

The sidebar modal form (`sidebar.js` in each module's `public/` directory) submits to this service's `/api/bug-report` endpoint via JSON, then uploads screenshots as a separate attachment request.
