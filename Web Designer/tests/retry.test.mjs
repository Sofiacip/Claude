import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { withRetry } from '../utils/retry.mjs';

// ─── Helpers ────────────────────────────────────────────

function makeFailing(failCount, result = 'ok') {
  let calls = 0;
  return () => {
    calls++;
    if (calls <= failCount) throw new Error(`fail #${calls}`);
    return Promise.resolve(result);
  };
}

// ─── Tests ──────────────────────────────────────────────

describe('withRetry', () => {

  describe('success on first try', () => {
    it('returns the result immediately', async () => {
      const result = await withRetry(() => Promise.resolve(42), {
        maxAttempts: 3,
        baseDelay: 10,
      });
      assert.equal(result, 42);
    });

    it('does not call onRetry', async () => {
      let retryCalled = false;
      await withRetry(() => Promise.resolve('ok'), {
        maxAttempts: 3,
        baseDelay: 10,
        onRetry: () => { retryCalled = true; },
      });
      assert.equal(retryCalled, false);
    });
  });

  describe('success on retry', () => {
    it('succeeds after transient failures', async () => {
      const fn = makeFailing(2, 'recovered');
      const result = await withRetry(fn, {
        maxAttempts: 3,
        baseDelay: 10,
        jitter: false,
      });
      assert.equal(result, 'recovered');
    });

    it('calls onRetry for each failed attempt before retrying', async () => {
      const retries = [];
      const fn = makeFailing(2, 'done');
      await withRetry(fn, {
        maxAttempts: 3,
        baseDelay: 10,
        jitter: false,
        onRetry: (err, attempt) => retries.push({ msg: err.message, attempt }),
      });
      assert.equal(retries.length, 2);
      assert.equal(retries[0].attempt, 1);
      assert.equal(retries[0].msg, 'fail #1');
      assert.equal(retries[1].attempt, 2);
      assert.equal(retries[1].msg, 'fail #2');
    });
  });

  describe('all retries exhausted', () => {
    it('throws the last error after maxAttempts', async () => {
      const fn = makeFailing(5, 'never');
      const err = await withRetry(fn, {
        maxAttempts: 3,
        baseDelay: 10,
        jitter: false,
      }).catch(e => e);
      assert.ok(err instanceof Error);
      assert.equal(err.message, 'fail #3');
      assert.equal(err.attempts, 3);
    });

    it('wraps non-Error throws with attempts property', async () => {
      let calls = 0;
      const fn = () => { calls++; throw 'string error'; };
      const err = await withRetry(fn, {
        maxAttempts: 2,
        baseDelay: 10,
        jitter: false,
      }).catch(e => e);
      assert.ok(err instanceof Error);
      assert.equal(err.message, 'string error');
      assert.equal(err.attempts, 2);
    });
  });

  describe('timeout', () => {
    it('rejects with timeout error when fn takes too long', async () => {
      const slowFn = () => new Promise(resolve => setTimeout(resolve, 5000));
      const err = await withRetry(slowFn, {
        maxAttempts: 1,
        baseDelay: 10,
        timeout: 50,
      }).catch(e => e);
      assert.ok(err instanceof Error);
      assert.match(err.message, /Timed out/);
    });

    it('succeeds when fn completes within timeout', async () => {
      const fastFn = () => new Promise(resolve => setTimeout(() => resolve('fast'), 10));
      const result = await withRetry(fastFn, {
        maxAttempts: 1,
        baseDelay: 10,
        timeout: 5000,
      });
      assert.equal(result, 'fast');
    });

    it('does not apply timeout when timeout is 0', async () => {
      const fn = () => new Promise(resolve => setTimeout(() => resolve('no-timeout'), 50));
      const result = await withRetry(fn, {
        maxAttempts: 1,
        baseDelay: 10,
        timeout: 0,
      });
      assert.equal(result, 'no-timeout');
    });
  });

  describe('shouldRetry filter', () => {
    it('stops retrying when shouldRetry returns false', async () => {
      let calls = 0;
      const fn = () => { calls++; throw new Error(calls === 1 ? 'retryable' : 'fatal'); };
      const err = await withRetry(fn, {
        maxAttempts: 5,
        baseDelay: 10,
        jitter: false,
        shouldRetry: (e) => e.message === 'retryable',
      }).catch(e => e);
      assert.equal(calls, 2);
      assert.equal(err.message, 'fatal');
      assert.equal(err.attempts, 2);
    });

    it('retries when shouldRetry returns true', async () => {
      const fn = makeFailing(2, 'filtered-ok');
      const result = await withRetry(fn, {
        maxAttempts: 3,
        baseDelay: 10,
        jitter: false,
        shouldRetry: () => true,
      });
      assert.equal(result, 'filtered-ok');
    });
  });

  describe('exponential backoff', () => {
    it('delays increase exponentially (jitter off)', async () => {
      const timestamps = [];
      let calls = 0;
      const fn = () => {
        timestamps.push(Date.now());
        calls++;
        if (calls < 4) throw new Error('retry');
        return Promise.resolve('done');
      };

      await withRetry(fn, {
        maxAttempts: 4,
        baseDelay: 50,
        maxDelay: 10000,
        jitter: false,
      });

      // Delays should be approximately: 50ms, 100ms, 200ms
      const gap1 = timestamps[1] - timestamps[0];
      const gap2 = timestamps[2] - timestamps[1];
      const gap3 = timestamps[3] - timestamps[2];

      // Allow 30ms tolerance for timer imprecision
      assert.ok(gap1 >= 30, `First gap ${gap1}ms should be ~50ms`);
      assert.ok(gap2 >= 70, `Second gap ${gap2}ms should be ~100ms`);
      assert.ok(gap3 >= 150, `Third gap ${gap3}ms should be ~200ms`);
      assert.ok(gap2 > gap1, 'Second delay should be longer than first');
      assert.ok(gap3 > gap2, 'Third delay should be longer than second');
    });

    it('caps delay at maxDelay', async () => {
      const timestamps = [];
      let calls = 0;
      const fn = () => {
        timestamps.push(Date.now());
        calls++;
        if (calls < 4) throw new Error('retry');
        return Promise.resolve('done');
      };

      await withRetry(fn, {
        maxAttempts: 4,
        baseDelay: 50,
        maxDelay: 60,
        jitter: false,
      });

      // Gaps should be: 50ms, 60ms (capped), 60ms (capped)
      const gap2 = timestamps[2] - timestamps[1];
      const gap3 = timestamps[3] - timestamps[2];

      // Both should be close to 60ms (capped), not 100/200
      assert.ok(gap2 < 100, `Second gap ${gap2}ms should be capped at ~60ms`);
      assert.ok(gap3 < 100, `Third gap ${gap3}ms should be capped at ~60ms`);
    });
  });

  describe('jitter', () => {
    it('adds randomization when jitter is true (default)', async () => {
      const timestamps = [];
      let calls = 0;
      const fn = () => {
        timestamps.push(Date.now());
        calls++;
        if (calls < 3) throw new Error('retry');
        return Promise.resolve('done');
      };

      await withRetry(fn, {
        maxAttempts: 3,
        baseDelay: 100,
        jitter: true,
      });

      // With ±10% jitter on 100ms base, delay should be 90-110ms
      const gap1 = timestamps[1] - timestamps[0];
      assert.ok(gap1 >= 60, `Gap ${gap1}ms should be at least ~90ms (with timer tolerance)`);
      assert.ok(gap1 <= 150, `Gap ${gap1}ms should be at most ~110ms (with timer tolerance)`);
    });
  });

  describe('abort signal', () => {
    it('passes an AbortSignal to the wrapped function', async () => {
      let receivedSignal;
      await withRetry(({ signal }) => {
        receivedSignal = signal;
        return Promise.resolve('ok');
      }, { maxAttempts: 1, baseDelay: 10 });
      assert.ok(receivedSignal instanceof AbortSignal);
      assert.equal(receivedSignal.aborted, false);
    });

    it('aborts the signal when timeout fires', async () => {
      let receivedSignal;
      const slowFn = ({ signal }) => {
        receivedSignal = signal;
        return new Promise((resolve) => setTimeout(resolve, 5000));
      };
      await withRetry(slowFn, {
        maxAttempts: 1,
        baseDelay: 10,
        timeout: 50,
      }).catch(() => {});
      assert.ok(receivedSignal instanceof AbortSignal);
      assert.equal(receivedSignal.aborted, true, 'Signal should be aborted after timeout');
    });

    it('does not abort the signal when fn succeeds before timeout', async () => {
      let receivedSignal;
      const fastFn = ({ signal }) => {
        receivedSignal = signal;
        return new Promise((resolve) => setTimeout(() => resolve('fast'), 10));
      };
      await withRetry(fastFn, {
        maxAttempts: 1,
        baseDelay: 10,
        timeout: 5000,
      });
      assert.equal(receivedSignal.aborted, false, 'Signal should not be aborted on success');
    });
  });

  describe('jitter range', () => {
    it('produces delays within ±10% of the computed backoff', async () => {
      const timestamps = [];
      let calls = 0;
      const fn = () => {
        timestamps.push(Date.now());
        calls++;
        if (calls < 6) throw new Error('retry');
        return Promise.resolve('done');
      };

      await withRetry(fn, {
        maxAttempts: 6,
        baseDelay: 100,
        maxDelay: 100,
        jitter: true,
      });

      // With maxDelay=100 and baseDelay=100, all delays cap at 100ms
      // ±10% jitter gives 90-110ms; allow ±30ms tolerance for timer imprecision
      for (let i = 1; i < timestamps.length; i++) {
        const gap = timestamps[i] - timestamps[i - 1];
        assert.ok(gap >= 60, `Gap #${i} (${gap}ms) should be at least ~90ms`);
        assert.ok(gap <= 150, `Gap #${i} (${gap}ms) should be at most ~110ms`);
      }
    });
  });

  describe('defaults', () => {
    it('uses default options when none provided', async () => {
      const result = await withRetry(() => Promise.resolve('default'), {
        baseDelay: 10,
      });
      assert.equal(result, 'default');
    });
  });
});
