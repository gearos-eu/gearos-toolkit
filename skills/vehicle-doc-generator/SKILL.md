---
name: vehicle-doc-generator
description: >
  Generates a professional PDF price offer from a mobile.de listing URL or manual input.
  Scrapes vehicle data and photos, calculates selling price using margin from
  config/pricing_rules.json, brands the output with your logo and colors from
  config/company.json.

  Use whenever the user says:
  - "make a PDF for this car", "generate offer for [model]"
  - "create price sheet", "ponuka pre zákazníka"
  - or pastes a mobile.de / autoscout24 listing URL
requires: ["claude-in-chrome"]
---

# Vehicle Doc Generator

Generates a branded PDF price offer from a listing URL or manually entered vehicle data.

---

## Step 0 — Read config

**From `config/company.json`:** `name`, `email`, `phone`, `website`, `address`, `owner_name`, `branding.logo_url`, `branding.primary_color`
**From `config/pricing_rules.json`:** `segment_markups`, `transport_cost_eur`, `vat_rate`
**From `config/languages.json`:** `primary` → generate document in this language

---

## Step 1 — Get vehicle data

**Option A — from URL:**
If user provides a mobile.de or autoscout24 URL:
1. Navigate to the listing
2. Extract via JS:
   - Title, make, model, variant
   - Price (€), first registration (EZ), mileage (km)
   - Power (kW/PS), fuel type, transmission
   - Equipment list (top 8–10 items)
   - Photos (first 3 photo URLs)
   - Dealer name (for reference only — remove from PDF)

**Option B — manual input:**
Ask the user for: make, model, year, mileage, power, fuel, equipment, purchase price.

---

## Step 2 — Calculate selling price

Determine segment from model:
- BMW 5/7/X5/X6, Mercedes E/S/GLE/GLS, Audi A6/A7/Q7/Q8 → `premium_sedan_suv`
- Tesla, BMW i4/iX, Mercedes EQC/EQS, Volvo XC40 Electric, PHEV variants → `ev_phev`
- BMW 3/X3, Mercedes C/GLC, Audi A4/Q5, VW Tiguan → `c_suv_mid`
- VW Golf/Passat, Skoda Octavia/Superb, Toyota Corolla → `compact_mass`
- VW Polo, Skoda Fabia, Opel Corsa, Renault Clio → `small_cars`

```
purchase_price    = [from listing or user input]
markup            = segment_markups[segment]
retail_price      = purchase_price × (1 + markup)
transport         = transport_cost_eur
suggested_price   = round(retail_price + transport, -2)  // round to nearest 100
```

Show calculation to user, ask for confirmation or manual override.

---

## Step 3 — Generate HTML/PDF document

Build the offer document with these sections:

**Header:**
- Dealer logo (from `branding.logo_url`)
- Dealer name, address, email, phone, website
- Date (today), offer reference number (auto-generated: `[INITIALS]-[YYYYMMDD]-[MODEL]`)

**Vehicle card:**
- Main photo (large)
- Make + model + variant (bold)
- Key specs table: EZ | KM | kW (PS) | Fuel | Transmission | Color
- Price: displayed prominently, VAT note (margin scheme or deductible)

**Equipment highlights:**
- Up to 10 bullet points, grouped: Safety | Comfort | Technology | Extras

**Footer:**
- Contact info, website, GDPR note
- "Preis inkl. MwSt. nach § 25a UStG" (margin scheme) OR "zzgl. MwSt." depending on `vat_rate` config

**Delivery:**
Use `jsPDF` (CDN) or browser print-to-PDF:
```js
// Inject jsPDF via CDN into a blank tab, render HTML, trigger print dialog
const script = document.createElement('script');
script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
```

File name: `offer_[Make]_[Model]_[EZ]_[YYYYMMDD].pdf`

---

## Step 4 — Output

```
📄 Vehicle Offer Generated

Vehicle:  [Make Model Variant]
EZ:       [MM/YYYY] | [KM] km | [kW] kW
Segment:  [segment]
Purchase: [X €] | Markup: [X%]
─────────────────────────────
Suggested retail: [X €]

File: offer_[Make]_[Model]_[EZ]_[Date].pdf

Open PDF? (yes / adjust price first)
```

Wait for user confirmation before opening or sending the file.
