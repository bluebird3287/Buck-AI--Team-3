import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Star,
  Clock,
  BookOpen,
  Users,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  X,
  MessageSquarePlus,
  Info,
  CheckCircle2,
} from 'lucide-react';
import fisherData from '../data/fisherFaculty.json';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Rate My Professors search for an instructor at Ohio State (school 724). RMP doesn't publish
// professor IDs we could match, so this opens the search, which lists the professor's page.
const rateMyProfessorsUrl = (name: string) =>
  `https://www.ratemyprofessors.com/search/professors/724?q=${encodeURIComponent(name)}`;

type Faculty = (typeof fisherData.faculty)[number];
type Course = (typeof fisherData.courses)[number];

export interface FacultyReview {
  id: string;
  facultyId: string;
  courseId: string;
  term: string;
  overall: number;
  difficulty: number;
  hoursPerWeek: number;
  wouldTakeAgain: boolean;
  grade: string | null;
  tip: string | null;
  createdAt: string;
}

interface ReviewSummary {
  count: number;
  overall: number;
  difficulty: number;
  hoursPerWeek: number;
  wouldTakeAgainPercent: number;
}

const FACULTY: Faculty[] = fisherData.faculty;
const COURSES: Course[] = fisherData.courses;
const facultyById = new Map(FACULTY.map((f) => [f.id, f]));
const courseById = new Map(COURSES.map((c) => [c.id, c]));
const DEPARTMENTS = [...new Set(COURSES.map((c) => c.department))].sort();
const PAGE_SIZE = 20;

const HOURS_OPTIONS = [
  { label: '0–3 hrs / week', value: 2 },
  { label: '4–6 hrs / week', value: 5 },
  { label: '7–9 hrs / week', value: 8 },
  { label: '10–12 hrs / week', value: 11 },
  { label: '13–15 hrs / week', value: 14 },
  { label: '16+ hrs / week', value: 17 },
];
const GRADE_OPTIONS = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'E', 'S', 'U', 'W'];
const TERM_OPTIONS = [...fisherData.terms, 'Summer 2026', 'Spring 2026', 'Autumn 2025', 'Earlier'];

// Reviews live in the Supabase faculty_reviews table (supabase/migrations). user_id is never
// readable, so these are all the columns a client can select.
const REVIEW_COLUMNS =
  'id, faculty_id, course_id, term, overall, difficulty, hours_per_week, would_take_again, grade, tip, created_at';

interface FacultyReviewRow {
  id: string;
  faculty_id: string;
  course_id: string;
  term: string;
  overall: number;
  difficulty: number;
  hours_per_week: number;
  would_take_again: boolean;
  grade: string | null;
  tip: string | null;
  created_at: string;
}

const fromRow = (row: FacultyReviewRow): FacultyReview => ({
  id: row.id,
  facultyId: row.faculty_id,
  courseId: row.course_id,
  term: row.term,
  overall: row.overall,
  difficulty: row.difficulty,
  hoursPerWeek: row.hours_per_week,
  wouldTakeAgain: row.would_take_again,
  grade: row.grade,
  tip: row.tip,
  createdAt: row.created_at,
});

const CONTACT_DETAILS = /@|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/;

// Turn database errors into something a student can act on
function reviewErrorMessage(error: { code?: string; message: string }): string {
  if (error.code === '23505') return "You've already reviewed this course with this instructor for that term.";
  if (error.code === '42501') return 'Only signed-in students can add reviews.';
  if (error.code === '23514') return 'Some answers were not accepted. Check the tip has no email addresses or phone numbers.';
  return error.message;
}

function summarize(reviews: FacultyReview[]): ReviewSummary | null {
  if (reviews.length === 0) return null;
  const avg = (pick: (r: FacultyReview) => number) => reviews.reduce((sum, r) => sum + pick(r), 0) / reviews.length;
  return {
    count: reviews.length,
    overall: avg((r) => r.overall),
    difficulty: avg((r) => r.difficulty),
    hoursPerWeek: avg((r) => r.hoursPerWeek),
    wouldTakeAgainPercent: Math.round((reviews.filter((r) => r.wouldTakeAgain).length / reviews.length) * 100),
  };
}

function workloadLabel(hours: number): string {
  if (hours >= 12) return 'Heavy workload';
  if (hours >= 9) return 'Demanding';
  if (hours >= 6) return 'Moderate';
  return 'Manageable';
}

const SummaryBadges: React.FC<{ summary: ReviewSummary | null }> = ({ summary }) => {
  if (!summary) {
    return (
      <div className="text-xs text-neutral-500 italic">No student reviews yet</div>
    );
  }
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <span className="px-2.5 py-1 bg-amber-50 text-amber-900 rounded-full font-bold border border-amber-200 flex items-center gap-1">
        <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
        {summary.overall.toFixed(1)} / 5
      </span>
      <span className="px-2.5 py-1 bg-neutral-50 text-neutral-800 rounded-full font-semibold border border-neutral-200">
        Difficulty {summary.difficulty.toFixed(1)} / 5
      </span>
      <span className="px-2.5 py-1 bg-red-50 text-red-900 rounded-full font-semibold border border-red-200 flex items-center gap-1">
        <Clock className="w-3.5 h-3.5" />
        ~{Math.round(summary.hoursPerWeek)} hrs/wk · {workloadLabel(summary.hoursPerWeek)}
      </span>
      <span className="px-2.5 py-1 bg-emerald-50 text-emerald-900 rounded-full font-semibold border border-emerald-200">
        {summary.wouldTakeAgainPercent}% would take again
      </span>
      <span className="px-2.5 py-1 text-neutral-500 font-medium">
        {summary.count} review{summary.count === 1 ? '' : 's'}
      </span>
    </div>
  );
};

const TipList: React.FC<{ reviews: FacultyReview[]; showInstructor?: boolean }> = ({ reviews, showInstructor }) => {
  const withTips = reviews.filter((r) => r.tip).slice(-5).reverse();
  if (withTips.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="text-xs font-bold text-neutral-800 uppercase tracking-wider">Student tips</div>
      {withTips.map((r) => (
        <div key={r.id} className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-200/80 text-xs text-neutral-700 leading-relaxed">
          “{r.tip}”
          <div className="text-[11px] text-neutral-500 mt-1">
            {r.courseId}
            {showInstructor && ` · ${facultyById.get(r.facultyId)?.name ?? ''}`} · {r.term}
            {r.grade && ` · Grade: ${r.grade}`}
          </div>
        </div>
      ))}
    </div>
  );
};

const RatingButtons: React.FC<{ value: number; onChange: (n: number) => void; low: string; high: string }> = ({ value, onChange, low, high }) => (
  <div>
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`w-9 h-9 rounded-lg border text-sm font-bold transition-colors ${
            value === n ? 'bg-[#ba0c2f] text-white border-[#ba0c2f]' : 'bg-white text-neutral-700 border-neutral-300 hover:border-[#ba0c2f]'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
    <div className="flex justify-between text-[11px] text-neutral-500 mt-1 w-[13.5rem]">
      <span>{low}</span>
      <span>{high}</span>
    </div>
  </div>
);

interface ReviewTarget {
  facultyId?: string;
  courseId?: string;
}

const ReviewForm: React.FC<{
  target: ReviewTarget;
  onClose: () => void;
  onSaved: (review: FacultyReview) => void;
}> = ({ target, onClose, onSaved }) => {
  const [facultyId, setFacultyId] = useState(target.facultyId ?? '');
  const [courseId, setCourseId] = useState(target.courseId ?? '');
  const [term, setTerm] = useState('');
  const [overall, setOverall] = useState(0);
  const [difficulty, setDifficulty] = useState(0);
  const [hoursPerWeek, setHoursPerWeek] = useState<number | null>(null);
  const [wouldTakeAgain, setWouldTakeAgain] = useState<boolean | null>(null);
  const [grade, setGrade] = useState('');
  const [tip, setTip] = useState('');
  const [attested, setAttested] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const facultyOptions = target.courseId
    ? (courseById.get(target.courseId)?.instructorIds ?? []).map((id) => facultyById.get(id)!).filter(Boolean)
    : [];
  const courseOptions = target.facultyId ? facultyById.get(target.facultyId)?.courseIds ?? [] : [];
  const instructorName = facultyById.get(facultyId)?.name;

  const canSubmit =
    facultyId && courseId && term && overall && difficulty && hoursPerWeek !== null && wouldTakeAgain !== null && attested && !isSaving;

  const submit = async () => {
    const cleanTip = tip.trim();
    if (CONTACT_DETAILS.test(cleanTip)) {
      setError('Please leave email addresses and phone numbers out of your tip.');
      return;
    }
    setError(null);
    setIsSaving(true);
    const { data, error: insertError } = await supabase
      .from('faculty_reviews')
      .insert({
        faculty_id: facultyId,
        course_id: courseId,
        term,
        overall,
        difficulty,
        hours_per_week: hoursPerWeek,
        would_take_again: wouldTakeAgain,
        grade: grade || null,
        tip: cleanTip || null,
      })
      .select(REVIEW_COLUMNS)
      .single();
    setIsSaving(false);
    if (insertError) {
      setError(reviewErrorMessage(insertError));
      return;
    }
    onSaved(fromRow(data as FacultyReviewRow));
  };

  const labelClass = 'block text-xs font-bold text-neutral-800 mb-1.5';
  const selectClass = 'w-full px-3 py-2 rounded-lg border border-neutral-300 text-sm bg-white focus:outline-none focus:border-[#ba0c2f]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border border-gray-200">
        <div className="bg-[#ba0c2f] text-white p-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-bold text-base">Rate a Fisher course</h2>
            <p className="text-xs text-white/80">
              {instructorName ?? 'Choose an instructor'}
              {courseId && ` · ${courseId}`}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          {facultyOptions.length > 0 && (
            <div>
              <label className={labelClass}>Instructor</label>
              <select className={selectClass} value={facultyId} onChange={(e) => setFacultyId(e.target.value)}>
                <option value="">Select your instructor</option>
                {facultyOptions.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          )}

          {courseOptions.length > 0 && (
            <div>
              <label className={labelClass}>Course</label>
              <select className={selectClass} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                <option value="">Select the course you took</option>
                {courseOptions.map((id) => (
                  <option key={id} value={id}>{id} · {courseById.get(id)?.title}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className={labelClass}>When did you take it?</label>
            <select className={selectClass} value={term} onChange={(e) => setTerm(e.target.value)}>
              <option value="">Select a term</option>
              {TERM_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Overall, how was the class?</label>
            <RatingButtons value={overall} onChange={setOverall} low="Poor" high="Excellent" />
          </div>

          <div>
            <label className={labelClass}>How difficult was it?</label>
            <RatingButtons value={difficulty} onChange={setDifficulty} low="Easy" high="Very hard" />
          </div>

          <div>
            <label className={labelClass}>Time spent outside class</label>
            <select
              className={selectClass}
              value={hoursPerWeek ?? ''}
              onChange={(e) => setHoursPerWeek(e.target.value === '' ? null : Number(e.target.value))}
            >
              <option value="">Select hours per week</option>
              {HOURS_OPTIONS.map((h) => (
                <option key={h.value} value={h.value}>{h.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Would you take this instructor again?</label>
            <div className="flex gap-2">
              {[true, false].map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => setWouldTakeAgain(v)}
                  className={`px-4 py-2 rounded-lg border text-sm font-semibold ${
                    wouldTakeAgain === v ? 'bg-[#ba0c2f] text-white border-[#ba0c2f]' : 'bg-white text-neutral-700 border-neutral-300 hover:border-[#ba0c2f]'
                  }`}
                >
                  {v ? 'Yes' : 'No'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelClass}>Final grade (optional)</label>
            <select className={selectClass} value={grade} onChange={(e) => setGrade(e.target.value)}>
              <option value="">Prefer not to say</option>
              {GRADE_OPTIONS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Tip for future students (optional)</label>
            <textarea
              value={tip}
              onChange={(e) => setTip(e.target.value.slice(0, 400))}
              rows={3}
              placeholder="e.g. Start the group project early. The practice exams are close to the real ones."
              className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-sm focus:outline-none focus:border-[#ba0c2f]"
            />
            <div className="text-[11px] text-neutral-500 text-right">{tip.length}/400 · Keep it about the course, not the person</div>
          </div>

          <label className="flex items-start gap-2 text-xs text-neutral-700">
            <input type="checkbox" checked={attested} onChange={(e) => setAttested(e.target.checked)} className="mt-0.5" />
            I took this course with this instructor, and this review reflects my own experience.
          </label>

          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900">{error}</div>}
        </div>

        <div className="p-4 border-t border-neutral-200 flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-neutral-700 hover:bg-neutral-100">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="px-4 py-2 rounded-lg text-sm font-bold bg-[#ba0c2f] text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving…' : 'Submit review'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const FacultyEvaluationsView: React.FC = () => {
  const [mode, setMode] = useState<'faculty' | 'courses'>('faculty');
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('All');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviews, setReviews] = useState<FacultyReview[]>([]);
  const [storageEnabled, setStorageEnabled] = useState(isSupabaseConfigured);
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase
      .from('faculty_reviews')
      .select(REVIEW_COLUMNS)
      .order('created_at')
      .then(({ data, error }) => {
        if (error) {
          console.error('Failed to load faculty reviews:', error);
          setStorageEnabled(false);
          return;
        }
        setReviews((data as FacultyReviewRow[]).map(fromRow));
      });
  }, []);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    setExpandedId(null);
  }, [mode, query, department]);

  const reviewsByFaculty = useMemo(() => groupBy(reviews, (r) => r.facultyId), [reviews]);
  const reviewsByCourse = useMemo(() => groupBy(reviews, (r) => r.courseId), [reviews]);

  const needle = query.trim().toLowerCase();
  const filteredFaculty = useMemo(
    () =>
      FACULTY.filter((f) => {
        if (department !== 'All' && !f.courseIds.some((id) => courseById.get(id)?.department === department)) return false;
        if (!needle) return true;
        return (
          f.name.toLowerCase().includes(needle) ||
          f.courseIds.some((id) => id.toLowerCase().includes(needle) || courseById.get(id)?.title.toLowerCase().includes(needle))
        );
      }),
    [needle, department]
  );
  const filteredCourses = useMemo(
    () =>
      COURSES.filter((c) => {
        if (department !== 'All' && c.department !== department) return false;
        if (!needle) return true;
        return (
          c.id.toLowerCase().includes(needle) ||
          c.title.toLowerCase().includes(needle) ||
          c.instructorIds.some((id) => facultyById.get(id)?.name.toLowerCase().includes(needle))
        );
      }),
    [needle, department]
  );

  const results = mode === 'faculty' ? filteredFaculty : filteredCourses;
  const generatedDate = new Date(fisherData.generatedAt).toLocaleDateString('en-US', { dateStyle: 'medium' });

  const handleSaved = (review: FacultyReview) => {
    setReviews((prev) => [...prev, review]);
    setReviewTarget(null);
    setSavedMessage(`Thanks! Your review of ${review.courseId} with ${facultyById.get(review.facultyId)?.name} was saved.`);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-[#fcfcfb]">
      <div className="p-5 bg-white rounded-2xl border border-neutral-200/90 shadow-2xs space-y-2">
        <h3 className="text-base font-bold text-neutral-900">Fisher Faculty &amp; Course Evaluations</h3>
        <p className="text-xs text-neutral-600">
          Every undergraduate Fisher course and instructor for {fisherData.terms.join(' and ')} ({FACULTY.length} instructors, {COURSES.length} courses).
          Ratings, workload and tips come only from students who reviewed the class here.
        </p>
        <div className="flex items-start gap-1.5 text-[11px] text-neutral-500">
          <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
          <span>
            Course and instructor data from{' '}
            {fisherData.sources.map((s, i) => (
              <React.Fragment key={s.url}>
                {i > 0 && ' and '}
                <a href={s.url} target="_blank" rel="noreferrer" className="underline hover:text-[#ba0c2f]">{s.name}</a>
              </React.Fragment>
            ))}
            , updated {generatedDate}.
          </span>
        </div>
      </div>

      {savedMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="flex-1">{savedMessage}</span>
          <button onClick={() => setSavedMessage(null)} aria-label="Dismiss"><X className="w-4 h-4" /></button>
        </div>
      )}
      {!storageEnabled && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
          Student reviews aren't available right now. Browsing courses and instructors still works.
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex bg-neutral-100 rounded-xl p-1 shrink-0">
          {(['faculty', 'courses'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                mode === m ? 'bg-white text-[#ba0c2f] shadow-2xs' : 'text-neutral-600'
              }`}
            >
              {m === 'faculty' ? <Users className="w-3.5 h-3.5" /> : <BookOpen className="w-3.5 h-3.5" />}
              {m === 'faculty' ? 'Instructors' : 'Courses'}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={mode === 'faculty' ? 'Search by name or course (e.g. BUSFIN 3220)' : 'Search by course, title or instructor'}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-neutral-300 text-sm bg-white focus:outline-none focus:border-[#ba0c2f]"
          />
        </div>
        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="px-3 py-2 rounded-xl border border-neutral-300 text-sm bg-white focus:outline-none focus:border-[#ba0c2f] sm:max-w-[14rem]"
        >
          <option value="All">All departments</option>
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      <div className="text-xs text-neutral-500">
        {results.length} {mode === 'faculty' ? 'instructors' : 'courses'}
      </div>

      <div className="space-y-3">
        {mode === 'faculty'
          ? filteredFaculty.slice(0, visibleCount).map((f) => {
              const facultyReviews = reviewsByFaculty.get(f.id) ?? [];
              const isExpanded = expandedId === f.id;
              return (
                <div key={f.id} className="bg-white rounded-2xl border border-neutral-200/90 p-4 space-y-3 shadow-2xs">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-neutral-900">{f.name}</h4>
                      <div className="text-xs text-neutral-600">
                        {[f.title, f.department].filter(Boolean).join(' · ')}
                      </div>
                      <div className="text-[11px] text-neutral-500 mt-0.5">Teaching {f.terms.join(', ')}</div>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      {f.profileUrl && (
                        <a
                          href={f.profileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1.5 rounded-lg border border-neutral-300 text-xs font-semibold text-neutral-700 hover:border-[#ba0c2f] flex items-center gap-1"
                        >
                          Profile <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      <a
                        href={rateMyProfessorsUrl(f.name)}
                        target="_blank"
                        rel="noreferrer"
                        title={`Search Rate My Professors for ${f.name} at Ohio State`}
                        className="px-2.5 py-1.5 rounded-lg border border-neutral-300 text-xs font-semibold text-neutral-700 hover:border-[#ba0c2f] flex items-center gap-1"
                      >
                        Rate My Professors <ExternalLink className="w-3 h-3" />
                      </a>
                      {storageEnabled && (
                        <button
                          onClick={() => setReviewTarget({ facultyId: f.id })}
                          className="px-2.5 py-1.5 rounded-lg bg-[#ba0c2f] text-white text-xs font-bold flex items-center gap-1"
                        >
                          <MessageSquarePlus className="w-3.5 h-3.5" /> Rate
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {f.courseIds.map((id) => (
                      <span key={id} title={courseById.get(id)?.title} className="px-2 py-0.5 bg-neutral-100 rounded-md text-[11px] font-semibold text-neutral-700">
                        {id}
                      </span>
                    ))}
                  </div>

                  <SummaryBadges summary={summarize(facultyReviews)} />

                  {facultyReviews.length > 0 && (
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : f.id)}
                      className="text-xs font-semibold text-[#ba0c2f] flex items-center gap-1"
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      {isExpanded ? 'Hide details' : 'Show details by course'}
                    </button>
                  )}
                  {isExpanded && (
                    <div className="space-y-3 pt-1">
                      {f.courseIds
                        .filter((id) => facultyReviews.some((r) => r.courseId === id))
                        .map((id) => (
                          <div key={id} className="space-y-1.5">
                            <div className="text-xs font-bold text-neutral-800">{id} · {courseById.get(id)?.title}</div>
                            <SummaryBadges summary={summarize(facultyReviews.filter((r) => r.courseId === id))} />
                          </div>
                        ))}
                      <TipList reviews={facultyReviews} />
                    </div>
                  )}
                </div>
              );
            })
          : filteredCourses.slice(0, visibleCount).map((c) => {
              const courseReviews = reviewsByCourse.get(c.id) ?? [];
              const isExpanded = expandedId === c.id;
              const instructors = c.instructorIds.map((id) => facultyById.get(id)).filter(Boolean) as Faculty[];
              return (
                <div key={c.id} className="bg-white rounded-2xl border border-neutral-200/90 p-4 space-y-3 shadow-2xs">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-neutral-900">{c.id} · {c.title}</h4>
                      <div className="text-xs text-neutral-600">
                        {c.department} · {c.credits} credit{c.credits === '1' ? '' : 's'}
                        {c.grading !== 'Graded' && ` · ${c.grading}`}
                      </div>
                      <div className="text-[11px] text-neutral-500 mt-0.5">
                        {c.terms.map((t) => `${t.term}: ${t.sections} section${t.sections === 1 ? '' : 's'} (${t.instructionModes.join(', ')})`).join(' · ')}
                      </div>
                    </div>
                    {storageEnabled && instructors.length > 0 && (
                      <button
                        onClick={() => setReviewTarget({ courseId: c.id })}
                        className="px-2.5 py-1.5 rounded-lg bg-[#ba0c2f] text-white text-xs font-bold flex items-center gap-1 shrink-0 self-start"
                      >
                        <MessageSquarePlus className="w-3.5 h-3.5" /> Rate
                      </button>
                    )}
                  </div>

                  {c.prereq && <div className="text-xs text-neutral-700"><span className="font-semibold">Prereq:</span> {c.prereq}</div>}

                  <div className="text-xs text-neutral-700">
                    <span className="font-semibold">Instructors:</span>{' '}
                    {instructors.length > 0 ? instructors.map((f) => f.name).join(', ') : 'Not yet assigned'}
                  </div>

                  <SummaryBadges summary={summarize(courseReviews)} />

                  <button
                    onClick={() => setExpandedId(isExpanded ? null : c.id)}
                    className="text-xs font-semibold text-[#ba0c2f] flex items-center gap-1"
                  >
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    {isExpanded ? 'Hide details' : courseReviews.length > 0 ? 'Compare instructors & read tips' : 'Course description'}
                  </button>
                  {isExpanded && (
                    <div className="space-y-3 pt-1">
                      <p className="text-xs text-neutral-600 leading-relaxed">{c.description}</p>
                      {instructors
                        .filter((f) => courseReviews.some((r) => r.facultyId === f.id))
                        .map((f) => (
                          <div key={f.id} className="space-y-1.5">
                            <div className="text-xs font-bold text-neutral-800">{f.name}</div>
                            <SummaryBadges summary={summarize(courseReviews.filter((r) => r.facultyId === f.id))} />
                          </div>
                        ))}
                      <TipList reviews={courseReviews} showInstructor />
                    </div>
                  )}
                </div>
              );
            })}
      </div>

      {results.length > visibleCount && (
        <button
          onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
          className="w-full py-2.5 rounded-xl border border-neutral-300 text-xs font-bold text-neutral-700 hover:border-[#ba0c2f] bg-white"
        >
          Show more ({results.length - visibleCount} remaining)
        </button>
      )}
      {results.length === 0 && (
        <div className="p-6 text-center text-xs text-neutral-500 bg-white rounded-2xl border border-neutral-200/90">
          No {mode === 'faculty' ? 'instructors' : 'courses'} match your search.
        </div>
      )}

      {reviewTarget && <ReviewForm target={reviewTarget} onClose={() => setReviewTarget(null)} onSaved={handleSaved} />}
    </div>
  );
};

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    groups.set(k, [...(groups.get(k) ?? []), item]);
  }
  return groups;
}
