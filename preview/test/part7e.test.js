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
  ENTITLEMENT_KEY,
} from "../src/account.js";

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
});
