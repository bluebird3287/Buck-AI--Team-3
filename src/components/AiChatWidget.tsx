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
  CheckCircle2
} from 'lucide-react';
import { StudentProfile, Semester, AdvisorSlot } from '../data/sampleData';
import { describeSlot, MatchSlot, studentFromProfile, submitRequest, toAdvisorSlot, useAdvisingState } from '../lib/advising';
import { ScheduleMatcher } from './scheduling/ScheduleMatcher';
import { HighStakesDecisionCard, HighStakesDecisionData } from './HighStakesDecisionCard';
import { SeatAlertsView, WatchedCourse } from './SeatAlertsView';
import { AfterHoursAccessView } from './AfterHoursAccessView';
import { DegreeRequirementsView } from './DegreeRequirementsView';
import { Curriculum, DegreeAudit } from '../lib/requirements';
import { MinorAuditView } from './MinorAuditView';
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
  initialTab?: 'chat' | 'roadmap' | 'requirements' | 'whatif' | 'rmp' | 'advisor' | 'seatAlerts' | 'studyAccess';
  onSimulateSeatDrop?: (course: WatchedCourse) => void;
  audit: DegreeAudit | null;
  curriculum: Curriculum | null;
  specializationId: string | null;
}



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
  onSimulateSeatDrop,
  audit,
  curriculum,
  specializationId
}) => {
  const currentCourseToDrop = roadmap.find((sem) => sem.status === 'in-progress')?.courses[0]?.code;
  const [activeTab, setActiveTab] = useState<'chat' | 'roadmap' | 'requirements' | 'whatif' | 'rmp' | 'advisor' | 'seatAlerts' | 'studyAccess'>(initialTab || 'chat');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  const [inputText, setInputText] = useState('');
  const [roadmapPrompt, setRoadmapPrompt] = useState('');
  // Open the year the student is in now
  const [expandedYear, setExpandedYear] = useState<number>(
    () => roadmap.find((s) => s.status === 'in-progress')?.year ?? roadmap[roadmap.length - 1]?.year ?? 1,
  );

  // High Stakes Decision State & Handlers
  const [isSubmittingEscalation, setIsSubmittingEscalation] = useState<boolean>(false);
  const [localDecisions, setLocalDecisions] = useState<Record<string, HighStakesDecisionData>>({});

  // Appointment picking (shared availability with the advisor's calendar) and the
  // student's latest appointment request, so they see when the advisor decides.
  const [pickedSlot, setPickedSlot] = useState<MatchSlot | null>(null);
  const [pickedFormat, setPickedFormat] = useState<'In-Person' | 'Zoom' | 'Phone'>('In-Person');
  const advisingState = useAdvisingState();
  const myEmail = studentFromProfile(profile).email;
  const myAppointment = advisingState.requests.find((r) => r.appointment && r.student.email === myEmail) ?? null;

  // Send the decision into the advisor's approval queue; BuckAI checks it first.
  const queueForAdvisor = (decision: HighStakesDecisionData, confirmed: boolean) => {
    const course = decision.decisionTitle.match(/[A-Z]{3,8}\s\d{4}/)?.[0];
    const credits = course?.startsWith('MATH') ? 5 : course?.startsWith('CSE') ? 4 : 3;
    submitRequest({
      category: decision.actionType,
      title: decision.decisionTitle,
      studentMessage: confirmed
        ? `I understand the risks BuckAI listed and want to go ahead: ${decision.decisionTitle}.`
        : `I'd like to talk with my advisor before deciding: ${decision.decisionTitle}.`,
      details: decision.actionType === 'drop_class' ? { course, credits } : decision.actionType === 'add_minor' ? { minor: decision.decisionTitle.replace(/^Declare (the )?/, '').replace(/ on .*$/, '') } : undefined,
      student: studentFromProfile(profile),
    });
  };

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
      queueForAdvisor(decision, false);
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
      // Also open the advisor tab so the student can match available appointment times immediately
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
      queueForAdvisor(decision, true);
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

  // Request the picked time; it goes to the advisor's approval queue after BuckAI checks it.
  const handleRequestAppointment = async () => {
    if (!pickedSlot) return;
    const notes = 'Meeting to review my 4-year degree roadmap.';
    const sent = await submitRequest({
      category: 'appointment',
      title: 'Advising appointment',
      studentMessage: notes,
      student: studentFromProfile(profile),
      appointment: { slotKey: pickedSlot.key, format: pickedFormat },
    });
    if (!sent) {
      window.alert("Your request couldn't be sent. That time may have just been taken, so please pick another time and try again.");
      return;
    }
    onConfirmBooking(toAdvisorSlot(pickedSlot), pickedFormat, notes);
    setPickedSlot(null);
  };

  // Group semesters by academic year for clean, spacious display
  const progressPct = Math.min(100, Math.round((profile.earnedCredits / profile.totalRequiredCredits) * 100));
  const YEAR_TITLES = ['Freshman', 'Sophomore', 'Junior', 'Senior'];
  const yearNumbers = [...new Set(roadmap.map((s) => s.year ?? 1))].sort((a, b) => a - b);
  const years = yearNumbers.map((n) => {
    const semesters = roadmap.filter((s) => (s.year ?? 1) === n);
    const status = semesters.every((s) => s.status === 'completed')
      ? 'Completed'
      : semesters.some((s) => s.status !== 'planned')
      ? 'In Progress'
      : 'Planned';
    return { yearNumber: n, title: `Year ${n}${YEAR_TITLES[n - 1] ? ` (${YEAR_TITLES[n - 1]})` : ''}`, status, semesters };
  });

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
              {profile.name} ({profile.nameDotNum}) • {profile.major} • Advisor: {profile.advisorName}
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
            onClick={() => setActiveTab('requirements')}
            className={`py-3 px-3.5 font-medium text-xs sm:text-sm border-b-2 flex items-center space-x-2 transition-colors whitespace-nowrap ${
              activeTab === 'requirements'
                ? 'border-[#ba0c2f] text-[#ba0c2f] font-semibold bg-white'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Degree Requirements</span>
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
            {profile.holds.length > 0 && (
            <div className="bg-red-50 border-b border-red-200 px-6 py-3 flex items-center justify-between text-xs sm:text-sm text-red-900 shrink-0">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-[#ba0c2f] shrink-0" />
                <span>
                  <strong>Action Required:</strong> {profile.holds.join(', ')} hold needs an advising check-in.
                </span>
              </div>
              <button
                onClick={() => setActiveTab('advisor')}
                className="bg-[#ba0c2f] hover:bg-[#9d0a27] text-white px-3 py-1.5 rounded text-xs font-semibold shrink-0 transition-colors"
              >
                Clear Hold ➔
              </button>
            </div>
            )}

            {/* Chat Messages Stream */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 bg-[#f8fafc]">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div className="text-[11px] text-gray-500 mb-1 font-medium px-1">
                    {msg.role === 'user' ? `${profile.name} (You)` : 'BuckeyeLink Advising Service'}
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
                <span>Instant Seat Drop Alerts</span>
              </button>
              {currentCourseToDrop && (
              <button
                onClick={() => onSendMessage(`I want to make the real choice to drop ${currentCourseToDrop} right now.`)}
                className="bg-red-50 border border-red-300 hover:bg-red-100 text-red-900 px-3 py-1.5 rounded whitespace-nowrap transition-colors flex items-center space-x-1 font-semibold"
                title="Test High-Stakes Class Drop Warning & Advisor Escalation"
              >
                <AlertCircle className="w-3.5 h-3.5 text-red-700" />
                <span>Drop {currentCourseToDrop} (Real Choice)</span>
              </button>
              )}
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
                onClick={() => onSendMessage('How do I find and clear a hold on my account?')}
                className="bg-white border border-gray-300 hover:border-[#ba0c2f] hover:text-[#ba0c2f] px-3 py-1.5 rounded whitespace-nowrap transition-colors"
              >
                Clear a Hold
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
        {activeTab === 'requirements' && (
          <DegreeRequirementsView
            audit={audit}
            onAskForPlan={() => {
              setActiveTab('roadmap');
              onUpdateRoadmap('Plan every remaining Fisher requirement through graduation, respecting prerequisites and balancing workload.');
            }}
          />
        )}

        {activeTab === 'roadmap' && (
          <div className="flex-1 flex flex-col overflow-hidden bg-[#f8fafc]">
            {/* Top Roadmap Summary Bar */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900">4-Year Degree Completion Roadmap</h3>
                <p className="text-xs text-gray-600 mt-0.5">
                  {[profile.major, profile.minor && `${profile.minor} minor`].filter(Boolean).join(' • ')}
                </p>
              </div>

              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="text-[11px] text-gray-500 font-medium">Degree Credit Progress</div>
                  <div className="text-sm font-bold text-gray-900">{profile.earnedCredits} / {profile.totalRequiredCredits} Credits Completed ({progressPct}%)</div>
                </div>
                <div className="w-28 bg-gray-200 h-2 rounded-full overflow-hidden">
                  <div className="bg-[#ba0c2f] h-full rounded-full" style={{ width: `${progressPct}%` }} />
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
          <MinorAuditView
            curriculum={curriculum}
            specializationId={specializationId}
            roadmap={roadmap}
            audit={audit}
            onAsk={(prompt) => {
              setActiveTab('chat');
              onSendMessage(prompt);
            }}
            onAddToPlan={(prompt) => {
              setActiveTab('roadmap');
              onUpdateRoadmap(prompt);
            }}
            onDeclare={(prompt) => {
              setActiveTab('chat');
              onSendMessage(prompt);
            }}
          />
        )}

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
                  <p className="text-xs text-gray-500 mt-0.5">Office: {profile.advisorOffice} • {profile.advisorEmail}</p>
                </div>
              </div>

              {myAppointment ? (
                <div
                  role="status"
                  className={`px-4 py-2 rounded text-sm font-semibold border ${
                    myAppointment.status === 'approved' || myAppointment.status === 'scheduled'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : myAppointment.status === 'denied'
                      ? 'bg-gray-100 border-gray-300 text-gray-900'
                      : 'bg-amber-50 border-amber-300 text-amber-950'
                  }`}
                >
                  <div>
                    {myAppointment.status === 'approved'
                      ? 'Appointment approved'
                      : myAppointment.status === 'denied'
                      ? 'Appointment not approved'
                      : myAppointment.status === 'scheduled'
                      ? `${profile.advisorName} scheduled a meeting with you`
                      : myAppointment.status === 'needs_info'
                      ? 'Your advisor needs more information'
                      : 'Appointment requested'}
                    : {describeSlot(myAppointment.appointment!.slotKey)}
                  </div>
                  <div className="text-xs font-normal mt-0.5">
                    {myAppointment.decision?.note ||
                      (myAppointment.status === 'ai_review'
                        ? 'BuckAI is checking your request…'
                        : `Checked by BuckAI · waiting for ${profile.advisorName} to approve.`)}
                  </div>
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 text-red-900 px-4 py-2 rounded text-xs">
                  <strong>Hold Status:</strong> {profile.holds.length ? profile.holds.join(', ') : 'None reported'}
                  <div className="text-[11px] text-red-700 mt-0.5">Select a mutually open appointment window below.</div>
                </div>
              )}
            </div>

            {/* Mutual availability matcher (same data as the advisor's calendar) */}
            <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-2xs space-y-4">
              <ScheduleMatcher
                mode="student"
                studentName={profile.name}
                selectedKey={pickedSlot?.key ?? null}
                onSelect={setPickedSlot}
              />

              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold text-gray-900">Meeting format</legend>
                <div className="flex flex-wrap gap-2">
                  {(['In-Person', 'Zoom', 'Phone'] as const).map((f) => (
                    <label
                      key={f}
                      className={`cursor-pointer rounded-md border px-3 py-2 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#ba0c2f] ${
                        pickedFormat === f ? 'border-[#ba0c2f] bg-red-50 font-semibold text-[#8a0a23]' : 'border-gray-300 bg-white text-gray-800'
                      }`}
                    >
                      <input
                        type="radio"
                        name="meeting-format"
                        value={f}
                        checked={pickedFormat === f}
                        onChange={() => setPickedFormat(f)}
                        className="sr-only"
                      />
                      {f === 'In-Person' ? `In person (${profile.advisorOffice})` : f}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg bg-gray-50 border border-gray-200 p-4">
                <p className="text-sm text-gray-800" aria-live="polite">
                  {pickedSlot ? (
                    <>
                      <span className="font-semibold">Selected:</span> {describeSlot(pickedSlot.key)} · {pickedFormat}
                    </>
                  ) : (
                    'Choose an available time above.'
                  )}
                  <span className="block text-xs text-gray-600 mt-0.5">
                    BuckAI checks your request first, then {profile.advisorName} gives final approval.
                  </span>
                </p>
                <button
                  type="button"
                  onClick={handleRequestAppointment}
                  disabled={!pickedSlot}
                  className="bg-[#ba0c2f] hover:bg-[#9d0a27] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2.5 rounded-md shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ba0c2f]"
                >
                  Request this appointment
                </button>
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
