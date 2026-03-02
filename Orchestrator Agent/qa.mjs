// qa.mjs — Quality Assurance checks after Claude Code executes a task
// Runs build, lint, tests, and reports results

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

export class QARunner {
  constructor(projectPath) {
    this.projectPath = projectPath;
  }

  async runAll(modulePath = null, taskContext = null) {
    const checkPath = modulePath || this.projectPath;

    const results = {
      passed: true,
      modulePath: checkPath,
      checks: [],
      timestamp: new Date().toISOString(),
    };

    // 1. Check if project builds (skip if no build script)
    const buildResult = this.runCheck('build', 'npm run build --if-present', checkPath);
    results.checks.push(buildResult);
    if (!buildResult.passed) results.passed = false;

    // 2. Run linter if configured
    const lintResult = this.runCheck('lint', 'npm run lint --if-present', checkPath);
    results.checks.push(lintResult);
    // Lint warnings don't fail the build
    if (lintResult.exitCode > 1) results.passed = false;

    // 3. Run tests if they exist
    const testResult = this.runCheck('test', 'npm test --if-present', checkPath);
    results.checks.push(testResult);
    if (!testResult.passed) results.passed = false;

    // 4. Sanity checks (package.json valid, no .env modifications)
    const sanityResult = this.sanityChecks(checkPath);
    results.checks.push(sanityResult);
    if (!sanityResult.passed) results.passed = false;

    // 5. File existence check — were the reported files actually changed?
    if (taskContext?.filesChanged?.length > 0) {
      const fileResult = this.verifyFilesExist(checkPath, taskContext.filesChanged);
      results.checks.push(fileResult);
      if (!fileResult.passed) results.passed = false;
    }

    // 6. Type check (if TypeScript project)
    if (existsSync(path.join(checkPath, 'tsconfig.json'))) {
      const tscResult = this.runCheck('typecheck', 'npx tsc --noEmit', checkPath);
      results.checks.push(tscResult);
      if (!tscResult.passed) results.passed = false;
    }

    // 7. Output QA (funnel-designer only) — structural + visual page checks
    if (this._isFunnelOutput(checkPath)) {
      const outputResult = await this._runOutputQA(checkPath);
      results.checks.push(outputResult);
      if (!outputResult.passed) results.passed = false;
    }

    return results;
  }

  runCheck(name, command, workingDir) {
    try {
      const output = execSync(command, {
        cwd: workingDir,
        stdio: 'pipe',
        timeout: 180_000, // 3 min timeout per check
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
        output: (err.stderr?.toString() || err.stdout?.toString() || err.message).slice(-500),
      };
    }
  }

  sanityChecks(checkPath) {
    const issues = [];

    // Check package.json still valid
    const pkgPath = path.join(checkPath, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        JSON.parse(readFileSync(pkgPath, 'utf-8'));
      } catch (err) {
        issues.push(`${pkgPath} is invalid JSON: ${err.message}`);
      }
    }

    // Git checks — only run if checkPath is inside a git repo
    const isGitRepo = existsSync(path.join(checkPath, '.git')) || (() => {
      try {
        execSync('git rev-parse --git-dir', { cwd: checkPath, stdio: 'pipe' });
        return true;
      } catch {
        return false;
      }
    })();

    if (isGitRepo) {
      // Check no .env files were modified (scoped to this module only)
      try {
        const gitStatus = execSync(`git diff --name-only -- "${checkPath}"`, {
          cwd: checkPath,
          stdio: 'pipe',
        }).toString();

        if (gitStatus.includes('.env')) {
          issues.push('.env file was modified — this must not be committed');
        }
      } catch {
        // git command failed — skip
      }

      // Check no node_modules were staged (scoped to this module only)
      try {
        const gitStatus = execSync(`git diff --cached --name-only -- "${checkPath}"`, {
          cwd: checkPath,
          stdio: 'pipe',
        }).toString();

        if (gitStatus.includes('node_modules')) {
          issues.push('node_modules changes staged for commit');
        }
      } catch {
        // skip
      }
    }

    return {
      name: 'sanity',
      passed: issues.length === 0,
      exitCode: issues.length > 0 ? 1 : 0,
      output: issues.length > 0 ? issues.join('\n') : 'All sanity checks passed',
    };
  }

  verifyFilesExist(checkPath, filesChanged) {
    // Filter out non-path entries (e.g. "(none — already handled)" or empty strings)
    const realFiles = filesChanged.filter(f =>
      f && !f.startsWith('(') && !f.toLowerCase().includes('none') && !f.toLowerCase().includes('n/a')
    );

    if (realFiles.length === 0) {
      return {
        name: 'files_exist',
        passed: true,
        exitCode: 0,
        output: 'No files to verify (none reported changed)',
      };
    }

    const missing = [];
    for (const file of realFiles) {
      const fullPath = path.isAbsolute(file) ? file : path.join(checkPath, file);
      if (!existsSync(fullPath)) {
        missing.push(file);
      }
    }

    return {
      name: 'files_exist',
      passed: missing.length === 0,
      exitCode: missing.length > 0 ? 1 : 0,
      output: missing.length > 0
        ? `Missing files: ${missing.join(', ')}`
        : `All ${realFiles.length} reported files verified`,
    };
  }

  _isFunnelOutput(checkPath) {
    return checkPath.includes('funnel-designer') &&
      existsSync(path.join(checkPath, 'output', 'landing_page', 'index.html'));
  }

  async _runOutputQA(checkPath) {
    try {
      const { OutputQARunner } = await import('./qa/qa-runner.mjs');
      const runner = new OutputQARunner({ verbose: false });
      const outputDir = path.join(checkPath, 'output');
      const { passed, results } = await runner.runAll(outputDir);

      const entries = Object.entries(results);
      const total = entries.length;
      const passedCount = entries.filter(([, r]) => r.passed).length;

      let output;
      if (passed) {
        output = `${passedCount}/${total} pages passed (structural + visual)`;
      } else {
        const failures = entries
          .filter(([, r]) => !r.passed)
          .map(([page, r]) => {
            const failedChecks = [];
            if (r.structural && !r.structural.passed) {
              const failedStructural = r.structural.checks
                .filter(c => !c.passed)
                .map(c => c.name);
              failedChecks.push(...failedStructural);
            }
            if (r.visual && !r.visual.passed && !r.visual.skipped) {
              const failedBps = Object.entries(r.visual.breakpoints)
                .filter(([, b]) => !b.skipped && !b.passed)
                .map(([bp, b]) => `visual ${bp} ${b.average || '?'}`);
              failedChecks.push(...failedBps);
            }
            return `${page} (${failedChecks.join(', ') || 'failed'})`;
          });
        output = `${passedCount}/${total} passed. FAIL: ${failures.join(', ')}`;
      }

      return { name: 'output_qa', passed, exitCode: passed ? 0 : 1, output };
    } catch (err) {
      return {
        name: 'output_qa',
        passed: false,
        exitCode: 2,
        output: `Output QA error: ${err.message}`.slice(-500),
      };
    }
  }

  formatReport(results) {
    const lines = [
      `### 🧪 QA Report`,
      `**Overall: ${results.passed ? '✅ PASSED' : '❌ FAILED'}**`,
      `Module: \`${path.basename(results.modulePath || this.projectPath)}\``,
      '',
    ];

    for (const check of results.checks) {
      const icon = check.passed ? '✅' : '❌';
      lines.push(`${icon} **${check.name}**: ${check.passed ? 'passed' : 'failed'}`);
      if (!check.passed && check.output) {
        lines.push('```', check.output.slice(-200), '```');
      }
    }

    return lines.join('\n');
  }
}
