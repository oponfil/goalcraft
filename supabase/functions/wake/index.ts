// The wake script's endpoint (wake/goalcraft-wake.py): which of the person's agents to wake now. The
// script asks every few seconds with the person's wake key and resumes each agent's own conversation
// on their computer (a Claude app session or a Codex thread) with a short note to check Goalcraft.
//
//   GET /wake   Authorization: Bearer <wake key>   → { wake: [{ agent, funnel_id, funnel, reasons, app, session }] }
//   GET /wake?claim=1   → { wake: [{ …, marks }], script }: the same, but nothing is marked yet. Each computer's
//                          script wakes only the agents whose conversation is on it, so it takes those first:
//   POST /wake { claim: [{ funnel_id, agent, marks }] }   → { claimed: [true|false, …] }: marks them as woken;
//                          false when another computer took it first. script: the latest version and its
//                          SHA-256, so the script can update itself (wake/goalcraft-wake.py on goalcraft.ai)
//   GET /wake?claim=1 also → { launches: [{ launch, funnel_id, agent, app, model, effort, new_chat, full_access,
//                          bot_id, prompt }] }: the orchestrator's starts this computer can do (orchestrator.ts);
//   POST /wake { launch_claim: id } → { claimed }; { launch_done: id, ok, note } → { ok }: the script took a start,
//                          and its app finished; { inventory: { app: { models, running?, signed_in? } } } → { saved }
//   Stopped from the board (wake_keys.stopped_at): GET /wake?claim=1 → { wake: [], launches: [], stopped: true, script }:
//                          the script only asks again every minute until it is started; claims are refused
//   GET /wake?agents=1   → { agents: [{ agent, funnel_id, app, session }] }: the agents on this computer whose
//                          token use the script reads (nobody is woken or marked)
//   POST /wake { usage: [{ funnel_id, agent, run_key, app, model, started_at, ended_at, tokens, new_tokens,
//                input_tokens, cache_read_tokens, cache_write_tokens, output_tokens, cost_usd,
//                limit_percent, limit_used, limit_window_minutes }], replace_from?, replace_apps? }   → { saved }: what
//                their runs used; replace_from drops what this computer sent before for runs that ended since
//                then, and replace_apps (["grok"]) what any computer sent of those apps
//   POST /wake { limits: [{ app: "claude" | "codex" | "antigravity" | "grok" | "kimi", quota?, at, week_percent, week_resets_at?, session_percent?, session_resets_at?,
//                cost_usd? }] }   → { saved }: the plan's limit as the script read it, with what every local
//                session of that app cost since the reading before (the board turns cost into a share of it)
//
// Each script says which computer it runs on (X-Goalcraft-Computer) and its system (X-Goalcraft-Os): a person may run it on several,
// each with its own key, and a new key on the same computer replaces the one before.
//
// An agent is woken once for each reason: a message it has not read (from the person or from another
// agent of its funnel), an answer to its question while it sleeps, another agent's reply to its
// message, or a silence (it missed its run, or stopped signalling at work) since
// its last signal. An agent at work that signalled lately is left alone: it reads messages on its
// heartbeat and takes answers while it waits. Only agents whose chat is a link the script can resume
// are listed; each listing marks what it wakes for, so the next one does not repeat it.
import { createClient } from 'npm:@supabase/supabase-js@2.117.2'
import { WAKE_RELEASE } from './release.ts'
import { claimLaunch, dispatch, launchDone } from './orchestrator.ts'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const SILENT = 10 * 60e3 // the dashboard's own threshold for an amber triangle
const FRESH = 24 * 3600e3 // older messages and answers are not worth a wake any more

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

async function sha256(text: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('')
}

// A chat link the script can resume: a Claude app session or a Codex thread.
function session(chat: string | null): { app: string, session: string } | null {
  if (!chat) return null
  const claude = chat.match(/^claude:\/\/(?:claude\.ai\/epitaxy\/|code\/continue\?session=)(local_[0-9a-f-]{36})$/i)
  if (claude) return { app: 'claude', session: claude[1] }
  const codex = chat.match(/^codex:\/\/threads\/([0-9a-f-]{36})$/i)
  if (codex) return { app: 'codex', session: codex[1] }
  return null
}

// A Grok agent in the Grok Bot app: its bot, by the id in its link. Its bots run in the cloud and wake
// themselves (their own schedules), so the script only reads what they use.
function grokBot(chat: string | null): { app: string, session: string } | null {
  const id = chat?.match(/^grokbot:\/\/app\/v1\/agent\?id=([A-Za-z0-9_-]{1,128})$/)?.[1]
  return id ? { app: 'grok', session: id } : null
}

// A Kimi agent: it works in the Kimi app (Work) on this computer (its link is kimi://, or, from before
// agents sent one, it has none and a name like "kimi-search"), where the script reads what it uses
// from the app's conversation records (it finds them by the agent's own calls). The app has no way to
// resume one conversation from outside, so it isn't woken.
function kimiApp(p: any): { app: string, session: null } | null {
  return /^kimi:/i.test(p.chat_url ?? '') || (!p.chat_url && /^kimi/i.test(p.agent)) ? { app: 'kimi', session: null } : null
}

// What the script resumes for an agent: its Claude or Codex session, or for an agent in Google
// Antigravity (its link is antigravity://, or, from before agents sent one, it has none and a name
// like "gemini-search") its conversation there (the script finds it by the agent's name and funnel).
function resumable(p: any, chat: string | null = null): { app: string, session: string | null } | null {
  return session(chat ?? p.chat_url)
    ?? (/^antigravity:/i.test(p.chat_url ?? '') || (!p.chat_url && /^gemini/i.test(p.agent)) ? { app: 'antigravity', session: null } : null)
}

// The release the scripts may update to, once goalcraft.ai serves its file: the site is checked (with
// the version in the address, past any cache) at most every 5 minutes until the file there has this
// hash. Before that nothing is announced, so a release deployed here before the site has it costs no
// failed downloads, and the order of the two deploys doesn't matter.
let served: { at: number, ok: boolean } | null = null
async function published() {
  if (served?.ok) return WAKE_RELEASE
  if (served && Date.now() - served.at < 5 * 60e3) return null
  let ok = false
  try {
    const r = await fetch(`https://goalcraft.ai/wake/goalcraft-wake.py?v=${encodeURIComponent(WAKE_RELEASE.version)}`, { signal: AbortSignal.timeout(10000) })
    if (r.ok) {
      const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', await r.arrayBuffer()))
      ok = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('') === WAKE_RELEASE.sha256
    }
  } catch { /* the site didn't answer: try again later */ }
  served = { at: Date.now(), ok }
  return ok ? WAKE_RELEASE : null
}

// The script's problems, from its header: at most ten, each a short code, its level, the agent or
// keychain entry it concerns, and why (a line in English). Anything else is dropped.
function readProblems(header: string | null) {
  if (header == null) return null
  try {
    const list = JSON.parse(decodeURIComponent(header))
    if (!Array.isArray(list)) return null
    const str = (v: unknown, max: number) => typeof v === 'string' && v.length ? v.slice(0, max) : undefined
    return list.slice(0, 10).flatMap((p: any) => /^[a-z_]{1,40}$/.test(p?.code) && ['error', 'warning'].includes(p?.level)
      ? [{ code: p.code, level: p.level, agent: str(p.agent, 64), why: str(p.why, 200) }] : [])
  } catch { return null }
}

// The plan's limit as the script read it: numbers only, one row per reading.
async function saveLimits(user: string, list: any[]) {
  const num = (v: unknown, max: number) => typeof v === 'number' && isFinite(v) && v >= 0 && v <= max ? v : null
  const time = (v: unknown) => typeof v === 'string' && !isNaN(Date.parse(v)) ? new Date(v).toISOString() : null
  const ok = list.slice(0, 50).flatMap((r: any) => {
    const at = time(r?.at), week = num(r?.week_percent, 100)
    if (!['claude', 'codex', 'antigravity', 'grok', 'kimi'].includes(r?.app) || !at || week == null) return []
    const quota = typeof r.quota === 'string' && /^[a-z0-9.-]{0,40}$/.test(r.quota) ? r.quota : ''
    return [{ user_id: user, app: r.app, quota, at, week_percent: week, week_resets_at: time(r.week_resets_at),
      session_percent: num(r.session_percent, 100), session_resets_at: time(r.session_resets_at), cost_usd: num(r.cost_usd, 1e6),
      window_cost_usd: num(r.window_cost_usd, 1e6) }]
  })
  if (ok.length) {
    const { error } = await admin.from('limit_readings').upsert(ok, { onConflict: 'user_id,app,quota,at' })
    if (error) return json({ error: 'failed' }, 500)
  }
  return json({ saved: ok.length })
}

// What the script read from the agents' session files: one row per run, upserted by its key. Only
// for the key owner's own funnels; numbers only, nothing from the conversations.
async function saveUsage(user: string, keyId: string, body: any) {
  const rows = Array.isArray(body?.usage) ? body.usage.slice(0, 500) : null
  if (!rows) return json({ error: 'bad_body' }, 400)
  const { data: funnels, error } = await admin.from('funnels').select('id, key').eq('user_id', user)
  if (error) return json({ error: 'failed' }, 500)
  const id = new Map((funnels ?? []).map((f: any) => [f.key, f.id]))
  const num = (v: unknown, max: number) => typeof v === 'number' && isFinite(v) && v >= 0 && v <= max ? v : null
  const time = (v: unknown) => typeof v === 'string' && !isNaN(Date.parse(v)) ? new Date(v).toISOString() : null
  const str = (v: unknown, max: number) => typeof v === 'string' && v.length > 0 && v.length <= max ? v : null
  const ok = rows.flatMap((r: any) => {
    const funnel_id = id.get(r?.funnel_id), agent = str(r?.agent, 64), run_key = str(r?.run_key, 200)
    const started_at = time(r?.started_at), ended_at = time(r?.ended_at)
    if (!funnel_id || !agent || !run_key || !started_at || !ended_at || !['claude', 'codex', 'antigravity', 'grok', 'kimi'].includes(r?.app)) return []
    return [{
      user_id: user, funnel_id, agent, run_key, app: r.app, model: str(r.model, 64), started_at, ended_at,
      tokens: Math.round(num(r.tokens, 1e12) ?? 0), new_tokens: Math.round(num(r.new_tokens, 1e12) ?? 0),
      cost_usd: num(r.cost_usd, 1e6), limit_percent: num(r.limit_percent, 100),
      limit_window_minutes: num(r.limit_window_minutes, 1e6), limit_used: num(r.limit_used, 100),
      input_tokens: num(r.input_tokens, 1e12), cache_read_tokens: num(r.cache_read_tokens, 1e12),
      cache_write_tokens: num(r.cache_write_tokens, 1e12), output_tokens: num(r.output_tokens, 1e12),
      updated_at: new Date().toISOString(), wake_key_id: keyId,
    }]
  })
  // replace_from: the script sends all it read of these days, so what it sent before for them goes:
  // what this computer sent (and rows from before computers were told apart; their computer sends them again).
  const from = time(body?.replace_from)
  if (from) {
    const { error: e } = await admin.from('agent_usage').delete().eq('user_id', user).gte('ended_at', from)
      .or(`wake_key_id.eq.${keyId},wake_key_id.is.null`)
    if (e) return json({ error: 'failed' }, 500)
    // replace_apps: apps whose use is one account read alike from every computer (Grok Bot), each splitting
    // it at its own readings: what any computer sent of them since goes, so it's counted once.
    const apps = Array.isArray(body?.replace_apps) ? body.replace_apps.filter((a: unknown) => a === 'grok') : []
    if (apps.length) {
      const { error: e2 } = await admin.from('agent_usage').delete().eq('user_id', user).gte('ended_at', from).in('app', apps)
      if (e2) return json({ error: 'failed' }, 500)
    }
  }
  if (ok.length) {
    const { error: e } = await admin.from('agent_usage').upsert(ok, { onConflict: 'funnel_id,agent,run_key' })
    if (e) return json({ error: 'failed' }, 500)
  }
  return json({ saved: ok.length })
}

Deno.serve(async (req) => {
  const key = (req.headers.get('authorization') ?? '').replace(/^Bearer /, '').trim()
  if (!key) return json({ error: 'no_key' }, 401)
  const { data: owner } = await admin.from('wake_keys').select('id, user_id, computer, created_at, inventory, stopped_at').eq('key_hash', await sha256(key)).maybeSingle()
  if (!owner) return json({ error: 'bad_key' }, 401)
  const user = owner.user_id, now = Date.now(), iso = (t: number) => new Date(t).toISOString()
  // The script's version, from its User-Agent ("goalcraft-wake/2026-10-24"); older ones say "1".
  const version = /^goalcraft-wake\/([\w.-]{1,20})$/.exec(req.headers.get('user-agent') ?? '')?.[1] ?? null
  // The computer it runs on, by its name (scripts from before 18 November 2026 don't say).
  let named = req.headers.get('x-goalcraft-computer') ?? ''
  try { named = decodeURIComponent(named) } catch { /* as it came */ }
  const computer = named.replace(/[^\p{L}\p{N}\p{Zs}._'’()-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 64) || null
  // What the script says is wrong on its computer (scripts from 2026-11-18.1 on): kept as it last said.
  const problems = readProblems(req.headers.get('x-goalcraft-problems'))
  // Its system (X-Goalcraft-Os, scripts from 2026-11-21.1 on): the board greys out Open for a chat on a
  // computer with another system than the browser's.
  const os = ['mac', 'windows', 'linux'].find(o => o === req.headers.get('x-goalcraft-os')) ?? null
  await admin.from('wake_keys').update({ last_used_at: iso(now), script_version: version, problems, ...(computer ? { computer } : {}), ...(os ? { os } : {}) }).eq('id', owner.id)
  // A new key on a computer replaces the ones made there before (set up again): they go.
  if (computer && computer !== owner.computer) {
    await admin.from('wake_keys').delete().eq('user_id', user).eq('computer', computer).neq('id', owner.id).lt('created_at', owner.created_at)
  }
  const script = await published()
  // ?check=1: the script only checks its key (when it is installed); nobody is woken or marked.
  const params = new URL(req.url).searchParams
  if (params.has('check')) return json({ ok: true, script })
  // Stopped from the board: this computer wakes nobody and starts nothing until the person starts it
  // again; it still says it is there (last_used_at above) and still updates itself.
  if (owner.stopped_at) {
    if (req.method === 'POST') {
      const body = await req.json().catch(() => null)
      if (Array.isArray(body?.claim)) return json({ claimed: body.claim.map(() => false) })
      if (typeof body?.launch_claim === 'string') return json({ claimed: false })
      return json({ saved: 0, stopped: true })
    }
    return json(params.has('agents') ? { agents: [], stopped: true } : { wake: [], launches: [], stopped: true, script })
  }
  if (req.method === 'POST') {
    const body = await req.json().catch(() => null)
    if (Array.isArray(body?.claim)) return claim(user, body.claim)
    // The orchestrator (orchestrator.ts): the script took a start, finished one, or says what it can run.
    if (typeof body?.launch_claim === 'string') return json({ claimed: await claimLaunch(admin, user, owner.id, computer ?? owner.computer, body.launch_claim) })
    if (typeof body?.launch_done === 'string') { await launchDone(admin, user, body.launch_done, body.ok !== false, typeof body.note === 'string' ? body.note : null); return json({ ok: true }) }
    if (body?.inventory && typeof body.inventory === 'object') {
      const { error } = await admin.from('wake_keys').update({ inventory: body.inventory }).eq('id', owner.id)
      return error ? json({ error: 'failed' }, 500) : json({ saved: true })
    }
    return Array.isArray(body?.limits) ? saveLimits(user, body.limits) : saveUsage(user, owner.id, body)
  }
  if (params.has('agents')) {
    const { data, error } = await admin.from('presence').select('agent, chat_url, funnels (key)')
      .eq('user_id', user).gte('updated_at', iso(now - 7 * 24 * 3600e3))
    if (error) return json({ error: 'failed' }, 500)
    // Gemini agents with no chat link the script can resume: it looks for them in Google Antigravity,
    // in the conversations that mention their name and funnel. Grok agents by their bot in Grok Bot,
    // Kimi agents in the Kimi app.
    return json({ agents: (data ?? []).flatMap((p: any) => {
      const s = resumable(p) ?? grokBot(p.chat_url) ?? kimiApp(p)
      return s ? [{ agent: p.agent, funnel_id: p.funnels?.key, ...s }] : []
    }) })
  }

  const [presence, messages, answers, wakes, replies] = await Promise.all([
    admin.from('presence').select('funnel_id, agent, state, next_run_at, chat_url, updated_at, funnels (key, title)')
      .eq('user_id', user).gte('updated_at', iso(now - 7 * 24 * 3600e3)),
    admin.from('agent_messages').select('id, funnel_id, agent').eq('user_id', user)
      .is('read_at', null).is('woken_at', null).gte('sent_at', iso(now - FRESH)),
    admin.from('questions').select('id, funnel_id, agent, chat_url').eq('user_id', user)
      .not('answered_at', 'is', null).is('replied_at', null).is('woken_at', null).gte('answered_at', iso(now - FRESH)),
    admin.from('agent_wakes').select('funnel_id, agent, signal_at'),
    // An agent's reply to what another agent of its funnel wrote to it: the sender wakes to read it.
    admin.from('agent_messages').select('id, funnel_id, from_agent').eq('user_id', user).not('from_agent', 'is', null)
      .not('replied_at', 'is', null).is('reply_read_at', null).is('reply_woken_at', null).gte('replied_at', iso(now - FRESH)),
  ])
  if (presence.error || messages.error || answers.error || wakes.error || replies.error) return json({ error: 'failed' }, 500)
  const wokeAfter = new Map((wakes.data ?? []).map((w: any) => [`${w.funnel_id}|${w.agent}`, Date.parse(w.signal_at)]))

  // Agents the orchestrator starts (an executor on in their Launch) are its own: the old wake leaves them
  // alone. Every agent has Launch; one with no executor on is still woken here, in its own app's chat.
  const { data: launched } = await admin.from('role_executors').select('funnel_id, agent').eq('user_id', user).eq('enabled', true)
  const orchestrated = new Set((launched ?? []).map((r: any) => `${r.funnel_id}|${r.agent}`))
  const wake = new Map<string, any>()
  const add = (p: any, reason: string, chat: string | null, mark: (m: any) => void) => {
    if (p.state === 'pause') return false  // paused: it won't run until resumed, so nothing wakes it
    if (orchestrated.has(`${p.funnel_id}|${p.agent}`)) return false
    const s = resumable(p, chat)
    if (!s) return false
    const k = `${p.funnel_id}|${p.agent}`
    const w = wake.get(k) ?? { agent: p.agent, funnel_id: p.funnels?.key, funnel: p.funnels?.title, reasons: [], ...s,
      marks: { messages: [], answers: [], replies: [], silent: null } }
    if (!w.reasons.includes(reason)) w.reasons.push(reason)
    mark(w.marks)
    wake.set(k, w)
    return true
  }
  const at = new Map((presence.data ?? []).map((p: any) => [`${p.funnel_id}|${p.agent}`, p]))
  // At work and heard from lately: it is running and finds messages and answers itself.
  const busy = (p: any) => p.state !== 'sleep' && now - Date.parse(p.updated_at) < SILENT

  for (const m of messages.data ?? []) {
    const p = at.get(`${m.funnel_id}|${m.agent}`)
    if (p && !busy(p)) add(p, 'message', null, k => k.messages.push(m.id))
  }
  for (const q of answers.data ?? []) {
    const p = at.get(`${q.funnel_id}|${q.agent}`)
    if (p && !busy(p)) add(p, 'answer', q.chat_url, k => k.answers.push(q.id))
  }
  for (const m of replies.data ?? []) {
    const p = at.get(`${m.funnel_id}|${m.from_agent}`)
    if (p && !busy(p)) add(p, 'reply', null, k => k.replies.push(m.id))
  }
  for (const p of presence.data ?? []) {
    const overdue = p.state === 'sleep' && p.next_run_at && now - Date.parse(p.next_run_at) > SILENT
    const lost = p.state !== 'sleep' && p.state !== 'pause' && now - Date.parse(p.updated_at) > SILENT
    const already = wokeAfter.get(`${p.funnel_id}|${p.agent}`) === Date.parse(p.updated_at)
    if ((overdue || lost) && !already) add(p, overdue ? 'overdue' : 'silent', null, k => { k.silent = p.updated_at })
  }

  // ?claim=1: the script wakes only what is on its computer, and claims that first (POST claim).
  if (params.has('claim')) {
    // And the starts the orchestrator has for this computer (scripts from 2026-11-23.1 on take them).
    let launches: any[] = []
    try { launches = await dispatch(admin, user, { ...owner, computer: computer ?? owner.computer, last_used_at: iso(now), inventory: owner.inventory }) }
    catch (e) { console.error('dispatch failed:', (e as Error)?.message ?? e) }
    return json({ wake: [...wake.values()], launches, script })
  }
  // Scripts from before 18 November 2026: all is marked as listed.
  const all = [...wake.values()].map(w => ({ funnel_id: w.funnel_id, agent: w.agent, marks: w.marks }))
  await claim(user, all)
  return json({ wake: [...wake.values()].map(({ marks: _, ...w }) => w) })
})

// Mark what a script is about to wake an agent for, so no other check (or computer) wakes it again.
// Each item is claimed when at least one of its reasons was still unmarked.
async function claim(user: string, list: any[]) {
  const t = new Date().toISOString()
  const ids = (v: unknown) => Array.isArray(v) ? v.filter(x => typeof x === 'string' && /^[0-9a-f-]{36}$/.test(x)).slice(0, 200) : []
  const claimed: boolean[] = []
  for (const item of list.slice(0, 50)) {
    const m = item?.marks ?? {}
    let took = false
    const mark = async (q: any) => { const { data } = await q.select('id'); if (data?.length) took = true }
    const msgs = ids(m.messages), answers = ids(m.answers), replies = ids(m.replies)
    if (msgs.length) await mark(admin.from('agent_messages').update({ woken_at: t }).eq('user_id', user).in('id', msgs).is('woken_at', null))
    if (answers.length) await mark(admin.from('questions').update({ woken_at: t }).eq('user_id', user).in('id', answers).is('woken_at', null))
    if (replies.length) await mark(admin.from('agent_messages').update({ reply_woken_at: t }).eq('user_id', user).in('id', replies).is('reply_woken_at', null))
    if (typeof m.silent === 'string' && !isNaN(Date.parse(m.silent)) && typeof item.funnel_id === 'string' && typeof item.agent === 'string') {
      const { data: f } = await admin.from('funnels').select('id').eq('user_id', user).eq('key', item.funnel_id).maybeSingle()
      if (f) {
        const { data: w } = await admin.from('agent_wakes').select('signal_at').eq('funnel_id', f.id).eq('agent', item.agent).maybeSingle()
        if (!w || Date.parse(w.signal_at) !== Date.parse(m.silent)) {
          const { error } = await admin.from('agent_wakes').upsert({ funnel_id: f.id, agent: item.agent, signal_at: m.silent, woken_at: t }, { onConflict: 'funnel_id,agent' })
          if (!error) took = true
        }
      }
    }
    claimed.push(took)
  }
  return json({ claimed })
}
