import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Check, BookOpen, Briefcase, Ban, CalendarCheck, Sparkles } from 'lucide-react';
import { buildWeek, describeSlot, MatchSlot, SlotStatus, useAdvisingState } from '../../lib/advising';

// One availability grid for both parties. Students pick a mutually free time; advisors
// open or close their own times and see who is booked. Times when either party is busy
// (class, meetings) or that have passed are left blank so only usable times stand out.
// Shown statuses use text and an icon as well as color, so they read without color vision.

// Statuses left as blank cells in the grid.
const HIDDEN: SlotStatus[] = ['student_busy', 'advisor_busy', 'past'];

type Mode = 'student' | 'advisor';

interface ScheduleMatcherProps {
  mode: Mode;
  studentName: string;
  selectedKey?: string | null;
  onSelect?: (slot: MatchSlot) => void;
  onToggleAvailability?: (slot: MatchSlot) => void;
}

const STATUS_UI: Record<SlotStatus, { cell: string; short: (m: Mode) => string; icon: React.ElementType | null }> = {
  open: {
    cell: 'bg-white border-emerald-600 text-emerald-900 hover:bg-emerald-50',
    short: (m) => (m === 'student' ? 'Available' : 'Open'),
    icon: Check,
  },
  student_busy: { cell: 'bg-red-50 border-red-200 text-red-900', short: () => 'Class', icon: BookOpen },
  advisor_busy: { cell: 'bg-gray-100 border-gray-200 text-gray-700', short: () => 'Advisor busy', icon: Briefcase },
  advisor_closed: {
    cell: 'bg-gray-50 border-dashed border-gray-400 text-gray-700',
    short: (m) => (m === 'advisor' ? 'Closed' : 'Unavailable'),
    icon: Ban,
  },
  booked: { cell: 'bg-blue-50 border-blue-300 text-blue-900', short: () => 'Booked', icon: CalendarCheck },
  past: { cell: 'bg-gray-50 border-gray-100 text-gray-400', short: () => '—', icon: null },
};

export const ScheduleMatcher: React.FC<ScheduleMatcherProps> = ({
  mode,
  studentName,
  selectedKey,
  onSelect,
  onToggleAvailability,
}) => {
  const state = useAdvisingState();
  const [weekOffset, setWeekOffset] = useState(0);
  const days = useMemo(() => {
    const week = buildWeek(weekOffset, state);
    if (mode === 'advisor') return week;
    // Students never see who else booked their advisor.
    return week.map((d) => ({
      ...d,
      slots: d.slots.map((s): MatchSlot =>
        s.status === 'booked'
          ? { ...s, reason: 'Already booked', bookedBy: undefined }
          : s.status === 'advisor_closed'
          ? { ...s, reason: 'Advisor unavailable' }
          : s,
      ),
    }));
  }, [weekOffset, state, mode]);
  const times = days[0]?.slots.map((s) => ({ start: s.start, label: s.timeLabel })) ?? [];
  const bestTimes = days.flatMap((d) => d.slots).filter((s) => s.status === 'open').slice(0, 3);
  const openCount = days.reduce((n, d) => n + d.slots.filter((s) => s.status === 'open').length, 0);
  const rangeLabel = days.length ? `${days[0].dateLabel} – ${days[days.length - 1].dateLabel}` : '';

  const isActionable = (s: MatchSlot) =>
    mode === 'student' ? s.status === 'open' : s.status === 'open' || s.status === 'advisor_closed';

  const handleClick = (s: MatchSlot) => {
    if (!isActionable(s)) return;
    if (mode === 'student') onSelect?.(s);
    else onToggleAvailability?.(s);
  };

  const legend: SlotStatus[] = ['open', 'advisor_closed', 'booked'];

  return (
    <section aria-labelledby="matcher-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id="matcher-heading" className="text-base font-bold text-gray-900">
            {mode === 'student' ? 'Times that work for you and your advisor' : `Mutual availability with ${studentName}`}
          </h3>
          <p className="text-sm text-gray-600">
            {mode === 'student'
              ? 'Only times when you and your advisor are both free are shown.'
              : 'Only times when you and the student are both free are shown. Select an open time to close it, or a closed time to reopen it.'}
          </p>
        </div>
        <div className="flex items-center gap-2" role="group" aria-label="Change week">
          <button
            type="button"
            onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
            disabled={weekOffset === 0}
            className="p-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ba0c2f]"
            aria-label="Previous week"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden />
          </button>
          <span className="text-sm font-semibold text-gray-900 min-w-[130px] text-center" aria-live="polite">
            {rangeLabel}
          </span>
          <button
            type="button"
            onClick={() => setWeekOffset((w) => Math.min(3, w + 1))}
            disabled={weekOffset === 3}
            className="p-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ba0c2f]"
            aria-label="Next week"
          >
            <ChevronRight className="w-4 h-4" aria-hidden />
          </button>
        </div>
      </div>

      {/* Best mutual times */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Sparkles className="w-4 h-4 text-[#ba0c2f]" aria-hidden />
          <span>
            {openCount} mutual opening{openCount === 1 ? '' : 's'} this week
            {bestTimes.length > 0 ? ' · earliest:' : ''}
          </span>
        </div>
        {bestTimes.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-2">
            {bestTimes.map((s) => (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => (mode === 'student' ? onSelect?.(s) : undefined)}
                  disabled={mode !== 'student'}
                  aria-pressed={mode === 'student' ? selectedKey === s.key : undefined}
                  className={`text-sm px-3 py-1.5 rounded-full border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ba0c2f] ${
                    selectedKey === s.key
                      ? 'bg-[#ba0c2f] border-[#ba0c2f] text-white'
                      : 'bg-white border-emerald-600 text-emerald-900 enabled:hover:bg-emerald-50'
                  } disabled:cursor-default`}
                >
                  {describeSlot(s.key)}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-gray-600">No shared openings this week. Try the next week.</p>
        )}
      </div>

      {/* Legend */}
      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-700" aria-label="Legend">
        {legend.map((s) => {
          const ui = STATUS_UI[s];
          const Icon = ui.icon;
          return (
            <li key={s} className="flex items-center gap-1.5">
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded border ${ui.cell}`}>
                {Icon && <Icon className="w-3 h-3" aria-hidden />}
              </span>
              {s === 'open' ? 'Both free' : ui.short(mode)}
            </li>
          );
        })}
      </ul>

      {/* Grid */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full min-w-[640px] table-fixed border-collapse text-sm">
          <caption className="sr-only">
            Availability for the week of {rangeLabel}. Rows are times, columns are days.
          </caption>
          <thead>
            <tr className="bg-gray-50">
              <th scope="col" className="w-20 px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Time
              </th>
              {days.map((d) => (
                <th key={d.dateKey} scope="col" className="px-1 py-2 text-center">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-gray-600">{d.weekdayShort}</span>
                  <span className="block text-sm font-bold text-gray-900">{d.dateLabel}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {times.map((t, row) => (
              <tr key={t.start} className="border-t border-gray-100">
                <th scope="row" className="px-2 py-1 text-left text-xs font-medium text-gray-600 whitespace-nowrap">
                  {t.label}
                </th>
                {days.map((d) => {
                  const s = d.slots[row];
                  if (HIDDEN.includes(s.status)) {
                    return (
                      <td key={s.key} className="p-0.5">
                        <span className="sr-only">
                          {d.weekdayLong} {d.dateLabel}, {s.timeLabel}: not available
                        </span>
                      </td>
                    );
                  }
                  const ui = STATUS_UI[s.status];
                  const Icon = ui.icon;
                  const selected = selectedKey === s.key;
                  const actionable = isActionable(s);
                  const action =
                    mode === 'advisor' && s.status === 'open'
                      ? 'Select to mark unavailable.'
                      : mode === 'advisor' && s.status === 'advisor_closed'
                      ? 'Select to reopen.'
                      : mode === 'student' && s.status === 'open'
                      ? 'Select to choose this time.'
                      : '';
                  return (
                    <td key={s.key} className="p-0.5">
                      <button
                        type="button"
                        onClick={() => handleClick(s)}
                        disabled={!actionable}
                        aria-pressed={mode === 'student' && actionable ? selected : undefined}
                        aria-label={`${d.weekdayLong} ${d.dateLabel}, ${s.timeLabel}: ${s.reason}. ${action}`}
                        title={s.reason}
                        className={`w-full h-9 rounded border px-1.5 flex items-center gap-1 text-xs font-medium truncate focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#ba0c2f] ${
                          selected ? 'bg-[#ba0c2f] border-[#ba0c2f] text-white' : ui.cell
                        } ${actionable ? 'cursor-pointer' : 'cursor-default'}`}
                      >
                        {selected ? <Check className="w-3.5 h-3.5 shrink-0" aria-hidden /> : Icon && <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden />}
                        <span className="truncate">
                          {selected ? 'Selected' : s.status === 'booked' && mode === 'advisor' ? s.bookedBy : ui.short(mode)}
                        </span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
