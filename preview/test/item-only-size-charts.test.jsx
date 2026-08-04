import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  cleanLegacySellerCharts,
  restoreChartNotesOnEdit,
  sizeChartTextFor,
} from "../../credenza-fashion.jsx";

const { huntMock } = vi.hoisted(() => ({ huntMock: vi.fn() }));
vi.mock("../../components/size-chart-hunt.js", async () => {
  const actual = await vi.importActual("../../components/size-chart-hunt.js");
  // Keep the real fingerprint + version: the hook reads them to skip a
  // stamped miss. Only the hunt itself is stubbed.
  return { ...actual, huntSizeChart: huntMock };
});
const { default: DetailBody } = await import("../../components/DetailBody.jsx");

const CHART_TEXT = "M: chest 116, length 70\nL: chest 120, length 72";

function item(id, extra = {}) {
  return {
    id,
    createdAt: 1753400000000,
    url: "https://mook-official.x.yupoo.com/albums/" + id,
    title: "Mook shirt",
    seller: "Mook",
    category: "shirt",
    findStatus: "want",
    ...extra,
  };
}

function renderBody(target, extra = {}) {
  const onSaveEdit = extra.onSaveEdit || vi.fn();
  const view = render(
    <DetailBody
      item={target}
      shelfItems={extra.shelfItems || [target]}
      bodyProfile={{ chest: "99", height: "183", weight: "75" }}
      buyLabel="Buy"
      onSaveEdit={onSaveEdit}
      onOpen={vi.fn()}
      onAttachPhoto={vi.fn()}
      onRemovePhoto={vi.fn()}
      onOpenSizes={vi.fn()}
    />
  );
  return { ...view, onSaveEdit };
}

afterEach(() => {
  cleanup();
  huntMock.mockReset();
});

describe("legacy borrowed chart cleanup", () => {
  it("lets a new customer size note become chart input again", () => {
    expect(
      restoreChartNotesOnEdit({
        sizeNotes: "M: chest 116",
        sizeChartIgnoreNotes: true,
      })
    ).toEqual({
      sizeNotes: "M: chest 116",
      sizeChartIgnoreNotes: false,
    });
    expect(restoreChartNotesOnEdit({ note: "Runs small." })).toEqual({ note: "Runs small." });
  });

  it("removes only an exact sibling chart block", () => {
    const donor = item("donor", {
      sizeNotes: CHART_TEXT,
      summary: "Seller measurements",
      sizeChartSource: {
        via: "customer-photo",
        photos: 1,
        at: "2026-07-25T10:00:00.000Z",
        seller: "Mook",
      },
    });
    const borrowed = [donor.sizeNotes, donor.summary, donor.rawText, donor.note]
      .filter(Boolean)
      .join("\n");
    const target = item("target", {
      sizeNotes: "Customer note\n" + borrowed,
      sizeChartSource: {
        via: "seller-cache",
        photos: 0,
        at: "2026-07-26T10:00:00.000Z",
        seller: "Mook",
      },
    });

    const cleaned = cleanLegacySellerCharts([donor, target])[1];
    expect(cleaned.sizeNotes).toBe("Customer note");
    expect(cleaned.sizeChartText).toBe("");
    expect(cleaned.sizeChartSource).toBe(null);
    expect(cleaned.sizeChartNeedsClear).toBe(false);
  });

  it("preserves and hides an unmatched legacy value", () => {
    const donor = item("donor-unmatched", {
      sizeNotes: CHART_TEXT,
      sizeChartSource: {
        via: "customer-photo",
        photos: 1,
        at: "2026-07-25T10:00:00.000Z",
        seller: "Mook",
      },
    });
    const target = item("target-unmatched", {
      sizeNotes: "Customer note\nM: chest 999",
      sizeChartSource: {
        via: "seller-cache",
        photos: 0,
        at: "2026-07-26T10:00:00.000Z",
        seller: "Mook",
      },
    });

    const cleaned = cleanLegacySellerCharts([donor, target])[1];
    expect(cleaned.sizeNotes).toBe(target.sizeNotes);
    expect(cleaned.sizeChartSource).toBe(null);
    expect(cleaned.sizeChartNeedsClear).toBe(true);
    expect(sizeChartTextFor(cleaned)).toBe("");
  });

  it("does not match a chart from another seller", () => {
    const donor = item("other-seller", {
      seller: "Other",
      sizeNotes: CHART_TEXT,
      sizeChartSource: {
        via: "customer-photo",
        photos: 1,
        at: "2026-07-25T10:00:00.000Z",
        seller: "Other",
      },
    });
    const target = item("target-other", {
      sizeNotes: CHART_TEXT,
      sizeChartSource: {
        via: "seller-cache",
        photos: 0,
        at: "2026-07-26T10:00:00.000Z",
        seller: "Mook",
      },
    });

    expect(cleanLegacySellerCharts([donor, target])[1].sizeChartNeedsClear).toBe(true);
  });
});

describe("item-only chart reads", () => {
  it("stores a machine read on its item without changing human notes", async () => {
    huntMock.mockResolvedValue({
      text: CHART_TEXT,
      source: { via: "desc-photos", photos: 3 },
    });
    const target = item("own-read", { sizeNotes: "Runs oversized." });
    const { onSaveEdit } = renderBody(target);

    await waitFor(() =>
      expect(onSaveEdit).toHaveBeenCalledWith("own-read", {
        sizeChartText: CHART_TEXT,
        sizeChartNeedsClear: false,
        // A find clears any old no-find stamp (Kyle 2026-08-04).
        sizeChartHunt: null,
        sizeChartSource: {
          via: "desc-photos",
          photos: 3,
          at: expect.any(String),
        },
      })
    );
    expect(onSaveEdit.mock.calls[0][1]).not.toHaveProperty("sizeNotes");
    expect(huntMock).toHaveBeenCalledTimes(1);
  });

  it("never reads a sibling chart after an empty item read", async () => {
    huntMock.mockResolvedValue(null);
    const donor = item("sibling", {
      sizeChartText: CHART_TEXT,
      sizeChartSource: {
        via: "customer-photo",
        photos: 1,
        at: "2026-07-25T10:00:00.000Z",
      },
    });
    const target = item("no-borrow");
    const { onSaveEdit } = renderBody(target, { shelfItems: [donor, target] });

    expect(await screen.findByText("No chart")).toBeInTheDocument();
    expect(huntMock).toHaveBeenCalledTimes(1);
    // No borrowed chart lands on the target. The one allowed save is the
    // no-find stamp itself (Kyle 2026-08-04) — it carries no chart text.
    expect(
      onSaveEdit.mock.calls.filter(([, patch]) => patch && patch.sizeChartText)
    ).toHaveLength(0);
  });

  it("does not repeat a completed empty read after a remount", async () => {
    huntMock.mockResolvedValue(null);
    const target = item("one-paid-read");
    const first = renderBody(target);
    expect(await screen.findByText("No chart")).toBeInTheDocument();
    first.unmount();

    renderBody(target);
    expect(await screen.findByText("No chart")).toBeInTheDocument();
    expect(huntMock).toHaveBeenCalledTimes(1);
  });

  it("does not call the reader while a legacy chart awaits clearing", async () => {
    huntMock.mockResolvedValue(null);
    const target = item("blocked-read", {
      sizeNotes: "Runs small.\n" + CHART_TEXT,
      sizeChartNeedsClear: true,
    });
    const { onSaveEdit } = renderBody(target);

    expect(
      screen.getByText(
        "This saved chart came from another item. It is hidden. Clear it before reading this item's photos."
      )
    ).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Clear this chart" })).toBeInTheDocument();
    expect(huntMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Clear this chart" }));
    expect(onSaveEdit).toHaveBeenCalledWith("blocked-read", {
      sizeChartText: "",
      sizeChartSource: null,
      sizeChartNeedsClear: false,
      sizeChartIgnoreNotes: true,
    });
    expect(target.sizeNotes).toBe("Runs small.\n" + CHART_TEXT);
    expect(
      sizeChartTextFor({
        ...target,
        sizeChartNeedsClear: false,
        sizeChartIgnoreNotes: true,
      })
    ).toBe("");
  });

  it("does not read again when the item already stores a chart", () => {
    huntMock.mockResolvedValue(null);
    renderBody(item("saved-once", { sizeChartText: CHART_TEXT }));

    expect(screen.getByText("SELLER'S CHART")).toBeInTheDocument();
    expect(huntMock).not.toHaveBeenCalled();
  });
});
