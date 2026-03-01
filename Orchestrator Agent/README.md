# 🤖 Impact OS Agent Orchestrator

An autonomous development agent that pulls tasks from ClickUp, executes them via Claude Code, runs QA, and reports results back — so your team can submit bugs and features while the agent works through them automatically.

## How It Works

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────┐
│   ClickUp   │────▶│    Agent     │────▶│ Claude Code │────▶│    QA    │
│  Task Queue │◀────│ Orchestrator │◀────│  (headless) │     │  Checks  │
└─────────────┘     └──────────────┘     └─────────────┘     └──────────┘
     ▲                                                            │
     │                                                            │
     └────────────────── Results + Status Update ─────────────────┘
```

1. **Your team** creates tasks in the "For Impact OS" ClickUp list
2. **The agent** picks up the highest-priority task
3. **Claude Code** executes the task in your codebase with full project context
4. **QA checks** run automatically (build, lint, tests)
5. **Results** are posted as a ClickUp comment and the task status is updated
6. **Agent moves** to the next task immediately

## Quick Setup

### 1. Prerequisites
- Node.js 18+
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed globally
- A ClickUp API token

### 2. Install

```bash
cd impact-os-agent
npm install
```

### 3. Configure

```bash
cp .env.example .env
# Edit .env with your values:
#   - CLICKUP_API_TOKEN (your personal token)
#   - PROJECT_PATH (path to your Impact OS codebase)
```

### 4. Customize the Vision Doc

Edit `VISION.md` to accurately describe your project. This is the context Claude Code receives with every task — the better this document, the better the results.

### 5. Run

```bash
# Continuous mode — watches for tasks and processes them
npm start

# Single task mode — process one task and exit
npm run start:once

# Dry run — shows what would happen without executing
npm run start:dry

# Check queue status
npm run status
```

## Task Format in ClickUp

For best results, structure your tasks like this:

### Task Name
Clear, action-oriented name. E.g., "Fix image upload timeout in Funnel Designer"

### Description
Include:
- **What:** What needs to happen
- **Where:** Which module/file(s) are involved
- **Why:** Context on why this matters
- **Acceptance criteria:** How to verify it's done

### Priority
- 🔴 Urgent — Agent picks these up first
- 🟠 High
- 🟡 Normal
- 🔵 Low

### Checklists
Add a checklist for multi-step tasks — the agent will try to complete each item.

## Task Statuses (Workflow)

| Status | Meaning |
|--------|---------|
| **To Do / Open** | Ready for the agent to pick up |
| **In Progress** | Agent is currently working on it |
| **In Review** | Agent finished — needs human review |
| **Complete** | Done and verified |
| **Blocked** | Agent couldn't complete — needs human help |

## Tips for Best Results

1. **Keep tasks small and focused.** "Add retry logic to Google Drive upload" is great. "Rebuild the entire Funnel Designer" is too big.
2. **Update VISION.md regularly.** When you add new modules or change architecture, update the vision doc so the agent has current context.
3. **Use descriptions.** The more context in the task description, the better Claude Code performs.
4. **Check "In Review" tasks.** The agent moves completed tasks to review — glance at the comment to verify the changes make sense.
5. **Use "Blocked" as feedback.** When the agent marks something as blocked, the comment will explain why. Fix the blocker and move the task back to "To Do".
