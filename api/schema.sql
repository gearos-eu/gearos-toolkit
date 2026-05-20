-- GearOS License Database
-- Run this in Supabase SQL Editor

create table if not exists licenses (
  id          uuid primary key default gen_random_uuid(),
  key         text unique not null,          -- e.g. GEAR-A1B2-C3D4-E5F6
  tier        text not null,                 -- starter | pro | agency
  issued_to   text not null,                 -- dealer name or email
  email       text not null,                 -- customer email
  stripe_customer_id text,                   -- Stripe customer ID
  stripe_subscription_id text,               -- Stripe subscription ID
  valid_until date not null,                 -- license expiry
  active      boolean not null default true,
  created_at  timestamptz default now()
);

-- Index for fast key lookups (called on every skill run)
create index if not exists licenses_key_idx on licenses(key);

-- Row-level security: only service role can read/write
alter table licenses enable row level security;

create policy "service_role_only" on licenses
  using (auth.role() = 'service_role');
