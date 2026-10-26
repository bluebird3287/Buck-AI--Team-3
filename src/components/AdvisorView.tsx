import React, { useMemo, useState } from 'react';
import { ShieldCheck, Clock, MapPin, Check, CalendarDays } from 'lucide-react';
import { MUTUAL_ADVISOR_SLOTS, AdvisorSlot } from '../data/sampleData';

// Advisor's calendar view: a Google Calendar-style week grid showing the same mutual
// availability the student sees in their scheduler, from the advisor's side. Green =
// both free (bookable), red = the student has class, gray = advisor is busy.

type Status = 'free' | 'conflict' | 'advisor-busy';

interface CalEvent {
  slot: AdvisorSlot;
  dateKey: string;
  startMin: number;
  endMin: number;
  status: Status;
  conflictNote?: string;
}

const GRID_START = 9 * 60; // 9:00 AM
const GRID_END = 15 * 60; // 3:00 PM
const HOUR_PX = 64;

function parseMinutes(t: string): number {
  const m = t.trim().match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return GRID_START;
  let h = parseInt(m[1], 10) % 12;
  if (/PM/i.test(m[3])) h += 12;
  return h * 60 + parseInt(m[2], 10);
}

function statusFor(slot: AdvisorSlot): Status {
  if (!slot.studentFree) return 'conflict';
  if (!slot.advisorAvailable) return 'advisor-busy';
  return 'free';
}

const STYLES: Record<Status, { box: string; bar: string; label: string }> = {
  free: { box: 'bg-emerald-50 text-emerald-900', bar: 'bg-emerald-500', label: 'Both free' },
  conflict: { box: 'bg-red-50 text-red-900', bar: 'bg-red-500', label: 'Student in class' },
  'advisor-busy': { box: 'bg-gray-100 text-gray-600', bar: 'bg-gray-400', label: 'Advisor busy' },
};

export const AdvisorView: React.FC<{ email: string }> = ({ email }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [proposed, setProposed] = useState<string | null>(null);

  // Build the ordered list of day columns and the events within them.
  const { days, events } = useMemo(() => {
    const dayOrder: string[] = [];
    const evs: CalEvent[] = [];
    for (const slot of MUTUAL_ADVISOR_SLOTS) {
      const [startStr, endStr] = slot.time.split(' - ');
      const dateKey = `${slot.day} ${slot.date}`;
      if (!dayOrder.includes(dateKey)) dayOrder.push(dateKey);
      evs.push({
        slot,
        dateKey,
        startMin: parseMinutes(startStr),
        endMin: parseMinutes(endStr),
        status: statusFor(slot),
        conflictNote: !slot.studentFree ? 'BUSMHR 2292 lecture' : undefined,
      });
    }
    return { days: dayOrder, events: evs };
  }, []);

  const selected = events.find((e) => e.slot.id === selectedId) || null;
  const hours = Array.from({ length: (GRID_END - GRID_START) / 60 }, (_, i) => GRID_START + i * 60);
  const fmtHour = (min: number) => {
    const h = Math.floor(min / 60);
    const am = h < 12;
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12} ${am ? 'AM' : 'PM'}`;
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-[1200px] mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-5">
          <div className="h-1.5 bg-[#bb0000]" />
          <div className="p-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-50 text-[#bb0000] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Advisor schedule</h1>
              <p className="text-xs text-gray-600">Signed in as {email} · Advisor</p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_300px] gap-5">
          {/* Calendar */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-[#bb0000]" />
                <h2 className="font-semibold text-gray-900">Tyler Rez · mutual availability</h2>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                {(['free', 'conflict', 'advisor-busy'] as Status[]).map((s) => (
                  <span key={s} className="flex items-center gap-1.5 text-gray-600">
                    <span className={`w-2.5 h-2.5 rounded-sm ${STYLES[s].bar}`} />
                    {STYLES[s].label}
                  </span>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[640px]">
                {/* Day headers */}
                <div className="grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
                  <div />
                  {days.map((d) => {
                    const [wd, ...rest] = d.split(' ');
                    const dateNum = rest.join(' ').match(/\d+/)?.[0] ?? '';
                    return (
                      <div key={d} className="text-center pb-2 border-b border-gray-200">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          {wd.slice(0, 3)}
                        </div>
                        <div className="text-xl font-medium text-gray-900 leading-tight">{dateNum}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Time grid */}
                <div className="grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
                  {/* Time gutter */}
                  <div className="relative" style={{ height: hours.length * HOUR_PX }}>
                    {hours.map((h) => (
                      <div
                        key={h}
                        className="absolute right-2 -translate-y-1/2 text-[11px] text-gray-400"
                        style={{ top: ((h - GRID_START) / 60) * HOUR_PX }}
                      >
                        {fmtHour(h)}
                      </div>
                    ))}
                  </div>

                  {/* Day columns */}
                  {days.map((d) => (
                    <div
                      key={d}
                      className="relative border-l border-gray-100"
                      style={{ height: hours.length * HOUR_PX }}
                    >
                      {hours.map((h) => (
                        <div
                          key={h}
                          className="absolute left-0 right-0 border-t border-gray-100"
                          style={{ top: ((h - GRID_START) / 60) * HOUR_PX }}
                        />
                      ))}
                      {events
                        .filter((e) => e.dateKey === d)
                        .map((e) => {
                          const top = ((e.startMin - GRID_START) / 60) * HOUR_PX;
                          const height = Math.max(26, ((e.endMin - e.startMin) / 60) * HOUR_PX);
                          const st = STYLES[e.status];
                          const isSel = e.slot.id === selectedId;
                          const clickable = e.status === 'free';
                          return (
                            <button
                              key={e.slot.id}
                              onClick={() => clickable && setSelectedId(e.slot.id)}
                              className={`absolute left-1 right-1 rounded-md pl-2 pr-1 py-1 text-left overflow-hidden ${st.box} ${
                                clickable ? 'cursor-pointer hover:brightness-95' : 'cursor-default'
                              } ${isSel ? 'ring-2 ring-[#bb0000]' : ''}`}
                              style={{ top, height }}
                            >
                              <span className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-md ${st.bar}`} />
                              <div className="text-[11px] font-semibold leading-tight truncate">{e.slot.time.split(' - ')[0]}</div>
                              <div className="text-[10px] leading-tight truncate">
                                {e.conflictNote ?? st.label}
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Side panel */}
          <aside className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-gray-800 mb-3">Appointment</h2>
              {selected ? (
                <div className="text-sm">
                  <p className="font-semibold text-gray-900">{selected.dateKey}</p>
                  <p className="flex items-center gap-1.5 text-gray-600 mt-1.5">
                    <Clock className="w-4 h-4" /> {selected.slot.time}
                  </p>
                  <p className="flex items-center gap-1.5 text-gray-600 mt-1">
                    <MapPin className="w-4 h-4" /> {selected.slot.formatOptions.join(', ')}
                  </p>
                  {proposed === selected.slot.id ? (
                    <p className="mt-4 flex items-center gap-1.5 text-emerald-700 font-medium text-xs">
                      <Check className="w-4 h-4" /> Proposed to Tyler
                    </p>
                  ) : (
                    <button
                      onClick={() => setProposed(selected.slot.id)}
                      className="mt-4 w-full bg-[#bb0000] hover:bg-[#990000] text-white text-sm font-semibold py-2 rounded-lg"
                    >
                      Propose this time
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Select a green time on the calendar to propose it to the student.</p>
              )}
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-gray-800 mb-1">Routed requests</h2>
              <p className="text-xs text-gray-500">
                None yet. Student hold clearances and escalations will appear here once requests are saved (Session 4).
                You only see your own advisees, per the roles table in CLAUDE.md.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};
