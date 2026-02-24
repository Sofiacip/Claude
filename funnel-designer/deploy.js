/**
 * deploy.js — Stage 5: Deploy all funnel pages to Vercel.
 * Single project per funnel with path-based routing.
 */

import { mkdir, copyFile, readFile, writeFile, readdir, rm } from 'fs/promises';
import { join, basename, extname } from 'path';
import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import AdmZip from 'adm-zip';

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.svg', '.webp'];

/**
 * Extract logos/ and photos/ from a brand ZIP into the deploy directory.
 * Handles ZIPs with a single top-level folder wrapper.
 * Returns { logos: number, photos: number } counts.
 */
function extractAssetsFromZip(zipPath, deployDir) {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  const counts = { logos: 0, photos: 0 };

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const entryName = entry.entryName;
    const ext = extname(entryName).toLowerCase();
    if (!IMAGE_EXTS.includes(ext)) continue;

    // Match paths like "logos/file.png" or "top-folder/logos/file.png"
    const parts = entryName.split('/');
    let subdir = null;
    let filename = null;
    for (let i = 0; i < parts.length; i++) {
      if ((parts[i] === 'logos' || parts[i] === 'photos') && i < parts.length - 1) {
        subdir = parts[i];
        filename = parts[parts.length - 1];
        break;
      }
    }
    if (!subdir || !filename) continue;

    const destDir = join(deployDir, subdir);
    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true });
    }
    const data = entry.getData();
    const destPath = join(destDir, filename);
    writeFileSync(destPath, data);
    counts[subdir]++;
  }
  return counts;
}

/**
 * Scan all HTML files in deployDir for image references and verify each
 * referenced file exists. Returns array of missing file paths.
 */
async function verifyImageReferences(deployDir, emit) {
  const missing = [];
  const pageTypes = ['landing', 'upgrade', 'upsell', 'thank_you', 'replay', 'sales'];

  for (const pageType of pageTypes) {
    const htmlPath = join(deployDir, pageType, 'index.html');
    if (!existsSync(htmlPath)) continue;

    const html = await readFile(htmlPath, 'utf-8');

    // Match src="..." and background-image: url(...)
    const srcMatches = html.matchAll(/(?:src|srcset)=["']([^"']+)["']/g);
    const bgMatches = html.matchAll(/background-image:\s*url\(["']?([^"')]+)["']?\)/g);

    const allRefs = [...srcMatches, ...bgMatches].map(m => m[1]);

    for (const ref of allRefs) {
      // Only check local relative refs (../logos/..., ../photos/...)
      if (!ref.startsWith('../logos/') && !ref.startsWith('../photos/')) continue;
      // Resolve relative to page directory
      const resolved = join(deployDir, pageType, ref);
      if (!existsSync(resolved)) {
        missing.push({ page: pageType, ref, resolved });
      }
    }

    // Also catch any un-rewritten preview URLs that slipped through
    const previewUrlMatches = html.matchAll(/\/api\/jobs\/[^/]+\/assets\/(logos|photos)\/([^"'\s)]+)/g);
    for (const m of previewUrlMatches) {
      missing.push({ page: pageType, ref: m[0], resolved: '(unrewritten preview URL)' });
    }
  }

  if (missing.length > 0) {
    emit(`  WARNING: ${missing.length} broken image reference(s) detected:`);
    for (const m of missing) {
      emit(`    ${m.page}: ${m.ref}`);
    }
  } else {
    emit('  All image references verified. ✓');
  }

  return missing;
}

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
      // Read HTML, rewrite preview asset URLs to deploy-relative paths
      let html = await readFile(page.htmlPath, 'utf-8');
      html = html.replace(/\/api\/jobs\/[^/]+\/assets\/(logos|photos)\//g, '../$1/');
      await writeFile(join(pageDir, 'index.html'), html, 'utf-8');
      emit(`  Staged ${page.pageType}/index.html`);
    }

    // ── Copy brand assets (logos, photos) ──────────────────────────────
    const assetsDir = join(tempDir, 'output_assets');
    let logosCount = 0;
    let photosCount = 0;

    // Primary path: copy from output_assets/
    if (existsSync(assetsDir)) {
      for (const subdir of ['logos', 'photos']) {
        const src = join(assetsDir, subdir);
        if (!existsSync(src)) continue;
        const dest = join(deployDir, subdir);
        await mkdir(dest, { recursive: true });
        const files = await readdir(src);
        for (const f of files) {
          await copyFile(join(src, f), join(dest, f));
        }
        if (subdir === 'logos') logosCount = files.length;
        if (subdir === 'photos') photosCount = files.length;
        emit(`  Staged ${files.length} ${subdir} from output_assets/.`);
      }
    }

    // Fallback: if output_assets/ was missing or empty, extract from brand ZIP
    if (logosCount === 0 && photosCount === 0) {
      emit('  WARNING: output_assets/ missing or empty — falling back to brand ZIP extraction.');
      const zipPath = job.brandZipPath;
      if (!zipPath || !existsSync(zipPath)) {
        throw new Error(
          `Deploy aborted: No brand assets found. output_assets/ is missing and brand ZIP ` +
          `not available at ${zipPath || '(no path)'}. Cannot deploy without images.`
        );
      }
      const counts = extractAssetsFromZip(zipPath, deployDir);
      logosCount = counts.logos;
      photosCount = counts.photos;
      emit(`  Extracted from ZIP: ${logosCount} logos, ${photosCount} photos.`);
    }

    // Final check: at least some assets must exist
    if (logosCount === 0 && photosCount === 0) {
      throw new Error(
        'Deploy aborted: Zero brand assets staged. Both output_assets/ and ZIP extraction ' +
        'yielded no logos or photos. Cannot deploy without images.'
      );
    }

    emit(`  Asset totals: ${logosCount} logos, ${photosCount} photos.`);

    // ── Verify all HTML image references resolve ───────────────────────
    const broken = await verifyImageReferences(deployDir, emit);
    if (broken.length > 0) {
      emit(`  WARNING: Proceeding with ${broken.length} broken image ref(s). Review after deploy.`);
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
      `npx vercel deploy --prod --yes`,
      {
        cwd: deployDir,
        encoding: 'utf-8',
        timeout: 120000,
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
