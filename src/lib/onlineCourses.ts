// Which courses can be taken fully online (see scripts/build-online-courses.mjs).
import { ONLINE_COURSES } from '../data/onlineCourses';
import { normalizeCourseCode } from './courseTitles';

// The latest published summer schedule; future summers aren't posted until spring.
export const SUMMER_REFERENCE = 'Summer 2026';

export function onlineTerms(code: string): string[] {
  const c = normalizeCourseCode(code);
  return ONLINE_COURSES[c] ?? ONLINE_COURSES[c.replace(/[HE]$/, '')] ?? [];
}

export const onlineInSummer = (code: string) => onlineTerms(code).includes(SUMMER_REFERENCE);
