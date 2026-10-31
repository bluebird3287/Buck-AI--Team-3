-- Student reviews for the Faculty Evaluations & Feedback tab.
-- Roles table (CLAUDE.md): anyone can read faculty evaluations, including logged-out visitors;
-- only signed-in students can add a review, and only as themselves.
-- Reviews can't be edited or deleted from the app (there are no update/delete policies).

create table public.faculty_reviews (
  id uuid primary key default gen_random_uuid(),
  -- Filled in from the signed-in user's session; clients can't set it (see the grants below)
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Instructor name.# and course from src/data/fisherFaculty.json, e.g. 'smith.2126' and 'ACCTMIS 2300'
  faculty_id text not null check (faculty_id ~ '^[a-z][a-z''-]*\.[0-9]+$'),
  course_id text not null check (char_length(course_id) between 3 and 20),
  term text not null check (char_length(term) between 1 and 40),
  overall smallint not null check (overall between 1 and 5),
  difficulty smallint not null check (difficulty between 1 and 5),
  hours_per_week smallint not null check (hours_per_week between 0 and 40),
  would_take_again boolean not null,
  grade text check (grade in ('A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'E', 'S', 'U', 'W')),
  -- Tips stay about the course: no email addresses or phone numbers
  tip text check (
    char_length(tip) <= 400
    and tip !~ '@'
    and tip !~ '\d{3}[-.\s]?\d{3}[-.\s]?\d{4}'
  ),
  created_at timestamptz not null default now(),
  -- One review per student, instructor, course and term
  unique (user_id, faculty_id, course_id, term)
);

create index faculty_reviews_faculty_id_idx on public.faculty_reviews (faculty_id);
create index faculty_reviews_course_id_idx on public.faculty_reviews (course_id);

-- Prototype advisor check. Keep this list in sync with ADVISOR_EMAILS in src/lib/roles.ts
-- until roles are stored in the database.
create or replace function public.is_advisor()
returns boolean
language sql
stable
set search_path = ''
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'jenkins.892@osu.edu',
    'tylerrez3@gmail.com',
    'enzomancini447@gmail.com'
  );
$$;

alter table public.faculty_reviews enable row level security;

create policy "Anyone can read faculty reviews"
  on public.faculty_reviews
  for select
  to anon, authenticated
  using (true);

create policy "Students can add their own reviews"
  on public.faculty_reviews
  for insert
  to authenticated
  with check (user_id = auth.uid() and not public.is_advisor());

-- Column-level grants: readers never see who wrote a review, and writers can't choose user_id.
revoke all on public.faculty_reviews from anon, authenticated;
grant select (id, faculty_id, course_id, term, overall, difficulty, hours_per_week, would_take_again, grade, tip, created_at)
  on public.faculty_reviews to anon, authenticated;
grant insert (faculty_id, course_id, term, overall, difficulty, hours_per_week, would_take_again, grade, tip)
  on public.faculty_reviews to authenticated;
