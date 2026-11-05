-- GE groups are checked against Ohio State's GEN course lists (src/data/geCourses.json)
alter table public.requirement_groups drop constraint requirement_groups_kind_check;
alter table public.requirement_groups add constraint requirement_groups_kind_check
  check (kind in ('all', 'choose_courses', 'choose_credits', 'manual', 'ge'));
alter table public.requirement_groups add column ge_category text;
-- Seasons a course is scheduled in ('{}' = every autumn and spring; '{None}' = not on the current schedule)
alter table public.requirement_courses add column offered_terms text[] not null default '{}';
-- Earned credit hours needed before taking the course (30 sophomore, 60 junior, 90 senior)
alter table public.requirement_courses add column min_standing int;
