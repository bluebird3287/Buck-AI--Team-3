import React, { useMemo, useState } from 'react';
import { CalendarCheck, CheckCircle2, Clock, Sun, X } from 'lucide-react';
import { Semester } from '../data/sampleData';
import {
  PlanTerms,
  Season,
  academicYearOf,
  firstAcademicYear,
  futureTerms,
  parseTerm,
  termKey,
} from '../lib/studentProfile';

interface TermPlanModalProps {
  roadmap: Semester[];
  initial: PlanTerms;
  onConfirm: (plan: PlanTerms) => void;
  onCancel: () => void;
}

const SEASONS: Season[] = ['Autumn', 'Spring', 'Summer'];

// Asked before BuckAI builds a 4-year plan: which terms are done, which future terms
// (Autumn, Spring, Summer of each year) the student wants classes in, and how many classes
// (and whether only online ones) they want in their summers.
export const TermPlanModal: React.FC<TermPlanModalProps> = ({ roadmap, initial, onConfirm, onCancel }) => {
  const [terms, setTerms] = useState<Set<string>>(new Set(initial.terms));
  const [graduation, setGraduation] = useState(initial.graduation);
  const [summerMax, setSummerMax] = useState<number | null>(initial.summerMaxCourses ?? null);
  const [summerOnline, setSummerOnline] = useState(!!initial.summerOnline);

  const future = useMemo(() => futureTerms(roadmap), [roadmap]);
  const futureById = useMemo(() => new Map(future.map((t) => [t.id, t])), [future]);
  const first = firstAcademicYear(roadmap);
  const taken = new Map(roadmap.filter((s) => s.status !== 'planned' && s.courses.length).map((s) => [s.id, s]));
  const grad = parseTerm({ id: graduation });
  const gradKey = grad ? termKey(grad.season, grad.year) : Infinity;
  const lastYear = grad ? academicYearOf(grad.season, grad.year) : first + 3;

  const years = [];
  for (let ay = first; ay <= Math.max(lastYear, first + 3); ay++) years.push(ay);

  const toggle = (id: string) =>
    setTerms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const setSummers = (on: boolean) =>
    setTerms((prev) => {
      const next = new Set(prev);
      for (const t of future) if (t.season === 'Summer') (on ? next.add(t.id) : next.delete(t.id));
      return next;
    });

  const chosen = future.filter((t) => terms.has(t.id) && termKey(t.season, t.year) <= gradKey);
  const chosenCount = chosen.length;
  const hasSummer = chosen.some((t) => t.season === 'Summer');

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="term-plan-title">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-200">
          <div>
            <h2 id="term-plan-title" className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-[#ba0c2f]" /> Plan your terms
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Before BuckAI builds your 4-year plan, check the terms you want to take classes in. BuckAI will only schedule
              classes in the terms you check.
            </p>
          </div>
          <button onClick={onCancel} className="p-1 text-gray-500 hover:text-gray-900" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              Graduate in
              <select
                value={graduation}
                onChange={(e) => setGraduation(e.target.value)}
                className="text-sm px-2 py-1.5 border border-gray-300 rounded-md"
              >
                {future.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </label>
            <div className="flex gap-2 text-xs">
              <button onClick={() => setSummers(false)} className="px-2.5 py-1 rounded border border-gray-300 hover:border-[#ba0c2f]">
                No summers
              </button>
              <button onClick={() => setSummers(true)} className="px-2.5 py-1 rounded border border-gray-300 hover:border-[#ba0c2f]">
                Include summers
              </button>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="grid grid-cols-4 bg-gray-50 text-xs font-semibold text-gray-600 border-b border-gray-200">
              <div className="p-2">Year</div>
              {SEASONS.map((s) => (
                <div key={s} className="p-2">{s}</div>
              ))}
            </div>
            {years.map((ay, i) => (
              <div key={ay} className="grid grid-cols-4 border-b border-gray-100 last:border-b-0 text-sm">
                <div className="p-2 text-gray-700">
                  <div className="font-semibold">Year {i + 1}</div>
                  <div className="text-[11px] text-gray-500">{ay}–{String((ay + 1) % 100).padStart(2, '0')}</div>
                </div>
                {SEASONS.map((season) => {
                  const year = season === 'Autumn' ? ay : ay + 1;
                  const id = `${season.toLowerCase()}-${year}`;
                  const done = taken.get(id);
                  const option = futureById.get(id);
                  if (done) {
                    return (
                      <div key={id} className="p-2 text-xs">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded border ${
                            done.status === 'completed'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-blue-50 text-blue-800 border-blue-200'
                          }`}
                        >
                          {done.status === 'completed' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {done.status === 'completed' ? 'Completed' : 'In progress'}
                        </span>
                      </div>
                    );
                  }
                  if (!option) return <div key={id} className="p-2 text-xs text-gray-400">—</div>;
                  const afterGrad = termKey(season, year) > gradKey;
                  return (
                    <label key={id} className={`p-2 flex items-center gap-2 text-xs ${afterGrad ? 'text-gray-400' : 'text-gray-800 cursor-pointer'}`}>
                      <input
                        type="checkbox"
                        checked={terms.has(id) && !afterGrad}
                        disabled={afterGrad}
                        onChange={() => toggle(id)}
                        className="accent-[#ba0c2f] w-4 h-4"
                      />
                      {season} {year}
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
          {hasSummer && (
            <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 space-y-2">
              <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Sun className="w-4 h-4 text-amber-600" /> Summer classes
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-gray-800">
                <label className="flex items-center gap-2">
                  At most
                  <select
                    value={summerMax ?? ''}
                    onChange={(e) => setSummerMax(e.target.value ? Number(e.target.value) : null)}
                    className="text-sm px-2 py-1 border border-gray-300 rounded-md bg-white"
                  >
                    <option value="">any number of</option>
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                  {summerMax === 1 ? 'class' : 'classes'} each summer
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={summerOnline}
                    onChange={(e) => setSummerOnline(e.target.checked)}
                    className="accent-[#ba0c2f] w-4 h-4"
                  />
                  Online classes only
                </label>
              </div>
              {summerOnline && (
                <p className="text-xs text-gray-600">
                  BuckAI picks classes that were offered fully online last summer (Summer 2026). Confirm in Class Search once the
                  next summer schedule is posted.
                </p>
              )}
            </div>
          )}

          <p className="text-xs text-gray-500">
            Terms after your graduation term are greyed out. Fisher's BSBA needs 121 credit hours, so fewer terms means heavier ones.
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 p-5 border-t border-gray-200 bg-gray-50">
          <span className="text-sm text-gray-600">{chosenCount} terms selected</span>
          <div className="flex gap-2">
            <button onClick={onCancel} className="px-4 py-2 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50">
              Cancel
            </button>
            <button
              disabled={chosenCount === 0}
              onClick={() =>
                onConfirm({
                  terms: chosen.map((t) => t.id),
                  graduation,
                  summerMaxCourses: hasSummer ? summerMax : null,
                  summerOnline: hasSummer && summerOnline,
                })
              }
              className="px-4 py-2 text-sm font-semibold rounded-md bg-[#ba0c2f] hover:bg-[#9d0a27] disabled:bg-gray-300 text-white"
            >
              Build my plan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
