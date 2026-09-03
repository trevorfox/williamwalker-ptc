#!/usr/bin/env node
/* Smoke test for the blog build. Run: node scripts/build-blog.test.mjs

   Builds a fixture set into a temp directory via BLOG_CONTENT_DIR / BLOG_OUT_DIR,
   so the real content/blog/ and blog/ folders are never touched. */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import assert from 'node:assert';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TMP = mkdtempSync(join(tmpdir(), 'ww-blog-'));
const SRC = join(TMP, 'content');
const OUT = join(TMP, 'out');
mkdirSync(SRC, { recursive: true });

const build = () => execFileSync('node', [join(ROOT, 'scripts', 'build-blog.mjs')], {
  stdio: 'pipe',
  env: { ...process.env, BLOG_CONTENT_DIR: SRC, BLOG_OUT_DIR: OUT },
});
const read = (f) => readFileSync(join(OUT, f), 'utf8');
const built = (f) => existsSync(join(OUT, f));
const post = (name, body) => writeFileSync(join(SRC, name), body);

try {
  /* ---- an index with no posts at all still renders ---- */
  build();
  const empty = read('index.html');
  assert(empty.includes('post-empty'), 'empty state missing when there are no posts');
  assert(empty.includes('class="site-footer"'), 'empty index lost its chrome');

  /* ---- now with content ---- */
  post('live.md', `---
title: Fall Carnival recap
date: 2026-09-15
author: Test Author
blurb: A one-line summary.
---
Opening paragraph with **bold**, *italic*, \`code\`, an
[external link](https://example.com) and an [internal one](https://williamwalkerptc.com/calendar).

## A heading

- first bullet
- second bullet

> A quoted line.

![Alt text](/assets/blog/zz/photo.jpg)
`);

  post('older.md', `---
title: An earlier post
date: 2026-08-01
author: Test Author
blurb: Older, should sort below.
---
Body.
`);

  post('unfinished.md', `---
title: Unfinished thought
date: 2026-12-01
author: Test Author
blurb: Should never be published.
draft: true
---
Body.
`);

  post('_template.md', `---
title: Template
date: 2026-01-01
author: Nobody
blurb: Underscore files are skipped.
---
Body.
`);

  build();

  /* ---- which pages exist ---- */
  assert(built('live.html'), 'live post missing');
  assert(built('older.html'), 'older post missing');
  assert(!built('unfinished.html'), 'draft: true generated a page');
  assert(!built('_template.html'), 'underscore-prefixed file must not build');

  const p = read('live.html');

  /* ---- date is formatted without Date(), so it cannot drift a day west of UTC ---- */
  assert(p.includes('September 15, 2026'), 'date not formatted, or shifted by timezone');
  assert(p.includes('<time datetime="2026-09-15">'), 'machine-readable date missing');

  /* ---- markdown subset ---- */
  assert(p.includes('<h2>A heading</h2>'), 'h2 missing');
  assert(p.includes('<li>first bullet</li>'), 'list missing');
  assert(p.includes('<blockquote><p>A quoted line.</p></blockquote>'), 'blockquote missing');
  assert(p.includes('<code>code</code>'), 'inline code missing');
  assert(p.includes('<strong>bold</strong>') && p.includes('<em>italic</em>'), 'bold/italic missing');
  assert(p.includes('<figure class="prose-img">'), 'standalone image should become a figure');

  /* ---- link targeting ---- */
  assert(p.includes('href="https://example.com" target="_blank"'), 'external link needs target=_blank');
  assert(p.includes('href="https://williamwalkerptc.com/calendar">'), 'internal link must not open a new tab');
  assert(!p.includes('williamwalkerptc.com/calendar" target='), 'internal link wrongly marked external');

  /* ---- no hero image on disk → gradient, and no broken reference ---- */
  assert(p.includes('hero--gradient'), 'missing hero should fall back to gradient');
  assert(!p.includes('--hero-img'), 'page references a hero image that does not exist');

  /* ---- shared chrome came through the extracted lib ---- */
  assert(p.includes('href="/styles.css"') && p.includes('src="/script.js"'), 'absolute asset paths');
  assert(p.includes('class="site-footer"'), 'footer missing');
  assert(p.includes('williamwalkerptc@gmail.com'), 'footer contact missing');
  assert(p.includes('<link rel="canonical" href="https://williamwalkerptc.com/blog/live" />'), 'canonical wrong');

  /* ---- structured data is present and parses ---- */
  const ld = p.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert(ld, 'JSON-LD block missing');
  const parsed = JSON.parse(ld[1].replace(/\\u003c/g, '<'));
  assert.strictEqual(parsed['@type'], 'BlogPosting');
  assert.strictEqual(parsed.datePublished, '2026-09-15');
  assert.strictEqual(parsed.author.name, 'Test Author');

  /* ---- index ---- */
  const idx = read('index.html');
  assert(idx.includes('/blog/live'), 'index does not link the post');
  assert(!idx.includes('/blog/unfinished'), 'index links a draft');
  assert(idx.indexOf('Fall Carnival recap') < idx.indexOf('An earlier post'), 'index must sort newest first');
  assert(!idx.includes('post-empty'), 'index shows empty state despite having posts');

  /* ---- stale output is cleared between builds ---- */
  rmSync(join(SRC, 'older.md'));
  build();
  assert(!built('older.html'), 'removing a post should remove its page');
  assert(built('live.html'), 'unrelated pages should survive a rebuild');
} finally {
  rmSync(TMP, { recursive: true, force: true });
}

console.log('build-blog.test: all assertions passed');
