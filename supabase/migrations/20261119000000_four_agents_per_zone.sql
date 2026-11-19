-- Pro holds up to four agents per zone, two each side of the pipe (it was two): several agents can
-- share a stage, such as searches by different providers, each finding what the others miss. Free
-- keeps one. The rest is as before.

create or replace function public.presence_zone_limit() returns trigger
language plpgsql set search_path = '' as $$
declare
  max_agents int := case public.my_plan() when 'pro' then 4 else 1 end;
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
