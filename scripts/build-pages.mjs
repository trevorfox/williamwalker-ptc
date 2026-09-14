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
import { head, topbar, footer } from './lib/chrome.mjs';

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

/* ---------- render ---------- */

function render(p) {
  const d = p.data;
  return head({
    title: d.title,
    description: d.description,
    path: p.path,
    ogTitle: d.og_title,
    ogDescription: d.og_description,
    ogImage: d.og_image,
    headExtra: p.headExtra,
  })
    + topbar(d.nav)
    + '\n' + p.body + '\n\n'
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
