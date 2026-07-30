-- ═══════════════════════════════════════════════════════════════════════════
-- Shelf sync grant for signed-in users — 2026-07-30
--
-- Run this once in the Supabase SQL editor (project uaweaziqrybvxfbacllb).
-- It is safe to run twice. Run 2026-07-30-service-role-grants.sql first.
--
-- Why this file exists. 2026-07-30-service-role-grants.sql fixed OUR SERVER
-- (billing, shared links, the daily spend ledger). It did not fix the
-- BROWSER. preview/src/sync.js pushes and pulls public.shelves directly with
-- the signed-in user's own access token, which reaches Postgres as the
-- `authenticated` role. Measured on the live project 2026-07-30 with a real
-- signed-in token: every verb returned
--   403 {"code":"42501","message":"permission denied for table shelves"}
-- so cloud shelf sync was dead for every account.
--
-- Safety. public.shelves has row level security enabled and four owner-only
-- policies (2026-07-26-shelves.sql). A table grant does not bypass RLS, so
-- account A still cannot read or write account B's row. The grant only lets
-- the role reach the table at all; the policies still decide the rows.
--
-- Deliberately NOT granted here:
--   * anon          — a signed-out visitor has no shelf on the server.
--   * public.shares — only the Netlify functions touch it, with the service
--                     role. A grant to `authenticated` would let a signed-in
--                     caller list rows the /s/:id function is meant to own.
--   * public.entitlements, processed_events, daily_spend — server only, and
--     2026-07-30-service-role-grants.sql revokes anon and authenticated on
--     purpose. Do not add them.
-- ═══════════════════════════════════════════════════════════════════════════

grant usage on schema public to authenticated;

grant select, insert, update, delete on public.shelves to authenticated;

-- Verify after running. As a signed-in user, PostgREST must answer 200 for
--   GET  /rest/v1/shelves?select=user_id&limit=1
-- and the same call with the anon key alone must still answer 401.
