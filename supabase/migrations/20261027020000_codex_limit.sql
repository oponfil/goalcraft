-- Codex's weekly limit as a reading too (its share per run is still what Codex logged per run): the
-- spending card lists every plan's limit with when it resets.
alter table public.limit_readings drop constraint limit_readings_app_check;
alter table public.limit_readings add constraint limit_readings_app_check check (app in ('claude', 'codex', 'antigravity', 'grok', 'kimi'));
