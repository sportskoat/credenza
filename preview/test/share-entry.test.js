// /how/stash-from-your-phone/ tells a person to build an iOS Shortcut by hand.
// Once they build it, it is on their phone and we cannot change it. So the
// parameter names the page publishes are a permanent contract with every reader
// who followed the instructions.
//
// This file pins that contract from both ends: the parameter the page tells
// people to type, and the parameter the app actually reads.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

const PAGE_REL = "preview/public/how/stash-from-your-phone/index.html";
const page = read(PAGE_REL);
const app = read("credenza-fashion.jsx");
const manifest = JSON.parse(read("preview/public/manifest.webmanifest"));

describe("the page names the parameter the app reads", () => {
  it("publishes /?stash=", () => {
    expect(page).toContain("credenzafashion.com/?stash=");
  });

  it("the app still reads every parameter the share routes send", () => {
    // The entry handler combines these three rather than picking one, because
    // a share sheet splits a post's link and text across separate params.
    // Renaming or dropping one silently breaks every Shortcut already built.
    const loop = app.match(/for \(const k of \[([^\]]+)\]\) \{\s*\n\s*const v = \(params\.get\(k\)/);
    expect(loop).toBeTruthy();
    const keys = loop[1].split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""));
    expect(keys.sort()).toEqual(["stash", "text", "url"]);
  });

  it("the app scrubs the parameter after reading it", () => {
    // Without this a refresh re-stashes the same item. The page promises no
    // duplicate, so the scrub is part of what it promises.
    expect(app).toContain("window.history.replaceState(null, \"\", window.location.pathname)");
  });
});

describe("the manifest share target matches the Android instructions", () => {
  it("declares a share target at all", () => {
    // The page tells Android users that installing the app is the whole setup.
    // That is only true while this block exists.
    expect(manifest.share_target).toBeTruthy();
  });

  it("maps the shared url onto the stash parameter", () => {
    expect(manifest.share_target.params.url).toBe("stash");
  });

  it("maps title and text too, because share sheets split a post across them", () => {
    expect(manifest.share_target.params.text).toBe("text");
    expect(manifest.share_target.params.title).toBe("title");
  });

  it("uses GET, so the parameters arrive in the query string", () => {
    // A POST share target needs a service worker to catch it. The entry
    // handler reads window.location.search, so the method must stay GET.
    expect((manifest.share_target.method || "GET").toUpperCase()).toBe("GET");
    expect(manifest.share_target.action).toBe("/");
  });
});

describe("the page tells people to encode the link", () => {
  // This is the single most likely way a hand-built Shortcut goes wrong. A
  // Weidian URL carries its own query string, so pasted in raw it truncates at
  // the first &, and the user gets a card pointing at the wrong page.
  it("names the URL Encode step", () => {
    expect(page).toContain("URL Encode");
    expect(page).toContain("URL Encoded Text");
  });

  it("explains why, not just what", () => {
    expect(page.toLowerCase()).toContain("carries its own");
  });

  it("encodes in the desktop bookmarklet too", () => {
    expect(page).toContain("encodeURIComponent(location.href)");
  });

  it("truncation is real, so the warning is not decorative", () => {
    // Prove the failure the page warns about, rather than asserting prose.
    const raw = "?stash=https://weidian.com/item.html?itemID=7376&spider_token=ab12";
    expect(new URLSearchParams(raw).get("stash")).toBe("https://weidian.com/item.html?itemID=7376");

    const link = "https://weidian.com/item.html?itemID=7376&spider_token=ab12";
    const encoded = "?stash=" + encodeURIComponent(link);
    expect(new URLSearchParams(encoded).get("stash")).toBe(link);
  });
});

describe("the page is reachable", () => {
  it("is in the sitemap", () => {
    expect(read("preview/public/sitemap.xml")).toContain(
      "<loc>https://credenzafashion.com/how/stash-from-your-phone/</loc>"
    );
  });

  it("is listed for the assistants", () => {
    for (const file of ["llms.txt", "llms-full.txt"]) {
      expect(read("preview/public/" + file)).toContain(
        "https://credenzafashion.com/how/stash-from-your-phone/"
      );
    }
  });

  it("is linked from a page a person actually lands on", () => {
    // A sitemap entry is not navigation. Something in the site has to point
    // here, or the page exists only for crawlers.
    const linkers = ["preview/public/how/index.html", "preview/public/faq/index.html"];
    for (const rel of linkers) {
      expect(read(rel)).toContain('href="/how/stash-from-your-phone/"');
    }
  });

  it("is linked from the empty shelf, where a person has not set up capture", () => {
    // Someone with zero cards is exactly the person who has not put Credenza
    // in their share sheet. That is the only screen where this link earns
    // its place, so pin it there rather than to the app in general.
    expect(app).toContain('href="/how/stash-from-your-phone/"');
  });

  it("carries the site nav, like every other page", () => {
    for (const href of ["/", "/landing/", "/how/", "/guides/", "/pricing/", "/faq/"]) {
      expect(page).toContain(`href="${href}"`);
    }
  });
});

describe("the page claims nothing the code does not do", () => {
  it("promises no account requirement", () => {
    // The stash path runs before any auth check. Saying otherwise would be a
    // reason not to bother setting the Shortcut up.
    expect(page).toContain("Nothing here needs an account");
  });

  it("promises no duplicate, and the app dedupes", () => {
    expect(page.toLowerCase()).toContain("does not duplicate");
    expect(app).toContain("itemMatchesCanonicalKey(x, key)");
  });
});

describe("the how/ sub-page does not break the existing page checks", () => {
  // pricing.test.js walks every doctype page under public/ and requires a
  // /pricing/ nav link. A new page that skipped it would fail there, not here —
  // this test names the rule so the next author sees it in the right file.
  it("is one of the pages that walk finds", () => {
    const pages = [];
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
          if (["fonts", "img", "assets"].includes(name)) continue;
          walk(full);
        } else if (name.endsWith(".html")) {
          pages.push(full);
        }
      }
    };
    walk(join(ROOT, "preview/public"));
    expect(pages.some((p) => p.endsWith(join("how", "stash-from-your-phone", "index.html")))).toBe(
      true
    );
  });
});
