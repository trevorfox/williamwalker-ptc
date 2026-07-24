#!/usr/bin/env node
/* Smoke test for the programs build. Run: node scripts/build-programs.test.mjs */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
execFileSync('node', [join(ROOT, 'scripts', 'build-programs.mjs')], { stdio: 'inherit' });

const read = (f) => readFileSync(join(ROOT, 'programs', f), 'utf8');

// detail pages exist for non-stubs
for (const slug of ['walkerthon', 'field-trips', 'art-literacy']) {
  assert(existsSync(join(ROOT, 'programs', slug + '.html')), slug + '.html missing');
}
// stubs do NOT get pages
assert(!existsSync(join(ROOT, 'programs', 'mystery-science.html')), 'stub generated a page');

const wt = read('walkerthon.html');
assert(wt.includes('id="impact"'), 'impact section missing');
assert(wt.includes('data-program-donate="walkerthon"'), 'donate attribution missing');
assert(wt.includes('zeffy.com'), 'donate link missing');
assert(wt.includes('donations support all PTC programs'), 'fineprint missing');
assert(wt.includes('hero--gradient') || wt.includes('hero--image'), 'hero variant missing');
// no photos exist yet → gradient hero, no broken img refs
if (!existsSync(join(ROOT, 'assets', 'programs', 'walkerthon', 'hero.jpg'))) {
  assert(wt.includes('hero--gradient'), 'missing hero image should fall back to gradient');
  assert(!wt.includes('/assets/programs/walkerthon/hero.jpg'), 'page references missing image');
}
// chrome + shared assets are absolute paths
assert(wt.includes('href="/styles.css"') && wt.includes('src="/script.js"'), 'absolute asset paths');

const idx = read('index.html');
for (const t of ['Walkerthon', 'Field Trips', 'Art Literacy', 'Mystery Science', 'Kindness Fund', 'Trunk or Treat']) {
  assert(idx.includes(t), 'index missing: ' + t);
}
assert(idx.includes('/programs/walkerthon'), 'index links detail page');
assert(!idx.includes('/programs/mystery-science'), 'index must not link stubs');

console.log('build-programs smoke test: OK');
