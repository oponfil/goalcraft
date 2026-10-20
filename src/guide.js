// The funnel the landing page and the README explain: the demo's Job Search cut to two stages,
// with an agent in each state the labels point at. They stay in their states, so the labels always
// point at them. The landing page runs it live; tools/render-docs.js records it.
import { FUNNELS } from './data.js?v=b4c2648b';
import { Scene, CW } from './scene.js?v=b4c2648b';

export const TH = 22;  // the title strip over the funnel, in scene units
const FONT = 'Rubik, system-ui, sans-serif';

export function guideScene() {
  const job = FUNNELS[0];
  const f0 = {
    ...job,
    stages: [job.stages[0], job.stages[3]],
    flows: [job.flows[0], job.flows[3], job.flows[5]],
    workers: [
      { agent: 'chatgpt', zone: -1, state: 'work', keep: true }, { agent: 'perplexity', zone: -1, state: 'work', keep: true },
      { agent: 'claude', zone: 0, state: 'ask', question: job.workers.find(w => w.state === 'ask').question }, { agent: 'gemini', zone: 0, state: 'work', keep: true },
      { agent: 'grok', zone: 1, state: 'sleep', wakeIn: 12, keep: true }, { agent: 'mistral', zone: 1, state: 'work', keep: true },
    ],
  };
  // The agents the arrows point at stand on the left, by the labels, so no arrow crosses anything
  // on its way; the agent sharing a zone with them goes right.
  const sides = new Map([['chatgpt', 'L'], ['perplexity', 'R'], ['claude', 'L'], ['gemini', 'R'], ['grok', 'L'], ['mistral', 'R']]
    .map(([id, side]) => [`${f0.title}|${id}`, side]));
  const scene = new Scene(document.createElement('canvas'), [f0], { sides });
  // The supervisor's walk is timed so it stands at the platform's left end, where the arrow points,
  // from 5 to 7.5 seconds in: when the README pictures are taken.
  scene.agents.find(a => a.sup).phase = 0.78;
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
  g.fillStyle = '#F4EDE1'; g.fillText(scene.funnels[0].title, left + fw / 2, TH * K / 2);
  return { w: fw, h: TH * K + h };
}
