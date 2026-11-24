// The orchestrator: Goalcraft starts a funnel's roles itself, on the person's subscriptions, through the
// wake script on their computers (see supabase/migrations/20261123000000_orchestrator.sql).
//
// Every check of every script runs dispatch() for its person: it ends the starts that are over, puts a
// start in line for each role that is due (its schedule, the time its agent named, a message or an answer
// for it), one at a time per role, chooses who works it, and hands the computer that asks the starts it
// can do. The script takes one (claim), starts the app, and says when the app has finished (done); the
// agent itself says when it begins and ends its run (set_agent_state, see the MCP server).
import cronParser from 'npm:cron-parser@4.9.0'

export const SILENT = 10 * 60e3  // the board's amber triangle: this long without a word, a run is over
const ONLINE = 3 * 60e3          // a computer whose script asked this recently is on

// Which AI each app is on the board (its logo and shirt), and which plan quota a run there uses.
// A role on pause because its schedule was turned off (and back to sleep when it is turned on again).
export const SCHEDULE_OFF = 'расписание выключено'
export const PROVIDER: Record<string, string> ={ claude: 'claude', codex: 'chatgpt', antigravity: 'gemini', grok: 'grok' }
function quotaOf(app: string, model: string | null): [string, string] {
  if (app !== 'antigravity') return [app, '']
  const m = (model ?? '').toLowerCase()
  return ['antigravity', m.includes('argon') ? 'gemini-4-argon' : /claude|gpt/.test(m) ? 'claude-gpt' : 'gemini']
}

// The cron's times in the role's time zone: the last one up to now, and the next one after a moment.
export function cronPrev(expr: string, tz: string, at = new Date()): Date | null {
  try { return cronParser.parseExpression(expr, { currentDate: at, tz }).prev().toDate() } catch { return null }
}
export function cronNext(expr: string, tz: string, at = new Date()): Date | null {
  try { return cronParser.parseExpression(expr, { currentDate: at, tz }).next().toDate() } catch { return null }
}

type Row = Record<string, any>

// What a computer can run, as its script last said (inventory), and whether it is on now.
function canRun(key: Row, ex: Row, now: number) {
  if (!key.last_used_at || now - Date.parse(key.last_used_at) > ONLINE) return false
  if (ex.computer && ex.computer !== key.computer) return false
  const inv = key.inventory?.[ex.app]
  if (!inv) return false
  if (ex.app === 'antigravity' && !inv.running) return false
  if (ex.app === 'grok' && !inv.signed_in) return false
  return true
}

// The latest reading of each plan's quota: app|quota → { used (0-100), resets_at, session_used, session_resets_at }.
function quotas(readings: Row[]) {
  const out = new Map<string, Row>()
  for (const r of readings) {
    const k = `${r.app}|${r.quota ?? ''}`
    if (!out.has(k) || Date.parse(out.get(k)!.at) < Date.parse(r.at)) out.set(k, r)
  }
  return out
}

// Who works the role's next start: of its enabled executors that a computer on now can run and whose plan
// is under the role's limit, the first (mode priority), or the one whose quota would go unused soonest
// before the role's next start (mode even): all its rest if its quota resets before then, else the rest
// times the share of the time to its reset that passes until then. Ties go by order.
export function choose(role: Row, executors: Row[], keys: Row[], q: Map<string, Row>, now: number, horizonMs: number, skip = new Set<string>()) {
  const used = (ex: Row) => {
    const r = q.get(quotaOf(ex.app, ex.model).join('|'))
    if (!r) return { week: 0, resets: null as number | null }
    const resets = r.week_resets_at ? Date.parse(r.week_resets_at) : null
    const week = resets != null && resets <= now ? 0 : Number(r.week_percent ?? 0)
    const sResets = r.session_resets_at ? Date.parse(r.session_resets_at) : null
    const session = sResets != null && sResets <= now ? 0 : Number(r.session_percent ?? 0)
    return { week: Math.max(week, session), resets }
  }
  const ok = executors.filter(ex => ex.enabled && !skip.has(ex.id) && keys.some(k => canRun(k, ex, now))
    && used(ex).week < Number(role.quota_limit ?? 95))
  if (!ok.length) return null
  if (role.mode === 'priority') return ok[0]
  const score = (ex: Row) => {
    const { week, resets } = used(ex)
    const rest = 100 - week
    if (resets == null || resets - now <= horizonMs) return rest
    return rest * horizonMs / (resets - now)
  }
  return ok.reduce((best, ex) => score(ex) > score(best) + 1e-9 ? ex : best)
}

// The note an executor starts with: who the role is and where its instructions are; the rest is in them.
export function prompt(role: Row, funnel: Row, presence: Row | null, ex: Row, reason: string) {
  const zone = presence?.zone == null ? '"supervisor"' : String(presence.zone)
  const name = presence?.display_name ? ` ("${presence.display_name}")` : ''
  const why = { schedule: 'a scheduled run', message: 'a message for you', answer: 'the person answered your question', manual: 'the person pressed Run now' }[reason] ?? 'a run'
  const scheduled = role.schedule && role.schedule_on
  const lines = [
    `Goalcraft starts you for ${why}. You are the role "${role.agent}"${name} of the funnel "${funnel.title}" (funnel_id ${funnel.key}) in Goalcraft, zone ${zone}.`,
    `1. First of all call set_agent_state(work) with funnel_id "${funnel.key}", agent "${role.agent}", zone ${zone}, provider "${PROVIDER[ex.app]}"; again every 5 minutes while you work.`,
    funnel.guide_url ? `2. Read the funnel's guide (the part common to all its roles): ${funnel.guide_url}` : '2. The funnel has no guide yet: list_funnels shows it.',
    role.guide_url ? `3. Read your own instructions and follow them for this run: ${role.guide_url}` : '3. You have no instructions of your own yet: work as the funnel\'s guide says for your zone.',
    '4. Call get_messages and take the answers to your questions (get_answer); reply to each in one short line.',
    `5. At the end write what this run did into the "last run" block of your instructions, then set_agent_state(sleep)${scheduled ? ' (no next_run_at: Goalcraft starts you on the role\'s schedule)' : ' with next_run_at, when you should run next'}.`,
  ]
  return lines.join('\n')
}

// One pass for one person (see above). Returns the starts this computer (key) may take now.
export async function dispatch(admin: any, user: string, key: Row) {
  const now = Date.now(), iso = (t: number) => new Date(t).toISOString()
  const [roles, execs, open, keys, readings, presence, funnels, unread, answered] = await Promise.all([
    admin.from('role_launch').select('*').eq('user_id', user),
    admin.from('role_executors').select('*').eq('user_id', user).order('position'),
    admin.from('role_launches').select('*').eq('user_id', user).is('ended_at', null),
    admin.from('wake_keys').select('id, computer, last_used_at, inventory, created_at').eq('user_id', user),
    admin.from('limit_readings').select('app, quota, at, week_percent, week_resets_at, session_percent, session_resets_at').eq('user_id', user).gte('at', iso(now - 2 * 86400e3)),
    admin.from('presence').select('funnel_id, agent, zone, state, next_run_at, pause_reason, updated_at, display_name, provider').eq('user_id', user),
    admin.from('funnels').select('id, key, title, guide_url').eq('user_id', user),
    admin.from('agent_messages').select('id, funnel_id, agent, sent_at').eq('user_id', user).is('read_at', null).is('woken_at', null).gte('sent_at', iso(now - 86400e3)),
    admin.from('questions').select('id, funnel_id, agent, answered_at').eq('user_id', user).not('answered_at', 'is', null).is('replied_at', null).is('woken_at', null).gte('answered_at', iso(now - 86400e3)),
  ])
  if (roles.error || execs.error || open.error || keys.error) throw new Error('orchestrator: read failed')
  if (!roles.data?.length) return []
  const q = quotas(readings.data ?? [])
  const pres = new Map((presence.data ?? []).map((p: Row) => [`${p.funnel_id}|${p.agent}`, p]))
  const fun = new Map((funnels.data ?? []).map((f: Row) => [f.id, f]))
  const offer: Row[] = []

  for (const role of roles.data) {
    const rk = `${role.funnel_id}|${role.agent}`
    const p = pres.get(rk) ?? null
    const mine = (execs.data ?? []).filter((e: Row) => e.funnel_id === role.funnel_id && e.agent === role.agent)
    // Every agent has Launch; Goalcraft starts only those with an executor on (the others run as before,
    // in their own apps).
    if (!mine.some((e: Row) => e.enabled)) continue
    let starts = (open.data ?? []).filter((l: Row) => l.funnel_id === role.funnel_id && l.agent === role.agent)
    const end = async (l: Row, outcome: string, note?: string) => {
      await admin.from('role_launches').update({ ended_at: iso(now), outcome, ...(note ? { note } : {}) }).eq('id', l.id).is('ended_at', null)
      starts = starts.filter((s: Row) => s.id !== l.id)
    }
    // A start the agent has begun: it reported work after the script took it (the MCP server marks this
    // too, as the agent calls; here it is seen on the next check). Its run in the history gets the executor.
    for (const l of starts) {
      if (!l.claimed_at || l.started_at || !p || (p.state !== 'work' && p.state !== 'ask') || Date.parse(p.updated_at) < Date.parse(l.claimed_at)) continue
      const { data: runs } = await admin.from('agent_runs').select('id, started_at').eq('funnel_id', role.funnel_id).eq('agent', role.agent)
        .gte('started_at', l.claimed_at).order('started_at', { ascending: true }).limit(1)
      const run = runs?.[0]
      l.started_at = run?.started_at ?? p.updated_at
      await admin.from('role_launches').update({ started_at: l.started_at, ...(run && { run_id: run.id }) }).eq('id', l.id).is('started_at', null)
      if (run) await admin.from('agent_runs').update({ app: l.app, model: l.model, launch_id: l.id }).eq('id', run.id)
      // Its shirt is the one who took the start, whatever its agent says it is.
      if (PROVIDER[l.app] && p.provider !== PROVIDER[l.app]) await admin.from('presence').update({ provider: PROVIDER[l.app] }).eq('funnel_id', role.funnel_id).eq('agent', role.agent)
    }
    // The starts that are over: taken but the agent never began within 10 minutes (the next executor
    // gets it), or begun and silent for 10 minutes (it ended without saying).
    for (const l of [...starts]) {
      if (l.claimed_at && !l.started_at && now - Date.parse(l.claimed_at) > SILENT) {
        await end(l, 'not_started', 'the agent did not report work within 10 minutes')
        const { data: again } = await admin.from('role_launches').insert({ funnel_id: l.funnel_id, agent: l.agent, user_id: user, reason: l.reason, due_at: iso(now) }).select('*').single()
        if (again) starts.push({ ...again, _skip: [l.executor_id, ...(l._skip ?? [])] })
      } else if (l.started_at && (!p || p.state !== 'work' && p.state !== 'ask' || now - Date.parse(p.updated_at) > SILENT)) {
        await end(l, p && (p.state === 'sleep' || p.state === 'pause') ? 'done' : 'silent')
      }
    }
    const scheduled = role.schedule && role.schedule_on
    // A schedule turned off: the role goes on pause (no time of its own to wake at).
    if (role.schedule && !role.schedule_on && p && p.state === 'sleep') {
      await admin.from('presence').update({ state: 'pause', pause_reason: SCHEDULE_OFF, next_run_at: null }).eq('funnel_id', role.funnel_id).eq('agent', role.agent)
      p.state = 'pause'
    }
    // Turned on again: the pause that came of it ends, and the role sleeps until its next time.
    if (scheduled && p && p.state === 'pause' && p.pause_reason === SCHEDULE_OFF) {
      const at = cronNext(role.schedule, role.time_zone, new Date(now))?.toISOString() ?? null
      await admin.from('presence').update({ state: 'sleep', pause_reason: null, next_run_at: at }).eq('funnel_id', role.funnel_id).eq('agent', role.agent)
      Object.assign(p, { state: 'sleep', pause_reason: null, next_run_at: at })
    }
    // Paused: nothing starts it but the person's Run now.
    const paused = p?.state === 'pause'
    const queued = starts.find((l: Row) => !l.claimed_at)
    const lastDue = async (reason: string) => {
      const { data } = await admin.from('role_launches').select('due_at, created_at').eq('funnel_id', role.funnel_id).eq('agent', role.agent)
        .eq('reason', reason).order('due_at', { ascending: false }).limit(1)
      return data?.[0] ?? null
    }
    // Due now: the schedule's last time (not before the role was set up or last changed), the time the
    // agent named (without a schedule), a message or an answer. At most one start waits.
    let due: { reason: string, at: number } | null = null
    if (!queued && !paused) {
      if (scheduled) {
        const prev = cronPrev(role.schedule, role.time_zone, new Date(now))
        const last = await lastDue('schedule')
        if (prev && prev.getTime() > Date.parse(role.updated_at) && (!last || Date.parse(last.due_at) < prev.getTime())) due = { reason: 'schedule', at: prev.getTime() }
      } else if (p?.state === 'sleep' && p.next_run_at && Date.parse(p.next_run_at) <= now) {
        const last = await lastDue('schedule')
        if (!last || Date.parse(last.due_at) < Date.parse(p.next_run_at)) due = { reason: 'schedule', at: Date.parse(p.next_run_at) }
      }
      const msgs = (unread.data ?? []).filter((m: Row) => m.funnel_id === role.funnel_id && m.agent === role.agent)
      const ans = (answered.data ?? []).filter((a: Row) => a.funnel_id === role.funnel_id && a.agent === role.agent)
      if (!due && (msgs.length || ans.length)) {
        due = { reason: msgs.length ? 'message' : 'answer', at: now }
        const t = iso(now)
        if (msgs.length) await admin.from('agent_messages').update({ woken_at: t }).in('id', msgs.map((m: Row) => m.id))
        if (ans.length) await admin.from('questions').update({ woken_at: t }).in('id', ans.map((a: Row) => a.id))
      }
      if (due) {
        const { data } = await admin.from('role_launches').insert({ funnel_id: role.funnel_id, agent: role.agent, user_id: user, reason: due.reason, due_at: iso(due.at) }).select('*').single()
        if (data) starts.push(data)
      }
    }
    // A paused role's waiting starts go, except the person's Run now.
    for (const l of starts.filter((l: Row) => !l.claimed_at && paused && l.reason !== 'manual')) await end(l, 'skipped', 'the role is on pause')

    // How far ahead the even mode looks: to the role's next start after this one (a day without a schedule).
    const horizon = (scheduled && cronNext(role.schedule, role.time_zone, new Date(now))?.getTime()) || now + 86400e3
    // Busy: a start taken and not over, or the agent at work by itself (reporting): the waiting one waits.
    const busy = starts.some((l: Row) => l.claimed_at) || (p && (p.state === 'work' || p.state === 'ask') && now - Date.parse(p.updated_at) < SILENT)
    const waiting = starts.find((l: Row) => !l.claimed_at)
    if (waiting && !busy) {
      // Executors that did not start this reason within the last hour are left out this time.
      const { data: failed } = await admin.from('role_launches').select('executor_id').eq('funnel_id', role.funnel_id).eq('agent', role.agent)
        .in('outcome', ['not_started', 'failed']).gte('ended_at', iso(now - 3600e3))
      const skip = new Set<string>([...(waiting._skip ?? []), ...(failed ?? []).map((f: Row) => f.executor_id)].filter(Boolean))
      const ex = choose(role, mine, keys.data ?? [], q, now, horizon - now, skip)
      if (!ex) {
        if (!waiting.note) await admin.from('role_launches').update({ note: 'no executor can take it now (computers off, quotas used up)' }).eq('id', waiting.id)
      } else {
        if (waiting.executor_id !== ex.id) {
          await admin.from('role_launches').update({ executor_id: ex.id, app: ex.app, model: ex.model, effort: ex.effort, note: null }).eq('id', waiting.id)
          Object.assign(waiting, { executor_id: ex.id, app: ex.app, model: ex.model, effort: ex.effort })
        }
        // The role's main computer takes it whenever it is on and can run it; else the next one that can,
        // in the order the scripts were set up (the first one set up is the main one when none is chosen).
        const main = (k: Row) => (role.computer ? k.computer === role.computer : false)
        const able = (keys.data ?? []).filter((k: Row) => canRun(k, ex, now))
          .sort((a: Row, b: Row) => Number(main(b)) - Number(main(a)) || Date.parse(a.created_at) - Date.parse(b.created_at))
        if (able[0]?.id === key.id) {
          const f = fun.get(role.funnel_id)
          offer.push({
            launch: waiting.id, funnel_id: f?.key, agent: role.agent, app: ex.app, model: ex.model, effort: ex.effort,
            new_chat: ex.new_chat, full_access: ex.full_access, bot_id: ex.bot_id, prompt: prompt(role, f ?? {}, p, ex, waiting.reason),
          })
        }
      }
    }
    // While nobody works it, the role sleeps as the one who worked it last (its shirt and its chat, so the
    // person can open what it did); the next start wakes it as the one who takes that start.
    if (!busy && p && (p.state === 'sleep' || p.state === 'pause')) {
      const patch: Row = {}
      if (scheduled && p.state === 'sleep') {
        const at = cronNext(role.schedule, role.time_zone, new Date(now))?.toISOString() ?? null
        if (at && p.next_run_at !== at && Date.parse(p.next_run_at ?? '0') !== Date.parse(at)) patch.next_run_at = at
      }
      if (Object.keys(patch).length) await admin.from('presence').update(patch).eq('funnel_id', role.funnel_id).eq('agent', role.agent)
    }
  }
  return offer
}

// The script took a start: it is its, unless another computer took it first.
export async function claimLaunch(admin: any, user: string, keyId: string, computer: string | null, id: string) {
  const { data } = await admin.from('role_launches').update({ claimed_at: new Date().toISOString(), claimed_by: keyId, computer })
    .eq('id', id).eq('user_id', user).is('claimed_at', null).is('ended_at', null).select('id')
  return !!data?.length
}

// The app the script started has finished: a start the agent never began failed (the next executor gets
// the role); one it began ends when the agent says so (or goes silent).
export async function launchDone(admin: any, user: string, id: string, ok: boolean, note: string | null) {
  const { data: l } = await admin.from('role_launches').select('*').eq('id', id).eq('user_id', user).maybeSingle()
  if (!l || l.ended_at) return
  if (!l.started_at) {
    await admin.from('role_launches').update({ ended_at: new Date().toISOString(), outcome: ok ? 'not_started' : 'failed', note: (note ?? '').slice(0, 300) || null }).eq('id', id)
    await admin.from('role_launches').insert({ funnel_id: l.funnel_id, agent: l.agent, user_id: user, reason: l.reason, due_at: new Date().toISOString() })
  } else if (note) {
    await admin.from('role_launches').update({ note: note.slice(0, 300) }).eq('id', id)
  }
}
