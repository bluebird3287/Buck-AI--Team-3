export interface Course {
  code: string;
  name: string;
  credits: number;
  type: 'GE Foundation' | 'GE Theme' | 'Major Core' | 'Major Specialization' | 'Major Prereq' | 'Major/Math' | 'Minor/Technical' | 'Minor Core' | 'Minor Elective' | 'Minor Capstone' | 'Major Capstone' | 'Experiential' | 'Elective' | 'General' | 'Career';
  difficulty: number; // 1 to 5
  prereqMet: boolean;
  prereqInfo?: string;
  notes?: string;
  grade?: string;
}

export interface Semester {
  id: string;
  name: string;
  status: 'completed' | 'in-progress' | 'planned';
  year?: number; // academic year of the student's degree (1 = first year)
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
  specializationId: string | null;
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

// The prototype's placeholder advisor. Every student is assigned to this advisor
// until we have a real advisor directory.
export const DEFAULT_ADVISOR = {
  advisorName: 'Sarah Jenkins, M.Ed.',
  advisorEmail: 'jenkins.892@osu.edu',
  advisorTitle: 'Senior Academic Advisor',
  advisorOffice: 'Mason Hall 120',
};

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
    studentFree: false, // student has class at this time
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
