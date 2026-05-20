---
name: car-listing-scanner
description: >
  Scans mobile.de and autoscout24 for vehicles matching your purchasing criteria.
  Returns a scored shortlist (recommended / ok / skip) with estimated margins.
  All parameters read from config/pricing_rules.json and config/company.json.

  Use whenever the user says:
  - "find cars to buy", "scan listings for [model]", "what's interesting on mobile.de"
  - "check [model] offers", "find stock for [model]"
  - or any variation of searching for vehicles to purchase
requires: ["claude-in-chrome"]
---

# Car Listing Scanner

Scans mobile.de and autoscout24 and identifies vehicles worth purchasing.
Returns a scored shortlist with margin estimates.

---

## Step 0 — Read config

Before scanning, load these values from config files:

**From `config/pricing_rules.json`:**
- `purchase_budget.min_eur` / `purchase_budget.max_eur`
- `max_mileage_km`
- `max_age_years` → calculate `min_year = current_year - max_age_years`
- `min_target_margin_eur`
- `transport_cost_eur`
- `segment_markups`
- `red_flags`

**From `config/company.json`:**
- `address.country` → local resale market for margin calculation
- `name` → used in shortlist header

---

## Step 1 — Clarify the search

Ask the user (if not provided):
- **Specific model?** (or scan top sellers broadly)
- **Fuel type preference?** (petrol / diesel / hybrid / EV / any)
- **Any other filter?** (e.g. only estate, only AWD)

If no model specified → scan the 3 most common models for the user's market.

---

## Step 2 — Navigate and scan mobile.de

Use Chrome tools. Build search URL from config values:

```
https://suchen.mobile.de/fahrzeuge/search.html?
  cn=DE
  &dam=false
  &isSearchRequest=true
  &ms=[MAKE_ID]%3B[MODEL_ID]%3B%3B%3B
  &s=Car&vc=Car
  &minFirstRegistration=[min_year]
  &maxMileage=[max_mileage_km]
  &minPrice=[purchase_budget.min_eur]
  &maxPrice=[purchase_budget.max_eur]
  &sort=price&pageSize=25
```

Resolve make/model IDs via the mobile.de search UI — do not hardcode.

For autoscout24 (fallback or supplement):
```
https://www.autoscout24.de/lst/[make]/[model]?
  sort=price&desc=0
  &offer=J,D
  &ustate=N%2CU
  &fregfrom=[min_year]
  &mileageto=[max_mileage_km]
  &priceto=[purchase_budget.max_eur]
  &cy=D
```

Scan first 15-20 results. For each listing record:
- Make, model, year, mileage
- Price (€ gross)
- Previous owners, service history, usage type
- Color, key equipment
- Dealer or private seller
- Listing URL

---

## Step 3 — Apply red flags (from config/pricing_rules.json)

Auto-skip any listing where:
- `red_flags.exclude_accident_history: true` → accident or body repair in history
- `red_flags.exclude_taxi: true` → taxi or rental (Mietwagen, Taxi)
- `red_flags.exclude_rental: true` → fleet with 3+ operators
- Previous owners > `red_flags.max_previous_owners`
- Missing or incomplete service history

---

## Step 4 — Estimate margin

For each listing calculate estimated margin using `segment_markups` from config.

```
Estimated local sell price = Purchase price × (1 + segment_markup)
Gross margin = Local sell price − Purchase price − transport_cost_eur
Net margin ≈ Gross margin − 200 (misc costs)
```

Segment markup selection — match vehicle to nearest segment in config:
- `premium_sedan_suv` → BMW, Mercedes, Audi, Lexus
- `ev_phev` → all electric/plug-in hybrid
- `c_suv_mid` → mid-size SUVs (Tiguan, Tucson, Sportage...)
- `compact_mass` → Golf, Octavia, Focus, Corolla...
- `small_cars` → Clio, 208, Yaris, Fabia...

If segment not found → use `compact_mass` as default.

---

## Step 5 — Score each listing

**✅ RECOMMEND** — all of these true:
- Within budget ✓
- Mileage ≤ max_mileage_km ✓
- Age ≤ max_age_years ✓
- No red flags ✓
- Net margin ≥ min_target_margin_eur ✓

**🟡 OK** — meets basic criteria, margin is 50-99% of min_target, or minor issues

**❌ SKIP** — red flag, margin below 50% of min_target, or outside budget

---

## Step 6 — Present shortlist

```
🔍 [COMPANY_NAME] — Buying Shortlist [DATE]
Model: [MODEL] | Source: mobile.de | Scanned: [N] listings

✅ RECOMMEND
──────────────────────────────────────────────
1. [Year] [Model] [Variant] — [KM] km — [PRICE €]
   📍 [Seller, City]
   📋 Owners: [N] | Service history: yes/no | Color: [X]
   💰 Est. margin: ~[X 000] € | [URL]
   ✅ Why: [1-2 sentences]

🟡 OK (consider)
──────────────────────────────────────────────
...

❌ SKIP — hidden unless user asks
```

Maximum 5 recommended, 3 OK. Do not show skipped unless asked.

---

## Step 7 — Suggest next action

After shortlist, offer:
- "Want me to generate a PDF offer for any of these? (vehicle-doc-generator)"
- "Want me to find dealers selling the same model at a higher price? (b2b-outreach-generator)"
