// slack.mjs — Slack notification client for the orchestrator agent

export class SlackClient {
  constructor(botToken, channelId) {
    this.botToken = botToken;
    this.channelId = channelId;
    this.enabled = !!(botToken && channelId);
  }

  /**
   * Post a message to the agent Slack channel.
   * Returns { ts, channel } on success so callers can track threads.
   * Silently returns null if Slack is not configured or on failure.
   */
  async post(text) {
    if (!this.enabled) return null;

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
        return null;
      }
      return { ts: data.ts, channel: data.channel };
    } catch (err) {
      console.warn(`⚠️ Slack notification failed: ${err.message}`);
      // Never throw — Slack failures should not block the agent
      return null;
    }
  }

  /**
   * Post a rich message with blocks (for formatted reports).
   */
  async postReport({ title, body, type = 'phase' }) {
    if (!this.enabled) return null;

    const emoji = type === 'milestone' ? '🎉' : '📋';

    // Slack has a 3000 char limit per text block, so truncate if needed
    const truncatedBody = body.length > 2800
      ? body.slice(0, 2800) + '\n\n_(Full report in ClickUp)_'
      : body;

    const text = `${emoji} *${title}*\n\n${truncatedBody}`;
    return await this.post(text);
  }

  /**
   * Post a short status update (task started, completed, blocked).
   */
  async postStatus(message) {
    return await this.post(message);
  }

  /**
   * Read human replies from a Slack thread.
   * Returns the concatenated text of all non-bot replies, or null on failure.
   * @param {string} threadTs — the parent message timestamp
   */
  async readThreadReplies(threadTs) {
    if (!this.enabled || !threadTs) return null;

    try {
      const url = new URL('https://slack.com/api/conversations.replies');
      url.searchParams.set('channel', this.channelId);
      url.searchParams.set('ts', threadTs);
      url.searchParams.set('limit', '100');

      const response = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${this.botToken}` },
      });

      const data = await response.json();
      if (!data.ok) {
        console.warn(`⚠️ Slack thread read failed: ${data.error}`);
        return null;
      }

      // Filter to human replies only (skip the parent message and bot messages)
      const replies = (data.messages || []).filter(msg =>
        msg.ts !== threadTs && !msg.bot_id && !msg.app_id
      );

      if (replies.length === 0) return null;

      return replies.map(msg => msg.text).join('\n\n');
    } catch (err) {
      console.warn(`⚠️ Slack thread read failed: ${err.message}`);
      return null;
    }
  }
}
