#!/usr/bin/env node
/* =========================================================================
   snapshot — copy every generated page into scripts/fixtures/baseline/, the
   set verify-pages.test.mjs diffs against.

   Run it after an INTENDED change to built output (new post, copy edit, nav
   change), once you have looked at the diff and it is what you meant:

     npm run build:site && npm run snapshot

   A fork runs it once after its first build, since the committed baseline is
   another school's pages.

   Pages that no longer exist are removed from the baseline, so a renamed or
   deleted page does not leave a snapshot that can never match.
   ========================================================================= */
import { readdirSync, mkdirSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = join(ROOT, 'scripts', 'fixtures', 'baseline');

// Where the builds write. '' is the repository root (not recursed into).
const DIRS = ['', 'families', 'blog', 'blog/tag', 'programs'];

function pages(dir) {
  const full = join(ROOT, dir);
  if (!existsSync(full)) return [];
  return readdirSync(full).filter((f) => f.endsWith('.html')).map((f) => (dir ? dir + '/' + f : f));
}

const built = DIRS.flatMap(pages).sort();
if (!built.length) {
  console.error('snapshot: no built pages found. Run `npm run build:site` first.');
  process.exit(1);
}

rmSync(BASELINE, { recursive: true, force: true });
for (const rel of built) {
  const dest = join(BASELINE, rel);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(join(ROOT, rel), dest);
}
console.log('snapshot: wrote ' + built.length + ' page(s) to scripts/fixtures/baseline/');
