// The return intent, read back (sign-in handoff README, "Interactions").
//
// README: "Every entry into the sign-in modal records where it came from and
// what the user was trying to do. Signing in from the cap modal creates the
// card that was blocked. Signing in from the Pro card returns to /upgrade
// with the chosen billing period intact."
//
// The modal wrote the intent down before it navigated away. Until now nothing
// read it back, so signing in landed the person on a bare shelf every time.
// These tests drive the whole app: they plant a session and an intent the way
// a returning magic link does, then check where the person ends up.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import Credenza from "../../credenza-fashion.jsx";
import { SESSION_KEY } from "../src/auth.js";
import { INTENT_KEY, readIntent } from "../../components/sign-in-intent.js";

const STORE_KEY = "credenza-fashion-items-v1";
// SettingsPage and UpgradePage are both code-split routes. Under full-suite
// load their first transform can outrun the one-second default.
const ROUTE_TIMEOUT = 3000;

function installShim(initial = {}) {
  const data = { ...initial };
  window.storage = {
    get: async (key) => (key in data ? { value: data[key] } : null),
    set: async (key, value) => {
      data[key] = value;
    },
  };
  return data;
}

// A live session, the way a finished sign-in leaves one. The expiry is an
// hour out, so getValidSession answers from storage and never renews.
function signIn() {
  window.localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: Date.now() + 60 * 60 * 1000,
      user: { id: "u1", email: "kyle@example.com" },
    })
  );
}

function plantIntent(intent) {
  window.sessionStorage.setItem(INTENT_KEY, JSON.stringify(intent));
}

describe("coming back from sign-in", () => {
  beforeEach(() => {
    // Every account call in this file is offline on purpose. The entitlement
    // fetch failing is the normal offline path and the app already carries on
    // through it; what is under test is where the person lands.
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("offline")))
    );
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.history.replaceState(null, "", "/");
    installShim({ [STORE_KEY]: JSON.stringify([]) });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  it("returns to Pro with the billing period the person chose", async () => {
    signIn();
    plantIntent({ kind: "upgrade", returnTo: "/upgrade", payload: { period: "yearly" } });
    render(<Credenza />);

    const pro = await screen.findByRole("dialog", { name: "Pro" }, { timeout: ROUTE_TIMEOUT });
    expect(pro).toBeInTheDocument();
    // The period survives the round trip. Weekly is the default, so a lost
    // intent would show weekly here.
    expect(await screen.findByRole("radio", { name: "Yearly" })).toBeChecked();
    await waitFor(() => expect(window.location.pathname).toBe("/upgrade"));
  });

  it("opens Pro on weekly when the intent carries no period", async () => {
    signIn();
    plantIntent({ kind: "upgrade", returnTo: "/upgrade", payload: null });
    render(<Credenza />);

    await screen.findByRole("dialog", { name: "Pro" }, { timeout: ROUTE_TIMEOUT });
    expect(await screen.findByRole("radio", { name: "Weekly" })).toBeChecked();
  });

  it("returns to Account and plan when sign-in started in Settings", async () => {
    signIn();
    plantIntent({ kind: "settings", returnTo: "/settings/account", payload: null });
    render(<Credenza />);

    const settings = await screen.findByRole(
      "dialog",
      { name: "Settings" },
      { timeout: ROUTE_TIMEOUT }
    );
    expect(settings).toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe("/settings/account"));
  });

  it("makes the card that was blocked, from the link the intent held", async () => {
    const data = installShim({ [STORE_KEY]: JSON.stringify([]) });
    signIn();
    plantIntent({
      kind: "card",
      returnTo: "/",
      payload: { url: "https://weidian.com/item.html?itemID=7799763843" },
    });
    render(<Credenza />);

    // The held link becomes a real card. A magic link opens on a cold tab, so
    // the in-memory copy is gone and the intent payload is all that is left.
    await waitFor(() => expect(JSON.parse(data[STORE_KEY])).toHaveLength(1), {
      timeout: ROUTE_TIMEOUT,
    });
    expect(JSON.parse(data[STORE_KEY])[0].url).toContain("itemID=7799763843");
  });

  it("leaves the shelf alone when the person was already on it", async () => {
    signIn();
    plantIntent({ kind: "shelf", returnTo: "/", payload: null });
    render(<Credenza />);

    await screen.findByPlaceholderText("Paste a link");
    expect(screen.queryByRole("dialog", { name: "Pro" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Settings" })).not.toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
  });

  it("spends the intent once, so a reload does not fire it again", async () => {
    signIn();
    plantIntent({ kind: "upgrade", returnTo: "/upgrade", payload: { period: "monthly" } });
    render(<Credenza />);

    await screen.findByRole("dialog", { name: "Pro" }, { timeout: ROUTE_TIMEOUT });
    expect(readIntent()).toBeNull();
    expect(window.sessionStorage.getItem(INTENT_KEY)).toBeNull();
  });

  it("stays on the shelf when there is no intent at all", async () => {
    signIn();
    render(<Credenza />);

    await screen.findByPlaceholderText("Paste a link");
    expect(screen.queryByRole("dialog", { name: "Pro" })).not.toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
  });

  it("ignores a stale intent when nobody is signed in", async () => {
    plantIntent({ kind: "upgrade", returnTo: "/upgrade", payload: { period: "yearly" } });
    render(<Credenza />);

    await screen.findByPlaceholderText("Paste a link");
    expect(screen.queryByRole("dialog", { name: "Pro" })).not.toBeInTheDocument();
    // The intent waits for a sign-in that has not happened. It is not spent.
    expect(readIntent()).not.toBeNull();
  });
});
