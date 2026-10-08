/* =========================================================================
   Programs and events, loaded from content/programs/*.md (frontmatter schema
   in build-programs.mjs). Shared by build-programs.mjs, which writes the
   /programs pages, and build-pages.mjs, whose <!-- program-list --> fill
   puts the same list on the home page.
   ========================================================================= */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { esc, parseFrontmatter } from './md.mjs';
import { checkSponsors } from './sponsors.mjs';
import config from '../../site.config.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CONTENT = process.env.PROGRAMS_CONTENT_DIR || join(ROOT, 'content', 'programs');
const DEFAULT_DONATE = config.links.donate;

/* ---------- load + validate ---------- */
export function loadPrograms(fail) {
  if (!existsSync(CONTENT)) fail('content dir missing: ' + CONTENT);
  const entries = readdirSync(CONTENT).filter(function (f) { return f.endsWith('.md'); }).sort().map(function (f) {
    const parsed = parseFrontmatter(readFileSync(join(CONTENT, f), 'utf8'), f, fail);
    const d = parsed.data;
    ['title', 'type', 'blurb'].forEach(function (k) { if (!d[k]) fail(f + ': missing required "' + k + '"'); });
    if (d.type !== 'program' && d.type !== 'event') fail(f + ': type must be "program" or "event", got "' + d.type + '"');
    if (!d.stub) {
      if (!d.cta) fail(f + ': missing "cta" (required unless stub: true)');
      if (!Array.isArray(d.impact) || !d.impact.length) fail(f + ': needs at least one impact tier (or stub: true)');
      d.impact.forEach(function (t) {
        if (typeof t.amount !== 'number' || !t.buys) fail(f + ': impact tiers need numeric "amount" + "buys"');
      });
    }
    return {
      slug: f.replace(/\.md$/, ''),
      title: d.title, type: d.type, blurb: d.blurb,
      order: typeof d.order === 'number' ? d.order : 999,
      stub: !!d.stub, cta: d.cta || '', impact: d.impact || [],
      hero_image: d.hero_image || '', gallery: Array.isArray(d.gallery) ? d.gallery : [],
      donate_url: d.donate_url || DEFAULT_DONATE,
      sponsors: checkSponsors(d.sponsors, f, fail),
      body: parsed.body,
    };
  });
  entries.sort(function (a, b) { return a.order - b.order || a.title.localeCompare(b.title); });
  return entries;
}

/* ---------- home page list ---------- */

// Programs as pills, events as cards, both in `order`. Anything that has its
// own page (not a stub) links to it, so publishing a page links it here too.
export function programListHtml(entries) {
  const programs = entries.filter(function (e) { return e.type === 'program'; });
  const events = entries.filter(function (e) { return e.type === 'event'; });
  return '        <h3 class="subhead subhead--light">Programs &amp; enrichment we fund</h3>\n'
    + '        <ul class="pill-list" aria-label="Programs and enrichment funded by the ' + esc(config.org.abbrev) + '">\n'
    + programs.map(function (e) {
      const t = esc(e.title);
      return '          <li class="pill">' + (e.stub ? t : '<a href="/programs/' + esc(e.slug) + '">' + t + '</a>') + '</li>';
    }).join('\n')
    + '\n        </ul>\n\n'
    + '        <h3 class="subhead subhead--light">Events we host</h3>\n'
    + '        <div class="event-grid">\n'
    + events.map(function (e) {
      return '          <article class="event-card">\n'
        + '            <h4>' + esc(e.title) + '</h4>\n'
        + '            <p>' + esc(e.blurb) + '</p>\n'
        + (e.stub ? '' : '            <a class="program-card__more" href="/programs/' + esc(e.slug) + '">Learn more <span aria-hidden="true">→</span></a>\n')
        + '          </article>';
    }).join('\n')
    + '\n        </div>\n';
}
