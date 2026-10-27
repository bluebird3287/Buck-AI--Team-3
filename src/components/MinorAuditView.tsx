import React, { useMemo, useState } from 'react';
import { AlertTriangle, Ban, ExternalLink, MessageSquare, CalendarPlus, ShieldAlert } from 'lucide-react';
import { Semester } from '../data/sampleData';
import { Curriculum, DegreeAudit, auditMinor } from '../lib/requirements';
import { GroupCard } from './DegreeRequirementsView';

interface MinorAuditViewProps {
  curriculum: Curriculum | null;
  specializationId: string | null;
  roadmap: Semester[];
  audit: DegreeAudit | null;
  onAsk: (prompt: string) => void;
  onAddToPlan: (prompt: string) => void;
  onDeclare: (prompt: string) => void;
}

// What-if audit for every Fisher minor, checked against the classes the student entered.
export const MinorAuditView: React.FC<MinorAuditViewProps> = ({
  curriculum,
  specializationId,
  roadmap,
  audit,
  onAsk,
  onAddToPlan,
  onDeclare,
}) => {
  const minors = useMemo(
    () =>
      (curriculum?.minors ?? [])
        .map((minor) => ({ minor, result: auditMinor(minor, specializationId, roadmap, audit) }))
        // Eligible minors first, then the ones the student is furthest along in
        .sort((a, b) => Number(b.result.eligible) - Number(a.result.eligible) || b.result.creditsCounted - a.result.creditsCounted),
    [curriculum, specializationId, roadmap, audit],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = minors.find((m) => m.minor.id === selectedId) ?? minors[0];

  if (!curriculum) return <div className="p-6 text-sm text-gray-600">Loading Fisher minors…</div>;
  if (!selected) return <div className="p-6 text-sm text-gray-600">No minors found.</div>;

  const { minor, result } = selected;
  const pct = Math.min(100, Math.round((result.creditsCounted / result.creditsRequired) * 100));
  const remaining = result.progress.groups
    .filter((g) => g.state === 'missing')
    .map((g) =>
      g.group.kind === 'all'
        ? g.items.filter((i) => i.state === 'missing').map((i) => i.code).join(', ')
        : g.group.kind === 'choose_courses'
        ? `${(g.coursesNeeded ?? 1) - g.coursesCounted} more from ${g.group.title}`
        : `${(g.creditsNeeded ?? 0) - g.creditsCounted} more credit hours from ${g.group.title}`,
    )
    .filter(Boolean);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-[#f8fafc]">
      <div>
        <h3 className="text-base sm:text-lg font-bold text-gray-900">What-If Minor Audit</h3>
        <p className="text-xs text-gray-600 mt-0.5">
          Every Fisher minor, checked against the classes you&apos;ve taken, are taking, and have planned. Minor courses need a C- or
          better and a 2.00 GPA across the minor.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {minors.map(({ minor: m, result: r }) => {
          const p = Math.min(100, Math.round((r.creditsCounted / r.creditsRequired) * 100));
          const isSelected = m.id === minor.id;
          return (
            <button
              key={m.id}
              onClick={() => setSelectedId(m.id)}
              className={`text-left p-3 rounded-lg border transition-colors ${
                isSelected ? 'border-[#ba0c2f] bg-red-50 ring-1 ring-[#ba0c2f]' : 'border-gray-200 bg-white hover:border-gray-300'
              } ${r.eligible ? '' : 'opacity-70'}`}
            >
              <div className="font-semibold text-sm text-gray-900">{m.name}</div>
              {r.eligible ? (
                <>
                  <div className="text-xs text-gray-600 mt-1">
                    {r.creditsCounted} of {r.creditsRequired} credit hours on your plan
                  </div>
                  <div className="w-full h-1.5 bg-gray-200 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-[#ba0c2f]" style={{ width: `${p}%` }} />
                  </div>
                </>
              ) : (
                <div className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                  <Ban className="w-3 h-3" /> Not available with your specialization
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="text-base font-bold text-gray-900">{minor.name}</h4>
            <p className="text-xs text-gray-600 mt-0.5">
              {result.creditsDone} credit hours done · {result.creditsCounted} on your plan · {result.creditsRequired} required
            </p>
          </div>
          {minor.source_url && (
            <a href={minor.source_url} target="_blank" rel="noreferrer" className="text-xs text-[#ba0c2f] hover:underline flex items-center gap-1">
              Fisher minor page <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-[#ba0c2f]" style={{ width: `${pct}%` }} />
        </div>

        {!result.eligible && (
          <div className="p-3 rounded-md bg-gray-100 border border-gray-300 text-sm text-gray-800 flex items-start gap-2">
            <Ban className="w-4 h-4 mt-0.5 shrink-0" /> {result.ineligibleReason}
          </div>
        )}
        {result.eligible && result.overlapTooHigh && (
          <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-sm text-amber-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              {result.overlapCredits} credit hours here also count toward your BSBA or specialization ({result.overlapCodes.join(', ')}).
              Fisher requires at least 12 credit hours in the minor that don&apos;t overlap with your major, so you&apos;d need extra
              minor courses. Check with your advisor.
            </span>
          </div>
        )}
        {minor.notes && <p className="text-xs text-gray-600">{minor.notes}</p>}

        {result.eligible && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() =>
                onAsk(
                  `How would the ${minor.name} fit with my plan? I still need: ${remaining.join('; ') || 'nothing; it looks complete'}.`,
                )
              }
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded border border-gray-300 bg-white hover:border-[#ba0c2f] hover:text-[#ba0c2f]"
            >
              <MessageSquare className="w-3.5 h-3.5" /> Ask BuckAI about this minor
            </button>
            <button
              onClick={() =>
                onAddToPlan(
                  `Add the ${minor.name} to my plan: schedule its remaining requirements (${remaining.join('; ') || 'none'}) in my planned terms without delaying graduation, respecting prerequisites.`,
                )
              }
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded bg-gray-900 hover:bg-black text-white"
            >
              <CalendarPlus className="w-3.5 h-3.5" /> Add to my 4-year plan
            </button>
            <button
              onClick={() => onDeclare(`I want to declare the ${minor.name} as my real choice on my official university record.`)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded bg-[#ba0c2f] hover:bg-[#9d0a27] text-white"
            >
              <ShieldAlert className="w-3.5 h-3.5" /> Declare as real choice
            </button>
          </div>
        )}

        <div className="grid gap-3 lg:grid-cols-2">
          {result.progress.groups.map((g) => (
            <GroupCard key={g.group.id} g={g} />
          ))}
        </div>
      </div>
    </div>
  );
};
