// ═══════════════════════════════════════════════════════════════════════════════
// entitlement-store.js — the ONLY module that does entitlement I/O
// (Execution-Plan Part 7c)
//
// Talks to Supabase over the Data API (PostgREST) with the service role key.
// Two tables, both from docs/Part-7-setup.md:
//   entitlements      (user_id uuid pk, record jsonb, updated_at timestamptz)
//   processed_events  (event_id text pk, processed_at timestamptz)
// The service role bypasses RLS; no other role may touch these tables.
//
// makeStore takes its dependencies — handlers call storeFromEnv(), tests pass
// a mock fetchImpl. Every function throws on a non-ok PostgREST response; the
// caller (function handler) turns that into a 500.
// ═══════════════════════════════════════════════════════════════════════════════

function makeStore({ url, serviceKey, fetchImpl = null }) {
  if (!url || !serviceKey) throw new Error("makeStore needs url and serviceKey");
  const call = fetchImpl || fetch;
  const base = url.replace(/\/+$/, "") + "/rest/v1";
  const headers = {
    apikey: serviceKey,
    authorization: "Bearer " + serviceKey,
    "content-type": "application/json",
  };

  async function req(path, init) {
    const res = await call(base + path, { ...init, headers: { ...headers, ...(init && init.headers) } });
    if (!res.ok) {
      throw new Error("supabase " + (init && init.method ? init.method : "GET") + " " + path + " -> " + res.status);
    }
    return res;
  }

  // Load one record by user id. Returns the plain record, or null when the
  // user has no row yet (first sign-in).
  async function loadEntitlement(userId) {
    const res = await req("/entitlements?user_id=eq." + encodeURIComponent(userId) + "&select=record");
    const rows = await res.json();
    return Array.isArray(rows) && rows.length && rows[0] && rows[0].record ? rows[0].record : null;
  }

  // Load one record by Stripe customer id — the webhook's link back to the
  // user after checkout.session.completed has stored the id. PostgREST reads
  // jsonb fields with the ->> operator (url-encoded as -%3E%3E).
  async function loadByStripeCustomer(customerId) {
    const res = await req(
      "/entitlements?record-%3E%3EstripeCustomerId=eq." + encodeURIComponent(customerId) + "&select=record"
    );
    const rows = await res.json();
    return Array.isArray(rows) && rows.length && rows[0] && rows[0].record ? rows[0].record : null;
  }

  // Upsert the record. merge-duplicates = INSERT or UPDATE on the pk.
  async function saveEntitlement(record) {
    await req("/entitlements", {
      method: "POST",
      headers: { prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({
        user_id: record.userId,
        record,
        updated_at: new Date(record.updatedAt || Date.now()).toISOString(),
      }),
    });
    return record;
  }

  // Account deletion (Part 7e): remove the row entirely. Local data is the
  // user's own device business — only the server record goes.
  async function deleteEntitlement(userId) {
    await req("/entitlements?user_id=eq." + encodeURIComponent(userId), { method: "DELETE" });
  }

  // The synced shelf (LB-7). `on delete cascade` on shelves.user_id would
  // clear this when the auth user goes, but the row is deleted explicitly
  // anyway: the cascade is a database detail, and "delete my account" must
  // not depend on one to remove the customer's cards from our server.
  async function deleteShelf(userId) {
    await req("/shelves?user_id=eq." + encodeURIComponent(userId), { method: "DELETE" });
  }

  // ── Shared shelves (LB-8) ─────────────────────────────────────────────────
  // The `shares` table has NO anon select policy on purpose, so the service
  // role is the only public reader. Every read below asks for ONE exact code;
  // nothing here ever returns a list to an unauthenticated caller.

  async function createShare(row) {
    await req("/shares", {
      method: "POST",
      headers: { prefer: "return=minimal" },
      body: JSON.stringify({
        id: row.id,
        user_id: row.userId,
        data: row.data,
        unlisted: row.unlisted === true,
        hide_footer: row.hideFooter === true,
        expires_at: row.expiresAt ? new Date(row.expiresAt).toISOString() : null,
      }),
    });
    return row.id;
  }

  // The public read. Returns null for a code that does not exist — the caller
  // renders the branded 404 and never distinguishes "wrong code" from
  // "deleted share", because telling them apart is a probe oracle.
  async function loadShare(code) {
    const res = await req(
      "/shares?id=eq." + encodeURIComponent(code) + "&select=id,user_id,data,unlisted,hide_footer,expires_at&limit=1"
    );
    const rows = await res.json();
    if (!Array.isArray(rows) || !rows.length || !rows[0]) return null;
    const r = rows[0];
    return {
      id: r.id,
      userId: r.user_id,
      data: r.data,
      unlisted: r.unlisted === true,
      hideFooter: r.hide_footer === true,
      expiresAt: r.expires_at ? Date.parse(r.expires_at) : null,
    };
  }

  // The owner's own list. `data` is left out: the list needs titles and
  // counts, not every card, and a shelf of 60 cards per row makes the
  // response large for no gain.
  async function listShares(userId) {
    const res = await req(
      "/shares?user_id=eq." +
        encodeURIComponent(userId) +
        "&select=id,unlisted,hide_footer,created_at,expires_at,data-%3E%3Etitle,data-%3E%3Ecount" +
        "&order=created_at.desc&limit=200"
    );
    const rows = await res.json();
    if (!Array.isArray(rows)) return [];
    return rows.map((r) => ({
      id: r.id,
      title: r.title || "",
      count: Number(r.count) || 0,
      unlisted: r.unlisted === true,
      hideFooter: r.hide_footer === true,
      createdAt: r.created_at ? Date.parse(r.created_at) : null,
      expiresAt: r.expires_at ? Date.parse(r.expires_at) : null,
    }));
  }

  // Scoped by user_id as well as id. The service role bypasses RLS, so the
  // owner check has to live in the query — without it, any signed-in caller
  // could delete any share whose code they had seen.
  async function deleteShare(userId, code) {
    await req("/shares?user_id=eq." + encodeURIComponent(userId) + "&id=eq." + encodeURIComponent(code), {
      method: "DELETE",
    });
  }

  // Account deletion (Part 7e). `on delete cascade` would do this, but the
  // shelf row is removed explicitly for the same reason: "delete my account"
  // must not depend on a database detail to take the customer's cards off a
  // public URL.
  async function deleteSharesForUser(userId) {
    await req("/shares?user_id=eq." + encodeURIComponent(userId), { method: "DELETE" });
  }

  // ── Shared daily spend ────────────────────────────────────────────────────
  // docs/sql/2026-07-28-daily-spend.sql. The Anthropic cost ceiling used to
  // live in a module variable, which gave every warm Netlify instance its own
  // private ceiling. These two calls make it one number for the whole site.

  // The running total for a UTC day, or 0 when nothing is spent yet.
  async function loadDailySpend(day) {
    const res = await req("/daily_spend?day=eq." + encodeURIComponent(day) + "&select=cost_usd&limit=1");
    const rows = await res.json();
    if (!Array.isArray(rows) || !rows.length || !rows[0]) return 0;
    return Number(rows[0].cost_usd) || 0;
  }

  // Add one call's cost and read the new shared total back. The addition
  // happens inside Postgres, so two instances finishing at the same moment
  // both land — a read-modify-write here would lose one of them.
  async function addDailySpend(day, costUsd) {
    const res = await req("/rpc/add_daily_spend", {
      method: "POST",
      body: JSON.stringify({ p_day: day, p_cost: costUsd }),
    });
    const total = await res.json();
    return Number(total) || 0;
  }

  // ── Shared chart cache (#40, Kyle 2026-08-05) ─────────────────────────────
  // docs/sql/2026-08-05-chart-cache.sql. One paid chart read now serves every
  // later reader of the SAME chart photo. The key is the photo fingerprint —
  // never the album and never the link, because one yupoo album holds many
  // items and one item arrives through many link shapes.

  // The saved chart for one photo fingerprint, or null when nobody has paid
  // for this photo yet.
  async function loadChartText(imageKey) {
    const res = await req(
      "/chart_cache?image_key=eq." + encodeURIComponent(imageKey) + "&select=chart_text&limit=1"
    );
    const rows = await res.json();
    return Array.isArray(rows) && rows.length && rows[0] && typeof rows[0].chart_text === "string"
      ? rows[0].chart_text
      : null;
  }

  // Save one paid read. merge-duplicates makes a second writer harmless: two
  // readers who miss in the same second both pay and both write, and the row
  // ends up with one of two identical chart texts.
  async function saveChartText(imageKey, chartText) {
    await req("/chart_cache", {
      method: "POST",
      headers: { prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ image_key: imageKey, chart_text: chartText }),
    });
  }

  async function isEventProcessed(eventId) {
    const res = await req("/processed_events?event_id=eq." + encodeURIComponent(eventId) + "&select=event_id");
    const rows = await res.json();
    return Array.isArray(rows) && rows.length > 0;
  }

  // Record the event id. A duplicate (409) is fine — the event is processed
  // either way, which is exactly the idempotence guarantee (task 5).
  async function markEventProcessed(eventId) {
    const res = await call(base + "/processed_events", {
      method: "POST",
      headers: { ...headers, prefer: "return=minimal" },
      body: JSON.stringify({ event_id: eventId }),
    });
    if (!res.ok && res.status !== 409) {
      throw new Error("supabase POST /processed_events -> " + res.status);
    }
  }

  return {
    loadEntitlement,
    loadByStripeCustomer,
    saveEntitlement,
    deleteEntitlement,
    deleteShelf,
    createShare,
    loadShare,
    listShares,
    deleteShare,
    deleteSharesForUser,
    loadDailySpend,
    addDailySpend,
    loadChartText,
    saveChartText,
    isEventProcessed,
    markEventProcessed,
  };
}

function storeFromEnv(env = process.env) {
  return makeStore({ url: env.SUPABASE_URL, serviceKey: env.SUPABASE_SERVICE_ROLE_KEY });
}

module.exports = { makeStore, storeFromEnv };
