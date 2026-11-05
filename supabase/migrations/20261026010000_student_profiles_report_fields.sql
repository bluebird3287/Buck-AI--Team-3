-- Fields read from an uploaded OSU advising report (the report file itself is never stored).
alter table public.student_profiles
  add column earned_credits numeric(5,2) check (earned_credits is null or earned_credits >= 0),
  add column advisor_name text,
  add column report_imported_at timestamptz;
