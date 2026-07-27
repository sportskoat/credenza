-- ═══════════════════════════════════════════════════════════════════════════
-- Cloud sync for the shelf — Pre-Launch LB-7
--
-- Run this once in the Supabase SQL editor (project uaweaziqrybvxfbacllb).
-- It is safe to run twice.
--
-- This table is DIFFERENT from `entitlements` and `processed_events`. Those
-- two are touched only by the service role, so they carry no row-level
-- security. The browser writes this one directly with the signed-in user's
-- own token, so RLS is the only thing standing between two accounts. Do not
-- copy the "no row-level security" comment from Part-7-setup.md onto it.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.shelves (
  user_id    uuid primary key references auth.users on delete cascade,
  data       jsonb       not null,
  updated_at timestamptz not null default now()
);

-- One row per account. The whole shelf is one document, so there is no
-- second key and no need for an index beyond the primary key.

alter table public.shelves enable row level security;

-- Owner-only, all four verbs. `auth.uid()` is the id inside the caller's
-- access token, so a request carrying account A's token can never name
-- account B in user_id — the WITH CHECK clause blocks the write, not just
-- the read.

drop policy if exists "shelves owner can read"   on public.shelves;
drop policy if exists "shelves owner can insert" on public.shelves;
drop policy if exists "shelves owner can update" on public.shelves;
drop policy if exists "shelves owner can delete" on public.shelves;

create policy "shelves owner can read"
  on public.shelves for select
  using (auth.uid() = user_id);

create policy "shelves owner can insert"
  on public.shelves for insert
  with check (auth.uid() = user_id);

create policy "shelves owner can update"
  on public.shelves for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "shelves owner can delete"
  on public.shelves for delete
  using (auth.uid() = user_id);

-- The client pushes with `Prefer: resolution=merge-duplicates`, which is an
-- INSERT ... ON CONFLICT. PostgREST needs BOTH the insert and the update
-- policy for that to work, which is why all four exist above.

-- Keep updated_at honest even if a future caller forgets to send it.
create or replace function public.shelves_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists shelves_set_updated_at on public.shelves;
create trigger shelves_set_updated_at
  before insert or update on public.shelves
  for each row execute function public.shelves_touch_updated_at();

-- Verify after running:
--   select relrowsecurity from pg_class where relname = 'shelves';   -- t
--   select count(*) from pg_policies where tablename = 'shelves';    -- 4
