-- Any agent may add a task for the person and mark one done (add_task, done_task), not only the
-- supervisor; the supervisor still orders and prunes the list (set_tasks). Who added a task.
alter table public.person_tasks add column added_by text;
