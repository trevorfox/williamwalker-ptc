/* =========================================================================
   calendar.js — fetches /api/calendar and renders a filterable agenda,
   grouped by month. Date formatting is timezone-safe (parses Y-M-D parts).
   ========================================================================= */
(function () {
  'use strict';

  var listEl = document.getElementById('cal-list');
  var statusEl = document.getElementById('cal-status');
  var bodyEl = document.querySelector('.cal-body');
  if (!listEl) return;

  var WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  var allEvents = [];
  var filter = 'all';

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
          '<span class="cal-tag cal-tag--' + e.source + '">' + (e.source === 'ptc' ? 'PTC' : 'School') + '</span>' +
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
        render();
      });
    });
  }

  fetch('/api/calendar')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      allEvents = (data && data.events) || [];
      bodyEl && bodyEl.setAttribute('aria-busy', 'false');
      bindFilters();
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
