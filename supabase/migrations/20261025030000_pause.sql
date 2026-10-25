-- An agent on pause: it won't run until it is resumed (the person paused it, or its plan's limit ran
-- out). Not asleep: no next run to wait for, no warning when it stays quiet, nothing wakes it.
alter table public.presence drop constraint presence_state_check;
alter table public.presence add constraint presence_state_check check (state in ('work', 'sleep', 'ask', 'pause'));
alter table public.presence add column pause_reason text check (char_length(pause_reason) <= 120);
