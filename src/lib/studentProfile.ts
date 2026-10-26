import { supabase } from './supabase';
import { Course, Semester, StudentProfile, DEFAULT_ADVISOR } from '../data/sampleData';

// One row of public.student_profiles. Row-level security limits every read and write
// to the signed-in student's own row.
export interface StudentRecord {
  full_name: string;
  major: string;
  minor: string | null;
  college: string | null;
  class_standing: string | null;
  gpa: number | null;
  semesters: Semester[];
  // From the advising report, when the student uploaded one
  earned_credits?: number | null;
  advisor_name?: string | null;
  report_imported_at?: string | null;
}

// What /api/parse-advising-report returns.
export interface ParsedAdvisingReport {
  fullName: string | null;
  major: string | null;
  minor: string | null;
  college: string | null;
  classStanding: string | null;
  gpa: number | null;
  earnedCredits: number | null;
  advisorName: string | null;
  terms: { season: Season; year: number; courses: { code: string; name: string | null; credits: number; grade: string | null }[] }[];
}

export function semestersFromReport(report: ParsedAdvisingReport): Semester[] {
  return normalizeSemesters(
    report.terms.map((t) => ({
      id: termId(t.season, t.year),
      name: `${t.season} ${t.year}`,
      status: termStatus(t.season, t.year),
      courses: t.courses.map((c) => newCourse(c.code, c.name ?? '', c.credits, c.grade === 'EM' ? 'Credit by exam' : c.grade ?? undefined)),
      totalCredits: 0,
      workloadRating: 'Light',
    })),
  );
}

export const SEASONS = ['Autumn', 'Spring', 'Summer'] as const;
export type Season = (typeof SEASONS)[number];

// The term in progress right now. Earlier terms count as completed, later ones as planned.
export const CURRENT_TERM = { season: 'Autumn' as Season, year: 2026 };

const SEASON_ORDER: Record<Season, number> = { Spring: 0, Summer: 1, Autumn: 2 };

export const termId = (season: Season, year: number) => `${season.toLowerCase()}-${year}`;

export function parseTerm(sem: Pick<Semester, 'id'>): { season: Season; year: number } | null {
  const m = /^(autumn|spring|summer)-(\d{4})$/.exec(sem.id);
  if (!m) return null;
  return { season: (m[1][0].toUpperCase() + m[1].slice(1)) as Season, year: Number(m[2]) };
}

const termKey = (season: Season, year: number) => year * 3 + SEASON_ORDER[season];

// Ohio State's academic year starts in Autumn, so Spring/Summer belong to the prior year's Autumn.
const academicYearStart = (season: Season, year: number) => (season === 'Autumn' ? year : year - 1);

export function termStatus(season: Season, year: number): Semester['status'] {
  const k = termKey(season, year);
  const now = termKey(CURRENT_TERM.season, CURRENT_TERM.year);
  return k < now ? 'completed' : k === now ? 'in-progress' : 'planned';
}

export function workloadFor(credits: number): Semester['workloadRating'] {
  if (credits <= 6) return 'Light';
  if (credits <= 13) return 'Moderate';
  if (credits <= 15) return 'Balanced';
  if (credits <= 18) return 'Heavy';
  return 'Overload';
}

// Sorts terms, fills in status, credits, workload, and the degree year (1-4) for each one.
export function normalizeSemesters(semesters: Semester[]): Semester[] {
  const parsed = semesters.map((s) => ({ s, t: parseTerm(s) }));
  const starts = parsed.filter((x) => x.t).map((x) => academicYearStart(x.t!.season, x.t!.year));
  const firstYear = starts.length ? Math.min(...starts) : CURRENT_TERM.year;

  return parsed
    .sort((a, b) => (a.t && b.t ? termKey(a.t.season, a.t.year) - termKey(b.t.season, b.t.year) : 0))
    .map(({ s, t }) => {
      const totalCredits = s.courses.reduce((sum, c) => sum + (Number(c.credits) || 0), 0);
      return {
        ...s,
        name: t ? `${t.season} ${t.year}` : s.name,
        status: t ? termStatus(t.season, t.year) : s.status,
        year: t ? academicYearStart(t.season, t.year) - firstYear + 1 : s.year,
        totalCredits,
        workloadRating: workloadFor(totalCredits),
      };
    });
}

export function newCourse(code: string, name: string, credits: number, grade?: string): Course {
  return {
    code: code.trim().toUpperCase(),
    name: name.trim() || code.trim().toUpperCase(),
    credits,
    type: 'General',
    difficulty: 3,
    prereqMet: true,
    notes: grade ? `Grade: ${grade}` : undefined,
  };
}

// Builds the profile the rest of the app reads from the student's saved record.
export function toStudentProfile(record: StudentRecord, email: string): StudentProfile {
  const semesters = normalizeSemesters(record.semesters);
  const enteredCredits = semesters
    .filter((s) => s.status === 'completed')
    .reduce((sum, s) => sum + s.totalCredits, 0);
  return {
    name: record.full_name,
    osuId: '',
    nameDotNum: email,
    rank: record.class_standing || '',
    college: record.college || '',
    major: record.major,
    minor: record.minor || '',
    gpa: Number(record.gpa ?? 0),
    // The report's earned hours include exam and transfer credit, so prefer them.
    earnedCredits: Number(record.earned_credits ?? enteredCredits),
    totalRequiredCredits: 120,
    ...(record.advisor_name
      ? { advisorName: record.advisor_name, advisorEmail: '', advisorTitle: 'Academic Advisor', advisorOffice: 'See OnCourse' }
      : DEFAULT_ADVISOR),
    holds: [],
    toDos: [],
  };
}

export async function loadStudentRecord(): Promise<StudentRecord | null> {
  const { data, error } = await supabase
    .from('student_profiles')
    .select('full_name, major, minor, college, class_standing, gpa, semesters, earned_credits, advisor_name, report_imported_at')
    .maybeSingle();
  if (error) throw error;
  return data as StudentRecord | null;
}

export async function saveStudentRecord(userId: string, record: StudentRecord): Promise<void> {
  const { error } = await supabase.from('student_profiles').upsert({
    user_id: userId,
    ...record,
    semesters: normalizeSemesters(record.semesters.filter((s) => s.courses.length > 0)),
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
