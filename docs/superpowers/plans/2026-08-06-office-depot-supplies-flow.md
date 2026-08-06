# Office Depot Supplies Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Amazon shopping flow on `/supplies` with Office Depot: per-item search links plus a printable per-grade checklist carrying the 5% Back to Schools ID (70243444).

**Architecture:** Plain static site, no build step. List data stays in `supplies.html` (`<li>` text is the config — Google Translate translates it). `supplies.js` builds Office Depot search links at page load from the English item text and drives a print flow (`body.printing-grade` + `.print-target` classes → `@media print` rules in `styles.css`). A dep-free Node smoke test guards the invariants.

**Tech Stack:** Vanilla HTML/CSS/JS (ES5-style, matching existing files), Node ≥18 for the smoke test (`node scripts/supplies-page.test.mjs`).

**Spec:** `docs/superpowers/specs/2026-08-06-office-depot-supplies-flow-design.md`

## Global Constraints

- School ID is exactly `70243444`; program name is "5% Back to Schools".
- OD search URL base: `https://www.officedepot.com/a/search/?q=` (verified live 2026-08-06).
- No Amazon references may remain in `supplies.html`, `supplies.js`, or `README.md` (historical files under `docs/superpowers/` and `scripts/out/`, and `scripts/supply-prices.mjs`, are left untouched).
- Search queries must be built at page load (before Google Translate mutates the DOM) so they stay English.
- No affiliate params on OD links: `target="_blank" rel="noopener"` only.
- JS style: ES5 (`var`, IIFE, `'use strict'`) to match `supplies.js`/`script.js`.
- Commit after each task; **do not `git push` until the final task** (push auto-deploys production via Vercel).
- Fine-print accuracy rules (from spec): say "qualifying" purchases; tech/headphones/ink/gift cards don't qualify; credits arrive quarterly as an OD merchandise card; same-quarter receipts can be credited retroactively. Nothing else from the FAQ goes on the page.

---

### Task 1: Clean slate + failing smoke test

**Files:**
- Modify: `supplies.js` (revert stale working-tree edit only — `git checkout`)
- Create: `scripts/supplies-page.test.mjs`

**Interfaces:**
- Produces: `node scripts/supplies-page.test.mjs` — exits 0 when all page invariants hold; prints ✓/✗ per check. Tasks 2–4 each make more checks pass; Task 5 requires exit 0.

- [ ] **Step 1: Discard the stale uncommitted `supplies.js` edit** (an abandoned Amazon-tag experiment, superseded by this plan):

```bash
cd /Users/trevor/projects/williamwalker
git checkout -- supplies.js
git status --short   # expect: clean
```

- [ ] **Step 2: Write the smoke test**

Create `scripts/supplies-page.test.mjs`:

```js
#!/usr/bin/env node
/* Smoke test for the /supplies Office Depot flow. Dep-free; run from repo root:
   node scripts/supplies-page.test.mjs */
import { readFileSync } from 'node:fs';

const html = readFileSync('supplies.html', 'utf8');
const js = readFileSync('supplies.js', 'utf8');
const css = readFileSync('styles.css', 'utf8');
const readme = readFileSync('README.md', 'utf8');

let failed = 0;
function check(name, ok) {
  console.log(`${ok ? '✓' : '✗'} ${name}`);
  if (!ok) failed++;
}

check('supplies.html has no Amazon references', !/amazon/i.test(html));
check('supplies.js has no Amazon references', !/amazon/i.test(js));
check('README has no Amazon references', !/amazon/i.test(readme));
check('no data-asin/data-qty/data-skip attributes remain', !/data-(asin|qty|skip)\b/.test(html));
check('supplies.js links to Office Depot search', js.includes('officedepot.com/a/search'));
check('all six grades have a print button', (html.match(/class="btn btn--blue print-btn"/g) || []).length === 6);
check('print sheet header exists with the school ID', /class="print-sheet"[\s\S]{0,600}70243444/.test(html));
check('school ID appears in callout, ID card, and print sheet', (html.match(/70243444/g) || []).length >= 3);
check('fine print covers qualifying-item exclusions', /ink\s*(&amp;|&)\s*toner/i.test(html));
check('fine print covers the forgot-the-ID save', /same[- ]quarter|within the same quarter/i.test(html));
check('styles.css has the print block', css.includes('@media print') && css.includes('.print-target') && css.includes('printing-grade'));
check('checklist checkboxes in print styles', css.includes('"☐ "') || css.includes("'☐ '"));
check('GA4: supply_print event wired', js.includes("'supply_print'"));
check('GA4: od_id_copy event wired', js.includes("'od_id_copy'"));
check('GA4: item clicks carry store + query params', js.includes("store: 'officedepot'"));
check('GA4: supply_cart event removed', !js.includes("'supply_cart'"));
check('data-q override hook exists in supplies.js', js.includes("getAttribute('data-q')"));

console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
```

- [ ] **Step 3: Run it — verify it fails on the not-yet-changed pages**

```bash
node scripts/supplies-page.test.mjs
```

Expected: exit 1. Currently-passing checks: none of the Amazon-absence checks (all three files still mention Amazon), and every new-feature check fails. Roughly 15–17 ✗.

- [ ] **Step 4: Commit**

```bash
git add scripts/supplies-page.test.mjs
git commit -m "Supplies: add smoke test for Office Depot flow (red)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Rewrite `supplies.html` around Office Depot

**Files:**
- Modify: `supplies.html`

**Interfaces:**
- Produces (relied on by Tasks 3–4):
  - `.print-sheet` div with a `[data-print-grade]` span, first child of `<main>`.
  - Per grade: `<button type="button" class="btn btn--blue print-btn">` inside `.grade__body`.
  - Supply `li`s carry only optional `data-q` (custom search query); item text is otherwise the query source.
  - `.od-id-card__copy` button unchanged (`data-copy="70243444"`).

- [ ] **Step 1: Update `<head>` copy**

Replace the meta description (line ~17):

```html
<meta name="description" content="Your child's official 2026–27 William Walker school supply list — find every item at Office Depot, or print the list with the school's 5% Back to Schools ID and shop in store." />
```

- [ ] **Step 2: Rewrite the page lead and callout** (lines ~103–111)

```html
        <p class="lead">
          Pick your child's grade to see the official 2026–27 supply list. Tap any item
          to find it at officedepot.com — or print your list and take it to any
          Office Depot store. Either way, give Walker's school ID at checkout and the
          school earns 5% back.
        </p>
        <p class="od-callout">
          <span aria-hidden="true">🏷️</span> School ID for checkout:
          <strong>70243444</strong> — every qualifying Office Depot purchase earns
          Walker 5% back. <a href="#shopping-helps">How it works ↓</a>
        </p>
```

- [ ] **Step 3: Add the print sheet header as the first child of `<main id="main">`**

```html
    <div class="print-sheet">
      <p class="print-sheet__school">William Walker Elementary — <span data-print-grade></span> Supply List 2026–27</p>
      <p class="print-sheet__id">Give Office Depot school ID <strong>70243444</strong> at checkout — in store, at officedepot.com, or by phone — and Walker earns 5% back in free supplies.</p>
    </div>
```

(No `hidden` attribute — `.print-sheet { display: none }` on screen comes from Task 4's CSS.)

- [ ] **Step 4: Strip Amazon attributes from every supply `li`**

In all six grade panels, delete every `data-asin="…"`, `data-qty="…"`, and `data-skip` attribute so items are plain `<li>Text…</li>` (keep `.item-note` spans). Example — before/after:

```html
<li data-asin="B003ULBOH4" data-qty="1">1 Pack Glue Sticks</li>
<li>1 Pack Glue Sticks</li>
```

A safe mechanical pass (then eyeball the diff):

```bash
perl -0pi -e 's/<li data-asin="[^"]*" data-qty="\d+">/<li>/g; s/<li data-skip data-qty="\d+">/<li>/g' supplies.html
git diff --stat supplies.html
```

- [ ] **Step 5: Add `data-q` search-query overrides**

Where the literal item text makes a poor OD search, add `data-q` to the `<li>`:

| Grade(s) | Item text starts with | `data-q` value |
|---|---|---|
| kinder, grade12, grade34, grade5 | `1 Set Personalized Headphones` | `kids headphones for school` |
| prek | `1 Folder` | `plastic 2 pocket folder` |
| prek | `1 Notebook` | `wide ruled spiral notebook` |
| grade12 | `1 Green/Blue Highlighter or Marker` | `highlighters green blue` |
| grade12 | `1 Two-Pack Pocket Folders` | `2 pocket folders` |
| grade12 | `1 Pack Water Wipes or Baby Wipes` | `baby wipes` |
| grade5 | `1 Two-Inch D-Ring Binder` | `2 inch d-ring binder` |
| grade5 | `1 Set of 2 Pocket Folders` | `2 pocket folders` |

Example: `<li data-q="kids headphones for school">1 Set Personalized Headphones</li>`

(This table is a starting set — Task 5's click-through may add more.)

- [ ] **Step 6: Reword Amazon-specific item notes**

- grade34 spiral notebooks: note becomes `1 red, 1 blue, 1 green.`
- grade34 folders with pockets & prongs: note becomes `1 red, 1 blue, 1 green.`
- grade34 + grade5 Ziploc baggies: note becomes `School list suggests gallon/quart for boys, sandwich/snack for girls — any size helps.`
- grade5 yellow highlighters: delete the note (`The linked product is a 12-pack…`).
- All four donation-list subheads: `Extras teachers always appreciate — not part of the cart.` becomes `Extras teachers always appreciate — totally optional.`

- [ ] **Step 7: Replace the disclosure + cart button in each of the six grade panels**

Replace this pair (identical in every panel):

```html
            <p class="disclosure">As an Amazon Associate, William Walker PTC earns from qualifying purchases. This does not add any cost to your order.</p>
            <button type="button" class="btn btn--blue cart-btn" hidden>Shop this list on Amazon <span aria-hidden="true">↗</span></button>
```

with:

```html
            <p class="disclosure">Item links open a search at officedepot.com — give school ID <strong>70243444</strong> at checkout and Walker earns 5% back.</p>
            <button type="button" class="btn btn--blue print-btn">Print this list <span aria-hidden="true">🖨</span></button>
```

Keep the `donate-nudge` and `shop-anywhere` (official PDF) lines as they are.

- [ ] **Step 8: Rewrite the `#shopping-helps` section** (lines ~374–391) as the ID explainer:

```html
    <section id="shopping-helps" class="block block--white" aria-labelledby="helps-title">
      <div class="wrap">
        <p class="kicker kicker--blue">The 5% Back to Schools Program</p>
        <h2 id="helps-title" class="section-title">Don't forget the school ID.</h2>
        <p class="lead">
          Give this ID at checkout every time — in any store, at
          <a href="https://www.officedepot.com" target="_blank" rel="noopener">officedepot.com</a>,
          or by phone at 1-800-GO-DEPOT — and Walker earns credits worth 5% of your
          school-supply purchase. It works all year long, not just at back-to-school.
        </p>
        <div class="od-id-card">
          <p class="od-id-card__label">William Walker's 5% Back to Schools ID</p>
          <p class="od-id-card__number">70243444</p>
          <button type="button" class="od-id-card__copy" data-copy="70243444" hidden>Copy ID</button>
        </div>
        <p class="disclosure">
          Basic school and office supplies qualify — paper, pens, binders, crayons, and
          nearly everything on these lists. Technology (like headphones), ink &amp;
          toner, and gift cards don't. Credits arrive quarterly as an Office Depot card
          the school spends on free supplies.
        </p>
        <p class="disclosure">
          Forgot to give the ID? Purchases can still be credited within the same
          quarter — bring your receipt to any Office Depot store, or use their online
          form for online orders.
        </p>
      </div>
    </section>
```

- [ ] **Step 9: Verify progress and check for stragglers**

```bash
grep -in "amazon\|data-asin\|data-qty\|data-skip\|cart-btn\|idealist" supplies.html   # expect: no output
node scripts/supplies-page.test.mjs
```

Expected: still exit 1, but all `supplies.html` checks now ✓ (no-Amazon, no data-attrs, six print buttons, print sheet, ID count, both fine-print checks). JS/CSS/README checks still ✗.

- [ ] **Step 10: Commit**

```bash
git add supplies.html
git commit -m "Supplies: reorient page around Office Depot 5% Back to Schools

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Rewrite `supplies.js` — search links, print flow, analytics

**Files:**
- Modify: `supplies.js` (full rewrite — replace the entire file)

**Interfaces:**
- Consumes (from Task 2): `.print-sheet [data-print-grade]`, `.print-btn` per panel, optional `data-q` on `li`, `.od-id-card__copy`.
- Produces (relied on by Task 4's CSS): during printing, `<body>` has class `printing-grade` and the chosen panel has class `print-target` and is `open`.

- [ ] **Step 1: Replace the whole file with:**

```js
/* =========================================================================
   William Walker PTC — supplies page
   - Every supply item links to an Office Depot search. Queries are built at
     page load from the English item text (before Google Translate mutates
     the DOM), so translated pages still search in English. data-q on an
     <li> overrides the derived query.
   - "Print this list" flags one grade + <body> with print classes and calls
     window.print(); @media print rules in styles.css render a one-sheet
     checklist headed by the 5% Back to Schools ID (70243444).
   - No affiliate params anywhere — the school ID given at checkout is the
     entire earning mechanism.
   ========================================================================= */
(function () {
  'use strict';

  var SEARCH_BASE = 'https://www.officedepot.com/a/search/?q=';

  function track(name, params) { try { if (window.gtag) window.gtag('event', name, params || {}); } catch (e) {} }

  var panels = Array.prototype.slice.call(document.querySelectorAll('details.grade'));

  panels.forEach(function (panel) {
    panel.addEventListener('toggle', function () {
      if (panel.open) track('supply_grade_select', { grade: panel.getAttribute('data-grade') });
    });
  });

  /* ---------- deep links open the target panel ---------- */
  function openFromHash() {
    if (!location.hash) return;
    var panel = document.querySelector('details.grade' + location.hash.replace(/[^#\w-]/g, ''));
    if (panel) panel.open = true;
  }
  openFromHash();
  window.addEventListener('hashchange', openFromHash);

  /* ---------- search query from item text ---------- */
  function itemQuery(li) {
    var custom = li.getAttribute('data-q');
    if (custom) return custom;
    var note = li.querySelector('.item-note, .item-flag');
    var text = '';
    for (var n = li.firstChild; n && n !== note; n = n.nextSibling) text += n.textContent;
    return text
      .replace(/\([^)]*\)/g, ' ')
      .replace(/^\s*\d+\s+(packs?|packages?|boxes?|bottles?|containers?|reams?|sets?|pairs?|individual)\s+(of\s+)?/i, '')
      .replace(/^\s*\d+\s+/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* ---------- wire each panel ---------- */
  panels.forEach(function (panel) {
    var grade = panel.getAttribute('data-grade');

    /* Item names link to an Office Depot search (built now = English). */
    Array.prototype.slice.call(panel.querySelectorAll('.supply-list li')).forEach(function (li) {
      if (li.querySelector('a')) return;
      var q = itemQuery(li);
      if (!q) return;
      var a = document.createElement('a');
      a.href = SEARCH_BASE + encodeURIComponent(q);
      a.target = '_blank';
      a.rel = 'noopener';
      a.setAttribute('data-q', q);
      var note = li.querySelector('.item-note, .item-flag');
      while (li.firstChild && li.firstChild !== note) a.appendChild(li.firstChild);
      li.insertBefore(a, note || null);
    });

    /* GA4: item-link clicks */
    panel.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a') : null;
      if (a && a.href.indexOf('officedepot.com/a/search') !== -1) {
        track('supply_item_click', { grade: grade, store: 'officedepot', q: a.getAttribute('data-q') || '' });
      }
    });

    var btn = panel.querySelector('.print-btn');
    if (btn) {
      btn.addEventListener('click', function () { printPanel(panel, grade); });
    }
  });

  /* ---------- print flow ---------- */
  function printPanel(panel, grade) {
    var slot = document.querySelector('.print-sheet [data-print-grade]');
    var summary = panel.querySelector('summary');
    if (slot && summary) slot.textContent = summary.textContent.replace(/\s+/g, ' ').trim();

    panel.open = true;
    panel.classList.add('print-target');
    document.body.classList.add('printing-grade');
    track('supply_print', { grade: grade });

    var done = false;
    function cleanup() {
      if (done) return;
      done = true;
      window.removeEventListener('afterprint', cleanup);
      panel.classList.remove('print-target');
      document.body.classList.remove('printing-grade');
      showNudge(panel);
    }
    window.addEventListener('afterprint', cleanup);
    window.print();
    /* iOS Safari doesn't reliably fire afterprint */
    setTimeout(cleanup, 1000);
  }

  /* ---------- Office Depot ID copy button ---------- */
  var copyBtn = document.querySelector('.od-id-card__copy');
  if (copyBtn && navigator.clipboard) {
    copyBtn.hidden = false;
    copyBtn.addEventListener('click', function () {
      navigator.clipboard.writeText(copyBtn.getAttribute('data-copy')).then(function () {
        track('od_id_copy', {});
        copyBtn.textContent = 'Copied ✓';
        setTimeout(function () { copyBtn.textContent = 'Copy ID'; }, 2000);
      });
    });
  }

  function showNudge(panel) {
    var nudge = panel.querySelector('.donate-nudge');
    if (!nudge) return;
    nudge.classList.add('is-on');
    nudge.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
})();
```

- [ ] **Step 2: Verify progress**

```bash
node scripts/supplies-page.test.mjs
```

Expected: still exit 1 — all `supplies.js` checks now ✓ (no-Amazon, OD search base, `supply_print`, `od_id_copy`, `store: 'officedepot'`, no `supply_cart`, `data-q` hook). Only the CSS and README checks remain ✗.

- [ ] **Step 3: Commit**

```bash
git add supplies.js
git commit -m "Supplies: Office Depot search links + printable-list flow

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Print styles in `styles.css`

**Files:**
- Modify: `styles.css` (append; also update the two stale `.cart-btn` rules around lines 554–557)

**Interfaces:**
- Consumes (from Tasks 2–3): `.print-sheet`, `body.printing-grade`, `.grade.print-target`, `.print-btn`.

- [ ] **Step 1: Retarget the button rules**

Around lines 554–557, `.cart-btn` no longer exists; change:

```css
.cart-btn { width: 100%; max-width: 460px; justify-content: center; }
.cart-btn[hidden] { display: none; }
```

to:

```css
.print-btn { width: 100%; max-width: 460px; justify-content: center; }
```

- [ ] **Step 2: Append the print block at the end of `styles.css`:**

```css
/* =========================================================================
   Print: one-sheet supply checklist (triggered by the per-grade
   "Print this list" button — supplies.js sets body.printing-grade
   and .print-target on the chosen grade)
   ========================================================================= */
.print-sheet { display: none; }

@media print {
  body.printing-grade { background: #fff; }

  body.printing-grade .topbar,
  body.printing-grade .site-footer,
  body.printing-grade .skip-link,
  body.printing-grade .supplies-head,
  body.printing-grade .supplies-support,
  body.printing-grade #shopping-helps,
  body.printing-grade .grade:not(.print-target) { display: none !important; }

  body.printing-grade .print-sheet {
    display: block !important;
    border: 3px solid #000;
    padding: 12px 16px;
    margin: 0 0 16px;
  }
  body.printing-grade .print-sheet__school { font-size: 1.15rem; font-weight: 800; margin: 0 0 6px; }
  body.printing-grade .print-sheet__id { font-size: 1rem; margin: 0; }

  body.printing-grade .grade.print-target {
    display: block;
    border: none;
    box-shadow: none;
    padding: 0;
    margin: 0;
  }
  body.printing-grade .grade.print-target summary {
    font-size: 1.25rem;
    font-weight: 800;
    list-style: none;
    padding: 0 0 6px;
  }
  body.printing-grade .grade.print-target summary::-webkit-details-marker { display: none; }
  body.printing-grade .grade.print-target .grade__body { padding: 0; }

  body.printing-grade .print-btn,
  body.printing-grade .donate-nudge,
  body.printing-grade .disclosure,
  body.printing-grade .shop-anywhere { display: none !important; }

  body.printing-grade .supply-list,
  body.printing-grade .donation-list { list-style: none; padding-left: 0; margin: 0 0 10px; }
  body.printing-grade .supply-list li,
  body.printing-grade .donation-list li { padding: 2px 0; break-inside: avoid; }
  body.printing-grade .supply-list li::before,
  body.printing-grade .donation-list li::before { content: "☐ "; font-size: 1.05em; }

  body.printing-grade .supply-list a {
    color: inherit;
    text-decoration: none;
  }
}
```

- [ ] **Step 3: Verify**

```bash
node scripts/supplies-page.test.mjs
```

Expected: only the README check still ✗; everything else ✓.

- [ ] **Step 4: Commit**

```bash
git add styles.css
git commit -m "Supplies: print stylesheet for one-sheet checklist with school ID

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: README, full green run, manual verification, ship

**Files:**
- Modify: `README.md` (file-map lines ~9 and ~13, and the whole "Supplies page (`/supplies`)" section, lines ~46–64)

**Interfaces:**
- Consumes: everything above. Terminal task — ends with push (auto-deploys production).

- [ ] **Step 1: Update the README file map** (lines ~9 and ~13):

```markdown
supplies.html → school supply lists + Office Depot 5% Back to Schools flow
supplies.js   → Office Depot search links, print flow, grade accordion
```

- [ ] **Step 2: Replace the "Supplies page (`/supplies`)" section** (everything from the `## Supplies page` heading through the paragraph ending "link to the page instead (Associates policy).") with:

```markdown
## Supplies page (`/supplies`)

Grade supply lists live directly in `supplies.html` as plain `<li>` items — the HTML
is the config, and Google Translate translates it in place. At page load `supplies.js`
wraps each item in an Office Depot search link (`officedepot.com/a/search/?q=…`) built
from the item's English text; add `data-q="…"` to an `<li>` to override the derived
query when the literal text searches poorly. Annual refresh: update items and
quantities from the school's official PDFs (linked per grade), and re-spot-check a few
search links.

Each grade has a **Print this list** button: it prints a one-sheet checklist headed by
the school's 5% Back to Schools ID (**70243444** — also shown in the page callout and
ID card). Parents give that ID at any Office Depot checkout (store, officedepot.com,
or 1-800-GO-DEPOT) and the school earns 5% of qualifying purchases back as quarterly
merchandise-card credits. There are no affiliate links or tags — the ID is the entire
earning mechanism, so the page links are safe to share anywhere, including email.

GA4 events: `supply_grade_select`, `supply_item_click` (grade/store/q),
`supply_print` (grade), `od_id_copy`. Smoke test: `node scripts/supplies-page.test.mjs`.
```

- [ ] **Step 3: Full test run**

```bash
node scripts/supplies-page.test.mjs
```

Expected: **All checks passed**, exit 0.

- [ ] **Step 4: Manual browser verification**

```bash
npx serve . -l 3999   # or: python3 -m http.server 3999
```

Open `http://localhost:3999/supplies.html` and verify:

1. **Links:** open each grade; every supply item is a link; spot-click ~3 items per grade — each opens an OD search whose top results plausibly match the item. Where results are junk, add a `data-q` override to that `<li>` (same pattern as Task 2 Step 5) and re-check.
2. **Print:** click "Print this list" on Pre-K and on 3rd/4th (the two-list + donation-list case). Print preview must show ONLY: the bordered ID header, the grade title, and checkbox items — no nav/footer/other grades/buttons; ideally one sheet (two is acceptable for 3rd/4th). Cancel the dialog; page returns to normal (classes cleaned up, donate nudge visible).
3. **Deep link:** `http://localhost:3999/supplies.html#grade5` auto-opens 5th grade.
4. **Translate:** switch page language to Español via the Language menu; item links still carry English `?q=` values; Print still renders (translated text is fine).
5. **Copy ID:** button shows "Copied ✓" and clipboard holds `70243444`.

Fix anything found (edit → re-run smoke test → re-check in browser).

- [ ] **Step 5: Commit and ship**

```bash
git add README.md supplies.html   # supplies.html only if data-q overrides were added in Step 4
git commit -m "Supplies: README for Office Depot flow

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push
```

Vercel auto-deploys `main`. After ~1 min, verify `https://williamwalkerptc.com/supplies`: item links, one print preview, ID visible. If the auto-deploy lags, `vercel --prod --yes` from the repo folder — but never both for the same change.

- [ ] **Step 6: Post-ship checks**

- GA4 DebugView (or Realtime): trigger `supply_item_click`, `supply_print`, `od_id_copy` on production.
- Confirm no `wwptc-20`/Amazon URLs remain anywhere user-facing: `grep -Rin "amazon" index.html calendar.html supplies.html supplies.js script.js styles.css README.md` → no output.
