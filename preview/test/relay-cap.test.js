// The relay cap is a COST cap, not a display cap (Kyle 2026-07-26: "let's only
// bring in 6 by default they can go to the album externally for the rest").
//
// Yupoo refuses hotlinks, so every album photo crosses a Netlify function at
// full size, in and out. At 20 a single pasted album cost 20 invocations plus
// its bandwidth. Nothing in the app reads as "6" at a glance, so without these
// tests a later edit could quietly put it back to 20 and no test would notice.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
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
