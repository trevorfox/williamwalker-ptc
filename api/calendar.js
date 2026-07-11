/* =========================================================================
   /api/calendar  —  Vercel serverless function
   Fetches the school district iCal feed (server-side, avoiding browser CORS),
   parses it, merges in the recurring PTC meetings, and returns merged JSON.
   Response is edge-cached for an hour to be polite to the school server.
   ========================================================================= */

// School calendar iCal feed (swap feedID here if a Walker-only feed is available)
const FEED_URL =
  'https://williamwalker.beaverton.k12.or.us/cf_calendar/feed.cfm?type=ical&feedID=D01CB9F2CFC24422970C40EED73565FD';

// Recurring PTC meeting definition
const PTC = { startTime: '18:00', endTime: '19:30', title: 'PTC Meeting', location: 'William Walker Elementary' };
const PTC_MONTHS = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6]; // Sept–June

const DAY = 86400000;
let _cache = { at: 0, events: null };
const CACHE_MS = 60 * 60 * 1000;

module.exports = async (req, res) => {
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
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).json({ ok: true, count: events.length, events });
  } catch (err) {
    // If the school feed is down, still return the PTC meetings so the page works.
    res.setHeader('Cache-Control', 's-maxage=300');
    res.status(200).json({ ok: false, error: 'school_feed_unavailable', events: ptcMeetings().sort(byStart) });
  }
};

/* ---------- fetch + parse the school feed ---------- */
async function fetchSchool() {
  const r = await fetch(FEED_URL, { headers: { 'User-Agent': 'WWPTC-Calendar/1.0 (+williamwalkerptc.com)' } });
  if (!r.ok) throw new Error('feed status ' + r.status);
  return parseICS(await r.text());
}

function parseICS(raw) {
  const unfolded = raw.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, ''); // unfold wrapped lines
  const lines = unfolded.split(/\r\n|\n|\r/);
  const lo = isoOffset(-2), hi = isoOffset(183); // window: ~2 days ago → ~6 months out
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

/* ---------- generate recurring PTC meetings ---------- */
function ptcMeetings() {
  const y = new Date().getUTCFullYear();
  const lo = isoOffset(-2), hi = isoOffset(183);
  const out = [];
  for (const yr of [y - 1, y, y + 1]) {
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

/* ---------- helpers ---------- */
function firstWednesday(year, month) {
  const dow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0=Sun … 6=Sat
  return 1 + ((3 - dow + 7) % 7); // Wednesday = 3
}
function pad(n) { return String(n).padStart(2, '0'); }
function isoOffset(days) { return new Date(Date.now() + days * DAY).toISOString().slice(0, 10); }
function byStart(a, b) {
  const ka = a.date + (a.startTime || '00:00');
  const kb = b.date + (b.startTime || '00:00');
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}
function unescapeICS(v) {
  return v.replace(/\\n/gi, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\').replace(/\s+/g, ' ').trim();
}
