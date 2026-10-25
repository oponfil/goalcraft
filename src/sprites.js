// Agent miners, drawn from simple shapes on the scene's fine grid (half-unit pixels).
// A miner fits a 20×28 box (units), faces right, and is mirrored or rotated for other poses.
import { LOGO_SVG } from './logos.js?v=2eda80d1';

// 13x13 brand marks printed on the shirt in half-unit pixels, simplified so they stay
// recognisable at this size.
export const LOGOS = {
  // Claude: the spark, a starburst of rays.
  claude: [
    '......I......',
    '...I..I..I...',
    '....I.I.I....',
    '.I...III...I.',
    '..II.III.II..',
    '....IIIII....',
    'IIIIIIIIIIIII',
    '....IIIII....',
    '..II.III.II..',
    '.I...III...I.',
    '....I.I.I....',
    '...I..I..I...',
    '......I......',
  ],
  // OpenAI: the blossom, six lobes around a hexagonal centre.
  chatgpt: [
    '....II.II....',
    '...I..I..I...',
    '.II...I...II.',
    'I.....I.....I',
    'I.I..III..I.I',
    '.I.II...II.I.',
    '.I..I...I..I.',
    '.I.II...II.I.',
    'I.I..III..I.I',
    'I.....I.....I',
    '.II...I...II.',
    '...I..I..I...',
    '....II.II....',
  ],
  // Gemini: a four-pointed sparkle.
  gemini: [
    '......I......',
    '......I......',
    '.....III.....',
    '.....III.....',
    '....IIIII....',
    '..IIIIIIIII..',
    'IIIIIIIIIIIII',
    '..IIIIIIIII..',
    '....IIIII....',
    '.....III.....',
    '.....III.....',
    '......I......',
    '......I......',
  ],
  // DeepSeek: a whale with its tail up.
  deepseek: [
    '.............',
    '..........I.I',
    '...........I.',
    '...IIIII...I.',
    '..IIIIIIIIII.',
    '.IIIIIIIIII..',
    'IIIIIIIIIII..',
    'II.IIIIIIII..',
    'IIIIIIIIII...',
    '.IIIIIIII....',
    '..IIIIII.....',
    '.............',
    '.............',
  ],
  // Kimi (Moonshot): a crescent moon.
  kimi: [
    '....IIII.....',
    '..IIII.......',
    '.III.........',
    '.II..........',
    'III..........',
    'II...........',
    'II...........',
    'II...........',
    'III..........',
    '.II.........I',
    '.IIII.....II.',
    '..IIIIIIIII..',
    '....IIIII....',
  ],
  // Qwen: a hexagonal knot.
  qwen: [
    '....IIIII....',
    '...I.....I...',
    '..I..III..I..',
    '.I..I...I..I.',
    'I..I.....I..I',
    'I..I.....I..I',
    'I..I..I..I..I',
    'I..I.....I..I',
    'I..I.....I..I',
    '.I..I...I..I.',
    '..I..III..I..',
    '...I.....I...',
    '....IIIII....',
  ],
  // Mistral: the blocky pixel M.
  mistral: [
    '.............',
    'II.........II',
    'II.........II',
    'III.......III',
    'IIII.....IIII',
    'II.II...II.II',
    'II..II.II..II',
    'II...III...II',
    'II....I....II',
    'II.........II',
    'II.........II',
    'II.........II',
    '.............',
  ],
  // Perplexity: an open book with a centre line.
  perplexity: [
    '......I......',
    'I....III....I',
    'II..I.I.I..II',
    'I.II..I..II.I',
    'I...I.I.I...I',
    'IIIIIIIIIIIII',
    'I...I.I.I...I',
    'I..I..I..I..I',
    'I.I...I...I.I',
    'II....I....II',
    'I.....I.....I',
    '......I......',
    '......I......',
  ],
  // Hermes (Nous Research): a winged H.
  hermes: [
    '.............',
    'I...........I',
    'II..I...I..II',
    '.II.I...I.II.',
    '..IIII.IIII..',
    '....I...I....',
    '....IIIII....',
    '....I...I....',
    '....I...I....',
    '....I...I....',
    '...II...II...',
    '.............',
    '.............',
  ],
  // Grok: a ring cut by a diagonal slash.
  grok: [
    '............I',
    '....IIII...I.',
    '..II....I.I..',
    '.I.......I...',
    '.I......I.I..',
    'I......I...I.',
    'I.....I....I.',
    'I....I.....I.',
    '.I..I.....I..',
    '.I.I......I..',
    '..I....III...',
    '.I.IIII......',
    'I............',
  ],
};

// Kept for layout math in the scene: P is the old sprite pixel, the box is 10P × 14P.
export const P = 2;
export const MINER_W = 20, MINER_H = 28;

const SKIN = '#F3C7A0', SKIN_SHADE = '#D9A57E', HELMET = '#F2C14E', HELMET_SHADE = '#C9952B';
const DIAMOND = '#4ED8E0', DIAMOND_LIGHT = '#B8F8FC', DIAMOND_DARK = '#2A9AA8';
const PANTS = '#3B4252', BOOTS = '#1E1E22', BELT = '#5A3D22';

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const ch = s => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * k)));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

function rect(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }

function isDark(hex) {
  const n = parseInt(hex.slice(1), 16);
  return 0.3 * (n >> 16) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255) < 50;
}

function ellipse(c, cx, cy, rx, ry, col, topOnly = false) {
  c.fillStyle = col;
  for (let y = -ry; y <= (topOnly ? 0 : ry); y += 0.5) {
    for (let x = -rx; x <= rx; x += 0.5) {
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) c.fillRect(cx + x, cy + y, 0.5, 0.5);
    }
  }
}

// The agent body at (0, 0), facing right. walk: -1 standing, else the walk frame.
// reach: the front hand is raised to (16, 14) to hold a tool.
// outfit: helmet (miner), goggles (chemist in a lab coat), straw (gardener: straw hat, apron), wings (cupid),
// hoodie (hacker), suit (banker), smith (headband, leather apron), chef (white jacket, toque),
// blocky (a square head with square hair).
function body(c, agent, color, walk, reach, outfit = 'helmet') {
  const shirt = color, shirtDark = shade(color, 0.72), shirtLight = shade(color, 1.25);
  const step = walk < 0 ? 0 : (walk % 2 ? 1 : -1);
  // Every outfit is in the agent's color, the coat, the suit and the armour too: the logo sits on
  // one color, not on a square of shirt between panels of another.
  const COAT = shirt, COAT_SHADE = shirtDark, SUIT = shirt, SUIT_SHADE = shirtDark;
  const ARMOUR = shirt, ARMOUR_LIGHT = shirtLight, ARMOUR_DARK = shirtDark;
  const coat = outfit === 'goggles' || outfit === 'chef';
  const sleeve = shirt, sleeveBack = shirtDark;
  if (outfit === 'hoodie') ellipse(c, 10, 8.5, 6, 5.5, shirtDark);
  if (outfit === 'wings') {
    ellipse(c, 2.5, 15, 3, 4.5, '#FFFFFF'); ellipse(c, 2, 16.5, 2, 3, '#DCE6F0');
    rect(c, 0, 13, 1.5, 1, '#FFFFFF');
  }
  // boots and legs
  rect(c, 4 + step, 26, 5.5, 2, BOOTS); rect(c, 10.5 - step, 26, 5.5, 2, BOOTS);
  rect(c, 5 + step, 22, 4.5, 4, PANTS); rect(c, 10.5 - step, 22, 4.5, 4, PANTS);
  rect(c, 9 + step, 22, 0.5, 4, shade(PANTS, 0.7));
  // back arm
  rect(c, 2.5, 14, 2.5, 6, sleeveBack); rect(c, 2.5, 20, 2.5, 2, SKIN_SHADE);
  // torso with light top edge and shaded right side; very dark shirts get a grey rim
  if (isDark(color)) rect(c, 4, 13, 12, 9, '#8A8A90');
  rect(c, 4.5, 13.5, 11, 8, shirt);
  rect(c, 4.5, 13.5, 11, 0.5, shirtLight);
  rect(c, 14, 14, 1.5, 7.5, shirtDark);
  // lab coat panels over the shirt, keeping the logo area free
  if (coat) {
    rect(c, 4.5, 13.5, 2.5, 9, COAT); rect(c, 13, 13.5, 2.5, 9, COAT_SHADE);
    rect(c, 4.5, 21, 11, 2, COAT);
    if (outfit === 'chef') { rect(c, 6, 15, 0.5, 0.5, '#8A8A90'); rect(c, 6, 17, 0.5, 0.5, '#8A8A90'); rect(c, 6, 19, 0.5, 0.5, '#8A8A90'); }
  } else {
    rect(c, 4.5, 21, 11, 1.5, BELT); rect(c, 9.5, 21, 1.5, 1.5, '#D9B44A');
  }
  // gardener's apron: a green bib with a pocket, below the logo
  if (outfit === 'straw') { rect(c, 5.5, 20, 9, 4.5, '#4E7A3A'); rect(c, 5.5, 20, 9, 0.5, '#6BA34A'); rect(c, 8.5, 21.5, 3, 1.5, '#3E6A2E'); }
  if (outfit === 'suit') {
    rect(c, 4.5, 13.5, 2.5, 9, SUIT); rect(c, 13, 13.5, 2.5, 9, SUIT_SHADE);
    rect(c, 7, 13.5, 1, 2, '#FFFFFF'); rect(c, 12, 13.5, 1, 2, '#FFFFFF');
    rect(c, 9.5, 13.5, 1, 1.5, '#B23A2E');
  }
  // armour: shoulders, sides and a belt line, in the agent's color, the logo in the middle
  if (outfit === 'blocky') {
    rect(c, 4, 13, 3.5, 9, ARMOUR); rect(c, 12.5, 13, 3.5, 9, ARMOUR_DARK);
    rect(c, 4, 13, 12, 1, ARMOUR_LIGHT); rect(c, 4, 21, 12, 1.5, ARMOUR_DARK);
    rect(c, 5, 22.5, 4.5, 2, ARMOUR); rect(c, 10.5, 22.5, 4.5, 2, ARMOUR);
  }
  // smith's leather apron, below the logo
  if (outfit === 'smith') { rect(c, 5.5, 20, 9, 5, '#5A3A22'); rect(c, 5.5, 20, 9, 0.5, '#7A5232'); rect(c, 7, 13.5, 0.5, 6.5, '#5A3A22'); rect(c, 12.5, 13.5, 0.5, 6.5, '#5A3A22'); }
  if (outfit === 'hoodie') { rect(c, 7.5, 13.5, 0.5, 3, '#DDDDDD'); rect(c, 12, 13.5, 0.5, 3, '#DDDDDD'); }
  // front arm
  if (reach) { rect(c, 13, 14, 3.5, 3, sleeve); ellipse(c, 16.5, 15, 1.5, 1.5, SKIN); }
  else { rect(c, 15, 14, 2.5, 6, sleeve); rect(c, 15, 20, 2.5, 2, SKIN); }
  // neck and head
  rect(c, 8.5, 12, 3, 1.5, SKIN_SHADE);
  ellipse(c, 10, 8.5, 4.5, 4, SKIN);
  rect(c, 6, 8, 1.5, 2, SKIN_SHADE);
  rect(c, 10.5, 7.5, 1, 1.5, '#2B1D14'); rect(c, 13, 7.5, 1, 1.5, '#2B1D14');
  rect(c, 14.5, 9, 1, 1, SKIN_SHADE);
  rect(c, 11.5, 10.5, 2, 0.5, '#B0705A');
  if (outfit === 'helmet') {
    // helmet: dome, highlight, brim, lamp
    ellipse(c, 10, 5.5, 5.5, 4.5, HELMET, true);
    rect(c, 7.5, 2, 3, 1, '#FFE08A');
    rect(c, 4, 5, 13, 1.5, HELMET_SHADE);
    rect(c, 14.5, 2.5, 2.5, 2.5, '#A88A3A'); rect(c, 15, 3, 1.5, 1.5, '#FFF6C9');
  } else if (outfit === 'goggles') {
    ellipse(c, 10, 6.5, 4.8, 3.5, '#4A3326', true);
    rect(c, 5.5, 7, 10, 1, '#2B2B2B');
    rect(c, 10, 6.5, 2.5, 2, '#2B2B2B'); rect(c, 10.5, 7, 1.5, 1, '#9FE3FF');
    rect(c, 12.8, 6.5, 2.5, 2, '#2B2B2B'); rect(c, 13.3, 7, 1.5, 1, '#9FE3FF');
  } else if (outfit === 'straw') {
    // straw hat: low crown with a green band and a wide brim
    ellipse(c, 10, 4.5, 3.8, 2.5, '#E8C872', true);
    rect(c, 6.5, 4.5, 7, 1, '#6BA34A');
    rect(c, 3, 5.5, 14, 1.5, '#D9B45A'); rect(c, 3, 5.5, 14, 0.5, '#F2DC90');
  } else if (outfit === 'hoodie') {
    // hood pulled up around the face
    ellipse(c, 10, 6, 5.5, 4, shirtDark, true);
    rect(c, 4.5, 6, 1.5, 6, shirtDark); rect(c, 14.5, 6, 1, 5, shirtDark);
  } else if (outfit === 'suit') {
    ellipse(c, 10, 6.5, 4.8, 3.5, '#3A2A1E', true);
    rect(c, 6, 5, 5, 1, '#3A2A1E');
  } else if (outfit === 'smith') {
    // short dark hair and a red headband
    ellipse(c, 10, 6.5, 4.8, 3.5, '#2B1D14', true);
    rect(c, 5.5, 6, 9.5, 1, '#B8342A'); rect(c, 4.5, 6.5, 1.5, 2, '#B8342A');
  } else if (outfit === 'chef') {
    // a tall white toque: a puffed top over a band
    ellipse(c, 10, 2, 4, 2.5, '#FFFFFF'); rect(c, 7, 2, 6, 3, '#FFFFFF');
    rect(c, 6.5, 4.5, 7, 1.5, '#E6E6E0'); rect(c, 8, 0.5, 1.5, 1, '#F4F4F0');
  } else if (outfit === 'blocky') {
    // a square head over the round one in a knight's diamond helmet: a tall dome with a ridge, a
    // brow rim, a back plate down to the neck, a cheek guard and a nose guard; square eyes
    rect(c, 5.5, 4.5, 9.5, 8, SKIN); rect(c, 5.5, 11.5, 9.5, 1, SKIN_SHADE);
    rect(c, 4.5, 1.5, 11.5, 4.5, DIAMOND); rect(c, 4.5, 1.5, 11.5, 0.5, DIAMOND_LIGHT);
    rect(c, 9.5, 0.5, 2, 1, DIAMOND_DARK); rect(c, 9.5, 0.5, 2, 0.5, DIAMOND);
    rect(c, 4.5, 6, 2.5, 6.5, DIAMOND); rect(c, 4.5, 6, 0.5, 6.5, DIAMOND_DARK); rect(c, 4.5, 12, 2.5, 0.5, DIAMOND_DARK);
    rect(c, 14.5, 6, 1.5, 5, DIAMOND); rect(c, 15.5, 6, 0.5, 5, DIAMOND_DARK);
    rect(c, 4.5, 5.5, 11.5, 1, DIAMOND_DARK);
    rect(c, 12, 6.5, 1, 3, DIAMOND); rect(c, 12, 9, 1, 0.5, DIAMOND_DARK);
    rect(c, 6.5, 2.5, 1, 1, DIAMOND_LIGHT); rect(c, 5.5, 8, 0.5, 0.5, DIAMOND_LIGHT); rect(c, 5.5, 10, 0.5, 0.5, DIAMOND_LIGHT);
    rect(c, 10.5, 7.5, 1.5, 1.5, '#FFFFFF'); rect(c, 11, 7.5, 1, 1.5, '#3A5AA8');
    rect(c, 13, 7.5, 1.5, 1.5, '#FFFFFF'); rect(c, 13.5, 7.5, 1, 1.5, '#3A5AA8');
    rect(c, 11, 10.5, 3, 0.5, '#9A5A48');
  } else if (outfit === 'wings') {
    ellipse(c, 10, 6, 5, 3.5, '#F2D06B', true);
    rect(c, 5, 5.5, 1.5, 1.5, '#F2D06B'); rect(c, 14, 5.5, 1.5, 1.5, '#F2D06B');
    rect(c, 8, 3, 1.5, 1.5, '#FFE89A');
  }
}

// The supervisor of a funnel: the same figure as the workers, dressed as the one in charge of them,
// a look per theme (keyed by the theme's worker outfit). Drawn bare-headed by body() (an outfit it
// doesn't know), then dressed on top, the clothes in the agent's color (col, its dark and light
// shades); the middle of the shirt stays free for the brand logo.
const BOSS = {
  // Mine: the foreman — a white hard hat with a red stripe, a hi-vis vest, a moustache.
  helmet(c, col, dark, light) {
    ellipse(c, 10, 5.5, 5.5, 4.5, '#F4F4F0', true); rect(c, 4, 5, 13, 1.5, '#C8C8C0'); rect(c, 8.8, 1.2, 2.4, 4, '#D23A2E');
    rect(c, 4.5, 13.5, 2.5, 8, col); rect(c, 13, 13.5, 2.5, 8, dark);
    rect(c, 4.5, 17, 2.5, 1, '#E8F0F0'); rect(c, 13, 17, 2.5, 1, '#E8F0F0');
    rect(c, 10.5, 9.8, 4, 1, '#5A3A20'); rect(c, 14, 10.3, 1, 0.8, '#5A3A20');
  },
  // Lab: the head of the lab — grey hair, round glasses, a long coat, a red tie.
  goggles(c, col, dark, light) {
    ellipse(c, 10, 6.5, 4.8, 3.2, '#C8C8C8', true); rect(c, 5.5, 6.5, 1.5, 3, '#C8C8C8');
    rect(c, 10, 7, 2.2, 2, '#2B2B2B'); rect(c, 10.4, 7.4, 1.4, 1.2, '#CFEFFF');
    rect(c, 12.8, 7, 2.2, 2, '#2B2B2B'); rect(c, 13.2, 7.4, 1.4, 1.2, '#CFEFFF'); rect(c, 12.2, 7.6, 0.6, 0.5, '#2B2B2B');
    rect(c, 4, 13.5, 3, 12, col); rect(c, 13, 13.5, 3, 12, dark); rect(c, 4, 21.5, 12, 4, col);
    rect(c, 9.4, 12, 1.2, 2, '#B8342A');
  },
  // Garden: the head gardener — a wide hat with a flower, a beard, a green waistcoat.
  straw(c, col, dark, light) {
    ellipse(c, 10, 4.2, 4.4, 2.8, '#E8C872', true); rect(c, 6, 4.2, 8, 1, '#B8342A');
    rect(c, 1.5, 5.2, 17, 1.6, '#D9B45A'); rect(c, 1.5, 5.2, 17, 0.5, '#F2DC90');
    ellipse(c, 13.5, 3.2, 1.2, 1.2, '#F28AB8'); rect(c, 13.2, 2.9, 0.6, 0.6, '#FFE38A');
    ellipse(c, 11.5, 11.2, 3, 1.8, '#8A5A32'); rect(c, 10, 10.4, 4, 0.5, '#B0705A');
    rect(c, 4.5, 13.5, 2.5, 8, col); rect(c, 13, 13.5, 2.5, 8, dark);
    rect(c, 5, 15, 1, 1, '#D9B44A'); rect(c, 5, 18, 1, 1, '#D9B44A');
  },
  // Love: the head cupid — a halo like a saint's, big wings (drawn first), a pink sash.
  wings(c, col, dark, light) {
    ellipse(c, 10, 6.2, 5, 3.4, '#F2D06B', true);
    rect(c, 6.5, 0, 7, 0.8, '#FFE38A'); rect(c, 6.5, 1.8, 7, 0.8, '#FFE38A'); rect(c, 5.8, 0.6, 0.8, 1.4, '#FFE38A'); rect(c, 13.4, 0.6, 0.8, 1.4, '#FFE38A');
    for (let i = 0; i < 4; i++) rect(c, 12.5 + i * 0.8, 13.5 + i * 2, 1.6, 2, light);
  },
  // Code: the tech lead — no hood, dark hair, glasses, a headset with a mic, a dark jacket.
  hoodie(c, col, dark, light) {
    ellipse(c, 10, 6.5, 4.8, 3.4, '#2B1D14', true);
    rect(c, 5, 4, 10, 1, '#1E1E22'); rect(c, 4.5, 4, 1, 5, '#1E1E22'); rect(c, 4, 7.5, 2, 3, '#3A3E46');
    rect(c, 6, 10.2, 5, 0.6, '#3A3E46'); rect(c, 10.5, 9.8, 1.2, 1.2, '#3CF27A');
    rect(c, 10, 7, 2.2, 1.8, '#1E1E22'); rect(c, 10.4, 7.3, 1.4, 1, '#9FE3FF'); rect(c, 12.8, 7, 2.2, 1.8, '#1E1E22'); rect(c, 13.2, 7.3, 1.4, 1, '#9FE3FF');
    rect(c, 4.5, 13.5, 2.5, 8, col); rect(c, 13, 13.5, 2.5, 8, dark);
  },
  // Money: the bank manager — a top hat, a monocle, a tailcoat, a gold watch chain.
  suit(c, col, dark, light) {
    ellipse(c, 10, 6.5, 4.8, 3.2, '#3A2A1E', true);
    rect(c, 6.5, -1.5, 7, 6, '#1E1E22'); rect(c, 6.5, 2.8, 7, 1, '#B8342A'); rect(c, 4.5, 4.5, 11, 1.2, '#1E1E22');
    rect(c, 12.6, 6.8, 2.4, 2.4, '#D9B44A'); rect(c, 13, 7.2, 1.6, 1.6, '#CFEFFF'); rect(c, 13.6, 9.2, 0.5, 3, '#D9B44A');
    rect(c, 4.5, 13.5, 2.5, 9, col); rect(c, 13, 13.5, 2.5, 11, dark); rect(c, 3.5, 21, 2, 4, col);
    rect(c, 7, 13.5, 1, 2, '#FFFFFF'); rect(c, 12, 13.5, 1, 2, '#FFFFFF');
    for (let i = 0; i < 5; i++) rect(c, 13.5 - i * 0.8, 21.6 + (i % 2) * 0.4, 0.8, 0.5, '#E8C040');
  },
  // Forge: the master smith — a gold crown, a black apron with a gold medal.
  smith(c, col, dark, light) {
    ellipse(c, 10, 6.5, 4.8, 3.4, '#2B1D14', true);
    rect(c, 6, 2, 8, 3, '#E8B020'); rect(c, 6, 0.5, 1.5, 1.5, '#E8B020'); rect(c, 9.25, 0, 1.5, 2, '#E8B020'); rect(c, 12.5, 0.5, 1.5, 1.5, '#E8B020');
    rect(c, 6, 4.5, 8, 0.8, '#B8861A'); rect(c, 9.5, 2.8, 1, 1, '#D23A2E');
    rect(c, 5.5, 21, 9, 4.5, '#2A2420'); rect(c, 5.5, 21, 9, 0.5, '#4A403A');
    rect(c, 7, 13.5, 0.5, 6, '#2A2420'); rect(c, 12.5, 13.5, 0.5, 6, '#2A2420');
    ellipse(c, 10, 23.2, 1.2, 1.2, '#F2C14E'); rect(c, 9.6, 22.8, 0.8, 0.8, '#FFE38A');
  },
  // Bakery: the head chef — a very tall toque, a curled moustache, a double-breasted jacket, a red scarf.
  chef(c, col, dark, light) {
    rect(c, 6.5, -3.5, 7, 8.5, '#FFFFFF'); ellipse(c, 10, -3.5, 4.2, 2.6, '#FFFFFF'); rect(c, 6, 4, 8, 1.6, '#E6E6E0');
    rect(c, 10, 9.8, 4.5, 0.9, '#5A3A20'); rect(c, 9.5, 9.2, 0.8, 0.8, '#5A3A20'); rect(c, 14.3, 9.2, 0.8, 0.8, '#5A3A20');
    rect(c, 8, 12.2, 4.5, 1.6, '#B8342A');
    rect(c, 4.5, 13.5, 2.5, 9, col); rect(c, 13, 13.5, 2.5, 9, dark);
    for (let i = 0; i < 3; i++) { rect(c, 5.2, 15 + i * 2.2, 0.8, 0.8, '#D9B44A'); rect(c, 13.8, 15 + i * 2.2, 0.8, 0.8, '#D9B44A'); }
  },
  // Blocks: the commander — gold armour and a gold helmet with a red plume.
  blocky(c, col, dark, light) {
    rect(c, 5.5, 4.5, 9.5, 8, SKIN);
    rect(c, 5, 2.5, 10.5, 3.5, '#F2C14E'); rect(c, 5, 2.5, 10.5, 0.5, '#FFE38A'); rect(c, 5, 6, 2, 5, '#F2C14E'); rect(c, 5, 6, 10.5, 0.5, '#C9952B');
    rect(c, 9, -1.5, 2.5, 4, '#D23A2E'); rect(c, 8, -1.5, 1, 1.5, '#D23A2E');
    rect(c, 10.5, 7.5, 1.5, 1.5, '#FFFFFF'); rect(c, 11, 7.5, 1, 1.5, '#3A5AA8'); rect(c, 13, 7.5, 1.5, 1.5, '#FFFFFF'); rect(c, 13.5, 7.5, 1, 1.5, '#3A5AA8');
    rect(c, 4, 13, 3.5, 9, col); rect(c, 12.5, 13, 3.5, 9, dark); rect(c, 4, 13, 12, 1, light); rect(c, 4, 21, 12, 1.5, dark);
    rect(c, 5, 22.5, 4.5, 2, col); rect(c, 10.5, 22.5, 4.5, 2, col);
  },
};
function bossBody(c, agent, color, outfit, walk = -1) {
  if (outfit === 'wings') { ellipse(c, 1, 14.5, 4, 6, '#FFFFFF'); ellipse(c, 1, 16.5, 2.8, 4, '#DCE6F0'); }
  body(c, agent, color, walk, false, 'boss');
  (BOSS[outfit] || BOSS.helmet)(c, color, shade(color, 0.72), shade(color, 1.25));
}
// walkFrame: -1 standing, else the walk frame; flip: facing left.
export function drawBoss(ctx, x, y, agent, color, outfit = 'helmet', walkFrame = -1, flip = false) {
  ctx.save();
  if (flip) { ctx.translate(x + MINER_W, y); ctx.scale(-1, 1); } else ctx.translate(x, y);
  bossBody(ctx, agent, color, outfit, walkFrame); ctx.restore();
  drawLogo(ctx, x + 10, y + 17.5, agent);
}
export function drawBossLying(ctx, x, y, agent, color, outfit = 'helmet') {
  ctx.save(); ctx.translate(x, y + 20); ctx.rotate(-Math.PI / 2); bossBody(ctx, agent, color, outfit); ctx.restore();
  drawLogo(ctx, x + 17.5, y + 10, agent);
}
// A spyglass held at the eye (x, y), pointing at angle (radians, 0 = straight ahead, down is
// positive).
export function drawSpyglass(ctx, x, y, angle) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  rect(ctx, 0, -1.5, 13, 3, '#6E5A3A'); rect(ctx, 9, -2, 5, 4, '#B8A27A'); rect(ctx, 13.5, -1.5, 1, 3, '#CDE8FF');
  ctx.restore();
}

// The services' real logos as images, made once each, the first time an agent wears one.
const logoImages = {};
const logoImage = id => {
  if (!LOGO_SVG[id]) return null;
  if (!logoImages[id]) {
    logoImages[id] = new Image();
    logoImages[id].src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(LOGO_SVG[id]);
  }
  return logoImages[id];
};
// Where the scene collects the logos of this frame, to draw them crisp over the pixel picture
// (drawLogos); without one (the deck), a logo is drawn in pixels on the shirt.
let logoSink = null;
export function collectLogos(list) { logoSink = list; }
// The logos collected, white on the shirt. g draws in screen pixels, S of them to a unit.
export function drawLogos(g, list, S) {
  g.save(); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  for (const { x, y, id } of list) {
    const img = logoImage(id);
    if (img?.complete && img.naturalWidth) g.drawImage(img, (x - 3.25) * S, (y - 3.25) * S, 6.5 * S, 6.5 * S);
  }
  g.restore();
}

// Logo centred at (cx, cy) in half-unit pixels; never mirrored.
function drawLogo(ctx, cx, cy, agent) {
  // "claude-search" wears the Claude logo.
  const id = LOGOS[agent] ? agent : String(agent).split(/[-_]/)[0];
  if (logoSink && LOGO_SVG[id]) {
    // the badge's centre in the scene's units, wherever the canvas is moved to now
    const m = ctx.getTransform(), r = m.a;
    logoSink.push({ x: (m.a * cx + m.c * cy + m.e) / r, y: (m.b * cx + m.d * cy + m.f) / r, id });
    return;
  }
  const rows = LOGOS[id];
  if (!rows) return;
  const x = Math.round((cx - rows[0].length / 4) * 2) / 2, y = Math.round((cy - rows.length / 4) * 2) / 2;
  ctx.fillStyle = '#FFFFFF';
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) if (row[c] === 'I') ctx.fillRect(x + c / 2, y + r / 2, 0.5, 0.5);
  });
}

// The top of each figure's head with its hat, in its 20×28 box: where an agent's reply note points.
export const HEAD_TOP = { helmet: 1, goggles: 3, straw: 2, hoodie: 2, suit: 3, smith: 3, chef: -0.5, blocky: 0.5, wings: 2.5 };
export const BOSS_TOP = { helmet: 1, goggles: 3.3, straw: 1.4, hoodie: 3, suit: -1.5, smith: 0, chef: -6, blocky: -1.5, wings: 0 };

export function drawStanding(ctx, x, y, agent, color, walkFrame = -1, flip = false, reach = false, outfit = 'helmet') {
  ctx.save();
  if (flip) { ctx.translate(x + MINER_W, y); ctx.scale(-1, 1); } else ctx.translate(x, y);
  body(ctx, agent, color, walkFrame, reach, outfit);
  ctx.restore();
  drawLogo(ctx, x + 10, y + 17.5, agent);
}

// Lying on the back in a 28×20 box: head to the left, or to the right when flipped.
export function drawLying(ctx, x, y, agent, color, flip = false, outfit = 'helmet') {
  ctx.save();
  if (flip) { ctx.translate(x + 28, y + 20); ctx.scale(-1, 1); } else ctx.translate(x, y + 20);
  ctx.rotate(-Math.PI / 2);
  body(ctx, agent, color, -1, false, outfit);
  ctx.restore();
  drawLogo(ctx, flip ? x + 10.5 : x + 17.5, y + 10, agent);
}

// Sitting on the ground, in the same 20×28 box as standing: paused (it won't run until it is
// resumed, or its plan's limit resets), not asleep. The body sits 5 lower, cut above its legs; the
// legs stretch out forward and apart, the boots' soles toward us. boss: the supervisor's figure.
function seated(ctx, x, y, agent, drawBody) {
  ctx.save(); ctx.translate(x, y + 5);
  ctx.beginPath(); ctx.rect(-8, -12, 36, 34); ctx.clip();
  drawBody(ctx);
  ctx.restore();
  // the legs forward and apart, foreshortened, and the soles
  rect(ctx, x + 1.5, y + 25, 7, 2.5, PANTS); rect(ctx, x + 11.5, y + 25, 7, 2.5, PANTS);
  rect(ctx, x + 8.5, y + 25.5, 3, 2, shade(PANTS, 0.7));
  rect(ctx, x - 1, y + 24, 3, 4, BOOTS); rect(ctx, x + 18, y + 24, 3, 4, BOOTS);
  rect(ctx, x - 0.5, y + 24.5, 2, 3, '#3A3A40'); rect(ctx, x + 18.5, y + 24.5, 2, 3, '#3A3A40');
  drawLogo(ctx, x + 10, y + 22.5, agent);
}
export function drawSitting(ctx, x, y, agent, color, outfit = 'helmet') {
  seated(ctx, x, y, agent, c => body(c, agent, color, -1, false, outfit));
}
export function drawBossSitting(ctx, x, y, agent, color, outfit = 'helmet') {
  seated(ctx, x, y, agent, c => bossBody(c, agent, color, outfit));
}
// A pause sign over a paused agent's head: just the two bars, with a dark edge to show on any backdrop.
export function drawPause(ctx, cx, y) {
  rect(ctx, cx - 3.5, y + 1.5, 3, 6, '#1A1614'); rect(ctx, cx + 0.5, y + 1.5, 3, 6, '#1A1614');
  rect(ctx, cx - 3, y + 2, 2, 5, '#F4EDE1'); rect(ctx, cx + 1, y + 2, 2, 5, '#F4EDE1');
}

export function line(ctx, x0, y0, x1, y1, col, size = 1) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
  ctx.fillStyle = col;
  for (let i = 0; i <= steps; i++) {
    const px = Math.round((x0 + (x1 - x0) * i / steps) * 2) / 2, py = Math.round((y0 + (y1 - y0) * i / steps) * 2) / 2;
    ctx.fillRect(px - size / 2 + 0.25, py - size / 2 + 0.25, size, size);
  }
}

// Pickaxe held at (hx, hy), angle in radians (0 = right, positive = down).
export function drawPickaxe(ctx, hx, hy, angle) {
  const len = 15;
  const ex = hx + Math.cos(angle) * len, ey = hy + Math.sin(angle) * len;
  line(ctx, hx, hy, ex, ey, '#8A5A2B', 1);
  const px = -Math.sin(angle), py = Math.cos(angle);
  line(ctx, ex - px * 5, ey - py * 5, ex + px * 4, ey + py * 4, '#9EA3AD', 1.5);
  line(ctx, ex - px * 5, ey - py * 5, ex - px * 3, ey - py * 3, '#E6E9EF', 1);
  line(ctx, ex + px * 3, ey + py * 3, ex + px * 4, ey + py * 4, '#E6E9EF', 1);
}

// Gardener's shears held at (hx, hy), facing right; open: 0 closed .. 1 wide open.
export function drawShears(ctx, hx, hy, open) {
  const px = hx + 4, a = 0.08 + open * 0.4;
  for (const sgn of [-1, 1]) {
    line(ctx, hx, hy + sgn * 1, px, hy, '#C8263B', 1);
    line(ctx, px, hy, px + Math.cos(a) * 8, hy + sgn * Math.sin(a) * 8, '#C9CED6', 1);
  }
  rect(ctx, px - 0.5, hy - 0.5, 1, 1, '#5E636D');
}

// Chemist's beaker, tilted by angle (0 = upright, positive = pouring forward).
export function drawBeaker(ctx, hx, hy, angle, liquid) {
  ctx.save();
  ctx.translate(hx, hy); ctx.rotate(angle);
  rect(ctx, -2, -7, 5, 8, '#CDEBFF'); rect(ctx, -1.5, -6.5, 4, 7, '#1B2B3A');
  rect(ctx, -1.5, -3, 4, 3.5, liquid); rect(ctx, -1.5, -3, 4, 0.5, '#FFFFFF');
  rect(ctx, 2.5, -7.5, 1.5, 1, '#CDEBFF');
  ctx.restore();
}

// Cupid's bow held at (hx, hy), facing right; drawn: 0..1 how far the string is pulled.
export function drawBow(ctx, hx, hy, drawn) {
  for (let a = -1.2; a <= 1.2; a += 0.1) {
    rect(ctx, Math.round((hx + 2 + Math.cos(a) * 3) * 2) / 2, Math.round((hy + Math.sin(a) * 7) * 2) / 2, 1, 1, '#B07A40');
  }
  const sx = hx + 2 - drawn * 3;
  line(ctx, hx + 3, hy - 7, sx, hy, '#F4EDE1', 0.5);
  line(ctx, sx, hy, hx + 3, hy + 7, '#F4EDE1', 0.5);
}

// Hacker's laptop held open at (hx, hy); typing: 0..1 key-press phase, lights the screen lines.
export function drawLaptop(ctx, hx, hy, typing) {
  rect(ctx, hx - 1, hy + 1, 9, 1.5, '#8E939D'); rect(ctx, hx - 1, hy + 1, 9, 0.5, '#C4C9D2');
  rect(ctx, hx + 5, hy - 6, 1.5, 7.5, '#5E636D');
  rect(ctx, hx + 6.5, hy - 6, 1, 7.5, '#0B1A12');
  for (let i = 0; i < 4; i++) rect(ctx, hx + 6.5, hy - 5 + i * 1.5, 1, 0.5, (i + Math.floor(typing * 4)) % 2 ? '#3CF27A' : '#1E6B3A');
}

// Banker's rubber stamp at (hx, hy); lift: 0 down on the paper .. 1 raised.
export function drawStamp(ctx, hx, hy, lift) {
  const y = hy - lift * 6;
  rect(ctx, hx + 2, y - 4, 2, 4, '#8A5A2B'); ellipse(ctx, hx + 3, y - 4.5, 1.5, 1.2, '#A87A48');
  rect(ctx, hx, y, 6, 2, '#4A4E56'); rect(ctx, hx, y + 2, 6, 1, '#C8263B');
}

// Smith's hammer held at (hx, hy), angle like the pickaxe's: a wooden handle, a square iron head.
export function drawHammer(ctx, hx, hy, angle) {
  const len = 11, ex = hx + Math.cos(angle) * len, ey = hy + Math.sin(angle) * len;
  line(ctx, hx, hy, ex, ey, '#8A5A2B', 1);
  const px = -Math.sin(angle), py = Math.cos(angle);
  line(ctx, ex - px * 2.5, ey - py * 2.5, ex + px * 2.5, ey + py * 2.5, '#4A4E56', 3);
  line(ctx, ex - px * 2.5, ey - py * 2.5, ex - px * 2, ey - py * 2, '#8E949E', 1);
}

// A block-world sword held at (hx, hy), pointing along angle: grip, a crossguard and a long blade.
export function drawSword(ctx, hx, hy, angle) {
  const dx = Math.cos(angle), dy = Math.sin(angle), px = -dy, py = dx;
  line(ctx, hx - dx * 2, hy - dy * 2, hx + dx, hy + dy, '#5A3A22', 1);
  line(ctx, hx + dx - px * 2.5, hy + dy - py * 2.5, hx + dx + px * 2.5, hy + dy + py * 2.5, '#6E4A2A', 1);
  line(ctx, hx + dx * 2, hy + dy * 2, hx + dx * 13, hy + dy * 13, '#5CE0E8', 1.5);
  line(ctx, hx + dx * 3, hy + dy * 3, hx + dx * 12, hy + dy * 12, '#C8FAFF', 0.5);
}

// Baker's rolling pin held at (hx, hy), rolled forward by `roll` (−1..1).
export function drawRollingPin(ctx, hx, hy, roll) {
  const x = hx - 3 + roll * 2.5;
  rect(ctx, x, hy, 3, 1, '#8A5A2E'); rect(ctx, x + 3, hy - 0.5, 9, 2.5, '#D8A868'); rect(ctx, x + 3, hy - 0.5, 9, 0.5, '#F2D09A');
  rect(ctx, x + 12, hy, 3, 1, '#8A5A2E');
}

export function drawArrow(ctx, x, y) {
  line(ctx, x - 7, y, x, y, '#B07A40', 0.5);
  rect(ctx, x, y - 1, 1.5, 2.5, '#9EA3AD');
  rect(ctx, x - 8, y - 1, 1.5, 0.5, '#F28AB8'); rect(ctx, x - 8, y + 1, 1.5, 0.5, '#F28AB8');
}

// One "!" per open question up to four, each widening the bubble by BUBBLE_STEP; from five on
// the bubble is as wide as for four and the scene writes the number before a single "!".
export const BUBBLE_STEP = 4;
// tailLeft: the bubble's tail points left, at an agent standing to its left (by default it points
// right, at an agent to its right).
export function drawBubble(ctx, x, y, n = 1, tailLeft = false) {
  const k = n > 4 ? 1 : Math.max(1, n), w = 14 + (Math.min(4, Math.max(1, n)) - 1) * BUBBLE_STEP;
  rect(ctx, x + 0.5, y, w - 1, 16, '#E24B4A');
  rect(ctx, x, y + 0.5, w, 15, '#E24B4A');
  rect(ctx, tailLeft ? x - 2 : x + w, y + 10, 2, 2, '#E24B4A');
  const x0 = n > 4 ? x + w - 8 : x + 6;
  for (let i = 0; i < k; i++) {
    rect(ctx, x0 + i * BUBBLE_STEP, y + 3, 2, 7, '#FFFFFF');
    rect(ctx, x0 + i * BUBBLE_STEP, y + 11.5, 2, 2, '#FFFFFF');
  }
}
