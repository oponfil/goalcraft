-- The wake script's version, as it says with every request (its User-Agent): agents compare it with
-- the one on goalcraft.ai and offer the person an update. The script never updates itself.
alter table public.wake_keys add column script_version text;
