import { useEffect, useSyncExternalStore } from 'react';
import { supabase } from './supabase';
import type { AdvisorSlot, StudentProfile } from '../data/sampleData';
import { busyBlocksFromIcs, normalizeFeedUrl, IMPORT_WEEKS } from './ics';

// Shared advising data for both sides of the app: student requests that the AI checks
// first and an advisor approves last, plus the availability both parties schedule from.
// Stored in Supabase with row-level security: students see only their own requests. Each request is
// stamped with the student's assigned advisor (from their advising report); every advisor can still see
// and answer any request, and the queue flags whose student it is. Availability is per advisor:
// weekly hours, days off, closed times, and busy times imported from Google/Outlook calendars.

export type RequestCategory =
  | 'appointment'
  | 'hold_clearance'
  | 'drop_class'
  | 'add_minor'
  | 'change_major'
  | 'withdraw'
  | 'pass_nonpass'
  | 'overload'
  | 'transfer_credit';

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
  advisorId: string | null; // the student's assigned advisor (null = not on BuckAI / no report)
  handledBy: string | null; // the advisor who last acted on it
  meetingAdvisorId: string | null; // whose calendar the meeting is on
}

export const CATEGORY_LABELS: Record<RequestCategory, string> = {
  appointment: 'Advising appointment',
  hold_clearance: 'Hold clearance',
  drop_class: 'Drop a class',
  add_minor: 'Declare a minor',
  change_major: 'Change major',
  withdraw: 'Withdraw from term',
  pass_nonpass: 'Pass/Non-Pass option',
  overload: 'Credit overload (19+ hours)',
  transfer_credit: 'Class at another school',
};

// Shown when an advisor's own row hasn't loaded (and as the prototype's advisor).
export const ADVISOR = {
  name: 'Sarah Jenkins, M.Ed.',
  title: 'Senior Academic Advisor, Fisher College of Business',
  email: 'jenkins.892@osu.edu',
  office: 'Mason Hall 120',
};

// ---------------------------------------------------------------------------
// Advisors and their availability
// ---------------------------------------------------------------------------

// Minutes after midnight, keyed '1' (Monday) ... '7' (Sunday).
export type WeeklyHours = Record<string, [number, number][]>;

export const DEFAULT_WEEKLY_HOURS: WeeklyHours = {
  '1': [[540, 1020]],
  '2': [[540, 1020]],
  '3': [[540, 1020]],
  '4': [[540, 1020]],
  '5': [[540, 1020]],
};

export interface Advisor {
  id: string;
  email: string;
  fullName: string;
  title: string;
  office: string;
  aliases: string[];
  weeklyHours: WeeklyHours;
}

export interface AdvisorCalendar {
  id: string;
  provider: 'google' | 'outlook' | 'file';
  label: string;
  hasFeed: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
  busyCount: number;
}

// Whose student a request is, from the signed-in advisor's point of view.
export type Ownership = 'mine' | 'other' | 'unassigned';

export function ownershipOf(r: AdvisingRequest, meId: string | null): Ownership {
  if (!r.advisorId) return 'unassigned';
  return r.advisorId === meId ? 'mine' : 'other';
}

export function advisorById(s: AdvisingState, id: string | null | undefined): Advisor | null {
  return (id && s.advisors.find((a) => a.id === id)) || null;
}

// ---------------------------------------------------------------------------
// Time and availability
// ---------------------------------------------------------------------------

export const SLOT_MINUTES = 30;
const GRID_DEFAULT_START = 9 * 60;
const GRID_DEFAULT_END = 17 * 60;

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

export type SlotStatus =
  | 'open'
  | 'student_busy'
  | 'outside_hours'
  | 'calendar_busy'
  | 'day_off'
  | 'advisor_closed'
  | 'booked'
  | 'past';

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
  dayOff: boolean;
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

function hoursOf(s: AdvisingState, advisorId: string | null): WeeklyHours {
  return advisorById(s, advisorId)?.weeklyHours ?? DEFAULT_WEEKLY_HOURS;
}

export interface WeekOptions {
  // Whose calendar: an advisor's id, or null for students whose advisor isn't on BuckAI yet
  // (any advisor can pick those up, so they book against standard office hours).
  advisorId: string | null;
  // Match against the student's classes (students booking, and advisors scheduling a student).
  includeStudentClasses: boolean;
}

export function buildWeek(offset: number, state: AdvisingState, opts: WeekOptions, now = new Date()): MatchDay[] {
  const { advisorId, includeStudentClasses } = opts;
  const monday = weekStart(offset, now);
  const hours = hoursOf(state, advisorId);

  const booked = new Map<string, { name: string; id: string }>();
  for (const r of state.requests) {
    if (r.appointment && r.status !== 'denied' && (r.meetingAdvisorId ?? null) === advisorId) {
      booked.set(r.appointment.slotKey, { name: r.student.name, id: r.id });
    }
  }
  if (advisorId === state.myAdvisorId) {
    for (const key of state.bookedSlots) if (!booked.has(key)) booked.set(key, { name: 'another student', id: '' });
  }
  const closed = new Set(state.closed.filter((c) => c.advisorId === advisorId).map((c) => c.key));
  const daysOff = new Set(state.daysOff.filter((d) => d.advisorId === advisorId).map((d) => d.day));
  const busy = state.busy.filter((b) => b.advisorId === advisorId);

  // Show weekends only if the advisor keeps weekend hours; stretch the grid to their earliest/latest hour.
  const dayCount = (hours['6']?.length || hours['7']?.length) ? 7 : 5;
  const ranges = Object.values(hours).flat();
  const gridStart = Math.min(GRID_DEFAULT_START, ...ranges.map((r) => r[0]));
  const gridEnd = Math.max(GRID_DEFAULT_END, ...ranges.map((r) => r[1]));

  return Array.from({ length: dayCount }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    const dow = i + 1;
    const dateKey = toDateKey(date);
    const dayOff = daysOff.has(dateKey);
    const dayHours = hours[String(dow)] ?? [];
    const slots: MatchSlot[] = [];
    for (let start = gridStart; start < gridEnd; start += SLOT_MINUTES) {
      const end = start + SLOT_MINUTES;
      const key = slotKeyOf(dateKey, start);
      const slotTime = new Date(date);
      slotTime.setHours(Math.floor(start / 60), start % 60);
      const slotEnd = slotTime.getTime() + SLOT_MINUTES * 60_000;
      const base = { key, dateKey, start, end, timeLabel: fmtTime(start) };
      const inHours = dayHours.some(([s, e]) => start >= s && end <= e);
      const calendarBusy = busy.some((b) => slotTime.getTime() < b.end && slotEnd > b.start);
      const studentClass = includeStudentClasses ? overlapping(STUDENT_CLASSES, dow, start, end) : undefined;
      let slot: MatchSlot;
      if (slotTime < now) slot = { ...base, status: 'past', reason: 'Time has passed' };
      else if (booked.has(key)) {
        const b = booked.get(key)!;
        slot = { ...base, status: 'booked', reason: `Booked: ${b.name}`, bookedBy: b.name, requestId: b.id };
      } else if (dayOff) slot = { ...base, status: 'day_off', reason: 'Advisor is out this day' };
      else if (!inHours) slot = { ...base, status: 'outside_hours', reason: 'Outside advising hours' };
      else if (calendarBusy) slot = { ...base, status: 'calendar_busy', reason: 'Busy on imported calendar' };
      else if (studentClass) slot = { ...base, status: 'student_busy', reason: `Student in ${studentClass.label}` };
      else if (closed.has(key)) slot = { ...base, status: 'advisor_closed', reason: 'Advisor marked unavailable' };
      else slot = { ...base, status: 'open', reason: includeStudentClasses ? 'Both free' : 'Open for students' };
      slots.push(slot);
    }
    return {
      dateKey,
      date,
      weekdayLong: date.toLocaleDateString('en-US', { weekday: 'long' }),
      weekdayShort: date.toLocaleDateString('en-US', { weekday: 'short' }),
      dateLabel: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      dayOff,
      slots,
    };
  });
}

// ---------------------------------------------------------------------------
// Store (Supabase)
// ---------------------------------------------------------------------------

export interface AdvisingState {
  requests: AdvisingRequest[];
  advisors: Advisor[];
  meId: string | null; // the signed-in advisor's row
  myAdvisorId: string | null; // the signed-in student's assigned advisor (from their advising report)
  closed: { advisorId: string; key: string }[];
  daysOff: { advisorId: string; day: string }[];
  busy: { advisorId: string; start: number; end: number }[]; // epoch ms
  bookedSlots: string[]; // the student's advisor's booked times, without who booked them
  calendars: AdvisorCalendar[]; // the signed-in advisor's own imported calendars
  loaded: boolean;
}

function ticket(): string {
  return `OSU-ADV-${Math.floor(100000 + Math.random() * 900000)}`;
}

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
  advisor_id?: string | null;
  handled_by?: string | null;
  meeting_advisor_id?: string | null;
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
  advisorId: r.advisor_id ?? null,
  handledBy: r.handled_by ?? null,
  meetingAdvisorId: r.meeting_advisor_id ?? null,
});

interface AdvisorRow {
  id: string;
  email: string;
  full_name: string;
  title: string;
  office: string;
  aliases: string[] | null;
  weekly_hours: WeeklyHours | null;
}

const advisorFromRow = (r: AdvisorRow): Advisor => ({
  id: r.id,
  email: r.email,
  fullName: r.full_name,
  title: r.title,
  office: r.office,
  aliases: r.aliases ?? [],
  weeklyHours: r.weekly_hours ?? DEFAULT_WEEKLY_HOURS,
});

const EMPTY: AdvisingState = {
  requests: [],
  advisors: [],
  meId: null,
  myAdvisorId: null,
  closed: [],
  daysOff: [],
  busy: [],
  bookedSlots: [],
  calendars: [],
  loaded: false,
};

let state: AdvisingState = EMPTY;
const listeners = new Set<() => void>();

function setState(next: AdvisingState) {
  state = next;
  listeners.forEach((l) => l());
}

// Feeds re-read at most this often in the background (advisors can also press "Sync now").
const AUTO_SYNC_MS = 6 * 3_600_000;
const autoSynced = new Set<string>();

// Reload requests and calendar data the signed-in user is allowed to see.
export async function refreshAdvisingData() {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    setState({ ...EMPTY, loaded: true });
    return;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today.getTime() + 6 * 7 * 86_400_000);
  const [requests, advisors, meId, myAdvisorId, closed, daysOff, busy, calendars] = await Promise.all([
    supabase.from('advising_requests').select('*').order('submitted_at', { ascending: false }),
    supabase.from('advisors').select('id, email, full_name, title, office, aliases, weekly_hours').order('full_name'),
    supabase.rpc('current_advisor_id'),
    supabase.rpc('my_advisor_id'),
    supabase.from('advisor_closed_slots').select('advisor_id, slot_key'),
    supabase.from('advisor_days_off').select('advisor_id, day').gte('day', toDateKey(today)),
    supabase
      .from('advisor_busy_blocks')
      .select('advisor_id, calendar_id, starts_at, ends_at')
      .gte('ends_at', today.toISOString())
      .lt('starts_at', horizon.toISOString())
      .limit(5000),
    supabase.from('advisor_calendars').select('id, provider, label, feed_url, last_synced_at, last_error').order('created_at'),
  ]);
  if (requests.error) {
    console.warn('Could not load advising data:', requests.error);
    setState({ ...state, loaded: true });
    return;
  }
  const extrasError = advisors.error || closed.error || daysOff.error || busy.error || calendars.error;
  if (extrasError) console.warn('Could not load advisor availability:', extrasError);

  const myAdvisor = (myAdvisorId.data as string | null) ?? null;
  const booked = await supabase.rpc('booked_slot_keys', { p_advisor: myAdvisor });
  const busyRows = (busy.data ?? []) as { advisor_id: string; calendar_id: string; starts_at: string; ends_at: string }[];
  const busyByCalendar = new Map<string, number>();
  for (const b of busyRows) busyByCalendar.set(b.calendar_id, (busyByCalendar.get(b.calendar_id) ?? 0) + 1);

  const cals: AdvisorCalendar[] = ((calendars.data ?? []) as {
    id: string;
    provider: AdvisorCalendar['provider'];
    label: string;
    feed_url: string | null;
    last_synced_at: string | null;
    last_error: string | null;
  }[]).map((c) => ({
    id: c.id,
    provider: c.provider,
    label: c.label,
    hasFeed: !!c.feed_url,
    lastSyncedAt: c.last_synced_at,
    lastError: c.last_error,
    busyCount: busyByCalendar.get(c.id) ?? 0,
  }));

  setState({
    requests: (requests.data as RequestRow[]).map(fromRow),
    advisors: ((advisors.data ?? []) as AdvisorRow[]).map(advisorFromRow),
    meId: (meId.data as string | null) ?? null,
    myAdvisorId: myAdvisor,
    closed: ((closed.data ?? []) as { advisor_id: string; slot_key: string }[]).map((r) => ({ advisorId: r.advisor_id, key: r.slot_key })),
    daysOff: ((daysOff.data ?? []) as { advisor_id: string; day: string }[]).map((r) => ({ advisorId: r.advisor_id, day: r.day })),
    busy: busyRows.map((b) => ({ advisorId: b.advisor_id, start: Date.parse(b.starts_at), end: Date.parse(b.ends_at) })),
    bookedSlots: booked.error ? [] : ((booked.data as string[] | null) ?? []).filter(Boolean),
    calendars: cals,
    loaded: true,
  });

  // Keep feeds fresh without the advisor having to remember.
  for (const c of cals) {
    const stale = !c.lastSyncedAt || Date.now() - Date.parse(c.lastSyncedAt) > AUTO_SYNC_MS;
    if (c.hasFeed && stale && !autoSynced.has(c.id)) {
      autoSynced.add(c.id);
      void syncCalendar(c.id);
    }
  }
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

// ---------------------------------------------------------------------------
// Advisor availability edits (each advisor changes only their own; RLS enforces it)
// ---------------------------------------------------------------------------

export async function toggleAdvisorSlot(key: string) {
  const me = state.meId;
  if (!me) return;
  const reopening = state.closed.some((c) => c.advisorId === me && c.key === key);
  setState({
    ...state,
    closed: reopening ? state.closed.filter((c) => !(c.advisorId === me && c.key === key)) : [...state.closed, { advisorId: me, key }],
  });
  const { error } = reopening
    ? await supabase.from('advisor_closed_slots').delete().eq('advisor_id', me).eq('slot_key', key)
    : await supabase.from('advisor_closed_slots').insert({ slot_key: key });
  if (error) console.warn('Could not save availability:', error);
  void refreshAdvisingData();
}

export async function toggleDayOff(day: string): Promise<boolean> {
  const me = state.meId;
  if (!me) return false;
  const removing = state.daysOff.some((d) => d.advisorId === me && d.day === day);
  setState({
    ...state,
    daysOff: removing ? state.daysOff.filter((d) => !(d.advisorId === me && d.day === day)) : [...state.daysOff, { advisorId: me, day }],
  });
  const { error } = removing
    ? await supabase.from('advisor_days_off').delete().eq('advisor_id', me).eq('day', day)
    : await supabase.from('advisor_days_off').insert({ day });
  if (error) console.warn('Could not save day off:', error);
  void refreshAdvisingData();
  return !error;
}

export async function saveWeeklyHours(hours: WeeklyHours): Promise<boolean> {
  const me = state.meId;
  if (!me) return false;
  setState({ ...state, advisors: state.advisors.map((a) => (a.id === me ? { ...a, weeklyHours: hours } : a)) });
  const { error } = await supabase.from('advisors').update({ weekly_hours: hours }).eq('id', me);
  if (error) console.warn('Could not save weekly hours:', error);
  void refreshAdvisingData();
  return !error;
}

// Pull a Google/Outlook feed now (the server fetches it as the signed-in advisor).
export async function syncCalendar(id: string): Promise<{ imported?: number; error?: string }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { error: 'Sign in again.' };
  try {
    const res = await fetch('/api/calendar-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ calendarId: id }),
    });
    const body = await res.json().catch(() => ({}));
    void refreshAdvisingData();
    return res.ok ? { imported: body.imported ?? 0 } : { error: body.error || 'Could not read that calendar.' };
  } catch {
    return { error: 'Could not reach BuckAI. Check your connection and try again.' };
  }
}

export async function addCalendarFeed(rawUrl: string, label: string): Promise<{ imported?: number; error?: string }> {
  const feed = normalizeFeedUrl(rawUrl);
  if (!feed) {
    return { error: 'Paste the secret iCal address from Google Calendar or the ICS link from Outlook (it ends in .ics).' };
  }
  const { data, error } = await supabase
    .from('advisor_calendars')
    .insert({ provider: feed.provider, label: label.trim() || (feed.provider === 'google' ? 'Google Calendar' : 'Outlook Calendar'), feed_url: feed.url })
    .select('id')
    .single();
  if (error || !data) return { error: 'Could not save that calendar. Try again.' };
  const result = await syncCalendar(data.id);
  return result;
}

// An exported .ics file: read in the browser, only busy times are saved.
export async function importCalendarFile(
  file: File,
  provider: 'google' | 'outlook' | 'file',
): Promise<{ imported?: number; error?: string }> {
  if (file.size > 5 * 1024 * 1024) return { error: 'That file is larger than 5 MB.' };
  let blocks;
  try {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    blocks = busyBlocksFromIcs(await file.text(), from, new Date(from.getTime() + IMPORT_WEEKS * 7 * 86_400_000));
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not read that file.' };
  }
  const label = file.name.replace(/\.ics$/i, '') || 'Uploaded calendar';
  const { data, error } = await supabase
    .from('advisor_calendars')
    .insert({ provider, label: label.slice(0, 120), last_synced_at: new Date().toISOString() })
    .select('id, advisor_id')
    .single();
  if (error || !data) return { error: 'Could not save that calendar. Try again.' };
  for (let i = 0; i < blocks.length; i += 500) {
    const rows = blocks.slice(i, i + 500).map((b) => ({
      calendar_id: data.id,
      starts_at: b.start.toISOString(),
      ends_at: b.end.toISOString(),
    }));
    const { error: insertError } = await supabase.from('advisor_busy_blocks').insert(rows);
    if (insertError) {
      await supabase.from('advisor_calendars').delete().eq('id', data.id);
      return { error: 'Could not save the busy times from that file.' };
    }
  }
  void refreshAdvisingData();
  return { imported: blocks.length };
}

export async function removeCalendar(id: string) {
  setState({ ...state, calendars: state.calendars.filter((c) => c.id !== id) });
  const { error } = await supabase.from('advisor_calendars').delete().eq('id', id);
  if (error) console.warn('Could not remove calendar:', error);
  void refreshAdvisingData();
}

// ---------------------------------------------------------------------------
// Advisor-initiated scheduling
// ---------------------------------------------------------------------------

// Get the student in as soon as both calendars allow. Aim for within 3 days; never book further out than a week.
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

// The earliest time within the next week that is free for the student and on this advisor's calendar.
export function findEarliestMutualSlot(s: AdvisingState, advisorId: string | null, now = new Date()): MatchSlot | null {
  const earliest = now.getTime() + SCHEDULE_LEAD_MINUTES * 60_000;
  const latest = now.getTime() + SCHEDULE_MAX_DAYS * DAY_MS;
  for (let week = 0; week < 3; week++) {
    for (const day of buildWeek(week, s, { advisorId, includeStudentClasses: true }, now)) {
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

// Book the meeting on the acting advisor's calendar: keep the time the student already picked if it is on
// that calendar and within a week, otherwise take the earliest mutual opening. Null if nothing is free.
export function scheduleAppointment(id: string, by: string, note: string): ScheduleResult | null {
  const request = state.requests.find((r) => r.id === id);
  if (!request) return null;
  const me = state.meId;
  const now = new Date();
  let slotKey: string | null = null;
  let keptStudentChoice = false;
  if (request.appointment && (request.meetingAdvisorId ?? null) === me) {
    const t = slotStart(request.appointment.slotKey).getTime();
    if (t > now.getTime() && t <= now.getTime() + SCHEDULE_MAX_DAYS * DAY_MS) {
      slotKey = request.appointment.slotKey;
      keptStudentChoice = true;
    }
  }
  if (!slotKey) slotKey = findEarliestMutualSlot(state, me, now)?.key ?? null;
  if (!slotKey) return null;

  const daysAway = (slotStart(slotKey).getTime() - now.getTime()) / DAY_MS;
  updateRequest(id, {
    status: 'scheduled',
    meetingAdvisorId: me,
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
