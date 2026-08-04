// The IndexingStrip component (components/IndexingStrip.jsx).
//
// Pins what a person sees and can do:
//   1. The strip is a polite live region with the header line.
//   2. Each live row shows the tile letter, the ID label, the photo slots,
//      and the stage label with its bar.
//   3. A failed row shows the failure sentence plus Retry and Dismiss.
//   4. A slow row offers Cancel, and Cancel fires.
//   5. The phone collapse shows only the lead row with a full-width bar.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import IndexingStrip from "../../components/IndexingStrip.jsx";

afterEach(cleanup);

const baseRow = {
  id: "i1",
  url: "https://x.yupoo.com/albums/12345678",
  platform: "yupoo",
  label: "12345678",
  state: "photos",
  thumbs: ["https://img/1.jpg", "https://img/2.jpg"],
  revealed: 2,
  photoTotal: 8,
  progress: 0.4,
  failReason: null,
  slowTail: false,
};

const liveHeader = { headline: "Indexing", detail: "2 OF 8 PHOTOS" };

function renderStrip(overrides = {}) {
  const props = {
    header: liveHeader,
    rows: [baseRow],
    lead: baseRow,
    onRetry: vi.fn(),
    onDismiss: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  return { ...render(<IndexingStrip {...props} />), props };
}

describe("IndexingStrip", () => {
  it("is a polite live region with the header copy", () => {
    renderStrip();
    const region = screen.getByRole("status");
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(region.textContent).toContain("Indexing");
    expect(region.textContent).toContain("2 OF 8 PHOTOS");
  });

  it("paints the tile letter and the ID label", () => {
    const { container } = renderStrip();
    expect(container.querySelector(".cz-index-tile").textContent).toBe("Y");
    expect(container.querySelector(".cz-index-label").textContent).toBe("12345678");
  });

  it("shows two photos and six dashed gaps for 2 of 8", () => {
    const { container } = renderStrip();
    expect(container.querySelectorAll(".cz-index-thumb")).toHaveLength(2);
    expect(container.querySelectorAll(".cz-index-gap")).toHaveLength(6);
  });

  it("shows the stage label in the status column", () => {
    renderStrip();
    expect(screen.getByText("PULLING PHOTOS · 2 / 8")).toBeTruthy();
  });

  it("marks the indexed step in the money colour", () => {
    const indexed = { ...baseRow, state: "indexed", progress: 1 };
    const { container } = renderStrip({
      rows: [indexed],
      lead: indexed,
      header: { headline: "Indexed", detail: "" },
    });
    expect(container.querySelector(".cz-index-step.is-indexed")).toBeTruthy();
  });

  it("shows the failure sentence with Retry and Dismiss on a failed row", () => {
    const failed = { ...baseRow, state: "failed", failReason: "private" };
    renderStrip({ rows: [failed], lead: failed });
    expect(screen.getByText("Couldn't read that album. It may be private.")).toBeTruthy();
    expect(screen.getByText("Retry")).toBeTruthy();
    expect(screen.getByText("Dismiss")).toBeTruthy();
  });

  it("fires onRetry and onDismiss with the row id", () => {
    const failed = { ...baseRow, state: "failed", failReason: "dead" };
    const { props } = renderStrip({ rows: [failed], lead: failed });
    fireEvent.click(screen.getByText("Retry"));
    expect(props.onRetry).toHaveBeenCalledWith("i1");
    fireEvent.click(screen.getByText("Dismiss"));
    expect(props.onDismiss).toHaveBeenCalledWith("i1");
  });

  it("offers Cancel past the slow tail and fires onCancel", () => {
    const slow = { ...baseRow, slowTail: true };
    const { props } = renderStrip({ rows: [slow], lead: slow });
    expect(screen.getByText("STILL PULLING PHOTOS · 2 / 8")).toBeTruthy();
    fireEvent.click(screen.getByText("Cancel"));
    expect(props.onCancel).toHaveBeenCalledWith("i1");
  });

  it("shows no Cancel on a normal row", () => {
    renderStrip();
    expect(screen.queryByText("Cancel")).toBeNull();
  });

  it("carries the exiting class for the completion fade", () => {
    const { container } = renderStrip({ exiting: true });
    expect(container.querySelector(".cz-index-strip.is-exiting")).toBeTruthy();
  });

  it("collapses to the lead row on the phone with a full-width bar", () => {
    const other = {
      ...baseRow,
      id: "i2",
      label: "87654321",
      thumbs: ["https://img/1.jpg", "https://img/2.jpg", "https://img/3.jpg"],
      revealed: 3,
    };
    const { container } = renderStrip({ phone: true, rows: [baseRow, other] });
    expect(container.querySelectorAll(".cz-index-row")).toHaveLength(1);
    expect(container.querySelector(".cz-index-track.is-phone")).toBeTruthy();
    // The visible row is the lead (two photos), not the second link (three).
    expect(container.querySelectorAll(".cz-index-thumb")).toHaveLength(2);
  });

  it("says WAITING FOR NETWORK on an offline queued row", () => {
    const queued = { ...baseRow, state: "queued", progress: 0.02 };
    renderStrip({ rows: [queued], lead: queued, offline: true });
    expect(screen.getByText("WAITING FOR NETWORK")).toBeTruthy();
  });

  it("renders nothing without rows", () => {
    const { container } = renderStrip({ rows: [], lead: null });
    expect(container.querySelector(".cz-index-strip")).toBeNull();
  });
});
