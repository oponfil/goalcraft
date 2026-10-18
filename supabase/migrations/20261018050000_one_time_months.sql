-- One month of Pro bought once (Polar product "Goalcraft Pro — 1 month, one-time"): each paid
-- order adds 30 days. Orders already counted are kept here, so a webhook delivered twice (Polar
-- retries) never adds a second month. Only the billing function writes it.
create table public.pro_orders (
  order_id text primary key,
  user_id uuid not null references auth.users on delete cascade,
  days int not null,
  created_at timestamptz not null default now()
);
alter table public.pro_orders enable row level security;
