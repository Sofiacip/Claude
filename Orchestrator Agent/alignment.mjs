// alignment.mjs — Intake Alignment: question generation, plan summary, and approval gate
//
// Flow:
//   1. assess(instruction)       → decides if full alignment is needed
//   2. generateQuestions(instr)   → 5-15 targeted questions via Claude Code
//   3. generatePlanSummary(...)   → formatted plan summary from Q&A
//   4. State persists to data/alignment-state.json across CLI invocations

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { spawn } from 'child_process';
import path from 'path';

const STATE_PATH = path.join(process.cwd(), 'data', 'alignment-state.json');

// Seven question categories from the intake alignment spec
const CATEGORIES = [
  'Intent Clarification',
  'Scope and Boundaries',
  'Priority and Sequencing',
  'Definition of Done',
  'Known Issues',
  'Constraints',
  'Autonomy Boundaries',
];

export class IntakeAlignment {
  constructor({ projectPath, visionDocPath, memory, slack = null }) {
    this.projectPath = projectPath;
    this.visionDocPath = visionDocPath;
    this.memory = memory;
    this.slack = slack;
  }

  // ─── Public API ─────────────────────────────────────────────────

  /**
   * Assess whether an instruction needs full alignment or can skip to a brief summary.
   * Returns { needsFull: boolean, reason: string }
   */
  async assess(instruction) {
    const prompt = this._buildAssessPrompt(instruction);
    const output = await this._runClaudeCode(prompt, 3);
    return this._parseAssessment(output);
  }

  /**
   * Generate 5-15 targeted questions for a high-level instruction.
   * Returns string[] of questions.
   */
  async generateQuestions(instruction, { moduleName } = {}) {
    const prompt = this._buildQuestionPrompt(instruction, moduleName);
    const output = await this._runClaudeCode(prompt, 5);
    return this._parseQuestions(output);
  }

  /**
   * Generate a brief plan summary for a narrow instruction (skipping full Q&A).
   * Returns the formatted plan summary string.
   */
  async generateBriefSummary(instruction, { moduleName } = {}) {
    const prompt = this._buildBriefSummaryPrompt(instruction, moduleName);
    return await this._runClaudeCode(prompt, 5);
  }

  /**
   * Generate the full plan summary from instruction + questions + answers.
   * Returns the formatted plan summary string.
   */
  async generatePlanSummary(instruction, questions, answers, { moduleName } = {}) {
    const prompt = this._buildSummaryPrompt(instruction, questions, answers, moduleName);
    return await this._runClaudeCode(prompt, 5);
  }

  // ─── State Management ───────────────────────────────────────────

  saveState(state) {
    const dir = path.dirname(STATE_PATH);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    state.updatedAt = new Date().toISOString();
    writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
  }

  loadState() {
    if (!existsSync(STATE_PATH)) return null;
    try {
      return JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
    } catch {
      return null;
    }
  }

  clearState() {
    if (existsSync(STATE_PATH)) {
      writeFileSync(STATE_PATH, JSON.stringify({ cleared: true, at: new Date().toISOString() }));
    }
  }

  // ─── Prompt Builders ────────────────────────────────────────────

  _buildAssessPrompt(instruction) {
    return `<alignment_assessment>
You are deciding whether a development instruction is specific enough to skip detailed alignment questions, or vague enough to need them.

INSTRUCTION:
"${instruction}"

A narrow instruction has ONLY ONE reasonable interpretation — e.g., "fix the broken image on the landing page hero section" or "change the CTA button color from blue to red on the sales page."

A vague instruction has MULTIPLE possible interpretations — e.g., "improve output quality" or "make the funnel designer more reliable."

Respond with EXACTLY one of these two formats (no other text):

NARROW: [one sentence explaining why this is unambiguous]
or
NEEDS_ALIGNMENT: [one sentence explaining what's ambiguous]
</alignment_assessment>`;
  }

  _buildQuestionPrompt(instruction, moduleName = null) {
    // Gather project context
    let visionContext = '';
    if (this.visionDocPath && existsSync(this.visionDocPath)) {
      visionContext = readFileSync(this.visionDocPath, 'utf-8').slice(0, 3000);
    }

    let moduleHealth = '';
    if (this.memory) {
      const health = this.memory.getAllModuleHealth();
      if (Object.keys(health).length > 0) {
        moduleHealth = Object.entries(health)
          .map(([name, h]) => `  - ${name}: ${h.healthStatus}`)
          .join('\n');
      }
    }

    const moduleScope = moduleName
      ? `\nFOCUS MODULE: ${moduleName}\nGenerate questions ONLY about this module's implementation of the instruction.\n`
      : '';

    return `<alignment_questions>
You are a senior technical PM generating alignment questions for an autonomous development agent. The agent will execute tasks without further human check-ins, so these questions MUST surface every ambiguity now.
${moduleScope}
INSTRUCTION FROM HUMAN:
"${instruction}"

PROJECT CONTEXT:
${visionContext || 'No vision document available.'}

CURRENT MODULE HEALTH:
${moduleHealth || 'No module health data yet.'}

MODULES:
- Web Designer — Next.js web page builder
- funnel-designer — Multi-page funnel builder
- Copywriter — 17-skill copy generation pipeline
- copywriter-ui — Frontend for the Copywriter module
- brand creator — Client brand analysis
- doc factory — Document generation
- pageforge — Page template system

Generate 5-15 targeted questions. Draw from these seven categories but SKIP categories that aren't relevant:
1. Intent Clarification — What does the human actually want to achieve?
2. Scope and Boundaries — What should be touched, what should be left alone?
3. Priority and Sequencing — What matters most? What first?
4. Definition of Done — How will success be judged?
5. Known Issues — What specific problems has the human already seen?
6. Constraints — Technical or process limitations to respect?
7. Autonomy Boundaries — How much freedom once work starts?

RULES:
- Ask questions where the answer genuinely affects what gets built
- Be specific to this instruction — no generic boilerplate
- Number each question
- Put the category name in brackets after each question
- Output ONLY the numbered questions, no preamble or closing text

Example format:
1. When you say "improve quality," are you talking about visual design, code structure, or content accuracy? [Intent]
2. Should I focus on all page types or specific ones? [Scope]
</alignment_questions>`;
  }

  _buildBriefSummaryPrompt(instruction, moduleName = null) {
    let visionContext = '';
    if (this.visionDocPath && existsSync(this.visionDocPath)) {
      visionContext = readFileSync(this.visionDocPath, 'utf-8').slice(0, 2000);
    }

    const moduleScope = moduleName
      ? `\nFOCUS MODULE: ${moduleName}\nScope this summary to this module's implementation only.\n`
      : '';

    return `<brief_alignment>
You are generating a brief alignment summary for a narrow, specific development instruction.
${moduleScope}
INSTRUCTION:
"${instruction}"

PROJECT CONTEXT:
${visionContext || 'No vision document available.'}

Generate a brief Plan Summary in EXACTLY this format:

## Alignment Summary

### What I Will Do
[2-4 bullet points of specific actions]

### What I Will NOT Do
[1-2 bullet points of out-of-scope items]

### Success Criteria
[1-2 measurable criteria]

Output ONLY the formatted summary, no other text.
</brief_alignment>`;
  }

  _buildSummaryPrompt(instruction, questions, answers, moduleName = null) {
    let visionContext = '';
    if (this.visionDocPath && existsSync(this.visionDocPath)) {
      visionContext = readFileSync(this.visionDocPath, 'utf-8').slice(0, 3000);
    }

    const qaBlock = questions.map((q, i) => `Q${i + 1}: ${q}`).join('\n');

    const moduleScope = moduleName
      ? `\nFOCUS MODULE: ${moduleName}\nScope this plan summary to this module's implementation only.\n`
      : '';

    return `<plan_summary>
You are generating a Plan Summary based on alignment Q&A between a human and an autonomous development agent.
${moduleScope}
ORIGINAL INSTRUCTION:
"${instruction}"

PROJECT CONTEXT:
${visionContext || 'No vision document available.'}

QUESTIONS ASKED:
${qaBlock}

HUMAN'S ANSWERS:
${answers}

Generate the Plan Summary in EXACTLY this format:

## Alignment Summary

### What I Understood
[1-2 paragraph summary of the instruction and intent, in your own words, informed by the answers]

### What I Will Do
[Numbered list of specific workstreams, in execution order]

### What I Will NOT Do
[Explicit list of things out of scope, based on the answers]

### Success Criteria
[Measurable definition of done — tied to output QA scores, specific visual benchmarks, or concrete deliverables]

### Estimated Scope
[Approximate number of tasks and time estimate]

### Autonomy Rules
- When I find X, I will do Y
- When I encounter Z, I will [fix it / log it / stop]
[Based on the human's answers about autonomy boundaries]

Output ONLY the formatted summary, no other text.
</plan_summary>`;
  }

  // ─── Parsing ────────────────────────────────────────────────────

  _parseAssessment(output) {
    const text = output.trim();

    if (text.startsWith('NARROW:')) {
      return { needsFull: false, reason: text.replace('NARROW:', '').trim() };
    }

    if (text.startsWith('NEEDS_ALIGNMENT:')) {
      return { needsFull: true, reason: text.replace('NEEDS_ALIGNMENT:', '').trim() };
    }

    // Default to needing alignment if we can't parse
    return { needsFull: true, reason: 'Could not assess specificity — defaulting to full alignment' };
  }

  _parseQuestions(output) {
    // Extract numbered questions from the output
    const lines = output.split('\n').filter(l => l.trim());
    const questions = [];

    for (const line of lines) {
      // Match lines starting with a number followed by . or )
      const match = line.match(/^\s*(\d+)[.)]\s+(.+)/);
      if (match) {
        questions.push(match[2].trim());
      }
    }

    if (questions.length === 0) {
      // Fallback: return lines that look like questions (contain ?)
      return lines.filter(l => l.includes('?')).slice(0, 15);
    }

    return questions;
  }

  // ─── Claude Code CLI ────────────────────────────────────────────

  _runClaudeCode(prompt, maxTurns = 5) {
    return new Promise((resolve, reject) => {
      const childEnv = { ...process.env };
      delete childEnv.CLAUDECODE;

      const proc = spawn('claude', [
        '--print',
        '--dangerously-skip-permissions',
        '--output-format', 'text',
        '--max-turns', String(maxTurns),
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
        reject(new Error('Alignment prompt timed out after 5 minutes'));
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
