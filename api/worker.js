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

    // CORS for browser + Claude skill calls
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
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

    if (request.method === 'POST' && url.pathname.startsWith('/skill/')) {
      const skillName = url.pathname.slice('/skill/'.length)
      return handleSkill(skillName, request, env, headers)
    }

    if (request.method === 'POST' && url.pathname === '/logo/upload') {
      return handleLogoUpload(request, env, headers)
    }

    return new Response(JSON.stringify({ status: 'GearOS License API v1' }), { headers })
  }
}

// ─── LOGO UPLOAD ─────────────────────────────────────────────────────────────

async function handleLogoUpload(request, env, headers) {
  let body
  try { body = await request.json() } catch { return json({ error: 'invalid_json' }, 400, headers) }

  const { license_key, file_b64, content_type } = body
  if (!license_key || !file_b64) {
    return json({ error: 'missing_fields', need: ['license_key', 'file_b64'] }, 400, headers)
  }
  if (!license_key.match(/^GEAR-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/)) {
    return json({ error: 'invalid_license_format' }, 400, headers)
  }

  // Validate license exists + active
  const license = await supabaseGet(env, 'licenses', `key=eq.${license_key}&select=active`)
  if (!license || license.length === 0 || !license[0].active) {
    return json({ error: 'invalid_license' }, 403, headers)
  }

  // Decode base64
  const binaryString = atob(file_b64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i)

  if (bytes.length > 2 * 1024 * 1024) {
    return json({ error: 'file_too_large', max_bytes: 2097152 }, 413, headers)
  }

  const ext = (content_type === 'image/svg+xml') ? 'svg' :
              (content_type === 'image/jpeg')   ? 'jpg' :
              (content_type === 'image/webp')   ? 'webp' : 'png'
  const filename = `${license_key}.${ext}`

  // Upload to Supabase Storage
  const uploadRes = await fetch(`${env.SUPABASE_URL}/storage/v1/object/dealer-logos/${filename}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': content_type || 'image/png',
      'x-upsert': 'true',
    },
    body: bytes,
  })

  if (!uploadRes.ok) {
    const err = await uploadRes.text()
    return json({ error: 'upload_failed', detail: err }, 500, headers)
  }

  const public_url = `${env.SUPABASE_URL}/storage/v1/object/public/dealer-logos/${filename}`
  return json({ ok: true, url: public_url, filename }, 200, headers)
}

// ─── SKILL PROXY (Claude API) ────────────────────────────────────────────────

const SKILL_PROMPTS = {
  'inquiry-classifier': {
    system: `Si asistent v autosalóne. Klasifikuj zákaznícky dopyt do JSON formátu.
Vráť LEN JSON, žiadny iný text.

Schema:
{
  "type": "price_request" | "availability" | "test_drive" | "financing" | "trade_in" | "general",
  "language": "sk" | "cs" | "de" | "en" | "hu" | "pl",
  "urgency": "high" | "medium" | "low",
  "summary": "1-2 vety zhrnutie čo zákazník chce",
  "suggested_reply": "návrh odpovede v jazyku zákazníka, 80-150 slov, profesionálne ale ľudsky"
}`,
    user: (input) => `Dopyt od zákazníka:\n\n${input}`,
  },
  'b2b-outreach-generator': {
    system: `Si B2B asistent pre slovenský autosalón ktorý exportuje auta nemeckým dealerom.
Napíš krátky (120-180 slov) personalizovaný nemecký email na nemeckého dealera.
Formálne "Sie". Žiadne "I hope this email finds you well" frázy.
Konkrétne — meno dealera, model auta, ponuka.
Vráť LEN text emailu (Betreff: + telo), žiadny iný komentár.`,
    user: (input) => `Info o dealerovi a aute ktoré ponúkam:\n\n${input}`,
  },
  'vehicle-doc-generator': {
    system: `Si asistent autosalónu. Z popisu auta vygeneruj štruktúrovaný JSON pre PDF ponuku.
Vráť LEN JSON, žiadny iný text.

KRITICKÉ PRAVIDLO:
- Ak vstup obsahuje IBA URL (napr. https://...mobile.de/...) alebo je príliš krátky bez popisu,
  vráť tento error JSON: {"error": "no_description", "message": "Potrebujem textový popis auta. URL z mobile.de zatial nepodporujeme — skopíruj základné údaje (značka, model, rok, km, výkon, výbava) do popisu."}
- NIKDY si nevymýšľaj údaje (značku, model, rok, výkon, farbu, výbavu) ak nie sú v texte.
- Ak v texte chýba dôležitý údaj, môžeš ho vynechať z JSON, ale NIKDY ho neuhádni.

Schema (keď je popis OK):
{
  "title": "Make Model — Variant (presne ako v texte)",
  "headline_specs": ["len údaje ktoré sú v texte"],
  "selling_points": ["3-5 krátkych viet zo skutočných údajov v texte"],
  "price_label": "Predajná cena vrátane DPH",
  "price_value_eur": <číslo z textu>,
  "footer_note": "krátka veta na základe údajov v texte"
}`,
    user: (input) => `Popis auta:\n\n${input}`,
  },
}

async function handleSkill(skillName, request, env, headers) {
  const skill = SKILL_PROMPTS[skillName]
  if (!skill) {
    return json({ error: 'unknown_skill', available: Object.keys(SKILL_PROMPTS) }, 404, headers)
  }

  let body
  try { body = await request.json() } catch { return json({ error: 'invalid_json' }, 400, headers) }

  const { input, license_key } = body
  if (!input || typeof input !== 'string') {
    return json({ error: 'missing_input' }, 400, headers)
  }

  // Optional: validate license (skip for now during testing — add later)
  // if (!license_key) return json({ error: 'missing_license' }, 401, headers)

  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1500,
        system: skill.system,
        messages: [{ role: 'user', content: skill.user(input) }],
      }),
    })

    const data = await claudeRes.json()
    if (data.error) {
      return json({ error: 'claude_api_error', detail: data.error }, 500, headers)
    }

    const text = data.content?.[0]?.text || ''
    return json({
      skill: skillName,
      output: text,
      usage: data.usage,
    }, 200, headers)
  } catch (e) {
    return json({ error: 'fetch_failed', detail: String(e) }, 500, headers)
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
