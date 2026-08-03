// ═══════════════════════════════════════════════════════════════════════════════
// usage.js — client-side free-limit counters (Execution-Plan Part 7e)
//
// The entitlement snapshot carries fixed Free allowances and monthly Pro caps.
// The client counts its own successful calls in localStorage so a FREE
// signed-in user sees the upgrade prompt instead of a server 429. This is
// soft enforcement only — the server re-checks the real record on every paid
// request, so clearing localStorage never buys anything (Part 7f makes the
// server the hard gate).
// ═══════════════════════════════════════════════════════════════════════════════

// V2 deliberately starts every existing customer with the new allowance.
export const USAGE_KEY = "credenza-fashion-usage-v2";

// The browser, unless a test hands us a fake one.
//
// This default used to be missing, and every caller in the app omits `host`
// (bumpUsage("resolve") and friends). So every write returned early and every
// read answered zero: the counters in this file were dead, and overFreeLimit
// never fired. The header pill reads the same counters, so a pill built on top
// of that would have read "3 free cards left" forever. account.js already
// defaults its host this way.
function defaultHost() {
  return typeof window !== "undefined" ? window : null;
}

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

export function usageAudience(plan, signedIn = false) {
  if (plan && plan.state === "free") {
    return "free" + (plan.sub ? ":" + plan.sub : "");
  }
  return plan ? "paid" : signedIn ? "free" : "anon";
}

export function usageKey(feature, audience = "anon") {
  return audience + ":" + feature + ":total";
}

export function usageTotal(feature, { host = defaultHost(), audience = "anon" } = {}) {
  return readUsage(host)[usageKey(feature, audience)] || 0;
}

// Compatibility name for older callers. The value no longer resets each day.
export const usageToday = usageTotal;

// The header pill reads these counters, and localStorage never tells React it
// changed. Every bump calls the listeners so the pill re-reads. The list is
// module-level because bumpUsage is called from module scope too — the chart
// hunt and the link resolver both run outside React.
const usageListeners = new Set();

export function onUsageChange(fn) {
  if (typeof fn !== "function") return () => {};
  usageListeners.add(fn);
  return () => usageListeners.delete(fn);
}

// Increment the permanent allowance counter.
export function bumpUsage(feature, { host = defaultHost(), audience = "anon" } = {}) {
  if (!host || !host.localStorage) return;
  const key = usageKey(feature, audience);
  const usage = readUsage(host);
  usage[key] = (usage[key] || 0) + 1;
  try {
    host.localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
  } catch {}
  // A listener that throws must not stop the next one, and must never fail the
  // call that spent the read.
  for (const fn of usageListeners) {
    try {
      fn(feature);
    } catch {}
  }
}

// The full caps table, repeated on the client because the client must answer
// before it has a snapshot — and because the Account and plan screen prints
// the table. These MUST match PLAN_LIMITS in
// preview/netlify/functions/lib/entitlements.js and the MAX_SHARES_*
// constants in preview/netlify/functions/share.js.
// preview/test/plan-limits.test.js compares the numbers and fails on drift.
export const PLAN_CAPS = {
  free: {
    askTotal: 8,
    chartVisionTotal: 8,
    resolveTotal: 8,
    qcPhotosPerItem: 4,
    haulsMax: 2,
    sharedLinksMax: 3,
  },
  pro: {
    askPerMonth: 50,
    chartVisionPerMonth: 50,
    resolvePerMonth: 250,
    qcPhotosPerItem: 12,
    haulsMax: 100,
    sharedLinksMax: 100,
  },
  owner: {
    askPerMonth: null,
    chartVisionPerMonth: null,
    resolvePerMonth: null,
    qcPhotosPerItem: 12,
    haulsMax: 100,
    sharedLinksMax: 100,
  },
};

// Only the per-item and per-account caps get their own names. Metered
// allowances are counted, and a signed-out user is counted by the server, not by
// us (see overFreeLimit). Both derive from PLAN_CAPS so this file holds one
// copy of every number.
export const FREE_LIMITS = {
  qcPhotosPerItem: PLAN_CAPS.free.qcPhotosPerItem,
  haulsMax: PLAN_CAPS.free.haulsMax,
};

// The client never enforces the Pro caps — a Pro user is under them by
// construction. They are here so a message can name the number the customer
// would get, without a second copy of it in the component.
export const PRO_LIMITS = {
  qcPhotosPerItem: PLAN_CAPS.pro.qcPhotosPerItem,
  haulsMax: PLAN_CAPS.pro.haulsMax,
};

// What this account may use, for a cap that is not a daily counter. The
// snapshot's `lim` already carries the right numbers for the plan, so a Pro or
// grace user needs no special case here.
//
// Signed out means the free cap, NOT unlimited. This is the opposite of
// overFreeLimit, and on purpose: a metered counter is enforced again by the
// server on every call, so a signed-out user can be left to it. A QC photo and
// a haul never reach a server, so if the client does not hold the line here,
// nothing does.
export function planLimit(plan, key) {
  const cap = plan && plan.lim ? plan.lim[key] : null;
  return typeof cap === "number" && cap > 0 ? cap : FREE_LIMITS[key];
}

// Is a signed-in FREE user over its permanent allowance for this feature?
// decoded snapshot payload; null/expired plan or a non-free state means "not
// over" — signed-out users answer to the server rate limits, and Pro/grace
// users get Pro caps the client never enforces (they are generous).
export function overFreeLimit(plan, feature, { host, now } = {}) {
  if (!plan || !plan.lim || plan.state !== "free") return false;
  const cap = plan.lim[feature + "Total"];
  if (cap == null) return false;
  return usageTotal(feature, { host, now, audience: usageAudience(plan, true) }) >= cap;
}
