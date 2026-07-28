-- ═══════════════════════════════════════════════════════════════════════════
-- Shared daily spend ceiling — the fix for the per-instance cap
--
-- Run this once in the Supabase SQL editor (project uaweaziqrybvxfbacllb).
-- It is safe to run twice.
--
-- WHY THIS EXISTS
--
-- `preview/netlify/functions/lib/limit.js` held the running daily Anthropic
-- cost in a module variable. Netlify runs many copies of a function at once,
-- and each copy starts that variable at zero. So a $5 ceiling was $5 PER COPY.
-- Under real traffic the true ceiling was unknown and unbounded.
--
-- This table is the one shared counter. Every paid call adds its cost here,
-- and every paid call reads the total back before it starts.
--
-- ACCESS MODEL
--
-- RLS is on and there are NO policies. That is deliberate. Only the service
-- role touches this table, and the service role bypasses RLS. No browser, no
-- anon key and no signed-in user can read or write our spend figures.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.daily_spend (
  day        date          primary key,
  cost_usd   numeric(14,6) not null default 0,
  calls      integer       not null default 0,
  updated_at timestamptz   not null default now()
);

alter table public.daily_spend enable row level security;

-- No policies on purpose. See the header.

-- One atomic add. Two instances that finish a call in the same millisecond
-- both land, because the addition happens inside the database rather than in
-- application code. A read-modify-write from the function would lose one of
-- them, and a lost increment is money spent that the ceiling never sees.
--
-- The function returns the NEW total so the caller learns the shared figure
-- without a second round trip.
create or replace function public.add_daily_spend(p_day date, p_cost numeric)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total numeric;
begin
  insert into public.daily_spend (day, cost_usd, calls)
  values (p_day, greatest(p_cost, 0), 1)
  on conflict (day) do update
    set cost_usd   = public.daily_spend.cost_usd + greatest(excluded.cost_usd, 0),
        calls      = public.daily_spend.calls + 1,
        updated_at = now()
  returning public.daily_spend.cost_usd into v_total;
  return v_total;
end;
$$;

-- security definer runs as the owner, so the grant list has to be explicit.
-- Only the service role may call it.
revoke all on function public.add_daily_spend(date, numeric) from public;
revoke all on function public.add_daily_spend(date, numeric) from anon;
revoke all on function public.add_daily_spend(date, numeric) from authenticated;
grant execute on function public.add_daily_spend(date, numeric) to service_role;

-- Old days are kept. The table gains one row per day, so it stays small for
-- years, and the history is the only record of what the app actually costs.
-- Trim it by hand if you ever want to:
--
--   delete from public.daily_spend where day < current_date - interval '400 days';

-- Verify after running:
--   select relrowsecurity from pg_class where relname = 'daily_spend';    -- t
--   select count(*) from pg_policies where tablename = 'daily_spend';     -- 0
--   select public.add_daily_spend(current_date, 0.01);                    -- 0.010000
--   select * from public.daily_spend;                                     -- one row
--   delete from public.daily_spend where day = current_date;              -- undo the test
