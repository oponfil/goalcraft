# Goalcraft wake script

Agents in AI apps don't run between their scheduled runs, and nothing outside can wake a web chat. When an agent runs on your own computer, in the Claude app (Claude Code) or in Codex, this script can wake it within seconds:

- when you write to it from its card on the dashboard, or its funnel's supervisor writes to it;
- a supervisor, when a worker replies to its message (your own messages to workers don't wake the supervisor);
- when you answer its question while it sleeps;
- when it goes silent: it missed its run, or stopped signalling while at work (the amber triangle on the dashboard).

Every 10 seconds the script asks Goalcraft whom to wake and resumes that agent's own conversation with a short note to check Goalcraft: a Claude app session through `claude -p --resume`, a Codex thread through `codex exec resume`. The agent reads your message or answer through MCP, does what it asks, replies on the dashboard and goes back to sleep. A woken run shows in the agent's chat in the app like any other turn.

It is optional. Without it, agents read messages and answers on their next run.

## Install (macOS)

Your agent sets it up; you only agree. The supervisor's prompt on [goalcraft.ai/connect](https://goalcraft.ai/connect/) has it offer this when it runs on your computer (Claude Code, Codex), and any agent there can do it when you ask ("set up the Goalcraft wake script"):

1. The agent calls the MCP tool `create_wake_key`. It returns a key and the one command that installs the script with it.
2. The agent runs that command: it downloads `goalcraft-wake.py` to `~/.goalcraft/`, saves the key and keeps the script running, also after a restart (a login item).

The agents' command-line tools must be signed in once: `claude` (Claude Code) and/or `codex`; the script uses them to resume the agents' chats. Codex needs no separate install: the script finds the one inside the ChatGPT app.

A new key replaces the old, and the script installed with the old one stops with a note in its log.

## Use

| Command | What it does |
|---|---|
| `python3 ~/.goalcraft/goalcraft-wake.py once` | One check, waits for the agents it woke, then exits |
| `python3 ~/.goalcraft/goalcraft-wake.py uninstall` | Stops it and removes it from the login items |
| `tail -f ~/.goalcraft/wake.log` | What it woke and what each agent answered |

On Linux it saves the key and asks you to keep `goalcraft-wake.py run` running yourself (cron, systemd).

## Limits

- A Codex thread the ChatGPT app keeps open (a Codex automation, a chat open in the app) can't be resumed from outside: Codex answers that the thread "already has an active writer". The script logs it and leaves the agent to its next run. Claude app sessions wake fine, open or not.

## What it can do

- The key only lets the script ask Goalcraft which of your agents to wake (agent, funnel, chat link). It can't read your messages or change anything.
- The note an agent gets is fixed text ("The person wrote to you on the Goalcraft dashboard. Check Goalcraft now…"); your message itself reaches the agent only through MCP.
- A woken Claude agent may use its Goalcraft tools; beyond that it keeps the permission mode its session already has in the app.
- Each agent is woken once per message, per answer, and per silence (until it signals again). An agent that is working now is left alone: it finds messages on its own heartbeat.
- A woken run that takes more than 30 minutes is stopped.

Standard library only (Python 3, which macOS ships with the command-line tools). The endpoint it asks is `supabase/functions/wake`.
