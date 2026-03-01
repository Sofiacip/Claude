# Impact OS Orchestrator Agent V2 — Complete Build Spec

> **What this is:** A complete implementation specification for upgrading the Impact OS Agent Orchestrator from a basic poll-execute-report loop into a fully autonomous development system with planning, parallel execution, self-healing, persistent memory, and intelligent QA.
>
> **How to use:** Paste this into Claude Code on the Hetzner VPS. Work through each section in order. Each section has clear acceptance criteria and test commands.
>
> **Where the code lives:** `/Users/Administrator/Claude/impact-os-agent/`
>
> **What NOT to touch:** `.env` files, VISION.md content (update structure only), existing module codebases (the orchestrator manages them, doesn't modify their architecture)

---

## Table of Contents

1. [Critical Bug Fixes (Do These First)](#1-critical-bug-fixes)
2. [Architecture Overview](#2-architecture-overview)
3. [New File Structure](#3-new-file-structure)
4. [Layer 1: Persistent Memory](#4-layer-1-persistent-memory)
5. [Layer 2: Enhanced QA Validator](#5-layer-2-enhanced-qa-validator)
6. [Layer 3: Self-Healing Engine](#6-layer-3-self-healing-engine)
7. [Layer 4: Planning Agent](#7-layer-4-planning-agent)
8. [Layer 5: Parallel Execution Scheduler](#8-layer-5-parallel-execution-scheduler)
9. [Layer 6: Upgraded Agent Loop](#9-layer-6-upgraded-agent-loop)
10. [Updated ClickUp Client](#10-updated-clickup-client)
11. [Configuration & Environment](#11-configuration--environment)
12. [Testing & Validation](#12-testing--validation)
13. [Deployment](#13-deployment)

---

## 1. Critical Bug Fixes

Before building anything new, fix these bugs in the existing code.

### Bug 1: Regex Mismatch in executor.mjs (Line 239)

**Problem:** The result parser uses mismatched XML tags. Opening tag is `<r>` but closing tag is `</result>`. They will never match, so `parseResult()` always returns `status: 'unknown'`.

**File:** `executor.mjs`

**Current (broken):**
```javascript
const resultMatch = output.match(/<r>([\s\S]*?)<\/result>/);
```

**Fix — change to:**
```javascript
const resultMatch = output.match(/<result>([\s\S]*?)<\/result>/);
```

**Also update `buildPrompt()` to use matching tags.** In the instructions template, change:
```
<r>
STATUS: success | partial | blocked
...
</r>
```
to:
```
<result>
STATUS: success | partial | blocked
...
</result>
```

### Bug 2: QA Runs Against Wrong Directory

**Problem:** `QARunner` is constructed with `CONFIG.projectPath` (the parent `/Users/Administrator/Claude` folder), not the specific module folder. Running `npm run build` in the parent folder doesn't test the module that was just modified.

**File:** `agent.mjs` (line 98) and `qa.mjs`

**Fix:** Pass the module path from the executor result into QA:

In `agent.mjs`, change the QA call from:
```javascript
qaResults = await qa.runAll();
```
to:
```javascript
const modulePath = result.modulePath || CONFIG.projectPath;
qaResults = await qa.runAll(modulePath);
```

In `qa.mjs`, update `runAll()` to accept a path parameter:
```javascript
async runAll(targetPath = null) {
  const checkPath = targetPath || this.projectPath;
  // ... use checkPath instead of this.projectPath for all checks
}
```

And update `executor.mjs` to return `modulePath` in its result object:
```javascript
return {
  success: true,
  ...parsed,
  module: moduleName,
  modulePath: modulePath,  // ADD THIS
  rawOutput: result,
  attempts: attempt,
};
```

### Bug 3: Failed Tasks Set to "not started" Instead of "blocked"

**File:** `agent.mjs` (line 149)

**Current:**
```javascript
await clickup.updateTaskStatus(task.id, 'not started');
```

**Fix:**
```javascript
await clickup.updateTaskStatus(task.id, 'blocked');
```

Setting failed tasks back to "not started" creates an infinite loop — the agent picks them up again immediately. They should go to "blocked" so a human can investigate.

### Acceptance Criteria for Bug Fixes
- [ ] `parseResult()` correctly extracts STATUS, SUMMARY, FILES_CHANGED, BLOCKERS, TESTS from Claude Code output
- [ ] QA checks run in the correct module directory, not the parent folder
- [ ] Failed tasks move to "blocked" status, not back into the queue

---

## 2. Architecture Overview

```
                          ┌──────────────────────────┐
                          │      VISION.md           │
                          │   (project context)       │
                          └────────────┬─────────────┘
                                       │
                                       ▼
┌─────────────┐    ┌──────────────────────────────────────────┐
│   ClickUp   │◄──►│           AGENT (agent.mjs)               │
│  "For Impact │    │                                          │
│    OS" List  │    │  ┌─────────┐  ┌───────────┐  ┌────────┐│
│              │    │  │Planner  │  │ Scheduler │  │ Memory ││
│  Tasks ←──────────│  │(plan)   │  │(parallel) │  │(state) ││
│  Comments ────────│  └────┬────┘  └─────┬─────┘  └────┬───┘│
│  Statuses ────────│       │             │              │    │
└─────────────┘    │       ▼             ▼              │    │
                    │  ┌──────────────────────────┐     │    │
                    │  │    EXECUTOR (executor.mjs)│◄────┘    │
                    │  │    Claude Code CLI        │          │
                    │  │    --print --dangerously-  │          │
                    │  │    skip-permissions        │          │
                    │  └────────────┬──────────────┘          │
                    │               │                          │
                    │               ▼                          │
                    │  ┌──────────────────────────┐           │
                    │  │     QA VALIDATOR          │           │
                    │  │  Build │ Lint │ Test │    │           │
                    │  │  Functional │ Sanity      │           │
                    │  └────────────┬──────────────┘          │
                    │               │                          │
                    │               ▼                          │
                    │  ┌──────────────────────────┐           │
                    │  │    SELF-HEALER            │           │
                    │  │  Classify error → Retry   │           │
                    │  │  with adjusted approach    │           │
                    │  └──────────────────────────┘           │
                    └──────────────────────────────────────────┘
```

**Key Design Decisions:**
- ALL AI processing uses Claude Code CLI (`claude --print --dangerously-skip-permissions`). NEVER the Anthropic API directly.
- State persists in a local JSON file (`memory.json`), not a database.
- ClickUp is the source of truth for task status. Memory is supplementary context.
- Parallelism is bounded — max 3 concurrent Claude Code processes (to avoid VPS resource exhaustion and Claude rate limits).
- The planning agent is a CLI command (`node agent.mjs --plan "Build the Unified Outputs System"`) that generates ClickUp tasks. It does NOT execute them in the same run.

---

## 3. New File Structure

```
impact-os-agent/
├── agent.mjs              # Main loop (UPGRADED — adds parallel dispatch, memory, self-healing)
├── clickup.mjs            # ClickUp API client (UPGRADED — adds bulk task creation, dependency fields)
├── executor.mjs           # Claude Code executor (UPGRADED — returns modulePath, better parsing)
├── qa.mjs                 # QA runner (UPGRADED — module-aware, functional checks)
├── planner.mjs            # NEW — Planning agent: vision → ClickUp tasks
├── scheduler.mjs          # NEW — Parallel execution scheduler with dependency resolution
├── memory.mjs             # NEW — Persistent state: task history, errors, learnings
├── healer.mjs             # NEW — Self-healing: error classification, retry strategies
├── status.mjs             # Queue status viewer (UPGRADED)
├── logger.mjs             # Logging (unchanged)
├── package.json           # Dependencies (UPGRADED)
├── VISION.md              # Project context document (unchanged)
├── .env                   # Environment variables (DO NOT MODIFY)
├── .env.example           # Template (UPGRADED)
└── data/
    └── memory.json        # Persistent memory store (auto-created)
```

---

## 4. Layer 1: Persistent Memory

**File:** `memory.mjs`

**Purpose:** Maintain state across agent restarts. Remember what was tried, what failed, what worked, and what each module's current health status is.

### Data Structure

```javascript
// memory.json schema
{
  "version": 1,
  "lastUpdated": "2026-03-01T12:00:00Z",
  
  // Track every task the agent has processed
  "taskHistory": {
    "task_abc123": {
      "taskId": "task_abc123",
      "name": "Fix image upload in Web Designer",
      "module": "Web Designer",
      "status": "completed",          // completed | failed | blocked
      "attempts": 2,
      "startedAt": "2026-03-01T10:00:00Z",
      "completedAt": "2026-03-01T10:15:00Z",
      "approach": "Added retry logic with exponential backoff to the upload handler",
      "filesChanged": ["src/utils/upload.js", "src/components/ImageUploader.jsx"],
      "errors": [
        {
          "attempt": 1,
          "error": "Build failed: Cannot find module '../utils/retry'",
          "category": "missing_dependency",
          "resolution": "Created the missing retry utility module"
        }
      ],
      "qaResults": { "build": true, "lint": true, "test": true, "sanity": true }
    }
  },
  
  // Track module health — updated after every task
  "modules": {
    "Web Designer": {
      "path": "/Users/Administrator/Claude/Web Designer",
      "lastTaskAt": "2026-03-01T10:15:00Z",
      "healthStatus": "healthy",      // healthy | degraded | broken
      "lastBuildPassed": true,
      "lastTestPassed": true,
      "knownIssues": [],
      "recentErrors": []
    }
  },
  
  // Track error patterns to avoid repeating failed approaches
  "errorPatterns": {
    "missing_dependency": {
      "count": 3,
      "lastSeen": "2026-03-01T10:05:00Z",
      "commonFix": "Check if the import path is correct and the module exists before creating new files"
    }
  },

  // Track which tasks are currently being processed (for crash recovery)
  "activeWork": {
    "task_xyz789": {
      "taskId": "task_xyz789",
      "startedAt": "2026-03-01T12:00:00Z",
      "module": "Funnel Designer",
      "pid": 12345
    }
  }
}
```

### Implementation

```javascript
// memory.mjs — Persistent memory for the Impact OS Agent

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

const MEMORY_PATH = path.join(process.cwd(), 'data', 'memory.json');

export class Memory {
  constructor() {
    this.data = this.load();
  }

  // ─── Load / Save ──────────────────────────────────────────────

  load() {
    if (!existsSync(MEMORY_PATH)) {
      const defaultMemory = {
        version: 1,
        lastUpdated: new Date().toISOString(),
        taskHistory: {},
        modules: {},
        errorPatterns: {},
        activeWork: {},
      };
      this.save(defaultMemory);
      return defaultMemory;
    }

    try {
      return JSON.parse(readFileSync(MEMORY_PATH, 'utf-8'));
    } catch {
      console.warn('⚠️ Corrupted memory.json — starting fresh');
      return { version: 1, lastUpdated: new Date().toISOString(), taskHistory: {}, modules: {}, errorPatterns: {}, activeWork: {} };
    }
  }

  save(data = null) {
    const dir = path.dirname(MEMORY_PATH);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    
    if (data) this.data = data;
    this.data.lastUpdated = new Date().toISOString();
    writeFileSync(MEMORY_PATH, JSON.stringify(this.data, null, 2));
  }

  // ─── Task History ─────────────────────────────────────────────

  recordTaskStart(taskId, taskName, moduleName) {
    this.data.activeWork[taskId] = {
      taskId,
      startedAt: new Date().toISOString(),
      module: moduleName,
      pid: process.pid,
    };
    this.save();
  }

  recordTaskComplete(taskId, result) {
    const active = this.data.activeWork[taskId];
    
    this.data.taskHistory[taskId] = {
      taskId,
      name: result.taskName || taskId,
      module: result.module || 'unknown',
      status: result.success ? 'completed' : 'failed',
      attempts: result.attempts,
      startedAt: active?.startedAt || new Date().toISOString(),
      completedAt: new Date().toISOString(),
      approach: result.summary,
      filesChanged: result.filesChanged || [],
      errors: result.errors || [],
      qaResults: result.qaResults || null,
    };

    delete this.data.activeWork[taskId];
    
    // Update module health
    if (result.module) {
      this.updateModuleHealth(result.module, result);
    }
    
    this.save();
  }

  recordTaskBlocked(taskId, taskName, moduleName, reason) {
    this.data.taskHistory[taskId] = {
      taskId,
      name: taskName,
      module: moduleName,
      status: 'blocked',
      blockedAt: new Date().toISOString(),
      blockedReason: reason,
    };
    delete this.data.activeWork[taskId];
    this.save();
  }

  // ─── Module Health ────────────────────────────────────────────

  updateModuleHealth(moduleName, result) {
    if (!this.data.modules[moduleName]) {
      this.data.modules[moduleName] = {
        path: result.modulePath || '',
        lastTaskAt: null,
        healthStatus: 'healthy',
        lastBuildPassed: true,
        lastTestPassed: true,
        knownIssues: [],
        recentErrors: [],
      };
    }

    const mod = this.data.modules[moduleName];
    mod.lastTaskAt = new Date().toISOString();

    if (result.qaResults) {
      mod.lastBuildPassed = result.qaResults.build !== false;
      mod.lastTestPassed = result.qaResults.test !== false;
    }

    if (!result.success) {
      mod.recentErrors.push({
        taskId: result.taskId,
        error: result.summary,
        at: new Date().toISOString(),
      });
      // Keep only last 10 errors
      mod.recentErrors = mod.recentErrors.slice(-10);
    }

    // Determine health status
    if (mod.lastBuildPassed && mod.lastTestPassed) {
      mod.healthStatus = 'healthy';
    } else if (mod.lastBuildPassed) {
      mod.healthStatus = 'degraded';
    } else {
      mod.healthStatus = 'broken';
    }
  }

  // ─── Error Patterns ──────────────────────────────────────────

  recordError(category, error, resolution = null) {
    if (!this.data.errorPatterns[category]) {
      this.data.errorPatterns[category] = {
        count: 0,
        lastSeen: null,
        commonFix: null,
      };
    }
    const pattern = this.data.errorPatterns[category];
    pattern.count++;
    pattern.lastSeen = new Date().toISOString();
    if (resolution) pattern.commonFix = resolution;
    this.save();
  }

  getErrorContext(category) {
    return this.data.errorPatterns[category] || null;
  }

  // ─── Context for Prompts ──────────────────────────────────────

  /**
   * Build a context summary for the executor prompt.
   * Includes: module health, recent errors for this module, relevant error patterns.
   */
  getContextForTask(moduleName) {
    const mod = this.data.modules[moduleName];
    if (!mod) return '';

    const lines = [`<memory_context>`];
    lines.push(`Module "${moduleName}" health: ${mod.healthStatus}`);
    
    if (mod.recentErrors.length > 0) {
      lines.push(`\nRecent errors in this module:`);
      for (const err of mod.recentErrors.slice(-3)) {
        lines.push(`- ${err.error} (${err.at})`);
      }
    }

    if (mod.knownIssues.length > 0) {
      lines.push(`\nKnown issues:`);
      for (const issue of mod.knownIssues) {
        lines.push(`- ${issue}`);
      }
    }

    lines.push(`</memory_context>`);
    return lines.join('\n');
  }

  // ─── Crash Recovery ───────────────────────────────────────────

  /**
   * On startup, check for tasks that were "active" when the agent last crashed.
   * Returns array of task IDs that need cleanup.
   */
  getOrphanedTasks() {
    return Object.keys(this.data.activeWork);
  }

  clearOrphanedTask(taskId) {
    delete this.data.activeWork[taskId];
    this.save();
  }

  // ─── Query ────────────────────────────────────────────────────

  hasTaskBeenAttempted(taskId) {
    return !!this.data.taskHistory[taskId];
  }

  getTaskHistory(taskId) {
    return this.data.taskHistory[taskId] || null;
  }

  getModuleHealth(moduleName) {
    return this.data.modules[moduleName] || null;
  }
}
```

### Acceptance Criteria
- [ ] `memory.json` is auto-created in `data/` directory on first run
- [ ] Task starts are recorded before execution begins
- [ ] Task completions/failures are recorded with full details
- [ ] Module health updates after every task
- [ ] Error patterns accumulate and persist across restarts
- [ ] Orphaned tasks from crashes are detected on startup
- [ ] Memory survives agent restart — data persists in JSON file

---

## 5. Layer 2: Enhanced QA Validator

**File:** `qa.mjs` (upgrade existing)

**Changes from current:**
- Accept a target module path instead of always using parent directory
- Add functional validation: check if the feature described in the task actually exists in the code
- Add regression check: verify that other modules still build
- Return structured results with per-check details

### Implementation

```javascript
// qa.mjs — Enhanced QA runner: module-aware, functional checks, regression detection

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

export class QARunner {
  constructor(projectPath) {
    this.projectPath = projectPath; // Parent: /Users/Administrator/Claude
  }

  /**
   * Run all QA checks against a specific module.
   * @param {string} modulePath — Full path to the module that was modified
   * @param {object} taskContext — { name, description, filesChanged } for functional validation
   */
  async runAll(modulePath = null, taskContext = null) {
    const checkPath = modulePath || this.projectPath;
    
    const results = {
      passed: true,
      modulePath: checkPath,
      checks: [],
      timestamp: new Date().toISOString(),
    };

    // 1. Build check — does the module compile?
    const buildResult = this.runCheck('build', 'npm run build', checkPath);
    results.checks.push(buildResult);
    if (!buildResult.passed) results.passed = false;

    // 2. Lint check
    const lintResult = this.runCheck('lint', 'npm run lint --if-present', checkPath);
    results.checks.push(lintResult);
    if (lintResult.exitCode > 1) results.passed = false;

    // 3. Test check
    const testResult = this.runCheck('test', 'npm test --if-present', checkPath);
    results.checks.push(testResult);
    if (!testResult.passed) results.passed = false;

    // 4. Sanity checks (package.json valid, no .env modifications)
    const sanityResult = this.sanityChecks(checkPath);
    results.checks.push(sanityResult);
    if (!sanityResult.passed) results.passed = false;

    // 5. File existence check — were the reported files actually changed?
    if (taskContext?.filesChanged?.length > 0) {
      const fileResult = this.verifyFilesExist(checkPath, taskContext.filesChanged);
      results.checks.push(fileResult);
      if (!fileResult.passed) results.passed = false;
    }

    // 6. Type check (if TypeScript project)
    if (existsSync(path.join(checkPath, 'tsconfig.json'))) {
      const tscResult = this.runCheck('typecheck', 'npx tsc --noEmit', checkPath);
      results.checks.push(tscResult);
      if (!tscResult.passed) results.passed = false;
    }

    return results;
  }

  runCheck(name, command, workingDir) {
    try {
      const output = execSync(command, {
        cwd: workingDir,
        stdio: 'pipe',
        timeout: 180_000, // 3 min timeout per check
        env: { ...process.env, CI: 'true' },
      }).toString();

      return {
        name,
        passed: true,
        exitCode: 0,
        output: output.slice(-300),
      };
    } catch (err) {
      return {
        name,
        passed: false,
        exitCode: err.status || 1,
        output: (err.stderr?.toString() || err.stdout?.toString() || err.message).slice(-500),
      };
    }
  }

  sanityChecks(checkPath) {
    const issues = [];

    // Check package.json still valid
    const pkgPath = path.join(checkPath, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        JSON.parse(readFileSync(pkgPath, 'utf-8'));
      } catch {
        issues.push('package.json is invalid JSON');
      }
    }

    // Check no .env files were modified
    try {
      const gitStatus = execSync('git diff --name-only', {
        cwd: checkPath,
        stdio: 'pipe',
      }).toString();

      if (gitStatus.includes('.env')) {
        issues.push('.env file was modified — this must not be committed');
      }
    } catch {
      // Not a git repo or git not available — skip
    }

    // Check no node_modules were committed
    try {
      const gitStatus = execSync('git diff --cached --name-only', {
        cwd: checkPath,
        stdio: 'pipe',
      }).toString();

      if (gitStatus.includes('node_modules')) {
        issues.push('node_modules changes staged for commit');
      }
    } catch {
      // skip
    }

    return {
      name: 'sanity',
      passed: issues.length === 0,
      exitCode: issues.length > 0 ? 1 : 0,
      output: issues.length > 0 ? issues.join('\n') : 'All sanity checks passed',
    };
  }

  /**
   * Verify that files reported as "changed" by Claude Code actually exist.
   * Catches cases where Claude Code claims to have created a file but didn't.
   */
  verifyFilesExist(checkPath, filesChanged) {
    const missing = [];
    
    for (const file of filesChanged) {
      // Handle both relative and absolute paths
      const fullPath = path.isAbsolute(file) ? file : path.join(checkPath, file);
      if (!existsSync(fullPath)) {
        missing.push(file);
      }
    }

    return {
      name: 'files_exist',
      passed: missing.length === 0,
      exitCode: missing.length > 0 ? 1 : 0,
      output: missing.length > 0 
        ? `Missing files: ${missing.join(', ')}`
        : `All ${filesChanged.length} reported files verified`,
    };
  }

  formatReport(results) {
    const lines = [
      `### 🧪 QA Report`,
      `**Overall: ${results.passed ? '✅ PASSED' : '❌ FAILED'}**`,
      `Module: \`${path.basename(results.modulePath)}\``,
      '',
    ];

    for (const check of results.checks) {
      const icon = check.passed ? '✅' : '❌';
      lines.push(`${icon} **${check.name}**: ${check.passed ? 'passed' : 'failed'}`);
      if (!check.passed && check.output) {
        lines.push('```', check.output.slice(-200), '```');
      }
    }

    return lines.join('\n');
  }
}
```

### Acceptance Criteria
- [ ] QA runs `npm run build` in the specific module directory, not the parent
- [ ] TypeScript projects get `tsc --noEmit` check automatically
- [ ] Files reported by Claude Code are verified to actually exist
- [ ] Results include module path for debugging
- [ ] Report format includes per-check pass/fail with error snippets

---

## 6. Layer 3: Self-Healing Engine

**File:** `healer.mjs` (new)

**Purpose:** When a task fails, classify the error and determine the best retry strategy instead of just saying "try again."

### Error Categories & Strategies

| Category | Example | Strategy |
|----------|---------|----------|
| `build_error` | `npm run build` fails | Read the error, fix the specific compilation issue |
| `missing_dependency` | `Cannot find module 'xyz'` | Install the missing package or create the missing file |
| `test_failure` | Test assertions fail | Read the failing test, understand what's expected, fix the code |
| `timeout` | Claude Code takes >10 min | Simplify the task — break into smaller parts |
| `parse_error` | Can't extract result from output | Re-run with explicit formatting instructions |
| `module_not_found` | Module path doesn't exist | Check MODULE_MAP and suggest correction |
| `permission_error` | File system permission denied | Report to human — can't fix this automatically |
| `unknown` | Anything else | Generic retry with previous error context |

### Implementation

```javascript
// healer.mjs — Self-healing engine: error classification and retry strategies

export class SelfHealer {
  constructor(memory) {
    this.memory = memory;
    this.maxRetries = 3; // Total attempts before giving up (increased from 2)
  }

  /**
   * Classify an error and determine the best retry strategy.
   * Returns { category, strategy, shouldRetry, retryPrompt }
   */
  classifyError(error, context = {}) {
    const errorStr = typeof error === 'string' ? error : error.message || String(error);
    const errorLower = errorStr.toLowerCase();

    // Build errors — most common
    if (errorLower.includes('build') && (errorLower.includes('fail') || errorLower.includes('error'))) {
      return this.buildStrategy('build_error', errorStr, context);
    }

    // Missing dependencies
    if (errorLower.includes('cannot find module') || errorLower.includes('module not found') || errorLower.includes('no such file or directory')) {
      return this.buildStrategy('missing_dependency', errorStr, context);
    }

    // Test failures
    if (errorLower.includes('test') && (errorLower.includes('fail') || errorLower.includes('assert'))) {
      return this.buildStrategy('test_failure', errorStr, context);
    }

    // Timeouts
    if (errorLower.includes('timeout') || errorLower.includes('timed out')) {
      return this.buildStrategy('timeout', errorStr, context);
    }

    // Parse errors (can't extract result from Claude Code output)
    if (errorLower.includes('could not parse') || errorLower.includes('unknown') || context.status === 'unknown') {
      return this.buildStrategy('parse_error', errorStr, context);
    }

    // Module not found
    if (errorLower.includes('module folder not found')) {
      return this.buildStrategy('module_not_found', errorStr, context);
    }

    // Permission errors — never auto-retry
    if (errorLower.includes('permission') || errorLower.includes('eacces')) {
      return {
        category: 'permission_error',
        shouldRetry: false,
        reason: 'Permission errors require manual intervention. Check file ownership and permissions on the VPS.',
      };
    }

    // Default: unknown error
    return this.buildStrategy('unknown', errorStr, context);
  }

  buildStrategy(category, errorStr, context) {
    const attempt = context.attempt || 1;
    const previousApproaches = context.previousErrors || [];

    // Check if we've seen this pattern before
    const knownPattern = this.memory?.getErrorContext(category);

    // Don't retry if we've hit max attempts
    if (attempt >= this.maxRetries) {
      return {
        category,
        shouldRetry: false,
        reason: `Exhausted ${this.maxRetries} attempts. Error category: ${category}.`,
      };
    }

    // Build a specific retry prompt based on the error category
    const strategies = {
      build_error: {
        retryPrompt: `The previous attempt failed with a build error:
\`\`\`
${errorStr.slice(-500)}
\`\`\`

IMPORTANT: Before writing any code, read the error message carefully. Identify the exact file and line number causing the failure. Fix ONLY that specific issue. Then run \`npm run build\` to verify the fix before proceeding.
${knownPattern?.commonFix ? `\nNote: Similar errors have been fixed before by: ${knownPattern.commonFix}` : ''}`,
      },

      missing_dependency: {
        retryPrompt: `The previous attempt failed because a module or file was not found:
\`\`\`
${errorStr.slice(-500)}
\`\`\`

IMPORTANT: Check if:
1. The import path is correct (relative paths, casing)
2. The package is listed in package.json (if external dependency)
3. The file actually exists at the expected path (if internal module)

If a package is missing, install it with \`npm install <package>\`. If an internal file is missing, check if it was supposed to be created in a previous step.`,
      },

      test_failure: {
        retryPrompt: `The previous attempt caused test failures:
\`\`\`
${errorStr.slice(-500)}
\`\`\`

IMPORTANT: Read the failing test to understand what's expected. The test describes the intended behavior. Fix your code to match the test expectations, don't modify existing tests unless the task specifically asks you to.`,
      },

      timeout: {
        retryPrompt: `The previous attempt timed out after 10 minutes. The task is too complex for a single run.

IMPORTANT: Break the work into smaller steps. Do the MOST CRITICAL part of the task only — the part that delivers the core functionality. Skip nice-to-haves, edge cases, and optimizations. Get the basic feature working first.

If the task involves modifying multiple files, focus on the primary file only. The other files can be updated in a follow-up task.`,
      },

      parse_error: {
        retryPrompt: `The previous attempt completed but the output could not be parsed. The agent could not find the structured result block.

CRITICAL: When you finish your work, you MUST output your results in this EXACT format (no other XML tags, no markdown around it):

<result>
STATUS: success | partial | blocked
FILES_CHANGED: comma,separated,file,paths
SUMMARY: One paragraph describing what you did
BLOCKERS: (leave empty if none) Description of any blockers
TESTS: passed | failed | none
</result>

This block must appear at the END of your output. Do not nest it inside other tags.`,
      },

      module_not_found: {
        retryPrompt: `The module path could not be found. The task may reference a module that:
1. Has a different folder name than expected
2. Hasn't been created yet
3. Has been moved or renamed

Please list the contents of /Users/Administrator/Claude/ to see what modules exist, and work from the correct directory.`,
      },

      unknown: {
        retryPrompt: `The previous attempt failed with an unexpected error:
\`\`\`
${errorStr.slice(-500)}
\`\`\`

${previousApproaches.length > 0 ? `\nPrevious approaches that failed:\n${previousApproaches.map((e, i) => `${i + 1}. ${e.slice(0, 200)}`).join('\n')}` : ''}

Try a DIFFERENT approach this time. If the previous attempt tried to create new files, try modifying existing ones instead. If it tried a complex solution, try a simpler one.`,
      },
    };

    const strategy = strategies[category] || strategies.unknown;

    // Record the error pattern in memory
    if (this.memory) {
      this.memory.recordError(category, errorStr);
    }

    return {
      category,
      shouldRetry: true,
      retryPrompt: strategy.retryPrompt,
    };
  }
}
```

### Acceptance Criteria
- [ ] Errors are correctly classified into categories based on error content
- [ ] Each category produces a specific, actionable retry prompt
- [ ] Known error patterns from memory are included in retry prompts
- [ ] Permission errors are never retried — immediately marked as blocked
- [ ] Timeout errors suggest task simplification
- [ ] Parse errors include the exact expected output format
- [ ] After max retries, returns `shouldRetry: false`

---

## 7. Layer 4: Planning Agent

**File:** `planner.mjs` (new)

**Purpose:** Take a vision description (e.g., "Build the Unified Outputs System") and decompose it into dozens of specific, actionable ClickUp tasks with proper structure: names, descriptions with acceptance criteria, priorities, tags, and dependency ordering.

### How It Works

1. User runs: `node agent.mjs --plan "Build the Unified Outputs System"`
2. Planner reads VISION.md for full project context
3. Planner calls Claude Code CLI with a specialized planning prompt
4. Claude Code outputs a structured JSON array of tasks
5. Planner creates all tasks in the "For Impact OS" ClickUp list
6. Planner posts a summary comment on each task linking to related tasks

### Implementation

```javascript
// planner.mjs — Planning agent: decomposes a vision into ClickUp tasks

import { readFileSync, existsSync } from 'fs';
import { spawn } from 'child_process';

export class Planner {
  constructor(clickup, visionDocPath, projectPath) {
    this.clickup = clickup;
    this.visionDocPath = visionDocPath;
    this.projectPath = projectPath;
  }

  /**
   * Decompose a vision description into ClickUp tasks.
   * @param {string} vision — Natural language description of what to build
   * @returns {object} — { tasksCreated: number, taskIds: string[] }
   */
  async plan(vision) {
    console.log(`\n🧠 Planning: "${vision}"\n`);

    // Step 1: Build the planning prompt
    const prompt = this.buildPlanningPrompt(vision);

    // Step 2: Send to Claude Code for task decomposition
    console.log('📋 Generating task breakdown via Claude Code...');
    const rawOutput = await this.runClaudeCode(prompt);

    // Step 3: Parse the task list from Claude Code's output
    const tasks = this.parseTasks(rawOutput);
    
    if (tasks.length === 0) {
      console.error('❌ No tasks could be parsed from Claude Code output.');
      console.log('Raw output tail:', rawOutput.slice(-1000));
      return { tasksCreated: 0, taskIds: [] };
    }

    console.log(`\n📋 Generated ${tasks.length} tasks. Creating in ClickUp...\n`);

    // Step 4: Create tasks in ClickUp
    const createdIds = [];
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      console.log(`  [${i + 1}/${tasks.length}] ${task.name}`);
      
      try {
        const created = await this.clickup.createTask({
          name: task.name,
          description: task.description,
          priority: this.mapPriority(task.priority),
          tags: task.tags || [],
          status: 'not started',
        });
        createdIds.push(created.id);

        // Small delay to avoid ClickUp rate limiting
        await new Promise(r => setTimeout(r, 300));
      } catch (err) {
        console.error(`  ❌ Failed to create task: ${err.message}`);
      }
    }

    console.log(`\n✅ Created ${createdIds.length}/${tasks.length} tasks in ClickUp.`);
    return { tasksCreated: createdIds.length, taskIds: createdIds };
  }

  buildPlanningPrompt(vision) {
    let prompt = '';

    // Load vision document
    if (this.visionDocPath && existsSync(this.visionDocPath)) {
      const visionDoc = readFileSync(this.visionDocPath, 'utf-8');
      prompt += `<project_context>\n${visionDoc}\n</project_context>\n\n`;
    }

    // Scan current directory structure for additional context
    prompt += `<project_path>${this.projectPath}</project_path>\n\n`;

    prompt += `<planning_request>
You are a senior technical project manager decomposing a feature vision into implementable development tasks.

VISION TO IMPLEMENT:
"${vision}"

CURRENT MODULES in /Users/Administrator/Claude/:
- Web Designer — Next.js web page builder (needs reliability fixes)
- funnel-designer — Multi-page funnel builder (needs reliability fixes)
- Copywriter — 17-skill copy generation pipeline (working well)
- copywriter-ui — Frontend for the Copywriter module
- brand creator — Analyzes client content for brand voice (working well)
- doc factory — Document generation (has output failures)
- pageforge — Page template system

TECH STACK:
- Frontend: Next.js + Tailwind CSS + shadcn/ui, deployed on Vercel
- Backend: Supabase (PostgreSQL + Auth + Storage)
- Processing: Hetzner VPS running Claude Code CLI (headless)
- All AI processing uses Claude Code CLI — NEVER Anthropic API directly

YOUR JOB:
Break down this vision into specific, actionable development tasks. Each task should be:
- Small enough for one Claude Code session (30 minutes max)
- Self-contained — can be worked on independently where possible
- Clearly described with acceptance criteria

Output a JSON array of tasks. Each task has:
- "name": Action-oriented task name (e.g., "Add error recovery to Web Designer page generation")
- "description": 2-4 paragraphs with: What needs to happen, Where in the codebase, Why it matters, Acceptance criteria as a checklist
- "priority": "urgent" | "high" | "normal" | "low"
- "tags": Array of module tags (e.g., ["web designer"]) — must match MODULE_MAP keys
- "phase": Number (1, 2, 3...) indicating execution order. Phase 1 tasks have no dependencies and can run first. Phase 2 tasks depend on phase 1, etc.
- "dependsOn": Array of task names this task depends on (empty if none)

RULES:
1. Start with foundation/infrastructure tasks (phase 1), then build features on top (phase 2+)
2. Tag every task with the correct module so the orchestrator routes it correctly
3. Keep tasks under 30 minutes of Claude Code work — if something is bigger, split it
4. Include specific file paths when you know them
5. Include acceptance criteria as a markdown checklist in the description
6. For bug fixes, describe the current broken behavior AND the expected correct behavior
7. Prioritize based on: urgent = blocking other work, high = core feature, normal = important but not blocking, low = nice-to-have

Output ONLY the JSON array, no other text. Example format:
[
  {
    "name": "Create shared database schema for outputs library",
    "description": "**What:** Create the Supabase database schema...\n\n**Where:** Supabase dashboard or migration file...\n\n**Acceptance Criteria:**\n- [ ] Table 'outputs' exists with columns...\n- [ ] RLS policies configured...",
    "priority": "high",
    "tags": ["web designer", "funnel"],
    "phase": 1,
    "dependsOn": []
  }
]
</planning_request>`;

    return prompt;
  }

  parseTasks(output) {
    // Try to extract JSON array from the output
    // Claude Code might wrap it in markdown code blocks
    let jsonStr = output;

    // Remove markdown code fences if present
    const jsonMatch = output.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    } else {
      // Try to find a raw JSON array
      const arrayMatch = output.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (arrayMatch) {
        jsonStr = arrayMatch[0];
      }
    }

    try {
      const tasks = JSON.parse(jsonStr);
      if (!Array.isArray(tasks)) {
        console.error('❌ Parsed result is not an array');
        return [];
      }

      // Validate each task has required fields
      return tasks.filter(t => {
        if (!t.name || !t.description) {
          console.warn(`⚠️ Skipping invalid task: ${JSON.stringify(t).slice(0, 100)}`);
          return false;
        }
        return true;
      });
    } catch (err) {
      console.error(`❌ Failed to parse task JSON: ${err.message}`);
      return [];
    }
  }

  mapPriority(priority) {
    const map = { urgent: 1, high: 2, normal: 3, low: 4 };
    return map[priority?.toLowerCase()] || 3;
  }

  runClaudeCode(prompt) {
    return new Promise((resolve, reject) => {
      const proc = spawn('claude', [
        '--print', '--dangerously-skip-permissions',
        '--output-format', 'text',
        '--max-turns', '30',
      ], {
        cwd: this.projectPath,
        env: { ...process.env, CLAUDECODE: undefined },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', d => { stdout += d.toString(); });
      proc.stderr.on('data', d => { stderr += d.toString(); });

      proc.stdin.write(prompt);
      proc.stdin.end();

      const timeout = setTimeout(() => {
        proc.kill('SIGTERM');
        reject(new Error('Planning timed out after 5 minutes'));
      }, 5 * 60 * 1000);

      proc.on('close', code => {
        clearTimeout(timeout);
        if (code === 0) resolve(stdout);
        else reject(new Error(`Claude Code exited with code ${code}: ${stderr.slice(-500)}`));
      });

      proc.on('error', err => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }
}
```

### Acceptance Criteria
- [ ] `node agent.mjs --plan "Fix Web Designer reliability"` generates a list of tasks
- [ ] Each generated task has: name, description with acceptance criteria, priority, tags, phase
- [ ] Tasks are created in the "For Impact OS" ClickUp list with correct statuses, priorities, and tags
- [ ] Phase ordering ensures foundation tasks come before dependent tasks
- [ ] Module tags match the MODULE_MAP in executor.mjs
- [ ] Planning prompt includes full VISION.md context

---

## 8. Layer 5: Parallel Execution Scheduler

**File:** `scheduler.mjs` (new)

**Purpose:** Dispatch multiple independent tasks to concurrent Claude Code processes. Respects dependencies (phase ordering) and resource limits.

### Design

- **Max concurrency:** 3 simultaneous Claude Code processes (configurable via `MAX_PARALLEL`)
- **Dependency resolution:** Tasks tagged with `phase: 1` run first. Phase 2 tasks start only after all phase 1 tasks complete.
- **Within a phase:** Tasks run in parallel up to the concurrency limit, ordered by priority
- **Isolation:** Each Claude Code process works in its own module directory. No two processes should modify the same module simultaneously.
- **Module locking:** If task A is working on "Web Designer" and task B also targets "Web Designer," task B waits until task A finishes.

### Implementation

```javascript
// scheduler.mjs — Parallel execution scheduler with dependency resolution

export class Scheduler {
  constructor({ maxParallel = 3 } = {}) {
    this.maxParallel = maxParallel;
    this.activeTasks = new Map();  // taskId → { module, promise }
    this.lockedModules = new Set(); // Module names currently being worked on
  }

  /**
   * Given a list of ready tasks, return which ones can be dispatched RIGHT NOW.
   * Respects: concurrency limit, module locking, dependency ordering.
   */
  getDispatchable(readyTasks) {
    const available = this.maxParallel - this.activeTasks.size;
    if (available <= 0) return [];

    // Filter out tasks whose module is currently locked
    const unlocked = readyTasks.filter(task => {
      const module = this.detectModule(task);
      return !this.lockedModules.has(module);
    });

    // Return up to `available` tasks, prioritized
    return unlocked.slice(0, available);
  }

  /**
   * Mark a task as started. Locks its module.
   */
  startTask(taskId, moduleName, promise) {
    this.activeTasks.set(taskId, { module: moduleName, promise });
    this.lockedModules.add(moduleName);
  }

  /**
   * Mark a task as finished. Unlocks its module.
   */
  finishTask(taskId) {
    const entry = this.activeTasks.get(taskId);
    if (entry) {
      this.lockedModules.delete(entry.module);
      this.activeTasks.delete(taskId);
    }
  }

  /**
   * Wait for at least one active task to finish.
   * Returns the result of the first task that completes.
   */
  async waitForAny() {
    if (this.activeTasks.size === 0) return null;

    const entries = Array.from(this.activeTasks.entries());
    const promises = entries.map(([taskId, { promise }]) =>
      promise.then(result => ({ taskId, result }))
    );

    return Promise.race(promises);
  }

  /**
   * Wait for ALL active tasks to finish.
   * Returns array of { taskId, result }.
   */
  async waitForAll() {
    if (this.activeTasks.size === 0) return [];

    const entries = Array.from(this.activeTasks.entries());
    const results = await Promise.allSettled(
      entries.map(([taskId, { promise }]) =>
        promise.then(result => ({ taskId, result }))
      )
    );

    return results.map(r => r.status === 'fulfilled' ? r.value : { taskId: 'unknown', result: { success: false, summary: r.reason?.message } });
  }

  get activeCount() {
    return this.activeTasks.size;
  }

  get isAtCapacity() {
    return this.activeTasks.size >= this.maxParallel;
  }

  /**
   * Detect which module a task belongs to (duplicates executor logic for scheduling).
   */
  detectModule(task) {
    const MODULE_MAP = {
      'web designer': 'Web Designer',
      'funnel designer': 'funnel-designer',
      'funnel': 'funnel-designer',
      'copywriter': 'Copywriter',
      'copy': 'Copywriter',
      'brand creator': 'brand creator',
      'brand': 'brand creator',
      'doc factory': 'doc factory',
      'docs': 'doc factory',
      'pageforge': 'pageforge',
    };

    // Check tags first
    if (task.tags?.length) {
      for (const tag of task.tags) {
        const key = tag.name?.toLowerCase() || tag.toLowerCase();
        if (MODULE_MAP[key]) return MODULE_MAP[key];
      }
    }

    // Check name and description
    const text = `${task.name} ${task.description || ''}`.toLowerCase();
    for (const [keyword, module] of Object.entries(MODULE_MAP)) {
      if (text.includes(keyword)) return module;
    }

    return 'unknown';
  }
}
```

### Acceptance Criteria
- [ ] Maximum 3 concurrent Claude Code processes
- [ ] Two tasks targeting the same module never run simultaneously
- [ ] `getDispatchable()` correctly filters by concurrency limit and module locks
- [ ] `waitForAny()` returns as soon as any task completes (enabling immediate dispatch of next task)
- [ ] Module lock is released when a task finishes (success or failure)

---

## 9. Layer 6: Upgraded Agent Loop

**File:** `agent.mjs` (full rewrite of main loop)

**Changes from current:**
- Integrates Memory, Scheduler, SelfHealer
- Supports `--plan "vision"` mode for planning
- Parallel task dispatch instead of sequential
- Crash recovery on startup (checks for orphaned tasks)
- Better error handling and logging

### Updated CLI Modes

```bash
# Continuous mode — watches for tasks, dispatches in parallel
npm start

# Single task mode — process one task and exit
npm run start:once

# Dry run — shows what would happen
npm run start:dry

# Planning mode — decompose a vision into ClickUp tasks
node agent.mjs --plan "Build the Unified Outputs System"

# Status check
npm run status
```

### Implementation (Key Changes Only)

The full file is long, so here are the critical sections to change:

#### Updated imports and initialization

```javascript
import { config } from 'dotenv';
import { ClickUpClient } from './clickup.mjs';
import { ClaudeExecutor } from './executor.mjs';
import { QARunner } from './qa.mjs';
import { Planner } from './planner.mjs';
import { Scheduler } from './scheduler.mjs';
import { Memory } from './memory.mjs';
import { SelfHealer } from './healer.mjs';
import { Logger } from './logger.mjs';

config();

// ... CONFIG object stays the same, add:
const CONFIG = {
  // ... existing config ...
  maxParallel: parseInt(process.env.MAX_PARALLEL || '3'),
};

// Initialize all components
const log      = new Logger(CONFIG.logLevel);
const memory   = new Memory();
const clickup  = new ClickUpClient(CONFIG.clickupToken, CONFIG.clickupListId, CONFIG.clickupWorkspace);
const executor = new ClaudeExecutor({
  projectPath: CONFIG.projectPath,
  visionDocPath: CONFIG.visionDocPath,
  maxRetries: CONFIG.maxRetries,
  memory: memory,    // Pass memory for context enrichment
});
const qa       = new QARunner(CONFIG.projectPath);
const healer   = new SelfHealer(memory);
const scheduler = new Scheduler({ maxParallel: CONFIG.maxParallel });
const planner  = new Planner(clickup, CONFIG.visionDocPath, CONFIG.projectPath);
```

#### Planning mode handler

```javascript
// CLI flags
const args = process.argv.slice(2);
const ONCE     = args.includes('--once');
const DRY_RUN  = args.includes('--dry-run');
const PLAN_IDX = args.indexOf('--plan');
const PLAN_VISION = PLAN_IDX >= 0 ? args[PLAN_IDX + 1] : null;

// In main():
if (PLAN_VISION) {
  console.log('\n🧠 PLANNING MODE\n');
  const result = await planner.plan(PLAN_VISION);
  console.log(`\nDone. Created ${result.tasksCreated} tasks.`);
  return;
}
```

#### Crash recovery on startup

```javascript
async function recoverFromCrash() {
  const orphaned = memory.getOrphanedTasks();
  if (orphaned.length === 0) return;

  log.warn(`Found ${orphaned.length} orphaned task(s) from a previous crash.`);
  
  for (const taskId of orphaned) {
    try {
      // Reset task status in ClickUp so it can be picked up again
      await clickup.updateTaskStatus(taskId, 'not started');
      await clickup.addComment(taskId, '⚠️ **Agent recovered from crash.** This task was in progress when the agent stopped. Resetting to queue.');
      memory.clearOrphanedTask(taskId);
      log.info(`  Reset task ${taskId} to queue.`);
    } catch (err) {
      log.error(`  Failed to reset task ${taskId}: ${err.message}`);
      memory.clearOrphanedTask(taskId);
    }
  }
}
```

#### Updated processTask with self-healing

```javascript
async function processTask(task) {
  log.task(task.name);
  const moduleName = executor.detectModulePath(task).split('/').pop();

  // Record in memory
  memory.recordTaskStart(task.id, task.name, moduleName);

  // Mark in ClickUp
  if (!DRY_RUN) {
    await clickup.updateTaskStatus(task.id, 'in progress');
    await clickup.addComment(task.id, '🤖 **Agent picked up this task.** Starting work now...');
  }

  const taskPrompt = clickup.formatTaskForPrompt(task);
  if (DRY_RUN) {
    log.info(`  [DRY RUN] Would execute: ${task.name}`);
    return { task, result: { success: true }, qaResults: null };
  }

  // Execute with self-healing retry loop
  let result = null;
  let qaResults = null;
  let attempt = 0;
  const previousErrors = [];

  while (attempt < healer.maxRetries) {
    attempt++;
    log.working(`Attempt ${attempt}/${healer.maxRetries}...`);

    result = await executor.execute(task, taskPrompt, {
      attempt,
      previousErrors,
      memoryContext: memory.getContextForTask(moduleName),
    });

    // Run QA if execution reported success
    if (result.success) {
      log.working('Running QA checks...');
      qaResults = await qa.runAll(result.modulePath, {
        name: task.name,
        description: task.description,
        filesChanged: result.filesChanged,
      });

      if (qaResults.passed) {
        // SUCCESS — break out of retry loop
        break;
      } else {
        // QA failed — treat as an error for self-healing
        const qaError = qaResults.checks
          .filter(c => !c.passed)
          .map(c => `${c.name}: ${c.output}`)
          .join('\n');
        
        const healing = healer.classifyError(qaError, { attempt, previousErrors });
        
        if (!healing.shouldRetry) {
          result.success = false;
          result.summary = `QA failed after ${attempt} attempts: ${qaError.slice(0, 200)}`;
          break;
        }

        previousErrors.push(qaError);
        log.warn(`QA failed — ${healing.category}. Retrying with adjusted approach...`);
        // The healing.retryPrompt will be injected into the next executor call
        result._healingPrompt = healing.retryPrompt;
      }
    } else {
      // Execution itself failed
      const healing = healer.classifyError(result.summary || result.rawOutput, { attempt, previousErrors });
      
      if (!healing.shouldRetry) {
        break;
      }

      previousErrors.push(result.summary || result.rawOutput?.slice(-300));
      log.warn(`Execution failed — ${healing.category}. Retrying...`);
      result._healingPrompt = healing.retryPrompt;
    }
  }

  // Record in memory
  memory.recordTaskComplete(task.id, {
    ...result,
    taskName: task.name,
    qaResults: qaResults ? {
      build: qaResults.checks.find(c => c.name === 'build')?.passed,
      lint: qaResults.checks.find(c => c.name === 'lint')?.passed,
      test: qaResults.checks.find(c => c.name === 'test')?.passed,
      sanity: qaResults.checks.find(c => c.name === 'sanity')?.passed,
    } : null,
    errors: previousErrors.map((e, i) => ({
      attempt: i + 1,
      error: e,
    })),
  });

  // Report to ClickUp
  await reportResults(task, result, qaResults);

  return { task, result, qaResults };
}
```

#### Parallel main loop

```javascript
async function main() {
  // ... banner ...

  // Crash recovery
  await recoverFromCrash();

  // Planning mode
  if (PLAN_VISION) {
    const result = await planner.plan(PLAN_VISION);
    console.log(`\nDone. Created ${result.tasksCreated} tasks.`);
    return;
  }

  // Single task mode
  if (ONCE) {
    const task = await clickup.getNextTask();
    if (task) await processTask(task);
    else log.info('No tasks in queue.');
    return;
  }

  // Continuous parallel loop
  log.info(`Polling every ${CONFIG.pollInterval / 1000}s | Max parallel: ${CONFIG.maxParallel}`);

  while (true) {
    try {
      // Get all ready tasks
      const readyTasks = await clickup.getReadyTasks();

      if (readyTasks.length > 0) {
        // Ask scheduler which ones we can dispatch now
        const dispatchable = scheduler.getDispatchable(readyTasks);

        for (const task of dispatchable) {
          const moduleName = scheduler.detectModule(task);
          log.info(`🚀 Dispatching: "${task.name}" → ${moduleName}`);

          // Start task asynchronously
          const taskPromise = processTask(task).catch(err => {
            log.error(`Task "${task.name}" crashed: ${err.message}`);
            return { task, result: { success: false, summary: err.message }, qaResults: null };
          });

          scheduler.startTask(task.id, moduleName, taskPromise);
        }
      }

      // Wait for any active task to complete (or timeout)
      if (scheduler.activeCount > 0) {
        const completed = await Promise.race([
          scheduler.waitForAny(),
          new Promise(resolve => setTimeout(() => resolve(null), CONFIG.pollInterval)),
        ]);

        if (completed) {
          scheduler.finishTask(completed.taskId);
          log.info(`✅ Completed: ${completed.taskId}`);
          continue; // Immediately check for more tasks
        }
      }

      if (scheduler.activeCount === 0 && readyTasks?.length === 0) {
        log.waiting('No tasks in queue. Waiting...');
      }
    } catch (err) {
      log.error(`Error in main loop: ${err.message}`);
    }

    await new Promise(resolve => setTimeout(resolve, CONFIG.pollInterval));
  }
}
```

### Acceptance Criteria
- [ ] `--plan "vision"` mode generates ClickUp tasks without executing them
- [ ] Crash recovery detects and resets orphaned tasks on startup
- [ ] Self-healing retries with error-specific prompts (not generic "try again")
- [ ] Parallel dispatch respects module locking (no two tasks on same module)
- [ ] Parallel dispatch respects max concurrency (default 3)
- [ ] Memory records all task outcomes, errors, and module health
- [ ] Failed tasks go to "blocked" with detailed error reports in ClickUp comments

---

## 10. Updated ClickUp Client

**File:** `clickup.mjs` (add these methods to existing class)

### New Methods to Add

```javascript
  // ─── Get Ready Tasks (all tasks ready for the agent) ───────────

  async getReadyTasks() {
    const tasks = await this.getTasks(['to do', 'open', 'not started']);
    
    // Sort by priority, then by date_created (FIFO within priority)
    tasks.sort((a, b) => {
      const pa = a.priority?.orderindex ?? 99;
      const pb = b.priority?.orderindex ?? 99;
      if (pa !== pb) return pa - pb;
      return parseInt(a.date_created) - parseInt(b.date_created);
    });

    return tasks;
  }

  // ─── Create Task (for the planning agent) ──────────────────────

  async createTask({ name, description, priority = 3, tags = [], status = 'not started' }) {
    const body = {
      name,
      description,
      status,
      priority,
    };

    if (tags.length > 0) {
      body.tags = tags;
    }

    return this.request(`/list/${this.listId}/task`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // ─── Bulk operations ──────────────────────────────────────────

  async createTasks(taskList) {
    const results = [];
    for (const task of taskList) {
      try {
        const created = await this.createTask(task);
        results.push({ success: true, task: created });
        // Rate limiting: 300ms between requests
        await new Promise(r => setTimeout(r, 300));
      } catch (err) {
        results.push({ success: false, error: err.message, taskName: task.name });
      }
    }
    return results;
  }
```

### Acceptance Criteria
- [ ] `getReadyTasks()` returns all open tasks sorted by priority then age
- [ ] `createTask()` creates a single task in the "For Impact OS" list with all fields
- [ ] `createTasks()` handles bulk creation with rate limiting
- [ ] Tags are correctly passed to the ClickUp API

---

## 11. Configuration & Environment

### Updated .env.example

```bash
# ClickUp
CLICKUP_API_TOKEN=pk_xxxxx
CLICKUP_LIST_ID=901521692113
CLICKUP_WORKSPACE_ID=9015743183

# Project
PROJECT_PATH=/Users/Administrator/Claude
VISION_DOC_PATH=./VISION.md

# Agent behavior
POLL_INTERVAL_SECONDS=60
MAX_RETRIES=3
MAX_PARALLEL=3
AUTO_COMMIT=false
LOG_LEVEL=info

# Optional: timeout for Claude Code execution (minutes)
CLAUDE_TIMEOUT_MINUTES=10
```

### Updated package.json

```json
{
  "name": "impact-os-agent",
  "version": "2.0.0",
  "description": "Autonomous agent orchestrator for Impact OS — plans, executes, QAs, self-heals, and reports. Supports parallel execution and persistent memory.",
  "main": "agent.mjs",
  "type": "module",
  "scripts": {
    "start": "node agent.mjs",
    "start:once": "node agent.mjs --once",
    "start:dry": "node agent.mjs --dry-run",
    "plan": "node agent.mjs --plan",
    "status": "node status.mjs"
  },
  "dependencies": {
    "dotenv": "^16.4.5"
  }
}
```

No new npm dependencies needed. The entire system runs on Node.js built-ins + dotenv.

---

## 12. Testing & Validation

### Manual Test Sequence

Run these in order to validate the build:

**Test 1: Bug fixes**
```bash
# Verify regex fix
node -e "const output = 'Some output\n<result>\nSTATUS: success\nFILES_CHANGED: test.js\nSUMMARY: Test summary\nBLOCKERS:\nTESTS: passed\n</result>'; const match = output.match(/<result>([\s\S]*?)<\/result>/); console.log(match ? 'PASS' : 'FAIL');"
```

**Test 2: Memory**
```bash
# Start and check memory.json is created
node -e "import('./memory.mjs').then(m => { const mem = new m.Memory(); console.log('Memory initialized:', JSON.stringify(mem.data).slice(0, 100)); })"
```

**Test 3: Status check**
```bash
npm run status
```

**Test 4: Dry run**
```bash
npm run start:dry
```

**Test 5: Planning (creates real ClickUp tasks — use with intention)**
```bash
node agent.mjs --plan "Add retry logic to Web Designer image upload"
```

**Test 6: Single task execution**
```bash
npm run start:once
```

**Test 7: Continuous mode (Ctrl+C to stop)**
```bash
npm start
```

### What Success Looks Like

After the full build, running `npm start` should show:

```
╔═══════════════════════════════════════════╗
║     🚀 Impact OS Agent Orchestrator v2   ║
║                                           ║
║  Watching: For Impact OS (ClickUp)        ║
║  Mode: Continuous | Parallel: 3           ║
╚═══════════════════════════════════════════╝

✅ Memory loaded (0 tasks in history)
✅ No orphaned tasks to recover
📡 Polling every 60s for new tasks...

🚀 Dispatching: "Fix image upload timeout" → Web Designer
🚀 Dispatching: "Add error logging to Brand Creator" → brand creator
🤖 [Web Designer] Executing (attempt 1/3)...
🤖 [brand creator] Executing (attempt 1/3)...
🧪 [Web Designer] Running QA... ✅ PASSED
✅ "Fix image upload timeout" completed → moved to review
🧪 [brand creator] Running QA... ✅ PASSED
✅ "Add error logging to Brand Creator" completed → moved to review
📡 No tasks in queue. Waiting...
```

---

## 13. Deployment

### On the Hetzner VPS

```bash
cd /Users/Administrator/Claude/impact-os-agent

# Pull the updated code (or paste the files directly)
# Fix bugs first, then build new files in order:
# 1. memory.mjs
# 2. healer.mjs
# 3. qa.mjs (upgrade)
# 4. executor.mjs (fixes)
# 5. clickup.mjs (additions)
# 6. planner.mjs
# 7. scheduler.mjs
# 8. agent.mjs (upgrade)

# Install dependencies (none new, but just in case)
npm install

# Test
npm run start:dry

# Run continuously (use tmux or screen for persistence)
tmux new -s agent
npm start
# Ctrl+B then D to detach

# Or use PM2 for process management
npm install -g pm2
pm2 start agent.mjs --name "impact-os-agent"
pm2 save
pm2 startup  # Auto-restart on VPS reboot
```

### Build Order

When giving this to Claude Code, build in this order:

1. **Fix the 3 bugs** (executor.mjs regex, qa.mjs path, agent.mjs status)
2. **memory.mjs** — no dependencies on other new files
3. **healer.mjs** — depends on memory
4. **qa.mjs** — upgrade existing file, no dependency on new files
5. **executor.mjs** — upgrade to return modulePath and accept memory context
6. **clickup.mjs** — add createTask, getReadyTasks methods
7. **planner.mjs** — depends on clickup
8. **scheduler.mjs** — standalone
9. **agent.mjs** — depends on everything above

---

## Summary of What This Builds

| Layer | File | Status | What It Does |
|-------|------|--------|-------------|
| Bug Fixes | executor.mjs, qa.mjs, agent.mjs | Fix 3 critical bugs | Regex parsing, QA path, blocked status |
| Memory | memory.mjs | NEW | Persists task history, module health, error patterns across restarts |
| Self-Healing | healer.mjs | NEW | Classifies errors, generates specific retry prompts, escalates intelligently |
| QA Validator | qa.mjs | UPGRADE | Module-aware, file verification, TypeScript support |
| Planning | planner.mjs | NEW | Vision → decomposed ClickUp tasks with dependencies and acceptance criteria |
| Parallel | scheduler.mjs | NEW | Dispatches concurrent tasks with module locking |
| Orchestrator | agent.mjs | UPGRADE | Crash recovery, parallel loop, self-healing integration, planning mode |
| ClickUp | clickup.mjs | UPGRADE | Task creation, bulk operations, ready task retrieval |

**Total: 4 new files, 4 upgraded files, 0 new npm dependencies.**
