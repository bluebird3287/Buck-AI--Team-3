-- Degree programs: the Fisher BSBA itself and each specialization.
create table public.programs (
  id text primary key,
  kind text not null check (kind in ('degree', 'specialization')),
  name text not null,
  college text not null,
  catalog text not null,            -- which curriculum version this is
  min_total_credits numeric(5,1),
  min_gpa numeric(3,2),
  notes text,
  source_url text,
  sort_order int not null default 0
);

-- A requirement inside a program.
--   all            every listed course is required
--   choose_courses at least min_courses of the listed courses
--   choose_credits at least min_credits from the listed courses (and/or code_pattern)
--   manual         can't be checked from course codes; shown for the student/advisor to confirm
create table public.requirement_groups (
  id text primary key,
  program_id text not null references public.programs(id) on delete cascade,
  sort_order int not null default 0,
  title text not null,
  kind text not null check (kind in ('all', 'choose_courses', 'choose_credits', 'manual')),
  min_courses int,
  min_credits numeric(5,1),
  max_secondary_credits numeric(5,1),  -- cap on credits from courses marked is_secondary
  code_pattern text,                   -- regex for open electives, e.g. ECON 4000/5000 level
  exclude_codes text[] not null default '{}',
  notes text
);

create table public.requirement_courses (
  id bigint generated always as identity primary key,
  group_id text not null references public.requirement_groups(id) on delete cascade,
  sort_order int not null default 0,
  code text not null,
  title text not null,
  credits numeric(4,1),
  prerequisites text,
  min_grade text,                       -- e.g. 'C' when Fisher requires C or higher
  alternates text[] not null default '{}',  -- other codes Fisher officially accepts
  equivalents text[] not null default '{}', -- other codes that may substitute (confirm with advisor)
  is_secondary boolean not null default false,
  notes text
);

create index on public.requirement_groups (program_id);
create index on public.requirement_courses (group_id);

-- Curriculum is public reference data: anyone can read it, nobody can write through the API.
alter table public.programs enable row level security;
alter table public.requirement_groups enable row level security;
alter table public.requirement_courses enable row level security;
create policy "Curriculum is public" on public.programs for select to anon, authenticated using (true);
create policy "Curriculum is public" on public.requirement_groups for select to anon, authenticated using (true);
create policy "Curriculum is public" on public.requirement_courses for select to anon, authenticated using (true);

-- Each student's chosen specialization.
alter table public.student_profiles
  add column specialization_id text references public.programs(id);
