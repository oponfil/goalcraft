-- What the wake script on a computer says is wrong there (Claude Code signed out, a tool missing, an
-- agent it could not wake…): [{ code, level: "error" | "warning", agent?, why? }], as of its last request.
-- The spending card shows them by the computer, its dot amber or red.
alter table public.wake_keys add column problems jsonb;
