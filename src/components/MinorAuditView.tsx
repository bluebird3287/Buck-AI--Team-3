import React, { useMemo, useState } from 'react';
import { AlertTriangle, Ban, ExternalLink, MessageSquare, CalendarPlus, ShieldAlert } from 'lucide-react';
import { Semester } from '../data/sampleData';
import { Curriculum, DegreeAudit, auditMinor } from '../lib/requirements';
import { GroupCard } from './DegreeRequirementsView';

interface MinorAuditViewProps {
  curriculum: Curriculum | null;
  specializationIds: string[];
  roadmap: Semester[];
  audit: DegreeAudit | null;
  onAsk: (prompt: string) => void;
  onAddToPlan: (prompt: string) => void;
  onDeclare: (prompt: string) => void;
}

// Minors are listed in one section per college; any other college's minors go last
const MINOR_SECTIONS: { title: string; subtitle: string; college: string | null }[] = [
  { title: 'Business minors', subtitle: 'Fisher College of Business', college: 'Fisher College of Business' },
  { title: 'Engineering minors', subtitle: 'College of Engineering', college: 'College of Engineering' },
  { title: 'Other minors', subtitle: 'Other colleges', college: null },
];

// What-if audit for every minor BuckAI tracks (Fisher and College of Engineering), checked against the classes the student entered.
export const MinorAuditView: React.FC<MinorAuditViewProps> = ({
  curriculum,
  specializationIds,
  roadmap,
  audit,
  onAsk,
  onAddToPlan,
  onDeclare,
}) => {
  const minors = useMemo(
    () =>
      (curriculum?.minors ?? [])
        .map((minor) => ({ minor, result: auditMinor(minor, specializationIds, roadmap, audit) }))
        // Eligible minors first, then the ones the student is furthest along in
        .sort((a, b) => Number(b.result.eligible) - Number(a.result.eligible) || b.result.creditsCounted - a.result.creditsCounted),
    [curriculum, specializationIds, roadmap, audit],
  );
  // Which college's minors to show ('' = every college), then which minor
  const [college, setCollege] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sectionOf = (m: { college: string }) =>
    MINOR_SECTIONS.find((sec) => sec.college === m.college) ?? MINOR_SECTIONS[MINOR_SECTIONS.length - 1];
  const sections = MINOR_SECTIONS.map((sec) => ({ ...sec, minors: minors.filter(({ minor: m }) => sectionOf(m) === sec) })).filter(
    (sec) => sec.minors.length > 0,
  );
  const shown = college ? minors.filter(({ minor: m }) => sectionOf(m).title === college) : minors;
  const selected = shown.find((m) => m.minor.id === selectedId) ?? shown[0];
  // Eligible minors the student already has credit toward, best first
  const closest = shown.filter((m) => m.result.eligible && m.result.creditsCounted > 0).slice(0, 3);

  if (!curriculum) return <div className="p-6 text-sm text-gray-600">Loading minors…</div>;
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
          Every minor BuckAI tracks (Fisher and College of Engineering), checked against the classes you&apos;ve taken, are taking, and have
          planned. Minor courses need a C- or better and a 2.00 GPA across the minor.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <label className="text-xs font-semibold text-gray-700 space-y-1">
            <span>College</span>
            <select
              className="w-full text-sm px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#ba0c2f]"
              value={college}
              onChange={(e) => {
                setCollege(e.target.value);
                setSelectedId(null);
              }}
            >
              <option value="">All colleges ({minors.length} minors)</option>
              {sections.map((sec) => (
                <option key={sec.title} value={sec.title}>
                  {sec.subtitle} ({sec.minors.length})
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-gray-700 space-y-1">
            <span>Minor</span>
            <select
              className="w-full text-sm px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#ba0c2f]"
              value={selected.minor.id}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {sections
                .filter((sec) => !college || sec.title === college)
                .map((sec) => (
                  <optgroup key={sec.title} label={sec.subtitle}>
                    {sec.minors.map(({ minor: m, result: r }) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                        {r.eligible ? ` · ${r.creditsCounted} of ${r.creditsRequired} cr on your plan` : ' · not available with your major'}
                      </option>
                    ))}
                  </optgroup>
                ))}
            </select>
          </label>
        </div>
        {closest.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-gray-500">Closest to done:</span>
            {closest.map(({ minor: m, result: r }) => (
              <button
                key={m.id}
                onClick={() => setSelectedId(m.id)}
                className={`px-2.5 py-1 rounded-full border ${
                  m.id === selected.minor.id ? 'border-[#ba0c2f] bg-red-50 text-[#ba0c2f]' : 'border-gray-300 text-gray-700 hover:border-gray-400'
                }`}
              >
                {m.name} · {r.creditsCounted}/{r.creditsRequired} cr
              </button>
            ))}
          </div>
        )}
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
              Official minor page <ExternalLink className="w-3 h-3" />
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
              {result.overlapCredits} credit hours here also count toward your major ({result.overlapCodes.join(', ')}).
              Ohio State requires at least 12 credit hours in the minor that don&apos;t overlap with your major, so you&apos;d need extra
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
