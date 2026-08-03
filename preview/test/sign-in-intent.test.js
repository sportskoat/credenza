// Feature 2 · return intent.
// Sign-in handoff README: "Every entry into the sign-in modal records where it
// came from and what the user was trying to do." These tests pin the two
// things that break the promise: a record that does not survive the round
// trip, and a record that survives too long.
import { describe, it, expect, beforeEach } from "vitest";
import {
  INTENT_KEY,
  INTENT_KINDS,
  clearIntent,
  readIntent,
  rememberIntent,
  takeIntent,
} from "../../components/sign-in-intent.js";

// A host whose sessionStorage throws on every touch, the way Safari private
// mode does.
const hostileHost = {
  get sessionStorage() {
    throw new Error("SecurityError");
  },
};

// A host whose storage exists but refuses to write, the way a full quota does.
const fullHost = {
  sessionStorage: {
    getItem: () => null,
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
    removeItem: () => {
      throw new Error("QuotaExceededError");
    },
  },
};

beforeEach(() => {
  window.sessionStorage.clear();
});

describe("return intent · round trip", () => {
  it("brings back what it was given", () => {
    rememberIntent({ kind: "upgrade", returnTo: "/upgrade", payload: { period: "year" } });
    expect(readIntent()).toEqual({
      kind: "upgrade",
      returnTo: "/upgrade",
      payload: { period: "year" },
    });
  });

  it("fills in the shelf when no return path is named", () => {
    rememberIntent({ kind: "shelf" });
    expect(readIntent()).toEqual({ kind: "shelf", returnTo: "/", payload: null });
  });

  it("accepts every kind an entry point can name", () => {
    for (const kind of INTENT_KINDS) {
      rememberIntent({ kind });
      expect(readIntent().kind).toBe(kind);
    }
  });
});

describe("return intent · refusals", () => {
  it("records nothing for a kind no handler knows", () => {
    expect(rememberIntent({ kind: "checkout", returnTo: "/pay" })).toBeNull();
    expect(readIntent()).toBeNull();
  });

  it("records nothing when there is no intent at all", () => {
    expect(rememberIntent(null)).toBeNull();
    expect(rememberIntent(undefined)).toBeNull();
  });

  it("stays quiet when the browser blocks storage", () => {
    expect(rememberIntent({ kind: "card" }, hostileHost)).toBeNull();
    expect(readIntent(hostileHost)).toBeNull();
    expect(() => clearIntent(hostileHost)).not.toThrow();
  });

  it("stays quiet when the write is refused", () => {
    expect(rememberIntent({ kind: "card" }, fullHost)).toBeNull();
    expect(() => clearIntent(fullHost)).not.toThrow();
  });

  it("ignores a record that is not readable", () => {
    window.sessionStorage.setItem(INTENT_KEY, "{not json");
    expect(readIntent()).toBeNull();
  });

  it("ignores a record whose kind was retired", () => {
    window.sessionStorage.setItem(INTENT_KEY, JSON.stringify({ kind: "gone", returnTo: "/" }));
    expect(readIntent()).toBeNull();
  });
});

describe("return intent · one use only", () => {
  it("hands the intent over and forgets it", () => {
    rememberIntent({ kind: "card", payload: { url: "https://shop.test/x" } });
    expect(takeIntent().kind).toBe("card");
    // A handler that throws must not replay the same intent on every reload.
    expect(takeIntent()).toBeNull();
    expect(window.sessionStorage.getItem(INTENT_KEY)).toBeNull();
  });

  it("returns nothing when there is nothing to return", () => {
    expect(takeIntent()).toBeNull();
  });
});
