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

const DAY_FMT = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }); // YYYY-MM-DD

export function usageKey(feature, now = Date.now()) {
  return feature + ":" + DAY_FMT.format(now);
}

export function usageToday(feature, { host = defaultHost(), now } = {}) {
  return readUsage(host)[usageKey(feature, now)] || 0;
}

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

// Increment today's counter and prune every day that is not today or
// yesterday (same shape as the server record — small forever).
export function bumpUsage(feature, { host = defaultHost(), now = Date.now() } = {}) {
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
    askPerDay: 5,
    chartVisionPerDay: 2,
    resolvePerDay: 20,
    qcPhotosPerItem: 4,
    haulsMax: 2,
    sharedLinksMax: 3,
  },
  pro: {
    askPerDay: 40,
    chartVisionPerDay: 15,
    resolvePerDay: 250,
    qcPhotosPerItem: 12,
    haulsMax: 100,
    sharedLinksMax: 100,
  },
};

// Only the per-ITEM and per-ACCOUNT caps get their own names. The per-DAY
// caps are counted, and a signed-out user is counted by the server, not by
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
// overFreeLimit, and on purpose: a daily counter is enforced again by the
// server on every call, so a signed-out user can be left to it. A QC photo and
// a haul never reach a server, so if the client does not hold the line here,
// nothing does.
export function planLimit(plan, key) {
  const cap = plan && plan.lim ? plan.lim[key] : null;
  return typeof cap === "number" && cap > 0 ? cap : FREE_LIMITS[key];
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
