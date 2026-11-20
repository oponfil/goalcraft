-- The person's order of their funnels on the board (dragged by their titles), kept here so every
-- browser and computer shows the same one. Null: not placed yet, after the placed ones by age.
alter table public.funnels add column if not exists position int;
grant select (position), update (position) on public.funnels to authenticated;

-- One call for a new order: each of the person's own funnels in ids gets its place (1, 2, …).
create or replace function public.set_funnel_order(ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.funnels f set position = array_position(ids, f.id)
  where f.id = any(ids) and f.user_id = (select auth.uid()) and f.position is distinct from array_position(ids, f.id);
$$;

revoke all on function public.set_funnel_order(uuid[]) from public, anon;
grant execute on function public.set_funnel_order(uuid[]) to authenticated;
