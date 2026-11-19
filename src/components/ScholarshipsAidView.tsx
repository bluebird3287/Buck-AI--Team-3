// Scholarships & Financial Aid tab: Scholarship Universe, the FAFSA, and keeping aid.
//
// The goal is for students to find, apply for, and track scholarships without leaving BuckAI. Today that isn't
// feasible: Scholarship Universe has no public API and every application sits behind the student's OSU sign-in,
// so this tab links out and covers everything around it (dates, the FAFSA steps, and how the student's own plan
// affects their aid). Dates and rules come from Student Financial Aid (sfa.osu.edu); update AID_YEAR each fall.

import React, { useEffect, useState } from 'react';
import { Award, CalendarClock, CheckCircle2, Circle, Copy, ExternalLink, Info, MessageSquare, Rocket, ShieldCheck } from 'lucide-react';
import type { Semester, StudentProfile } from '../data/sampleData';

export const SCHOLARSHIP_UNIVERSE_URL = 'https://osu.scholarshipuniverse.com/';
const FAFSA_URL = 'https://studentaid.gov/h/apply-for-aid/fafsa';
const SFA_DATES_URL = 'https://sfa.osu.edu/current-student/apply-for-aid/important-dates';
const SFA_STEPS_URL = 'https://sfa.osu.edu/current-student/apply-for-aid/step-by-step';
const SAP_URL = 'https://sfa.osu.edu/contact-us/consumer-disclosure/satisfactory-academic-progress-policy';
const OSU_SCHOOL_CODE = '003090';

// From sfa.osu.edu "Important dates" (current students), checked 2026-11-19
const AID_YEAR = {
  label: '2027–2028',
  dates: [
    { id: 'fafsa-open', label: 'FAFSA opens', date: '2026-10-01', detail: 'File at StudentAid.gov with school code 003090.' },
    { id: 'su-open', label: 'Scholarship Universe opens', date: '2026-12-01', detail: 'Answer the matching questions so you see every scholarship you qualify for.' },
    { id: 'priority', label: 'Priority date: FAFSA + scholarships', date: '2027-02-01', detail: 'Most university scholarships and need-based aid go to students who finish both by this date.' },
  ],
};

// Each college also posts its own awards (many aren't in Scholarship Universe)
const COLLEGE_SCHOLARSHIPS: { match: RegExp; name: string; url: string }[] = [
  { match: /fisher|business/i, name: 'Fisher College of Business scholarships', url: 'https://fisher.osu.edu/undergraduate/admissions/scholarships-financial-aid' },
  { match: /engineering/i, name: 'College of Engineering scholarships', url: 'https://www.engineering.osu.edu/scholarships/current-students' },
  {
    match: /arts and sciences/i,
    name: 'Arts and Sciences scholarships',
    url: 'https://artsandsciences.osu.edu/current-students/undergraduate-students/scholarships-and-grants/merit-and-need-based-scholarships',
  },
];

const FAFSA_STEPS: { id: string; title: string; detail: string }[] = [
  {
    id: 'fsa-id',
    title: 'Create your StudentAid.gov account',
    detail: 'You and each contributor (a parent, if you’re a dependent student, and their spouse if needed) each need their own account. Verification can take a few days, so do this first.',
  },
  {
    id: 'gather',
    title: 'Gather what you’ll need',
    detail: 'Social Security numbers, 2025 tax information (the 2027–28 FAFSA uses taxes from two years earlier), and current savings and investment balances. Contributors consent to having their tax info pulled straight from the IRS.',
  },
  {
    id: 'file',
    title: 'Fill out the 2027–28 FAFSA',
    detail: `Add Ohio State with school code ${OSU_SCHOOL_CODE}. Every contributor signs and gives consent, or the FAFSA isn’t complete.`,
  },
  {
    id: 'summary',
    title: 'Check your FAFSA Submission Summary',
    detail: 'StudentAid.gov emails it when your FAFSA is processed. Fix anything flagged there.',
  },
  {
    id: 'todos',
    title: 'Watch your BuckeyeLink To Do list',
    detail: 'Student Financial Aid may ask for verification documents. Your aid isn’t final until those are done.',
  },
  {
    id: 'accept',
    title: 'Review and accept your aid in BuckeyeLink',
    detail: 'Accept grants and scholarships, and decide which loans (if any) you want. Refile the FAFSA every year.',
  },
];

const DAY = 86_400_000;
const parseDate = (iso: string) => new Date(`${iso}T23:59:59`);
const fmt = (iso: string) => parseDate(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

function dateStatus(iso: string, now: Date) {
  const days = Math.ceil((parseDate(iso).getTime() - now.getTime()) / DAY);
  if (days < 0) return { text: 'Open now', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (days === 0) return { text: 'Today', tone: 'bg-[#ba0c2f] text-white border-[#ba0c2f]' };
  return { text: `In ${days} day${days === 1 ? '' : 's'}`, tone: days <= 30 ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-neutral-50 text-neutral-600 border-neutral-200' };
}

// Checklist progress is a per-browser convenience; nothing here is official
const storageKey = (profile: StudentProfile) => `buckai.fafsa.${AID_YEAR.label}.${profile.nameDotNum || 'me'}`;
function loadChecked(key: string): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}');
  } catch {
    return {};
  }
}

const QUICK_QUESTIONS = [
  'What do I need to do for the FAFSA before the February 1 priority date?',
  'If I drop below 12 credit hours, what happens to my financial aid?',
  'How do I find scholarships for my major in Scholarship Universe?',
];

export const ScholarshipsAidView: React.FC<{
  profile: StudentProfile;
  roadmap: Semester[];
  onAsk?: (question: string) => void;
}> = ({ profile, roadmap, onAsk }) => {
  const now = new Date();
  const key = storageKey(profile);
  const [checked, setChecked] = useState<Record<string, boolean>>(() => loadChecked(key));
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(checked));
    } catch {
      /* private window: the checklist still works for this visit */
    }
  }, [key, checked]);

  const doneCount = FAFSA_STEPS.filter((s) => checked[s.id]).length;
  const college = COLLEGE_SCHOLARSHIPS.find((c) => c.match.test(profile.college || ''));

  // How the student's own record lines up with keeping aid
  const current = roadmap.find((s) => s.status === 'in-progress');
  const currentCredits = current?.totalCredits ?? null;
  const required = profile.totalRequiredCredits || 0;
  const maxHours = required ? Math.round(required * 1.5) : null;
  const gpaFloor = (profile.earnedCredits ?? 0) >= 30 ? 2.0 : 1.8;

  const checks = [
    {
      label: 'Full-time this term',
      value: currentCredits == null ? 'No current term on file' : `${currentCredits} credit hours${current ? ` (${current.name})` : ''}`,
      ok: currentCredits == null ? null : currentCredits >= 12,
      note: 'Most scholarships and the full Pell/Ohio grant amounts assume 12+ hours. Dropping below can shrink or cancel them, so check before you drop.',
    },
    {
      label: 'Cumulative GPA',
      value: profile.gpa ? `${profile.gpa.toFixed(2)} (minimum ${gpaFloor.toFixed(2)})` : 'Not on file',
      ok: profile.gpa ? profile.gpa >= gpaFloor : null,
      note: 'Financial aid progress (SAP) needs 1.80 by the end of your first year and 2.00 after that. Many scholarships set a higher bar (often 3.0).',
    },
    {
      label: 'Classes completed',
      value: 'At least 67% of attempted hours',
      ok: null,
      note: 'Withdrawals (W), failures, and incompletes count as attempted but not completed.',
    },
    {
      label: 'Time to degree',
      value: maxHours ? `${profile.earnedCredits ?? 0} of ${maxHours} attempted hours allowed` : '150% of your degree’s hours',
      ok: maxHours ? (profile.earnedCredits ?? 0) < maxHours : null,
      note: 'Aid stops once attempted hours pass 150% of the hours your degree requires. Transfer, repeated, and test credit all count.',
    },
  ];

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(OSU_SCHOOL_CODE);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the code is on screen */
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-[#fcfcfb]">
      {/* Scholarship Universe */}
      <div className="p-5 bg-white rounded-2xl border border-neutral-200/90 shadow-2xs space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#ba0c2f]/10 text-[#ba0c2f] flex items-center justify-center shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div className="space-y-1 min-w-0">
            <h3 className="text-base font-bold text-neutral-900">Scholarships &amp; Financial Aid</h3>
            <p className="text-xs text-neutral-600">
              Ohio State awards most of its scholarships through <strong>Scholarship Universe</strong>: one application, matched to hundreds of
              university, college, and donor awards. Sign in with your OSU username (lastname.#).
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={SCHOLARSHIP_UNIVERSE_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#ba0c2f] text-white text-sm font-semibold hover:bg-[#a00a28]"
          >
            Open Scholarship Universe <ExternalLink className="w-4 h-4" />
          </a>
          {college && (
            <a
              href={college.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-neutral-300 text-sm font-semibold text-neutral-800 hover:border-[#ba0c2f]"
            >
              {college.name} <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
        <ul className="text-xs text-neutral-700 space-y-1 list-disc pl-5">
          <li>Answer as many matching questions as you can. Each answer can unlock more scholarships.</li>
          <li>Some awards ask for an essay or recommendation; start those early, they take the longest.</li>
          <li>Many need-based scholarships also need a completed FAFSA, so do both.</li>
          <li>Your college and department post awards that aren’t in Scholarship Universe; check their pages too.</li>
        </ul>

        <div className="flex items-start gap-2 p-3 rounded-xl bg-neutral-50 border border-dashed border-neutral-300">
          <Rocket className="w-4 h-4 text-[#ba0c2f] shrink-0 mt-0.5" />
          <p className="text-[11px] text-neutral-600">
            <strong className="text-neutral-800">Where this is going:</strong> the plan is for BuckAI to match you to scholarships, help you
            draft essays, submit applications, and track every award here, without opening another site. Scholarship Universe doesn’t offer a
            way for other apps to connect yet, and applications sit behind your OSU sign-in, so for now BuckAI links you there and handles
            everything around it.
          </p>
        </div>
      </div>

      {/* Key dates */}
      <div className="p-5 bg-white rounded-2xl border border-neutral-200/90 shadow-2xs space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h4 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-[#ba0c2f]" /> {AID_YEAR.label} aid year dates
          </h4>
          <button
            onClick={copyCode}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-neutral-300 text-neutral-700 hover:border-[#ba0c2f]"
            title="Copy Ohio State's FAFSA school code"
          >
            <Copy className="w-3.5 h-3.5" /> School code {OSU_SCHOOL_CODE}
            {copied && <span className="text-emerald-600">Copied</span>}
          </button>
        </div>
        <ol className="space-y-2">
          {AID_YEAR.dates.map((d) => {
            const s = dateStatus(d.date, now);
            return (
              <li key={d.id} className="flex items-start gap-3 p-3 rounded-xl border border-neutral-200">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-neutral-900">{d.label}</div>
                  <div className="text-xs text-neutral-500">{fmt(d.date)}</div>
                  <div className="text-xs text-neutral-600 mt-1">{d.detail}</div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${s.tone}`}>{s.text}</span>
              </li>
            );
          })}
        </ol>
        <p className="text-[11px] text-neutral-500 flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
          <span>
            From Student Financial Aid’s{' '}
            <a href={SFA_DATES_URL} target="_blank" rel="noreferrer" className="underline hover:text-[#ba0c2f]">
              important dates
            </a>
            . Some colleges set earlier scholarship dates; check yours.
          </span>
        </p>
      </div>

      {/* FAFSA checklist */}
      <div className="p-5 bg-white rounded-2xl border border-neutral-200/90 shadow-2xs space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <a href={FAFSA_URL} target="_blank" rel="noreferrer" title="FAFSA form at StudentAid.gov" className="shrink-0">
              {/* FAFSA® wordmark from StudentAid.gov (U.S. Department of Education); used only to identify the form */}
              <img src="/fafsa-logo.svg" alt="FAFSA form" className="h-9 w-auto" />
            </a>
            <h4 className="text-sm font-bold text-neutral-900">FAFSA, step by step</h4>
          </div>
          <span className="text-[11px] font-semibold text-neutral-500">
            {doneCount} of {FAFSA_STEPS.length} done
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden">
          <div className="h-full bg-[#ba0c2f] transition-all" style={{ width: `${(doneCount / FAFSA_STEPS.length) * 100}%` }} />
        </div>
        <p className="text-xs text-neutral-600">
          The FAFSA is the one form for federal grants (Pell), work-study and loans, the Ohio College Opportunity Grant, and Ohio State’s
          need-based aid. It’s free, and you file it again every year.
        </p>
        <ul className="space-y-1.5">
          {FAFSA_STEPS.map((step, i) => {
            const done = !!checked[step.id];
            return (
              <li key={step.id}>
                <button
                  onClick={() => setChecked((c) => ({ ...c, [step.id]: !done }))}
                  className={`w-full text-left flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                    done ? 'border-emerald-200 bg-emerald-50/50' : 'border-neutral-200 hover:border-neutral-300'
                  }`}
                  aria-pressed={done}
                >
                  {done ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <Circle className="w-5 h-5 text-neutral-300 shrink-0" />}
                  <span className="min-w-0">
                    <span className={`block text-sm font-semibold ${done ? 'text-neutral-500 line-through' : 'text-neutral-900'}`}>
                      {i + 1}. {step.title}
                    </span>
                    <span className="block text-xs text-neutral-600 mt-0.5">{step.detail}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap gap-2">
          <a href={FAFSA_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#ba0c2f] hover:underline">
            Start the FAFSA at StudentAid.gov <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <span className="text-neutral-300">·</span>
          <a href={SFA_STEPS_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#ba0c2f] hover:underline">
            Ohio State’s step-by-step guide <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
        <p className="text-[11px] text-neutral-500">
          Your checkmarks are saved in this browser only. BuckAI never sees your FAFSA or tax information. FAFSA® is a registered mark of the U.S.
          Department of Education; BuckAI isn’t affiliated with or endorsed by it.
        </p>
      </div>

      {/* Keeping aid */}
      <div className="p-5 bg-white rounded-2xl border border-neutral-200/90 shadow-2xs space-y-3">
        <h4 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#ba0c2f]" /> Keeping your aid
        </h4>
        <p className="text-xs text-neutral-600">
          Your class choices affect your aid. Here’s how your BuckAI record lines up with Ohio State’s{' '}
          <a href={SAP_URL} target="_blank" rel="noreferrer" className="underline hover:text-[#ba0c2f]">
            Satisfactory Academic Progress
          </a>{' '}
          rules and common scholarship terms.
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          {checks.map((c) => (
            <div key={c.label} className="p-3 rounded-xl border border-neutral-200 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-neutral-800">{c.label}</span>
                {c.ok === true && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">On track</span>}
                {c.ok === false && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">Check with SFA</span>}
              </div>
              <div className="text-sm text-neutral-900">{c.value}</div>
              <div className="text-[11px] text-neutral-500">{c.note}</div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-neutral-500">
          This is a guide from the classes you entered, not an official review. Student Financial Aid (sfa.osu.edu, 614-292-0300) has the final
          word; ask them or your advisor before dropping a class if you have aid.
        </p>
      </div>

      {/* Ask BuckAI */}
      {onAsk && (
        <div className="p-5 bg-white rounded-2xl border border-neutral-200/90 shadow-2xs space-y-2">
          <h4 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#ba0c2f]" /> Ask BuckAI
          </h4>
          <div className="flex flex-col gap-2">
            {QUICK_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => onAsk(q)}
                className="text-left text-xs px-3 py-2 rounded-xl border border-neutral-200 hover:border-[#ba0c2f] hover:bg-[#ba0c2f]/5 text-neutral-800"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
