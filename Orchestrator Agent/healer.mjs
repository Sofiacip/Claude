// healer.mjs — Self-healing engine: error classification and retry strategies

export class SelfHealer {
  constructor(memory) {
    this.memory = memory;
    this.maxRetries = 3;
  }

  /**
   * Classify an error and determine the best retry strategy.
   * Returns { category, strategy, shouldRetry, retryPrompt }
   */
  classifyError(error, context = {}) {
    const errorStr = typeof error === 'string' ? error : error.message || String(error);
    const errorLower = errorStr.toLowerCase();

    // Build errors
    if (errorLower.includes('build') && (errorLower.includes('fail') || errorLower.includes('error'))) {
      return this.buildStrategy('build_error', errorStr, context);
    }

    // Missing dependencies
    if (errorLower.includes('cannot find module') || errorLower.includes('module not found') || errorLower.includes('no such file or directory')) {
      return this.buildStrategy('missing_dependency', errorStr, context);
    }

    // Test failures
    if (errorLower.includes('test') && (errorLower.includes('fail') || errorLower.includes('assert'))) {
      return this.buildStrategy('test_failure', errorStr, context);
    }

    // Timeouts
    if (errorLower.includes('timeout') || errorLower.includes('timed out')) {
      return this.buildStrategy('timeout', errorStr, context);
    }

    // Parse errors
    if (errorLower.includes('could not parse') || errorLower.includes('unknown') || context.status === 'unknown') {
      return this.buildStrategy('parse_error', errorStr, context);
    }

    // Module not found
    if (errorLower.includes('module folder not found')) {
      return this.buildStrategy('module_not_found', errorStr, context);
    }

    // Permission errors — never auto-retry
    if (errorLower.includes('permission') || errorLower.includes('eacces')) {
      return {
        category: 'permission_error',
        shouldRetry: false,
        reason: 'Permission errors require manual intervention. Check file ownership and permissions on the VPS.',
      };
    }

    // Default: unknown error
    return this.buildStrategy('unknown', errorStr, context);
  }

  buildStrategy(category, errorStr, context) {
    const attempt = context.attempt || 1;
    const previousApproaches = context.previousErrors || [];

    // Check if we've seen this pattern before
    const knownPattern = this.memory?.getErrorContext(category);

    // Don't retry if we've hit max attempts
    if (attempt >= this.maxRetries) {
      return {
        category,
        shouldRetry: false,
        reason: `Exhausted ${this.maxRetries} attempts. Error category: ${category}.`,
      };
    }

    const strategies = {
      build_error: {
        retryPrompt: `The previous attempt failed with a build error:
\`\`\`
${errorStr.slice(-500)}
\`\`\`

IMPORTANT: Before writing any code, read the error message carefully. Identify the exact file and line number causing the failure. Fix ONLY that specific issue. Then run \`npm run build\` to verify the fix before proceeding.
${knownPattern?.commonFix ? `\nNote: Similar errors have been fixed before by: ${knownPattern.commonFix}` : ''}`,
      },

      missing_dependency: {
        retryPrompt: `The previous attempt failed because a module or file was not found:
\`\`\`
${errorStr.slice(-500)}
\`\`\`

IMPORTANT: Check if:
1. The import path is correct (relative paths, casing)
2. The package is listed in package.json (if external dependency)
3. The file actually exists at the expected path (if internal module)

If a package is missing, install it with \`npm install <package>\`. If an internal file is missing, check if it was supposed to be created in a previous step.`,
      },

      test_failure: {
        retryPrompt: `The previous attempt caused test failures:
\`\`\`
${errorStr.slice(-500)}
\`\`\`

IMPORTANT: Read the failing test to understand what's expected. The test describes the intended behavior. Fix your code to match the test expectations, don't modify existing tests unless the task specifically asks you to.`,
      },

      timeout: {
        retryPrompt: `The previous attempt timed out after 10 minutes. The task is too complex for a single run.

IMPORTANT: Break the work into smaller steps. Do the MOST CRITICAL part of the task only — the part that delivers the core functionality. Skip nice-to-haves, edge cases, and optimizations. Get the basic feature working first.

If the task involves modifying multiple files, focus on the primary file only. The other files can be updated in a follow-up task.`,
      },

      parse_error: {
        retryPrompt: `The previous attempt completed but the output could not be parsed. The agent could not find the structured result block.

CRITICAL: When you finish your work, you MUST output your results in this EXACT format (no other XML tags, no markdown around it):

<result>
STATUS: success | partial | blocked
FILES_CHANGED: comma,separated,file,paths
SUMMARY: One paragraph describing what you did
BLOCKERS: (leave empty if none) Description of any blockers
TESTS: passed | failed | none
</result>

This block must appear at the END of your output. Do not nest it inside other tags.`,
      },

      module_not_found: {
        retryPrompt: `The module path could not be found. The task may reference a module that:
1. Has a different folder name than expected
2. Hasn't been created yet
3. Has been moved or renamed

Please list the contents of /Users/Administrator/Claude/ to see what modules exist, and work from the correct directory.`,
      },

      unknown: {
        retryPrompt: `The previous attempt failed with an unexpected error:
\`\`\`
${errorStr.slice(-500)}
\`\`\`

${previousApproaches.length > 0 ? `\nPrevious approaches that failed:\n${previousApproaches.map((e, i) => `${i + 1}. ${e.slice(0, 200)}`).join('\n')}` : ''}

Try a DIFFERENT approach this time. If the previous attempt tried to create new files, try modifying existing ones instead. If it tried a complex solution, try a simpler one.`,
      },
    };

    const strategy = strategies[category] || strategies.unknown;

    // Record the error pattern in memory
    if (this.memory) {
      this.memory.recordError(category, errorStr);
    }

    return {
      category,
      shouldRetry: true,
      retryPrompt: strategy.retryPrompt,
    };
  }
}
