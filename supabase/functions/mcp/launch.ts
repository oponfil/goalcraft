// What set_agent_state means for a role the orchestrator starts (see supabase/functions/wake/orchestrator.ts):
// work begins the start the wake script took for it, sleep and pause end it; with a schedule the role
// wakes on it, not when its agent says, and without one an agent that names no time goes on pause.
import cronParser from 'npm:cron-parser@4.9.0'

type Db = any

export function cronNext(expr: string, tz: string, at = new Date()): string | null {
  try { return cronParser.parseExpression(expr, { currentDate: at, tz }).next().toDate().toISOString() } catch { return null }
}

// The role's launch settings, or null for an agent the orchestrator doesn't start.
export async function roleOf(admin: Db, funnelId: string, agent: string) {
  // Every agent has Launch; it is a role Goalcraft starts only with an executor on.
  const [{ data }, { count }] = await Promise.all([
    admin.from('role_launch').select('schedule, schedule_on, time_zone').eq('funnel_id', funnelId).eq('agent', agent).maybeSingle(),
    admin.from('role_executors').select('agent', { count: 'exact', head: true }).eq('funnel_id', funnelId).eq('agent', agent).eq('enabled', true),
  ])
  return data && count ? data : null
}

// The agent begins a run: the start a script took for it and the agent has not begun yet is this one.
export async function beginLaunch(admin: Db, funnelId: string, agent: string, runId: number | null) {
  const { data } = await admin.from('role_launches').select('id, app, model').eq('funnel_id', funnelId).eq('agent', agent)
    .not('claimed_at', 'is', null).is('started_at', null).is('ended_at', null).order('claimed_at', { ascending: false }).limit(1)
  const l = data?.[0]
  if (!l) return
  await admin.from('role_launches').update({ started_at: new Date().toISOString(), ...(runId != null && { run_id: runId }) }).eq('id', l.id)
  if (runId != null) await admin.from('agent_runs').update({ app: l.app, model: l.model, launch_id: l.id }).eq('id', runId)
}

// Which app the role's start now going runs on (begun, not ended), if Goalcraft started it.
export const LAUNCH_PROVIDER: Record<string, string> = { claude: 'claude', codex: 'chatgpt', antigravity: 'gemini', grok: 'grok' }
export async function launchedApp(admin: Db, funnelId: string, agent: string): Promise<string | null> {
  const { data } = await admin.from('role_launches').select('app').eq('funnel_id', funnelId).eq('agent', agent)
    .not('started_at', 'is', null).is('ended_at', null).order('started_at', { ascending: false }).limit(1)
  return data?.[0]?.app ?? null
}

// A Claude run Goalcraft started from the command line is not in the Claude app until its resume link
// (claude://resume?session=<id>) brings it in, once; after that the app knows it as local_<id>, and the
// board, having opened the resume link, keeps that link instead. Its agent may send either (or the app's
// link it makes from its session itself, as the instructions say for the app's own runs): until the board
// has opened it, the link is the resume one, so "Open" finds the conversation.
const CLAUDE_RUN_CHAT = /^claude:\/\/(?:claude\.ai\/epitaxy\/local_|resume\?session=)([0-9a-f-]{36})$/
export async function claudeRunChat(db: Db, funnelId: string, agent: string, sent: string | undefined) {
  const id = sent && CLAUDE_RUN_CHAT.exec(sent)?.[1]
  if (!id) return sent
  const opened = `claude://claude.ai/epitaxy/local_${id}`
  const { data } = await db.from('presence').select('chat_url').eq('funnel_id', funnelId).eq('agent', agent).maybeSingle()
  return data?.chat_url === opened ? opened : `claude://resume?session=${id}`
}

// The computer a chat of the agent is on, when Goalcraft started the run worked in it (its start says).
export async function chatComputer(admin: Db, funnelId: string, agent: string, chat: string | null | undefined): Promise<string | null> {
  if (!chat) return null
  const { data } = await admin.from('agent_runs').select('launch:role_launches!agent_runs_launch_id_fkey (computer)')
    .eq('funnel_id', funnelId).eq('agent', agent).eq('chat_url', chat).not('launch_id', 'is', null)
    .order('started_at', { ascending: false }).limit(1)
  const known = (data?.[0] as any)?.launch?.computer
  if (known) return known
  // Asked before its run named the chat: the start now going.
  const { data: now } = await admin.from('role_launches').select('computer').eq('funnel_id', funnelId).eq('agent', agent)
    .not('started_at', 'is', null).is('ended_at', null).order('started_at', { ascending: false }).limit(1)
  return now?.[0]?.computer ?? null
}

// The run is over (sleep, pause, the agent left): its start ends as done.
export async function endLaunches(admin: Db, funnelId: string, agent: string) {
  await admin.from('role_launches').update({ ended_at: new Date().toISOString(), outcome: 'done' })
    .eq('funnel_id', funnelId).eq('agent', agent).not('started_at', 'is', null).is('ended_at', null)
}
