// ═══════════════════════════════════════════════════════════════════════════════
// account.js — the client's view of the entitlement record (Part 7e)
//
// After sign-in the app asks the entitlement function for a signed snapshot
// and caches it (credenza-fashion-entitlement-v1). The client DECODES the
// snapshot without verifying it — the HMAC secret never leaves the server;
// every paid request is re-checked server-side. The cache exists so the plan
// badge and the free-limit counters work offline until the snapshot expires.
//
// checkout() and openPortal() ask the Part 7d functions for a Stripe URL;
// the caller navigates the browser to it.
// ═══════════════════════════════════════════════════════════════════════════════

export const ENTITLEMENT_KEY = "credenza-fashion-entitlement-v1";
const ENTITLEMENT_ENDPOINT =
  (import.meta.env && import.meta.env.VITE_ENTITLEMENT_ENDPOINT) || "/.netlify/functions/entitlement";
const CHECKOUT_ENDPOINT =
  (import.meta.env && import.meta.env.VITE_CHECKOUT_ENDPOINT) || "/.netlify/functions/checkout";
const PORTAL_ENDPOINT =
  (import.meta.env && import.meta.env.VITE_PORTAL_ENDPOINT) || "/.netlify/functions/portal";
const DELETE_ACCOUNT_ENDPOINT =
  (import.meta.env && import.meta.env.VITE_DELETE_ACCOUNT_ENDPOINT) || "/.netlify/functions/delete-account";

// Decode a snapshot payload without verifying (see the header comment).
export function decodeSnapshot(token) {
  try {
    const body = String(token).slice(0, String(token).lastIndexOf("."));
    const json = atob(body.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json);
    if (!payload || typeof payload.exp !== "number") return null;
    return payload;
  } catch {
    return null;
  }
}

export function loadCachedEntitlement(host = typeof window !== "undefined" ? window : null) {
  try {
    if (!host || !host.localStorage) return null;
    const raw = host.localStorage.getItem(ENTITLEMENT_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    const payload = cached && cached.snapshot ? decodeSnapshot(cached.snapshot) : null;
    if (!payload || payload.exp <= Date.now()) return null;
    return payload; // { sub, plan, state, lim, exp, graceUntil }
  } catch {
    return null;
  }
}

function cacheEntitlement(snapshot, host) {
  try {
    if (host && host.localStorage) host.localStorage.setItem(ENTITLEMENT_KEY, JSON.stringify({ snapshot }));
  } catch {}
}

export function clearCachedEntitlement(host = typeof window !== "undefined" ? window : null) {
  try {
    if (host && host.localStorage) host.localStorage.removeItem(ENTITLEMENT_KEY);
  } catch {}
}

// LB-42. What the billing screen is allowed to repeat back to a person.
//
// ProfileSheet.run() catches whatever post() throws and renders err.message
// straight into the sheet. Until now that message was the server's own `error`
// field, so pressing Upgrade with one env var unset showed the visitor
// "Server not configured: missing STRIPE_PRICE_MONTHLY". Others in the same
// path: "Stripe did not return a checkout URL", "Stripe error: …",
// "Server not configured: missing CREDENZA_SEARCH_SECRET". They name our
// vendor and our environment to somebody who can act on neither.
//
// This is an ALLOWLIST, on purpose. A blocklist of vendor names passes every
// message written after the blocklist — and the failing string is always the
// one nobody thought about. Anything not listed here becomes a sentence we
// wrote, chosen by status code.
const SERVER_MESSAGES_A_PERSON_SHOULD_SEE = new Set([
  // The only server text in this path aimed at the visitor rather than at us.
  // It names the exact next action, and Stripe requires the order.
  "Cancel your subscription in Manage billing first, then delete the account.",
  "No billing account yet",
  "Sign in to use this feature",
]);

// Chosen by what the person can do next, not by what broke. `subject` names
// the thing that failed in our words — "Billing", "Cloud Ask" — because a 500
// on the checkout screen and a 500 on the Ask box need different sentences.
function messageForStatus(status, subject) {
  if (status === 401 || status === 403) return "Your sign-in expired — sign in again first.";
  if (status === 404) return "That is not available on this account.";
  if (status === 429) return "Too many tries — wait a moment and try again.";
  if (status >= 500) return subject + " is not answering right now. Try again in a minute.";
  return "Something went wrong — try again.";
}

// Exported for the test that pins this behaviour, and for any future caller
// that has to make the same decision.
export function safeErrorMessage(status, serverError, subject = "Billing") {
  const text = typeof serverError === "string" ? serverError.trim() : "";
  // A daily-cap message is generated ("Daily ask limit reached — upgrade to
  // Pro for more"), so it cannot be listed literally. It names no vendor and
  // no variable, and it is the one message that tells a free user why the
  // button stopped working, so it passes on shape.
  if (/^Daily \w+ limit reached/.test(text)) return text;
  if (SERVER_MESSAGES_A_PERSON_SHOULD_SEE.has(text)) return text;
  return messageForStatus(status, subject);
}

async function post(endpoint, accessToken, body, fetchImpl) {
  const call = fetchImpl || fetch;
  const res = await call(endpoint, {
    method: "POST",
    headers: {
      authorization: "Bearer " + accessToken,
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : "",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(safeErrorMessage(res.status, data && data.error));
    // The real text still reaches the console, where a developer looks and a
    // visitor does not. Losing it entirely would trade one defect for another.
    err.serverError = data && data.error;
    err.status = res.status;
    throw err;
  }
  return data;
}

// Fresh snapshot from the server; updates the cache. Throws on failure —
// the caller falls back to the cache (offline use keeps working to exp).
export async function refreshEntitlement(accessToken, { fetchImpl, host } = {}) {
  const data = await post(ENTITLEMENT_ENDPOINT, accessToken, null, fetchImpl);
  if (data && typeof data.snapshot === "string") {
    cacheEntitlement(data.snapshot, host);
    return decodeSnapshot(data.snapshot);
  }
  throw new Error("Entitlement response had no snapshot");
}

// Stripe Checkout for one of the three prices ("weekly" carries the 3-day
// trial). Returns the redirect URL.
export async function checkout(accessToken, price, { fetchImpl } = {}) {
  const data = await post(CHECKOUT_ENDPOINT, accessToken, { price }, fetchImpl);
  if (!data || typeof data.url !== "string") throw new Error("Checkout gave no URL");
  return data.url;
}

// Stripe Customer Portal (card, cancellation, invoices). Returns the URL.
export async function openPortal(accessToken, { fetchImpl } = {}) {
  const data = await post(PORTAL_ENDPOINT, accessToken, null, fetchImpl);
  if (!data || typeof data.url !== "string") throw new Error("Portal gave no URL");
  return data.url;
}

// Delete the server-side account (entitlement row + auth user). The server
// answers 409 while a subscription is still active — cancel in the Portal
// first. Local data is untouched; the caller clears the session + cache.
export async function deleteAccount(accessToken, { fetchImpl } = {}) {
  const data = await post(DELETE_ACCOUNT_ENDPOINT, accessToken, null, fetchImpl);
  if (!data || data.deleted !== true) throw new Error("Delete gave no confirmation");
  return true;
}
