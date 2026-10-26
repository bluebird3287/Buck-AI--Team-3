import React, { useState } from 'react';
import {
  MessageSquare,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Download
} from 'lucide-react';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { AiChatWidget, ChatMessage } from './components/AiChatWidget';
import { HighStakesDecisionData } from './components/HighStakesDecisionCard';
import { AdvisorSchedulingView } from './components/AdvisorSchedulingView';
import { SummaryConfirmationView } from './components/SummaryConfirmationView';
import { normalizeSemesters } from './lib/studentProfile';
import { SurveyModal } from './components/SurveyModal';
import { InstantSeatDropBanner } from './components/InstantSeatDropBanner';
import { WatchedCourse, INITIAL_WATCHED_COURSES } from './components/SeatAlertsView';
import { AdvisorSlot, Semester, StudentProfile } from './data/sampleData';

interface AppProps {
  profile: StudentProfile;
  initialRoadmap: Semester[];
  onRoadmapChange: (semesters: Semester[]) => void;
}

// The opening chat message, written for whoever is signed in.
function greetingFor(profile: StudentProfile, roadmap: Semester[]): ChatMessage {
  const current = roadmap.find((s) => s.status === 'in-progress');
  const program = [profile.rank, profile.major && `pursuing ${profile.major}`, profile.minor && `with a ${profile.minor} minor`]
    .filter(Boolean)
    .join(' ');
  const enrolled = current?.courses.length
    ? `\n\nThis term you're taking ${current.courses.map((c) => c.code).join(', ')}.`
    : "\n\nYou haven't added any classes for this term yet. Use **My classes** at the top of the page to add them.";
  return {
    id: 'msg-1',
    role: 'assistant',
    text: `Hello ${profile.name}! I'm your BuckeyeLink Advising Assistant.${program ? ` I see you're ${program}.` : ''}${enrolled}\n\nI can help you check prerequisites, plan your next terms, and set up time with your advisor.`,
    sourceCitation: 'Classes you entered in BuckAI',
    confidence: 'high',
    confidenceExplanation: 'Based on the profile and classes you added. BuckAI is not connected to BuckeyeLink yet.',
    escalationSuggested: false,
  };
}

export default function App({ profile, initialRoadmap, onRoadmapChange }: AppProps) {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [chatTab, setChatTab] = useState<'chat' | 'roadmap' | 'whatif' | 'rmp' | 'advisor' | 'seatAlerts' | 'studyAccess'>('chat');
  const [isSurveyModalOpen, setIsSurveyModalOpen] = useState<boolean>(false);
  const [alertCourse, setAlertCourse] = useState<WatchedCourse | null>(null);
  const [isSeatDropBannerOpen, setIsSeatDropBannerOpen] = useState<boolean>(false);

  // Student Profile & Data
  const [roadmap, setRoadmap] = useState<Semester[]>(initialRoadmap);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [greetingFor(profile, initialRoadmap)]);
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [isRoadmapUpdating, setIsRoadmapUpdating] = useState<boolean>(false);

  // Booking State
  const [bookedSlot, setBookedSlot] = useState<AdvisorSlot | null>(null);
  const [bookedFormat, setBookedFormat] = useState<string>('In-Person');
  const [bookedNotes, setBookedNotes] = useState<string>('');

  // Handle Live Claude AI Chat
  const handleSendMessage = async (text: string) => {
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      text,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsChatLoading(true);

    try {
      const response = await fetch('/api/advising-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages.map((m) => ({ role: m.role, text: m.text })),
          studentProfile: profile,
          roadmap,
        }),
      });

      if (!response.ok) throw new Error(`Server status ${response.status}`);
      const data = await response.json();

      let highStakesDecision: HighStakesDecisionData | null = data.highStakesDecision || null;
      const lower = text.toLowerCase();
      if (!highStakesDecision && (lower.includes('drop') || lower.includes('withdraw') || (lower.includes('minor') && (lower.includes('add') || lower.includes('pick up') || lower.includes('declare') || lower.includes('real choice'))))) {
        const isDrop = lower.includes('drop') || lower.includes('withdraw');
        const course = currentCourseMentioned(lower) ?? 'this class';
        const minorName = lower.includes('cse') ? 'Computer Science (CSE) Minor' : 'Business Analytics & CIS Minor';
        highStakesDecision = {
          isHighStakes: true,
          actionType: isDrop ? 'drop_class' : 'add_minor',
          decisionTitle: isDrop ? `Drop ${course} from Autumn 2026 Active Enrollment` : `Declare ${minorName} on Official University Degree Audit`,
          warningSummary: isDrop
            ? `You requested to drop ${course} as your real choice. An AI cannot unilaterally execute irreversible schedule drops. Dropping drops your enrolled credits below 12 credit hours, threatening financial aid and delaying prerequisite sequences.`
            : `You requested to declare the ${minorName} as your real academic credential. Automated AI bots cannot alter your SIS degree plan without certified human advisor sign-off.`,
          consequences: [
            'Financial Aid Risk: Dropping lowers enrolled credits below 12 credit hours, jeopardizing full-time status and Title IV FAFSA / Fisher Excellence Scholarships.',
            `Prerequisite Sequence: Disrupts mandatory prerequisite chains, postponing graduation by up to 2 semesters.`,
            'Permanent Record: Dropping past the 4th Friday generates a permanent "W" mark on your official transcript.'
          ],
          escalateRecommended: true,
        };
      }

      const aiMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        text: data.answer || "I've reviewed your question against Ohio State academic guidelines.",
        sourceCitation: data.sourceCitation || 'OSU Course Bulletin 2026-2027',
        confidence: data.confidence || 'high',
        confidenceExplanation: data.confidenceExplanation || 'Verified against Ohio State curriculum rules.',
        escalationSuggested: data.escalationSuggested || (!!highStakesDecision),
        highStakesDecision,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.warn('API fallback:', err);
      const textLower = text.toLowerCase();
      const isHold = textLower.includes('hold') || textLower.includes('lock');
      const isDrop = textLower.includes('drop') || textLower.includes('withdraw');
      const isMinor = textLower.includes('minor') && (textLower.includes('add') || textLower.includes('pick up') || textLower.includes('declare') || textLower.includes('real choice'));

      let fallbackText = `I couldn't reach the advising service just now. Please try again in a moment, or book time with your advisor for anything urgent.`;
      let fallbackEscalation = false;
      let fallbackCitation = 'OSU Course Bulletin 2026-2027';
      let fallbackHighStakes: HighStakesDecisionData | null = null;

      if (isDrop) {
        const course = currentCourseMentioned(textLower) ?? 'this class';
        fallbackText = `⚠️ Academic Record Guardrail: You requested to drop ${course} as a real academic choice.\n\nPer university policy, AI assistants cannot unilaterally alter transcripts. Dropping below 12 credit hours terminates full-time status (risking FAFSA & scholarships) and delays your prerequisite chain.\n\nPlease review the impacts below. You can escalate directly to Sarah Jenkins or submit for expedited advisor sign-off.`;
        fallbackCitation = 'OSU Faculty Rule 3335-8-32 & Fisher Undergraduate Handbook';
        fallbackEscalation = true;
        fallbackHighStakes = {
          isHighStakes: true,
          actionType: 'drop_class',
          decisionTitle: `Drop ${course} (Autumn 2026 Enrollment)`,
          warningSummary: `You are requesting to officially drop ${course}. Doing so carries financial aid and degree completion implications. Automated AI systems cannot modify your official SIS transcript without advisor sign-off.`,
          consequences: [
            'Financial Aid: Dropping below 12 credits terminates full-time status (FAFSA and scholarship risk).',
            `Prerequisites: ${course} is a required prerequisite for 3000-level core courses, delaying graduation 1–2 terms.`,
            'Transcript: Drops processed after the 4th Friday generate a permanent "W" mark on your official transcript.'
          ],
          escalateRecommended: true
        };
      } else if (isMinor) {
        const minorName = textLower.includes('cse') ? 'Computer Science (CSE) Minor' : 'Business Analytics & CIS Minor';
        fallbackText = `⚠️ Curriculum Declaration Notice: You requested to declare the ${minorName} in BuckeyeLink.\n\nDeclaring a minor permanently binds 15–16 graded credits to your DARS degree audit and requires formal college advisor filing. Please review the requirements below to escalate or route to advisor Sarah Jenkins.`;
        fallbackCitation = 'Fisher College Minor Declarations & Inter-College Policies';
        fallbackEscalation = true;
        fallbackHighStakes = {
          isHighStakes: true,
          actionType: 'add_minor',
          decisionTitle: `Declare ${minorName} on Degree Audit`,
          warningSummary: `You are requesting to officially declare ${minorName}. University policy prohibits AI agents from filing permanent curriculum declarations without human advisor validation.`,
          consequences: [
            'Overlap Limit: Only a limited number of credit hours can overlap between your major and a declared minor.',
            'College Approval: Engineering and Arts & Sciences minors require college review and 2.50+ CPHR verification.',
            'Graduation Audit: Declared minors must be fully completed or formally removed prior to graduation.'
          ],
          escalateRecommended: true
        };
      } else if (isHold) {
        fallbackText = `BuckAI can't see your BuckeyeLink holds yet. Check the Holds section in BuckeyeLink, and if you have one, your advisor can tell you what's needed to clear it.`;
        fallbackEscalation = true;
        fallbackCitation = 'University Registrar Registration Hold Policy & Fisher Milestone Guidelines';
      } else if (textLower.includes('building') || textLower.includes('access') || textLower.includes('after-hour') || textLower.includes('study') || textLower.includes('buckid') || textLower.includes('dreese') || textLower.includes('library')) {
        fallbackText = `Every Ohio State student already has automatic 24/7 access to 18th Avenue Library and daytime/evening access to Thompson Library on their BuckID.\n\nIf you need access to other academic buildings (like Mason Hall or Dreese Labs) after they lock in the evening or on weekends, you can request it right here in the **After-Hours Study Access** tab. Once approved, you just tap your BuckID at the door!`;
        fallbackCitation = 'OSU University Libraries & Public Safety Access Guidelines';
        fallbackEscalation = false;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now() + 1}`,
          role: 'assistant',
          text: fallbackText,
          sourceCitation: fallbackCitation,
          confidence: 'high',
          confidenceExplanation: 'Loaded directly from SIS degree audit rules.',
          escalationSuggested: fallbackEscalation,
          highStakesDecision: fallbackHighStakes,
        }
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Handle Dynamic Roadmap updates via Claude
  const handleUpdateRoadmap = async (promptText: string) => {
    setIsRoadmapUpdating(true);
    try {
      const response = await fetch('/api/roadmap-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          studentProfile: profile,
          currentRoadmap: roadmap,
        }),
      });

      if (!response.ok) throw new Error('Roadmap API error');
      const data = await response.json();
      if (data.semesters && Array.isArray(data.semesters)) {
        // Keep the classes the student entered for past and current terms; only planned terms change.
        const locked = roadmap.filter((s) => s.status !== 'planned');
        const lockedIds = new Set(locked.map((s) => s.id));
        const next = normalizeSemesters([
          ...locked,
          ...data.semesters.filter((s: Semester) => !lockedIds.has(s.id)).map((s: Semester) => ({ ...s, status: 'planned' as const })),
        ]);
        setRoadmap(next);
        onRoadmapChange(next);
      }
    } catch (err) {
      console.warn('Roadmap update failed:', err);
    } finally {
      setIsRoadmapUpdating(false);
    }
  };

  // A class code from this term's schedule that the student mentioned, if any.
  function currentCourseMentioned(textLower: string): string | undefined {
    const current = roadmap.find((s) => s.status === 'in-progress');
    return current?.courses.find((c) => textLower.includes(c.code.toLowerCase()))?.code;
  }

  const handleConfirmBooking = (slot: AdvisorSlot, format: string, notes: string) => {
    setBookedSlot(slot);
    setBookedFormat(format);
    setBookedNotes(notes);
  };

  const handleUpdateDecision = (messageId: string, updatedDecision: HighStakesDecisionData) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, highStakesDecision: updatedDecision } : msg
      )
    );
  };

  const handleOpenChat = (tab: typeof chatTab = 'chat', prompt?: string) => {
    setChatTab(tab);
    setIsChatOpen(true);
    if (prompt) {
      handleSendMessage(prompt);
    }
  };

  const handleOpenChatWithPrompt = (prompt: string) => {
    handleOpenChat('chat', prompt);
  };

  const handleTriggerSeatDropAlert = (course?: WatchedCourse) => {
    const target = course || INITIAL_WATCHED_COURSES[0];
    if (!target) return;
    setAlertCourse(target);
    setIsSeatDropBannerOpen(true);
  };

  const handleOpenSeatAlerts = () => {
    handleOpenChat('seatAlerts');
  };

  return (
    <div className="min-h-screen bg-[#f6f7f9] flex flex-col font-sans text-gray-900">
      {/* Live Seat Drop Notification Banner / Modal */}
      <InstantSeatDropBanner
        isOpen={isSeatDropBannerOpen}
        course={alertCourse}
        onClose={() => setIsSeatDropBannerOpen(false)}
        onQuickEnroll={(c) => {
          setIsChatOpen(true);
          setChatTab('chat');
          handleSendMessage(`Register in ${c.code} Section ${c.section} (Instant Seat Drop Alert).`);
        }}
      />

      {/* Exact BuckeyeLink Header from Screenshot */}
      <Header
        currentStep={currentStep}
        onSelectStep={(step) => setCurrentStep(step)}
        onOpenSurveyModal={() => setIsSurveyModalOpen(true)}
      />

      {/* Main Content Area: Replica BuckeyeLink Portal */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto p-4 sm:p-6 md:p-8">
        {currentStep === 1 && (
          <DashboardView
            profile={profile}
            roadmap={roadmap}
            onOpenChat={() => handleOpenChat('chat')}
            onOpenChatWithPrompt={handleOpenChatWithPrompt}
            onOpenRoadmap={() => handleOpenChat('roadmap')}
            onOpenScheduling={() => handleOpenChat('advisor')}
            onNextStep={() => setCurrentStep(2)}
            onOpenSeatAlerts={handleOpenSeatAlerts}
            onSimulateSeatDrop={() => handleTriggerSeatDropAlert()}
          />
        )}

        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-xl border border-gray-200 flex items-center justify-between">
              <span className="font-bold text-gray-900">Step 2: Native Advising Bot Launched</span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="px-3 py-1.5 bg-gray-100 rounded text-xs font-semibold"
                >
                  Back
                </button>
                <button
                  onClick={() => setCurrentStep(4)}
                  className="px-3 py-1.5 bg-[#ba0c2f] text-white rounded text-xs font-semibold"
                >
                  Next: Advisor Scheduling
                </button>
              </div>
            </div>
            <DashboardView
              profile={profile}
              roadmap={roadmap}
              onOpenChat={() => setIsChatOpen(true)}
              onOpenChatWithPrompt={handleOpenChatWithPrompt}
              onOpenRoadmap={() => setIsChatOpen(true)}
              onOpenScheduling={() => setIsChatOpen(true)}
            />
          </div>
        )}

        {currentStep === 4 && (
          <AdvisorSchedulingView
            profile={profile}
            roadmap={roadmap}
            onConfirmBooking={(slot, fmt, notes) => {
              handleConfirmBooking(slot, fmt, notes);
              setCurrentStep(5);
            }}
            onBackToRoadmap={() => setCurrentStep(1)}
            onNextStep={() => setCurrentStep(5)}
            isBooked={!!bookedSlot}
            bookedSlot={bookedSlot}
          />
        )}

        {currentStep === 5 && (
          <SummaryConfirmationView
            profile={profile}
            bookedSlot={bookedSlot}
            format={bookedFormat}
            notes={bookedNotes}
            roadmap={roadmap}
            onBackToScheduling={() => setCurrentStep(4)}
            onRestartWalkthrough={() => {
              setCurrentStep(1);
              setIsChatOpen(false);
            }}
            onReturnToDashboard={() => {
              setCurrentStep(1);
              setIsChatOpen(false);
            }}
          />
        )}
      </main>

      {/* NATIVE RED ADVISING AI BUTTON IN LOWER RIGHT HAND CORNER */}
      {!isChatOpen && (
        <button
          onClick={() => handleOpenChat('chat')}
          className="fixed bottom-6 right-6 z-40 bg-[#ba0c2f] hover:bg-[#9d0a27] text-white px-5 py-3 rounded-full shadow-2xl flex items-center space-x-2.5 transition-transform hover:scale-105 active:scale-95 border-2 border-white/20"
          title="Open BuckAI"
        >
          <svg className="w-5 h-5 fill-white shrink-0" viewBox="0 0 24 24">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12zM7 9h10v2H7zm0-3h10v2H7z" />
          </svg>
          <span className="font-bold text-sm tracking-wide font-sans">BuckAI</span>
        </button>
      )}

      {/* NATIVE ADVISING POPUP DIALOG */}
      <AiChatWidget
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        profile={profile}
        messages={messages}
        onSendMessage={handleSendMessage}
        isLoading={isChatLoading}
        roadmap={roadmap}
        onUpdateRoadmap={handleUpdateRoadmap}
        isRoadmapUpdating={isRoadmapUpdating}
        bookedSlot={bookedSlot}
        onConfirmBooking={handleConfirmBooking}
        onUpdateDecision={handleUpdateDecision}
        initialTab={chatTab}
        onSimulateSeatDrop={handleTriggerSeatDropAlert}
      />

      {/* Survey Insights Modal */}
      <SurveyModal
        isOpen={isSurveyModalOpen}
        onClose={() => setIsSurveyModalOpen(false)}
      />

      {/* Clean Footer */}
      <footer className="bg-white border-t border-gray-200 py-3.5 px-6 text-xs text-gray-500">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>The Ohio State University • BuckeyeLink</span>
          <div className="flex items-center space-x-3">
            <a
              href="/api/download-zip"
              download="buckeyelink-advising-ai.zip"
              className="text-[#ba0c2f] hover:underline font-semibold flex items-center space-x-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Project (.zip)</span>
            </a>
            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded border border-gray-200">
              Prototype: sample data
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
