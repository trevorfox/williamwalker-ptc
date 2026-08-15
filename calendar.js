/* =========================================================================
   calendar.js — fetches /api/calendar and renders a filterable agenda,
   grouped by month. Date formatting is timezone-safe (parses Y-M-D parts).
   ========================================================================= */
(function () {
  'use strict';

  function track(name, params) { try { if (window.gtag) window.gtag('event', name, params || {}); } catch (e) {} }

  var listEl = document.getElementById('cal-list');
  var statusEl = document.getElementById('cal-status');
  var bodyEl = document.querySelector('.cal-body');
  if (!listEl) return;

  var WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  var CATEGORIES = ['ptc', 'noschool', 'school', 'district', 'observance'];
  var LABELS = { ptc: 'PTC', noschool: 'No School', school: 'School', district: 'District', observance: 'Observance' };
  // observance has no chip, but ?show=observance is still a valid deep link
  var SUB_LABELS = {
    all: 'all events', ptc: 'PTC meetings', noschool: 'No School days',
    school: 'School events', district: 'District events', observance: 'Observances',
  };
  // Feed URLs are built as extensionful paths — /calendar.ics, /calendar-ptc.ics —
  // not ?format=ics. Subscribe handlers are fussy about both the .ics extension
  // and query strings; the district's feed (…/calendar_605.ics) subscribes fine
  // where our query-string URL did not. Same endpoint either way, via rewrites
  // in vercel.json. feedPath() is the single place that shape is decided.
  var FEED_HOST = 'williamwalkerptc.com';
  // /u/0/ matters: the bare /calendar/r/... form dead-ends on a generic settings
  // screen on Android, while /calendar/u/0/r/... opens the actual add-by-URL box.
  // cid is still passed for desktop, where it prefills; mobile ignores it and
  // shows an empty field, which is why we copy the URL on click too.
  var GOOGLE_SUBSCRIBE_BASE = 'https://calendar.google.com/calendar/u/0/r/settings/addbyurl?cid=';
  function feedPath(f) { return f === 'all' ? '/calendar.ics' : '/calendar-' + f + '.ics'; }
  function feedUrl(scheme, f) { return scheme + '://' + FEED_HOST + feedPath(f); }

  var allEvents = [];
  var filter = (function () {
    var s = new URLSearchParams(location.search).get('show');
    return CATEGORIES.indexOf(s) !== -1 ? s : 'all';
  })();

  // falls back to source so a stale cached payload without `category` still renders
  function catOf(e) { return e.category || e.source || 'school'; }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function pad(n) { return String(n).padStart(2, '0'); }

  function weekdayOf(dateStr) {
    var p = dateStr.split('-');
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay();
  }
  function timeLabel(t) {
    if (!t) return '';
    var p = t.split(':'), h = +p[0], m = p[1];
    var ap = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12; if (h12 === 0) h12 = 12;
    return h12 + ':' + m + ' ' + ap;
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ----- "add to calendar" link builders -----
     Times from the feed are Pacific wall-clock but carry no zone, so every
     generated event has to name one or it drifts on a device set elsewhere.
     Mirrors the VTIMEZONE the /api/calendar feed emits. */
  var TZID = 'America/Los_Angeles';
  var VTIMEZONE = [
    'BEGIN:VTIMEZONE', 'TZID:' + TZID, 'X-LIC-LOCATION:' + TZID,
    'BEGIN:DAYLIGHT', 'TZOFFSETFROM:-0800', 'TZOFFSETTO:-0700', 'TZNAME:PDT',
    'DTSTART:19700308T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU', 'END:DAYLIGHT',
    'BEGIN:STANDARD', 'TZOFFSETFROM:-0700', 'TZOFFSETTO:-0800', 'TZNAME:PST',
    'DTSTART:19701101T020000', 'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU', 'END:STANDARD',
    'END:VTIMEZONE',
  ];

  function addDaysStr(dateStr, n) {
    var p = dateStr.split('-');
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n)).toISOString().slice(0, 10);
  }
  function addHourStr(t) { var p = t.split(':'); return pad((+p[0] + 1) % 24) + ':' + p[1]; }
  function ymd(d) { return d.replace(/-/g, ''); }
  function gcalDates(e) {
    if (e.allDay) return ymd(e.date) + '/' + ymd(addDaysStr(e.date, 1));
    var end = e.endTime || addHourStr(e.startTime);
    return ymd(e.date) + 'T' + e.startTime.replace(':', '') + '00/' + ymd(e.date) + 'T' + end.replace(':', '') + '00';
  }
  function googleUrl(e) {
    var u = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(e.title) + '&dates=' + gcalDates(e);
    if (e.location) u += '&location=' + encodeURIComponent(e.location);
    // without ctz Google reads the bare timestamps in the viewer's own zone
    if (!e.allDay) u += '&ctz=' + encodeURIComponent(TZID);
    return u;
  }
  function icsEsc(v) { return String(v).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,'); }
  function icsHref(e) {
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//WWPTC//Calendar//EN'];
    // VTIMEZONE must precede the VEVENT that references it; all-day events are
    // date-only and carry no zone, so they don't need the block
    if (!e.allDay) L = L.concat(VTIMEZONE);
    L.push('BEGIN:VEVENT', 'UID:' + e.date + (e.startTime || '') + '@williamwalkerptc.com');
    if (e.allDay) { L.push('DTSTART;VALUE=DATE:' + ymd(e.date), 'DTEND;VALUE=DATE:' + ymd(addDaysStr(e.date, 1))); }
    else { var end = e.endTime || addHourStr(e.startTime); L.push('DTSTART;TZID=' + TZID + ':' + ymd(e.date) + 'T' + e.startTime.replace(':', '') + '00', 'DTEND;TZID=' + TZID + ':' + ymd(e.date) + 'T' + end.replace(':', '') + '00'); }
    L.push('SUMMARY:' + icsEsc(e.title));
    if (e.location) L.push('LOCATION:' + icsEsc(e.location));
    L.push('END:VEVENT', 'END:VCALENDAR');
    return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(L.join('\r\n'));
  }
  function slug(s) { return (String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)) || 'event'; }

  function render() {
    var today = todayISO();
    var events = allEvents.filter(function (e) {
      if (e.date < today) return false;
      if (filter !== 'all' && catOf(e) !== filter) return false;
      return true;
    });

    if (!events.length) {
      listEl.innerHTML = '';
      statusEl.textContent = 'No upcoming events to show' + (filter !== 'all' ? ' for this filter.' : '.');
      statusEl.hidden = false;
      return;
    }
    statusEl.hidden = true;

    var html = '';
    var curMonth = '';
    events.forEach(function (e) {
      var mk = e.date.slice(0, 7);
      if (mk !== curMonth) {
        curMonth = mk;
        var mp = mk.split('-');
        html += '<h2 class="cal-month">' + MONTHS[+mp[1] - 1] + ' ' + mp[0] + '</h2>';
      }
      var dp = e.date.split('-');
      var when = e.allDay ? 'All day'
        : (timeLabel(e.startTime) + (e.endTime ? ' – ' + timeLabel(e.endTime) : ''));
      html +=
        '<article class="cal-event cal-event--' + catOf(e) + '">' +
          '<div class="cal-date" aria-hidden="true">' +
            '<span class="cal-date__dow">' + WEEKDAYS[weekdayOf(e.date)] + '</span>' +
            '<span class="cal-date__num">' + (+dp[2]) + '</span>' +
          '</div>' +
          '<div class="cal-event__body">' +
            '<h3 class="cal-event__title">' + esc(e.title) + '</h3>' +
            '<p class="cal-event__meta">' +
              '<span class="cal-event__when">' + esc(when) + '</span>' +
              (e.location ? '<span class="cal-event__loc"> · ' + esc(e.location) + '</span>' : '') +
            '</p>' +
          '</div>' +
          '<div class="cal-event__actions">' +
            '<span class="cal-tag cal-tag--' + catOf(e) + '">' + esc(LABELS[catOf(e)] || 'School') + '</span>' +
            '<div class="cal-add">' +
              '<button type="button" class="cal-add__btn" aria-haspopup="true" aria-expanded="false" aria-label="Add “' + esc(e.title) + '” to your calendar"><span aria-hidden="true">＋</span> Add</button>' +
              '<div class="cal-add__menu" role="menu" hidden>' +
                '<a role="menuitem" href="' + googleUrl(e) + '" target="_blank" rel="noopener">Google Calendar</a>' +
                '<a role="menuitem" href="' + icsHref(e) + '" download="' + slug(e.title) + '.ics">Apple / Outlook</a>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</article>';
    });
    listEl.innerHTML = html;
  }

  /* ----- the subscribe control follows the active filter -----
     Three subscribe options, then an import, separated by a rule because they
     differ in kind rather than degree:
       google   — /u/0/r/settings/addbyurl. Prefills cid on desktop; on mobile
                  it opens an empty paste box, so the click copies the URL too
       webcal   — one tap wherever the OS has a handler (iOS, macOS, Outlook).
                  Uses the extensionful /calendar.ics path, matching the
                  district feed's shape, since some handlers choke on queries
       copy     — the universal primitive; every paste-based flow needs it
       download — imports the events as they are today and never updates. Kept
                  because the mobile subscribe flows are clumsy enough that an
                  easy import beats a subscription nobody finishes; the label
                  says "doesn't subscribe" so the tradeoff is visible up front */
  var subBtnEl = document.getElementById('cal-subscribe-btn');
  var subMenuEl = document.getElementById('cal-subscribe-menu');
  var subLabelEl = document.getElementById('cal-subscribe-label');
  var subDotEl = document.getElementById('cal-subscribe-dot');
  var subHintEl = document.getElementById('cal-sub-hint');
  var subCopyEl = document.getElementById('cal-subscribe-copy');
  var subGoogleEl = document.getElementById('cal-subscribe-google');
  var subIcsEl = document.getElementById('cal-subscribe-ics');
  var subDlEl = document.getElementById('cal-subscribe-dl');
  var shareEl = document.getElementById('cal-share');
  var shareLabelEl = document.getElementById('cal-share-label');

  /* ----- filter state lives in the URL -----
     replaceState, not pushState: the filter is a view preference, not a
     navigation. Pushing would mean four Backs to escape after trying four
     chips, and it's why no popstate handler is needed — nothing to pop.
     `show=all` is stripped so the canonical URL stays /calendar. */
  function syncUrl() {
    if (!history.replaceState) return;
    // preserves anything else on the query string (utm_* from a newsletter link)
    var p = new URLSearchParams(location.search);
    if (filter === 'all') p.delete('show'); else p.set('show', filter);
    var q = p.toString();
    history.replaceState(null, '', location.pathname + (q ? '?' + q : '') + location.hash);
  }

  // Built from scratch rather than read off location, so a shared link never
  // carries the sharer's campaign tags into everyone else's visit.
  function viewUrl(f) {
    return 'https://' + FEED_HOST + '/calendar' + (f === 'all' ? '' : '?show=' + f);
  }

  function syncSubscribe() {
    if (!subBtnEl) return;
    var all = filter === 'all';
    var httpsUrl = feedUrl('https', filter);
    subCopyEl.setAttribute('data-url', httpsUrl);
    subIcsEl.href = feedUrl('webcal', filter);
    // root-relative: downloads from whichever host serves the page
    subDlEl.href = feedPath(filter) + '?download=1';
    subGoogleEl.href = GOOGLE_SUBSCRIBE_BASE + encodeURIComponent(httpsUrl);
    subLabelEl.textContent = 'Subscribe to ' + SUB_LABELS[filter];
    subDotEl.className = 'dot' + (all ? '' : ' dot--' + filter);
    // one row, two occupants: the hint explains filtering, the share link is
    // only meaningful once filtered (an unfiltered view is just /calendar)
    subHintEl.hidden = !all;
    if (shareEl) shareEl.hidden = all;
  }

  function closeSubscribeMenu() {
    if (!subMenuEl || subMenuEl.hidden) return;
    subMenuEl.hidden = true;
    subBtnEl.setAttribute('aria-expanded', 'false');
  }

  // must run inside the click gesture, or the clipboard write is rejected
  function writeClipboard(url, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done, done);
      return;
    }
    // older browsers with no Clipboard API — the hidden-textarea fallback
    var ta = document.createElement('textarea');
    ta.value = url; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (err) { /* nothing left to try */ }
    document.body.removeChild(ta);
    done();
  }

  function copyFeedLink() {
    var original = subCopyEl.textContent;
    writeClipboard(subCopyEl.getAttribute('data-url'), function () {
      track('calendar_subscribe', { feed: filter, via: 'copy' });
      subCopyEl.textContent = 'Link copied!';
      setTimeout(function () { subCopyEl.textContent = original; closeSubscribeMenu(); }, 1100);
    });
  }

  function bindShare() {
    if (!shareEl || !shareLabelEl) return;
    shareEl.addEventListener('click', function () {
      // swap the label span, not the button — the button also holds the icon
      var original = shareLabelEl.textContent;
      writeClipboard(viewUrl(filter), function () {
        track('calendar_share', { filter: filter });
        shareLabelEl.textContent = 'Link copied!';
        setTimeout(function () { shareLabelEl.textContent = original; }, 1100);
      });
    });
  }

  function bindSubscribeMenu() {
    if (!subBtnEl) return;
    subBtnEl.addEventListener('click', function (e) {
      e.stopPropagation();
      var wasOpen = !subMenuEl.hidden;
      closeSubscribeMenu();
      if (!wasOpen) { subMenuEl.hidden = false; subBtnEl.setAttribute('aria-expanded', 'true'); }
    });
    subCopyEl.addEventListener('click', function (e) { e.stopPropagation(); copyFeedLink(); });
    subMenuEl.addEventListener('click', function (e) {
      var link = e.target.closest('a');
      if (!link) return;
      var via = link === subGoogleEl ? 'google' : (link === subDlEl ? 'download' : 'ics');
      // Google's add-by-url page doesn't prefill cid on mobile — it just opens the
      // paste box — so put the feed URL on the clipboard on the way out and the
      // next step is a paste rather than a hunt for the link.
      if (link === subGoogleEl) writeClipboard(feedUrl('https', filter), function () {});
      track('calendar_subscribe', { feed: filter, via: via });
      closeSubscribeMenu();
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('.cal-subscribe')) closeSubscribeMenu(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSubscribeMenu(); });
  }

  function bindFilters() {
    document.querySelectorAll('.cal-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        filter = chip.getAttribute('data-filter');
        document.querySelectorAll('.cal-chip').forEach(function (c) {
          var on = c === chip;
          c.classList.toggle('is-active', on);
          c.setAttribute('aria-pressed', String(on));
        });
        track('calendar_filter', { filter: filter });
        syncUrl();
        syncSubscribe();
        render();
      });
    });
  }

  document.querySelectorAll('.cal-subscribe--ext').forEach(function (a) {
    a.addEventListener('click', function () { track('calendar_subscribe', { feed: 'district-site' }); });
  });

  function closeAddMenus() {
    listEl.querySelectorAll('.cal-add__menu:not([hidden])').forEach(function (m) { m.hidden = true; });
    listEl.querySelectorAll('.cal-add__btn[aria-expanded="true"]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
  }
  function bindAddMenus() {
    // event delegation — rows are re-rendered on filter, but listEl persists
    listEl.addEventListener('click', function (e) {
      var btn = e.target.closest('.cal-add__btn');
      if (btn) {
        e.stopPropagation();
        var menu = btn.nextElementSibling;
        var wasOpen = !menu.hidden;
        closeAddMenus();
        if (!wasOpen) { menu.hidden = false; btn.setAttribute('aria-expanded', 'true'); }
        return;
      }
      var link = e.target.closest('.cal-add__menu a');
      if (link) {
        var row = link.closest('.cal-event');
        var titleEl = row && row.querySelector('.cal-event__title');
        track('add_to_calendar', {
          method: link.href.indexOf('calendar.google.com') !== -1 ? 'google' : 'ics',
          event_title: titleEl ? titleEl.textContent : '',
        });
        closeAddMenus();
      }
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('.cal-add')) closeAddMenus(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAddMenus(); });
  }

  fetch('/api/calendar')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      allEvents = (data && data.events) || [];
      bodyEl && bodyEl.setAttribute('aria-busy', 'false');
      bindFilters();
      bindAddMenus();
      bindSubscribeMenu();
      bindShare();
      // reflect ?show= filter on the chips
      document.querySelectorAll('.cal-chip').forEach(function (c) {
        var on = c.getAttribute('data-filter') === filter;
        c.classList.toggle('is-active', on);
        c.setAttribute('aria-pressed', String(on));
      });
      syncSubscribe();
      render();
      if (data && data.ok === false) {
        statusEl.hidden = false;
        statusEl.textContent = 'Showing PTC meetings — the school district calendar is temporarily unavailable.';
        statusEl.classList.add('cal-status--warn');
      }
    })
    .catch(function () {
      bodyEl && bodyEl.setAttribute('aria-busy', 'false');
      statusEl.textContent = 'Sorry — the calendar could not be loaded right now. Please try again later.';
      statusEl.classList.add('cal-status--warn');
    });
})();
