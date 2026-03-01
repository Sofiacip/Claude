// memory.mjs — Persistent memory for the Impact OS Agent

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

const MEMORY_PATH = path.join(process.cwd(), 'data', 'memory.json');

export class Memory {
  constructor() {
    this.data = this.load();
  }

  // ─── Load / Save ──────────────────────────────────────────────

  load() {
    if (!existsSync(MEMORY_PATH)) {
      const defaultMemory = {
        version: 1,
        lastUpdated: new Date().toISOString(),
        taskHistory: {},
        modules: {},
        errorPatterns: {},
        activeWork: {},
      };
      this.save(defaultMemory);
      return defaultMemory;
    }

    try {
      return JSON.parse(readFileSync(MEMORY_PATH, 'utf-8'));
    } catch {
      console.warn('⚠️ Corrupted memory.json — starting fresh');
      return { version: 1, lastUpdated: new Date().toISOString(), taskHistory: {}, modules: {}, errorPatterns: {}, activeWork: {} };
    }
  }

  save(data = null) {
    const dir = path.dirname(MEMORY_PATH);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    if (data) this.data = data;
    this.data.lastUpdated = new Date().toISOString();
    writeFileSync(MEMORY_PATH, JSON.stringify(this.data, null, 2));
  }

  // ─── Task History ─────────────────────────────────────────────

  recordTaskStart(taskId, taskName, moduleName) {
    this.data.activeWork[taskId] = {
      taskId,
      startedAt: new Date().toISOString(),
      module: moduleName,
      pid: process.pid,
    };
    this.save();
  }

  recordTaskComplete(taskId, result) {
    const active = this.data.activeWork[taskId];

    this.data.taskHistory[taskId] = {
      taskId,
      name: result.taskName || taskId,
      module: result.module || 'unknown',
      status: result.success ? 'completed' : 'failed',
      attempts: result.attempts,
      startedAt: active?.startedAt || new Date().toISOString(),
      completedAt: new Date().toISOString(),
      approach: result.summary,
      filesChanged: result.filesChanged || [],
      errors: result.errors || [],
      qaResults: result.qaResults || null,
    };

    delete this.data.activeWork[taskId];

    // Update module health
    if (result.module) {
      this.updateModuleHealth(result.module, result);
    }

    this.save();
  }

  recordTaskBlocked(taskId, taskName, moduleName, reason) {
    this.data.taskHistory[taskId] = {
      taskId,
      name: taskName,
      module: moduleName,
      status: 'blocked',
      blockedAt: new Date().toISOString(),
      blockedReason: reason,
    };
    delete this.data.activeWork[taskId];
    this.save();
  }

  // ─── Module Health ────────────────────────────────────────────

  updateModuleHealth(moduleName, result) {
    if (!this.data.modules[moduleName]) {
      this.data.modules[moduleName] = {
        path: result.modulePath || '',
        lastTaskAt: null,
        healthStatus: 'healthy',
        lastBuildPassed: true,
        lastTestPassed: true,
        knownIssues: [],
        recentErrors: [],
      };
    }

    const mod = this.data.modules[moduleName];
    mod.lastTaskAt = new Date().toISOString();

    if (result.qaResults) {
      mod.lastBuildPassed = result.qaResults.build !== false;
      mod.lastTestPassed = result.qaResults.test !== false;
    }

    if (!result.success) {
      mod.recentErrors.push({
        taskId: result.taskId,
        error: result.summary,
        at: new Date().toISOString(),
      });
      // Keep only last 10 errors
      mod.recentErrors = mod.recentErrors.slice(-10);
    }

    // Determine health status
    if (mod.lastBuildPassed && mod.lastTestPassed) {
      mod.healthStatus = 'healthy';
    } else if (mod.lastBuildPassed) {
      mod.healthStatus = 'degraded';
    } else {
      mod.healthStatus = 'broken';
    }
  }

  // ─── Error Patterns ──────────────────────────────────────────

  recordError(category, error, resolution = null) {
    if (!this.data.errorPatterns[category]) {
      this.data.errorPatterns[category] = {
        count: 0,
        lastSeen: null,
        commonFix: null,
      };
    }
    const pattern = this.data.errorPatterns[category];
    pattern.count++;
    pattern.lastSeen = new Date().toISOString();
    if (resolution) pattern.commonFix = resolution;
    this.save();
  }

  getErrorContext(category) {
    return this.data.errorPatterns[category] || null;
  }

  // ─── Context for Prompts ──────────────────────────────────────

  getContextForTask(moduleName) {
    const mod = this.data.modules[moduleName];
    if (!mod) return '';

    const lines = [`<memory_context>`];
    lines.push(`Module "${moduleName}" health: ${mod.healthStatus}`);

    if (mod.recentErrors.length > 0) {
      lines.push(`\nRecent errors in this module:`);
      for (const err of mod.recentErrors.slice(-3)) {
        lines.push(`- ${err.error} (${err.at})`);
      }
    }

    if (mod.knownIssues.length > 0) {
      lines.push(`\nKnown issues:`);
      for (const issue of mod.knownIssues) {
        lines.push(`- ${issue}`);
      }
    }

    lines.push(`</memory_context>`);
    return lines.join('\n');
  }

  // ─── Crash Recovery ───────────────────────────────────────────

  getOrphanedTasks() {
    return Object.keys(this.data.activeWork);
  }

  clearOrphanedTask(taskId) {
    delete this.data.activeWork[taskId];
    this.save();
  }

  // ─── Query ────────────────────────────────────────────────────

  hasTaskBeenAttempted(taskId) {
    return !!this.data.taskHistory[taskId];
  }

  getTaskHistory(taskId) {
    return this.data.taskHistory[taskId] || null;
  }

  getModuleHealth(moduleName) {
    return this.data.modules[moduleName] || null;
  }

  // ─── Phase Tracking ────────────────────────────────────────────

  /**
   * Initialize phase tracking for a plan (called by planner after creating tasks).
   */
  initPlan(planId, planName, phases) {
    if (!this.data.phases) this.data.phases = {};

    this.data.phases[planId] = {
      name: planName,
      totalPhases: Object.keys(phases).length,
      createdAt: new Date().toISOString(),
      tasks: {},
    };

    for (const [phaseNum, taskIds] of Object.entries(phases)) {
      this.data.phases[planId].tasks[phaseNum] = {
        taskIds,
        completed: [],
        reported: false,
        reportTaskId: null,
      };
    }

    this.save();
  }

  /**
   * Register a task as belonging to a phase (auto-creates structure if needed).
   */
  registerPhaseTask(planId, phase, taskId) {
    if (!this.data.phases) this.data.phases = {};
    if (!this.data.phases[planId]) {
      this.data.phases[planId] = {
        name: planId,
        totalPhases: 0,
        createdAt: new Date().toISOString(),
        tasks: {},
      };
    }
    if (!this.data.phases[planId].tasks[phase]) {
      this.data.phases[planId].tasks[phase] = {
        taskIds: [],
        completed: [],
        reported: false,
        reportTaskId: null,
      };
      this.data.phases[planId].totalPhases = Object.keys(this.data.phases[planId].tasks).length;
    }

    const phaseData = this.data.phases[planId].tasks[phase];
    if (!phaseData.taskIds.includes(taskId)) {
      phaseData.taskIds.push(taskId);
      this.save();
    }
  }

  markPhaseTaskComplete(planId, phase, taskId) {
    const phaseData = this.data.phases?.[planId]?.tasks?.[phase];
    if (!phaseData) return;

    if (!phaseData.completed.includes(taskId)) {
      phaseData.completed.push(taskId);
      this.save();
    }
  }

  markPhaseReported(planId, phase, reportTaskId) {
    const phaseData = this.data.phases?.[planId]?.tasks?.[phase];
    if (!phaseData) return;

    phaseData.reported = true;
    phaseData.reportTaskId = reportTaskId;
    this.save();
  }

  getPhaseData(planId, phase) {
    return this.data.phases?.[planId]?.tasks?.[phase] || null;
  }

  getAllPhases(planId) {
    return this.data.phases?.[planId]?.tasks || null;
  }

  getPlanName(planId) {
    return this.data.phases?.[planId]?.name || planId;
  }

  // ─── Auto-Pilot Tracking ──────────────────────────────────────

  recordAutopilotDecision(decision) {
    if (!this.data.autopilot) this.data.autopilot = { decisions: [] };
    this.data.autopilot.decisions.push({
      ...decision,
      timestamp: new Date().toISOString(),
    });
    this.save();
  }

  getAutopilotHistory() {
    return this.data.autopilot?.decisions || [];
  }

  getCompletedPlans() {
    if (!this.data.phases) return [];

    const completed = [];
    for (const [planId, plan] of Object.entries(this.data.phases)) {
      const allPhases = Object.values(plan.tasks || {});
      const allDone = allPhases.length > 0 && allPhases.every(p =>
        p.reported || (p.taskIds.length > 0 && p.taskIds.every(id => p.completed.includes(id)))
      );

      if (allDone) {
        const totalTasks = allPhases.reduce((sum, p) => sum + p.taskIds.length, 0);
        const totalCompleted = allPhases.reduce((sum, p) => sum + p.completed.length, 0);
        completed.push({
          name: plan.name || planId,
          planId,
          tasksCompleted: totalCompleted,
          totalTasks,
        });
      }
    }
    return completed;
  }

  getAllModuleHealth() {
    return this.data.modules || {};
  }

  isTagReported(tag) {
    return !!(this.data.reportedTags?.[tag]);
  }

  getTaskStats() {
    const history = this.data.taskHistory || {};
    const tasks = Object.values(history);
    return {
      total: tasks.length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      blocked: tasks.filter(t => t.status === 'blocked').length,
    };
  }
}
