// Builds src/data/osuBuildings.json for the After-Hours Study Access tab from public sources:
//   1. OSU buildings feed (content.osu.edu/v2/api/buildings) - every Columbus and Medical Center building,
//      with codes, addresses, map location, departments, accessible entrances and student amenities
//   2. OSU Libraries hours (library.osu.edu/hours) - this week's hours for every library, scraped live
//   3. STUDY_SPOTS below - hours and access rules copied by hand from each building's official page
// Run with: npm run build:campus-data
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_FILE = path.join(__dirname, '..', 'src', 'data', 'osuBuildings.json');
const CAMPUSES = new Set(['Columbus', 'Medical Center']);
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// library.osu.edu location slug -> OSU building number
const LIBRARY_BUILDINGS = {
  '/locations/18th': '005',
  '/locations/architecture': '017',
  '/locations/finearts': '386',
  '/locations/faes': '003',
  '/locations/geology': '060',
  '/node/15607': '302', // Health Sciences Library (Prior Hall)
  '/locations/moritz': '049',
  '/locations/md': '106',
  '/locations/researchcommons': '050',
  '/locations/thompson': '050',
  '/locations/vetmed': '080',
};

// Hand-checked study spots outside the main library hours table. scope says whether the hours cover the
// whole building or just one room/lab inside it. Each one comes from the official page in
// sourceUrl as it read on VERIFIED_ON; update the date whenever you re-check them.
const VERIFIED_ON = '2026-10-28';
const STUDY_SPOTS = [
  {
    building: '161',
    scope: 'building',
    name: 'Ohio Union (whole building)',
    who: 'Everyone',
    hours: [
      'Autumn & spring terms: Mon–Fri 8 a.m.–11 p.m., Sat–Sun 10 a.m.–11 p.m.',
      'Breaks & summer: Mon–Fri 8 a.m.–8 p.m., Sat–Sun 10 a.m.–8 p.m.',
    ],
    access: 'Open to everyone during building hours. Lounges and seating on all floors.',
    closures: 'Closed Thanksgiving (Nov 26–27, 2026; closes 8 p.m. Nov 25) and Dec 24, 2026–Jan 1, 2027. Closes at 8 p.m. on Veterans Day (Nov 10–11, 2026).',
    sourceUrl: 'https://ohiounion.osu.edu/visiting/hours',
  },
  {
    building: '026',
    scope: 'room',
    name: 'CSE Public Computing Lab (Caldwell 112)',
    who: 'All students',
    hours: [
      'Autumn & spring: Mon–Thu 8 a.m.–10 p.m., Fri 8 a.m.–6 p.m., Sat closed, Sun noon–10 p.m.',
      'Summer: Mon–Fri 10 a.m.–5 p.m., Sat closed, Sun noon–5 p.m.',
    ],
    access: 'Public lab.',
    sourceUrl: 'https://cse.osu.edu/about/computing-services/computing-labs/locations-hours',
  },
  {
    building: '279',
    scope: 'room',
    name: 'CSE Majors Lab (Dreese 172)',
    who: 'CSE majors only',
    hours: ['24 hours a day, 7 days a week'],
    access: 'CSE majors get in with their BuckID. If it doesn’t open the room or building, contact the CSE Help Desk.',
    sourceUrl: 'https://cse.osu.edu/about/computing-services/computing-labs/locations-hours',
  },
  {
    building: '252',
    scope: 'room',
    name: 'Fisher Computer Labs (Mason 005 & Mason 010)',
    who: 'Fisher students',
    hours: ['Mon–Thu 7:30 a.m.–9 p.m., Fri 7:30 a.m.–5 p.m., Sat–Sun noon–5 p.m. (staffed hours)'],
    access: 'Student computing labs with printers, staffed by student proctors.',
    closures: 'Fisher labs and buildings are closed for all home football games.',
    sourceUrl: 'https://fisher.osu.edu/technology/computer-labs',
  },
  {
    building: '250',
    scope: 'room',
    name: 'Fisher Graduate Lab (Gerlach 015)',
    who: 'Graduate students',
    hours: ['Any time'],
    access: 'Graduate students get in any time with their BuckID.',
    closures: 'Fisher labs and buildings are closed for all home football games.',
    sourceUrl: 'https://fisher.osu.edu/technology/computer-labs',
  },
  {
    building: '149',
    scope: 'building',
    name: 'Hopkins Hall',
    who: 'Everyone (extended hours for Art students)',
    hours: [
      'Building: Mon–Thu 7 a.m.–6:30 p.m., Fri 7 a.m.–5:30 p.m.',
      'Undergrads taking Art classes in Hopkins: Mon–Sun 7 a.m.–10 p.m. with BuckID (must leave by 11 p.m.)',
    ],
    access: 'Department of Art faculty, staff and graduate students get 24/7 BuckID access.',
    sourceUrl: 'https://art.osu.edu/about/location',
  },
  {
    building: '302',
    scope: 'building',
    name: 'Health Sciences Library (Prior Hall)',
    who: 'Everyone on weekdays; badge holders on weekends',
    hours: ['Mon–Fri 7:30 a.m.–5:30 p.m.', 'Weekends & holidays: badge swipe required'],
    access: 'Public hours on weekdays only. Weekends and holidays need a badge swipe.',
    sourceUrl: 'https://hsl.osu.edu/hours',
  },
];

// Departments in the buildings feed -> the categories students filter by
const CATEGORY_RULES = [
  ['Libraries', (d) => d === 'University Libraries'],
  ['Business', (d) => d === 'Business'],
  ['Engineering', (d) => d === 'Engineering'],
  ['Arts & Humanities', (d) => d === 'Arts and Sciences | Arts and Humanities' || d === 'Wexner Center for the Arts'],
  ['Sciences & Math', (d) => d === 'Arts and Sciences | Natural and Mathematical Sciences'],
  ['Social Sciences & Education', (d) => /Social and Behavioral|Education and Human Ecology|Social Work|John Glenn|Legal Affairs/.test(d)],
  ['Agriculture & Environment', (d) => d.startsWith('FAES')],
  ['Health & Medicine', (d) => /Health|Medicine|Cancer|Nursing|Pharmacy|Dentistry|Optometry|Orthopaedics|OSU Internal|OSUP|GYN/.test(d)],
  ['Student Life & Housing', (d) => d === 'Student Life'],
  ['Athletics & Recreation', (d) => d === 'Athletics'],
  ['Parking & Operations', (d) => /Transportation and Traffic|Facilities Operations|Public Safety|ERIK/.test(d)],
];

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'BuckAI-Team3 student project data build' } });
  if (!res.ok) throw new Error(`${res.status} fetching ${url}`);
  return res.text();
}

const decodeHtml = (s) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function categorize(building, isLibrary) {
  if (isLibrary) return 'Libraries';
  const departments = building.departments ?? [];
  for (const [category, matches] of CATEGORY_RULES) {
    if (category !== 'Libraries' && departments.some(matches)) return category;
  }
  return 'Administration & Other';
}

// Parses the weekly table on library.osu.edu/hours into one entry per library, with its service rows
async function fetchLibraryHours() {
  const html = await fetchText('https://library.osu.edu/hours');
  const head = html.slice(html.indexOf('<thead>'), html.indexOf('</thead>'));
  const dates = [...head.matchAll(/<th scope="col">\s*(\w+day)\s+(\d+)\/(\d+)\/(\d+)\s*<\/th>/g)].map(
    ([, day, m, d, y]) => ({ day, date: `20${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` })
  );
  if (dates.length !== 7) throw new Error('Library hours table layout changed');

  const body = html.slice(html.indexOf('<tbody>'), html.indexOf('</tbody>'));
  const libraries = [];
  for (const row of body.split('<tr>').slice(1)) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
    const link = cells[0]?.match(/href="([^"]+)">([^<]+)<\/a>/);
    const week = cells.slice(2, 9).map((cell, i) => ({ ...dates[i], hours: decodeHtml(cell) || null }));
    if (link) {
      libraries.push({ slug: link[1], name: decodeHtml(link[2]), week, services: [] });
    } else if (libraries.length) {
      libraries[libraries.length - 1].services.push({ name: decodeHtml(cells[1] ?? ''), week });
    }
  }
  return libraries;
}

async function main() {
  console.log('Fetching OSU buildings feed...');
  const { data } = JSON.parse(await fetchText('https://content.osu.edu/v2/api/buildings'));
  console.log('Fetching library hours...');
  const libraries = await fetchLibraryHours();

  const librariesByBuilding = new Map();
  for (const library of libraries) {
    const number = LIBRARY_BUILDINGS[library.slug];
    if (!number) {
      console.warn(`  No building mapped for library ${library.name} (${library.slug})`);
      continue;
    }
    const studyRooms = library.services.filter((s) => /study room/i.test(s.name));
    librariesByBuilding.set(number, [
      ...(librariesByBuilding.get(number) ?? []),
      {
        name: library.name,
        url: `https://library.osu.edu${library.slug}`,
        week: library.week,
        studyRooms: studyRooms.map((s) => ({ name: s.name, week: s.week })),
      },
    ]);
  }

  const buildings = data.buildings
    .filter((b) => CAMPUSES.has(b.campus) && b.name)
    .map((b) => {
      const libs = librariesByBuilding.get(b.buildingNumber) ?? [];
      return {
        id: b.buildingNumber,
        name: b.name.trim(),
        code: b.buildingCode || b.buildingAbbreviation || null,
        campus: b.campus,
        address: b.address ?? null,
        latitude: Number(b.latitude),
        longitude: Number(b.longitude),
        mapUrl: `https://maps.osu.edu/building/?building=${b.buildingNumber}`,
        category: categorize(b, libs.length > 0),
        departments: b.departments ?? [],
        accessibleEntrances: (b.entrances ?? []).filter((e) => e.accessible).map((e) => e.description).filter(Boolean),
        wellnessRooms: (b.wellnessSpaceRooms ?? []).length,
        lactationRooms: (b.lactationRooms ?? []).length,
        genderInclusiveRestrooms: (b.genderInclusiveRestrooms ?? []).length,
        libraries: libs,
        studySpots: STUDY_SPOTS.filter((s) => s.building === b.buildingNumber).map(({ building, ...spot }) => spot),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const spot of STUDY_SPOTS) {
    if (!buildings.some((b) => b.id === spot.building)) console.warn(`  Study spot building ${spot.building} not found`);
  }

  const output = {
    generatedAt: new Date().toISOString(),
    libraryWeek: libraries[0]?.week.map(({ day, date }) => ({ day, date })) ?? [],
    studySpotsVerifiedOn: VERIFIED_ON,
    sources: [
      { name: 'OSU buildings directory', url: 'https://maps.osu.edu' },
      { name: 'OSU Libraries hours', url: 'https://library.osu.edu/hours' },
    ],
    buildings,
  };
  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 1) + '\n');
  const withHours = buildings.filter((b) => b.libraries.length || b.studySpots.length).length;
  console.log(`Wrote ${buildings.length} buildings (${withHours} with published hours) to ${path.relative(process.cwd(), OUT_FILE)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
