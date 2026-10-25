-- What every local session of an app cost since its limit's window began (resets_at less a week):
-- with an exact percent (Antigravity) the rate is that percent over this cost, from one reading.
alter table public.limit_readings add column window_cost_usd numeric(10, 4);
