// Payments for Goalcraft Pro through Polar (the merchant of record: it takes the money, handles
// taxes and sends the receipts). Three routes:
//   POST /billing/checkout  a signed-in person starts paying: a Polar checkout link
//   POST /billing/portal    a paying person manages or cancels their subscription: a portal link
//   POST /billing/downgrade Pro given without paying (early access) goes back to Free now
//   POST /billing/webhook   Polar tells us what happened; this moves accounts.pro_until
// Function secrets: POLAR_ACCESS_TOKEN (an organization access token), POLAR_WEBHOOK_SECRET (from
// the webhook endpoint), POLAR_PRODUCT_ID, and POLAR_API (https://api.polar.sh/v1 by default,
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

async function polar(path: string, body: unknown) {
  const res = await fetch(API + path, {
    method: 'POST',
    headers: { authorization: `Bearer ${Deno.env.get('POLAR_ACCESS_TOKEN')}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
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
async function checkout(req: Request) {
  const user = await person(req)
  if (!user) return json({ error: 'sign_in' }, 401)
  const session = await polar('/checkouts/', {
    products: [Deno.env.get('POLAR_PRODUCT_ID')],
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
  const res = await polar('/customer-sessions/', { customer_id: data.customer_id, return_url: `${SITE}/app/` })
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
// HMAC-SHA256 of "<webhook-id>.<webhook-timestamp>.<body>" keyed with the secret's own bytes.
// Older than five minutes is refused, so a recorded request can't be played back later.
async function signed(req: Request, body: string) {
  const id = req.headers.get('webhook-id'), ts = req.headers.get('webhook-timestamp'), sig = req.headers.get('webhook-signature')
  if (!id || !ts || !sig || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(Deno.env.get('POLAR_WEBHOOK_SECRET')!),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${ts}.${body}`)))
  const expected = btoa(String.fromCharCode(...mac))
  return sig.split(' ').some(part => {
    const value = part.split(',')[1] ?? ''
    if (value.length !== expected.length) return false
    let diff = 0
    for (let i = 0; i < value.length; i++) diff |= value.charCodeAt(i) ^ expected.charCodeAt(i)
    return diff === 0
  })
}

async function webhook(req: Request) {
  const body = await req.text()
  if (!(await signed(req, body))) return json({ error: 'bad_signature' }, 401)
  const event = JSON.parse(body), type: string = event.type, o = event.data ?? {}
  // Only subscriptions move Pro: each of their events carries the whole subscription.
  if (!type.startsWith('subscription.')) return json({ ignored: type })
  const userId: string | undefined = o.customer?.external_id ?? o.metadata?.user_id
  if (!userId) return json({ ignored: type })

  const { data: account } = await admin.from('accounts').select('pro_until').eq('user_id', userId).maybeSingle()
  const until = account?.pro_until ? Date.parse(account.pro_until) : 0
  const periodEnd = o.current_period_end ? Date.parse(o.current_period_end) : 0
  const change: Record<string, unknown> = {
    subscription_status: o.cancel_at_period_end && o.status === 'active' ? 'canceled' : o.status,
    customer_id: o.customer_id ?? o.customer?.id,
    subscription_id: o.id,
  }
  if (o.status === 'active') {
    // Paid: Pro through the paid period plus two days of slack for the next charge, never less
    // than what the person already had (an early-access year, say).
    const paidTo = periodEnd ? periodEnd + 2 * DAY : Date.now() + 33 * DAY
    Object.assign(change, { plan: 'pro', pro_until: new Date(Math.max(until, paidTo)).toISOString() })
  }
  // Cancelled, ended or unpaid: only the status changes. pro_until already ends with the last paid
  // month (plus the slack), so Pro lapses on its own, and time granted otherwise is kept.
  const { error } = await admin.from('accounts').update(change).eq('user_id', userId)
  if (error) return json({ error: error.message }, 500)
  return json({ ok: type })
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
