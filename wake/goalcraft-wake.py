#!/usr/bin/env python3
"""Goalcraft wake script: wakes your agents on this computer as soon as something waits for them.

Every 10 seconds it asks Goalcraft which of your agents to wake: one you wrote to from the dashboard,
one whose question you answered while it sleeps, or one that went silent (it missed its run, or
stopped signalling at work). It wakes each in its own conversation with a short note to check
Goalcraft: a Claude app session (Claude Code) through `claude -p --resume`, a Codex thread through
`codex exec resume`. Web chats (claude.ai, chatgpt.com) can't be woken from outside and are skipped.

    python3 goalcraft-wake.py install <key>   save the key and keep the script running (macOS)
    python3 goalcraft-wake.py uninstall       stop it and remove it from the login items
    python3 goalcraft-wake.py once            one check, then exit (to try it)
    python3 goalcraft-wake.py usage           read and send the agents' token use now, and print it
    python3 goalcraft-wake.py run             the loop itself (what install starts)

The key comes from the Goalcraft MCP tool create_wake_key (your agent calls it and runs install for you).
It only lets the script ask whom to wake, and send what the agents' runs used in tokens (read from
their session files here: numbers only, nothing from the conversations).
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

ENDPOINT = 'https://wbnmtecgahwzwvcqenlk.supabase.co/functions/v1/wake'
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


# Token use. The agents don't know what they spend, but their apps log it on this computer: every
# model call in a Claude Code transcript (~/.claude/projects/*/<session>.jsonl), Codex's running
# totals and plan limit in its rollout files (~/.codex/sessions/…). Every few minutes the script sums
# them per run and sends Goalcraft the numbers only, nothing from the conversations.
USAGE_EVERY = 5 * 60
USAGE_DAYS = 2      # runs ended this recently are (re)sent
RUN_GAP = 15 * 60   # a pause this long in one session starts a new run
PROJECTS = HOME / '.claude' / 'projects'
CODEX_SESSIONS = HOME / '.codex' / 'sessions'
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
                    pr = price(model)
                    if model == '<synthetic>':  # Claude Code's own notes, not a model call
                        pass
                    elif pr is None or cost is None:
                        cost = None
                    else:
                        cost += (fresh * pr[0] + out_ * pr[1] + read * pr[2] + hour * pr[0] * 2 + (write - hour) * pr[0] * 1.25) / 1e6
                out.append({'agent': item['agent'], 'funnel_id': item['funnel_id'], 'app': 'claude',
                            'run_key': f'{cli}:{int(run[0][0])}', 'model': max(models, key=models.get),
                            'started_at': iso(run[0][0]), 'ended_at': iso(run[-1][0]), **totals(kinds),
                            'cost_usd': round(cost, 4) if cost is not None else None})
    return out


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
            model_ = run[-1][3]
            pr = price(model_, OPENAI_PRICES)
            cost = None if pr is None else (kinds['input_tokens'] * pr[0] + kinds['output_tokens'] * pr[1]
                                            + read * pr[2] + write * pr[3]) / 1e6
            out.append({'agent': item['agent'], 'funnel_id': item['funnel_id'], 'app': 'codex',
                        'run_key': f'{item["session"]}:{int(run[0][0])}', 'model': model_,
                        'started_at': iso(run[0][0]), 'ended_at': iso(run[-1][0]), **totals(kinds),
                        'cost_usd': round(cost, 4) if cost is not None else None, 'limit_percent': used,
                        'limit_used': took, 'limit_window_minutes': limit.get('window_minutes')})
    return out


def report_usage(key, show=False):
    """Read the local agents' token use and send it to Goalcraft. Returns how many runs were sent."""
    req = urllib.request.Request(ENDPOINT + '?agents=1', headers={'Authorization': f'Bearer {key}', 'User-Agent': 'goalcraft-wake/1'})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            agents = json.load(r).get('agents', [])
    except Exception as e:
        log(f'usage: could not list agents: {e}')
        return 0
    sessions = app_sessions()
    rows = []
    for item in agents:
        try:
            rows += claude_usage(item, sessions) if item['app'] == 'claude' else codex_usage(item)
        except Exception as e:
            log(f'usage: {item["agent"]} in {item["funnel_id"]}: {e}')
    if show:
        for r in rows:
            cost = f' ≈${r["cost_usd"]:.2f}' if r.get('cost_usd') is not None else ''
            limit = f' limit {r["limit_percent"]}% (+{r["limit_used"]})' if r.get('limit_percent') is not None else ''
            print(f'{r["funnel_id"]:>14} {r["agent"]:<18} {r["started_at"]} {r["tokens"] / 1e6:7.2f}M tokens{cost}{limit}')
    saved = 0
    for i in range(0, len(rows), 400):
        body = json.dumps({'usage': rows[i:i + 400]}).encode()
        req = urllib.request.Request(ENDPOINT, data=body, method='POST', headers={
            'Authorization': f'Bearer {key}', 'User-Agent': 'goalcraft-wake/1', 'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                saved += json.load(r).get('saved', 0)
        except Exception as e:
            log(f'usage: could not send: {e}')
    return saved


def check(key, wake_them=True):
    req = urllib.request.Request(ENDPOINT, headers={'Authorization': f'Bearer {key}', 'User-Agent': 'goalcraft-wake/1'})
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
    req = urllib.request.Request(ENDPOINT + '?check=1', headers={'Authorization': f'Bearer {key}', 'User-Agent': 'goalcraft-wake/1'})
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
    elif cmd == 'once':
        print('ok' if check(key_or_exit()) == 200 else 'failed: see ~/.goalcraft/wake.log')
        time.sleep(1)
        while running:
            time.sleep(1)
    else:
        print(__doc__)
