// Harness only: App's office hours come from here instead of Supabase (real rows are OSU-only and never leave it).
// FICTIONAL instructors and TAs for the sample student's Autumn 2026 classes, so the tab can be shown in the
// teaser. No emails, so no real person can be contacted by mistake. vite.config.ts aliases App's import to this file.
export * from '../src/lib/officeHours.ts';
import type { OfficeHoursEntry, OfficeHoursLoad } from '../src/lib/officeHours.ts';

const row = (
  course_code: string,
  course_title: string,
  person_name: string,
  role: OfficeHoursEntry['role'],
  location: string,
  sessions: OfficeHoursEntry['sessions'],
): OfficeHoursEntry => ({
  term: 'Autumn 2026',
  course_code,
  class_number: null,
  course_title,
  person_name,
  role,
  email: null,
  location,
  hours_text: sessions.map((s) => `${s.day} ${s.start}-${s.end}`).join(', '),
  sessions,
  by_appointment: true,
  source_code: 'sample',
});

const SAMPLE: OfficeHoursEntry[] = [
  row('BUSFIN 3220', 'Investments', 'Alan Reyes', 'Instructor', 'Fisher Hall 700', [
    { day: 'Tue', start: '14:00', end: '15:30', mode: 'In person' },
    { day: 'Thu', start: '10:00', end: '11:00', mode: 'Online' },
  ]),
  row('BUSFIN 3220', 'Investments', 'Jordan Ellis', 'TA', 'Gerlach Hall 250', [{ day: 'Wed', start: '16:00', end: '17:30', mode: 'In person' }]),
  row('BUSFIN 4210', 'Applied Corporate Finance', 'Priya Natarajan', 'Instructor', 'Fisher Hall 712', [
    { day: 'Mon', start: '13:00', end: '14:30', mode: 'In person' },
  ]),
  row('BUSMGT 3230', 'Operations Management', 'Megan Cole', 'Instructor', 'Fisher Hall 632', [
    { day: 'Wed', start: '11:00', end: '12:00', mode: 'Hybrid' },
  ]),
  row('BUSMGT 3230', 'Operations Management', 'Chris Park', 'TA', 'Online (Zoom link in Carmen)', [
    { day: 'Fri', start: '10:00', end: '11:30', mode: 'Online' },
  ]),
  row('BUSML 3250', 'Marketing Management', 'Samuel Brooks', 'Instructor', 'Fisher Hall 520', [
    { day: 'Thu', start: '15:00', end: '16:30', mode: 'In person' },
  ]),
  row('ACCTMIS 3200', 'Intermediate Accounting I', 'Lena Hoffman', 'Instructor', 'Fisher Hall 410', [
    { day: 'Mon', start: '09:30', end: '10:30', mode: 'In person' },
    { day: 'Wed', start: '09:30', end: '10:30', mode: 'In person' },
  ]),
];

export async function loadOfficeHours(): Promise<OfficeHoursLoad> {
  return { status: 'ok', entries: SAMPLE };
}
