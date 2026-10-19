# Goalcraft wake script

Agents in AI apps don't run between their scheduled runs, and nothing outside can wake a web chat. When an agent runs on your own computer, in the Claude app (Claude Code) or in Codex, this script can wake it within seconds:

- when you write to it from its card on the dashboard;
- when you answer its question while it sleeps;
- when it goes silent: it missed its run, or stopped signalling while at work (the amber triangle on the dashboard).

Every 10 seconds the script asks Goalcraft whom to wake and resumes that agent's own conversation with a short note to check Goalcraft: a Claude app session through `claude -p --resume`, a Codex thread through `codex exec resume`. The agent reads your message or answer through MCP, does what it asks, replies on the dashboard and goes back to sleep. A woken run shows in the agent's chat in the app like any other turn.

It is optional. Without it, agents read messages and answers on their next run.

## Install (macOS)

1. Sign in to the agents' command-line tools once: `claude` (Claude Code) and/or `codex`. The script uses them to resume the agents' chats.
2. On [goalcraft.ai/connect](https://goalcraft.ai/connect/#wake), under *Instant replies*, click **Create a key** and run the command it shows in Terminal. It downloads `goalcraft-wake.py` to `~/.goalcraft/`, saves the key and keeps the script running, also after a restart.

The key is shown once; creating a new one replaces the old, and the old script stops with a note in its log.

## Use

| Command | What it does |
|---|---|
| `python3 ~/.goalcraft/goalcraft-wake.py once` | One check, waits for the agents it woke, then exits |
| `python3 ~/.goalcraft/goalcraft-wake.py uninstall` | Stops it and removes it from the login items |
| `tail -f ~/.goalcraft/wake.log` | What it woke and what each agent answered |

On Linux it saves the key and asks you to keep `goalcraft-wake.py run` running yourself (cron, systemd).

## What it can do

- The key only lets the script ask Goalcraft which of your agents to wake (agent, funnel, chat link). It can't read your messages or change anything.
- The note an agent gets is fixed text ("The person wrote to you on the Goalcraft dashboard. Check Goalcraft now…"); your message itself reaches the agent only through MCP.
- A woken Claude agent may use its Goalcraft tools; beyond that it keeps the permission mode its session already has in the app.
- Each agent is woken once per message, per answer, and per silence (until it signals again). An agent that is working now is left alone: it finds messages on its own heartbeat.
- A woken run that takes more than 30 minutes is stopped.

Standard library only (Python 3, which macOS ships with the command-line tools). The endpoint it asks is `supabase/functions/wake`.
