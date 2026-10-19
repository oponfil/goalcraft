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
- Plans (see `/pricing/`): **Free** — up to 3 funnels with up to 3 stages each and one agent per zone; **Pro**, $9 a month during early access ($15 for new subscribers afterwards; through Polar) — up to 10 funnels with up to 5 stages each and two agents per zone (5 is what the dashboard draws). People who signed up before payments opened keep Pro until 1 January 2027. The database enforces the limits; `list_funnels` returns the plan.
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
| `goal.total` | How many results the goal needs |
| `goal.every_days` | Pace: one result every N days |
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

**Zone** — the mining area around a tank where agents work. Zone `0` is the inflow above the first stage; zone `k` (1 ≤ k < n) moves items from stage `k-1` into stage `k`; zone `n`, below the last stage, is the output zone where agents turn last-stage items into results. A zone holds **at most two agents** on Pro (left and right of the pipe) and one on the free plan; the server rejects more.

**Supervisor** — one agent per funnel may stand over the whole funnel instead of a zone, on the platform at its top: the person's own agent that checks the funnel, finds the bottleneck, answers the person's questions about it and helps add worker agents. It takes the place with `set_agent_state(zone: "supervisor")` (any plan; one per funnel) and follows the same heartbeat, questions and sleep. It adds no items: each of its runs ends with what it found, `status` (`ok`, `bottleneck`, `recommendation`, `question`) and `summary` (one short line), shown by it on the dashboard and kept in its run history. `list_funnels` returns it as `supervisor`, apart from the zone `agents`. The Connect page gives the prompt that makes an agent the supervisor.

**Agent presence** — what an agent is doing right now.

| Field | Meaning |
|---|---|
| `agent` | `claude`, `chatgpt`, `grok`, `gemini`, `deepseek`, `kimi`, `qwen`, `mistral`, `perplexity`, `hermes`; sets shirt colour and logo. Any other name gets a plain grey shirt |
| `funnel_id`, `zone` | Where the agent stands |
| `state` | `work` (mining), `sleep` (waiting for its next scheduled run), `ask` (waiting for the person) |
| `next_run_at` | For `sleep`: when it starts again; shown as a countdown. More than 10 minutes past it with no new state from the agent, the dashboard marks it as not woken up, so call `set_agent_state(work)` first thing in every run |
| `question` | For `ask`: what the agent needs from the person |
| `question_id` | For `ask`: the open question; the person answers it on the dashboard |
| `chat_url` | Link to the conversation the agent works in, opened by "Open" on the dashboard: a web chat (`https://claude.ai/chat/…`, `https://chatgpt.com/c/…`), a Claude app session (`claude://claude.ai/epitaxy/<CLAUDE_CODE_HOST_SESSION_ID>`) or a Codex thread (`codex://threads/<id>`, filled in by the server from the thread id Codex sends with each call) |

## Tools

| Tool | Does |
|---|---|
| `list_funnels()` | The plan and its limits; funnels, stages, counts, results, goal, agents present, open questions, and answers the agent still owes a short reply to (`answers_to_reply`) |
| `upsert_funnel(id, title, result, goal_total, goal_every_days, source_url?, theme?, stages[])` | Create or update a funnel and its stages (`key`, `label`); stages keep their counts by key |
| `report_counts(funnel_id, counts{stage_key: n}, results?, fill_percent?{stage_key: 0–100}, flow_per_day?{stage_key or "results": n}, source_url?)` | Counts after the agent's work, cumulative (everything that ever reached a stage); the server stores each report with a timestamp. `source_url` sets the funnel's list link (`null` removes it). Optional manual readings: tank fill in % and the flow written on a tank (`+N`) in items per day, by stage key or `results`; `null` returns one to automatic |
| `add_result(funnel_id)` | One more result came out (increments `results`) |
| `set_agent_state(funnel_id, agent, zone, state, next_run_at?, question?, chat_url?, added?, status?, summary?)` | Presence of an agent; one presence per agent per funnel. With `ask` it returns a `question_id`. Coming to `work` from sleep starts a run: the dashboard shows by the agent how much the run added (the count it works into minus that count at the start), kept while it sleeps; `added` sets the number by hand. Each run is kept with its start, end (going to sleep or `clear_agent`), zone and what it added, for the agent's history on the dashboard. A new question emails the person if they turned emails on. The supervisor (`zone: "supervisor"`) gives `status` and `summary` instead of `added` |
| `get_answer(question_id, wait_seconds?)` | The person's answer, or null; waits up to 50 s |
| `reply(question_id, text)` | After getting the person's answer, a short line back ("Thanks, sending it now"), shown on the dashboard as a note over the agent until the person closes it. Required for every answer; anything more the agent needs is a new question. `list_funnels` lists answers still owed a reply (`answers_to_reply`) |
| `close_question(funnel_id, agent, question_id?, answer?)` | The person answered elsewhere (in the agent's chat): closes that question, or all the agent's open questions in the funnel, so the dashboard stops showing it as waiting |
| `clear_agent(funnel_id, agent)` | The agent leaves the funnel |
| `delete_funnel(funnel_id)` | Delete a funnel and everything in it, only when the person asks |

Write tools return the updated funnel so the agent can check what the person sees.

## What the server computes

Every reading below is **automatic** by default. An agent can set the tank fill and the flows **by hand** instead (optional `fill_percent` and `flow_per_day` in `report_counts`), for example when it knows the conversion better than the count history shows, or before there are two reports to compute from. A manual reading stays until the agent sends `null` for it.

Unless an agent set them by hand, flows and forecasts come from the count history (agents see current counts in `list_funnels`, not this history):

- **Flow** of a zone (`+14` by the number of the tank it feeds): how much the count of that stage grew over the last 7 days, averaged per day; the board shows it per hour, day or week, as the person picks, without the unit. With less than a day of history the growth so far counts as one day's, so the first reports don't extrapolate (+1 in an hour is +1/d, not +24/d).
- **Pace** of the output zone: what the results' flow brings by the goal's date ÷ the results still missing (the date is when they are due at one per `goal.every_days`). It colours the `next` line under the results.
- **Output zone**: its flow is results per day (from the `results` history), shown next to the results count under the funnel, and the `next` line under the results gives the estimated time to the next result, coloured by pace (red far behind, yellow close, green on pace, bright green well ahead).
- **Tank fill** (a heap of pieces rising from the bottom, a liquid in the lab): items at a stage so far ÷ items needed there for the whole goal (`goal.total` results). "Needed" comes from the conversion between the tanks' counts below it: the next stage's count ÷ this stage's (the results for the last stage). Where either is still 0, a default conversion of 30% stands in, so a tank shows a level from the first report.
- **No flow yet**: a flow with fewer than two reports in the last 7 days counts as 0, so the tank shows `+0` until reports come in (or the agent sets `flow_per_day`).

## Heartbeat: one timer for every agent

An agent shows it is alive with `set_agent_state(state: "work")`:

- **when it wakes up**, as its very first call of the run;
- **every 5 minutes** while it works (repeating `work` keeps the run and its counter going).

The dashboard waits twice that, **10 minutes of silence**, before it warns the person with an amber triangle and the time: over a sleeping agent 10 minutes past its `next_run_at` ("did not wake up"), over a working agent 10 minutes after its last signal ("no word from it"). The triangle goes away by itself with the agent's next signal. An agent waiting for an answer (`ask`) is not timed.

## What an agent should do on every run

1. First thing, before any other work: `set_agent_state(state: "work")` in the zone it works on, and again every 5 minutes while it works (see Heartbeat above).
2. Do its job; after meaningful progress call `report_counts` (and `add_result` when a result appears).
3. If it needs the person — approval, a missing file, a decision — `set_agent_state(state: "ask", question)` and poll `get_answer(question_id)`; the person answers on the dashboard. While the agent is in `ask` it stands waiting and takes the answer at once. If it goes to sleep before the answer comes, the question stays in a bubble over the sleeping agent and the dashboard tells the person the answer will be picked up only on the agent's next run; the agent calls `get_answer` then. With the answer in hand it always replies in one short line with `reply`; if it needs more from the person, it asks a new question (a new `!`). If the person answers in the agent's chat instead, the agent calls `close_question` so the `!` goes away.
4. At the end: `set_agent_state(state: "sleep", next_run_at)` until its next scheduled run, or `clear_agent` if it has no schedule.
