-- BuckAI is for the Ohio State community: only @osu.edu (and @buckeyemail.osu.edu) addresses can create
-- accounts, plus the team's two existing demo advisor logins. This only protects anything when Supabase's
-- "Confirm email" setting is on, so nobody can sign up with an OSU address they don't own.

create or replace function public.is_osu_email(email text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(lower(email) ~ '@(buckeyemail\.)?osu\.edu$', false)
$$;

-- Demo advisor accounts that predate the rule (see src/lib/roles.ts). They can sign in but are not OSU
-- accounts, so they can't read office hours.
create or replace function public.is_allowed_signup(email text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select public.is_osu_email(email) or lower(email) in ('tylerrez3@gmail.com', 'enzomancini447@gmail.com')
$$;

create or replace function public.reject_non_osu_signup()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_allowed_signup(new.email) then
    raise exception 'BuckAI accounts need an Ohio State email (name.#@osu.edu).' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists reject_non_osu_signup on auth.users;
create trigger reject_non_osu_signup
  before insert or update of email on auth.users
  for each row execute function public.reject_non_osu_signup();

-- The signed-in user has a confirmed OSU email.
create or replace function public.is_osu_user()
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.is_osu_email(auth.jwt() ->> 'email')
$$;

-- Instructor and TA office hours, read from Fisher syllabi in Ohio State's Simple Syllabus library.
-- Most of those syllabi are visible only to the Ohio State community, so these rows are too: only signed-in
-- OSU accounts can read them, and nobody can write through the API. The data is loaded directly into the
-- database and is never committed to the (public) repository.
create table public.office_hours (
  id bigint generated always as identity primary key,
  term text not null,                    -- 'Autumn 2026'
  course_code text not null,             -- 'ACCTMIS 2200' (honors sections keep their H)
  class_number text,                     -- the section's class number, e.g. '2007'
  course_title text,
  person_name text not null,
  role text not null check (role in ('Instructor', 'TA', 'Grader', 'Other')),
  email text,
  location text,                         -- office or building/room, as the syllabus gives it
  hours_text text,                       -- the office hours exactly as written in the syllabus
  sessions jsonb not null default '[]',  -- [{ day: 'Mon', start: '14:00', end: '15:30', mode: 'In person' | 'Online' | 'Hybrid' }]
  by_appointment boolean not null default false,
  source_code text not null,             -- Simple Syllabus document code
  source_visibility text,                -- 'general_public' or 'campus_community'
  fetched_at timestamptz not null default now()
);

create index on public.office_hours (course_code);

alter table public.office_hours enable row level security;
create policy "OSU accounts read office hours" on public.office_hours
  for select to authenticated using ((select public.is_osu_user()));

-- Which instructor a student has for each class ({ "ACCTMIS 2200": "Marc Smith" }), so the
-- Office Hours tab shows their own section first.
alter table public.student_profiles
  add column office_hours_picks jsonb not null default '{}'::jsonb;
