// Return-intent for sign-in.
//
// Sign-in handoff README, "Interactions & behaviour": "Every entry into the
// sign-in modal records where it came from and what the user was trying to
// do." Signing in from the cap modal creates the card that was blocked.
// Signing in from the Pro card returns to /upgrade with the billing period
// intact.
//
// This has to survive a full page load. A magic link opens in the mail app
// and lands on a cold tab, and Google and Apple both navigate away and come
// back. React state does not cross either of those, so the intent lives in
// sessionStorage: it belongs to this tab and this visit, and it disappears
// when the tab closes. localStorage would leave a stale intent to fire days
// later, on a shelf the person was not looking at.
export const INTENT_KEY = "credenza-fashion-signin-intent-v1";

// Where the person was, and what they were reaching for. Every entry point
// names one of these, so a new caller cannot invent an unhandled kind.
export const INTENT_KINDS = ["shelf", "card", "upgrade", "settings"];

const store = (host) => {
  const h = host || (typeof window !== "undefined" ? window : null);
  try {
    return h && h.sessionStorage ? h.sessionStorage : null;
  } catch {
    // Safari private mode throws on the property itself.
    return null;
  }
};

/**
 * Record where sign-in came from, before anything navigates away.
 *
 * @param {object} intent
 * @param {"shelf"|"card"|"upgrade"|"settings"} intent.kind
 * @param {string} [intent.returnTo] - the path to come back to
 * @param {object} [intent.payload]  - what to finish, e.g. {url} or {period}
 */
export function rememberIntent(intent, host) {
  const s = store(host);
  if (!s || !intent || !INTENT_KINDS.includes(intent.kind)) return null;
  const saved = {
    kind: intent.kind,
    returnTo: intent.returnTo || "/",
    payload: intent.payload || null,
  };
  try {
    s.setItem(INTENT_KEY, JSON.stringify(saved));
  } catch {
    return null;
  }
  return saved;
}

export function readIntent(host) {
  const s = store(host);
  if (!s) return null;
  try {
    const raw = s.getItem(INTENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && INTENT_KINDS.includes(parsed.kind) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearIntent(host) {
  const s = store(host);
  if (!s) return;
  try {
    s.removeItem(INTENT_KEY);
  } catch {
    // Nothing to do. A stale intent that cannot be cleared still expires
    // with the tab.
  }
}

/**
 * Read the intent once and hand it to the caller. Clearing first means a
 * handler that throws cannot leave the intent to fire again on every reload.
 */
export function takeIntent(host) {
  const intent = readIntent(host);
  clearIntent(host);
  return intent;
}
