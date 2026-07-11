# William Walker Elementary PTC — Website

A single-page site for the William Walker Parent Teacher Club. Static HTML/CSS/JS —
no build step, no framework. Deployed on Vercel.

```
index.html    → all page content
styles.css    → all styling (blue + green + white, matched to the logo)
script.js     → accessibility toolbar, mobile nav, scroll animations
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

## Deploy

Connected to Vercel — pushing to the GitHub `main` branch auto-deploys.

```bash
vercel --prod   # manual production deploy
```
