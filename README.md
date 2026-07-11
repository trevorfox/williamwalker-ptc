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

Search the code for `TO ADD` to find each spot. Two things left:

### 1. Google Form (email signup)
In `index.html`, find `<!-- TO ADD: paste the Google Form embed ... -->` inside the
`#signup` section. Replace the `.note` box with your form's embed code:

1. Open your Google Form → **Send** → **`< >`** (embed HTML) → copy the `<iframe>`.
2. Paste it in place of the box. Add `width="100%"` for best fit.

### 2. Meeting day / time
In the **Meetings** section, find `<!-- TO ADD: the standing meeting day / time ... -->`
and replace the `.note` box with the standing schedule.

## Deploy

Connected to Vercel — pushing to the GitHub `main` branch auto-deploys.

```bash
vercel --prod   # manual production deploy
```
