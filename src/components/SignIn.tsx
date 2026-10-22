import React, { useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Email + password sign-in for the prototype. This is the app's own account system
// (Supabase-managed), not Ohio State's real login — use a new password here, not your
// OSU one. With "Confirm email" turned off in Supabase, creating an account signs you
// in right away.
export const SignIn: React.FC = () => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passwordValid = password.length >= 6;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailValid || !passwordValid || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);

    if (mode === 'signup') {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (signUpError) {
        setError(signUpError.message);
      } else if (!data.session) {
        // No session means Supabase still has email confirmation turned on.
        setNotice('Account created. Turn off "Confirm email" in Supabase to sign in without a confirmation step.');
      }
      // On success with a session, AuthGate picks it up automatically.
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) setError('That email or password is incorrect.');
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="h-1.5 bg-[#ba0c2f]" />
        <div className="p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <span className="font-bold text-lg text-gray-900">BuckeyeLink</span>
            <span className="text-[11px] font-semibold bg-amber-50 text-amber-800 px-2.5 py-1 rounded-full">
              Prototype
            </span>
          </div>

          {!isSupabaseConfigured && (
            <div className="mb-5 flex items-start gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Sign-in isn't configured yet. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.</span>
            </div>
          )}

          <h1 className="text-xl font-bold text-gray-900 mb-1">
            {mode === 'signin' ? 'Sign in' : 'Create your account'}
          </h1>
          <p className="text-sm text-gray-600 mb-5">
            Use a password for this prototype, not your Ohio State password.
          </p>

          <form onSubmit={handleSubmit}>
            <label htmlFor="signin-email" className="block text-xs font-semibold text-gray-700 mb-1.5">
              Email
            </label>
            <input
              id="signin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name.#@osu.edu"
              autoComplete="email"
              className="w-full text-sm px-3.5 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ba0c2f] mb-3"
            />

            <label htmlFor="signin-password" className="block text-xs font-semibold text-gray-700 mb-1.5">
              Password
            </label>
            <input
              id="signin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              className="w-full text-sm px-3.5 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ba0c2f] mb-2"
            />

            {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
            {notice && <p className="text-xs text-amber-800 mb-2">{notice}</p>}

            <button
              type="submit"
              disabled={!emailValid || !passwordValid || busy}
              className="w-full bg-[#ba0c2f] hover:bg-[#9d0a27] disabled:bg-gray-300 text-white font-semibold text-sm py-2.5 rounded-lg flex items-center justify-center gap-2 mt-3 transition-colors"
            >
              {busy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> {mode === 'signin' ? 'Signing in…' : 'Creating…'}
                </>
              ) : mode === 'signin' ? (
                'Sign in'
              ) : (
                'Create account'
              )}
            </button>
          </form>

          <div className="border-t border-gray-200 mt-5 pt-4 text-center text-xs text-gray-600">
            {mode === 'signin' ? (
              <>
                New here?{' '}
                <button
                  onClick={() => { setMode('signup'); setError(null); setNotice(null); }}
                  className="text-[#185fa5] font-semibold hover:underline"
                >
                  Create an account
                </button>
              </>
            ) : (
              <>
                Have an account?{' '}
                <button
                  onClick={() => { setMode('signin'); setError(null); setNotice(null); }}
                  className="text-[#185fa5] font-semibold hover:underline"
                >
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
