// The album link counts the ALBUM, not our stored copy of it (2026-07-26).
// Kyle: "It'll say 'View album' and then 8 photos, but there's a whole bunch
// more than that… this album has 30 different photos."
import { describe, expect, it } from "vitest";
import { albumLinkTarget } from "../../components/CardMetaLinks.jsx";

const ALBUM = "https://mook-official.x.yupoo.com/albums/240336011?uid=1";

function item(extra = {}) {
  return { url: ALBUM, links: [{ url: ALBUM, role: "photos", label: "Yupoo" }], ...extra };
}

describe("albumLinkTarget photo count", () => {
  it("reports the album's own count, not the stored gallery length", () => {
    const target = albumLinkTarget(item({ gallery: ["a", "b", "c"], albumPhotoCount: 37 }));
    expect(target.label).toBe("View album · 37 photos");
  });

  it("falls back to the stored gallery for items enriched before the field existed", () => {
    expect(albumLinkTarget(item({ gallery: ["a", "b", "c"] })).label).toBe("View album · 3 photos");
  });

  it("never reports fewer photos than it already holds", () => {
    const target = albumLinkTarget(item({ gallery: ["a", "b", "c", "d"], albumPhotoCount: 2 }));
    expect(target.label).toBe("View album · 4 photos");
  });

  it("omits the count when only one photo is known", () => {
    expect(albumLinkTarget(item({ gallery: ["a"], albumPhotoCount: 1 })).label).toBe("View album");
    expect(albumLinkTarget(item({ gallery: [] })).label).toBe("View album");
  });

  it("uses the short wording in tight slots", () => {
    expect(albumLinkTarget(item({ gallery: [], albumPhotoCount: 37 }), { tight: true }).label).toBe(
      "Album · 37 photos"
    );
  });
});
