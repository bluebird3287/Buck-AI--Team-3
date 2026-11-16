// Builds src/data/studentOrgs.json: every active registered student organization at Ohio State,
// from the Ohio Union's public directory API (the JSON behind
// https://activities.osu.edu/involvement/student-organizations/find-a-student-org/).
//
//   npm run build:student-orgs
//
// The directory also lists officers' and advisors' names and emails. Those are individual people,
// and this repo is public, so they are left out: students reach an org through its own email,
// website or socials, or the official listing (linked from every org).

import { writeFile } from 'node:fs/promises';

const BASE = 'https://activities.osu.edu/public/api/v1/directory';
const OUT = new URL('../src/data/studentOrgs.json', import.meta.url);
const HEADERS = { 'User-Agent': 'BuckAI student-org directory refresh', Accept: 'application/json' };

async function getJson(url, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return await res.json();
    } catch (err) {
      if (i >= tries) throw err;
      await new Promise((r) => setTimeout(r, 1000 * i));
    }
  }
}

const clean = (s) => {
  if (s == null) return '';
  const t = String(s).replace(/\s+/g, ' ').trim();
  return t === '' || /^(n\/?a|none|null|-)$/i.test(t) ? '' : t;
};
const url = (s) => {
  const t = clean(s);
  if (!t || /\s/.test(t) || t.includes('@')) return '';
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
};
// An individual's OSU address (name.#@osu.edu): an officer, not the org. Kept out of the data.
const PERSONAL_OSU_EMAIL = /\b[a-z][a-z'-]*\.\d+@(?:buckeyemail\.)?osu\.edu\b/gi;
const email = (s) => {
  const t = clean(s).toLowerCase();
  if (new RegExp(PERSONAL_OSU_EMAIL.source, 'i').test(t)) return '';
  return /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(t) ? t : '';
};
const text = (s) => clean(s).replace(PERSONAL_OSU_EMAIL, "an officer (email on the org's official listing)");

// 1. Every active org on every campus, 100 per page (the API's max). The unfiltered search
// returns Columbus only, so each campus is listed separately.
const campuses = (await getJson(`${BASE}/campuses`)).filter((c) => c.toLowerCase() !== 'all');
const list = [];
const seen = new Set();
for (const campus of campuses) {
  for (let page = 1; ; page++) {
    const d = await getJson(`${BASE}/search?campus=${encodeURIComponent(campus)}&page=${page}&pageSize=100`);
    for (const item of d.items) if (!seen.has(item.id)) (seen.add(item.id), list.push(item));
    if (page >= d.pageCount || d.items.length === 0) break;
  }
  console.log(`${campus}: ${list.length} so far`);
}

// 2. Details per org (meetings, membership, links), a few at a time
const details = new Map();
let next = 0;
async function worker() {
  while (next < list.length) {
    const item = list[next++];
    try {
      details.set(item.id, await getJson(`${BASE}/org/${item.id}`));
    } catch (err) {
      console.warn(`\nno details for ${item.name}: ${err.message}`);
    }
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
console.log(`details for ${details.size}/${list.length}`);

const MEMBERSHIP = { Y: true, N: false };
const orgs = list
  .map((item) => {
    const d = details.get(item.id) ?? {};
    const categories = [...new Set([clean(item.make_up), ...(item.secondary_make_up_list ?? []).map(clean)].filter(Boolean))];
    const description = text(d.sif_description) || text(item.purpose_statement);
    const purpose = text(item.purpose_statement);
    return {
      id: item.id,
      name: clean(item.display_name || item.name),
      campus: clean(item.campus) || 'Columbus',
      status: clean(item.status),
      category: clean(item.make_up),
      categories,
      audience: clean(item.grad_undergrad), // Undergraduate / Graduate / Professional / ...
      purpose,
      description: description !== purpose ? description : '',
      keywords: text(d.keywords),
      meeting: text(d.meeting_date),
      membershipType: clean(d.membership_type),
      howToJoin: text(d.membership_apply),
      joinWhen: text(d.membership_process),
      dues: MEMBERSHIP[clean(d.membership_dues).toUpperCase()] ?? null,
      email: email(d.org_email),
      website: url(d.website_url),
      instagram: url(d.instagram_url),
      facebook: url(d.facebook_url),
      twitter: url(d.twitter_url),
      otherSocial: url(d.other_social_url),
      logo: url(item.org_logo_url),
    };
  })
  .filter((o) => o.name)
  .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));

const leaked = orgs.filter((o) => new RegExp(PERSONAL_OSU_EMAIL.source, 'i').test(JSON.stringify(o)));
if (leaked.length) throw new Error(`personal emails left in: ${leaked.map((o) => o.name).join(', ')}`);

const out = {
  source: 'https://activities.osu.edu/involvement/student-organizations/find-a-student-org/',
  fetchedAt: new Date().toISOString().slice(0, 10),
  count: orgs.length,
  orgs,
};
await writeFile(OUT, JSON.stringify(out) + '\n');
console.log(`wrote ${orgs.length} orgs to src/data/studentOrgs.json`);
