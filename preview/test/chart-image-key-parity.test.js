// Drift lock for #40. The photo fingerprint lives in TWO files: the app's
// ESM copy (components/chart-pipeline.js) and the function's CommonJS copy
// (netlify/functions/lib/chart-image-key.js). The shared chart cache only
// works when both agree forever. This test runs both over the same fixture
// URLs and fails the moment one file changes without the other.
import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const server = require("../netlify/functions/lib/chart-image-key.js");
const { chartImageKey: appKey } = await import("../../components/chart-pipeline.js");

const FIXTURES = [
  // Yupoo: seller + photo segment is the identity.
  "https://photo.yupoo.com/mook-official/6afd5593dc/fe41e2e0.png",
  "https://photo.yupoo.com/mook-official/be8ed72a88/40a270f6.jpg",
  // CDN size words collapse.
  "https://photo.yupoo.com/seller/abc123/big.jpg",
  "https://photo.yupoo.com/seller/abc123/original.jpg",
  // Weidian geilicdn paths, including the _WIDTH_HEIGHT name shape.
  "https://si.geilicdn.com/open1642491061-1234478995-573a0000019e748c7cca0a23b4de_1106_748.jpg",
  "https://si.geilicdn.com/img-791300000199cc14effd0a2102c5-unadjust_2250_4929.png",
  "https://wd.geilicdn.com/vweixin_files-abc_1280_1280.jpg",
  // Letter-suffix size variants collapse (_b vs _s on the same file).
  "https://gd1.alicdn.com/imgextra/i3/220000/photo_b.jpg",
  "https://gd1.alicdn.com/imgextra/i3/220000/photo_s.jpg",
  // Odd inputs.
  "https://si.geilicdn.com/UPPER_CASE_PATH.JPG",
  "not a url at all",
  "",
  "data:image/jpeg;base64,AAAA",
  "data:image/jpeg;base64,BBBB",
];

describe("chartImageKey app/server parity (#40)", () => {
  it("both copies agree on every fixture URL", () => {
    for (const url of FIXTURES) {
      expect(server.chartImageKey(url), `key for ${url}`).toBe(appKey(url));
    }
  });

  it("collapses the same photo across size variants", () => {
    expect(appKey(FIXTURES[2])).toBe(appKey(FIXTURES[3]));
    expect(server.chartImageKey(FIXTURES[7])).toBe(server.chartImageKey(FIXTURES[8]));
  });

  it("never keys two different photos alike", () => {
    const keys = new Set(FIXTURES.slice(0, 2).map((u) => server.chartImageKey(u)));
    expect(keys.size).toBe(2);
    expect(server.chartImageKey(FIXTURES[4])).not.toBe(server.chartImageKey(FIXTURES[5]));
  });
});
