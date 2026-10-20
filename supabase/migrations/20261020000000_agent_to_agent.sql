-- The supervisor writes to the workers of its funnel (send_message): such a message has from_agent
-- set (the person's own messages leave it null). The worker reads it and replies as to the person;
-- the reply goes back to the supervisor on its next get_messages, which marks it read (reply_read_at)
-- instead of showing it over the worker on the dashboard.
alter table public.agent_messages
  add column from_agent text,
  add column reply_read_at timestamptz;
