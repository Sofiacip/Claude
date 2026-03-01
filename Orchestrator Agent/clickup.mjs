// clickup.mjs — ClickUp API client for the Impact OS Agent
// Handles all interactions with ClickUp: fetching tasks, updating statuses, posting comments

const BASE_URL = 'https://api.clickup.com/api/v2';

export class ClickUpClient {
  constructor(apiToken, listId, workspaceId) {
    this.apiToken = apiToken;
    this.listId = listId;
    this.workspaceId = workspaceId;
  }

  async request(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
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

  // ─── Fetch Tasks ───────────────────────────────────────────────

  /**
   * Get all open tasks from the agent queue, ordered by priority then position.
   * Statuses that count as "ready for agent":
   *   - "to do" or "open" → ready to pick up
   * Statuses the agent sets:
   *   - "in progress" → agent is working on it
   *   - "in review" → agent finished, needs human review
   *   - "complete" / "done" → agent finished and QA passed
   *   - "blocked" → agent failed after retries
   */
  async getNextTask() {
    const tasks = await this.getTasks(['to do', 'open', 'not started']);
    if (tasks.length === 0) return null;

    // Sort by priority (1=urgent, 2=high, 3=normal, 4=low, null=none)
    // Then by date_created (oldest first = FIFO)
    tasks.sort((a, b) => {
      const pa = a.priority?.orderindex ?? 99;
      const pb = b.priority?.orderindex ?? 99;
      if (pa !== pb) return pa - pb;
      return parseInt(a.date_created) - parseInt(b.date_created);
    });

    return tasks[0];
  }

  async getTasks(statuses = []) {
    const params = new URLSearchParams();
    params.set('archived', 'false');
    params.set('include_closed', 'false');
    params.set('subtasks', 'true');
    statuses.forEach(s => params.append('statuses[]', s));

    const data = await this.request(`/list/${this.listId}/task?${params}`);
    return data.tasks || [];
  }

  async getTask(taskId) {
    return this.request(`/task/${taskId}`);
  }

  // ─── Update Tasks ──────────────────────────────────────────────

  async updateTaskStatus(taskId, status) {
    return this.request(`/task/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  async addComment(taskId, text) {
    return this.request(`/task/${taskId}/comment`, {
      method: 'POST',
      body: JSON.stringify({
        comment_text: text,
        notify_all: false,
      }),
    });
  }

  async addTagToTask(taskId, tagName) {
    return this.request(`/task/${taskId}/tag/${tagName}`, {
      method: 'POST',
    });
  }

  // ─── Get Ready Tasks (all tasks ready for the agent) ───────────

  async getReadyTasks() {
    const tasks = await this.getTasks(['to do', 'open', 'not started']);

    // Sort by priority, then by date_created (FIFO within priority)
    tasks.sort((a, b) => {
      const pa = a.priority?.orderindex ?? 99;
      const pb = b.priority?.orderindex ?? 99;
      if (pa !== pb) return pa - pb;
      return parseInt(a.date_created) - parseInt(b.date_created);
    });

    return tasks;
  }

  // ─── Create Task (for the planning agent) ──────────────────────

  async createTask({ name, description, priority = 3, tags = [], status = 'not started' }) {
    const body = {
      name,
      description,
      status,
      priority,
    };

    if (tags.length > 0) {
      body.tags = tags;
    }

    return this.request(`/list/${this.listId}/task`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // ─── Bulk operations ──────────────────────────────────────────

  async createTasks(taskList) {
    const results = [];
    for (const task of taskList) {
      try {
        const created = await this.createTask(task);
        results.push({ success: true, task: created });
        // Rate limiting: 300ms between requests
        await new Promise(r => setTimeout(r, 300));
      } catch (err) {
        results.push({ success: false, error: err.message, taskName: task.name });
      }
    }
    return results;
  }

  // ─── Get All Tasks (any status, for reporter) ─────────────────

  async getAllTasks() {
    const params = new URLSearchParams();
    params.set('archived', 'false');
    params.set('include_closed', 'true');
    params.set('subtasks', 'true');

    const data = await this.request(`/list/${this.listId}/task?${params}`);
    return data.tasks || [];
  }

  // ─── Attachments ─────────────────────────────────────────────

  async uploadAttachment(taskId, fileBuffer, fileName) {
    const form = new FormData();
    form.append('attachment', new Blob([fileBuffer]), fileName);

    const res = await fetch(`${BASE_URL}/task/${taskId}/attachment`, {
      method: 'POST',
      headers: {
        'Authorization': this.apiToken,
      },
      body: form,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`ClickUp attachment upload failed ${res.status}: ${body}`);
    }

    return res.json();
  }

  // ─── Helpers ───────────────────────────────────────────────────

  formatTaskForPrompt(task) {
    const parts = [
      `## Task: ${task.name}`,
      `- **ID:** ${task.id}`,
      `- **Priority:** ${task.priority?.priority || 'none'}`,
    ];

    if (task.description) {
      parts.push(`\n### Description\n${task.description}`);
    }

    if (task.tags?.length) {
      parts.push(`- **Tags:** ${task.tags.map(t => t.name).join(', ')}`);
    }

    // Include checklist items as sub-tasks / acceptance criteria
    if (task.checklists?.length) {
      parts.push('\n### Acceptance Criteria');
      for (const cl of task.checklists) {
        for (const item of cl.items) {
          const check = item.resolved ? '✅' : '☐';
          parts.push(`${check} ${item.name}`);
        }
      }
    }

    return parts.join('\n');
  }
}
