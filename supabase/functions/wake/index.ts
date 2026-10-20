// The wake script's endpoint (wake/goalcraft-wake.py): which of the person's agents to wake now. The
// script asks every few seconds with the person's wake key and resumes each agent's own conversation
// on their computer (a Claude app session or a Codex thread) with a short note to check Goalcraft.
//
//   GET /wake   Authorization: Bearer <wake key>   → { wake: [{ agent, funnel_id, funnel, reasons, app, session }] }
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

Deno.serve(async (req) => {
  const key = (req.headers.get('authorization') ?? '').replace(/^Bearer /, '').trim()
  if (!key) return json({ error: 'no_key' }, 401)
  const { data: owner } = await admin.from('wake_keys').select('user_id').eq('key_hash', await sha256(key)).maybeSingle()
  if (!owner) return json({ error: 'bad_key' }, 401)
  const user = owner.user_id, now = Date.now(), iso = (t: number) => new Date(t).toISOString()
  await admin.from('wake_keys').update({ last_used_at: iso(now) }).eq('user_id', user)
  // ?check=1: the script only checks its key (when it is installed); nobody is woken or marked.
  if (new URL(req.url).searchParams.has('check')) return json({ ok: true })

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
    const s = session(chat ?? p.chat_url)
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
    const lost = p.state !== 'sleep' && now - Date.parse(p.updated_at) > SILENT
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
