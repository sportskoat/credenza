// ═══════════════════════════════════════════════════════════════════════════════
// purge.js — take a deleted share off the edge (LB-62)
//
// /how/ promises: "Delete a link from Profile → Shared links and the page
// answers 404 straight away." It did not. Deleting a share removes the row,
// but the row is not what a visitor reads. share-page.js answers with
// `max-age=300, stale-while-revalidate=3600` and share-image.js with
// `max-age=604800` — SEVEN DAYS. A deleted haul kept serving its page for up
// to an hour and its photo for up to a week, from a cache the database cannot
// reach.
//
// The fix is a cache tag per share code plus one API call after the delete.
// This file is that call, written out rather than imported: `purgeCache` from
// @netlify/functions does the same POST in about thirty lines, and adding a
// dependency to this tree to get them is a worse trade than restating them.
// The request shape is pinned by purge.test.js.
//
// Two rules the callers depend on:
//
//   1. Purge AFTER the delete, never before. A purge that runs first leaves a
//      window where a request re-caches the row that is about to disappear.
//   2. A failed purge never fails the delete. The row is already gone; the
//      page ages out on its own. Losing the customer's "deleted" answer to a
//      network blip would be the worse outcome, so this returns a result
//      instead of throwing.
// ═══════════════════════════════════════════════════════════════════════════════

const API = "https://api.netlify.com/api/v1/purge";

// One tag per share code. The code is 12 characters from a lowercase
// alphabet, so it is already a legal tag: tags are case insensitive, must be
// UTF-8, and may run to 1024 characters. The prefix keeps share tags from
// ever colliding with a tag some later feature invents.
function tagFor(code) {
  return "share-" + String(code || "");
}

// Netlify hands Lambda-compatible functions a scoped purge token on the
// context rather than in the environment. Read that first; the environment
// variable is the fallback for a local run or a test.
function tokenFrom(context, env) {
  const custom = context && context.clientContext && context.clientContext.custom;
  const scoped = custom && custom.purge_api_token;
  return scoped || (env && env.NETLIFY_PURGE_API_TOKEN) || null;
}

// A direct API call has to name the site; only the helper gets it for free.
// SITE_ID is the id the API wants. SITE_NAME is the slug, and it is the
// fallback because Netlify sets both and a site with one but not the other
// should still purge.
function siteFrom(env) {
  if (env && env.SITE_ID) return { site_id: env.SITE_ID };
  if (env && env.SITE_NAME) return { site_slug: env.SITE_NAME };
  return null;
}

// Returns { ok, reason } and never throws. `reason` is for the outcome log,
// which is why it names a condition and not a message from the network.
async function purgeShares(codes, context, env = process.env) {
  const tags = (Array.isArray(codes) ? codes : [codes]).filter(Boolean).map(tagFor);
  // An EMPTY cache_tags list purges nothing, but an ABSENT one purges the
  // whole site. Never send the request with no tags — deleting one share must
  // not be able to clear the cache for every page Credenza serves.
  if (!tags.length) return { ok: false, reason: "no-codes" };

  const token = tokenFrom(context, env);
  if (!token) return { ok: false, reason: "no-token" };
  const site = siteFrom(env);
  if (!site) return { ok: false, reason: "no-site" };

  try {
    const res = await fetch(API, {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=utf-8",
        authorization: "Bearer " + token,
      },
      body: JSON.stringify({ ...site, cache_tags: tags }),
    });
    // The API rate-limits a tag to two purges every five seconds and answers
    // 429. That is not a failure worth retrying inside a delete request: the
    // second purge of the same code has nothing left to remove.
    if (!res.ok) return { ok: false, reason: "status-" + res.status };
    return { ok: true, reason: "purged", tags };
  } catch {
    return { ok: false, reason: "network" };
  }
}

module.exports = { purgeShares, tagFor, API };
