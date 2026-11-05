-- Each student's own profile and the classes they enter (BuckAI isn't connected to BuckeyeLink).
-- Row-level security: a student can only read and write their own row.
create table public.student_profiles (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  full_name text not null,
  major text not null,
  minor text,
  college text,
  class_standing text,
  gpa numeric(3,2) check (gpa is null or (gpa >= 0 and gpa <= 4)),
  semesters jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.student_profiles enable row level security;

create policy "Students read own profile" on public.student_profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Students create own profile" on public.student_profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Students update own profile" on public.student_profiles
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Students delete own profile" on public.student_profiles
  for delete to authenticated using ((select auth.uid()) = user_id);
