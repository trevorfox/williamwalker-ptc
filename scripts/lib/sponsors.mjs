/* =========================================================================
   Sponsor logo grid, shared by build-programs.mjs (a program's own page) and
   build-pages.mjs (any src/pages/ page, via <!-- sponsors program="…" -->).

   The list lives in one place: the program's frontmatter.

     sponsors:
       - name: Fine Counsel
         tier: Hero
         url: https://…        (optional)
         own_page_only: true   (optional; only on the program's own page,
                                left out wherever the list is embedded)

   Tiers render in first-appearance order. Logos are found by name:
   assets/programs/<slug>/sponsors/<name-slug>.{svg,png,webp,jpg}
   ("Leo's Lair" → leos-lair.png). No file → the name shows as a text tile.
   ========================================================================= */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { esc, parseFrontmatter } from './md.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ASSETS = join(ROOT, 'assets', 'programs');
const CONTENT = process.env.PROGRAMS_CONTENT_DIR || join(ROOT, 'content', 'programs');
const LOGO_EXTS = ['svg', 'png', 'webp', 'jpg'];

export function slugify(s) {
  return s.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function checkSponsors(list, f, fail) {
  if (list === undefined) return [];
  if (!Array.isArray(list)) fail(f + ': "sponsors" must be a list');
  list.forEach(function (s) {
    if (!s.name || !s.tier) fail(f + ': sponsors need "name" + "tier"');
  });
  return list;
}

// { title, sponsors } for a program, read from content/programs/<slug>.md.
// For embedding on another page or post, so own_page_only sponsors are dropped.
export function loadProgramSponsors(slug, rel, fail) {
  const file = join(CONTENT, slug + '.md');
  if (!existsSync(file)) fail(rel + ': sponsors program "' + slug + '" has no content/programs/' + slug + '.md');
  const d = parseFrontmatter(readFileSync(file, 'utf8'), slug + '.md', fail).data;
  const sponsors = checkSponsors(d.sponsors, slug + '.md', fail)
    .filter(function (s) { return !s.own_page_only; });
  if (!sponsors.length) fail(rel + ': sponsors program "' + slug + '" lists no sponsors');
  return { title: d.title, sponsors: sponsors };
}

function logoFor(slug, s) {
  const base = slug + '/sponsors/' + slugify(s.name);
  for (const ext of LOGO_EXTS) if (existsSync(join(ASSETS, base + '.' + ext))) return base + '.' + ext;
  return '';
}

// One <ul> of logo tiles. Also used on its own inside a blog post
// (build-blog.mjs, <!-- sponsors program="…" tier="…" -->).
export function sponsorGrid(slug, sponsors, indent) {
  return indent + '<ul class="sponsor-grid">\n'
    + sponsors.map(function (s) {
      const logo = logoFor(slug, s);
      const inner = logo
        ? '<img src="/assets/programs/' + esc(logo) + '" alt="' + esc(s.name) + '" loading="lazy" />'
        : '<span class="sponsor__name">' + esc(s.name) + '</span>';
      const body = s.url
        ? '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + inner + '</a>'
        : inner;
      return indent + '  <li class="sponsor' + (logo ? '' : ' sponsor--text') + '">' + body + '</li>';
    }).join('\n')
    + '\n' + indent + '</ul>\n';
}

export function sponsorsHtml(slug, sponsors, title) {
  if (!sponsors.length) return '';
  const tiers = [];
  sponsors.forEach(function (s) { if (tiers.indexOf(s.tier) < 0) tiers.push(s.tier); });
  return '    <section class="block block--white" aria-labelledby="sponsors-title">\n'
    + '      <div class="wrap">\n'
    + '        <p class="kicker kicker--blue">Thank You</p>\n'
    + '        <h2 id="sponsors-title" class="section-title">' + esc(title || 'Our sponsors.') + '</h2>\n'
    + tiers.map(function (tier) {
      return '        <h3 class="sponsor-tier">' + esc(tier) + '</h3>\n'
        + sponsorGrid(slug, sponsors.filter(function (s) { return s.tier === tier; }), '        ');
    }).join('')
    + '      </div>\n    </section>\n';
}
