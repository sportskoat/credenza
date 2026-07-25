// ═══════════════════════════════════════════════════════════════════════════════
// usage.js — client-side free-limit counters (Execution-Plan Part 7e)
//
// The entitlement snapshot carries per-plan daily caps (lim.askPerDay etc.).
// The client counts its own paid calls per UTC day in localStorage so a FREE
// signed-in user sees the upgrade prompt instead of a server 429. This is
// soft enforcement only — the server re-checks the real record on every paid
// request, so clearing localStorage never buys anything (Part 7f makes the
// server the hard gate).
// ═══════════════════════════════════════════════════════════════════════════════

export const USAGE_KEY = "credenza-fashion-usage-v1";

function readUsage(host) {
  try {
    if (!host || !host.localStorage) return {};
    const raw = host.localStorage.getItem(USAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

const DAY_FMT = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }); // YYYY-MM-DD

export function usageKey(feature, now = Date.now()) {
  return feature + ":" + DAY_FMT.format(now);
}

export function usageToday(feature, { host, now } = {}) {
  return readUsage(host)[usageKey(feature, now)] || 0;
}

// Increment today's counter and prune every day that is not today or
// yesterday (same shape as the server record — small forever).
export function bumpUsage(feature, { host, now = Date.now() } = {}) {
  if (!host || !host.localStorage) return;
  const key = usageKey(feature, now);
  const keep = new Set([key, usageKey(feature, now - 24 * 60 * 60 * 1000)]);
  const usage = {};
  for (const [k, v] of Object.entries(readUsage(host))) {
    if (keep.has(k)) usage[k] = v;
  }
  usage[key] = (usage[key] || 0) + 1;
  try {
    host.localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
  } catch {}
}

// Is a signed-in FREE user over the daily cap for this feature? plan is the
// decoded snapshot payload; null/expired plan or a non-free state means "not
// over" — signed-out users answer to the server rate limits, and Pro/grace
// users get Pro caps the client never enforces (they are generous).
export function overFreeLimit(plan, feature, { host, now } = {}) {
  if (!plan || !plan.lim || plan.state !== "free") return false;
  const cap = plan.lim[feature + "PerDay"];
  if (cap == null) return false;
  return usageToday(feature, { host, now }) >= cap;
}
