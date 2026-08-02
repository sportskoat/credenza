import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const { huntMock } = vi.hoisted(() => ({ huntMock: vi.fn() }));
vi.mock("../../components/size-chart-hunt.js", () => ({ huntSizeChart: huntMock }));

const { default: DetailBody } = await import("../../components/DetailBody.jsx");
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const CSS = readFileSync(join(ROOT, "credenza-fashion.css"), "utf8");

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
  it("opens the phone item sheet on Fit and switches between all three panes", async () => {
    const user = userEvent.setup();
    const first = item("phone-panes", {
      image: "data:image/png;base64,iVBORw0KGgo=",
      gallery: ["data:image/png;base64,iVBORw0KGgoA="],
    });
    const { container, rerender } = render(
      body(first, {
        heroPager: true,
        onRequestClose: vi.fn(),
        footerPrice: "$27.75",
      })
    );

    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Fit", "Photos · 2", "Details"]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(container.querySelector(".cz-detail-scroll")).toHaveAttribute("data-pane", "fit");

    await user.click(screen.getByRole("tab", { name: "Photos · 2" }));
    expect(container.querySelector(".cz-detail-scroll")).toHaveAttribute("data-pane", "photos");

    await user.click(screen.getByRole("tab", { name: "Details" }));
    expect(container.querySelector(".cz-detail-scroll")).toHaveAttribute("data-pane", "details");
    expect(container.querySelectorAll(".cz-detail-pane-command .cz-cmdbar-chip")).toHaveLength(5);

    rerender(
      body(item("phone-panes-next"), {
        heroPager: true,
        onRequestClose: vi.fn(),
        footerPrice: "$27.75",
      })
    );
    expect(container.querySelector(".cz-detail-scroll")).toHaveAttribute("data-pane", "fit");
  });

  it("uses the phone three-column fit read and the final chart-control copy", () => {
    render(
      body(item("phone-fit"), {
        heroPager: true,
        onRequestClose: vi.fn(),
        footerPrice: "$27.75",
      })
    );

    expect(screen.getByRole("button", { name: "Input sizing chart manually" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Type the numbers" })).toBeNull();
    expect(CSS).toContain("grid-template-columns: 76px 1fr 52px");
    expect(CSS).toContain(
      '.cz-detail-scroll.has-panes[data-pane="fit"] > .cz-detail-pane:not(.cz-detail-pane-fit)'
    );
  });

  it("shows the sizing block and the command bar at once, with no tabs", () => {
    render(body(item("facts")));

    // Split rail: the old tab bar is gone; every fact is always visible.
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    expect(screen.queryAllByRole("tabpanel", { hidden: true })).toHaveLength(0);

    // Item-detail handoff 2026-07-29, rule 1: "the rail is dead". Bought,
    // Haul, Colorway, Weight and Category were five labelled sections stacked
    // under the sizing block; they are five chips in one bar now. Size and fit
    // is the only section left, because it is the only thing the product
    // advises rather than the thing the customer sets.
    expect(screen.getByRole("region", { name: "Size and fit" })).toBeInTheDocument();
    for (const name of ["Bought", "Haul", "Colorway", "Weight", "Seller", "Size"]) {
      expect(screen.queryByRole("region", { name })).toBeNull();
    }
    const fit = screen.getByRole("region", { name: "Size and fit" });
    // Kyle 2026-07-29, BUILD_PLAN step 5.2: the fifth box is visible with no
    // tap, it stands in the same row as the sizes it overrides, and it wears
    // the same shape. It replaces round 5.7, which hid it behind a link.
    // This item carries a chart, so the row is the measurement cell run.
    const custom = within(fit).getByLabelText("Custom item size");
    expect(custom).toBeInTheDocument();
    expect(custom).toHaveClass("cz-sizing-cell");
    expect(custom.closest(".cz-sizing-chart")).not.toBeNull();
    // One box, never two: the plain chip row does not draw a second one.
    expect(within(fit).getAllByLabelText("Custom item size")).toHaveLength(1);

    // A chip's editor is closed until it is asked for. Rule 4, no empty
    // chrome: an unset value is a prompt inside the chip, never a blank field.
    expect(screen.queryByRole("textbox", { name: "Colorway" })).toBeNull();
    expect(screen.getByRole("button", { name: /Add a colorway/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add a weight/ })).toBeInTheDocument();
  });

  // Item-detail handoff 2026-07-29 §5: the chip order is fixed. Status leads
  // because it is the only chip that changes what the footer means. Category
  // came back out of the ⋯ menu and sits last (Kyle, 04:58).
  it("draws the command bar in the handoff chip order, seller pushed right", () => {
    render(body(item("order")));

    const bar = document.querySelector(".cz-cmdbar");
    expect(bar).not.toBeNull();
    const chips = Array.from(bar.querySelectorAll(".cz-cmdbar-chip")).map((chip) =>
      chip.getAttribute("data-chip")
    );
    expect(chips).toEqual(["status", "haul", "color", "weight", "category"]);

    // The Details kicker went with the rows it separated.
    expect(document.querySelector(".cz-detail-facts-kicker")).toBeNull();

    // Weidian has no store page Credenza can build, so the seller chip hides
    // (Oom 5.5 ruling: no name in the bar, no chip without a store page).
    expect(screen.queryByRole("link", { name: /replux/ })).toBe(null);
    expect(document.querySelector(".cz-cmdbar-seller")).toBeNull();
    expect(bar.textContent).not.toContain("replux");
  });

  it("the seller link opens the seller's other listings when a store page exists", () => {
    render(body(item("shop", { sellerAccount: "replux" })));

    // Seller opens the seller's other listings; it never edits.
    const seller = within(document.querySelector(".cz-cmdbar")).getByRole("link");
    expect(seller.getAttribute("target")).toBe("_blank");
    expect(seller.getAttribute("href")).toBe("https://replux.x.yupoo.com/");
  });

  it("drops the seller link when the item has no seller", () => {
    render(body(item("noseller", { seller: "" })));

    expect(document.querySelector(".cz-cmdbar-seller")).toBeNull();
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

  // Kept from the round-5 lane and still true under the command bar: a size
  // the chart never lists must reach the customer with no tap. The box is
  // always visible now, so the old "Type a different size" link is gone.
  it("shows an odd stored size in the box with no tap", () => {
    render(body(item("odd-size", { size: "170/92A" })));

    expect(screen.queryByRole("button", { name: "Type a different size" })).toBeNull();
    expect(screen.getByLabelText("Custom item size")).toHaveValue("170/92A");
  });

  it("edits colorway, weight and haul from their command-bar chips", async () => {
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

    await user.click(screen.getByRole("button", { name: /Add a colorway/ }));
    await user.type(screen.getByRole("textbox", { name: "Colorway" }), "Navy");
    fireEvent.blur(screen.getByRole("textbox", { name: "Colorway" }));
    expect(onSaveEdit).toHaveBeenLastCalledWith(
      "panels",
      expect.objectContaining({ colorway: "Navy", batch: "Batch P" })
    );

    await user.click(screen.getByRole("button", { name: /Add a weight/ }));
    fireEvent.change(screen.getByLabelText("Weight · g"), { target: { value: "450" } });
    fireEvent.blur(screen.getByLabelText("Weight · g"));
    expect(onSaveEdit).toHaveBeenLastCalledWith(
      "panels",
      expect.objectContaining({ weightGrams: 450, batch: "Batch P" })
    );

    await user.click(screen.getByRole("button", { name: /Add to a haul/ }));
    await user.click(screen.getByRole("menuitemradio", { name: /Summer/ }));
    act(() => flushRef.current());
    expect(onSaveEdit).toHaveBeenLastCalledWith(
      "panels",
      expect.objectContaining({ project: "Summer", batch: "Batch P" })
    );
  });

  // §5.3: one `menu` key, not a boolean per menu. Opening any chip must close
  // whatever was open, or two popovers end up on screen together.
  it("keeps one command-bar popover open at a time", async () => {
    const user = userEvent.setup();
    render(body(item("onemenu"), { haulNames: ["Summer"] }));

    await user.click(screen.getByRole("button", { name: /Add a colorway/ }));
    expect(screen.getByRole("menu", { name: "Colorway" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Add to a haul/ }));
    expect(screen.getByRole("menu", { name: "Haul" })).toBeInTheDocument();
    expect(screen.queryByRole("menu", { name: "Colorway" })).toBeNull();

    // Escape closes the popover and leaves the panel alone.
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu", { name: "Haul" })).toBeNull();
  });

  // Round 4 point 4 (Kyle): two stops, not seven. The shelf stores "want" and
  // "bought" and nothing else, so the menu offers exactly those two.
  it("offers two status steps and writes the one that is picked", async () => {
    const user = userEvent.setup();
    const onSaveEdit = vi.fn();
    render(body(item("status"), { onSaveEdit }));

    await user.click(screen.getByRole("button", { name: /Want/ }));
    const steps = screen.getAllByRole("menuitemradio");
    expect(steps.map((step) => step.textContent)).toEqual([
      "Wantsaved, nothing sent",
      "Boughthanded to your agent",
    ]);

    await user.click(screen.getByRole("menuitemradio", { name: /Bought/ }));
    expect(onSaveEdit).toHaveBeenLastCalledWith(
      "status",
      expect.objectContaining({ findStatus: "bought" })
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
    expect(screen.getByLabelText("Trouser length in cm")).toBeInTheDocument();
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
    // Fit engine v2: the taste now widens the room the pick aims for, so it
    // only moves the letter when a wider band actually reaches another row.
    // CHART_TEXT is M 116 / L 120 / XL 124. A 108cm chest wants 113–118cm on
    // the regular knit band (M), and 123–133cm on the oversized band (XL).
    const { container } = render(
      body(item("fit5c"), { ...handlers, bodyProfile: { chest: 108 } })
    );

    // Taste shifted the letter — old size struck through, shift named.
    expect(container.querySelector(".cz-fit4-size-base")).not.toBe(null);
    expect(screen.getByText("sized up")).toBeInTheDocument();
    // The reason names the room in centimetres, so the change is visible.
    expect(screen.getByText(/so we sized for 15–25cm of room/)).toBeInTheDocument();
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

  // Desktop Fit row (2026-08-02): short pref control left of Verified fit.
  // titleTarget !== undefined flips the editorial / desktop layout.
  it("desktop: saved looseness shows as short underlined control left of the badge", () => {
    const handlers = prefHandlers({
      shirt: { length: null, looseness: "regular", dismissed: false },
    });
    const { container } = render(
      body(item("fit-pref-toggle"), { ...handlers, titleTarget: null })
    );

    const prefBtn = container.querySelector(".cz-fit-result-pref");
    expect(prefBtn).not.toBe(null);
    expect(prefBtn.textContent).toBe("Regular");
    const trail = container.querySelector(".cz-fit-result-trail");
    expect(trail).not.toBe(null);
    expect(trail.querySelector(".cz-fit-result-badge")).not.toBe(null);
    // Control sits before the badge in the trail group.
    expect(trail.children[0]).toBe(prefBtn);
    expect(trail.children[1].classList.contains("cz-fit-result-badge")).toBe(true);

    fireEvent.click(prefBtn);
    expect(screen.getByText("How do you wear shirts?")).toBeInTheDocument();
  });

  it("desktop: no saved choice invites set with the same control", () => {
    const handlers = prefHandlers({
      shirt: { length: null, looseness: null, dismissed: true },
    });
    const { container } = render(
      body(item("fit-pref-toggle-empty"), { ...handlers, titleTarget: null })
    );

    const prefBtn = container.querySelector(".cz-fit-result-pref");
    expect(prefBtn).not.toBe(null);
    expect(prefBtn.textContent).toBe("Set your fit preference");
  });

  it("phone: no pref control beside the result badge", () => {
    const handlers = prefHandlers({
      shirt: { length: null, looseness: "regular", dismissed: false },
    });
    const { container } = render(body(item("fit-pref-toggle-phone"), handlers));

    expect(container.querySelector(".cz-fit-result-pref")).toBe(null);
    expect(container.querySelector(".cz-fit-result")).toBe(null);
  });
});

// Kyle 2026-07-29: he tapped Large and the panel kept printing the Small's
// centimetres. Fable's ruling: the numbers follow the tap, and the advice line
// still names the size we would take. These tests read the NUMBER out of the
// panel after the tap — the first check of this fault compared the panel's
// whole text, which changes on any tap, so a frozen number slipped through.
describe("DetailBody size tap drives the numbers", () => {
  // CHART_TEXT is M 116 / L 120 / XL 124; a 96cm chest wants 108cm, so the
  // recommendation is the M. The profile holds numbers, the shape
  // measureToStorage saves.
  // onSaveBodyProfile is what lets the confidence strip render at all.
  const chestOnly = () => ({ bodyProfile: { chest: 96 }, onSaveBodyProfile: vi.fn() });
  const garmentText = (container) => {
    const cells = [...container.querySelectorAll(".cz-fit4-math-cell")];
    const cell = cells.find((n) => n.textContent.startsWith("Garment"));
    return cell ? cell.querySelector(".cz-fit4-math-v").textContent : "";
  };
  const tapSize = (container, label) => {
    const cells = [...container.querySelectorAll(".cz-sizing-chart .cz-sizing-cell")];
    const cell = cells.find((n) => {
      const k = n.querySelector(".cz-sizing-cell-k");
      return k && k.textContent === label;
    });
    expect(cell).toBeTruthy();
    fireEvent.click(cell);
  };

  it("prints the tapped size's garment measurement, not the recommendation's", () => {
    const { container } = render(body(item("tap-num"), chestOnly()));

    expect(garmentText(container)).toBe("116cm");

    tapSize(container, "Large");
    expect(garmentText(container)).toBe("120cm");

    tapSize(container, "X-Large");
    expect(garmentText(container)).toBe("124cm");
  });

  it("moves the fit read table onto the tapped size too", () => {
    const { container } = render(body(item("tap-table"), chestOnly()));

    const theirs = () =>
      [...container.querySelectorAll(".cz-fitread-theirs")].map((n) => n.textContent);
    expect(theirs()).toContain("116cm");

    tapSize(container, "X-Large");
    expect(theirs()).toContain("124cm");
    expect(theirs()).not.toContain("116cm");
  });

  it("keeps the recommendation in the qualifier when the tap disagrees", () => {
    const { container } = render(body(item("tap-say"), chestOnly()));

    tapSize(container, "Large");
    expect(container.querySelector(".cz-sizing-aside").textContent).toBe(
      "your pick · we'd take the Medium"
    );
    // Concise is the default, so the sentence stops at the pick. The
    // qualifier above carries our advice on every setting.
    expect(screen.getByText(/You have picked the Large\./)).toBeInTheDocument();
  });

  it("names the size we'd take in the detailed sentence", () => {
    render(body(item("tap-detail"), { ...chestOnly(), fitDetail: "detailed" }));

    const cells = [...document.querySelectorAll(".cz-sizing-chart .cz-sizing-cell")];
    fireEvent.click(cells.find((n) => n.querySelector(".cz-sizing-cell-k").textContent === "Large"));

    expect(
      screen.getByText(/You have picked the Large\..*The Medium is the one we'd take\./)
    ).toBeInTheDocument();
  });

  it("a second tap on the picked cell keeps the pick (Kyle 2026-07-31)", () => {
    const { container } = render(body(item("tap-stay"), chestOnly()));

    tapSize(container, "Large");
    expect(garmentText(container)).toBe("120cm");
    // The second tap used to clear the hand pick and drop back to the
    // recommendation. Redundant, says Kyle — the pick stays.
    tapSize(container, "Large");
    expect(garmentText(container)).toBe("120cm");
    expect(container.querySelector(".cz-sizing-aside").textContent).toBe(
      "your pick · we'd take the Medium"
    );
  });

  it("agrees out loud when the tap lands on the recommendation", () => {
    const { container } = render(body(item("tap-agree"), chestOnly()));

    tapSize(container, "Medium");
    expect(container.querySelector(".cz-sizing-aside").textContent).toBe(
      "we recommend this · 20cm of room"
    );
    expect(screen.queryByText(/we'd take the/)).toBe(null);
  });
});

// SIZE_CHIP_COMPACT_PLAN (2026-07-29): the no-chart chip run prints the
// short size mark ("XL") so four chips plus the Other box fit one row. The
// full word moves to the aria-label; the card face and hero line keep it.
describe("DetailBody compact size chips (no chart)", () => {
  const chipItem = (id, values) =>
    item(id, {
      sizeNotes: "",
      sizeChartSource: null,
      variants: [{ title: "Size", values }],
    });
  const chipRow = (container) => container.querySelector(".cz-detail-size-choices");

  it("prints the short mark on the chip, the full word in the aria-label", () => {
    const { container } = render(body(chipItem("chip-compact", ["M", "L", "XL", "XXL"])));

    const row = chipRow(container);
    expect(row).not.toBeNull();
    const labels = [...row.querySelectorAll("button")].map((b) => b.textContent);
    expect(labels).toEqual(["M", "L", "XL", "XXL"]);
    expect(row.textContent).not.toContain("X-Large");
    expect(within(row).getByRole("button", { name: "X-Large" }).textContent).toBe("XL");
    expect(within(row).getByRole("button", { name: "Medium" }).textContent).toBe("M");
  });

  it("prints Free for a 均码 token", () => {
    const { container } = render(body(chipItem("chip-free", ["均码"])));

    const chip = within(chipRow(container)).getByRole("button", { name: "Free size" });
    expect(chip.textContent).toBe("Free");
  });

  it("shows Clear size once a chip is picked, and the tap still picks", () => {
    const { container } = render(body(chipItem("chip-clear", ["M", "L", "XL", "XXL"])));

    expect(screen.queryByRole("button", { name: "Clear size" })).toBeNull();
    fireEvent.click(within(chipRow(container)).getByRole("button", { name: "X-Large" }));
    // Oom 2026-07-29: the proof row is the full row — a sixth box appears
    // once a size is chosen.
    expect(screen.getByRole("button", { name: "Clear size" })).toBeInTheDocument();
    expect(
      within(chipRow(container)).getByRole("button", { name: "X-Large" })
    ).toHaveAttribute("aria-pressed", "true");
  });
});
