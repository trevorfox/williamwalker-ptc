# Programs & Events pages — design

2026-07-23. Approved by Trevor (verbal, in-session).

## Goal

Landing pages for each program/enrichment/event the PTC supports. Half recognition
("here's what the PTC does, and it's cool"), half fundraising landing page with
contextual donate CTAs and concrete impact amounts ("$5 pays for one student's
field trip"). Image-heavy, consistent with the existing site design.

## Decisions (made with Trevor)

- **Scope:** `/programs` index page listing everything + detail pages for 3 launch
  items (Walkerthon, Field Trips, Art Literacy). More pages over time.
- **Images:** real PTC photos added later; template ships with graceful brand
  placeholders. No stock photos.
- **Donations:** impact amounts are honest framing only; every donate button goes
  to the existing site-wide Zeffy campaign. No new payment setup, no restricted
  funds. Fineprint states amounts are examples and gifts support all PTC programs.
- **Mechanism:** markdown-based template with a tiny build script (Trevor's call,
  agreed). No change to Vercel config; generated HTML is committed.

## Architecture

```
content/programs/*.md          ← authored content (frontmatter + story)
scripts/build-programs.mjs     ← dependency-free Node script
programs/<slug>.html           ← generated, committed (cleanUrls → /programs/<slug>)
programs/index.html            ← generated index (→ /programs)
assets/programs/<slug>/*.jpg   ← photos, added over time
```

Workflow: edit `.md` → `node scripts/build-programs.mjs` → commit content +
output → push. Deployed site stays plain static HTML (SEO, Google Translate, and
the current deploy flow unchanged). The script fails loudly on bad or missing
frontmatter instead of emitting broken pages.

## Frontmatter schema

```yaml
---
title: Walkerthon
type: event            # "program" | "event" — hero eyebrow & index grouping
blurb: Our signature fall fundraiser…   # index card + meta description
hero_image: walkerthon/hero.jpg         # relative to assets/programs/; optional
cta: Fuel the Walkerthon                # contextual donate button label
donate_url:                             # optional override; defaults to site Zeffy link
impact:
  - amount: 5
    buys: one student's entry in the fun run
  - amount: 25
    buys: prizes for a whole classroom
gallery:                                # optional
  - image: walkerthon/laps.jpg
    caption: Counting laps in the rain
order: 10                               # sort within its index group
stub: true                              # optional: index-card-only, no page generated
---
Story in markdown. ## headings, **bold**, links, lists, images allowed.
```

## Detail page anatomy (top → bottom)

1. **Shared chrome** — identical topbar (language + accessibility menus, header,
   nav) and footer as the rest of the site, emitted by the template.
2. **Hero, image variant** — homepage hero structure/classes plus `hero--image`
   modifier: activity photo background, deep-blue gradient overlay, white text.
   Eyebrow by type ("Programs & Enrichment" / "PTC Event"), title, one-line lede,
   two contextual CTAs: green `<cta> ↗` → Zeffy, light-outline `See your impact ↓`
   → jumps to impact section. High-contrast mode gets a solid background.
3. **Story (white block)** — kicker + rendered markdown body.
4. **Photo gallery** — responsive grid of captioned photos. Omitted entirely if
   no images exist yet.
5. **Impact & donate (green block)** — tiles (`$5` → "one student's entry…"),
   big contextual donate button → Zeffy, fineprint: "Amounts are examples of what
   gifts like yours cover — donations support all PTC programs."
6. **More programs (white block)** — 3 sibling cards + link to `/programs`.

## Index page (`/programs`)

Standard (non-image) hero, then two card-grid sections: **Programs & enrichment**
and **Events**, built from every `.md`. Cards: image or placeholder, title, blurb.
`stub: true` entries render as non-linked cards so the index shows everything the
PTC supports from day one (parity with the homepage pill list).

## Image placeholders

Build script checks referenced image files exist. Missing hero → blue→green brand
gradient hero, same layout. Missing card image → brand-colored tile with the
program's initial. Adding photos later = drop files in `assets/programs/` and
rebuild; no content edits.

## Site integration

- Add **Programs** to nav + footer on `index.html`, `calendar.html`, `supplies.html`.
- Homepage "What We Do" pills/cards become links for items with pages (hand edit,
  incremental).
- GA4: pages include `script.js`; its delegated `donate` handler already matches
  Zeffy hrefs, so donate tracking works for free. New event `program_donate_click`
  (param `program`) on impact-section buttons.

## Launch content

Walkerthon (flagship fundraiser), Field Trips (the "$5" story), Art Literacy
(recurring enrichment) + stubs for the rest of the homepage pill list. Story copy
drafted from homepage content and flagged for PTC review; impact amounts marked
`TODO: confirm with treasurer` until real numbers are confirmed.

## Testing

- Build-script smoke check: runs clean, output contains expected sections,
  stub/missing-image paths exercised.
- Local visual check before deploy; verify Google Translate and accessibility
  toggles on generated pages (they share `script.js`).
