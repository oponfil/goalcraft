-- The wake script also wakes a supervisor when a worker replies to its message: once per reply.
alter table public.agent_messages add column reply_woken_at timestamptz;
