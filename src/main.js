// The demo: made-up funnels from src/data.js, with time running fast.
import { FUNNELS, SUP_RUNS } from './data.js?v=7b91c735';
import { mountDashboard } from './dashboard.js?v=7b91c735';
import { t } from './i18n.js?v=7b91c735';

mountDashboard(FUNNELS, {
  clock: scene => t('demo.clock', Math.floor(scene.days) + 1),
  // Answers work as on your own dashboard; in the demo they go nowhere, the agent just carries on.
  onAnswer: async () => null,
  onMessage: async () => null,
  runs: demoRuns,
});

// Made-up last runs for an agent's card, the same each time for the same agent: a run every 6-12
// hours lasting 10-40 minutes, the newest still going while the agent works. Each run adds about
// the flow of its zone over the hours since the one before, shared with the other agent there, and
// all ten together never add more than the stage now holds. Zones as in MCP (the scene's + 1).
function demoRuns(a) {
  let seed = [...a.f.title + a.agent].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const r = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  // The supervisor: a short check every few hours, each with the status it ended on; the newest is
  // its current one.
  if (a.sup) {
    const now = Date.now(), rows = [];
    let start = now - (a.state === 'sleep' ? 1 + r() * 3 : 0.1) * 3600e3;
    for (let i = 0; i < 8; i++) {
      const going = i === 0 && a.state === 'work';
      rows.push({ started_at: new Date(start).toISOString(), ended_at: going ? null : new Date(start + (3 + r() * 6) * 60e3).toISOString(),
        status: i === 0 ? a.status : SUP_RUNS[Math.floor(r() * SUP_RUNS.length)] });
      start -= (3 + r() * 3) * 3600e3;
    }
    return withTokens(a, rows, r);
  }
  const z = a.zone + 1, st = a.f.stages, holds = z < st.length ? st[z].count : a.f.cubes;
  const perDay = a.f.flows[z] || 0, crew = Math.max(1, a.f.workers.filter(w => w.zone === a.zone).length);
  const now = Date.now(), rows = [];
  let start = now - (a.state === 'sleep' ? 2 + r() * 4 : 0.2 + r() * 0.3) * 3600e3, left = holds;
  for (let i = 0; i < 10; i++) {
    const going = i === 0 && a.state !== 'sleep', gap = 6 + r() * 6;
    const ended = going ? null : start + (10 + r() * 30) * 60e3;
    const share = perDay * (gap / 24) / crew * (0.5 + r());
    const added = Math.max(0, Math.min(left, going ? a.shownAdded ?? a.added ?? 0 : Math.floor(share) + (r() < share % 1 ? 1 : 0)));
    left -= added;
    rows.push({ zone: z, started_at: new Date(start).toISOString(), ended_at: ended && new Date(ended).toISOString(), added });
    start -= gap * 3600e3;
  }
  return withTokens(a, rows, r);
}

// Made-up token use, as the wake script reads it on the person's computer, priced as there: Claude
// (Claude Code, Opus 5.5) and ChatGPT (Codex, GPT-6.1 Sol, with its plan's weekly limit). Other agents
// run in web chats, whose use nobody outside can read, so they show none.
function withTokens(a, rows, r) {
  if (a.agent !== 'claude' && a.agent !== 'chatgpt') return rows;
  const claude = a.agent === 'claude';
  let limit = 6 + r() * 20;
  return rows.map(row => {
    const minutes = ((row.ended_at ? Date.parse(row.ended_at) : Date.now()) - Date.parse(row.started_at)) / 60e3;
    const tokens = Math.round(Math.max(0.4, minutes) * (0.25 + r() * 0.35) * 1e6);
    const read = Math.round(tokens * (claude ? 0.955 : 0.93)), output = Math.round(tokens * (0.008 + r() * 0.01));
    const write = claude ? Math.round(tokens * 0.025) : 0, input = tokens - read - output - write;
    const cost = claude ? (input * 4 + read * 0.2 + write * 8 + output * 20) / 1e6 : (input * 2 + read * 0.1 + output * 10) / 1e6;
    const took = claude ? null : Math.round(Math.max(0, minutes / 15));
    limit = Math.max(1, limit - (took ?? 0));
    return { ...row, usage: { tokens, input_tokens: input, cache_read_tokens: read, cache_write_tokens: write, output_tokens: output,
      cost, limit_used: took, ...(!claude && { limit: Math.round(limit), limitDays: 7 }) } };
  });
}
