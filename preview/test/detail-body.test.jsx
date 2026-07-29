import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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

describe("DetailBody detail facts", () => {
  it("shows all five facts sections at once, with no tabs", () => {
    // sellerAccount gives the item a store page, so the Seller row renders.
    render(body(item("facts", { sellerAccount: "replux" })));

    // Split rail: the old tab bar is gone; every fact is always visible.
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    expect(screen.queryAllByRole("tabpanel", { hidden: true })).toHaveLength(0);

    // Round 4: Size and fit leads, then the Details blocks (Bought, Haul,
    // Colorway, Weight, Seller). The rail "Size" section is gone — its editor
    // moved inside Size and fit, beside the big size word, visible with no tap.
    // Point 4: the Ordered row is now Bought, one small switch.
    for (const name of ["Size and fit", "Bought", "Haul", "Colorway", "Weight", "Seller"]) {
      expect(screen.getByRole("region", { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole("region", { name: "Size" })).toBeNull();
    const fit = screen.getByRole("region", { name: "Size and fit" });
    // Round 5 point 5.7: the odd-size box hides behind a quiet link; one tap
    // opens it. It is never gone — an odd size still has a field.
    fireEvent.click(within(fit).getByRole("button", { name: "Type a different size" }));
    expect(within(fit).getByLabelText("Custom item size")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Colorway" })).toBeInTheDocument();
    expect(screen.getByLabelText("Weight · g")).toBeInTheDocument();
  });

  // Shelf handoff 2026-07-28 (README :105), cut by round 4 (2026-07-29).
  // Every fact lives in one rail, in one order. Round 4 folded the rail Size
  // section into Size and fit and moved Category out to the ⋯ menu (the
  // desktop-detail-panel tests cover that row).
  it("draws the Details rail in the handoff order, Seller last", () => {
    render(body(item("order", { sellerAccount: "replux" })));

    const rail = document.querySelector(".cz-detail-facts");
    expect(rail).not.toBeNull();
    const order = Array.from(rail.querySelectorAll(".cz-detail-facts-section")).map((s) =>
      s.getAttribute("aria-label")
    );
    expect(order).toEqual([
      "Size and fit",
      "Bought",
      "Haul",
      "Colorway",
      "Weight",
      "Seller",
    ]);

    // The kicker splits "does it fit?" from "what is it?".
    expect(rail.querySelector(".cz-detail-facts-kicker").textContent).toBe("Details");
  });

  it("hides the Seller row when no store page exists, even with a seller name", () => {
    // Round 5 point 5.5, second cut (Oom 2026-07-29): the row names the
    // action, not the seller, and a row with nowhere to point is a dead row.
    // Weidian has no store page Credenza can build, so the row hides.
    render(body(item("order-weidian")));

    expect(screen.queryByRole("region", { name: "Seller" })).toBe(null);
    expect(screen.queryByRole("link", { name: /listings$/ })).toBe(null);
  });

  it("the Seller row opens the seller's other listings when a store page exists", () => {
    render(body(item("shop", { sellerAccount: "replux" })));

    // Round 5 point 5.5, second cut: the row names the action, not the
    // seller — the name lives in the title line and the timeline. The
    // accessible name keeps the seller for screen readers.
    const seller = screen.getByRole("link", { name: "Open replux listings" });
    expect(seller.getAttribute("target")).toBe("_blank");
    expect(seller.getAttribute("href")).toBe("https://replux.x.yupoo.com/");
    expect(seller.textContent).toContain("See other listings");
    expect(seller.textContent).not.toContain("replux");
  });

  it("drops the Seller row when the item has no seller", () => {
    render(body(item("noseller", { seller: "" })));

    expect(screen.queryByRole("region", { name: "Seller" })).toBe(null);
  });

  it("saves a direct size once and preserves Batch", () => {
    vi.useFakeTimers();
    const onSaveEdit = vi.fn();
    render(body(item("pick", { batch: "Batch A" }), { onSaveEdit }));

    // Round 5 point 5.1: the chart measurement cells are the picker now —
    // the plain chip row would say the same sizes twice, so it hides.
    fireEvent.click(screen.getByRole("button", { name: /^Large/ }));
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

    // Round 5 point 5.7: open the odd-size box first — it hides behind a
    // quiet link until asked for.
    fireEvent.click(screen.getByRole("button", { name: "Type a different size" }));
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

    // Round 5 point 5.7: the box opens from the quiet link.
    fireEvent.click(screen.getByRole("button", { name: "Type a different size" }));
    const input = screen.getByLabelText("Custom item size");
    fireEvent.change(input, { target: { value: "One size" } });
    fireEvent.blur(input);

    expect(onSaveEdit).toHaveBeenCalledWith(
      "custom-blur",
      expect.objectContaining({ size: "One size" })
    );
  });

  it("opens the odd-size box with no tap when the stored size matches no chip", () => {
    // Round 5 point 5.7, rule 4: an odd size must never hide. "170/92A" is
    // not on the chart, so the box renders open on its own.
    render(body(item("odd-size", { size: "170/92A" })));

    expect(screen.queryByRole("button", { name: "Type a different size" })).toBeNull();
    expect(screen.getByLabelText("Custom item size")).toHaveValue("170/92A");
  });

  it("keeps Colorway, Weight, and Haul editing inline in their sections", async () => {
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

    expect(screen.queryByRole("button", { name: "Done" })).toBe(null);
    await user.type(screen.getByRole("textbox", { name: "Colorway" }), "Navy");
    fireEvent.blur(screen.getByRole("textbox", { name: "Colorway" }));
    expect(onSaveEdit).toHaveBeenLastCalledWith(
      "panels",
      expect.objectContaining({ colorway: "Navy", batch: "Batch P" })
    );

    fireEvent.change(screen.getByLabelText("Weight · g"), { target: { value: "450" } });
    fireEvent.blur(screen.getByLabelText("Weight · g"));
    expect(onSaveEdit).toHaveBeenLastCalledWith(
      "panels",
      expect.objectContaining({ weightGrams: 450, batch: "Batch P" })
    );

    await user.click(screen.getByRole("button", { name: "Add to a haul…" }));
    await user.click(screen.getByRole("option", { name: "Summer" }));
    act(() => flushRef.current());
    expect(onSaveEdit).toHaveBeenLastCalledWith(
      "panels",
      expect.objectContaining({ project: "Summer", batch: "Batch P" })
    );
  });

  it("opens profile sizing from the fit read footnote", async () => {
    const user = userEvent.setup();
    const onOpenSizes = vi.fn();
    render(body(item("profile"), { onOpenSizes }));

    // Round 4 point 3 removed the "Edit sizes and measurements" button from
    // the chart actions; the route lives on the fit read footnote now.
    await user.click(screen.getByRole("button", { name: "Edit my measurements" }));
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

    // Round 4 point 5: an empty note is a small "Add a note" button; the box
    // opens on tap.
    fireEvent.click(screen.getByRole("button", { name: "Add a note" }));
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

    // Round 4 point 5: open the note writer before typing.
    fireEvent.click(screen.getByRole("button", { name: "Add a note" }));
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
