// The prompt that connects Goalcraft to any agent, with a copy icon on its block.
import { MCP_URL } from './config.js?v=dc3a4cdb';
import { t } from './i18n.js?v=dc3a4cdb';

export const CONNECT_PROMPT = t('connect.prompt', MCP_URL);
// The Connect page's prompt: the agent connects Goalcraft and becomes the supervisor of one goal's funnel.
export const SUPERVISOR_PROMPT = t('connect.supervisor.prompt', MCP_URL);

const COPY = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>';
const DONE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>';

// Fills <pre data-connect-prompt> blocks with the prompt and puts a copy icon on every <pre> in root.
export function setUpConnect(root = document) {
  root.querySelectorAll('pre[data-connect-prompt]').forEach(pre => { pre.textContent = CONNECT_PROMPT; });
  root.querySelectorAll('pre[data-supervisor-prompt]').forEach(pre => { pre.textContent = SUPERVISOR_PROMPT; });
  root.querySelectorAll('pre').forEach(copyable);
}

// A copy icon on a <pre> block.
function copyable(pre) {
  const box = document.createElement('div'), btn = document.createElement('button');
  box.className = 'copybox'; btn.className = 'copy'; btn.innerHTML = COPY;
  btn.title = t('copy'); btn.setAttribute('aria-label', t('copy'));
  pre.replaceWith(box); box.append(pre, btn);
  btn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(pre.textContent.trim()); btn.innerHTML = DONE; btn.title = t('copied'); }
    catch { btn.title = t('copy.manual'); }
    setTimeout(() => { btn.innerHTML = COPY; btn.title = t('copy'); }, 1500);
  });
}

// The wake script (wake/ in the repository): signed in, a button creates the person's wake key and
// shows the one command that installs the script with it. Only the key's hash is stored, so the key
// is shown once; a new one replaces the old.
const WAKE_INSTALL = key => 'mkdir -p ~/.goalcraft && curl -fsSL https://goalcraft.ai/wake/goalcraft-wake.py -o ~/.goalcraft/goalcraft-wake.py && python3 ~/.goalcraft/goalcraft-wake.py install ' + key;
export async function setUpWake(root = document) {
  const box = root.querySelector('[data-wake]');
  if (!box) return;
  const { supabase } = await import('./auth.js?v=dc3a4cdb');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { box.innerHTML = `<p>${t('connect.wake.signin')}</p>`; return; }
  box.innerHTML = `<button class="btn" type="button">${t('connect.wake.create')}</button><p class="wake-msg"></p>`;
  const button = box.querySelector('button'), msg = box.querySelector('.wake-msg');
  button.addEventListener('click', async () => {
    button.disabled = true;
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const key = 'gck_' + [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)))]
      .map(b => b.toString(16).padStart(2, '0')).join('');
    const { error } = await supabase.from('wake_keys').upsert({ user_id: session.user.id, key_hash: hash, created_at: new Date().toISOString() });
    button.disabled = false;
    if (error) { msg.textContent = t('connect.wake.failed'); return; }
    msg.textContent = t('connect.wake.run');
    box.querySelector('.copybox')?.remove();
    const pre = document.createElement('pre');
    pre.textContent = WAKE_INSTALL(key);
    msg.after(pre); copyable(pre);
  });
}
