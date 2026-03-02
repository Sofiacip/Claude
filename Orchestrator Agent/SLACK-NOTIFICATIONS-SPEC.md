# Slack Notifications — Build Spec

> **What this is:** Add Slack notifications to reporter.mjs so phase summaries and milestone reports are posted to #agent-impact-os automatically.
>
> **Slack channel:** #agent-impact-os (ID: C0AHT5H0EGN)
> **Slack workspace:** scaleforimpact.slack.com
>
> **Approach:** Use the Slack Web API with a bot token to post messages. No new npm dependencies — use Node.js built-in fetch.

---

## Environment Variable

Add to `.env`:

```
SLACK_BOT_TOKEN=xoxb-xxxxx
SLACK_CHANNEL_ID=C0AHT5H0EGN
```

Add to `.env.example`:

```
# Slack notifications (optional — reports still go to ClickUp without this)
SLACK_BOT_TOKEN=
SLACK_CHANNEL_ID=C0AHT5H0EGN
```

---

## New File: slack.mjs

```javascript
// slack.mjs — Slack notification client for the orchestrator agent

export class SlackClient {
  constructor(botToken, channelId) {
    this.botToken = botToken;
    this.channelId = channelId;
    this.enabled = !!(botToken && channelId);
  }

  /**
   * Post a message to the agent Slack channel.
   * Silently skips if Slack is not configured.
   */
  async post(text) {
    if (!this.enabled) return;

    try {
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: this.channelId,
          text: text,
          unfurl_links: false,
        }),
      });

      const data = await response.json();
      if (!data.ok) {
        console.warn(`⚠️ Slack notification failed: ${data.error}`);
      }
    } catch (err) {
      console.warn(`⚠️ Slack notification failed: ${err.message}`);
      // Never throw — Slack failures should not block the agent
    }
  }

  /**
   * Post a rich message with blocks (for formatted reports).
   */
  async postReport({ title, body, type = 'phase' }) {
    if (!this.enabled) return;

    const emoji = type === 'milestone' ? '🎉' : '📋';
    
    // Slack has a 3000 char limit per text block, so truncate if needed
    const truncatedBody = body.length > 2800 
      ? body.slice(0, 2800) + '\n\n_(Full report in ClickUp)_'
      : body;

    const text = `${emoji} *${title}*\n\n${truncatedBody}`;
    await this.post(text);
  }

  /**
   * Post a short status update (task started, completed, blocked).
   */
  async postStatus(message) {
    await this.post(message);
  }
}
```

---

## Reporter.mjs Changes

Add Slack integration to the reporter. After posting to ClickUp, also post to Slack.

### Constructor — accept slack client:

```javascript
constructor(clickup, memory, projectPath, slack = null) {
  this.clickup = clickup;
  this.memory = memory;
  this.projectPath = projectPath;
  this.slack = slack;
}
```

### After creating the phase summary ClickUp task, add:

```javascript
// Post to Slack
if (this.slack) {
  await this.slack.postReport({
    title: `Phase ${phaseInfo.phase} Summary: ${phaseInfo.planName}`,
    body: report,
    type: 'phase',
  });
}
```

### After creating the final milestone ClickUp task, add:

```javascript
// Post to Slack
if (this.slack) {
  await this.slack.postReport({
    title: `COMPLETE: ${planId} — All Phases Done`,
    body: finalReport,
    type: 'milestone',
  });
}
```

---

## AutoPilot.mjs Changes

Add Slack notification when auto-pilot makes a decision and when it completes.

### Constructor — accept slack client:

```javascript
constructor({ planner, memory, clickup, visionDocPath, projectPath, slack = null }) {
  // ... existing ...
  this.slack = slack;
}
```

### After planning the next chunk, add:

```javascript
// Notify Slack
if (this.slack) {
  await this.slack.postStatus(
    `🧭 *Auto-pilot decision:* ${decision.next}\n_Reason: ${decision.reason}_\n_Module: ${decision.module}_\n\n${result.tasksCreated} tasks created in ClickUp.`
  );
}
```

### When all vision work is complete, add:

```javascript
// Notify Slack
if (this.slack) {
  await this.slack.postReport({
    title: 'AUTO-PILOT: All Vision Work Complete',
    body: decision.summary,
    type: 'milestone',
  });
}
```

---

## Agent.mjs Changes

### Import and initialize:

```javascript
import { SlackClient } from './slack.mjs';

// After loading .env:
const slack = new SlackClient(
  process.env.SLACK_BOT_TOKEN,
  process.env.SLACK_CHANNEL_ID
);

// Pass to reporter:
const reporter = new Reporter(clickup, memory, CONFIG.projectPath, slack);

// Pass to autopilot:
const autopilot = new AutoPilot({
  planner, memory, clickup, slack,
  visionDocPath: CONFIG.visionDocPath,
  projectPath: CONFIG.projectPath,
});
```

### Optional: Add task-level notifications

For visibility into individual tasks (not just phase summaries), add these to the processTask function:

```javascript
// When a task is picked up:
if (slack.enabled) {
  await slack.postStatus(`🤖 Working on: *${task.name}* (${moduleName})`);
}

// When a task completes:
if (slack.enabled && result.success) {
  await slack.postStatus(`✅ Completed: *${task.name}*`);
}

// When a task is blocked:
if (slack.enabled && !result.success) {
  await slack.postStatus(`❌ Blocked: *${task.name}*\n_${result.summary?.slice(0, 200)}_`);
}
```

NOTE: This will generate a lot of messages (one per task). If that's too noisy, skip the task-level notifications and only keep the phase summaries and autopilot decisions. The founder can always check ClickUp for task-level detail.

---

## Slack Bot Token Setup

The agent needs a Slack bot token to post messages. Here's how to get one:

1. Go to https://api.slack.com/apps
2. Click "Create New App" → "From scratch"
3. Name: "Impact OS Agent", Workspace: Scale for Impact
4. Go to "OAuth & Permissions"
5. Under "Bot Token Scopes", add: `chat:write`
6. Click "Install to Workspace" and authorize
7. Copy the "Bot OAuth Token" (starts with `xoxb-`)
8. Add it to `.env` on the VPS as `SLACK_BOT_TOKEN=xoxb-xxxxx`
9. In Slack, invite the bot to #agent-impact-os: type `/invite @Impact OS Agent` in the channel

---

## Acceptance Criteria

- [ ] Phase summary reports are posted to #agent-impact-os
- [ ] Milestone reports (all phases complete) are posted to #agent-impact-os
- [ ] Auto-pilot decisions are posted to #agent-impact-os
- [ ] Long reports are truncated at 2800 chars with a "Full report in ClickUp" note
- [ ] Slack failures never crash the agent — they log a warning and continue
- [ ] Slack is optional — if SLACK_BOT_TOKEN is not set, everything works without it
- [ ] Reports still go to ClickUp regardless of Slack configuration
