-- Every script's check runs the orchestrator, so two computers may put a role's start in line at the same
-- moment: at most one start waits per role, and a schedule's time is started once.
create unique index role_launches_one_waiting on public.role_launches (funnel_id, agent) where claimed_at is null and ended_at is null;
create unique index role_launches_schedule_once on public.role_launches (funnel_id, agent, due_at) where reason = 'schedule';

-- A change of a role's settings is when its schedule starts counting (a time already past is not started).
create trigger role_launch_touch before update on public.role_launch
  for each row execute function public.touch_updated_at();
