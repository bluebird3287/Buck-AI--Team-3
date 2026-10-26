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
import { FacultyEvaluationsView } from './FacultyEvaluationsView';

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

        {/* TAB 4: FACULTY EVALUATIONS & FEEDBACK (every Fisher instructor & course, student reviews) */}
        {activeTab === 'rmp' && <FacultyEvaluationsView />}

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
