-- Every agent has launch settings: one with none (it joined by itself, or was set up before the orchestrator)
-- gets them on pause, no schedule on and no executor, so Goalcraft doesn't start it until its owner turns it on.
insert into public.role_launch (funnel_id, agent, user_id, schedule, schedule_on, mode)
select p.funnel_id, p.agent, p.user_id, null, false, 'priority'
from public.presence p
on conflict (funnel_id, agent) do nothing;

create or replace function public.presence_launch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.role_launch (funnel_id, agent, user_id, schedule, schedule_on, mode)
  values (new.funnel_id, new.agent, new.user_id, null, false, 'priority')
  on conflict (funnel_id, agent) do nothing;
  return new;
end $$;
revoke all on function public.presence_launch() from public, anon, authenticated;

create trigger presence_launch after insert on public.presence
  for each row execute function public.presence_launch();
