-- The person's conversations with the agents are kept only as long as they are needed, so a leak
-- could expose at most the last day of them. A question waits until it is answered or closed, a
-- message until it is read; a day after the last thing that happened to it (the answer, the agent's
-- reply, the reply read), it is deleted with its text. The statistics stay: runs, counts, spending.
create extension if not exists pg_cron;

create or replace function public.purge_conversations() returns void
language sql security definer set search_path = public as $$
  delete from public.questions
  where answered_at is not null
    and greatest(asked_at, answered_at, replied_at, reply_seen_at) < now() - interval '1 day';
  delete from public.agent_messages
  where read_at is not null
    and greatest(sent_at, read_at, replied_at, reply_read_at, reply_seen_at) < now() - interval '1 day';
$$;
revoke all on function public.purge_conversations() from public, anon, authenticated;

-- Every hour, at a quarter past.
select cron.schedule('purge-conversations', '15 * * * *', 'select public.purge_conversations()');
select public.purge_conversations();
