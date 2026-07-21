# Get Your Supplies page — design

**Date:** 2026-07-21 · **Status:** Approved
**URL:** `https://williamwalkerptc.com/supplies` (`supplies.html`, served via `cleanUrls`)

A no-fulfillment school-supply page: families pick a grade, see the full 2026–27 list,
one-click load it into an Amazon cart (shipped to their home), and are separately invited
to donate to the PTC via Zeffy. PTC revenue = Amazon Associates commission (incidental)
+ voluntary Zeffy donations (primary). No sourcing, packing, or inventory by the PTC.

## Architecture

- Plain static page following `calendar.html` exactly: same topbar (language +
  accessibility menus), header/nav, footer, GA4 snippet, Google Translate init,
  `styles.css`, `script.js`. New files: `supplies.html`, `supplies.js`. New styles
  appended to `styles.css`.
- **DOM as config.** Each supply item is real HTML:
  `<li data-asin="XXXXXXXXXX" data-qty="2">…</li>`. `supplies.js` reads the DOM to build
  cart URLs. One source of truth; lists translate via Google Translate (JS-rendered
  content would not); readable without JS; annual refresh = edit the `<li>`s.
- Associate tag: single constant in `supplies.js`, placeholder `PTCTAG-20` until the
  PTC's Amazon Associates account is approved.
- Nav on `index.html` and `calendar.html` gains a "Supplies" link.

## Page structure (top to bottom)

1. **Intro + grade tiles** — Pre-K, Kindergarten, 1st/2nd, 3rd/4th, 5th, ISC (the six
   real lists from the school's official PDFs at
   `williamwalker.beaverton.k12.or.us/about-us/supply-list`). Tiles are thumb-friendly;
   selecting one expands/reveals that grade's panel (accordion-style on mobile).
2. **Per-grade panel:**
   - Full human-readable checklist with quantities (required items; for 3rd/4th also the
     "Community Classroom Supplies" section — quantified and expected, so cart-included).
   - "Optional Classroom Donations" render as a plain text list: no ASINs, never in the
     cart, so nothing reads as a purchase ask.
   - **Affiliate disclosure directly above the button:** "As an Amazon Associate,
     William Walker PTC earns from qualifying purchases. This does not add any cost to
     your order."
   - Primary button: **"Add this list to my Amazon cart ↗"**.
   - "Prefer to shop on your own?" note linking that grade's official school PDF.
3. **"Support the PTC" section** (green block, clearly separate): supplies are handled;
   *separately*, chip in via Zeffy (`zeffy.com/en-US/peer-to-peer/walkerthon--2026`).
   Link, not iframe (Zeffy peer-to-peer embeds poorly; site's donate pattern is links,
   already GA4-tracked by `script.js`). After a cart click, scroll a gentle nudge toward
   this section.

## Cart mechanics

- URL: `https://www.amazon.com/gp/aws/cart/add.html?AssociateTag=<TAG>&ASIN.1=…&Quantity.1=…&…`
  built from the panel's `data-asin`/`data-qty` attributes; opens in a new tab.
- Item names hyperlink to their Amazon product page (with tag) — item-level fallback.
- Per-grade optional `data-idealist` URL on the panel: if Amazon retires the cart-add
  endpoint (PA-API sunset mid-2026), flip the panel to link the Idea List instead.
- Live-test the bulk cart URL before shipping.
- ASINs sourced by the developer (well-reviewed, low-cost, matching list specifics),
  flagged for PTC review. Unmatched items ship with no ASIN and display as "buy
  separately" — listed but excluded from the cart, with a count shown so nothing is
  silently dropped.
- Ziploc "Boys: Gallon/Quart, Girls: Sandwich/Snack" lines: cart adds one gallon-size
  box; original note displayed so families can swap.

## Analytics

GA4 (existing `G-HV902LVJ1B`): new events `supply_grade_select` (grade) and
`supply_cart` (grade, item count). Zeffy clicks already fire `donate` via `script.js`.

## Compliance

- No incentive tying: purchase and donation presented as two separate things; never
  "buy through our links to support the school."
- Disclosure clear and adjacent to every Amazon button.
- Affiliate links live only on the site; newsletters share the page URL.
- No markup, no PTC sale, no Oregon sales tax. Flag UBIT note to treasurer (low-risk).

## Error handling

- No JS: lists fully readable; cart buttons hidden (they're inert without JS); item
  links and PDF links still work.
- Missing/empty ASINs: item shown as "buy separately," excluded from the cart URL.
- Cart endpoint dead: per-grade Idea List fallback flag; item links remain.

## Testing

Manual: cart URL loads a correct multi-item cart on desktop + mobile; disclosure
visible above the fold of each panel; translate to es/zh-CN renders list items;
no-JS render; GA4 events fire in debug view; Lighthouse mobile pass.

## Out of scope

Teacher-split lists (school publishes one per grade band), per-grade pages, Zeffy
iframe embed, email campaigns, automated ASIN refresh (annual manual edit, owner TBD
by PTC).
