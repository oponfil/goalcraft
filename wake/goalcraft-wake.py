#!/usr/bin/env python3
"""Goalcraft wake script: wakes your agents on this computer as soon as something waits for them.

Every 10 seconds it asks Goalcraft which of your agents to wake: one you wrote to from the dashboard,
one whose question you answered while it sleeps, or one that went silent (it missed its run, or
stopped signalling at work). It wakes each in its own conversation with a short note to check
Goalcraft: a Claude app session (Claude Code) through `claude -p --resume`, a Codex thread through
`codex exec resume`, a Gemini agent's conversation in Google Antigravity through Antigravity's own
server on this Mac (while Antigravity runs). Web chats (claude.ai, chatgpt.com) can't be woken from outside and are skipped;
so are bots in the Grok Bot app, which run in the cloud on their own schedules.

    python3 goalcraft-wake.py install <key>   save the key and keep the script running (macOS)
    python3 goalcraft-wake.py uninstall       stop it and remove it from the login items
    python3 goalcraft-wake.py once            one check, then exit (to try it)
    python3 goalcraft-wake.py usage           read and send the agents' token use now, and print it
    python3 goalcraft-wake.py limit           read and send the plans' limits now (Claude, Antigravity, Grok Bot), and print them
    python3 goalcraft-wake.py run             the loop itself (what install starts)
    python3 goalcraft-wake.py version         print this script's version

The script never updates itself. It tells Goalcraft its version with every request, so an agent sees
in list_funnels (wake_script) when a newer one is out, and can update it with your OK: the same
download, then a restart (your key stays).

The key comes from the Goalcraft MCP tool create_wake_key (your agent calls it and runs install for you).
It only lets the script ask whom to wake, and send what the agents' runs used in tokens (read from
their session files here: numbers only, nothing from the conversations). Once an hour it also asks
Anthropic how much of your Claude plan's limit is used, with Claude Code's own sign-in from this Mac's
keychain (read here, sent only to Anthropic), and Google Antigravity (while it runs) how much of its Gemini
quota is, from its own server on this Mac, so the dashboard can show each run's share of them. For bots
in the Grok Bot app it asks the Grok Bot servers (with Grok Bot's own sign-in from this Mac, read here
and sent only to them) how many tokens each bot used per day and how much of the plan's weekly limit
is used.
Standard library only; the log is ~/.goalcraft/wake.log.
"""
import glob
import json
import os
import pathlib
import shutil
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request

VERSION = '2026-10-26'  # the day this version came out; Goalcraft compares it with the one on goalcraft.ai
ENDPOINT = 'https://wbnmtecgahwzwvcqenlk.supabase.co/functions/v1/wake'
AGENT = f'goalcraft-wake/{VERSION}'  # every request says which version sends it
EVERY = 10  # seconds between checks
HOME = pathlib.Path.home()
DIR = HOME / '.goalcraft'
CONFIG = DIR / 'wake.json'
LOG = DIR / 'wake.log'
LABEL = 'ai.goalcraft.wake'
PLIST = HOME / 'Library' / 'LaunchAgents' / f'{LABEL}.plist'
SESSIONS = HOME / 'Library' / 'Application Support' / 'Claude' / 'claude-code-sessions'
# Where the agents' command-line tools usually are: launchd starts the script with a bare PATH.
BINS = [HOME / '.local' / 'bin', pathlib.Path('/opt/homebrew/bin'), pathlib.Path('/usr/local/bin'), HOME / '.npm-global' / 'bin',
        # Codex as it comes inside the ChatGPT app on macOS.
        pathlib.Path('/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin')]
# The Goalcraft MCP server under the names it usually has: as a claude.ai connector, or added by hand.
GOALCRAFT_TOOLS = ['mcp__claude_ai_Goalcraft', 'mcp__goalcraft', 'mcp__goalagents']
RUN_LIMIT = 30 * 60  # a woken run that takes longer is stopped

WHY = {
    'message': 'Someone wrote to you in Goalcraft (the person from the dashboard, or your funnel\'s supervisor).',
    'reply': 'A worker agent replied to your message in Goalcraft.',
    'answer': 'The person answered your question on the Goalcraft dashboard.',
    'overdue': 'You missed your scheduled run: Goalcraft has not heard from you since.',
    'silent': 'Goalcraft has not heard from you for over 10 minutes while you were at work.',
}


def log(text):
    DIR.mkdir(exist_ok=True)
    if LOG.exists() and LOG.stat().st_size > 1_000_000:
        LOG.replace(DIR / 'wake.log.1')
    with LOG.open('a') as f:
        f.write(time.strftime('%Y-%m-%d %H:%M:%S ') + text + '\n')


def find(tool):
    path = shutil.which(tool)
    if path:
        return path
    for d in BINS:
        if (d / tool).exists():
            return str(d / tool)
    return None


def note(item):
    """The fixed note the agent gets: what happened and what to do. Nothing from the dashboard's text."""
    why = ' '.join(WHY[r] for r in item['reasons'] if r in WHY)
    return (f'{why} Check Goalcraft now for the funnel "{item.get("funnel") or item["funnel_id"]}" '
            f'(funnel_id {item["funnel_id"]}) as agent "{item["agent"]}": set_agent_state(work), then get_messages '
            f'and get_answer for your answered questions, reply to each in one short line with reply, and do what they ask. '
            f'When done, set your state as usual (sleep with next_run_at, or clear_agent).')


def app_sessions():
    """The Claude app's sessions on this computer (Claude Code in the app, scheduled tasks included)."""
    out = []
    for f in glob.glob(str(SESSIONS / '*' / '*' / 'local_*.json')):
        try:
            out.append(json.loads(pathlib.Path(f).read_text()))
        except Exception:
            pass
    return out


def app_session(session):
    """A Claude app session by the id in the agent's chat link: local_<app session id>. An agent may
    give its Claude Code session id there instead (local_<cliSessionId>), so that is looked up too."""
    files = glob.glob(str(SESSIONS / '*' / '*' / f'{session}.json'))
    if files:
        return json.loads(pathlib.Path(files[0]).read_text())
    cli = session.removeprefix('local_')
    return next((s for s in app_sessions() if s.get('cliSessionId') == cli), None)


def claude_command(item):
    """`claude -p --resume` for a Claude app session: its local_ id maps to the Claude Code session it runs."""
    claude = find('claude')
    if not claude:
        return None, 'claude command not found (install Claude Code and sign in with `claude`)'
    s = app_session(item['session'])
    if not s:
        return None, f'no Claude app session {item["session"]} on this computer'
    cmd = [claude, '-p', '--resume', s['cliSessionId'], '--allowedTools', *GOALCRAFT_TOOLS]
    if s.get('permissionMode') in ('acceptEdits', 'bypassPermissions', 'plan'):
        cmd += ['--permission-mode', s['permissionMode']]
    if s.get('model'):
        cmd += ['--model', s['model']]
    cwd = s.get('cwd') if s.get('cwd') and os.path.isdir(s['cwd']) else str(HOME)
    return (cmd + [note(item)], cwd), None


def codex_command(item):
    """`codex exec resume` for a Codex thread. Run from the home folder: a login item may not read
    ~/Documents, where the Codex app keeps its threads' folders."""
    codex = find('codex')
    if not codex:
        return None, 'codex command not found'
    return ([codex, 'exec', 'resume', '--skip-git-repo-check', item['session'], note(item)], str(HOME)), None


running = set()  # sessions being woken now: one run at a time per conversation


def wake(item):
    if item['app'] == 'antigravity':
        return antigravity_wake(item)
    key = item['session']
    if key in running:
        return
    made, err = (claude_command if item['app'] == 'claude' else codex_command)(item)
    who = f'{item["agent"]} in {item["funnel_id"]} ({", ".join(item["reasons"])})'
    if err:
        log(f'skip {who}: {err}')
        return
    cmd, cwd = made
    running.add(key)

    def go():
        started = time.time()
        try:
            out = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=RUN_LIMIT)
            last = (out.stdout.strip().splitlines() or [''])[-1][:200]
            log(f'woke {who} in {time.time() - started:.0f}s, exit {out.returncode}: {last}')
            if 'already has an active writer' in out.stderr:
                log('  the ChatGPT app keeps this Codex thread open, so it cannot be resumed from outside; it gets the news on its next run')
            elif out.returncode:
                log('  ' + out.stderr.strip()[-500:])
        except subprocess.TimeoutExpired:
            log(f'woke {who}: stopped after {RUN_LIMIT // 60} min')
        finally:
            running.discard(key)
    threading.Thread(target=go, daemon=True).start()
    log(f'waking {who}')


def antigravity_owner(f):
    """Whose Antigravity conversation this is: the agent and funnel its own Goalcraft calls name most
    often. Every agent's name is in every conversation of its funnel (list_funnels returns them all, a
    supervisor talks about its workers), but only its own calls carry it as their arguments, and the
    agent makes most of the calls in its conversation (a supervisor seldom calls for a worker)."""
    import collections
    import re
    with open(f, 'rb') as fh:
        raw = fh.read()
    calls = collections.Counter()
    for m in re.finditer(rb'"Arguments":\{([^{}]*)', raw):
        agent = re.search(rb'"agent":"([^"]+)"', m.group(1))
        funnel = re.search(rb'"funnel_id":"([^"]+)"', m.group(1))
        if agent and funnel:
            calls[(agent.group(1).decode('utf-8', 'replace'), funnel.group(1).decode('utf-8', 'replace'))] += 1
    return calls.most_common(1)[0][0] if calls else None


def antigravity_conversations(item, since=0):
    """The Antigravity conversations of a Gemini agent changed since a moment, the latest last."""
    found = [(os.path.getmtime(f), f) for f in glob.glob(str(ANTIGRAVITY / '*.db')) if os.path.getmtime(f) >= since]
    return [f for _, f in sorted(found) if antigravity_owner(f) == (item['agent'], item['funnel_id'])]


def antigravity_conversation(item):
    """The Antigravity conversation of a Gemini agent (its latest), with the model its last call used."""
    found = antigravity_conversations(item)
    if not found:
        return None, None
    f = found[-1]
    calls = antigravity_calls(f, facts=True)
    model = calls[-1][3].get('model_enum') if calls else None
    return pathlib.Path(f).stem, model


def antigravity_wake(item):
    """Wake a Gemini agent in Google Antigravity: the note goes into its conversation as the person's
    message, through Antigravity's own server on this Mac, with the model the agent works with (without
    one Antigravity only files the message and doesn't run the agent)."""
    import ssl
    who = f'{item["agent"]} in {item["funnel_id"]} ({", ".join(item["reasons"])})'
    cascade, model = antigravity_conversation(item)
    server = antigravity_server()
    if not cascade or not model or not server:
        log(f'skip {who}: ' + ('Antigravity is not running' if not server else 'its Antigravity conversation was not found'))
        return
    body = {'cascadeId': cascade, 'items': [{'text': note(item)}],
            'cascadeConfig': {'plannerConfig': {'requestedModel': {'model': model}}}}
    ctx = ssl.create_default_context()
    ctx.check_hostname, ctx.verify_mode = False, ssl.CERT_NONE  # its own certificate, on 127.0.0.1
    for port in server['ports']:
        req = urllib.request.Request(f'https://127.0.0.1:{port}/exa.language_server_pb.LanguageServerService/SendUserCascadeMessage',
                                     data=json.dumps(body).encode(), method='POST', headers={
                                         'Content-Type': 'application/json', 'Connect-Protocol-Version': '1', 'X-Codeium-Csrf-Token': server['token']})
        try:
            with urllib.request.urlopen(req, timeout=30, context=ctx):
                log(f'woke {who} in Antigravity')
                return
        except Exception as e:
            err = e
    log(f'skip {who}: Antigravity did not take the note: {err}')


# Token use. The agents don't know what they spend, but their apps log it on this computer: every
# model call in a Claude Code transcript (~/.claude/projects/*/<session>.jsonl), Codex's running
# totals and plan limit in its rollout files (~/.codex/sessions/…). Every few minutes the script sums
# them per run and sends Goalcraft the numbers only, nothing from the conversations.
USAGE_EVERY = 5 * 60
LIMIT_EVERY = 60 * 60  # the Claude plan's limit is read hourly
LIMIT_STATE = DIR / 'limit.json'  # when it was last read: the cost of every session since then goes with the next reading
USAGE_DAYS = 2      # runs ended this recently are (re)sent
RUN_GAP = 5 * 60    # a pause this long in one session starts a new run
PROJECTS = HOME / '.claude' / 'projects'
CODEX_SESSIONS = HOME / '.codex' / 'sessions'
ANTIGRAVITY = HOME / '.gemini' / 'antigravity' / 'conversations'  # Google Antigravity (Gemini): one database per conversation
# Anthropic's API prices in $ per million tokens (input, output, cache read); cache writes cost 1.25x
# input for 5 minutes and 2x for an hour. Longest matching prefix wins; other models get no cost.
PRICES = {
    'claude-fable-5-1': (10, 50, 0.25), 'claude-fable-5': (10, 50, 1.0), 'claude-mythos': (10, 50, 1.0),
    'claude-opus-5-5': (4, 20, 0.2), 'claude-opus-5': (5, 25, 0.5), 'claude-opus-4': (5, 25, 0.5),
    'claude-sonnet-5': (2, 10, 0.2), 'claude-sonnet-4': (3, 15, 0.3),
    'claude-haiku-5': (0.1, 0.5, 0.01), 'claude-haiku-4': (1, 5, 0.1),
}


# OpenAI's API prices for Codex's models, $ per million tokens (input, output, cached input, cache write).
OPENAI_PRICES = {'gpt-6.1-sol': (2, 10, 0.10, 2.5)}

# Google's API prices for Antigravity's models, $ per million tokens (input, output with thinking, cached input).
GEMINI_PRICES = {'gemini-4-argon': (2, 10, 0.10)}


def price(model, table=PRICES):
    hits = [k for k in table if model and model.startswith(k)]
    return table[max(hits, key=len)] if hits else None


def when(ts):
    try:
        return time.mktime(time.strptime(ts[:19], '%Y-%m-%dT%H:%M:%S')) - time.timezone
    except Exception:
        return None


def iso(t):
    return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(t))


def split_runs(points):
    """[(time, …)] sorted → runs: lists of points with no pause longer than RUN_GAP inside."""
    runs = []
    for p in points:
        if runs and p[0] - runs[-1][-1][0] <= RUN_GAP:
            runs[-1].append(p)
        else:
            runs.append([p])
    return runs


def claude_usage(item, sessions):
    """Runs of a Claude agent: its own session, or every session of its scheduled task (each run of a
    scheduled task is a new session)."""
    s = app_session(item['session'])
    if not s:
        return []
    task = s.get('scheduledTaskId')
    group = [x for x in sessions if task and x.get('scheduledTaskId') == task] or [s]
    since = time.time() - USAGE_DAYS * 86400
    out = []
    for x in group:
        cli = x.get('cliSessionId')
        for f in glob.glob(str(PROJECTS / '*' / f'{cli}.jsonl')) if cli else []:
            if os.path.getmtime(f) < since:
                continue
            seen, points = set(), []
            with open(f, errors='ignore') as fh:
                for line in fh:
                    if '"usage"' not in line:
                        continue
                    try:
                        d = json.loads(line)
                    except Exception:
                        continue
                    m = d.get('message')
                    if not isinstance(m, dict) or not isinstance(m.get('usage'), dict) or m.get('id') in seen:
                        continue
                    t = when(d.get('timestamp') or '')
                    if t is None:
                        continue
                    seen.add(m.get('id'))
                    points.append((t, m.get('model'), m['usage']))
            points.sort(key=lambda p: p[0])
            for run in split_runs(points):
                if run[-1][0] < since:
                    continue
                kinds = {'input_tokens': 0, 'cache_read_tokens': 0, 'cache_write_tokens': 0, 'output_tokens': 0}
                cost, models = 0.0, {}
                for _, model, u in run:
                    fresh, read, out_ = u.get('input_tokens', 0), u.get('cache_read_input_tokens', 0), u.get('output_tokens', 0)
                    write = u.get('cache_creation_input_tokens', 0)
                    hour = (u.get('cache_creation') or {}).get('ephemeral_1h_input_tokens', 0)
                    kinds['input_tokens'] += fresh
                    kinds['cache_read_tokens'] += read
                    kinds['cache_write_tokens'] += write
                    kinds['output_tokens'] += out_
                    models[model] = models.get(model, 0) + 1
                    c = message_cost(model, u)
                    cost = None if c is None or cost is None else cost + c
                out.append({'agent': item['agent'], 'funnel_id': item['funnel_id'], 'app': 'claude',
                            'run_key': f'{cli}:{int(run[0][0])}', 'model': max(models, key=models.get),
                            'started_at': iso(run[0][0]), 'ended_at': iso(run[-1][0]), **totals(kinds),
                            'cost_usd': round(cost, 4) if cost is not None else None})
    return out


def message_cost(model, u):
    """One Claude message at API prices: 0 for Claude Code's own notes, None for a model with no price."""
    if model == '<synthetic>':  # Claude Code's own notes, not a model call
        return 0.0
    pr = price(model)
    if pr is None:
        return None
    fresh, read, out_ = u.get('input_tokens', 0), u.get('cache_read_input_tokens', 0), u.get('output_tokens', 0)
    write = u.get('cache_creation_input_tokens', 0)
    hour = (u.get('cache_creation') or {}).get('ephemeral_1h_input_tokens', 0)
    return (fresh * pr[0] + out_ * pr[1] + read * pr[2] + hour * pr[0] * 2 + (write - hour) * pr[0] * 1.25) / 1e6


def local_claude_cost(since, until):
    """What every Claude Code session on this Mac cost at API prices between two moments, the person's
    own chats included: all of it counts against the same plan's limit."""
    total, seen = 0.0, set()
    for f in glob.glob(str(PROJECTS / '*' / '*.jsonl')):
        if os.path.getmtime(f) < since:
            continue
        with open(f, errors='ignore') as fh:
            for line in fh:
                if '"usage"' not in line:
                    continue
                try:
                    d = json.loads(line)
                except Exception:
                    continue
                m = d.get('message')
                if not isinstance(m, dict) or not isinstance(m.get('usage'), dict) or m.get('id') in seen:
                    continue
                t = when(d.get('timestamp') or '')
                if t is None or not since < t <= until:
                    continue
                seen.add(m.get('id'))
                total += message_cost(m.get('model'), m['usage']) or 0.0
    return total


ASK_AGAIN = False  # the limit command asks again for keychain entries refused before


def keychain(service):
    """A keychain entry's secret. The first time, macOS asks the person whether to allow it (their
    password; Always Allow, and it won't ask again). A refusal is remembered, so they aren't asked every
    hour: the limit command asks again."""
    denied = limit_state().get('keychain_denied', [])
    if service in denied and not ASK_AGAIN:
        return None
    try:
        r = subprocess.run(['security', 'find-generic-password', '-s', service, '-w'], capture_output=True, text=True, timeout=120)
    except Exception:
        return None  # nobody answered: ask again next time
    if r.returncode == 0:
        if service in denied:
            save_limit_state(keychain_denied=[d for d in denied if d != service])
        return r.stdout.strip()
    # The entry is there (asking about it without its secret doesn't ask the person): access was refused.
    if subprocess.run(['security', 'find-generic-password', '-s', service], capture_output=True).returncode == 0:
        save_limit_state(keychain_denied=sorted(set(denied) | {service}))
        log(f'keychain: access to "{service}" was refused, so it is not asked again; '
            f'`python3 {pathlib.Path(__file__).resolve()} limit` asks again')
    return None


def claude_token():
    """Claude Code's sign-in on this Mac (its keychain entry), while it is still valid."""
    try:
        o = json.loads(keychain('Claude Code-credentials') or '{}').get('claudeAiOauth') or {}
    except Exception:
        return None
    return o.get('accessToken') if o.get('expiresAt', 0) / 1000 > time.time() + 60 else None


def report_limit(key, show=False):
    """Read how much of the Claude plan's limit is used and send it to Goalcraft, with what every local
    session cost since the reading before."""
    token = claude_token()
    if not token:
        log('limit: no valid Claude Code sign-in in the keychain; skipped')
        return False
    req = urllib.request.Request('https://api.anthropic.com/api/oauth/usage', headers={
        'Authorization': f'Bearer {token}', 'anthropic-beta': 'oauth-2025-04-20', 'User-Agent': AGENT})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            u = json.load(r)
    except Exception as e:
        log(f'limit: could not read it: {e}')
        return False
    week, session = u.get('seven_day') or {}, u.get('five_hour') or {}
    if week.get('utilization') is None:
        log('limit: no weekly limit in the answer')
        return False
    now = time.time()
    before = limit_state().get('at')
    cost = round(local_claude_cost(before, now), 4) if before else None
    row = {'app': 'claude', 'at': iso(now), 'week_percent': week['utilization'], 'week_resets_at': week.get('resets_at'),
           'session_percent': session.get('utilization'), 'session_resets_at': session.get('resets_at'), 'cost_usd': cost}
    if show:
        print(f'Claude: week {week["utilization"]}% (resets {week.get("resets_at")}), 5 hours {session.get("utilization")}%'
              + (f', local sessions since the last reading ≈${cost:.2f}' if cost is not None else ''))
    body = json.dumps({'limits': [row]}).encode()
    req = urllib.request.Request(ENDPOINT, data=body, method='POST', headers={
        'Authorization': f'Bearer {key}', 'User-Agent': AGENT, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            json.load(r)
    except Exception as e:
        log(f'limit: could not send: {e}')
        return False
    save_limit_state(at=now)
    return True


def limit_state():
    try:
        return json.loads(LIMIT_STATE.read_text())
    except Exception:
        return {}


def save_limit_state(**changes):
    LIMIT_STATE.write_text(json.dumps({**limit_state(), **changes}))


def antigravity_server():
    """Antigravity's language server on this Mac, while the app runs: its local ports and the token the
    app itself uses with it (from the process's command line; it never leaves this computer)."""
    try:
        ps = subprocess.run(['ps', '-axo', 'pid=,command='], capture_output=True, text=True, timeout=10).stdout
    except Exception:
        return None
    for line in ps.splitlines():
        if 'language_server' not in line or 'antigravity' not in line or '--csrf_token' not in line:
            continue
        pid = line.split()[0]
        token = line.split('--csrf_token', 1)[1].strip(' =').split()[0]
        try:
            out = subprocess.run(['lsof', '-nP', '-iTCP', '-sTCP:LISTEN', '-a', '-p', pid], capture_output=True, text=True, timeout=10).stdout
        except Exception:
            continue
        ports = [l.split()[8].rsplit(':', 1)[1] for l in out.splitlines()[1:] if len(l.split()) > 8]
        return {'token': token, 'ports': ports}
    return None


def quota_of(name):
    """Which of Antigravity's quotas a model counts against, by its label ("Gemini 4 Argon (Medium)") or
    by the model a call logged ("gemini-4-argon-trial"): Gemini 4 Argon has its own, the other Gemini
    models share one, Claude and GPT share one."""
    n = name.lower().replace(' ', '-')
    return 'gemini-4-argon' if n.startswith('gemini-4-argon') else 'gemini' if n.startswith('gemini') else 'claude-gpt'


def antigravity_cost(since, until):
    """What every Antigravity conversation here cost at API prices between two moments, by quota."""
    total = {}
    for f in glob.glob(str(ANTIGRAVITY / '*.db')):
        if os.path.getmtime(f) < since:
            continue
        for t, model, u in antigravity_calls(f):
            if since < t <= until:
                q = quota_of(model)
                total[q] = total.get(q, 0.0) + (gemini_cost(model, u) or 0.0)
    return total


def report_antigravity_limit(key, show=False):
    """Read how much of each of Antigravity's quotas is used (as its app shows them, per group of models)
    and send the weekly ones to Goalcraft, each with what its models cost here since the reading before."""
    import ssl
    server = antigravity_server()
    if not server:
        return False  # the app isn't running: nothing to read, and nothing to log every hour
    ctx = ssl.create_default_context()
    ctx.check_hostname, ctx.verify_mode = False, ssl.CERT_NONE  # its own certificate, on 127.0.0.1
    status = None
    for port in server['ports']:
        req = urllib.request.Request(f'https://127.0.0.1:{port}/exa.language_server_pb.LanguageServerService/GetUserStatus',
                                     data=b'{}', method='POST', headers={'Content-Type': 'application/json', 'Connect-Protocol-Version': '1',
                                                                          'X-Codeium-Csrf-Token': server['token']})
        try:
            with urllib.request.urlopen(req, timeout=10, context=ctx) as r:
                status = json.load(r)
            break
        except Exception:
            continue
    if not status:
        log('limit: Antigravity is running but did not answer')
        return False
    # Each quota as its models show it: the window that binds now. Only a weekly one (resetting more
    # than a day ahead) is sent: the board spreads it over a week of runs.
    quotas = {}
    for c in ((status.get('userStatus') or {}).get('cascadeModelConfigData') or {}).get('clientModelConfigs', []):
        qi = c.get('quotaInfo') or {}
        if qi.get('remainingFraction') is not None and qi.get('resetTime'):
            quotas.setdefault(quota_of(str(c.get('label', ''))), qi)
    now = time.time()
    before = limit_state().get('antigravity_at')
    costs = antigravity_cost(before, now) if before else {}
    rows = []
    for q, qi in quotas.items():
        resets = when(qi['resetTime'])
        weekly = resets is not None and resets - now > 86400
        if show:
            print(f'Antigravity {q}: {round((1 - qi["remainingFraction"]) * 100, 2)}% used, resets {qi["resetTime"]}'
                  + ('' if weekly else ' (a short window: not sent)') + (f', since the last reading ≈${costs.get(q, 0):.2f}' if before else ''))
        if weekly:
            # What its models cost here since its window began (a week before it resets): the board
            # divides the used percent by it, exact from the first reading.
            window = antigravity_cost(resets - 7 * 86400, now).get(q, 0.0)
            rows.append({'app': 'antigravity', 'quota': q, 'at': iso(now), 'week_percent': round((1 - qi['remainingFraction']) * 100, 2),
                         'week_resets_at': qi['resetTime'], 'cost_usd': round(costs.get(q, 0.0), 4) if before else None,
                         'window_cost_usd': round(window, 4)})
            if show:
                print(f'  {q}: its models cost ≈${window:.2f} here since the window began')
    if not rows:
        save_limit_state(antigravity_at=now)
        return True
    req = urllib.request.Request(ENDPOINT, data=json.dumps({'limits': rows}).encode(), method='POST', headers={
        'Authorization': f'Bearer {key}', 'User-Agent': AGENT, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            json.load(r)
    except Exception as e:
        log(f'limit: could not send Antigravity: {e}')
        return False
    save_limit_state(antigravity_at=now)
    return True


def totals(kinds):
    """A run's tokens by kind, with the sum of all of them and of all but the re-reads from the cache."""
    total = sum(kinds.values())
    return {**kinds, 'tokens': total, 'new_tokens': total - kinds['cache_read_tokens']}


def codex_usage(item):
    """Runs of a Codex thread from its rollout file: the running token totals, and the plan's limit
    as Codex last saw it."""
    files = glob.glob(str(CODEX_SESSIONS / '*' / '*' / '*' / f'rollout-*{item["session"]}.jsonl'))
    since = time.time() - USAGE_DAYS * 86400
    out = []
    for f in files:
        if os.path.getmtime(f) < since:
            continue
        points, model = [], None
        with open(f, errors='ignore') as fh:
            for line in fh:
                # The thread's model: set when the thread starts, and again when it changes.
                if '"thread_settings_applied"' in line or '"turn_context"' in line:
                    try:
                        pl = json.loads(line).get('payload') or {}
                        model = (pl.get('thread_settings') or pl).get('model') or model
                    except Exception:
                        pass
                    continue
                if '"token_count"' not in line:
                    continue
                try:
                    d = json.loads(line)
                except Exception:
                    continue
                pl = d.get('payload') or {}
                total = (pl.get('info') or {}).get('total_token_usage')
                t = when(d.get('timestamp') or '')
                if pl.get('type') == 'token_count' and total and t is not None:
                    points.append((t, total, (pl.get('rate_limits') or {}).get('primary') or {}, model))
        before, limit_before = {}, None
        known = next((p[3] for p in points if p[3]), None)
        for run in split_runs(points):
            end = run[-1][1]
            d = {k: end.get(k, 0) - before.get(k, 0) for k in ('input_tokens', 'cached_input_tokens', 'cache_write_input_tokens', 'output_tokens')}
            before = end
            limit = run[-1][2]
            used = limit.get('used_percent')
            # What this run took of the limit: its rise since the run before (none across a reset).
            took = used - limit_before if used is not None and limit_before is not None and used >= limit_before else None
            limit_before = used if used is not None else limit_before
            if run[-1][0] < since:
                continue
            read, write = max(0, d['cached_input_tokens']), max(0, d['cache_write_input_tokens'])
            kinds = {'input_tokens': max(0, d['input_tokens'] - read - write), 'cache_read_tokens': read,
                     'cache_write_tokens': write, 'output_tokens': max(0, d['output_tokens'])}
            # A run that began before Codex logged the thread's model: the model the thread uses.
            model_ = run[-1][3] or known
            pr = price(model_, OPENAI_PRICES)
            cost = None if pr is None else (kinds['input_tokens'] * pr[0] + kinds['output_tokens'] * pr[1]
                                            + read * pr[2] + write * pr[3]) / 1e6
            out.append({'agent': item['agent'], 'funnel_id': item['funnel_id'], 'app': 'codex',
                        'run_key': f'{item["session"]}:{int(run[0][0])}', 'model': model_,
                        'started_at': iso(run[0][0]), 'ended_at': iso(run[-1][0]), **totals(kinds),
                        'cost_usd': round(cost, 4) if cost is not None else None, 'limit_percent': used,
                        'limit_used': took, 'limit_window_minutes': limit.get('window_minutes')})
    return out


def proto(b):
    """A protobuf message as {field: [values]}: ints for varints, bytes for everything length-delimited."""
    out, i = {}, 0

    def varint():
        nonlocal i
        r = shift = 0
        while True:
            x = b[i]
            i += 1
            r |= (x & 0x7f) << shift
            shift += 7
            if x < 0x80:
                return r
    while i < len(b):
        key = varint()
        field, kind = key >> 3, key & 7
        if kind == 0:
            v = varint()
        elif kind == 2:
            n = varint()
            v, i = b[i:i + n], i + n
        elif kind == 1:
            v, i = None, i + 8
        elif kind == 5:
            v, i = None, i + 4
        else:
            break
        out.setdefault(field, []).append(v)
    return out


def first(msg, *path):
    """The value at a path of fields in a protobuf message, or None."""
    for n, f in enumerate(path):
        v = (msg.get(f) or [None])[0]
        if v is None or n == len(path) - 1:
            return v
        msg = proto(v)


def antigravity_calls(f, facts=False):
    """An Antigravity conversation's model calls, oldest first: (time, model, usage), the time being that
    of the step each call ended on. Usage fields (ModelUsageStats): 2 input, 3 output with thinking,
    4 cache writes, 5 cache reads."""
    import sqlite3
    # Read-only but with its write-ahead log, where the newest calls wait until Antigravity folds them
    # in; as an immutable file (the log left out) if that can't be opened.
    when_, calls = None, None
    for mode in ('ro', 'ro&immutable=1'):
        try:
            db = sqlite3.connect(f'file:{f}?mode={mode}', uri=True)
            when_ = {idx: first(proto(meta or b''), 1, 1) for idx, meta in db.execute('select idx, metadata from steps')}
            calls = db.execute('select data from gen_metadata order by idx').fetchall()
            db.close()
            break
        except Exception as e:
            err = e
    if calls is None:
        log(f'usage: antigravity {pathlib.Path(f).stem}: {err}')
        return []
    points = []
    for (data,) in calls:
        call = proto(proto(data).get(1, [b''])[0])
        usage = proto(first(call, 17, 2) or b'')
        model = (call.get(19) or [b''])[0].decode('utf-8', 'replace')
        facts_ = {}
        for kv in call.get(20, []):
            kv = proto(kv)
            facts_[(kv.get(1) or [b''])[0].decode('utf-8', 'replace')] = (kv.get(2) or [b''])[0].decode('utf-8', 'replace')
        step = facts_.get('last_step_index', '')
        t = when_.get(int(step)) if step.isdigit() else None
        if t and usage:
            points.append((t, model, usage, facts_) if facts else (t, model, usage))
    return sorted(points, key=lambda p: p[0])


def gemini_cost(model, u):
    """One Antigravity model call at API prices, or None for a model with no price."""
    pr = price(model, GEMINI_PRICES)
    if pr is None:
        return None
    n = lambda field: (u.get(field) or [0])[0]
    return ((n(2) + n(4)) * pr[0] + n(3) * pr[1] + n(5) * pr[2]) / 1e6


def antigravity_usage(item):
    """Runs of a Gemini agent in Google Antigravity: its conversations (antigravity_owner), each model
    call's tokens and the time of the step it ended on."""
    since = time.time() - USAGE_DAYS * 86400
    out = []
    for f in antigravity_conversations(item, since):
        cascade = pathlib.Path(f).stem
        points = antigravity_calls(f)
        for run in split_runs(points):
            if run[-1][0] < since:
                continue
            kinds = {'input_tokens': 0, 'cache_read_tokens': 0, 'cache_write_tokens': 0, 'output_tokens': 0}
            cost, models = 0.0, {}
            for _, model, u in run:
                n = lambda field: (u.get(field) or [0])[0]
                kinds['input_tokens'] += n(2)
                kinds['output_tokens'] += n(3)
                kinds['cache_write_tokens'] += n(4)
                kinds['cache_read_tokens'] += n(5)
                models[model] = models.get(model, 0) + 1
                c = gemini_cost(model, u)
                cost = None if c is None or cost is None else cost + c
            out.append({'agent': item['agent'], 'funnel_id': item['funnel_id'], 'app': 'antigravity',
                        'run_key': f'{cascade}:{int(run[0][0])}', 'model': max(models, key=models.get),
                        'started_at': iso(run[0][0]), 'ended_at': iso(run[-1][0]), **totals(kinds),
                        'cost_usd': round(cost, 4) if cost is not None else None})
    return out


# Grok Bot (bots that run in the cloud): what they use is on its servers, per bot and per day, read with
# the app's own sign-in from this Mac. Its sign-in is encrypted with a key kept in the keychain.
GROK_BOT = HOME / 'Library' / 'Application Support' / 'Grok Bot'
GROK_API = 'https://api2.cursor.sh/aiserver.v1.DashboardService/'
GROK_STATE = DIR / 'grok.json'  # the hours read: each asked once, and all sent again when the servers can't be reached


def grok_token():
    """Grok Bot's sign-in on this Mac, while it is still valid (the app renews it while it runs)."""
    import base64
    import hashlib
    try:
        accounts = json.loads(json.loads((GROK_BOT / 'sand-secrets.json').read_text())['cursor-accounts'])
    except Exception:
        return None  # no Grok Bot on this Mac: its keychain entry isn't asked for
    pw = keychain('Grok Bot Safe Storage')
    if not pw:
        return None
    account = accounts['accounts'].get(accounts.get('active')) or next(iter(accounts['accounts'].values()), {})
    raw = base64.b64decode(account.get('cursor-access-token', ''))
    if raw[:3] != b'v10':
        return None
    # Electron's safeStorage on macOS: AES-128-CBC, the key from the keychain's password.
    key = hashlib.pbkdf2_hmac('sha1', pw.encode(), b'saltysalt', 1003, 16)
    out = subprocess.run(['openssl', 'enc', '-d', '-aes-128-cbc', '-K', key.hex(), '-iv', (b' ' * 16).hex()],
                         input=raw[3:], capture_output=True, timeout=15)
    token = out.stdout.decode(errors='replace').strip()
    try:
        claims = json.loads(base64.urlsafe_b64decode(token.split('.')[1] + '=='))
    except Exception:
        return None
    return token if claims.get('exp', 0) > time.time() + 60 else None


def grok_call(token, method, body):
    req = urllib.request.Request(GROK_API + method, data=json.dumps(body).encode(), method='POST', headers={
        'Authorization': f'Bearer {token}', 'Content-Type': 'application/json', 'Connect-Protocol-Version': '1'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def grok_rows():
    """Every Grok Bot bot's use over the last days, a row an hour: its tokens, and its share of the
    plan's weekly limit (the used percent spread over all bots' tokens since the window began). The
    servers count per day; asked for one hour, they give that hour's. Hours gone by don't change, so
    each is asked once (kept in GROK_STATE), the last two again every time. They give no tokens by
    kind, and no price for use within the plan. None when they can't be asked."""
    token = grok_token()
    if not token:
        return None
    now = time.time()
    status = grok_call(token, 'GetSandUsageStatus', {})
    begun = when(status.get('currentPeriodStart'))
    try:
        hours = {k: v for k, v in json.loads(GROK_STATE.read_text()).get('hours', {}).items()}
    except Exception:
        hours = {}
    first = int((now - USAGE_DAYS * 86400) // 3600 * 3600)
    hours = {k: v for k, v in hours.items() if int(k) >= first}
    for h in range(first, int(now), 3600):
        if str(h) in hours and h < now - 2 * 3600:
            continue
        got = grok_call(token, 'GetDailySpendByCategory', {'periodStartMs': str(h * 1000), 'periodEndMs': str((h + 3600) * 1000), 'groupBy': 4})
        hours[str(h)] = {d['category']: int(d.get('totalTokens') or 0) for d in got.get('dailySpend', [])}
    # The window's tokens, from the daily counts: whole days since it began, the day it began in by
    # the part after.
    window = 0
    if begun:
        day0 = int(begun // 86400 * 86400)
        daily = grok_call(token, 'GetDailySpendByCategory', {'periodStartMs': str(day0 * 1000), 'periodEndMs': str(int(now * 1000)), 'groupBy': 4})
        for d in daily.get('dailySpend', []):
            day, t = int(d['day']) / 1000, int(d.get('totalTokens') or 0)
            window += t * min(1, (day + 86400 - begun) / 86400) if day < begun else t
    percent = status.get('usagePercent')
    rate = percent / window if percent is not None and window > 0 else None
    return {'percent': percent, 'resets': status.get('nextResetTimestampUtc'), 'hours': hours,
            'rows': [{'bot': bot, 'at': int(h), 'tokens': t, 'limit_used': round(t * rate, 4) if rate else None}
                     for h, bots in hours.items() for bot, t in bots.items() if t]}


def grok_usage(item, read):
    """A Grok agent's hours in Grok Bot, from what grok_rows read."""
    out = []
    for d in read['rows'] if read else []:
        if d['bot'] != item['session']:
            continue
        out.append({'agent': item['agent'], 'funnel_id': item['funnel_id'], 'app': 'grok', 'model': 'grok-bot',
                    'run_key': f'grokbot:{d["bot"]}:{d["at"]}', 'started_at': iso(d['at']),
                    'ended_at': iso(min(d['at'] + 3599, time.time())), 'tokens': d['tokens'], 'new_tokens': d['tokens'],
                    'limit_used': d['limit_used'], 'limit_percent': read['percent'], 'limit_window_minutes': 7 * 1440})
    return out


def grok_read():
    """grok_rows, kept for when the servers can't be reached (so its hours aren't dropped meanwhile)."""
    try:
        read = grok_rows()
    except Exception as e:
        log(f'usage: Grok Bot: {e}')
        read = None
    if read:
        GROK_STATE.write_text(json.dumps(read))
        return read
    try:
        return json.loads(GROK_STATE.read_text())
    except Exception:
        return None


def report_grok_limit(key, show=False):
    """Read how much of the Grok Bot plan's weekly limit is used and send it to Goalcraft."""
    token = grok_token()
    if not token:
        return False  # no Grok Bot on this Mac, or signed out: nothing to read
    try:
        status = grok_call(token, 'GetSandUsageStatus', {})
    except Exception as e:
        log(f'limit: could not read Grok Bot: {e}')
        return False
    if status.get('usagePercent') is None:
        return False
    row = {'app': 'grok', 'at': iso(time.time()), 'week_percent': round(status['usagePercent'], 2),
           'week_resets_at': status.get('nextResetTimestampUtc')}
    if show:
        print(f'Grok Bot: {row["week_percent"]}% of the week used (resets {row["week_resets_at"]})')
    req = urllib.request.Request(ENDPOINT, data=json.dumps({'limits': [row]}).encode(), method='POST', headers={
        'Authorization': f'Bearer {key}', 'User-Agent': AGENT, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            json.load(r)
    except Exception as e:
        log(f'limit: could not send Grok Bot: {e}')
        return False
    return True


def report_usage(key, show=False):
    """Read the local agents' token use and send it to Goalcraft. Returns how many runs were sent."""
    req = urllib.request.Request(ENDPOINT + '?agents=1', headers={'Authorization': f'Bearer {key}', 'User-Agent': AGENT})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            agents = json.load(r).get('agents', [])
    except Exception as e:
        log(f'usage: could not list agents: {e}')
        return 0
    sessions = app_sessions()
    grok = grok_read() if any(item['app'] == 'grok' for item in agents) else None
    rows = []
    for item in agents:
        try:
            rows += (claude_usage(item, sessions) if item['app'] == 'claude' else codex_usage(item) if item['app'] == 'codex'
                     else antigravity_usage(item) if item['app'] == 'antigravity' else grok_usage(item, grok) if item['app'] == 'grok' else [])
        except Exception as e:
            log(f'usage: {item["agent"]} in {item["funnel_id"]}: {e}')
    if show:
        for r in rows:
            cost = f' ≈${r["cost_usd"]:.2f}' if r.get('cost_usd') is not None else ''
            limit = f' limit {r["limit_percent"]}% (+{r["limit_used"]})' if r.get('limit_percent') is not None else ''
            limit = limit or (f' {r["limit_used"]}% of the limit' if r.get('limit_used') is not None else '')
            print(f'{r["funnel_id"]:>14} {r["agent"]:<18} {r["started_at"]} {r["tokens"] / 1e6:7.2f}M tokens{cost}{limit}')
    saved = 0
    # The first batch replaces what was sent before for the same days, so runs read differently
    # this time (say, split at another pause) are not counted twice.
    since = iso(time.time() - USAGE_DAYS * 86400)
    rows = [r for r in rows if r['ended_at'] >= since]
    for i in range(0, len(rows), 400):
        body = json.dumps({'usage': rows[i:i + 400], **({'replace_from': since} if i == 0 else {})}).encode()
        req = urllib.request.Request(ENDPOINT, data=body, method='POST', headers={
            'Authorization': f'Bearer {key}', 'User-Agent': AGENT, 'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                saved += json.load(r).get('saved', 0)
        except Exception as e:
            log(f'usage: could not send: {e}')
    return saved


def check(key, wake_them=True):
    req = urllib.request.Request(ENDPOINT, headers={'Authorization': f'Bearer {key}', 'User-Agent': AGENT})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            items = json.load(r).get('wake', [])
    except urllib.error.HTTPError as e:
        log(f'check failed: HTTP {e.code} {e.read()[:200]!r}')
        return e.code
    except Exception as e:  # offline, timeout: try again next time
        log(f'check failed: {e}')
        return None
    if wake_them:
        for item in items:
            wake(item)
    return 200


def verify(key):
    """Whether Goalcraft knows the key, without asking whom to wake (that would mark them as woken)."""
    req = urllib.request.Request(ENDPOINT + '?check=1', headers={'Authorization': f'Bearer {key}', 'User-Agent': AGENT})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception:
        return None


def key_or_exit():
    try:
        return json.loads(CONFIG.read_text())['key']
    except Exception:
        sys.exit('No key yet: ask your agent to set up the Goalcraft wake script (it calls create_wake_key and installs it)')


limit_next = 0  # when to read the Claude plan's limit next


def limit_next_after(seconds):
    global limit_next
    limit_next = time.time() + seconds


def limit_job(key):
    """One hourly reading of the Claude plan's limit; when it fails (no network, say), again in 5 minutes."""
    claude = report_limit(key)
    report_antigravity_limit(key)
    report_grok_limit(key)
    limit_next_after(LIMIT_EVERY if claude else 5 * 60)


def run():
    key = key_or_exit()
    log('started')
    counted = 0
    while True:
        if check(key) == 401:
            log('the key was replaced or removed: stopping. Ask your agent to set up the wake script again (create_wake_key).')
            return
        if time.time() - counted > USAGE_EVERY:
            counted = time.time()
            threading.Thread(target=report_usage, args=(key,), daemon=True).start()
        if time.time() >= limit_next:
            limit_next_after(LIMIT_EVERY)  # until this reading ends; a failed one is tried again sooner
            threading.Thread(target=limit_job, args=(key,), daemon=True).start()
        time.sleep(EVERY)


def install(key):
    if not key.startswith('gck_'):
        sys.exit('That does not look like a Goalcraft wake key (gck_…): the MCP tool create_wake_key makes one.')
    DIR.mkdir(exist_ok=True)
    CONFIG.write_text(json.dumps({'key': key}))
    CONFIG.chmod(0o600)
    me = DIR / 'goalcraft-wake.py'
    if pathlib.Path(__file__).resolve() != me.resolve():
        shutil.copy(__file__, me)
    # Only check the key here: the service started below does the waking, and logs it.
    if verify(key) == 401:
        sys.exit('Goalcraft does not know this key: the MCP tool create_wake_key makes a new one.')
    if sys.platform != 'darwin':
        print(f'Key saved. Keep `python3 {me} run` running (for example from cron or a service).')
        return
    PLIST.parent.mkdir(parents=True, exist_ok=True)
    PLIST.write_text(f'''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>{LABEL}</string>
  <key>ProgramArguments</key><array><string>{sys.executable}</string><string>{me}</string><string>run</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
  <key>StandardErrorPath</key><string>{LOG}</string>
</dict></plist>
''')
    uid = os.getuid()
    subprocess.run(['launchctl', 'bootout', f'gui/{uid}/{LABEL}'], capture_output=True)
    subprocess.run(['launchctl', 'bootstrap', f'gui/{uid}', str(PLIST)], check=True)
    print('Goalcraft wake is on: it checks every 10 seconds and starts again after a restart.')
    print(f'Log: {LOG}. To stop it: python3 {me} uninstall')
    if not find('claude') and not find('codex'):
        print('Note: neither `claude` (Claude Code) nor `codex` was found on this computer, so there is nothing to wake yet.')


def uninstall():
    if sys.platform == 'darwin':
        subprocess.run(['launchctl', 'bootout', f'gui/{os.getuid()}/{LABEL}'], capture_output=True)
        if PLIST.exists():
            PLIST.unlink()
    print('Goalcraft wake is off. The key stays in ~/.goalcraft/wake.json until a new one replaces it.')


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'install' and len(sys.argv) == 3:
        install(sys.argv[2].strip())
    elif cmd == 'uninstall':
        uninstall()
    elif cmd == 'run':
        run()
    elif cmd == 'usage':
        print(f'sent {report_usage(key_or_exit(), show=True)} runs to Goalcraft')
    elif cmd == 'version':
        print(VERSION)
    elif cmd == 'limit':
        key = key_or_exit()
        ASK_AGAIN = True
        print('Claude: sent' if report_limit(key, show=True) else 'Claude: failed, see ~/.goalcraft/wake.log')
        print('Antigravity: sent' if report_antigravity_limit(key, show=True) else 'Antigravity: not running or failed')
        print('Grok Bot: sent' if report_grok_limit(key, show=True) else 'Grok Bot: not signed in here or failed')
    elif cmd == 'once':
        print('ok' if check(key_or_exit()) == 200 else 'failed: see ~/.goalcraft/wake.log')
        time.sleep(1)
        while running:
            time.sleep(1)
    else:
        print(__doc__)
