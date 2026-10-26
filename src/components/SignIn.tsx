import React, { useState } from 'react';
import { Loader2, AlertCircle, Info } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

type Mode = 'signin' | 'signup' | 'forgot';

// BuckeyeLink-styled sign-in for the prototype. It mirrors Ohio State's look (scarlet,
// the "Login Required" layout) but is clearly a class prototype with its OWN accounts:
// email + a password you make up here, never your real OSU password. Not the official
// OSU web login, and it never collects OSU single sign-on credentials.
export const SignIn: React.FC = () => {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passwordValid = password.length >= 6;
  const canSubmit = mode === 'forgot' ? emailValid : emailValid && passwordValid;

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setNotice(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);

    if (mode === 'forgot') {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      });
      if (resetError) setError(resetError.message);
      else setNotice('If that email has an account, a password-reset link is on its way. Open it to set a new password.');
    } else if (mode === 'signup') {
      const { data, error: signUpError } = await supabase.auth.signUp({ email: email.trim(), password });
      if (signUpError) setError(signUpError.message);
      else if (!data.session) setNotice('Account created. Turn off "Confirm email" in Supabase to sign in without a confirmation step.');
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) setError('That email or password is incorrect.');
    }
    setBusy(false);
  };

  const heading = mode === 'signin' ? 'Login Required' : mode === 'signup' ? 'Create your account' : 'Reset your password';

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Institutional top bar */}
      <div className="bg-white border-b border-gray-200 py-3 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="font-bold tracking-tight text-gray-900">BuckeyeLink</span>
          <span className="text-[11px] font-semibold bg-amber-100 text-amber-900 px-2.5 py-1 rounded-full">
            Prototype
          </span>
        </div>
      </div>
      <div className="h-1.5 bg-[#bb0000]" />

      {/* Title band */}
      <div className="bg-[#2b2b29] text-white">
        <div className="max-w-5xl mx-auto px-6 py-7">
          <h1 className="text-3xl font-semibold">{heading}</h1>
        </div>
      </div>

      <div className="max-w-5xl mx-auto w-full px-6 py-8">
        {/* Prototype disclaimer — this is NOT the official OSU login */}
        <div className="mb-6 flex items-start gap-2.5 text-sm text-amber-900 bg-amber-50 border border-amber-300 rounded-lg p-3.5">
          <Info className="w-5 h-5 shrink-0 mt-0.5" />
          <span>
            <strong>Class prototype for BUSADM 2802.</strong> This is not the official Ohio State login. Create a
            password for this app only — never enter your real OSU password here.
          </span>
        </div>

        {!isSupabaseConfigured && (
          <div className="mb-6 flex items-start gap-2 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Sign-in isn't configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.</span>
          </div>
        )}

        <div className="grid md:grid-cols-[1fr_280px] gap-6">
          {/* Login card */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <p className="text-sm text-gray-600 mb-5">
              {mode === 'forgot'
                ? 'Enter your email and we’ll send a link to set a new password.'
                : 'A login is required to access the requested service.'}
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
                className="w-full text-sm px-3.5 py-2.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#bb0000] mb-4"
              />

              {mode !== 'forgot' && (
                <>
                  <label htmlFor="signin-password" className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Password <span className="font-normal text-gray-500">(for this prototype)</span>
                  </label>
                  <input
                    id="signin-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    className="w-full text-sm px-3.5 py-2.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#bb0000] mb-2"
                  />
                </>
              )}

              {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
              {notice && <p className="text-xs text-amber-800 mb-2">{notice}</p>}

              <button
                type="submit"
                disabled={!canSubmit || busy}
                className="w-full bg-[#bb0000] hover:bg-[#990000] disabled:bg-gray-300 text-white font-semibold text-sm py-2.5 rounded flex items-center justify-center gap-2 mt-3 transition-colors"
              >
                {busy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {mode === 'signin' ? 'Logging in…' : mode === 'signup' ? 'Creating…' : 'Sending…'}
                  </>
                ) : mode === 'signin' ? (
                  'Login'
                ) : mode === 'signup' ? (
                  'Create account'
                ) : (
                  'Email me a reset link'
                )}
              </button>
            </form>

            {mode === 'signin' && (
              <div className="mt-3 text-xs">
                <button onClick={() => switchMode('forgot')} className="text-[#1a5fa5] hover:underline">
                  Forgot password?
                </button>
              </div>
            )}
          </div>

          {/* Help sidebar */}
          <aside className="text-sm">
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h2 className="font-semibold text-gray-900 mb-3">Need help?</h2>
              <ul className="space-y-2 text-[#1a5fa5]">
                {mode !== 'signup' && (
                  <li>
                    <button onClick={() => switchMode('signup')} className="hover:underline text-left">
                      Create an account
                    </button>
                  </li>
                )}
                {mode !== 'forgot' && (
                  <li>
                    <button onClick={() => switchMode('forgot')} className="hover:underline text-left">
                      Reset your password
                    </button>
                  </li>
                )}
                {mode !== 'signin' && (
                  <li>
                    <button onClick={() => switchMode('signin')} className="hover:underline text-left">
                      Back to login
                    </button>
                  </li>
                )}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};
