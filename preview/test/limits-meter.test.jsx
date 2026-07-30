// One meter and one sheet (Kyle 2026-07-30).
//
// Four rules came out of "each limit has its own words in its own corner":
//   1. One counter, always visible.
//   2. One sheet for every wall.
//   3. Warn before the wall, never at it.
//   4. A wall never breaks what you already have.
//
// This file pins the sentence on the pill, the tone of it, the numbers the
// sheet quotes, and the promise the sheet makes about saved cards.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ANON_FREE_CARDS, limitStandingLine, limitStatus, proHasEnded } from "../src/limits.js";
import { PLAN_CAPS, USAGE_KEY, bumpUsage, onUsageChange, usageToday } from "../src/usage.js";
import LimitsSheet from "../../sheets/LimitsSheet.jsx";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

afterEach(cleanup);

// A localStorage stand-in, so a test can put a visitor part-way through the
// day without touching the real browser store.
function fakeHost(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, v),
      removeItem: (k) => store.delete(k),
    },
  };
}

function withUsed(counts, now = Date.UTC(2026, 6, 30, 12)) {
  const day = new Date(now).toISOString().slice(0, 10);
  const usage = {};
  for (const [feature, n] of Object.entries(counts)) usage[feature + ":" + day] = n;
  return fakeHost({ [USAGE_KEY]: JSON.stringify(usage) });
}

const NOW = Date.UTC(2026, 6, 30, 12);

// ── The promise and the gate must agree ────────────────────────────────────

describe("the free-card promise", () => {
  it("matches the number the server actually allows", () => {
    const src = readFileSync(join(ROOT, "preview/netlify/functions/lib/anon-allowance.js"), "utf8");
    const block = src.slice(src.indexOf("const ANON_FREE_PER_DAY"));
    const served = Number(block.match(/resolve:\s*(\d+)/)[1]);
    expect(served).toBe(ANON_FREE_CARDS);
  });
});

// ── Rule 1 and rule 3: the pill ────────────────────────────────────────────

describe("the counter pill, signed out", () => {
  it("counts down the free cards", () => {
    const status = limitStatus({ signedIn: false, host: withUsed({ resolve: 1 }), now: NOW });
    expect(status.label).toBe("2 free cards left");
    expect(status.tone).toBe("ok");
    expect(status.left).toBe(2);
  });

  it("turns amber on the last free card, and says so in words", () => {
    const status = limitStatus({ signedIn: false, host: withUsed({ resolve: 2 }), now: NOW });
    expect(status.label).toBe("Last free card");
    expect(status.tone).toBe("warn");
  });

  it("reads empty once the allowance is spent", () => {
    const status = limitStatus({ signedIn: false, host: withUsed({ resolve: 3 }), now: NOW });
    expect(status.label).toBe("No free cards left");
    expect(status.tone).toBe("wall");
  });

  it("trusts the server over this device's own count", () => {
    // The device says two cards are left. The server has already refused, so
    // the pill must not promise something the next paste cannot deliver.
    const status = limitStatus({
      signedIn: false,
      blocked: true,
      host: withUsed({ resolve: 1 }),
      now: NOW,
    });
    expect(status.left).toBe(0);
    expect(status.tone).toBe("wall");
  });

  it("never counts below zero", () => {
    const status = limitStatus({ signedIn: false, host: withUsed({ resolve: 9 }), now: NOW });
    expect(status.left).toBe(0);
  });
});

describe("the counter pill, signed in on the free plan", () => {
  const plan = { state: "free", lim: PLAN_CAPS.free };

  it("shows the read that runs out first", () => {
    // Chart reads are the scarcest free allowance, so they are the wall this
    // person actually meets.
    const status = limitStatus({ plan, signedIn: true, host: withUsed({ chartVision: 1 }), now: NOW });
    expect(status.feature).toBe("chartVision");
    expect(status.label).toBe("1 chart read left today");
    expect(status.tone).toBe("warn");
  });

  it("moves to another meter when that one runs out first", () => {
    const host = withUsed({ resolve: PLAN_CAPS.free.resolvePerDay });
    const status = limitStatus({ plan, signedIn: true, host, now: NOW });
    expect(status.feature).toBe("resolve");
    expect(status.label).toBe("No cards left today");
    expect(status.tone).toBe("wall");
  });

  it("gives a Pro member no meter at all", () => {
    expect(limitStatus({ plan: { state: "pro", lim: PLAN_CAPS.pro }, signedIn: true })).toBe(null);
    expect(limitStatus({ plan: { state: "grace", lim: PLAN_CAPS.pro }, signedIn: true })).toBe(null);
  });
});

describe("an ended membership", () => {
  it("is a free plan with a grace date that has passed", () => {
    expect(proHasEnded({ state: "free", graceUntil: NOW - 1000 }, NOW)).toBe(true);
    expect(proHasEnded({ state: "free", graceUntil: NOW + 1000 }, NOW)).toBe(false);
    expect(proHasEnded({ state: "free" }, NOW)).toBe(false);
  });

  it("is named on the status, so the sheet can say the right thing", () => {
    const plan = { state: "free", lim: PLAN_CAPS.free, graceUntil: NOW - 1000 };
    const status = limitStatus({ plan, signedIn: true, host: withUsed({}), now: NOW });
    expect(status.kind).toBe("ended");
  });
});

// ── The counters themselves ────────────────────────────────────────────────

describe("the daily counters", () => {
  it("counts a spent read without being handed a browser", () => {
    // Every caller in the app omits `host`. The counters were dead while this
    // default was missing, and the pill would have read "3 free cards left"
    // for ever.
    const host = fakeHost();
    const before = usageToday("resolve", { host, now: NOW });
    bumpUsage("resolve", { host, now: NOW });
    expect(usageToday("resolve", { host, now: NOW })).toBe(before + 1);
  });

  it("tells the pill that a read was spent", () => {
    const seen = [];
    const off = onUsageChange((feature) => seen.push(feature));
    bumpUsage("chartVision", { host: fakeHost(), now: NOW });
    off();
    bumpUsage("chartVision", { host: fakeHost(), now: NOW });
    expect(seen).toEqual(["chartVision"]);
  });
});

// ── Rule 2 and rule 4: the sheet ───────────────────────────────────────────

describe("the one limits sheet", () => {
  it("tells a visitor where they stand, and what an account gives", () => {
    const status = limitStatus({ signedIn: false, host: withUsed({ resolve: 3 }), now: NOW });
    render(<LimitsSheet status={status} signedIn={false} />);
    expect(screen.getByText("3 of 3 free cards used.")).toBeTruthy();
    expect(screen.getByText(/Sign in — free/)).toBeTruthy();
    expect(screen.getByText(/Pro — \$5\.99 a month/)).toBeTruthy();
    // The caps come from PLAN_CAPS, so the sheet cannot quote a number the
    // app does not enforce.
    expect(screen.getByText(PLAN_CAPS.free.resolvePerDay + " a day")).toBeTruthy();
    expect(screen.getByText(PLAN_CAPS.pro.chartVisionPerDay + " a day")).toBeTruthy();
  });

  it("promises a signed-in person that a wall never deletes a card", () => {
    const plan = { state: "free", lim: PLAN_CAPS.free, graceUntil: NOW - 1000 };
    const status = limitStatus({ plan, signedIn: true, host: withUsed({}), now: NOW });
    render(<LimitsSheet status={status} signedIn />);
    expect(screen.getByText("Your Pro ended")).toBeTruthy();
    expect(screen.getByText(/stays on your shelf and stays readable/)).toBeTruthy();
    // No sign-in block: this person is already signed in.
    expect(screen.queryByText(/Sign in — free/)).toBe(null);
  });

  it("reads the standing line in whole numbers", () => {
    const plan = { state: "free", lim: PLAN_CAPS.free };
    const status = limitStatus({ plan, signedIn: true, host: withUsed({ chartVision: 1 }), now: NOW });
    expect(limitStandingLine(status)).toBe("1 of 2 chart reads used today.");
  });
});
