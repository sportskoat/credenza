import { describe, it, expect } from "vitest";
import { parseRedditHaul } from "../../reddit-haul.js";

const WEIDIAN_A = "https://weidian.com/item.html?itemID=7234567890";
const WEIDIAN_B = "https://weidian.com/item.html?itemID=7299887766";
const TAOBAO = "https://item.taobao.com/item.htm?id=856801351597";
const YUPOO = "https://seller.x.yupoo.com/albums/172098145?uid=1";

const TYPICAL_HAUL = `5.5kg Haul Review (Superbuy) — first time posting!
https://www.reddit.com/r/FashionReps/comments/1abc123/55kg_haul_review/

Stats: 178cm, 75kg, usually wear size M
Agent: Superbuy
Total: ¥2400

**Nike Dunk Low Panda** — https://weidian.com/item.html?itemID=7234567890
Fits TTS, leather is decent for ¥190.

Stussy 8-ball tee [W2C](https://item.taobao.com/item.htm?id=856801351597)
Size up once, print is thick

[Album with QC pics](https://seller.x.yupoo.com/albums/172098145?uid=1) Mook hoodie https://weidian.com/item.html?itemID=7299887766
`;

describe("parseRedditHaul", () => {
  it("parses a typical haul comment: items, stats, poster, source", () => {
    const haul = parseRedditHaul(TYPICAL_HAUL);
    expect(haul).not.toBeNull();
    expect(haul.items).toHaveLength(3);

    const [dunks, tee, hoodie] = haul.items;
    expect(dunks.url).toBe(WEIDIAN_A);
    expect(dunks.label).toBe("Nike Dunk Low Panda");
    expect(dunks.category).toBe("shoes");
    expect(dunks.note).toContain("Fits TTS");

    expect(tee.url).toBe(TAOBAO);
    expect(tee.label).toBe("Stussy 8-ball tee");
    expect(tee.category).toBe("shirt");
    expect(tee.note).toContain("Size up once");

    // Buy link wins over the Yupoo album on the same line; album stays in rawLine
    // so the normal paired-links logic keeps them together.
    expect(hoodie.url).toBe(WEIDIAN_B);
    expect(hoodie.label).toBe("Mook hoodie");
    expect(hoodie.rawLine).toContain(YUPOO);

    expect(haul.stats).toMatchObject({ heightCm: 178, weightKg: 75, usualSize: "M", agent: "superbuy" });
    expect(haul.stats.budget).toBe(2400);
    expect(haul.sourceUrl).toContain("reddit.com/r/FashionReps/comments/");
  });

  it("parses markdown table hauls with W2C columns", () => {
    const table = `| Item | W2C | Price |
| --- | --- | --- |
| AJ4 Military Black | https://weidian.com/item.html?itemID=7234567890 | ¥320 |
| Carhartt jacket | https://item.taobao.com/item.htm?id=856801351597 | ¥155 |`;
    const haul = parseRedditHaul(table);
    expect(haul).not.toBeNull();
    expect(haul.items).toHaveLength(2);
    expect(haul.items[0].label).toBe("AJ4 Military Black");
    expect(haul.items[0].category).toBe("shoes");
    expect(haul.items[1].label).toBe("Carhartt jacket");
    expect(haul.items[1].category).toBe("outerwear");
  });

  it("converts imperial height and weight", () => {
    const haul = parseRedditHaul(`5'9, 160lbs gang
https://weidian.com/item.html?itemID=7234567890
https://weidian.com/item.html?itemID=7299887766`);
    expect(haul.stats.heightCm).toBe(175);
    expect(haul.stats.weightKg).toBe(72.6);
  });

  it("captures poster username when present", () => {
    const haul = parseRedditHaul(`review by u/haulking2024
https://weidian.com/item.html?itemID=7234567890
https://weidian.com/item.html?itemID=7299887766`);
    expect(haul.poster).toBe("haulking2024");
  });

  it("returns null for a single bare link (generic path handles it)", () => {
    expect(parseRedditHaul(WEIDIAN_A)).toBeNull();
  });

  it("returns null for prose with one link and no haul signals", () => {
    expect(parseRedditHaul("check this out " + WEIDIAN_A)).toBeNull();
  });

  it("returns null for JSON and HTML pastes (they have their own paths)", () => {
    expect(parseRedditHaul('[{"url":"' + WEIDIAN_A + '"}]')).toBeNull();
    expect(parseRedditHaul('<a href="' + WEIDIAN_A + '">x</a>')).toBeNull();
    expect(parseRedditHaul("")).toBeNull();
    expect(parseRedditHaul(null)).toBeNull();
  });

  it("accepts a single item when reddit provenance exists", () => {
    const haul = parseRedditHaul(`https://www.reddit.com/r/FashionReps/comments/xyz/small_haul/
only copped one thing: https://weidian.com/item.html?itemID=7234567890`);
    expect(haul).not.toBeNull();
    expect(haul.items).toHaveLength(1);
  });

  it("does not let stats lines leak into review snippets", () => {
    const haul = parseRedditHaul(`Stats: 180cm 80kg size L
https://weidian.com/item.html?itemID=7234567890
weight: 80kg
great blank, heavy fabric
https://weidian.com/item.html?itemID=7299887766`);
    expect(haul.items[0].note).toBe("great blank, heavy fabric");
  });

  it("ignores non-shoppable urls as items but keeps shoppable ones", () => {
    const haul = parseRedditHaul(`guide: https://example.com/how-to-order
shoes https://weidian.com/item.html?itemID=7234567890
https://weidian.com/item.html?itemID=7299887766`);
    expect(haul.items).toHaveLength(2);
  });

  // Kyle's 2026-07-22 report: r/FashionReps in-hand reviews put the item block
  // ("Name (Size) - review…") ABOVE the W2C line. Every card used to inherit
  // the NEXT item's name+review as its note.
  const IN_HAND_POST = `In-hand review + fit pics (Kith, Adidas, Vans, Balenciaga)

Adidas CNY Tang Jacket (Size M) - Buttery smooth fabric, love the colour. Logo is embroidered and looks accurate. Fits TTS, one thing to notice is it's a bit tight around the bottom when zipped up.
W2C: https://weidian.com/item.html?itemID=7649592219

⸻

Vans Old Skool 36 Souvenir (EU42.5, TOP Batch) - Fits like any other Old Skool. The pins make them look really cool and the colour stands out in person. The stitching on the toe box is a bit disappointing though, could've been better. Fits TTS.
W2C: https://shop1850859027.v.weidian.com/item.html?itemID=7808837642

⸻

Balenciaga Jeans (Size S) - Love the washed black finish and how they fit. They stack nicely on shoes, not too long or too wide which is perfect for me. Fits TTS.
W2C: https://weidian.com/item.html?itemID=7774752570

⸻

NB Fresh Foam X More v5 (EU43) - Such a comfortable running shoes, very lightweight and responsive. I'd say they're on par with the Evo SL in terms of running. Went half a size up and they fit perfectly.
W2C: https://weidian.com/item.html?itemID=7799270900`;

  it("attributes name-above-link blocks to the RIGHT item (Kyle's post)", () => {
    const haul = parseRedditHaul(IN_HAND_POST);
    expect(haul).not.toBeNull();
    expect(haul.items).toHaveLength(4);

    const [jacket, vans, jeans, foams] = haul.items;
    expect(jacket.url).toBe("https://weidian.com/item.html?itemID=7649592219");
    expect(jacket.label).toBe("Adidas CNY Tang Jacket (Size M)");
    expect(jacket.note).toContain("Buttery smooth fabric");
    expect(jacket.note).toContain("tight around the bottom");
    expect(jacket.category).toBe("outerwear");

    expect(vans.url).toBe("https://shop1850859027.v.weidian.com/item.html?itemID=7808837642");
    expect(vans.label).toBe("Vans Old Skool 36 Souvenir (EU42.5, TOP Batch)");
    expect(vans.note).toContain("Fits like any other Old Skool");
    expect(vans.note).not.toContain("Balenciaga");
    expect(vans.category).toBe("shoes");

    expect(jeans.label).toBe("Balenciaga Jeans (Size S)");
    expect(jeans.note).toContain("washed black finish");
    expect(jeans.note).not.toContain("Fresh Foam");
    expect(jeans.category).toBe("pants");

    expect(foams.label).toBe("NB Fresh Foam X More v5 (EU43)");
    expect(foams.note).toContain("comfortable running shoes");
    expect(foams.category).toBe("shoes");

    // Nothing leaks the post title into an item.
    expect(haul.items.some((it) => /In-hand review/i.test(it.label + " " + it.note))).toBe(false);
  });

  it("handles the same format pasted without blank lines or separators", () => {
    const haul = parseRedditHaul(`Vans Old Skool 36 Souvenir (EU42.5, TOP Batch) - Fits like any other Old Skool.
W2C: https://shop1850859027.v.weidian.com/item.html?itemID=7808837642
Balenciaga Jeans (Size S) - Love the washed black finish and how they fit.
W2C: https://weidian.com/item.html?itemID=7774752570`);
    expect(haul).not.toBeNull();
    expect(haul.items).toHaveLength(2);
    expect(haul.items[0].label).toBe("Vans Old Skool 36 Souvenir (EU42.5, TOP Batch)");
    expect(haul.items[0].note).toContain("Fits like any other Old Skool");
    expect(haul.items[0].note).not.toContain("Balenciaga");
    expect(haul.items[1].label).toBe("Balenciaga Jeans (Size S)");
  });

  it("takes a bare product name on the line above the link as the label", () => {
    const haul = parseRedditHaul(`https://weidian.com/item.html?itemID=7234567890

Nike Dunk Low Panda
https://weidian.com/item.html?itemID=7299887766`);
    expect(haul.items[1].label).toBe("Nike Dunk Low Panda");
    expect(haul.items[0].note).toBe("");
  });

  it("keeps review chatter above a bare link with the previous item", () => {
    const haul = parseRedditHaul(`https://weidian.com/item.html?itemID=7234567890
Great blank, heavy fabric. Went one size up and it drapes perfectly.
https://weidian.com/item.html?itemID=7299887766`);
    expect(haul.items[0].note).toContain("Great blank");
    expect(haul.items[1].label).toBe("");
  });

  it("splits a name line from its review lines when the block sits above the link", () => {
    const haul = parseRedditHaul(`https://item.taobao.com/item.htm?id=856801351597

Stussy 8-ball tee
Size up once, print is thick
https://weidian.com/item.html?itemID=7234567890`);
    expect(haul.items[1].label).toBe("Stussy 8-ball tee");
    expect(haul.items[1].note).toContain("Size up once");
    expect(haul.items[0].note).toBe("");
  });

  it("never turns a post title into the first item's label", () => {
    const haul = parseRedditHaul(`5.5kg Haul Review (Superbuy) — first time posting!
https://weidian.com/item.html?itemID=7234567890
https://weidian.com/item.html?itemID=7299887766`);
    expect(haul.items[0].label).not.toContain("Haul Review");
  });

  it("repairs space-obfuscated W2C links (Kyle's 2026-07-23 paste)", () => {
    const haul = parseRedditHaul(`W2C links:

404 hat: https://de tail.1688.com/offer/940644075601.html

Seamless Gym tee: https://it em.taobao.com/item.htm?id=752339164885

Stussy tee: Dead link

Black jeans: https:/ /item. ta oba o.co m /item.htm?id=902046907188

Waverunners: https://rep sunofficial.x.yupoo.com/albums/195089624?uid=1&isSubCate=false&referrercate=4716905

LJR TS: - https://repsuno fficial.x.yupoo.com/albums/202074183?uid=1&isSubCate=false&referrercate=5165137

Bag: Repsun dead link`);
    expect(haul).not.toBeNull();
    expect(haul.items).toHaveLength(5);
    expect(haul.items[0].url).toBe("https://detail.1688.com/offer/940644075601.html");
    expect(haul.items[0].label).toBe("404 hat");
    expect(haul.items[0].category).toBe("hat");
    expect(haul.items[1].url).toBe("https://item.taobao.com/item.htm?id=752339164885");
    expect(haul.items[2].url).toBe("https://item.taobao.com/item.htm?id=902046907188");
    expect(haul.items[2].label).toBe("Black jeans");
    expect(haul.items[3].url).toContain("repsunofficial.x.yupoo.com/albums/195089624");
    expect(haul.items[4].url).toContain("repsunofficial.x.yupoo.com/albums/202074183");
    expect(haul.items[4].label).toBe("LJR TS");
  });

  it("does not glue prose onto a complete URL", () => {
    const haul = parseRedditHaul(`https://weidian.com/item.html?itemID=7234567890 is the batch I GP'd
https://weidian.com/item.html?itemID=7299887766`);
    expect(haul.items[0].url).toBe("https://weidian.com/item.html?itemID=7234567890");
  });
});
