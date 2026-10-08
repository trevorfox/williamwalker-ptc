# William Walker Elementary PTC — Website

Static HTML/CSS/JS for the William Walker Parent Teacher Club. No framework, no
bundler, no dependencies. Deployed on Vercel at https://williamwalkerptc.com.

Every page is generated from a source fragment plus shared chrome, and every
value that names this school lives in one file.

```
site.config.mjs   ← the name, domain, nav, footer, calendar feeds, analytics ID
src/pages/        ← the eight main pages: frontmatter + <main> content
content/          ← markdown for /blog and /programs; minutes.json for /minutes
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
npm test             # all seven test suites
npm run snapshot     # accept the current build as the new verify-pages baseline
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
| Org name, domain, email, address, social links | `site.config.mjs`. Page titles use `{{org.name}}`, mailto links use `{{org.email}}` and `{{org.volunteerEmail}}`, and `<!-- social-links -->` renders the labeled account list. |
| School website, Office Depot school ID, sign-up and grant forms | `site.config.mjs` (`school.website`, `fundraising.officeDepotId`, `links.signupForm`, `links.grantForm`) |
| Nav or footer links | `site.config.mjs` (`nav`, `footer.links`) |
| Where every Donate button goes | `site.config.mjs` (`DONATE`). Pages use `{{links.donate}}`; blog posts keep the link they were written with. |
| Google Analytics ID | `site.config.mjs` (`analytics.ga4Id`; `null` disables the tag) |
| Pinned languages in the top bar | `site.config.mjs` (`i18n.languages`) |
| Calendar feeds, event categorization | `site.config.mjs` (`calendar`) |
| Domains and redirects | `site.config.mjs` (`deploy`), then `npm run build:config` |
| Page copy | the matching file in `src/pages/` |
| A blog post or program | the matching markdown in `content/`. The home page list of programs and events comes from `content/programs/` too: a program links there once it has a page (no `stub: true`), in `order`. |
| Meeting minutes | `content/minutes.json` — one line per meeting: `{ "month": "2026-10", "url": "…" }`, plus `"draft": true` until approved. The Google Doc must be shared "Anyone with the link: Viewer". |
| PTC meeting day or time | `site.config.mjs` (`meetings`). Pages use `{{meetings.time}}`; blog posts keep the time they were written with. |
| A Family FAQ question | `src/pages/families/faq.html` only. The Google FAQ data in `faq.head.html` is generated from it. |
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
| `config-example.test.mjs` | `site.config.example.mjs` has the same keys as the real config |
| `verify-pages.test.mjs` | every generated page against a committed snapshot |
| `build-blog.test.mjs` | the blog build, in a temp dir, against fixtures |
| `build-programs.test.mjs` | the programs build, in a temp dir |
| `supplies-page.test.mjs` | the shipped supplies page and its print/GA wiring |
| `calendar-categorize.test.mjs` | event categorization and iCal parsing |

`verify-pages` began as a migration check: `scripts/fixtures/baseline/` held the
pages as they shipped before the chrome was extracted, and the test proved the
refactor changed nothing it should not have. It now guards against unintended
changes to built output. It diffs every generated page against the baseline,
ignoring formatting. When a diff is one you meant, check it, then run
`npm run snapshot` to accept the current build as the new baseline. Do not add
allowances to silence a diff you have not explained.

## Deploy

Pushing to `main` auto-deploys to production. Use **one** path per change; don't
also run a manual CLI deploy for the same commit, which creates a redundant
deployment.

```bash
vercel --prod   # manual fallback, only if a push doesn't auto-deploy
```

## Forking this for another school

Most of this is not specific to William Walker. To reuse it you would replace
`site.config.mjs` (start from `site.config.example.mjs`), `assets/logo.png`, the
palette in `styles.css`, and the copy in `src/pages/` and `content/`.
**[docs/forking.md](docs/forking.md) is the step-by-step guide.**

Facts that repeat across pages (the org name in titles, both email addresses,
the school website, the Office Depot ID, the social accounts) are config tokens.
Prose that mentions the school by name is left as prose: a fork rewrites that
copy anyway, and tokens in every sentence would make the pages hard to read.

Not yet extracted, and still hand-written in page copy: supply lists, the
family FAQ answers, the families link tiles, and
the board roster. Those want their own data files before this is a template
anyone could pick up. The hardest part of setting it up elsewhere is finding
your district's iCal feed URL, which every school CMS exposes differently.

**How `calendar.js` gets its config.** It runs in the browser as a classic
script, so it cannot import `site.config.mjs`. Instead `src/pages/calendar.html`
writes `deploy.canonicalHost` and `calendar.googleCalendarId` onto `#cal-list`
as `data-site-host` and `data-org-calendar-id`, and the script reads them from
there. It uses the canonical host rather than `location.host` so a link copied
on a preview deploy still points at the real site. The timezone and DST rules for the per-event `.ics` download come
down with the `/api/calendar` JSON response (`timezone`, `vtimezone`), so the
script keeps no copy of those either.

## License

The code is MIT licensed: the build scripts, the calendar function, the
stylesheet and the browser scripts. The William Walker PTC's own content is not:
the page copy, blog posts and program write-ups, and everything in `assets/`
(logo, photos, flyers, sponsor logos) remain all rights reserved. See
[LICENSE](LICENSE).
