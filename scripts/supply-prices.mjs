#!/usr/bin/env node
// Compare school-supply costs on Amazon via the Creators API (PA-API's replacement, 2026):
//   1. Current price of every ASIN linked on supplies.html
//   2. Cheapest pre-made supply kits per grade
//   3. Cheapest alternative listing per individual item
//
// Usage:
//   node scripts/supply-prices.mjs test    # one cheap call — checks credentials/eligibility
//   node scripts/supply-prices.mjs         # full run, writes scripts/out/{supply-prices.json,supply-price-report.md}
//
// Credentials from .env.local: CREATORS_API_ACCESS_KEY (credential/client ID, amzn1.application-oa2-client.…),
// CREATORS_API_SECRET_KEY (amzn1.oa2-cs.v1.…), AMAZON_PARTNER_TAG.
// Auth: OAuth2 client-credentials → Bearer token (v3.x NA credentials assumed;
// set CREATORS_API_TOKEN_URL / CREATORS_API_SCOPE in .env.local to override).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'scripts', 'out');

// ---------- env ----------
function loadEnv() {
  const env = {};
  for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}
const env = loadEnv();
const CLIENT_ID = env.CREATORS_API_ACCESS_KEY;
const CLIENT_SECRET = env.CREATORS_API_SECRET_KEY;
const PARTNER_TAG = env.AMAZON_PARTNER_TAG || 'ocsl-20';
const TOKEN_URL = env.CREATORS_API_TOKEN_URL || 'https://api.amazon.com/auth/o2/token'; // v3.1 (NA)
const SCOPE = env.CREATORS_API_SCOPE || 'creatorsapi::default'; // v2.x uses 'creatorsapi/default'
const API_BASE = 'https://creatorsapi.amazon/catalog/v1';
const MARKETPLACE = 'www.amazon.com';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing CREATORS_API_ACCESS_KEY / CREATORS_API_SECRET_KEY in .env.local');
  process.exit(1);
}
if (CLIENT_ID.startsWith('http')) {
  console.error(`CREATORS_API_ACCESS_KEY looks like a URL (${CLIENT_ID}) — paste the credential ID (amzn1.application-oa2-client.…) from the Creators API portal instead.`);
  process.exit(1);
}

// ---------- OAuth token ----------
let token = null;
let tokenExpiry = 0;
async function getToken() {
  if (token && Date.now() < tokenExpiry) return token;
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: SCOPE,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    throw new Error(`Token request failed (HTTP ${res.status}): ${JSON.stringify(json).slice(0, 400)}`);
  }
  token = json.access_token;
  tokenExpiry = Date.now() + (json.expires_in - 60) * 1000;
  return token;
}

// ---------- Creators API client ----------
async function creators(operation, payload) {
  const t = await getToken();
  const res = await fetch(`${API_BASE}/${operation}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${t}`,
      'content-type': 'application/json',
      'x-marketplace': MARKETPLACE,
    },
    body: JSON.stringify({ partnerTag: PARTNER_TAG, partnerType: 'Associates', ...payload }),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) {
    const errs = json.errors || json.Errors;
    const err = new Error(`${operation} HTTP ${res.status}: ${errs?.map((e) => `${e.code || e.Code}: ${e.message || e.Message}`).join('; ') || text.slice(0, 400)}`);
    err.status = res.status;
    err.code = errs?.[0]?.code || errs?.[0]?.Code;
    throw err;
  }
  return json;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastCall = 0;
async function throttled(operation, payload, tries = 3) {
  const wait = lastCall + 1200 - Date.now();
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();
  try {
    return await creators(operation, payload);
  } catch (e) {
    if (e.status === 429 && tries > 1) {
      console.error('  throttled, backing off 5s…');
      await sleep(5000);
      return throttled(operation, payload, tries - 1);
    }
    throw e;
  }
}

const ITEM_RESOURCES = ['itemInfo.title', 'offersV2.listings.price', 'offersV2.listings.merchantInfo'];

// Response casing is tolerant of both PA-API-style PascalCase and camelCase.
const pick = (obj, ...keys) => obj ? keys.map((k) => obj[k]).find((v) => v !== undefined) : undefined;
function simplify(item) {
  const offers = pick(item, 'offersV2', 'offers', 'OffersV2', 'Offers');
  const listing = pick(offers, 'listings', 'Listings')?.[0];
  const priceNode = pick(listing, 'price', 'Price');
  // OffersV2 nests the actual figures one level down: price.money.{amount,displayAmount}
  const price = pick(priceNode, 'money', 'Money') ?? priceNode;
  const asin = pick(item, 'asin', 'ASIN');
  return {
    asin,
    title: pick(pick(pick(item, 'itemInfo', 'ItemInfo'), 'title', 'Title'), 'displayValue', 'DisplayValue'),
    price: pick(price, 'amount', 'Amount', 'value') ?? null,
    priceDisplay: pick(price, 'displayAmount', 'DisplayAmount') ?? null,
    merchant: pick(pick(listing, 'merchantInfo', 'MerchantInfo'), 'name', 'Name') ?? null,
    url: `https://www.amazon.com/gp/product/${asin}/?&_encoding=UTF8&tag=${PARTNER_TAG}&linkCode=ur2&camp=1789&creative=9325`,
  };
}
const searchItems = (res) => pick(pick(res, 'searchResult', 'SearchResult'), 'items', 'Items') ?? [];
const gotItems = (res) => pick(pick(res, 'itemsResult', 'ItemsResult'), 'items', 'Items') ?? [];

// ---------- parse supplies.html ----------
function parseSupplies() {
  const html = readFileSync(join(ROOT, 'supplies.html'), 'utf8');
  const grades = [];
  const gradeRe = /<details class="grade" id="([^"]+)"[\s\S]*?<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g;
  for (const g of html.matchAll(gradeRe)) {
    const [, id, rawName, bodyHtml] = g;
    const name = rawName.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
    const items = [];
    const liRe = /<li data-asin="([^"]*)"(?: data-skip)? data-qty="(\d+)">([\s\S]*?)<\/li>/g;
    for (const li of bodyHtml.matchAll(liRe)) {
      const [, asin, qty, inner] = li;
      const text = inner
        .replace(/<span class="item-note">[\s\S]*?<\/span>/g, '')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&Prime;/g, '"').replace(/&[a-z#0-9]+;/gi, ' ')
        .replace(/\s+/g, ' ').trim();
      if (asin) items.push({ asin, qty: Number(qty), text });
    }
    grades.push({ id, name, items });
  }
  return grades;
}

// Turn "2 Packs Paper Mate Black Flair Pens" into a search keyword.
function keywordFor(text) {
  return text
    .replace(/^\d+\s+(Packs?|Boxe?s?|Bottles?|Reams?|Containers?|Sets?|Pairs?|Pumps?)?\s*(of\s+\d+\s+)?/i, '')
    .replace(/\(.*?\)/g, '')
    .trim();
}

const KIT_QUERIES = {
  prek: 'preschool pre-k school supply kit pack',
  kinder: 'kindergarten school supply kit pack',
  grade12: 'elementary school supply kit pack 1st 2nd grade',
  grade34: 'elementary school supply kit pack 3rd 4th grade',
  grade5: 'school supply kit pack 5th grade',
  isc: 'elementary school supply kit pack',
};

// ---------- modes ----------
async function testCall() {
  console.log(`Testing credentials (partnerTag=${PARTNER_TAG})…`);
  try {
    await getToken();
    console.log('✅ OAuth token obtained.');
  } catch (e) {
    console.error('❌ Token exchange failed —', e.message);
    console.error('   Check the credential ID/secret, or override CREATORS_API_TOKEN_URL / CREATORS_API_SCOPE for your credential version.');
    process.exit(1);
  }
  try {
    const res = await creators('searchItems', {
      keywords: 'Ticonderoga pencils', itemCount: 1, resources: ITEM_RESOURCES,
    });
    const item = searchItems(res)[0];
    if (item) {
      const s = simplify(item);
      console.log(`✅ API access works: ${s.asin} — ${s.priceDisplay ?? 'no price'} — ${s.title}`);
    } else {
      console.log('✅ Call succeeded but no items; raw response:', JSON.stringify(res).slice(0, 500));
    }
  } catch (e) {
    if (/NotEligible/i.test(e.code || '') || /NotEligible/i.test(e.message)) {
      console.error('⏳ AssociateNotEligible — credentials are valid but eligibility review has not cleared (up to 48h), or the account lacks 10 qualifying sales in the past 30 days.');
    } else {
      console.error('❌', e.message);
    }
    process.exit(1);
  }
}

async function fullRun() {
  const grades = parseSupplies();
  const allItems = grades.flatMap((g) => g.items);
  const uniqueAsins = [...new Set(allItems.map((i) => i.asin))];
  const uniqueKeywords = [...new Map(allItems.map((i) => [keywordFor(i.text), i.text])).keys()];
  const nCalls = Math.ceil(uniqueAsins.length / 10) + grades.length + uniqueKeywords.length;
  console.log(`${grades.length} grades, ${allItems.length} items (${uniqueAsins.length} unique ASINs, ${uniqueKeywords.length} unique searches) — ~${nCalls} API calls, ~${Math.ceil((nCalls * 1.2) / 60)} min`);

  // 1. Current prices for linked ASINs
  const priceByAsin = {};
  for (let i = 0; i < uniqueAsins.length; i += 10) {
    const batch = uniqueAsins.slice(i, i + 10);
    console.log(`getItems ${i + 1}–${i + batch.length}/${uniqueAsins.length}`);
    const res = await throttled('getItems', { itemIds: batch, resources: ITEM_RESOURCES });
    for (const item of gotItems(res)) { const s = simplify(item); priceByAsin[s.asin] = s; }
    for (const err of res.errors ?? res.Errors ?? []) console.error(`  ⚠ ${err.code || err.Code}: ${err.message || err.Message}`);
  }

  // 2. Cheapest pre-made kits per grade.
  // Relevance search + client-side filter: price-sorted search returns cheap
  // junk (sticker packs, craft kits), not actual supply kits. Require
  // "suppl…" AND kit/bundle/set in the title, then sort by price ourselves.
  const kitsByGrade = {};
  for (const g of grades) {
    console.log(`Kits: ${g.name}`);
    try {
      const res = await throttled('searchItems', {
        keywords: KIT_QUERIES[g.id] ?? 'school supply kit', itemCount: 10, resources: ITEM_RESOURCES,
      });
      kitsByGrade[g.id] = searchItems(res)
        .map(simplify)
        .filter((k) => k.price != null && /suppl/i.test(k.title ?? '') && /kit|bundle|set|pack/i.test(k.title ?? ''))
        .sort((a, b) => a.price - b.price);
    } catch (e) {
      console.error(`  ⚠ ${e.message}`);
      kitsByGrade[g.id] = [];
    }
  }

  // 3. Cheapest alternative per unique item keyword — same principle: take
  // Amazon's relevance-ranked results, then pick the cheapest one whose title
  // actually matches the item ("cheapest 24ct pencils", not a $1 skort).
  const STOP = new Set(['pack', 'packs', 'of', 'the', 'a', 'with', 'and', 'or', 'size', 'set', 'sets', 'box', 'boxes', 'container', 'bottle', 'ream', 'pair', 'count', 'ct', 'thin', 'thick', 'black', 'white', 'blue', 'green', 'yellow']);
  const coreTokens = (q) => q.toLowerCase().replace(/[^a-z0-9# ]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
  const titleMatches = (title, q) => {
    const t = (title ?? '').toLowerCase();
    const toks = coreTokens(q);
    if (toks.length === 0) return true;
    const hits = toks.filter((w) => t.includes(w.replace(/s$/, '')));
    return hits.length >= Math.max(1, Math.ceil(toks.length / 2));
  };
  const altByKeyword = {};
  let n = 0;
  for (const kw of uniqueKeywords) {
    console.log(`Alt ${++n}/${uniqueKeywords.length}: ${kw}`);
    try {
      const res = await throttled('searchItems', {
        keywords: kw, itemCount: 10, resources: ITEM_RESOURCES,
      });
      altByKeyword[kw] = searchItems(res)
        .map(simplify)
        .filter((a) => a.price != null && titleMatches(a.title, kw))
        .sort((a, b) => a.price - b.price);
    } catch (e) {
      console.error(`  ⚠ ${e.message}`);
      altByKeyword[kw] = [];
    }
  }

  // ---------- assemble & report ----------
  const report = grades.map((g) => {
    const items = g.items.map((it) => {
      const current = priceByAsin[it.asin] ?? null;
      const alts = altByKeyword[keywordFor(it.text)] ?? [];
      const cheapestAlt = alts.filter((a) => a.asin !== it.asin)[0] ?? null;
      return { ...it, current, cheapestAlt };
    });
    const priced = items.filter((i) => i.current?.price != null);
    const currentTotal = priced.reduce((s, i) => s + i.current.price * i.qty, 0);
    const cheapestTotal = priced.reduce((s, i) => {
      const alt = i.cheapestAlt?.price != null ? Math.min(i.current.price, i.cheapestAlt.price) : i.current.price;
      return s + alt * i.qty;
    }, 0);
    return {
      grade: g.name, id: g.id, items,
      currentTotal: Number(currentTotal.toFixed(2)),
      cheapestItemTotal: Number(cheapestTotal.toFixed(2)),
      unpricedItems: items.filter((i) => i.current?.price == null).map((i) => i.text),
      kits: kitsByGrade[g.id] ?? [],
    };
  });

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, 'supply-prices.json'), JSON.stringify({ generatedAt: new Date().toISOString(), partnerTag: PARTNER_TAG, report }, null, 2));

  let md = `# Supply price comparison — ${new Date().toISOString().slice(0, 10)}\n`;
  for (const g of report) {
    md += `\n## ${g.grade}\n\n`;
    md += `- **Buy list as linked:** $${g.currentTotal.toFixed(2)}`;
    if (g.unpricedItems.length) md += ` (excludes ${g.unpricedItems.length} unpriced: ${g.unpricedItems.join('; ')})`;
    md += `\n- **Buy list w/ cheapest swaps:** $${g.cheapestItemTotal.toFixed(2)}\n`;
    md += g.kits.length
      ? `- **Cheapest pre-made kits:**\n${g.kits.slice(0, 3).map((k) => `  - ${k.priceDisplay} — [${k.title?.slice(0, 90)}](${k.url})`).join('\n')}\n`
      : `- **No pre-made kits found**\n`;
    const swaps = g.items.filter((i) => i.cheapestAlt?.price != null && i.current?.price != null && i.cheapestAlt.price < i.current.price);
    if (swaps.length) {
      md += `\n| Item | Linked price | Cheapest found | Savings |\n|---|---|---|---|\n`;
      for (const s of swaps) {
        md += `| ${s.text} | ${s.current.priceDisplay} | [${s.cheapestAlt.priceDisplay}](${s.cheapestAlt.url}) ${s.cheapestAlt.title?.slice(0, 60)} | $${(s.current.price - s.cheapestAlt.price).toFixed(2)} |\n`;
      }
    }
  }
  writeFileSync(join(OUT_DIR, 'supply-price-report.md'), md);
  console.log(`\nDone. Wrote scripts/out/supply-prices.json and scripts/out/supply-price-report.md`);
}

if (process.argv[2] === 'test') await testCall();
else await fullRun();
