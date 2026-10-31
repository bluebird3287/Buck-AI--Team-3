-- Separate BuckAI chats, like ChatGPT/Claude: each student keeps a list of conversations
-- and every message belongs to one. Students see, rename and delete only their own.
create table public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default 'New chat' check (char_length(title) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index chat_conversations_user_updated_idx on public.chat_conversations (user_id, updated_at desc);

alter table public.chat_conversations enable row level security;

create policy "Students read their own conversations"
  on public.chat_conversations for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Students start their own conversations"
  on public.chat_conversations for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Students rename their own conversations"
  on public.chat_conversations for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Students delete their own conversations"
  on public.chat_conversations for delete to authenticated
  using (user_id = (select auth.uid()));

-- Each message belongs to a conversation; deleting the conversation deletes its messages.
alter table public.chat_messages
  add column conversation_id uuid references public.chat_conversations (id) on delete cascade;

-- Existing chat logs become one conversation per student, named after their first question.
insert into public.chat_conversations (user_id, title, created_at, updated_at)
select
  m.user_id,
  coalesce(
    left((select f.text from public.chat_messages f
          where f.user_id = m.user_id and f.role = 'user'
          order by f.created_at limit 1), 60),
    'Earlier chat'),
  min(m.created_at),
  max(m.created_at)
from public.chat_messages m
group by m.user_id;

update public.chat_messages m
set conversation_id = c.id
from public.chat_conversations c
where c.user_id = m.user_id and m.conversation_id is null;

-- Before each message is saved: file messages sent without a conversation (older app
-- versions) under the student's latest one; name a "New chat" after its first question;
-- and move the conversation to the top of the list.
create or replace function public.chat_messages_attach_conversation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.conversation_id is null then
    select c.id into new.conversation_id
    from public.chat_conversations c
    where c.user_id = new.user_id
    order by c.updated_at desc
    limit 1;
    if new.conversation_id is null then
      insert into public.chat_conversations (user_id) values (new.user_id)
      returning id into new.conversation_id;
    end if;
  end if;

  update public.chat_conversations c
  set updated_at = now(),
      title = case
        when c.title = 'New chat' and new.role = 'user' and btrim(new.text) <> ''
          then left(regexp_replace(btrim(new.text), '\s+', ' ', 'g'), 60)
        else c.title
      end
  where c.id = new.conversation_id;

  return new;
end;
$$;

create trigger chat_messages_attach_conversation
  before insert on public.chat_messages
  for each row execute function public.chat_messages_attach_conversation();

alter table public.chat_messages alter column conversation_id set not null;

create index chat_messages_conversation_created_idx on public.chat_messages (conversation_id, created_at desc);

-- A student can only add messages to their own conversations.
drop policy "Students add to their own chat" on public.chat_messages;
create policy "Students add to their own chat"
  on public.chat_messages for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.chat_conversations c
      where c.id = conversation_id and c.user_id = (select auth.uid())
    )
  );
