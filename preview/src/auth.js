// ═══════════════════════════════════════════════════════════════════════════════
// auth.js — Supabase Auth over plain REST (Execution-Plan Part 7e)
//
// No SDK. The app needs exactly five calls: email magic link, Google OAuth
// redirect, token refresh, logout, and the URL-hash callback that both
// redirect flows land on. Everything degrades to "signed out" when the
// Supabase env vars are missing — the free app works with no account at all.
//
// Session shape (localStorage credenza-fashion-session-v1):
//   { accessToken, refreshToken, expiresAt (ms), user: { id, email } }
// The erase sweep removes every `credenza*` key, so Erase my data signs the
// user out of this device automatically.
// ═══════════════════════════════════════════════════════════════════════════════

const SUPABASE_URL = (import.meta.env && import.meta.env.VITE_SUPABASE_URL) || "";
const SUPABASE_ANON_KEY = (import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || "";

export const AUTH_ENABLED = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
export const SESSION_KEY = "credenza-fashion-session-v1";

const base = () => SUPABASE_URL.replace(/\/+$/, "") + "/auth/v1";

// ————— Session persistence ————————————————————————————————————————————————————

export function loadSession(host = typeof window !== "undefined" ? window : null) {
  try {
    if (!host || !host.localStorage) return null;
    const raw = host.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session || typeof session.accessToken !== "string" || typeof session.refreshToken !== "string") {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function saveSession(session, host = typeof window !== "undefined" ? window : null) {
  if (!host || !host.localStorage || !session) return;
  host.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(host = typeof window !== "undefined" ? window : null) {
  try {
    if (host && host.localStorage) host.localStorage.removeItem(SESSION_KEY);
  } catch {}
}

// Decode the access token's payload WITHOUT verifying — the client only reads
// display fields (email) and the user id; the server verifies every call.
function decodeClaims(token) {
  try {
    const part = String(token).split(".")[1];
    const bin = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

function sessionFromTokens(data) {
  if (!data || typeof data.access_token !== "string" || typeof data.refresh_token !== "string") {
    return null;
  }
  const claims = decodeClaims(data.access_token) || {};
  const expiresIn = Number(data.expires_in) || 3600;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + expiresIn * 1000,
    user: {
      id: (data.user && data.user.id) || claims.sub || "",
      email: (data.user && data.user.email) || claims.email || "",
    },
  };
}

// ————— REST calls ——————————————————————————————————————————————————————————————

async function authPost(path, body, { fetchImpl, token } = {}) {
  const call = fetchImpl || fetch;
  const res = await call(base() + path, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      "content-type": "application/json",
      ...(token ? { authorization: "Bearer " + token } : {}),
    },
    body: body ? JSON.stringify(body) : "",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error_description || data.error || data.msg || "HTTP " + res.status;
    throw new Error(msg);
  }
  return data;
}

// Email a sign-in link. The link lands back on the app with the session in
// the URL hash; sessionFromUrl below turns the hash into a stored session.
export async function sendMagicLink(email, { fetchImpl, redirectTo } = {}) {
  const origin = redirectTo || (typeof window !== "undefined" ? window.location.origin : "");
  await authPost(
    "/otp",
    { email: String(email || "").trim(), create_user: true, options: { redirect_to: origin || undefined } },
    { fetchImpl }
  );
  return true;
}

// Google OAuth: the caller navigates to this URL. Supabase redirects back to
// redirectTo with the session in the URL hash, same as the magic link.
export function googleAuthUrl({ redirectTo } = {}) {
  const origin = redirectTo || (typeof window !== "undefined" ? window.location.origin : "");
  return base() + "/authorize?provider=google&redirect_to=" + encodeURIComponent(origin);
}

// Parse the redirect landing hash. Returns { session } on success, { error }
// when Supabase sent an error back, or null when the hash holds nothing —
// the caller strips the hash only for non-null results.
export function sessionFromUrl(url = typeof window !== "undefined" ? window.location.href : "") {
  const hashIndex = String(url).indexOf("#");
  if (hashIndex < 0) return null;
  const params = new URLSearchParams(String(url).slice(hashIndex + 1));
  if (params.get("error")) {
    return { error: params.get("error_description") || params.get("error") };
  }
  if (!params.get("access_token")) return null;
  const session = sessionFromTokens({
    access_token: params.get("access_token"),
    refresh_token: params.get("refresh_token"),
    expires_in: params.get("expires_in"),
  });
  return session ? { session } : { error: "Sign-in link was incomplete — request a new one." };
}

export async function refreshSession(session, { fetchImpl } = {}) {
  const data = await authPost(
    "/token?grant_type=refresh_token",
    { refresh_token: session.refreshToken },
    { fetchImpl }
  );
  return sessionFromTokens(data);
}

// The session to attach to a paid request. Refreshes when the access token is
// inside its last minute; a failed refresh signs the device out (the user can
// request a new link — their data is untouched).
export async function getValidSession({ fetchImpl, host } = {}) {
  const session = loadSession(host);
  if (!session) return null;
  if (session.expiresAt - 60 * 1000 > Date.now()) return session;
  try {
    const next = await refreshSession(session, { fetchImpl });
    if (!next) throw new Error("empty refresh");
    saveSession(next, host);
    return next;
  } catch {
    clearSession(host);
    return null;
  }
}

// Best-effort server logout; the local session goes away either way.
export async function signOut(session, { fetchImpl, host } = {}) {
  try {
    if (session && session.accessToken) {
      await authPost("/logout", null, { fetchImpl, token: session.accessToken });
    }
  } catch {}
  clearSession(host);
}
