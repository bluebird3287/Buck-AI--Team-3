import { supabase } from './supabase';

export type Role = 'student' | 'advisor';

// An account is an advisor when it has a row in public.advisors (is_advisor() / current_advisor_id()).
// Advisors don't need to be added by hand: on sign-in, /api/advisor-enroll looks the name.#@osu.edu
// user up in Ohio State's directory and, if their job is academic advising, creates their row. Anyone
// the directory doesn't list as an advisor (or a non-OSU demo login) is added with an insert into
// public.advisors.

const ENROLL_CHECK_KEY = 'buckai.advisorEnrollChecked';
const RECHECK_MS = 7 * 86_400_000; // look a student account up again weekly (new hires, role changes)

function checkedRecently(userId: string): boolean {
  try {
    const at = Number(window.localStorage.getItem(`${ENROLL_CHECK_KEY}:${userId}`));
    return Number.isFinite(at) && Date.now() - at < RECHECK_MS;
  } catch {
    return false;
  }
}

function markChecked(userId: string) {
  try {
    window.localStorage.setItem(`${ENROLL_CHECK_KEY}:${userId}`, String(Date.now()));
  } catch {
    // Storage blocked: we just check again next time.
  }
}

async function isAdvisor(): Promise<boolean> {
  const { data, error } = await supabase.rpc('current_advisor_id');
  if (error) console.warn('Could not check advisor role:', error.message);
  return !!data;
}

export async function resolveRole(session: { access_token: string; user: { id: string; email?: string | null } }): Promise<Role> {
  if (await isAdvisor()) return 'advisor';
  const email = (session.user.email ?? '').toLowerCase();
  if (!/^[a-z-]+\.[0-9]+@osu\.edu$/.test(email) || checkedRecently(session.user.id)) return 'student';
  try {
    const res = await fetch('/api/advisor-enroll', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` } });
    const body = res.ok ? ((await res.json()) as { advisor?: boolean }) : {};
    if (res.ok) markChecked(session.user.id);
    if (body.advisor) return (await isAdvisor()) ? 'advisor' : 'student';
  } catch (err) {
    console.warn('Advisor directory check failed:', err);
  }
  return 'student';
}
