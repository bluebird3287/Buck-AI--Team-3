import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Loader2, LogOut, BookOpen } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getRole, Role } from '../lib/roles';
import { SignIn } from './SignIn';
import { SetNewPassword } from './SetNewPassword';
import { AdvisorView } from './AdvisorView';
import { MyClassesEditor } from './MyClassesEditor';
import { PlanTerms, StudentRecord, entryTermOf, loadStudentRecord, saveStudentRecord, toStudentProfile, normalizeSemesters, isBlankProfile } from '../lib/studentProfile';
import { Semester } from '../data/sampleData';
import { CurriculumLibrary, curriculumFor, loadCurriculum } from '../lib/requirements';
import App from '../App';

// Gates the whole app behind email-link sign-in and routes by role:
// logged out -> SignIn; advisor -> AdvisorView; student -> the existing App.
export const AuthGate: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // True while the user is coming back from a password-reset link, so we show the
  // "set a new password" screen instead of the app even though a session exists.
  const [recovering, setRecovering] = useState<boolean>(
    typeof window !== 'undefined' && window.location.hash.includes('type=recovery'),
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      setSession(nextSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Which view the link asked for (?role=student|advisor from the landing page), if any
  const [wantedRole, setWantedRole] = useState<Role | null>(() => {
    const r = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('role') : null;
    return r === 'student' || r === 'advisor' ? r : null;
  });

  const email = session?.user.email ?? '';
  const userId = session?.user.id ?? '';
  const role = getRole(email);

  // Each student's own profile and classes, read through row-level security.
  const [record, setRecord] = useState<StudentRecord | null>(null);
  // Which user's record has finished loading, so the setup screen never flashes before it arrives.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  // Every college's degree requirements (public reference data), loaded once
  const [library, setLibrary] = useState<CurriculumLibrary | null>(null);
  useEffect(() => {
    loadCurriculum().then(setLibrary).catch((err) => console.warn('Could not load curriculum:', err));
  }, []);

  // Bumped after the student edits their classes so the app reloads with the new data.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    setRecord(null);
    setEditing(false);
    if (!userId || role !== 'student') return;
    setRecordError(null);
    loadStudentRecord()
      .then(setRecord)
      .catch((err) => setRecordError(err?.message || 'Could not load your profile.'))
      .finally(() => setLoadedFor(userId));
  }, [userId, role]);

  // The signed-in student's own degree, its specializations, and their special programs, in the version for
  // the term they entered Ohio State
  const entryTerm = record ? entryTermOf(record) : null;
  const specialKey = (record?.special_program_ids ?? []).join(',');
  const curriculum = useMemo(
    () => (library ? curriculumFor(library, record?.degree_id, { entryTerm, specialProgramIds: specialKey ? specialKey.split(',') : [] }) : null),
    [library, record?.degree_id, entryTerm, specialKey],
  );

  const handleSaveRecord = async (next: StudentRecord) => {
    await saveStudentRecord(userId, next);
    setRecord({ ...next, semesters: normalizeSemesters(next.semesters.filter((s) => s.courses.length > 0)) });
    setEditing(false);
    setVersion((v) => v + 1);
  };

  // The latest record, for saves that finish after a long roadmap build: the handler passed down when
  // the build started would otherwise save an older copy and drop changes made since (e.g. term choices).
  const latestRecord = useRef(record);
  latestRecord.current = record;
  const updateRecord = (patch: Partial<StudentRecord>, what: string) => {
    if (!latestRecord.current) return;
    const next = { ...latestRecord.current, ...patch };
    latestRecord.current = next;
    setRecord(next);
    saveStudentRecord(userId, next).catch((err) => console.warn(`Could not save ${what}:`, err));
  };

  // Saves which future terms the student wants classes in (asked before each roadmap build)
  const handlePlanTermsChange = (plan_terms: PlanTerms) => updateRecord({ plan_terms }, 'term choices');

  const handleRoadmapChange = (semesters: Semester[]) => updateRecord({ semesters }, 'roadmap');

  // A specialization or minor the student changed from the chat
  const handleProgramChange = (change: { specialization_ids: string[]; major: string; minor: string | null }) =>
    updateRecord({ ...change, specialization_id: change.specialization_ids[0] ?? null }, 'program change');

  if (loading || (session && role === 'student' && loadedFor !== userId)) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#ba0c2f] animate-spin" />
      </div>
    );
  }

  if (recovering) {
    return (
      <SetNewPassword
        onDone={() => {
          setRecovering(false);
          window.history.replaceState(null, '', window.location.pathname);
        }}
      />
    );
  }

  if (!session) return <SignIn />;

  // The landing page links to ?role=student or ?role=advisor. The view still comes from the account,
  // so if the link asks for the other view, say so and offer to switch accounts instead of silently
  // opening the wrong one.
  if (wantedRole && wantedRole !== role) {
    const clearWanted = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete('role');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
      setWantedRole(null);
    };
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 max-w-md w-full p-6 text-sm text-gray-700">
          <h1 className="text-lg font-bold text-gray-900 mb-2">
            You're signed in with a {role} account
          </h1>
          <p className="mb-5">
            {email} opens the {role} view. To use the {wantedRole} view, sign out and sign in with your{' '}
            {wantedRole} account.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => supabase.auth.signOut()}
              className="flex-1 bg-[#ba0c2f] hover:bg-[#9d0a27] text-white font-semibold rounded-lg px-4 py-2.5"
            >
              Sign out and switch to {wantedRole}
            </button>
            <button
              onClick={clearWanted}
              className="flex-1 border border-gray-300 hover:bg-gray-50 font-semibold rounded-lg px-4 py-2.5 capitalize"
            >
              Continue as {role}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (role === 'student' && recordError) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6 text-sm text-gray-700">
        {recordError}
      </div>
    );
  }

  if (role === 'student' && (!record || editing || isBlankProfile(record))) {
    return (
      <MyClassesEditor
        library={library}
        initial={record}
        onSave={handleSaveRecord}
        onCancel={record && !isBlankProfile(record) ? () => setEditing(false) : () => supabase.auth.signOut()}
      />
    );
  }

  return (
    <div>
      <div className="bg-[#2c2c2a] text-white text-xs px-4 py-1.5 flex items-center justify-between">
        <span className="opacity-90">
          Signed in as {email} · <span className="capitalize">{role}</span>
        </span>
        <div className="flex items-center gap-4">
          {role === 'student' && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1 hover:text-gray-200 transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5" /> My classes
            </button>
          )}
          <button
            onClick={() => supabase.auth.signOut()}
            className="flex items-center gap-1 hover:text-gray-200 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </div>
      {role === 'advisor' ? (
        <AdvisorView email={email} />
      ) : (
        <App
          key={`${userId}-${version}`}
          // Credits to graduate come from the student's degree (121 for the Fisher BSBA, 121-132 for Engineering)
          profile={{ ...toStudentProfile(record!, email), totalRequiredCredits: curriculum?.degree.min_total_credits ?? 120 }}
          initialRoadmap={normalizeSemesters(record!.semesters)}
          onRoadmapChange={handleRoadmapChange}
          curriculum={curriculum}
          planTerms={record!.plan_terms ?? null}
          onPlanTermsChange={handlePlanTermsChange}
          onProgramChange={handleProgramChange}
          onEditProfile={() => setEditing(true)}
          onPickInstructor={(code, person) => {
            const picks = { ...(record!.office_hours_picks ?? {}) };
            if (person) picks[code.trim().toUpperCase()] = person;
            else delete picks[code.trim().toUpperCase()];
            updateRecord({ office_hours_picks: picks }, 'instructor choice');
          }}
        />
      )}
    </div>
  );
};
