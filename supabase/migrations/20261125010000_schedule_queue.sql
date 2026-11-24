-- A role's starts on its schedule queue up behind a run that takes longer than the schedule's step: each
-- waits its turn (one run at a time). Other starts (a message, an answer, Run now) still wait one at a time.
drop index if exists public.role_launches_one_waiting;
create unique index role_launches_one_waiting on public.role_launches (funnel_id, agent)
  where claimed_at is null and ended_at is null and reason <> 'schedule';
