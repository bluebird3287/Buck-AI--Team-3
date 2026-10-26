import React, { useState } from 'react';
import { Plus, Trash2, Loader2, X } from 'lucide-react';
import { Semester } from '../data/sampleData';
import {
  StudentRecord,
  SEASONS,
  Season,
  CURRENT_TERM,
  termId,
  parseTerm,
  termStatus,
  newCourse,
  normalizeSemesters,
} from '../lib/studentProfile';

const COLLEGES = [
  'Fisher College of Business',
  'College of Arts and Sciences',
  'College of Engineering',
  'College of Education and Human Ecology',
  'College of Food, Agricultural, and Environmental Sciences',
  'College of Nursing',
  'College of Public Health',
  'College of Social Work',
  'John Glenn College of Public Affairs',
  'Other',
];

const STANDINGS = ['Freshman (Year 1)', 'Sophomore (Year 2)', 'Junior (Year 3)', 'Senior (Year 4)', 'Senior (Year 5+)'];

const YEARS = Array.from({ length: 9 }, (_, i) => CURRENT_TERM.year - 5 + i);

interface MyClassesEditorProps {
  initial: StudentRecord | null;
  onSave: (record: StudentRecord) => Promise<void>;
  onCancel?: () => void;
}

// First-run setup and the "My classes" editor. Students type in the classes they
// already have, since the prototype isn't connected to BuckeyeLink.
export const MyClassesEditor: React.FC<MyClassesEditorProps> = ({ initial, onSave, onCancel }) => {
  const [fullName, setFullName] = useState(initial?.full_name ?? '');
  const [major, setMajor] = useState(initial?.major ?? '');
  const [minor, setMinor] = useState(initial?.minor ?? '');
  const [college, setCollege] = useState(initial?.college ?? '');
  const [standing, setStanding] = useState(initial?.class_standing ?? '');
  const [gpa, setGpa] = useState(initial?.gpa != null ? String(initial.gpa) : '');
  const [semesters, setSemesters] = useState<Semester[]>(
    normalizeSemesters(initial?.semesters ?? []).filter((s) => parseTerm(s)),
  );

  const [newSeason, setNewSeason] = useState<Season>(CURRENT_TERM.season);
  const [newYear, setNewYear] = useState<number>(CURRENT_TERM.year);
  const [drafts, setDrafts] = useState<Record<string, { code: string; name: string; credits: string; grade: string }>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFirstRun = !initial;

  const addTerm = () => {
    const id = termId(newSeason, newYear);
    if (semesters.some((s) => s.id === id)) return;
    const added: Semester = {
      id,
      name: `${newSeason} ${newYear}`,
      status: termStatus(newSeason, newYear),
      courses: [],
      totalCredits: 0,
      workloadRating: 'Light',
    };
    setSemesters((prev) => normalizeSemesters([...prev, added]));
  };

  const draftFor = (id: string) => drafts[id] ?? { code: '', name: '', credits: '3', grade: '' };
  const setDraft = (id: string, patch: Partial<ReturnType<typeof draftFor>>) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...draftFor(id), ...patch } }));

  const addCourse = (sem: Semester) => {
    const d = draftFor(sem.id);
    if (!d.code.trim()) return;
    const course = newCourse(d.code, d.name, Number(d.credits) || 0, d.grade.trim() || undefined);
    setSemesters((prev) => prev.map((s) => (s.id === sem.id ? { ...s, courses: [...s.courses, course] } : s)));
    setDrafts((prev) => ({ ...prev, [sem.id]: { code: '', name: '', credits: '3', grade: '' } }));
  };

  const removeCourse = (semId: string, idx: number) =>
    setSemesters((prev) => prev.map((s) => (s.id === semId ? { ...s, courses: s.courses.filter((_, i) => i !== idx) } : s)));

  const removeTerm = (semId: string) => setSemesters((prev) => prev.filter((s) => s.id !== semId));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!fullName.trim() || !major.trim()) {
      setError('Please enter your name and major.');
      return;
    }
    const gpaNum = gpa.trim() ? Number(gpa) : null;
    if (gpaNum != null && (Number.isNaN(gpaNum) || gpaNum < 0 || gpaNum > 4)) {
      setError('GPA must be between 0.00 and 4.00.');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        full_name: fullName.trim(),
        major: major.trim(),
        minor: minor.trim() || null,
        college: college || null,
        class_standing: standing || null,
        gpa: gpaNum,
        semesters,
      });
    } catch (err: any) {
      setError(err?.message || 'Could not save. Please try again.');
      setSaving(false);
    }
  };

  const inputCls =
    'w-full text-sm px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#ba0c2f] focus:border-transparent';

  return (
    <div className="min-h-screen bg-[#f6f7f9] py-8 px-4">
      <form onSubmit={handleSave} className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-medium text-gray-900">
              {isFirstRun ? 'Set up your BuckAI profile' : 'My profile & classes'}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              BuckAI isn&apos;t connected to BuckeyeLink yet, so add the classes you&apos;ve taken, are taking now, or
              plan to take. Only you can see this. Don&apos;t enter your OSU password or student ID.
            </p>
          </div>
          {onCancel && (
            <button type="button" onClick={onCancel} className="p-1.5 text-gray-500 hover:text-gray-900" title="Close">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-medium text-gray-900">About you</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="text-xs font-semibold text-gray-700 space-y-1">
              <span>Name you go by *</span>
              <input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Alex" />
            </label>
            <label className="text-xs font-semibold text-gray-700 space-y-1">
              <span>Major *</span>
              <input className={inputCls} value={major} onChange={(e) => setMajor(e.target.value)} placeholder="e.g. Finance (BSBA)" />
            </label>
            <label className="text-xs font-semibold text-gray-700 space-y-1">
              <span>Minor</span>
              <input className={inputCls} value={minor} onChange={(e) => setMinor(e.target.value)} placeholder="Optional" />
            </label>
            <label className="text-xs font-semibold text-gray-700 space-y-1">
              <span>College</span>
              <select className={inputCls} value={college} onChange={(e) => setCollege(e.target.value)}>
                <option value="">Select…</option>
                {COLLEGES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-gray-700 space-y-1">
              <span>Class standing</span>
              <select className={inputCls} value={standing} onChange={(e) => setStanding(e.target.value)}>
                <option value="">Select…</option>
                {STANDINGS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-gray-700 space-y-1">
              <span>Cumulative GPA</span>
              <input className={inputCls} value={gpa} onChange={(e) => setGpa(e.target.value)} inputMode="decimal" placeholder="Optional, e.g. 3.45" />
            </label>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium text-gray-900">Your classes</h2>
              <p className="text-xs text-gray-500 mt-0.5">Add a term, then add each class in it.</p>
            </div>
            <div className="flex items-center gap-2">
              <select className="text-sm px-2 py-2 border border-gray-300 rounded-md" value={newSeason} onChange={(e) => setNewSeason(e.target.value as Season)}>
                {SEASONS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <select className="text-sm px-2 py-2 border border-gray-300 rounded-md" value={newYear} onChange={(e) => setNewYear(Number(e.target.value))}>
                {YEARS.map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </select>
              <button type="button" onClick={addTerm} className="flex items-center gap-1 bg-gray-900 hover:bg-black text-white text-sm px-3 py-2 rounded-md">
                <Plus className="w-4 h-4" /> Add term
              </button>
            </div>
          </div>

          {semesters.length === 0 && (
            <div className="text-sm text-gray-500 border border-dashed border-gray-300 rounded-md p-6 text-center">
              No terms yet. Start with your current term ({CURRENT_TERM.season} {CURRENT_TERM.year}).
            </div>
          )}

          {semesters.map((sem) => {
            const d = draftFor(sem.id);
            const credits = sem.courses.reduce((sum, c) => sum + (Number(c.credits) || 0), 0);
            return (
              <div key={sem.id} className="border border-gray-200 rounded-md overflow-hidden">
                <div className="bg-gray-50 px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-gray-900">{sem.name}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded border border-gray-300 bg-white text-gray-600 capitalize">
                      {sem.status.replace('-', ' ')}
                    </span>
                    <span className="text-xs text-gray-500">{credits} credits</span>
                  </div>
                  <button type="button" onClick={() => removeTerm(sem.id)} className="text-gray-400 hover:text-[#ba0c2f]" title="Remove term">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-3 space-y-2">
                  {sem.courses.map((c, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm bg-white border border-gray-100 rounded px-3 py-1.5">
                      <span>
                        <strong>{c.code}</strong>
                        {c.name !== c.code && <span className="text-gray-600"> · {c.name}</span>}
                        <span className="text-gray-500"> · {c.credits} cr</span>
                        {c.notes && <span className="text-gray-500"> · {c.notes}</span>}
                      </span>
                      <button type="button" onClick={() => removeCourse(sem.id, idx)} className="text-gray-400 hover:text-[#ba0c2f]" title="Remove class">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <div className="grid grid-cols-12 gap-2">
                    <input className={`${inputCls} col-span-3`} placeholder="Code (CSE 2221)" value={d.code} onChange={(e) => setDraft(sem.id, { code: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCourse(sem); } }} />
                    <input className={`${inputCls} col-span-5`} placeholder="Class name (optional)" value={d.name} onChange={(e) => setDraft(sem.id, { name: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCourse(sem); } }} />
                    <input className={`${inputCls} col-span-1`} placeholder="Cr" inputMode="numeric" value={d.credits} onChange={(e) => setDraft(sem.id, { credits: e.target.value })} />
                    <input className={`${inputCls} col-span-2`} placeholder="Grade" value={d.grade} onChange={(e) => setDraft(sem.id, { grade: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCourse(sem); } }} />
                    <button type="button" onClick={() => addCourse(sem)} className="col-span-1 flex items-center justify-center bg-[#ba0c2f] hover:bg-[#9d0a27] text-white rounded-md" title="Add class">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {error && <div className="text-sm text-[#ba0c2f] bg-red-50 border border-red-200 rounded-md px-4 py-2">{error}</div>}

        <div className="flex justify-end gap-3">
          {onCancel && (
            <button type="button" onClick={onCancel} className="px-4 py-2 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50">
              Cancel
            </button>
          )}
          <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-md bg-[#ba0c2f] hover:bg-[#9d0a27] disabled:bg-gray-400 text-white">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isFirstRun ? 'Save and continue' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

