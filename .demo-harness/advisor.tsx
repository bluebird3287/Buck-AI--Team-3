// Local-only harness for the Advisor Center: fictional advisors, students, requests, and availability kept in
// memory, so the queue flags and availability tools can be checked (and captured for the landing-page teaser)
// without signing in. Nothing reaches Supabase; "Connect" on a calendar link imports a made-up busy week.
// Served at /.demo-harness/advisor.html by the demo-harness / advisor-harness launch configs.
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';
import { supabase } from '../src/lib/supabase';

const ME = 'a0000000-0000-0000-0000-000000000001';
const DANA = 'a0000000-0000-0000-0000-000000000002';
const KEVIN = 'a0000000-0000-0000-0000-000000000003';
const hours = { '1': [[540, 1020]], '2': [[540, 1020]], '3': [[540, 720], [780, 1020]], '4': [[540, 1020]], '5': [[540, 720]] };
const db: Record<string, any[]> = {
  advisors: [
    { id: ME, email: 'jenkins.892@osu.edu', full_name: 'Sarah Jenkins, M.Ed.', title: 'Senior Academic Advisor, Fisher College of Business', office: 'Mason Hall 120', aliases: [], weekly_hours: hours },
    { id: DANA, email: 'whitfield.12@osu.edu', full_name: 'Dana Whitfield', title: 'Academic Advisor', office: 'Mason Hall 120', aliases: [], weekly_hours: hours },
    { id: KEVIN, email: 'okafor.7@osu.edu', full_name: 'Kevin Okafor', title: 'Academic Advisor', office: 'Mason Hall 120', aliases: [], weekly_hours: hours },
  ],
  advising_requests: [],
  advisor_closed_slots: [],
  advisor_days_off: [],
  advisor_busy_blocks: [],
  advisor_calendars: [],
};

// ---- fictional students and requests ----
const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const nextWeekday = (dow: number, weeks = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + ((dow - d.getDay() + 7) % 7 || 7) + weeks * 7);
  return d;
};
const student = (name: string, email: string, rank: string, major: string, gpa: number, earned: number, holds: string[] = []) => ({
  name, email, osuId: '500' + Math.floor(100000 + Math.random() * 899999), rank, major, gpa, earnedCredits: earned, enrolledCredits: 15, holds,
});
const review = (o: Partial<Record<string, any>>) => ({
  verdict: 'supported', confidence: 'high', source: 'claude', reviewedAt: new Date().toISOString(),
  summary: o.situation, reasonForAppointment: '', studentNeeds: [], riskFlags: [], checks: [], suggestedAgenda: [], recommendation: '', ...o,
});
let n = 0;
const req = (advisor: string | null, category: string, title: string, s: any, message: string, ai: any, hoursAgo: number, extra: any = {}) => ({
  id: `r${String(++n).padStart(7, '0')}-0000-0000-0000-000000000000`, ticket_id: `OSU-ADV-4${String(30000 + n * 731).slice(0, 5)}`,
  category, title, student_message: message, details: null, student: s, status: 'pending_advisor', ai_review: ai, appointment: null,
  decision: null, submitted_at: new Date(Date.now() - hoursAgo * 3_600_000).toISOString(), advisor_id: advisor, handled_by: null,
  meeting_advisor_id: null, ...extra,
});

db.advising_requests = [
  req(ME, 'drop_class', 'Drop BUSFIN 4210 before Friday’s deadline', student('Maya Thompson', 'thompson.1234@osu.edu', 'Junior', 'Finance', 3.42, 75),
    'Want to drop BUSFIN 4210 before Friday. Will it affect my aid or push back graduation?',
    review({
      verdict: 'needs_attention',
      situation: 'Maya is a Finance junior carrying 15 credits and wants to drop BUSFIN 4210 before Friday’s deadline after a rough first exam. Dropping leaves her at 12 credits, still full-time, but BUSFIN 4210 is a prerequisite for BUSFIN 4221 in her Spring plan and is offered only in autumn, so dropping now likely pushes her Finance core back a year.',
      reasonForAppointment: 'Decide whether to drop BUSFIN 4210 before the Friday deadline',
      studentNeeds: ['Confirm full-time status and aid after the drop', 'Re-sequence the Finance core'],
      riskFlags: ['Deadline Friday', 'Autumn-only prerequisite'],
      checks: [
        { label: 'Stays full-time (12+ credits)', passed: true, detail: '15 → 12 credits' },
        { label: 'Before the drop deadline', passed: true, detail: 'Deadline is Friday' },
        { label: 'No planned class depends on it', passed: false, detail: 'Prerequisite for BUSFIN 4221 (Spring 2027)' },
      ],
      suggestedAgenda: ['Aid impact at 12 credits', 'When to retake BUSFIN 4210', 'Spring 2027 swap for BUSFIN 4221'],
      recommendation: 'Meet before Friday; dropping is allowed but delays the Finance core.',
    }), 2),
  req(ME, 'add_minor', 'Declare the Business Analytics minor', student('Jordan Lee', 'lee.4471@osu.edu', 'Sophomore', 'Marketing', 3.61, 44),
    'I already have two of the courses. Can I finish it without adding a semester?',
    review({
      situation: 'Jordan is a Marketing sophomore who has already completed 6 of the 15 minor credits through Marketing core courses. The remaining 9 credits fit into open elective slots in Autumn 2027 and Spring 2028 without adding a term.',
      checks: [
        { label: 'Not excluded for this major', passed: true, detail: 'Marketing students may take it' },
        { label: 'Fits without adding a term', passed: true, detail: '9 credits in open electives' },
      ],
      recommendation: 'Approve.',
    }), 5),
  req(ME, 'pass_nonpass', 'Take STAT 1450 Pass/Non-Pass', student('Avery Collins', 'collins.902@osu.edu', 'First-year', 'Fisher (pre-major)', 3.18, 16),
    'Struggling in STAT 1450 and want to protect my GPA.',
    review({
      verdict: 'not_supported',
      situation: 'Avery is a first-year Fisher pre-major. STAT 1450 is a Business Foundation course, and Fisher requires a letter grade (C- or better) for it, so Pass/Non-Pass would not count toward the major.',
      checks: [
        { label: 'Course allows Pass/Non-Pass for the major', passed: false, detail: 'Business Foundation needs a letter grade' },
        { label: 'Before the P/NP deadline', passed: true, detail: '9 days left' },
      ],
      recommendation: 'Deny; suggest tutoring and the stats help room instead.',
    }), 9),
  req(DANA, 'overload', 'Take 20 credit hours in Spring', student('Priya Shah', 'shah.618@osu.edu', 'Junior', 'Accounting', 3.88, 70),
    'I want to fit in ACCTMIS 4200 early so I can do the MAcc.',
    review({
      situation: 'Priya, an Accounting junior with a 3.88 GPA, wants 20 credits in Spring to take ACCTMIS 4200 early for the Accelerated BSBA/MAcc. Fisher allows up to 21 credits with a 3.0+ GPA and advisor approval.',
      checks: [
        { label: 'GPA meets the overload minimum', passed: true, detail: '3.88 (needs 3.0)' },
        { label: 'Under the 21-credit cap', passed: true, detail: '20 credits' },
      ],
      recommendation: 'Approve.',
    }), 3),
  req(null, 'transfer_credit', 'Take ECON 2002 at Columbus State this summer', student('Marcus Reed', 'reed.233@osu.edu', 'Junior', 'Operations Management', 3.05, 68),
    'It’s cheaper and I can do it online while I work.',
    review({
      situation: 'Marcus wants to take ECON 2002 at Columbus State this summer. The Transfer Credit Report shows ECON 2202 at Columbus State transfers as ECON 2002.01, so it should count toward the Business Foundation.',
      checks: [{ label: 'Transfers as the OSU course', passed: true, detail: 'Columbus State ECON 2202 → ECON 2002.01' }],
      recommendation: 'Approve; remind him to send the official transcript.',
    }), 6),
  req(KEVIN, 'hold_clearance', 'Clear my advising hold for registration', student('Elena Ruiz', 'ruiz.88@osu.edu', 'Sophomore', 'Finance', 3.3, 41, ['Advising hold (registration)']),
    'My registration window opens Monday.',
    review({
      situation: 'Elena has an advising hold that blocks Spring registration, which opens Monday. Her plan meets requirements; the hold only needs advisor sign-off after a check-in.',
      checks: [{ label: 'Plan meets requirements', passed: true, detail: 'No missing prerequisites' }],
      recommendation: 'Clear after a quick check-in.',
    }), 1),
  // A booked meeting on my calendar, so the week isn't empty
  req(ME, 'appointment', 'Advising appointment', student('Noah Kim', 'kim.1503@osu.edu', 'Senior', 'Finance', 3.5, 102),
    'Graduation check before my last semester.', review({ situation: 'Graduation check before his final semester.' }), 30, {
      status: 'scheduled', appointment: { slotKey: `${dayKey(nextWeekday(2))}T10:00`, format: 'In-Person' }, meeting_advisor_id: ME,
    }),
];

// A typical advisor week, used when a calendar is "connected" here
function sampleBusy(calendarId: string) {
  const blocks: any[] = [];
  const mon = nextWeekday(1);
  for (let w = 0; w < 6; w++) {
    const at = (dow: number, h: number, m: number, mins: number) => {
      const d = new Date(mon);
      d.setDate(mon.getDate() + w * 7 + dow - 1);
      d.setHours(h, m, 0, 0);
      blocks.push({ id: blocks.length + 1, advisor_id: ME, calendar_id: calendarId, starts_at: d.toISOString(), ends_at: new Date(d.getTime() + mins * 60_000).toISOString() });
    };
    at(1, 9, 0, 60); // Fisher advising team meeting
    at(2, 14, 0, 90); // Orientation planning
    at(3, 10, 0, 60); // 1:1 with director
    at(4, 15, 0, 120); // Committee
    at(1, 13, 30, 60);
  }
  return blocks;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const real = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(String(input instanceof Request ? input.url : input), location.href);
  const method = (init?.method || 'GET').toUpperCase();
  const rpc = url.pathname.match(/\/rest\/v1\/rpc\/(\w+)/)?.[1];
  if (rpc === 'current_advisor_id') return json(ME);
  if (rpc === 'my_advisor_id') return json(null);
  if (rpc === 'booked_slot_keys') return json([]);
  if (url.pathname === '/api/calendar-sync') {
    const { calendarId } = JSON.parse(String(init?.body ?? '{}'));
    await new Promise((r) => setTimeout(r, 700));
    db.advisor_busy_blocks = db.advisor_busy_blocks.filter((b) => b.calendar_id !== calendarId).concat(sampleBusy(calendarId));
    db.advisor_calendars = db.advisor_calendars.map((c) => (c.id === calendarId ? { ...c, last_synced_at: new Date().toISOString(), last_error: null } : c));
    return json({ imported: db.advisor_busy_blocks.filter((b) => b.calendar_id === calendarId).length });
  }
  const table = url.pathname.match(/\/rest\/v1\/(\w+)/)?.[1];
  if (!table || !(table in db)) return real(input as any, init);
  const filters = [...url.searchParams].filter(([k, v]) => /^(eq|gte|lt)\./.test(v) && k !== 'select' && k !== 'order');
  const match = (row: any) => filters.every(([k, v]) => (v.startsWith('eq.') ? String(row[k]) === v.slice(3) : true));
  if (method === 'GET') return json(db[table].filter(match));
  if (method === 'DELETE') {
    db[table] = db[table].filter((r) => !match(r));
    return json([]);
  }
  const body = JSON.parse(String(init?.body ?? '{}'));
  if (method === 'POST') {
    const rows = (Array.isArray(body) ? body : [body]).map((r: any) => ({ id: crypto.randomUUID(), advisor_id: ME, created_at: new Date().toISOString(), ...r }));
    db[table].push(...rows);
    return json(url.searchParams.has('select') && !Array.isArray(body) ? rows[0] : rows, 201);
  }
  if (method === 'PATCH') {
    db[table] = db[table].map((r) => (match(r) ? { ...r, ...body, ...(table === 'advising_requests' ? { handled_by: ME } : {}) } : r));
    return json(db[table].filter(match));
  }
  return json([]);
};

// A signed-in advisor session without signing in.
(supabase.auth as any).getSession = async () => ({
  data: { session: { access_token: 'harness', user: { id: 'u1', email: 'jenkins.892@osu.edu' } } },
  error: null,
});

const { AdvisorView } = await import('../src/components/AdvisorView');
createRoot(document.getElementById('root')!).render(<AdvisorView email="jenkins.892@osu.edu" />);
