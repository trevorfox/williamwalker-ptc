/* =========================================================================
   /api/calendar  —  Vercel serverless function
   Fetches the school district iCal feed (server-side, avoiding browser CORS),
   parses it, merges in the recurring PTC meetings, and returns:
     - JSON            (default)         -> consumed by the /calendar page
     - iCal / .ics     (?format=ics)     -> subscribe feed (school + PTC events)
   Edge-cached for an hour to be polite to the school server.
   ========================================================================= */

const FEED_URL =
  'https://williamwalker.beaverton.k12.or.us/cf_calendar/feed.cfm?type=ical&feedID=D01CB9F2CFC24422970C40EED73565FD';

const PTC = { startTime: '18:00', endTime: '19:30', title: 'PTC Meeting', location: 'William Walker Elementary' };
const PTC_MONTHS = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6]; // Sept–June

const DAY = 86400000;
const BACK = 2;        // days back
const FWD_PAGE = 183;  // page shows ~6 months
const FWD_FEED = 400;  // subscribe feed reaches ~13 months out

let _cache = { at: 0, events: null };
const CACHE_MS = 60 * 60 * 1000;

module.exports = async (req, res) => {
  const isIcs = /[?&]format=ics\b/.test(req.url || '');
  try {
    let events;
    if (_cache.events && Date.now() - _cache.at < CACHE_MS) {
      events = _cache.events;
    } else {
      const school = await fetchSchool();
      events = school.concat(ptcMeetings());
      events.sort(byStart);
      _cache = { at: Date.now(), events };
    }
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    if (isIcs) {
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.status(200).send(buildICS(events));
    } else {
      const cut = isoOffset(FWD_PAGE);
      const page = events.filter((e) => e.date <= cut);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.status(200).json({ ok: true, count: page.length, events: page });
    }
  } catch (err) {
    const fallback = ptcMeetings().sort(byStart);
    res.setHeader('Cache-Control', 's-maxage=300');
    if (isIcs) {
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.status(200).send(buildICS(fallback));
    } else {
      res.status(200).json({ ok: false, error: 'school_feed_unavailable', events: fallback.filter((e) => e.date <= isoOffset(FWD_PAGE)) });
    }
  }
};

/* ---------- fetch + parse the school feed ---------- */
async function fetchSchool() {
  const r = await fetch(FEED_URL, { headers: { 'User-Agent': 'WWPTC-Calendar/1.0 (+williamwalkerptc.com)' } });
  if (!r.ok) throw new Error('feed status ' + r.status);
  return parseICS(await r.text());
}

function parseICS(raw) {
  const unfolded = raw.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const lines = unfolded.split(/\r\n|\n|\r/);
  const lo = isoOffset(-BACK), hi = isoOffset(FWD_FEED);
  const events = [];
  let cur = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT') {
      if (cur && cur.dtstart && cur.summary) {
        const ev = toEvent(cur);
        if (ev && ev.date >= lo && ev.date <= hi) events.push(ev);
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
  }
  return events;
}

function parseDT(field) {
  const v = field.value.trim();
  const allDay = /VALUE=DATE(?!-TIME)/.test(field.params) || /^\d{8}$/.test(v);
  const date = `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
  if (allDay) return { date, time: null, allDay: true };
  return { date, time: `${v.slice(9, 11)}:${v.slice(11, 13)}`, allDay: false };
}

function toEvent(cur) {
  const s = parseDT(cur.dtstart);
  const e = cur.dtend ? parseDT(cur.dtend) : null;
  return {
    date: s.date,
    startTime: s.allDay ? null : s.time,
    endTime: e && !e.allDay ? e.time : null,
    allDay: s.allDay,
    title: cur.summary,
    location: cur.location ? cur.location.slice(0, 90) : null,
    source: 'school',
  };
}

/* ---------- recurring PTC meetings ---------- */
function ptcMeetings() {
  const y = new Date().getUTCFullYear();
  const lo = isoOffset(-BACK), hi = isoOffset(FWD_FEED);
  const out = [];
  for (const yr of [y - 1, y, y + 1, y + 2]) {
    for (const m of PTC_MONTHS) {
      const day = firstWednesday(yr, m);
      const date = `${yr}-${pad(m)}-${pad(day)}`;
      if (date >= lo && date <= hi) {
        out.push({ date, startTime: PTC.startTime, endTime: PTC.endTime, allDay: false, title: PTC.title, location: PTC.location, source: 'ptc' });
      }
    }
  }
  return out;
}

/* ---------- build a subscribe-ready iCal feed ---------- */
function buildICS(events) {
  const stamp = icsStamp(new Date());
  const out = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//William Walker PTC//Calendar//EN',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:William Walker PTC + School',
  ];
  events.forEach((e, i) => {
    const uid = `${e.source}-${e.date}-${(e.startTime || 'allday').replace(':', '')}-${i}@williamwalkerptc.com`;
    out.push('BEGIN:VEVENT', 'UID:' + uid, 'DTSTAMP:' + stamp);
    if (e.allDay) {
      out.push('DTSTART;VALUE=DATE:' + e.date.replace(/-/g, ''));
      out.push('DTEND;VALUE=DATE:' + addDays(e.date, 1).replace(/-/g, ''));
    } else {
      const end = e.endTime || addHour(e.startTime);
      out.push('DTSTART:' + e.date.replace(/-/g, '') + 'T' + e.startTime.replace(':', '') + '00');
      out.push('DTEND:' + e.date.replace(/-/g, '') + 'T' + end.replace(':', '') + '00');
    }
    out.push('SUMMARY:' + escICS((e.source === 'ptc' ? 'PTC: ' : '') + e.title));
    if (e.location) out.push('LOCATION:' + escICS(e.location));
    out.push('END:VEVENT');
  });
  out.push('END:VCALENDAR');
  return out.join('\r\n');
}

/* ---------- helpers ---------- */
function firstWednesday(year, month) {
  const dow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return 1 + ((3 - dow + 7) % 7);
}
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
function escICS(v) {
  return String(v).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}
