---
name: daily-digest
description: >
  Morning briefing for the dealer. Summarizes: open inquiries, pending B2B follow-ups,
  notable price movements on watched models, and 3 suggested actions for the day.
  Pulls data from Gmail, B2B contacts xlsx, and optionally mobile.de.
  Reads all config from config/ directory.

  Use whenever the user says:
  - "daily digest", "morning briefing", "čo mám dnes robiť"
  - "what's pending", "show me the pipeline"
  - or run automatically at start of each Claude session
requires: ["claude-in-chrome"]
---

# Daily Digest

Morning briefing: pipeline, follow-ups, market pulse, and today's action plan.

---

## Step 0 — Read config

**From `config/company.json`:** `owner_name`, `email`
**From `config/inventory_source.json`:** `b2b_contacts.path`
**From `config/pricing_rules.json`:** `purchase_budget`, `segment_markups`
**From `config/languages.json`:** `primary` → digest language

Date: today's date from system.

---

## Step 1 — Scan Gmail inbox

Navigate to Gmail (`mail.google.com`), search for:
- `is:unread newer_than:2d` → unread emails from last 2 days
- `in:sent newer_than:7d subject:B2B OR subject:BMW OR subject:Mercedes` → recent outreach

For each unread email, extract: sender, subject, date, first 2 lines.
Classify each using inquiry-classifier categories (price_request, availability, financing, etc.)

**Cap at 10 emails** — if more, show count and top 5 by recency.

---

## Step 2 — Check B2B follow-up pipeline

Read `b2b_contacts` xlsx from `config/inventory_source.json`:
- Filter contacts where `last_contact_date` exists
- Calculate days since last contact
- Flag:
  - **Due today (D+7):** last_contact 7 days ago, status = `sent`
  - **Overdue (D+14, D+21):** last_contact 14–21 days ago, status = `sent`
  - **Hot (replied, not closed):** status = `replied` or `interested`

Cap at 10 entries per category.

---

## Step 3 — Market pulse (optional, only if run in morning)

Quick scan of mobile.de for 1–2 watched models (from last scan session or user-defined watchlist):
- Any new listings matching procurement criteria from `pricing_rules.json`?
- Any significant price drops (>5%) on previously seen listings?

**Skip this step** if user says "quick digest" or if last scan was within 24h.

---

## Step 4 — Compose digest

Output structure:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Daily Digest — [DAY, DATE]
Guten Morgen, [OWNER_NAME].
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📬 INBOX ([N] unread)
  1. [Sender] — "[Subject]" · [Category] · [time ago]
  2. ...
  [No unread emails] if empty

📤 B2B FOLLOW-UPS
  Due today (D+7):
    · [Name] @ [Company] — sent [date]
  Overdue:
    · [Name] @ [Company] — [N] days, no reply
  Hot leads:
    · [Name] @ [Company] — replied [date], awaiting response

📈 MARKET PULSE
  · [Model]: [N] new listings matching criteria
  · [Model]: price drop on [listing] — was X€, now Y€
  [Skipped] if not run

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 TODAY'S 3 ACTIONS
  1. Reply to [Name] — [category] inquiry (high priority)
  2. Follow up [Contact] @ [Dealer] — D+7 due
  3. [Scan / Generate offer / other context-based suggestion]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Step 5 — Act on digest

After displaying, wait for user input:
- `reply [N]` → launch inquiry-classifier for email N
- `follow up [Name]` → launch b2b-outreach-generator for that contact
- `scan [model]` → launch car-listing-scanner
- `done` → close digest

Do not auto-trigger any actions — user drives what happens next.
