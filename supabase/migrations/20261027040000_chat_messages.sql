-- Each student's BuckAI chat log. Students read and add only their own messages
-- (advisors see student details only through routed requests, per CLAUDE.md).
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  text text not null check (char_length(text) <= 20000),
  meta jsonb,               -- citation, confidence, high-stakes card, follow-up button
  created_at timestamptz not null default now()
);

create index chat_messages_user_created_idx on public.chat_messages (user_id, created_at desc);

alter table public.chat_messages enable row level security;

create policy "Students read their own chat"
  on public.chat_messages for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Students add to their own chat"
  on public.chat_messages for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Students clear their own chat"
  on public.chat_messages for delete to authenticated
  using (user_id = (select auth.uid()));
