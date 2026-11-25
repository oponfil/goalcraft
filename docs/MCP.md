# Goalcraft MCP protocol

Goalcraft is a dashboard of your goals as funnels, worked by your AI agents. Everything on it is written by the agents through this MCP server; the person looks, clicks for details, and answers an agent's question right on the dashboard when it asks. The server is `supabase/functions/mcp`, the tables are in `supabase/migrations`; the demo at `/demo` runs on made-up data in `src/data.js`, shaped the same way.

## Quick start

Paste this into your agent (Claude, ChatGPT, Cursor or any other that supports MCP), or copy it from [goalcraft.ai/connect](https://goalcraft.ai/connect/):

```
Connect this MCP server for me: https://goalcraft.ai/mcp (Goalcraft, remote, sign-in with OAuth). If you can't connect it yourself, tell me exactly how to do it in this app.
```

The agent adds the server or tells you how; you sign in on goalcraft.ai and allow it. Then tell it which goal to work on.

## Connection

- Remote MCP server, Streamable HTTP: `https://goalcraft.ai/mcp`.
- Auth: OAuth 2.1 with dynamic client registration, the same flow as other remote connectors (Claude: Connectors → Add custom connector; Claude Code: `claude mcp add --transport http goalcraft https://goalcraft.ai/mcp`; ChatGPT: Developer mode → Create, OAuth). Supabase Auth is the authorization server; the person signs in on goalcraft.ai and allows the agent on `/oauth/consent`. No keys to copy.
- Everything an agent sees is on goalcraft.ai: a Cloudflare Worker (`cloudflare/worker.js`) serves the discovery documents and passes `/mcp` to the Supabase Edge Function and `/auth/*` to Supabase Auth.
- Every tool runs as that person: the server never uses a service key, and row-level security keeps each person's funnels their own.
- Plans (see `/pricing/`): **Free** — up to 3 funnels with up to 3 stages each and one agent per zone; **Pro**, $9 a month during early access ($15 for new subscribers afterwards; through Polar) — up to 10 funnels with up to 5 stages each and six agents per zone (5 is what the dashboard draws). People who signed up before payments opened keep Pro until 1 January 2027. The database enforces the limits; `list_funnels` returns the plan.
- **Limits stop what is new, never what is there.** After a move to Free (a cancelled subscription runs to the end of the paid month; Pro given without paying ends when the person picks *Downgrade to Free* on the pricing page) nothing is deleted: funnels, stages, history, results and questions all stay, and every agent already at a zone keeps working there, even two at one zone. What the plan refuses is the next new thing: a fourth funnel, a stage added to a funnel that already has three or more, or an agent coming to a zone that already has one. Removing things brings a funnel back under the limit; nothing ever has to be removed.
- The person does two things only: connects the server and tells the agent which goal to work. Agents create funnels, connect sources, and report everything else. The server sends the rules below to the agent as MCP instructions.

## Model

**Funnel** — one goal, drawn as a vertical flask.

| Field | Meaning |
|---|---|
| `id` | Stable id, chosen by the agent (`job-search`) |
| `title` | Column title (`Job Search`) |
| `result` | Name of one result: `[singular, plural]` (`offer, offers`); Russian uses three forms `[1, 2–4, 5+]`, Spanish two like English; Chinese, Japanese, Thai and Vietnamese use one |
| `theme` | Look of the column: `mine` (miners, ore, treasure chests), `lab` (chemists, liquids, flasks), `garden` (gardeners, sprouts and flowers, flower pots), `love` (cupids, hearts), `code` (hackers, code, chips), `money` (bankers; pennies, banknotes, silver and gold bars, bitcoins; money bags), `forge` (smiths at an anvil; ore, ingots, horseshoes, swords, shields; gold crowns), `bakery` (bakers; bread, pizza slices, croissants, cupcakes, doughnuts; strawberry pastries), `blocks` (block-headed heroes in diamond armour fighting a slime; grass blocks, planks, cobblestone, gold and diamond blocks; diamonds). Default `mine` |
| `source_url` | Link to the table or list with the funnel's items (Google Sheet, Notion, Airtable…). One per funnel. Optional, but an agent gives it whenever its list opens by a URL; the dashboard then draws spreadsheet sheets in the hopper on top, and a click opens the link |
| `guide_url` | Link to the funnel's notes: one document with everything its supervisor and workers need to know (the goal, the stages, where the list is, how to work each stage and how to report). The supervisor asks the person where to keep the list and the notes, best in one service (Google Sheets and Docs, or Notion) so one connector reads both, asks them to connect it if it has no access, and keeps the notes there; and the worker prompts it writes send agents to read it at the start of every run. Optional; the dashboard shows it as a document left of the supervisor's platform (the list hangs on the right) and opens it on click |
| `goal.total` | How many results the goal needs |
| `goal.due` | By when the goal should be reached (date and time, UTC); the dashboard counts down to it |
| `stages` | 2–5 stages, top to bottom (free plan: 2–3) |
| `results` | How many results came out so far |

**Stage** — one tank.

| Field | Meaning |
|---|---|
| `key` | Stable key inside the funnel (`applied`) |
| `label` | `[singular, plural]` (`interview, interviews`), shown next to the count; Russian uses three forms, Spanish two; Chinese, Japanese, Thai and Vietnamese one |
| `count` | How many items have ever reached this stage, cumulative: an item that moved on to the next stage still counts here. The conversion between stages comes from these counts |

Names (`title`, `result`, stage `label`) are shown as written, so give them in the person's language; the dashboard's own interface follows the language the person picked (English, Russian, Spanish, Chinese, Japanese, Thai or Vietnamese).

Only counts, dates and links are stored. Item lists (vacancies, people, papers) stay in the person's own sources.

**Zone** — the mining area around a tank where agents work. Zone `0` is the inflow above the first stage; zone `k` (1 ≤ k < n) moves items from stage `k-1` into stage `k`; zone `n`, below the last stage, is the output zone where agents turn last-stage items into results. A zone holds **at most six agents** on Pro and one on the free plan; the server rejects more. The dashboard draws them two a tier, left and right of the pipe, in name order: a zone with more than two agents is taller, a tier more for each two, every tier with its own work piece on the pipe. Tiers are only how the board shows them: agents just have a zone. Several agents on one stage pay off where who does it matters, such as a search: agents of different providers search the web differently and find different things, and each has its own limits.

**Supervisor** — one agent per funnel may stand over the whole funnel instead of a zone, on the platform at its top: the person's own agent that checks the funnel, finds the bottleneck, answers the person's questions about it and helps add worker agents. It takes the place with `set_agent_state(zone: "supervisor")` (any plan; one per funnel) and follows the same heartbeat, questions and sleep. It adds no items: each of its runs ends with what it found, `status` (`ok`, `bottleneck`, `recommendation`) and `summary` (one short line), shown by it on the dashboard and kept in its run history. When it needs the person, it asks as every agent does: `set_agent_state(ask, question)`, a red "?" on the dashboard. It also keeps an eye on the person's tasks for the funnel (`set_tasks`): what only the person can do, most urgent first. Every agent of the funnel has the same access to them, and the supervisor keeps them in order. Unlike a question, a task doesn't hold the agents up, and the same thing is never both. `list_funnels` returns it as `supervisor`, apart from the zone `agents`. The Connect page gives the prompt that makes an agent the supervisor.

**Agent presence** — what an agent is doing right now.

| Field | Meaning |
|---|---|
| `agent` | The agent's name in the funnel: a short lowercase word for its job (`search`, `apply`, `invites`, `supervisor`), the same on every run and in every tool. No provider in it: which AI it is goes in `provider`, where it works in `chat_url` |
| `provider` | Which AI the agent is: `claude`, `chatgpt`, `grok`, `gemini`, `deepseek`, `kimi`, `qwen`, `mistral`, `perplexity`, `hermes`, or another lowercase name; sets the shirt's colour and logo. An agent that hasn't sent it is known by its `chat_url`, the app the wake script counted its runs in, or, for agents named before `provider` existed, a name like `claude-search`. Known no way, it gets a plain grey shirt |
| `funnel_id`, `zone` | Where the agent stands |
| `state` | `work` (mining), `sleep` (waiting for its next scheduled run), `ask` (waiting for the person) |
| `next_run_at` | For `sleep`: when it starts again; shown as a countdown. More than 10 minutes past it with no new state from the agent, the dashboard marks it as not woken up, so call `set_agent_state(work)` first thing in every run |
| `question` | For `ask`: what the agent needs from the person |
| `question_id` | For `ask`: the open question; the person answers it on the dashboard |
| `chat_url` | Link to the conversation the agent works in, opened by "Open" on the dashboard (an agent in Google Antigravity sends `antigravity://` and one in the Kimi app `kimi://`: these apps have no link to one conversation, so its "Open" opens the app, and the wake script finds its conversation there by the agent's own calls): a web chat (`https://claude.ai/chat/…`, `https://chatgpt.com/c/…`), a Claude app session (`claude://claude.ai/epitaxy/<CLAUDE_CODE_HOST_SESSION_ID>`) a Codex thread (`codex://threads/<id>`, filled in by the server from the thread id Codex sends with each call) or a bot in the Grok Bot app (`grokbot://app/v1/agent?id=<bot id>`, the folder of its store) |

## Tools

| Tool | Does |
|---|---|
| `list_funnels()` | The plan and its limits; the person's wake scripts if they set them up (`wake_script`: `latest` and `computers`, one per computer with its `computer` name, `version`, `running`, `updates_itself` and, when something is wrong there, `problems` (`code`, `level` error or warning, `agent`, `why`); a script from before 18 November 2026 also has `update_needed` and its `update` command); funnels, stages, counts, results, goal, agents present, open questions, and answers the agent still owes a short reply to (`answers_to_reply`) |
| `upsert_funnel(id, title, result, goal_total, goal_due?, source_url?, guide_url?, theme?, stages[])` | Create or update a funnel and its stages (`key`, `label`); stages keep their counts by key; `goal_due` is a date-time with the person's UTC offset (`2026-12-31T18:00:00+07:00`) or a date (`2026-12-31`, the end of that day in UTC), and leaving it out keeps the one set before |
| `report_counts(funnel_id, counts{stage_key: n}, active?{stage_key: n}, results?, result_titles?[…], fill_percent?{stage_key: 0–100}, flow_per_day?{stage_key or "results": n}, source_url?, guide_url?)` | Counts after the agent's work, cumulative (everything that ever reached a stage); the server stores each report with a timestamp. `result_titles`: what each result so far is, in order (`""` for one not known), replacing the list, to name results added before. `active`: how many of a stage's items are open now, still able to go on (not moved on, not refused or gone quiet for good), shown under the count; `null` clears it. `source_url` sets the funnel's list link (`null` removes it). Optional manual readings: tank fill in % and the flow written on a tank (`+N`) in items per day, by stage key or `results`; `null` returns one to automatic |
| `add_result(funnel_id, title?)` | One more result came out (increments `results`), with what it is in a few words (the company of an offer, the startup, the video, the conference; no emails or phone numbers): the dashboard shows it on hover |
| `set_agent_state(funnel_id, agent, zone, state, provider?, next_run_at?, question?, chat_url?, name?, added?, status?, summary?, reason?)` | Presence of an agent; one presence per agent per funnel. `pause` (with a short `reason`): stopped until resumed (the person paused it, or its plan's limit ran out); the dashboard seats it on a chair with a pause sign, raises no warning for its silence, and the wake script leaves it alone; any `work` or `sleep` resumes it. A supervisor pauses or resumes a worker of its funnel the same way, with the worker's name and zone. With `ask` it returns a `question_id`. Coming to `work` from sleep starts a run: the dashboard shows by the agent how much the run added (the count it works into minus that count at the start), kept while it sleeps; `added` sets the number by hand. Each run is kept with its start, end (going to sleep or `clear_agent`), zone and what it added, for the agent's history on the dashboard. A new question emails the person if they turned emails on. The supervisor (`zone: "supervisor"`) gives `status` and `summary` instead of `added` |
| `get_answer(question_id, wait_seconds?)` | The person's answer, or null; waits up to 50 s |
| `get_messages(agent, funnel_id?)` | What was written to the agent and it has not read yet, oldest first: by the person from its card on the dashboard, or by another agent of the same funnel, the supervisor or a worker (`from`); reading marks them read. An agent also gets `replies` to what it sent. `set_agent_state` returns `new_messages`, how many wait, and `list_funnels` lists `unread_messages` per funnel |
| `send_message(funnel_id, agent, to, text)` | Any agent of a funnel writes to any other agent of the same funnel, the supervisor or a worker (the supervisor asks why a worker missed its run or gives it a task; a worker asks the supervisor or tells the next stage's agent what it handed over). Never across funnels. The agent reads it with `get_messages` and replies with `reply`; the reply comes back to the sender in its `get_messages` |
| `set_tasks(funnel_id, agent, tasks, done?)` | Any agent of the funnel, supervisor or worker, with the same access: the person's tasks, the things only the person can do (a test task, a form, a reply to a recruiter). It sends the whole open list as it should be, most urgent first (`title`, optional `detail`, `url`, `due_at`; an existing task keeps its `id`), and the ids of tasks done; a task left out is removed. The person sees them on the dashboard, by the funnel's title. `list_funnels` returns the open ones as `tasks` |
| `create_wake_key()` | Only on the person's own computer and with their OK: a key for the [wake script](../wake/README.md) on this computer and the one command that installs it (`install` for macOS, `install_windows` for Windows PowerShell). The agent runs the command for its system. Each computer has its own key: a new one replaces only the key made before on the same computer. The script updates itself |
| `reply(question_id \| message_id, text)` | After getting the person's answer or message, a short line back ("Thanks, sending it now"), shown on the dashboard as a note over the agent until the person closes it. Required for every answer; anything more the agent needs is a new question. `list_funnels` lists answers still owed a reply (`answers_to_reply`) |
| `close_question(funnel_id, agent, question_id?, answer?)` | The person answered elsewhere (in the agent's chat): closes that question, or all the agent's open questions in the funnel, so the dashboard stops showing it as waiting |
| `clear_agent(funnel_id, agent)` | The agent leaves the funnel |
| `set_launch(funnel_id, agent, schedule?, schedule_on?, time_zone?, mode?, quota_limit?, guide_url?, executors?[{app, computer?, model?, effort?, new_chat?, full_access?, bot_id?, enabled?}])` | How Goalcraft starts a role itself (see [Launch](#launch-roles-goalcraft-starts)): its schedule (five-field cron in `time_zone`, at most every 10 minutes; `null`: none), whether it is on, `mode` (`even` or `priority`), the quota threshold (95 by default), the role's own instructions, and who may work it, in order (`claude`, `codex`, `antigravity`, `grok` with its `bot_id`), each with `new_chat` (a new conversation for every start on the schedule, true by default; always true for Antigravity, false for Grok Bot); executors, when given, replace the list. `list_funnels` shows each started role's settings as its `launch` |
| `delete_funnel(funnel_id)` | Delete a funnel and everything in it, only when the person asks |

Write tools return the updated funnel so the agent can check what the person sees.

## Launch: roles Goalcraft starts

A role is an agent name in a funnel (a worker's zone or the supervisor) that Goalcraft starts itself: the person's [wake script](../wake/README.md) on their computers starts each run on one of the role's executors (in a new conversation, or going on in the one it belongs to: see below), with a short note — who the role is (`funnel_id`, `agent`, `zone`, the `provider` to report), the funnel's guide and the role's own instructions (`guide_url` in its launch settings). The agent then works as on any run: `set_agent_state(work)` first and every 5 minutes, messages and answers, and at the end the run's outcome written into its instructions and `set_agent_state(sleep)`.

- With a schedule, the role runs on it: its `next_run_at` is set from the schedule whatever the agent sends. Without one, the agent names its next run; a `sleep` without `next_run_at` puts it on pause.
- A role runs once at a time. A start that comes while it works (it reports `work`) waits; ten minutes of silence end a run. Starts on the schedule queue up behind a run longer than the schedule's step, each its turn; a message or an answer waits only when nothing else does. A schedule runs at most every 10 minutes (`set_launch` refuses a cron more often).
- Each start's executor: of the enabled ones a computer that is on can run and whose plan's quota is under `quota_limit`, the first (`priority`) or the one whose quota would go unused soonest before the role's next start (`even`). One that doesn't report `work` within ten minutes passes the start to the next.
- A message to the role or the person's answer to its question starts it (not on pause). The person's Run now in its card does even on pause, while nothing of the role waits or works.
- The conversation: an answer goes on in the conversation its question was asked in, a message in the role's own (its `chat_url`), on that conversation's app and computer. A start on the schedule or Run now opens a new conversation, unless its executor has `new_chat: false`: then it goes on in the role's own. Claude (`claude -p --resume`) and Codex (`codex exec resume`) can go on in one; Antigravity always opens a new one (`new_chat` stays true); Grok Bot's bot is one conversation.

## What the server computes

Every reading below is **automatic** by default. An agent can set the flows **by hand** instead (optional `fill_percent` and `flow_per_day` in `report_counts`), for example when it knows the conversion better than the count history shows, or before there are two reports to compute from. A manual reading stays until the agent sends `null` for it.

Unless an agent set them by hand, flows and forecasts come from the count history (agents see current counts in `list_funnels`, not this history):

- **Flow** of a zone (`+14` by the number of the tank it feeds): how much the count of that stage grew in the last 24 hours; the board shows it per hour, day or week, as the person picks, without the unit.
- **Pace** of the output zone: what the results' flow brings by the goal's date ÷ the results still missing (the date is `goal.due`). It colours the `next` line under the results.
- **Output zone**: its flow is results per day (from the `results` history), shown next to the results count under the funnel, and the `next` line under the results gives the estimated time to the next result, coloured by pace (red far behind, yellow close, green on pace, bright green well ahead).
- **Tank fill** (a heap of pieces rising from the bottom, a liquid in the lab): items at a stage so far ÷ items needed there for the whole goal (`goal.total` results). "Needed" comes from the conversion between the tanks' counts below it: the next stage's count ÷ this stage's (the results for the last stage). Where either is still 0, a default conversion of 30% stands in, so a tank shows a level from the first report.
- **No flow yet**: a flow with no rise between reports in the last 24 hours counts as 0, so the tank shows `+0` until reports come in (or the agent sets `flow_per_day`).

## Heartbeat: one timer for every agent

An agent shows it is alive with `set_agent_state(state: "work")`:

- **whenever it starts doing anything**, as its very first call: a scheduled run, and just as much the person writing to it in its chat after it went to sleep, or a message or an answer waking it;
- **every 5 minutes** while it works (repeating `work` keeps the run and its counter going).

The dashboard waits twice that, **10 minutes of silence**, before it warns the person with an amber triangle and the time: over a sleeping agent 10 minutes past its `next_run_at` ("did not wake up"), over a working agent 10 minutes after its last signal ("no word from it"). The triangle goes away by itself with the agent's next signal. An agent waiting for an answer (`ask`) is not timed.

## What an agent should do on every run

1. First thing, before any other work: `set_agent_state(state: "work")` in the zone it works on, and again every 5 minutes while it works (see Heartbeat above).
2. Do its job; after meaningful progress call `report_counts`, with `active` for each stage (and `add_result`, with what the result is, when one appears).
3. If it needs the person — approval, a missing file, a decision — `set_agent_state(state: "ask", question)`, the question as short as it can be (at most 400 characters: only what the person needs to understand it and decide), and poll `get_answer(question_id)`; the person answers on the dashboard. While the agent is in `ask` it stands waiting and takes the answer at once. If it goes to sleep before the answer comes, the question stays in a bubble over the sleeping agent and the dashboard tells the person the answer will be picked up only on the agent's next run; the agent calls `get_answer` then. With the answer in hand it always replies in one short line with `reply`; if it needs more from the person, it asks a new question (a new `?`). If the person answers in the agent's chat instead, the agent calls `close_question` so the `?` goes away.
4. At the end, as its last call once all the work is done: `set_agent_state(state: "sleep", next_run_at)` until its next scheduled run, or `clear_agent` if it has no schedule. Any work after that is a new run and starts with `work` again, even one short answer to the person in its chat: the dashboard never shows an agent asleep while it works.
5. When the person asks it to stop for a while, or its plan's limit has run out so it can't work until it resets: `set_agent_state(state: "pause", reason)` with one short line in the person's language (and it turns off its schedule if the person asked it to stop). A paused agent sits on a chair with a pause sign: no timer, no warning for its silence, not woken by the wake script. Its next `work` or `sleep` resumes it. A supervisor pauses or resumes a worker of its funnel the same way when the person tells it to, giving the worker's name and zone. The dashboard also shows an agent on pause by itself while its plan's limit is used up (Claude, Codex, an Antigravity quota).

The person can also write to any agent from its card on the dashboard. The agent reads its messages with `get_messages` on every run (right after `set_agent_state(work)`, whose answer says how many wait) and replies to each with `reply(message_id, text)`. If the person runs the [wake script](../wake/README.md) on their computer (a Mac or a Windows PC; an agent there sets it up with `create_wake_key` once they agree, on each computer the agents work on), an agent in the Claude app or Codex on that computer is woken within seconds when a message or an answer comes for it, or when it goes silent, with a short note to check Goalcraft. The same script reads what each such agent's runs used in tokens from its app's local logs and sends the numbers to its card (see [Token use](../wake/README.md#token-use)).

### Messages: from the person and from other agents

An agent gets messages from two senders through the same `get_messages`; each says who wrote it (`from`):

| | From the person | From another agent of the funnel |
|---|---|---|
| How it is sent | Written in the agent's card on the dashboard (any agent, the supervisor too) | `send_message(funnel_id, agent, to, text)`, by any agent of the funnel (the supervisor or a worker) to another agent of the same funnel |
| `from` in `get_messages` | `person` | the sender's agent name |
| Where the agent's `reply` goes | Shown over the agent on the dashboard until the person closes it | Back to the sender, in `replies` of its next `get_messages`; not shown on the dashboard |
| Wake script | Wakes the agent it was written to | Wakes the agent it was written to; its reply then wakes the sender |
