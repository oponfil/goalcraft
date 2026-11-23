// The person's own funnels, written by their agents through MCP, redrawn when the agents write.
import { supabase } from './auth.js?v=dfb01c95';

const DAY = 86400e3;
const WINDOW_DAYS = 7;

// Flow of one reported value (a stage count or the results), per day: how much it grew in the last
// 24 hours. Only increases count, so a stage that items leave does not read as negative. Until
// there are two reports to compare it is 0: "+0".
// Every row of a query, page by page: the database gives at most 1000 rows at a time, and the count
// reports run to thousands a week. query() builds the query afresh for each page.
async function all(query, page = 1000) {
  const rows = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await query().range(from, from + page - 1);
    if (error) return { data: null, error };
    rows.push(...data);
    if (data.length < page) return { data: rows, error: null };
  }
}

// Its reports' rises in the last 24 hours added up (a report before them is where the first one rose from).
function flowOf(reports, now) {
  let grew = 0;
  for (let i = 1; i < reports.length; i++) {
    if (now - Date.parse(reports[i].at) <= DAY) grew += Math.max(0, reports[i].value - reports[i - 1].value);
  }
  return grew;
}

// Rows from the database → the funnels the scene draws (same shape as the demo in src/data.js).
// MCP zones start at 0 above the first stage; the scene's start at -1.
function toScene(f, reports, now, usage = []) {
  const stages = [...f.stages].sort((a, b) => a.position - b.position);
  const series = key => reports.filter(r => r.funnel_id === f.id && r.stage_key === key);
  return {
    id: f.id,
    title: f.title,
    // Its place on the board, as the person dragged it (null: not placed yet).
    position: f.position,
    // The person's tasks, most urgent first, as the supervisor keeps them; done ones are gone.
    tasks: (f.person_tasks || []).filter(x => !x.done_at).sort((a, b) => a.position - b.position)
      .map(({ id, title, detail, url, due_at }) => ({ id, title, detail, url, due_at })),
    theme: f.theme,
    result: f.result,
    source_url: f.source_url,
    guide_url: f.guide_url,
    // active: how many of them are open now (may still go on), when the agent says.
    stages: stages.map(s => ({ key: s.key, count: Number(s.count), active: s.active == null ? null : Math.min(Number(s.active), Number(s.count)), forms: s.label })),
    // Flow per day: set by the agent, or the growth between its reports.
    flowSet: [...stages.map(s => s.flow_per_day != null), f.output_flow_per_day != null],
    flows: [...stages.map(s => (s.flow_per_day != null ? Number(s.flow_per_day) : flowOf(series(s.key), now))),
      f.output_flow_per_day != null ? Number(f.output_flow_per_day) : flowOf(series(null), now)],
    // Tank fill an agent set by hand, 0-1 (null = computed).
    manualFill: stages.map(s => (s.fill_percent == null ? null : Number(s.fill_percent) / 100)),
    cubes: f.results,
    // What each result is, when the agent said (shown on hover).
    resultTitles: f.result_titles || [],
    goal: { total: f.goal_total, due: f.goal_due ? Date.parse(f.goal_due) : null },
    workers: f.presence.filter(p => p.zone != null).map(p => agentOf(f, p, now, usage)),
    // The supervisor (no zone): on the platform at the top, with what its last run found.
    supervisor: f.presence.filter(p => p.zone == null).map(p => ({ ...agentOf(f, p, now, usage), status: p.status, summary: p.summary }))[0] ?? null,
  };
}

// One agent's presence → what the scene draws by it.
// The person's computers by their wake key: its name and system. A chat in the Claude app, Codex or
// Antigravity is kept on the computer it runs on (it opens nowhere else), and the wake script there
// is the one that sends its runs: its last run says which computer that is.
let computers = new Map();
let inventory = {}, launchComputers = [];
export const computersForLaunch = () => launchComputers;
// What the person's computers can run (their wake scripts say): { app: { models, computers } }.
export const launchApps = () => inventory;
const LOCAL_CHATS = new Set(['claude', 'codex', 'antigravity']);

function agentOf(f, p, now, usage = []) {
      // The agent's unanswered questions, oldest first. An agent asking stands and waits for the
      // answers; one that went to sleep keeps them in a bubble and picks them up on its next run.
      // Once all are answered, an asking agent is shown back at work.
      const qs = f.questions.filter(q => q.agent === p.agent && !q.answered_at)
        .sort((a, b) => Date.parse(a.asked_at) - Date.parse(b.asked_at));
      // An agent asleep whose plan's limit is used up won't run until it resets: shown on pause, with
      // the limit as the reason (Claude's and Antigravity's as last read, Codex's as it logged it).
      const mine = usage.filter(u => u.funnel_id === f.id && u.agent === p.agent);
      const lastRun = mine.reduce((a, u) => (!a || u.ended_at > a.ended_at ? u : a), null);
      const lim = lastRun && limits[limitKey(lastRun)];
      const spent = lastRun && (lastRun.app === 'codex' ? Number(lastRun.limit_percent) >= 99.5 && { resets: null } : lim?.week >= 99.5 && lim);
      const state = p.state === 'ask' && !qs.length ? 'work' : p.state === 'sleep' && spent ? 'pause' : p.state;
      return {
        agent: p.agent,
        // Its own name ("Супервайзер поиска работы"), when it gave one.
        name: p.display_name,
        zone: p.zone == null ? null : p.zone - 1,
        state,
        wakeIn: p.state === 'sleep' && p.next_run_at ? (Date.parse(p.next_run_at) - now) / 1000 : null,
        // Why it is paused, as it or its supervisor said; or the used-up limit that holds it.
        pauseReason: p.pause_reason,
        pauseLimit: state === 'pause' && p.state === 'sleep' ? { key: limitKey(lastRun), resets: spent.resets } : null,
        // Seconds since the agent last changed its state (its last word, for an overdue one).
        seenAgo: (now - Date.parse(p.updated_at)) / 1000,
        questions: qs.map(q => ({ id: q.id, question: q.question, chat: q.chat_url })),
        // The agent's short replies to answers, not closed yet, oldest first.
        // Its short replies to answers and to messages ("m:" ids), not closed yet, oldest first.
        replies: [
          ...f.questions.filter(q => q.agent === p.agent && q.reply && !q.reply_seen_at)
            .map(q => ({ id: q.id, question: q.question, answer: q.answer, reply: q.reply, at: q.replied_at })),
          // (Replies to the supervisor's messages go back to it, not over the worker here.)
          ...f.agent_messages.filter(m => m.agent === p.agent && !m.from_agent && m.reply && !m.reply_seen_at)
            .map(m => ({ id: 'm:' + m.id, question: null, answer: m.text, reply: m.reply, at: m.replied_at })),
        ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)),
        chat: p.chat_url,
        // Which AI it is, as it said (its logo); none from agents that never sent it.
        provider: p.provider,
        // Its token use over the last week (the plans' limits are weekly), as the person's wake script read it from the agent's own
        // session files (null: not known, e.g. a web chat).
        usage: dayUsage(mine),
        // The computer its chat is on, { name, os } (null: not known), so another computer's board
        // doesn't offer to open it.
        computer: (() => {
          const here = mine.filter(u => u.wake_key_id && LOCAL_CHATS.has(u.app)).reduce((a, u) => (!a || u.ended_at > a.ended_at ? u : a), null);
          return (here && computers.get(here.wake_key_id)) ?? null;
        })(),
        // What this run added (the last run's, while the agent sleeps); null = not known.
        added: p.run_added,
        // How Goalcraft starts it, when it does (a role of the orchestrator): its schedule and executors.
        launch: (() => {
          const l = (f.role_launch ?? []).find(r => r.agent === p.agent);
          return l ? { ...l, executors: [...(l.role_executors ?? [])].sort((x, y) => x.position - y.position) } : null;
        })(),
      };
}

// Tokens by kind added up over some runs (null for a kind the script didn't send), and their sum.
const KINDS = ['input_tokens', 'cache_read_tokens', 'cache_write_tokens', 'output_tokens'];
function kinds(rows) {
  const out = { tokens: rows.reduce((n, r) => n + Number(r.tokens), 0) };
  for (const k of KINDS) out[k] = rows.every(r => r[k] != null) ? rows.reduce((n, r) => n + Number(r[k]), 0) : null;
  out.limit_used = rows.some(r => r.limit_used != null) ? rows.reduce((n, r) => n + Number(r.limit_used ?? 0), 0) : null;
  // The plan's limit as the app last logged it (Codex): how much of it is used, over how many days.
  const last = rows.filter(r => r.limit_percent != null).sort((a, b) => Date.parse(b.ended_at) - Date.parse(a.ended_at))[0];
  out.limit = last ? Number(last.limit_percent) : null;
  out.limitDays = last?.limit_window_minutes ? Math.round(last.limit_window_minutes / 1440) : null;
  return out;
}

// The last week's runs of one agent added up: tokens, cost at API prices (when every run has one) and
// the plan's limit as its app last logged it (Codex).
function dayUsage(rows) {
  if (!rows.length) return null;
  return {
    runs: rows.length,
    ...kinds(rows),
    // What the runs with a known price cost; a run whose model has no price doesn't hide the rest.
    cost: rows.some(r => r.cost_usd != null) ? rows.reduce((n, r) => n + Number(r.cost_usd ?? 0), 0) : null,
    app: rows[0].app,
  };
}

// The plans' limits the wake script reads every 10 minutes (Claude's weekly limit, Antigravity's Gemini quota):
// what share of each $1 at API prices takes (the rise of the used percent over what every local
// session of that app cost meanwhile, over the last week, within one window), and how much is used
// now. Neither app logs it per run as Codex does, so a run's share is its cost times this rate.
let limits = {};
// Claude gives whole percents: wait until enough has been spent for the rate to mean something;
// Antigravity's are exact.
const LIMIT_MIN = { claude: { usd: 20, pct: 2 }, antigravity: { usd: 2, pct: 0.3 }, grok: { usd: 1, pct: 0.1 }, kimi: { usd: 2, pct: 1 } };
// How many days a plan's limit lasts: a week, but Kimi's a month.
const LIMIT_DAYS = { kimi: 30 };
// Antigravity has a quota per group of models (as its settings show): Gemini 4 Argon, the other
// Gemini models, Claude and GPT. A run counts against its model's.
// (The Gemini group also holds Antigravity's orchestrator, on Neon.)
const quotaOf = model => { const m = (model || '').toLowerCase(); return m.startsWith('gemini-4-argon') ? 'gemini-4-argon' : m.startsWith('gemini') || m.startsWith('orchestrator') ? 'gemini' : 'claude-gpt'; };
const limitKey = r => (r.app === 'antigravity' ? `antigravity:${quotaOf(r.model)}` : r.app);
function limitRate(rows, min = { usd: Infinity, pct: Infinity }) {
  // A plan with no threshold here (Codex: its runs carry their own share) gets no rate, only its reading.
  let pct = 0, usd = 0;
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i];
    const sameWindow = a.week_resets_at && b.week_resets_at && Math.abs(Date.parse(a.week_resets_at) - Date.parse(b.week_resets_at)) < 3600e3;
    if (b.cost_usd == null || !sameWindow) continue;
    pct += Math.max(0, Number(b.week_percent) - Number(a.week_percent));
    usd += Number(b.cost_usd);
  }
  const last = rows[rows.length - 1];
  // With the cost since the window began (Antigravity, whose percent is exact): the used percent over it,
  // from the newest reading of this window by a computer whose runs cost something (another computer
  // reads the same quota, but with none of those runs it can't tell their cost).
  const same = r => r.week_resets_at && last?.week_resets_at && Math.abs(Date.parse(r.week_resets_at) - Date.parse(last.week_resets_at)) < 3600e3;
  const ref = rows.findLast(r => Number(r.window_cost_usd) > 0.5 && same(r));
  const windowRate = ref && Number(ref.week_percent) >= min.pct ? Number(ref.week_percent) / Number(ref.window_cost_usd) : null;
  // Used now: the most of this window's readings, since a week's use only grows (a reading behind the
  // others, from an app that answered with an old figure, doesn't pull it back).
  const week = last ? Math.max(...rows.filter(same).map(r => Number(r.week_percent)), Number(last.week_percent)) : null;
  return { perDollar: windowRate ?? (usd >= min.usd && pct >= min.pct ? pct / usd : null), week, resets: last?.week_resets_at ? Date.parse(last.week_resets_at) : null };
}
// A run's share of its plan's weekly limit, from its cost (Claude, Antigravity); Codex runs keep what Codex logged,
// Grok Bot's hours the share the wake script worked out from their tokens.
const withLimit = r => {
  const l = limits[limitKey(r)];
  return r.limit_used == null && r.cost_usd != null && l?.perDollar != null
    ? { ...r, limit_used: Number(r.cost_usd) * l.perDollar, limit_percent: l.week, limit_window_minutes: (LIMIT_DAYS[limitKey(r)] ?? 7) * 1440 }
    : r;
};

export async function loadFunnels() {
  const now = Date.now();
  // All of them, page by page: a week of readings from two computers is more than one page (1000), and
  // the newest, which say how much is used now, come last.
  const readings = await all(() => supabase.from('limit_readings').select('app, quota, at, week_percent, week_resets_at, cost_usd, window_cost_usd')
    .gte('at', new Date(now - 8 * DAY).toISOString()).order('at').order('app').order('quota'));
  if (!readings.error) {
    const keys = [...new Set(readings.data.map(r => (r.quota ? `${r.app}:${r.quota}` : r.app)))];
    limits = Object.fromEntries(keys.map(k => [k, limitRate(readings.data.filter(r => (r.quota ? `${r.app}:${r.quota}` : r.app) === k), LIMIT_MIN[k.split(':')[0]])]));
  }
  const [funnels, reports, usage, keys] = await Promise.all([
    supabase.from('funnels')
      .select(`id, title, position, theme, source_url, guide_url, result, goal_total, goal_due, results, result_titles, output_flow_per_day,
        stages (key, position, label, count, active, fill_percent, flow_per_day),
        presence (agent, provider, display_name, zone, state, next_run_at, question_id, chat_url, run_added, status, summary, pause_reason, updated_at),
        questions (id, agent, question, answer, asked_at, answered_at, chat_url, reply, replied_at, reply_seen_at),
        agent_messages (id, agent, from_agent, text, reply, replied_at, reply_seen_at),
        person_tasks (id, position, title, detail, url, due_at, done_at),
        role_launch (agent, schedule, schedule_on, time_zone, mode, quota_limit, guide_url, computer,
          role_executors (id, position, enabled, app, computer, model, effort, new_chat, full_access, bot_id))`)
      // In the person's order (see saveFunnelOrder); new ones, not placed yet, after them by age.
      .order('position', { nullsFirst: false }).order('created_at'),
    all(() => supabase.from('count_reports')
      .select('funnel_id, stage_key, value, at')
      .gte('at', new Date(now - WINDOW_DAYS * DAY).toISOString())
      .order('at').order('id')),
    // A week of runs is more than one page of rows (1000): read them all.
    all(() => supabase.from('agent_usage')
      .select('funnel_id, agent, app, model, tokens, input_tokens, cache_read_tokens, cache_write_tokens, output_tokens, cost_usd, limit_percent, limit_used, limit_window_minutes, ended_at, wake_key_id')
      .gte('ended_at', new Date(now - 7 * DAY).toISOString()).order('ended_at').order('agent').order('run_key')),
    // The computers the runs came from (see computers).
    supabase.from('wake_keys').select('id, computer, os, inventory, last_used_at, created_at').order('created_at'),
  ]);
  if (funnels.error) throw funnels.error;
  computers = new Map((keys.data ?? []).map(k => [k.id, { name: k.computer, os: k.os }]));
  // What the person's computers can run for Goalcraft's launches: each app's models, from every computer.
  inventory = {};
  // The computers that run the wake script, in the order they were set up (the first is a role's main one by default).
  launchComputers = (keys.data ?? []).filter(k => k.computer).map(k => ({ name: k.computer, on: k.last_used_at && now - Date.parse(k.last_used_at) < 3 * 60e3,
    // The apps it has (Grok Bot when signed in there).
    apps: Object.entries(k.inventory ?? {}).filter(([app, v]) => app !== 'grok' || v.signed_in).map(([app]) => app) }));
  for (const k of keys.data ?? []) for (const [app, v] of Object.entries(k.inventory ?? {})) {
    const have = inventory[app] ??= { models: [], computers: [] };
    have.computers.push(k.computer);
    for (const m of v.models ?? []) {
      const id = typeof m === 'string' ? m : m.label;
      if (id && !have.models.includes(id)) have.models.push(id);
    }
  }
  if (reports.error) throw reports.error;
  // Token use is extra: without it (say, before the table exists) the board still loads.
  return funnels.data.map(f => toScene(f, reports.data, now, usage.error ? [] : usage.data.map(withLimit)));
}

// The person dragged their funnels into a new order: kept in the database, so every browser and
// computer shows it (the others redraw when the change reaches them).
export async function saveFunnelOrder(ids) {
  const { error } = await supabase.rpc('set_funnel_order', { ids });
  if (error) throw error;
}

export async function answer(questionId, text) {
  const { error } = await supabase.from('questions')
    .update({ answer: text, answered_at: new Date().toISOString() })
    .eq('id', questionId);
  return error?.message;
}

// Each plan's limit as last read, for the spending card's list: how much is used and when it resets
// (a week, Kimi's a month). Only weekly or monthly ones: Claude's 5-hour window isn't kept here.
export function planLimits() {
  return Object.entries(limits).filter(([, l]) => l.week != null)
    .map(([key, l]) => ({ key, used: l.week, resets: l.resets, days: LIMIT_DAYS[key.split(':')[0]] ?? 7 }));
}

// The person's wake scripts, one per computer: whether each runs (it checks in every 10 seconds), its
// version against the latest, and the agents whose runs it counted over the last week. The spending
// card shows them, since only runs on a computer with a running script are counted.
export async function wakeScripts() {
  const [keys, latest, counted] = await Promise.all([
    supabase.from('wake_keys').select('id, computer, script_version, last_used_at, problems').not('last_used_at', 'is', null).order('last_used_at', { ascending: false }),
    fetch(new URL('../wake/release.json', import.meta.url), { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).catch(() => null),
    all(() => supabase.from('agent_usage').select('wake_key_id, agent').gte('ended_at', new Date(Date.now() - 7 * DAY).toISOString()).order('ended_at')),
  ]);
  if (keys.error) throw keys.error;
  const agents = new Map();
  for (const r of counted.data ?? []) if (r.wake_key_id) agents.set(r.wake_key_id, new Set([...(agents.get(r.wake_key_id) ?? []), r.agent]));
  return {
    latest: latest?.version ?? null,
    computers: keys.data.map(k => ({
      computer: k.computer, version: k.script_version, seen: Date.parse(k.last_used_at), problems: k.problems ?? [],
      agents: [...(agents.get(k.id) ?? [])].sort(),
    })),
  };
}

// Every run's cost since a moment, for the spending chart: which funnel and agent, when, what it cost
// at API prices and its share of the plan's limit (Codex as logged; Claude at the measured rate).
export async function spending(from) {
  const { data, error } = await all(() => supabase.from('agent_usage')
    .select('funnel_id, agent, app, model, started_at, cost_usd, limit_used')
    .gte('started_at', new Date(from).toISOString()).order('started_at'));
  if (error) throw error;
  // limit: which limit its share is of ("claude", "codex", "antigravity:gemini-4-argon"…).
  return data.map(withLimit).map(r => ({ funnel: r.funnel_id, agent: r.agent, app: r.app, quota: limitKey(r), at: Date.parse(r.started_at),
    cost: r.cost_usd == null ? null : Number(r.cost_usd), limit: r.limit_used == null ? null : Number(r.limit_used) }));
}

// An agent's runs in its funnel over the last week (as its spending), newest first, for its card.
export async function runs(a) {
  const week = new Date(Date.now() - 7 * DAY).toISOString();
  const { data, error } = await all(() => supabase.from('agent_runs')
    .select('zone, started_at, ended_at, added, status, summary, app, model, chat_url, launch:role_launches!agent_runs_launch_id_fkey (reason, outcome, effort, computer)')
    .eq('funnel_id', a.f.id).eq('agent', a.agent).gte('started_at', week)
    .order('started_at', { ascending: false }));
  if (error) throw error;
  if (!data.length) return data;
  // Each run's tokens: every stretch the wake script counted goes to the one run it overlaps most
  // (a few minutes' slack for the agent's first and last signal).
  const from = data[data.length - 1].started_at;
  const { data: usedRows } = await all(() => supabase.from('agent_usage').select('app, model, started_at, ended_at, tokens, input_tokens, cache_read_tokens, cache_write_tokens, output_tokens, cost_usd, limit_used, limit_percent, limit_window_minutes')
    .eq('funnel_id', a.f.id).eq('agent', a.agent).gte('ended_at', from).order('ended_at').order('run_key'));
  const used = usedRows?.map(withLimit);
  if (!used?.length) return data;
  const pad = 5 * 60e3, mine = data.map(() => []);
  const span = r => [Date.parse(r.started_at) - pad, (r.ended_at ? Date.parse(r.ended_at) : Date.now()) + pad];
  for (const u of used) {
    const us = Date.parse(u.started_at), ue = Date.parse(u.ended_at);
    let best = -1, most = 0;
    data.forEach((r, i) => {
      const [s, e] = span(r), o = Math.min(ue, e) - Math.max(us, s);
      if (o >= 0 && (best < 0 || o > most)) { best = i; most = o; }
    });
    if (best >= 0) mine[best].push(u);
  }
  return data.map((r, i) => mine[i].length ? { ...r, usage: { ...kinds(mine[i]),
    cost: mine[i].some(u => u.cost_usd != null) ? mine[i].reduce((n, u) => n + Number(u.cost_usd ?? 0), 0) : null } } : r);
}

// A stage's history for its card: how much it grew each day (its reports' rises added up, as the
// tank's +N per day counts them), all of it, keyed by the local date "YYYY-MM-DD".
export async function history(f, j) {
  const key = j < f.stages.length ? f.stages[j].key : null;
  const { data, error } = await all(() => {
    const q = supabase.from('count_reports').select('value, at').eq('funnel_id', f.id).order('at').order('id');
    return key == null ? q.is('stage_key', null) : q.eq('stage_key', key);
  });
  if (error) throw error;
  // What each report added and when; the chart sums them by hour, day or week.
  const adds = [];
  for (let i = 1; i < data.length; i++) adds.push([Date.parse(data[i].at), Math.max(0, data[i].value - data[i - 1].value)]);
  return { adds, since: data.length ? Date.parse(data[0].at) : null };
}

// The person changed how Goalcraft starts a role, in its card: its settings, and its executors in order.
export async function saveLaunch(a, patch, executors) {
  const role = { funnel_id: a.f.id, agent: a.agent };
  const up = await supabase.from('role_launch').update(patch).match(role);
  if (up.error) return up.error.message;
  if (executors) {
    const del = await supabase.from('role_executors').delete().match(role);
    if (del.error) return del.error.message;
    if (executors.length) {
      const ins = await supabase.from('role_executors').insert(executors.map((e, i) => ({ ...role, position: i, enabled: e.enabled !== false, app: e.app,
        computer: e.computer || null, model: e.model || null, effort: e.effort || null, new_chat: e.app === 'grok' ? false : e.new_chat !== false,
        full_access: e.full_access !== false, bot_id: e.bot_id || null })));
      if (ins.error) return ins.error.message;
    }
  }
  return null;
}

// The person pressed Run now: Goalcraft starts the role at once (after a run of it already going).
export async function runNow(a) {
  const { error } = await supabase.from('role_launches').insert({ funnel_id: a.f.id, agent: a.agent, reason: 'manual' });
  return error?.message;
}

// The person wrote to an agent from its card; the agent reads it through MCP (get_messages).
export async function sendMessage(a, text) {
  const { error } = await supabase.from('agent_messages').insert({ funnel_id: a.f.id, agent: a.agent, text });
  return error?.message;
}

// The person closed the agent's replies: they stop showing. Replies to messages have "m:" ids.
export async function closeReplies(ids) {
  const now = new Date().toISOString();
  const msgs = ids.filter(id => id.startsWith('m:')).map(id => id.slice(2)), qs = ids.filter(id => !id.startsWith('m:'));
  const done = await Promise.all([
    qs.length && supabase.from('questions').update({ reply_seen_at: now }).in('id', qs),
    msgs.length && supabase.from('agent_messages').update({ reply_seen_at: now }).in('id', msgs),
  ]);
  return done.find(r => r?.error)?.error.message;
}

// Calls onChange (debounced) whenever an agent writes to this person's funnels.
export function watch(onChange) {
  let timer;
  const kick = () => { clearTimeout(timer); timer = setTimeout(onChange, 400); };
  const channel = supabase.channel('my-funnels');
  for (const table of ['funnels', 'stages', 'presence', 'questions', 'agent_messages', 'person_tasks', 'role_launch', 'role_executors']) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, kick);
  }
  channel.subscribe();
  return channel;
}
