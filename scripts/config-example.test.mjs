#!/usr/bin/env node
/* =========================================================================
   config-example.test — site.config.example.mjs must have the same keys as
   site.config.mjs.

   Nothing in the build reads the example, so without this it would quietly
   fall behind every time a key is added to the real config, and a fork that
   started from it would fail in a build script instead of here.

   Compared: every key path through nested objects, and that the two values
   are the same kind of thing. Arrays are compared as arrays only, since the
   entries (nav links, languages, redirects) are the school's own. null is
   accepted on either side, because some keys are optional (ga4Id,
   districtFeedUrl).

     node scripts/config-example.test.mjs
   ========================================================================= */
import real from '../site.config.mjs';
import example from '../site.config.example.mjs';

function kind(v) {
  if (v === null) return 'null';
  return Array.isArray(v) ? 'array' : typeof v;
}

const problems = [];
function walk(a, b, path) {
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const p = path ? path + '.' + k : k;
    if (!(k in b)) { problems.push(p + ' is in site.config.mjs but missing from the example'); continue; }
    if (!(k in a)) { problems.push(p + ' is in the example but not in site.config.mjs'); continue; }
    const ka = kind(a[k]), kb = kind(b[k]);
    if (ka === 'null' || kb === 'null') continue;
    if (ka !== kb) { problems.push(p + ' is ' + ka + ' in site.config.mjs but ' + kb + ' in the example'); continue; }
    if (ka === 'object') walk(a[k], b[k], p);
  }
}
walk(real, example, '');

if (problems.length) {
  console.error('config-example.test: site.config.example.mjs is out of step:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log('config-example.test: example config matches the real one');
