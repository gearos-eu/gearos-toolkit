# GearOS License API — Setup Guide

Total setup time: ~30 minutes.
Cost: Supabase free tier + Cloudflare Workers free tier (both €0 to start).

---

## 1. Supabase — database

1. Go to [supabase.com](https://supabase.com) → New project
2. Name: `gearos`, region: EU (Frankfurt)
3. After project loads: **SQL Editor** → paste contents of `schema.sql` → Run
4. Go to **Settings → API**, copy:
   - `Project URL` → save as `SUPABASE_URL`
   - `service_role` key → save as `SUPABASE_SERVICE_KEY` (keep secret)

---

## 2. Cloudflare Worker — API

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → Workers & Pages → Create
2. Name: `gearos-license-api`
3. Paste contents of `worker.js` into the editor → Save & Deploy
4. Go to **Settings → Variables** → add:
   - `SUPABASE_URL` = your Supabase project URL
   - `SUPABASE_SERVICE_KEY` = your service_role key
   - `STRIPE_WEBHOOK_SECRET` = (fill in after Step 3)
5. Note your Worker URL: `https://gearos-license-api.[your-subdomain].workers.dev`
6. Later: add custom domain `api.gearos.eu` → Workers → Custom Domains

**Test the API:**
```
curl https://gearos-license-api.[subdomain].workers.dev/license?key=GEAR-TEST-1234-5678
# Should return: {"valid":false,"reason":"not_found"}
```

---

## 3. Stripe — payments

1. Go to [dashboard.stripe.com](https://dashboard.stripe.com) → Products
2. Create 3 products:
   | Name | Price | Billing |
   |------|-------|---------|
   | GearOS Starter | €49 | Monthly recurring |
   | GearOS Pro | €99 | Monthly recurring |
   | GearOS Agency | €199 | Monthly recurring |

3. Copy each **Price ID** (starts with `price_`) and update `PRICE_TIERS` in `worker.js`:
   ```js
   const PRICE_TIERS = {
     'price_XXXXXXXXXXXXXXXX': 'starter',
     'price_YYYYYYYYYYYYYYYY': 'pro',
     'price_ZZZZZZZZZZZZZZZZ': 'agency',
   }
   ```

4. Go to **Developers → Webhooks** → Add endpoint:
   - URL: `https://gearos-license-api.[subdomain].workers.dev/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.deleted`
   - Copy **Signing secret** → add as `STRIPE_WEBHOOK_SECRET` in Cloudflare

5. Create a **Payment Link** for each product (Stripe → Payment Links → New):
   - Add the link to `landing/index.html` → replace `gearos.eu/checkout?tier=...` with real Stripe links

---

## 4. Test full flow

1. Open your Stripe payment link in a browser
2. Use test card: `4242 4242 4242 4242` / any future date / any CVC
3. Complete checkout
4. Check Supabase → Table Editor → `licenses` → should see new row with `GEAR-XXXX` key
5. Test validation:
   ```
   curl https://.../license?key=GEAR-[your-new-key]
   # Should return: {"valid":true,"tier":"starter","issued_to":"..."}
   ```

---

## 5. Email delivery (optional but recommended)

After license is created, send the key to the customer automatically.

Add to `worker.js` after `console.log(...)` in the webhook handler:

```js
await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${env.RESEND_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    from: 'GearOS <license@gearos.eu>',
    to: email,
    subject: 'Your GearOS license key',
    html: `<p>Your license key: <strong>${key}</strong></p>
           <p>Tier: ${tier}</p>
           <p>Setup guide: https://github.com/gearos-eu/gearos-toolkit/blob/main/docs/INSTALL.md</p>`
  })
})
```

[Resend](https://resend.com) free tier: 3,000 emails/month.
Add `RESEND_API_KEY` to Cloudflare Worker env variables.

---

## Manually issuing a license (for pilots/free trials)

Run this in Supabase SQL Editor:

```sql
insert into licenses (key, tier, issued_to, email, valid_until)
values (
  'GEAR-PILX-ABCD-1234',   -- choose any key
  'pro',                    -- starter | pro | agency
  'Dealer Name',
  'dealer@example.com',
  '2027-01-01'              -- expiry date
);
```
