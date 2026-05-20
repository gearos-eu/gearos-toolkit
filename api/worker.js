/**
 * GearOS License API — Cloudflare Worker
 *
 * Endpoints:
 *   GET  /license?key=GEAR-XXXX  → validate license key
 *   POST /webhook                → Stripe webhook (creates/updates licenses)
 *   GET  /                       → health check
 *
 * Environment variables (set in Cloudflare Dashboard → Worker → Settings → Variables):
 *   SUPABASE_URL            e.g. https://abcdefgh.supabase.co
 *   SUPABASE_SERVICE_KEY    service_role key from Supabase → Settings → API
 *   STRIPE_WEBHOOK_SECRET   whsec_... from Stripe → Webhooks → signing secret
 */

// Tier definitions — which Stripe price IDs map to which tier
const PRICE_TIERS = {
  'price_starter_monthly': 'starter',   // €49/mo — replace with real Stripe price IDs
  'price_pro_monthly':     'pro',       // €99/mo
  'price_agency_monthly':  'agency',    // €199/mo
}

// ─── ROUTER ──────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // CORS for local Claude skill calls
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers })
    }

    if (request.method === 'GET' && url.pathname === '/license') {
      return handleLicenseCheck(url, env, headers)
    }

    if (request.method === 'POST' && url.pathname === '/webhook') {
      return handleStripeWebhook(request, env, headers)
    }

    return new Response(JSON.stringify({ status: 'GearOS License API v1' }), { headers })
  }
}

// ─── LICENSE CHECK ────────────────────────────────────────────────────────────

async function handleLicenseCheck(url, env, headers) {
  const key = url.searchParams.get('key')

  if (!key || !key.match(/^GEAR-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/)) {
    return json({ valid: false, reason: 'invalid_format' }, 400, headers)
  }

  const license = await supabaseGet(env, 'licenses', `key=eq.${key}&select=tier,valid_until,active,issued_to`)

  if (!license || license.length === 0) {
    return json({ valid: false, reason: 'not_found' }, 404, headers)
  }

  const { tier, valid_until, active, issued_to } = license[0]

  if (!active) {
    return json({ valid: false, reason: 'inactive' }, 403, headers)
  }

  if (new Date(valid_until) < new Date()) {
    return json({ valid: false, reason: 'expired', expired_at: valid_until }, 403, headers)
  }

  return json({ valid: true, tier, valid_until, issued_to }, 200, headers)
}

// ─── STRIPE WEBHOOK ───────────────────────────────────────────────────────────

async function handleStripeWebhook(request, env, headers) {
  const body = await request.text()
  const sig  = request.headers.get('stripe-signature')

  // Verify Stripe signature
  const isValid = await verifyStripeSignature(body, sig, env.STRIPE_WEBHOOK_SECRET)
  if (!isValid) {
    return json({ error: 'invalid_signature' }, 400, headers)
  }

  const event = JSON.parse(body)

  if (event.type === 'checkout.session.completed') {
    const session  = event.data.object
    const priceId  = session.line_items?.data?.[0]?.price?.id || session.metadata?.price_id
    const tier     = PRICE_TIERS[priceId] || 'starter'
    const email    = session.customer_details?.email
    const name     = session.customer_details?.name || email

    const key = generateLicenseKey()
    const validUntil = new Date()
    validUntil.setFullYear(validUntil.getFullYear() + 1) // 1-year initial license

    await supabaseInsert(env, 'licenses', {
      key,
      tier,
      issued_to: name,
      email,
      stripe_customer_id: session.customer,
      stripe_subscription_id: session.subscription,
      valid_until: validUntil.toISOString().split('T')[0],
      active: true,
    })

    // TODO: send license key via email (add Resend/SendGrid call here)
    console.log(`License created: ${key} | ${tier} | ${email}`)
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object
    await supabaseUpdate(env, 'licenses',
      `stripe_subscription_id=eq.${sub.id}`,
      { active: false }
    )
  }

  return json({ received: true }, 200, headers)
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function generateLicenseKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `GEAR-${seg()}-${seg()}-${seg()}`
}

async function supabaseGet(env, table, query) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: {
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    }
  })
  return res.json()
}

async function supabaseInsert(env, table, data) {
  return fetch(`${env.SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(data)
  })
}

async function supabaseUpdate(env, table, query, data) {
  return fetch(`${env.SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: 'PATCH',
    headers: {
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(data)
  })
}

async function verifyStripeSignature(body, sig, secret) {
  // Stripe signature: t=timestamp,v1=hash
  const parts = Object.fromEntries(sig.split(',').map(p => p.split('=')))
  const payload = `${parts.t}.${body}`
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  const computed = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('')
  return computed === parts.v1
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers })
}
