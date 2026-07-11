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

  /* ---------- dropdown menus (Language + Accessibility) ---------- */
  var menus = Array.prototype.slice.call(document.querySelectorAll('.menu'));
  function closeMenu(m) {
    if (!m) return;
    var b = m.querySelector('.menu__btn'), p = m.querySelector('.menu__panel');
    if (b) b.setAttribute('aria-expanded', 'false');
    if (p) p.hidden = true;
  }
  function openMenu(m) {
    menus.forEach(function (o) { if (o !== m) closeMenu(o); });
    var b = m.querySelector('.menu__btn'), p = m.querySelector('.menu__panel');
    if (b) b.setAttribute('aria-expanded', 'true');
    if (p) p.hidden = false;
  }
  menus.forEach(function (m) {
    var btn = m.querySelector('.menu__btn');
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (btn.getAttribute('aria-expanded') === 'true') closeMenu(m); else openMenu(m);
    });
  });
  document.addEventListener('click', function (e) {
    menus.forEach(function (m) { if (!m.contains(e.target)) closeMenu(m); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    menus.forEach(function (m) {
      var b = m.querySelector('.menu__btn');
      var wasOpen = b && b.getAttribute('aria-expanded') === 'true';
      closeMenu(m);
      if (wasOpen && b) b.focus();
    });
  });

  /* ---------- language switching (drives the Google Translate combo) ---------- */
  var langItems = Array.prototype.slice.call(document.querySelectorAll('.menu__item[data-lang]'));
  function currentLang() {
    var m = document.cookie.match(/(?:^|;)\s*googtrans=\/[^/]+\/([^;]+)/);
    return m ? decodeURIComponent(m[1]) : 'en';
  }
  function markLang(code) {
    langItems.forEach(function (it) {
      it.setAttribute('aria-checked', String(it.getAttribute('data-lang') === code));
    });
  }
  function cookieScopes() {
    var host = location.hostname;
    var scopes = ['']; /* path only — works on localhost */
    if (host && host.indexOf('.') !== -1) {
      scopes.push('; domain=' + host);
      scopes.push('; domain=.' + host);
    }
    return scopes;
  }
  function clearGoogtrans() {
    cookieScopes().forEach(function (d) {
      document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + d;
    });
  }
  function setGoogtrans(val) {
    cookieScopes().forEach(function (d) {
      document.cookie = 'googtrans=' + val + '; path=/' + d;
    });
  }
  /* Reliable switch: set the googtrans cookie the widget reads on load, then reload.
     (Driving the hidden <select> via a synthetic event is ignored by the widget.) */
  function setLang(code) {
    markLang(code);
    clearGoogtrans();
    if (code !== 'en') setGoogtrans('/en/' + code);
    location.reload();
  }
  langItems.forEach(function (it) {
    it.addEventListener('click', function () {
      setLang(it.getAttribute('data-lang'));
      closeMenu(it.closest('.menu'));
    });
  });
  markLang(currentLang()); /* reflect saved language on load */

  /* ---------- scroll reveal ---------- */
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var targets = document.querySelectorAll('.block .wrap > *, .hero__inner');
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

  /* ---------- label Google Translate's dropdown for screen readers ----------
     Google injects its <select.goog-te-combo> asynchronously with no
     accessible name. Watch for it and add one. */
  (function labelTranslate() {
    var tries = 0;
    var timer = setInterval(function () {
      var combo = document.querySelector('.goog-te-combo');
      if (combo) {
        combo.setAttribute('aria-label', 'Choose a language to translate this page');
        combo.setAttribute('title', 'Translate this page');
        clearInterval(timer);
      } else if (++tries > 40) {
        clearInterval(timer); /* give up after ~20s */
      }
    }, 500);
  })();

  /* ---------- footer year ---------- */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
