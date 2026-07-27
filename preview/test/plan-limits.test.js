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

  it("routes every nudge to the Profile sheet, where the upgrade lives", () => {
    // Count the LABEL, not one exact formatting of the call. An earlier version
    // of this test matched a single-line spelling, so a nudge written across
    // two lines passed it without ever being checked. Three today: the QC cap,
    // the haul cap, and the CSV export.
    const labels = src.match(/actionLabel: "See Pro"/g);
    expect(labels).toHaveLength(3);
    // Each one is followed by the Profile handler, whatever the line breaks.
    const routed = src.match(
      /actionLabel: "See Pro",\s*onAction: \(\) => setProfileOpen\(true\),?/g
    );
    expect(routed).toHaveLength(labels.length);
  });

  it("gates the CSV export on Pro itself, not on a daily allowance", () => {
    // CSV is absent from PLAN_LIMITS on both sides, so there is no cap to read.
    // planLimit would fall back to a FREE number and read as permission.
    expect(src).toContain("const exportShelfCsv = () => {\n    if (!isProPlan) {");
    for (const table of [FREE_LIMITS, PRO_LIMITS]) {
      expect(Object.keys(table).some((k) => /csv/i.test(k))).toBe(false);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LB-19. The pricing page is a third copy of the same table.
//
// /pricing/ names nine numbers in prose and in a comparison table. None of
// them was checked against anything until now. A number that drifts here is
// worse than one that drifts in code: the customer reads a promise, pays, and
// then meets a different limit. That is a refund and a complaint, not a bug
// report.
//
// So read the numbers back out of the HTML and compare them to the server
// table. The HTML is the promise; entitlements.js is what the product does.
describe("the pricing page promises what the server gives", () => {
  const html = read("preview/public/pricing/index.html");

  // Pull the Free and Pro cells out of one row of the comparison table. The
  // row label is the <th scope="row">; the two <td>s that follow are Free
  // then Pro, in that order.
  function tableRow(label) {
    const at = html.indexOf(`<th scope="row">${label}</th>`);
    if (at === -1) return null;
    const cells = [
      ...html.slice(at, at + 400).matchAll(/<td>([^<]*)<\/td>/g),
    ].map((m) => m[1].trim());
    return cells.length >= 2 ? { free: cells[0], pro: cells[1] } : null;
  }

  // "1,000 a day" and "1,000" both mean 1000. Read the first number out.
  const num = (cell) => Number(String(cell).replace(/[^0-9]/g, ""));

  const ROWS = [
    ["Hauls at once", "haulsMax", false],
    ["QC photos an item", "qcPhotosPerItem", false],
    ["AI size-chart reads", "chartVisionPerDay", true],
    ["Link resolves", "resolvePerDay", true],
    ["Ask", "askPerDay", true],
  ];

  it("has every row this test expects to find", () => {
    // Guard the guard. A renamed row would make every check below vacuous,
    // because tableRow returns null and the loop would compare nothing.
    for (const [label] of ROWS) {
      expect(tableRow(label), `no "${label}" row in the pricing table`).toBeTruthy();
    }
  });

  for (const [label, key, perDay] of ROWS) {
    it(`the "${label}" row matches PLAN_LIMITS`, () => {
      const row = tableRow(label);
      expect(num(row.free), `${label} free cell`).toBe(serverLimit("free", key));
      expect(num(row.pro), `${label} pro cell`).toBe(serverLimit("pro", key));
      // A daily cap must SAY it is daily, or the reader takes it for a total.
      if (perDay) {
        expect(row.free, `${label} free cell must say "a day"`).toMatch(/a day/);
        expect(row.pro, `${label} pro cell must say "a day"`).toMatch(/a day/);
      }
    });
  }

  it("the Pro feature list repeats the same numbers", () => {
    // The bullet list above the table is read far more often than the table.
    // It must not say something the table contradicts.
    const bullets = [...html.matchAll(/<li>([^<]*)<\/li>/g)].map((m) => m[1]);
    const has = (re) => bullets.some((b) => re.test(b));
    expect(has(new RegExp(`^${serverLimit("pro", "haulsMax")} hauls at once$`))).toBe(true);
    expect(has(new RegExp(`^${serverLimit("pro", "qcPhotosPerItem")} QC photos an item$`))).toBe(true);
    expect(has(new RegExp(`^${serverLimit("pro", "chartVisionPerDay")} AI size-chart reads a day$`))).toBe(true);
    expect(has(new RegExp(`^${serverLimit("pro", "askPerDay")} Ask questions a day$`))).toBe(true);
    // 1000 is written with a thousands separator in the copy.
    expect(has(/^1,000 link resolves a day$/)).toBe(true);
    expect(serverLimit("pro", "resolvePerDay")).toBe(1000);
  });

  it("the Free feature list names the free haul cap", () => {
    const bullets = [...html.matchAll(/<li>([^<]*)<\/li>/g)].map((m) => m[1]);
    expect(
      bullets.some((b) => b === `${serverLimit("free", "haulsMax")} hauls at once`)
    ).toBe(true);
  });

  it("lists no cap that is not a real limit", () => {
    // D-3: list only built features. A row here that has no key in
    // PLAN_LIMITS is a promise with no enforcement behind it.
    const src = read("preview/netlify/functions/lib/entitlements.js");
    const known = [...src.slice(src.indexOf("const PLAN_LIMITS")).matchAll(/(\w+):\s*\d+/g)]
      .map((m) => m[1]);
    for (const [, key] of ROWS) {
      expect(known, `${key} is not in PLAN_LIMITS`).toContain(key);
    }
  });
});
