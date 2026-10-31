import { supabase } from './supabase';
import { Course, Semester } from '../data/sampleData';
import geData from '../data/geCourses.json';

// ---------- Curriculum (public tables: programs, requirement_groups, requirement_courses) ----------

export interface RequirementCourse {
  code: string;
  title: string;
  credits: number | null;
  prerequisites: string | null;
  min_grade: string | null;
  alternates: string[]; // codes the program officially accepts
  equivalents: string[]; // codes that may substitute; confirm with advisor
  is_secondary: boolean;
  notes: string | null;
  offered_terms?: string[]; // [] = Autumn and Spring; ['Autumn'] / ['Spring'] = that season only; ['None'] = not on the current schedule
  min_standing?: number | null; // earned credit hours needed before taking it (30 sophomore, 60 junior, 90 senior)
}

export interface RequirementGroup {
  id: string;
  title: string;
  kind: 'all' | 'choose_courses' | 'choose_credits' | 'manual' | 'ge';
  min_courses: number | null;
  min_credits: number | null;
  max_secondary_credits: number | null;
  code_pattern: string | null;
  exclude_codes: string[];
  notes: string | null;
  ge_category?: string | null; // for kind 'ge': writing, math, sbs, arts, history, natsci, diversity, theme-citizenship, theme-other
  courses: RequirementCourse[];
}

export interface Program {
  id: string;
  kind: 'degree' | 'specialization' | 'minor';
  name: string;
  college: string;
  parent_id: string | null; // the degree a specialization belongs to
  catalog: string;
  min_total_credits: number | null;
  min_gpa: number | null;
  notes: string | null;
  source_url: string | null;
  excluded_programs: string[]; // students in these programs can't add this minor (a degree id = anyone in that degree)
  groups: RequirementGroup[];
}

// One student's requirements: their degree, its specializations, and every minor.
export interface Curriculum {
  degree: Program;
  specializations: Program[];
  minors: Program[];
}

// Every college's programs (Fisher, Engineering, ...), loaded once.
export interface CurriculumLibrary {
  degrees: Program[];
  specializations: Program[];
  minors: Program[];
}

export const DEFAULT_DEGREE_ID = 'fisher-bsba'; // students who haven't picked a degree (the original Fisher pilot)

export function curriculumFor(library: CurriculumLibrary, degreeId?: string | null): Curriculum {
  const degree =
    library.degrees.find((p) => p.id === degreeId) ?? library.degrees.find((p) => p.id === DEFAULT_DEGREE_ID) ?? library.degrees[0];
  return {
    degree,
    specializations: library.specializations.filter((p) => (p.parent_id ?? DEFAULT_DEGREE_ID) === degree.id),
    minors: library.minors,
  };
}

export async function loadCurriculum(): Promise<CurriculumLibrary> {
  const [programs, groups, courses] = await Promise.all([
    supabase
      .from('programs')
      .select('id, kind, name, college, parent_id, catalog, min_total_credits, min_gpa, notes, source_url, excluded_programs')
      .order('sort_order'),
    supabase
      .from('requirement_groups')
      .select('id, program_id, title, kind, min_courses, min_credits, max_secondary_credits, code_pattern, exclude_codes, notes, ge_category')
      .order('sort_order'),
    supabase
      .from('requirement_courses')
      .select('group_id, code, title, credits, prerequisites, min_grade, alternates, equivalents, is_secondary, notes, offered_terms, min_standing')
      .order('sort_order'),
  ]);
  const error = programs.error || groups.error || courses.error;
  if (error) throw error;

  const num = (v: unknown) => (v == null ? null : Number(v));
  const byProgram = new Map<string, RequirementGroup[]>();
  const groupById = new Map<string, RequirementGroup>();
  for (const g of groups.data ?? []) {
    const group: RequirementGroup = {
      ...(g as any),
      min_credits: num(g.min_credits),
      max_secondary_credits: num(g.max_secondary_credits),
      courses: [],
    };
    groupById.set(g.id, group);
    byProgram.set(g.program_id, [...(byProgram.get(g.program_id) ?? []), group]);
  }
  for (const c of courses.data ?? []) {
    groupById.get(c.group_id)?.courses.push({ ...(c as any), credits: num(c.credits) });
  }
  const all: Program[] = (programs.data ?? []).map((p: any) => ({
    ...p,
    min_total_credits: num(p.min_total_credits),
    min_gpa: num(p.min_gpa),
    groups: byProgram.get(p.id) ?? [],
  }));
  const degrees = all.filter((p) => p.kind === 'degree');
  if (!degrees.length) throw new Error('Curriculum has no degree programs.');
  return {
    degrees,
    specializations: all.filter((p) => p.kind === 'specialization'),
    minors: all.filter((p) => p.kind === 'minor'),
  };
}

// Best guess at the degree named in free text such as "Mechanical Engineering" or "Finance (BS Business Admin)".
export function guessDegree(library: CurriculumLibrary, major: string): string | null {
  const text = major.toLowerCase();
  const match = library.degrees.find(
    (p) => p.id !== DEFAULT_DEGREE_ID && text.includes(p.name.replace(/^BS\s+/i, '').toLowerCase()),
  );
  return match?.id ?? null;
}

// Best guess at specializations named in free text such as "Finance (BS Business Admin)"
// or "Finance + Tech Innovation". Programs that share a name (Operations tracks) count once.
export function guessSpecializations(curriculum: Curriculum, major: string): string[] {
  const text = major.toLowerCase();
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const p of curriculum.specializations) {
    const base = p.name.split(' (')[0].toLowerCase();
    if (seen.has(base) || !text.includes(base)) continue;
    seen.add(base);
    ids.push(p.id);
  }
  return ids;
}

// ---------- Matching a student's classes to requirements ----------

export type ItemState = 'done' | 'in_progress' | 'planned' | 'missing';

interface TakenCourse {
  code: string;
  credits: number;
  grade: string | null;
  term: string;
  termIndex: number; // order of the term in the student's plan
  state: Exclude<ItemState, 'missing'>;
}

const norm = (code: string) => code.trim().toUpperCase().replace(/\s+/g, ' ');

// "ECON 2001" matches ECON 2001.01/.02; a code with a decimal must match exactly.
function codeMatches(required: string, taken: string): boolean {
  const r = norm(required);
  const t = norm(taken);
  return r === t || (!r.includes('.') && t.startsWith(r + '.'));
}

export function courseGrade(course: Course): string | null {
  if (course.grade) return course.grade;
  const m = /Grade:\s*(.+)$/i.exec(course.notes ?? '');
  return m ? m[1].trim() : null;
}

const FAILING = new Set(['E', 'EN', 'F', 'U', 'W', 'I', 'IX', 'NG', 'NR']);
const GRADE_ORDER = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'E'];
const GRADE_POINTS: Record<string, number> = { A: 4, 'A-': 3.7, 'B+': 3.3, B: 3, 'B-': 2.7, 'C+': 2.3, C: 2, 'C-': 1.7, 'D+': 1.3, D: 1, E: 0 };

function passes(grade: string | null, minGrade: string | null): boolean {
  if (!grade) return true;
  const g = grade.toUpperCase();
  if (FAILING.has(g)) return false;
  if (!minGrade || !GRADE_ORDER.includes(g)) return true; // EM, S, transfer credit, etc.
  return GRADE_ORDER.indexOf(g) <= GRADE_ORDER.indexOf(minGrade.toUpperCase());
}

function flatten(semesters: Semester[]): TakenCourse[] {
  return semesters.flatMap((s, i) =>
    s.courses.map((c) => ({
      code: norm(c.code),
      credits: Number(c.credits) || 0,
      grade: courseGrade(c),
      term: s.name,
      termIndex: i,
      state: s.status === 'completed' ? 'done' : s.status === 'in-progress' ? 'in_progress' : 'planned',
    })),
  );
}

const STATE_RANK: Record<ItemState, number> = { done: 0, in_progress: 1, planned: 2, missing: 3 };

export interface RequirementItem {
  code: string;
  title: string;
  credits: number | null;
  state: ItemState;
  takenAs?: string; // the student's course code, when it differs (equivalent or section)
  term?: string;
  viaEquivalent?: boolean;
  issue?: string; // e.g. grade below the minimum
  notes?: string | null;
}

export interface GroupProgress {
  group: RequirementGroup;
  state: ItemState | 'manual';
  items: RequirementItem[]; // what counts toward the group
  creditsCounted: number;
  creditsNeeded: number | null;
  coursesCounted: number;
  coursesNeeded: number | null;
}

export interface ProgramProgress {
  program: Program;
  groups: GroupProgress[];
}

function bestMatch(req: RequirementCourse, taken: TakenCourse[], used: Set<TakenCourse>) {
  let best: { t: TakenCourse; viaEquivalent: boolean; ok: boolean } | null = null;
  for (const t of taken) {
    if (used.has(t)) continue;
    const direct = codeMatches(req.code, t.code) || req.alternates.some((a) => codeMatches(a, t.code));
    const viaEquivalent = !direct && req.equivalents.some((e) => codeMatches(e, t.code));
    if (!direct && !viaEquivalent) continue;
    const ok = t.state !== 'done' || passes(t.grade, req.min_grade);
    const candidate = { t, viaEquivalent, ok };
    if (
      !best ||
      (ok && !best.ok) ||
      (ok === best.ok && STATE_RANK[t.state] < STATE_RANK[best.t.state])
    ) {
      best = candidate;
    }
  }
  return best;
}

function itemFrom(req: RequirementCourse, match: ReturnType<typeof bestMatch>): RequirementItem {
  if (!match) return { code: req.code, title: req.title, credits: req.credits, state: 'missing', notes: req.notes };
  const { t, viaEquivalent, ok } = match;
  const sameCourse = norm(req.code) === t.code || codeMatches(req.code, t.code);
  return {
    code: req.code,
    title: req.title,
    // An accepted alternate can carry different hours (CHEM 1210 for CHEM 1250); count what the student took
    credits: sameCourse ? req.credits ?? t.credits : t.credits || req.credits,
    state: ok ? t.state : 'missing',
    takenAs: norm(req.code) === t.code ? undefined : t.code,
    term: t.term,
    viaEquivalent,
    issue: ok ? undefined : `Earned ${t.grade}${req.min_grade ? `; needs ${req.min_grade} or higher` : ''}`,
    notes: viaEquivalent ? 'Counted as an equivalent. Confirm with your advisor.' : req.notes,
  };
}

function rollup(states: ItemState[]): ItemState {
  return states.reduce<ItemState>((worst, s) => (STATE_RANK[s] > STATE_RANK[worst] ? s : worst), 'done');
}

function checkGroup(group: RequirementGroup, taken: TakenCourse[], used: Set<TakenCourse>): GroupProgress {
  const base = { group, creditsCounted: 0, creditsNeeded: group.min_credits, coursesCounted: 0, coursesNeeded: group.min_courses };

  if (group.kind === 'manual') return { ...base, state: 'manual', items: [] };

  if (group.kind === 'all') {
    const items = group.courses.map((req) => {
      const m = bestMatch(req, taken, used);
      if (m?.ok) used.add(m.t);
      return itemFrom(req, m);
    });
    return {
      ...base,
      state: rollup(items.map((i) => i.state)),
      items,
      coursesCounted: items.filter((i) => i.state !== 'missing').length,
      coursesNeeded: items.length,
    };
  }

  // choose_courses / choose_credits: gather every usable match, best first
  const candidates: { req: RequirementCourse; m: NonNullable<ReturnType<typeof bestMatch>> }[] = [];
  const claimed = new Set<TakenCourse>();
  for (const req of group.courses) {
    const m = bestMatch(req, taken, new Set([...used, ...claimed]));
    if (m?.ok) {
      candidates.push({ req, m });
      claimed.add(m.t);
    }
  }
  if (group.code_pattern) {
    const pattern = new RegExp(group.code_pattern, 'i');
    for (const t of taken) {
      if (used.has(t) || claimed.has(t) || !pattern.test(t.code)) continue;
      if (group.exclude_codes.some((x) => codeMatches(x, t.code))) continue;
      if (t.state === 'done' && !passes(t.grade, null)) continue;
      candidates.push({
        req: { code: t.code, title: 'Elective', credits: t.credits, prerequisites: null, min_grade: null, alternates: [], equivalents: [], is_secondary: false, notes: null },
        m: { t, viaEquivalent: false, ok: true },
      });
      claimed.add(t);
    }
  }
  candidates.sort((a, b) => STATE_RANK[a.m.t.state] - STATE_RANK[b.m.t.state]);

  const items: RequirementItem[] = [];
  let credits = 0;
  let secondary = 0;
  for (const { req, m } of candidates) {
    if (group.kind === 'choose_courses' && items.length >= (group.min_courses ?? 1)) break;
    if (group.kind === 'choose_credits' && credits >= (group.min_credits ?? 0)) break;
    const c = codeMatches(req.code, m.t.code) ? req.credits ?? m.t.credits : m.t.credits || req.credits || 0;
    if (req.is_secondary && group.max_secondary_credits != null) {
      if (secondary + c > group.max_secondary_credits) continue;
      secondary += c;
    }
    credits += c;
    used.add(m.t);
    items.push(itemFrom(req, m));
  }

  const enough =
    group.kind === 'choose_courses' ? items.length >= (group.min_courses ?? 1) : credits >= (group.min_credits ?? 0);
  return {
    ...base,
    state: enough ? rollup(items.map((i) => i.state)) : 'missing',
    items,
    creditsCounted: credits,
    coursesCounted: items.length,
  };
}

export function checkProgram(program: Program, semesters: Semester[]): ProgramProgress {
  const taken = flatten(semesters);
  const used = new Set<TakenCourse>();
  const ge = checkGe(program.groups.filter((g) => g.kind === 'ge'), taken);
  return { program, groups: program.groups.map((g) => (g.kind === 'ge' ? ge.get(g)! : checkGroup(g, taken, used))) };
}

// ---------- General Education (GEN) ----------
// Course categories come from the registrar's GEN tags and ASC's approved lists (src/data/geCourses.json,
// built by scripts/build_ge_data.py). OSU rules applied here:
// - each GE category needs its own course (one course can't fill two GE categories);
// - GE Foundations may also count toward the business foundation (ENGLISH 1110, ECON 2001, ...);
// - a Theme is one 4-credit course, or two courses of 3+ credits from different subjects, in that Theme;
// - Citizenship is required, plus one other Theme.

interface GeEntry {
  title: string;
  credits: number | null;
  categories: string[];
  terms: string[];
}

const GE_COURSES = (geData as unknown as { courses: Record<string, GeEntry> }).courses;
const GE_BY_BASE = new Map<string, GeEntry[]>();
for (const [code, entry] of Object.entries(GE_COURSES)) {
  const base = code.replace(/\.\d{2}H?$/, '');
  GE_BY_BASE.set(base, [...(GE_BY_BASE.get(base) ?? []), entry]);
}

export const GE_NAMES: Record<string, string> = {
  writing: 'Writing & Information Literacy',
  math: 'Mathematical & Quantitative Reasoning',
  sbs: 'Social & Behavioral Sciences',
  arts: 'Literary, Visual & Performing Arts',
  history: 'Historical & Cultural Studies',
  natsci: 'Natural Sciences',
  diversity: 'Race, Ethnicity & Gender Diversity',
  'theme-citizenship': 'Citizenship for a Diverse & Just World',
  'theme-lived-environments': 'Lived Environments',
  'theme-sustainability': 'Sustainability',
  'theme-health': 'Health & Well-being',
  'theme-traditions': 'Traditions, Cultures & Transformations',
  'theme-origins': 'Origins & Evolution',
  'theme-number-nature-mind': 'Number, Nature, Mind',
  'theme-migration': 'Migration, Mobility & Immobility',
};
const OTHER_THEMES = Object.keys(GE_NAMES).filter((c) => c.startsWith('theme-') && c !== 'theme-citizenship');

// GE categories for a course code. A code with a section number (ENGLISH 2367.01) must match exactly
// (or its plain number); "ENGLISH 1110" without one gets only the categories every section shares,
// since sections of one number can carry different GE tags.
export function geCategories(code: string): string[] {
  const c = norm(code);
  const base = c.replace(/\.\d{2}H?$/, '');
  if (GE_COURSES[c]) return GE_COURSES[c].categories;
  if (c !== base) return GE_COURSES[base]?.categories ?? [];
  const sections = GE_BY_BASE.get(base) ?? [];
  return sections.length ? sections[0].categories.filter((cat) => sections.every((e) => e.categories.includes(cat))) : [];
}

export function geCourseInfo(code: string): GeEntry | null {
  const c = norm(code);
  return GE_COURSES[c] ?? GE_COURSES[c.replace(/\.\d{2}H?$/, '')] ?? GE_BY_BASE.get(c)?.[0] ?? null;
}

// Real GE courses in a category, for suggestions: ones offered both Autumn 2026 and Spring 2027 first,
// then lower-level ones, one per subject so the list shows a range.
export function geExamples(category: string, count = 6): string[] {
  const cats = category === 'theme-other' ? OTHER_THEMES : [category];
  const minCredits = category === 'natsci' ? 4 : 3;
  const seen = new Set<string>();
  return Object.entries(GE_COURSES)
    // Engineering-only sections aren't useful suggestions for business students
    .filter(([, e]) => e.categories.some((x) => cats.includes(x)) && (e.credits ?? 0) >= minCredits && e.terms.length && !/engineering/i.test(e.title))
    .sort(([a, x], [b, y]) => y.terms.length - x.terms.length || Number(a.split(' ')[1]) - Number(b.split(' ')[1]))
    .filter(([code]) => !seen.has(code.split(' ')[0]) && !!seen.add(code.split(' ')[0]))
    .slice(0, count)
    .map(([code, e]) => `${code} ${e.title} (${e.credits} cr${category === 'theme-other' ? `, ${GE_NAMES[e.categories.find((x) => cats.includes(x))!]}` : ''})`);
}

const subject = (code: string) => code.split(' ')[0];
const theme = (cat: string) => GE_NAMES[cat] ?? cat;

function checkGe(groups: RequirementGroup[], taken: TakenCourse[]): Map<RequirementGroup, GroupProgress> {
  // GE-tagged courses the student has (passing or not yet graded)
  const pool = taken
    .filter((t) => !(t.state === 'done' && !passes(t.grade, null)))
    .map((t) => ({ t, cats: geCategories(t.code), credits: t.credits || geCourseInfo(t.code)?.credits || 0 }))
    .filter((x) => x.cats.length);
  type Pick = typeof pool[number];
  type Option = { picks: Pick[]; cat: string };

  // Every way each group can be met, as sets of 1-2 courses
  const optionsFor = (g: RequirementGroup): Option[] => {
    const cat = g.ge_category ?? '';
    const min = g.min_credits ?? 3;
    const out: Option[] = [];
    const cats = cat === 'theme-other' ? OTHER_THEMES : [cat];
    for (const c of cats) {
      const inCat = pool.filter((p) => p.cats.includes(c));
      const isTheme = c.startsWith('theme-');
      for (const p of inCat) if (p.credits >= (isTheme ? 4 : min)) out.push({ picks: [p], cat: c });
      for (let i = 0; i < inCat.length; i++)
        for (let j = i + 1; j < inCat.length; j++) {
          const [a, b] = [inCat[i], inCat[j]];
          if (isTheme ? a.credits >= 3 && b.credits >= 3 && subject(a.t.code) !== subject(b.t.code) : a.credits < min && a.credits + b.credits >= min)
            out.push({ picks: [a, b], cat: c });
        }
    }
    return out;
  };
  const options = groups.map(optionsFor);

  // Pick the assignment that meets the most groups, preferring finished classes over planned ones.
  const cost = (o: Option) => o.picks.reduce((n, p) => n + STATE_RANK[p.t.state] + 1, 0);
  let best: { met: number; cost: number; choice: (Option | null)[] } = { met: -1, cost: Infinity, choice: [] };
  const choice: (Option | null)[] = [];
  const usedNow = new Set<Pick>();
  const search = (i: number, met: number, c: number) => {
    if (met + (groups.length - i) < best.met) return;
    if (i === groups.length) {
      if (met > best.met || (met === best.met && c < best.cost)) best = { met, cost: c, choice: [...choice] };
      return;
    }
    for (const o of options[i]) {
      if (o.picks.some((p) => usedNow.has(p))) continue;
      o.picks.forEach((p) => usedNow.add(p));
      choice.push(o);
      search(i + 1, met + 1, c + cost(o));
      choice.pop();
      o.picks.forEach((p) => usedNow.delete(p));
    }
    choice.push(null);
    search(i + 1, met, c);
    choice.pop();
  };
  search(0, 0, 0);

  const usedFinal = new Set(best.choice.flatMap((o) => o?.picks ?? []));
  const result = new Map<RequirementGroup, GroupProgress>();
  groups.forEach((g, i) => {
    const o = best.choice[i];
    const base = { group: g, creditsNeeded: g.min_credits, coursesNeeded: null };
    const item = (p: Pick, cat: string, issue?: string): RequirementItem => ({
      code: p.t.code,
      title: geCourseInfo(p.t.code)?.title ?? p.t.code,
      credits: p.credits,
      state: issue ? 'missing' : p.t.state,
      term: p.t.term,
      issue,
      notes: g.ge_category === 'theme-other' ? `${theme(cat)} Theme` : null,
    });
    if (o) {
      result.set(g, {
        ...base,
        state: rollup(o.picks.map((p) => p.t.state)),
        items: o.picks.map((p) => item(p, o.cat)),
        creditsCounted: o.picks.reduce((n, p) => n + p.credits, 0),
        coursesCounted: o.picks.length,
      });
      return;
    }
    // Not met: show a course that's partway there (e.g. one 3-credit Theme course), if any
    const cats = g.ge_category === 'theme-other' ? OTHER_THEMES : [g.ge_category ?? ''];
    const partial = pool.find((p) => !usedFinal.has(p) && p.cats.some((c) => cats.includes(c)));
    const cat = partial?.cats.find((c) => cats.includes(c)) ?? '';
    const issue = !partial
      ? undefined
      : cat.startsWith('theme-')
      ? `Needs one more 3+ credit ${theme(cat)} course from a subject other than ${subject(partial.t.code)} (or one 4-credit course in a Theme)`
      : `Needs ${g.min_credits ?? 3} credit hours in this category`;
    result.set(g, {
      ...base,
      state: 'missing',
      items: partial ? [item(partial, cat, issue)] : [],
      creditsCounted: 0,
      coursesCounted: 0,
    });
  });
  return result;
}

// ---------- Prerequisites for current and planned classes ----------

export interface PrereqWarning {
  code: string;
  term: string;
  missing: string[];
}

// Turns "BUSMHR 2000, 2292; ECON 2001 & ECON 2002; MATH 1131/1151 or 1161" into clauses, each a list
// of codes where any one satisfies it. A clause that allows concurrent enrollment can be met in the
// same term. Clauses that name no course (standing, placement, permission) are skipped; rules too
// tangled to read ("...; or ...") return null.
interface PrereqClause {
  codes: string[];
  sameTermOk: boolean;
}

function parsePrereqs(text: string): PrereqClause[] | null {
  const parts = text.split(';').map((p) => p.trim()).filter(Boolean);
  if (parts.some((p) => /^or\b/i.test(p))) return null;
  const clauses: PrereqClause[] = [];
  for (const part of parts) {
    for (const clause of part.split(/\s*&\s*|\s+and\s+/i)) {
      if (!clause) continue;
      const sameTermOk = /concur/i.test(clause);
      const codes: string[] = [];
      let dept = '';
      for (const m of clause.matchAll(/\b([A-Z]{3,8})\s+(\d{4}(?:\.\d{2})?H?)|\b(\d{4}(?:\.\d{2})?H?)\b/g)) {
        if (m[1]) dept = m[1];
        const num = m[2] ?? m[3];
        if (dept && num) codes.push(`${dept} ${num}`);
      }
      if (!codes.length) continue;
      if (/\bor\b|\//i.test(clause)) clauses.push({ codes, sameTermOk });
      else clauses.push(...codes.map((code) => ({ codes: [code], sameTermOk })));
    }
  }
  return clauses;
}

// Prerequisite codes match loosely: ECON 2001.01 accepts ECON 2001 and the other way around.
const baseCode = (code: string) => norm(code).replace(/\.\d{2}H?$/, '');

export function checkPrerequisites(curriculum: Curriculum, semesters: Semester[]): PrereqWarning[] {
  const reqs = new Map<string, RequirementCourse>();
  for (const p of [curriculum.degree, ...curriculum.specializations]) {
    for (const g of p.groups) for (const c of g.courses) if (c.prerequisites && !reqs.has(norm(c.code))) reqs.set(norm(c.code), c);
  }
  const equivalents = new Map<string, string[]>();
  for (const g of curriculum.degree.groups) for (const c of g.courses) equivalents.set(baseCode(c.code), [...c.alternates, ...c.equivalents]);

  const taken = flatten(semesters);
  const warnings: PrereqWarning[] = [];
  for (const t of taken) {
    if (t.state === 'done') continue;
    const req = [...reqs.values()].find((r) => codeMatches(r.code, t.code));
    if (!req?.prerequisites) continue;
    const clauses = parsePrereqs(req.prerequisites);
    if (!clauses) continue;
    const missing = clauses
      .filter(
        ({ codes: anyOf, sameTermOk }) =>
          !anyOf.some((code) =>
            taken.some(
              (x) =>
                (sameTermOk ? x.termIndex <= t.termIndex : x.termIndex < t.termIndex) &&
                (baseCode(code) === baseCode(x.code) ||
                  (equivalents.get(baseCode(code)) ?? []).some((e) => baseCode(e) === baseCode(x.code))) &&
                (x.state !== 'done' || passes(x.grade, null)),
            ),
          ),
      )
      .map(({ codes }) => codes.join(' or '));
    if (missing.length) warnings.push({ code: t.code, term: t.term, missing });
  }
  return warnings;
}

// ---------- When a class can be taken: season offered, class standing, real course codes ----------

export interface ScheduleWarning {
  code: string;
  term: string;
  message: string;
  blocking: boolean; // false = advisory only (e.g. not on the current schedule yet)
}

const STANDING_NAMES: Record<number, string> = { 30: 'sophomore', 60: 'junior', 90: 'senior' };
const REAL_CODE = /^[A-Z][A-Z&]{1,9} \d{4}(\.\d{2})?[A-Z]?$/;
export const isPlaceholderCode = (code: string) => norm(code) !== 'ELECTIVE' && !REAL_CODE.test(norm(code));

export function checkSchedule(curriculum: Curriculum, semesters: Semester[], earnedCredits: number): ScheduleWarning[] {
  const reqs = new Map<string, RequirementCourse>();
  for (const p of [curriculum.degree, ...curriculum.specializations])
    for (const g of p.groups)
      for (const c of g.courses) {
        const prev = reqs.get(norm(c.code));
        if (!prev || (!prev.offered_terms?.length && c.offered_terms?.length) || (prev.min_standing == null && c.min_standing != null))
          reqs.set(norm(c.code), { ...prev, ...c, offered_terms: c.offered_terms?.length ? c.offered_terms : prev?.offered_terms, min_standing: c.min_standing ?? prev?.min_standing });
      }

  const warnings: ScheduleWarning[] = [];
  let creditsBefore = earnedCredits; // hours finished before each upcoming term
  for (const s of semesters) {
    if (s.status === 'completed') continue;
    const season = s.name.split(' ')[0];
    for (const c of s.courses) {
      const code = norm(c.code);
      if (s.status === 'planned' && isPlaceholderCode(code)) {
        warnings.push({ code, term: s.name, blocking: true, message: `"${c.code}" isn't a real course. Replace it with an actual course (or ELECTIVE for a free elective).` });
        continue;
      }
      if (s.status !== 'planned') continue;
      const req = [...reqs.values()].find((r) => codeMatches(r.code, code));
      const offered = req?.offered_terms ?? [];
      if (offered.includes('None'))
        warnings.push({ code, term: s.name, blocking: false, message: `${code} isn't on the Autumn 2026 or Spring 2027 schedule; confirm with your advisor that it will be offered in ${s.name}.` });
      else if (offered.length && !offered.includes(season))
        warnings.push({ code, term: s.name, blocking: true, message: `${code} is offered ${offered.join('/')} only, but it's planned for ${s.name}.` });
      if (req?.min_standing && creditsBefore < req.min_standing)
        warnings.push({
          code,
          term: s.name,
          blocking: true,
          message: `${code} needs ${STANDING_NAMES[req.min_standing] ?? ''} standing (${req.min_standing}+ earned credit hours); the student will have about ${creditsBefore} before ${s.name}.`,
        });
    }
    const load = s.courses.reduce((n, c) => n + (Number(c.credits) || 0), 0);
    // Ohio State: 12+ hours is full time; more than 18 needs college approval
    if (s.status === 'planned' && load > 18)
      warnings.push({ code: '', term: s.name, blocking: true, message: `${s.name} has ${load} credit hours; keep it at 18 or fewer (more needs college approval).` });
    else if (s.status === 'planned' && load > 0 && load < 12)
      warnings.push({ code: '', term: s.name, blocking: false, message: `${s.name} has ${load} credit hours, below full time (12). That can affect financial aid; check with your advisor.` });
    creditsBefore += load;
  }
  return warnings;
}

// Official credit hours for a course: the program requirement data first, then the registrar's GE tags.
export function catalogCredits(curriculum: Curriculum | null, code: string): number | null {
  const c = norm(code);
  for (const p of curriculum ? [curriculum.degree, ...curriculum.specializations, ...curriculum.minors] : [])
    for (const g of p.groups) for (const r of g.courses) if (r.credits != null && norm(r.code) === c) return r.credits;
  return GE_COURSES[c]?.credits ?? null;
}

// ---------- Whole-degree summary ----------

export interface DegreeAudit {
  degree: ProgramProgress;
  specializations: ProgramProgress[]; // a student may have more than one
  specializationOptions: number; // how many specializations the degree offers (0 = none to choose)
  prereqWarnings: PrereqWarning[];
  scheduleWarnings: ScheduleWarning[];
  credits: { earned: number; inProgress: number; planned: number; required: number };
  specializationGpas: { name: string; gpa: number }[];
  // Courses counting toward more than one specialization. Fisher doesn't publish a rule for this,
  // so they're counted for each and flagged for the advisor to confirm.
  sharedCourses: string[];
}

export function auditDegree(
  curriculum: Curriculum,
  specializationIds: string[],
  semesters: Semester[],
  earnedCredits: number,
): DegreeAudit {
  const specs = specializationIds
    .map((id) => curriculum.specializations.find((p) => p.id === id))
    .filter((p): p is Program => !!p);
  const specProgress = specs.map((spec) => checkProgram(spec, semesters));

  const allCourses = semesters.flatMap((s) => s.courses);
  const specializationGpas: DegreeAudit['specializationGpas'] = [];
  const usedBy = new Map<string, number>();
  for (const sp of specProgress) {
    let points = 0;
    let hours = 0;
    const used = new Set<string>();
    for (const g of sp.groups) {
      for (const item of g.items) {
        if (item.state === 'missing') continue;
        used.add(norm(item.takenAs ?? item.code));
        if (item.state !== 'done') continue;
        const course = allCourses.find((c) => norm(c.code) === norm(item.takenAs ?? item.code));
        const grade = course ? courseGrade(course)?.toUpperCase() : null;
        if (grade && grade in GRADE_POINTS) {
          points += GRADE_POINTS[grade] * (Number(course!.credits) || 0);
          hours += Number(course!.credits) || 0;
        }
      }
    }
    for (const code of used) usedBy.set(code, (usedBy.get(code) ?? 0) + 1);
    // Fisher requires a 2.00 GPA in each specialization; other colleges don't have this rule
    if (hours && curriculum.degree.id === DEFAULT_DEGREE_ID)
      specializationGpas.push({ name: sp.program.name, gpa: Math.round((points / hours) * 100) / 100 });
  }
  const sum = (status: Semester['status']) =>
    semesters.filter((s) => s.status === status).reduce((n, s) => n + s.courses.reduce((m, c) => m + (Number(c.credits) || 0), 0), 0);

  return {
    degree: checkProgram(curriculum.degree, semesters),
    specializations: specProgress,
    specializationOptions: curriculum.specializations.length,
    prereqWarnings: checkPrerequisites(curriculum, semesters),
    scheduleWarnings: checkSchedule(curriculum, semesters, earnedCredits),
    credits: {
      earned: earnedCredits,
      inProgress: sum('in-progress'),
      planned: sum('planned'),
      required: curriculum.degree.min_total_credits ?? 121,
    },
    specializationGpas,
    sharedCourses: [...usedBy].filter(([, n]) => n > 1).map(([code]) => code),
  };
}

// Plain-text version for the AI prompts.
export function describeAudit(audit: DegreeAudit): string {
  const lines: string[] = [];
  const program = (p: ProgramProgress) => {
    lines.push(`${p.program.name}:`);
    for (const g of p.groups) {
      if (g.state === 'manual') {
        lines.push(`  - ${g.group.title}: not tracked automatically (${g.group.notes ?? 'confirm with advisor'})`);
        continue;
      }
      if (g.group.kind === 'ge') {
        const met = g.state !== 'missing';
        const courses = g.items.map((i) => `${i.code}${i.notes ? ` – ${i.notes}` : ''}${i.issue ? ` (${i.issue})` : ''}`).join(', ');
        lines.push(
          `  - ${g.group.title}: ${met ? `${g.state.replace('_', ' ')} (${courses})` : `MISSING${courses ? `; has ${courses}` : ''}`}` +
            (met ? '' : `; ${g.group.notes ? `${g.group.notes} ` : ''}Real courses that count: ${geExamples(g.group.ge_category ?? '').join('; ')}`),
        );
        continue;
      }
      const missing =
        g.group.kind === 'all'
          ? g.items.filter((i) => i.state === 'missing').map((i) => `${courseLabel(g.group.courses.find((c) => c.code === i.code))}${i.issue ? ` (${i.issue})` : ''}`)
          : [];
      const progress =
        g.group.kind === 'choose_credits' ? `${g.creditsCounted}/${g.creditsNeeded} credits` : `${g.coursesCounted}/${g.coursesNeeded} courses`;
      // Long elective lists (some engineering majors list 70+ courses) are trimmed to keep the prompt short
      const MAX_OPTIONS = 25;
      const listed = g.group.courses.slice(0, MAX_OPTIONS).map(courseLabel).join(', ');
      const more = g.group.courses.length > MAX_OPTIONS ? `, …and ${g.group.courses.length - MAX_OPTIONS} more` : '';
      const options =
        g.group.kind !== 'all' && g.state === 'missing'
          ? `; options: ${listed ? listed + more : ''}${g.group.notes ? `${listed ? '. ' : ''}${g.group.notes}` : ''}`
          : '';
      lines.push(
        `  - ${g.group.title}: ${g.state.replace('_', ' ')} (${progress})${missing.length ? `; still needs ${missing.join(', ')}` : ''}${options}`,
      );
    }
  };
  program(audit.degree);
  if (audit.specializations.length) audit.specializations.forEach(program);
  else if (audit.specializationOptions) lines.push('Specialization: not chosen yet (this degree requires one).');
  if (audit.specializations.length > 1)
    lines.push(`The student has ${audit.specializations.length} specializations (${audit.specializations.map((p) => p.program.name).join(' and ')}); each must be completed.`);
  if (audit.sharedCourses.length)
    lines.push(`Courses counted toward more than one specialization (confirm double-counting with an advisor): ${audit.sharedCourses.join(', ')}.`);
  const c = audit.credits;
  lines.push(`Credits: ${c.earned} earned, ${c.inProgress} in progress, ${c.planned} planned, ${c.required} required.`);
  for (const g of audit.specializationGpas) lines.push(`${g.name} GPA so far: ${g.gpa} (2.00 required).`);
  for (const w of audit.prereqWarnings) lines.push(`Prerequisite warning: ${w.code} (${w.term}) needs ${w.missing.join('; ')} first.`);
  for (const w of audit.scheduleWarnings) lines.push(`${w.blocking ? 'Scheduling problem' : 'Advisor note'}: ${w.message}`);
  return lines.join('\n');
}

// "BUSFIN 4201 (1.5 cr, Spring only)" for the AI prompts
function courseLabel(c: RequirementCourse | undefined): string {
  if (!c) return '';
  const offered = c.offered_terms ?? [];
  const when = offered.includes('None') ? ', not on the current schedule' : offered.length ? `, ${offered.join('/')} only` : '';
  const standing = c.min_standing ? `, ${STANDING_NAMES[c.min_standing] ?? `${c.min_standing}+ hours`} standing` : '';
  return `${c.code} (${c.credits ?? '?'} cr${when}${standing})`;
}

// Requirements a plan still leaves unmet, worded as instructions for fixing the plan.
export function planGaps(audit: DegreeAudit): string[] {
  const gaps: string[] = [];
  for (const p of [audit.degree, ...audit.specializations]) {
    for (const g of p.groups) {
      if (g.state !== 'missing') continue;
      const where = `${p.program.name} – ${g.group.title}`;
      // Prefer options on the current schedule
      const scheduled = g.group.courses.filter((c) => !c.offered_terms?.includes('None'));
      const pool = scheduled.length ? scheduled : g.group.courses;
      const choices = pool.slice(0, 15).map(courseLabel).join(', ') + (pool.length > 15 ? `, or ${pool.length - 15} other approved courses` : '');
      if (g.group.kind === 'ge') {
        const has = g.items.map((i) => `${i.code}: ${i.issue}`).join('; ');
        gaps.push(`${where}: add a real GE course in this category${has ? ` (${has})` : ''}, e.g. ${geExamples(g.group.ge_category ?? '', 4).join('; ')}`);
      } else if (g.group.kind === 'all') {
        // Courses not on the current schedule are left to the advisor rather than forced into a term
        const missing = g.items
          .filter((i) => i.state === 'missing')
          .map((i) => g.group.courses.find((c) => c.code === i.code))
          .filter((c) => !c?.offered_terms?.includes('None'))
          .map(courseLabel);
        if (missing.length) gaps.push(`${where}: add ${missing.join(', ')}`);
      } else if (g.group.kind === 'choose_courses') {
        gaps.push(`${where}: add ${(g.coursesNeeded ?? 1) - g.coursesCounted} more of ${choices}`);
      } else if (g.group.kind === 'choose_credits') {
        const short = (g.creditsNeeded ?? 0) - g.creditsCounted;
        gaps.push(`${where}: add ${short} more credit hours from ${choices || g.group.notes || ''}`);
      }
    }
  }
  for (const w of audit.prereqWarnings) gaps.push(`Move ${w.code} after ${w.missing.join(' and ')} (prerequisites must be in an earlier term)`);
  for (const w of audit.scheduleWarnings) if (w.blocking) gaps.push(w.message);
  const c = audit.credits;
  const total = c.earned + c.inProgress + c.planned;
  if (total < c.required) gaps.push(`Total is ${total} credit hours; add ${c.required - total} more to reach ${c.required} (electives or GE courses)`);
  return gaps;
}

// ---------- What-if: adding a minor ----------

export interface MinorAudit {
  progress: ProgramProgress;
  eligible: boolean;
  ineligibleReason: string | null;
  creditsCounted: number; // toward the minor from classes taken, in progress, or planned
  creditsDone: number;
  creditsRequired: number;
  overlapCodes: string[]; // minor courses that also count toward the BSBA or specialization
  overlapCredits: number;
  overlapTooHigh: boolean; // Fisher: at least 12 credit hours must be distinct from the major
}

export function auditMinor(minor: Program, specializationIds: string[], semesters: Semester[], degreeAudit: DegreeAudit | null): MinorAudit {
  const progress = checkProgram(minor, semesters);
  const excluded = minor.excluded_programs;
  const degree = degreeAudit?.degree.program;
  const degreeId = degree?.id ?? DEFAULT_DEGREE_ID;
  const eligible = !excluded.includes(degreeId) && !specializationIds.some((id) => excluded.includes(id));
  const ineligibleReason = eligible
    ? null
    : excluded.includes(degreeId)
    ? degreeId === DEFAULT_DEGREE_ID
      ? 'This minor is for non-business majors, so Fisher BSBA students can’t add it.'
      : `Students in the ${degree?.name ?? 'your degree'} program can’t add this minor.`
    : 'A minor must be in a different subject than your specialization.';

  // Courses the student's major requirements already use
  const majorCodes = new Set<string>();
  for (const p of [degreeAudit?.degree, ...(degreeAudit?.specializations ?? [])]) {
    for (const g of p?.groups ?? []) for (const i of g.items) if (i.state !== 'missing') majorCodes.add(norm(i.takenAs ?? i.code));
  }

  let creditsCounted = 0;
  let creditsDone = 0;
  let overlapCredits = 0;
  const overlapCodes: string[] = [];
  for (const g of progress.groups) {
    for (const i of g.items) {
      if (i.state === 'missing') continue;
      const cr = Number(i.credits) || 0;
      creditsCounted += cr;
      if (i.state === 'done') creditsDone += cr;
      if (majorCodes.has(norm(i.takenAs ?? i.code))) {
        overlapCredits += cr;
        overlapCodes.push(i.takenAs ?? i.code);
      }
    }
  }
  const creditsRequired = minor.min_total_credits ?? 15;
  return {
    progress,
    eligible,
    ineligibleReason,
    creditsCounted,
    creditsDone,
    creditsRequired,
    overlapCodes,
    overlapCredits,
    overlapTooHigh: creditsRequired - overlapCredits < 12,
  };
}
