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
     cta: Send a Wildcat on a trip       (required unless stub)
     impact:                             (required unless stub)
       - amount: 5
         buys: one student's field trip
     hero_image: field-trips/hero.jpg    (optional; relative to assets/programs/)
     gallery:                            (optional)
       - image: field-trips/coast.jpg
         caption: Tidepooling at the coast
     donate_url: https://…               (optional override of the site default)
     review_note: …                      (ignored by the build; editorial flag)

   Body = story in markdown (## / ### headings, paragraphs, - lists,
   **bold**, *italic*, [text](href), standalone ![alt](src) images).

   Missing images degrade gracefully: hero → brand gradient, gallery
   entries skipped (section omitted if empty), cards → initial tile.
   ========================================================================= */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { esc, parseFrontmatter, renderMd } from './lib/md.mjs';
import { head, topbar, FOOTER } from './lib/chrome.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = join(ROOT, 'content', 'programs');
const OUT = join(ROOT, 'programs');
const ASSETS = join(ROOT, 'assets', 'programs');
const SITE = 'https://williamwalkerptc.com';
const DEFAULT_DONATE = 'https://www.zeffy.com/en-US/peer-to-peer/walkerthon--2026';
const FINEPRINT = 'Amounts are examples of what gifts like yours cover — donations support all PTC programs.';

function fail(msg) { console.error('build-programs: ' + msg); process.exit(1); }

/* ---------- load + validate ---------- */
function loadEntries() {
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
      body: parsed.body,
    };
  });
  entries.sort(function (a, b) { return a.order - b.order || a.title.localeCompare(b.title); });
  return entries;
}

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
  const eyebrow = p.type === 'event' ? 'A PTC Event' : 'Programs & Enrichment';
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
    + '        <h2 id="more-title" class="section-title">More ways Wildcats win.</h2>\n'
    + '        <div class="program-cards">\n'
    + sibs.map(cardHtml).join('\n')
    + '\n        </div>\n'
    + '        <p style="margin-top: 1.6rem;"><a href="/programs">See everything the PTC supports <span aria-hidden="true">→</span></a></p>\n'
    + '      </div>\n    </section>\n';
}

/* ---------- pages ---------- */
function detailPage(p, entries) {
  const kicker = p.type === 'event' ? 'The Event' : 'The Story';
  return head({
    title: p.title + ' — William Walker Elementary PTC',
    description: p.blurb,
    canonical: SITE + '/programs/' + p.slug,
    ogImage: assetExists(p.hero_image) ? SITE + assetUrl(p.hero_image) : SITE + '/assets/logo.png',
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
    + '\n' + impactHtml(p)
    + '\n' + moreHtml(p, entries)
    + '  </main>\n\n'
    + FOOTER;
}

function indexPage(entries) {
  const programs = entries.filter(function (e) { return e.type === 'program'; });
  const events = entries.filter(function (e) { return e.type === 'event'; });
  return head({
    title: 'Programs & Events — William Walker Elementary PTC',
    description: 'Everything the William Walker PTC funds and hosts — enrichment programs, school events, and how your support makes them happen.',
    canonical: SITE + '/programs',
    ogImage: SITE + '/assets/logo.png',
  })
    + topbar('programs')
    + `
  <main id="main">
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero__inner">
        <p class="hero__eyebrow">William Walker PTC</p>
        <h1 id="hero-title" class="hero__title">Programs &amp; Events</h1>
        <p class="hero__lede">
          Every program on this page is funded by families and run by volunteers —
          here's what the PTC makes happen at William Walker, and how you can help.
        </p>
        <div class="hero__actions">
          <a class="btn btn--green" href="${DEFAULT_DONATE}" target="_blank" rel="noopener">Donate <span aria-hidden="true">↗</span></a>
          <a class="btn btn--blue" href="/#get-involved">Sign up for updates</a>
        </div>
      </div>
    </section>

    <section class="block block--white" aria-labelledby="programs-title">
      <div class="wrap">
        <p class="kicker kicker--blue">Programs &amp; Enrichment</p>
        <h2 id="programs-title" class="section-title">What the PTC funds.</h2>
        <div class="program-cards">
${programs.map(cardHtml).join('\n')}
        </div>
      </div>
    </section>

    <section class="block block--blue" aria-labelledby="events-title">
      <div class="wrap">
        <p class="kicker kicker--onblue">Events</p>
        <h2 id="events-title" class="section-title section-title--light">What the PTC hosts.</h2>
        <div class="program-cards">
${events.map(cardHtml).join('\n')}
        </div>
      </div>
    </section>
  </main>

`
    + FOOTER;
}

/* ---------- build ---------- */
const entries = loadEntries();
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
