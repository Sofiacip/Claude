// chain.mjs — Module Chaining: sequential multi-module alignment + execution
//
// Drives a list of modules through the full lifecycle:
//   pending → aligning → awaiting_answers → awaiting_approval → executing → completed
//
// State persists to data/chain-state.json for crash recovery.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { SlackClient } from './slack.mjs';

const STATE_PATH = path.join(process.cwd(), 'data', 'chain-state.json');

// CLI module name → ClickUp tag name
const MODULE_TAG_MAP = {
  'web-designer':    'web designer',
  'funnel-designer': 'funnel designer',
  'doc-factory':     'doc factory',
  'copywriter':      'copywriter',
  'copywriter-ui':   'copywriter-ui',
  'brand-creator':   'brand creator',
  'pageforge':       'pageforge',
};

export class ModuleChain {
  constructor({
    instruction,
    modules,
    alignment,
    planner,
    autopilot,
    clickup,
    slack,
    memory,
    scheduler,
    qa,
    executor,
    healer,
    reporter,
    config,
    processTask,
  }) {
    this.instruction = instruction;
    this.modules = modules;
    this.alignment = alignment;
    this.planner = planner;
    this.autopilot = autopilot;
    this.clickup = clickup;
    this.slack = slack;
    this.memory = memory;
    this.scheduler = scheduler;
    this.qa = qa;
    this.executor = executor;
    this.healer = healer;
    this.reporter = reporter;
    this.config = config;
    this.processTask = processTask;

    // Normalize module names to ClickUp tag names
    this.moduleTags = modules.map(m => MODULE_TAG_MAP[m] || m.replace(/-/g, ' '));

    this.state = this._initState();
  }

  // ─── Main Entry Point ───────────────────────────────────────────

  async run() {
    const total = this.modules.length;
    const startedAt = new Date();

    console.log(`\n🔗 Module Chain: ${total} module(s) — ${this.modules.join(', ')}`);
    console.log(`   Instruction: "${this.instruction}"\n`);

    for (let i = 0; i < total; i++) {
      const moduleName = this.modules[i];
      const moduleTag = this.moduleTags[i];
      const moduleState = this.state.moduleStates[moduleName];

      // Skip already completed modules (crash recovery)
      if (moduleState.status === 'completed') {
        console.log(`⏭️  Module ${i + 1}/${total}: ${moduleName} — already completed, skipping`);
        continue;
      }

      console.log(`\n${'═'.repeat(60)}`);
      console.log(`  🔗 Module ${i + 1}/${total}: ${moduleName}`);
      console.log('═'.repeat(60));

      this.state.current = i;
      this._saveState();

      // Post header to Slack
      await this.slack.postStatus(`🔗 *Module ${i + 1}/${total}: ${moduleName}*\nInstruction: "${this.instruction}"`);

      try {
        // Step 1: Alignment (questions → answers → plan summary → approval)
        await this._runModuleAlignment(moduleName, moduleTag, i, total);

        // Step 2: Create tasks
        const tasksCreated = await this._createModuleTasks(moduleName, moduleTag);

        // Step 3: Scoped autopilot execution
        await this._runScopedAutopilot(moduleName, moduleTag);

        // Step 4: Mark complete
        moduleState.status = 'completed';
        moduleState.completedAt = new Date().toISOString();
        this._saveState();

        await this.slack.postStatus(`✅ *Module ${i + 1}/${total}: ${moduleName}* — completed (${moduleState.tasksCreated || 0} tasks)`);
        console.log(`\n✅ Module ${moduleName} completed.`);
      } catch (err) {
        console.error(`❌ Module ${moduleName} failed: ${err.message}`);
        moduleState.status = 'failed';
        moduleState.error = err.message;
        this._saveState();

        await this.slack.postStatus(`❌ *Module ${i + 1}/${total}: ${moduleName}* — failed: ${err.message}`);
        // Continue to next module rather than aborting the whole chain
      }
    }

    // Final summary
    await this._postFinalSummary(startedAt);

    this.state.status = 'completed';
    this.state.updatedAt = new Date().toISOString();
    this._saveState();
  }

  // ─── Alignment Phase ────────────────────────────────────────────

  async _runModuleAlignment(moduleName, moduleTag, index, total) {
    const moduleState = this.state.moduleStates[moduleName];

    // Skip alignment phases already completed (crash recovery)
    if (['executing', 'completed'].includes(moduleState.status)) return;

    moduleState.status = 'aligning';
    this._saveState();

    // Assess if full alignment is needed
    const assessment = await this.alignment.assess(this.instruction);

    let threadTs = moduleState.slackThreadTs || null;
    let questions = [];
    let summary = null;

    if (!assessment.needsFull) {
      // Narrow instruction — brief summary
      console.log(`  Instruction is specific for ${moduleName} — skipping full Q&A`);
      summary = await this.alignment.generateBriefSummary(this.instruction, { moduleName });
    } else {
      // Full alignment — generate scoped questions
      console.log(`  Full alignment needed for ${moduleName}`);
      questions = await this.alignment.generateQuestions(this.instruction, { moduleName });

      if (questions.length === 0) {
        throw new Error(`Failed to generate alignment questions for ${moduleName}`);
      }

      // Post questions to a NEW Slack thread for this module
      const qList = questions.map((q, i) => `${i + 1}. ${q}`).join('\n');
      const slackMsg = await this.slack.postStatus(
        `🎯 *Alignment: ${moduleName} (${index + 1}/${total})*\nInstruction: "${this.instruction}"\n\n${qList}\n\n_Answer all questions in this thread._`
      );
      threadTs = slackMsg?.ts;
      moduleState.slackThreadTs = threadTs;
      moduleState.questionsPostedAt = new Date().toISOString();
      moduleState.status = 'awaiting_answers';
      this._saveState();

      if (!threadTs) {
        throw new Error(`Failed to post questions to Slack for ${moduleName}`);
      }

      // Poll for answers with 24h reminder
      console.log(`  Waiting for answers in Slack thread for ${moduleName}...`);
      let reminderSent = false;
      const questionsPostedAt = Date.now();

      const answers = await this.slack.pollThreadReplies(threadTs, {
        intervalMs: 30_000,
        onPoll: async () => {
          const elapsed = Date.now() - questionsPostedAt;
          const hours = elapsed / (1000 * 60 * 60);
          if (hours >= 24 && !reminderSent) {
            await this.slack.postThreadReply(threadTs, `⏰ *Reminder:* Alignment questions for *${moduleName}* are still waiting for answers. Reply in this thread to continue.`);
            reminderSent = true;
            moduleState.lastReminderAt = new Date().toISOString();
            this._saveState();
          }
        },
      });

      moduleState.answeredAt = new Date().toISOString();
      this._saveState();

      console.log(`  Got answers for ${moduleName}. Generating plan summary...`);
      summary = await this.alignment.generatePlanSummary(this.instruction, questions, answers, { moduleName });
    }

    // Post plan summary and poll for approval
    moduleState.status = 'awaiting_approval';
    this._saveState();

    const summaryMsg = await this.slack.postThreadReply(
      threadTs,
      `📋 *Plan Summary: ${moduleName}*\n\n${summary}\n\n_Reply "approved" in this thread to start execution._`
    );

    // If no thread yet (brief summary, no questions), use the summary message
    if (!threadTs && summaryMsg?.ts) {
      threadTs = summaryMsg.ts;
      moduleState.slackThreadTs = threadTs;
      this._saveState();
    }

    const summaryTs = summaryMsg?.ts || null;

    console.log(`  Waiting for approval for ${moduleName}...`);
    let approvalReminderSent = false;
    const summaryPostedAt = Date.now();

    await this.slack.pollThreadReplies(threadTs, {
      afterTs: summaryTs,
      intervalMs: 30_000,
      onPoll: async () => {
        const elapsed = Date.now() - summaryPostedAt;
        const hours = elapsed / (1000 * 60 * 60);
        if (hours >= 24 && !approvalReminderSent) {
          await this.slack.postThreadReply(threadTs, `⏰ *Reminder:* Plan summary for *${moduleName}* is still waiting for approval. Reply "approved" to continue.`);
          approvalReminderSent = true;
        }
      },
      filter: (text) => SlackClient.isApproval(text),
    });

    moduleState.approvedAt = new Date().toISOString();
    moduleState.planSummary = summary;
    this._saveState();

    console.log(`  ✅ ${moduleName} plan approved.`);
  }

  // ─── Task Creation Phase ────────────────────────────────────────

  async _createModuleTasks(moduleName, moduleTag) {
    const moduleState = this.state.moduleStates[moduleName];

    // Skip if already past this phase (crash recovery)
    if (moduleState.status === 'executing' || moduleState.status === 'completed') {
      return moduleState.tasksCreated || 0;
    }

    const summary = moduleState.planSummary || '';
    const planInstruction = `${this.instruction}\n\n--- APPROVED ALIGNMENT (${moduleName}) ---\n${summary}`;

    console.log(`  Creating tasks for ${moduleName}...`);
    const result = await this.planner.plan(planInstruction, { forceTags: [moduleTag] });

    moduleState.tasksCreated = result.tasksCreated;
    moduleState.status = 'executing';
    this._saveState();

    await this.slack.postThreadReply(
      moduleState.slackThreadTs,
      `✅ *Approved.* Created ${result.tasksCreated} tasks for ${moduleName}. Starting execution.`
    );

    console.log(`  Created ${result.tasksCreated} tasks for ${moduleName}.`);
    return result.tasksCreated;
  }

  // ─── Scoped Autopilot Phase ─────────────────────────────────────

  async _runScopedAutopilot(moduleName, moduleTag) {
    console.log(`  🚀 Running scoped autopilot for ${moduleName} [tag: ${moduleTag}]...`);

    while (true) {
      // Get tasks tagged with this module only
      const readyTasks = await this.clickup.getReadyTasks();
      const scopedTasks = readyTasks.filter(t =>
        (t.tags || []).some(tg => (tg.name || tg).toLowerCase() === moduleTag.toLowerCase())
      );

      // Also check in-progress tasks for this module
      const inProgress = await this.clickup.getTasks(['in progress']);
      const scopedInProgress = inProgress.filter(t =>
        (t.tags || []).some(tg => (tg.name || tg).toLowerCase() === moduleTag.toLowerCase())
      );

      if (scopedTasks.length > 0) {
        // Dispatch tasks sequentially
        for (const task of scopedTasks) {
          console.log(`    📌 [${moduleName}] Processing: "${task.name}"`);
          await this.processTask(task);
        }
        continue;
      }

      if (scopedInProgress.length > 0) {
        // Wait for in-progress tasks to finish
        console.log(`    ⏳ [${moduleName}] ${scopedInProgress.length} task(s) still in progress...`);
        await new Promise(r => setTimeout(r, this.config.pollInterval));
        continue;
      }

      // Queue empty for this module — ask scoped autopilot if more work needed
      const hasMore = await this.autopilot.checkAndPlan({ scopeTag: moduleTag });
      if (!hasMore) {
        console.log(`    🎉 [${moduleName}] All scoped work complete.`);
        break;
      }

      // New tasks were planned — loop around to pick them up
    }
  }

  // ─── Final Summary ──────────────────────────────────────────────

  async _postFinalSummary(startedAt) {
    const elapsed = Date.now() - startedAt.getTime();
    const lines = ['🎉 *All modules complete!*', ''];
    let totalTasks = 0;

    for (const moduleName of this.modules) {
      const ms = this.state.moduleStates[moduleName];
      const tasks = ms.tasksCreated || 0;
      totalTasks += tasks;

      const icon = ms.status === 'completed' ? '✅' : '❌';
      const duration = ms.completedAt && ms.questionsPostedAt
        ? this._formatDuration(new Date(ms.completedAt) - new Date(ms.questionsPostedAt))
        : 'N/A';

      lines.push(`${icon} ${moduleName} — ${tasks} tasks, ${ms.status === 'completed' ? `completed in ${duration}` : `status: ${ms.status}`}`);
    }

    lines.push('');
    lines.push(`Total: ${totalTasks} tasks across ${this.modules.length} modules in ${this._formatDuration(elapsed)}`);

    const summaryText = lines.join('\n');
    console.log(`\n${summaryText}`);
    await this.slack.postStatus(summaryText);
  }

  // ─── State Persistence ──────────────────────────────────────────

  _initState() {
    // Try to load existing state for crash recovery
    const existing = this._loadState();
    if (existing && existing.instruction === this.instruction && existing.status === 'running') {
      console.log('♻️  Resuming previous chain state from disk.');
      return existing;
    }

    // Build fresh state
    const moduleStates = {};
    for (const moduleName of this.modules) {
      moduleStates[moduleName] = { status: 'pending' };
    }

    return {
      id: `chain-${Date.now()}`,
      instruction: this.instruction,
      modules: this.modules,
      current: 0,
      status: 'running',
      moduleStates,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  _saveState() {
    const dir = path.dirname(STATE_PATH);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    this.state.updatedAt = new Date().toISOString();
    writeFileSync(STATE_PATH, JSON.stringify(this.state, null, 2));
  }

  _loadState() {
    if (!existsSync(STATE_PATH)) return null;
    try {
      return JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
    } catch {
      return null;
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────

  _formatDuration(ms) {
    const totalMin = Math.round(ms / 60000);
    if (totalMin < 60) return `${totalMin}m`;
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h}h ${m}m`;
  }
}
