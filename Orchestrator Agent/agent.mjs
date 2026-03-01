#!/usr/bin/env node

// agent.mjs — Impact OS Agent Orchestrator
// =========================================
// The main loop that:
// 1. Polls ClickUp "For Impact OS" list for tasks
// 2. Picks the highest-priority open task
// 3. Sends it to Claude Code for execution
// 4. Runs QA checks on the result
// 5. Reports back to ClickUp
// 6. Repeats

import { config } from 'dotenv';
import { ClickUpClient } from './clickup.mjs';
import { ClaudeExecutor } from './executor.mjs';
import { QARunner } from './qa.mjs';
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
  maxRetries:       parseInt(process.env.MAX_RETRIES || '2'),
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
const ONCE    = args.includes('--once');     // Process one task and exit
const DRY_RUN = args.includes('--dry-run');  // Show what would happen without executing

// ─── Initialize ──────────────────────────────────────────────────

validateConfig();

const log      = new Logger(CONFIG.logLevel);
const clickup  = new ClickUpClient(CONFIG.clickupToken, CONFIG.clickupListId, CONFIG.clickupWorkspace);
const executor = new ClaudeExecutor({
  projectPath:  CONFIG.projectPath,
  visionDocPath: CONFIG.visionDocPath,
  maxRetries:   CONFIG.maxRetries,
});
const qa = new QARunner(CONFIG.projectPath);

// ─── Process a Single Task ───────────────────────────────────────

async function processTask(task) {
  log.task(task.name);
  log.info(`  Priority: ${task.priority?.priority || 'none'} | ID: ${task.id}`);

  // Step 1: Mark as "in progress"
  if (!DRY_RUN) {
    await clickup.updateTaskStatus(task.id, 'in progress');
    await clickup.addComment(task.id, '🤖 **Agent picked up this task.** Starting work now...');
  }

  // Step 2: Format task for Claude Code
  const taskPrompt = clickup.formatTaskForPrompt(task);
  
  if (DRY_RUN) {
    log.info('  [DRY RUN] Would send to Claude Code:');
    log.info(`  ${taskPrompt.slice(0, 200)}...`);
    return;
  }

  // Step 3: Execute via Claude Code
  log.working('Sending to Claude Code...');
  const result = await executor.execute(task, taskPrompt);

  // Step 4: Run QA if execution succeeded
  let qaResults = null;
  if (result.success) {
    log.working('Running QA checks...');
    qaResults = await qa.runAll();
  }

  // Step 5: Report back to ClickUp
  await reportResults(task, result, qaResults);

  return { task, result, qaResults };
}

// ─── Report Results to ClickUp ───────────────────────────────────

async function reportResults(task, result, qaResults) {
  const lines = [
    `## 🤖 Agent Report`,
    `**Status:** ${result.success ? '✅ Completed' : '❌ Failed'}`,
    `**Attempts:** ${result.attempts}`,
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
    await clickup.updateTaskStatus(task.id, 'not started');
    log.error(`Task "${task.name}" failed — marked as blocked.`);
  }
}

// ─── Main Loop ───────────────────────────────────────────────────

async function main() {
  console.log(`
╔═══════════════════════════════════════════╗
║     🚀 Impact OS Agent Orchestrator      ║
║                                           ║
║  Watching: For Impact OS (ClickUp)        ║
║  Mode: ${ONCE ? 'Single task' : DRY_RUN ? 'Dry run   ' : 'Continuous '}                        ║
╚═══════════════════════════════════════════╝
  `);

  if (ONCE) {
    // Single task mode
    const task = await clickup.getNextTask();
    if (task) {
      await processTask(task);
    } else {
      log.info('No tasks in queue. Nothing to do.');
    }
    return;
  }

  // Continuous polling loop
  log.info(`Polling every ${CONFIG.pollInterval / 1000}s for new tasks...`);
  
  while (true) {
    try {
      const task = await clickup.getNextTask();

      if (task) {
        await processTask(task);
        // After completing a task, immediately check for more
        continue;
      } else {
        log.waiting('No tasks in queue. Waiting...');
      }
    } catch (err) {
      log.error(`Error in main loop: ${err.message}`);
      log.debug(err.stack);
    }

    // Wait before polling again
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
