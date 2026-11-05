import React, { useEffect, useId, useState } from 'react';
import {
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  CalendarClock,
  Quote,
  UserCheck,
  Loader2,
  ExternalLink,
  GraduationCap,
  FileText,
  CalendarCheck,
  CalendarPlus,
} from 'lucide-react';
import {
  AdvisingRequest,
  ADVISOR,
  CATEGORY_LABELS,
  decideRequest,
  describeSlot,
  RECORD_LINKS,
  relativeTime,
  scheduleAppointment,
} from '../../lib/advising';
import { AiVerdictBadge, RequestStatusBadge, initials } from './AdvisorBadges';

// One request, top to bottom in the order an advisor works it, kept short so the
// decision is reachable with little scrolling: who -> overview (what they want approved
// and the student's situation in detail, plus links to their records) -> AI verification
// (step 1) -> advisor decision (step 2). Advisors know the requirements, so the overview
// describes the student's problem rather than explaining policy.

interface RequestDetailProps {
  request: AdvisingRequest;
  onDecided: (message: string) => void;
}

const sectionTitle = 'flex items-center gap-2 text-sm font-bold text-gray-900';
const recordLink =
  'inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-[#ba0c2f] hover:bg-red-50 hover:border-[#ba0c2f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ba0c2f]';

export const RequestDetail: React.FC<RequestDetailProps> = ({ request, onDecided }) => {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const noteId = useId();
  const errorId = useId();
  const review = request.aiReview;
  const s = request.student;
  const decided = request.status === 'approved' || request.status === 'denied';
  const [scheduleMessage, setScheduleMessage] = useState<string | null>(null);

  useEffect(() => {
    setNote('');
    setError(null);
    setScheduleMessage(null);
  }, [request.id]);

  const decide = (status: 'approved' | 'denied') => {
    if (status === 'denied' && !note.trim()) {
      setError('Add a note explaining the denial to the student.');
      return;
    }
    decideRequest(request.id, status, note.trim(), ADVISOR.name);
    onDecided(`${request.title} for ${s.name} ${status === 'approved' ? 'approved' : 'denied'}.`);
  };

  // Book the soonest time that works for both of us (within 3 days if possible, a week at most).
  const schedule = () => {
    const result = scheduleAppointment(request.id, ADVISOR.name, note.trim());
    if (!result) {
      setError('No time is free for both of you in the next 7 days. Reopen some times in Advisor schedule, then try again.');
      return;
    }
    const when = describeSlot(result.slotKey);
    const message = result.keptStudentChoice
      ? `Scheduled at the time ${s.name} picked: ${when}.`
      : result.withinTarget
      ? `Scheduled ${when}, the earliest time you’re both free.`
      : `Nothing was open within 3 days, so this is the earliest time this week: ${when}.`;
    setScheduleMessage(message);
    setNote('');
    onDecided(`Meeting with ${s.name} scheduled for ${when}.`);
  };

  return (
    <article aria-labelledby={`req-student-${request.id}`} className="space-y-4">
      {/* Who */}
      <header className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-full bg-[#ba0c2f] text-white flex items-center justify-center font-bold shrink-0"
              aria-hidden
            >
              {initials(s.name)}
            </div>
            <div>
              <h2 id={`req-student-${request.id}`} className="text-lg font-bold text-gray-900 leading-snug">
                {s.name}
              </h2>
              <p className="text-sm text-gray-700">
                {s.email} · {s.major} · {s.rank} · GPA {s.gpa.toFixed(2)} · {s.earnedCredits} credits earned, {s.enrolledCredits} this term
              </p>
              <p className="text-xs text-gray-600">
                {CATEGORY_LABELS[request.category]} · {request.ticketId} · submitted {relativeTime(request.submittedAt)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <AiVerdictBadge review={review} />
            <RequestStatusBadge status={request.status} />
          </div>
        </div>
        {(s.holds.length > 0 || request.appointment) && (
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {s.holds.length > 0 && (
              <p className="text-[#8a0a23] flex items-start gap-1.5">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
                <span>
                  <span className="font-semibold">Active hold:</span> {s.holds.join('; ')}
                </span>
              </p>
            )}
            {request.appointment && (
              <p className="text-gray-800 flex items-center gap-1.5">
                <CalendarClock className="w-4 h-4 text-gray-600" aria-hidden />
                <span>
                  <span className="font-semibold">Requested time:</span> {describeSlot(request.appointment.slotKey)} ·{' '}
                  {request.appointment.format}
                </span>
              </p>
            )}
          </div>
        )}
      </header>

      {/* Overview: what they want approved and the student's situation */}
      <section aria-labelledby={`sum-${request.id}`} className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id={`sum-${request.id}`} className={sectionTitle}>
            <Sparkles className="w-4 h-4 text-[#ba0c2f]" aria-hidden /> Overview
          </h3>
          {review && (
            <span className="text-xs text-gray-600">
              {review.source === 'claude' ? 'Written by Claude' : 'Written by BuckAI'}
            </span>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Requesting approval for</p>
          <p className="text-base font-bold text-gray-900">{request.title}</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Student’s situation</p>
          {!review ? (
            <p className="mt-1 flex items-center gap-2 text-sm text-gray-700" role="status">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> BuckAI is reviewing this request…
            </p>
          ) : (
            <p className="mt-1 text-[15px] leading-relaxed text-gray-900">{review.situation || review.summary}</p>
          )}
        </div>

        <figure className="rounded-md border-l-4 border-gray-300 bg-gray-50 px-3 py-2">
          <figcaption className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600">
            <Quote className="w-3.5 h-3.5" aria-hidden /> In the student’s words
          </figcaption>
          <blockquote className="mt-0.5 text-sm text-gray-900">{request.studentMessage}</blockquote>
        </figure>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            Student records <span className="font-normal normal-case tracking-normal">· OSU ID {s.osuId}</span>
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            <a href={RECORD_LINKS.degreePlanner} target="_blank" rel="noopener noreferrer" className={recordLink}>
              <GraduationCap className="w-4 h-4" aria-hidden /> Buckeye Degree Planner
              <ExternalLink className="w-3.5 h-3.5" aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
            <a href={RECORD_LINKS.transcript} target="_blank" rel="noopener noreferrer" className={recordLink}>
              <FileText className="w-4 h-4" aria-hidden /> Transcript (Advising Report)
              <ExternalLink className="w-3.5 h-3.5" aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </div>
          <p className="mt-1 text-xs text-gray-600">Opens Ohio State’s systems; sign in with your OSU account and look up the student by OSU ID.</p>
        </div>
      </section>

      {/* Step 1: AI verification */}
      <section aria-labelledby={`ver-${request.id}`} className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 id={`ver-${request.id}`} className={sectionTitle}>
          <ShieldCheck className="w-4 h-4 text-[#ba0c2f]" aria-hidden />
          <span>
            Step 1 of 2 · AI verification
          </span>
        </h3>
        {review ? (
          <>
            <ul className="mt-3 divide-y divide-gray-100 border border-gray-100 rounded-md">
              {review.checks.map((c) => (
                <li key={c.label} className="flex items-start gap-3 px-3 py-2.5">
                  {c.passed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" aria-hidden />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" aria-hidden />
                  )}
                  <div className="text-sm">
                    <p className="font-semibold text-gray-900">
                      {c.label} <span className="sr-only">{c.passed ? '(passed)' : '(needs attention)'}</span>
                    </p>
                    <p className="text-gray-700">{c.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-gray-900">
              <span className="font-semibold">AI recommendation:</span> {review.recommendation}
            </p>
            <p className="mt-1 text-xs text-gray-600">
              The AI does not change student records. Your decision below is final.
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-gray-700">Waiting for the AI check to finish.</p>
        )}
      </section>

      {/* Step 2: Advisor decision */}
      <section aria-labelledby={`dec-${request.id}`} className="rounded-lg border-2 border-[#ba0c2f]/20 bg-white p-5">
        <h3 id={`dec-${request.id}`} className={sectionTitle}>
          <UserCheck className="w-4 h-4 text-[#ba0c2f]" aria-hidden /> Step 2 of 2 · Your decision
        </h3>

        {decided && request.decision ? (
          <div className="mt-3 rounded-md bg-gray-50 border border-gray-200 p-3 text-sm">
            <p className="font-semibold text-gray-900">
              {request.status === 'approved' ? 'Approved' : 'Denied'} by {request.decision.by} ·{' '}
              {relativeTime(request.decision.at)}
            </p>
            {request.decision.note && <p className="mt-1 text-gray-800">{request.decision.note}</p>}
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {request.status === 'needs_info' && request.decision && (
              <p className="text-sm rounded-md bg-blue-50 border border-blue-200 text-blue-900 p-2.5">
                You asked for more information {relativeTime(request.decision.at)}: “{request.decision.note}”
              </p>
            )}
            {request.status === 'scheduled' && request.appointment && (
              <div role="status" className="text-sm rounded-md bg-blue-50 border border-blue-200 text-blue-950 p-2.5">
                <p className="flex items-center gap-1.5 font-semibold">
                  <CalendarCheck className="w-4 h-4" aria-hidden /> Meeting scheduled: {describeSlot(request.appointment.slotKey)} ·{' '}
                  {request.appointment.format}
                </p>
                <p className="mt-0.5">{scheduleMessage ?? 'Approve or deny after you meet with the student.'}</p>
              </div>
            )}
            <div>
              <label htmlFor={noteId} className="block text-sm font-semibold text-gray-900">
                Note to student <span className="font-normal text-gray-600">(required to deny; optional when scheduling)</span>
              </label>
              <textarea
                id={noteId}
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  if (error) setError(null);
                }}
                rows={3}
                aria-invalid={!!error}
                aria-describedby={error ? errorId : undefined}
                className="mt-1 w-full rounded-md border border-gray-400 p-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ba0c2f] focus:border-[#ba0c2f]"
                placeholder="e.g. Let’s meet to talk through your options before you decide."
              />
              {error && (
                <p id={errorId} role="alert" className="mt-1 text-sm font-medium text-[#8a0a23]">
                  {error}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => decide('approved')}
                disabled={request.status === 'ai_review'}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#ba0c2f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#8a0a23] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ba0c2f]"
              >
                <CheckCircle2 className="w-4 h-4" aria-hidden /> Approve
              </button>
              {request.status !== 'scheduled' && (
                <button
                  type="button"
                  onClick={schedule}
                  disabled={request.status === 'ai_review'}
                  className="inline-flex items-center gap-1.5 rounded-md border border-gray-400 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ba0c2f]"
                >
                  <CalendarPlus className="w-4 h-4" aria-hidden /> Schedule appointment
                </button>
              )}
              <button
                type="button"
                onClick={() => decide('denied')}
                disabled={request.status === 'ai_review'}
                className="rounded-md border border-gray-400 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ba0c2f]"
              >
                Deny
              </button>
            </div>
          </div>
        )}
      </section>
    </article>
  );
};
