// Local-only harness: renders the real student App with a sample Fisher student, no sign-in.
import './shim';
import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LogOut, BookOpen } from 'lucide-react';
import App from '../src/App';
import { SignIn } from '../src/components/SignIn';
import { MyClassesEditor } from '../src/components/MyClassesEditor';
import { CurriculumLibrary, curriculumFor, loadCurriculum } from '../src/lib/requirements';
import { StudentRecord, normalizeSemesters, toStudentProfile } from '../src/lib/studentProfile';
import '../src/index.css';

const c = (code: string, credits = 3) => ({ code, name: code, credits, type: 'General' as const, difficulty: 3, prereqMet: true });
const record: StudentRecord = {
  full_name: 'Maya Thompson', major: 'Business Administration (BSBA)', minor: null, college: 'Fisher College of Business',
  class_standing: 'Junior', gpa: 3.42, degree_id: 'fisher-bsba', specialization_ids: [], entry_term: 'autumn-2024', expected_graduation: 'spring-2028',
  semesters: [
    { id: 'a24', name: 'Autumn 2024', status: 'completed', courses: [c('BUSADM 1100',1), c('ECON 2001.01'), c('MATH 1130',4), c('ENGLISH 1110.01'), c('PSYCH 1100',3)], totalCredits: 0, workloadRating: 'Balanced' },
    { id: 's25', name: 'Spring 2025', status: 'completed', courses: [c('ECON 2002.01'), c('MATH 1131',4), c('STAT 1450'), c('COMM 1100'), c('BUSMHR 2292')], totalCredits: 0, workloadRating: 'Balanced' },
    { id: 'a25', name: 'Autumn 2025', status: 'completed', courses: [c('ACCTMIS 2200'), c('BUSMHR 2290'), c('BUSMHR 2291'), c('SOCIOL 1101'), c('ASTRON 1101',4)], totalCredits: 0, workloadRating: 'Balanced' },
    { id: 's26', name: 'Spring 2026', status: 'completed', courses: [c('ACCTMIS 2300'), c('BUSFIN 3120'), c('BUSML 3150'), c('BUSMHR 2500'), c('HISTORY 2650')], totalCredits: 0, workloadRating: 'Balanced' },
    { id: 'a26', name: 'Autumn 2026', status: 'in-progress', courses: [c('BUSFIN 3220'), c('BUSFIN 4210'), c('BUSMGT 3230'), c('BUSML 3250'), c('ACCTMIS 3200')], totalCredits: 0, workloadRating: 'Balanced' },
  ] as any,
};
const email = 'thompson.1234@osu.edu';

function Harness() {
  const [library, setLibrary] = useState<CurriculumLibrary | null>(null);
  useEffect(() => { loadCurriculum().then(setLibrary).catch((e) => console.warn(e)); }, []);
  const curriculum = useMemo(() => (library ? curriculumFor(library, record.degree_id, { entryTerm: record.entry_term }) : null), [library]);
  const spec = curriculum?.specializations.find((p) => /^finance/i.test(p.name))?.id;
  // ?view=plan adds a planned term with two GE courses (taken from a real Buck AI plan) so the GE picker can be captured
  const withPlan = new URLSearchParams(location.search).get('view') === 'plan';
  const rec = useMemo(() => ({ ...record, specialization_ids: spec ? [spec] : [],
    semesters: withPlan ? [...record.semesters, { id: 's27', name: 'Spring 2027', status: 'planned', courses: [c('BUSOBA 2320'), c('BUSFIN 4211'), c('AFAMAST 2050'), c('ENGLISH 3304'), c('ANTHROP 1101')], totalCredits: 0, workloadRating: 'Balanced' }] as any : record.semesters }), [spec, withPlan]);
  if (!library) return <div style={{ padding: 40 }}>Loading curriculum…</div>;
  // ?view=signin | upload | review renders the onboarding screens for teaser captures (nothing is submitted)
  const view = new URLSearchParams(location.search).get('view');
  if (view === 'signin') return <SignIn />;
  if (view === 'upload' || view === 'review')
    return <MyClassesEditor library={library} initial={view === 'review' ? rec : null} onSave={async () => {}} onCancel={() => {}} />;
  return (
    <div>
      <div className="bg-[#2c2c2a] text-white text-xs px-4 py-1.5 flex items-center justify-between">
        <span className="opacity-90">Signed in as {email} · <span className="capitalize">student</span></span>
        <div className="flex items-center gap-4"><span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" /> My classes</span><span className="flex items-center gap-1"><LogOut className="w-3.5 h-3.5" /> Sign out</span></div>
      </div>
      <App profile={{ ...toStudentProfile(rec, email), totalRequiredCredits: curriculum?.degree.min_total_credits ?? 121 }}
        initialRoadmap={normalizeSemesters(rec.semesters)} onRoadmapChange={() => {}} curriculum={curriculum}
        planTerms={null} onPlanTermsChange={() => {}} onProgramChange={() => {}} onEditProfile={() => {}} onPickInstructor={() => {}} />
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<Harness />);
