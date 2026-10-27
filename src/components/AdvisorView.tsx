import React, { useMemo, useRef, useState } from 'react';
import { Inbox, CalendarDays, CalendarClock, Sparkles, AlertTriangle, CheckCircle2, RotateCcw, Users, Search } from 'lucide-react';
import {
  AdvisingRequest,
  ADVISOR,
  CATEGORY_LABELS,
  describeSlot,
  relativeTime,
  resetAdvisingData,
  toggleAdvisorSlot,
  useAdvisingState,
} from '../lib/advising';
import { RequestDialog } from './advisor/RequestDialog';
import { AiVerdictBadge, RequestStatusBadge, initials } from './advisor/AdvisorBadges';
import { ScheduleMatcher } from './scheduling/ScheduleMatcher';

// Advisor Center: where advisors land after signing in. Students' requests arrive here
// after BuckAI has checked them (step 1); the advisor makes the final call (step 2).
// Tabs: Approvals (request queue + AI summary), Appointments (booked meetings with an
// AI pre-meeting brief), Advisor schedule (the shared mutual-availability matcher).

type Tab = 'approvals' | 'appointments' | 'availability';
type Filter = 'pending' | 'scheduled' | 'decided' | 'all';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'approvals', label: 'Approval requests', icon: Inbox },
  { id: 'appointments', label: 'Appointments', icon: CalendarClock },
  { id: 'availability', label: 'Advisor schedule', icon: CalendarDays },
];

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'pending', label: 'Awaiting approval' },
  { id: 'scheduled', label: 'Meeting scheduled' },
  { id: 'decided', label: 'Decided' },
  { id: 'all', label: 'All' },
];

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ba0c2f]';

function matchesFilter(r: AdvisingRequest, f: Filter) {
  if (f === 'all') return true;
  // "Info requested" (from before advisors could schedule) still needs a decision.
  if (f === 'pending') return r.status === 'pending_advisor' || r.status === 'ai_review' || r.status === 'needs_info';
  if (f === 'scheduled') return r.status === 'scheduled';
  return r.status === 'approved' || r.status === 'denied';
}

export const AdvisorView: React.FC<{ email: string }> = ({ email }) => {
  const { requests } = useAdvisingState();
  const [tab, setTab] = useState<Tab>('approvals');
  const [filter, setFilter] = useState<Filter>('pending');
  const [dialogRequestId, setDialogRequestId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ approvals: null, appointments: null, availability: null });

  const pending = requests.filter((r) => matchesFilter(r, 'pending'));
  const flagged = pending.filter((r) => r.aiReview && r.aiReview.verdict !== 'supported');
  const appointments = useMemo(
    () =>
      requests
        .filter((r) => r.appointment && r.status !== 'denied')
        .sort((a, b) => a.appointment!.slotKey.localeCompare(b.appointment!.slotKey)),
    [requests],
  );
  const decidedRecently = requests.filter(
    (r) => r.decision && (r.status === 'approved' || r.status === 'denied') && Date.now() - new Date(r.decision.at).getTime() < 7 * 86_400_000,
  );

  const q = query.trim().toLowerCase();
  const visible = requests
    .filter((r) => matchesFilter(r, filter))
    .filter(
      (r) =>
        !q ||
        [r.student.name, r.student.email, r.title, r.ticketId, CATEGORY_LABELS[r.category]].some((v) => v.toLowerCase().includes(q)),
    )
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  // Every request opens in the same pop-up, wherever it was clicked from.
  const openRequest = (id: string) => setDialogRequestId(id);

  // Arrow keys move between tabs (WAI-ARIA tabs pattern).
  const onTabKey = (e: React.KeyboardEvent, index: number) => {
    let next = index;
    if (e.key === 'ArrowRight') next = (index + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') next = (index - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = TABS.length - 1;
    else return;
    e.preventDefault();
    setTab(TABS[next].id);
    tabRefs.current[TABS[next].id]?.focus();
  };

  const stats = [
    { label: 'Awaiting your approval', value: pending.length, icon: Inbox, tone: 'text-[#ba0c2f]' },
    { label: 'Flagged by AI', value: flagged.length, icon: AlertTriangle, tone: 'text-amber-700' },
    { label: 'Upcoming appointments', value: appointments.length, icon: CalendarClock, tone: 'text-blue-800' },
    { label: 'Decided this week', value: decidedRecently.length, icon: CheckCircle2, tone: 'text-emerald-700' },
  ];

  return (
    <div className="min-h-screen bg-[#f3f4f6] text-gray-900">
      <a
        href="#advisor-main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold"
      >
        Skip to main content
      </a>

      {/* Ohio State header */}
      <header className="bg-white border-b border-gray-200">
        <div className="h-1.5 bg-[#ba0c2f]" />
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#ba0c2f]">The Ohio State University</p>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">BuckeyeLink Advisor Center</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900">{ADVISOR.name}</p>
              <p className="text-xs text-gray-600">
                {ADVISOR.title} · {ADVISOR.office}
              </p>
              <p className="text-xs text-gray-500">Signed in as {email}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#ba0c2f] text-white font-bold flex items-center justify-center" aria-hidden>
              {initials(ADVISOR.name)}
            </div>
          </div>
        </div>
      </header>

      <main id="advisor-main" className="max-w-[1280px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Summary stats */}
        <section aria-label="Caseload summary" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Icon className={`w-4 h-4 ${s.tone}`} aria-hidden /> {s.label}
                </div>
                <p className="mt-1 text-3xl font-bold text-gray-900">{s.value}</p>
              </div>
            );
          })}
        </section>

        {/* Tabs */}
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-gray-300">
          <div role="tablist" aria-label="Advisor tools" className="flex gap-1 overflow-x-auto">
            {TABS.map((t, i) => {
              const Icon = t.icon;
              const active = tab === t.id;
              const count = t.id === 'approvals' ? pending.length : t.id === 'appointments' ? appointments.length : null;
              return (
                <button
                  key={t.id}
                  ref={(el) => {
                    tabRefs.current[t.id] = el;
                  }}
                  role="tab"
                  id={`tab-${t.id}`}
                  aria-selected={active}
                  aria-controls={`panel-${t.id}`}
                  tabIndex={active ? 0 : -1}
                  onClick={() => setTab(t.id)}
                  onKeyDown={(e) => onTabKey(e, i)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-[3px] -mb-px whitespace-nowrap ${focusRing} ${
                    active ? 'border-[#ba0c2f] text-[#ba0c2f]' : 'border-transparent text-gray-700 hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" aria-hidden />
                  {t.label}
                  {count !== null && (
                    <span
                      className={`ml-0.5 rounded-full px-2 py-0.5 text-xs ${active ? 'bg-[#ba0c2f] text-white' : 'bg-gray-200 text-gray-800'}`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => {
              resetAdvisingData();
              setDialogRequestId(null);
              setAnnouncement('Sample data restored.');
            }}
            className={`mb-2 inline-flex items-center gap-1.5 text-sm text-gray-700 hover:text-gray-900 rounded px-2 py-1 ${focusRing}`}
          >
            <RotateCcw className="w-4 h-4" aria-hidden /> Reset sample data
          </button>
        </div>

        <p role="status" aria-live="polite" className="sr-only">
          {announcement}
        </p>

        {/* Approvals */}
        {tab === 'approvals' && (
          <section id="panel-approvals" role="tabpanel" aria-labelledby="tab-approvals" className="space-y-4">
            <div className="max-w-md">
              <label htmlFor="request-search" className="block text-sm font-semibold text-gray-900">
                Search requests
              </label>
              <div className="relative mt-1">
                <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden />
                <input
                  id="request-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Student name, name.#, ticket, or request type"
                  className="w-full rounded-md border border-gray-400 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ba0c2f] focus:border-[#ba0c2f]"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter requests">
              {FILTERS.map((f) => {
                const n = requests.filter((r) => matchesFilter(r, f.id)).length;
                return (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={filter === f.id}
                    onClick={() => setFilter(f.id)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium ${focusRing} ${
                      filter === f.id ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50'
                    }`}
                  >
                    {f.label} ({n})
                  </button>
                );
              })}
            </div>

            <p className="text-sm text-gray-700" aria-live="polite">
              {visible.length} request{visible.length === 1 ? '' : 's'}
              {q ? ` matching “${query.trim()}”` : ''} · select one to open it
            </p>
            {visible.length === 0 ? (
              <p className="rounded-lg border border-gray-200 bg-white p-5 text-sm text-gray-700">
                {q ? 'No requests match your search.' : 'No requests here. You’re all caught up.'}
              </p>
            ) : (
              <ul aria-label="Requests" className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                {visible.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setDialogRequestId(r.id)}
                      aria-haspopup="dialog"
                      className={`h-full w-full text-left rounded-lg border border-gray-200 bg-white p-4 flex gap-3 hover:border-[#ba0c2f] hover:shadow-sm ${focusRing}`}
                    >
                      <span
                        className="w-9 h-9 rounded-full bg-gray-200 text-gray-800 text-sm font-bold flex items-center justify-center shrink-0"
                        aria-hidden
                      >
                        {initials(r.student.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-gray-900 truncate">{r.student.name}</span>
                          <span className="text-xs text-gray-600 shrink-0">{relativeTime(r.submittedAt)}</span>
                        </span>
                        <span className="block text-sm text-gray-800">{r.title}</span>
                        <span className="mt-1 block text-xs text-gray-600">
                          {CATEGORY_LABELS[r.category]}
                          {r.appointment ? ` · ${describeSlot(r.appointment.slotKey)}` : ''}
                        </span>
                        <span className="mt-2 flex flex-wrap gap-1.5">
                          <AiVerdictBadge review={r.aiReview} />
                          <RequestStatusBadge status={r.status} />
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Appointments */}
        {tab === 'appointments' && (
          <section id="panel-appointments" role="tabpanel" aria-labelledby="tab-appointments" className="space-y-3">
            <p className="text-sm text-gray-700">
              Booked meetings with BuckAI’s pre-meeting brief, so you know why each student is coming before they arrive.
            </p>
            {appointments.length === 0 ? (
              <p className="rounded-lg border border-gray-200 bg-white p-5 text-sm text-gray-700">No appointments booked yet.</p>
            ) : (
              <ul className="space-y-3">
                {appointments.map((r) => (
                  <li key={r.id} className="rounded-lg border border-gray-200 bg-white p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-[#ba0c2f]">{describeSlot(r.appointment!.slotKey)}</p>
                        <h3 className="text-base font-bold text-gray-900">
                          {r.student.name} · {r.title}
                        </h3>
                        <p className="text-sm text-gray-700">
                          {r.appointment!.format} · {r.student.major} · {r.student.rank}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <AiVerdictBadge review={r.aiReview} />
                        <RequestStatusBadge status={r.status} />
                      </div>
                    </div>
                    {r.aiReview && (
                      <p className="mt-3 text-sm leading-relaxed text-gray-900">{r.aiReview.situation || r.aiReview.summary}</p>
                    )}
                    {r.aiReview && (
                      <div className="mt-3 grid md:grid-cols-2 gap-4 rounded-md bg-gray-50 border border-gray-100 p-3">
                        <div>
                          <h4 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                            <Sparkles className="w-4 h-4 text-[#ba0c2f]" aria-hidden /> Why they’re coming
                          </h4>
                          <p className="mt-1 text-sm text-gray-800">{r.aiReview.reasonForAppointment}</p>
                          <ul className="mt-1 list-disc pl-5 text-sm text-gray-800">
                            {r.aiReview.studentNeeds.map((n) => (
                              <li key={n}>{n}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900">Suggested agenda</h4>
                          <ol className="mt-1 list-decimal pl-5 text-sm text-gray-800">
                            {r.aiReview.suggestedAgenda.map((a) => (
                              <li key={a}>{a}</li>
                            ))}
                          </ol>
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => openRequest(r.id)}
                      className={`mt-3 text-sm font-semibold text-[#ba0c2f] hover:underline rounded ${focusRing}`}
                    >
                      Open full request
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Advisor schedule */}
        {tab === 'availability' && (
          <section
            id="panel-availability"
            role="tabpanel"
            aria-labelledby="tab-availability"
            className="rounded-lg border border-gray-200 bg-white p-5 space-y-3"
          >
            <p className="flex items-center gap-2 text-sm text-gray-700">
              <Users className="w-4 h-4 text-gray-600" aria-hidden />
              Prototype: showing a sample student’s class schedule against your calendar. Students see the same openings when they book.
            </p>
            <ScheduleMatcher
              mode="advisor"
              studentName="Sample student"
              onOpenBooking={openRequest}
              onToggleAvailability={(slot) => {
                toggleAdvisorSlot(slot.key);
                setAnnouncement(
                  `${describeSlot(slot.key)} ${slot.status === 'open' ? 'marked unavailable' : 'reopened'}.`,
                );
              }}
            />
          </section>
        )}
      </main>

      <RequestDialog
        request={requests.find((r) => r.id === dialogRequestId) ?? null}
        onClose={() => setDialogRequestId(null)}
        onDecided={setAnnouncement}
      />
    </div>
  );
};
