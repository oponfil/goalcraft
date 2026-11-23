-- The orchestrator: Goalcraft starts a funnel's roles itself, on the person's subscriptions (Claude,
-- Codex, Google Antigravity, Grok Bot), through the wake script on their computers. A role is a place
-- on the board (one per zone, plus the supervisor), the agent name in presence; it may be worked by
-- several executors, one run at a time, each run on the one whose plan's quota would go unused soonest
-- (mode even) or the first that still has quota (mode priority).

-- A role's launch settings. With a schedule, the role runs on it and what the agent says about its next
-- run is ignored; without one, the agent says when it wakes up, as before (no time: on pause).
create table public.role_launch (
  funnel_id uuid not null references public.funnels (id) on delete cascade,
  agent text not null check (agent ~ '^[a-z0-9][a-z0-9_-]{0,31}$'),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  schedule text check (schedule ~ '^\S+( \S+){4}$'),  -- five-field cron, in time_zone
  schedule_on boolean not null default true,
  time_zone text not null default 'Asia/Ho_Chi_Minh' check (length(time_zone) <= 64),
  mode text not null default 'even' check (mode in ('even', 'priority')),
  quota_limit numeric not null default 95 check (quota_limit between 1 and 100),
  guide_url text check (guide_url ~ '^https?://' and length(guide_url) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (funnel_id, agent)
);
create trigger role_launch_owner before insert or update on public.role_launch
  for each row execute function public.same_owner();
alter table public.role_launch enable row level security;
create policy "Own role launch" on public.role_launch for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.role_launch to authenticated, service_role;
alter publication supabase_realtime add table public.role_launch;

-- Who may work a role, in order: an app (on a computer, or any computer that has it) with its model and effort.
create table public.role_executors (
  id uuid primary key default gen_random_uuid(),
  funnel_id uuid not null,
  agent text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  position integer not null default 0,
  enabled boolean not null default true,
  app text not null check (app in ('claude', 'codex', 'antigravity', 'grok')),
  computer text check (length(computer) <= 64),  -- null: any computer that has the app
  model text check (length(model) <= 64),
  effort text check (effort in ('low', 'medium', 'high', 'xhigh', 'max', 'ultra')),
  new_chat boolean not null default true,
  full_access boolean not null default true,
  bot_id text check (bot_id ~ '^[A-Za-z0-9_-]{1,128}$'),  -- Grok Bot: the bot that works the role
  created_at timestamptz not null default now(),
  foreign key (funnel_id, agent) references public.role_launch (funnel_id, agent) on delete cascade
);
create index role_executors_role on public.role_executors (funnel_id, agent, position);
create trigger role_executors_owner before insert or update on public.role_executors
  for each row execute function public.same_owner();
alter table public.role_executors enable row level security;
create policy "Own role executors" on public.role_executors for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.role_executors to authenticated, service_role;
alter publication supabase_realtime add table public.role_executors;

-- Each start Goalcraft makes, from due to done: why (schedule, a message, an answer, the person's "Run
-- now"), on whom, which computer took it, when the agent reported work, and how it ended.
create table public.role_launches (
  id uuid primary key default gen_random_uuid(),
  funnel_id uuid not null references public.funnels (id) on delete cascade,
  agent text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reason text not null check (reason in ('schedule', 'message', 'answer', 'manual', 'agent')),
  due_at timestamptz not null default now(),
  executor_id uuid references public.role_executors (id) on delete set null,
  app text, model text, effort text, computer text,
  claimed_by uuid references public.wake_keys (id) on delete set null,
  claimed_at timestamptz,
  started_at timestamptz,  -- the agent's set_agent_state(work)
  ended_at timestamptz,
  outcome text check (outcome in ('done', 'silent', 'not_started', 'failed', 'skipped')),
  note text check (length(note) <= 300),
  run_id bigint references public.agent_runs (id) on delete set null,
  created_at timestamptz not null default now()
);
create index role_launches_role on public.role_launches (funnel_id, agent, created_at desc);
create index role_launches_open on public.role_launches (user_id) where ended_at is null;
create trigger role_launches_owner before insert or update on public.role_launches
  for each row execute function public.same_owner();
alter table public.role_launches enable row level security;
create policy "Own role launches" on public.role_launches for select to authenticated using ((select auth.uid()) = user_id);
-- The person's "Run now": a manual start of their own role, nothing else.
create policy "Run now" on public.role_launches for insert to authenticated
  with check ((select auth.uid()) = user_id and reason = 'manual' and executor_id is null and claimed_at is null and ended_at is null);
grant select, insert on public.role_launches to authenticated;
grant select, insert, update, delete on public.role_launches to service_role;
alter publication supabase_realtime add table public.role_launches;

-- A run in the agent's history: which executor worked it, and the start it answers.
alter table public.agent_runs add column app text, add column model text,
  add column launch_id uuid references public.role_launches (id) on delete set null;

-- What each computer can run: its apps and their models, as its wake script reads them.
alter table public.wake_keys add column inventory jsonb;
