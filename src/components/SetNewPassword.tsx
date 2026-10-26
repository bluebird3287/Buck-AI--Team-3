import React, { useState } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

// Shown after a user clicks the password-reset link in their email. Supabase has put
// them in a temporary recovery session; they set a new password here.
export const SetNewPassword: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const valid = password.length >= 6;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setBusy(false);
      return;
    }
    setDone(true);
    setBusy(false);
    setTimeout(onDone, 1200);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="h-1.5 bg-[#bb0000]" />
        <div className="p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <span className="font-bold text-lg text-gray-900">BuckeyeLink</span>
            <span className="text-[11px] font-semibold bg-amber-100 text-amber-900 px-2.5 py-1 rounded-full">
              Prototype
            </span>
          </div>

          {done ? (
            <div className="text-center py-4">
              <CheckCircle2 className="w-9 h-9 text-green-600 mx-auto" />
              <h1 className="text-xl font-bold text-gray-900 mt-3">Password updated</h1>
              <p className="text-sm text-gray-600 mt-1">Signing you in…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <h1 className="text-xl font-bold text-gray-900 mb-1">Set a new password</h1>
              <p className="text-sm text-gray-600 mb-5">Choose a new password for this prototype.</p>

              <label htmlFor="new-password" className="block text-xs font-semibold text-gray-700 mb-1.5">
                New password
              </label>
              <input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete="new-password"
                className="w-full text-sm px-3.5 py-2.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#bb0000] mb-2"
              />

              {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

              <button
                type="submit"
                disabled={!valid || busy}
                className="w-full bg-[#bb0000] hover:bg-[#990000] disabled:bg-gray-300 text-white font-semibold text-sm py-2.5 rounded flex items-center justify-center gap-2 mt-3 transition-colors"
              >
                {busy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Saving…
                  </>
                ) : (
                  'Save new password'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
