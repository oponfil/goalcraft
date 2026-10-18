-- An agent's chat can be a Claude app session (claude://…) or a Codex thread (codex://…), not only a
-- web chat: the dashboard's "Open" hands those to the app.
alter table public.presence drop constraint presence_chat_url_check;
alter table public.presence add constraint presence_chat_url_check check (chat_url ~ '^(https?|claude|codex)://');
alter table public.questions drop constraint questions_chat_url_check;
alter table public.questions add constraint questions_chat_url_check check (chat_url ~ '^(https?|claude|codex)://');
