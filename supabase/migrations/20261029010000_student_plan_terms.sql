-- Which future terms a student wants to take classes in, and their target graduation term
-- (e.g. {"terms": ["spring-2027", "autumn-2027"], "graduation": "spring-2029"}).
alter table public.student_profiles add column plan_terms jsonb;
