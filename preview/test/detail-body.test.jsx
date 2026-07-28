import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { huntMock } = vi.hoisted(() => ({ huntMock: vi.fn() }));
vi.mock("../../components/size-chart-hunt.js", () => ({ huntSizeChart: huntMock }));

const { default: DetailBody } = await import("../../components/DetailBody.jsx");

const CHART_TEXT = "M: chest 116, length 70\nL: chest 120, length 72\nXL: chest 124, length 74";

function item(id, extra = {}) {
  return {
    id,
    createdAt: 1753400000000,
    url: "https://weidian.com/item.html?itemID=" + id,
    title: "Item " + id,
    seller: "replux",
    category: "shirt",
    findStatus: "want",
    sizeNotes: CHART_TEXT,
    sizeChartSource: { via: "album-text", at: "2026-07-25T10:00:00.000Z" },
    ...extra,
  };
}

function body(itemValue, extra = {}) {
  return (
    <DetailBody
      item={itemValue}
      bodyProfile={{ chest: "96", height: "180", weight: "75" }}
      onSaveEdit={vi.fn()}
      onOpen={vi.fn()}
      onAttachPhoto={vi.fn()}
      onRemovePhoto={vi.fn()}
      onOpenSizes={vi.fn()}
      {...extra}
    />
  );
}

afterEach(() => {
  cleanup();
  huntMock.mockReset();
  vi.useRealTimers();
});

describe("DetailBody detail tabs", () => {
  it("selects Size and exposes one panel", () => {
    render(body(item("tabs")));

    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Size", "Colorway", "Weight", "Haul"]);
    expect(tabs.filter((tab) => tab.getAttribute("aria-selected") === "true")).toHaveLength(1);
    expect(screen.getByRole("tab", { name: "Size" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Size" })).toHaveAttribute("tabindex", "0");

    const panels = screen.getAllByRole("tabpanel", { hidden: true });
    expect(panels).toHaveLength(4);
    expect(panels.filter((panel) => !panel.hidden)).toHaveLength(1);
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Size");
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("activates tabs with Arrow keys, Home, and End", async () => {
    const user = userEvent.setup();
    render(body(item("keys")));

    const size = screen.getByRole("tab", { name: "Size" });
    size.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Colorway" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Colorway" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Colorway");

    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Haul" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Haul" })).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{Home}");
    expect(size).toHaveFocus();
    expect(size).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Haul" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Haul" })).toHaveAttribute("aria-selected", "true");
  });

  it("saves a direct size once and preserves Batch", () => {
    vi.useFakeTimers();
    const onSaveEdit = vi.fn();
    render(body(item("pick", { batch: "Batch A" }), { onSaveEdit }));

    fireEvent.click(screen.getByRole("button", { name: "Large" }));
    expect(onSaveEdit).toHaveBeenCalledTimes(1);
    expect(onSaveEdit).toHaveBeenCalledWith(
      "pick",
      expect.objectContaining({ size: "L", batch: "Batch A" })
    );

    act(() => vi.advanceTimersByTime(700));
    expect(onSaveEdit).toHaveBeenCalledTimes(1);
  });

  it("saves a custom size once on Enter and ignores the following blur", () => {
    vi.useFakeTimers();
    const onSaveEdit = vi.fn();
    render(body(item("custom-enter", { batch: "Stored Batch" }), { onSaveEdit }));

    const input = screen.getByLabelText("Custom item size");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "  3XL  " } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.blur(input);

    expect(onSaveEdit).toHaveBeenCalledTimes(1);
    expect(onSaveEdit).toHaveBeenCalledWith(
      "custom-enter",
      expect.objectContaining({ size: "3XL", batch: "Stored Batch" })
    );
    act(() => vi.advanceTimersByTime(700));
    expect(onSaveEdit).toHaveBeenCalledTimes(1);
  });

  it("saves a custom size on blur", () => {
    const onSaveEdit = vi.fn();
    render(body(item("custom-blur"), { onSaveEdit }));

    const input = screen.getByLabelText("Custom item size");
    fireEvent.change(input, { target: { value: "One size" } });
    fireEvent.blur(input);

    expect(onSaveEdit).toHaveBeenCalledWith(
      "custom-blur",
      expect.objectContaining({ size: "One size" })
    );
  });

  it("keeps Colorway, Weight, and Haul editing inside their panels", async () => {
    const user = userEvent.setup();
    const onSaveEdit = vi.fn();
    const flushRef = { current: null };
    render(
      body(item("panels", { batch: "Batch P" }), {
        haulNames: ["Summer", "Winter"],
        onSaveEdit,
        flushRef,
      })
    );

    await user.click(screen.getByRole("tab", { name: "Colorway" }));
    expect(screen.queryByRole("button", { name: "Done" })).toBe(null);
    await user.type(screen.getByRole("textbox", { name: "Colorway" }), "Navy");
    fireEvent.blur(screen.getByRole("textbox", { name: "Colorway" }));
    expect(onSaveEdit).toHaveBeenLastCalledWith(
      "panels",
      expect.objectContaining({ colorway: "Navy", batch: "Batch P" })
    );

    await user.click(screen.getByRole("tab", { name: "Weight" }));
    expect(screen.queryByRole("button", { name: "Done" })).toBe(null);
    fireEvent.change(screen.getByLabelText("Weight · g"), { target: { value: "450" } });
    fireEvent.blur(screen.getByLabelText("Weight · g"));
    expect(onSaveEdit).toHaveBeenLastCalledWith(
      "panels",
      expect.objectContaining({ weightGrams: 450, batch: "Batch P" })
    );

    await user.click(screen.getByRole("tab", { name: "Haul" }));
    expect(screen.queryByRole("button", { name: "Done" })).toBe(null);
    await user.click(screen.getByRole("button", { name: "Add to a haul…" }));
    await user.click(screen.getByRole("option", { name: "Summer" }));
    act(() => flushRef.current());
    expect(onSaveEdit).toHaveBeenLastCalledWith(
      "panels",
      expect.objectContaining({ project: "Summer", batch: "Batch P" })
    );
  });

  it("opens profile sizing from the Size panel", async () => {
    const user = userEvent.setup();
    const onOpenSizes = vi.fn();
    render(body(item("profile"), { onOpenSizes }));

    await user.click(screen.getByRole("button", { name: "Edit sizes and measurements" }));
    expect(onOpenSizes).toHaveBeenCalledTimes(1);
  });
});

describe("DetailBody draft ownership", () => {
  it("flushes a switched draft to its original item and preserves Batch", () => {
    vi.useFakeTimers();
    const onSaveEdit = vi.fn();
    const first = item("first", { note: "First note", batch: "Batch A" });
    const second = item("second", { note: "Second note", batch: "Batch B" });
    const { rerender } = render(body(first, { onSaveEdit }));

    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Pending first note" } });
    expect(screen.queryByRole("button", { name: /Batch/ })).toBe(null);

    rerender(body(second, { onSaveEdit }));

    expect(onSaveEdit).toHaveBeenCalledWith(
      "first",
      expect.objectContaining({ note: "Pending first note", batch: "Batch A" })
    );
    expect(screen.getByLabelText("Notes")).toHaveValue("Second note");

    act(() => vi.advanceTimersByTime(700));
    expect(onSaveEdit.mock.calls.some(([id]) => id === "second")).toBe(false);
  });

  it("flushes the current owned draft through flushRef", () => {
    const onSaveEdit = vi.fn();
    const flushRef = { current: null };
    render(body(item("flush", { batch: "Stored Batch" }), { onSaveEdit, flushRef }));

    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Flush this note" } });
    expect(onSaveEdit).not.toHaveBeenCalled();

    act(() => flushRef.current());
    expect(onSaveEdit).toHaveBeenCalledWith(
      "flush",
      expect.objectContaining({ note: "Flush this note", batch: "Stored Batch" })
    );
  });

  it("keeps snapshotRef current and clears it on unmount", () => {
    const onSaveEdit = vi.fn();
    const flushRef = { current: null };
    const snapshotRef = { current: null };
    const { unmount } = render(
      body(item("snapshot", { batch: "Batch S" }), { onSaveEdit, flushRef, snapshotRef })
    );

    expect(snapshotRef.current).toEqual(
      expect.objectContaining({ id: "snapshot", batch: "Batch S", title: "Item snapshot" })
    );

    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Visible draft" } });
    expect(snapshotRef.current).toEqual(
      expect.objectContaining({ id: "snapshot", note: "Visible draft", batch: "Batch S" })
    );

    act(() => flushRef.current());
    expect(onSaveEdit).toHaveBeenCalledWith(
      "snapshot",
      expect.objectContaining({ note: "Visible draft", batch: "Batch S" })
    );
    expect(snapshotRef.current.note).toBe("Visible draft");

    unmount();
    expect(snapshotRef.current).toBe(null);
  });
});

describe("DetailBody footer", () => {
  it("renders a price-only footer without the Buy disclosure", () => {
    const priceOnly = item("price", {
      url: "https://seller.x.yupoo.com/albums/1",
      links: [],
      price: 88,
      currency: "USD",
    });
    const { container } = render(body(priceOnly, { footerPrice: "$88.00" }));

    expect(container.querySelector(".cz-detail-foot")).not.toBe(null);
    expect(screen.getByRole("button", { name: "Edit price: $88.00" })).toBeInTheDocument();
    expect(container.querySelector(".cz-detail-buy")).toBe(null);
    expect(container.querySelector(".cz-detail-disclosure")).toBe(null);
  });

  it("renders the footer and disclosure when Buy exists without a footer price", () => {
    const { container } = render(body(item("buy"), { buyLabel: "Buy" }));

    expect(container.querySelector(".cz-detail-foot")).not.toBe(null);
    expect(screen.getByRole("button", { name: "Buy" })).toBeInTheDocument();
    expect(container.querySelector(".cz-detail-disclosure")).not.toBe(null);
  });
});

// CH-08 (designs 4d–4g): confidence derives from data completeness.
describe("DetailBody no-measurements flow", () => {
  const trio = () => ({
    bodyProfile: null,
    onSaveBodyProfile: vi.fn(),
    onSkipFitPrompt: vi.fn(),
  });

  it("4d: empty profile shows the ask and fabricates no size string", () => {
    const { container } = render(body(item("fit4d"), trio()));

    expect(screen.getByText("Will it fit you?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add my size" })).toBeInTheDocument();
    // No sizing verdict renders — no AI pick, no usual, no provenance.
    expect(container.querySelector(".cz-sizing")).toBe(null);
    expect(container.querySelector(".cz-sizing-nochart")).toBe(null);
    expect(container.querySelector(".cz-fit4-math")).toBe(null);
  });

  it("4f: the ask requests only what the category needs", () => {
    const shorts = item("fit4f-shorts", { category: "shorts", sizeNotes: "" });
    const first = render(body(shorts, trio()));
    fireEvent.click(screen.getByRole("button", { name: "Add my size" }));
    expect(screen.getByLabelText("Waist in cm")).toBeInTheDocument();
    expect(screen.getByLabelText("Inseam in cm")).toBeInTheDocument();
    expect(screen.queryByLabelText("Chest in cm")).toBe(null);
    first.unmount();

    render(body(item("fit4f-tee"), trio()));
    fireEvent.click(screen.getByRole("button", { name: "Add my size" }));
    expect(screen.getByLabelText("Chest in cm")).toBeInTheDocument();
    expect(screen.queryByLabelText("Waist in cm")).toBe(null);
    expect(screen.queryByLabelText("Inseam in cm")).toBe(null);
  });

  it("4f: save converts to storage units and calls onSaveBodyProfile", () => {
    const handlers = trio();
    render(body(item("fit4f-save"), handlers));
    fireEvent.click(screen.getByRole("button", { name: "Add my size" }));
    fireEvent.change(screen.getByLabelText("Chest in cm"), { target: { value: "96" } });
    fireEvent.change(screen.getByLabelText("Usual size"), { target: { value: "M" } });
    fireEvent.click(screen.getByRole("button", { name: "Save & recalculate" }));

    expect(handlers.onSaveBodyProfile).toHaveBeenCalledWith({ chest: 96, usualSize: "M" });
    expect(screen.queryByText("Your measurements")).toBe(null);
  });

  it("4f: skip with a usual size returns to the rough state, not blank", () => {
    const handlers = trio();
    handlers.bodyProfile = { usualSize: "L" };
    const { container } = render(body(item("fit4e"), handlers));

    // 4e: rough estimate strip with the category's sharpen ask.
    expect(screen.getByText("Rough estimate")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Add chest/ }));
    fireEvent.click(screen.getByRole("button", { name: "Skip — keep the rough size" }));

    expect(screen.getByText("Rough estimate")).toBeInTheDocument();
    expect(container.querySelector(".cz-sizing")).not.toBe(null);
    expect(handlers.onSkipFitPrompt).not.toHaveBeenCalled();
  });

  it("4g: chest measurement against a chart shows the precise strip with math", () => {
    const handlers = trio();
    handlers.bodyProfile = { chest: "96" };
    const { container } = render(body(item("fit4g"), handlers));

    expect(screen.getByText("Precise fit")).toBeInTheDocument();
    const math = container.querySelector(".cz-fit4-math");
    expect(math).not.toBe(null);
    expect(math.textContent).toContain("You");
    expect(math.textContent).toContain("Garment");
    expect(math.textContent).toContain("Ease");
    expect(screen.queryByText("Rough estimate")).toBe(null);
  });
});

describe("DetailBody per-category fit preferences (5b/5c)", () => {
  const prefHandlers = (fitPrefs = null) => ({
    // Numbers, as measureToStorage saves them. A chest of 96 puts the base
    // pick at M — mid-ladder, so a looseness nudge has room to move.
    bodyProfile: { chest: 96 },
    fitPrefs,
    onSaveBodyProfile: vi.fn(),
    onSkipFitPrompt: vi.fn(),
    onSaveFitPref: vi.fn(),
  });

  it("5b: asks once per category and never blocks the card", () => {
    const handlers = prefHandlers();
    const { container } = render(body(item("fit5b"), handlers));

    expect(screen.getByText("How do you wear shirts?")).toBeInTheDocument();
    // The sizing verdict stays visible behind the ask.
    expect(container.querySelector(".cz-sizing")).not.toBe(null);

    fireEvent.click(screen.getByRole("radio", { name: "Oversized" }));
    fireEvent.click(screen.getByRole("button", { name: "Save preference" }));
    expect(handlers.onSaveFitPref).toHaveBeenCalledWith("shirt", {
      length: null,
      looseness: "oversized",
      dismissed: false,
    });
  });

  it("5b: Not sure yet dismisses without saving a choice", () => {
    const handlers = prefHandlers();
    render(body(item("fit5b-skip"), handlers));

    fireEvent.click(screen.getByRole("button", { name: "Not sure yet" }));
    expect(handlers.onSaveFitPref).toHaveBeenCalledWith("shirt", {
      length: null,
      looseness: null,
      dismissed: true,
    });
  });

  it("5c: an oversized preference shows base size, shift, reason and tags", () => {
    const handlers = prefHandlers({
      shirt: { length: null, looseness: "oversized", dismissed: false },
    });
    const { container } = render(body(item("fit5c"), handlers));

    // Taste shifted the letter — old size struck through, shift named.
    expect(container.querySelector(".cz-fit4-size-base")).not.toBe(null);
    expect(screen.getByText("sized up")).toBeInTheDocument();
    expect(screen.getByText(/so we bumped one size/)).toBeInTheDocument();
    // Tags + Edit carry the why; the math row stands down (clutter rule).
    expect(screen.getByText("Oversized")).toBeInTheDocument();
    expect(container.querySelector(".cz-fit4-math")).toBe(null);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByText("How do you wear shirts?")).toBeInTheDocument();
  });

  it("5c: a Shorts preference does not touch a Shirts card", () => {
    const handlers = prefHandlers({
      shirt: { length: null, looseness: null, dismissed: true },
      shorts: { length: null, looseness: "baggy", dismissed: false },
    });
    const { container } = render(body(item("fit5c-cross"), handlers));

    // Measurement-only verdict: math row, no shift, no borrowed tags.
    expect(container.querySelector(".cz-fit4-math")).not.toBe(null);
    expect(container.querySelector(".cz-fit4-size-base")).toBe(null);
    expect(screen.queryByText("Baggy")).toBe(null);
    expect(container.querySelector(".cz-fit4-pref-bar")).toBe(null);
  });
});
