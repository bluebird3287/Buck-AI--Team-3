// Scholarships & FAFSA tab: one path in three steps (file the FAFSA, apply in Scholarship Universe, keep your aid).
//
// The goal is for students to find, apply for, and track scholarships without leaving BuckAI. Today that isn't
// feasible: Scholarship Universe has no public API and every application sits behind the student's OSU sign-in,
// so this tab links out and covers everything around it. Dates and rules come from Student Financial Aid
// (sfa.osu.edu); update AID_YEAR each fall (and the 'aid' facts in server.ts).

import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, CheckCircle2, ChevronDown, Circle, Copy, ExternalLink, MessageSquare } from 'lucide-react';
import type { Semester, StudentProfile } from '../data/sampleData';

export const SCHOLARSHIP_UNIVERSE_URL = 'https://osu.scholarshipuniverse.com/';
const FAFSA_URL = 'https://studentaid.gov/h/apply-for-aid/fafsa';
const SFA_DATES_URL = 'https://sfa.osu.edu/current-student/apply-for-aid/important-dates';
const SAP_URL = 'https://sfa.osu.edu/contact-us/consumer-disclosure/satisfactory-academic-progress-policy';
const OSU_SCHOOL_CODE = '003090';

// From sfa.osu.edu "Important dates" (current students), checked 2026-11-19
const AID_YEAR = {
  label: '2027–28',
  fafsaOpens: '2026-10-01',
  suOpens: '2026-12-01',
  priority: '2027-02-01',
};

// Each college also posts its own awards (many aren't in Scholarship Universe)
const COLLEGE_SCHOLARSHIPS: { match: RegExp; name: string; url: string }[] = [
  { match: /fisher|business/i, name: 'Fisher scholarships', url: 'https://fisher.osu.edu/undergraduate/admissions/scholarships-financial-aid' },
  { match: /engineering/i, name: 'Engineering scholarships', url: 'https://www.engineering.osu.edu/scholarships/current-students' },
  {
    match: /arts and sciences/i,
    name: 'Arts and Sciences scholarships',
    url: 'https://artsandsciences.osu.edu/current-students/undergraduate-students/scholarships-and-grants/merit-and-need-based-scholarships',
  },
];

const FAFSA_STEPS: { id: string; title: string; detail: string }[] = [
  { id: 'fsa-id', title: 'Make a StudentAid.gov account', detail: 'You and each parent who reports info need your own. Verification can take a few days.' },
  { id: 'gather', title: 'Have your 2025 tax info ready', detail: 'Plus Social Security numbers and savings balances. Tax info is pulled from the IRS with your consent.' },
  { id: 'file', title: 'Fill out the FAFSA', detail: `Add Ohio State (school code ${OSU_SCHOOL_CODE}). Everyone who contributes must sign.` },
  { id: 'todos', title: 'Clear your BuckeyeLink To Do list', detail: 'Student Financial Aid may ask for documents. Aid isn’t final until they’re in.' },
  { id: 'accept', title: 'Accept your aid in BuckeyeLink', detail: 'Choose which grants, scholarships, and loans to take. Refile every year.' },
];

const DAY = 86_400_000;
const parseDate = (iso: string) => new Date(`${iso}T23:59:59`);
const short = (iso: string) => parseDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const daysUntil = (iso: string, now: Date) => Math.ceil((parseDate(iso).getTime() - now.getTime()) / DAY);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Checklist progress is a per-browser convenience; nothing here is official
const storageKey = (profile: StudentProfile) => `buckai.fafsa.${AID_YEAR.label}.${profile.nameDotNum || 'me'}`;
function loadChecked(key: string): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}');
  } catch {
    return {};
  }
}

const QUICK_QUESTIONS = ['What happens to my aid if I drop below 12 hours?', 'Which scholarships fit my major?', 'Do I need my parents’ info for the FAFSA?'];

type StepId = 'fafsa' | 'su' | 'keep';
type Tone = 'done' | 'todo' | 'wait' | 'warn';
const PILL: Record<Tone, string> = {
  done: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  todo: 'bg-[#ba0c2f]/10 text-[#ba0c2f] border-[#ba0c2f]/20',
  wait: 'bg-neutral-100 text-neutral-600 border-neutral-200',
  warn: 'bg-amber-50 text-amber-800 border-amber-200',
};

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

  // Where the student is
  const doneCount = FAFSA_STEPS.filter((s) => checked[s.id]).length;
  const fafsaDone = doneCount === FAFSA_STEPS.length;
  const fafsaFiled = !!checked.file;
  const suDays = daysUntil(AID_YEAR.suOpens, now);
  const suOpen = suDays <= 0;
  const priorityDays = daysUntil(AID_YEAR.priority, now);
  const college = COLLEGE_SCHOLARSHIPS.find((c) => c.match.test(profile.college || ''));

  // How the student's own record lines up with keeping aid
  const current = roadmap.find((s) => s.status === 'in-progress');
  const credits = current?.totalCredits ?? null;
  const required = profile.totalRequiredCredits || 0;
  const maxHours = required ? Math.round(required * 1.5) : null;
  const earned = profile.earnedCredits ?? 0;
  const gpaFloor = earned >= 30 ? 2.0 : 1.8;
  const checks: { label: string; value: string; ok: boolean | null; rule: string }[] = [
    {
      label: 'Full-time this term',
      value: credits == null ? 'No current term on file' : `${credits} credit hours`,
      ok: credits == null ? null : credits >= 12,
      rule: 'Most scholarships and full grants need 12+ hours.',
    },
    {
      label: 'GPA',
      value: profile.gpa ? profile.gpa.toFixed(2) : 'Not on file',
      ok: profile.gpa ? profile.gpa >= gpaFloor : null,
      rule: `Aid needs ${gpaFloor.toFixed(2)}+; many scholarships want 3.0+.`,
    },
    {
      label: 'Classes finished',
      value: 'Finish 67% of what you attempt',
      ok: null,
      rule: 'W, E, and I grades count against you.',
    },
    {
      label: 'Hours used',
      value: maxHours ? `${earned} of ${maxHours} max` : '150% of your degree',
      ok: maxHours ? earned < maxHours : null,
      rule: 'Aid ends at 150% of your degree’s hours.',
    },
  ];
  const keepOk = checks.every((c) => c.ok !== false);

  // The one thing to do next
  const next: { step: StepId; title: string; detail: string } = !fafsaFiled
    ? { step: 'fafsa', title: 'File your FAFSA', detail: `${plural(priorityDays, 'day')} until the Feb 1 priority date.` }
    : !suOpen
    ? { step: 'su', title: `Scholarship Universe opens ${short(AID_YEAR.suOpens)}`, detail: `In ${plural(suDays, 'day')}. Apply by Feb 1.` }
    : priorityDays >= 0
    ? { step: 'su', title: 'Apply in Scholarship Universe', detail: `${plural(priorityDays, 'day')} until the Feb 1 priority date.` }
    : { step: 'fafsa', title: 'Finish your FAFSA steps', detail: 'Accept your aid in BuckeyeLink once it’s offered.' };

  const [open, setOpen] = useState<StepId | null>(next.step);
  const goTo = (step: StepId) => {
    setOpen(step);
    requestAnimationFrame(() => document.getElementById(`aid-step-${step}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(OSU_SCHOOL_CODE);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the code is on screen */
    }
  };

  const timeline = [
    { label: 'FAFSA opens', date: AID_YEAR.fafsaOpens },
    { label: 'Scholarships open', date: AID_YEAR.suOpens },
    { label: 'Priority date', date: AID_YEAR.priority },
  ];

  const steps: { id: StepId; title: string; summary: string; pill: { text: string; tone: Tone }; body: React.ReactNode }[] = [
    {
      id: 'fafsa',
      title: 'File the FAFSA',
      summary: 'Unlocks grants, work-study, loans, and need-based scholarships.',
      pill: fafsaDone ? { text: 'Done', tone: 'done' } : { text: `${doneCount} of ${FAFSA_STEPS.length} done`, tone: 'todo' },
      body: (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <img src="/fafsa-logo.svg" alt="FAFSA form" className="h-8 w-auto" />
            <button
              onClick={copyCode}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-neutral-300 text-neutral-700 hover:border-[#ba0c2f]"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              Ohio State code {OSU_SCHOOL_CODE}
            </button>
          </div>
          <ol className="space-y-1.5">
            {FAFSA_STEPS.map((s, i) => {
              const done = !!checked[s.id];
              return (
                <li key={s.id}>
                  <button
                    onClick={() => setChecked((c) => ({ ...c, [s.id]: !done }))}
                    aria-pressed={done}
                    className={`w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
                      done ? 'border-emerald-200 bg-emerald-50/60' : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    {done ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <Circle className="w-5 h-5 text-neutral-300 shrink-0" />}
                    <span className="min-w-0">
                      <span className={`block text-sm font-semibold ${done ? 'text-neutral-500 line-through' : 'text-neutral-900'}`}>
                        {i + 1}. {s.title}
                      </span>
                      <span className="block text-xs text-neutral-600">{s.detail}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <a
            href={FAFSA_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#ba0c2f] text-white text-sm font-semibold hover:bg-[#a00a28]"
          >
            Start the FAFSA <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      ),
    },
    {
      id: 'su',
      title: 'Apply for scholarships',
      summary: 'One application in Scholarship Universe matches you to hundreds of OSU awards.',
      pill: suOpen ? { text: 'Open now', tone: 'todo' } : { text: `Opens ${short(AID_YEAR.suOpens)}`, tone: 'wait' },
      body: (
        <div className="space-y-3">
          <ol className="text-sm text-neutral-800 space-y-1.5 list-decimal pl-5">
            <li>Sign in with your OSU username (lastname.#).</li>
            <li>Answer as many matching questions as you can. More answers, more matches.</li>
            <li>Apply to each match by Feb 1. Start essays early.</li>
          </ol>
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
          <p className="text-xs text-neutral-500">Some college and department awards aren’t in Scholarship Universe, so check your college’s page too.</p>
        </div>
      ),
    },
    {
      id: 'keep',
      title: 'Keep your aid',
      summary: 'Your classes and grades decide whether aid renews.',
      pill: keepOk ? { text: 'On track', tone: 'done' } : { text: 'Check with SFA', tone: 'warn' },
      body: (
        <div className="space-y-3">
          <ul className="divide-y divide-neutral-100 border border-neutral-200 rounded-xl">
            {checks.map((c) => (
              <li key={c.label} className="flex items-start justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-neutral-900">
                    {c.label}: <span className="font-normal">{c.value}</span>
                  </div>
                  <div className="text-xs text-neutral-500">{c.rule}</div>
                </div>
                {c.ok === true && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" aria-label="On track" />}
                {c.ok === false && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${PILL.warn}`}>Below</span>}
              </li>
            ))}
          </ul>
          <p className="text-xs text-neutral-500">
            Thinking of dropping a class? Ask Student Financial Aid (614-292-0300) first. Rules:{' '}
            <a href={SAP_URL} target="_blank" rel="noreferrer" className="underline hover:text-[#ba0c2f]">
              Satisfactory Academic Progress
            </a>
            .
          </p>
        </div>
      ),
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#fcfcfb]">
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Header + next step */}
        <div className="p-5 bg-white rounded-2xl border border-neutral-200/90 shadow-2xs space-y-4">
          <div>
            <h3 className="text-lg font-bold text-neutral-900">Paying for {AID_YEAR.label}</h3>
            <p className="text-sm text-neutral-600">Three steps: file the FAFSA, apply for scholarships, and keep your aid.</p>
          </div>

          <button
            onClick={() => goTo(next.step)}
            className="w-full text-left flex items-center gap-3 p-4 rounded-xl bg-[#ba0c2f] text-white hover:bg-[#a00a28] transition-colors"
          >
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold uppercase tracking-wide text-white/75">Your next step</div>
              <div className="text-base font-bold">{next.title}</div>
              <div className="text-xs text-white/85">{next.detail}</div>
            </div>
            <ArrowRight className="w-5 h-5 shrink-0" />
          </button>

          {/* Timeline */}
          <ol className="grid grid-cols-3 gap-2">
            {timeline.map((t) => {
              const passed = daysUntil(t.date, now) < 0;
              return (
                <li key={t.label} className="relative">
                  <div className={`h-1 rounded-full ${passed ? 'bg-[#ba0c2f]' : 'bg-neutral-200'}`} />
                  <div className="pt-2">
                    <div className={`text-sm font-bold ${passed ? 'text-neutral-900' : 'text-neutral-700'}`}>{short(t.date)}</div>
                    <div className="text-xs text-neutral-500 leading-tight">{t.label}</div>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="text-[11px] text-neutral-500">
            Dates from{' '}
            <a href={SFA_DATES_URL} target="_blank" rel="noreferrer" className="underline hover:text-[#ba0c2f]">
              Student Financial Aid
            </a>
            . Some colleges set earlier scholarship deadlines.
          </p>
        </div>

        {/* The three steps */}
        {steps.map((s, i) => {
          const isOpen = open === s.id;
          return (
            <section key={s.id} id={`aid-step-${s.id}`} className="bg-white rounded-2xl border border-neutral-200/90 shadow-2xs scroll-mt-4">
              <button onClick={() => setOpen(isOpen ? null : s.id)} aria-expanded={isOpen} className="w-full text-left flex items-center gap-3 p-4">
                <span
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                    s.pill.tone === 'done' ? 'bg-emerald-600 text-white' : 'bg-neutral-900 text-white'
                  }`}
                >
                  {s.pill.tone === 'done' ? <Check className="w-4 h-4" /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-bold text-neutral-900">{s.title}</span>
                  <span className="block text-xs text-neutral-500">{s.summary}</span>
                </span>
                <span className={`hidden sm:inline text-[11px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${PILL[s.pill.tone]}`}>{s.pill.text}</span>
                <ChevronDown className={`w-5 h-5 text-neutral-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && <div className="px-4 pb-4 sm:pl-15">{s.body}</div>}
            </section>
          );
        })}

        {/* Questions */}
        {onAsk && (
          <div className="p-4 bg-white rounded-2xl border border-neutral-200/90 shadow-2xs space-y-2">
            <div className="text-sm font-bold text-neutral-900 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#ba0c2f]" /> Ask BuckAI
            </div>
            <div className="flex flex-wrap gap-2">
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => onAsk(q)}
                  className="text-xs px-3 py-1.5 rounded-full border border-neutral-200 hover:border-[#ba0c2f] hover:bg-[#ba0c2f]/5 text-neutral-800"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="text-[11px] text-neutral-500 px-1">
          Coming later: applying to scholarships right here in BuckAI. Scholarship Universe doesn’t let other apps connect yet, so for now
          we link you there. FAFSA® is a registered mark of the U.S. Department of Education; BuckAI isn’t affiliated with it. Your checklist
          is saved in this browser only.
        </p>
      </div>
    </div>
  );
};
