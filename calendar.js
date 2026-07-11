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

  var allEvents = [];
  var filter = (function () {
    var s = new URLSearchParams(location.search).get('show');
    return (s === 'ptc' || s === 'school') ? s : 'all';
  })();

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

  /* ----- "add to calendar" link builders ----- */
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
    return u;
  }
  function icsEsc(v) { return String(v).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,'); }
  function icsHref(e) {
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//WWPTC//Calendar//EN', 'BEGIN:VEVENT', 'UID:' + e.date + (e.startTime || '') + '@williamwalkerptc.com'];
    if (e.allDay) { L.push('DTSTART;VALUE=DATE:' + ymd(e.date), 'DTEND;VALUE=DATE:' + ymd(addDaysStr(e.date, 1))); }
    else { var end = e.endTime || addHourStr(e.startTime); L.push('DTSTART:' + ymd(e.date) + 'T' + e.startTime.replace(':', '') + '00', 'DTEND:' + ymd(e.date) + 'T' + end.replace(':', '') + '00'); }
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
      if (filter !== 'all' && e.source !== filter) return false;
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
        '<article class="cal-event cal-event--' + e.source + '">' +
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
            '<span class="cal-tag cal-tag--' + e.source + '">' + (e.source === 'ptc' ? 'PTC' : 'School') + '</span>' +
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
        render();
      });
    });
  }

  // subscribe-link clicks (static in the HTML)
  document.querySelectorAll('.cal-subscribe').forEach(function (a) {
    a.addEventListener('click', function () {
      track('calendar_subscribe', { feed: a.href.indexOf('only=ptc') !== -1 ? 'ptc' : 'school' });
    });
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
      // reflect ?show= filter on the chips
      document.querySelectorAll('.cal-chip').forEach(function (c) {
        var on = c.getAttribute('data-filter') === filter;
        c.classList.toggle('is-active', on);
        c.setAttribute('aria-pressed', String(on));
      });
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
