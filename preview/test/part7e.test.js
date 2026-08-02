// Part 7e: client auth (magic link / Google / refresh / logout over REST) and
// the entitlement snapshot cache. All network calls take an injected
// fetchImpl — no real network, no real Supabase.

import { describe, it, expect, beforeEach } from "vitest";
import { createRequire } from "node:module";
import {
  loadSession,
  saveSession,
  clearSession,
  sessionFromUrl,
  sendMagicLink,
  googleAuthUrl,
  getValidSession,
  signOut,
  SESSION_KEY,
} from "../src/auth.js";
import {
  decodeSnapshot,
  loadCachedEntitlement,
  refreshEntitlement,
  clearCachedEntitlement,
  checkout,
  openPortal,
  deleteAccount,
  safeErrorMessage,
  ENTITLEMENT_KEY,
} from "../src/account.js";
import { usageToday, bumpUsage, overFreeLimit, USAGE_KEY } from "../src/usage.js";

const require = createRequire(import.meta.url);
const { signJwt } = require("../netlify/functions/lib/jwt.js");
const ent = require("../netlify/functions/lib/entitlements.js");

const SECRET = "test-secret";

// A window-shaped host with real localStorage semantics (jsdom's window works,
// but an explicit host keeps these tests independent of the environment).
function fakeHost() {
  const map = new Map();
  return {
    localStorage: {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
    },
  };
}

function fakeAccessToken(payload = {}) {
  return signJwt(
    { sub: "user-1", email: "u@example.com", exp: Math.floor(Date.now() / 1000) + 3600, ...payload },
    SECRET
  );
}

const okJson = (body, status = 200) => ({ ok: status < 300, status, json: async () => body });

beforeEach(() => {
  clearSession();
  clearCachedEntitlement();
});

// ————— session persistence ————————————————————————————————————————————————————

describe("session persistence", () => {
  it("round-trips a session and rejects garbage", () => {
    const host = fakeHost();
    expect(loadSession(host)).toBeNull();

    saveSession({ accessToken: "a", refreshToken: "r", expiresAt: 1, user: { id: "u", email: "" } }, host);
    expect(loadSession(host).accessToken).toBe("a");

    host.localStorage.setItem(SESSION_KEY, "{not json");
    expect(loadSession(host)).toBeNull();
    host.localStorage.setItem(SESSION_KEY, JSON.stringify({ accessToken: "a" })); // no refreshToken
    expect(loadSession(host)).toBeNull();

    clearSession(host);
    expect(loadSession(host)).toBeNull();
  });
});

// ————— redirect landing ———————————————————————————————————————————————————————

describe("sessionFromUrl", () => {
  it("reads the session out of the redirect hash", () => {
    const token = fakeAccessToken();
    const url =
      "https://credenzafashion.com/#access_token=" + token +
      "&refresh_token=ref-1&expires_in=3600&token_type=bearer";
    const { session } = sessionFromUrl(url);
    expect(session.accessToken).toBe(token);
    expect(session.refreshToken).toBe("ref-1");
    expect(session.user.id).toBe("user-1");
    expect(session.user.email).toBe("u@example.com");
    expect(session.expiresAt).toBeGreaterThan(Date.now());
  });

  it("surfaces a Supabase error hash and ignores a hash-free URL", () => {
    const err = sessionFromUrl("https://credenzafashion.com/#error=access_denied&error_description=Link+expired");
    expect(err.error).toBe("Link expired");
    expect(sessionFromUrl("https://credenzafashion.com/")).toBeNull();
    expect(sessionFromUrl("https://credenzafashion.com/#section=about")).toBeNull();
  });
});

// ————— REST calls ——————————————————————————————————————————————————————————————

describe("sendMagicLink", () => {
  it("posts an OTP request with the email and create_user", async () => {
    const seen = [];
    const fetchImpl = async (url, init) => {
      seen.push({ url: String(url), body: JSON.parse(init.body) });
      return okJson({});
    };
    await sendMagicLink("u@example.com", { fetchImpl, redirectTo: "https://credenzafashion.com" });
    expect(seen[0].url).toContain("/auth/v1/otp");
    expect(seen[0].body.email).toBe("u@example.com");
    expect(seen[0].body.create_user).toBe(true);
  });

  it("throws Supabase's error message on failure", async () => {
    const fetchImpl = async () => okJson({ error_description: "rate limited" }, 429);
    await expect(sendMagicLink("u@example.com", { fetchImpl })).rejects.toThrow("rate limited");
  });
});

describe("googleAuthUrl", () => {
  it("points at the authorize endpoint with the redirect target", () => {
    const url = googleAuthUrl({ redirectTo: "https://credenzafashion.com" });
    expect(url).toContain("/auth/v1/authorize?provider=google");
    expect(url).toContain("redirect_to=" + encodeURIComponent("https://credenzafashion.com"));
  });
});

describe("getValidSession", () => {
  it("returns an unexpired session without a network call", async () => {
    const host = fakeHost();
    saveSession({ accessToken: "a", refreshToken: "r", expiresAt: Date.now() + 3600e3, user: {} }, host);
    const fetchImpl = async () => {
      throw new Error("network must not be touched");
    };
    const session = await getValidSession({ fetchImpl, host });
    expect(session.accessToken).toBe("a");
  });

  it("refreshes an expired session and stores the new tokens", async () => {
    const host = fakeHost();
    saveSession({ accessToken: "old", refreshToken: "r1", expiresAt: Date.now() + 1000, user: {} }, host);
    const token = fakeAccessToken();
    const fetchImpl = async (url, init) => {
      expect(String(url)).toContain("grant_type=refresh_token");
      expect(JSON.parse(init.body).refresh_token).toBe("r1");
      return okJson({ access_token: token, refresh_token: "r2", expires_in: 3600 });
    };
    const session = await getValidSession({ fetchImpl, host });
    expect(session.accessToken).toBe(token);
    expect(session.refreshToken).toBe("r2");
    expect(loadSession(host).refreshToken).toBe("r2");
  });

  it("signs the device out when the refresh fails", async () => {
    const host = fakeHost();
    saveSession({ accessToken: "old", refreshToken: "r1", expiresAt: Date.now() - 1000, user: {} }, host);
    const fetchImpl = async () => okJson({ error: "invalid_grant" }, 400);
    expect(await getValidSession({ fetchImpl, host })).toBeNull();
    expect(loadSession(host)).toBeNull();
  });

  // 2026-08-02 incident: a single transient refresh failure (cold function,
  // network blip) was falling through to null, so the caller sent NO
  // Authorization header at all and the server 401'd a live session.
  it("retries once on a transient refresh error, then succeeds", async () => {
    const host = fakeHost();
    saveSession({ accessToken: "old", refreshToken: "r1", expiresAt: Date.now() - 1000, user: {} }, host);
    const token = fakeAccessToken();
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      if (calls === 1) return okJson({ error: "upstream timeout" }, 504);
      return okJson({ access_token: token, refresh_token: "r2", expires_in: 3600 });
    };
    const session = await getValidSession({ fetchImpl, host, retryDelayMs: 0 });
    expect(calls).toBe(2);
    expect(session.accessToken).toBe(token);
    expect(loadSession(host).refreshToken).toBe("r2");
  });

  it("keeps the stored (still-live) token when the refresh stays transient after the retry", async () => {
    const host = fakeHost();
    saveSession({ accessToken: "old", refreshToken: "r1", expiresAt: Date.now() - 1000, user: {} }, host);
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      throw new Error("network unreachable"); // no .status -> transient
    };
    const session = await getValidSession({ fetchImpl, host, retryDelayMs: 0 });
    expect(calls).toBe(2); // one attempt + one retry, never a bare fall-through
    expect(session).not.toBeNull();
    expect(session.accessToken).toBe("old");
    // The stored session is untouched — this was not treated as a sign-out.
    expect(loadSession(host).accessToken).toBe("old");
  });

  it("still signs out on rejection even after the retry path exists", async () => {
    const host = fakeHost();
    saveSession({ accessToken: "old", refreshToken: "r1", expiresAt: Date.now() - 1000, user: {} }, host);
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return okJson({ error: "invalid_grant" }, 401);
    };
    const session = await getValidSession({ fetchImpl, host, retryDelayMs: 0 });
    expect(calls).toBe(1); // rejection is permanent -> no retry
    expect(session).toBeNull();
    expect(loadSession(host)).toBeNull();
  });
});

describe("signOut", () => {
  it("clears the local session even when the server call fails", async () => {
    const host = fakeHost();
    saveSession({ accessToken: "a", refreshToken: "r", expiresAt: 1, user: {} }, host);
    const fetchImpl = async () => {
      throw new Error("offline");
    };
    await signOut({ accessToken: "a" }, { fetchImpl, host });
    expect(loadSession(host)).toBeNull();
  });
});

// ————— entitlement cache ——————————————————————————————————————————————————————

describe("entitlement cache", () => {
  const SIGN = "sign-secret";
  const snapshotFor = (userId, overrides = {}) =>
    ent.signEntitlement({ ...ent.newEntitlement(userId), ...overrides }, SIGN);

  it("decodes a snapshot without the secret and caches it", async () => {
    const host = fakeHost();
    const snapshot = snapshotFor("user-1");
    const fetchImpl = async (url, init) => {
      expect(init.headers.authorization).toBe("Bearer tok-1");
      return okJson({ snapshot, state: "free" });
    };
    const payload = await refreshEntitlement("tok-1", { fetchImpl, host });
    expect(payload.sub).toBe("user-1");
    expect(payload.plan).toBe("free");

    const cached = loadCachedEntitlement(host);
    expect(cached.sub).toBe("user-1");
    expect(cached.lim).toEqual(ent.PLAN_LIMITS.free);

    // Tampered or foreign snapshots decode to garbage/expired shapes — the
    // cache reader rejects them (the server rejects them harder).
    host.localStorage.setItem(ENTITLEMENT_KEY, JSON.stringify({ snapshot: "junk.junk" }));
    expect(loadCachedEntitlement(host)).toBeNull();
  });

  it("drops an expired snapshot", () => {
    const host = fakeHost();
    const stale = ent.signEntitlement(ent.newEntitlement("user-1"), SIGN, Date.now() - 48 * 3600e3, 3600e3);
    host.localStorage.setItem(ENTITLEMENT_KEY, JSON.stringify({ snapshot: stale }));
    expect(loadCachedEntitlement(host)).toBeNull();
  });

  it("decodeSnapshot rejects non-snapshot strings", () => {
    expect(decodeSnapshot("")).toBeNull();
    expect(decodeSnapshot("a.b.c")).toBeNull();
    expect(decodeSnapshot(null)).toBeNull();
  });
});

// ————— free-limit usage counters ———————————————————————————————————————————————

describe("usage counters", () => {
  const freePlan = { state: "free", lim: { askPerDay: 2 } };
  const proPlan = { state: "pro", lim: { askPerDay: 200 } };

  it("counts per UTC day and prunes older days", () => {
    const host = fakeHost();
    const now = Date.UTC(2026, 6, 25, 12);
    expect(usageToday("ask", { host, now })).toBe(0);

    bumpUsage("ask", { host, now });
    bumpUsage("ask", { host, now });
    expect(usageToday("ask", { host, now })).toBe(2);

    // A counter from three days ago is pruned on the next bump.
    host.localStorage.setItem(USAGE_KEY, JSON.stringify({ "ask:2026-07-20": 9, "ask:2026-07-25": 2 }));
    bumpUsage("ask", { host, now });
    const stored = JSON.parse(host.localStorage.getItem(USAGE_KEY));
    expect(stored["ask:2026-07-20"]).toBeUndefined();
    expect(stored["ask:2026-07-25"]).toBe(3);
  });

  it("overFreeLimit fires only for a free plan at its cap", () => {
    const host = fakeHost();
    const now = Date.UTC(2026, 6, 25, 12);
    bumpUsage("ask", { host, now });
    expect(overFreeLimit(freePlan, "ask", { host, now })).toBe(false); // 1 of 2
    bumpUsage("ask", { host, now });
    expect(overFreeLimit(freePlan, "ask", { host, now })).toBe(true); // 2 of 2

    // Pro, no plan (signed out), and unmetered features never block locally.
    expect(overFreeLimit(proPlan, "ask", { host, now })).toBe(false);
    expect(overFreeLimit(null, "ask", { host, now })).toBe(false);
    expect(overFreeLimit(freePlan, "hauls", { host, now })).toBe(false);
  });
});

// ————— checkout + portal ———————————————————————————————————————————————————————
describe("checkout + portal", () => {
  it("checkout posts the price choice and returns the redirect URL", async () => {
    const seen = [];
    const fetchImpl = async (url, init) => {
      seen.push({ url: String(url), body: JSON.parse(init.body), auth: init.headers.authorization });
      return okJson({ url: "https://checkout.stripe.com/pay/cs_1" });
    };
    const url = await checkout("tok-1", "yearly", { fetchImpl });
    expect(url).toBe("https://checkout.stripe.com/pay/cs_1");
    expect(seen[0].url).toContain("/.netlify/functions/checkout");
    expect(seen[0].body).toEqual({ price: "yearly" });
    expect(seen[0].auth).toBe("Bearer tok-1");
  });

  it("portal returns the redirect URL; both throw the server error", async () => {
    const fetchImpl = async () => okJson({ url: "https://billing.stripe.com/p/1" });
    expect(await openPortal("tok-1", { fetchImpl })).toBe("https://billing.stripe.com/p/1");

    const failing = async () => okJson({ error: "No billing account yet" }, 400);
    await expect(openPortal("tok-1", { fetchImpl: failing })).rejects.toThrow("No billing account yet");
    await expect(checkout("tok-1", "monthly", { fetchImpl: failing })).rejects.toThrow("No billing account yet");
  });

  it("deleteAccount confirms; a 409 (active subscription) throws the message", async () => {
    const fetchImpl = async (url) => {
      expect(String(url)).toContain("/.netlify/functions/delete-account");
      return okJson({ deleted: true });
    };
    expect(await deleteAccount("tok-1", { fetchImpl })).toBe(true);

    const paying = async () => okJson({ error: "Cancel your subscription in Manage billing first, then delete the account." }, 409);
    await expect(deleteAccount("tok-1", { fetchImpl: paying })).rejects.toThrow("Cancel your subscription");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LB-42. The billing screen repeated the server's own words back to the buyer.
//
// ProfileSheet.run() — now AccountPlanSection.run(), same pattern — catches
// what post() throws and renders err.message into the section. post() threw
// `data.error` — the server's string. So pressing Upgrade with one variable
// unset showed a paying visitor
// "Server not configured: missing STRIPE_PRICE_MONTHLY".
//
// The two tests directly above look like they covered this. They do not. Both
// assert a message written FOR a user — "No billing account yet" and "Cancel
// your subscription…". Those are the two safe strings in the whole path. The
// eight that name Stripe or an environment variable had nothing on them. That
// is the LB-41 lesson again: under test is not the same as covered.
//
// The rule is an allowlist. A blocklist of vendor names passes every message
// written after the blocklist, and the failing string is always the one nobody
// thought about.
describe("no billing failure shows the server's own words", () => {
  const LEAKS = [
    ["Server not configured: missing STRIPE_PRICE_MONTHLY", 500],
    ["Server not configured: missing CREDENZA_SEARCH_SECRET", 500],
    ["Stripe did not return a checkout URL", 502],
    ["Stripe error: No such price: price_123", 502],
    ["Anthropic rate limit reached; try again shortly", 429],
    ["Internal error", 500],
    ["Invalid JSON body", 400],
  ];

  for (const [serverError, status] of LEAKS) {
    it(`replaces "${serverError.slice(0, 42)}"`, async () => {
      const failing = async () => okJson({ error: serverError }, status);
      let thrown = null;
      await checkout("tok-1", "monthly", { fetchImpl: failing }).catch((e) => {
        thrown = e;
      });
      expect(thrown, "checkout should reject").toBeTruthy();
      expect(thrown.message, "the server string must not reach the screen").not.toBe(serverError);
      // Vendor and environment names, checked on the rendered message rather
      // than on this one string, so a reworded server error cannot slip past.
      for (const word of ["stripe", "anthropic", "supabase", "secret", "_key", "price_"]) {
        expect(
          thrown.message.toLowerCase().includes(word),
          `rendered message says "${word}": ${thrown.message}`
        ).toBe(false);
      }
      // Still available to a developer in the console.
      expect(thrown.serverError, "the real error must survive for debugging").toBe(serverError);
      expect(thrown.status).toBe(status);
    });
  }

  it("keeps the two messages that were written for the person reading them", async () => {
    // Guard the guard. A rule that replaced everything would pass every check
    // above and quietly delete the one sentence that names the next action.
    const keep = async () => okJson({ error: "No billing account yet" }, 400);
    await expect(openPortal("tok-1", { fetchImpl: keep })).rejects.toThrow("No billing account yet");

    const paying = async () =>
      okJson({ error: "Cancel your subscription in Manage billing first, then delete the account." }, 409);
    await expect(deleteAccount("tok-1", { fetchImpl: paying })).rejects.toThrow(
      "Cancel your subscription in Manage billing first, then delete the account."
    );
  });

  it("keeps the daily cap line, which is generated and cannot be listed", async () => {
    // paid-gate.js builds this from the feature name, so it is matched on
    // shape. It is the only message that tells a free user why the button
    // stopped working, and it names no vendor and no variable.
    const capped = async () => okJson({ error: "Daily ask limit reached — upgrade to Pro for more" }, 429);
    await expect(checkout("tok-1", "monthly", { fetchImpl: capped })).rejects.toThrow(
      "Daily ask limit reached — upgrade to Pro for more"
    );
  });

  it("names the right thing when the subject is not billing", () => {
    // A 500 on the Ask box must not say "Billing is not answering".
    expect(safeErrorMessage(500, "Anthropic exploded", "Cloud Ask")).toBe(
      "Cloud Ask is not answering right now. Try again in a minute."
    );
    expect(safeErrorMessage(500, "Stripe exploded")).toBe(
      "Billing is not answering right now. Try again in a minute."
    );
  });

  it("tells a signed-out person to sign in rather than what broke", () => {
    expect(safeErrorMessage(401, "Unauthorized")).toBe("Your sign-in expired. Sign in again first.");
    expect(safeErrorMessage(429, "Too fast")).toBe("Too many tries. Wait a moment and try again.");
  });
});
