// clickup.mjs — ClickUp API client for bug reporter
// Creates tasks with structured descriptions and uploads attachments

import { readFileSync } from 'node:fs';

const BASE_URL = 'https://api.clickup.com/api/v2';

const PRIORITY_MAP = { critical: 1, high: 2, medium: 3, low: 4 };
const SEVERITY_LABEL = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };

function formatModuleName(slug) {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function buildBugDescription({ moduleName, severity, description, reporter, hasScreenshot }) {
  const lines = [
    '## Bug Report',
    '',
    `**Module:** ${formatModuleName(moduleName)}`,
    `**Severity:** ${SEVERITY_LABEL[severity] || severity}`,
    `**Reported by:** ${reporter || 'Anonymous'}`,
    `**Date:** ${new Date().toISOString()}`,
    '',
    '---',
    '',
    '## Description',
    '',
    description,
  ];

  if (hasScreenshot) {
    lines.push('', '---', '', '📎 Screenshot attached');
  }

  return lines.join('\n');
}

function buildBugTaskName(moduleName, description) {
  const displayName = formatModuleName(moduleName);
  const truncated = description.length > 60 ? description.slice(0, 57) + '...' : description;
  return `[Bug][${displayName}] ${truncated}`;
}

export class ClickUpClient {
  constructor(apiToken, listId) {
    this.apiToken = apiToken;
    this.listId = listId;
  }

  async request(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        'Authorization': this.apiToken,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`ClickUp API error ${res.status}: ${body}`);
    }

    return res.json();
  }

  async createTask({ name, description, priority = 3, tags = [], status = 'not started' }) {
    const body = { name, description, status, priority };
    if (tags.length > 0) body.tags = tags;

    return this.request(`/list/${this.listId}/task`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Create a bug report task with structured description template.
   * @param {Object} params
   * @param {string} params.moduleName - Module slug (e.g. "web-designer")
   * @param {string} [params.title] - User-provided title (used for task name if present)
   * @param {string} params.description - Full bug description
   * @param {string} params.severity - critical | high | medium | low
   * @param {string} [params.reporter] - Reporter name (defaults to 'Anonymous')
   * @param {boolean} [params.hasScreenshot] - Whether a screenshot will be attached
   */
  async createBugReport({ moduleName, moduleTag, title, description, severity = 'medium', reporter, hasScreenshot = false }) {
    const name = title ? `Bug: ${title}` : buildBugTaskName(moduleName, description);
    const body = buildBugDescription({ moduleName, severity, description, reporter, hasScreenshot });
    const clickupPriority = PRIORITY_MAP[severity] ?? 3;
    const tags = [moduleTag || moduleName, 'bug-report'];

    return this.createTask({
      name,
      description: body,
      priority: clickupPriority,
      tags,
      status: 'not started',
    });
  }

  async attachFile(taskId, filePath, fileName) {
    const fileBuffer = readFileSync(filePath);
    const form = new FormData();
    form.append('attachment', new Blob([fileBuffer]), fileName);

    const res = await fetch(`${BASE_URL}/task/${taskId}/attachment`, {
      method: 'POST',
      headers: { 'Authorization': this.apiToken },
      body: form,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`ClickUp attachment upload failed ${res.status}: ${body}`);
    }

    return res.json();
  }
}

export { PRIORITY_MAP, SEVERITY_LABEL, formatModuleName, buildBugDescription, buildBugTaskName };
