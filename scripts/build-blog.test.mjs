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
import config from '../site.config.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TMP = mkdtempSync(join(tmpdir(), 'ww-blog-'));
const SRC = join(TMP, 'content');
const OUT = join(TMP, 'out');
const ASSETS = join(TMP, 'assets');
mkdirSync(SRC, { recursive: true });
mkdirSync(join(ASSETS, 'art'), { recursive: true });
writeFileSync(join(ASSETS, 'art', 'banner.png'), 'not really a png');

const build = () => execFileSync('node', [join(ROOT, 'scripts', 'build-blog.mjs')], {
  stdio: 'pipe',
  env: { ...process.env, BLOG_CONTENT_DIR: SRC, BLOG_OUT_DIR: OUT, BLOG_ASSETS_DIR: ASSETS },
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
tags: community, fundraising
---
Opening paragraph with **bold**, *italic*, \`code\`, an
[external link](https://example.com) and an [internal one](${config.site.origin}/calendar).

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
tags: newsletter
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

  post('artful.md', `---
title: A post with banner artwork
date: 2026-07-01
author: Test Author
blurb: Artwork with its own lettering must not be dimmed behind the title.
hero_image: art/banner.png
hero_style: banner
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
  assert(p.includes('href="' + config.site.origin + '/calendar">'), 'internal link must not open a new tab');
  assert(!p.includes(config.site.origin + '/calendar" target='), 'internal link wrongly marked external');

  /* ---- no hero image on disk → gradient, and no broken reference ---- */
  assert(p.includes('hero--gradient'), 'missing hero should fall back to gradient');
  assert(!p.includes('--hero-img'), 'page references a hero image that does not exist');

  /* ---- hero_style: banner → title on the gradient, artwork shown whole below it ---- */
  const art = read('artful.html');
  assert(art.includes('hero--gradient') && !art.includes('--hero-img'), 'banner post must not put the image behind the title');
  assert(art.includes('<figure class="post-banner"><img src="/assets/blog/art/banner.png"'), 'banner figure missing');
  assert(art.indexOf('hero-title') < art.indexOf('post-banner') && art.indexOf('post-banner') < art.indexOf('class="prose"'), 'banner must sit between the hero and the body');
  assert(art.includes('og:image" content="' + config.site.origin + '/assets/blog/art/banner.png"'), 'banner should still be the share image');
  assert(!p.includes('post-banner'), 'non-banner post grew a banner');

  /* ---- shared chrome came through the extracted lib ---- */
  assert(p.includes('href="/styles.css"') && p.includes('src="/script.js"'), 'absolute asset paths');
  assert(p.includes('class="site-footer"'), 'footer missing');
  assert(p.includes(config.org.email), 'footer contact missing');
  assert(p.includes('<link rel="canonical" href="' + config.site.origin + '/blog/live" />'), 'canonical wrong');

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
  assert(idx.includes('post-card__media post-card__media--contain'), 'banner card should fit the whole artwork instead of cropping');
  assert((idx.match(/post-card__media--contain/g) || []).length === 1, 'only the banner post should use the contain card');

  /* ---- tags: chips on the post, static chips on cards, one page per used tag ---- */
  const tagKeys = Object.keys(config.blog.tags);
  assert(tagKeys.includes('fundraising') && tagKeys.includes('newsletter'), 'test assumes these tags exist in config');
  assert(p.includes('<a class="tag-chip" href="/blog/tag/fundraising">'), 'post hero should link its tags');
  assert(p.indexOf('/blog/tag/fundraising') > p.indexOf('hero-title') && p.indexOf('/blog/tag/fundraising') < p.indexOf('class="prose"'), 'tag chips belong in the hero');
  assert(!idx.includes('<a class="tag-chip" href="/blog/tag/fundraising">'
    + config.blog.tags.fundraising.label + '</a></li>'), 'cards must not nest a tag link inside the card link');
  assert(idx.includes('<li><span class="tag-chip">' + config.blog.tags.fundraising.label + '</span></li>'), 'card should show static tag chips');
  assert(built('tag/fundraising.html') && built('tag/community.html') && built('tag/newsletter.html'), 'tag pages missing');
  const unused = tagKeys.find((k) => !['fundraising', 'community', 'newsletter'].includes(k));
  if (unused) assert(!built('tag/' + unused + '.html'), 'a tag with no posts must not get a page');
  const fund = read('tag/fundraising.html');
  assert(fund.includes('/blog/live') && !fund.includes('/blog/older'), 'tag page lists the wrong posts');
  assert(!fund.includes('/blog/unfinished'), 'tag page lists a draft');
  assert(fund.includes('<link rel="canonical" href="' + config.site.origin + '/blog/tag/fundraising" />'), 'tag page canonical wrong');
  assert(fund.includes('aria-current="page">' + config.blog.tags.fundraising.label + '</a>'), 'tag page should mark its own filter chip');
  assert(!idx.includes('aria-current="page">' + config.blog.tags.fundraising.label), 'index must not mark a tag as current');
  assert(idx.includes('class="tag-chip is-active" href="/blog"'), 'index should mark "All posts" as current');
  if (unused) assert(!idx.includes('/blog/tag/' + unused + '"'), 'filter row must not link to an empty tag page');
  const tagLd = JSON.parse(p.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1].replace(/\\u003c/g, '<'));
  const expectedKeywords = tagKeys.filter((k) => ['community', 'fundraising'].includes(k)).map((k) => config.blog.tags[k].label).join(', ');
  assert.strictEqual(tagLd.keywords, expectedKeywords, 'keywords should follow config order, not the order written in the post');

  /* ---- an unknown tag is a build error, not a silent new page ---- */
  post('typo.md', `---
title: Typo in tag
date: 2026-09-16
author: Test Author
blurb: Should fail the build.
tags: fundrasing
---
Body.
`);
  assert.throws(build, /unknown tag "fundrasing"/, 'misspelled tag must fail the build');
  rmSync(join(SRC, 'typo.md'));

  /* ---- stale output is cleared between builds ---- */
  rmSync(join(SRC, 'older.md'));
  build();
  assert(!built('older.html'), 'removing a post should remove its page');
  assert(built('live.html'), 'unrelated pages should survive a rebuild');
  assert(!built('tag/newsletter.html'), 'a tag page whose last post is removed should disappear');
  assert(built('tag/fundraising.html'), 'tag pages still in use should survive a rebuild');
} finally {
  rmSync(TMP, { recursive: true, force: true });
}

console.log('build-blog.test: all assertions passed');
