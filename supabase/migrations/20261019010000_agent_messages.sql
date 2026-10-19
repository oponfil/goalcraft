-- The person writes to any agent from its card on the dashboard, not only in answer to a question.
-- The agent reads its messages through MCP (get_messages, which marks them read) and replies in one
-- line (reply), shown over it as a note until the person closes it, as with answers.
create table public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  funnel_id uuid not null references public.funnels (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  agent text not null,
  text text not null check (length(text) between 1 and 2000),
  sent_at timestamptz not null default now(),
  read_at timestamptz,
  reply text check (length(reply) <= 300),
  replied_at timestamptz,
  reply_seen_at timestamptz,
  -- When the wake script last woke the agent for it (see supabase/functions/wake).
  woken_at timestamptz
);
create index agent_messages_funnel on public.agent_messages (funnel_id, agent, sent_at);
create trigger agent_messages_owner before insert or update on public.agent_messages
  for each row execute function public.same_owner();
alter table public.agent_messages enable row level security;
create policy "Own messages" on public.agent_messages for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter publication supabase_realtime add table public.agent_messages;

-- The wake script wakes an agent once per reason: an answer to its question while it sleeps, or a
-- silence (overdue or out of contact) since its last signal. For a silence it keeps the signal it
-- woke the agent after (presence.updated_at then): a new signal ends that silence. Kept apart from
-- presence, whose every change counts as a signal. Only the wake endpoint (service role) uses it.
alter table public.questions add column woken_at timestamptz;
create table public.agent_wakes (
  funnel_id uuid not null references public.funnels (id) on delete cascade,
  agent text not null,
  signal_at timestamptz not null,
  woken_at timestamptz not null default now(),
  primary key (funnel_id, agent)
);
alter table public.agent_wakes enable row level security;

-- The key the person's wake script uses: only its hash is kept. It lets the script ask which of the
-- person's agents to wake, nothing else.
create table public.wake_keys (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  key_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
alter table public.wake_keys enable row level security;
create policy "Own wake key" on public.wake_keys for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
