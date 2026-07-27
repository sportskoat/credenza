-- ═══════════════════════════════════════════════════════════════════════════
-- Shared shelf links — Pre-Launch LB-8
--
-- Run this once in the Supabase SQL editor (project uaweaziqrybvxfbacllb).
-- It is safe to run twice. Run 2026-07-26-shelves.sql first if you have not.
--
-- Access model, which is unlike either table before it:
--   * The OWNER reads and writes their own rows with their own token (RLS,
--     the same pattern as `shelves`).
--   * The PUBLIC reads one row by code, and does so through the /s/:id
--     Netlify function using the SERVICE ROLE. The anon role gets no select
--     policy at all.
--
-- The second half matters. A public select policy would let anyone list
-- every share on the site with one PostgREST call, and "unlisted" would mean
-- nothing. The function is the only public reader, and it only ever asks for
-- one exact code.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.shares (
  id         text        primary key,
  user_id    uuid        not null references auth.users on delete cascade,
  data       jsonb       not null,
  unlisted   boolean     not null default false,
  hide_footer boolean    not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

-- There is no view counter, on purpose. The /s/:id page is cached at the CDN,
-- so most reads never reach the function. A counter fed only by cache misses
-- reports a number far below the truth, and a wrong count shown as a fact is
-- worse than no count at all.

-- `id` is the 12-character share code from credenza-share.js. It is the
-- access control, so it is random and unguessable rather than sequential.

-- The owner's "my shares" list sorts newest-first.
create index if not exists shares_user_created_idx
  on public.shares (user_id, created_at desc);

alter table public.shares enable row level security;

-- Owner-only for every verb. There is deliberately NO policy granting the
-- anon role a select: see the header.

drop policy if exists "shares owner can read"   on public.shares;
drop policy if exists "shares owner can insert" on public.shares;
drop policy if exists "shares owner can update" on public.shares;
drop policy if exists "shares owner can delete" on public.shares;

create policy "shares owner can read"
  on public.shares for select
  using (auth.uid() = user_id);

create policy "shares owner can insert"
  on public.shares for insert
  with check (auth.uid() = user_id);

create policy "shares owner can update"
  on public.shares for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "shares owner can delete"
  on public.shares for delete
  using (auth.uid() = user_id);

-- Expired rows are not served: the function checks expires_at on every read.
-- This removes them for good, so a deleted account's expired shares do not
-- sit in the table forever. Run it by hand, or attach pg_cron later.
--
--   delete from public.shares where expires_at is not null and expires_at < now();

-- Verify after running:
--   select relrowsecurity from pg_class where relname = 'shares';   -- t
--   select count(*) from pg_policies where tablename = 'shares';    -- 4
--   select count(*) from pg_policies
--     where tablename = 'shares' and 'anon' = any(roles);           -- 0
