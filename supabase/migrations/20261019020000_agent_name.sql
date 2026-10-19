-- An agent's own short name, in the person's language, shown instead of its model's name: the
-- supervisor names itself after its funnel ("Супервайзер поиска работы"), and the person can ask any
-- agent to rename itself.
alter table public.presence add column display_name text check (length(display_name) between 1 and 40);
