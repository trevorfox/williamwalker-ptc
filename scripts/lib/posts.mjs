/* =========================================================================
   posts — the blog's content model, shared by every generator that shows posts.

   build-blog.mjs renders the blog itself; build-pages.mjs drops "latest posts"
   strips into hand-written pages (the fundraising page lists the three newest
   fundraising posts). Both read content/blog/*.md through loadPosts() and draw
   cards through cardHtml(), so a post looks the same wherever it appears and a
   tag is validated once, against config.blog.tags.

   Directories honour the same env overrides the blog smoke test uses, so a
   fixture build never touches the real content.
   ========================================================================= */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { esc, parseFrontmatter } from './md.mjs';
import config from '../../site.config.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CONTENT = process.env.BLOG_CONTENT_DIR || join(ROOT, 'content', 'blog');
export const ASSETS = process.env.BLOG_ASSETS_DIR || join(ROOT, 'assets', 'blog');

export const TAGS = (config.blog && config.blog.tags) || {};
export const TAG_KEYS = Object.keys(TAGS);

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/* Format YYYY-MM-DD without going through Date(), which would parse the
   string as UTC midnight and render as the previous day west of Greenwich. */
export function fmtDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return MONTHS[m - 1] + ' ' + d + ', ' + y;
}

export function assetUrl(rel) { return '/assets/blog/' + rel; }
export function assetExists(rel) { return !!rel && existsSync(join(ASSETS, rel)); }
export function tagUrl(k) { return '/blog/tag/' + k; }

/* `tags: a, b` → ['a', 'b'], in config order, deduplicated. Unknown keys are a
   hard error so a typo cannot silently create a one-post tag page. */
function parseTags(raw, file, fail) {
  if (raw === undefined || raw === '') return [];
  const given = String(raw).split(',').map(function (t) { return t.trim().toLowerCase(); }).filter(Boolean);
  given.forEach(function (t) {
    if (!TAGS[t]) fail(file + ': unknown tag "' + t + '" (allowed: ' + TAG_KEYS.join(', ') + ')');
  });
  return TAG_KEYS.filter(function (k) { return given.indexOf(k) !== -1; });
}

/* Every live (non-draft) post, newest first. `fail` is the caller's so the
   message carries the right generator's name. */
export function loadPosts(fail) {
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
        tags: parseTags(d.tags, f, fail),
        draft: !!d.draft,
        body: parsed.body,
      };
    })
    .filter(function (p) { return !p.draft; });
  posts.sort(function (a, b) { return b.date.localeCompare(a.date) || a.title.localeCompare(b.title); });
  return posts;
}

/* Tags that at least one live post uses, in config order. */
export function usedTags(posts) {
  return TAG_KEYS.filter(function (k) {
    return posts.some(function (p) { return p.tags.indexOf(k) !== -1; });
  });
}

export function postsWithTag(posts, k) {
  return posts.filter(function (p) { return p.tags.indexOf(k) !== -1; });
}

/* Linked chips (post hero). Cards use the static form because the whole card
   is already one <a>, and anchors cannot nest. */
export function tagListHtml(tags, linked) {
  if (!tags.length) return '';
  return '<ul class="post-tags" aria-label="Topics">'
    + tags.map(function (k) {
      return linked
        ? '<li><a class="tag-chip" href="' + tagUrl(k) + '">' + esc(TAGS[k].label) + '</a></li>'
        : '<li><span class="tag-chip">' + esc(TAGS[k].label) + '</span></li>';
    }).join('')
    + '</ul>';
}

export function cardHtml(p) {
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

/* A "latest N posts with this tag" strip for hand-written pages: the card
   grid plus a link to the tag page. Renders a quiet placeholder rather than
   nothing when the tag has no posts yet, so the section it sits in still
   reads sensibly. */
export function latestStripHtml(posts, k, n) {
  const t = TAGS[k];
  const shown = postsWithTag(posts, k).slice(0, n);
  if (!shown.length) {
    return '        <p class="post-empty">No ' + esc(t.label.toLowerCase()) + ' posts yet — check back soon.</p>\n';
  }
  return '        <div class="post-cards">\n' + shown.map(cardHtml).join('\n') + '\n        </div>\n'
    + '        <p class="posts-strip__more"><a href="' + tagUrl(k) + '">All ' + esc(t.label.toLowerCase())
    + ' news <span aria-hidden="true">→</span></a></p>\n';
}
