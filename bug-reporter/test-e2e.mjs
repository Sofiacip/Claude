/**
 * test-e2e.mjs — End-to-end test for the bug reporter flow.
 * Submits a bug report through the server API, verifies the ClickUp task
 * was created correctly (name, description, priority, tags, attachment),
 * then cleans up by deleting the test task.
 *
 * Prerequisites:
 *   - .env configured with valid CLICKUP_API_TOKEN and CLICKUP_LIST_ID
 *   - Server running on the configured port (default 3007)
 *   - OR pass --start-server flag to auto-start/stop the server
 *
 * Usage:
 *   node test-e2e.mjs                  # server must already be running
 *   node test-e2e.mjs --start-server   # auto-starts and stops the server
 */

import 'dotenv/config';
import { strict as assert } from 'node:assert';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3007');
const BASE_URL = `http://localhost:${PORT}`;
const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN;
const CLICKUP_BASE = 'https://api.clickup.com/api/v2';

if (!CLICKUP_API_TOKEN || CLICKUP_API_TOKEN === 'pk_xxxxx') {
  console.error('ERROR: CLICKUP_API_TOKEN is not set or is a placeholder. Update .env');
  process.exit(1);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

let serverProcess = null;
let createdTaskId = null;

async function clickupGet(endpoint) {
  const res = await fetch(`${CLICKUP_BASE}${endpoint}`, {
    headers: { 'Authorization': CLICKUP_API_TOKEN },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ClickUp GET ${endpoint} failed (${res.status}): ${body}`);
  }
  return res.json();
}

async function clickupDelete(endpoint) {
  const res = await fetch(`${CLICKUP_BASE}${endpoint}`, {
    method: 'DELETE',
    headers: { 'Authorization': CLICKUP_API_TOKEN },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ClickUp DELETE ${endpoint} failed (${res.status}): ${body}`);
  }
}

async function waitForServer(maxWait = 10000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) return;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`Server did not start within ${maxWait}ms`);
}

function createTestImage() {
  // Minimal 1x1 red PNG (68 bytes)
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
    'base64'
  );
  const path = join(tmpdir(), `e2e-test-screenshot-${Date.now()}.png`);
  writeFileSync(path, png);
  return path;
}

// ── Test runner ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    console.log(`  \u2713 ${name}`);
    passed++;
  } catch (err) {
    console.error(`  \u2717 ${name}`);
    console.error(`    ${err.message}`);
    failures.push({ name, error: err.message });
    failed++;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n  Bug Reporter — End-to-End Tests\n');

  // Optionally start the server
  const autoStart = process.argv.includes('--start-server');
  if (autoStart) {
    console.log('  Starting server...');
    serverProcess = spawn('node', ['server.js'], {
      cwd: __dirname,
      stdio: 'pipe',
      env: { ...process.env },
    });
    serverProcess.stderr.on('data', (d) => {
      const msg = d.toString().trim();
      if (msg) console.error(`  [server stderr] ${msg}`);
    });
  }

  try {
    await waitForServer();
    console.log(`  Server ready at ${BASE_URL}\n`);
  } catch {
    console.error(`  ERROR: Server not reachable at ${BASE_URL}`);
    console.error('  Start the server first: node server.js');
    console.error('  Or run with: node test-e2e.mjs --start-server\n');
    process.exit(1);
  }

  // ── Test 1: Health check ──────────────────────────────────────────────────

  await test('Server health check returns ok', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.service, 'bug-reporter');
  });

  // ── Test 2: Submit bug report ─────────────────────────────────────────────

  const testDescription = 'E2E test bug report — automated test from test-e2e.mjs. This task should be auto-deleted after verification.';
  let taskId, taskUrl;

  await test('Submit bug report creates ClickUp task', async () => {
    const res = await fetch(`${BASE_URL}/api/bug-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        module: 'web-designer',
        type: 'bug',
        title: 'E2E automated test — delete me',
        description: testDescription,
        priority: 'low',
      }),
    });

    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert.equal(data.success, true, 'Response success should be true');
    assert.ok(data.taskId, 'Response should include taskId');
    assert.ok(data.taskUrl, 'Response should include taskUrl');

    taskId = data.taskId;
    taskUrl = data.taskUrl;
    createdTaskId = taskId;
    console.log(`    Task created: ${taskId}`);
  });

  if (!taskId) {
    console.error('\n  FATAL: Bug report submission failed — cannot continue.\n');
    await cleanup();
    process.exit(1);
  }

  // ── Test 3: Upload screenshot attachment ──────────────────────────────────

  const screenshotPath = createTestImage();

  await test('Upload screenshot attachment to task', async () => {
    const formData = new FormData();
    const imgBuffer = (await import('node:fs')).readFileSync(screenshotPath);
    formData.append('screenshot', new Blob([imgBuffer], { type: 'image/png' }), 'e2e-test-screenshot.png');

    const res = await fetch(`${BASE_URL}/api/bug-report/${taskId}/attachment`, {
      method: 'POST',
      body: formData,
    });

    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert.equal(data.success, true, 'Attachment upload should succeed');
  });

  try { unlinkSync(screenshotPath); } catch {}

  // Give ClickUp a moment to process
  await new Promise(r => setTimeout(r, 2000));

  // ── Test 4: Verify task in ClickUp ────────────────────────────────────────

  let clickupTask;

  await test('ClickUp task exists and is fetchable', async () => {
    clickupTask = await clickupGet(`/task/${taskId}`);
    assert.ok(clickupTask, 'Task should be fetchable from ClickUp');
    assert.equal(clickupTask.id, taskId);
  });

  await test('Task name follows [Bug][Module] description format', async () => {
    assert.ok(clickupTask.name.startsWith('[Bug]'), `Name should start with [Bug], got: ${clickupTask.name}`);
    assert.ok(
      clickupTask.name.includes('Web Designer') || clickupTask.name.includes('web-designer'),
      `Name should include module name, got: ${clickupTask.name}`
    );
    assert.ok(clickupTask.name.includes('E2E test bug report'), `Name should include description, got: ${clickupTask.name}`);
  });

  await test('Task description contains full bug report text', async () => {
    const desc = clickupTask.description || clickupTask.text_content;
    assert.ok(desc.includes('## Bug Report'), 'Description should have Bug Report header');
    assert.ok(
      desc.includes('**Module:**'),
      'Description should include Module field'
    );
    assert.ok(
      desc.includes('**Severity:**') || desc.includes('**Priority:**'),
      'Description should include severity/priority field'
    );
    assert.ok(desc.includes(testDescription), 'Description should include full description text');
  });

  await test('Task has correct priority (4 = low)', async () => {
    const priority = clickupTask.priority;
    assert.ok(priority, 'Task should have a priority');
    assert.equal(priority.id, '4', `Priority should be 4 (low), got: ${priority.id}`);
  });

  await test('Task has module tag (web-designer)', async () => {
    const tagNames = (clickupTask.tags || []).map(t => t.name);
    assert.ok(tagNames.includes('web-designer'), `Tags should include 'web-designer', got: ${tagNames.join(', ')}`);
  });

  await test('Task has bug-report tag', async () => {
    const tagNames = (clickupTask.tags || []).map(t => t.name);
    assert.ok(tagNames.includes('bug-report'), `Tags should include 'bug-report', got: ${tagNames.join(', ')}`);
  });

  await test('Task is in the correct list (901521692113)', async () => {
    assert.ok(clickupTask.list, 'Task should have a list');
    assert.equal(clickupTask.list.id, '901521692113', `List should be 901521692113, got: ${clickupTask.list.id}`);
  });

  await test('Screenshot attachment is present on task', async () => {
    const attachments = clickupTask.attachments || [];
    assert.ok(attachments.length > 0, `Task should have at least 1 attachment, got ${attachments.length}`);
    const screenshotAtt = attachments.find(a => a.title?.includes('e2e-test-screenshot') || a.title?.includes('screenshot'));
    assert.ok(screenshotAtt, `Should find screenshot attachment, got: ${attachments.map(a => a.title).join(', ')}`);
  });

  // ── Test 5: Validation errors ─────────────────────────────────────────────

  await test('Returns 400 for missing required fields', async () => {
    const res = await fetch(`${BASE_URL}/api/bug-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.ok(data.error.includes('module is required'));
  });

  await test('Returns 400 for invalid module', async () => {
    const res = await fetch(`${BASE_URL}/api/bug-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module: 'nonexistent', title: 'test', description: 'test description here', priority: 'low' }),
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('module must be one of'));
  });

  await test('Returns 400 for short description', async () => {
    const res = await fetch(`${BASE_URL}/api/bug-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module: 'web-designer', title: 'test', description: 'short', priority: 'low' }),
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('at least 10 characters'));
  });

  // ── Cleanup ───────────────────────────────────────────────────────────────

  await cleanup();

  // ── Summary ───────────────────────────────────────────────────────────────

  console.log(`\n  ${passed} passed, ${failed} failed\n`);

  if (failures.length > 0) {
    console.log('  Failures:');
    for (const f of failures) {
      console.log(`    - ${f.name}: ${f.error}`);
    }
    console.log('');
  }

  process.exit(failed > 0 ? 1 : 0);
}

async function cleanup() {
  // Delete test task from ClickUp
  if (createdTaskId) {
    try {
      await clickupDelete(`/task/${createdTaskId}`);
      console.log(`\n  Cleaned up: deleted task ${createdTaskId} from ClickUp`);
      createdTaskId = null;
    } catch (err) {
      console.error(`\n  WARNING: Failed to delete test task ${createdTaskId}: ${err.message}`);
    }
  }

  // Stop server if we started it
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
    console.log('  Cleaned up: stopped server');
  }
}

// Handle unexpected exits
process.on('SIGINT', async () => { await cleanup(); process.exit(1); });
process.on('SIGTERM', async () => { await cleanup(); process.exit(1); });
process.on('uncaughtException', async (err) => {
  console.error(`\n  Uncaught error: ${err.message}`);
  await cleanup();
  process.exit(1);
});

main();
