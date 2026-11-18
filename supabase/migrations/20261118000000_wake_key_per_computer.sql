-- A wake key per computer: the person may run the wake script on several (a Mac and a PC), each with
-- its own key, so a new key no longer stops the script on another computer. The script says which
-- computer it runs on (its name) with every request; a new key on the same computer replaces the old.
alter table public.wake_keys drop constraint wake_keys_pkey;
alter table public.wake_keys add column id uuid not null default gen_random_uuid();
alter table public.wake_keys add primary key (id);
alter table public.wake_keys add column computer text check (char_length(computer) <= 64);
create index wake_keys_user on public.wake_keys (user_id);

-- Which computer's script sent a run's tokens: each sends all it read of the last days again and
-- replaces only its own rows, so two computers don't drop each other's.
alter table public.agent_usage add column wake_key_id uuid references public.wake_keys (id) on delete set null;
