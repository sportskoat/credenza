-- ═══════════════════════════════════════════════════════════════════════════
-- Shared chart cache — one paid chart read serves every later reader
--
-- Run this once in the Supabase SQL editor (project uaweaziqrybvxfbacllb).
-- It is safe to run twice.
--
-- WHY THIS EXISTS
--
-- Kyle 2026-08-05: "IF ONE PERSON HAS LOOKED AT THIS SPECIFIC LINK FOR AN
-- ALBUM OR WEIDIAN/TAOBAO LINK AND GOT THE CHART, WHY ARE WE WASTING ANOTHER
-- AI CHART READ?" Before this table, the reuse memory lived on each device.
-- Every new reader of a chart photo paid Anthropic again, even when a
-- hundred people had read the same photo before them.
--
-- This table is the one shared memory. `chart-vision` checks it before it
-- pays for a read and writes to it after a found chart.
--
-- THE KEY IS THE PHOTO, NEVER THE ALBUM AND NEVER THE LINK
--
-- Kyle: "sometimes Yupoo albums have multiple different items of clothing."
-- The image_key is the fingerprint of the chart PHOTO itself. One album with
-- ten shirts holds ten different chart photos — ten separate rows, and one
-- shirt can never borrow another shirt's chart. The same photo collapses to
-- one key across link shapes and CDN size variants, so a shorthand yupoo
-- link and a long one share the read.
--
-- ACCESS MODEL
--
-- RLS is on and there are NO policies. That is deliberate. Only the service
-- role touches this table, and the service role bypasses RLS. No browser, no
-- anon key and no signed-in user can read or write the cache.
--
-- WITHOUT THIS TABLE the reader still works: every cache path fails open to
-- a normal paid read. The table only turns the savings on.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.chart_cache (
  image_key  text        primary key,
  chart_text text        not null,
  created_at timestamptz not null default now()
);

alter table public.chart_cache enable row level security;

-- No policies on purpose. See the header.

-- The table gains one row per chart photo ever read. Rows are a few hundred
-- bytes. Negatives are never stored: a photo the reader found no chart in
-- earns no row, so a later reader may pay for the same empty look — that is
-- deliberate, because a read made during a model outage must not poison the
-- answer for everyone after it.
--
-- Verify after running:
--   select relrowsecurity from pg_class where relname = 'chart_cache';    -- t
--   select count(*) from pg_policies where tablename = 'chart_cache';     -- 0
