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
    const urls = new Set(PAGES.map((p) => p.url));
    for (const loc of listed) {
      if (loc === "/") continue; // the app itself, not a file under public/
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
  // HUBS are link lists. Their job is to route, not to answer, so they get a
  // lower floor — high enough that an empty hub still fails.
  const HUBS = new Set(["/guides/"]);

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
