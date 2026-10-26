// Builds src/data/fisherFaculty.json from two public sources:
//   1. OSU Class Search API (content.osu.edu) - every undergraduate Fisher course, section and instructor
//   2. Fisher College of Business directory (fisher.osu.edu/directory) - faculty titles and departments
// Run with: npm run build:fisher-data
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_FILE = path.join(__dirname, '..', 'src', 'data', 'fisherFaculty.json');

const TERMS = [
  { code: '1268', name: 'Autumn 2026' },
  { code: '1272', name: 'Spring 2027' },
];
const FISHER_SUBJECTS = ['acctmis', 'busadm', 'busfin', 'busmhr', 'busml', 'busoba'];
const SUBJECT_DEPARTMENT = {
  ACCTMIS: 'Accounting & Management Information Systems',
  BUSADM: 'Business Administration',
  BUSFIN: 'Finance',
  BUSMHR: 'Management & Human Resources',
  BUSML: 'Marketing & Logistics',
  BUSOBA: 'Operations and Business Analytics',
};
// Recitations are usually led by graduate teaching assistants, not faculty
const SKIPPED_COMPONENTS = new Set(['Recitation']);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'BuckAI-Team3 student project data build' } });
  if (!res.ok) throw new Error(`${res.status} fetching ${url}`);
  return res.text();
}

async function fetchClassSearch(term, subject) {
  const results = [];
  for (let page = 1; ; page++) {
    const url = `https://content.osu.edu/v2/classes/search?q=&campus=col&academic-career=ugrd&term=${term}&subject=${subject}&p=${page}`;
    const { data } = JSON.parse(await fetchText(url));
    results.push(...data.courses);
    if (page >= data.totalPages) return results;
    await sleep(300);
  }
}

const decodeHtml = (s) =>
  s.replace(/&amp;/g, '&').replace(/&#0?39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

async function fetchDirectory() {
  const people = new Map();
  for (let page = 0; ; page++) {
    const html = await fetchText(`https://fisher.osu.edu/directory?type=faculty_member&page=${page}`);
    const blocks = html.split('<div class="bux-person">').slice(1);
    if (blocks.length === 0) return people;
    for (const block of blocks) {
      const link = block.match(/href="\/people\/([^"]+)">([^<]+)<\/a>/);
      if (!link) continue;
      const id = link[1].toLowerCase();
      people.set(id, {
        id,
        name: decodeHtml(link[2]),
        title: decodeHtml(block.match(/bux-person__title">([^<]*)</)?.[1] ?? ''),
        department: decodeHtml(block.match(/uppercase-gray">([^<]*)</)?.[1] ?? ''),
        profileUrl: `https://fisher.osu.edu/people/${link[1]}`,
      });
    }
    await sleep(300);
  }
}

// Class Search display names can repeat words or arrive in all caps ("Annette Annette Beatty", "John RICHARD Barton")
function cleanDisplayName(name) {
  return name
    .split(/\s+/)
    .filter((word, i, words) => word.toLowerCase() !== words[i - 1]?.toLowerCase())
    .map((word) => (word.length > 1 && word === word.toUpperCase() ? word[0] + word.slice(1).toLowerCase() : word))
    .join(' ');
}

function extractPrereq(description) {
  const match = description.match(/Prereq:\s*(.*?)(?:\.\s|\.$|$)/s);
  return match ? match[1].trim() : null;
}

async function main() {
  console.log('Fetching Fisher faculty directory...');
  const directory = await fetchDirectory();
  console.log(`  ${directory.size} faculty members`);

  const courses = new Map();
  const faculty = new Map();

  for (const term of TERMS) {
    for (const subject of FISHER_SUBJECTS) {
      console.log(`Fetching ${term.name} ${subject.toUpperCase()}...`);
      for (const { course, sections } of await fetchClassSearch(term.code, subject)) {
        const courseId = `${course.subject} ${course.catalogNumber}`;
        const entry = courses.get(courseId) ?? {
          id: courseId,
          subject: course.subject,
          catalogNumber: course.catalogNumber,
          title: course.title,
          description: course.description.replace(/\r\n/g, ' ').trim(),
          prereq: extractPrereq(course.description),
          credits: course.minUnits === course.maxUnits ? `${course.minUnits}` : `${course.minUnits}-${course.maxUnits}`,
          grading: course.grading,
          department: SUBJECT_DEPARTMENT[course.subject] ?? course.subjectDesc,
          terms: [],
          instructorIds: [],
        };
        courses.set(courseId, entry);

        const termEntry = { term: term.name, sections: 0, instructionModes: [] };
        for (const section of sections) {
          if (SKIPPED_COMPONENTS.has(section.component) || section.cancelDate) continue;
          termEntry.sections++;
          if (!termEntry.instructionModes.includes(section.instructionMode)) {
            termEntry.instructionModes.push(section.instructionMode);
          }
          for (const meeting of section.meetings) {
            for (const instructor of meeting.instructors ?? []) {
              if (!instructor.email) continue;
              const id = instructor.email.replace(/@osu\.edu$/i, '').toLowerCase();
              const listed = directory.get(id);
              const person = faculty.get(id) ?? {
                id,
                name: listed?.name ?? cleanDisplayName(instructor.displayName),
                title: listed?.title ?? null,
                department: listed?.department || entry.department,
                email: instructor.email.toLowerCase(),
                profileUrl: listed?.profileUrl ?? null,
                courseIds: [],
                terms: [],
              };
              if (!person.courseIds.includes(courseId)) person.courseIds.push(courseId);
              if (!person.terms.includes(term.name)) person.terms.push(term.name);
              faculty.set(id, person);
              if (!entry.instructorIds.includes(id)) entry.instructorIds.push(id);
            }
          }
        }
        if (termEntry.sections > 0) entry.terms.push(termEntry);
      }
      await sleep(300);
    }
  }

  const sortedCourses = [...courses.values()]
    .filter((c) => c.terms.length > 0)
    .sort((a, b) => a.subject.localeCompare(b.subject) || a.catalogNumber.localeCompare(b.catalogNumber, undefined, { numeric: true }));
  const sortedFaculty = [...faculty.values()].sort((a, b) => {
    const lastA = a.name.split(' ').pop();
    const lastB = b.name.split(' ').pop();
    return lastA.localeCompare(lastB) || a.name.localeCompare(b.name);
  });

  const output = {
    generatedAt: new Date().toISOString(),
    terms: TERMS.map((t) => t.name),
    sources: [
      { name: 'OSU Class Search', url: 'https://classes.osu.edu' },
      { name: 'Fisher College of Business Directory', url: 'https://fisher.osu.edu/directory' },
    ],
    faculty: sortedFaculty,
    courses: sortedCourses,
  };
  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 1) + '\n');
  console.log(`Wrote ${sortedFaculty.length} instructors and ${sortedCourses.length} courses to ${path.relative(process.cwd(), OUT_FILE)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
