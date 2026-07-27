// The two caps that are NOT daily counters: QC photos an item (LB-1) and
// hauls an account (LB-2).
//
// Every other paid limit is a daily counter, and the server re-checks those on
// every call — so if the client's copy drifts, the customer sees a 429 instead
// of a nudge, and nothing is given away. These two never reach a server. A QC
// photo is compressed and stored on the device; a haul is just a project name
// on a card. If the client does not hold the line here, nothing does, and free
// silently receives a paid feature.
//
// That makes the client copy load-bearing, and a copy is exactly the thing
// that drifts. So this file reads BOTH files and compares them.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FREE_LIMITS, PRO_LIMITS, planLimit } from "../src/usage.js";
import { QC_PHOTOS_STORED } from "../../credenza-fashion.jsx";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

// The server table is a plain object literal in a CommonJS-ish function file
// that pulls in node crypto, so a test importing it would drag the whole
// entitlement machinery in. Reading the two numbers out of the source is
// enough: the point is that they MATCH, not what they are.
function serverLimit(plan, key) {
  const src = read("preview/netlify/functions/lib/entitlements.js");
  const block = src.slice(src.indexOf("const PLAN_LIMITS"));
  const planBlock = block.slice(block.indexOf(plan + ": {"));
  const m = planBlock.match(new RegExp(key + ":\\s*(\\d+)"));
  return m ? Number(m[1]) : null;
}

describe("plan limits agree with the server", () => {
  it("reads the free row out of entitlements.js", () => {
    // Guard the guard: if the table is ever renamed or reshaped, serverLimit
    // returns null and every comparison below would pass vacuously.
    expect(serverLimit("free", "qcPhotosPerItem")).toBe(4);
    expect(serverLimit("free", "haulsMax")).toBe(2);
  });

  it("matches the free caps the client falls back to", () => {
    expect(FREE_LIMITS.qcPhotosPerItem).toBe(serverLimit("free", "qcPhotosPerItem"));
    expect(FREE_LIMITS.haulsMax).toBe(serverLimit("free", "haulsMax"));
  });

  it("matches the Pro caps the nudge copy names", () => {
    expect(PRO_LIMITS.qcPhotosPerItem).toBe(serverLimit("pro", "qcPhotosPerItem"));
    expect(PRO_LIMITS.haulsMax).toBe(serverLimit("pro", "haulsMax"));
  });
});

describe("planLimit", () => {
  it("gives a signed-out user the FREE cap, not an unlimited one", () => {
    // The important case, and the opposite of overFreeLimit's rule. No
    // snapshot means no account, and no account is not a paid account.
    expect(planLimit(null, "qcPhotosPerItem")).toBe(4);
    expect(planLimit(null, "haulsMax")).toBe(2);
    expect(planLimit(undefined, "qcPhotosPerItem")).toBe(4);
  });

  it("gives a Pro snapshot the Pro cap", () => {
    const pro = { state: "pro", lim: { qcPhotosPerItem: 12, haulsMax: 100 } };
    expect(planLimit(pro, "qcPhotosPerItem")).toBe(12);
    expect(planLimit(pro, "haulsMax")).toBe(100);
  });

  it("gives a free snapshot the free cap", () => {
    const free = { state: "free", lim: { qcPhotosPerItem: 4, haulsMax: 2 } };
    expect(planLimit(free, "qcPhotosPerItem")).toBe(4);
    expect(planLimit(free, "haulsMax")).toBe(2);
  });

  it("falls back to free when a snapshot carries a broken number", () => {
    // A snapshot is signed, but it is still parsed JSON from storage. A zero,
    // a null or a string must not read as "no limit".
    for (const lim of [{}, { qcPhotosPerItem: 0 }, { qcPhotosPerItem: null }, { qcPhotosPerItem: "12" }]) {
      expect(planLimit({ state: "pro", lim }, "qcPhotosPerItem")).toBe(4);
    }
    expect(planLimit({ state: "pro" }, "haulsMax")).toBe(2);
  });
});

describe("the caps are enforced where the writes happen", () => {
  const src = read("credenza-fashion.jsx");

  it("checks the QC cap before compressing, and stores what it already had", () => {
    // Two separate numbers on purpose. The GUARD uses the plan cap; the STORE
    // uses QC_PHOTOS_STORED. Slicing the stored array to the plan cap would
    // delete a downgraded customer's existing photos — the one thing both
    // LB-1 and LB-2 forbid.
    expect(src).toContain("if (current.length >= qcPhotoCap)");
    expect(src).toContain("qcPhotos: [...(x.qcPhotos || []), dataUrl].slice(0, QC_PHOTOS_STORED)");
    expect(QC_PHOTOS_STORED).toBe(PRO_LIMITS.qcPhotosPerItem);
    // The normalizer must keep as many as the attach path can write, or a
    // photo saves and then vanishes on the next reload.
    expect(src).toContain(".slice(0, QC_PHOTOS_STORED)\n      : [],");
  });

  it("caps haul CREATION only, never an existing haul", () => {
    // A name already on the shelf always passes: that is a MOVE between hauls,
    // not a new one, and a user over the cap must still be able to sort.
    expect(src).toContain("if (!clean || haulNames.includes(clean)) return false;");
    expect(src).toContain("if (haulNames.length < haulsCap) return false;");
    // The refusal drops the project key and keeps the rest of the edit.
    expect(src).toContain("const { project, ...rest } = patch;");
  });

  it("routes both nudges to the Profile sheet, where the upgrade lives", () => {
    const nudges = src.match(/actionLabel: "See Pro", onAction: \(\) => setProfileOpen\(true\)/g);
    expect(nudges).toHaveLength(2);
  });
});
