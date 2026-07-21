# Get Your Supplies Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/supplies` page where families expand their child's grade, see the real 2026–27 list, one-click load it into an Amazon cart (with the PTC Associates tag), and are separately invited to donate via Zeffy.

**Architecture:** Static `supplies.html` following `calendar.html`'s shell (topbar, nav, footer, GA4, Google Translate). Supply data lives in the HTML itself as `<li data-asin data-qty>` items inside a `<details>` panel per grade; `supplies.js` reads the DOM to build the `gp/aws/cart/add.html` URL, tag item links, fire GA4 events, and drive the accordion. No build step, no fetch.

**Tech Stack:** Plain HTML/CSS/JS (ES5-style IIFE matching `script.js`), Vercel static hosting, GA4 `G-HV902LVJ1B`.

## Global Constraints

- Domain is `williamwalkerptc.com` (spec's `.org` was a typo). Canonical: `https://williamwalkerptc.com/supplies`.
- Associate tag placeholder: `PTCTAG-20` — exactly one constant, in `supplies.js`.
- Disclosure copy, verbatim, directly above every cart button: "As an Amazon Associate, William Walker PTC earns from qualifying purchases. This does not add any cost to your order."
- Donation is presented as separate and voluntary. Never imply purchases support the school.
- Zeffy URL: `https://www.zeffy.com/en-US/peer-to-peer/walkerthon--2026` (plain link — `script.js` already fires the GA4 `donate` event on zeffy.com hrefs).
- "Optional Classroom Donations" items are text-only: no ASINs, never in the cart.
- Personal-choice items (backpack, water bottle, "(Optional)" headphones) are listed but cart-excluded via `data-skip`.
- Match existing code style: ES5 IIFE, `'use strict'`, 2-space indent, BEM-ish CSS classes.
- Deploy = git push to `main` only (Vercel auto-deploys). Do NOT also run `vercel --prod`.

---

### Task 1: Page shell + grade tiles + nav links

**Files:**
- Create: `supplies.html`
- Modify: `index.html:109-116` (nav list), `index.html:344-349` (footer nav), `calendar.html:84-91` (nav list), `calendar.html:137-142` (footer nav)
- Modify: `styles.css` (append supplies styles)

**Interfaces:**
- Produces: `supplies.html` with `<section class="grade-panels">` containing six `<details class="grade" id="<slug>" data-grade="<slug>">` elements, slugs: `prek`, `kinder`, `grade12`, `grade34`, `grade5`, `isc`. Task 2 fills their bodies; Task 3's JS binds to `.grade-tile`, `details.grade`, `.cart-btn`.

- [ ] **Step 1: Create `supplies.html`**

Copy `calendar.html` lines 1–95 (head through `</header>`) verbatim as the shell, then apply exactly these changes:

```html
<title>School Supplies — William Walker Elementary PTC</title>
<meta name="description" content="Get your child's 2026–27 William Walker school supply list and add the whole list to an Amazon cart in one click — shipped straight to your home." />
<link rel="canonical" href="https://williamwalkerptc.com/supplies" />
```

In the nav list, add the Supplies item (current page) after Calendar:

```html
<li><a href="/#about">About</a></li>
<li><a href="/#what-we-do">What We Do</a></li>
<li><a href="/#get-involved">Get Involved</a></li>
<li><a href="/calendar">Calendar</a></li>
<li><a href="/supplies" aria-current="page">Supplies</a></li>
<li><a href="/#connect">Connect</a></li>
<li><a class="nav-cta" href="/#get-involved">Sign Up</a></li>
```

Then the main content skeleton (panels filled in Task 2):

```html
  <main id="main">
    <section class="block block--white supplies-head" aria-labelledby="supplies-title">
      <div class="wrap">
        <p class="kicker kicker--blue">School Supplies</p>
        <h1 id="supplies-title" class="section-title">Get your supplies in one click.</h1>
        <p class="lead">
          Pick your child's grade to see the official 2026–27 supply list. One tap adds
          the whole list to an Amazon cart, shipped straight to your home — or use the
          list to shop anywhere you like.
        </p>
        <nav class="grade-tiles" aria-label="Choose a grade">
          <a class="grade-tile" href="#prek">Pre-K</a>
          <a class="grade-tile" href="#kinder">Kindergarten</a>
          <a class="grade-tile" href="#grade12">1st &amp; 2nd</a>
          <a class="grade-tile" href="#grade34">3rd &amp; 4th</a>
          <a class="grade-tile" href="#grade5">5th</a>
          <a class="grade-tile" href="#isc">ISC</a>
        </nav>
      </div>
    </section>

    <section class="block block--white grade-panels" aria-label="Supply lists by grade">
      <div class="wrap">
        <!-- Task 2: six <details class="grade"> panels go here -->
      </div>
    </section>

    <section id="support" class="block block--green supplies-support" aria-labelledby="support-title">
      <div class="wrap">
        <p class="kicker kicker--ongreen">Support the PTC</p>
        <h2 id="support-title" class="section-title section-title--light">School supplies? Handled.</h2>
        <p class="lead lead--light">
          Separately — if you'd like to support William Walker PTC directly, you can chip
          in here. Donations fund enrichment programs, events, and classroom support for
          every Wildcat, and Zeffy charges us nothing, so every dollar reaches the PTC.
          Totally optional, always appreciated.
        </p>
        <a class="btn btn--white-outline" href="https://www.zeffy.com/en-US/peer-to-peer/walkerthon--2026" target="_blank" rel="noopener">
          Donate via Zeffy <span aria-hidden="true">↗</span>
        </a>
      </div>
    </section>
  </main>
```

Close with `calendar.html`'s footer (lines 130–150) — in its footer nav add `<a href="/supplies">Supplies</a>` after Calendar — then the Google Translate init script and:

```html
  <script src="script.js" defer></script>
  <script src="supplies.js" defer></script>
</body>
</html>
```

- [ ] **Step 2: Add nav + footer links on the other two pages**

`index.html` nav (after the Calendar `<li>`): `<li><a href="/supplies">Supplies</a></li>`
`index.html` footer nav (after Get Involved): `<a href="/supplies">Supplies</a>`
`calendar.html` nav (after Calendar `<li>`): `<li><a href="/supplies">Supplies</a></li>`
`calendar.html` footer nav (after Calendar): `<a href="/supplies">Supplies</a>`

- [ ] **Step 3: Append styles to `styles.css`**

```css
/* ========== Supplies page ========== */
.grade-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
  margin-top: 28px;
}
.grade-tile {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 64px;
  padding: 12px;
  border: 2px solid var(--blue, #2F67B2);
  border-radius: 12px;
  font-weight: 700;
  color: var(--blue, #2F67B2);
  text-decoration: none;
  text-align: center;
  transition: background .15s ease, color .15s ease;
}
.grade-tile:hover, .grade-tile:focus-visible { background: var(--blue, #2F67B2); color: #fff; }

.grade { border: 1px solid #d9e2ef; border-radius: 14px; margin-bottom: 16px; scroll-margin-top: 130px; }
.grade > summary {
  list-style: none; cursor: pointer; padding: 18px 22px;
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  font-size: 1.25rem; font-weight: 800; color: var(--blue, #2F67B2);
}
.grade > summary::-webkit-details-marker { display: none; }
.grade > summary::after { content: "+"; font-size: 1.5rem; line-height: 1; }
.grade[open] > summary::after { content: "−"; }
.grade__body { padding: 0 22px 24px; }
.grade__subhead { font-weight: 700; margin: 18px 0 8px; }

.supply-list { list-style: none; margin: 0 0 8px; padding: 0; }
.supply-list li { padding: 7px 0 7px 30px; position: relative; }
.supply-list li::before {
  content: ""; position: absolute; left: 2px; top: .78em;
  width: 14px; height: 14px; border: 2px solid var(--green, #079A48); border-radius: 4px;
}
.supply-list a { color: inherit; }
.supply-list .item-note { display: block; font-size: .88em; color: #5a6b80; }
.supply-list li[data-skip] .item-flag,
.supply-list li.no-asin .item-flag { font-size: .82em; font-weight: 700; color: #8a5a00; background: #fff3d6; border-radius: 6px; padding: 1px 8px; margin-left: 6px; white-space: nowrap; }

.donation-list { list-style: disc; margin: 0 0 8px 22px; padding: 0; color: #45566b; }
.donation-list li { padding: 3px 0; }

.disclosure { font-size: .88rem; color: #5a6b80; margin: 18px 0 10px; }
.cart-btn { width: 100%; max-width: 460px; }
@media (max-width: 640px) { .cart-btn { max-width: none; } }
.shop-anywhere { font-size: .9rem; color: #5a6b80; margin-top: 12px; }

.supplies-support .btn--white-outline {
  background: transparent; color: #fff; border: 2px solid #fff;
}
.supplies-support .btn--white-outline:hover { background: #fff; color: var(--green, #079A48); }

.donate-nudge {
  display: none; margin: 14px 0 0; padding: 12px 16px; border-radius: 10px;
  background: #eef7f1; color: #0b5c31; font-weight: 600;
}
.donate-nudge.is-on { display: block; }
```

(If `--blue`/`--green` custom properties don't exist in `styles.css`, use the literal hex values `#2F67B2`/`#079A48` — check `:root` first and match whichever the file actually uses.)

- [ ] **Step 4: Verify**

Run: `npx serve . -l 8899 &` then open `http://localhost:8899/supplies`.
Expected: page renders with site header/footer, six tiles, empty panels section, green support block. Nav on `/` and `/calendar` shows "Supplies".

- [ ] **Step 5: Commit**

```bash
git add supplies.html index.html calendar.html styles.css
git commit -m "Supplies page shell: grade tiles, support section, nav links"
```

---

### Task 2: Six grade panels with full 2026–27 lists (DOM-as-config)

**Files:**
- Modify: `supplies.html` (fill `.grade-panels .wrap`)

**Interfaces:**
- Consumes: panel skeleton from Task 1.
- Produces: for Task 3's JS — cart items are `li[data-qty]` (ASINs added in Task 4; until then `data-asin=""`), skipped items carry `data-skip`, each panel is `details.grade[data-grade][data-pdf]` and contains one `button.cart-btn` (rendered with the `hidden` attribute) and one `p.donate-nudge`.

**Panel template** — Pre-K shown complete; build all six from the data tables below using this exact pattern:

```html
<details class="grade" id="prek" data-grade="prek"
         data-pdf="https://resources.finalsite.net/images/v1781040447/beavertonk12orus/j3jspmrnqs2u6o7mmvmb/SL-PK.pdf">
  <summary>Pre-K</summary>
  <div class="grade__body">
    <p class="grade__subhead">Classroom supplies checklist</p>
    <ul class="supply-list">
      <li data-asin="" data-qty="1">1 Pack Crayola Markers</li>
      <li data-asin="" data-qty="1">1 Pack Glue Sticks</li>
      <li data-asin="" data-qty="1">1 Bottle White Liquid Glue (4 oz.)</li>
      <li data-asin="" data-qty="1">1 Pack Baby Wipes</li>
      <li data-asin="" data-qty="1">1 Hand Sanitizer</li>
      <li data-asin="" data-qty="1">1 Container Play-Doh</li>
      <li data-asin="" data-qty="1">1 Pack Crayons</li>
      <li data-asin="" data-qty="1">1 Folder <span class="item-note">Label it with your student's name.</span></li>
      <li data-asin="" data-qty="1">1 Notebook</li>
      <li data-asin="" data-qty="1">1 Pack Ticonderoga My First Wood-Cased Pencils</li>
      <li data-asin="" data-qty="1">1 Pack Gallon-Size Ziploc Bags</li>
      <li data-asin="" data-qty="1">1 Pack Dry Erase Markers (Fine Tip, Black)</li>
      <li data-asin="" data-qty="1">1 Container Disinfecting Wipes</li>
    </ul>
    <p class="disclosure">As an Amazon Associate, William Walker PTC earns from qualifying purchases. This does not add any cost to your order.</p>
    <button type="button" class="btn btn--blue cart-btn" hidden>Add this list to my Amazon cart <span aria-hidden="true">↗</span></button>
    <p class="donate-nudge">Supplies sorted! One more thing — <a href="#support">if you'd like, you can support the PTC too.</a></p>
    <p class="shop-anywhere">Prefer to shop on your own? This list works at any store — here's the
      <a href="https://resources.finalsite.net/images/v1781040447/beavertonk12orus/j3jspmrnqs2u6o7mmvmb/SL-PK.pdf" target="_blank" rel="noopener">official school PDF ↗</a>.</p>
  </div>
</details>
```

Rules applied when building the other five panels:
- Cart-excluded items get `data-skip` (and NO `data-asin`), plus a flag: `<span class="item-flag">buy separately</span>`. Applies to: backpacks, water bottle, and the 3rd/4th "(Optional)" headphones.
- "Optional Classroom Donations" sections use `<p class="grade__subhead">Optional classroom donations <span class="item-note">Extras teachers always appreciate — not part of the cart.</span></p>` + `<ul class="donation-list">` of plain `<li>` names.
- Ziploc gender lines collapse to one cart item: `1 Box Ziploc Plastic Baggies` with `<span class="item-note">School list suggests gallon/quart for boys, sandwich/snack for girls — the cart adds gallon size; swap sizes on Amazon if you like.</span>`
- Multi-color notebook/folder rows (3rd/4th) stay single `<li>` with the colors in an `item-note`; the ASIN task picks an assorted pack or splits into per-color `<li>`s if no good assorted product exists.

**Data — Kindergarten** (`id="kinder"`, pdf `…/km3i0gyogj7vsnhxzrmy/SL-K.pdf`), "Classroom supplies checklist", all cart qty 1 unless noted: 1 Ream White Copy Paper · 1 Box Kleenex · 1 Container Lysol Wipes · 1 Set Personalized Headphones · 1 Pack of 12 Colored Pencils · 1 Pack of 24 Crayons · 1 Pack of 10 Thick Crayola Markers · 1 Pack of 10 Crayola Markers · 1 Bottle Hand Sanitizer · 1 Container Baby Wipes · 1 Pack Black Expo Markers · 1 Pack Watercolors · 1 Primary Composition Book (Draw & Write Journal) · 1 Pack Glue Sticks · 1 Bottle Liquid Glue · 1 Pack Gallon-Size Ziploc Bags · 1 Pack Sandwich-Size Ziploc Bags · 1 Blue Plastic Folder with 2 Pockets · 1 Individual Play-Doh · 2 Packs Paper Mate Black Flair Pens (qty 2).
Optional donations: Watercolor Paper · Cardstock · Fun Stickers · Construction Paper · Snacks · Laminating Sheets · Colored Sharpies · Colored Expo Markers · Chalk · Crayola Multicultural Markers · Crayola Multicultural Colored Pencils.

**Data — 1st/2nd** (`id="grade12"`, pdf `…/xyb41it4tqsiwm1omec6/SL-12.pdf`), all cart qty 1 unless noted: 1 Pack Ticonderoga Pencils · 1 Pack of 12 Colored Pencils · 1 Pack of 10 Thin Crayola Markers · 1 Pack Black Thin Expo Markers · 1 Pack Watercolors · 1 Pack Pink Pearl Erasers · 2 Packs Paper Mate Black Flair Pens (qty 2) · 1 Green/Blue Highlighter or Marker · 1 Two-Pack Pocket Folders (note: Blue/Green preferred) · 1 Set Personalized Headphones · 2 Primary Draw/Write Composition Books (qty 2) · 1 Ream White Copy Paper · 1 Box Kleenex · 1 Container Lysol Wipes · 1 Pack Water Wipes or Baby Wipes · 1 Pump Bottle Hand Sanitizer.
Optional donations: Watercolor Paper · Cardstock · Black Sharpies · Colored Sharpies · USB-C Headphone Adapter · 1 Pack Large Paper Plates · Headphones.

**Data — 3rd/4th** (`id="grade34"`, pdf `…/qkwrv4jpcwcypbmmtq4l/SL-34.pdf`). Subhead 1 "Student supplies checklist" (note: "Please put your child's name on labeled items."): 1 Set Personalized Headphones (data-skip, note "Optional") · 3 Spiral Notebooks, 80–100 pages (qty 3, note "1 red, 1 blue, 1 green") · 3 Folders with Pockets & Prongs (qty 3, note "1 red, 1 blue, 1 green") · 1 Box Crayola Washable Markers (10 count) · 1 Pink Pearl Eraser · 1 Pair Fiskars 5" Pointed-Tip Scissors · 1 Plastic School Box (note "approx. 8.5″ × 5.75″ × 2.5″") · 1 Pack Expo Assorted Dry Erase Chisel-Tip Markers (4 count) · 1 Pack Crayola Colored Pencils (12 count) · 1 Washable Water Bottle (data-skip, note "No open thermos or cup lids — family's choice, buy separately") · 1 Backpack (data-skip, note "Family's choice — put your child's name between the straps").
Subhead 2 "Community classroom supplies" (note: "Collected and stored for classroom use."): 6 Glue Sticks (qty 1, note "one 6-pack") · 1 Box Ticonderoga Pencils (24 count) · 1 Pack White Copy Paper · 3 Boxes Facial Tissue (qty 3) · 2 Packs Disinfecting Wipes (qty 2, note "For surfaces, not skin") · 1 Box Ziploc Plastic Baggies (Ziploc note rule).
Optional donations: Crayola Multicultural Markers · Crayola Multicultural Colored Pencils · Bottles of Elmer's Glue · Ultra-Fine Black Sharpies · Watercolor Paper · Cardstock.

**Data — 5th** (`id="grade5"`, pdf `…/kvqnyzscj4m5voavqs4h/SL-5.pdf`), all cart qty 1 unless noted: 1 Ream White Copy Paper · 2 Containers Lysol Wipes (qty 2) · 1 Set Personalized Headphones · 1 Set of 24 Colored Pencils · 1 Set of 10 Colored Markers · 1 Pack Glue Sticks (3 count) · 1 Set of Pencils (24 count) · 1 Plastic Pencil Box · 2 Packs Yellow Highlighters (qty 2) · 2 College-Ruled Notebooks (qty 2) · 1 Pack Disinfecting Wipes (35 count) · 2 Boxes Kleenex (qty 2) · 1 Two-Inch D-Ring Binder · 1 Set Dry Erase Markers (Thin Tip) · 1 Set of 2 Pocket Folders · 1 Box Ziploc Plastic Baggies (Ziploc note rule) · 1 Backpack (data-skip, note "Family's choice — put your child's name between the straps").
Optional donations: Watercolor Paper · Cardstock · Black Sharpies · Colored Sharpies · Watercolors · Laminating Sheets.

**Data — ISC** (`id="isc"`, pdf `…/qblihioo3jujcy8yjalc/SL-ISC.pdf`), "Student supplies checklist", all cart qty 1: 1 Ream White Copy Paper · 1 Box Kleenex · 1 Container Lysol Wipes · 1 Box Gallon-Size Ziploc Bags · 1 White 3-Ring Binder (note "Ravins") · 1 Composition Book (note "Ravins") · 1 Watercolor Paint Set · 1 Bottle Glue · 1 Box Quart-Size Ziploc Bags · 1 Package Crayola Markers · 1 Package Crayola Jumbo Crayons · 1 Package Glue Sticks · 1 Box Magic Erasers (note "wood").

- [ ] **Step 1: Write all six panels into `supplies.html`** per template + data above.
- [ ] **Step 2: Verify** — reload `http://localhost:8899/supplies`; every panel opens/closes natively (`<details>`), all items/quantities match the tables above, cart buttons are hidden (no JS yet), PDF links resolve (spot-check two).
- [ ] **Step 3: Commit**

```bash
git add supplies.html
git commit -m "Supplies page: all six 2026-27 grade lists as data-attributed HTML"
```

---

### Task 3: `supplies.js` — cart builder, accordion, GA4

**Files:**
- Create: `supplies.js`

**Interfaces:**
- Consumes: DOM contract from Tasks 1–2 (`a.grade-tile[href="#slug"]`, `details.grade[data-grade]`, `li[data-asin][data-qty]`, `li[data-skip]`, `button.cart-btn[hidden]`, `p.donate-nudge`, optional `data-idealist` on the panel).
- Produces: GA4 events `supply_grade_select {grade}` and `supply_cart {grade, items}`.

- [ ] **Step 1: Write `supplies.js`**

```js
/* =========================================================================
   William Walker PTC — supplies page
   - Grade tiles open their <details> panel
   - Builds the Amazon bulk "add to cart" URL from li[data-asin][data-qty]
   - Tags per-item Amazon links; GA4 events; post-cart donate nudge
   ========================================================================= */
(function () {
  'use strict';

  /* Amazon Associates tag — replace when the PTC account is approved. */
  var TAG = 'PTCTAG-20';
  var CART_BASE = 'https://www.amazon.com/gp/aws/cart/add.html';

  function track(name, params) { try { if (window.gtag) window.gtag('event', name, params || {}); } catch (e) {} }

  var panels = Array.prototype.slice.call(document.querySelectorAll('details.grade'));

  /* ---------- grade tiles open the target panel ---------- */
  document.querySelectorAll('.grade-tile').forEach(function (tile) {
    tile.addEventListener('click', function () {
      var panel = document.querySelector(tile.getAttribute('href'));
      if (panel) panel.open = true; /* anchor jump proceeds natively */
    });
  });
  panels.forEach(function (panel) {
    panel.addEventListener('toggle', function () {
      if (panel.open) track('supply_grade_select', { grade: panel.getAttribute('data-grade') });
    });
  });

  /* ---------- cart items for a panel ---------- */
  function cartItems(panel) {
    return Array.prototype.slice.call(panel.querySelectorAll('li[data-asin]'))
      .filter(function (li) {
        return !li.hasAttribute('data-skip') && (li.getAttribute('data-asin') || '').length === 10;
      });
  }

  function cartUrl(items) {
    var parts = ['AssociateTag=' + encodeURIComponent(TAG)];
    items.forEach(function (li, i) {
      parts.push('ASIN.' + (i + 1) + '=' + encodeURIComponent(li.getAttribute('data-asin')));
      parts.push('Quantity.' + (i + 1) + '=' + encodeURIComponent(li.getAttribute('data-qty') || '1'));
    });
    return CART_BASE + '?' + parts.join('&');
  }

  /* ---------- wire each panel ---------- */
  panels.forEach(function (panel) {
    var btn = panel.querySelector('.cart-btn');
    if (!btn) return;
    var items = cartItems(panel);
    var ideaList = panel.getAttribute('data-idealist');

    /* Item names link to their product page (tagged) — item-level fallback. */
    items.forEach(function (li) {
      if (li.querySelector('a')) return;
      var a = document.createElement('a');
      a.href = 'https://www.amazon.com/dp/' + li.getAttribute('data-asin') + '?tag=' + encodeURIComponent(TAG);
      a.target = '_blank'; a.rel = 'noopener sponsored';
      while (li.firstChild && li.firstChild.nodeType === 3 || (li.firstChild && !li.firstChild.classList)) break; /* no-op guard */
      var note = li.querySelector('.item-note, .item-flag');
      while (li.firstChild && li.firstChild !== note) a.appendChild(li.firstChild);
      li.insertBefore(a, note || null);
    });

    /* Flag list items that aren't in the cart yet (no ASIN sourced). */
    var missing = 0;
    Array.prototype.slice.call(panel.querySelectorAll('li[data-asin]')).forEach(function (li) {
      if (!li.hasAttribute('data-skip') && (li.getAttribute('data-asin') || '').length !== 10) {
        missing++;
        li.classList.add('no-asin');
        if (!li.querySelector('.item-flag')) {
          var flag = document.createElement('span');
          flag.className = 'item-flag';
          flag.textContent = 'buy separately';
          li.appendChild(flag);
        }
      }
    });

    if (ideaList) {
      /* Fallback mode: Amazon cart-add endpoint retired — link the Idea List. */
      btn.hidden = false;
      btn.addEventListener('click', function () {
        track('supply_cart', { grade: panel.getAttribute('data-grade'), items: items.length, mode: 'idealist' });
        window.open(ideaList, '_blank', 'noopener');
        showNudge(panel);
      });
      return;
    }

    if (!items.length) return; /* nothing sourced yet — button stays hidden */
    if (missing) {
      var n = document.createElement('span');
      n.className = 'item-note';
      n.textContent = ' Items marked "buy separately" aren’t included in the cart.';
      btn.insertAdjacentElement('afterend', n);
    }
    btn.hidden = false;
    btn.addEventListener('click', function () {
      track('supply_cart', { grade: panel.getAttribute('data-grade'), items: items.length });
      window.open(cartUrl(items), '_blank', 'noopener');
      showNudge(panel);
    });
  });

  function showNudge(panel) {
    var nudge = panel.querySelector('.donate-nudge');
    if (!nudge) return;
    nudge.classList.add('is-on');
    nudge.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
})();
```

Note: delete the stray "no-op guard" line inside the item-link loop when writing the file — wrap text nodes cleanly: move every child before the first `.item-note`/`.item-flag` into the anchor. Final loop body:

```js
items.forEach(function (li) {
  if (li.querySelector('a')) return;
  var a = document.createElement('a');
  a.href = 'https://www.amazon.com/dp/' + li.getAttribute('data-asin') + '?tag=' + encodeURIComponent(TAG);
  a.target = '_blank'; a.rel = 'noopener sponsored';
  var note = li.querySelector('.item-note, .item-flag');
  while (li.firstChild && li.firstChild !== note) a.appendChild(li.firstChild);
  li.insertBefore(a, note || null);
});
```

- [ ] **Step 2: Verify with temporary ASINs**

Temporarily set two Pre-K items to known-real ASINs (e.g. Crayola markers `B00006IFAT`, Ticonderoga pencils `B002LARR7E`) and reload:
- Cart button appears on Pre-K only; other panels' buttons stay hidden; unsourced Pre-K items show "buy separately".
- Click: new tab opens `amazon.com/gp/aws/cart/add.html?...ASIN.1=...&Quantity.2=...` and Amazon shows both items in the cart. **This is the live endpoint test from the spec — if Amazon errors or ignores items, STOP and switch the design to per-grade Idea Lists (`data-idealist`) before continuing.**
- Nudge appears after click and links to `#support`.
- GA4: with DevTools network tab filtered to `collect`, `supply_grade_select` and `supply_cart` fire.
Revert the temporary ASINs (Task 4 fills them all properly).

- [ ] **Step 3: Commit**

```bash
git add supplies.js
git commit -m "Supplies page JS: bulk cart URL builder, accordion, GA4 events, donate nudge"
```

---

### Task 4: Source real ASINs for every cart item

**Files:**
- Modify: `supplies.html` (fill every `data-asin=""`)

**Interfaces:**
- Consumes: `li[data-asin=""]` slots from Task 2; verification behavior from Task 3.

- [ ] **Step 1: Research ASINs**

For each cart item across all six panels (~60 unique products; identical items across grades reuse the same ASIN — e.g. copy paper, Kleenex, Lysol wipes): web-search Amazon for a product that matches the list's specifics (brand and count when named, e.g. "Ticonderoga 24-count", "Expo chisel-tip 4-count", "Fiskars 5 inch pointed-tip"), preferring well-reviewed (4★+, 1k+ ratings), low-cost, Prime-eligible listings. Extract the 10-character ASIN from the `/dp/ASIN` URL.

Selection rules:
- Named brand on the list → that brand only.
- Generic items ("1 Notebook", "1 Hand Sanitizer") → cheapest well-reviewed mainstream option.
- 3rd/4th color-specific notebooks/folders → assorted multi-pack covering red/blue/green if available; otherwise split into per-color `<li data-qty="1">` entries.
- Ziploc boxes → gallon size (per design note).
- No confident match → leave `data-asin=""` (renders as "buy separately"); never guess.

- [ ] **Step 2: Fill the attributes** — write each ASIN into its `data-asin`; where one product covers a "2 Packs" line adjust `data-qty` accordingly (qty counts cart units of the chosen product, not list phrasing).

- [ ] **Step 3: Verify every grade's cart** — for each of the six panels: click the cart button, confirm Amazon loads a cart whose line items and quantities match the panel, and spot-check 3 products per grade for sane price/match. Confirm remaining "buy separately" flags are only: backpacks ×2, water bottle, optional headphones, and any genuinely unmatched items.

- [ ] **Step 4: Commit**

```bash
git add supplies.html
git commit -m "Supplies page: real Amazon ASINs for all grade lists"
```

---

### Task 5: Cross-cutting verification + README + deploy

**Files:**
- Modify: `README.md` (add supplies section)

- [ ] **Step 1: Full-page checks**
- Translate: switch language to Español via the language menu — list items translate (they're static DOM).
- No-JS: disable JS (DevTools → Command Menu → "Disable JavaScript"), reload — lists readable, cart buttons absent, PDF + item links still usable.
- Mobile: 375px-wide viewport — tiles and buttons thumb-sized, no horizontal scroll.
- Accessibility: keyboard-only pass — tiles, summaries, buttons, nudge link all reachable; focus visible.
- Compliance read-through: disclosure sits directly above every button; no copy anywhere implies purchases fund the PTC.

- [ ] **Step 2: Document in `README.md`** — append:

```markdown
## Supplies page (`/supplies`)

Grade supply lists live directly in `supplies.html` as `<li data-asin="…" data-qty="…">`
items — the HTML is the config. Annual refresh: update items/quantities from the school's
PDFs, refresh ASINs (any Amazon product URL contains it: `/dp/ASINHERE`), leave
`data-asin=""` to show "buy separately". The Amazon Associates tag is the `TAG` constant
in `supplies.js` (currently a placeholder — replace when the PTC account is approved).
If Amazon retires the bulk cart URL, set `data-idealist="<Amazon Idea List URL>"` on a
grade's `<details>` to switch that grade to its Idea List. Never put Amazon links in
emails/newsletters — link to the page instead (Associates policy).
```

- [ ] **Step 3: Commit + deploy**

```bash
git add README.md
git commit -m "Docs: supplies page annual-refresh and Associates-tag notes"
git push origin main   # Vercel auto-deploys; do NOT also run vercel --prod
```

Then verify `https://williamwalkerptc.com/supplies` once the deploy lands (check the Vercel dashboard or retry after ~1 min; if auto-deploy lags, `vercel --prod --yes` is the fallback — only if the push didn't trigger a build).
