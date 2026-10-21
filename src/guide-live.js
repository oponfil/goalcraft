// The landing page's funnel, live: the picture is swapped for the same funnel drawn by the board's
// own code, so the agents work, the timer counts down and pieces drop in, in the page's language.
// It only runs while on screen; with reduced motion the still picture stays.
import { guideScene, guideHeight, drawGuide, TH } from './guide.js?v=6cbe2523';
import { CW } from './scene.js?v=6cbe2523';

const img = document.querySelector('.guide img');
if (img && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const scene = guideScene();
  scene.resize(2, 2);
  // Five seconds first, as in the picture: the tanks have filled and everyone is in place.
  for (let i = 0; i < 5 * 30; i++) { scene.update(1 / 30); scene.render(); }
  scene.render();
  const live = document.createElement('canvas');
  live.width = CW * scene.S;
  live.height = TH * scene.S + Math.min(scene.canvas.height, Math.ceil(guideHeight(scene) * scene.S));
  live.className = 'live';
  live.setAttribute('role', 'img');
  live.ariaLabel = img.alt;
  const g = live.getContext('2d');
  let last = performance.now(), seen = true, started = false;
  const frame = now => {
    scene.update(Math.min(0.1, (now - last) / 1000)); last = now;
    scene.render(); drawGuide(scene, g);
    if (!started) { img.replaceWith(live); started = true; }
    if (seen) requestAnimationFrame(frame);
  };
  new IntersectionObserver(([e]) => {
    const was = seen; seen = e.isIntersecting;
    if (seen && !was) { last = performance.now(); requestAnimationFrame(frame); }
  }).observe(img.parentElement);
  requestAnimationFrame(frame);
}
