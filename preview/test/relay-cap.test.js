// The relay cap is a COST cap, not a display cap (Kyle 2026-07-26: "let's only
// bring in 6 by default they can go to the album externally for the rest").
//
// Yupoo refuses hotlinks, so every album photo crosses a Netlify function at
// full size, in and out. At 20 a single pasted album cost 20 invocations plus
// its bandwidth. Nothing in the app reads as "6" at a glance, so without these
// tests a later edit could quietly put it back to 20 and no test would notice.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { GALLERY_MAX, RELAY_MAX } from "../../credenza-fashion.jsx";
import { albumLinkTarget } from "../../components/CardMetaLinks.jsx";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

describe("relay cap", () => {
  it("relays six photos, and stores up to twenty", () => {
    // Two different budgets. RELAY_MAX bounds what we FETCH (function
    // invocations, our bill). GALLERY_MAX bounds what an item KEEPS (~32KB of
    // base64 per photo inside the item JSON). Camera shots and QC photos the
    // customer adds by hand count against GALLERY_MAX and nothing else.
    expect(RELAY_MAX).toBe(6);
    expect(GALLERY_MAX).toBe(20);
    expect(RELAY_MAX).toBeLessThan(GALLERY_MAX);
  });

  it("bounds every album relay loop on RELAY_MAX, never on GALLERY_MAX", () => {
    const src = read("credenza-fashion.jsx");
    // loadAlbumPhotos: stop asking once six are in hand, and stop relaying at six.
    expect(src).toContain("if (!albumUrl || existing.length >= RELAY_MAX)");
    expect(src).toContain("if (photos.length >= RELAY_MAX || (signal && signal.aborted)) break;");
    // enrichFashionItem: this list IS the relay loop's input, so the cap on the
    // list is the cost cap.
    expect(src).toContain("mergeFashionImages(data.images || []).slice(0, RELAY_MAX)");
  });

  it("stops the photo viewers re-asking for an album already relayed in full", () => {
    // Six relayed photos IS a complete album fetch. Comparing against
    // GALLERY_MAX here would make every open spend a round trip that can only
    // return the same six.
    for (const file of ["components/PhotoCoverFlow.jsx", "components/DesktopDetailPanel.jsx"]) {
      const src = read(file);
      expect(src).toMatch(/\.length < RELAY_MAX && onLoadPhotos/);
      expect(src).not.toMatch(/\.length < GALLERY_MAX && onLoadPhotos/);
    }
  });

  it("sends the customer to the seller's album for the photos we did not relay", () => {
    // The other half of the instruction. The link reports the album's REAL
    // count, not our stored count, so a 37-photo album never reads as a
    // 6-photo one just because we capped the relay.
    const link = albumLinkTarget({
      url: "https://mook-official.x.yupoo.com/albums/244505824",
      gallery: ["a", "b", "c", "d", "e", "f"],
      albumPhotoCount: 37,
    });
    expect(link.label).toBe("View album · 37 photos");
    expect(link.href).toContain("yupoo.com/albums/244505824");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LB-36. The cap is quoted on four public pages, and nothing bound any of them.
//
// Found by a negative control while writing /guides/yupoo-album-to-shopping-list/.
// Changing "Six album photos are copied onto the card" to "Twenty" left the
// whole suite green — including every rule above, which proves the constant and
// the code that reads it but never looks at the site.
//
// This is the same shape as LB-32 (prices) and LB-35 (plan limits), on a third
// number. The pattern is now explicit: a number that lives in one place in code
// and is RETOLD in prose needs a rule that reads the prose.
//
// It matters here in a specific way. /privacy/ says "Credenza relays 6 photos
// an album by default and caches them" — that is a statement about what leaves
// the reader's device and what we retain, in the document that governs it. A
// privacy page describing a data flow the product no longer performs is not a
// stale string; it is the wrong disclosure.
describe("the public pages quote the relay cap the app enforces", () => {
  const PUBLIC = join(ROOT, "preview/public");

  function pages(dir = PUBLIC, out = []) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) pages(full, out);
      else if (name.endsWith(".html")) out.push({ rel: relative(PUBLIC, full), html: readFileSync(full, "utf8") });
    }
    return out;
  }

  // Split on TAGS, then collapse whitespace inside each piece.
  //
  // Replacing a tag with a space joins text across element boundaries and
  // invents claims no reader can see — that defect made a pricing table read as
  // "100 QC photos" in LB-35. But splitting on newlines instead cuts a wrapped
  // <p> in half, and /guides/organize-agent-haul/ wraps mid-sentence: "up to six
  // photos onto the card, and / keeps the album link". Source line wrapping is
  // not a boundary a reader perceives; a tag is. So: tags divide, newlines join.
  const blocks = (html) =>
    html
      .replace(/<[^>]*>/g, "\u0000")
      .replace(/&[a-z]+;/g, " ")
      .split("\u0000")
      .map((b) => b.replace(/\s+/g, " ").trim())
      .filter(Boolean);

  // Both spellings ship. "six photos" reads better in a sentence, "6 photos"
  // in a policy clause, and the pages use each where it fits. A word list is
  // viable here, unlike the plan limits, because there is exactly ONE number to
  // spell rather than a whole table of them.
  const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
    "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
  const value = (token) => {
    const word = WORDS.indexOf(token.toLowerCase());
    return word >= 0 ? word : Number(token.replace(/,/g, ""));
  };

  // A number next to the word "photos" is not enough to identify the cap. Three
  // other things on the site look exactly like that:
  //
  //   /pricing/                  "12 QC photos an item"       — qcPhotosPerItem
  //   /guides/track-qc-photos/   "Free keeps 4 QC photos"     — qcPhotosPerItem
  //   /landing/                  "Chart read from 4 album photos · Jul 24"
  //
  // The first two are a different budget entirely. The third is a caption on a
  // sample timeline — it says a chart was read using 4 of the photos, which is
  // true and has nothing to do with the cap. A rule that flagged it would train
  // the next reader to edit correct copy until the test stopped complaining.
  //
  // So a claim needs a RELAYING VERB — the sentence has to say Credenza brought
  // the photos in. "read from" does not. It also has to name the album, and it
  // must not be about QC photos, which arrive from the agent and are not relayed
  // at all.
  const VERB = /\b(relays?|brings? in|bringing in|pulls?|copies|copied|fetch(?:es)?|keeps?)\b/i;
  const COUNT = new RegExp("\\b(\\d[\\d,]*|" + WORDS.join("|") + ")\\s+(?:album\\s+)?photos\\b", "gi");

  const claims = [];
  const docs = pages();
  for (const { rel, html } of docs) {
    for (const block of blocks(html)) {
      if (!VERB.test(block)) continue;
      if (!/\balbums?\b/i.test(block)) continue;
      for (const m of block.matchAll(COUNT)) {
        // "QC photos" is qcPhotosPerItem, a separate limit with its own rule.
        if (/\bQC\s*$/i.test(block.slice(0, m.index))) continue;
        claims.push({ rel, token: m[1], n: value(m[1]), block });
      }
    }
  }

  it("read the public pages and found claims to check", () => {
    // Guard the guard, twice. A reshaped public/ would empty `docs`, and a
    // rewrite that dropped the sentence from every page would empty `claims` —
    // both would turn every assertion below into a silent pass. The cap is a
    // promise about cost and retention, so it has to be stated somewhere a
    // reader can reach.
    expect(docs.length, "no public pages were read").toBeGreaterThanOrEqual(18);
    const stating = new Set(claims.map((c) => c.rel));
    expect(stating.size, `no public page says how many photos an album relays; saw ${[...stating]}`).toBeGreaterThanOrEqual(3);
  });

  it("every page quotes the cap the app enforces", () => {
    const wrong = claims.filter((c) => c.n !== RELAY_MAX);
    expect(
      wrong.map((c) => `${c.rel}: "${c.token} photos" — ${c.block.slice(0, 90)}`),
      `these pages quote a relay cap the app does not enforce (RELAY_MAX is ${RELAY_MAX})`
    ).toEqual([]);
  });
});
