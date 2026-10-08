#!/usr/bin/env node
/* =========================================================================
   Build /programs pages from content/programs/*.md — no dependencies.

   Usage:  node scripts/build-programs.mjs

   Each .md file = one program/event. Frontmatter schema (YAML subset:
   flat scalars + lists of flat objects, 2-space indent):

     title: Field Trips                  (required)
     type: program | event               (required)
     blurb: one-liner                    (required; index card + meta description)
     order: 20                           (index sort within its type group)
     stub: true                          (index-card only — no page generated)
     cta: Send a student on a trip       (required unless stub)
     impact:                             (required unless stub)
       - amount: 5
         buys: one student's field trip
     hero_image: field-trips/hero.jpg    (optional; relative to assets/programs/)
     gallery:                            (optional)
       - image: field-trips/coast.jpg
         caption: Tidepooling at the coast
     donate_url: https://…               (optional override of the site default)
     sponsors:                           (optional; logo grid — see scripts/lib/sponsors.mjs)
       - name: Fine Counsel
         tier: Hero
     review_note: …                      (ignored by the build; editorial flag)

   Body = story in markdown (## / ### headings, paragraphs, - lists,
   **bold**, *italic*, [text](href), standalone ![alt](src) images).

   Missing images degrade gracefully: hero → brand gradient, gallery
   entries skipped (section omitted if empty), cards → initial tile.
   ========================================================================= */
import { writeFileSync, readdirSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { esc, renderMd } from './lib/md.mjs';
import { head, topbar, footer } from './lib/chrome.mjs';
import { sponsorsHtml } from './lib/sponsors.mjs';
import { loadPrograms } from './lib/programs.mjs';
import config from '../site.config.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.PROGRAMS_OUT_DIR || join(ROOT, 'programs');
const ASSETS = join(ROOT, 'assets', 'programs');
const SITE = config.site.origin;
const FINEPRINT = 'Amounts are examples of what gifts like yours cover — donations support all ' + config.org.abbrev + ' programs.';

function fail(msg) { console.error('build-programs: ' + msg); process.exit(1); }


function assetUrl(rel) { return '/assets/programs/' + rel; }
function assetExists(rel) { return !!rel && existsSync(join(ASSETS, rel)); }

/* ---------- page pieces ---------- */
function donateBtn(p, cls, label) {
  return '<a class="btn ' + cls + '" href="' + esc(p.donate_url) + '" target="_blank" rel="noopener" data-program-donate="' + esc(p.slug) + '">'
    + esc(label) + ' <span aria-hidden="true">↗</span></a>';
}

function heroHtml(p) {
  const hasImg = assetExists(p.hero_image);
  const cls = hasImg ? 'hero hero--image' : 'hero hero--gradient';
  const style = hasImg ? ' style="--hero-img: url(\'' + esc(assetUrl(p.hero_image)) + '\')"' : '';
  const eyebrow = p.type === 'event' ? 'A ' + config.org.abbrev + ' Event' : 'Programs & Enrichment';
  return '    <section class="' + cls + '"' + style + ' aria-labelledby="hero-title">\n'
    + '      <div class="hero__inner">\n'
    + '        <p class="hero__eyebrow">' + eyebrow + '</p>\n'
    + '        <h1 id="hero-title" class="hero__title">' + esc(p.title) + '</h1>\n'
    + '        <p class="hero__lede">' + esc(p.blurb) + '</p>\n'
    + '        <div class="hero__actions">\n'
    + '          ' + donateBtn(p, 'btn--green', p.cta) + '\n'
    + '          <a class="btn btn--outline-light" href="#impact">See your impact <span aria-hidden="true">↓</span></a>\n'
    + '        </div>\n'
    + '      </div>\n'
    + '    </section>\n';
}

function galleryHtml(p) {
  const shots = p.gallery.filter(function (g) {
    if (assetExists(g.image)) return true;
    console.warn('build-programs: ' + p.slug + ': gallery image missing, skipped: ' + g.image);
    return false;
  });
  if (!shots.length) return '';
  return '    <section class="block block--white" aria-label="' + esc(p.title) + ' photos">\n'
    + '      <div class="wrap">\n'
    + '        <p class="kicker kicker--blue">In Photos</p>\n'
    + '        <div class="gallery">\n'
    + shots.map(function (g) {
      return '          <figure>\n'
        + '            <img src="' + esc(assetUrl(g.image)) + '" alt="' + esc(g.caption || p.title) + '" loading="lazy" />\n'
        + (g.caption ? '            <figcaption>' + esc(g.caption) + '</figcaption>\n' : '')
        + '          </figure>';
    }).join('\n')
    + '\n        </div>\n      </div>\n    </section>\n';
}

function impactHtml(p) {
  return '    <section id="impact" class="block block--green" aria-labelledby="impact-title">\n'
    + '      <div class="wrap">\n'
    + '        <p class="kicker kicker--ongreen">Make It Happen</p>\n'
    + '        <h2 id="impact-title" class="section-title section-title--light">What your gift covers.</h2>\n'
    + '        <div class="impact-grid">\n'
    + p.impact.map(function (t) {
      return '          <div class="impact-card">\n'
        + '            <span class="impact-card__amount">$' + t.amount + '</span>\n'
        + '            <span class="impact-card__buys">' + esc(t.buys) + '</span>\n'
        + '          </div>';
    }).join('\n')
    + '\n        </div>\n'
    + '        <div class="impact-cta">\n'
    + '          ' + donateBtn(p, 'btn--white', p.cta) + '\n'
    + '        </div>\n'
    + '        <p class="fineprint fineprint--light">' + FINEPRINT + '</p>\n'
    + '      </div>\n    </section>\n';
}

function cardHtml(p) {
  const hasImg = assetExists(p.hero_image);
  const media = hasImg
    ? '<div class="program-card__media"><img src="' + esc(assetUrl(p.hero_image)) + '" alt="" loading="lazy" /></div>'
    : '<div class="program-card__media program-card__ph" aria-hidden="true"><span>' + esc(p.title.charAt(0)) + '</span></div>';
  const body = '<div class="program-card__body"><h3>' + esc(p.title) + '</h3><p>' + esc(p.blurb) + '</p>'
    + (p.stub ? '' : '<span class="program-card__more">Learn more <span aria-hidden="true">→</span></span>')
    + '</div>';
  if (p.stub) return '          <article class="program-card">' + media + body + '</article>';
  return '          <article class="program-card program-card--link"><a class="program-card__link" href="/programs/' + esc(p.slug) + '">' + media + body + '</a></article>';
}

function moreHtml(p, entries) {
  const sibs = entries.filter(function (e) { return !e.stub && e.slug !== p.slug; }).slice(0, 3);
  if (!sibs.length) return '';
  return '    <section class="block block--white" aria-labelledby="more-title">\n'
    + '      <div class="wrap">\n'
    + '        <p class="kicker kicker--blue">Keep Exploring</p>\n'
    + '        <h2 id="more-title" class="section-title">' + esc(config.programs.moreHeading) + '</h2>\n'
    + '        <div class="program-cards">\n'
    + sibs.map(cardHtml).join('\n')
    + '\n        </div>\n'
    + '        <p style="margin-top: 1.6rem;"><a href="/programs">See everything the ' + esc(config.org.abbrev) + ' supports <span aria-hidden="true">→</span></a></p>\n'
    + '      </div>\n    </section>\n';
}

/* ---------- pages ---------- */
function detailPage(p, entries) {
  const kicker = p.type === 'event' ? 'The Event' : 'The Story';
  return head({
    title: p.title + ' — ' + config.org.name,
    description: p.blurb,
    path: '/programs/' + p.slug,
    ogImage: assetExists(p.hero_image) ? assetUrl(p.hero_image) : undefined,
  })
    + topbar('programs')
    + '\n  <main id="main">\n'
    + heroHtml(p)
    + '\n    <section class="block block--white" aria-labelledby="story-title">\n'
    + '      <div class="wrap">\n'
    + '        <p class="kicker kicker--blue">' + kicker + '</p>\n'
    + '        <div class="prose">\n' + renderMd(p.body, SITE) + '\n        </div>\n'
    + '      </div>\n    </section>\n'
    + '\n' + galleryHtml(p)
    + (p.sponsors.length ? '\n' + sponsorsHtml(p.slug, p.sponsors) : '')
    + '\n' + impactHtml(p)
    + '\n' + moreHtml(p, entries)
    + '  </main>\n\n'
    + footer();
}

function indexPage(entries) {
  const programs = entries.filter(function (e) { return e.type === 'program'; });
  const events = entries.filter(function (e) { return e.type === 'event'; });
  return head({
    title: 'Programs & Events — ' + config.org.name,
    description: config.programs.index.description,
    path: '/programs',
  })
    + topbar('programs')
    + `
  <main id="main">
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero__inner">
        <p class="hero__eyebrow">${esc(config.org.nameShort)}</p>
        <h1 id="hero-title" class="hero__title">Programs &amp; Events</h1>
        <p class="hero__lede">
          ${esc(config.programs.index.lede)}
        </p>
        <div class="hero__actions">
          <a class="btn btn--green" href="${config.links.donate}" target="_blank" rel="noopener">Donate <span aria-hidden="true">↗</span></a>
          <a class="btn btn--blue" href="/#get-involved">Sign up for updates</a>
        </div>
      </div>
    </section>

    <section class="block block--white" aria-labelledby="programs-title">
      <div class="wrap">
        <p class="kicker kicker--blue">Programs &amp; Enrichment</p>
        <h2 id="programs-title" class="section-title">What the ${esc(config.org.abbrev)} funds.</h2>
        <div class="program-cards">
${programs.map(cardHtml).join('\n')}
        </div>
      </div>
    </section>

    <section class="block block--blue" aria-labelledby="events-title">
      <div class="wrap">
        <p class="kicker kicker--onblue">Events</p>
        <h2 id="events-title" class="section-title section-title--light">What the ${esc(config.org.abbrev)} hosts.</h2>
        <div class="program-cards">
${events.map(cardHtml).join('\n')}
        </div>
      </div>
    </section>
  </main>

`
    + footer();
}

/* ---------- build ---------- */
const entries = loadPrograms(fail);
mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) if (f.endsWith('.html')) unlinkSync(join(OUT, f));

let pages = 0;
for (const p of entries) {
  if (p.stub) continue;
  writeFileSync(join(OUT, p.slug + '.html'), detailPage(p, entries));
  pages++;
}
writeFileSync(join(OUT, 'index.html'), indexPage(entries));
console.log('build-programs: wrote ' + pages + ' detail page(s) + index (' + entries.length + ' entries, '
  + entries.filter(function (e) { return e.stub; }).length + ' stubs)');
