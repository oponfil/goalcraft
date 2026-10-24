// Renders the README pictures (agents sheet, theme samples, the board) and the link preview card from the same drawing code as
// the dashboard and saves them through serve.py: open http://localhost:5173/tools/render-docs.html
// (always in English: the page adds ?lang=en to itself).
import { AGENTS, FUNNELS } from '../src/data.js?v=ebd31f61';
import { Scene, CW, drawWork, TOOL_PERIOD } from '../src/scene.js?v=ebd31f61';
import { guideScene, guideHeight, drawGuide, TH } from '../src/guide.js?v=ebd31f61';
import { GIFEncoder, quantize, applyPalette } from 'https://cdn.jsdelivr.net/npm/gifenc@1.0.3/dist/gifenc.esm.js';
import { THEMES } from '../src/themes.js?v=ebd31f61';
import { drawStanding, drawPickaxe, drawShears, drawBeaker, drawBow, drawArrow, drawLaptop, drawStamp, drawHammer, drawSword, drawRollingPin } from '../src/sprites.js?v=ebd31f61';

const FONT = 'Rubik, system-ui, sans-serif';

function canvas(w, h, show = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  if (show) document.body.appendChild(c);
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return [c, g];
}

// An animated GIF of n frames, each drawn at full size by frame(i) and scaled down to w×h (half
// size: every pixel of the art is still whole). One palette for all frames, taken from a few of
// them; after the first, a frame keeps only the pixels that changed and the rest is transparent,
// so the still parts (backdrops, tanks, labels) are stored once.
function gif(frame, n, w, h, delay) {
  const enc = GIFEncoder(), [, g] = canvas(w, h, false);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  const frames = [];
  for (let i = 0; i < n; i++) { g.clearRect(0, 0, w, h); g.drawImage(frame(i), 0, 0, w, h); frames.push(g.getImageData(0, 0, w, h).data); }
  const sample = new Uint8ClampedArray(frames[0].length * 2);
  sample.set(frames[0]); sample.set(frames[Math.floor(n / 2)], frames[0].length);
  const palette = quantize(sample, 255), clear = palette.length;
  palette.push([0, 0, 0]);
  let prev = null;
  for (const data of frames) {
    const index = applyPalette(data, palette.slice(0, clear));
    if (prev) for (let k = 0; k < index.length; k++) if (index[k] === prev[k]) index[k] = clear;
    enc.writeFrame(index, w, h, prev ? { palette, delay, transparent: true, transparentIndex: clear, dispose: 1 } : { palette, delay, dispose: 1 });
    if (prev) { for (let k = 0; k < index.length; k++) if (index[k] !== clear) prev[k] = index[k]; }
    else prev = index.slice();
  }
  enc.finish();
  return enc.bytes();
}

function rng(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
}

async function save(c, name) {
  const blob = c instanceof Uint8Array ? new Blob([c], { type: 'image/gif' }) : await new Promise(r => c.toBlob(r, 'image/png'));
  const res = await fetch(`/docs/img/${name}`, { method: 'PUT', body: blob });
  if (!res.ok) throw new Error(`${name}: ${res.status}`);
}

// All agents standing in a row, name under each.
function agentsSheet() {
  const ids = Object.keys(AGENTS), K = 6, cellW = 40, cellH = 46, cols = 5;
  const [c, g] = canvas(cols * cellW * K, Math.ceil(ids.length / cols) * cellH * K);
  g.fillStyle = '#1E1A17'; g.fillRect(0, 0, c.width, c.height);
  ids.forEach((id, i) => {
    const ox = (i % cols) * cellW, oy = Math.floor(i / cols) * cellH;
    g.setTransform(K, 0, 0, K, ox * K, oy * K);
    g.fillStyle = '#2A2420'; g.fillRect(4, 34, 32, 2);
    drawStanding(g, 10, 6, id, AGENTS[id].color);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.font = `500 ${4.2 * K}px ${FONT}`; g.textAlign = 'center'; g.fillStyle = '#F4EDE1';
    g.fillText(AGENTS[id].name, (ox + cellW / 2) * K, (oy + 42) * K);
  });
  return c;
}

// One tile per theme: a working agent by the pipe on its plate, a funnel tank filling up and three
// results under it (two done, one still to come). Each tile at time t (seconds into a LOOP-long
// loop) is drawn as the board draws it: the agent where the board puts a worker (38 units left of
// the pipe's centre), its tool going through a whole number of strokes in the loop (each stroke
// stretched a little to fit), and the tank empty at the start, its pieces (or the lab's liquid)
// falling in from the pipe one by one as when the page opens, then holding till the loop restarts.
const LOOP = 4.8;
const scratch = document.createElement('canvas').getContext('2d');
function themesSheet(t = 0.3) {
  const names = Object.keys(THEMES), K = 4, W = 180, Hh = 112, cols = 3;
  const [c, g] = canvas(cols * W * K, Math.ceil(names.length / cols) * Hh * K, false);
  const agentsFor = ['claude', 'chatgpt', 'gemini', 'grok', 'deepseek', 'mistral', 'qwen', 'kimi', 'perplexity'];
  names.forEach((name, i) => {
    const th = THEMES[name], ox = (i % cols) * W, oy = Math.floor(i / cols) * Hh, r = rng(7 + i);
    g.setTransform(K, 0, 0, K, ox * K, oy * K);
    th.backdrop(g, 0, W, Hh, r);
    // The pipe as on the board: 9 wide around cx, the plate 26 wide from cx - 13.
    const cx = 90, [pe, pb, ps, pband] = th.pipe;
    g.fillStyle = pe; g.fillRect(cx - 4, 6, 9, 48);
    g.fillStyle = pb; g.fillRect(cx - 2, 6, 5, 48);
    g.fillStyle = ps; g.fillRect(cx - 2, 6, 2, 48);
    if (pband) for (let y = 14; y < 51; y += 14) { g.fillStyle = pband; g.fillRect(cx - 4, y, 9, th.bandH || 2); }
    th.plate(g, cx - 13, 43, 26, 11);
    const id = agentsFor[i % agentsFor.length], ax = cx - 38, ay = 26, hx = ax + 16.5, hy = ay + 15;
    drawStanding(g, ax, ay, id, AGENTS[id].color, -1, false, true, th.outfit);
    const strokes = Math.max(1, Math.round(LOOP / (TOOL_PERIOD[th.tool] ?? 1.2))), cycAt = time => ((time / LOOP * strokes) % 1 + 1) % 1;
    drawWork(g, th.tool, hx, hy, cycAt(t), cx - 5);
    // Sparks by the pipe for a quarter second after the tool lands, as on the board.
    let landed = false;
    for (let d = 0; d <= 0.25 && !landed; d += 0.02) landed = drawWork(scratch, th.tool, 0, 0, cycAt(t - d), 0);
    if (landed) for (let k = 0; k < 4; k++) { g.fillStyle = th.spark; g.fillRect(cx - 6 - ((k * 7 + i) % 6), ay + 10 + ((k * 5 + i * 3) % 8), 2, 2); }
    // The tank: a trapezoid 112 wide at the top narrowing to 84 at the bottom.
    const ty = 54, TH = 26, half = row => Math.round(56 - 14 * row / (TH - 1));
    for (let row = 0; row < TH; row++) {
      const h = half(row);
      g.fillStyle = th.frame;
      if (row === 0 || row === TH - 1) g.fillRect(cx - h, ty + row, h * 2, 1);
      else { g.fillRect(cx - h, ty + row, 1, 1); g.fillRect(cx + h - 1, ty + row, 1, 1); g.fillStyle = th.tankBg; g.fillRect(cx - h + 1, ty + row, h * 2 - 2, 1); }
    }
    // Which stage's pieces each sample shows: gold for the mine, blue floppies for code, banknotes
    // for money, the middle stage elsewhere.
    const [sj, sn] = { mine: [3, 5], code: [0, 5], money: [1, 5], forge: [3, 5], bakery: [1, 5], blocks: [3, 5] }[name] || [1, 3];
    if (th.piece) {
      // Cells low and middle first, half of them taken; a piece leaves the pipe every EVERY
      // seconds and lands FALL seconds later.
      const P = th.piece, cells = [], EVERY = 0.07, FALL = 0.45;
      for (let row = 0; row < Math.floor((TH - 3) / P.h); row++) {
        const top = ty + TH - 2 - (row + 1) * P.h, hw = half(Math.round(top - ty)) - 1.5, k = Math.floor(hw * 2 / P.w);
        for (let m = 0; m < k; m++) {
          const px = cx - k * P.w / 2 + m * P.w + (row % 2 ? P.w / 4 : 0);
          if (px + P.w <= cx + hw) cells.push({ x: px, y: top, score: row * 1.6 + Math.abs(px + P.w / 2 - cx) / P.w * 0.7 + ((m * 7 + row * 3) % 5) * 0.05 });
        }
      }
      cells.sort((a, b) => a.score - b.score).slice(0, Math.round(cells.length * 0.5)).forEach((cell, m) => {
        const q = (t - m * EVERY) / FALL;
        if (q < 0) return;
        if (q >= 1) return P.draw(g, cell.x, cell.y, sj, sn, m);
        const sx = cx - P.w / 2, sy = ty - 2;
        P.draw(g, Math.round((sx + (cell.x - sx) * q) * 2) / 2, Math.round((sy + (cell.y - sy) * q * q) * 2) / 2, sj, sn, m);
      });
    } else {
      // The lab: the liquid rises a row per drop, up to half the tank.
      const rows = TH - 2, want = Math.round(rows * 0.5), EVERY = 0.12, FALL = 0.4;
      const shown = Math.max(0, Math.min(want, Math.floor((t - FALL) / EVERY) + 1));
      if (shown) {
        g.save(); g.beginPath();
        for (let row = rows - shown + 1; row <= rows; row++) { const h = half(row) - 1; g.rect(cx - h, ty + row, h * 2, 1); }
        g.clip(); th.tank(g, 10, ty + 1, 160, rows, sj, sn, 0, 11 + i); g.restore();
      }
      const surface = ty + 1 + rows - shown;
      g.fillStyle = th.drop(sj, sn);
      for (let k = shown; k < want; k++) {
        const q = (t - k * EVERY) / FALL;
        if (q >= 0 && q < 1) g.fillRect(cx - 0.5, Math.round((ty - 2 + (surface - ty + 1) * q * q) * 2) / 2, 1.5, 2);
      }
    }
    // Two results done and one to come, the empty one faded as on the board.
    for (let k = 0; k < 3; k++) {
      const empty = k === 2;
      if (empty) g.globalAlpha = th.emptyAlpha ?? 1;
      th.result(g, cx - 26 + k * 18, 86, empty);
      g.globalAlpha = 1;
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.font = `700 ${6 * K}px ${FONT}`; g.textAlign = 'left'; g.fillStyle = '#F4EDE1';
    g.shadowColor = 'rgba(0,0,0,0.8)'; g.shadowBlur = K * 1.5;
    g.fillText(name, (ox + 12) * K, (oy + 100) * K);
    g.shadowColor = 'transparent'; g.shadowBlur = 0;
  });
  return c;
}

// The link preview card (Open Graph, 1200×630), as Telegram and others show it: name and tagline on
// the left, one big miner with a pickaxe on the right, facing them.
async function ogCard() {
  const [c, g] = canvas(1200, 630);
  g.fillStyle = '#1B1714'; g.fillRect(0, 0, 1200, 630);
  // One miner with a pickaxe, big, facing left toward the name: drawn as on the board and mirrored.
  const K = 12;
  g.setTransform(-K, 0, 0, K, 1110, 25);
  drawStanding(g, 2, 11, 'claude', AGENTS.claude.color, -1, false, true, THEMES.mine.outfit);
  drawPickaxe(g, 18.5, 25, -0.9);
  g.setTransform(1, 0, 0, 1, 0, 0);
  const logo = new Image();
  await new Promise(r => { logo.onload = r; logo.src = '/favicon.svg'; });
  g.imageSmoothingEnabled = false;
  g.drawImage(logo, 44, 176, 104, 104);
  g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  // The name as on the site: the pixel font, in capitals, letters set close.
  await document.fonts.load("100px 'Tiny5'");
  g.font = `400 100px 'Tiny5', monospace`; g.letterSpacing = '-4px';
  g.fillStyle = '#F4EDE1'; g.fillText('GOALCRAFT', 170, 258);
  g.letterSpacing = '0px';
  g.fillStyle = '#F4EDE1';
  g.font = `500 62px ${FONT}`;
  g.fillText('Watch AI agents', 50, 392);
  g.fillText('craft your goals', 50, 470);
  return c;
}

// One funnel with labels on both sides, each with a straight line to the part it explains: the
// README's guide to reading the board. The Job Search demo funnel after a few seconds, while Grok
// still sleeps and the supervisor stands at the left end of its platform.
function funnelGuide({ labels = true, scene = null, show = true } = {}) {
  const scale = 2, dpr = 2, K = scale * dpr, side = 440;
  // A fresh scene runs fifteen seconds first, so the tanks have filled (a piece drops in every
  // 0.05 s) and the agents are at work.
  if (!scene) {
    scene = guideScene(); scene.resize(scale, dpr);
    for (let i = 0; i < 15 * 30; i++) { scene.update(1 / 30); scene.render(); }
  }
  scene.render();
  // Without labels (the landing page writes them as text, in the page's language) the picture is
  // just the funnel.
  const left = labels ? side : 0, fw = CW * K;
  const [c, g] = canvas(left + fw + (labels ? side : 0), TH * K + Math.min(scene.canvas.height, Math.ceil(guideHeight(scene) * K)), show);
  g.fillStyle = '#1B1714'; g.fillRect(0, 0, c.width, c.height);
  const drawn = drawGuide(scene, g, left);
  // Points in the scene's logical coordinates → picture pixels.
  const P = (x, y) => [left + x * K, TH * K + y * K];
  const f = scene.funnels[0], n = f.stages.length, cx = scene.cx(0);
  const stage = j => scene.hits.find(h => h.type === 'stage' && h.j === j);
  const agent = (id, state) => scene.agents.find(a => a.agent === id && a.state === state);
  const s0 = stage(0), s1 = stage(1), last = stage(n - 1);
  const ask = agent('claude', 'ask'), sleep = scene.spot(agent('grok', 'sleep'), 'rest');
  const work = scene.spot(agent('gemini', 'work'), 'work'), late = scene.spot(agent('mistral', 'work'), 'work');
  const src0 = scene.hits.find(h => h.type === 'source'), doc0 = scene.hits.find(h => h.type === 'guide');
  const resultsY = last.y + last.h + 40 + 9;
  // The tanks' sides run straight from one tank's top to the next: how far in they go per unit down.
  const slope = (s0.w - s1.w) / 2 / (s1.y - s0.y);
  // The supervisor stands at the platform's left end for a while; the arrow points at it there.
  const sup = scene.spot(scene.agents.find(a => a.sup), 'ask');
  // [point, side, heading, text]: a left label's arrow ends on the left edge of what it explains, a
  // right one's on the right edge.
  const notes = [
    ...(drawn.tasks ? [[[left + drawn.tasks.x - 8, drawn.tasks.y + drawn.tasks.h / 2], 'L', 'Your tasks', 'What only you can do, most urgent first; the supervisor keeps the list. Click to see it.']] : []),
    ...(drawn.badges ? [[[left + drawn.badges.x + drawn.badges.w + 8, drawn.badges.y + drawn.badges.h / 2], 'R', 'Waiting and silent', 'Red: questions waiting for you. Amber: agents gone silent.']] : []),
    [P(sup.x + 2, sup.y + 2), 'L', 'Supervisor', 'Your agent watching the whole funnel.'],
    [P(doc0.x + 3, doc0.y + 18), 'L', 'Notes', 'Everything the agents need to know about the funnel.'],
    [P(src0.x + src0.w - 3, src0.y + 18), 'R', 'List', 'Where the agents keep track of the items.'],
    [P(work.x + 19, work.y + 12), 'R', 'Agent at work', '+N is what its current run added.'],
    [P(cx + s0.w / 2 - slope * s0.h * 0.3 - 2, s0.y + s0.h * 0.3), 'R', 'Tank', 'Items at this stage so far, and +N a day. Click the number for its history.'],
    // The bubble bobs; the arrow points where it rests, so the label stays still.
    [P(ask.bubble.x, scene.spot(ask, 'ask').y - 2 + 11), 'L', 'Question', 'An agent waits for your answer. Click it to reply.'],
    [P(late.x + 23, late.y - 10), 'R', 'Silent', 'No word from this agent at work for 20 minutes: check on it.'],
    [P(sleep.x - 1, sleep.y + 1), 'L', 'Asleep', 'Resting until its next run; the timer counts down.'],
    [P(cx - 45, resultsY + 8), 'L', 'Results', 'One per result the goal needs; filled ones are done.'],
    [P(cx + 22, resultsY + 48), 'R', 'Prediction', 'When the next result is due at the current pace.'],
  ].map(([pt, sd, head, text]) => [pt, head, text, sd]);
  // The landing page's labels point at the same places: each as a fraction of the funnel picture.
  if (!labels) {
    const points = notes.map(([[x, y], head, , sd]) => `${head} (${sd}): x ${(x / c.width).toFixed(3)}, y ${(y / c.height).toFixed(3)}`);
    return Object.assign(c, { points });
  }
  const wrap = (text, w) => {
    const lines = [''];
    for (const word of text.split(' ')) {
      const tryLine = lines[lines.length - 1] ? lines[lines.length - 1] + ' ' + word : word;
      if (g.measureText(tryLine).width > w && lines[lines.length - 1]) lines.push(word); else lines[lines.length - 1] = tryLine;
    }
    return lines;
  };
  // A label beside its arrow: the heading on the arrow's level, the text under it. The arrow runs
  // from the heading to the point: straight across, or slanting when the label above pushed this one
  // down. Each side stacks its own labels.
  for (const sd of ['L', 'R']) {
    let bottom = 0;
    notes.filter(nt => nt[3] === sd).sort((a, b) => a[0][1] - b[0][1]).forEach(([[tx, ty], head, text]) => {
      g.font = `500 22px ${FONT}`;
      const lines = wrap(text, side - 130), lh = 28, h = 36 + lines.length * lh;
      const top = Math.max(bottom + 16, ty - 16);
      bottom = top + h;
      g.font = `700 28px ${FONT}`;
      const hw = g.measureText(head).width;
      // Left labels start at the picture's left edge, right ones end at its right edge.
      const x = sd === 'L' ? 70 : c.width - 70 - Math.max(hw, ...lines.map(l => (g.font = `500 22px ${FONT}`, g.measureText(l).width)));
      g.textAlign = 'left'; g.textBaseline = 'top';
      g.font = `700 28px ${FONT}`; g.fillStyle = '#F2C14E'; g.fillText(head, x, top);
      g.font = `500 22px ${FONT}`; g.fillStyle = '#D8CFC2';
      lines.forEach((l, i) => g.fillText(l, x, top + 36 + i * lh));
      const y0 = Math.max(ty, top + 16), x0 = sd === 'L' ? x + hw + 14 : x - 14, x1 = sd === 'L' ? tx - 4 : tx + 4, head2 = 14;
      const a = Math.atan2(ty - y0, x1 - x0), cos = Math.cos(a), sin = Math.sin(a);
      g.strokeStyle = '#F2C14E'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1 - (head2 - 2) * cos, ty - (head2 - 2) * sin); g.stroke();
      g.fillStyle = '#F2C14E';
      g.beginPath(); g.moveTo(x1, ty);
      g.lineTo(x1 - head2 * cos + 8 * sin, ty - head2 * sin - 8 * cos); g.lineTo(x1 - head2 * cos - 8 * sin, ty - head2 * sin + 8 * cos);
      g.closePath(); g.fill();
    });
  }
  return c;
}

// The animated pictures. Themes: 4.8 seconds in 60 frames, each tool through whole strokes. The funnel: 2.4
// seconds of the live scene, labels and all. Both at half the PNG size.
function themesGif() {
  const full = themesSheet(), n = 60;
  return gif(i => themesSheet(i * LOOP / n), n, full.width / 2, full.height / 2, LOOP / n * 1000);
}
function funnelGif() {
  const first = funnelGuide({ show: false }), scene = guideScene();
  scene.resize(2, 2);
  for (let i = 0; i < 15 * 30; i++) { scene.update(1 / 30); scene.render(); }
  return gif(() => { scene.update(1 / 15); return funnelGuide({ scene, show: false }); }, 36, first.width / 2, first.height / 2, 66);
}

const status = document.getElementById('status');
const only = new URLSearchParams(location.search).get('only');
try {
  await document.fonts.ready;
  // ?only=og renders just the link preview card; ?only=themes the theme samples; ?only=funnel just
  // the funnel guide.
  if (only === 'themes') {
    await save(themesGif(), 'themes.gif');
    throw Object.assign(new Error(), { done: 'Saved docs/img/themes.gif' });
  }
  if (only === 'og') {
    await save(await ogCard(), 'og.png');
    throw Object.assign(new Error(), { done: 'Saved docs/img/og.png' });
  }
  if (only === 'funnel') {
    await save(funnelGuide(), 'funnel.png');
    await save(funnelGif(), 'funnel.gif');
    const plain = funnelGuide({ labels: false });
    await save(plain, 'funnel-plain.png');
    throw Object.assign(new Error(), { done: 'Saved docs/img/funnel.png, funnel.gif and funnel-plain.png. Points: ' + plain.points.join('; ') });
  }
  // ?only=preview&t=1.2 shows the theme samples at one moment of the loop, saving nothing.
  if (only === 'preview') {
    const c = themesSheet(+new URLSearchParams(location.search).get('t') || 0);
    c.style.width = '100%'; document.body.appendChild(c);
    throw Object.assign(new Error(), { done: 'Preview, nothing saved' });
  }
  if (only) throw Object.assign(new Error(), { done: `Nothing saved: ?only= takes themes, funnel, og or preview` });
  await save(agentsSheet(), 'agents.png');
  await save(themesGif(), 'themes.gif');
  await save(await ogCard(), 'og.png');
  await save(funnelGuide(), 'funnel.png');
  await save(funnelGif(), 'funnel.gif');
  await save(funnelGuide({ labels: false }), 'funnel-plain.png');
  status.textContent = 'Saved docs/img/agents.png, themes.gif, og.png, funnel.png, funnel.gif and funnel-plain.png';
} catch (e) {
  status.textContent = e.done || 'Failed: ' + e.message;
}
