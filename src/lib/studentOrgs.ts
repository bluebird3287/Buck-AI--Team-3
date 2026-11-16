// Student organizations at Ohio State (src/data/studentOrgs.json, built by scripts/build-student-orgs.mjs from the
// Ohio Union's public directory). Shared by the Student Organizations tab (browser, loaded lazily) and the advising
// chat (server, `describeOrgsFor`), so both rank orgs the same way.

export interface StudentOrg {
  id: string;
  name: string;
  campus: string;
  status: string;
  category: string;
  categories: string[];
  audience: string; // Undergraduate / Graduate / Professional / ''
  purpose: string;
  description: string;
  keywords: string;
  meeting: string;
  membershipType: string; // Open Membership / Application/Selection Process / ''
  howToJoin: string;
  joinWhen: string;
  dues: boolean | null;
  email: string;
  website: string;
  instagram: string;
  facebook: string;
  twitter: string;
  otherSocial: string;
  logo: string;
}

export interface StudentOrgData {
  source: string;
  fetchedAt: string;
  count: number;
  orgs: StudentOrg[];
}

export const ORG_DIRECTORY_URL = 'https://activities.osu.edu/involvement/student-organizations/find-a-student-org/';

// The official listing has no per-org link; its search by name lands on the org (officer contacts are there).
export const officialListingUrl = (org: Pick<StudentOrg, 'name' | 'campus'>) =>
  `${ORG_DIRECTORY_URL}?${new URLSearchParams({ search: org.name, ...(org.campus !== 'Columbus' ? { campus: org.campus } : {}) })}`;

const STOP = new Set(
  'a an and are as at be best can club clubs do for from get good how i im in interested into is it join joining like me my of on or org orgs organization organizations osu ohio state some student students that the there to university what which with you any are some about find recommend suggest should involved involvement could would will want wanna looking look also them they their this those these help have has know tell list show give where who campus life extracurricular extracurriculars fun cool great new more other one ones'.split(
    ' ',
  ),
);

// Words students use that the directory spells differently
const SYNONYMS: Record<string, string[]> = {
  frat: ['fraternity', 'fraternities'],
  frats: ['fraternity', 'fraternities'],
  sorority: ['sororities', 'sorority'],
  greek: ['fraternity', 'sorority', 'fraternities', 'sororities'],
  finance: ['finance', 'investment', 'investing'],
  investing: ['investment', 'investing', 'finance'],
  coding: ['programming', 'coding', 'software', 'computer'],
  cs: ['computer', 'programming', 'software'],
  premed: ['pre-med', 'medical', 'medicine', 'premed'],
  'pre-med': ['pre-med', 'medical', 'medicine', 'premed'],
  volunteering: ['volunteer', 'service', 'volunteering'],
  volunteer: ['volunteer', 'service', 'volunteering'],
  faith: ['religious', 'spiritual', 'faith', 'christian', 'ministry'],
  christian: ['christian', 'ministry', 'faith'],
  sports: ['sport', 'sports', 'club sport', 'recreation'],
  honor: ['honor', 'honorary', 'honoraries'],
  music: ['music', 'musical', 'band', 'choir', 'a cappella'],
  dance: ['dance', 'dancing'],
  entrepreneurship: ['entrepreneur', 'entrepreneurship', 'startup', 'startups'],
  startup: ['startup', 'entrepreneur', 'entrepreneurship'],
  consulting: ['consulting', 'consultant'],
  marketing: ['marketing', 'advertising'],
  accounting: ['accounting', 'accountancy'],
  ai: ['artificial intelligence', 'machine learning', ' ai '],
  esports: ['esports', 'gaming', 'video game'],
  gaming: ['gaming', 'video game', 'esports', 'games'],
};

export const tokensOf = (q: string) =>
  q
    .toLowerCase()
    .replace(/[^a-z0-9&'\- ]+/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^'+|'+$/g, ''))
    .filter((w) => w.length > 1 && !STOP.has(w));

// One searchable lowercase string per field, built once per org
const haystacks = new WeakMap<StudentOrg, { name: string; cats: string; keys: string; text: string }>();
function hay(o: StudentOrg) {
  let h = haystacks.get(o);
  if (!h) {
    h = {
      name: ` ${o.name.toLowerCase()} `,
      cats: ` ${o.categories.join(' ').toLowerCase()} `,
      keys: ` ${o.keywords.toLowerCase().replace(/#/g, ' ')} `,
      text: ` ${o.purpose.toLowerCase()} ${o.description.toLowerCase()} `,
    };
    haystacks.set(o, h);
  }
  return h;
}

// Relevance of an org to a free-text query: a name match counts most, then category, keywords, and description.
// Every query word (or one of its synonyms) must appear somewhere, so "finance women" doesn't list every finance club.
export function scoreOrg(o: StudentOrg, words: string[]): number {
  if (words.length === 0) return 1;
  const h = hay(o);
  let score = 0;
  for (const w of words) {
    // The student's own word counts fully; a synonym ("consultant" for "consulting") a bit less
    const singular = w.endsWith('ies') ? `${w.slice(0, -3)}y` : w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w;
    // A synonym list that leaves out the word itself replaces it ("greek" means fraternities/sororities, not "GreekSide")
    const syn = SYNONYMS[w] ?? SYNONYMS[singular];
    const replaces = !!syn && !syn.includes(w) && !syn.includes(singular);
    const forms = replaces ? syn : [singular, ...(syn ?? []).filter((f) => f !== singular)];
    let best = 0;
    forms.forEach((f, i) => {
      const weight = i === 0 || replaces ? 1 : 0.7;
      const re = new RegExp(`(^|[^a-z0-9])${f.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
      if (re.test(h.name)) best = Math.max(best, 6 * weight);
      else if (re.test(h.cats)) best = Math.max(best, 3 * weight);
      else if (re.test(h.keys)) best = Math.max(best, 2.5 * weight);
      else if (re.test(h.text)) best = Math.max(best, 1 * weight);
    });
    if (best === 0) return 0;
    score += best;
  }
  // Registered orgs before pending ones; BuckAI's students are undergrads, so their orgs edge ahead
  if (/pending/i.test(o.status)) score -= 0.5;
  if (o.audience === 'Undergraduate') score += 0.3;
  return score;
}

export function searchOrgs(orgs: StudentOrg[], query: string): StudentOrg[] {
  const words = tokensOf(query);
  if (words.length === 0) return orgs;
  const exact = query.trim().toLowerCase();
  return orgs
    .map((o) => ({ o, s: scoreOrg(o, words) + (o.name.toLowerCase() === exact ? 20 : 0) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.o.name.localeCompare(b.o.name))
    .map((x) => x.o);
}

// Does a chat message ask about clubs/organizations? (Used by the chat intents and the server.)
export const ORG_QUESTION =
  /\b(clubs?|student org(anization)?s?|organizations?|orgs?|extracurricular|extra-curricular|frat(ernit(y|ies))?s?|sororit(y|ies)|greek life|get involved|involvement|honor societ(y|ies)|club sports?|intramural)\b/i;

// The topic of an org question, minus the generic words ("any consulting clubs I could join?" -> "consulting").
// Words that name a kind of org (Greek life, honor societies, club sports) stay.
const GENERIC_ORG_WORDS = /\b(clubs?|student org(anization)?s?|organizations?|orgs?|extra-?curriculars?|get involved|involvement)\b/gi;
export const orgTopic = (text: string) => tokensOf(text.replace(GENERIC_ORG_WORDS, ' ')).join(' ');

const short = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export function describeOrg(o: StudentOrg): string {
  const bits = [
    `${o.name} (${[o.category || 'Uncategorized', o.campus !== 'Columbus' ? `${o.campus} campus` : '', o.audience].filter(Boolean).join('; ')})`,
    short(o.description || o.purpose || 'No description listed.', 260),
    o.meeting && `Meets: ${short(o.meeting, 100)}`,
    o.membershipType && `Membership: ${o.membershipType}${o.dues === true ? ', dues' : o.dues === false ? ', no dues' : ''}`,
    o.howToJoin && `How to join: ${short(o.howToJoin, 160)}`,
    o.email && `Email: ${o.email}`,
    (o.website || o.instagram) && `Link: ${o.website || o.instagram}`,
  ];
  return `- ${bits.filter(Boolean).join(' | ')}`;
}

// What the chat sees for an org question: the best matches for the question itself, and when the question is
// generic ("what clubs should I join?"), matches for the student's major/specialization instead.
export function describeOrgsFor(orgs: StudentOrg[], question: string, studentContext: string, limit = 8): string {
  const topic = orgTopic(question);
  let picks = topic ? searchOrgs(orgs, topic).slice(0, limit) : [];
  let basis = 'the question';
  if (picks.length === 0) {
    const fromProfile = tokensOf(studentContext).slice(0, 6);
    const scored = new Map<StudentOrg, number>();
    for (const w of fromProfile)
      for (const o of orgs) {
        const s = scoreOrg(o, [w]);
        // BuckAI's students are undergrads: skip graduate/professional-school orgs for "clubs for my major"
        if (s > 0 && o.category === 'Academic/College' && !/^(graduate|professional)$/i.test(o.audience))
          scored.set(o, (scored.get(o) ?? 0) + s);
      }
    picks = [...scored.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].name.localeCompare(b[0].name))
      .slice(0, limit)
      .map(([o]) => o);
    basis = "the student's major/specialization";
  }
  if (picks.length === 0) return '';
  return `Best matches for ${basis} (of ${orgs.length} registered orgs):\n${picks.map(describeOrg).join('\n')}`;
}
