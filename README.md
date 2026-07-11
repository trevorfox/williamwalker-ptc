# William Walker Elementary PTC — Website

A single-page site for the William Walker Parent Teacher Club. Static HTML/CSS/JS —
no build step, no framework. Deployed on Vercel.

```
index.html    → all page content
styles.css    → all styling (Wildcat crest palette)
script.js     → accessibility toolbar, mobile nav, scroll animations
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

## ⚠️ TBD items (highlighted in bright yellow on the page)

Search the code for `TBD` to find each spot. Three things to finish:

### 1. Google Form (email signup)
In `index.html`, find `<!-- TBD: Replace this placeholder ... -->` inside the
`#signup` section. Replace the yellow `.tbd` block with your form's embed code:

1. Open your Google Form → **Send** → **`< >`** (embed HTML) → copy the `<iframe>`.
2. Paste it in place of the yellow box. Add `width="100%"` for best fit.

### 2. Instagram handle
In the **Connect** section, find `<!-- TBD: Instagram handle + link -->`.
Turn the `connect-card--tbd` div into a real link like the Facebook one:

```html
<li>
  <a class="connect-card" href="https://instagram.com/YOURHANDLE" target="_blank" rel="noopener">
    <span class="connect-card__icon" aria-hidden="true">◎</span>
    <span class="connect-card__body">
      <span class="connect-card__name">Instagram</span>
      <span class="connect-card__meta">@YOURHANDLE</span>
    </span>
    <span class="connect-card__arrow" aria-hidden="true">↗</span>
  </a>
</li>
```

### 3. Meeting day / time
In the **Meetings** section, find `<!-- TBD: add the current meeting day / time ... -->`
and replace the yellow box with the standing schedule.

## Deploy

Connected to Vercel — pushing to the GitHub `main` branch auto-deploys.

```bash
vercel --prod   # manual production deploy
```
