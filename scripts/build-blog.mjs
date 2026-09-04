#!/usr/bin/env node
/* =========================================================================
   Build /blog pages from content/blog/*.md — no dependencies.

   Usage:  node scripts/build-blog.mjs

   One .md file = one post. The FILENAME is the URL slug:
   content/blog/fall-carnival.md  →  https://williamwalkerptc.com/blog/fall-carnival

   Frontmatter (flat scalars only — see scripts/lib/md.mjs):

     title:  Fall Carnival raised $4,200      (required)
     date:   2026-10-18                       (required, YYYY-MM-DD)
     author: Jane Smith                       (required — shown on the post)
     blurb:  one-liner                        (required; index card + meta description)
     hero_image: fall-carnival/hero.jpg       (optional; relative to assets/blog/)
     draft:  true                             (optional; skipped by the build)

   `date` is an explicit field rather than being read from git, because
   rebases rewrite commit dates and a CMS needs somewhere to write it.

   Files starting with "_" are ignored, so _template.md stays out of the build.

   Body = markdown (## / ### headings, paragraphs, - lists, > quotes,
   **bold**, *italic*, `code`, [links](href), standalone ![alt](src) images).

   Missing hero images degrade to the brand gradient.
   ========================================================================= */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { esc, parseFrontmatter, renderMd } from './lib/md.mjs';
import { head, topbar, FOOTER } from './lib/chrome.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
/* Overridable so the smoke test can build a fixture set into a temp directory
   instead of writing through the real content and output folders. */
const CONTENT = process.env.BLOG_CONTENT_DIR || join(ROOT, 'content', 'blog');
const OUT = process.env.BLOG_OUT_DIR || join(ROOT, 'blog');
const ASSETS = join(ROOT, 'assets', 'blog');
const SITE = 'https://williamwalkerptc.com';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function fail(msg) { console.error('build-blog: ' + msg); process.exit(1); }

/* Format YYYY-MM-DD without going through Date(), which would parse the
   string as UTC midnight and render as the previous day west of Greenwich. */
function fmtDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return MONTHS[m - 1] + ' ' + d + ', ' + y;
}

/* ---------- load + validate ---------- */
function loadPosts() {
  if (!existsSync(CONTENT)) fail('content dir missing: ' + CONTENT);
  const posts = readdirSync(CONTENT)
    .filter(function (f) { return f.endsWith('.md') && !f.startsWith('_'); })
    .sort()
    .map(function (f) {
      const parsed = parseFrontmatter(readFileSync(join(CONTENT, f), 'utf8'), f, fail);
      const d = parsed.data;
      ['title', 'date', 'author', 'blurb'].forEach(function (k) {
        if (!d[k]) fail(f + ': missing required "' + k + '"');
      });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.date))) {
        fail(f + ': "date" must be YYYY-MM-DD, got "' + d.date + '"');
      }
      return {
        slug: f.replace(/\.md$/, ''),
        title: d.title,
        date: String(d.date),
        author: d.author,
        blurb: d.blurb,
        hero_image: d.hero_image || '',
        draft: !!d.draft,
        body: parsed.body,
      };
    })
    .filter(function (p) { return !p.draft; });
  posts.sort(function (a, b) { return b.date.localeCompare(a.date) || a.title.localeCompare(b.title); });
  return posts;
}

function assetUrl(rel) { return '/assets/blog/' + rel; }
function assetExists(rel) { return !!rel && existsSync(join(ASSETS, rel)); }

/* ---------- page pieces ---------- */
function metaHtml(p) {
  return '<p class="post-meta"><time datetime="' + p.date + '">' + fmtDate(p.date) + '</time>'
    + ' <span aria-hidden="true">·</span> ' + esc(p.author) + '</p>';
}

function heroHtml(p) {
  const hasImg = assetExists(p.hero_image);
  const cls = hasImg ? 'hero hero--image' : 'hero hero--gradient';
  const style = hasImg ? ' style="--hero-img: url(\'' + esc(assetUrl(p.hero_image)) + '\')"' : '';
  return '    <section class="' + cls + '"' + style + ' aria-labelledby="hero-title">\n'
    + '      <div class="hero__inner">\n'
    + '        <p class="hero__eyebrow">PTC News</p>\n'
    + '        <h1 id="hero-title" class="hero__title">' + esc(p.title) + '</h1>\n'
    + '        ' + metaHtml(p) + '\n'
    + '      </div>\n'
    + '    </section>\n';
}

function cardHtml(p) {
  const hasImg = assetExists(p.hero_image);
  const media = hasImg
    ? '<div class="post-card__media"><img src="' + esc(assetUrl(p.hero_image)) + '" alt="" loading="lazy" /></div>'
    : '';
  return '          <article class="post-card">\n'
    + '            <a class="post-card__link" href="/blog/' + esc(p.slug) + '">' + media
    + '<div class="post-card__body">'
    + '<p class="post-card__date"><time datetime="' + p.date + '">' + fmtDate(p.date) + '</time></p>'
    + '<h3>' + esc(p.title) + '</h3>'
    + '<p>' + esc(p.blurb) + '</p>'
    + '<span class="post-card__more">Read more <span aria-hidden="true">→</span></span>'
    + '</div></a>\n'
    + '          </article>';
}

function moreHtml(p, posts) {
  const others = posts.filter(function (o) { return o.slug !== p.slug; }).slice(0, 3);
  if (!others.length) return '';
  return '    <section class="block block--white post-more" aria-labelledby="more-title">\n'
    + '      <div class="wrap">\n'
    + '        <div class="post-more__head">\n'
    + '          <p class="kicker kicker--blue">More from the PTC</p>\n'
    + '          <h2 id="more-title" class="section-title">Recent posts.</h2>\n'
    + '        </div>\n'
    + '        <div class="post-cards">\n'
    + others.map(cardHtml).join('\n')
    + '\n        </div>\n      </div>\n    </section>\n';
}

function jsonLd(p) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: p.title,
    description: p.blurb,
    datePublished: p.date,
    author: { '@type': 'Person', name: p.author },
    publisher: { '@type': 'Organization', name: 'William Walker Elementary PTC' },
    mainEntityOfPage: SITE + '/blog/' + p.slug,
    image: assetExists(p.hero_image) ? SITE + assetUrl(p.hero_image) : SITE + '/assets/logo.png',
  };
  return '  <script type="application/ld+json">' + JSON.stringify(data).replace(/</g, '\\u003c') + '</script>\n';
}

/* ---------- pages ---------- */
function postPage(p, posts) {
  return head({
    title: p.title + ' — William Walker Elementary PTC',
    description: p.blurb,
    canonical: SITE + '/blog/' + p.slug,
    ogImage: assetExists(p.hero_image) ? SITE + assetUrl(p.hero_image) : SITE + '/assets/logo.png',
  }).replace('</head>\n', jsonLd(p) + '</head>\n')
    + topbar('blog')
    + '\n  <main id="main">\n'
    + heroHtml(p)
    + '\n    <section class="block block--white" aria-label="' + esc(p.title) + '">\n'
    + '      <div class="wrap">\n'
    + '        <div class="post-body">\n'
    + '          <div class="prose">\n' + renderMd(p.body, SITE) + '\n          </div>\n'
    + '          <p class="post-back"><a href="/blog">← All posts</a></p>\n'
    + '        </div>\n'
    + '      </div>\n    </section>\n'
    + '\n' + moreHtml(p, posts)
    + '  </main>\n\n'
    + FOOTER;
}

function indexPage(posts) {
  const body = posts.length
    ? '        <div class="post-cards">\n' + posts.map(cardHtml).join('\n') + '\n        </div>\n'
    : '        <p class="post-empty">No posts yet — check back soon.</p>\n';
  return head({
    title: 'News — William Walker Elementary PTC',
    description: 'Updates from the William Walker Parent Teacher Club — event recaps, fundraising results, and news for Wildcat families.',
    canonical: SITE + '/blog',
    ogImage: SITE + '/assets/logo.png',
  })
    + topbar('blog')
    + `
  <main id="main">
    <section class="hero hero--gradient" aria-labelledby="hero-title">
      <div class="hero__inner">
        <p class="hero__eyebrow">William Walker PTC</p>
        <h1 id="hero-title" class="hero__title">News</h1>
        <p class="hero__lede">
          Event recaps, fundraising results, and what the PTC is up to at
          William Walker.
        </p>
      </div>
    </section>

    <section class="block block--white" aria-label="Posts">
      <div class="wrap">
${body}      </div>
    </section>
  </main>

`
    + FOOTER;
}

/* ---------- build ---------- */
const posts = loadPosts();
mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) if (f.endsWith('.html')) unlinkSync(join(OUT, f));

for (const p of posts) writeFileSync(join(OUT, p.slug + '.html'), postPage(p, posts));
writeFileSync(join(OUT, 'index.html'), indexPage(posts));
console.log('build-blog: wrote ' + posts.length + ' post(s) + index');
