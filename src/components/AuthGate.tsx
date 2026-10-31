import React, { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Loader2, LogOut, BookOpen } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getRole } from '../lib/roles';
import { SignIn } from './SignIn';
import { SetNewPassword } from './SetNewPassword';
import { AdvisorView } from './AdvisorView';
import { MyClassesEditor } from './MyClassesEditor';
import { PlanTerms, StudentRecord, loadStudentRecord, saveStudentRecord, toStudentProfile, normalizeSemesters } from '../lib/studentProfile';
import { Semester } from '../data/sampleData';
import { Curriculum, loadCurriculum } from '../lib/requirements';
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

  const email = session?.user.email ?? '';
  const userId = session?.user.id ?? '';
  const role = getRole(email);

  // Each student's own profile and classes, read through row-level security.
  const [record, setRecord] = useState<StudentRecord | null>(null);
  // Which user's record has finished loading, so the setup screen never flashes before it arrives.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  // Fisher curriculum (public reference data), loaded once
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
  useEffect(() => {
    loadCurriculum().then(setCurriculum).catch((err) => console.warn('Could not load curriculum:', err));
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

  if (role === 'student' && recordError) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6 text-sm text-gray-700">
        {recordError}
      </div>
    );
  }

  if (role === 'student' && (!record || editing)) {
    return (
      <MyClassesEditor
        curriculum={curriculum}
        initial={record}
        onSave={handleSaveRecord}
        onCancel={record ? () => setEditing(false) : () => supabase.auth.signOut()}
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
          profile={toStudentProfile(record!, email)}
          initialRoadmap={normalizeSemesters(record!.semesters)}
          onRoadmapChange={handleRoadmapChange}
          curriculum={curriculum}
          planTerms={record!.plan_terms ?? null}
          onPlanTermsChange={handlePlanTermsChange}
        />
      )}
    </div>
  );
};
