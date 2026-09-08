/* =========================================================================
   Shared site chrome for the static page generators.

   head(o)     <!doctype> through </head> — GA tag, meta, canonical, OG.
   topbar(k)   <body> through the end of the site header + primary nav.
               Pass the current page's nav key to highlight its link.
   footer(o)   the site footer, Google Translate init, scripts, </html>.

   Every school-specific value comes from site.config.mjs. Edit the nav, the
   footer, or anything else there ONCE and every page picks it up — that is
   the whole point of this module, and the reason no page hand-writes its own
   header any more.
   ========================================================================= */
import { esc } from './md.mjs';
import config from '../../site.config.mjs';

const { org, site, brand, theme, analytics, i18n, nav, footer: foot, social } = config;

/* An absolute https:// URL for a site-relative path. Canonical and OG tags
   need absolute URLs; everything else on the page uses the path as given. */
export function absolute(path) {
  if (/^https?:\/\//.test(path)) return path;
  return site.origin + (path.startsWith('/') ? path : '/' + path);
}

/* External links open in a new tab and carry a ↗ so the jump is not a
   surprise — except the Donate CTA, where the button already says so. */
function linkAttrs(item) {
  return item.external ? ' target="_blank" rel="noopener"' : '';
}
function linkLabel(item) {
  const label = esc(item.label);
  return item.external && !item.cta ? label + ' <span aria-hidden="true">&#8599;</span>' : label;
}

/* ---------- <head> ---------- */

export function head(o) {
  const canonical = absolute(o.path);
  const ogImage = absolute(o.ogImage || brand.ogImage);
  const ogTitle = o.ogTitle || o.title;
  const ogDescription = o.ogDescription || o.description;

  const ga = analytics.ga4Id
    ? '  <!-- Google tag (gtag.js) -->\n'
      + '  <script async src="https://www.googletagmanager.com/gtag/js?id=' + esc(analytics.ga4Id) + '"></script>\n'
      + '  <script>\n    window.dataLayer = window.dataLayer || [];\n    function gtag(){dataLayer.push(arguments);}\n'
      + "    gtag('js', new Date());\n    gtag('config', '" + analytics.ga4Id + "');\n  </script>\n\n"
    : '';

  return '<!doctype html>\n<html lang="' + esc(site.lang) + '">\n<head>\n'
    + '  <meta charset="utf-8" />\n'
    + '  <meta name="viewport" content="width=device-width, initial-scale=1" />\n\n'
    + ga
    + '  <title>' + esc(o.title) + '</title>\n'
    + '  <meta name="description" content="' + esc(o.description) + '" />\n'
    + '  <link rel="canonical" href="' + esc(canonical) + '" />\n'
    + '  <meta property="og:title" content="' + esc(ogTitle) + '" />\n'
    + '  <meta property="og:description" content="' + esc(ogDescription) + '" />\n'
    + '  <meta property="og:image" content="' + esc(ogImage) + '" />\n'
    + '  <meta property="og:url" content="' + esc(canonical) + '" />\n'
    + '  <meta property="og:type" content="website" />\n'
    + '  <meta name="theme-color" content="' + esc(theme.themeColor) + '" />\n'
    + '  <link rel="icon" href="' + esc(brand.logo) + '" />\n\n'
    + '  <link rel="preconnect" href="https://fonts.googleapis.com" />\n'
    + '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n'
    + '  <link href="' + esc(theme.fontUrl) + '" rel="stylesheet" />\n'
    + '  <link rel="stylesheet" href="/styles.css" />\n'
    + (o.headExtra || '')
    + '</head>\n';
}

/* ---------- top bar + nav ---------- */

function languageButtons() {
  return i18n.languages.map((l, idx) =>
    '            <button type="button" role="menuitemradio" aria-checked="' + (idx === 0 ? 'true' : 'false')
    + '" class="menu__item" data-lang="' + esc(l.code) + '"'
    + (l.rtl ? ' dir="rtl"' : '') + '>' + esc(l.label) + '</button>'
  ).join('\n');
}

function navLink(item, current, extraClass) {
  const cls = extraClass ? ' class="' + extraClass + '"' : '';
  const cur = item.key && item.key === current ? ' aria-current="page"' : '';
  return '<li><a' + cls + ' href="' + esc(item.href) + '"' + linkAttrs(item) + cur + '>' + linkLabel(item) + '</a></li>';
}

function navEntry(item, current) {
  if (!item.items) {
    return '          ' + navLink(item, current, item.cta ? 'nav-cta' : '');
  }
  // A submenu whose active page is inside it marks its own toggle, so the
  // trail to the current page stays visible when the menu is closed.
  const open = item.items.some((i) => i.key && i.key === current);
  return '          <li class="nav-item has-sub">\n'
    + '            <button class="nav-sub-toggle' + (open ? ' is-current' : '') + '" aria-expanded="false" aria-controls="' + esc(item.id) + '">\n'
    + '              ' + esc(item.label) + ' <span class="caret" aria-hidden="true"></span>\n'
    + '            </button>\n'
    + '            <ul id="' + esc(item.id) + '" class="nav-sub">\n'
    + item.items.map((i) => '              ' + navLink(i, current)).join('\n') + '\n'
    + '            </ul>\n'
    + '          </li>';
}

export function topbar(current) {
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
${languageButtons()}
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
      <a class="brand" href="/" aria-label="${esc(brand.homeAriaLabel)}">
        <img class="brand__logo" src="${esc(brand.logo)}" width="${brand.logoWidth}" height="${brand.logoHeight}" alt="${esc(brand.logoAlt)}" />
        <span class="brand__text">${esc(org.abbrev)}</span>
      </a>
      <nav class="main-nav" aria-label="Primary">
        <button class="nav-toggle" aria-expanded="false" aria-controls="nav-list" aria-label="Toggle menu"><span></span><span></span><span></span></button>
        <ul id="nav-list" class="nav-list">
${nav.map((item) => navEntry(item, current)).join('\n')}
        </ul>
      </nav>
    </header>
  </div>
`;
}

/* ---------- footer ---------- */

/* Brand marks, keyed by the `platform` in site.config.mjs. Adding a network
   means adding its path here as well as a config entry. */
const SOCIAL_ICONS = {
  facebook: '<path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.23.2 2.23.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.88h2.78l-.44 2.9h-2.34V22c4.78-.79 8.45-4.93 8.45-9.94z"/>',
  instagram: '<path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41 1.27-.06 1.65-.07 4.85-.07zM12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.3-1.46.72-2.12 1.38C1.36 2.68.94 3.35.63 4.14.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.3.79.72 1.46 1.38 2.12.66.66 1.33 1.08 2.12 1.38.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56.79-.3 1.46-.72 2.12-1.38.66-.66 1.08-1.33 1.38-2.12.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91-.3-.79-.72-1.46-1.38-2.12C21.32 1.36 20.65.94 19.86.63 19.1.33 18.22.13 16.95.07 15.67.01 15.26 0 12 0z"/><path d="M12 5.84A6.16 6.16 0 1 0 18.16 12 6.16 6.16 0 0 0 12 5.84zM12 16a4 4 0 1 1 4-4 4 4 0 0 1-4 4z"/><circle cx="18.41" cy="5.59" r="1.44"/>',
  whatsapp: '<path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35z"/><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.86 9.86 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.15h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.23-8.24 8.23z"/>',
};

function socialButtons() {
  return social.map((s) => {
    const icon = SOCIAL_ICONS[s.platform];
    if (!icon) throw new Error('chrome: no icon for social platform "' + s.platform + '"');
    return '          <li><a class="social-btn" href="' + esc(s.url) + '" target="_blank" rel="noopener" aria-label="' + esc(s.label)
      + '"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">' + icon + '</svg></a></li>';
  }).join('\n');
}

/* o.scripts    extra <script src> after /script.js, in order. The calendar,
                supplies and FAQ pages each need their own behavior file, and
                it has to load after the shared one.
   o.noteSuffix one more sentence appended to the 501(c)(3) disclaimer. */
export function footer(o) {
  const opts = o || {};
  const note = opts.noteSuffix ? foot.note + ' ' + opts.noteSuffix : foot.note;
  const extra = (opts.scripts || [])
    .map((s) => '\n  <script src="' + esc(typeof s === 'string' ? s : s.src) + '" defer></script>')
    .join('');

  return `  <!-- ============ FOOTER ============ -->
  <footer class="site-footer">
    <div class="wrap footer-grid">
      <div>
        <p class="footer-brand">${esc(org.name)}</p>
        <address class="footer-address">
          ${esc(org.address.street)}<br />
          ${esc(org.address.cityStateZip)}
        </address>
        <a class="footer-social" href="mailto:${esc(org.email)}">${esc(org.email)}</a>
        <ul class="social-row" aria-label="${esc(org.nameShort)} on social media">
${socialButtons()}
        </ul>
      </div>
      <nav class="footer-nav" aria-label="Footer">
${foot.links.map((l) => '        <a href="' + esc(l.href) + '"' + linkAttrs(l) + '>' + linkLabel(l) + '</a>').join('\n')}
      </nav>
      <p class="footer-note">
        ${esc(note)}
      </p>
    </div>
    <p class="footer-copy">© <span id="year">${new Date().getFullYear()}</span> ${esc(org.legalName)}</p>
  </footer>

  <!-- Google Translate init -->
  <script>
    function googleTranslateElementInit() {
      new google.translate.TranslateElement(
        { pageLanguage: '${site.lang}', layout: google.translate.TranslateElement.InlineLayout.SIMPLE, autoDisplay: false },
        'google_translate_element'
      );
    }
  </script>
  <script src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit" defer></script>

  <script src="/script.js" defer></script>${extra}
</body>
</html>
`;
}
