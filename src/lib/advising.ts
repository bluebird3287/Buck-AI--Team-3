import { useSyncExternalStore } from 'react';
import type { AdvisorSlot, StudentProfile } from '../data/sampleData';

// Shared advising data for both sides of the app: student requests that the AI checks
// first and an advisor approves last, plus the availability both parties schedule from.
// Prototype storage: kept in this browser's localStorage so a request a student submits
// shows up in the advisor portal on the same machine. Swap this module for Supabase
// tables (with row-level security per CLAUDE.md) when requests are saved for real.

export type RequestCategory =
  | 'appointment'
  | 'hold_clearance'
  | 'drop_class'
  | 'add_minor'
  | 'change_major'
  | 'withdraw';

export type RequestStatus = 'ai_review' | 'pending_advisor' | 'needs_info' | 'scheduled' | 'approved' | 'denied';

export type AiVerdict = 'supported' | 'needs_attention' | 'not_supported';

export interface AiCheck {
  label: string;
  passed: boolean;
  detail: string;
}

export interface AiReview {
  verdict: AiVerdict;
  confidence: 'high' | 'moderate' | 'uncertain';
  summary: string;
  reasonForAppointment: string;
  studentNeeds: string[];
  riskFlags: string[];
  checks: AiCheck[];
  suggestedAgenda: string[];
  recommendation: string;
  source: 'claude' | 'rules';
  reviewedAt: string;
  // A detailed, plain-language account of the student's problem and circumstances, for
  // advisors who already know the requirements. Falls back to `summary` when missing.
  situation?: string;
}

// Where advisors open a student's official records (OSU login required). Ohio State has no
// separate unofficial transcript; the Advising Report in BuckeyeLink is the full record.
export const RECORD_LINKS = {
  degreePlanner: 'https://registrar.osu.edu/buckeye-degree-planner/',
  transcript: 'https://buckeyelink.osu.edu/',
};

export interface RequestStudent {
  name: string;
  email: string;
  osuId: string;
  rank: string;
  major: string;
  gpa: number;
  earnedCredits: number;
  enrolledCredits: number;
  holds: string[];
}

export interface RequestAppointment {
  slotKey: string; // YYYY-MM-DDTHH:MM
  format: 'In-Person' | 'Zoom' | 'Phone';
}

export interface AdvisingRequest {
  id: string;
  ticketId: string;
  category: RequestCategory;
  title: string;
  studentMessage: string;
  details?: { course?: string; credits?: number; minor?: string };
  student: RequestStudent;
  submittedAt: string;
  status: RequestStatus;
  aiReview: AiReview | null;
  appointment?: RequestAppointment;
  decision?: { by: string; note: string; at: string };
}

export const CATEGORY_LABELS: Record<RequestCategory, string> = {
  appointment: 'Advising appointment',
  hold_clearance: 'Hold clearance',
  drop_class: 'Drop a class',
  add_minor: 'Declare a minor',
  change_major: 'Change major',
  withdraw: 'Withdraw from term',
};

export const ADVISOR = {
  name: 'Sarah Jenkins, M.Ed.',
  title: 'Senior Academic Advisor, Fisher College of Business',
  email: 'jenkins.892@osu.edu',
  office: 'Mason Hall 120',
};

// ---------------------------------------------------------------------------
// Time and availability
// ---------------------------------------------------------------------------

export const DAY_START = 9 * 60; // 9:00 AM
export const DAY_END = 17 * 60; // 5:00 PM
export const SLOT_MINUTES = 30;

interface Block {
  label: string;
  days: number[]; // 1 = Monday ... 5 = Friday
  start: number;
  end: number;
}

// A sample weekly class schedule. Meeting times aren't synced from BuckeyeLink yet,
// so every student is matched against this schedule for now.
export const STUDENT_CLASSES: Block[] = [
  { label: 'Class', days: [1, 3, 5], start: 8 * 60, end: 8 * 60 + 55 },
  { label: 'Class', days: [2, 4], start: 9 * 60 + 35, end: 10 * 60 + 55 },
  { label: 'Class', days: [1, 3, 5], start: 11 * 60 + 30, end: 12 * 60 + 45 },
  { label: 'Class', days: [3], start: 14 * 60 + 15, end: 15 * 60 + 35 },
];

// The advisor's standing commitments.
export const ADVISOR_COMMITMENTS: Block[] = [
  { label: 'Lunch', days: [1, 2, 3, 4, 5], start: 12 * 60, end: 13 * 60 },
  { label: 'Walk-in advising hours', days: [2], start: 9 * 60, end: 10 * 60 },
  { label: 'Fisher advising team meeting', days: [4], start: 15 * 60, end: 16 * 60 },
];

export type SlotStatus = 'open' | 'student_busy' | 'advisor_busy' | 'advisor_closed' | 'booked' | 'past';

export interface MatchSlot {
  key: string;
  dateKey: string;
  start: number;
  end: number;
  timeLabel: string;
  status: SlotStatus;
  reason?: string;
  bookedBy?: string;
  requestId?: string; // the appointment request a booked time belongs to
}

export interface MatchDay {
  dateKey: string;
  date: Date;
  weekdayLong: string;
  weekdayShort: string;
  dateLabel: string;
  slots: MatchSlot[];
}

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fmtTime(min: number): string {
  const h = Math.floor(min / 60);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(min % 60)} ${h < 12 ? 'AM' : 'PM'}`;
}

function slotKeyOf(dateKey: string, start: number): string {
  return `${dateKey}T${pad(Math.floor(start / 60))}:${pad(start % 60)}`;
}

export function parseSlotKey(key: string): { date: Date; start: number } {
  const [d, t] = key.split('T');
  const [y, m, day] = d.split('-').map(Number);
  const [hh, mm] = t.split(':').map(Number);
  return { date: new Date(y, m - 1, day), start: hh * 60 + mm };
}

// "Tuesday, Oct 27 · 10:30–11:00 AM"
export function describeSlot(key: string): string {
  const { date, start } = parseSlotKey(key);
  const day = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  return `${day} · ${fmtTime(start)} – ${fmtTime(start + SLOT_MINUTES)}`;
}

// Monday of the week to show. Week 0 is the coming week once Friday afternoon has passed.
export function weekStart(offset: number, now = new Date()): Date {
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dow = base.getDay(); // 0 Sun ... 6 Sat
  const toMonday = dow === 0 ? 1 : dow === 6 ? 2 : 1 - dow;
  base.setDate(base.getDate() + toMonday + offset * 7);
  return base;
}

function overlapping(blocks: Block[], dow: number, start: number, end: number): Block | undefined {
  return blocks.find((b) => b.days.includes(dow) && start < b.end && end > b.start);
}

export function buildWeek(offset: number, state: AdvisingState, now = new Date()): MatchDay[] {
  const monday = weekStart(offset, now);
  const booked = new Map<string, { name: string; id: string }>();
  for (const r of state.requests) {
    if (r.appointment && r.status !== 'denied') booked.set(r.appointment.slotKey, { name: r.student.name, id: r.id });
  }
  const closed = new Set(state.closedSlots);

  return Array.from({ length: 5 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    const dow = i + 1;
    const dateKey = toDateKey(date);
    const slots: MatchSlot[] = [];
    for (let start = DAY_START; start < DAY_END; start += SLOT_MINUTES) {
      const end = start + SLOT_MINUTES;
      const key = slotKeyOf(dateKey, start);
      const slotTime = new Date(date);
      slotTime.setHours(Math.floor(start / 60), start % 60);
      const base = { key, dateKey, start, end, timeLabel: fmtTime(start) };
      const studentClass = overlapping(STUDENT_CLASSES, dow, start, end);
      const commitment = overlapping(ADVISOR_COMMITMENTS, dow, start, end);
      if (slotTime < now) slots.push({ ...base, status: 'past', reason: 'Time has passed' });
      else if (booked.has(key)) {
        const b = booked.get(key)!;
        slots.push({ ...base, status: 'booked', reason: `Booked: ${b.name}`, bookedBy: b.name, requestId: b.id });
      }
      else if (studentClass) slots.push({ ...base, status: 'student_busy', reason: `Student in ${studentClass.label}` });
      else if (commitment) slots.push({ ...base, status: 'advisor_busy', reason: `Advisor: ${commitment.label}` });
      else if (closed.has(key)) slots.push({ ...base, status: 'advisor_closed', reason: 'Advisor marked unavailable' });
      else slots.push({ ...base, status: 'open', reason: 'Both free' });
    }
    return {
      dateKey,
      date,
      weekdayLong: date.toLocaleDateString('en-US', { weekday: 'long' }),
      weekdayShort: date.toLocaleDateString('en-US', { weekday: 'short' }),
      dateLabel: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      slots,
    };
  });
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export interface AdvisingState {
  requests: AdvisingRequest[];
  closedSlots: string[];
}

const STORAGE_KEY = 'buckai.advising.v1';

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3_600_000).toISOString();
}

function ticket(): string {
  return `OSU-ADV-${Math.floor(100000 + Math.random() * 900000)}`;
}

// The first open slot on the given weekday (1-5) of the coming week, for seed bookings.
function seedSlot(dow: number, start: number): string {
  const monday = weekStart(0);
  const d = new Date(monday);
  d.setDate(monday.getDate() + dow - 1);
  return slotKeyOf(toDateKey(d), start);
}

function seedRequests(): AdvisingRequest[] {
  const reviewedAt = hoursAgo(1);
  return [
    {
      id: 'req-seed-1',
      ticketId: 'OSU-ADV-418203',
      category: 'drop_class',
      title: 'Drop MATH 1152 (Calculus 2)',
      studentMessage:
        "I failed the first midterm in Calc 2 and I'm working 20 hours a week. I want to drop it this term and retake it in the spring when my schedule is lighter.",
      details: { course: 'MATH 1152', credits: 5 },
      student: {
        name: 'Maya Patel',
        email: 'patel.412@osu.edu',
        osuId: '#05512984',
        rank: 'Sophomore (Year 2)',
        major: 'Finance (BSBA)',
        gpa: 3.12,
        earnedCredits: 41,
        enrolledCredits: 15,
        holds: [],
      },
      submittedAt: hoursAgo(3),
      status: 'pending_advisor',
      aiReview: {
        verdict: 'needs_attention',
        confidence: 'high',
        summary:
          'Maya wants to drop MATH 1152 after a failed first midterm and a 20 hr/week job. Dropping takes her from 15 to 10 credit hours, below full-time status.',
        situation:
          'Maya is a sophomore Finance major who failed the first Calculus 2 midterm. She also works about 20 hours a week, which leaves little time for a 5-credit math course, and she is worried that finishing the class will pull her 3.12 GPA down. She is taking 15 credits this term, so dropping MATH 1152 would leave her with 10. Her plan is to retake Calculus 2 in the spring when her work schedule is lighter. She has not mentioned trying tutoring or office hours yet.',
        reasonForAppointment: 'Decide whether to drop Calculus 2 now or stay enrolled with academic support.',
        studentNeeds: [
          'A decision on dropping MATH 1152 before the withdrawal deadline',
          'Guidance on keeping full-time status and financial aid',
          'A plan to retake Calculus 2 without delaying BUSFIN 3220',
        ],
        riskFlags: [
          'Drops to 10 credit hours: below 12-hour full-time minimum (financial aid risk)',
          'Past the 4th-Friday deadline: a "W" will appear on the transcript',
        ],
        checks: [
          { label: 'Student is your advisee', passed: true, detail: 'Assigned to Sarah Jenkins in the Fisher advising roster.' },
          { label: 'Course is on current schedule', passed: true, detail: 'MATH 1152, 5 credits, Autumn 2026.' },
          { label: 'Stays full-time (12+ credits)', passed: false, detail: '15 − 5 = 10 credit hours after the drop.' },
          { label: 'Within no-"W" drop window', passed: false, detail: 'Autumn 2026 4th Friday has passed; a W grade will be recorded.' },
        ],
        suggestedAgenda: [
          'Review financial-aid impact with Student Financial Aid before approving',
          'Consider adding a 2-credit GE to stay at 12 hours',
          'Refer to MSLC math tutoring if she stays enrolled',
        ],
        recommendation: 'Meet before approving: the drop is allowed but has financial-aid and transcript consequences.',
        source: 'rules',
        reviewedAt,
      },
    },
    {
      id: 'req-seed-2',
      ticketId: 'OSU-ADV-552190',
      category: 'add_minor',
      title: 'Declare the Computer Science (CSE) minor',
      studentMessage:
        "I've taken CSE 2221 and loved it. I'd like to add the CSE minor so I can take databases and networking before I graduate.",
      details: { minor: 'Computer Science (CSE) Minor' },
      student: {
        name: 'Jordan Lee',
        email: 'lee.3307@osu.edu',
        osuId: '#04471023',
        rank: 'Junior (Year 3)',
        major: 'Information Systems (BSBA)',
        gpa: 3.54,
        earnedCredits: 68,
        enrolledCredits: 14,
        holds: [],
      },
      submittedAt: hoursAgo(20),
      status: 'pending_advisor',
      aiReview: {
        verdict: 'supported',
        confidence: 'high',
        summary:
          'Jordan wants to declare the CSE minor. GPA and completed coursework meet the entry requirements, and the minor fits within the remaining credits.',
        situation:
          'Jordan is a junior in Information Systems who took CSE 2221 as an elective and enjoyed it more than expected (finished with a B+). Jordan wants to add the Computer Science minor to take databases and networking before graduating, with the goal of a more technical role after college. With a 3.54 GPA, 68 credits earned and 14 credits this term, there is room in the remaining terms for the extra courses.',
        reasonForAppointment: 'Confirm the CSE minor plan and file the declaration.',
        studentNeeds: [
          'Official minor declaration filed in SIS',
          'A course sequence for CSE 2231, 2321 and 3241 over three terms',
        ],
        riskFlags: ['No more than 6 credits may overlap with the Information Systems major'],
        checks: [
          { label: 'Student is your advisee', passed: true, detail: 'Assigned to Sarah Jenkins.' },
          { label: 'Minimum 2.50 CPHR', passed: true, detail: 'Cumulative GPA 3.54.' },
          { label: 'Prerequisite completed', passed: true, detail: 'CSE 2221 completed with a B+.' },
          { label: 'Fits before graduation', passed: true, detail: '53 credits remaining; minor adds 9 net new credits.' },
        ],
        suggestedAgenda: ['Confirm overlap credits with the IS major', 'Map CSE courses to Spring 2027 – Autumn 2027'],
        recommendation: 'Approve: all entry requirements are met. Confirm the overlap limit when filing.',
        source: 'rules',
        reviewedAt,
      },
    },
    {
      id: 'req-seed-3',
      ticketId: 'OSU-ADV-603377',
      category: 'hold_clearance',
      title: 'Clear Registration Lock (2nd-year plan review)',
      studentMessage:
        "I have a registration lock and Spring registration opens soon. I've drafted my 4-year plan and want to review it so the hold can be lifted.",
      student: {
        name: 'Aaliyah Brooks',
        email: 'brooks.981@osu.edu',
        osuId: '#05290417',
        rank: 'Sophomore (Year 2)',
        major: 'Accounting (BSBA)',
        gpa: 3.81,
        earnedCredits: 46,
        enrolledCredits: 16,
        holds: ['Registration Lock (2nd-Year Advising Plan Milestone Check)'],
      },
      submittedAt: hoursAgo(26),
      status: 'pending_advisor',
      appointment: { slotKey: seedSlot(4, 13 * 60 + 30), format: 'In-Person' },
      aiReview: {
        verdict: 'supported',
        confidence: 'high',
        summary:
          'Aaliyah needs her 2nd-year plan review to lift a Registration Lock before Spring 2027 registration. Her draft 4-year plan is complete and on track.',
        situation:
          'Aaliyah is a sophomore Accounting major with a strong 3.81 GPA, taking 16 credits this term. She has a Registration Lock on her account and her Spring 2027 enrollment window opens soon, so she is anxious about losing seats in the classes she wants. She has already drafted a complete 4-year plan in BuckAI and booked a Thursday afternoon meeting to go over it so the hold can come off.',
        reasonForAppointment: 'Required 2nd-year plan review to lift the Registration Lock.',
        studentNeeds: ['Registration Lock lifted before her enrollment window', 'Feedback on her draft 4-year plan'],
        riskFlags: ['Enrollment window opens soon: delaying the review could cost seats'],
        checks: [
          { label: 'Student is your advisee', passed: true, detail: 'Assigned to Sarah Jenkins.' },
          { label: 'Hold on record', passed: true, detail: 'Registration Lock (2nd-Year Advising Plan Milestone Check).' },
          { label: 'Draft plan submitted', passed: true, detail: '4-year plan uploaded through BuckAI.' },
        ],
        suggestedAgenda: ['Walk through the Spring 2027 cart', 'Confirm graduation term', 'Lift the hold in SIS at the end of the meeting'],
        recommendation: 'Approve the appointment and lift the hold after the plan review.',
        source: 'rules',
        reviewedAt,
      },
    },
    {
      id: 'req-seed-4',
      ticketId: 'OSU-ADV-377841',
      category: 'change_major',
      title: 'Change major from Marketing to Finance',
      studentMessage: "After my internship I realized I want to go into corporate finance, so I'd like to switch from Marketing to Finance.",
      student: {
        name: 'Chris Nguyen',
        email: 'nguyen.1840@osu.edu',
        osuId: '#04918266',
        rank: 'Sophomore (Year 2)',
        major: 'Marketing (BSBA)',
        gpa: 3.33,
        earnedCredits: 52,
        enrolledCredits: 15,
        holds: [],
      },
      submittedAt: hoursAgo(70),
      status: 'approved',
      decision: {
        by: ADVISOR.name,
        note: 'Approved. Filed the major change in SIS; first Finance core course is BUSFIN 3220 in Spring 2027.',
        at: hoursAgo(48),
      },
      aiReview: {
        verdict: 'supported',
        confidence: 'high',
        summary: 'Chris wants to switch from Marketing to Finance. Both are Fisher BSBA majors with shared core courses, so graduation timing is unchanged.',
        situation:
          'Chris is a sophomore Marketing major (3.33 GPA, 52 credits) who completed a summer internship and came away wanting to work in corporate finance. Chris asked to switch from Marketing to Finance and has already finished most of the shared business core.',
        reasonForAppointment: 'Switch majors within Fisher.',
        studentNeeds: ['Major change filed in SIS', 'Updated 4-year plan for Finance'],
        riskFlags: [],
        checks: [
          { label: 'Student is your advisee', passed: true, detail: 'Assigned to Sarah Jenkins.' },
          { label: 'Same college (Fisher)', passed: true, detail: 'No inter-college transfer needed.' },
          { label: 'Graduation term unchanged', passed: true, detail: 'Shared business core already complete.' },
        ],
        suggestedAgenda: ['File the major change', 'Update the 4-year plan'],
        recommendation: 'Approve: no graduation delay.',
        source: 'rules',
        reviewedAt: hoursAgo(69),
      },
    },
    ...moreSeedRequests(),
  ];
}

// A fuller caseload so the Advisor Center looks like a real advisor's week.
function stu(
  name: string,
  email: string,
  osuId: string,
  rank: string,
  major: string,
  gpa: number,
  earnedCredits: number,
  enrolledCredits: number,
  holds: string[] = [],
): RequestStudent {
  return { name, email, osuId, rank, major, gpa, earnedCredits, enrolledCredits, holds };
}

function review(r: Omit<AiReview, 'source' | 'reviewedAt' | 'confidence'> & { confidence?: AiReview['confidence'] }, reviewedHoursAgo = 1): AiReview {
  return { confidence: 'high', source: 'rules', reviewedAt: hoursAgo(reviewedHoursAgo), ...r };
}

const ADVISEE_CHECK: AiCheck = { label: 'Student is your advisee', passed: true, detail: 'Assigned to Sarah Jenkins.' };

function moreSeedRequests(): AdvisingRequest[] {
  return [
    {
      id: 'req-seed-5',
      ticketId: 'OSU-ADV-710245',
      category: 'appointment',
      title: 'Plan a Spring 2027 co-op around required courses',
      studentMessage:
        'I got a co-op offer with Cardinal Health for Spring 2027. Can we figure out which core classes I can push to summer so I still graduate on time?',
      student: stu('Ethan Carter', 'carter.1209@osu.edu', '#05133870', 'Junior (Year 3)', 'Operations Management (BSBA)', 3.47, 71, 15),
      submittedAt: hoursAgo(2),
      status: 'pending_advisor',
      appointment: { slotKey: seedSlot(2, 13 * 60 + 30), format: 'In-Person' },
      aiReview: review({
        verdict: 'supported',
        summary: 'Ethan has a Spring 2027 co-op offer and wants to rearrange core courses so his graduation term stays the same.',
        situation:
          'Ethan is a junior in Operations Management (3.47 GPA, 71 credits) who just received a full-time Spring 2027 co-op offer from Cardinal Health. He is excited about the offer but worried it will push back his graduation, since several of his remaining core courses are normally taken in the spring. He wants to work out which classes can move to summer so he can accept the co-op and still graduate on schedule.',
        reasonForAppointment: 'Rebuild the 4-year plan around a full-time Spring 2027 co-op.',
        studentNeeds: ['Which Spring 2027 core courses can move to Summer 2027', 'Co-op enrollment (BUSADM 4191) for full-time status', 'Confirm graduation stays Spring 2028'],
        riskFlags: ['BUSMGT 4250 is only offered in spring: check the substitute or alternate year'],
        checks: [
          ADVISEE_CHECK,
          { label: 'Eligible for co-op credit', passed: true, detail: 'Junior standing with GPA above 2.50.' },
          { label: 'Requested time is mutually free', passed: true, detail: 'Matched against class schedule and advisor calendar.' },
        ],
        suggestedAgenda: ['Move BUSMGT 3230 and one GE to summer', 'Register for BUSADM 4191 co-op credit', 'Confirm graduation audit'],
        recommendation: 'Approve the appointment.',
      }),
    },
    {
      id: 'req-seed-6',
      ticketId: 'OSU-ADV-724918',
      category: 'withdraw',
      title: 'Medical withdrawal from Autumn 2026',
      studentMessage:
        "I had surgery in October and can't finish the semester. My doctor gave me a note. What do I need to do to withdraw from all my classes?",
      student: stu('Sofia Ramirez', 'ramirez.377@osu.edu', '#05601245', 'Sophomore (Year 2)', 'Marketing (BSBA)', 3.21, 44, 15),
      submittedAt: hoursAgo(5),
      status: 'pending_advisor',
      aiReview: review({
        verdict: 'needs_attention',
        summary: 'Sofia needs to withdraw from all Autumn 2026 courses after surgery and has medical documentation.',
        situation:
          'Sofia is a sophomore Marketing major (3.21 GPA) who had surgery in October and has missed too much class to finish the semester. She is enrolled in 15 credits and has a note from her doctor. She does not know what steps to take to withdraw, and she is hoping to come back and continue in Spring 2027 once she has recovered.',
        reasonForAppointment: 'Start a full-term medical withdrawal.',
        studentNeeds: ['Medical withdrawal filed with the Registrar', 'Information on tuition refunds and financial aid', 'A plan to return in Spring 2027'],
        riskFlags: ['Financial aid may need to be returned (federal Return of Title IV rules)', 'Housing and meal plan contracts are separate'],
        checks: [
          ADVISEE_CHECK,
          { label: 'Documentation provided', passed: true, detail: 'Physician note mentioned; verify with Student Advocacy.' },
          { label: 'Financial aid impact reviewed', passed: false, detail: 'Refer to Student Financial Aid before filing.' },
        ],
        suggestedAgenda: ['Refer to Student Advocacy Center', 'Connect with Student Financial Aid', 'Plan Spring 2027 return courses'],
        recommendation: 'Meet first: route through Student Advocacy and Financial Aid before filing.',
      }),
    },
    {
      id: 'req-seed-7',
      ticketId: 'OSU-ADV-731562',
      category: 'hold_clearance',
      title: 'Academic probation advising hold',
      studentMessage:
        'I have an advising hold because I am on probation. I want to get my GPA back up and register for spring. Can we meet?',
      student: stu('Liam O’Brien', 'obrien.212@osu.edu', '#05077319', 'Sophomore (Year 2)', 'Business (Pre-major)', 1.92, 38, 13, [
        'Academic Probation Advising Hold',
      ]),
      submittedAt: hoursAgo(7),
      status: 'pending_advisor',
      appointment: { slotKey: seedSlot(3, 9 * 60), format: 'Zoom' },
      aiReview: review({
        verdict: 'needs_attention',
        summary: 'Liam is on academic probation (GPA 1.92) and needs an advising meeting to lift his hold and register for spring.',
        situation:
          'Liam is a sophomore pre-business student on academic probation with a 1.92 GPA, taking 13 credits this term. An advising hold is blocking his Spring 2027 registration. He says he wants to get his GPA back up and is reaching out on his own, but he has not said what made this term or last term difficult. He has booked a Wednesday morning Zoom meeting.',
        reasonForAppointment: 'Required probation meeting and an academic success plan.',
        studentNeeds: ['Advising hold lifted for Spring 2027 registration', 'An academic success plan to raise his GPA above 2.00', 'Tutoring and support resources'],
        riskFlags: ['GPA below 2.00: at risk of academic dismissal if it doesn’t improve', 'Spring course load should stay light (12–13 credits)'],
        checks: [
          ADVISEE_CHECK,
          { label: 'Hold on record', passed: true, detail: 'Academic Probation Advising Hold.' },
          { label: 'GPA at or above 2.00', passed: false, detail: 'Cumulative GPA 1.92.' },
        ],
        suggestedAgenda: ['Review what went wrong this term', 'Build a 12–13 credit spring schedule', 'Refer to Dennis Learning Center coaching'],
        recommendation: 'Approve the appointment; lift the hold only after a success plan is agreed.',
      }),
    },
    {
      id: 'req-seed-8',
      ticketId: 'OSU-ADV-745003',
      category: 'add_minor',
      title: 'Declare the Economics minor',
      studentMessage: "I've already taken ECON 2001 and 2002 and really liked them. I'd like to add the Economics minor.",
      details: { minor: 'Economics Minor' },
      student: stu('Priya Shah', 'shah.988@osu.edu', '#05415562', 'Sophomore (Year 2)', 'Finance (BSBA)', 3.74, 47, 16),
      submittedAt: hoursAgo(9),
      status: 'pending_advisor',
      aiReview: review({
        verdict: 'supported',
        summary: 'Priya wants to declare the Economics minor. She has the intro courses done and a strong GPA.',
        situation:
          'Priya is a sophomore Finance major with a 3.74 GPA who has already taken ECON 2001 and 2002 and really enjoyed them. She wants to declare the Economics minor now so she can plan her upper-level ECON courses alongside her Finance core starting in the spring.',
        reasonForAppointment: 'File the Economics minor.',
        studentNeeds: ['Minor declaration filed', 'Which 3000-level ECON courses to take next'],
        riskFlags: ['ECON 2001/2002 also count toward the Finance major: watch the 6-credit overlap limit'],
        checks: [
          ADVISEE_CHECK,
          { label: 'Minimum 2.50 CPHR', passed: true, detail: 'Cumulative GPA 3.74.' },
          { label: 'Overlap with major (max 6 credits)', passed: true, detail: '6 credits overlap: at the limit.' },
        ],
        suggestedAgenda: ['Confirm overlap credits', 'Pick ECON 4001.01 for Spring 2027'],
        recommendation: 'Approve: requirements are met.',
      }),
    },
    {
      id: 'req-seed-9',
      ticketId: 'OSU-ADV-752871',
      category: 'drop_class',
      title: 'Drop CSE 2221 (Software I)',
      studentMessage: "I'm taking 17 credits and CSE 2221 is taking all my time. I'd rather drop it and take it in the summer.",
      details: { course: 'CSE 2221', credits: 4 },
      student: stu('Marcus Johnson', 'johnson.4471@osu.edu', '#05248813', 'Sophomore (Year 2)', 'Information Systems (BSBA)', 3.05, 49, 17),
      submittedAt: hoursAgo(12),
      status: 'pending_advisor',
      aiReview: review({
        verdict: 'needs_attention',
        summary: 'Marcus wants to drop CSE 2221 from a 17-credit load and retake it in the summer. He stays full-time at 13 credits.',
        situation:
          'Marcus is a sophomore in Information Systems (3.05 GPA) carrying 17 credits this term. CSE 2221 is taking up most of his time and his other classes are starting to slip. He would rather drop it now and retake it in the summer when he can focus on it. Dropping would leave him at 13 credits.',
        reasonForAppointment: 'Approve a course drop to lighten a heavy term.',
        studentNeeds: ['Approval to drop CSE 2221', 'Confirmation that summer CSE 2221 keeps his IS sequence on track'],
        riskFlags: ['Past the 4th-Friday deadline: a "W" will appear on the transcript'],
        checks: [
          ADVISEE_CHECK,
          { label: 'Stays full-time (12+ credits)', passed: true, detail: '17 − 4 = 13 credit hours after the drop.' },
          { label: 'Within no-"W" drop window', passed: false, detail: 'Autumn 2026 4th Friday has passed; a W grade will be recorded.' },
        ],
        suggestedAgenda: ['Confirm he accepts the W', 'Check summer CSE 2221 availability'],
        recommendation: 'Approve if he accepts the W notation.',
      }),
    },
    {
      id: 'req-seed-10',
      ticketId: 'OSU-ADV-768340',
      category: 'change_major',
      title: 'Change major from Finance to Accounting',
      studentMessage: 'I want to sit for the CPA exam, so I think Accounting is a better fit than Finance.',
      student: stu('Hannah Kim', 'kim.6120@osu.edu', '#05522906', 'Junior (Year 3)', 'Finance (BSBA)', 3.58, 64, 15),
      submittedAt: hoursAgo(30),
      status: 'needs_info',
      decision: {
        by: ADVISOR.name,
        note: 'Happy to help! Please upload a draft 4-year plan for Accounting so we can check whether you need a 5th year for CPA hours.',
        at: hoursAgo(26),
      },
      aiReview: review(
        {
          verdict: 'needs_attention',
          summary: 'Hannah wants to switch from Finance to Accounting to prepare for the CPA exam. CPA licensure needs 150 credit hours.',
          situation:
            'Hannah is a junior Finance major (3.58 GPA, 64 credits) who has decided she wants to sit for the CPA exam, so she thinks Accounting is a better fit. She is unsure how many of her Finance courses will still count and whether switching this late means an extra term. You asked her for a draft Accounting plan and are waiting on it.',
          reasonForAppointment: 'Switch majors within Fisher for CPA eligibility.',
          studentNeeds: ['Major change filed', 'A plan to reach 150 hours (e.g. MAcc program)'],
          riskFlags: ['May need an extra term or the MAcc program to reach 150 credit hours'],
          checks: [
            ADVISEE_CHECK,
            { label: 'Same college (Fisher)', passed: true, detail: 'No inter-college transfer needed.' },
            { label: 'Graduation term unchanged', passed: false, detail: 'Verify ACCTMIS sequence timing in the degree audit.' },
          ],
          suggestedAgenda: ['Review ACCTMIS sequence', 'Discuss the MAcc path'],
          recommendation: 'Ask for a draft plan before approving.',
        },
        29,
      ),
    },
    {
      id: 'req-seed-11',
      ticketId: 'OSU-ADV-779214',
      category: 'appointment',
      title: 'Study abroad in Barcelona (Spring 2027)',
      studentMessage: "I'm applying to the Fisher Barcelona program for spring. I need to know which classes will transfer back.",
      student: stu('Noah Williams', 'williams.5532@osu.edu', '#05389027', 'Sophomore (Year 2)', 'Marketing (BSBA)', 3.39, 46, 15),
      submittedAt: hoursAgo(14),
      status: 'pending_advisor',
      appointment: { slotKey: seedSlot(5, 10 * 60), format: 'Zoom' },
      aiReview: review({
        verdict: 'supported',
        summary: 'Noah is applying to study abroad in Barcelona for Spring 2027 and needs a course-equivalency plan.',
        situation:
          'Noah is a sophomore Marketing major (3.39 GPA) applying to the Fisher Barcelona study-abroad program for Spring 2027. Before committing, he wants to know which Barcelona courses will transfer back and count toward his major so the semester abroad does not set him back. He booked a Friday morning Zoom meeting.',
        reasonForAppointment: 'Plan study-abroad courses that count toward the Marketing major.',
        studentNeeds: ['Course equivalencies for the Barcelona program', 'A study-abroad advising form signed'],
        riskFlags: [],
        checks: [
          ADVISEE_CHECK,
          { label: 'GPA meets program minimum (3.00)', passed: true, detail: 'Cumulative GPA 3.39.' },
          { label: 'Requested time is mutually free', passed: true, detail: 'Matched against class schedule and advisor calendar.' },
        ],
        suggestedAgenda: ['Map Barcelona courses to BUSML electives', 'Sign the study-abroad advising form'],
        recommendation: 'Approve the appointment.',
      }),
    },
    {
      id: 'req-seed-12',
      ticketId: 'OSU-ADV-781106',
      category: 'hold_clearance',
      title: 'Clear Registration Lock (2nd-year plan review)',
      studentMessage: 'I finished my 4-year plan in BuckAI. Can you review it so my registration lock comes off?',
      student: stu('Olivia Chen', 'chen.3349@osu.edu', '#05467712', 'Sophomore (Year 2)', 'Accounting (BSBA)', 3.66, 45, 15),
      submittedAt: hoursAgo(40),
      status: 'approved',
      decision: { by: ADVISOR.name, note: 'Plan looks great. Hold lifted in SIS: you can register when your window opens.', at: hoursAgo(30) },
      aiReview: review(
        {
          verdict: 'supported',
          summary: 'Olivia completed her 2nd-year plan and needs the Registration Lock lifted.',
          situation:
            'Olivia is a sophomore Accounting major (3.66 GPA) with a Registration Lock. She finished her 4-year plan in BuckAI and asked for a review so the hold could be lifted before her enrollment window.',
          reasonForAppointment: 'Required 2nd-year plan review.',
          studentNeeds: ['Registration Lock lifted'],
          riskFlags: [],
          checks: [ADVISEE_CHECK, { label: 'Draft plan submitted', passed: true, detail: '4-year plan uploaded through BuckAI.' }],
          suggestedAgenda: ['Review the plan', 'Lift the hold'],
          recommendation: 'Approve.',
        },
        39,
      ),
    },
    {
      id: 'req-seed-13',
      ticketId: 'OSU-ADV-790433',
      category: 'add_minor',
      title: 'Declare the Computer Science (CSE) minor',
      studentMessage: "I want to add the CSE minor because I'm interested in tech jobs after graduation.",
      details: { minor: 'Computer Science (CSE) Minor' },
      student: stu('Daniel Okafor', 'okafor.88@osu.edu', '#05710054', 'Sophomore (Year 2)', 'Finance (BSBA)', 2.31, 42, 15),
      submittedAt: hoursAgo(18),
      status: 'pending_advisor',
      aiReview: review({
        verdict: 'not_supported',
        summary: 'Daniel wants to declare the CSE minor, but his GPA (2.31) is below the 2.50 minimum.',
        situation:
          'Daniel is a sophomore Finance major with a 2.31 GPA who wants to add the Computer Science minor because he is interested in tech jobs after graduation. He has not taken CSE 2221 yet. His interest is career-driven, and he may not realize his current GPA is a barrier to declaring right now.',
        reasonForAppointment: 'Discuss the CSE minor and what he needs to qualify.',
        studentNeeds: ['Clear GPA target to become eligible', 'Alternatives such as the Business Analytics minor'],
        riskFlags: ['Below 2.50 CPHR minimum for the minor'],
        checks: [
          ADVISEE_CHECK,
          { label: 'Minimum 2.50 CPHR', passed: false, detail: 'Cumulative GPA 2.31.' },
          { label: 'Prerequisite completed', passed: false, detail: 'CSE 2221 not yet taken.' },
        ],
        suggestedAgenda: ['Explain the GPA requirement', 'Suggest taking CSE 2221 first', 'Revisit after Spring 2027 grades'],
        recommendation: 'Deny for now, or defer until the GPA reaches 2.50.',
      }),
    },
    {
      id: 'req-seed-14',
      ticketId: 'OSU-ADV-803671',
      category: 'drop_class',
      title: 'Drop MATH 1151 (Calculus I)',
      studentMessage: "I'm a first-year and Calc 1 is really hard for me. I want to drop it and take MATH 1148 instead next semester.",
      details: { course: 'MATH 1151', credits: 5 },
      student: stu('Grace Thompson', 'thompson.2905@osu.edu', '#05802217', 'First-year (Year 1)', 'Business (Pre-major)', 2.88, 0, 14),
      submittedAt: hoursAgo(1),
      status: 'pending_advisor',
      aiReview: review({
        verdict: 'needs_attention',
        summary: 'Grace, a first-year, wants to drop MATH 1151. That leaves 9 credit hours, below full-time.',
        situation:
          'Grace is a first-year pre-business student in her first semester at Ohio State, taking 14 credits. Calculus I has been much harder than she expected and she is feeling overwhelmed. She wants to drop MATH 1151 and take MATH 1148 next semester instead. Dropping would leave her with 9 credits this term. As a first-year she may also live on campus and rely on aid tied to her enrollment.',
        reasonForAppointment: 'Decide whether to drop Calculus I or stay with support.',
        studentNeeds: ['Decision on dropping MATH 1151', 'Guidance on staying full-time', 'Whether MATH 1148/1149 meets Fisher requirements'],
        riskFlags: ['Drops to 9 credit hours: below full-time (financial aid and housing risk)', 'A "W" will appear on the transcript'],
        checks: [
          ADVISEE_CHECK,
          { label: 'Stays full-time (12+ credits)', passed: false, detail: '14 − 5 = 9 credit hours after the drop.' },
          { label: 'Within no-"W" drop window', passed: false, detail: 'Autumn 2026 4th Friday has passed.' },
        ],
        suggestedAgenda: ['Consider MSLC tutoring before dropping', 'Check the MATH 1148 path for Fisher', 'Review financial aid impact'],
        recommendation: 'Meet before approving: the drop puts her below full-time.',
      }),
    },
    {
      id: 'req-seed-15',
      ticketId: 'OSU-ADV-811290',
      category: 'drop_class',
      title: 'Drop ACCTMIS 2300 after the withdrawal deadline',
      studentMessage: 'I know it is late but I want to drop Accounting 2. I am failing and it will hurt my GPA.',
      details: { course: 'ACCTMIS 2300', credits: 3 },
      student: stu('Jacob Miller', 'miller.7764@osu.edu', '#05190348', 'Sophomore (Year 2)', 'Finance (BSBA)', 2.64, 48, 15),
      submittedAt: hoursAgo(52),
      status: 'denied',
      decision: {
        by: ADVISOR.name,
        note: 'The last day to withdraw has passed, so I can’t approve a drop here. You can petition the Fisher Academic Standards Committee; I’ll help with the petition.',
        at: hoursAgo(20),
      },
      aiReview: review(
        {
          verdict: 'not_supported',
          summary: 'Jacob wants to drop ACCTMIS 2300, but the last day to withdraw has passed.',
          situation:
            'Jacob is a sophomore Finance major (2.64 GPA) who is failing ACCTMIS 2300 and is worried the grade will drag his GPA down further. He knows it is past the withdrawal deadline but asked anyway. You denied the drop and offered to help him petition.',
          reasonForAppointment: 'Late course drop.',
          studentNeeds: ['A way to avoid a failing grade', 'Information on the petition process'],
          riskFlags: ['Past the withdrawal deadline: only a petition can remove the course'],
          checks: [ADVISEE_CHECK, { label: 'Before withdrawal deadline', passed: false, detail: 'Autumn 2026 withdrawal deadline has passed.' }],
          suggestedAgenda: ['Explain the petition process', 'Plan an ACCTMIS 2300 retake'],
          recommendation: 'Deny the drop; refer to the petition process.',
        },
        51,
      ),
    },
    {
      id: 'req-seed-16',
      ticketId: 'OSU-ADV-820557',
      category: 'appointment',
      title: 'Graduation check for Spring 2027',
      studentMessage: "I'm planning to graduate in May. Can we go through my degree audit to make sure I'm not missing anything?",
      student: stu('Isabella Rossi', 'rossi.145@osu.edu', '#04822961', 'Senior (Year 4)', 'Finance (BSBA)', 3.52, 109, 15),
      submittedAt: hoursAgo(22),
      status: 'pending_advisor',
      appointment: { slotKey: seedSlot(4, 14 * 60), format: 'In-Person' },
      aiReview: review({
        verdict: 'supported',
        summary: 'Isabella plans to graduate in Spring 2027 and wants a final degree-audit review.',
        situation:
          'Isabella is a senior Finance major (3.52 GPA) with 109 credits earned and 15 in progress, planning to graduate in May 2027. She wants to go through her degree audit with you before she applies to graduate, to make sure nothing is missing. She booked an in-person meeting on Thursday afternoon.',
        reasonForAppointment: 'Graduation check before applying to graduate.',
        studentNeeds: ['Confirmation all requirements are on track', 'Help applying for graduation'],
        riskFlags: ['Graduation application deadline is the 2nd Friday of spring term'],
        checks: [
          ADVISEE_CHECK,
          { label: 'Credits on track (121 required)', passed: true, detail: '109 earned + 15 in progress = 124.' },
          { label: 'Requested time is mutually free', passed: true, detail: 'Matched against class schedule and advisor calendar.' },
        ],
        suggestedAgenda: ['Run the degree audit together', 'Confirm Spring 2027 schedule', 'Submit the graduation application'],
        recommendation: 'Approve the appointment.',
      }),
    },
  ];
}

function load(): AdvisingState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AdvisingState;
      if (Array.isArray(parsed.requests)) {
        // Add sample requests introduced since this browser first saved data, and fill in
        // newer AI-review fields (like `situation`) on saved samples, keeping decisions.
        const seeds = seedRequests();
        const seedById = new Map(seeds.map((r) => [r.id, r]));
        const have = new Set(parsed.requests.map((r) => r.id));
        const requests = parsed.requests.map((r) => {
          const seed = seedById.get(r.id);
          if (!seed?.aiReview || !r.aiReview || r.aiReview.situation) return r;
          return { ...r, aiReview: { ...r.aiReview, situation: seed.aiReview.situation } };
        });
        const added = seeds.filter((r) => !have.has(r.id));
        return { requests: [...requests, ...added], closedSlots: parsed.closedSlots ?? [] };
      }
    }
  } catch {
    // Storage unavailable (private window etc.): fall through to fresh sample data.
  }
  return { requests: seedRequests(), closedSlots: [] };
}

let state: AdvisingState = load();
const listeners = new Set<() => void>();

function setState(next: AdvisingState) {
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Keep working in memory if storage is blocked.
  }
  listeners.forEach((l) => l());
}

// Keep a second tab (e.g. student in one, advisor in another) in sync.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      state = load();
      listeners.forEach((l) => l());
    }
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getState(): AdvisingState {
  return state;
}

export function useAdvisingState(): AdvisingState {
  return useSyncExternalStore(subscribe, getState);
}

function updateRequest(id: string, patch: Partial<AdvisingRequest>) {
  setState({ ...state, requests: state.requests.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
}

export function resetAdvisingData() {
  setState({ requests: seedRequests(), closedSlots: [] });
}

export function toggleAdvisorSlot(key: string) {
  const closed = new Set(state.closedSlots);
  if (closed.has(key)) closed.delete(key);
  else closed.add(key);
  setState({ ...state, closedSlots: [...closed] });
}

// Advisor-initiated scheduling: get the student in as soon as both calendars allow.
// Aim for within 3 days; never book further out than a week.
export const SCHEDULE_TARGET_DAYS = 3;
export const SCHEDULE_MAX_DAYS = 7;
const SCHEDULE_LEAD_MINUTES = 60; // don't book a slot that starts in under an hour
const DAY_MS = 86_400_000;

function slotStart(key: string): Date {
  const { date, start } = parseSlotKey(key);
  const d = new Date(date);
  d.setHours(Math.floor(start / 60), start % 60, 0, 0);
  return d;
}

// The earliest time that is free for both the student and the advisor within the next week.
export function findEarliestMutualSlot(s: AdvisingState = state, now = new Date()): MatchSlot | null {
  const earliest = now.getTime() + SCHEDULE_LEAD_MINUTES * 60_000;
  const latest = now.getTime() + SCHEDULE_MAX_DAYS * DAY_MS;
  for (let week = 0; week < 3; week++) {
    for (const day of buildWeek(week, s, now)) {
      for (const slot of day.slots) {
        if (slot.status !== 'open') continue;
        const t = slotStart(slot.key).getTime();
        if (t > latest) return null;
        if (t >= earliest) return slot;
      }
    }
  }
  return null;
}

export interface ScheduleResult {
  slotKey: string;
  daysAway: number;
  withinTarget: boolean;
  keptStudentChoice: boolean;
}

// Book the meeting: keep the time the student already picked if it is within a week,
// otherwise take the earliest mutual opening. Returns null if nothing is free this week.
export function scheduleAppointment(id: string, by: string, note: string): ScheduleResult | null {
  const request = state.requests.find((r) => r.id === id);
  if (!request) return null;
  const now = new Date();
  let slotKey: string | null = null;
  let keptStudentChoice = false;
  if (request.appointment) {
    const t = slotStart(request.appointment.slotKey).getTime();
    if (t > now.getTime() && t <= now.getTime() + SCHEDULE_MAX_DAYS * DAY_MS) {
      slotKey = request.appointment.slotKey;
      keptStudentChoice = true;
    }
  }
  if (!slotKey) slotKey = findEarliestMutualSlot(state, now)?.key ?? null;
  if (!slotKey) return null;

  const daysAway = (slotStart(slotKey).getTime() - now.getTime()) / DAY_MS;
  updateRequest(id, {
    status: 'scheduled',
    appointment: { slotKey, format: request.appointment?.format ?? 'In-Person' },
    decision: { by, note: note || `Let’s meet ${describeSlot(slotKey)} to work through this together.`, at: now.toISOString() },
  });
  return { slotKey, daysAway, withinTarget: daysAway <= SCHEDULE_TARGET_DAYS, keptStudentChoice };
}

export function decideRequest(id: string, status: 'approved' | 'denied', note: string, by: string) {
  updateRequest(id, { status, decision: { by, note, at: new Date().toISOString() } });
}

// Step 1 of the double check: the AI reviews the request before an advisor sees it.
async function runAiReview(request: AdvisingRequest) {
  try {
    const res = await fetch('/api/advisor-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request }),
    });
    if (!res.ok) throw new Error(`Server status ${res.status}`);
    const review = (await res.json()) as AiReview;
    updateRequest(request.id, { aiReview: review, status: 'pending_advisor' });
  } catch (err) {
    console.warn('AI review unavailable, sending straight to advisor:', err);
    updateRequest(request.id, {
      status: 'pending_advisor',
      aiReview: {
        verdict: 'needs_attention',
        confidence: 'uncertain',
        summary: `${request.student.name} submitted: ${request.title}. The AI check could not run, so please review the request directly.`,
        reasonForAppointment: request.title,
        studentNeeds: [request.title],
        riskFlags: ['AI verification unavailable'],
        checks: [],
        suggestedAgenda: [],
        recommendation: 'Review manually.',
        source: 'rules',
        reviewedAt: new Date().toISOString(),
      },
    });
  }
}

// The signed-in student as they appear on a request.
export function studentFromProfile(p: StudentProfile): RequestStudent {
  return {
    name: p.name,
    email: p.nameDotNum,
    osuId: p.osuId,
    rank: p.rank,
    major: p.major,
    gpa: p.gpa,
    earnedCredits: p.earnedCredits,
    enrolledCredits: 15,
    holds: p.holds,
  };
}

// Convert a matcher slot into the older AdvisorSlot shape the student flow passes around.
export function toAdvisorSlot(slot: MatchSlot): AdvisorSlot {
  const { date } = parseSlotKey(slot.key);
  return {
    id: slot.key,
    day: date.toLocaleDateString('en-US', { weekday: 'long' }),
    date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: `${fmtTime(slot.start)} - ${fmtTime(slot.end)}`,
    advisorAvailable: true,
    studentFree: true,
    mutualMatch: true,
    formatOptions: ['In-Person', 'Zoom Virtual', 'Phone'],
  };
}

export interface NewRequestInput {
  category: RequestCategory;
  title: string;
  studentMessage: string;
  details?: AdvisingRequest['details'];
  student: RequestStudent;
  appointment?: RequestAppointment;
}

export function submitRequest(input: NewRequestInput): AdvisingRequest {
  const request: AdvisingRequest = {
    ...input,
    id: `req-${Date.now()}`,
    ticketId: ticket(),
    submittedAt: new Date().toISOString(),
    status: 'ai_review',
    aiReview: null,
  };
  setState({ ...state, requests: [request, ...state.requests] });
  void runAiReview(request);
  return request;
}

export function relativeTime(iso: string, now = Date.now()): string {
  const mins = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
