-- Requirements that depend on when a student entered Ohio State, and special programs
-- (honors, IBE, accelerated MAcc) that add to or change a student's degree requirements.

-- Programs can now be special programs a student is admitted into on top of their degree.
alter table public.programs drop constraint programs_kind_check;
alter table public.programs add constraint programs_kind_check
  check (kind in ('degree', 'specialization', 'minor', 'special'));

alter table public.programs
  -- Which entering students a version applies to: first Ohio State term, e.g. 'autumn-2022' (null = open-ended)
  add column entry_from text check (entry_from is null or entry_from ~ '^(autumn|spring|summer)-\d{4}$'),
  add column entry_through text check (entry_through is null or entry_through ~ '^(autumn|spring|summer)-\d{4}$'),
  -- Another version of the same program, for a different entering class (students save the base id)
  add column version_of text references public.programs (id) on delete cascade,
  -- Specializations a special program's members must have (e.g. Accounting Honors needs Accounting)
  add column requires_programs text[] not null default '{}',
  -- How a special program changes the base degree: {"substitute": [{code, with, note}], "waive": [{code, note, when_taken}]}
  add column adjustments jsonb not null default '{}'::jsonb;

-- The Engineering curriculum sheets BuckAI has are for students admitted 2026-2027.
-- (scripts/engineering_requirements.py sets this too, so a regenerated seed keeps it.)
update public.programs set entry_from = 'autumn-2026'
where college = 'College of Engineering' and kind = 'degree';

-- Each student's entering term, expected graduation term, and special programs (base program ids).
alter table public.student_profiles
  add column entry_term text check (entry_term is null or entry_term ~ '^(autumn|spring|summer)-\d{4}$'),
  add column expected_graduation text check (expected_graduation is null or expected_graduation ~ '^(autumn|spring|summer)-\d{4}$'),
  add column special_program_ids text[] not null default '{}';
