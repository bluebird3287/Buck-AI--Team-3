import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';

// Notices when Vercel has published a new version (a teammate pushed to main) and
// reloads the page so everyone sees the latest app. Each Vercel build gives the main
// script a new hashed name (/assets/index-<hash>.js); we compare the one this page
// loaded with the one the server is serving now. Reloads on its own after a short
// countdown, but waits while someone is typing so no unsent text is lost.

const CHECK_EVERY_MS = 60_000;
const AUTO_RELOAD_SECONDS = 20;
const SCRIPT_PATTERN = /\/assets\/index-[\w-]+\.js/;

function loadedScript(): string | null {
  const el = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]');
  return el ? new URL(el.src).pathname : null;
}

function isTyping(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  if (el instanceof HTMLTextAreaElement) return el.value.trim().length > 0;
  if (el instanceof HTMLInputElement) return !['button', 'submit', 'checkbox', 'radio'].includes(el.type) && el.value.trim().length > 0;
  return false;
}

export const UpdateChecker: React.FC = () => {
  const [updateReady, setUpdateReady] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(AUTO_RELOAD_SECONDS);
  const [paused, setPaused] = useState(false);
  const current = useRef<string | null>(null);

  // Poll for a new build (production only; the dev server has no hashed bundle).
  useEffect(() => {
    current.current = loadedScript();
    if (!current.current) return;

    const check = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await fetch(`/?v=${Date.now()}`, { cache: 'no-store' });
        const latest = (await res.text()).match(SCRIPT_PATTERN)?.[0];
        if (latest && latest !== current.current) setUpdateReady(true);
      } catch {
        // Offline or a blip: try again next round.
      }
    };

    const timer = window.setInterval(check, CHECK_EVERY_MS);
    const onVisible = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Count down to an automatic reload, holding while the user is typing.
  useEffect(() => {
    if (!updateReady || paused) return;
    const timer = window.setInterval(() => {
      if (isTyping()) return;
      setSecondsLeft((s) => {
        if (s <= 1) {
          window.location.reload();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [updateReady, paused]);

  if (!updateReady) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-xl rounded-lg border border-gray-300 bg-white shadow-lg"
    >
      <div className="h-1 rounded-t-lg bg-[#ba0c2f]" />
      <div className="flex flex-wrap items-center gap-3 p-3">
        <RefreshCw className="w-5 h-5 text-[#ba0c2f] shrink-0" aria-hidden />
        <p className="flex-1 min-w-[200px] text-sm text-gray-900">
          <span className="font-semibold">A new version of BuckAI is available.</span>{' '}
          {paused
            ? 'Reload when you’re ready.'
            : isTyping()
            ? 'Waiting until you finish typing.'
            : `Reloading in ${secondsLeft}s.`}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md bg-[#ba0c2f] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#8a0a23] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ba0c2f]"
        >
          Reload now
        </button>
        {!paused && (
          <button
            type="button"
            onClick={() => setPaused(true)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ba0c2f]"
          >
            Not now
          </button>
        )}
        {paused && (
          <button
            type="button"
            onClick={() => setUpdateReady(false)}
            aria-label="Dismiss update notice"
            className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ba0c2f]"
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
};
