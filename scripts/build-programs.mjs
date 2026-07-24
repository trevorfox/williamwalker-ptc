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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = join(ROOT, 'content', 'programs');
const OUT = join(ROOT, 'programs');
const ASSETS = join(ROOT, 'assets', 'programs');
const SITE = 'https://williamwalkerptc.com';
const DEFAULT_DONATE = 'https://www.zeffy.com/en-US/peer-to-peer/walkerthon--2026';
const FINEPRINT = 'Amounts are examples of what gifts like yours cover — donations support all PTC programs.';

function fail(msg) { console.error('build-programs: ' + msg); process.exit(1); }
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

/* ---------- frontmatter (YAML subset) ---------- */
function scalar(v) {
  if (/^".*"$/.test(v) || /^'.*'$/.test(v)) return v.slice(1, -1);
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}
function parseFrontmatter(src, file) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) fail(file + ': missing frontmatter block (--- … ---)');
  const data = {};
  let listKey = null, listItem = null;
  for (const raw of m[1].split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const indent = raw.match(/^ */)[0].length;
    const line = raw.trim();
    if (indent === 0) {
      listKey = null; listItem = null;
      const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
      if (!kv) fail(file + ': bad frontmatter line: "' + line + '"');
      if (kv[2] === '') { data[kv[1]] = []; listKey = kv[1]; }
      else data[kv[1]] = scalar(kv[2]);
    } else if (line.startsWith('- ')) {
      if (!listKey) fail(file + ': list item outside a list: "' + line + '"');
      listItem = {};
      data[listKey].push(listItem);
      const kv = line.slice(2).match(/^([\w-]+):\s*(.*)$/);
      if (!kv) fail(file + ': bad list item line: "' + line + '"');
      listItem[kv[1]] = scalar(kv[2]);
    } else {
      if (!listItem) fail(file + ': indented line outside a list item: "' + line + '"');
      const kv = line.match(/^([\w-]+):\s*(.*)$/);
      if (!kv) fail(file + ': bad list item line: "' + line + '"');
      listItem[kv[1]] = scalar(kv[2]);
    }
  }
  return { data, body: m[2].trim() };
}

/* ---------- markdown subset ---------- */
function inline(s) {
  s = esc(s);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, text, href) {
    const ext = /^https?:/.test(href) && href.indexOf(SITE) !== 0;
    return '<a href="' + href + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>' + text + '</a>';
  });
  return s;
}
function renderMd(md) {
  return md.split(/\n{2,}/).map(function (b) {
    b = b.trim();
    if (!b) return '';
    if (b.startsWith('### ')) return '<h3>' + inline(b.slice(4)) + '</h3>';
    if (b.startsWith('## ')) return '<h2>' + inline(b.slice(3)) + '</h2>';
    const lines = b.split('\n');
    if (lines.every(function (l) { return l.trim().startsWith('- '); })) {
      return '<ul>' + lines.map(function (l) { return '<li>' + inline(l.trim().slice(2)) + '</li>'; }).join('') + '</ul>';
    }
    const img = b.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    if (img) return '<figure class="prose-img"><img src="' + esc(img[2]) + '" alt="' + esc(img[1]) + '" loading="lazy" /></figure>';
    return '<p>' + inline(lines.join(' ')) + '</p>';
  }).filter(Boolean).join('\n');
}

/* ---------- load + validate ---------- */
function loadEntries() {
  if (!existsSync(CONTENT)) fail('content dir missing: ' + CONTENT);
  const entries = readdirSync(CONTENT).filter(function (f) { return f.endsWith('.md'); }).sort().map(function (f) {
    const parsed = parseFrontmatter(readFileSync(join(CONTENT, f), 'utf8'), f);
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

/* ---------- shared chrome ---------- */
function head(o) {
  return '<!doctype html>\n<html lang="en">\n<head>\n'
    + '  <meta charset="utf-8" />\n'
    + '  <meta name="viewport" content="width=device-width, initial-scale=1" />\n\n'
    + '  <!-- Google tag (gtag.js) -->\n'
    + '  <script async src="https://www.googletagmanager.com/gtag/js?id=G-HV902LVJ1B"></script>\n'
    + '  <script>\n    window.dataLayer = window.dataLayer || [];\n    function gtag(){dataLayer.push(arguments);}\n    gtag(\'js\', new Date());\n    gtag(\'config\', \'G-HV902LVJ1B\');\n  </script>\n\n'
    + '  <title>' + esc(o.title) + '</title>\n'
    + '  <meta name="description" content="' + esc(o.description) + '" />\n'
    + '  <link rel="canonical" href="' + o.canonical + '" />\n'
    + '  <meta property="og:title" content="' + esc(o.title) + '" />\n'
    + '  <meta property="og:description" content="' + esc(o.description) + '" />\n'
    + '  <meta property="og:image" content="' + o.ogImage + '" />\n'
    + '  <meta property="og:url" content="' + o.canonical + '" />\n'
    + '  <meta property="og:type" content="website" />\n'
    + '  <meta name="theme-color" content="#2F67B2" />\n'
    + '  <link rel="icon" href="/assets/logo.png" />\n\n'
    + '  <link rel="preconnect" href="https://fonts.googleapis.com" />\n'
    + '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n'
    + '  <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />\n'
    + '  <link rel="stylesheet" href="/styles.css" />\n'
    + '</head>\n';
}

const TOPBAR = `<body>
  <a class="skip-link" href="#main">Skip to main content</a>

  <div class="topbar">
    <div class="utility">
      <div class="utility__inner">
        <div class="menu" data-menu>
          <button type="button" class="menu__btn" id="lang-btn" aria-haspopup="true" aria-expanded="false" aria-controls="lang-menu">
            <span class="i-translate" aria-hidden="true">文A</span>
            <span class="menu__btn-label">Language</span>
            <span class="menu__caret" aria-hidden="true"></span>
          </button>
          <div class="menu__panel" id="lang-menu" role="menu" aria-labelledby="lang-btn" hidden>
            <p class="menu__title" aria-hidden="true">Translate this page</p>
            <button type="button" role="menuitemradio" aria-checked="true"  class="menu__item" data-lang="en">English</button>
            <button type="button" role="menuitemradio" aria-checked="false" class="menu__item" data-lang="es">Español</button>
            <button type="button" role="menuitemradio" aria-checked="false" class="menu__item" data-lang="zh-CN">中文</button>
            <button type="button" role="menuitemradio" aria-checked="false" class="menu__item" data-lang="vi">Tiếng Việt</button>
            <button type="button" role="menuitemradio" aria-checked="false" class="menu__item" data-lang="ar" dir="rtl">العربية</button>
            <div class="menu__more">
              <label class="menu__morelabel">More languages</label>
              <div id="google_translate_element"></div>
            </div>
          </div>
        </div>

        <div class="menu" data-menu>
          <button type="button" class="menu__btn" id="a11y-btn" aria-haspopup="true" aria-expanded="false" aria-controls="a11y-menu">
            <span class="i-access" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="12" cy="3.6" r="2.1"/><path d="M20 8.2c0 .6-.5 1-1 1h-3.9V21c0 .6-.5 1-1.1 1s-1-.4-1-1v-6h-2v6c0 .6-.5 1-1.1 1s-1-.4-1-1V9.2H5c-.6 0-1-.4-1-1s.4-1 1-1h14c.6 0 1 .4 1 1z"/></svg>
            </span>
            <span class="menu__btn-label">Accessibility</span>
            <span class="menu__caret" aria-hidden="true"></span>
          </button>
          <div class="menu__panel menu__panel--a11y" id="a11y-menu" role="group" aria-labelledby="a11y-btn" hidden>
            <div class="a11y-row" role="group" aria-label="Text size">
              <span class="a11y-row__label">Text size</span>
              <span class="a11y-sizes">
                <button type="button" class="a11y-size" data-font="down" aria-label="Decrease text size">A<span class="a11y-minus">−</span></button>
                <button type="button" class="a11y-size" data-font="reset" aria-label="Reset text size">A</button>
                <button type="button" class="a11y-size a11y-size--big" data-font="up" aria-label="Increase text size">A<span class="a11y-plus">+</span></button>
              </span>
            </div>
            <button type="button" class="a11y-opt" data-toggle="contrast" aria-pressed="false"><span>High contrast</span><span class="a11y-switch" aria-hidden="true"></span></button>
            <button type="button" class="a11y-opt" data-toggle="links" aria-pressed="false"><span>Underline links</span><span class="a11y-switch" aria-hidden="true"></span></button>
          </div>
        </div>
      </div>
    </div>

    <header class="site-header">
      <a class="brand" href="/" aria-label="William Walker PTC home">
        <img class="brand__logo" src="/assets/logo.png" width="226" height="223" alt="William Walker Elementary — Home of the Wildcats" />
        <span class="brand__text">PTC</span>
      </a>
      <nav class="main-nav" aria-label="Primary">
        <button class="nav-toggle" aria-expanded="false" aria-controls="nav-list" aria-label="Toggle menu"><span></span><span></span><span></span></button>
        <ul id="nav-list" class="nav-list">
          <li><a href="/#about">About</a></li>
          <li><a href="/#what-we-do">What We Do</a></li>
          <li><a href="/#get-involved">Get Involved</a></li>
          <li><a href="/programs" aria-current="page">Programs</a></li>
          <li><a href="/calendar">Calendar</a></li>
          <li><a href="/supplies">Supplies</a></li>
          <li><a href="/#connect">Connect</a></li>
          <li><a class="nav-cta" href="/#get-involved">Sign Up</a></li>
        </ul>
      </nav>
    </header>
  </div>
`;

const FOOTER = `  <!-- ============ FOOTER ============ -->
  <footer class="site-footer">
    <div class="wrap footer-grid">
      <div>
        <p class="footer-brand">William Walker Elementary PTC</p>
        <address class="footer-address">
          2350 Cedar Hills Blvd.<br />
          Beaverton, OR 97005
        </address>
        <a class="footer-social" href="https://www.facebook.com/williamwalkerPTC" target="_blank" rel="noopener">Follow us on Facebook <span aria-hidden="true">↗</span></a>
      </div>
      <nav class="footer-nav" aria-label="Footer">
        <a href="/#about">About</a>
        <a href="/#what-we-do">What We Do</a>
        <a href="/programs">Programs</a>
        <a href="/#get-involved">Get Involved</a>
        <a href="/supplies">Supplies</a>
        <a href="/#connect">Connect</a>
      </nav>
      <p class="footer-note">
        A parent- and staff-run 501(c)(3) nonprofit. The William Walker PTC is an
        independent organization and is not officially administered by the Beaverton
        School District.
      </p>
    </div>
    <p class="footer-copy">© <span id="year">2026</span> William Walker Parent Teacher Club, Inc.</p>
  </footer>

  <!-- Google Translate init -->
  <script>
    function googleTranslateElementInit() {
      new google.translate.TranslateElement(
        { pageLanguage: 'en', layout: google.translate.TranslateElement.InlineLayout.SIMPLE, autoDisplay: false },
        'google_translate_element'
      );
    }
  </script>
  <script src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit" defer></script>

  <script src="/script.js" defer></script>
</body>
</html>
`;

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
    + TOPBAR
    + '\n  <main id="main">\n'
    + heroHtml(p)
    + '\n    <section class="block block--white" aria-labelledby="story-title">\n'
    + '      <div class="wrap">\n'
    + '        <p class="kicker kicker--blue">' + kicker + '</p>\n'
    + '        <div class="prose">\n' + renderMd(p.body) + '\n        </div>\n'
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
    + TOPBAR
    + `
  <main id="main">
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero__inner">
        <p class="hero__eyebrow">William Walker PTC</p>
        <h1 id="hero-title" class="hero__title">Programs &amp; Events</h1>
        <p class="hero__lede">
          Every program on this page is funded by families and run by volunteers —
          here's what the PTC makes happen at Walker, and how you can help.
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
