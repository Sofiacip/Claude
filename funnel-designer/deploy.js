/**
 * deploy.js — Stage 5: Deploy all funnel pages to Vercel.
 * Single project per funnel with path-based routing.
 */

import { mkdir, copyFile, writeFile, readdir, rm } from 'fs/promises';
import { join, basename } from 'path';
import { execSync } from 'child_process';
import { existsSync } from 'fs';

/**
 * Deploy all approved pages as a single Vercel project.
 * Structure:
 *   /landing/index.html
 *   /upgrade/index.html
 *   /upsell/index.html
 *   /thank_you/index.html
 *   /replay/index.html
 *   /sales/index.html
 *   /logos/...
 *   /photos/...
 *
 * Returns { pageType: url } map.
 */
export async function deployAll(job, emit) {
  const { clientName, tempDir, pages } = job;
  const slug = clientName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const deployDir = `/tmp/vercel-deploy-${slug}-funnel`;

  try {
    // Clean any previous deploy dir
    if (existsSync(deployDir)) {
      await rm(deployDir, { recursive: true });
    }
    await mkdir(deployDir, { recursive: true });

    // Copy each page's HTML into its directory
    for (const page of pages) {
      if (!page.htmlPath) {
        emit(`  Warning: No HTML for ${page.pageType} — skipping.`);
        continue;
      }
      const pageDir = join(deployDir, page.pageType);
      await mkdir(pageDir, { recursive: true });
      await copyFile(page.htmlPath, join(pageDir, 'index.html'));
      emit(`  Staged ${page.pageType}/index.html`);
    }

    // Copy brand assets (logos, photos)
    const assetsDir = join(tempDir, 'output_assets');
    for (const subdir of ['logos', 'photos']) {
      const src = join(assetsDir, subdir);
      if (!existsSync(src)) continue;
      const dest = join(deployDir, subdir);
      await mkdir(dest, { recursive: true });
      const files = await readdir(src);
      for (const f of files) {
        await copyFile(join(src, f), join(dest, f));
      }
      emit(`  Staged ${files.length} ${subdir} file(s).`);
    }

    // Create a root index.html that redirects to /landing
    const rootHtml = `<!DOCTYPE html>
<html><head><meta http-equiv="refresh" content="0;url=/landing"></head>
<body><p>Redirecting to <a href="/landing">landing page</a>...</p></body></html>`;
    await writeFile(join(deployDir, 'index.html'), rootHtml);

    // Deploy to Vercel
    emit('  Running Vercel deploy...');
    const projectName = `${slug}-funnel`;

    const result = execSync(
      `npx vercel deploy --prod --yes --name="${projectName}"`,
      {
        cwd: deployDir,
        encoding: 'utf-8',
        timeout: 120000,
        env: { ...process.env, VERCEL_ORG_ID: 'team_eiom911BnIXG71MJbar1uC73' }
      }
    );

    // Parse the deployed URL from Vercel output
    const lines = result.trim().split('\n');
    const deployUrl = lines.find(l => l.startsWith('https://')) || lines[lines.length - 1];
    const baseUrl = deployUrl.trim();

    emit(`  Deployed to: ${baseUrl}`);

    // Build URL map
    const urls = {};
    for (const page of pages) {
      urls[page.pageType] = `${baseUrl}/${page.pageType}`;
      page.deployedUrl = `${baseUrl}/${page.pageType}`;
    }

    emit('  All pages deployed. ✓');
    return urls;

  } finally {
    // Cleanup
    if (existsSync(deployDir)) {
      await rm(deployDir, { recursive: true }).catch(() => {});
    }
  }
}
