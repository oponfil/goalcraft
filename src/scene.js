import { agentInfo, plural } from './data.js?v=a12c2388';
import { drawStanding, drawLying, drawBoss, drawBossLying, drawSpyglass, drawPickaxe, drawShears, drawBeaker, drawBow, drawArrow, drawLaptop, drawStamp, drawHammer, drawSword, drawRollingPin, drawBubble, BUBBLE_STEP, HEAD_TOP, BOSS_TOP, line, P, MINER_H } from './sprites.js?v=a12c2388';
import { themeOf } from './themes.js?v=a12c2388';
import { t as tr, lang, fmtDuration, flowUnit } from './i18n.js?v=a12c2388';

// Logical (pixel-art) layout of one funnel column. Funnels have 2-5 tanks with a mining zone above
// each tank and one more below the last (the output zone, where results come out into flasks).
// The scene is tall enough for 5 tanks; shorter funnels end higher up. Titles live in the page header.
export const CW = 200;
// ZH: the height of a work zone between two tanks, the same as from the supervisor's platform down to
// the first tank.
const ZW = 164, TOP = 48, ZH = 45, LH = 40, MAX_STAGES = 5;
// The supervisor's platform: a small deck on top of the pipe; the supervisor walks from one end to
// the other and looks down from each.
const DECK_HALF = 28, DECK_Y = TOP;
// The plank is a little shorter than the walk: the supervisor's feet reach its ends.
const PLANK_HALF = 23;
// A tank holds one piece per item, up to what fits. Every theme's piece fits the same square cell, so
// a tank holds as many in every theme.
const CELL = 6;
// Seconds a tank takes to fill to its count when the board first shows.
const FIRST_FILL = 4;
const sameSize = P => ({ w: CELL, h: CELL, draw(c, x, y, ...rest) {
  const k = Math.min(CELL / P.w, CELL / P.h);
  c.save(); c.translate(x + (CELL - P.w * k) / 2, y + (CELL - P.h * k)); c.scale(k, k); P.draw(c, 0, 0, ...rest); c.restore();
} });
// The funnel's notes (left) and its list (right) hang in the air beside the platform's ends, DOC_W
// wide each, their bottoms a little above its floor.
const DOC_W = 18, GUIDE_X = -DECK_HALF - 5 - DOC_W, SHEET_X = DECK_HALF + 6, DOC_Y = DECK_Y - 25;
// The pixel layer is drawn at RES× the logical grid: scenery stays blocky, small pieces get finer pixels.
const RES = 2;
const tankTop = j => TOP + ZH + j * (LH + ZH);
const zoneTop = k => (k < 0 ? TOP : tankTop(k) + LH);
// Result items sit a little below the end of the last pipe.
const flasksY = n => zoneTop(n - 1) + ZH + 9;
export const H = flasksY(MAX_STAGES) + 50;
// Tall enough for the longest column: its tanks, the rows of result items and the four lines under them.
export const sceneHeight = funnels => Math.max(H, ...funnels.map(f =>
  f.geo.flasksY() + Math.ceil(slots(f) / PER_ROW) * 22 + 52));
// Result items under a funnel: one per result the goal needs, and more once agents go past it.
const slots = f => Math.max(f.goal?.total || 0, f.cubes || 0);
// The tanks make one funnel: their sides lie on two straight lines, from 184 wide at the top of the
// first tank to 26 at the bottom of the last, as wide as the work piece under it, so the
// gaps between the tanks cut one funnel. The angle follows the number of stages.
const tankHalf = (j, n, r) => {
  const y = j * (LH + ZH) + r, span = (n - 1) * (LH + ZH) + LH - 1;
  return Math.round(92 - 79 * y / span);
};
const tankW = (j, n) => tankHalf(j, n, 0) * 2;
// How many pieces each row of a tank lh tall holds, bottom row first, its half width at row r given
// by half(r): the heap's grid of CELL squares.
function rowsFit(half, lh) {
  const rows = [], count = Math.floor((lh - 3) / CELL);
  for (let r = 0; r < count; r++) {
    const hw = half(Math.max(1, Math.round(lh - 2 - (r + 1) * CELL))) - 1.5, k = Math.floor((hw * 2) / CELL);
    let fit = 0;
    for (let i = 0; i < k; i++) if (-(k * CELL) / 2 + i * CELL + (r % 2 ? CELL / 4 : 0) + CELL <= hw) fit++;
    rows.push(fit);
  }
  return rows;
}
// A funnel's geometry. Fixed (the usual view): every tank LH tall at its place. Growing (the
// person's choice in the profile menu): each tank just tall enough for what it holds, at least
// MIN_ROWS rows so its number fits and at most MAX_ROWS. In both, the tanks' sides lie on two
// straight lines, from 184 wide at the top of the first tank to 26 at the bottom of the last, and a
// tank that grows pushes everything below it down.
const MIN_ROWS = 3, MAX_ROWS = 30;  // 30 rows: about five fixed tanks tall; past that a tank is full
// What a growing tank holds at a given height and place on its funnel's lines, worked out once.
const capacities = new Map();
const capacity = (key, half, h) => {
  if (!capacities.has(key)) capacities.set(key, rowsFit(half, h).reduce((x, y) => x + y, 0));
  return capacities.get(key);
};
// Half the width of a funnel at y units below the first tank's top, the funnel span units tall.
const lineHalf = (y, span) => Math.round(92 - 79 * y / span);
function geometry(f, grow) {
  const n = f.stages.length;
  let lh = f.stages.map(() => (grow ? MIN_ROWS * CELL + 3 : LH));
  // Where each tank starts below the first one's top, and how tall the whole funnel is.
  const place = hs => {
    const at = []; let y = 0;
    for (const h of hs) { at.push(y); y += h + ZH; }
    return { at, span: y - ZH - 1 };
  };
  // Heights and widths depend on each other: lay the funnel out again until the heights settle.
  for (let pass = 0; grow && pass < 8; pass++) {
    const { at, span } = place(lh);
    const next = f.stages.map((s, j) => {
      for (let rows = MIN_ROWS; ; rows++) {
        const h = rows * CELL + 3, half = r => lineHalf(at[j] + r, span);
        if (rows >= MAX_ROWS || capacity(`${at[j]}|${span}|${h}`, half, h) >= s.count) return h;
      }
    });
    if (next.join() === lh.join()) break;
    lh = next;
  }
  const { at, span } = place(lh);
  const half = (j, h, r) => (grow ? lineHalf(at[j] + r, span) : tankHalf(j, n, r));
  const tops = [];
  for (let j = 0, y = TOP + ZH; j < n; j++) { tops.push(y); y += lh[j] + ZH; }
  const g = {
    key: lh.join(','),
    lh: j => lh[j],
    tankTop: j => tops[j],
    zoneTop: k => (k < 0 ? TOP : tops[k] + lh[k]),
    half: (j, r) => half(j, lh[j], r),
  };
  g.tankW = j => g.half(j, 0) * 2;
  g.flasksY = () => g.zoneTop(n - 1) + ZH + 9;
  g.plateTop = k => g.zoneTop(k) + ZH - PLATE_H;
  g.outPlateTop = k => g.plateTop(k) - OUT_LIFT;
  return g;
}
// The work piece in each zone (ore rock, flower bed…) sits on the pipe right above the tank below;
// agents stand on the tank's top edge as on a floor.
const PLATE_H = 11;
const plateTop = k => zoneTop(k) + ZH - PLATE_H;
const outPlateTop = k => plateTop(k) - OUT_LIFT;
// Below the last tank there is no tank to sit on: the plate moves up so the pipe runs on past it
// to where results drip out.
const OUT_LIFT = 5;
export const DAY_SECONDS = 2;
const PER_ROW = 10;  // result items per row under a funnel, the same for every theme
// As on the page: Vietnamese needs Be Vietnam Pro (Rubik has no Vietnamese letters), Japanese takes
// Noto Sans JP before the Chinese font, Korean Noto Sans KR.
const FONT = lang === 'vi' ? '"Be Vietnam Pro", system-ui, sans-serif'
  : lang === 'ja' ? '"Rubik", "Noto Sans JP", system-ui, sans-serif'
  : lang === 'ko' ? '"Rubik", "Noto Sans KR", system-ui, sans-serif'
    : '"Rubik", "Noto Sans Thai", "Noto Sans SC", system-ui, sans-serif';


function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16), ch = sh => Math.round(((n >> sh) & 255) * k);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

function rng(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export class Scene {
  // live: the agents report counts and states; nothing is simulated, agents keep their state.
  constructor(canvas, funnels, { live = false, sides = null, heaps = null, grow = false } = {}) {
    this.live = live;
    this.grow = grow;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.funnels = funnels.map(f => ({ ...f, stages: f.stages.map(s => ({ ...s })) }));
    for (const f of this.funnels) f.geo = geometry(f, grow);
    this.H = sceneHeight(this.funnels);
    this.lo = document.createElement('canvas');
    this.lctx = this.lo.getContext('2d');
    this.bg = document.createElement('canvas');
    this.floaters = [];
    // What each tank already holds is kept when the data refreshes (a new scene), so only new pieces
    // drop in; pieces still in the air land at once. A page load starts from empty and fills up.
    this.heaps = new Map();
    for (const [key, h] of heaps || []) this.heaps.set(key, { ...h, shown: h.shown + h.falling.length, falling: [], next: 0 });
    this.sparks = [];
    this.hits = [];
    this.dropAt = null;
    this.t = 0;
    this.days = 0;
    const r = rng(7);
    this.agents = [];
    // Two places per zone: left and right of the pipe; extra agents are not shown. An agent keeps
    // the side it had in the previous scene (sides: its map), so redraws don't swap agents around;
    // newcomers take the free side, in name order.
    const before = sides || new Map();
    this.sides = new Map();
    const place = [];
    this.funnels.forEach(f => {
      const zones = new Map();
      for (const w of f.workers) zones.set(w.zone, [...(zones.get(w.zone) || []), w]);
      for (const ws of zones.values()) {
        const sorted = [...ws].sort((p, q) => p.agent.localeCompare(q.agent)), used = new Set();
        const sideOf = new Map();
        for (const w of sorted) {
          const was = before.get(`${f.id ?? f.title}|${w.agent}`);
          if (was && !used.has(was)) { sideOf.set(w, was); used.add(was); }
        }
        for (const w of sorted) {
          if (sideOf.has(w)) continue;
          const free = ['L', 'R'].find(x => !used.has(x));
          if (!free) continue;
          sideOf.set(w, free); used.add(free);
        }
        for (const w of ws) if (sideOf.has(w)) place.push([f, w, sideOf.get(w)]);
      }
    });
    place.forEach(([f, w, side]) => {
      this.sides.set(`${f.id ?? f.title}|${w.agent}`, side);
      const a = { ...w, f, side, rand: r, hitAt: 1 + r() * 3, phase: r() };
      // Open questions, oldest first (the demo gives one as a plain string).
      a.questions = w.questions ?? (w.question ? [{ id: w.question_id ?? `demo-${w.agent}-${w.zone}`, question: w.question }] : []);
      a.replies = w.replies ?? [];
      if (w.state === 'sleep') a.wakeAt = w.wakeIn;
      if (w.state === 'work' && !live) a.workUntil = 20 + r() * 25;
      // The demo shows each warning once: an agent that overslept its run (lateBy seconds) and one
      // silent at work (silentFor seconds). They stay as they are, so the triangle stays up.
      if (!live && w.lateBy) Object.assign(a, { stuck: true, wakeAt: -w.lateBy, seenAgo: w.lateBy + 40 * 60 });
      if (!live && w.silentFor) Object.assign(a, { stuck: true, workUntil: null, seenAgo: w.silentFor });
      // keep: the agent stays in its state (the explained funnel on the landing page): at work for
      // good, or asleep with its timer starting over.
      if (!live && w.keep) Object.assign(a, { keep: w.wakeIn || true, workUntil: null });
      // The demo makes up what each agent's last run added; it then counts the items it adds.
      if (!live && a.added == null) a.added = w.state === 'sleep' ? 1 + Math.floor(r() * 6) : 0;
      this.agents.push(a);
    });
    // One supervisor per funnel, on the platform. It has no zone: it watches the whole funnel. It
    // stays in its state (no walking), so the demo keeps it as it is.
    this.funnels.forEach(f => {
      const s = f.supervisor;
      if (!s) return;
      const a = { ...s, f, sup: true, zone: null, side: 'R', rand: r, phase: r(), added: 0 };
      a.questions = s.questions ?? (s.question ? [{ id: s.question_id ?? `demo-sup-${f.id ?? f.title}`, question: s.question }] : []);
      a.replies = s.replies ?? [];
      if (s.state === 'sleep') a.wakeAt = s.wakeIn;
      if (!live) Object.assign(a, { keep: s.wakeIn || true, workUntil: null });
      this.agents.push(a);
    });
  }

  fi(f) { return this.funnels.indexOf(f); }
  cx(fi) { return fi * CW + CW / 2; }
  spot(a, kind) {
    if (a.sup) {
      const cx = this.cx(this.fi(a.f)), left = cx - DECK_HALF, right = cx + DECK_HALF - 20;
      if (kind === 'rest') return { x: left, y: DECK_Y - 10 * P };
      return { x: kind === 'ask' ? left : left + (right - left) * this.deckWalk(a).k, y: DECK_Y - MINER_H };
    }
        // Agents stand level with the bottom of the plate, also in the output zone where it is lifted.
    const out = a.zone === a.f.stages.length - 1;
    const cx = this.cx(this.fi(a.f)), floor = a.f.geo.zoneTop(a.zone) + ZH - (out ? OUT_LIFT : 0), R = a.side === 'R';
    if (kind === 'work') return { x: R ? cx + 18 : cx - 38, y: floor - MINER_H };
    if (kind === 'ask') return { x: R ? cx + 26 : cx - 46, y: floor - MINER_H };
    return { x: R ? cx + 52 : cx - 66, y: floor - 10 * P };
  }

  // Switch between fixed and growing tanks (the profile menu's choice).
  // A switch of look starts the tanks over: they empty and fill up to their counts, as when the board opens.
  setGrow(grow) { this.grow = grow; this.heaps.clear(); this.regeo(true); }
  // Growing tanks: when a tank needs another row (or one less), lay its funnel out again; the scene
  // grows or shrinks to fit, and the heaps keep what they hold.
  regeo(force = false, only = null) {
    let changed = force;
    for (const f of only ? [only] : this.funnels) {
      const g = geometry(f, this.grow);
      if (!force && g.key === f.geo.key) continue;
      f.geo = g; changed = true;
    }
    if (!changed) return;
    this.H = sceneHeight(this.funnels);
    if (this.scale) this.resize(this.scale, this.dpr);
  }

  resize(scale, dpr) {
    this.scale = scale; this.dpr = dpr; this.S = scale * dpr;
    const w = this.funnels.length * CW;
    this.lo.width = this.bg.width = w * RES; this.lo.height = this.bg.height = this.H * RES;
    this.canvas.style.width = w * scale + 'px';
    this.canvas.style.height = this.H * scale + 'px';
    this.canvas.width = Math.round(w * this.S); this.canvas.height = Math.round(this.H * this.S);
    this.drawBackground();
  }

  // Reorder funnels (a view setting, not data). Agents keep their funnel, walkers shift with it.
  moveFunnel(from, to) {
    if (to === from || to === from + 1) return;
    const oldCx = this.funnels.map((f, i) => [f, this.cx(i)]);
    const [f] = this.funnels.splice(from, 1);
    this.funnels.splice(to > from ? to - 1 : to, 0, f);
    for (const a of this.agents) {
      if (a.state === 'walk') a.x += this.cx(this.fi(a.f)) - oldCx.find(([g]) => g === a.f)[1];
    }
    this.floaters = [];
    this.drawBackground();
  }
  order() { return this.funnels.map(f => f.title); }
  applyOrder(titles) {
    const rank = t => { const i = titles.indexOf(t); return i < 0 ? 1e9 : i; };
    this.funnels.sort((a, b) => rank(a.title) - rank(b.title));
    this.drawBackground();
  }

  // Static layer: backdrop, pipes, the platform on top, tanks' outlines.
  drawBackground() {
    const c = this.bg.getContext('2d'), r = rng(42);
    const w = this.funnels.length * CW;
    c.setTransform(RES, 0, 0, RES, 0, 0);
    c.fillStyle = '#1B1714'; c.fillRect(0, 0, w, this.H);
    this.funnels.forEach((f, fi) => {
      const cx = this.cx(fi), n = f.stages.length, theme = themeOf(f), g = f.geo;
      theme.backdrop(c, fi * CW, CW, this.H, r);
      for (let k = -1; k < n; k++) {
        // No room around a zone: agents work in the open, on top of the tank below.
        const y = g.zoneTop(k);
        // The pipe runs from the tank above (or the platform on top) down to the tank below.
        this.pipe(c, cx, k < 0 ? y + 4 : y, y + ZH, theme);
        // On top: the pipe goes on up to the supervisor's platform, with the funnel's documents on it.
        if (k < 0) {
          this.pipe(c, cx, DECK_Y + 3, y + 4, theme);
          this.deck(c, fi * CW, theme);
          if (f.guide_url) this.guideDoc(c, cx + GUIDE_X + 1, DOC_Y);
          if (f.source_url) this.sheets(c, cx + SHEET_X + 1, DOC_Y);
        }
      }
      f.stages.forEach((s, j) => {
        // A thin outline: full top and bottom rows, one pixel down each side; inside, the theme's
        // dark ground.
        const y = g.tankTop(j), lh = g.lh(j);
        for (let r = 0; r < lh; r++) {
          const h = g.half(j, r);
          c.fillStyle = theme.frame;
          if (r === 0 || r === lh - 1) c.fillRect(cx - h, y + r, h * 2, 1);
          else {
            c.fillRect(cx - h, y + r, 1, 1); c.fillRect(cx + h - 1, y + r, 1, 1);
            c.fillStyle = theme.tankBg; c.fillRect(cx - h + 1, y + r, h * 2 - 2, 1);
          }
        }
      });
      // Below the last tank the pipe just ends; results drip out of it.
      c.fillStyle = theme.pipe[0]; c.fillRect(cx - 4, g.zoneTop(n - 1) + ZH, 9, 3);
      c.fillStyle = theme.pipe[1]; c.fillRect(cx - 2, g.zoneTop(n - 1) + ZH, 5, 2);
    });
  }

  // The column's backdrop for a strip h logical units tall: the funnel's title sits on it in the
  // page header, so the column's look reaches up behind its name.
  titleStrip(fi, h) {
    const strip = document.createElement('canvas');
    strip.width = CW * RES; strip.height = Math.ceil(h * RES);
    const c = strip.getContext('2d');
    c.setTransform(RES, 0, 0, RES, 0, 0);
    c.fillStyle = '#1B1714'; c.fillRect(0, 0, CW, h);
    themeOf(this.funnels[fi]).backdrop(c, 0, CW, h, rng(42 + fi));
    return strip;
  }

  // The supervisor's platform on top of the pipe, in the theme's frame colour: a floor with a darker
  // underside.
  deck(c, x0, theme) {
    const R = (col, ...r) => { c.fillStyle = col; c.fillRect(...r); };
    const cx = x0 + CW / 2, y = DECK_Y, under = shade(theme.frame, 0.55);
    R(under, cx - PLANK_HALF, y + 1, PLANK_HALF * 2 + 1, 2.5); R(theme.frame, cx - PLANK_HALF, y, PLANK_HALF * 2 + 1, 1.5);
  }

  // A funnel whose agents keep its list behind a link: a spreadsheet file (folded corner, white
  // table) hangs right of the platform. Clicking it opens the list.
  sheets(c, x, y) {
    const R = (col, ...r) => { c.fillStyle = col; c.fillRect(...r); };
    R('#0F5130', x - 1, y - 1, 13, 23); R('#0F5130', x - 1, y + 4, 18, 18);
    R('#1E9E58', x, y, 11, 21); R('#1E9E58', x, y + 5, 16, 16);
    // The folded corner: a light triangle with its diagonal edge.
    for (let i = 0; i < 5; i++) { R('#7FD3A4', x + 11, y + i, i + 1, 1); R('#0F5130', x + 12 + i, y + i, 1, 1); }
    R('#FFFFFF', x + 3, y + 6, 10, 10);
    R('#1E9E58', x + 4, y + 7, 8, 1); R('#1E9E58', x + 4, y + 10, 8, 1); R('#1E9E58', x + 4, y + 13, 8, 1);
    R('#1E9E58', x + 7, y + 7, 1, 8);
  }
  sourceHit(fi) {
    return { x: this.cx(fi) + SHEET_X - 1, y: DOC_Y - 3, w: DOC_W + 4, h: 28, type: 'source', url: this.funnels[fi].source_url };
  }
  // The funnel's guide, the one document with everything about it for its supervisor and workers: a
  // text file (folded corner, lines of text) left of the platform. Clicking it opens it.
  guideDoc(c, x, y) {
    const R = (col, ...r) => { c.fillStyle = col; c.fillRect(...r); };
    R('#1A3F8F', x - 1, y - 1, 13, 23); R('#1A3F8F', x - 1, y + 4, 18, 18);
    R('#4A86E8', x, y, 11, 21); R('#4A86E8', x, y + 5, 16, 16);
    for (let i = 0; i < 5; i++) { R('#A9C6F5', x + 11, y + i, i + 1, 1); R('#1A3F8F', x + 12 + i, y + i, 1, 1); }
    for (const [dy, w] of [[7, 10], [10, 10], [13, 10], [16, 6]]) R('#FFFFFF', x + 3, y + dy, w, 1.5);
  }
  guideHit(fi) {
    return { x: this.cx(fi) + GUIDE_X - 1, y: DOC_Y - 3, w: DOC_W + 4, h: 28, type: 'guide', url: this.funnels[fi].guide_url };
  }

  // The pipe in the theme's own material (iron, glass, hose, cable…), with its joints or lights.
  pipe(c, cx, y0, y1, theme) {
    const [edge, body, shine, band] = theme?.pipe || ['#5E626B', '#8E939D', '#B9BEC7', null];
    c.fillStyle = edge; c.fillRect(cx - 4, y0, 9, y1 - y0);
    c.fillStyle = body; c.fillRect(cx - 2, y0, 5, y1 - y0);
    c.fillStyle = shine; c.fillRect(cx - 2, y0, 2, y1 - y0);
    if (band) for (let y = y0 + 8; y < y1 - 3; y += 14) { c.fillStyle = band; c.fillRect(cx - 4, y, 9, theme.bandH || 2); }
  }

  update(dt) {
    // Time only runs forward: a frame timed oddly (a hidden page, say) never takes items back.
    dt = Math.max(0, dt);
    this.t += dt;
    const t = this.t;
    for (const a of this.agents) {
      // A demo supervisor asleep on a timer wakes when it runs out, checks the funnel for a few
      // seconds where it stands and falls asleep again for as long.
      if (a.sup && !this.live && typeof a.keep === 'number') {
        if (a.state === 'sleep' && t >= a.wakeAt) { a.state = 'work'; a.workUntil = t + 6 + a.rand() * 6; }
        else if (a.state === 'work' && t >= a.workUntil) { a.state = 'sleep'; a.wakeAt = t + a.keep; a.workUntil = null; }
        continue;
      }
      if (a.keep && a.state === 'sleep' && t >= a.wakeAt) a.wakeAt = t + a.keep;
      if (a.state === 'sleep' && t >= a.wakeAt && !this.live && !a.stuck) { a.state = 'walk'; a.to = 'work'; a.x = this.spot(a, 'rest').x; }
      if (a.state === 'work' && a.workUntil && t >= a.workUntil) { a.state = 'walk'; a.to = 'rest'; a.x = this.spot(a, 'work').x; }
      if (a.state === 'walk') {
        const target = this.spot(a, a.to).x;
        const step = 20 * dt * Math.sign(target - a.x);
        if (Math.abs(target - a.x) <= Math.abs(step)) {
          a.x = target;
          if (a.to === 'work') { a.state = 'work'; a.added = 0; a.workUntil = t + 20 + a.rand() * 20; a.hitAt = t + 1; }
          else { a.state = 'sleep'; a.wakeAt = t + 8 + a.rand() * 10; }
        } else a.x += step;
      }
    }
    this.flow(dt);
    this.floaters = this.floaters.filter(f => t - f.born < 1.4);
    this.sparks = this.sparks.filter(s => t - s.born < 0.25);
  }

  // Demo simulation: time runs DAY_SECONDS per day, and each zone moves items at its flow
  // (per day). A zone where nobody is working runs at a third of its flow. Results stop at the
  // goal. Increments are batched into one "+N" label per zone about once a second.
  flow(dt) {
    const t = this.t;
    this.days += dt / DAY_SECONDS;
    if (this.live) return;
    this.funnels.forEach(f => {
      const n = f.stages.length, cx = this.cx(this.fi(f));
      f.acc ??= new Array(n + 1).fill(0);
      f.pending ??= new Array(n + 1).fill(0);
      f.lastShown ??= new Array(n + 1).fill(0);
      for (let i = 0; i <= n; i++) {
        const fl = f.flows[i];
        if (!fl) continue;
        const busy = this.agents.some(a => a.f === f && a.zone === i - 1 && a.state === 'work');
        f.acc[i] += fl * (busy ? 1 : 1 / 3) * dt / DAY_SECONDS;
        let k = Math.floor(f.acc[i]);
        if (k <= 0) continue;
        f.acc[i] -= k;
        if (i === n) f.cubes += k; else f.stages[i].count += k;
        // Results past the goal add rows: the scene grows down to fit them.
        if (i === n && this.scale && sceneHeight(this.funnels) > this.H) { this.H = sceneHeight(this.funnels); this.resize(this.scale, this.dpr); }
        // Growing tanks: a tank that needs another row makes its funnel taller.
        if (i < n && this.grow) this.regeo(false, f);
        // Credit the items to an agent at work in the zone that feeds this stage.
        const crew = this.agents.filter(a => a.f === f && a.zone === i - 1 && a.state === 'work');
        if (crew.length) crew[Math.floor(Math.random() * crew.length)].added += k;
        f.pending[i] += k;
      }
      for (let i = 0; i <= n; i++) {
        if (!f.pending[i] || t - f.lastShown[i] < 1) continue;
        const pos = i === n ? { x: cx + 86, y: f.geo.flasksY() + 8 } : { x: cx + f.geo.tankW(i) / 2 - 12, y: f.geo.tankTop(i) + 10 };
        this.floaters.push({ ...pos, born: t, text: '+' + fmtCount(f.pending[i]) });
        f.pending[i] = 0; f.lastShown[i] = t;
      }
    });
  }

  render() {
    const c = this.lctx, t = this.t;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(this.bg, 0, 0);
    c.setTransform(RES, 0, 0, RES, 0, 0);
    this.hits = [];
    this.funnels.forEach((f, fi) => {
      if (f.source_url) this.hits.push(this.sourceHit(fi));
      if (f.guide_url) this.hits.push(this.guideHit(fi));
      const cx = this.cx(fi), n = f.stages.length, theme = themeOf(f), g = f.geo;
      for (let k = -1; k < n; k++) {
        const y = g.zoneTop(k), fl = f.flows[k + 1];
        // Below the last tank the drops run a little past the pipe's end, dripping out of it.
        this.drops(c, cx, y + 4, y + ZH + (k === n - 1 ? 9 : 0), fl, fi * 3 + k);
        // The plate in each zone is what the agents work on; only the output zone's has text
        // on it: when the next result is due.
        theme.plate(c, cx - 13, k === n - 1 ? g.outPlateTop(k) : g.plateTop(k), 26, PLATE_H);
      }
      const pr = project(f, this.daysLeft(f));
      f.stages.forEach((s, j) => {
        const lw = g.tankW(j), x = cx - lw / 2, y = g.tankTop(j);
        // What the tank holds rises with the share of what is needed here for the whole goal: a heap
        // of pieces (ore, flowers, coins, hearts, bits) dropped in one by one, or in the lab a liquid
        // that lies flat. A stage with items always shows a little.
        const share = s.count > 0 ? Math.min(1, Math.max(pr.fill[j] ?? 0, 0.02)) : 0;
        if (theme.piece) this.drawHeap(c, f, fi, j, cx, y, share, theme);
        else this.drawLiquid(c, f, fi, j, cx, x, lw, y, share, theme);
        this.hits.push({ x, y, w: lw, h: g.lh(j), type: 'stage', fi, j });
      });
      // One result item per result the goal needs (chests, flasks, pots…): filled ones are done,
      // empty ones are still to come. Past the goal, new results keep adding rows.
      const total = slots(f);
      for (let i = 0; i < total; i++) {
        const row = Math.floor(i / PER_ROW), inRow = Math.min(PER_ROW, total - row * PER_ROW), col = i % PER_ROW;
        const empty = i >= f.cubes;
        // Empty chests, flasks, pots and chips are faded so done results stand out.
        if (empty) c.globalAlpha = theme.emptyAlpha ?? 1;
        theme.result(c, Math.round(cx - (inRow * 18 - 2) / 2 + col * 18), g.flasksY() + row * 22, empty);
        c.globalAlpha = 1;
      }
    });
    for (const a of this.agents) this.drawAgent(c, a);
    this.funnels.forEach((f, fi) => { if (!f.supervisor) this.emptyChair(c, this.cx(fi), themeOf(f)); });
    if (this.live) this.funnels.forEach((f, fi) => {
      // An empty platform: a click on its chair or plank tells how to appoint one.
      if (!f.supervisor) this.hits.push({ x: this.cx(fi) - PLANK_HALF, y: DECK_Y - 24, w: PLANK_HALF * 2, h: 28, type: 'nosup', f });
    });
    for (const s of this.sparks) { c.fillStyle = s.col; c.fillRect(s.x, s.y, 2, 2); }
    if (this.dropAt !== null) {
      c.fillStyle = '#F2C14E'; c.fillRect(this.dropAt * CW - 2, 2, 4, this.H - 4);
    }

    const g = this.ctx;
    g.imageSmoothingEnabled = false;
    g.drawImage(this.lo, 0, 0, this.canvas.width, this.canvas.height);
    this.drawText(g);
  }

  drops(c, cx, y0, y1, fl, seed) {
    if (!fl) return;  // also null: flow not reported yet
    const speed = 8 + 22 * Math.min(1, Math.log10(1 + fl) / 1.5);
    const gap = 14;
    const off = (this.t * speed + seed * 5) % gap;
    c.fillStyle = '#CDEBFF';
    for (let y = y0 + off; y < y1 - 3; y += gap) c.fillRect(cx, Math.round(y), 2, 3);
  }

  drawAgent(c, a) {
    const t = this.t, info = agentInfo(a.agent), theme = themeOf(a.f), outfit = theme.outfit;
    if (a.sup) return this.drawSupervisor(c, a, info, outfit);
    if (a.state === 'sleep') {
      const p = this.spot(a, 'rest');
      drawLying(c, p.x, p.y, a.agent, info.color, a.side === 'R', outfit);
      // Asleep with a question still open: its bubble stays, on the side toward the pipe.
      if (a.questions.length) {
        const extra = (Math.min(4, a.questions.length) - 1) * BUBBLE_STEP;
        const bx = a.side === 'R' ? p.x - 16 - extra : p.x + 30;
        drawBubble(c, bx, p.y - 14, a.questions.length, bx > p.x);
        a.bubble = { x: bx, y: p.y - 14 };
        this.hits.push({ x: Math.min(p.x, bx) - 4, y: p.y - 16, w: 52 + extra, h: 38, type: 'ask', a });
      } else this.hits.push({ x: p.x - 4, y: p.y - 14, w: 34, h: 36, type: 'agent', a });
      // Where the page pins the tip of the agent's reply note: right at its head.
      a.noteAt = { x: p.x + 14, y: p.y + 4 };
      return;
    }
    if (a.state === 'walk') {
      const p = this.spot(a, 'work');
      drawStanding(c, Math.round(a.x / P) * P, p.y, a.agent, info.color, Math.floor(t * 7), a.to === 'rest' ? a.side === 'L' : a.side === 'R', false, outfit);
      this.hits.push({ x: a.x - 2, y: p.y - 2, w: 24, h: 32, type: 'agent', a });
      a.noteAt = { x: Math.round(a.x / P) * P + 10, y: p.y + (HEAD_TOP[outfit] ?? 1) - 1 };
      return;
    }
    if (a.state === 'ask') {
      const p = this.spot(a, 'ask');
      const R = a.side === 'R';
      drawStanding(c, p.x, p.y, a.agent, info.color, -1, R, false, outfit);
      a.noteAt = { x: p.x + 10, y: p.y + (HEAD_TOP[outfit] ?? 1) - 1 };
      const extra = (Math.min(4, a.questions.length) - 1) * BUBBLE_STEP;
      a.bubble = { x: R ? p.x + 11 * P : p.x - 9 * P - extra, y: p.y - 2 - Math.round(Math.abs(Math.sin(t * 4)) * 2) * P };
      drawBubble(c, a.bubble.x, a.bubble.y, a.questions.length, a.bubble.x > p.x);
      this.hits.push({ x: R ? p.x - 2 : p.x - 20 - extra, y: p.y - 6, w: 44 + extra, h: 36, type: 'ask', a });
      return;
    }
    // Working agents face the pipe. The tool is drawn as for the left side (facing right) and
    // mirrored for the right side.
    const p = this.spot(a, 'work'), R = a.side === 'R', cx = this.cx(this.fi(a.f));
    drawStanding(c, p.x, p.y, a.agent, info.color, -1, R, true, outfit);
    const hx = p.x + 16.5, hy = p.y + 15, pipeX = R ? 2 * (p.x + 10) - (cx + 5) : cx - 5;
    c.save();
    if (R) { c.translate(2 * (p.x + 10), 0); c.scale(-1, 1); }
    const period = TOOL_PERIOD[theme.tool] ?? 1.2;
    const hit = drawWork(c, theme.tool, hx, hy, ((t + a.phase * period) % period) / period, pipeX);
    c.restore();
    if (hit && !this.sparks.some(s => s.a === a)) {
      for (let i = 0; i < 4; i++) {
        const dx = Math.floor(a.rand() * 6);
        this.sparks.push({ a, col: theme.spark, x: R ? cx + 6 + dx : cx - 6 - dx, y: p.y + 10 + Math.floor(a.rand() * 8), born: t });
      }
    }
    this.hits.push({ x: R ? p.x - 14 : p.x - 2, y: p.y - 4, w: 36, h: 34, type: 'agent', a });
    a.noteAt = { x: p.x + 10, y: p.y + (HEAD_TOP[outfit] ?? 1) - 1 };
  }

  // A platform with no supervisor yet: an empty director's chair waits on it. A click on it (or the
  // plank) tells how to appoint one.
  emptyChair(c, cx, theme) {
    const R = (col, ...r) => { c.fillStyle = col; c.fillRect(...r); };
    const y = DECK_Y, wood = shade(theme.frame, 0.8), cloth = '#B5413A';
    R(wood, cx - 6, y - 9, 1.5, 9); R(wood, cx + 4.5, y - 9, 1.5, 9);
    R(cloth, cx - 6, y - 10, 12, 2.5);
    R(wood, cx - 6, y - 20, 1.5, 11); R(wood, cx + 4.5, y - 20, 1.5, 11);
    R(cloth, cx - 6, y - 19, 12, 4);
    for (let i = 0; i < 9; i++) { R(wood, cx - 5 + i * 1.1, y - 1 - i, 1.2, 1.2); R(wood, cx + 4 - i * 1.1, y - 1 - i, 1.2, 1.2); }
  }

  // The supervisor on its platform: asleep lying at its left end, asking with the same red bubble as
  // the workers, otherwise looking down at the funnel through a spyglass.
  // On the platform the supervisor stands at one end for a while, looking down, then walks to the
  // other: k from 0 (left end) to 1 (right end), walking: on the move.
  deckWalk(a) {
    const T = 16, q = ((this.t + a.phase * T) % T) / T;
    if (q < 0.35) return { k: 0, walking: false, facesLeft: false };
    if (q < 0.5) return { k: (q - 0.35) / 0.15, walking: true, facesLeft: false };
    if (q < 0.85) return { k: 1, walking: false, facesLeft: true };
    return { k: 1 - (q - 0.85) / 0.15, walking: true, facesLeft: true };
  }

  drawSupervisor(c, a, info, outfit) {
    const t = this.t;
    if (a.state === 'sleep') {
      const p = this.spot(a, 'rest');
      drawBossLying(c, p.x, p.y, a.agent, info.color, outfit);
      a.noteAt = { x: p.x + 14, y: p.y + 4 };
      if (a.questions.length) {
        const bx = p.x + 30;
        drawBubble(c, bx, p.y - 14, a.questions.length, true);
        a.bubble = { x: bx, y: p.y - 14 };
        this.hits.push({ x: p.x - 4, y: p.y - 16, w: 52, h: 38, type: 'ask', a });
      } else this.hits.push({ x: p.x - 4, y: p.y - 14, w: 34, h: 36, type: 'agent', a });
      return;
    }
    const p = this.spot(a, a.state === 'ask' ? 'ask' : 'work');
    const w = a.state !== 'ask' ? this.deckWalk(a) : { walking: false, facesLeft: false };
    drawBoss(c, Math.round(p.x / P) * P, p.y, a.agent, info.color, outfit, w.walking ? Math.floor(t * 7) : -1, w.facesLeft);
    a.noteAt = { x: p.x + 10, y: p.y + (BOSS_TOP[outfit] ?? 1) - 1 };
    if (a.state === 'ask') {
      a.bubble = { x: p.x + 11 * P, y: p.y - 2 - Math.round(Math.abs(Math.sin(t * 4)) * 2) * P };
      drawBubble(c, a.bubble.x, a.bubble.y, a.questions.length, true);
      this.hits.push({ x: p.x - 2, y: p.y - 6, w: 44, h: 36, type: 'ask', a });
      return;
    }
    if (w.walking) { this.hits.push({ x: p.x - 2, y: p.y - 4, w: 24, h: 32, type: 'agent', a }); return; }
    // The spyglass sweeps between the sheet on top of the funnel and the agent at its bottom on the
    // side it stands.
    const ex = w.facesLeft ? p.x + 6 : p.x + 14, ey = p.y + 8, cx = this.cx(this.fi(a.f)), n = a.f.stages.length;
    const look = (x, y) => Math.atan2(y - ey, x - ex);
    const top = look(cx, a.f.geo.zoneTop(-1) - 16), bottom = look(w.facesLeft ? cx + 28 : cx - 28, a.f.geo.zoneTop(n - 1) + ZH - 14);
    const k = 0.5 - 0.5 * Math.cos(t * 0.9 + a.phase * 9);
    drawSpyglass(c, ex, ey, top + (bottom - top) * k);
    this.hits.push({ x: p.x - 2, y: p.y - 4, w: 34, h: 34, type: 'agent', a });
  }

  // Crisp text on the full-resolution canvas, over the pixel layer.
  drawText(g) {
    const S = this.S, t = this.t;
    const T = (s, x, y, size, color, align = 'center', weight = 400) => {
      g.font = `${weight} ${size * S}px ${FONT}`;
      g.textAlign = align; g.textBaseline = 'middle'; g.fillStyle = color;
      g.fillText(s, x * S, y * S);
    };
    const shadowed = fn => { g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowOffsetY = S * 0.6; fn(); g.shadowColor = 'transparent'; g.shadowOffsetY = 0; };
    // An amber warning triangle with a time in it: an agent overdue or out of contact. A click on it
    // opens the agent, as a click on the agent does.
    const warn = (a, text, cx, base) => {
      // Always the same near-equilateral shape; a longer time gets a smaller font instead of a
      // wider triangle.
      const h = 20, half = 12;
      g.font = `700 ${7 * S}px ${FONT}`;
      const size = Math.min(7, 7 * 12 / (g.measureText(text).width / S));
      // The corners are rounded: each side is drawn up to an arc into the next.
      const pts = [[cx, base - h], [cx + half, base], [cx - half, base]].map(([px, py]) => [px * S, py * S]), r = 2.6 * S;
      g.beginPath();
      g.moveTo((pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2);
      for (let k = 1; k <= 3; k++) { const [ax, ay] = pts[k % 3], [bx, by] = pts[(k + 1) % 3]; g.arcTo(ax, ay, bx, by, r); }
      g.closePath();
      g.lineJoin = 'round'; g.lineWidth = 1.6 * S; g.strokeStyle = '#1B1714'; g.fillStyle = '#F2A33C';
      g.fill(); g.stroke();
      T(text, cx, base - 4.6, size, '#1B1714', 'center', 700);
      this.hits.push({ x: cx - half - 2, y: base - h - 2, w: half * 2 + 4, h: h + 4, type: 'agent', a });
    };
    // Working, but silent for too long: the same triangle over its head, with how long it has been.
    for (const a of this.agents) {
      if (!this.lost(a)) continue;
      const p = this.spot(a, 'work');
      warn(a, fmtDuration(this.silence(a)), p.x + 10, p.y - 4);
    }
    // A number in the middle with its flow written small at its top right, like an exponent.
    // The number is centred across on x; up and down the two together are centred on y, so the
    // number sits a little low. Returns the box they take, for a click on them.
    const withFlow = (num, flow, x, y, size, color, flowColor) => {
      g.font = `700 ${size * S}px ${FONT}`;
      const w = g.measureText(num).width / S;
      g.font = `700 ${size * 0.55 * S}px ${FONT}`;
      const fw = flow ? g.measureText(flow).width / S + 1 : 0;
      // The number's capitals span about 0.7 of its size around its line; the flow's top reaches
      // 0.42 + 0.19 above it.
      const nx = x, ny = flow ? y + size * 0.13 : y;
      T(num, nx, ny, size, color, 'center', 700);
      if (flow) T(flow, nx + w / 2 + 1, ny - size * 0.42, size * 0.55, flowColor, 'left', 700);
      return { x: nx - w / 2 - 2, y: ny - size * 0.95, w: w + fw + 4, h: size * 1.5 };
    };
    this.funnels.forEach((f, fi) => {
      const cx = this.cx(fi), n = f.stages.length;
      f.stages.forEach((s, j) => {
        // The number is the same size in every tank, in its middle; at its top right, how fast the
        // tank fills (the flow of the zone above it). What the tank holds shows on hover.
        const num = fmtCount(s.count), flow = fmtFlow(f.flows[j] ?? 0);
        let box;
        shadowed(() => { box = withFlow(num, flow, cx, f.geo.tankTop(j) + f.geo.lh(j) / 2, 15, '#FFFFFF', f.flows[j] ? '#9FE870' : STALLED); });
        // The number and its flow open the stage's history.
        if (box) this.hits.push({ ...box, type: 'count', fi, j });
      });
      const dl = this.daysLeft(f), pr = project(f, dl);
      const ry = f.geo.flasksY() + Math.ceil(slots(f) / PER_ROW) * 22 + 8;
      // Under the results, one thing per line: how many and what they are ("7 offers"), when the next
      // one is due (coloured by pace against the goal), and the goal: how many more, in how long.
      const num = String(f.cubes), name = ' ' + plural(f.cubes, f.result);
      g.font = `700 ${12 * S}px ${FONT}`; const wNum = g.measureText(num).width / S;
      g.font = `600 ${9 * S}px ${FONT}`; const wName = g.measureText(name).width / S;
      const x0 = cx - (wNum + wName) / 2;
      T(num, x0, ry + 4, 12, f.cubes ? themeOf(f).accent : '#8C8276', 'left', 700);
      T(name, x0 + wNum, ry + 4.5, 9, '#D8CFC2', 'left', 600);
      if (f.cubes >= f.goal.total) T(tr('board.goalReached'), cx, ry + 18, 8, '#3CF27A', 'center', 700);
      else {
        T(tr('board.next', fmtEta(pr.eta)), cx, ry + 18, 7.5, pr.out == null ? '#B8AE9F' : statusColor(pr.out), 'center', 700);
        // The goal as what is still to add and the time left to its date, counting down; past the
        // date, how late it is.
        const left = f.goal.total - f.cubes;
        const span = d => (d >= 1 ? fmtInUnit(d) : fmtDuration(d * 86400));
        if (dl == null) T(tr('board.goalNoDate', left), cx, ry + 29, 7.5, '#B8AE9F', 'center', 500);
        else if (dl > 0) T(tr('board.goal', left, span(dl)), cx, ry + 29, 7.5, '#B8AE9F', 'center', 500);
        else T(tr('board.goalLate', left, span(-dl)), cx, ry + 29, 7.5, '#FF8A7A', 'center', 500);
      }
    });
    for (const a of this.agents) {
      if (a.state !== 'sleep') continue;
      const p = this.spot(a, 'rest');
      // Past its next run and still no word from it: how late it is, in an amber warning triangle,
      // instead of the timer.
      if (this.overdue(a)) warn(a, fmtDuration(t - a.wakeAt), p.x + 14, p.y - 3);
      else if (a.wakeAt != null) shadowed(() => T(fmtTimer(a.wakeAt - t), p.x + 14, p.y - 8, 8.5, '#F4EDE1', 'center', 700));
      for (let i = 0; i < 2; i++) {
        const q = ((t * 0.6 + i * 0.5) % 1);
        g.globalAlpha = 1 - q;
        const hx = a.side === 'R' ? p.x + 30 + q * 4 : p.x - 2 - q * 4;
        T('z', hx, p.y - 2 - q * 12, 7 + q * 3, '#BFD7FF', 'center', 700);
        g.globalAlpha = 1;
      }
    }
    // Five questions or more: the number before the bubble's single "!".
    for (const a of this.agents) {
      if (a.questions.length > 4 && a.bubble && (a.state === 'ask' || a.state === 'sleep')) T(String(a.questions.length), a.bubble.x + 9, a.bubble.y + 8.5, 9, '#FFFFFF', 'center', 700);
    }
    // What each agent added this run (the last run's while it sleeps), next to it.
    for (const a of this.agents) {
      if (!a.added || a.state === 'walk') continue;
      const R = a.side === 'R', p = this.spot(a, a.state === 'sleep' ? 'rest' : a.state);
      const x = a.state === 'sleep' ? (R ? p.x + 33 : p.x - 5) : R ? p.x + 26 : p.x - 6;
      const y = a.state === 'sleep' ? p.y + 8 : p.y + 4;
      shadowed(() => T('+' + fmtCount(a.added), x, y, 8, '#9FE870', 'center', 700));
    }
    for (const f of this.floaters) {
      const q = (t - f.born) / 1.4;
      g.globalAlpha = 1 - q * q;
      shadowed(() => T(f.text, f.x, f.y - q * 14, 9, '#9FE870', 'center', 700));
      g.globalAlpha = 1;
    }
  }

  hitTest(lx, ly) {
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const h = this.hits[i];
      if (lx >= h.x && lx < h.x + h.w && ly >= h.y && ly < h.y + h.h) return h;
    }
    return null;
  }

  // The lab's tanks hold a liquid: its level rises a row per drop, each drop falling from the pipe
  // in the colour of the stage's liquid; kept across refreshes like the heaps.
  // How many pieces each row of a tank holds, bottom row first: the heap's grid of CELL squares.
  // Their sum is what fills a tank, the lab's liquid too, so a full tank is the same count everywhere.
  pieceRows(f, j) { return rowsFit(r => f.geo.half(j, r), f.geo.lh(j)); }

  drawLiquid(c, f, fi, j, cx, x, lw, y, share, theme) {
    const n = f.stages.length, g = f.geo, rows = g.lh(j) - 2, key = `${f.id ?? f.title}|${j}`, t = this.t;
    let h = this.heaps.get(key);
    if (!h) { h = { shown: 0, falling: [], next: 0 }; this.heaps.set(key, h); }
    // The liquid covers the share of the tank's area that the count is of what a heap of pieces would
    // fill it with (full at the same count), rising row by row from the bottom: the rows are wider
    // higher up, so it rises more slowly there.
    const count = f.stages[j].count, cap = this.pieceRows(f, j).reduce((a, b) => a + b, 0);
    const widths = [];
    for (let r = rows; r >= 1; r--) widths.push(g.half(j, r) * 2 - 2);
    const area = widths.reduce((a, b) => a + b, 0);
    // A growing tank past its smallest size is as tall as what it holds, so its liquid fills it to
    // the top; at its smallest it fills up as a fixed one does.
    const grown = this.grow && g.lh(j) > MIN_ROWS * CELL + 3;
    let target = (grown && count > 0 ? 1 : Math.min(1, count / cap)) * area, want = 0;
    for (const w of widths) { if (target <= 0) break; target -= w; want++; }
    if (count > 0 && !want) want = 1;
    if (h.shown > want) { h.shown = want; h.falling = []; }
    h.step ??= (FIRST_FILL - 0.4) / Math.max(1, want);
    // As many drops a frame as the time since the last one holds (catching up at most 0.1 s), so a
    // big tank still fills in FIRST_FILL seconds.
    h.next = Math.max(h.next, t - 0.1);
    while (h.shown + h.falling.length < want && t >= h.next) { h.falling.push({ born: t }); h.next += h.step; }
    if (h.shown + h.falling.length >= want) h.step = 0.08;
    h.falling = h.falling.filter(d => { if (t - d.born < 0.4) return true; h.shown++; return false; });
    if (h.shown > 0) {
      c.save(); c.beginPath();
      for (let r = rows - h.shown; r < rows; r++) { const hw = g.half(j, r + 1) - 1; c.rect(cx - hw, y + 1 + r, hw * 2, 1); }
      // Plain liquid up to its level: the tank's lighter top band is drawn above the clip, out of sight.
      const top = y + 1 + rows - h.shown;
      c.clip(); theme.tank(c, x - 20, top - 2, lw + 40, h.shown + 2, j, n, t, fi * 97 + j * 13 + 5); c.restore();
    }
    const surface = y + 1 + rows - h.shown;
    c.fillStyle = theme.drop(j, n);
    for (const d of h.falling) { const q = (t - d.born) / 0.4; c.fillRect(cx - 0.5, Math.round((y - 2 + (surface - y + 1) * q * q) * 2) / 2, 1.5, 2); }
  }

  // The tank holds discrete pieces in cells, filled middle-first and low-first so they
  // pile up into a mound; as many cells are taken as the share of what the goal needs. Pieces join
  // one at a time, each falling from the pipe to its cell (also on load, so the heap builds up).
  drawHeap(c, f, fi, j, cx, y, share, theme) {
    const n = f.stages.length, P = sameSize(theme.piece), key = `${f.id ?? f.title}|${j}`, g = f.geo, lh = g.lh(j);
    let h = this.heaps.get(key);
    // The cells are laid out for the tank's size and place: again when a growing tank changes, its
    // pieces kept.
    if (!h || !h.cells || h.lh !== lh || h.y !== y) {
      const cells = [], rows = Math.floor((lh - 3) / P.h);
      for (let r = 0; r < rows; r++) {
        const top = y + lh - 2 - (r + 1) * P.h, hw = g.half(j, Math.max(1, Math.round(top - y))) - 1.5;
        const k = Math.floor((hw * 2) / P.w);
        for (let i = 0; i < k; i++) {
          const px = cx - (k * P.w) / 2 + i * P.w + (r % 2 ? P.w / 4 : 0), off = Math.abs(px + P.w / 2 - cx) / P.w;
          if (px + P.w > cx + hw) continue;
          cells.push({ x: px, y: top, score: r * 1.6 + off * 0.7 + ((i * 7 + r * 3) % 5) * 0.05 });
        }
      }
      cells.sort((a, b) => a.score - b.score);
      // Pieces in the air land at once in the new layout.
      h = h ? Object.assign(h, { cells, lh, y, shown: h.shown + h.falling.length, falling: [] }) : { cells, lh, y, shown: 0, falling: [], next: 0 };
      this.heaps.set(key, h);
    }
    const t = this.t, want = Math.min(h.cells.length, f.stages[j].count);
    if (h.shown > want) { h.shown = want; h.falling = []; }
    // The first fill takes FIRST_FILL seconds whatever the count, so every tank fills together on
    // load; later items drop one by one.
    h.step ??= (FIRST_FILL - 0.45) / Math.max(1, want);
    // As many pieces a frame as the time since the last one holds (catching up at most 0.1 s), so a
    // big tank still fills in FIRST_FILL seconds.
    h.next = Math.max(h.next, t - 0.1);
    while (h.shown + h.falling.length < want && t >= h.next) {
      h.falling.push({ cell: h.cells[h.shown + h.falling.length], born: t });
      h.next += h.step;
    }
    if (h.shown + h.falling.length >= want) h.step = 0.05;
    h.falling = h.falling.filter(d => {
      if (t - d.born < 0.45) return true;
      h.shown++; return false;
    });
    // Landed pieces are drawn once, into the heap's own layer; each frame only copies it. A tank
    // can hold thousands, too many to draw again every frame.
    const half0 = g.half(j, 0), bx = cx - half0 - 1, bw = half0 * 2 + 2, layerKey = `${lh}|${y}|${bx}`;
    if (!h.layer || h.layerKey !== layerKey || h.drawn > h.shown) {
      h.layer ??= document.createElement('canvas');
      h.layer.width = bw * RES; h.layer.height = lh * RES;
      h.layerKey = layerKey; h.drawn = 0;
    }
    if (h.drawn < h.shown) {
      const lc = h.layer.getContext('2d');
      lc.setTransform(RES, 0, 0, RES, -bx * RES, -y * RES);
      for (let i = h.drawn; i < h.shown; i++) P.draw(lc, Math.round(h.cells[i].x * 2) / 2, Math.round(h.cells[i].y * 2) / 2, j, n, i);
      h.drawn = h.shown;
    }
    c.drawImage(h.layer, bx, y, bw, lh);
    for (const d of h.falling) {
      const q = (t - d.born) / 0.45, sx = cx - P.w / 2, sy = y - 2;
      P.draw(c, Math.round((sx + (d.cell.x - sx) * q) * 2) / 2, Math.round((sy + (d.cell.y - sy) * q * q) * 2) / 2, j, n, h.cells.indexOf(d.cell));
    }
  }

  stageNeed(fi, j) { return project(this.funnels[fi]).need[j]; }
  // A sleeping agent that should have run more than 10 minutes ago and has not reported since (an
  // agent says set_agent_state(work) first thing in a run). Only a sign to check on it: its
  // schedule may have slipped, or it may have stopped.
  // Days until the funnel's goal date (negative once it has passed): the person's own clock, or the
  // demo's days.
  daysLeft(f) {
    if (this.live) return f.goal?.due ? (f.goal.due - Date.now()) / 864e5 : null;
    return f.goal?.dueIn != null ? f.goal.dueIn - this.days : null;
  }
  overdue(a) { return (this.live || a.stuck) && a.state === 'sleep' && a.wakeAt != null && this.t - a.wakeAt > SILENT; }
  // Seconds since the agent last said anything (live, and the demo's stuck agents).
  silence(a) { return (this.live || a.stuck) && a.seenAgo != null ? this.t + a.seenAgo : 0; }
  // A working agent with no heartbeat for over 10 minutes: it may have stopped without saying so.
  lost(a) { return a.state === 'work' && this.silence(a) > SILENT; }
  // Seconds until a sleeping agent's next run, or null.
  sleepLeft(a) { return a.state === 'sleep' && a.wakeAt != null ? a.wakeAt - this.t : null; }
  // Open questions in a funnel: from agents asking and agents that asked and went to sleep.
  // How many of the funnel's agents have not been heard from in time: overslept a run or silent at work.
  silentIn(f) { return this.agents.filter(a => a.f === f && (this.overdue(a) || this.lost(a))).length; }
  waitingFor(f) {
    return this.agents.filter(a => a.f === f && (a.state === 'ask' || a.state === 'sleep')).reduce((n, a) => n + a.questions.length, 0);
  }
}

// Rough projection for the tanks and the next result, from the funnel's own numbers (visual only, not a
// forecast model).
// Tank fill: items at a stage so far ÷ items needed there for the whole goal (goal.total results).
// "Needed" uses the conversion between the tanks' counts, which agents keep cumulative: of the
// items that reached a stage, the share that reached the next one (the results for the last
// stage). Where a stage or the next one is still at 0 the conversion is unknown and a default of
// 30% stands in, so every tank shows a level from the first report.
// Pace of a zone: what its flow brings by the goal's date (days left until it) ÷ what the tank
// still misses; 1 is just in time. Only the output zone's
// is shown, as the colour of the "next" line. A flow nobody reported counts as 0.
const DEFAULT_CONVERSION = 0.3;
function project(f, daysLeft) {
  const st = f.stages, n = st.length, total = f.goal?.total, fl = f.flows.map(v => v ?? 0);
  const next = j => (j + 1 < n ? st[j + 1].count : f.cubes);
  const conv = st.map((s, j) => (s.count > 0 && next(j) > 0 ? Math.min(1, next(j) / s.count) : DEFAULT_CONVERSION));
  const need = st.map((s, j) => {
    const c = conv.slice(j);
    if (!(total > 0) || c.includes(null)) return null;
    const y = c.reduce((p, v) => p * v, 1);
    return y > 0 ? total / y : null;
  });
  // A reading an agent set by hand wins over the computed one.
  const fill = st.map((s, j) => f.manualFill?.[j] ?? (need[j] ? Math.min(1, s.count / need[j]) : null));
  const days = total > 0 && daysLeft != null ? Math.max(0, daysLeft) : null;
  const reading = (flow, i) => {
    const want = i < n ? need[i] : total, have = i < n ? st[i].count : f.cubes;
    if (days == null || !want) return 0;
    if (have >= want || days === 0) return 1e3; // already enough: the needle rests far right
    return flow * days / (want - have);
  };
  const zones = fl.map((flow, i) => reading(flow, i));
  return { zones, out: zones[n], eta: fl[n] > 0 ? 1 / fl[n] : null, fill, need };
}
// Pace vs goal, for the "next" line: red — far behind, yellow — close, green — on pace, bright
// green — well ahead.
// Nothing moving (+0): the same red as a "next" line far behind.
const STALLED = '#FF5A4E';
function statusColor(r) {
  return r >= 1.5 ? '#3CF27A' : r >= 0.9 ? '#7BD88F' : r >= 0.5 ? '#F2C14E' : '#FF5A4E';
}

function circle(c, cx, cy, r, col) {
  c.fillStyle = col;
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    if (x * x + y * y <= r * r + r * 0.6) c.fillRect(cx + x, cy + y, 1, 1);
  }
}

// A per-day flow in the unit the person picked (per hour, day or week, the same on every funnel),
// as a bare "+N": the unit is not written. Under 1, one significant digit (+0.3, +0.04).
const PER = { h: 1 / 24, d: 1, w: 7 };
export const fmtCount = n => n.toLocaleString('en-US');

function fmtFlow(perDay) {
  if (perDay == null) return '';
  const v = perDay * PER[flowUnit];
  if (!v) return '+0';
  return '+' + (v >= 10 ? Math.round(v) : v >= 1 ? Math.round(v * 10) / 10 : Number(v.toPrecision(1)));
}

// A span of days in the person's flow unit, so the goal and the next result read in the same unit
// as the flows: 28d, not 4w, when flows are per day.
function fmtInUnit(days) {
  const v = days / PER[flowUnit];
  return (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10) + tr('units')[flowUnit];
}

// When the next result is due, in the person's flow unit too (≈12d, not ≈2w, when flows are per day).
const fmtEta = days => (days == null || !isFinite(days) ? '—' : '≈' + fmtInUnit(days));

// One rule for silence: an agent heard from nothing for 10 minutes past when it should have spoken
// (its next run, or its last heartbeat while working; agents send one at least every 5 minutes).
const SILENT = 10 * 60;

export { fmtDuration };

// A sleeping agent's countdown: 0:45 in its last minute, then as a duration (15m, 8h).
function fmtTimer(sec) {
  sec = Math.max(0, Math.ceil(sec));
  return sec >= 60 ? fmtDuration(sec) : `0:${String(sec).padStart(2, '0')}`;
}

// How long one stroke of each tool takes, in seconds.
export const TOOL_PERIOD = { pickaxe: 0.8, shears: 0.9, beaker: 2.8, laptop: 2 / 3, stamp: 1.1, hammer: 0.9, sword: 0.8, rollingPin: 1, bow: 1.2 };

// A working agent's tool at phase cyc (0..1) of its stroke, held at (hx, hy) and facing right
// toward the pipe at pipeX; with what it sends flying (drops, bits, the arrow). Returns true at the
// moment it lands, when sparks fly. The board and the README's theme samples both draw it.
export function drawWork(c, tool, hx, hy, cyc, pipeX) {
  const swing = (k, a0, span) => (cyc < k ? a0 - (cyc / k) * span : a0 - span + ((cyc - k) / (1 - k)) * span);
  const press = k => (cyc < k ? cyc / k : 1 - (cyc - k) / (1 - k));
  if (tool === 'pickaxe') { drawPickaxe(c, hx, hy - 1, swing(0.7, 0.35, 2.3)); return cyc > 0.95; }
  // Smith raises the hammer and brings it down on the red-hot bar.
  if (tool === 'hammer') { drawHammer(c, hx, hy - 1, swing(0.7, 0.5, 2.2)); return cyc > 0.95; }
  // The hero winds up, then slashes at the slime fast.
  if (tool === 'sword') { drawSword(c, hx, hy - 1, swing(0.6, 0.6, 2.4)); return cyc > 0.95; }
  // Gardener snips the bush: the blades open slowly and shut fast.
  if (tool === 'shears') { drawShears(c, hx, hy + 1, press(0.75)); return cyc > 0.95; }
  // Banker stamps the contract: lift, then press down hard.
  if (tool === 'stamp') { drawStamp(c, hx - 1, hy + 4, press(0.75)); return cyc > 0.97; }
  // Baker rolls the dough back and forth.
  if (tool === 'rollingPin') { drawRollingPin(c, hx - 1, hy + 4, Math.sin(cyc * Math.PI * 2)); return cyc > 0.96; }
  if (tool === 'beaker') {
    // Chemist pours: the beaker tips toward the pipe and drops fall in.
    const tip = 0.5 + 0.5 * Math.sin(cyc * Math.PI * 2);
    drawBeaker(c, hx, hy, 0.2 + tip * 1.1, '#B585F2');
    if (tip > 0.75) for (let k = 0; k < 3; k++) {
      const q = (cyc * 6 + k / 3) % 1;
      c.fillStyle = '#B585F2'; c.fillRect(hx + 5 + q * (pipeX - hx - 5), hy - 4 + q * q * 10, 1.5, 1.5);
    }
    return tip > 0.97;
  }
  if (tool === 'laptop') {
    // Hacker types; bits fly from the laptop into the pipe.
    drawLaptop(c, hx - 3, hy + 2, (cyc * 4) % 1);
    for (let k = 0; k < 3; k++) {
      const u = (cyc + k / 3) % 1;
      c.fillStyle = '#3CF27A'; c.fillRect(hx + 5 + u * (pipeX - hx - 5), hy - 3 - Math.sin(u * Math.PI) * 4, 1, 1.5);
    }
    return cyc > 0.95;
  }
  // Cupid draws the bow, then the arrow flies into the pipe.
  drawBow(c, hx, hy, cyc < 0.5 ? cyc * 2 : 0);
  drawArrow(c, cyc < 0.5 ? hx + 3 - cyc * 6 : hx + 3 + (cyc - 0.5) / 0.5 * (pipeX - hx - 3), hy);
  return cyc > 0.96;
}
