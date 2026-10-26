-- Where people come from, for counting what each channel (a directory, a forum, a post) brings:
-- sign-ups, funnels made, payments. Two tables, as they are written by different hands.
--
-- signup_sources: one row per person, written once by the site when they first sign in: the
-- campaign tags of the first link that brought them (utm_*), the site that link was on (its host
-- only), a discount code the link carried, and when that first visit was. People who signed up
-- before this have no row.
create table public.signup_sources (
  user_id uuid primary key references auth.users (id) on delete cascade,
  utm_source text check (char_length(utm_source) <= 200),
  utm_medium text check (char_length(utm_medium) <= 200),
  utm_campaign text check (char_length(utm_campaign) <= 200),
  utm_content text check (char_length(utm_content) <= 200),
  utm_term text check (char_length(utm_term) <= 200),
  referrer text check (char_length(referrer) <= 200),
  landing_page text check (char_length(landing_page) <= 200),
  code text check (char_length(code) <= 64),
  first_seen_at timestamptz,
  saved_at timestamptz not null default now()
);
alter table public.signup_sources enable row level security;
-- People see their own row; nobody writes it directly: save_signup_source does, once.
create policy "Own source" on public.signup_sources for select to authenticated
  using ((select auth.uid()) = user_id);
grant select on public.signup_sources to authenticated;
grant select, insert, update, delete on public.signup_sources to service_role;

-- The site calls this after sign-in with what it kept from the first visit. Only the first call
-- counts, and only for a person who signed up after that visit: someone who had an account
-- already and follows a tagged link later gets no row.
create function public.save_signup_source(
  utm_source text default null, utm_medium text default null, utm_campaign text default null,
  utm_content text default null, utm_term text default null, referrer text default null,
  landing_page text default null, code text default null, first_seen_at timestamptz default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  seen timestamptz := least(coalesce(first_seen_at, now()), now());
begin
  if me is null then return; end if;
  if not exists (select 1 from auth.users u where u.id = me and u.created_at >= seen - interval '1 hour') then return; end if;
  insert into public.signup_sources (user_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer, landing_page, code, first_seen_at)
  values (me, left(utm_source, 200), left(utm_medium, 200), left(utm_campaign, 200), left(utm_content, 200), left(utm_term, 200),
          left(referrer, 200), left(landing_page, 200), left(code, 64), seen)
  on conflict (user_id) do nothing;
end $$;
revoke all on function public.save_signup_source(text, text, text, text, text, text, text, text, timestamptz) from public, anon;
grant execute on function public.save_signup_source(text, text, text, text, text, text, text, text, timestamptz) to authenticated;

-- discount_uses: a Polar discount applied to a payment, as Polar's webhook reports it: one row per
-- order or subscription with a discount. Only the billing function writes it.
create table public.discount_uses (
  polar_id text primary key,  -- the order's or the subscription's id at Polar
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('order', 'subscription')),
  discount_id text not null,
  code text check (char_length(code) <= 64),
  used_at timestamptz not null default now()
);
create index discount_uses_user on public.discount_uses (user_id);
alter table public.discount_uses enable row level security;
create policy "Own discounts" on public.discount_uses for select to authenticated
  using ((select auth.uid()) = user_id);
grant select on public.discount_uses to authenticated;
grant select, insert, update, delete on public.discount_uses to service_role;
