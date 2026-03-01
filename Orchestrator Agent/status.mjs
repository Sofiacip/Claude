#!/usr/bin/env node

// status.mjs — Quick status check for the Impact OS Agent queue
// Run with: npm run status

import { config } from 'dotenv';
import { ClickUpClient } from './clickup.mjs';

config();

const clickup = new ClickUpClient(
  process.env.CLICKUP_API_TOKEN,
  process.env.CLICKUP_LIST_ID || '901521692113',
  process.env.CLICKUP_WORKSPACE_ID || '9015743183'
);

async function main() {
  console.log('\n📊 Impact OS Agent Queue Status\n');

  const allStatuses = ['not started', 'in progress', 'ready for review', 'blocked', 'completed'];
  
  for (const status of allStatuses) {
    try {
      const tasks = await clickup.getTasks([status]);
      if (tasks.length > 0) {
        const icon = {
          'to do': '📋', 'open': '📋',
          'in progress': '🤖',
          'in review': '👀',
          'blocked': '🚫',
          'complete': '✅', 'done': '✅',
        }[status] || '•';

        console.log(`${icon} ${status.toUpperCase()} (${tasks.length})`);
        tasks.forEach(t => {
          const priority = t.priority?.priority ? `[${t.priority.priority}]` : '';
          console.log(`   ${priority} ${t.name}`);
        });
        console.log('');
      }
    } catch {
      // Status might not exist in this list — skip
    }
  }
}

main().catch(console.error);
