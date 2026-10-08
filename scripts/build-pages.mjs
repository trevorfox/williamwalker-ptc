#!/usr/bin/env node
/* =========================================================================
   build-pages — the hand-written pages.

   Source lives in src/pages/. Each file is frontmatter followed by the page's
   <main> block and nothing else; this wraps it in the shared chrome so the
   header, nav, and footer exist in exactly one place (scripts/lib/chrome.mjs,
   driven by site.config.mjs) instead of once per page.

     src/pages/minutes.html        ->  /minutes.html
     src/pages/index.html          ->  /index.html         (path "/")
     src/pages/families/faq.html   ->  /families/faq.html

   The URL path is derived from the filename, the same way a blog post's slug
   is, so there is no way for the two to disagree.

   Frontmatter:
     title           required. <title> and, unless overridden, og:title.
     description     required. meta description and, unless overridden, og:description.
     nav             optional. A `key` from the nav tree in site.config.mjs;
                     highlights that link and any submenu holding it.
     og_title        optional. Social-card title, when it should differ from
     og_description  optional.   the page title (the home page does this).
     og_image        optional. Site-relative; defaults to the logo.
     scripts         optional. Extra <script src> after /script.js, in order:
                       scripts:
                         - src: /calendar.js
                     (parseFrontmatter takes lists of key: value objects only,
                     so a bare "- /calendar.js" will not parse.)
     note_suffix     optional. One more sentence on the footer disclaimer.

   A page needing extra <head> markup puts it in a sibling <name>.head.html —
   families/faq.html does this for its FAQPage JSON-LD.

   A page may embed the newest posts carrying a blog tag:

     <!-- latest-posts tag="fundraising" count="3" -->

   It expands to the same card grid the blog uses plus an "All … news" link to
   the tag page (scripts/lib/posts.mjs). The tag must exist in config.blog.tags.
   Because the strip is baked in at build time, publishing a post with that tag
   changes this page too — the full `npm run build:site` handles it.

   Three more fills, all in scripts/lib/page-data.mjs:

     {{meetings.time}}         a string from site.config.mjs; also works in the
                               frontmatter. Filters: {{x|cap}}, {{x|url}}, {{x|host}}
     <!-- social-links -->     the labeled list of config.social accounts
     <!-- minutes-list -->     the /minutes archive, from content/minutes.json
     <!-- faq-jsonld -->       (in a .head.html) FAQPage JSON-LD generated from
                               the page's own <details class="qa-item"> blocks

   And a sponsor logo grid, from the sponsors list in a program's markdown
   (scripts/lib/sponsors.mjs), so the list is kept in one place:

     <!-- sponsors program="walkerthon" -->

   And the home page's programs + events list, from content/programs/
   (scripts/lib/programs.mjs). Anything with its own /programs page is linked:

     <!-- program-list -->

   Unlike the blog and programs builds this does NOT clear its output first:
   it writes into the repository root, where deleting every *.html would take
   hand-maintained files with it. Renaming a page means deleting the old
   output by hand.

     node scripts/build-pages.mjs
   ========================================================================= */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter } from './lib/md.mjs';
import { head, topbar, footer, socialLinksHtml } from './lib/chrome.mjs';
import { TAGS, loadPosts, latestStripHtml } from './lib/posts.mjs';
import { fillTokens, minutesHtml, faqJsonLd } from './lib/page-data.mjs';
import { loadProgramSponsors, sponsorsHtml } from './lib/sponsors.mjs';
import { loadPrograms, programListHtml } from './lib/programs.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.env.PAGES_SRC_DIR || join(ROOT, 'src', 'pages');
const OUT = process.env.PAGES_OUT_DIR || ROOT;

function fail(msg) {
  console.error('build-pages: ' + msg);
  process.exit(1);
}

/* ---------- discover ---------- */

// Recurse so families/faq.html keeps its subdirectory.
function sources(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sources(full));
    else if (entry.name.endsWith('.html') && !entry.name.endsWith('.head.html')) out.push(full);
  }
  return out;
}

/* /index.html is served at "/", everything else drops the extension because
   vercel.json sets cleanUrls. */
function urlPath(rel) {
  const noExt = rel.replace(/\.html$/, '');
  return noExt === 'index' ? '/' : '/' + noExt;
}

function parse(file) {
  const rel = relative(SRC, file).split('\\').join('/');
  const { data, body } = parseFrontmatter(readFileSync(file, 'utf8'), rel, fail);
  if (!data.title) fail(rel + ': missing title');
  if (!data.description) fail(rel + ': missing description');
  if (!body.trim()) fail(rel + ': no page content after the frontmatter');

  const headFile = file.replace(/\.html$/, '.head.html');
  return {
    rel,
    out: rel,
    path: urlPath(rel),
    data,
    body,
    headExtra: existsSync(headFile) ? readFileSync(headFile, 'utf8') : '',
  };
}

/* ---------- latest-posts strips ---------- */

const STRIP_RE = /<!--\s*latest-posts\s+tag="([a-z-]+)"(?:\s+count="(\d+)")?\s*-->/g;
let postsCache = null;
function posts() {
  if (!postsCache) postsCache = loadPosts(fail);
  return postsCache;
}

function expandStrips(body, rel) {
  return body.replace(STRIP_RE, function (_, tag, count) {
    if (!TAGS[tag]) fail(rel + ': latest-posts tag "' + tag + '" is not in config.blog.tags');
    return latestStripHtml(posts(), tag, count ? Number(count) : 3).replace(/\n$/, '');
  });
}

/* ---------- programs list ---------- */

const PROGRAM_LIST_RE = /^[ \t]*<!--\s*program-list\s*-->[ \t]*\n?/m;

function expandProgramList(body) {
  if (!PROGRAM_LIST_RE.test(body)) return body;
  return body.replace(PROGRAM_LIST_RE, () => programListHtml(loadPrograms(fail)));
}

/* ---------- sponsor grids ---------- */

const SPONSORS_RE = /^[ \t]*<!--\s*sponsors\s+program="([a-z0-9-]+)"\s*-->[ \t]*\n?/gm;

function expandSponsors(body, rel) {
  return body.replace(SPONSORS_RE, function (_, slug) {
    const p = loadProgramSponsors(slug, rel, fail);
    return sponsorsHtml(slug, p.sponsors, 'Our ' + p.title + ' sponsors.');
  });
}

/* ---------- minutes, tokens, FAQ schema ---------- */

const MINUTES_RE = /^[ \t]*<!--\s*minutes-list\s*-->[ \t]*\n?/m;
const MINUTES_FILE = process.env.MINUTES_FILE || join(ROOT, 'content', 'minutes.json');

function expandMinutes(body, rel) {
  if (!MINUTES_RE.test(body)) return body;
  let entries;
  try { entries = JSON.parse(readFileSync(MINUTES_FILE, 'utf8')); }
  catch (e) { fail(rel + ': cannot read content/minutes.json — ' + e.message); }
  return body.replace(MINUTES_RE, () => minutesHtml(entries, rel, fail));
}

const SOCIAL_RE = /^[ \t]*<!--\s*social-links\s*-->[ \t]*\n?/gm;

function expandSocial(body) {
  return body.replace(SOCIAL_RE, () => socialLinksHtml());
}

const FAQ_RE = /^[ \t]*<!--\s*faq-jsonld\s*-->[ \t]*$/m;

function expandHead(headExtra, body, rel, path) {
  const filled = fillTokens(headExtra, rel, fail);
  if (!FAQ_RE.test(filled)) return filled;
  const ld = faqJsonLd(body, path);
  if (!ld.count) fail(rel + ': <!-- faq-jsonld --> but the page has no <details class="qa-item"> blocks');
  return filled.replace(FAQ_RE, () => ld.html);
}

/* ---------- render ---------- */

function render(p) {
  const d = {};
  for (const k of Object.keys(p.data)) {
    d[k] = typeof p.data[k] === 'string' ? fillTokens(p.data[k], p.rel, fail, true) : p.data[k];
  }
  const body = fillTokens(expandSocial(expandStrips(expandSponsors(expandProgramList(expandMinutes(p.body, p.rel)), p.rel), p.rel)), p.rel, fail);
  return head({
    title: d.title,
    description: d.description,
    path: p.path,
    ogTitle: d.og_title,
    ogDescription: d.og_description,
    ogImage: d.og_image,
    headExtra: expandHead(p.headExtra, body, p.rel, p.path),
  })
    + topbar(d.nav)
    + '\n' + body + '\n\n'
    + footer({
      scripts: (d.scripts || []).map((s) => s.src),
      noteSuffix: d.note_suffix,
    });
}

/* ---------- build ---------- */

if (!existsSync(SRC)) fail('no source directory at ' + SRC);

const pages = sources(SRC).map(parse);
if (!pages.length) fail('no pages found in ' + SRC);

for (const p of pages) {
  const dest = join(OUT, p.out);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, render(p));
}

console.log('build-pages: wrote ' + pages.length + ' page(s)');
