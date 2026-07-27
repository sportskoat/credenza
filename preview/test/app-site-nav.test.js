// LB-50. The app is the platform, and it did not link to the platform's site.
//
// Every static page under preview/public carries the same nav and the same
// footer: Open app, About, How it works, Guides, Pricing, FAQ, Support,
// Privacy, Terms, llms.txt. Twenty-one pages, all reachable from each other.
//
// Inside the app there were three links — Privacy, Terms, and a mailto — in the
// Profile sheet's legal row. So the direction that mattered was broken. The
// site could send you into the product; the product could not send you back to
// the page that explains it. Somebody looking for "how do I cancel Pro" got an
// empty compose window instead of /support/, which answers it under an <h2>.
//
// This file binds the app's outbound links to files that exist. It is a
// filesystem rule, in LB-44's shape: nothing in the JSX can tell you whether
// /guides/ resolves, because the app is a bundle and the site is static HTML
// served by the same host. A typo here is a 404 in the one place a confused
// person goes on purpose.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const PUBLIC = join(ROOT, "preview/public");
const SHEET = readFileSync(join(ROOT, "sheets/ProfileSheet.jsx"), "utf8");

// Read the SITE_LINKS array out of the source rather than importing the sheet.
// Importing pulls in credenza-fashion.jsx and a React tree; this rule only
// cares about four strings, and parsing them keeps the test fast and honest
// about what it checks.
function siteLinks() {
  const block = SHEET.match(/const SITE_LINKS = \[([\s\S]*?)\n\];/);
  if (!block) return null;
  return [...block[1].matchAll(/\[\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\]/g)].map(
    (m) => ({ href: m[1], label: m[2], val: m[3] })
  );
}

describe("the app links out to the site it belongs to", () => {
  const links = siteLinks();

  it("finds the SITE_LINKS array at all", () => {
    // Guard the guard. A rename makes siteLinks() null, every loop below
    // generates zero tests, and this file passes while checking nothing.
    expect(links, "SITE_LINKS is gone from sheets/ProfileSheet.jsx").not.toBeNull();
    expect(links.length, "SITE_LINKS is empty").toBeGreaterThanOrEqual(4);
  });

  for (const { href, label, val } of links || []) {
    it(`${href} is a page that exists`, () => {
      expect(href.startsWith("/") && href.endsWith("/"), `${href} is not a site directory path`).toBe(true);
      const file = join(PUBLIC, href.slice(1), "index.html");
      expect(existsSync(file), `${href} has no index.html under preview/public`).toBe(true);
    });

    it(`${href} has a label and a value a reader can act on`, () => {
      // A row that says "Guides ›" and nothing else is a link. A row that says
      // what is behind it is navigation. Both columns render, so both must
      // carry text.
      expect(label.length, `${href} has an empty label`).toBeGreaterThan(2);
      expect(val.length, `${href} has an empty value column`).toBeGreaterThan(2);
    });

    it(`${href} states no count that will go stale`, () => {
      // "13 walkthroughs" was the first draft of the Guides row. The next guide
      // makes it wrong, in a file nobody opens when they add a page. The number
      // of guides belongs on /guides/, which is generated from the directory.
      expect(
        /\b\d+\b/.test(val),
        `${href} value "${val}" carries a number — it will go stale, see /guides/`
      ).toBe(false);
    });
  }

  it("reaches the four places somebody in the app actually needs", () => {
    // Not every page — the sheet is not a sitemap. These four are the questions
    // a person asks from inside the product: what does this do, how do I do the
    // thing, what does it cost, and who do I ask when it breaks.
    const hrefs = (links || []).map((l) => l.href);
    for (const must of ["/how/", "/guides/", "/pricing/", "/support/"]) {
      expect(hrefs, `the app cannot reach ${must}`).toContain(must);
    }
  });

  it("opens site links in a new tab", () => {
    // The app is a single page holding unsaved sheet state. A same-tab jump
    // drops it and makes Back the only way home.
    const row = SHEET.match(/className="cz-profile-row cz-profile-row-link"[\s\S]{0,220}/);
    expect(row, "the Learn rows no longer use cz-profile-row-link").not.toBeNull();
    expect(row[0], "site links do not open in a new tab").toContain('target="_blank"');
    expect(row[0], 'target="_blank" without rel="noreferrer"').toContain('rel="noreferrer"');
  });

  it("sends Support to the page, not to a mail client", () => {
    // /support/ answers cancel, refund, export, delete, and bug under separate
    // headings. A mailto answers none of them and costs the reader a round
    // trip. The mailto still exists as "Email us" — this asserts the Support
    // row is the page.
    const learn = SHEET.slice(SHEET.indexOf("const SITE_LINKS"));
    expect(
      /\["\/support\/", "Support"/.test(learn),
      "the Support row no longer points at /support/"
    ).toBe(true);
  });

  it("styles the anchor rows so they match the button rows", () => {
    // .cz-profile-row was written for <button>. An <a> inherits an underline
    // and a visited colour, so without this class the Learn rows read as a
    // different kind of control than the rows directly above them.
    const css = readFileSync(join(ROOT, "credenza-fashion.css"), "utf8");
    expect(css, "cz-profile-row-link has no rule in credenza-fashion.css").toContain(
      ".cz-profile-row-link"
    );
    expect(css, "cz-profile-row-link does not clear the default underline").toMatch(
      /\.cz-profile-row-link\s*\{[^}]*text-decoration:\s*none/
    );
  });
});

// LB-53. The masthead nav (Kyle 2026-07-27: "we should probably just make a
// header that links to all of our pages here… make it easy to navigate… make a
// few header pages that link out to pro, contact us, guides, etc.").
//
// The rule above covers the Profile sheet, which is two taps deep. This covers
// the row that ships in the masthead itself, and it is the same filesystem rule
// for the same reason: nothing in the JSX can tell you whether /contact/
// resolves. One list lives in components/site-nav.js and this reads it back out
// of the source.
describe("the masthead reaches the site", () => {
  const NAV_SRC = readFileSync(join(ROOT, "components/site-nav.js"), "utf8");
  const APP = readFileSync(join(ROOT, "credenza-fashion.jsx"), "utf8");
  const CSS = readFileSync(join(ROOT, "credenza-fashion.css"), "utf8");

  function siteNav() {
    const block = NAV_SRC.match(/export const SITE_NAV = \[([\s\S]*?)\n\];/);
    if (!block) return null;
    return [...block[1].matchAll(/href:\s*"([^"]+)",\s*label:\s*"([^"]+)"/g)].map((m) => ({
      href: m[1],
      label: m[2],
    }));
  }

  const nav = siteNav();

  it("finds the SITE_NAV array at all", () => {
    // Guard the guard, same as SITE_LINKS above. A rename makes siteNav() null
    // and every loop below generates zero tests.
    expect(nav, "SITE_NAV is gone from components/site-nav.js").not.toBeNull();
    expect(nav.length, "SITE_NAV is empty").toBeGreaterThanOrEqual(4);
  });

  for (const { href, label } of nav || []) {
    it(`masthead ${href} is a page that exists`, () => {
      expect(href.startsWith("/") && href.endsWith("/"), `${href} is not a site directory path`).toBe(true);
      expect(
        existsSync(join(PUBLIC, href.slice(1), "index.html")),
        `${href} has no index.html under preview/public`
      ).toBe(true);
    });

    it(`masthead ${href} has a label that fits a header`, () => {
      // The masthead is one row between a wordmark and an avatar. A label long
      // enough to wrap pushes the avatar off the edge before the media query
      // that hides this can help.
      expect(label.length, `${href} has an empty label`).toBeGreaterThan(2);
      expect(label.length, `${href} label "${label}" is too long for the masthead`).toBeLessThanOrEqual(14);
      expect(
        /\b\d+\b/.test(label),
        `${href} label "${label}" carries a number — it will go stale`
      ).toBe(false);
    });
  }

  it("reaches the pages the request named", () => {
    // Kyle named three by hand. The rest is "etc." — this pins the three so a
    // future trim cannot quietly drop one.
    const hrefs = (nav || []).map((l) => l.href);
    for (const must of ["/pricing/", "/contact/", "/guides/"]) {
      expect(hrefs, `the masthead cannot reach ${must}`).toContain(must);
    }
  });

  it("renders SITE_NAV in the masthead rather than a second hand-written list", () => {
    // Two lists drift. The point of the module is that the header and this test
    // read the same one.
    expect(APP, "credenza-fashion.jsx does not import SITE_NAV").toMatch(
      /import \{ SITE_NAV \} from "\.\/components\/site-nav\.js"/
    );
    expect(APP, "the masthead does not map SITE_NAV").toContain("SITE_NAV.map");
    expect(APP, "the masthead nav has no accessible name").toContain('className="cz-mast-nav"');
  });

  it("opens masthead links in a new tab", () => {
    // Same reason as the Profile rows: the app holds unsaved capture state and
    // a same-tab jump drops it.
    const row = APP.match(/className="cz-mast-nav-link"[\s\S]{0,200}/);
    expect(row, "the masthead links no longer use cz-mast-nav-link").not.toBeNull();
    expect(row[0], "masthead links do not open in a new tab").toContain('target="_blank"');
    expect(row[0], 'target="_blank" without rel="noreferrer"').toContain('rel="noreferrer"');
  });

  it("keeps a way out on phones, where the masthead nav is hidden", () => {
    // The CSS hides .cz-mast-nav below 767px — six links do not fit beside a
    // wordmark on a 390px screen. That is only safe while the Profile sheet
    // still carries site links, so bind the two together here.
    expect(CSS, ".cz-mast-nav has no rule in credenza-fashion.css").toContain(".cz-mast-nav");
    expect(CSS, "the masthead nav is not hidden on phone widths").toMatch(
      /@media \(max-width: 767px\) \{\s*\.cz-mast-nav \{\s*display: none;/
    );
    expect(
      (siteLinks() || []).length,
      "the masthead is hidden on phones and the Profile sheet no longer carries site links"
    ).toBeGreaterThanOrEqual(4);
  });

  it("styles the masthead links with the app's focus ring, not the browser's", () => {
    // The same defect that put a blue Chrome outline on the avatar (Kyle
    // 2026-07-27, with a screenshot). A new interactive element in the masthead
    // has to be added to the :focus-visible list or it inherits outline: auto.
    expect(CSS, "cz-mast-nav-link has no :focus-visible rule").toContain(
      ".cz-mast-nav-link:focus-visible"
    );
    expect(CSS, "the avatar has no :focus-visible rule").toContain(".cz-avatar:focus-visible");
  });
});

// The second half of the same defect. The rule above checks the links the app
// HAS. This checks the links it SHOULD have — that no page ships on the site
// with no way in from anywhere.
describe("every public page is reachable from the site", () => {
  function pages(dir = PUBLIC, out = []) {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      if (name.isDirectory()) {
        if (["fonts", "img", "assets"].includes(name.name)) continue;
        pages(join(dir, name.name), out);
      } else if (name.name === "index.html") {
        const rel = join(dir, name.name).slice(PUBLIC.length).replace(/index\.html$/, "");
        out.push(rel);
      }
    }
    return out;
  }

  const all = pages();
  // Every text file that could carry a link, so an inbound link counts whether
  // it comes from a nav, a body paragraph, or the sitemap's sibling files.
  function linkSources() {
    const out = [];
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) {
          if (["fonts", "img", "assets"].includes(e.name)) continue;
          walk(join(dir, e.name));
        } else if (/\.(html|txt|xml)$/.test(e.name)) {
          out.push({ rel: join(dir, e.name).slice(PUBLIC.length + 1), body: readFileSync(join(dir, e.name), "utf8") });
        }
      }
    };
    walk(PUBLIC);
    return out;
  }
  const sources = linkSources();

  it("found the pages and the sources", () => {
    // Guard the guard, both halves. An empty page list makes the loop vacuous;
    // an empty source list makes every page look orphaned.
    expect(all.length, "no pages found under preview/public").toBeGreaterThan(15);
    expect(sources.length, "no linkable files found").toBeGreaterThan(15);
  });

  for (const url of all) {
    it(`${url} is linked from at least one other page`, () => {
      const from = sources
        .filter((s) => s.rel !== url.slice(1) + "index.html")
        .filter((s) => s.body.includes(`"${url}"`) || s.body.includes(`>${url}<`) || s.body.includes(url + "\n"))
        .map((s) => s.rel);
      expect(from, `${url} exists and nothing links to it`).not.toEqual([]);
    });
  }
});
