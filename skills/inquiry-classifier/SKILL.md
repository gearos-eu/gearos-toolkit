---
name: inquiry-classifier
description: >
  Classifies incoming customer inquiries by intent and routes to the right response.
  Supports email, WhatsApp, and web form inquiries.
  Reads company identity from config/company.json, languages from config/languages.json.

  Use whenever the user says:
  - "classify this inquiry", "what does this customer want"
  - "reply to this email/message", "handle this inquiry"
  - or pastes a customer message for processing
---

# Inquiry Classifier

Reads a customer inquiry, classifies the intent, and suggests the appropriate response.

---

## Step 0 — Read config

**From `config/company.json`:** `name`, `email`, `phone`, `owner_name`
**From `config/languages.json`:** `primary` → respond in this language

---

## Step 1 — Classify the inquiry

Classify into one of these categories:

| Category | Signals |
|----------|---------|
| **price_request** | "how much", "what's the price", "cena", "preis", "cost" |
| **availability** | "is it still available", "do you have", "noch verfügbar" |
| **financing** | "loan", "installment", "leasing", "úver", "splátkový", "finanzierung" |
| **test_drive** | "test drive", "jazda", "probefahrt" |
| **history_question** | "accident", "service history", "havária", "servisná kniha", "unfallschaden" |
| **vat_question** | "VAT", "DPH", "MwSt", "invoice", "faktura" |
| **trade_in** | "trade in", "part exchange", "výmena", "inzahlung" |
| **reservation** | "reserve", "deposit", "rezervácia", "anzahlung" |
| **general_interest** | everything else — customer browsing |

---

## Step 2 — Generate response

Based on category, use appropriate response template.
Fill in vehicle details and company info from config.

**Response rules (from config/outreach_voice.md):**
- Match dealer's tone setting
- Use dealer's defined phrases
- Respond in `config/languages.json` → `primary` language
- Keep response under 150 words unless category requires detail

**Category-specific guidance:**

**price_request** → Confirm price, mention if VAT is included/excluded, invite to visit or call

**availability** → Confirm availability (or note it changes fast), suggest reservation

**financing** → Mention you work with financing partners OR recommend they contact their bank — never give specific rates you can't guarantee

**test_drive** → Confirm it's possible, ask for preferred time

**history_question** → Confirm service history status from vehicle data, mention CarVertical or similar if available

**vat_question** → Answer based on vehicle type (used = VAT margin scheme, new/company = full VAT deductible)

**trade_in** → Express interest, ask for details (make, model, year, mileage, condition)

**reservation** → Explain deposit process, amount, refund policy

**general_interest** → Short friendly reply, invite to see the car, share contact

---

## Step 3 — Output format

```
📩 Inquiry Classification

Category: [CATEGORY]
Language detected: [LANG]
Sentiment: [positive / neutral / impatient]

Suggested response:
─────────────────
[RESPONSE TEXT]
─────────────────

Send this reply? (yes / edit first)
```

Wait for user confirmation before sending anything.
