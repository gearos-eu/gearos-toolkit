# GearOS — Installation Guide

GearOS is a Claude plugin (skill pack) for EU automotive dealers.
It runs inside Claude Code with the Claude in Chrome extension.

---

## Requirements

| Tool | Min version | Purpose |
|------|-------------|---------|
| [Claude Code](https://claude.ai/code) | latest | Runs all skills |
| [Claude in Chrome](https://chromewebstore.google.com) | ≥1.5 | Browser automation (mobile.de, Gmail, LinkedIn) |
| Chrome browser | any recent | Target browser for automation |
| Microsoft Excel or Google Sheets | — | B2B contacts source |

---

## Installation — 3 steps

### Step 1 — Download GearOS

```
git clone https://github.com/gearos/gearos-toolkit.git
```

Or download the ZIP from [gearos.eu/download](https://gearos.eu/download) and extract to a folder of your choice.

Recommended location:
- Windows: `C:\Users\[YourName]\gearos-toolkit\`
- Mac/Linux: `~/gearos-toolkit/`

---

### Step 2 — Configure your dealership

Open the `config/` folder and fill in the following files:

**`config/company.json`** — your dealership identity
```json
{
  "name": "Your Dealership Name",
  "email": "you@yourdealership.com",
  "phone": "+XX XXX XXX XXX",
  "website": "yourdealership.com",
  "owner_name": "Your Name",
  "address": { "city": "Your City", "country": "Your Country" }
}
```

**`config/pricing_rules.json`** — your budget and margin targets
```json
{
  "purchase_budget": { "min_eur": 15000, "max_eur": 30000 },
  "max_mileage_km": 60000,
  "max_age_years": 3,
  "min_target_margin_eur": 3000
}
```

**`config/languages.json`** — your primary language
```json
{
  "primary": "de",
  "active": ["de", "en"]
}
```

Full config reference: see [CONFIG.md](CONFIG.md).

---

### Step 3 — Add your license key

Open `config/license.json` and enter your license key:
```json
{
  "key": "GEAR-XXXX-XXXX-XXXX",
  "tier": "starter"
}
```

Get your license key at [gearos.eu/license](https://gearos.eu/license).

---

## First run

1. Open **Claude Code** in the `gearos-toolkit/` folder
2. Connect **Claude in Chrome** to your Chrome browser
3. Type any of the following to get started:

```
daily digest
```
```
scan mobile.de for BMW 3er
```
```
classify this inquiry: [paste email]
```

GearOS will automatically read your config and run the right skill.

---

## Connecting your B2B contacts

If you have an existing B2B contact list in Excel:

1. Open `config/inventory_source.json`
2. Set the path to your xlsx file:
```json
{
  "b2b_contacts": {
    "type": "xlsx_local",
    "path": "C:\\Users\\YourName\\contacts\\b2b_contacts.xlsx",
    "sheet_name": "contacts"
  }
}
```

Supported formats: `.xlsx`, Google Sheets (via URL), Airtable (via API key).

---

## Troubleshooting

**Claude in Chrome not connecting**
→ Make sure the extension is installed and Chrome is open. Type `list connected browsers` in Claude Code.

**mobile.de shows CAPTCHA**
→ Navigate to `https://www.mobile.de/` first, then retry the scan command.

**Gmail access denied**
→ Make sure you're logged into Gmail in Chrome. GearOS uses your existing session — it never stores passwords.

**License key invalid**
→ Check [gearos.eu/license](https://gearos.eu/license) or contact support@gearos.eu.

---

## Updating GearOS

```
git pull origin main
```

Or re-download from [gearos.eu/download](https://gearos.eu/download).

Your `config/` files are never overwritten by updates.
