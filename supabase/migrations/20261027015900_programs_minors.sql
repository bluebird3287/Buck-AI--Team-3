alter table public.programs drop constraint programs_kind_check;
alter table public.programs add constraint programs_kind_check check (kind in ('degree', 'specialization', 'minor'));
-- Students in these programs can't add this minor ('fisher-bsba' = any Fisher BSBA student)
alter table public.programs add column excluded_programs text[] not null default '{}';
