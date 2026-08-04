// The price appears in two places that cannot import each other: the PRICING
// export in credenza-fashion.jsx, which the app's Profile sheet reads, and the
// static /pricing/ page, which is a plain HTML file with no build step.
//
// A public page quoting a price the checkout does not charge is the worst
// possible drift — it is a promise the customer can screenshot. So this file
// reads the HTML and compares it against the export.
//
// It also refuses the OLD prices anywhere in preview/public. $5 and $39 shipped
// on the live app before 2026-07-26, so a stale copy is a real risk, not a
// hypothetical one.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PRICING } from "../../credenza-fashion.jsx";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const PUBLIC = join(ROOT, "preview/public");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const page = read("preview/public/pricing/index.html");

// Every text file under preview/public, so a stale price cannot hide in a
// guide, in llms.txt, or in a page added after this test was written.
function textFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "fonts" || name === "img" || name === "assets") continue;
      out.push(...textFiles(full));
    } else if (/\.(html|txt|xml|webmanifest)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

describe("the /pricing/ page quotes the price the app charges", () => {
  it("names the weekly price and its trial", () => {
    expect(page).toContain(PRICING.weekly);
    expect(page).toContain(PRICING.weeklyTrial);
    expect(page).toContain(PRICING.weeklyTrialNote);
  });

  it("names the monthly price", () => {
    expect(page).toContain(PRICING.monthly);
  });

  it("names the yearly price", () => {
    expect(page).toContain(PRICING.yearly);
  });

  it("names the saving and the per-month figure", () => {
    expect(page).toContain(PRICING.yearlySaving);
    expect(page).toContain(PRICING.yearlyPerMonth);
  });

  it("puts the bare numbers in the Product schema, for the AI answers", () => {
    // Schema.org wants "4.99", not "$4.99". Derive it from the export so a
    // price change fails here instead of shipping a stale rich result.
    expect(page).toContain('"price": "' + PRICING.weekly.replace("$", "") + '"');
    expect(page).toContain('"price": "' + PRICING.monthly.replace("$", "") + '"');
    expect(page).toContain('"price": "' + PRICING.yearly.replace("$", "") + '"');
  });
});

describe("no stale price survives anywhere on the public site", () => {
  const files = textFiles(PUBLIC);

  it("finds the public files at all", () => {
    // Guard the guard: an empty list would make every check below vacuous.
    expect(files.length).toBeGreaterThan(10);
  });

  it("carries no pre-2026-07-26 price", () => {
    // The old live strings were "$5 / month" and "$39 / year". Match the
    // amount with a boundary so "$39.99" does not read as "$39".
    //
    // LB-49 kept this. It is a blocklist of three literals, and a blocklist is
    // the shape LB-42 argued against — but the probe showed it is not
    // redundant. It catches a bare stale amount with no billing cadence after
    // it, which the cadence rule below cannot see by design.
    const stale = /\$5(?![\d.])|\$39(?!\.99)(?![\d])|\$36(?![\d.])/;
    const bad = files
      .filter((f) => stale.test(readFileSync(f, "utf8")))
      .map((f) => f.slice(PUBLIC.length + 1));
    expect(bad).toEqual([]);
  });

  // LB-49. The fourteenth scope defect, and the narrowest scope yet: a rule
  // that read only the text next to one word.
  //
  // LB-32 binds every quoted price to the PRICING export, and LB-43 fixed it to
  // read every price in the sentence rather than the first. Both still only
  // look inside a 90-character window that follows the word "Pro".
  //
  // So a price that never says "Pro" is invisible. Adding "The paid plan is
  // $7.99 a month or $89.99 a year." to a guide passed all 1705 tests. On
  // /faq/ the same edit failed — but only because the FAQ parity rule noticed
  // an unmatched paragraph, which is an accident, not coverage.
  //
  // The blocklist above is not the answer either. It bans three literals it was
  // told about. It has nothing to say about $7.99, and it would fail a mock
  // shelf item that happened to cost $5.
  //
  // The anchor that works is the CADENCE, not the word "Pro". A price with a
  // billing period after it is a plan price, whatever sentence it sits in. A
  // price with no cadence is an item on the mock shelf — $23.52, $548.08 — and
  // stays out of scope without being listed.
  it("quotes no billing price the app does not charge", () => {
    const perMonth = (PRICING.yearlyPerMonth.match(/\$[\d.]+/) || [])[0];

    // Guard the guard. If PRICING is reshaped, these go undefined, the allowed
    // set fills with junk, and every page would fail — but only if this runs.
    for (const [name, v] of [
      ["weekly", PRICING.weekly],
      ["monthly", PRICING.monthly],
      ["yearly", PRICING.yearly],
      ["yearlyPerMonth", perMonth],
    ]) {
      expect(v, `PRICING.${name} is not a dollar amount`).toMatch(/^\$\d+(\.\d\d)?$/);
    }
    const real = new Set([PRICING.weekly, PRICING.monthly, PRICING.yearly, perMonth]);

    // (?![\d.]) so "$4.99" does not also yield "$4".
    // The cadence list is what the site actually writes, plus the spellings a
    // hurried edit reaches for: "a month", "per year", "/ month", "monthly".
    const PRICE = /\$\d+(?:\.\d\d)?(?![\d.])\s*(?:a|an|per|each|\/)?\s*(?:week|month|year|wk|mo|yr|weekly|monthly|yearly|annually)\b/gi;

    const found = [];
    for (const f of files) {
      // Tags become a space here, not a newline: "$4.99</strong> a month" is
      // one phrase to a reader, and splitting on the tag would hide it.
      const t = readFileSync(f, "utf8").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
      for (const m of t.matchAll(PRICE)) {
        found.push({ rel: f.slice(PUBLIC.length + 1), phrase: m[0].trim() });
      }
    }

    // Without this, deleting every price from the site would make the loop
    // below check nothing and stay green.
    expect(found.length, "no file states a price with a billing period").toBeGreaterThanOrEqual(10);

    const wrong = found.filter((h) => !real.has((h.phrase.match(/\$[\d.]+/) || [])[0]));
    expect(
      wrong.map((h) => `${h.rel}: ${h.phrase}`),
      `the app charges ${[...real].join(", ")}`
    ).toEqual([]);
  });

  it("names all three plan prices with a cadence, not just the monthly one", () => {
    // A site could satisfy the rule above by never stating the yearly price.
    // Somebody comparing plans needs all three, and the yearly one is the
    // upsell. The weekly one carries the trial — leaving it off the page
    // would sell a trial the reader cannot find.
    const all = files
      .map((f) => readFileSync(f, "utf8").replace(/<[^>]*>/g, " "))
      .join(" ")
      .replace(/\s+/g, " ");
    for (const [name, v, cadence] of [
      ["weekly", PRICING.weekly, "(?:week)"],
      ["monthly", PRICING.monthly, "(?:month)"],
      ["yearly", PRICING.yearly, "(?:year)"],
    ]) {
      expect(
        new RegExp(v.replace(/[$.]/g, "\\$&") + "\\s*(?:a|an|per|/)?\\s*" + cadence, "i").test(all),
        `no public file states the ${name} price with a billing period`
      ).toBe(true);
    }
  });
});

describe("the upgrade CTA goes through the app, never straight to Stripe", () => {
  it("targets the address that opens the Pro page", () => {
    // Kyle 2026-08-02: "in the pricing page, start 3 days free should take you
    // to this page", pointing at the in-app Pro page. The old target was
    // "/?profile=1", which opened Settings and made the reader hunt for the
    // plan. /upgrade opens Pro itself. That page holds the real checkout
    // button, which needs the signed-in session a static page does not have.
    expect(page).toContain('href="/upgrade"');
    expect(page).not.toContain('href="/?profile=1"');
  });

  it("links no Stripe URL", () => {
    // A checkout link on a static page would start a session with no account
    // attached, and the webhook would have nothing to grant Pro to.
    expect(page).not.toMatch(/stripe\.com|buy\.stripe|checkout\.stripe/i);
  });

  it("keeps the address the app actually reads", () => {
    // The app opens Pro on arrival at /upgrade, and netlify.toml rewrites the
    // path to index.html so the visit reaches the app at all. Both halves have
    // to hold or the CTA lands on a 404.
    const app = read("credenza-fashion.jsx");
    expect(app).toMatch(/\^\\\/upgrade/);
    expect(app).toContain("setUpgradeView({ period:");
    expect(read("preview/netlify.toml")).toContain('from = "/upgrade"');
  });
});

describe("the page is reachable", () => {
  it("is in the sitemap", () => {
    expect(read("preview/public/sitemap.xml")).toContain(
      "<loc>https://credenzafashion.com/pricing/</loc>"
    );
  });

  it("is in the nav of every public page", () => {
    // A page nothing links to is a page nobody finds. The nav is hand-written
    // per file, so this is exactly the thing that gets missed on the next page.
    //
    // A real page always opens with a doctype. The search-console verification
    // file is a bare one-line token with no markup, so that test keeps it out
    // without naming it.
    const pages = textFiles(PUBLIC).filter((f) =>
      /^\s*<!doctype html/i.test(readFileSync(f, "utf8"))
    );
    expect(pages.length).toBeGreaterThan(10);
    const missing = pages
      .filter((f) => !readFileSync(f, "utf8").includes('href="/pricing/"'))
      .map((f) => f.slice(PUBLIC.length + 1));
    expect(missing).toEqual([]);
  });

  it("is listed for the assistants", () => {
    expect(read("preview/public/llms.txt")).toContain("https://credenzafashion.com/pricing/");
  });
});

describe("the page only sells what is built", () => {
  // LB-45. The eleventh scope defect, and the first where the narrow scope was
  // not the whole problem — the rule was also wrong about the facts.
  //
  // What it used to say: "docs/free-to-pro-checklist.md rows 10, 11, 13 and 15
  // are MISSING", and it banned "sync across" and "shared shelf" on that basis.
  // Rows 10 and 11 were both marked BUILT on 2026-07-26 and their two
  // preconditions are now met — Kyle ran both migrations, and preview/.env sets
  // VITE_ENABLE_SYNC=true. So the rule forbade the pricing page from naming the
  // two features that most justify $4.99 a month, and the page shipped an
  // eleven-row table with neither of them in it.
  //
  // A stale comment is not a small defect here. Nobody deletes a rule that
  // states a reason, so the wrong reason outlives the fact it was based on.
  // The fix is to derive the ban list from the checklist file instead of
  // restating it, so a row flipping to BUILT cannot leave this rule behind.
  //
  // The scope half is the LB-22 shape, proved 2026-07-27: adding "Pro adds
  // price watch and restock alerts on every card" to /faq/ left all 1666 tests
  // green. The rule read `page` and nothing else. A promise of an unbuilt
  // feature is a broken promise wherever a person reads it, and /faq/ is read
  // before /pricing/ at least as often.
  const CHECKLIST = read("docs/free-to-pro-checklist.md");

  // Phrases that would only ever appear because somebody sold the feature.
  // Keyed by checklist row so the state below is read, never assumed.
  const FEATURE_PHRASES = {
    13: ["price watch", "restock alert", "back in stock"],
    15: ["seller memory", "every seller you"],
    11: ["custom url", "custom link address"],
  };

  const row = (n) => {
    const line = CHECKLIST.split("\n").find((l) => l.startsWith("| " + n + " |"));
    expect(line, "checklist row " + n + " is gone — has the file changed shape?").toBeTruthy();
    return line;
  };

  it("still finds the rows it reasons about", () => {
    // Guard the guard. A renamed row would make every ban below vacuous, and a
    // vacuous D-3 rule is worse than none: it reads as enforced.
    //
    // Each assertion names the exact fact the ban rests on, not a summary of
    // it. Row 11 is BUILT — that is why the page may now sell shared links —
    // but ONE part of it is not, and that part is what "custom url" is banned
    // for. Checking the row's state would have hidden that.
    expect(row(13), "row 13 (restock and price watch)").toContain("**MISSING**");
    expect(row(15), "row 15 (seller memory)").toContain("**MISSING**");
    expect(row(11), "row 11 no longer says custom URL is unbuilt").toContain(
      "**Custom URL is not built**"
    );
  });

  it("sells the two features whose rows now read BUILT", () => {
    // The other half of D-3, which nothing enforced: a rule that only bans
    // over-promising lets the page under-promise forever. Rows 10 and 11 were
    // BUILT on 2026-07-26 and the page named neither for a full day.
    expect(row(10), "row 10 (devices) is no longer BUILT").toContain("**BUILT**");
    expect(row(11), "row 11 (shared shelf) is no longer BUILT").toContain("**BUILT**");
    expect(page, "/pricing/ does not mention shared links").toMatch(/shared haul links/i);
    expect(page, "/pricing/ does not mention more than one device").toMatch(/more than one device/i);
  });

  it("names no unbuilt feature, on any public page", () => {
    // Every public page, not just this one. See the LB-45 note above.
    const banned = Object.values(FEATURE_PHRASES).flat();
    const offenders = [];
    for (const f of textFiles(PUBLIC)) {
      const text = readFileSync(f, "utf8").toLowerCase();
      for (const phrase of banned) {
        if (text.includes(phrase)) offenders.push(f.slice(PUBLIC.length + 1) + " → " + phrase);
      }
    }
    expect(offenders, "these pages sell a feature that is not built").toEqual([]);
  });

  it("quotes the same caps the server enforces", () => {
    const ent = read("preview/netlify/functions/lib/entitlements.js");
    const cap = (plan, key) => {
      const block = ent.slice(ent.indexOf("const PLAN_LIMITS"));
      const planBlock = block.slice(block.indexOf(plan + ": {"));
      const m = planBlock.match(new RegExp(key + ":\\s*(\\d+)"));
      return m ? Number(m[1]) : null;
    };
    expect(cap("free", "haulsMax")).toBe(2);
    expect(cap("pro", "haulsMax")).toBe(100);
    // The table row reads "<td>2</td><td>100</td>" for hauls and
    // "<td>4</td><td>12</td>" for QC photos. Check the pairs, not the page
    // text, so a stray "2" elsewhere cannot make this pass.
    const row = (label) => {
      const i = page.indexOf('<th scope="row">' + label + "</th>");
      expect(i).toBeGreaterThan(-1);
      return page.slice(i, i + 260);
    };
    expect(row("Hauls at once")).toContain("<td>" + cap("free", "haulsMax") + "</td>");
    expect(row("Hauls at once")).toContain("<td>" + cap("pro", "haulsMax") + "</td>");
    expect(row("QC photos an item")).toContain("<td>" + cap("free", "qcPhotosPerItem") + "</td>");
    expect(row("QC photos an item")).toContain("<td>" + cap("pro", "qcPhotosPerItem") + "</td>");
    // Kyle 2026-08-02: "take out the ask questions on chart pricing claims
    // everywhere across the site". The Ask row is gone from the table, so
    // there is no pair to bind. The cap itself still runs; entitlements.js
    // and plan-limits.test.js own it now.
    expect(page, "the Ask row is back on the price table").not.toContain(
      '<th scope="row">Ask</th>'
    );
    expect(row("AI size-chart reads")).toContain(
      "<td>" + cap("free", "chartVisionTotal") + " total</td>"
    );
    expect(row("AI size-chart reads")).toContain(
      "<td>" + cap("pro", "chartVisionPerMonth") + " a month</td>"
    );
    // Link resolves was the one row this test skipped, and it is the row most
    // likely to drift unnoticed: the copy writes 1,000 where the server writes
    // 1000, so a careless eye reads them as different numbers and "fixes" one.
    const comma = (n) => n.toLocaleString("en-US");
    expect(row("Link resolves")).toContain("<td>" + comma(cap("free", "resolveTotal")) + " total</td>");
    expect(row("Link resolves")).toContain("<td>" + comma(cap("pro", "resolvePerMonth")) + " a month</td>");
  });

  it("repeats the same caps in the plan bullet lists", () => {
    // The bullets sit above the table and are read far more often than it.
    // A number that agrees with the server in the table and disagrees in the
    // bullets is still a broken promise, and the table check cannot see it.
    const ent = read("preview/netlify/functions/lib/entitlements.js");
    const cap = (plan, key) => {
      const block = ent.slice(ent.indexOf("const PLAN_LIMITS"));
      const planBlock = block.slice(block.indexOf(plan + ": {"));
      const m = planBlock.match(new RegExp(key + ":\\s*(\\d+)"));
      return m ? Number(m[1]) : null;
    };
    const bullets = [...page.matchAll(/<li>([^<]*)<\/li>/g)].map((m) => m[1].trim());
    // Guard the guard: no bullets found means every check below passes on
    // nothing. The two plan cards carry ten between them.
    expect(bullets.length).toBeGreaterThan(8);
    const comma = (n) => n.toLocaleString("en-US");
    for (const want of [
      cap("free", "haulsMax") + " hauls at once",
      cap("pro", "haulsMax") + " hauls at once",
      cap("pro", "qcPhotosPerItem") + " QC photos an item",
      cap("pro", "chartVisionPerMonth") + " AI size-chart reads a month",
      comma(cap("pro", "resolvePerMonth")) + " link resolves a month",
    ]) {
      expect(bullets, "no bullet reads " + JSON.stringify(want)).toContain(want);
    }
    // The Ask bullet left with the Ask row. No bullet sells it and no bullet
    // prints its daily number.
    for (const bullet of bullets) {
      expect(bullet, "a bullet still sells Ask").not.toMatch(/\bAsk\b/);
    }
  });

  it("quotes the share caps the share function enforces", () => {
    // The share caps do NOT live in PLAN_LIMITS — they are constants in
    // share.js, because the function is the only thing that can count rows.
    // So the rule above cannot see them, and a page selling "100 links" while
    // the server allows 3 is the same broken promise as a wrong price.
    const fn = read("preview/netlify/functions/share.js");
    const constant = (name) => {
      const m = fn.match(new RegExp("const " + name + "\\s*=\\s*(\\d+)"));
      expect(m, name + " is gone from share.js").toBeTruthy();
      return Number(m[1]);
    };
    const free = constant("MAX_SHARES_FREE");
    const pro = constant("MAX_SHARES_PRO");

    const tableRow = (label) => {
      const i = page.indexOf('<th scope="row">' + label + "</th>");
      expect(i, "no table row named " + JSON.stringify(label)).toBeGreaterThan(-1);
      return page.slice(i, i + 260);
    };
    expect(tableRow("Shared haul links")).toContain("<td>" + free + "</td>");
    expect(tableRow("Shared haul links")).toContain("<td>" + pro + "</td>");

    const bullets = [...page.matchAll(/<li>([^<]*)<\/li>/g)].map((m) => m[1].trim());
    expect(bullets, "no free bullet reads the share cap").toContain(free + " shared haul links");
    expect(bullets, "no Pro bullet reads the share cap").toContain(pro + " shared haul links");

    // The three Pro-only link options are forced off server-side for a free
    // account. The page sells them as Pro, so the forcing has to still be there.
    for (const forced of ["pro && body.unlisted === true", "pro && body.hideFooter === true"]) {
      expect(fn, "share.js no longer forces " + forced).toContain(forced);
    }
    expect(fn, "share.js no longer gates expiry on Pro").toMatch(/pro && Number\.isFinite/);
  });

  it("describes the device row the way the app actually behaves", () => {
    // Pull is free, continuous push is Pro. That asymmetry is the whole row,
    // and it is easy to "simplify" the page into saying sync is Pro-only —
    // which would tell somebody who lost a phone that their cards are gone.
    const app = read("credenza-fashion.jsx");
    // The pull effect gates on signedIn + canPersist, with no plan check.
    expect(app).toContain("if (!signedIn || !canPersist || syncedOnceRef.current) return;");
    // The push effect adds isProPlan. If that ever drops, the page is wrong.
    expect(app).toContain(
      "if (!signedIn || !isProPlan || !canPersist || !syncedOnceRef.current) return;"
    );
    const deviceRow = page.slice(page.indexOf('<th scope="row">Your shelf on more than one device</th>'));
    expect(deviceRow.slice(0, 200), "the free side of the device row").toContain("Restore only");
    expect(deviceRow.slice(0, 200), "the Pro side of the device row").toContain("Kept in step");
  });

  it("names no cap the server does not enforce", () => {
    // D-3 applied to numbers. A row heading with no key in PLAN_LIMITS is a
    // limit the page promises and nothing implements.
    const ent = read("preview/netlify/functions/lib/entitlements.js");
    const known = [
      ...ent.slice(ent.indexOf("const PLAN_LIMITS")).matchAll(/(\w+):\s*\d+/g),
    ].map((m) => m[1]);
    for (const key of [
      "haulsMax",
      "qcPhotosPerItem",
      "askTotal",
      "chartVisionTotal",
      "resolveTotal",
      "askPerMonth",
      "chartVisionPerMonth",
      "resolvePerMonth",
    ]) {
      expect(known, key + " is not in PLAN_LIMITS").toContain(key);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The refund promise, which now lives on two pages.
//
// /terms/ has carried the 14-day full refund since launch. /pricing/ did not
// mention it at all, which is the wrong way round: Terms is the page nobody
// reads before paying, and Pricing is the page everybody does. So the promise
// was added to /pricing/ in the plan copy, the visible FAQ, and the FAQPage
// schema.
//
// That creates exactly the drift the price checks above exist to stop. A
// refund window is a promise a customer can screenshot, same as a price. If
// somebody edits one page to 30 days the other still says 14, and whichever
// number is larger is the one we are held to.
describe("the refund promise says the same thing on every page that makes it", () => {
  const terms = read("preview/public/terms/index.html");

  // The window, and the address to write to. Both are quoted verbatim on both
  // pages, so a change to either has to be made in both places or fail here.
  const WINDOW = "within 14 days";
  const EMAIL = "support@credenzafashion.com";

  it("states the window on the page where people decide to pay", () => {
    expect(page, "/pricing/ does not state the refund window").toContain(WINDOW);
    expect(page, "/pricing/ gives no address to ask for a refund").toContain(EMAIL);
  });

  it("states the same window in the Terms", () => {
    expect(terms, "/terms/ does not state the refund window").toContain(WINDOW);
    expect(terms, "/terms/ gives no address to ask for a refund").toContain(EMAIL);
  });

  it("quotes no other refund window on either page", () => {
    // The failure mode is an edit to one page leaving a second, different
    // number behind. Any "within N days" that is not the agreed window is a
    // second promise, and the customer picks whichever suits them.
    for (const [label, html] of [["/pricing/", page], ["/terms/", terms]]) {
      const windows = [...html.matchAll(/within (\d+) days/g)].map((m) => m[1]);
      expect(windows.length, `${label} states no refund window`).toBeGreaterThan(0);
      expect([...new Set(windows)], `${label} states more than one refund window`).toEqual(["14"]);
    }
  });

  it("sends refund requests to an address, never to a form that does not exist", () => {
    // The pricing copy links the address with mailto:. A link to a contact
    // page or a form would be a route that has to exist and be monitored;
    // the mailbox already is.
    expect(page).toContain('href="mailto:' + EMAIL + '"');
  });

  it("states the trial terms next to the weekly price, in full", () => {
    // The weekly plan carries a 3-day free trial (decided 2026-07-27). FTC
    // negative-option: the reader must see the free days, the after-trial
    // price and cadence, and the cancel path BEFORE they start. The weekly
    // trial note is the one sentence that carries all three, and the Profile
    // sheet prints the same sentence under its weekly button.
    expect(page).toContain(PRICING.weeklyTrialNote);
    // The trial is weekly-only. Monthly and yearly must not read as trials —
    // the free plan is the try-before-you-pay for those.
    expect(page.toLowerCase()).toContain("trial");
  });
});

// ───────────────────────────────────────────────────────────────────────────
// LB-61, the class guard. The test above proves the three link options are
// GATED. That is exactly the test that let `unlisted` ship dead: it was gated,
// it was stored, it was read back, and nothing a reader could see ever changed.
//
// A gate is not a feature. This block asserts each option has a CONSEQUENCE —
// a named consumer in a function that answers the public, reading the field
// off the loaded row. If a fourth option is ever sold, add it here, and the
// row-reader assertion will fail until the option actually does something.
describe("every link option the price table sells changes what a reader gets", () => {
  const sharePage = read("preview/netlify/functions/share-page.js");
  const shareImage = read("preview/netlify/functions/share-image.js");

  // Comments describe intent; only code creates a consequence. `unlisted` was
  // named in a share-page comment for weeks while doing nothing.
  const code = (src) => src.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

  const OPTIONS = [
    { name: "unlisted", row: "row.unlisted", where: [code(sharePage), code(shareImage)] },
    { name: "hideFooter", row: "row.hideFooter", where: [code(sharePage)] },
    { name: "expiry", row: "isExpired(row", where: [code(sharePage), code(shareImage)] },
  ];

  for (const opt of OPTIONS) {
    it(opt.name + " is read off the loaded row by a public route", () => {
      const seen = opt.where.filter((src) => src.includes(opt.row));
      expect(seen.length, opt.name + " is stored but no public route reads it — a dead option").toBeGreaterThan(0);
    });
  }

  it("the pricing row names exactly the options that are wired", () => {
    // Ties the sentence on the page to the list above. If someone sells a
    // fourth option in this row, this fails until OPTIONS grows to match —
    // and OPTIONS cannot grow without a real consumer.
    const row = /<th scope="row">Link options \(([^)]+)\)<\/th>/.exec(page);
    expect(row, "the Link options row was renamed — retune this guard").not.toBe(null);
    const sold = row[1].split(",").map((s) => s.trim());
    expect(sold.length, "the price table sells a different number of link options than are wired").toBe(OPTIONS.length);
  });
});
