-- Students can have more than one specialization (e.g. Finance + Tech Innovation).
-- specialization_id is kept for older rows; the app reads specialization_ids.
alter table public.student_profiles add column specialization_ids text[] not null default '{}';
update public.student_profiles set specialization_ids = array[specialization_id] where specialization_id is not null;
