// LB-39: the card picture for a shared haul.
//
// Measured against a live Yupoo album on 2026-07-27, before this route existed:
//
//   no Referer, Discordbot UA -> HTTP 567, 7352 bytes of text/html
//   Referer: the yupoo host   -> HTTP 200, 57400 bytes of image/jpeg
//
// share-page.js was putting the seller's URL straight into og:image, so every
// crawler fetched the error page and every unfurl drew a card with no picture.
// The tests below pin the three things that make the relay work where the raw
// URL did not: it sends a Referer the seller accepts, it refuses a body that is
// not really an image, and it always answers with SOME picture.
//
// Supabase is faked in memory; the outbound fetch is stubbed. No real network.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const shareImage = require("../netlify/functions/share-image.js");
const guard = require("../netlify/functions/lib/guard.js");
const limit = require("../netlify/functions/lib/limit.js");

const CODE = "abcdefghjkmn"; // 12 chars from the share alphabet
const PHOTO = "https://photo.yupoo.com/huskyreps/00ccbea0/small.jpg";
const ALBUM = "https://huskyreps.x.yupoo.com/albums/207770342";
const OG = "https://credenzafashion.com/og.png";

// A one-pixel JPEG. The SOI marker (ff d8) is what sniffImageMime reads, and
// the length must clear the 12-byte floor in the sniffer.
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);

function doc(items) {
  return {
    v: 1,
    title: "Winter haul",
    count: items.length,
    truncated: false,
    fields: { prices: false, notes: false, quality: false, sellers: false, parcel: false },
    items,
    createdAt: 1_700_000_000_000,
  };
}

// One row, one photo, unless a test says otherwise.
function state(overrides = {}) {
  return {
    row: {
      id: CODE,
      user_id: "user-1",
      data: doc([{ title: "Wool coat", image: PHOTO, link: ALBUM }]),
    },
    ...overrides,
  };
}

// The outbound image fetch. Captured so a test can read the Referer we sent —
// which is the whole point of the route.
let sent;
let photoReply;

function fetchMock(url, init = {}) {
  const u = new URL(String(url));
  if (u.hostname.endsWith("supabase.co")) {
    const raw = u.searchParams.get("id") || "";
    const wanted = raw.startsWith("eq.") ? raw.slice(3) : null;
    const rows = current.row && current.row.id === wanted ? [current.row] : [];
    return Promise.resolve({ ok: true, status: 200, json: async () => rows });
  }
  sent = { url: u.href, headers: init.headers || {} };
  return Promise.resolve(photoReply());
}

let current;

function ok(buf, contentType) {
  return {
    ok: true,
    status: 200,
    headers: new Map([["content-type", contentType]]),
    arrayBuffer: async () => buf,
  };
}

// What Yupoo actually returns to a request with no Referer: not a 4xx, but a
// 567 carrying an HTML page. A relay that only checked res.ok would ship this
// to Discord as an image.
function hotlinkDenied() {
  return {
    ok: false,
    status: 567,
    headers: new Map([["content-type", "text/html"]]),
    arrayBuffer: async () => Buffer.from("<html>forbidden</html>"),
  };
}

const get = (code = CODE) => ({
  httpMethod: "GET",
  headers: {},
  path: "/s/" + code + "/img",
  queryStringParameters: { code },
});

beforeEach(() => {
  process.env.SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "svc-key";
  current = state();
  sent = null;
  photoReply = () => ok(JPEG, "image/jpeg");
  guard._setLookupForTest(async () => [{ address: "93.184.216.34" }]);
  limit._resetForTest();
  vi.stubGlobal("fetch", vi.fn(fetchMock));
});

afterEach(() => {
  guard._setLookupForTest(null);
  limit._resetForTest();
  vi.unstubAllGlobals();
});

// ───────────────────────────────────────────────────────────────────────────
describe("the crawler gets a picture, not an error page", () => {
  it("returns the photo bytes for a published code", async () => {
    const res = await shareImage.handler(get());
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("image/jpeg");
    expect(res.isBase64Encoded).toBe(true);
    expect(Buffer.from(res.body, "base64")).toEqual(JPEG);
  });

  // The defect in one assertion. Without a Referer this request is the 567.
  it("sends a Referer the seller accepts", async () => {
    await shareImage.handler(get());
    expect(sent.headers.referer).toBe(ALBUM);
  });

  // A Weidian product link is no help as the Referer for a Yupoo photo. When
  // the saved link belongs to a different operator, the image's own origin is
  // the value that was measured to work.
  it("ignores a saved link from a different host and uses the photo's origin", async () => {
    current.row.data = doc([{ title: "Coat", image: PHOTO, link: "https://weidian.com/item.html?id=9" }]);
    await shareImage.handler(get());
    expect(sent.headers.referer).toBe("https://photo.yupoo.com/");
  });

  it("never sends our own origin as the Referer", async () => {
    // Measured: credenzafashion.com as the Referer returns 567, same as none.
    await shareImage.handler(get());
    expect(sent.headers.referer).not.toContain("credenzafashion.com");
  });

  it("uses the first card that has a photo, not the first card", async () => {
    current.row.data = doc([
      { title: "No photo" },
      { title: "Wool coat", image: PHOTO, link: ALBUM },
    ]);
    const res = await shareImage.handler(get());
    expect(res.statusCode).toBe(200);
    expect(sent.url).toBe(PHOTO);
  });

  it("serves an inline photo without any outbound fetch", async () => {
    const inline = "data:image/png;base64," + PNG.toString("base64");
    current.row.data = doc([{ title: "Camera shot", image: inline }]);
    const res = await shareImage.handler(get());
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("image/png");
    expect(sent).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("a failure is a picture too", () => {
  // Every one of these used to be a blank card. A 302 to the site card means
  // the unfurl still draws something.
  it("falls back to the site card when the seller denies the hotlink", async () => {
    photoReply = hotlinkDenied;
    const res = await shareImage.handler(get());
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(OG);
  });

  // The trap in this defect: 567 carries a BODY, and a relay that trusted a
  // 200 would ship HTML with an image content-type. Prove the bytes decide.
  it("refuses a 200 whose body is not an image", async () => {
    photoReply = () => ok(Buffer.from("<html>not a photo at all</html>"), "image/jpeg");
    const res = await shareImage.handler(get());
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(OG);
  });

  it("trusts the bytes when the seller mislabels a real image", async () => {
    // Some Yupoo objects come back as application/octet-stream. The sniffer is
    // the authority, so a real JPEG still gets served.
    photoReply = () => ok(JPEG, "application/octet-stream");
    const res = await shareImage.handler(get());
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("image/jpeg");
  });

  it("falls back when the haul carries no photo", async () => {
    current.row.data = doc([{ title: "Coat" }, { title: "Boots", image: "javascript:alert(1)" }]);
    const res = await shareImage.handler(get());
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(OG);
  });

  it("falls back for an unknown code", async () => {
    current.row = null;
    const res = await shareImage.handler(get());
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(OG);
  });

  it("falls back for an expired share", async () => {
    current.row.expires_at = new Date(Date.now() - 1000).toISOString();
    const res = await shareImage.handler(get());
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(OG);
  });

  it("falls back when the seller's host never answers", async () => {
    photoReply = () => {
      throw new Error("ECONNRESET");
    };
    const res = await shareImage.handler(get());
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(OG);
  });

  it("rejects a malformed code without asking the database", async () => {
    const res = await shareImage.handler(get("../../etc/passwd"));
    expect(res.statusCode).toBe(302);
    expect(fetch).not.toHaveBeenCalled();
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("this is not an open image proxy", () => {
  // The one property that makes a keyless relay safe: there is no parameter a
  // caller can aim. The URL fetched comes from a row in the database, and the
  // only input is a code that was already published.
  it("takes no URL parameter at all", async () => {
    await shareImage.handler({
      httpMethod: "GET",
      headers: {},
      path: "/s/" + CODE + "/img",
      queryStringParameters: { code: CODE, url: "https://169.254.169.254/latest/meta-data/" },
    });
    expect(sent.url).toBe(PHOTO);
  });

  it("routes the outbound fetch through the SSRF guard", async () => {
    // A share whose stored photo resolves to a private address must not be
    // fetched, even though the URL came from our own database.
    guard._setLookupForTest(async () => [{ address: "169.254.169.254" }]);
    const res = await shareImage.handler(get());
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(OG);
  });

  it("answers only GET and HEAD", async () => {
    const res = await shareImage.handler({ ...get(), httpMethod: "POST" });
    expect(res.statusCode).toBe(405);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("the CDN carries the load, not the function", () => {
  // A link dropped in a busy Discord is a burst of identical requests. A share
  // never changes, so the picture is answered once and served from the edge.
  it("marks a served photo durable for a week", async () => {
    const res = await shareImage.handler(get());
    const cdn = res.headers["netlify-cdn-cache-control"];
    expect(cdn).toContain("durable");
    expect(cdn).toContain("max-age=604800");
  });

  it("holds a failure only briefly", async () => {
    photoReply = hotlinkDenied;
    const res = await shareImage.handler(get());
    expect(res.headers["netlify-cdn-cache-control"]).toContain("max-age=300");
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("the referer helper", () => {
  const { refererFor, registrable } = shareImage._internal;

  it("treats a subdomain as the same operator", () => {
    expect(registrable("huskyreps.x.yupoo.com")).toBe("yupoo.com");
    expect(registrable("photo.yupoo.com")).toBe("yupoo.com");
  });

  it("prefers the saved seller page when the hosts match", () => {
    expect(refererFor(PHOTO, ALBUM)).toBe(ALBUM);
  });

  it("falls back to the photo's origin with no link", () => {
    expect(refererFor(PHOTO, null)).toBe("https://photo.yupoo.com/");
  });

  it("survives a malformed link", () => {
    expect(refererFor(PHOTO, "not a url")).toBe("https://photo.yupoo.com/");
  });
});
