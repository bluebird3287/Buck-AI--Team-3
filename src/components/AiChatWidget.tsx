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
  CreditCard,
  ChevronRight,
  GraduationCap,
  ArrowRight,
  Shield,
  Layers,
  Compass,
  CheckCircle2,
  HelpCircle,
  PanelRightClose,
  PanelRightOpen,
  Command,
  Flame,
  FileText,
  UserCheck,
  CornerDownLeft,
  ChevronLeft
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
    workloadWarning: 'Heavy Workload Reality: Marc Smith\'s accounting courses (ACCTMIS 2200 & 2300) are celebrated as Ohio State favorites, but student evaluations overwhelmingly confirm they require 12 to 15+ hours per week of dedicated problem solving. His class cannot be crammed; success requires weekly Carmen mastery.',
    recommendations: [
      'Heavy Workload Reality: Budget 12 to 15 hours every week outside lecture strictly for practice problems and Carmen modules.',
      'Never Fall Behind on Carmen Quizzes: Concepts build cumulatively. Falling behind by even one chapter makes midterms overwhelming.',
      'Watch Every Sunday Problem Walkthrough: Marc Smith\'s Sunday problem walkthroughs mirror his Friday midterms almost identically in structure.',
      'Work Past Exam Packets Twice: Complete each past exam packet at least two times under timed conditions before test day.',
      'Semester Balance: Avoid pairing ACCTMIS 2300 with multiple high-workload weed-out courses (like Calculus 2 or CSE 2221) without buffering with lighter GE Themes.',
      'Use the Accounting Learning Center (ALC): Take advantage of free drop-in tutoring in Mason Hall during the first 3 weeks.'
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
    redditQuote: '"Tad Brinkerhoff is the gold standard for Intro to Finance. Practical, clear examples, and very fair exams."',
    topTip: 'Buy the Texas Instruments BA II Plus calculator early and memorize the cash flow keystrokes.',
    tags: ['Clear Explanations', 'Fair Midterms', 'Great for Finance Majors']
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
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(true);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [commandQuery, setCommandQuery] = useState<string>('');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const [inputText, setInputText] = useState('');
  const [roadmapPrompt, setRoadmapPrompt] = useState('');
  const [expandedYear, setExpandedYear] = useState<number>(2); // Year 2 expanded by default
  const [selectedMinorId, setSelectedMinorId] = useState<string>('analytics');

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
          actionType: decision.actionType,
          decisionTitle: decision.decisionTitle,
          studentName: profile.name,
          studentId: profile.osuId,
          advisorEmail: decision.advisorEmail || profile.advisorEmail,
          consequences: decision.consequences
        })
      });
      const data = await res.json();
      const updated: HighStakesDecisionData = {
        ...decision,
        status: 'escalated_to_advisor',
        ticketId: data.ticketId || `OSU-ADV-${Math.floor(100000 + Math.random() * 900000)}`
      };
      setLocalDecisions((prev) => ({ ...prev, [messageId]: updated }));
      if (onUpdateDecision) {
        onUpdateDecision(messageId, updated);
      }
    } catch {
      const updated: HighStakesDecisionData = {
        ...decision,
        status: 'escalated_to_advisor',
        ticketId: `OSU-ADV-${Math.floor(100000 + Math.random() * 900000)}`
      };
      setLocalDecisions((prev) => ({ ...prev, [messageId]: updated }));
      if (onUpdateDecision) {
        onUpdateDecision(messageId, updated);
      }
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
          actionType: decision.actionType,
          decisionTitle: decision.decisionTitle,
          studentName: profile.name,
          studentId: profile.osuId,
          advisorEmail: decision.advisorEmail || profile.advisorEmail,
          consequences: decision.consequences,
          userConfirmed: true,
          notes: 'Student confirmed understanding all academic risks. Sent directly to Sarah Jenkins for expedited processing.'
        })
      });
      const data = await res.json();
      const updated: HighStakesDecisionData = {
        ...decision,
        status: 'confirmed_and_sent',
        ticketId: data.ticketId || `OSU-ADV-${Math.floor(100000 + Math.random() * 900000)}`
      };
      setLocalDecisions((prev) => ({ ...prev, [messageId]: updated }));
      if (onUpdateDecision) {
        onUpdateDecision(messageId, updated);
      }
    } catch {
      const updated: HighStakesDecisionData = {
        ...decision,
        status: 'confirmed_and_sent',
        ticketId: `OSU-ADV-${Math.floor(100000 + Math.random() * 900000)}`
      };
      setLocalDecisions((prev) => ({ ...prev, [messageId]: updated }));
      if (onUpdateDecision) {
        onUpdateDecision(messageId, updated);
      }
    } finally {
      setIsSubmittingEscalation(false);
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Global Keyboard Shortcuts (Esc to close, ⌘K for Command Palette, ⌘I for Inspector)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (isCommandPaletteOpen) {
          setIsCommandPaletteOpen(false);
        } else {
          onClose();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && isOpen) {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i' && isOpen) {
        e.preventDefault();
        setIsInspectorOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isCommandPaletteOpen]);

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

  interface NavItem {
    id: 'chat' | 'roadmap' | 'whatif' | 'rmp' | 'advisor' | 'seatAlerts' | 'studyAccess';
    label: string;
    subtitle: string;
    icon: React.ElementType;
    badge: string;
    shortcut: string;
    isWarning?: boolean;
    isLive?: boolean;
  }

  interface NavSection {
    sectionTitle: string;
    items: NavItem[];
  }

  // Grouped Navigation Items (Microsoft Fluent + Stripe Console Structure)
  const navSections: NavSection[] = [
    {
      sectionTitle: 'Academic Advising',
      items: [
        {
          id: 'chat',
          label: 'Advising Consultation',
          subtitle: 'Policy & prerequisite guidance',
          icon: MessageSquare,
          badge: 'Active',
          shortcut: '1'
        },
        {
          id: 'roadmap',
          label: '4-Year Degree & DARS Planner',
          subtitle: 'Prerequisites & term balance',
          icon: BookOpen,
          badge: '45/121 cr',
          shortcut: '2'
        },
        {
          id: 'whatif',
          label: 'What-If Credential Audit',
          subtitle: 'CIS & CSE minor simulations',
          icon: Compass,
          badge: '98% Overlap',
          shortcut: '3'
        },
        {
          id: 'rmp',
          label: 'Faculty & Workload Intelligence',
          subtitle: 'Marc Smith & course difficulty',
          icon: Star,
          badge: '4.7 ★',
          shortcut: '4'
        }
      ]
    },
    {
      sectionTitle: 'Campus Operations',
      items: [
        {
          id: 'advisor',
          label: 'Advisor Direct Scheduling',
          subtitle: 'Sarah Jenkins · Hold clearance',
          icon: Calendar,
          badge: !bookedSlot ? 'Hold Active' : 'Booked',
          isWarning: !bookedSlot,
          shortcut: '5'
        },
        {
          id: 'seatAlerts',
          label: 'Waitlist & Seat Radar',
          subtitle: 'Live seat drop notifications',
          icon: BellRing,
          badge: '1 Open',
          isLive: true,
          shortcut: '6'
        },
        {
          id: 'studyAccess',
          label: 'After-Hours Study Access',
          subtitle: '80 buildings & BuckID access',
          icon: Building2,
          badge: 'BuckID RFID',
          shortcut: '7'
        }
      ]
    }
  ];

  const allNavItems: NavItem[] = navSections.flatMap((s) => s.items);
  const currentNav: NavItem = allNavItems.find((n) => n.id === activeTab) || allNavItems[0];

  // Command palette filtered items
  const commandFilteredItems = [
    {
      title: 'Ask about Spring 2027 classes',
      subtitle: 'Prerequisites, core sequences, and load balance',
      action: () => {
        setActiveTab('chat');
        setIsCommandPaletteOpen(false);
        onSendMessage('What classes should I take in Spring 2027 to stay balanced with Finance and CIS?');
      }
    },
    {
      title: 'Review Marc Smith ACCTMIS 2300 workload',
      subtitle: 'Student evaluations, 14.5 hrs/wk reality & Sunday videos',
      action: () => {
        setActiveTab('chat');
        setIsCommandPaletteOpen(false);
        onSendMessage("What are student evaluations and recommendations for Marc Smith's accounting class? Is it a lot of work?");
      }
    },
    {
      title: 'Clear Registration Lock hold',
      subtitle: 'Schedule required 15-minute sophomore plan review',
      action: () => {
        setActiveTab('advisor');
        setIsCommandPaletteOpen(false);
      }
    },
    {
      title: 'Request After-Hours Building Access on BuckID',
      subtitle: 'Late-night & weekend entry to Mason Hall, Dreese, and Caldwell',
      action: () => {
        setActiveTab('studyAccess');
        setIsCommandPaletteOpen(false);
      }
    },
    {
      title: 'Explore 4-Year BSBA Roadmap',
      subtitle: 'DARS graduation tracker and term credit rebalancer',
      action: () => {
        setActiveTab('roadmap');
        setIsCommandPaletteOpen(false);
      }
    },
    {
      title: 'Simulate Computer Science (CSE) Minor',
      subtitle: 'Check overlap credits and graduation timeline impact',
      action: () => {
        setActiveTab('whatif');
        setIsCommandPaletteOpen(false);
      }
    },
    {
      title: 'Check Live Waitlist & Seat Radar',
      subtitle: 'Real-time open seat drops in ACCTMIS and CSE',
      action: () => {
        setActiveTab('seatAlerts');
        setIsCommandPaletteOpen(false);
      }
    }
  ].filter((item) =>
    commandQuery.trim() === ''
      ? true
      : item.title.toLowerCase().includes(commandQuery.toLowerCase()) ||
        item.subtitle.toLowerCase().includes(commandQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 lg:p-6 animate-in fade-in duration-200">
      
      {/* MASTER APPLICATION WORKSPACE SHELL (Apple macOS Window + Stripe Console + Vercel Geist) */}
      <div className="bg-[#fafafa] rounded-2xl shadow-[0_32px_100px_-20px_rgba(0,0,0,0.5),0_0_0_1px_rgba(0,0,0,0.06)] border border-neutral-200/90 w-full max-w-[1440px] h-[95vh] max-h-[940px] flex overflow-hidden font-sans relative">
        
        {/* ========================================================
            LEFT NAVIGATION RAIL (Apple macOS Sidebar + Stripe Console)
           ======================================================== */}
        <aside className="w-72 sm:w-80 bg-[#fbfbfa] border-r border-neutral-200/80 flex flex-col shrink-0 select-none">
          
          {/* Top Brand & Traffic Light Header */}
          <div className="p-4 border-b border-neutral-200/70 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {/* macOS Window Controls Aesthetic */}
              <div className="flex items-center space-x-1.5 mr-1">
                <button
                  onClick={onClose}
                  className="w-3 h-3 rounded-full bg-red-400 hover:bg-red-500 transition-colors"
                  title="Close (Esc)"
                />
                <div className="w-3 h-3 rounded-full bg-amber-400 opacity-60" />
                <div className="w-3 h-3 rounded-full bg-emerald-400 opacity-60" />
              </div>

              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-[#ba0c2f] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  O
                </div>
                <div>
                  <div className="text-xs font-bold tracking-tight text-neutral-900 leading-tight">
                    BuckeyeLink
                  </div>
                  <div className="text-[10px] text-neutral-400 font-medium">
                    Academic Terminal
                  </div>
                </div>
              </div>
            </div>

            <span className="text-[10px] font-mono font-semibold text-neutral-500 bg-neutral-200/60 px-2 py-0.5 rounded">
              OSU SIS
            </span>
          </div>

          {/* Student Identity Card (Apple Settings Account Tile) */}
          <div className="p-3 mx-3 mt-3 bg-white rounded-xl border border-neutral-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.02)] space-y-2">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-full bg-neutral-900 text-white flex items-center justify-center font-bold text-xs shrink-0 tracking-wider">
                TR
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-1.5">
                  <span className="font-bold text-xs text-neutral-900 truncate">{profile.name} Rez</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Enrolled & Good Standing" />
                </div>
                <div className="text-[11px] text-neutral-500 truncate">
                  {profile.rank.split('(')[0]} · {profile.major.split('(')[0]}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-600">
              <span className="truncate">Advisor: <strong>Sarah Jenkins</strong></span>
              <span className="font-mono text-neutral-500 font-semibold shrink-0">GPA 3.68</span>
            </div>
          </div>

          {/* Quick Command Launcher Affordance (⌘K) */}
          <div className="px-3 pt-2">
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="w-full flex items-center justify-between px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200/70 border border-neutral-200/80 rounded-lg text-xs text-neutral-500 transition-colors"
            >
              <span className="flex items-center space-x-1.5">
                <Search className="w-3.5 h-3.5 text-neutral-400" />
                <span>Quick Actions</span>
              </span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white border border-neutral-200 rounded text-neutral-400">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Workspace Section Navigation */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
            {navSections.map((sec, secIdx) => (
              <div key={secIdx} className="space-y-1">
                <div className="px-2 pt-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  {sec.sectionTitle}
                </div>

                {sec.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full p-2 rounded-xl text-left transition-all flex items-center justify-between group ${
                        isActive
                          ? 'bg-white text-neutral-950 font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.06)]'
                          : 'text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100/70'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                            isActive
                              ? 'bg-[#ba0c2f] text-white shadow-xs'
                              : 'bg-neutral-100 text-neutral-500 group-hover:bg-neutral-200 group-hover:text-neutral-900'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="truncate">
                          <div className="text-xs truncate">{item.label}</div>
                          <div className="text-[10px] text-neutral-400 font-normal truncate">
                            {item.subtitle}
                          </div>
                        </div>
                      </div>

                      {/* Clean Vercel-style status tag */}
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ml-1.5 transition-colors ${
                          item.isWarning
                            ? 'bg-red-50 text-red-700 font-bold border border-red-200'
                            : item.isLive
                            ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200 animate-pulse'
                            : isActive
                            ? 'bg-neutral-100 text-neutral-800 font-bold'
                            : 'text-neutral-400'
                        }`}
                      >
                        {item.badge}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Bottom Hold Clearance Tile */}
          <div className="p-3 border-t border-neutral-200/80 bg-white">
            <div className="p-2.5 bg-red-50/80 rounded-xl border border-red-200 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-red-900 flex items-center space-x-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-[#ba0c2f]" />
                  <span>Registration Lock Hold</span>
                </span>
                <span className="text-[10px] bg-red-100 text-red-800 font-bold px-1.5 py-0.5 rounded">
                  Action Required
                </span>
              </div>
              <p className="text-[11px] text-red-800/90 leading-relaxed">
                15-minute sophomore plan review needed prior to Spring 2027 enrollment.
              </p>
              <button
                onClick={() => setActiveTab('advisor')}
                className="w-full bg-[#ba0c2f] hover:bg-[#9e0a28] text-white text-[11px] font-bold py-1.5 rounded-lg transition-colors flex items-center justify-center space-x-1"
              >
                <span>Book Sarah Jenkins</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="mt-2.5 flex items-center justify-between text-[11px] text-neutral-400 px-1 font-mono">
              <span className="flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>BuckID RFID Active</span>
              </span>
              <span>Esc to close</span>
            </div>
          </div>
        </aside>

        {/* ========================================================
            CENTER PRIMARY WORKSPACE CANVAS
           ======================================================== */}
        <main className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden">
          
          {/* Frosted Glass Top Bar (Apple macOS / Fluent Ribbon) */}
          <header className="h-14 px-5 border-b border-neutral-200/80 flex items-center justify-between shrink-0 bg-white/85 backdrop-blur-md">
            
            {/* Breadcrumb Hierarchy */}
            <div className="flex items-center space-x-2 text-xs">
              <span className="text-neutral-400">BuckeyeLink</span>
              <span className="text-neutral-300">/</span>
              <span className="text-neutral-500 font-medium">Academic Workspace</span>
              <span className="text-neutral-300">/</span>
              <span className="text-neutral-900 font-bold flex items-center space-x-1.5">
                <span>{currentNav.label}</span>
              </span>
            </div>

            {/* Right Action Icons & Inspector Toggle */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              <span className="hidden md:inline-block text-[11px] text-neutral-400 font-mono">
                Student ID: <strong>{profile.osuId}</strong>
              </span>

              {/* Inspector Sheet Toggle Button (Apple macOS Style) */}
              <button
                onClick={() => setIsInspectorOpen((prev) => !prev)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors flex items-center space-x-1.5 ${
                  isInspectorOpen
                    ? 'bg-neutral-100 border-neutral-300 text-neutral-900'
                    : 'bg-white border-neutral-200 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50'
                }`}
                title="Toggle Student Dossier Inspector (⌘I)"
              >
                {isInspectorOpen ? (
                  <PanelRightClose className="w-3.5 h-3.5" />
                ) : (
                  <PanelRightOpen className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">Dossier</span>
                <kbd className="hidden lg:inline text-[10px] font-mono text-neutral-400">⌘I</kbd>
              </button>

              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 flex items-center justify-center transition-colors"
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* ========================================================
              WORKSPACE 1: ADVISING CONSULTATION (CHAT CO-PILOT)
             ======================================================== */}
          {activeTab === 'chat' && (
            <div className="flex-1 flex flex-col min-h-0 relative bg-[#fdfdfc]">
              
              {/* Message Stream */}
              <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-6 space-y-6">
                
                {/* Executive Overview Greeting Card (Stripe / Apple News Style) */}
                {messages.length <= 2 && (
                  <div className="p-6 bg-white rounded-2xl border border-neutral-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.02)] space-y-4 max-w-3xl mx-auto">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-[#ba0c2f]">
                          Autumn 2026 Academic Term
                        </div>
                        <h3 className="text-lg font-bold text-neutral-900 tracking-tight">
                          Good afternoon, {profile.name}.
                        </h3>
                        <p className="text-xs text-neutral-600 leading-relaxed max-w-xl">
                          You are currently enrolled in 14 credit hours across Fisher and Engineering. Your <strong>Registration Lock</strong> hold requires a brief advising review before Spring 2027 enrollment begins.
                        </p>
                      </div>
                      <div className="w-12 h-12 rounded-2xl bg-[#ba0c2f]/10 text-[#ba0c2f] flex items-center justify-center shrink-0">
                        <GraduationCap className="w-6 h-6" />
                      </div>
                    </div>

                    {/* 3 Stripe-Style Curated Quick Action Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                      <button
                        onClick={() => onSendMessage('How do I clear my Registration Lock hold for Spring 2027 enrollment?')}
                        className="p-3 rounded-xl border border-neutral-200 hover:border-[#ba0c2f] hover:bg-red-50/20 text-left transition-all group"
                      >
                        <div className="text-xs font-bold text-neutral-900 group-hover:text-[#ba0c2f] flex items-center justify-between">
                          <span>Hold Clearance</span>
                          <ArrowRight className="w-3 h-3 text-neutral-400 group-hover:text-[#ba0c2f] transition-transform group-hover:translate-x-0.5" />
                        </div>
                        <div className="text-[11px] text-neutral-500 mt-1">
                          Review steps to clear your Second-Year Milestone check-in.
                        </div>
                      </button>

                      <button
                        onClick={() => onSendMessage("What are student evaluations and recommendations for Marc Smith's accounting class? Is it a lot of work?")}
                        className="p-3 rounded-xl border border-neutral-200 hover:border-[#ba0c2f] hover:bg-red-50/20 text-left transition-all group"
                      >
                        <div className="text-xs font-bold text-neutral-900 group-hover:text-[#ba0c2f] flex items-center justify-between">
                          <span>Marc Smith Workload</span>
                          <ArrowRight className="w-3 h-3 text-neutral-400 group-hover:text-[#ba0c2f] transition-transform group-hover:translate-x-0.5" />
                        </div>
                        <div className="text-[11px] text-neutral-500 mt-1">
                          Workload reality (14 hrs/wk) &amp; Sunday exam walkthroughs.
                        </div>
                      </button>

                      <button
                        onClick={() => setActiveTab('studyAccess')}
                        className="p-3 rounded-xl border border-neutral-200 hover:border-[#ba0c2f] hover:bg-red-50/20 text-left transition-all group"
                      >
                        <div className="text-xs font-bold text-neutral-900 group-hover:text-[#ba0c2f] flex items-center justify-between">
                          <span>After-Hours Access</span>
                          <ArrowRight className="w-3 h-3 text-neutral-400 group-hover:text-[#ba0c2f] transition-transform group-hover:translate-x-0.5" />
                        </div>
                        <div className="text-[11px] text-neutral-500 mt-1">
                          Request evening &amp; weekend BuckID building permissions.
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {/* Stream of Chat Messages */}
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col max-w-3xl mx-auto ${
                      msg.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div className="text-[11px] text-neutral-400 mb-1 px-1 font-medium">
                      {msg.role === 'user' ? 'You (Tyler Rez)' : 'Ohio State Academic Advising'}
                    </div>

                    {msg.role === 'user' ? (
                      <div className="bg-neutral-900 text-white rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed max-w-[85%] shadow-xs">
                        {msg.text}
                      </div>
                    ) : (
                      <div className="bg-white rounded-2xl p-5 border border-neutral-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3.5 max-w-[95%] sm:max-w-[92%] border-l-4 border-l-[#ba0c2f]">
                        <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                          <div className="flex items-center space-x-2 text-xs font-semibold text-neutral-900">
                            <div className="w-5 h-5 rounded-md bg-[#ba0c2f] text-white flex items-center justify-center text-[10px] font-bold">
                              O
                            </div>
                            <span>Verified University Curriculum Guidance</span>
                          </div>
                          <span className="text-[10px] font-mono text-neutral-400">
                            Ohio State SIS
                          </span>
                        </div>

                        <div className="whitespace-pre-line text-xs sm:text-sm text-neutral-800 leading-relaxed font-sans">
                          {msg.text}
                        </div>

                        {/* ========================================================
                            DYNAMIC DOMAIN ARTIFACT: MARC SMITH WORKLOAD DOSSIER
                           ======================================================== */}
                        {(msg.text.toLowerCase().includes('marc smith') ||
                          msg.text.toLowerCase().includes('acctmis 2300') ||
                          msg.text.toLowerCase().includes('acctmis 2200')) && (
                          <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 text-xs space-y-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                  Faculty Workload Intelligence
                                </span>
                                <h4 className="font-bold text-sm text-neutral-900 mt-1">
                                  Marc Smith (Department of Accounting &amp; MIS)
                                </h4>
                              </div>
                              <span className="text-xs font-mono font-bold text-neutral-900 bg-white border border-neutral-200 px-2 py-1 rounded">
                                4.7 ★ · 412 Reviews
                              </span>
                            </div>

                            {/* Stripe-style workload metric bar */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                              <div className="p-2 bg-white rounded-lg border border-neutral-200">
                                <div className="text-[10px] text-neutral-400 font-medium">Workload Index</div>
                                <div className="font-bold text-red-700 text-xs mt-0.5">14.5 hrs / week</div>
                              </div>
                              <div className="p-2 bg-white rounded-lg border border-neutral-200">
                                <div className="text-[10px] text-neutral-400 font-medium">Midterm Structure</div>
                                <div className="font-bold text-neutral-800 text-xs mt-0.5">Mirror Sunday Videos</div>
                              </div>
                              <div className="p-2 bg-white rounded-lg border border-neutral-200">
                                <div className="text-[10px] text-neutral-400 font-medium">Drop-In Tutoring</div>
                                <div className="font-bold text-neutral-800 text-xs mt-0.5">Mason Hall ALC (Free)</div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-1">
                              <span className="text-[11px] text-neutral-500">
                                Want to compare all faculty reviews and survival guides?
                              </span>
                              <button
                                onClick={() => setActiveTab('rmp')}
                                className="text-[#ba0c2f] hover:underline font-bold text-xs flex items-center space-x-1"
                              >
                                <span>Open Faculty Matrix</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}

                        {/* ========================================================
                            DYNAMIC DOMAIN ARTIFACT: AFTER-HOURS STUDY ACCESS
                           ======================================================== */}
                        {(msg.text.toLowerCase().includes('building') ||
                          msg.text.toLowerCase().includes('after-hours') ||
                          msg.text.toLowerCase().includes('buckid') ||
                          msg.text.toLowerCase().includes('mason') ||
                          msg.text.toLowerCase().includes('dreese')) && (
                          <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 text-xs space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-neutral-900 flex items-center space-x-1.5">
                                <CreditCard className="w-4 h-4 text-[#ba0c2f]" />
                                <span>BuckID Study Access Rules</span>
                              </span>
                              <span className="text-[10px] font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                                18th Ave 24/7 Automatic
                              </span>
                            </div>

                            <p className="text-[11px] text-neutral-600 leading-relaxed">
                              Libraries (18th Ave &amp; Thompson) are already automatically granted to all BuckIDs. For academic buildings like Mason Hall, Dreese, and Caldwell, submit an evening or weekend request in the access portal.
                            </p>

                            <button
                              onClick={() => setActiveTab('studyAccess')}
                              className="w-full bg-[#ba0c2f] hover:bg-[#9e0a28] text-white py-1.5 rounded-lg font-bold text-xs transition-colors flex items-center justify-center space-x-1.5"
                            >
                              <span>Open After-Hours Study Portal (80 Buildings)</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {/* ========================================================
                            DYNAMIC DOMAIN ARTIFACT: ADVISOR AVAILABILITY PREVIEW
                           ======================================================== */}
                        {(msg.text.toLowerCase().includes('sarah jenkins') ||
                          msg.text.toLowerCase().includes('registration lock') ||
                          msg.text.toLowerCase().includes('hold')) && (
                          <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 text-xs space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-neutral-900 flex items-center space-x-1.5">
                                <Calendar className="w-4 h-4 text-[#ba0c2f]" />
                                <span>Mutual Open Slot with Sarah Jenkins</span>
                              </span>
                              <span className="text-[10px] text-neutral-500 font-mono">
                                Mason Hall 120
                              </span>
                            </div>

                            <div className="p-2.5 bg-white rounded-lg border border-neutral-200 flex items-center justify-between">
                              <div>
                                <div className="font-bold text-neutral-900">Tomorrow (Wednesday, Oct 14)</div>
                                <div className="text-[11px] text-neutral-500">2:30 PM – 3:00 PM (No class conflicts)</div>
                              </div>
                              <button
                                onClick={() => setActiveTab('advisor')}
                                className="bg-[#ba0c2f] hover:bg-[#9e0a28] text-white px-3 py-1.5 rounded-md font-bold text-xs transition-colors"
                              >
                                Book Slot
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Source Citation & Policy Grounding (Zero-Pill Discipline) */}
                        {(msg.sourceCitation || msg.confidence) && (
                          <div className="pt-2 border-t border-neutral-100 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-500 font-mono">
                            {msg.confidence === 'high' ? (
                              <span className="flex items-center space-x-1 text-emerald-700 font-medium">
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Verified Policy</span>
                              </span>
                            ) : (
                              <span className="flex items-center space-x-1 text-amber-700 font-medium">
                                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                                <span>Advisor Consultation Recommended</span>
                              </span>
                            )}
                            {msg.sourceCitation && (
                              <>
                                <span className="text-neutral-300">·</span>
                                <span className="italic font-sans text-neutral-500">{msg.sourceCitation}</span>
                              </>
                            )}
                          </div>
                        )}

                        {/* High Stakes Warning & Escalation */}
                        {(() => {
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
                      </div>
                    )}
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-center space-x-2 text-xs text-neutral-500 bg-white p-3 rounded-xl border border-neutral-200 w-fit max-w-3xl mx-auto shadow-xs">
                    <RefreshCw className="w-3.5 h-3.5 text-[#ba0c2f] animate-spin" />
                    <span>Auditing Ohio State prerequisite chains and degree records...</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* High-Craft Dock Input Area (Apple Spotlight + Vercel Prompt Bar) */}
              <div className="p-4 sm:p-5 bg-gradient-to-t from-white via-white/95 to-transparent border-t border-neutral-200/80">
                <div className="max-w-3xl mx-auto space-y-2.5">
                  
                  {/* Authentic Ohio State Student Suggestion Chips */}
                  <div className="flex items-center space-x-2 overflow-x-auto pb-1 text-xs no-scrollbar">
                    <button
                      onClick={() => onSendMessage('How do I clear my Registration Lock hold for Spring 2027?')}
                      className="px-3 py-1.5 rounded-lg bg-white border border-neutral-200/90 hover:border-[#ba0c2f] text-neutral-700 hover:text-neutral-900 transition-colors whitespace-nowrap text-[11px] font-medium shadow-2xs"
                    >
                      Hold Resolution
                    </button>
                    <button
                      onClick={() => onSendMessage("What is Marc Smith's workload for ACCTMIS 2300?")}
                      className="px-3 py-1.5 rounded-lg bg-white border border-neutral-200/90 hover:border-[#ba0c2f] text-neutral-700 hover:text-neutral-900 transition-colors whitespace-nowrap text-[11px] font-medium shadow-2xs"
                    >
                      Marc Smith Workload (14 hrs/wk)
                    </button>
                    <button
                      onClick={() => onSendMessage('Can I drop ACCTMIS 2300 without losing full-time financial aid?')}
                      className="px-3 py-1.5 rounded-lg bg-white border border-neutral-200/90 hover:border-red-500 text-neutral-700 hover:text-red-900 transition-colors whitespace-nowrap text-[11px] font-medium shadow-2xs"
                    >
                      Drop Class Impact (Prereqs &amp; Aid)
                    </button>
                    <button
                      onClick={() => onSendMessage('Can I declare the Computer Science (CSE) Minor?')}
                      className="px-3 py-1.5 rounded-lg bg-white border border-neutral-200/90 hover:border-[#ba0c2f] text-neutral-700 hover:text-neutral-900 transition-colors whitespace-nowrap text-[11px] font-medium shadow-2xs"
                    >
                      Add CSE Minor Audit
                    </button>
                    <button
                      onClick={() => setActiveTab('studyAccess')}
                      className="px-3 py-1.5 rounded-lg bg-white border border-neutral-200/90 hover:border-[#ba0c2f] text-neutral-700 hover:text-neutral-900 transition-colors whitespace-nowrap text-[11px] font-medium shadow-2xs"
                    >
                      After-Hours Study Entry
                    </button>
                  </div>

                  {/* Input Form */}
                  <form
                    onSubmit={handleSendChat}
                    className="flex items-center bg-white border border-neutral-300 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] focus-within:border-[#ba0c2f] focus-within:ring-2 focus-within:ring-[#ba0c2f]/10 transition-all p-1.5"
                  >
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Ask about prerequisites, curriculum balance, faculty workload, or graduation..."
                      disabled={isLoading}
                      className="flex-1 px-4 py-2.5 text-xs sm:text-sm text-neutral-900 outline-none bg-transparent placeholder-neutral-400"
                    />

                    <button
                      type="submit"
                      disabled={!inputText.trim() || isLoading}
                      className="bg-[#ba0c2f] hover:bg-[#9e0a28] disabled:bg-neutral-200 disabled:text-neutral-400 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shadow-xs cursor-pointer disabled:cursor-not-allowed"
                    >
                      <span>Consult</span>
                      <CornerDownLeft className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              WORKSPACE 2: 4-YEAR DEGREE PLANNER & DARS
             ======================================================== */}
          {activeTab === 'roadmap' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#fcfcfb]">
              
              {/* Header KPI Ribbon (Stripe Style) */}
              <div className="p-5 bg-white rounded-2xl border border-neutral-200/90 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-neutral-900">
                      Bachelor of Science in Business Administration (BSBA)
                    </h3>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Specialization in Finance · Business Analytics &amp; CIS Minor · Class of 2029
                    </p>
                  </div>

                  <div className="flex items-center space-x-4 text-xs font-mono">
                    <div>
                      <span className="text-neutral-400 font-sans">Earned: </span>
                      <strong className="text-neutral-900">45 cr</strong>
                    </div>
                    <div>
                      <span className="text-neutral-400 font-sans">Enrolled: </span>
                      <strong className="text-neutral-900">15 cr</strong>
                    </div>
                    <div>
                      <span className="text-neutral-400 font-sans">Remaining: </span>
                      <strong className="text-neutral-900">61 cr</strong>
                    </div>
                  </div>
                </div>

                {/* Progress Meter */}
                <div>
                  <div className="flex items-center justify-between text-[11px] text-neutral-500 mb-1">
                    <span>Degree Completion Progress</span>
                    <span className="font-mono font-bold text-neutral-900">60 / 121 Hours (49.5%)</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-neutral-100 overflow-hidden flex">
                    <div className="h-full bg-neutral-800" style={{ width: '37.1%' }} title="45 Earned" />
                    <div className="h-full bg-[#ba0c2f]" style={{ width: '12.4%' }} title="15 In Progress" />
                  </div>
                </div>

                {/* Roadmap Optimizer Bar */}
                <form onSubmit={handleRoadmapSubmit} className="pt-2 border-t border-neutral-100 flex items-center space-x-2">
                  <input
                    type="text"
                    value={roadmapPrompt}
                    onChange={(e) => setRoadmapPrompt(e.target.value)}
                    placeholder="Balance term credits (e.g. 'Swap an online GE Theme into Spring 2027 to buffer ACCTMIS')..."
                    className="flex-1 text-xs px-3.5 py-2 rounded-xl border border-neutral-300 focus:border-[#ba0c2f] outline-none"
                    disabled={isRoadmapUpdating}
                  />
                  <button
                    type="submit"
                    disabled={!roadmapPrompt.trim() || isRoadmapUpdating}
                    className="bg-[#ba0c2f] hover:bg-[#9e0a28] text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
                  >
                    {isRoadmapUpdating ? 'Optimizing...' : 'Rebalance Terms'}
                  </button>
                </form>
              </div>

              {/* Academic Year Timelines */}
              <div className="space-y-4">
                {years.map((year) => {
                  const isExpanded = expandedYear === year.yearNumber;
                  return (
                    <div key={year.yearNumber} className="bg-white rounded-2xl border border-neutral-200/90 shadow-2xs overflow-hidden">
                      <div
                        onClick={() => setExpandedYear(isExpanded ? 0 : year.yearNumber)}
                        className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-neutral-50 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <span className="font-bold text-sm text-neutral-900">{year.title}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            year.status === 'Completed'
                              ? 'bg-neutral-100 text-neutral-700'
                              : year.status === 'In Progress'
                              ? 'bg-[#ba0c2f]/10 text-[#ba0c2f]'
                              : 'bg-neutral-100 text-neutral-500'
                          }`}>
                            {year.status}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 text-xs text-neutral-400 font-mono">
                          <span>{year.semesters.reduce((acc, s) => acc + s.totalCredits, 0)} Total Credits</span>
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="p-5 pt-0 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-neutral-100">
                          {year.semesters.map((sem) => (
                            <div key={sem.id} className="p-4 bg-neutral-50/70 rounded-xl border border-neutral-200/70 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs text-neutral-900">{sem.name}</span>
                                <span className="text-[10px] font-mono text-neutral-500 font-bold">
                                  {sem.totalCredits} Credits · {sem.workloadRating} Workload
                                </span>
                              </div>

                              <div className="space-y-1.5">
                                {sem.courses.map((c, idx) => (
                                  <div key={idx} className="p-2.5 bg-white rounded-lg border border-neutral-200 text-xs flex items-center justify-between">
                                    <div>
                                      <div className="font-bold text-neutral-900">{c.code}</div>
                                      <div className="text-[11px] text-neutral-500">{c.name}</div>
                                    </div>
                                    <span className="font-mono text-[11px] text-neutral-400 font-bold">{c.credits} cr</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================
              WORKSPACE 3: WHAT-IF CREDENTIAL AUDIT
             ======================================================== */}
          {activeTab === 'whatif' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#fcfcfb]">
              <div className="p-5 bg-white rounded-2xl border border-neutral-200/90 shadow-2xs space-y-3">
                <h3 className="text-base font-bold text-neutral-900">
                  What-If Credential Audit: Test Minors &amp; Certificates
                </h3>
                <p className="text-xs text-neutral-600">
                  See how declaring a secondary minor affects your graduation date, course overlap rules, and career placement without altering your official SIS record.
                </p>

                {/* Minor Selectors */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  {MINOR_OPTIONS.map((opt) => (
                    <div
                      key={opt.id}
                      onClick={() => setSelectedMinorId(opt.id)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        selectedMinorId === opt.id
                          ? 'border-[#ba0c2f] bg-red-50/40 shadow-xs'
                          : 'border-neutral-200 hover:border-neutral-300 bg-white'
                      }`}
                    >
                      <div className="font-bold text-xs text-neutral-900">{opt.name}</div>
                      <div className="text-[11px] text-neutral-500 mt-0.5">{opt.college}</div>
                      <div className="text-[10px] font-mono font-bold text-[#ba0c2f] mt-2">
                        {opt.creditsCompleted} of {opt.totalCredits} cr satisfied
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Selected Minor Detailed Analysis */}
              {(() => {
                const minor = MINOR_OPTIONS.find((m) => m.id === selectedMinorId) || MINOR_OPTIONS[0];
                return (
                  <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-2xs p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-sm text-neutral-900">{minor.name} Analysis</h4>
                        <p className="text-xs text-neutral-500 mt-0.5">{minor.description}</p>
                      </div>
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                        {minor.graduationDelay}
                      </span>
                    </div>

                    {/* Stripe-style KPI cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                        <div className="text-[10px] uppercase font-bold text-neutral-400">Overlap Synergy</div>
                        <div className="text-sm font-bold text-neutral-900 mt-0.5">{minor.synergyScore}</div>
                      </div>
                      <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                        <div className="text-[10px] uppercase font-bold text-neutral-400">Career Match</div>
                        <div className="text-xs font-bold text-neutral-900 mt-0.5 truncate">{minor.careerMatch}</div>
                      </div>
                      <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                        <div className="text-[10px] uppercase font-bold text-neutral-400">Completed Courses</div>
                        <div className="text-sm font-bold text-neutral-900 mt-0.5">{minor.alreadyTaken.length} Courses Met</div>
                      </div>
                    </div>

                    {/* Course Breakdown */}
                    <div className="pt-2 space-y-2">
                      <div className="text-xs font-bold text-neutral-800">Remaining Courses Needed</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {minor.remainingNeeded.map((c, i) => (
                          <div key={i} className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-200 text-xs flex items-center justify-between">
                            <div>
                              <div className="font-bold text-neutral-900">{c.code}</div>
                              <div className="text-[11px] text-neutral-500">{c.name}</div>
                            </div>
                            <span className="font-mono text-[10px] bg-white border border-neutral-200 px-2 py-0.5 rounded font-bold text-neutral-700">
                              {c.term}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ========================================================
              WORKSPACE 4: FACULTY & WORKLOAD INTELLIGENCE
             ======================================================== */}
          {activeTab === 'rmp' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#fcfcfb]">
              <div className="p-5 bg-white rounded-2xl border border-neutral-200/90 shadow-2xs space-y-2">
                <h3 className="text-base font-bold text-neutral-900">
                  Ohio State Faculty Workload &amp; SEI Intelligence
                </h3>
                <p className="text-xs text-neutral-600">
                  Workload reality, homework time estimates, and verified survival strategies for demanding core courses.
                </p>
              </div>

              {/* Professor Profiles */}
              <div className="space-y-4">
                {PROFESSOR_REVIEWS.map((prof) => (
                  <div key={prof.id} className="bg-white rounded-2xl border border-neutral-200/90 p-5 space-y-4 shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-neutral-100">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-bold text-base text-neutral-900">{prof.name}</h4>
                          <span className="text-xs font-semibold text-neutral-500">· {prof.department}</span>
                        </div>
                        <div className="text-xs text-neutral-600 font-medium mt-0.5">
                          Courses: {prof.courses.join(', ')}
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 text-xs">
                        <div className="px-3 py-1 bg-amber-50 text-amber-900 rounded-full font-bold border border-amber-200 flex items-center space-x-1">
                          <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                          <span>{prof.overallRating} / 5.0 Rating</span>
                        </div>
                        <div className="px-3 py-1 bg-red-50 text-red-900 rounded-full font-bold border border-red-200">
                          {prof.workloadLevel}
                        </div>
                      </div>
                    </div>

                    {prof.workloadWarning && (
                      <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-xs text-red-900 flex items-start space-x-2">
                        <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                        <div>{prof.workloadWarning}</div>
                      </div>
                    )}

                    {/* Student Success Recommendations */}
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-neutral-800 uppercase tracking-wider">
                        Verified Student Recommendations for {prof.name}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {prof.recommendations.map((rec, i) => (
                          <div key={i} className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-200/80 text-neutral-700 leading-relaxed">
                            • {rec}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-xs italic text-neutral-600">
                      {prof.redditQuote}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================
              WORKSPACE 5: ADVISOR DIRECT SCHEDULING
             ======================================================== */}
          {activeTab === 'advisor' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#fcfcfb]">
              <div className="p-5 bg-white rounded-2xl border border-neutral-200/90 shadow-2xs space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-neutral-900">
                      Advisor Calendar Matching with {profile.advisorName}
                    </h3>
                    <p className="text-xs text-neutral-600 mt-0.5">
                      {profile.advisorTitle} · {profile.advisorOffice} · {profile.advisorEmail}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 px-3 py-1 rounded-full">
                    Registration Lock Hold
                  </span>
                </div>
              </div>

              {/* Time Slots Grid */}
              <div className="bg-white rounded-2xl border border-neutral-200/90 p-5 space-y-4 shadow-2xs">
                <div className="text-xs font-bold text-neutral-800 uppercase tracking-wider">
                  Mutual Open Slots (Cross-referenced against your Carmen Course Schedule)
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {MUTUAL_ADVISOR_SLOTS.map((slot) => {
                    const isBookedThis = bookedSlot?.id === slot.id;
                    return (
                      <div
                        key={slot.id}
                        className={`p-4 rounded-xl border transition-all text-xs space-y-2 ${
                          isBookedThis
                            ? 'border-emerald-500 bg-emerald-50/50 shadow-xs ring-1 ring-emerald-500'
                            : slot.mutualMatch
                            ? 'border-neutral-200 bg-white hover:border-[#ba0c2f]'
                            : 'border-neutral-200 bg-neutral-50 opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-neutral-900">{slot.day}, {slot.date}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                            slot.mutualMatch ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-600'
                          }`}>
                            {slot.mutualMatch ? 'No Conflicts' : 'Class Conflict'}
                          </span>
                        </div>
                        <div className="font-semibold text-neutral-700 text-sm">{slot.time}</div>

                        <div className="pt-2 border-t border-neutral-100">
                          {isBookedThis ? (
                            <div className="text-emerald-700 font-bold text-center">✓ Confirmed Appointment</div>
                          ) : slot.mutualMatch ? (
                            <button
                              onClick={() => handleBookSlot(slot)}
                              className="w-full bg-[#ba0c2f] hover:bg-[#9e0a28] text-white py-1.5 rounded-lg font-bold text-xs transition-colors"
                            >
                              Book This Slot
                            </button>
                          ) : (
                            <div className="text-neutral-400 text-center">Class Conflict (BUSMHR 2292)</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              WORKSPACE 6: WAITLIST & SEAT ALERTS
             ======================================================== */}
          {activeTab === 'seatAlerts' && (
            <div className="flex-1 overflow-y-auto p-6 bg-[#fcfcfb]">
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

          {/* ========================================================
              WORKSPACE 7: AFTER-HOURS STUDY ACCESS (80 BUILDINGS + BUCKID)
             ======================================================== */}
          {activeTab === 'studyAccess' && (
            <div className="flex-1 overflow-y-auto p-6 bg-[#fcfcfb]">
              <AfterHoursAccessView profile={profile} />
            </div>
          )}
        </main>

        {/* ========================================================
            RIGHT INSPECTOR DRAWER (Apple macOS / Xcode Inspector)
           ======================================================== */}
        {isInspectorOpen && (
          <aside className="w-80 bg-[#fbfbfa] border-l border-neutral-200/80 flex flex-col shrink-0 overflow-y-auto select-none transition-all">
            
            {/* Inspector Header */}
            <div className="p-4 border-b border-neutral-200/70 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Academic Dossier
              </span>
              <button
                onClick={() => setIsInspectorOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 text-xs"
                title="Hide Inspector"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-4 space-y-5 text-xs">
              
              {/* Profile Overview (Stripe style tabular rows) */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-neutral-900">Student Profile</div>
                <div className="bg-white rounded-xl border border-neutral-200/80 p-3 space-y-2 shadow-2xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-neutral-400 font-sans">Name:</span>
                    <span className="text-neutral-900 font-bold">{profile.name} Rez</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400 font-sans">Student ID:</span>
                    <span className="text-neutral-800">{profile.osuId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400 font-sans">Email:</span>
                    <span className="text-neutral-800">rez.24@osu.edu</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400 font-sans">College:</span>
                    <span className="text-neutral-800 font-sans">Fisher Business</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400 font-sans">Standing:</span>
                    <span className="text-emerald-700 font-bold font-sans">Good (3.68 GPA)</span>
                  </div>
                </div>
              </div>

              {/* Active Registration Hold Alert */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-neutral-900">Holds &amp; Permissions</div>
                <div className="bg-red-50/70 rounded-xl border border-red-200 p-3 space-y-1.5">
                  <div className="flex items-center space-x-1.5 text-red-900 font-bold">
                    <AlertCircle className="w-3.5 h-3.5 text-[#ba0c2f]" />
                    <span>Registration Lock</span>
                  </div>
                  <p className="text-[11px] text-red-800 leading-relaxed font-sans">
                    Prevents enrollment in Spring 2027 until a mandatory 2nd-Year plan review is logged with Sarah Jenkins.
                  </p>
                  <button
                    onClick={() => setActiveTab('advisor')}
                    className="mt-1 text-[11px] font-bold text-[#ba0c2f] hover:underline flex items-center space-x-1"
                  >
                    <span>Schedule 15-min Clearance</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* BuckID RFID Card Status */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-neutral-900">BuckID Terminal Status</div>
                <div className="bg-white rounded-xl border border-neutral-200/80 p-3 space-y-2 shadow-2xs font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400 font-sans">Card Status:</span>
                    <span className="text-emerald-700 font-bold font-sans flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>Active (Tap-Ready)</span>
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400 font-sans">24/7 Access:</span>
                    <span className="text-neutral-800 font-sans">18th Ave Library</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400 font-sans">Day/Evening:</span>
                    <span className="text-neutral-800 font-sans">Thompson Library</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400 font-sans">Authorized:</span>
                    <span className="text-neutral-800 font-sans">Mason Hall (7 PM–2 AM)</span>
                  </div>
                </div>
              </div>

              {/* Autumn 2026 Active Schedule */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-neutral-900">Autumn 2026 Schedule (14 cr)</div>
                <div className="space-y-1.5">
                  <div className="p-2 bg-white rounded-lg border border-neutral-200/80 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-neutral-900">ACCTMIS 2300</div>
                      <div className="text-[10px] text-neutral-400">Mason Hall · 3 cr</div>
                    </div>
                    <span className="text-[10px] font-mono text-neutral-500 font-bold">14 hrs/wk</span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-neutral-200/80 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-neutral-900">CSE 2221</div>
                      <div className="text-[10px] text-neutral-400">Caldwell Lab · 4 cr</div>
                    </div>
                    <span className="text-[10px] font-mono text-neutral-500 font-bold">10 hrs/wk</span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-neutral-200/80 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-neutral-900">MATH 1152</div>
                      <div className="text-[10px] text-neutral-400">Cockins Hall · 5 cr</div>
                    </div>
                    <span className="text-[10px] font-mono text-neutral-500 font-bold">12 hrs/wk</span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-neutral-200/80 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-neutral-900">BUSMHR 2292</div>
                      <div className="text-[10px] text-neutral-400">Gerlach Hall · 3 cr</div>
                    </div>
                    <span className="text-[10px] font-mono text-neutral-500 font-bold">4 hrs/wk</span>
                  </div>
                </div>
              </div>

            </div>
          </aside>
        )}

      </div>

      {/* ========================================================
          APPLE SPOTLIGHT / VERCEL COMMAND PALETTE MODAL (⌘K)
         ======================================================== */}
      {isCommandPaletteOpen && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-start justify-center pt-20 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-3.5 border-b border-neutral-200 flex items-center space-x-3">
              <Search className="w-4 h-4 text-neutral-400" />
              <input
                type="text"
                autoFocus
                value={commandQuery}
                onChange={(e) => setCommandQuery(e.target.value)}
                placeholder="Search workspaces, faculty, holds, building access..."
                className="flex-1 text-sm outline-none bg-transparent placeholder-neutral-400"
              />
              <kbd className="text-[10px] font-mono bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded border border-neutral-200">
                Esc
              </kbd>
            </div>

            <div className="p-2 max-h-80 overflow-y-auto space-y-1">
              <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                Suggested Actions
              </div>

              {commandFilteredItems.map((item, idx) => (
                <button
                  key={idx}
                  onClick={item.action}
                  className="w-full p-2.5 rounded-xl text-left hover:bg-neutral-100/80 transition-colors flex items-center justify-between group"
                >
                  <div>
                    <div className="text-xs font-bold text-neutral-900 group-hover:text-[#ba0c2f]">
                      {item.title}
                    </div>
                    <div className="text-[11px] text-neutral-500">
                      {item.subtitle}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-[#ba0c2f] transition-transform group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
