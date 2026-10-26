// Goalcraft MCP server: agents create goal funnels and report progress; the person watches it on
// goalcraft.ai. Streamable HTTP, OAuth 2.1 through Supabase Auth. Every query runs as the
// signed-in person, so row-level security keeps each person's data their own.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { createMcpHandler, McpServer } from 'npm:@modelcontextprotocol/server@2.2.0'
import { pipeline } from 'npm:@supabase/middleware@1.0.0'
import { withOAuthProtectedResource, withSupabase } from 'npm:@supabase/server@1.9.0'
import { z } from 'npm:zod@4.6.5'
import { emailQuestion } from './notify.ts'

type Db = any // the Supabase client scoped to the caller
// Who is calling, and an admin client to read their current settings (for question emails). chat:
// the link to the conversation the call came from, when the agent's app says which one it is.
type Caller = { id: string, admin: Db, chat?: string }

const THEMES = ['mine', 'lab', 'garden', 'love', 'code', 'money', 'forge', 'bakery', 'blocks'] as const
const forms = z.array(z.string().min(1).max(40)).min(1).max(3)
const funnelId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/).describe('Funnel id, e.g. "job-search"')
const agent = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,31}$/)
  .describe('Who you are: claude, chatgpt, grok, gemini, deepseek, kimi, qwen, mistral, perplexity, hermes, or another lowercase name. Several agents of one kind in a funnel add a suffix: claude-search, claude-apply (shown as Claude with its logo)')

// The wake script's latest version: the VERSION line of the file on goalcraft.ai, read at most hourly.
let wakeLatest: { at: number, version: string | null } | null = null
async function latestWake() {
  if (wakeLatest && Date.now() - wakeLatest.at < 3600e3) return wakeLatest.version
  let version: string | null = wakeLatest?.version ?? null
  try {
    const r = await fetch('https://goalcraft.ai/wake/goalcraft-wake.py', { signal: AbortSignal.timeout(5000) })
    if (r.ok) version = /^VERSION = '([\w.-]+)'/m.exec(await r.text())?.[1] ?? null
  } catch { /* keep what was known */ }
  wakeLatest = { at: Date.now(), version }
  return version
}

const INSTRUCTIONS = `Goalcraft shows the person their goals as funnels and the agents working them.
A funnel is one goal (e.g. "Job Search") with 2-5 stages top to bottom (jobs found → applied → interview → final round) and a result at the bottom (offer); its goal is how many results by when (goal_total by goal_due).
Zones: 0 is the inflow above the first stage, zone k moves stage k-1 into stage k, zone n (below the last stage) turns the last stage into results. At most two agents per zone on Pro, one on the free plan.
Heartbeat: set_agent_state(work) is your sign of life. Send it first thing when you wake up and again every 5 minutes while you work. The dashboard waits twice that, 10 minutes of silence, then warns the person that you did not wake up (10 minutes past your next_run_at) or that it lost contact with you (10 minutes after your last signal).
Your chat: the dashboard's "Open" button by you leads to the conversation you work in, so the person can answer you there. Send its link as chat_url with set_agent_state on every run (a scheduled run is a new conversation). In the Claude app (Claude Code or a scheduled task), the environment variable CLAUDE_CODE_HOST_SESSION_ID holds your session id (local_…): chat_url is claude://claude.ai/epitaxy/ followed by it. In a web chat, send its address when you can see it (https://claude.ai/chat/…, https://chatgpt.com/c/…). Codex sends its thread itself; you need not. In Google Antigravity send none: the dashboard opens Antigravity. In Grok Bot, chat_url is grokbot://app/v1/agent?id= followed by your bot's id, the folder your store is in (/home/box/sand-data/agents/<id>/).
On every run: first thing, before any other work, set_agent_state(work) in your zone (this starts the run's counter, shown by you on the dashboard), then every 5 minutes again while you work; after progress report_counts (and add_result when a result appears); if you need the person, set_agent_state(ask, question) and poll get_answer (a question is as short as you can make it, at most 400 characters: only what the person needs to understand it and decide): while you are in ask the person sees you waiting and expects you to take the answer at once. If you go to sleep before it comes, the question stays on the dashboard and the person is told you will pick the answer up on your next run, so call get_answer then. Whenever you get an answer, reply to it in one short line with reply (what you do next). A reply never asks the person for anything: if you need more from them, or can't do what was agreed and need them to act (sign in somewhere, send something themselves, decide again), ask a new question instead (set_agent_state ask), saying plainly what happened and exactly what to do, where. If the person answers you somewhere else instead (in your chat), call close_question so the dashboard stops showing the question; at the end set_agent_state(sleep, next_run_at) or clear_agent.
Pause: when the person asks you to stop for a while, or your plan's limit has run out so you can't work until it resets, set_agent_state(pause, reason) (and turn off your schedule if the person asked you to stop). The dashboard sits you on a chair with a pause sign, raises no warning for your silence and nothing wakes you. Any set_agent_state(work) or (sleep) resumes you. A supervisor pauses or resumes a worker of its funnel when the person tells it to, with the worker's name and zone.
Supervisor: one agent per funnel may stand over the whole funnel instead of working a zone, on the platform at its top: the person's own agent that checks the funnel, finds the bottleneck and answers their questions about it. It takes the place with set_agent_state(zone "supervisor") and names itself after its funnel in the person's language (name, e.g. "Супервайзер поиска работы", "Job Search supervisor"), and follows the same heartbeat, questions and sleep. It adds no items; instead each run ends with what it found: status (ok, bottleneck, recommendation) and summary (one short line), given with set_agent_state, shown by it on the dashboard and kept in its run history. When it needs the person, it asks as every agent does: state ask with a question. It also keeps an eye on the person's tasks for the funnel (set_tasks), most urgent first, without what is done or no longer matters.
The person's tasks: the things only the person can do for a funnel (take a test task, fill in a form, answer a recruiter), shown to them on the dashboard. Every agent of the funnel, supervisor or worker, sees the same list (list_funnels tasks) and changes it the same way with set_tasks: adds a task when the person asks or when there is something only they can do, marks what is done, keeps the order. What an agent can't go on without is a question, not a task: never both. The place holds one agent; if your name already works a zone of this funnel, add a suffix (claude-supervisor).
Messages: the person can write to you from your card on the dashboard at any time, not only answer your questions, and a funnel's supervisor can write to its workers (send_message). On every run, after set_agent_state(work), call get_messages with your agent name (its answer to set_agent_state also says how many wait for you: new_messages); read them, do what they ask, and reply to each in one short line with reply(message_id). The person may run a script that wakes your conversation when a message or an answer comes, or when you missed your run: then you get a short note to check Goalcraft; do so as above. An agent on the person's own computer (Claude Code, Codex) may offer to set that script up: with the person's OK it calls create_wake_key and runs the install command it returns. The script never updates itself; list_funnels shows it as wake_script. When a supervisor sees update_available, or running false for a script that was set up, it tells the person once (not on every run): on their computer it asks whether to update and, on yes, runs wake_script.update; elsewhere it adds a task for them (set_tasks) with that command.
Your name: the dashboard and emails show you by your model's name (Claude, ChatGPT…) unless you give your own short name with set_agent_state(name); give one when the person asks you to rename yourself.
Delete a funnel (delete_funnel) only when the person asks for it.
Plans: free has up to 3 funnels with up to 3 stages each and one agent per zone; Pro has up to 10 funnels with up to 5 stages each and two agents per zone. list_funnels tells which plan the person has.
Report only counts, dates and links: the items themselves stay in the person's own sources.
The funnel's guide: one document with everything about the funnel for its supervisor and workers (the goal, the stages, where the list is, how to work each stage and how to report). The supervisor keeps it where the person chose, asking them which service to use for the list and the notes (best one service for both, such as Google Sheets and Docs, or Notion, so one connector reads both; if it has no access, it asks the person to connect it), and gives its link as guide_url. When a funnel has a guide_url, read it at the start of every run: it is how this funnel works. The dashboard shows it as a document on the platform at the top of the funnel and opens it on click.
Link to the list: whenever the funnel's items are kept in a table or list that opens by a URL (Google Sheets, Notion, Airtable, a GitHub file…), give that URL as the funnel's source_url (in upsert_funnel or report_counts) — the dashboard shows it as a sheet on top of the funnel and opens it on click. One link per funnel. Keep the list where a link can open it when you can. If it only exists on your machine or you have no such place, leave source_url empty and say so to the person; it is optional.`

// Tool inputs are strict: a field a tool doesn't take (say, from an agent that remembers an older
// version of the tools) is an error that sends the agent back to the current descriptions.
const BAD_REQUEST = 'Invalid request: it has fields this tool does not take. The tools may have changed since you loaded them: read the current tool descriptions and server instructions, then send the request again in that form.'
const req = <T extends z.ZodRawShape>(shape: T) => z.strictObject(shape, { error: BAD_REQUEST })

const text = (v: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(v, null, 1) }] })
const fail = (msg: string) => { throw new Error(msg) }
const check = <T>({ data, error }: { data: T; error: { message: string } | null }) => {
  if (error) fail(error.message)
  return data
}

async function funnelRow(db: Db, key: string) {
  const row = check(await db.from('funnels').select('id, key').eq('key', key).maybeSingle())
  return row ?? fail(`No funnel "${key}". Call list_funnels to see the ids, or upsert_funnel to create it.`)
}

// The count an agent in this zone works into: the stage its zone feeds, or the results below the last stage.
async function zoneTargets(db: Db, funnelId: string) {
  const stages = check(await db.from('stages').select('position, count').eq('funnel_id', funnelId).order('position')) as { count: number }[]
  const { results } = check(await db.from('funnels').select('results').eq('id', funnelId).single()) as { results: number }
  return (zone: number) => Number(zone < stages.length ? stages[zone].count : results)
}

// After counts change: each agent at work (or asking) has added what its count grew since its run began.
async function updateRuns(db: Db, funnelId: string) {
  const target = await zoneTargets(db, funnelId)
  const agents = check(await db.from('presence').select('agent, zone, state, run_base, run_added, run_manual')
    .eq('funnel_id', funnelId)) as any[]
  for (const p of agents) {
    if (p.state === 'sleep' || p.run_manual || p.run_base == null) continue
    const added = Math.max(0, Math.round(target(p.zone) - Number(p.run_base)))
    if (added === p.run_added) continue
    check(await db.from('presence').update({ run_added: added }).eq('funnel_id', funnelId).eq('agent', p.agent))
    check(await openRun(db, funnelId, p.agent).update({ added }))
  }
}

// The agent's run in progress in agent_runs (the history in its card), as a filter to update.
const openRun = (db: Db, funnelId: string, agent: string) => ({
  update: (patch: Record<string, unknown>) =>
    db.from('agent_runs').update(patch).eq('funnel_id', funnelId).eq('agent', agent).is('ended_at', null),
})
const endRun = (db: Db, funnelId: string, agent: string) => openRun(db, funnelId, agent).update({ ended_at: new Date().toISOString() })

// What the person sees, in the shape the tools take.
async function funnels(db: Db, key?: string) {
  let q = db.from('funnels')
    .select(`key, title, theme, source_url, guide_url, result, goal_total, goal_due, results, output_flow_per_day, updated_at,
      stages (key, position, label, count, fill_percent, flow_per_day),
      presence (agent, display_name, zone, state, next_run_at, chat_url, question_id, run_added, status, summary, pause_reason, updated_at),
      questions (id, agent, question, answer, asked_at, answered_at, chat_url, replied_at),
      agent_messages (id, agent, text, sent_at, read_at),
      person_tasks (id, position, title, detail, url, due_at, done_at)`)
    .order('created_at')
  if (key) q = q.eq('key', key)
  const rows = check(await q) as any[]
  return rows.map(f => ({
    id: f.key,
    title: f.title,
    theme: f.theme,
    source_url: f.source_url,
    guide_url: f.guide_url,
    result: f.result,
    goal: { total: f.goal_total, due: f.goal_due },
    results: f.results,
    stages: f.stages.sort((a: any, b: any) => a.position - b.position)
      .map(({ key, label, count, fill_percent, flow_per_day }: any) => ({ key, label, count, fill_percent, flow_per_day })),
    output_flow_per_day: f.output_flow_per_day,
    agents: f.presence.filter((p: any) => p.zone != null).map(({ status, summary, ...p }: any) => p),
    // The agent on the platform over the whole funnel, with what its last run found.
    supervisor: f.presence.filter((p: any) => p.zone == null).map(({ zone, run_added, ...p }: any) => p)[0] ?? null,
    open_questions: f.questions.filter((q: any) => !q.answered_at),
    // Answered but not replied to yet: the agent owes the person a short reply.
    // What the person wrote to agents and they have not read yet (get_messages reads them).
    unread_messages: f.agent_messages.filter((m: any) => !m.read_at).map(({ id, agent, text, sent_at }: any) => ({ id, agent, text, sent_at })),
    answers_to_reply: f.questions.filter((q: any) => q.answered_at && !q.replied_at).map(({ id, agent, question, answer, answered_at }: any) => ({ id, agent, question, answer, answered_at })),
    // The person's tasks for this funnel, most urgent first, as its supervisor keeps them (set_tasks).
    tasks: openTasks(f.person_tasks),
  }))
}
const one = async (db: Db, key: string) => (await funnels(db, key))[0]
const openTasks = (rows: any[]) => rows.filter(t => !t.done_at).sort((a, b) => a.position - b.position)
  .map(({ id, title, detail, url, due_at }: any) => ({ id, title, detail, url, due_at }))

// Free: 3 funnels of up to 3 stages, one agent per zone. Pro: 10 funnels of up to 5 stages, two agents per zone
// (Pro is paid through Creem; see supabase/functions/billing).
async function plan(db: Db) {
  // The plan the limits use: Pro only while it is paid for (or granted) up to now.
  const name = (check(await db.rpc('my_plan')) as string | null) ?? 'free'
  return { plan: name, max_funnels: name === 'pro' ? 10 : 3, max_stages: name === 'pro' ? 5 : 3, max_agents_per_zone: name === 'pro' ? 2 : 1 }
}

// Emails the person about a new question if they asked for it, after the reply has gone out to the
// agent. Settings are read fresh: the checkbox may have changed since the agent's token was issued.
function notify(caller: Caller, funnelId: string, agent: string, question: string, name?: string | null) {
  const send = async () => {
    const { data: { user } } = await caller.admin.auth.admin.getUserById(caller.id)
    if (!user?.email || !user.user_metadata?.notify_email) return
    const { data: f } = await caller.admin.from('funnels').select('title').eq('id', funnelId).single()
    await emailQuestion(user.email, user.user_metadata.lang, agent, f?.title ?? '', question, name)
  }
  const job = send().catch(e => console.error('question email failed:', e?.message ?? e))
  ;(globalThis as any).EdgeRuntime?.waitUntil?.(job)
}

function server(db: Db, caller: Caller) {
  const s = new McpServer({
    name: 'goalcraft',
    title: 'Goalcraft',
    version: '0.1.0',
    websiteUrl: 'https://goalcraft.ai',
    icons: [
      // PNG first: some clients don't show SVG icons.
      { src: 'https://goalcraft.ai/apple-touch-icon.png', mimeType: 'image/png', sizes: ['180x180'] },
      { src: 'https://goalcraft.ai/favicon.png', mimeType: 'image/png', sizes: ['32x32'] },
      { src: 'https://goalcraft.ai/favicon.svg', mimeType: 'image/svg+xml', sizes: ['any'] },
    ],
  }, { instructions: INSTRUCTIONS })

  // The person's wake script, if they have one: its version (it says it with every request), the
  // latest on goalcraft.ai, whether it runs, and how to update it. It never updates itself.
  async function wakeScript() {
    const { data } = await db.from('wake_keys').select('script_version, last_used_at').maybeSingle()
    if (!data) return null
    const latest = await latestWake()
    const seen = data.last_used_at ? Date.parse(data.last_used_at) : null
    return {
      version: data.script_version, latest,
      running: seen != null && Date.now() - seen < 5 * 60e3, last_seen_at: data.last_used_at,
      // Versions are dates (2026-10-24), so they compare as text; the oldest scripts say "1".
      update_available: !!latest && (data.script_version ?? '') < latest,
      update: 'curl -fsSL https://goalcraft.ai/wake/goalcraft-wake.py -o ~/.goalcraft/goalcraft-wake.py && launchctl kickstart -k gui/$(id -u)/ai.goalcraft.wake',
    }
  }

  s.registerTool('list_funnels', {
    title: 'List funnels',
    description: 'The person\'s plan with its limits, their wake script if they set one up (wake_script: its version, the latest, whether it runs, the update command), and their goal funnels: stages with counts, results, goal, agents present, open questions, and answers you still owe a short reply to (answers_to_reply).',
    inputSchema: req({}),
    annotations: { title: 'List funnels', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async () => text({ ...(await plan(db)), wake_script: await wakeScript(), funnels: await funnels(db) }))

  s.registerTool('upsert_funnel', {
    title: 'Create or update a funnel',
    description: 'Create a goal funnel or change its title, result name, goal, theme or stages. Stages keep their counts by key; stages left out are removed. Free plan: up to 3 funnels of up to 3 stages; Pro: up to 10 funnels of up to 5 stages.',
    inputSchema: req({
      id: funnelId,
      title: z.string().min(1).max(60).describe('Column title, e.g. "Job Search"'),
      result: forms.describe('Name of one result: [singular, plural], e.g. ["offer", "offers"]; Russian: [1, 2-4, 5+]; Spanish, Portuguese: [singular, plural]; Chinese, Japanese, Korean, Thai, Vietnamese, Turkish and other languages without plural forms after a number: one form'),
      goal_total: z.number().int().min(1).max(100).describe('How many results the goal needs (1-100)'),
      goal_due: z.string().refine(v => !isNaN(Date.parse(v)), 'an ISO date or date-time').optional().describe('By when the goal should be reached, as the person said it: a date-time with their UTC offset, e.g. "2026-12-31T18:00:00+07:00", or a date, e.g. "2026-12-31" (the end of that day in UTC). The dashboard counts down to it. Leaving it out keeps the one set before'),
      goal_every_days: z.number().positive().max(3650).optional().describe('Old way to set the goal, as a pace (one result every N days): only when no goal_due is given and the funnel has no date yet; the date then becomes now plus the results still missing at that pace'),
      source_url: z.string().url().regex(/^https?:\/\//).nullable().optional().describe('Link to the table or list with this funnel\'s items (Google Sheet, Notion, Airtable…). Give it whenever the list opens by a URL; null removes it, leaving it out keeps it'),
      guide_url: z.string().url().regex(/^https?:\/\//).nullable().optional().describe('Link to the funnel\'s guide: one document with everything its supervisor and workers need to know (the goal, the stages, where the list is, how to work and report). Keep it where the person chose, best in the same service as the list (a Google Doc with a Google Sheet), so one connector reads both. null removes it, leaving it out keeps it'),
      theme: z.enum(THEMES).optional().describe('Look: mine (miners, ore), lab (chemists, flasks), garden (gardeners, flowers), love (cupids, hearts), code (hackers, chips), money (bankers, coins, banknotes, gold bars, bitcoins), forge (smiths, ingots, swords, shields, crowns), bakery (bakers, bread, pizza, croissants, doughnuts, pastries), blocks (block-headed heroes in diamond armour with swords, blocks, diamonds). Default mine'),
      stages: z.array(req({
        key: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/).describe('Stable key, e.g. "applied"'),
        label: forms.describe('[singular, plural], e.g. ["interview", "interviews"]; Russian: [1, 2-4, 5+]; Spanish, Portuguese: [singular, plural]; Chinese, Japanese, Korean, Thai, Vietnamese, Turkish: one form'),
      })).min(2).max(5).describe('Stages top to bottom'),
    }),
    annotations: { title: 'Create or update a funnel', readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  }, async (a) => {
    const keys = a.stages.map(st => st.key)
    if (new Set(keys).size !== keys.length) fail('Stage keys must be unique')
    const p = await plan(db)
    // Over the plan's stage limit (say, after a downgrade to Free) a funnel keeps the stages it has;
    // only adding one is refused.
    if (a.stages.length > p.max_stages) {
      const { data: have } = await db.from('funnels').select('stages(key)').eq('key', a.id).maybeSingle()
      const known = new Set(((have as any)?.stages ?? []).map((s: { key: string }) => s.key))
      if (keys.some(k => !known.has(k))) fail(`The ${p.plan} plan has up to ${p.max_stages} stages per funnel. Merge some stages, or the person can upgrade to Pro for up to 5.`)
    }
    // The goal's date: as given (a bare date is the end of that day, UTC), or from the old pace.
    let due: string | undefined
    if (a.goal_due) due = new Date(/^\d{4}-\d{2}-\d{2}$/.test(a.goal_due) ? a.goal_due + 'T23:59:59Z' : a.goal_due).toISOString()
    else if (a.goal_every_days) {
      // Only for a funnel with no date yet: an agent sending its old pace every run would otherwise
      // move the date on each time.
      const { data: had } = await db.from('funnels').select('results, goal_due').eq('key', a.id).maybeSingle()
      if (!(had as any)?.goal_due) due = new Date(Date.now() + Math.max(0, a.goal_total - ((had as any)?.results ?? 0)) * a.goal_every_days * 864e5).toISOString()
    }
    const f = check(await db.from('funnels').upsert({
      key: a.id, title: a.title, result: a.result, theme: a.theme ?? 'mine',
      goal_total: a.goal_total,
      ...(due !== undefined && { goal_due: due }),
      ...(a.goal_every_days !== undefined && { goal_every_days: a.goal_every_days }),
      ...(a.source_url !== undefined && { source_url: a.source_url }),
      ...(a.guide_url !== undefined && { guide_url: a.guide_url }),
    }, { onConflict: 'user_id,key' }).select('id').single()) as { id: string }
    check(await db.from('stages').delete().eq('funnel_id', f.id).not('key', 'in', `(${keys.join(',')})`))
    check(await db.from('stages').upsert(a.stages.map((st, i) => ({
      funnel_id: f.id, key: st.key, position: i, label: st.label,
    })), { onConflict: 'funnel_id,key' }))
    return text(await one(db, a.id))
  })

  s.registerTool('report_counts', {
    title: 'Report counts',
    description: 'Counts after your work, cumulative: for each stage, how many items have ever reached it (an item that moved on to the next stage still counts here), and optionally the results so far. ' +
      'The dashboard takes the conversion between stages from these counts (next stage ÷ this one; 30% while one of them is 0), so keep them cumulative. ' +
      'The dashboard computes flows and tank fill from these reports (automatic). Optionally set them yourself (manual): ' +
      'fill_percent and flow_per_day per stage; null switches that one back to automatic.',
    inputSchema: req({
      funnel_id: funnelId,
      counts: z.record(z.string(), z.number().int().nonnegative()).default({}).describe('{ stage_key: count }, cumulative: every item that ever reached the stage'),
      results: z.number().int().nonnegative().optional().describe('Results so far'),
      fill_percent: z.record(z.string(), z.number().min(0).max(100).nullable()).optional()
        .describe('Manual tank fill, { stage_key: 0-100 }: how much of what this stage needs for the whole goal is there. null = automatic'),
      flow_per_day: z.record(z.string(), z.number().min(0).max(1e9).nullable()).optional()
        .describe('Manual flow, the "+N/d" written on a tank: { stage_key: items added to that stage per day }, and "results" for results per day. Give it when you know the real daily rate better than the count history shows (e.g. right after you start reporting). null = automatic: the average daily growth over the last 7 days of your count reports'),
      source_url: z.string().url().regex(/^https?:\/\//).nullable().optional()
        .describe('Link to the table or list with this funnel\'s items: give it whenever it opens by a URL (Google Sheet, Notion…); null removes it'),
      guide_url: z.string().url().regex(/^https?:\/\//).nullable().optional()
        .describe('Link to the funnel\'s guide document (see upsert_funnel); null removes it'),
    }),
    annotations: { title: 'Report counts', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async ({ funnel_id, counts, results, fill_percent, flow_per_day, source_url, guide_url }) => {
    const f = await funnelRow(db, funnel_id)
    const stages = check(await db.from('stages').select('key, position').eq('funnel_id', f.id).order('position')) as { key: string, position: number }[]
    const known = stages.map(s => s.key)
    const unknown = [...Object.keys(counts), ...Object.keys(fill_percent ?? {}), ...Object.keys(flow_per_day ?? {}).filter(k => k !== 'results')].filter(k => !known.includes(k))
    if (unknown.length) fail(`Unknown stage keys: ${unknown.join(', ')}. Stages: ${known.join(', ')}`)
    for (const key of known) {
      const patch: Record<string, unknown> = {}
      if (key in counts) patch.count = counts[key]
      if (fill_percent && key in fill_percent) patch.fill_percent = fill_percent[key]
      if (flow_per_day && key in flow_per_day) patch.flow_per_day = flow_per_day[key]
      if (Object.keys(patch).length) check(await db.from('stages').update(patch).eq('funnel_id', f.id).eq('key', key))
    }
    const funnelPatch: Record<string, unknown> = {}
    if (results != null) funnelPatch.results = results
    if (source_url !== undefined) funnelPatch.source_url = source_url
    if (guide_url !== undefined) funnelPatch.guide_url = guide_url
    if (flow_per_day && 'results' in flow_per_day) funnelPatch.output_flow_per_day = flow_per_day.results
    if (Object.keys(funnelPatch).length) check(await db.from('funnels').update(funnelPatch).eq('id', f.id))
    const rows = Object.entries(counts).map(([stage_key, value]) => ({ funnel_id: f.id, stage_key, value }))
    if (results != null) rows.push({ funnel_id: f.id, stage_key: null as unknown as string, value: results })
    if (rows.length) check(await db.from('count_reports').insert(rows))
    await updateRuns(db, f.id)
    return text(await one(db, funnel_id))
  })

  s.registerTool('add_result', {
    title: 'Add a result',
    description: 'One more result came out of the funnel (an offer, a paper, a term sheet…).',
    inputSchema: req({ funnel_id: funnelId }),
    annotations: { title: 'Add a result', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async ({ funnel_id }) => {
    const f = await funnelRow(db, funnel_id)
    const { results } = check(await db.from('funnels').select('results').eq('id', f.id).single()) as { results: number }
    check(await db.from('funnels').update({ results: results + 1 }).eq('id', f.id))
    check(await db.from('count_reports').insert({ funnel_id: f.id, stage_key: null, value: results + 1 }))
    await updateRuns(db, f.id)
    return text(await one(db, funnel_id))
  })

  s.registerTool('set_agent_state', {
    title: 'Set your state',
    description: 'Show where you are and what you are doing: work (working now; send it when you wake up and every 5 minutes while you work: the heartbeat), sleep (until next_run_at), ask (waiting for the person, with a question; returns the question_id its answer is read by), pause (stopped until resumed, with a short reason: the person paused you, or your plan\'s limit ran out; a supervisor may pause or resume a worker of its funnel the same way, giving the worker\'s name and zone). The funnel\'s supervisor uses zone "supervisor" and gives what its run found as status and summary.',
    inputSchema: req({
      funnel_id: funnelId,
      agent,
      zone: z.union([z.number().int().min(0).max(5), z.literal('supervisor')]).describe('0 = inflow above the first stage, k = into stage k, n = output below the last stage; "supervisor" = the platform over the whole funnel (one agent per funnel)'),
      state: z.enum(['work', 'sleep', 'ask', 'pause']),
      reason: z.string().min(1).max(120).optional().describe('For pause: why, in one short line in the person\'s language, e.g. "лимит Claude исчерпан до среды", "на паузе по просьбе Олега"'),
      next_run_at: z.string().datetime({ offset: true }).optional().describe('For sleep: ISO time of your next run'),
      question: z.string().min(1).max(400).optional().describe('For ask: what you need from the person, as short as you can (at most 400 characters): only what they need to understand it and decide'),
      chat_url: z.string().url().regex(CHAT_LINK).optional().describe('Link to this conversation, so the person\'s "Open" leads to this very chat: https://claude.ai/chat/…, https://chatgpt.com/c/…, in the Claude app claude://claude.ai/epitaxy/<your session id>, in Grok Bot grokbot://app/v1/agent?id=<your bot id> (see the instructions). Codex links itself. With ask it is kept with the question'),
      name: z.string().min(1).max(40).optional().describe('Your own short name in the person\'s language, shown instead of your model\'s name, e.g. "Супервайзер поиска работы", "Job Search supervisor". Kept until you send another; rename yourself when the person asks'),
      added: z.number().int().min(0).max(1e9).optional().describe('How many items you added this run, when you know it better than the counts show (e.g. when items also left your stage). Leave it out and the dashboard counts it from report_counts'),
      status: z.enum(['ok', 'bottleneck', 'recommendation']).optional().describe('Supervisor only: what this run found: ok (all good), bottleneck, recommendation. Shown by you on the dashboard. To ask the person, use state ask with a question, as every agent does'),
      summary: z.string().min(1).max(200).optional().describe('Supervisor only: the finding in one short line, in the person\'s language, e.g. "interviews → final round", "add an agent on the inflow"'),
    }),
    annotations: { title: 'Set your state', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async (a) => {
    const f = await funnelRow(db, a.funnel_id)
    const n = (check(await db.from('stages').select('key').eq('funnel_id', f.id)) as unknown[]).length
    // The supervisor's place has no zone (null in the database).
    const zone = a.zone === 'supervisor' ? null : a.zone
    if (zone != null && zone > n) fail(`This funnel has ${n} stages, so zones are 0-${n}`)
    if (zone != null && (a.status || a.summary)) fail('status and summary are for the supervisor (zone "supervisor"); a worker reports what it added')
    if (zone == null && a.added != null) fail('The supervisor adds no items: give what you found as status and summary')
    if (a.state === 'ask' && !a.question) fail('state "ask" needs a question')
    const chat_url = a.chat_url ?? caller.chat
    let question_id: string | null = null
    const asked = a.state === 'ask' ? a.question! : null
    if (asked) {
      // The same question asked again while still unanswered (say, on the agent's next run) is not
      // news: no second email for it.
      const again = check(await db.from('questions').select('id').eq('funnel_id', f.id).eq('agent', a.agent)
        .eq('question', asked).is('answered_at', null).limit(1)) as unknown[]
      const q = check(await db.from('questions').insert({ funnel_id: f.id, agent: a.agent, question: asked, chat_url: chat_url ?? null })
        .select('id').single()) as { id: string }
      question_id = q.id
      if (!again.length) {
        const named = a.name ?? (check(await db.from('presence').select('display_name').eq('funnel_id', f.id).eq('agent', a.agent).maybeSingle()) as any)?.display_name
        notify(caller, f.id, a.agent, asked, named)
      }
    }
    // A run starts when the agent comes to work from sleep (or to another zone): its counter starts at 0
    // and is kept through the next sleep, so the person sees what the last run added.
    const prev = check(await db.from('presence').select('zone, state').eq('funnel_id', f.id).eq('agent', a.agent).maybeSingle()) as any
    const newRun = a.state === 'work' && (!prev || prev.state === 'sleep' || prev.state === 'pause' || prev.zone !== zone)
    const run = !newRun ? {} : zone == null ? { run_base: null, run_added: null, run_manual: false }
      : { run_base: (await zoneTargets(db, f.id))(zone), run_added: 0, run_manual: false }
    if (newRun) {
      check(await endRun(db, f.id, a.agent))
      check(await db.from('agent_runs').insert({ funnel_id: f.id, agent: a.agent, zone }))
    }
    if (a.added != null) check(await openRun(db, f.id, a.agent).update({ added: a.added }))
    // What the supervisor found, on its run (before a sleep ends it) and by it on the dashboard.
    const found: Record<string, unknown> = { ...(a.status && { status: a.status }), ...(a.summary && { summary: a.summary }) }
    if (a.status && !a.summary) found.summary = null
    if (Object.keys(found).length) check(await openRun(db, f.id, a.agent).update(found))
    if (a.state === 'sleep' || a.state === 'pause') check(await endRun(db, f.id, a.agent))
    check(await db.from('presence').upsert({
      funnel_id: f.id, agent: a.agent, zone, state: a.state, ...found, ...(a.name && { display_name: a.name }),
      next_run_at: a.state === 'sleep' ? a.next_run_at ?? null : null,
      pause_reason: a.state === 'pause' ? a.reason ?? null : null,
      question_id, ...(chat_url !== undefined && { chat_url }),
      ...run,
      ...(a.added != null && { run_added: a.added, run_manual: true }),
    }, { onConflict: 'funnel_id,agent' }))
    // What waits for this agent: messages from the person it has not read yet.
    const unread = check(await db.from('agent_messages').select('id').eq('funnel_id', f.id).eq('agent', a.agent).is('read_at', null)) as unknown[]
    return text({ question_id, new_messages: unread.length, funnel: await one(db, a.funnel_id) })
  })

  s.registerTool('get_answer', {
    title: 'Get the answer',
    description: 'The person\'s answer to a question, or null if not answered yet. wait_seconds (up to 50) waits for it.',
    inputSchema: req({
      question_id: z.string().uuid(),
      wait_seconds: z.number().int().min(0).max(50).default(0),
    }),
    annotations: { title: 'Get the answer', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ question_id, wait_seconds }) => {
    const until = Date.now() + wait_seconds * 1000
    for (;;) {
      const q = check(await db.from('questions').select('question, answer, answered_at').eq('id', question_id).maybeSingle())
      if (!q) fail('No such question')
      if ((q as any).answered_at || Date.now() >= until) return text(q)
      await new Promise(r => setTimeout(r, 3000))
    }
  })

  s.registerTool('get_messages', {
    title: 'Get your messages',
    description: 'What was written to you and you have not read yet, oldest first: by the person from the dashboard, or by your funnel\'s supervisor (from). Reading marks them read. Reply to each in one short line with reply(message_id). A supervisor also gets the replies to what it sent with send_message (replies).',
    inputSchema: req({
      agent,
      funnel_id: funnelId.optional().describe('Only this funnel; leave out for all your funnels'),
    }),
    annotations: { title: 'Get your messages', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async (a) => {
    const fid = a.funnel_id ? (await funnelRow(db, a.funnel_id)).id : null, now = new Date().toISOString()
    let q = db.from('agent_messages').select('id, text, sent_at, from_agent, funnels (key)').eq('agent', a.agent).is('read_at', null).order('sent_at')
    if (fid) q = q.eq('funnel_id', fid)
    const rows = check(await q) as any[]
    if (rows.length) check(await db.from('agent_messages').update({ read_at: now }).in('id', rows.map(r => r.id)))
    // Replies to what this agent sent to others (a supervisor to its workers), not read yet.
    let rq = db.from('agent_messages').select('id, agent, text, reply, replied_at, funnels (key)').eq('from_agent', a.agent)
      .not('replied_at', 'is', null).is('reply_read_at', null).order('replied_at')
    if (fid) rq = rq.eq('funnel_id', fid)
    const replies = check(await rq) as any[]
    if (replies.length) check(await db.from('agent_messages').update({ reply_read_at: now }).in('id', replies.map(r => r.id)))
    return text({
      messages: rows.map(r => ({ message_id: r.id, funnel_id: r.funnels?.key, from: r.from_agent ?? 'person', text: r.text, sent_at: r.sent_at })),
      replies: replies.map(r => ({ message_id: r.id, funnel_id: r.funnels?.key, agent: r.agent, you_wrote: r.text, reply: r.reply, replied_at: r.replied_at })),
    })
  })

  s.registerTool('send_message', {
    title: 'Write to a worker agent',
    description: 'For a funnel\'s supervisor: write to one of its worker agents, for example to ask why it missed its run or to give it a task. The worker reads it with get_messages (from your name) and replies in one line; you get the reply on your own next get_messages (replies). If the person runs the wake script, a worker on their computer wakes for it within seconds.',
    inputSchema: req({
      funnel_id: funnelId,
      agent: agent.describe('You, the funnel\'s supervisor'),
      to: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,31}$/).describe('The worker agent to write to, as it appears in list_funnels'),
      text: z.string().min(1).max(2000).describe('The message, in the person\'s language'),
    }),
    annotations: { title: 'Write to a worker agent', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async (a) => {
    const f = await funnelRow(db, a.funnel_id)
    const at = check(await db.from('presence').select('agent, zone').eq('funnel_id', f.id)) as any[]
    if (!at.some(p => p.agent === a.agent && p.zone == null)) fail(`Only the funnel's supervisor writes to its agents, and "${a.agent}" is not the supervisor of ${a.funnel_id}`)
    if (!at.some(p => p.agent === a.to && p.zone != null)) fail(`No worker agent "${a.to}" in ${a.funnel_id}. Agents there: ${at.filter(p => p.zone != null).map(p => p.agent).join(', ') || 'none'}`)
    const m = check(await db.from('agent_messages').insert({ funnel_id: f.id, agent: a.to, from_agent: a.agent, text: a.text }).select('id').single()) as { id: string }
    return text({ sent: m.id, to: a.to })
  })

  s.registerTool('set_tasks', {
    title: 'Set the person\'s tasks',
    description: 'Any agent of the funnel, supervisor or worker: the person\'s tasks, the things only they can do for this funnel (take a test task, fill in a form, answer a recruiter, sign something), shown to them on the dashboard, most urgent first. Every agent sees the same list (list_funnels tasks) and changes it the same way: send the whole list as it should be now, the other tasks included; keep a task\'s id to keep it. A task left out is removed; one listed in done is marked done. Add one when the person asks you to, or when there is something only they can do that doesn\'t hold you up. Not for questions: if an agent can\'t go on without the person\'s answer, ask it (set_agent_state ask), and don\'t also make it a task.',
    inputSchema: req({
      funnel_id: funnelId,
      agent: agent.describe('You'),
      tasks: z.array(req({
        id: z.string().uuid().optional().describe('An existing task\'s id, to keep it; leave out for a new task'),
        title: z.string().min(1).max(120).describe('What to do, short, in the person\'s language, e.g. "Пройти тестовое задание Seven AI"'),
        detail: z.string().min(1).max(300).optional().describe('One line: why, or how'),
        url: z.string().url().regex(/^https?:\/\//).max(2000).optional().describe('Where to do it: the form, the email, the job'),
        due_at: z.string().datetime({ offset: true }).optional().describe('When it must be done by, if there is a deadline'),
      })).max(30).describe('The open tasks, most urgent first'),
      done: z.array(z.string().uuid()).max(30).optional().describe('Ids of tasks the person has done'),
    }),
    annotations: { title: 'Set the person\'s tasks', readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  }, async (a) => {
    const f = await funnelRow(db, a.funnel_id)
    const open = check(await db.from('person_tasks').select('id').eq('funnel_id', f.id).is('done_at', null)) as { id: string }[]
    const known = new Set(open.map(t => t.id)), done = new Set(a.done ?? []), now = new Date().toISOString()
    for (const t of a.tasks) if (t.id && !known.has(t.id)) fail(`No open task ${t.id} in ${a.funnel_id}: leave id out for a new task`)
    if (done.size) check(await db.from('person_tasks').update({ done_at: now, updated_at: now }).eq('funnel_id', f.id).in('id', [...done]))
    const keep = new Set(a.tasks.map(t => t.id).filter(Boolean))
    const drop = open.map(t => t.id).filter(id => !keep.has(id) && !done.has(id))
    if (drop.length) check(await db.from('person_tasks').delete().in('id', drop))
    for (const [i, t] of a.tasks.entries()) {
      const row = { title: t.title, detail: t.detail ?? null, url: t.url ?? null, due_at: t.due_at ?? null, position: i, updated_at: now }
      if (t.id) check(await db.from('person_tasks').update(row).eq('id', t.id))
      else check(await db.from('person_tasks').insert({ funnel_id: f.id, ...row, added_by: a.agent }))
    }
    const rows = check(await db.from('person_tasks').select('id, position, title, detail, url, due_at, done_at').eq('funnel_id', f.id).is('done_at', null)) as any[]
    return text({ tasks: openTasks(rows), done: done.size, removed: drop.length })
  })

  s.registerTool('reply', {
    title: 'Reply to the answer',
    description: 'A one-line note back to the person about their answer or their message, as in a chat ("Thanks, sending the application now", "Got it, skipping this one"): what you do next. The dashboard shows it over the agent until the person closes it. Give question_id for an answer, message_id for a message. It never asks the person for anything: if you need them to answer, decide or do something (say, what was agreed turned out impossible for you), ask a question with set_agent_state ask instead, saying plainly what happened and exactly what to do.',
    inputSchema: req({
      question_id: z.string().uuid().optional().describe('The question the person answered'),
      message_id: z.string().uuid().optional().describe('The message the person wrote to you (from get_messages)'),
      text: z.string().min(1).max(300).describe('One short line, in the person\'s language'),
    }),
    annotations: { title: 'Reply to the answer', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ question_id, message_id, text: reply }) => {
    if (!question_id === !message_id) fail('Give question_id (an answer) or message_id (a message), one of them')
    if (message_id) {
      const m = check(await db.from('agent_messages').update({ reply, replied_at: new Date().toISOString(), reply_seen_at: null, read_at: new Date().toISOString() })
        .eq('id', message_id).select('id').maybeSingle())
      if (!m) fail('No message with this id: call get_messages')
      return text({ replied: message_id })
    }
    const q = check(await db.from('questions').update({ reply, replied_at: new Date().toISOString(), reply_seen_at: null })
      .eq('id', question_id).not('answered_at', 'is', null).select('id').maybeSingle())
    if (!q) fail('No answered question with this id: call get_answer first')
    return text({ replied: question_id })
  })

  s.registerTool('close_question', {
    title: 'Close a question answered elsewhere',
    description: 'The person answered your question somewhere else (in your chat, by message): close it so the dashboard stops showing you as waiting. Closes the question with question_id, or all your open questions in the funnel without it.',
    inputSchema: req({
      funnel_id: funnelId,
      agent,
      question_id: z.string().uuid().optional().describe('The question to close; leave out to close all your open questions in this funnel'),
      answer: z.string().min(1).max(2000).optional().describe('The answer you got, in short, kept with the question'),
    }),
    annotations: { title: 'Close a question answered elsewhere', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (a) => {
    const f = await funnelRow(db, a.funnel_id)
    let q = db.from('questions').update({ answer: a.answer ?? 'Answered in the chat', answered_at: new Date().toISOString() })
      .eq('funnel_id', f.id).eq('agent', a.agent).is('answered_at', null)
    if (a.question_id) q = q.eq('id', a.question_id)
    const closed = check(await q.select('id')) as unknown[]
    // Still standing in ask with nothing left to ask: back at work.
    check(await db.from('presence').update({ state: 'work' }).eq('funnel_id', f.id).eq('agent', a.agent).eq('state', 'ask'))
    return text({ closed: closed.length, funnel: await one(db, a.funnel_id) })
  })

  s.registerTool('clear_agent', {
    title: 'Leave the funnel',
    description: 'You leave the funnel (no scheduled next run).',
    inputSchema: req({ funnel_id: funnelId, agent }),
    annotations: { title: 'Leave the funnel', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ funnel_id, agent }) => {
    const f = await funnelRow(db, funnel_id)
    check(await endRun(db, f.id, agent))
    check(await db.from('presence').delete().eq('funnel_id', f.id).eq('agent', agent))
    return text(await one(db, funnel_id))
  })

  s.registerTool('create_wake_key', {
    title: 'Create a wake key',
    description: 'Only when you run on the person\'s own computer (Claude Code, Codex) and the person agreed: a key for the Goalcraft wake script, which wakes their agents here within seconds when they write to one, answer a question or an agent misses its run. Returns the key and the one shell command that installs the script with it (macOS). Run that command, then tell the person it is on and where its log is. A new key replaces the old one, which stops the script installed with it.',
    inputSchema: req({}),
    annotations: { title: 'Create a wake key', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async () => {
    const bytes = crypto.getRandomValues(new Uint8Array(24))
    const key = 'gck_' + [...bytes].map(b => b.toString(16).padStart(2, '0')).join('')
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)))].map(b => b.toString(16).padStart(2, '0')).join('')
    check(await db.from('wake_keys').upsert({ user_id: caller.id, key_hash: hash, created_at: new Date().toISOString() }, { onConflict: 'user_id' }))
    return text({
      key,
      install: `mkdir -p ~/.goalcraft && curl -fsSL https://goalcraft.ai/wake/goalcraft-wake.py -o ~/.goalcraft/goalcraft-wake.py && python3 ~/.goalcraft/goalcraft-wake.py install ${key}`,
      log: '~/.goalcraft/wake.log',
      remove: 'python3 ~/.goalcraft/goalcraft-wake.py uninstall',
      about: 'https://github.com/oponfil/goalcraft/tree/main/wake',
    })
  })

  s.registerTool('delete_funnel', {
    title: 'Delete a funnel',
    description: 'Delete a funnel with its stages, history, agents and questions.',
    inputSchema: req({ funnel_id: funnelId }),
    annotations: { title: 'Delete a funnel', readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  }, async ({ funnel_id }) => {
    const f = await funnelRow(db, funnel_id)
    check(await db.from('funnels').delete().eq('id', f.id))
    return text({ deleted: funnel_id })
  })

  return s
}

// Links a chat_url may hold: web chats, and the Claude, ChatGPT (Codex) and Grok Bot apps' own links.
const CHAT_LINK = /^(https?|claude|codex|grokbot):\/\//

// The conversation a call came from, when the agent's app names it: Codex sends its thread id with
// every tool call, and the ChatGPT app opens that thread from codex://threads/<id>.
function chatOf(raw: string): string | undefined {
  try {
    const body = JSON.parse(raw)
    for (const m of Array.isArray(body) ? body : [body]) {
      const meta = m?.params?._meta
      const thread = meta?.threadId ?? meta?.['x-codex-turn-metadata']?.thread_id
      if (typeof thread === 'string' && /^[0-9a-f-]{36}$/i.test(thread)) return `codex://threads/${thread}`
    }
  } catch { /* not JSON */ }
}

Deno.serve(
  pipeline(
    [
      // The project's Auth issuer, not the goalcraft.supabase.co name the request came in on.
      withOAuthProtectedResource({ authorizationServer: Deno.env.get('MCP_AUTH_ISSUER') }),
      withSupabase({ auth: 'user' }),
    ],
    async (req: Request, { supabase, supabaseAdmin, userClaims }: { supabase: Db, supabaseAdmin: Db, userClaims: { id: string } }) => {
      // Read the body once and hand the server a fresh copy of the request.
      const raw = req.method === 'POST' ? await req.text() : ''
      const fresh = raw ? new Request(req.url, { method: req.method, headers: req.headers, body: raw }) : req
      return createMcpHandler(() => server(supabase, { id: userClaims.id, admin: supabaseAdmin, chat: chatOf(raw) })).fetch(fresh)
    },
  ),
)
