import { supabase } from './supabase';

// Who grants after-hours BuckID access to each building. The BuckID office issues cards but
// doesn't grant door access; the department or college that runs a building does, through its
// building manager or coordinator. Contacts come from official OSU pages (checked Nov 1, 2026).
// `verified` = that page says this contact handles access for the building. Otherwise it's the
// college's facilities or student-services contact, and students are told to confirm.

export interface AccessOffice {
  id: string;
  name: string;
  email: string;
  phone?: string;
  location?: string;
  note?: string;
  formUrl?: string;
  sourceUrl: string;
  verified: boolean;
}

export const ACCESS_OFFICES: Record<string, AccessOffice> = {
  'eng-dreese-baker': {
    id: 'eng-dreese-baker',
    name: 'Peter Chapman, Engineering Building Manager (Dreese, Caldwell, Baker Systems)',
    email: 'chapman.192@osu.edu',
    phone: '614-292-4411',
    note: 'CSE majors get Dreese and Caldwell access automatically; if your card fails, go to the CSE Main Office, 395 Dreese Labs. ISE has a room access request form for Baker Systems.',
    formUrl: 'https://ise.osu.edu/facility/computing-labs/buck-id-access',
    sourceUrl: 'https://engineering.osu.edu/facilities-about',
    verified: true,
  },
  'eng-scott': {
    id: 'eng-scott',
    name: 'Jeff La Parre, Scott Laboratory Building Manager',
    email: 'laparre.1@osu.edu',
    phone: '614-292-4544',
    sourceUrl: 'https://engineering.osu.edu/facilities-about',
    verified: true,
  },
  'eng-bolz-hitchcock': {
    id: 'eng-bolz-hitchcock',
    name: 'Ryan Ash, Bolz Hall and Hitchcock Hall Building Manager',
    email: 'ash.82@osu.edu',
    phone: '614-247-5648',
    note: 'Civil, Environmental and Geodetic Engineering spaces also need your advisor’s approval on the CEGE swipe-access form.',
    formUrl: 'https://ceg.osu.edu/resources/administrative-services/building-and-laboratory-access-requests',
    sourceUrl: 'https://engineering.osu.edu/facilities-about',
    verified: true,
  },
  'eng-smith': {
    id: 'eng-smith',
    name: 'Lance Kearns, Smith Laboratory and CBEC Building Manager',
    email: 'kearns.157@osu.edu',
    phone: '614-247-8118',
    sourceUrl: 'https://engineering.osu.edu/facilities-about',
    verified: true,
  },
  'eng-fontana': {
    id: 'eng-fontana',
    name: 'Judah Stadler, Fontana Labs Building Manager',
    email: 'stadler.50@osu.edu',
    note: 'Materials Science and Engineering also has a BuckID key card access request form for Fontana Labs.',
    sourceUrl: 'https://engineering.osu.edu/facilities-about',
    verified: true,
  },
  'eng-facilities': {
    id: 'eng-facilities',
    name: 'Mark Scott, College of Engineering Facilities Manager',
    email: 'scott.95@osu.edu',
    phone: '614-292-3611',
    sourceUrl: 'https://engineering.osu.edu/facilities-about',
    verified: false,
  },
  'earth-sciences': {
    id: 'earth-sciences',
    name: 'School of Earth Sciences BuckID Access',
    email: 'ses-buckid@osu.edu',
    phone: '614-292-2721',
    note: 'The school also has an online "Request Department BuckID Access" form for students.',
    formUrl: 'https://earthsciences.osu.edu/internal/buckid-access',
    sourceUrl: 'https://earthsciences.osu.edu/internal/buckid-access',
    verified: true,
  },
  chemistry: {
    id: 'chemistry',
    name: 'Chemistry and Biochemistry Facilities Management (building coordinators)',
    email: 'cbc-facilities-management@osu.edu',
    sourceUrl: 'https://chemistry.osu.edu/facilities',
    verified: true,
  },
  'asc-facilities': {
    id: 'asc-facilities',
    name: 'Ronald Filippelli, Arts and Sciences Director of Facilities Management',
    email: 'filippelli.2@osu.edu',
    note: 'Arts and Sciences departments manage their own buildings; the facilities office can point you to the building coordinator.',
    sourceUrl: 'https://artsandsciences.osu.edu/people',
    verified: false,
  },
  cfaes: {
    id: 'cfaes',
    name: 'CFAES Access Management',
    email: 'cfaesaccessmanagement@osu.edu',
    sourceUrl: 'https://fod.osu.edu/pam',
    verified: true,
  },
  'student-life': {
    id: 'student-life',
    name: 'Student Life Facilities, Keys and Access',
    email: 'sl-keys@osu.edu',
    sourceUrl: 'https://fod.osu.edu/pam',
    verified: true,
  },
  'medical-center': {
    id: 'medical-center',
    name: 'Wexner Medical Center Security (access managers)',
    email: 'security_managers@osumc.edu',
    sourceUrl: 'https://fod.osu.edu/pam',
    verified: true,
  },
  fisher: {
    id: 'fisher',
    name: 'Nicholas Christen, Fisher Director of Facilities Operations',
    email: 'christen.7@osu.edu',
    phone: '614-292-7462',
    location: '030 Fisher Hall',
    sourceUrl: 'https://fisher.osu.edu/people/christen.7',
    verified: false,
  },
  knowlton: {
    id: 'knowlton',
    name: 'Knowlton School Student Services',
    email: 'knowlton@osu.edu',
    phone: '614-292-1012',
    location: '100 Knowlton Hall',
    note: 'Knowlton School students already have 24/7 BuckID access to Knowlton Hall.',
    sourceUrl: 'https://knowlton.osu.edu/facilities',
    verified: false,
  },
  glenn: {
    id: 'glenn',
    name: 'John Glenn College Help (Page Hall BuckID access)',
    email: 'Glenn-Help@osu.edu',
    phone: '614-292-8696',
    note: 'Only Glenn College students, faculty and staff get Page Hall card access.',
    sourceUrl: 'https://glenn.osu.edu/quick-links/key-policy',
    verified: true,
  },
  moritz: {
    id: 'moritz',
    name: 'Moritz College of Law Help Desk',
    email: 'moritzhelp@osu.edu',
    location: '282 Drinko Hall',
    sourceUrl: 'https://law.osu.edu/directory/',
    verified: false,
  },
  'public-health': {
    id: 'public-health',
    name: 'College of Public Health Facilities',
    email: 'CPH-Facilities@osu.edu',
    phone: '614-292-8350',
    location: '100 Cunz Hall (paper form)',
    sourceUrl: 'https://cph.osu.edu/students/graduate/student-handbook/general-information/buckid',
    verified: true,
  },
  nursing: {
    id: 'nursing',
    name: 'College of Nursing Office of Student Affairs and Success',
    email: 'nursing@osu.edu',
    phone: '614-292-4041',
    location: '106 Newton Hall',
    sourceUrl: 'https://nursing.osu.edu/',
    verified: false,
  },
  music: {
    id: 'music',
    name: 'Arts and Sciences Facilities Management (School of Music buildings)',
    email: 'filippelli.2@osu.edu',
    note: 'Non-music majors don’t get after-hours access to the music building. Ask Arts and Sciences Facilities to confirm.',
    sourceUrl: 'https://music.osu.edu/current/practice-rooms',
    verified: false,
  },
  'fod-card-access': {
    id: 'fod-card-access',
    name: 'Ohio State Facilities Operations and Development, Card Access',
    email: 'key-card@osu.edu',
    phone: '614-292-0257',
    note: 'The university card access team can forward your request to the building’s coordinator.',
    sourceUrl: 'https://fod.osu.edu/pam',
    verified: false,
  },
};

// Which office grants access to each building in the campus list. Libraries need no request.
const BUILDING_OFFICE: Record<string, string> = {
  // Fisher
  mason: 'fisher', fisher: 'fisher', gerlach: 'fisher', schoenbaum: 'fisher', pfahl: 'fisher', 'blackwell-academic': 'fisher',
  // Engineering building managers
  dreese: 'eng-dreese-baker', caldwell: 'eng-dreese-baker', 'baker-systems': 'eng-dreese-baker',
  'scott-lab': 'eng-scott', bolz: 'eng-bolz-hitchcock', hitchcock: 'eng-bolz-hitchcock',
  'smith-lab': 'eng-smith', fontana: 'eng-fontana',
  watts: 'eng-facilities', macquigg: 'eng-facilities', 'cee-building': 'eng-facilities', 'car-building': 'eng-facilities',
  knowlton: 'knowlton',
  // Arts and Sciences
  mendenhall: 'earth-sciences', orton: 'earth-sciences',
  mcpherson: 'chemistry', celeste: 'chemistry', 'newman-wolfrom': 'chemistry', evans: 'chemistry',
  timashev: 'music', hughes: 'music',
  'university-hall': 'asc-facilities', derby: 'asc-facilities', hagerty: 'asc-facilities', denney: 'asc-facilities',
  dulles: 'asc-facilities', hopkins: 'asc-facilities', hayes: 'asc-facilities', journalism: 'asc-facilities',
  townshend: 'asc-facilities', sullivant: 'asc-facilities', drake: 'asc-facilities', prb: 'asc-facilities',
  jennings: 'asc-facilities', aronoff: 'asc-facilities', 'bio-sciences': 'asc-facilities', riffe: 'asc-facilities',
  'math-building': 'asc-facilities', cockins: 'asc-facilities',
  // CFAES
  'ag-admin': 'cfaes', 'animal-science': 'cfaes', 'ag-eng': 'cfaes', kottman: 'cfaes', howlett: 'cfaes',
  'parker-food': 'cfaes', plumb: 'cfaes', dakan: 'cfaes', waterman: 'cfaes',
  // Health sciences
  meiling: 'medical-center', graves: 'medical-center', hamilton: 'medical-center', brt: 'medical-center',
  newton: 'nursing', cunz: 'public-health',
  // Other colleges and units
  page: 'glenn', drinko: 'moritz',
  'ohio-union': 'student-life', rpac: 'student-life',
};

export function officeForBuilding(buildingId: string): AccessOffice {
  return ACCESS_OFFICES[BUILDING_OFFICE[buildingId] ?? 'fod-card-access'];
}

export interface AccessEmail {
  to: string;
  subject: string;
  body: string;
}

// The request the student sends from their own OSU email. It never includes the 19-digit
// BuckID number, which Ohio State treats as restricted data.
export function buildAccessEmail(opts: {
  office: AccessOffice;
  buildingName: string;
  hours: string;
  term: string;
  reason: string;
  studentName: string;
  nameDotNum: string;
  email: string;
  rank: string;
  major: string;
}): AccessEmail {
  const { office, buildingName, hours, term, reason, studentName, nameDotNum, email, rank, major } = opts;
  return {
    to: office.email,
    subject: `After-hours BuckID access request: ${buildingName}`,
    body: [
      'Hello,',
      '',
      `I'm ${studentName} (${nameDotNum}), a ${rank.toLowerCase()} studying ${major}. I'd like to request after-hours BuckID access to ${buildingName}.`,
      '',
      `When: ${hours}`,
      `For how long: ${term}`,
      `Why: ${reason}`,
      '',
      "Could you add this access to my BuckID, or let me know the right process or person if it's handled elsewhere? I can share my 9-digit OSU ID if you need it.",
      '',
      'Thank you,',
      studentName,
      email,
    ].join('\n'),
  };
}

export function mailtoLink(m: AccessEmail): string {
  return `mailto:${m.to}?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.body)}`;
}

// Ohio State email is Microsoft 365, so this opens the draft in Outlook on the web.
export function outlookLink(m: AccessEmail): string {
  return `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(m.to)}&subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.body)}`;
}

// Each student's saved requests (public.building_access_requests, own rows only via RLS).
export interface AccessRequestRow {
  id: string;
  building_id: string;
  building_name: string;
  office_name: string;
  office_email: string;
  hours: string;
  term: string;
  reason: string;
  status: 'emailed' | 'granted' | 'denied';
  created_at: string;
}

export async function listAccessRequests(): Promise<AccessRequestRow[]> {
  const { data, error } = await supabase
    .from('building_access_requests')
    .select('id, building_id, building_name, office_name, office_email, hours, term, reason, status, created_at')
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('Could not load access requests:', error);
    return [];
  }
  return data as AccessRequestRow[];
}

export async function saveAccessRequest(
  row: Omit<AccessRequestRow, 'id' | 'status' | 'created_at'>,
): Promise<AccessRequestRow | null> {
  const { data, error } = await supabase
    .from('building_access_requests')
    .insert(row)
    .select('id, building_id, building_name, office_name, office_email, hours, term, reason, status, created_at')
    .single();
  if (error) {
    console.warn('Could not save access request:', error);
    return null;
  }
  return data as AccessRequestRow;
}

export async function setAccessRequestStatus(id: string, status: AccessRequestRow['status']): Promise<boolean> {
  const { error } = await supabase
    .from('building_access_requests')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) console.warn('Could not update access request:', error);
  return !error;
}

export async function deleteAccessRequest(id: string): Promise<boolean> {
  const { error } = await supabase.from('building_access_requests').delete().eq('id', id);
  if (error) console.warn('Could not delete access request:', error);
  return !error;
}
