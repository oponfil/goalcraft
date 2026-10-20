-- From 30.10.2026 Supabase no longer grants Data API access to new tables in "public" by itself:
-- every table needs its grants in the migration that creates it. These are the grants our tables
-- have relied on so far (the dashboard as an authenticated user, the edge functions as
-- service_role; row access stays with RLS), written out so a fresh database (db reset, a branch)
-- gets them too. A new table: add the same two lines for it in its own migration.
grant select, insert, update, delete on
  public.accounts, public.agent_messages, public.agent_runs, public.agent_wakes, public.count_reports,
  public.funnels, public.presence, public.pro_orders, public.questions, public.stages, public.wake_keys
  to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
