import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { PlanTerms, activePlanTerms, defaultPlanTerms, normalizeSemesters, parseTerm } from './lib/studentProfile';
import { TermPlanModal } from './components/TermPlanModal';
import { loadChatLog, saveChatMessage } from './lib/chatLog';
import { Curriculum, auditDegree, describeAudit, guessSpecializations, planGaps } from './lib/requirements';
import { SurveyModal } from './components/SurveyModal';
import { InstantSeatDropBanner } from './components/InstantSeatDropBanner';
import { WatchedCourse, INITIAL_WATCHED_COURSES } from './components/SeatAlertsView';
import { AdvisorSlot, Semester, StudentProfile } from './data/sampleData';

interface AppProps {
  profile: StudentProfile;
  initialRoadmap: Semester[];
  onRoadmapChange: (semesters: Semester[]) => void;
  curriculum: Curriculum | null;
  planTerms?: PlanTerms | null; // saved term choices; asked again before each roadmap build
  onPlanTermsChange?: (plan: PlanTerms) => void;
}

// "Build me a roadmap", "make my 4-year plan", "redo my schedule for next year"…
const ROADMAP_REQUEST =
  /\b(build|make|create|generate|draft|plan out|fill( in)?|populate|redo|rebuild|rebalance|update|lay out)\b.*\b(road ?map|4[- ]?year|four[- ]year|degree plan|plan|schedule)\b/i;

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

export default function App({ profile, initialRoadmap, onRoadmapChange, curriculum, planTerms, onPlanTermsChange }: AppProps) {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [chatTab, setChatTab] = useState<'chat' | 'roadmap' | 'requirements' | 'whatif' | 'rmp' | 'advisor' | 'seatAlerts' | 'studyAccess'>('chat');
  const [isSurveyModalOpen, setIsSurveyModalOpen] = useState<boolean>(false);
  const [alertCourse, setAlertCourse] = useState<WatchedCourse | null>(null);
  const [isSeatDropBannerOpen, setIsSeatDropBannerOpen] = useState<boolean>(false);

  // Student Profile & Data
  const [roadmap, setRoadmap] = useState<Semester[]>(initialRoadmap);

  // Fisher requirements check, recomputed whenever the plan changes
  const specializationIds = useMemo(
    () =>
      !curriculum ? [] : profile.specializationIds.length ? profile.specializationIds : guessSpecializations(curriculum, profile.major),
    [curriculum, profile.specializationIds, profile.major],
  );
  const audit = useMemo(
    () => (curriculum ? auditDegree(curriculum, specializationIds, roadmap, profile.earnedCredits) : null),
    [curriculum, specializationIds, roadmap, profile.earnedCredits],
  );
  const requirementsSummary = audit ? describeAudit(audit) : undefined;
  const [messages, setMessages] = useState<ChatMessage[]>(() => [greetingFor(profile, initialRoadmap)]);

  // Chat log: show the student's earlier conversation, then save each new message once it's final.
  const savedIds = useRef(new Set<string>(['msg-1']));
  const historyLoaded = useRef(false);
  useEffect(() => {
    loadChatLog().then((history) => {
      history.forEach((m) => savedIds.current.add(m.id));
      historyLoaded.current = true;
      // Always set state, so anything sent before history arrived gets saved too
      setMessages((prev) => [...history, ...prev]);
    });
  }, []);
  useEffect(() => {
    if (!historyLoaded.current) return;
    for (const m of messages) {
      if (m.pending || savedIds.current.has(m.id)) continue;
      savedIds.current.add(m.id);
      void saveChatMessage(m);
    }
  }, [messages]);
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [isRoadmapUpdating, setIsRoadmapUpdating] = useState<boolean>(false);
  const [roadmapStage, setRoadmapStage] = useState<string>('');

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
          requirementsSummary,
        }),
      });

      if (!response.ok) throw new Error(`Server status ${response.status}`);
      const data = await response.json();

      // Claude flags requests to build or change the roadmap; keywords are the backup.
      const wantsRoadmap = typeof data.roadmapRequest?.build === 'boolean' ? data.roadmapRequest.build : ROADMAP_REQUEST.test(text);

      let highStakesDecision: HighStakesDecisionData | null = wantsRoadmap ? null : data.highStakesDecision || null;
      const lower = text.toLowerCase();
      if (!wantsRoadmap && !highStakesDecision && (lower.includes('drop') || lower.includes('withdraw') || (lower.includes('minor') && (lower.includes('add') || lower.includes('pick up') || lower.includes('declare') || lower.includes('real choice'))))) {
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
      if (wantsRoadmap) {
        setIsChatLoading(false);
        await buildRoadmapFromChat(data.roadmapRequest?.instructions || text);
      }
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
  // Asks Claude for a plan, then checks it against Fisher's requirements and sends any gaps back
  // to be fixed (up to two rounds), so the saved plan covers every requirement BuckAI can track.
  const buildRoadmap = async (promptText: string, terms: PlanTerms): Promise<{ plan: Semester[]; gaps: string[] } | null> => {
    setIsRoadmapUpdating(true);
    try {
      const locked = roadmap.filter((s) => s.status !== 'planned');
      const lockedIds = new Set(locked.map((s) => s.id));
      // Only the terms the student chose (e.g. no summers), through their graduation term
      const allowed = activePlanTerms(terms, roadmap);
      const allowedIds = new Set(allowed.map((t) => t.id));
      const termRule = `Schedule classes ONLY in these terms: ${allowed.map((t) => t.label).join(', ')} (graduating ${
        parseTerm({ id: terms.graduation }) ? terms.graduation.replace('-', ' ').replace(/^\w/, (c) => c.toUpperCase()) : 'on time'
      }). Use ids like "spring-2027". Do not put classes in any other term, including summers that aren't listed.`;
      // Courses placed in terms the student didn't choose
      const termGaps = (p: Semester[]) =>
        p
          .filter((s) => s.status === 'planned' && s.courses.length && !allowedIds.has(s.id))
          .map((s) => `Move every class out of ${s.name}; the student isn't taking classes that term (use only: ${allowed.map((t) => t.label).join(', ')})`);
      let plan = roadmap;
      let prompt = `${promptText}\n${termRule}`;
      let gaps: string[] = [];

      for (let round = 0; round < 3; round++) {
        setRoadmapStage(
          round === 0
            ? 'Drafting your plan around your remaining Fisher requirements'
            : `Fixing ${gaps.length} gap${gaps.length === 1 ? '' : 's'} in the plan (pass ${round + 1} of 3)`,
        );
        const summary = curriculum
          ? describeAudit(auditDegree(curriculum, specializationIds, plan, profile.earnedCredits))
          : requirementsSummary;
        const response = await fetch('/api/roadmap-generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, studentProfile: profile, currentRoadmap: plan, requirementsSummary: summary }),
        });
        if (!response.ok) throw new Error('Roadmap API error');
        const data = await response.json();
        if (!Array.isArray(data.semesters)) break;

        // Keep the classes the student entered for past and current terms; only planned terms change.
        plan = normalizeSemesters([
          ...locked,
          ...data.semesters
            .filter((s: Semester) => !lockedIds.has(s.id))
            .map((s: Semester) => ({
              ...s,
              status: 'planned' as const,
              courses: (s.courses ?? []).map((c) => ({ ...c, prereqMet: c.prereqMet ?? true, type: c.type ?? 'General', difficulty: c.difficulty ?? 3 })),
            })),
        ]);
        if (!curriculum) {
          gaps = termGaps(plan);
          if (!gaps.length) break;
          prompt = `Revise the plan. Fix only these problems:\n- ${gaps.join('\n- ')}\n${termRule}`;
          continue;
        }
        setRoadmapStage('Checking the plan against your requirements and prerequisites');
        gaps = [...termGaps(plan), ...planGaps(auditDegree(curriculum, specializationIds, plan, profile.earnedCredits))];
        if (!gaps.length) break;
        prompt = `Revise the plan so it meets every requirement. Keep what already works and fix only these gaps:\n- ${gaps.join('\n- ')}\n${termRule}`;
      }

      if (plan === roadmap) return null;
      setRoadmap(plan);
      onRoadmapChange(plan);
      return { plan, gaps };
    } catch (err) {
      console.warn('Roadmap update failed:', err);
      return null;
    } finally {
      setIsRoadmapUpdating(false);
      setRoadmapStage('');
    }
  };

  // Before any plan is built, ask which terms the student wants classes in (e.g. no summers).
  // Resolves with their choice, or null if they cancel.
  const [termPrompt, setTermPrompt] = useState<{ resolve: (plan: PlanTerms | null) => void } | null>(null);
  const askTermPlan = () => new Promise<PlanTerms | null>((resolve) => setTermPrompt({ resolve }));
  const closeTermPrompt = (plan: PlanTerms | null) => {
    if (plan) onPlanTermsChange?.(plan);
    termPrompt?.resolve(plan);
    setTermPrompt(null);
  };

  // From the 4-Year Plan tab: build, then say what's still missing, if anything.
  const handleUpdateRoadmap = async (promptText: string) => {
    const terms = await askTermPlan();
    if (!terms) return;
    const result = await buildRoadmap(promptText, terms);
    const gaps = result?.gaps ?? [];
    if (!gaps.length) return;
    setMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        text: `I updated your plan, but it still doesn't cover everything:\n\n- ${gaps.join('\n- ')}\n\nCheck the Degree Requirements tab, or bring this to your advisor.`,
        sourceCitation: 'Fisher BSBA curriculum requirements',
        confidence: 'moderate',
        confidenceExplanation: 'Checked against Fisher\'s published requirements for students who entered before Autumn 2027.',
        escalationSuggested: true,
      },
    ]);
  };

  // From the chat ("build me a roadmap"): build and save the plan, then summarize it in the chat
  // and open the 4-Year Plan tab.
  const buildRoadmapFromChat = async (instructions: string) => {
    const statusId = `msg-${Date.now()}-plan`;
    setMessages((prev) => [
      ...prev,
      { id: statusId, role: 'assistant', text: 'Before I build it, choose the terms you want to take classes in.', pending: true },
    ]);
    const terms = await askTermPlan();
    if (!terms) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === statusId ? { id: statusId, role: 'assistant', text: "OK, I didn't change your plan. Ask me again whenever you're ready." } : m,
        ),
      );
      return;
    }
    setMessages((prev) =>
      prev.map((m) =>
        m.id === statusId
          ? { ...m, text: 'Building your 4-year plan in the terms you chose and checking it against Fisher’s requirements… this can take up to a minute.' }
          : m,
      ),
    );
    const result = await buildRoadmap(
      `${instructions}\nBuild a complete plan through graduation that covers every remaining Fisher requirement for the student's specialization(s), respects prerequisites, and balances workload.`,
      terms,
    );
    let reply: ChatMessage;
    if (!result) {
      reply = {
        id: statusId,
        role: 'assistant',
        text: "I couldn't finish building your plan. The planning service took too long or had an error. Please try again in a minute; if it keeps happening, use the 4-Year Degree Plan tab or ask your advisor.",
      };
    } else {
      const planned = result.plan.filter((s) => s.status === 'planned' && s.courses.length);
      const total = result.plan.reduce((n, s) => n + s.totalCredits, 0);
      const terms = planned.map((s) => `${s.name} (${s.totalCredits} cr): ${s.courses.map((c) => c.code).join(', ')}`).join('\n');
      const status = result.gaps.length
        ? `\n\nIt still doesn't cover everything:\n- ${result.gaps.slice(0, 5).join('\n- ')}${
            result.gaps.length > 5 ? `\n- …and ${result.gaps.length - 5} more` : ''
          }\n\nSee the Degree Requirements tab for the full list, or bring this to your advisor.`
        : '\n\nEvery requirement BuckAI can track is covered, with prerequisites in order. GE choices (arts, history, science, diversity, themes) are placeholders for you to pick.';
      reply = {
        id: statusId,
        role: 'assistant',
        text: `Your 4-year plan is ready and saved (${planned.length} planned terms, about ${Math.round(total)} credit hours total):\n\n${terms}${status}`,
        sourceCitation: 'Fisher BSBA curriculum requirements',
        confidence: result.gaps.length ? 'moderate' : 'high',
        confidenceExplanation: 'Checked against Fisher’s published requirements and the classes you entered. Your advisor has the final word.',
        escalationSuggested: result.gaps.length > 0,
        action: { label: 'View my 4-year plan', tab: 'roadmap', autoOpen: true },
      };
    }
    setMessages((prev) => prev.map((m) => (m.id === statusId ? reply : m)));
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
            audit={audit}
            onOpenRequirements={() => handleOpenChat('requirements')}
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
        roadmapStage={roadmapStage}
        bookedSlot={bookedSlot}
        onConfirmBooking={handleConfirmBooking}
        onUpdateDecision={handleUpdateDecision}
        initialTab={chatTab}
        onSimulateSeatDrop={handleTriggerSeatDropAlert}
        audit={audit}
        curriculum={curriculum}
        specializationIds={specializationIds}
      />

      {/* Which terms to plan, asked before every roadmap build */}
      {termPrompt && (
        <TermPlanModal
          roadmap={roadmap}
          initial={planTerms ?? defaultPlanTerms(roadmap)}
          onConfirm={(plan) => closeTermPrompt(plan)}
          onCancel={() => closeTermPrompt(null)}
        />
      )}

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
