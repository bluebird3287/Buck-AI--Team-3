-- Funnel tracking: one row per visit, sign-up, and advising-chat question (the core action).
-- Rows hold no names or emails. Only the server writes them, and nobody can read them through the API.

create table public.events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  event text not null check (event in ('visit', 'sign_up', 'core_action')),
  -- Random browser ID for logged-out visitors; the account ID once someone signs in.
  actor_id text not null check (length(actor_id) between 1 and 64),
  -- Channel tag from ?ref= on the person's first visit (e.g. colleague-email).
  ref text check (ref ~ '^[a-z0-9_-]{1,64}$'),
  -- "How did you hear about us?" answer, sign_up rows only.
  heard_about text check (length(heard_about) <= 64)
);

create index events_event_created_idx on public.events (event, created_at);
create index events_ref_idx on public.events (ref) where ref is not null;

-- RLS on with no policies: the publishable key can't read or write the table.
alter table public.events enable row level security;
revoke all on public.events from anon, authenticated;

-- The server proves itself with a token (Vercel env EVENTS_WRITE_TOKEN); only its SHA-256 is stored here.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.settings (key text primary key, value text not null);
revoke all on private.settings from public, anon, authenticated;

create or replace function public.record_event(p_token text, p_event text, p_actor_id text, p_ref text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_event not in ('visit', 'core_action') then
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

revoke all on function public.record_event(text, text, text, text) from public;
grant execute on function public.record_event(text, text, text, text) to anon, authenticated;

-- sign_up rows come straight from account creation, so the tag survives opening the
-- confirmation email on another device (SignIn.tsx sends ref + heard_about as user metadata).
create or replace function public.record_sign_up_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ref text := lower(new.raw_user_meta_data ->> 'ref');
begin
  if v_ref is not null and v_ref !~ '^[a-z0-9_-]{1,64}$' then
    v_ref := null;
  end if;
  insert into public.events (event, actor_id, ref, heard_about)
  values ('sign_up', new.id::text, v_ref, left(new.raw_user_meta_data ->> 'heard_about', 64));
  return new;
exception when others then
  -- Never block a sign-up because tracking failed.
  return new;
end;
$$;

revoke all on function public.record_sign_up_event() from public, anon, authenticated;

create trigger on_auth_user_created_record_event
  after insert on auth.users
  for each row execute function public.record_sign_up_event();
