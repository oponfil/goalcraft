-- What each result is, in order: the company of an offer, a startup, a video, a conference. A short
-- name per result, shown when the person points at it on the board; results without one stay unnamed.
alter table public.funnels add column result_titles text[] not null default '{}'
  check (coalesce(array_length(result_titles, 1), 0) <= 1000);
