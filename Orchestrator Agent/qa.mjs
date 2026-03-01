// qa.mjs — Quality Assurance checks after Claude Code executes a task
// Runs build, lint, tests, and reports results

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

export class QARunner {
  constructor(projectPath) {
    this.projectPath = projectPath;
  }

  async runAll() {
    const results = {
      passed: true,
      checks: [],
    };

    // 1. Check if project builds
    const buildResult = this.runCheck('build', 'npm run build');
    results.checks.push(buildResult);
    if (!buildResult.passed) results.passed = false;

    // 2. Run linter if configured
    const lintResult = this.runCheck('lint', 'npm run lint --if-present');
    results.checks.push(lintResult);
    // Lint warnings don't fail the build
    if (lintResult.exitCode > 1) results.passed = false;

    // 3. Run tests if they exist
    const testResult = this.runCheck('test', 'npm test --if-present');
    results.checks.push(testResult);
    if (!testResult.passed) results.passed = false;

    // 4. Check for common issues
    const sanityResult = this.sanityChecks();
    results.checks.push(sanityResult);
    if (!sanityResult.passed) results.passed = false;

    return results;
  }

  runCheck(name, command) {
    try {
      const output = execSync(command, {
        cwd: this.projectPath,
        stdio: 'pipe',
        timeout: 120_000, // 2 min timeout per check
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
        output: (err.stderr?.toString() || err.message).slice(-500),
      };
    }
  }

  sanityChecks() {
    const issues = [];

    // Check package.json still valid
    const pkgPath = path.join(this.projectPath, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        JSON.parse(require('fs').readFileSync(pkgPath, 'utf-8'));
      } catch {
        issues.push('package.json is invalid JSON');
      }
    }

    // Check no .env files were accidentally modified
    try {
      const gitStatus = execSync('git diff --name-only', {
        cwd: this.projectPath,
        stdio: 'pipe',
      }).toString();

      if (gitStatus.includes('.env')) {
        issues.push('.env file was modified — this should not be committed');
      }
    } catch {
      // Not a git repo or git not available — skip
    }

    return {
      name: 'sanity',
      passed: issues.length === 0,
      exitCode: issues.length > 0 ? 1 : 0,
      output: issues.length > 0 ? issues.join('\n') : 'All sanity checks passed',
    };
  }

  formatReport(results) {
    const lines = [
      `## 🧪 QA Report`,
      `**Overall: ${results.passed ? '✅ PASSED' : '❌ FAILED'}**\n`,
    ];

    for (const check of results.checks) {
      const icon = check.passed ? '✅' : '❌';
      lines.push(`${icon} **${check.name}**: ${check.passed ? 'passed' : 'failed'}`);
      if (!check.passed && check.output) {
        lines.push(`\`\`\`\n${check.output.slice(-200)}\n\`\`\``);
      }
    }

    return lines.join('\n');
  }
}
