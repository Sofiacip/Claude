// reporter.mjs — Phase Summary Reporter
// Generates plain-language reports when all tasks in a phase complete

import { spawn } from 'child_process';

export class Reporter {
  constructor(clickup, memory, projectPath, slack = null) {
    this.clickup = clickup;
    this.memory = memory;
    this.projectPath = projectPath;
    this.slack = slack;
  }

  /**
   * Called after every task completion. Checks if a phase is now fully done.
   * If yes, generates and posts a summary report.
   */
  async onTaskComplete(completedTask, result) {
    // Step 1: Detect which phase this task belongs to
    const phaseInfo = this.detectPhase(completedTask);
    if (!phaseInfo) return;

    // Step 2: Register this task completion in phase tracking
    this.memory.registerPhaseTask(phaseInfo.planId, phaseInfo.phase, completedTask.id);
    this.memory.markPhaseTaskComplete(phaseInfo.planId, phaseInfo.phase, completedTask.id);

    // Step 3: Check if all tasks in this phase are done
    const phaseData = this.memory.getPhaseData(phaseInfo.planId, phaseInfo.phase);
    if (!phaseData) return;

    const allDone = phaseData.taskIds.length > 0 &&
                    phaseData.taskIds.every(id => phaseData.completed.includes(id));

    if (!allDone || phaseData.reported) return;

    // Step 4: All tasks in this phase are complete — generate report
    console.log(`\n📋 Phase ${phaseInfo.phase} complete! Generating summary report...\n`);

    try {
      const report = await this.generateReport(phaseInfo, phaseData);

      // Step 5: Create summary task in ClickUp
      const summaryTask = await this.clickup.createTask({
        name: `📋 Phase ${phaseInfo.phase} Summary: ${phaseInfo.planName}`,
        description: report,
        priority: 2, // high
        tags: ['summary'],
        status: 'ready for review',
      });

      // Step 6: Mark phase as reported
      this.memory.markPhaseReported(phaseInfo.planId, phaseInfo.phase, summaryTask.id);

      console.log(`✅ Summary report posted to ClickUp: "${summaryTask.name}"`);

      // Post to Slack
      if (this.slack) {
        await this.slack.postReport({
          title: `Phase ${phaseInfo.phase} Summary: ${phaseInfo.planName}`,
          body: report,
          type: 'phase',
        });
      }

      // Step 7: Check if ALL phases are done → generate final report
      await this.checkAllPhasesComplete(phaseInfo.planId);
    } catch (err) {
      console.error(`❌ Failed to generate phase summary: ${err.message}`);
    }
  }

  /**
   * Extract phase number and plan context from a task.
   * Looks up the task ID in memory's phase registry (set by the planner).
   */
  detectPhase(task) {
    // Look up from memory's phase data (set by planner when tasks are created)
    const allPlans = this.memory.data.phases || {};
    for (const [planId, plan] of Object.entries(allPlans)) {
      for (const [phaseNum, phaseData] of Object.entries(plan.tasks || {})) {
        if (phaseData.taskIds.includes(task.id)) {
          const planName = this.inferPlanName(
            planId,
            (task.tags || []).map(t => (t.name || t).toLowerCase()),
            task.name
          );
          return { phase: parseInt(phaseNum), planId, planName };
        }
      }
    }

    return null;
  }

  /**
   * Infer a human-readable plan name from task context.
   */
  inferPlanName(planId, tags, taskName) {
    // Check if memory already has a name for this plan
    const storedName = this.memory.getPlanName(planId);
    if (storedName && storedName !== planId) return storedName;

    const moduleNames = {
      'web designer': 'Web Designer Reliability',
      'funnel': 'Funnel Designer',
      'funnel designer': 'Funnel Designer',
      'copywriter': 'Copywriter',
      'brand': 'Brand Creator',
      'brand creator': 'Brand Creator',
      'doc factory': 'Doc Factory',
      'pageforge': 'PageForge',
      'copywriter-ui': 'Copywriter UI',
    };

    for (const tag of tags) {
      if (moduleNames[tag]) return moduleNames[tag];
    }

    return taskName?.split(' — ')[0] || 'Impact OS';
  }

  /**
   * Generate a plain-language summary report using Claude Code.
   */
  async generateReport(phaseInfo, phaseData) {
    // Collect all task details from memory
    const taskDetails = [];
    for (const taskId of phaseData.completed) {
      const history = this.memory.getTaskHistory(taskId);
      if (history) {
        taskDetails.push({
          name: history.name,
          status: history.status,
          summary: history.approach || history.summary || 'No summary available',
          filesChanged: history.filesChanged || [],
          attempts: history.attempts || 1,
          errors: history.errors || [],
        });
      }
    }

    // Collect blocked/failed tasks in this phase
    const blockedTasks = [];
    for (const taskId of phaseData.taskIds) {
      if (!phaseData.completed.includes(taskId)) {
        const history = this.memory.getTaskHistory(taskId);
        if (history && (history.status === 'blocked' || history.status === 'failed')) {
          blockedTasks.push({
            name: history.name,
            blockedReason: history.blockedReason || history.summary || 'Unknown reason',
          });
        }
      }
    }

    const prompt = this.buildReportPrompt(phaseInfo, taskDetails, blockedTasks);
    return await this.runClaudeCode(prompt);
  }

  buildReportPrompt(phaseInfo, taskDetails, blockedTasks) {
    return `<report_request>
You are writing a summary report for a non-technical founder who runs a marketing agency. He needs to understand what changed in his software without reading code.

CONTEXT:
- The software is Impact OS, a platform that automates marketing funnel creation for course creators
- The module that was worked on: ${phaseInfo.planName}
- This is Phase ${phaseInfo.phase} of the improvement plan
- ${taskDetails.length} tasks were completed${blockedTasks.length > 0 ? `, ${blockedTasks.length} tasks are blocked and need attention` : ''}

COMPLETED TASKS:
${taskDetails.map((t, i) => `
${i + 1}. "${t.name}"
   What was done: ${t.summary}
   Files changed: ${t.filesChanged.join(', ') || 'none reported'}
   Attempts needed: ${t.attempts}${t.errors.length > 0 ? `\n   Had issues: ${t.errors.map(e => typeof e === 'string' ? e : e.error).join('; ').slice(0, 200)}` : ''}
`).join('\n')}

${blockedTasks.length > 0 ? `
BLOCKED TASKS (need human attention):
${blockedTasks.map((t, i) => `
${i + 1}. "${t.name}"
   Why it's stuck: ${t.blockedReason}
`).join('\n')}
` : ''}

WRITE THE REPORT IN THIS EXACT FORMAT:

# Phase ${phaseInfo.phase} Complete: ${phaseInfo.planName}

## What Changed (Plain English)
Write 2-3 paragraphs explaining what was improved. Use language like "Before this update..." and "Now it will..." Focus on what the founder will NOTICE when using the app. No code, no technical jargon. Explain things the way you'd explain to a smart person who doesn't code.

## What Was Fixed
A short bullet list of the specific improvements. Each bullet should be one sentence, starting with a verb. Example:
- Added automatic retry when page generation fails, so pages that used to silently break now recover on their own
- Fixed the screenshot tool crashing on large pages — it now handles pages up to 10MB

## What's Still Blocked
${blockedTasks.length > 0 ? 'List each blocked task with a plain-English explanation of what needs to happen to unblock it. Be specific about what the founder needs to do or decide.' : 'Write "Nothing — all tasks in this phase completed successfully." if everything passed.'}

## Impact
One paragraph: what does this phase mean for the overall reliability of the module? Is it ready for client use, or are there more phases needed? What should the founder expect next?

## Stats
- Tasks completed: X/Y
- Total attempts: X (if multiple retries were needed, explain briefly why)
- Files modified: X files across Y components

OUTPUT ONLY THE REPORT. No preamble, no "here's the report", just the markdown content starting with the # heading.
</report_request>`;
  }

  /**
   * When ALL phases of a plan are complete, generate a final comprehensive report.
   */
  async checkAllPhasesComplete(planId) {
    const allPhases = this.memory.getAllPhases(planId);
    if (!allPhases) return;

    const allDone = Object.values(allPhases).every(p => p.reported);
    if (!allDone) return;

    const planName = this.memory.getPlanName(planId);
    console.log(`\n🎉 All phases complete for "${planName}"! Generating final report...\n`);

    // Collect all phase summaries
    const phaseSummaries = [];
    for (const [phaseNum, phaseData] of Object.entries(allPhases)) {
      phaseSummaries.push({
        phase: phaseNum,
        taskCount: phaseData.taskIds.length,
        completedCount: phaseData.completed.length,
        reportTaskId: phaseData.reportTaskId,
      });
    }

    const prompt = `<final_report>
You are writing a final summary for a non-technical founder. ALL phases of the "${planName}" improvement plan are now complete.

Phase summary:
${phaseSummaries.map(p => `- Phase ${p.phase}: ${p.completedCount}/${p.taskCount} tasks completed`).join('\n')}

Write a short (3-4 paragraph) executive summary:
1. What was the overall goal of this plan?
2. What's different now compared to before?
3. What should the founder test or try to see the improvements?
4. What's recommended as the next priority?

Keep it conversational and non-technical. Start with "# Complete: ${planName}" as the heading.

OUTPUT ONLY THE REPORT. No preamble, just the markdown.
</final_report>`;

    try {
      const finalReport = await this.runClaudeCode(prompt);

      await this.clickup.createTask({
        name: `🎉 COMPLETE: ${planName} — All Phases Done`,
        description: finalReport,
        priority: 1, // urgent
        tags: ['summary', 'milestone'],
        status: 'ready for review',
      });

      console.log('✅ Final completion report posted to ClickUp.');

      // Post to Slack
      if (this.slack) {
        await this.slack.postReport({
          title: `COMPLETE: ${planName} — All Phases Done`,
          body: finalReport,
          type: 'milestone',
        });
      }
    } catch (err) {
      console.error(`❌ Failed to generate final report: ${err.message}`);
    }
  }

  /**
   * Run Claude Code CLI to generate a report.
   */
  runClaudeCode(prompt) {
    return new Promise((resolve, reject) => {
      const childEnv = { ...process.env };
      delete childEnv.CLAUDECODE;

      const proc = spawn('claude', [
        '--print',
        '--dangerously-skip-permissions',
        '--output-format', 'text',
        '--max-turns', '5',
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
        reject(new Error('Report generation timed out after 3 minutes'));
      }, 3 * 60 * 1000);

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
