/**
 * Pipeline stage wrapper with structured error handling.
 *
 * Usage:
 *   import { wrapStage } from './utils/pipeline-stage.mjs';
 *
 *   const ingest = wrapStage('Ingest', async ({ signal, logger }) => {
 *     // stage work here...
 *     return { html: '<html>...</html>' };
 *   });
 *
 *   const result = await ingest();
 *   // { success: true, stage: 'Ingest', durationMs: 1234, output: { html: '...' } }
 *   // or on failure:
 *   // { success: false, stage: 'Ingest', durationMs: 567, error: 'Something went wrong' }
 */

import { createLogger } from './logger.mjs';

const defaultLogger = createLogger('pipeline-stage');

/**
 * Wraps a pipeline stage function with consistent error handling, timing, and abort support.
 *
 * @param {string} name - Stage name (e.g. 'Ingest', 'Build', 'QA')
 * @param {(ctx: { signal: AbortSignal, logger: object }) => Promise<any>} fn - The stage function
 * @param {object} [options]
 * @param {(error: Error, stage: string) => any} [options.onError] - Recovery callback; return value replaces output on error
 * @param {object} [options.logger] - Custom logger (defaults to pipeline-stage logger)
 * @returns {(runOptions?: { signal?: AbortSignal }) => Promise<{ success: boolean, stage: string, durationMs: number, output?: any, error?: string }>}
 */
export function wrapStage(name, fn, options = {}) {
  const { onError, logger: customLogger } = options;
  const log = customLogger || defaultLogger;

  return async function runStage(runOptions = {}) {
    const { signal: externalSignal } = runOptions;
    const start = Date.now();

    // If already aborted before stage begins, return immediately
    if (externalSignal?.aborted) {
      const durationMs = Date.now() - start;
      const msg = `Stage "${name}" aborted before start`;
      log.error(msg, { stage: name, durationMs });
      return { success: false, stage: name, durationMs, error: msg };
    }

    try {
      const output = await new Promise((resolve, reject) => {
        // Listen for abort during execution
        if (externalSignal) {
          if (externalSignal.aborted) {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
            return;
          }
          const onAbort = () => reject(new DOMException('The operation was aborted.', 'AbortError'));
          externalSignal.addEventListener('abort', onAbort, { once: true });
          fn({ signal: externalSignal, logger: log })
            .then((val) => { externalSignal.removeEventListener('abort', onAbort); resolve(val); })
            .catch((err) => { externalSignal.removeEventListener('abort', onAbort); reject(err); });
        } else {
          fn({ signal: undefined, logger: log }).then(resolve, reject);
        }
      });

      const durationMs = Date.now() - start;
      log.info(`Stage "${name}" completed`, { stage: name, durationMs });
      return { success: true, stage: name, durationMs, output };

    } catch (err) {
      const durationMs = Date.now() - start;
      const errorMessage = err instanceof Error ? err.message : String(err);
      log.error(`Stage "${name}" failed`, { stage: name, durationMs, error: errorMessage });

      if (onError) {
        try {
          const recovered = await onError(err, name);
          log.info(`Stage "${name}" recovered via onError`, { stage: name, durationMs });
          return { success: true, stage: name, durationMs, output: recovered };
        } catch (recoveryErr) {
          const finalDuration = Date.now() - start;
          const recoveryMessage = recoveryErr instanceof Error ? recoveryErr.message : String(recoveryErr);
          log.error(`Stage "${name}" recovery failed`, { stage: name, durationMs: finalDuration, error: recoveryMessage });
          return { success: false, stage: name, durationMs: finalDuration, error: recoveryMessage };
        }
      }

      return { success: false, stage: name, durationMs, error: errorMessage };
    }
  };
}
