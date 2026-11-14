import React, { useMemo, useState } from 'react';
import { CalendarCheck, CheckCircle2, MessageSquareWarning, X, XCircle } from 'lucide-react';
import { AdvisingRequest, describeSlot, useAdvisingState } from '../lib/advising';

// Tells a student, wherever they are in the app, when an advisor acts on one of their
// requests: confirmed the time they picked, booked a different time, approved, denied,
// or asked for more information. Each decision shows once; dismissing it marks it seen
// in this browser. Decisions older than two weeks never pop up.

const SEEN_KEY = 'buckai.seenAdvisorDecisions';
const MAX_AGE_MS = 14 * 86_400_000;
const NOTIFY_STATUSES: AdvisingRequest['status'][] = ['scheduled', 'approved', 'denied', 'needs_info'];

const decisionKey = (r: AdvisingRequest) => `${r.id}:${r.status}:${r.decision?.at ?? ''}`;

function readSeen(): Set<string> {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeSeen(seen: Set<string>) {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-100)));
  } catch {
    // Private mode or blocked storage: the notice just shows again next visit.
  }
}

function describe(r: AdvisingRequest): { title: string; body: string; tone: 'good' | 'info' | 'bad'; Icon: typeof CheckCircle2 } {
  const by = r.decision?.by || 'Your advisor';
  const when = r.appointment ? `${describeSlot(r.appointment.slotKey)} · ${r.appointment.format}` : '';
  switch (r.status) {
    case 'scheduled':
      return r.decision?.keptStudentChoice
        ? { title: 'Appointment confirmed', body: `${by} accepted the time you picked: ${when}.`, tone: 'good', Icon: CalendarCheck }
        : {
            title: 'Your advisor scheduled a meeting',
            body: `${by} booked ${when}, the earliest time you’re both free.`,
            tone: 'info',
            Icon: CalendarCheck,
          };
    case 'approved':
      return { title: `${r.title}: approved`, body: `${by} approved your request.`, tone: 'good', Icon: CheckCircle2 };
    case 'denied':
      return { title: `${r.title}: not approved`, body: `${by} didn’t approve this request.`, tone: 'bad', Icon: XCircle };
    default:
      return { title: 'Your advisor needs more information', body: `${by} has a question about ${r.title}.`, tone: 'info', Icon: MessageSquareWarning };
  }
}

const TONE = {
  good: 'border-emerald-300 bg-emerald-50 text-emerald-950',
  info: 'border-blue-300 bg-blue-50 text-blue-950',
  bad: 'border-gray-300 bg-white text-gray-900',
};

export function AdvisorDecisionNotice({ studentEmail, onView }: { studentEmail: string; onView: () => void }) {
  const { requests } = useAdvisingState();
  const [seen, setSeen] = useState<Set<string>>(() => readSeen());

  const pending = useMemo(
    () =>
      requests.filter(
        (r) =>
          r.student.email === studentEmail &&
          NOTIFY_STATUSES.includes(r.status) &&
          r.decision &&
          Date.now() - new Date(r.decision.at).getTime() < MAX_AGE_MS &&
          !seen.has(decisionKey(r)),
      ),
    [requests, studentEmail, seen],
  );

  if (pending.length === 0) return null;

  const dismiss = (r: AdvisingRequest) => {
    const next = new Set(seen);
    next.add(decisionKey(r));
    writeSeen(next);
    setSeen(next);
  };

  return (
    <div className="fixed top-4 right-4 left-4 sm:left-auto sm:w-[380px] z-[60] space-y-2" role="region" aria-label="Advisor updates">
      {pending.slice(0, 3).map((r) => {
        const { title, body, tone, Icon } = describe(r);
        // Skip the note scheduleAppointment fills in when the advisor leaves it blank; it only repeats the time.
        const autoNote = r.appointment ? `Let’s meet ${describeSlot(r.appointment.slotKey)} to work through this together.` : '';
        const note = r.decision?.note?.trim() === autoNote ? '' : r.decision?.note?.trim();
        return (
          <div key={decisionKey(r)} role="status" className={`rounded-lg border shadow-lg p-4 ${TONE[tone]}`}>
            <div className="flex items-start gap-3">
              <Icon className="w-5 h-5 shrink-0 mt-0.5" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm">{title}</p>
                <p className="text-sm mt-0.5">{body}</p>
                {note && <p className="text-xs mt-1.5 italic opacity-90">“{note}”</p>}
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      dismiss(r);
                      onView();
                    }}
                    className="rounded-md bg-[#ba0c2f] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#8a0a23] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ba0c2f]"
                  >
                    View details
                  </button>
                  <button
                    type="button"
                    onClick={() => dismiss(r)}
                    className="rounded-md border border-current/30 px-3 py-1.5 text-xs font-semibold hover:bg-black/5"
                  >
                    Got it
                  </button>
                </div>
              </div>
              <button type="button" onClick={() => dismiss(r)} aria-label="Dismiss" className="shrink-0 rounded p-0.5 hover:bg-black/5">
                <X className="w-4 h-4" aria-hidden />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
