-- Which AI an agent is (claude, chatgpt, gemini…), as the agent says with set_agent_state: its shirt's
-- colour and logo. Apart from its name, which is only its name in the funnel ("search"); where it works
-- is its chat_url. Agents that never sent it have none: the board then goes by the chat link, the app
-- its runs were counted in, or a name like "claude-search".
alter table public.presence add column provider text check (provider ~ '^[a-z0-9][a-z0-9-]{0,31}$');
