-- A role's main computer: with several computers running the wake script, the role starts on this one
-- whenever it is on; only when it is off does another take the run (in the order the scripts were set
-- up). null: the first one set up.
alter table public.role_launch add column computer text check (length(computer) <= 64);
