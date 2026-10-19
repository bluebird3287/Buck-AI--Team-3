export interface Course {
  code: string;
  name: string;
  credits: number;
  type: 'GE Foundation' | 'GE Theme' | 'Major Core' | 'Major Specialization' | 'Major Prereq' | 'Major/Math' | 'Minor/Technical' | 'Minor Core' | 'Minor Elective' | 'Minor Capstone' | 'Major Capstone' | 'Experiential' | 'Elective' | 'General' | 'Career';
  difficulty: number; // 1 to 5
  prereqMet: boolean;
  prereqInfo?: string;
  notes?: string;
}

export interface Semester {
  id: string;
  name: string;
  status: 'completed' | 'in-progress' | 'planned';
  courses: Course[];
  totalCredits: number;
  workloadRating: 'Light' | 'Moderate' | 'Balanced' | 'Heavy' | 'Overload';
}

export interface StudentProfile {
  name: string;
  osuId: string;
  nameDotNum: string;
  rank: string;
  college: string;
  major: string;
  minor: string;
  gpa: number;
  earnedCredits: number;
  totalRequiredCredits: number;
  advisorName: string;
  advisorEmail: string;
  advisorTitle: string;
  advisorOffice: string;
  holds: string[];
  toDos: string[];
}

export interface AdvisorSlot {
  id: string;
  day: string;
  date: string;
  time: string;
  advisorAvailable: boolean;
  studentFree: boolean;
  mutualMatch: boolean;
  formatOptions: ('In-Person' | 'Zoom Virtual' | 'Phone')[];
}

export const INITIAL_STUDENT_PROFILE: StudentProfile = {
  name: 'Tyler',
  osuId: '#03847291',
  nameDotNum: 'rez.24@osu.edu',
  rank: 'Sophomore (Year 2)',
  college: 'Fisher College of Business',
  major: 'Finance (BSBA)',
  minor: 'Business Analytics & Computer Information Systems',
  gpa: 3.68,
  earnedCredits: 45,
  totalRequiredCredits: 121,
  advisorName: 'Sarah Jenkins, M.Ed.',
  advisorEmail: 'jenkins.892@osu.edu',
  advisorTitle: 'Senior Academic Advisor - Fisher & Arts/Sciences Dual Track',
  advisorOffice: 'Mason Hall 120 (Fisher Campus)',
  holds: ['Registration Lock (2nd-Year Advising Plan Milestone Check)'],
  toDos: [
    'Complete FAFSA Verification Form',
    'Financial Responsibility Statement 2026-2027',
    'Second-Year Career & Internship Assessment',
    'Degree Audit (DARS) Self-Review'
  ]
};

export const INITIAL_ROADMAP: Semester[] = [
  {
    id: 'sem-1',
    name: 'Autumn 2025 (Year 1)',
    status: 'completed',
    totalCredits: 15,
    workloadRating: 'Moderate',
    courses: [
      { code: 'MATH 1151', name: 'Calculus I', credits: 5, type: 'GE Foundation', difficulty: 4, prereqMet: true, prereqInfo: 'Placement score met' },
      { code: 'ECON 2001.01', name: 'Principles of Microeconomics', credits: 3, type: 'GE Foundation', difficulty: 2, prereqMet: true },
      { code: 'ENGLISH 1110.01', name: 'First-Year English Composition', credits: 3, type: 'GE Foundation', difficulty: 1, prereqMet: true },
      { code: 'ARTSSCI 1100.01', name: 'University Survey', credits: 1, type: 'General', difficulty: 1, prereqMet: true },
      { code: 'GE-SBS', name: 'Social & Behavioral Science Elective', credits: 3, type: 'GE Foundation', difficulty: 2, prereqMet: true }
    ]
  },
  {
    id: 'sem-2',
    name: 'Spring 2026 (Year 1)',
    status: 'completed',
    totalCredits: 14,
    workloadRating: 'Moderate',
    courses: [
      { code: 'ECON 2002.01', name: 'Principles of Macroeconomics', credits: 3, type: 'Major Prereq', difficulty: 2, prereqMet: true },
      { code: 'ACCTMIS 2200', name: 'Intro to Accounting 1', credits: 3, type: 'Major Prereq', difficulty: 4, prereqMet: true, notes: 'Instructor: Marc Smith • Workload: Heavy (Grade: A)' },
      { code: 'STAT 1430.01', name: 'Statistics for Business', credits: 4, type: 'GE Foundation', difficulty: 3, prereqMet: true },
      { code: 'GE-NAT', name: 'Natural Science with Lab', credits: 4, type: 'GE Foundation', difficulty: 3, prereqMet: true }
    ]
  },
  {
    id: 'sem-3',
    name: 'Autumn 2026 (Year 2 - In Progress)',
    status: 'in-progress',
    totalCredits: 15,
    workloadRating: 'Heavy',
    courses: [
      { code: 'ACCTMIS 2300', name: 'Intro to Accounting 2', credits: 3, type: 'Major Core', difficulty: 4, prereqMet: true, notes: 'Instructor: Marc Smith • High Workload (12-15 hrs/wk) • Current grade: A-' },
      { code: 'CSE 2221', name: 'Software I: Software Components', credits: 4, type: 'Minor/Technical', difficulty: 4, prereqMet: true, notes: 'Current grade: B+' },
      { code: 'MATH 1152', name: 'Calculus 2', credits: 5, type: 'Major/Math', difficulty: 5, prereqMet: true, notes: 'Midterm 1: 89%' },
      { code: 'BUSMHR 2292', name: 'Business Communication', credits: 3, type: 'Major Core', difficulty: 2, prereqMet: true, notes: 'Current grade: A' }
    ]
  },
  {
    id: 'sem-4',
    name: 'Spring 2027 (Year 2 - Planned)',
    status: 'planned',
    totalCredits: 14,
    workloadRating: 'Balanced',
    courses: [
      { code: 'BUSFIN 3220', name: 'Business Finance', credits: 3, type: 'Major Core', difficulty: 4, prereqMet: true, prereqInfo: 'Prereq ACCTMIS 2200 & ECON 2001/2002 satisfied' },
      { code: 'CSE 2231', name: 'Software II: Development & Components', credits: 4, type: 'Minor/Technical', difficulty: 4, prereqMet: true, prereqInfo: 'Prereq CSE 2221 in progress' },
      { code: 'BUSOBA 2320', name: 'Decision Sciences', credits: 3, type: 'Major Core', difficulty: 3, prereqMet: true, prereqInfo: 'Prereq STAT 1430 satisfied' },
      { code: 'GE-THEME-1', name: 'Citizenship for Diverse & Just World', credits: 4, type: 'GE Theme', difficulty: 2, prereqMet: true }
    ]
  },
  {
    id: 'sem-5',
    name: 'Autumn 2027 (Year 3 - Planned)',
    status: 'planned',
    totalCredits: 15,
    workloadRating: 'Balanced',
    courses: [
      { code: 'BUSFIN 4211', name: 'Corporate Finance', credits: 3, type: 'Major Specialization', difficulty: 4, prereqMet: true },
      { code: 'CSE 2321', name: 'Foundations I: Discrete Structures', credits: 3, type: 'Minor Core', difficulty: 4, prereqMet: true },
      { code: 'BUSMGT 3230', name: 'Operations Management', credits: 3, type: 'Major Core', difficulty: 3, prereqMet: true },
      { code: 'BUSML 3250', name: 'Principles of Marketing', credits: 3, type: 'Major Core', difficulty: 2, prereqMet: true },
      { code: 'GE-CULT', name: 'Historical & Cultural Studies', credits: 3, type: 'GE Foundation', difficulty: 2, prereqMet: true }
    ]
  },
  {
    id: 'sem-6',
    name: 'Spring 2028 (Year 3 - Planned)',
    status: 'planned',
    totalCredits: 14,
    workloadRating: 'Balanced',
    courses: [
      { code: 'BUSFIN 4221', name: 'Investments', credits: 3, type: 'Major Specialization', difficulty: 4, prereqMet: true },
      { code: 'BUSFIN 4230', name: 'Advanced Corporate Finance', credits: 3, type: 'Major Specialization', difficulty: 4, prereqMet: true },
      { code: 'CSE 3241', name: 'Intro to Database Systems', credits: 3, type: 'Minor Elective', difficulty: 3, prereqMet: true },
      { code: 'GE-THEME-2', name: 'Theme Elective: Health & Well-being', credits: 4, type: 'GE Theme', difficulty: 2, prereqMet: true },
      { code: 'EXP-3990', name: 'Fisher Internship Prep Seminar', credits: 1, type: 'Experiential', difficulty: 1, prereqMet: true }
    ]
  },
  {
    id: 'sem-summer',
    name: 'Summer 2028 (Internship)',
    status: 'planned',
    totalCredits: 1,
    workloadRating: 'Light',
    courses: [
      { code: 'BUSFIN 4191', name: 'Summer Finance / Analytics Internship', credits: 1, type: 'Experiential', difficulty: 1, prereqMet: true, notes: 'Targeting Financial Analyst / Quant Tech' }
    ]
  },
  {
    id: 'sem-7',
    name: 'Autumn 2028 (Year 4 - Planned)',
    status: 'planned',
    totalCredits: 15,
    workloadRating: 'Moderate',
    courses: [
      { code: 'BUSFIN 4250', name: 'International Finance', credits: 3, type: 'Major Specialization', difficulty: 3, prereqMet: true },
      { code: 'BUSMHR 4490', name: 'Strategic Management (Fisher Capstone)', credits: 3, type: 'Major Capstone', difficulty: 4, prereqMet: true },
      { code: 'CSE 3461', name: 'Computer Networking & Cloud', credits: 3, type: 'Minor Elective', difficulty: 3, prereqMet: true },
      { code: 'GE-LIT', name: 'Literary, Visual & Performing Arts', credits: 3, type: 'GE Foundation', difficulty: 2, prereqMet: true },
      { code: 'FREE-ELEC-1', name: 'University Free Elective', credits: 3, type: 'Elective', difficulty: 1, prereqMet: true }
    ]
  },
  {
    id: 'sem-8',
    name: 'Spring 2029 (Year 4 - Graduation)',
    status: 'planned',
    totalCredits: 13,
    workloadRating: 'Balanced',
    courses: [
      { code: 'BUSFIN 4260', name: 'Financial Modeling & Valuation', credits: 3, type: 'Major Specialization', difficulty: 4, prereqMet: true },
      { code: 'BUSOBA 4240', name: 'Applied Business Analytics & AI', credits: 3, type: 'Minor Capstone', difficulty: 3, prereqMet: true },
      { code: 'GRAD-4999', name: 'Senior Transition & Post-Graduation Launch', credits: 1, type: 'Career', difficulty: 1, prereqMet: true },
      { code: 'FREE-ELEC-2', name: 'Upper Division Elective', credits: 3, type: 'Elective', difficulty: 2, prereqMet: true },
      { code: 'FREE-ELEC-3', name: 'General Elective', credits: 3, type: 'Elective', difficulty: 1, prereqMet: true }
    ]
  }
];

export const MUTUAL_ADVISOR_SLOTS: AdvisorSlot[] = [
  {
    id: 'slot-1',
    day: 'Wednesday',
    date: 'Oct 14, 2026',
    time: '1:30 PM - 2:00 PM',
    advisorAvailable: true,
    studentFree: true,
    mutualMatch: true,
    formatOptions: ['In-Person', 'Zoom Virtual']
  },
  {
    id: 'slot-2',
    day: 'Wednesday',
    date: 'Oct 14, 2026',
    time: '2:15 PM - 2:45 PM',
    advisorAvailable: true,
    studentFree: false, // Tyler has BUSMHR 2292 lecture at 2:15 PM!
    mutualMatch: false,
    formatOptions: ['In-Person']
  },
  {
    id: 'slot-3',
    day: 'Thursday',
    date: 'Oct 15, 2026',
    time: '10:30 AM - 11:00 AM',
    advisorAvailable: true,
    studentFree: true, // After CSE 2221 lab
    mutualMatch: true,
    formatOptions: ['In-Person', 'Zoom Virtual', 'Phone']
  },
  {
    id: 'slot-4',
    day: 'Thursday',
    date: 'Oct 15, 2026',
    time: '11:30 AM - 12:00 PM',
    advisorAvailable: false, // Advisor in department meeting
    studentFree: true,
    mutualMatch: false,
    formatOptions: ['Zoom Virtual']
  },
  {
    id: 'slot-5',
    day: 'Friday',
    date: 'Oct 16, 2026',
    time: '2:00 PM - 2:30 PM',
    advisorAvailable: true,
    studentFree: true,
    mutualMatch: true,
    formatOptions: ['Zoom Virtual', 'In-Person']
  },
  {
    id: 'slot-6',
    day: 'Monday',
    date: 'Oct 19, 2026',
    time: '9:00 AM - 9:30 AM',
    advisorAvailable: true,
    studentFree: true,
    mutualMatch: true,
    formatOptions: ['In-Person', 'Zoom Virtual']
  }
];

export const SURVEY_DATA_HIGHLIGHTS = {
  title: 'OSU Undergraduate Advising Experience Survey Results',
  sourceUrl: 'https://osu-undergrad-advising-survey.ai.studio',
  sampleSize: '1,428 Ohio State Undergraduates (Autumn 2026)',
  metrics: [
    {
      stat: '89%',
      label: 'Instant Prereq & Overlap Checks',
      description: 'Wanted an instant check on course prereqs & exam conflicts instead of waiting 14+ days during enrollment windows.'
    },
    {
      stat: '84%',
      label: 'Workload Balance in 4-Year Plans',
      description: 'Felt trapped taking multiple high-burnout weed-out courses in one term without a balanced roadmap.'
    },
    {
      stat: '92%',
      label: 'Mutual Schedule Availability',
      description: 'Hated playing email tag with advisors to find an open time slot that fits their class schedule.'
    },
    {
      stat: '78%',
      label: 'Verified Policy Citations',
      description: 'Stated they only trust AI advising if it cites exact OSU Bulletins/DARS rules and honestly flags uncertainty.'
    },
    {
      stat: '81%',
      label: 'Native BuckeyeLink Hold Resolution',
      description: 'Wanted one-click hold clearance guidance directly where they see the red hold badge in BuckeyeLink.'
    }
  ]
};

export const INITIAL_AI_CONVERSATION = [
  {
    id: 'msg-1',
    role: 'assistant' as const,
    text: "Hello Tyler! I'm your native BuckeyeLink Advising Assistant. I see you're currently in your 2nd year pursuing a Finance BSBA with a Business Analytics & CIS minor. \n\n⚠️ **Notice:** You currently have a **Registration Lock** hold for your Second-Year Academic Plan check-in. I can help you review your requirements, optimize your 4-year plan, and coordinate with your advisor Sarah Jenkins to clear your hold.",
    sourceCitation: 'BuckeyeLink Student Center Status & Fisher Advising Milestone Rules 2026',
    confidence: 'high' as const,
    confidenceExplanation: 'Loaded directly from Ohio State SIS Records and DARS Degree Audit rules.',
    escalationSuggested: true,
    escalationReason: 'Registration Lock hold requires mutual advisor confirmation to lift prior to Spring 2027 enrollment.',
    suggestedActions: [
      'Explain my Registration Lock hold',
      'Check my Spring 2027 prerequisite readiness',
      'Optimize 4-year roadmap for workload balance',
      'Match availability with Sarah Jenkins'
    ]
  }
];
