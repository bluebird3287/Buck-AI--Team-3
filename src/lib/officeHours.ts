import { supabase } from './supabase';
import type { Semester } from '../data/sampleData';

// Instructor and TA office hours from Fisher syllabi in Ohio State's Simple Syllabus library
// (public.office_hours; readable only by signed-in OSU accounts).

export type Weekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export const WEEKDAYS: Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export interface OfficeHourSession {
  day: Weekday;
  start: string; // '14:00'
  end: string; // '15:30'
  mode?: 'In person' | 'Online' | 'Hybrid';
}

export interface OfficeHoursEntry {
  term: string;
  course_code: string;
  class_number: string | null;
  course_title: string | null;
  person_name: string;
  role: 'Instructor' | 'TA' | 'Grader' | 'Other';
  email: string | null;
  location: string | null;
  hours_text: string | null;
  sessions: OfficeHourSession[];
  by_appointment: boolean;
  source_code: string;
}

export const syllabusUrl = (code: string) => `https://osu.simplesyllabus.com/en-US/doc/${code}?mode=view`;

export type OfficeHoursLoad = { status: 'ok'; entries: OfficeHoursEntry[] } | { status: 'not_osu' } | { status: 'error'; message: string };

export async function loadOfficeHours(): Promise<OfficeHoursLoad> {
  const { data: auth } = await supabase.auth.getUser();
  if (!/@(buckeyemail\.)?osu\.edu$/i.test(auth.user?.email ?? '')) return { status: 'not_osu' };
  const all: OfficeHoursEntry[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('office_hours')
      .select('term, course_code, class_number, course_title, person_name, role, email, location, hours_text, sessions, by_appointment, source_code')
      .order('course_code')
      .order('id')
      .range(from, from + 999);
    if (error) return { status: 'error', message: error.message };
    all.push(...((data ?? []) as OfficeHoursEntry[]));
    if ((data ?? []).length < 1000) break;
  }
  return { status: 'ok', entries: all };
}

const norm = (code: string) => code.trim().toUpperCase().replace(/\s+/g, ' ');
const base = (code: string) => norm(code).replace(/\.\d{2}/, '').replace(/(\d)H$/, '$1');

// Everyone with office hours for a course. An honors section's own syllabi come first; a student in ACCTMIS
// 2200H who only finds ACCTMIS 2200 syllabi still sees those, marked as another section.
export function entriesForCourse(entries: OfficeHoursEntry[], code: string): { entry: OfficeHoursEntry; exact: boolean }[] {
  const c = norm(code);
  const exact = entries.filter((e) => norm(e.course_code) === c);
  const related = entries.filter((e) => norm(e.course_code) !== c && base(e.course_code) === base(c));
  return [...exact.map((entry) => ({ entry, exact: true })), ...related.map((entry) => ({ entry, exact: false }))];
}

// One row per person per course: a professor teaching three sections usually lists the same hours on each syllabus.
export function people(rows: { entry: OfficeHoursEntry; exact: boolean }[]) {
  const byKey = new Map<string, { entry: OfficeHoursEntry; exact: boolean; classNumbers: string[] }>();
  for (const r of rows) {
    const key = `${r.entry.person_name.toLowerCase()}|${r.entry.role}|${r.entry.hours_text ?? ''}`;
    const prev = byKey.get(key);
    if (prev) {
      if (r.entry.class_number && !prev.classNumbers.includes(r.entry.class_number)) prev.classNumbers.push(r.entry.class_number);
    } else byKey.set(key, { ...r, classNumbers: r.entry.class_number ? [r.entry.class_number] : [] });
  }
  // Instructors first, then TAs
  const order = { Instructor: 0, TA: 1, Grader: 2, Other: 3 } as const;
  return [...byKey.values()].sort((a, b) => Number(b.exact) - Number(a.exact) || order[a.entry.role] - order[b.entry.role] || a.entry.person_name.localeCompare(b.entry.person_name));
}

// The classes a student is taking this term.
export const currentCourses = (roadmap: Semester[]) => roadmap.find((s) => s.status === 'in-progress')?.courses ?? [];

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};

export function formatTime(hhmm: string): string {
  const total = minutes(hhmm);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`;
}

// The next session from now, e.g. "Tue 2 PM" (or null when none is scheduled).
export function nextSession(sessions: OfficeHourSession[], now = new Date()): { session: OfficeHourSession; inDays: number } | null {
  const today = (now.getDay() + 6) % 7; // Mon = 0
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let best: { session: OfficeHourSession; inDays: number; key: number } | null = null;
  for (const s of sessions) {
    const d = WEEKDAYS.indexOf(s.day);
    if (d < 0) continue;
    let inDays = (d - today + 7) % 7;
    if (inDays === 0 && minutes(s.end) <= nowMin) inDays = 7;
    const key = inDays * 1440 + minutes(s.start);
    if (!best || key < best.key) best = { session: s, inDays, key };
  }
  return best ? { session: best.session, inDays: best.inDays } : null;
}

// Two sessions of different people at the same time (e.g. a TA's hours and another class's professor).
export const overlaps = (a: OfficeHourSession, b: OfficeHourSession) =>
  a.day === b.day && minutes(a.start) < minutes(b.end) && minutes(b.start) < minutes(a.end);

// Plain-text version for the AI: the student's own classes only.
export function describeOfficeHours(entries: OfficeHoursEntry[], roadmap: Semester[], picks: Record<string, string>): string {
  const lines: string[] = [];
  for (const course of currentCourses(roadmap)) {
    const list = people(entriesForCourse(entries, course.code));
    if (!list.length) continue;
    const mine = picks[norm(course.code)];
    lines.push(`${course.code}:`);
    for (const p of list.slice(0, 8)) {
      const e = p.entry;
      lines.push(
        `  - ${e.person_name} (${e.role}${mine && mine === e.person_name ? ", the student's instructor" : ''}${p.exact ? '' : `, ${e.course_code} section`}): ` +
          `${e.hours_text || (e.by_appointment ? 'by appointment' : 'no hours listed')}${e.location ? `; ${e.location}` : ''}${e.email ? `; ${e.email}` : ''}`,
      );
    }
  }
  return lines.join('\n');
}
