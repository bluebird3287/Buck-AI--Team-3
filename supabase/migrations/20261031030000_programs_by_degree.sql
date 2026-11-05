-- More than one college's degrees: each specialization names the degree it belongs to, and each
-- student picks a degree (no degree = the Fisher BSBA, as before Engineering was added).
alter table public.programs
  add column parent_id text references public.programs (id) on delete cascade;
update public.programs set parent_id = 'fisher-bsba'
where kind = 'specialization' and college = 'Fisher College of Business';

alter table public.student_profiles
  add column degree_id text references public.programs (id) on delete set null;
