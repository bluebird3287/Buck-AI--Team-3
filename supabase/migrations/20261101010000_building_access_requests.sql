-- After-hours building access requests. BuckAI finds the office that grants access to the
-- building and the student emails that office from their own OSU account; this table only
-- tracks the request. Students see, update and delete only their own.
create table public.building_access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  building_id text not null,
  building_name text not null,
  office_name text not null,
  office_email text not null,
  hours text not null,
  term text not null,
  reason text not null,
  status text not null default 'emailed' check (status in ('emailed', 'granted', 'denied')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index building_access_requests_user_idx on public.building_access_requests (user_id, created_at desc);

alter table public.building_access_requests enable row level security;

create policy "Students read their own access requests"
  on public.building_access_requests for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Students add their own access requests"
  on public.building_access_requests for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Students update their own access requests"
  on public.building_access_requests for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Students delete their own access requests"
  on public.building_access_requests for delete to authenticated
  using (user_id = (select auth.uid()));
