import React, { useState } from 'react';
import { AlertTriangle, UserCheck, CheckCircle2, Calendar, ArrowRight, ListChecks, XCircle, Trash2 } from 'lucide-react';

// Big decisions the chat asks a student to think twice about (see src/lib/chatIntents.ts).
// 'add_minor' is kept so older saved chats still render.
export type DecisionType = 'drop_class' | 'withdraw' | 'pass_nonpass' | 'overload' | 'transfer_credit' | 'change_major' | 'add_minor';

export interface HighStakesDecisionData {
  id?: string;
  isHighStakes: boolean;
  actionType: DecisionType;
  decisionTitle: string;
  warningSummary: string;
  consequences: string[]; // this student's own impacts (their credit load, requirements, prerequisites)
  nextSteps?: string[]; // how to do it themselves, shown once they choose to go through with it
  course?: string; // the class involved, when there is one
  courseCredits?: number;
  // pending_review: waiting on the student · escalated_to_advisor: sent to their advisor · proceeding: they chose
  // to go ahead themselves · cancelled: they changed their mind · confirmed_and_sent: older chats
  status?: 'pending_review' | 'escalated_to_advisor' | 'proceeding' | 'cancelled' | 'confirmed_and_sent';
  removedFromSchedule?: boolean; // the class was taken off the student's BuckAI schedule
  ticketId?: string;
  advisorName?: string;
  advisorEmail?: string;
  dispatchedAt?: string;
  escalateRecommended?: boolean;
}

interface HighStakesDecisionCardProps {
  decision: HighStakesDecisionData;
  onEscalateToAdvisor: (decision: HighStakesDecisionData) => void; // confirm with my advisor first
  onProceed: (decision: HighStakesDecisionData) => void; // go through with it myself
  onCancel: (decision: HighStakesDecisionData) => void; // never mind
  onRemoveFromSchedule?: (decision: HighStakesDecisionData) => void; // after dropping in BuckeyeLink
  onOpenAdvisorTab?: () => void;
  isSubmitting?: boolean;
}

export const HighStakesDecisionCard: React.FC<HighStakesDecisionCardProps> = ({
  decision,
  onEscalateToAdvisor,
  onProceed,
  onCancel,
  onRemoveFromSchedule,
  onOpenAdvisorTab,
  isSubmitting = false,
}) => {
  const [acknowledged, setAcknowledged] = useState(false);
  const [needsAck, setNeedsAck] = useState(false);
  const advisor = decision.advisorName || 'your advisor';

  if (decision.status === 'cancelled') {
    return (
      <div className="mt-3 border border-gray-200 rounded-lg p-3 text-xs text-gray-600 flex items-center gap-2 bg-gray-50">
        <XCircle className="w-4 h-4 shrink-0" /> You decided not to go ahead with: <strong className="text-gray-800">{decision.decisionTitle}</strong>. Nothing was changed.
      </div>
    );
  }

  if (decision.status === 'escalated_to_advisor' || decision.status === 'confirmed_and_sent') {
    return (
      <div className="mt-3 bg-white border-2 border-emerald-600/40 rounded-xl p-4 text-xs space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Sent to {advisor}</div>
              <h4 className="font-bold text-sm text-gray-900 mt-0.5">{decision.decisionTitle}</h4>
            </div>
          </div>
          {decision.ticketId && (
            <span className="text-[11px] font-mono bg-gray-100 text-gray-700 px-2 py-0.5 rounded border border-gray-200 shrink-0">{decision.ticketId}</span>
          )}
        </div>
        <p className="text-gray-700">
          {advisor} will see this request with the impacts BuckAI listed. Nothing changes on your record until you and your advisor decide.
          Pick a time to talk it through so it doesn&apos;t wait on email.
        </p>
        {onOpenAdvisorTab && (
          <button
            onClick={onOpenAdvisorTab}
            className="bg-[#ba0c2f] hover:bg-[#9d0a27] text-white px-3.5 py-1.5 rounded-lg font-semibold text-xs flex items-center gap-1.5"
          >
            <Calendar className="w-3.5 h-3.5" /> Pick a time with {advisor} <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  }

  if (decision.status === 'proceeding') {
    return (
      <div className="mt-3 bg-white border border-gray-300 rounded-xl p-4 text-xs space-y-3">
        <div className="flex items-start gap-2.5">
          <ListChecks className="w-5 h-5 text-[#ba0c2f] shrink-0" />
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-600">You chose to go ahead</div>
            <h4 className="font-bold text-sm text-gray-900 mt-0.5">{decision.decisionTitle}</h4>
          </div>
        </div>
        {!!decision.nextSteps?.length && (
          <ol className="list-decimal pl-5 space-y-1 text-gray-800">
            {decision.nextSteps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          {decision.actionType === 'drop_class' && decision.course && onRemoveFromSchedule && (
            decision.removedFromSchedule ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-2.5 py-1.5 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" /> Removed {decision.course} from your BuckAI schedule
              </span>
            ) : (
              <button
                onClick={() => onRemoveFromSchedule(decision)}
                className="inline-flex items-center gap-1.5 border border-gray-300 hover:border-[#ba0c2f] hover:text-[#ba0c2f] rounded px-2.5 py-1.5 font-semibold"
              >
                <Trash2 className="w-3.5 h-3.5" /> I dropped it in BuckeyeLink: remove it from BuckAI
              </button>
            )
          )}
          <button
            onClick={() => onEscalateToAdvisor(decision)}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 border border-gray-300 hover:border-[#ba0c2f] hover:text-[#ba0c2f] rounded px-2.5 py-1.5 font-semibold disabled:opacity-50"
          >
            <UserCheck className="w-3.5 h-3.5" /> Actually, check with {advisor} first
          </button>
        </div>
      </div>
    );
  }

  // Waiting on the student: the big-decision notice
  return (
    <div className="mt-3 bg-white border border-[#f5c2cb] rounded-2xl p-4 sm:p-5 text-xs space-y-3.5" role="group" aria-label="Big decision">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-[#ba0c2f] text-white flex items-center justify-center shrink-0">
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#ba0c2f] bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
            This is a big decision
          </span>
          <h4 className="font-bold text-sm text-gray-900 mt-1">{decision.decisionTitle}</h4>
        </div>
      </div>

      <p className="text-gray-700 leading-relaxed">{decision.warningSummary}</p>

      {decision.consequences.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-bold uppercase tracking-wide text-gray-500">What it means for you</div>
          <ul className="space-y-1.5">
            {decision.consequences.map((c) => {
              const [head, ...rest] = c.split(': ');
              return (
                <li key={c} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 leading-snug">
                  {rest.length ? (
                    <>
                      <strong className="text-gray-900">{head}:</strong> {rest.join(': ')}
                    </>
                  ) : (
                    c
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="font-semibold text-gray-900">Do you want to go through with it, or confirm with {advisor} first?</p>

      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => {
            setAcknowledged(e.target.checked);
            setNeedsAck(false);
          }}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-[#ba0c2f]"
        />
        <span className="text-gray-700">I read what this means for me. BuckAI won&apos;t change my official record; I or my advisor do that in BuckeyeLink.</span>
      </label>
      {needsAck && <p className="text-[#c5221f] font-medium">Check the box above to go ahead on your own.</p>}

      <div className="flex flex-col sm:flex-row gap-2 pt-1">
        <button
          onClick={() => onEscalateToAdvisor(decision)}
          disabled={isSubmitting}
          className="flex-1 bg-[#ba0c2f] hover:bg-[#9d0a27] text-white font-semibold px-4 py-2 rounded-full flex items-center justify-center gap-1.5 disabled:opacity-60"
        >
          <UserCheck className="w-3.5 h-3.5" /> {isSubmitting ? 'Sending…' : `Confirm with ${advisor} first (recommended)`}
        </button>
        <button
          onClick={() => {
            if (!acknowledged) {
              setNeedsAck(true);
              return;
            }
            onProceed(decision);
          }}
          className="flex-1 bg-white border border-gray-400 hover:border-gray-700 text-gray-900 font-semibold px-4 py-2 rounded-full flex items-center justify-center gap-1.5"
        >
          <ArrowRight className="w-3.5 h-3.5" /> Go through with it
        </button>
        <button onClick={() => onCancel(decision)} className="text-gray-600 hover:text-gray-900 font-semibold px-3 py-2">
          Never mind
        </button>
      </div>
    </div>
  );
};
