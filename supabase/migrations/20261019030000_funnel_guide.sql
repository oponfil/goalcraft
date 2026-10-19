-- The funnel's guide: one document (a Google Doc next to its Google Sheet, a Notion page…) with
-- everything its supervisor and workers need to know. Goalcraft keeps only the link, as for the list.
alter table public.funnels add column guide_url text check (guide_url ~ '^https?://');
