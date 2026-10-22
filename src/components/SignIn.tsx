import React, { useState } from 'react';
import { Mail, Loader2, AlertCircle } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Screens 1 and 2 of the sign-in wireframe: enter email, then check your email.
// Email magic link only — no password is ever collected.
export const SignIn: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailValid || status === 'sending') return;
    setStatus('sending');
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    if (signInError) {
      setError(signInError.message || "Couldn't send the link. Try again.");
      setStatus('idle');
      return;
    }
    setStatus('sent');
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

          {status !== 'sent' ? (
            <form onSubmit={handleSubmit}>
              <h1 className="text-xl font-bold text-gray-900 mb-1">Sign in</h1>
              <p className="text-sm text-gray-600 mb-5">No password. We'll email you a secure link.</p>

              <label htmlFor="signin-email" className="block text-xs font-semibold text-gray-700 mb-1.5">
                Ohio State email
              </label>
              <input
                id="signin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name.#@osu.edu"
                autoComplete="email"
                className="w-full text-sm px-3.5 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ba0c2f] mb-2"
              />

              {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

              <button
                type="submit"
                disabled={!emailValid || status === 'sending'}
                className="w-full bg-[#ba0c2f] hover:bg-[#9d0a27] disabled:bg-gray-300 text-white font-semibold text-sm py-2.5 rounded-lg flex items-center justify-center gap-2 mt-3 transition-colors"
              >
                {status === 'sending' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Sending…
                  </>
                ) : (
                  'Email me a sign-in link'
                )}
              </button>
            </form>
          ) : (
            <div className="text-center py-2">
              <Mail className="w-9 h-9 text-gray-500 mx-auto" />
              <h1 className="text-xl font-bold text-gray-900 mt-3 mb-1.5">Check your email</h1>
              <p className="text-sm text-gray-600 mb-5">
                We sent a sign-in link to <span className="text-gray-900 font-medium">{email.trim()}</span>. Open it to
                finish signing in.
              </p>
              <div className="border-t border-gray-200 pt-3 flex justify-center gap-5 text-xs text-[#185fa5]">
                <button onClick={handleSubmit} className="hover:underline">Resend link</button>
                <button onClick={() => setStatus('idle')} className="hover:underline">Use a different email</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
