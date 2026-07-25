# Part 7 setup — accounts, Stripe, and the entitlement store

This doc lists what Kyle must create outside the code, and the architecture
the code builds on. Read `docs/Execution-Plan.md` Part 7 first.

**Decisions (Kyle, 2026-07-24):** Stripe with the Customer Portal. $5/month,
$39/year. Email+password and Google sign-in (Pro-plan §11).

## Architecture

- **Accounts:** Supabase Auth. Email+password and Google OAuth. The app signs
  in with `supabase-js` in the browser. Supabase issues a JWT session.
- **Sessions replace the browser key.** Paid requests send the Supabase JWT,
  not `x-credenza-key`. The functions verify the JWT and load the entitlement
  record. The `VITE_` shared key goes away when this ships.
- **Entitlement store:** one Postgres table `entitlements` (service role
  only). The record shape lives in `netlify/functions/lib/entitlements.js`
  (`newEntitlement`). All status math is in that one file, with tests.
- **Billing:** Stripe Checkout for the two prices. The Customer Portal for
  card changes, cancellation, and invoices. One webhook function processes
  five event types, one time each (`processed_events` table).
- **Offline:** the `entitlement` function returns a signed snapshot
  (HMAC-SHA256, 24 h). The client caches it and works offline. The server
  re-checks every paid request. Tampering cannot pass the server.

## What Kyle creates

### 1. Supabase (accounts + entitlement table)

1. Create a project at supabase.com (free tier).
2. Authentication → Providers: enable **Email**. Enable **Google** and paste
   a Google OAuth client id + secret (create it in Google Cloud Console,
   redirect URL from the Supabase page).
3. SQL editor: run the schema below.
4. Copy these values for Netlify: Project URL (Settings → Data API),
   **publishable key** and **secret key** (Settings → API Keys — these are the
   new names for the anon and service_role keys). **No JWT secret is needed:**
   new projects sign tokens with ES256 (Settings → JWT Keys, ECC P-256) and
   the functions verify them against the public JWKS endpoint
   (`/auth/v1/.well-known/jwks.json`). `SUPABASE_JWT_SECRET` is only a
   fallback for legacy HS256 tokens.

```sql
create table entitlements (
  user_id uuid primary key references auth.users on delete cascade,
  record jsonb not null,
  updated_at timestamptz not null default now()
);

create table processed_events (
  event_id text primary key,
  processed_at timestamptz not null default now()
);

-- No row-level security: only the service role touches these tables.
```

### 2. Stripe (billing)

1. Create a Stripe account (or use the existing one).
2. Create one product: **Credenza Pro**.
3. Add two prices: **$5.00 / month** and **$39.00 / year**. Copy both price
   ids (`price_...`).
4. Developers → Webhooks: add the endpoint
   `https://credenzafashion.com/.netlify/functions/stripe-webhook`.
   Subscribe to: `checkout.session.completed`,
   `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.
   Copy the signing secret (`whsec_...`).
5. Settings → Billing → Customer portal: enable it. Allow cancellation and
   payment-method updates.
6. Copy the secret API key (`sk_...`). Use test mode first, then live.

### 3. Netlify env vars

Set these on the site (all contexts):

| Var | Value |
|---|---|
| `SUPABASE_URL` | Supabase project URL — set: `https://uaweaziqrybvxfbacllb.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase **publishable key** (also `VITE_SUPABASE_ANON_KEY` for the browser) — set 2026-07-24 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase **secret key** — server only — set 2026-07-24 |
| `SUPABASE_JWT_SECRET` | Legacy HS256 fallback only — optional, not needed on the new key system |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_PRICE_MONTHLY` | price id for $5/month |
| `STRIPE_PRICE_YEARLY` | price id for $39/year |
| `ENTITLEMENT_SIGNING_SECRET` | any long random string — signs offline snapshots — set 2026-07-24 (generated) |
| `VITE_SUPABASE_URL` | same Supabase URL, for the browser bundle — set 2026-07-24 |

## Build order in code

- [x] 7a. Entitlement engine + lifecycle tests (`lib/entitlements.js`,
      `test/entitlements.test.js`).
- [x] 7c. Entitlement store functions: load/save records
      (`lib/entitlement-store.js`, `lib/jwt.js`), `entitlement` function
      (verify JWT → signed snapshot), `stripe-webhook` (verify signature →
      idempotent apply). 16 tests in `test/part7c.test.js`. **All Supabase env
      vars set on Netlify 2026-07-24** (project `uaweaziqrybvxfbacllb`):
      SUPABASE_URL, VITE_SUPABASE_URL, SUPABASE_ANON_KEY,
      VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
      ENTITLEMENT_SIGNING_SECRET. The project uses the NEW JWT Signing Keys
      (ECC P-256) — jwt.js verifies ES256 against the JWKS endpoint, with
      HS256 as a legacy fallback only. **The first secret key was pasted in
      chat — roll it in Supabase (API Keys) once the flow works, then update
      Netlify.**
- [x] 7d. Checkout + portal functions. (`checkout.js` + `portal.js`, `lib/stripe.js` + `lib/auth.js`, `preview/test/part7d.test.js` — 2026-07-25)
- [ ] 7e. Client: sign-in UI in ProfileSheet, session on paid requests,
      offline snapshot cache, free-limit enforcement, account export +
      deletion.
- [ ] 7f. Remove the `VITE_` shared key from paid routes.
- [ ] 7g. Real-card test payment (the gate).
