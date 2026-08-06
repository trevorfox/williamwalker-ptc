# Office Depot Supplies Flow — Design

**Date:** 2026-08-06
**Status:** Approved pending user review

## Goal

Reorient `/supplies` entirely around Office Depot and the 5% Back to Schools
program (Walker's ID: **70243444**). Parents get two complete paths:

1. **Shop online** — every list item links to an Office Depot search; parent
   enters the school ID at checkout.
2. **Shop in store** — print a one-sheet checklist (with the school ID on it)
   and take it to any Office Depot.

All Amazon affiliate machinery is removed.

## Verified program facts (source: officedepot.com 5% FAQ PDF, fetched 2026-08-06)

- 5% of **qualifying** purchases becomes school credits; credits are tallied
  quarterly and mailed as an Office Depot merchandise card (min $10) that the
  school spends on free supplies.
- ID can be given in any U.S. store, online at officedepot.com, or by phone
  (1-800-GO-DEPOT). It must be given **every purchase** — OD cannot link the ID
  to a customer account.
- Qualifying = basic school/office supplies (paper, pens, binders, crayons…).
  **Not** qualifying: technology/consumer electronics + accessories (this
  includes the headphones items on our lists), ink & toner, furniture, gift
  cards, Copy & Print, postage, contract business accounts.
- Forgot the ID? Purchases can be credited retroactively **within the same
  quarter**: bring the receipt to a store, or use OD's online form for
  online/phone orders.
- Program runs all year; ID number is permanent (no re-enrollment).

## Design

### 1. Page framing (`supplies.html`)

- Lead copy: pick your grade → tap any item to find it at officedepot.com, or
  print the list for any Office Depot store. Always give ID 70243444 at
  checkout.
- Head callout states the value plainly: every qualifying purchase earns Walker
  5% back — give ID 70243444 at checkout.
- The existing `#shopping-helps` section becomes the ID explainer ("Don't
  forget the school ID" framing), keeping the ID card + Copy button. It gains
  exactly two fine-print lines (accuracy without drowning detail):
  - Qualifying scope + credit form: basic school supplies qualify (tech like
    headphones, ink, and gift cards don't); credits arrive quarterly as an
    Office Depot card the school spends on free supplies.
  - The forgot-the-ID save: same-quarter receipts can still be credited at any
    store (or via OD's online form for online orders).
- Everything else from the FAQ stays off the page.

### 2. Per-item Office Depot search links (`supplies.js`)

- Each `li` in a supply list gets its name wrapped in a link to
  `https://www.officedepot.com/a/search/?q=<query>` (verified working; the old
  `catalog/search.do?Ntt=` form 301s here).
- Query built **at page load** from the item's English text so Google
  Translate users still generate English searches. Default query = item text
  with the leading quantity phrase stripped ("1 Pack Glue Sticks" → "glue
  sticks"). Optional `data-q` attribute overrides the query where literal text
  searches poorly; all ~80 items are spot-checked during implementation and
  given overrides as needed.
- All items get links (no more `data-skip` — a search link for a backpack is
  harmless). `data-asin` / `data-qty` / `data-skip` attributes are deleted.
- Links: `target="_blank" rel="noopener"`. No affiliate params — the school ID
  at checkout is the entire earning mechanism.

### 3. Print flow (`supplies.html`, `supplies.js`, `styles.css`)

- Each grade panel gets a **"Print this list"** button (replacing the Amazon
  cart button). Clicking marks that panel as the print target (class on
  `<body>`/panel), calls `window.print()`, and clears the mark afterward.
- New `@media print` block renders only:
  - Header: school name + grade + a bold boxed line — give Office Depot ID
    **70243444** at checkout (in store, online, or by phone) and Walker earns
    5% back in free supplies.
  - The grade's items as a checkbox checklist (`☐` via CSS `::before`), links
    rendered as plain text (no URLs, no underlines).
  - Nav, footer, other grades, buttons, nudges all hidden.
- Goal: one sheet, hand-it-to-the-cashier ready. Printing a translated page
  prints the translated text — fine.

### 4. Amazon removal

- `supplies.js`: delete `TAG`, `BULK_CART`, `CART_BASE`, `cartItems`,
  `cartUrl`, Amazon link wrapping, cart-button wiring, and idea-list mode. The
  uncommitted `ocsl-20` working-tree diff is superseded and discarded.
- `supplies.html`: delete both Associates disclosure paragraphs and Amazon
  wording in lead/buttons. Keep the per-grade official-school-PDF link.
- Donate nudge stays; it now fires after Print (was: after cart).
- `README.md` supplies section updated. Historical specs/plans and
  `scripts/supply-prices.mjs` + outputs are left untouched.

### 5. Analytics (GA4)

- Keep `supply_grade_select` (unchanged).
- Keep `supply_item_click`, params now `{ grade, store: 'officedepot', q }`
  (replaces `asin`).
- Drop `supply_cart`.
- Add `supply_print` `{ grade }` and `od_id_copy` (Copy-ID button).

## Testing

- Click-through spot-check of search links in every grade; add `data-q`
  overrides where top results are junk.
- Print preview: desktop Chrome/Safari + iOS Safari; verify one-sheet layout,
  ID box legibility, other grades hidden.
- Google Translate pass: switch page language, confirm item links still carry
  English queries and print still works.
- GA4 DebugView: `supply_item_click`, `supply_print`, `od_id_copy`.

## Out of scope

- TeacherLists / OD school-list registration (revisit if per-item search
  friction proves high).
- Badging individual non-qualifying items (headphones) — covered by the one
  fine-print line.
- Any Amazon fallback path.
