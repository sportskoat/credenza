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

// Match yupoo / photo-relay: a hung auth call must not hang the app forever.
// Exported so tests can shrink it. An abort has NO .status — refreshWasRejected
// treats it as transient, so a timeout never reaches clearSession.
export const AUTH_POST_TIMEOUT_MS = 15_000;

async function authPost(path, body, { fetchImpl, token, timeoutMs = AUTH_POST_TIMEOUT_MS } = {}) {
  const call = fetchImpl || fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await call(base() + path, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        "content-type": "application/json",
        ...(token ? { authorization: "Bearer " + token } : {}),
      },
      body: body ? JSON.stringify(body) : "",
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data.error_description || data.error || data.msg || "HTTP " + res.status;
      const err = new Error(msg);
      // getValidSession only signs the device out when Supabase REJECTS the
      // refresh token. A 500 or a dropped connection must keep the session.
      // Do NOT attach a status to AbortError — that path must stay transient.
      err.status = res.status;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
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

// OAuth: the caller navigates to this URL. Supabase redirects back to
// redirectTo with the session in the URL hash, same as the magic link.
//
// Sign-in handoff README: a magic link makes signing in and signing up the
// same act, so the OAuth list stays short. Google and Discord are live;
// Apple stays wired but parked (Kyle 2026-08-02: no Apple developer account
// yet). Kyle 2026-08-03 ordered the Discord button. Adding a provider here
// without a button is a defect.
export const OAUTH_PROVIDERS = ["google", "apple", "discord"];

export function oauthAuthUrl(provider, { redirectTo } = {}) {
  if (!OAUTH_PROVIDERS.includes(provider)) {
    throw new Error("Unknown sign-in method.");
  }
  const origin = redirectTo || (typeof window !== "undefined" ? window.location.origin : "");
  return base() + "/authorize?provider=" + provider + "&redirect_to=" + encodeURIComponent(origin);
}

export function googleAuthUrl(opts = {}) {
  return oauthAuthUrl("google", opts);
}

// A build with no Supabase keys still renders the sign-in modal, because
// hiding it would read as a missing feature rather than a missing key. The
// buttons answer with this one flat line instead. Credenza's voice: no
// exclamation mark, no "Oops", no stack trace.
export const AUTH_MISSING_MESSAGE = "Couldn't connect. Add provider keys in .env.";

/**
 * The one door into sign-in. Every surface calls this, so no surface can
 * invent a fourth method.
 *
 * @param {"email"|"google"|"apple"} method
 * @param {object} [opts]
 * @param {string} [opts.email] - required when method is "email"
 * @returns {Promise<{sent?: true, redirect?: string}>}
 */
export async function signInWith(method, { email, redirectTo, fetchImpl } = {}) {
  if (!AUTH_ENABLED) throw new Error(AUTH_MISSING_MESSAGE);
  if (method === "email") {
    await sendMagicLink(email, { fetchImpl, redirectTo });
    return { sent: true };
  }
  if (OAUTH_PROVIDERS.includes(method)) {
    return { redirect: oauthAuthUrl(method, { redirectTo }) };
  }
  throw new Error("Unknown sign-in method.");
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
  return session ? { session } : { error: "Sign-in link was incomplete. Request a new one." };
}

// Kyle 2026-08-03 audit, finding 2: the landing screen printed Supabase's own
// words at the visitor — "Sign-in failed: unable to exchange external code".
// Same rule as safeErrorMessage in account.js: a person reads a sentence that
// names what to do next. The raw text still reaches the console.
//
// The two link faults are the ones worth naming apart, because the answer is
// different: an expired link needs a NEW link, and everything else is worth
// one more try with the same address.
export function signInErrorMessage(raw) {
  const text = typeof raw === "string" ? raw.trim() : "";
  // Our own sentence, written for a person already. It passes through.
  if (text === "Sign-in link was incomplete. Request a new one.") return text;
  if (/expired|otp_expired|invalid or has expired/i.test(text)) {
    return "That sign-in link has expired. Ask for a new one.";
  }
  if (/access_denied|cancel/i.test(text)) {
    return "That sign-in was cancelled. Try again when you are ready.";
  }
  return "Credenza could not finish that sign-in. Try again.";
}

export async function refreshSession(session, { fetchImpl, timeoutMs } = {}) {
  const data = await authPost(
    "/token?grant_type=refresh_token",
    { refresh_token: session.refreshToken },
    { fetchImpl, timeoutMs }
  );
  return sessionFromTokens(data);
}

// Supabase ROTATES the refresh token: the old one dies the moment a new pair
// is issued. Two calls that renew at the same moment would therefore race, and
// the loser would see "Already Used" and sign the device out. One shared
// promise per renewal keeps the second caller on the first caller's result.
let inFlightRefresh = null;

// A rejected refresh token is permanent — only these statuses sign the device
// out. Everything else (500, 502, offline, timeout) is temporary, so the
// session STAYS and the next call tries again. Before this rule one failed
// renewal signed the customer out for good and their card went blank.
function refreshWasRejected(err) {
  const status = err && err.status;
  return status === 400 || status === 401 || status === 403 || status === 422;
}

// One retry, short backoff, before we give up on a transient refresh error
// (2026-08-02 incident: a single failed refresh attempt — cold function,
// network blip — was falling all the way through to "no session", so the
// next call went out with NO Authorization header and the server gave an
// honest 401 for what was really a live session). Exported so a test can
// shrink it instead of eating the real delay.
export const REFRESH_RETRY_DELAY_MS = 250;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// One refresh attempt. Resolves { session } on success, { rejected: true }
// on a permanent Supabase rejection, or { rejected: false } on anything
// transient (network error, 5xx, timeout, or a malformed 200 body).
async function attemptRefresh(session, opts) {
  try {
    const next = await refreshSession(session, opts);
    return next ? { session: next } : { rejected: false };
  } catch (err) {
    return { rejected: refreshWasRejected(err) };
  }
}

// The session to attach to a paid request. Refreshes when the access token is
// inside its last minute. Returns null only when this device has no usable
// session (never signed in, or Supabase explicitly rejected the refresh
// token). A transient refresh failure — even after one retry — falls back to
// the STORED token rather than no token at all: the refresh fires 60s early,
// so that token is usually still good, and the worst case (the server 401s)
// is no worse than today.
//
// Rotation loser (2026-08-05): Supabase kills the old refresh token the moment
// a new pair is issued. Two tabs that share one device storage can both present
// the old token; the winner stores a new pair, the loser gets 400. Before this
// re-read, the loser called clearSession and signed the whole device out —
// including the winner's good session. On permanent rejection we re-load:
// another context rotated → adopt its stored session; token still ours (or
// storage empty) → clear, same as today.
export async function getValidSession({
  fetchImpl,
  host,
  retryDelayMs = REFRESH_RETRY_DELAY_MS,
  timeoutMs = AUTH_POST_TIMEOUT_MS,
} = {}) {
  const session = loadSession(host);
  if (!session) return null;
  if (session.expiresAt - 60 * 1000 > Date.now()) return session;
  if (!inFlightRefresh) {
    inFlightRefresh = (async () => {
      try {
        let result = await attemptRefresh(session, { fetchImpl, timeoutMs });
        if (result.session) {
          saveSession(result.session, host);
          return result.session;
        }
        if (result.rejected) {
          const current = loadSession(host);
          if (current && current.refreshToken !== session.refreshToken) return current;
          clearSession(host);
          return null;
        }
        await sleep(retryDelayMs);
        result = await attemptRefresh(session, { fetchImpl, timeoutMs });
        if (result.session) {
          saveSession(result.session, host);
          return result.session;
        }
        if (result.rejected) {
          const current = loadSession(host);
          if (current && current.refreshToken !== session.refreshToken) return current;
          clearSession(host);
          return null;
        }
        // Still transient after the retry — keep serving the stored token.
        return session;
      } finally {
        inFlightRefresh = null;
      }
    })();
  }
  return inFlightRefresh;
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

// Headers for a paid function call: the caller's base headers plus the
// Bearer token when this device holds a valid session (Part 7e). Returns the
// base headers untouched when signed out — the functions still answer
// anonymous callers under the shared key until Part 7f.
export async function authHeaders(baseHeaders = {}, { fetchImpl, host } = {}) {
  if (!AUTH_ENABLED) return baseHeaders;
  const session = await getValidSession({ fetchImpl, host });
  return session ? { ...baseHeaders, authorization: "Bearer " + session.accessToken } : baseHeaders;
}
