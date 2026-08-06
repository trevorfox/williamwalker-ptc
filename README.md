# William Walker Elementary PTC — Website

A single-page site for the William Walker Parent Teacher Club. Static HTML/CSS/JS —
no build step, no framework. Deployed on Vercel.

```
index.html    → all page content
calendar.html → events calendar page (district feed + PTC meetings)
supplies.html → school supply lists + Office Depot 5% Back to Schools flow
styles.css    → all styling (blue + green + white, matched to the logo)
script.js     → accessibility toolbar, mobile nav, scroll animations
calendar.js   → calendar rendering + filters
supplies.js   → Office Depot search links, print flow, grade accordion
assets/logo.png → school "Home of the Wildcats" logo
```

## Run locally

Just open `index.html` in a browser, or serve the folder:

```bash
npx serve .
```

## Accessibility & translation

- **Google Translate** widget in the top bar (all languages).
- **Text size** controls (A− / A / A+), **High contrast** mode, and **Underline links** —
  choices are remembered per visitor via `localStorage`.
- Skip-to-content link, semantic landmarks, ARIA labels, visible focus rings,
  and `prefers-reduced-motion` support are built in.

## Editing content

All copy lives in `index.html`. Common edits:
- **Meeting schedule** — the `.meeting-card` in the `#meetings` section
  (currently: First Wednesday, 5:45–7:30 PM, September–June).
- **Programs / events** — the pill list and event cards in `#what-we-do`.

### Sign-up form
The email signup is a PTC-owned Google Form embedded in the `#signup` section
(`.signup__iframe`), with an "open in a new tab" fallback link. To change questions,
edit the form in Google Forms — the embed updates automatically. If the form is ever
replaced, swap the `src` on both the iframe and the fallback link in `index.html`.

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

## Deploy

Connected to Vercel — pushing to the GitHub `main` branch auto-deploys to
production at https://williamwalkerptc.com. Use **one** path per change; don't
also run a manual CLI deploy for the same commit (it creates a redundant
deployment).

```bash
vercel --prod   # manual fallback, only if a push doesn't auto-deploy
```
