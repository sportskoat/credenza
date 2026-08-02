// "Sign in to read this link" (Kyle 2026-07-30).
//
// A signed-out visitor gets three complete cards. After that every paid
// function refuses, and the card SAYS why instead of sitting there empty.
// Three parts, one file:
//   1. the free-taste counter itself;
//   2. the gate that reads it, and the refusal code it returns;
//   3. the card copy, and the session rule that keeps a customer signed in
//      through a server outage.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const anon = require("../netlify/functions/lib/anon-allowance.js");
const gate = require("../netlify/functions/lib/paid-gate.js");
const limit = require("../netlify/functions/lib/limit.js");

const SHARED = "shared-secret";

// ── 1. The free-taste counter ──────────────────────────────────────────────

describe("the three free reads a signed-out visitor gets", () => {
  beforeEach(() => {
    anon._resetForTest();
  });

  it("allows three link reads, then refuses the fourth", () => {
    for (let i = 0; i < 3; i++) {
      expect(anon.allowAnon("resolve", "1.2.3.4"), "read " + (i + 1)).toBe(true);
      anon.recordAnon("resolve", "1.2.3.4");
    }
    expect(anon.allowAnon("resolve", "1.2.3.4")).toBe(false);
    expect(anon.freeLeft("resolve", "1.2.3.4")).toBe(0);
  });

  it("keeps the chart read on its own count, so a card can finish", () => {
    for (let i = 0; i < 3; i++) anon.recordAnon("resolve", "1.2.3.4");
    expect(anon.allowAnon("chartVision", "1.2.3.4")).toBe(true);
  });

  it("never gives Ask away", () => {
    expect(anon.allowAnon("ask", "1.2.3.4")).toBe(false);
    anon.recordAnon("ask", "1.2.3.4");
    expect(anon.freeLeft("ask", "1.2.3.4")).toBe(0);
  });

  it("counts each visitor on their own", () => {
    for (let i = 0; i < 3; i++) anon.recordAnon("resolve", "1.2.3.4");
    expect(anon.allowAnon("resolve", "9.9.9.9")).toBe(true);
  });

  it("starts the count again on the next day", () => {
    const day1 = Date.parse("2026-07-30T12:00:00Z");
    const day2 = Date.parse("2026-07-31T00:30:00Z");
    for (let i = 0; i < 3; i++) anon.recordAnon("resolve", "1.2.3.4", day1);
    expect(anon.allowAnon("resolve", "1.2.3.4", day1)).toBe(false);
    expect(anon.allowAnon("resolve", "1.2.3.4", day2)).toBe(true);
  });

  it("promises three free link reads, and none for Ask", () => {
    // The interface says "3 free". These numbers are that promise.
    expect(anon.ANON_FREE_PER_DAY).toEqual({ resolve: 3, chartVision: 3, ask: 0 });
  });
});

// ── 2. The gate that reads the counter ─────────────────────────────────────

function anonPost(ip) {
  return {
    httpMethod: "POST",
    headers: { "x-credenza-key": SHARED, "x-nf-client-connection-ip": ip },
    body: "{}",
  };
}

describe("the gate, with accounts required", () => {
  const env = { REQUIRE_ACCOUNTS: "true", CREDENZA_SEARCH_SECRET: SHARED };

  beforeEach(() => {
    anon._resetForTest();
    limit._resetForTest();
  });

  it("lets the first three link reads through, then names the refusal", async () => {
    for (let i = 0; i < 3; i++) {
      const ok = await gate.authorizePaid(anonPost("5.5.5.5"), env, "resolve");
      expect(ok.ok, "read " + (i + 1)).toBe(true);
      expect(ok.via).toBe("anon-free");
      await gate.recordPaidUsage(ok, "resolve");
    }
    const refused = await gate.authorizePaid(anonPost("5.5.5.5"), env, "resolve");
    expect(refused.ok).toBe(false);
    expect(refused.status).toBe(401);
    // The code is what the browser reads. Without it the app cannot tell a
    // "please sign in" apart from a real authorization fault.
    expect(refused.body.code).toBe("sign_in_required");
  });

  it("refuses Ask at once, because Ask is never free", async () => {
    const refused = await gate.authorizePaid(anonPost("5.5.5.6"), env, "ask");
    expect(refused.ok).toBe(false);
    expect(refused.body.code).toBe("sign_in_required");
  });

  it("still refuses a caller with the wrong shared key, with no code", async () => {
    const event = { httpMethod: "POST", headers: { "x-credenza-key": "wrong" }, body: "{}" };
    const refused = await gate.authorizePaid(event, env, "resolve");
    expect(refused.ok).toBe(false);
    expect(refused.status).toBe(401);
    expect(refused.body.code).toBeUndefined();
  });

  it("does not spend a free read on a call that failed", async () => {
    const ok = await gate.authorizePaid(anonPost("5.5.5.7"), env, "resolve");
    expect(ok.ok).toBe(true);
    // The function threw, so recordPaidUsage never runs.
    expect(anon.freeLeft("resolve", limit.clientKey(anonPost("5.5.5.7")))).toBe(3);
  });
});

// ── 3. The session rule ────────────────────────────────────────────────────
//
// Before this rule ONE failed renewal signed the customer out for good. A
// rejected token is permanent. A 500, a 502, or a dropped connection is not.

describe("a paid session survives a server outage", () => {
  let auth;
  let host;

  beforeEach(async () => {
    // The session lives in one localStorage key. A fresh fake store per test
    // keeps each case on its own device.
    const store = new Map();
    host = {
      localStorage: {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
      },
    };
    // The shared renewal promise is module state. Reload the module so one
    // test's renewal never answers the next one.
    vi.resetModules();
    auth = await import("../src/auth.js");
  });

  function saveExpiring() {
    auth.saveSession(
      {
        accessToken: "old-access",
        refreshToken: "old-refresh",
        expiresAt: Date.now() + 1000, // inside the last minute, so it renews
        user: { id: "u1", email: "a@b.com" },
      },
      host
    );
  }

  it("keeps the session when the renewal server answers 500", async () => {
    saveExpiring();
    const fetchImpl = async () => ({ ok: false, status: 500, json: async () => ({}) });
    // A transient failure retries once, then falls back to the still-live
    // stored token instead of no session at all (2026-08-02 incident: this
    // used to return null here, so the caller sent no Authorization header
    // and the server 401'd a session that was really fine).
    const session = await auth.getValidSession({ fetchImpl, host, retryDelayMs: 0 });
    expect(session).not.toBe(null);
    expect(session.accessToken).toBe("old-access");
    expect(auth.loadSession(host)).not.toBe(null);
  });

  it("keeps the session when the network drops", async () => {
    saveExpiring();
    const fetchImpl = async () => {
      throw new Error("offline");
    };
    const session = await auth.getValidSession({ fetchImpl, host, retryDelayMs: 0 });
    expect(session).not.toBe(null);
    expect(session.accessToken).toBe("old-access");
    expect(auth.loadSession(host)).not.toBe(null);
  });

  it("signs the device out only when the token is rejected", async () => {
    saveExpiring();
    const fetchImpl = async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: "invalid_grant" }),
    });
    expect(await auth.getValidSession({ fetchImpl, host })).toBe(null);
    expect(auth.loadSession(host)).toBe(null);
  });

  it("renews once when two calls need the token at the same moment", async () => {
    saveExpiring();
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "new-access",
          refresh_token: "new-refresh",
          expires_in: 3600,
          user: { id: "u1", email: "a@b.com" },
        }),
      };
    };
    const [a, b] = await Promise.all([
      auth.getValidSession({ fetchImpl, host }),
      auth.getValidSession({ fetchImpl, host }),
    ]);
    // Supabase kills the old token the moment it issues a new one. Two
    // renewals would sign the customer out.
    expect(calls).toBe(1);
    expect(a.accessToken).toBe("new-access");
    expect(b.accessToken).toBe("new-access");
  });
});

// ── 4. The card says why it is empty ───────────────────────────────────────

const { default: DetailBody } = await import("../../components/DetailBody.jsx");

function emptyCard(extra = {}) {
  return {
    id: "si-1",
    createdAt: 1753400000000,
    url: "https://weidian.com/item.html?itemID=111",
    title: "Weidian item",
    seller: "replux",
    category: "shirt",
    findStatus: "want",
    ...extra,
  };
}

describe("the card a signed-out visitor gets back", () => {
  afterEach(() => cleanup());

  function renderCard(item) {
    return render(
      <DetailBody
        item={item}
        bodyProfile={{ chest: "96", height: "180", weight: "75" }}
        buyLabel="Buy via Superbuy"
        onOpen={vi.fn()}
        onAttachPhoto={vi.fn()}
        onRemovePhoto={vi.fn()}
        onOpenSizes={vi.fn()}
        onSaveEdit={vi.fn()}
      />
    );
  }

  it("says sign in, where the size chart belongs", async () => {
    renderCard(emptyCard({ needsSignIn: true }));

    expect(await screen.findByText("Needs sign-in")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Sign in to finish this card. Credenza then reads the product, the photos, and the size chart."
      )
    ).toBeInTheDocument();
    // The old wording must not show at the same time.
    expect(screen.queryByText("No size chart found.")).toBeNull();
  });

  it("keeps the plain no-chart wording for every other empty card", async () => {
    renderCard(emptyCard());

    expect(await screen.findByText("No chart")).toBeInTheDocument();
    expect(screen.getByText("No size chart found.")).toBeInTheDocument();
    expect(screen.queryByText("Needs sign-in")).toBeNull();
  });

  it("hides the album row, because reading photos costs the same refused call", async () => {
    const photos = [{ role: "photos", url: "https://x.yupoo.com/albums/1" }];
    renderCard(emptyCard({ needsSignIn: true, links: photos, gallery: ["a.jpg", "b.jpg"] }));

    await screen.findByText("Needs sign-in");
    expect(document.querySelector(".cz-sizing-albumrow")).toBe(null);
  });
});

// FIX 0 (2026-08-02): chart-vision 401/403 shows distinct signed-out copy + Sign in.
// Pins the customer-facing mapping so a signed-out person is not told
// "No size chart found" or "I could not read that photo."
describe("chart auth wall copy (FIX 0)", () => {
  it("exports the pinned signed-out sentence for both manual and hunt paths", async () => {
    const { CHART_AUTH_COPY, isChartAuthRequired, CHART_AUTH_REQUIRED } = await import(
      "../../credenza-fashion.jsx"
    );
    expect(CHART_AUTH_COPY).toBe("You are signed out. Sign in to read charts.");
    expect(isChartAuthRequired(CHART_AUTH_REQUIRED)).toBe(true);
    expect(isChartAuthRequired(null)).toBe(false);
    expect(isChartAuthRequired("M chest 100\nL chest 104")).toBe(false);
    // Old lies must not match the new sentence.
    expect(CHART_AUTH_COPY).not.toMatch(/could not read/i);
    expect(CHART_AUTH_COPY).not.toMatch(/No size chart found/i);
  });
});
