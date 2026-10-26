-- A Grok agent working in the Grok Bot app links its bot there: grokbot://app/v1/agent?id=<bot id>.
alter table public.presence drop constraint presence_chat_url_check;
alter table public.presence add constraint presence_chat_url_check check (chat_url ~ '^(https?|claude|codex|grokbot)://');
alter table public.questions drop constraint questions_chat_url_check;
alter table public.questions add constraint questions_chat_url_check check (chat_url ~ '^(https?|claude|codex|grokbot)://');
