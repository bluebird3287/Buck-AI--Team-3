-- Advisors as real rows, each with their own availability, and students assigned to the advisor named on
-- their BuckeyeLink Advising Report.
--
-- * public.advisors: one row per advisor login. `aliases` are extra names the advising report may use
--   for the same caseload (e.g. a demo login covering a real advisor's students).
-- * Every advising request is stamped with the student's assigned advisor (advisor_id) when it is created.
--   All advisors still see every request so anyone with time can answer it; the app flags each one as
--   "your advisee", "another advisor's student", or "unassigned". handled_by records who acted.
-- * Availability per advisor: weekly hours (advisors.weekly_hours), whole days off (advisor_days_off),
--   single closed times (advisor_closed_slots, now per advisor), and busy times imported from Google or
--   Outlook calendars (advisor_busy_blocks, start/end only, never event titles). Calendar feed links are
--   secret, so advisor_calendars is readable only by its owner.

-- ---------------------------------------------------------------------------
-- Advisors
-- ---------------------------------------------------------------------------

create table public.advisors (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  full_name text not null check (char_length(full_name) between 1 and 120),
  title text not null default 'Academic Advisor',
  office text not null default 'Fisher Undergraduate Advising',
  aliases text[] not null default '{}',
  -- { "1": [[540, 1020]], ... } minutes after midnight, 1 = Monday ... 7 = Sunday
  weekly_hours jsonb not null default
    '{"1":[[540,1020]],"2":[[540,1020]],"3":[[540,1020]],"4":[[540,1020]],"5":[[540,1020]]}'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.advisors (email, full_name, title, office, aliases) values
  ('jenkins.892@osu.edu', 'Sarah Jenkins, M.Ed.', 'Senior Academic Advisor, Fisher College of Business', 'Mason Hall 120', '{}'),
  -- Demo logins (see src/lib/roles.ts). Tyler's covers the caseload the test students' reports name.
  ('tylerrez3@gmail.com', 'Demo Advisor (Tyler)', 'Academic Advisor, Fisher College of Business', 'Mason Hall 120', '{"Lindsay McGory"}'),
  ('enzomancini447@gmail.com', 'Demo Advisor (Enzo)', 'Academic Advisor, Fisher College of Business', 'Mason Hall 120', '{}');

-- The signed-in advisor's row, if any.
create or replace function public.current_advisor_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.advisors where email = lower(coalesce(auth.jwt() ->> 'email', ''));
$$;
revoke all on function public.current_advisor_id() from public, anon;
grant execute on function public.current_advisor_id() to authenticated;

-- Advisors are now whoever has a row in public.advisors (keep src/lib/roles.ts in sync).
create or replace function public.is_advisor()
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.current_advisor_id() is not null;
$$;

-- "Rachel A. Miller" / "Sarah Jenkins, M.Ed." / "MILLER,RACHEL A" -> "rachel miller"
create or replace function public.advisor_name_key(name text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  n text := lower(trim(coalesce(name, '')));
  parts text[];
begin
  if n = '' then return null; end if;
  if n ~ '^[a-z''-]+ *, *[a-z]' and n !~ ',\s*(m\.|ph\.|ed\.|mba|ms|ma|phd)' then
    -- Registrar style "LAST,FIRST MIDDLE"
    n := trim(split_part(n, ',', 2)) || ' ' || trim(split_part(n, ',', 1));
  else
    n := split_part(n, ',', 1); -- drop credentials after a comma
  end if;
  parts := regexp_split_to_array(trim(regexp_replace(n, '[^a-z'' -]', '', 'g')), '\s+');
  if array_length(parts, 1) is null then return null; end if;
  return parts[1] || ' ' || parts[array_length(parts, 1)];
end;
$$;

-- The advisor whose name (or an alias) matches the name on an advising report.
create or replace function public.advisor_for_name(name text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select a.id
  from public.advisors a
  where public.advisor_name_key(name) is not null
    and (public.advisor_name_key(a.full_name) = public.advisor_name_key(name)
         or exists (select 1 from unnest(a.aliases) al where public.advisor_name_key(al) = public.advisor_name_key(name)))
  order by a.created_at
  limit 1;
$$;
revoke all on function public.advisor_for_name(text) from public, anon;
grant execute on function public.advisor_for_name(text) to authenticated;

-- The signed-in student's assigned advisor, from their advising report.
create or replace function public.my_advisor_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select public.advisor_for_name(p.advisor_name) from public.student_profiles p where p.user_id = auth.uid();
$$;
revoke all on function public.my_advisor_id() from public, anon;
grant execute on function public.my_advisor_id() to authenticated;

alter table public.advisors enable row level security;

-- Students need their advisor's name and office; nobody else gets in.
create policy "Signed-in users see advisors"
  on public.advisors for select to authenticated using (true);
create policy "Advisors edit their own row"
  on public.advisors for update to authenticated
  using (id = (select public.current_advisor_id()))
  with check (id = (select public.current_advisor_id()));
-- Only these columns can change through the API (email, name and aliases stay admin-managed).
revoke update on public.advisors from authenticated, anon;
grant update (title, office, weekly_hours) on public.advisors to authenticated;

-- ---------------------------------------------------------------------------
-- Requests: assigned advisor, who handled it, and whose calendar the meeting is on
-- ---------------------------------------------------------------------------

alter table public.advising_requests
  add column advisor_id uuid references public.advisors (id) on delete set null,
  add column handled_by uuid references public.advisors (id) on delete set null,
  add column meeting_advisor_id uuid references public.advisors (id) on delete set null;

create index advising_requests_advisor_id_idx on public.advising_requests (advisor_id);

update public.advising_requests r
set advisor_id = public.advisor_for_name(p.advisor_name)
from public.student_profiles p
where p.user_id = r.user_id;
update public.advising_requests set meeting_advisor_id = advisor_id where appointment is not null;

create or replace function public.stamp_advising_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.current_advisor_id();
begin
  if tg_op = 'INSERT' then
    -- Students can't choose their advisor: it comes from their advising report.
    new.advisor_id := (select public.advisor_for_name(p.advisor_name) from public.student_profiles p where p.user_id = new.user_id);
    new.handled_by := null;
    new.meeting_advisor_id := case when new.appointment is not null then new.advisor_id end;
    return new;
  end if;
  new.advisor_id := old.advisor_id; -- never reassigned through the API
  if me is null then
    new.handled_by := old.handled_by;
    new.meeting_advisor_id := old.meeting_advisor_id;
  else
    -- Any advisor may answer; record who did. A meeting they schedule goes on their own calendar.
    new.handled_by := me;
    if new.appointment is distinct from old.appointment and new.appointment is not null then
      new.meeting_advisor_id := me;
    else
      new.meeting_advisor_id := old.meeting_advisor_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger stamp_advising_request
  before insert or update on public.advising_requests
  for each row execute function public.stamp_advising_request();
-- Only the trigger runs it; not callable through the API.
revoke all on function public.stamp_advising_request() from public, anon, authenticated;

-- One meeting per time slot per advisor (was: per time slot overall).
drop index if exists public.advising_requests_slot_idx;
create unique index advising_requests_slot_idx
  on public.advising_requests (coalesce(meeting_advisor_id, '00000000-0000-0000-0000-000000000000'::uuid), (appointment ->> 'slotKey'))
  where appointment is not null and status <> 'denied';

-- Booked times for one advisor (null = the unassigned pool), without who booked them.
drop function if exists public.booked_slot_keys();
create or replace function public.booked_slot_keys(p_advisor uuid default null)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select appointment ->> 'slotKey'
  from public.advising_requests
  where appointment is not null and status <> 'denied'
    and meeting_advisor_id is not distinct from p_advisor;
$$;
revoke all on function public.booked_slot_keys(uuid) from public, anon;
grant execute on function public.booked_slot_keys(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Closed single times, now per advisor
-- ---------------------------------------------------------------------------

alter table public.advisor_closed_slots add column advisor_id uuid references public.advisors (id) on delete cascade;
update public.advisor_closed_slots c set advisor_id = a.id
from auth.users u join public.advisors a on a.email = lower(u.email)
where u.id = c.closed_by;
delete from public.advisor_closed_slots where advisor_id is null;
alter table public.advisor_closed_slots alter column advisor_id set not null;
alter table public.advisor_closed_slots alter column advisor_id set default public.current_advisor_id();
alter table public.advisor_closed_slots drop constraint advisor_closed_slots_pkey;
alter table public.advisor_closed_slots add primary key (advisor_id, slot_key);

drop policy if exists "Advisors close times" on public.advisor_closed_slots;
drop policy if exists "Advisors reopen times" on public.advisor_closed_slots;
create policy "Advisors close their own times"
  on public.advisor_closed_slots for insert to authenticated
  with check (advisor_id = (select public.current_advisor_id()));
create policy "Advisors reopen their own times"
  on public.advisor_closed_slots for delete to authenticated
  using (advisor_id = (select public.current_advisor_id()));

-- ---------------------------------------------------------------------------
-- Whole days off
-- ---------------------------------------------------------------------------

create table public.advisor_days_off (
  advisor_id uuid not null default public.current_advisor_id() references public.advisors (id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (advisor_id, day)
);
alter table public.advisor_days_off enable row level security;
create policy "Signed-in users see days off"
  on public.advisor_days_off for select to authenticated using (true);
create policy "Advisors add their own days off"
  on public.advisor_days_off for insert to authenticated
  with check (advisor_id = (select public.current_advisor_id()));
create policy "Advisors remove their own days off"
  on public.advisor_days_off for delete to authenticated
  using (advisor_id = (select public.current_advisor_id()));

-- ---------------------------------------------------------------------------
-- Imported calendars (Google / Outlook) and the busy times read from them
-- ---------------------------------------------------------------------------

create table public.advisor_calendars (
  id uuid primary key default gen_random_uuid(),
  advisor_id uuid not null default public.current_advisor_id() references public.advisors (id) on delete cascade,
  provider text not null check (provider in ('google', 'outlook', 'file')),
  label text not null check (char_length(label) between 1 and 120),
  feed_url text check (feed_url is null or (feed_url ~ '^(https|webcal)://' and char_length(feed_url) <= 2000)),
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
create index advisor_calendars_advisor_id_idx on public.advisor_calendars (advisor_id);
alter table public.advisor_calendars enable row level security;
-- Feed links work like passwords: only the advisor who added one can see it.
create policy "Advisors manage their own calendars"
  on public.advisor_calendars for all to authenticated
  using (advisor_id = (select public.current_advisor_id()))
  with check (advisor_id = (select public.current_advisor_id()));

create table public.advisor_busy_blocks (
  id bigint generated always as identity primary key,
  advisor_id uuid not null default public.current_advisor_id() references public.advisors (id) on delete cascade,
  calendar_id uuid not null references public.advisor_calendars (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at)
);
create index advisor_busy_blocks_advisor_idx on public.advisor_busy_blocks (advisor_id, starts_at);
create index advisor_busy_blocks_calendar_idx on public.advisor_busy_blocks (calendar_id);
alter table public.advisor_busy_blocks enable row level security;
-- Students see when their advisor is busy, never what the event is.
create policy "Signed-in users see busy times"
  on public.advisor_busy_blocks for select to authenticated using (true);
create policy "Advisors add their own busy times"
  on public.advisor_busy_blocks for insert to authenticated
  with check (
    advisor_id = (select public.current_advisor_id())
    and exists (select 1 from public.advisor_calendars c where c.id = calendar_id and c.advisor_id = (select public.current_advisor_id()))
  );
create policy "Advisors clear their own busy times"
  on public.advisor_busy_blocks for delete to authenticated
  using (advisor_id = (select public.current_advisor_id()));
