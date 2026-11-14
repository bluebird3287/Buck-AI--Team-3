-- Advisors join on their own, checked against Ohio State's public directory (Find People).
--
-- * The server looks up the signed-in user's name.# in the OSU directory (/api/advisor-enroll). An OSU person
--   becomes an advisor only when the directory lists an academic-advising job for them (being named on a
--   student's report is not enough: students write their own profiles). enroll_advisor() creates their
--   public.advisors row; only the server can call it (same server-only token as record_event). Anyone else
--   (e.g. a lecturer who also advises) is still added by hand with an insert into public.advisors.
-- * Students: the advisor named on the Advising Report is resolved to a directory entry when the report is
--   read (student_profiles.advisor_directory: username, email, name, title, office), so the student sees
--   their real advisor's contact details.
-- * Matching a student to an advisor uses the OSU username (name.#) first, then the name on the report.
--   When an advisor joins, requests their students already sent are assigned to them.

alter table public.advisors add column osu_username text unique check (osu_username ~ '^[a-z-]+\.[0-9]+$');
update public.advisors set osu_username = split_part(email, '@', 1) where email ~ '^[a-z-]+\.[0-9]+@osu\.edu$';

alter table public.student_profiles add column advisor_directory jsonb;

-- The advisor assigned to a student: their report's advisor by OSU username, else by name or alias.
create or replace function public.advisor_for_student(p_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select a.id from public.advisors a
       where a.osu_username is not null and a.osu_username = lower(p.advisor_directory ->> 'username')),
    public.advisor_for_name(p.advisor_name)
  )
  from public.student_profiles p
  where p.user_id = p_user_id;
$$;
revoke all on function public.advisor_for_student(uuid) from public, anon, authenticated;

create or replace function public.my_advisor_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select public.advisor_for_student(auth.uid());
$$;

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
    new.advisor_id := public.advisor_for_student(new.user_id);
    new.handled_by := null;
    new.meeting_advisor_id := case when new.appointment is not null then new.advisor_id end;
    return new;
  end if;
  -- Never reassigned through the API; only enroll_advisor() (server-only) sets it, for a newly joined advisor.
  if coalesce(current_setting('buckai.assigning_advisor', true), '') <> 'on' then
    new.advisor_id := old.advisor_id;
  end if;
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

-- Server-only (checked with the server token): make a signed-in OSU user an advisor from their directory
-- entry. p_directory_advisor = the directory lists an academic-advising job for them. Returns true when the
-- user is (now) an advisor.
create or replace function public.enroll_advisor(
  p_token text,
  p_user_id uuid,
  p_email text,
  p_username text,
  p_full_name text,
  p_title text,
  p_office text,
  p_directory_advisor boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(p_email));
  v_username text := lower(trim(p_username));
  v_id uuid;
begin
  if not exists (
    select 1 from private.settings
    where key = 'events_write_token_sha256'
      and value = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
  ) then
    raise exception 'not allowed';
  end if;
  -- The account must exist with this email, and the email must be this OSU username's.
  if not exists (select 1 from auth.users u where u.id = p_user_id and lower(u.email) = v_email) then
    raise exception 'unknown account';
  end if;
  if v_username !~ '^[a-z-]+\.[0-9]+$' or split_part(v_email, '@', 1) <> v_username then
    raise exception 'not an OSU username';
  end if;
  if not coalesce(p_directory_advisor, false) then
    return false;
  end if;

  insert into public.advisors (email, full_name, title, office, osu_username)
  values (
    v_email,
    left(coalesce(nullif(trim(p_full_name), ''), v_username), 120),
    left(coalesce(nullif(trim(p_title), ''), 'Academic Advisor'), 200),
    left(coalesce(nullif(trim(p_office), ''), 'Undergraduate Advising'), 200),
    v_username
  )
  on conflict (email) do update set osu_username = excluded.osu_username
  returning id into v_id;

  -- Requests this advisor's students already sent, before the advisor joined.
  perform set_config('buckai.assigning_advisor', 'on', true);
  update public.advising_requests r
  set advisor_id = v_id
  where r.advisor_id is null and public.advisor_for_student(r.user_id) = v_id;
  perform set_config('buckai.assigning_advisor', '', true);

  return true;
end;
$$;
revoke all on function public.enroll_advisor(text, uuid, text, text, text, text, text, boolean) from public;
grant execute on function public.enroll_advisor(text, uuid, text, text, text, text, text, boolean) to anon, authenticated;
