# Goalcraft wake script

Agents in AI apps don't run between their scheduled runs, and nothing outside can wake a web chat. When an agent runs on your own computer, in the Claude app (Claude Code) or in Codex, this script can wake it within seconds:

- when you write to it from its card on the dashboard, or its funnel's supervisor writes to it;
- a supervisor, when a worker replies to its message (your own messages to workers don't wake the supervisor);
- when you answer its question while it sleeps;
- when it goes silent: it missed its run, or stopped signalling while at work (the amber triangle on the dashboard).

Every 10 seconds the script asks Goalcraft whom to wake and resumes that agent's own conversation with a short note to check Goalcraft: a Claude app session through `claude -p --resume`, a Codex thread through `codex exec resume`. The agent reads your message or answer through MCP, does what it asks, replies on the dashboard and goes back to sleep. A woken run shows in the agent's chat in the app like any other turn.

It is optional. Without it, agents read messages and answers on their next run.

## Token use

The agents themselves don't know what they spend, but their apps log it on your computer. Every 5 minutes the script reads those logs for the agents it knows and sends Goalcraft only the numbers, nothing from the conversations; each agent's card then shows its last week, as the plans' limits are weekly ("Last 7 days: ≈$153 at API prices", with its share of the weekly limit on hover) and each run in its list of runs shows its tokens.

| App | Read from | Shows |
|---|---|---|
| Claude app, Claude Code | `~/.claude/projects/*/<session>.jsonl` (every session of a scheduled task) | tokens, cost at API prices, ≈ % of the plan's weekly limit (see below) |
| Codex | `~/.codex/sessions/…/rollout-*.jsonl` | tokens, % of the plan's limit |
| Google Antigravity (Gemini) | `~/.gemini/antigravity/conversations/*.db`: the conversations that mention the agent's name and its funnel (it calls Goalcraft from there) | tokens, cost at API prices, ≈ % of its Gemini quota (see below) |

Web chats (claude.ai, chatgpt.com, Grok) keep this on their servers, so their agents show none. The cost is what the same tokens would cost on the API; on a subscription they count against its limits instead. `python3 ~/.goalcraft/goalcraft-wake.py usage` reads and sends it at once, and prints it.

Claude doesn't log its plan's limit as Codex does, so once an hour the script asks Anthropic how much of it is used (the weekly and 5-hour percents claude.ai shows under Settings → Usage), signing in as Claude Code does on this Mac (its keychain entry; the sign-in is read here and sent only to Anthropic). With each reading it sends what every Claude Code session here cost since the one before, your own chats included, since they all count against the same limit. From a week of readings the dashboard works out what $1 at API prices takes of the weekly limit, and shows each Claude run's share as ≈ its cost times that. It starts once about $20 has been spent and the weekly percent has risen by at least 2 (it comes in whole percents); chats in the Claude app's Chat tab and on other computers count against the limit too but aren't seen here, so the share is a little high. Google Antigravity keeps its quota on its own server on this Mac (what its app shows per model): while Antigravity runs, the script asks it hourly how much of each quota is used. Antigravity has one per group of models, as its settings show: Gemini 4 Argon, the other Gemini models, Claude and GPT. The script sends each weekly one the same way, with what that group's models cost here since the reading before, and the dashboard counts each run against its own model's quota. A quota showing its 5-hour window at that moment is skipped. Antigravity gives exact percents, so its rate starts sooner (about $2 spent and a rise of 0.3%). The script finds the server and the token its app uses with it from the process's command line; it never leaves this computer. `python3 ~/.goalcraft/goalcraft-wake.py limit` reads and sends both at once.

## Install (macOS)

Your agent sets it up; you only agree. The supervisor's prompt on [goalcraft.ai/connect](https://goalcraft.ai/connect/) has it offer this when it runs on your computer (Claude Code, Codex), and any agent there can do it when you ask ("set up the Goalcraft wake script"):

1. The agent calls the MCP tool `create_wake_key`. It returns a key and the one command that installs the script with it.
2. The agent runs that command: it downloads `goalcraft-wake.py` to `~/.goalcraft/`, saves the key and keeps the script running, also after a restart (a login item).

The agents' command-line tools must be signed in once: `claude` (Claude Code) and/or `codex`; the script uses them to resume the agents' chats. Codex needs no separate install: the script finds the one inside the ChatGPT app.

A new key replaces the old, and the script installed with the old one stops with a note in its log.

## Updates

The script never updates itself: what runs on your computer changes only when you (or your agent, with your OK) put a new version there. Its version is the day it came out (`python3 ~/.goalcraft/goalcraft-wake.py version`, e.g. `2026-10-24`), and it tells Goalcraft that version with every request. Your agents see it in `list_funnels` as `wake_script`: the version you run, the latest on goalcraft.ai, whether the script is running, and the command that updates it — the same download, then a restart; your key stays:

```bash
curl -fsSL https://goalcraft.ai/wake/goalcraft-wake.py -o ~/.goalcraft/goalcraft-wake.py && launchctl kickstart -k gui/$(id -u)/ai.goalcraft.wake
```

A funnel's supervisor tells you once when a newer version is out or the script has stopped, and on your computer updates it if you agree. Versions from before 24 October 2026 show as `1`.

## Use

| Command | What it does |
|---|---|
| `python3 ~/.goalcraft/goalcraft-wake.py once` | One check, waits for the agents it woke, then exits |
| `python3 ~/.goalcraft/goalcraft-wake.py usage` | Reads the agents' token use now, sends it and prints it |
| `python3 ~/.goalcraft/goalcraft-wake.py uninstall` | Stops it and removes it from the login items |
| `tail -f ~/.goalcraft/wake.log` | What it woke and what each agent answered |

On Linux it saves the key and asks you to keep `goalcraft-wake.py run` running yourself (cron, systemd).

## Limits

- A Codex thread the ChatGPT app keeps open (a Codex automation, a chat open in the app) can't be resumed from outside: Codex answers that the thread "already has an active writer". The script logs it and leaves the agent to its next run. Claude app sessions wake fine, open or not.

## What it can do

- The key only lets the script ask Goalcraft which of your agents to wake (agent, funnel, chat link) and send their token counts. It can't read your messages or change anything else.
- The note an agent gets is fixed text ("The person wrote to you on the Goalcraft dashboard. Check Goalcraft now…"); your message itself reaches the agent only through MCP.
- A woken Claude agent may use its Goalcraft tools; beyond that it keeps the permission mode its session already has in the app.
- Each agent is woken once per message, per answer, and per silence (until it signals again). An agent that is working now is left alone: it finds messages on its own heartbeat.
- A woken run that takes more than 30 minutes is stopped.

Standard library only (Python 3, which macOS ships with the command-line tools). The endpoint it asks is `supabase/functions/wake`.
