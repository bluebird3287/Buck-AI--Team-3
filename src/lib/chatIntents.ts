// What a student is asking the advising chat to do, so BuckAI can act on it:
// - navigation: take them to the tab where they can do it (book an advisor, seat alerts, building access, ...)
// - big decisions: show a "this is a big decision" card with their own consequences, and let them choose
//   to go through with it or confirm with their advisor first.
// Detection is plain pattern matching so it works even when the AI service is down; the AI's own
// flags (openTab, highStakesDecision.actionType) fill in anything these patterns miss.

import type { Semester, StudentProfile } from '../data/sampleData';
import type { HighStakesDecisionData, DecisionType } from '../components/HighStakesDecisionCard';
import { Curriculum, DegreeAudit, catalogCourse, coursesRequiring, requirementsUsing } from './requirements';

export type ChatTab = 'chat' | 'roadmap' | 'requirements' | 'whatif' | 'rmp' | 'officeHours' | 'advisor' | 'seatAlerts' | 'studyAccess';

export const TAB_LABELS: Record<ChatTab, string> = {
  chat: 'Advising Assistant',
  whatif: 'What-If Minor Audit',
  roadmap: '4-Year Degree Plan',
  requirements: 'Degree Requirements',
  rmp: 'Faculty Evaluations',
  officeHours: 'Office Hours',
  advisor: 'Advisor Scheduling',
  seatAlerts: 'Seat Alerts',
  studyAccess: 'After-Hours Study Access',
};

// A button under a chat reply. `tab` opens a panel tab; 'profile' opens the My classes editor.
export interface ChatAction {
  label: string;
  tab: ChatTab | 'profile';
  autoOpen?: boolean; // open it right away (only for fresh replies, never when an old chat is reloaded)
  note?: string; // for Advisor Scheduling: what the student wants to talk about (pre-fills the request)
}

export interface NavigationIntent {
  id: string;
  action: ChatAction;
  // Answer locally without the AI (pure "take me there" requests); otherwise the AI answers and the button is added
  handleLocally: boolean;
  reply: string;
}

const lower = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

// "what if", "should I", "would it" are questions, not decisions.
export const isExploring = (t: string) => /\b(what if|what would|what happens|should i|would it|thinking about|considering|is it (a good|bad|smart)|pros and cons)\b/.test(t);

// What the student wants to talk to their advisor about: "book an appointment about dropping ACCTMIS 2300"
export function meetingTopic(text: string): string | null {
  const m = /\b(?:about|regarding|to (?:talk|discuss|go over|review|ask)(?: about)?|for|because|so (?:i|we) can)\s+(.{3,160})$/i.exec(text.trim());
  if (!m) return null;
  const topic = m[1].replace(/[.?!]+$/, '').trim();
  // "for next week", "for Tuesday" are times, not topics
  if (/^(next|this|tomorrow|today|monday|tuesday|wednesday|thursday|friday|the week|a time|an appointment)\b/i.test(topic)) return null;
  // "talk to my advisor" names who, not what
  if (/^(to|with) (my|an|a|the) (academic )?advis[oe]r\b/i.test(topic)) return null;
  return topic;
}

const BOOK_ADVISOR =
  /\b(book|schedule|make|set up|setup|get|request|need|want)\b[^.?!]{0,40}\b(appointment|meeting|time with|advising session)\b|\b(talk|speak|meet|chat)\s+(to|with)\s+(my|an|a|the)\s+(academic )?advis[oe]r\b|\bsee (my|an) (academic )?advis[oe]r\b|\badvis[oe]r (appointment|meeting)\b|\bappointment with (my|an|the) advis[oe]r\b/;
const SEAT_ALERTS =
  /\bseat alerts?\b|\bwait ?list\b|\b(notify|alert|tell|ping) me\b[^.?!]{0,40}\b(seat|spot|opens?|opening|section|class)\b|\b(watch|track)\b[^.?!]{0,30}\b(section|class|seat)\b|\bclass is (full|closed)\b|\b(section|class) (is )?(full|closed)\b/;
const BUILDING_ACCESS =
  /\b(after[- ]hours?|late[- ]night)\b[^.?!]{0,40}\b(access|building|study|room|lab)\b|\b(building|card|swipe|buckid) access\b|\baccess to (a |the )?([a-z]+ )?(hall|building|lab|library)\b|\b(get|let) (me )?in(to)? [a-z ]{0,20}(hall|building|lab)\b|\bstudy (space|spot|room)s?\b[^.?!]{0,20}\b(late|night|weekend|after)\b/;
const FACULTY =
  /\b(professor|prof|instructor|teacher|faculty|lecturer)s?\b[^.?!]{0,40}\b(rating|ratings|review|reviews|evaluation|evaluations|good|best|easiest|hardest|recommend|like)\b|\brate ?my ?prof|\bwho (should i|to) take\b|\b(faculty|course|teacher) evaluations?\b|\bwhich (professor|prof|instructor|section) (is|should)\b/;
const WHATIF_MINOR =
  /\bwhat[- ]if\b[^.?!]{0,30}\bminor\b|\b(which|what) minors?\b|\bminor (options|audit|ideas)\b|\b(could|can) i (add|get|do|fit) a minor\b|\bclosest to (finishing|completing|done with) a minor\b|\bminors? (i could|i can|that fit)\b/;
const REQUIREMENTS =
  /\bwhat (do|else do) i (still )?need\b|\brequirements? (do i have )?(left|remaining)\b|\bdegree audit\b|\bhow close am i\b|\bam i on track\b|\bwhat('s| is) left\b|\bgraduation requirements\b|\bwhat classes (do i|i) (still )?need\b/;
const OFFICE_HOURS = /\boffice hours?\b|\b(when|where) (can|could|do) i (meet|see|find|talk to) (my )?(professor|prof|instructor|ta|teaching assistant)\b|\b(ta|teaching assistant)'?s? (hours|office|email)\b|\b(email|contact) (my )?(professor|prof|instructor|ta)\b/;
const VIEW_PLAN = /\b(show|see|view|open|pull up|look at) (me )?my (4[- ]?year |four[- ]year |degree )?(plan|roadmap)\b/;
const EDIT_PROFILE =
  /\b(update|edit|change|fix|correct|add)\b[^.?!]{0,30}\b(my classes|my profile|my gpa|my grades?|classes i (took|have taken|completed)|my entry (term|year)|when i (started|entered)|my graduation (date|term)|my advising report)\b|\bupload (my )?(advising )?report\b/;

// "open the seat alerts tab", "take me to faculty evaluations"
const OPEN_TAB = /\b(open|go to|take me to|bring up|switch to|show me|navigate to|where is|where's)\b/;
const TAB_WORDS: [RegExp, ChatTab][] = [
  [/advis(or|er) schedul|scheduling/, 'advisor'],
  [/seat alert|wait ?list/, 'seatAlerts'],
  [/after[- ]hours|study access|building access/, 'studyAccess'],
  [/faculty eval|evaluations|professor ratings/, 'rmp'],
  [/office hours/, 'officeHours'],
  [/what[- ]if|minor audit/, 'whatif'],
  [/degree requirements|requirements tab|degree audit/, 'requirements'],
  [/4[- ]year|four[- ]year|degree plan|roadmap/, 'roadmap'],
];

export function detectNavigation(text: string): NavigationIntent | null {
  const t = lower(text);

  if (BOOK_ADVISOR.test(t) && !/\b(cancel|reschedule)\b/.test(t)) {
    const topic = meetingTopic(text);
    return {
      id: 'book_advisor',
      handleLocally: true,
      action: { label: 'Pick a time with your advisor', tab: 'advisor', autoOpen: true, note: topic ?? undefined },
      reply: `I've opened **Advisor Scheduling** so you can pick a time that works for you and your advisor.${
        topic ? `\n\nI noted what you want to talk about ("${topic}") on the request, so your advisor sees it before you meet.` : ''
      }\n\nBuckAI checks the request first, then your advisor approves it.`,
    };
  }
  if (/\b(cancel|reschedule|move)\b[^.?!]{0,30}\b(appointment|meeting)\b/.test(t)) {
    return {
      id: 'manage_appointment',
      handleLocally: true,
      action: { label: 'Open Advisor Scheduling', tab: 'advisor', autoOpen: true },
      reply: "I've opened **Advisor Scheduling**, where your current request is shown. To cancel or move an approved meeting, email your advisor so the time frees up for another student.",
    };
  }
  if (SEAT_ALERTS.test(t) && !isExploring(t)) {
    return {
      id: 'seat_alerts',
      handleLocally: true,
      action: { label: 'Open Seat Alerts', tab: 'seatAlerts', autoOpen: true },
      reply: "I've opened **Seat Alerts**. Add the class and section you want, and BuckAI will tell you as soon as a seat opens so you can register in BuckeyeLink.",
    };
  }
  if (BUILDING_ACCESS.test(t)) {
    return {
      id: 'building_access',
      handleLocally: true,
      action: { label: 'Request building access', tab: 'studyAccess', autoOpen: true },
      reply:
        "I've opened **After-Hours Study Access**. Every student already has 24/7 access to 18th Avenue Library on their BuckID. For other buildings, pick one there and BuckAI writes the request to the office that grants access; you send it from your OSU email.",
    };
  }
  if (EDIT_PROFILE.test(t)) {
    return {
      id: 'edit_profile',
      handleLocally: true,
      action: { label: 'Open My classes', tab: 'profile' },
      reply:
        'You can change that under **My classes**: your classes and grades, GPA, entry and graduation terms, specializations, minor, and honors programs. You can also upload your BuckeyeLink advising report there to fill it in for you.',
    };
  }
  if (OPEN_TAB.test(t)) {
    const hit = TAB_WORDS.find(([re]) => re.test(t));
    if (hit) {
      return {
        id: 'open_tab',
        handleLocally: true,
        action: { label: `Open ${TAB_LABELS[hit[1]]}`, tab: hit[1], autoOpen: true },
        reply: `I've opened **${TAB_LABELS[hit[1]]}**.`,
      };
    }
  }
  if (VIEW_PLAN.test(t)) {
    return {
      id: 'view_plan',
      handleLocally: true,
      action: { label: 'Open my 4-year plan', tab: 'roadmap', autoOpen: true },
      reply: "I've opened your **4-Year Degree Plan**. Ask me to build or change it any time (for example, \"make my senior year lighter\").",
    };
  }
  // Questions the AI answers; the button takes them to the full view
  if (WHATIF_MINOR.test(t)) return { id: 'whatif_minor', handleLocally: false, action: { label: 'Compare minors', tab: 'whatif' }, reply: '' };
  // Office hours: the AI answers from the student's own classes' syllabi, with a button to the full list
  if (OFFICE_HOURS.test(t)) return { id: 'office_hours', handleLocally: false, action: { label: 'See office hours for my classes', tab: 'officeHours' }, reply: '' };
  if (FACULTY.test(t)) return { id: 'faculty', handleLocally: false, action: { label: 'See faculty evaluations', tab: 'rmp' }, reply: '' };
  if (REQUIREMENTS.test(t)) return { id: 'requirements', handleLocally: false, action: { label: 'See my degree requirements', tab: 'requirements' }, reply: '' };
  return null;
}

// A tab the AI asked to open, as a button (for requests the patterns above don't recognize).
export function navigationFromAi(openTab: unknown, bookingReason: unknown): ChatAction | null {
  const tab = String(openTab ?? '') as ChatTab;
  if (!(tab in TAB_LABELS) || tab === 'chat') return null;
  return {
    label: tab === 'advisor' ? 'Pick a time with your advisor' : `Open ${TAB_LABELS[tab]}`,
    tab,
    autoOpen: tab === 'advisor',
    note: typeof bookingReason === 'string' && bookingReason.trim() ? bookingReason.trim() : undefined,
  };
}

// ---------- Big decisions ----------

export interface DecisionContext {
  profile: StudentProfile;
  roadmap: Semester[];
  curriculum: Curriculum | null;
  audit: DegreeAudit | null;
  specializationNames: string[]; // so "switch my specialization to Finance" isn't treated as leaving the college
}

const PROGRAM_WORDS = /speciali[sz]|\bminor\b|concentration|\btrack\b/;

// Which big decision a message is asking to make, if any.
export function detectDecision(text: string, ctx: DecisionContext): DecisionType | null {
  const t = lower(text);
  if (isExploring(t)) return null;
  const mentionsSpec = ctx.specializationNames.some((n) => n && t.includes(n.toLowerCase()));

  if (
    /\bwithdraw(ing|al)? (from )?(all|every|the (semester|term|university)|this (semester|term)|school|ohio state|osu|the university|college)\b|\bdrop (all|every one|everything)( of)?( my)? (classes|courses)?\b|\bdrop out\b|\b(leave|take a break from|stop attending) (school|osu|ohio state|college)\b|\bleave of absence\b|\btake (a|the|this|next) (semester|term|year) off\b/.test(
      t,
    )
  )
    return 'withdraw';
  if (/\b(pass\s*\/\s*(non|no)[- ]?pass|pass[- \/](fail|no pass|non[- ]pass)|p\/np|s\/u|satisfactory\/unsatisfactory)\b/.test(t) && /\b(take|taking|switch|change|make|put|do|want|can i)\b/.test(t))
    return 'pass_nonpass';
  if (
    (/\b(1[9]|2[0-4]) (credit|credit hours|hours|credits)\b|\bmore than 18 (credit|hour)s?\b|\bover 18 (credit|hour)s?\b|\boverload\b/.test(t)) &&
    /\b(take|taking|register|enroll|sign up|schedule|load|semester|term)\b/.test(t)
  )
    return 'overload';
  if (
    /\b(take|taking|transfer)\b[^.?!]{0,50}\b(at|from|through) (a |my )?(community college|cscc|columbus state|another (school|college|university)|home|my hometown|a different (school|college|university))\b|\btransfer (a |the |my )?(class|course|credit)s?\b/.test(
      t,
    )
  )
    return 'transfer_credit';
  if (
    !PROGRAM_WORDS.test(t) &&
    !mentionsSpec &&
    (/\b(change|switch|transfer)\b[^.?!]{0,30}\b(my )?(major|college|degree)\b|\b(leave|transfer out of|get out of) (fisher|the college of business|business school|engineering|the college of engineering)\b/.test(t))
  )
    return 'change_major';
  // "drop ACCTMIS 2300 from my plan" edits future terms, which the plan builder handles
  const fromPlan = /\b(from|in|out of) my (4[- ]?year |four[- ]year |degree )?(plan|roadmap)\b|\bnext (semester|term|year)\b/.test(t);
  if (/\b(drop|withdraw from|get out of|quit|leave)\b/.test(t) && !fromPlan && !PROGRAM_WORDS.test(t) && !mentionsSpec && !/\bmajor\b/.test(t)) {
    // Only a class the student is taking now; a planned class is a plan edit, not a big decision
    if (currentCourse(t, ctx.roadmap) || /\b(this|a|one of my|my) (class|course)\b/.test(t)) return 'drop_class';
  }
  return null;
}

const CODE = /\b([A-Za-z]{2,8})\s?(\d{4}(?:\.\d{2})?H?)\b/g;

// A class from the student's current term that the message names.
function currentCourse(t: string, roadmap: Semester[]) {
  const current = roadmap.find((s) => s.status === 'in-progress');
  if (!current) return undefined;
  const named = [...t.matchAll(CODE)].map((m) => `${m[1]} ${m[2]}`.toUpperCase());
  const exact = current.courses.find((c) => named.includes(c.code.toUpperCase())) ?? current.courses.find((c) => t.includes(c.code.toLowerCase()));
  // A specific class that isn't on this term's schedule isn't a current class
  if (exact || named.length) return exact;
  return (
    // "drop accounting", "drop calc": the subject alone, when only one current class has it
    (() => {
      const subj = current.courses.filter((c) => t.includes(c.code.split(' ')[0].toLowerCase()));
      return subj.length === 1 ? subj[0] : undefined;
    })()
  );
}

// Any course code in the message (for pass/non-pass and transfer credit).
function namedCourse(t: string): string | undefined {
  const m = [...t.matchAll(CODE)][0];
  return m ? `${m[1]} ${m[2]}`.toUpperCase() : undefined;
}

const REGISTRAR = 'registrar.osu.edu';
const FULL_TIME = 12;

// The decision card, built from the student's own term, plan, and requirements (never made-up numbers).
export function buildDecision(type: DecisionType, text: string, ctx: DecisionContext): HighStakesDecisionData {
  const t = lower(text);
  const advisor = ctx.profile.advisorName || 'your advisor';
  const current = ctx.roadmap.find((s) => s.status === 'in-progress');
  const termCredits = current?.courses.reduce((n, c) => n + (Number(c.credits) || 0), 0) ?? 0;
  const termName = current?.name ?? 'this term';
  const plannedCodes = new Set(ctx.roadmap.filter((s) => s.status === 'planned').flatMap((s) => s.courses.map((c) => c.code.toUpperCase())));
  const base = { isHighStakes: true, actionType: type, status: 'pending_review' as const, advisorName: advisor };

  if (type === 'drop_class') {
    const course = currentCourse(t, ctx.roadmap);
    const code = course?.code ?? namedCourse(t) ?? 'this class';
    const credits = Number(course?.credits) || 0;
    const after = termCredits - credits;
    const consequences: string[] = [];
    if (course && termCredits >= FULL_TIME && after < FULL_TIME)
      consequences.push(
        `Full-time status: you'd go from ${termCredits} to ${after} credit hours in ${termName}, below full time (12). That can reduce financial aid and scholarships, and can affect housing, health insurance, athletics, and visa status for international students.`,
      );
    else if (course && termCredits) consequences.push(`Credit load: you'd go from ${termCredits} to ${after} credit hours in ${termName}${after >= FULL_TIME ? ', still full time' : ''}.`);
    const counts = requirementsUsing(ctx.audit, code);
    if (counts.length) consequences.push(`Degree progress: ${code} counts toward ${counts.slice(0, 2).join(' and ')}, so you'd need to take it (or a substitute) later.`);
    const blocked = coursesRequiring(ctx.curriculum, code);
    const blockedPlanned = blocked.filter((c) => plannedCodes.has(c.toUpperCase()));
    if (blockedPlanned.length)
      consequences.push(`Prerequisites: ${code} is a prerequisite for ${blockedPlanned.slice(0, 4).join(', ')} in your plan, so those classes (and possibly graduation) would move back.`);
    else if (blocked.length) consequences.push(`Prerequisites: ${code} is a prerequisite for ${blocked.slice(0, 3).join(', ')}.`);
    const offered = catalogCourse(ctx.curriculum, code)?.offered_terms ?? [];
    if (offered.length === 1 && offered[0] !== 'None') consequences.push(`Scheduling: ${code} is only offered in ${offered[0]}, so retaking it could mean waiting a year.`);
    consequences.push(`Transcript and money: depending on the date, a dropped class can show as a W on your transcript and may not get a full refund. Check this term's deadlines before you drop.`);
    return {
      ...base,
      course: course?.code ?? (code !== 'this class' ? code : undefined),
      courseCredits: credits || undefined,
      decisionTitle: `Drop ${code}${current ? ` (${termName})` : ''}`,
      warningSummary: `Dropping a class you're enrolled in is a big decision. BuckAI can't drop it for you: you do that in BuckeyeLink, and it's worth checking with ${advisor} first.`,
      consequences,
      nextSteps: [
        `Check the drop and W deadlines for ${termName} on the University Registrar's calendar (${REGISTRAR}).`,
        'Drop it yourself in BuckeyeLink (your class enrollment page); BuckAI can then take it off your BuckAI schedule.',
        "If you receive financial aid or a scholarship, ask Student Financial Aid how the drop affects it before you confirm.",
      ],
      escalateRecommended: true,
    };
  }

  if (type === 'withdraw') {
    return {
      ...base,
      decisionTitle: `Withdraw from ${termName === 'this term' ? 'all classes this term' : `all ${termName} classes`}`,
      warningSummary: `Withdrawing from every class affects your aid, housing, and when you can come back. Talk with ${advisor} and Student Financial Aid before you do anything in BuckeyeLink.`,
      consequences: [
        termCredits ? `Enrollment: all ${termCredits} credit hours you're taking in ${termName} would be dropped.` : 'Enrollment: every class you are taking this term would be dropped.',
        'Financial aid: federal aid may have to be paid back based on how much of the term you completed, and scholarships may require full-time enrollment.',
        'Housing, health insurance, campus jobs, and visa status for international students can all depend on being enrolled.',
        "Coming back: you may need to re-enroll before a future term, and your 4-year plan's graduation date would move.",
        'Transcript: depending on the date, the classes can show as W.',
      ],
      nextSteps: [
        `Meet with ${advisor} first; they can tell you about alternatives (a reduced load, late drop, or a medical or compassionate withdrawal).`,
        'Contact Student Financial Aid about repayment before you withdraw.',
        'The withdrawal itself is processed through BuckeyeLink and the University Registrar.',
      ],
      escalateRecommended: true,
    };
  }

  if (type === 'pass_nonpass') {
    const code = namedCourse(t) ?? currentCourse(t, ctx.roadmap)?.code;
    const counts = code ? requirementsUsing(ctx.audit, code) : [];
    return {
      ...base,
      course: code,
      decisionTitle: `Take ${code ?? 'a class'} Pass/Non-Pass`,
      warningSummary: `Switching to Pass/Non-Pass changes how a class counts toward your degree. Confirm with ${advisor} that it will still count.`,
      consequences: [
        counts.length
          ? `Degree progress: ${code} counts toward ${counts.slice(0, 2).join(' and ')}. Courses for your major, specialization, and business core usually need a letter grade, so it may stop counting.`
          : 'Degree progress: Pass/Non-Pass courses usually count only as free electives, not toward your major, specialization, or core.',
        "GPA: a Pass doesn't raise your GPA, and some honors programs, graduate schools, and employers look for letter grades.",
        'Deadline: the Pass/Non-Pass option has to be chosen by a set date each term.',
      ],
      nextSteps: [`Ask ${advisor} whether ${code ?? 'the class'} can be Pass/Non-Pass and still count.`, 'If it can, change the grading option in BuckeyeLink before the deadline.'],
      escalateRecommended: true,
    };
  }

  if (type === 'overload') {
    const n = Number(/\b(\d{2}) (credit|hour)/.exec(t)?.[1]) || 19;
    return {
      ...base,
      decisionTitle: `Take ${n} credit hours in one term`,
      warningSummary: `More than 18 credit hours needs your college's approval. ${advisor} can tell you whether you qualify and help you plan the load.`,
      consequences: [
        'Approval: Ohio State requires college approval to schedule more than 18 credit hours.',
        'Workload: a heavy term raises the risk of lower grades in hard prerequisite classes; BuckAI can rebalance your plan instead.',
        'Cost: hours above the full-time band may be billed separately; check with the Bursar.',
      ],
      nextSteps: [`Ask ${advisor} about an overload request.`, 'Or ask BuckAI to spread those classes across other terms (including summer).'],
      escalateRecommended: true,
    };
  }

  if (type === 'transfer_credit') {
    const code = namedCourse(t);
    const residency = ctx.curriculum?.specialPrograms.some((p) => p.id === 'sp-accounting-honors') ? ' Accounting Honors also requires 60 graded hours on the Columbus campus.' : '';
    return {
      ...base,
      course: code,
      decisionTitle: `Take ${code ?? 'a class'} at another school`,
      warningSummary: `Credit from another school only helps if Ohio State accepts it as the right equivalent. Check before you enroll, and confirm with ${advisor}.`,
      consequences: [
        "Equivalency: check Ohio State's Transfer Credit tools (Transferology) for how the course comes in; a general elective credit won't meet a specific requirement.",
        `Residency: some requirements must be taken at Ohio State, especially business core and specialization courses.${residency}`,
        "GPA: transfer grades don't count in your Ohio State GPA, and the credit only arrives after the other school sends a transcript.",
      ],
      nextSteps: [`Confirm the equivalent with ${advisor} before you register elsewhere.`, 'After the term, send an official transcript to Ohio State Admissions.'],
      escalateRecommended: true,
    };
  }

  // change_major: leaving the student's degree or college
  const completed = ctx.roadmap.filter((s) => s.status === 'completed').reduce((n, s) => n + s.courses.reduce((m, c) => m + (Number(c.credits) || 0), 0), 0);
  return {
    ...base,
    decisionTitle: 'Change your major or college',
    warningSummary: `Changing your major or college changes every requirement BuckAI tracks for you. Talk it through with ${advisor} and the new program's advisors first.`,
    consequences: [
      `Credits: some of your ${completed || ctx.profile.earnedCredits} completed credit hours may only count as electives in a new major.`,
      'Admission: many majors (including Fisher and Engineering programs) have their own admission requirements, GPA minimums, or deadlines.',
      'Timeline: a new major can add terms, which affects cost and financial aid limits.',
    ],
    nextSteps: [
      `Meet with ${advisor} and an advisor in the new program.`,
      'Run a What-If report in the Buckeye Degree Planner to compare requirements.',
      'Once you change it officially, update your degree under My classes so BuckAI tracks the right requirements.',
    ],
    escalateRecommended: true,
  };
}

// The decision type the AI flagged, mapped onto ours (older replies used 'add_minor', which isn't a big decision).
export function decisionTypeFromAi(flag: any): DecisionType | null {
  if (!flag?.isHighStakes) return null;
  const type = String(flag.actionType ?? '');
  return (['drop_class', 'withdraw', 'pass_nonpass', 'overload', 'transfer_credit', 'change_major'] as const).find((x) => x === type) ?? null;
}
