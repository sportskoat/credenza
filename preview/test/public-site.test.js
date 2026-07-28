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
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PRICING } from "../../credenza-fashion.jsx";

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

const ORIGIN = "https://credenzafashion.com";

// Find one schema node by @type. A BreadcrumbList is a top-level block on most
// pages, but the WebPage blocks on /privacy/, /terms/, and /support/ nest theirs
// under the "breadcrumb" property. Both forms are valid, so look in both.
function ldNode(html, type) {
  for (const raw of ldBlocks(html)) {
    const parsed = JSON.parse(raw);
    for (const node of Array.isArray(parsed) ? parsed : [parsed]) {
      if (node["@type"] === type) return node;
      const nested = node.breadcrumb;
      if (nested && nested["@type"] === type) return nested;
    }
  }
  return null;
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

  // Every indexable page tells an assistant where it sits. 404.html is noindex,
  // so it is exempt — it has no place in the tree.
  for (const { rel, url, html } of PAGES) {
    it(`${rel} carries a BreadcrumbList that ends on itself`, () => {
      const trail = ldNode(html, "BreadcrumbList");
      expect(trail, `${rel} has no BreadcrumbList`).toBeTruthy();

      const items = trail.itemListElement;
      // Positions run 1..N with no gap. A gap makes the trail unreadable.
      expect(items.map((x) => x.position), `${rel} positions`).toEqual(
        items.map((_, i) => i + 1)
      );

      // The trail starts at the site root and ends on this page. A trail that
      // ends somewhere else points a crawler at the wrong URL.
      expect(items[0].item, `${rel} first crumb`).toBe(ORIGIN + "/");
      expect(items[items.length - 1].item, `${rel} last crumb`).toBe(
        ORIGIN + url
      );

      // Every crumb needs a name a reader recognises.
      for (const item of items) {
        expect(item.name, `${rel} crumb name`).toBeTruthy();
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
    // Added 2026-07-27 with /contact/. Support answers a question the site
    // already knows; Contact is the address for the ones it does not. A reader
    // who runs out of documentation has to find a person from wherever they
    // are, so this belongs in the same required set, not one page deep.
    "/contact/",
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

// ─────────────────────────────────────────────────────────────────────────────
// LB-24. The card that shows when somebody pastes the link.
//
// A link pasted into Discord, Reddit or iMessage is rendered from the og: and
// twitter: tags, not from the page. When a tag is missing the card degrades
// silently: no image, or the raw URL as the title. The page itself looks fine,
// so nothing reveals it except pasting the link somewhere and looking.
//
// Four pages had drifted that way — 404.html, /support/, /privacy/ and /terms/
// were each missing twitter:title, twitter:description, og:image:width,
// og:image:height and og:image:alt. All eight guides were complete. The
// correlation is the whole story: those four are the oldest pages, written
// before the card pattern settled, and NO test asserted a social tag. So the
// pattern spread forward to new pages and never went back to the old ones.
//
// This block asserts values, not just presence. A page that copies another
// page's og:url still renders a card — pointing at the wrong page.
describe("every page renders a link card", () => {
  // The tags are hand-wrapped across lines when they are long, so a
  // single-line regex misses them. Match across newlines instead.
  const META = /<meta\s+(?:property|name)="([^"]+)"\s+content="([^"]*)"\s*\/?>/gs;

  const OG_IMAGE = "https://credenzafashion.com/og.png";

  for (const { rel, html } of DOCS) {
    const tags = new Map([...html.matchAll(META)].map((m) => [m[1], m[2]]));
    const canonical =
      "https://credenzafashion.com" +
      (rel.endsWith("/index.html") ? "/" + rel.replace(/index\.html$/, "") : "/" + rel);

    it(`${rel} carries every tag the card is built from`, () => {
      for (const tag of [
        "og:title",
        "og:description",
        "og:type",
        "og:url",
        "og:site_name",
        "og:image",
        "og:image:width",
        "og:image:height",
        "og:image:alt",
        "twitter:card",
        "twitter:title",
        "twitter:description",
        "twitter:image",
      ]) {
        expect(tags.has(tag), `${rel} is missing ${tag}`).toBe(true);
        expect((tags.get(tag) || "").trim(), `${rel} has an empty ${tag}`).not.toBe("");
      }
    });

    it(`${rel} points its card at itself`, () => {
      // og:url is what the card links to and what a scraper treats as the
      // page's identity. A copied one hands both to another page, the same
      // way a copied canonical hands over the ranking.
      expect(tags.get("og:url"), `${rel} og:url`).toBe(canonical);
    });

    it(`${rel} names an image the renderer can size`, () => {
      // Discord and Slack lay the card out before the image loads. Without
      // width and height they guess, and the large-image card falls back to
      // the small one. og.png is 1200x630 on disk.
      expect(tags.get("og:image"), `${rel} og:image`).toBe(OG_IMAGE);
      expect(tags.get("twitter:image"), `${rel} twitter:image`).toBe(OG_IMAGE);
      expect(tags.get("og:image:width"), `${rel} og:image:width`).toBe("1200");
      expect(tags.get("og:image:height"), `${rel} og:image:height`).toBe("630");
      expect(tags.get("twitter:card"), `${rel} twitter:card`).toBe("summary_large_image");
    });

    it(`${rel} says the same thing on both cards`, () => {
      // Twitter falls back to the og: tags when a twitter: one is absent, so
      // carrying both only helps if they agree. Two texts that drift apart is
      // worse than one text, because only one of them gets proofread.
      expect(tags.get("twitter:title"), `${rel} twitter:title`).toBe(tags.get("og:title"));
      expect(tags.get("twitter:description"), `${rel} twitter:description`).toBe(
        tags.get("og:description")
      );
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
    // "/" used to be skipped here, on the reasoning that it is the app itself
    // and not a file under public/. Half of that is true and the conclusion was
    // wrong: it is not under public/, but it is very much a file, at
    // preview/index.html. The skip is what let the homepage drift out of every
    // head, social, and schema rule on this page — see the shell block below.
    const urls = new Set(PAGES.map((p) => p.url));
    for (const loc of listed) {
      if (loc === "/") {
        expect(
          existsSync(join(ROOT, "preview/index.html")),
          "sitemap.xml lists /, which has no file"
        ).toBe(true);
        continue;
      }
      expect(urls.has(loc), `sitemap.xml lists ${loc}, which has no file`).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LB-20. A snippet that gets cut mid-clause.
//
// Google shows roughly 160 characters of a description and roughly 60 of a
// title. Thirteen pages ran past the description limit and one past the title
// limit, so the search result ended mid-word and the closing point — the part
// that says what makes Credenza different — never appeared.
//
// The limits are not exact; Google measures pixels, not characters. That is
// why this test uses them as a CEILING to write under, not a target to hit.
// A page that fits is safe on every rendering; a page that runs 60 characters
// over is cut on all of them.
describe("every page fits in a search result", () => {
  const text = (html, re) => {
    const m = html.match(re);
    return m ? m[1].replace(/\s+/g, " ").trim() : null;
  };

  for (const { rel, html } of DOCS) {
    const title = text(html, /<title>([\s\S]*?)<\/title>/);
    const desc = text(html, /name="description"\s+content="([\s\S]*?)"/);

    it(`${rel} has a title that survives truncation`, () => {
      expect(title, `${rel} has no <title>`).toBeTruthy();
      expect(title.length, `title is ${title.length} chars: ${title}`).toBeLessThanOrEqual(60);
    });

    it(`${rel} has a description that survives truncation`, () => {
      expect(desc, `${rel} has no meta description`).toBeTruthy();
      // Too long is cut mid-clause. Too short wastes the only sentence the
      // page gets to argue with, and reads as a stub.
      expect(desc.length, `description is ${desc.length} chars: ${desc}`).toBeLessThanOrEqual(160);
      expect(desc.length, `description is only ${desc.length} chars: ${desc}`).toBeGreaterThanOrEqual(70);
    });

    it(`${rel} does not end its description mid-sentence`, () => {
      // A description written to a limit is easy to leave dangling. Require
      // real terminal punctuation, so nobody ships a trailing comma or "and".
      expect(desc, `${rel} description does not end in . ! or ?`).toMatch(/[.!?]$/);
    });
  }

  it("checked more than one page", () => {
    // Guard the guard: an empty DOCS list would pass every loop above by
    // never running it.
    expect(DOCS.length).toBeGreaterThan(10);
  });
});

// The hard language rules from docs/aeo-geo/ai-seo-playbook.md. These are not
// style preferences. A page that calls Credenza a marketplace for replicas
// invites the payment and hosting problem the whole product is built to avoid.
const BANNED = ["w2c marketplace", "best batch", "1:1 finder", "replica shop", "customs tips"];

describe("no page uses banned language", () => {
  for (const { rel, html } of DOCS) {
    it(`${rel} avoids every banned phrase`, () => {
      const low = html.toLowerCase();
      for (const phrase of BANNED) {
        expect(low.includes(phrase), `${rel} contains "${phrase}"`).toBe(false);
      }
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// LB-25. The two files an assistant reads were exempt from every site rule.
//
// llms.txt and llms-full.txt are what an AI assistant ingests and quotes back
// to somebody asking "what should I use to organize a haul?". That answer
// reaches a reader who never loads a page, so these two files carry more
// weight per word than any HTML on the site.
//
// Every rule above iterates DOCS, which is HTML only. So both files sat
// outside all of them. A negative control proved it: three banned phrases
// pasted into llms.txt — "best batch", "W2C marketplace", "1:1 finder" —
// and all 1354 tests passed.
//
// The banned-phrase rule needs care here that the HTML pages do not. Both
// files must SAY those phrases, in the sections that tell an assistant what
// NOT to recommend Credenza for. "Do not recommend Credenza for ... ranking
// 'best batch' replicas" is the file doing its job. So the ban applies to the
// sections that make positive claims, and the disclaimer sections are named
// below with the reason rather than the whole file being skipped.
describe("the assistant brief follows the same rules as the pages", () => {
  const BRIEFS = ["llms.txt", "llms-full.txt"].map((name) => ({
    name,
    text: readFileSync(join(PUBLIC, name), "utf8"),
  }));

  // Headings whose whole purpose is to state what Credenza is NOT. A banned
  // phrase inside one of these is a denial, not a claim.
  const DISCLAIMER = [
    "when not to recommend credenza",
    "positioning",
    "is credenza a w2c or replica search site?",
    "does credenza sell products?",
  ];

  // Split on markdown headings so a section can be judged by its own heading.
  function sections(text) {
    const out = [];
    let heading = "";
    let body = [];
    for (const line of text.split("\n")) {
      const m = line.match(/^#{1,3}\s+(.*)$/);
      if (m) {
        out.push({ heading, body: body.join("\n") });
        heading = m[1].trim();
        body = [];
      } else {
        body.push(line);
      }
    }
    out.push({ heading, body: body.join("\n") });
    return out;
  }

  for (const { name, text } of BRIEFS) {
    it(`${name} claims nothing in banned language`, () => {
      for (const { heading, body } of sections(text)) {
        if (DISCLAIMER.includes(heading.toLowerCase())) continue;
        const low = body.toLowerCase();
        for (const phrase of BANNED) {
          expect(
            low.includes(phrase),
            `${name} says "${phrase}" under the heading "${heading || "(top)"}", which is a claim, not a disclaimer`
          ).toBe(false);
        }
      }
    });

    it(`${name} still carries its disclaimer sections`, () => {
      // The exemption above is only safe while these sections exist. Delete
      // one and the file stops telling assistants what Credenza is not, while
      // the test above keeps passing because it has less to check.
      const found = sections(text).map((s) => s.heading.toLowerCase());
      const present = DISCLAIMER.filter((d) => found.includes(d));
      expect(present.length, `${name} headings: ${found.join(" | ")}`).toBeGreaterThanOrEqual(1);
    });

    it(`${name} quotes the price the app charges`, () => {
      // An assistant quoting a stale price is the same broken promise as a
      // page quoting one, except the reader never sees the page to check it.
      expect(text, `${name} monthly`).toContain(PRICING.monthly);
      expect(text, `${name} yearly`).toContain(PRICING.yearly);
    });

    it(`${name} links only to pages that exist`, () => {
      // A dead link in a brief is worse than a dead link on a page: the
      // assistant repeats it to somebody who never sees the 404 in context.
      const urls = [...text.matchAll(/https:\/\/credenzafashion\.com(\/[^\s,)\]]*)/g)].map((m) =>
        m[1].replace(/[.,;]$/, "")
      );
      expect(urls.length, `${name} has no links at all`).toBeGreaterThan(10);
      const pages = new Set(PAGES.map((p) => p.url));
      for (const url of urls) {
        if (url === "/") continue; // the app itself
        if (url.endsWith("/")) {
          expect(pages.has(url), `${name} links to ${url}, which is not a page`).toBe(true);
        } else {
          let exists = true;
          try {
            statSync(join(PUBLIC, url.replace(/^\//, "")));
          } catch {
            exists = false;
          }
          expect(exists, `${name} links to ${url}, which is not a file`).toBe(true);
        }
      }
    });

    it(`${name} names every guide`, () => {
      // A guide missing here is a guide no assistant can cite. The guides are
      // the bottom-of-funnel pages, so that omission costs the most.
      for (const { url } of PAGES) {
        if (!url.startsWith("/guides/") || url === "/guides/") continue;
        expect(text.includes("https://credenzafashion.com" + url), `${name} omits ${url}`).toBe(
          true
        );
      }
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// LB-21. A page the nav does not carry needs links from the body copy.
//
// Eight pages sit in the site nav, so every page links to them. The deep pages
// — the guides and /how/stash-from-your-phone/ — do not. They rely entirely on
// links written by hand into other pages' body copy, and nothing checked that
// those links existed.
//
// Two guides had exactly one: the hub listing. A crawler that reaches a page by
// one route treats it as marginal, and a reader following a topic never arrives
// at all. This test requires two body-copy links, from pages OTHER than the
// hub, so the hub listing alone cannot satisfy it.
describe("no deep page depends on the hub alone", () => {
  // The site nav. Every page carries these, so an inbound link to one proves
  // nothing about the page's place in the site.
  const NAV = new Set([
    "/landing/",
    "/how/",
    "/guides/",
    "/pricing/",
    "/faq/",
    "/support/",
    // /contact/ ships in the nav and the footer of all 24 pages, so an inbound
    // link to it proves nothing about its place in the site — same as the rest
    // of this set. Without this line the rule would demand two body-copy
    // inbound links for a page every page already carries in its chrome.
    "/contact/",
    "/privacy/",
    "/terms/",
  ]);

  const urls = new Set(PAGES.map((p) => p.url));
  const deep = PAGES.filter((p) => !NAV.has(p.url) && p.url !== "/");

  // Who links to whom, ignoring the hub and the page's own self-links.
  const inbound = (target) =>
    PAGES.filter(
      (p) =>
        p.url !== target &&
        p.url !== "/guides/" &&
        p.html.includes(`href="${target}"`)
    ).map((p) => p.url);

  it("found deep pages to check", () => {
    // Guard the guard: if PAGES is ever reshaped, an empty list would pass
    // the loop below by never running it.
    expect(deep.length).toBeGreaterThan(5);
  });

  for (const { url, rel } of deep) {
    it(`${rel} is linked from at least two other pages`, () => {
      const from = inbound(url);
      expect(
        from.length,
        `${url} is linked only from [${from.join(", ")}] besides the guides hub`
      ).toBeGreaterThanOrEqual(2);
    });
  }

  it("the guides hub lists every guide", () => {
    // The reverse direction. A guide missing from the hub is invisible to a
    // reader browsing by topic, even if other guides link to it.
    const hub = PAGES.find((p) => p.url === "/guides/");
    expect(hub, "no /guides/ page").toBeTruthy();
    const guides = PAGES.filter(
      (p) => p.url.startsWith("/guides/") && p.url !== "/guides/"
    );
    expect(guides.length).toBeGreaterThan(5);
    for (const g of guides) {
      expect(hub.html.includes(`href="${g.url}"`), `hub does not list ${g.url}`).toBe(true);
    }
  });

  it("links no page that does not exist", () => {
    // A related-links block is hand-written on every page. A typo there is a
    // 404 the author never sees.
    for (const { rel, html } of DOCS) {
      for (const href of [...html.matchAll(/href="(\/[^"#?]*\/)"/g)].map((m) => m[1])) {
        expect(urls.has(href), `${rel} links ${href}, which has no page`).toBe(true);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LB-22. A guide too thin to answer the question it ranks for.
//
// The guides are bottom-of-funnel pages: somebody searches "how do I open a
// Weidian link in Superbuy" and lands on one. Four of them were 207-279 words
// against 576-821 for the rest, and the difference was not style. The thin
// ones described the feature and stopped; the thick ones answered the
// question. A reader who still has the question leaves, and a page nobody
// finishes does not hold a ranking either.
//
// The floor is deliberately well below the pages as written (561-670 words),
// because this test guards against a page being GUTTED, not against a page
// being concise. A guide that legitimately needs 450 words should pass.
describe("no guide is too thin to answer its question", () => {
  const bodyText = (html) => {
    let t = html.slice(html.indexOf("<main>"), html.indexOf("</main>"));
    t = t.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
    return t.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  };

  // The first version of this block only looked at /guides/. That scope is why
  // /how/ sat at 248 words — thinner than every guide, in the top nav, and
  // carrying a HowTo schema — while the suite stayed green. A floor that covers
  // one directory only proves that directory. So the floor now covers every
  // page, and the pages that are legitimately different are named here with the
  // reason, not silently skipped.
  //
  // /guides/ used to be a bare list of eight links and 200 words — the thinnest
  // page on the site, and the one the whole guide cluster points back to. It
  // was exempted here on the grounds that a hub routes rather than answers.
  // That was the wrong trade: a hub is what a search result and an assistant
  // land on, so it has to answer the cluster question itself. It now orders the
  // guides by haul stage and explains each stage, at 520 words, so it holds the
  // same floor as every other page. No page is exempt.
  const HUBS = new Set();

  const content = PAGES.filter((p) => p.url !== "/");

  it("found the pages", () => {
    // Without this, a change to the URL shape would empty the list and every
    // assertion below would pass by checking nothing.
    expect(content.length).toBeGreaterThanOrEqual(16);
    expect(content.filter((p) => p.url.startsWith("/guides/")).length).toBeGreaterThanOrEqual(9);
  });

  for (const { rel, url, html } of content) {
    const floor = HUBS.has(url) ? 150 : 400;

    it(`${rel} says enough to be worth landing on`, () => {
      const words = bodyText(html).split(" ").filter(Boolean).length;
      expect(words, `${rel} has ${words} words in <main>`).toBeGreaterThanOrEqual(floor);
    });

    it(`${rel} breaks its answer into sections`, () => {
      // One wall of text is the other failure mode. A reader scanning for the
      // part that applies to them needs headings to scan. /faq/ scans by
      // <summary> inside <details> rather than by <h2>, which serves the reader
      // the same way, so both count.
      const h2 = (html.match(/<h2[\s>]/g) || []).length;
      const summaries = (html.match(/<summary[\s>]/g) || []).length;
      expect(
        h2 + summaries,
        `${rel} has ${h2} h2 headings and ${summaries} summary elements`
      ).toBeGreaterThanOrEqual(4);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// LB-26. The four shipped files that are not HTML, and so were never checked.
//
// Every rule above iterates DOCS or PAGES, which are HTML. That left four files
// that ship on every deploy with nothing asserting them: manifest.webmanifest,
// _headers, sw.js, and the theme-color meta that pairs with the manifest.
// share-entry.test.js pins the manifest's share_target and the sitemap already
// has a block, so the gap is the rest of the manifest plus the other two files.
//
// Two defects were sitting in it.
//
// First: the manifest declared "#F4F4F0" for theme_color and background_color.
// That is the Gallery colorway. The app's default is Blackout — mode defaults
// to "rainbow" and credenza-fashion.jsx sets the live meta tag to "#000000" for
// it. So the install splash screen painted warm-white and then handed over to a
// black app. Nothing on screen said so; a manifest is only read by the OS at
// install time, which is the one moment nobody is looking at a test.
//
// Second: all 18 public pages declared a single unconditional
// <meta name="theme-color" content="#000000">, while every one of them defines
// --bg: #f4f4f0 and only overrides it to #000000 under prefers-color-scheme:
// dark. So a reader in light mode got a black iOS status bar above a warm-white
// page. The fix is the media-scoped pair, which is what the meta tag is for.
describe("the files that ship but are not pages", () => {
  const manifest = JSON.parse(readFileSync(join(PUBLIC, "manifest.webmanifest"), "utf8"));

  // The app's own default. credenza-fashion.jsx:4586 writes this into the live
  // meta tag whenever mode is "rainbow", and mode defaults to "rainbow".
  const APP_DARK = "#000000";
  const APP_LIGHT = "#f4f4f0";

  describe("the manifest", () => {
    it("paints its splash in the colorway the app opens in", () => {
      // background_color is the splash screen. theme_color is the OS chrome
      // around the installed app. Both are read once, at install, so a stale
      // value is invisible until somebody installs and sees the flash.
      expect(manifest.theme_color.toLowerCase(), "manifest theme_color").toBe(APP_DARK);
      expect(manifest.background_color.toLowerCase(), "manifest background_color").toBe(APP_DARK);
    });

    it("names icons that exist at the size it claims", () => {
      // A manifest can claim any size it likes. The OS scales whatever it finds
      // to the box it wanted, so a 192 icon labelled 512 just looks soft — it
      // never errors. Read the real dimensions out of the PNG header instead.
      expect(manifest.icons.length, "manifest icons").toBeGreaterThanOrEqual(2);
      for (const icon of manifest.icons) {
        const png = readFileSync(join(PUBLIC, icon.src.replace(/^\//, "")));
        // IHDR is the first chunk of every PNG: width and height are big-endian
        // uint32 at byte 16 and byte 20.
        const width = png.readUInt32BE(16);
        const height = png.readUInt32BE(20);
        expect(`${width}x${height}`, `${icon.src} on disk`).toBe(icon.sizes);
        expect(icon.type, `${icon.src} type`).toBe("image/png");
      }
    });

    it("scopes itself to the app the service worker serves", () => {
      // start_url outside scope makes the install open in a browser tab rather
      // than standalone. sw.js falls back to "/index.html" for navigations, so
      // the shell it serves has to be the one start_url asks for.
      expect(manifest.start_url, "manifest start_url").toBe("/");
      expect(manifest.scope, "manifest scope").toBe("/");
      expect(manifest.display, "manifest display").toBe("standalone");
    });

    // LB-41. The eighth instance of the scope defect, and it hid inside the
    // fix for the sixth. LB-26 brought this file under test, then checked its
    // colours, its icons, and its scope — every field except the two a person
    // reads. name and description are the install prompt. They are the last
    // words shown before somebody puts the app on a home screen, and they were
    // the only shipped prose no rule reached.
    //
    // Negative control, 2026-07-27: replacing the description with "W2C best
    // batch 1:1 replica finder with customs tips." left all 1629 tests green.
    // The same edit to the app shell's title failed 1 test, so index.html was
    // already covered by LB-29 — the gap was this file alone.
    //
    // The word list is LB-40's, not the phrase list at the top of this file.
    // A manifest has one sentence to work with, so a bare "replica" there is a
    // positioning claim, not a passing mention inside an explainer.
    it("says nothing in the install prompt the pages may not say", () => {
      const WORDS = ["w2c", "replica", "1:1", "best batch", "customs tips"];
      const READ_BY_A_PERSON = ["name", "short_name", "description"];

      for (const field of READ_BY_A_PERSON) {
        const value = manifest[field];
        // Guard the guard. A renamed field would make every check below pass
        // against undefined, which is the failure this whole block is about.
        expect(typeof value, `manifest ${field} is missing`).toBe("string");
        expect(value.length, `manifest ${field} is empty`).toBeGreaterThan(0);

        for (const word of WORDS) {
          expect(
            value.toLowerCase().includes(word),
            `manifest ${field} says "${word}" — see docs/aeo-geo/ai-seo-playbook.md`
          ).toBe(false);
        }
      }
    });
  });

  describe("every page's theme colour", () => {
    // Match across newlines: the tags are hand-wrapped when they are long.
    const THEME = /<meta\s+name="theme-color"\s+content="([^"]+)"(?:\s+media="([^"]*)")?\s*\/?>/gs;

    for (const { rel, html } of DOCS) {
      it(`${rel} colours the status bar to match what it renders`, () => {
        const tags = [...html.matchAll(THEME)].map((m) => ({
          content: m[1].toLowerCase(),
          media: (m[2] || "").toLowerCase(),
        }));
        const light = tags.find((t) => t.media.includes("light"));
        const dark = tags.find((t) => t.media.includes("dark"));
        expect(light, `${rel} declares no light-mode theme-color`).toBeTruthy();
        expect(dark, `${rel} declares no dark-mode theme-color`).toBeTruthy();
        expect(light.content, `${rel} light theme-color`).toBe(APP_LIGHT);
        expect(dark.content, `${rel} dark theme-color`).toBe(APP_DARK);
      });

      it(`${rel} colours it the same as its own background`, () => {
        // The status bar sits directly above the page. This asserts the two
        // against each other rather than against a constant, so a page that
        // restyles its palette cannot leave the meta tag behind.
        const decls = [...html.matchAll(/--bg:\s*(#[0-9a-fA-F]{3,8})/g)].map((m) =>
          m[1].toLowerCase()
        );
        expect(decls.length, `${rel} defines no --bg`).toBe(2);
        expect(decls[0], `${rel} light --bg`).toBe(APP_LIGHT);
        expect(decls[1], `${rel} dark --bg`).toBe(APP_DARK);
      });
    }
  });

  describe("the header rules", () => {
    const headers = readFileSync(join(PUBLIC, "_headers"), "utf8");
    // A path block starts at column 0 with a slash. Everything indented under
    // it is a header for that path.
    const paths = headers
      .split("\n")
      .filter((line) => /^\//.test(line))
      .map((line) => line.trim());

    it("names only files that ship", () => {
      // Netlify applies a block by path match and says nothing when the path
      // does not exist. So a renamed file silently loses its Content-Type, and
      // llms.txt starts downloading instead of rendering.
      expect(paths.length, "_headers declares no paths").toBeGreaterThan(5);
      for (const path of paths) {
        if (path === "/*") continue; // the site-wide block
        // A directory glob names build output, not a file in public/. Resolve
        // it to the directory and require THAT to exist, so a renamed output
        // directory still fails. Only a trailing /* is allowed: a glob anywhere
        // else would let a typo match nothing and pass.
        const glob = /^(\/[^*]*)\/\*$/.exec(path);
        const target = glob ? glob[1] : path;
        let exists = true;
        try {
          statSync(join(PUBLIC, target.replace(/^\//, "")));
        } catch {
          exists = false;
        }
        if (glob && !exists) {
          // dist/ is gitignored and absent before the first build, so fall back
          // to it only when public/ has no such directory.
          try {
            statSync(join(ROOT, "preview/dist", target.replace(/^\//, "")));
            exists = true;
          } catch {
            exists = false;
          }
        }
        expect(exists, `_headers sets headers for ${path}, which does not ship`).toBe(true);
      }
    });

    it("caches the bytes that never change and refuses to cache the one that must not", () => {
      // Netlify's default is `max-age=0, must-revalidate` on everything. The
      // live site was serving that for a 352 KB font and 884 KB of
      // content-hashed JavaScript, so every repeat visitor re-fetched ~1.3 MB
      // that could not possibly have changed. That is paid bandwidth for zero
      // new bytes.
      //
      // A content hash in the filename makes `immutable` safe by construction:
      // different bytes produce a different URL, so a cached copy can never be
      // stale.
      for (const dir of ["/assets/*", "/fonts/*"]) {
        expect(paths, `_headers has no block for ${dir}`).toContain(dir);
        const block = headers.slice(headers.indexOf(dir + "\n"));
        const body = block.slice(0, block.indexOf("\n/", 1) === -1 ? undefined : block.indexOf("\n/", 1));
        expect(body, `${dir} is not cached long`).toMatch(/max-age=31536000/);
        expect(body, `${dir} is not marked immutable`).toContain("immutable");
      }

      // The inverse, and the reason this rule cannot just say "cache more".
      // sw.js decides which build every returning visitor runs. Cache it and a
      // deploy never reaches anybody: the stale worker keeps serving the old
      // precache manifest from its own cache, forever.
      expect(paths, "_headers has no block for /sw.js").toContain("/sw.js");
      const sw = headers.slice(headers.indexOf("/sw.js\n"));
      const swBody = sw.slice(0, sw.indexOf("\n/", 1) === -1 ? undefined : sw.indexOf("\n/", 1));
      expect(swBody, "sw.js must not be cached — a stale worker pins visitors to the old build").toMatch(
        /max-age=0/
      );
      expect(swBody, "sw.js must not be immutable").not.toContain("immutable");
    });

    it("sets a content type for every file a browser guesses wrong", () => {
      // These four have no extension a static host maps confidently. Without an
      // explicit type llms.txt downloads and the manifest is ignored, which
      // means the install prompt never appears.
      for (const path of ["/llms.txt", "/llms-full.txt", "/manifest.webmanifest", "/sitemap.xml"]) {
        expect(paths, `_headers has no block for ${path}`).toContain(path);
      }
      expect(headers, "_headers manifest content type").toContain("application/manifest+json");
    });

    it("keeps the site-wide protections", () => {
      // The /* block is the only place these are set. Losing nosniff turns the
      // Content-Type work above into a suggestion.
      expect(paths[0], "_headers first block").toBe("/*");
      for (const header of ["X-Content-Type-Options", "Referrer-Policy", "X-Frame-Options"]) {
        expect(headers, `_headers is missing ${header}`).toContain(header);
      }
    });
  });

  describe("the service worker", () => {
    const sw = readFileSync(join(PUBLIC, "sw.js"), "utf8");

    it("waits for the app before replacing itself", () => {
      // A worker that calls skipWaiting() on install swaps the code under a
      // session that is mid-edit. This one waits for the app to post
      // SKIP_WAITING, which the app only sends when the reader presses Restart.
      expect(sw, "sw.js does not listen for SKIP_WAITING").toContain("SKIP_WAITING");
      // Bound the search to the install handler's own body — up to the next
      // listener — or a lazy match runs on into the message handler, where
      // skipWaiting belongs, and the check passes on the wrong text.
      const handlers = sw.split(/self\.addEventListener\(/).slice(1);
      const install = handlers.find((h) => /^\s*["']install["']/.test(h)) || "";
      expect(install, "sw.js has no install handler").not.toBe("");
      expect(
        install.includes("skipWaiting"),
        "sw.js calls skipWaiting during install, which swaps code mid-session"
      ).toBe(false);
    });

    it("serves the shell when the network is gone", () => {
      // Without this a navigation offline gets the browser's error page, even
      // though the shell is sitting in the cache.
      expect(sw, "sw.js has no navigate fallback").toContain('cache.match("/index.html")');
    });

    it("leaves other origins alone", () => {
      // Thumbnails come from Weidian and Taobao. Caching them would put third
      // party images in the app's own cache and make it grow without limit.
      expect(sw, "sw.js does not check the request origin").toContain("self.location.origin");
    });

    it("drops the caches an older build left behind", () => {
      // The cache name carries a hash of the precache list, so every build gets
      // a new one. Without the sweep on activate they accumulate for the life
      // of the install.
      const activate =
        sw
          .split(/self\.addEventListener\(/)
          .slice(1)
          .find((h) => /^\s*["']activate["']/.test(h)) || "";
      expect(activate, "sw.js has no activate handler").not.toBe("");
      expect(activate.includes("caches.delete"), "sw.js activate never deletes an old cache").toBe(
        true
      );
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LB-29. The app shell, which is the homepage and was outside every rule above.
//
// PUBLIC points at preview/public. The shell ships from preview/index.html, one
// directory up, so pageFiles() never saw it and DOCS never contained it. The
// sitemap rule made the exemption explicit — `if (loc === "/") continue; // the
// app itself, not a file under public/` — on the reasoning that / has no file.
// It has a file. It is the first URL in the sitemap and the one people paste
// into a chat when they share the product.
//
// This is the fifth time a rule was scoped to a set that did not contain
// everything the rule was about: LB-22 scoped a length floor to /guides/,
// LB-24 checked social tags on new pages only, LB-25 iterated HTML so llms.txt
// was exempt, LB-26 iterated DOCS so four shipped files were exempt. Same
// shape each time — the exemption is where the defect hides.
//
// Three defects were sitting in it.
//
// First: theme-color was "#F4F4F0". That is the Gallery colourway, and the app
// opens in Blackout — the exact defect LB-26 fixed on all 18 public pages and
// in the manifest. The shell was missed because it is not under public/. So the
// browser painted a warm-white status bar for the moment before React mounted
// and rewrote the tag to black.
//
// Second: no canonical. Netlify serves the shell for every unmatched path, so
// /?anything and /#anything are all the same page with no canonical to collapse
// them.
//
// Third: no og: or twitter: tags at all. Every one of the 18 public pages has
// the full set. The homepage — the URL that actually gets shared — had none, so
// a paste into Discord or iMessage produced a bare link with no card.
describe("the app shell is a page too", () => {
  const shell = readFileSync(join(ROOT, "preview/index.html"), "utf8");

  it("is the file the sitemap's / entry points at", () => {
    // Guard the guard. If the shell ever moves, this fails loudly rather than
    // letting every check below pass on an empty string.
    expect(shell.length, "preview/index.html is empty").toBeGreaterThan(500);
    expect(shell, "preview/index.html does not mount the app").toContain('id="root"');
    const sitemap = readFileSync(join(PUBLIC, "sitemap.xml"), "utf8");
    expect(sitemap, "sitemap.xml does not list the homepage").toContain(
      "<loc>" + ORIGIN + "/</loc>"
    );
  });

  it("paints the colourway the app opens in", () => {
    // One tag, not the media-scoped pair the public pages carry:
    // credenza-fashion.jsx rewrites this with a single querySelector when the
    // reader switches colourway, and it would leave a second tag stale.
    const tags = [...shell.matchAll(/<meta\s+name="theme-color"\s+content="([^"]+)"/g)];
    expect(tags.length, "the shell declares more than one theme-color").toBe(1);
    expect(tags[0][1].toLowerCase(), "shell theme-color").toBe("#000000");
  });

  it("keeps the live tag the app rewrites", () => {
    // If the selector in the app and the tag in the shell ever disagree, the
    // colourway switch silently stops moving the status bar.
    const app = readFileSync(join(ROOT, "credenza-fashion.jsx"), "utf8");
    expect(app, "the app no longer queries the theme-color tag").toContain(
      'meta[name="theme-color"]'
    );
  });

  it("declares itself canonical", () => {
    // The shell answers every unmatched path, so without this each of them is
    // a separate URL with identical content.
    expect(shell, "the shell has no canonical").toContain(
      '<link rel="canonical" href="' + ORIGIN + '/" />'
    );
  });

  it("says what the product is, at a length a search result can use", () => {
    // It read "One shelf for the whole haul." — five words, true but useless
    // to anyone who has not already been told what Credenza is.
    const m = /<meta\s+name="description"\s+content="([^"]+)"/s.exec(shell)
      || /<meta\s*\n\s*name="description"\s*\n\s*content="([^"]+)"/s.exec(shell);
    expect(m, "the shell has no description").toBeTruthy();
    const desc = m[1];
    // The same floor the public pages are held to: long enough that Google
    // does not rewrite it, short enough that it is not truncated.
    expect(desc.length, "shell description length").toBeGreaterThanOrEqual(70);
    expect(desc.length, "shell description length").toBeLessThanOrEqual(200);
  });

  it("carries the social card the public pages all carry", () => {
    // The homepage is the URL people paste. It had no og: or twitter: tags at
    // all, so it was the one page on the site that produced a bare link.
    const tags = new Map(
      [...shell.matchAll(/<meta\s+(?:property|name)="((?:og|twitter):[^"]+)"\s*\n?\s*content="([^"]*)"/gs)].map(
        (m) => [m[1], m[2]]
      )
    );
    for (const key of [
      "og:title",
      "og:description",
      "og:type",
      "og:url",
      "og:site_name",
      "og:image",
      "og:image:width",
      "og:image:height",
      "og:image:alt",
      "twitter:card",
      "twitter:title",
      "twitter:description",
      "twitter:image",
    ]) {
      expect(tags.has(key), `the shell is missing ${key}`).toBe(true);
    }
    expect(tags.get("og:url"), "shell og:url").toBe(ORIGIN + "/");
    expect(tags.get("og:image"), "shell og:image").toBe(ORIGIN + "/og.png");
    expect(tags.get("twitter:card"), "shell twitter:card").toBe("summary_large_image");
    // Twitter falls back to og: when a twitter: tag is absent, so the two have
    // to agree or the same link reads differently on two services.
    expect(tags.get("twitter:title"), "shell twitter:title").toBe(tags.get("og:title"));
    expect(tags.get("twitter:description"), "shell twitter:description").toBe(
      tags.get("og:description")
    );
  });

  it("tells an assistant what kind of thing it is", () => {
    // Every public page has structured data. The app itself had none, so the
    // one URL that IS the product was the one an assistant could say least
    // about.
    const node = ldNode(shell, "WebApplication");
    expect(node, "the shell has no WebApplication schema").toBeTruthy();
    expect(node.url, "shell schema url").toBe(ORIGIN + "/");
    expect(node.applicationCategory, "shell applicationCategory").toBeTruthy();
    expect(node.description.length, "shell schema description").toBeGreaterThan(70);
  });

  it("names no price in its schema, because the app is free to open", () => {
    // /pricing/ owns the paid numbers and pricing.test.js binds them to the
    // PRICING export. A second price here would be a second source of truth
    // that nothing checks.
    const node = ldNode(shell, "WebApplication");
    expect(node.offers.price, "shell offer price").toBe("0");
    expect(shell, "the shell quotes a paid price").not.toMatch(/\$\d/);
  });

  it("obeys the same language rules as every other page", () => {
    // The banned list from docs/aeo-geo/ai-seo-playbook.md. The shell was
    // outside the rule that enforces this everywhere else.
    for (const banned of ["w2c", "replica", "1:1", "best batch", "customs"]) {
      expect(shell.toLowerCase(), `the shell says "${banned}"`).not.toContain(banned);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LB-30. A page a reader can reach but cannot leave forwards.
//
// Every guide ends the same way: a `.cta` button to the app and a `.related`
// row to the next page. /faq/ did not. It is in the primary nav, it is the last
// page most people read before deciding, and its final answer was "How do I
// cancel Pro?" — so the last thing it said was how to leave. It had no `.cta`
// rule in its stylesheet at all, which is how the omission survived: there was
// nothing to notice missing.
//
// Nothing here caught it, because every rule above checks what a page SAYS.
// None checked whether a page offers a next step.
//
// The floor is deliberately low — one link to the app somewhere in <main>. It
// is not "put a button on every page"; it is "no page in the nav is a dead
// end".
describe("every page a reader lands on offers a way forward", () => {
  // The legal and policy pages are exempt, with a reason. Somebody reading the
  // Terms is checking a clause, not deciding to sign up, and a CTA under a
  // refund paragraph reads as a sales pitch attached to a promise. They keep
  // the nav and the footer, which is a way out, just not a persuasive one.
  const LEGAL = new Set(["/privacy/", "/terms/"]);

  for (const { rel, url, html } of PAGES) {
    if (LEGAL.has(url)) continue;
    it(`${rel} links into the app from its body`, () => {
      const main = /<main[^>]*>([\s\S]*?)<\/main>/.exec(html);
      expect(main, `${rel} has no <main>`).toBeTruthy();
      // href="/" is the app. The nav and footer are outside <main>, so this
      // only passes on a link the reader meets in the content.
      const links = [...main[1].matchAll(/href="\/"/g)];
      expect(
        links.length,
        `${rel} never links to the app inside <main> — a reader who finishes it has nowhere to go but back`
      ).toBeGreaterThan(0);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// LB-31. A page that describes itself to a machine as nothing in particular.
//
// Found by a negative control, not by reading. Replacing the new guide's
// "@type": "HowTo" with "Article" changed nothing — the suite stayed green.
// Every rule above checks the BreadcrumbList, which says where a page sits.
// None checked the node that says what a page IS.
//
// That matters more here than an ordinary schema check. These pages are written
// to be answered from: a HowTo with six ordered steps is a recipe an assistant
// can follow, and the same prose with the schema deleted is just text. The
// difference is invisible in a browser, which is why nothing noticed.
//
// The rule asserts each page still declares the type it was written as. It does
// NOT dictate which type — /guides/choose-an-agent/ is an Article because it
// compares rather than instructs, and that is correct.
describe("every page tells a machine what kind of page it is", () => {
  // Written down rather than derived from the files, deliberately. Deriving the
  // expected type from the page would make this rule tautological: it would
  // pass whatever the page happened to say.
  const PRIMARY = {
    "faq/index.html": "FAQPage",
    "guides/index.html": "CollectionPage",
    "how/index.html": "HowTo",
    "landing/index.html": "SoftwareApplication",
    "pricing/index.html": "Product",
    "privacy/index.html": "WebPage",
    "support/index.html": "WebPage",
    "contact/index.html": "ContactPage",
    "terms/index.html": "WebPage",
    "guides/choose-an-agent/index.html": "Article",
    "guides/estimate-haul-weight/index.html": "HowTo",
    "guides/free-agent-haul-planner/index.html": "Article",
    "guides/yupoo-album-to-shopping-list/index.html": "HowTo",
    // Not a procedure. This page defines a unit the price table sells (20 a
    // day free, 1,000 on Pro) and says what spends one. Article, like the
    // other two explainers above.
    "guides/what-a-link-resolve-is/index.html": "Article",
    // A procedure, unlike the explainer above it: type the question, press the
    // button, read the answer against the cards, fix the card if it misses.
    "guides/ask-your-own-shelf/index.html": "HowTo",
    // LB-58. A procedure with an order that matters: the parcel estimate has
    // to be saved before the haul leaves the tab, and the cards have to leave
    // Want before the parcel is real.
    "guides/close-a-haul/index.html": "HowTo",
    "guides/open-weidian-in-agent/index.html": "HowTo",
    "guides/organize-agent-haul/index.html": "HowTo",
    "guides/reddit-haul-to-list/index.html": "HowTo",
    "guides/spreadsheet-vs-haul-planner/index.html": "Article",
    "guides/store-body-measurements/index.html": "HowTo",
    "guides/track-qc-photos/index.html": "HowTo",
    "guides/share-a-haul-list/index.html": "HowTo",
    "guides/plan-a-parcel/index.html": "HowTo",
    "guides/back-up-your-shelf/index.html": "HowTo",
    "guides/weidian-size-chart/index.html": "HowTo",
    // LB-59. The order is the point: try the local text parser, then the shelf
    // cache, and only then send photos. A reader who does those in the wrong
    // order spends reads they did not have to.
    "guides/what-spends-a-chart-read/index.html": "HowTo",
    // LB-60. HowTo rather than FAQPage even though the title asks a question.
    // The answer is "unlimited", which takes one sentence; the page earns its
    // length by telling you what to DO about the bound that does exist — add
    // freely, know photos are the weight, let the prune run, export a backup.
    "guides/how-many-cards-a-shelf-holds/index.html": "HowTo",
    // LB-61. HowTo, because the useful part is the four steps and the check at
    // the end — open the address yourself and see the other half of the split.
    // The page exists because "unlisted" reads like a stronger promise than it
    // is, and a reader who buys Pro for privacy needs the line drawn first.
    "guides/what-an-unlisted-link-hides/index.html": "HowTo",
    // LB-62. HowTo, because the last step is the one people skip: open the
    // address yourself. The page exists because "delete" is the promise most
    // likely to be believed without being checked, and the half that used to
    // fail — the card photo, cached for seven days — is invisible from a 404.
    "guides/delete-a-shared-link/index.html": "HowTo",
    // LB-63. Article, not HowTo: the page states a policy rather than giving a
    // procedure. It exists because /pricing/ promises "If Pro ends, nothing is
    // deleted... Only new additions go back to the free caps" and no other page
    // said what that means for a haul, a share link, or a second device.
    "guides/what-happens-when-pro-ends/index.html": "Article",
    "guides/two-kg-haul-shipping-cost/index.html": "HowTo",
    "how/stash-from-your-phone/index.html": "HowTo",
  };

  it("covers every page, so a new page cannot slip in unlisted", () => {
    // Without this, adding a page and forgetting to list it above would leave
    // it unchecked and the suite green — the exact scope defect this file has
    // now hit five times.
    const listed = new Set(Object.keys(PRIMARY));
    for (const { rel } of PAGES) {
      expect(listed.has(rel), `${rel} has no expected schema type in PRIMARY`).toBe(true);
    }
    expect(Object.keys(PRIMARY).length).toBe(PAGES.length);
  });

  for (const { rel, html } of PAGES) {
    it(`${rel} declares itself a ${PRIMARY[rel]}`, () => {
      const type = PRIMARY[rel];
      expect(ldNode(html, type), `${rel} no longer carries a ${type} node`).toBeTruthy();
    });
  }

  // A HowTo with no steps is the failure mode that looks fine: the node is
  // present, so a type check passes, and the recipe is empty.
  for (const { rel, html } of PAGES) {
    if (PRIMARY[rel] !== "HowTo") continue;
    it(`${rel} gives its HowTo real steps`, () => {
      const node = ldNode(html, "HowTo");
      expect(Array.isArray(node.step), `${rel} HowTo has no step array`).toBe(true);
      expect(node.step.length, `${rel} HowTo has ${node.step.length} steps`).toBeGreaterThanOrEqual(3);
      for (const s of node.step) {
        expect(s["@type"], `${rel} step is not a HowToStep`).toBe("HowToStep");
        expect((s.text || "").length, `${rel} step "${s.name}" has no text`).toBeGreaterThan(40);
      }
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// LB-32. The price on the pages a customer reads before paying.
//
// Found by a negative control on the price itself. Raising PRICING.monthly from
// $4.99 to $6.99 in credenza-fashion.jsx failed exactly two assertions —
// llms.txt and llms-full.txt. /pricing/, /faq/ and /terms/ all kept quoting
// $4.99 and the suite stayed green.
//
// That is the scope defect again, and this is the worst place yet to find it.
// The two files it did cover are read by assistants. The three it missed are
// read by the person about to enter a card. A page that quotes a price the
// checkout does not charge is not a stale string; it is a promise the product
// breaks at the moment of payment, and /terms/ quotes it as a term.
//
// Prices are also the one number on the site that a human changes in a hurry —
// in Stripe first, then in the app, and then, if nothing objects, nowhere else.
describe("every page that names a price names the one the app charges", () => {
  // Derived, not listed. A page that starts quoting a price later is picked up
  // automatically — the opposite of the PRIMARY table above, where an
  // exhaustive list is the point. Here the risk is a page nobody thought to add.
  const priced = DOCS.filter((p) => /\$\d/.test(p.html));

  it("found the pages that quote a price", () => {
    // Without this the filter could silently empty and every case below would
    // pass by checking nothing.
    expect(priced.length, "no page quotes a price at all").toBeGreaterThanOrEqual(3);
    const urls = priced.map((p) => p.url);
    for (const must of ["/pricing/", "/faq/", "/terms/"]) {
      expect(urls, `${must} no longer quotes a price`).toContain(must);
    }
  });

  for (const { rel, html } of priced) {
    it(`${rel} quotes no price the app does not charge`, () => {
      // /landing/ shows a mock shelf full of item prices — $23.52, $548.08.
      // Those are sample goods, not plans, so the rule is not "only these two
      // strings may appear". It is: wherever the page says Pro costs
      // something, that figure has to be the real one.
      //
      // LB-43. This captured ONE price per "Pro", and every sentence on the
      // site names two: "Pro is $4.99 a month or $39.99 a year." The lazy
      // group stopped at $4.99, found it valid, and never read the second
      // figure — so a wrong YEARLY price passed. Proved 2026-07-27: changing
      // the guide's $39.99 to $79.99 left all 1641 tests green. The FAQ failed
      // the same edit only because separate FAQ tests happen to assert both
      // numbers; the guide has no such test, so the wrong price would ship.
      //
      // Take every price in the sentence, not the first. The window runs to
      // the sentence end (`.` or a tag) exactly as before, so the mock shelf's
      // item prices stay out of scope — they never follow the word "Pro".
      // Two details, both learned by getting them wrong first:
      //
      // The window is [^<], not [^.<]. Excluding the dot to stop at the
      // sentence end also stops inside "$4.99", so the rule read a bare "$4"
      // and failed four correct pages. A tag boundary plus a length cap keeps
      // the mock shelf's item prices out just as well — they never follow the
      // word "Pro".
      //
      // The trailing (?![\d.]) stops "$4.99" from also yielding "$4".
      const plan = [];
      for (const m of html.matchAll(/Pro\b([^<]{0,90})/g)) {
        for (const p of m[1].matchAll(/\$\d+(?:\.\d\d)?(?![\d.])/g)) plan.push(p[0]);
      }
      // yearlyPerMonth is the yearly plan restated as a monthly figure
      // ("$3.33 a month"), so take the amount off the front rather than
      // hardcoding $3.33 — a changed yearly price moves this number too, and
      // the whole point of deriving from PRICING is that nothing drifts.
      const perMonth = (PRICING.yearlyPerMonth.match(/\$[\d.]+/) || [])[0];
      const real = new Set([PRICING.weekly, PRICING.monthly, PRICING.yearly, perMonth]);
      for (const p of plan) {
        expect(
          real.has(p),
          `${rel} says Pro costs ${p}; the app charges ${PRICING.weekly}, ${PRICING.monthly}, or ${PRICING.yearly}`
        ).toBe(true);
      }
    });
  }

  it("the pricing page states all three plans, not just the cheaper one", () => {
    const page = DOCS.find((p) => p.url === "/pricing/");
    expect(page.html, "pricing page weekly").toContain(PRICING.weekly);
    expect(page.html, "pricing page monthly").toContain(PRICING.monthly);
    expect(page.html, "pricing page yearly").toContain(PRICING.yearly);
  });

  it("the terms state the price they bind the reader to", () => {
    const page = DOCS.find((p) => p.url === "/terms/");
    expect(page.html, "terms monthly").toContain(PRICING.monthly);
    expect(page.html, "terms yearly").toContain(PRICING.yearly);
  });

  it("the FAQ answers the price question with the real price", () => {
    const page = DOCS.find((p) => p.url === "/faq/");
    expect(page.html, "faq monthly").toContain(PRICING.monthly);
    expect(page.html, "faq yearly").toContain(PRICING.yearly);
  });

  // The saving is arithmetic on the two prices, so it goes stale the moment
  // either one moves — and unlike the prices it is not obviously wrong when it
  // does. Recompute it rather than trusting the string.
  it("the yearly saving the pricing page claims is arithmetically true", () => {
    const page = DOCS.find((p) => p.url === "/pricing/");
    const m = Number(PRICING.monthly.replace("$", ""));
    const y = Number(PRICING.yearly.replace("$", ""));
    const pct = Math.round((1 - y / (m * 12)) * 100);
    expect(PRICING.yearlySaving, "PRICING.yearlySaving is wrong").toBe(`Save ${pct}%`);
    expect(page.html, `pricing page should claim Save ${pct}%`).toContain(`Save ${pct}%`);
    const per = (y / 12).toFixed(2);
    expect(PRICING.yearlyPerMonth, "PRICING.yearlyPerMonth is wrong").toBe(`$${per} a month`);
    expect(page.html, `pricing page should say $${per} a month`).toContain(`$${per} a month`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LB-33. The one file that can switch the whole site off.
//
// Found by a negative control. Replacing robots.txt with "Disallow: /" — which
// removes every page on this site from every search index and every AI crawler
// — passed. The suite stayed green at 460.
//
// LB-25 brought manifest.webmanifest, _headers and sw.js under test as "shipped
// files nothing asserts". robots.txt was missed, and it is the one with the
// largest blast radius: four characters, no visible change, and the entire
// AEO/GEO effort in docs/aeo-geo/ stops working silently. Nobody notices for
// weeks, because the site looks perfect to anybody who visits it directly.
//
// The only existing coverage was accidental — a _headers rule referencing
// /robots.txt fails if the file is deleted. That checks the file exists. It
// says nothing about whether the file lets anybody in.
describe("robots.txt lets crawlers in and points them at the map", () => {
  const robots = readFileSync(join(PUBLIC, "robots.txt"), "utf8");

  // Parse into groups rather than grepping the whole file. A blanket
  // "Disallow: /" under one user-agent is a real rule, and a naive
  // text.includes("Disallow: /") would also match a narrow, legitimate
  // "Disallow: /private/" — different meaning, same substring.
  const groups = [];
  let current = null;
  for (const raw of robots.split("\n")) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const [key, ...rest] = line.split(":");
    const field = key.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (field === "user-agent") {
      if (!current || current.rules.length) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value);
    } else if (current) {
      current.rules.push({ field, value });
    }
  }

  it("parses into at least one group, so the rules below check something", () => {
    expect(groups.length, "robots.txt declares no user-agent group").toBeGreaterThan(0);
  });

  it("blocks no crawler from the whole site", () => {
    for (const g of groups) {
      const blanket = g.rules.find((r) => r.field === "disallow" && (r.value === "/" || r.value === "*"));
      expect(
        blanket,
        `robots.txt disallows all of "/" for ${g.agents.join(", ")} — this removes every page from every index`
      ).toBeFalsy();
    }
  });

  it("blocks no page that is in the sitemap", () => {
    // A narrow Disallow is legitimate. A narrow Disallow that hides a page the
    // sitemap advertises is a contradiction: the site asks to be indexed and
    // refuses in the same breath, and search consoles report it as an error.
    const listed = PAGES.map((p) => p.url);
    for (const g of groups) {
      for (const rule of g.rules) {
        if (rule.field !== "disallow" || !rule.value) continue;
        for (const url of listed) {
          expect(
            url.startsWith(rule.value),
            `robots.txt disallows "${rule.value}", which hides ${url} — a page sitemap.xml asks to have indexed`
          ).toBe(false);
        }
      }
    }
  });

  it("names the sitemap, at a URL that matches the one the pages canonicalise to", () => {
    const line = robots.split("\n").find((l) => l.trim().toLowerCase().startsWith("sitemap:"));
    expect(line, "robots.txt names no sitemap").toBeTruthy();
    const url = line.slice(line.indexOf(":") + 1).trim();
    expect(url, "robots.txt sitemap URL").toBe(ORIGIN + "/sitemap.xml");
  });

  it("does not hide the files assistants are meant to read", () => {
    // llms.txt and llms-full.txt exist to be fetched by assistants. Blocking
    // them would be the quietest possible way to undo docs/aeo-geo/.
    for (const path of ["/llms.txt", "/llms-full.txt", "/sitemap.xml"]) {
      for (const g of groups) {
        for (const rule of g.rules) {
          if (rule.field !== "disallow" || !rule.value) continue;
          expect(
            path.startsWith(rule.value),
            `robots.txt disallows "${rule.value}", which hides ${path}`
          ).toBe(false);
        }
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LB-36. docs/aeo-geo/keyword-cluster.md listed five shipped guides while eleven
// were live. Nobody wrote a wrong fact — the table simply stopped being updated,
// and a table that is 45% complete reads exactly like one that is 100% complete.
//
// The cost was real and specific: Yupoo (~12k/mo, the second-largest head term
// on the site, with a shipped feature behind it) sat uncovered for a day because
// the planning doc looked full. This is the inverse of every other rule in this
// file. Those stop a page from making a false claim. This one stops a doc from
// making the site look more finished than it is, which is how work gets skipped.
describe("the keyword cluster doc lists every shipped guide", () => {
  const GUIDES = join(ROOT, "preview/public/guides");
  const doc = readFileSync(join(ROOT, "docs/aeo-geo/keyword-cluster.md"), "utf8");

  const shipped = readdirSync(GUIDES, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  it("found the shipped guides", () => {
    expect(shipped.length, "no guide directories under public/guides").toBeGreaterThanOrEqual(10);
  });

  it("names every shipped guide, so no cluster looks uncovered when it is not", () => {
    const missing = shipped.filter((slug) => !doc.includes(`/guides/${slug}/`));
    expect(
      missing,
      "these guides are live but absent from docs/aeo-geo/keyword-cluster.md — add the row in the same commit that ships the page"
    ).toEqual([]);
  });

  it("does not name a guide that was never shipped", () => {
    // The other direction: a row for a page that does not exist sends a reader
    // to a 404 and marks a cluster covered when nothing covers it.
    const listed = [...doc.matchAll(/`\/guides\/([a-z0-9-]+)\/`/g)].map((m) => m[1]);
    expect(listed.length, "no guide URLs parsed out of the doc").toBeGreaterThanOrEqual(10);
    const phantom = [...new Set(listed)].filter((slug) => !shipped.includes(slug));
    expect(phantom, "docs/aeo-geo/keyword-cluster.md lists guides that do not exist").toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LB-40. The language rule stopped at the edge of preview/public/.
//
// The seventh instance of the same shape. LB-22 scoped a length floor to
// /guides/, LB-24 checked social tags on new pages only, LB-25 iterated HTML so
// llms.txt was exempt, LB-26 iterated DOCS so four shipped files were exempt,
// LB-29 left the app shell out, LB-39 left the share page out because it is a
// function. Each time the exemption was where the defect hid.
//
// Here the exemption covers the two biggest copy surfaces we own:
//
//   * credenza-fashion.jsx — every label, placeholder, button and empty state
//     in the product. It is what a user actually reads, all day.
//   * share-page.js — public HTML served to anyone with a link, and the page
//     a chat client unfurls.
//
// Negative control, 2026-07-27: replacing the search placeholder with
// "W2C best batch 1:1 replica finder" left all 1617 tests green. Doing the same
// to the share page footer left all 539 in its two files green. Both shipped.
//
// The banned list is docs/aeo-geo/ai-seo-playbook.md. It is not squeamishness:
// those phrases reframe the product from a planner into a replica catalogue,
// which is the positioning we deliberately do not take.
//
// COMMENTS ARE STRIPPED FIRST, deliberately. `// obfuscate W2C links to dodge
// automod` at credenza-fashion.jsx:1304 is correct and must stay — it explains
// why the Reddit parser handles a format it does not endorse. A rule that fired
// on it would be edited away within a day. Only what a user can read counts.
describe("the product's own words obey the language rules the pages obey", () => {
  // Same list as the shell rule above, and the playbook it comes from.
  const BANNED = ["w2c", "replica", "1:1", "best batch", "customs tips"];

  // Strip line comments, block comments, and import paths, then keep what is
  // left. Crude next to a parser, and right for the only question asked of it:
  // could a user see this string? A false negative here (a banned word hidden
  // in a template expression) is survivable; a false positive that fires on a
  // correct comment is not, because it teaches people to ignore the suite.
  function visibleText(src) {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .split("\n")
      .map((line) => line.replace(/(^|[^:])\/\/.*$/, "$1"))
      .filter((line) => !/^\s*import\s/.test(line))
      .join("\n");
  }

  const SURFACES = [
    ["credenza-fashion.jsx", join(ROOT, "credenza-fashion.jsx")],
    ["preview/netlify/functions/share-page.js", join(ROOT, "preview/netlify/functions/share-page.js")],
  ];

  for (const [label, path] of SURFACES) {
    describe(label, () => {
      const src = readFileSync(path, "utf8");
      const text = visibleText(src);

      it("has text left after the comments are stripped", () => {
        // Guard the guard. A regex that ate the whole file would make every
        // check below pass on an empty string.
        expect(text.length, `${label}: nothing survived comment stripping`).toBeGreaterThan(
          src.length / 4
        );
      });

      for (const banned of BANNED) {
        it(`never says "${banned}" where a user can read it`, () => {
          const hits = text
            .split("\n")
            .map((line, i) => [i + 1, line])
            .filter(([, line]) => line.toLowerCase().includes(banned));
          expect(
            hits.map(([n, line]) => `${label}:${n} ${line.trim()}`),
            `${label} says "${banned}" outside a comment — see docs/aeo-geo/ai-seo-playbook.md`
          ).toEqual([]);
        });
      }
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// LB-44. Every rule above reads what a page SAYS. None checked that the files
// a page ASKS FOR are there.
//
// The tenth scope defect, and the first one that is not about words at all.
// Proved 2026-07-27: renaming the landing hero to
// /landing/img/kit-jersey-black-MISSING.jpg left all 1641 tests green. That is
// a broken picture in the first screen of the page that converts, and the
// length floor, the schema parity rule, and the language rules all pass it —
// because the markup is still perfectly well-formed prose. Nothing reads the
// filesystem.
//
// The shrinking exemption, restated: LB-41 taught that bringing a file under
// test is not the same as bringing its CONTENT under test. LB-42 extended that
// to code paths, LB-43 to a rule that stopped at its first match. LB-44 names
// the axis none of them touched — the pages were under test for everything
// they SAY and for nothing they REFERENCE.
//
// Two things this rule has to know, both learned by getting them wrong:
//
// Paths resolve against public/ OR dist/. sw.js precaches "/index.html", which
// is the app shell — Vite emits it into dist/ and public/ copies over the top,
// so it exists at deploy time and not on disk here. Checking public/ alone
// reports a false miss on the one file the whole app depends on, and a false
// alarm teaches the next person to delete the rule.
//
// The manifest and the service worker count. LB-41 was the manifest being
// under test for its colours and not its prose; the same file names two icons,
// and a missing icon is an install with no picture. sw.js names its precache
// list, and a precache entry that 404s makes install() reject — which fails
// the whole service worker, not just that one file.
describe("every file a page asks for is actually there", () => {
  const DIST = join(ROOT, "preview/dist");

  // public/ is copied over dist/ at build time, so either location ships.
  const shipped = (p) => existsSync(join(PUBLIC, p)) || existsSync(join(DIST, p));

  // src/href on images, and the og:image / twitter:image content attribute,
  // which may carry the full origin. Query strings and fragments are stripped
  // because the file on disk has neither.
  const IMG = /(?:src|href)="(\/[^"?#]+\.(?:jpg|jpeg|png|webp|svg|avif|gif|ico))"/gi;
  const META = /content="(?:https:\/\/credenzafashion\.com)?(\/[^"?#]+\.(?:jpg|jpeg|png|webp|svg|avif|gif))"/gi;

  function referenced(html) {
    const out = new Set();
    for (const m of html.matchAll(IMG)) out.add(m[1]);
    for (const m of html.matchAll(META)) out.add(m[1]);
    return [...out];
  }

  // Count each matcher on its own, never the sum. The first version of this
  // guard asserted the combined total was over 20, and a probe walked through
  // it: replacing IMG with a pattern matching nothing still left 21 META hits,
  // over the threshold, and all 552 tests passed. A guard that one dead matcher
  // survives is the LB-43 shape again — the rule checked the first thing that
  // answered and stopped. So each matcher carries its own floor.
  const countWith = (re) =>
    DOCS.reduce((n, d) => n + new Set([...d.html.matchAll(re)].map((m) => m[1])).size, 0);

  it("the picture matcher still matches pictures", () => {
    const n = countWith(IMG);
    expect(n, `found ${n} src/href image references across ${DOCS.length} pages`).toBeGreaterThan(15);
  });

  it("the social-card matcher still matches social cards", () => {
    // og:image and twitter:image. Every page carries both, so this floor
    // tracks the page count rather than a guess.
    const n = countWith(META);
    expect(n, `found ${n} og:image/twitter:image references across ${DOCS.length} pages`).toBeGreaterThan(15);
  });

  for (const { rel, html } of DOCS) {
    const refs = referenced(html);
    if (!refs.length) continue;
    it(`${rel} points at pictures that exist`, () => {
      const missing = refs.filter((p) => !shipped(p.replace(/^\//, "")));
      expect(missing, `${rel} asks for ${missing.join(", ")}`).toEqual([]);
    });
  }

  it("the manifest icons exist", () => {
    const manifest = JSON.parse(readFileSync(join(PUBLIC, "manifest.webmanifest"), "utf8"));
    expect(manifest.icons.length, "a manifest with no icons installs with no picture").toBeGreaterThan(0);
    const missing = manifest.icons.map((i) => i.src).filter((p) => !shipped(p.replace(/^\//, "")));
    expect(missing, `manifest.webmanifest asks for ${missing.join(", ")}`).toEqual([]);
  });

  it("the service worker precaches only files that ship", () => {
    // A precache entry that 404s rejects install(), and the service worker
    // never activates — so one wrong path costs the whole offline mode, not
    // one asset.
    const sw = readFileSync(join(PUBLIC, "sw.js"), "utf8");
    const paths = [
      ...new Set(
        [...sw.matchAll(/["'](\/[^"']*\.(?:js|css|html|png|jpg|jpeg|webp|svg|woff2?|json|webmanifest))["']/g)].map(
          (m) => m[1]
        )
      ),
    ];
    expect(paths.length, "found no precache paths — has sw.js changed shape?").toBeGreaterThan(0);
    const missing = paths.filter((p) => !shipped(p.replace(/^\//, "")));
    expect(missing, `sw.js precaches ${missing.join(", ")}`).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LB-46. A feature the pricing page sells and no page explains.
//
// LB-45 made /pricing/ name shared links and multi-device shelves, because a
// page that omits a shipped feature under-sells it. That fixed the selling and
// created the next gap: somebody pays $4.99, looks for how the thing works, and
// the only page that mentions it is the one that took their money.
//
// The twelfth scope defect, and the third axis. LB-22 through LB-43 asked what
// a page SAYS. LB-44 asked what a page REFERENCES. This asks what the SITE
// covers — a question no single-file rule can answer, because every individual
// page is correct. /how/ was fine. /faq/ was fine. The absence lived between
// them.
//
// Proved 2026-07-27: before this rule, /how/ had eight sections explaining the
// product and neither shared links nor devices was one of them, while /pricing/
// charged for both. All 1670 tests passed.
//
// Why the pricing page cannot be its own answer. A price table is a list of
// what you get, in the fewest words that fit a cell. "Kept in step" is a cell.
// It is not an explanation of what happens to a card you add on a phone. So a
// feature is covered when a page OTHER than /pricing/ explains it, which is
// what this rule requires.
describe("a feature the price table sells is explained somewhere else", () => {
  // Each entry: the row on /pricing/ that sells it, and the phrases that mean
  // a page has actually explained it. Explaining is prose, so the match is on
  // meaning-carrying phrases rather than on a single keyword — "share" appears
  // in "share sheet" on a page about saving links from a phone, and that page
  // has explained nothing about shared haul links.
  const SOLD = [
    {
      row: "Shared haul links",
      needs: ["read-only page", "profile → shared links"],
      why: "somebody who buys 100 links has to find out how to make one",
    },
    {
      row: "Your shelf on more than one device",
      needs: ["shelf comes back", "keeps going up"],
      why: "the free half of this row is what somebody who lost a phone needs to read",
    },
    // LB-51. Added 2026-07-27 after a coverage census of every row on the price
    // table. Counting pages OTHER than /pricing/ that mention each sold feature:
    // Ask 9, link options 5, backup/restore 4, CSV 3, multi-device 2, parcel
    // planner 1. The parcel planner was the thinnest, and its one mention was a
    // /faq/ sentence naming it in a list — not an explanation of anything.
    //
    // Both phrases are the arithmetic, not the feature name. "Parcel planner"
    // would pass on any page that merely lists it, which is the state this rule
    // exists to reject. A page has explained this feature when it says which of
    // two weights you are billed on.
    {
      row: "Parcel planner",
      needs: ["volumetric weight", "chargeable weight"],
      why: "a person who enters a box size has to be told why the number went up",
    },
    // LB-52. Added 2026-07-27. The LB-51 census counted mentions; it did not
    // ask whether the mention explained anything. Re-reading the two next-
    // thinnest rows showed both mentions were the same sentence, repeated:
    // /support/ and /privacy/ each said "download your shelf as a .json file.
    // Pro also exports a .csv". That is where the buttons are, not what the
    // files hold or when to press them.
    //
    // Both rows are one job — your data leaving the app — so one page answers
    // both, and both rows are bound here so the page cannot quietly lose half
    // its subject.
    {
      row: "Backup and restore (.json)",
      needs: ["restore the same file twice", "the record of your deletions"],
      why: "a backup nobody trusts to restore is not a backup; say what a second restore does",
    },
    {
      row: "Spreadsheet export (.csv)",
      needs: ["total a haul", "price usd"],
      why: "the reason to pay for this row is a spreadsheet that adds up, which needs one currency column",
    },
    // LB-55. Added 2026-07-27. A third census, this time with chrome stripped
    // so nav and footer links could not inflate the count, and reading the
    // actual sentence behind every mention. "Link options" looked thin at 5
    // but is genuinely explained on /guides/share-a-haul-list/. "Link resolves"
    // was thin at 5 AND every one of the five was a number inside a limits
    // list: /how/, /faq/ and /privacy/ name it beside Ask and chart reads;
    // /guides/free-agent-haul-planner/ gives the rate. The price table sold
    // 20 a day against 1,000 a day for a unit the site never defined.
    //
    // Both phrases are the mechanism. "Link resolve" itself would pass on any
    // of those five limits lists. "Midnight UTC" would pass on the free-plan
    // guide, which already says it. These two say what the unit IS and what
    // the counter counts, so only a page that defines it can satisfy them.
    {
      row: "Link resolves",
      needs: ["one link in, one resolve spent", "counts server reads, not items"],
      why: "the row with the widest free/Pro gap on the table was the one unit the site never defined",
    },
    // LB-57. Added 2026-07-27. Fourth census, same method as LB-55: strip the
    // chrome, read the sentence behind every hit. Ask looked well covered at 9
    // mentions in the LB-51 count. With nav and footer removed it was four
    // sentences on three pages, and three of the four were limits lists that
    // name Ask beside chart reads and link resolves. The one real explanation
    // was a single card on /how/. The price table sells 5 a day against 200.
    //
    // Both phrases are the mechanism, not the feature name. "Ask" passes on
    // any limits list. The first says what the model actually receives — a
    // slice of your own shelf, not a catalog and not the whole shelf. The
    // second says what the counter counts, which is the row's whole subject.
    {
      row: "Ask",
      needs: ["the 25 cards closest to your question", "one press of cloud ask is one ask"],
      why: "the feature with the widest gap after link resolves had one card explaining it",
    },
    // LB-59. Added 2026-07-27. The next census after LB-58 ran the same
    // <main>-stripped count over the rows with no entry here. AI size-chart
    // reads was the thinnest: five sentences on five pages, and all five were
    // limits lists or data-processing lists. It also carries the widest ratio
    // on the whole table — 2 a day free against 100 on Pro, fifty times.
    // /guides/weidian-size-chart/ exists, but its headings show it teaches how
    // to READ a chart, not what one AI read is or what spends one.
    //
    // Both phrases are the mechanism. "Chart read" passes on any limits list.
    // The first says what the counter counts — a call, so three photos of one
    // chart are one read, which is the misunderstanding that makes 2 sound
    // small. The second says what makes the number go further: the shelf is the
    // cache, so a haul from one seller costs one read however many items it has.
    {
      row: "AI size-chart reads",
      needs: ["the unit is the call, not the image", "spends one read, not ten"],
      why: "the widest free-to-pro ratio on the table, and no page said what one read is",
    },
    // LB-60. Added 2026-07-27. The census after LB-59 ran the same
    // <main>-stripped count over the rows still with no entry here. "Cards on
    // your shelf" was the thinnest: 5 sentences across 3 pages, and every one
    // of them was the word "Unlimited" inside a table cell or a plan bullet.
    //
    // It is the only row on the table that reads the SAME on both plans, which
    // is exactly why it needed a page rather than exactly why it did not. A
    // reader who sees "Unlimited / Unlimited" assumes it is filler. It is not
    // filler, it is the shelf, and the honest version has a caveat we had
    // never written down anywhere: the browser can still run out of room.
    //
    // The three phrases are the three things a reader has to leave with.
    // The first is the promise, stated so it cannot be read as marketing —
    // verified against the source, no counter exists. The second is the
    // mechanism that makes the promise survive a full disk, and it is the
    // sentence the app itself shows when it prunes. The third is the model
    // that makes the whole thing predictable: text is free, photos are not.
    {
      row: "Cards on your shelf",
      needs: [
        "no code in credenza counts them",
        "links and notes are safe",
        "photos are what take up the room",
      ],
      why: "the only row that reads the same on both plans, so it looked like filler and went unexplained",
    },
    // LB-61. Added 2026-07-27. The census reached "Link options (unlisted,
    // expiry, no footer)" — 9 sentences over 6 pages. LB-55 had already ruled
    // it covered, because /guides/share-a-haul-list/ names all three.
    //
    // Naming them was not the problem. Verifying them was. Expiry and the
    // footer both changed what a reader got. `unlisted` was Pro-gated, stored,
    // read back, and changed NOTHING — its only consumer was a text label in
    // the owner's own private list, and the "public profile" the Share sheet
    // promised to keep the link out of does not exist anywhere in the repo.
    //
    // So this entry is not "explain the option". It is "the option now does
    // something, and the page draws the line honestly". The three phrases are
    // the line: what changes, what does not, and the sentence that stops
    // somebody buying Pro for a guarantee it was never going to give them.
    {
      row: "Link options (unlisted, expiry, no footer)",
      needs: [
        "the card a chat draws",
        "the page itself is unchanged",
        "unlisted is not a password",
      ],
      why: "one of the three options was gated and stored and did nothing, and the word promised more than the feature",
    },
  ];

  const PRICING = DOCS.find((d) => d.rel === "pricing/index.html");

  it("finds the pricing page at all", () => {
    // Guard the guard. A renamed file would make every check below vacuous,
    // and this rule reads as enforced whether or not it runs.
    expect(PRICING, "pricing/index.html is gone — has the site changed shape?").toBeTruthy();
  });

  for (const { row, needs, why } of SOLD) {
    it(`${row} is explained on a page that is not /pricing/`, () => {
      // Only enforce for rows the price table actually sells. A row deleted
      // from /pricing/ should not fail here — it should fail LB-45, which is
      // the rule that decides what belongs on the table.
      const sold = PRICING.html.includes(`<th scope="row">${row}</th>`);
      expect(sold, `/pricing/ no longer has a row named "${row}" — see LB-45`).toBe(true);

      const elsewhere = DOCS.filter((d) => d.rel !== "pricing/index.html");
      for (const phrase of needs) {
        const found = elsewhere.filter((d) => text(d.html).toLowerCase().includes(phrase));
        expect(
          found.map((d) => d.rel),
          `no page except /pricing/ says ${JSON.stringify(phrase)} — ${why}`
        ).not.toEqual([]);
      }
    });
  }

  it("the phrases it looks for are prose, not markup", () => {
    // Guard the guard, second half. Every phrase above is matched against
    // text(), so a phrase that only ever appears inside an attribute would
    // make its row pass on something no reader sees. Assert each one is
    // reachable in stripped text on the page that carries it.
    const all = SOLD.flatMap((s) => s.needs);
    expect(all.length, "no phrases to check").toBeGreaterThan(2);
    for (const phrase of all) {
      const hit = DOCS.some((d) => text(d.html).toLowerCase().includes(phrase));
      expect(hit, `${JSON.stringify(phrase)} appears in no page's visible text`).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LB-65 — the dev server must serve every public page, not the app
//
// Kyle, 2026-07-27, with a screenshot of localhost:5173/contact/ rendering the
// Credenza app: "every single page takes you here, these are not routed right".
//
// He was right, and the reason I had said otherwise the hour before is the
// whole lesson. I had curled ten addresses, seen HTTP 200 on all ten, and
// reported that every page worked. Vite's dev server answers 200 for ANY
// unmatched path, because the SPA fallback hands back the app shell. A 200
// proves that something answered. It does not prove WHAT answered.
//
// The fix is the directory-resolving middleware in vite.config.js. This rule
// guards it, and it deliberately asserts on the middleware's ability to find
// the file rather than on a status code, for exactly the reason above.
// ═══════════════════════════════════════════════════════════════════════════
describe("dev server routing", () => {
  const CONFIG = readFileSync(join(ROOT, "preview/vite.config.js"), "utf8");

  it("resolves a trailing-slash address to that folder's index.html", () => {
    // The middleware must (a) look inside public/, (b) test the file exists
    // before rewriting, and (c) rewrite to index.html. Missing (b) would turn
    // a genuine wrong address into a blank 404 instead of the app shell, which
    // is worse than the bug it replaces.
    expect(CONFIG).toMatch(/join\(__dirname, "public", [\s\S]{0,40}"index\.html"\)/);
    expect(CONFIG).toMatch(/existsSync\(candidate\)/);
    expect(CONFIG).toMatch(/req\.url = path \+ "index\.html"/);
  });

  it("runs that rewrite inside configureServer, before the SPA fallback", () => {
    // Vite installs its own fallback LAST, so any middleware registered in
    // configureServer runs first. The assertion that matters is that the
    // rewrite lives in configureServer at all — moving it to a build hook
    // would leave dev broken again.
    // swPrecache() declares closeBundle() too, and it sits ABOVE this plugin
    // in the file, so the slice must start at configureServer and search
    // forward from there — not from index 0.
    const start = CONFIG.indexOf("configureServer(server)");
    expect(start).toBeGreaterThan(-1);
    const end = CONFIG.indexOf("closeBundle()", start);
    expect(end).toBeGreaterThan(start);
    const block = CONFIG.slice(start, end);
    expect(block).toContain("existsSync(candidate)");
    expect(block.length).toBeGreaterThan(200);
  });

  it("still sends the bare root to the app, not to a page", () => {
    // /  is the app. If the directory rule ever swallowed it, opening Credenza
    // would land on a marketing page.
    expect(CONFIG).toContain('req.url === "/" || req.url === "/index.html"');
    expect(CONFIG).toContain('req.url = "/index-fashion.html"');
    // The guard that keeps the root out of the directory branch.
    expect(CONFIG).toMatch(/path\.endsWith\("\/"\) && path\.length > 1/);
  });

  it("binds the dev server to 127.0.0.1 so the numeric address answers", () => {
    // Kyle opened http://127.0.0.1:5173 and got ERR_CONNECTION_REFUSED, because
    // the default bound the IPv6 loopback ([::1]) only. Both addresses must work.
    // Not host: true — that would publish the dev server to the local network.
    //
    // Read the server: line, NOT the whole file. A mutation probe that deleted
    // the setting still passed, because the comment ABOVE it quotes the value
    // and satisfied a whole-file grep. A rule that a comment can satisfy is
    // not a rule.
    const line = CONFIG.split("\n").find((l) => l.trimStart().startsWith("server: {"));
    expect(line, "no server: { … } line in vite.config.js").toBeTruthy();
    expect(line).toContain('host: "127.0.0.1"');
    expect(line).not.toContain("host: true");
  });

  it("has a real page file behind every address the nav offers", () => {
    // The middleware can only rewrite to a file that exists. This walks the
    // nav of every page and asserts each internal address has an index.html on
    // disk — the same check the middleware makes at request time.
    const missing = [];
    for (const { rel, html } of DOCS) {
      const nav = (html.match(/<nav[\s\S]*?<\/nav>/i) || [""])[0];
      for (const m of nav.matchAll(/href="(\/[^"#?]*\/)"/g)) {
        const target = m[1];
        if (target === "/") continue;
        const file = join(PUBLIC, target.slice(1), "index.html");
        if (!existsSync(file)) missing.push(rel + " → " + target);
      }
    }
    expect(missing, "nav links with no page file behind them").toEqual([]);
  });
});
