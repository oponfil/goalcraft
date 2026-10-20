-- What an agent's runs cost in tokens, as the wake script reads it from the agent's own session files
-- on the person's computer (Claude Code transcripts, Codex rollouts). One row per run of a session:
-- the script sends the same run again as it grows, so it is upserted by its key.
create table public.agent_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  funnel_id uuid not null references public.funnels (id) on delete cascade,
  agent text not null,
  run_key text not null,
  app text not null check (app in ('claude', 'codex')),
  model text,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  tokens bigint not null default 0 check (tokens >= 0),      -- everything the model read and wrote
  new_tokens bigint not null default 0 check (new_tokens >= 0), -- without re-reads from the cache
  cost_usd numeric(10, 4),                                   -- at API prices; null when unknown
  limit_percent numeric(5, 2),                               -- of the plan's limit, when the app logs it (Codex)
  limit_window_minutes integer,
  updated_at timestamptz not null default now(),
  primary key (funnel_id, agent, run_key)
);
create index agent_usage_recent on public.agent_usage (user_id, ended_at desc);
alter table public.agent_usage enable row level security;
create policy "Own agent usage" on public.agent_usage for select to authenticated
  using ((select auth.uid()) = user_id);
grant select on public.agent_usage to authenticated;
grant select, insert, update, delete on public.agent_usage to service_role;
