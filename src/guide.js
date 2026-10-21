// The funnel the landing page and the README explain: the demo's Job Search cut to two stages,
// with an agent in each state the labels point at. They stay in their states, so the labels always
// point at them. The landing page runs it live; tools/render-docs.js records it.
import { FUNNELS } from './data.js?v=6cbe2523';
import { Scene, CW } from './scene.js?v=6cbe2523';

export const TH = 22;  // the title strip over the funnel, in scene units
const FONT = 'Rubik, system-ui, sans-serif';

export function guideScene() {
  const job = FUNNELS[0];
  const f0 = {
    ...job,
    // The top tank (179 pieces when full) starts at 50: about 110 when the README pictures are taken,
    // so the pieces dropping in show it fill up.
    stages: [{ ...job.stages[0], count: 50 }, job.stages[3]],
    flows: [job.flows[0], job.flows[3], job.flows[5]],
    workers: [
      { agent: 'chatgpt', zone: -1, state: 'work', keep: true }, { agent: 'perplexity', zone: -1, state: 'work', keep: true },
      { agent: 'claude', zone: 0, state: 'ask', question: job.workers.find(w => w.state === 'ask').question }, { agent: 'gemini', zone: 0, state: 'work', keep: true },
      // Mistral has said nothing for 20 minutes at work: the amber triangle over it.
      { agent: 'grok', zone: 1, state: 'sleep', wakeIn: 12, keep: true }, { agent: 'mistral', zone: 1, state: 'work', keep: true, silentFor: 20 * 60 },
    ],
  };
  // The agents the arrows point at stand on the left, by the labels, so no arrow crosses anything
  // on its way; the agent sharing a zone with them goes right.
  const sides = new Map([['chatgpt', 'L'], ['perplexity', 'R'], ['claude', 'L'], ['gemini', 'R'], ['grok', 'L'], ['mistral', 'R']]
    .map(([id, side]) => [`${f0.title}|${id}`, side]));
  const scene = new Scene(document.createElement('canvas'), [f0], { sides });
  // The supervisor's walk is timed so it stands at the platform's left end, where the arrow points,
  // from 15 to 17.5 seconds in: when the README pictures are taken.
  scene.agents.find(a => a.sup).phase = 0.1;
  return scene;
}

// How much of the scene the picture shows, in scene units: it is tall enough for five stages, so
// cut it just below the lines under the results.
export function guideHeight(scene) {
  const f = scene.funnels[0], tanks = scene.hits.filter(h => h.type === 'stage'), last = tanks[tanks.length - 1];
  return last.y + last.h + 49 + Math.ceil(Math.max(f.goal.total, f.cubes) / 10) * 22 + 50;
}

// One frame: the title strip with the funnel's name, then the funnel, drawn at (left, 0).
export function drawGuide(scene, g, left = 0) {
  const K = scene.S, fw = CW * K, h = Math.min(scene.canvas.height, Math.ceil(guideHeight(scene) * K));
  g.fillStyle = '#1B1714'; g.fillRect(left, 0, fw, TH * K + h);
  g.drawImage(scene.canvas, 0, 0, fw, h, left, TH * K, fw, h);
  scene.strip ??= scene.titleStrip(0, TH);
  g.drawImage(scene.strip, left, 0, fw, TH * K);
  g.font = `600 ${19 * scene.dpr}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const f = scene.funnels[0], d = scene.dpr, my = TH * K / 2;
  g.fillStyle = '#F4EDE1'; g.fillText(f.title, left + fw / 2, my);
  // The person's tasks by the title, as on the dashboard: a clipboard and how many. Here on its left,
  // so the label's arrow reaches it without crossing the title.
  let tasks = null;
  if (f.tasks?.length) {
    const tw = g.measureText(f.title).width, bw = 40 * d, bh = 22 * d, x = left + fw / 2 - tw / 2 - 10 * d - bw, y = my - bh / 2;
    g.fillStyle = 'rgba(27, 23, 20, 0.85)'; g.fillRect(x, y, bw, bh);
    g.strokeStyle = '#4A3F35'; g.lineWidth = 2 * d; g.strokeRect(x + d, y + d, bw - 2 * d, bh - 2 * d);
    g.save(); g.translate(x + 6 * d, y + 3.5 * d); g.scale(15 * d / 24, 15 * d / 24);
    g.strokeStyle = '#F4EDE1'; g.lineWidth = 2.2; g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeRect(5, 4, 14, 17);
    g.beginPath(); g.moveTo(9, 4); g.lineTo(9, 2.5); g.lineTo(15, 2.5); g.lineTo(15, 4);
    g.moveTo(8.5, 10); g.lineTo(15.5, 10); g.moveTo(8.5, 14); g.lineTo(15.5, 14); g.moveTo(8.5, 18); g.lineTo(12.5, 18); g.stroke();
    g.restore();
    g.font = `600 ${13 * d}px ${FONT}`; g.textAlign = 'left'; g.fillStyle = '#F4EDE1';
    g.fillText(String(f.tasks.length), x + 25 * d, my + 0.5 * d);
    tasks = { x: x - left, y, w: bw, h: bh };
  }
  // On its right, as on the dashboard: the red badge counts the questions waiting for you, the amber
  // one the agents gone silent.
  let badges = null;
  g.font = `600 ${19 * d}px ${FONT}`;
  let bx = left + fw / 2 + g.measureText(f.title).width / 2 + 8 * d;
  const pill = (n, bg, fg) => {
    if (!n) return;
    g.font = `500 ${13 * d}px ${FONT}`;
    const w = Math.max(20 * d, g.measureText(String(n)).width + 12 * d), ph = 20 * d, y = my - ph / 2;
    g.fillStyle = bg; g.beginPath(); g.roundRect(bx, y, w, ph, ph / 2); g.fill();
    g.fillStyle = fg; g.textAlign = 'center'; g.fillText(String(n), bx + w / 2, my + 0.5 * d);
    badges ??= { x: bx - left, y, h: ph }; badges.w = bx + w - left - badges.x;
    bx += w + 6 * d;
  };
  pill(scene.waitingFor(f), '#FF6B5E', '#FFFFFF');
  pill(scene.silentIn(f), '#F2A33C', '#1B1714');
  return { w: fw, h: TH * K + h, tasks, badges };
}
