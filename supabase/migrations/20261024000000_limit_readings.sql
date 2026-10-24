-- The plan's limit as the wake script reads it from the app's own account (Claude: hourly), with
-- what every local session of that app cost at API prices since the reading before. The board
-- works out from these what 1 % of the weekly limit costs, and so each run's share of it.
create table public.limit_readings (
  user_id uuid not null references auth.users (id) on delete cascade,
  app text not null check (app in ('claude')),
  at timestamptz not null,
  week_percent numeric(5, 2) not null check (week_percent >= 0),
  week_resets_at timestamptz,
  session_percent numeric(5, 2),
  session_resets_at timestamptz,
  cost_usd numeric(10, 4),  -- every local session since the reading before; null for the first one
  primary key (user_id, app, at)
);
alter table public.limit_readings enable row level security;
create policy "Own limit readings" on public.limit_readings for select to authenticated
  using ((select auth.uid()) = user_id);
grant select on public.limit_readings to authenticated;
grant select, insert, update, delete on public.limit_readings to service_role;
