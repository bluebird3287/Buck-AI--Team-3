// Server-only: facts about any Ohio State course a student asks the chat about, from the OSU Class Search files
// (src/data/fisherFaculty.json, engineeringFaculty.json, ascFaculty.json). The chat otherwise only sees courses that
// are on the student's schedule or requirement lists, so "who teaches BUSFIN 4221?" or "what are the prereqs for
// BUSMHR 4010?" had no answer. vercel.json includes these files in the serverless function.
import fs from 'fs';
import path from 'path';
import { coursesMentioned } from './courseTitles.js';

interface ClassSearchCourse {
  id: string;
  title?: string;
  description?: string;
  prereq?: string | null;
  credits?: string;
  grading?: string;
  department?: string;
  terms?: { term: string; sections: number; instructionModes: string[] }[];
  instructorIds?: string[];
}
interface ClassSearchFile {
  courses: ClassSearchCourse[];
  faculty: { id: string; name: string; email?: string }[];
}

export interface ReviewSummary {
  count: number;
  overall: number;
  difficulty: number;
  hoursPerWeek: number;
  wouldTakeAgainPercent: number;
  tips: string[];
}

let index: { courses: Map<string, ClassSearchCourse>; people: Map<string, string> } | null = null;

function load() {
  if (index) return index;
  const courses = new Map<string, ClassSearchCourse>();
  const people = new Map<string, string>();
  for (const file of ['fisherFaculty.json', 'engineeringFaculty.json', 'ascFaculty.json']) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src', 'data', file), 'utf8')) as ClassSearchFile;
      for (const c of data.courses) if (!courses.has(c.id)) courses.set(c.id, c);
      for (const f of data.faculty) if (!people.has(f.id)) people.set(f.id, f.name);
    } catch (err) {
      console.warn(`Course facts: couldn't read ${file}`, err);
    }
  }
  index = { courses, people };
  return index;
}

// "BUSFIN 4221" also finds Class Search's "BUSFIN 4221.01"; "ACCTMIS 3200H" falls back to ACCTMIS 3200.
function find(code: string): ClassSearchCourse | undefined {
  const { courses } = load();
  return (
    courses.get(code) ??
    courses.get(code.replace(/[HE]$/, '')) ??
    [...courses.values()].find((c) => c.id.startsWith(`${code}.`))
  );
}

// Course codes named in a piece of text (the student's message plus recent conversation), most recent first.
export function codesIn(text: string, max = 8): string[] {
  return coursesMentioned(text).slice(-max).reverse();
}

// One line per course: title, credits, when it's offered (sections and format), instructors, prerequisites,
// a short description, and BuckAI student reviews when there are any.
export function describeCourses(codes: string[], reviews: Record<string, ReviewSummary> = {}): string {
  const { people } = load();
  const lines: string[] = [];
  for (const code of codes) {
    const c = find(code);
    const r = reviews[code] ?? (c ? reviews[c.id] : undefined);
    if (!c) {
      lines.push(`- ${code}: not on the Autumn 2026 or Spring 2027 schedule (no Class Search data). Don't invent details; suggest the Course Bulletin or their advisor.`);
      continue;
    }
    const offered = (c.terms ?? []).map((t) => `${t.term} (${t.sections} section${t.sections === 1 ? '' : 's'}; ${t.instructionModes.join(', ')})`).join('; ');
    const instructors = (c.instructorIds ?? []).map((id) => people.get(id)).filter(Boolean);
    const parts = [
      `${c.id} ${c.title ?? ''}`.trim(),
      `${c.credits ?? '?'} credit hours${c.grading && c.grading !== 'Graded' ? `, ${c.grading}` : ''}`,
      c.department ? `department: ${c.department}` : '',
      `offered: ${offered || 'not on the Autumn 2026 / Spring 2027 schedule'}`,
      `instructors: ${instructors.length ? instructors.slice(0, 8).join(', ') + (instructors.length > 8 ? ` and ${instructors.length - 8} more` : '') : 'not listed (TBA or staff)'}`,
      `prerequisites: ${c.prereq ? `${c.prereq} (bare course numbers are ${c.id.split(' ')[0]} courses)` : 'none listed in Class Search'}`,
      c.description ? `about: ${c.description.replace(/\s*Prereq:.*$/s, '').slice(0, 260)}` : '',
      r
        ? `BuckAI student reviews: ${r.count} review${r.count === 1 ? '' : 's'}, overall ${r.overall.toFixed(1)}/5, difficulty ${r.difficulty.toFixed(1)}/5, about ${Math.round(r.hoursPerWeek)} hours/week, ${r.wouldTakeAgainPercent}% would take again${r.tips.length ? `; tips: ${r.tips.map((t) => `"${t}"`).join(' ')}` : ''}`
        : 'BuckAI student reviews: none yet',
    ].filter(Boolean);
    lines.push(`- ${parts.join(' | ')}`);
  }
  return lines.join('\n');
}

// Review rows (public faculty_reviews) summarized per course.
export function summarizeReviews(
  rows: { course_id: string; overall: number; difficulty: number; hours_per_week: number; would_take_again: boolean; tip: string | null }[],
): Record<string, ReviewSummary> {
  const by = new Map<string, typeof rows>();
  for (const r of rows) by.set(r.course_id, [...(by.get(r.course_id) ?? []), r]);
  const out: Record<string, ReviewSummary> = {};
  for (const [course, list] of by) {
    const avg = (f: (r: (typeof rows)[number]) => number) => list.reduce((n, r) => n + f(r), 0) / list.length;
    out[course] = {
      count: list.length,
      overall: avg((r) => r.overall),
      difficulty: avg((r) => r.difficulty),
      hoursPerWeek: avg((r) => r.hours_per_week),
      wouldTakeAgainPercent: Math.round((list.filter((r) => r.would_take_again).length / list.length) * 100),
      tips: list.map((r) => r.tip?.trim()).filter((t): t is string => !!t).slice(-3),
    };
  }
  return out;
}
