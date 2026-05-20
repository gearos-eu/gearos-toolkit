---
name: b2b-outreach-generator
description: >
  Generates personalized B2B emails for dealers selling the same vehicle at a higher price.
  Creates Gmail drafts ready to send. Never auto-sends — always requires explicit approval.
  Reads company identity from config/company.json, voice from config/outreach_voice.md,
  email templates from templates/emails/, exclude rules from config/inventory_source.json.

  Use whenever the user says:
  - "send outreach for [model]", "email dealers for [model]"
  - "create B2B campaign", "write emails to dealers"
  - or any variation of B2B email outreach to other dealers
requires: ["claude-in-chrome"]
---

# B2B Outreach Generator

Automates the full B2B outreach process: find competitors → get contact info →
generate personalized emails → create Gmail drafts → wait for send approval.

---

## Step 0 — Read config

**From `config/company.json`:**
- `name`, `website`, `email`, `phone`, `owner_name`, `owner_title`

**From `config/outreach_voice.md`:**
- Tone, phrases to use, phrases to avoid, signature style

**From `config/inventory_source.json`:**
- `b2b_contacts.path` → path to your B2B contacts XLSX (for exclude check)

**From `templates/emails/`:**
- `b2b_de.md` → German template
- `b2b_en.md` → English template
- Use language matching `config/languages.json` → `primary`

---

## Step 1 — Get vehicle details

Ask user (or read from context / competitor-pricing-monitor output):
- Model, year, mileage, power (kW/PS), drivetrain
- Color, key equipment
- Your B2B net price
- Your retail price

---

## Step 2 — Get competitor list

If `competitor-pricing-monitor` was already run → use those results.
Otherwise run Step 2-3 from `competitor-pricing-monitor` first.

**Target: 5-8 dealers** with same model at higher price.

---

## Step 3 — Pre-send checks (MANDATORY — never skip)

### Check A — Sent email duplicate check

For each recipient email, search Gmail:
```
in:sent to:[recipient_email] newer_than:30d
```

Classify each recipient:
- **KEEP** → no recent contact, or last email was different model
- **MODIFY** → contacted before but different model/price range → add "follow-up" note
- **SKIP** → recipient explicitly declined, asked for later contact, or same model sent <30 days ago

Show results to user in a table before creating drafts.

### Check B — Verify market price via browser

Always check real mobile.de listings via browser (not URL params — they are unreliable).
Steps:
1. Navigate to mobile.de
2. Select make/model via UI
3. Set year ±1, similar mileage range
4. Read first 10-20 listing prices
5. Note the range: `[MIN €] – [MAX €] gross`

Include this verified range in each email as market reference.

### Check C — Exclude list

Before finalizing recipient list, remove:
- Any emails listed in `config/inventory_source.json` → `permanent_exclude_emails` (if dealer has configured this)
- Transport/logistics contacts (if B2B xlsx is available)
- Authorized dealers of a different brand than the car being offered

Show user: `Excluded [N] contacts — reasons: [list]`

---

## Step 4 — Generate personalized emails

For each approved recipient, fill the template from `templates/emails/b2b_[lang].md`:

Personalize:
- Greeting (use owner name if found, otherwise "Damen und Herren")
- Their current listing price → `[DEALER_PRICE]`
- Price delta → `[DELTA]`
- Market reference range from Step 3B

Apply voice rules from `config/outreach_voice.md`:
- Use phrases dealer has defined
- Avoid blocked phrases
- Match tone setting

---

## Step 5 — Show pre-draft summary

Before creating any Gmail drafts, show:

```
📋 Pre-send summary

Sent-check results:
  ✅ KEEP: [N] recipients
  ⚠️ MODIFY: [N] (follow-up note added)
  ❌ SKIP: [N] — [reasons]

Market reference (verified mobile.de [DATE]):
  [N] listings, range [MIN]–[MAX] € gross

Excluded: [N] contacts — [reasons]

Final batch: [N] emails ready
Proceed to create Gmail drafts?
```

Wait for user confirmation.

---

## Step 6 — Create Gmail drafts

For each approved recipient:
1. Open Gmail compose URL:
   ```
   https://mail.google.com/mail/u/0/?view=cm&fs=1&to=[EMAIL]&su=[SUBJECT_URL_ENCODED]
   ```
2. Wait 2 seconds for compose window
3. Inject email body via JavaScript (never use `type` — non-ASCII chars break):
   ```javascript
   const bodyDiv = document.querySelector('div[aria-label="Message Body"]') ||
                   document.querySelector('div[role="textbox"][aria-multiline="true"]');
   bodyDiv.focus();
   const sel = window.getSelection();
   const range = document.createRange();
   range.setStart(bodyDiv, 0);
   range.collapse(true);
   sel.removeAllRanges();
   sel.addRange(range);
   document.execCommand('insertText', false, EMAIL_TEXT_WITH_UNICODE_ESCAPES);
   ```
4. Escape special characters using `connectors/gmail.json` → `chars_to_escape`
5. Wait 5 seconds for autosave
6. Close compose window

Report progress: `✅ Draft created: [Dealer name] ([email])`

---

## Step 7 — Final report

```
✅ Done — [N] Gmail drafts created

Drafts ready in Gmail → Drafts folder.
Review and send manually, or say "send drafts" to send all.

⚠️ NEVER auto-sends. Explicit "send drafts" required.
```

---

## ⚠️ Send rule — CRITICAL

**NEVER send emails automatically.**
Only send after user says explicitly: "send", "send drafts", "odošli", "posli"
"ok" / "looks good" / "fine" = NOT permission to send. Always confirm:
```
Ready to send [N] emails. Confirm?
```
