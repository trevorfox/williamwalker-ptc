/* =========================================================================
   Shared site chrome for the static page generators (programs, blog).

   head()     <!doctype> through </head> — GA tag, meta, canonical, OG.
   topbar()   <body> through the end of the site header + primary nav.
              Pass the current section slug to get aria-current on its link.
   FOOTER     the site footer, Google Translate init, and /script.js.

   Edit the nav or footer HERE and every generated page picks it up.
   ========================================================================= */
import { esc } from './md.mjs';

export function head(o) {
  return '<!doctype html>\n<html lang="en">\n<head>\n'
    + '  <meta charset="utf-8" />\n'
    + '  <meta name="viewport" content="width=device-width, initial-scale=1" />\n\n'
    + '  <!-- Google tag (gtag.js) -->\n'
    + '  <script async src="https://www.googletagmanager.com/gtag/js?id=G-HV902LVJ1B"></script>\n'
    + '  <script>\n    window.dataLayer = window.dataLayer || [];\n    function gtag(){dataLayer.push(arguments);}\n    gtag(\'js\', new Date());\n    gtag(\'config\', \'G-HV902LVJ1B\');\n  </script>\n\n'
    + '  <title>' + esc(o.title) + '</title>\n'
    + '  <meta name="description" content="' + esc(o.description) + '" />\n'
    + '  <link rel="canonical" href="' + o.canonical + '" />\n'
    + '  <meta property="og:title" content="' + esc(o.title) + '" />\n'
    + '  <meta property="og:description" content="' + esc(o.description) + '" />\n'
    + '  <meta property="og:image" content="' + o.ogImage + '" />\n'
    + '  <meta property="og:url" content="' + o.canonical + '" />\n'
    + '  <meta property="og:type" content="website" />\n'
    + '  <meta name="theme-color" content="#2F67B2" />\n'
    + '  <link rel="icon" href="/assets/logo.png" />\n\n'
    + '  <link rel="preconnect" href="https://fonts.googleapis.com" />\n'
    + '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n'
    + '  <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />\n'
    + '  <link rel="stylesheet" href="/styles.css" />\n'
    + '</head>\n';
}

export function topbar(current) {
  const cur = (k) => (current === k ? " aria-current=\"page\"" : '');
  return `<body>
  <a class="skip-link" href="#main">Skip to main content</a>

  <div class="topbar">
    <div class="utility">
      <div class="utility__inner">
        <div class="menu" data-menu>
          <button type="button" class="menu__btn" id="lang-btn" aria-haspopup="true" aria-expanded="false" aria-controls="lang-menu">
            <span class="i-translate" aria-hidden="true">文A</span>
            <span class="menu__btn-label">Language</span>
            <span class="menu__caret" aria-hidden="true"></span>
          </button>
          <div class="menu__panel" id="lang-menu" role="menu" aria-labelledby="lang-btn" hidden>
            <p class="menu__title" aria-hidden="true">Translate this page</p>
            <button type="button" role="menuitemradio" aria-checked="true"  class="menu__item" data-lang="en">English</button>
            <button type="button" role="menuitemradio" aria-checked="false" class="menu__item" data-lang="es">Español</button>
            <button type="button" role="menuitemradio" aria-checked="false" class="menu__item" data-lang="zh-CN">中文</button>
            <button type="button" role="menuitemradio" aria-checked="false" class="menu__item" data-lang="vi">Tiếng Việt</button>
            <button type="button" role="menuitemradio" aria-checked="false" class="menu__item" data-lang="ar" dir="rtl">العربية</button>
            <div class="menu__more">
              <label class="menu__morelabel">More languages</label>
              <div id="google_translate_element"></div>
            </div>
          </div>
        </div>

        <div class="menu" data-menu>
          <button type="button" class="menu__btn" id="a11y-btn" aria-haspopup="true" aria-expanded="false" aria-controls="a11y-menu">
            <span class="i-access" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="12" cy="3.6" r="2.1"/><path d="M20 8.2c0 .6-.5 1-1 1h-3.9V21c0 .6-.5 1-1.1 1s-1-.4-1-1v-6h-2v6c0 .6-.5 1-1.1 1s-1-.4-1-1V9.2H5c-.6 0-1-.4-1-1s.4-1 1-1h14c.6 0 1 .4 1 1z"/></svg>
            </span>
            <span class="menu__btn-label">Accessibility</span>
            <span class="menu__caret" aria-hidden="true"></span>
          </button>
          <div class="menu__panel menu__panel--a11y" id="a11y-menu" role="group" aria-labelledby="a11y-btn" hidden>
            <div class="a11y-row" role="group" aria-label="Text size">
              <span class="a11y-row__label">Text size</span>
              <span class="a11y-sizes">
                <button type="button" class="a11y-size" data-font="down" aria-label="Decrease text size">A<span class="a11y-minus">−</span></button>
                <button type="button" class="a11y-size" data-font="reset" aria-label="Reset text size">A</button>
                <button type="button" class="a11y-size a11y-size--big" data-font="up" aria-label="Increase text size">A<span class="a11y-plus">+</span></button>
              </span>
            </div>
            <button type="button" class="a11y-opt" data-toggle="contrast" aria-pressed="false"><span>High contrast</span><span class="a11y-switch" aria-hidden="true"></span></button>
            <button type="button" class="a11y-opt" data-toggle="links" aria-pressed="false"><span>Underline links</span><span class="a11y-switch" aria-hidden="true"></span></button>
          </div>
        </div>
      </div>
    </div>

    <header class="site-header">
      <a class="brand" href="/" aria-label="William Walker PTC home">
        <img class="brand__logo" src="/assets/logo.png" width="226" height="223" alt="William Walker Elementary — Home of the Wildcats" />
        <span class="brand__text">PTC</span>
      </a>
      <nav class="main-nav" aria-label="Primary">
        <button class="nav-toggle" aria-expanded="false" aria-controls="nav-list" aria-label="Toggle menu"><span></span><span></span><span></span></button>
        <ul id="nav-list" class="nav-list">
          <li class="nav-item has-sub">
            <button class="nav-sub-toggle" aria-expanded="false" aria-controls="sub-families">
              Families <span class="caret" aria-hidden="true"></span>
            </button>
            <ul id="sub-families" class="nav-sub">
              <li><a href="/families">All family links</a></li>
              <li><a href="/families/faq">Family FAQ</a></li>
              <li><a href="/supplies">School supplies</a></li>
              <li><a href="/fundraising">Fundraising</a></li>
            </ul>
          </li>
          <li><a href="/teachers"${cur("teachers")}>Teachers</a></li>
          <li><a href="/programs"${cur("programs")}>Programs</a></li>
          <li><a href="/fundraising"${cur("fundraising")}>Fundraising</a></li>
          <li><a href="/calendar"${cur("calendar")}>Calendar</a></li>
          <li class="nav-item has-sub">
            <button class="nav-sub-toggle" aria-expanded="false" aria-controls="sub-about">
              About <span class="caret" aria-hidden="true"></span>
            </button>
            <ul id="sub-about" class="nav-sub">
              <li><a href="/#about">About the PTC</a></li>
              <li><a href="/minutes">Meeting minutes</a></li>
              <li><a href="https://docs.google.com/document/d/e/2PACX-1vQ-pL1jFdwij8OOCOEfG4BH_KVyPQ3SDUVQcY4d4Eiat-AR-k8HklbKeQXCJslUfjPuXLG8_ZjuMeQH/pub" target="_blank" rel="noopener">Board &amp; contacts <span aria-hidden="true">&#8599;</span></a></li>
            </ul>
          </li>
          <li><a class="nav-cta" href="/#signup">Sign Up</a></li>
        </ul>
      </nav>
    </header>
  </div>
`;
}

export const FOOTER = `  <!-- ============ FOOTER ============ -->
  <footer class="site-footer">
    <div class="wrap footer-grid">
      <div>
        <p class="footer-brand">William Walker Elementary PTC</p>
        <address class="footer-address">
          2350 Cedar Hills Blvd.<br />
          Beaverton, OR 97005
        </address>
        <a class="footer-social" href="mailto:williamwalkerptc@gmail.com">williamwalkerptc@gmail.com</a><br />
        <a class="footer-social" href="https://www.facebook.com/williamwalkerPTC" target="_blank" rel="noopener">Follow us on Facebook <span aria-hidden="true">↗</span></a>
      </div>
      <nav class="footer-nav" aria-label="Footer">
        <a href="/#about">About</a>
        <a href="/programs">Programs</a>
        <a href="/calendar">Calendar</a>
        <a href="/supplies">Supplies</a>
        <a href="/fundraising">Fundraising</a>
        <a href="/families">Families</a>
        <a href="/families/faq">Family FAQ</a>
        <a href="/teachers">Teachers</a>
        <a href="/minutes">Meeting minutes</a>
        <a href="/#connect">Connect</a>
        <a href="https://docs.google.com/document/d/e/2PACX-1vQ-pL1jFdwij8OOCOEfG4BH_KVyPQ3SDUVQcY4d4Eiat-AR-k8HklbKeQXCJslUfjPuXLG8_ZjuMeQH/pub" target="_blank" rel="noopener">PTC Contacts <span aria-hidden="true">&#8599;</span></a>
      </nav>
      <p class="footer-note">
        A parent- and staff-run 501(c)(3) nonprofit. The William Walker PTC is an
        independent organization and is not officially administered by the Beaverton
        School District.
      </p>
    </div>
    <p class="footer-copy">© <span id="year">2026</span> William Walker Parent Teacher Club, Inc.</p>
  </footer>

  <!-- Google Translate init -->
  <script>
    function googleTranslateElementInit() {
      new google.translate.TranslateElement(
        { pageLanguage: 'en', layout: google.translate.TranslateElement.InlineLayout.SIMPLE, autoDisplay: false },
        'google_translate_element'
      );
    }
  </script>
  <script src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit" defer></script>

  <script src="/script.js" defer></script>
</body>
</html>
`;
