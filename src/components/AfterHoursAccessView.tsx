// After-Hours Study Access: get a BuckID to open a building after it locks.
// One flow in three steps (pick a building, when and why, send the email), then "Your access" to track requests.
// The BuckID office doesn't grant door access; the office that runs each building does (src/lib/buildingAccess.ts).
// BuckAI writes the email and the student sends it from their own OSU account.

import React, { useEffect, useState } from 'react';
import { BookOpen, Check, ChevronRight, Clock, Copy, CreditCard, ExternalLink, Mail, Search, ShieldCheck, X } from 'lucide-react';
import { StudentProfile } from '../data/sampleData';
import {
  AccessEmail,
  AccessRequestRow,
  buildAccessEmail,
  deleteAccessRequest,
  listAccessRequests,
  mailtoLink,
  officeForBuilding,
  outlookLink,
  saveAccessRequest,
  setAccessRequestStatus,
} from '../lib/buildingAccess';

export interface CampusBuilding {
  id: string;
  name: string;
  code: string;
  area: 'North Campus' | 'South Campus' | 'Central Campus' | 'West Campus' | 'Medical Campus';
  category:
    | 'Libraries'
    | 'Business'
    | 'Engineering'
    | 'Arts & Humanities'
    | 'Sciences & Math'
    | 'Agriculture & Environment'
    | 'Health & Medicine'
    | 'Architecture'
    | 'Public Affairs & Law'
    | 'Student Centers';
  locksAt: string;
  weekendStatus: string;
  isLibrary?: boolean;
  notes: string;
}

// Complete campus building database (80 major OSU academic buildings)
export const ALL_CAMPUS_BUILDINGS: CampusBuilding[] = [
  // 1. Libraries (Automatic BuckID Access for all students)
  {
    id: 'lib-18th',
    name: '18th Avenue Library (Science & Engineering)',
    code: '18TH',
    area: 'North Campus',
    category: 'Libraries',
    locksAt: 'Open 24/7',
    weekendStatus: 'Open 24/7',
    isLibrary: true,
    notes: 'Every Ohio State student already has automatic 24/7 BuckID access.'
  },
  {
    id: 'lib-thompson',
    name: 'Thompson Library (Main Library)',
    code: 'THOMP',
    area: 'Central Campus',
    category: 'Libraries',
    locksAt: 'Locks at 10:00 PM (Mon–Fri)',
    weekendStatus: 'Open Sat & Sun until 9:00 PM',
    isLibrary: true,
    notes: 'Every Ohio State student already has automatic daytime and evening BuckID access.'
  },
  {
    id: 'lib-prior',
    name: 'Prior Health Sciences Library',
    code: 'PHSL',
    area: 'Medical Campus',
    category: 'Libraries',
    locksAt: 'Locks at 10:00 PM (Mon–Fri)',
    weekendStatus: 'Open Sat & Sun 10:00 AM – 8:00 PM',
    isLibrary: true,
    notes: 'Health sciences and pre-med quiet study floors. BuckID access automatic.'
  },

  // 2. Business (Fisher College of Business)
  {
    id: 'mason',
    name: 'Mason Hall',
    code: 'MH',
    area: 'North Campus',
    category: 'Business',
    locksAt: 'Locks at 7:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Computer labs, accounting tutoring center (ALC), and group study rooms.'
  },
  {
    id: 'fisher',
    name: 'Fisher Hall',
    code: 'FH',
    area: 'North Campus',
    category: 'Business',
    locksAt: 'Locks at 7:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Faculty offices, quiet breakout pods, and business seminar rooms.'
  },
  {
    id: 'gerlach',
    name: 'Gerlach Hall',
    code: 'GH',
    area: 'North Campus',
    category: 'Business',
    locksAt: 'Locks at 7:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Graduate business study lounges and quiet breakout rooms.'
  },
  {
    id: 'schoenbaum',
    name: 'Schoenbaum Hall',
    code: 'SH',
    area: 'North Campus',
    category: 'Business',
    locksAt: 'Locks at 7:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Undergraduate business classrooms and interview study rooms.'
  },
  {
    id: 'pfahl',
    name: 'Pfahl Hall',
    code: 'PF',
    area: 'North Campus',
    category: 'Business',
    locksAt: 'Locks at 7:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Executive education classrooms and conference study spaces.'
  },
  {
    id: 'blackwell-academic',
    name: 'Blackwell Academic Center',
    code: 'BLCK',
    area: 'North Campus',
    category: 'Business',
    locksAt: 'Locks at 7:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Hospitality management and business meeting rooms.'
  },

  // 3. College of Engineering & Computing
  {
    id: 'dreese',
    name: 'Dreese Laboratories',
    code: 'DL',
    area: 'North Campus',
    category: 'Engineering',
    locksAt: 'Locks at 6:30 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Computer science Linux computer labs (DL 380) and collaborative coding rooms.'
  },
  {
    id: 'caldwell',
    name: 'Caldwell Laboratory',
    code: 'CL',
    area: 'North Campus',
    category: 'Engineering',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Electrical and computer engineering workstations and circuit testing benches.'
  },
  {
    id: 'hitchcock',
    name: 'Hitchcock Hall',
    code: 'HH',
    area: 'North Campus',
    category: 'Engineering',
    locksAt: 'Locks at 7:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'First-year engineering computer clusters and large group study tables.'
  },
  {
    id: 'baker-systems',
    name: 'Baker Systems Engineering',
    code: 'BE',
    area: 'North Campus',
    category: 'Engineering',
    locksAt: 'Locks at 6:30 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Integrated systems engineering labs and project workspaces.'
  },
  {
    id: 'bolz',
    name: 'Bolz Hall',
    code: 'BH',
    area: 'North Campus',
    category: 'Engineering',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Civil, environmental, and geodetic engineering computer rooms.'
  },
  {
    id: 'scott-lab',
    name: 'Scott Laboratory',
    code: 'SL',
    area: 'North Campus',
    category: 'Engineering',
    locksAt: 'Locks at 7:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Mechanical and aerospace engineering design and computing spaces.'
  },
  {
    id: 'fontana',
    name: 'Fontana Laboratories',
    code: 'FL',
    area: 'North Campus',
    category: 'Engineering',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Materials science and engineering teaching labs and study tables.'
  },
  {
    id: 'watts',
    name: 'Watts Hall',
    code: 'WH',
    area: 'North Campus',
    category: 'Engineering',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Materials science research and computer modeling stations.'
  },
  {
    id: 'macquigg',
    name: 'MacQuigg Laboratories',
    code: 'MQ',
    area: 'North Campus',
    category: 'Engineering',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Biomedical engineering research and prototyping suites.'
  },
  {
    id: 'smith-lab',
    name: 'Smith Laboratory',
    code: 'SML',
    area: 'North Campus',
    category: 'Engineering',
    locksAt: 'Locks at 7:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Physics and general STEM lecture rooms and group study tables.'
  },
  {
    id: 'cee-building',
    name: 'Civil & Environmental Engineering Building',
    code: 'CEE',
    area: 'North Campus',
    category: 'Engineering',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Structures labs, design studios, and transport simulation rooms.'
  },
  {
    id: 'car-building',
    name: 'Center for Automotive Research (CAR)',
    code: 'CAR',
    area: 'West Campus',
    category: 'Engineering',
    locksAt: 'Locks at 5:30 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Motorsports, electric vehicle design, and automotive engineering bays.'
  },

  // 4. College of Arts and Sciences - Humanities & Social Sciences
  {
    id: 'enarson',
    name: 'Enarson Classroom Building',
    code: 'ECB',
    area: 'Central Campus',
    category: 'Arts & Humanities',
    locksAt: 'Locks at 8:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Central campus study lounges, quiet carrels, and rolling whiteboards.'
  },
  {
    id: 'university-hall',
    name: 'University Hall',
    code: 'UH',
    area: 'Central Campus',
    category: 'Arts & Humanities',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Historic Oval building with humanities seminar and study rooms.'
  },
  {
    id: 'derby',
    name: 'Derby Hall',
    code: 'DH',
    area: 'Central Campus',
    category: 'Arts & Humanities',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Political science and geography computer labs and study lounges.'
  },
  {
    id: 'hagerty',
    name: 'Hagerty Hall',
    code: 'HA',
    area: 'Central Campus',
    category: 'Arts & Humanities',
    locksAt: 'Locks at 7:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'World language study lounges, courtyard cafe tables, and media labs.'
  },
  {
    id: 'denney',
    name: 'Denney Hall',
    code: 'DE',
    area: 'Central Campus',
    category: 'Arts & Humanities',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'English department and writing center collaborative study rooms.'
  },
  {
    id: 'dulles',
    name: 'Dulles Hall',
    code: 'DU',
    area: 'Central Campus',
    category: 'Arts & Humanities',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'History, philosophy, and humanities quiet reading rooms.'
  },
  {
    id: 'hopkins',
    name: 'Hopkins Hall',
    code: 'HO',
    area: 'Central Campus',
    category: 'Arts & Humanities',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Department of Art studios, digital imaging, and ceramics spaces.'
  },
  {
    id: 'hayes',
    name: 'Hayes Hall',
    code: 'HY',
    area: 'Central Campus',
    category: 'Arts & Humanities',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Department of Design studios and computer labs on the North Oval.'
  },
  {
    id: 'journalism',
    name: 'Journalism Building',
    code: 'JB',
    area: 'Central Campus',
    category: 'Arts & Humanities',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'School of Communication newsroom labs and audio/video suites.'
  },
  {
    id: 'mendenhall',
    name: 'Mendenhall Laboratory',
    code: 'ML2',
    area: 'Central Campus',
    category: 'Arts & Humanities',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'School of Earth Sciences quiet study atrium and museum space.'
  },
  {
    id: 'orton',
    name: 'Orton Hall',
    code: 'OH',
    area: 'Central Campus',
    category: 'Arts & Humanities',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Historic chime tower, geology museum, and quiet reading room.'
  },
  {
    id: 'bricker',
    name: 'Bricker Hall',
    code: 'BR',
    area: 'Central Campus',
    category: 'Arts & Humanities',
    locksAt: 'Locks at 5:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Academic administration and student scholarship conference rooms.'
  },
  {
    id: 'townshend',
    name: 'Townshend Hall',
    code: 'TH',
    area: 'Central Campus',
    category: 'Arts & Humanities',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Anthropology labs and archaeological teaching rooms.'
  },
  {
    id: 'hughes',
    name: 'Hughes Hall',
    code: 'HU',
    area: 'Central Campus',
    category: 'Arts & Humanities',
    locksAt: 'Locks at 7:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Music rehearsal classrooms and music theory study spaces.'
  },
  {
    id: 'timashev',
    name: 'Timashev Family Music Building',
    code: 'TFMB',
    area: 'Central Campus',
    category: 'Arts & Humanities',
    locksAt: 'Locks at 8:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Modern music performance center, practice pods, and acoustic study rooms.'
  },
  {
    id: 'drake',
    name: 'Drake Performance & Event Center',
    code: 'DC',
    area: 'West Campus',
    category: 'Arts & Humanities',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Theatre and film rehearsal studios along the Olentangy River.'
  },
  {
    id: 'sullivant',
    name: 'Sullivant Hall',
    code: 'SU',
    area: 'Central Campus',
    category: 'Arts & Humanities',
    locksAt: 'Locks at 7:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Department of Dance, ACCAD animation, and Billy Ireland Cartoon Library.'
  },
  {
    id: 'wexner',
    name: 'Wexner Center for the Arts',
    code: 'WEX',
    area: 'Central Campus',
    category: 'Arts & Humanities',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Open Weekends until 5:00 PM',
    notes: 'Contemporary arts exhibitions, film video theater, and study terrace.'
  },
  {
    id: 'pomerene',
    name: 'Pomerene Hall (Data Analytics / TDAI)',
    code: 'PO',
    area: 'Central Campus',
    category: 'Arts & Humanities',
    locksAt: 'Locks at 7:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Translational Data Analytics Institute (TDAI), Ideation Lab, and quiet mezzanine.'
  },
  {
    id: 'kuhn-honors',
    name: 'Kuhn Honors & Scholars House',
    code: 'KH2',
    area: 'Central Campus',
    category: 'Arts & Humanities',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Honors & Scholars lounge, quiet fireplace study room, and team tables.'
  },
  {
    id: 'hale-center',
    name: 'Hale Black Cultural Center',
    code: 'HALE',
    area: 'Central Campus',
    category: 'Arts & Humanities',
    locksAt: 'Locks at 7:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Art galleries, computer lounge, and collaborative community study rooms.'
  },

  // 5. Sciences & Mathematics
  {
    id: 'mcpherson',
    name: 'McPherson Chemical Laboratory',
    code: 'ML',
    area: 'North Campus',
    category: 'Sciences & Math',
    locksAt: 'Locks at 7:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Chemistry resource center, computer rooms, and study alcoves.'
  },
  {
    id: 'celeste',
    name: 'Celeste Laboratory',
    code: 'CL2',
    area: 'North Campus',
    category: 'Sciences & Math',
    locksAt: 'Locks at 6:30 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Chemistry teaching laboratories and recitation spaces.'
  },
  {
    id: 'newman-wolfrom',
    name: 'Newman & Wolfrom Laboratory',
    code: 'NW',
    area: 'North Campus',
    category: 'Sciences & Math',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Organic and biochemistry research labs and computational suites.'
  },
  {
    id: 'evans',
    name: 'Evans Laboratory',
    code: 'EL',
    area: 'North Campus',
    category: 'Sciences & Math',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Physical and analytical chemistry computer rooms.'
  },
  {
    id: 'prb',
    name: 'Physics Research Building (PRB)',
    code: 'PRB',
    area: 'North Campus',
    category: 'Sciences & Math',
    locksAt: 'Locks at 6:30 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Physics atrium study spaces, water wall lounge, and computing rooms.'
  },
  {
    id: 'jennings',
    name: 'Jennings Hall',
    code: 'JH',
    area: 'South Campus',
    category: 'Sciences & Math',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Biology learning center, plant biology labs, and quiet study rooms.'
  },
  {
    id: 'aronoff',
    name: 'Aronoff Laboratory',
    code: 'AL',
    area: 'South Campus',
    category: 'Sciences & Math',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Biological sciences research, ecology computer clusters, and carrels.'
  },
  {
    id: 'bio-sciences',
    name: 'Biological Sciences Building',
    code: 'BSI',
    area: 'South Campus',
    category: 'Sciences & Math',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Microbiology, genetics, and biochemistry learning centers.'
  },
  {
    id: 'riffe',
    name: 'Riffe Building (Biological Sciences)',
    code: 'RB',
    area: 'South Campus',
    category: 'Sciences & Math',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Biophysics and molecular biology study rooms.'
  },
  {
    id: 'math-building',
    name: 'Mathematical Sciences Building',
    code: 'MW',
    area: 'Central Campus',
    category: 'Sciences & Math',
    locksAt: 'Locks at 6:30 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Mathematics tutoring MSLC center and problem-solving tables.'
  },
  {
    id: 'cockins',
    name: 'Cockins Hall',
    code: 'CH',
    area: 'Central Campus',
    category: 'Sciences & Math',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Department of Statistics computer labs and actuarial science rooms.'
  },

  // 6. Food, Agricultural, and Environmental Sciences (CFAES)
  {
    id: 'ag-admin',
    name: 'Agricultural Administration Building',
    code: 'AA',
    area: 'West Campus',
    category: 'Agriculture & Environment',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'CFAES college headquarters, auditorium, and student study center.'
  },
  {
    id: 'animal-science',
    name: 'Animal Science Building',
    code: 'AS',
    area: 'West Campus',
    category: 'Agriculture & Environment',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Animal sciences lecture halls and computing labs.'
  },
  {
    id: 'ag-eng',
    name: 'Agricultural Engineering Building',
    code: 'AE',
    area: 'West Campus',
    category: 'Agriculture & Environment',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Food, agricultural, and biological engineering design workshops.'
  },
  {
    id: 'kottman',
    name: 'Kottman Hall',
    code: 'KH3',
    area: 'West Campus',
    category: 'Agriculture & Environment',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'School of Environment & Natural Resources (SENR) study lounges.'
  },
  {
    id: 'howlett',
    name: 'Howlett Hall',
    code: 'HH3',
    area: 'West Campus',
    category: 'Agriculture & Environment',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Horticulture, crop science, and greenhouse research suites.'
  },
  {
    id: 'parker-food',
    name: 'Parker Food Science & Technology Building',
    code: 'PFST',
    area: 'West Campus',
    category: 'Agriculture & Environment',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Food science sensory evaluation labs, pilot plant, and study rooms.'
  },
  {
    id: 'plumb',
    name: 'Plumb Hall',
    code: 'PL',
    area: 'West Campus',
    category: 'Agriculture & Environment',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Agricultural economics and livestock judging study spaces.'
  },
  {
    id: 'dakan',
    name: 'Dakan Hall',
    code: 'DH3',
    area: 'West Campus',
    category: 'Agriculture & Environment',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Avian biology and animal welfare computing spaces.'
  },
  {
    id: 'waterman',
    name: 'Waterman Agricultural Laboratory Complex',
    code: 'WAT',
    area: 'West Campus',
    category: 'Agriculture & Environment',
    locksAt: 'Locks at 5:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Controlled environment agriculture and dairy research facilities.'
  },

  // 7. Health Sciences & Medicine
  {
    id: 'meiling',
    name: 'Meiling Hall',
    code: 'ME',
    area: 'Medical Campus',
    category: 'Health & Medicine',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'College of Medicine administrative suites and lecture halls.'
  },
  {
    id: 'graves',
    name: 'Graves Hall',
    code: 'GH2',
    area: 'Medical Campus',
    category: 'Health & Medicine',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Biomedical science and physiology teaching laboratories.'
  },
  {
    id: 'hamilton',
    name: 'Hamilton Hall',
    code: 'HH4',
    area: 'Medical Campus',
    category: 'Health & Medicine',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Medical sciences, anatomy laboratories, and collaborative study desks.'
  },
  {
    id: 'newton',
    name: 'Newton Hall',
    code: 'NH',
    area: 'Medical Campus',
    category: 'Health & Medicine',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'College of Nursing simulation suites and quiet reading rooms.'
  },
  {
    id: 'postle',
    name: 'Postle Hall',
    code: 'PH2',
    area: 'Medical Campus',
    category: 'Health & Medicine',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'College of Dentistry student clinics, laboratories, and study rooms.'
  },
  {
    id: 'parks',
    name: 'Parks Hall',
    code: 'PA2',
    area: 'Medical Campus',
    category: 'Health & Medicine',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'College of Pharmacy medicinal chemistry labs and quiet carrels.'
  },
  {
    id: 'atwell',
    name: 'Atwell Hall',
    code: 'AT',
    area: 'Medical Campus',
    category: 'Health & Medicine',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'School of Health and Rehabilitation Sciences study rooms.'
  },
  {
    id: 'cunz',
    name: 'Cunz Hall',
    code: 'CU',
    area: 'Medical Campus',
    category: 'Health & Medicine',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'College of Public Health collaborative classrooms and study lounge.'
  },
  {
    id: 'brt',
    name: 'Biomedical Research Tower (BRT)',
    code: 'BRT',
    area: 'Medical Campus',
    category: 'Health & Medicine',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Biomedical research tower, cafe atrium, and conference study rooms.'
  },
  {
    id: 'vmab',
    name: 'Veterinary Medicine Academic Building',
    code: 'VMAB',
    area: 'West Campus',
    category: 'Health & Medicine',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'College of Veterinary Medicine lecture halls and study pods.'
  },

  // 8. Architecture, Public Affairs, Law & Social Work
  {
    id: 'knowlton',
    name: 'Knowlton Hall',
    code: 'KH',
    area: 'North Campus',
    category: 'Architecture',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Architecture library, design studio desks, and roof garden terrace.'
  },
  {
    id: 'page',
    name: 'Page Hall',
    code: 'PA',
    area: 'Central Campus',
    category: 'Public Affairs & Law',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'John Glenn College of Public Affairs study lounge and seminar rooms.'
  },
  {
    id: 'drinko',
    name: 'Drinko Hall (Moritz Law)',
    code: 'DH2',
    area: 'South Campus',
    category: 'Public Affairs & Law',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Moritz College of Law legal library and silent study carrels.'
  },
  {
    id: 'stillman',
    name: 'Stillman Hall',
    code: 'ST',
    area: 'Central Campus',
    category: 'Public Affairs & Law',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'College of Social Work computer rooms and quiet breakout pods.'
  },
  {
    id: 'ramseyer',
    name: 'Ramseyer Hall',
    code: 'RA',
    area: 'Central Campus',
    category: 'Public Affairs & Law',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'College of Education and Human Ecology teaching labs and study tables.'
  },
  {
    id: 'campbell',
    name: 'Campbell Hall',
    code: 'CA',
    area: 'Central Campus',
    category: 'Public Affairs & Law',
    locksAt: 'Locks at 6:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Human sciences, consumer science, and historic costume collection study areas.'
  },
  {
    id: 'arps',
    name: 'Arps Hall',
    code: 'AR',
    area: 'Central Campus',
    category: 'Public Affairs & Law',
    locksAt: 'Locks at 7:00 PM (Mon–Fri)',
    weekendStatus: 'Locked on Weekends',
    notes: 'Department of Economics and Education collaboration rooms and computer lab.'
  },

  // 9. Student Centers
  {
    id: 'ohio-union',
    name: 'Ohio Union',
    code: 'OHU',
    area: 'Central Campus',
    category: 'Student Centers',
    locksAt: 'Locks at 11:00 PM (Mon–Fri)',
    weekendStatus: 'Open Sat & Sun until 11:00 PM',
    notes: 'Student activity lounges, Keith B. Key leadership center, and group tables.'
  },
  {
    id: 'rpac',
    name: 'RPAC (Recreation & Physical Activity Center)',
    code: 'RPAC',
    area: 'Central Campus',
    category: 'Student Centers',
    locksAt: 'Locks at 11:00 PM (Mon–Fri)',
    weekendStatus: 'Open Sat & Sun until 10:00 PM',
    notes: 'Mezzanine study tables, quiet meeting rooms, and student wellness lounge.'
  }
];

interface AfterHoursAccessViewProps {
  profile: StudentProfile;
}

// Libraries every student's BuckID already opens (no request needed)
const LIBRARY_ACCESS = [
  { id: 'lib-18th', name: '18th Avenue Library', hours: 'Open 24/7' },
  { id: 'lib-thompson', name: 'Thompson Library', hours: 'Until 10 PM weekdays, 9 PM weekends' },
];

const WHEN_OPTIONS = [
  { label: 'Weeknights', value: 'Evenings (weeknights after the building locks)' },
  { label: 'Weekends', value: 'Weekends (Saturday and Sunday)' },
  { label: 'Both', value: 'Evenings and weekends' },
];
const TERM = 'The whole semester';
const WHY_OPTIONS = ['Studying for exams', 'Group project', 'Using computer labs', 'Quiet individual study'];

// Buildings to suggest before the student searches, from their college
function suggestedCategories(college: string): CampusBuilding['category'][] {
  if (/fisher|business/i.test(college)) return ['Business'];
  if (/engineering/i.test(college)) return ['Engineering'];
  if (/arts and sciences/i.test(college)) return ['Arts & Humanities', 'Sciences & Math'];
  return [];
}

const matches = (b: CampusBuilding, q: string) =>
  [b.name, b.code, b.category, b.area].some((f) => f.toLowerCase().includes(q));

const shortHours = (b: CampusBuilding) => `${b.locksAt.replace(/^Locks at /, 'Locks ')} · ${b.weekendStatus}`;

const StepHeader: React.FC<{ n: number; title: string; done?: boolean; muted?: boolean }> = ({ n, title, done, muted }) => (
  <div className="flex items-center gap-3">
    <span
      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
        done ? 'bg-emerald-600 text-white' : muted ? 'bg-neutral-200 text-neutral-500' : 'bg-neutral-900 text-white'
      }`}
    >
      {done ? <Check className="w-4 h-4" /> : n}
    </span>
    <h4 className={`text-base font-bold ${muted ? 'text-neutral-400' : 'text-neutral-900'}`}>{title}</h4>
  </div>
);

const chip = (on: boolean) =>
  `px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
    on ? 'border-[#ba0c2f] bg-[#ba0c2f] text-white' : 'border-neutral-300 text-neutral-700 hover:border-neutral-400 bg-white'
  }`;

export const AfterHoursAccessView: React.FC<AfterHoursAccessViewProps> = ({ profile }) => {
  // The student's saved requests, emailed to the office that grants access
  const [requests, setRequests] = useState<AccessRequestRow[]>([]);
  useEffect(() => {
    listAccessRequests().then(setRequests);
  }, []);
  const pending = requests.filter((r) => r.status === 'emailed');
  const granted = requests.filter((r) => r.status === 'granted');

  // Step 1: building
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const building = ALL_CAMPUS_BUILDINGS.find((b) => b.id === buildingId) ?? null;
  const office = building ? officeForBuilding(building.id) : null;

  const q = query.trim().toLowerCase();
  const categories = suggestedCategories(profile.college || '');
  const requestable = ALL_CAMPUS_BUILDINGS.filter((b) => !b.isLibrary);
  const suggested = requestable.filter((b) => categories.includes(b.category));
  const list = q ? ALL_CAMPUS_BUILDINGS.filter((b) => matches(b, q)) : showAll || !suggested.length ? requestable : suggested;
  const listLabel = q
    ? `${list.length} match${list.length === 1 ? '' : 'es'}`
    : showAll || !suggested.length
    ? `All ${requestable.length} buildings`
    : `Suggested for ${profile.college}`;

  // Step 2: when and why
  const [when, setWhen] = useState(WHEN_OPTIONS[0].value);
  const [why, setWhy] = useState(WHY_OPTIONS[0]);

  // Step 3: the email the student sends from their OSU account
  const [draft, setDraft] = useState<{ buildingName: string; email: AccessEmail; saved: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const writeEmail = async () => {
    if (!building || !office || building.isLibrary) return;
    const email = buildAccessEmail({
      office,
      buildingName: building.name,
      hours: when,
      term: TERM,
      reason: why,
      studentName: profile.name,
      nameDotNum: profile.nameDotNum.split('@')[0],
      email: profile.nameDotNum.includes('@') ? profile.nameDotNum : `${profile.nameDotNum}@osu.edu`,
      rank: profile.rank,
      major: profile.major,
    });
    setSaving(true);
    const saved = await saveAccessRequest({
      building_id: building.id,
      building_name: building.name,
      office_name: office.name,
      office_email: office.email,
      hours: when,
      term: TERM,
      reason: why,
    });
    setSaving(false);
    if (saved) setRequests((prev) => [saved, ...prev]);
    setCopied(false);
    setDraft({ buildingName: building.name, email, saved: Boolean(saved) });
  };

  const copyEmail = async () => {
    if (!draft) return;
    const { to, subject, body } = draft.email;
    try {
      await navigator.clipboard.writeText(`To: ${to}\nSubject: ${subject}\n\n${body}`);
      setCopied(true);
    } catch {
      /* clipboard blocked: the email is on screen to copy by hand */
    }
  };

  const startOver = () => {
    setDraft(null);
    setBuildingId(null);
    setQuery('');
    setShowAll(false);
  };

  const cancelRequest = async (id: string) => {
    if (await deleteAccessRequest(id)) setRequests((prev) => prev.filter((r) => r.id !== id));
  };
  const markGranted = async (id: string) => {
    if (await setAccessRequestStatus(id, 'granted')) setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'granted' } : r)));
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4 text-neutral-900 pb-10">
      {/* Header */}
      <div className="p-5 bg-white rounded-2xl border border-neutral-200/90 shadow-2xs space-y-4">
        <div>
          <h3 className="text-lg font-bold text-neutral-900">After-Hours Study Access</h3>
          <p className="text-sm text-neutral-600">Get your BuckID to open a building after it locks: pick the building, say when, and send the email BuckAI writes.</p>
        </div>
        <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
          <BookOpen className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
          <div className="text-sm text-emerald-950">
            <strong>Need somewhere tonight?</strong> 18th Avenue Library is open 24/7 on your BuckID. No request needed.
          </div>
        </div>
        {pending.length > 0 && (
          <a href="#your-access" className="flex items-center gap-2 text-sm text-amber-900 font-semibold hover:underline">
            <Clock className="w-4 h-4" />
            {pending.length} request{pending.length === 1 ? '' : 's'} waiting on an office
            <ChevronRight className="w-4 h-4" />
          </a>
        )}
      </div>

      {/* The request, in three steps */}
      <div className="p-5 bg-white rounded-2xl border border-neutral-200/90 shadow-2xs space-y-6">
        {/* 1. Building */}
        <section className="space-y-3">
          <StepHeader n={1} title="Pick a building" done={!!building} />
          {building ? (
            <div className="sm:ml-10 p-3.5 rounded-xl border border-[#ba0c2f]/30 bg-[#ba0c2f]/5 space-y-1.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-neutral-900">
                    {building.name} <span className="font-mono text-[11px] text-neutral-500">{building.code}</span>
                  </div>
                  <div className="text-xs text-neutral-600">{shortHours(building)}</div>
                </div>
                {!draft && (
                  <button onClick={() => setBuildingId(null)} className="text-xs font-semibold text-[#ba0c2f] hover:underline shrink-0">
                    Change
                  </button>
                )}
              </div>
              {office && (
                <div className="text-xs text-neutral-700 flex flex-wrap items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#ba0c2f]" />
                  Access comes from <strong>{office.name}</strong>
                  {!office.verified && <span className="bg-amber-100 text-amber-900 font-semibold px-1.5 py-0.5 rounded text-[10px]">Confirm with office</span>}
                  {office.formUrl && (
                    <a href={office.formUrl} target="_blank" rel="noreferrer" className="text-[#ba0c2f] hover:underline">
                      · They also have a form
                    </a>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="sm:ml-10 space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search buildings (e.g. Dreese, Mason, Scott)"
                  className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-neutral-300 text-sm bg-white focus:outline-none focus:border-[#ba0c2f]"
                />
                {query && (
                  <button onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="text-xs font-semibold text-neutral-500">{listLabel}</div>
              <ul className="border border-neutral-200 rounded-xl divide-y divide-neutral-100 max-h-80 overflow-y-auto">
                {list.length === 0 && <li className="px-3 py-4 text-sm text-neutral-500">No building matches “{query}”. Try its name or code.</li>}
                {list.map((b) => (
                  <li key={b.id}>
                    {b.isLibrary ? (
                      <div className="px-3 py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-neutral-900">{b.name}</div>
                          <div className="text-xs text-neutral-500">{b.locksAt}</div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                          Already open to you
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setBuildingId(b.id);
                          setDraft(null);
                        }}
                        className="w-full text-left px-3 py-2.5 flex items-center justify-between gap-3 hover:bg-neutral-50"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-neutral-900">
                            {b.name} <span className="font-mono text-[11px] text-neutral-400">{b.code}</span>
                          </div>
                          <div className="text-xs text-neutral-500">{shortHours(b)}</div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-neutral-400 shrink-0" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {!q && suggested.length > 0 && (
                <button onClick={() => setShowAll(!showAll)} className="text-xs font-semibold text-[#ba0c2f] hover:underline">
                  {showAll ? `Show only ${profile.college} buildings` : `Show all ${requestable.length} buildings`}
                </button>
              )}
            </div>
          )}
        </section>

        {/* 2. When and why */}
        <section className="space-y-3">
          <StepHeader n={2} title="When and why" muted={!building} />
          {building && (
            <div className="sm:ml-10 space-y-3">
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-neutral-500">When do you need in? (for the semester)</div>
                <div className="flex flex-wrap gap-2">
                  {WHEN_OPTIONS.map((o) => (
                    <button key={o.label} disabled={!!draft} onClick={() => setWhen(o.value)} className={chip(when === o.value)}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-neutral-500">What for?</div>
                <div className="flex flex-wrap gap-2">
                  {WHY_OPTIONS.map((r) => (
                    <button key={r} disabled={!!draft} onClick={() => setWhy(r)} className={chip(why === r)}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* 3. Send */}
        <section className="space-y-3">
          <StepHeader n={3} title="Send the email" muted={!building} done={!!draft} />
          {building && !draft && (
            <div className="sm:ml-10 space-y-2">
              <button
                onClick={writeEmail}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#ba0c2f] text-white text-sm font-bold hover:bg-[#a00a28] disabled:opacity-50"
              >
                <Mail className="w-4 h-4" /> {saving ? 'Writing…' : 'Write my request email'}
              </button>
              <p className="text-xs text-neutral-500">You send it from your OSU email so the office knows it’s you. BuckAI never sends it for you.</p>
            </div>
          )}
          {draft && (
            <div className="sm:ml-10 space-y-3">
              <div className="rounded-xl border border-neutral-200 overflow-hidden">
                <div className="px-3 py-2 bg-neutral-50 border-b border-neutral-200 text-xs space-y-0.5">
                  <div>
                    <span className="text-neutral-500">To:</span> <strong>{draft.email.to}</strong>
                  </div>
                  <div>
                    <span className="text-neutral-500">Subject:</span> {draft.email.subject}
                  </div>
                </div>
                <pre className="px-3 py-2.5 text-xs text-neutral-800 whitespace-pre-wrap font-sans max-h-48 overflow-y-auto">{draft.email.body}</pre>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={outlookLink(draft.email)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#ba0c2f] text-white text-sm font-bold hover:bg-[#a00a28]"
                >
                  Send from Outlook <ExternalLink className="w-4 h-4" />
                </a>
                <a href={mailtoLink(draft.email)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-neutral-300 text-sm font-semibold text-neutral-800 hover:border-[#ba0c2f]">
                  <Mail className="w-4 h-4" /> Mail app
                </a>
                <button onClick={copyEmail} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-neutral-300 text-sm font-semibold text-neutral-800 hover:border-[#ba0c2f]">
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />} {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-neutral-500">
                {draft.saved ? 'Saved under Your access below, so you can track it. ' : 'Couldn’t save it for tracking, but you can still send it. '}
                Never add your 19-digit BuckID number; your name.# is enough.
              </p>
              <button onClick={startOver} className="text-xs font-semibold text-[#ba0c2f] hover:underline">
                Request another building
              </button>
            </div>
          )}
        </section>
      </div>

      {/* Your access */}
      <div id="your-access" className="p-5 bg-white rounded-2xl border border-neutral-200/90 shadow-2xs space-y-3 scroll-mt-4">
        <h4 className="text-base font-bold text-neutral-900 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-[#ba0c2f]" /> Your access
        </h4>
        <ul className="border border-neutral-200 rounded-xl divide-y divide-neutral-100">
          {pending.map((r) => (
            <li key={r.id} className="px-3 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-neutral-900">{r.building_name}</div>
                <div className="text-xs text-neutral-500">
                  Emailed {r.office_name} on {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">Waiting</span>
                <button onClick={() => markGranted(r.id)} className="text-xs font-semibold text-emerald-800 hover:underline">
                  My BuckID works now
                </button>
                <button onClick={() => cancelRequest(r.id)} className="text-xs font-semibold text-neutral-500 hover:text-red-600">
                  Cancel
                </button>
              </div>
            </li>
          ))}
          {granted.map((r) => (
            <li key={r.id} className="px-3 py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-neutral-900">{r.building_name}</div>
                <div className="text-xs text-neutral-500">{r.hours}</div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">Granted</span>
            </li>
          ))}
          {LIBRARY_ACCESS.map((l) => (
            <li key={l.id} className="px-3 py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-neutral-900">{l.name}</div>
                <div className="text-xs text-neutral-500">{l.hours}</div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">Every student</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-neutral-500">When an office says yes, tap “My BuckID works now” so BuckAI knows.</p>
      </div>
    </div>
  );
};
