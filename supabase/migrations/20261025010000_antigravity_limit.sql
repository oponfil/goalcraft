-- Antigravity's quota (Gemini), read hourly from its language server on the person's computer, like Claude's limit.
alter table public.limit_readings drop constraint limit_readings_app_check;
alter table public.limit_readings add constraint limit_readings_app_check check (app in ('claude', 'antigravity'));
