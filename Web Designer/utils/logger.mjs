/**
 * Structured JSON logger for Web Designer modules.
 *
 * Usage:
 *   import { createLogger, createContext } from './utils/logger.mjs';
 *   const log = createLogger('serve');
 *   log.info('Server started', { port: 3000 });
 *   log.error('Request failed', err);
 *
 *   // With correlation ID for request tracing:
 *   const reqLog = createContext(crypto.randomUUID()).createLogger('serve');
 *   reqLog.info('Handling request'); // includes correlationId in output
 */

import crypto from 'node:crypto';

const LEVELS = { error: 0, warn: 1, info: 2 };

const configuredLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();
const threshold = LEVELS[configuredLevel] ?? LEVELS.info;

function emit(level, module, msg, extra, correlationId) {
  if (LEVELS[level] > threshold) return;

  const entry = { ts: new Date().toISOString(), level, module };
  if (correlationId) entry.correlationId = correlationId;
  entry.msg = msg;

  if (extra instanceof Error) {
    entry.error = extra.message;
    entry.stack = extra.stack;
  } else if (extra !== undefined) {
    Object.assign(entry, extra);
  }

  const line = JSON.stringify(entry);
  if (level === 'error') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

export function createLogger(module) {
  return {
    info:  (msg, extra) => emit('info',  module, msg, extra),
    warn:  (msg, extra) => emit('warn',  module, msg, extra),
    error: (msg, extra) => emit('error', module, msg, extra),
  };
}

export function createContext(id) {
  const correlationId = id || crypto.randomUUID();
  return {
    correlationId,
    createLogger(module) {
      return {
        info:  (msg, extra) => emit('info',  module, msg, extra, correlationId),
        warn:  (msg, extra) => emit('warn',  module, msg, extra, correlationId),
        error: (msg, extra) => emit('error', module, msg, extra, correlationId),
      };
    },
  };
}
