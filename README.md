# GearOS

**AI toolkit for EU automotive dealers — plug-and-play Claude skills.**

GearOS connects to Claude Code and gives automotive dealers 8 ready-made AI skills:
scan procurement markets, monitor competitor pricing, generate B2B outreach emails,
classify customer inquiries, and more — all configured with your dealership's own data.

→ [gearos.eu](https://gearos.eu) · [Installation guide](docs/INSTALL.md) · [Skills reference](docs/SKILLS_REFERENCE.md)

---

## What's included

| Skill | What it does |
|-------|-------------|
| `car-listing-scanner` | Scans mobile.de for vehicles matching your buying criteria. Scores and ranks by estimated margin. |
| `competitor-pricing-monitor` | Finds dealers selling the same model at a higher price. Identifies B2B outreach targets. |
| `b2b-outreach-generator` | Generates personalized B2B email drafts for German dealers. Never auto-sends. |
| `inquiry-classifier` | Classifies incoming customer inquiries and drafts the right reply. |
| `vehicle-doc-generator` | Generates a branded PDF price offer from a listing URL. |
| `linkedin-prospector` | LinkedIn B2B workflow: find contacts, connect, follow up (D+7/14/21). |
| `daily-digest` | Morning briefing: inbox, follow-up pipeline, market pulse, 3 actions. |
| `contact-deduplicator` | Cleans your B2B contact list: removes duplicates, enforces exclude rules. |

---

## Requirements

- [Claude Code](https://claude.ai/code)
- [Claude in Chrome](https://chromewebstore.google.com) extension
- Chrome browser
- GearOS license key — get one at [gearos.eu](https://gearos.eu)

---

## Quick start

```bash
git clone https://github.com/gearos/gearos-toolkit.git
cd gearos-toolkit
```

1. Fill in `config/company.json` with your dealership details
2. Set your buying criteria in `config/pricing_rules.json`
3. Add your license key to `config/license.json`
4. Open the folder in Claude Code and type: `daily digest`

Full instructions: [docs/INSTALL.md](docs/INSTALL.md)

---

## Configuration

All behavior is controlled by files in `config/` — no code changes needed.

```
config/
  company.json          # Your dealership identity, branding
  pricing_rules.json    # Budget, margins, red flags
  languages.json        # Primary language for emails and docs
  inventory_source.json # B2B contact list location
  outreach_voice.md     # Your communication style
  license.json          # License key (not committed to Git)
```

Full reference: [docs/CONFIG.md](docs/CONFIG.md)

---

## License

GearOS requires a valid license key to run.
Skills verify the key against `https://api.gearos.eu/license` on each use.

Tiers: **Starter** (€49/mo) · **Pro** (€99/mo) · **Agency** (€199/mo)

See [docs/SKILLS_REFERENCE.md](docs/SKILLS_REFERENCE.md) for what each tier includes.

---

## Privacy

GearOS runs locally on your machine. No vehicle data, contact lists, or emails
are sent to GearOS servers. The only external call is the license key validation.

---

*Built for EU automotive dealers. Works with mobile.de, AutoScout24, Gmail, LinkedIn, and local Excel files.*
