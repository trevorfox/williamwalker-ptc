#!/usr/bin/env node
/* Categorization tests. Run: node scripts/calendar-categorize.test.mjs */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const cal = require(join(ROOT, 'api', 'calendar.js'));
const { categorize, isObservance } = cal;

let n = 0;
const eq = (a, b, m) => { assert.strictEqual(a, b, m); n++; };

// --- no school: every wording variant in the real feed ---
for (const t of [
  'No School - Winter Break', 'No School - Fall Break', 'No School - Grading Day',
  'No School - Labor Day', 'No School - Veterans Day', 'No School - Presidents Day',
  'No School - Spring Break', 'No School - Memorial Day', 'No School - Winter break',
  'No School - Martin Luther King Jr. Day', 'No School - Staff Development/Workday',
  'No School - Pre-service - Staff Development Day', 'No School - Thanksgiving / Fall Break',
  'School Closed', 'Student Led Conferences - No Students',
  'Fall Parent/Teacher Conferences No School Students',
]) eq(categorize(t, '', 'school'), 'noschool', t);

// --- observances: the 9 unmarked stragglers, matched by exact title ---
for (const t of [
  'Christmas', 'Easter', 'Diwali', 'Five Days of Diwali', 'Eid al-Fitr',
  'Eid al-Adha', 'Lunar New Year', 'Rosh Hashanah', 'Yom Kippur',
]) eq(categorize(t, '', 'school'), 'observance', t);

// --- observances: detected by the district's DESCRIPTION marker ---
eq(categorize('Chuseok', 'For more information see Cultural & Religious Holidays & Observances .', 'school'),
  'observance', 'marker-detected observance');
eq(isObservance('Anything At All', 'blah Cultural & Religious blah'), true, 'marker alone suffices');

// --- exact-title, never substring ---
eq(categorize('Diwali Celebration Night', '', 'school'), 'school', 'substring must not match');
eq(categorize('Christmas Concert', '', 'school'), 'school', 'substring must not match');

// --- district governance ---
for (const t of [
  'School Board Work Session', 'School Board Business Meeting', 'School Board Retreat',
  'Budget Committee Meeting', 'Budget 101', 'Superintendent Search Committee Meeting',
  'Long-Range Facilities Planning Committee', 'VI Public Hearing',
]) eq(categorize(t, '', 'school'), 'district', t);

// --- school events, incl. superintendent COMMUNITY events (not governance) ---
for (const t of [
  'Field Day!', 'Literacy Night', 'Cafecito w/ Principal', 'Back To School Night',
  'Pre-K First Day of School', 'Multicultural Night', 'Meet the Superintendent',
  "Superintendent's Coffee Chat", 'First day for students',
]) eq(categorize(t, '', 'school'), 'school', t);

// --- PTC wins over everything ---
eq(categorize('PTC Meeting', '', 'ptc'), 'ptc', 'ptc source');
eq(categorize('No School - Whatever', '', 'ptc'), 'ptc', 'ptc source beats noschool');

// --- fail-visible guarantee ---
eq(categorize('Totally Unknown New Event Type', '', 'school'), 'school', 'unknown falls to school');
eq(categorize('', '', 'school'), 'school', 'empty title falls to school');

console.log('ok — ' + n + ' assertions passed');
