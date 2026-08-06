/* =========================================================================
   William Walker PTC — supplies page
   - Every supply item links to an Office Depot search. Queries are built at
     page load from the English item text (before Google Translate mutates
     the DOM), so translated pages still search in English. data-q on an
     <li> overrides the derived query.
   - "Print this list" flags one grade + <body> with print classes and calls
     window.print(); @media print rules in styles.css render a one-sheet
     checklist headed by the 5% Back to Schools ID (70243444).
   - No affiliate params anywhere — the school ID given at checkout is the
     entire earning mechanism.
   ========================================================================= */
(function () {
  'use strict';

  var SEARCH_BASE = 'https://www.officedepot.com/a/search/?q=';

  function track(name, params) { try { if (window.gtag) window.gtag('event', name, params || {}); } catch (e) {} }

  var panels = Array.prototype.slice.call(document.querySelectorAll('details.grade'));

  panels.forEach(function (panel) {
    panel.addEventListener('toggle', function () {
      if (panel.open) track('supply_grade_select', { grade: panel.getAttribute('data-grade') });
    });
  });

  /* ---------- deep links open the target panel ---------- */
  function openFromHash() {
    if (!location.hash) return;
    var panel = document.querySelector('details.grade' + location.hash.replace(/[^#\w-]/g, ''));
    if (panel) panel.open = true;
  }
  openFromHash();
  window.addEventListener('hashchange', openFromHash);

  /* ---------- search query from item text ---------- */
  function itemQuery(li) {
    var custom = li.getAttribute('data-q');
    if (custom) return custom;
    var note = li.querySelector('.item-note, .item-flag');
    var text = '';
    for (var n = li.firstChild; n && n !== note; n = n.nextSibling) text += n.textContent;
    return text
      .replace(/\([^)]*\)/g, ' ')
      .replace(/^\s*\d+\s+(packs?|packages?|box(es)?|bottles?|containers?|reams?|sets?|pairs?|individual)\s+(of\s+)?/i, '')
      .replace(/^\s*\d+\s+/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* ---------- wire each panel ---------- */
  panels.forEach(function (panel) {
    var grade = panel.getAttribute('data-grade');

    /* Item names link to an Office Depot search (built now = English). */
    Array.prototype.slice.call(panel.querySelectorAll('.supply-list li')).forEach(function (li) {
      if (li.querySelector('a')) return;
      var q = itemQuery(li);
      if (!q) return;
      var a = document.createElement('a');
      a.href = SEARCH_BASE + encodeURIComponent(q);
      a.target = '_blank';
      a.rel = 'noopener';
      a.setAttribute('data-q', q);
      var note = li.querySelector('.item-note, .item-flag');
      while (li.firstChild && li.firstChild !== note) a.appendChild(li.firstChild);
      li.insertBefore(a, note || null);
    });

    /* GA4: item-link clicks */
    panel.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a') : null;
      if (a && a.href.indexOf('officedepot.com/a/search') !== -1) {
        track('supply_item_click', { grade: grade, store: 'officedepot', q: a.getAttribute('data-q') || '' });
      }
    });

    var btn = panel.querySelector('.print-btn');
    if (btn) {
      btn.addEventListener('click', function () { printPanel(panel, grade); });
    }
  });

  /* ---------- print flow ---------- */
  function printPanel(panel, grade) {
    var slot = document.querySelector('.print-sheet [data-print-grade]');
    var summary = panel.querySelector('summary');
    if (slot && summary) slot.textContent = summary.textContent.replace(/\s+/g, ' ').trim();

    panel.open = true;
    panel.classList.add('print-target');
    document.body.classList.add('printing-grade');
    track('supply_print', { grade: grade });

    var done = false;
    function cleanup() {
      if (done) return;
      done = true;
      window.removeEventListener('afterprint', cleanup);
      panel.classList.remove('print-target');
      document.body.classList.remove('printing-grade');
      showNudge(panel);
    }
    window.addEventListener('afterprint', cleanup);
    window.print();
    /* iOS Safari doesn't reliably fire afterprint */
    setTimeout(cleanup, 1000);
  }

  /* ---------- Office Depot ID copy button ---------- */
  var copyBtn = document.querySelector('.od-id-card__copy');
  if (copyBtn && navigator.clipboard) {
    copyBtn.hidden = false;
    copyBtn.addEventListener('click', function () {
      navigator.clipboard.writeText(copyBtn.getAttribute('data-copy')).then(function () {
        track('od_id_copy', {});
        copyBtn.textContent = 'Copied ✓';
        setTimeout(function () { copyBtn.textContent = 'Copy ID'; }, 2000);
      });
    });
  }

  function showNudge(panel) {
    var nudge = panel.querySelector('.donate-nudge');
    if (!nudge) return;
    nudge.classList.add('is-on');
    nudge.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
})();
