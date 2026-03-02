/**
 * Retry utility with exponential backoff.
 *
 * Usage:
 *   import { withRetry } from './utils/retry.mjs';
 *   const result = await withRetry(() => fetch(url), { maxAttempts: 3 });
 */

/**
 * @param {(opts: { signal: AbortSignal }) => Promise<T>} fn - Async function to retry; receives { signal } for cancellation
 * @param {object} [options]
 * @param {number} [options.maxAttempts=3]    - Total attempts (including the first)
 * @param {number} [options.baseDelay=1000]   - Base delay in ms before first retry
 * @param {number} [options.maxDelay=10000]   - Cap on delay between retries
 * @param {number} [options.timeout=30000]    - Per-attempt timeout in ms (0 = no timeout)
 * @param {boolean|number} [options.jitter=true] - Add ±10% jitter (true), disable (false), or custom factor (e.g. 0.2 for ±20%)
 * @param {(error: Error, attempt: number) => void} [options.onRetry] - Called before each retry
 * @param {(error: Error) => boolean} [options.shouldRetry] - Return false to stop retrying
 * @returns {Promise<T>}
 */
export async function withRetry(fn, options = {}) {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    timeout = 30000,
    jitter = true,
    onRetry,
    shouldRetry,
  } = options;

  let lastError;
  let attemptsMade = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    attemptsMade = attempt;
    const controller = new AbortController();
    try {
      const result = timeout > 0
        ? await withTimeout(fn({ signal: controller.signal }), timeout, controller)
        : await fn({ signal: controller.signal });
      return result;
    } catch (err) {
      lastError = err;

      if (attempt === maxAttempts) break;
      if (shouldRetry && !shouldRetry(err)) break;

      if (onRetry) onRetry(err, attempt);

      const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
      let delay = Math.min(exponentialDelay, maxDelay);
      if (jitter !== false) {
        const factor = typeof jitter === 'number' ? jitter : 0.1;
        delay = delay * (1 - factor + Math.random() * factor * 2);
      }

      await sleep(delay);
    }
  }

  const error = lastError instanceof Error ? lastError : new Error(String(lastError));
  error.attempts = attemptsMade;
  throw error;
}

function withTimeout(promise, ms, controller) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`Timed out after ${ms}ms`));
    }, ms);

    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
