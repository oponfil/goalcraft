// The person's own funnels, written by their agents through MCP, redrawn when the agents write.
import { supabase } from './auth.js?v=65a915ad';

const DAY = 86400e3;
const WINDOW_DAYS = 7;

// Flow of one reported value (a stage count or the results), per day: how much it grew over the
// last 7 days, an average per day. Only increases count, so a stage that items leave does not read
// as negative. With less than a day of history the growth so far counts as one day's: +1 in the
// first hour is +1/d, not +24/d. Until there are two reports to compare it is 0: "+0/d".
function flowOf(reports, now) {
  if (reports.length < 2) return 0;
  let grew = 0;
  for (let i = 1; i < reports.length; i++) grew += Math.max(0, reports[i].value - reports[i - 1].value);
  const days = Math.max(1, (now - Date.parse(reports[0].at)) / DAY);
  return grew / days;
}

// Rows from the database → the funnels the scene draws (same shape as the demo in src/data.js).
// MCP zones start at 0 above the first stage; the scene's start at -1.
function toScene(f, reports, now, usage = []) {
  const stages = [...f.stages].sort((a, b) => a.position - b.position);
  const series = key => reports.filter(r => r.funnel_id === f.id && r.stage_key === key);
  return {
    id: f.id,
    title: f.title,
    theme: f.theme,
    result: f.result,
    source_url: f.source_url,
    guide_url: f.guide_url,
    stages: stages.map(s => ({ key: s.key, count: Number(s.count), forms: s.label })),
    // Flow per day: set by the agent, or the growth between its reports.
    flows: [...stages.map(s => (s.flow_per_day != null ? Number(s.flow_per_day) : flowOf(series(s.key), now))),
      f.output_flow_per_day != null ? Number(f.output_flow_per_day) : flowOf(series(null), now)],
    // Tank fill an agent set by hand, 0-1 (null = computed).
    manualFill: stages.map(s => (s.fill_percent == null ? null : Number(s.fill_percent) / 100)),
    cubes: f.results,
    goal: { total: f.goal_total, every: Number(f.goal_every_days) },
    workers: f.presence.filter(p => p.zone != null).map(p => agentOf(f, p, now, usage)),
    // The supervisor (no zone): on the platform at the top, with what its last run found.
    supervisor: f.presence.filter(p => p.zone == null).map(p => ({ ...agentOf(f, p, now, usage), status: p.status, summary: p.summary }))[0] ?? null,
  };
}

// One agent's presence → what the scene draws by it.
function agentOf(f, p, now, usage = []) {
      // The agent's unanswered questions, oldest first. An agent asking stands and waits for the
      // answers; one that went to sleep keeps them in a bubble and picks them up on its next run.
      // Once all are answered, an asking agent is shown back at work.
      const qs = f.questions.filter(q => q.agent === p.agent && !q.answered_at)
        .sort((a, b) => Date.parse(a.asked_at) - Date.parse(b.asked_at));
      const state = p.state === 'ask' && !qs.length ? 'work' : p.state;
      return {
        agent: p.agent,
        // Its own name ("Супервайзер поиска работы"), when it gave one.
        name: p.display_name,
        zone: p.zone == null ? null : p.zone - 1,
        state,
        wakeIn: p.state === 'sleep' && p.next_run_at ? (Date.parse(p.next_run_at) - now) / 1000 : null,
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
        // Its token use over the last day, as the person's wake script read it from the agent's own
        // session files (null: not known, e.g. a web chat).
        usage: dayUsage(usage.filter(u => u.funnel_id === f.id && u.agent === p.agent)),
        // What this run added (the last run's, while the agent sleeps); null = not known.
        added: p.run_added,
      };
}

// The last day's runs of one agent added up: tokens, cost at API prices (when every run has one) and
// the plan's limit as its app last logged it (Codex).
function dayUsage(rows) {
  if (!rows.length) return null;
  const last = rows.filter(r => r.limit_percent != null).sort((a, b) => Date.parse(b.ended_at) - Date.parse(a.ended_at))[0];
  return {
    runs: rows.length,
    tokens: rows.reduce((n, r) => n + Number(r.tokens), 0),
    cost: rows.every(r => r.cost_usd != null) ? rows.reduce((n, r) => n + Number(r.cost_usd), 0) : null,
    app: rows[0].app,
    limit: last ? Number(last.limit_percent) : null,
    limitDays: last?.limit_window_minutes ? Math.round(last.limit_window_minutes / 1440) : null,
  };
}

export async function loadFunnels() {
  const now = Date.now();
  const [funnels, reports, usage] = await Promise.all([
    supabase.from('funnels')
      .select(`id, title, theme, source_url, guide_url, result, goal_total, goal_every_days, results, output_flow_per_day,
        stages (key, position, label, count, fill_percent, flow_per_day),
        presence (agent, display_name, zone, state, next_run_at, question_id, chat_url, run_added, status, summary, updated_at),
        questions (id, agent, question, answer, asked_at, answered_at, chat_url, reply, replied_at, reply_seen_at),
        agent_messages (id, agent, from_agent, text, reply, replied_at, reply_seen_at)`)
      .order('created_at'),
    supabase.from('count_reports')
      .select('funnel_id, stage_key, value, at')
      .gte('at', new Date(now - WINDOW_DAYS * DAY).toISOString())
      .order('at'),
    supabase.from('agent_usage')
      .select('funnel_id, agent, app, tokens, cost_usd, limit_percent, limit_window_minutes, ended_at')
      .gte('ended_at', new Date(now - DAY).toISOString()),
  ]);
  if (funnels.error) throw funnels.error;
  if (reports.error) throw reports.error;
  // Token use is extra: without it (say, before the table exists) the board still loads.
  return funnels.data.map(f => toScene(f, reports.data, now, usage.error ? [] : usage.data));
}

export async function answer(questionId, text) {
  const { error } = await supabase.from('questions')
    .update({ answer: text, answered_at: new Date().toISOString() })
    .eq('id', questionId);
  return error?.message;
}

// An agent's last runs in its funnel, newest first, for its card.
export async function runs(a, limit = 10) {
  const { data, error } = await supabase.from('agent_runs')
    .select('zone, started_at, ended_at, added, status, summary')
    .eq('funnel_id', a.f.id).eq('agent', a.agent)
    .order('started_at', { ascending: false }).limit(limit);
  if (error) throw error;
  if (!data.length) return data;
  // Each run's tokens: every stretch the wake script counted goes to the one run it started in (the
  // latest run started by then, a couple of minutes' slack for the agent's first signal).
  const from = data[data.length - 1].started_at;
  const { data: used } = await supabase.from('agent_usage').select('started_at, ended_at, tokens, cost_usd')
    .eq('funnel_id', a.f.id).eq('agent', a.agent).gte('ended_at', from);
  if (!used?.length) return data;
  const pad = 2 * 60e3, mine = data.map(() => []);
  for (const u of used) {
    const i = data.findIndex(r => Date.parse(r.started_at) - pad <= Date.parse(u.started_at));
    if (i >= 0 && (!data[i].ended_at || Date.parse(u.started_at) <= Date.parse(data[i].ended_at) + pad)) mine[i].push(u);
  }
  return data.map((r, i) => mine[i].length ? { ...r, tokens: mine[i].reduce((n, u) => n + Number(u.tokens), 0),
    cost: mine[i].every(u => u.cost_usd != null) ? mine[i].reduce((n, u) => n + Number(u.cost_usd), 0) : null } : r);
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
  for (const table of ['funnels', 'stages', 'presence', 'questions', 'agent_messages']) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, kick);
  }
  channel.subscribe();
  return channel;
}
