// ═══════════════════════════════════════════════════════════════════════════════
// sync.js — the shelf on the server (Pre-Launch LB-7)
//
// One row per account: `shelves(user_id, data jsonb, updated_at)`. The whole
// shelf travels as one document. Per-item rows would be a truer database and a
// worse product — a shelf is read and written as a unit, and 200 rows of PATCH
// traffic buys nothing a single jsonb column does not already give us.
//
// PostgREST over plain fetch, same as auth.js. No Supabase SDK.
//
// The rules this file will not break:
//
//   1. localStorage is the source of truth. The server is a copy. Every call
//      here can fail and the app keeps working — that is the whole point of a
//      local-first shelf, and it is also the offline story.
//   2. A failed pull NEVER clears the local shelf. Unreadable remote data is
//      treated as "no remote data" and the local shelf is pushed over it.
//   3. Nothing here decides what wins. mergeShelves in credenza-sync-merge.js
//      owns that, and it is pure so it can be tested without a network.
//
// Every export returns a status object rather than throwing. A sync error is
// a normal condition, not an exception — the caller is a React effect that
// must not care.
// ═══════════════════════════════════════════════════════════════════════════════

import { AUTH_ENABLED, getValidSession, refreshSession, saveSession, loadSession } from "./auth.js";
import { parseShelfDoc, toShelfDoc } from "../../credenza-sync-merge.js";

const SUPABASE_URL = (import.meta.env && import.meta.env.VITE_SUPABASE_URL) || "";
const SUPABASE_ANON_KEY = (import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || "";

export const SYNC_ENABLED = AUTH_ENABLED;
export const SHELF_TABLE = "shelves";

// The app-level switch, separate from the capability above. Sync stays off
// until the `shelves` table exists (docs/sql/2026-07-26-shelves.sql), so a
// deploy that lands before Kyle runs the migration is quiet rather than
// broken. The flag reads exactly "true" — .env.example has said so since
// before this file existed, and a value of "1" or "yes" leaving sync off
// would be a trap.
export const SYNC_READY =
  AUTH_ENABLED && String((import.meta.env && import.meta.env.VITE_ENABLE_SYNC) || "").trim() === "true";

// Debounce for the push. Long enough that typing a title is one write, short
// enough that closing the laptop right after an edit still catches it — the
// visibilitychange flush is the real safety net for that case.
export const PUSH_DEBOUNCE_MS = 2000;

// The env vars are the default, not the only source. Tests inject `baseUrl`
// and `session` so a run does not pass or fail on whether the developer's
// preview/.env happens to be filled in.
const restBase = (options = {}) =>
  String(options.baseUrl || SUPABASE_URL).replace(/\/+$/, "") + "/rest/v1";

function restHeaders(session, options, extra = {}) {
  return {
    apikey: options.anonKey || SUPABASE_ANON_KEY,
    authorization: "Bearer " + session.accessToken,
    "content-type": "application/json",
    ...extra,
  };
}

// A 401 mid-flight means the access token died between getValidSession and
// this request. Refresh once and retry once. A second 401 is a real sign-out,
// not a race, so we stop rather than loop.
async function withSession(session, options, run) {
  const res = await run(session);
  if (res.status !== 401) return { res, session };
  let next = null;
  try {
    next = await refreshSession(session, { fetchImpl: options.fetchImpl });
  } catch {
    next = null;
  }
  if (!next) return { res, session };
  saveSession(next, options.host);
  return { res: await run(next), session: next };
}

async function currentSession(options) {
  if (options.session) return options.session;
  if (!SYNC_ENABLED) return null;
  return getValidSession({ fetchImpl: options.fetchImpl, host: options.host });
}

// ————— Pull ————————————————————————————————————————————————————————————————————

// Reads this account's shelf document.
//
//   { status: "ok", doc, updatedAt }  a valid document came back
//   { status: "empty" }               the account has no row yet
//   { status: "signed-out" }          nothing to talk to
//   { status: "invalid" }             a row exists but we cannot read it
//   { status: "error", error }        network or server failure
//
// "invalid" and "empty" are deliberately different. Both mean "keep local",
// but only "empty" means the next push is the first one.
export async function pullShelf(options = {}) {
  const session = await currentSession(options);
  if (!session) return { status: "signed-out" };
  const call = options.fetchImpl || fetch;
  const url =
    restBase(options) +
    "/" +
    SHELF_TABLE +
    "?select=data,updated_at&user_id=eq." +
    encodeURIComponent(session.user.id) +
    "&limit=1";

  let res;
  try {
    const out = await withSession(session, options, (s) =>
      call(url, { method: "GET", headers: restHeaders(s, options, { accept: "application/json" }) })
    );
    res = out.res;
  } catch (error) {
    return { status: "error", error };
  }
  if (res.status === 401 || res.status === 403) return { status: "signed-out" };
  if (!res.ok) return { status: "error", error: new Error("HTTP " + res.status) };

  let rows;
  try {
    rows = await res.json();
  } catch (error) {
    return { status: "error", error };
  }
  if (!Array.isArray(rows) || rows.length === 0) return { status: "empty" };

  const doc = parseShelfDoc(rows[0] && rows[0].data);
  if (!doc) return { status: "invalid" };
  return { status: "ok", doc, updatedAt: rows[0].updated_at || null };
}

// ————— Push ————————————————————————————————————————————————————————————————————

// Writes the whole document. Upsert on the primary key, so the first push and
// the thousandth take the same path.
//
//   { status: "ok" } | { status: "signed-out" } | { status: "error", error }
export async function pushShelf(doc, options = {}) {
  if (!doc || typeof doc !== "object") {
    return { status: "error", error: new Error("pushShelf needs a document") };
  }
  const session = await currentSession(options);
  if (!session) return { status: "signed-out" };
  const call = options.fetchImpl || fetch;
  const body = JSON.stringify({
    user_id: session.user.id,
    data: doc,
    updated_at: new Date(options.now || Date.now()).toISOString(),
  });

  let res;
  try {
    const out = await withSession(session, options, (s) =>
      call(restBase(options) + "/" + SHELF_TABLE + "?on_conflict=user_id", {
        method: "POST",
        headers: restHeaders(s, options, {
          prefer: "resolution=merge-duplicates,return=minimal",
        }),
        body,
      })
    );
    res = out.res;
  } catch (error) {
    return { status: "error", error };
  }
  if (res.status === 401 || res.status === 403) return { status: "signed-out" };
  if (!res.ok) return { status: "error", error: new Error("HTTP " + res.status) };
  return { status: "ok" };
}

// ————— Delete ——————————————————————————————————————————————————————————————————

// Used by Erase my data. A missing row is a success: the caller asked for the
// row to be gone, and it is gone.
export async function deleteRemoteShelf(options = {}) {
  const session = await currentSession(options);
  if (!session) return { status: "signed-out" };
  const call = options.fetchImpl || fetch;
  const url =
    restBase(options) + "/" + SHELF_TABLE + "?user_id=eq." + encodeURIComponent(session.user.id);
  let res;
  try {
    const out = await withSession(session, options, (s) =>
      call(url, { method: "DELETE", headers: restHeaders(s, options, { prefer: "return=minimal" }) })
    );
    res = out.res;
  } catch (error) {
    return { status: "error", error };
  }
  if (res.status === 401 || res.status === 403) return { status: "signed-out" };
  if (!res.ok && res.status !== 404) return { status: "error", error: new Error("HTTP " + res.status) };
  return { status: "ok" };
}

// ————— The debounced pusher ————————————————————————————————————————————————————

// Collapses a burst of edits into one write, and flushes on demand so the tab
// closing does not eat the last change.
//
// `getState()` returns { items, tombstones, bodyProfile, fitPrefs, … } —
// a function, not a value, so the pusher always reads the newest shelf
// rather than one captured at setup. Body and shirt-wear defaults ride
// with the cards so a later items-only write does not drop them.
export function createShelfPusher({ getState, delay = PUSH_DEBOUNCE_MS, ...options } = {}) {
  let timer = null;
  let inFlight = null;
  let again = false;

  async function send() {
    const state = getState ? getState() : null;
    if (!state) return { status: "signed-out" };
    const doc = toShelfDoc(state.items || [], state.tombstones || {}, options.now || Date.now(), {
      bodyProfile: state.bodyProfile,
      fitPrefs: state.fitPrefs,
      bodyUpdatedAt: state.bodyUpdatedAt,
      fitPrefsUpdatedAt: state.fitPrefsUpdatedAt,
    });
    return pushShelf(doc, options);
  }

  // One request at a time. A change that lands mid-flight sets `again` so the
  // shelf is pushed a second time rather than lost — the alternative is a
  // silent stale server for as long as the user keeps editing.
  async function run() {
    if (inFlight) {
      again = true;
      return inFlight;
    }
    inFlight = (async () => {
      let result = await send();
      while (again) {
        again = false;
        result = await send();
      }
      return result;
    })();
    try {
      return await inFlight;
    } finally {
      inFlight = null;
    }
  }

  return {
    // Schedule a push. Repeated calls inside `delay` collapse into one.
    schedule() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        run();
      }, delay);
    },
    // Push now. Used on visibilitychange and sign-out.
    flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      return run();
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
      again = false;
    },
    get pending() {
      return timer !== null || inFlight !== null;
    },
  };
}

// Whether this device has an account at all. Cheap and synchronous, for
// render-time decisions; the network calls above do their own checking.
export function hasAccount(host) {
  return SYNC_ENABLED && !!loadSession(host);
}
