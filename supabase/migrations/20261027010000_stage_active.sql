-- Open items: of the items that ever reached a stage (count, cumulative), how many are still there and
-- may go on to the next one: not moved on yet, not dropped (refused, gone quiet for good). The agent
-- reports it with the counts; null while it doesn't.
alter table public.stages add column active int check (active >= 0);
