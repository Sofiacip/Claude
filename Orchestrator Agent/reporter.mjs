// reporter.mjs — Summary Reporter
// Generates plain-language reports when all tasks for a tag are complete.
// Uses ClickUp tags (not memory.json phases) as the source of truth.

import { spawn } from 'child_process';

export class Reporter {
  constructor(clickup, memory, projectPath, slack = null) {
    this.clickup = clickup;
    this.memory = memory;
    this.projectPath = projectPath;
    this.slack = slack;

    console.log(`📊 Reporter initialized: slack.enabled = ${!!slack?.enabled}`);
  }

  /**
   * Called after every successful task completion.
   * Checks ClickUp: are ALL tasks with this tag done?
   * If yes, generates and posts a summary report.
   */
  async onTaskComplete(completedTask, result) {
    console.log(`📊 Reporter.onTaskComplete called for task: "${completedTask.name}"`);

    // Step 1: Get the task's tags
    const tags = (completedTask.tags || []).map(t => (t.name || t).toLowerCase());
    if (tags.length === 0) {
      console.log('📊 Reporter: task has no tags, skipping.');
      return;
    }

    // Filter out meta tags that aren't module tags
    const skipTags = ['summary', 'milestone', 'bug', 'feature'];
    const moduleTags = tags.filter(t => !skipTags.includes(t));
    if (moduleTags.length === 0) {
      console.log('📊 Reporter: no module tags found, skipping.');
      return;
    }

    // Step 2: For each tag, check if ALL tasks with that tag are done
    for (const tag of moduleTags) {
      try {
        await this.checkTagCompletion(tag, completedTask, result);
      } catch (err) {
        console.error(`❌ Reporter error for tag "${tag}": ${err.message}`);
      }
    }
  }

  /**
   * Check if all tasks with a given tag are complete in ClickUp.
   * If so, generate and post a summary report.
   */
  async checkTagCompletion(tag, completedTask, result) {
    // Check if we already reported this tag
    if (!this.memory.data.reportedTags) this.memory.data.reportedTags = {};
    if (this.memory.data.reportedTags[tag]) {
      console.log(`📊 Reporter: tag "${tag}" already reported, skipping.`);
      return;
    }

    // Get ALL tasks from ClickUp (any status)
    const allTasks = await this.clickup.getAllTasks();

    // Filter to tasks that have this tag
    const taggedTasks = allTasks.filter(t => {
      const taskTags = (t.tags || []).map(tg => (tg.name || tg).toLowerCase());
      return taskTags.includes(tag);
    });

    if (taggedTasks.length === 0) {
      console.log(`📊 Reporter: no tasks found with tag "${tag}".`);
      return;
    }

    // Check statuses — "done" means "ready for review" or "completed" or "closed"
    const doneStatuses = ['ready for review', 'completed', 'closed', 'complete', 'done'];
    const blockedStatuses = ['blocked'];

    const doneTasks = taggedTasks.filter(t =>
      doneStatuses.includes(t.status?.status?.toLowerCase())
    );
    const blockedTasks = taggedTasks.filter(t =>
      blockedStatuses.includes(t.status?.status?.toLowerCase())
    );
    const openTasks = taggedTasks.filter(t =>
      !doneStatuses.includes(t.status?.status?.toLowerCase()) &&
      !blockedStatuses.includes(t.status?.status?.toLowerCase())
    );

    console.log(`📊 Reporter: tag "${tag}" — ${doneTasks.length} done, ${blockedTasks.length} blocked, ${openTasks.length} open (of ${taggedTasks.length} total)`);

    // Only report when NO open tasks remain (blocked tasks are OK — we report those)
    if (openTasks.length > 0) return;

    // All tasks are either done or blocked — generate report
    console.log(`\n📋 All tasks for "${tag}" are complete! Generating summary report...\n`);

    const planName = this.inferPlanName(tag);

    // Collect task details from memory for the report prompt
    const taskDetails = [];
    for (const t of doneTasks) {
      const history = this.memory.getTaskHistory(t.id);
      taskDetails.push({
        name: t.name,
        status: history?.status || 'completed',
        summary: history?.approach || history?.summary || 'Completed successfully',
        filesChanged: history?.filesChanged || [],
        attempts: history?.attempts || 1,
        errors: history?.errors || [],
      });
    }

    const blockedDetails = blockedTasks.map(t => {
      const history = this.memory.getTaskHistory(t.id);
      return {
        name: t.name,
        blockedReason: history?.blockedReason || history?.summary || 'Unknown reason',
      };
    });

    try {
      const report = await this.generateReport(
        { planName, tag, totalTasks: taggedTasks.length, doneTasks: doneTasks.length, blockedTasks: blockedTasks.length },
        taskDetails,
        blockedDetails
      );

      // Post to ClickUp
      const summaryTask = await this.clickup.createTask({
        name: `📋 Summary: ${planName}`,
        description: report,
        priority: 2,
        tags: ['summary'],
        status: 'ready for review',
      });

      console.log(`✅ Summary report posted to ClickUp: "${summaryTask.name}"`);

      // Post to Slack
      if (this.slack) {
        await this.slack.postReport({
          title: `Summary: ${planName}`,
          body: report,
          type: 'phase',
        });
        console.log('✅ Summary report posted to Slack.');
      }

      // Mark this tag as reported
      this.memory.data.reportedTags[tag] = {
        reportedAt: new Date().toISOString(),
        reportTaskId: summaryTask.id,
        totalTasks: taggedTasks.length,
        completed: doneTasks.length,
        blocked: blockedTasks.length,
      };
      this.memory.save();
    } catch (err) {
      console.error(`❌ Failed to generate summary for "${tag}": ${err.message}`);
    }
  }

  /**
   * Infer a human-readable plan name from a tag.
   */
  inferPlanName(tag) {
    const moduleNames = {
      'web designer': 'Web Designer Reliability',
      'funnel designer': 'Funnel Designer Reliability',
      'funnel': 'Funnel Designer Reliability',
      'copywriter': 'Copywriter',
      'brand creator': 'Brand Creator',
      'brand': 'Brand Creator',
      'doc factory': 'Doc Factory Reliability',
      'pageforge': 'PageForge',
      'copywriter-ui': 'Copywriter UI',
      'bug report': 'Bug Report Form',
    };

    return moduleNames[tag] || tag.split(' ').map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ');
  }

  /**
   * Generate a plain-language summary report using Claude Code.
   */
  async generateReport(info, taskDetails, blockedTasks) {
    const prompt = this.buildReportPrompt(info, taskDetails, blockedTasks);
    return await this.runClaudeCode(prompt);
  }

  buildReportPrompt(info, taskDetails, blockedTasks) {
    return `<report_request>
You are writing a summary report for a non-technical founder who runs a marketing agency. He needs to understand what changed in his software without reading code.

CONTEXT:
- The software is Impact OS, a platform that automates marketing funnel creation for course creators
- The module that was worked on: ${info.planName}
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

# Complete: ${info.planName}

## What Changed (Plain English)
Write 2-3 paragraphs explaining what was improved. Use language like "Before this update..." and "Now it will..." Focus on what the founder will NOTICE when using the app. No code, no technical jargon. Explain things the way you'd explain to a smart person who doesn't code.

## What Was Fixed
A short bullet list of the specific improvements. Each bullet should be one sentence, starting with a verb. Example:
- Added automatic retry when page generation fails, so pages that used to silently break now recover on their own
- Fixed the screenshot tool crashing on large pages — it now handles pages up to 10MB

## What's Still Blocked
${blockedTasks.length > 0 ? 'List each blocked task with a plain-English explanation of what needs to happen to unblock it. Be specific about what the founder needs to do or decide.' : 'Write "Nothing — all tasks completed successfully." if everything passed.'}

## Impact
One paragraph: what does this mean for the overall reliability of the module? Is it ready for client use, or is more work needed? What should the founder expect next?

## Stats
- Tasks completed: ${info.doneTasks}/${info.totalTasks}
- Tasks blocked: ${info.blockedTasks}

OUTPUT ONLY THE REPORT. No preamble, no "here's the report", just the markdown content starting with the # heading.
</report_request>`;
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
