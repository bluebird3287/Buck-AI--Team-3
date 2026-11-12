// Local-only harness for the Advisor Center: fake advisors, requests, and availability kept in memory,
// so the queue flags and availability tools can be checked without signing in. Nothing reaches Supabase.
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';
import { supabase } from '../src/lib/supabase';

const ME = 'a0000000-0000-0000-0000-000000000001';
const OTHER = 'a0000000-0000-0000-0000-000000000002';
const hours = { '1': [[540, 1020]], '2': [[540, 1020]], '3': [[540, 1020]], '4': [[540, 1020]], '5': [[540, 1020]] };
const db: Record<string, any[]> = {
  advisors: [
    { id: ME, email: 'tylerrez3@gmail.com', full_name: 'Demo Advisor (Tyler)', title: 'Academic Advisor, Fisher College of Business', office: 'Mason Hall 120', aliases: ['Lindsay McGory'], weekly_hours: hours },
    { id: OTHER, email: 'enzomancini447@gmail.com', full_name: 'Demo Advisor (Enzo)', title: 'Academic Advisor', office: 'Mason Hall 120', aliases: [], weekly_hours: hours },
  ],
  advising_requests: [],
  advisor_closed_slots: [],
  advisor_days_off: [],
  advisor_busy_blocks: [],
  advisor_calendars: [],
};
const student = (name: string, email: string) => ({ name, email, osuId: '', rank: 'Junior', major: 'Finance', gpa: 3.4, earnedCredits: 70, enrolledCredits: 15, holds: [] });
const review = { verdict: 'supported', confidence: 'high', summary: 'Fine.', reasonForAppointment: 'Plan review', studentNeeds: [], riskFlags: [], checks: [], suggestedAgenda: [], recommendation: '', source: 'rules', reviewedAt: new Date().toISOString() };
const req = (i: number, name: string, email: string, advisor: string | null, title: string, category = 'drop_class') => ({
  id: `r000000${i}-0000-0000-0000-000000000000`, ticket_id: `OSU-ADV-10000${i}`, category, title, student_message: title, details: null,
  student: student(name, email), status: 'pending_advisor', ai_review: review, appointment: null, decision: null,
  submitted_at: new Date(Date.now() - i * 3_600_000).toISOString(), advisor_id: advisor, handled_by: null, meeting_advisor_id: null,
});
db.advising_requests = [
  req(1, 'Tyler Rezabek', 'rezabek.14@osu.edu', ME, 'Drop BUSFIN 4210'),
  req(2, 'Enzo Mancini', 'mancini.114@osu.edu', ME, 'Take ACCTMIS 3200 Pass/Non-Pass', 'pass_nonpass'),
  req(3, 'Jordan Lee', 'lee.999@osu.edu', OTHER, 'Declare the Tech Innovation minor', 'add_minor'),
  req(4, 'Priya Shah', 'shah.88@osu.edu', null, 'Withdraw from Autumn 2026', 'withdraw'),
];

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const real = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(String(input instanceof Request ? input.url : input), location.href);
  const method = (init?.method || 'GET').toUpperCase();
  const rpc = url.pathname.match(/\/rest\/v1\/rpc\/(\w+)/)?.[1];
  if (rpc === 'current_advisor_id') return json(ME);
  if (rpc === 'my_advisor_id') return json(null);
  if (rpc === 'booked_slot_keys') return json([]);
  const table = url.pathname.match(/\/rest\/v1\/(\w+)/)?.[1];
  if (url.pathname === '/api/calendar-sync') return json({ error: 'Feeds are fetched by the server; not available in this harness.' }, 422);
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
    const wantsOne = (init?.headers as any)?.Accept === 'application/vnd.pgrst.object+json' || url.searchParams.has('select');
    return json(wantsOne && !Array.isArray(body) ? rows[0] : rows, 201);
  }
  if (method === 'PATCH') {
    db[table] = db[table].map((r) => (match(r) ? { ...r, ...body, ...(table === 'advising_requests' ? { handled_by: ME } : {}) } : r));
    return json(db[table].filter(match));
  }
  return json([]);
};

// A signed-in advisor session without signing in.
(supabase.auth as any).getSession = async () => ({
  data: { session: { access_token: 'harness', user: { id: 'u1', email: 'tylerrez3@gmail.com' } } },
  error: null,
});

const { AdvisorView } = await import('../src/components/AdvisorView');
createRoot(document.getElementById('root')!).render(<AdvisorView email="tylerrez3@gmail.com" />);
