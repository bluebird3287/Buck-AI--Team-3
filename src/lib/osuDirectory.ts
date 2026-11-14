// Ohio State's public directory (Find People, https://www.osu.edu/findpeople) — server-side only.
// Used to (1) confirm that someone signing in with name.#@osu.edu works as an academic advisor, and
// (2) turn the advisor name on a student's Advising Report into that advisor's real OSU contact details.
// Only public staff fields are kept: name, OSU username/email, working title, and office.

const DIRECTORY = 'https://directory.osu.edu/fpjson.php';

export interface DirectoryAppointment {
  job_title?: string | null;
  working_title?: string | null;
  organization?: string | null;
}

export interface DirectoryPerson {
  display_name: string;
  first_name: string;
  last_name: string;
  username: string;
  email: string | null;
  appointments?: DirectoryAppointment[] | null;
}

export interface DirectoryAdvisor {
  username: string;
  email: string;
  name: string;
  title: string;
  office: string;
  isAdvisor: boolean; // the directory lists an academic-advising job
}

async function query(params: Record<string, string>): Promise<DirectoryPerson[]> {
  const url = `${DIRECTORY}?${new URLSearchParams(params)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`OSU directory returned ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? (data as DirectoryPerson[]) : [];
}

// An academic-advising job, not a student or peer role ("Senior Academic Advisor", "Manager, Academic Advising").
const ADVISING = /advis(or|ing)/i;
const NOT_ADVISING = /\b(peer|student|graduate (associate|assistant))\b/i;
export function advisingAppointment(p: DirectoryPerson): DirectoryAppointment | null {
  return (
    (p.appointments ?? []).find((a) => {
      const t = `${a.job_title ?? ''} ${a.working_title ?? ''}`;
      return ADVISING.test(t) && !NOT_ADVISING.test(t);
    }) ?? null
  );
}

export function toAdvisor(p: DirectoryPerson): DirectoryAdvisor {
  const adv = advisingAppointment(p);
  const appt = adv ?? (p.appointments ?? [])[0] ?? null;
  return {
    username: p.username.toLowerCase(),
    email: (p.email || `${p.username}@osu.edu`).toLowerCase(),
    name: `${p.first_name} ${p.last_name}`.trim() || p.display_name,
    title: appt?.working_title || appt?.job_title || 'Academic Advisor',
    office: appt?.organization || 'Undergraduate Advising',
    isAdvisor: !!adv,
  };
}

// The person behind an OSU username (name.#), or null.
export async function lookupUsername(username: string): Promise<DirectoryPerson | null> {
  const u = username.trim().toLowerCase();
  if (!/^[a-z-]+\.[0-9]+$/.test(u)) return null;
  const people = await query({ name_n: u });
  return people.find((p) => p.username?.toLowerCase() === u) ?? null;
}

// "Rachel A. Miller" / "Sarah Jenkins, M.Ed." / "MILLER,RACHEL A" -> { first: "rachel", last: "miller" }
// (same rules as public.advisor_name_key in the database)
export function splitName(raw: string): { first: string; last: string } | null {
  let n = raw.trim().toLowerCase();
  if (!n) return null;
  if (/^[a-z'-]+ *, *[a-z]/.test(n) && !/,\s*(m\.|ph\.|ed\.|mba|ms|ma|phd)/.test(n)) {
    const [last, rest] = n.split(',');
    n = `${rest.trim()} ${last.trim()}`;
  } else {
    n = n.split(',')[0];
  }
  const parts = n.replace(/[^a-z' -]/g, '').trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  return { first: parts[0], last: parts[parts.length - 1] };
}

const firstMatches = (given: string, p: DirectoryPerson) => {
  const names = [p.first_name, p.display_name.split(/\s+/)[0]].map((s) => (s || '').toLowerCase());
  // Exact, or a shared start of at least 3 letters for nicknames (Maddy / Madeline, Vinny / Vincent)
  return names.some((f) => f === given || (given.length >= 3 && f.length >= 3 && (f.startsWith(given.slice(0, 3)) && given.startsWith(f.slice(0, 3)))));
};

// The advisor a student's report names, found in the directory. Prefers someone with an advising job;
// returns null when the name is a generic office or matches nobody (or several people) for certain.
export async function lookupAdvisorByName(name: string): Promise<DirectoryAdvisor | null> {
  const parts = splitName(name);
  if (!parts) return null;
  let people = await query({ firstname: parts.first, lastname: parts.last });
  people = people.filter((p) => p.last_name?.toLowerCase() === parts.last && firstMatches(parts.first, p));
  if (people.length === 0) {
    // Nicknames: the report says "Maddy", the directory may say "Madeline"
    people = (await query({ lastname: parts.last })).filter((p) => p.last_name?.toLowerCase() === parts.last && firstMatches(parts.first, p));
  }
  const advisors = people.filter((p) => advisingAppointment(p));
  const pick = advisors.length === 1 ? advisors[0] : advisors.length === 0 && people.length === 1 ? people[0] : null;
  return pick ? toAdvisor(pick) : null;
}
