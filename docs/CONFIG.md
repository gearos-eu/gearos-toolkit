# GearOS — Configuration Reference

All GearOS behavior is controlled by files in the `config/` folder.
No code changes needed — edit JSON/Markdown files only.

---

## config/company.json

Your dealership identity. Used by all skills for emails, PDFs, and branding.

```json
{
  "name": "Your Dealership Name",
  "legal_name": "Your Dealership s.r.o.",
  "website": "yourdealership.com",
  "email": "you@yourdealership.com",
  "phone": "+XX XXX XXX XXX",
  "address": {
    "city": "City",
    "country": "Slovakia",
    "country_code": "SK"
  },
  "owner_name": "First Last",
  "owner_title": "Owner & B2B Manager",
  "vat_number": "SK1234567890",

  "branding": {
    "logo_url": "https://yourdealership.com/logo.png",
    "primary_color": "#0f0f0f",
    "secondary_color": "#ffffff"
  }
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `name` | ✅ | Short display name |
| `email` | ✅ | Used as sender for all outreach |
| `owner_name` | ✅ | Signs all emails and documents |
| `branding.logo_url` | Recommended | Must be publicly accessible URL for PDF generation |
| `vat_number` | Optional | Shown on PDFs if set |

---

## config/pricing_rules.json

Your buying criteria and margin targets.

```json
{
  "purchase_budget": {
    "min_eur": 15000,
    "max_eur": 30000
  },
  "max_mileage_km": 60000,
  "max_age_years": 3,
  "min_target_margin_eur": 3000,
  "transport_cost_eur": 1000,
  "vat_rate": 0.23,

  "segment_markups": {
    "premium_sedan_suv": 0.22,
    "ev_phev": 0.175,
    "c_suv_mid": 0.15,
    "compact_mass": 0.10,
    "small_cars": 0.07
  },

  "red_flags": {
    "exclude_taxi": true,
    "exclude_rental": true,
    "exclude_accident_history": true,
    "max_previous_owners": 2
  }
}
```

**Segment markups** — expected DE→local price increase. Adjust to your market.

| Segment | Examples | Default markup |
|---------|---------|----------------|
| `premium_sedan_suv` | BMW 5/7, Merc E/S, Audi A6/Q7 | 22% |
| `ev_phev` | Tesla, BMW i4/iX, Merc EQC | 17.5% |
| `c_suv_mid` | BMW 3/X3, Merc C/GLC, Audi A4 | 15% |
| `compact_mass` | VW Golf, Skoda Octavia, Toyota | 10% |
| `small_cars` | VW Polo, Skoda Fabia, Opel Corsa | 7% |

**Red flags** — listings matching any of these are automatically excluded from scans:
- `exclude_taxi` — vehicles registered as taxi
- `exclude_rental` — rental fleet history
- `exclude_accident_history` — any accident record
- `max_previous_owners` — reject if more than N previous owners

---

## config/languages.json

Controls which language skills use for emails, PDFs, and responses.

```json
{
  "primary": "de",
  "active": ["de", "en", "sk", "cs"],
  "available": ["en", "de", "cs", "sk", "pl", "hu", "ro", "fr", "it"]
}
```

| Field | Notes |
|-------|-------|
| `primary` | Default language for all outreach and documents |
| `active` | Languages the skill can switch to on request |
| `available` | All supported languages (do not edit) |

---

## config/inventory_source.json

Where your B2B contact list lives.

```json
{
  "type": "google_sheets",
  "url": "https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID",
  "sheet_name": "Sheet1",

  "b2b_contacts": {
    "type": "xlsx_local",
    "path": "C:\\Users\\YourName\\contacts\\b2b_contacts.xlsx",
    "sheet_name": "contacts"
  },

  "permanent_exclude_emails": [
    "someone@example.com"
  ]
}
```

**Supported inventory types:**
- `google_sheets` — live Google Sheet via URL (requires sheet to be shared)
- `xlsx_local` — local Excel file (full path required)
- `airtable` — Airtable base (requires API key in connector)
- `notion` — Notion database (requires integration token)

**`permanent_exclude_emails`** — these addresses will never receive outreach, regardless of what appears in your contact list. Add competitors, partners, or anyone who has opted out.

---

## config/outreach_voice.md

Defines your communication style for all outreach emails and messages.
Edit the Markdown file directly — no JSON format required.

Key sections to fill in:
- **Tone** — formal/informal, language register
- **Signature** — how you sign emails
- **Phrases to use** — your preferred expressions
- **Phrases to avoid** — anything that sounds like generic AI output

---

## config/license.json

Your GearOS license key.

```json
{
  "key": "GEAR-XXXX-XXXX-XXXX",
  "tier": "starter",
  "issued_to": "Your Dealership",
  "valid_until": "2026-12-31"
}
```

**Tiers:**

| Tier | Skills included | Price |
|------|----------------|-------|
| `starter` | car-listing-scanner, inquiry-classifier, vehicle-doc-generator | €49/mo |
| `pro` | All starter + b2b-outreach-generator, competitor-pricing-monitor, daily-digest | €99/mo |
| `agency` | All skills + multi-dealer, white-label | €199/mo |

---

## Private config (never commit to Git)

Sensitive data should be kept outside the repo in a separate file:

Recommended: `~/.gearos-private/private-config.json`

Include there:
- Google Sheets IDs
- API keys (Airtable, Notion)
- Personal email credentials
- Additional exclude lists

Reference this file from `inventory_source.json` if needed, but never add it to version control.
Add to `.gitignore`:
```
.gearos-private/
config/license.json
```
