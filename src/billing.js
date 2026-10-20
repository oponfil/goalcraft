// Paying for Pro: the site asks supabase/functions/billing for a Polar link and goes there, either
// to pay (checkout) or to manage or cancel the subscription (portal). account() reads the person's
// plan as the limits see it.
import { supabase, siteUrl } from './auth.js?v=d344de2b';
import { t } from './i18n.js?v=d344de2b';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js?v=d344de2b';

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
  try { if (await go(kind) === 'closed') restore(); } catch (e) { restore(); throw e; }
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
    headers: { authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_KEY, 'content-type': 'application/json' },
    body: JSON.stringify(kind === 'checkout' ? { embed_origin: location.origin }
      : kind === 'portal' ? { return_path: location.pathname + location.search } : {}),
  });
  const body = await res.json().catch(() => ({}));
  if (body.done) return location.reload(); // changed here, nothing to open
  if (!body.url) throw new Error(body.error || 'failed');
  if (kind === 'checkout' && await embed(body.url)) return 'closed'; // shown over the page and closed again
  location.href = body.url;
}

// The checkout opens over our page (Polar's embedded checkout) so the person stays on Goalcraft;
// paid, it goes to Goals, where a note says Pro is on. Resolves false if it can't be shown, and
// the caller goes to Polar's page instead. The promise waits until the checkout is closed.
const EMBED_SCRIPT = 'https://cdn.jsdelivr.net/npm/@polar-sh/checkout@0.4.2/dist/embed.global.js';
async function embed(url) {
  try {
    if (!window.Polar?.EmbedCheckout) await new Promise((ok, fail) => {
      const s = document.createElement('script');
      s.src = EMBED_SCRIPT; s.onload = ok; s.onerror = fail;
      document.head.append(s);
    });
    const checkout = await window.Polar.EmbedCheckout.create(url, { theme: 'dark' });
    return await new Promise(done => {
      checkout.addEventListener('success', e => {
        e.preventDefault();
        location.href = siteUrl('app/?pro=1');
      });
      checkout.addEventListener('close', () => done(true));
    });
  } catch {
    return false;
  }
}
