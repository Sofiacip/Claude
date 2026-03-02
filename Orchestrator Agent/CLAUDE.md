# Orchestrator Agent

Autonomous development agent that polls ClickUp for tasks, executes them via Claude Code CLI, runs QA, and reports results.

## Intake Alignment (Mandatory Before Any New Work)

When you receive a new high-level instruction, you MUST complete the alignment
process before creating any tasks or making any changes.

### Alignment Steps:
1. Read the instruction carefully
2. Generate 5-15 targeted questions from the seven categories:
   Intent, Scope, Priority, Definition of Done, Known Issues,
   Constraints, Autonomy Boundaries
3. Ask ALL questions at once — do not drip-feed them one at a time
4. Wait for answers
5. Produce a Plan Summary (see format below)
6. Wait for approval
7. Only then: create tasks and begin execution

### Plan Summary Format:
```
## Alignment Summary

### What I Understood
[1-2 paragraph summary of the instruction and intent]

### What I Will Do
[Numbered list of specific workstreams, in execution order]

### What I Will NOT Do
[Explicit list of things out of scope]

### Success Criteria
[Measurable definition of done — tied to output QA scores, visual benchmarks, or concrete deliverables]

### Estimated Scope
[Approximate number of tasks and time estimate]

### Autonomy Rules
- When I find X, I will do Y
- When I encounter Z, I will [fix it / log it / stop]
```

### Rules:
- Never create tasks before the Plan Summary is approved
- Never start executing before the Plan Summary is approved
- Ask all questions in a single message — the human answers once
- Skip question categories that aren't relevant to the instruction
- If the instruction is very specific and narrow (e.g., "fix the broken
  image on the landing page hero section"), you may skip the full question
  framework and go straight to a brief Plan Summary for approval
- The threshold for skipping alignment is: the instruction must be specific
  enough that there is only one reasonable interpretation of what to do
- When in doubt, ask questions. A 10-minute alignment conversation saves
  hours of wasted autonomous execution.

### After Approval:
- Execute autonomously with no further check-ins
- Output QA runs silently on every task
- Only surface issues if output QA fails (logged, not blocking you)
- Post a final summary when all tasks are complete

## CLI Modes

- `--align "instruction"` — Full Slack-driven alignment: posts questions, polls for answers,
  generates plan summary, polls for approval ("approved"/"yes"), creates tasks, enters autopilot.
  One command, no terminal interaction after launch.
- `--align "instruction" --modules mod1,mod2,...` — Module chaining: runs the full alignment
  lifecycle sequentially for each module. Each module gets its own Slack thread, scoped questions,
  separate approval, and scoped autopilot (only executes tasks tagged for that module). 24-hour
  reminders are posted if answers or approval are pending. State persists to `data/chain-state.json`
  for crash recovery. Posts a final summary when all modules complete.
  Valid module names: `web-designer`, `funnel-designer`, `doc-factory`, `copywriter`,
  `copywriter-ui`, `brand-creator`, `pageforge`.
  Example: `node agent.mjs --align "Improve output quality" --modules web-designer,funnel-designer`
- `--respond` — Manual fallback: read answers from Slack thread, generate plan summary
- `--respond answers.txt` — Manual fallback: read answers from file
- `--approve` — Manual fallback: approve pending plan summary, create ClickUp tasks
- `--approve --autopilot` — Manual fallback: approve + start autopilot
- `--plan "vision"` — Legacy shortcut: runs alignment first, or skips if instruction is narrow
- `--autopilot` — Continuous autonomous mode (requires prior approval)
- `--once` — Process one task from the queue
- `--dry-run` — Show what would be dispatched without executing
- `--report` — Scan tags and generate missing reports

## Commit & Deploy (HARD RULE)

**Every task that passes output QA MUST be committed and deployed before being
marked as done.** No exceptions. The autopilot must never leave changes sitting
on the filesystem uncommitted.

The sequence after QA passes is:
1. `git add` all changed files in the module directory
2. `git commit` with the task name and ID
3. `git push` to remote
4. If the module has a Vercel deployment target, deploy to production
5. Post a Commit & Deploy comment to the ClickUp task
6. Only THEN mark the task as completed/ready for review

Modules with Vercel deployment targets:
- **Web Designer** → `vercel-deploy-test-client` (deploys `clients/test-client/output/`)
- **funnel-designer** → `vercel-deploy-pattie-ehsaei-funnel` (deploys `public/`)
- **copywriter-ui** → `copywriter-ui` (deploys `.`)

Modules without Vercel targets (commit + push only):
- Copywriter, brand creator, doc factory, pageforge, bug-reporter

If commit or deploy fails, the task still proceeds to review — but the failure
is logged in a ClickUp comment so it can be resolved manually.

## Output QA

Output QA runs automatically after every funnel-designer task completes.
It checks structural integrity (Playwright) and visual quality (Claude CLI comparison).
Results flow through memory, ClickUp comments, self-healing retries, and status transitions.
