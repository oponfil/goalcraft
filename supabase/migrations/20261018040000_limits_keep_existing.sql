-- Plan limits hold back what is new, not what is already there: after a downgrade to Free an
-- agent already standing at a zone keeps reporting there, even when two agents share it. Only an
-- agent coming to a zone (a new one, or one moving from another zone) is checked. An agent's
-- report is an upsert, so the insert half of it is let through for an agent already at the zone too.

create or replace function public.presence_zone_limit() returns trigger
language plpgsql set search_path = '' as $$
declare
  max_agents int := case public.my_plan() when 'pro' then 2 else 1 end;
begin
  if not exists (select 1 from public.presence p
                 where p.funnel_id = new.funnel_id and p.agent = new.agent and p.zone = new.zone)
     and (select count(*) from public.presence p
          where p.funnel_id = new.funnel_id and p.zone = new.zone and p.agent <> new.agent) >= max_agents then
    raise exception 'Zone % is full: the % plan has % agent(s) per zone.', new.zone, public.my_plan(), max_agents
      using errcode = 'check_violation';
  end if;
  new.updated_at := now();
  return new;
end $$;

-- The same for funnels and stages: changing one that exists is never blocked, only adding one.
create or replace function public.funnel_limit() returns trigger
language plpgsql set search_path = '' as $$
declare
  max_funnels int := case public.my_plan() when 'pro' then 10 else 3 end;
begin
  if not exists (select 1 from public.funnels f where f.user_id = new.user_id and f.key = new.key)
     and (select count(*) from public.funnels f where f.user_id = new.user_id and f.key <> new.key) >= max_funnels then
    raise exception 'The % plan has up to % funnels. Delete one to add another.', public.my_plan(), max_funnels
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

create or replace function public.stage_limit() returns trigger
language plpgsql set search_path = '' as $$
declare
  max_stages int := case public.my_plan() when 'pro' then 5 else 3 end;
begin
  if not exists (select 1 from public.stages s where s.funnel_id = new.funnel_id and s.key = new.key)
     and (select count(*) from public.stages s where s.funnel_id = new.funnel_id and s.key <> new.key) >= max_stages then
    raise exception 'The % plan has up to % stages per funnel.', public.my_plan(), max_stages
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
