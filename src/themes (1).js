// Visual themes a funnel can use. The data and behaviour are the same; only the look changes:
// the zone walls, what fills the tanks, the result items, and the agents' outfit and tool.
//   mine  — miners with pickaxes striking ore, tanks of ore and gems, treasure chests
//   lab   — chemists pouring into a Petri dish, tanks of liquid, flasks
//   garden — gardeners snipping a flower bed with shears, tanks of sprouts, buds and flowers, flower pots
//   love  — cupids shooting at a bed, tanks of hearts, big hearts
//   code  — hackers in hoodies typing on laptops by a server rack, tanks of code, chips
//   money — bankers stamping a contract, tanks of pennies, banknotes, silver and gold bars, bitcoins; money bags
//   forge — smiths hammering a red-hot bar on an anvil, tanks of ore, ingots, horseshoes, swords, crowns; suits of armour
//   bakery — bakers rolling dough on a board, tanks of dough, pizzas, pies, cupcakes, cakes; cakes on stands
//   blocks — block-headed heroes swinging swords at a slime, tanks of loot blocks: coal, iron, gold, emerald, diamond; diamonds

function rng(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const rect = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
// Pick a colour by stage depth: the first stage gets the plainest, the last the richest.
const byDepth = (list, j, n) => list[Math.round((n > 1 ? j / (n - 1) : 1) * (list.length - 1))];

function heart(c, x, y, s, col) {
  // 7×6 pixel heart scaled by s.
  pixmap(c, x, y, s, ['.II.II.', 'IIIIIII', 'IIIIIII', '.IIIII.', '..III..', '...I...'], { I: col });
}

// Small pixel pictures: one string per row, one letter per pixel, colours by letter; '.' is empty.
function pixmap(c, x, y, s, rows, colors) {
  rows.forEach((row, r) => {
    for (let i = 0; i < row.length; i++) {
      const col = colors[row[i]];
      if (col) { c.fillStyle = col; c.fillRect(x + i * s, y + r * s, s, s); }
    }
  });
}
// Romance from light to close, top stages to bottom: a flower, a love letter, a heart, a kiss, a ring.
// The flower is seen from above: five round petals around a pale centre, on half-unit pixels.
function flower(c, x, y, s, col, centre = '#FFF0F6') {
  const cx = x + 2.75, cy = y + 2.5;
  const disc = (px, py, r, colour) => {
    c.fillStyle = colour;
    for (let dy = -r; dy <= r; dy += 0.5) for (let dx = -r; dx <= r; dx += 0.5) {
      if (dx * dx + dy * dy <= r * r) c.fillRect(Math.round((px + dx) * 2) / 2, Math.round((py + dy) * 2) / 2, 0.5, 0.5);
    }
  };
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + k * 2 * Math.PI / 5;
    disc(cx + Math.cos(a) * 1.8, cy + Math.sin(a) * 1.8, 1.05, col);
  }
  disc(cx, cy, 0.6, centre);
}
const letter = (c, x, y, s, col) => pixmap(c, x, y + 0.5, s,
  ['EEEEEEE', 'EDEEEDE', 'EEDEDEE', 'EEEDEEE', 'EEEEEEE'], { E: col, D: '#7A2A48' });
const ring = (c, x, y, s) => pixmap(c, x, y, s,
  ['...D...', '..DDD..', '..GGG..', '.G...G.', '.G...G.', '..GGG..'], { G: '#F2C14E', D: '#DFF6FF' });
const lips = (c, x, y, s, col) => pixmap(c, x, y, s,
  ['.......', '.LL.LL.', 'LLLLLLL', 'DDDDDDD', '.LLLLL.', '..LLL..'], { L: col, D: '#5A0A1E' });


// --- Column backdrops: (c, x, w, h, r) behind everything in the funnel's column ---

function backMine(c, x, w, h, r) {
  rect(c, x, 0, w, h, '#2A2521');
  for (let i = 0; i < w * h / 10; i++) {
    const v = r();
    c.fillStyle = v < 0.5 ? '#241F1B' : v < 0.85 ? '#322C26' : '#3B342C';
    c.fillRect(x + (Math.floor(r() * w) & ~1), Math.floor(r() * h) & ~1, v < 0.7 ? 4 : 2, 2);
  }
}
function backLab(c, x, w, h) {
  rect(c, x, 0, w, h, '#1C262E');
  for (let ty = 0; ty < h; ty += 10) for (let tx = x; tx < x + w; tx += 10) rect(c, tx, ty, 9.5, 9.5, '#212D37');
}
function backLove(c, x, w, h, r) {
  rect(c, x, 0, w, h, '#1E1028');
  for (let i = 0; i < w * h / 120; i++) rect(c, x + Math.floor(r() * w), Math.floor(r() * h), 1, 1, r() < 0.7 ? '#6A4A80' : '#E8B8E0');
  for (let i = 0; i < 8; i++) heart(c, x + Math.floor(r() * (w - 6)), Math.floor(r() * (h - 6)), 0.6, '#3A1E48');
}
function backCode(c, x, w, h) {
  rect(c, x, 0, w, h, '#0A0F14');
  for (let gx = x; gx < x + w; gx += 8) rect(c, gx, 0, 0.5, h, '#0F1A16');
  for (let gy = 0; gy < h; gy += 8) rect(c, x, gy, w, 0.5, '#0F1A16');
}
function backMoney(c, x, w, h) {
  // Deep banknote green with the fine diagonal lattice printed on banknotes.
  rect(c, x, 0, w, h, '#11211A');
  for (let d = -h; d < w; d += 6) for (let yy = 0; yy < h; yy += 1) {
    const a = x + d + yy, b = x + d + h - yy;
    if (a >= x && a < x + w) rect(c, a, yy, 0.5, 0.5, '#1E3D2E');
    if (b >= x && b < x + w) rect(c, b, yy, 0.5, 0.5, '#1E3D2E');
  }
}

// --- Zone backgrounds: (c, x0, y, w, h, r) with r a seeded random ---

function zoneMine(c, x0, y, w, h, r) {
  rect(c, x0, y, w, h, '#17130F');
  c.fillStyle = '#1F1913';
  for (let i = 0; i < 60; i++) c.fillRect(x0 + (Math.floor(r() * w) & ~1), y + (Math.floor(r() * h) & ~1), 4, 2);
  rect(c, x0 - 2, y, w + 4, 4, '#5A3D22'); rect(c, x0 - 2, y, w + 4, 2, '#7A5530');
  rect(c, x0 - 2, y, 4, h, '#5A3D22'); rect(c, x0 + w - 2, y, 4, h, '#5A3D22');
  rect(c, x0 - 2, y + h - 2, w + 4, 2, '#3B2B1A');
}

function zoneLab(c, x0, y, w, h) {
  rect(c, x0, y, w, h, '#18222A');
  c.fillStyle = '#1F2C36';
  for (let ty = y + 4; ty < y + h; ty += 8) for (let tx = x0 + ((ty / 8) % 2 ? 0 : 4); tx < x0 + w; tx += 8) c.fillRect(tx, ty, 7, 7);
  rect(c, x0 - 2, y, w + 4, 4, '#7D8794'); rect(c, x0 - 2, y, w + 4, 1, '#B9C2CC');
  rect(c, x0 - 2, y, 3, h, '#5E6670'); rect(c, x0 + w - 1, y, 3, h, '#5E6670');
  rect(c, x0 - 2, y + h - 2, w + 4, 2, '#4A525C');
}

function zoneLove(c, x0, y, w, h, r) {
  rect(c, x0, y, w, h, '#2A1530');
  for (let i = 0; i < 18; i++) rect(c, x0 + Math.floor(r() * w), y + 5 + Math.floor(r() * (h - 8)), 1, 1, r() < 0.5 ? '#E8B8E0' : '#7A4A8A');
  rect(c, x0 - 2, y, w + 4, 4, '#2E6B3A'); rect(c, x0 - 2, y + 1, w + 4, 1, '#4E9B5A');
  for (let fx = x0 + 4; fx < x0 + w; fx += 14) { rect(c, fx, y, 3, 3, '#F28AB8'); rect(c, fx + 1, y + 1, 1, 1, '#FFE0F0'); }
  rect(c, x0 - 2, y, 3, h, '#2E6B3A'); rect(c, x0 + w - 1, y, 3, h, '#2E6B3A');
  rect(c, x0 - 2, y + h - 2, w + 4, 2, '#1E4A28');
}

// --- Tank fillings: (c, x, y, w, h, j, n, t, seed) fill the box from the left, w wide ---

function tankMine(c, x, y, w, h, j, n, t, seed) {
  const ore = byDepth([['#4A4A4A', '#6B6B6B'], ['#9C5A2E', '#C47A45'], ['#7F8790', '#AEB5BF'], ['#D9A520', '#FFD866'], ['#2F7FD8', '#8FC4FF']], j, n);
  rect(c, x, y, w, h, '#2A2420');
  const r = rng(seed);
  for (let gy = y; gy < y + h - 1; gy += 4) for (let gx = x + (r() * 3 | 0); gx < x + w - 2; gx += 5 + (r() * 3 | 0)) {
    const oy = gy + (r() * 2 | 0) * 0.5;
    if (j === n - 1 && n > 1) {
      // Diamonds at the last stage: a cut gem, flat on top and pointed below.
      rect(c, gx + 0.5, oy, 2.5, 1, ore[1]); rect(c, gx, oy + 1, 3.5, 1, ore[0]);
      rect(c, gx + 0.75, oy + 2, 2, 0.5, ore[0]); rect(c, gx + 1.25, oy + 2.5, 1, 0.5, ore[0]);
    } else {
      rect(c, gx, oy, 3.5, 3, ore[0]);
      rect(c, gx + 0.5, oy + 0.5, 1.5, 1, ore[1]);
    }
  }
  // an occasional glint
  const g = Math.floor((t * 1.3 + seed) % 7);
  if (w > 8) rect(c, x + ((g * 23 + seed) % Math.max(1, w - 2)), y + 2 + (g % 3) * 6, 1, 1, '#FFFFFF');
}

function tankLab(c, x, y, w, h, j, n, t, seed) {
  const [base, top] = byDepth([['#4FA3C8', '#8FD3F0'], ['#3D7FD0', '#79B4F0'], ['#5B5BD8', '#9A9AF0'], ['#7A3BD0', '#B585F2'], ['#9B2BC0', '#D58AF0']], j, n);
  rect(c, x, y, w, h, base); rect(c, x, y, w, 2, top);
  for (let b = 0; b < 4 && w > 10; b++) {
    const p = ((t * 0.5 + b / 4 + seed * 0.013) % 1);
    rect(c, x + 2 + ((b * 37 + seed) % (w - 6)), Math.round(y + h - 4 - p * (h - 8)), 1.5, 1.5, 'rgba(230,240,255,0.7)');
  }
}

function tankLove(c, x, y, w, h, j, n) {
  const col = byDepth(['#F7B8D0', '#F28AB8', '#E85A8C', '#D9345E', '#B8123E'], j, n);
  rect(c, x, y, w, h, '#3A1A30');
  const draw = byDepth([flower, letter, heart, lips, ring], j, n);
  for (let hy = y + 1, row = 0; hy < y + h - 3; hy += 5, row++) {
    for (let hx = x + (row % 2 ? 4 : 1); hx < x + w - 6; hx += 8) draw(c, hx, hy, 0.75, col);
  }
}

// --- Work pieces in each zone, where agents strike: (c, x, y, w, h).
// Flat, about 36×11 units centred on the pipe, drawn in half-unit pixels.

// Fill a rounded blob row by row: halfWidth(t) for t in 0..1 from top to bottom.
function blob(c, cx, y, h, halfWidth, col) {
  c.fillStyle = col;
  for (let yy = 0; yy < h; yy += 0.5) {
    const hw = Math.round(halfWidth(yy / h) * 2) / 2;
    c.fillRect(cx - hw, y + yy, hw * 2, 0.5);
  }
}

function plateMine(c, x, y, w, h) {
  // A heap of rock with veins of gold and a crystal: rounded on top, flat where it lies on the tank.
  const cx = x + w / 2, dome = t => Math.sqrt(Math.max(0, 1 - (1 - t) ** 2));
  blob(c, cx, y, h, t => (w / 2) * dome(t), '#3E352E');
  blob(c, cx - 0.5, y + 0.5, h - 0.5, t => (w / 2 - 1.5) * dome(t), '#5C5047');
  rect(c, cx - 6, y + 2.5, 7, 1, '#7A6C60'); rect(c, cx + 2, y + 3.5, 4, 0.5, '#7A6C60');
  [[-9, 8, 3], [-4, 6, 2], [2, 7.5, 2.5], [6, 9, 3]].forEach(([dx, dy, l]) => {
    rect(c, cx + dx, y + dy, l, 1, '#D9A520'); rect(c, cx + dx, y + dy, 1, 0.5, '#FFE38A');
  });
  rect(c, cx + 4, y + 4, 2, 3, '#3FC7DA'); rect(c, cx + 4.5, y + 4, 1, 1, '#B8F4FF');
}

function plateLab(c, x, y, w, h) {
  // An empty Petri dish seen from the side: lid line, glass walls, flat bottom, reflections.
  const cx = x + w / 2;
  blob(c, cx, y + 1, h - 1, t => w / 2 - (t > 0.85 ? (t - 0.85) * 12 : 0), '#9FD3FF');
  blob(c, cx, y + 2.5, h - 4, t => w / 2 - 1.5, '#1B2836');
  rect(c, x + 1, y + 1, w - 2, 1, '#CDEBFF');
  rect(c, x + 3, y + 3.5, 8, 0.5, '#E6F6FF'); rect(c, x + w - 8, y + 6, 4, 0.5, '#7FB8E0');
  rect(c, x + 2, y + h - 2, w - 4, 0.5, '#CDEBFF');
}

function plateLove(c, x, y, w, h) {
  // A small bed: headboard with a heart, pillow, red blanket, footboard.
  rect(c, x, y - 3, 4, h + 3, '#9C4A66'); rect(c, x + 0.5, y - 2.5, 3, 0.5, '#E8A0B8');
  heart(c, x + 0.5, y - 1, 0.45, '#FFB8CC');
  rect(c, x + w - 2.5, y + 2, 2.5, h - 2, '#9C4A66');
  rect(c, x + 4, y + 3, w - 6.5, h - 5, '#F4EDE1');
  rect(c, x + 4.5, y + 1.5, 7, 4, '#FFFFFF'); rect(c, x + 4.5, y + 4.5, 7, 1, '#DCD3CC');
  rect(c, x + 12, y + 2.5, w - 14.5, h - 5, '#C8345E'); rect(c, x + 12, y + 2.5, w - 14.5, 1, '#E85A8C');
  rect(c, x + 12, y + 5, w - 14.5, 0.5, '#A82A50');
  rect(c, x + 1, y + h - 2, w - 1, 2, '#6E3046');
}

function plateCode(c, x, y, w, h) {
  // A small server rack: three units stacked in a dark case, status lights scattered along each
  // (still; the same rack everywhere).
  rect(c, x + 1, y, w - 2, h, '#14181E'); rect(c, x + 1, y, w - 2, 0.5, '#4A525C');
  const lights = [[0, 3, 7, 12, 16], [1, 5, 9, 14, 18], [2, 4, 10, 13, 17]];
  for (let u = 0; u < 3; u++) {
    const uy = y + 1 + u * 3.3;
    rect(c, x + 2, uy, w - 4, 2.8, '#2A323C'); rect(c, x + 2, uy, w - 4, 0.5, '#3E4852');
    for (let i = 0; i < 20; i += 2) rect(c, x + 3 + i, uy + 1, 1, 1.3, '#151A20');
    lights[u].forEach((i, k) => rect(c, x + 3 + i, uy + 1, 1, 1, (u + k) % 4 === 1 ? '#F2C14E' : '#3CF27A'));
  }
}

function plateMoney(c, x, y, w, h) {
  // A contract on a desk: paper with lines, a signature and a red seal.
  rect(c, x, y + h - 2, w, 2, '#5A2A1A'); rect(c, x, y + h - 2, w, 0.5, '#8A4A2A');
  rect(c, x + 3, y, w - 6, h - 2, '#F4EDE1'); rect(c, x + 3, y, w - 6, 0.5, '#FFFFFF');
  for (let r = 0; r < 3; r++) rect(c, x + 5, y + 1.5 + r * 1.5, w - 16, 0.5, '#9C948A');
  line2(c, x + 6, y + 7, x + 14, y + 6, '#2B3A6B');
  rect(c, x + w - 10, y + 4, 5, 4, '#C8263B'); rect(c, x + w - 10.5, y + 4.5, 6, 3, '#C8263B');
  rect(c, x + w - 9, y + 5, 3, 2, '#E85A6A');
}
function line2(c, x0, y0, x1, y1, col) {
  for (let i = 0; i <= 16; i++) rect(c, Math.round((x0 + (x1 - x0) * i / 16) * 2) / 2, Math.round((y0 + (y1 - y0) * i / 16 + Math.sin(i) * 0.6) * 2) / 2, 0.5, 0.5, col);
}

// --- Result items: (c, x, y, empty) in a 16×20 box ---

function resultFlask(c, x, y, empty) {
  const mx = x + 8;
  rect(c, mx - 2, y, 4, 2, '#8A5A2B');
  rect(c, mx - 3, y + 2, 6, 6, '#CDEBFF'); rect(c, mx - 1, y + 2, 2, 6, '#1B2B3A');
  for (let r = 0; r < 12; r++) {
    const hw = Math.round(3 + r * 5 / 11), yy = y + 8 + r;
    rect(c, mx - hw, yy, hw * 2, 1, '#CDEBFF');
    if (r === 11) continue;
    rect(c, mx - hw + 1, yy, hw * 2 - 2, 1, r < 4 || empty ? '#1B2B3A' : r === 4 ? '#C4A3F5' : '#8E5BD8');
  }
  rect(c, mx - 3, y + 15, 1, 2, '#FFFFFF');
}

function resultTreasure(c, x, y, empty) {
  // A treasure chest with a low base: shut while still to come; open and heaped with gold and gems
  // once it's in.
  rect(c, x, y + 13, 16, 6, '#6B3E1A'); rect(c, x + 1, y + 14, 14, 4, '#8A5426');
  rect(c, x, y + 13, 16, 1, '#D9A520'); rect(c, x + 3, y + 13, 1.5, 6, '#B07A30'); rect(c, x + 11.5, y + 13, 1.5, 6, '#B07A30');
  if (empty) {
    rect(c, x, y + 9.5, 16, 3.5, '#7A4A20'); rect(c, x + 1, y + 8.5, 14, 1, '#7A4A20'); rect(c, x + 1, y + 8.5, 14, 0.5, '#9C6230');
    rect(c, x + 7, y + 12, 2, 3, '#B07A30'); rect(c, x + 7.5, y + 13, 1, 1, '#3A2414');
    return;
  }
  // lid thrown back behind a big heap of gold coins
  rect(c, x, y + 3, 16, 5, '#7A4A20'); rect(c, x, y + 3, 16, 0.5, '#9C6230'); rect(c, x + 1, y + 4, 14, 3.5, '#4A2A10');
  blob(c, x + 8, y + 5, 8.5, t => 3 + Math.sqrt(t) * 5.5, '#B8860B');
  blob(c, x + 8, y + 5.5, 7.5, t => 2.5 + Math.sqrt(t) * 5, '#F2C14E');
  [[3, 11], [5.5, 9], [8, 7], [10.5, 9.5], [12.5, 11.5], [7, 11], [9.5, 12]].forEach(([dx, dy]) => {
    rect(c, x + dx, y + dy, 1.5, 0.5, '#FFF6C9'); rect(c, x + dx, y + dy + 0.5, 1.5, 0.5, '#D9A520');
  });
  rect(c, x + 4.5, y + 10, 2, 2, '#E8345E'); rect(c, x + 5, y + 10, 0.5, 0.5, '#FFB8CC');
  rect(c, x + 10.5, y + 8, 2, 2, '#3FC7DA'); rect(c, x + 11, y + 8, 0.5, 0.5, '#B8F4FF');
  rect(c, x + 7.5, y + 5.5, 1.5, 1.5, '#7CF0B0');
}

function resultHeart(c, x, y, empty) {
  heart(c, x + 1, y + 3, 2, empty ? '#5A3A50' : '#E8345E');
  if (empty) heart(c, x + 3, y + 5, 1.4, '#2A1530');
  else rect(c, x + 4, y + 6, 2, 2, '#FFB8CC');
}


// --- Code and money themes: zones, tanks, results ---

function zoneCode(c, x0, y, w, h) {
  rect(c, x0, y, w, h, '#0E141C');
  for (let rx = x0 + 6; rx < x0 + w - 10; rx += 26) {
    rect(c, rx, y + 6, 18, h - 9, '#18212C'); rect(c, rx, y + 6, 18, 0.5, '#2A3644');
    for (let ry = y + 9; ry < y + h - 4; ry += 4) {
      rect(c, rx + 1.5, ry, 15, 2.5, '#1F2A36');
      rect(c, rx + 13, ry + 1, 1, 1, (rx + ry) % 3 ? '#3CF27A' : '#F2C14E');
    }
  }
  rect(c, x0 - 2, y, w + 4, 4, '#3A424C'); rect(c, x0 - 2, y + 1, w + 4, 0.5, '#3C8AF2');
  rect(c, x0 - 2, y + 2, w + 4, 0.5, '#F2C14E'); rect(c, x0 - 2, y + 3, w + 4, 0.5, '#3CF27A');
  rect(c, x0 - 2, y, 3, h, '#2A323C'); rect(c, x0 + w - 1, y, 3, h, '#2A323C');
  rect(c, x0 - 2, y + h - 2, w + 4, 2, '#1A2028');
}

function tankCode(c, x, y, w, h, j, n, t, seed) {
  const [dim, bright] = byDepth([['#123A22', '#2E8A50'], ['#4A4A10', '#D8D83C'], ['#5A3410', '#F29A3C'], ['#107A80', '#5CF0F0'], ['#1A4A9A', '#7CB8FF']], j, n);
  rect(c, x, y, w, h, '#06100A');
  const r = rng(seed);
  for (let col = x + 1; col < x + w - 1; col += 2.5) {
    const off = (t * (3 + r() * 4) + r() * h) % h;
    for (let k = 0; k < h; k += 2) {
      const yy = y + ((k + off) % h);
      rect(c, col, yy, 1, 1.5, k < 2 ? bright : dim);
    }
  }
}

function resultChip(c, x, y, empty) {
  const body = empty ? '#3A3F48' : '#1E2228';
  for (let i = 0; i < 5; i++) {
    rect(c, x + 3 + i * 2.2, y + 2, 1, 2, empty ? '#5E6670' : '#D9A520');
    rect(c, x + 3 + i * 2.2, y + 16, 1, 2, empty ? '#5E6670' : '#D9A520');
  }
  rect(c, x + 1, y + 4, 14, 12, body); rect(c, x + 1, y + 4, 14, 0.5, '#4A525C');
  if (!empty) {
    rect(c, x + 4, y + 8, 1, 1, '#3CF27A'); rect(c, x + 3, y + 9, 1, 1, '#3CF27A'); rect(c, x + 4, y + 10, 1, 1, '#3CF27A');
    rect(c, x + 7.5, y + 7.5, 1, 1, '#3CF27A'); rect(c, x + 7, y + 9, 1, 1, '#3CF27A'); rect(c, x + 6.5, y + 10.5, 1, 1, '#3CF27A');
    rect(c, x + 11, y + 8, 1, 1, '#3CF27A'); rect(c, x + 12, y + 9, 1, 1, '#3CF27A'); rect(c, x + 11, y + 10, 1, 1, '#3CF27A');
  }
}

function zoneMoney(c, x0, y, w, h) {
  rect(c, x0, y, w, h, '#16241C');
  for (let sx = x0 + 3; sx < x0 + w; sx += 6) rect(c, sx, y + 4, 2, h - 6, '#1B2C22');
  rect(c, x0 - 2, y, w + 4, 4, '#5A2A1A'); rect(c, x0 - 2, y + 3, w + 4, 1, '#C9A040');
  rect(c, x0 - 2, y, 3, h, '#5A2A1A'); rect(c, x0 + w - 1, y, 3, h, '#5A2A1A');
  rect(c, x0 - 2, y + h - 2, w + 4, 2, '#3A1A10');
}

// Money from small to big, top stages to bottom: copper pennies, banknotes, silver bars, gold bars, bitcoins.
function tankMoney(c, x, y, w, h, j, n) {
  rect(c, x, y, w, h, '#14201A');
  const kind = byDepth(['coin', 'note', 'silver', 'gold', 'btc'], j, n);
  if (kind === 'note') {
    for (let by = y + h - 4, row = 0; by > y - 2; by -= 3.5, row++) {
      for (let bx = x + (row % 2 ? 4 : 0); bx < x + w - 6; bx += 8.5) {
        rect(c, bx, by, 8, 3.5, '#2E6B3A'); rect(c, bx + 0.5, by + 0.5, 7, 2.5, '#5DAA5E');
        rect(c, bx + 3, by + 1, 2, 1.5, '#2E6B3A'); rect(c, bx + 1, by + 1.5, 0.5, 0.5, '#C6F0B0'); rect(c, bx + 6.5, by + 1.5, 0.5, 0.5, '#C6F0B0');
      }
    }
  } else if (kind === 'silver' || kind === 'gold') {
    // Ingots stacked like bricks: a lighter top face over a darker side.
    const [top, side, edge] = kind === 'gold' ? ['#FFE38A', '#E0A82E', '#8A6010'] : ['#AEB5BF', '#858C96', '#4A4F58'];
    for (let by = y + h - 4, row = 0; by > y - 3; by -= 3.5, row++) {
      for (let bx = x + (row % 2 ? 3.5 : 0); bx < x + w - 5; bx += 7) {
        rect(c, bx, by, 6.5, 3, edge); rect(c, bx + 0.5, by + 1, 5.5, 2, side); rect(c, bx + 1, by, 4.5, 1, top);
      }
    }
  } else {
    // Round coins: copper pennies, or orange bitcoins with the ₿ sign.
    const btc = kind === 'btc', [face, rim] = btc ? ['#F7931A', '#A85E08'] : ['#B8693A', '#6E3A1C'];
    for (let cy = y + h - 6, row = 0; cy > y - 4; cy -= 5.5, row++) {
      for (let cx = x + (row % 2 ? 3 : 0); cx < x + w - 5; cx += 6) {
        disc(c, cx + 2.75, cy + 2.75, 2.75, rim); disc(c, cx + 2.75, cy + 2.5, 2.25, face);
        if (btc) pixmap(c, cx + 1.5, cy + 0.75, 0.5, ['.I.I.', 'IIII.', 'I...I', 'IIII.', 'I...I', 'IIII.', '.I.I.'], { I: '#FFFFFF' });
        else rect(c, cx + 1.5, cy + 1, 1, 1, '#E09A6A');
      }
    }
  }
}
function disc(c, px, py, r, colour) {
  c.fillStyle = colour;
  for (let dy = -r; dy <= r; dy += 0.5) for (let dx = -r; dx <= r; dx += 0.5) {
    if (dx * dx + dy * dy <= r * r) c.fillRect(Math.round((px + dx) * 2) / 2, Math.round((py + dy) * 2) / 2, 0.5, 0.5);
  }
}

function resultBag(c, x, y, empty) {
  if (empty) {
    blob(c, x + 8, y + 9, 10, t => 6 - t * 1.5, '#4A3A2A');
    rect(c, x + 6, y + 6, 4, 3, '#4A3A2A');
    return;
  }
  rect(c, x + 6, y + 2, 4, 3, '#8A6238'); rect(c, x + 5, y + 4.5, 6, 1, '#C9A040');
  blob(c, x + 8, y + 5.5, 14, t => 3 + Math.sin(Math.min(1, t * 1.4) * Math.PI / 1.4) * 4.5, '#A87A48');
  blob(c, x + 7, y + 6.5, 12, t => 2 + Math.sin(Math.min(1, t * 1.4) * Math.PI / 1.4) * 3, '#C49460');
  rect(c, x + 7.5, y + 10, 1, 7, '#2E6B3A');
  rect(c, x + 6, y + 11, 3.5, 1, '#2E6B3A'); rect(c, x + 6, y + 13, 3.5, 1, '#2E6B3A'); rect(c, x + 6, y + 15, 3.5, 1, '#2E6B3A');
  rect(c, x + 6, y + 11, 1, 2, '#2E6B3A'); rect(c, x + 8.5, y + 13, 1, 2, '#2E6B3A');
}

// --- Garden theme: backdrop, tanks, the flower bed in each zone, flower pots ---

function backGarden(c, x, w, h, r) {
  rect(c, x, 0, w, h, '#142012');
  for (let i = 0; i < w * h / 40; i++) {
    const v = r();
    rect(c, x + (Math.floor(r() * w) & ~1), Math.floor(r() * h) & ~1, v < 0.5 ? 2 : 1, 1, v < 0.6 ? '#1A2A17' : v < 0.95 ? '#22361D' : '#3A2A40');
  }
}

// Growing from seed to bloom, top stages to bottom: sprouts, buds, then pink, red and purple flowers.
function tankGarden(c, x, y, w, h, j, n) {
  rect(c, x, y, w, h, '#16240F');
  const kind = byDepth(['sprout', 'bud', '#F28AB8', '#E8345E', '#B585F2'], j, n);
  for (let fy = y + 1, row = 0; fy < y + h - 4; fy += 6.5, row++) {
    for (let fx = x + (row % 2 ? 4 : 0.5); fx < x + w - 6; fx += 7.5) {
      if (kind === 'sprout') pixmap(c, fx + 0.5, fy + 0.5, 1, ['L...L', '.L.L.', '..S..', '..S..', '.DDD.'], { L: '#8FD46A', S: '#4E8A3A', D: '#5A3A22' });
      else if (kind === 'bud') pixmap(c, fx + 0.5, fy, 1, ['..P..', '.PPP.', '.LPL.', 'L.S.L', '..S..', '..S..'], { P: '#F28AB8', L: '#6BB84E', S: '#3E7A30' });
      else {
        rect(c, fx + 2.5, fy + 4, 0.5, 2.5, '#3E7A30'); rect(c, fx + 3, fy + 5, 1.5, 1, '#6BB84E');
        flower(c, fx, fy - 0.5, 1, kind);
      }
    }
  }
}

function plateGarden(c, x, y, w, h) {
  // A flower bed: four flowers on stems with leaves, growing out of a soil bed.
  const cx = x + w / 2;
  rect(c, x + 1, y + h - 2.5, w - 2, 2.5, '#5A3A22'); rect(c, x + 1, y + h - 2.5, w - 2, 0.5, '#7A5232');
  ['#F28AB8', '#FFD24A', '#E8345E', '#F4EDE1'].forEach((col, i) => {
    const fx = cx - 9 + i * 6, top = y + (i % 2 ? 0 : 1);
    rect(c, fx, top + 4, 0.5, y + h - 2.5 - top - 4, '#3E7A30');
    rect(c, fx - 1.5, top + 6.5, 1.5, 1, '#6BB84E'); rect(c, fx + 0.5, top + 5.5, 1.5, 1, '#6BB84E');
    flower(c, fx - 2.5, top - 0.5, 1, col);
  });
}

function resultPot(c, x, y, empty) {
  // A clay pot; a flower blooms in it once the result is in.
  rect(c, x + 2, y + 11, 12, 2, '#B8642E'); rect(c, x + 2, y + 11, 12, 0.5, '#D88A50');
  for (let r = 0; r < 6; r++) rect(c, x + 3 + r * 0.4, y + 13 + r, 10 - r * 0.8, 1, r % 5 ? '#9C5226' : '#7A3E1C');
  if (empty) { rect(c, x + 3, y + 11.5, 10, 1, '#3A2414'); return; }
  rect(c, x + 7.5, y + 4, 1, 7, '#3E7A30');
  rect(c, x + 4.5, y + 7, 3, 1.5, '#6BB84E'); rect(c, x + 8.5, y + 8, 3, 1.5, '#6BB84E');
  flower(c, x + 5.25, y, 1, '#E8345E');
}

// --- One piece of what a tank holds, for the heap look: (c, x, y, j, n) draws it with its top-left
// at x, y; w and h are the cell it takes in the heap. The lab holds a liquid and has no pieces.
const pieceMine = {
  w: 4.5, h: 4,
  draw(c, x, y, j, n) {
    const ore = byDepth([['#4A4A4A', '#6B6B6B'], ['#9C5A2E', '#C47A45'], ['#7F8790', '#AEB5BF'], ['#D9A520', '#FFD866'], ['#2F7FD8', '#8FC4FF']], j, n);
    if (j === n - 1 && n > 1) {
      rect(c, x + 0.5, y, 2.5, 1, ore[1]); rect(c, x, y + 1, 3.5, 1, ore[0]);
      rect(c, x + 0.75, y + 2, 2, 0.5, ore[0]); rect(c, x + 1.25, y + 2.5, 1, 0.5, ore[0]);
    } else { rect(c, x, y, 3.5, 3, ore[0]); rect(c, x + 0.5, y + 0.5, 1.5, 1, ore[1]); }
  },
};
const pieceGarden = {
  w: 6, h: 7,
  draw(c, x, y, j, n) {
    const kind = byDepth(['sprout', 'bud', '#D4507E', '#E8345E', '#B585F2'], j, n);
    if (kind === 'sprout') pixmap(c, x + 0.5, y + 1.5, 1, ['L...L', '.L.L.', '..S..', '..S..', '.DDD.'], { L: '#8FD46A', S: '#4E8A3A', D: '#5A3A22' });
    else if (kind === 'bud') pixmap(c, x + 0.5, y + 0.5, 1, ['..P..', '.PPP.', '.LPL.', 'L.S.L', '..S..', '..S..'], { P: '#F28AB8', L: '#6BB84E', S: '#3E7A30' });
    else { rect(c, x + 2.5, y + 4.5, 0.5, 2.5, '#3E7A30'); rect(c, x + 3, y + 5.5, 1.5, 1, '#6BB84E'); flower(c, x, y, 1, kind, '#5A1E30'); }
  },
};
const pieceLove = {
  w: 7, h: 5,
  draw(c, x, y, j, n) {
    // Darker than in the old tanks, so the count over them stays readable.
    const col = byDepth(['#D86A98', '#E0609A', '#E85A8C', '#D9345E', '#B8123E'], j, n);
    const darkFlower = (c2, x2, y2, s2, col2) => flower(c2, x2, y2, s2, col2, '#7A1E44');
    byDepth([darkFlower, letter, heart, lips, ring], j, n)(c, x, y, 0.75, col);
  },
};
// Code: floppy disks, a colour per stage: a case, a metal shutter on top, a white label below.
const pieceCode = {
  w: 5.5, h: 5.5,
  draw(c, x, y, j, n) {
    // Muted: a bright label would outshine the count over the heap.
    const col = byDepth(['#2C52A8', '#2E7E46', '#A87A18', '#A84424', '#7038A0'], j, n);
    rect(c, x, y, 5, 5, col); rect(c, x + 1.5, y, 2, 1.5, '#8E949E'); rect(c, x + 2.5, y + 0.5, 0.5, 0.5, '#1E2228');
    rect(c, x + 1, y + 2.5, 3, 2, '#8C8576'); rect(c, x + 1.5, y + 3, 2, 0.5, '#5E584C');
  },
};
const pieceMoney = {
  w: 6.5, h: 6.5,
  draw(c, x, y, j, n) {
    const kind = byDepth(['coin', 'note', 'silver', 'gold', 'btc'], j, n);
    if (kind === 'note') {
      rect(c, x, y + 1, 5.5, 3.5, '#2E6B3A'); rect(c, x + 0.5, y + 1.5, 4.5, 2.5, '#5DAA5E'); rect(c, x + 2, y + 2, 1.5, 1.5, '#2E6B3A');
    } else if (kind === 'silver' || kind === 'gold') {
      const [top, side, edge] = kind === 'gold' ? ['#FFE38A', '#E0A82E', '#8A6010'] : ['#AEB5BF', '#858C96', '#4A4F58'];
      rect(c, x, y + 2, 5.5, 3, edge); rect(c, x + 0.5, y + 3, 4.5, 2, side); rect(c, x + 1, y + 2, 3.5, 1, top);
    } else if (kind === 'btc') {
      // A bitcoin: an orange coin with a white ₿.
      disc(c, x + 3, y + 3, 3, '#A85E08'); disc(c, x + 3, y + 2.75, 2.5, '#F7931A');
      pixmap(c, x + 1.75, y + 1, 0.5, ['.I.I.', 'IIII.', 'I...I', 'IIII.', 'I...I', 'IIII.', '.I.I.'], { I: '#FFFFFF' });
    } else {
      // A copper penny: a dark rim, an inner ring and a glint.
      disc(c, x + 3, y + 3, 3, '#6E3A1C'); disc(c, x + 3, y + 2.75, 2.5, '#C27840');
      disc(c, x + 3, y + 2.75, 1.5, '#9A5A2C'); disc(c, x + 3, y + 2.75, 1, '#C27840');
      rect(c, x + 1.5, y + 1, 1, 0.5, '#F0B080');
    }
  },
};

// --- Forge: smiths at an anvil ---

function backForge(c, x, w, h, r) {
  // A soot-dark brick wall, a few bricks lit by the fire.
  rect(c, x, 0, w, h, '#1E1714');
  for (let by = 0, row = 0; by < h; by += 5, row++) {
    for (let bx = x - (row % 2 ? 5 : 0); bx < x + w; bx += 10) {
      const v = r();
      rect(c, Math.max(x, bx), by, Math.min(9.5, x + w - Math.max(x, bx), bx + 9.5 - x), 4.5, v < 0.85 ? '#251C18' : v < 0.97 ? '#2E211B' : '#3A2418');
    }
  }
}

function plateForge(c, x, y, w, h) {
  // An anvil: a horn on the left, a flat face with a red-hot bar on it, a waist and a wide foot.
  const cx = x + w / 2;
  rect(c, x + 1, y + 1, w - 4, 3.5, '#4A4E56'); rect(c, x + 1, y + 1, w - 4, 0.5, '#8E949E');
  blob(c, x + 2.5, y + 1, 3.5, t => 2.5 * (1 - t) + 0.5, '#4A4E56');
  rect(c, x - 1, y + 1.5, 3, 1.5, '#4A4E56'); rect(c, x - 1, y + 1.5, 3, 0.5, '#8E949E');
  rect(c, cx - 4, y + 4.5, 8, 3, '#3A3E46');
  rect(c, cx - 8, y + 7.5, 16, 3.5, '#2E3138'); rect(c, cx - 8, y + 7.5, 16, 0.5, '#5E636D');
  rect(c, cx - 5, y - 0.5, 10, 1.5, '#E8501E'); rect(c, cx - 4, y - 0.5, 6, 0.5, '#FFC04A');
}

// Forging from raw to fine, top stages to bottom: ore, iron ingots, horseshoes, swords, gold crowns.
const pieceForge = {
  w: 6.5, h: 5.5,
  draw(c, x, y, j, n) {
    const kind = byDepth(['ore', 'ingot', 'shoe', 'sword', 'crown'], j, n);
    if (kind === 'ore') { rect(c, x, y + 1, 4.5, 3.5, '#3A3632'); rect(c, x + 0.5, y + 1.5, 1.5, 1, '#9C4A2A'); rect(c, x + 2.5, y + 2.5, 1, 1, '#9C4A2A'); }
    else if (kind === 'ingot') { rect(c, x, y + 2, 5.5, 3, '#3E434C'); rect(c, x + 0.5, y + 3, 4.5, 2, '#5E646E'); rect(c, x + 1, y + 2, 3.5, 1, '#868C96'); }
    else if (kind === 'shoe') pixmap(c, x, y + 0.5, 1, ['S...S', 'S...S', 'S...S', '.SSS.'], { S: '#6E747E' });
    else if (kind === 'sword') {
      // A sword lying flat: grip and pommel, a gold crossguard, a long bright blade.
      rect(c, x, y + 2.5, 1.5, 1, '#5A3A22'); rect(c, x + 1.5, y + 1, 1, 4, '#B8860B');
      rect(c, x + 2.5, y + 2.5, 3.5, 1, '#8E949E'); rect(c, x + 2.5, y + 2.5, 3.5, 0.5, '#C8CCD2'); rect(c, x + 6, y + 2.75, 0.5, 0.5, '#8E949E');
    } else pixmap(c, x, y + 0.5, 1, ['Y.YY.Y', 'YYYYYY', 'YRYYBY', 'DDDDDD'], { Y: '#C8901E', D: '#8A6010', R: '#C8263B', B: '#3A7AD8' });
  },
};

function resultArmour(c, x, y, empty) {
  // A suit of plate armour on a stand: shoulder plates, a breastplate with a gold trim and a red
  // emblem, a skirt of plates. A dark blank while still to come.
  const [steel, light, dark] = empty ? ['#3A3E46', '#4A4E56', '#2A2D33'] : ['#9AA0AA', '#D8DDE4', '#5E646E'];
  rect(c, x + 7.5, y + 18, 1, 2, empty ? '#2A2D33' : '#6E4A2A'); rect(c, x + 5, y + 19.5, 6, 0.5, empty ? '#2A2D33' : '#6E4A2A');
  rect(c, x + 1, y + 3, 4, 3, steel); rect(c, x + 11, y + 3, 4, 3, steel);
  rect(c, x + 1, y + 3, 4, 0.5, light); rect(c, x + 11, y + 3, 4, 0.5, light);
  rect(c, x + 6, y + 2, 4, 1.5, dark);
  blob(c, x + 8, y + 3, 10, t => 4.5 - t * 1.2, steel);
  rect(c, x + 4, y + 3.5, 1, 8, light); rect(c, x + 11.5, y + 4, 1, 8, dark);
  rect(c, x + 4, y + 13, 8, 1, empty ? dark : '#C8901E');
  rect(c, x + 3.5, y + 14, 9, 2, steel); rect(c, x + 4, y + 16, 8, 1.5, steel); rect(c, x + 3.5, y + 15.5, 9, 0.5, dark);
  if (!empty) { rect(c, x + 7, y + 6, 2, 5, '#B8342A'); rect(c, x + 5.5, y + 7.5, 5, 1.5, '#B8342A'); }
}

// --- Bakery: bakers rolling dough ---

function backBakery(c, x, w, h) {
  // Warm kitchen tiles.
  rect(c, x, 0, w, h, '#2A1F18');
  for (let ty = 0; ty < h; ty += 8) for (let tx = x + ((ty / 8) % 2 ? 4 : 0); tx < x + w; tx += 8) rect(c, tx, ty, 7.5, 7.5, '#30241C');
}

function plateBakery(c, x, y, w, h) {
  // A wooden board dusted with flour, a lump of dough on it.
  const cx = x + w / 2;
  rect(c, x, y + h - 3, w, 3, '#8A5A2E'); rect(c, x, y + h - 3, w, 0.5, '#B07A40'); rect(c, x + w - 3, y + h - 2, 2, 1, '#6E4420');
  blob(c, cx, y + 2, h - 5, t => 9 * Math.sqrt(Math.max(0, 1 - (1 - t) ** 2)), '#E8D2A8');
  rect(c, cx - 5, y + 3.5, 4, 0.5, '#FFF2D8'); rect(c, cx + 3, y + 5, 2, 0.5, '#C8AC80');
  [[-11, 9], [-8, 8.5], [8, 9], [11, 8.5]].forEach(([dx, dy]) => rect(c, cx + dx, y + dy - 1, 1, 0.5, '#F4EDE1'));
}

// Baking from plain to fancy, top stages to bottom: dough balls, pizzas, pies, cupcakes, whole cakes.
const pieceBakery = {
  w: 6, h: 5.5,
  draw(c, x, y, j, n) {
    const kind = byDepth(['dough', 'pizza', 'pie', 'cupcake', 'cake'], j, n);
    if (kind === 'dough') { disc(c, x + 2.5, y + 3, 2.25, '#B89A70'); rect(c, x + 1.5, y + 1.5, 1, 0.5, '#D8C098'); }
    else if (kind === 'pizza') {
      // A round pizza from above: a crust ring, tomato, cheese and pepperoni.
      disc(c, x + 2.75, y + 2.75, 2.75, '#A8642A'); disc(c, x + 2.75, y + 2.75, 2.1, '#B8402A');
      rect(c, x + 1.5, y + 2, 1, 0.5, '#E8C060'); rect(c, x + 3, y + 3.5, 1, 0.5, '#E8C060');
      rect(c, x + 3, y + 1.5, 1, 1, '#6E1A14'); rect(c, x + 1.5, y + 3.5, 1, 1, '#6E1A14');
    }
    else if (kind === 'pie') { rect(c, x, y + 2, 5.5, 2.5, '#9C5A26'); rect(c, x + 0.5, y + 1.5, 4.5, 1, '#B87436'); rect(c, x + 1.5, y + 2.5, 0.5, 1, '#6E3A14'); rect(c, x + 3.5, y + 2.5, 0.5, 1, '#6E3A14'); }
    else if (kind === 'cupcake') pixmap(c, x, y, 1, ['..R..', '.PPP.', 'PPPPP', '.WWW.', '.WWW.'], { R: '#C8263B', P: '#B85A88', W: '#7A5A3A' });
    else pixmap(c, x, y, 1, ['..R...', 'PPPPPP', 'WWWWWW', 'PPPPPP', 'CCCCCC'], { R: '#C8263B', P: '#B85A88', W: '#9A6A40', C: '#5A3020' });
  },
};

function resultCake(c, x, y, empty) {
  // A layer cake with a cherry on a cake stand once baked; the same cake as a dark shape while still
  // to come.
  const [stand, top, sponge, cream, cherry] = empty
    ? ['#4A453C', '#5A5048', '#3E3630', '#4E4640', '#5A5048']
    : ['#C8C2B4', '#FFF2F6', '#E89AB8', '#6E3A20', '#C8263B'];
  rect(c, x + 1, y + 16, 14, 1, stand); rect(c, x + 7, y + 17, 2, 2, stand); rect(c, x + 5, y + 19, 6, 1, stand);
  rect(c, x + 3, y + 9, 10, 7, sponge); rect(c, x + 3, y + 12, 10, 1, cream); rect(c, x + 3, y + 9, 10, 1.5, top);
  for (let k = 0; k < 5; k++) rect(c, x + 3.5 + k * 2, y + 10.5, 1, 1, top);
  disc(c, x + 8, y + 7.5, 1.5, cherry); if (!empty) rect(c, x + 8, y + 5, 0.5, 1.5, '#3E7A30');
}

// --- Blocks: block-headed heroes fighting a slime ---

function backBlocks(c, x, w, h, r) {
  // A cave wall of stone blocks, each with a few darker pixels.
  rect(c, x, 0, w, h, '#2C2C2E');
  for (let by = 0; by < h; by += 8) for (let bx = x; bx < x + w; bx += 8) {
    const v = r();
    rect(c, bx, by, 7.5, 7.5, v < 0.5 ? '#303033' : v < 0.9 ? '#343437' : '#3A332C');
    for (let k = 0; k < 3; k++) rect(c, bx + Math.floor(r() * 6), by + Math.floor(r() * 6), 1, 1, '#262628');
  }
}

function plateBlocks(c, x, y, w, h) {
  // A green slime: a translucent cube with a darker core and a face, squatting on the tank.
  rect(c, x + 2, y + 1, w - 4, h - 1, '#4E9A3A'); rect(c, x + 2, y + 1, w - 4, 1, '#8FD46A');
  rect(c, x + 5, y + 3, w - 10, h - 5, '#3A7A2A');
  rect(c, x + 8, y + 4, 2.5, 2.5, '#14240E'); rect(c, x + w - 10.5, y + 4, 2.5, 2.5, '#14240E');
  rect(c, x + 11, y + 8, 4, 1, '#14240E');
  rect(c, x + 3, y + 2.5, 1, 1, '#C6F0B0');
}

// Loot blocks from common to rare, top stages to bottom: coal, iron, gold, emerald, diamond.
const pieceBlocks = {
  w: 5.5, h: 5.5,
  draw(c, x, y, j, n) {
    const [base, spot, edge] = byDepth([['#2E2E30', '#141416', '#46464A'], ['#9AA0AA', '#6E747E', '#C8CCD2'], ['#C8901E', '#8A6010', '#E8C060'], ['#1E9A4A', '#0E5A2A', '#5CD88A'], ['#2E9AA8', '#1E6E7A', '#7CE8F0']], j, n);
    rect(c, x, y, 5, 5, base); rect(c, x, y, 5, 0.5, edge); rect(c, x, y, 0.5, 5, edge);
    rect(c, x + 1, y + 1.5, 1, 1, spot); rect(c, x + 3, y + 3, 1, 1, spot); rect(c, x + 3.5, y + 1, 1, 0.5, spot);
  },
};

function resultGem(c, x, y, empty) {
  // A cut diamond: a flat table with light facets over a pointed pavilion; glinting once won, a dark
  // shape while still to come.
  const col = empty ? ['#5A7076', '#4A5E64', '#3A4C52', '#2E3E44'] : ['#E6FDFF', '#8EF0F8', '#3FC8D8', '#1E8A98'];
  pixmap(c, x + 1, y + 6, 1, [
    '...DDDDDDDD...', '..DAABAABAAD..', '.DABBABBABBAD.', 'DDDDDDDDDDDDDD',
    '.DCCBCCCCBCCD.', '..DCCBCCBCCD..', '...DCCBBCCD...', '....DCBBCD....', '.....DCCD.....', '......DD......',
  ], { A: col[0], B: col[1], C: col[2], D: col[3] });
  if (!empty) { rect(c, x + 5, y + 7, 1, 1, '#FFFFFF'); rect(c, x + 4, y + 8, 1, 1, '#FFFFFF'); }
}

export const THEMES = {
  mine: { pipe: ['#3A2418', '#8A5A3A', '#B07A50', '#2A1A10'], piece: pieceMine, tankBg: '#2A2420', emptyAlpha: 0.3, backdrop: backMine, frame: '#8A6238', zone: zoneMine, tank: tankMine, plate: plateMine, result: resultTreasure, outfit: 'helmet', tool: 'pickaxe', spark: '#FFE38A', accent: '#FFD866' },
  lab: { drop: (j, n) => byDepth(['#8FD3F0', '#79B4F0', '#9A9AF0', '#B585F2', '#D58AF0'], j, n), pipe: ['#7FB8D8', '#1E3A50', '#E8F6FF', null], tankBg: '#122233', emptyAlpha: 0.3, backdrop: backLab, frame: '#9FD3FF', zone: zoneLab, tank: tankLab, plate: plateLab, result: resultFlask, outfit: 'goggles', tool: 'beaker', spark: '#B585F2', accent: '#C4A3F5' },
  garden: { pipe: ['#2E5A22', '#4E8A3A', '#7CC05A', '#24481A'], piece: pieceGarden, tankBg: '#16240F', emptyAlpha: 0.3, backdrop: backGarden, frame: '#7A5232', tank: tankGarden, plate: plateGarden, result: resultPot, outfit: 'straw', tool: 'shears', spark: '#8FD46A', accent: '#F28AB8' },
  love: { pipe: ['#8A2A55', '#E06A9A', '#F7B8D0', '#D9A520'], piece: pieceLove, tankBg: '#3A1A30', backdrop: backLove, frame: '#F28AB8', zone: zoneLove, tank: tankLove, plate: plateLove, result: resultHeart, outfit: 'wings', tool: 'bow', spark: '#F28AB8', accent: '#F28AB8' },
  code: { pipe: ['#0A140E', '#1E2A22', '#3A4A3E', '#3CF27A'], bandH: 1, piece: pieceCode, tankBg: '#06100A', emptyAlpha: 0.3, backdrop: backCode, frame: '#3CF27A', zone: zoneCode, tank: tankCode, plate: plateCode, result: resultChip, outfit: 'hoodie', tool: 'laptop', spark: '#3CF27A', accent: '#7CF0B0' },
  money: { pipe: ['#7A5A10', '#C8961E', '#F2D068', '#5A400A'], piece: pieceMoney, tankBg: '#14201A', backdrop: backMoney, frame: '#D9A520', zone: zoneMoney, tank: tankMoney, plate: plateMoney, result: resultBag, outfit: 'suit', tool: 'stamp', spark: '#FFD866', accent: '#9FE870' },
  forge: { pipe: ['#1E1E22', '#3A3E46', '#6E747E', '#E8501E'], bandH: 1, piece: pieceForge, tankBg: '#1A1412', emptyAlpha: 0.35, backdrop: backForge, frame: '#C8602A', plate: plateForge, result: resultArmour, outfit: 'smith', tool: 'hammer', spark: '#FFB040', accent: '#FF9A3C' },
  bakery: { pipe: ['#6E4420', '#C8964A', '#F2D8A8', '#E89AB8'], piece: pieceBakery, tankBg: '#241A14', emptyAlpha: 0.5, backdrop: backBakery, frame: '#E8C08A', plate: plateBakery, result: resultCake, outfit: 'chef', tool: 'rollingPin', spark: '#F4EDE1', accent: '#F2A6C0' },
  blocks: { pipe: ['#3A2814', '#6B4A2A', '#8A6238', '#4E9A2E'], piece: pieceBlocks, tankBg: '#1C1C1E', emptyAlpha: 0.5, backdrop: backBlocks, frame: '#6BA34A', plate: plateBlocks, result: resultGem, outfit: 'blocky', tool: 'sword', spark: '#8FD46A', accent: '#5CE0E8' },
};

export const themeOf = f => THEMES[f.theme] || THEMES.mine;
