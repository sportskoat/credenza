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
  if (!res.ok) throw new Error(data.error || "HTTP " + res.status);
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

// Stripe Checkout for one of the two prices. Returns the redirect URL.
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
