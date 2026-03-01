#!/usr/bin/env node

// agent.mjs — Impact OS Agent Orchestrator v2
// =============================================
// Autonomous development agent that:
// 1. Polls ClickUp "For Impact OS" list for tasks
// 2. Dispatches tasks in parallel (with module locking)
// 3. Executes via Claude Code with self-healing retries
// 4. Runs QA checks on results
// 5. Records everything in persistent memory
// 6. Reports back to ClickUp
// 7. Supports planning mode: vision → ClickUp tasks

import { config } from 'dotenv';
import { ClickUpClient } from './clickup.mjs';
import { ClaudeExecutor } from './executor.mjs';
import { QARunner } from './qa.mjs';
import { Planner } from './planner.mjs';
import { Scheduler } from './scheduler.mjs';
import { Memory } from './memory.mjs';
import { SelfHealer } from './healer.mjs';
import { Reporter } from './reporter.mjs';
import { Logger } from './logger.mjs';

config(); // Load .env

// ─── Configuration ───────────────────────────────────────────────

const CONFIG = {
  clickupToken:     process.env.CLICKUP_API_TOKEN,
  clickupListId:    process.env.CLICKUP_LIST_ID || '901521692113',
  clickupWorkspace: process.env.CLICKUP_WORKSPACE_ID || '9015743183',
  projectPath:      process.env.PROJECT_PATH,
  visionDocPath:    process.env.VISION_DOC_PATH || './VISION.md',
  pollInterval:     parseInt(process.env.POLL_INTERVAL_SECONDS || '60') * 1000,
  maxRetries:       parseInt(process.env.MAX_RETRIES || '3'),
  maxParallel:      parseInt(process.env.MAX_PARALLEL || '3'),
  autoCommit:       process.env.AUTO_COMMIT === 'true',
  logLevel:         process.env.LOG_LEVEL || 'info',
};

// ─── Validate Config ─────────────────────────────────────────────

function validateConfig() {
  const missing = [];
  if (!CONFIG.clickupToken)  missing.push('CLICKUP_API_TOKEN');
  if (!CONFIG.projectPath)   missing.push('PROJECT_PATH');

  if (missing.length > 0) {
    console.error(`\n❌ Missing required environment variables:\n`);
    missing.forEach(v => console.error(`   - ${v}`));
    console.error(`\n   Copy .env.example to .env and fill in the values.\n`);
    process.exit(1);
  }
}

// ─── CLI Flags ───────────────────────────────────────────────────

const args = process.argv.slice(2);
const ONCE     = args.includes('--once');
const DRY_RUN  = args.includes('--dry-run');
const PLAN_IDX = args.indexOf('--plan');
const PLAN_VISION = PLAN_IDX >= 0 ? args[PLAN_IDX + 1] : null;

// ─── Initialize ──────────────────────────────────────────────────

validateConfig();

const log       = new Logger(CONFIG.logLevel);
const memory    = new Memory();
const clickup   = new ClickUpClient(CONFIG.clickupToken, CONFIG.clickupListId, CONFIG.clickupWorkspace);
const executor  = new ClaudeExecutor({
  projectPath:   CONFIG.projectPath,
  visionDocPath: CONFIG.visionDocPath,
  maxRetries:    CONFIG.maxRetries,
  memory,
});
const qa        = new QARunner(CONFIG.projectPath);
const healer    = new SelfHealer(memory);
const scheduler = new Scheduler({ maxParallel: CONFIG.maxParallel });
const planner   = new Planner(clickup, CONFIG.visionDocPath, CONFIG.projectPath, memory);
const reporter  = new Reporter(clickup, memory, CONFIG.projectPath);

// ─── Crash Recovery ──────────────────────────────────────────────

async function recoverFromCrash() {
  const orphaned = memory.getOrphanedTasks();
  if (orphaned.length === 0) return;

  log.warn(`Found ${orphaned.length} orphaned task(s) from a previous crash.`);

  for (const taskId of orphaned) {
    try {
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

// ─── Process a Single Task (with self-healing) ───────────────────

async function processTask(task) {
  log.task(task.name);
  log.info(`  Priority: ${task.priority?.priority || 'none'} | ID: ${task.id}`);

  const moduleName = executor.detectModulePath(task).split('/').pop();

  // Record in memory
  memory.recordTaskStart(task.id, task.name, moduleName);

  // Mark as "in progress" in ClickUp
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
  let healingPrompt = '';

  while (attempt < healer.maxRetries) {
    attempt++;
    log.working(`Attempt ${attempt}/${healer.maxRetries}...`);

    result = await executor.execute(task, taskPrompt, {
      attempt,
      previousErrors,
      memoryContext: memory.getContextForTask(moduleName),
      healingPrompt,
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
        // Success — break out of retry loop
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
        healingPrompt = healing.retryPrompt;
        log.warn(`QA failed — ${healing.category}. Retrying with adjusted approach...`);
      }
    } else {
      // Execution itself failed
      const healing = healer.classifyError(result.summary || result.rawOutput, { attempt, previousErrors });

      if (!healing.shouldRetry) {
        break;
      }

      previousErrors.push(result.summary || result.rawOutput?.slice?.(-300) || '');
      healingPrompt = healing.retryPrompt;
      log.warn(`Execution failed — ${healing.category}. Retrying...`);
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

  // Check if this completes a phase → trigger summary report
  if (result.success) {
    try {
      await reporter.onTaskComplete(task, result);
    } catch (err) {
      log.warn(`Phase reporter error (non-fatal): ${err.message}`);
    }
  }

  return { task, result, qaResults };
}

// ─── Report Results to ClickUp ───────────────────────────────────

async function reportResults(task, result, qaResults) {
  const lines = [
    `## 🤖 Agent Report`,
    `**Status:** ${result.success ? '✅ Completed' : '❌ Failed'}`,
    `**Attempts:** ${result.attempts}`,
    `**Module:** ${result.module || 'unknown'}`,
    '',
    `### Summary`,
    result.summary || 'No summary available.',
  ];

  if (result.filesChanged?.length) {
    lines.push('', '### Files Changed');
    result.filesChanged.forEach(f => lines.push(`- \`${f}\``));
  }

  if (result.blockers) {
    lines.push('', `### ⚠️ Blockers`, result.blockers);
  }

  if (qaResults) {
    lines.push('', qa.formatReport(qaResults));
  }

  const comment = lines.join('\n');
  await clickup.addComment(task.id, comment);

  // Set final status
  if (result.success && qaResults?.passed) {
    if (CONFIG.autoCommit) {
      await clickup.updateTaskStatus(task.id, 'completed');
      log.success(`Task "${task.name}" completed and auto-closed.`);
    } else {
      await clickup.updateTaskStatus(task.id, 'ready for review');
      log.success(`Task "${task.name}" completed — moved to review.`);
    }
  } else if (result.success && !qaResults?.passed) {
    await clickup.updateTaskStatus(task.id, 'ready for review');
    await clickup.addComment(task.id, '⚠️ **Note:** Task completed successfully but QA checks failed. Please review the QA report above.');
    log.warn(`Task "${task.name}" completed but QA failed — needs human review.`);
  } else {
    await clickup.updateTaskStatus(task.id, 'blocked');
    log.error(`Task "${task.name}" failed — marked as blocked.`);
  }
}

// ─── Main Loop ───────────────────────────────────────────────────

async function main() {
  const modeStr = PLAN_VISION ? 'Planning     '
    : ONCE ? 'Single task  '
    : DRY_RUN ? 'Dry run      '
    : `Continuous | Parallel: ${CONFIG.maxParallel}`;

  console.log(`
╔═══════════════════════════════════════════╗
║     🚀 Impact OS Agent Orchestrator v2   ║
║                                           ║
║  Watching: For Impact OS (ClickUp)        ║
║  Mode: ${modeStr.padEnd(33)}║
╚═══════════════════════════════════════════╝
  `);

  // Crash recovery
  await recoverFromCrash();

  const taskCount = Object.keys(memory.data.taskHistory).length;
  log.info(`Memory loaded (${taskCount} tasks in history)`);

  // Planning mode
  if (PLAN_VISION) {
    log.info('🧠 PLANNING MODE');
    const result = await planner.plan(PLAN_VISION);
    console.log(`\nDone. Created ${result.tasksCreated} tasks.`);
    return;
  }

  // Single task mode
  if (ONCE) {
    const task = await clickup.getNextTask();
    if (task) {
      await processTask(task);
    } else {
      log.info('No tasks in queue. Nothing to do.');
    }
    return;
  }

  // Dry run mode
  if (DRY_RUN) {
    const readyTasks = await clickup.getReadyTasks();
    if (readyTasks.length === 0) {
      log.info('No tasks in queue.');
    } else {
      log.info(`Found ${readyTasks.length} ready task(s):`);
      for (const task of readyTasks) {
        const moduleName = scheduler.detectModule(task);
        log.info(`  [DRY RUN] Would dispatch: "${task.name}" → ${moduleName}`);
      }
    }
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
      log.debug(err.stack);
    }

    await new Promise(resolve => setTimeout(resolve, CONFIG.pollInterval));
  }
}

// ─── Handle shutdown gracefully ──────────────────────────────────

process.on('SIGINT', () => {
  console.log('\n\n👋 Agent shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n👋 Agent received SIGTERM, shutting down...');
  process.exit(0);
});

// ─── Run ─────────────────────────────────────────────────────────

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
