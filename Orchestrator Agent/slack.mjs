// slack.mjs — Slack notification client for the orchestrator agent

const APPROVAL_PATTERNS = /^\s*(approved?|yes|lgtm|go|ship it|proceed)\s*[.!]?\s*$/i;

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
      return null;
    }
  }

  /**
   * Post a reply in a thread.
   * Returns { ts, channel } on success.
   */
  async postThreadReply(threadTs, text) {
    if (!this.enabled || !threadTs) return null;

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
          thread_ts: threadTs,
          unfurl_links: false,
        }),
      });

      const data = await response.json();
      if (!data.ok) {
        console.warn(`⚠️ Slack thread reply failed: ${data.error}`);
        return null;
      }
      return { ts: data.ts, channel: data.channel };
    } catch (err) {
      console.warn(`⚠️ Slack thread reply failed: ${err.message}`);
      return null;
    }
  }

  /**
   * Post a rich message with blocks (for formatted reports).
   */
  async postReport({ title, body, type = 'phase' }) {
    if (!this.enabled) return null;

    const emoji = type === 'milestone' ? '🎉' : '📋';

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
   * Returns the concatenated text of all non-bot replies, or null if none.
   * @param {string} threadTs — the parent message timestamp
   * @param {string} [afterTs] — only return replies newer than this timestamp
   */
  async readThreadReplies(threadTs, afterTs = null) {
    if (!this.enabled || !threadTs) return null;

    try {
      const url = new URL('https://slack.com/api/conversations.replies');
      url.searchParams.set('channel', this.channelId);
      url.searchParams.set('ts', threadTs);
      url.searchParams.set('limit', '100');
      if (afterTs) url.searchParams.set('oldest', afterTs);

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

  /**
   * Check if a text string is an approval message.
   */
  static isApproval(text) {
    return APPROVAL_PATTERNS.test(text || '');
  }

  /**
   * Poll a Slack thread for human replies.
   * Returns the reply text when found, or null on timeout.
   * @param {string} threadTs — the parent message timestamp
   * @param {object} opts
   * @param {string} [opts.afterTs] — only look for replies after this ts
   * @param {number} [opts.intervalMs=30000] — polling interval
   * @param {Function} [opts.onPoll] — called each poll cycle for logging
   * @param {Function} [opts.filter] — if set, only return when filter(replyText) is truthy
   */
  async pollThreadReplies(threadTs, { afterTs = null, intervalMs = 30_000, onPoll = null, filter = null } = {}) {
    if (!this.enabled || !threadTs) return null;

    while (true) {
      if (onPoll) await onPoll();

      const text = await this.readThreadReplies(threadTs, afterTs);
      if (text) {
        if (!filter || filter(text)) return text;
      }

      await new Promise(r => setTimeout(r, intervalMs));
    }
  }
}
