// autopilot.mjs — Autonomous work planning: reads vision, decides next priority, triggers planning

import { readFileSync, existsSync } from 'fs';
import { spawn } from 'child_process';

export class AutoPilot {
  constructor({ planner, memory, clickup, visionDocPath, projectPath, slack = null }) {
    this.planner = planner;
    this.memory = memory;
    this.clickup = clickup;
    this.visionDocPath = visionDocPath;
    this.projectPath = projectPath;
    this.slack = slack;
  }

  /**
   * Check if the task queue is empty and if so, plan the next chunk of work.
   * Returns true if new work was planned, false if everything is done.
   */
  async checkAndPlan({ scopeTag } = {}) {
    // Step 1: Check if there are any tasks still in the queue
    let readyTasks = await this.clickup.getReadyTasks();
    let inProgressTasks = await this.clickup.getTasks(['in progress']);

    // Filter to scoped module if running inside a chain
    if (scopeTag) {
      const matchTag = (t) =>
        (t.tags || []).some(tg => (tg.name || tg).toLowerCase() === scopeTag.toLowerCase());
      readyTasks = readyTasks.filter(matchTag);
      inProgressTasks = inProgressTasks.filter(matchTag);
    }

    if (readyTasks.length > 0 || inProgressTasks.length > 0) {
      // Still work to do — don't plan yet
      return true;
    }

    console.log(`\n🧭 Task queue is empty${scopeTag ? ` for [${scopeTag}]` : ''}. Auto-pilot deciding next priority...\n`);

    // Step 2: Build context from memory and vision
    const decision = await this.decideNext(scopeTag);

    if (!decision) {
      console.error('❌ Auto-pilot could not determine next action. Will retry next cycle.');
      return true; // Return true to keep the loop running — don't stop on transient errors
    }

    // Step 3: Check if everything is done
    if (decision.done) {
      console.log('\n🎉 AUTO-PILOT: All planned work is complete!');
      console.log(decision.summary);

      // Post completion notice to ClickUp
      await this.clickup.createTask({
        name: '🎉 AUTO-PILOT: All Vision Work Complete',
        description: decision.summary,
        priority: 1,
        tags: ['summary', 'milestone'],
        status: 'ready for review',
      });

      // Notify Slack
      if (this.slack) {
        await this.slack.postReport({
          title: 'AUTO-PILOT: All Vision Work Complete',
          body: decision.summary,
          type: 'milestone',
        });
      }

      return false; // Signal to stop the agent
    }

    // Step 4: Plan the next chunk
    console.log(`\n🚀 Next priority: "${decision.next}"`);
    console.log(`   Reason: ${decision.reason}`);
    console.log(`   Module: ${decision.module}\n`);

    // Record this decision in memory
    this.memory.recordAutopilotDecision(decision);

    // Step 5: Run the planner with this chunk (with forced tags if scoped)
    const planOpts = scopeTag ? { forceTags: [scopeTag] } : {};
    const result = await this.planner.plan(decision.next, planOpts);

    if (result.tasksCreated === 0) {
      console.error('❌ Planner generated 0 tasks. Retrying with more specific prompt...');
      // Try once more with the reason included
      const retryResult = await this.planner.plan(`${decision.next}. Context: ${decision.reason}`, planOpts);
      if (retryResult.tasksCreated === 0) {
        console.error('❌ Planner retry also produced 0 tasks. Will retry next cycle.');
      }
      return true; // Keep running — don't stop on planner failures
    }

    console.log(`\n✅ Auto-pilot planned ${result.tasksCreated} tasks for: "${decision.next}"\n`);

    // Notify Slack
    if (this.slack) {
      await this.slack.postStatus(
        `🧭 *Auto-pilot decision:* ${decision.next}\n_Reason: ${decision.reason}_\n_Module: ${decision.module}_\n\n${result.tasksCreated} tasks created in ClickUp.`
      );
    }

    return true;
  }

  /**
   * Ask Claude Code what the next priority should be.
   */
  async decideNext(scopeTag = null) {
    const prompt = this.buildDecisionPrompt(scopeTag);

    try {
      const output = await this.runClaudeCode(prompt);
      return this.parseDecision(output);
    } catch (err) {
      console.error(`❌ Auto-pilot decision failed: ${err.message}`);
      return null;
    }
  }

  buildDecisionPrompt(scopeTag = null) {
    // Load vision document
    let visionContent = '';
    if (this.visionDocPath && existsSync(this.visionDocPath)) {
      visionContent = readFileSync(this.visionDocPath, 'utf-8');
    }

    // Build work history summary from memory
    const completedPlans = this.memory.getCompletedPlans();
    const moduleHealth = this.memory.getAllModuleHealth();
    const taskStats = this.memory.getTaskStats();

    let workHistory = 'No work completed yet.';
    if (completedPlans.length > 0 || Object.keys(moduleHealth).length > 0) {
      const lines = [];

      if (completedPlans.length > 0) {
        lines.push('Completed plans:');
        for (const plan of completedPlans) {
          lines.push(`  - "${plan.name}" (${plan.tasksCompleted} tasks completed)`);
        }
      }

      if (Object.keys(moduleHealth).length > 0) {
        lines.push('\nModule health:');
        for (const [name, health] of Object.entries(moduleHealth)) {
          lines.push(`  - ${name}: ${health.healthStatus} (last build: ${health.lastBuildPassed ? 'passed' : 'failed'}, last test: ${health.lastTestPassed ? 'passed' : 'failed'})`);
        }
      }

      if (taskStats) {
        lines.push(`\nOverall stats: ${taskStats.total} tasks processed, ${taskStats.completed} completed, ${taskStats.failed} failed, ${taskStats.blocked} blocked`);
      }

      workHistory = lines.join('\n');
    }

    // Get previous autopilot decisions to avoid loops
    const previousDecisions = this.memory.getAutopilotHistory();
    let decisionHistory = '';
    if (previousDecisions.length > 0) {
      decisionHistory = `\nPrevious auto-pilot decisions (do NOT repeat these):\n${previousDecisions.map(d => `  - "${d.next}" (${d.timestamp})`).join('\n')}`;
    }

    const scopeBlock = scopeTag
      ? `\nSCOPE: You are planning for the "${scopeTag}" module ONLY.\nOnly consider work relevant to this module. When all work for this module is done, respond with DONE.\n`
      : '';

    return `<autopilot_decision>
You are the technical director for Impact OS, a marketing automation platform for course creators. The platform lives at app.scaleforimpact.co.
${scopeBlock}

PROJECT VISION:
${visionContent || 'No vision document found. Focus on fixing broken modules first.'}

WORK COMPLETED SO FAR:
${workHistory}
${decisionHistory}

CURRENT PRIORITIES (from the founder, in order):
1. Fix Web Designer reliability — pages should generate without crashes, with proper error handling and retry logic
2. Fix Funnel Designer reliability — multi-page funnel generation should be stable and self-healing
3. Fix Doc Factory reliability — document generation output failures need resolution
4. Build Bug Report Form — a way for the team to report issues within the app
5. Build Unified Outputs System — centralized place to view/download all generated assets
6. Build Agent Mode — automated end-to-end funnel building (copy → design → deploy)

TECH STACK:
- Frontend: Next.js + Tailwind CSS + shadcn/ui, deployed on Vercel
- Backend: Supabase (PostgreSQL + Auth + Storage)
- Processing: Hetzner VPS running Claude Code CLI
- Modules live at /Users/Administrator/Claude/[module-name]/

YOUR JOB:
Decide what the SINGLE next work chunk should be. A work chunk is a focused improvement that can be decomposed into 10-25 development tasks.

Rules:
- Follow the founder's priority order unless a module's health status requires urgent attention
- Always fix broken/degraded modules before building new features
- Don't repeat work that's already been completed — check the completed plans list and previous decisions
- Each chunk should focus on ONE module or ONE feature
- Be specific about what needs to happen
- If a module was already worked on but is still degraded, focus the next chunk on the remaining issues

If ALL 6 priorities are complete, respond with:
DONE: [summary of everything accomplished]

Otherwise respond with EXACTLY this format (no other text):
NEXT: [specific work chunk description — be detailed, 1-2 sentences]
REASON: [one sentence explaining why this is the highest priority right now]
MODULE: [primary module name this affects, matching folder names: Web Designer, funnel-designer, doc factory, copywriter-ui, brand creator, pageforge]
</autopilot_decision>`;
  }

  parseDecision(output) {
    const text = output.trim();

    // Check for DONE
    if (text.startsWith('DONE:')) {
      return {
        done: true,
        summary: text.replace('DONE:', '').trim(),
      };
    }

    // Parse NEXT/REASON/MODULE
    const nextMatch = text.match(/NEXT:\s*(.+?)(?:\n|$)/);
    const reasonMatch = text.match(/REASON:\s*(.+?)(?:\n|$)/);
    const moduleMatch = text.match(/MODULE:\s*(.+?)(?:\n|$)/);

    if (!nextMatch) {
      console.error('Could not parse auto-pilot decision. Raw output:', text.slice(0, 500));
      return null;
    }

    return {
      done: false,
      next: nextMatch[1].trim(),
      reason: reasonMatch ? reasonMatch[1].trim() : 'Auto-determined priority',
      module: moduleMatch ? moduleMatch[1].trim() : 'unknown',
      timestamp: new Date().toISOString(),
    };
  }

  runClaudeCode(prompt) {
    return new Promise((resolve, reject) => {
      // Remove CLAUDECODE env var so the child process doesn't think it's nested
      const childEnv = { ...process.env };
      delete childEnv.CLAUDECODE;

      const proc = spawn('claude', [
        '--print',
        '--dangerously-skip-permissions',
        '--output-format', 'text',
        '--max-turns', '10',
      ], {
        cwd: this.projectPath,
        env: childEnv,
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
        reject(new Error('Auto-pilot decision timed out after 5 minutes'));
      }, 5 * 60 * 1000);

      proc.on('close', code => {
        clearTimeout(timeout);
        if (code === 0) resolve(stdout.trim());
        else reject(new Error(`Claude Code exited with code ${code}: ${stderr.slice(-300)}`));
      });

      proc.on('error', err => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }
}
