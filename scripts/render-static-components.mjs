import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateGoogleSiteVerificationFile } from './google-site-verification.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const headerTemplatePath = path.join(projectRoot, 'components', 'site-header.html');
const startMarker = '<!-- include:site-header:start -->';
const endMarker = '<!-- include:site-header:end -->';
const checkOnly = process.argv.includes('--check');

async function findPageFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.name === '.git'
        || entry.name === '.vercel'
        || entry.name === 'node_modules'
        || entryPath === path.join(projectRoot, 'components')) {
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...await findPageFiles(entryPath));
    } else if (entry.name.endsWith('.html')) {
      files.push(entryPath);
    }
  }

  return files.sort();
}

function renderHeader(page, headerTemplate) {
  const startIndex = page.indexOf(startMarker);
  const endIndex = page.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error('Missing or invalid site-header include markers');
  }
  if (page.indexOf(startMarker, startIndex + startMarker.length) !== -1
      || page.indexOf(endMarker, endIndex + endMarker.length) !== -1) {
    throw new Error('Multiple site-header include marker pairs found');
  }

  const generatedHeader = `${startMarker}\n${headerTemplate}\n${endMarker}`;
  return page.slice(0, startIndex)
    + generatedHeader
    + page.slice(endIndex + endMarker.length);
}

const headerTemplate = (await readFile(headerTemplatePath, 'utf8')).trim();
const pageFiles = await findPageFiles(projectRoot);
const stalePages = [];
let sitePageCount = 0;

for (const pageFile of pageFiles) {
  const page = await readFile(pageFile, 'utf8');
  if (validateGoogleSiteVerificationFile(pageFile, page, projectRoot)) continue;

  sitePageCount += 1;
  let renderedPage;

  try {
    renderedPage = renderHeader(page, headerTemplate);
  } catch (error) {
    throw new Error(`${path.relative(projectRoot, pageFile)}: ${error.message}`);
  }

  if (renderedPage === page) continue;

  if (checkOnly) {
    stalePages.push(path.relative(projectRoot, pageFile));
  } else {
    await writeFile(pageFile, renderedPage);
  }
}

if (checkOnly && stalePages.length > 0) {
  console.error(`Site header is stale in:\n${stalePages.map(file => `- ${file}`).join('\n')}`);
  process.exitCode = 1;
} else if (checkOnly) {
  console.log(`Site header is synchronized across ${sitePageCount} page(s).`);
} else {
  console.log(`Rendered the shared site header across ${sitePageCount} page(s).`);
}
