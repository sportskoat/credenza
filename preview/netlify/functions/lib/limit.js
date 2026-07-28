// Shared rate limits + daily cost ceiling for the Credenza functions.
//
// The function key ships in the browser bundle (any visitor can copy it —
// real accounts arrive in Part 7), so these counters are the only thing
// between a stranger and Kyle's Anthropic bill.
//
// TWO LAYERS, on purpose:
//
//   1. The per-minute windows and the concurrency cap live in the warm
//      function instance. They stop single-source abuse. They are per
//      instance and that is fine — they are about one caller's pace, not
//      about a total.
//
//   2. The DAILY COST CEILING is shared, in Postgres. It used to be a module
//      variable here, which meant every warm Netlify instance got its own
//      private $5 ceiling and the real total was unbounded. `checkDailyCap`
//      and `recordUsageShared` now read and write one row per UTC day in
//      public.daily_spend (docs/sql/2026-07-28-daily-spend.sql).
//
// The in-memory daily figure is KEPT as a local backstop. When Supabase is
// absent (local dev, tests) or unreachable, the shared path degrades to it
// rather than failing the customer's request. A Supabase outage must not take
// the whole app down, so the shared check fails OPEN to the memory counter.

const ROUTES = {
  // chart-vision carries INLINE photos since handoff turn 9 §3 (a camera frame
  // has no CDN URL, so the allowlist path cannot serve it). Three frames at the
  // function's 600KB-each ceiling, plus base64's 4/3 expansion and the JSON
  // wrapper, is the real worst case. 2.5MB holds it with room; the per-photo
  // and per-count caps inside chart-vision.js are the tighter limits, and the
  // client compresses each frame to about 24KB before it ever posts.
  "chart-vision": { paid: true, perIpPerMin: 10, routePerMin: 60, maxConcurrent: 3, bodyBytes: 2560 * 1024 },
  ask: { paid: true, perIpPerMin: 20, routePerMin: 120, maxConcurrent: 4, bodyBytes: 64 * 1024 },
  resolve: { paid: true, perIpPerMin: 20, routePerMin: 120, maxConcurrent: 4, bodyBytes: 8 * 1024 },
  yupoo: { paid: false, perIpPerMin: 30, routePerMin: 180, maxConcurrent: 8, bodyBytes: 8 * 1024 },
  preview: { paid: false, perIpPerMin: 30, routePerMin: 180, maxConcurrent: 8, bodyBytes: 8 * 1024 },
  reddit: { paid: false, perIpPerMin: 20, routePerMin: 120, maxConcurrent: 6, bodyBytes: 8 * 1024 },
  checkout: { paid: false, perIpPerMin: 10, routePerMin: 60, maxConcurrent: 2, bodyBytes: 1024 },
  portal: { paid: false, perIpPerMin: 10, routePerMin: 60, maxConcurrent: 2, bodyBytes: 1024 },
  "delete-account": { paid: false, perIpPerMin: 5, routePerMin: 30, maxConcurrent: 2, bodyBytes: 1024 },
  // Creating a share writes a whole snapshot, so the body cap is the size of
  // one document (SHARE_MAX_BYTES) plus room for the JSON wrapper.
  share: { paid: false, perIpPerMin: 20, routePerMin: 120, maxConcurrent: 4, bodyBytes: 640 * 1024 },
  // The public /s/:code page. Generous, because a link posted to a busy
  // Discord is a legitimate burst — and the CDN answers most of it without
  // waking the function. This counter only ever sees cache misses.
  "share-page": { paid: false, perIpPerMin: 60, routePerMin: 600, maxConcurrent: 8, bodyBytes: 1024 },
  // The card picture for /s/:code. One page unfurl is one image fetch, so the
  // ceiling matches share-page rather than preview's. Concurrency is lower
  // because each call holds an outbound socket to a seller's host, and a slow
  // seller must not be able to occupy the whole instance.
  "share-image": { paid: false, perIpPerMin: 60, routePerMin: 600, maxConcurrent: 6, bodyBytes: 1024 },
};

// USD per million tokens, [input, output]. Keep current with the console.
const PRICE_PER_MTOK = {
  "claude-haiku-4-5": [1, 5],
  "claude-sonnet-5": [3, 15],
};
const DEFAULT_PRICE = [3, 15];
// Charged when a response carries no usage block — small, but every call counts.
const FALLBACK_COST_USD = 0.01;

const WINDOW_MS = 60 * 1000;
const MAX_KEYS = 5000;

const ipWindows = new Map(); // `${route}|${key}` → { count, resetAt }
const routeWindows = new Map(); // route → { count, resetAt }
const inflight = new Map(); // route → n
let daily = { date: null, costUsd: 0, calls: 0 };

function utcToday() {
  return new Date().toISOString().slice(0, 10);
}

function dailyCapUsd() {
  const raw = Number(process.env.CREDENZA_DAILY_COST_CAP_USD);
  return Number.isFinite(raw) && raw > 0 ? raw : 5;
}

function rollDaily() {
  const today = utcToday();
  if (daily.date !== today) daily = { date: today, costUsd: 0, calls: 0 };
  return daily;
}

function hitWindow(map, key, max) {
  const now = Date.now();
  let w = map.get(key);
  if (!w || now >= w.resetAt) {
    w = { count: 0, resetAt: now + WINDOW_MS };
    map.set(key, w);
  }
  w.count += 1;
  return { over: w.count > max, retryAfter: Math.max(1, Math.ceil((w.resetAt - now) / 1000)) };
}

function sweep(map) {
  if (map.size <= MAX_KEYS) return;
  const now = Date.now();
  for (const [key, w] of map) if (now >= w.resetAt) map.delete(key);
}

// Netlify's own client-IP header first; the first forwarded hop as fallback.
function clientKey(event) {
  const h = (event && event.headers) || {};
  const nf = h["x-nf-client-connection-ip"];
  if (typeof nf === "string" && nf.trim()) return nf.trim();
  const fwd = h["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.trim()) return fwd.split(",")[0].trim();
  return "unknown";
}

function bodyTooLarge(event, route) {
  const cap = ROUTES[route] && ROUTES[route].bodyBytes;
  if (!cap) return false;
  const body = event && event.body;
  return typeof body === "string" && Buffer.byteLength(body) > cap;
}

// Returns null on entry, or { status: 429, retryAfter, msg } when a limit
// stops the request. On entry the caller MUST pair with leave(route).
function enter(route, key) {
  const cfg = ROUTES[route];
  if (!cfg) return null;
  if (cfg.paid && rollDaily().costUsd >= dailyCapUsd()) {
    return { status: 429, retryAfter: 3600, msg: "Daily cost ceiling reached — try again tomorrow" };
  }
  if ((inflight.get(route) || 0) >= cfg.maxConcurrent) {
    return { status: 429, retryAfter: 5, msg: "Busy — try again in a moment" };
  }
  sweep(ipWindows);
  const ip = hitWindow(ipWindows, route + "|" + key, cfg.perIpPerMin);
  if (ip.over) return { status: 429, retryAfter: ip.retryAfter, msg: "Too many requests — slow down" };
  const rt = hitWindow(routeWindows, route, cfg.routePerMin);
  if (rt.over) return { status: 429, retryAfter: rt.retryAfter, msg: "Too many requests — try again shortly" };
  inflight.set(route, (inflight.get(route) || 0) + 1);
  return null;
}

function leave(route) {
  inflight.set(route, Math.max(0, (inflight.get(route) || 0) - 1));
}

function costOf(model, usage) {
  if (!usage || typeof usage !== "object") return FALLBACK_COST_USD;
  const [pin, pout] = PRICE_PER_MTOK[model] || DEFAULT_PRICE;
  const input = Number(usage.input_tokens) || 0;
  const output = Number(usage.output_tokens) || 0;
  if (!input && !output) return FALLBACK_COST_USD;
  return (input * pin + output * pout) / 1e6;
}

// Record one paid call. Returns the USD cost for the outcome log.
function recordUsage(route, model, usage) {
  const cost = costOf(model, usage);
  const d = rollDaily();
  d.costUsd += cost;
  d.calls += 1;
  return cost;
}

// ── The shared daily ceiling ────────────────────────────────────────────────
//
// One row per UTC day in public.daily_spend, read and written by every
// instance. See the header for why the memory counter alone was not enough.

// The shared total is cached for a few seconds. Without the cache every paid
// call pays a Supabase round trip before it starts. The window is short, and
// spend recorded locally since the last fetch is added on top, so a burst
// inside one window still counts against the ceiling.
const SHARED_TTL_MS = 5000;

let shared = { date: null, baseUsd: 0, fetchedAt: 0, sinceFetch: 0 };

function rollShared() {
  const today = utcToday();
  if (shared.date !== today) shared = { date: today, baseUsd: 0, fetchedAt: 0, sinceFetch: 0 };
  return shared;
}

// Returns the store, or null when Supabase is not configured. Local dev and
// the test suite hit the null path and fall back to the memory counter.
function spendStore(env) {
  if (!env || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    // Required lazily: functions that never touch a paid route should not
    // load the store at all.
    const { storeFromEnv } = require("./entitlement-store.js");
    return storeFromEnv(env);
  } catch {
    return null;
  }
}

// The site-wide spend for today, or null when the shared figure is not
// available. Never throws.
async function sharedSpendUsd(env) {
  const s = rollShared();
  const store = spendStore(env);
  if (!store) return null;
  if (s.fetchedAt && Date.now() - s.fetchedAt < SHARED_TTL_MS) {
    return s.baseUsd + s.sinceFetch;
  }
  try {
    const total = await store.loadDailySpend(s.date);
    s.baseUsd = total;
    s.sinceFetch = 0;
    s.fetchedAt = Date.now();
    return total;
  } catch {
    // A Supabase outage must not take the app down. Fail open to the memory
    // counter, which the caller checks anyway.
    return null;
  }
}

// The paid-route gate. Call this BEFORE enter(). Returns null to proceed, or
// the same { status, retryAfter, msg } shape enter() uses.
//
// enter() still applies the memory ceiling on its own. That stays as the
// backstop for the case where Supabase is unreachable.
async function checkDailyCap(route, env) {
  const cfg = ROUTES[route];
  if (!cfg || !cfg.paid) return null;
  const total = await sharedSpendUsd(env);
  if (total === null) return null;
  if (total >= dailyCapUsd()) {
    return { status: 429, retryAfter: 3600, msg: "Daily cost ceiling reached — try again tomorrow" };
  }
  return null;
}

// Record one paid call against BOTH counters. Returns the USD cost.
//
// The Supabase write is best-effort and awaited: awaiting keeps the shared
// figure current for the next request on this instance, and a failure only
// costs accuracy, never the customer's completed response.
async function recordUsageShared(route, model, usage, env) {
  const cost = recordUsage(route, model, usage);
  const s = rollShared();
  s.sinceFetch += cost;
  const store = spendStore(env);
  if (!store) return cost;
  try {
    const total = await store.addDailySpend(s.date, cost);
    // The RPC hands back the new site-wide total, so take it as the fresh
    // base instead of waiting for the cache to expire.
    s.baseUsd = total;
    s.sinceFetch = 0;
    s.fetchedAt = Date.now();
  } catch {}
  return cost;
}

// One JSON line per request: route, hashed client key, status, latency, and
// optional cost. NEVER log URLs, queries, titles, or post text — outcomes
// only, no private content (Execution-Plan Part 3, task 5).
function logOutcome(route, key, status, extra = {}) {
  let hash = 5381;
  const s = String(key || "unknown");
  for (let i = 0; i < s.length; i++) hash = ((hash << 5) + hash + s.charCodeAt(i)) >>> 0;
  console.log(
    JSON.stringify({
      t: new Date().toISOString(),
      route,
      key: hash.toString(16),
      status,
      ...extra,
    })
  );
}

function _resetForTest() {
  ipWindows.clear();
  routeWindows.clear();
  inflight.clear();
  daily = { date: null, costUsd: 0, calls: 0 };
  shared = { date: null, baseUsd: 0, fetchedAt: 0, sinceFetch: 0 };
}

module.exports = {
  ROUTES,
  clientKey,
  bodyTooLarge,
  enter,
  leave,
  recordUsage,
  checkDailyCap,
  recordUsageShared,
  logOutcome,
  _resetForTest,
  _dailyForTest: () => rollDaily(),
  _sharedForTest: () => rollShared(),
};
