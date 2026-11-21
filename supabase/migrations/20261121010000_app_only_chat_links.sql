-- antigravity:// and kimi:// (apps with no link to one conversation), which set_agent_state has taken
-- since 15 November 2026: the database still refused them, so an agent sending one failed its call.
alter table public.presence drop constraint presence_chat_url_check;
alter table public.presence add constraint presence_chat_url_check check (chat_url ~ '^(https?|claude|codex|grokbot|antigravity|kimi)://');
alter table public.questions drop constraint questions_chat_url_check;
alter table public.questions add constraint questions_chat_url_check check (chat_url ~ '^(https?|claude|codex|grokbot|antigravity|kimi)://');
