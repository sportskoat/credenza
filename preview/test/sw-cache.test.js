/**
 * Offline cache rules for public/sw.js (site audit 2026-07-29, finding 4).
 *
 * The worker runs in a browser worker scope that jsdom does not provide, so
 * this checks the SOURCE shape — the same approach as avatar-centre.test.js.
 * The one rule that matters: a reply from a server function must never enter
 * the offline cache. The cache key is the URL, so it cannot separate two
 * signed-in visitors, and a later offline session could read the earlier one.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = readFileSync(join(ROOT, "public/sw.js"), "utf8");

describe("service worker cache rules", () => {
  it("skips every /.netlify/functions/ request", () => {
    expect(SRC).toContain('url.pathname.startsWith("/.netlify/functions/")');
  });

  it("skips the function path before it opens the cache", () => {
    const skip = SRC.indexOf('startsWith("/.netlify/functions/")');
    const open = SRC.indexOf("caches.open(CACHE).then(async (cache)");
    expect(skip).toBeGreaterThan(-1);
    expect(open).toBeGreaterThan(-1);
    expect(skip).toBeLessThan(open);
  });

  it("still caches ordinary same-origin GET replies", () => {
    expect(SRC).toContain("if (res.ok) cache.put(e.request, res.clone());");
  });
});
