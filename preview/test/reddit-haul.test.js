import { describe, it, expect } from "vitest";
import { parseRedditHaul, structureItemFields } from "../../reddit-haul.js";
import hardCases from "./fixtures/reddit-haul/hard-cases.json";

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

describe("structureItemFields", () => {
  it("extracts French taille and poids from a note", () => {
    const s = structureItemFields({
      note: "Taille : EU 43.5\nPoids : 850g\nAvis : Matériaux de qualité.",
    });
    expect(s.posterSize).toBe("EU 43.5");
    expect(s.weightGrams).toBe(850);
    expect(s.note).toMatch(/Matériaux/i);
    expect(s.note).not.toMatch(/^Taille/i);
  });

  it("extracts English took-size and fit chatter", () => {
    const s = structureItemFields({
      note: "I took size M and its pretty baggy, probably size down once.",
    });
    expect(s.posterSize).toBe("M");
    expect(s.sizeNotes).toMatch(/baggy|size down/i);
  });
});

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

  // Kyle's failing paste, 2026-07-24: a copied QC post body whose only buy
  // link is an agent short link. Before the fix this parsed to NOTHING (agent
  // links were invisible) and fell through to a junk "W2C" card.
  it("parses a single-item QC post body with an agent short link", () => {
    const haul = parseRedditHaul(`QC NB 9060 TOP batch,what do you think?
This is my second pair, they look good imo.
W2C
https://k.youshop10.com/=m6BAxbZ`);
    expect(haul).not.toBeNull();
    expect(haul.items).toHaveLength(1);
    const [item] = haul.items;
    expect(item.url).toBe("https://k.youshop10.com/=m6BAxbZ");
    expect(item.label).toBe("NB 9060 TOP batch");
    expect(item.category).toBe("shoes");
    expect(item.note).toContain("what do you think?");
    expect(item.note).toContain("second pair");
  });

  it("treats agent links as items and ranks marketplace links above them", () => {
    // Agent link alone carries an item.
    const haul = parseRedditHaul(`Kakobuy finds
https://www.kakobuy.com/item/details?qr=ABC123
https://mulebuy.com/product/?id=7234567890&shop_type=weidian`);
    expect(haul).not.toBeNull();
    expect(haul.items).toHaveLength(2);

    // Marketplace beats agent when both sit on one line.
    const both = parseRedditHaul(`Dunks https://www.superbuy.com/en/page/buy?url=x https://weidian.com/item.html?itemID=7234567890
https://weidian.com/item.html?itemID=7299887766`);
    expect(both.items[0].url).toBe(WEIDIAN_A);
  });

  it("still returns null for a single bare agent link", () => {
    expect(parseRedditHaul("https://k.youshop10.com/=m6BAxbZ")).toBeNull();
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

// ————— 2026-07-24 FashionReps corpus regressions ————————————————————————————
// Real posts from r/FashionReps/hot (scripts/corpus-fashionreps.json). The app
// fetches a post server-side and calls parseRedditHaul with its title and
// certain provenance — these tests pin that call shape.
describe("corpus: real FashionReps posts", () => {
  it("names a single-link QC post from its title (Gats post)", () => {
    const haul = parseRedditHaul(
      `Hi goats, whats up, after a long time buying Gats from several sellers, i heard about Goat made a new batch, and i give it a try, for me looks really solid, i intend to bring a review in a batch fight, it looks really nice to me, the only flaw i notice is on the midsole, the suede looks good, materials i dont have sure but looks good too. At all is worth the price, mainly for who have friends to resell or things like that  
W2c: [https://weidian.com/item.html?itemID=7785888265](https://weidian.com/item.html?itemID=7785888265)`,
      { title: "[QC]Maison Margiela Gats - GOAT Batch", fromPost: true }
    );
    expect(haul).not.toBeNull();
    expect(haul.items).toHaveLength(1);
    expect(haul.items[0].label).toBe("Maison Margiela Gats");
    expect(haul.items[0].url).toBe("https://weidian.com/item.html?itemID=7785888265");
    expect(haul.items[0].note).toContain("midsole");
  });

  it("parses the 'Name: review' colon format (15kg GTBuy haul)", () => {
    const haul = parseRedditHaul(
      `Hello guys, welcome to my latest haul review. 

My stats: 80kg, 182cm

Goyard bag: good quality, the material is thinner than it should be, but its not really noticeable without touching it

[https://weidian.com/item.html?itemID=7734454224](https://weidian.com/item.html?itemID=7734454224)

Supreme jacket: the letters are not completely aligned when buttoned up

[https://weidian.com/item.html?itemID=7594655800](https://weidian.com/item.html?itemID=7594655800)`,
      { title: "15kg haul to EU with GTBuy (Goyard, Supreme)", fromPost: true }
    );
    expect(haul).not.toBeNull();
    expect(haul.items).toHaveLength(2);
    expect(haul.items[0].label).toBe("Goyard bag");
    expect(haul.items[0].note).toContain("good quality");
    expect(haul.items[1].label).toBe("Supreme jacket");
    expect(haul.items[1].category).toBe("outerwear");
  });

  it("sees a mycnbox agent link as the item (Pink Supreme Timberlands)", () => {
    const haul = parseRedditHaul(
      `Can I get a QC on this? I feel like the pink is too bright and the sole is not dark enough. Any extra input is appreciated.  
[https://mycnbox.com/goodsDetail?mallType=taobao&itemId=956867492270&referId=LHWYFH](https://mycnbox.com/goodsDetail?mallType=taobao&itemId=956867492270&referId=LHWYFH)`,
      { title: "Pink Supreme Timberlands QC", fromPost: true }
    );
    expect(haul).not.toBeNull();
    expect(haul.items).toHaveLength(1);
    expect(haul.items[0].label).toBe("Pink Supreme Timberlands");
    expect(haul.items[0].url).toContain("mycnbox.com/goodsDetail");
  });

  it("treats a tb.cn short link as taobao (White and Red Prems)", () => {
    const haul = parseRedditHaul(
      `WTC: [https://e.tb.cn/h.8dc1amR9VgaYcUf?tk=Arnmguovt6x](https://e.tb.cn/h.8dc1amR9VgaYcUf?tk=Arnmguovt6x)`,
      { title: "White and Red Prems", fromPost: true }
    );
    expect(haul).not.toBeNull();
    expect(haul.items).toHaveLength(1);
    expect(haul.items[0].label).toBe("White and Red Prems");
  });

  it("repairs a space-broken weidian link with a reddit \\_ escape (KZ J4 post)", () => {
    const haul = parseRedditHaul(
      `Everything I post is for informational and/or educational purposes only.

KZ 2.0 batch

W2C; TMF

Telegram; +86 137 3542 8664

https:// shop1809267573.v.weidian.com/item.html?itemID=7430918278&spider\\_token=1625`,
      { title: "QC - KZ 2.0 J4 Bred Reimagined - TMF - 260cny", fromPost: true }
    );
    expect(haul).not.toBeNull();
    expect(haul.items).toHaveLength(1);
    expect(haul.items[0].url).toBe(
      "https://shop1809267573.v.weidian.com/item.html?itemID=7430918278&spider_token=1625"
    );
    expect(haul.items[0].label).toBe("KZ 2.0 J4 Bred Reimagined");
  });

  it("never cards an agent register/invite link (Recent pickups post)", () => {
    const haul = parseRedditHaul(
      `Cssbuy agent: https://www.cssbuy.com/register?invite=c2luaHVzaW5odw==

Nike shirt: https://weidian.com/item.html?itemID=7628330811

Patta shirt: https://weidian.com/item.html?itemID=7648743224`,
      { title: "Recent pickups", fromPost: true }
    );
    expect(haul).not.toBeNull();
    expect(haul.items).toHaveLength(2);
    expect(haul.items.every((i) => !i.url.includes("register"))).toBe(true);
  });

  it("joins a yupoo root link with its detached album path (Husky-reps post)", () => {
    const haul = parseRedditHaul(
      `[https://huskyreps.x.yupoo.com/](https://huskyreps.x.yupoo.com/) albums/212594120?uid=1

(Remove space or check yupoo discord logo)

[alaskareps.x.yupoo.com](http://alaskareps.x.yupoo.com)`,
      { title: "Husky-reps new drop", fromPost: true }
    );
    expect(haul).not.toBeNull();
    expect(haul.items[0].url).toBe("https://huskyreps.x.yupoo.com/albums/212594120?uid=1");
    expect(haul.items.every((i) => !i.label.startsWith("("))).toBe(true);
  });

  it("keeps 'Yupoo:'-prefixed links with no space (SLP Sneakers post)", () => {
    const haul = parseRedditHaul(`Yupoo:https://anontop.x.yupoo.com/albums/247011875?uid=1`, {
      title: "SLP Smoking Forever Sneakers by Anon size 42",
      fromPost: true,
    });
    expect(haul).not.toBeNull();
    expect(haul.items).toHaveLength(1);
    expect(haul.items[0].label).toBe("SLP Smoking Forever Sneakers by Anon size 42");
    expect(haul.items[0].category).toBe("shoes");
  });

  it("names 'QC on these …' titles without the deictic filler (Birkenstock)", () => {
    const haul = parseRedditHaul(
      `Does anyone know what the extra yellow rubber is for?

W2C: [https://k.youshop10.com/abHdHWuH](https://k.youshop10.com/abHdHWuH)`,
      { title: "QC on these Birkenstock shoes, looks good?", fromPost: true }
    );
    expect(haul).not.toBeNull();
    expect(haul.items).toHaveLength(1);
    expect(haul.items[0].label).toBe("Birkenstock shoes");
    expect(haul.items[0].category).toBe("shoes");
    expect(haul.items[0].label).not.toMatch(/^on these/i);
  });

  it("does not title a card from a question-only post title (99team)", () => {
    const haul = parseRedditHaul(
      `I ordered God batch from them before. https://99team.x.yupoo.com/categories/890341?isSubCate=true`,
      {
        title: "Any one ordered S batch 99team? The price seems too good to be true.",
        fromPost: true,
      }
    );
    expect(haul).not.toBeNull();
    expect(haul.items).toHaveLength(1);
    // Prefer empty over the full question sentence.
    expect(haul.items[0].label).not.toMatch(/any one ordered/i);
    expect(haul.items[0].label).not.toMatch(/\?/);
  });

  it("drops redundant yupoo roots when an album for the same host exists (Husky)", () => {
    const haul = parseRedditHaul(
      `[https://huskyreps.x.yupoo.com/](https://huskyreps.x.yupoo.com/) albums/212594120?uid=1

(Remove space or check yupoo discord logo)

[huskyreps.x.yupoo.com](http://huskyreps.x.yupoo.com)

[alaskareps.x.yupoo.com](http://alaskareps.x.yupoo.com)`,
      {
        title: "Husky-reps🔥 Guys, I'm bringing my most proud product: 🔥TNF 96n*pt*e",
        fromPost: true,
      }
    );
    expect(haul).not.toBeNull();
    // Album kept; husky root dropped; alaska root kept (different host).
    expect(haul.items.some((i) => /albums\/212594120/.test(i.url))).toBe(true);
    expect(haul.items.every((i) => i.url !== "http://huskyreps.x.yupoo.com")).toBe(true);
    expect(haul.items.every((i) => i.url !== "https://huskyreps.x.yupoo.com")).toBe(true);
    // Title pulls a short product head after the colon, not the promo sentence.
    const album = haul.items.find((i) => /albums\/212594120/.test(i.url));
    expect(album.label).toMatch(/TNF/i);
    expect(album.label).not.toMatch(/guys/i);
    expect(album.label).not.toMatch(/sorry|absent|winter/i);
    expect(album.label.split(/\s+/).length).toBeLessThanOrEqual(8);
  });

  it("never cards WhatsApp / Telegram as the product label", () => {
    const haul = parseRedditHaul(
      `SS Final batch comparison.

[Album](https://swagsupply.x.yupoo.com/albums/241175054?uid=1)

WhatsApp
https://swagsupply.x.yupoo.com/`,
      { title: "[SwagSupply] AP x Swatch Royal Pop Comparison", fromPost: true }
    );
    expect(haul).not.toBeNull();
    expect(haul.items.every((i) => !/whats\s?app/i.test(i.label || ""))).toBe(true);
  });

  it("repairs Reddit phone-autolinked weidian item ids (GTBuy tel: paste)", () => {
    const haul = parseRedditHaul(
      `Mertra tee: ok
https://weidian.com/item.html?itemID=7786852242

white https://weidian.com/item.html?itemID=[7779496523](tel:7779496523)
tokyo https://weidian.com/item.html?itemID=[7475427829](tel:7475427829)`,
      { title: "15kg haul to EU with GTBuy", fromPost: true }
    );
    expect(haul).not.toBeNull();
    expect(haul.items).toHaveLength(3);
    expect(haul.items[1].url).toBe("https://weidian.com/item.html?itemID=7779496523");
    expect(haul.items[1].label).toBe("white");
    expect(haul.items[2].url).toBe("https://weidian.com/item.html?itemID=7475427829");
    expect(haul.items[2].label).toBe("tokyo");
    expect(haul.items.every((i) => !/tel:|\]\(/.test(i.label + i.url))).toBe(true);
  });
});

// Golden hard-case fixtures (frozen from the 22-post FashionReps corpus).
describe("fixtures: reddit-haul hard cases", () => {
  for (const c of hardCases) {
    it(c.id, () => {
      const haul = parseRedditHaul(c.selftext, { title: c.title, fromPost: true });
      if (c.expect === null) {
        expect(haul).toBeNull();
        return;
      }
      expect(haul).not.toBeNull();
      expect(haul.items).toHaveLength(c.expect.itemCount);
      c.expect.items.forEach((exp, i) => {
        expect(haul.items[i].label).toBe(exp.label);
        expect(haul.items[i].url).toContain(exp.urlContains.replace(/\/$/, ""));
      });
    });
  }
});

describe("numbered article lists with meta lines (HIPOBUY French post, 2026-07-25)", () => {
  const POST = `Salut tout le monde, c'est mon premier partage de haul.

👕 Article 1 : Ensemble Nike Dri-Fit (Crystal strip blue)

Taille : M

Lien : https://detail.1688.com/offer/979306730970.html

Avis (9/10) : Vraiment impressionnant. Le tissu est identique au retail Dri-Fit.

🟢 Article 2 : Ensemble Nike Dri-Fit (Crystal strip green + Short noir)

Taille : M

Lien : https://detail.1688.com/offer/1060925829329.html

Avis (9.5/10) : Mon coloris préféré pour l'été !`;

  it("names items from 'Article N : <name>' headers, never from meta keys", () => {
    const haul = parseRedditHaul(POST, {
      title: "Haul 1ère commande vers la France (2.1KG) via HIPOBUY",
      fromPost: true,
    });
    expect(haul).not.toBeNull();
    expect(haul.items).toHaveLength(2);
    expect(haul.items[0].label).toBe("Ensemble Nike Dri-Fit (Crystal strip blue)");
    expect(haul.items[1].label).toBe("Ensemble Nike Dri-Fit (Crystal strip green + Short noir)");
    // "Taille : M" is an attribute — structured out of the free-text note.
    expect(haul.items.every((i) => i.label !== "Taille")).toBe(true);
    expect(haul.items[0].posterSize).toBe("M");
    expect(haul.items[1].posterSize).toBe("M");
    // The previous item's review stays with the previous item.
    expect(haul.items[0].note).toContain("Vraiment impressionnant");
    expect(haul.items[1].note).not.toContain("Vraiment impressionnant");
    // French "Ensemble" maps to the shirt category vocabulary.
    expect(haul.items[0].category).toBe("shirt");
  });

  it("structures size, weight, and fit from meta lines", () => {
    const haul = parseRedditHaul(
      `Article 1 : Baskets ASICS (Demange nyc blue)

Taille : EU 43.5
Poids : 850g
Lien : https://detail.1688.com/offer/979306730970.html
Avis : Matériaux de qualité, super forme.`,
      { title: "Haul FR", fromPost: true }
    );
    expect(haul).not.toBeNull();
    expect(haul.items).toHaveLength(1);
    expect(haul.items[0].label).toMatch(/ASICS/i);
    expect(haul.items[0].category).toBe("shoes");
    expect(haul.items[0].posterSize).toBe("EU 43.5");
    expect(haul.items[0].weightGrams).toBe(850);
  });

  it("splits next Name - review when prior review is still pending", () => {
    const haul = parseRedditHaul(
      `Goyard bag - good quality, the material is thinner than it should be.
https://weidian.com/item.html?itemID=1111111111

Supreme jacket - the letters are not completely aligned when buttoned up.
https://weidian.com/item.html?itemID=2222222222`,
      { title: "15kg haul review", fromPost: true }
    );
    expect(haul).not.toBeNull();
    expect(haul.items).toHaveLength(2);
    expect(haul.items[0].label).toBe("Goyard bag");
    expect(haul.items[1].label).toBe("Supreme jacket");
    expect(haul.items[0].note).toMatch(/thinner/i);
    expect(haul.items[1].note).toMatch(/letters/i);
    expect(haul.items[0].note).not.toMatch(/Supreme jacket/i);
  });

  it("does not stamp a batch haul title onto every unlabeled multi-item card", () => {
    const haul = parseRedditHaul(
      `https://weidian.com/item.html?itemID=1111111111

https://weidian.com/item.html?itemID=2222222222`,
      { title: "15kg haul to EU with GTBuy (Goyard, Supreme)", fromPost: true }
    );
    expect(haul).not.toBeNull();
    expect(haul.items).toHaveLength(2);
    expect(haul.items.every((i) => !/15kg|haul to EU/i.test(i.label || ""))).toBe(true);
  });

  it("strips trailing (QC) flair from product titles", () => {
    const haul = parseRedditHaul(
      `Looks solid in hand.

W2C: https://weidian.com/item.html?itemID=3333333333`,
      { title: "Maison Margiela Gats (QC)", fromPost: true }
    );
    expect(haul).not.toBeNull();
    expect(haul.items).toHaveLength(1);
    expect(haul.items[0].label).toBe("Maison Margiela Gats");
    expect(haul.items[0].label).not.toMatch(/\(QC\)/i);
  });

  it("structures English 'I took size M' into posterSize + sizeNotes", () => {
    const haul = parseRedditHaul(
      `ERD hoodie - not the most accurate batch, but for the price its very good. I took size M and its pretty baggy, probably size down.
https://weidian.com/item.html?itemID=4444444444`,
      { title: "Small haul", fromPost: true }
    );
    expect(haul).not.toBeNull();
    expect(haul.items[0].posterSize).toBe("M");
    expect(haul.items[0].sizeNotes).toMatch(/baggy|size down|size M/i);
    expect(haul.items[0].category).toBe("outerwear");
  });

  it("exposes fromPost and title on the haul result", () => {
    const haul = parseRedditHaul(
      `QC: https://weidian.com/item.html?itemID=5555555555`,
      { title: "NB 9060 TOP batch", fromPost: true }
    );
    expect(haul).not.toBeNull();
    expect(haul.fromPost).toBe(true);
    expect(haul.title).toBe("NB 9060 TOP batch");
  });

  // Numbered haul with "w2c =>" + space-obfuscated hosts (Shiba 25kg Fansbuy).
  it("names numbered items above w2c => obfuscated links (Fansbuy Germany haul)", () => {
    const haul = parseRedditHaul(
      `Hi yall Shiba is back with another Review! This time ive shipped another 20KG with Fansbuy, ive only paid 226$. Lets Go!

1. CA Shirts from FireRep

w2c => https://wei dian.com/item.html?itemID=7748579664

They are a bit thicker than the usual shirts but the quality is amazing!

2. NFS Double Layered Longsleeve from badmoodclub

w2c => https://item. tao bao .com/item.htm?id=848112030507

I decided between PV and badmoodclub but a good friend recommended me buying them from badmoodclub and damn the quality is hella good.

3. Remagine Derby/Sneaker

w2c => https://item. tao bao .com/item.htm?id=938429780729

Quality on those are on point, you can size down twice.

4. VNS Souvenir | DOG Batch from ElderlyDogs

w2c => https://wei dian.com/item.html?itemID=7644670615

They are fine for the price, just size down.`,
      { title: "Review 25KG Haul to Germany Fansbuy", fromPost: true }
    );
    expect(haul).not.toBeNull();
    expect(haul.items).toHaveLength(4);
    expect(haul.items[0].label).toBe("CA Shirts from FireRep");
    expect(haul.items[0].url).toBe("https://weidian.com/item.html?itemID=7748579664");
    expect(haul.items[0].category).toBe("shirt");
    expect(haul.items[0].note).toMatch(/thicker/i);
    expect(haul.items[0].note).not.toMatch(/NFS Double/i);
    expect(haul.items[1].label).toBe("NFS Double Layered Longsleeve from badmoodclub");
    expect(haul.items[1].url).toBe("https://item.taobao.com/item.htm?id=848112030507");
    expect(haul.items[1].category).toBe("shirt");
    expect(haul.items[2].label).toBe("Remagine Derby/Sneaker");
    expect(haul.items[2].category).toBe("shoes");
    expect(haul.items[2].sizeNotes).toMatch(/size down/i);
    expect(haul.items[3].label).toMatch(/VNS Souvenir/i);
    expect(haul.items[3].label).toMatch(/ElderlyDogs/i);
    // Batch haul title must not stamp onto every card.
    expect(haul.items.every((i) => !/25KG|Germany/i.test(i.label || ""))).toBe(true);
    // "20KG with Fansbuy" is the PARCEL weight in review chatter, not the
    // poster's body weight. Body-anchored stats (2026-08-04) refuse it.
    expect(haul.stats.weightKg).toBeUndefined();
  });
});
