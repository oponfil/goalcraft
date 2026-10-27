import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.2';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js?v=2c559d81';

// The browser keeps the sign-in under a fixed name: by default it would follow the Supabase address,
// and a new address would sign everyone out.
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { storageKey: 'sb-goalagents-auth-token' } });

// Pages of this site, resolved from this file, so they work on goalcraft.ai and on localhost alike.
export const siteUrl = path => new URL('../' + path, import.meta.url).href;
export const appUrl = () => siteUrl('app/');

// Where people come from, to count what each channel brings (the privacy page says so): the
// campaign tags of the link (utm_*), the site the link was on (its host) and a discount code in it
// (?code=), from the first visit that had any. Kept in this browser until the person signs in, then
// saved to their account once (save_signup_source). A later visit doesn't replace it, except that a
// tagged link wins over a first visit known only by its site.
const SOURCE_KEY = 'goalcraft-source', CODE_KEY = 'goalcraft-code';
const TAGS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
const readSource = () => { try { return JSON.parse(localStorage.getItem(SOURCE_KEY)); } catch { return null; } };
const writeSource = s => { try { localStorage.setItem(SOURCE_KEY, JSON.stringify(s)); } catch {} };
function keepSource() {
  const q = new URLSearchParams(location.search), clip = (v, n) => (v || '').trim().slice(0, n) || null;
  const tags = Object.fromEntries(TAGS.map(k => [k, clip(q.get(k), 200)]).filter(([, v]) => v));
  const code = clip(q.get('code'), 64);
  let referrer = null;
  try { const r = new URL(document.referrer); if (r.host && r.host !== location.host) referrer = r.host; } catch {}
  // The latest code from a link is what the checkout offers (billing.js).
  if (code) try { localStorage.setItem(CODE_KEY, code); } catch {}
  const tagged = Object.keys(tags).length > 0;
  if (!tagged && !code && !referrer) return;
  const kept = readSource();
  if (kept && (kept.sent || !tagged || TAGS.some(k => kept[k]))) {
    if (code && !kept.code && !kept.sent) writeSource({ ...kept, code });
    return;
  }
  writeSource({ ...tags, referrer, code: code || kept?.code || null, landing_page: location.pathname.slice(0, 200), first_seen_at: new Date().toISOString() });
}
keepSource();
export const promoCode = () => { try { return localStorage.getItem(CODE_KEY); } catch { return null; } };

// Signed in: what was kept goes to the account, once. (Not awaited inside the auth callback,
// where another Supabase call would wait on this one.)
async function saveSource() {
  const kept = readSource();
  if (!kept || kept.sent) return;
  const { sent, ...fields } = kept;
  const { error } = await supabase.rpc('save_signup_source', fields);
  if (!error) writeSource({ ...kept, sent: true });
}
supabase.auth.onAuthStateChange((_event, session) => { if (session) setTimeout(saveSource, 0); });

// Where to go after signing in: ?next= when it is a page of this site (the OAuth consent page
// sends people here and wants them back), otherwise the account page.
export function afterSignIn() {
  const next = new URLSearchParams(location.search).get('next');
  try {
    const url = new URL(next, location.href);
    if (next && url.origin === location.origin) return url.href;
  } catch {}
  return appUrl();
}
