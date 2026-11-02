import { supabase } from './supabase';
import { Course, Semester, StudentProfile, DEFAULT_ADVISOR } from '../data/sampleData';
import { officialTitle } from './courseTitles';

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
  degree_id?: string | null; // a degree in public.programs; none = the Fisher BSBA
  specialization_id?: string | null; // older rows; use specialization_ids
  specialization_ids?: string[];
  plan_terms?: PlanTerms | null; // which future terms they want to take classes in
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

export const termKey = (season: Season, year: number) => year * 3 + SEASON_ORDER[season];

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
// Course names come from OSU Class Search when the code is known, so a wrong title typed
// by the student or guessed by the AI (e.g. BUSFIN 3500 as "Personal Finance") never sticks.
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
        courses: s.courses.map((c) => ({ ...c, name: officialTitle(c.code) ?? c.name })),
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
    name: officialTitle(code) ?? (name.trim() || code.trim().toUpperCase()),
    credits,
    type: 'General',
    difficulty: 3,
    prereqMet: true,
    grade: grade || undefined,
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
    specializationIds: record.specialization_ids?.length
      ? record.specialization_ids
      : record.specialization_id
      ? [record.specialization_id]
      : [],
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
    .select('full_name, major, minor, college, class_standing, gpa, semesters, earned_credits, advisor_name, report_imported_at, degree_id, specialization_id, specialization_ids, plan_terms')
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

// ---------- Which future terms a student plans to take classes in ----------

export interface PlanTerms {
  terms: string[]; // term ids, e.g. 'spring-2027'
  graduation: string; // term id of the target graduation term
  summerMaxCourses?: number | null; // at most this many classes in each summer (null = no limit)
  summerOnline?: boolean; // summer classes must be fully online
}

const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4 };

// Summer preferences written in a request ("only 1 to 2 classes over the summers, online"),
// used to pre-fill the term picker so the student only has to confirm them.
export function planPrefsFromText(text: string): { summers?: boolean; summerMaxCourses?: number; summerOnline?: boolean } {
  const t = text.toLowerCase();
  if (!/\bsummers?\b/.test(t)) return {};
  if (/\b(?:no|without|skip|skipping)\s+(?:the\s+)?summers?\b|\bno\s+(?:classes|courses)\s+(?:in|over|during)\s+(?:the\s+)?summers?\b/.test(t)) return { summers: false };
  const prefs: { summers?: boolean; summerMaxCourses?: number; summerOnline?: boolean } = { summers: true };
  const n = '(\\d|one|two|three|four)';
  const range = new RegExp(`${n}\\s*(?:-|–|to|or)\\s*${n}\\s*(?:classes|courses|class|course)`).exec(t);
  const single = new RegExp(`(?:only|at most|max(?:imum)?(?: of)?|up to|no more than)\\s*${n}\\s*(?:classes|courses|class|course)`).exec(t);
  const value = (s: string) => NUMBER_WORDS[s] ?? Number(s);
  if (range) prefs.summerMaxCourses = value(range[2]);
  else if (single) prefs.summerMaxCourses = value(single[1]);
  if (/\b(online|remote|remotely|virtual|distance)\b/.test(t)) prefs.summerOnline = true;
  return prefs;
}

export interface TermOption {
  id: string;
  season: Season;
  year: number;
  label: string;
}

// Ohio State's academic year starts in Autumn, so Spring/Summer belong to the prior year's Autumn.
export const academicYearOf = (season: Season, year: number) => (season === 'Autumn' ? year : year - 1);

// The academic year the student started, from their earliest term (or this year).
export function firstAcademicYear(semesters: Semester[]): number {
  const starts = semesters.map(parseTerm).filter(Boolean).map((t) => academicYearOf(t!.season, t!.year));
  return starts.length ? Math.min(...starts) : academicYearOf(CURRENT_TERM.season, CURRENT_TERM.year);
}

// Terms after the current one, through the end of the student's 6th academic year.
export function futureTerms(semesters: Semester[]): TermOption[] {
  const first = firstAcademicYear(semesters);
  const now = termKey(CURRENT_TERM.season, CURRENT_TERM.year);
  const out: TermOption[] = [];
  for (let ay = first; ay < first + 6; ay++) {
    for (const [season, year] of [['Autumn', ay], ['Spring', ay + 1], ['Summer', ay + 1]] as [Season, number][]) {
      if (termKey(season, year) <= now) continue;
      out.push({ id: termId(season, year), season, year, label: `${season} ${year}` });
    }
  }
  return out;
}

// Default: Autumn and Spring terms (no summers) through Spring of the student's 4th year.
export function defaultPlanTerms(semesters: Semester[]): PlanTerms {
  const graduation = termId('Spring', firstAcademicYear(semesters) + 4);
  const gradKey = termKey('Spring', firstAcademicYear(semesters) + 4);
  const terms = futureTerms(semesters)
    .filter((t) => t.season !== 'Summer' && termKey(t.season, t.year) <= gradKey)
    .map((t) => t.id);
  return { terms, graduation };
}

// The chosen terms that fall on or before graduation, in order.
export function activePlanTerms(plan: PlanTerms, semesters: Semester[]): TermOption[] {
  const grad = parseTerm({ id: plan.graduation });
  const gradKey = grad ? termKey(grad.season, grad.year) : Infinity;
  const chosen = new Set(plan.terms);
  return futureTerms(semesters).filter((t) => chosen.has(t.id) && termKey(t.season, t.year) <= gradKey);
}

