import React, { useState } from 'react';
import {
  Building2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  Check,
  Send,
  X,
  BookOpen,
  CreditCard,
  MapPin,
  ChevronRight,
  Filter,
  Sparkles
} from 'lucide-react';
import { StudentProfile } from '../data/sampleData';

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

export interface UserAccessItem {
  id: string;
  buildingName: string;
  code: string;
  hours: string;
  term: string;
  status: 'active' | 'waiting';
  notes: string;
}

interface AfterHoursAccessViewProps {
  profile: StudentProfile;
}

export const AfterHoursAccessView: React.FC<AfterHoursAccessViewProps> = ({ profile }) => {
  // Simple view switcher: 'request' | 'my-access' | 'all-buildings'
  const [activeTab, setActiveTab] = useState<'request' | 'my-access' | 'all-buildings'>('request');

  // Active BuckID access passes
  const [myAccess, setMyAccess] = useState<UserAccessItem[]>([
    {
      id: 'acc-1',
      buildingName: '18th Avenue Library',
      code: '18TH',
      hours: '24 Hours / 7 Days a Week',
      term: 'Automatic for All Students',
      status: 'active',
      notes: 'Your BuckID always opens the doors here 24/7.'
    },
    {
      id: 'acc-2',
      buildingName: 'Thompson Library',
      code: 'THOMP',
      hours: 'Open until 10:00 PM weekdays, 9:00 PM weekends',
      term: 'Automatic for All Students',
      status: 'active',
      notes: 'Your BuckID always works here during open hours.'
    },
    {
      id: 'acc-3',
      buildingName: 'Mason Hall (Fisher College)',
      code: 'MH',
      hours: 'Every night 7:00 PM – 2:00 AM',
      term: 'Autumn 2026 Semester',
      status: 'active',
      notes: 'Active on your BuckID for computer labs and study rooms.'
    }
  ]);

  // Pending requests waiting for approval
  const [pendingRequests, setPendingRequests] = useState<UserAccessItem[]>([
    {
      id: 'req-1',
      buildingName: 'Dreese Laboratories',
      code: 'DL',
      hours: 'Saturdays & Sundays (9:00 AM – 10:00 PM)',
      term: 'Autumn 2026 Semester',
      status: 'waiting',
      notes: 'Sent to the Computer Science department. Usually approved within 1 business day.'
    }
  ]);

  // Request form state
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('dreese');
  const [formFilterQuery, setFormFilterQuery] = useState<string>('');
  const [formCategoryFilter, setFormCategoryFilter] = useState<string>('All');
  const [selectedTimeOption, setSelectedTimeOption] = useState<string>('Evenings (Locks until 1:00 AM)');
  const [selectedDuration, setSelectedDuration] = useState<string>('The whole semester');
  const [selectedReason, setSelectedReason] = useState<string>('Studying for exams');
  const [requestSentSuccess, setRequestSentSuccess] = useState<string | null>(null);

  // Search & filter state for building directory tab
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const selectedBuildingObj = ALL_CAMPUS_BUILDINGS.find((b) => b.id === selectedBuildingId) || ALL_CAMPUS_BUILDINGS[3];

  // Buildings available in the form dropdown based on form filter
  const dropdownBuildings = ALL_CAMPUS_BUILDINGS.filter((b) => {
    const matchesText =
      b.name.toLowerCase().includes(formFilterQuery.toLowerCase()) ||
      b.code.toLowerCase().includes(formFilterQuery.toLowerCase()) ||
      b.category.toLowerCase().includes(formFilterQuery.toLowerCase());
    const matchesCategory = formCategoryFilter === 'All' || b.category === formCategoryFilter;
    return matchesText && matchesCategory;
  });

  const handleSendRequest = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedBuildingObj.isLibrary) {
      alert("You already have access to this library! Every Ohio State student's BuckID already opens the doors.");
      return;
    }

    const newReq: UserAccessItem = {
      id: `req-${Date.now()}`,
      buildingName: selectedBuildingObj.name,
      code: selectedBuildingObj.code,
      hours: selectedTimeOption,
      term: selectedDuration,
      status: 'waiting',
      notes: `Sent to ${selectedBuildingObj.category} building staff for approval.`
    };

    setPendingRequests((prev) => [newReq, ...prev]);
    setRequestSentSuccess(selectedBuildingObj.name);

    setTimeout(() => {
      setActiveTab('my-access');
      setRequestSentSuccess(null);
    }, 1500);
  };

  const handleCancelRequest = (reqId: string) => {
    setPendingRequests((prev) => prev.filter((r) => r.id !== reqId));
  };

  // Filtered building list for the directory tab
  const filteredBuildings = ALL_CAMPUS_BUILDINGS.filter((b) => {
    const matchesSearch =
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.notes.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.area.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || b.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categoriesList = [
    'All',
    'Libraries',
    'Business',
    'Engineering',
    'Arts & Humanities',
    'Sciences & Math',
    'Agriculture & Environment',
    'Health & Medicine',
    'Architecture',
    'Public Affairs & Law',
    'Student Centers'
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-5 text-gray-900 pb-10">
      
      {/* 1. Super-Simple Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ba0c2f]" />
              <h2 className="text-xl font-bold tracking-tight text-gray-900">
                After-Hours Study Access
              </h2>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              Need a quiet place to study after academic buildings lock? Request access here from all <strong>{ALL_CAMPUS_BUILDINGS.length} campus buildings</strong>. Once approved, you just <strong>tap your student BuckID</strong> at the door.
            </p>
          </div>

          <div className="text-xs bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg shrink-0">
            <span className="text-gray-500">Cardholder:</span>{' '}
            <strong className="text-gray-900">{profile.name}</strong> •{' '}
            <span className="font-mono text-gray-600">ID #{profile.osuId}</span>
          </div>
        </div>

        {/* Big Friendly Library Notice */}
        <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start space-x-2.5 text-xs text-emerald-900">
          <BookOpen className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold text-emerald-950">Good news about libraries:</strong> Every Ohio State student already has automatic access to <strong>18th Avenue Library (24/7)</strong> and <strong>Thompson Library</strong> on their BuckID. You don’t need to request access—your card already works!
          </div>
        </div>
      </div>

      {/* 2. Dead-Simple Navigation (3 Tabs) */}
      <div className="flex border-b border-gray-200 bg-white rounded-t-xl px-2 pt-2 gap-2 text-xs font-semibold overflow-x-auto">
        <button
          onClick={() => setActiveTab('request')}
          className={`px-4 py-2.5 rounded-t-lg transition-colors flex items-center space-x-1.5 whitespace-nowrap ${
            activeTab === 'request'
              ? 'bg-[#ba0c2f] text-white'
              : 'text-gray-600 hover:text-black hover:bg-gray-100'
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          <span>Request Access</span>
        </button>

        <button
          onClick={() => setActiveTab('my-access')}
          className={`px-4 py-2.5 rounded-t-lg transition-colors flex items-center space-x-1.5 whitespace-nowrap ${
            activeTab === 'my-access'
              ? 'bg-[#ba0c2f] text-white'
              : 'text-gray-600 hover:text-black hover:bg-gray-100'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>My BuckID Access</span>
          {pendingRequests.length > 0 && (
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'my-access' ? 'bg-white text-[#ba0c2f]' : 'bg-[#ba0c2f] text-white'
            }`}>
              {pendingRequests.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('all-buildings')}
          className={`px-4 py-2.5 rounded-t-lg transition-colors flex items-center space-x-1.5 whitespace-nowrap ${
            activeTab === 'all-buildings'
              ? 'bg-[#ba0c2f] text-white'
              : 'text-gray-600 hover:text-black hover:bg-gray-100'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Campus Buildings Database ({ALL_CAMPUS_BUILDINGS.length})</span>
        </button>
      </div>

      {/* TAB 1: SIMPLE REQUEST ACCESS FORM */}
      {activeTab === 'request' && (
        <div className="bg-white rounded-b-xl border border-gray-200 p-5 sm:p-6 shadow-xs space-y-5">
          {requestSentSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs flex items-center space-x-2 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <strong>Request sent for {requestSentSuccess}!</strong> We routed it to the building staff. Taking you to your tracking list...
              </div>
            </div>
          )}

          <div>
            <h3 className="text-base font-bold text-gray-900">
              Pick any building on campus to unlock
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Choose from all 80 Ohio State academic and study buildings. When approved, your BuckID will let you in.
            </p>
          </div>

          <form onSubmit={handleSendRequest} className="space-y-5">
            {/* Step 1: Pick the building with instant search & filter */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  1. Which building do you need? ({dropdownBuildings.length} available)
                </label>

                {/* Quick search input to find any building in seconds */}
                <div className="relative w-full sm:w-60">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Type building (e.g. Scott, Arps)..."
                    value={formFilterQuery}
                    onChange={(e) => setFormFilterQuery(e.target.value)}
                    className="w-full pl-8 pr-2 py-1 text-xs rounded-lg border border-gray-300 focus:border-[#ba0c2f] outline-none"
                  />
                  {formFilterQuery && (
                    <button
                      type="button"
                      onClick={() => setFormFilterQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Category Quick Chips for Form */}
              <div className="flex gap-1 overflow-x-auto pb-2 text-[11px]">
                {['All', 'Business', 'Engineering', 'Arts & Humanities', 'Sciences & Math', 'Agriculture & Environment', 'Health & Medicine'].map((cat) => (
                  <button
                    type="button"
                    key={cat}
                    onClick={() => setFormCategoryFilter(cat)}
                    className={`px-2.5 py-0.5 rounded-full whitespace-nowrap transition-colors ${
                      formCategoryFilter === cat
                        ? 'bg-gray-800 text-white font-bold'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <select
                value={selectedBuildingId}
                onChange={(e) => setSelectedBuildingId(e.target.value)}
                className="w-full text-sm font-medium px-3.5 py-2.5 rounded-xl border border-gray-300 bg-white focus:border-[#ba0c2f] focus:ring-1 focus:ring-[#ba0c2f] outline-none"
              >
                {dropdownBuildings.length === 0 ? (
                  <option disabled>No buildings matching &quot;{formFilterQuery}&quot;</option>
                ) : (
                  dropdownBuildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code}) — {b.locksAt}
                    </option>
                  ))
                )}
              </select>

              {/* Instant Building Summary Info */}
              <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs space-y-1">
                <div className="font-semibold text-gray-900 flex items-center justify-between">
                  <span>{selectedBuildingObj.name}</span>
                  <span className="text-[11px] text-gray-500 font-normal">{selectedBuildingObj.area} • {selectedBuildingObj.category}</span>
                </div>
                <div className="text-gray-600 text-[11px] flex items-center space-x-3">
                  <span><strong>Lock schedule:</strong> {selectedBuildingObj.locksAt}</span>
                  <span>•</span>
                  <span><strong>Weekends:</strong> {selectedBuildingObj.weekendStatus}</span>
                </div>
                <p className="text-gray-500 text-[11px] pt-0.5">
                  {selectedBuildingObj.notes}
                </p>
                {selectedBuildingObj.isLibrary && (
                  <div className="mt-1 text-emerald-700 font-bold text-[11px]">
                    ✓ You already have automatic access to this library! No request is needed.
                  </div>
                )}
              </div>
            </div>

            {/* Step 2: When do you need it? */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                2. When do you need access?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { title: 'Evenings', desc: 'Tonight & weeknights after building locks' },
                  { title: 'Weekends', desc: 'Saturday & Sunday study sessions' },
                  { title: 'Full Semester', desc: 'All evenings and weekends this semester' }
                ].map((opt) => (
                  <button
                    type="button"
                    key={opt.title}
                    onClick={() => setSelectedTimeOption(opt.title + ' (' + opt.desc + ')')}
                    className={`p-3 rounded-xl border text-left transition-all text-xs ${
                      selectedTimeOption.startsWith(opt.title)
                        ? 'border-[#ba0c2f] bg-red-50/60 ring-1 ring-[#ba0c2f]'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="font-bold text-gray-900">{opt.title}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 3: Why do you need it? */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                3. What are you using the space for?
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  'Studying for exams',
                  'Group project',
                  'Using computer labs',
                  'Quiet individual study'
                ].map((reason) => (
                  <button
                    type="button"
                    key={reason}
                    onClick={() => setSelectedReason(reason)}
                    className={`p-2.5 rounded-lg border text-center transition-all text-xs font-medium ${
                      selectedReason === reason
                        ? 'border-[#ba0c2f] bg-red-50 text-[#ba0c2f] font-bold'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700 bg-white'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2 flex items-center justify-between border-t border-gray-100">
              <span className="text-xs text-gray-500">
                Access is assigned directly to your <strong>BuckID</strong>.
              </span>
              <button
                type="submit"
                disabled={selectedBuildingObj.isLibrary}
                className="bg-[#ba0c2f] hover:bg-[#9d0a27] text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-xs transition-all flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
              >
                <span>Send Request</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: MY BUCKID ACCESS & TRACKING */}
      {activeTab === 'my-access' && (
        <div className="space-y-5">
          {/* Active Access List */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Buildings you can enter right now ({myAccess.length})</span>
                </h3>
                <p className="text-xs text-gray-500">
                  Just tap your BuckID at the outside door scanner to enter.
                </p>
              </div>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                Active on BuckID
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {myAccess.map((item) => (
                <div key={item.id} className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 text-xs space-y-1.5">
                  <div className="flex items-start justify-between">
                    <div className="font-bold text-gray-900 text-sm">{item.buildingName}</div>
                    <span className="font-mono text-[10px] bg-white border border-gray-200 px-1.5 py-0.5 rounded text-gray-600 font-bold">
                      {item.code}
                    </span>
                  </div>
                  <div className="text-gray-700 font-medium">
                    {item.hours}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {item.notes}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pending Requests */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center space-x-1.5">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>Requests waiting for approval ({pendingRequests.length})</span>
                </h3>
                <p className="text-xs text-gray-500">
                  The building staff is reviewing your request.
                </p>
              </div>
              {pendingRequests.length > 0 && (
                <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded">
                  In Review
                </span>
              )}
            </div>

            {pendingRequests.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-xs">
                You have no pending requests right now.
              </div>
            ) : (
              <div className="space-y-2.5 pt-1">
                {pendingRequests.map((req) => (
                  <div key={req.id} className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="font-bold text-gray-900 text-sm flex items-center space-x-1.5">
                        <span>{req.buildingName}</span>
                        <span className="text-[10px] font-mono text-gray-500">({req.code})</span>
                      </div>
                      <div className="text-gray-700 font-medium">{req.hours}</div>
                      <div className="text-[11px] text-gray-500">{req.notes}</div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <span className="text-[11px] text-amber-800 bg-amber-100 font-semibold px-2.5 py-1 rounded-lg">
                        Waiting on Department
                      </span>
                      <button
                        onClick={() => handleCancelRequest(req.id)}
                        className="text-gray-400 hover:text-red-600 p-1 rounded transition-colors text-xs"
                        title="Cancel this request"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: COMPLETE CAMPUS BUILDINGS DATABASE (80 BUILDINGS) */}
      {activeTab === 'all-buildings' && (
        <div className="bg-white rounded-b-xl border border-gray-200 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-gray-900">
                All Ohio State Campus Buildings ({ALL_CAMPUS_BUILDINGS.length})
              </h3>
              <p className="text-xs text-gray-500">
                Every academic building, laboratory, studio, and facility across North, South, Central, and West campus.
              </p>
            </div>

            {/* Simple Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, code, or area..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-gray-300 focus:border-[#ba0c2f] outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
            {categoriesList.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full whitespace-nowrap text-[11px] font-medium transition-colors ${
                  selectedCategory === cat
                    ? 'bg-[#ba0c2f] text-white font-bold'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Results Summary */}
          <div className="text-[11px] text-gray-500 flex items-center justify-between">
            <span>Showing {filteredBuildings.length} of {ALL_CAMPUS_BUILDINGS.length} campus buildings</span>
            {selectedCategory !== 'All' && (
              <button
                onClick={() => setSelectedCategory('All')}
                className="text-[#ba0c2f] hover:underline"
              >
                Clear filter
              </button>
            )}
          </div>

          {/* Building Cards List */}
          <div className="divide-y divide-gray-100 max-h-[560px] overflow-y-auto pr-1">
            {filteredBuildings.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xs">
                No buildings found matching &quot;{searchQuery}&quot;. Try searching by name or building code.
              </div>
            ) : (
              filteredBuildings.map((building) => (
                <div key={building.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:bg-gray-50/80 px-2 rounded-lg transition-colors">
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-gray-900 text-sm">{building.name}</span>
                      <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.2 rounded font-semibold">
                        {building.code}
                      </span>
                      {building.isLibrary && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">
                          Automatic BuckID Access
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-600 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      <span><strong>Locks:</strong> {building.locksAt}</span>
                      <span>•</span>
                      <span><strong>Weekends:</strong> {building.weekendStatus}</span>
                      <span>•</span>
                      <span className="text-gray-500 font-medium">{building.area}</span>
                      <span>•</span>
                      <span className="text-gray-400">{building.category}</span>
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {building.notes}
                    </div>
                  </div>

                  {!building.isLibrary && (
                    <button
                      onClick={() => {
                        setSelectedBuildingId(building.id);
                        setActiveTab('request');
                      }}
                      className="self-start sm:self-center text-xs font-bold text-[#ba0c2f] hover:bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      Request Access ➔
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
