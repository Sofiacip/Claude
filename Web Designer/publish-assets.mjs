/**
 * publish-assets.mjs
 *
 * Publishes all client brand assets to a dedicated Vercel CDN project
 * and rewrites the target client's HTML to use permanent CDN URLs.
 *
 * CLI:    node publish-assets.mjs <client-name>
 * Module: import { publishAssets } from './publish-assets.mjs'
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, 'config', 'asset-cdn.json');
const CLIENTS_DIR = path.join(__dirname, 'clients');
const STAGING_DIR = '/tmp/vercel-deploy-assets';

// Vercel config for the assets project: CORS + aggressive caching
const VERCEL_JSON = {
  version: 2,
  buildCommand: null,
  outputDirectory: '.',
  framework: null,
  headers: [
    {
      source: '/(.*)',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: '*' },
        { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
        { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
      ],
    },
  ],
};

// ─── Config ──────────────────────────────────────────────

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(
      'CDN config not found at config/asset-cdn.json.\n\n' +
      'One-time setup required:\n' +
      '  1. mkdir -p /tmp/impact-os-assets\n' +
      '  2. echo \'<h1>Impact OS Assets</h1>\' > /tmp/impact-os-assets/index.html\n' +
      '  3. echo \'{"version":2}\' > /tmp/impact-os-assets/vercel.json\n' +
      '  4. cd /tmp/impact-os-assets && npx vercel --yes\n' +
      '  5. cat /tmp/impact-os-assets/.vercel/project.json\n' +
      '  6. Copy the projectId into config/asset-cdn.json\n' +
      '  7. rm -rf /tmp/impact-os-assets'
    );
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));

  if (!config.projectId || config.projectId === 'SETUP_REQUIRED') {
    throw new Error(
      'CDN project not configured. Set "projectId" in config/asset-cdn.json.\n' +
      'Run the one-time Vercel setup — see publish-assets.mjs header for instructions.'
    );
  }

  return config;
}

// ─── Asset Collection ────────────────────────────────────

function collectAssets() {
  const result = {};

  if (!fs.existsSync(CLIENTS_DIR)) return result;

  const clients = fs.readdirSync(CLIENTS_DIR).filter(name => {
    if (name === '_template' || name.startsWith('.')) return false;
    const assetsDir = path.join(CLIENTS_DIR, name, 'brand', 'assets');
    return fs.existsSync(assetsDir);
  });

  for (const client of clients) {
    const assetsDir = path.join(CLIENTS_DIR, client, 'brand', 'assets');
    const logos = listFiles(path.join(assetsDir, 'logos'));
    const photos = listFiles(path.join(assetsDir, 'photos'));

    if (logos.length > 0 || photos.length > 0) {
      result[client] = { logos, photos };
    }
  }

  return result;
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => !f.startsWith('.'))
    .map(f => ({ name: f, fullPath: path.join(dir, f) }));
}

// ─── Staging ─────────────────────────────────────────────

function stageAssets(allAssets, config) {
  // Clean slate
  if (fs.existsSync(STAGING_DIR)) {
    fs.rmSync(STAGING_DIR, { recursive: true, force: true });
  }

  // Write Vercel config
  fs.mkdirSync(path.join(STAGING_DIR, '.vercel'), { recursive: true });
  fs.writeFileSync(
    path.join(STAGING_DIR, 'vercel.json'),
    JSON.stringify(VERCEL_JSON, null, 2)
  );
  fs.writeFileSync(
    path.join(STAGING_DIR, '.vercel', 'project.json'),
    JSON.stringify({ projectId: config.projectId, orgId: config.orgId })
  );

  // Placeholder index so Vercel doesn't complain about empty root
  fs.writeFileSync(
    path.join(STAGING_DIR, 'index.html'),
    '<!DOCTYPE html><html><body><h1>Impact OS Assets CDN</h1><p>This project serves brand assets for Impact OS clients.</p></body></html>'
  );

  // Copy each client's assets
  let totalFiles = 0;

  for (const [client, assets] of Object.entries(allAssets)) {
    const logosDir = path.join(STAGING_DIR, 'clients', client, 'brand', 'assets', 'logos');
    const photosDir = path.join(STAGING_DIR, 'clients', client, 'brand', 'assets', 'photos');

    if (assets.logos.length > 0) {
      fs.mkdirSync(logosDir, { recursive: true });
      for (const file of assets.logos) {
        fs.copyFileSync(file.fullPath, path.join(logosDir, file.name));
        totalFiles++;
      }
    }

    if (assets.photos.length > 0) {
      fs.mkdirSync(photosDir, { recursive: true });
      for (const file of assets.photos) {
        fs.copyFileSync(file.fullPath, path.join(photosDir, file.name));
        totalFiles++;
      }
    }
  }

  return totalFiles;
}

// ─── Deploy ──────────────────────────────────────────────

function deploy() {
  console.log('Deploying assets to Vercel...');
  const output = execSync('npx vercel deploy --prod --yes', {
    cwd: STAGING_DIR,
    encoding: 'utf-8',
    timeout: 120000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  console.log(output.trim());
  return output.trim();
}

// ─── HTML Rewriting ──────────────────────────────────────

function rewriteHtml(clientName, cdnDomain) {
  const htmlPath = path.join(CLIENTS_DIR, clientName, 'output', 'index.html');

  if (!fs.existsSync(htmlPath)) {
    console.warn(`No output/index.html for ${clientName} — skipping rewrite`);
    return 0;
  }

  let html = fs.readFileSync(htmlPath, 'utf-8');
  const cdnBase = `https://${cdnDomain}/clients/${clientName}/brand/assets`;

  let replacements = 0;

  // src="logos/..." → src="https://cdn/clients/{client}/brand/assets/logos/..."
  // Negative lookahead prevents double-rewriting already-absolute URLs
  html = html.replace(
    /(\bsrc\s*=\s*["'])(?!https?:\/\/)(\.?\/?)(logos\/)/gi,
    (match, prefix, dotslash, dir) => { replacements++; return `${prefix}${cdnBase}/${dir}`; }
  );

  html = html.replace(
    /(\bsrc\s*=\s*["'])(?!https?:\/\/)(\.?\/?)(photos\/)/gi,
    (match, prefix, dotslash, dir) => { replacements++; return `${prefix}${cdnBase}/${dir}`; }
  );

  // url(logos/...) and url(photos/...) in CSS — with optional quotes
  html = html.replace(
    /(url\(\s*["']?)(?!https?:\/\/)(\.?\/?)(logos\/)/gi,
    (match, prefix, dotslash, dir) => { replacements++; return `${prefix}${cdnBase}/${dir}`; }
  );

  html = html.replace(
    /(url\(\s*["']?)(?!https?:\/\/)(\.?\/?)(photos\/)/gi,
    (match, prefix, dotslash, dir) => { replacements++; return `${prefix}${cdnBase}/${dir}`; }
  );

  fs.writeFileSync(htmlPath, html, 'utf-8');
  return replacements;
}

// ─── Cleanup ─────────────────────────────────────────────

function cleanup() {
  if (fs.existsSync(STAGING_DIR)) {
    fs.rmSync(STAGING_DIR, { recursive: true, force: true });
  }
}

// ─── Main ────────────────────────────────────────────────

export async function publishAssets(clientName = null) {
  const config = loadConfig();
  const assets = collectAssets();
  const clientCount = Object.keys(assets).length;

  if (clientCount === 0) {
    return { success: true, message: 'No brand assets found to publish', assetsCount: 0 };
  }

  console.log(`Found assets for ${clientCount} client(s): ${Object.keys(assets).join(', ')}`);

  let totalFiles;
  try {
    totalFiles = stageAssets(assets, config);
    console.log(`Staged ${totalFiles} files`);

    deploy();

    let rewrites = 0;
    if (clientName) {
      rewrites = rewriteHtml(clientName, config.domain);
      console.log(`Rewrote ${rewrites} image path(s) in ${clientName}/output/index.html`);
    }

    return {
      success: true,
      url: `https://${config.domain}`,
      clientsPublished: Object.keys(assets),
      assetsCount: totalFiles,
      htmlRewrites: rewrites,
    };
  } finally {
    cleanup();
  }
}

// ─── CLI Entry Point ─────────────────────────────────────

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  const clientName = process.argv[2] || null;

  if (!clientName) {
    console.log('Usage: node publish-assets.mjs <client-name>');
    console.log('       node publish-assets.mjs test-client');
    process.exit(1);
  }

  publishAssets(clientName)
    .then(result => {
      console.log('\nResult:');
      console.log(JSON.stringify(result, null, 2));
    })
    .catch(err => {
      console.error('\nError:', err.message);
      process.exit(1);
    });
}
