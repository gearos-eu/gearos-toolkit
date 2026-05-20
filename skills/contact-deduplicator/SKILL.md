---
name: contact-deduplicator
description: >
  Cleans your B2B contact list: finds duplicate emails, merges records,
  flags contacts who already received outreach, and enforces the permanent
  exclude list from config/inventory_source.json.

  Use whenever the user says:
  - "clean up contacts", "deduplicate CRM"
  - "check for duplicates", "skontroluj kontakty"
  - "who have I already contacted"
  - or before running a new b2b-outreach batch
requires: []
---

# Contact Deduplicator

Cleans the B2B contact xlsx: removes duplicates, enforces exclude list, flags already-contacted.

---

## Step 0 — Read config

**From `config/inventory_source.json`:**
- `b2b_contacts.path` → path to contacts xlsx
- `b2b_contacts.sheet_name` → active sheet
- `permanent_exclude_emails` → always-exclude list

---

## Step 1 — Load contacts

Read the xlsx file from `b2b_contacts.path`, sheet `b2b_contacts.sheet_name`.

Expected columns (flexible — adapt to actual headers):
- `email` (required)
- `name`, `company`, `country` (optional but used for dedup)
- `last_contact_date`, `status` (optional)

If columns differ from expected, map them and inform the user.

**Report:** total rows loaded, column mapping used.

---

## Step 2 — Detect duplicates

### 2A — Exact email duplicates
Find rows where `email` value appears more than once (case-insensitive).

### 2B — Domain-level duplicates
Group contacts by email domain (e.g., `@bmw-mueller.de`).
Flag if 3+ contacts exist at same domain — likely same dealership, over-contacting risk.

### 2C — Name fuzzy match (optional)
If `name` + `company` columns exist: flag pairs where both are >85% similar but emails differ.
(e.g., "Hans Müller, BMW Munich" vs "H. Müller, BMW München")

---

## Step 3 — Enforce exclude list

Check every email against `permanent_exclude_emails` from config.
Flag any matches — these must never receive outreach.

Also flag emails that appear in Gmail sent folder (`in:sent to:[email] newer_than:90d`) — already contacted recently.

---

## Step 4 — Present findings

```
🧹 Contact Deduplicator Report

File: [path]
Total contacts: [N]

DUPLICATES FOUND
  Exact:   [N] duplicate email addresses
  Domain:  [N] domains with 3+ contacts
  Fuzzy:   [N] likely-same person, different email

EXCLUDE LIST MATCHES
  [N] contacts on permanent exclude list:
    · [email] — [reason]

ALREADY CONTACTED (last 90 days)
  [N] contacts with recent outreach in Gmail

─────────────────────────
Clean recommendations:
  · Remove [N] exact duplicates (keep newest record)
  · Review [N] domain clusters
  · Remove [N] exclude list matches

Apply all recommendations? (yes / review first / export only)
```

---

## Step 5 — Apply changes

**Only after explicit user approval.**

Actions available:
- `remove duplicates` → delete duplicate rows, keep row with most data filled
- `remove excluded` → delete rows matching permanent_exclude_emails
- `export clean list` → save cleaned version as new file: `[original_name]_clean_[date].xlsx`

**Never overwrite the original file.** Always save as new file.

**Never auto-apply.** User must confirm each category of changes separately.

---

## Step 6 — Summary

```
✅ Deduplication complete

  Removed exact duplicates: [N]
  Removed excluded:         [N]
  Remaining contacts:       [N]

Saved to: [filename]_clean_[date].xlsx
```
