# GearOS — Skills Reference

Quick reference for all 8 GearOS skills.
For full documentation, open the `SKILL.md` file inside each skill's folder.

---

## How to invoke a skill

Type any natural phrase in Claude Code — GearOS matches it automatically.
Examples below show the most direct triggers.

---

## 1. car-listing-scanner

**What it does:** Scans mobile.de for vehicles matching your buying criteria. Scores each listing and returns a shortlist with estimated margin.

**Invoke:**
```
scan mobile.de for BMW 3er
scan for Mercedes C-Class diesel
find me a good X5
```

**Config used:** `pricing_rules.json` (budget, mileage, age, segment markups, red flags)

**Output:** Scored shortlist — ✅ Recommend / 🟡 OK / ❌ Skip — with margin estimate for each.

**Requires:** Claude in Chrome

---

## 2. competitor-pricing-monitor

**What it does:** Finds German dealers selling the same model at a higher price than your retail. Identifies B2B outreach targets.

**Invoke:**
```
find competitors for BMW 320d
who sells X5 more expensively
check market price for Mercedes C220d 2023
```

**Config used:** `pricing_rules.json` (retail price calculation, segment markup)

**Output:** Ranked list of dealers with their price, delta vs your retail, and contact info.

**Note:** Year filter must be applied manually via JS — mobile.de URL params for year are unreliable. Skill compares same EZ ±1 year only.

**Requires:** Claude in Chrome

---

## 3. b2b-outreach-generator

**What it does:** Generates personalized B2B email drafts for German dealers. Creates Gmail drafts — never auto-sends.

**Invoke:**
```
generate B2B email for WELLER Hamburg
write outreach for competitors from last scan
create email for [dealer name]
```

**Config used:** `company.json` (sender identity), `outreach_voice.md` (tone), `languages.json` (language), `inventory_source.json` (exclude list)

**Output:** Email draft in Gmail. Requires explicit approval before creating draft; requires "send"/"posli" command before sending.

**Pre-send checks (mandatory):**
1. Gmail sent-check: no outreach to this address in last 30 days
2. Market price verified via browser (not from memory)
3. Exclude list checked

**Requires:** Claude in Chrome (for Gmail draft creation)

---

## 4. inquiry-classifier

**What it does:** Classifies an incoming customer inquiry and generates the appropriate reply in your primary language.

**Invoke:**
```
classify this inquiry: [paste email or message]
reply to this email: [paste]
handle this WhatsApp message: [paste]
```

**Categories:** price_request, availability, financing, test_drive, history_question, vat_question, trade_in, reservation, general_interest

**Config used:** `company.json` (identity), `languages.json` (reply language)

**Output:** Category + detected language + sentiment + suggested reply. Always waits for confirmation before sending.

---

## 5. vehicle-doc-generator

**What it does:** Generates a branded PDF price offer from a mobile.de listing URL or manual vehicle data. Calculates selling price using your margin config.

**Invoke:**
```
make a PDF for this car: [mobile.de URL]
generate offer for BMW 320d xDrive 2023
create price sheet for [vehicle details]
```

**Config used:** `company.json` (branding, contact), `pricing_rules.json` (segment markup, transport cost), `languages.json` (document language)

**Output:** PDF file named `offer_[Make]_[Model]_[EZ]_[Date].pdf`. Shows price calculation for approval before generating.

**Requires:** Claude in Chrome (for listing scrape)

---

## 6. linkedin-prospector

**What it does:** Full LinkedIn B2B workflow — finds decision-maker contacts at target dealerships, sends connection requests, follows up (D+7, D+14, D+21), and syncs to CRM.

**Invoke:**
```
find LinkedIn contacts at WELLER Hamburg
send LinkedIn outreach to dealers from last scan
follow up on LinkedIn
check LinkedIn replies
```

**Config used:** `company.json` (sender identity), `outreach_voice.md` (message tone), `inventory_source.json` (CRM path for dedup)

**Limits:** Max 15 connection requests per session. Never auto-sends — requires approval per batch.

**Follow-up sequence:** D+0 (intro after connect) → D+7 → D+14 → D+21 → stop.

**Requires:** Claude in Chrome (LinkedIn automation)

---

## 7. daily-digest

**What it does:** Morning briefing — unread emails, B2B follow-ups due today, market pulse for watched models, and 3 suggested actions.

**Invoke:**
```
daily digest
morning briefing
čo mám dnes robiť
what's pending
```

**Config used:** `company.json` (owner name), `inventory_source.json` (CRM for follow-up pipeline), `pricing_rules.json` (procurement criteria for market pulse)

**Output:** Structured briefing with inbox summary, follow-up pipeline, optional market scan, and prioritized action list.

**Note:** Does not auto-trigger any actions — user selects what to act on.

**Requires:** Claude in Chrome (Gmail access)

---

## 8. contact-deduplicator

**What it does:** Cleans your B2B contact list — removes exact and fuzzy duplicates, flags recently contacted addresses, enforces permanent exclude list.

**Invoke:**
```
clean up contacts
deduplicate CRM
check for duplicates in my contact list
who have I already contacted
```

**Config used:** `inventory_source.json` (file path + exclude list)

**Output:** Report of duplicates found, exclude list matches, recently contacted. Never overwrites original file — always saves as `[name]_clean_[date].xlsx`.

**Note:** Run before every new B2B outreach batch.

---

## Skill combinations (common workflows)

**Procurement workflow:**
```
car-listing-scanner → (buy car) → vehicle-doc-generator
```

**B2B outreach workflow:**
```
competitor-pricing-monitor → b2b-outreach-generator → linkedin-prospector
```

**Daily routine:**
```
daily-digest → inquiry-classifier (for inbox) → b2b-outreach-generator (for follow-ups)
```

**New campaign prep:**
```
contact-deduplicator → b2b-outreach-generator
```

---

## Skill availability by license tier

| Skill | Starter | Pro | Agency |
|-------|---------|-----|--------|
| car-listing-scanner | ✅ | ✅ | ✅ |
| inquiry-classifier | ✅ | ✅ | ✅ |
| vehicle-doc-generator | ✅ | ✅ | ✅ |
| b2b-outreach-generator | — | ✅ | ✅ |
| competitor-pricing-monitor | — | ✅ | ✅ |
| daily-digest | — | ✅ | ✅ |
| linkedin-prospector | — | ✅ | ✅ |
| contact-deduplicator | — | ✅ | ✅ |
