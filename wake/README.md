# Goalcraft wake script

Agents in AI apps don't run between their scheduled runs, and nothing outside can wake a web chat. When an agent runs on your own computer (a Mac or a Windows PC), in the Claude app (Claude Code), in Codex or in Google Antigravity (Gemini), this script can wake it within seconds:

- when you write to it from its card on the dashboard, or another agent of its funnel writes to it;
- when another agent replies to its message (your own messages to agents wake only the one you wrote to);
- when you answer its question while it sleeps;
- when it goes silent: it missed its run, or stopped signalling while at work (the amber triangle on the dashboard).

An agent on pause (sitting on a chair under a pause sign on the dashboard) is never woken: it won't run until it is resumed.

Every 10 seconds the script asks Goalcraft whom to wake and, if that agent's conversation is on this computer, resumes it with a short note to check Goalcraft: a Claude app session through `claude -p --resume`, a Codex thread through `codex exec resume`, a Gemini agent's conversation in Google Antigravity as a message there, through Antigravity's own server on this computer (while Antigravity runs; the script finds the conversation by the agent's name and funnel and sends it with the model the agent works with). The agent reads your message or answer through MCP, does what it asks, replies on the dashboard and goes back to sleep. A woken run shows in the agent's chat in the app like any other turn.

It is optional. Without it, agents read messages and answers on their next run, and their cards show no tokens or costs.

### Problems

The script tells Goalcraft with every check what is wrong on its computer, and the spending card shows it by the computer: its status turns amber for a warning (or an old version) and red for an error (or when the script has gone silent); hovering the status shows each problem and what to do. Your agents see them too, in `list_funnels` (`wake_script.computers[].problems`).

| Problem | Level | What to do |
|---|---|---|
| Claude Code is signed out (`claude_signed_out`) | error | `claude auth login` in a terminal on that computer (see [Claude Code's own sign-in](#claude-codes-own-sign-in)) |
| Claude Code or Codex isn't installed (`claude_missing`, `codex_missing`) while an agent there needs it | error | install it and sign in |
| Google Antigravity isn't running (`antigravity_off`), so a Gemini agent can't be woken | warning | open Antigravity |
| macOS refused the keychain entry (`keychain_denied`) | warning | `python3 ~/.goalcraft/goalcraft-wake.py limit` asks again |
| An agent couldn't be woken (`cant_wake`, an hour) or its woken run failed (`wake_failed`, a day) | warning | the line says why; it clears once that agent is woken fine or is taken off the dashboard |

### Several computers

If your agents work on more than one computer (a Mac and a PC, say), set the script up on each: each computer gets its own key and wakes only the agents whose conversation is on it, and reads only their tokens. Setting it up again on the same computer replaces that computer's key; the other computers keep theirs. Your agents see every computer's script in `list_funnels` (`wake_script.computers`).

## Token use

The agents themselves don't know what they spend, but their apps log it on your computer. Every 5 minutes the script reads those logs for the agents it knows and sends Goalcraft only the numbers, nothing from the conversations; each agent's card then shows its last week, as the plans' limits are weekly ("Last 7 days: ≈$153 at API prices", with its share of the weekly limit on hover) and each run in its list of runs shows its tokens.

| App | Read from | Shows |
|---|---|---|
| Claude app, Claude Code | `~/.claude/projects/*/<session>.jsonl` (every session of a scheduled task) | tokens, cost at API prices, ≈ % of the plan's weekly limit (see below) |
| Codex | `~/.codex/sessions/…/rollout-*.jsonl` | tokens, % of the plan's limit |
| Google Antigravity (Gemini) | `~/.gemini/antigravity/conversations/*.db`: the conversations that mention the agent's name and its funnel (it calls Goalcraft from there) | tokens, cost at API prices, ≈ % of its Gemini quota (see below) |
| Kimi app (Work, Kimi) | `~/Library/Application Support/kimi-desktop/…/kimi-code/home/sessions/*/conv-*/agents/*/wire.jsonl`: the conversations whose own Goalcraft calls name the agent and its funnel | tokens, cost at API prices, ≈ % of the plan's monthly limit (see below) |
| Grok Bot (Grok) | the Grok Bot servers, signed in as the Grok Bot app is on this computer (Mac or Windows): each bot's share of the plan's weekly limit per day, as the app shows it, and the plan's requests with their tokens, as its usage page lists them; the agent is its bot by the id in its link (`grokbot://app/v1/agent?id=…`) | % of the plan's weekly limit per run, to within 5 minutes; tokens by kind and ≈ cost at xAI's grok-4.7 prices, the run's share of its day's requests (they don't say which bot made them) |

Web chats (claude.ai, chatgpt.com, grok.com) keep this on their servers, so their agents show none. The cost is what the same tokens would cost on the API; on a subscription they count against its limits instead. `python3 ~/.goalcraft/goalcraft-wake.py usage` reads and sends it at once, and prints it.

Claude doesn't log its plan's limit as Codex does, so every 10 minutes the script asks Anthropic how much of it is used (the weekly and 5-hour percents claude.ai shows under Settings → Usage), signing in as Claude Code does on this Mac (its keychain entry; the sign-in is read here and sent only to Anthropic). With each reading it sends what every Claude Code session here cost since the one before, your own chats included, since they all count against the same limit. From a week of readings the dashboard works out what $1 at API prices takes of the weekly limit, and shows each Claude run's share as ≈ its cost times that. It starts once about $20 has been spent and the weekly percent has risen by at least 2 (it comes in whole percents); chats in the Claude app's Chat tab and on other computers count against the limit too but aren't seen here, so the share is a little high. Google Antigravity keeps its quota on its own server on this Mac (what its app shows per model): while Antigravity runs, the script asks it every 10 minutes how much of each quota is used (asking it to refresh, as its Models settings do: otherwise an app that has run for hours answers with an old figure). Antigravity has one per group of models, as its settings (Models) show: the Gemini models (Neon, Carbon, Hydrogen and the orchestrators; Gemini 4 Argon's own quota went on 23.11.2026), Claude and GPT, each with a weekly and a 5-hour limit. A role's Launch offers only the models Antigravity doesn't say are leaving soon (nor an orchestrator on one of them). The script reads them as that screen does and sends each group's weekly limit the same way (its 5-hour one along), with what that group's models cost here since the reading before, and the dashboard counts each run against its own model's quota. Antigravity gives exact percents, so with each reading the script also sends what that group's models cost here since its window began (a week before it resets), and the dashboard takes the rate as the used percent over that cost, right from the first reading. The script finds the server and the token its app uses with it from the process's command line; it never leaves this computer. Grok Bot's bots run in the cloud, so what they use is on its servers: the script asks them, signing in as the Grok Bot app does on this Mac (its sign-in is encrypted with a key in the keychain, "Grok Bot Safe Storage": macOS asks once whether to allow it; it is read here and sent only to the Grok Bot servers). Since 7 November 2026 they give no tokens or cost per bot, only each bot's share of the plan's weekly limit, a total for each day (UTC) of the current week, brought up to date every two minutes or so while the bot works. So every 5 minutes the script compares each bot's day with its reading before: what it grew by is a row from that reading to this one, and the dashboard gives it to the run it falls in. What a day had before this computer first read it is a row of its own, from the day's start. Every computer reads the same account and splits it at its own readings, so each one's rows replace the others' for the days it sends: it's counted once. The plan's usage page (on cursor.com, which takes the same sign-in) lists every request with its tokens by kind, but not which bot made it: so a run's tokens are its share of all bots' percent that day, of that day's requests, and its cost those tokens at xAI's prices for grok-4.7 ($2 per million new or written to the cache, $0.50 read from it, $6 out). The plan's limit goes by just these prices: on the Super plan every day came to $4.00 per 1% of its weekly limit. The script never wakes these bots: they run on their own schedules. Kimi's plan has a monthly quota for the app's Work: every 10 minutes the script asks Kimi how much of it is used, with the sign-in the Kimi app keeps on this Mac (read here and sent only to Kimi), and sends it with what every Work conversation here cost since that month began; the dashboard takes the rate as the used percent over that cost, as for Antigravity. `python3 ~/.goalcraft/goalcraft-wake.py limit` reads and sends all of them at once.

## Install (macOS, Windows)

Your agent sets it up; you only agree. The supervisor's prompt on [goalcraft.ai/connect](https://goalcraft.ai/connect/) has it offer this when it runs on your computer (Claude Code, Codex), and any agent there can do it when you ask ("set up the Goalcraft wake script"):

1. The agent calls the MCP tool `create_wake_key`. It returns a key and the one command that installs the script with it: `install` for macOS, `install_windows` for Windows (PowerShell).
2. The agent runs that command: it downloads `goalcraft-wake.py` to `~/.goalcraft/` (on Windows `%USERPROFILE%\.goalcraft\`), saves the key and keeps the script running, also after a restart: a login item on macOS; on Windows a Task Scheduler task that starts it with no window at sign-in and every 10 minutes (a second copy sees the first and leaves), with a script in the Startup folder in case the task is gone. Not a process of the agent's app: an app from the Microsoft Store, as the Claude app is on Windows, takes the processes it started with it when it updates or restarts.

The agents' command-line tools must be signed in once: `claude` (Claude Code) and/or `codex`; the script uses them to resume the agents' chats. Codex needs no separate install: the script finds the one inside the ChatGPT app (on Windows, the app from the Microsoft Store, through the packages Windows registers for you, as its folder changes with every update). Windows needs Python 3 (from python.org, or the Microsoft Store).

### Claude Code's own sign-in

To wake an agent in the Claude app, the script runs Claude Code from the command line (`claude -p --resume`), and to read the Claude plan's limit it uses Claude Code's sign-in. That sign-in is Claude Code's own, apart from the Claude app's: the app neither uses nor renews it. So on each computer, once:

```bash
claude auth login
```

The script looks for `claude` on the PATH and in `~/.local/bin` (where Claude Code installs itself), on Windows also among npm's tools; failing that, it takes the newest copy the Claude app keeps for itself (`claude-code/<version>/…` in the app's folder: `%APPDATA%\Claude` on Windows, `~/Library/Application Support/Claude` on a Mac), which changes with every update of the app. Either way it runs with Claude Code's sign-in.

The sign-in's access token lasts hours and Claude Code renews it only when it runs, which here is seldom (only to wake an agent). So when it has run out, the script asks Claude Code to renew it with `claude mcp list`, at most once an hour: it costs no tokens, and to list the account's claude.ai connectors Claude Code renews the sign-in first (`claude auth status` doesn't: it only reads it). If even the renewal has run out (Claude Code not run for weeks), nothing can renew it but a new `claude auth login`: the log says so (`Claude Code is signed out on this computer…`), agents there aren't woken, and the Claude limit isn't read until then.

A new key on a computer replaces that computer's old key, and the script installed with the old one stops with a note in its log.

### macOS asks for your password

(Only on a Mac. On Windows the script reads Claude Code's sign-in from its own file, `~/.claude/.credentials.json`, and asks nothing; Grok Bot's sign-in is opened with Windows' own decryption for your user, with no prompt.)

To show the plans' limits, the script needs two sign-ins that macOS keeps in your keychain. The first time it reads each, macOS asks for your Mac's password, naming the entry:

| Entry | What for | Sent only to |
|---|---|---|
| "Claude Code-credentials" | Claude Code's sign-in: how much of your Claude plan's weekly limit is used | Anthropic |
| "Grok Bot Safe Storage" (only with the Grok Bot app) | the key Grok Bot encrypts its sign-in with: what your bots used, and how much of the Grok Bot plan's limit | the Grok Bot servers (and its usage page on cursor.com) |

Click **Always Allow** to be asked once. It is up to you: click **Deny** and everything else still works (waking the agents; the tokens and costs of Claude Code, Codex and Antigravity runs); only that plan's limit, and for Grok Bot its bots' use, won't show on the dashboard. The script remembers the refusal and doesn't ask again with every reading; `python3 ~/.goalcraft/goalcraft-wake.py limit` asks again. The sign-ins are read on this Mac and never sent to Goalcraft.

## Updates

The script updates itself (from version 2026-11-18). With every check Goalcraft tells it which version is out and that file's SHA-256, once goalcraft.ai serves that file (Goalcraft checks the site first, so a release is never announced before its file is there). When a newer one is out, the script downloads it from goalcraft.ai and puts it in place only if its hash is the one Goalcraft gave, so a changed file on the site alone can't change what runs on your computer (a file that doesn't match, say one the site doesn't serve yet, is tried again 5 minutes later); then it starts again (after any agent it is waking has finished). Its log says so: `updated 2026-11-18 → …`. To turn this off, add `"auto_update": false` to `~/.goalcraft/wake.json`.

Its version is the day it came out (`python3 ~/.goalcraft/goalcraft-wake.py version`). It tells Goalcraft that version and its computer's name with every request, and your agents see them in `list_funnels` as `wake_script`. A script from before 18 November 2026 doesn't update itself yet: it shows there with `update_needed` and the command that brings it up to date once (your key stays):

```bash
curl -fsSL https://goalcraft.ai/wake/goalcraft-wake.py -o ~/.goalcraft/goalcraft-wake.py && launchctl kickstart -k gui/$(id -u)/ai.goalcraft.wake
```

A funnel's supervisor tells you once when a script needs that or has stopped, and on that computer runs it if you agree.

## Use

| Command | What it does |
|---|---|
| `python3 ~/.goalcraft/goalcraft-wake.py once` | One check, waits for the agents it woke, then exits |
| `python3 ~/.goalcraft/goalcraft-wake.py usage` | Reads the agents' token use now, sends it and prints it |
| `python3 ~/.goalcraft/goalcraft-wake.py uninstall` | Stops it and removes it from the login items |
| `tail -f ~/.goalcraft/wake.log` | What it woke and what each agent answered |

To stop it on one computer for a while, without uninstalling: on the board, Spending → Wake scripts → ■ next to that computer. From its next check (within 10 seconds) it wakes no agents, starts no launches and sends no readings; it only asks Goalcraft once a minute whether it may go on, and the wake function hands it nothing meanwhile (`wake_keys.stopped_at`). The board shows it grey, "stopped", not as a problem. ▶ starts it again within a minute. It stays stopped across restarts until started.

On Windows run the same commands with `py` (or `python`) instead of `python3`; the log is `%USERPROFILE%\.goalcraft\wake.log`. On Linux it saves the key and asks you to keep `goalcraft-wake.py run` running yourself (cron, systemd).

## Launches: Goalcraft starts the roles

Goalcraft can start a funnel's roles itself, one run at a time, each on the executor it chooses (see the main README, [Launch](../README.md#launch-goalcraft-starts-the-roles)). With every check it may hand this computer a start it can do; the script takes it (claim: no other computer starts it too) and starts the app with a short note — who the role is and where its instructions are — in a new conversation, or in the conversation the start goes on in (an answer: its question's; a message: the role's own; see the main README) when that conversation is on this computer:

| App | How |
|---|---|
| Claude | `claude -p --chrome --session-id <new id> --name <the role's name> --model … --effort … --permission-mode bypassPermissions -- <note>` (full access; without it only the Goalcraft tools); to go on in a conversation, `--resume <its session>` in its folder instead of a new id and name. The name is what the Claude app calls the conversation (without one it shows its folder). The app opens such a conversation in Accept edits at most: it switches on Bypass or Auto only when the person picks it there, in that conversation |
| Codex | `codex exec --skip-git-repo-check -m … -c model_reasoning_effort="…" --dangerously-bypass-approvals-and-sandbox <note>` (full access); to go on in a thread, `codex exec resume … <thread> <note>`. A new thread is named after its run as the role is, by the Codex app-server's `thread/name/set` (what `/rename` does) |
| Google Antigravity | its own `agentapi new-conversation --model=<the model's id> --title=<the role's name> …`, with the app's server address and token (Antigravity must be running): always a new conversation. agentapi takes no permissions: the conversation runs with Antigravity's own default permission mode (its settings), and asks there before what that mode doesn't allow, a tool not yet allowed for good included. For full access set that default to Turbo in Antigravity |
| Grok Bot | a message to the role's bot, as the person writing to it in the app: it goes on in its one conversation |

Every 10 minutes the script also tells Goalcraft what this computer can run: each app there and its models (Claude's, Codex's from its model cache, Antigravity's as its server lists them), which the card's Launch settings offer. The starts it ran are kept in `~/.goalcraft/launches.json` (whose, on which app, its conversation), so their token use is counted for their role whatever chat its agent names.

From Antigravity 2.34 its server takes its token on stdin, not on the command line: the script reads its ports and token from `~/.gemini/antigravity/daemon/hub_*.json`, the newest whose port answers.

## Limits

- With the script on several computers, Antigravity's and Kimi's limits are worked out from what their models cost on the computer that read the limit last, so if both computers use them the share each run shows is a little high.
- A Codex thread the ChatGPT app keeps open (a Codex automation, a chat open in the app) can't be resumed from outside: Codex answers that the thread "already has an active writer". The script tries again every 10 minutes, until the run starts, the agent has run in the app by itself (its thread changed since), it is taken off the dashboard, or a day has passed; then the warning goes. Claude app sessions wake fine, open or not.

## What it can do

- The key only lets the script ask Goalcraft which of your agents to wake (agent, funnel, chat link), mark the ones it wakes, and send their token counts. It can't read your messages or change anything else.
- What runs on your computer changes only to a version whose SHA-256 Goalcraft's own server gave; you can turn updates off.
- The note an agent gets is fixed text ("The person wrote to you on the Goalcraft dashboard. Check Goalcraft now…"); your message itself reaches the agent only through MCP.
- A woken Claude agent may use its Goalcraft tools, and keeps the permission mode its session has in the app (auto, bypassPermissions, acceptEdits, plan… whatever Claude Code takes): what it may do there without asking, it may do when woken. A session in the default mode gets only the Goalcraft tools, since nobody is there to approve the rest.
- Each agent is woken once per message, per answer, and per silence (until it signals again). An agent that is working now is left alone: it finds messages on its own heartbeat.
- A woken agent works as long as it needs: the script doesn't stop it (a run Goalcraft started, at most 4 hours).
- A run Goalcraft starts has, with full access, everything allowed without asking (see Launches): nobody is there to approve during a scheduled run. Without full access the app's own defaults apply.

Standard library only (Python 3, which macOS ships with the command-line tools). The endpoint it asks is `supabase/functions/wake`.
