-- A run's tokens by kind, for the breakdown shown on hover: new input, input re-read from the cache,
-- input written to the cache, output. limit_used: how much of the plan's limit this run took (Codex).
alter table public.agent_usage
  add column input_tokens bigint,
  add column cache_read_tokens bigint,
  add column cache_write_tokens bigint,
  add column output_tokens bigint,
  add column limit_used numeric(5, 2);
