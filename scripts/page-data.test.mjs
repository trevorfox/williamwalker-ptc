#!/usr/bin/env node
/* Tests for scripts/lib/page-data.mjs and the pages built with it.
   Dep-free; run from repo root after a build:  node scripts/page-data.test.mjs */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fillTokens, minutesHtml, faqJsonLd } from './lib/page-data.mjs';
import { loadProgramSponsors, sponsorsHtml, slugify } from './lib/sponsors.mjs';
import { loadPrograms, programListHtml } from './lib/programs.mjs';
import config from '../site.config.mjs';

let failed = 0;
function check(name, ok) {
  console.log(`${ok ? '✓' : '✗'} ${name}`);
  if (!ok) failed++;
}
// fail() for the helpers: throw instead of exiting, so a test can expect it.
const fail = (msg) => { throw new Error(msg); };
function throws(fn) {
  try { fn(); return false; } catch (e) { return true; }
}

/* ---------- tokens ---------- */

check('token resolves from site.config.mjs', fillTokens('at {{meetings.time}}', 't', fail) === 'at ' + config.meetings.time);
check('|cap capitalizes the first letter', fillTokens('{{meetings.day|cap}}', 't', fail).startsWith(config.meetings.day[0].toUpperCase()));
check('|url percent-encodes', fillTokens('{{site.origin|url}}', 't', fail) === encodeURIComponent(config.site.origin));
check('|host drops the scheme and trailing slash', !/^https?:|\/$/.test(fillTokens('{{school.website|host}}', 't', fail)));
check('raw mode skips HTML-escaping', fillTokens('{{org.name}}', 't', fail, true) === config.org.name);
check('unknown token is a build error', throws(() => fillTokens('{{meetings.nope}}', 't', fail)));
check('non-string token is a build error', throws(() => fillTokens('{{meetings}}', 't', fail)));

/* ---------- minutes ---------- */

const html = minutesHtml([
  { month: '2026-06', url: 'https://example.com/june' },
  { month: '2026-09', url: 'https://example.com/sept', draft: true },
  { month: '2026-07', url: 'https://example.com/july' },
], 't', fail);
const years = [...html.matchAll(/(\d{4}&ndash;\d\d) school year<\/h2>/g)].map((m) => m[1]);
check('minutes group by July–June school year, newest first', years.join(',') === '2026&ndash;27,2025&ndash;26');
check('minutes sort newest first within a year', html.indexOf('September 2026') < html.indexOf('July 2026'));
check('only the first year heading carries the id', (html.match(/id="minutes-year"/g) || []).length === 1);
check('draft entries say Draft', /September 2026<\/span>\s*<span class="connect-card__meta">Draft minutes/.test(html));
check('other entries say Approved', /June 2026<\/span>\s*<span class="connect-card__meta">Approved minutes/.test(html));
check('an empty list renders a placeholder, not an error', minutesHtml([], 't', fail).includes('id="minutes-year"'));
check('bad month is a build error', throws(() => minutesHtml([{ month: 'Sept 2026', url: 'https://x' }], 't', fail)));
check('non-https url is a build error', throws(() => minutesHtml([{ month: '2026-09', url: 'http://x' }], 't', fail)));
check('duplicate month is a build error', throws(() => minutesHtml([
  { month: '2026-09', url: 'https://a' }, { month: '2026-09', url: 'https://b' }], 't', fail)));

const entries = JSON.parse(readFileSync('content/minutes.json', 'utf8'));
const page = readFileSync('minutes.html', 'utf8');
check('every content/minutes.json link is on /minutes', entries.every((e) => page.includes('href="' + e.url + '"')));

/* ---------- FAQ structured data ---------- */

const faq = readFileSync('families/faq.html', 'utf8');
const ld = JSON.parse(faq.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
const items = (faq.match(/<details class="qa-item/g) || []).length;
check('FAQ JSON-LD has one Question per visible qa-item', ld.mainEntity.length === items && items > 0);
const summaries = [...faq.matchAll(/<summary class="qa-q">([\s\S]*?)<\/summary>/g)].map((m) => m[1].trim());
check('FAQ JSON-LD question names match the page, in order',
  ld.mainEntity.every((q, i) => q.name === summaries[i].replace(/&amp;/g, '&').replace(/&rsquo;/g, '’')));
check('FAQ JSON-LD drops decorative arrows', !ld.mainEntity.some((q) => /[↗→]/.test(q.acceptedAnswer.text)));
check('FAQ JSON-LD site links are absolute', !ld.mainEntity.some((q) => /href="[/#]/.test(q.acceptedAnswer.text)));
check('faqJsonLd finds nothing on a page without qa-items', faqJsonLd('<p>hi</p>', '/x').count === 0);

/* ---------- sponsors ---------- */

check('sponsor logo names drop apostrophes', slugify("Leo's Lair") === 'leos-lair');
const wt = loadProgramSponsors('walkerthon', 't', fail);
check('sponsors load from the program markdown', wt.sponsors.length > 0 && wt.title === 'Walkerthon');
check('unknown sponsors program is a build error', throws(() => loadProgramSponsors('nope', 't', fail)));
check('sponsor grid takes a custom title', sponsorsHtml('walkerthon', wt.sponsors, 'Our Walkerthon sponsors.').includes('>Our Walkerthon sponsors.</h2>'));
check('own_page_only sponsors are left out of embeds', !wt.sponsors.some((s) => s.own_page_only));
const fundraising = readFileSync('fundraising.html', 'utf8');
check('fundraising page shows the Walkerthon sponsors', fundraising.includes('>Our Walkerthon sponsors.</h2>') && fundraising.includes('alt="Fine Counsel"'));

/* ---------- home page programs list ---------- */

const progs = loadPrograms(fail);
const home = readFileSync('index.html', 'utf8');
const pages = progs.filter((e) => !e.stub);
check('home links every program and event that has a page', pages.every((e) => home.includes('href="/programs/' + e.slug + '"')));
check('home lists every stub too, unlinked', progs.filter((e) => e.stub).every((e) => home.includes(e.title.replace(/&/g, '&amp;')) && !home.includes('href="/programs/' + e.slug + '"')));
const list = programListHtml([
  { slug: 'b', title: 'B', type: 'program', blurb: 'b', stub: true },
  { slug: 'a', title: 'A & Co', type: 'program', blurb: 'a', stub: false },
  { slug: 'e', title: 'E', type: 'event', blurb: 'An event.', stub: false },
]);
check('program pills link non-stubs and escape titles', list.includes('<li class="pill">B</li>') && list.includes('<a href="/programs/a">A &amp; Co</a>'));
check('event cards carry the blurb and a link when there is a page', list.includes('<p>An event.</p>') && list.includes('href="/programs/e">Learn more'));

/* ---------- built output ---------- */

function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.isDirectory()) return ['blog', 'programs', 'families'].includes(e.name) && dir === '.' ? htmlFiles(join(dir, e.name)) : [];
    return e.name.endsWith('.html') ? [join(dir, e.name)] : [];
  });
}
const leftovers = htmlFiles('.').filter((f) => /\{\{|<!--\s*(minutes-list|faq-jsonld|sponsors|program-list)\s*-->/.test(readFileSync(f, 'utf8')));
check('no unfilled {{tokens}} or fill markers in built pages', leftovers.length === 0);
if (leftovers.length) console.log('    in: ' + leftovers.join(', '));

console.log(failed ? `\n${failed} check(s) failed` : '\npage-data: all checks passed');
process.exit(failed ? 1 : 0);
