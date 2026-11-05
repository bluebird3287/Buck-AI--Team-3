import React, { useMemo } from 'react';
import { Clock, MapPin, Mail, ExternalLink, UserCheck, CalendarDays, Info, Loader2 } from 'lucide-react';
import type { Semester } from '../data/sampleData';
import {
  OfficeHoursLoad,
  WEEKDAYS,
  currentCourses,
  entriesForCourse,
  formatTime,
  nextSession,
  people,
  syllabusUrl,
} from '../lib/officeHours';

interface OfficeHoursViewProps {
  roadmap: Semester[];
  picks: Record<string, string>; // course code -> the student's instructor
  onPick: (courseCode: string, personName: string | null) => void;
  load: OfficeHoursLoad | null; // loaded once by App (the chat uses it too)
}

const norm = (code: string) => code.trim().toUpperCase().replace(/\s+/g, ' ');

// Office hours for the professors and TAs of the classes a student is taking this term, from Fisher
// syllabi in Simple Syllabus. The student marks their own instructor so their section comes first.
export const OfficeHoursView: React.FC<OfficeHoursViewProps> = ({ roadmap, picks, onPick, load }) => {

  const courses = currentCourses(roadmap);
  const entries = load?.status === 'ok' ? load.entries : [];
  const byCourse = useMemo(
    () => courses.map((c) => ({ course: c, list: people(entriesForCourse(entries, c.code)) })),
    [courses, entries],
  );

  // This week: the student's own instructors (or everyone for classes they haven't picked yet)
  const week = useMemo(() => {
    const rows: { day: string; start: string; end: string; who: string; code: string; mode?: string }[] = [];
    for (const { course, list } of byCourse) {
      const mine = picks[norm(course.code)];
      const shown = mine ? list.filter((p) => p.entry.person_name === mine || p.entry.role !== 'Instructor') : list.filter((p) => p.exact);
      for (const p of shown)
        for (const s of p.entry.sessions) rows.push({ ...s, who: `${p.entry.person_name}${p.entry.role === 'Instructor' ? '' : ` (${p.entry.role})`}`, code: course.code });
    }
    return WEEKDAYS.slice(0, 5).map((d) => ({ day: d, rows: rows.filter((r) => r.day === d).sort((a, b) => a.start.localeCompare(b.start)) }));
  }, [byCourse, picks]);

  if (!load)
    return (
      <div className="p-6 text-sm text-gray-600 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading office hours…
      </div>
    );
  if (load.status === 'not_osu')
    return (
      <div className="p-6 text-sm text-gray-700">
        Office hours come from Ohio State syllabi that are shared only with the Ohio State community, so they&apos;re available to
        accounts with an @osu.edu email.
      </div>
    );
  if (load.status === 'error') return <div className="p-6 text-sm text-red-800">Couldn&apos;t load office hours: {load.message}</div>;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-[#f8fafc]">
      <div>
        <h3 className="text-base sm:text-lg font-bold text-gray-900">Office Hours</h3>
        <p className="text-xs text-gray-600 mt-0.5">
          Who teaches each of your classes this term, from their syllabi in Ohio State&apos;s Simple Syllabus library, with office hours
          when the syllabus lists them. Mark your instructor so your section shows first. Most instructors post office hours in Carmen,
          so check there for the latest.
        </p>
      </div>

      {!courses.length && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
          Add this term&apos;s classes under <strong>My classes</strong> to see their office hours.
        </div>
      )}

      {week.some((d) => d.rows.length) && (
        <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
          <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4 text-[#ba0c2f]" /> Your week of office hours
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
            {week.map((d) => (
              <div key={d.day} className="border border-gray-100 rounded-md p-2 min-h-[64px]">
                <div className="text-[11px] font-bold uppercase text-gray-500">{d.day}</div>
                {d.rows.length ? (
                  d.rows.map((r, i) => (
                    <div key={i} className="mt-1 text-[11px] leading-snug">
                      <span className="font-semibold text-gray-900">
                        {formatTime(r.start)}–{formatTime(r.end)}
                      </span>{' '}
                      <span className="text-gray-700">
                        {r.code} · {r.who}
                        {r.mode && r.mode !== 'In person' ? ` · ${r.mode}` : ''}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="mt-1 text-[11px] text-gray-400">—</div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {byCourse.map(({ course, list }) => {
        const mine = picks[norm(course.code)];
        return (
          <section key={course.code} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="text-sm font-bold text-gray-900">
                {course.code} <span className="font-normal text-gray-600">· {course.name}</span>
              </h4>
              {list.length > 0 && <span className="text-[11px] text-gray-500">{list.length} {list.length === 1 ? 'person' : 'people'} with office hours</span>}
            </div>
            {!list.length ? (
              <p className="text-xs text-gray-600 flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                No Fisher syllabus for this class yet (BuckAI reads Fisher syllabi only). Check the syllabus on Carmen.
              </p>
            ) : (
              <ul className="grid gap-2 lg:grid-cols-2">
                {list.map(({ entry: e, exact, classNumbers }) => {
                  const isMine = mine === e.person_name;
                  const next = nextSession(e.sessions);
                  return (
                    <li
                      key={`${e.person_name}-${e.role}-${e.hours_text}`}
                      className={`border rounded-md p-3 text-xs space-y-1.5 ${isMine ? 'border-[#ba0c2f] bg-red-50/40' : 'border-gray-200'} ${mine && !isMine && e.role === 'Instructor' ? 'opacity-70' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-gray-900 text-sm">{e.person_name}</div>
                          <div className="text-gray-500">
                            {e.role}
                            {classNumbers.length ? ` · section${classNumbers.length > 1 ? 's' : ''} ${classNumbers.join(', ')}` : ''}
                            {!exact ? ` · ${e.course_code}` : ''}
                          </div>
                        </div>
                        {e.role === 'Instructor' && (
                          <button
                            onClick={() => onPick(course.code, isMine ? null : e.person_name)}
                            className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded border font-semibold ${
                              isMine ? 'border-[#ba0c2f] text-[#ba0c2f] bg-white' : 'border-gray-300 text-gray-700 hover:border-gray-500'
                            }`}
                          >
                            <UserCheck className="w-3 h-3" /> {isMine ? 'My instructor' : 'This is mine'}
                          </button>
                        )}
                      </div>
                      <div className="flex items-start gap-1.5 text-gray-800">
                        <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-gray-500" />
                        <span>
                          {e.hours_text || (e.by_appointment ? 'By appointment' : 'Not in the syllabus: check Carmen')}
                          {next && (
                            <span className="block text-emerald-800">
                              Next: {next.inDays === 0 ? 'today' : next.inDays === 1 ? 'tomorrow' : next.session.day} {formatTime(next.session.start)}
                            </span>
                          )}
                        </span>
                      </div>
                      {e.location && (
                        <div className="flex items-start gap-1.5 text-gray-700">
                          <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-gray-500" /> {e.location}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-3 pt-0.5">
                        {e.email && (
                          <a href={`mailto:${e.email}`} className="inline-flex items-center gap-1 text-[#ba0c2f] hover:underline">
                            <Mail className="w-3.5 h-3.5" /> {e.email}
                          </a>
                        )}
                        <a href={syllabusUrl(e.source_code)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-gray-600 hover:underline">
                          Syllabus <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
};
