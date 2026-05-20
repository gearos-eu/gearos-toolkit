---
name: competitor-pricing-monitor
description: >
  Finds dealers selling the same model as you at a higher price.
  Returns a ranked list of competitors with price delta vs your price.
  All parameters read from config/pricing_rules.json and config/company.json.

  Use whenever the user says:
  - "find competitors for [model]", "who sells [model] more expensively"
  - "check market price for [model]", "how much are competitors charging"
  - or any variation of competitor price research
requires: ["claude-in-chrome"]
---

# Competitor Pricing Monitor

Scans mobile.de and autoscout24 for dealers selling the same model at a higher price.
Used to identify B2B outreach targets and validate your own pricing.

---

## Step 0 — Read config

**From `config/company.json`:**
- `email` → your B2B sender email
- `website` → referenced in price comparison
- `address.country_code` → exclude your own country from results if needed

---

## Step 1 — Get vehicle details

Ask the user (or read from context):
- **Model, year, mileage, power (kW)**
- **Your B2B net price** (without VAT)
- **Your retail price** (what you're selling it for)
- **Key equipment** (optional, for matching)

---

## Step 2 — Search mobile.de for same model

Build search URL filtering for dealers only (not private sellers), same year ±1, similar power ±20 kW, price ≥ your retail price × 1.05:

```
https://suchen.mobile.de/fahrzeuge/search.html?
  cn=DE
  &dam=false
  &isSearchRequest=true
  &ms=[MAKE_ID]%3B[MODEL_ID]%3B%3B%3B
  &s=Car&vc=Car
  &minFirstRegistration=[YEAR-1]
  &maxFirstRegistration=[YEAR+1]
  &minPower=[KW-20]
  &minPrice=[YOUR_RETAIL * 1.05]
  &sort=price&pageSize=25
```

Resolve make/model IDs via mobile.de search UI — never hardcode.

**Navigate via browser UI steps:**
1. Go to `https://www.mobile.de/`
2. Accept cookies
3. Select make → model via dropdowns
4. Set filters (year, power, price)
5. Click search → read results from page

**⚠️ Year filter warning:** `minFirstRegistration` / `maxFirstRegistration` URL params are ignored by mobile.de. Apply year filter in JS after extraction:
```js
// Keep only EZ within ±1 year of target
const targetYear = 2023;
listings.filter(l => Math.abs(l.ez_year - targetYear) <= 1)
```

Collect from each listing:
- Dealer name, city, postal code
- Price (€), delta vs your retail
- Mileage, first registration, power
- Listing URL (via ad ID: `suchen.mobile.de/fahrzeuge/details.html?id=[AD_ID]`)

**Scroll through 2-3 pages** if page 1 yields fewer than 5 matching listings.

**Target: 5-8 relevant dealers** (same model, year ±1, similar mileage ±15k km, similar power)

Fallback to autoscout24 if mobile.de unavailable.

---

## Step 3 — Find dealer contact info

For each dealer:
1. Search Google: `[dealer name] [postal code] contact email`
2. Load their `/kontakt` or `/impressum` page
3. Extract: email, phone, owner/manager name

Email priority: `verkauf@` > `ankauf@` > `info@` > contact form

---

## Step 4 — Present results

```
📊 Competitor Price Monitor — [MODEL] [YEAR]
Your retail price: [X €] | Your B2B net: [X €]
Found [N] dealers selling same model at higher price

# | Dealer | City | Their Price | Delta | km | First Reg | Contact
1 | [Name] | [City] | [X €] | +[X €] | [km] | [MM/YY] | [email]
2 | ...

Ready to generate B2B outreach emails for these dealers?
→ Use b2b-outreach-generator
```

---

## Step 5 — Export to XLSX (optional)

If user asks, create an Excel file with the competitor list.
File name: `competitors_[Model]_[Year]_[Date].xlsx`
