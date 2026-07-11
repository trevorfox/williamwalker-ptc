/* =========================================================================
   William Walker PTC — interactivity
   - Accessibility toolbar (text size, high contrast, underline links)
   - Preferences persist in localStorage
   - Mobile nav
   - Scroll-reveal (respects prefers-reduced-motion)
   - Current year in footer
   ========================================================================= */
(function () {
  'use strict';

  var root = document.documentElement;
  var STORE = 'wwptc-a11y';

  /* ---------- load saved preferences ---------- */
  var prefs = { step: 1, hc: false, ul: false };
  try {
    var saved = JSON.parse(localStorage.getItem(STORE) || '{}');
    prefs = Object.assign(prefs, saved);
  } catch (e) { /* ignore malformed storage */ }

  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(prefs)); } catch (e) {}
  }

  function applyPrefs() {
    root.style.setProperty('--step', String(prefs.step));
    root.classList.toggle('hc', !!prefs.hc);
    root.classList.toggle('ul-links', !!prefs.ul);
    var hcBtn = document.querySelector('[data-toggle="contrast"]');
    var ulBtn = document.querySelector('[data-toggle="links"]');
    if (hcBtn) hcBtn.setAttribute('aria-pressed', String(!!prefs.hc));
    if (ulBtn) ulBtn.setAttribute('aria-pressed', String(!!prefs.ul));
  }
  applyPrefs();

  /* ---------- text size ---------- */
  var MIN = 0.9, MAX = 1.5, STEP = 0.1;
  document.querySelectorAll('[data-font]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var action = btn.getAttribute('data-font');
      if (action === 'up') prefs.step = Math.min(MAX, +(prefs.step + STEP).toFixed(2));
      else if (action === 'down') prefs.step = Math.max(MIN, +(prefs.step - STEP).toFixed(2));
      else prefs.step = 1;
      applyPrefs(); save();
    });
  });

  /* ---------- toggles: high contrast + underline links ---------- */
  document.querySelectorAll('[data-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.getAttribute('data-toggle') === 'contrast' ? 'hc' : 'ul';
      prefs[key] = !prefs[key];
      applyPrefs(); save();
    });
  });

  /* ---------- mobile nav ---------- */
  var toggle = document.querySelector('.nav-toggle');
  var list = document.getElementById('nav-list');
  if (toggle && list) {
    toggle.addEventListener('click', function () {
      var open = list.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    list.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        list.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---------- scroll reveal ---------- */
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var targets = document.querySelectorAll('.section .wrap > *, .hero__inner');
  if (!reduce && 'IntersectionObserver' in window) {
    targets.forEach(function (el, i) {
      el.classList.add('reveal');
      el.style.transitionDelay = Math.min(i % 6, 5) * 60 + 'ms';
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    targets.forEach(function (el) { io.observe(el); });
  }

  /* ---------- footer year ---------- */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
