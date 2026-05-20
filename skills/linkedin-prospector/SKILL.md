---
name: linkedin-prospector
description: >
  Full LinkedIn B2B workflow for automotive dealers.
  Find decision-maker contacts at target dealerships, send personalized
  connection requests, qualify replies, run follow-up sequence (D+7, D+14, D+21),
  and extract emails for CRM.
  Reads identity and voice from config/company.json and config/outreach_voice.md.

  Use whenever the user says:
  - "find LinkedIn contacts at [dealer]", "prospektuj na LinkedIn"
  - "send LinkedIn outreach", "follow up on LinkedIn"
  - or after b2b-outreach-generator finds target dealers
requires: ["claude-in-chrome"]
---

# LinkedIn Prospector

Three-phase LinkedIn B2B workflow: Find → Connect → Follow-up.

---

## Step 0 — Read config

**From `config/company.json`:** `owner_name`, `name`, `website`
**From `config/outreach_voice.md`:** tone, phrases, anti-patterns
**From `config/languages.json`:** `primary` → use for messages
**From `config/inventory_source.json`:** `b2b_contacts.path` → CRM file for dedup check

---

## Phase 1 — FIND contacts

### Step 1A — Get target dealer list

Accept input:
- List of dealer names (from competitor-pricing-monitor output), OR
- Manual: "find contacts at [Dealer Name] [City]"

### Step 1B — Search LinkedIn

For each dealer:
1. Navigate: `https://www.linkedin.com/search/results/people/?keywords=[DEALER+NAME]&origin=SWITCH_SEARCH_VERTICAL`
2. Filter: Current company → [dealer name]
3. Target job titles (in order of priority):
   - Geschäftsführer / CEO / Inhaber / Owner
   - Verkaufsleiter / Head of Sales
   - Einkäufer / Procurement / Ankauf
   - Händler / Dealer Manager

4. For each contact found, extract:
   - Full name, job title, company
   - LinkedIn profile URL
   - Connection degree (1st / 2nd / 3rd)

**Skip if:** already connected, already in CRM, or in exclude list.

### Step 1C — Present findings

```
🔍 LinkedIn Contacts Found — [DEALER NAME]

1. [Name] | [Title] | [Degree]
   → [linkedin.com/in/...]
2. ...

Select contacts to approach (1,2,3 / all / skip):
```

Wait for user selection before proceeding.

---

## Phase 2 — CONNECT

### Step 2A — Compose connection request

Max 300 characters. Language from config. No generic phrases.

Template structure:
```
Guten Tag [FIRST_NAME],

ich bin [OWNER_NAME] von [COMPANY] aus Bratislava —
wir spezialisieren uns auf [SEGMENT] Fahrzeuge für
den deutschen Markt. Würde mich über Kontakt freuen.
```

Adapt based on: model they sell, any shared connection, market context.

### Step 2B — Send requests

**Limit:** max 15 connection requests per session (LinkedIn daily limit safety).

For each selected contact:
1. Navigate to profile
2. Click "Connect"
3. Add note (inject text via JS input fill)
4. Confirm send

**⚠️ Never auto-send.** Show each message and wait for user approval per batch:
```
Send these [N] connection requests?
[list of names + message preview]
→ yes / edit / skip
```

---

## Phase 3 — FOLLOW-UP

### Step 3A — Check replies

For pending contacts (sent but not connected):
1. Navigate to LinkedIn Messages / My Network → Sent
2. Check each pending request status
3. Flag: connected / pending / declined

### Step 3B — Follow-up sequence

For newly connected contacts (no reply yet):

| Day | Action | Message length |
|-----|--------|----------------|
| D+0 | Connection accepted → send intro message | 100–150 words |
| D+7 | No reply → follow-up with vehicle offer | 80–120 words |
| D+14 | No reply → last follow-up, different angle | 60–80 words |
| D+21 | No reply → stop, mark as cold | — |

Each message is generated fresh — never copy-paste the previous one.

### Step 3C — Qualify replies

For received replies, classify intent:
- `interested` → pass to b2b-outreach-generator for email follow-up
- `not_now` → schedule re-contact in 60 days
- `not_relevant` → add to exclude list
- `request_info` → generate vehicle details response

---

## Step 4 — CRM sync

After each session, append new contacts to `b2b_contacts` xlsx:
- Name, title, company, LinkedIn URL, email (if extracted), status, last_contact_date, notes

File path from `config/inventory_source.json` → `b2b_contacts.path`.

---

## Output format

```
📊 LinkedIn Session Summary

Contacts found:    [N]
Requests sent:     [N]
New connections:   [N]
Replies received:  [N]

Follow-ups due:
  D+7:  [Name] @ [Company]
  D+14: [Name] @ [Company]

Next action: [suggested]
```
