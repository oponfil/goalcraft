-- Things only the person can do for a funnel (take a test task, fill in a form, answer a recruiter),
-- kept by its supervisor through MCP (set_tasks): it adds them, orders them most urgent first,
-- removes what no longer matters and marks what is done. The person only sees them on the
-- dashboard. Unlike a question, a task doesn't hold the agents up.
create table public.person_tasks (
  id uuid primary key default gen_random_uuid(),
  funnel_id uuid not null references public.funnels (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  position integer not null default 0,
  title text not null check (length(title) between 1 and 120),
  detail text check (length(detail) <= 300),
  url text check (url ~ '^https?://' and length(url) <= 2000),
  due_at timestamptz,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index person_tasks_funnel on public.person_tasks (funnel_id, done_at, position);
create trigger person_tasks_owner before insert or update on public.person_tasks
  for each row execute function public.same_owner();
alter table public.person_tasks enable row level security;
create policy "Own tasks" on public.person_tasks for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.person_tasks to authenticated, service_role;
alter publication supabase_realtime add table public.person_tasks;
