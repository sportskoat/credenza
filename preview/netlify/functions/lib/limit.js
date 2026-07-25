// Shared rate limits + daily cost ceiling for the Credenza functions.
//
// The function key ships in the browser bundle (any visitor can copy it —
// real accounts arrive in Part 7), so these counters are the only thing
// between a stranger and Kyle's Anthropic bill. They live in the warm
// function instance: they stop single-source abuse. A distributed attack
// needs per-instance counters times instance count — the Anthropic-side
// spend alert + the daily ceiling below bound the damage. Recorded as a
// known limitation in docs/session-state.md.

const ROUTES = {
  "chart-vision": { paid: true, perIpPerMin: 10, routePerMin: 60, maxConcurrent: 3, bodyBytes: 64 * 1024 },
  ask: { paid: true, perIpPerMin: 20, routePerMin: 120, maxConcurrent: 4, bodyBytes: 64 * 1024 },
  resolve: { paid: true, perIpPerMin: 20, routePerMin: 120, maxConcurrent: 4, bodyBytes: 8 * 1024 },
  yupoo: { paid: false, perIpPerMin: 30, routePerMin: 180, maxConcurrent: 8, bodyBytes: 8 * 1024 },
  preview: { paid: false, perIpPerMin: 30, routePerMin: 180, maxConcurrent: 8, bodyBytes: 8 * 1024 },
  reddit: { paid: false, perIpPerMin: 20, routePerMin: 120, maxConcurrent: 6, bodyBytes: 8 * 1024 },
  checkout: { paid: false, perIpPerMin: 10, routePerMin: 60, maxConcurrent: 2, bodyBytes: 1024 },
  portal: { paid: false, perIpPerMin: 10, routePerMin: 60, maxConcurrent: 2, bodyBytes: 1024 },
  "delete-account": { paid: false, perIpPerMin: 5, routePerMin: 30, maxConcurrent: 2, bodyBytes: 1024 },
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
}

module.exports = {
  ROUTES,
  clientKey,
  bodyTooLarge,
  enter,
  leave,
  recordUsage,
  logOutcome,
  _resetForTest,
  _dailyForTest: () => rollDaily(),
};
