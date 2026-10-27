import { useEffect, useSyncExternalStore } from 'react';
import { supabase } from './supabase';
import type { AdvisorSlot, StudentProfile } from '../data/sampleData';

// Shared advising data for both sides of the app: student requests that the AI checks
// first and an advisor approves last, plus the availability both parties schedule from.
// Stored in Supabase (advising_requests, advisor_closed_slots) with row-level security:
// students see only their own requests; advisors see and act on all of them.

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
  for (const key of state.bookedSlots) if (!booked.has(key)) booked.set(key, { name: 'another student', id: '' });
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
  bookedSlots: string[]; // every booked time, without who booked it (students can't see others' requests)
  loaded: boolean;
}

function ticket(): string {
  return `OSU-ADV-${Math.floor(100000 + Math.random() * 900000)}`;
}

// ---------------------------------------------------------------------------
// Store (Supabase)
// ---------------------------------------------------------------------------

interface RequestRow {
  id: string;
  ticket_id: string;
  category: RequestCategory;
  title: string;
  student_message: string;
  details: AdvisingRequest['details'] | null;
  student: RequestStudent;
  status: RequestStatus;
  ai_review: AiReview | null;
  appointment: RequestAppointment | null;
  decision: AdvisingRequest['decision'] | null;
  submitted_at: string;
}

const fromRow = (r: RequestRow): AdvisingRequest => ({
  id: r.id,
  ticketId: r.ticket_id,
  category: r.category,
  title: r.title,
  studentMessage: r.student_message,
  details: r.details ?? undefined,
  student: r.student,
  submittedAt: r.submitted_at,
  status: r.status,
  aiReview: r.ai_review,
  appointment: r.appointment ?? undefined,
  decision: r.decision ?? undefined,
});

let state: AdvisingState = { requests: [], closedSlots: [], bookedSlots: [], loaded: false };
const listeners = new Set<() => void>();

function setState(next: AdvisingState) {
  state = next;
  listeners.forEach((l) => l());
}

// Reload requests and calendar data the signed-in user is allowed to see.
export async function refreshAdvisingData() {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    setState({ requests: [], closedSlots: [], bookedSlots: [], loaded: true });
    return;
  }
  const [requests, closed, booked] = await Promise.all([
    supabase.from('advising_requests').select('*').order('submitted_at', { ascending: false }),
    supabase.from('advisor_closed_slots').select('slot_key'),
    supabase.rpc('booked_slot_keys'),
  ]);
  if (requests.error || closed.error || booked.error) {
    console.warn('Could not load advising data:', requests.error || closed.error || booked.error);
    setState({ ...state, loaded: true });
    return;
  }
  setState({
    requests: (requests.data as RequestRow[]).map(fromRow),
    closedSlots: (closed.data ?? []).map((r: { slot_key: string }) => r.slot_key),
    bookedSlots: ((booked.data as string[] | null) ?? []).filter(Boolean),
    loaded: true,
  });
}

if (typeof window !== 'undefined') {
  void refreshAdvisingData();
  supabase.auth.onAuthStateChange(() => void refreshAdvisingData());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getState(): AdvisingState {
  return state;
}

export function useAdvisingState(): AdvisingState {
  useEffect(() => {
    const id = window.setInterval(() => void refreshAdvisingData(), 20_000);
    return () => window.clearInterval(id);
  }, []);
  return useSyncExternalStore(subscribe, getState);
}

// Save a change locally right away, then in Supabase.
function updateRequest(id: string, patch: Partial<AdvisingRequest>) {
  setState({ ...state, requests: state.requests.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  const row: Partial<RequestRow> & { updated_at: string } = { updated_at: new Date().toISOString() };
  if (patch.status) row.status = patch.status;
  if ('aiReview' in patch) row.ai_review = patch.aiReview ?? null;
  if ('appointment' in patch) row.appointment = patch.appointment ?? null;
  if ('decision' in patch) row.decision = patch.decision ?? null;
  void supabase
    .from('advising_requests')
    .update(row)
    .eq('id', id)
    .then(({ error }) => {
      if (error) console.warn('Could not save request change:', error);
      void refreshAdvisingData();
    });
}

export async function toggleAdvisorSlot(key: string) {
  const closed = new Set(state.closedSlots);
  const reopening = closed.has(key);
  if (reopening) closed.delete(key);
  else closed.add(key);
  setState({ ...state, closedSlots: [...closed] });
  const { error } = reopening
    ? await supabase.from('advisor_closed_slots').delete().eq('slot_key', key)
    : await supabase.from('advisor_closed_slots').insert({ slot_key: key });
  if (error) console.warn('Could not save availability:', error);
  void refreshAdvisingData();
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

export async function submitRequest(input: NewRequestInput): Promise<AdvisingRequest | null> {
  const { data, error } = await supabase
    .from('advising_requests')
    .insert({
      ticket_id: ticket(),
      category: input.category,
      title: input.title,
      student_message: input.studentMessage,
      details: input.details ?? null,
      student: input.student,
      appointment: input.appointment ?? null,
    })
    .select('*')
    .single();
  if (error || !data) {
    console.warn('Could not submit request:', error);
    return null;
  }
  const request = fromRow(data as RequestRow);
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
