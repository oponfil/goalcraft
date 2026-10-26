// The prompt that connects Goalcraft to any agent, with a copy icon on its block.
import { MCP_URL } from './config.js?v=53a22f02';
import { t } from './i18n.js?v=53a22f02';

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
