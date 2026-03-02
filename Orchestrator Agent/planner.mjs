// planner.mjs — Planning agent: decomposes a vision into ClickUp tasks

import { readFileSync, existsSync } from 'fs';
import { spawn } from 'child_process';

export class Planner {
  constructor(clickup, visionDocPath, projectPath, memory = null) {
    this.clickup = clickup;
    this.visionDocPath = visionDocPath;
    this.projectPath = projectPath;
    this.memory = memory;
  }

  /**
   * Decompose a vision description into ClickUp tasks.
   * @param {string} vision — Natural language description of what to build
   * @returns {object} — { tasksCreated: number, taskIds: string[] }
   */
  async plan(vision, { forceTags, planId } = {}) {
    // Generate a plan ID if none was provided — every task gets tagged with it
    const activePlanId = planId || `plan-${Date.now()}`;

    console.log(`\n🧠 Planning: "${vision}"`);
    console.log(`   Plan ID: ${activePlanId}\n`);

    // Step 1: Build the planning prompt
    const prompt = this.buildPlanningPrompt(vision, forceTags);

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

    // Stamp every task with the plan ID tag + any forced tags
    for (const task of tasks) {
      const extra = [activePlanId, ...(forceTags || [])];
      task.tags = [...new Set([...(task.tags || []), ...extra])];
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

    // Register phases in memory for the reporter
    if (this.memory && createdIds.length > 0) {
      const phases = {};
      for (let i = 0; i < tasks.length; i++) {
        if (!createdIds[i]) continue; // skip tasks that failed to create
        const phase = tasks[i].phase || 1;
        if (!phases[phase]) phases[phase] = [];
        phases[phase].push(createdIds[i]);
      }

      this.memory.initPlan(activePlanId, vision, phases);
      console.log(`📊 Registered ${Object.keys(phases).length} phases in memory for reporter tracking.`);
    }

    return { tasksCreated: createdIds.length, taskIds: createdIds, planId: activePlanId };
  }

  buildPlanningPrompt(vision, forceTags = null) {
    let prompt = '';

    // Load vision document
    if (this.visionDocPath && existsSync(this.visionDocPath)) {
      const visionDoc = readFileSync(this.visionDocPath, 'utf-8');
      prompt += `<project_context>\n${visionDoc}\n</project_context>\n\n`;
    }

    // Scan current directory structure for additional context
    prompt += `<project_path>${this.projectPath}</project_path>\n\n`;

    const forceTagNote = forceTags
      ? `\nIMPORTANT: Tag ALL tasks with these tags: ${forceTags.join(', ')}\nThese tasks are part of a module chain and MUST be tagged correctly for routing.\n`
      : '';

    prompt += `<planning_request>
You are a senior technical project manager decomposing a feature vision into implementable development tasks.
${forceTagNote}
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
    "description": "**What:** Create the Supabase database schema...\\n\\n**Where:** Supabase dashboard or migration file...\\n\\n**Acceptance Criteria:**\\n- [ ] Table 'outputs' exists with columns...\\n- [ ] RLS policies configured...",
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
      // Remove CLAUDECODE env var so the child process doesn't think it's nested
      const childEnv = { ...process.env };
      delete childEnv.CLAUDECODE;

      const proc = spawn('claude', [
        '--print', '--dangerously-skip-permissions',
        '--output-format', 'text',
        '--max-turns', '30',
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
        reject(new Error('Planning timed out after 10 minutes'));
      }, 10 * 60 * 1000);

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
