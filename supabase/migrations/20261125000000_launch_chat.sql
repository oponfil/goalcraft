-- The conversation a start continues, and the computer it is on: an answer goes to the conversation the
-- question was asked in, a message to the agent's own (the one its card opens), a scheduled start to the
-- agent's own when its executor doesn't open a new one each time. Null: a new conversation.
alter table public.role_launches add column chat_url text check (length(chat_url) <= 2000);
alter table public.role_launches add column chat_computer text check (length(chat_computer) <= 120);
