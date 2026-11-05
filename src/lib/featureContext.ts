// What the student has going on in BuckAI's other tabs, as plain text for the advising chat, so the
// chat can answer "do I have an advisor meeting?", "what seats am I watching?", or "who's the best
// professor for BUSFIN 4211?" from the same data the tabs show.

import fisherData from '../data/fisherFaculty.json';
import engineeringData from '../data/engineeringFaculty.json';
import { supabase, isSupabaseConfigured } from './supabase';
import type { AdvisorSlot, Semester } from '../data/sampleData';
import type { WatchedCourse } from '../components/SeatAlertsView';

interface DirectoryPerson {
  id: string;
  name: string;
  title?: string | null;
  department?: string | null;
  email?: string | null;
  courseIds: string[];
}

const DIRECTORY: DirectoryPerson[] = [
  ...(fisherData.faculty as unknown as DirectoryPerson[]),
  ...((engineeringData as unknown as { faculty: DirectoryPerson[] }).faculty ?? []),
];

const norm = (code: string) => code.trim().toUpperCase().replace(/\s+/g, ' ');
const baseCode = (code: string) => norm(code).replace(/(\d)H$/, '$1');

// "Marc H. Smith" and "Marc Smith" are the same person
const nameKey = (name: string) => {
  const parts = name.toLowerCase().replace(/[^a-z\s'-]/g, ' ').split(/\s+/).filter((p) => p.length > 1);
  return parts.length ? `${parts[0]} ${parts[parts.length - 1]}` : name.toLowerCase();
};
const BY_NAME = new Map(DIRECTORY.map((p) => [nameKey(p.name), p]));

// A professor's OSU email from the public Fisher / Engineering directories, for when the syllabus doesn't list one.
export const directoryEmail = (name: string): string | null => BY_NAME.get(nameKey(name))?.email ?? null;

// Who teaches a course this year, from OSU Class Search and the college directories.
const teachersOf = (code: string) => DIRECTORY.filter((p) => p.courseIds.some((c) => baseCode(c) === baseCode(code)));

export interface ReviewStat {
  facultyId: string;
  courseId: string;
  overall: number;
  difficulty: number;
  hoursPerWeek: number;
  wouldTakeAgain: boolean;
}

// Student reviews from the Faculty Evaluations tab (no user ids, no tips: just the numbers).
export async function loadReviewStats(): Promise<ReviewStat[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('faculty_reviews')
    .select('faculty_id, course_id, overall, difficulty, hours_per_week, would_take_again')
    .limit(5000);
  if (error || !data) return [];
  return data.map((r: any) => ({
    facultyId: r.faculty_id,
    courseId: r.course_id,
    overall: r.overall,
    difficulty: r.difficulty,
    hoursPerWeek: r.hours_per_week,
    wouldTakeAgain: r.would_take_again,
  }));
}

function reviewLine(stats: ReviewStat[]): string {
  if (!stats.length) return 'no student reviews yet';
  const avg = (f: (r: ReviewStat) => number) => (stats.reduce((s, r) => s + f(r), 0) / stats.length).toFixed(1);
  const again = Math.round((stats.filter((r) => r.wouldTakeAgain).length / stats.length) * 100);
  return `${stats.length} student review${stats.length === 1 ? '' : 's'}: overall ${avg((r) => r.overall)}/5, difficulty ${avg((r) => r.difficulty)}/5, about ${avg((r) => r.hoursPerWeek)} hrs/week, ${again}% would take again`;
}

interface FeatureInputs {
  roadmap: Semester[];
  bookedSlot: AdvisorSlot | null;
  bookedFormat?: string;
  watchedCourses: WatchedCourse[];
  reviews: ReviewStat[];
}

export function describeFeatures({ roadmap, bookedSlot, bookedFormat, watchedCourses, reviews }: FeatureInputs): string {
  const out: string[] = [];

  out.push(
    bookedSlot
      ? `Advisor Scheduling: the student requested ${bookedSlot.day} ${bookedSlot.date} at ${bookedSlot.time}${bookedFormat ? ` (${bookedFormat})` : ''}; their advisor still has to approve it.`
      : 'Advisor Scheduling: no appointment requested yet.',
  );

  out.push(
    watchedCourses.length
      ? `Seat Alerts (classes the student is watching):\n${watchedCourses
          .map(
            (c) =>
              `  - ${c.code} section ${c.section}${c.instructor ? ` (${c.instructor})` : ''}: ${
                c.status === 'seat_opened' ? 'a seat just opened' : c.status === 'full_waitlist' ? `full, waitlist ${c.waitlistPosition} of ${c.waitlistTotal}` : 'being watched'
              }`,
          )
          .join('\n')}`
      : 'Seat Alerts: the student is not watching any classes.',
  );

  // Instructors for this term's classes and the next planned term's, with student reviews
  const current = roadmap.find((s) => s.status === 'in-progress');
  const next = roadmap.find((s) => s.status === 'planned');
  const lines: string[] = [];
  for (const [label, sem] of [
    ['this term', current],
    ['next term', next],
  ] as const) {
    for (const course of sem?.courses ?? []) {
      const people = teachersOf(course.code).slice(0, 6);
      if (!people.length) continue;
      lines.push(`  ${course.code} (${label}):`);
      for (const p of people) {
        const stats = reviews.filter((r) => r.facultyId === p.id && baseCode(r.courseId) === baseCode(course.code));
        lines.push(`    - ${p.name}${p.title ? `, ${p.title}` : ''}${p.email ? ` (${p.email})` : ''}: ${reviewLine(stats)}`);
      }
    }
  }
  out.push(
    lines.length
      ? `Faculty Evaluations (instructors teaching the student's classes this year, from OSU Class Search, with BuckAI student reviews):\n${lines.join('\n')}`
      : 'Faculty Evaluations: no instructor data for the student\'s current or next-term classes.',
  );

  return out.join('\n\n');
}
