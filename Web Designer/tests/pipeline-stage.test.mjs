import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { wrapStage } from '../utils/pipeline-stage.mjs';

// ─── Helpers ────────────────────────────────────────────

function silentLogger() {
  return { info: () => {}, warn: () => {}, error: () => {} };
}

// ─── Tests ──────────────────────────────────────────────

describe('wrapStage', () => {

  describe('success path', () => {
    it('returns success result with output', async () => {
      const stage = wrapStage('Ingest', async () => ({ html: '<h1>Hello</h1>' }), {
        logger: silentLogger(),
      });
      const result = await stage();
      assert.equal(result.success, true);
      assert.equal(result.stage, 'Ingest');
      assert.ok(result.durationMs >= 0);
      assert.deepEqual(result.output, { html: '<h1>Hello</h1>' });
      assert.equal(result.error, undefined);
    });

    it('handles undefined output', async () => {
      const stage = wrapStage('Build', async () => {}, {
        logger: silentLogger(),
      });
      const result = await stage();
      assert.equal(result.success, true);
      assert.equal(result.stage, 'Build');
      assert.equal(result.output, undefined);
    });

    it('tracks duration', async () => {
      const stage = wrapStage('Slow', async () => {
        await new Promise(r => setTimeout(r, 50));
        return 'done';
      }, { logger: silentLogger() });
      const result = await stage();
      assert.equal(result.success, true);
      assert.ok(result.durationMs >= 30, `Duration ${result.durationMs}ms should be >= 30ms`);
    });
  });

  describe('failure path', () => {
    it('catches errors and returns failure result', async () => {
      const stage = wrapStage('QA', async () => {
        throw new Error('Validation failed');
      }, { logger: silentLogger() });
      const result = await stage();
      assert.equal(result.success, false);
      assert.equal(result.stage, 'QA');
      assert.equal(result.error, 'Validation failed');
      assert.ok(result.durationMs >= 0);
      assert.equal(result.output, undefined);
    });

    it('handles non-Error throws', async () => {
      const stage = wrapStage('Deploy', async () => {
        throw 'string error';
      }, { logger: silentLogger() });
      const result = await stage();
      assert.equal(result.success, false);
      assert.equal(result.error, 'string error');
    });
  });

  describe('logging', () => {
    it('logs success with stage name and duration', async () => {
      const logs = [];
      const logger = {
        info: (msg, extra) => logs.push({ level: 'info', msg, ...extra }),
        warn: (msg, extra) => logs.push({ level: 'warn', msg, ...extra }),
        error: (msg, extra) => logs.push({ level: 'error', msg, ...extra }),
      };
      const stage = wrapStage('Ingest', async () => 'ok', { logger });
      await stage();
      const successLog = logs.find(l => l.level === 'info' && l.msg.includes('completed'));
      assert.ok(successLog, 'Should log success');
      assert.equal(successLog.stage, 'Ingest');
      assert.ok(successLog.durationMs >= 0);
    });

    it('logs failure with stage name, duration, and error message', async () => {
      const logs = [];
      const logger = {
        info: (msg, extra) => logs.push({ level: 'info', msg, ...extra }),
        warn: (msg, extra) => logs.push({ level: 'warn', msg, ...extra }),
        error: (msg, extra) => logs.push({ level: 'error', msg, ...extra }),
      };
      const stage = wrapStage('Build', async () => { throw new Error('build broke'); }, { logger });
      await stage();
      const errorLog = logs.find(l => l.level === 'error' && l.msg.includes('failed'));
      assert.ok(errorLog, 'Should log error');
      assert.equal(errorLog.stage, 'Build');
      assert.equal(errorLog.error, 'build broke');
      assert.ok(errorLog.durationMs >= 0);
    });
  });

  describe('onError recovery', () => {
    it('calls onError and uses its return value as output on success', async () => {
      const stage = wrapStage('QA', async () => {
        throw new Error('first attempt failed');
      }, {
        logger: silentLogger(),
        onError: (err, stageName) => {
          assert.equal(err.message, 'first attempt failed');
          assert.equal(stageName, 'QA');
          return { recovered: true };
        },
      });
      const result = await stage();
      assert.equal(result.success, true);
      assert.deepEqual(result.output, { recovered: true });
    });

    it('returns failure when onError also throws', async () => {
      const stage = wrapStage('Deploy', async () => {
        throw new Error('deploy failed');
      }, {
        logger: silentLogger(),
        onError: () => { throw new Error('recovery also failed'); },
      });
      const result = await stage();
      assert.equal(result.success, false);
      assert.equal(result.error, 'recovery also failed');
    });

    it('does not call onError on success', async () => {
      let onErrorCalled = false;
      const stage = wrapStage('Build', async () => 'ok', {
        logger: silentLogger(),
        onError: () => { onErrorCalled = true; },
      });
      await stage();
      assert.equal(onErrorCalled, false);
    });
  });

  describe('abort signal', () => {
    it('aborts a running stage when signal fires', async () => {
      const controller = new AbortController();
      const stage = wrapStage('Build', async ({ signal }) => {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => resolve('should not reach'), 5000);
          signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          }, { once: true });
        });
      }, { logger: silentLogger() });

      // Abort after 50ms
      setTimeout(() => controller.abort(), 50);
      const result = await stage({ signal: controller.signal });
      assert.equal(result.success, false);
      assert.ok(result.error.includes('aborted'));
    });

    it('returns failure immediately if signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();
      const stage = wrapStage('Ingest', async () => 'should not run', {
        logger: silentLogger(),
      });
      const result = await stage({ signal: controller.signal });
      assert.equal(result.success, false);
      assert.ok(result.error.includes('aborted'));
    });

    it('does not interfere when no signal is provided', async () => {
      const stage = wrapStage('QA', async () => 'no-signal', {
        logger: silentLogger(),
      });
      const result = await stage();
      assert.equal(result.success, true);
      assert.equal(result.output, 'no-signal');
    });

    it('does not interfere when signal is not aborted', async () => {
      const controller = new AbortController();
      const stage = wrapStage('Build', async () => 'with-signal', {
        logger: silentLogger(),
      });
      const result = await stage({ signal: controller.signal });
      assert.equal(result.success, true);
      assert.equal(result.output, 'with-signal');
    });
  });

  describe('stage receives logger', () => {
    it('passes logger to the stage function', async () => {
      let receivedLogger;
      const customLogger = silentLogger();
      const stage = wrapStage('Ingest', async ({ logger }) => {
        receivedLogger = logger;
        return 'ok';
      }, { logger: customLogger });
      await stage();
      assert.equal(receivedLogger, customLogger);
    });
  });

  describe('result contract', () => {
    it('always includes success, stage, and durationMs', async () => {
      const successStage = wrapStage('A', async () => 'ok', { logger: silentLogger() });
      const failStage = wrapStage('B', async () => { throw new Error('no'); }, { logger: silentLogger() });

      const s = await successStage();
      const f = await failStage();

      for (const result of [s, f]) {
        assert.ok('success' in result, 'must have success');
        assert.ok('stage' in result, 'must have stage');
        assert.ok('durationMs' in result, 'must have durationMs');
        assert.equal(typeof result.success, 'boolean');
        assert.equal(typeof result.stage, 'string');
        assert.equal(typeof result.durationMs, 'number');
      }
    });

    it('success result has output, no error', async () => {
      const stage = wrapStage('X', async () => 42, { logger: silentLogger() });
      const result = await stage();
      assert.equal(result.output, 42);
      assert.equal(result.error, undefined);
    });

    it('failure result has error, no output', async () => {
      const stage = wrapStage('Y', async () => { throw new Error('fail'); }, { logger: silentLogger() });
      const result = await stage();
      assert.equal(result.error, 'fail');
      assert.equal(result.output, undefined);
    });
  });
});
