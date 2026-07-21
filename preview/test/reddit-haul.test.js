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
    expect(tee.category).toBe("tees");
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
});
