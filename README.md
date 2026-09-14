# William Walker Elementary PTC — Website

Static HTML/CSS/JS for the William Walker Parent Teacher Club. No framework, no
bundler, no dependencies. Deployed on Vercel at https://williamwalkerptc.com.

Every page is generated from a source fragment plus shared chrome, and every
value that names this school lives in one file.

```
site.config.mjs   ← the name, domain, nav, footer, calendar feeds, analytics ID
src/pages/        ← the eight main pages: frontmatter + <main> content
content/          ← markdown for /blog and /programs
scripts/lib/      ← chrome.mjs (head/nav/footer) + md.mjs (markdown, frontmatter)
styles.css        ← all styling
script.js         ← accessibility toolbar, language menu, mobile nav, scroll reveal
calendar.js       ← calendar rendering + filters      (loaded only by /calendar)
supplies.js       ← Office Depot links, print flow    (loaded only by /supplies)
faq.js            ← FAQ accordion analytics           (loaded only by /families/faq)
api/calendar.js   ← merges the district + PTC calendar feeds, serves JSON and .ics
```

**Generated, do not hand-edit:** every `*.html` in the repo root, `blog/`,
`programs/`, `families/`, plus `vercel.json` and
`api/site.config.generated.cjs`. They are committed so Vercel can serve them
without a build step, but the next build overwrites them. Edit the source and
re-run the build.

## Build and test

```bash
npm run build:site   # everything: config, pages, blog, programs
npm test             # all five test suites
npm run serve        # http://localhost:3000
```

Individual builds: `build:config`, `build:pages`, `build:blog`, `build:programs`.

> The build script is deliberately **not** called `build`. Vercel runs
> `npm run build` automatically when it finds one, which would make every deploy
> depend on a full regeneration. Committed HTML is what gets served; the build
> runs here, not there.

## Changing something

| To change | Edit |
|---|---|
| Org name, domain, email, address, social links | `site.config.mjs` |
| Nav or footer links | `site.config.mjs` (`nav`, `footer.links`) |
| Google Analytics ID | `site.config.mjs` (`analytics.ga4Id`; `null` disables the tag) |
| Pinned languages in the top bar | `site.config.mjs` (`i18n.languages`) |
| Calendar feeds, event categorization | `site.config.mjs` (`calendar`) |
| Domains and redirects | `site.config.mjs` (`deploy`), then `npm run build:config` |
| Page copy | the matching file in `src/pages/` |
| A blog post or program | the matching markdown in `content/` |
| Colors, spacing, type | `styles.css` |

Editing the nav used to mean touching `chrome.mjs` and all eight hand-written
pages and hoping you caught them all. It is now one array in one file.

The one value that necessarily lives in two places is the brand color: browsers
read `--blue` from `styles.css` and `<meta name="theme-color">` from the HTML.
`build:config` fails the build if the two disagree.

## Pages

Each file in `src/pages/` is frontmatter followed by the page's `<main>` block.
The URL is derived from the filename, so `src/pages/families/faq.html` is served
at `/families/faq` and `src/pages/index.html` at `/`.

```
---
title: Calendar — William Walker Elementary PTC
description: School and PTC events in one place.
nav: calendar
scripts:
  - src: /calendar.js
note_suffix: School events shown here come from the district's public calendar.
---
  <main id="main">
    …
  </main>
```

`nav` names a key from the nav tree; the matching link gets `aria-current` and
any submenu containing it gets `is-current`. `og_title` / `og_description`
override the social-card copy (the home page does this). `note_suffix` appends
one sentence to the footer disclaimer. A page needing extra `<head>` markup puts
it in a sibling `<name>.head.html` — `families/faq.html` does, for its FAQPage
JSON-LD.

The frontmatter parser takes flat scalars and lists of `key: value` objects
only, which is why `scripts` entries are written `- src: /calendar.js` rather
than a bare list.

## Accessibility & translation

- **Language menu** with five pinned languages plus Google Translate for the rest.
- **Text size** (A− / A / A+), **High contrast**, and **Underline links** —
  remembered per visitor in `localStorage`.
- Skip-to-content link, semantic landmarks, ARIA labels, visible focus rings,
  and `prefers-reduced-motion` support throughout.

## Calendar (`/calendar`)

`api/calendar.js` fetches the district's iCal feed and the PTC's public Google
Calendar server-side (avoiding browser CORS), merges and categorizes them, and
serves JSON to the page plus `.ics` at `/calendar.ics` and
`/calendar-<category>.ics`. Cached an hour to be polite to the school's server.

PTC events live in a Google Calendar the board can edit directly, so adding an
event needs no commit and no deploy. Enter meetings as individual events, not as
a recurring event: Google emits a recurrence as a single VEVENT + RRULE, which
the parser cannot expand.

The district feed emits floating wall-clock times with no timezone, so the
function labels them `America/Los_Angeles` on the way out and publishes a
VTIMEZONE block with DST rules. Categorization rules and feed URLs are in
`site.config.mjs`; `node scripts/calendar-categorize.test.mjs` covers them.

## Supplies (`/supplies`)

Grade lists live as plain `<li>` items in `src/pages/supplies.html` — the HTML is
the config, and Google Translate translates it in place. `supplies.js` wraps each
item in an Office Depot search link built from its English text; add `data-q="…"`
to override a query that searches poorly.

Each grade has a **Print this list** button producing a one-sheet checklist
headed by the school's 5% Back to Schools ID (**70243444**). Parents give that ID
**when they pay** — at the register in store, or on a 1-800-GO-DEPOT phone order
— and the school earns 5% back as quarterly merchandise credits. Verified
2026-08-06 with a real order: online checkout has NO school-ID field and stores
cannot credit a purchase after the fact, despite what Office Depot's FAQ PDF
claims, so the page steers people to shop in store with the printed list. There
are no affiliate links — the ID is the entire earning mechanism, so these links
are safe to share anywhere, including email.

Annual refresh: update items and quantities from the school's official PDFs
(linked per grade) and re-spot-check a few search links.

## Blog (`/blog`) and Programs (`/programs`)

Markdown in `content/blog/` and `content/programs/`, one file per entry, filename
as the URL slug. Files starting with `_` are skipped, which is how
`content/blog/_template.md` stays out of the build; blog posts also honor
`draft: true`.

Blog frontmatter is `title`, `date` (YYYY-MM-DD), `author`, `blurb`, and
optionally `hero_image` and `draft`. `date` is explicit rather than read from git
because rebases rewrite commit dates, and it is formatted without going through
`Date()`, which would parse `2026-09-15` as UTC midnight and render it as
September 14 in Pacific time.

The markdown renderer is a deliberate subset — `##`/`###` headings, paragraphs,
`-` lists, `>` quotes, `**bold**`, `*italic*`, `` `code` ``, links, and
standalone images. Anything fancier renders as plain text.

## Tests

```bash
npm test
```

| Suite | Covers |
|---|---|
| `verify-pages.test.mjs` | every generated page against a pre-refactor snapshot |
| `build-blog.test.mjs` | the blog build, in a temp dir, against fixtures |
| `build-programs.test.mjs` | the programs build, in a temp dir |
| `supplies-page.test.mjs` | the shipped supplies page and its print/GA wiring |
| `calendar-categorize.test.mjs` | event categorization and iCal parsing |

`verify-pages` is a **migration artifact**. `scripts/fixtures/baseline/` holds
the pages exactly as they shipped before the chrome was extracted, and the test
diffs current output against them, ignoring formatting and allowing a declared
list of intended changes. It is what proved the refactor changed nothing it
should not have. Once an intentional design change lands, re-snapshot the
baseline or retire the suite — do not add allowances to silence a diff you have
not explained.

## Deploy

Pushing to `main` auto-deploys to production. Use **one** path per change; don't
also run a manual CLI deploy for the same commit, which creates a redundant
deployment.

```bash
vercel --prod   # manual fallback, only if a push doesn't auto-deploy
```

## Forking this for another school

Most of this is not specific to William Walker. To reuse it you would replace
`site.config.mjs`, `assets/logo.png`, the palette in `styles.css`, and the copy
in `src/pages/` and `content/`.

Not yet extracted, and still hand-written in page copy: supply lists, the family
FAQ (whose answers are duplicated between the visible accordion and its JSON-LD),
the families link tiles, the board roster, the minutes archive, and the homepage
program and event lists. Those want their own data files before this is a
template anyone could pick up. The hardest part of setting it up elsewhere is
finding your district's iCal feed URL, which every school CMS exposes
differently.

**One duplication to know about.** `calendar.js` runs in the browser as a classic
script, so it cannot import `site.config.mjs`. It still hardcodes `FEED_HOST` and
`GOOGLE_PTC_CAL_ID` — and that calendar ID is the same value as
`calendar.googleCalendarId` in the config. Change the PTC calendar and you must
change both. Neither has an obviously right fix: `location.host` would be correct
for the subscribe feed but would make the "copy link" button share a preview URL
when used on a preview deploy, and passing the calendar ID down means either
adding it to the `/api/calendar` JSON response (and handling the subscribe menu
rendering before that resolves) or emitting a config global on every page. Worth
deciding deliberately rather than by default.
