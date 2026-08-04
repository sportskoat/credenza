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
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FREE_LIMITS, PRO_LIMITS, PLAN_CAPS, planLimit } from "../src/usage.js";
import { QC_PHOTOS_STORED } from "../../credenza-fashion.jsx";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

// The server table is a plain object literal in a CommonJS-ish function file
// that pulls in node crypto, so a test importing it would drag the whole
// entitlement machinery in. Reading the two numbers out of the source is
// enough: the point is that they MATCH, not what they are.
// The slice STOPS at the closing brace of the plan's own row. An earlier
// version sliced to the end of the file, so a key missing from the free row
// was found in the pro row below it and returned the wrong number. Renaming
// resolvePerDay in the free row made serverLimit("free", …) answer 1000 —
// the Pro cap — instead of null, and the guard that exists to catch exactly
// that reported a healthy number.
function serverLimit(plan, key) {
  const src = read("preview/netlify/functions/lib/entitlements.js");
  const block = src.slice(src.indexOf("const PLAN_LIMITS"));
  const start = block.indexOf(plan + ": {");
  if (start < 0) return null;
  const planBlock = block.slice(start, block.indexOf("}", start));
  const m = planBlock.match(new RegExp("\\b" + key + ":\\s*(\\d+)"));
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

  // PLAN_CAPS is the table the Account and plan screen prints. Every key is
  // bound here — a displayed cap that drifts from the server is a printed
  // promise the server breaks (LB-35 covers the public pages; this covers
  // the in-app table).
  it("binds every PLAN_CAPS key to the server table, both plans", () => {
    for (const key of ["askTotal", "chartVisionTotal", "resolveTotal", "qcPhotosPerItem", "haulsMax"]) {
      expect(PLAN_CAPS.free[key], `free ${key}`).toBe(serverLimit("free", key));
    }
    for (const key of ["askPerMonth", "chartVisionPerMonth", "resolvePerMonth", "qcPhotosPerItem", "haulsMax"]) {
      expect(PLAN_CAPS.pro[key], `pro ${key}`).toBe(serverLimit("pro", key));
    }
  });

  it("binds the shared-links caps to the share function", () => {
    const fn = read("preview/netlify/functions/share.js");
    const cap = (name) => {
      const m = fn.match(new RegExp("const " + name + "\\s*=\\s*(\\d+)"));
      return m ? Number(m[1]) : null;
    };
    expect(PLAN_CAPS.free.sharedLinksMax).toBe(cap("MAX_SHARES_FREE"));
    expect(PLAN_CAPS.pro.sharedLinksMax).toBe(cap("MAX_SHARES_PRO"));
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
    // The refusal drops the project key and keeps the rest of the edit.
    expect(src).toContain("const { project, ...rest } = patch;");
  });

  // LB-58. The cap counted every haul name on the shelf. Archiving set a flag
  // that hid the haul from the directory and changed nothing about the count,
  // so the app's own refusal message — "Archive one to start another" — was
  // false, and /how/ promising "archive a finished haul and the shelf stays
  // clean" described a button with no consequence.
  //
  // This is the shape LB-1 and LB-2 established: a cap that is not wrong in
  // arithmetic but is wrong about which set it counts. It survived because
  // every existing assertion read the OLD line as a literal string.
  it("counts OPEN hauls, so archiving a finished one frees a slot", () => {
    // The archived set is derived where the cap is applied, not read from a
    // directory memo that only exists on the Hauls tab.
    expect(src).toContain(
      'const archivedNames = new Set(hauls.filter((h) => h.archived).map((h) => h.name));'
    );
    expect(src).toContain(
      "const activeHauls = haulNames.filter((n) => !archivedNames.has(n));"
    );
    expect(src).toContain("if (activeHauls.length < haulsCap) return false;");
    // The superseded line must be gone. Leaving both would cap on the larger
    // set first and the fix would never run.
    expect(src).not.toContain("if (haulNames.length < haulsCap) return false;");
  });

  it("offers the free user the free way out, not only the paid one", () => {
    // Before LB-58 the free branch named Pro and nothing else, because on free
    // there was no other way out. There is now, and a message that hides it
    // sells an upgrade for a problem a button solves.
    const free = src.match(/" open hauls on Free\.[\s\S]{0,120}?PRO_LIMITS\.haulsMax/);
    expect(free, "the free haul-cap message no longer reads as expected").toBeTruthy();
    expect(free[0]).toContain("Archive a finished one to start another");
    // Both branches say the same way out.
    expect(src).toContain('" open hauls is the limit. Archive a finished one to start another."');
  });

  it("routes every nudge to the Pro page, where the prices live", () => {
    // Count the LABEL, not one exact formatting of the call. An earlier version
    // of this test matched a single-line spelling, so a nudge written across
    // two lines passed it without ever being checked. Three today: the QC cap,
    // the haul cap, and the CSV export.
    const labels = src.match(/actionLabel: "See Pro"/g);
    expect(labels).toHaveLength(3);
    // Each one opens /upgrade, whatever the line breaks. The prices left the
    // Settings account section, so a nudge that opened Settings landed the
    // person on a page with nothing to buy.
    const routed = src.match(/actionLabel: "See Pro",\s*onAction: \(\) => openUpgrade\(\),?/g);
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

  // ─────────────────────────────────────────────────────────────────────────
  // LB-59. A daily counter must count what the server charges for.
  //
  // Every one of the four client bumpUsage() calls fired the instant the fetch
  // resolved, BEFORE the status was inspected. The server charges later than
  // that in all three functions: chart-vision.js records after Anthropic
  // answers, resolve.js records on the 200 path only, ask.js records after the
  // structured response validates. So the two counters disagreed, and they
  // disagreed in the direction that costs the customer:
  //
  //   a 502, a 504, a 413, a 422 "Not a resolvable buy link", and the 429 daily
  //   cap itself were free on the server and charged on the client.
  //
  // The client counter is not cosmetic. overFreeLimit() reads it and returns
  // early, so it is the counter that BLOCKS. A free user gets 2 chart reads a
  // day; before this fix, two timeouts in a row spent both, and the third
  // attempt was refused locally without a request ever being sent.
  //
  // These assertions pin the ORDER, which is the whole defect. Each looks for
  // the status check and the bump in one window, status check first.
  it("counts a metered call only after the server says it succeeded", () => {
    // Strip full-line comments, then collapse the blank lines they leave so
    // multi-line order pins stay stable when a block gains or loses comments.
    const clean = src
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/\n(?:[ \t]*\n)+/g, "\n");

    // postChartVision: guard clause, then bump. Fix 0 maps 401/403 to the
    // CHART_AUTH_REQUIRED sentinel (not null) so the UI can show "signed out"
    // instead of "no chart". FIX 2b maps 429 to CHART_CAP_REACHED the same way.
    // All early returns still stand between failure and the count — an auth
    // wall or a spent cap must never burn a customer's quota.
    // (a) success-only counting: bump only after res.ok.
    // (b) auth path: 401/403 returns CHART_AUTH_REQUIRED before bumpUsage.
    // (c) cap path: 429 returns CHART_CAP_REACHED before bumpUsage.
    // (d) FIX 2c: every other failed status is the server, not the photo, so it
    // returns CHART_UNAVAILABLE. It is still a return, so it still stands
    // between the failure and the count. A 502 or a 504 burns no quota.
    expect(clean).toContain(
      "    if (!res.ok) {\n" +
        "      if (res.status === 401 || res.status === 403) {\n" +
        "        noteSignInRequired();\n" +
        "        return CHART_AUTH_REQUIRED;\n" +
        "      }\n" +
        "      if (res.status === 429) return CHART_CAP_REACHED;\n" +
        "      return CHART_UNAVAILABLE;\n" +
        "    }\n" +
        "    bumpUsage(\"chartVision\", { audience: usageAudience(planForLimits) });"
    );
    // Explicit pin: the auth sentinel return appears with no bumpUsage between
    // it and the next statement that would count — order is return-then-bump.
    const chartAuthWindow = clean.match(
      /if \(res\.status === 401 \|\| res\.status === 403\) \{[\s\S]{0,120}?return CHART_AUTH_REQUIRED;[\s\S]{0,80}?return CHART_CAP_REACHED;[\s\S]{0,60}?return CHART_UNAVAILABLE;[\s\S]{0,80}?bumpUsage\("chartVision", \{ audience:/
    );
    expect(
      chartAuthWindow,
      "chart-vision 401/403/429 must return sentinels before bumpUsage — auth/cap must not burn quota"
    ).toBeTruthy();
    expect(clean).not.toMatch(
      /bumpUsage\("chartVision", \{ audience:[\s\S]{0,200}?return CHART_AUTH_REQUIRED/
    );
    expect(clean).not.toMatch(
      /bumpUsage\("chartVision", \{ audience:[\s\S]{0,200}?return CHART_CAP_REACHED/
    );
    // FIX 2c: same rule for the server-fault sentinel. A failed status must
    // never count first and answer afterwards.
    expect(clean).not.toMatch(
      /bumpUsage\("chartVision", \{ audience:[\s\S]{0,200}?return CHART_UNAVAILABLE;\n {4}\}/
    );
    // Client overFreeLimit skip also returns the cap sentinel (never null).
    expect(clean).toMatch(
      /if \(overFreeLimit\(planForLimits, "chartVision"\)\) return CHART_CAP_REACHED;/
    );

    // fetchDescImages: guard clause with sign-in and allowance refusals, then
    // bump. The early return still stands between the failure and the count.
    expect(clean).toMatch(/if \(!res\.ok\) \{[\s\S]{0,420}?return \[\];[\s\S]{0,120}?bumpUsage\("resolve", \{ audience:/);

    // The importer's resolve: the bump lives inside the res.ok branch.
    expect(clean).toContain("      if (res.ok) {\n        bumpUsage(\"resolve\", { audience:");

    // Ask counts last of all, after the payload passes shape validation —
    // ask.js records in the same place, after its own validation.
    const askWindow = clean.match(
      /if \(!valid\) throw new Error\("Cloud Ask returned an invalid response\."\);[\s\S]{0,300}?bumpUsage\("ask"/
    );
    expect(askWindow, "the ask bump no longer follows the validity check").toBeTruthy();
  });

  it("never counts before the status check, at any of the four call sites", () => {
    const clean = src.replace(/^\s*\/\/.*$/gm, "");
    const sites = [...clean.matchAll(/bumpUsage\("(\w+)"/g)];
    expect(sites.length, "a bumpUsage call site was added or removed").toBe(4);

    for (const site of sites) {
      // Look back from each bump to the fetch that precedes it. Any window
      // that reaches the fetch WITHOUT crossing a status check is the bug.
      const before = clean.slice(0, site.index);
      const fetchAt = before.lastIndexOf("monitoredFetch(");
      expect(fetchAt, `bumpUsage("${site[1]}") has no fetch above it`).toBeGreaterThan(-1);
      const between = before.slice(fetchAt);
      expect(
        /res\.ok/.test(between) || /if \(!valid\)/.test(between),
        `bumpUsage("${site[1]}") fires before any status check — a failed call would charge the customer`
      ).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LB-35. The public pages quote these numbers in prose, and nothing bound them.
//
// Found while shipping /guides/free-agent-haul-planner/. Changing "20 link
// resolves" to "500 link resolves" on a shipped page passed with the suite
// green. LB-32 bound every quoted PRICE to the PRICING export; the LIMITS are
// quoted just as often — on /pricing/, on /faq/, and across the guides — and
// had no equivalent.
//
// A wrong price is caught at the card form. A wrong limit is not caught
// anywhere: the reader believes it, hits a 429 or a nudge that contradicts the
// page, and the page is what they will quote back. Assistants read these pages
// too, so a stale number becomes the answer given to somebody who never
// visited.
//
// The rule reads the numbers out of the same server table the rest of this
// file compares against, then reads every public page and checks every number
// it sees next to a metered noun.
describe("the public pages quote the limits the server enforces", () => {
  const PUBLIC = join(ROOT, "preview/public");

  function pages(dir = PUBLIC, out = []) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) pages(full, out);
      else if (name.endsWith(".html")) out.push({ rel: relative(PUBLIC, full), html: readFileSync(full, "utf8") });
    }
    return out;
  }

  // Each metered thing, the words a page uses for it, and the allowed numbers.
  // Both plans are allowed for every noun: a page may legitimately say "4 QC
  // photos" in the free column and "12 QC photos" in the Pro column, often in
  // the same sentence. What must never appear is a number that is neither.
  const METERED = [
    { freeKey: "resolveTotal", proKey: "resolvePerMonth", nouns: ["link reads", "link resolves", "resolves"] },
    { freeKey: "chartVisionTotal", proKey: "chartVisionPerMonth", nouns: ["chart reads", "size chart reads"] },
    { freeKey: "askTotal", proKey: "askPerMonth", nouns: ["questions"] },
    { freeKey: "qcPhotosPerItem", proKey: "qcPhotosPerItem", nouns: ["QC photos"] },
    { freeKey: "haulsMax", proKey: "haulsMax", nouns: ["hauls"] },
  ];

  // Tags become a NEWLINE, not a space, and matching is per line. Replacing
  // them with a space joins text across element boundaries and invents claims
  // no reader can see: a pricing table row of <td>2</td><td>100</td> next to a
  // "QC photos an item" header read as "100 QC photos", and the rule reported
  // drift on a page that was correct.
  const strip = (html) => html.replace(/<[^>]*>/g, "\n").replace(/&[a-z]+;/g, " ");

  it("reads a real number for every metered thing, on both plans", () => {
    // Guard the guard. If a key is renamed in entitlements.js, serverLimit
    // returns null, every allowed-set below becomes {null}, and the rules
    // would fail loudly rather than pass silently — but only if this runs.
    for (const { freeKey, proKey } of METERED) {
      expect(serverLimit("free", freeKey), `free ${freeKey}`).toBeGreaterThan(0);
      expect(serverLimit("pro", proKey), `pro ${proKey}`).toBeGreaterThan(0);
    }
  });

  const docs = pages();

  it("found the pages to read", () => {
    expect(docs.length, "no public pages were read").toBeGreaterThanOrEqual(18);
  });

  for (const { freeKey, proKey, nouns } of METERED) {
    const allowed = new Set([serverLimit("free", freeKey), serverLimit("pro", proKey)]);
    for (const noun of nouns) {
      // Digits only. The pages also spell numbers out ("twenty resolves"), and
      // a word list would have to be kept in sync with the prose — a second
      // copy of the thing this rule exists to prevent. Digits are what a
      // reader quotes back and what an assistant extracts.
      // [\\d,]+ so "1,000 link resolves" reads as 1000. Plain \\d+ stops at the
      // comma and reports the page claims "0 link resolves".
      const re = new RegExp("(\\d[\\d,]*)\\s+(?:[a-z]+[- ]){0,2}" + noun.replace(/ /g, "\\s+"), "gi");
      for (const { rel, html } of docs) {
        const found = strip(html)
          .split("\n")
          .flatMap((line) => [...line.matchAll(re)])
          .map((m) => Number(m[1].replace(/,/g, "")));
        if (!found.length) continue;
        it(`${rel} quotes a real number of ${noun}`, () => {
          for (const n of found) {
            expect(
              allowed.has(n),
              `${rel} says ${n} ${noun}; the server allows ${[...allowed].join(" or ")} (${freeKey}/${proKey})`
            ).toBe(true);
          }
        });
      }
    }
  }

  it("at least one page states the free allowance, so this rule has work", () => {
    // Without this, deleting every number from every page would make the loop
    // above generate zero tests and the suite would stay green while the site
    // stopped answering the question people ask most.
    const free = serverLimit("free", "resolveTotal");
    const quoted = docs.filter((p) => new RegExp(free + "\\s+link\\s+reads", "i").test(strip(p.html)));
    expect(quoted.length, `no page states the ${free} link reads a free user gets`).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LB-48. The share caps are quoted on four pages, and one page was checked.
//
// The rule above reads PLAN_LIMITS. The share caps are NOT in PLAN_LIMITS —
// they are constants in share.js, because only the function can count rows.
// pricing.test.js knows that and binds them, but it binds ONE file: it opens
// preview/public/pricing/index.html by name.
//
// Four pages quote the caps: /pricing/, /faq/, /how/, and the share guide.
// Changing "3 links at a time" to "9 links at a time" on /faq/ passed all
// 1698 tests. This is LB-43's shape again — the rule was right about the
// number and wrong about how many places carry it.
//
// It is worse than a wrong daily counter. A daily counter that reads high
// costs the reader a 429. A share cap that reads high is read as headroom by
// somebody deciding whether to pay: they post three links, try a fourth, and
// the server refuses on the plan the page told them allows nine.
describe("every page quotes the share caps the share function enforces", () => {
  const PUBLIC = join(ROOT, "preview/public");

  function pages(dir = PUBLIC, out = []) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) pages(full, out);
      else if (name.endsWith(".html")) out.push({ rel: relative(PUBLIC, full), html: readFileSync(full, "utf8") });
    }
    return out;
  }

  const fn = read("preview/netlify/functions/share.js");
  const shareCap = (name) => {
    const m = fn.match(new RegExp("const " + name + "\\s*=\\s*(\\d+)"));
    return m ? Number(m[1]) : null;
  };

  it("reads both caps out of share.js", () => {
    // Guard the guard. A rename makes shareCap null, the allowed set becomes
    // {null}, and every page below would fail — but only if this runs first.
    expect(shareCap("MAX_SHARES_FREE"), "MAX_SHARES_FREE is gone").toBeGreaterThan(0);
    expect(shareCap("MAX_SHARES_PRO"), "MAX_SHARES_PRO is gone").toBeGreaterThan(0);
  });

  const allowed = new Set([shareCap("MAX_SHARES_FREE"), shareCap("MAX_SHARES_PRO")]);

  // Tags become a NEWLINE and matching is per line, for the reason LB-35 gives:
  // a space joins text across elements and invents claims no reader can see.
  const strip = (html) => html.replace(/<[^>]*>/g, "\n").replace(/&[a-z]+;/g, " ");

  // Two spellings, because the pages use two. "3 shared haul links" is the
  // table and the plan bullets. "Free keeps 3 links at a time" is the prose,
  // and the number there is not adjacent to the noun.
  const NEXT_TO_NOUN = /(\d[\d,]*)\s+(?:[a-z]+[- ]){0,3}links?\b/gi;
  const AFTER_KEEPS = /\bkeeps\s+(\d[\d,]*)/gi;

  // A line about resolves or photos also contains the word "link" or a count,
  // and those numbers belong to PLAN_LIMITS, not to the share caps.
  const OTHER_METER = /resolv|photo|link reads?|chart reads?/i;

  const quoting = [];
  for (const { rel, html } of pages()) {
    const nums = [];
    for (const line of strip(html).split("\n")) {
      if (!/link/i.test(line) || OTHER_METER.test(line)) continue;
      for (const m of [...line.matchAll(NEXT_TO_NOUN), ...line.matchAll(AFTER_KEEPS)]) {
        nums.push(Number(m[1].replace(/,/g, "")));
      }
    }
    if (nums.length) quoting.push({ rel, nums });
  }

  it("finds the pages that quote a share cap", () => {
    // Without this, deleting the sentence from every page would generate zero
    // tests below and the suite would stay green while the site stopped saying
    // how many links a plan allows. Six pages carry it today — /landing/ joined
    // at LB-64, when the About page gained the plan section it never had.
    expect(
      quoting.map((q) => q.rel).sort(),
      "fewer pages quote the share caps than expected — was a sentence deleted?"
    ).toEqual(
      [
        "faq/index.html",
        "guides/delete-a-shared-link/index.html",
        "guides/share-a-haul-list/index.html",
        "how/index.html",
        "landing/index.html",
        "pricing/index.html",
      ].sort()
    );
  });

  for (const { rel, nums } of quoting) {
    it(`${rel} quotes a real share cap`, () => {
      for (const n of nums) {
        expect(
          allowed.has(n),
          `${rel} says ${n} shared links; share.js allows ${[...allowed].join(" or ")}`
        ).toBe(true);
      }
    });
  }

  it("both caps are actually stated somewhere, not just the free one", () => {
    // A page could satisfy every rule above by naming only the free cap. The
    // Pro cap is the one somebody is deciding to pay for.
    const all = quoting.flatMap((q) => q.nums);
    for (const name of ["MAX_SHARES_FREE", "MAX_SHARES_PRO"]) {
      expect(all, `no page states ${name} (${shareCap(name)})`).toContain(shareCap(name));
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LB-64. Every rule above this line checks a NUMBER. None checked whether a
// page says the product costs money at all.
//
// /landing/ is the About page — the page the nav sends a stranger to first. It
// ended its pitch with "Free while it's in beta." That sentence was written
// before checkout existed. By the time it was found, netlify/functions/
// checkout.js was live and selling a real Stripe subscription at $4.99 a month,
// and /pricing/ carried a fourteen-row table describing it.
//
// So the first page a buyer read said the product was free and temporary, and
// the page that priced it said otherwise. Every number on both pages was
// correct. 2,102 tests were green.
//
// "Beta" is the specific word that ages worst. It is true on the day it is
// written and false the day the first customer pays, and nothing about the
// codebase changes to mark the difference. A grep is the only thing that can
// catch it, because no assertion about a value ever will.
describe("no public page calls a shipped product free or unreleased", () => {
  const PUBLIC = join(ROOT, "preview/public");

  function pages(dir = PUBLIC, out = []) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) pages(full, out);
      else if (name.endsWith(".html")) out.push({ rel: relative(PUBLIC, full), html: readFileSync(full, "utf8") });
    }
    return out;
  }

  // Visible text only, one line per element, for the LB-35 reason: joining
  // across tags with a space invents sentences no reader can see.
  const strip = (html) => {
    const m = (html.match(/<main[\s\S]*?<\/main>/i) || [""])[0];
    return m.replace(/<[^>]*>/g, "\n").replace(/&[a-z]+;/g, " ");
  };

  // Words that claim the product is not yet a product. "Early access" and
  // "waitlist" are here for the same reason as "beta": each is a promise about
  // a stage, and a stage is the one thing a static page cannot keep current.
  const UNRELEASED = /\b(in beta|beta test|early access|waitlist|coming soon|not yet launched|pre-?launch)\b/i;

  // A claim that the whole product costs nothing. "Free to start", "free plan"
  // and "free while you stay under" are all fine — they scope the claim. What
  // is not fine is an unscoped forever.
  const FREE_FOREVER = /\bfree (?:forever|for ?ever|for life|always)\b|\balways free\b|\b100% free\b|\bcompletely free\b/i;

  const docs = pages();

  it("read the public pages", () => {
    // Guard the guard. A reshaped public/ would empty `docs` and turn both
    // assertions below into silent passes.
    expect(docs.length, "no public pages were read").toBeGreaterThanOrEqual(18);
  });

  it("checkout is real, so the rule below has something to protect", () => {
    // Without this, deleting checkout.js would make the whole describe block
    // vacuous rather than failing. The rule only matters while the product
    // actually charges.
    const checkout = read("preview/netlify/functions/checkout.js");
    expect(checkout, "checkout.js no longer creates a Stripe session").toMatch(/checkout\.sessions\.create|\/v1\/checkout\/sessions/);
  });

  it("no page says the product is in beta or unreleased", () => {
    const bad = [];
    for (const { rel, html } of docs) {
      for (const line of strip(html).split("\n")) {
        const m = line.match(UNRELEASED);
        if (m) bad.push(`${rel}: "${m[0]}" — ${line.trim().slice(0, 80)}`);
      }
    }
    expect(bad, "these pages call a paid, shipped product unreleased").toEqual([]);
  });

  it("no page says the product is free forever", () => {
    const bad = [];
    for (const { rel, html } of docs) {
      for (const line of strip(html).split("\n")) {
        const m = line.match(FREE_FOREVER);
        if (m) bad.push(`${rel}: "${m[0]}" — ${line.trim().slice(0, 80)}`);
      }
    }
    expect(bad, "these pages promise a price the pricing page contradicts").toEqual([]);
  });
});
