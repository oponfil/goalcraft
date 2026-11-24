-- Run now only when nothing of the role waits or goes on: a second press doesn't queue a second run.
create or replace function public.role_idle(f uuid, a text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.role_launches where funnel_id = f and agent = a and ended_at is null)
$$;
revoke all on function public.role_idle(uuid, text) from public;
grant execute on function public.role_idle(uuid, text) to authenticated;

drop policy if exists "Run now" on public.role_launches;
create policy "Run now" on public.role_launches for insert to authenticated
  with check ((select auth.uid()) = user_id and reason = 'manual' and executor_id is null and claimed_at is null and ended_at is null
    and public.role_idle(funnel_id, agent));
