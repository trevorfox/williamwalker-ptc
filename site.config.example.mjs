/* =========================================================================
   site.config.example.mjs — a starting point for another school.

   Copy this over site.config.mjs and replace every value. It has the same
   keys as the real config (scripts/config-example.test.mjs fails if the two
   drift apart), with placeholder values and the comments a first-time setup
   needs. docs/forking.md walks through the rest.

   Nothing in the build reads this file.
   ========================================================================= */

const DONATE = 'https://example.org/donate';
const BOARD_CONTACTS = 'https://example.org/board';

export default {
  org: {
    name: 'Example Elementary PTA',           // titles, footer, social cards
    nameShort: 'Example PTA',                 // aria-labels, hero eyebrows
    abbrev: 'PTA',                            // beside the logo
    legalName: 'Example Elementary PTA, Inc.', // footer copyright
    email: 'board@example.org',
    volunteerEmail: 'volunteer@example.org',  // Teachers and Volunteer pages
    address: {
      street: '100 Main St.',
      cityStateZip: 'Anytown, ST 00000',
    },
  },

  school: {
    website: 'https://example-elementary.example.org/',
  },

  site: {
    origin: 'https://example.org',            // no trailing slash
    lang: 'en',
  },

  brand: {
    logo: '/assets/logo.png',                 // replace the file too
    logoWidth: 226,                           // the image's real pixel size
    logoHeight: 223,
    logoAlt: 'Example Elementary',
    homeAriaLabel: 'Example PTA home',
    ogImage: '/assets/logo.png',
  },

  theme: {
    themeColor: '#2F67B2',                    // must equal --blue in styles.css
    fontUrl: 'https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800;900&display=swap',
  },

  analytics: {
    ga4Id: null,                              // null omits the tag; add your own later
  },

  i18n: {
    // One-tap languages in the top bar. Google Translate covers the rest.
    languages: [
      { code: 'en', label: 'English' },
      { code: 'es', label: 'Español' },
    ],
  },

  links: {
    donate: DONATE,
    boardContacts: BOARD_CONTACTS,
    // Create these under a consumer Google account, not a Workspace one: a
    // Workspace form is sign-in-walled and cannot be transferred out.
    signupForm: 'https://docs.google.com/forms/d/e/YOUR_FORM_ID/viewform',
    grantForm: 'https://docs.google.com/forms/d/e/YOUR_FORM_ID/viewform',
  },

  fundraising: {
    // Office Depot 5% Back to Schools ID. If your school has none, remove the
    // {{fundraising.officeDepotId}} sections from supplies.html and
    // fundraising.html; this key can then be any string.
    officeDepotId: '00000000',
  },

  meetings: {
    day: 'first Wednesday',
    time: '6:00–7:00 PM',
    online: 'Google Meet',
  },

  // platform: facebook, instagram, or whatsapp. Drop an entry to drop it.
  social: [
    { platform: 'facebook', url: 'https://www.facebook.com/examplepta', label: 'Example PTA on Facebook', name: 'Facebook', meta: 'facebook.com/examplepta' },
  ],

  // `key` matches the `nav:` line in a page's frontmatter.
  nav: [
    {
      label: 'Families',
      id: 'sub-families',
      items: [
        { key: 'families', label: 'All family links', href: '/families' },
        { key: 'faq', label: 'Family FAQ', href: '/families/faq' },
        { key: 'supplies', label: 'School supplies', href: '/supplies' },
        { key: 'volunteer', label: 'Volunteer', href: '/volunteer' },
      ],
    },
    { key: 'teachers', label: 'Teachers', href: '/teachers' },
    { key: 'programs', label: 'Programs', href: '/programs' },
    { key: 'fundraising', label: 'Fundraising', href: '/fundraising' },
    { key: 'calendar', label: 'Calendar', href: '/calendar' },
    { key: 'blog', label: 'News', href: '/blog' },
    { key: 'minutes', label: 'Minutes', href: '/minutes' },
    { label: 'Donate', href: DONATE, cta: true, external: true },
  ],

  footer: {
    links: [
      { label: 'Programs', href: '/programs' },
      { label: 'Calendar', href: '/calendar' },
      { label: 'Families', href: '/families' },
      { label: 'Teachers', href: '/teachers' },
      { label: 'News', href: '/blog' },
      { label: 'Contacts', href: BOARD_CONTACTS, external: true },
    ],
    note: 'A parent- and staff-run nonprofit. The Example PTA is an independent '
      + 'organization and is not administered by the school district.',
  },

  blog: {
    index: {
      lede: 'Event recaps, fundraising results, and what the PTA is up to.',
      description: 'Updates from the Example Elementary PTA.',
    },
    // A post may only use tags listed here. src/pages/fundraising.html embeds
    // the newest "fundraising" posts, so keep that key or edit that page.
    tags: {
      fundraising: { label: 'Fundraising', blurb: 'How the money comes in.' },
      community: { label: 'Community', blurb: 'Family events and food nights.' },
      newsletter: { label: 'Newsletter', blurb: 'The PTA newsletter, archived.' },
      events: { label: 'Events', blurb: 'Dates for the family calendar.' },
    },
  },

  programs: {
    index: {
      lede: 'Every program on this page is funded by families and run by volunteers.',
      description: 'Everything the Example PTA funds and hosts.',
    },
    moreHeading: 'More ways to help.',
  },

  calendar: {
    // Your school's public iCal feed: whatever sits behind the "iCal" or
    // "Subscribe" icon on its calendar page. null runs PTA-events-only.
    districtFeedUrl: null,
    // A public Google Calendar the board edits. Calendar settings >
    // "Integrate calendar" > Calendar ID. Enter meetings as individual events,
    // not a recurring one: the parser does not expand recurrences.
    googleCalendarId: 'YOUR_CALENDAR_ID@group.calendar.google.com',

    timezone: 'America/New_York',
    dst: {
      standardName: 'EST', standardOffset: '-0500',
      daylightName: 'EDT', daylightOffset: '-0400',
      daylightStart: { month: 3, day: '2SU' },
      standardStart: { month: 11, day: '1SU' },
    },

    orgEventPrefix: 'PTA: ',
    downloadPrefix: 'example-elementary',

    feedNames: {
      merged: 'Example PTA + School',
      ptc: 'Example PTA Events',
      noschool: 'Example Elementary — No School Days',
      school: 'Example Elementary — School Events',
      district: 'Example Elementary — District & Board',
      observance: 'Example Elementary — Observances',
    },

    // How district events are sorted into categories. These depend on how
    // your district words its calendar; start here and adjust after looking
    // at the real feed. Unmatched events fall through to "school".
    rules: {
      observanceMarker: 'Cultural & Religious',
      observanceTitles: ['christmas', 'easter', 'diwali', 'lunar new year'],
      noSchool: 'no school|school closed|no students',
      district: 'school board|budget committee|public hearing',
    },

    window: { backDays: 2, pageDays: 365, feedDays: 400 },
    cacheMinutes: 60,
  },

  deploy: {
    canonicalHost: 'example.org',
    aliasHosts: ['www.example.org'],
    redirects: [
      // { from: '/old-path', to: '/new-path' },
      // { from: '/meeting-link', to: 'https://meet.google.com/…', permanent: false },
    ],
  },
};
