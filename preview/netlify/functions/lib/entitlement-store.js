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

  return { loadEntitlement, loadByStripeCustomer, saveEntitlement, isEventProcessed, markEventProcessed };
}

function storeFromEnv(env = process.env) {
  return makeStore({ url: env.SUPABASE_URL, serviceKey: env.SUPABASE_SERVICE_ROLE_KEY });
}

module.exports = { makeStore, storeFromEnv };
