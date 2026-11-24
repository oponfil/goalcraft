-- A computer's wake script stopped from the board (Stop / Start in the spending card's scripts):
-- while set, the script only asks every minute whether it may go on; the wake function hands it no
-- agents to wake and no orchestrator starts, and the board shows it grey instead of as a problem.
-- The board sets it as the person (the table's grants and the "Own wake key" policy cover the column).
alter table public.wake_keys add column if not exists stopped_at timestamptz;
