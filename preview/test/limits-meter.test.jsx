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
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ANON_FREE_CARDS, limitStandingLine, limitStatus, proHasEnded } from "../src/limits.js";
import { PLAN_CAPS, USAGE_KEY, bumpUsage, onUsageChange, usageToday } from "../src/usage.js";
import LimitsSheet from "../../sheets/LimitsSheet.jsx";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const APP = readFileSync(join(ROOT, "credenza-fashion.jsx"), "utf8");
const CSS = readFileSync(join(ROOT, "credenza-fashion.css"), "utf8");

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
  it("opens for the refused fourth card and keeps the held-link retry", () => {
    const wallStart = APP.indexOf("const askForSignIn = useCallback");
    const wallEnd = APP.indexOf("// The chart hunt", wallStart);
    expect(wallStart).toBeGreaterThan(-1);
    expect(wallEnd).toBeGreaterThan(wallStart);
    const wall = APP.slice(wallStart, wallEnd);
    expect(wall).toContain("setLimitsOpen(true)");
    expect(wall).not.toContain('navigateSettings("account")');

    const retryStart = APP.indexOf("const signInRetryRef = useRef");
    const retryEnd = APP.indexOf("const recordOpen", retryStart);
    expect(retryStart).toBeGreaterThan(-1);
    expect(retryEnd).toBeGreaterThan(retryStart);
    const retry = APP.slice(retryStart, retryEnd);
    expect(retry).toContain("const held = heldLinkRef.current");
    expect(retry).toContain("dispatchStash(held)");
    expect(retry).toContain("beginIndexingJob(result)");
  });

  it("tells a visitor where they stand, and what an account gives", () => {
    const status = limitStatus({ signedIn: false, host: withUsed({ resolve: 3 }), now: NOW });
    render(<LimitsSheet status={status} signedIn={false} />);
    expect(screen.getByRole("heading", { name: "That is your third free card." })).toBeTruthy();
    expect(screen.getByText("3 of 3 free cards used · resets tomorrow")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign in — free" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Go Pro — $5.99 a month" })).toBeTruthy();
    expect(
      screen.getByText(
        "A free account raises every daily ceiling and keeps your shelf across your devices. No card, no checkout."
      )
    ).toBeTruthy();
    expect(screen.queryByText(/\$2\.49 a week/)).toBe(null);
    expect(
      screen.getByText("$44.99 a year works out to $3.75 a month · cancel any time")
    ).toBeTruthy();
    // The caps come from PLAN_CAPS, so the sheet cannot quote a number the
    // app does not enforce.
    const table = screen.getByRole("table");
    expect(table.textContent).toContain(
      "Cards from a link" + PLAN_CAPS.free.resolvePerDay + PLAN_CAPS.pro.resolvePerDay
    );
    expect(table.textContent).toContain(
      "Size chart reads" +
        PLAN_CAPS.free.chartVisionPerDay +
        PLAN_CAPS.pro.chartVisionPerDay
    );
  });

  it("promises a signed-in person that a wall never deletes a card", () => {
    const plan = { state: "free", lim: PLAN_CAPS.free, graceUntil: NOW - 1000 };
    const status = limitStatus({ plan, signedIn: true, host: withUsed({}), now: NOW });
    render(<LimitsSheet status={status} signedIn />);
    expect(screen.getByText("Your Pro ended.")).toBeTruthy();
    expect(screen.getByText(/stays on your shelf and stays readable/)).toBeTruthy();
    // No sign-in block: this person is already signed in.
    expect(screen.queryByText(/Sign in — free/)).toBe(null);
    expect(screen.getByRole("button", { name: "Resume Pro — $5.99 a month" })).toBeTruthy();
    expect(screen.getByText(/resets tomorrow/)).toBeTruthy();
  });

  it("shows a signed-in free account its daily meter without a sign-in button", () => {
    const plan = { state: "free", lim: PLAN_CAPS.free };
    const status = limitStatus({
      plan,
      signedIn: true,
      host: withUsed({ chartVision: 1 }),
      now: NOW,
    });
    render(<LimitsSheet status={status} signedIn />);
    expect(screen.getByText("1 of 2 chart reads used · resets tomorrow")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sign in — free" })).toBe(null);
    expect(screen.getByRole("button", { name: "Go Pro — $5.99 a month" })).toBeTruthy();
  });

  it("keeps the sign-in, upgrade, and dismiss actions connected", () => {
    const calls = [];
    const status = limitStatus({ signedIn: false, host: withUsed({ resolve: 3 }), now: NOW });
    render(
      <LimitsSheet
        status={status}
        signedIn={false}
        onSignIn={() => calls.push("sign-in")}
        onUpgrade={() => calls.push("upgrade")}
        onClose={() => calls.push("close")}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Sign in — free" }));
    fireEvent.click(screen.getByRole("button", { name: "Go Pro — $5.99 a month" }));
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(calls).toEqual(["sign-in", "upgrade", "close"]);
  });

  it("reads the standing line in whole numbers", () => {
    const plan = { state: "free", lim: PLAN_CAPS.free };
    const status = limitStatus({ plan, signedIn: true, host: withUsed({ chartVision: 1 }), now: NOW });
    expect(limitStandingLine(status)).toBe("1 of 2 chart reads used today.");
  });
});

// ── The phone tap area ─────────────────────────────────────────────────────
//
// This fix lives in the stylesheet, not in a component this file can render,
// so it is pinned at the source. A source pin is the right test here: the fix
// is a one-line choice that a later edit can silently undo.

describe("the counter pill is big enough for a thumb", () => {
  it("gives the phone pill a 44px tap area without changing its size", () => {
    // The pill joins the shared invisible-ring rule, so it also gets a ring
    // on a desktop. A phone-only ring would have left the desktop pill bare.
    const ring = CSS.slice(CSS.indexOf(".cz-carousel-orbit-close::after"));
    expect(ring.slice(0, 200)).toContain(".cz-limit-pill::after");
    // On a phone the pill is drawn shorter so the masthead keeps one row.
    // The ring above and below must still add up to a 44px tap area, so both
    // numbers are read from the file instead of being written down here.
    const phone = CSS.slice(CSS.indexOf("@media (max-width: 767px) {\n  .cz-limit-pill {"));
    const drawn = Number(phone.match(/\.cz-limit-pill\s*{\s*height:\s*(\d+)px;/)[1]);
    const ringY = Number(phone.match(/\.cz-limit-pill::after\s*{\s*inset:\s*-(\d+)px/)[1]);
    expect(drawn).toBeLessThan(44);
    expect(drawn + ringY * 2).toBe(44);
  });
});

// Kyle 2026-07-31: no bubble around the cards-left count — green italic text only.
describe("the cards-left counter has no bubble", () => {
  it("drops the border and fill, and uses green italic text", () => {
    const block = CSS.slice(CSS.indexOf(".cz-limit-pill {"), CSS.indexOf(".cz-limit-pill:hover"));
    expect(block).toMatch(/border:\s*0/);
    expect(block).toMatch(/background:\s*transparent/);
    expect(block).toMatch(/font-style:\s*italic/);
    expect(block).toMatch(/color:\s*var\(--cz-money\)/);
  });
});

// Kyle 2026-07-31 picture 3: status bar must not cover Settings or the phone pane header.
describe("phone headings clear the status bar", () => {
  it("pads the settings masthead with safe-area-inset-top", () => {
    const block = CSS.slice(
      CSS.indexOf(".cz-settings-page-masthead {"),
      CSS.indexOf(".cz-settings-back {"),
    );
    expect(block).toMatch(/safe-area-inset-top/);
  });

  it("does not re-add safe-area on the phone stickybar (sheet already clears it)", () => {
    // PR #64 reserves safe-area + 28px ABOVE the sheet. The stickybar lives
    // inside that surface. Re-adding env(safe-area-inset-top) on the bar
    // double-counts and leaves a blank band under the grip (Kyle 2026-08-02).
    // Expanded .is-up is a fixed ~50px row only — no safe-area in the rules.
    // Strip comments so the historical note that names safe-area does not trip
    // the negative assert.
    const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");
    const mobileAt = CSS.indexOf("/* Mobile item sheet, three panes");
    expect(mobileAt).toBeGreaterThan(-1);
    const region = CSS.slice(mobileAt, mobileAt + 2500);
    const start = region.indexOf("  .cz-detail-pane-header {");
    expect(start).toBeGreaterThan(-1);
    const isUpAt = region.indexOf("  .cz-detail-pane-header.is-up {", start);
    expect(isUpAt).toBeGreaterThan(start);
    const closedBlock = stripComments(region.slice(start, isUpAt));
    const isUpEnd = region.indexOf("\n  }", isUpAt);
    const isUpBlock = stripComments(
      region.slice(isUpAt, isUpEnd > -1 ? isUpEnd + 4 : isUpAt + 220),
    );
    expect(closedBlock).toMatch(/height:\s*0/);
    expect(isUpBlock).toMatch(/height:\s*50px/);
    expect(isUpBlock).not.toMatch(/safe-area-inset-top/);
    expect(closedBlock).not.toMatch(/safe-area-inset-top/);
  });
});

// ── The bottom sheet (Kyle 2026-07-31) ─────────────────────────────────────
//
// Kyle drew the limits wall as a sheet against the bottom edge, with a grab
// bar. This also lives in the stylesheet, so it is pinned at the source.
// The sign-in card left this path 2026-08-01 (see the next describe block);
// this one now covers only the states that still show it — today's free
// limit and a lapsed Pro.

describe("the limits wall is a bottom sheet on a phone", () => {
  const phoneStart = CSS.indexOf(
    "@media (max-width: 767px) and (pointer: coarse) {\n  .cz-limits-sheet {",
  );
  const phone = CSS.slice(phoneStart, CSS.indexOf("\n}\n", phoneStart));

  it("keeps the grab bar on the phone gate only", () => {
    // The gate must carry BOTH conditions. A width-only gate would put a grab
    // bar on a narrow desktop window, where the card still floats.
    expect(phoneStart).toBeGreaterThan(-1);
    expect(phone).toContain(".cz-limits-sheet::before");
    expect(phone).toMatch(/\.cz-limits-sheet::before\s*{\s*content:\s*""/);
  });

  it("squares the bottom corners on a phone and rounds all four elsewhere", () => {
    expect(phone).toMatch(/\.cz-limits-sheet\s*{\s*border-radius:\s*18px 18px 0 0;/);
    // The floating card keeps its own radius: the shared modal surface has
    // none, so without this line the desktop card reads as a square box.
    const base = CSS.slice(CSS.indexOf("/* ── The one limits sheet ──"), phoneStart);
    expect(base).toMatch(/\.cz-limits-sheet\s*{\s*\n\s*\/\*[\s\S]*?\*\/\s*\n\s*border-radius:\s*18px;/);
  });

  it("puts the phone header padding after the shared header padding", () => {
    // Both rules carry !important at the same weight, so order decides the
    // winner. A later edit that moves this block up would silently undo it.
    const shared = CSS.indexOf(".cz-limits-sheet .cz-modal-header {\n  padding: var(--space-6)");
    expect(shared).toBeGreaterThan(-1);
    expect(phoneStart).toBeGreaterThan(shared);
    expect(phone).toContain("padding-top: var(--space-4) !important");
  });
});

// ── The sign-in card: a centered window everywhere (F 2026-08-01) ──────────
//
// Kyle: "while you are at the sign in, can you center it and make it its
// own modal." Signing in is a decision, not a quick tool, so unlike the
// limits wall above it never bottom-slides on a phone — cz-signin-sheet
// overrides the shared bottom-sheet gate back to centered and adds the
// glass surface.

describe("the sign-in card is a centered, frosted window on every screen", () => {
  const signinBase = CSS.slice(
    CSS.indexOf('.cz-app[data-fashion="true"] .cz-modal-surface.cz-signin-sheet {'),
  );
  const phoneStart = signinBase.indexOf(
    "@media (max-width: 767px) and (pointer: coarse) {\n  /* The phone bottom-sheet gate",
  );
  const phone = signinBase.slice(phoneStart, signinBase.indexOf("\n}\n", phoneStart));

  it("gives the surface a translucent frost fill, no blur", () => {
    expect(signinBase).toMatch(/\.cz-modal-surface\.cz-signin-sheet\s*{[\s\S]*?background:\s*var\(--cz-frost-fill\);/);
    // No backdrop-filter: the 2026-07-27 compositing audit measured 0%
    // visible change from blurring a static modal surface. A regression
    // here would silently pay that cost back.
    const surfaceBlock = signinBase.slice(0, signinBase.indexOf("\n}\n"));
    // The colon form only matches a real declaration, not this file's own
    // explanatory comment about why there is none.
    expect(surfaceBlock).not.toContain("backdrop-filter:");
  });

  it("re-centers on the phone gate that bottom-anchors every other modal", () => {
    expect(phoneStart).toBeGreaterThan(-1);
    expect(phone).toContain(".cz-modal:has(.cz-signin-sheet)");
    const hasBlock = phone.slice(phone.indexOf(".cz-modal:has(.cz-signin-sheet)"));
    // margin: auto cancels the shared gate's bottom anchor. width must be
    // cancelled too, or the phone gate's width:100% stays edge-to-edge under
    // the inline maxWidth={460} React sets — a real bug this test caught
    // once already (probe-signin-centered.mjs, phone check).
    expect(hasBlock).toMatch(/width:\s*min\(720px,\s*calc\(100% - 32px\)\);/);
    expect(hasBlock).toMatch(/margin:\s*auto;/);
  });

  it("drops the grab bar and the squared corners the limits wall uses", () => {
    expect(phone).toMatch(/\.cz-signin-sheet\s*{\s*border-radius:\s*18px;/);
    expect(phone).toMatch(/\.cz-signin-sheet::before\s*{\s*content:\s*none;/);
  });
});
