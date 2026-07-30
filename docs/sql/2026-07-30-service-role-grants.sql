-- 2026-07-30 — the server role has no table privileges. Run this once.
--
-- SYMPTOM: every billing screen says "Billing is not answering right now",
-- and shelf sync never saves. Cause found by probing the Data API with the
-- production SUPABASE_SERVICE_ROLE_KEY:
--
--   GET /rest/v1/entitlements  -> 403
--   {"code":"42501","message":"permission denied for table entitlements",
--    "hint":"Grant the required privileges to the current role with:
--            GRANT SELECT ON public.entitlements TO service_role;"}
--
-- All five tables answer 403 the same way: entitlements, processed_events,
-- shares, shelves, daily_spend. The tables EXIST and RLS is on; the
-- service_role simply holds no grant on them. The rpc add_daily_spend works,
-- because 2026-07-28-daily-spend.sql granted execute explicitly (line 67).
--
-- The Netlify functions are the only caller of this role
-- (preview/netlify/functions/lib/entitlement-store.js). RLS keeps anon and
-- authenticated out; nothing here widens public access.
--
-- Run it in the Supabase SQL editor. It is safe to run twice.

grant usage on schema public to service_role;

grant select, insert, update, delete on public.entitlements     to service_role;
grant select, insert, update, delete on public.processed_events to service_role;
grant select, insert, update, delete on public.shares           to service_role;
grant select, insert, update, delete on public.shelves          to service_role;
grant select, insert, update, delete on public.daily_spend      to service_role;

-- A table added later must not repeat this outage.
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;

-- Keep anon and authenticated out of the two server-only tables
-- (this repeats 2026-07-29-entitlements.sql lines 51-52 on purpose).
revoke all on public.entitlements     from anon, authenticated;
revoke all on public.processed_events from anon, authenticated;
revoke all on public.daily_spend      from anon, authenticated;

-- PROOF AFTER RUNNING: the select must answer 200 with [] or rows, not 403.
--   curl -s -o /dev/null -w "%{http_code}\n" \
--     "$SUPABASE_URL/rest/v1/entitlements?select=user_id&limit=1" \
--     -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
--     -H "authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
