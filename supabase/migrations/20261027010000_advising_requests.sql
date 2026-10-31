-- Real advising requests (replaces the prototype's browser-only sample data).
-- Roles table (CLAUDE.md): a student creates and sees only their own requests; advisors see
-- and act on routed requests. Until advisees are assigned, every advisor sees every request.

create table public.advising_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ticket_id text not null,
  category text not null check (category in ('appointment', 'hold_clearance', 'drop_class', 'add_minor', 'change_major', 'withdraw')),
  title text not null check (char_length(title) between 1 and 200),
  student_message text not null default '' check (char_length(student_message) <= 4000),
  details jsonb,
  student jsonb not null,           -- snapshot of the student's profile when they submitted
  status text not null default 'ai_review'
    check (status in ('ai_review', 'pending_advisor', 'needs_info', 'scheduled', 'approved', 'denied')),
  ai_review jsonb,
  appointment jsonb,                -- { slotKey: 'YYYY-MM-DDTHH:MM', format }
  decision jsonb,                   -- { by, note, at }
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index advising_requests_user_id_idx on public.advising_requests (user_id);
-- One meeting per time slot
create unique index advising_requests_slot_idx on public.advising_requests ((appointment ->> 'slotKey'))
  where appointment is not null and status <> 'denied';

alter table public.advising_requests enable row level security;

create policy "Students see their own requests; advisors see all"
  on public.advising_requests for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_advisor()));

create policy "Students submit their own requests"
  on public.advising_requests for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'ai_review' and not (select public.is_advisor()));

-- The student's browser attaches BuckAI's check (step 1) and hands the request to the advisor.
create policy "Students attach the AI check to their new request"
  on public.advising_requests for update to authenticated
  using (user_id = (select auth.uid()) and status = 'ai_review')
  with check (user_id = (select auth.uid()) and status in ('ai_review', 'pending_advisor'));

-- Step 2: only advisors approve, deny, schedule, or ask for more information.
create policy "Advisors act on requests"
  on public.advising_requests for update to authenticated
  using ((select public.is_advisor()))
  with check ((select public.is_advisor()));

-- Times the advisor has blocked off; students read them so they only pick open times.
create table public.advisor_closed_slots (
  slot_key text primary key check (slot_key ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$'),
  closed_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.advisor_closed_slots enable row level security;

create policy "Signed-in users see closed times"
  on public.advisor_closed_slots for select to authenticated using (true);
create policy "Advisors close times"
  on public.advisor_closed_slots for insert to authenticated with check ((select public.is_advisor()));
create policy "Advisors reopen times"
  on public.advisor_closed_slots for delete to authenticated using ((select public.is_advisor()));

-- Booked times without who booked them, so students don't pick a taken slot.
create or replace function public.booked_slot_keys()
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select appointment ->> 'slotKey'
  from public.advising_requests
  where appointment is not null and status <> 'denied';
$$;

revoke all on function public.booked_slot_keys() from public, anon;
grant execute on function public.booked_slot_keys() to authenticated;
