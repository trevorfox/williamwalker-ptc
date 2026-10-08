#!/usr/bin/env node
/* =========================================================================
   Build /blog pages from content/blog/*.md — no dependencies.

   Usage:  node scripts/build-blog.mjs

   Loading, validation, and the card markup live in scripts/lib/posts.mjs so
   build-pages.mjs can embed "latest posts" strips with the same look.

   One .md file = one post. The FILENAME is the URL slug:
   content/blog/fall-carnival.md  →  <site.origin>/blog/fall-carnival

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
import { writeFileSync, readdirSync, mkdirSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { esc, renderMd } from './lib/md.mjs';
import { head, topbar, footer } from './lib/chrome.mjs';
import { loadProgramSponsors, sponsorGrid } from './lib/sponsors.mjs';
import {
  TAGS, loadPosts, usedTags, postsWithTag, fmtDate, assetUrl, assetExists,
  tagUrl, tagListHtml, cardHtml,
} from './lib/posts.mjs';
import config from '../site.config.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
/* Overridable so the smoke test can build a fixture set into a temp directory
   instead of writing through the real output folder. (The content and assets
   directories are overridden the same way, inside lib/posts.mjs.) */
const OUT = process.env.BLOG_OUT_DIR || join(ROOT, 'blog');
const SITE = config.site.origin;

function fail(msg) { console.error('build-blog: ' + msg); process.exit(1); }

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

/* "All · Fundraising · Community …" row above a post list. Only tags that have
   at least one post appear, so the row never links to an empty page. */
function filtersHtml(used, current) {
  if (!used.length) return '';
  const chip = function (href, label, active) {
    return '<a class="tag-chip' + (active ? ' is-active' : '') + '" href="' + href + '"'
      + (active ? ' aria-current="page"' : '') + '>' + esc(label) + '</a>';
  };
  return '        <nav class="post-filters" aria-label="Filter posts by topic">\n'
    + '          <span class="post-filters__label">Show:</span>\n'
    + '          ' + chip('/blog', 'All posts', !current) + '\n'
    + used.map(function (k) { return '          ' + chip(tagUrl(k), TAGS[k].label, k === current); }).join('\n') + '\n'
    + '        </nav>\n';
}

function heroHtml(p) {
  const hasImg = assetExists(p.hero_image) && !p.banner;
  const cls = hasImg ? 'hero hero--image' : 'hero hero--gradient';
  const style = hasImg ? ' style="--hero-img: url(\'' + esc(assetUrl(p.hero_image)) + '\')"' : '';
  const tags = tagListHtml(p.tags, true);
  return '    <section class="' + cls + '"' + style + ' aria-labelledby="hero-title">\n'
    + '      <div class="hero__inner">\n'
    + '        <p class="hero__eyebrow">' + esc(config.org.abbrev) + ' News</p>\n'
    + '        <h1 id="hero-title" class="hero__title">' + esc(p.title) + '</h1>\n'
    + '        ' + metaHtml(p) + '\n'
    + (tags ? '        ' + tags + '\n' : '')
    + '      </div>\n'
    + '    </section>\n';
}

/* A post can show a program's sponsor logos, from that program's sponsors
   list (scripts/lib/sponsors.mjs), with a line of its own:

     <!-- sponsors program="walkerthon" tier="Champion" -->

   tier is optional; without it every sponsor shows in one grid. */
const SPONSORS_RE = /^<!--\s*sponsors\s+program="([a-z0-9-]+)"(?:\s+tier="([^"]+)")?\s*-->$/;

function bodyHtml(p) {
  const rel = p.slug + '.md';
  return p.body.split(/\n{2,}/).map(function (b) {
    const m = b.trim().match(SPONSORS_RE);
    if (!m) return renderMd(b, SITE);
    const list = loadProgramSponsors(m[1], rel, fail).sponsors
      .filter(function (s) { return !m[2] || s.tier === m[2]; });
    if (!list.length) fail(rel + ': no "' + m[2] + '" sponsors in program "' + m[1] + '"');
    return sponsorGrid(m[1], list, '').trimEnd();
  }).filter(Boolean).join('\n');
}

function moreHtml(p, posts) {
  const others = posts.filter(function (o) { return o.slug !== p.slug; }).slice(0, 3);
  if (!others.length) return '';
  return '    <section class="block block--white post-more" aria-labelledby="more-title">\n'
    + '      <div class="wrap">\n'
    + '        <div class="post-more__head">\n'
    + '          <p class="kicker kicker--blue">More from the ' + esc(config.org.abbrev) + '</p>\n'
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
    publisher: { '@type': 'Organization', name: config.org.name },
    mainEntityOfPage: SITE + '/blog/' + p.slug,
    image: assetExists(p.hero_image) ? SITE + assetUrl(p.hero_image) : SITE + config.brand.ogImage,
  };
  if (p.tags.length) data.keywords = p.tags.map(function (k) { return TAGS[k].label; }).join(', ');
  return '  <script type="application/ld+json">' + JSON.stringify(data).replace(/</g, '\\u003c') + '</script>\n';
}

/* ---------- pages ---------- */
function postPage(p, posts) {
  return head({
    title: p.title + ' — ' + config.org.name,
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
    + '          <div class="prose">\n' + bodyHtml(p) + '\n          </div>\n'
    + '          <p class="post-back"><a href="/blog">← All posts</a></p>\n'
    + '        </div>\n'
    + '      </div>\n    </section>\n'
    + '\n' + moreHtml(p, posts)
    + '  </main>\n\n'
    + footer();
}

/* The index and every tag page are the same list page with a different hero
   and a different slice of posts; `tag` is undefined for the index. */
function listPage(shown, all, o) {
  const body = shown.length
    ? '        <div class="post-cards">\n' + shown.map(cardHtml).join('\n') + '\n        </div>\n'
    : '        <p class="post-empty">No posts yet — check back soon.</p>\n';
  return head({
    title: o.title + ' — ' + config.org.name,
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
    eyebrow: config.org.nameShort,
    lede: config.blog.index.lede,
    description: config.blog.index.description,
    path: '/blog',
  });
}

function tagPage(k, posts) {
  const t = TAGS[k];
  const shown = postsWithTag(posts, k);
  return listPage(shown, posts, {
    title: t.label + ' — News',
    heading: t.label,
    eyebrow: config.org.abbrev + ' News',
    lede: t.blurb,
    description: t.blurb,
    path: tagUrl(k),
    tag: k,
  });
}

/* ---------- build ---------- */
const posts = loadPosts(fail);
const TAG_OUT = join(OUT, 'tag');
mkdirSync(TAG_OUT, { recursive: true });
for (const f of readdirSync(OUT)) if (f.endsWith('.html')) unlinkSync(join(OUT, f));
for (const f of readdirSync(TAG_OUT)) if (f.endsWith('.html')) unlinkSync(join(TAG_OUT, f));

for (const p of posts) writeFileSync(join(OUT, p.slug + '.html'), postPage(p, posts));
writeFileSync(join(OUT, 'index.html'), indexPage(posts));
const tags = usedTags(posts);
for (const k of tags) writeFileSync(join(TAG_OUT, k + '.html'), tagPage(k, posts));
console.log('build-blog: wrote ' + posts.length + ' post(s) + index + ' + tags.length + ' tag page(s)');
