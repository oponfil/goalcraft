// The nav on every page. Signed out: a language picker and "Sign in". Signed in: "Goals" and a round
// profile button (the Google photo, or a plain silhouette) whose menu holds the rarely used
// settings: the language, email when an agent asks, and signing out. A signed-in person's language
// is kept in their account too.
import { account, openBilling } from './billing.js?v=72efdfc4';
import { supabase, siteUrl } from './auth.js?v=72efdfc4';
import { t, lang, chosen, LANGS, SHORT, setLang, onLangSaved, adoptLang, FLOW_UNITS, flowUnit, setFlowUnit, onFlowSaved } from './i18n.js?v=72efdfc4';

// The profile button's picture for people without a Google photo.
const SILHOUETTE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><circle cx="12" cy="8.5" r="4"/><path d="M4 20.5c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5z"/></svg>';

const links = document.querySelector('nav .links');
const signin = document.querySelector('.links a.signin');
const { data: { session } } = await supabase.auth.getSession();

// Language picker: a plain select, so phones get their native list. Short: closed it shows just the
// code (in the nav); long: always the full names (in the profile menu).
function languagePicker(short) {
  const pick = document.createElement('select');
  pick.className = 'lang';
  pick.title = pick.ariaLabel = t('nav.lang');
  for (const [code, name] of Object.entries(LANGS)) pick.add(new Option(`${SHORT[code]} · ${name}`, code, false, code === lang));
  if (short) {
    const label = () => { [...pick.options].forEach(o => { o.textContent = o.value === pick.value && !pick.matches(':focus') ? SHORT[o.value] : `${SHORT[o.value]} · ${LANGS[o.value]}`; }); };
    pick.addEventListener('focus', label); pick.addEventListener('blur', label); label();
  } else [...pick.options].forEach(o => { o.textContent = LANGS[o.value]; });
  pick.addEventListener('change', () => setLang(pick.value));
  return pick;
}

if (links && !session) (signin || links.lastElementChild)?.before(languagePicker(true));

if (session) {
  const saved = session.user.user_metadata?.lang;
  onLangSaved(code => supabase.auth.updateUser({ data: { lang: code } }));
  // A new device follows the account; a language picked here (or none in the account yet) is
  // written to the account.
  if (saved && !chosen) adoptLang(saved);
  else if (saved !== lang) supabase.auth.updateUser({ data: { lang } }).catch(() => {});
  // The flow unit follows the account, which every change is written to.
  onFlowSaved(unit => supabase.auth.updateUser({ data: { flow_unit: unit } }));
  setFlowUnit(session.user.user_metadata?.flow_unit, { remote: false });
}

if (signin && session) {
  const user = session.user, meta = user.user_metadata || {};
  const goals = new URL(signin.getAttribute('href').replace('login/', 'app/'), location.href).href;
  signin.textContent = t('nav.goals');
  signin.removeAttribute('data-i18n');
  signin.href = goals;

  // The profile button: the Google photo when there is one, else a silhouette.
  const profile = document.createElement('div');
  profile.className = 'profile';
  const button = document.createElement('button');
  button.className = 'avatar';
  button.title = button.ariaLabel = `${t('nav.profile')} · ${user.email}`;
  const photo = meta.avatar_url || meta.picture;
  if (photo) {
    const img = document.createElement('img');
    img.src = photo; img.alt = ''; img.referrerPolicy = 'no-referrer';
    img.addEventListener('error', () => { img.remove(); button.innerHTML = SILHOUETTE; });
    button.append(img);
  } else button.innerHTML = SILHOUETTE;

  const menu = document.createElement('div');
  menu.className = 'profile-menu';
  menu.hidden = true;
  const email = document.createElement('div');
  email.className = 'email'; email.textContent = user.email;

  const langRow = document.createElement('label');
  langRow.className = 'row';
  langRow.append(document.createTextNode(t('nav.lang')), languagePicker(false));

  // Flows on every funnel per hour, day or week.
  const flowRow = document.createElement('label');
  flowRow.className = 'row';
  const flowPick = document.createElement('select');
  flowPick.className = 'lang';
  for (const u of FLOW_UNITS) flowPick.add(new Option(t(`flow.${u}`), u, false, u === flowUnit));
  flowPick.addEventListener('change', () => setFlowUnit(flowPick.value));
  flowRow.append(document.createTextNode(t('nav.flow')), flowPick);

  // Email when an agent asks a question, kept in the account so the MCP server sees it.
  const notify = document.createElement('label');
  notify.className = 'row check';
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = !!meta.notify_email;
  box.addEventListener('change', async () => {
    box.disabled = true;
    const { error } = await supabase.auth.updateUser({ data: { notify_email: box.checked } });
    if (error) box.checked = !box.checked;
    box.disabled = false;
  });
  notify.append(box, document.createTextNode(t('nav.notifyLong')));
  // The session can be older than a change made elsewhere: read the account's current settings.
  supabase.auth.getUser().then(({ data }) => {
    const m = data?.user?.user_metadata;
    if (!m) return;
    if (!box.disabled) box.checked = !!m.notify_email;
    if (FLOW_UNITS.includes(m.flow_unit)) { setFlowUnit(m.flow_unit, { remote: false }); flowPick.value = m.flow_unit; }
  });

  // The plan: Free with a way up to Pro, or Pro with its end date and, when paid, the
  // subscription settings at Polar.
  const planRow = document.createElement('div');
  planRow.className = 'row plan-row';
  const planName = document.createElement('span');
  const planAction = document.createElement('a');
  planAction.href = siteUrl('pricing/');
  planRow.append(planName, planAction);
  planName.textContent = `${t('nav.plan')}: …`;
  account().then(me => {
    if (!me) { planRow.remove(); return; }
    const date = me.until ? me.until.toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    planName.textContent = `${t('nav.plan')}: ${me.pro ? (date ? t('nav.proUntil', date) : 'Pro') : t('nav.planFree')}`;
    // Cancelled but still running to the end of the paid month: say so next to the date.
    if (me.pro && me.paying && me.status === 'canceled') planName.textContent += `, ${t('nav.canceled')}`;
    if (me.paying) {
      planAction.textContent = t('nav.manage');
      planAction.addEventListener('click', e => { e.preventDefault(); if (planAction.classList.contains('busy')) return; openBilling('portal', planAction).catch(() => { planAction.textContent = t('billing.failed'); }); });
    } else if (!me.pro) planAction.textContent = t('nav.upgrade');
    else planAction.remove();
  });

  const out = document.createElement('a');
  out.href = '#'; out.className = 'signout';
  out.textContent = t('nav.signout');
  out.addEventListener('click', async e => {
    e.preventDefault();
    // Only this browser: a global sign-out would also cut off the agents connected by OAuth.
    await supabase.auth.signOut({ scope: 'local' });
    location.replace(siteUrl(''));
  });

  menu.append(email, planRow, langRow, flowRow, notify, out);
  profile.append(button, menu);
  signin.after(profile);

  const close = () => { menu.hidden = true; button.setAttribute('aria-expanded', 'false'); };
  button.addEventListener('click', () => {
    menu.hidden = !menu.hidden;
    button.setAttribute('aria-expanded', String(!menu.hidden));
  });
  document.addEventListener('pointerdown', e => { if (!profile.contains(e.target)) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}

