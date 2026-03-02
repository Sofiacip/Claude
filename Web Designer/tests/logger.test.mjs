import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// Capture stdout/stderr writes for assertions
let stdoutLines, stderrLines;
const originalStdoutWrite = process.stdout.write;
const originalStderrWrite = process.stderr.write;

function captureOutput() {
  stdoutLines = [];
  stderrLines = [];
  process.stdout.write = (chunk) => { stdoutLines.push(chunk.toString()); return true; };
  process.stderr.write = (chunk) => { stderrLines.push(chunk.toString()); return true; };
}

function restoreOutput() {
  process.stdout.write = originalStdoutWrite;
  process.stderr.write = originalStderrWrite;
}

// ─── Tests ──────────────────────────────────────────────

describe('createLogger (default, no context)', () => {
  let createLogger;

  beforeEach(async () => {
    // Fresh import each time to avoid module cache issues
    ({ createLogger } = await import(`../utils/logger.mjs?t=${Date.now()}`));
    captureOutput();
  });

  afterEach(() => {
    restoreOutput();
  });

  it('emits info log as JSON to stdout', () => {
    const log = createLogger('test-module');
    log.info('hello world');
    assert.equal(stdoutLines.length, 1);
    const entry = JSON.parse(stdoutLines[0]);
    assert.equal(entry.level, 'info');
    assert.equal(entry.module, 'test-module');
    assert.equal(entry.msg, 'hello world');
    assert.ok(entry.ts, 'should have a timestamp');
    assert.equal(entry.correlationId, undefined, 'should not have correlationId');
  });

  it('emits warn log to stdout', () => {
    const log = createLogger('mod');
    log.warn('caution');
    assert.equal(stdoutLines.length, 1);
    const entry = JSON.parse(stdoutLines[0]);
    assert.equal(entry.level, 'warn');
    assert.equal(entry.msg, 'caution');
  });

  it('emits error log to stderr', () => {
    const log = createLogger('mod');
    log.error('boom');
    assert.equal(stderrLines.length, 1);
    assert.equal(stdoutLines.length, 0);
    const entry = JSON.parse(stderrLines[0]);
    assert.equal(entry.level, 'error');
    assert.equal(entry.msg, 'boom');
  });

  it('includes Error details when extra is an Error', () => {
    const log = createLogger('mod');
    const err = new Error('test error');
    log.error('failed', err);
    const entry = JSON.parse(stderrLines[0]);
    assert.equal(entry.error, 'test error');
    assert.ok(entry.stack);
  });

  it('merges extra object into log entry', () => {
    const log = createLogger('mod');
    log.info('request', { method: 'GET', path: '/api/test' });
    const entry = JSON.parse(stdoutLines[0]);
    assert.equal(entry.method, 'GET');
    assert.equal(entry.path, '/api/test');
  });

  it('includes ISO timestamp', () => {
    const log = createLogger('mod');
    log.info('ts check');
    const entry = JSON.parse(stdoutLines[0]);
    // Should be a valid ISO date
    assert.ok(!isNaN(Date.parse(entry.ts)));
  });
});

describe('createContext', () => {
  let createContext;

  beforeEach(async () => {
    ({ createContext } = await import(`../utils/logger.mjs?t=${Date.now()}`));
    captureOutput();
  });

  afterEach(() => {
    restoreOutput();
  });

  it('returns object with correlationId and createLogger', () => {
    const ctx = createContext('req-123');
    assert.equal(ctx.correlationId, 'req-123');
    assert.equal(typeof ctx.createLogger, 'function');
  });

  it('generates a UUID when no id is provided', () => {
    const ctx = createContext();
    assert.ok(ctx.correlationId, 'should have a correlationId');
    // UUID v4 format: 8-4-4-4-12 hex chars
    assert.match(ctx.correlationId, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('bakes correlationId into every info log line', () => {
    const ctx = createContext('trace-abc');
    const log = ctx.createLogger('handler');
    log.info('processing');
    const entry = JSON.parse(stdoutLines[0]);
    assert.equal(entry.correlationId, 'trace-abc');
    assert.equal(entry.module, 'handler');
    assert.equal(entry.msg, 'processing');
  });

  it('bakes correlationId into warn log lines', () => {
    const ctx = createContext('trace-def');
    const log = ctx.createLogger('handler');
    log.warn('slow query');
    const entry = JSON.parse(stdoutLines[0]);
    assert.equal(entry.correlationId, 'trace-def');
    assert.equal(entry.level, 'warn');
  });

  it('bakes correlationId into error log lines (stderr)', () => {
    const ctx = createContext('trace-ghi');
    const log = ctx.createLogger('handler');
    log.error('crash');
    assert.equal(stderrLines.length, 1);
    const entry = JSON.parse(stderrLines[0]);
    assert.equal(entry.correlationId, 'trace-ghi');
    assert.equal(entry.level, 'error');
  });

  it('includes correlationId alongside Error details', () => {
    const ctx = createContext('trace-err');
    const log = ctx.createLogger('handler');
    log.error('failed', new Error('db timeout'));
    const entry = JSON.parse(stderrLines[0]);
    assert.equal(entry.correlationId, 'trace-err');
    assert.equal(entry.error, 'db timeout');
    assert.ok(entry.stack);
  });

  it('includes correlationId alongside extra object', () => {
    const ctx = createContext('trace-extra');
    const log = ctx.createLogger('handler');
    log.info('request', { status: 200 });
    const entry = JSON.parse(stdoutLines[0]);
    assert.equal(entry.correlationId, 'trace-extra');
    assert.equal(entry.status, 200);
  });

  it('multiple loggers from same context share the correlationId', () => {
    const ctx = createContext('shared-id');
    const log1 = ctx.createLogger('auth');
    const log2 = ctx.createLogger('db');
    log1.info('authenticated');
    log2.info('query ran');
    const entry1 = JSON.parse(stdoutLines[0]);
    const entry2 = JSON.parse(stdoutLines[1]);
    assert.equal(entry1.correlationId, 'shared-id');
    assert.equal(entry2.correlationId, 'shared-id');
    assert.equal(entry1.module, 'auth');
    assert.equal(entry2.module, 'db');
  });
});
