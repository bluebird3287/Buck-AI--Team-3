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

export type RequestStatus = 'ai_review' | 'pending_advisor' | 'needs_info' | 'approved' | 'denied';

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
}

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

// Tyler's Autumn 2026 classes (the prototype student).
export const STUDENT_CLASSES: Block[] = [
  { label: 'ACCTMIS 2300 lecture', days: [1, 3, 5], start: 8 * 60, end: 8 * 60 + 55 },
  { label: 'CSE 2221 lecture', days: [2, 4], start: 9 * 60 + 35, end: 10 * 60 + 55 },
  { label: 'MATH 1152 lecture', days: [1, 3, 5], start: 11 * 60 + 30, end: 12 * 60 + 45 },
  { label: 'BUSMHR 2292 lecture', days: [3], start: 14 * 60 + 15, end: 15 * 60 + 35 },
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
  const booked = new Map<string, string>();
  for (const r of state.requests) {
    if (r.appointment && r.status !== 'denied') booked.set(r.appointment.slotKey, r.student.name);
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
      else if (booked.has(key)) slots.push({ ...base, status: 'booked', reason: `Booked: ${booked.get(key)}`, bookedBy: booked.get(key) });
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
  ];
}

function load(): AdvisingState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AdvisingState;
      if (Array.isArray(parsed.requests)) return { requests: parsed.requests, closedSlots: parsed.closedSlots ?? [] };
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

export function decideRequest(id: string, status: 'approved' | 'denied' | 'needs_info', note: string, by: string) {
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

// The prototype student (Tyler) as he appears on a request.
export function studentFromProfile(p: StudentProfile): RequestStudent {
  return {
    name: p.name === 'Tyler' ? 'Tyler Rez' : p.name,
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
