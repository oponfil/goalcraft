-- Kimi agents in the Kimi app (Work, its Kimi Code agent on this Mac): the wake script reads their
-- tokens from the app's conversation records, as it does for Claude, Codex and Antigravity.
alter table public.agent_usage drop constraint agent_usage_app_check;
alter table public.agent_usage add constraint agent_usage_app_check check (app in ('claude', 'codex', 'antigravity', 'grok', 'kimi'));
