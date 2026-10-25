// The wake script's endpoint (wake/goalcraft-wake.py): which of the person's agents to wake now. The
// script asks every few seconds with the person's wake key and resumes each agent's own conversation
// on their computer (a Claude app session or a Codex thread) with a short note to check Goalcraft.
//
//   GET /wake   Authorization: Bearer <wake key>   → { wake: [{ agent, funnel_id, funnel, reasons, app, session }] }
//   GET /wake?agents=1   → { agents: [{ agent, funnel_id, app, session }] }: the agents on this computer whose
//                          token use the script reads (nobody is woken or marked)
//   POST /wake { usage: [{ funnel_id, agent, run_key, app, model, started_at, ended_at, tokens, new_tokens,
//                input_tokens, cache_read_tokens, cache_write_tokens, output_tokens, cost_usd,
//                limit_percent, limit_used, limit_window_minutes }], replace_from? }   → { saved }: what their runs
//                used; replace_from drops what was sent before for runs that ended since then
//   POST /wake { limits: [{ app: "claude" | "antigravity", quota?, at, week_percent, week_resets_at?, session_percent?, session_resets_at?,
//                cost_usd? }] }   → { saved }: the plan's limit as the script read it, with what every local
//                session of that app cost since the reading before (the board turns cost into a share of it)
//
// An agent is woken once for each reason: a message it has not read (from the person, or for a
// worker from its supervisor), an answer to its question while it sleeps, for a supervisor a worker's
// reply to its message, or a silence (it missed its run, or stopped signalling at work) since
// its last signal. An agent at work that signalled lately is left alone: it reads messages on its
// heartbeat and takes answers while it waits. Only agents whose chat is a link the script can resume
// are listed; each listing marks what it wakes for, so the next one does not repeat it.
import { createClient } from 'npm:@supabase/supabase-js@2.117.2'

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

// What the script resumes for an agent: its Claude or Codex session, or for a Gemini agent with no
// such link, its conversation in Google Antigravity (the script finds it by the agent's name and funnel).
function resumable(p: any, chat: string | null = null): { app: string, session: string | null } | null {
  return session(chat ?? p.chat_url)
    ?? ((!p.chat_url || /^antigravity:/i.test(p.chat_url)) && /^gemini/i.test(p.agent) ? { app: 'antigravity', session: null } : null)
}

// The plan's limit as the script read it: numbers only, one row per reading.
async function saveLimits(user: string, list: any[]) {
  const num = (v: unknown, max: number) => typeof v === 'number' && isFinite(v) && v >= 0 && v <= max ? v : null
  const time = (v: unknown) => typeof v === 'string' && !isNaN(Date.parse(v)) ? new Date(v).toISOString() : null
  const ok = list.slice(0, 50).flatMap((r: any) => {
    const at = time(r?.at), week = num(r?.week_percent, 100)
    if (!['claude', 'antigravity'].includes(r?.app) || !at || week == null) return []
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
async function saveUsage(user: string, body: any) {
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
    if (!funnel_id || !agent || !run_key || !started_at || !ended_at || !['claude', 'codex', 'antigravity'].includes(r?.app)) return []
    return [{
      user_id: user, funnel_id, agent, run_key, app: r.app, model: str(r.model, 64), started_at, ended_at,
      tokens: Math.round(num(r.tokens, 1e12) ?? 0), new_tokens: Math.round(num(r.new_tokens, 1e12) ?? 0),
      cost_usd: num(r.cost_usd, 1e6), limit_percent: num(r.limit_percent, 100),
      limit_window_minutes: num(r.limit_window_minutes, 1e6), limit_used: num(r.limit_used, 100),
      input_tokens: num(r.input_tokens, 1e12), cache_read_tokens: num(r.cache_read_tokens, 1e12),
      cache_write_tokens: num(r.cache_write_tokens, 1e12), output_tokens: num(r.output_tokens, 1e12),
      updated_at: new Date().toISOString(),
    }]
  })
  // replace_from: the script sends all it read of these days, so what it sent before for them goes.
  const from = time(body?.replace_from)
  if (from) {
    const { error: e } = await admin.from('agent_usage').delete().eq('user_id', user).gte('ended_at', from)
    if (e) return json({ error: 'failed' }, 500)
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
  const { data: owner } = await admin.from('wake_keys').select('user_id').eq('key_hash', await sha256(key)).maybeSingle()
  if (!owner) return json({ error: 'bad_key' }, 401)
  const user = owner.user_id, now = Date.now(), iso = (t: number) => new Date(t).toISOString()
  // The script's version, from its User-Agent ("goalcraft-wake/2026-10-24"); older ones say "1".
  const version = /^goalcraft-wake\/([\w.-]{1,20})$/.exec(req.headers.get('user-agent') ?? '')?.[1] ?? null
  await admin.from('wake_keys').update({ last_used_at: iso(now), script_version: version }).eq('user_id', user)
  // ?check=1: the script only checks its key (when it is installed); nobody is woken or marked.
  const params = new URL(req.url).searchParams
  if (params.has('check')) return json({ ok: true })
  if (req.method === 'POST') {
    const body = await req.json().catch(() => null)
    return Array.isArray(body?.limits) ? saveLimits(user, body.limits) : saveUsage(user, body)
  }
  if (params.has('agents')) {
    const { data, error } = await admin.from('presence').select('agent, chat_url, funnels (key)')
      .eq('user_id', user).gte('updated_at', iso(now - 7 * 24 * 3600e3))
    if (error) return json({ error: 'failed' }, 500)
    // Gemini agents with no chat link the script can resume: it looks for them in Google Antigravity,
    // in the conversations that mention their name and funnel.
    return json({ agents: (data ?? []).flatMap((p: any) => {
      const s = resumable(p)
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
    // A worker's reply to what the supervisor wrote to it: the supervisor wakes to read it.
    admin.from('agent_messages').select('id, funnel_id, from_agent').eq('user_id', user).not('from_agent', 'is', null)
      .not('replied_at', 'is', null).is('reply_read_at', null).is('reply_woken_at', null).gte('replied_at', iso(now - FRESH)),
  ])
  if (presence.error || messages.error || answers.error || wakes.error || replies.error) return json({ error: 'failed' }, 500)
  const wokeAfter = new Map((wakes.data ?? []).map((w: any) => [`${w.funnel_id}|${w.agent}`, Date.parse(w.signal_at)]))

  const wake = new Map<string, any>()
  const add = (p: any, reason: string, chat: string | null) => {
    if (p.state === 'pause') return false  // paused: it won't run until resumed, so nothing wakes it
    const s = resumable(p, chat)
    if (!s) return false
    const k = `${p.funnel_id}|${p.agent}`
    const w = wake.get(k) ?? { agent: p.agent, funnel_id: p.funnels?.key, funnel: p.funnels?.title, reasons: [], ...s }
    if (!w.reasons.includes(reason)) w.reasons.push(reason)
    wake.set(k, w)
    return true
  }
  const at = new Map((presence.data ?? []).map((p: any) => [`${p.funnel_id}|${p.agent}`, p]))
  // At work and heard from lately: it is running and finds messages and answers itself.
  const busy = (p: any) => p.state !== 'sleep' && now - Date.parse(p.updated_at) < SILENT
  const woke = { messages: [] as string[], answers: [] as string[], replies: [] as string[], silent: [] as any[] }

  for (const m of messages.data ?? []) {
    const p = at.get(`${m.funnel_id}|${m.agent}`)
    if (p && !busy(p) && add(p, 'message', null)) woke.messages.push(m.id)
  }
  for (const q of answers.data ?? []) {
    const p = at.get(`${q.funnel_id}|${q.agent}`)
    if (p && !busy(p) && add(p, 'answer', q.chat_url)) woke.answers.push(q.id)
  }
  for (const m of replies.data ?? []) {
    const p = at.get(`${m.funnel_id}|${m.from_agent}`)
    if (p && !busy(p) && add(p, 'reply', null)) woke.replies.push(m.id)
  }
  for (const p of presence.data ?? []) {
    const overdue = p.state === 'sleep' && p.next_run_at && now - Date.parse(p.next_run_at) > SILENT
    const lost = p.state !== 'sleep' && p.state !== 'pause' && now - Date.parse(p.updated_at) > SILENT
    const already = wokeAfter.get(`${p.funnel_id}|${p.agent}`) === Date.parse(p.updated_at)
    if ((overdue || lost) && !already && add(p, overdue ? 'overdue' : 'silent', null)) woke.silent.push(p)
  }

  const t = iso(now)
  if (woke.messages.length) await admin.from('agent_messages').update({ woken_at: t }).in('id', woke.messages)
  if (woke.answers.length) await admin.from('questions').update({ woken_at: t }).in('id', woke.answers)
  if (woke.replies.length) await admin.from('agent_messages').update({ reply_woken_at: t }).in('id', woke.replies)
  if (woke.silent.length) await admin.from('agent_wakes').upsert(
    woke.silent.map(p => ({ funnel_id: p.funnel_id, agent: p.agent, signal_at: p.updated_at, woken_at: t })), { onConflict: 'funnel_id,agent' })
  return json({ wake: [...wake.values()] })
})
