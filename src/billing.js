// Paying for Pro: the site asks supabase/functions/billing for a Polar link and goes there, either
// to pay (checkout) or to manage or cancel the subscription (portal). account() reads the person's
// plan as the limits see it.
import { supabase, siteUrl } from './auth.js?v=73ac3c6d';
import { t } from './i18n.js?v=73ac3c6d';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js?v=73ac3c6d';

export async function account() {
  const { data } = await supabase.from('accounts').select('plan, pro_until, customer_id, subscription_status').maybeSingle();
  if (!data) return null;
  const until = data.pro_until ? new Date(data.pro_until) : null;
  const pro = data.plan === 'pro' && (!until || until > new Date());
  return { pro, until, paying: !!data.customer_id, status: data.subscription_status };
}

// Opens Polar: 'checkout' to pay for Pro, 'portal' to manage the subscription; 'downgrade' moves
// Pro given without paying back to Free here. Signed out, the
// person signs in first and comes back to the pricing page.
// While the link is fetched (a few seconds), the clicked button or link says so with a spinner and
// takes no more clicks; it comes back as it was if anything fails.
export async function openBilling(kind, el) {
  const restore = el ? wait(el, t(kind === 'downgrade' ? 'billing.switching' : 'billing.opening')) : () => {};
  try { await go(kind); } catch (e) { restore(); throw e; }
}
function wait(el, text) {
  const html = el.innerHTML, disabled = el.disabled;
  el.classList.add('busy'); el.disabled = true; el.setAttribute('aria-busy', 'true');
  el.innerHTML = `<span class="spin" aria-hidden="true"></span>${text}`;
  return () => { el.classList.remove('busy'); el.disabled = disabled; el.removeAttribute('aria-busy'); el.innerHTML = html; };
}
async function go(kind) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { location.href = siteUrl('login/?next=' + encodeURIComponent(siteUrl('pricing/'))); return; }
  const res = await fetch(`${SUPABASE_URL}/functions/v1/billing/${kind}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_KEY },
  });
  const body = await res.json().catch(() => ({}));
  if (body.done) return location.reload(); // changed here, nothing to open
  if (!body.url) throw new Error(body.error || 'failed');
  location.href = body.url;
}
