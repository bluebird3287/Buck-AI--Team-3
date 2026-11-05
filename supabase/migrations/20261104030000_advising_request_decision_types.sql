-- The advising chat routes more kinds of big decisions to advisors: taking a class Pass/Non-Pass,
-- scheduling more than 18 credit hours, and taking a class at another school.
alter table public.advising_requests drop constraint if exists advising_requests_category_check;
alter table public.advising_requests add constraint advising_requests_category_check
  check (category in ('appointment', 'hold_clearance', 'drop_class', 'add_minor', 'change_major', 'withdraw',
                      'pass_nonpass', 'overload', 'transfer_credit'));
