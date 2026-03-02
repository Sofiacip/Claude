// scheduler.mjs — Parallel execution scheduler with dependency resolution

const MODULE_MAP = {
  'web designer':    'Web Designer',
  'webdesigner':     'Web Designer',
  'funnel designer': 'funnel-designer',
  'funnel':          'funnel-designer',
  'copywriter':      'Copywriter',
  'copy':            'Copywriter',
  'copywriter-ui':   'copywriter-ui',
  'brand creator':   'brand creator',
  'brand':           'brand creator',
  'doc factory':     'doc factory',
  'docs':            'doc factory',
  'pageforge':       'pageforge',
  'bug-reporter':    'bug-reporter',
  'bug':             'bug-reporter',
  'platform':        'bug-reporter',
  'ux/ui':           'bug-reporter',
};

export class Scheduler {
  constructor({ maxParallel = 3 } = {}) {
    this.maxParallel = maxParallel;
    this.activeTasks = new Map();  // taskId → { module, promise }
    this.lockedModules = new Set(); // Module names currently being worked on
  }

  /**
   * Given a list of ready tasks, return which ones can be dispatched RIGHT NOW.
   * Respects: concurrency limit, module locking.
   */
  getDispatchable(readyTasks) {
    const available = this.maxParallel - this.activeTasks.size;
    if (available <= 0) return [];

    // Filter out tasks whose module is currently locked
    const unlocked = readyTasks.filter(task => {
      const module = this.detectModule(task);
      return !this.lockedModules.has(module);
    });

    // Return up to `available` tasks, prioritized
    return unlocked.slice(0, available);
  }

  /**
   * Mark a task as started. Locks its module.
   */
  startTask(taskId, moduleName, promise) {
    this.activeTasks.set(taskId, { module: moduleName, promise });
    this.lockedModules.add(moduleName);
  }

  /**
   * Mark a task as finished. Unlocks its module.
   */
  finishTask(taskId) {
    const entry = this.activeTasks.get(taskId);
    if (entry) {
      this.lockedModules.delete(entry.module);
      this.activeTasks.delete(taskId);
    }
  }

  /**
   * Wait for at least one active task to finish.
   * Returns the result of the first task that completes.
   */
  async waitForAny() {
    if (this.activeTasks.size === 0) return null;

    const entries = Array.from(this.activeTasks.entries());
    const promises = entries.map(([taskId, { promise }]) =>
      promise.then(result => ({ taskId, result }))
    );

    return Promise.race(promises);
  }

  /**
   * Wait for ALL active tasks to finish.
   * Returns array of { taskId, result }.
   */
  async waitForAll() {
    if (this.activeTasks.size === 0) return [];

    const entries = Array.from(this.activeTasks.entries());
    const results = await Promise.allSettled(
      entries.map(([taskId, { promise }]) =>
        promise.then(result => ({ taskId, result }))
      )
    );

    return results.map(r => r.status === 'fulfilled' ? r.value : { taskId: 'unknown', result: { success: false, summary: r.reason?.message } });
  }

  get activeCount() {
    return this.activeTasks.size;
  }

  get isAtCapacity() {
    return this.activeTasks.size >= this.maxParallel;
  }

  /**
   * Detect which module a task belongs to (duplicates executor logic for scheduling).
   */
  detectModule(task) {
    // Check tags first
    if (task.tags?.length) {
      for (const tag of task.tags) {
        const key = tag.name?.toLowerCase() || tag.toLowerCase();
        if (MODULE_MAP[key]) return MODULE_MAP[key];
      }
    }

    // Check name and description
    const text = `${task.name} ${task.description || ''}`.toLowerCase();
    for (const [keyword, module] of Object.entries(MODULE_MAP)) {
      if (text.includes(keyword)) return module;
    }

    return 'unknown';
  }
}
