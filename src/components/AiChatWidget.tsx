import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  X,
  Calendar,
  BookOpen,
  MessageSquare,
  AlertCircle,
  AlertTriangle,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Check,
  ShieldCheck,
  Info,
  Star,
  Search,
  SlidersHorizontal,
  ExternalLink,
  BellRing,
  Zap,
  Lock,
  Building2,
  CreditCard
} from 'lucide-react';
import { StudentProfile, Semester, AdvisorSlot, MUTUAL_ADVISOR_SLOTS } from '../data/sampleData';
import { HighStakesDecisionCard, HighStakesDecisionData } from './HighStakesDecisionCard';
import { SeatAlertsView, WatchedCourse } from './SeatAlertsView';
import { AfterHoursAccessView } from './AfterHoursAccessView';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  sourceCitation?: string;
  confidence?: 'high' | 'moderate' | 'uncertain';
  confidenceExplanation?: string;
  escalationSuggested?: boolean;
  highStakesDecision?: HighStakesDecisionData | null;
}

interface AiChatWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  profile: StudentProfile;
  messages: ChatMessage[];
  onSendMessage: (text: string) => Promise<void>;
  isLoading: boolean;
  roadmap: Semester[];
  onUpdateRoadmap: (promptText: string) => Promise<void>;
  isRoadmapUpdating: boolean;
  bookedSlot?: AdvisorSlot | null;
  onConfirmBooking: (slot: AdvisorSlot, format: string, notes: string) => void;
  onUpdateDecision?: (messageId: string, updatedDecision: HighStakesDecisionData) => void;
  onBackToDashboard?: () => void;
  onNextStep?: () => void;
  initialTab?: 'chat' | 'roadmap' | 'whatif' | 'rmp' | 'advisor' | 'seatAlerts' | 'studyAccess';
  onSimulateSeatDrop?: (course: WatchedCourse) => void;
}

interface MinorOption {
  id: string;
  name: string;
  college: string;
  totalCredits: number;
  creditsCompleted: number;
  alreadyTaken: { code: string; name: string; credits: number }[];
  remainingNeeded: { code: string; name: string; term: string; credits: number }[];
  graduationDelay: string;
  synergyScore: string;
  careerMatch: string;
  description: string;
}

const MINOR_OPTIONS: MinorOption[] = [
  {
    id: 'analytics',
    name: 'Business Analytics & CIS Minor',
    college: 'Fisher College of Business',
    totalCredits: 15,
    creditsCompleted: 7,
    alreadyTaken: [
      { code: 'STAT 1430.01', name: 'Statistics for Business (GE Foundation)', credits: 4 },
      { code: 'CSE 2221', name: 'Software I: Software Components (Taking Now)', credits: 3 }
    ],
    remainingNeeded: [
      { code: 'BUSOBA 2320', name: 'Decision Sciences', term: 'Spring 2027', credits: 3 },
      { code: 'CSE 3241', name: 'Introduction to Database Systems', term: 'Spring 2028', credits: 3 },
      { code: 'BUSOBA 4240', name: 'Applied Predictive Analytics & AI', term: 'Spring 2029', credits: 3 }
    ],
    graduationDelay: '0 Months (Graduating on time in May 2029)',
    synergyScore: '98% Overlap Synergy with Finance Major',
    careerMatch: 'Financial Data Analyst, Quantitative Trader, FinTech Consultant',
    description: 'Combines data analytics with programming. 40% of the minor is already completed through your existing business statistics and CSE courses.'
  },
  {
    id: 'cse',
    name: 'Computer Science (CSE) Minor',
    college: 'College of Engineering',
    totalCredits: 16,
    creditsCompleted: 8,
    alreadyTaken: [
      { code: 'MATH 1151', name: 'Calculus I (Completed)', credits: 5 },
      { code: 'CSE 2221', name: 'Software I: Software Components (Taking Now)', credits: 3 }
    ],
    remainingNeeded: [
      { code: 'CSE 2231', name: 'Software II: Development & Components', term: 'Spring 2027', credits: 4 },
      { code: 'CSE 2321', name: 'Foundations I: Discrete Structures', term: 'Autumn 2027', credits: 3 },
      { code: 'CSE 2421', name: 'Systems I: Computer Architecture', term: 'Spring 2028', credits: 4 },
      { code: 'CSE 3000+', name: 'Advanced CSE Technical Elective', term: 'Autumn 2028', credits: 3 }
    ],
    graduationDelay: '0 Months (Graduating on time in May 2029)',
    synergyScore: '92% Technical Synergy',
    careerMatch: 'Algorithmic Trading, Financial Software Engineer, Systems Analyst',
    description: 'Deep technical foundation in algorithms and software systems. Calculus 1 and Software 1 count toward the prerequisite baseline.'
  },
  {
    id: 'econ',
    name: 'Economics Minor',
    college: 'College of Arts and Sciences',
    totalCredits: 15,
    creditsCompleted: 10,
    alreadyTaken: [
      { code: 'ECON 2001.01', name: 'Principles of Microeconomics (Completed)', credits: 3 },
      { code: 'ECON 2002.01', name: 'Principles of Macroeconomics (Completed)', credits: 3 },
      { code: 'STAT 1430.01', name: 'Statistics for Business (Completed)', credits: 4 }
    ],
    remainingNeeded: [
      { code: 'ECON 4001.01', name: 'Intermediate Microeconomic Theory', term: 'Autumn 2027', credits: 3 },
      { code: 'ECON 4400', name: 'Money & Banking', term: 'Spring 2028', credits: 3 }
    ],
    graduationDelay: '0 Months (Fastest Minor: Only 2 classes left)',
    synergyScore: '95% Finance Core Synergy',
    careerMatch: 'Economic Forecaster, Central Banking, Investment Research',
    description: 'The fastest minor to complete: 10 credits already satisfied from your core Finance pre-major requirements. You only need 2 upper-division economics courses.'
  },
  {
    id: 'realestate',
    name: 'Real Estate Minor',
    college: 'Fisher College of Business',
    totalCredits: 12,
    creditsCompleted: 3,
    alreadyTaken: [
      { code: 'ECON 2001.01', name: 'Principles of Microeconomics (Completed)', credits: 3 }
    ],
    remainingNeeded: [
      { code: 'BUSFIN 3400', name: 'Introduction to Real Estate', term: 'Autumn 2027', credits: 3 },
      { code: 'BUSFIN 4410', name: 'Real Estate Finance & Commercial Lending', term: 'Spring 2028', credits: 3 },
      { code: 'BUSFIN 4412', name: 'Real Estate Valuation & Property Markets', term: 'Autumn 2028', credits: 3 }
    ],
    graduationDelay: '0 Months (Graduating on time in May 2029)',
    synergyScore: '90% Asset Management Synergy',
    careerMatch: 'Commercial Real Estate Brokerage, REIT Analyst, Property Portfolio Manager',
    description: 'Specializes in property valuation and commercial real estate finance. Taught by Fisher Finance faculty.'
  }
];

interface ProfessorReview {
  id: string;
  name: string;
  department: string;
  departmentCategory: 'Fisher Business' | 'Computer Science' | 'Mathematics' | 'Economics';
  courses: string[];
  overallRating: number;
  difficultyRating: number;
  wouldTakeAgainPercent: number;
  totalReviews: number;
  redditMentions: number;
  category: 'Current Term' | 'Spring 2027 Option' | 'Popular Faculty';
  workloadLevel: 'Heavy Workload (12-15+ hrs/wk)' | 'Demanding (10-12 hrs/wk)' | 'Moderate (6-8 hrs/wk)' | 'Manageable (4-5 hrs/wk)';
  estimatedHours: string;
  workloadWarning?: string;
  recommendations: string[];
  redditQuote: string;
  topTip: string;
  tags: string[];
}

const PROFESSOR_REVIEWS: ProfessorReview[] = [
  {
    id: 'marc-smith',
    name: 'Marc Smith',
    department: 'Department of Accounting & MIS',
    departmentCategory: 'Fisher Business',
    courses: ['ACCTMIS 2200', 'ACCTMIS 2300'],
    overallRating: 4.7,
    difficultyRating: 4.2,
    wouldTakeAgainPercent: 91,
    totalReviews: 412,
    redditMentions: 184,
    category: 'Current Term',
    workloadLevel: 'Heavy Workload (12-15+ hrs/wk)',
    estimatedHours: '12 – 15+ hrs / week outside class',
    workloadWarning: 'Heavy Workload Warning: Marc Smith\'s accounting classes (ACCTMIS 2200 & 2300) are notorious across Ohio State for being a massive amount of work. Students emphasize that you cannot treat this like an ordinary 3-credit class — expect demanding weekly Carmen modules, cumulative chapter homework, and high-stakes midterms.',
    recommendations: [
      'Heavy Workload Reality: His accounting class is A LOT of work! Budget at least 12 to 15 hours every week outside of lecture strictly for homework packets and problem walkthroughs.',
      'Never Fall Behind on Weekly Quizzes: Financial and managerial accounting concepts build cumulatively. If you get behind on even one chapter, catching up before midterm week becomes nearly impossible.',
      'Watch Every Sunday Problem Walkthrough: Marc Smith hosts or posts Sunday problem review sessions where he solves exam-caliber problems step-by-step. His Friday midterms mirror these walkthroughs almost question-for-question.',
      'Complete Practice Exam Packets Twice: Work through each past exam packet at least two times under timed conditions before test day; he re-uses identical problem architectures.',
      'Semester Balance Recommendation: Do NOT take Marc Smith\'s accounting class in the same semester with more than one other heavy quantitative weed-out course (like Calculus 2 or CSE 2221) without buffering with lighter GE Theme courses.',
      'Use the Accounting Learning Center (ALC): Take advantage of free drop-in ALC peer tutoring in Mason Hall during the first 3 weeks rather than waiting for exam week crunches.'
    ],
    redditQuote: '"Marc Smith is legendary on r/OSU and easily one of the best professors at Ohio State, but make NO mistake: his accounting class is A TON of work. You will spend 12-15 hours a week grinding practice problems and watching Sunday walkthroughs. If you stay on top of the chapter quizzes and do the practice exams twice, you can earn an A, but you cannot slack off."',
    topTip: 'Work through the practice exams twice before each midterm; he re-uses identical problem structures. Never skip his Sunday exam prep sessions.',
    tags: ['A Lot of Work', '12-15 hrs/wk', 'Legendary Lecturer', 'Sunday Walkthroughs', 'Demanding Homework', 'Fair Curve', 'Fisher Prereq']
  },
  {
    id: 'paolo-bucci',
    name: 'Dr. Paolo Bucci',
    department: 'Computer Science & Engineering',
    departmentCategory: 'Computer Science',
    courses: ['CSE 2221', 'CSE 2231'],
    overallRating: 4.6,
    difficultyRating: 3.8,
    wouldTakeAgainPercent: 88,
    totalReviews: 295,
    redditMentions: 142,
    category: 'Current Term',
    workloadLevel: 'Demanding (10-12 hrs/wk)',
    estimatedHours: '10 – 12 hrs / week outside class',
    workloadWarning: 'Challenging Programming Workload: Software I & II components require rigorous discipline and early project planning.',
    recommendations: [
      'Challenging Projects: Software I projects ramp up sharply in difficulty around Projects 3 and 4.',
      'Start Coding Early: Begin lab assignments at least 4 to 5 days before the deadline so you have time for edge-case unit testing.',
      'Caldwell Lab Office Hours: Bucci and the CSE teaching assistants provide thorough 1-on-1 debugging help during office hours.'
    ],
    redditQuote: '"Literally built the software components framework used in OSU CSE. He is super patient in Caldwell Lab office hours. Projects take time, but you truly learn solid software engineering."',
    topTip: 'Start Projects 3 and 4 at least 4 days before the deadline so you have time for edge-case unit testing.',
    tags: ['OSU Framework Creator', 'Challenging Projects', 'Cares Deeply', 'Helpful in Lab']
  },
  {
    id: 'tad-brinkerhoff',
    name: 'Tad Brinkerhoff',
    department: 'Department of Finance (Fisher)',
    departmentCategory: 'Fisher Business',
    courses: ['BUSFIN 3220', 'BUSFIN 4211'],
    overallRating: 4.8,
    difficultyRating: 2.9,
    wouldTakeAgainPercent: 95,
    totalReviews: 320,
    redditMentions: 110,
    category: 'Spring 2027 Option',
    workloadLevel: 'Moderate (6-8 hrs/wk)',
    estimatedHours: '6 – 8 hrs / week outside class',
    recommendations: [
      'Master the BA II Plus Financial Calculator: Practice time-value-of-money and bond valuation keys in Week 2.',
      'Attend Exam Reviews: His exam reviews cover exact calculation formats seen on midterms.',
      'Review Slide Practice Problems: Test concepts are grounded directly in lecture slide walk-throughs.'
    ],
    redditQuote: '"Best finance instructor at Fisher College. Makes corporate finance, DCF valuation, and bond math actually entertaining. His exam reviews are gold."',
    topTip: 'Master the Texas Instruments BA II Plus financial calculator shortcuts in Week 2.',
    tags: ['Student Favorite', 'High Energy', 'Clear Slides', 'Practical Math']
  },
  {
    id: 'jeremy-morris',
    name: 'Dr. Jeremy Morris',
    department: 'Computer Science & Engineering',
    departmentCategory: 'Computer Science',
    courses: ['CSE 2231', 'CSE 3241'],
    overallRating: 4.9,
    difficultyRating: 2.7,
    wouldTakeAgainPercent: 97,
    totalReviews: 240,
    redditMentions: 125,
    category: 'Spring 2027 Option',
    workloadLevel: 'Moderate (6-8 hrs/wk)',
    estimatedHours: '7 – 9 hrs / week outside class',
    recommendations: [
      'Snag Enrollment Early: His Software II sections fill within minutes of the enrollment window opening.',
      'Attend Friday Lab Checkpoints: Get direct feedback from Dr. Morris before final component submission.',
      'Generous Partial Credit: Write down class invariants and design thought process even if code isn\'t 100% complete.'
    ],
    redditQuote: '"If Morris has an open seat for Software II (CSE 2231) on your enrollment window, snap it up immediately! Extremely fair grading and very approachable."',
    topTip: 'Attend Friday lab sections to get 1-on-1 assistance with project checkpoints.',
    tags: ['Top CSE Prof', 'Generous Partial Credit', 'Very Approachable']
  },
  {
    id: 'amit-roy',
    name: 'Dr. Amit Roy',
    department: 'Department of Mathematics',
    departmentCategory: 'Mathematics',
    courses: ['MATH 1151', 'MATH 1152'],
    overallRating: 4.4,
    difficultyRating: 4.2,
    wouldTakeAgainPercent: 82,
    totalReviews: 188,
    redditMentions: 96,
    category: 'Current Term',
    workloadLevel: 'Heavy Workload (12-15+ hrs/wk)',
    estimatedHours: '10 – 14 hrs / week outside class',
    workloadWarning: 'Weed-Out Course Advisory: Calculus 2 has one of the highest drop/fail rates at OSU. Expect fast pacing and abstract series tests.',
    recommendations: [
      'Daily Practice: Do 3 to 5 integration by parts or series problems every single day to stay sharp.',
      'Cockins Hall MSLC: Drop into the Math & Statistics Learning Center weekly before Thursday quizzes.',
      'Organize Chalkboard Proofs: Roy writes crystal-clear proofs on the board; transcribe them into clean summary sheets.'
    ],
    redditQuote: '"Calculus 2 is notorious as an OSU weed-out course, but Roy is one of the best math lecturers on campus. He writes organized step-by-step proofs on the board."',
    topTip: 'Use free drop-in MSLC tutoring in Cockins Hall on Monday afternoons before the weekly quiz.',
    tags: ['Tough Exams', 'Crystal Clear Notes', 'Friendly Office Hours']
  },
  {
    id: 'terry-klinker',
    name: 'Terry Klinker',
    department: 'Management & Human Resources',
    departmentCategory: 'Fisher Business',
    courses: ['BUSMHR 2292'],
    overallRating: 4.9,
    difficultyRating: 2.1,
    wouldTakeAgainPercent: 99,
    totalReviews: 165,
    redditMentions: 78,
    category: 'Current Term',
    workloadLevel: 'Manageable (4-5 hrs/wk)',
    estimatedHours: '4 – 5 hrs / week outside class',
    recommendations: [
      'Take Mock Interviews Seriously: Real corporate recruiters look at the exact speaking style Terry coaches.',
      'One-on-One Resume Critique: Book a 10-minute session with Terry prior to the Fisher Fall Career Expo.'
    ],
    redditQuote: '"Great public speaking coach. You do mock interviews and executive presentations. His resume critique directly helps you get Fisher Career Fair interviews."',
    topTip: 'Schedule a 10-minute 1-on-1 resume review before the Fisher Fall Career Expo.',
    tags: ['Practical Skills', 'Great Resume Advice', 'Easygoing']
  },
  {
    id: 'greg-allen',
    name: 'Dr. Greg Allen',
    department: 'Department of Marketing (Fisher)',
    departmentCategory: 'Fisher Business',
    courses: ['BUSML 3250'],
    overallRating: 4.7,
    difficultyRating: 2.4,
    wouldTakeAgainPercent: 94,
    totalReviews: 195,
    redditMentions: 65,
    category: 'Popular Faculty',
    workloadLevel: 'Manageable (4-5 hrs/wk)',
    estimatedHours: '4 – 6 hrs / week outside class',
    recommendations: [
      'Skim HBR Cases Before Class: Easy participation marks if you speak once per case analysis.',
      'Predictable Midterms: Slides directly map to multiple-choice test questions.'
    ],
    redditQuote: '"Engaging case studies on real consumer brands like Nike and Apple. Tests are conceptual and lecture attendance makes them straightforward."',
    topTip: 'Read the short HBR cases before lecture for easy participation credit.',
    tags: ['Real World Cases', 'Engaging', 'Fair Exams']
  },
  {
    id: 'ida-bauer',
    name: 'Dr. Ida Bauer',
    department: 'Department of Economics',
    departmentCategory: 'Economics',
    courses: ['ECON 2001.01', 'ECON 2002.01'],
    overallRating: 4.6,
    difficultyRating: 2.8,
    wouldTakeAgainPercent: 90,
    totalReviews: 210,
    redditMentions: 82,
    category: 'Popular Faculty',
    workloadLevel: 'Moderate (6-8 hrs/wk)',
    estimatedHours: '5 – 7 hrs / week outside class',
    recommendations: [
      'Print Annotated Slide Decks: Bring printed slides to follow along with graph shift demonstrations.',
      'Work Through Past Review Exams: Practice questions mirror midterm exams with numbers shifted.'
    ],
    redditQuote: '"Explains microeconomic supply/demand curves with everyday Ohio examples. Practice exams mirror midterm questions with only the numbers changed."',
    topTip: 'Print out her annotated slide summaries before Monday review lectures.',
    tags: ['Organized', 'Helpful TAs', 'Predictable Midterms']
  },
  {
    id: 'rajiv-ramnath',
    name: 'Dr. Rajiv Ramnath',
    department: 'Computer Science & Engineering',
    departmentCategory: 'Computer Science',
    courses: ['CSE 3241', 'CSE 3901'],
    overallRating: 4.8,
    difficultyRating: 3.1,
    wouldTakeAgainPercent: 93,
    totalReviews: 175,
    redditMentions: 89,
    category: 'Spring 2027 Option',
    workloadLevel: 'Moderate (6-8 hrs/wk)',
    estimatedHours: '7 – 9 hrs / week outside class',
    recommendations: [
      'Form Reliable Project Groups: Find 2 dedicated teammates in Week 1 for the database implementation semester project.',
      'Practice SQL Joins & Schema Normalization: Core questions appear directly on midterms.'
    ],
    redditQuote: '"Extensive industry experience at IBM and MIT. Teaches relational database design and SQL in a way that directly translates to software engineering internships."',
    topTip: 'Form your 3-person database project group early in Week 2.',
    tags: ['Industry Veteran', 'SQL Fundamentals', 'Great Project Feedback']
  }
];

export const AiChatWidget: React.FC<AiChatWidgetProps> = ({
  isOpen,
  onClose,
  profile,
  messages,
  onSendMessage,
  isLoading,
  roadmap,
  onUpdateRoadmap,
  isRoadmapUpdating,
  bookedSlot,
  onConfirmBooking,
  onUpdateDecision,
  initialTab,
  onSimulateSeatDrop
}) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'roadmap' | 'whatif' | 'rmp' | 'advisor' | 'seatAlerts' | 'studyAccess'>(initialTab || 'chat');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  const [inputText, setInputText] = useState('');
  const [roadmapPrompt, setRoadmapPrompt] = useState('');
  const [expandedYear, setExpandedYear] = useState<number>(2); // Year 2 expanded by default
  const [selectedMinorId, setSelectedMinorId] = useState<string>('analytics');
  const [appliedMinorId, setAppliedMinorId] = useState<string>('analytics');
  const [appliedFeedback, setAppliedFeedback] = useState<string | null>(null);

  // High Stakes Decision State & Handlers
  const [isSubmittingEscalation, setIsSubmittingEscalation] = useState<boolean>(false);
  const [localDecisions, setLocalDecisions] = useState<Record<string, HighStakesDecisionData>>({});

  const handleEscalateToAdvisor = async (messageId: string, decision: HighStakesDecisionData) => {
    setIsSubmittingEscalation(true);
    try {
      const res = await fetch('/api/escalate-decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: profile.name,
          osuId: profile.osuId,
          nameDotNum: profile.nameDotNum,
          decisionType: decision.actionType,
          decisionTitle: decision.decisionTitle,
          userConfirmed: false,
          notes: `Student requested direct advisor consultation regarding: ${decision.decisionTitle}`,
        }),
      });
      const data = await res.json();
      const updated: HighStakesDecisionData = {
        ...decision,
        status: 'escalated_to_advisor',
        ticketId: data.ticketId || `OSU-ADV-${Math.floor(100000 + Math.random() * 900000)}`,
        advisorName: data.advisorName || 'Sarah Jenkins, M.Ed.',
        advisorEmail: data.advisorEmail || 'jenkins.892@osu.edu',
        dispatchedAt: data.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setLocalDecisions((prev) => ({ ...prev, [messageId]: updated }));
      if (onUpdateDecision) {
        onUpdateDecision(messageId, updated);
      }
      // Also open the advisor tab so Tyler can match available appointment times immediately
      setActiveTab('advisor');
    } catch (e) {
      console.error('Failed to escalate to advisor:', e);
    } finally {
      setIsSubmittingEscalation(false);
    }
  };

  const handleConfirmAndSendToAdvisor = async (messageId: string, decision: HighStakesDecisionData) => {
    setIsSubmittingEscalation(true);
    try {
      const res = await fetch('/api/escalate-decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: profile.name,
          osuId: profile.osuId,
          nameDotNum: profile.nameDotNum,
          decisionType: decision.actionType,
          decisionTitle: decision.decisionTitle,
          userConfirmed: true,
          notes: `Student explicitly confirmed understanding all academic risks. Sent directly to Sarah Jenkins for human review and expedited sign-off.`,
        }),
      });
      const data = await res.json();
      const updated: HighStakesDecisionData = {
        ...decision,
        status: 'confirmed_and_sent',
        ticketId: data.ticketId || `OSU-ADV-${Math.floor(100000 + Math.random() * 900000)}`,
        advisorName: data.advisorName || 'Sarah Jenkins, M.Ed.',
        advisorEmail: data.advisorEmail || 'jenkins.892@osu.edu',
        dispatchedAt: data.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setLocalDecisions((prev) => ({ ...prev, [messageId]: updated }));
      if (onUpdateDecision) {
        onUpdateDecision(messageId, updated);
      }
    } catch (e) {
      console.error('Failed to confirm and send decision to advisor:', e);
    } finally {
      setIsSubmittingEscalation(false);
    }
  };

  // Faculty Evaluation filters & search
  const [profSearch, setProfSearch] = useState<string>('');
  const [profDeptFilter, setProfDeptFilter] = useState<'All' | 'Fisher Business' | 'Computer Science' | 'Mathematics' | 'Economics'>('All');
  const [profCategoryFilter, setProfCategoryFilter] = useState<'All' | 'Current Term' | 'Spring 2027 Option'>('All');
  const [sortBy, setSortBy] = useState<'highest-rated' | 'workload' | 'difficulty' | 'would-take-again' | 'reviews'>('highest-rated');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (!isOpen) return null;

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    const text = inputText;
    setInputText('');
    await onSendMessage(text);
  };

  const handleRoadmapSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roadmapPrompt.trim() || isRoadmapUpdating) return;
    const prompt = roadmapPrompt;
    setRoadmapPrompt('');
    await onUpdateRoadmap(prompt);
  };

  const handleBookSlot = (slot: AdvisorSlot) => {
    onConfirmBooking(
      slot,
      'In-Person (Mason Hall 120)',
      'Meeting to review 4-year degree roadmap and remove Registration Lock hold.'
    );
    onSendMessage(`I just booked an advising appointment with Sarah Jenkins on ${slot.day}, ${slot.date} at ${slot.time} to clear my Registration Lock hold.`);
  };

  // Group semesters by academic year for clean, spacious display
  const years = [
    {
      yearNumber: 1,
      title: 'Year 1 (Freshman)',
      status: 'Completed',
      semesters: roadmap.filter((s) => s.id === 'sem-1' || s.id === 'sem-2')
    },
    {
      yearNumber: 2,
      title: 'Year 2 (Sophomore - Current Year)',
      status: 'In Progress',
      semesters: roadmap.filter((s) => s.id === 'sem-3' || s.id === 'sem-4')
    },
    {
      yearNumber: 3,
      title: 'Year 3 (Junior)',
      status: 'Planned',
      semesters: roadmap.filter((s) => s.id === 'sem-5' || s.id === 'sem-6' || s.id === 'sem-summer')
    },
    {
      yearNumber: 4,
      title: 'Year 4 (Senior - Graduation)',
      status: 'Planned',
      semesters: roadmap.filter((s) => s.id === 'sem-7' || s.id === 'sem-8')
    }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Full-screen Container */}
      <div className="bg-white w-full h-full flex flex-col overflow-hidden">
        
        {/* Top Header Bar matching BuckeyeLink institutional styling */}
        <div className="bg-[#ba0c2f] text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight">BuckeyeLink Academic Advising Portal</h2>
              <span className="text-[11px] bg-white/20 text-white px-2 py-0.5 rounded font-medium">
                Prototype: sample data
              </span>
            </div>
            <p className="text-xs text-white/90 mt-0.5">
              Tyler Rez (rez.14) • BSBA in Finance • Advisor: Sarah Jenkins
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded-lg text-white transition-colors"
            title="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Cohesive Navigation Tabs */}
        <div className="bg-white border-b border-gray-200 px-6 flex space-x-1 shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('chat')}
            className={`py-3 px-3.5 font-medium text-xs sm:text-sm border-b-2 flex items-center space-x-2 transition-colors whitespace-nowrap ${
              activeTab === 'chat'
                ? 'border-[#ba0c2f] text-[#ba0c2f] font-semibold bg-white'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Advising Assistant</span>
          </button>

          <button
            onClick={() => setActiveTab('roadmap')}
            className={`py-3 px-3.5 font-medium text-xs sm:text-sm border-b-2 flex items-center space-x-2 transition-colors whitespace-nowrap ${
              activeTab === 'roadmap'
                ? 'border-[#ba0c2f] text-[#ba0c2f] font-semibold bg-white'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>4-Year Degree Plan</span>
          </button>

          <button
            onClick={() => setActiveTab('whatif')}
            className={`py-3 px-3.5 font-medium text-xs sm:text-sm border-b-2 flex items-center space-x-2 transition-colors whitespace-nowrap ${
              activeTab === 'whatif'
                ? 'border-[#ba0c2f] text-[#ba0c2f] font-semibold bg-white'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>What-If Minor Audit</span>
          </button>

          <button
            onClick={() => setActiveTab('rmp')}
            className={`py-3 px-3.5 font-medium text-xs sm:text-sm border-b-2 flex items-center space-x-2 transition-colors whitespace-nowrap ${
              activeTab === 'rmp'
                ? 'border-[#ba0c2f] text-[#ba0c2f] font-semibold bg-white'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            <Star className="w-4 h-4" />
            <span>Faculty Evaluations &amp; Feedback</span>
          </button>

          <button
            onClick={() => setActiveTab('advisor')}
            className={`py-3 px-3.5 font-medium text-xs sm:text-sm border-b-2 flex items-center space-x-2 transition-colors relative whitespace-nowrap ${
              activeTab === 'advisor'
                ? 'border-[#ba0c2f] text-[#ba0c2f] font-semibold bg-white'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Advisor Scheduling</span>
            {!bookedSlot && (
              <span className="w-2 h-2 rounded-full bg-[#ba0c2f] absolute top-3 right-1" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('seatAlerts')}
            className={`py-3 px-3.5 font-medium text-xs sm:text-sm border-b-2 flex items-center space-x-2 transition-colors relative whitespace-nowrap ${
              activeTab === 'seatAlerts'
                ? 'border-[#ba0c2f] text-[#ba0c2f] font-semibold bg-white'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            <BellRing className="w-4 h-4 text-[#ba0c2f]" />
            <span>Waitlist &amp; Seat Alerts</span>
            <span className="bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
              1 OPEN
            </span>
          </button>

          <button
            onClick={() => setActiveTab('studyAccess')}
            className={`py-3 px-3.5 font-medium text-xs sm:text-sm border-b-2 flex items-center space-x-2 transition-colors relative whitespace-nowrap ${
              activeTab === 'studyAccess'
                ? 'border-[#ba0c2f] text-[#ba0c2f] font-semibold bg-white'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            <Building2 className="w-4 h-4 text-[#ba0c2f]" />
            <span>After-Hours Study Access</span>
            <span className="bg-[#ba0c2f] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
              BUCKID
            </span>
          </button>
        </div>

        {/* TAB 1: ADVISING CHAT */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col overflow-hidden bg-white">
            {/* Active Hold Alert Banner */}
            <div className="bg-red-50 border-b border-red-200 px-6 py-3 flex items-center justify-between text-xs sm:text-sm text-red-900 shrink-0">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-[#ba0c2f] shrink-0" />
                <span>
                  <strong>Action Required:</strong> Registration Lock hold requires brief advising check-in before Spring 2027 enrollment.
                </span>
              </div>
              <button
                onClick={() => setActiveTab('advisor')}
                className="bg-[#ba0c2f] hover:bg-[#9d0a27] text-white px-3 py-1.5 rounded text-xs font-semibold shrink-0 transition-colors"
              >
                Clear Hold ➔
              </button>
            </div>

            {/* Chat Messages Stream */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 bg-[#f8fafc]">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div className="text-[11px] text-gray-500 mb-1 font-medium px-1">
                    {msg.role === 'user' ? 'Tyler Rez (You)' : 'BuckeyeLink Advising Service'}
                  </div>

                  <div
                    className={`max-w-[85%] rounded-lg p-4 text-sm leading-relaxed shadow-xs ${
                      msg.role === 'user'
                        ? 'bg-[#ba0c2f] text-white rounded-tr-none'
                        : 'bg-white text-gray-900 border border-gray-200 rounded-tl-none space-y-3'
                    }`}
                  >
                    <div className="whitespace-pre-line text-xs sm:text-sm">{msg.text}</div>

                    {/* Source & Confidence (Compact with Dropdown) */}
                    {msg.role === 'assistant' && (msg.sourceCitation || msg.confidence) && (
                      <div className="pt-2 border-t border-gray-100">
                        <details className="group cursor-pointer">
                          <summary className="flex items-center justify-between text-[11px] text-gray-500 hover:text-gray-800 select-none">
                            <span className="flex items-center space-x-1.5">
                              {msg.confidence === 'high' ? (
                                <span className="inline-flex items-center space-x-1 text-emerald-700 font-medium">
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span>DARS Verified Rule</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center space-x-1 text-amber-700 font-medium">
                                  <AlertCircle className="w-3 h-3 text-amber-600" />
                                  <span>Advisor Review Recommended</span>
                                </span>
                              )}
                            </span>
                            <span className="flex items-center space-x-1 text-[10px] text-gray-400 group-hover:text-gray-600">
                              <span>Source Citation</span>
                              <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" />
                            </span>
                          </summary>
                          <div className="mt-1.5 pt-1.5 border-t border-gray-100 text-[11px] text-gray-600 space-y-1 bg-gray-50/70 p-2 rounded">
                            {msg.sourceCitation && (
                              <div>
                                <strong className="text-gray-800">Source: </strong>
                                <span className="italic">{msg.sourceCitation}</span>
                              </div>
                            )}
                            {msg.confidenceExplanation && (
                              <div className="text-gray-500">{msg.confidenceExplanation}</div>
                            )}
                          </div>
                        </details>
                      </div>
                    )}

                    {/* High-Stakes Decision Serious Warning & Advisor Escalation Guardrail */}
                    {msg.role === 'assistant' && (() => {
                      const dec = localDecisions[msg.id] || msg.highStakesDecision;
                      if (!dec || !dec.isHighStakes) return null;
                      return (
                        <HighStakesDecisionCard
                          decision={dec}
                          onEscalateToAdvisor={(d) => handleEscalateToAdvisor(msg.id, d)}
                          onConfirmAndSend={(d) => handleConfirmAndSendToAdvisor(msg.id, d)}
                          onOpenAdvisorTab={() => setActiveTab('advisor')}
                          isSubmitting={isSubmittingEscalation}
                        />
                      );
                    })()}

                    {/* Interactive BuckID Building Access Quick Link */}
                    {msg.role === 'assistant' && (msg.text.toLowerCase().includes('after-hours') || msg.text.toLowerCase().includes('building') || msg.text.toLowerCase().includes('buckid') || msg.text.toLowerCase().includes('study access')) && (
                      <div className="pt-2 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-red-50/50 p-2.5 rounded-lg border border-red-100 text-xs">
                        <div className="flex items-center space-x-2">
                          <CreditCard className="w-4 h-4 text-[#ba0c2f] shrink-0" />
                          <span className="text-[11px] text-gray-800 font-medium">
                            Request building access: Approved access encodes directly onto your <strong>BuckID</strong>.
                          </span>
                        </div>
                        <button
                          onClick={() => setActiveTab('studyAccess')}
                          className="bg-[#ba0c2f] hover:bg-[#9d0a27] text-white px-2.5 py-1 rounded text-[11px] font-bold transition-colors shrink-0 flex items-center space-x-1"
                        >
                          <span>Open Access Portal</span>
                          <span>➔</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex items-center space-x-2 text-xs text-gray-600 bg-white p-3 rounded-lg border border-gray-200 w-fit">
                  <RefreshCw className="w-4 h-4 text-[#ba0c2f] animate-spin" />
                  <span>Checking Ohio State course catalog and prerequisite records...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Action Suggestion Chips */}
            <div className="px-6 py-2.5 bg-gray-50 border-t border-gray-200 flex items-center space-x-2 overflow-x-auto text-xs shrink-0">
              <span className="font-semibold text-gray-500 shrink-0">Common Inquiries:</span>
              <button
                onClick={() => setActiveTab('studyAccess')}
                className="bg-red-50 border border-red-300 hover:bg-red-100 text-red-950 px-3 py-1.5 rounded whitespace-nowrap transition-colors flex items-center space-x-1 font-semibold"
                title="Request Evening & Weekend Academic Building Access on your BuckID"
              >
                <CreditCard className="w-3.5 h-3.5 text-[#ba0c2f]" />
                <span>After-Hours Study Access (BuckID)</span>
              </button>
              <button
                onClick={() => onSendMessage('How do I request evening and weekend after-hours study access to Mason Hall or Dreese Lab on my BuckID?')}
                className="bg-white border border-gray-300 hover:border-[#ba0c2f] hover:text-[#ba0c2f] px-3 py-1.5 rounded whitespace-nowrap transition-colors flex items-center space-x-1 font-medium"
              >
                <Building2 className="w-3.5 h-3.5 text-gray-500" />
                <span>Building Lock Hours &amp; BuckID Entry</span>
              </button>
              <button
                onClick={() => setActiveTab('seatAlerts')}
                className="bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 text-emerald-950 px-3 py-1.5 rounded whitespace-nowrap transition-colors flex items-center space-x-1 font-semibold"
                title="View Live Waitlist & Instant Seat Drop Alerts"
              >
                <BellRing className="w-3.5 h-3.5 text-emerald-700 animate-pulse" />
                <span>Instant Seat Drop Alerts (1 Open)</span>
              </button>
              <button
                onClick={() => onSendMessage('I want to make the real choice to drop ACCTMIS 2300 right now.')}
                className="bg-red-50 border border-red-300 hover:bg-red-100 text-red-900 px-3 py-1.5 rounded whitespace-nowrap transition-colors flex items-center space-x-1 font-semibold"
                title="Test High-Stakes Class Drop Warning & Advisor Escalation"
              >
                <AlertCircle className="w-3.5 h-3.5 text-red-700" />
                <span>Drop ACCTMIS 2300 (Real Choice)</span>
              </button>
              <button
                onClick={() => onSendMessage('I want the AI to declare the Computer Science (CSE) Minor as my real choice.')}
                className="bg-amber-50 border border-amber-300 hover:bg-amber-100 text-amber-900 px-3 py-1.5 rounded whitespace-nowrap transition-colors flex items-center space-x-1 font-semibold"
                title="Test High-Stakes Minor Declaration & Advisor Escalation"
              >
                <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                <span>Pick Up CSE Minor (Real Choice)</span>
              </button>
              <button
                onClick={() => onSendMessage("What are student evaluations and recommendations for Marc Smith's accounting class? Is it a lot of work?")}
                className="bg-amber-50 border border-amber-300 hover:bg-amber-100 text-amber-900 px-3 py-1.5 rounded whitespace-nowrap transition-colors flex items-center space-x-1 font-semibold"
                title="View Marc Smith Course Evaluations & Workload Recommendations"
              >
                <Star className="w-3.5 h-3.5 text-amber-600 fill-amber-400" />
                <span>Marc Smith Evaluations &amp; Workload</span>
              </button>
              <button
                onClick={() => setActiveTab('rmp')}
                className="bg-white border border-gray-300 hover:border-[#ba0c2f] hover:text-[#ba0c2f] px-3 py-1.5 rounded whitespace-nowrap transition-colors flex items-center space-x-1"
              >
                <Clock className="w-3.5 h-3.5 text-gray-500" />
                <span>Faculty Workload Directory</span>
              </button>
              <button
                onClick={() => onSendMessage('How do I clear my Registration Lock hold?')}
                className="bg-white border border-gray-300 hover:border-[#ba0c2f] hover:text-[#ba0c2f] px-3 py-1.5 rounded whitespace-nowrap transition-colors"
              >
                Clear Registration Lock
              </button>
              <button
                onClick={() => setActiveTab('roadmap')}
                className="bg-white border border-gray-300 hover:border-[#ba0c2f] hover:text-[#ba0c2f] px-3 py-1.5 rounded whitespace-nowrap transition-colors"
              >
                View 4-Year Plan
              </button>
              <button
                onClick={() => onSendMessage('Can I take CSE 2231 and ACCTMIS 2300 together next semester?')}
                className="bg-white border border-gray-300 hover:border-[#ba0c2f] hover:text-[#ba0c2f] px-3 py-1.5 rounded whitespace-nowrap transition-colors"
              >
                Audit CSE 2231 & ACCTMIS 2300
              </button>
              <button
                onClick={() => setActiveTab('advisor')}
                className="bg-white border border-gray-300 hover:border-[#ba0c2f] hover:text-[#ba0c2f] px-3 py-1.5 rounded whitespace-nowrap transition-colors"
              >
                Advisor Availability
              </button>
            </div>

            {/* Prompt Input Bar */}
            <form onSubmit={handleSendChat} className="p-4 bg-white border-t border-gray-200 flex items-center space-x-3 shrink-0">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ask about prerequisites, holds, degree audits, or faculty..."
                disabled={isLoading}
                className="flex-1 text-xs sm:text-sm px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ba0c2f] focus:border-transparent"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isLoading}
                className="bg-[#ba0c2f] hover:bg-[#9d0a27] disabled:bg-gray-300 text-white px-5 py-2.5 rounded-lg font-semibold text-xs sm:text-sm transition-colors flex items-center space-x-1.5 shrink-0"
              >
                <span>Send</span>
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}


        {/* TAB 2: 4-YEAR DEGREE PLAN */}
        {activeTab === 'roadmap' && (
          <div className="flex-1 flex flex-col overflow-hidden bg-[#f8fafc]">
            {/* Top Roadmap Summary Bar */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900">4-Year Degree Completion Roadmap</h3>
                <p className="text-xs text-gray-600 mt-0.5">
                  BSBA in Finance • Specialization in Corporate Finance • Anticipated May 2029
                </p>
              </div>

              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="text-[11px] text-gray-500 font-medium">Degree Credit Progress</div>
                  <div className="text-sm font-bold text-gray-900">45 / 121 Credits Completed (37%)</div>
                </div>
                <div className="w-28 bg-gray-200 h-2 rounded-full overflow-hidden">
                  <div className="bg-[#ba0c2f] h-full w-[37%] rounded-full" />
                </div>
              </div>
            </div>

            {/* Roadmap Semesters View */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {years.map((yr) => {
                const isOpen = expandedYear === yr.yearNumber;

                return (
                  <div key={yr.yearNumber} className="bg-white rounded-lg border border-gray-200 shadow-2xs overflow-hidden">
                    <div
                      onClick={() => setExpandedYear(isOpen ? 0 : yr.yearNumber)}
                      className="p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="font-bold text-sm sm:text-base text-gray-900">{yr.title}</span>
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded font-medium border ${
                            yr.status === 'Completed'
                              ? 'bg-gray-100 text-gray-800 border-gray-300'
                              : yr.status === 'In Progress'
                              ? 'bg-red-50 text-[#ba0c2f] border-red-200 font-semibold'
                              : 'bg-gray-50 text-gray-600 border-gray-200'
                          }`}
                        >
                          {yr.status}
                        </span>
                      </div>

                      <div className="text-gray-400">
                        {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </div>

                    {isOpen && (
                      <div className="p-4 border-t border-gray-200 bg-[#f8fafc] space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {yr.semesters.map((sem) => (
                            <div key={sem.id} className="bg-white p-4 rounded-lg border border-gray-200 shadow-2xs space-y-3">
                              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                <span className="font-bold text-sm text-gray-900">{sem.name}</span>
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs text-gray-500 font-medium">
                                    {sem.totalCredits} Credits
                                  </span>
                                  <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200">
                                    {sem.workloadRating} Workload
                                  </span>
                                </div>
                              </div>

                              <div className="space-y-2">
                                {sem.courses.map((course, idx) => (
                                  <div
                                    key={idx}
                                    className="p-2.5 bg-gray-50/80 rounded border border-gray-200 flex items-center justify-between text-xs"
                                  >
                                    <div>
                                      <div className="font-bold text-gray-900">{course.code}</div>
                                      <div className="text-gray-600 text-[11px]">{course.name}</div>
                                    </div>
                                    <div className="text-right">
                                      <div className="font-medium text-gray-700">{course.credits} cr</div>
                                      <div className="text-[10px] text-gray-500">Prereq Verified</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Roadmap Adjustment Bar */}
            <div className="p-4 bg-white border-t border-gray-200 shrink-0">
              <form onSubmit={handleRoadmapSubmit} className="flex items-center space-x-3">
                <input
                  type="text"
                  value={roadmapPrompt}
                  onChange={(e) => setRoadmapPrompt(e.target.value)}
                  placeholder="Need to adjust your timeline? (e.g., 'Add Summer 2028 internship' or 'Lighten Spring 2027 to 13 credits')..."
                  disabled={isRoadmapUpdating}
                  className="flex-1 text-xs sm:text-sm px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ba0c2f]"
                />
                <button
                  type="submit"
                  disabled={!roadmapPrompt.trim() || isRoadmapUpdating}
                  className="bg-[#ba0c2f] hover:bg-[#9d0a27] disabled:bg-gray-300 text-white px-5 py-2.5 rounded-lg font-semibold text-xs sm:text-sm transition-colors flex items-center space-x-1.5 shrink-0"
                >
                  {isRoadmapUpdating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Rebalancing...</span>
                    </>
                  ) : (
                    <span>Recalculate Roadmap</span>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 3: "WHAT-IF" MINOR & SPECIALIZATION SIMULATOR */}
        {activeTab === 'whatif' && (
          <div className="flex-1 overflow-y-auto p-6 bg-[#f8fafc] space-y-6">
            {/* Header intro */}
            <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 flex items-center space-x-2">
                    <span>What-If Academic Minor Simulator</span>
                  </h3>
                  <p className="text-xs text-gray-600 mt-1 max-w-2xl leading-relaxed">
                    Test how adding an academic minor integrates with your current Finance BSBA requirements. The audit engine cross-checks completed coursework, prerequisite dependencies, and graduation timeline under official Ohio State curriculum guidelines.
                  </p>
                </div>
                {appliedFeedback && (
                  <div className="bg-gray-100 border border-gray-300 text-gray-900 px-3.5 py-1.5 rounded text-xs font-semibold flex items-center space-x-1.5 shrink-0">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>{appliedFeedback}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Minor Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                Select Minor Program:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {MINOR_OPTIONS.map((m) => {
                  const isSelected = selectedMinorId === m.id;
                  const isApplied = appliedMinorId === m.id;

                  return (
                    <div
                      key={m.id}
                      onClick={() => setSelectedMinorId(m.id)}
                      className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-white border-[#ba0c2f] ring-1 ring-[#ba0c2f] shadow-xs'
                          : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50/50 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <span className="font-bold text-xs sm:text-sm text-gray-900 leading-snug">
                          {m.name}
                        </span>
                        {isApplied && (
                          <span className="text-[10px] bg-gray-100 text-gray-800 font-semibold px-1.5 py-0.5 rounded shrink-0 ml-1 border border-gray-200">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-1">{m.college}</div>
                      <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                        <span className="text-gray-600">{m.totalCredits} Total Credits</span>
                        <span className="text-gray-900 font-bold">
                          {Math.round((m.creditsCompleted / m.totalCredits) * 100)}% Met
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected Minor Detailed Audit Card */}
            {(() => {
              const currentMinor = MINOR_OPTIONS.find((m) => m.id === selectedMinorId) || MINOR_OPTIONS[0];

              return (
                <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-2xs space-y-5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="text-base font-bold text-gray-900">{currentMinor.name}</h4>
                        <span className="text-xs bg-gray-100 text-gray-700 font-medium px-2 py-0.5 rounded border border-gray-200">
                          {currentMinor.college}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">{currentMinor.description}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                      <button
                        onClick={() => {
                          setAppliedMinorId(currentMinor.id);
                          onUpdateRoadmap(`Applied ${currentMinor.name} to 4-year degree plan.`);
                          setAppliedFeedback(`Simulated: ${currentMinor.name}`);
                          setTimeout(() => setAppliedFeedback(null), 4000);
                          onSendMessage(`I applied the ${currentMinor.name} to my 4-year roadmap simulation. How does this complement my Finance career objectives?`);
                        }}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300 text-xs font-semibold px-3.5 py-2 rounded transition-colors shadow-2xs"
                        title="Simulate adding this minor on your 4-year degree roadmap"
                      >
                        Simulate on 4-Year Plan
                      </button>

                      <button
                        onClick={() => {
                          onSendMessage(`I want to declare the ${currentMinor.name} as my real choice on my official university record.`);
                          setActiveTab('chat');
                        }}
                        className="bg-[#ba0c2f] hover:bg-[#9d0a27] text-white text-xs font-semibold px-3.5 py-2 rounded transition-colors shadow-2xs flex items-center space-x-1.5"
                        title="Declare minor as official choice (triggers serious warning and advisor escalation)"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Declare as Real Choice</span>
                      </button>
                    </div>
                  </div>

                  {/* Cohesive 3-Part Metric Panel */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3.5 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-200 text-center gap-2 sm:gap-0">
                    <div className="sm:px-3">
                      <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Graduation Timeline</div>
                      <div className="text-xs sm:text-sm font-bold text-gray-900 mt-1">{currentMinor.graduationDelay}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">Fits within 121 credit budget</div>
                    </div>

                    <div className="sm:px-3">
                      <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Curriculum Overlap</div>
                      <div className="text-xs sm:text-sm font-bold text-gray-900 mt-1">{currentMinor.synergyScore}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">Dual-counts toward GE/Major electives</div>
                    </div>

                    <div className="sm:px-3">
                      <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Career Pathways</div>
                      <div className="text-xs sm:text-sm font-bold text-gray-900 mt-1 truncate" title={currentMinor.careerMatch}>
                        {currentMinor.careerMatch}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">High industry placement</div>
                    </div>
                  </div>

                  {/* Course Requirements Breakdown */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
                    {/* Courses Already Completed */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs uppercase tracking-wider text-gray-700">
                          Completed / In-Progress ({currentMinor.creditsCompleted} cr):
                        </span>
                        <span className="text-xs text-gray-600 flex items-center space-x-1">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Satisfied</span>
                        </span>
                      </div>

                      <div className="space-y-2">
                        {currentMinor.alreadyTaken.map((c, i) => (
                          <div
                            key={i}
                            className="p-3 bg-white border border-gray-200 rounded-lg flex items-center justify-between text-xs"
                          >
                            <div>
                              <span className="font-bold text-gray-900">{c.code}</span>
                              <div className="text-gray-600 text-[11px]">{c.name}</div>
                            </div>
                            <span className="font-semibold text-gray-700">{c.credits} cr</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Remaining Courses Needed */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs uppercase tracking-wider text-gray-700">
                          Remaining Requirements ({currentMinor.totalCredits - currentMinor.creditsCompleted} cr):
                        </span>
                        <span className="text-xs text-gray-500">Planned in Roadmap</span>
                      </div>

                      <div className="space-y-2">
                        {currentMinor.remainingNeeded.map((c, i) => (
                          <div
                            key={i}
                            className="p-3 bg-white border border-gray-200 rounded-lg flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-gray-900">{c.code}</span>
                                <span className="text-[10px] bg-gray-100 text-gray-700 font-mono px-1.5 py-0.5 rounded border border-gray-200">
                                  {c.term}
                                </span>
                              </div>
                              <div className="text-gray-600 text-[11px]">{c.name}</div>
                            </div>
                            <span className="font-semibold text-gray-700">{c.credits} cr</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* TAB 4: FACULTY EVALUATIONS & FEEDBACK (PROFESSIONAL, COHERENT, REAL-WORLD DESIGN) */}
        {activeTab === 'rmp' && (
          <div className="flex-1 overflow-y-auto p-6 bg-[#f8fafc] space-y-5">
            {/* Professional Collegiate Directory Header */}
            <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900">
                    Ohio State Faculty Evaluations &amp; Course Feedback
                  </h3>
                  <p className="text-xs text-gray-600 mt-1 max-w-2xl leading-relaxed">
                    Aggregated academic ratings from RateMyProfessors and consensus sentiment from the <strong>r/OSU</strong> student community. View workload expectations, exam difficulty, and teaching methodologies before enrollment.
                  </p>
                </div>
                <div className="bg-gray-100 border border-gray-300 text-gray-800 px-3 py-1.5 rounded text-xs font-medium flex items-center space-x-1.5 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-[#ba0c2f]" />
                  <span>Verified Student Feedback • 2026-2027</span>
                </div>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-2xs space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Search Input */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    type="text"
                    value={profSearch}
                    onChange={(e) => setProfSearch(e.target.value)}
                    placeholder="Search by faculty name or course code (e.g. Marc Smith, Bucci, ACCTMIS 2300, CSE 2221)..."
                    className="w-full text-xs sm:text-sm pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#ba0c2f] placeholder-gray-400"
                  />
                </div>

                {/* Sort Dropdown */}
                <div className="flex items-center space-x-2 shrink-0">
                  <span className="text-xs text-gray-500 font-medium">Sort by:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="text-xs border border-gray-300 rounded-md px-3 py-2 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#ba0c2f]"
                  >
                    <option value="highest-rated">Highest Overall Rating</option>
                    <option value="workload">Heaviest Workload First</option>
                    <option value="would-take-again">Highest Student Recommendation</option>
                    <option value="difficulty">Lowest Exam Difficulty</option>
                    <option value="reviews">Most Total Reviews</option>
                  </select>
                </div>
              </div>

              {/* Department & Term Filter Chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                <span className="text-gray-500 font-medium mr-1">Filter:</span>
                {[
                  { id: 'All', label: 'All Faculty' },
                  { id: 'Current Term', label: 'My Current Term' },
                  { id: 'Spring 2027 Option', label: 'Spring 2027 Options' }
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setProfCategoryFilter(f.id as any)}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors border ${
                      profCategoryFilter === f.id
                        ? 'bg-[#ba0c2f] text-white border-[#ba0c2f]'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}

                <span className="text-gray-300 mx-1">|</span>

                {[
                  { id: 'All', label: 'All Colleges' },
                  { id: 'Fisher Business', label: 'Fisher Business' },
                  { id: 'Computer Science', label: 'Computer Science' },
                  { id: 'Mathematics', label: 'Mathematics' },
                  { id: 'Economics', label: 'Economics' }
                ].map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setProfDeptFilter(d.id as any)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors border ${
                      profDeptFilter === d.id
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Faculty Review Cards */}
            <div className="space-y-4">
              {(() => {
                let filtered = PROFESSOR_REVIEWS.filter((prof) => {
                  const matchesSearch =
                    prof.name.toLowerCase().includes(profSearch.toLowerCase()) ||
                    prof.department.toLowerCase().includes(profSearch.toLowerCase()) ||
                    prof.courses.some((c) => c.toLowerCase().includes(profSearch.toLowerCase()));

                  const matchesCat =
                    profCategoryFilter === 'All' || prof.category === profCategoryFilter;

                  const matchesDept =
                    profDeptFilter === 'All' || prof.departmentCategory === profDeptFilter;

                  return matchesSearch && matchesCat && matchesDept;
                });

                // Apply Sorting
                filtered = [...filtered].sort((a, b) => {
                  if (sortBy === 'highest-rated') return b.overallRating - a.overallRating;
                  if (sortBy === 'workload') return b.difficultyRating - a.difficultyRating; // heaviest workload first
                  if (sortBy === 'would-take-again') return b.wouldTakeAgainPercent - a.wouldTakeAgainPercent;
                  if (sortBy === 'difficulty') return a.difficultyRating - b.difficultyRating; // lowest difficulty first
                  if (sortBy === 'reviews') return b.totalReviews - a.totalReviews;
                  return 0;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500 text-xs">
                      No faculty members found matching your search criteria. Try adjusting the college filter or search terms.
                    </div>
                  );
                }

                return filtered.map((prof) => (
                  <div
                    key={prof.id}
                    className="bg-white rounded-lg border border-gray-200 p-5 shadow-2xs hover:border-gray-300 transition-all space-y-4"
                  >
                    {/* Header Row: Clean, Professional Typography with Workload Badge */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-base font-bold text-gray-900">{prof.name}</h4>
                          <span className="text-[11px] font-medium text-gray-600 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded">
                            {prof.category}
                          </span>
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded border flex items-center space-x-1 ${
                              prof.workloadLevel.includes('Heavy') || prof.workloadLevel.includes('Demanding')
                                ? 'bg-amber-50 text-amber-900 border-amber-300'
                                : 'bg-emerald-50 text-emerald-900 border-emerald-300'
                            }`}
                          >
                            <Clock className="w-3 h-3 shrink-0" />
                            <span>{prof.workloadLevel}</span>
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">{prof.department}</div>
                      </div>

                      {/* Course Codes in Clean Institutional Badges */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {prof.courses.map((course, i) => (
                          <span
                            key={i}
                            className="bg-gray-100 text-gray-800 border border-gray-200 text-xs font-mono font-medium px-2 py-0.5 rounded"
                          >
                            {course}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Workload Warning Advisory Banner (High-Stakes Effort Callout) */}
                    {prof.workloadWarning && (
                      <div className="bg-amber-50/90 border-l-4 border-l-amber-500 border border-amber-200 rounded-r-lg p-3.5 text-xs text-amber-950 flex items-start space-x-2.5">
                        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <div className="font-bold text-amber-900 text-xs uppercase tracking-wide flex flex-wrap items-center gap-2">
                            <span>Workload Advisory &amp; Time Commitment Warning</span>
                            <span className="text-[10px] bg-amber-200/90 text-amber-950 font-bold px-1.5 py-0.5 rounded">
                              {prof.estimatedHours}
                            </span>
                          </div>
                          <p className="text-amber-900 leading-relaxed font-medium">
                            {prof.workloadWarning}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Unified Cohesive Stats Bar */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 grid grid-cols-3 divide-x divide-gray-200 text-center">
                      <div>
                        <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                          Overall Rating
                        </div>
                        <div className="text-lg font-bold text-gray-900 mt-0.5 flex items-center justify-center space-x-1">
                          <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                          <span>{prof.overallRating} / 5.0</span>
                        </div>
                        <div className="text-[11px] text-gray-500 font-normal">
                          {prof.totalReviews} RateMyProfessors reviews
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                          Would Take Again
                        </div>
                        <div className="text-lg font-bold text-gray-900 mt-0.5">
                          {prof.wouldTakeAgainPercent}%
                        </div>
                        <div className="text-[11px] text-gray-500 font-normal">
                          Student recommendation
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                          Difficulty &amp; Workload
                        </div>
                        <div className="text-lg font-bold text-gray-900 mt-0.5">
                          {prof.difficultyRating} / 5.0
                        </div>
                        <div className="text-[11px] text-gray-600 font-medium">
                          {prof.estimatedHours}
                        </div>
                      </div>
                    </div>

                    {/* Student Recommendations & Course Survival Guide */}
                    {prof.recommendations && prof.recommendations.length > 0 && (
                      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-2.5 shadow-2xs">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                          <div className="flex items-center space-x-2 text-xs font-bold text-gray-900">
                            <Sparkles className="w-4 h-4 text-[#ba0c2f]" />
                            <span>Student Recommendations &amp; Course Survival Guide</span>
                          </div>
                          <span className="text-[11px] text-gray-600 font-medium bg-gray-50 border border-gray-200 px-2 py-0.5 rounded">
                            {prof.recommendations.length} vetted peer tips
                          </span>
                        </div>
                        <ul className="space-y-2 text-xs text-gray-800">
                          {prof.recommendations.map((rec, rIdx) => (
                            <li key={rIdx} className="flex items-start space-x-2.5 leading-relaxed">
                              <span className="text-[#ba0c2f] font-bold text-sm leading-none shrink-0 mt-0.5">•</span>
                              <span className="font-normal">{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* r/OSU Student Community Consensus & Syllabus Breakdown (Expandable Dropdown) */}
                    <details className="group border border-gray-200 rounded-lg bg-gray-50/60 p-3 text-xs cursor-pointer">
                      <summary className="flex items-center justify-between text-gray-800 font-semibold text-[11px] select-none hover:text-[#ba0c2f]">
                        <span className="flex items-center space-x-1.5">
                          <Info className="w-3.5 h-3.5 text-[#ba0c2f]" />
                          <span>View r/OSU Community Review &amp; Syllabus Breakdown ({prof.redditMentions} mentions)</span>
                        </span>
                        <ChevronDown className="w-3.5 h-3.5 text-gray-500 transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="mt-2.5 pt-2 border-t border-gray-200 text-gray-700 space-y-2 text-xs">
                        <div className="border-l-3 border-[#ba0c2f] bg-white p-2.5 rounded-r text-gray-800 italic leading-relaxed text-xs">
                          {prof.redditQuote}
                        </div>
                        <div className="bg-white border border-gray-200 rounded p-2 text-xs text-gray-700 flex items-start space-x-1.5">
                          <span className="font-semibold text-gray-900 shrink-0">Syllabus Insight:</span>
                          <span>{prof.topTip}</span>
                        </div>
                      </div>
                    </details>

                    {/* Tags & Action Buttons */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1 border-t border-gray-100">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {prof.tags.map((tag, tIdx) => (
                          <span
                            key={tIdx}
                            className="bg-gray-100 text-gray-600 text-[11px] px-2 py-0.5 rounded font-medium border border-gray-200"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        <button
                          onClick={() => {
                            setActiveTab('seatAlerts');
                          }}
                          className="border border-[#ba0c2f] text-[#ba0c2f] hover:bg-red-50 text-xs font-semibold px-3 py-1.5 rounded transition-colors flex items-center space-x-1"
                          title={`Track waitlist and seat drops for ${prof.courses[0]}`}
                        >
                          <BellRing className="w-3.5 h-3.5" />
                          <span>Seat Alert ({prof.courses[0]})</span>
                        </button>

                        <button
                          onClick={() => {
                            setActiveTab('chat');
                            onSendMessage(`What are the key student recommendations and workload expectations for taking ${prof.courses[0]} with ${prof.name}? How can I balance this class with my other courses?`);
                          }}
                          className="bg-[#ba0c2f] hover:bg-[#9d0a27] text-white text-xs font-semibold px-3 py-1.5 rounded transition-colors flex items-center space-x-1.5 shadow-2xs"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Ask BuckAI</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}

        {/* TAB 5: ADVISOR AVAILABILITY MATCHING & HOLD CLEARANCE */}
        {activeTab === 'advisor' && (
          <div className="flex-1 overflow-y-auto p-6 bg-[#f8fafc] space-y-6">
            {/* Context Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start space-x-3.5">
                <div className="w-11 h-11 rounded-full bg-red-100 text-[#ba0c2f] font-bold flex items-center justify-center text-sm shrink-0 border border-red-200">
                  SJ
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-gray-900">{profile.advisorName}</h3>
                  <p className="text-xs text-gray-600">Senior Academic Advisor • Fisher College of Business</p>
                  <p className="text-xs text-gray-500 mt-0.5">Office: Mason Hall 120 • jenkins.892@osu.edu</p>
                </div>
              </div>

              {bookedSlot ? (
                <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-2 rounded text-xs font-semibold">
                  <div>Appointment Confirmed: {bookedSlot.day}, {bookedSlot.time}</div>
                  <div className="text-[11px] text-emerald-700 font-normal mt-0.5">
                    Registration Lock will clear during advising check-in.
                  </div>
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 text-red-900 px-4 py-2 rounded text-xs">
                  <strong>Hold Status:</strong> Registration Lock
                  <div className="text-[11px] text-red-700 mt-0.5">Select a mutually open appointment window below.</div>
                </div>
              )}
            </div>

            {/* Mutual Free Times */}
            <div className="space-y-3">
              <h4 className="font-bold text-xs sm:text-sm text-gray-900">
                Mutually Open Appointment Windows (Filtered by Class Schedule):
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {MUTUAL_ADVISOR_SLOTS.map((slot) => {
                  const isFree = slot.mutualMatch;
                  const isThisBooked = bookedSlot?.id === slot.id;

                  return (
                    <div
                      key={slot.id}
                      className={`p-4 rounded-lg border transition-all ${
                        isThisBooked
                          ? 'bg-emerald-50/50 border-emerald-400 ring-1 ring-emerald-400 shadow-2xs'
                          : isFree
                          ? 'bg-white border-gray-200 hover:border-gray-300 shadow-2xs'
                          : 'bg-gray-50 border-gray-200 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-bold text-sm text-gray-900">
                            {slot.day}, {slot.date}
                          </div>
                          <div className="text-xs text-gray-600 mt-1 flex items-center space-x-1">
                            <Clock className="w-3.5 h-3.5 text-gray-500" />
                            <span>{slot.time}</span>
                          </div>
                        </div>

                        <div>
                          {isThisBooked ? (
                            <span className="bg-emerald-700 text-white text-xs font-semibold px-2.5 py-1 rounded flex items-center space-x-1">
                              <Check className="w-3.5 h-3.5" />
                              <span>Booked</span>
                            </span>
                          ) : isFree ? (
                            <button
                              onClick={() => handleBookSlot(slot)}
                              className="bg-[#ba0c2f] hover:bg-[#9d0a27] text-white text-xs font-semibold px-3 py-1.5 rounded transition-colors shadow-2xs"
                            >
                              Reserve Slot
                            </button>
                          ) : (
                            <span className="bg-gray-200 text-gray-700 text-xs font-medium px-2 py-0.5 rounded">
                              Conflict
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-gray-100 text-xs">
                        {isFree ? (
                          <span className="text-emerald-800 font-medium">
                            Both Tyler and Sarah Jenkins are free
                          </span>
                        ) : (
                          <span className="text-gray-600">
                            Class Conflict: BUSMHR 2292 lecture
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: INSTANT WAITLIST & SEAT DROP ALERT ENGINE */}
        {activeTab === 'seatAlerts' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#f8fafc]">
            <SeatAlertsView
              onSimulateSeatDrop={(c) => {
                if (onSimulateSeatDrop) {
                  onSimulateSeatDrop(c);
                }
              }}
              onQuickEnroll={(c) => {
                setActiveTab('chat');
                onSendMessage(`Register in ${c.code} (${c.section}) - 1 seat opened in BuckeyeLink.`);
              }}
            />
          </div>
        )}

        {/* TAB 7: BUCKEYELINK AFTER-HOURS STUDY ACCESS (BUCKID ACCESS) */}
        {activeTab === 'studyAccess' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#f8fafc]">
            <AfterHoursAccessView profile={profile} />
          </div>
        )}
      </div>
    </div>
  );
};
