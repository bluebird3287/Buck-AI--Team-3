import React, { useState } from 'react';
import { CheckCircle2, Clock, CalendarClock, Circle, AlertTriangle, HelpCircle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { DegreeAudit, GroupProgress, ItemState, ProgramProgress } from '../lib/requirements';

const STATE_STYLE: Record<ItemState | 'manual', { label: string; cls: string; Icon: React.FC<{ className?: string }> }> = {
  done: { label: 'Complete', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200', Icon: CheckCircle2 },
  in_progress: { label: 'In progress', cls: 'bg-blue-50 text-blue-800 border-blue-200', Icon: Clock },
  planned: { label: 'Planned', cls: 'bg-amber-50 text-amber-800 border-amber-200', Icon: CalendarClock },
  missing: { label: 'Not met', cls: 'bg-red-50 text-[#ba0c2f] border-red-200', Icon: Circle },
  manual: { label: 'Confirm with advisor', cls: 'bg-gray-50 text-gray-700 border-gray-200', Icon: HelpCircle },
};

export const Badge: React.FC<{ state: ItemState | 'manual' }> = ({ state }) => {
  const { label, cls, Icon } = STATE_STYLE[state];
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border ${cls}`}>
      <Icon className="w-3 h-3" /> {label}
    </span>
  );
};

function progressText(g: GroupProgress): string {
  if (g.state === 'manual') return g.group.min_credits ? `${g.group.min_credits}+ credit hours` : '';
  if (g.group.kind === 'choose_credits') return `${g.creditsCounted} of ${g.creditsNeeded} credit hours`;
  return `${g.coursesCounted} of ${g.coursesNeeded} ${g.coursesNeeded === 1 ? 'course' : 'courses'}`;
}

export const GroupCard: React.FC<{ g: GroupProgress }> = ({ g }) => {
  const [showOptions, setShowOptions] = useState(false);
  const counted = new Set(g.items.map((i) => i.code));
  const options = g.group.kind === 'all' ? [] : g.group.courses.filter((c) => !counted.has(c.code));

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="font-bold text-sm text-gray-900">{g.group.title}</h4>
          <p className="text-xs text-gray-500 mt-0.5">{progressText(g)}</p>
        </div>
        <Badge state={g.state} />
      </div>
      {g.group.notes && <p className="text-xs text-gray-600">{g.group.notes}</p>}

      {g.items.length > 0 && (
        <ul className="space-y-1.5">
          {g.items.map((item) => (
            <li key={item.code + (item.takenAs ?? '')} className="flex flex-wrap items-center justify-between gap-2 text-xs bg-gray-50 border border-gray-100 rounded px-3 py-2">
              <span>
                <strong className="text-gray-900">{item.code}</strong>
                <span className="text-gray-600"> · {item.title}</span>
                {item.credits != null && <span className="text-gray-500"> · {item.credits} cr</span>}
                {item.takenAs && <span className="text-gray-500"> · taken as {item.takenAs}</span>}
                {item.term && <span className="text-gray-500"> · {item.term}</span>}
                {item.issue && <span className="block text-[#ba0c2f] mt-0.5">{item.issue}</span>}
                {item.viaEquivalent && <span className="block text-amber-700 mt-0.5">{item.notes}</span>}
              </span>
              <Badge state={item.state} />
            </li>
          ))}
        </ul>
      )}

      {options.length > 0 && (
        <div>
          <button
            onClick={() => setShowOptions(!showOptions)}
            className="text-xs font-semibold text-[#ba0c2f] flex items-center gap-1"
          >
            {showOptions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {g.state === 'done' || g.state === 'in_progress' || g.state === 'planned' ? 'Other approved courses' : 'Approved courses to choose from'} ({options.length})
          </button>
          {showOptions && (
            <ul className="mt-2 grid sm:grid-cols-2 gap-1.5">
              {options.map((c) => (
                <li key={c.code} className="text-xs border border-gray-100 rounded px-3 py-1.5" title={c.prerequisites ?? ''}>
                  <strong>{c.code}</strong> <span className="text-gray-600">{c.title}</span>
                  {c.credits != null && <span className="text-gray-500"> · {c.credits} cr</span>}
                  {c.notes && <span className="block text-gray-500">{c.notes}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {g.group.code_pattern && g.state === 'missing' && (
        <p className="text-xs text-gray-500">Any matching course counts; ask BuckAI for suggestions.</p>
      )}
    </div>
  );
};

const ProgramSection: React.FC<{ p: ProgramProgress }> = ({ p }) => {
  const tracked = p.groups.filter((g) => g.state !== 'manual');
  const met = tracked.filter((g) => g.state === 'done').length;
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-gray-900">{p.program.name}</h3>
          <p className="text-xs text-gray-500">{p.program.catalog}</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-600">
          <span>{met} of {tracked.length} requirements complete</span>
          {p.program.source_url && (
            <a href={p.program.source_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[#ba0c2f] hover:underline">
              Fisher source <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
      {p.program.notes && <p className="text-xs text-gray-600">{p.program.notes}</p>}
      <div className="grid gap-3 lg:grid-cols-2">
        {p.groups.map((g) => (
          <GroupCard key={g.group.id} g={g} />
        ))}
      </div>
    </section>
  );
};

interface DegreeRequirementsViewProps {
  audit: DegreeAudit | null;
  onAskForPlan: () => void;
}

export const DegreeRequirementsView: React.FC<DegreeRequirementsViewProps> = ({ audit, onAskForPlan }) => {
  if (!audit) {
    return <div className="p-6 text-sm text-gray-600">Loading Fisher requirements…</div>;
  }
  const { credits } = audit;
  const pct = Math.min(100, Math.round(((credits.earned + credits.inProgress) / credits.required) * 100));
  const plannedPct = Math.min(100 - pct, Math.round((credits.planned / credits.required) * 100));

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#f8fafc]">
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-gray-900">Degree requirements check</h3>
            <p className="text-xs text-gray-600">
              Your classes checked against Fisher&apos;s published BSBA requirements. Your advisor and official degree audit have the final word.
            </p>
          </div>
          <button onClick={onAskForPlan} className="bg-[#ba0c2f] hover:bg-[#9d0a27] text-white text-xs font-semibold px-3 py-2 rounded">
            Plan my remaining requirements
          </button>
        </div>
        <div>
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>
              {credits.earned} earned + {credits.inProgress} in progress + {credits.planned} planned
            </span>
            <span>{credits.required} credit hours required</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden flex">
            <div className="bg-[#ba0c2f] h-full" style={{ width: `${pct}%` }} />
            <div className="bg-amber-300 h-full" style={{ width: `${plannedPct}%` }} />
          </div>
        </div>
        {audit.specializationGpa != null && (
          <p className="text-xs text-gray-600">
            Specialization GPA so far: <strong>{audit.specializationGpa.toFixed(2)}</strong> (Fisher requires 2.00)
          </p>
        )}
      </div>

      {audit.prereqWarnings.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-1.5">
          <h4 className="font-bold text-sm text-[#ba0c2f] flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" /> Prerequisite issues in your plan
          </h4>
          {audit.prereqWarnings.map((w) => (
            <p key={w.code + w.term} className="text-xs text-red-900">
              <strong>{w.code}</strong> ({w.term}) needs {w.missing.join('; ')} completed in an earlier term.
            </p>
          ))}
        </div>
      )}

      {audit.specialization ? (
        <ProgramSection p={audit.specialization} />
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
          Choose your Fisher specialization under <strong>My classes</strong> to see its major core requirements.
        </div>
      )}
      <ProgramSection p={audit.degree} />
    </div>
  );
};
