/**
 * @fileoverview PageForge pipeline orchestrator.
 * Runs all 8 stages in sequence, passing a shared RunContext through each agent.
 *
 * Usage:
 *   node pipeline.js ./briefs/example.json
 */

import { randomUUID } from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';

// --- Agent imports ---
import { run as briefParser }    from './agents/briefParser.js';
import { run as uxGenerator }    from './agents/uxGenerator.js';
import { run as uxQA }           from './agents/uxQA.js';
import { run as notifier }       from './agents/notifier.js';
import { run as approvalGate }   from './agents/approvalGate.js';
import { run as codeGenerator }  from './agents/codeGenerator.js';
import { run as codeQA }         from './agents/codeQA.js';
import { run as deployer }       from './agents/deployer.js';

/**
 * @typedef {Object} RunContext
 * @property {string}  runId               - Unique run identifier (UUID)
 * @property {string}  briefPath           - Absolute path to input brief file
 * @property {string}  templateName        - Template name resolved from brief
 * @property {Object}  briefData           - Validated brief fields
 * @property {string}  uxOutputPath        - Path to generated HTML wireframe
 * @property {string}  approvalStatus      - 'pending' | 'approved' | 'revised'
 * @property {string}  [revisionNotes]     - Notes from reviewer if revised
 * @property {string}  elementorOutputPath - Path to generated Elementor JSON
 * @property {string}  [deployedUrl]       - Final public URL after deploy
 * @property {number}  startedAt           - Unix timestamp (ms)
 * @property {Array}   stageLog            - Per-stage timing + status records
 */

/** Stages in execution order with display names */
const STAGES = [
  { name: 'briefParser',   fn: briefParser   },
  { name: 'uxGenerator',   fn: uxGenerator   },
  { name: 'uxQA',          fn: uxQA          },
  { name: 'notifier',      fn: notifier      },
  { name: 'approvalGate',  fn: approvalGate  },
  { name: 'codeGenerator', fn: codeGenerator },
  { name: 'codeQA',        fn: codeQA        },
  { name: 'deployer',      fn: deployer      },
];

/**
 * Emit a timestamped log line with stage context.
 * @param {string} stage
 * @param {string} message
 */
function log(stage, message) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${stage.padEnd(14)}] ${message}`);
}

/**
 * Persist a run log to /logs/{runId}.json
 * @param {RunContext} ctx
 * @param {'success'|'failure'} outcome
 * @param {Error|null} error
 */
async function writeLog(ctx, outcome, error = null) {
  await mkdir(config.paths.logs, { recursive: true });
  const logPath = resolve(config.paths.logs, `${ctx.runId}.json`);
  const payload = {
    runId: ctx.runId,
    outcome,
    startedAt: ctx.startedAt,
    finishedAt: Date.now(),
    durationMs: Date.now() - ctx.startedAt,
    briefPath: ctx.briefPath,
    templateName: ctx.templateName,
    deployedUrl: ctx.deployedUrl ?? null,
    stageLog: ctx.stageLog,
    error: error ? { message: error.message, stack: error.stack } : null,
  };
  await writeFile(logPath, JSON.stringify(payload, null, 2));
  log('pipeline', `Run log written → ${logPath}`);
}

/**
 * Main pipeline entry point.
 * @param {string} briefPath - Path to the brief JSON file (from CLI or import)
 */
export async function runPipeline(briefPath) {
  const runId = randomUUID().split('-')[0]; // short 8-char ID for readability

  /** @type {RunContext} */
  let ctx = {
    runId,
    briefPath: resolve(briefPath),
    templateName: '',
    briefData: {},
    uxOutputPath: '',
    approvalStatus: 'pending',
    revisionNotes: '',
    elementorOutputPath: '',
    deployedUrl: '',
    startedAt: Date.now(),
    stageLog: [],
  };

  log('pipeline', `=== PageForge run ${runId} starting ===`);
  log('pipeline', `Brief: ${ctx.briefPath}`);

  for (const stage of STAGES) {
    const stageStart = Date.now();
    log(stage.name, 'Starting…');

    try {
      ctx = await stage.fn(ctx);
      const elapsed = Date.now() - stageStart;
      log(stage.name, `Completed in ${elapsed}ms`);
      ctx.stageLog.push({ stage: stage.name, status: 'ok', durationMs: elapsed });
    } catch (err) {
      const elapsed = Date.now() - stageStart;
      log(stage.name, `FAILED after ${elapsed}ms — ${err.message}`);
      ctx.stageLog.push({
        stage: stage.name,
        status: 'error',
        durationMs: elapsed,
        error: err.message,
      });

      await writeLog(ctx, 'failure', err);
      log('pipeline', `Pipeline halted at stage: ${stage.name}`);
      log('pipeline', 'Operator: check logs/ directory for full details.');
      process.exit(1);
    }
  }

  await writeLog(ctx, 'success');
  log('pipeline', `=== Run ${runId} complete ===`);
  log('pipeline', `Deployed URL: ${ctx.deployedUrl}`);
  return ctx;
}

// --- CLI entry point ---
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  const briefArg = process.argv[2];
  if (!briefArg) {
    console.error('Usage: node pipeline.js ./briefs/your-brief.json');
    process.exit(1);
  }
  runPipeline(briefArg).catch((err) => {
    console.error('[pipeline] Unhandled error:', err);
    process.exit(1);
  });
}
