/**
 * @fileoverview Config loader — reads .env and validates all required variables.
 * Throws a descriptive error on startup if any required var is missing.
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Load .env synchronously so vars are available before validation runs
const envPath = resolve(__dirname, '.env');
if (existsSync(envPath)) {
  require('dotenv').config({ path: envPath, override: true });
}

/** @typedef {Object} Config */
const REQUIRED = [
  'ANTHROPIC_API_KEY',
  'WP_URL',
  'WP_USER',
  'WP_APP_PASSWORD',
  'RESEND_API_KEY',
  'REVIEWER_EMAIL',
  'WEBHOOK_BASE_URL',
];

const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length > 0) {
  throw new Error(
    `[config] Missing required environment variables:\n  ${missing.join('\n  ')}\n` +
    `Copy .env.example to .env and fill in all values.`
  );
}

/** @type {Config} */
export const config = {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  claudeModel: 'claude-sonnet-4-5',

  wpUrl: process.env.WP_URL.replace(/\/$/, ''),
  wpUser: process.env.WP_USER,
  wpAppPassword: process.env.WP_APP_PASSWORD,

  resendApiKey: process.env.RESEND_API_KEY,
  reviewerEmail: process.env.REVIEWER_EMAIL,

  webhookBaseUrl: process.env.WEBHOOK_BASE_URL.replace(/\/$/, ''),
  webhookPort: parseInt(process.env.WEBHOOK_PORT ?? '3001', 10),

  uxQaMaxIterations: parseInt(process.env.UX_QA_MAX_ITERATIONS ?? '3', 10),
  codeQaMaxIterations: parseInt(process.env.CODE_QA_MAX_ITERATIONS ?? '2', 10),
  approvalTimeoutHours: parseFloat(process.env.APPROVAL_TIMEOUT_HOURS ?? '4'),

  paths: {
    root: __dirname,
    agents: resolve(__dirname, 'agents'),
    templates: resolve(__dirname, 'templates'),
    briefs: resolve(__dirname, 'briefs'),
    outputUx: resolve(__dirname, 'output', 'ux'),
    outputElementor: resolve(__dirname, 'output', 'elementor'),
    logs: resolve(__dirname, 'logs'),
  },
};
