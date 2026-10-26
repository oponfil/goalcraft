-- Grok agents in the Grok Bot app: the wake script reads their tokens (per bot, per day) and the Grok
-- Bot plan's weekly limit from the Grok Bot servers, as it does for Claude, Codex and Antigravity.
alter table public.agent_usage drop constraint agent_usage_app_check;
alter table public.agent_usage add constraint agent_usage_app_check check (app in ('claude', 'codex', 'antigravity', 'grok'));
alter table public.limit_readings drop constraint limit_readings_app_check;
alter table public.limit_readings add constraint limit_readings_app_check check (app in ('claude', 'antigravity', 'grok'));
