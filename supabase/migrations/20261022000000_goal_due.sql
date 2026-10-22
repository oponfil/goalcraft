-- A goal is how many results by when: goal_due, the moment it should be reached. The pace
-- (goal_every_days) stays only for funnels set up before it; each gets a due date that shows what
-- the board showed until now (the results still missing at that pace, counted from today).
alter table public.funnels add column goal_due timestamptz;
update public.funnels
  set goal_due = now() + make_interval(secs => greatest(goal_total - results, 0) * goal_every_days * 86400)
  where goal_due is null and goal_total is not null and goal_every_days is not null;
