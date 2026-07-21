# William Walker Elementary PTC — Website

A single-page site for the William Walker Parent Teacher Club. Static HTML/CSS/JS —
no build step, no framework. Deployed on Vercel.

```
index.html    → all page content
calendar.html → events calendar page (district feed + PTC meetings)
supplies.html → school supply lists + one-click Amazon cart
styles.css    → all styling (blue + green + white, matched to the logo)
script.js     → accessibility toolbar, mobile nav, scroll animations
calendar.js   → calendar rendering + filters
supplies.js   → Amazon cart URL builder, grade accordion
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
  (currently: First Wednesday, 6:00–7:30 PM, September–June).
- **Programs / events** — the pill list and event cards in `#what-we-do`.

### Sign-up form
The email signup is a PTC-owned Google Form embedded in the `#signup` section
(`.signup__iframe`), with an "open in a new tab" fallback link. To change questions,
edit the form in Google Forms — the embed updates automatically. If the form is ever
replaced, swap the `src` on both the iframe and the fallback link in `index.html`.

## Supplies page (`/supplies`)

Grade supply lists live directly in `supplies.html` as `<li data-asin="…" data-qty="…">`
items — the HTML is the config. Annual refresh: update items/quantities from the school's
PDFs, refresh ASINs (any Amazon product URL contains it: `/dp/ASINHERE`), leave
`data-asin=""` to show "buy separately", or add `data-skip` for items families should
choose themselves (backpacks etc.). The Amazon Associates tag is the `TAG` constant in
`supplies.js` (currently a placeholder — replace when the PTC account is approved).
If Amazon retires the bulk cart URL, set `data-idealist="<Amazon Idea List URL>"` on a
grade's `<details>` to switch that grade to its Idea List. Never put Amazon links in
emails/newsletters — link to the page instead (Associates policy).

## Deploy

Connected to Vercel — pushing to the GitHub `main` branch auto-deploys to
production at https://williamwalkerptc.com. Use **one** path per change; don't
also run a manual CLI deploy for the same commit (it creates a redundant
deployment).

```bash
vercel --prod   # manual fallback, only if a push doesn't auto-deploy
```
