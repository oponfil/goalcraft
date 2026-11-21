-- The system of the computer a wake script runs on, as the script says (scripts from 2026-11-21.1 on):
-- a Claude or Codex chat opens only on its own computer, so the board greys out Open for one on a
-- computer with another system than the browser's. Null: not said yet.
alter table public.wake_keys add column if not exists os text check (os in ('mac', 'windows', 'linux'));
-- The table's grants (20261020020000_explicit_grants.sql) are for the whole table, new columns included.
