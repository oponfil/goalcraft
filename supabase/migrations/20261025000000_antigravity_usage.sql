-- Token use read from Google Antigravity (Gemini) too, besides Claude Code and Codex.
alter table public.agent_usage drop constraint agent_usage_app_check;
alter table public.agent_usage add constraint agent_usage_app_check check (app in ('claude', 'codex', 'antigravity'));
