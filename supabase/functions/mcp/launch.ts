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
  const { data } = await admin.from('role_launch').select('schedule, schedule_on, time_zone').eq('funnel_id', funnelId).eq('agent', agent).maybeSingle()
  return data ?? null
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

// The run is over (sleep, pause, the agent left): its start ends as done.
export async function endLaunches(admin: Db, funnelId: string, agent: string) {
  await admin.from('role_launches').update({ ended_at: new Date().toISOString(), outcome: 'done' })
    .eq('funnel_id', funnelId).eq('agent', agent).not('started_at', 'is', null).is('ended_at', null)
}
