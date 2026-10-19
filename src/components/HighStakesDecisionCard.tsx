import React, { useState } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  UserCheck,
  CheckCircle2,
  Calendar,
  Clock,
  ArrowRight,
  ExternalLink,
  Info,
  DollarSign,
  GraduationCap,
  FileText,
  ChevronDown,
  ShieldCheck,
  Building
} from 'lucide-react';

export interface HighStakesDecisionData {
  id?: string;
  isHighStakes: boolean;
  actionType: 'drop_class' | 'add_minor' | 'change_major' | 'withdraw';
  decisionTitle: string;
  warningSummary: string;
  consequences: string[];
  status?: 'pending_review' | 'escalated_to_advisor' | 'confirmed_and_sent';
  ticketId?: string;
  advisorName?: string;
  advisorEmail?: string;
  dispatchedAt?: string;
  escalateRecommended?: boolean;
}

interface HighStakesDecisionCardProps {
  decision: HighStakesDecisionData;
  onEscalateToAdvisor: (decision: HighStakesDecisionData) => void;
  onConfirmAndSend: (decision: HighStakesDecisionData) => void;
  onOpenAdvisorTab?: () => void;
  isSubmitting?: boolean;
}

export const HighStakesDecisionCard: React.FC<HighStakesDecisionCardProps> = ({
  decision,
  onEscalateToAdvisor,
  onConfirmAndSend,
  onOpenAdvisorTab,
  isSubmitting = false,
}) => {
  const [acknowledgedRisks, setAcknowledgedRisks] = useState<boolean>(false);
  const [acknowledgedHumanRule, setAcknowledgedHumanRule] = useState<boolean>(false);
  const [showValidationPrompt, setShowValidationPrompt] = useState<boolean>(false);

  const isAlreadyDispatched = decision.status === 'confirmed_and_sent' || decision.status === 'escalated_to_advisor';

  const handleConfirmClick = () => {
    if (!acknowledgedRisks || !acknowledgedHumanRule) {
      setShowValidationPrompt(true);
      return;
    }
    setShowValidationPrompt(false);
    onConfirmAndSend(decision);
  };

  const handleEscalateClick = () => {
    onEscalateToAdvisor(decision);
  };

  // If already dispatched to human advisor, show the compact official SIS Case Dispatch Badge
  if (isAlreadyDispatched) {
    return (
      <div className="mt-3 bg-white border-2 border-emerald-600/40 rounded-xl p-4 sm:p-5 shadow-xs text-xs space-y-3">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Advisor Dispatch Confirmed
              </span>
              <h4 className="font-bold text-sm text-gray-900 mt-0.5">
                {decision.decisionTitle}
              </h4>
            </div>
          </div>
          <span className="text-[11px] font-mono bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded border border-gray-200 shrink-0">
            {decision.ticketId || 'OSU-ADV-849201'}
          </span>
        </div>

        <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-2.5 text-emerald-950 text-xs">
          <strong>Request routed to advisor:</strong> Forwarded directly to <strong>{decision.advisorName || 'Sarah Jenkins, M.Ed.'}</strong> for manual review. AI systems cannot alter student records.
        </div>

        {/* Expandable Dropdown: View SIS Ticket & Advisor Routing Details */}
        <details className="group border border-emerald-100 rounded-lg bg-gray-50/50 p-2.5 text-xs cursor-pointer">
          <summary className="flex items-center justify-between text-gray-700 font-semibold text-[11px] select-none hover:text-emerald-800">
            <span className="flex items-center space-x-1.5">
              <Info className="w-3.5 h-3.5 text-emerald-700" />
              <span>View Case Routing &amp; Office Details</span>
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-500 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-2.5 pt-2 border-t border-gray-200 text-gray-600 space-y-1.5 text-[11px]">
            <div><strong>Assigned Advisor:</strong> {decision.advisorName || 'Sarah Jenkins, M.Ed.'} ({decision.advisorEmail || 'jenkins.892@osu.edu'}) • Mason Hall 120</div>
            <div><strong>Timestamp:</strong> {decision.dispatchedAt || 'Today, Eastern Time'}</div>
            <div><strong>Policy Check:</strong> Sarah Jenkins will inspect DARS prerequisite chains and 12-credit full-time requirements before issuing SIS approval.</div>
          </div>
        </details>

        {onOpenAdvisorTab && (
          <div className="pt-1 flex justify-end">
            <button
              onClick={onOpenAdvisorTab}
              className="bg-[#ba0c2f] hover:bg-[#9d0a27] text-white px-3.5 py-1.5 rounded-lg font-semibold text-xs transition-colors flex items-center space-x-1.5 shadow-2xs"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Match Appointment Time with Sarah</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 bg-white border border-[#f5c2cb] rounded-2xl p-4 sm:p-5 shadow-xs text-xs space-y-4">
      {/* Top Header: Google Style Card Banner with OSU block */}
      <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3">
        <div className="flex items-start space-x-3">
          <div className="w-8 h-8 rounded-xl bg-[#ba0c2f] text-white flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
            <AlertTriangle className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#ba0c2f] bg-red-50 px-2.5 py-0.5 rounded-full border border-red-200">
                High-Stakes Academic Action
              </span>
              <span className="text-[10px] text-[#5f6368] font-medium">
                Advisor Sign-off Required
              </span>
            </div>
            <h4 className="font-bold text-sm text-[#202124] mt-1">
              {decision.decisionTitle}
            </h4>
          </div>
        </div>
      </div>

      {/* Concise Summary (Google Clean Notice) */}
      <div className="text-[#3c4043] text-xs leading-relaxed">
        <span className="font-semibold text-[#ba0c2f]">Notice:</span> This change cannot be executed autonomously by an AI. Official course drops and curriculum edits require human advisor authorization in BuckeyeLink.
      </div>

      {/* Scannable Key Impacts (Google Material Cards) */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-bold uppercase tracking-wide text-[#5f6368]">
          Key Impact Summary:
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Quick Item 1 */}
          <div className="bg-[#f8f9fa] border border-gray-200 rounded-xl p-3">
            <div className="flex items-center space-x-1.5 text-amber-900 font-bold text-[11px]">
              <DollarSign className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Financial Aid</span>
            </div>
            <div className="text-[#5f6368] text-[11px] mt-1 leading-snug">
              Drops credit hours below 12 cr (Full-Time FAFSA risk).
            </div>
          </div>

          {/* Quick Item 2 */}
          <div className="bg-[#f8f9fa] border border-gray-200 rounded-xl p-3">
            <div className="flex items-center space-x-1.5 text-[#ba0c2f] font-bold text-[11px]">
              <GraduationCap className="w-3.5 h-3.5 text-[#ba0c2f] shrink-0" />
              <span>Prereq Sequence</span>
            </div>
            <div className="text-[#5f6368] text-[11px] mt-1 leading-snug">
              Interrupts core prerequisites; delays graduation 1–2 terms.
            </div>
          </div>

          {/* Quick Item 3 */}
          <div className="bg-[#f8f9fa] border border-gray-200 rounded-xl p-3">
            <div className="flex items-center space-x-1.5 text-[#202124] font-bold text-[11px]">
              <FileText className="w-3.5 h-3.5 text-[#5f6368] shrink-0" />
              <span>Transcript Mark</span>
            </div>
            <div className="text-[#5f6368] text-[11px] mt-1 leading-snug">
              Drops past 4th Friday yield permanent &ldquo;W&rdquo; grade.
            </div>
          </div>
        </div>
      </div>

      {/* INTERACTIVE DROPDOWNS: Expandable Legal & Academic Senate Policies */}
      <div className="space-y-2 pt-0.5">
        <details className="group bg-[#f8f9fa] border border-gray-200 rounded-xl p-3 text-xs transition-colors hover:border-gray-300">
          <summary className="flex items-center justify-between font-semibold text-[#202124] text-[11px] cursor-pointer select-none">
            <span className="flex items-center space-x-1.5 text-[#ba0c2f]">
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span>View Full Financial Aid &amp; Scholarship Policy Details</span>
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-[#5f6368] transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-2.5 pt-2 border-t border-gray-200 text-[#5f6368] text-[11px] leading-relaxed space-y-1">
            <p>
              • <strong>Title IV Federal Aid (FAFSA):</strong> Full-time enrollment of 12+ credit hours is strictly required on the census date. Dropping to part-time triggers recalculation and possible immediate tuition balance due.
            </p>
            <p>
              • <strong>Fisher College Merit Awards:</strong> Institutional scholarships require maintaining a 12-credit minimum per Autumn/Spring term.
            </p>
            <p>
              • <strong>Campus Housing:</strong> University Housing contracts require active full-time status unless an approved academic reduction waiver is filed.
            </p>
          </div>
        </details>

        <details className="group bg-[#f8f9fa] border border-gray-200 rounded-xl p-3 text-xs transition-colors hover:border-gray-300">
          <summary className="flex items-center justify-between font-semibold text-[#202124] text-[11px] cursor-pointer select-none">
            <span className="flex items-center space-x-1.5 text-[#3c4043]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#ba0c2f] shrink-0" />
              <span>View Ohio State Academic Senate Regulation 3335-8-32</span>
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-[#5f6368] transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-2.5 pt-2 border-t border-gray-200 text-[#5f6368] text-[11px] leading-relaxed space-y-1">
            <p>
              • <strong>Withdrawal Deadlines:</strong> Through the 4th Friday: dropped courses do not appear on official transcripts. 5th through 10th Friday: course remains with a non-punitive mark of &ldquo;W&rdquo;. After the 10th Friday: drops are prohibited except by formal college petition for extenuating circumstances.
            </p>
            <p>
              • <strong>Advisor Escalation Mandate:</strong> Per Academic Senate bylaws, automated algorithms cannot finalize course cancellations without verified student consent and assigned academic advisor notification.
            </p>
          </div>
        </details>
      </div>

      {/* Streamlined Confirmation Checkboxes */}
      <div className="bg-[#f8f9fa] border border-gray-200 rounded-xl p-3.5 space-y-2.5">
        <label className="flex items-start space-x-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={acknowledgedRisks}
            onChange={(e) => {
              setAcknowledgedRisks(e.target.checked);
              if (showValidationPrompt) setShowValidationPrompt(false);
            }}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#ba0c2f] focus:ring-[#ba0c2f]"
          />
          <span className="text-[11px] text-[#3c4043] leading-tight">
            I understand this choice impacts my <strong>prerequisites, graduation timeline, and financial aid</strong>.
          </span>
        </label>

        <label className="flex items-start space-x-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={acknowledgedHumanRule}
            onChange={(e) => {
              setAcknowledgedHumanRule(e.target.checked);
              if (showValidationPrompt) setShowValidationPrompt(false);
            }}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#ba0c2f] focus:ring-[#ba0c2f]"
          />
          <span className="text-[11px] text-[#3c4043] leading-tight">
            I understand an AI cannot modify my record; this will be routed to my human advisor (Sarah Jenkins).
          </span>
        </label>

        {showValidationPrompt && (
          <div className="text-[11px] font-medium text-[#c5221f] bg-red-50 p-2 rounded-lg border border-red-200 flex items-center space-x-1.5">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span>Please check both acknowledgement boxes above to proceed.</span>
          </div>
        )}
      </div>

      {/* Action Buttons: Google Material Pill Buttons with OSU accents */}
      <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <button
          onClick={handleEscalateClick}
          disabled={isSubmitting}
          className="bg-white border border-[#ba0c2f] hover:bg-red-50 text-[#ba0c2f] font-semibold px-4 py-2 rounded-full text-xs transition-colors flex items-center justify-center space-x-1.5 shadow-2xs"
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>Escalate to Sarah Jenkins</span>
        </button>

        <button
          onClick={handleConfirmClick}
          disabled={isSubmitting}
          className="bg-[#ba0c2f] hover:bg-[#9d0a27] text-white font-semibold px-5 py-2 rounded-full text-xs transition-colors flex items-center justify-center space-x-1.5 shadow-xs disabled:bg-gray-400"
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>{isSubmitting ? 'Routing...' : 'Confirm & Route to Advisor'}</span>
        </button>
      </div>
    </div>
  );
};
