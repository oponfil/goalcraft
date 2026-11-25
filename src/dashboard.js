// The dashboard page around the scene: sticky funnel titles, drag to reorder, popups.
// Shared by the demo (src/main.js) and the person's own funnels (src/live.js).
import { agentInfo, providerOf, agentButton, chatLink, plural } from './data.js?v=36954f42';
import { Scene, CW, fmtCount, fmtDuration, fmtFlow, nextOf, openOf } from './scene.js?v=36954f42';
import { t, lang, tankView, flowUnit, setFlowUnit, FLOW_UNITS } from './i18n.js?v=36954f42';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
// Web chats open in a new tab; app links (claude://, codex://) hand over to the app without an
// empty tab and remember the web chat to fall back to.
const webOf = (url, info) => (/^https?:/.test(url || '') ? url : info.chat);
// What an "Open" button says: the app it opens ("Open in ChatGPT"), or the site, for a web chat
// ("Open on chatgpt.com"), so it is clear where it leads.
const openLabel = (link, info) => {
  if (/^https?:/.test(link)) { try { return t('board.openSite', new URL(link).hostname.replace(/^www\./, '')); } catch {} }
  return t('board.open', info.product || info.name);
};
// Where the agent works, on the Open button's hover: its app or site and which conversation there
// ("in the ChatGPT (Codex) app · conversation 01a1351e…"), or that it sent no link to one, so the button
// opens the app or a new chat. mine: the agent's own link (or the question's), if any. Live board
// only: the demo's agents have no chats of their own.
const shortId = s => s;  // whole: the hint wraps
const whereTip = (mine, info, inAntigravity) => {
  let m;
  if ((m = /^codex:\/\/threads\/([\w-]+)/.exec(mine || ''))) return t('board.chatApp', 'ChatGPT (Codex)', shortId(m[1]));
  if ((m = /^claude:\/\/claude\.ai\/epitaxy\/(?:local_)?([\w-]+)/.exec(mine || '') || /^claude:\/\/resume\?session=([\w-]+)/.exec(mine || ''))) return t('board.chatApp', 'Claude', shortId(m[1]));
  if ((m = /^grokbot:.*[?&]id=([\w-]+)/.exec(mine || ''))) return t('board.chatApp', 'Grok Bot', shortId(m[1]));
  if (/^https?:/.test(mine || '')) {
    try {
      const u = new URL(mine), id = u.pathname.split('/').filter(Boolean).pop();
      return t('board.chatSite', u.hostname.replace(/^www\./, ''), id ? shortId(id) : '');
    } catch {}
  }
  if (inAntigravity) return t('board.chatAppOnly', 'Google Antigravity');
  if (/^kimi/.test(mine || '') || (!mine && (info.product || info.name) === 'Kimi')) return t('board.chatAppOnly', 'Kimi');
  return t('board.chatNone');
};
// away: the computer the agent's chat is on, when it isn't this one (see elsewhere): the button is
// greyed out and says why on hover, as the chat can't be opened here.
// A web chat is a link with the site's name ("chatgpt.com"), not a button: it is a site, not an app.
const siteOf = link => { try { return /^https?:/.test(link) ? new URL(link).hostname.replace(/^www\./, '') : null; } catch { return null; } };
const openBtnHtml = (link, web, info, tipText, away) => siteOf(link)
  ? `<a class="site-link" href="${esc(link)}" ${opens(link, web)}${tipText ? ` data-tip="${esc(tipText)}"` : ''}>${esc(siteOf(link))}</a>`
  : away
  ? `<span class="btn off" aria-disabled="true" data-tip="${esc(t('board.chatElsewhere', info.product || info.name, away.name || OS_NAMES[away.os]))}">${esc(openLabel(link, info))}</span>`
  : `<a class="btn" href="${esc(link)}" ${opens(link, web)}${tipText ? ` data-tip="${esc(tipText)}"` : ''}>${esc(openLabel(link, info))}</a>`;
// The system this browser runs on, as the wake scripts name theirs; 'mobile' on a phone or tablet,
// where no computer's chat opens. null: can't tell (then nothing is greyed out).
const OS_NAMES = { mac: 'Mac', windows: 'Windows', linux: 'Linux' };
const MY_OS = (() => {
  const n = globalThis.navigator;
  if (!n) return null;
  const p = String(n.userAgentData?.platform || n.platform || '').toLowerCase(), ua = String(n.userAgent || '').toLowerCase();
  if (/iphone|ipad|android/.test(ua) || n.userAgentData?.mobile || (p.startsWith('mac') && n.maxTouchPoints > 1)) return 'mobile';
  if (p.startsWith('mac')) return 'mac';
  if (p.startsWith('win')) return 'windows';
  if (/linux|cros|chrome os/.test(p)) return 'linux';
  return null;
})();
// The agent's chat is on another computer: its computer when its system isn't this browser's (two
// computers with the same system can't be told apart, so their chats stay open to try).
// This computer: the one picked in this browser (kept in it, see the wake scripts in Spending), else
// the first one set up with this browser's system. A page can't read the computer's name, only its system.
const HERE_KEY = 'goalcraft-this-computer';
let pcsKnown = () => [];
const herePicked = () => { try { return localStorage.getItem(HERE_KEY); } catch { return null; } };
const hereComputer = () => {
  const pcs = pcsKnown(), name = herePicked();
  return pcs.find(c => c.name === name) ?? (MY_OS ? pcs.find(c => c.os === MY_OS) : null) ?? null;
};
// A chat's computer { name, os }, when it isn't this one: by name once this one is known, else by
// system (a phone or tablet opens no computer's chat).
const awayFrom = pc => {
  if (!pc || !MY_OS) return null;
  if (MY_OS === 'mobile') return pc;
  const here = hereComputer();
  if (here && pc.name) return pc.name !== here.name ? pc : null;
  return pc.os && pc.os !== MY_OS ? pc : null;
};
const elsewhere = a => awayFrom(a.computer);
const opens = (url, web) => (/^https?:/.test(url) ? 'target="_blank" rel="noopener"' : `data-web="${esc(web)}"`);

// No app on this computer: the app link does nothing and the page keeps the focus, so after a
// moment the web chat opens instead.
// A clipboard: the person's tasks.
// An agent's state on its card, as an icon beside its name: a moon while it sleeps, a bolt while it works.
const STATE_ICONS = {
  'board.paused': '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>',
  'board.resting': '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg>',
  'board.working': '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M13.5 2 5 13.5h6L10 22l9-12h-6.5z"/></svg>',
};
// Bars going up: the agents' spending.
const SPEND_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 20h16M7 16v-4M12 16V7M17 16v-7"/></svg>';
// Each limit's logo on the spending chart's "%" buttons, in the service's own colors (Simple Icons, CC0).
const BRAND = (d, fill, defs = '') => `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">${defs}<path fill="${fill}" d="${d}"/></svg>`;
const CLAUDE_LOGO = BRAND('m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z', '#D97757');
const OPENAI_LOGO = BRAND('M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z', 'currentColor');
const GEMINI_LOGO = BRAND('M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81', 'url(#gemini-grad)',
  '<defs><linearGradient id="gemini-grad" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#1C7DFF"/><stop offset=".55" stop-color="#9168C0"/><stop offset="1" stop-color="#E3466E"/></linearGradient></defs>');
// Grok's mark is drawn with holes (even-odd).
const GROK_LOGO = BRAND('M9.27 15.29l7.978-5.897c.391-.29.95-.177 1.137.272.98 2.369.542 5.215-1.41 7.169-1.951 1.954-4.667 2.382-7.149 1.406l-2.711 1.257c3.889 2.661 8.611 2.003 11.562-.953 2.341-2.344 3.066-5.539 2.388-8.42l.006.007c-.983-4.232.242-5.924 2.75-9.383.06-.082.12-.164.179-.248l-3.301 3.305v-.01L9.267 15.292M7.623 16.723c-2.792-2.67-2.31-6.801.071-9.184 1.761-1.763 4.647-2.483 7.166-1.425l2.705-1.25a7.808 7.808 0 00-1.829-1A8.975 8.975 0 005.984 5.83c-2.533 2.536-3.33 6.436-1.962 9.764 1.022 2.487-.653 4.246-2.34 6.022-.599.63-1.199 1.259-1.682 1.925l7.62-6.815', 'currentColor').replace('<path ', '<path fill-rule="evenodd" ');
const KIMI_LOGO = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M21.846 0a1.923 1.923 0 110 3.846H20.15a.226.226 0 01-.227-.226V1.923C19.923.861 20.784 0 21.846 0z" fill="#1783FF"></path><path d="M11.065 11.199l7.257-7.2c.137-.136.06-.41-.116-.41H14.3a.164.164 0 00-.117.051l-7.82 7.756c-.122.12-.302.013-.302-.179V3.82c0-.127-.083-.23-.185-.23H3.186c-.103 0-.186.103-.186.23V19.77c0 .128.083.23.186.23h2.69c.103 0 .186-.102.186-.23v-3.25c0-.069.025-.135.069-.178l2.424-2.406a.158.158 0 01.205-.023l6.484 4.772a7.677 7.677 0 003.453 1.283c.108.012.2-.095.2-.23v-3.06c0-.117-.07-.212-.164-.227a5.028 5.028 0 01-2.027-.807l-5.613-4.064c-.117-.078-.132-.279-.028-.381z" fill="#fff"></path></svg>';
// Google Antigravity's arch (LobeHub icons, MIT), in Google's colours: its quota for Claude and GPT models.
const ANTIGRAVITY_LOGO = BRAND('M21.751 22.607c1.34 1.005 3.35.335 1.508-1.508C17.73 15.74 18.904 1 12.037 1 5.17 1 6.342 15.74.815 21.1c-2.01 2.009.167 2.511 1.507 1.506 5.192-3.517 4.857-9.714 9.715-9.714 4.857 0 4.522 6.197 9.714 9.715z', 'url(#antigravity-grad)',
  '<defs><linearGradient id="antigravity-grad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#00B95C"/><stop offset=".35" stop-color="#FBBC04"/><stop offset=".65" stop-color="#FC413D"/><stop offset="1" stop-color="#3186FF"/></linearGradient></defs>');
const LIMIT_LOGOS = { claude: CLAUDE_LOGO, codex: OPENAI_LOGO, 'antigravity:gemini': GEMINI_LOGO, 'antigravity:claude-gpt': ANTIGRAVITY_LOGO, grok: GROK_LOGO, kimi: KIMI_LOGO };
// The plans' limits by their key (live.js limitKey): Claude's, Codex's, Antigravity's quotas.
const LIMIT_NAMES = { claude: 'Claude', codex: 'Codex', 'antigravity:gemini': 'Gemini', 'antigravity:claude-gpt': 'Claude/GPT', grok: 'Grok Bot', kimi: 'Kimi' };
const TASKS_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="1"/><path d="M9 4V2.5h6V4"/><path d="M8.5 10h7M8.5 14h7M8.5 18h4"/></svg>';

// A Claude run Goalcraft started from the command line opens in the Claude app by its resume link, which
// brings the session into the app; that works once, so after it the link is the app's conversation
// (local_<session>), on this card and everywhere it is kept (onChatOpened).
const RESUME = /^claude:\/\/resume\?session=([\w-]+)$/;
let chatOpened = null;
function openApp(e) {
  const link = e.target.closest('a[data-web]');
  if (!link) return;
  e.preventDefault();
  const resumed = RESUME.exec(link.getAttribute('href') || '');
  if (resumed) {
    const from = link.getAttribute('href'), to = `claude://claude.ai/epitaxy/local_${resumed[1]}`;
    setTimeout(() => { link.setAttribute('href', to); chatOpened?.(from, to); }, 0);
  }
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
// The shortest time between two starts of a cron, in minutes, from its minute field (a role runs at
// most every 10 minutes): its minutes in an hour, and the next hour's first after the last.
function cronMinGap(cron) {
  const field = (cron || '').trim().split(/\s+/)[0];
  if (!field) return 60;
  const mins = new Set();
  for (const part of field.split(',')) {
    const m = /^(\*|\d{1,2}(?:-\d{1,2})?)(?:\/(\d{1,2}))?$/.exec(part);
    if (!m) return 60;
    const [a, b] = m[1] === '*' ? [0, 59] : m[1].split('-').map(Number).concat(m[1].includes('-') ? [] : [m[2] ? 59 : Number(m[1])]);
    for (let x = a; x <= b; x += Number(m[2] || 1)) mins.add(x);
  }
  const list = [...mins].sort((x, y) => x - y);
  if (!list.length) return 60;
  let gap = 60 - list[list.length - 1] + list[0];
  for (let i = 1; i < list.length; i++) gap = Math.min(gap, list[i] - list[i - 1]);
  return gap;
}
const MIN_GAP = 10;

export function mountDashboard(funnels, opts = {}) {
  pcsKnown = opts.launchComputers ?? (() => []);
  const canvas = document.getElementById('scene');
  const scroller = document.getElementById('scroller');
  const track = document.getElementById('titles-track');
  const clock = document.getElementById('day');
  const pop = document.getElementById('pop');
  // This computer picked among the wake scripts (Spending): kept in this browser for the chats' buttons.
  pop.addEventListener('change', e => {
    if (!e.target.matches('input[name="here-pc"]')) return;
    try { localStorage.setItem(HERE_KEY, e.target.value); } catch {}
  });
  chatOpened = opts.onChatOpened ?? null;
  pop.addEventListener('click', openApp);
  const tip = document.createElement('div');
  tip.id = 'tip'; tip.hidden = true; document.body.append(tip);
  let scene = new Scene(canvas, funnels, { live: opts.live, grow: tankView === 'grow' });

  // The funnels' order, as the viewer drags them by their titles. Live (opts.onOrder), it is the
  // person's, kept in the database: the funnels come in it, and a new one is sent there, so every
  // browser shows the same; until the data says so too, the board keeps the one just dragged. The
  // demo keeps its order in this browser.
  const ORDER_KEY = opts.orderKey || 'goalcraft-order';
  let dragged = null;
  const saved = () => { try { const o = JSON.parse(localStorage.getItem(ORDER_KEY)); return Array.isArray(o) ? o : null; } catch { return null; } };
  const loadOrder = () => {
    if (!opts.onOrder) { const o = saved(); if (o) scene.applyOrder(o); return; }
    if (dragged) {
      if (scene.ids().join() === dragged.join()) dragged = null;
      else scene.applyIds(dragged);
    }
  };
  const sendOrder = () => {
    dragged = scene.ids();
    Promise.resolve(opts.onOrder(dragged)).catch(e => { console.error(e); dragged = null; });
  };
  const saveOrder = () => {
    if (opts.onOrder) sendOrder();
    else try { localStorage.setItem(ORDER_KEY, JSON.stringify(scene.order())); } catch {}
  };
  loadOrder();
  // Live, the first time: funnels never placed in the database take the order this browser kept
  // before it was kept there.
  if (opts.onOrder && scene.funnels.every(f => f.position == null) && saved()) {
    const before = scene.ids().join();
    scene.applyOrder(saved());
    if (scene.ids().join() !== before) sendOrder();
    try { localStorage.removeItem(ORDER_KEY); } catch {}
  }

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
  // What the agents spent, over all funnels: a button right after the zoom.
  // Once there are wake scripts, a dot takes the icon's place: green while all of them are well, the
  // worst one's color (red, amber) when one is in trouble; what is wrong on hover (markScripts).
  let spendBtn = null;
  if (opts.spending) {
    spendBtn = document.createElement('button');
    spendBtn.type = 'button'; spendBtn.className = 'spend-btn';
    spendBtn.dataset.tip = t('spend.title');
    spendBtn.innerHTML = `${SPEND_ICON}<span class="wide">${esc(t('spend.button'))}</span>`;
    spendBtn.addEventListener('click', e => { e.stopPropagation(); showSpend(e); });
    zoomBox.after(spendBtn);
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
      const strip = scene.titleStrip(+el.dataset.fi, h);
      el.style.backgroundImage = `url(${strip.toDataURL()})`;
      strip.width = strip.height = 0; // its memory back at once (Safari counts it until it is collected)
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
      // Kept inside the window, also under its top edge (its × in sight); the tail still points at the agent.
      const w = el.offsetWidth, h = el.offsetHeight, left = Math.max(8, Math.min(viewW() - w - 8, x - w / 2));
      el.style.left = left + 'px'; el.style.top = Math.max(y, h + 14 + 8) + 'px';
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
    showPop(e, `<div class="pop-title">${esc(f.title)}: ${esc(name)}</div><div class="hist-body"><div class="pop-loading" role="status" aria-label="${esc(t('board.loading'))}"></div></div>`);
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
      const units = `<div class="hist-periods hist-units">${FLOW_UNITS.map(x => `<button type="button" data-u="${x}" class="${x === u ? 'on' : ''}" data-tip="${esc(t('flow.' + x))}" aria-label="${esc(t('flow.' + x))}">${esc([...t('units')[x]][0])}</button>`).join('')}</div>`;
      body.innerHTML = `<div class="hist-controls">${periods.length ? `<div class="hist-periods">${periods.map(p => `<button type="button" data-p="${p}" class="${p === shown ? 'on' : ''}">${esc(periodLabel(u, p))}</button>`).join('')}</div>` : '<span></span>'}${units}</div>
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
  const SPEND_COLORS = ['#9FE870', '#79B4F0', '#F2C14E', '#F28AB8', '#B585F2', '#7CF0B0', '#E8E3D8', '#5BC0BE', '#C9A27E', '#C4E538', '#FF6FD8', '#FFD9A0', '#8E9BFF', '#FF8A5B'];
  // A service's own color on the chart: its brand's (data.js), the black ones light enough to see on
  // the dark card.
  const BRAND_CHART = { grok: '#EDEDED', kimi: '#9A9AA6' };
  const brandColor = id => BRAND_CHART[id] ?? agentInfo(id).color;
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const near = (a, b) => { const [x, y] = [rgb(a), rgb(b)]; return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 90; };
  const spendState = { split: 'funnel', funnel: null };
  // The plans' limits, folded under the spending: how much of each is used (a week, Kimi's a month)
  // and when it resets, as the wake script last read them.
  const resetFmt = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  function limitsBlock(spent = []) {
    const list = opts.limits?.() ?? [];
    if (!list.length) return '';
    const order = Object.keys(LIMIT_NAMES);
    // Every line says how much is used and when it resets next. A limit whose reset time has passed is
    // at 0% until a new reading, and resets next a week (Kimi's a month) after that, or later still.
    const gone = l => l.resets && l.resets < Date.now(), used = l => gone(l) ? 0 : Math.min(100, Math.max(0, l.used));
    const nextReset = l => {
      const d = new Date(l.resets);
      while (d < Date.now()) { if (l.days > 7) d.setMonth(d.getMonth() + 1); else d.setDate(d.getDate() + l.days); }
      return d;
    };
    const color = u => u >= 90 ? '#FF5A4E' : u >= 70 ? '#F2A33C' : '#9FE870';
    const when = l => l.resets ? t('spend.resetsAt', resetFmt.format(nextReset(l))) : '';
    // What Goalcraft's agents spent of it, in $ at API prices, since it last reset (its period back from
    // the next reset; a week back from now when the reset isn't known): on hover by its bar.
    const since = l => {
      if (!l.resets) return new Date(Date.now() - l.days * 864e5);
      const d = nextReset(l);
      if (l.days > 7) d.setMonth(d.getMonth() - 1); else d.setDate(d.getDate() - l.days);
      return d;
    };
    const costTip = l => {
      const from = since(l), mine = spent.filter(r => r.quota === l.key && r.at >= from.getTime() && r.cost != null);
      return mine.length ? t('spend.limitCost', fmtCost(mine.reduce((n, r) => n + r.cost, 0)), resetFmt.format(from)) : '';
    };
    const row = (logo, name, l, bar) => `<li><span class="who">${logo}${esc(name)} <span class="per">${esc(t(l.days > 7 ? 'spend.perMonth' : 'spend.perWeek'))}</span></span>
        ${bar}<b>${esc(fmtPercent(used(l)))}</b><span class="when">${esc(when(l))}</span></li>`;
    const sorted = list.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
    // Antigravity's quotas (Gemini, Claude/GPT) share one line: its bar split into one
    // part each, every part's own percent and reset on hover; the line's percent is the most used one's.
    const ag = sorted.filter(l => l.key.startsWith('antigravity:'));
    const agRow = () => {
      const top = ag.reduce((m, l) => used(l) > used(m) ? l : m);
      const parts = ag.map(l => `<span data-tip="${esc([`${LIMIT_NAMES[l.key] ?? l.key}: ${fmtPercent(used(l))}${when(l) ? ', ' + when(l) : ''}`, costTip(l)].filter(Boolean).join('\n'))}"><i style="width:${used(l)}%;background:${color(used(l))}"></i></span>`).join('');
      return row(ANTIGRAVITY_LOGO, 'Antigravity', top, `<span class="bar split">${parts}</span>`);
    };
    const rows = sorted.map(l => {
      if (l.key.startsWith('antigravity:')) return l === ag[0] ? agRow() : '';
      const tip = costTip(l);
      return row(LIMIT_LOGOS[l.key] ?? '', LIMIT_NAMES[l.key] ?? l.key, l, `<span class="bar"${tip ? ` data-tip="${esc(tip)}"` : ''}><i style="width:${used(l)}%;background:${color(used(l))}"></i></span>`);
    }).join('');
    return `<details class="limits"${spendState.limitsOpen ? ' open' : ''}><summary>${esc(t('spend.limits'))}</summary><ul>${rows}</ul></details>`;
  }
  // The wake scripts, one per computer, under the spending: only runs on a computer whose script runs
  // are counted, so each shows whether it runs, whether its version is the latest, and whose runs it
  // counted. Folded until the viewer opens it; when something is off (none yet, one silent, in trouble or
  // outdated), its title says so: a mark a computer, each in its status's color.
  const SPANS = { h: 3600e3, d: 864e5, w: 7 * 864e5 };
  const SELF_UPDATING = '2026-11-18';  // the first version that updates itself
  // One status a computer, its details on hover: stopped from the board (grey, not a problem), gone
  // silent (red), an error (red), a warning or an old version (amber), or all well (green).
  const scriptUp = (c, now) => now - c.seen < 2 * 60e3;
  const scriptCurrent = (w, c) => !w.latest || (c.version ?? '') >= w.latest;
  const problemText = p => {
    const key = `wake.p.${p.code}`, said = t(key, p.agent ?? '', p.why ?? '');
    return said === key ? [p.code, p.agent, p.why].filter(Boolean).join(': ') : said;
  };
  function scriptStatus(w, c, now) {
    if (c.stopped) return ['stopped', t('wake.stopped'), t('wake.stoppedTip')];
    if (!scriptUp(c, now)) return ['off', t('wake.silent', fmtDuration((now - c.seen) / 1000)), t('wake.silentTip')];
    const old = scriptCurrent(w, c) ? [] : [t((c.version ?? '') < SELF_UPDATING ? 'wake.manualTip' : 'wake.updatesTip', w.latest)];
    const said = [...(c.problems ?? []).map(problemText), ...old].join('\n');
    if (c.problems?.some(p => p.level === 'error')) return ['off', t('wake.troubled'), said];
    if (c.problems?.length) return ['warn', t('wake.troubled'), said];
    if (old.length) return ['warn', t('wake.oldVersion'), said];
    return ['ok', t('wake.running'), t('wake.allGood')];
  }
  // A script's mark, in its status's color: a play sign while it runs, a pause sign while it is stopped.
  const scriptMark = level => `<span class="wake-mark ${level}">${level === 'stopped'
    ? '<svg viewBox="0 0 10 10" width="11" height="11" fill="currentColor" aria-hidden="true"><rect x="1.5" y="1" width="2.5" height="8" rx="0.6"/><rect x="6" y="1" width="2.5" height="8" rx="0.6"/></svg>'
    : '<svg viewBox="0 0 10 10" width="11" height="11" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 1.5v7l6-3.5z"/></svg>'}</span>`;
  // Running: on and not stopped.
  const scriptRuns = (c, now) => !c.stopped && scriptUp(c, now);
  // Stop or start a computer's script from the list (live board only): a square while it runs, a
  // triangle while it is stopped.
  const STOP_ICON = '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12"/></svg>';
  const START_ICON = '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M7 5v14l12-7z"/></svg>';
  const scriptBtn = c => !opts.stopWakeScript || !c.id ? '<span></span>'
    : `<button type="button" class="script-btn" data-key="${esc(c.id)}" data-stop="${c.stopped ? 0 : 1}" data-tip="${esc(t(c.stopped ? 'wake.startTip' : 'wake.stopTip'))}" aria-label="${esc(t(c.stopped ? 'wake.start' : 'wake.stop'))}">${c.stopped ? START_ICON : STOP_ICON}</button>`;
  function scriptsBlock(w) {
    if (!w) return '';
    const now = Date.now(), list = w.computers ?? [];
    const open = spendState.scriptsOpen ? ' open' : '';
    if (!list.length) return `<details class="limits scripts"${open}><summary>${esc(t('wake.title'))} ${scriptMark('warn')}</summary><p class="pop-note">${esc(t('wake.none'))}</p></details>`;
    const up = c => scriptUp(c, now), current = c => scriptCurrent(w, c), statusOf = c => scriptStatus(w, c, now);
    const hereName = hereComputer()?.name;
    // The agents each computer ran over the hour, day or week the chart's switch shows, by funnel.
    const span = SPANS[flowUnit] ? flowUnit : 'd', spanText = t('wake.span')[span];
    const funnelTitle = id => scene.funnels.find(f => (f.id ?? f.title) === id)?.title;
    const nameOf = x => {
      const a = scene.agents.find(a => a.agent === x.agent && (a.f.id ?? a.f.title) === x.funnel);
      return a?.name || (a?.sup ? t('board.supervisorName', a.f.title) : x.agent);
    };
    const ranHere = c => (c.agents ?? []).map(x => typeof x === 'string' ? { agent: x, at: now } : x).filter(x => now - x.at <= SPANS[span]);
    const agentsTip = ran => {
      if (!ran.length) return t('wake.noAgents', spanText);
      const by = new Map();
      for (const x of ran) { const f = funnelTitle(x.funnel) ?? ''; by.set(f, [...(by.get(f) ?? []), nameOf(x)]); }
      return t('wake.agentsTip', spanText, [...by].map(([f, names]) => (f ? `${f}: ` : '') + names.join(', ')).join('\n'));
    };
    const rows = list.map(c => {
      const [level, text, tip] = statusOf(c);
      const version = t(current(c) ? 'wake.versionCurrent' : 'wake.versionOld', c.version ?? '?', w.latest ?? '');
      const ran = ranHere(c), n = ran.length;
      // With several computers, which one this browser is on: picked by its system, changed here.
      const here = list.length > 1 && c.computer ? `<label class="here" data-tip="${esc(t('wake.hereTip'))}"><input type="radio" name="here-pc" value="${esc(c.computer)}"${c.computer === hereName ? ' checked' : ''}>${esc(t('wake.here'))}</label>` : '';
      return `<li${list.length > 1 ? ' class="pick-here"' : ''}><span class="who" data-tip="${esc(version)}">${esc(c.computer || t('wake.oldComputer'))}</span>${here}`
        + `<span class="${level}" data-tip="${esc(tip)}">${scriptMark(level)} ${esc(text)}</span>`
        + `<span class="n" data-tip="${esc(agentsTip(ran))}">${esc(t('wake.agents', n, spanText))}</span>${scriptBtn(c)}</li>`;
    }).join('');
    const running = list.filter(c => scriptRuns(c, now)).length;
    return `<details class="limits scripts"${open}><summary>${esc(t('wake.title'))} · ${esc(t('wake.count', running, list.length))} <span class="wake-marks">${list.map(c => scriptMark(statusOf(c)[0])).join('')}</span></summary>
      <ul>${rows}</ul><p class="pop-note">${esc(t('wake.about'))}</p></details>`;
  }
  // The Spending button's marks, from the scripts' latest state (w: wakeScripts' answer): one a computer,
  // in place of its icon, each in its status's color (a pause sign for a stopped one); its icon when
  // there are none.
  let lastScripts = null;  // the scripts as last read, for the Stop / Start buttons
  function markScripts(w) {
    if (w) lastScripts = w;
    if (!spendBtn || !w) return;
    const now = Date.now(), list = w.computers ?? [];
    const icon = spendBtn.firstElementChild;  // the icon, or the marks put there before
    if (!list.length) {
      if (!icon.matches('svg')) icon.outerHTML = SPEND_ICON;
      spendBtn.dataset.tip = t('spend.title');
      return;
    }
    const states = list.map(c => [c, scriptStatus(w, c, now)]);
    const marks = Object.assign(document.createElement('span'), { className: 'wake-marks', innerHTML: states.map(([, s]) => scriptMark(s[0])).join('') });
    icon.replaceWith(marks);
    const head = `${t('wake.title')} · ${t('wake.count', list.filter(c => scriptRuns(c, now)).length, list.length)}`;
    const each = states.map(([c, s]) => `${c.computer || t('wake.oldComputer')}: ${s[1]}`);
    spendBtn.dataset.tip = [t('spend.title'), head, ...each].join('\n');
  }
  // At most every half minute: the board redraws with every write of an agent.
  let scriptsAt = 0;
  const checkScripts = () => {
    if (!opts.wakeScripts || Date.now() - scriptsAt < 30e3) return;
    scriptsAt = Date.now();
    opts.wakeScripts().then(markScripts, () => {});
  };
  async function showSpend(e) {
    showPop(e, `<div class="pop-title">${esc(t('spend.title'))}</div><div class="hist-body"><div class="pop-loading" role="status" aria-label="${esc(t('board.loading'))}"></div></div>`);
    pop.classList.add('wide');
    const body = pop.querySelector('.hist-body');
    let rows, scripts;
    try {
      [rows, scripts] = await Promise.all([opts.spending(Date.now() - 366 * 864e5), opts.wakeScripts ? opts.wakeScripts().catch(() => null) : null]);
      markScripts(scripts);
    } catch { body.innerHTML = `<p class="pop-note">${esc(t('hist.failed'))}</p>`; return; }
    if (!body.isConnected) return;
    if (!rows.length) { body.innerHTML = `<p class="pop-note">${esc(t('spend.none'))}</p>${scriptsBlock(scripts)}`; return; }
    // A run's funnel by its id (live) or title (demo); its name as on the board.
    const funnelOf = new Map(scene.funnels.map(f => [f.id ?? f.title, f]));
    // Each agent's provider, apart from its name: what it said (on the board), else the app of its runs.
    const appOf = new Map(rows.map(r => [r.agent, r.app]));
    const provOf = new Map(scene.agents.map(a => [`${a.agent}|${a.f.id ?? a.f.title}`, a.provider]));
    const whereOf = k => ({ provider: provOf.get(k), app: appOf.get(k.split('|')[0]) });
    // $ at API prices, or the share of one plan's limit: Claude's, Codex's, or one of Antigravity's
    // quotas (one per group of models, as its settings show them).
    const value = r => r.cost, fmt = fmtCost;
    let u, all, period;
    const prepare = () => {
      u = flowUnit;
      all = [];
      for (let d = barStart(u, rows[0].at), end = Date.now(); d <= end; d = nextBar(u, d)) all.push(d);
      period = PERIODS[u][1];
      try { const p = localStorage.getItem(periodKey(u)); if (p !== null && PERIODS[u].includes(Number(p))) period = Number(p); } catch {}
    };
    const draw = () => {
      const periods = PERIODS[u].filter(p => !p || all.length > p), shown = periods.includes(period) ? period : 0;
      const bars = shown ? all.slice(-shown) : all, n = bars.length, from = bars[0].getTime();
      // By funnel, by agent, or by service (Claude, ChatGPT, Gemini…: the agents' brands added up).
      const splits = spendState.funnel ? ['agent', 'vendor'] : ['funnel', 'agent', 'vendor'];
      const split = splits.includes(spendState.split) ? spendState.split : 'agent';
      const mine = rows.filter(r => r.at >= from && value(r) != null && (!spendState.funnel || r.funnel === spendState.funnel));
      const vendorId = new Map();
      const vendor = r => { const id = providerOf(r.agent, { ...whereOf(`${r.agent}|${r.funnel}`), app: r.app }) ?? r.agent, name = agentInfo(id).name; vendorId.set(name, id); return name; };
      const groupOf = r => split === 'funnel' ? r.funnel : split === 'vendor' ? vendor(r) : `${r.agent}|${r.funnel}`;
      const label = k => split === 'funnel' ? funnelOf.get(k)?.title ?? '?' : split === 'vendor' ? k
        : `${agentInfo(k.split('|')[0], whereOf(k)).name}${spendState.funnel ? '' : ' · ' + (funnelOf.get(k.split('|').slice(1).join('|'))?.title ?? '?')}`;
      // Groups, the biggest first (at the bottom of each bar, first in the legend), each with its colour.
      const totals = new Map(), runs = new Map();
      for (const r of mine) { const k = groupOf(r); totals.set(k, (totals.get(k) || 0) + value(r)); runs.set(k, (runs.get(k) || 0) + 1); }
      const groups = [...totals.keys()].sort((a, b) => totals.get(b) - totals.get(a));
      // By funnel, every funnel is listed: one with no runs in the period says 0 runs, $0.
      if (split === 'funnel') for (const f of scene.funnels) {
        const k = f.id ?? f.title;
        if (!totals.has(k)) { groups.push(k); totals.set(k, 0); runs.set(k, 0); }
      }
      // A service, and the first (biggest) agent of each service, in the service's own color, so the bars
      // read at once: Claude orange, ChatGPT green. Funnels, a service's other agents, and a service whose
      // color another already has, take the next color of the palette not close to one in use.
      const color = new Map(), brands = [], taken = new Set();
      const brandOf = k => split === 'funnel' ? null : split === 'vendor' ? vendorId.get(k) : providerOf(k.split('|')[0], whereOf(k)) ?? k.split('|')[0];
      for (const k of groups) {
        const b = brandOf(k) && brandColor(brandOf(k));
        if (b && !brands.some(c => near(c, b))) { color.set(k, b); brands.push(b); }
      }
      let next = 0;
      for (const k of groups) {
        if (color.has(k)) continue;
        const left = SPEND_COLORS.filter(c => !taken.has(c));
        const c = left.find(c => !brands.some(u => near(c, u))) ?? left[0] ?? SPEND_COLORS[next++ % SPEND_COLORS.length];
        color.set(k, c); taken.add(c);
      }
      const index = new Map(bars.map((d, i) => [d.getTime(), i]));
      const cells = bars.map(() => new Map());
      for (const r of mine) {
        const i = index.get(barStart(u, r.at).getTime());
        if (i != null) cells[i].set(groupOf(r), (cells[i].get(groupOf(r)) || 0) + value(r));
      }
      const sums = cells.map(c => [...c.values()].reduce((a, b) => a + b, 0)), sum = sums.reduce((a, b) => a + b, 0);
      const top0 = Math.max(1, ...sums);
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
        <div class="hist-controls spend-controls">${periods.length ? `<div class="hist-periods spend-periods">${btns(periods.map(String), String(shown), 'p', p => periodLabel(u, Number(p)))}</div>` : ''}
          <div class="hist-periods spend-split">${btns(splits, split, 's', s => t({ funnel: 'spend.byFunnel', agent: 'spend.byAgent', vendor: 'spend.byVendor' }[s]))}</div>
          <div class="hist-periods hist-units">${FLOW_UNITS.map(x => `<button type="button" data-u="${x}" class="${x === u ? 'on' : ''}" data-tip="${esc(t('flow.' + x))}" aria-label="${esc(t('flow.' + x))}">${esc([...t('units')[x]][0])}</button>`).join('')}</div></div>
        <div class="hist-chart"><div class="hist-y">${ticks.map(v => `<span style="bottom:${(v / max) * 100}%">${esc('$' + fmtCount(v))}</span>`).join('')}</div>
          <div class="hist-plot">${ticks.map(v => `<b style="bottom:${(v / max) * 100}%"></b>`).join('')}
            <div class="hist-bars stacked${n > 60 ? ' dense' : ''}">${bars.map((d, i) => `<span data-tip="${esc(tipOf(d, i))}">${groups.filter(k => cells[i].get(k)).map(k => `<i style="height:${(cells[i].get(k) / max) * 100}%;background:${color.get(k)}"></i>`).join('')}</span>`).join('')}</div></div></div>
        <div class="hist-axis"><span>${esc(short.format(bars[0]))}</span><span>${esc(short.format(bars[n - 1]))}</span></div>
        <ul class="spend-list">${groups.slice(0, 12).map(k => `<li${split === 'funnel' ? ` data-f="${esc(k)}" class="pick" data-tip="${esc(t('spend.pick'))}"` : ''}><i style="background:${color.get(k)}"></i><span class="who">${esc(label(k))}</span><span class="n">${esc(t('spend.runs', runs.get(k)))}</span><b>${esc(fmt(totals.get(k)))}</b></li>`).join('')}
          <li class="total"><i></i><span class="who">${esc(t('spend.all'))}</span><span class="n">${esc(t('spend.runs', mine.length))}</span><b>${esc(fmt(sum))}</b></li></ul>${limitsBlock(rows)}${scriptsBlock(scripts)}`;
      body.querySelector('details.limits:not(.scripts)')?.addEventListener('toggle', e => { spendState.limitsOpen = e.target.open; });
      body.querySelector('details.scripts')?.addEventListener('toggle', e => { spendState.scriptsOpen = e.target.open; });
      const on = (sel, fn) => body.querySelectorAll(sel).forEach(b => b.addEventListener('click', ev => { ev.stopPropagation(); fn(b); draw(); }));
      on('.spend-periods button', b => { period = Number(b.dataset.p); try { localStorage.setItem(periodKey(u), String(period)); } catch {} });
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
    canvas.style.cursor = h && h.type !== 'stage' && h.type !== 'result' && (h.type !== 'count' || opts.history) ? 'pointer' : 'default';
    // A tank shows only its number and flow; what it holds pops up on hover. The sheet on top says
    // where the list it opens is kept.
    if (!['stage', 'count', 'source', 'guide', 'result', 'agent'].includes(h?.type) || e.pointerType === 'touch') return (tip.hidden = true);
    showTip(e, h);
  });
  let tipTimer;
  function showTip(e, h) {
    tip.classList.remove('over');
    if (h.type === 'result') tip.textContent = h.title;
    else if (h.type === 'agent') tip.textContent = agentTip(h.a);
    else if (h.type === 'source') tip.textContent = t('board.sheet', sheetPlace(h.url));
    else if (h.type === 'guide') tip.textContent = t('board.guide', sheetPlace(h.url));
    else {
      const f = scene.funnels[h.fi], s = f.stages[h.j], label = plural(s.count, s.forms);
      let text = label.charAt(0).toLocaleUpperCase(lang) + label.slice(1);  // Turkish: i → İ
      // Its name with its +N, what the +N under the tank means: the growth in the last 24 hours, per
      // hour, day or week as the person picked (or as set by hand). "Jobs found: +43 in 24 hours".
      const flow = f.flows?.[h.j], unit = t(`flow.${flowUnit}`);
      if (flow != null) text += ': ' + (f.flowSet?.[h.j] ? t('board.flowSet', fmtFlow(flow), unit)
        : flowUnit === 'd' ? t('board.flowDay', fmtFlow(flow)) : t('board.flowTip', fmtFlow(flow), unit));
      // With the open ones known: how many reached it, are still open and dropped out here (those
      // that went on are the next tank's). One turned down at a later step went on and drops out
      // there. The three add up: an agent's open count above what can still be open (all but those
      // that went on) is taken as that much.
      if (s.active != null) {
        const next = nextOf(f, h.j), open = openOf(f, h.j);
        text += '\n' + t('board.openTip', fmtCount(s.count), fmtCount(open), fmtCount(s.count - open - next));
      }
      tip.textContent = text;
    }
    tip.hidden = false;
    tip.style.left = Math.max(8, Math.min(viewW() - tip.offsetWidth - 8, e.clientX + 14)) + 'px';
    tip.style.top = e.clientY + 18 + 'px';
  }
  canvas.addEventListener('pointerleave', () => { tip.hidden = true; });
  // An agent on hover, before its card: its name as on its card, then the app, model and effort of the
  // conversation it works in ("Claude Opus 5.5 · medium"); without one known, its app.
  function agentTip(a) {
    const info = agentInfo(a.agent, { provider: a.provider, chat: a.chat });
    const name = a.name || (a.sup ? t('board.supervisorName', a.f.title) : info.name);
    // Its app as known (a run's, else the one it said it is); an agent whose app is unknown shows none, not its id.
    const known = info.name !== a.agent && !info.name.includes(' · ');
    const run = a.chatRun, app = run?.app ? (APP_NAMES[run.app] ?? run.app) : (info.product || (known ? info.name : ''));
    const model = modelName(run?.model);
    const how = [model && model.startsWith(app) ? '' : app, model, run?.effort].filter(Boolean).join(' · ');
    return how ? `${name}
${how}` : name;
  }
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
    if (h.type === 'stage' || h.type === 'count' || h.type === 'result') {
      hidePop(); showTip(e, h);
      clearTimeout(tipTimer); tipTimer = setTimeout(() => { tip.hidden = true; }, 2000);
      return;
    }
    // The sheets on top open the funnel's list straight away.
    if (h.type === 'source' || h.type === 'guide') { hidePop(); return window.open(h.url, '_blank', 'noopener'); }
    showPop(e, content(h));
    // An agent's card is the same whether it was opened by the agent or by its question bubble.
    popAgent = { a: h.a, named: h.a.shownName };
    bindRuns(h.a);
    if (opts.onAnswer) bindAnswer(h.a);
    if (opts.onMessage) bindMessage(h.a);
    bindLaunch(h.a);
  });

  // A supervisor's status word in its own colour: all good, bottleneck, recommendation, question.
  // Tokens as "12 млн", "850 тыс.": the person's language, one decimal at most.
  const compact = new Intl.NumberFormat(lang, { notation: 'compact', maximumFractionDigits: 1 });
  const fmtTokens = n => compact.format(n);
  const money = [0, 2].map(d => new Intl.NumberFormat(lang, { minimumFractionDigits: d, maximumFractionDigits: d }));
  const fmtCost = n => (n ? '$' + money[n >= 10 ? 0 : 1].format(n) : '$0');  // nothing spent: $0, not $0.00
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
    counted(u) && t('board.tokTotal', fmtTokens(u.tokens)),
    limit != null && t('board.usageLimit', limit, u.limitDays),
  ].filter(Boolean).join('\n');
  // Whether a use has a cost or tokens to show. Grok Bot's servers give neither per bot (since November
  // 2026), only its share of the plan's limit: such a use shows that share alone, not "0 tokens".
  const counted = u => u.cost != null || u.tokens > 0;
  // What a supervisor found, by its word ("Recommendation"); what it said on hover.
  const supStatus = (s, said) => s === 'question' ? '' : `<span class="sup-status st-${esc(s)}"${said ? ` data-tip="${esc(said)}"` : ''}>${esc(t('board.supStatus.' + s))}</span>`;

  // Run now only when the role can start: nothing of it waits or goes on. Else what is going on instead.
  // An agent silent for 10 minutes is taken to have finished (as Goalcraft does): it can be run again.
  const runState = a => scene.lost(a) && !a.start?.waiting ? '' : a.state === 'work' || a.start?.taken?.started_at ? t('launch.running')
    : a.start?.taken ? t('launch.starting', a.start.taken.computer ?? '') : a.start?.waiting ? t('launch.inQueue') : '';
  const runNowHtml = a => {
    const now = runState(a);
    return now ? `<span class="l-run-state">${esc(now)}</span>` : `<a href="#" class="l-run" data-tip="${esc(t('launch.runNowTip'))}">${esc(t('launch.runNow'))}</a>`;
  };
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
    // A Grok agent in the Grok Bot app opens its bot there ("Open Grok Bot"), or the app at least.
    const inGrokBot = /^grokbot:/i.test(a.chat || '');
    const base = agentInfo(a.agent, { provider: a.provider, chat: a.chat, app: a.usage?.app });
    const info = inAntigravity ? { ...base, product: 'Antigravity', app: null } : inGrokBot ? { ...base, product: 'Grok Bot' } : base;
    // own: the agent's own chat, an app link (claude://, codex://, antigravity://) or a web one; web:
    // where to go when the app isn't on this computer.
    const own = a.chat || (inAntigravity ? 'antigravity://' : info.chat), web = webOf(own, info), chat = chatLink(info, own), paint = agentButton(info);
    // Its own name when it gave one; else a supervisor goes by its funnel, a worker by its model.
    const named = a.shownName = a.name || (a.sup ? t('board.supervisorName', f.title) : info.name), who = esc(named);
    // What this run added (the last run's while it sleeps) to the items it works into: "+4 applied",
    // as its past runs say it. The supervisor watches the whole funnel:
    // what its last run found instead ("All good", "Bottleneck: …").
    let where;
    if (a.sup) {
      // Its word alone ("Recommendation"); what it said shows on hover.
      const found = a.status ? supStatus(a.status, a.summary) : '';
      where = found || (a.summary ? esc(a.summary) : esc(t('board.supervisorNoRun')));
    }
    else {
      // The card's number is kept for its runs list, so its running row says the same.
      const st = f.stages, n = a.shownAdded = a.added || 0;
      const into = a.zone === st.length - 1 ? f.result : st[a.zone + 1].forms;
      where = `<b class="run">+${fmtCount(n)}</b> ${esc(plural(n, into))}`;
    }
    // Live only: the agent's last runs, loaded when the person opens them.
    // Its last week's spending shows at once, above its runs (which open on a click).
    // Under a line: the last week's spending, then the runs.
    // Its runs fold under one line, with its last week's cost at that line's right end.
    const history = opts.runs ? `<div class="history"><details class="runs"><summary><span class="fold-title">${esc(t('board.runs'))}</span><span class="runs-day"></span></summary><div class="runs-list"></div></details></div>` : '';
    // Overdue (it should have run by now) or silent at work: when it was last heard from.
    const missed = scene.overdue(a)
      ? `<p class="pop-note warn">${esc(t('board.lastSignal', fmtDuration(scene.t + (a.seenAgo || 0))))}</p>` : '';
    // One card for an agent, whatever it does: its questions, when it has any, are a block in it.
    // Each open question with its own answer box and, beside Send, the chat it was asked from (or the
    // agent's chat): an agent working in several chats asks from each. The demo links to the agent's
    // chat instead. The question's own chat, or the agent's; the site's front page alone is no chat.
    const mine = url => (url && url !== info.chat && url !== web ? url : a.chat);
    // A question's chat is on the computer of the run that asked it, when known (else the agent's):
    // on another computer the button is greyed and says which; with several computers its hint names it.
    const severalPcs = (opts.launchComputers?.() ?? []).length > 1;
    const openBtn = (url, pc) => {
      const link = chatLink(info, url);
      const away = pc ? awayFrom(pc) : elsewhere(a);
      const tipText = opts.live ? [whereTip(mine(url), info, inAntigravity), pc && severalPcs ? t('board.onComputer', pc.name) : ''].filter(Boolean).join(' · ') : '';
      return link ? openBtnHtml(link, webOf(url, info), info, tipText, opts.live && away) : '';
    };
    // Each question folds to its label with a ❓ ("Question" when it is the only one, else "Question 1",
    // "Question 2") and opens by itself to its text and answer box; the first starts open.
    const several = (a.questions?.length ?? 0) > 1;
    const askHtml = (q, i) => `<details class="ask-item"${i ? '' : ' open'}><summary><span class="fold-title">❓ ${esc(t('board.question', several ? i + 1 : 0))}</span></summary>`
      + `<div class="ask" data-qid="${esc(q.id)}"><p class="ask-text">${esc(q.question)}</p>${opts.onAnswer
      ? `<textarea class="answer" rows="3" maxlength="2000" placeholder="${esc(t('board.answer'))}"></textarea>
        <div class="ask-buttons"><button class="btn primary send" style="${paint}" data-tip="${esc(t('board.sendAnswerTip'))}">${esc(t('board.send'))}</button>${chatIcon(a, q.chat || a.chat, q.chat ? q.run : a.chatRun, q.computer ?? elsewhere(a)) || openBtn(q.chat || web, q.computer)}</div>
        <div class="pop-msg"></div>` : ''}</div></details>`;
    // Asleep, it takes the answers only on its next run: when that is.
    const left = scene.sleepLeft(a), takes = a.state === 'sleep' && !missed && left > 0 ? `<p class="pop-note">${esc(t('board.nextRun', fmtDuration(left)))}</p>` : '';
    const replyIn = opts.onAnswer ? '' : `<a class="btn primary" style="${paint}" href="${esc(chat)}" ${opens(chat, web)}>${esc(t('board.replyIn', info.product || info.name))}</a>`;
    const questions = a.questions?.length ? `<div class="asks">${takes}${a.questions.map(askHtml).join('')}${replyIn}</div>` : '';
    const lost = scene.lost(a) ? `<p class="pop-note warn">${esc(t('board.lastSignal', fmtDuration(scene.silence(a))))}</p>` : '';
    // On pause: why, as it or its supervisor said, or the used-up limit with when it resets.
    // A role paused by its schedule turned off says so on its Launch line ("Paused"), not here too.
    const offSchedule = a.launch && a.pauseReason === 'расписание выключено';
    const pl = a.pauseLimit, why = a.state !== 'pause' || offSchedule ? '' : a.pauseReason
      || (pl ?t('board.pausedLimit', LIMIT_NAMES[pl.key] ?? pl.key, pl.resets ? fmtDuration((pl.resets - Date.now()) / 1000) : null) : '');
    const paused = why ? `<p class="pop-note">${esc(why)}</p>` : '';
    // Write to it any time: it reads the message through MCP when it next checks in (at once if it
    // works now, or when the person's wake script wakes it). Not while it asks: the answers are what
    // it waits for, so the form (and Run now in it) shows once the last question is answered.
    const asking = !!a.questions?.length;
    const write = opts.onMessage ? `<div class="write"${asking ? ' hidden' : ''}><textarea class="message" rows="2" maxlength="2000" placeholder="${esc(t('board.message', named))}"></textarea>
        <div class="ask-buttons"><button class="btn primary send-message" style="${paint}" data-tip="${esc(t('board.sendMessageTip'))}">${esc(t('board.sendMessage'))}</button>${chatIcon(a, a.chat, a.chatRun, elsewhere(a)) || (chat ? openBtnHtml(chat, web, info, (opts.live ? whereTip(a.chat, info, inAntigravity) : ''), opts.live && elsewhere(a)) : '')}${opts.onRunNow ? runNowHtml(a) : ''}</div>
        <div class="pop-msg"></div></div>`
      : asking ? '' : chatIcon(a, a.chat, a.chatRun, elsewhere(a)) || (chat ? openBtnHtml(chat, web, info, (opts.live ? whereTip(a.chat, info, inAntigravity) : ''), opts.live && elsewhere(a)) : '');
    return `<div class="pop-title" data-state="${agentState(a)}">${agentTitle(a, named)}</div>
      <div class="pop-status">${paused}${missed}${lost}</div>
      <div class="pop-sub where">${where}</div>
      ${questions}${write}${launchHtml(a)}${history}`;
  }

  // A role Goalcraft starts itself (the orchestrator): in its card, Launch with Run now on its line;
  // opened, its schedule with its instructions beside it, whether runs go evenly by the plans' quotas
  // (else by priority), its main computer when there are several, and who may work it: every app the
  // main computer has, in order (dragged by its handle), each on or off, with its model and effort, a
  // new chat or not, and full access; Save.
  const APP_NAMES = { claude: 'Claude', codex: 'Codex', antigravity: 'Antigravity', grok: 'Grok Bot' };
  const APP_LOGOS = { claude: CLAUDE_LOGO, codex: OPENAI_LOGO, antigravity: ANTIGRAVITY_LOGO, grok: GROK_LOGO };
  const APPS = ['claude', 'codex', 'antigravity', 'grok'];
  const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
  const NOTE_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M6 2h9l5 5v15H6V2zm8 1.5V8h4.5L14 3.5zM8 11h10v1.5H8V11zm0 3.5h10V16H8v-1.5zm0 3.5h7v1.5H8V18z"/></svg>';
  // The schedule as the person writes it: times of day with the same minutes ("9:00, 18:00") or a cron.
  const cronOf = text => {
    const s = text.trim();
    if (/^\S+( \S+){4}$/.test(s) && !/:/.test(s)) return s;
    const times = s.split(/[,;\s]+/).filter(Boolean).map(x => /^(\d{1,2}):(\d{2})$/.exec(x));
    if (!times.length || times.some(m => !m || +m[1] > 23 || +m[2] > 59)) return null;
    const mins = new Set(times.map(m => +m[2]));
    return mins.size === 1 ? `${[...mins][0]} ${[...new Set(times.map(m => +m[1]))].sort((x, y) => x - y).join(',')} * * *` : null;
  };
  const timesOf = cron => {
    const m = /^(\d{1,2}) ([\d,]+) \* \* \*$/.exec(cron || '');
    return m ? m[2].split(',').map(h => `${h}:${m[1].padStart(2, '0')}`).join(', ') : (cron || '');
  };
  // The schedule in words for the title: its times, "every hour at :48" or "every 3 h from 0:48"; another cron as it is.
  const scheduleWords = cron => {
    const m = /^(\d{1,2}) (\*|\d{1,2}(?:-\d{1,2})?)(?:\/(\d{1,2}))? \* \* \*$/.exec(cron || '');
    const all = m?.[2] === '*', [from, to] = all ? [0] : (m?.[2].split('-') ?? []);
    if (!m || (!all && to === undefined && !m[3])) return timesOf(cron);
    const mm = m[1].padStart(2, '0'), step = +(m[3] || 1);
    const words = step === 1 ? t('launch.hourly', mm) : t('launch.everyH', step, `${+from}:${mm}`);
    return to === undefined ? words : `${words} – ${+to}:${mm}`;
  };
  // An executor's mark: its app's logo, with the app, model and effort on hover.
  // A model as people call it: claude-opus-5-5 is Claude Opus 5.5; other apps' names are as they are.
  const modelName = m => m?.replace(/^claude-([a-z]+)-(\d+)-(\d+)$/, (_, n, a, b) => `Claude ${n[0].toUpperCase()}${n.slice(1)} ${a}.${b}`) ?? m;
  const appMark = (app, model, effort, pc) => `<span class="app-mark" data-tip="${esc([APP_NAMES[app] ?? app, pc, modelName(model), effort].filter(Boolean).join(' · '))}">${APP_LOGOS[app] ?? esc(APP_NAMES[app] ?? app)}</span>`;
  // Antigravity names a model with its effort ("Gemini 4 Neon (High)"): its row picks the model and the
  // effort apart, as the other apps' do, and keeps them as Antigravity's one name. A model with no
  // efforts ("Orchestrator (Neon)") has none to pick.
  const AG_LEVELS = ['Low', 'Medium', 'High', 'XHigh', 'Max'];
  const agParts = m => {
    const x = /^(.*) \(([^)]+)\)$/.exec(m || '');
    const level = x && AG_LEVELS.find(l => l.toLowerCase() === x[2].toLowerCase());
    return level ? [x[1], level] : [m || '', null];
  };
  const agEffortHtml = (models, base, level) => {
    const levels = AG_LEVELS.filter(l => models.some(m => { const [b, x] = agParts(m); return b === base && x === l; }));
    const pick = levels.includes(level) ? level : levels.includes('Medium') ? 'Medium' : levels[0];
    return `<select class="ex-effort ag-effort" data-tip="${esc(t('launch.effort'))}"${levels.length ? '' : ' disabled'}>${levels.length
      ? levels.map(x => `<option${x === pick ? ' selected' : ''}>${x}</option>`).join('') : '<option value="">—</option>'}</select>`;
  };
  const agModelsOf = (apps, model) => [...new Set([...(apps.antigravity?.models ?? []), ...(model ? [model] : [])])];
  const agModelHtml = (e, models) => {
    const [base, level] = agParts(e.model), bases = [...new Set(models.map(m => agParts(m)[0]))];
    return `<select class="ex-model ag-model" data-tip="${esc(t('launch.agModelTip'))}"><option value="">${esc(t('launch.agDefault'))}</option>${bases.map(b => `<option value="${esc(b)}"${b === base ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select>`
      + agEffortHtml(models, base, level);
  };
  const exRow = (e, apps) => {
    const grok = e.app === 'grok', models = [...new Set([...(apps[e.app]?.models ?? []), ...(e.model ? [e.model] : [])])];
    // Grok Bot: its bot by name (as the computers read them); one not among them by its id.
    const bots = apps.grok?.bots ?? [], botOpts = [...bots, ...(e.bot_id && !bots.some(b => b.id === e.bot_id) ? [{ id: e.bot_id, name: e.bot_id }] : [])];
    const model = grok ? (botOpts.length
      ? `<select class="ex-bot" data-tip="${esc(t('launch.inBot'))}"><option value="" disabled hidden${e.bot_id ? '' : ' selected'}>${esc(t('launch.pickBot'))}</option>${botOpts.map(b => `<option value="${esc(b.id)}"${b.id === e.bot_id ? ' selected' : ''}>${esc(b.name || b.id)}</option>`).join('')}</select>`
      : `<input class="ex-bot" value="${esc(e.bot_id || '')}" placeholder="${esc(t('launch.bot'))}" maxlength="128" data-tip="${esc(t('launch.inBot'))}">`)
      : e.app === 'antigravity' ? agModelHtml(e, models)
      : `<select class="ex-model" data-tip="${esc(t('launch.modelTip'))}"><option value="">${esc(t('launch.anyModel'))}</option>${models.map(m => `<option value="${esc(m)}"${m === e.model ? ' selected' : ''}>${esc(modelName(m))}</option>`).join('')}</select>`
        + `<select class="ex-effort" data-tip="${esc(t('launch.effort'))}"><option value="">${esc(t('launch.anyModel'))}</option>${EFFORTS.map(x => `<option${x === e.effort ? ' selected' : ''}>${x}</option>`).join('')}</select>`;
    if (e.missing) return `<div class="ex-row missing" data-app="${esc(e.app)}" data-tip="${esc(t('launch.notInstalled', APP_NAMES[e.app] ?? e.app, e.missing))}">
      <div class="ex-top">${APP_LOGOS[e.app] ?? ''}<b class="ex-app">${esc(APP_NAMES[e.app] ?? e.app)}</b></div></div>`;
    return `<div class="ex-row" data-app="${esc(e.app)}">
      <div class="ex-top"><span class="ex-grip" draggable="true" data-tip="${esc(t('launch.drag'))}">⋮⋮</span>${APP_LOGOS[e.app] ?? ''}<b class="ex-app">${esc(APP_NAMES[e.app] ?? e.app)}</b><input type="checkbox" class="switch ex-on"${e.enabled === false ? '' : ' checked'}></div>
      <div class="ex-fields">${model}</div>
      ${grok || e.app === 'antigravity' ? '' : `<div class="ex-checks">
      <label data-tip="${esc(t('launch.newChatTip'))}"><input type="checkbox" class="ex-new"${e.new_chat === false ? '' : ' checked'}>${esc(t('launch.newChat'))}</label>
      <label data-tip="${esc(t('launch.fullTip'))}"><input type="checkbox" class="ex-full"${e.full_access === false ? '' : ' checked'}>${esc(t('launch.full'))}</label></div>`}</div>`;
  // Grok Bot and Antigravity have no ticks: Goalcraft can't choose for them (their model's hint says so).
  };
  // The executors shown for a computer: the role's own, in their order, that this computer has, then the
  // other apps it has, off. The role's executors of apps it doesn't have are kept as they are.
  const shownExecutors = (l, pc) => {
    const has = pc ? new Set(pc.apps) : new Set(APPS);
    return [...l.executors.filter(e => has.has(e.app)), ...APPS.filter(x => has.has(x) && !l.executors.some(e => e.app === x))
      .map(app => ({ app, enabled: false, effort: app === 'antigravity' || app === 'grok' ? null : 'medium' })),
      // Every app Goalcraft can start is listed: one this computer lacks greyed, with nothing to set.
      ...APPS.filter(x => !has.has(x)).map(app => ({ app, missing: pc.name }))];
  };
  // The role's executors with the ones shown as the person set them: those shown take, in the order shown,
  // the places the shown apps had; the others keep theirs.
  const merged = (all, shown) => {
    const apps = new Set(shown.map(x => x.app)), next = [...shown];
    const out = all.map(x => (apps.has(x.app) ? next.shift() : x));
    return [...out, ...next];
  };
  // How the executors take turns, under them: its name says the mode it is in (In order, or Evenly by
  // the quotas), and its hint what that is and what the switch turns it to.
  const modeHtml = (even, limit) => `<label class="l-row l-mode" data-tip="${esc(t(even ? 'launch.evenTip' : 'launch.orderTip', limit))}"><input type="checkbox" class="switch l-even"${even ? ' checked' : ''}><span>${esc(t(even ? 'launch.even' : 'launch.inOrder'))}</span></label>`;
  // Launch's line says when the role runs: "Launch · 9:00, 18:00" on schedule, "Paused" with the
  // schedule off (the role waits on pause; Run now still starts it).
  // Spare's hint: what on and what off mean, each on its own line, the way it is now first.
  const spareTip = on => (on ? ['launch.spareOn', 'launch.spareOff'] : ['launch.spareOff', 'launch.spareOn']).map(k => t(k)).join('\n');
  const launchTitle = (on, schedule) => (on && schedule ? `${t('launch.title')} · ${scheduleWords(schedule)}` : t('launch.paused'));
  function launchHtml(a) {
    if (!opts.onLaunch) return '';
    // Every agent has Launch: one Goalcraft doesn't start yet opens on pause, with no executor on, and
    // becomes a role on its first save.
    const l = a.launch ??= { schedule: null, schedule_on: false, mode: 'priority', quota_limit: 95, computer: null, guide_url: null, executors: [] };
    const apps = opts.launchApps?.() ?? {}, pcs = opts.launchComputers?.() ?? [];
    // The main computer: the one chosen, else the first one set up.
    const main = pcs.find(c => c.name === l.computer) ?? pcs[0];
    // Computer, its list and, with more than one, Spare: another computer takes the start while this one
    // is off (off by default: the start waits for it).
    const computer = pcs.length > 1
      ? `<div class="l-row l-pc"><span data-tip="${esc(t('launch.computerTip'))}">${esc(t('launch.computer'))}</span><select class="l-computer">${pcs.map(c => `<option value="${esc(c.name)}"${c === main ? ' selected' : ''}>${esc(c.name)}${c.on ? '' : ` (${esc(t('launch.off'))})`}</option>`).join('')}</select>`
        + `<label class="l-spare" data-tip="${esc(spareTip(l.computer_fallback))}"><input type="checkbox" class="switch l-fallback"${l.computer_fallback ? ' checked' : ''}>${esc(t('launch.spare'))}</label></div>`
      : pcs.length ? `<p class="l-row l-one">${esc(t('launch.computer'))}: ${esc(pcs[0].name)}</p>` : '';
    const guide = l.guide_url ? `<a class="launch-guide" href="${esc(l.guide_url)}" target="_blank" rel="noopener" data-tip="${esc(t('launch.guideTip'))}">${NOTE_ICON}<span>${esc(t('launch.guide'))}</span></a>` : '';
    return `<div class="launch"><details class="launch-box"><summary><span class="l-title fold-title">${esc(launchTitle(l.schedule_on, l.schedule))}</span></summary>
      <div class="l-row"><label class="l-sched" data-tip="${esc(t('launch.scheduleTip'))}"><input type="checkbox" class="switch l-on"${l.schedule_on && l.schedule ? ' checked' : ''}>${esc(t('launch.schedule'))}</label>${guide}</div>
      <input class="l-times" value="${esc(timesOf(l.schedule))}" placeholder="${esc(t('launch.times'))}">
      <p class="pop-note l-free"${l.schedule && l.schedule_on ? ' hidden' : ''}>${esc(t('launch.noSchedule'))}</p>
      ${computer}
      <div class="ex-list">${shownExecutors(l, main).map(e => exRow(e, apps)).join('')}</div>
      ${modeHtml(l.mode === 'even', Number(l.quota_limit ?? 95))}
    </details><div class="pop-msg l-msg"></div></div>`;
  }
  function bindLaunch(a) {
    const box = pop.querySelector('.launch');
    if (!box) return;
    const l = a.launch, msg = box.querySelector('.l-msg'), list = box.querySelector('.ex-list');
    const apps = opts.launchApps?.() ?? {}, pcs = opts.launchComputers?.() ?? [];
    const say = (text, ok) => { msg.textContent = text; msg.className = 'pop-msg l-msg' + (ok ? ' ok' : ''); };
    // Antigravity's model and effort go back together as its one name ("Gemini 4 Neon (High)").
    const modelOf = r => {
      const m = r.querySelector('.ex-model')?.value || null, x = r.querySelector('.ex-effort')?.value || null;
      return r.dataset.app === 'antigravity' ? { model: m && x ? `${m} (${x})` : m, effort: null } : { model: m, effort: x };
    };
    const read = r => ({
      app: r.dataset.app, enabled: r.querySelector('.ex-on').checked, ...modelOf(r), new_chat: r.querySelector('.ex-new')?.checked ?? false,
      full_access: r.querySelector('.ex-full')?.checked ?? true, bot_id: r.querySelector('.ex-bot')?.value.trim() || null,
    });
    box.querySelector('.l-on').addEventListener('change', e => { box.querySelector('.l-free').hidden = e.target.checked; });
    // Another Antigravity model: the efforts it has, the one picked kept when it has it too.
    list.addEventListener('change', e => {
      if (!e.target.matches('.ag-model')) return;
      const effort = e.target.closest('.ex-row').querySelector('.ag-effort');
      effort.outerHTML = agEffortHtml(agModelsOf(apps, l.executors.find(x => x.app === 'antigravity')?.model), e.target.value, effort.value);
    });
    // A switch says on hover what clicking it does: Turn on, or Turn off; at once after a click too.
    const switchTip = el => {
      el.dataset.tip = t(el.checked ? 'launch.turnOff' : 'launch.turnOn');
      if (el.matches(':hover') && !tip.hidden && tip.classList.contains('over')) tip.textContent = el.dataset.tip;
    };
    box.querySelectorAll('input.switch').forEach(switchTip);
    box.addEventListener('change', e => { if (e.target.matches('input.switch')) switchTip(e.target); });
    // The mode's name and hint follow its switch.
    box.querySelector('.l-even').addEventListener('change', e => {
      const row = e.target.closest('.l-mode'), limit = Number(l.quota_limit ?? 95);
      row.querySelector('span').textContent = t(e.target.checked ? 'launch.even' : 'launch.inOrder');
      row.dataset.tip = t(e.target.checked ? 'launch.evenTip' : 'launch.orderTip', limit);
    });
    box.querySelector('.l-fallback')?.addEventListener('change', e => { e.target.closest('.l-spare').dataset.tip = spareTip(e.target.checked); });
    // Another main computer: its apps, keeping what was set for the ones shown.
    box.querySelector('.l-computer')?.addEventListener('change', e => {
      l.executors = merged(l.executors, [...list.querySelectorAll('.ex-row:not(.missing)')].map(read));
      list.innerHTML = shownExecutors(l, pcs.find(c => c.name === e.target.value)).map(x => exRow(x, apps)).join('');
      list.querySelectorAll('input.switch').forEach(switchTip);
    });
    // Order by dragging a row by its handle.
    let dragged = null;
    list.addEventListener('dragstart', e => {
      dragged = e.target.closest('.ex-row');
      if (!dragged) return;
      dragged.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', dragged.dataset.app); e.dataTransfer.setDragImage(dragged, 12, 12); } catch {}
    });
    list.addEventListener('dragover', e => {
      if (!dragged) return;
      e.preventDefault();
      const over = e.target.closest('.ex-row:not(.missing)');  // the apps not installed stay last
      if (!over || over === dragged) return;
      const r = over.getBoundingClientRect();
      list.insertBefore(dragged, e.clientY > r.top + r.height / 2 ? over.nextSibling : over);
    });
    list.addEventListener('drop', e => e.preventDefault());
    list.addEventListener('dragend', () => { if (!dragged) return; dragged.classList.remove('dragging'); dragged = null; save(); });
    // Every change is saved at once (no Save button): a switch, a list, the times once typed (on
    // leaving the field or Enter), the order once dropped. Saves go one after another.
    let saving = Promise.resolve();
    const save = () => (saving = saving.then(saveNow));
    box.addEventListener('change', save);
    const saveNow = async () => {
      const on = box.querySelector('.l-on').checked, text = box.querySelector('.l-times').value;
      const schedule = text.trim() ? cronOf(text) : null;
      if (text.trim() && !schedule) return say(t('launch.badTimes'));
      if (schedule && cronMinGap(schedule) < MIN_GAP) return say(t('launch.tooOften', MIN_GAP));
      // Those of apps the main computer doesn't have stay as they are, in their places.
      const executors = merged(l.executors, [...list.querySelectorAll('.ex-row:not(.missing)')].map(read));
      if (!executors.some(x => x.enabled)) return say(t('launch.noExecutors'));
      const grokOff = executors.find(x => x.app === 'grok' && x.enabled && !x.bot_id);
      if (grokOff) return say(t('launch.botNeeded'));
      const patch = { schedule, schedule_on: on && !!schedule, mode: box.querySelector('.l-even').checked ? 'even' : 'priority' };
      const pc = box.querySelector('.l-computer');
      if (pc) Object.assign(patch, { computer: pc.value, computer_fallback: box.querySelector('.l-fallback').checked });
      const error = await opts.onLaunch(a, patch, executors);
      if (!error) {
        Object.assign(l, patch, { executors });
        box.querySelector('.l-title').textContent = launchTitle(l.schedule_on, l.schedule);
      }
      // Saved as it changes: only what went wrong is said.
      say(error || '');
    };
    // Run now sits beside Send and the chat's icon: it starts the role; what came of it is said there.
    pop.querySelector('.write .l-run')?.addEventListener('click', async e => {
      e.preventDefault(); e.stopPropagation();
      const link = e.currentTarget, note = link.closest('.write').querySelector('.pop-msg');
      const tell = (text, ok) => { note.textContent = text; note.className = 'pop-msg' + (ok ? ' ok' : ''); };
      if (link.classList.contains('busy')) return;
      if (!a.launch.executors.some(x => x.enabled !== false)) return tell(t('launch.noExecutors'));
      link.classList.add('busy');
      const error = await opts.onRunNow(a);
      link.classList.remove('busy');
      // Taken: the link gives way to where the start is; it comes back when the run is over.
      if (!error || error === 'busy' || /duplicate|unique/i.test(error)) {
        link.outerHTML = `<span class="l-run-state">${esc(error ? t('launch.waiting') : t('launch.inQueue'))}</span>`;
        return tell('');
      }
      tell(error);
    });
  }

  // The runs list: when each run started, how long it took (or that it is still going) and what it
  // added to the items its zone works into.
  // What a run found or added, as a link to the conversation it was worked in (when its agent sent
  // one), saying on hover which app and conversation that is.
  // A run's app, by its icon: a link to the conversation it was worked in (when its agent sent one),
  // saying on hover the app, model, effort and conversation ("The agent works in the ChatGPT (Codex)
  // app · gpt-6.2-sol · medium · conversation 01a2…"); without one, the app, model and effort.
  const APP_OF_URL = [[/^codex:/i, 'codex'], [/^claude:/i, 'claude'], [/^antigravity:/i, 'antigravity'], [/^grokbot:/i, 'grok']];
  // A chat's app icon, opening the chat, with where it is on hover: the app and the conversation, the
  // computer (when there are several), the model and effort. On another computer it opens only there:
  // greyed, it says so. The same in a past run's row and beside a card's Send.
  const runApp = (a, r, app, model, effort, awayHere = null) => {
    const url = r.chat_url;
    app = app ?? APP_OF_URL.find(([re]) => re.test(url || ''))?.[1];
    if (!app) return '';
    const pcs = opts.launchComputers?.() ?? [], pcName = r.launch?.computer ?? awayHere?.name ?? null;
    const pc = pcName && pcs.length > 1 ? t('board.onComputer', pcName) : '';
    const pcOs = r.launch?.computer ? pcs.find(c => c.name === r.launch.computer)?.os : awayHere?.os;
    const away = opts.live && !!(pcName || pcOs) && !!awayFrom({ name: pcName, os: pcOs });
    const logo = APP_LOGOS[app] ?? esc(APP_NAMES[app] ?? app);
    if (!url || !opts.live) return appMark(app, model, effort, pc);
    const inAntigravity = /^antigravity:/i.test(url), inGrokBot = /^grokbot:/i.test(url);
    const base = agentInfo(a.agent, { provider: a.provider, chat: url, app });
    const info = inAntigravity ? { ...base, product: 'Antigravity', app: null } : inGrokBot ? { ...base, product: 'Grok Bot' } : base;
    const link = chatLink(info, url);
    if (!link) return appMark(app, model, effort, pc);
    const [where, ...rest] = whereTip(url, info, inAntigravity).split(' · ');
    const tip = [where, pc, modelName(model), effort, ...rest].filter(Boolean).join(' · ');
    if (away) return `<span class="app-mark run-chat off" aria-disabled="true" data-tip="${esc(tip + '\n' + t('board.chatOnlyThere', pcName))}">${logo}</span>`;
    return `<a class="app-mark run-chat" href="${esc(link)}" ${opens(link, webOf(url, info))} data-tip="${esc(tip)}">${logo}</a>`;
  };
  // A card's chat as its app icon beside Send (the agent's chat, or a question's), as in its past runs.
  const chatIcon = (a, url, run, pc) => (url ? runApp(a, { chat_url: url, launch: { computer: run?.computer ?? null } }, run?.app, run?.model, run?.effort, run?.computer ? null : pc) : '');
  // The last week's spending, in dollars at API prices (tokens when no price is known), with the tokens
  // by kind on hover. No share of a plan's limit: a role may work on several apps, each with its own.
  const weekLine = u => {
    if (!u || !counted(u)) return '';
    const tip = [u.cost != null && t('board.usageCost', fmtCost(u.cost)), usageTip(u, null)].filter(Boolean).join('\n');
    const what = u.cost != null ? fmtCost(u.cost) : t('board.tokens', fmtTokens(u.tokens));
    return `<span class="usage" data-tip="${esc(tip)}">${esc(t('board.usageDay', ''))}<span class="week-cost">${esc(what)}</span></span>`;
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
      list.innerHTML = `<div class="pop-loading" role="status" aria-label="${esc(t('board.loading'))}"></div>`;
      try {
        const rows = await opts.runs(a);
        // A run today shows its time; an earlier one its day too ("пн, 21:14"): the list covers a week.
        const st = a.f.stages, hm = new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' });
        const dayHm = new Intl.DateTimeFormat(lang, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
        const today = new Date().toDateString();
        const when = { format: d => (d.toDateString() === today ? hm : dayHm).format(d) };
        // Each run at API prices; hovering one shows its tokens by kind.
        list.innerHTML = (rows.length ? rows.map(r => {
          // A scheduled run with the short ones after it (answers to messages): their time added up.
          const took = r.ended_at ? fmtDuration(r.took ?? (Date.parse(r.ended_at) - Date.parse(r.started_at)) / 1000) : t('board.runNow');
          const tookTip = r.parts > 1 ? ` data-tip="${esc(t('board.runParts', r.parts))}"` : '';
          // A run says only how it ended: a supervisor's run, what it found (its final word, the summary on
          // hover); a worker's, what it added. A run Goalcraft started that went silent or did not start
          // says that instead, in amber with a sign, what happened on hover.
          const end = r.launch?.outcome, bad = end === 'silent' ? t('launch.silent') : end === 'not_started' ? t('launch.notStarted') : end === 'failed' ? t('launch.failed') : '';
          const badTip = [end === 'silent' ? t('launch.silentTip', r.launch?.computer) : end === 'not_started' ? t('launch.notStartedTip', r.launch?.computer) : '',
            !a.sup && r.added ? t('launch.addedBefore', `+${fmtCount(r.added)} ${plural(r.added, r.zone < st.length ? st[r.zone].forms : a.f.result)}`) : ''].filter(Boolean).join('\n');
          const found = bad ? `<span class="run-bad"${badTip ? ` data-tip="${esc(badTip)}"` : ''}>⚠ ${esc(bad)}</span>`
            : a.sup ? (r.status ? supStatus(r.status, r.summary) : '')
            : `<span${r.summary ? ` data-tip="${esc(r.summary)}"` : ''}><b class="run">+${fmtCount(r.added)}</b> ${esc(plural(r.added, r.zone < st.length ? st[r.zone].forms : a.f.result))}</span>`;
          const ru = r.usage;
          const tok = ru && counted(ru) ? `<span class="tok" data-tip="${esc(usageTip(ru, null))}">${esc(
            ru.cost != null ? fmtCost(ru.cost) : t('board.tokens', fmtTokens(ru.tokens)))}</span>` : '<span class="tok"></span>';
          // On which app and model (a run Goalcraft didn't start: the app its tokens were counted on).
          const app = r.app ?? ru?.app;
          const by = `<span class="by">${runApp(a, r, app, r.model ?? ru?.model, r.launch?.effort)}</span>`;
          return `<div class="run-row"><span class="at">${esc(when.format(new Date(r.started_at)))}</span><span class="took"${tookTip}>${esc(took)}</span>
            <span>${found}</span>${by}${tok}</div>`;
        }).join('') : `<div class="pop-note">${esc(t('board.noRuns'))}</div>`);
        // The week's cost starts where the runs' costs do: its "$" over theirs.
        const weekCost = pop.querySelector('.runs-day .week-cost'), costCell = list.querySelector('.run-row .tok');
        if (weekCost && costCell) weekCost.style.minWidth = (list.getBoundingClientRect().right - costCell.getBoundingClientRect().left) + 'px';
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
      msg.textContent = t('board.messageSent', a.name || (a.sup ? t('board.supervisorName', a.f.title) : agentInfo(a.agent, { provider: a.provider, chat: a.chat, app: a.usage?.app }).name)); msg.className = 'pop-msg ok';
      // The demo has no agent to read it: a moment later it answers back as a real one would.
      if (!opts.live) setTimeout(() => { a.replies = [...(a.replies || []), { id: 'demo-' + Date.now(), question: null, answer: text, reply: t('demo.reply') }]; }, 1500);
    });
  }

  function bindAnswer(a) {
    // The open question's box takes the cursor; a folded one takes it as it opens.
    pop.querySelector('details.ask-item[open] .answer')?.focus();
    pop.querySelectorAll('details.ask-item').forEach(d => d.addEventListener('toggle', () => { if (d.open) d.querySelector('.answer')?.focus(); }));
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
        (block.closest('.ask-item') ?? block).remove();
        // The demo has no agent to reply: a moment later it answers back as a real one would.
        if (!opts.live) setTimeout(() => { a.replies = [...(a.replies || []), { id: 'demo-' + Date.now(), question: asked, answer: text, reply: t('demo.reply') }]; }, 1200);
        if (a.questions.length) return;
        // None left: the block goes, the card stays; a waiting agent takes the answers at once.
        pop.querySelector('.asks')?.remove();
        pop.querySelector('.write')?.removeAttribute('hidden');
        if (a.state !== 'sleep') a.state = 'work';
      });
    });
  }

  // What an agent is doing now, and the card's title that says it: its name with a moon or a bolt
  // while it sleeps or works, in words otherwise (starting or finishing a shift, overdue, silent).
  const agentState = a => a.state === 'pause' ? 'board.paused' : scene.overdue(a) ? 'board.overdue' : scene.lost(a) ? 'board.lost' : a.state === 'ask' ? 'board.asking' : a.state === 'sleep' ? 'board.resting'
    : a.state === 'walk' ? (a.to === 'work' ? 'board.starting' : 'board.finished')
      : 'board.working';
  function agentTitle(a, named) {
    const state = agentState(a), who = esc(named), said = stateTip(a, named);
    return STATE_ICONS[state]
      ? `${who}<span class="state-icon ${{ 'board.resting': 'sleep', 'board.paused': 'pause' }[state] ?? 'work'}" role="img" data-tip="${esc(said)}" aria-label="${esc(said)}">${STATE_ICONS[state]}</span>`
      : t(state, who);
  }
  // Asleep on time: when it wakes up, on its moon's hint under its state.
  const wakesText = a => {
    const left = scene.sleepLeft(a);
    return a.state === 'sleep' && !scene.overdue(a) && left > 0 ? t('board.wakesIn', fmtDuration(left)) : '';
  };
  const stateTip = (a, named) => [t(agentState(a), named), wakesText(a)].filter(Boolean).join('\n');
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
    // The time to its wake-up counts down in its moon's hint, also while it shows.
    const icon = el.querySelector('.state-icon'), said = stateTip(popAgent.a, popAgent.named);
    if (icon && icon.dataset.tip !== said) {
      const shown = icon.matches(':hover') && !tip.hidden && tip.textContent === icon.dataset.tip;
      icon.dataset.tip = said; icon.setAttribute('aria-label', said);
      if (shown) tip.textContent = said;
    }
  }, 500);

  // The width a card or tooltip has on the screen: the page's, without a scrollbar; the window's
  // (innerWidth) can be wider than what is seen, and a card set by it would stick out on the right.
  function viewW() { return document.documentElement.clientWidth || window.innerWidth; }
  function showPop(e, html) {
    pop.classList.remove('wide');
    pop.innerHTML = `<button class="close" aria-label="${esc(t('board.close'))}">×</button>` + html;
    pop.querySelector('.close').addEventListener('click', hidePop);
    pop.hidden = false;
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    pop.style.left = Math.max(8, Math.min(viewW() - pw - 8, e.clientX - pw / 2)) + 'px';
    pop.style.top = Math.max(8, Math.min(window.innerHeight - ph - 8, e.clientY + 14)) + 'px';
  }
  function hidePop() { pop.hidden = true; tip.hidden = true; }
  // A card grows after it opens (its runs, a chart, folded questions), or the window shrinks: it
  // moves up and left as much as it needs to stay whole on the screen.
  const keepPop = () => {
    if (pop.hidden) return;
    const top = parseFloat(pop.style.top) || 0, left = parseFloat(pop.style.left) || 0, h = pop.offsetHeight, w = pop.offsetWidth;
    if (top + h > window.innerHeight - 8) pop.style.top = Math.max(8, window.innerHeight - h - 8) + 'px';
    if (left + w > viewW() - 8) pop.style.left = Math.max(8, viewW() - w - 8) + 'px';
  };
  new ResizeObserver(keepPop).observe(pop);
  window.addEventListener('resize', keepPop);
  // A cost in the card shows its tokens by kind on hover, in the board's tooltip.
  // Every hint in a card is the board's own (data-tip), not the browser's (title): that one waits
  // for the mouse to stand still, often for seconds, and hides on its own. This shows a tenth of a
  // second after the mouse comes onto the thing, and follows it.
  let tipFor = null, tipAt = null, tipWait = 0;
  const placeTip = () => {
    tip.style.left = Math.max(8, Math.min(viewW() - tip.offsetWidth - 8, tipAt.x + 14)) + 'px';
    tip.style.top = Math.min(window.innerHeight - tip.offsetHeight - 8, tipAt.y + 18) + 'px';
  };
  const dropTip = () => { clearTimeout(tipWait); tipFor = null; if (tip.classList.contains('over')) tip.hidden = true; };
  const tipMove = e => {
    const el = e.target.closest('[data-tip]');
    if (!el || e.pointerType === 'touch') return dropTip();
    tipAt = { x: e.clientX, y: e.clientY };
    // The same thing, or the same hint on its redrawn copy (the card's title redraws as the agent goes
    // on): it stays and moves with the mouse.
    const shown = !tip.hidden && tip.classList.contains('over');
    if (el === tipFor || (shown && tip.textContent === el.dataset.tip)) { tipFor = el; if (shown) placeTip(); return; }
    dropTip(); tipFor = el;
    tipWait = setTimeout(() => {
      if (tipFor !== el || !el.isConnected) return;
      tip.textContent = el.dataset.tip; tip.classList.add('over'); tip.hidden = false; placeTip();
    }, 100);
  };
  for (const el of [pop, spendBtn].filter(Boolean)) {
    el.addEventListener('pointermove', tipMove);
    el.addEventListener('pointerleave', dropTip);
  }
  spendBtn?.addEventListener('pointerdown', dropTip);
  // Stop or start a computer's wake script (its button in the scripts list): saved at once, the list
  // and the Spending button's dot redrawn; the script itself follows on its next check.
  pop.addEventListener('click', async e => {
    const b = e.target.closest('.script-btn');
    if (!b || b.disabled || !opts.stopWakeScript) return;
    b.disabled = true;
    const stop = b.dataset.stop === '1';
    try { await opts.stopWakeScript(b.dataset.key, stop); }
    catch (err) { console.error(err); b.disabled = false; return; }
    const c = lastScripts?.computers?.find(x => x.id === b.dataset.key);
    if (c) c.stopped = stop;
    const block = pop.querySelector('details.scripts');
    if (block && lastScripts) {
      spendState.scriptsOpen = block.open;  // it stays open as it was
      block.outerHTML = scriptsBlock(lastScripts);
      pop.querySelector('details.scripts')?.addEventListener('toggle', ev => { spendState.scriptsOpen = ev.target.open; });
    }
    dropTip();
    markScripts(lastScripts);
  });
  // The scripts' dot on the Spending button: now, and again with every new data (setFunnels).
  checkScripts();
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
      scene = new Scene(canvas, next, { live: opts.live, heaps: scene.heaps, grow: scene.grow, from: scene });
      loadOrder();
      scene.resize(scale, window.devicePixelRatio || 1);
      layout();
      buildTitles();
      checkScripts();
      return true;
    },
  };
}
