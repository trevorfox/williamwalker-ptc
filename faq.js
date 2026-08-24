/* =========================================================================
   William Walker PTC — Family FAQ (/families/faq)
   - Deep-link support: #question-id opens that <details> and scrolls to it
   - GA4: faq_question_open (question id) on manual expand
   ========================================================================= */
(function () {
  'use strict';

  function track(name, params) { try { if (window.gtag) window.gtag('event', name, params || {}); } catch (e) {} }

  var items = Array.prototype.slice.call(document.querySelectorAll('.qa-item'));

  function openFromHash() {
    var id = decodeURIComponent(location.hash.replace('#', ''));
    if (!id) return;
    var target = document.getElementById(id);
    if (!target) return;
    if (target.tagName === 'DETAILS') target.open = true;
    /* rAF so layout settles (details expanding) before scrolling */
    requestAnimationFrame(function () {
      target.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  }

  items.forEach(function (item) {
    item.addEventListener('toggle', function () {
      if (item.open) track('faq_question_open', { question_id: item.id });
    });
  });

  window.addEventListener('hashchange', openFromHash);
  openFromHash();
})();
