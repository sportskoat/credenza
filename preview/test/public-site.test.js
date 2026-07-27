// The public site is 16 hand-written HTML files with no build step. Every page
// carries its own <style>, its own nav, and its own footer — there is no shared
// partial to enforce anything. So a page added or edited months apart drifts,
// and nothing fails until a reader or a crawler finds it.
//
// This file is the missing partial. It re-derives the invariants from the files
// themselves rather than from a hard-coded list, so a NEW page is covered the
// moment it lands instead of when somebody remembers to add it here.
//
// The defects that motivated it, all found by hand on 2026-07-26:
//
//   1. /pricing/ carried FAQPage JSON-LD with NO visible questions at all.
//      Google's structured-data policy requires the answer be visible to the
//      reader. Invisible FAQ schema risks a manual action, and nothing on the
//      page looked wrong.
//   2. /faq/ had 6 answers where the schema text and the visible text had
//      drifted apart. One of them promised the $4.99 price in the schema that
//      the reader never saw.
//   3. /landing/ was the only page missing Guides and FAQ from its nav.
//   4. 404.html still carried the nav from before Guides shipped. The first
//      version of this file only collected index.html, so it never looked.
//      That is why DOCS exists below — a landable page is not always an index.
//
// The parity rule is the important one: the VISIBLE copy is the source of
// truth, and the schema must match it exactly. Never satisfy this test by
// editing the schema to match a wrong visible answer — fix the copy.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const PUBLIC = join(ROOT, "preview/public");

function pageFiles(dir = PUBLIC) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "fonts" || name === "img" || name === "assets") continue;
      out.push(...pageFiles(full));
    } else if (name === "index.html") {
      out.push(full);
    }
  }
  return out;
}

const PAGES = pageFiles().map((full) => ({
  // "faq/index.html" — the label that shows up in a failure message.
  rel: relative(PUBLIC, full),
  // "/faq/" — the URL this file answers on.
  url: "/" + relative(PUBLIC, full).replace(/index\.html$/, ""),
  html: readFileSync(full, "utf8"),
}));

// 404.html is a page a reader lands on, so it needs the same nav and the same
// head as the rest. It is not an index.html, so PAGES misses it — and that is
// exactly how it kept a stale nav after Guides shipped. It is noindex, so it
// stays out of the sitemap checks below.
const EXTRA = ["404.html"].map((rel) => ({
  rel,
  url: "/" + rel,
  html: readFileSync(join(PUBLIC, rel), "utf8"),
}));

// Every file a reader can land on. Use this for nav, links, and head checks.
// Use PAGES for anything the sitemap governs.
const DOCS = [...PAGES, ...EXTRA];

const text = (s) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

function ldBlocks(html) {
  const out = [];
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

function faqSchema(html) {
  for (const raw of ldBlocks(html)) {
    const parsed = JSON.parse(raw);
    for (const node of Array.isArray(parsed) ? parsed : [parsed]) {
      if (node["@type"] === "FAQPage") return node;
    }
  }
  return null;
}

function visibleQA(html) {
  const out = [];
  const re = /<details[^>]*>([\s\S]*?)<\/details>/g;
  let m;
  while ((m = re.exec(html))) {
    const body = m[1];
    const summary = /<summary[^>]*>([\s\S]*?)<\/summary>/.exec(body);
    if (!summary) continue;
    const paras = [...body.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((p) => p[1]);
    out.push({ q: text(summary[1]), a: text(paras.join(" ")) });
  }
  return out;
}

it("finds the public pages at all", () => {
  // A glob that silently matches nothing would make every test below vacuous.
  expect(PAGES.length).toBeGreaterThanOrEqual(15);
});

describe("structured data", () => {
  for (const { rel, html } of DOCS) {
    it(`${rel} has only parseable JSON-LD`, () => {
      for (const raw of ldBlocks(html)) {
        expect(() => JSON.parse(raw), `invalid JSON-LD in ${rel}`).not.toThrow();
      }
    });
  }

  // The rule Google enforces, and the one that broke on /pricing/.
  const withFaq = DOCS.filter(({ html }) => faqSchema(html));

  it("at least one page carries FAQPage schema", () => {
    expect(withFaq.length).toBeGreaterThan(0);
  });

  for (const { rel, html } of withFaq) {
    it(`${rel} shows every question its FAQPage schema claims`, () => {
      const schema = faqSchema(html).mainEntity.map((q) => ({
        q: text(q.name),
        a: text(q.acceptedAnswer.text),
      }));
      const visible = visibleQA(html);

      // Same questions, same order. Order matters: a reader scanning the page
      // and a crawler reading the schema should meet the answers alike.
      expect(visible.map((x) => x.q), `${rel} question list`).toEqual(
        schema.map((x) => x.q)
      );

      // Same answers, word for word. This is the check that caught the six
      // drifted /faq/ answers.
      for (let i = 0; i < schema.length; i++) {
        expect(visible[i].a, `${rel} answer to "${schema[i].q}"`).toBe(
          schema[i].a
        );
      }
    });
  }
});

describe("navigation", () => {
  // D-2, decided 2026-07-26: every public page reaches these. The landing page
  // header is an in-page scroll nav by design, so this checks the whole
  // document rather than the <nav> element — the footer counts.
  const REQUIRED = [
    "/",
    "/how/",
    "/guides/",
    "/pricing/",
    "/faq/",
    "/support/",
    "/privacy/",
    "/terms/",
  ];

  for (const { rel, html } of DOCS) {
    it(`${rel} links to every other public section`, () => {
      for (const href of REQUIRED) {
        expect(html, `${rel} is missing a link to ${href}`).toContain(`href="${href}"`);
      }
    });
  }
});

describe("links and metadata", () => {
  const urls = new Set(PAGES.map((p) => p.url));

  for (const { rel, html } of DOCS) {
    it(`${rel} has no broken internal page link`, () => {
      const hrefs = [...html.matchAll(/href="(\/[^"#?]*)"/g)].map((m) => m[1]);
      for (const href of hrefs) {
        // "/" is the React app, which Vite builds from index-fashion.html.
        // It is not a file under public/, so there is nothing to look up.
        if (href === "/") continue;
        // Only directory-style links name a page. Files (/llms.txt, /og.png)
        // are checked by existence on disk instead.
        if (href.endsWith("/")) {
          expect(urls.has(href), `${rel} links to ${href}, which is not a page`).toBe(true);
        } else {
          const onDisk = join(PUBLIC, href.replace(/^\//, ""));
          let exists = true;
          try {
            statSync(onDisk);
          } catch {
            exists = false;
          }
          expect(exists, `${rel} links to ${href}, which is not a file`).toBe(true);
        }
      }
    });

    it(`${rel} declares its own canonical URL`, () => {
      // A wrong canonical hands the ranking to another page. Each one must
      // name itself, not a page it was copied from.
      expect(html, `${rel} canonical`).toContain(
        `<link rel="canonical" href="https://credenzafashion.com${
          rel === "index.html"
            ? "/"
            : rel.endsWith("/index.html")
              ? "/" + rel.replace(/index\.html$/, "")
              : "/" + rel
        }" />`
      );
    });

    it(`${rel} has a title and a description`, () => {
      expect(/<title>[^<]{10,}<\/title>/.test(html), `${rel} title`).toBe(true);
      expect(/name="description"/.test(html), `${rel} description`).toBe(true);
    });
  }
});

describe("the sitemap", () => {
  const sitemap = readFileSync(join(PUBLIC, "sitemap.xml"), "utf8");
  const listed = new Set(
    [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
      m[1].replace("https://credenzafashion.com", "")
    )
  );

  for (const { rel, url } of PAGES) {
    it(`lists ${rel}`, () => {
      // A page missing here is a page the crawler may never reach.
      expect(listed.has(url), `${url} is not in sitemap.xml`).toBe(true);
    });
  }

  it("lists no page that does not exist", () => {
    const urls = new Set(PAGES.map((p) => p.url));
    for (const loc of listed) {
      if (loc === "/") continue; // the app itself, not a file under public/
      expect(urls.has(loc), `sitemap.xml lists ${loc}, which has no file`).toBe(true);
    }
  });
});
