// Builds each college's faculty file (src/data/fisherFaculty.json, src/data/engineeringFaculty.json)
// from public sources:
//   1. OSU Class Search API (content.osu.edu) - every undergraduate course, section and instructor
//      (Arts and Sciences: every course the registrar lists under the "Arts and Sciences" academic program)
//   2. Fisher College of Business directory (fisher.osu.edu/directory) - Fisher faculty titles and departments
//      (the College of Engineering directory blocks automated requests, so Engineering has no titles)
// Run with: npm run build:fisher-data            (Fisher)
//           npm run build:engineering-data (College of Engineering, including the Knowlton School)
//           npm run build:asc-data         (College of Arts and Sciences)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TERMS = [
  { code: '1268', name: 'Autumn 2026' },
  { code: '1272', name: 'Spring 2027' },
];
const COLLEGES = {
  fisher: {
    name: 'Fisher College of Business',
    outFile: 'fisherFaculty.json',
    directory: true,
    subjects: {
      ACCTMIS: 'Accounting & Management Information Systems',
      BUSADM: 'Business Administration',
      BUSFIN: 'Finance',
      BUSMHR: 'Management & Human Resources',
      BUSML: 'Marketing & Logistics',
      BUSOBA: 'Operations and Business Analytics',
    },
  },
  engineering: {
    name: 'College of Engineering',
    outFile: 'engineeringFaculty.json',
    directory: false,
    subjects: {
      AEROENG: 'Aerospace Engineering',
      ARCH: 'Architecture (Knowlton School)',
      AVIATN: 'Aviation',
      BIOMEDE: 'Biomedical Engineering',
      CBE: 'Chemical & Biomolecular Engineering',
      CIVILEN: 'Civil, Environmental & Geodetic Engineering',
      CRPLAN: 'City & Regional Planning (Knowlton School)',
      CSE: 'Computer Science & Engineering',
      ECE: 'Electrical & Computer Engineering',
      ENGR: 'Engineering (First-Year & General)',
      ENGREDU: 'Engineering Education',
      FABENG: 'Food, Agricultural & Biological Engineering',
      ISE: 'Integrated Systems Engineering',
      LARCH: 'Landscape Architecture (Knowlton School)',
      MATSCEN: 'Materials Science & Engineering',
      MECHENG: 'Mechanical Engineering',
      NUCLREN: 'Nuclear Engineering',
      WELDENG: 'Welding Engineering',
    },
  },
  asc: {
    name: 'College of Arts and Sciences',
    outFile: 'ascFaculty.json',
    directory: false,
    // About 80 subjects, so the registrar's own "Arts and Sciences" program filter is used instead of a subject list;
    // `subjects` only names each subject's department (subjects not listed use the registrar's subject name).
    academicProgram: 'asc',
    subjects: {
      ACCAD: 'Advanced Computing Center for the Arts and Design',
      AFAMAST: 'African American and African Studies',
      AMINSTS: 'American Indian Studies',
      ANTHROP: 'Anthropology',
      ARABIC: 'Near Eastern and South Asian Languages and Cultures',
      ART: 'Art',
      ARTEDUC: 'Arts Administration, Education and Policy',
      ARTSSCI: 'Arts and Sciences',
      ASAMSTS: 'Asian American Studies',
      ASL: 'American Sign Language',
      ASTRON: 'Astronomy',
      ATMOSSC: 'Atmospheric Sciences',
      BCS: 'Slavic and East European Languages and Cultures',
      BIOCHEM: 'Chemistry and Biochemistry',
      BIOLOGY: 'Center for Life Sciences Education',
      CHEM: 'Chemistry and Biochemistry',
      CHINESE: 'East Asian Languages and Literatures',
      CLAS: 'Classics',
      COMM: 'Communication',
      COMPSTD: 'Comparative Studies',
      CSTW: 'Center for the Study and Teaching of Writing',
      CZECH: 'Slavic and East European Languages and Cultures',
      DANCE: 'Dance',
      DESIGN: 'Design',
      DSABLST: 'Disability Studies',
      EALL: 'East Asian Languages and Literatures',
      EARTHSC: 'Earth Sciences',
      ECON: 'Economics',
      EEOB: 'Evolution, Ecology and Organismal Biology',
      ENGLISH: 'English',
      ETHNSTD: 'Center for Ethnic Studies',
      FILMSTD: 'Film Studies',
      FRENCH: 'French and Italian',
      FRIT: 'French and Italian',
      GEOG: 'Geography',
      GERMAN: 'Germanic Languages and Literatures',
      GREEK: 'Classics',
      HEBREW: 'Near Eastern and South Asian Languages and Cultures',
      HINDI: 'Near Eastern and South Asian Languages and Cultures',
      HISTART: 'History of Art',
      HISTORY: 'History',
      INTSTDS: 'International Studies',
      ISLAM: 'Near Eastern and South Asian Languages and Cultures',
      ITALIAN: 'French and Italian',
      JAPANSE: 'East Asian Languages and Literatures',
      JEWSHST: 'Melton Center for Jewish Studies',
      KOREAN: 'East Asian Languages and Literatures',
      LATIN: 'Classics',
      LING: 'Linguistics',
      MATH: 'Mathematics',
      MDRNGRK: 'Classics',
      MEDREN: 'Medieval and Renaissance Studies',
      MICRBIO: 'Microbiology',
      MOLGEN: 'Molecular Genetics',
      MUSIC: 'School of Music',
      MVNGIMG: 'Theatre, Film, and Media Arts',
      NELC: 'Near Eastern and South Asian Languages and Cultures',
      NRO: 'Neuroscience',
      PERSIAN: 'Near Eastern and South Asian Languages and Cultures',
      PHILOS: 'Philosophy',
      PHYSICS: 'Physics',
      POLISH: 'Slavic and East European Languages and Cultures',
      POLITSC: 'Political Science',
      PORTGSE: 'Spanish and Portuguese',
      PSYCH: 'Psychology',
      RELSTDS: 'Comparative Studies',
      RUSSIAN: 'Slavic and East European Languages and Cultures',
      SASIA: 'Near Eastern and South Asian Languages and Cultures',
      SCANDVN: 'Germanic Languages and Literatures',
      SLAVIC: 'Slavic and East European Languages and Cultures',
      SOCIOL: 'Sociology',
      SOMALI: 'African American and African Studies',
      SPANISH: 'Spanish and Portuguese',
      SPHHRNG: 'Speech and Hearing Science',
      STAT: 'Statistics',
      SWAHILI: 'African American and African Studies',
      SWEDISH: 'Germanic Languages and Literatures',
      THEATRE: 'Theatre, Film, and Media Arts',
      TURKISH: 'Near Eastern and South Asian Languages and Cultures',
      URDU: 'Near Eastern and South Asian Languages and Cultures',
      UZBEK: 'Near Eastern and South Asian Languages and Cultures',
      WGSST: "Women's, Gender and Sexuality Studies",
      YIDDISH: 'Germanic Languages and Literatures',
    },
  },
};
const COLLEGE = COLLEGES[process.argv[2] ?? 'fisher'];
if (!COLLEGE) throw new Error(`Unknown college "${process.argv[2]}"; use one of: ${Object.keys(COLLEGES).join(', ')}`);
const OUT_FILE = path.join(__dirname, '..', 'src', 'data', COLLEGE.outFile);
const SUBJECT_DEPARTMENT = COLLEGE.subjects;
// Recitations are usually led by graduate teaching assistants, not faculty
const SKIPPED_COMPONENTS = new Set(['Recitation']);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'BuckAI-Team3 student project data build' } });
  if (!res.ok) throw new Error(`${res.status} fetching ${url}`);
  return res.text();
}

async function fetchClassSearch(term, subject, academicProgram) {
  const results = [];
  const filter = academicProgram ? `academic-program=${academicProgram}` : `subject=${subject}`;
  for (let page = 1; ; page++) {
    const url = `https://content.osu.edu/v2/classes/search?q=&campus=col&academic-career=ugrd&term=${term}&${filter}&p=${page}`;
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
  let directory = new Map();
  if (COLLEGE.directory) {
    console.log('Fetching Fisher faculty directory...');
    directory = await fetchDirectory();
    console.log(`  ${directory.size} faculty members`);
  }

  const courses = new Map();
  const faculty = new Map();

  for (const term of TERMS) {
    const queries = COLLEGE.academicProgram ? [null] : Object.keys(SUBJECT_DEPARTMENT).map((s) => s.toLowerCase());
    for (const subject of queries) {
      console.log(`Fetching ${term.name} ${subject ? subject.toUpperCase() : COLLEGE.name}...`);
      for (const { course, sections } of await fetchClassSearch(term.code, subject, COLLEGE.academicProgram)) {
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
          department: SUBJECT_DEPARTMENT[course.subject] ?? course.subjectDesc ?? course.subject,
          terms: [],
          instructorIds: [],
        };
        courses.set(courseId, entry);

        // A course can come back more than once in a term (one result per offering); merge them
        const termEntry = entry.terms.find((t) => t.term === term.name) ?? { term: term.name, sections: 0, instructionModes: [] };
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
        if (termEntry.sections > 0 && !entry.terms.includes(termEntry)) entry.terms.push(termEntry);
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
    college: COLLEGE.name,
    terms: TERMS.map((t) => t.name),
    sources: [
      { name: 'OSU Class Search', url: 'https://classes.osu.edu' },
      ...(COLLEGE.directory ? [{ name: 'Fisher College of Business Directory', url: 'https://fisher.osu.edu/directory' }] : []),
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
