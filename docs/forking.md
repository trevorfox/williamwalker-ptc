# Setting this site up for another school

This is a working parent-group website, not a polished template. The chrome,
build and calendar are generic; the words are William Walker's. Expect an
afternoon for the setup below and a few evenings rewriting copy.

You need Node 18 or later, a GitHub account, and a free Vercel account. There
are no dependencies to install.

## 1. Config

```bash
cp site.config.example.mjs site.config.mjs
```

Replace every value. The comments in the example cover each key, and
`site.config.mjs` in the original repo is a filled-in reference. Two values
take real work:

- **`calendar.districtFeedUrl`.** Your school's public iCal feed: whatever URL
  sits behind the "iCal" or "Subscribe" icon on its calendar page. Every school
  CMS exposes it differently and some publish none. Leave it `null` to show only
  your own events.
- **`calendar.googleCalendarId`.** Create a Google Calendar under the group's
  own account, make it public, and copy the ID from Settings > Integrate
  calendar. Board members add events there and they appear on the site with no
  deploy. Enter meetings as individual events, not a recurring one.

## 2. Logo and colors

- Replace `assets/logo.png`, and set `brand.logoWidth` / `logoHeight` to its
  real pixel size.
- Edit the palette in the `:root` block at the top of `styles.css`. `--blue` is
  the primary color and `--green` the accent; each has `-deep`, `-dark` and
  `-tint` shades to adjust with it. The variable names stay even if your colors
  are not blue and green.
- Copy your new `--blue` value into `theme.themeColor`. The build fails if the
  two differ.

## 3. Build

```bash
npm run build:site
npm run serve        # http://localhost:3000, static pages only
```

`npm run serve` does not run the calendar function. To see `/calendar` with
live events, use `vercel dev` instead.

## 4. Rewrite the copy

The page text still describes William Walker. This command lists what is left:

```bash
grep -rniE 'william walker|wildcat|beaverton' src/pages content | less
```

- **`src/pages/`** holds the nine main pages as plain HTML. Names, emails, the
  school website and form links are already `{{tokens}}` filled from the config.
  Everything else is prose to rewrite: the family FAQ and the fundraising page
  are the most school-specific, and the supply lists in `supplies.html` are one
  school's lists for one year.
- **`content/programs/`** has one markdown file per program. Delete the ones you
  do not run and write your own. A file with `stub: true` is a card on the index
  with no page of its own.
- **`content/blog/`** has the original posts. Delete them all except
  `_template.md`, and copy that to start a post. Remove their images from
  `assets/blog/` too.
- **`content/minutes.json`** lists meeting minutes. Empty it to `[]` (the page
  then says none are posted yet) and add your own as you go.
- **`assets/families-qr.png` / `.svg`** encode the original site's URL.
  Regenerate them: `npx qrcode -e H -o assets/families-qr.png "https://your-site/families"`.

Remove a page by deleting its file in `src/pages/`, its built `.html` in the
repository root, and its links in the `nav` and `footer.links` config.

## 5. Tests

The snapshot suite compares built pages against the original school's pages,
so it fails on a fork until you take your own snapshot:

```bash
npm run build:site && npm run snapshot
npm test
```

After that, run `npm run snapshot` whenever you change built output on purpose
and have checked the diff.

## 6. Deploy

1. Push the repo to GitHub. Built HTML is committed on purpose: Vercel serves
   it as-is and runs no build.
2. Import the repo in Vercel. Framework preset: Other. No build command.
3. Add your domain in the Vercel project, and list it in `deploy.canonicalHost`
   (plus any `www` or short domains in `deploy.aliasHosts`). Run
   `npm run build:config` to regenerate `vercel.json`, then commit.

From then on: edit a source file, run `npm run build:site`, commit both the
source and the built pages, push.

## Things that will trip you up

- **Never edit generated files.** Every `.html` outside `src/`, plus
  `vercel.json` and `api/site.config.generated.cjs`, is overwritten by the next
  build.
- **Google Forms must belong to a consumer Google account.** A form created
  under a Workspace account is sign-in-walled, and Google blocks transferring it
  out.
- **Analytics is off until you set `analytics.ga4Id`.** Leave it `null` rather
  than keeping the original ID.
- **Office Depot's school ID only counts in store or by phone.** The supplies
  page is built around that. If your school has no ID, cut those sections.
