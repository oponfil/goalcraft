-- The computer a question's chat is on, when Goalcraft started the run that asked it: the board doesn't
-- offer to open a chat that is on another computer, and says which one it is on.
alter table public.questions add column computer text check (length(computer) <= 120);

-- The questions asked so far from a run Goalcraft started: that run's computer.
update public.questions q set computer = l.computer
from public.agent_runs r join public.role_launches l on l.id = r.launch_id
where q.computer is null and q.chat_url is not null and r.funnel_id = q.funnel_id and r.agent = q.agent
  and r.chat_url = q.chat_url and l.computer is not null;
