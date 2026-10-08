/* =========================================================================
   Build-time fills for src/pages/, used by build-pages.mjs.

   fillTokens(html, rel, fail)
     Replaces {{path.in.config}} with that value from site.config.mjs, escaped.
     {{path|cap}} capitalizes the first letter. Only string values resolve;
     anything else is a build error, so a typo can't ship as literal braces.

   minutesHtml(entries, rel, fail)
     The /minutes archive from content/minutes.json: one heading + card grid
     per school year (July–June), newest first. Each entry is
       { "month": "YYYY-MM", "url": "https://…", "draft": true }
     where draft is optional and swaps "Approved minutes" for "Draft minutes".

   faqJsonLd(html, pagePath)
     FAQPage JSON-LD built from the <details class="qa-item"> blocks of a
     rendered page, so the structured data Google reads is always the answer
     families see — there is no second copy to keep in sync.
   ========================================================================= */
import { esc } from './md.mjs';
import config from '../../site.config.mjs';

/* ---------- {{tokens}} ---------- */

const TOKEN_RE = /\{\{\s*([a-zA-Z][\w.]*)\s*(?:\|\s*(cap|url|host)\s*)?\}\}/g;

/* |cap   capitalize the first letter, for the start of a line
   |url   percent-encode, for a value going inside another URL's query string
   |host  a URL without its scheme or trailing slash, for showing as link text */
const FILTERS = {
  cap: (v) => v.charAt(0).toUpperCase() + v.slice(1),
  url: (v) => encodeURIComponent(v),
  host: (v) => v.replace(/^[a-z]+:\/\//, '').replace(/\/$/, ''),
};

// `raw` skips HTML-escaping, for frontmatter values that head() escapes itself.
export function fillTokens(html, rel, fail, raw) {
  return html.replace(TOKEN_RE, function (_, path, filter) {
    const value = path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), config);
    if (typeof value !== 'string') fail(rel + ': {{' + path + '}} is not a string in site.config.mjs');
    const s = filter ? FILTERS[filter](value) : value;
    return raw ? s : esc(s);
  });
}

/* ---------- minutes ---------- */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

// A school year starts in July: 2026-09 and 2027-06 are both "2026–27".
function schoolYear(year, month) {
  const start = month >= 7 ? year : year - 1;
  return start + '&ndash;' + String(start + 1).slice(-2);
}

function minutesCard(e) {
  return `          <li>
            <a class="connect-card" href="${esc(e.url)}" target="_blank" rel="noopener">
              <span class="connect-card__icon" aria-hidden="true">&#128196;</span>
              <span class="connect-card__body">
                <span class="connect-card__name">${MONTHS[e.m - 1]} ${e.y}</span>
                <span class="connect-card__meta">${e.draft ? 'Draft' : 'Approved'} minutes &middot; Google Doc</span>
              </span>
              <span class="connect-card__arrow" aria-hidden="true">&#8599;</span>
            </a>
          </li>
`;
}

export function minutesHtml(entries, rel, fail) {
  if (!Array.isArray(entries)) fail(rel + ': content/minutes.json must be a list');
  // A new site has no minutes yet. The heading keeps its id, which the page's
  // section is labelled by.
  if (!entries.length) {
    return '        <h2 id="minutes-year" class="section-title section-title--light">No minutes posted yet</h2>\n'
      + '        <p class="lead lead--light">Minutes appear here once they are approved.</p>\n';
  }
  const seen = new Set();
  const list = entries.map(function (e, i) {
    const where = rel + ': content/minutes.json entry ' + (i + 1);
    const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(e && e.month);
    if (!m) fail(where + ': "month" must look like "2026-09"');
    if (!/^https:\/\//.test(e.url || '')) fail(where + ': "url" must be an https:// link');
    if (seen.has(e.month)) fail(where + ': ' + e.month + ' is listed twice');
    seen.add(e.month);
    return { y: Number(m[1]), m: Number(m[2]), url: e.url, draft: e.draft === true };
  }).sort((a, b) => (b.y - a.y) || (b.m - a.m));

  const years = [];
  for (const e of list) {
    const label = schoolYear(e.y, e.m);
    if (!years.length || years[years.length - 1].label !== label) years.push({ label, items: [] });
    years[years.length - 1].items.push(e);
  }

  return years.map(function (yr, i) {
    const h2 = i === 0
      ? `        <h2 id="minutes-year" class="section-title section-title--light">${yr.label} school year</h2>\n`
      : `        <h2 class="section-title section-title--light" style="margin-top: 2.4rem;">${yr.label} school year</h2>\n`;
    return h2
      + `        <ul class="connect-grid" aria-label="Meeting minutes, ${yr.label} school year">\n`
      + yr.items.map(minutesCard).join('')
      + '        </ul>\n';
  }).join('\n');
}

/* ---------- FAQ structured data ---------- */

const QA_RE = /<details class="qa-item[^"]*" id="[^"]+">\s*<summary class="qa-q">([\s\S]*?)<\/summary>\s*<div class="qa-a prose">([\s\S]*?)<\/div>\s*<\/details>/g;

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', middot: '·', hellip: '…' };
function decode(s) {
  return s.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, function (all, e) {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITIES[e] !== undefined ? ENTITIES[e] : all;
  });
}

/* Google accepts a small set of HTML tags in an Answer's text. Keep links and
   lists, drop the "PTC guidance" source tag, the decorative arrows and anything
   hidden until script.js fills it in (the next-meeting date), and
   strip every attribute except href. Site links are made absolute, since the
   data is read away from the page. */
function absoluteHref(href, pagePath) {
  if (href.startsWith('#')) return config.site.origin + pagePath + href;
  if (href.startsWith('/')) return config.site.origin + href;
  return href;
}

function answerHtml(html, pagePath) {
  return html
    .replace(/<p class="src-tag[^"]*">[\s\S]*?<\/p>/g, '')
    .replace(/\s*<span aria-hidden="true">[\s\S]*?<\/span>/g, '')
    .replace(/<span [^>]*\shidden>[\s\S]*?<\/span>/g, '')
    .replace(/<(\w+)(\s[^>]*)?>/g, function (_, tag, attrs) {
      const href = attrs && /\shref="([^"]*)"/.exec(attrs);
      return '<' + tag + (href ? ' href="' + absoluteHref(href[1], pagePath) + '"' : '') + '>';
    })
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();
}

export function faqJsonLd(html, pagePath) {
  const questions = [];
  for (const m of html.matchAll(QA_RE)) {
    questions.push({
      '@type': 'Question',
      name: decode(m[1].replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim(),
      acceptedAnswer: { '@type': 'Answer', text: answerHtml(m[2], pagePath) },
    });
  }
  const json = JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: questions }, null, 2)
    .replace(/<\//g, '<\\/')
    .split('\n').map((l) => '  ' + l).join('\n');
  return { count: questions.length, html: '  <script type="application/ld+json">\n' + json + '\n  </script>' };
}
