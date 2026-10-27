import React from 'react';
import { ShieldCheck, AlertTriangle, XCircle, Loader2, Clock, CheckCircle2, HelpCircle, Ban, CalendarCheck } from 'lucide-react';
import type { AiReview, RequestStatus } from '../../lib/advising';

// Small status labels shared by the advisor screens. Each pairs color with an icon and
// words so meaning never depends on color alone.

const pill = 'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap';

export const AiVerdictBadge: React.FC<{ review: AiReview | null }> = ({ review }) => {
  if (!review) {
    return (
      <span className={`${pill} border-gray-300 bg-gray-50 text-gray-700`}>
        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> AI checking
      </span>
    );
  }
  if (review.verdict === 'supported') {
    return (
      <span className={`${pill} border-emerald-300 bg-emerald-50 text-emerald-800`}>
        <ShieldCheck className="w-3.5 h-3.5" aria-hidden /> AI verified
      </span>
    );
  }
  if (review.verdict === 'needs_attention') {
    return (
      <span className={`${pill} border-amber-300 bg-amber-50 text-amber-900`}>
        <AlertTriangle className="w-3.5 h-3.5" aria-hidden /> AI flagged
      </span>
    );
  }
  return (
    <span className={`${pill} border-red-300 bg-red-50 text-red-800`}>
      <XCircle className="w-3.5 h-3.5" aria-hidden /> AI: not supported
    </span>
  );
};

const STATUS: Record<RequestStatus, { cls: string; label: string; icon: React.ElementType }> = {
  ai_review: { cls: 'border-gray-300 bg-gray-50 text-gray-700', label: 'AI checking', icon: Loader2 },
  pending_advisor: { cls: 'border-[#ba0c2f]/30 bg-red-50 text-[#8a0a23]', label: 'Awaiting your approval', icon: Clock },
  needs_info: { cls: 'border-blue-300 bg-blue-50 text-blue-800', label: 'Info requested', icon: HelpCircle },
  scheduled: { cls: 'border-blue-300 bg-blue-50 text-blue-800', label: 'Meeting scheduled', icon: CalendarCheck },
  approved: { cls: 'border-emerald-300 bg-emerald-50 text-emerald-800', label: 'Approved', icon: CheckCircle2 },
  denied: { cls: 'border-gray-400 bg-gray-100 text-gray-800', label: 'Denied', icon: Ban },
};

export const RequestStatusBadge: React.FC<{ status: RequestStatus }> = ({ status }) => {
  const s = STATUS[status];
  const Icon = s.icon;
  return (
    <span className={`${pill} ${s.cls}`}>
      <Icon className={`w-3.5 h-3.5 ${status === 'ai_review' ? 'animate-spin' : ''}`} aria-hidden /> {s.label}
    </span>
  );
};

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}
