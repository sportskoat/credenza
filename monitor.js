// ═══════════════════════════════════════════════════════════════════════════════
// monitor.js — client error log + activation milestones (Part 6, tasks 3–4)
//
// Privacy rules, same as the outbound log in agents.js: local only, append
// with caps, never store content. Errors record { ts, route, status } — the
// route NAME ("ask"), never the URL; the http status or "network", never the
// response body. Activation records the FIRST timestamp of each milestone —
// an object, not an event stream.
// ═══════════════════════════════════════════════════════════════════════════════

export const ERROR_KEY = "credenza-fashion-errors-v1";
const ERROR_CAP = 100;

export async function loadClientErrors(backend) {
  try {
    const raw = await backend.get(ERROR_KEY);
    const list = JSON.parse(raw || "[]");
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

// entry: { ts, route, status } — monitoring must never break the app.
export async function recordClientError(backend, entry) {
  try {
    const list = await loadClientErrors(backend);
    list.push(entry);
    await backend.set(ERROR_KEY, JSON.stringify(list.slice(-ERROR_CAP)));
  } catch (e) {
    // swallow — diagnostics only
  }
}

// Drop-in fetch wrapper: records non-ok responses and network failures against
// the route name, then behaves exactly like fetch (throws on network, returns
// the response otherwise). Aborts are user navigation, not errors.
export async function monitoredFetch(backend, route, url, opts) {
  let res;
  try {
    res = await fetch(url, opts);
  } catch (e) {
    if (e && e.name !== "AbortError") {
      // Awaited: recordClientError swallows its own failures, and the error
      // path is not hot — the alternative (fire-and-forget) races readers.
      await recordClientError(backend, { ts: Date.now(), route, status: "network" });
    }
    throw e;
  }
  if (!res.ok) {
    await recordClientError(backend, { ts: Date.now(), route, status: res.status });
  }
  return res;
}

// errors → { total, byRoute: {route: n}, byStatus: {status: n} }
export function summarizeClientErrors(errors) {
  const summary = { total: 0, byRoute: {}, byStatus: {} };
  for (const e of errors || []) {
    if (!e) continue;
    summary.total += 1;
    const r = e.route || "unknown";
    summary.byRoute[r] = (summary.byRoute[r] || 0) + 1;
    const s = String(e.status || "unknown");
    summary.byStatus[s] = (summary.byStatus[s] || 0) + 1;
  }
  return summary;
}

// ————— Activation milestones ————————————————————————————————————————————————
// "Do users reach each step?" One first-timestamp per milestone answers it
// without an event stream: capture → import → named haul → size decision →
// QC decision → Buy click.

export const ACTIVATION_KEY = "credenza-fashion-activation-v1";
export const ACTIVATION_EVENTS = ["capture", "import", "haulNamed", "sizeDecision", "qcDecision", "buyClick"];

export async function loadActivation(backend) {
  try {
    const raw = await backend.get(ACTIVATION_KEY);
    const obj = JSON.parse(raw || "{}");
    return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
  } catch (e) {
    return {};
  }
}

// First occurrence wins — later marks for the same event keep the original ts.
// Returns true when this call set the milestone.
export async function markActivation(backend, name, ts = Date.now()) {
  if (!ACTIVATION_EVENTS.includes(name)) return false;
  try {
    const obj = await loadActivation(backend);
    if (obj[name]) return false;
    obj[name] = ts;
    await backend.set(ACTIVATION_KEY, JSON.stringify(obj));
    return true;
  } catch (e) {
    return false;
  }
}
