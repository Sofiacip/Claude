// logger.mjs — Simple structured logger for the agent

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

export class Logger {
  constructor(level = 'info') {
    this.level = LEVELS[level] ?? 1;
  }

  _log(level, icon, ...args) {
    if (LEVELS[level] >= this.level) {
      const timestamp = new Date().toISOString().slice(11, 19);
      console.log(`${timestamp} ${icon}`, ...args);
    }
  }

  debug(...args) { this._log('debug', '🔍', ...args); }
  info(...args)  { this._log('info',  'ℹ️ ', ...args); }
  warn(...args)  { this._log('warn',  '⚠️ ', ...args); }
  error(...args) { this._log('error', '❌', ...args); }

  task(name)     { this._log('info', '📋', `Task: ${name}`); }
  success(msg)   { this._log('info', '✅', msg); }
  working(msg)   { this._log('info', '🤖', msg); }
  waiting(msg)   { this._log('info', '⏳', msg); }
}
