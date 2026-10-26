// Payments for Goalcraft Pro through Polar (the merchant of record: it takes the money, handles
// taxes and sends the receipts). Three routes:
//   POST /billing/checkout  a signed-in person starts paying: a Polar checkout link, with the discount
//                           a code from the link they came by names already applied
//   POST /billing/portal    a paying person manages or cancels their subscription: a portal link
//   POST /billing/downgrade Pro given without paying (early access) goes back to Free now
//   POST /billing/webhook   Polar tells us what happened; this moves accounts.pro_until and notes
//                           the discounts applied (discount_uses)
// Function secrets: POLAR_ACCESS_TOKEN (an organization access token), POLAR_WEBHOOK_SECRET (from
// the webhook endpoint), POLAR_PRODUCT_ID (the monthly subscription), POLAR_MONTH_PRODUCT_ID (one
// month bought once, no renewal), and POLAR_API (https://api.polar.sh/v1 by default,
// https://sandbox-api.polar.sh/v1 for the sandbox).
import { createClient } from 'npm:@supabase/supabase-js@2.117.2'

const SITE = 'https://goalcraft.ai'
const API = Deno.env.get('POLAR_API') ?? 'https://api.polar.sh/v1'
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const DAY = 86400e3

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })

async function polar(path: string, body?: unknown) {
  const res = await fetch(API + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${Deno.env.get('POLAR_ACCESS_TOKEN')}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`Polar ${path}: ${res.status} ${JSON.stringify(data).slice(0, 300)}`)
  return data
}

// The signed-in person behind a request from the site.
async function person(req: Request) {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer /, '')
  const { data } = await admin.auth.getUser(token)
  return data.user
}

// The Polar customer is tied to our user id (external_customer_id), so the webhook and the portal
// find the person without anything stored first.
// Sites the checkout may open inside (Polar → Settings → Embedding lists the same hosts).
const EMBED_ORIGINS = [SITE, 'http://localhost:5173']

async function checkout(req: Request) {
  const user = await person(req)
  if (!user) return json({ error: 'sign_in' }, 401)
  const { embed_origin, discount_code } = await req.json().catch(() => ({}))
  const discount_id = await discountOf(discount_code)
  const session = await polar('/checkouts/', {
    // A code from the link the person came by, applied already (they can still type another).
    ...(discount_id && { discount_id }),
    // Opened over our page rather than on Polar's site, when the page asks for it.
    ...(EMBED_ORIGINS.includes(embed_origin) && { embed_origin }),
    // The subscription first (chosen by default); one month bought once is the other choice on
    // Polar's page.
    products: [Deno.env.get('POLAR_PRODUCT_ID'), Deno.env.get('POLAR_MONTH_PRODUCT_ID')].filter(Boolean),
    external_customer_id: user.id,
    customer_email: user.email,
    success_url: `${SITE}/app/?pro=1`,
    metadata: { user_id: user.id },
  })
  return json({ url: session.url })
}

async function portal(req: Request) {
  const user = await person(req)
  if (!user) return json({ error: 'sign_in' }, 401)
  const { data } = await admin.from('accounts').select('customer_id').eq('user_id', user.id).maybeSingle()
  if (!data?.customer_id) return json({ error: 'no_subscription' }, 404)
  // "Back to Goalcraft" in the portal returns to the page it was opened from (a path on our site).
  const from = (await req.json().catch(() => ({})))?.return_path
  const back = typeof from === 'string' && /^\/(?!\/)[\w\-./?=&%#]*$/.test(from) ? from : '/app/'
  const res = await polar('/customer-sessions/', { customer_id: data.customer_id, return_url: `${SITE}${back}` })
  return json({ url: res.customer_portal_url })
}

// Back to Free for Pro that nobody pays for. A paid subscription is cancelled in the portal
// instead, so the month already paid for is kept.
async function downgrade(req: Request) {
  const user = await person(req)
  if (!user) return json({ error: 'sign_in' }, 401)
  const { data } = await admin.from('accounts').select('subscription_status').eq('user_id', user.id).maybeSingle()
  if (data?.subscription_status === 'active') return json({ error: 'cancel_in_portal' }, 409)
  const { error } = await admin.from('accounts').update({ plan: 'free', pro_until: null }).eq('user_id', user.id)
  if (error) return json({ error: error.message }, 500)
  return json({ done: true })
}

// Standard Webhooks, as Polar sends them: webhook-signature holds "v1,<base64>" entries, each an
// HMAC-SHA256 of "<webhook-id>.<webhook-timestamp>.<body>". Polar's own SDK keys it with the secret's
// bytes; the Standard Webhooks libraries base64-decode the secret (after a "whsec_" prefix) instead.
// Either is accepted. Older than five minutes is refused, so a recorded request can't be played back.
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
function keys(secret: string): Uint8Array[] {
  const out = [new TextEncoder().encode(secret)]
  try { out.push(Uint8Array.from(atob(secret.replace(/^whsec_/, '')), c => c.charCodeAt(0))) } catch { /* not base64 */ }
  return out
}
async function signed(req: Request, body: string) {
  const id = req.headers.get('webhook-id'), ts = req.headers.get('webhook-timestamp'), sig = req.headers.get('webhook-signature')
  if (!id || !ts || !sig || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false
  const given = sig.split(' ').map(part => part.split(',')[1] ?? '')
  for (const raw of keys((Deno.env.get('POLAR_WEBHOOK_SECRET') ?? '').trim())) {
    const key = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const expected = b64(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${ts}.${body}`))))
    if (given.some(value => {
      if (value.length !== expected.length) return false
      let diff = 0
      for (let i = 0; i < value.length; i++) diff |= value.charCodeAt(i) ^ expected.charCodeAt(i)
      return diff === 0
    })) return true
  }
  return false
}

async function webhook(req: Request) {
  const body = await req.text()
  if (!(await signed(req, body))) return json({ error: 'bad_signature' }, 401)
  const event = JSON.parse(body), type: string = event.type, o = event.data ?? {}
  if (type === 'order.paid' && !o.subscription_id) return oneTime(o)
  // Otherwise only subscriptions move Pro: each of their events carries the whole subscription.
  if (!type.startsWith('subscription.')) return json({ ignored: type })
  const userId: string | undefined = o.customer?.external_id ?? o.metadata?.user_id
  if (!userId) return json({ ignored: type })

  await noteDiscount('subscription', o, userId)
  const { data: account } = await admin.from('accounts').select('pro_until').eq('user_id', userId).maybeSingle()
  const until = account?.pro_until ? Date.parse(account.pro_until) : 0
  const periodEnd = o.current_period_end ? Date.parse(o.current_period_end) : 0
  const change: Record<string, unknown> = {
    subscription_status: o.cancel_at_period_end && o.status === 'active' ? 'canceled' : o.status,
    customer_id: o.customer_id ?? o.customer?.id,
    subscription_id: o.id,
  }
  if (o.status === 'active') {
    // Paid: Pro through the paid period plus two days of slack for the next charge; cancelled (it
    // still runs to the end of the period), exactly to that end, the date the person is shown.
    // Time granted beyond this subscription (an early-access year, say) is kept as it is.
    const ending = !!o.cancel_at_period_end
    const paidTo = periodEnd ? periodEnd + (ending ? 0 : 2 * DAY) : Date.now() + 33 * DAY
    const granted = until > (periodEnd || Date.now()) + 3 * DAY
    Object.assign(change, { plan: 'pro', pro_until: new Date(granted ? until : paidTo).toISOString() })
  }
  // Cancelled, ended or unpaid: only the status changes. pro_until already ends with the last paid
  // month (plus the slack), so Pro lapses on its own, and time granted otherwise is kept.
  const { error } = await admin.from('accounts').update(change).eq('user_id', userId)
  if (error) return json({ error: error.message }, 500)
  return json({ ok: type })
}

// The Polar discount a code names (case aside), when there is one; a wrong or unknown code is ignored.
// Polar's list can't be filtered by code (its query is the discount's name), so it is read page by
// page, newest first, a few pages at most.
async function discountOf(code: unknown): Promise<string | null> {
  if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(code)) return null
  const want = code.toLowerCase()
  try {
    for (let page = 1; page <= 5; page++) {
      const list = await polar(`/discounts/?limit=100&page=${page}`)
      const items = list.items ?? []
      const found = items.find((d: any) => typeof d.code === 'string' && d.code.toLowerCase() === want)
      if (found) return found.id
      if (items.length < 100) break
    }
  } catch {}
  return null
}

// A discount Polar applied to an order or a subscription, kept so payments can be counted by the
// code (and so by the channel) that brought them.
async function noteDiscount(kind: 'order' | 'subscription', o: any, userId: string) {
  const discountId = o.discount_id ?? o.discount?.id
  if (!discountId || !o.id) return
  const { error } = await admin.from('discount_uses').upsert({
    polar_id: o.id, user_id: userId, kind, discount_id: discountId, code: o.discount?.code ?? null,
  }, { onConflict: 'polar_id' })
  if (error) console.error('discount_uses:', error.message)
}

// One month bought once: 30 more days of Pro, counted from today or from the end of the Pro the
// person already has. Each order counts once, however many times Polar delivers it.
async function oneTime(o: any) {
  const userId: string | undefined = o.customer?.external_id ?? o.metadata?.user_id
  if (!userId || o.product_id !== Deno.env.get('POLAR_MONTH_PRODUCT_ID')) return json({ ignored: 'order.paid' })
  const days = 30
  await noteDiscount('order', o, userId)
  const { error: taken } = await admin.from('pro_orders').insert({ order_id: o.id, user_id: userId, days })
  if (taken) return json(taken.code === '23505' ? { ok: 'already counted' } : { error: taken.message }, taken.code === '23505' ? 200 : 500)
  const { data: account } = await admin.from('accounts').select('plan, pro_until').eq('user_id', userId).maybeSingle()
  if (account?.plan === 'pro' && !account.pro_until) return json({ ok: 'pro without an end already' })
  const from = Math.max(Date.now(), account?.pro_until ? Date.parse(account.pro_until) : 0)
  const { error } = await admin.from('accounts').update({ plan: 'pro', pro_until: new Date(from + days * DAY).toISOString() }).eq('user_id', userId)
  if (error) return json({ error: error.message }, 500)
  return json({ ok: 'order.paid' })
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  const path = new URL(req.url).pathname.replace(/^.*\/billing/, '')
  try {
    if (req.method === 'POST' && path === '/checkout') return await checkout(req)
    if (req.method === 'POST' && path === '/portal') return await portal(req)
    if (req.method === 'POST' && path === '/downgrade') return await downgrade(req)
    if (req.method === 'POST' && path === '/webhook') return await webhook(req)
    return json({ error: 'not_found' }, 404)
  } catch (e) {
    console.error(e)
    return json({ error: 'failed' }, 502)
  }
})
