-- A role starts on its computer (role_launch.computer; none chosen: the first one set up). With a spare
-- (computer_fallback), another computer takes the start while that one is off; without one, the start
-- waits for it. Off by default: a role runs where its owner put it.
alter table public.role_launch add column computer_fallback boolean not null default false;
