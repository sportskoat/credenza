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
    // Chip bar hides on Details — the mock list owns the five fact rows.
    expect(container.querySelectorAll(".cz-detail-pane-command .cz-cmdbar-chip")).toHaveLength(0);
    const detailsPane = container.querySelector(".cz-detail-pane-history");
    expect(detailsPane).toBeTruthy();
    expect(detailsPane.querySelector(".cz-cmdbar-list")).toBeTruthy();
    expect(detailsPane.querySelectorAll(".cz-cmdbar-list-row")).toHaveLength(5);
    // Phone Details parity with mock page 3b: Status / Haul / Colorway / Weight /
    // Category + HISTORY + always-visible Notes field. American spelling only.
    expect(within(detailsPane).getByText("Status")).toBeInTheDocument();
    expect(within(detailsPane).getByText("Haul")).toBeInTheDocument();
    expect(within(detailsPane).getByText("Colorway")).toBeInTheDocument();
    expect(within(detailsPane).getByText("Weight")).toBeInTheDocument();
    expect(within(detailsPane).getByText("Category")).toBeInTheDocument();
    expect(within(detailsPane).getByText("History")).toBeInTheDocument();
    expect(within(detailsPane).getByLabelText("Notes")).toBeInTheDocument();
    expect(within(detailsPane).queryByRole("button", { name: /Add a note/i })).toBeNull();
    expect(detailsPane.textContent).not.toMatch(/Colourway/);
    // wantsStickyBar = heroPager && onRequestClose (DetailBody). Phone sheet
    // always passes both for a normal item — the fact list is gated on that.
    // Without the gate the Details pane would render empty (no list rows).
    expect(container.querySelector(".cz-detail-pane-picker")).toBeTruthy();
    expect(detailsPane.querySelectorAll(".cz-cmdbar-list-row")).toHaveLength(5);

    rerender(
      body(item("phone-panes-next"), {
        heroPager: true,
        onRequestClose: vi.fn(),
        footerPrice: "$27.75",
      })
    );
    expect(container.querySelector(".cz-detail-scroll")).toHaveAttribute("data-pane", "fit");
  });

  // F 2026-08-02: phone fact rows live behind wantsStickyBar. Prove the gate
  // is false without heroPager/onRequestClose so a missing prop cannot silently
  // empty the pane without a failing pin.
  it("hides phone Details fact rows when wantsStickyBar is false", () => {
    const { container } = render(
      body(item("phone-no-sticky", {
        image: "data:image/png;base64,iVBORw0KGgo=",
      }), {
        // No heroPager / onRequestClose → wantsStickyBar false
        footerPrice: "$27.75",
      })
    );
    // No pane picker — sticky bar path is off.
    expect(container.querySelector(".cz-detail-pane-picker")).toBeNull();
    const detailsPane = container.querySelector(".cz-detail-pane-history");
    expect(detailsPane).toBeTruthy();
    // Fact list is gated; History + notes still render outside the gate.
    expect(detailsPane.querySelector(".cz-cmdbar-list")).toBeNull();
    expect(within(detailsPane).getByText("History")).toBeInTheDocument();
  });

  // Mobile item 1 (2026-08-02): phone sheet scrollport never formed because the
  // middle wrapper was unclassed and sized to content. Named shell + constraint
  // rules pin the fix; overscroll contain stays on the sheet scroller.
  it("wraps the phone scroller in cz-sheet-shell so the scrollport can form", () => {
    const { container } = render(
      body(item("phone-shell"), {
        heroPager: true,
        onRequestClose: vi.fn(),
        footerPrice: "$27.75",
      })
    );
    const scroll = container.querySelector(".cz-detail-scroll");
    expect(scroll).not.toBeNull();
    const shell = scroll.closest(".cz-sheet-shell");
    expect(shell, "phone middle wrapper must be .cz-sheet-shell").not.toBeNull();
    expect(shell.querySelector(".cz-detail-scroll")).toBe(scroll);
    expect(container.querySelector(".cz-fit-shell")).toBeNull();
  });

  it("pins cz-sheet-shell flex constraint and sheet-scroller overscroll contain", () => {
    expect(CSS).toMatch(
      /\.cz-sheet-shell\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*flex:\s*1\s+1\s+0;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/s
    );
    expect(CSS).toMatch(
      /\.cz-detail-scroll\s*\{[^}]*overflow-y:\s*auto;[^}]*overscroll-behavior:\s*contain;/s
    );
  });

  // Mobile item 4 (2026-08-02): active section tab used --cz-ink on a white
  // --cz-seg-on pill (light-on-white on Blackout). Same fault class as #49.
  // Active label must follow the segment-on text token.
  it("pins active pane-tab label color to the segment-on text token", () => {
    expect(CSS).toMatch(
      /\.cz-detail-pane-picker button\.is-active\s*\{[^}]*color:\s*var\(--cz-seg-on-text\);/s
    );
    expect(CSS).toMatch(
      /\.cz-app\[data-fashion="true"\] \.cz-detail-pane-picker\.t-tabs\s*\{[^}]*--tabs-pill-bg:\s*var\(--cz-seg-on\);[^}]*--tabs-text-active:\s*var\(--cz-seg-on-text\);/s
    );
  });

  it("uses the phone three-column fit read and the final chart-control copy", () => {
    render(
      body(item("phone-fit"), {
        heroPager: true,
        onRequestClose: vi.fn(),
        footerPrice: "$27.75",
      })
    );

    expect(screen.getByRole("button", { name: "Type the chart" })).toBeInTheDocument();
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

    // Weidian has no store homepage Credenza can build, so the bar's "See
    // other listings" chip stays hidden (Oom 5.5). The title subline still
    // links the seller name to the listing URL (Kyle 2026-08-02).
    expect(document.querySelector(".cz-cmdbar-seller")).toBeNull();
    expect(bar.textContent).not.toContain("replux");
    const sub = document.querySelector(".cz-detail-sub");
    expect(sub).not.toBeNull();
    const nameLink = within(sub).getByRole("link", { name: /replux/i });
    expect(nameLink.getAttribute("href")).toBe(
      "https://weidian.com/item.html?itemID=order"
    );
    expect(nameLink.getAttribute("target")).toBe("_blank");
  });

  it("the seller link opens the seller's other listings when a store page exists", () => {
    render(body(item("shop", { sellerAccount: "replux" })));

    // Bar: "See other listings" opens the Yupoo store. Title: name is also a link.
    const seller = within(document.querySelector(".cz-cmdbar")).getByRole("link");
    expect(seller.getAttribute("target")).toBe("_blank");
    expect(seller.getAttribute("href")).toBe("https://replux.x.yupoo.com/");
    const sub = document.querySelector(".cz-detail-sub");
    expect(within(sub).getByRole("link", { name: /replux/i }).getAttribute("href")).toBe(
      "https://replux.x.yupoo.com/"
    );
  });

  it("drops the seller link when the item has no seller", () => {
    render(body(item("noseller", { seller: "" })));

    expect(document.querySelector(".cz-cmdbar-seller")).toBeNull();
    expect(document.querySelector(".cz-detail-sub a")).toBeNull();
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

  // F/C 2026-08-02 pin: category pick + pending note draft must not restore
  // the old category on flush (buildEditPatch used to carry draft.category).
  it("mirrors a category pick into an open draft so flush keeps Shorts", async () => {
    const user = userEvent.setup();
    const onSaveEdit = vi.fn();
    const flushRef = { current: null };
    render(
      body(item("cat-stick", { category: "other", note: "old note" }), {
        onSaveEdit,
        flushRef,
      })
    );

    // Open a pending note draft first (the race Kyle hit).
    fireEvent.change(screen.getByLabelText("Notes"), {
      target: { value: "pending while picking category" },
    });

    // Details list layout on phone sticky; chip bar on flip card. Prefer the
    // Category control that is currently mounted.
    const catChip = document.querySelector('[data-chip="category"]');
    if (catChip) {
      await user.click(catChip);
    } else {
      // Desktop-ish: open Details if needed and find the Category row.
      const detailsTab = screen.queryByRole("tab", { name: /^Details$/ });
      if (detailsTab) await user.click(detailsTab);
      await user.click(screen.getByRole("button", { name: /Category/i }));
    }
    const list = await screen.findByRole("menu", { name: "Category" });
    await user.click(within(list).getByRole("menuitemradio", { name: /Shorts/i }));

    expect(onSaveEdit).toHaveBeenCalledWith(
      "cat-stick",
      expect.objectContaining({ category: "shorts", categoryManual: true })
    );

    // Debounced flush of the note draft must NOT write category: "other".
    act(() => flushRef.current());
    const flushCalls = onSaveEdit.mock.calls.filter(
      ([id, patch]) => id === "cat-stick" && patch && "note" in patch
    );
    expect(flushCalls.length).toBeGreaterThan(0);
    const lastFlush = flushCalls[flushCalls.length - 1][1];
    expect(lastFlush.category).toBe("shorts");
    expect(lastFlush.note).toContain("pending");
  });

  it("resets scrollTop when desktop Fit → Details → Fit", async () => {
    const user = userEvent.setup();
    // titleTarget marks the desktop panel path (tabs Fit/Details/Settings).
    const titleHost = document.createElement("div");
    document.body.appendChild(titleHost);
    const { container } = render(
      body(item("scroll-tabs"), { titleTarget: titleHost })
    );
    const scroll = container.querySelector(".cz-detail-scroll");
    expect(scroll).not.toBe(null);
    scroll.scrollTop = 400;
    expect(scroll.scrollTop).toBe(400);

    await user.click(screen.getByRole("tab", { name: "Details" }));
    expect(scroll.scrollTop).toBe(0);

    scroll.scrollTop = 280;
    await user.click(screen.getByRole("tab", { name: "Fit" }));
    expect(scroll.scrollTop).toBe(0);
    // Measurement block re-mounts with openRead still true.
    expect(
      screen.getByRole("button", { name: /Measurement by measurement/i })
    ).toHaveAttribute("aria-expanded", "true");
    titleHost.remove();
  });

  it("resets scrollTop when phone Fit → Details → Fit", async () => {
    const user = userEvent.setup();
    const { container } = render(
      body(item("scroll-phone", {
        image: "data:image/png;base64,iVBORw0KGgo=",
        gallery: ["data:image/png;base64,iVBORw0KGgoA="],
      }), {
        heroPager: true,
        onRequestClose: vi.fn(),
      })
    );
    const scroll = container.querySelector(".cz-detail-scroll");
    expect(scroll).not.toBe(null);
    scroll.scrollTop = 320;

    await user.click(screen.getByRole("tab", { name: /Details/ }));
    expect(scroll.scrollTop).toBe(0);

    scroll.scrollTop = 200;
    await user.click(screen.getByRole("tab", { name: /^Fit$/ }));
    expect(scroll.scrollTop).toBe(0);
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

    // Kyle 2026-08-02: notes field is always visible — type without an Add step.
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

    // Kyle 2026-08-02: notes field is always visible.
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
  it("keeps the desktop price money-green, larger, and the agent button flush", () => {
    const priceRule = CSS.match(
      /\.cz-dpanel-footer-slot \.cz-detail-foot-price\s*\{([^}]*)\}/
    )?.[1];
    const toggleRule = CSS.match(
      /\.cz-dpanel-footer-slot \.cz-buy-notch-toggle\s*\{([^}]*)\}/
    )?.[1];

    // Kyle 2026-08-02: green + bigger — --cz-money (not --cz-accent/ink).
    expect(priceRule).toContain("color: var(--cz-money)");
    expect(priceRule).toMatch(/font-size:\s*16px/);
    expect(priceRule).not.toContain("color: var(--cz-ink)");
    expect(priceRule).not.toContain("color: #050506");
    // Base + surface keep money-green; size bump is footer-slot only.
    expect(CSS).toMatch(
      /\.cz-detail-foot-price\s*\{[^}]*color:\s*var\(--cz-money\)/s
    );
    expect(toggleRule).toContain("border: 0");
    expect(toggleRule).toContain("border-left: 1px solid #050506");
  });

  it("lets desktop Details and Settings tabs fill the column (no 520px cap)", () => {
    // Kyle 2026-08-02: mock 3a — Status/Haul rows and measurements stretch
    // edge-to-edge. A max-width on .cz-desk-tab was boxing them left.
    const start = CSS.indexOf(".cz-desk-tab {");
    expect(start).toBeGreaterThan(-1);
    const block = CSS.slice(start, start + 280);
    expect(block).toMatch(/width:\s*100%/);
    expect(block).not.toMatch(/max-width:\s*520px/);
    // Shared class — both .cz-desk-tab-details and .cz-desk-tab-settings.
    expect(CSS).not.toMatch(
      /\.cz-desk-tab(-details|-settings)?\s*\{[^}]*max-width:\s*520px/s
    );
  });

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

// CH-08 (designs 4d–4g) + the A1 first-size ask (onboarding handoff).
// The old three-way chooser is gone: the README ship path is A0 → A1 → A2 → A3
// and its Definition of Done caps the first pick at two taps. A cold card now
// opens on the ask. The tape field stays reachable from the A1 link.
describe("DetailBody no-measurements flow", () => {
  const trio = () => ({
    bodyProfile: null,
    onSaveBodyProfile: vi.fn(),
    onSkipFitPrompt: vi.fn(),
  });

  it("A1: empty profile opens on the ask, not on a fabricated size", () => {
    const { container } = render(body(item("fit4d"), trio()));

    expect(screen.getByText("What size do you usually buy?")).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 2")).toBeInTheDocument();
    // The chooser cost a third tap and never appeared in the README.
    expect(screen.queryByText("How should we size you?")).toBe(null);
    expect(screen.queryByRole("button", { name: /Match with a shirt/i })).toBe(null);
    // No sizing verdict renders — no AI pick, no usual, no provenance.
    expect(container.querySelector(".cz-sizing-nochart")).toBe(null);
    expect(container.querySelector(".cz-fit4-math")).toBe(null);
  });

  it("A5 tape: tops ask chest pit-to-pit; bottoms ask waist", () => {
    const shorts = item("fit4f-shorts", { category: "shorts", sizeNotes: "" });
    const first = render(body(shorts, trio()));
    fireEvent.click(screen.getByRole("button", { name: /I have a tape/i }));
    expect(screen.getByLabelText(/Waist/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Chest/i)).toBe(null);
    first.unmount();

    render(body(item("fit4f-tee"), trio()));
    fireEvent.click(screen.getByRole("button", { name: /I have a tape/i }));
    expect(screen.getByLabelText(/Chest/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Waist/i)).toBe(null);
  });

  it("A5 tape: save doubles pit-to-pit chest and calls onSaveBodyProfile", () => {
    const handlers = trio();
    render(body(item("fit4f-save"), handlers));
    fireEvent.click(screen.getByRole("button", { name: /I have a tape/i }));
    fireEvent.change(screen.getByLabelText(/Chest/i), { target: { value: "48" } });
    fireEvent.click(screen.getByRole("button", { name: /Save and re-score my cards/i }));

    expect(handlers.onSaveBodyProfile).toHaveBeenCalledWith(
      expect.objectContaining({ chest: 96, firstSizeSource: "measure" })
    );
  });

  it("4f: skip with a usual size returns to the rough state, not blank", () => {
    const handlers = trio();
    handlers.bodyProfile = { usualSize: "L" };
    const { container } = render(body(item("fit4e"), handlers));

    // 4e: rough estimate strip with the category's sharpen ask.
    expect(screen.getByText("Rough estimate")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Add chest/ }));
    fireEvent.click(screen.getByRole("button", { name: "Skip, keep the rough size" }));

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

    // Kyle 2026-08-03: "there is no sign here that lets you save … You can't
    // get out of it". Save is always there now. It does not wait for a change.
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Oversized" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(handlers.onSaveFitPref).toHaveBeenCalledWith("shirt", {
      length: null,
      looseness: "oversized",
      dismissed: false,
    });
  });

  // Kyle 2026-08-03: "You can't get out of it." The X leaves and saves nothing.
  it("5b: the X closes the fit question and saves nothing", () => {
    const handlers = prefHandlers();
    const { container } = render(body(item("fit5b-close"), handlers));

    expect(screen.getByText("How do you wear shirts?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(handlers.onSaveFitPref).not.toHaveBeenCalled();
    expect(container.querySelector(".cz-fit-pref-ask")).toBe(null);
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
    // Bottom "You wear … Change" card is gone — top control is the only Change.
    expect(container.querySelector(".cz-fit-pref")).toBe(null);
    expect(screen.queryByText(/You wear shirts/i)).toBe(null);
    expect(screen.queryByRole("button", { name: "Change" })).toBe(null);

    fireEvent.click(prefBtn);
    expect(screen.getByText("How do you wear shirts?")).toBeInTheDocument();
  });

  it("desktop: no saved choice invites set with the same control", () => {
    const handlers = prefHandlers();
    const { container } = render(
      body(item("fit-pref-toggle-empty"), { ...handlers, titleTarget: null })
    );

    const prefBtn = container.querySelector(".cz-fit-result-pref");
    expect(prefBtn).not.toBe(null);
    expect(prefBtn.textContent).toBe("Set your fit preference");
  });

  // Kyle 2026-08-03: "If you click Not Sure Yet, now it says 'Set your fit
  // preferences'". The app looked like it forgot the answer. It did not.
  it("desktop: says the preference is not set after 'Not sure yet'", () => {
    const handlers = prefHandlers({
      shirt: { length: null, looseness: null, dismissed: true },
    });
    const { container } = render(
      body(item("fit-pref-toggle-dismissed"), { ...handlers, titleTarget: null })
    );

    const prefBtn = container.querySelector(".cz-fit-result-pref");
    expect(prefBtn).not.toBe(null);
    expect(prefBtn.textContent).toBe("Fit preference: not set");
  });

  // Kyle 2026-08-03: "set your fit preferences does not take you anywhere".
  // Credenza only holds fit questions for four categories. On any other
  // category the ask panel renders nothing, so the button led to a blank.
  // The button now appears only where a question exists.
  it("desktop: shows the pref control only on a category with a fit question", () => {
    const handlers = prefHandlers();
    const withCategory = (id, category) =>
      render(body(item(id, { category }), { ...handlers, titleTarget: null }));

    for (const category of ["shirt", "pants", "shorts", "outerwear"]) {
      const { container, unmount } = withCategory("fit-pref-" + category, category);
      expect(container.querySelector(".cz-fit-result-pref")).not.toBe(null);
      unmount();
    }

    for (const category of ["shoes", "accessory", "socks", "bag", "hat", "other"]) {
      const { container, unmount } = withCategory("fit-pref-" + category, category);
      expect(container.querySelector(".cz-fit-result-pref")).toBe(null);
      unmount();
    }
  });

  // The panel opens below the size cells. On a tall card it opened off screen,
  // so the press looked dead. It now brings itself into view.
  it("desktop: scrolls the fit ask into view when it opens", () => {
    const scrollIntoView = vi.fn();
    const proto = window.HTMLElement.prototype;
    const had = Object.prototype.hasOwnProperty.call(proto, "scrollIntoView");
    const prior = proto.scrollIntoView;
    proto.scrollIntoView = scrollIntoView;
    try {
      const handlers = prefHandlers({
        shirt: { length: null, looseness: "regular", dismissed: false },
      });
      const { container } = render(
        body(item("fit-pref-reveal"), { ...handlers, titleTarget: null })
      );
      expect(container.querySelector(".cz-fit-pref-ask")).toBe(null);
      scrollIntoView.mockClear();

      fireEvent.click(container.querySelector(".cz-fit-result-pref"));
      expect(container.querySelector(".cz-fit-pref-ask")).not.toBe(null);
      expect(scrollIntoView).toHaveBeenCalled();
    } finally {
      if (had) proto.scrollIntoView = prior;
      else delete proto.scrollIntoView;
    }
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

  // Kyle / F 2026-08-02: when the tapped size equals the recommendation,
  // headline says "recommended pick" in green, not "your pick".
  it("editorial: tap equal to rec says recommended pick in green", () => {
    const { container } = render(
      body(item("tap-rec-agree"), { ...chestOnly(), titleTarget: null })
    );

    tapSize(container, "Medium");
    const aside = container.querySelector(".cz-fit-result-aside");
    expect(aside).not.toBe(null);
    expect(aside.textContent).toMatch(/recommended pick/i);
    expect(aside.textContent).not.toMatch(/your pick/i);
    expect(aside.classList.contains("is-rec")).toBe(true);
    expect(CSS).toMatch(/\.cz-fit-result-aside\.is-rec\s*\{[^}]*var\(--cz-money\)/s);
  });

  it("editorial: tap that disagrees keeps your pick, we'd take the X", () => {
    const { container } = render(
      body(item("tap-rec-disagree"), { ...chestOnly(), titleTarget: null })
    );

    tapSize(container, "Large");
    const aside = container.querySelector(".cz-fit-result-aside");
    expect(aside).not.toBe(null);
    expect(aside.textContent).toMatch(/your pick,\s*we'd take the Medium/i);
    expect(aside.classList.contains("is-rec")).toBe(false);
  });

  it("phone kicker: Recommended pick in green when tap equals rec", () => {
    const { container } = render(body(item("tap-kicker-rec"), chestOnly()));

    tapSize(container, "Medium");
    const kicker = container.querySelector(".cz-sizing-kicker");
    expect(kicker).not.toBe(null);
    expect(kicker.textContent).toBe("Recommended pick");
    expect(kicker.classList.contains("is-rec")).toBe(true);
    expect(CSS).toMatch(
      /\.cz-sizing\.is-manual\s+\.cz-sizing-kicker\.is-rec\s*\{[^}]*var\(--cz-money\)/s
    );
  });

  it("phone kicker: Your pick when the tap disagrees with rec", () => {
    const { container } = render(body(item("tap-kicker-dis"), chestOnly()));

    tapSize(container, "Large");
    const kicker = container.querySelector(".cz-sizing-kicker");
    expect(kicker).not.toBe(null);
    expect(kicker.textContent).toBe("Your pick");
    expect(kicker.classList.contains("is-rec")).toBe(false);
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
