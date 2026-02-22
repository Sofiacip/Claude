/**
 * @fileoverview Stage 8 — Deployer
 * Reads the Elementor JSON, deploys it to WordPress REST API as a page,
 * includes page_settings (custom CSS, hide_title) if available.
 * If a page with the same slug exists, updates it (PUT); otherwise creates (POST).
 * Returns { deployedUrl, httpStatus } in the context.
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { config } from '../config.js';

/**
 * Build the Basic Auth header for WordPress Application Passwords.
 * @returns {string} "Basic <base64>"
 */
function wpAuthHeader() {
  const credentials = `${config.wpUser}:${config.wpAppPassword}`;
  return `Basic ${Buffer.from(credentials).toString('base64')}`;
}

/**
 * Check if a page with the given slug already exists.
 * @param {string} slug
 * @returns {Promise<number|null>} Page ID if exists, null otherwise
 */
async function findExistingPage(slug) {
  const url = `${config.wpUrl}/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&per_page=1`;
  const response = await fetch(url, {
    headers: { 'Authorization': wpAuthHeader() },
  });
  if (!response.ok) return null;
  const pages = await response.json();
  return pages.length > 0 ? pages[0].id : null;
}

/**
 * Build the meta object for the WordPress page.
 * @param {string} elementorDataJson - Stringified Elementor JSON
 * @param {Object} [pageSettings] - Optional Elementor page settings
 * @returns {Object}
 */
function buildMeta(elementorDataJson, pageSettings = null) {
  const meta = {
    _elementor_data:           elementorDataJson,
    _elementor_edit_mode:      'builder',
    _elementor_template_type:  'wp-page',
    _elementor_version:        '3.21.0',
  };

  // Include page settings if available (custom CSS, hide_title, etc.)
  // WordPress REST API expects this as a raw object, not a string
  if (pageSettings) {
    meta._elementor_page_settings = pageSettings;
  }

  return meta;
}

/**
 * Create a new page via POST.
 */
async function createWpPage(title, slug, elementorDataJson, pageSettings = null) {
  const url = `${config.wpUrl}/wp-json/wp/v2/pages`;

  const body = JSON.stringify({
    title,
    slug,
    status: 'publish',
    meta: buildMeta(elementorDataJson, pageSettings),
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': wpAuthHeader(),
    },
    body,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `WordPress API returned ${response.status}: ${errText.slice(0, 300)}`
    );
  }

  return response.json();
}

/**
 * Update an existing page via PUT.
 */
async function updateWpPage(pageId, title, slug, elementorDataJson, pageSettings = null) {
  const url = `${config.wpUrl}/wp-json/wp/v2/pages/${pageId}`;

  const body = JSON.stringify({
    title,
    slug,
    status: 'publish',
    meta: buildMeta(elementorDataJson, pageSettings),
  });

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': wpAuthHeader(),
    },
    body,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `WordPress API returned ${response.status}: ${errText.slice(0, 300)}`
    );
  }

  return response.json();
}

/**
 * Confirm the deployed page returns HTTP 200.
 * @param {string} pageUrl
 * @returns {Promise<number>} HTTP status code
 */
async function confirmPageLive(pageUrl) {
  const response = await fetch(pageUrl, { method: 'HEAD' });
  return response.status;
}

/**
 * Stage 8: Deploy page to WordPress REST API and confirm it is live.
 * @param {import('../pipeline.js').RunContext} ctx
 * @returns {Promise<import('../pipeline.js').RunContext>}
 */
export async function run(ctx) {
  const ts = () => new Date().toISOString();

  const elementorJson = JSON.parse(await readFile(ctx.elementorOutputPath, 'utf-8'));
  const elementorDataStr = JSON.stringify(elementorJson);
  console.log(`[${ts()}] [deployer      ] Elementor JSON loaded (${elementorDataStr.length} chars, ${elementorJson.length} sections)`);

  // Load page settings if available (custom CSS, hide_title, etc.)
  const pageSettingsPath = resolve(config.paths.templates, ctx.templateName, 'elementor-page-settings.json');
  let pageSettings = null;
  if (existsSync(pageSettingsPath)) {
    pageSettings = JSON.parse(await readFile(pageSettingsPath, 'utf-8'));
    console.log(`[${ts()}] [deployer      ] Page settings loaded (custom CSS: ${(pageSettings.custom_css || '').length} chars)`);
  }

  const pageTitle = ctx.briefData.headline ?? `PageForge Page — ${ctx.runId}`;
  const pageSlug  = ctx.briefData.targetSlug;

  // Check if page with this slug already exists
  const existingPageId = await findExistingPage(pageSlug);

  let page;
  try {
    if (existingPageId) {
      console.log(`[${ts()}] [deployer      ] Existing page found (ID ${existingPageId}) — updating via PUT`);
      page = await updateWpPage(existingPageId, pageTitle, pageSlug, elementorDataStr, pageSettings);
    } else {
      console.log(`[${ts()}] [deployer      ] No existing page — creating via POST`);
      console.log(`[${ts()}] [deployer      ] Target: ${config.wpUrl}/wp-json/wp/v2/pages`);
      page = await createWpPage(pageTitle, pageSlug, elementorDataStr, pageSettings);
    }
  } catch (err) {
    throw new Error(`WordPress deployment failed: ${err.message}`);
  }

  const deployedUrl = page.link ?? `${config.wpUrl}/${pageSlug}/`;
  console.log(`[${ts()}] [deployer      ] Page deployed. WP ID: ${page.id}, URL: ${deployedUrl}`);

  // --- Confirm live ---
  console.log(`[${ts()}] [deployer      ] Confirming page is live…`);
  let httpStatus;
  try {
    httpStatus = await confirmPageLive(deployedUrl);
  } catch (err) {
    // Non-fatal — page may still be live despite network edge cases
    console.warn(`[${ts()}] [deployer      ] Live check failed: ${err.message}`);
    httpStatus = 0;
  }

  if (httpStatus === 200) {
    console.log(`[${ts()}] [deployer      ] Page confirmed live — HTTP ${httpStatus}`);
  } else {
    console.warn(`[${ts()}] [deployer      ] Live check returned HTTP ${httpStatus} — page may need cache warmup`);
  }

  return {
    ...ctx,
    deployedUrl,
    deployedPageId: page.id,
    deployedHttpStatus: httpStatus,
  };
}
