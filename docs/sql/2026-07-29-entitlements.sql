-- ═══════════════════════════════════════════════════════════════════════════
-- Accounts and billing — the two tables Part 7 forgot
--
-- Run this once in the Supabase SQL editor (project uaweaziqrybvxfbacllb).
-- It is safe to run twice.
--
-- WHY THIS FILE EXISTS. The SQL below has lived in docs/Part-7-setup.md since
-- 2026-07-24, but it was never copied into docs/sql/ with the other
-- migrations. So nobody ran it. Probed live 2026-07-29 with the anon key:
-- `shelves` and `shares` answer 401 (they exist, RLS blocks anon) while
-- `entitlements` and `processed_events` answer PGRST205 "not found in schema
-- cache" (they do not exist). Netlify's SUPABASE_URL and preview/.env's
-- VITE_SUPABASE_URL both point at uaweaziqrybvxfbacllb, so the payment code
-- writes to the same project that is missing the tables.
--
-- THE FAULT THIS FIXES. stripe-webhook.js loads and upserts an entitlement
-- record on every subscription event. With no table the upsert throws, the
-- handler returns 500, and the payer stays on the free plan while Stripe
-- keeps the money. It has never shown itself because no real card has ever
-- been used (Kyle-Launch-Runbook.md, launch gate Step 4, unchecked).
--
-- These two tables are DIFFERENT from `shelves` and `shares`. Only the
-- service role touches them, so they carry no row-level security. The browser
-- never reads or writes them directly — it reads a signed snapshot from the
-- `entitlement` function instead.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.entitlements (
  user_id    uuid primary key references auth.users on delete cascade,
  record     jsonb       not null,
  updated_at timestamptz not null default now()
);

-- One row per account. `record` holds the whole entitlement document that
-- lib/entitlements.js builds, so there is no second key and no index beyond
-- the primary key.

create table if not exists public.processed_events (
  event_id     text primary key,
  processed_at timestamptz not null default now()
);

-- Stripe retries a webhook until it gets a 200, so the same event id can
-- arrive more than once. entitlement-store.js checks this table first and
-- returns a no-op 200 on a repeat. Without the table every retry re-applies
-- the event.

-- No row-level security on either table, by design. Revoke the browser roles
-- so a leaked anon key can never read one customer's billing record.

revoke all on public.entitlements     from anon, authenticated;
revoke all on public.processed_events from anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- How to confirm it worked
--
-- Run this last. Both rows must come back.
--
--   select table_name from information_schema.tables
--   where table_schema = 'public'
--     and table_name in ('entitlements', 'processed_events');
-- ═══════════════════════════════════════════════════════════════════════════
