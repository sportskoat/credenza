// ═══════════════════════════════════════════════════════════════════════════════
// share.js — the owner's end of shared hauls (LB-8)
//
// Account-only. Every verb needs `Authorization: Bearer <supabase token>`;
// the public page is a different function (share-page.js) and never comes
// here. Three actions on one route:
//
//   POST   /.netlify/functions/share             create, answer { code, url }
//   GET    /.netlify/functions/share             list this account's shares
//   DELETE /.netlify/functions/share?code=...    remove one share
//
// The CLIENT builds the snapshot, because the shelf lives on the device and
// the server has never seen it. This file therefore treats the posted
// document as untrusted input: it re-checks the shape, the size and the item
// count before storing. It does NOT re-check what fields are present — the
// sharer's toggles decided that, and a snapshot with a price in it is a
// snapshot whose owner asked for prices.
//
// Pro gates the three options that change a link's behaviour after it is
// pasted: unlisted, expiry, and hiding the footer. A free share is a plain
// public link with the Credenza footer, which is the deal that makes the
// free tier pay for itself.
// ═══════════════════════════════════════════════════════════════════════════════

const limit = require("./lib/limit.js");
const auth = require("./lib/auth.js");
const ent = require("./lib/entitlements.js");
const share = require("./lib/share-doc.js");
const { storeFromEnv } = require("./lib/entitlement-store.js");

const ROUTE = "share";
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

// Matches SHARE_MAX_ITEMS / SHARE_MAX_BYTES in credenza-share.js. Restated
// rather than imported (that file is ESM); share-parity.test.js pins them.
const MAX_ITEMS = 60;
const MAX_BYTES = 512 * 1024;
const MAX_SHARES_FREE = 3;
const MAX_SHARES_PRO = 100;

function response(statusCode, payload, extraHeaders) {
  return {
    statusCode,
    headers: { ...JSON_HEADERS, ...(extraHeaders || {}) },
    body: JSON.stringify(payload),
  };
}

function siteUrl(env) {
  const raw = env.SITE_URL || env.URL || "https://credenzafashion.com";
  return String(raw).replace(/\/+$/, "");
}

// The code comes from the client, which generated it with crypto. The server
// checks the shape and nothing else: a code that collides fails on the
// primary key, and the client retries.
function readCreate(body) {
  const doc = share.parseShareSnapshot(body && body.doc);
  if (!doc) return { error: "Invalid share document" };
  if (!share.isShareCode(body.code)) return { error: "Invalid share code" };
  if (doc.items.length > MAX_ITEMS) return { error: "Too many items in one share" };
  if (JSON.stringify(doc).length > MAX_BYTES) return { error: "Share is too large" };
  return { code: body.code, doc };
}

async function handleCreate(event, env, claims, store, pro) {
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return response(400, { error: "Invalid JSON" });
  }

  const parsed = readCreate(body);
  if (parsed.error) return response(400, { error: parsed.error });

  const existing = await store.listShares(claims.sub);
  const cap = pro ? MAX_SHARES_PRO : MAX_SHARES_FREE;
  if (existing.length >= cap) {
    return response(409, {
      error: pro
        ? "You have reached the maximum number of shares. Delete one first."
        : "Free accounts keep " + cap + " share links. Delete one, or upgrade to Pro.",
    });
  }

  // The three Pro options are FORCED off for a free account rather than
  // refused. A share that fails because a toggle was on is a worse outcome
  // than a share that works with the free behaviour, and the client already
  // shows these as Pro.
  const expiresAt = pro && Number.isFinite(Number(body.expiresAt)) ? Number(body.expiresAt) : null;
  await store.createShare({
    id: parsed.code,
    userId: claims.sub,
    data: parsed.doc,
    unlisted: pro && body.unlisted === true,
    hideFooter: pro && body.hideFooter === true,
    expiresAt: expiresAt && expiresAt > Date.now() ? expiresAt : null,
  });

  return response(200, {
    code: parsed.code,
    url: siteUrl(env) + "/s/" + parsed.code,
    pro,
  });
}

async function handle(event) {
  const env = process.env;
  for (const name of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!env[name]) return response(500, { error: "Server not configured: missing " + name });
  }
  const method = event && event.httpMethod;
  if (method !== "POST" && method !== "GET" && method !== "DELETE") {
    return response(405, { error: "Method not allowed" });
  }
  if (limit.bodyTooLarge(event, ROUTE)) {
    return response(413, { error: "Share is too large" });
  }

  const claims = await auth.verifyBearer(event, env);
  if (!claims) return response(401, { error: "Unauthorized" });

  const blocked = limit.enter(ROUTE, claims.sub);
  if (blocked) {
    return response(blocked.status, { error: blocked.msg }, { "retry-after": String(blocked.retryAfter) });
  }

  try {
    const store = storeFromEnv(env);

    if (method === "GET") {
      return response(200, { shares: await store.listShares(claims.sub) });
    }

    if (method === "DELETE") {
      const q = (event.queryStringParameters || {});
      if (!share.isShareCode(q.code)) return response(400, { error: "Invalid share code" });
      // Scoped to this account inside the store. The service role bypasses
      // RLS, so the owner check cannot be left to the database.
      await store.deleteShare(claims.sub, q.code);
      return response(200, { deleted: true });
    }

    // Grace reads Pro but stops new cloud writes, and a share IS a cloud
    // write. `mayWriteCloud` is therefore the right test here, not
    // effectiveStatus — a lapsed subscriber keeps their existing links and
    // makes new ones on the free terms.
    const record = await store.loadEntitlement(claims.sub);
    const pro = ent.mayWriteCloud(record, Date.now());
    return await handleCreate(event, env, claims, store, pro);
  } finally {
    limit.leave(ROUTE);
  }
}

exports.handler = async (event) => {
  const started = Date.now();
  let res;
  try {
    res = await handle(event);
  } catch {
    res = response(500, { error: "Internal error" });
  }
  limit.logOutcome(ROUTE, limit.clientKey(event), res.statusCode, { ms: Date.now() - started });
  return res;
};

exports._internal = { readCreate, MAX_SHARES_FREE, MAX_SHARES_PRO, MAX_ITEMS, MAX_BYTES };
