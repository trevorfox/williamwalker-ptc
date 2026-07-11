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

## Items to finish

Search the code for `TO ADD`. One thing left:

### Meeting day / time
In the **Meetings** section, find `<!-- TO ADD: the standing meeting day / time ... -->`
and replace the `.note` box with the standing schedule.

### Sign-up form (pending)
A Google Form is being finalized under the PTC's own account. Once ready, replace the
`.note` in the `#signup` section with its embed iframe (see the `TO ADD` comment there);
`.signup__iframe` styling is already in `styles.css`.

## Deploy

Connected to Vercel — pushing to the GitHub `main` branch auto-deploys.

```bash
vercel --prod   # manual production deploy
```
