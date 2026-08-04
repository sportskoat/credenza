// Lane B paste-parser fidelity fixes (2026-08-04 audit).
//
// The fixture is the exact Reddit blob that surfaced every Lane B bug: a
// ~50-link weidian haul post (with the comment wall and the poster's closing
// instructions) plus a GTbuy review block. One run through parseImport pins
// all of it:
//   B1  decimal star scores survive ("8.5/10" no longer saves as "5/10")
//   B2  notes cap at 500 chars on a word boundary, never mid-word
//   B3  a link-less review block is dropped, not merged into the previous card
//   B4  posterSize comes from the item header ("… Size M"), not guessed
//   B5  the poster's closing instructions glue onto no card's note
//   B6  "Purchase Link:" pastes title from the product line, not the label
//   B7  posterStats ignores title/parcel/belt numbers without body context
//   B8  a sub-10-digit Weidian id is not a buy link (honest failure, no dead
//       card)
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { clipNote, parseImport } from "../../credenza-fashion.jsx";
import { parseRedditHaul } from "../../reddit-haul.js";

const require = createRequire(import.meta.url);
const { classifyBuyLink, weidianItemId } = require("../netlify/functions/resolve.js")._test;

const FIXTURE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "fixtures/reddit-haul-paste-2026-08-04.txt"),
  "utf8"
);

const { candidates, provider, posterStats } = parseImport(FIXTURE, { fromPost: false });
const byTitle = (fragment) => candidates.find((c) => (c.titleHint || "").includes(fragment));

describe("the 2026-08-04 fixture paste", () => {
  it("parses as a reddit haul with one candidate per linked item", () => {
    expect(provider).toBe("reddit-haul");
    // 52 buy links + the repaired single-slash Yupoo link (Tom Ford glasses).
    expect(candidates.length).toBe(53);
  });

  it("B1: keeps decimal star scores intact in the saved notes", () => {
    expect(byTitle("YSL Vintage Polo").note).toContain("8.5/10");
    expect(byTitle("Ralph Lauren Vintage Japan Polo").note).toContain("9.5/10");
    expect(byTitle("Chrome Hearts Belt").note).toContain("8.5/10");
    expect(byTitle("Ralph Lauren Vintage Green Polo").note).toContain("10/10");
    // The corruption this pins: no note may read "5/10" where the poster
    // wrote "8.5/10" or "9.5/10".
    for (const c of candidates) expect(c.note || "").not.toMatch(/^\S*5\/10$/m);
    expect(byTitle("YSL Vintage Polo").note).not.toContain(" 5/10");
    expect(byTitle("Ralph Lauren Vintage Japan Polo").note).not.toContain(" 5/10");
  });

  it("B3: a review block with no working link is dropped, not merged", () => {
    // The Striped Polo block has no link at all: its header and review must
    // not glue onto the Plaid Polo's note.
    const plaid = byTitle("Ralph Lauren Plaid Polo");
    expect(plaid.note).not.toContain("Striped Polo");
    expect(plaid.note).not.toContain("Not bad at all");
    // The Tom Ford block's link was a single-slash "https:/…" — repaired, so
    // the glasses are their own card and the necklace note ends at its own
    // rating.
    const necklace = byTitle("Chrome Hearts Necklace");
    expect(necklace.note).not.toContain("Tom Ford");
    expect(necklace.note).toMatch(/8\/10$/);
    const glasses = byTitle("Tom Ford Glasses");
    expect(glasses).toBeTruthy();
    expect(glasses.parsed.url).toBe("https://lris888.x.yupoo.com/");
    expect(glasses.note).toContain("Finally my first pair of rep glasses.");
    expect(glasses.note).toContain("9/10");
  });

  it("B4: posterSize comes from the item header, and is right", () => {
    expect(byTitle("YSL Vintage Polo").posterSize).toBe("S");
    expect(byTitle("Chrome Hearts Shorts").posterSize).toBe("L");
    expect(byTitle("Mutimer Green Pleated Shorts").posterSize).toBe("M");
    // The one that stored "S" guessed from "pick a bigger size / Size up".
    expect(byTitle("Reaven Jorts").posterSize).toBe("M");
    expect(byTitle("Garms Signature Shorts").posterSize).toBe("L");
    // No size in the header, none invented from the review.
    expect(byTitle("Chrome Hearts Belt").posterSize).toBeFalsy();
    // The note keeps its fit advice: "Size up" is not eaten as a size token.
    expect(byTitle("Reaven Jorts").note).toContain("Size up");
  });

  it("B5: the poster's closing instructions glue onto no card's note", () => {
    const garms = byTitle("Garms Signature Shorts");
    expect(garms.note).not.toContain("DO THESE COMMENTS");
    expect(garms.note).not.toContain("MAKE NO CHANGES");
    expect(garms.note).not.toContain("@F");
    for (const c of candidates) {
      expect(c.note || "").not.toContain("MAKE NO CHANGES");
    }
  });

  it("B6: no card is titled after the link label", () => {
    for (const c of candidates) {
      expect(c.titleHint).not.toBe("Purchase");
      expect(c.titleHint).not.toMatch(/^(purchase|buy|order)(\s+link)?\.?$/i);
    }
  });

  it("B7: posterStats rejects title, parcel, and belt numbers", () => {
    // The fixture has no body-stats block at all: the belt's "110 cm", the
    // parcel's "12KG waiting to be shipped", and the review headers' "Size S"
    // are none of them the poster's body.
    expect(posterStats).toBeUndefined();
  });
});

describe("B1: decimal ratings are not list markers", () => {
  it("keeps dot and comma decimals through the haul parser", () => {
    const haul = parseRedditHaul(
      `**• Test Jacket (100¥) Size M**\nhttps://weidian.com/item.html?itemID=7234567890\n\nGreat jacket.\n\n8.5/10\n\n**• Test Boots (200¥)**\nhttps://weidian.com/item.html?itemID=7299887766\n\nSolid boots.\n\n9.5/10`,
      {}
    );
    expect(haul.items[0].note).toContain("8.5/10");
    expect(haul.items[1].note).toContain("9.5/10");
  });

  it("still strips real numbered-list markers", () => {
    const haul = parseRedditHaul(
      `1. CA Shirts from FireRep\nw2c => https://weidian.com/item.html?itemID=7748579664\n\n2. NFS Double Layered Longsleeve\nw2c => https://weidian.com/item.html?itemID=7644670615`,
      {}
    );
    expect(haul.items[0].label).toBe("CA Shirts from FireRep");
    expect(haul.items[1].label).toBe("NFS Double Layered Longsleeve");
  });
});

describe("B2: note truncation lands on a word boundary", () => {
  it("never cuts a word in half", () => {
    const long = "word ".repeat(200).trim(); // 999 chars, clean word grid
    const out = clipNote(long);
    expect(out.length).toBeLessThanOrEqual(500);
    expect(long.startsWith(out + " ")).toBe(true);
  });

  it("keeps short notes untouched", () => {
    expect(clipNote("fits true to size")).toBe("fits true to size");
    expect(clipNote("")).toBe("");
    expect(clipNote(null)).toBe("");
  });

  it("falls back to the hard cut for one giant word", () => {
    const blob = "x".repeat(800);
    expect(clipNote(blob)).toHaveLength(500);
  });
});

describe("B6: 'Purchase Link:' labels never title a card", () => {
  it("names the card from the product line above the link", () => {
    const haul = parseRedditHaul(
      `Cool Panda Sneakers\nPurchase Link: https://weidian.com/item.html?itemID=7234567890\n\nAnother Item Here\nPurchase Link: https://weidian.com/item.html?itemID=7299887766`,
      {}
    );
    expect(haul.items.map((i) => i.label)).toEqual(["Cool Panda Sneakers", "Another Item Here"]);
  });
});

describe("B7: body-context anchors for poster stats", () => {
  const twoLinks =
    "https://weidian.com/item.html?itemID=7234567890\nhttps://weidian.com/item.html?itemID=7299887766";

  it("ignores a haul weight in the post title and chatter", () => {
    const haul = parseRedditHaul(`10KG haul review — first time posting!\n${twoLinks}`, {});
    expect(haul.stats.weightKg).toBeUndefined();
    expect(haul.stats.heightCm).toBeUndefined();
  });

  it("ignores a belt length and a parcel weight", () => {
    const haul = parseRedditHaul(
      `Belt is great. Length is about 110 cm, u can also get the 100 cm one\nI have around 12KG waiting to be shipped\n${twoLinks}`,
      {}
    );
    expect(haul.stats.heightCm).toBeUndefined();
    expect(haul.stats.weightKg).toBeUndefined();
  });

  it("still reads a real stats block", () => {
    const haul = parseRedditHaul(`Stats: 187cm, 82kg, usually wear size L\n${twoLinks}`, {});
    expect(haul.stats).toMatchObject({ heightCm: 187, weightKg: 82, usualSize: "L" });
  });

  it("reads an adjacent height x weight pairing", () => {
    const haul = parseRedditHaul(`178 x 76, agent: superbuy\n${twoLinks}`, {});
    expect(haul.stats.heightCm).toBe(178);
    expect(haul.stats.weightKg).toBe(76);
    expect(haul.stats.agent).toBe("superbuy");
  });

  it("reads a stats label on its own line above the numbers", () => {
    const haul = parseRedditHaul(`Stats:\n182cm 80kg\n${twoLinks}`, {});
    expect(haul.stats.heightCm).toBe(182);
    expect(haul.stats.weightKg).toBe(80);
  });
});

describe("B8: Weidian id length sanity", () => {
  it("rejects obviously-wrong ids at classify time", () => {
    expect(weidianItemId("https://weidian.com/item.html?itemID=12345678")).toBe(null);
    expect(classifyBuyLink("https://weidian.com/item.html?itemID=12345678")).toBe(null);
    expect(weidianItemId("https://weidian.com/item.html?itemID=123456789")).toBe(null);
  });

  it("keeps real 10-digit ids working", () => {
    expect(weidianItemId("https://weidian.com/item.html?itemID=1234567890")).toBe("1234567890");
    expect(classifyBuyLink("https://weidian.com/item.html?itemID=7783100251")).toEqual({
      marketplace: "weidian",
      itemId: "7783100251",
    });
  });
});
