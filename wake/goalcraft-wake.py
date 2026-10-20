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
    python3 goalcraft-wake.py run             the loop itself (what install starts)

The key comes from the Goalcraft MCP tool create_wake_key (your agent calls it and runs install for you).
It only lets the script ask whom to wake.
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
    'message': 'The person wrote to you on the Goalcraft dashboard.',
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


def claude_command(item):
    """`claude -p --resume` for a Claude app session: its local_ id maps to the Claude Code session it runs."""
    claude = find('claude')
    if not claude:
        return None, 'claude command not found (install Claude Code and sign in with `claude`)'
    files = glob.glob(str(SESSIONS / '*' / '*' / f'{item["session"]}.json'))
    if not files:
        return None, f'no Claude app session {item["session"]} on this computer'
    s = json.loads(pathlib.Path(files[0]).read_text())
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
    while True:
        if check(key) == 401:
            log('the key was replaced or removed: stopping. Ask your agent to set up the wake script again (create_wake_key).')
            return
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
    elif cmd == 'once':
        print('ok' if check(key_or_exit()) == 200 else 'failed: see ~/.goalcraft/wake.log')
        time.sleep(1)
        while running:
            time.sleep(1)
    else:
        print(__doc__)
