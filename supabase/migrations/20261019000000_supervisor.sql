-- The supervisor: the person's own agent standing over a whole funnel, on the platform at its top.
-- It is a presence with no zone (null), one per funnel. Each of its runs ends with what it found:
-- a status (all good, bottleneck, recommendation, question) and a short line, kept on its presence
-- (shown by it) and on the run (its history).
alter table public.presence alter column zone drop not null;
alter table public.presence
  add column status text check (status in ('ok', 'bottleneck', 'recommendation', 'question')),
  add column summary text check (length(summary) <= 200);
create unique index presence_one_supervisor on public.presence (funnel_id) where zone is null;

alter table public.agent_runs alter column zone drop not null;
alter table public.agent_runs
  add column status text check (status in ('ok', 'bottleneck', 'recommendation', 'question')),
  add column summary text check (length(summary) <= 200);

-- Zone limits are for workers; the supervisor's place holds one agent.
create or replace function public.presence_zone_limit() returns trigger
language plpgsql set search_path = '' as $$
declare
  max_agents int := case public.my_plan() when 'pro' then 2 else 1 end;
  other text;
begin
  if new.zone is null then
    select p.agent into other from public.presence p
      where p.funnel_id = new.funnel_id and p.zone is null and p.agent <> new.agent;
    if other is not null then
      raise exception 'This funnel already has a supervisor: %.', other using errcode = 'check_violation';
    end if;
  -- An agent already in this zone keeps its place, even over a limit lowered since (a downgrade).
  elsif not exists (select 1 from public.presence p
                    where p.funnel_id = new.funnel_id and p.agent = new.agent and p.zone = new.zone)
     and (select count(*) from public.presence p
          where p.funnel_id = new.funnel_id and p.zone = new.zone and p.agent <> new.agent) >= max_agents then
    raise exception 'Zone % is full: the % plan has % agent(s) per zone.', new.zone, public.my_plan(), max_agents
      using errcode = 'check_violation';
  end if;
  new.updated_at := now();
  return new;
end $$;
