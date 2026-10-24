-- One app can have several quotas (Antigravity: Gemini 4 Argon, other Gemini, Claude and GPT): a
-- reading belongs to one of them; '' for an app with a single limit (Claude).
alter table public.limit_readings add column quota text not null default '';
alter table public.limit_readings drop constraint limit_readings_pkey;
alter table public.limit_readings add primary key (user_id, app, quota, at);
