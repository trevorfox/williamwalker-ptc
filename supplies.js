/* =========================================================================
   William Walker PTC — supplies page
   - Grade tiles open their <details> panel
   - Builds the Amazon bulk "add to cart" URL from li[data-asin][data-qty]
   - Tags per-item Amazon links; GA4 events; post-cart donate nudge
   ========================================================================= */
(function () {
  'use strict';

  /* Amazon Associates tag — replace when the PTC account is approved. */
  var TAG = 'PTCTAG-20';
  var CART_BASE = 'https://www.amazon.com/gp/aws/cart/add.html';

  function track(name, params) { try { if (window.gtag) window.gtag('event', name, params || {}); } catch (e) {} }

  var panels = Array.prototype.slice.call(document.querySelectorAll('details.grade'));

  /* ---------- grade tiles open the target panel ---------- */
  Array.prototype.slice.call(document.querySelectorAll('.grade-tile')).forEach(function (tile) {
    tile.addEventListener('click', function () {
      var panel = document.querySelector(tile.getAttribute('href'));
      if (panel) panel.open = true; /* anchor jump proceeds natively */
    });
  });
  panels.forEach(function (panel) {
    panel.addEventListener('toggle', function () {
      if (panel.open) track('supply_grade_select', { grade: panel.getAttribute('data-grade') });
    });
  });

  /* ---------- cart items for a panel ---------- */
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
    if (!btn) return;
    var items = cartItems(panel);
    var ideaList = panel.getAttribute('data-idealist');

    /* Item names link to their product page (tagged) — item-level fallback. */
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

    /* Flag list items that aren't in the cart yet (no ASIN sourced). */
    var missing = 0;
    Array.prototype.slice.call(panel.querySelectorAll('li[data-asin]')).forEach(function (li) {
      if (!li.hasAttribute('data-skip') && (li.getAttribute('data-asin') || '').length !== 10) {
        missing++;
        li.classList.add('no-asin');
        if (!li.querySelector('.item-flag')) {
          var flag = document.createElement('span');
          flag.className = 'item-flag';
          flag.textContent = 'buy separately';
          li.appendChild(flag);
        }
      }
    });

    if (ideaList) {
      /* Fallback mode: Amazon cart-add endpoint retired — link the Idea List. */
      btn.hidden = false;
      btn.addEventListener('click', function () {
        track('supply_cart', { grade: panel.getAttribute('data-grade'), items: items.length, mode: 'idealist' });
        window.open(ideaList, '_blank', 'noopener');
        showNudge(panel);
      });
      return;
    }

    if (!items.length) return; /* nothing sourced yet — button stays hidden */
    if (missing) {
      var n = document.createElement('span');
      n.className = 'item-note';
      n.textContent = 'Items marked "buy separately" aren’t included in the cart.';
      btn.insertAdjacentElement('afterend', n);
    }
    btn.hidden = false;
    btn.addEventListener('click', function () {
      track('supply_cart', { grade: panel.getAttribute('data-grade'), items: items.length });
      window.open(cartUrl(items), '_blank', 'noopener');
      showNudge(panel);
    });
  });

  function showNudge(panel) {
    var nudge = panel.querySelector('.donate-nudge');
    if (!nudge) return;
    nudge.classList.add('is-on');
    nudge.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
})();
