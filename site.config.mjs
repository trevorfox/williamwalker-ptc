/* =========================================================================
   site.config.mjs — every value that identifies THIS school and THIS
   deployment, in one place.

   Forking this site for another parent group? This file plus assets/logo.png
   plus the words in src/pages/ is the whole job. Nothing below is referenced
   by name anywhere else; the build reads this object and nothing else.

   Consumers:
     scripts/lib/chrome.mjs      head / topbar / footer on every page
     scripts/build-pages.mjs     the eight hand-written pages
     scripts/build-blog.mjs      /blog
     scripts/build-programs.mjs  /programs
     scripts/build-config.mjs    writes api/site.config.generated.cjs + vercel.json
     api/calendar.js             via that generated CJS mirror

   RULE: every key here has a reader. Values that only appear in page prose
   (district links, phone numbers, bell times, the board roster, supply lists)
   are deliberately NOT here — page copy is hand-written HTML in src/pages/,
   and a config key nothing reads is a key that silently goes stale. Those get
   extracted into content data files in a later pass; see README.
   ========================================================================= */

/* URLs that appear in more than one place below. Being a JS module rather than
   JSON is what lets these be named once and referenced — which is most of the
   reason this file is .mjs. */
const DONATE = 'https://www.zeffy.com/en-US/peer-to-peer/walkerthon--2026';
// Published (File > Share > Publish to web) so it needs no Google login.
const BOARD_CONTACTS = 'https://docs.google.com/document/d/e/2PACX-1vQ-pL1jFdwij8OOCOEfG4BH_KVyPQ3SDUVQcY4d4Eiat-AR-k8HklbKeQXCJslUfjPuXLG8_ZjuMeQH/pub';

export default {
  /* ---------- who this is ---------- */
  org: {
    // Full name. Titles, the footer brand line, OG copy.
    name: 'William Walker Elementary PTC',
    // Conversational form, used in aria-labels ("… on Facebook").
    nameShort: 'William Walker PTC',
    // The lockup next to the logo, and the org-type abbreviation in labels.
    abbrev: 'PTC',
    // Legal entity, footer copyright only.
    legalName: 'William Walker Parent Teacher Club, Inc.',
    email: 'williamwalkerptc@gmail.com',
    address: {
      street: '2350 Cedar Hills Blvd.',
      cityStateZip: 'Beaverton, OR 97005',
    },
  },

  /* ---------- where it lives ---------- */
  site: {
    // No trailing slash. Canonical URLs, OG urls, the OG image, the .ics
    // subscribe links and the ICS UID suffix are all derived from this.
    origin: 'https://williamwalkerptc.com',
    // <html lang> and the Google Translate source language.
    lang: 'en',
  },

  /* ---------- logo / masthead ---------- */
  brand: {
    logo: '/assets/logo.png',
    // Intrinsic size — these are width/height attributes, not CSS. Keeping
    // them right is what stops the header jumping while the logo loads.
    logoWidth: 226,
    logoHeight: 223,
    logoAlt: 'William Walker Elementary — Home of the Wildcats',
    homeAriaLabel: 'William Walker PTC home',
    // Also the OG image for any page that does not set its own.
    ogImage: '/assets/logo.png',
  },

  /* ---------- look ---------- */
  theme: {
    // The browser-UI tint on mobile. Must match --blue in styles.css;
    // scripts/build-config.mjs fails the build if the two drift apart.
    // The rest of the palette lives in the :root block of styles.css.
    themeColor: '#2F67B2',
    fontUrl: 'https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800;900&display=swap',
  },

  /* ---------- analytics ---------- */
  analytics: {
    // GA4 measurement ID. Set to null to omit the tag entirely — which is
    // what a fork should do until it has its own property.
    ga4Id: 'G-HV902LVJ1B',
  },

  /* ---------- translation ---------- */
  i18n: {
    // Pinned one-tap languages in the top bar, chosen for the school's
    // families. Everything else is reachable through the Google Translate
    // widget below them, so this list is a shortcut, not a limit.
    languages: [
      { code: 'en', label: 'English' },
      { code: 'es', label: 'Español' },
      { code: 'zh-CN', label: '中文' },
      { code: 'vi', label: 'Tiếng Việt' },
      { code: 'ar', label: 'العربية', rtl: true },
    ],
  },

  /* ---------- off-site destinations ---------- */
  links: {
    // Zeffy peer-to-peer page. Also the default for a program's donate button.
    donate: DONATE,
    // Appears in the About menu and again in the footer.
    boardContacts: BOARD_CONTACTS,
  },

  // platform must be one of the icons chrome.mjs knows: facebook, instagram,
  // whatsapp. Drop an entry to drop the button.
  social: [
    { platform: 'facebook', url: 'https://www.facebook.com/williamwalkerPTC', label: 'William Walker PTC on Facebook' },
    { platform: 'instagram', url: 'https://www.instagram.com/williamwalkerptc/', label: 'William Walker PTC on Instagram' },
    { platform: 'whatsapp', url: 'https://chat.whatsapp.com/CTh14MIljaWKwbKk9HtUbK?mode=gi_t', label: 'Join the William Walker PTC WhatsApp group' },
  ],

  /* ---------- primary navigation ----------
     A page names one `key` in its frontmatter; every leaf with that key gets
     aria-current="page", and a submenu containing a match gets is-current on
     its toggle. Keys need not be unique — /fundraising appears both at top
     level and under Families, and both are marked, which is the behavior the
     hand-written pages had.
     `id` on a submenu is the aria-controls target and must be unique. */
  nav: [
    {
      label: 'Families',
      id: 'sub-families',
      items: [
        { key: 'families', label: 'All family links', href: '/families' },
        { key: 'faq', label: 'Family FAQ', href: '/families/faq' },
        { key: 'supplies', label: 'School supplies', href: '/supplies' },
        { key: 'fundraising', label: 'Fundraising', href: '/fundraising' },
      ],
    },
    { key: 'teachers', label: 'Teachers', href: '/teachers' },
    { key: 'programs', label: 'Programs', href: '/programs' },
    { key: 'fundraising', label: 'Fundraising', href: '/fundraising' },
    { key: 'calendar', label: 'Calendar', href: '/calendar' },
    {
      label: 'About',
      id: 'sub-about',
      items: [
        { key: 'about', label: 'About the PTC', href: '/#about' },
        { key: 'blog', label: 'PTC news', href: '/blog' },
        { key: 'minutes', label: 'Meeting minutes', href: '/minutes' },
        { key: 'contacts', label: 'Board & contacts', href: BOARD_CONTACTS, external: true },
      ],
    },
    { label: 'Donate', href: DONATE, cta: true, external: true },
  ],

  /* ---------- footer ---------- */
  footer: {
    links: [
      { label: 'About', href: '/#about' },
      { label: 'Programs', href: '/programs' },
      { label: 'Calendar', href: '/calendar' },
      { label: 'Supplies', href: '/supplies' },
      { label: 'Fundraising', href: '/fundraising' },
      { label: 'Families', href: '/families' },
      { label: 'Family FAQ', href: '/families/faq' },
      { label: 'Teachers', href: '/teachers' },
      { label: 'PTC news', href: '/blog' },
      { label: 'Meeting minutes', href: '/minutes' },
      { label: 'Connect', href: '/#connect' },
      { label: 'PTC Contacts', href: BOARD_CONTACTS, external: true },
    ],
    // A page may append one more sentence to this via `note_suffix`.
    note: 'A parent- and staff-run 501(c)(3) nonprofit. The William Walker PTC is an '
      + 'independent organization and is not officially administered by the Beaverton '
      + 'School District.',
  },

  /* ---------- calendar feeds ----------
     Read by api/calendar.js, which merges the district feed with the PTC's own
     Google Calendar and republishes both as JSON and as .ics.

     FINDING YOUR DISTRICT FEED is the hardest part of setting this site up.
     It is whatever URL your school's calendar page offers behind an "iCal",
     "Subscribe", or RSS icon. Beaverton runs a ColdFusion CMS, hence the
     feed.cfm URL; Finalsite, Edlio, and Apptegy districts all differ, and a
     few publish no feed at all. Set districtFeedUrl to null to run PTC-only. */
  calendar: {
    districtFeedUrl: 'https://williamwalker.beaverton.k12.or.us/cf_calendar/feed.cfm?type=ical&feedID=D01CB9F2CFC24422970C40EED73565FD',

    // The PTC's own public Google Calendar. Board members with edit access add
    // events here and they appear on the site with no commit and no deploy.
    // Calendar settings > "Integrate calendar" > Calendar ID.
    // Enter meetings as individual events, NOT as a recurring event: Google
    // emits recurrences as one VEVENT + RRULE, which the parser cannot expand.
    googleCalendarId: 'd80a9ae1fa7fe9ae54e7433f4bf6d7213afc849d84fed26fedd6e7c6a9d2a47b@group.calendar.google.com',

    // IANA zone for the school. The district feed emits floating wall-clock
    // times with no zone at all, so this is what makes "2:30 PM" mean 2:30 in
    // Beaverton rather than 2:30 wherever the reader happens to be.
    timezone: 'America/Los_Angeles',
    // Standard/daylight rules published in the .ics so subscribers stay correct
    // across DST. These are US rules; change them if your zone differs.
    dst: {
      standardName: 'PST', standardOffset: '-0800',
      daylightName: 'PDT', daylightOffset: '-0700',
      daylightStart: { month: 3, day: '2SU' },
      standardStart: { month: 11, day: '1SU' },
    },

    // Prefix on PTC events inside the merged feed, so a subscriber can tell
    // them apart from district events at a glance.
    orgEventPrefix: 'PTC: ',
    // Basename for the one-time .ics download (…-calendar.ics).
    downloadPrefix: 'william-walker',

    // Feed titles, as they appear in a subscriber's calendar list.
    feedNames: {
      merged: 'William Walker PTC + School',
      ptc: 'William Walker PTC Events',
      noschool: 'William Walker — No School Days',
      school: 'William Walker — School Events',
      district: 'William Walker — District & Board',
      observance: 'William Walker — Cultural & Religious Observances',
    },

    /* Categorization of district events. Anything unrecognized falls through
       to 'school' so it stays visible — a miscategorized event is untidy, a
       vanished one loses a family. */
    rules: {
      // Beaverton tags most observances with this phrase in DESCRIPTION.
      observanceMarker: 'Cultural & Religious',
      // …but applies it inconsistently, so these patch the ones that slip
      // through. Matched as EXACT titles, never substrings: a real school
      // event like "Diwali Celebration Night" must not become an observance.
      observanceTitles: [
        'christmas', 'easter', 'diwali', 'five days of diwali', 'eid al-fitr',
        'eid al-adha', 'lunar new year', 'rosh hashanah', 'yom kippur',
      ],
      noSchool: 'no school|school closed|no students',
      district: 'school board|board retreat|budget committee|budget 101|'
        + 'superintendent search|long-range facilities|public hearing',
    },

    // How far the page and the subscribe feed reach, and how long a fetched
    // feed is held. The feed window is longer so a subscriber's calendar keeps
    // showing events past the end of the page's year.
    window: { backDays: 2, pageDays: 365, feedDays: 400 },
    cacheMinutes: 60,
  },

  /* ---------- hosting ----------
     Read by scripts/build-config.mjs, which writes vercel.json. Every alias
     host gets a permanent redirect to canonicalHost, apex and paths both. */
  deploy: {
    canonicalHost: 'williamwalkerptc.com',
    aliasHosts: ['www.williamwalkerptc.com', 'wwptc.org', 'www.wwptc.org'],
    // Old URLs kept alive so existing links and printed flyers still work.
    redirects: [
      { from: '/parents', to: '/families' },
    ],
  },
};
