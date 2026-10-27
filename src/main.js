// The demo: made-up funnels from src/data.js, with time running fast.
import { FUNNELS, SUP_RUNS } from './data.js?v=49da1b32';
import { mountDashboard } from './dashboard.js?v=49da1b32';
import { t } from './i18n.js?v=49da1b32';

mountDashboard(FUNNELS, {
  clock: scene => t('demo.clock', Math.floor(scene.days) + 1),
  // Answers work as on your own dashboard; in the demo they go nowhere, the agent just carries on.
  onAnswer: async () => null,
  onMessage: async () => null,
  runs: demoRuns,
  history: demoHistory,
  spending: demoSpending,
  limits: demoLimits,
});

// Made-up growth of a stage for its card, the same each time: about its flow per day, more on
// weekdays, over the last 120 days, each day's items spread over its waking hours.
async function demoHistory(f, j) {
  let seed = [...f.title + j].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 11);
  const r = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const flow = f.flows[j] || 0.3, adds = [], now = Date.now();
  for (let i = 119; i >= 0; i--) {
    const d = new Date(now - i * 864e5), weekend = d.getDay() === 0 || d.getDay() === 6;
    const v = flow * (weekend ? 0.4 : 1.2) * (0.3 + r() * 1.4) * Math.min(1, (130 - i) / 60);
    const n = Math.floor(v) + (r() < v % 1 ? 1 : 0);
    d.setHours(0, 0, 0, 0);
    for (let k = 0; k < n; k++) {
      const at = d.getTime() + (8 + r() * 15) * 3600e3;
      if (at <= now) adds.push([at, 1]);
    }
  }
  adds.sort((a, b) => a[0] - b[0]);
  const start = new Date(now - 119 * 864e5); start.setHours(0, 0, 0, 0);
  return { adds, since: start.getTime() };
}

// Made-up spending of every agent for the spending chart, the same each time: two to four runs a
// day over the last 120 days, priced as its model is (DEMO_PRICES), busier on weekdays; ChatGPT
// (Codex) also with its share of the plan's weekly limit, Claude with its share at a made-up rate.
// Made-up limits for the spending card's list: a few days to each reset.
function demoLimits() {
  const day = 864e5, now = Date.now();
  return [
    { key: 'claude', used: 62, resets: now + 2.4 * day, days: 7 },
    { key: 'codex', used: 35, resets: now + 4.1 * day, days: 7 },
    { key: 'antigravity:gemini-4-argon', used: 81, resets: now + 1.3 * day, days: 7 },
    { key: 'grok', used: 17, resets: now + 3.7 * day, days: 7 },
    { key: 'kimi', used: 31, resets: now + 13 * day, days: 30 },
  ];
}

async function demoSpending(from) {
  const out = [], now = Date.now();
  for (const f of FUNNELS) {
    for (const a of [...f.workers, ...(f.supervisor ? [{ ...f.supervisor, sup: true }] : [])]) {
      let seed = [...f.title + a.agent + (a.sup ? 'sup' : a.zone)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 5);
      const r = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
      const pr = DEMO_PRICES[a.agent] || DEMO_PRICES.gemini, size = a.sup ? 0.3 : 0.6 + r();
      for (let i = 119; i >= 0; i--) {
        const d = new Date(now - i * 864e5), weekend = d.getDay() === 0 || d.getDay() === 6;
        const n = Math.round((weekend ? 1.5 : 3) * (0.5 + r()));
        d.setHours(0, 0, 0, 0);
        for (let k = 0; k < n; k++) {
          const at = d.getTime() + (7 + r() * 16) * 3600e3;
          if (at > now || at < from) continue;
          const m = size * (2 + r() * 4);  // millions of tokens, nearly all re-read from the cache
          const cost = m * (0.03 * pr[0] + 0.95 * pr[1] + 0.01 * pr[3]);
          const app = { claude: 'claude', chatgpt: 'codex', gemini: 'antigravity' }[a.agent] ?? null;
          const quota = app === 'antigravity' ? 'antigravity:gemini-4-argon' : app;
          out.push({ funnel: f.title, agent: a.agent, app, quota, at, cost,
            limit: { chatgpt: cost * 0.9, claude: cost * 0.12, gemini: cost * 0.3 }[a.agent] ?? null });
        }
      }
    }
  }
  return out.sort((x, y) => x.at - y.at);
}

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
    // A week of them, like a live agent's card.
    for (let i = 0; start > now - 7 * 864e5; i++) {
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
  for (let i = 0; start > now - 7 * 864e5; i++) {
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

// Made-up token use, so the demo shows what an agent's runs cost: every agent, priced roughly as its
// model is on its API ($ per million tokens: input, input from the cache, cache writes, output), and
// for ChatGPT (Codex) its share of the plan's weekly limit too.
const DEMO_PRICES = {
  claude: [4, 0.2, 8, 20], chatgpt: [2, 0.1, 0, 10], gemini: [2, 0.2, 0, 12], grok: [3, 0.3, 0, 15],
  deepseek: [0.3, 0.03, 0, 1.1], kimi: [0.6, 0.15, 0, 2.5], qwen: [0.4, 0.08, 0, 1.6],
  mistral: [0.5, 0.05, 0, 1.5], perplexity: [1, 0.1, 0, 1], hermes: [0.5, 0.05, 0, 1.5],
};
function withTokens(a, rows, r) {
  const pr = DEMO_PRICES[a.agent] || DEMO_PRICES.gemini, codex = a.agent === 'chatgpt';
  return rows.map(row => {
    const minutes = ((row.ended_at ? Date.parse(row.ended_at) : Date.now()) - Date.parse(row.started_at)) / 60e3;
    const tokens = Math.round(Math.max(0.4, minutes) * (0.25 + r() * 0.35) * 1e6);
    const read = Math.round(tokens * (0.93 + r() * 0.03)), output = Math.round(tokens * (0.008 + r() * 0.01));
    const write = pr[2] ? Math.round(tokens * 0.025) : 0, input = tokens - read - output - write;
    const cost = (input * pr[0] + read * pr[1] + write * pr[2] + output * pr[3]) / 1e6;
    return { ...row, usage: { tokens, input_tokens: input, cache_read_tokens: read, cache_write_tokens: write, output_tokens: output,
      cost, limit_used: codex ? cost * 0.9 : null, limitDays: codex ? 7 : null } };
  });
}
