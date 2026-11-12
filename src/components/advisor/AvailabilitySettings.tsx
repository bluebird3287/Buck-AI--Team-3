import React, { useEffect, useId, useRef, useState } from 'react';
import { CalendarPlus, RefreshCw, Trash2, Upload, Loader2, Plus, X, CalendarX2, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  AdvisorCalendar,
  DEFAULT_WEEKLY_HOURS,
  WeeklyHours,
  addCalendarFeed,
  fmtTime,
  importCalendarFile,
  removeCalendar,
  saveWeeklyHours,
  syncCalendar,
  toggleDayOff,
  useAdvisingState,
  relativeTime,
} from '../../lib/advising';

// Where an advisor sets when students can book them:
// 1. Calendars: Google or Outlook, by secret feed link (kept in sync) or an exported .ics file.
//    Only busy start/end times are imported; event names never leave the advisor's calendar.
// 2. Weekly hours: the times they advise on each weekday.
// 3. Days off: whole dates nobody can book (also toggled from the week grid).

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ba0c2f]';
const card = 'rounded-lg border border-gray-200 bg-white p-5';
const btn = `inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-semibold ${focusRing}`;
const btnPrimary = `${btn} border-[#ba0c2f] bg-[#ba0c2f] text-white hover:bg-[#8a0a23] disabled:opacity-50`;
const btnSecondary = `${btn} border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-50`;

const WEEKDAYS: { key: string; label: string }[] = [
  { key: '1', label: 'Monday' },
  { key: '2', label: 'Tuesday' },
  { key: '3', label: 'Wednesday' },
  { key: '4', label: 'Thursday' },
  { key: '5', label: 'Friday' },
  { key: '6', label: 'Saturday' },
  { key: '7', label: 'Sunday' },
];

// 6:00 AM to 9:00 PM in half hours
const TIME_OPTIONS = Array.from({ length: 31 }, (_, i) => 6 * 60 + i * 30);

const PROVIDER_LABEL: Record<AdvisorCalendar['provider'], string> = {
  google: 'Google Calendar',
  outlook: 'Outlook',
  file: 'Uploaded file',
};

const HOW_TO: Record<'google' | 'outlook', { title: string; steps: string[] }> = {
  google: {
    title: 'Google Calendar',
    steps: [
      'Open Google Calendar on a computer and select the gear → Settings.',
      'Under “Settings for my calendars,” pick your calendar → Integrate calendar.',
      'Copy “Secret address in iCal format” and paste it below.',
    ],
  },
  outlook: {
    title: 'Outlook (OSU Microsoft 365)',
    steps: [
      'In Outlook on the web, select the gear → Calendar → Shared calendars.',
      'Under “Publish a calendar,” choose your calendar and “Can view when I’m busy,” then Publish.',
      'Copy the ICS link and paste it below. If publishing is turned off for your account, export an .ics file and upload it instead.',
    ],
  },
};

function hoursEqual(a: WeeklyHours, b: WeeklyHours) {
  const norm = (h: WeeklyHours) => JSON.stringify(WEEKDAYS.map((d) => h[d.key] ?? []));
  return norm(a) === norm(b);
}

export const AvailabilitySettings: React.FC<{ onAnnounce: (msg: string) => void }> = ({ onAnnounce }) => {
  const state = useAdvisingState();
  const me = state.advisors.find((a) => a.id === state.meId) ?? null;

  if (!state.loaded) return null;
  if (!me) {
    return (
      <p className={`${card} text-sm text-gray-700`}>
        Your advisor profile isn’t set up yet, so you can’t set availability. Ask the BuckAI team to add your email to the advisor list.
      </p>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <CalendarsCard calendars={state.calendars} onAnnounce={onAnnounce} />
      <div className="space-y-4">
        <WeeklyHoursCard saved={me.weeklyHours} onAnnounce={onAnnounce} />
        <DaysOffCard days={state.daysOff.filter((d) => d.advisorId === me.id).map((d) => d.day).sort()} onAnnounce={onAnnounce} />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------

const CalendarsCard: React.FC<{ calendars: AdvisorCalendar[]; onAnnounce: (m: string) => void }> = ({ calendars, onAnnounce }) => {
  const [provider, setProvider] = useState<'google' | 'outlook'>('google');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState<string | null>(null); // 'add' | 'file' | calendar id
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const urlId = useId();
  const statusId = useId();

  const report = (ok: boolean, text: string) => {
    setResult({ ok, text });
    onAnnounce(text);
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setBusy('add');
    const r = await addCalendarFeed(url, HOW_TO[provider].title);
    setBusy(null);
    if (r.error) report(false, r.error);
    else {
      setUrl('');
      report(true, `Connected. Imported ${r.imported} busy time${r.imported === 1 ? '' : 's'} from the next 8 weeks.`);
    }
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy('file');
    const r = await importCalendarFile(file, provider);
    setBusy(null);
    if (fileRef.current) fileRef.current.value = '';
    if (r.error) report(false, r.error);
    else report(true, `Imported ${r.imported} busy time${r.imported === 1 ? '' : 's'} from ${file.name}.`);
  };

  const sync = async (c: AdvisorCalendar) => {
    setBusy(c.id);
    const r = await syncCalendar(c.id);
    setBusy(null);
    if (r.error) report(false, `${c.label}: ${r.error}`);
    else report(true, `${c.label} synced: ${r.imported} busy time${r.imported === 1 ? '' : 's'}.`);
  };

  const remove = async (c: AdvisorCalendar) => {
    if (!window.confirm(`Disconnect ${c.label}? Its busy times will be removed from your availability.`)) return;
    await removeCalendar(c.id);
    report(true, `${c.label} disconnected.`);
  };

  return (
    <section aria-labelledby="cal-heading" className={`${card} space-y-4`}>
      <div>
        <h3 id="cal-heading" className="flex items-center gap-2 text-base font-bold text-gray-900">
          <CalendarPlus className="w-5 h-5 text-[#ba0c2f]" aria-hidden /> Import your calendars
        </h3>
        <p className="mt-1 text-sm text-gray-700">
          Students can’t book times you’re busy on Google or Outlook. Only busy times are copied; event names and details stay private.
        </p>
      </div>

      {calendars.length > 0 && (
        <ul className="divide-y divide-gray-100 rounded-md border border-gray-200" aria-label="Connected calendars">
          {calendars.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">{c.label}</p>
                <p className="text-xs text-gray-600">
                  {PROVIDER_LABEL[c.provider]} · {c.hasFeed ? 'linked, syncs automatically' : 'uploaded file'} · {c.busyCount} busy time
                  {c.busyCount === 1 ? '' : 's'} ahead
                  {c.lastSyncedAt ? ` · updated ${relativeTime(c.lastSyncedAt)}` : ''}
                </p>
                {c.lastError && (
                  <p className="mt-0.5 flex items-start gap-1 text-xs text-[#8a0a23]">
                    <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" aria-hidden /> {c.lastError}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {c.hasFeed && (
                  <button type="button" onClick={() => sync(c)} disabled={busy !== null} className={btnSecondary}>
                    {busy === c.id ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <RefreshCw className="w-4 h-4" aria-hidden />}
                    Sync now
                  </button>
                )}
                <button type="button" onClick={() => remove(c)} className={btnSecondary} aria-label={`Disconnect ${c.label}`}>
                  <Trash2 className="w-4 h-4" aria-hidden /> Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <fieldset>
        <legend className="text-sm font-semibold text-gray-900">Calendar</legend>
        <div className="mt-1 flex gap-2">
          {(['google', 'outlook'] as const).map((p) => (
            <label
              key={p}
              className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#ba0c2f] ${
                provider === p ? 'border-[#ba0c2f] bg-red-50 font-semibold text-[#8a0a23]' : 'border-gray-300 bg-white text-gray-800'
              }`}
            >
              <input type="radio" name="cal-provider" value={p} checked={provider === p} onChange={() => setProvider(p)} className="sr-only" />
              {p === 'google' ? 'Google Calendar' : 'Outlook'}
            </label>
          ))}
        </div>
      </fieldset>

      <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-700">
        {HOW_TO[provider].steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>

      <form onSubmit={add} className="space-y-2">
        <label htmlFor={urlId} className="block text-sm font-semibold text-gray-900">
          {provider === 'google' ? 'Secret address in iCal format' : 'Outlook ICS link'}
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id={urlId}
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={provider === 'google' ? 'https://calendar.google.com/calendar/ical/…/basic.ics' : 'https://outlook.office365.com/owa/calendar/…/calendar.ics'}
            aria-describedby={result ? statusId : undefined}
            className="min-w-0 flex-1 rounded-md border border-gray-400 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ba0c2f] focus:border-[#ba0c2f]"
          />
          <button type="submit" disabled={busy !== null || !url.trim()} className={btnPrimary}>
            {busy === 'add' ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <CalendarPlus className="w-4 h-4" aria-hidden />}
            Connect
          </button>
        </div>
        <p className="text-xs text-gray-600">Treat this link like a password: anyone with it can see your calendar. BuckAI only shows it to you.</p>
      </form>

      <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
        <span className="text-sm text-gray-700">Or upload an exported .ics file:</span>
        <input ref={fileRef} type="file" accept=".ics,text/calendar" className="sr-only" id="ics-upload" onChange={(e) => upload(e.target.files?.[0])} />
        <label htmlFor="ics-upload" className={`${btnSecondary} cursor-pointer`}>
          {busy === 'file' ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Upload className="w-4 h-4" aria-hidden />}
          Choose file
        </label>
      </div>

      {result && (
        <p
          id={statusId}
          role={result.ok ? 'status' : 'alert'}
          className={`flex items-start gap-1.5 rounded-md border px-3 py-2 text-sm ${
            result.ok ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-red-300 bg-red-50 text-[#8a0a23]'
          }`}
        >
          {result.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" aria-hidden /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />}
          {result.text}
        </p>
      )}
    </section>
  );
};

// ---------------------------------------------------------------------------

const WeeklyHoursCard: React.FC<{ saved: WeeklyHours; onAnnounce: (m: string) => void }> = ({ saved, onAnnounce }) => {
  const [hours, setHours] = useState<WeeklyHours>(saved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = !hoursEqual(hours, saved);

  // Pick up the saved hours when they load or change elsewhere, unless there are unsaved edits.
  const savedKey = JSON.stringify(saved);
  useEffect(() => {
    if (!dirty) setHours(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey]);

  const setDay = (day: string, ranges: [number, number][]) => {
    setError(null);
    setHours((h) => {
      const next = { ...h };
      if (ranges.length) next[day] = ranges;
      else delete next[day];
      return next;
    });
  };

  const validate = (): string | null => {
    for (const d of WEEKDAYS) {
      const ranges = [...(hours[d.key] ?? [])].sort((a, b) => a[0] - b[0]);
      for (let i = 0; i < ranges.length; i++) {
        if (ranges[i][1] <= ranges[i][0]) return `${d.label}: each block has to end after it starts.`;
        if (i > 0 && ranges[i][0] < ranges[i - 1][1]) return `${d.label}: two blocks overlap.`;
      }
    }
    return null;
  };

  const save = async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    const sorted: WeeklyHours = {};
    for (const d of WEEKDAYS) if (hours[d.key]?.length) sorted[d.key] = [...hours[d.key]].sort((a, b) => a[0] - b[0]);
    setSaving(true);
    const ok = await saveWeeklyHours(sorted);
    setSaving(false);
    if (ok) onAnnounce('Weekly hours saved.');
    else setError('Could not save. Try again.');
  };

  return (
    <section aria-labelledby="hours-heading" className={`${card} space-y-3`}>
      <div>
        <h3 id="hours-heading" className="flex items-center gap-2 text-base font-bold text-gray-900">
          <Clock className="w-5 h-5 text-[#ba0c2f]" aria-hidden /> Weekly advising hours
        </h3>
        <p className="mt-1 text-sm text-gray-700">Students can book you only inside these hours, minus anything busy on your calendars.</p>
      </div>
      <ul className="space-y-2">
        {WEEKDAYS.map((d) => {
          const ranges = hours[d.key] ?? [];
          const on = ranges.length > 0;
          return (
            <li key={d.key} className="flex flex-wrap items-start gap-x-3 gap-y-1.5 border-b border-gray-100 pb-2 last:border-0">
              <label className="flex w-32 items-center gap-2 pt-1.5 text-sm font-semibold text-gray-900">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(e) => setDay(d.key, e.target.checked ? [...(DEFAULT_WEEKLY_HOURS['1'] as [number, number][])] : [])}
                  className="h-4 w-4 accent-[#ba0c2f]"
                />
                {d.label}
              </label>
              {!on ? (
                <span className="pt-1.5 text-sm text-gray-500">Not available</span>
              ) : (
                <div className="flex flex-1 flex-col gap-1.5">
                  {ranges.map(([start, end], i) => (
                    <div key={i} className="flex flex-wrap items-center gap-1.5">
                      <TimeSelect
                        label={`${d.label} block ${i + 1} start`}
                        value={start}
                        onChange={(v) => setDay(d.key, ranges.map((r, j) => (j === i ? [v, r[1]] : r)))}
                      />
                      <span className="text-sm text-gray-600">to</span>
                      <TimeSelect
                        label={`${d.label} block ${i + 1} end`}
                        value={end}
                        onChange={(v) => setDay(d.key, ranges.map((r, j) => (j === i ? [r[0], v] : r)))}
                      />
                      <button
                        type="button"
                        onClick={() => setDay(d.key, ranges.filter((_, j) => j !== i))}
                        aria-label={`Remove ${d.label} ${fmtTime(start)} to ${fmtTime(end)}`}
                        className={`rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900 ${focusRing}`}
                      >
                        <X className="w-4 h-4" aria-hidden />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const last = ranges[ranges.length - 1];
                      const s = Math.min(last ? last[1] + 60 : 13 * 60, 20 * 60);
                      setDay(d.key, [...ranges, [s, Math.min(s + 120, 21 * 60)]]);
                    }}
                    className={`inline-flex w-fit items-center gap-1 rounded text-xs font-semibold text-[#ba0c2f] hover:underline ${focusRing}`}
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden /> Add hours (e.g. after a lunch break)
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {error && (
        <p role="alert" className="text-sm text-[#8a0a23]">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={!dirty || saving} className={btnPrimary}>
          {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />} Save hours
        </button>
        {dirty && (
          <button type="button" onClick={() => setHours(saved)} className={btnSecondary}>
            Undo changes
          </button>
        )}
      </div>
    </section>
  );
};

const TimeSelect: React.FC<{ label: string; value: number; onChange: (v: number) => void }> = ({ label, value, onChange }) => (
  <select
    aria-label={label}
    value={value}
    onChange={(e) => onChange(Number(e.target.value))}
    className="rounded-md border border-gray-400 bg-white px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ba0c2f]"
  >
    {(TIME_OPTIONS.includes(value) ? TIME_OPTIONS : [...TIME_OPTIONS, value].sort((a, b) => a - b)).map((t) => (
      <option key={t} value={t}>
        {fmtTime(t)}
      </option>
    ))}
  </select>
);

// ---------------------------------------------------------------------------

const DaysOffCard: React.FC<{ days: string[]; onAnnounce: (m: string) => void }> = ({ days, onAnnounce }) => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fromId = useId();
  const toId = useId();
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const label = (day: string) =>
    new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!from) return;
    const end = to || from;
    if (end < from) {
      setError('The last day has to be on or after the first day.');
      return;
    }
    const dates: string[] = [];
    for (let d = new Date(`${from}T12:00:00`); d <= new Date(`${end}T12:00:00`) && dates.length < 60; d.setDate(d.getDate() + 1)) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!days.includes(key)) dates.push(key);
    }
    setSaving(true);
    let ok = true;
    for (const d of dates) ok = (await toggleDayOff(d)) && ok;
    setSaving(false);
    if (!ok) setError('Some days could not be saved. Try again.');
    else {
      setError(null);
      setFrom('');
      setTo('');
      onAnnounce(dates.length === 1 ? `${label(dates[0])} marked as a day off.` : `${dates.length} days marked off.`);
    }
  };

  return (
    <section aria-labelledby="off-heading" className={`${card} space-y-3`}>
      <div>
        <h3 id="off-heading" className="flex items-center gap-2 text-base font-bold text-gray-900">
          <CalendarX2 className="w-5 h-5 text-[#ba0c2f]" aria-hidden /> Days you’re out
        </h3>
        <p className="mt-1 text-sm text-gray-700">No one can book you on these days. Already-booked meetings stay put, so move those yourself.</p>
      </div>
      <form onSubmit={add} className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor={fromId} className="block text-xs font-semibold text-gray-800">
            First day
          </label>
          <input
            id={fromId}
            type="date"
            min={todayKey}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-md border border-gray-400 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#ba0c2f]"
          />
        </div>
        <div>
          <label htmlFor={toId} className="block text-xs font-semibold text-gray-800">
            Last day <span className="font-normal text-gray-600">(optional)</span>
          </label>
          <input
            id={toId}
            type="date"
            min={from || todayKey}
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-md border border-gray-400 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#ba0c2f]"
          />
        </div>
        <button type="submit" disabled={!from || saving} className={btnPrimary}>
          {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />} Mark off
        </button>
      </form>
      {error && (
        <p role="alert" className="text-sm text-[#8a0a23]">
          {error}
        </p>
      )}
      {days.length === 0 ? (
        <p className="text-sm text-gray-600">No days off coming up.</p>
      ) : (
        <ul className="flex flex-wrap gap-2" aria-label="Upcoming days off">
          {days.map((d) => (
            <li key={d} className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 py-1 pl-3 pr-1 text-sm text-amber-950">
              {label(d)}
              <button
                type="button"
                onClick={async () => {
                  await toggleDayOff(d);
                  onAnnounce(`${label(d)} is open again.`);
                }}
                aria-label={`Remove day off ${label(d)}`}
                className={`rounded-full p-0.5 hover:bg-amber-100 ${focusRing}`}
              >
                <X className="w-3.5 h-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
