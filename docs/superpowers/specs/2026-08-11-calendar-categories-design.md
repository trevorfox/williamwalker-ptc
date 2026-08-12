# Calendar categories + one-click category subscribe

**Date:** 2026-08-11
**Status:** approved, ready for planning

## Problem

The `/calendar` page merges the Beaverton School District iCal feed with PTC
events. Today it offers three filters — All / PTC / School — where "School" is
everything the district publishes. That bucket is a firehose.

Counting the current feed (417 events):

| Kind | Count |
|---|---|
| Cultural & religious observances | 233 |
| District governance (board, budget, committees) | ~25 |
| No-school days | 46 |
| Actual Walker-specific events | ~12 |

The dozen events a Walker parent needs are buried. There is also no way to say
"put every no-school day on my calendar" — the only bulk option is subscribing
to the whole district feed, and the per-event `＋ Add` button is one at a time.

Two asks, from the PTC:

1. Filter the calendar by meaningful event type.
2. One click to add a whole type (especially no-school days) to a personal calendar.

## Decisions

Recorded because several were non-obvious and were changed during design.

| Decision | Choice | Why |
|---|---|---|
| Bulk-add mechanism | **Subscribe (`webcal://`)**, not file download | Stays correct when the district moves a break date. A downloaded `.ics` is a frozen snapshot and re-importing duplicates events. |
| Categories | `ptc`, `noschool`, `school`, `district`, `observance` | Matches how parents actually think: "when are they off?" vs "when do I show up?" |
| Board meetings | Own category, `district` | Interests few parents; separating keeps `school` tightly Walker-specific. |
| Observances | **Kept and shown in All. No chip.** | Nothing hidden from the default view; avoids a sixth chip crowding mobile. They still need detecting — see below. |
| Where categorizing happens | Server, `api/calendar.js` | The subscribe feeds are served from there. Client-side categorizing could not produce a filtered feed, which is the entire feature. |
| Unmatched titles | Fall through to `school` | Fail-visible. A miscategorized event is untidy; a silently vanished one is a parent missing Back To School Night. |

### Why observances still need detection despite having no chip

Without the rule, all 233 observance entries fall through the catch-all into
`school` — polluting the single chip that most needs to be clean. The rule
becomes a *tagging* rule rather than a *drop* rule.

## Categorization

### Observance detection

The district marks most observances in the `DESCRIPTION` field with the phrase
`Cultural & Religious`. Verified against the full feed: **233 matches, zero
false positives** — no real school event carries it.

`parseICS` currently discards `DESCRIPTION` and must be extended to read it.

The district is inconsistent, though: nine observance titles carry no marker.
They are patched by an **exact-title** list:

```
Christmas · Easter · Diwali · Five Days of Diwali · Eid al-Fitr
Eid al-Adha · Lunar New Year · Rosh Hashanah · Yom Kippur
```

Exact-title, never substring. If Walker holds a "Diwali Celebration Night,"
substring matching would misfile a real school event; exact matching will not.
If the district ever fixes their data, the patch list harmlessly stops matching.

### Category assignment

First rule that matches wins:

| # | Rule | Category |
|---|---|---|
| 1 | `source === 'ptc'` | `ptc` |
| 2 | `/no school\|school closed\|no students/i` | `noschool` |
| 3 | observance detection above | `observance` |
| 4 | `/school board\|board retreat\|budget committee\|budget 101\|superintendent search\|long-range facilities\|public hearing/i` | `district` |
| 5 | everything else | `school` |

Rule 2 catches all 46 no-school variants, including the three worded
differently: `School Closed`, `Student Led Conferences - No Students`, and
`Fall Parent/Teacher Conferences No School Students`.

Rule 4 is deliberately narrow — governance only. "Meet the Superintendent" and
"Superintendent's Coffee Chat" are events parents can attend and correctly fall
to `school`, as do district parent-education nights.

## API changes — `api/calendar.js`

- Every event in the JSON response gains a `category` field.
- `?only=` accepts `ptc | noschool | school | district | observance`.
- Each category gets a feed name, e.g. `William Walker — No School Days`.
- Export `categorize` and `isObservance` for tests.

**Accepted breaking change:** `?only=school` currently means "the whole district
feed" and will come to mean "Walker school events only." The site's own School
subscribe link points directly at the district's URL and is unaffected; the risk
is limited to anyone who hand-built that query string. Signed off as acceptable.

## Front-end changes

**`calendar.html`**
- Chips become **All / PTC / No School / School events / District**. No
  Observances chip — observance rows appear under All, tagged.
- Subscribe row gains **No School days** and **School events** beside the
  existing PTC link, each a `webcal://` URL. The existing external district link
  stays.

**`calendar.js`**
- `render()` filters on `e.category` instead of `e.source`.
- `All` means everything, including observances.
- `?show=` deep-link accepts the new category values.
- Tag pill shows the category label; extend the existing `calendar_filter` and
  `calendar_subscribe` GA events to the new values.

**`styles.css`**
- Dot and tag colour variants for `noschool`, `district`, `observance`
  alongside the existing `ptc` and `school`.

### The "one click"

Each subscribe link is a `webcal://` URL. Clicking it opens the native subscribe
dialog in Apple Calendar and Outlook. Google Calendar has **no bulk-add URL** —
its `render?action=TEMPLATE` endpoint takes one event only — so Google users add
the feed via *Other calendars → From URL*. This is a platform limit, not a
design choice, and is why subscribe beat download.

## Testing

`scripts/calendar-categorize.test.mjs`, run as
`node scripts/calendar-categorize.test.mjs`, matching the existing plain-node
pattern (there is no `package.json` or test runner in this repo).

Assertions run against a **checked-in trimmed `.ics` fixture**, never the live
district feed, so the suite cannot fail because their server is slow.

- all 46 no-school title variants → `noschool`
- all 9 unmarked observance stragglers → `observance`
- an event carrying the `Cultural & Religious` marker → `observance`
- `Field Day!`, `Literacy Night`, `Cafecito w/ Principal` → `school`
- `Budget 101`, `School Board Work Session` → `district`
- an invented unknown title → `school`, asserting the fail-visible guarantee
- a hypothetical `Diwali Celebration Night` → `school`, asserting exact-title matching
- fixture in → expected category counts out

## Out of scope

- Collapsing multi-day observance runs (Ramadan is 30 rows) into single ranges.
- Any change to `/api/calendar` caching, the PTC meeting generator, or the
  Walkerthon TBD entries.
- Per-category colour design beyond reusing the existing dot/tag pattern.
