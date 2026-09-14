#!/usr/bin/env node
/* =========================================================================
   verify-pages — regression harness for the config extraction.

   The eight hand-written pages had no test coverage at all. Before they were
   converted to generated fragments, each shipped page was snapshotted into
   scripts/fixtures/baseline/. This compares what the generators produce now
   against those snapshots.

   The comparison is STRUCTURAL, not byte-for-byte: HTML comments are dropped
   and whitespace between tags is collapsed, because reformatting is expected
   and uninteresting. What is left is a token stream of tags and text.

   Intended differences are declared in EXPECTED below, in two forms:

     rewrite  — a substitution applied to the BASELINE before diffing, for
                changes that are a like-for-like swap (relative asset paths
                becoming absolute). If the rewrite is right, the diff is empty.
     added /  — regexes matching tokens that may legitimately appear or vanish
     removed    (a page gaining its first og: tags, dead markup being dropped).

   Anything not covered by a rule is a regression and fails the run. Every rule
   carries a `why` that must trace back to a line in the plan's drift table —
   if you find yourself adding a rule to make the run pass, that is the moment
   to check whether the change was actually intended.

     node scripts/verify-pages.test.mjs
   ========================================================================= */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = join(ROOT, 'scripts', 'fixtures', 'baseline');

/* ---------- normalization ---------- */

// Strip comments, collapse inter-tag whitespace, collapse runs inside text.
//
// Inline <script> bodies also lose whitespace around JS punctuation, so that
// re-wrapping a call across lines does not read as a change. Identifiers and
// string contents survive, so a real edit still shows up.
function normalize(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(
      /(<script(?![^>]*\bsrc=)[^>]*>)([\s\S]*?)(<\/script>)/gi,
      (_, open, code, close) => open + code.replace(/\s+/g, ' ').replace(/\s*([(){},;])\s*/g, '$1').trim() + close
    )
    .replace(/>\s+</g, '><')
    .replace(/[ \t\r\n]+/g, ' ')
    .trim();
}

// Split into tags and non-empty text nodes.
function tokenize(html) {
  return normalize(html)
    .split(/(<[^>]*>)/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/* ---------- diff (common prefix/suffix, then LCS on the middle) ---------- */

function diff(a, b) {
  let lo = 0;
  while (lo < a.length && lo < b.length && a[lo] === b[lo]) lo++;
  let ha = a.length, hb = b.length;
  while (ha > lo && hb > lo && a[ha - 1] === b[hb - 1]) { ha--; hb--; }

  const x = a.slice(lo, ha), y = b.slice(lo, hb);
  if (!x.length && !y.length) return [];
  // Bail out of LCS on pathologically large middles — report them wholesale
  // rather than allocating a 10^8-cell table.
  if (x.length * y.length > 4_000_000) {
    return x.map((t) => ({ op: '-', text: t })).concat(y.map((t) => ({ op: '+', text: t })));
  }

  const n = x.length, m = y.length;
  const table = new Uint32Array((n + 1) * (m + 1));
  const at = (i, j) => i * (m + 1) + j;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[at(i, j)] = x[i] === y[j]
        ? table[at(i + 1, j + 1)] + 1
        : Math.max(table[at(i + 1, j)], table[at(i, j + 1)]);
    }
  }
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) { i++; j++; }
    else if (table[at(i + 1, j)] >= table[at(i, j + 1)]) out.push({ op: '-', text: x[i++] });
    else out.push({ op: '+', text: y[j++] });
  }
  while (i < n) out.push({ op: '-', text: x[i++] });
  while (j < m) out.push({ op: '+', text: y[j++] });
  return out;
}

/* ---------- expected differences ----------
   Keyed by output path. COMMON applies to every page. */

const REL_TO_ABS = [
  { from: /(href|src)="styles\.css"/g,       to: '$1="/styles.css"',       why: 'asset paths standardized to absolute' },
  { from: /(href|src)="script\.js"/g,        to: '$1="/script.js"',        why: 'asset paths standardized to absolute' },
  { from: /(href|src)="calendar\.js"/g,      to: '$1="/calendar.js"',      why: 'asset paths standardized to absolute' },
  { from: /(href|src)="supplies\.js"/g,      to: '$1="/supplies.js"',      why: 'asset paths standardized to absolute' },
  { from: /(href|src)="faq\.js"/g,           to: '$1="/faq.js"',           why: 'asset paths standardized to absolute' },
  { from: /(href|src)="assets\/logo\.png"/g, to: '$1="/assets/logo.png"',  why: 'asset paths standardized to absolute' },
];

// Seven of eight hand-written pages shipped with no og: tags at all; the shared
// head() emits the full block, so they gain one.
const OG_ADDED = [
  { re: /^<meta property="og:(title|description|image|url|type)"/, why: 'page gains the shared OG block' },
];

// head() now runs every URL it emits through esc(). A bare "&" in an attribute
// is an HTML validity error, so encoding it is the fix, not the regression —
// browsers decode it back to "&" before requesting the font.
const COMMON = {
  rewrite: [
    { from: /&display=swap/g, to: '&amp;display=swap', why: 'font URL is now escaped like every other emitted URL' },
  ],
  added: [],
  removed: [],
};

// Blog pages passed topbar('blog'), a key the old four-key implementation did
// not recognize, so they highlighted nothing. The nav tree walk understands
// submenu leaves, so they now mark both the link and the About toggle.
const BLOG_NAV_FIX = {
  rewrite: [
    {
      from: /class="nav-sub-toggle" aria-expanded="false" aria-controls="sub-about"/,
      to: 'class="nav-sub-toggle is-current" aria-expanded="false" aria-controls="sub-about"',
      why: 'About toggle now marks that the current page is inside it',
    },
  ],
  added: [{ re: /^<a href="\/blog" aria-current="page">$/, why: 'nav link to the current section is now marked' }],
  removed: [{ re: /^<a href="\/blog">$/, why: 'same link, before it was marked (the footer copy is untouched)' }],
};

const EXPECTED = {
  'blog/index.html': BLOG_NAV_FIX,
  'blog/walkerthon-is-coming.html': BLOG_NAV_FIX,
  'index.html': {
    rewrite: REL_TO_ABS.concat([
      // The home page linked its own logo at a #top anchor and used bare
      // fragments for its own sections. Every other page already used the
      // rooted forms, and the shared chrome cannot know it is on the home
      // page, so the home page joins them. On "/" these resolve identically;
      // the logo now reloads the page instead of scrolling to the top.
      { from: /<a class="brand" href="#top"/, to: '<a class="brand" href="/"', why: 'brand link rooted' },
      { from: /href="#about"/g, to: 'href="/#about"', why: 'section links rooted' },
      { from: /href="#connect"/g, to: 'href="/#connect"', why: 'section links rooted' },
      // for= pointing at an id that exists nowhere in the document.
      { from: / for="more-langs-hint"/, to: '', why: 'dead attribute dropped' },
      // The anchor the brand link used to target, now unreferenced.
      { from: /\s*<span id="top"><\/span>\n/, to: '\n', why: 'unreferenced anchor removed' },
    ]),
    added: [
      { re: /^<meta property="og:type"/, why: 'index had og:title/description/image/url but no og:type' },
    ],
    removed: [],
  },
  'calendar.html':      { rewrite: REL_TO_ABS, added: OG_ADDED, removed: [] },
  'supplies.html':      { rewrite: REL_TO_ABS, added: OG_ADDED, removed: [] },
  'families.html':      { rewrite: REL_TO_ABS, added: OG_ADDED, removed: [] },
  'teachers.html':      { rewrite: REL_TO_ABS, added: OG_ADDED, removed: [] },
  // Fundraising sits both at top level and inside the Families menu. It always
  // marked both links; now the Families toggle is marked too, for the same
  // reason blog's About toggle is.
  'fundraising.html': {
    rewrite: [{
      from: /class="nav-sub-toggle" aria-expanded="false" aria-controls="sub-families"/,
      to: 'class="nav-sub-toggle is-current" aria-expanded="false" aria-controls="sub-families"',
      why: 'Families toggle now marks that the current page is inside it',
    }],
    added: OG_ADDED,
    removed: [],
  },
  'minutes.html':       { rewrite: [],         added: OG_ADDED, removed: [] },
  'families/faq.html':  { rewrite: [],         added: OG_ADDED, removed: [] },
};

/* ---------- run ---------- */

function rulesFor(page) {
  const e = EXPECTED[page] || { rewrite: [], added: [], removed: [] };
  return {
    rewrite: COMMON.rewrite.concat(e.rewrite || []),
    added: COMMON.added.concat(e.added || []),
    removed: COMMON.removed.concat(e.removed || []),
  };
}

function pages() {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1)) {
      const p = join(dir, name.name);
      if (name.isDirectory()) walk(p);
      else if (name.name.endsWith('.html')) out.push(relative(BASELINE, p));
    }
  };
  walk(BASELINE);
  return out;
}

let failures = 0;
let checked = 0;

if (!existsSync(BASELINE)) {
  console.error('verify-pages: no baseline at ' + BASELINE);
  process.exit(1);
}

for (const page of pages()) {
  const built = join(ROOT, page);
  if (!existsSync(built)) {
    console.error(`\n✗ ${page}\n    page is in the baseline but was not produced by the build`);
    failures++;
    continue;
  }
  checked++;

  const rules = rulesFor(page);
  let base = readFileSync(join(BASELINE, page), 'utf8');
  for (const r of rules.rewrite) base = base.replace(r.from, r.to);

  const deltas = diff(tokenize(base), tokenize(readFileSync(built, 'utf8')));
  const unexplained = deltas.filter((d) => {
    const list = d.op === '+' ? rules.added : rules.removed;
    return !list.some((r) => r.re.test(d.text));
  });

  if (!unexplained.length) {
    const note = deltas.length ? ` (${deltas.length} expected)` : '';
    console.log(`✓ ${page}${note}`);
    continue;
  }

  failures++;
  console.error(`\n✗ ${page} — ${unexplained.length} unexplained difference(s):`);
  for (const d of unexplained.slice(0, 25)) {
    const text = d.text.length > 160 ? d.text.slice(0, 157) + '…' : d.text;
    console.error(`    ${d.op === '+' ? 'built only  ' : 'baseline only'} ${text}`);
  }
  if (unexplained.length > 25) console.error(`    … and ${unexplained.length - 25} more`);
}

console.log(`\nverify-pages: ${checked} page(s) checked, ${failures} failing.`);
if (failures) {
  console.error('A difference here is either a regression to fix, or an intended change');
  console.error('that belongs in EXPECTED with a `why`. Do not add a rule to silence a');
  console.error('diff you have not explained.');
  process.exit(1);
}
