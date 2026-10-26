import { supabase } from './supabase';
import { Course, Semester } from '../data/sampleData';

// ---------- Curriculum (public tables: programs, requirement_groups, requirement_courses) ----------

export interface RequirementCourse {
  code: string;
  title: string;
  credits: number | null;
  prerequisites: string | null;
  min_grade: string | null;
  alternates: string[]; // codes Fisher officially accepts
  equivalents: string[]; // codes that may substitute; confirm with advisor
  is_secondary: boolean;
  notes: string | null;
}

export interface RequirementGroup {
  id: string;
  title: string;
  kind: 'all' | 'choose_courses' | 'choose_credits' | 'manual';
  min_courses: number | null;
  min_credits: number | null;
  max_secondary_credits: number | null;
  code_pattern: string | null;
  exclude_codes: string[];
  notes: string | null;
  courses: RequirementCourse[];
}

export interface Program {
  id: string;
  kind: 'degree' | 'specialization';
  name: string;
  catalog: string;
  min_total_credits: number | null;
  min_gpa: number | null;
  notes: string | null;
  source_url: string | null;
  groups: RequirementGroup[];
}

export interface Curriculum {
  degree: Program;
  specializations: Program[];
}

export async function loadCurriculum(): Promise<Curriculum> {
  const [programs, groups, courses] = await Promise.all([
    supabase.from('programs').select('id, kind, name, catalog, min_total_credits, min_gpa, notes, source_url').order('sort_order'),
    supabase
      .from('requirement_groups')
      .select('id, program_id, title, kind, min_courses, min_credits, max_secondary_credits, code_pattern, exclude_codes, notes')
      .order('sort_order'),
    supabase
      .from('requirement_courses')
      .select('group_id, code, title, credits, prerequisites, min_grade, alternates, equivalents, is_secondary, notes')
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
  const degree = all.find((p) => p.kind === 'degree');
  if (!degree) throw new Error('Curriculum is missing the BSBA degree program.');
  return { degree, specializations: all.filter((p) => p.kind === 'specialization') };
}

// Best guess at a specialization from free text such as "Finance (BS Business Admin)".
export function guessSpecialization(curriculum: Curriculum, major: string): string | null {
  const text = major.toLowerCase();
  const hit = curriculum.specializations.find((p) => text.includes(p.name.split(' (')[0].toLowerCase()));
  return hit?.id ?? null;
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
  return {
    code: req.code,
    title: req.title,
    credits: req.credits ?? t.credits,
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
    const c = req.credits ?? m.t.credits;
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
  return { program, groups: program.groups.map((g) => checkGroup(g, taken, used)) };
}

// ---------- Prerequisites for current and planned classes ----------

export interface PrereqWarning {
  code: string;
  term: string;
  missing: string[];
}

// Turns "BUSMHR 2000, 2292; ECON 2001 & ECON 2002; MATH 1131/1151 or 1161" into clauses, each a list
// of codes where any one satisfies it. Clauses that allow concurrent enrollment or name no course
// (standing, placement, permission) are skipped; rules too tangled to read ("...; or ...") return null.
function parsePrereqs(text: string): string[][] | null {
  const parts = text.split(';').map((p) => p.trim()).filter(Boolean);
  if (parts.some((p) => /^or\b/i.test(p))) return null;
  const clauses: string[][] = [];
  for (const part of parts) {
    for (const clause of part.split(/\s*&\s*|\s+and\s+/i)) {
      if (!clause || /concur/i.test(clause)) continue;
      const codes: string[] = [];
      let dept = '';
      for (const m of clause.matchAll(/\b([A-Z]{3,8})\s+(\d{4}(?:\.\d{2})?H?)|\b(\d{4}(?:\.\d{2})?H?)\b/g)) {
        if (m[1]) dept = m[1];
        const num = m[2] ?? m[3];
        if (dept && num) codes.push(`${dept} ${num}`);
      }
      if (!codes.length) continue;
      if (/\bor\b|\//i.test(clause)) clauses.push(codes);
      else clauses.push(...codes.map((code) => [code]));
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
        (anyOf) =>
          !anyOf.some((code) =>
            taken.some(
              (x) =>
                x.termIndex < t.termIndex &&
                (baseCode(code) === baseCode(x.code) ||
                  (equivalents.get(baseCode(code)) ?? []).some((e) => baseCode(e) === baseCode(x.code))) &&
                (x.state !== 'done' || passes(x.grade, null)),
            ),
          ),
      )
      .map((anyOf) => anyOf.join(' or '));
    if (missing.length) warnings.push({ code: t.code, term: t.term, missing });
  }
  return warnings;
}

// ---------- Whole-degree summary ----------

export interface DegreeAudit {
  degree: ProgramProgress;
  specialization: ProgramProgress | null;
  prereqWarnings: PrereqWarning[];
  credits: { earned: number; inProgress: number; planned: number; required: number };
  specializationGpa: number | null;
}

export function auditDegree(
  curriculum: Curriculum,
  specializationId: string | null,
  semesters: Semester[],
  earnedCredits: number,
): DegreeAudit {
  const spec = curriculum.specializations.find((p) => p.id === specializationId) ?? null;
  const specProgress = spec ? checkProgram(spec, semesters) : null;

  let points = 0;
  let hours = 0;
  for (const g of specProgress?.groups ?? []) {
    for (const item of g.items) {
      if (item.state !== 'done') continue;
      const course = semesters.flatMap((s) => s.courses).find((c) => norm(c.code) === norm(item.takenAs ?? item.code));
      const grade = course ? courseGrade(course)?.toUpperCase() : null;
      if (grade && grade in GRADE_POINTS) {
        points += GRADE_POINTS[grade] * (Number(course!.credits) || 0);
        hours += Number(course!.credits) || 0;
      }
    }
  }
  const sum = (status: Semester['status']) =>
    semesters.filter((s) => s.status === status).reduce((n, s) => n + s.courses.reduce((m, c) => m + (Number(c.credits) || 0), 0), 0);

  return {
    degree: checkProgram(curriculum.degree, semesters),
    specialization: specProgress,
    prereqWarnings: checkPrerequisites(curriculum, semesters),
    credits: {
      earned: earnedCredits,
      inProgress: sum('in-progress'),
      planned: sum('planned'),
      required: curriculum.degree.min_total_credits ?? 121,
    },
    specializationGpa: hours ? Math.round((points / hours) * 100) / 100 : null,
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
      const missing =
        g.group.kind === 'all'
          ? g.items.filter((i) => i.state === 'missing').map((i) => `${i.code}${i.issue ? ` (${i.issue})` : ''}`)
          : [];
      const progress =
        g.group.kind === 'choose_credits'
          ? `${g.creditsCounted}/${g.creditsNeeded} credits`
          : g.group.kind === 'choose_courses'
          ? `${g.coursesCounted}/${g.coursesNeeded} courses`
          : `${g.coursesCounted}/${g.coursesNeeded} courses`;
      const options =
        g.group.kind !== 'all' && g.state === 'missing'
          ? `; options: ${g.group.courses.map((c) => c.code).join(', ') || g.group.notes}`
          : '';
      lines.push(
        `  - ${g.group.title}: ${g.state.replace('_', ' ')} (${progress})${missing.length ? `; still needs ${missing.join(', ')}` : ''}${options}`,
      );
    }
  };
  program(audit.degree);
  if (audit.specialization) program(audit.specialization);
  else lines.push('Specialization: not chosen yet.');
  const c = audit.credits;
  lines.push(`Credits: ${c.earned} earned, ${c.inProgress} in progress, ${c.planned} planned, ${c.required} required.`);
  if (audit.specializationGpa != null) lines.push(`Specialization GPA so far: ${audit.specializationGpa} (2.00 required).`);
  for (const w of audit.prereqWarnings) lines.push(`Prerequisite warning: ${w.code} (${w.term}) needs ${w.missing.join('; ')} first.`);
  return lines.join('\n');
}

// Requirements a plan still leaves unmet, worded as instructions for fixing the plan.
// Manual (GE choice) groups are left out because course codes can't show them.
export function planGaps(audit: DegreeAudit): string[] {
  const gaps: string[] = [];
  for (const p of [audit.degree, audit.specialization]) {
    for (const g of p?.groups ?? []) {
      if (g.state !== 'missing') continue;
      const where = `${p!.program.name} – ${g.group.title}`;
      if (g.group.kind === 'all') {
        const missing = g.items.filter((i) => i.state === 'missing').map((i) => i.code);
        gaps.push(`${where}: add ${missing.join(', ')}`);
      } else if (g.group.kind === 'choose_courses') {
        gaps.push(`${where}: add ${(g.coursesNeeded ?? 1) - g.coursesCounted} more of ${g.group.courses.map((c) => c.code).join(', ')}`);
      } else {
        const short = (g.creditsNeeded ?? 0) - g.creditsCounted;
        const options = g.group.courses.length
          ? g.group.courses.map((c) => `${c.code} (${c.credits ?? '?'} cr)`).join(', ')
          : g.group.notes ?? '';
        gaps.push(`${where}: add ${short} more credit hours from ${options}`);
      }
    }
  }
  for (const w of audit.prereqWarnings) gaps.push(`Move ${w.code} after ${w.missing.join(' and ')} (prerequisites must be in an earlier term)`);
  const c = audit.credits;
  const total = c.earned + c.inProgress + c.planned;
  if (total < c.required) gaps.push(`Total is ${total} credit hours; add ${c.required - total} more to reach ${c.required} (electives or GE courses)`);
  return gaps;
}
