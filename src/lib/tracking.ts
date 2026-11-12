import { supabase } from './supabase';

// Funnel tracking (public.events). The browser only sends a random ID and the ?ref= tag;
// the server writes the rows. No names or emails ever leave through here.

const ANON_KEY = 'buckai.anonId';
const REF_KEY = 'buckai.ref';
const REF_PATTERN = /^[a-z0-9_-]{1,64}$/;

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode with storage blocked: tracking still works for this page load */
  }
}

let memoryAnonId: string | null = null;

export function anonId(): string {
  const saved = safeGet(ANON_KEY);
  if (saved) return saved;
  memoryAnonId ??= crypto.randomUUID();
  safeSet(ANON_KEY, memoryAnonId);
  return memoryAnonId;
}

// First-touch: the tag from the person's first visit sticks, later ?ref= links don't replace it.
export function captureRef(): void {
  const raw = new URLSearchParams(window.location.search).get('ref')?.trim().toLowerCase();
  if (raw && REF_PATTERN.test(raw) && !safeGet(REF_KEY)) safeSet(REF_KEY, raw);
}

export function savedRef(): string | null {
  const ref = safeGet(REF_KEY);
  return ref && REF_PATTERN.test(ref) ? ref : null;
}

// Authorization header so the server can save the account ID instead of the random one.
export async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// A signed-in action worth counting (the server saves it with the account ID).
export function trackAction(event: 'plan_built' | 'seat_alert_added'): void {
  void (async () => {
    try {
      const headers = await authHeaders();
      if (!headers.Authorization) return;
      await fetch('/api/events', {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ event, ref: savedRef() }),
      });
    } catch {
      /* tracking must never break the app */
    }
  })();
}

// Runs after the page has fully loaded in a real browser. Link previewers and email
// scanners fetch the HTML without running this script, so they never save a visit.
export function trackVisitOnLoad(): void {
  captureRef();
  const send = async () => {
    if (navigator.webdriver) return;
    try {
      await fetch('/api/events', {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ event: 'visit', anonId: anonId(), ref: savedRef() }),
      });
    } catch {
      /* tracking must never break the app */
    }
  };
  if (document.readyState === 'complete') void send();
  else window.addEventListener('load', () => void send(), { once: true });
}
