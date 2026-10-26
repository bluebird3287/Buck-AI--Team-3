import React, { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Loader2, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getRole } from '../lib/roles';
import { SignIn } from './SignIn';
import { SetNewPassword } from './SetNewPassword';
import { AdvisorView } from './AdvisorView';
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

  if (loading) {
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

  const email = session.user.email ?? '';
  const role = getRole(email);

  return (
    <div>
      <div className="bg-[#2c2c2a] text-white text-xs px-4 py-1.5 flex items-center justify-between">
        <span className="opacity-90">
          Signed in as {email} · <span className="capitalize">{role}</span>
        </span>
        <button
          onClick={() => supabase.auth.signOut()}
          className="flex items-center gap-1 hover:text-gray-200 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" /> Sign out
        </button>
      </div>
      {role === 'advisor' ? <AdvisorView email={email} /> : <App />}
    </div>
  );
};
