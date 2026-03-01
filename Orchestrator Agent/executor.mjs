// executor.mjs — Executes tasks via Claude Code in headless/print mode
// Constructs prompts with vision context + task details, invokes Claude Code, captures output

import { execSync, spawn } from 'child_process';
import { readFileSync, existsSync, readdirSync } from 'fs';
import path from 'path';

// Maps task tags or keywords to subfolder names inside /Users/Administrator/Claude/
const MODULE_MAP = {
  'web designer':    'Web Designer',
  'webdesigner':     'Web Designer',
  'funnel designer': 'funnel-designer',
  'funnel':          'funnel-designer',
  'copywriter':      'Copywriter',
  'copy':            'Copywriter',
  'copywriter-ui':   'copywriter-ui',
  'brand creator':   'brand creator',
  'brand':           'brand creator',
  'doc factory':     'doc factory',
  'docs':            'doc factory',
  'pageforge':       'pageforge',
};

export class ClaudeExecutor {
  constructor({ projectPath, visionDocPath, maxRetries = 2, memory = null }) {
    this.projectPath = projectPath;  // Parent folder: /Users/Administrator/Claude
    this.visionDocPath = visionDocPath;
    this.maxRetries = maxRetries;
    this.memory = memory;

    // Verify Claude Code is installed
    try {
      execSync('claude --version', { stdio: 'pipe' });
    } catch {
      throw new Error(
        'Claude Code CLI not found. Install it with: npm install -g @anthropic-ai/claude-code'
      );
    }
  }

  /**
   * Detect which module a task belongs to based on tags, name, or description.
   * Returns the full path to that module's folder.
   */
  detectModulePath(task) {
    // First check task tags
    if (task.tags?.length) {
      for (const tag of task.tags) {
        const key = tag.name.toLowerCase();
        if (MODULE_MAP[key]) {
          return path.join(this.projectPath, MODULE_MAP[key]);
        }
      }
    }

    // Then check task name and description for module keywords
    const searchText = `${task.name} ${task.description || ''}`.toLowerCase();
    for (const [keyword, folder] of Object.entries(MODULE_MAP)) {
      if (searchText.includes(keyword)) {
        return path.join(this.projectPath, folder);
      }
    }

    // Default to parent folder if no module detected
    return this.projectPath;
  }

  // ─── Build the prompt ──────────────────────────────────────────

  buildPrompt(taskMarkdown, { attempt = 1, previousError = null, memoryContext = '', healingPrompt = '' } = {}) {
    let prompt = '';

    // Load vision document for persistent context
    if (this.visionDocPath && existsSync(this.visionDocPath)) {
      const vision = readFileSync(this.visionDocPath, 'utf-8');
      prompt += `<vision_context>\n${vision}\n</vision_context>\n\n`;
    }

    // Add memory context if available
    if (memoryContext) {
      prompt += `${memoryContext}\n\n`;
    }

    // Add the task
    prompt += `<task>\n${taskMarkdown}\n</task>\n\n`;

    // Add healing prompt if this is a retry with specific guidance
    if (attempt > 1 && healingPrompt) {
      prompt += `<previous_attempt>\nThis is attempt ${attempt}.\n\n${healingPrompt}\n</previous_attempt>\n\n`;
    } else if (attempt > 1 && previousError) {
      prompt += `<previous_attempt>\nThis is attempt ${attempt}. The previous attempt failed with:\n${previousError}\n\nPlease fix the issues and try again.\n</previous_attempt>\n\n`;
    }

    // Add execution instructions
    prompt += `<instructions>
You are working on the Impact OS project. Complete the task described above.

Rules:
1. Read relevant files before making changes to understand existing code.
2. Make minimal, focused changes — do not refactor unrelated code.
3. After making changes, run any existing tests to verify nothing is broken.
4. If the task requires new functionality, add appropriate tests.
5. Write a brief summary of what you changed and why.
6. If you encounter an issue you cannot resolve, clearly describe the blocker.

When done, output a summary in this format:
<result>
STATUS: success | partial | blocked
FILES_CHANGED: file1.js, file2.js
SUMMARY: Brief description of what was done
BLOCKERS: (if any) Description of what's blocking completion
TESTS: passed | failed | none
</result>
</instructions>`;

    return prompt;
  }

  // ─── Execute via Claude Code ───────────────────────────────────

  /**
   * Execute a task. Accepts the raw task object so it can detect the right module.
   */
  async execute(task, taskMarkdown, { attempt = 1, previousErrors = [], memoryContext = '', healingPrompt = '' } = {}) {
    // Figure out which module folder to work in
    const modulePath = this.detectModulePath(task);
    const moduleName = path.basename(modulePath);
    console.log(`\n📂 Working in module: ${moduleName} (${modulePath})`);

    if (!existsSync(modulePath)) {
      return {
        success: false,
        status: 'blocked',
        summary: `Module folder not found: ${modulePath}`,
        modulePath,
        rawOutput: '',
        attempts: 0,
      };
    }

    const prompt = this.buildPrompt(taskMarkdown, {
      attempt,
      previousError: previousErrors[previousErrors.length - 1] || null,
      memoryContext,
      healingPrompt,
    });

    console.log(`\n🤖 Executing task (attempt ${attempt})...`);

    try {
      const result = await this.runClaudeCode(prompt, modulePath);
      const parsed = this.parseResult(result);

      return {
        success: parsed.status === 'success' || parsed.status === 'partial',
        ...parsed,
        module: moduleName,
        modulePath,
        rawOutput: result,
        attempts: attempt,
      };
    } catch (err) {
      console.log(`  ❌ Attempt ${attempt} failed: ${err.message.slice(0, 200)}`);
      return {
        success: false,
        status: 'blocked',
        summary: err.message,
        module: moduleName,
        modulePath,
        rawOutput: err.message,
        attempts: attempt,
      };
    }
  }

  // ─── Run Claude Code CLI ───────────────────────────────────────

  runClaudeCode(prompt, workingDir) {
    return new Promise((resolve, reject) => {
      const args = [
        '--print', '--dangerously-skip-permissions',           // Headless mode — no interactive UI
        '--output-format', 'text',
        '--max-turns', '50', // Allow enough turns for complex tasks
      ];

      // Remove CLAUDECODE env var so the child process doesn't think it's nested
      const childEnv = { ...process.env };
      delete childEnv.CLAUDECODE;

      const proc = spawn('claude', args, {
        cwd: workingDir,
        env: childEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Send prompt via stdin
      proc.stdin.write(prompt);
      proc.stdin.end();

      // Timeout after 10 minutes
      const timeout = setTimeout(() => {
        proc.kill('SIGTERM');
        reject(new Error('Claude Code execution timed out after 10 minutes'));
      }, 10 * 60 * 1000);

      proc.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Claude Code exited with code ${code}.\nStderr: ${stderr.slice(-500)}`));
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to spawn Claude Code: ${err.message}`));
      });
    });
  }

  // ─── Parse the structured result ───────────────────────────────

  parseResult(output) {
    const resultMatch = output.match(/<result>([\s\S]*?)<\/result>/);
    
    if (!resultMatch) {
      return {
        status: 'unknown',
        summary: output.slice(-500),
        filesChanged: [],
        blockers: null,
        tests: 'unknown',
      };
    }

    const block = resultMatch[1];
    
    const getField = (name) => {
      const match = block.match(new RegExp(`${name}:\\s*(.+)`, 'i'));
      return match ? match[1].trim() : null;
    };

    return {
      status: (getField('STATUS') || 'unknown').toLowerCase(),
      summary: getField('SUMMARY') || 'No summary provided',
      filesChanged: (getField('FILES_CHANGED') || '')
        .split(',')
        .map(f => f.trim())
        .filter(Boolean),
      blockers: getField('BLOCKERS'),
      tests: (getField('TESTS') || 'unknown').toLowerCase(),
    };
  }
}
