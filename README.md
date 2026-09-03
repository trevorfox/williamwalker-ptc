# William Walker Elementary PTC — Website

A single-page site for the William Walker Parent Teacher Club. Static HTML/CSS/JS —
no build step, no framework. Deployed on Vercel.

```
index.html    → all page content
calendar.html → events calendar page (district feed + PTC Google Calendar + PTC meetings)
supplies.html → school supply lists + Office Depot 5% Back to Schools flow
styles.css    → all styling (blue + green + white, matched to the logo)
script.js     → accessibility toolbar, mobile nav, scroll animations
calendar.js   → calendar rendering + filters
supplies.js   → Office Depot search links, print flow, grade accordion
assets/logo.png → school "Home of the Wildcats" logo

blog/         → GENERATED from content/blog/*.md — see "Blog" below
programs/     → GENERATED from content/programs/*.md
scripts/lib/  → markdown renderer + shared page chrome, used by both generators
```

Two directories are build output and should not be hand-edited: `blog/` and
`programs/`. Edit the markdown in `content/`, re-run the generator, and commit
both the source and the generated HTML.

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
  (currently: First Wednesday, 6:00–7:00 PM, September–June).
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
ID card). Parents give that ID **when they pay** — at the register in store, or on a
1-800-GO-DEPOT phone order — and the school earns 5% of qualifying purchases back as
quarterly merchandise-card credits. Verified 2026-08-06 with a real order: online
checkout has NO school-ID field and stores can't credit a purchase after the fact
(despite what OD's FAQ PDF claims), so the site steers people to shop in store with
the printed list. There are no affiliate links or tags — the ID is the entire earning
mechanism, so the page links are safe to share anywhere, including email.

GA4 events: `supply_grade_select`, `supply_item_click` (grade/store/q),
`supply_print` (grade), `od_id_copy`. Smoke test: `node scripts/supplies-page.test.mjs`.

## Blog (`/blog`)

Posts are markdown files in `content/blog/`, one per post, with the filename as
the URL slug (`fall-carnival.md` → `/blog/fall-carnival`). Frontmatter is
`title`, `date` (YYYY-MM-DD), `author`, `blurb`, and optionally `hero_image`
(relative to `assets/blog/`) and `draft: true`. Files starting with `_` are
skipped, which is how `content/blog/_template.md` stays out of the build.

```bash
node scripts/build-blog.mjs        # writes blog/*.html + blog/index.html
node scripts/build-blog.test.mjs   # smoke test (builds fixtures in a temp dir)
```

`date` is an explicit field rather than being read from git, because rebases
rewrite commit dates. It is formatted without going through `Date()`, which
would parse `2026-09-15` as UTC midnight and render it as September 14 in
Pacific time.

**Nothing on the site links to `/blog` yet.** Add it to the nav in
`scripts/lib/chrome.mjs` (which feeds every generated page) and to the
hand-written HTML pages when the first real post is ready. There is also a
placeholder `content/blog/example-post.md` to delete at that point.

The markdown renderer is a deliberate subset — `##`/`###` headings, paragraphs,
`-` lists, `>` quotes, `**bold**`, `*italic*`, `` `code` ``, links, and
standalone images. Anything fancier renders as plain text. It lives in
`scripts/lib/md.mjs` alongside `scripts/lib/chrome.mjs`, which holds the
`<head>`, top bar, nav, and footer shared by the blog and programs builds —
edit the nav there once and every generated page picks it up.

## Deploy

Connected to Vercel — pushing to the GitHub `main` branch auto-deploys to
production at https://williamwalkerptc.com. Use **one** path per change; don't
also run a manual CLI deploy for the same commit (it creates a redundant
deployment).

```bash
vercel --prod   # manual fallback, only if a push doesn't auto-deploy
```
