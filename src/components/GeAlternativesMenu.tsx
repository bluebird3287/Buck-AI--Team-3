import React, { useMemo, useState } from 'react';
import { Check, Search, Wifi } from 'lucide-react';
import { ChoiceSlot, DegreeAudit, ElectiveSlot, GeOption, GeSlot, choiceAlternatives, electiveOptions, geAlternatives } from '../lib/requirements';
import { onlineInSummer } from '../lib/onlineCourses';

interface GeAlternativesMenuProps {
  slot: GeSlot | ChoiceSlot | ElectiveSlot;
  audit?: DegreeAudit | null; // needed for an ELECTIVE slot
  current: string; // the planned course's code
  term: string; // the planned term, e.g. 'Spring 2028'
  inPlan: string[]; // codes already in the plan, which can't be picked again
  onPick: (option: GeOption) => void;
}

// Opens under a planned course in the 4-Year Plan: every course that fills the same requirement, with the ones
// offered in that term's season (or online, for summers) first. A GE slot lists the registrar's GEN-tagged courses;
// a major/specialization choice (ChoiceSlot) lists that requirement group's courses and pattern matches.
const isChoice = (slot: GeSlot | ChoiceSlot | ElectiveSlot): slot is ChoiceSlot => 'group' in slot;
const isElective = (slot: GeSlot | ChoiceSlot | ElectiveSlot): slot is ElectiveSlot => 'electives' in slot;
export const GeAlternativesMenu: React.FC<GeAlternativesMenuProps> = ({ slot, audit, current, term, inPlan, onPick }) => {
  const [query, setQuery] = useState('');
  const season = term.split(' ')[0];
  const isSummer = season === 'Summer';

  const options = useMemo(() => {
    const others = inPlan.filter((c) => c !== current);
    const all = isElective(slot)
      ? electiveOptions(audit ?? null, others)
      : isChoice(slot)
      ? choiceAlternatives(slot, others)
      : geAlternatives(slot, others);
    const fits = (o: GeOption) => (isSummer ? onlineInSummer(o.code) : o.terms.some((t) => t.startsWith(season)));
    // Electives keep their requirement order (unfinished first); within it, this term's season first
    if (isElective(slot)) return all.slice().sort((a, b) => Number(!fits(a)) - Number(!fits(b)));
    return [...all.filter(fits), ...all.filter((o) => !fits(o))];
  }, [slot, audit, current, inPlan, season, isSummer]);

  const q = query.trim().toLowerCase();
  const shown = q ? options.filter((o) => `${o.code} ${o.title} ${o.group ?? ''}`.toLowerCase().includes(q)) : options;

  const choice = isChoice(slot) || isElective(slot);
  return (
    <div className="mt-1.5 rounded-lg border border-[#ba0c2f]/30 bg-white shadow-md text-xs" role="listbox" aria-label={`${slot.label} alternatives`}>
      <div className="px-3 pt-2.5 pb-2 border-b border-gray-100">
        <div className="font-semibold text-gray-900">
          {isElective(slot)
            ? `Electives for your major and minor: ${options.length} course${options.length === 1 ? '' : 's'}`
            : `${choice ? slot.label : `GE ${slot.label}`}: ${options.length} course${options.length === 1 ? '' : 's'} fill this requirement`}
        </div>
        {isChoice(slot) && slot.group.notes && <div className="mt-1 text-[10px] text-gray-500 line-clamp-2">{slot.group.notes}</div>}
        {isElective(slot) && <div className="mt-1 text-[10px] text-gray-500">Each option shows which requirement it would fill; ones you still need come first.</div>}
        <label className="mt-2 flex items-center gap-2 px-2 py-1.5 border border-gray-300 rounded-md focus-within:ring-2 focus-within:ring-[#ba0c2f]">
          <Search className="w-3.5 h-3.5 text-gray-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by code or title"
            className="flex-1 outline-none text-xs"
          />
        </label>
      </div>
      <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
        {shown.map((o) => {
          const selected = o.code === current;
          const offered = o.terms.map((t) => t.split(' ')[0]);
          const online = onlineInSummer(o.code);
          return (
            <button
              key={o.code}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => onPick(o)}
              className={`w-full text-left px-3 py-2 flex items-start justify-between gap-3 hover:bg-red-50 ${selected ? 'bg-red-50' : ''}`}
            >
              <div className="min-w-0">
                <div className="font-bold text-gray-900 flex items-center gap-1.5">
                  {selected && <Check className="w-3.5 h-3.5 text-[#ba0c2f]" />}
                  {o.code}
                </div>
                <div className="text-gray-600 text-[11px] truncate">{o.title}</div>
                {o.group && <div className="text-[10px] text-[#ba0c2f] truncate">{o.group}</div>}
              </div>
              <div className="text-right shrink-0">
                <div className="font-medium text-gray-700">{o.credits ?? '?'} cr</div>
                <div className="text-[10px] text-gray-500 flex items-center justify-end gap-1">
                  {online && (
                    <span className="inline-flex items-center gap-0.5 text-emerald-700" title="Offered fully online in Summer 2026">
                      <Wifi className="w-3 h-3" /> Online
                    </span>
                  )}
                  <span>{offered.length ? offered.join(' / ') : 'Not on current schedule'}</span>
                </div>
              </div>
            </button>
          );
        })}
        {!shown.length && <div className="px-3 py-3 text-gray-500">No courses match "{query}".</div>}
      </div>
      <div className="px-3 py-2 border-t border-gray-100 text-[10px] text-gray-500">
        {choice
          ? "From your program's requirement list and OSU Class Search (Autumn 2026 / Spring 2027). Confirm electives with your advisor."
          : "From the registrar's GEN tags (Autumn 2026 / Spring 2027 schedules). Confirm in your Buckeye Degree Planner."}
      </div>
    </div>
  );
};
