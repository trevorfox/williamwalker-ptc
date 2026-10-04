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
     hero_style: banner                       (optional; show hero_image undimmed
                                               below the title instead of behind it —
                                               for artwork with its own text/logo)
     tags:   fundraising, community           (optional; comma-separated keys from
                                               config.blog.tags — unknown keys fail
                                               the build; each used tag gets a page
                                               at /blog/tag/<key>)
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
import { head, topbar, footer } from './lib/chrome.mjs';
import config from '../site.config.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
/* Overridable so the smoke test can build a fixture set into a temp directory
   instead of writing through the real content and output folders. */
const CONTENT = process.env.BLOG_CONTENT_DIR || join(ROOT, 'content', 'blog');
const OUT = process.env.BLOG_OUT_DIR || join(ROOT, 'blog');
const ASSETS = process.env.BLOG_ASSETS_DIR || join(ROOT, 'assets', 'blog');
const SITE = config.site.origin;
const TAGS = (config.blog && config.blog.tags) || {};
const TAG_KEYS = Object.keys(TAGS);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function fail(msg) { console.error('build-blog: ' + msg); process.exit(1); }

/* Format YYYY-MM-DD without going through Date(), which would parse the
   string as UTC midnight and render as the previous day west of Greenwich. */
function fmtDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return MONTHS[m - 1] + ' ' + d + ', ' + y;
}

/* `tags: a, b` → ['a', 'b'], in config order, deduplicated. Unknown keys are a
   hard error so a typo cannot silently create a one-post tag page. */
function parseTags(raw, file) {
  if (raw === undefined || raw === '') return [];
  const given = String(raw).split(',').map(function (t) { return t.trim().toLowerCase(); }).filter(Boolean);
  given.forEach(function (t) {
    if (!TAGS[t]) fail(file + ': unknown tag "' + t + '" (allowed: ' + TAG_KEYS.join(', ') + ')');
  });
  return TAG_KEYS.filter(function (k) { return given.indexOf(k) !== -1; });
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
        banner: d.hero_style === 'banner',
        tags: parseTags(d.tags, f),
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

/* A "banner" post keeps the gradient hero for the title and shows the artwork
   at full width right under it, untouched — no dark overlay, no cropping. */
function bannerHtml(p) {
  if (!p.banner || !assetExists(p.hero_image)) return '';
  return '    <figure class="post-banner"><img src="' + esc(assetUrl(p.hero_image))
    + '" alt="" /></figure>\n';
}

function tagUrl(k) { return '/blog/tag/' + k; }

/* Linked chips (post hero). Cards use the static form because the whole card
   is already one <a>, and anchors cannot nest. */
function tagListHtml(tags, linked) {
  if (!tags.length) return '';
  return '<ul class="post-tags" aria-label="Topics">'
    + tags.map(function (k) {
      return linked
        ? '<li><a class="tag-chip" href="' + tagUrl(k) + '">' + esc(TAGS[k].label) + '</a></li>'
        : '<li><span class="tag-chip">' + esc(TAGS[k].label) + '</span></li>';
    }).join('')
    + '</ul>';
}

/* "All · Fundraising · Community …" row above a post list. Only tags that have
   at least one post appear, so the row never links to an empty page. */
function filtersHtml(usedTags, current) {
  if (!usedTags.length) return '';
  const chip = function (href, label, active) {
    return '<a class="tag-chip' + (active ? ' is-active' : '') + '" href="' + href + '"'
      + (active ? ' aria-current="page"' : '') + '>' + esc(label) + '</a>';
  };
  return '        <nav class="post-filters" aria-label="Filter posts by topic">\n'
    + '          <span class="post-filters__label">Show:</span>\n'
    + '          ' + chip('/blog', 'All posts', !current) + '\n'
    + usedTags.map(function (k) { return '          ' + chip(tagUrl(k), TAGS[k].label, k === current); }).join('\n') + '\n'
    + '        </nav>\n';
}

function heroHtml(p) {
  const hasImg = assetExists(p.hero_image) && !p.banner;
  const cls = hasImg ? 'hero hero--image' : 'hero hero--gradient';
  const style = hasImg ? ' style="--hero-img: url(\'' + esc(assetUrl(p.hero_image)) + '\')"' : '';
  const tags = tagListHtml(p.tags, true);
  return '    <section class="' + cls + '"' + style + ' aria-labelledby="hero-title">\n'
    + '      <div class="hero__inner">\n'
    + '        <p class="hero__eyebrow">PTC News</p>\n'
    + '        <h1 id="hero-title" class="hero__title">' + esc(p.title) + '</h1>\n'
    + '        ' + metaHtml(p) + '\n'
    + (tags ? '        ' + tags + '\n' : '')
    + '      </div>\n'
    + '    </section>\n';
}

function cardHtml(p) {
  const hasImg = assetExists(p.hero_image);
  const mediaCls = 'post-card__media' + (p.banner ? ' post-card__media--contain' : '');
  const media = hasImg
    ? '<div class="' + mediaCls + '"><img src="' + esc(assetUrl(p.hero_image)) + '" alt="" loading="lazy" /></div>'
    : '';
  return '          <article class="post-card">\n'
    + '            <a class="post-card__link" href="/blog/' + esc(p.slug) + '">' + media
    + '<div class="post-card__body">'
    + '<p class="post-card__date"><time datetime="' + p.date + '">' + fmtDate(p.date) + '</time></p>'
    + '<h3>' + esc(p.title) + '</h3>'
    + '<p>' + esc(p.blurb) + '</p>'
    + tagListHtml(p.tags, false)
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
  if (p.tags.length) data.keywords = p.tags.map(function (k) { return TAGS[k].label; }).join(', ');
  return '  <script type="application/ld+json">' + JSON.stringify(data).replace(/</g, '\\u003c') + '</script>\n';
}

/* ---------- pages ---------- */
function postPage(p, posts) {
  return head({
    title: p.title + ' — William Walker Elementary PTC',
    description: p.blurb,
    path: '/blog/' + p.slug,
    ogImage: assetExists(p.hero_image) ? assetUrl(p.hero_image) : undefined,
    headExtra: jsonLd(p),
  })
    + topbar('blog')
    + '\n  <main id="main">\n'
    + heroHtml(p)
    + bannerHtml(p)
    + '\n    <section class="block block--white" aria-label="' + esc(p.title) + '">\n'
    + '      <div class="wrap">\n'
    + '        <div class="post-body">\n'
    + '          <div class="prose">\n' + renderMd(p.body, SITE) + '\n          </div>\n'
    + '          <p class="post-back"><a href="/blog">← All posts</a></p>\n'
    + '        </div>\n'
    + '      </div>\n    </section>\n'
    + '\n' + moreHtml(p, posts)
    + '  </main>\n\n'
    + footer();
}

/* Tags that at least one live post uses, in config order. */
function usedTags(posts) {
  return TAG_KEYS.filter(function (k) {
    return posts.some(function (p) { return p.tags.indexOf(k) !== -1; });
  });
}

/* The index and every tag page are the same list page with a different hero
   and a different slice of posts; `tag` is undefined for the index. */
function listPage(shown, all, o) {
  const body = shown.length
    ? '        <div class="post-cards">\n' + shown.map(cardHtml).join('\n') + '\n        </div>\n'
    : '        <p class="post-empty">No posts yet — check back soon.</p>\n';
  return head({
    title: o.title + ' — William Walker Elementary PTC',
    description: o.description,
    path: o.path,
  })
    + topbar('blog')
    + `
  <main id="main">
    <section class="hero hero--gradient" aria-labelledby="hero-title">
      <div class="hero__inner">
        <p class="hero__eyebrow">${esc(o.eyebrow)}</p>
        <h1 id="hero-title" class="hero__title">${esc(o.heading)}</h1>
        <p class="hero__lede">${esc(o.lede)}</p>
      </div>
    </section>

    <section class="block block--white" aria-label="Posts">
      <div class="wrap">
${filtersHtml(usedTags(all), o.tag)}${body}      </div>
    </section>
  </main>

`
    + footer();
}

function indexPage(posts) {
  return listPage(posts, posts, {
    title: 'News',
    heading: 'News',
    eyebrow: 'William Walker PTC',
    lede: 'Event recaps, fundraising results, and what the PTC is up to at William Walker.',
    description: 'Updates from the William Walker Parent Teacher Club — event recaps, fundraising results, and news for Wildcat families.',
    path: '/blog',
  });
}

function tagPage(k, posts) {
  const t = TAGS[k];
  const shown = posts.filter(function (p) { return p.tags.indexOf(k) !== -1; });
  return listPage(shown, posts, {
    title: t.label + ' — News',
    heading: t.label,
    eyebrow: 'PTC News',
    lede: t.blurb,
    description: t.blurb,
    path: tagUrl(k),
    tag: k,
  });
}

/* ---------- build ---------- */
const posts = loadPosts();
const TAG_OUT = join(OUT, 'tag');
mkdirSync(TAG_OUT, { recursive: true });
for (const f of readdirSync(OUT)) if (f.endsWith('.html')) unlinkSync(join(OUT, f));
for (const f of readdirSync(TAG_OUT)) if (f.endsWith('.html')) unlinkSync(join(TAG_OUT, f));

for (const p of posts) writeFileSync(join(OUT, p.slug + '.html'), postPage(p, posts));
writeFileSync(join(OUT, 'index.html'), indexPage(posts));
const tags = usedTags(posts);
for (const k of tags) writeFileSync(join(TAG_OUT, k + '.html'), tagPage(k, posts));
console.log('build-blog: wrote ' + posts.length + ' post(s) + index + ' + tags.length + ' tag page(s)');
