# Programs & Events Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Markdown-driven program/event landing pages (`/programs` index + detail pages) with contextual donate CTAs, generated as committed static HTML by a dependency-free build script.

**Architecture:** `content/programs/*.md` (frontmatter + markdown story) → `scripts/build-programs.mjs` (no deps, Node ≥18) → committed `programs/*.html` sharing the site's existing chrome, `styles.css`, and `script.js`. No Vercel config change; `cleanUrls` already maps `programs/walkerthon.html` → `/programs/walkerthon` and `/programs` serves `programs/index.html`.

**Tech Stack:** Plain HTML/CSS/JS, Node built-ins only. Spec: `docs/superpowers/specs/2026-07-23-programs-pages-design.md`.

## Global Constraints

- No new dependencies, no framework, no Vercel config changes. Generated HTML is committed.
- Brand: blue `#2F67B2`, green `#079A48`, Figtree; reuse existing CSS variables/classes wherever possible.
- All donate links → `https://www.zeffy.com/en-US/peer-to-peer/walkerthon--2026` (site-wide default; overridable per page via `donate_url`).
- Impact fineprint required on every detail page: "Amounts are examples of what gifts like yours cover — donations support all PTC programs."
- Generated pages live under `/programs/`, so all asset/script hrefs in them must be absolute (`/styles.css`, `/script.js`, `/assets/logo.png`).
- No stock photos. Missing images degrade to brand placeholders.
- Deploy = git push to main only (Vercel auto-deploys; do NOT also run `vercel --prod`).

---

### Task 1: CSS for hero variants, gallery, impact tiles, program cards

**Files:**
- Modify: `styles.css` (append new section before the final media queries is unnecessary — append at end of file)

**Interfaces:**
- Produces class names consumed by the build script's templates (Task 3): `hero--image`, `hero--gradient` (with `--hero-img` custom property), `btn--white`, `prose`, `prose-img`, `gallery`, `impact-grid`, `impact-card`, `impact-card__amount`, `impact-card__buys`, `impact-cta`, `fineprint--light`, `program-cards`, `program-card`, `program-card--link`, `program-card__link`, `program-card__media`, `program-card__ph`, `program-card__body`, `program-card__more`, and `.pill a`.

- [ ] **Step 1: Append the Programs section to `styles.css`**

```css
/* =========================================================================
   Programs & Events pages
   ========================================================================= */
/* hero variants: activity photo (with legibility overlay) or brand gradient */
.hero--image, .hero--gradient { border-bottom: 0; }
.hero--image {
  background-image: linear-gradient(180deg, rgba(28,61,108,0.62), rgba(28,61,108,0.8)), var(--hero-img);
  background-size: cover; background-position: center;
}
.hero--gradient { background: linear-gradient(135deg, var(--blue-dark), var(--blue) 58%, var(--green-deep)); }
.hero--image .hero__eyebrow, .hero--gradient .hero__eyebrow { color: #bfead0; }
.hero--image .hero__title, .hero--gradient .hero__title { color: #fff; }
.hero--image .hero__lede, .hero--gradient .hero__lede { color: rgba(255,255,255,0.92); }

.btn--white { background: #fff; color: var(--green-dark); box-shadow: var(--shadow-sm); }
.btn--white:hover { background: var(--green-tint); transform: translateY(-2px); }

/* story prose (rendered markdown) */
.prose { max-width: 68ch; }
.prose h2 { font-size: clamp(1.4rem, 2.6vw, 1.8rem); color: var(--blue-dark); margin: 2rem 0 0.8rem; }
.prose h3 { font-size: 1.15rem; color: var(--blue-deep); margin: 1.6rem 0 0.6rem; }
.prose ul { margin: 0 0 1rem; padding-left: 1.3rem; }
.prose li { margin-bottom: 0.35rem; }
.prose-img { margin: 1.6rem 0; }
.prose-img img { border-radius: var(--radius-sm); box-shadow: var(--shadow); }

/* photo gallery */
.gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1rem; margin-top: 1.6rem; }
.gallery figure { margin: 0; }
.gallery img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: var(--radius-sm); box-shadow: var(--shadow-sm); }
.gallery figcaption { font-size: 0.88rem; color: var(--ink-soft); margin-top: 0.45rem; }

/* impact tiles (on green block) */
.impact-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 1rem; margin: 2rem 0; }
.impact-card { background: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.32); border-radius: var(--radius-sm); padding: 1.4rem 1.3rem; }
.impact-card__amount { display: block; font-weight: 900; font-size: 2.1rem; color: #fff; line-height: 1; }
.impact-card__buys { display: block; margin-top: 0.5rem; color: rgba(255,255,255,0.92); font-weight: 600; }
.impact-cta { display: flex; flex-wrap: wrap; align-items: center; gap: 1rem; margin-bottom: 1.2rem; }
.fineprint--light { color: rgba(255,255,255,0.85); opacity: 1; }

/* program cards (index + "more programs") */
.program-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1.2rem; margin-top: 2rem; }
.program-card { border-radius: var(--radius-sm); overflow: hidden; background: #fff; box-shadow: var(--shadow); }
.program-card--link { transition: transform 0.15s ease, box-shadow 0.15s ease; }
.program-card--link:hover { transform: translateY(-3px); box-shadow: 0 22px 46px -22px rgba(27,42,63,0.6); }
.program-card__link { display: block; color: inherit; text-decoration: none; height: 100%; }
.program-card__media { aspect-ratio: 3 / 2; background: var(--blue-tint); }
.program-card__media img { width: 100%; height: 100%; object-fit: cover; }
.program-card__ph { display: grid; place-items: center; background: linear-gradient(135deg, var(--blue), var(--green)); }
.program-card__ph span { font-weight: 900; font-size: 2.6rem; color: rgba(255,255,255,0.9); }
.program-card__body { padding: 1.1rem 1.2rem 1.3rem; }
.program-card__body h3 { font-size: 1.15rem; color: var(--blue-dark); margin-bottom: 0.4rem; }
.program-card__body p { font-size: 0.95rem; color: var(--ink-soft); margin: 0; }
.program-card__more { display: inline-block; margin-top: 0.7rem; font-weight: 700; font-size: 0.94rem; color: var(--blue-deep); }

/* homepage pills that link to program pages */
.pill a { color: #fff; text-decoration: none; }

/* high-contrast mode */
html.hc .hero--image, html.hc .hero--gradient { background: #003a8c !important; background-image: none !important; }
html.hc .hero--image .hero__title, html.hc .hero--gradient .hero__title,
html.hc .hero--image .hero__eyebrow, html.hc .hero--gradient .hero__eyebrow,
html.hc .hero--image .hero__lede, html.hc .hero--gradient .hero__lede { color: #fff !important; }
html.hc .btn--white { background: #fff; color: #004d24; border-color: #004d24; }
html.hc .impact-card { border-color: #fff; }
html.hc .program-card { border: 2px solid #000; }
html.hc .program-card__body h3, html.hc .program-card__body p, html.hc .program-card__more { color: #000 !important; }
```

- [ ] **Step 2: Commit**

```bash
git add styles.css
git commit -m "Programs: add CSS for hero variants, gallery, impact tiles, program cards"
```

---

### Task 2: Launch content — 3 full pages + stubs for everything else

**Files:**
- Create: `content/programs/walkerthon.md`, `content/programs/field-trips.md`, `content/programs/art-literacy.md`
- Create: 16 stub `.md` files (listed below)

**Interfaces:**
- Produces: frontmatter per the spec schema. `stub: true` entries have only `title`, `type`, `blurb`, `order`. Non-stubs add `cta`, `impact` (list of `{amount, buys}`), optional `hero_image`, `gallery`, `donate_url`, `review_note` (ignored by build; flags copy pending PTC confirmation). Slug = filename.

- [ ] **Step 1: Write the three full content files**

`content/programs/walkerthon.md`:

```markdown
---
title: Walkerthon
type: event
blurb: Our signature fall fundraiser — the whole school runs, laps get counted, and the community rallies behind our Wildcats.
cta: Fuel the Walkerthon
hero_image: walkerthon/hero.jpg
order: 10
review_note: story + amounts drafted by Claude — confirm details and dollar figures with the PTC board/treasurer
impact:
  - amount: 25
    buys: prizes and celebration supplies for a whole classroom
  - amount: 75
    buys: event-day essentials — water, snacks, and lap cards for a grade
  - amount: 250
    buys: a meaningful boost toward the programs Walkerthon funds all year
---
One day every fall, the whole school laces up. Every Wildcat — from Pre-K to
5th grade — takes to the track while classmates cheer, volunteers count laps,
and the community rallies behind them.

The Walkerthon is the PTC's signature fundraiser, and it's our favorite kind:
every student participates, every lap counts, and every dollar pledged goes
right back into the school. The money raised here powers programs all year
long — field trips, Art Literacy, classroom funds, Reading Week, and more.

## How it works

- Students collect pledges from family and friends in the weeks before the run
- On event day, each lap gets counted (and loudly celebrated)
- Classes compete for participation — not just totals — so every family can be part of it

Whether you give, volunteer at the track, or just show up and cheer, you're
part of what makes this day the best one on the fall calendar.
---
```

Wait — no trailing `---` after body. The body ends at end of file. (Corrected in implementation; the file body simply ends after the last paragraph.)

`content/programs/field-trips.md`:

```markdown
---
title: Field Trips
type: program
blurb: Buses, admission, and experiences beyond the classroom — the PTC helps make field trips possible for every student, every year.
cta: Send a Wildcat on a field trip
hero_image: field-trips/hero.jpg
order: 20
review_note: story + amounts drafted by Claude — confirm details and dollar figures with the PTC board/treasurer
impact:
  - amount: 5
    buys: one student's field trip
  - amount: 30
    buys: a row of the bus — six students' trips
  - amount: 150
    buys: a whole classroom's admission
---
Some lessons don't fit inside a classroom. A tidepool. A stage. A museum
gallery. Field trips turn a unit of study into something students touch, see,
and remember for years.

The PTC helps fund field trips for every grade at William Walker — buses,
admission fees, and the extras that make the day work — so that cost is never
the reason a student stays behind.

## Why it matters

- Trips are tied to what students are learning in class, so the experience sticks
- The PTC's support covers students whose families can't chip in — every Wildcat goes
- For many students, these trips are a first: first time at the coast, first play, first museum

Five dollars covers one student's trip. It's one of the most direct ways a
small gift becomes a big day.
```

`content/programs/art-literacy.md`:

```markdown
---
title: Art Literacy
type: program
blurb: Volunteer-led art lessons that bring famous artists and hands-on projects into every classroom, several times a year.
cta: Bring art to a classroom
hero_image: art-literacy/hero.jpg
order: 30
review_note: story + amounts drafted by Claude — confirm details and dollar figures with the PTC board/treasurer
impact:
  - amount: 15
    buys: art supplies for one student for the whole year
  - amount: 60
    buys: paint, brushes, and materials for one classroom session
  - amount: 300
    buys: a full Art Literacy unit for an entire grade
---
Art isn't in the standard school budget — so the PTC and a crew of dedicated
parent volunteers bring it to every classroom themselves.

Through Art Literacy, students meet a famous artist's work, learn the story
and technique behind it, then make their own piece in that style. Monet's
water lilies, Kandinsky's circles, Northwest Coast printmaking — over their
years at Walker, students build a real foundation in looking at and making
art.

## What your support covers

- Paint, brushes, paper, clay, and printmaking supplies for every classroom
- Prints and materials that introduce each featured artist
- Training and materials for the parent volunteers who teach each lesson

No art experience needed to volunteer — training and lesson plans are
provided. And every dollar goes straight into supplies that end up in kids'
hands.
```

- [ ] **Step 2: Write the 16 stubs** (each file is exactly this shape, values from the table):

```markdown
---
title: <title>
type: <type>
blurb: <blurb>
order: <order>
stub: true
---
```

| file | title | type | order | blurb |
|---|---|---|---|---|
| mystery-science.md | Mystery Science | program | 40 | Hands-on science lessons that turn "why?" into experiments in every classroom. |
| oregon-battle-of-the-books.md | Oregon Battle of the Books | program | 50 | Oregon's statewide reading competition — Walker teams read, quiz, and battle their way through a great book list. |
| reading-week.md | Reading Week | program | 60 | A whole week celebrating books, with themed days, guest readers, and every student reading for the love of it. |
| field-day.md | Field Day | program | 70 | The classic end-of-year day of games, relays, and recess-level joy — equipment and supplies funded by the PTC. |
| sped-track-field-day.md | SPED Track & Field Day | program | 80 | A district track and field day for students in specialized programs — the PTC helps Walker's athletes get there and shine. |
| teacher-discretionary-funds.md | Teacher Discretionary Funds | program | 90 | Every teacher gets PTC funds to spend on what their classroom actually needs — no paperwork, no waiting. |
| sel-fund.md | SEL Fund | program | 100 | Supporting social-emotional learning at Walker — resources that help students manage feelings, build friendships, and thrive. |
| ptc-grant-program.md | PTC Grant Program | program | 110 | Staff can apply for PTC grants to fund big ideas — special projects, classroom tools, and new opportunities for students. |
| kinder-pumpkin-patch.md | Kinder Pumpkin Patch | program | 120 | Kindergartners' first field trip — a fall visit to the pumpkin patch, funded by the PTC. |
| staff-appreciation.md | Staff Appreciation | program | 130 | Meals, treats, and thank-yous throughout the year for the teachers and staff who show up for our kids every day. |
| staff-pd-expenses.md | Staff PD Expenses | program | 140 | Helping Walker's teachers grow — the PTC chips in on professional development costs. |
| kindness-fund.md | Kindness Fund | program | 150 | Quiet, immediate help for Walker families in need — coats, shoes, groceries, whatever a hard week calls for. |
| back-to-school-night.md | Back to School Night | event | 160 | We're there to welcome families, answer questions, and sign up new volunteers. |
| trunk-or-treat.md | Trunk or Treat | event | 170 | A safe, festive fall evening of decorated trunks and treats for our families. |
| multicultural-night.md | Multicultural Night | event | 180 | A beloved tradition celebrating the rich diversity of the William Walker community. |
| end-of-year-parties.md | End-of-Year & 5th Grade Parties | event | 190 | Celebrating a great year — and sending our 5th graders off in style. |

- [ ] **Step 3: Commit**

```bash
git add content/
git commit -m "Programs: add launch content — Walkerthon, Field Trips, Art Literacy + 16 stubs"
```

---

### Task 3: Build script + smoke test, generate pages

**Files:**
- Create: `scripts/build-programs.mjs`
- Create: `scripts/build-programs.test.mjs`
- Create (generated): `programs/index.html`, `programs/walkerthon.html`, `programs/field-trips.html`, `programs/art-literacy.html`

**Interfaces:**
- Consumes: content files (Task 2 schema), CSS classes (Task 1).
- Produces: `node scripts/build-programs.mjs` → wipes `programs/*.html`, regenerates all detail pages + index. Donate links carry `data-program-donate="<slug>"` (consumed by Task 4). Detail pages have `id="impact"` on the green section.

- [ ] **Step 1: Write the failing smoke test** (`scripts/build-programs.test.mjs`) — asserts on build output:

```js
#!/usr/bin/env node
/* Smoke test: node scripts/build-programs.test.mjs */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
execFileSync('node', [join(ROOT, 'scripts', 'build-programs.mjs')], { stdio: 'inherit' });

const read = (f) => readFileSync(join(ROOT, 'programs', f), 'utf8');

// detail pages exist for non-stubs
for (const slug of ['walkerthon', 'field-trips', 'art-literacy']) {
  assert(existsSync(join(ROOT, 'programs', slug + '.html')), slug + '.html missing');
}
// stubs do NOT get pages
assert(!existsSync(join(ROOT, 'programs', 'mystery-science.html')), 'stub generated a page');

const wt = read('walkerthon.html');
assert(wt.includes('id="impact"'), 'impact section missing');
assert(wt.includes('data-program-donate="walkerthon"'), 'donate attribution missing');
assert(wt.includes('zeffy.com'), 'donate link missing');
assert(wt.includes('donations support all PTC programs'), 'fineprint missing');
assert(wt.includes('hero--gradient') || wt.includes('hero--image'), 'hero variant missing');
// no photos exist yet → gradient hero, no broken img refs
if (!existsSync(join(ROOT, 'assets', 'programs', 'walkerthon', 'hero.jpg'))) {
  assert(wt.includes('hero--gradient'), 'missing hero image should fall back to gradient');
  assert(!wt.includes('/assets/programs/walkerthon/hero.jpg'), 'page references missing image');
}
// chrome + shared assets are absolute paths
assert(wt.includes('href="/styles.css"') && wt.includes('src="/script.js"'), 'absolute asset paths');

const idx = read('index.html');
for (const t of ['Walkerthon', 'Field Trips', 'Art Literacy', 'Mystery Science', 'Kindness Fund', 'Trunk or Treat']) {
  assert(idx.includes(t), 'index missing: ' + t);
}
assert(idx.includes('/programs/walkerthon'), 'index links detail page');
assert(!idx.includes('/programs/mystery-science'), 'index must not link stubs');

console.log('build-programs smoke test: OK');
```

- [ ] **Step 2: Run test to verify it fails** — `node scripts/build-programs.test.mjs` → fails (build script doesn't exist).

- [ ] **Step 3: Write `scripts/build-programs.mjs`** — full source (frontmatter parser, markdown renderer, validation, image checks, chrome, detail + index templates). See the implementation notes below; the script is ~330 lines. Key requirements it must satisfy (all asserted by the test or the spec):
  - Dependency-free; fails loudly (`process.exit(1)` with file + reason) on: missing/invalid frontmatter, unknown `type`, non-stub missing `cta` or `impact`, malformed impact tiers.
  - YAML subset: flat scalars + lists of flat objects (2-space indent, `- ` items). Booleans/numbers coerced. Lines starting `#` ignored. `review_note` allowed and ignored.
  - Markdown subset: `##`/`###` headings, paragraphs, `- ` lists, `**bold**`, `*italic*`, `[text](href)` (external links get `target="_blank" rel="noopener"`), standalone `![alt](src)` image blocks. HTML-escape everything first.
  - Images resolved against `assets/programs/`; missing hero → `hero--gradient`; missing gallery image → skipped with console.warn; empty gallery → section omitted; card media falls back to `program-card__ph` initial tile.
  - Detail page sections in order: chrome topbar (Programs nav item `aria-current="page"`, absolute hrefs), hero (eyebrow "Programs & Enrichment" / "A PTC Event", h1 title, lede = blurb, green CTA btn → donate URL with `data-program-donate`, `btn--outline-light` "See your impact ↓" → `#impact`), story (`block--white`, kicker "The Story", `.prose` markdown), gallery (`block--white`, kicker "In Photos", omitted when empty), impact (`block--green` `id="impact"`, kicker "Make It Happen", title "What your gift covers.", `.impact-grid` tiles `$N` + buys, `.impact-cta` with `btn--white` donate button labeled with `cta` + `data-program-donate`, `fineprint fineprint--light` with the required sentence), more-programs (`block--white`, kicker "Keep Exploring", up to 3 sibling non-stub cards + link to `/programs`), footer.
  - Index page: standard hero (default styling, no image) — eyebrow "William Walker PTC", title "Programs & Events", lede about recognition + support, actions: green Donate ↗ + blue "Sign up for updates" → `/#get-involved`; then `block--white` "Programs & enrichment" card grid and `block--blue` "Events we host" card grid, each sorted by `order`. Non-stub cards link (`program-card--link` + "Learn more →"); stub cards don't.
  - Head per page: GA4 snippet, title `"<Title> — William Walker Elementary PTC"`, meta description = blurb, canonical `https://williamwalkerptc.com/programs/<slug>` (index: `/programs`), OG tags (image = hero if it exists, else logo), theme-color, favicon, Figtree, `/styles.css`. Body end: Google Translate init + `/script.js` (defer).
  - Deletes stale `programs/*.html` before regenerating.

- [ ] **Step 4: Run test to verify it passes** — `node scripts/build-programs.test.mjs` → `build-programs smoke test: OK`.

- [ ] **Step 5: Commit script + generated output**

```bash
git add scripts/build-programs.mjs scripts/build-programs.test.mjs programs/
git commit -m "Programs: add md-driven build script + generated index and 3 detail pages"
```

---

### Task 4: GA4 `program_donate_click` event

**Files:**
- Modify: `script.js:168-179` (the delegated donate/signup click handler)

**Interfaces:**
- Consumes: `data-program-donate="<slug>"` attributes emitted by Task 3.

- [ ] **Step 1: Extend the existing delegated handler** — inside the `zeffy.com/paypal.com` branch add per-program attribution:

```js
    if (href.indexOf('zeffy.com') !== -1 || href.indexOf('paypal.com') !== -1) {
      track('donate', { link_text: label });
      var prog = a.getAttribute('data-program-donate');
      if (prog) track('program_donate_click', { program: prog, link_text: label });
    } else if (href === '#get-involved' || href === '/#get-involved' || href === '#signup') {
```

- [ ] **Step 2: Commit**

```bash
git add script.js
git commit -m "Programs: track program_donate_click with program slug on donate links"
```

---

### Task 5: Site integration — nav, footer, homepage links

**Files:**
- Modify: `index.html` (nav list ~line 109, footer nav ~line 345, pills ~lines 184-199, Walkerthon event card ~line 207)
- Modify: `calendar.html` (nav list + footer nav)
- Modify: `supplies.html` (nav list ~line 84, footer nav)

- [ ] **Step 1: Add Programs to primary nav on all three pages** — insert before the Calendar item. Homepage version:

```html
          <li><a href="/programs">Programs</a></li>
```

(same line on calendar.html and supplies.html).

- [ ] **Step 2: Add Programs to footer nav on all three pages** (calendar.html footer included), after "What We Do":

```html
        <a href="/programs">Programs</a>
```

- [ ] **Step 3: Homepage — link the items that now have pages**

Pills:

```html
          <li class="pill"><a href="/programs/art-literacy">Art Literacy</a></li>
          ...
          <li class="pill"><a href="/programs/field-trips">Field Trips</a></li>
```

Walkerthon event card — append link inside the card:

```html
          <article class="event-card">
            <h4>Walkerthon</h4>
            <p>Our signature fall fundraiser — the whole school runs, laps get counted, and the community rallies behind our Wildcats.</p>
            <a class="program-card__more" href="/programs/walkerthon">Learn more →</a>
          </article>
```

Also point the "What We Do" intro at the new index by adding after the pill list's `</ul>`... (skip — YAGNI; nav link suffices).

- [ ] **Step 4: Commit**

```bash
git add index.html calendar.html supplies.html
git commit -m "Programs: add nav/footer links and homepage cross-links to program pages"
```

---

### Task 6: Verify locally and deploy

- [ ] **Step 1: Serve locally and spot-check** — `npx serve` or `python3 -m http.server` from repo root; check `/programs/` and `/programs/walkerthon.html`: chrome renders, gradient hero, impact tiles, donate links, related cards, footer. Check mobile nav toggle and accessibility toggles work (shared `script.js`).
- [ ] **Step 2: Re-run smoke test** — `node scripts/build-programs.test.mjs` → OK.
- [ ] **Step 3: Push to main** — `git push` (Vercel auto-deploys; do not also run `vercel --prod`). Verify `https://williamwalkerptc.com/programs` after deploy.
- [ ] **Step 4: Post-deploy checks** — `/programs`, `/programs/walkerthon` return 200 with correct titles; donate link resolves; Google Translate widget loads on a program page.
