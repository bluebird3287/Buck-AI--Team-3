import React, { useState } from 'react';
import { CheckCircle2, Clock, CalendarClock, Circle, AlertTriangle, HelpCircle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { DegreeAudit, GroupProgress, ItemState, ProgramProgress, entryWindowLabel, geExamples, termLabel } from '../lib/requirements';

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
  if (g.group.kind === 'ge') return g.state === 'missing' ? `${g.group.min_credits ?? 3}+ credit hours` : `${g.creditsCounted} credit hours`;
  if (g.group.kind === 'choose_credits') return `${g.creditsCounted} of ${g.creditsNeeded} credit hours`;
  return `${g.coursesCounted} of ${g.coursesNeeded} ${g.coursesNeeded === 1 ? 'course' : 'courses'}`;
}

// A section that opens and closes: the header always shows what's inside and how it's going.
export const Dropdown: React.FC<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  defaultOpen?: boolean;
  tone?: 'plain' | 'danger' | 'warning';
  level?: 'program' | 'group';
  children: React.ReactNode;
}> = ({ title, subtitle, right, defaultOpen = false, tone = 'plain', level = 'group', children }) => {
  const [open, setOpen] = useState(defaultOpen);
  const frame =
    tone === 'danger' ? 'bg-red-50 border-red-200' : tone === 'warning' ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200';
  return (
    <div className={`border rounded-lg ${frame}`}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={`w-full flex items-center justify-between gap-3 text-left ${level === 'program' ? 'px-4 py-3.5' : 'px-4 py-3'}`}
      >
        <div className="min-w-0">
          <div className={level === 'program' ? 'text-base font-bold text-gray-900' : 'text-sm font-bold text-gray-900'}>{title}</div>
          {subtitle && <div className="text-xs text-gray-500 mt-0.5">{subtitle}</div>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {right}
          {open ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </div>
      </button>
      {open && <div className={`px-4 pb-4 space-y-3 ${level === 'program' ? 'border-t border-gray-100 pt-3' : ''}`}>{children}</div>}
    </div>
  );
};

// collapsible: shown as a closed dropdown row (Degree Requirements); otherwise an open card (What-If Minor).
export const GroupCard: React.FC<{ g: GroupProgress; collapsible?: boolean }> = ({ g, collapsible = false }) => {
  const [showOptions, setShowOptions] = useState(false);
  const counted = new Set(g.items.map((i) => i.code));
  const options = g.group.kind === 'all' ? [] : g.group.courses.filter((c) => !counted.has(c.code));

  const body = (
    <>
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
                {item.notes && (item.viaEquivalent || g.group.kind === 'ge' || /waive|replaces/i.test(item.notes)) && (
                  <span className="block text-amber-700 mt-0.5">{item.notes}</span>
                )}
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
                  {c.offered_terms?.includes('None') ? (
                    <span className="block text-gray-500">Not on the Autumn 2026 / Spring 2027 schedule</span>
                  ) : c.offered_terms?.length ? (
                    <span className="block text-gray-500">{c.offered_terms.join('/')} only</span>
                  ) : null}
                  {c.notes && <span className="block text-gray-500">{c.notes}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {g.group.kind === 'ge' && g.state === 'missing' && (
        <div className="text-xs text-gray-600">
          <p className="font-semibold text-gray-700">Some Autumn 2026 / Spring 2027 courses that count:</p>
          <ul className="mt-1 list-disc pl-4 space-y-0.5">
            {geExamples(g.group.ge_category ?? '', 5).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          <a href="https://classes.osu.edu" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-1 text-[#ba0c2f] hover:underline">
            Search all GEN courses on Class Search <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
      {g.group.code_pattern && g.state === 'missing' && (
        <p className="text-xs text-gray-500">Any matching course counts; ask BuckAI for suggestions.</p>
      )}
    </>
  );

  if (collapsible)
    return (
      <Dropdown title={g.group.title} subtitle={progressText(g)} right={<Badge state={g.state} />}>
        {body}
        {!g.group.notes && !g.items.length && !options.length && g.group.kind !== 'ge' && !g.group.code_pattern && (
          <p className="text-xs text-gray-500">Nothing to list here; your advisor confirms this one.</p>
        )}
      </Dropdown>
    );

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="font-bold text-sm text-gray-900">{g.group.title}</h4>
          <p className="text-xs text-gray-500 mt-0.5">{progressText(g)}</p>
        </div>
        <Badge state={g.state} />
      </div>
      {body}
    </div>
  );
};

const ProgramSection: React.FC<{ p: ProgramProgress }> = ({ p }) => {
  const tracked = p.groups.filter((g) => g.state !== 'manual');
  const met = tracked.filter((g) => g.state === 'done').length;
  const pct = tracked.length ? Math.round((met / tracked.length) * 100) : 0;
  return (
    <Dropdown
      level="program"
      title={p.program.name}
      subtitle={p.program.catalog}
      right={
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span className="whitespace-nowrap">
            {met} of {tracked.length} complete
          </span>
          <span className="hidden sm:block w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <span className="block h-full bg-[#ba0c2f]" style={{ width: `${pct}%` }} />
          </span>
        </div>
      }
    >
      {(p.program.notes || p.program.source_url) && (
        <div className="flex flex-wrap items-start justify-between gap-2 text-xs text-gray-600">
          {p.program.notes && <p className="flex-1 min-w-[200px]">{p.program.notes}</p>}
          {p.program.source_url && (
            <a href={p.program.source_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[#ba0c2f] hover:underline shrink-0">
              Official source <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}
      <div className="space-y-2">
        {p.groups.map((g) => (
          <GroupCard key={g.group.id} g={g} collapsible />
        ))}
      </div>
    </Dropdown>
  );
};

interface DegreeRequirementsViewProps {
  audit: DegreeAudit | null;
  onAskForPlan: () => void;
}

export const DegreeRequirementsView: React.FC<DegreeRequirementsViewProps> = ({ audit, onAskForPlan }) => {
  if (!audit) {
    return <div className="p-6 text-sm text-gray-600">Loading degree requirements…</div>;
  }
  const { credits } = audit;
  const pct = Math.min(100, Math.round(((credits.earned + credits.inProgress) / credits.required) * 100));
  const plannedPct = Math.min(100 - pct, Math.round((credits.planned / credits.required) * 100));

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 bg-[#f8fafc]">
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-gray-900">Degree requirements check</h3>
            <p className="text-xs text-gray-600">
              Your classes checked against the published requirements for {audit.degree.program.name}. Your advisor and official degree audit have the final word.
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {audit.entryTerm ? (
                <>
                  Entered Ohio State <strong>{termLabel(audit.entryTerm)}</strong> · using the version for {entryWindowLabel(audit.degree.program)}
                </>
              ) : (
                <>Add the term you entered Ohio State under <strong>My classes</strong> so BuckAI uses your class&apos;s requirements.</>
              )}
              {audit.specialPrograms.length > 0 && <> · Special programs: {audit.specialPrograms.map((p) => p.program.name).join(', ')}</>}
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
        {audit.specializationGpas.map((g) => (
          <p key={g.name} className="text-xs text-gray-600">
            {g.name} GPA so far: <strong>{g.gpa.toFixed(2)}</strong> (Fisher requires 2.00)
          </p>
        ))}
        {[...audit.cohortNotes, ...audit.specialProgramWarnings].map((n) => (
          <p key={n} className="text-xs text-amber-800 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {n}
          </p>
        ))}
        {audit.sharedCourses.length > 0 && (
          <p className="text-xs text-amber-800">
            {audit.sharedCourses.join(', ')} {audit.sharedCourses.length === 1 ? 'counts' : 'count'} toward more than one of your
            specializations. Confirm with your advisor that a course can count for both.
          </p>
        )}
      </div>

      {audit.prereqWarnings.length > 0 && (
        <Dropdown
          tone="danger"
          title={
            <span className="flex items-center gap-1.5 text-[#ba0c2f]">
              <AlertTriangle className="w-4 h-4" /> Prerequisite issues in your plan
            </span>
          }
          right={<span className="text-xs font-semibold text-[#ba0c2f]">{audit.prereqWarnings.length}</span>}
        >
          {audit.prereqWarnings.map((w) => (
            <p key={w.code + w.term} className="text-xs text-red-900">
              <strong>{w.code}</strong> ({w.term}) needs {w.missing.join('; ')} completed in an earlier term.
            </p>
          ))}
        </Dropdown>
      )}

      {audit.scheduleWarnings.length > 0 && (
        <Dropdown
          tone="warning"
          title={
            <span className="flex items-center gap-1.5 text-amber-900">
              <AlertTriangle className="w-4 h-4" /> Timing issues in your plan
            </span>
          }
          right={<span className="text-xs font-semibold text-amber-900">{audit.scheduleWarnings.length}</span>}
        >
          {audit.scheduleWarnings.map((w) => (
            <p key={w.code + w.term + w.message} className={`text-xs ${w.blocking ? 'text-red-900' : 'text-amber-900'}`}>
              {w.blocking ? '' : 'Note: '}
              {w.message}
            </p>
          ))}
        </Dropdown>
      )}

      {audit.specializations.length ? (
        audit.specializations.map((p) => <ProgramSection key={p.program.id} p={p} />)
      ) : audit.specializationOptions ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
          Choose your specialization under <strong>My classes</strong> to see its requirements.
        </div>
      ) : null}
      {audit.specialPrograms.map((p) => (
        <ProgramSection key={p.program.id} p={p} />
      ))}
      <ProgramSection p={audit.degree} />
    </div>
  );
};
