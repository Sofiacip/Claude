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
          text,
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
