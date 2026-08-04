// The share document is described twice: credenza-share.js (ESM, the browser
// builds documents there) and netlify/functions/lib/share-doc.js (CommonJS,
// the function reads them there). Two copies drift. This file is the alarm.
//
// The failure it prevents is quiet and bad: bump the version in one file and
// every existing share starts answering 404, with no error anywhere to say why.

import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import * as esm from "../../credenza-share.js";

const require = createRequire(import.meta.url);
const cjs = require("../netlify/functions/lib/share-doc.js");
const shareApi = require("../netlify/functions/share.js");

describe("the two share modules agree", () => {
  it("uses one version number", () => {
    expect(cjs.SHARE_DOC_VERSION).toBe(esm.SHARE_DOC_VERSION);
  });

  it("reads the same set of document versions", () => {
    // v2 is the newest; v1 shelf shares must keep parsing on both sides or
    // every link shared before the haul redesign starts answering 404.
    expect([...cjs.SHARE_DOC_VERSIONS].sort()).toEqual([...esm.SHARE_DOC_VERSIONS].sort());
    expect(esm.SHARE_DOC_VERSIONS).toContain(1);
    expect(esm.SHARE_DOC_VERSIONS).toContain(esm.SHARE_DOC_VERSION);
  });

  it("uses one code alphabet and length", () => {
    expect(cjs.SHARE_CODE_LENGTH).toBe(esm.SHARE_CODE_LENGTH);
    // Round-trip: a code the browser makes must pass the server's check.
    const code = esm.makeShareCode({
      getRandomValues: (bytes) => {
        for (let i = 0; i < bytes.length; i++) bytes[i] = i * 7;
        return bytes;
      },
    });
    expect(cjs.isShareCode(code)).toBe(true);
    expect(esm.isShareCode(code)).toBe(true);
  });

  it("accepts and refuses the same documents", () => {
    const good = esm.buildShareSnapshot([{ title: "Coat", image: "https://x.test/a.jpg" }], { now: 1 });
    expect(cjs.parseShareSnapshot(good)).not.toBe(null);
    expect(esm.parseShareSnapshot(good)).not.toBe(null);

    const haul = esm.buildHaulShareSnapshot([{ title: "Tee", image: "https://x.test/b.jpg" }], { now: 1 });
    expect(haul.v).toBe(2);
    expect(cjs.parseShareSnapshot(haul)).not.toBe(null);
    expect(esm.parseShareSnapshot(haul)).not.toBe(null);

    for (const bad of [null, undefined, "", "not json", 0, [], [1], {}, { v: 1 }, { v: 99, items: [] }]) {
      expect(cjs.parseShareSnapshot(bad)).toBe(null);
      expect(esm.parseShareSnapshot(bad)).toBe(null);
    }
  });

  it("expires on the same rule", () => {
    const now = 1_700_000_000_000;
    for (const share of [null, {}, { expiresAt: null }, { expiresAt: now - 1 }, { expiresAt: now + 1 }]) {
      expect(cjs.isExpired(share, now)).toBe(esm.isExpired(share, now));
    }
  });

  it("enforces the same size and item caps on the server", () => {
    expect(shareApi._internal.MAX_ITEMS).toBe(esm.SHARE_MAX_ITEMS);
    expect(shareApi._internal.MAX_BYTES).toBe(esm.SHARE_MAX_BYTES);
  });

  it("builds a link the redirect rule serves", () => {
    // netlify.toml rewrites /s/* to the share-page function. If shareUrl ever
    // stops producing /s/<code>, every link the app hands out breaks.
    expect(esm.shareUrl("abcdefghjkmn")).toBe("https://credenzafashion.com/s/abcdefghjkmn");
  });
});
