/* =========================================================================
   Site-wide interactivity
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

  /* GA4 event helper — no-op if analytics is blocked/absent */
  function track(name, params) { try { if (window.gtag) window.gtag('event', name, params || {}); } catch (e) {} }

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
    function closeNav(focus) {
      list.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      if (focus) toggle.focus();
    }
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = list.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    list.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') closeNav(false);
    });
    document.addEventListener('click', function (e) {
      if (list.classList.contains('open') && !list.contains(e.target) && !toggle.contains(e.target)) closeNav(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && list.classList.contains('open')) closeNav(true);
    });
  }

  /* ---------- nav submenus (Families, About) ---------- */
  var subToggles = Array.prototype.slice.call(document.querySelectorAll('.nav-sub-toggle'));
  if (subToggles.length) {
    function subItems(btn) {
      var panel = btn.nextElementSibling;
      return panel ? Array.prototype.slice.call(panel.querySelectorAll('a')) : [];
    }
    function closeSub(btn, focus) {
      btn.setAttribute('aria-expanded', 'false');
      btn._latched = false;
      if (focus) btn.focus();
    }
    function closeAllSubs(except) {
      subToggles.forEach(function (b) {
        if (b !== except) { b.setAttribute('aria-expanded', 'false'); b._latched = false; }
      });
    }
    function openSub(btn) {
      closeAllSubs(btn);
      btn.setAttribute('aria-expanded', 'true');
    }
    function anySubOpen() {
      for (var i = 0; i < subToggles.length; i++) {
        if (subToggles[i].getAttribute('aria-expanded') === 'true') return subToggles[i];
      }
      return null;
    }

    subToggles.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var isOpen = btn.getAttribute('aria-expanded') === 'true';
        /* hover already opened it: the click pins it open rather than closing
           it out from under the pointer */
        if (isOpen && !btn._latched && btn.parentNode.matches(':hover')) {
          btn._latched = true;
          return;
        }
        if (isOpen) closeSub(btn, false);
        else { openSub(btn); btn._latched = true; }
      });

      btn.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          openSub(btn);
          var items = subItems(btn);
          if (items.length) items[0].focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          openSub(btn);
          var up = subItems(btn);
          if (up.length) up[up.length - 1].focus();
        }
      });

      var panel = btn.nextElementSibling;
      if (panel) {
        panel.addEventListener('keydown', function (e) {
          var items = subItems(btn);
          var i = items.indexOf(document.activeElement);
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (items.length) items[(i + 1) % items.length].focus();
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (items.length) items[(i - 1 + items.length) % items.length].focus();
          } else if (e.key === 'Home') {
            e.preventDefault();
            if (items.length) items[0].focus();
          } else if (e.key === 'End') {
            e.preventDefault();
            if (items.length) items[items.length - 1].focus();
          }
        });
      }

      /* tabbing or clicking away closes the menu */
      btn.parentNode.addEventListener('focusout', function (e) {
        if (!btn.parentNode.contains(e.relatedTarget)) closeSub(btn, false);
      });
    });

    /* Pointer devices open on hover. Closing is delayed so brushing past the
       menu, or cutting a corner on the way to an item, doesn't dismiss it.
       Driven here rather than in CSS so aria-expanded stays truthful. */
    var canHover = window.matchMedia('(hover: hover)').matches;
    var wide = window.matchMedia('(min-width: 861px)');
    var closeTimer = null;
    function cancelClose() { if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; } }

    if (canHover) {
      subToggles.forEach(function (btn) {
        var item = btn.parentNode;
        item.addEventListener('mouseenter', function () {
          if (!wide.matches) return;
          cancelClose();
          openSub(btn);
        });
        item.addEventListener('mouseleave', function () {
          if (!wide.matches || btn._latched) return;
          cancelClose();
          closeTimer = setTimeout(function () { closeSub(btn, false); }, 400);
        });
        /* keyboard focus inside the menu should never be yanked away by a timer */
        item.addEventListener('focusin', cancelClose);
      });
    }

    document.addEventListener('click', function (e) {
      var open = anySubOpen();
      if (open && !open.parentNode.contains(e.target)) closeAllSubs(null);
    });

    /* capture phase so Escape closes the submenu before the mobile nav handler sees it */
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var open = anySubOpen();
      if (open) {
        e.stopPropagation();
        closeSub(open, true);
      }
    }, true);
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
    track('language_change', { language: code });
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

  /* ---------- GA4: donate + sign-up intent ---------- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    var label = (a.textContent || '').trim().slice(0, 60);
    if (href.indexOf('zeffy.com') !== -1 || href.indexOf('paypal.com') !== -1) {
      track('donate', { link_text: label });
      var prog = a.getAttribute('data-program-donate');
      if (prog) track('program_donate_click', { program: prog, link_text: label });
    } else if (href === '#get-involved' || href === '/#get-involved' || href === '#signup') {
      track('signup_click', { link_text: label });
    }
  });

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

  /* ---------- copy buttons on the fundraising ID board ----------
     Scoped to .idbox__copy so it cannot double-bind with the single-button
     handler supplies.js already owns for .od-id-card__copy. */
  var idCopyBtns = document.querySelectorAll('.idbox__copy');
  if (idCopyBtns.length && navigator.clipboard) {
    Array.prototype.forEach.call(idCopyBtns, function (btn) {
      btn.hidden = false;
      btn.addEventListener('click', function () {
        navigator.clipboard.writeText(btn.getAttribute('data-copy')).then(function () {
          track('fundraising_id_copy', { id: btn.getAttribute('data-id') || '' });
          var prev = btn.textContent;
          btn.textContent = 'Copied \u2713';
          setTimeout(function () { btn.textContent = prev; }, 2000);
        });
      });
    });
  }

  /* ---------- next PTC meeting date ----------
     Pages name the meeting generically ("First Wednesday"). When the calendar
     feed has an upcoming PTC meeting, swap in its real date. Markup hooks:
       [data-next-meeting-date]   text becomes "Wednesday, November 4"
       [data-next-meeting-swap]   text becomes the attribute's value, with
                                  {date}, {short} ("Wed, Nov 4"), {day} ("November 4") and {time}
                                  ("5:45 PM") filled in
       [data-next-meeting-show]   un-hidden
     Any failure (or no meeting ahead, e.g. summer) leaves the page as written.
     The header menu carries a hook, so this runs on every page: the answer is
     kept in sessionStorage for the day to spare the feed. */
  (function nextMeeting() {
    if (!window.fetch || !window.Intl) return;
    var KEY = 'wwptc-next-meeting';
    var today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());

    function fmt(date, opts) {
      opts.timeZone = 'UTC';
      return new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', opts);
    }
    function fmtTime(t) {
      var p = String(t || '').split(':'), h = +p[0];
      if (p.length < 2 || isNaN(h)) return '';
      return ((h + 11) % 12 + 1) + ':' + p[1] + (h < 12 ? ' AM' : ' PM');
    }
    function each(sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), fn); }

    function render(m) {
      var date = fmt(m.date, { weekday: 'long', month: 'long', day: 'numeric' });
      var short = fmt(m.date, { weekday: 'short', month: 'short', day: 'numeric' });
      var day = fmt(m.date, { month: 'long', day: 'numeric' });
      var time = fmtTime(m.time);
      each('[data-next-meeting-date]', function (el) { el.textContent = date; });
      each('[data-next-meeting-swap]', function (el) {
        el.textContent = el.getAttribute('data-next-meeting-swap')
          .replace('{date}', date).replace('{short}', short).replace('{day}', day)
          .replace(time ? '{time}' : ', {time}', time);
      });
      each('[data-next-meeting-show]', function (el) { el.hidden = false; });
    }

    try {
      var hit = JSON.parse(sessionStorage.getItem(KEY) || 'null');
      if (hit && hit.on === today && hit.date >= today) { render(hit); return; }
    } catch (e) {}

    fetch('/api/calendar')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var next = null;
        (data.events || []).forEach(function (e) {
          if (e.source !== 'ptc' || e.date < today) return;
          if (!/^ptc (general |monthly )?meeting$/i.test(String(e.title || '').trim())) return;
          if (!next || e.date < next.date) next = e;
        });
        if (!next) return;
        var m = { on: today, date: next.date, time: next.startTime };
        try { sessionStorage.setItem(KEY, JSON.stringify(m)); } catch (e) {}
        render(m);
      })
      .catch(function () { /* keep the generic wording */ });
  })();

  /* ---------- footer year ---------- */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
