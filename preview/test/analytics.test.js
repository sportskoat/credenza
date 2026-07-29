// Visitor counting (Kyle chose Google Analytics on 2026-07-29, #analytics).
//
// Three things can silently break and nobody would notice for weeks:
//
//   1. A new page ships without the counter line, so it reports nothing.
//   2. Somebody moves the gtag.js fetch out of start(), so a visitor who never
//      answered still reaches Google — which contradicts the sentence on the
//      Privacy notice.
//   3. The measurement id goes back to the placeholder in a merge.
//
// None of them is visible in a browser. They are all visible in the source, so
// this file reads the source, in the shape avatar-centre.test.js uses.
import { readFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const PREVIEW = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(PREVIEW, "public");
const TAG_LINE = '<script src="/analytics.js" defer></script>';
const SCRIPT = readFileSync(join(PUBLIC, "analytics.js"), "utf8");

function htmlPages(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...htmlPages(full));
    else if (name.endsWith(".html")) out.push(full);
  }
  return out.sort();
}

// google…html is the Search Console proof file, not a page. Google compares its
// exact bytes, so one added character breaks the site verification.
const pages = htmlPages(PUBLIC).filter((p) => !/^google[0-9a-f]+\.html$/.test(relative(PUBLIC, p)));

describe("every page carries the counter", () => {
  it("finds the pages", () => {
    expect(pages.length).toBeGreaterThanOrEqual(35);
  });

  for (const page of pages) {
    const rel = relative(PUBLIC, page);
    it(`${rel} loads /analytics.js`, () => {
      expect(readFileSync(page, "utf8")).toContain(TAG_LINE);
    });
  }

  it("the app shell loads /analytics.js", () => {
    expect(readFileSync(join(PREVIEW, "index.html"), "utf8")).toContain(TAG_LINE);
  });
});

describe("nothing reaches Google before the visitor accepts", () => {
  // The Privacy notice says "no request reaches Google until you choose
  // Accept". That is only true while the fetch sits inside start(), and start()
  // runs from exactly two places: a stored Accept, and the Accept button.
  it("fetches gtag.js in one place only", () => {
    const hits = SCRIPT.split("googletagmanager.com").length - 1;
    expect(hits, "gtag.js is referenced more than once").toBe(1);
  });

  it("fetches gtag.js inside start(), after the running guard", () => {
    const startAt = SCRIPT.indexOf("function start()");
    const guardAt = SCRIPT.indexOf("if (running) return;");
    const fetchAt = SCRIPT.indexOf("googletagmanager.com");
    expect(startAt, "start() is gone").toBeGreaterThan(-1);
    expect(guardAt).toBeGreaterThan(startAt);
    expect(fetchAt).toBeGreaterThan(guardAt);
  });

  it("calls start() only on a stored grant and on the Accept button", () => {
    const calls = SCRIPT.split(/\bstart\(\);/).length - 1;
    expect(calls, "start() is called from an unexpected place").toBe(2);
  });

  it("keeps every advertising signal denied", () => {
    for (const key of ["ad_storage", "ad_user_data", "ad_personalization"]) {
      expect(SCRIPT).toContain(key + ": DENIED");
    }
    expect(SCRIPT, "an advertising signal was granted").not.toMatch(/ad_[a-z_]+: GRANTED/);
  });

  it("sends no event before the visitor accepts", () => {
    expect(SCRIPT).toContain("if (!running || typeof name !== \"string\"");
  });
});

describe("the measurement id", () => {
  it("is a real id, not the placeholder", () => {
    const m = /var MEASUREMENT_ID = "([^"]+)"/.exec(SCRIPT);
    expect(m, "MEASUREMENT_ID is gone").toBeTruthy();
    expect(m[1]).toMatch(/^G-[A-Z0-9]{6,}$/);
    expect(m[1], "the placeholder shipped").not.toMatch(/^G-X+$/);
  });

  it("the placeholder still switches counting off", () => {
    // The shape test alone accepts "G-XXXXXXXXXX", so the off switch needs its
    // own line. This guards the line, not the value.
    expect(SCRIPT).toContain('if (/^G-X+$/.test(MEASUREMENT_ID)) return;');
  });
});

describe("the Privacy notice matches the code", () => {
  const privacy = readFileSync(join(PUBLIC, "privacy", "index.html"), "utf8");

  it("names Google Analytics as a processor", () => {
    expect(privacy).toContain("Google Analytics");
  });

  it("promises nothing reaches Google before Accept", () => {
    expect(privacy).toContain("no request reaches Google");
  });

  it("offers a way to change the answer", () => {
    expect(privacy).toContain("cz-consent-forget");
    expect(SCRIPT).toContain("window.czAnalyticsForget");
  });

  it("no longer claims the site runs no analytics product", () => {
    expect(privacy).not.toContain("no analytics product");
  });
});
