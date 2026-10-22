import { createClient } from '@supabase/supabase-js';

// Public, client-safe values (publishable key is meant to be public).
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

// True only when both env vars are present, so the UI can explain setup is missing
// instead of crashing.
export const isSupabaseConfigured = Boolean(url && publishableKey);

// A single shared client. detectSessionInUrl lets the magic-link redirect finish sign-in.
export const supabase = createClient(url ?? 'http://localhost', publishableKey ?? 'public-anon-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
