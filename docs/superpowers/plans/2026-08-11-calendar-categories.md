# Calendar Categories + One-Click Subscribe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Categorize every calendar event server-side so the page can filter by type and each type can be subscribed to as its own `webcal://` feed.

**Architecture:** `api/calendar.js` gains a pure `categorize(title, description, source)` that tags each event `ptc | noschool | school | district | observance`. The JSON response carries `category`; the `?only=` query param filters the generated `.ics` by it. The front end filters on `category` instead of `source` and gains chips plus subscribe links per category.

**Tech Stack:** Vanilla ES5-style browser JS (no build step), CommonJS Vercel serverless function, plain `node` test scripts (`.mjs`), hand-written CSS. No package.json, no test runner, no dependencies.

## Global Constraints

- **No dependencies.** The repo has no `package.json`. Do not add one.
- **Palette is blue + green + greys only** — `--blue #2F67B2`, `--green #079A48`, and shades, matched to the school logo. Do **not** introduce new hues for new categories.
- **Browser JS stays ES5-flavoured** (`var`, `function`, no arrow functions / template literals) to match `calendar.js`.
- **`api/calendar.js` stays CommonJS** (`module.exports`, `require`).
- Tests are plain node scripts run as `node scripts/<name>.test.mjs`, matching `scripts/build-programs.test.mjs`.
- Category names are exactly: `ptc`, `noschool`, `school`, `district`, `observance`.
- Unmatched titles MUST fall through to `school` (fail-visible guarantee from the spec).
- Observance title matching MUST be exact-title, never substring.

---

### Task 1: Pure categorization functions + tests

**Files:**
- Modify: `api/calendar.js` (add constants + two functions near the top, export at bottom)
- Create: `scripts/fixtures/calendar-feed.ics`
- Create: `scripts/calendar-categorize.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `categorize(title: string, description: string, source: string) -> 'ptc'|'noschool'|'school'|'district'|'observance'`
  - `isObservance(title: string, description: string) -> boolean`
  - Both attached to the exported handler: `module.exports.categorize`, `module.exports.isObservance`.

- [ ] **Step 1: Create the fixture**

`scripts/fixtures/calendar-feed.ics` — 16 real VEVENTs copied verbatim from the
district feed plus 2 synthetic ones. Real entries to include (by SUMMARY):

```
No School - Winter Break            Chuseok              Field Day!
School Closed                       Ramadan Begins       Literacy Night
Student Led Conferences - No Students   Diwali           Cafecito w/ Principal
Fall Parent/Teacher Conferences No School Students       Budget 101
Yom Kippur                          Eid al-Fitr          School Board Work Session
Back To School Night                Pre-K First Day of School
```

Plus these two synthetic VEVENTs appended before `END:VCALENDAR`:

```
BEGIN:VEVENT
UID:synthetic-1@test
DTSTART;VALUE=DATE:20270301
SUMMARY:Totally Unknown New Event Type
DESCRIPTION:
PRIORITY:0
END:VEVENT
BEGIN:VEVENT
UID:synthetic-2@test
DTSTART;VALUE=DATE:20270302
SUMMARY:Diwali Celebration Night
DESCRIPTION:
PRIORITY:0
END:VEVENT
```

The second synthetic entry is the guard against substring matching: it contains
"Diwali" but is a real Walker event and must categorize as `school`.

- [ ] **Step 2: Write the failing test**

`scripts/calendar-categorize.test.mjs`:

```js
#!/usr/bin/env node
/* Categorization tests. Run: node scripts/calendar-categorize.test.mjs */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const cal = require(join(ROOT, 'api', 'calendar.js'));
const { categorize, isObservance } = cal;

let n = 0;
const eq = (a, b, m) => { assert.strictEqual(a, b, m); n++; };

// --- no school: every wording variant in the real feed ---
for (const t of [
  'No School - Winter Break', 'No School - Fall Break', 'No School - Grading Day',
  'No School - Labor Day', 'No School - Veterans Day', 'No School - Presidents Day',
  'No School - Spring Break', 'No School - Memorial Day', 'No School - Winter break',
  'No School - Martin Luther King Jr. Day', 'No School - Staff Development/Workday',
  'No School - Pre-service - Staff Development Day', 'No School - Thanksgiving / Fall Break',
  'School Closed', 'Student Led Conferences - No Students',
  'Fall Parent/Teacher Conferences No School Students',
]) eq(categorize(t, '', 'school'), 'noschool', t);

// --- observances: the 9 unmarked stragglers, matched by exact title ---
for (const t of [
  'Christmas', 'Easter', 'Diwali', 'Five Days of Diwali', 'Eid al-Fitr',
  'Eid al-Adha', 'Lunar New Year', 'Rosh Hashanah', 'Yom Kippur',
]) eq(categorize(t, '', 'school'), 'observance', t);

// --- observances: detected by the district's DESCRIPTION marker ---
eq(categorize('Chuseok', 'For more information see Cultural & Religious Holidays & Observances .', 'school'),
   'observance', 'marker-detected observance');
eq(isObservance('Anything At All', 'blah Cultural & Religious blah'), true, 'marker alone suffices');

// --- exact-title, never substring ---
eq(categorize('Diwali Celebration Night', '', 'school'), 'school', 'substring must not match');
eq(categorize('Christmas Concert', '', 'school'), 'school', 'substring must not match');

// --- district governance ---
for (const t of [
  'School Board Work Session', 'School Board Business Meeting', 'School Board Retreat',
  'Budget Committee Meeting', 'Budget 101', 'Superintendent Search Committee Meeting',
  'Long-Range Facilities Planning Committee', 'VI Public Hearing',
]) eq(categorize(t, '', 'school'), 'district', t);

// --- school events, incl. superintendent COMMUNITY events (not governance) ---
for (const t of [
  'Field Day!', 'Literacy Night', 'Cafecito w/ Principal', 'Back To School Night',
  'Pre-K First Day of School', 'Multicultural Night', 'Meet the Superintendent',
  "Superintendent's Coffee Chat", 'First day for students',
]) eq(categorize(t, '', 'school'), 'school', t);

// --- PTC wins over everything ---
eq(categorize('PTC Meeting', '', 'ptc'), 'ptc', 'ptc source');
eq(categorize('No School - Whatever', '', 'ptc'), 'ptc', 'ptc source beats noschool');

// --- fail-visible guarantee ---
eq(categorize('Totally Unknown New Event Type', '', 'school'), 'school', 'unknown falls to school');
eq(categorize('', '', 'school'), 'school', 'empty title falls to school');

console.log('ok — ' + n + ' assertions passed');
```

- [ ] **Step 3: Run it to verify it fails**

Run: `node scripts/calendar-categorize.test.mjs`
Expected: FAIL — `categorize is not a function` (not yet exported).

- [ ] **Step 4: Implement**

In `api/calendar.js`, after the `PTC_EVENTS` array:

```js
/* ---------- categorization ---------- */
const OBSERVANCE_MARKER = 'Cultural & Religious';
const OBSERVANCE_TITLES = [
  'christmas', 'easter', 'diwali', 'five days of diwali', 'eid al-fitr',
  'eid al-adha', 'lunar new year', 'rosh hashanah', 'yom kippur',
];
const NO_SCHOOL_RE = /no school|school closed|no students/i;
const DISTRICT_RE = /school board|board retreat|budget committee|budget 101|superintendent search|long-range facilities|public hearing/i;

function isObservance(title, description) {
  if (String(description || '').indexOf(OBSERVANCE_MARKER) !== -1) return true;
  return OBSERVANCE_TITLES.indexOf(String(title || '').trim().toLowerCase()) !== -1;
}

function categorize(title, description, source) {
  if (source === 'ptc') return 'ptc';
  const t = String(title || '');
  if (NO_SCHOOL_RE.test(t)) return 'noschool';
  if (isObservance(t, description)) return 'observance';
  if (DISTRICT_RE.test(t)) return 'district';
  return 'school';
}
```

At the very bottom of the file:

```js
module.exports.categorize = categorize;
module.exports.isObservance = isObservance;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node scripts/calendar-categorize.test.mjs`
Expected: PASS — `ok — 47 assertions passed`

- [ ] **Step 6: Commit**

```bash
git add api/calendar.js scripts/calendar-categorize.test.mjs scripts/fixtures/calendar-feed.ics
git commit -m "Calendar: add event categorization (ptc/noschool/school/district/observance)"
```

---

### Task 2: Wire category through the API

**Files:**
- Modify: `api/calendar.js` — `parseICS` (add DESCRIPTION), `toEvent`, `ptcMeetings`, handler `only=` regex, `buildICS` feed naming
- Modify: `scripts/calendar-categorize.test.mjs` (append end-to-end assertions)

**Interfaces:**
- Consumes: `categorize`, `isObservance` from Task 1.
- Produces: every event object gains `category`. `?only=` accepts the five category names. `FEED_NAMES` maps category → calendar display name.

- [ ] **Step 1: Write the failing test** — append to `scripts/calendar-categorize.test.mjs`:

```js
// ---------- end-to-end over the fixture ----------
const { parseICSForTest } = cal;
const fixture = readFileSync(join(ROOT, 'scripts', 'fixtures', 'calendar-feed.ics'), 'utf8');
const parsed = parseICSForTest(fixture);

const counts = parsed.reduce((a, e) => { a[e.category] = (a[e.category] || 0) + 1; return a; }, {});
console.log('fixture counts:', JSON.stringify(counts));

eq(parsed.length, 18, 'fixture parses 18 events');
eq(counts.noschool, 4, 'fixture no-school count');
eq(counts.observance, 4, 'fixture observance count');
eq(counts.district, 2, 'fixture district count');
eq(counts.school, 8, 'fixture school count');
assert(parsed.every((e) => e.category), 'every event has a category');
assert(parsed.every((e) => e.source === 'school'), 'feed events tagged source=school');
console.log('ok — ' + n + ' assertions passed (incl. fixture)');
```

Note the fixture has no date filtering applied — `parseICSForTest` must bypass
the `BACK`/`FWD_FEED` window so old fixture dates still parse.

- [ ] **Step 2: Run it to verify it fails**

Run: `node scripts/calendar-categorize.test.mjs`
Expected: FAIL — `parseICSForTest is not a function`.

- [ ] **Step 3: Add DESCRIPTION to the parser**

In `parseICS`, alongside the existing SUMMARY/LOCATION branches:

```js
else if (name === 'DESCRIPTION') cur.description = unescapeICS(value);
```

- [ ] **Step 4: Set category in `toEvent`**

```js
function toEvent(cur) {
  const s = parseDT(cur.dtstart);
  const e = cur.dtend ? parseDT(cur.dtend) : null;
  return {
    date: s.date,
    startTime: s.allDay ? null : s.time,
    endTime: e && !e.allDay ? e.time : null,
    allDay: s.allDay,
    title: cur.summary,
    location: cur.location ? cur.location.slice(0, 90) : null,
    category: categorize(cur.summary, cur.description || '', 'school'),
    source: 'school',
  };
}
```

- [ ] **Step 5: Set category on PTC events**

In `ptcMeetings()`, add `category: 'ptc'` to both pushed object literals (the
recurring meeting and the `PTC_EVENTS` loop).

- [ ] **Step 6: Widen `only=` and name the feeds**

In the handler, replace the `only` regex:

```js
const only = (/[?&]only=(ptc|noschool|school|district|observance)\b/.exec(req.url || '') || [])[1];
```

Change the filter from `e.source === only` to `e.category === only`, and replace
the ternary feed naming with a lookup. Add near the other constants:

```js
const FEED_NAMES = {
  ptc: 'William Walker PTC Meetings',
  noschool: 'William Walker — No School Days',
  school: 'William Walker — School Events',
  district: 'William Walker — District & Board',
  observance: 'William Walker — Cultural & Religious Observances',
};
```

and in the `isIcs` branch:

```js
var feed = only ? events.filter(function (e) { return e.category === only; }) : events;
var name = only ? FEED_NAMES[only] : 'William Walker PTC + School';
```

- [ ] **Step 7: Export the test hook**

At the bottom, alongside the Task 1 exports:

```js
module.exports.parseICSForTest = function (raw) {
  return parseICS(raw, true);
};
```

and change `parseICS(raw)` to `parseICS(raw, skipWindow)`, guarding the date filter:

```js
if (ev && (skipWindow || (ev.date >= lo && ev.date <= hi))) events.push(ev);
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `node scripts/calendar-categorize.test.mjs`
Expected: PASS, printing the fixture counts line.

- [ ] **Step 9: Verify against the live API**

```bash
node -e "
const m = require('./api/calendar.js');
const res={_b:null,setHeader(){},status(){return this},json(o){this._b=o},send(s){this._b=s}};
m({url:'/api/calendar'},res).then(()=>{
  const c={}; res._b.events.forEach(e=>c[e.category]=(c[e.category]||0)+1);
  console.log('live categories:', c);
  console.log('uncategorized:', res._b.events.filter(e=>!e.category).length);
});"
```

Expected: all five categories present, `uncategorized: 0`.

- [ ] **Step 10: Commit**

```bash
git add api/calendar.js scripts/calendar-categorize.test.mjs
git commit -m "Calendar: expose category in JSON and filter .ics feeds by it"
```

---

### Task 3: Chips, tags, and subscribe links

**Files:**
- Modify: `calendar.html:106-119` (chips + subscribe row)
- Modify: `calendar.js` (filter parsing, `render`, tag labels)

**Interfaces:**
- Consumes: `category` on every event from Task 2.
- Produces: no new exports; DOM only.

- [ ] **Step 1: Replace the chips** in `calendar.html`

```html
<div class="cal-filters" role="group" aria-label="Filter events">
  <button type="button" class="cal-chip is-active" data-filter="all" aria-pressed="true">All</button>
  <button type="button" class="cal-chip" data-filter="ptc" aria-pressed="false"><span class="dot dot--ptc" aria-hidden="true"></span> PTC</button>
  <button type="button" class="cal-chip" data-filter="noschool" aria-pressed="false"><span class="dot dot--noschool" aria-hidden="true"></span> No School</button>
  <button type="button" class="cal-chip" data-filter="school" aria-pressed="false"><span class="dot dot--school" aria-hidden="true"></span> School events</button>
  <button type="button" class="cal-chip" data-filter="district" aria-pressed="false"><span class="dot dot--district" aria-hidden="true"></span> District</button>
</div>
```

- [ ] **Step 2: Add the subscribe links** in `calendar.html`

Insert after the existing PTC subscribe anchor, before the external school link:

```html
<a class="cal-subscribe" href="webcal://williamwalkerptc.com/api/calendar?format=ics&amp;only=noschool">
  <span class="dot dot--noschool" aria-hidden="true"></span> No School days
</a>
<a class="cal-subscribe" href="webcal://williamwalkerptc.com/api/calendar?format=ics&amp;only=school">
  <span class="dot dot--school" aria-hidden="true"></span> School events
</a>
```

- [ ] **Step 3: Accept the new `?show=` values** in `calendar.js`

```js
var CATEGORIES = ['ptc', 'noschool', 'school', 'district', 'observance'];
var filter = (function () {
  var s = new URLSearchParams(location.search).get('show');
  return CATEGORIES.indexOf(s) !== -1 ? s : 'all';
})();
```

- [ ] **Step 4: Filter and label by category** in `calendar.js`

Add near `WEEKDAYS`:

```js
var LABELS = { ptc: 'PTC', noschool: 'No School', school: 'School', district: 'District', observance: 'Observance' };
```

In `render()`, change the filter line to:

```js
if (filter !== 'all' && catOf(e) !== filter) return false;
```

Add the helper (defensive — falls back to `source` if an old cached payload
lacks `category`):

```js
function catOf(e) { return e.category || e.source || 'school'; }
```

In the row template, replace both `e.source` usages:

```js
'<article class="cal-event cal-event--' + catOf(e) + '">' +
...
'<span class="cal-tag cal-tag--' + catOf(e) + '">' + (LABELS[catOf(e)] || 'School') + '</span>' +
```

- [ ] **Step 5: Fix subscribe-link tracking** in `calendar.js`

The existing handler hardcodes ptc/school. Replace with:

```js
document.querySelectorAll('.cal-subscribe').forEach(function (a) {
  a.addEventListener('click', function () {
    var m = /only=([a-z]+)/.exec(a.href);
    track('calendar_subscribe', { feed: m ? m[1] : 'district-site' });
  });
});
```

- [ ] **Step 6: Verify in a browser**

Run `python3 -m http.server 8000` from the repo root, open
`http://localhost:8000/calendar.html`. The API won't run locally, so confirm the
page renders its error state gracefully, then rely on Task 5's production check
for real data. Confirm all five chips render and wrap correctly at 375px width.

- [ ] **Step 7: Commit**

```bash
git add calendar.html calendar.js
git commit -m "Calendar: filter chips and subscribe links per category"
```

---

### Task 4: Category styling

**Files:**
- Modify: `styles.css:409-411` (dots), `:449-450` (tags), `:438` (date block)

**Interfaces:** none — CSS only.

- [ ] **Step 1: Add a neutral tint token**

In `:root`, after `--line`:

```css
  --slate-tint: #eef1f6;
```

- [ ] **Step 2: Add dot colours**

Replace lines 409-411:

```css
.dot--ptc { background: var(--green); }
.dot--school { background: var(--blue); }
.dot--noschool { background: var(--blue-dark); }
.dot--district { background: var(--ink-soft); }
.cal-chip.is-active .dot { box-shadow: 0 0 0 2px #fff; }
```

The last rule replaces the two-selector version so new dots are covered
automatically.

- [ ] **Step 3: Add tag colours**

After the existing `.cal-tag--school` rule:

```css
.cal-tag--noschool { background: var(--blue-dark); color: #fff; }
.cal-tag--district { background: var(--slate-tint); color: var(--ink-soft); }
.cal-tag--observance { background: transparent; color: var(--ink-soft); box-shadow: inset 0 0 0 1px var(--line); }
```

No-school days get the highest-contrast treatment because they are the events
parents most need to spot. Observances get the lowest.

- [ ] **Step 4: Tint the date block for no-school rows**

After the existing `.cal-event--ptc .cal-date` rule:

```css
.cal-event--noschool .cal-date { background: var(--blue-dark); color: #fff; }
```

- [ ] **Step 5: Let the filter row wrap on mobile**

Five chips overflow 375px. Change `.cal-filters` to allow wrapping:

```css
.cal-filters { display: inline-flex; flex-wrap: wrap; gap: 0.4rem; background: var(--blue-tint); padding: 0.3rem; border-radius: 999px; }
```

- [ ] **Step 6: Commit**

```bash
git add styles.css
git commit -m "Calendar: styling for no-school, district, and observance categories"
```

---

### Task 5: Verify end to end

**Files:** none modified.

- [ ] **Step 1: Run the full test suite**

```bash
node scripts/calendar-categorize.test.mjs
node scripts/build-programs.test.mjs
node scripts/supplies-page.test.mjs
```

Expected: all pass. The latter two must be unaffected.

- [ ] **Step 2: Confirm no regression in the existing PTC feed**

```bash
node -e "
const m=require('./api/calendar.js');
const res={_b:null,setHeader(){},status(){return this},json(o){this._b=o},send(s){this._b=s}};
m({url:'/api/calendar?format=ics&only=ptc'},res).then(()=>{
  console.log(/X-WR-CALNAME:William Walker PTC Meetings/.test(res._b) ? 'PTC feed name OK' : 'FAIL');
  console.log('Walkerthon rows:', (res._b.match(/Walkerthon/g)||[]).length, '(expect 2)');
});"
```

- [ ] **Step 3: Merge and deploy**

```bash
git checkout main && git merge --ff-only calendar-categories && git push origin main
```

- [ ] **Step 4: Verify production**

```bash
curl -s 'https://williamwalkerptc.com/api/calendar' | node -e "
let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{
  const j=JSON.parse(d), c={};
  j.events.forEach(e=>c[e.category]=(c[e.category]||0)+1);
  console.log(c, 'uncategorized:', j.events.filter(e=>!e.category).length);});"

curl -s 'https://williamwalkerptc.com/api/calendar?format=ics&only=noschool' | grep -c BEGIN:VEVENT
```

Expected: five categories, zero uncategorized, and a non-zero no-school event count.

---

## Self-Review

**Spec coverage:** observance detection (T1) · category assignment (T1) ·
DESCRIPTION parsing (T2) · `category` in JSON (T2) · `?only=` widening (T2) ·
feed names (T2) · chips (T3) · All-means-everything (T3, no exclusion logic) ·
`?show=` (T3) · subscribe links (T3) · GA tracking (T3) · dot/tag colours (T4) ·
tests against a checked-in fixture (T1/T2) · fail-visible guarantee (T1). The
spec's breaking change to `?only=school` is inherent to T2 Step 6 and was
signed off.

**Naming consistency:** `categorize` / `isObservance` / `parseICSForTest` /
`catOf` / `LABELS` / `CATEGORIES` / `FEED_NAMES` are each defined once and used
with the same signature throughout.
