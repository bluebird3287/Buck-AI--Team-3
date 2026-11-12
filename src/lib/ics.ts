// Reads busy times out of an iCalendar (.ics) feed, the format both Google Calendar ("Secret address in
// iCal format") and Outlook ("Publish a calendar" -> ICS link) share, and what both export as a file.
// Used by the server (feed links) and the browser (uploaded files). Only start and end times are kept;
// event titles, attendees, and descriptions are dropped so students never see them.
//
// Handles: TZID times (IANA and common Windows zone names), UTC and floating times, all-day events,
// RRULE (DAILY/WEEKLY/MONTHLY with INTERVAL, BYDAY, UNTIL, COUNT), EXDATE, moved instances
// (RECURRENCE-ID), and skips free/cancelled/transparent events.

export interface BusyBlock {
  start: Date;
  end: Date;
}

const DEFAULT_TZ = 'America/New_York';

// Outlook writes Windows zone names.
const WINDOWS_TZ: Record<string, string> = {
  'Eastern Standard Time': 'America/New_York',
  'US Eastern Standard Time': 'America/Indianapolis',
  'Central Standard Time': 'America/Chicago',
  'Mountain Standard Time': 'America/Denver',
  'US Mountain Standard Time': 'America/Phoenix',
  'Pacific Standard Time': 'America/Los_Angeles',
  'Alaskan Standard Time': 'America/Anchorage',
  'Hawaiian Standard Time': 'Pacific/Honolulu',
  'GMT Standard Time': 'Europe/London',
  UTC: 'UTC',
};

function resolveTz(tzid: string | undefined): string {
  if (!tzid) return DEFAULT_TZ;
  const clean = tzid.replace(/^"|"$/g, '').replace(/^\/[^/]+\/[^/]+\//, ''); // strip "/mozilla.org/20050126_1/"
  if (WINDOWS_TZ[clean]) return WINDOWS_TZ[clean];
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: clean });
    return clean;
  } catch {
    return DEFAULT_TZ;
  }
}

// Offset (ms) of a time zone at a given UTC instant.
function tzOffset(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - utcMs;
}

// Wall-clock time in a zone -> the real instant.
function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string): Date {
  const guess = Date.UTC(y, mo, d, h, mi, s);
  let t = guess - tzOffset(guess, tz);
  t = guess - tzOffset(t, tz); // second pass settles DST edges
  return new Date(t);
}

interface Prop {
  value: string;
  params: Record<string, string>;
}

interface ParsedTime {
  date: Date;
  allDay: boolean;
  tz: string; // zone the wall-clock time is in, used to repeat it at the same local time
  wall: { y: number; mo: number; d: number; h: number; mi: number; s: number };
}

function parseTime(p: Prop | undefined, fallbackTz: string): ParsedTime | null {
  if (!p) return null;
  const m = p.value.trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, Y, Mo, D, H, Mi, S, Z] = m;
  const wall = { y: +Y, mo: +Mo - 1, d: +D, h: H ? +H : 0, mi: Mi ? +Mi : 0, s: S ? +S : 0 };
  const allDay = p.params.VALUE === 'DATE' || !H;
  if (Z) return { date: new Date(Date.UTC(wall.y, wall.mo, wall.d, wall.h, wall.mi, wall.s)), allDay, tz: 'UTC', wall };
  const tz = p.params.TZID ? resolveTz(p.params.TZID) : fallbackTz;
  return { date: zonedToUtc(wall.y, wall.mo, wall.d, wall.h, wall.mi, wall.s, tz), allDay, tz, wall };
}

function unfold(text: string): string[] {
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}

function parseLine(line: string): { name: string; prop: Prop } | null {
  const colon = line.search(/:(?=(?:[^"]*"[^"]*")*[^"]*$)/);
  if (colon < 0) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const [name, ...paramParts] = head.split(';');
  const params: Record<string, string> = {};
  for (const part of paramParts) {
    const eq = part.indexOf('=');
    if (eq > 0) params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
  }
  return { name: name.toUpperCase(), prop: { value, params } };
}

type VEvent = Record<string, Prop[]>;

const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function addDaysWall(w: ParsedTime['wall'], days: number): ParsedTime['wall'] {
  const d = new Date(Date.UTC(w.y, w.mo, w.d + days));
  return { ...w, y: d.getUTCFullYear(), mo: d.getUTCMonth(), d: d.getUTCDate() };
}

function wallToDate(w: ParsedTime['wall'], tz: string, allDay: boolean): Date {
  if (tz === 'UTC') return new Date(Date.UTC(w.y, w.mo, w.d, w.h, w.mi, w.s));
  return zonedToUtc(w.y, w.mo, w.d, allDay ? 0 : w.h, allDay ? 0 : w.mi, allDay ? 0 : w.s, tz);
}

// Every start of a recurring event inside [from, to).
function expandRule(start: ParsedTime, rule: string, from: Date, to: Date, fallbackTz: string): Date[] {
  const r: Record<string, string> = {};
  for (const kv of rule.split(';')) {
    const [k, v] = kv.split('=');
    if (k && v) r[k.toUpperCase()] = v;
  }
  const freq = r.FREQ;
  const interval = Math.max(1, Number(r.INTERVAL) || 1);
  const count = r.COUNT ? Number(r.COUNT) : Infinity;
  const until = r.UNTIL ? parseTime({ value: r.UNTIL, params: {} }, fallbackTz)?.date ?? null : null;
  const byDay = r.BYDAY ? r.BYDAY.split(',').map((d) => DAY_CODES.indexOf(d.replace(/^[+-]?\d+/, ''))).filter((d) => d >= 0) : [];
  const out: Date[] = [];
  let produced = 0;
  const push = (w: ParsedTime['wall']) => {
    const d = wallToDate(w, start.tz, start.allDay);
    if (d < start.date) return true;
    if (until && d > until) return false;
    if (produced >= count) return false;
    produced++;
    if (d >= to) return false;
    if (d >= from) out.push(d);
    return true;
  };
  const MAX_STEPS = 3000;
  if (freq === 'DAILY') {
    for (let i = 0; i < MAX_STEPS; i++) if (!push(addDaysWall(start.wall, i * interval))) break;
  } else if (freq === 'WEEKLY') {
    const startDow = new Date(Date.UTC(start.wall.y, start.wall.mo, start.wall.d)).getUTCDay();
    const days = byDay.length ? [...byDay].sort((a, b) => a - b) : [startDow];
    // Week anchored on Sunday of the start's week
    outer: for (let wk = 0; wk < MAX_STEPS; wk++) {
      for (const dow of days) {
        const offset = wk * 7 * interval + (dow - startDow);
        if (offset < 0) continue;
        if (!push(addDaysWall(start.wall, offset))) break outer;
      }
    }
  } else if (freq === 'MONTHLY') {
    for (let i = 0; i < 240; i++) {
      const d = new Date(Date.UTC(start.wall.y, start.wall.mo + i * interval, start.wall.d));
      if (d.getUTCDate() !== start.wall.d) continue; // e.g. the 31st in a short month
      if (!push({ ...start.wall, y: d.getUTCFullYear(), mo: d.getUTCMonth(), d: d.getUTCDate() })) break;
    }
  } else {
    // YEARLY or unknown: just the first instance
    push(start.wall);
  }
  return out;
}

function isFree(ev: VEvent): boolean {
  const transp = ev.TRANSP?.[0]?.value.trim().toUpperCase();
  const status = ev.STATUS?.[0]?.value.trim().toUpperCase();
  const ms = ev['X-MICROSOFT-CDO-BUSYSTATUS']?.[0]?.value.trim().toUpperCase();
  return transp === 'TRANSPARENT' || status === 'CANCELLED' || ms === 'FREE';
}

/** Busy times in [from, to) from an .ics file's text. */
export function busyBlocksFromIcs(text: string, from: Date, to: Date): BusyBlock[] {
  if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error('That isn’t a calendar (.ics) file.');
  const lines = unfold(text);
  const calTzLine = lines.find((l) => /^X-WR-TIMEZONE:/i.test(l));
  const calTz = resolveTz(calTzLine?.split(':')[1]?.trim());

  const events: VEvent[] = [];
  let cur: VEvent | null = null;
  let depth = 0; // skip VALARM etc. nested inside VEVENT
  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper === 'BEGIN:VEVENT') {
      cur = {};
      depth = 0;
      continue;
    }
    if (!cur) continue;
    if (upper.startsWith('BEGIN:')) depth++;
    else if (upper.startsWith('END:') && depth > 0) depth--;
    else if (upper === 'END:VEVENT') {
      events.push(cur);
      cur = null;
    } else if (depth === 0) {
      const parsed = parseLine(line);
      if (parsed) (cur[parsed.name] ??= []).push(parsed.prop);
    }
  }

  // Moved or cancelled single instances of a recurring event, by UID
  const overrides = new Map<string, Set<number>>();
  for (const ev of events) {
    const rid = parseTime(ev['RECURRENCE-ID']?.[0], calTz);
    const uid = ev.UID?.[0]?.value;
    if (rid && uid) {
      if (!overrides.has(uid)) overrides.set(uid, new Set());
      overrides.get(uid)!.add(rid.date.getTime());
    }
  }

  const out: BusyBlock[] = [];
  for (const ev of events) {
    const start = parseTime(ev.DTSTART?.[0], calTz);
    if (!start) continue;
    const end = parseTime(ev.DTEND?.[0], calTz);
    let durationMs: number;
    if (end) durationMs = end.date.getTime() - start.date.getTime();
    else if (ev.DURATION?.[0]) {
      const m = ev.DURATION[0].value.match(/P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?/);
      durationMs = m ? ((+(m[1] ?? 0) * 7 + +(m[2] ?? 0)) * 86400 + +(m[3] ?? 0) * 3600 + +(m[4] ?? 0) * 60 + +(m[5] ?? 0)) * 1000 : 0;
    } else durationMs = start.allDay ? 86_400_000 : 0;
    if (durationMs <= 0 || isFree(ev)) continue;

    const rule = ev.RRULE?.[0]?.value;
    const isOverride = !!ev['RECURRENCE-ID'];
    let starts: Date[];
    if (rule && !isOverride) {
      const exdates = new Set<number>();
      for (const ex of ev.EXDATE ?? []) {
        for (const v of ex.value.split(',')) {
          const t = parseTime({ value: v, params: ex.params }, start.tz === 'UTC' ? calTz : start.tz);
          if (t) exdates.add(t.date.getTime());
        }
      }
      const moved = overrides.get(ev.UID?.[0]?.value ?? '') ?? new Set<number>();
      // Look back far enough to catch an instance that started before `from` but runs into it
      starts = expandRule(start, rule, new Date(from.getTime() - durationMs), to, calTz).filter(
        (d) => !exdates.has(d.getTime()) && !moved.has(d.getTime()),
      );
    } else {
      starts = [start.date];
    }
    for (const s of starts) {
      const e = new Date(s.getTime() + durationMs);
      if (e <= from || s >= to) continue;
      out.push({ start: s, end: e });
    }
  }
  out.sort((a, b) => a.start.getTime() - b.start.getTime());
  return out;
}

// Feed links: webcal:// is the same as https://. Only the two calendar services are allowed so the
// server can't be pointed at arbitrary addresses.
const ALLOWED_FEED_HOSTS = [
  /^calendar\.google\.com$/,
  /^outlook\.office365\.com$/,
  /^outlook\.office\.com$/,
  /^outlook\.live\.com$/,
  /^[a-z0-9-]+\.calendar\.live\.com$/,
];

export function normalizeFeedUrl(raw: string): { url: string; provider: 'google' | 'outlook' } | null {
  let u: URL;
  try {
    u = new URL(raw.trim().replace(/^webcals?:\/\//i, 'https://'));
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) return null;
  const host = u.hostname.toLowerCase();
  if (!ALLOWED_FEED_HOSTS.some((re) => re.test(host))) return null;
  return { url: u.toString(), provider: host.includes('google') ? 'google' : 'outlook' };
}

// How far ahead busy times are imported.
export const IMPORT_WEEKS = 8;
