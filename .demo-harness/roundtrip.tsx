// Local-only check of the advisor -> student round trip, no sign-in and nothing sent to Supabase.
// An advisor (Sarah Jenkins) opens Maya's appointment request in the real Advisor Center and acts on it;
// "Switch to Maya" swaps the fake session to the student and shows the real AdvisorDecisionNotice,
// reading the same in-memory request the advisor just changed.
// ?case=kept   Maya picked a time 2 days out on Sarah's calendar -> Schedule keeps it ("Appointment confirmed")
// ?case=moved  Maya picked a time 3 weeks out -> Schedule books the earliest mutual time instead
// Served at /.demo-harness/roundtrip.html by the demo-harness / advisor-harness launch configs.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';
import { supabase } from '../src/lib/supabase';

const ME = 'a0000000-0000-0000-0000-000000000001';
const STUDENT_EMAIL = 'thompson.1234@osu.edu';
const hours = { '1': [[540, 1020]], '2': [[540, 1020]], '3': [[540, 1020]], '4': [[540, 1020]], '5': [[540, 1020]] };
const pad = (n: number) => String(n).padStart(2, '0');
const weekdayFromNow = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T10:00`;
};
const moved = new URLSearchParams(location.search).get('case') === 'moved';

const db: Record<string, any[]> = {
  advisors: [{ id: ME, email: 'jenkins.892@osu.edu', full_name: 'Sarah Jenkins, M.Ed.', title: 'Senior Academic Advisor', office: 'Mason Hall 120', aliases: [], weekly_hours: hours }],
  advising_requests: [{
    id: 'r0000001-0000-0000-0000-000000000000', ticket_id: 'OSU-ADV-430731', category: 'appointment', title: 'Talk through dropping BUSFIN 4210',
    student_message: 'Can we meet about dropping BUSFIN 4210?', details: null,
    student: { name: 'Maya Thompson', email: STUDENT_EMAIL, osuId: '500807805', rank: 'Junior', major: 'Finance', gpa: 3.42, earnedCredits: 75, enrolledCredits: 15, holds: [] },
    status: 'pending_advisor',
    ai_review: { verdict: 'supported', confidence: 'high', source: 'claude', reviewedAt: new Date().toISOString(), summary: 'Maya wants to talk through a drop.', reasonForAppointment: 'Drop BUSFIN 4210', studentNeeds: [], riskFlags: [], checks: [], suggestedAgenda: [], recommendation: 'Meet with her.' },
    appointment: { slotKey: weekdayFromNow(moved ? 21 : 2), format: 'Zoom' }, decision: null,
    submitted_at: new Date(Date.now() - 3_600_000).toISOString(), advisor_id: ME, handled_by: null, meeting_advisor_id: ME,
  }],
  advisor_closed_slots: [], advisor_days_off: [], advisor_busy_blocks: [], advisor_calendars: [],
};

let sessionEmail = 'jenkins.892@osu.edu';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const real = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(String(input instanceof Request ? input.url : input), location.href);
  const method = (init?.method || 'GET').toUpperCase();
  const rpc = url.pathname.match(/\/rest\/v1\/rpc\/(\w+)/)?.[1];
  const advisor = sessionEmail !== STUDENT_EMAIL;
  if (rpc === 'current_advisor_id') return json(advisor ? ME : null);
  if (rpc === 'my_advisor_id') return json(advisor ? null : ME);
  if (rpc === 'booked_slot_keys') return json([]);
  const table = url.pathname.match(/\/rest\/v1\/(\w+)/)?.[1];
  if (!table || !(table in db)) return real(input as any, init);
  const filters = [...url.searchParams].filter(([k, v]) => /^eq\./.test(v) && k !== 'select' && k !== 'order');
  const match = (row: any) => filters.every(([k, v]) => String(row[k]) === v.slice(3));
  if (method === 'GET') return json(db[table].filter(match));
  if (method === 'PATCH') {
    const body = JSON.parse(String(init?.body ?? '{}'));
    db[table] = db[table].map((r) => (match(r) ? { ...r, ...body, ...(table === 'advising_requests' ? { handled_by: ME } : {}) } : r));
    return json(db[table].filter(match));
  }
  return json([]);
};
(supabase.auth as any).getSession = async () => ({
  data: { session: { access_token: 'harness', user: { id: 'u1', email: sessionEmail } } },
  error: null,
});

const { AdvisorView } = await import('../src/components/AdvisorView');
const { AdvisorDecisionNotice } = await import('../src/components/AdvisorDecisionNotice');
const { refreshAdvisingData } = await import('../src/lib/advising');
try { localStorage.removeItem('buckai.seenAdvisorDecisions'); } catch {}

function RoundTrip() {
  const [as, setAs] = useState<'advisor' | 'student'>('advisor');
  const [viewed, setViewed] = useState(false);
  return (
    <div>
      <div className="bg-[#2c2c2a] text-white text-xs px-4 py-1.5 flex items-center justify-between">
        <span>Round-trip harness · signed in as {as === 'advisor' ? 'Sarah Jenkins (advisor)' : 'Maya Thompson (student)'} · case: {moved ? 'moved' : 'kept'}</span>
        <button
          type="button"
          data-testid="switch"
          className="underline"
          onClick={async () => {
            sessionEmail = as === 'advisor' ? STUDENT_EMAIL : 'jenkins.892@osu.edu';
            await refreshAdvisingData();
            setAs(as === 'advisor' ? 'student' : 'advisor');
          }}
        >
          Switch to {as === 'advisor' ? 'Maya' : 'Sarah'}
        </button>
      </div>
      {as === 'advisor' ? (
        <AdvisorView email="jenkins.892@osu.edu" />
      ) : (
        <div className="p-8 text-sm text-gray-700">
          <p>Maya’s BuckeyeLink (any page). The notice below is the real component mounted in App.tsx.</p>
          {viewed && <p data-testid="viewed" className="mt-2 font-semibold">“View details” opened Advisor Scheduling.</p>}
          <AdvisorDecisionNotice studentEmail={STUDENT_EMAIL} onView={() => setViewed(true)} />
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<RoundTrip />);
