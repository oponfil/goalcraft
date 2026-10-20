// The pricing page: "Get Pro" opens the Polar checkout. Signed in, the person's plan is marked
// "Your plan": on Pro the button shows the plan and opens the subscription settings (or nothing to
// manage for Pro granted without paying), and "Start free" goes; on Free, Pro stays the upgrade.
import { supabase } from './auth.js?v=849dcb8a';
import { account, openBilling } from './billing.js?v=849dcb8a';
import { t, lang } from './i18n.js?v=849dcb8a';

const button = document.getElementById('get-pro');
const note = document.getElementById('billing-note');
const fail = () => { note.textContent = t('billing.failed'); note.hidden = false; };

button.addEventListener('click', async e => {
  e.preventDefault();
  if (button.classList.contains('busy')) return;
  note.hidden = true;
  try { await openBilling(button.dataset.kind || 'checkout', button); } catch { fail(); }
});

// A "Your plan" label on a plan's card.
function mark(card) {
  const label = document.createElement('div');
  label.className = 'mine'; label.textContent = t('pricing.current');
  card.classList.add('current'); card.prepend(label);
}
// Plain text in place of a card's button: what the plan is, nothing to click.
function status(el, text) {
  const p = document.createElement('p');
  p.className = 'plan-status'; p.textContent = text;
  el.replaceWith(p);
}

const plans = document.querySelector('.plans');
const { data: { session } } = await supabase.auth.getSession();
try {
  if (session) {
    const me = await account();
    if (me) mark(document.getElementById(me.pro ? 'plan-pro' : 'plan-free'));
    // Free: nothing to start there; Pro stays the upgrade.
    if (me && !me.pro) document.getElementById('start-free').remove();
    if (me?.pro) {
      const date = me.until ? me.until.toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' }) : '';
      button.removeAttribute('data-i18n');
      // Paid Pro: its subscription settings. Pro given without paying: just until when.
      if (me.paying) {
        button.textContent = t('nav.manage'); button.dataset.kind = 'portal';
        // Cancelled: still Pro until the end of the paid month, then Free; the portal can resume it.
        if (me.status === 'canceled') {
          const p = document.createElement('p');
          p.className = 'plan-status ended'; p.textContent = t('pricing.canceled', date);
          button.before(p);
        }
      }
      else status(button, date ? t('nav.proUntil', date) : t('pricing.current'));
      // Back to Free: a paid subscription is cancelled in the portal (Pro lasts to the end of the
      // paid month); Pro given without paying ends at once, after a confirmation.
      const free = document.getElementById('start-free');
      // Already cancelled: Free comes on its own at the end of the paid month.
      if (me.paying && me.status === 'canceled') free.remove();
      free.removeAttribute('data-i18n'); free.removeAttribute('href');
      free.textContent = t('pricing.downgrade');
      free.addEventListener('click', async e => {
        e.preventDefault();
        if (free.classList.contains('busy')) return;
        if (me.paying) return openBilling('portal', free).catch(fail);
        if (!confirm(t('pricing.downgradeConfirm'))) return;
        try { await openBilling('downgrade', free); } catch { fail(); }
      });
    }
  }
} finally {
  // Shown as they are now, whatever happened above.
  plans.classList.remove('checking');
}
