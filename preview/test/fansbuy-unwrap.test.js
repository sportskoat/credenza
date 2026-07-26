// Fansbuy inbound unwrap (Kyle 2026-07-26): haul pastes like
// fansbuy.com/item-micro-{id}.html?promotionCode=… must stash and resolve
// as Weidian, not dead article cards.
import { describe, expect, it } from "vitest";
import { stashPreview } from "../../credenza-fashion.jsx";
import { unwrapAgentUrl } from "../../agents.js";

const HAUL = "https://fansbuy.com/item-micro-7799601727.html?promotionCode=52c32b7af9506121";

describe("Fansbuy paste → Weidian", () => {
  it("unwraps the live haul shape", () => {
    expect(unwrapAgentUrl(HAUL).url).toBe("https://weidian.com/item.html?itemID=7799601727");
  });

  it("stashPreview keys the card as weidian:id, not fansbuy host", () => {
    const preview = stashPreview(HAUL);
    expect(preview).toBeTruthy();
    expect(preview.count).toBe(1);
    expect(preview.rows[0].key).toBe("weidian:7799601727");
    expect(preview.rows[0].code).toBe("item 7799601727");
  });

  it("stashPreview also unwraps multi-line haul pastes with several item-micro links", () => {
    const paste = [
      "https://fansbuy.com/item-micro-7799601727.html?promotionCode=a",
      "https://fansbuy.com/item-micro-7809917249.html?promotionCode=b",
      "https://fansbuy.com/item-micro-7520678906.html?promotionCode=c",
    ].join("\n");
    const preview = stashPreview(paste);
    expect(preview.count).toBeGreaterThanOrEqual(3);
    const keys = preview.rows.map((r) => r.key);
    expect(keys).toContain("weidian:7799601727");
    expect(keys).toContain("weidian:7809917249");
    expect(keys).toContain("weidian:7520678906");
  });
});
