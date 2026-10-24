// The dashboard page around the scene: sticky funnel titles, drag to reorder, popups.
// Shared by the demo (src/main.js) and the person's own funnels (src/live.js).
import { agentInfo, agentButton, chatLink, plural } from './data.js?v=ebd31f61';
import { Scene, CW, fmtCount, fmtDuration } from './scene.js?v=ebd31f61';
import { t, lang, tankView, flowUnit, setFlowUnit, FLOW_UNITS } from './i18n.js?v=ebd31f61';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
// Web chats open in a new tab; app links (claude://, codex://) hand over to the app without an
// empty tab and remember the web chat to fall back to.
const webOf = (url, info) => (/^https?:/.test(url || '') ? url : info.chat);
const opens = (url, web) => (/^https?:/.test(url) ? 'target="_blank" rel="noopener"' : `data-web="${esc(web)}"`);

// No app on this computer: the app link does nothing and the page keeps the focus, so after a
// moment the web chat opens instead.
// A clipboard: the person's tasks.
// An agent's state on its card, as an icon beside its name: a moon while it sleeps, a bolt while it works.
const STATE_ICONS = {
  'board.resting': '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg>',
  'board.working': '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M13.5 2 5 13.5h6L10 22l9-12h-6.5z"/></svg>',
};
// Bars going up: the agents' spending.
const SPEND_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 20h16M7 16v-4M12 16V7M17 16v-7"/></svg>';
const TASKS_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="1"/><path d="M9 4V2.5h6V4"/><path d="M8.5 10h7M8.5 14h7M8.5 18h4"/></svg>';

function openApp(e) {
  const link = e.target.closest('a[data-web]');
  if (!link) return;
  e.preventDefault();
  let left = false;
  const away = () => { left = true; };
  window.addEventListener('blur', away, { once: true });
  document.addEventListener('visibilitychange', away, { once: true });
  location.href = link.href;
  setTimeout(() => {
    window.removeEventListener('blur', away);
    if (!left && link.dataset.web) window.open(link.dataset.web, '_blank', 'noopener');
  }, 1500);
}

// opts.live: counts come from the agents, not the demo simulation.
// opts.clock(scene): text for the right corner of the header.
// opts.onAnswer(questionId, text): the person answered one of an agent's questions (live only).
// opts.onCloseReplies(ids): the person closed the agent's replies to their answers (live only).
export function mountDashboard(funnels, opts = {}) {
  const canvas = document.getElementById('scene');
  const scroller = document.getElementById('scroller');
  const track = document.getElementById('titles-track');
  const clock = document.getElementById('day');
  const pop = document.getElementById('pop');
  pop.addEventListener('click', openApp);
  const tip = document.createElement('div');
  tip.id = 'tip'; tip.hidden = true; document.body.append(tip);
  let scene = new Scene(canvas, funnels, { live: opts.live, grow: tankView === 'grow' });

  // Funnel order is the viewer's own arrangement, kept in this browser only.
  const ORDER_KEY = opts.orderKey || 'goalcraft-order';
  const loadOrder = () => {
    try { const saved = JSON.parse(localStorage.getItem(ORDER_KEY)); if (Array.isArray(saved)) scene.applyOrder(saved); } catch {}
  };
  const saveOrder = () => { try { localStorage.setItem(ORDER_KEY, JSON.stringify(scene.order())); } catch {} };
  loadOrder();

  // The scene has a fixed size, the same on every screen, a phone too: 100% is always the same, and
  // as many funnels show as fit, the rest reached with horizontal scroll. The viewer's zoom (the −
  // and + buttons, kept in this browser) scales it.
  const BASE = 1.6, ZOOMS = [0.6, 0.7, 0.8, 0.9, 1, 1.15, 1.3, 1.5, 1.75, 2], ZOOM_KEY = 'goalcraft-zoom';
  let zoom = 1;
  try { const z = Number(localStorage.getItem(ZOOM_KEY)); if (ZOOMS.includes(z)) zoom = z; } catch {}
  let scale = BASE * zoom;
  function layout() {
    if (scene.dpr !== (window.devicePixelRatio || 1)) scene.resize(scale, window.devicePixelRatio || 1);
    scroller.classList.toggle('fits', scene.funnels.length * CW * scale <= scroller.clientWidth);
  }
  window.addEventListener('resize', layout);
  // The tanks' look picked in the profile menu: fixed or growing with what they hold.
  window.addEventListener('goalcraft-tanks', e => { scene.setGrow(e.detail === 'grow'); layout(); });

  // Zoom, in the top bar next to the logo: − 100% +; a click on the percentage goes back to 100%.
  // The point at the middle of the view stays in the middle.
  const zoomBox = document.createElement('span');
  zoomBox.id = 'zoom';
  zoomBox.innerHTML = `<button type="button" data-d="-1" aria-label="${esc(t('board.zoomOut'))}" title="${esc(t('board.zoomOut'))}">−</button><button type="button" class="pct" data-d="0"></button><button type="button" data-d="1" aria-label="${esc(t('board.zoomIn'))}" title="${esc(t('board.zoomIn'))}">+</button>`;
  document.querySelector('.sitebar .logo').after(zoomBox);
  // What the agents spent, over all funnels: a button at the start of the top bar's links.
  if (opts.spending) {
    const spendBtn = document.createElement('button');
    spendBtn.type = 'button'; spendBtn.className = 'spend-btn';
    spendBtn.title = t('spend.title');
    spendBtn.innerHTML = `${SPEND_ICON}<span class="wide">${esc(t('spend.button'))}</span>`;
    spendBtn.addEventListener('click', e => { e.stopPropagation(); showSpend(e); });
    document.querySelector('.sitebar .links').prepend(spendBtn);
  }
  // The bar in one line: compact (the logo's mark, − + only) when it doesn't fit, tighter still if
  // it doesn't fit then either, and at the tightest (a 320px phone) only the sign-in or profile link. Checked when the window or the bar's text changes.
  const bar = document.querySelector('.sitebar');
  const fitBar = () => {
    bar.classList.remove('compact', 'tight', 'tightest');
    for (const level of ['compact', 'tight', 'tightest']) {
      if (bar.scrollWidth <= bar.clientWidth + 1) break;
      bar.classList.add(level);
    }
  };
  new ResizeObserver(fitBar).observe(bar.querySelector('.links'));
  window.addEventListener('resize', fitBar);
  const zoomButtons = () => zoomBox.querySelectorAll('button').forEach(b => {
    if (b.dataset.d === '0') { b.textContent = Math.round(zoom * 100) + '%'; b.disabled = zoom === 1; return; }
    const i = ZOOMS.indexOf(zoom) + Number(b.dataset.d); b.disabled = i < 0 || i >= ZOOMS.length;
  });
  zoomButtons();
  zoomBox.addEventListener('click', e => {
    const b = e.target.closest('button'), d = b && Number(b.dataset.d), next = b && (d === 0 ? 1 : ZOOMS[ZOOMS.indexOf(zoom) + d]);
    if (!next || next === zoom) return;
    const cx = (scroller.scrollLeft + scroller.clientWidth / 2) / scale, cy = (scroller.scrollTop + scroller.clientHeight / 2) / scale;
    zoom = next;
    try { localStorage.setItem(ZOOM_KEY, String(zoom)); } catch {}
    scale = BASE * zoom;
    hidePop(); tip.hidden = true;
    scene.resize(scale, window.devicePixelRatio || 1);
    layout(); buildTitles(); zoomButtons();
    scroller.scrollLeft = cx * scale - scroller.clientWidth / 2;
    scroller.scrollTop = cy * scale - scroller.clientHeight / 2;
  });
  // Drawn once the fonts are in: then the loading pickaxe goes (see .loader in dashboard.css).
  const ready = () => requestAnimationFrame(() => document.body.classList.add('ready'));
  if (document.fonts) document.fonts.ready.then(() => { scene.resize(scale, window.devicePixelRatio || 1); ready(); fitNames(); });
  else ready();
  layout();

  // Sticky header: one title per funnel column, kept aligned with the scene while it scrolls.
  // A red badge shows how many questions in that funnel wait for you, an amber one how many of its
  // agents have not been heard from in time (the warning triangles).
  // Rebuilt only when the titles themselves change (order, names, zoom): new data from the agents
  // every few seconds keeps the same buttons, so a click on one is never lost mid-press (Safari).
  let titlesBuilt = '';
  function buildTitles() {
    const built = [scale, track.parentElement.clientHeight, ...scene.funnels.map(f => `${f.id ?? ''}:${f.title}:${f.theme ?? ''}`)].join('|');
    if (built === titlesBuilt) return;
    titlesBuilt = built; badgesShown = '';
    track.innerHTML = scene.funnels.map((f, fi) =>
      `<div class="col-title" data-fi="${fi}" style="left:${fi * CW * scale}px;width:${CW * scale}px">
        <button type="button" class="tasks-btn" hidden>${TASKS_ICON}<span></span></button><span class="name">${esc(f.title)}</span><span class="badge" hidden></span><span class="badge warn" hidden></span></div>`).join('');
    const h = track.parentElement.clientHeight / scale;
    track.querySelectorAll('.col-title').forEach(el => {
      el.style.backgroundImage = `url(${scene.titleStrip(+el.dataset.fi, h).toDataURL()})`;
    });
    fitNames();
  }
  // A long name wraps to two lines; its box then spans the whole column and pushes the badges to the
  // edges. Shrink it to its longest line, so the name stays centred with the badges beside it.
  function fitNames() {
    track.querySelectorAll('.col-title .name').forEach(name => {
      name.style.width = '';
      const range = document.createRange(); range.selectNodeContents(name);
      const lines = [...range.getClientRects()];
      if (new Set(lines.map(r => Math.round(r.top))).size < 2) return;
      name.style.width = Math.ceil(Math.max(...lines.map(r => r.width))) + 1 + 'px';
    });
  }
  let badgesShown = '';
  // Written only when different: the board calls this every frame, and rewriting the buttons under
  // the pointer that often makes Safari drop clicks on them.
  const put = (el, key, v) => { if (el[key] !== v) el[key] = v; };
  function syncTitles() {
    put(track.style, 'transform', `translateX(${canvas.getBoundingClientRect().left - track.parentElement.getBoundingClientRect().left}px)`);
    track.querySelectorAll('.col-title').forEach(el => {
      const f = scene.funnels[+el.dataset.fi], n = scene.waitingFor(f), badge = el.querySelector('.badge:not(.warn)');
      put(badge, 'hidden', !n);
      put(badge, 'textContent', String(n));
      put(badge, 'title', n ? t('board.waiting', n) : '');
      const s = scene.silentIn(f), warn = el.querySelector('.badge.warn');
      put(warn, 'hidden', !s);
      put(warn, 'textContent', String(s));
      put(warn, 'title', s ? t('board.silent', s) : '');
      // The person's tasks the supervisor keeps for this funnel: how many, opening the list.
      const k = f.tasks?.length || 0, tb = el.querySelector('.tasks-btn');
      put(tb, 'hidden', !k);
      put(tb.lastChild, 'textContent', String(k));
      put(tb, 'title', k ? t('tasks.count', k) : '');
    });
    // Badges that come or go change the room the names have: fit them again.
    const now = [...track.querySelectorAll('.col-title .badge, .col-title .tasks-btn')].map(b => b.hidden ? '-' : b.textContent).join('|');
    if (now !== badgesShown) { badgesShown = now; fitNames(); }
  }
  buildTitles();

  let last = performance.now();
  // An agent's reply to the person's answer shows at once as a note over its head, with just the
  // text and a × that closes it.
  const notes = new Map();
  function syncNotes() {
    const r = canvas.getBoundingClientRect(), box = scroller.getBoundingClientRect(), seen = new Set();
    for (const a of scene.agents) {
      const reply = a.replies?.[a.replies.length - 1];
      if (!reply || !a.noteAt) continue;
      const key = reply.id;
      seen.add(key);
      let el = notes.get(key);
      if (!el) {
        el = document.createElement('div');
        el.className = 'agent-note';
        el.innerHTML = `<span></span><button aria-label="${esc(t('board.close'))}">×</button>`;
        el.querySelector('span').textContent = reply.reply;
        el.querySelector('button').addEventListener('click', () => {
          const ids = a.replies.map(x => x.id);
          a.replies = [];
          el.remove(); notes.delete(key);
          if (opts.onCloseReplies) opts.onCloseReplies(ids.filter(id => !String(id).startsWith('demo')));
        });
        document.body.append(el);
        notes.set(key, el);
      }
      const x = r.left + a.noteAt.x * scene.scale, y = r.top + a.noteAt.y * scene.scale;
      el.hidden = x < box.left || x > box.right || y < box.top || y > box.bottom;
      // Kept inside the window; the tail still points at the agent.
      const w = el.offsetWidth, left = Math.max(8, Math.min(window.innerWidth - w - 8, x - w / 2));
      el.style.left = left + 'px'; el.style.top = y + 'px';
      el.style.setProperty('--tail', Math.max(12, Math.min(w - 12, x - left)) + 'px');
    }
    for (const [key, el] of notes) if (!seen.has(key)) { el.remove(); notes.delete(key); }
  }

  function frame(now) {
    scene.update(Math.min(0.1, (now - last) / 1000));
    last = now;
    scene.render();
    syncTitles();
    syncNotes();
    if (opts.clock) clock.textContent = opts.clock(scene);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function toLogical(e) {
    const r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) / scene.scale, (e.clientY - r.top) / scene.scale];
  }

  // A stage's history: bars of how much it grew each hour, day or week (the person's flow unit) over
  // a period they pick, with the period's total and average; hovering a bar shows its time.
  const PERIODS = { h: [24, 72, 168, 0], d: [7, 30, 90, 0], w: [8, 26, 52, 0] };
  const periodLabel = (u, p) => !p ? t('hist.all') : u === 'h' ? t('hist.days', p / 24) : u === 'w' ? t('hist.weeks', p) : t('hist.days', p);
  // Where a bar starts: the hour, the day (local midnight) or the week (Monday) a moment falls in,
  // and the start of the next one.
  const barStart = (u, ms) => {
    const d = new Date(ms);
    if (u === 'h') { d.setMinutes(0, 0, 0); return d; }
    d.setHours(0, 0, 0, 0);
    if (u === 'w') d.setDate(d.getDate() - (d.getDay() + 6) % 7);
    return d;
  };
  const nextBar = (u, d) => {
    const n = new Date(d);
    if (u === 'h') n.setHours(n.getHours() + 1); else n.setDate(n.getDate() + (u === 'w' ? 7 : 1));
    return n;
  };
  const periodKey = u => `goalcraft-period-${u}`;
  async function showHistory(e, f, j) {
    const st = f.stages[j], name = plural(5, st.forms);  // as the tank's tooltip: "found jobs", "найденных вакансий"
    showPop(e, `<div class="pop-title">${esc(f.title)}: ${esc(name)}</div><div class="hist-body"><p class="pop-note">…</p></div>`);
    let data;
    try { data = await opts.history(f, j); } catch { pop.querySelector('.hist-body').innerHTML = `<p class="pop-note">${esc(t('hist.failed'))}</p>`; return; }
    const body = pop.querySelector('.hist-body');
    if (!body) return;
    // The flow unit can change while the chart is open (its own switch, the profile menu): the bars
    // are summed again.
    let u, fmt, short, all, sums, periods, period;
    const prepare = () => {
    u = flowUnit;
    fmt = u === 'h' ? new Intl.DateTimeFormat(lang, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
      : new Intl.DateTimeFormat(lang, { weekday: 'short', day: 'numeric', month: 'short' });
    short = new Intl.DateTimeFormat(lang, u === 'h' ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short' });
    // Every bar from the first report to now. A period shows only when there is more history than
    // it holds; all of it always shows.
    all = [];
    for (let d = barStart(u, data.since ?? Date.now()), end = Date.now(); d <= end; d = nextBar(u, d)) all.push(d);
    sums = new Map(all.map(d => [d.getTime(), 0]));
    for (const [at, n] of data.adds) { const k = barStart(u, at).getTime(); if (sums.has(k)) sums.set(k, sums.get(k) + n); }
    periods = PERIODS[u].filter(p => !p || all.length > p);
    period = PERIODS[u][1];
    try { const p = localStorage.getItem(periodKey(u)); if (p !== null && PERIODS[u].includes(Number(p))) period = Number(p); } catch {}
    };
    const avgFmt = new Intl.NumberFormat(lang, { maximumFractionDigits: 1 });
    const draw = () => {
      // The bars of the period, oldest first, up to now; the average is over these bars.
      const shown = periods.includes(period) ? period : 0;
      const bars = shown ? all.slice(-shown) : all, n = bars.length;
      const vals = bars.map(d => sums.get(d.getTime())), sum = vals.reduce((a, b) => a + b, 0);
      // The y axis: round steps (1, 2 or 5 times a power of ten), three or four lines up to the top.
      const top0 = Math.max(1, ...vals), unit = Math.max(1, 10 ** Math.floor(Math.log10(top0 / 3)));
      const step = [1, 2, 5, 10].map(m => m * unit).find(v => top0 / v <= 4), max = Math.ceil(top0 / step) * step;
      const ticks = Array.from({ length: max / step + 1 }, (_, i) => i * step);
      const when = d => u === 'w' ? `${short.format(d)} – ${short.format(new Date(nextBar(u, d) - 864e5))}` : fmt.format(d);
      // Hour, day or week, a letter each, on the right: the same switch as Flows in the profile menu,
      // for the whole board; hovering names it in full.
      const units = `<div class="hist-periods hist-units">${FLOW_UNITS.map(x => `<button type="button" data-u="${x}" class="${x === u ? 'on' : ''}" title="${esc(t('flow.' + x))}" aria-label="${esc(t('flow.' + x))}">${esc([...t('units')[x]][0])}</button>`).join('')}</div>`;
      body.innerHTML = `<div class="hist-controls">${periods.length > 1 ? `<div class="hist-periods">${periods.map(p => `<button type="button" data-p="${p}" class="${p === shown ? 'on' : ''}">${esc(periodLabel(u, p))}</button>`).join('')}</div>` : '<span></span>'}${units}</div>
        <p class="pop-note">${esc(t('hist.total', fmtCount(sum), avgFmt.format(sum / n), t('flow.' + u)))}</p>
        <div class="hist-chart"><div class="hist-y">${ticks.map(v => `<span style="bottom:${(v / max) * 100}%">${esc(fmtCount(v))}</span>`).join('')}</div>
          <div class="hist-plot">${ticks.map(v => `<b style="bottom:${(v / max) * 100}%"></b>`).join('')}
            <div class="hist-bars${n > 60 ? ' dense' : ''}">${bars.map((d, i) => `<span data-tip="${esc(`${when(d)}: +${fmtCount(vals[i])}`)}"><i style="height:${vals[i] ? Math.max(1.5, (vals[i] / max) * 100) : 0}%"></i></span>`).join('')}</div></div></div>
        <div class="hist-axis"><span>${esc(short.format(bars[0]))}</span><span>${esc(short.format(bars[n - 1]))}</span></div>`;
      body.querySelectorAll('.hist-units button').forEach(b => b.addEventListener('click', ev => {
        ev.stopPropagation();
        setFlowUnit(b.dataset.u);
      }));
      body.querySelectorAll('.hist-periods:not(.hist-units) button').forEach(b => b.addEventListener('click', ev => {
        ev.stopPropagation();
        period = Number(b.dataset.p);
        try { localStorage.setItem(periodKey(u), String(period)); } catch {}
        draw();
      }));
    };
    prepare();
    draw();
    // Redrawn in the new unit, from here or from the profile menu, while this chart is open.
    const onUnit = () => { if (!body.isConnected) return window.removeEventListener('goalcraft-flow', onUnit); prepare(); draw(); };
    window.addEventListener('goalcraft-flow', onUnit);
  }

  // The agents' spending over all funnels: bars per hour, day or week (the flow unit), each split by
  // funnel or by agent, in $ at API prices or as a share of the Claude or Codex plan's limit; a
  // funnel picked in the legend narrows it to that funnel, by agent. Under it, the agents by spend.
  const SPEND_COLORS = ['#9FE870', '#79B4F0', '#F2C14E', '#F28AB8', '#B585F2', '#7CF0B0', '#FF8A5B', '#E8E3D8', '#5BC0BE', '#C9A27E'];
  const spendState = { measure: '$', split: 'funnel', funnel: null };
  async function showSpend(e) {
    showPop(e, `<div class="pop-title">${esc(t('spend.title'))}</div><div class="hist-body"><p class="pop-note">…</p></div>`);
    pop.classList.add('wide');
    const body = pop.querySelector('.hist-body');
    let rows;
    try { rows = await opts.spending(Date.now() - 366 * 864e5); } catch { body.innerHTML = `<p class="pop-note">${esc(t('hist.failed'))}</p>`; return; }
    if (!body.isConnected) return;
    if (!rows.length) { body.innerHTML = `<p class="pop-note">${esc(t('spend.none'))}</p>`; return; }
    // A run's funnel by its id (live) or title (demo); its name as on the board.
    const funnelOf = new Map(scene.funnels.map(f => [f.id ?? f.title, f]));
    const agentName = r => agentInfo(r.agent).name;
    const measures = ['$', ...['claude', 'codex', 'antigravity'].filter(app => rows.some(r => r.app === app && r.limit != null))];
    const value = r => spendState.measure === '$' ? r.cost : r.app === spendState.measure ? r.limit : null;
    const fmt = v => spendState.measure === '$' ? fmtCost(v) : fmtPercent(v);
    let u, all, period;
    const prepare = () => {
      u = flowUnit;
      all = [];
      for (let d = barStart(u, rows[0].at), end = Date.now(); d <= end; d = nextBar(u, d)) all.push(d);
      period = PERIODS[u][1];
      try { const p = localStorage.getItem(periodKey(u)); if (p !== null && PERIODS[u].includes(Number(p))) period = Number(p); } catch {}
    };
    const draw = () => {
      if (!measures.includes(spendState.measure)) spendState.measure = '$';
      const periods = PERIODS[u].filter(p => !p || all.length > p), shown = periods.includes(period) ? period : 0;
      const bars = shown ? all.slice(-shown) : all, n = bars.length, from = bars[0].getTime();
      // By funnel, by agent, or by service (Claude, ChatGPT, Gemini…: the agents' brands added up).
      const splits = spendState.funnel ? ['agent', 'vendor'] : ['funnel', 'agent', 'vendor'];
      const split = splits.includes(spendState.split) ? spendState.split : 'agent';
      const mine = rows.filter(r => r.at >= from && value(r) != null && (!spendState.funnel || r.funnel === spendState.funnel));
      const vendor = agent => agentInfo(agent.split(/[-_]/)[0]).name;
      const groupOf = r => split === 'funnel' ? r.funnel : split === 'vendor' ? vendor(r.agent) : `${r.agent}|${r.funnel}`;
      const label = k => split === 'funnel' ? funnelOf.get(k)?.title ?? '?' : split === 'vendor' ? k
        : `${agentInfo(k.split('|')[0]).name}${spendState.funnel ? '' : ' · ' + (funnelOf.get(k.split('|').slice(1).join('|'))?.title ?? '?')}`;
      // Groups, the biggest first (at the bottom of each bar, first in the legend), each with its colour.
      const totals = new Map(), runs = new Map();
      for (const r of mine) { const k = groupOf(r); totals.set(k, (totals.get(k) || 0) + value(r)); runs.set(k, (runs.get(k) || 0) + 1); }
      const groups = [...totals.keys()].sort((a, b) => totals.get(b) - totals.get(a));
      const color = new Map(groups.map((k, i) => [k, SPEND_COLORS[i % SPEND_COLORS.length]]));
      const index = new Map(bars.map((d, i) => [d.getTime(), i]));
      const cells = bars.map(() => new Map());
      for (const r of mine) {
        const i = index.get(barStart(u, r.at).getTime());
        if (i != null) cells[i].set(groupOf(r), (cells[i].get(groupOf(r)) || 0) + value(r));
      }
      const sums = cells.map(c => [...c.values()].reduce((a, b) => a + b, 0)), sum = sums.reduce((a, b) => a + b, 0);
      const top0 = Math.max(spendState.measure === '$' ? 1 : 0.1, ...sums);
      const unit = 10 ** Math.floor(Math.log10(top0 / 3));
      const step = [1, 2, 5, 10].map(m => m * unit).find(v => top0 / v <= 4), max = Math.ceil(top0 / step) * step;
      const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
      const fmtTime = u === 'h' ? new Intl.DateTimeFormat(lang, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
        : new Intl.DateTimeFormat(lang, { weekday: 'short', day: 'numeric', month: 'short' });
      const short = new Intl.DateTimeFormat(lang, u === 'h' ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short' });
      const when = d => u === 'w' ? `${short.format(d)} – ${short.format(new Date(nextBar(u, d) - 864e5))}` : fmtTime.format(d);
      const tipOf = (d, i) => [`${when(d)}: ${fmt(sums[i])}`, ...groups.filter(k => cells[i].get(k)).slice(0, 6).map(k => `${label(k)}: ${fmt(cells[i].get(k))}`)].join('\n');
      const btns = (list, on, attr, text) => list.map(x => `<button type="button" data-${attr}="${esc(x)}" class="${x === on ? 'on' : ''}">${esc(text(x))}</button>`).join('');
      const filtered = spendState.funnel ? funnelOf.get(spendState.funnel)?.title : null;
      body.innerHTML = `${filtered ? `<p class="spend-filter"><span>${esc(filtered)}</span> <button type="button" class="link spend-all">${esc(t('spend.allFunnels'))}</button></p>` : ''}
        <div class="hist-controls">${periods.length > 1 ? `<div class="hist-periods spend-periods">${btns(periods.map(String), String(shown), 'p', p => periodLabel(u, Number(p)))}</div>` : '<span></span>'}
          <div class="hist-periods hist-units">${FLOW_UNITS.map(x => `<button type="button" data-u="${x}" class="${x === u ? 'on' : ''}" title="${esc(t('flow.' + x))}" aria-label="${esc(t('flow.' + x))}">${esc([...t('units')[x]][0])}</button>`).join('')}</div></div>
        <div class="hist-controls">${measures.length > 1 ? `<div class="hist-periods spend-measure">${btns(measures, spendState.measure, 'm', m => m === '$' ? '$' : `% ${{ claude: 'Claude', codex: 'Codex', antigravity: 'Antigravity' }[m]}`)}</div>` : '<span></span>'}
          <div class="hist-periods spend-split">${btns(splits, split, 's', s => t({ funnel: 'spend.byFunnel', agent: 'spend.byAgent', vendor: 'spend.byVendor' }[s]))}</div></div>
        <div class="hist-chart"><div class="hist-y">${ticks.map(v => `<span style="bottom:${(v / max) * 100}%">${esc(spendState.measure === '$' ? '$' + fmtCount(v) : v + '%')}</span>`).join('')}</div>
          <div class="hist-plot">${ticks.map(v => `<b style="bottom:${(v / max) * 100}%"></b>`).join('')}
            <div class="hist-bars stacked${n > 60 ? ' dense' : ''}">${bars.map((d, i) => `<span data-tip="${esc(tipOf(d, i))}">${groups.filter(k => cells[i].get(k)).map(k => `<i style="height:${(cells[i].get(k) / max) * 100}%;background:${color.get(k)}"></i>`).join('')}</span>`).join('')}</div></div></div>
        <div class="hist-axis"><span>${esc(short.format(bars[0]))}</span><span>${esc(short.format(bars[n - 1]))}</span></div>
        <ul class="spend-list">${groups.slice(0, 12).map(k => `<li${split === 'funnel' ? ` data-f="${esc(k)}" class="pick" title="${esc(t('spend.pick'))}"` : ''}><i style="background:${color.get(k)}"></i><span class="who">${esc(label(k))}</span><span class="n">${esc(t('spend.runs', runs.get(k)))}</span><b>${esc(fmt(totals.get(k)))}</b></li>`).join('')}
          <li class="total"><i></i><span class="who">${esc(t('spend.all'))}</span><span class="n">${esc(t('spend.runs', mine.length))}</span><b>${esc(fmt(sum))}</b></li></ul>`;
      const on = (sel, fn) => body.querySelectorAll(sel).forEach(b => b.addEventListener('click', ev => { ev.stopPropagation(); fn(b); draw(); }));
      on('.spend-periods button', b => { period = Number(b.dataset.p); try { localStorage.setItem(periodKey(u), String(period)); } catch {} });
      on('.spend-measure button', b => { spendState.measure = b.dataset.m; });
      on('.spend-split button', b => { spendState.split = b.dataset.s; });
      on('.spend-list li.pick', b => { spendState.funnel = b.dataset.f; });
      on('.spend-all', () => { spendState.funnel = null; });
      body.querySelectorAll('.hist-units button').forEach(b => b.addEventListener('click', ev => { ev.stopPropagation(); setFlowUnit(b.dataset.u); }));
    };
    prepare();
    draw();
    const onUnit = () => { if (!body.isConnected) return window.removeEventListener('goalcraft-flow', onUnit); prepare(); draw(); };
    window.addEventListener('goalcraft-flow', onUnit);
  }

  // The person's tasks for a funnel, by its title. Only the supervisor adds, orders and marks them
  // done (MCP set_tasks); the person sees the list, most urgent first.
  track.addEventListener('click', e => {
    const b = e.target.closest('.tasks-btn');
    if (b) showPop(e, tasksCard(scene.funnels[+b.closest('.col-title').dataset.fi]));
  });
  function tasksCard(f) {
    const now = Date.now();
    const when = new Intl.DateTimeFormat(lang, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const items = (f.tasks || []).map(x => {
      const late = x.due_at && Date.parse(x.due_at) < now;
      const meta = [
        x.due_at && `<span class="${late ? 'late' : ''}">${esc(late ? t('tasks.overdue', when.format(new Date(x.due_at))) : t('tasks.due', when.format(new Date(x.due_at))))}</span>`,
        x.url && `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(t('tasks.open'))}</a>`,
      ].filter(Boolean).join(' · ');
      return `<li><div class="task-title">${esc(x.title)}</div>${x.detail ? `<div class="task-detail">${esc(x.detail)}</div>` : ''}${meta ? `<div class="task-meta">${meta}</div>` : ''}</li>`;
    }).join('');
    return `<div class="pop-title">${esc(t('tasks.title', f.title))}</div>
      <ol class="tasks">${items}</ol>`;
  }

  // Drag a funnel by its title in the header to reorder.
  let drag = null;
  track.addEventListener('pointerdown', e => {
    const el = e.target.closest('.col-title');
    if (!el || e.target.closest('.tasks-btn')) return;
    drag = { from: +el.dataset.fi, x0: e.clientX, moved: false };
    track.setPointerCapture(e.pointerId);
  });
  track.addEventListener('pointermove', e => {
    if (!drag) return;
    if (Math.abs(e.clientX - drag.x0) > 6) drag.moved = true;
    if (drag.moved) {
      scene.dropAt = Math.max(0, Math.min(scene.funnels.length, Math.round(toLogical(e)[0] / CW)));
      track.classList.add('dragging');
      hidePop();
    }
  });
  track.addEventListener('pointerup', () => {
    if (!drag) return;
    if (drag.moved && scene.dropAt !== null) { scene.moveFunnel(drag.from, scene.dropAt); saveOrder(); buildTitles(); }
    scene.dropAt = null; drag = null;
    track.classList.remove('dragging');
  });

  canvas.addEventListener('pointermove', e => {
    const h = scene.hitTest(...toLogical(e));
    canvas.style.cursor = h && h.type !== 'stage' && (h.type !== 'count' || opts.history) ? 'pointer' : 'default';
    // A tank shows only its number and flow; what it holds pops up on hover. The sheet on top says
    // where the list it opens is kept.
    if (!['stage', 'count', 'source', 'guide'].includes(h?.type) || e.pointerType === 'touch') return (tip.hidden = true);
    showTip(e, h);
  });
  let tipTimer;
  function showTip(e, h) {
    tip.classList.remove('over');
    if (h.type === 'source') tip.textContent = t('board.sheet', sheetPlace(h.url));
    else if (h.type === 'guide') tip.textContent = t('board.guide', sheetPlace(h.url));
    else {
      const s = scene.funnels[h.fi].stages[h.j], label = plural(s.count, s.forms);
      tip.textContent = label.charAt(0).toLocaleUpperCase(lang) + label.slice(1);  // Turkish: i → İ
    }
    tip.hidden = false;
    tip.style.left = Math.max(8, Math.min(window.innerWidth - tip.offsetWidth - 8, e.clientX + 14)) + 'px';
    tip.style.top = e.clientY + 18 + 'px';
  }
  canvas.addEventListener('pointerleave', () => { tip.hidden = true; });
  // The service a list or notes link leads to, by its address; any other site by its own name.
  function sheetPlace(url) {
    let host;
    try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
    if (host === 'docs.google.com') return /\/document\//.test(url + '/') ? 'Google Docs' : /\/presentation\//.test(url + '/') ? 'Google Slides' : 'Google Sheets';
    const known = [['docs.google.com', 'Google Sheets'], ['notion.so', 'Notion'], ['notion.site', 'Notion'], ['airtable.com', 'Airtable'],
      ['github.com', 'GitHub'], ['gitlab.com', 'GitLab'], ['trello.com', 'Trello'], ['coda.io', 'Coda'], ['clickup.com', 'ClickUp'],
      ['onedrive.live.com', 'Excel'], ['sharepoint.com', 'Excel'], ['dropbox.com', 'Dropbox'], ['basicmemory.com', 'Basic Memory']];
    return known.find(([d]) => host === d || host.endsWith('.' + d))?.[1] ?? host;
  }

  canvas.addEventListener('click', e => {
    const h = scene.hitTest(...toLogical(e));
    if (!h) return hidePop();
    // A tank's number and its +N open its history: how much it grew each day.
    if (h.type === 'count' && opts.history) { tip.hidden = true; return showHistory(e, scene.funnels[h.fi], h.j); }
    // A tap elsewhere on a tank shows what it holds for a moment, as on a phone with no hover.
    if (h.type === 'stage' || h.type === 'count') {
      hidePop(); showTip(e, h);
      clearTimeout(tipTimer); tipTimer = setTimeout(() => { tip.hidden = true; }, 2000);
      return;
    }
    // The sheets on top open the funnel's list straight away.
    if (h.type === 'source' || h.type === 'guide') { hidePop(); return window.open(h.url, '_blank', 'noopener'); }
    showPop(e, content(h));
    popAgent = h.type === 'agent' ? { a: h.a, named: h.a.shownName } : null;
    bindRuns(h.a);
    if (h.type === 'ask' && opts.onAnswer) bindAnswer(h.a);
    if (h.type === 'agent' && opts.onMessage) bindMessage(h.a);
  });

  // A supervisor's status word in its own colour: all good, bottleneck, recommendation, question.
  // Tokens as "12 млн", "850 тыс.": the person's language, one decimal at most.
  const compact = new Intl.NumberFormat(lang, { notation: 'compact', maximumFractionDigits: 1 });
  const fmtTokens = n => compact.format(n);
  const money = [0, 2].map(d => new Intl.NumberFormat(lang, { minimumFractionDigits: d, maximumFractionDigits: d }));
  const fmtCost = n => '$' + money[n >= 10 ? 0 : 1].format(n);
  const fmtPercent = n => new Intl.NumberFormat(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n) + '%';
  // A question to the person shows only one way, as the "!" with the question itself; an older run
  // that ended on status "question" (no longer a status) shows no status.
  // Usage of several runs added up (the demo's last week).
  const sumUsage = list => {
    const out = {};
    for (const k of ['tokens', 'input_tokens', 'cache_read_tokens', 'cache_write_tokens', 'output_tokens', 'cost', 'limit_used'])
      out[k] = list.some(x => x[k] != null) ? list.reduce((n, x) => n + (x[k] ?? 0), 0) : null;
    out.limit = list[0].limit ?? null; out.limitDays = list[0].limitDays ?? null;
    return out;
  };
  // The hover text for a cost: the tokens behind it by kind, the total, and how much of the plan's
  // limit it took (Codex).
  const usageTip = (u, limit) => [
    u.input_tokens != null && t('board.tokNew', fmtTokens(u.input_tokens)),
    u.cache_read_tokens != null && t('board.tokCacheRead', fmtTokens(u.cache_read_tokens)),
    u.cache_write_tokens > 0 && t('board.tokCacheWrite', fmtTokens(u.cache_write_tokens)),
    u.output_tokens != null && t('board.tokOut', fmtTokens(u.output_tokens)),
    t('board.tokTotal', fmtTokens(u.tokens)),
    limit != null && t('board.usageLimit', limit, u.limitDays),
  ].filter(Boolean).join('\n');
  const supStatus = s => s === 'question' ? '' : `<span class="sup-status st-${esc(s)}">${esc(t('board.supStatus.' + s))}</span>`;

  function content(h) {
    // An empty platform: the funnel has no supervisor yet; the Connect page tells how to appoint one.
    if (h.type === 'nosup') {
      return `<div class="pop-title">${esc(t('board.noSupervisor'))}</div>
        <p class="pop-note">${esc(t('board.noSupervisorText'))}</p>
        <a class="btn" href="../connect/#supervisor">${esc(t('board.appointSupervisor'))}</a>`;
    }
    const a = h.a, f = a.f;
    // A Gemini agent working in Google Antigravity (its link, or its spending read from there) opens
    // Antigravity, not the Gemini website (still the way when the app isn't on this computer).
    const inAntigravity = /^antigravity:/i.test(a.chat || '') || (!a.chat && a.usage?.app === 'antigravity');
    const info = inAntigravity ? { ...agentInfo(a.agent), product: 'Antigravity', app: null } : agentInfo(a.agent);
    // own: the agent's own chat, an app link (claude://, codex://, antigravity://) or a web one; web:
    // where to go when the app isn't on this computer.
    const own = a.chat || (inAntigravity ? 'antigravity://' : info.chat), web = webOf(own, info), chat = chatLink(info, own), paint = agentButton(info);
    // Its own name when it gave one; else a supervisor goes by its funnel, a worker by its model.
    const named = a.shownName = a.name || (a.sup ? t('board.supervisorName', f.title) : info.name), who = esc(named);
    // The step it works on, with what this run added (the last run's while it sleeps) to the items
    // it works into: "Job Search: jobs found → +4 applied". The supervisor watches the whole funnel:
    // what its last run found instead ("All good", "Bottleneck: …").
    let where;
    if (a.sup) {
      const found = a.status ? supStatus(a.status) : '';
      where = found ? `${found}${a.summary ? `: ${esc(a.summary)}` : ''}` : a.summary ? esc(a.summary) : esc(t('board.supervisorNoRun'));
    }
    else {
      // The card's number is kept for its runs list, so its running row says the same.
      const st = f.stages, n = a.shownAdded = a.added || 0, from = a.zone < 0 ? '' : `${esc(plural(5, st[a.zone].forms))} → `;
      const into = a.zone === st.length - 1 ? f.result : st[a.zone + 1].forms;
      where = `${from}<b class="run">+${fmtCount(n)}</b> ${esc(plural(n, into))}`;
    }
    // Live only: the agent's last runs, loaded when the person opens them.
    // Its last week's spending shows at once, above its runs (which open on a click).
    const history = opts.runs ? `<div class="runs-day"></div><details class="runs"><summary>${esc(t('board.runs'))}</summary><div class="runs-list"></div></details>` : '';
    // Overdue (it should have run by now) or silent at work: when it was last heard from.
    const missed = scene.overdue(a)
      ? `<p class="pop-note warn">${esc(t('board.lastSignal', fmtDuration(scene.t + (a.seenAgo || 0))))}</p>` : '';
    if (h.type === 'ask') {
      // Each open question with its own answer box and, beside Send, the chat it was asked from (or
      // the agent's chat): an agent working in several chats asks from each. The demo links to the
      // agent's chat instead.
      const openBtn = url => {
        const link = chatLink(info, url);
        return link ? `<a class="btn" href="${esc(link)}" ${opens(link, webOf(url, info))}>${esc(t('board.open', info.product || info.name))}</a>` : '';
      };
      // The first question (the one asked first) shows with its answer box; the rest fold under
      // "N more questions" and open with their own boxes.
      const askHtml = q => `<div class="ask" data-qid="${esc(q.id)}"><p>${esc(q.question)}</p>${opts.onAnswer
        ? `<textarea class="answer" rows="3" maxlength="2000" placeholder="${esc(t('board.answer'))}"></textarea>
          <div class="ask-buttons"><button class="btn primary send" style="${paint}">${esc(t('board.send'))}</button>${openBtn(q.chat || web)}</div>
          <div class="pop-msg"></div>` : ''}</div>`;
      const [first, ...rest] = a.questions;
      const asks = (first ? askHtml(first) : '') + (rest.length
        ? `<details class="more-asks"><summary>${esc(t('board.moreQuestions', rest.length))}</summary>${rest.map(askHtml).join('')}</details>` : '');
      const reply = opts.onAnswer ? ''
        : `<a class="btn primary" style="${paint}" href="${esc(chat)}" ${opens(chat, web)}>${esc(t('board.replyIn', info.product || info.name))}</a>`;
      // Standing, the agent is waiting and takes the answer at once; asleep, only on its next run.
      const asleep = a.state === 'sleep', left = scene.sleepLeft(a);
      const when = left > 0 ? fmtDuration(left) : null;
      return `<div class="pop-title">${t(asleep ? 'board.askedAsleep' : 'board.asking', who)}</div>
        <div class="pop-sub">${where}</div>
        ${asleep && !missed ? `<p class="pop-note">${esc(t('board.nextRun', when))}</p>` : ''}${missed}${asks}${reply}${history}`;
    }
    const lost = scene.lost(a) ? `<p class="pop-note warn">${esc(t('board.lastSignal', fmtDuration(scene.silence(a))))}</p>` : '';
    const wake = wakesText(a), wakes = `<p class="pop-note wakes"${wake ? '' : ' hidden'}>${esc(wake)}</p>`;
    // Write to it any time: it reads the message through MCP when it next checks in (at once if it
    // works now, or when the person's wake script wakes it).
    const write = opts.onMessage ? `<div class="write"><textarea class="message" rows="2" maxlength="2000" placeholder="${esc(t('board.message', named))}"></textarea>
        <div class="ask-buttons"><button class="btn primary send-message" style="${paint}">${esc(t('board.sendMessage'))}</button>${chat ? `<a class="btn" href="${esc(chat)}" ${opens(chat, web)}>${esc(t('board.open', info.product || info.name))}</a>` : ''}</div>
        <div class="pop-msg"></div></div>`
      : chat ? `<a class="btn" href="${esc(chat)}" ${opens(chat, web)}>${esc(t('board.open', info.product || info.name))}</a>` : '';
    return `<div class="pop-title" data-state="${agentState(a)}">${agentTitle(a, named)}</div>
      <div class="pop-sub">${where}</div>${wakes}${missed}${lost}
      ${write}${history}`;
  }

  // The runs list: when each run started, how long it took (or that it is still going) and what it
  // added to the items its zone works into.
  // The last week's spending: its cost at API prices and, when known, its share of the plan's weekly
  // limit (as Codex logged it; for Claude, its cost at the measured rate). Hovering shows tokens.
  const weekLine = u => {
    if (!u) return '';
    const share = u.limit_used != null ? fmtPercent(u.limit_used) : null;
    const tip = [u.cost != null && t('board.usageCost', fmtCost(u.cost)), usageTip(u, share)].filter(Boolean).join('\n');
    const what = u.cost != null ? fmtCost(u.cost) : t('board.tokens', fmtTokens(u.tokens));
    // One line: "Spent in 7 days: $695 · 31.1% of limit"; the prices and tokens behind it on hover.
    return `<p class="pop-note usage" data-tip="${esc(tip)}">${esc(t('board.usageDay', what))}${share ? ` · ${esc(t('board.usageShare', share))}` : ''}</p>`;
  };
  // A week of the demo's runs added up, when the agent has no count from the wake script.
  const weekOf = rows => {
    const week = rows.filter(r => r.usage && Date.now() - (r.ended_at ? Date.parse(r.ended_at) : Date.now()) < 7 * 864e5);
    return week.length ? sumUsage(week.map(r => r.usage)) : null;
  };
  function bindRuns(a) {
    const box = pop.querySelector('details.runs');
    if (!box) return;
    const dayBox = pop.querySelector('.runs-day');
    if (a.usage) dayBox.innerHTML = weekLine(a.usage);
    else if (!opts.live) Promise.resolve().then(() => opts.runs(a)).then(rows => { if (dayBox.isConnected) dayBox.innerHTML = weekLine(weekOf(rows)); }).catch(() => {});
    box.addEventListener('toggle', async () => {
      const list = box.querySelector('.runs-list');
      if (!box.open || list.dataset.loaded) return;
      list.dataset.loaded = 1;
      list.textContent = '…';
      try {
        const rows = await opts.runs(a);
        const st = a.f.stages, when = new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' });
        // Each run at API prices; hovering one shows its tokens by kind and its share of the plan's
        // limit: the week's share spread over the runs by their cost, to a tenth.
        const u = a.usage || weekOf(rows);
        const perDollar = u?.limit_used != null && u.cost > 0 ? u.limit_used / u.cost : null;
        const runLimit = ru => perDollar != null && ru.cost != null ? fmtPercent(ru.cost * perDollar)
          : ru.limit_used != null ? fmtPercent(ru.limit_used) : null;
        list.innerHTML = (rows.length ? rows.map(r => {
          const took = r.ended_at ? fmtDuration((Date.parse(r.ended_at) - Date.parse(r.started_at)) / 1000) : t('board.runNow');
          // A supervisor's run says what it found; a worker's run, what it added.
          const what = a.sup ? `<span>${r.status ? supStatus(r.status) : ''}</span>`
            : `<span><b class="run">+${fmtCount(r.added)}</b> ${esc(plural(r.added, r.zone < st.length ? st[r.zone].forms : a.f.result))}</span>`;
          const ru = r.usage, tok = ru ? `<span class="tok" data-tip="${esc(usageTip(ru, runLimit(ru)))}">${esc(
            ru.cost != null ? fmtCost(ru.cost) : t('board.tokens', fmtTokens(ru.tokens)))}</span>` : '';
          return `<div class="run-row"><span class="at">${esc(when.format(new Date(r.started_at)))}</span><span class="took">${esc(took)}</span>
            ${what}${tok}</div>`;
        }).join('') : `<div class="pop-note">${esc(t('board.noRuns'))}</div>`);
        pop.style.top = Math.max(8, Math.min(window.innerHeight - pop.offsetHeight - 8, pop.offsetTop)) + 'px';
      } catch { list.textContent = t('board.runsFailed'); delete list.dataset.loaded; }
    });
  }

  function bindMessage(a) {
    const box = pop.querySelector('.message'), send = pop.querySelector('.send-message'), msg = pop.querySelector('.write .pop-msg');
    if (!box) return;
    send.addEventListener('click', async () => {
      const text = box.value.trim();
      if (!text) return box.focus();
      send.disabled = true;
      const error = await opts.onMessage(a, text);
      if (error) { msg.textContent = error; send.disabled = false; return; }
      box.value = ''; send.disabled = false;
      msg.textContent = t('board.messageSent', a.name || (a.sup ? t('board.supervisorName', a.f.title) : agentInfo(a.agent).name)); msg.className = 'pop-msg ok';
      // The demo has no agent to read it: a moment later it answers back as a real one would.
      if (!opts.live) setTimeout(() => { a.replies = [...(a.replies || []), { id: 'demo-' + Date.now(), question: null, answer: text, reply: t('demo.reply') }]; }, 1500);
    });
  }

  function bindAnswer(a) {
    pop.querySelector('.answer')?.focus();
    pop.querySelectorAll('.ask[data-qid]').forEach(block => {
      const box = block.querySelector('.answer'), send = block.querySelector('.send'), msg = block.querySelector('.pop-msg');
      send.addEventListener('click', async () => {
        const text = box.value.trim();
        if (!text) return box.focus();
        send.disabled = true;
        const error = await opts.onAnswer(block.dataset.qid, text);
        if (error) { msg.textContent = error; send.disabled = false; return; }
        // Answered: that question goes. With none left, a waiting agent takes the answers at once
        // (back at work); a sleeping one keeps sleeping, its bubble gone.
        const asked = a.questions.find(q => q.id === block.dataset.qid)?.question;
        a.questions = a.questions.filter(q => q.id !== block.dataset.qid);
        block.remove();
        // The next folded question comes up in its place; the fold counts what is left.
        const more = pop.querySelector('.more-asks');
        if (more && ![...pop.querySelectorAll('.ask')].some(x => !x.closest('.more-asks'))) more.before(more.querySelector('.ask'));
        if (more) {
          const left = more.querySelectorAll('.ask').length;
          if (!left) more.remove(); else more.querySelector('summary').textContent = t('board.moreQuestions', left);
        }
        // The demo has no agent to reply: a moment later it answers back as a real one would.
        if (!opts.live) setTimeout(() => { a.replies = [...(a.replies || []), { id: 'demo-' + Date.now(), question: asked, answer: text, reply: t('demo.reply') }]; }, 1200);
        if (a.questions.length) return pop.querySelector('.answer')?.focus();
        if (a.state !== 'sleep') a.state = 'work';
        hidePop();
      });
    });
  }

  // What an agent is doing now, and the card's title that says it: its name with a moon or a bolt
  // while it sleeps or works, in words otherwise (starting or finishing a shift, overdue, silent).
  const agentState = a => scene.overdue(a) ? 'board.overdue' : scene.lost(a) ? 'board.lost' : a.state === 'sleep' ? 'board.resting'
    : a.state === 'walk' ? (a.to === 'work' ? 'board.starting' : 'board.finished')
      : 'board.working';
  function agentTitle(a, named) {
    const state = agentState(a), who = esc(named);
    return STATE_ICONS[state]
      ? `${who}<span class="state-icon ${state === 'board.resting' ? 'sleep' : 'work'}" role="img" title="${esc(t(state, named))}" aria-label="${esc(t(state, named))}">${STATE_ICONS[state]}</span>`
      : t(state, who);
  }
  // Asleep on time: when it wakes up.
  const wakesText = a => {
    const left = scene.sleepLeft(a);
    return a.state === 'sleep' && !scene.overdue(a) && left > 0 ? t('board.wakesIn', fmtDuration(left)) : '';
  };
  // An open agent's card follows it: when it falls asleep or starts work, the title changes too,
  // and the time to its wake-up counts down.
  let popAgent = null;
  setInterval(() => {
    const el = !pop.hidden && popAgent && pop.querySelector('.pop-title[data-state]');
    if (!el) return;
    if (el.dataset.state !== agentState(popAgent.a)) {
      el.dataset.state = agentState(popAgent.a);
      el.innerHTML = agentTitle(popAgent.a, popAgent.named);
    }
    const note = pop.querySelector('.pop-note.wakes'), wake = wakesText(popAgent.a);
    if (note && note.textContent !== wake) { note.textContent = wake; note.hidden = !wake; }
  }, 500);

  function showPop(e, html) {
    pop.classList.remove('wide');
    pop.innerHTML = `<button class="close" aria-label="${esc(t('board.close'))}">×</button>` + html;
    pop.querySelector('.close').addEventListener('click', hidePop);
    pop.hidden = false;
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    pop.style.left = Math.max(8, Math.min(window.innerWidth - pw - 8, e.clientX - pw / 2)) + 'px';
    pop.style.top = Math.max(8, Math.min(window.innerHeight - ph - 8, e.clientY + 14)) + 'px';
  }
  function hidePop() { pop.hidden = true; tip.hidden = true; }
  // A card grows after it opens (its runs, a chart, folded questions), or the window shrinks: it
  // moves up and left as much as it needs to stay whole on the screen.
  const keepPop = () => {
    if (pop.hidden) return;
    const top = parseFloat(pop.style.top) || 0, left = parseFloat(pop.style.left) || 0, h = pop.offsetHeight, w = pop.offsetWidth;
    if (top + h > window.innerHeight - 8) pop.style.top = Math.max(8, window.innerHeight - h - 8) + 'px';
    if (left + w > window.innerWidth - 8) pop.style.left = Math.max(8, window.innerWidth - w - 8) + 'px';
  };
  new ResizeObserver(keepPop).observe(pop);
  window.addEventListener('resize', keepPop);
  // A cost in the card shows its tokens by kind on hover, in the board's tooltip.
  pop.addEventListener('pointermove', e => {
    const el = e.target.closest('[data-tip]');
    if (!el || e.pointerType === 'touch') { if (tip.classList.contains('over')) tip.hidden = true; return; }
    tip.textContent = el.dataset.tip; tip.classList.add('over'); tip.hidden = false;
    tip.style.left = Math.max(8, Math.min(window.innerWidth - tip.offsetWidth - 8, e.clientX + 14)) + 'px';
    tip.style.top = Math.min(window.innerHeight - tip.offsetHeight - 8, e.clientY + 18) + 'px';
  });
  pop.addEventListener('pointerleave', () => { if (tip.classList.contains('over')) tip.hidden = true; });
  // A link in the card (Appoint a supervisor, Open in Claude…) takes the person elsewhere: the card
  // closes, so it isn't still open when they come back.
  pop.addEventListener('click', e => { if (e.target.closest('a[href]')) hidePop(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hidePop(); });
  document.addEventListener('pointerdown', e => {
    if (!pop.hidden && !pop.contains(e.target) && e.target !== canvas) hidePop();
  });
  // Scrolling moves the funnels under the pointer: a card or a tank's name over them would now point
  // at the wrong one.
  scroller.addEventListener('scroll', () => { hidePop(); tip.hidden = true; });

  return {
    // New data from the agents: rebuild the scene, keep the viewer's order and scroll.
    setFunnels(next) {
      if (!pop.hidden && pop.contains(document.activeElement)) return false; // typing an answer
      scene = new Scene(canvas, next, { live: opts.live, sides: scene.sides, heaps: scene.heaps, grow: scene.grow });
      loadOrder();
      scene.resize(scale, window.devicePixelRatio || 1);
      layout();
      buildTitles();
      return true;
    },
  };
}
