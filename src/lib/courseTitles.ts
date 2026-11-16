// Official course titles from OSU Class Search (see scripts/build-course-titles.mjs).
// Used by both the browser and the server, so it imports with a .js extension for Node.
import { COURSE_TITLES } from '../data/courseTitles.js';

// "busfin3500", "BUSFIN  3500" -> "BUSFIN 3500"
export function normalizeCourseCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, ' ').replace(/^([A-Z]+)\s*(\d)/, '$1 $2');
}

// The official title for a course code, or undefined when it isn't in the catalog.
// Honors (H) and embedded-honors (E) sections share the regular course's title.
export function officialTitle(code: string | null | undefined): string | undefined {
  if (!code) return undefined;
  const c = normalizeCourseCode(code);
  return COURSE_TITLES[c] ?? COURSE_TITLES[c.replace(/[HE]$/, '')];
}

// Every catalog course code that appears in a piece of text, with its official title.
export function titlesMentioned(text: string): string[] {
  const out = new Map<string, string>();
  for (const m of text.toUpperCase().matchAll(/\b([A-Z]{2,8})\s?(\d{4}(?:\.\d{2})?[HE]?)\b/g)) {
    const code = `${m[1]} ${m[2]}`;
    const title = officialTitle(code);
    if (title) out.set(code, title);
  }
  return [...out].map(([code, title]) => `${code}: ${title}`);
}

// Subjects that exist in the catalog (BUSFIN, ECON, ...), so "Spring 2027" or "room 2050" aren't read as course codes.
const SUBJECTS = new Set(Object.keys(COURSE_TITLES).map((code) => code.split(' ')[0]));

// Every course code a student typed ("busml4254", "ECON 2001.01"), whether or not it's on this year's schedule.
export function coursesMentioned(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.toUpperCase().matchAll(/\b([A-Z]{2,8})\s?(\d{4}(?:\.\d{2})?[HE]?)\b/g)) if (SUBJECTS.has(m[1])) out.add(`${m[1]} ${m[2]}`);
  return [...out];
}
