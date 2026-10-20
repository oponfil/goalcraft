// The dashboard page around the scene: sticky funnel titles, drag to reorder, popups.
// Shared by the demo (src/main.js) and the person's own funnels (src/live.js).
import { agentInfo, agentButton, chatLink, plural } from './data.js?v=d344de2b';
import { Scene, CW, fmtCount, fmtDuration } from './scene.js?v=d344de2b';
import { t, lang } from './i18n.js?v=d344de2b';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
// Web chats open in a new tab; app links (claude://, codex://) hand over to the app without an
// empty tab and remember the web chat to fall back to.
const webOf = (url, info) => (/^https?:/.test(url || '') ? url : info.chat);
const opens = (url, web) => (/^https?:/.test(url) ? 'target="_blank" rel="noopener"' : `data-web="${esc(web)}"`);

// No app on this computer: the app link does nothing and the page keeps the focus, so after a
// moment the web chat opens instead.
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
  let scene = new Scene(canvas, funnels, { live: opts.live });

  // Funnel order is the viewer's own arrangement, kept in this browser only.
  const ORDER_KEY = opts.orderKey || 'goalcraft-order';
  const loadOrder = () => {
    try { const saved = JSON.parse(localStorage.getItem(ORDER_KEY)); if (Array.isArray(saved)) scene.applyOrder(saved); } catch {}
  };
  const saveOrder = () => { try { localStorage.setItem(ORDER_KEY, JSON.stringify(scene.order())); } catch {} };
  loadOrder();

  // The scene has a fixed size, the same on every screen: as many funnels show as fit, the rest are
  // reached with horizontal scroll. On a phone one funnel fills the width. The viewer's zoom (the
  // − and + buttons, kept in this browser) scales it.
  const BASE = 1.6, ZOOMS = [0.6, 0.7, 0.8, 0.9, 1, 1.15, 1.3, 1.5, 1.75, 2], ZOOM_KEY = 'goalcraft-zoom';
  let zoom = 1;
  try { const z = Number(localStorage.getItem(ZOOM_KEY)); if (ZOOMS.includes(z)) zoom = z; } catch {}
  const baseScale = () => (scroller.clientWidth < 600 ? scroller.clientWidth / CW : BASE);
  let scale = baseScale() * zoom;
  function layout() {
    if (scene.dpr !== (window.devicePixelRatio || 1)) scene.resize(scale, window.devicePixelRatio || 1);
    scroller.classList.toggle('fits', scene.funnels.length * CW * scale <= scroller.clientWidth);
  }
  window.addEventListener('resize', layout);

  // Zoom, in the top bar next to the logo: − 100% +; a click on the percentage goes back to 100%.
  // The point at the middle of the view stays in the middle.
  const zoomBox = document.createElement('span');
  zoomBox.id = 'zoom';
  zoomBox.innerHTML = `<button type="button" data-d="-1" aria-label="${esc(t('board.zoomOut'))}" title="${esc(t('board.zoomOut'))}">−</button><button type="button" class="pct" data-d="0"></button><button type="button" data-d="1" aria-label="${esc(t('board.zoomIn'))}" title="${esc(t('board.zoomIn'))}">+</button>`;
  document.querySelector('.sitebar .logo').after(zoomBox);
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
    scale = baseScale() * zoom;
    hidePop(); tip.hidden = true;
    scene.resize(scale, window.devicePixelRatio || 1);
    layout(); buildTitles(); zoomButtons();
    scroller.scrollLeft = cx * scale - scroller.clientWidth / 2;
    scroller.scrollTop = cy * scale - scroller.clientHeight / 2;
  });
  // Drawn once the fonts are in: then the loading pickaxe goes (see .loader in dashboard.css).
  const ready = () => requestAnimationFrame(() => document.body.classList.add('ready'));
  if (document.fonts) document.fonts.ready.then(() => { scene.resize(scale, window.devicePixelRatio || 1); ready(); });
  else ready();
  layout();

  // Sticky header: one title per funnel column, kept aligned with the scene while it scrolls.
  // A red badge shows how many questions in that funnel wait for you, an amber one how many of its
  // agents have not been heard from in time (the warning triangles).
  function buildTitles() {
    track.innerHTML = scene.funnels.map((f, fi) =>
      `<div class="col-title" data-fi="${fi}" style="left:${fi * CW * scale}px;width:${CW * scale}px">
        <span class="name">${esc(f.title)}</span><span class="badge" hidden></span><span class="badge warn" hidden></span></div>`).join('');
    const h = track.parentElement.clientHeight / scale;
    track.querySelectorAll('.col-title').forEach(el => {
      el.style.backgroundImage = `url(${scene.titleStrip(+el.dataset.fi, h).toDataURL()})`;
    });
  }
  function syncTitles() {
    track.style.transform = `translateX(${canvas.getBoundingClientRect().left - track.parentElement.getBoundingClientRect().left}px)`;
    track.querySelectorAll('.col-title').forEach(el => {
      const f = scene.funnels[+el.dataset.fi], n = scene.waitingFor(f), badge = el.querySelector('.badge:not(.warn)');
      badge.hidden = !n;
      badge.textContent = n;
      badge.title = n ? t('board.waiting', n) : '';
      const s = scene.silentIn(f), warn = el.querySelector('.badge.warn');
      warn.hidden = !s;
      warn.textContent = s;
      warn.title = s ? t('board.silent', s) : '';
    });
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

  // Drag a funnel by its title in the header to reorder.
  let drag = null;
  track.addEventListener('pointerdown', e => {
    const el = e.target.closest('.col-title');
    if (!el) return;
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
    canvas.style.cursor = h && h.type !== 'stage' ? 'pointer' : 'default';
    // A tank shows only its number and flow; what it holds pops up on hover. The sheet on top says
    // where the list it opens is kept.
    if (!['stage', 'source', 'guide'].includes(h?.type) || e.pointerType === 'touch') return (tip.hidden = true);
    showTip(e, h);
  });
  let tipTimer;
  function showTip(e, h) {
    if (h.type === 'source') tip.textContent = t('board.sheet', sheetPlace(h.url));
    else if (h.type === 'guide') tip.textContent = t('board.guide', sheetPlace(h.url));
    else {
      const s = scene.funnels[h.fi].stages[h.j], label = plural(s.count, s.forms);
      tip.textContent = label.charAt(0).toUpperCase() + label.slice(1);
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
      ['onedrive.live.com', 'Excel'], ['sharepoint.com', 'Excel'], ['dropbox.com', 'Dropbox']];
    return known.find(([d]) => host === d || host.endsWith('.' + d))?.[1] ?? host;
  }

  canvas.addEventListener('click', e => {
    const h = scene.hitTest(...toLogical(e));
    if (!h) return hidePop();
    // On a phone there is no hover: a tap on a tank shows what it holds for a moment.
    if (h.type === 'stage') {
      hidePop(); showTip(e, h);
      clearTimeout(tipTimer); tipTimer = setTimeout(() => { tip.hidden = true; }, 2000);
      return;
    }
    // The sheets on top open the funnel's list straight away.
    if (h.type === 'source' || h.type === 'guide') { hidePop(); return window.open(h.url, '_blank', 'noopener'); }
    showPop(e, content(h));
    bindRuns(h.a);
    if (h.type === 'ask' && opts.onAnswer) bindAnswer(h.a);
    if (h.type === 'agent' && opts.onMessage) bindMessage(h.a);
  });

  // A supervisor's status word in its own colour: all good, bottleneck, recommendation, question.
  // Tokens as "12 млн", "850 тыс.": the person's language, one decimal at most.
  const compact = new Intl.NumberFormat(lang, { notation: 'compact', maximumFractionDigits: 1 });
  const fmtTokens = n => compact.format(n);
  const fmtCost = n => '$' + (n >= 10 ? Math.round(n) : n.toFixed(2));
  const fmtPercent = n => new Intl.NumberFormat(lang, { maximumFractionDigits: 0 }).format(n) + '%';
  const supStatus = s => `<span class="sup-status st-${esc(s)}">${esc(t('board.supStatus.' + s))}</span>`;

  function content(h) {
    // An empty platform: the funnel has no supervisor yet; the Connect page tells how to appoint one.
    if (h.type === 'nosup') {
      return `<div class="pop-title">${esc(t('board.noSupervisor'))}</div>
        <p class="pop-note">${esc(t('board.noSupervisorText'))}</p>
        <a class="btn" href="../connect/#supervisor">${esc(t('board.appointSupervisor'))}</a>`;
    }
    const a = h.a, info = agentInfo(a.agent), f = a.f;
    // own: the agent's own chat, an app link (claude://, codex://) or a web one; web: where to go
    // when the app isn't on this computer.
    const own = a.chat || info.chat, web = webOf(own, info), chat = chatLink(info, own), paint = agentButton(info);
    // Its own name when it gave one; else a supervisor goes by its funnel, a worker by its model.
    const named = a.name || (a.sup ? t('board.supervisorName', f.title) : info.name), who = esc(named);
    // The step it works on, with what this run added (the last run's while it sleeps) to the items
    // it works into: "Job Search: jobs found → +4 applied". The supervisor watches the whole funnel:
    // what its last run found instead ("All good", "Bottleneck: …").
    let where;
    if (a.sup) where = a.status ? `${supStatus(a.status)}${a.summary ? `: ${esc(a.summary)}` : ''}` : esc(t('board.supervisorNoRun'));
    else {
      // The card's number is kept for its runs list, so its running row says the same.
      const st = f.stages, n = a.shownAdded = a.added || 0, from = a.zone < 0 ? '' : `${esc(plural(5, st[a.zone].forms))} → `;
      const into = a.zone === st.length - 1 ? f.result : st[a.zone + 1].forms;
      where = `${from}<b class="run">+${fmtCount(n)}</b> ${esc(plural(n, into))}`;
    }
    // What it spent over the last day, when the person's wake script could read it: tokens, their
    // cost at API prices (Claude), the plan's limit (Codex).
    const u = a.usage, spent = u ? `<p class="pop-note usage">${esc(t('board.usageDay', fmtTokens(u.tokens)))}${
      u.cost != null ? ` · ${esc(t('board.usageCost', fmtCost(u.cost)))}` : ''}${
      u.limit != null ? ` · ${esc(t('board.usageLimit', fmtPercent(u.limit), u.limitDays))}` : ''}</p>` : '';
    // Live only: the agent's last runs, loaded when the person opens them.
    const history = opts.runs ? `<details class="runs"><summary>${esc(t('board.runs'))}</summary><div class="runs-list"></div></details>` : '';
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
      const asks = a.questions.map(q => `<div class="ask" data-qid="${esc(q.id)}"><p>${esc(q.question)}</p>${opts.onAnswer
        ? `<textarea class="answer" rows="3" maxlength="2000" placeholder="${esc(t('board.answer'))}"></textarea>
          <div class="ask-buttons"><button class="btn primary send" style="${paint}">${esc(t('board.send'))}</button>${openBtn(q.chat || web)}</div>
          <div class="pop-msg"></div>` : ''}</div>`).join('');
      const reply = opts.onAnswer ? ''
        : `<a class="btn primary" style="${paint}" href="${esc(chat)}" ${opens(chat, web)}>${esc(t('board.replyIn', info.product || info.name))}</a>`;
      // Standing, the agent is waiting and takes the answer at once; asleep, only on its next run.
      const asleep = a.state === 'sleep', left = scene.sleepLeft(a);
      const when = left > 0 ? fmtDuration(left) : null;
      return `<div class="pop-title">${t(asleep ? 'board.askedAsleep' : 'board.asking', who)}</div>
        <div class="pop-sub">${where}</div>
        ${asleep && !missed ? `<p class="pop-note">${esc(t('board.nextRun', when))}</p>` : ''}${missed}${spent}${asks}${reply}${history}`;
    }
    const lost = scene.lost(a) ? `<p class="pop-note warn">${esc(t('board.lastSignal', fmtDuration(scene.silence(a))))}</p>` : '';
    // Asleep on time: when it wakes up.
    const left = scene.sleepLeft(a);
    const wakes = a.state === 'sleep' && !scene.overdue(a) && left > 0 ? `<p class="pop-note">${esc(t('board.wakesIn', fmtDuration(left)))}</p>` : '';
    const state = scene.overdue(a) ? 'board.overdue' : scene.lost(a) ? 'board.lost' : a.state === 'sleep' ? 'board.resting'
      : a.state === 'walk' ? (a.to === 'work' ? 'board.starting' : 'board.finished')
        : 'board.working';
    // Write to it any time: it reads the message through MCP when it next checks in (at once if it
    // works now, or when the person's wake script wakes it).
    const write = opts.onMessage ? `<div class="write"><textarea class="message" rows="2" maxlength="2000" placeholder="${esc(t('board.message', named))}"></textarea>
        <div class="ask-buttons"><button class="btn primary send-message" style="${paint}">${esc(t('board.sendMessage'))}</button>${chat ? `<a class="btn" href="${esc(chat)}" ${opens(chat, web)}>${esc(t('board.open', info.product || info.name))}</a>` : ''}</div>
        <div class="pop-msg"></div></div>`
      : chat ? `<a class="btn" href="${esc(chat)}" ${opens(chat, web)}>${esc(t('board.open', info.product || info.name))}</a>` : '';
    return `<div class="pop-title">${t(state, who)}</div>
      <div class="pop-sub">${where}</div>${wakes}${missed}${lost}${spent}
      ${write}${history}`;
  }

  // The runs list: when each run started, how long it took (or that it is still going) and what it
  // added to the items its zone works into.
  function bindRuns(a) {
    const box = pop.querySelector('details.runs');
    if (!box) return;
    box.addEventListener('toggle', async () => {
      const list = box.querySelector('.runs-list');
      if (!box.open || list.dataset.loaded) return;
      list.dataset.loaded = 1;
      list.textContent = '…';
      try {
        const rows = await opts.runs(a);
        const st = a.f.stages, when = new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' });
        list.innerHTML = rows.length ? rows.map(r => {
          const took = r.ended_at ? fmtDuration((Date.parse(r.ended_at) - Date.parse(r.started_at)) / 1000) : t('board.runNow');
          // A supervisor's run says what it found; a worker's run, what it added.
          const what = a.sup ? `<span>${r.status ? supStatus(r.status) : ''}</span>`
            : `<span><b class="run">+${fmtCount(r.added)}</b> ${esc(plural(r.added, r.zone < st.length ? st[r.zone].forms : a.f.result))}</span>`;
          const tok = r.tokens != null ? `<span class="tok" title="${esc(r.cost != null ? t('board.usageCost', fmtCost(r.cost)) : '')}">${esc(fmtTokens(r.tokens))}</span>` : '';
          return `<div class="run-row"><span class="at">${esc(when.format(new Date(r.started_at)))}</span><span class="took">${esc(took)}</span>
            ${what}${tok}</div>`;
        }).join('') : `<div class="pop-note">${esc(t('board.noRuns'))}</div>`;
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
        // The demo has no agent to reply: a moment later it answers back as a real one would.
        if (!opts.live) setTimeout(() => { a.replies = [...(a.replies || []), { id: 'demo-' + Date.now(), question: asked, answer: text, reply: t('demo.reply') }]; }, 1200);
        if (a.questions.length) return pop.querySelector('.answer')?.focus();
        if (a.state !== 'sleep') a.state = 'work';
        hidePop();
      });
    });
  }

  function showPop(e, html) {
    pop.innerHTML = `<button class="close" aria-label="${esc(t('board.close'))}">×</button>` + html;
    pop.querySelector('.close').addEventListener('click', hidePop);
    pop.hidden = false;
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    pop.style.left = Math.max(8, Math.min(window.innerWidth - pw - 8, e.clientX - pw / 2)) + 'px';
    pop.style.top = Math.max(8, Math.min(window.innerHeight - ph - 8, e.clientY + 14)) + 'px';
  }
  function hidePop() { pop.hidden = true; }
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
      scene = new Scene(canvas, next, { live: opts.live, sides: scene.sides, heaps: scene.heaps });
      loadOrder();
      scene.resize(scale, window.devicePixelRatio || 1);
      layout();
      buildTitles();
      return true;
    },
  };
}
