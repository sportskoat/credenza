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
    const stale = /\$5(?![\d.])|\$39(?!\.99)(?![\d])|\$36(?![\d.])/;
    const bad = files
      .filter((f) => stale.test(readFileSync(f, "utf8")))
      .map((f) => f.slice(PUBLIC.length + 1));
    expect(bad).toEqual([]);
  });
});

describe("the upgrade CTA goes through the app, never straight to Stripe", () => {
  it("targets the entry parameter that opens the Profile sheet", () => {
    // credenza-fashion.jsx reads params.get("profile") on mount and calls
    // setProfileOpen(true). That sheet holds the real checkout button, which
    // needs the signed-in session a static page does not have.
    expect(page).toContain('href="/?profile=1"');
  });

  it("links no Stripe URL", () => {
    // A checkout link on a static page would start a session with no account
    // attached, and the webhook would have nothing to grant Pro to.
    expect(page).not.toMatch(/stripe\.com|buy\.stripe|checkout\.stripe/i);
  });

  it("keeps the entry parameter the app actually reads", () => {
    const app = read("credenza-fashion.jsx");
    expect(app).toContain('params.get("profile")');
    expect(app).toContain("setProfileOpen(true)");
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
  it("names no unbuilt feature", () => {
    // docs/free-to-pro-checklist.md rows 10, 11, 13 and 15 are MISSING. Naming
    // one on the pricing page would be selling a feature that does not exist.
    for (const unbuilt of [
      "synced",
      "sync across",
      "shared shelf",
      "public link",
      "price watch",
      "restock",
      "seller memory",
    ]) {
      expect(page.toLowerCase()).not.toContain(unbuilt);
    }
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
    expect(row("Ask")).toContain("<td>" + cap("free", "askPerDay") + " a day</td>");
    expect(row("Ask")).toContain("<td>" + cap("pro", "askPerDay") + " a day</td>");
    expect(row("AI size-chart reads")).toContain(
      "<td>" + cap("free", "chartVisionPerDay") + " a day</td>"
    );
    expect(row("AI size-chart reads")).toContain(
      "<td>" + cap("pro", "chartVisionPerDay") + " a day</td>"
    );
    // Link resolves was the one row this test skipped, and it is the row most
    // likely to drift unnoticed: the copy writes 1,000 where the server writes
    // 1000, so a careless eye reads them as different numbers and "fixes" one.
    const comma = (n) => n.toLocaleString("en-US");
    expect(row("Link resolves")).toContain("<td>" + comma(cap("free", "resolvePerDay")) + " a day</td>");
    expect(row("Link resolves")).toContain("<td>" + comma(cap("pro", "resolvePerDay")) + " a day</td>");
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
      cap("pro", "chartVisionPerDay") + " AI size-chart reads a day",
      comma(cap("pro", "resolvePerDay")) + " link resolves a day",
      cap("pro", "askPerDay") + " Ask questions a day",
    ]) {
      expect(bullets, "no bullet reads " + JSON.stringify(want)).toContain(want);
    }
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
      "askPerDay",
      "chartVisionPerDay",
      "resolvePerDay",
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
  const EMAIL = "wenselllc@gmail.com";

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

  it("does not promise a free trial, because there is not one", () => {
    // The refund IS the trial. Naming a trial as well would imply a second,
    // separate guarantee and a clock that nothing in the product runs.
    expect(page.toLowerCase()).not.toContain("free trial");
    expect(page.toLowerCase()).not.toContain("day trial");
  });
});
