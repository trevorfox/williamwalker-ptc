# Calendar: contextual subscribe

**Date:** 2026-08-12
**Status:** Approved, ready for implementation
**Touches:** `calendar.html`, `calendar.js`, `styles.css`. No API change.

## Problem

The calendar header carries two parallel rows of pill controls — five filter chips and
four subscribe links — that say nearly the same words twice and don't agree with each
other:

1. **Labels drift.** "PTC" vs "PTC meetings", "No School" vs "No School days",
   "District" vs "Full district feed".
2. **Only one row is labeled.** The subscribe row has a visible `Subscribe:`; the filter
   row has only an invisible `aria-label="Filter events"`, so the two don't read as
   siblings.
3. **"District" means two different things.** The chip filters to `category=district`
   (events we ingest); the subscribe link points off-site to the district's own feed
   (all their calendars). Same word, different scope.
4. **No "All" feed** is offered, though `/api/calendar?format=ics` with no `only=`
   already returns the full combined calendar.
5. **Observance is stranded.** It is a real category — classified in `cd6af11`, styled in
   `28366ac`, and `only=observance` is served by the API — but has no chip, so those
   events appear only under "All" and the feed is unreachable from the UI.

Ten controls for a page whose actual job is the event list below them.

## Approach

Replace the second row with a **single subscribe link that follows the active filter**.
Filtering to No School and clicking subscribe gets you the No School feed. The filter
chips become the only category selector on the page, and the relationship between
filtering and subscribing is taught by the UI rather than duplicated by it.

```
Filter events:
┌─────┬────────┬──────────────┬──────────┬────────────┐
│ All │ ● PTC  │ ● No School  │ ● School │ ● District │
└─────┴────────┴──────────────┴──────────┴────────────┘

  ● Subscribe to No School days        Beaverton SD calendar ↗
```

**Rejected:** strict parity between two rows (keeps ten controls, wraps badly on mobile);
a hybrid contextual link plus an "all feeds" popup (a second disclosure menu to build and
keep accessible, on a page that already has one per event row).

## Decisions

| Question | Decision |
|---|---|
| Combine the rows? | Yes — contextual subscribe follows the filter |
| Observance chip? | No. Stays visible under "All" with its quiet styling; no sixth chip |
| External district link? | Keep, visually demoted, relabeled to end the word collision |

## Markup — `calendar.html`

Inside `.cal-controls`:

- The filter group gains a **visible** `Filter events:` label. The chips' `role="group"`
  switches from `aria-label="Filter events"` to `aria-labelledby` pointing at that label,
  so there is one label, not two competing ones. The five chips are otherwise unchanged.
- The four `.cal-subscribe` anchors and the `Subscribe:` span collapse into **one**
  anchor, `id="cal-subscribe"`. Its authored default is the "All" state:
  `href="webcal://williamwalkerptc.com/api/calendar?format=ics"`, text
  `Subscribe to all events`, with a `<span class="dot">` carrying no modifier class.
  Authoring the default in HTML means the link is correct before JS runs.
- A hint element, `id="cal-sub-hint"`, sits after the link reading **"Select a filter to
  subscribe to just those events."** It is visible only in the "All" state.
- The external link stays as a sibling, class `cal-subscribe--ext`, relabeled
  **"Beaverton SD calendar ↗"**. It keeps `target="_blank" rel="noopener"`.

## Behavior — `calendar.js`

Add a label map and one sync function:

```js
var SUB_LABELS = {
  all: 'all events', ptc: 'PTC meetings', noschool: 'No School days',
  school: 'School events', district: 'District events', observance: 'Observances'
};
```

`syncSubscribe()` sets three things off the current `filter`:

- **href** — base feed URL, plus `&only=<filter>` when the filter is not `all`
- **label** — `'Subscribe to ' + SUB_LABELS[filter]`
- **dot** — `'dot'`, plus `' dot--' + filter` when not `all`, so the link picks up the
  active chip's color
- **hint** — `hidden` unless `filter === 'all'`

It is called from exactly the two places chip state is already synchronized: the chip
click handler in `bindFilters()`, and the `?show=` reflection block in the fetch
`.then()`. That keeps deep links correct on load.

`SUB_LABELS` includes `observance` deliberately. `CATEGORIES` already whitelists it for
`?show=`, so `?show=observance` remains a working deep link with a working feed even
though no chip advertises it; without the entry the link would render
`Subscribe to undefined`.

### Tracking fix

The current handler regexes `only=` off the href and falls through to `'district-site'`
when it finds none (`calendar.js:156`). With a contextual link, the "All" state has no
`only=` — so every "All" subscribe would be misreported as a district-site click.

Replace the regex with two explicit listeners:

- `#cal-subscribe` → `track('calendar_subscribe', { feed: filter })`
- `.cal-subscribe--ext` → `track('calendar_subscribe', { feed: 'district-site' })`

Reading `filter` directly is both simpler and correct in every state.

## Styling — `styles.css`

- New `.cal-controls__label` — the shared visible label style, replacing
  `.cal-subs__label`.
- `.cal-subscribe` keeps its pill but gains weight; it is now the row's single call to
  action rather than one of four.
- New `.cal-subscribe--ext` — plain secondary text link, no pill border, so it reads as
  "leave this site" rather than "another one of our feeds".
- New `.cal-subs__hint` — small, muted, `--ink-soft`.
- `.cal-filters` keeps its `flex-wrap` — five chips still wrap on narrow screens, which is
  what `28366ac` added it for. The existing 640px column stacking in `.cal-controls` also
  still applies.

## Accessibility

The subscribe link's accessible name changes when a chip is clicked. No `aria-live` — the
change is a direct result of the user's own click on an adjacent control, and announcing
it would be noise. The hint is plain adjacent text toggled with `hidden`, not wired via
`aria-describedby`, which would otherwise expose it to screen readers even in states where
it does not apply.

## Not changing

`api/calendar.js` (already serves every `only=` value including the no-param full feed),
event categorization, the per-event "Add" menus, observance styling in the list.

## Verification

Static site, no test harness — verify manually with `vercel dev`:

1. Each chip updates the list, the subscribe label, the dot color, and the href.
2. "All" shows the hint; every other filter hides it.
3. `?show=noschool` loads with that chip active and the subscribe link already matching.
4. `?show=observance` filters the list and renders "Subscribe to Observances".
5. The webcal href actually subscribes in a calendar client, and the feed contains only
   that category.
6. GA receives `calendar_subscribe` with the right `feed` value in the "All" state and in
   a filtered state.
7. Mobile at 375px: controls stack, nothing overflows.

## Outcome

Ten controls become six. Four hardcoded subscribe hrefs become one derived href. The
district chip and the district feed finally refer to the same set of events.
