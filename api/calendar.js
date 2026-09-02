/* =========================================================================
   /api/calendar  —  Vercel serverless function
   Fetches the school district iCal feed and the PTC's public Google Calendar
   feed (server-side, avoiding browser CORS), parses and merges both, and returns:
     - JSON            (default)         -> consumed by the /calendar page
     - iCal / .ics     (?format=ics)     -> subscribe feed (school + PTC events)
   Edge-cached for an hour to be polite to the school server.
   ========================================================================= */

const FEED_URL =
  'https://williamwalker.beaverton.k12.or.us/cf_calendar/feed.cfm?type=ical&feedID=D01CB9F2CFC24422970C40EED73565FD';

// Every PTC event, monthly meetings included, lives in a Google Calendar owned
// by williamwalkerptc@gmail.com ("WEBSITE PUBLIC CALENDAR"). Board members with
// edit access add and move events there; nothing needs a commit or deploy. Its
// public ICS is fetched exactly like the district feed. Meetings are entered as
// individual events (ten per school year, first Wednesday, 6–7 PM) rather than
// one recurring event, because Google emits a recurring event as a single
// VEVENT + RRULE, which parseICS does not expand.
const PTC_FEED_URL =
  'https://calendar.google.com/calendar/ical/d80a9ae1fa7fe9ae54e7433f4bf6d7213afc849d84fed26fedd6e7c6a9d2a47b%40group.calendar.google.com/public/basic.ics';

/* ---------- categorization ----------
   The district marks most cultural/religious observances with a phrase in the
   DESCRIPTION field. It's applied inconsistently, so a short exact-title list
   patches the ones that slip through. Exact-title, never substring: a real
   Walker event like "Diwali Celebration Night" must NOT be treated as an
   observance. Anything unrecognized falls through to 'school' so it stays
   visible — a miscategorized event is untidy, a vanished one loses a family. */
const OBSERVANCE_MARKER = 'Cultural & Religious';
const OBSERVANCE_TITLES = [
  'christmas', 'easter', 'diwali', 'five days of diwali', 'eid al-fitr',
  'eid al-adha', 'lunar new year', 'rosh hashanah', 'yom kippur',
];
const NO_SCHOOL_RE = /no school|school closed|no students/i;
const DISTRICT_RE = /school board|board retreat|budget committee|budget 101|superintendent search|long-range facilities|public hearing/i;

const FEED_NAMES = {
  ptc: 'William Walker PTC Events',
  noschool: 'William Walker — No School Days',
  school: 'William Walker — School Events',
  district: 'William Walker — District & Board',
  observance: 'William Walker — Cultural & Religious Observances',
};

/* ---------- timezone ----------
   The district feed emits floating times — DTSTART:20250820T143000, no Z, no
   TZID, no VTIMEZONE — so "2:30 PM" means 2:30 wherever the reader happens to
   be. Correct in Beaverton, wrong on a device set to any other zone. The values
   are Pacific wall-clock, so we parse them as-is and label them on the way out.
   RRULE-based rather than fixed dates so the DST rules stay valid indefinitely. */
const TZID = 'America/Los_Angeles';
const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  'TZID:' + TZID,
  'X-LIC-LOCATION:' + TZID,
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:-0800', 'TZOFFSETTO:-0700', 'TZNAME:PDT',
  'DTSTART:19700308T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:-0700', 'TZOFFSETTO:-0800', 'TZNAME:PST',
  'DTSTART:19701101T020000', 'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
];

function isObservance(title, description) {
  if (String(description || '').indexOf(OBSERVANCE_MARKER) !== -1) return true;
  return OBSERVANCE_TITLES.indexOf(String(title || '').trim().toLowerCase()) !== -1;
}

function categorize(title, description, source) {
  if (source === 'ptc') return 'ptc';
  const t = String(title || '');
  if (NO_SCHOOL_RE.test(t)) return 'noschool';
  if (isObservance(t, description)) return 'observance';
  if (DISTRICT_RE.test(t)) return 'district';
  return 'school';
}

const DAY = 86400000;
const BACK = 2;        // days back
const FWD_PAGE = 365;  // page shows 1 year out
const FWD_FEED = 400;  // subscribe feed reaches ~13 months out

let _cache = { at: 0, events: null };
const CACHE_MS = 60 * 60 * 1000;

module.exports = async (req, res) => {
  // Two ways in: the ?format=ics query the site's own fetch uses, and a clean
  // /calendar[-category].ics path for calendar apps. The clean path exists
  // because subscribe handlers are fussy — several match on a literal .ics
  // extension and choke on query strings, which is why the district's
  // webcal://…/calendar_605.ics subscribes where our ?format=ics URL did not.
  const url = req.url || '';
  const path = url.split('?')[0];
  const isIcs = /[?&]format=ics\b/.test(url) || /\.ics$/.test(path);
  // path form wins; both are validated against FEED_NAMES below
  const asked = (/\/calendar-([a-z]+)\.ics$/.exec(path) || [])[1]
    || (/[?&]only=([a-z]+)\b/.exec(url) || [])[1];
  const only = Object.prototype.hasOwnProperty.call(FEED_NAMES, asked) ? asked : undefined;
  // ?download=1 forces a file save instead of a subscribe/inline handoff. This is
  // a one-time snapshot, not a feed — offered because Google Calendar's mobile
  // apps can't subscribe by URL at all, so importing is the only way in on a phone.
  const isDownload = /[?&]download=1\b/.test(url);
  let fallbackEvents = [];
  try {
    let events;
    if (_cache.events && Date.now() - _cache.at < CACHE_MS) {
      events = _cache.events;
    } else {
      const feeds = await Promise.allSettled([fetchFeed(FEED_URL, 'school'), fetchFeed(PTC_FEED_URL, 'ptc')]);
      // The district feed is the backbone: if it fails, the catch below serves
      // whatever PTC events came through, and the page shows its warning. The
      // Google feed failing just drops PTC events for an hour, which is not
      // worth a banner — the district feed is the one families check for closures.
      const gcal = feeds[1].status === 'fulfilled' ? feeds[1].value : [];
      if (feeds[0].status === 'rejected') { fallbackEvents = gcal; throw feeds[0].reason; }
      events = feeds[0].value.concat(gcal);
      events.sort(byStart);
      _cache = { at: Date.now(), events };
    }
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    if (isIcs) {
      var feed = only ? events.filter(function (e) { return e.category === only; }) : events;
      var name = only ? FEED_NAMES[only] : 'William Walker PTC + School';
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      if (isDownload) {
        res.setHeader('Content-Disposition', 'attachment; filename="william-walker-' + (only || 'calendar') + '.ics"');
      }
      res.status(200).send(buildICS(feed, name, !only));
    } else {
      const cut = isoOffset(FWD_PAGE);
      const page = events.filter((e) => e.date <= cut);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.status(200).json({ ok: true, count: page.length, events: page });
    }
  } catch (err) {
    // Last good merge if we have one, else whatever the Google feed gave us.
    const fallback = (_cache.events || fallbackEvents).slice().sort(byStart);
    res.setHeader('Cache-Control', 's-maxage=300');
    if (isIcs) {
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.status(200).send(buildICS(fallback, 'William Walker PTC Events', false));
    } else {
      res.status(200).json({ ok: false, error: 'school_feed_unavailable', events: fallback.filter((e) => e.date <= isoOffset(FWD_PAGE)) });
    }
  }
};

/* ---------- fetch + parse an iCal feed ---------- */
async function fetchFeed(feedUrl, source) {
  const r = await fetch(feedUrl, { headers: { 'User-Agent': 'WWPTC-Calendar/1.0 (+williamwalkerptc.com)' } });
  if (!r.ok) throw new Error(source + ' feed status ' + r.status);
  return parseICS(await r.text(), false, source);
}

function parseICS(raw, skipWindow, source) {
  source = source || 'school';
  const unfolded = raw.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const lines = unfolded.split(/\r\n|\n|\r/);
  const lo = isoOffset(-BACK), hi = isoOffset(FWD_FEED);
  const events = [];
  let cur = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT') {
      // Google keeps cancelled events in the feed with STATUS:CANCELLED, and
      // emits recurring ones as a single VEVENT + RRULE we can't expand — showing
      // only the first occurrence would mislead, so those are dropped.
      if (cur && cur.dtstart && cur.summary && cur.status !== 'CANCELLED' && !cur.rrule) {
        const ev = toEvent(cur, source);
        if (ev && (skipWindow || (ev.date >= lo && ev.date <= hi))) events.push(ev);
      }
      cur = null; continue;
    }
    if (!cur) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const left = line.slice(0, idx);
    const value = line.slice(idx + 1);
    const name = left.split(';')[0].toUpperCase();
    if (name === 'DTSTART') cur.dtstart = { params: left.toUpperCase(), value };
    else if (name === 'DTEND') cur.dtend = { params: left.toUpperCase(), value };
    else if (name === 'SUMMARY') cur.summary = unescapeICS(value);
    else if (name === 'LOCATION') cur.location = unescapeICS(value);
    else if (name === 'DESCRIPTION') cur.description = value;
    else if (name === 'UID') cur.uid = value.trim();
    else if (name === 'STATUS') cur.status = value.trim().toUpperCase();
    else if (name === 'RRULE') cur.rrule = value;
  }
  return events;
}

function parseDT(field) {
  const v = field.value.trim();
  const allDay = /VALUE=DATE(?!-TIME)/.test(field.params) || /^\d{8}$/.test(v);
  const date = `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
  if (allDay) return { date, time: null, allDay: true };
  const time = `${v.slice(9, 11)}:${v.slice(11, 13)}`;
  // The district feed emits floating Pacific wall-clock times (no Z, no TZID).
  // Google's public feed emits UTC with a trailing Z, so "20261014T000000Z" is
  // really 5:00 PM on the 13th in Beaverton; convert before the date is used.
  if (/Z$/.test(v)) return utcToPacific(date, time);
  return { date, time, allDay: false };
}

const PACIFIC_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: TZID, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
});
function utcToPacific(date, time) {
  const parts = {};
  for (const p of PACIFIC_FMT.formatToParts(new Date(`${date}T${time}:00Z`))) parts[p.type] = p.value;
  const hour = parts.hour === '24' ? '00' : parts.hour; // some ICU builds print midnight as 24
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${hour}:${parts.minute}`, allDay: false };
}

function toEvent(cur, source) {
  const s = parseDT(cur.dtstart);
  const e = cur.dtend ? parseDT(cur.dtend) : null;
  const descFlat = cur.description ? unescapeICS(cur.description) : '';
  const ev = {
    date: s.date,
    startTime: s.allDay ? null : s.time,
    endTime: e && !e.allDay ? e.time : null,
    allDay: s.allDay,
    title: cur.summary,
    location: cur.location ? cur.location.slice(0, 120) : null,
    category: categorize(cur.summary, descFlat, source),
    source,
  };
  // District descriptions are mostly boilerplate used only for categorization.
  // PTC descriptions are written by the board for families, so they ship.
  if (source === 'ptc') {
    if (cur.description) ev.description = unescapeICSText(cur.description).slice(0, 1500);
    if (cur.uid) ev.uid = cur.uid;
  }
  return ev;
}

/* ---------- build a subscribe-ready iCal feed ---------- */
function buildICS(events, name, prefixPtc) {
  const stamp = icsStamp(new Date());
  const out = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//William Walker PTC//Calendar//EN',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' + (name || 'William Walker PTC'),
    'X-WR-TIMEZONE:' + TZID,
  ].concat(VTIMEZONE);
  events.forEach((e, i) => {
    // Google events keep their own UID so an edit updates the subscriber's copy
    // instead of creating a duplicate next to the old one.
    const uid = e.uid || `${e.source}-${e.date}-${(e.startTime || 'allday').replace(':', '')}-${i}@williamwalkerptc.com`;
    out.push('BEGIN:VEVENT', 'UID:' + uid, 'DTSTAMP:' + stamp);
    if (e.allDay) {
      out.push('DTSTART;VALUE=DATE:' + e.date.replace(/-/g, ''));
      out.push('DTEND;VALUE=DATE:' + addDays(e.date, 1).replace(/-/g, ''));
    } else {
      // all-day events stay VALUE=DATE — a date has no timezone, and tagging
      // one would shift it a day for readers west of us
      const end = e.endTime || addHour(e.startTime);
      out.push('DTSTART;TZID=' + TZID + ':' + e.date.replace(/-/g, '') + 'T' + e.startTime.replace(':', '') + '00');
      out.push('DTEND;TZID=' + TZID + ':' + e.date.replace(/-/g, '') + 'T' + end.replace(':', '') + '00');
    }
    out.push('SUMMARY:' + escICS((prefixPtc && e.source === 'ptc' ? 'PTC: ' : '') + e.title));
    if (e.location) out.push('LOCATION:' + escICS(e.location));
    if (e.description) out.push('DESCRIPTION:' + escICS(e.description));
    out.push('END:VEVENT');
  });
  out.push('END:VCALENDAR');
  return out.join('\r\n');
}

/* ---------- helpers ---------- */
function addDays(dateStr, n) {
  const p = dateStr.split('-');
  const d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n));
  return d.toISOString().slice(0, 10);
}
function addHour(t) {
  const p = t.split(':'); let h = (+p[0] + 1) % 24;
  return pad(h) + ':' + p[1];
}
function pad(n) { return String(n).padStart(2, '0'); }
function isoOffset(days) { return new Date(Date.now() + days * DAY).toISOString().slice(0, 10); }
function icsStamp(d) { return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
function byStart(a, b) {
  const ka = a.date + (a.startTime || '00:00'), kb = b.date + (b.startTime || '00:00');
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}
function unescapeICS(v) {
  return v.replace(/\\n/gi, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\').replace(/\s+/g, ' ').trim();
}
// Same as unescapeICS but keeps line breaks, for descriptions shown to readers.
function unescapeICSText(v) {
  return v.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\')
    .split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
function escICS(v) {
  return String(v).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/* ---------- test hooks (see scripts/calendar-categorize.test.mjs) ---------- */
module.exports.categorize = categorize;
module.exports.isObservance = isObservance;
module.exports.parseICSForTest = function (raw, source) { return parseICS(raw, true, source); };
