// Kyle 2026-08-03, saved shirt from Yupoo seller mook-official: "it's not
// pulling that album for that shirt. It's just pulling the actual seller's
// profile and not the album."
//
// A seller's front page holds every item the seller sells. Reading it for one
// shirt's size chart finds nothing, then blames the photo. So an address only
// counts as an album when it names one: /albums/<number>.
import { describe, expect, it } from "vitest";
import {
  isYupooAlbumUrl,
  isYupooUrl,
  yupooAlbumUrl,
  yupooAnyUrl,
} from "../../credenza-fashion.jsx";

const ALBUM = "https://mook-official.x.yupoo.com/albums/240336011";
const SELLER = "https://mook-official.x.yupoo.com/";
const SEARCH = "https://mook-official.x.yupoo.com/search/albums?q=tee";
const WEIDIAN = "https://weidian.com/item.html?itemID=7799763843";

describe("isYupooUrl", () => {
  it("says yes to any address on a Yupoo host", () => {
    expect(isYupooUrl(ALBUM)).toBe(true);
    expect(isYupooUrl(SELLER)).toBe(true);
    expect(isYupooUrl(SEARCH)).toBe(true);
  });

  it("says no to another host and to nonsense", () => {
    expect(isYupooUrl(WEIDIAN)).toBe(false);
    expect(isYupooUrl("not a url")).toBe(false);
    expect(isYupooUrl("")).toBe(false);
    // A host that merely ends in the same letters is not Yupoo.
    expect(isYupooUrl("https://notyupoo.com/albums/1")).toBe(false);
  });
});

describe("isYupooAlbumUrl", () => {
  it("says yes only when the address names one album", () => {
    expect(isYupooAlbumUrl(ALBUM)).toBe(true);
    expect(isYupooAlbumUrl(ALBUM + "?uid=1")).toBe(true);
  });

  it("says no to the seller's own front page", () => {
    expect(isYupooAlbumUrl(SELLER)).toBe(false);
    expect(isYupooAlbumUrl(SEARCH)).toBe(false);
  });

  it("says no to an album path on another host", () => {
    expect(isYupooAlbumUrl("https://example.com/albums/240336011")).toBe(false);
  });
});

describe("yupooAlbumUrl", () => {
  it("finds the album on the item's own address", () => {
    expect(yupooAlbumUrl({ url: ALBUM })).toBe(ALBUM + "?uid=1");
  });

  it("finds the album on a paired link", () => {
    const item = { url: WEIDIAN, links: [{ url: ALBUM, role: "photos" }] };
    expect(yupooAlbumUrl(item)).toBe(ALBUM + "?uid=1");
  });

  it("finds the album on a shop host the resolver attached", () => {
    expect(yupooAlbumUrl({ url: WEIDIAN, sellerYupooLinks: [ALBUM] })).toBe(ALBUM + "?uid=1");
  });

  it("returns nothing for a seller's front page", () => {
    // This is the fault Kyle saw. The chart reader asked for an album, got the
    // whole shop, read it, and found no chart for this one shirt.
    expect(yupooAlbumUrl({ url: SELLER })).toBe(null);
    expect(yupooAlbumUrl({ url: WEIDIAN, links: [{ url: SELLER, role: "photos" }] })).toBe(null);
    expect(yupooAlbumUrl({ url: WEIDIAN, sellerYupooLinks: [SELLER] })).toBe(null);
  });

  it("returns nothing for an item with no Yupoo address at all", () => {
    expect(yupooAlbumUrl({ url: WEIDIAN })).toBe(null);
    expect(yupooAlbumUrl(null)).toBe(null);
  });
});

describe("yupooAnyUrl", () => {
  it("takes a seller's front page, which the album reader refuses", () => {
    // The page is still worth opening. It is only worth nothing to the reader.
    expect(yupooAnyUrl({ url: SELLER })).toBe(SELLER);
    expect(yupooAnyUrl({ url: WEIDIAN, links: [{ url: SELLER, role: "photos" }] })).toBe(SELLER);
    expect(yupooAnyUrl({ url: WEIDIAN, sellerYupooLinks: [SELLER] })).toBe(SELLER);
  });

  it("takes a real album too", () => {
    expect(yupooAnyUrl({ url: ALBUM })).toBe(ALBUM + "?uid=1");
  });

  it("returns nothing when no address is on a Yupoo host", () => {
    expect(yupooAnyUrl({ url: WEIDIAN })).toBe(null);
    expect(yupooAnyUrl(null)).toBe(null);
  });
});
