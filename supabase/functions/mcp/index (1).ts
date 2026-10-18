// GoalAgents MCP server: agents create goal funnels and report progress; the person watches it on
// goalagents.run. Streamable HTTP, OAuth 2.1 through Supabase Auth. Every query runs as the
// signed-in person, so row-level security keeps each person's data their own.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { createMcpHandler, McpServer } from 'npm:@modelcontextprotocol/server@2.2.0'
import { pipeline } from 'npm:@supabase/middleware@1.0.0'
import { withOAuthProtectedResource, withSupabase } from 'npm:@supabase/server@1.9.0'
import { z } from 'npm:zod@4.6.5'
import { emailQuestion } from './notify.ts'

type Db = any // the Supabase client scoped to the caller
// Who is calling, and an admin client to read their current settings (for question emails).
type Caller = { id: string, admin: Db }

const THEMES = ['mine', 'lab', 'garden', 'love', 'code', 'money', 'forge', 'bakery', 'blocks'] as const
const forms = z.array(z.string().min(1).max(40)).min(1).max(3)
const funnelId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/).describe('Funnel id, e.g. "job-search"')
const agent = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,31}$/)
  .describe('Who you are: claude, chatgpt, grok, gemini, deepseek, kimi, qwen, mistral, perplexity, hermes, or another lowercase name. Several agents of one kind in a funnel add a suffix: claude-search, claude-apply (shown as Claude with its logo)')

const INSTRUCTIONS = `GoalAgents shows the person their goals as funnels and the agents working them.
A funnel is one goal (e.g. "Job Search") with 2-5 stages top to bottom (jobs found → applied → interview → final round) and a result at the bottom (offer).
Zones: 0 is the inflow above the first stage, zone k moves stage k-1 into stage k, zone n (below the last stage) turns the last stage into results. At most two agents per zone on Pro, one on the free plan.
Heartbeat: set_agent_state(work) is your sign of life. Send it first thing when you wake up and again every 5 minutes while you work. The dashboard waits twice that, 10 minutes of silence, then warns the person that you did not wake up (10 minutes past your next_run_at) or that it lost contact with you (10 minutes after your last signal).
On every run: first thing, before any other work, set_agent_state(work) in your zone (this starts the run's counter, shown by you on the dashboard), then every 5 minutes again while you work; after progress report_counts (and add_result when a result appears); if you need the person, set_agent_state(ask, question, chat_url of this conversation when you know it) and poll get_answer: while you are in ask the person sees you waiting and expects you to take the answer at once. If you go to sleep before it comes, the question stays on the dashboard and the person is told you will pick the answer up on your next run, so call get_answer then. Whenever you get an answer, reply to it in one short line with reply (what you do next); if you need more from the person, ask a new question instead. If the person answers you somewhere else instead (in your chat), call close_question so the dashboard stops showing the question; at the end set_agent_state(sleep, next_run_at) or clear_agent.
Plans: free has up to 3 funnels with up to 3 stages each and one agent per zone; Pro has up to 10 funnels with up to 5 stages each and two agents per zone. list_funnels tells which plan the person has.
Report only counts, dates and links: the items themselves stay in the person's own sources.
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
    .select(`key, title, theme, source_url, result, goal_total, goal_every_days, results, output_flow_per_day, updated_at,
      stages (key, position, label, count, fill_percent, flow_per_day),
      presence (agent, zone, state, next_run_at, chat_url, question_id, run_added, updated_at),
      questions (id, agent, question, answer, asked_at, answered_at, chat_url, replied_at)`)
    .order('created_at')
  if (key) q = q.eq('key', key)
  const rows = check(await q) as any[]
  return rows.map(f => ({
    id: f.key,
    title: f.title,
    theme: f.theme,
    source_url: f.source_url,
    result: f.result,
    goal: { total: f.goal_total, every_days: f.goal_every_days },
    results: f.results,
    stages: f.stages.sort((a: any, b: any) => a.position - b.position)
      .map(({ key, label, count, fill_percent, flow_per_day }: any) => ({ key, label, count, fill_percent, flow_per_day })),
    output_flow_per_day: f.output_flow_per_day,
    agents: f.presence,
    open_questions: f.questions.filter((q: any) => !q.answered_at),
    // Answered but not replied to yet: the agent owes the person a short reply.
    answers_to_reply: f.questions.filter((q: any) => q.answered_at && !q.replied_at).map(({ id, agent, question, answer, answered_at }: any) => ({ id, agent, question, answer, answered_at })),
  }))
}
const one = async (db: Db, key: string) => (await funnels(db, key))[0]

// Free: 3 funnels of up to 3 stages, one agent per zone. Pro: 10 funnels of up to 5 stages, two agents per zone
// (everyone is on Pro during the launch).
async function plan(db: Db) {
  const row = check(await db.from('accounts').select('plan').maybeSingle()) as { plan: string } | null
  const name = row?.plan ?? 'pro'
  return { plan: name, max_funnels: name === 'pro' ? 10 : 3, max_stages: name === 'pro' ? 5 : 3, max_agents_per_zone: name === 'pro' ? 2 : 1 }
}

// Emails the person about a new question if they asked for it, after the reply has gone out to the
// agent. Settings are read fresh: the checkbox may have changed since the agent's token was issued.
function notify(caller: Caller, funnelId: string, agent: string, question: string) {
  const send = async () => {
    const { data: { user } } = await caller.admin.auth.admin.getUserById(caller.id)
    if (!user?.email || !user.user_metadata?.notify_email) return
    const { data: f } = await caller.admin.from('funnels').select('title').eq('id', funnelId).single()
    await emailQuestion(user.email, user.user_metadata.lang, agent, f?.title ?? '', question)
  }
  const job = send().catch(e => console.error('question email failed:', e?.message ?? e))
  ;(globalThis as any).EdgeRuntime?.waitUntil?.(job)
}

function server(db: Db, caller: Caller) {
  const s = new McpServer({
    name: 'goalagents',
    title: 'GoalAgents',
    version: '0.1.0',
    websiteUrl: 'https://goalagents.run',
    icons: [
      { src: 'https://goalagents.run/favicon.svg', mimeType: 'image/svg+xml', sizes: ['any'] },
      { src: 'https://goalagents.run/apple-touch-icon.png', mimeType: 'image/png', sizes: ['180x180'] },
    ],
  }, { instructions: INSTRUCTIONS })

  s.registerTool('list_funnels', {
    title: 'List funnels',
    description: 'The person\'s plan with its limits, and their goal funnels: stages with counts, results, goal, agents present, open questions, and answers you still owe a short reply to (answers_to_reply).',
    inputSchema: req({}),
    annotations: { readOnlyHint: true },
  }, async () => text({ ...(await plan(db)), funnels: await funnels(db) }))

  s.registerTool('upsert_funnel', {
    title: 'Create or update a funnel',
    description: 'Create a goal funnel or change its title, result name, goal, theme or stages. Stages keep their counts by key; stages left out are removed. Free plan: up to 3 funnels of up to 3 stages; Pro: up to 10 funnels of up to 5 stages.',
    inputSchema: req({
      id: funnelId,
      title: z.string().min(1).max(60).describe('Column title, e.g. "Job Search"'),
      result: forms.describe('Name of one result: [singular, plural], e.g. ["offer", "offers"]; Russian: [1, 2-4, 5+]; Spanish: [singular, plural]; Chinese, Japanese, Thai, Vietnamese and other languages without plural forms: one form'),
      goal_total: z.number().int().min(1).max(100).describe('How many results the goal needs (1-100)'),
      goal_every_days: z.number().positive().max(3650).describe('Pace: one result every N days'),
      source_url: z.string().url().regex(/^https?:\/\//).nullable().optional().describe('Link to the table or list with this funnel\'s items (Google Sheet, Notion, Airtable…). Give it whenever the list opens by a URL; null removes it, leaving it out keeps it'),
      theme: z.enum(THEMES).optional().describe('Look: mine (miners, ore), lab (chemists, flasks), garden (gardeners, flowers), love (cupids, hearts), code (hackers, chips), money (bankers, coins, banknotes, gold bars, bitcoins), forge (smiths, ingots, swords, armour), bakery (bakers, pizzas, pies, cakes), blocks (block-headed heroes in diamond armour with swords, blocks, diamonds). Default mine'),
      stages: z.array(req({
        key: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/).describe('Stable key, e.g. "applied"'),
        label: forms.describe('[singular, plural], e.g. ["interview", "interviews"]; Russian: [1, 2-4, 5+]; Spanish: [singular, plural]; Chinese, Japanese, Thai, Vietnamese: one form'),
      })).min(2).max(5).describe('Stages top to bottom'),
    }),
    annotations: { idempotentHint: true },
  }, async (a) => {
    const keys = a.stages.map(st => st.key)
    if (new Set(keys).size !== keys.length) fail('Stage keys must be unique')
    const p = await plan(db)
    if (a.stages.length > p.max_stages) fail(`The ${p.plan} plan has up to ${p.max_stages} stages per funnel. Merge some stages, or the person can upgrade to Pro for up to 5.`)
    const f = check(await db.from('funnels').upsert({
      key: a.id, title: a.title, result: a.result, theme: a.theme ?? 'mine',
      goal_total: a.goal_total, goal_every_days: a.goal_every_days,
      ...(a.source_url !== undefined && { source_url: a.source_url }),
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
    }),
  }, async ({ funnel_id, counts, results, fill_percent, flow_per_day, source_url }) => {
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
    description: 'Show where you are and what you are doing: work (working now; send it when you wake up and every 5 minutes while you work: the heartbeat), sleep (until next_run_at), ask (waiting for the person; give a question, then poll get_answer with the returned question_id).',
    inputSchema: req({
      funnel_id: funnelId,
      agent,
      zone: z.number().int().min(0).max(5).describe('0 = inflow above the first stage, k = into stage k, n = output below the last stage'),
      state: z.enum(['work', 'sleep', 'ask']),
      next_run_at: z.string().datetime({ offset: true }).optional().describe('For sleep: ISO time of your next run'),
      question: z.string().min(1).max(1000).optional().describe('For ask: what you need from the person'),
      chat_url: z.string().url().regex(/^https?:\/\//).optional().describe('Link to this conversation (e.g. https://chatgpt.com/c/…, https://claude.ai/chat/…) when you know it. With ask it is kept with the question, so the person\'s "Open" under it leads to this very chat'),
      added: z.number().int().min(0).max(1e9).optional().describe('How many items you added this run, when you know it better than the counts show (e.g. when items also left your stage). Leave it out and the dashboard counts it from report_counts'),
    }),
  }, async (a) => {
    const f = await funnelRow(db, a.funnel_id)
    const n = (check(await db.from('stages').select('key').eq('funnel_id', f.id)) as unknown[]).length
    if (a.zone > n) fail(`This funnel has ${n} stages, so zones are 0-${n}`)
    if (a.state === 'ask' && !a.question) fail('state "ask" needs a question')
    let question_id: string | null = null
    if (a.state === 'ask') {
      // The same question asked again while still unanswered (say, on the agent's next run) is not
      // news: no second email for it.
      const again = check(await db.from('questions').select('id').eq('funnel_id', f.id).eq('agent', a.agent)
        .eq('question', a.question).is('answered_at', null).limit(1)) as unknown[]
      const q = check(await db.from('questions').insert({ funnel_id: f.id, agent: a.agent, question: a.question, chat_url: a.chat_url ?? null })
        .select('id').single()) as { id: string }
      question_id = q.id
      if (!again.length) notify(caller, f.id, a.agent, a.question!)
    }
    // A run starts when the agent comes to work from sleep (or to another zone): its counter starts at 0
    // and is kept through the next sleep, so the person sees what the last run added.
    const prev = check(await db.from('presence').select('zone, state').eq('funnel_id', f.id).eq('agent', a.agent).maybeSingle()) as any
    const newRun = a.state === 'work' && (!prev || prev.state === 'sleep' || prev.zone !== a.zone)
    const run = newRun ? { run_base: (await zoneTargets(db, f.id))(a.zone), run_added: 0, run_manual: false } : {}
    if (newRun) {
      check(await endRun(db, f.id, a.agent))
      check(await db.from('agent_runs').insert({ funnel_id: f.id, agent: a.agent, zone: a.zone }))
    }
    if (a.added != null) check(await openRun(db, f.id, a.agent).update({ added: a.added }))
    if (a.state === 'sleep') check(await endRun(db, f.id, a.agent))
    check(await db.from('presence').upsert({
      funnel_id: f.id, agent: a.agent, zone: a.zone, state: a.state,
      next_run_at: a.state === 'sleep' ? a.next_run_at ?? null : null,
      question_id, ...(a.chat_url !== undefined && { chat_url: a.chat_url }),
      ...run,
      ...(a.added != null && { run_added: a.added, run_manual: true }),
    }, { onConflict: 'funnel_id,agent' }))
    return text({ question_id, funnel: await one(db, a.funnel_id) })
  })

  s.registerTool('get_answer', {
    title: 'Get the answer',
    description: 'The person\'s answer to your question, or null if not answered yet. wait_seconds (up to 50) waits for it. Once you have the answer, call reply with a short line back.',
    inputSchema: req({
      question_id: z.string().uuid(),
      wait_seconds: z.number().int().min(0).max(50).default(0),
    }),
    annotations: { readOnlyHint: true },
  }, async ({ question_id, wait_seconds }) => {
    const until = Date.now() + wait_seconds * 1000
    for (;;) {
      const q = check(await db.from('questions').select('question, answer, answered_at').eq('id', question_id).maybeSingle())
      if (!q) fail('No such question')
      if ((q as any).answered_at || Date.now() >= until) return text(q)
      await new Promise(r => setTimeout(r, 3000))
    }
  })

  s.registerTool('reply', {
    title: 'Reply to the answer',
    description: 'After you get the person\'s answer (get_answer), always reply to it in one short line, as in a chat: what you do with it ("Thanks, sending the application now", "Got it, skipping this one"). The dashboard shows it to the person as a note over you until they close it. If you need something more from them, do not put it here: ask a new question with set_agent_state(ask).',
    inputSchema: req({
      question_id: z.string().uuid().describe('The question the person answered'),
      text: z.string().min(1).max(300).describe('One short line, in the person\'s language'),
    }),
  }, async ({ question_id, text: reply }) => {
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
    annotations: { idempotentHint: true },
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
    annotations: { idempotentHint: true },
  }, async ({ funnel_id, agent }) => {
    const f = await funnelRow(db, funnel_id)
    check(await endRun(db, f.id, agent))
    check(await db.from('presence').delete().eq('funnel_id', f.id).eq('agent', agent))
    return text(await one(db, funnel_id))
  })

  s.registerTool('delete_funnel', {
    title: 'Delete a funnel',
    description: 'Delete a funnel with its stages, history, agents and questions. Only when the person asks for it.',
    inputSchema: req({ funnel_id: funnelId }),
    annotations: { destructiveHint: true },
  }, async ({ funnel_id }) => {
    const f = await funnelRow(db, funnel_id)
    check(await db.from('funnels').delete().eq('id', f.id))
    return text({ deleted: funnel_id })
  })

  return s
}

Deno.serve(
  pipeline(
    [
      // The project's Auth issuer, not the goalagents.supabase.co name the request came in on.
      withOAuthProtectedResource({ authorizationServer: Deno.env.get('MCP_AUTH_ISSUER') }),
      withSupabase({ auth: 'user' }),
    ],
    (req: Request, { supabase, supabaseAdmin, userClaims }: { supabase: Db, supabaseAdmin: Db, userClaims: { id: string } }) =>
      createMcpHandler(() => server(supabase, { id: userClaims.id, admin: supabaseAdmin })).fetch(req),
  ),
)
