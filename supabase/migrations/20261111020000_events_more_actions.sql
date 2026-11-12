-- More funnel steps in public.events:
--   plan_built        a 4-year plan finished building (server, /api/events)
--   seat_alert_added  a class added to Seat Alerts (server, /api/events)
--   advisor_booked    an advisor appointment request (trigger on advising_requests, category 'appointment')
--   advisor_escalated a big decision sent to an advisor (trigger on advising_requests, any other category)

alter table public.events drop constraint events_event_check;
alter table public.events add constraint events_event_check check (event in (
  'visit', 'sign_up', 'core_action', 'plan_built', 'seat_alert_added', 'advisor_booked', 'advisor_escalated'
));

create or replace function public.record_event(p_token text, p_event text, p_actor_id text, p_ref text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_event not in ('visit', 'core_action', 'plan_built', 'seat_alert_added') then
    raise exception 'unsupported event';
  end if;
  if not exists (
    select 1 from private.settings
    where key = 'events_write_token_sha256'
      and value = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
  ) then
    raise exception 'not allowed';
  end if;
  insert into public.events (event, actor_id, ref)
  values (p_event, p_actor_id, nullif(lower(p_ref), ''));
end;
$$;

-- Tag comes from the account's sign-up metadata (first-visit ?ref=).
create or replace function public.record_advising_request_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ref text;
begin
  select lower(u.raw_user_meta_data ->> 'ref') into v_ref from auth.users u where u.id = new.user_id;
  if v_ref is not null and v_ref !~ '^[a-z0-9_-]{1,64}$' then
    v_ref := null;
  end if;
  insert into public.events (event, actor_id, ref)
  values (
    case when new.category = 'appointment' then 'advisor_booked' else 'advisor_escalated' end,
    new.user_id::text,
    v_ref
  );
  return new;
exception when others then
  -- Never block a student's request because tracking failed.
  return new;
end;
$$;

revoke all on function public.record_advising_request_event() from public, anon, authenticated;

create trigger on_advising_request_record_event
  after insert on public.advising_requests
  for each row execute function public.record_advising_request_event();
