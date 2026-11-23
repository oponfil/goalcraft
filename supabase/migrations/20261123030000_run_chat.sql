-- Each run's own conversation, so its row in the card's runs opens the chat it was worked in (the
-- agent's chat_url as it was on that run). The last run of each agent gets the chat it has now.
alter table public.agent_runs add column chat_url text;

update public.agent_runs r set chat_url = p.chat_url
from public.presence p
where p.funnel_id = r.funnel_id and p.agent = r.agent and p.chat_url is not null
  and r.id = (select max(id) from public.agent_runs x where x.funnel_id = r.funnel_id and x.agent = r.agent);
