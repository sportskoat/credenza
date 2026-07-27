// ═══════════════════════════════════════════════════════════════════════════════
// delete-account.js — the customer deletes their account (Execution-Plan 7e)
//
// POST with `Authorization: Bearer <supabase access token>`. Deletes, in
// order:
//   1. The entitlement row (plan, usage counters, Stripe link). First, so a
//      failed auth-user delete leaves a retryable state, not an orphan user
//      with no record.
//   2. The synced shelf row (LB-7), for the same reason.
//   3. The Supabase auth user (admin API, service role).
//
// Local data is NOT touched — the shelf lives on the device; Erase my data is
// the tool for that, and the client says so next to this button.
//
// Money: deleting the account does NOT cancel a Stripe subscription. The
// client sends paying users to the Customer Portal first (cancel, then
// delete) — cancelling here blind would surprise a yearly subscriber with
// months left. Stripe keeps the customer record for accounting either way.
// ═══════════════════════════════════════════════════════════════════════════════

const limit = require("./lib/limit.js");
const auth = require("./lib/auth.js");
const purge = require("./lib/purge.js");
const { storeFromEnv } = require("./lib/entitlement-store.js");

const ROUTE = "delete-account";
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function response(statusCode, payload, extraHeaders) {
  return {
    statusCode,
    headers: { ...JSON_HEADERS, ...(extraHeaders || {}) },
    body: JSON.stringify(payload),
  };
}

// Supabase admin API: delete the auth user. 404 = already gone — the goal
// state, so it counts as success.
async function deleteAuthUser(env, userId) {
  const res = await fetch(
    env.SUPABASE_URL.replace(/\/+$/, "") + "/auth/v1/admin/users/" + encodeURIComponent(userId),
    {
      method: "DELETE",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY,
      },
    }
  );
  if (!res.ok && res.status !== 404) throw new Error("admin delete user -> " + res.status);
}

async function handle(event, context) {
  const env = process.env;
  for (const name of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!env[name]) return response(500, { error: "Server not configured: missing " + name });
  }
  if (!event || event.httpMethod !== "POST") {
    return response(405, { error: "Method not allowed" });
  }

  const claims = await auth.verifyBearer(event, env);
  if (!claims) return response(401, { error: "Unauthorized" });

  const blocked = limit.enter(ROUTE, claims.sub);
  if (blocked) {
    return response(blocked.status, { error: blocked.msg }, { "retry-after": String(blocked.retryAfter) });
  }

  try {
    const store = storeFromEnv(env);
    const record = await store.loadEntitlement(claims.sub);

    // A paying customer must cancel first — deleting the sign-in would lock
    // them out of the Portal while Stripe keeps billing (see header).
    const paying =
      record &&
      record.stripeSubscriptionId &&
      (record.billingStatus === "active" ||
        record.billingStatus === "trialing" ||
        record.billingStatus === "past_due");
    if (paying) {
      return response(409, { error: "Cancel your subscription in Manage billing first, then delete the account." });
    }

    await store.deleteEntitlement(claims.sub);
    // The synced shelf goes before the auth user, same reason as the
    // entitlement above: a failure here leaves a retryable state instead of
    // a stranded row nobody can reach.
    await store.deleteShelf(claims.sub);
    // Shared links (LB-8) go before the auth user too. These are public URLs:
    // leaving one alive after "delete my account" would keep the customer's
    // cards on the open web after they asked us to remove them.
    //
    // The codes are read BEFORE the delete, because the purge needs them and
    // the rows are about to be unreachable (LB-62). Deleting the rows and
    // stopping there is not "take my cards off the open web": share-page
    // holds a page for an hour and share-image holds a photo for seven days,
    // from a cache no database delete can reach. This is the stronger of the
    // two promises — one deleted link is a tidy-up, but this one was made to
    // somebody who asked us to remove their data.
    const codes = (await store.listShares(claims.sub)).map((row) => row.id);
    await store.deleteSharesForUser(claims.sub);
    const purged = await purge.purgeShares(codes, context, env);
    await deleteAuthUser(env, claims.sub);
    const res = response(200, { deleted: true });
    res._log = { purge: purged.reason, shares: codes.length };
    return res;
  } finally {
    limit.leave(ROUTE);
  }
}

// Outcome log for every request — status + latency only, never content.
exports.handler = async (event, context) => {
  const started = Date.now();
  let res;
  try {
    res = await handle(event, context);
  } catch {
    res = response(500, { error: "Internal error" });
  }
  const extra = { ms: Date.now() - started, ...(res._log || {}) };
  delete res._log;
  limit.logOutcome(ROUTE, limit.clientKey(event), res.statusCode, extra);
  return res;
};
