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
import { AiChatWidget, ChatMessage, RoadmapUpdateResult } from './components/AiChatWidget';
import { HighStakesDecisionData } from './components/HighStakesDecisionCard';
import { AdvisorSchedulingView } from './components/AdvisorSchedulingView';
import { SummaryConfirmationView } from './components/SummaryConfirmationView';
import { PlanTerms, activePlanTerms, defaultPlanTerms, futureTerms, normalizeSemesters, parseTerm, planPrefsFromText, termKey } from './lib/studentProfile';
import { onlineInSummer } from './lib/onlineCourses';
import { TermPlanModal } from './components/TermPlanModal';
import {
  ChatConversation,
  createConversation,
  deleteConversation,
  listConversations,
  loadChatLog,
  renameConversation,
  saveChatMessage,
} from './lib/chatLog';
import { Curriculum, Program, auditDegree, catalogCredits, describeAudit, findProgram, guessSpecializations, majorLabel, minorBlockReason, planGaps, programIncludes, summerOnlineOptions, GeOption } from './lib/requirements';
import { SurveyModal } from './components/SurveyModal';
import { OfficeHoursLoad, describeOfficeHours, loadOfficeHours } from './lib/officeHours';
import { DecisionContext, buildDecision, decisionTypeFromAi, detectDecision, detectNavigation, navigationFromAi } from './lib/chatIntents';
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
  // Saves a specialization or minor change the student made from the chat
  onProgramChange?: (change: { specialization_ids: string[]; major: string; minor: string | null }) => void;
  onEditProfile?: () => void; // opens My classes
  onPickInstructor?: (courseCode: string, personName: string | null) => void; // Office Hours tab
}

// What the advising chat asks BuckAI to change about the student's programs
interface ProgramChangeRequest {
  specializations?: string[] | null; // the student's full new list of specializations
  minor?: string | null; // a minor's name, "" to remove it
}

// The student's profile, plan, and requirements after a change, for building a plan right away
interface PlanContext {
  specIds: string[];
  profile: StudentProfile;
  plan: Semester[];
}

// "Build me a roadmap", "make my 4-year plan", "redo my schedule for next year"…
const ROADMAP_REQUEST =
  /\b(build|make|create|generate|draft|plan out|fill( in)?|populate|redo|rebuild|rebalance|update|lay out)\b.*\b(road ?map|4[- ]?year|four[- ]year|degree plan|plan|schedule)\b/i;

// The opening chat message, written for whoever is signed in.
function greetingFor(profile: StudentProfile, roadmap: Semester[]): ChatMessage {
  const current = roadmap.find((s) => s.status === 'in-progress');
  const program = [profile.rank, profile.major && `pursuing ${profile.major}`, profile.minor && `with ${withMinor(profile.minor)}`]
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

// "Entrepreneurship Minor" stays as is; a bare "Finance" becomes "Finance minor"
const minorTitle = (name: string) => (/\bminor\b/i.test(name) ? name : `${name} minor`);
const withMinor = (name: string) => `the ${minorTitle(name)}`;

export default function App({ profile, initialRoadmap, onRoadmapChange, curriculum, planTerms, onPlanTermsChange, onProgramChange, onEditProfile, onPickInstructor }: AppProps) {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [chatTab, setChatTab] = useState<'chat' | 'roadmap' | 'requirements' | 'whatif' | 'rmp' | 'officeHours' | 'advisor' | 'seatAlerts' | 'studyAccess'>('chat');
  const [isSurveyModalOpen, setIsSurveyModalOpen] = useState<boolean>(false);
  const [alertCourse, setAlertCourse] = useState<WatchedCourse | null>(null);
  const [isSeatDropBannerOpen, setIsSeatDropBannerOpen] = useState<boolean>(false);

  // Student Profile & Data
  const [roadmap, setRoadmap] = useState<Semester[]>(initialRoadmap);

  // The student's degree requirements (Fisher BSBA, an Engineering BS, ...)
  const degreeName = curriculum?.degree.name ?? 'your degree';
  const requirementsSource = `${degreeName} requirements (${curriculum?.degree.catalog ?? 'published curriculum'})`;

  // Requirements check, recomputed whenever the plan changes
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

  // Office hours for the student's classes (OSU accounts only), for the Office Hours tab and the chat
  const [officeHours, setOfficeHours] = useState<OfficeHoursLoad | null>(null);
  useEffect(() => {
    loadOfficeHours().then(setOfficeHours).catch((err) => setOfficeHours({ status: 'error', message: String(err?.message ?? err) }));
  }, []);
  const officeHoursSummary =
    officeHours?.status === 'ok' ? describeOfficeHours(officeHours.entries, roadmap, profile.officeHoursPicks ?? {}) || undefined : undefined;
  const [messages, setMessages] = useState<ChatMessage[]>(() => [greetingFor(profile, initialRoadmap)]);

  // Chat history, like ChatGPT/Claude: the sidebar lists past chats, and the open chat saves
  // each message once it's final. A new chat isn't saved until its first message.
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isConversationLoading, setIsConversationLoading] = useState<boolean>(false);
  const savedIds = useRef(new Set<string>(['msg-1'])); // the greeting is never saved
  const conversationRef = useRef<Promise<string | null> | null>(null); // the open chat's id, once it exists
  const chatSession = useRef(0); // bumps on every switch, so a late result can't land in another chat
  const refreshConversations = () => listConversations().then(setConversations);
  useEffect(() => {
    void refreshConversations();
  }, []);

  const ensureConversation = () => {
    if (!conversationRef.current) {
      const session = chatSession.current;
      conversationRef.current = createConversation().then((id) => {
        if (id && session === chatSession.current) setActiveConversationId(id);
        return id;
      });
    }
    return conversationRef.current;
  };

  useEffect(() => {
    if (isConversationLoading) return;
    const unsaved = messages.filter((m) => !m.pending && !savedIds.current.has(m.id));
    if (!unsaved.length) return;
    unsaved.forEach((m) => savedIds.current.add(m.id));
    void (async () => {
      const id = await ensureConversation();
      if (!id) return;
      for (const m of unsaved) await saveChatMessage(id, m); // one at a time, to keep their order
      await refreshConversations();
    })();
  }, [messages, isConversationLoading]);

  const handleNewChat = () => {
    chatSession.current++;
    conversationRef.current = null;
    setActiveConversationId(null);
    setIsConversationLoading(false);
    setMessages([greetingFor(profile, roadmap)]);
  };

  const handleSelectConversation = async (id: string) => {
    if (id === activeConversationId) return;
    const session = ++chatSession.current;
    conversationRef.current = Promise.resolve(id);
    setActiveConversationId(id);
    setIsConversationLoading(true);
    setMessages([]);
    const history = await loadChatLog(id);
    if (session !== chatSession.current) return;
    history.forEach((m) => savedIds.current.add(m.id));
    setMessages(history);
    setIsConversationLoading(false);
  };

  const handleRenameConversation = async (id: string, title: string) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
    await renameConversation(id, title);
  };

  const handleDeleteConversation = async (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (id === activeConversationId) handleNewChat();
    await deleteConversation(id);
    await refreshConversations();
  };
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

    // "Book an appointment with my advisor", "open seat alerts", "I need after-hours access to Dreese":
    // take the student straight there, no AI round trip needed.
    const navigation = detectNavigation(text);
    if (navigation?.handleLocally) {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now() + 1}`,
          role: 'assistant',
          text: navigation.reply,
          action: navigation.action,
          sourceCitation: 'BuckAI',
          confidence: 'high',
          confidenceExplanation: 'BuckAI opened the part of the portal that handles this request.',
          escalationSuggested: false,
        },
      ]);
      return;
    }
    const decisionContext: DecisionContext = {
      profile,
      roadmap,
      curriculum,
      audit,
      specializationNames: curriculum?.specializations.map((p) => p.name.split(' (')[0]) ?? [],
    };
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
          officeHoursSummary,
          programOptions: curriculum
            ? {
                degree: curriculum.degree.name,
                specializations: curriculum.specializations.map((p) => p.name),
                minors: curriculum.minors.filter((p) => !minorBlockReason(p, curriculum.degree, specializationIds)).map((p) => p.name),
                closedMinors: curriculum.minors
                  .map((p) => ({ p, why: minorBlockReason(p, curriculum.degree, specializationIds) }))
                  .filter((m) => m.why)
                  .map((m) => `${m.p.name} (${m.why})`),
              }
            : null,
        }),
      });

      if (!response.ok) throw new Error(`Server status ${response.status}`);
      const data = await response.json();

      // Claude flags requests to build or change the roadmap; keywords are the backup.
      const wantsRoadmap = typeof data.roadmapRequest?.build === 'boolean' ? data.roadmapRequest.build : ROADMAP_REQUEST.test(text);

      // A specialization or minor change in the chat is applied to the student's BuckAI profile and plan
      const changeRequested = !!data.programChange && (Array.isArray(data.programChange.specializations) || typeof data.programChange.minor === 'string');
      const change = changeRequested ? applyProgramChange(data.programChange) : null;
      const planning = wantsRoadmap || !!change?.applied;

      // Big decisions (dropping a class, withdrawing, Pass/Non-Pass, ...) get a card built from the student's own
      // term, plan, and requirements. BuckAI's patterns and the AI's flag both count; the AI's wording isn't used.
      const decisionType = planning || changeRequested ? null : detectDecision(text, decisionContext) ?? decisionTypeFromAi(data.highStakesDecision);
      const highStakesDecision: HighStakesDecisionData | null = decisionType ? buildDecision(decisionType, text, decisionContext) : null;
      // A button to the tab that answers this (minors, faculty ratings, requirements), or one the AI asked for
      const action = highStakesDecision || planning ? undefined : navigation?.action ?? navigationFromAi(data.openTab, data.bookingReason) ?? undefined;

      const aiMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        text: data.answer || "I've reviewed your question against Ohio State academic guidelines.",
        sourceCitation: data.sourceCitation || 'OSU Course Bulletin 2026-2027',
        confidence: data.confidence || 'high',
        confidenceExplanation: data.confidenceExplanation || 'Verified against Ohio State curriculum rules.',
        escalationSuggested: data.escalationSuggested || (!!highStakesDecision),
        highStakesDecision,
        action,
      };

      // A change BuckAI couldn't make replaces Claude's reply, which may have said it was done
      if (change && !change.applied) setMessages((prev) => [...prev, { ...change.message, id: aiMsg.id }]);
      else {
        setMessages((prev) => [...prev, aiMsg]);
        if (change) setMessages((prev) => [...prev, change.message]);
      }

      // Rebuild the plan when asked, or when a change took classes out of it or added a program to fill
      const hasPlan = (change?.context.plan ?? roadmap).some((s) => s.status === 'planned' && s.courses.length);
      if (wantsRoadmap || (change?.applied && hasPlan)) {
        setIsChatLoading(false);
        const instructions = data.roadmapRequest?.instructions || (change?.applied ? change.summary : text);
        await buildRoadmapFromChat(instructions, change?.applied ? change.context : undefined);
      }
    } catch (err) {
      console.warn('API fallback:', err);
      const textLower = text.toLowerCase();
      const isHold = textLower.includes('hold') || textLower.includes('lock');
      const isMinor = declaresMinor(textLower);
      const fallbackType = detectDecision(text, decisionContext);

      let fallbackText = `I couldn't reach the advising service just now. Please try again in a moment, or book time with your advisor for anything urgent.`;
      let fallbackEscalation = false;
      let fallbackCitation = 'OSU Course Bulletin 2026-2027';
      let fallbackHighStakes: HighStakesDecisionData | null = null;
      let fallbackAction = navigation?.action;

      if (fallbackType) {
        fallbackHighStakes = buildDecision(fallbackType, text, decisionContext);
        fallbackText = `This is a big decision, so I've laid out what it would mean for you based on your classes and plan. Choose whether to go through with it yourself or confirm with ${profile.advisorName || 'your advisor'} first.`;
        fallbackCitation = 'Your BuckAI classes, plan, and degree requirements';
        fallbackEscalation = true;
        fallbackAction = undefined;
      } else if (isMinor) {
        fallbackText = `I couldn't reach the advising service just now, so I didn't change your minor. You can add or remove a minor under **My classes**, or check which minors you can add in the **What-If Minor Audit** tab.`;
        fallbackCitation = 'BuckAI minors (What-If Minor Audit)';
      } else if (isHold) {
        fallbackText = `BuckAI can't see your BuckeyeLink holds yet. Check the Holds section in BuckeyeLink, and if you have one, your advisor can tell you what's needed to clear it.`;
        fallbackEscalation = true;
        fallbackCitation = 'University Registrar Registration Hold Policy';
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
          action: fallbackAction,
        }
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Handle Dynamic Roadmap updates via Claude
  // Asks Claude for a plan, then checks it against the degree's requirements and sends any gaps back
  // to be fixed (up to two rounds), so the saved plan covers every requirement BuckAI can track.
  const buildRoadmap = async (
    promptText: string,
    terms: PlanTerms,
    context?: PlanContext,
  ): Promise<{ plan: Semester[]; gaps: string[]; notes: string[]; summary: string } | null> => {
    // A change made earlier in this chat turn hasn't reached this render's props yet
    const specIds = context?.specIds ?? specializationIds;
    const student = context?.profile ?? profile;
    const start = context?.plan ?? roadmap;
    setIsRoadmapUpdating(true);
    try {
      const locked = start.filter((s) => s.status !== 'planned');
      const lockedIds = new Set(locked.map((s) => s.id));
      // Only the terms the student chose (e.g. no summers), through their graduation term
      const allowed = activePlanTerms(terms, start);
      const allowedIds = new Set(allowed.map((t) => t.id));
      const hasSummer = allowed.some((t) => t.season === 'Summer');
      const summerMax = hasSummer ? terms.summerMaxCourses ?? null : null;
      const summerOnline = hasSummer && !!terms.summerOnline;
      const isSummer = (s: Semester) => s.id.startsWith('summer-');
      const summerRule = !hasSummer
        ? ''
        : [
            summerMax != null && `Put at most ${summerMax} class${summerMax === 1 ? '' : 'es'} in each summer term.`,
            summerOnline &&
              'Summer classes must be fully online: use only courses offered online in summer (listed below), never in-person-only classes.',
            'Summer terms may be lighter than 12 credits.',
          ]
            .filter(Boolean)
            .join(' ');
      const onlineList = () =>
        summerOnline && curriculum
          ? `\nUnmet requirements offered fully online last summer (Summer 2026), for the summer terms:\n- ${
              summerOnlineOptions(auditDegree(curriculum, specIds, start, student.earnedCredits), start).join('\n- ') || 'none found; leave summers empty rather than use in-person classes'
            }`
          : '';
      const termRule = `Schedule classes ONLY in these terms: ${allowed.map((t) => t.label).join(', ')} (graduating ${
        parseTerm({ id: terms.graduation }) ? terms.graduation.replace('-', ' ').replace(/^\w/, (c) => c.toUpperCase()) : 'on time'
      }). Use ids like "spring-2027". Do not put classes in any other term, including summers that aren't listed.${summerRule ? ` ${summerRule}` : ''}`;
      // Courses placed in terms the student didn't choose, or breaking their summer limits
      const termGaps = (p: Semester[]) => [
        ...p
          .filter((s) => s.status === 'planned' && s.courses.length && !allowedIds.has(s.id))
          .map((s) => `Move every class out of ${s.name}; the student isn't taking classes that term (use only: ${allowed.map((t) => t.label).join(', ')})`),
        ...p
          .filter((s) => s.status === 'planned' && isSummer(s) && summerMax != null && s.courses.length > summerMax)
          .map((s) => `${s.name} has ${s.courses.length} classes; the student wants at most ${summerMax} per summer. Move the rest to Autumn/Spring terms.`),
        ...p
          .filter((s) => s.status === 'planned' && isSummer(s) && summerOnline)
          .flatMap((s) => s.courses.filter((c) => c.code !== 'ELECTIVE' && !onlineInSummer(c.code)).map((c) => ({ s, c })))
          .map(({ s, c }) => `${c.code} in ${s.name} isn't offered online in summer; the student only takes online summer classes. Replace it with an online option or move it to Autumn/Spring.`),
      ];
      // Workload balance and extra credits: worth fixing, but not missing requirements
      const balanceNotes = (p: Semester[]) => {
        const notes: string[] = [];
        const regular = p.filter((s) => s.status === 'planned' && s.courses.length && !isSummer(s));
        if (regular.length > 1) {
          const heaviest = regular.reduce((a, b) => (b.totalCredits > a.totalCredits ? b : a));
          const lightest = regular.reduce((a, b) => (b.totalCredits < a.totalCredits ? b : a));
          if (heaviest.totalCredits - lightest.totalCredits > 4)
            notes.push(
              `Workload is uneven: ${heaviest.name} has ${heaviest.totalCredits} credits but ${lightest.name} has ${lightest.totalCredits}. Move classes so Autumn/Spring terms are within about 3 credits of each other (keep prerequisites in order).`,
            );
        }
        for (const s of regular) {
          const hard = s.courses.filter((c) => (c.difficulty ?? 3) >= 4);
          if (hard.length > 2)
            notes.push(`${s.name} stacks ${hard.length} hard classes (${hard.map((c) => c.code).join(', ')}); spread them across terms so no term has more than 2.`);
        }
        const total = p.reduce((n, s) => n + (s.status === 'completed' ? 0 : s.totalCredits), 0) + student.earnedCredits;
        const required = curriculum?.degree.min_total_credits ?? 121;
        const electives = p.filter((s) => s.status === 'planned').flatMap((s) => s.courses.filter((c) => c.code === 'ELECTIVE'));
        if (total > required + 2 && electives.length)
          notes.push(`The plan totals about ${Math.round(total)} credits, more than the ${required} required. Remove ELECTIVE placeholders that aren't needed to reach ${required}.`);
        return notes;
      };
      let plan = start;
      let prompt = `${promptText}\n${termRule}${onlineList()}`;
      let gaps: string[] = [];
      let notes: string[] = [];
      let planSummary = '';
      // Gap-fixing passes must keep what the student asked for (e.g. "lighten Spring 2027")
      const keepRequest = `Keep honoring the student's request: "${promptText.slice(0, 600)}"`;

      for (let round = 0; round < 3; round++) {
        setRoadmapStage(
          round === 0
            ? `Drafting your plan around your remaining ${degreeName} requirements`
            : `Fixing ${gaps.length} gap${gaps.length === 1 ? '' : 's'} in the plan (pass ${round + 1} of 3)`,
        );
        const summary = curriculum
          ? describeAudit(auditDegree(curriculum, specIds, plan, student.earnedCredits))
          : requirementsSummary;
        const response = await fetch('/api/roadmap-generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, studentProfile: student, currentRoadmap: plan, requirementsSummary: summary }),
        });
        if (!response.ok) throw new Error('Roadmap API error');
        const data = await response.json();
        if (!Array.isArray(data.semesters)) break;
        if (typeof data.summary === 'string') planSummary = data.summary;

        // Keep the classes the student entered for past and current terms; only planned terms change.
        plan = normalizeSemesters([
          ...locked,
          ...data.semesters
            .filter((s: Semester) => !lockedIds.has(s.id))
            .map((s: Semester) => ({
              ...s,
              status: 'planned' as const,
              // Use official credit hours where known (the AI sometimes guesses, e.g. 3 for 1.5-credit classes)
              courses: (s.courses ?? []).map((c) => ({
                ...c,
                credits: catalogCredits(curriculum, c.code) ?? c.credits,
                prereqMet: c.prereqMet ?? true,
                type: c.type ?? 'General',
                difficulty: c.difficulty ?? 3,
              })),
            })),
        ]);
        setRoadmapStage('Checking the plan against your requirements, prerequisites, and workload');
        gaps = [...termGaps(plan), ...(curriculum ? planGaps(auditDegree(curriculum, specIds, plan, student.earnedCredits)) : [])];
        notes = balanceNotes(plan);
        if (!gaps.length && !notes.length) break;
        prompt = `Revise the plan so it meets every requirement with a balanced workload and no extra credits. Keep what already works and fix only these problems:\n- ${[...gaps, ...notes].join('\n- ')}\n${keepRequest}\n${termRule}${onlineList()}`;
      }

      if (plan === start) return null;
      setRoadmap(plan);
      onRoadmapChange(plan);
      return { plan, gaps, notes, summary: planSummary };
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
  const [termPrompt, setTermPrompt] = useState<{ initial: PlanTerms; resolve: (plan: PlanTerms | null) => void } | null>(null);
  const askTermPlan = (initial: PlanTerms) => new Promise<PlanTerms | null>((resolve) => setTermPrompt({ initial, resolve }));
  // The saved term choices, adjusted by anything the request says about summers
  // ("only 1-2 online classes over the summers"), for the student to confirm.
  const termsFor = (text: string): PlanTerms => {
    const base = planTerms ?? defaultPlanTerms(roadmap, profile.expectedGraduation);
    const prefs = planPrefsFromText(text);
    if (prefs.summers === undefined) return base;
    const grad = parseTerm({ id: base.graduation });
    const summers = futureTerms(roadmap)
      .filter((t) => t.season === 'Summer' && (!grad || termKey(t.season, t.year) <= termKey(grad.season, grad.year)))
      .map((t) => t.id);
    if (!prefs.summers) return { ...base, terms: base.terms.filter((id) => !id.startsWith('summer-')), summerMaxCourses: null, summerOnline: false };
    return {
      ...base,
      terms: [...new Set([...base.terms, ...summers])],
      summerMaxCourses: prefs.summerMaxCourses ?? base.summerMaxCourses ?? null,
      summerOnline: prefs.summerOnline ?? base.summerOnline ?? false,
    };
  };
  const closeTermPrompt = (plan: PlanTerms | null) => {
    if (plan) onPlanTermsChange?.(plan);
    termPrompt?.resolve(plan);
    setTermPrompt(null);
  };

  // From the 4-Year Plan's GE menu: swap a planned GE course for another that fills the same requirement.
  const handleReplaceCourse = (semesterId: string, index: number, option: GeOption) => {
    const plan = normalizeSemesters(
      roadmap.map((s) =>
        s.id !== semesterId
          ? s
          : { ...s, courses: s.courses.map((c, i) => (i === index ? { ...c, code: option.code, name: option.title, credits: option.credits ?? c.credits } : c)) },
      ),
    );
    setRoadmap(plan);
    onRoadmapChange(plan);
  };

  // From the 4-Year Plan tab's chat. Like the main chat, it first asks which terms to plan (pre-filled
  // from their saved choices and anything the request says about summers), and returns what happened
  // so the tab can show it next to the plan.
  const handleUpdateRoadmap = async (promptText: string): Promise<RoadmapUpdateResult | null> => {
    const terms = await askTermPlan(termsFor(promptText));
    if (!terms) return null;
    const result = await buildRoadmap(promptText, terms);
    if (!result) {
      return {
        ok: false,
        text: "I couldn't update your plan. The planning service took too long or had an error, so your plan is unchanged. Please try again in a minute.",
      };
    }
    const changed = result.summary || 'Your plan is updated and saved.';
    return {
      ok: true,
      text:
        (result.gaps.length
          ? `${changed}\n\nIt still doesn't cover everything:\n- ${result.gaps.slice(0, 5).join('\n- ')}${
              result.gaps.length > 5 ? `\n- …and ${result.gaps.length - 5} more` : ''
            }\nSee the Degree Requirements tab, or bring this to your advisor.`
          : changed) + workloadNotes(result.notes),
    };
  };

  const workloadNotes = (notes: string[]) => (notes.length ? `\n\nWorkload notes:\n- ${notes.join('\n- ')}` : '');

  // From the chat ("build me a roadmap"): build and save the plan, then summarize it in the chat
  // and open the 4-Year Plan tab.
  const buildRoadmapFromChat = async (instructions: string, context?: PlanContext) => {
    const statusId = `msg-${Date.now()}-plan`;
    setMessages((prev) => [
      ...prev,
      { id: statusId, role: 'assistant', text: 'Before I build it, choose the terms you want to take classes in.', pending: true },
    ]);
    const terms = await askTermPlan(termsFor(instructions));
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
          ? { ...m, text: 'Building your 4-year plan in the terms you chose and checking it against your degree requirements… this can take up to a minute.' }
          : m,
      ),
    );
    const result = await buildRoadmap(
      `${instructions}\nBuild a complete plan through graduation that covers every remaining requirement for the student's degree (${degreeName}) and specialization(s) with as few total credit hours as possible, respects prerequisites, and balances workload evenly across terms.`,
      terms,
      context,
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
        text: `Your 4-year plan is ready and saved (${planned.length} planned terms, about ${Math.round(total)} credit hours total):\n\n${terms}${status}${workloadNotes(result.notes)}`,
        sourceCitation: requirementsSource,
        confidence: result.gaps.length ? 'moderate' : 'high',
        confidenceExplanation: `Checked against the published ${degreeName} requirements and the classes you entered. Your advisor has the final word.`,
        escalationSuggested: result.gaps.length > 0,
        action: { label: 'View my 4-year plan', tab: 'roadmap', autoOpen: true },
      };
    }
    setMessages((prev) => prev.map((m) => (m.id === statusId ? reply : m)));
  };

  // Applies a specialization or minor change the student asked for in the chat: saves it to their
  // profile and takes classes that only served a dropped program out of their planned terms.
  const applyProgramChange = (request: ProgramChangeRequest) => {
    const say = (text: string): ChatMessage => ({
      id: `msg-${Date.now() + 2}`,
      role: 'assistant',
      text,
      sourceCitation: requirementsSource,
      confidence: 'high',
      confidenceExplanation: 'Updated in BuckAI only. Your official record changes when your advisor files it.',
      escalationSuggested: true,
      action: { label: 'View my 4-year plan', tab: 'roadmap' },
    });
    const unchanged = (text: string) => ({ applied: false, message: say(text), summary: '', context: { specIds: specializationIds, profile, plan: roadmap } });
    if (!curriculum) return unchanged("I couldn't load your degree requirements, so I didn't change anything. Update it under **My classes** instead.");

    let specIds = specializationIds;
    const unmatched: string[] = [];
    // Degrees with specializations (every Fisher BSBA, and Engineering majors like ECE) need at least one
    if (Array.isArray(request.specializations) && !request.specializations.length && curriculum.specializations.length) {
      return unchanged(
        `Your ${degreeName} needs at least one specialization, so I didn't drop it. Tell me which one you'd like instead (for example, "switch to ${curriculum.specializations[0].name}").`,
      );
    }
    if (Array.isArray(request.specializations) && request.specializations.length) {
      const found = request.specializations.map((name) => {
        const p = findProgram(curriculum.specializations, String(name));
        if (!p) unmatched.push(String(name));
        return p?.id;
      });
      const ids = [...new Set(found.filter((id): id is string => !!id))];
      if (ids.length && !unmatched.length) specIds = ids;
    }
    let minor = profile.minor || '';
    if (typeof request.minor === 'string') {
      const p = request.minor.trim() ? findProgram(curriculum.minors, request.minor) : undefined;
      if (request.minor.trim() && !p) unmatched.push(request.minor);
      else minor = p?.name ?? '';
    }
    if (unmatched.length)
      return unchanged(
        `I couldn't match ${unmatched.map((n) => `"${n}"`).join(' and ')} to a program in BuckAI, so I didn't change anything. You can pick it under **My classes**.`,
      );
    // Same rule as the What-If Minor Audit: some minors are closed to the student's degree or specialization
    const chosenMinor = minor ? findProgram(curriculum.minors, minor) : undefined;
    const blocked = chosenMinor && minor !== (profile.minor || '') ? minorBlockReason(chosenMinor, curriculum.degree, specIds) : null;
    if (blocked) return unchanged(`I can't add the **${chosenMinor!.name}**: ${blocked} The What-If Minor Audit tab shows the minors you can add.`);
    const sameSpecs = specIds.length === specializationIds.length && specIds.every((id) => specializationIds.includes(id));
    if (sameSpecs && minor === (profile.minor || ''))
      return unchanged(
        `Your BuckAI profile already lists **${majorLabel(curriculum, specIds) || profile.major}**${minor ? ` with the **${minorTitle(minor)}**` : ' with no minor'}, so nothing changed.`,
      );

    const programs = (ids: string[]) => ids.map((id) => curriculum.specializations.find((p) => p.id === id)).filter((p): p is Program => !!p);
    const oldMinor = profile.minor ? findProgram(curriculum.minors, profile.minor) : undefined;
    const newMinor = minor ? findProgram(curriculum.minors, minor) : undefined;
    const dropped = [...programs(specializationIds.filter((id) => !specIds.includes(id))), ...(oldMinor && oldMinor !== newMinor ? [oldMinor] : [])];
    const added = [...programs(specIds.filter((id) => !specializationIds.includes(id))), ...(newMinor && newMinor !== oldMinor ? [newMinor] : [])];
    const kept = [curriculum.degree, ...programs(specIds), ...(newMinor ? [newMinor] : [])];

    // Planned classes that only counted toward a dropped program come out; completed ones stay as electives
    const removed: string[] = [];
    const plan = normalizeSemesters(
      roadmap.map((s) =>
        s.status !== 'planned'
          ? s
          : {
              ...s,
              courses: s.courses.filter((c) => {
                const out = dropped.some((p) => programIncludes(p, c.code)) && !kept.some((p) => programIncludes(p, c.code));
                if (out) removed.push(c.code);
                return !out;
              }),
            },
      ),
    );

    const major = majorLabel(curriculum, specIds) || profile.major;
    onProgramChange?.({ specialization_ids: specIds, major, minor: minor || null });
    if (removed.length) {
      setRoadmap(plan);
      onRoadmapChange(plan);
    }

    const names = (ps: Program[]) => ps.map((p) => p.name).join(' and ');
    const summary = [
      dropped.length && `The student dropped ${names(dropped)}; plan no classes for ${dropped.length > 1 ? 'them' : 'it'}.`,
      added.length && `The student added ${names(added)}; include every requirement for ${added.length > 1 ? 'them' : 'it'}.`,
      `Their programs are now: ${major}${minor ? ` with the ${minorTitle(minor)}` : ''}.`,
    ]
      .filter(Boolean)
      .join(' ');
    const lines = [
      `Done. Your BuckAI profile now lists **${major}**${minor ? ` with the **${minorTitle(minor)}**` : ''}${dropped.length ? `, without ${names(dropped)}` : ''}.`,
      removed.length
        ? `I took ${removed.length} class${removed.length === 1 ? '' : 'es'} out of your planned terms that only counted toward ${names(dropped)}: ${removed.join(', ')}.`
        : dropped.length
        ? `None of your planned classes counted only toward ${names(dropped)}.`
        : '',
      'Your requirements check now uses your new programs. To make it official, your advisor files the change with your college.',
    ];
    return {
      applied: true,
      message: say(lines.filter(Boolean).join('\n\n')),
      summary,
      context: { specIds, profile: { ...profile, major, minor, specializationIds: specIds }, plan },
    };
  };

  // "Drop my Finance specialization" or "drop the minor" changes a program, not a class.
  // "What if I dropped…" is a question, not a decision.
  const isExploring = (textLower: string) => /\b(what if|what would|should i|would it|thinking about|considering)\b/.test(textLower);

  function declaresMinor(textLower: string): boolean {
    return (
      textLower.includes('minor') &&
      !textLower.includes('drop') &&
      !isExploring(textLower) &&
      ['add', 'pick up', 'declare', 'real choice'].some((w) => textLower.includes(w))
    );
  }

  // After the student drops a class in BuckeyeLink, take it off their current term in BuckAI too
  const handleRemoveFromSchedule = (code: string) => {
    const plan = normalizeSemesters(
      roadmap.map((s) => (s.status === 'in-progress' ? { ...s, courses: s.courses.filter((c) => c.code.toUpperCase() !== code.toUpperCase()) } : s)),
    );
    setRoadmap(plan);
    onRoadmapChange(plan);
  };

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
        conversations={conversations}
        activeConversationId={activeConversationId}
        isConversationLoading={isConversationLoading}
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
        onRenameConversation={handleRenameConversation}
        onDeleteConversation={handleDeleteConversation}
        roadmap={roadmap}
        onUpdateRoadmap={handleUpdateRoadmap}
        onReplaceCourse={handleReplaceCourse}
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
        onEditProfile={onEditProfile}
        onRemoveFromSchedule={handleRemoveFromSchedule}
        officeHours={officeHours}
        onPickInstructor={onPickInstructor}
      />

      {/* Which terms to plan, asked before every roadmap build */}
      {termPrompt && (
        <TermPlanModal
          roadmap={roadmap}
          initial={termPrompt.initial}
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
