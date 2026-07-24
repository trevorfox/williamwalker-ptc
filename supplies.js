/* =========================================================================
   William Walker PTC — supplies page
   - Tags per-item Amazon product links; GA4 events
   - Deep links (#prek etc.) auto-open their <details> panel
   - Bulk-cart mode is OFF until the PTC has a registered Associates tag.
     Amazon's successor endpoint (amazon.com/associates/addtocart, same
     ASIN.n/Quantity.n params) VALIDATES the AssociateTag: a registered tag
     fills the cart (verified 2026-07-21 with TeacherLists' live tag), an
     unregistered one lands on an empty cart. When the PTC's tag is approved:
     set TAG to it and BULK_CART to true. Per-grade data-idealist on the
     grade's <details> remains an alternative one-click path.
   ========================================================================= */
(function () {
  'use strict';

  /* Amazon Associates tracking ID (personal Associates account, pass-through to PTC). */
  var TAG = 'wwptc-20';
  var BULK_CART = true;
  var CART_BASE = 'https://www.amazon.com/associates/addtocart';

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

  /* ---------- items with a sourced ASIN ---------- */
  function cartItems(panel) {
    return Array.prototype.slice.call(panel.querySelectorAll('li[data-asin]'))
      .filter(function (li) {
        return !li.hasAttribute('data-skip') && (li.getAttribute('data-asin') || '').length === 10;
      });
  }

  function cartUrl(items) {
    var parts = ['AssociateTag=' + encodeURIComponent(TAG)];
    items.forEach(function (li, i) {
      parts.push('ASIN.' + (i + 1) + '=' + encodeURIComponent(li.getAttribute('data-asin')));
      parts.push('Quantity.' + (i + 1) + '=' + encodeURIComponent(li.getAttribute('data-qty') || '1'));
    });
    return CART_BASE + '?' + parts.join('&');
  }

  /* ---------- wire each panel ---------- */
  panels.forEach(function (panel) {
    var btn = panel.querySelector('.cart-btn');
    var items = cartItems(panel);
    var grade = panel.getAttribute('data-grade');
    var ideaList = panel.getAttribute('data-idealist');

    /* Item names link to their product page (tagged). */
    items.forEach(function (li) {
      if (li.querySelector('a')) return;
      var a = document.createElement('a');
      a.href = 'https://www.amazon.com/dp/' + li.getAttribute('data-asin') + '?tag=' + encodeURIComponent(TAG);
      a.target = '_blank';
      a.rel = 'noopener sponsored';
      var note = li.querySelector('.item-note, .item-flag');
      while (li.firstChild && li.firstChild !== note) a.appendChild(li.firstChild);
      li.insertBefore(a, note || null);
    });

    /* GA4: track item-link clicks */
    panel.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a') : null;
      if (a && a.href.indexOf('amazon.com/dp/') !== -1) {
        var li = a.closest('li');
        track('supply_item_click', { grade: grade, asin: li ? li.getAttribute('data-asin') : '' });
      }
    });

    if (!btn) return;

    if (ideaList) {
      /* One-click mode via a curated Amazon Idea List. */
      btn.hidden = false;
      btn.addEventListener('click', function () {
        track('supply_cart', { grade: grade, items: items.length, mode: 'idealist' });
        window.open(ideaList, '_blank', 'noopener');
        showNudge(panel);
      });
      return;
    }

    if (BULK_CART && items.length) {
      btn.hidden = false;
      btn.addEventListener('click', function () {
        track('supply_cart', { grade: grade, items: items.length });
        window.open(cartUrl(items), '_blank', 'noopener');
        showNudge(panel);
      });
    }
    /* Otherwise the button stays hidden — items are individually linked. */
  });

  /* ---------- Office Depot ID copy button ---------- */
  var copyBtn = document.querySelector('.od-id-card__copy');
  if (copyBtn && navigator.clipboard) {
    copyBtn.hidden = false;
    copyBtn.addEventListener('click', function () {
      navigator.clipboard.writeText(copyBtn.getAttribute('data-copy')).then(function () {
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
