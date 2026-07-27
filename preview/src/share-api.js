// ═══════════════════════════════════════════════════════════════════════════════
// share-api.js — the client's end of shared hauls (LB-8)
//
// Three calls against one function. The snapshot is built on the device by
// credenza-share.js, because the shelf lives on the device and the server has
// never seen it. This file only carries the finished document.
//
// Every call needs a Supabase access token. A signed-out person cannot make a
// link at all — the server answers 401 — so the caller checks the session
// before opening the share sheet, and this file does not pretend otherwise.
//
// Errors throw with the server's own message. The share sheet prints it. A
// failed share is a normal condition (offline, over the free cap, expired
// sign-in), not a crash.
// ═══════════════════════════════════════════════════════════════════════════════

const SHARE_ENDPOINT =
  (import.meta.env && import.meta.env.VITE_SHARE_ENDPOINT) || "/.netlify/functions/share";

async function call(accessToken, { method, body, query }, fetchImpl) {
  const run = fetchImpl || fetch;
  const url = SHARE_ENDPOINT + (query || "");
  const res = await run(url, {
    method,
    headers: {
      authorization: "Bearer " + accessToken,
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "HTTP " + res.status);
  return data;
}

// Create one link. `doc` is the frozen snapshot; `code` is the code the client
// generated with crypto. The three Pro options are sent whatever the plan is —
// the server forces them off for a free account rather than refusing the
// share, so a stale plan badge cannot cost someone their link.
export async function createShare(accessToken, payload, { fetchImpl } = {}) {
  const data = await call(
    accessToken,
    {
      method: "POST",
      body: {
        code: payload.code,
        doc: payload.doc,
        unlisted: payload.unlisted === true,
        hideFooter: payload.hideFooter === true,
        expiresAt: payload.expiresAt == null ? null : Number(payload.expiresAt),
      },
    },
    fetchImpl
  );
  if (!data || typeof data.url !== "string") throw new Error("The server gave no link");
  return data; // { code, url, pro }
}

// This account's links, newest first. Titles and counts only — the server
// leaves the card data out, because a list does not need it.
export async function listShares(accessToken, { fetchImpl } = {}) {
  const data = await call(accessToken, { method: "GET" }, fetchImpl);
  return Array.isArray(data && data.shares) ? data.shares : [];
}

// Remove one link. The page it served answers the same 404 as a code that
// never existed.
export async function deleteShare(accessToken, code, { fetchImpl } = {}) {
  await call(
    accessToken,
    { method: "DELETE", query: "?code=" + encodeURIComponent(code) },
    fetchImpl
  );
  return true;
}

// Put a link on the clipboard. Returns false when the browser refuses rather
// than throwing — the sheet still shows the link for a manual copy, so a
// blocked clipboard is a smaller problem than a failed share.
export async function copyLink(url, host = typeof navigator !== "undefined" ? navigator : null) {
  try {
    if (!host || !host.clipboard || typeof host.clipboard.writeText !== "function") return false;
    await host.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}
