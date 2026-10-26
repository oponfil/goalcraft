-- The Kimi plan's limit (Kimi Code, the quota of the Kimi app's Work), as the wake script reads it.
-- Kimi's resets monthly, not weekly.
alter table public.limit_readings drop constraint limit_readings_app_check;
alter table public.limit_readings add constraint limit_readings_app_check check (app in ('claude', 'antigravity', 'grok', 'kimi'));
