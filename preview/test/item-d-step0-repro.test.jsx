// Item D — D1/D4/D5 FIXED pins (D2/D3 already live; not re-built).
// Spec: PLANS/ITEM_D_INTRO_POLISH_SPEC_2026_08_03.md
// O go 2026-08-04: D1/D4/D5 only; reuse existing no-chart copy; no new provenance.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { huntMock } = vi.hoisted(() => ({
  huntMock: vi.fn(),
}));

vi.mock("../../components/size-chart-hunt.js", async () => {
  const actual = await vi.importActual("../../components/size-chart-hunt.js");
  return { ...actual, huntSizeChart: huntMock };
});

const { default: DetailBody } = await import("../../components/DetailBody.jsx");
const { default: FirstSizeBlock } = await import("../../components/FirstSizeBlock.jsx");

function variantsRun(values) {
  return [{ title: "Size", values }];
}

function chartlessItem(extra = {}) {
  return {
    id: "item-d-repro",
    createdAt: 1753400000000,
    url: "https://weidian.com/item.html?itemID=item-d",
    title: "o*n joggers",
    image: "https://si.geilicdn.com/img-1.jpg",
    gallery: [
      "https://si.geilicdn.com/a.jpg",
      "https://si.geilicdn.com/b.jpg",
      "https://si.geilicdn.com/c.jpg",
    ],
    seller: "on-joggers",
    category: "pants",
    findStatus: "want",
    variants: variantsRun([
      "M100-130斤",
      "L130-150斤",
      "XL150-170斤",
      "XXL170-185斤",
      "XXXL185-200斤",
    ]),
    ...extra,
  };
}

function renderFit(item, extra = {}) {
  // titleTarget !== undefined = desktop Fit panel path (same as Kyle's frames).
  const titleHost = document.createElement("div");
  document.body.appendChild(titleHost);
  return render(
    <DetailBody
      item={item}
      bodyProfile={extra.bodyProfile ?? { height: "183", weight: "75", usualTops: "L", usualBottoms: "L" }}
      buyLabel="Buy via Superbuy"
      onOpen={vi.fn()}
      onAttachPhoto={vi.fn()}
      onRemovePhoto={vi.fn()}
      onOpenSizes={vi.fn()}
      onSaveBodyProfile={extra.onSaveBodyProfile || vi.fn()}
      onSaveFitPref={extra.onSaveFitPref || vi.fn()}
      onSaveEdit={extra.onSaveEdit || vi.fn()}
      titleTarget={titleHost}
      {...extra}
    />
  );
}

beforeEach(() => {
  huntMock.mockResolvedValue(null);
});

afterEach(() => {
  cleanup();
  huntMock.mockReset();
});

describe("Item D D1/D4/D5 FIXED", () => {
  // ── D1: seller size row inside sizing card + SELLER SIZES kicker ─────────
  it("D1 FIXED: seller chips live inside .cz-sizing with SELLER SIZES kicker", async () => {
    renderFit(chartlessItem());
    expect(await screen.findByText("No chart for this one yet.")).toBeInTheDocument();

    const chipRow = document.querySelector(".cz-detail-size-choices");
    expect(chipRow).not.toBeNull();
    const chipLabels = [...chipRow.querySelectorAll(".cz-detail-size-choice")]
      .map((el) => el.getAttribute("aria-label") || el.textContent || "")
      .join(" | ");
    expect(chipLabels).toMatch(/M100-130/);
    // House kicker names the row.
    expect(screen.getByText(/SELLER SIZES/i)).toBeInTheDocument();
    // Row is inside the sizing card, not a sibling below it.
    const sizing = document.querySelector(".cz-sizing");
    expect(sizing).not.toBeNull();
    expect(sizing.contains(chipRow)).toBe(true);
  });

  it("D1 FIXED (first-size empty profile): chip row inside chooser with kicker", async () => {
    renderFit(chartlessItem({ variants: variantsRun(["S", "M", "L", "XL"]) }), {
      bodyProfile: {}, // triggers FirstSizeBlock
    });
    // A1 opens on "What size do you usually buy?" (chooser intro is gone).
    expect(await screen.findByText(/What size do you usually buy/i)).toBeInTheDocument();
    const chipRow = document.querySelector(".cz-detail-size-choices");
    const chooser = document.querySelector(".cz-first-size");
    expect(chipRow).not.toBeNull();
    expect(chooser).not.toBeNull();
    expect(chooser.contains(chipRow)).toBe(true);
    expect(screen.getByText(/SELLER SIZES/i)).toBeInTheDocument();
    const labels = [...chipRow.querySelectorAll("button.cz-detail-size-choice")]
      .map((el) => (el.getAttribute("aria-label") || el.textContent || "").trim());
    expect(labels.join(" ")).toMatch(/\bS\b|Small/i);
    expect(labels.join(" ")).toMatch(/\bM\b|Medium/i);
  });

  // ── D2: already live — keep regression pins ─────────────────────────────
  it("D2 FIXED: no-chart ask1 shows one helper, never yellow+red pair", async () => {
    render(
      <FirstSizeBlock
        item={{ id: "fs", category: "shirt", title: "tee" }}
        chart={null}
        units="cm"
        onSaveBodyProfile={vi.fn()}
        onSaveFitPref={vi.fn()}
      />
    );
    // A1 opens directly; helper keys on chart absence only.
    expect(
      screen.getByText(/No seller chart on this listing\. Your usual size becomes the pick\./i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/Guess needs a chart/i)).toBeNull();
    expect(screen.queryByText(/No chart on this card yet/i)).toBeNull();
    expect(screen.queryByText(/No size chart on this card yet/i)).toBeNull();
    expect(screen.queryByText(/This seller posted a chart/i)).toBeNull();
  });

  it("D2 FIXED: with chart, ask1 helper keys on chart presence only", async () => {
    const chart = {
      rows: [
        { size: "S", chest: 100 },
        { size: "M", chest: 104 },
        { size: "L", chest: 110 },
      ],
    };
    render(
      <FirstSizeBlock
        item={{ id: "fs", category: "shirt", title: "tee" }}
        chart={chart}
        units="cm"
        onSaveBodyProfile={vi.fn()}
        onSaveFitPref={vi.fn()}
      />
    );
    expect(screen.getByText(/This seller's chart is posted/i)).toBeInTheDocument();
    expect(screen.queryByText(/No seller chart on this listing/i)).toBeNull();
    expect(screen.queryByText(/No chart on this card yet/i)).toBeNull();
  });

  // ── D3: already live ────────────────────────────────────────────────────
  it("D3 FIXED: no-chart step 2 completes without red error mid-question", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <FirstSizeBlock
        item={{ id: "fs", category: "shirt", title: "tee" }}
        chart={null}
        units="cm"
        onSaveBodyProfile={onSave}
        onSaveFitPref={vi.fn()}
      />
    );
    await user.click(screen.getByRole("radio", { name: "L" }));
    // On step 2 surface.
    expect(screen.getByText(/How do you like a tee to sit/i)).toBeInTheDocument();
    expect(screen.queryByText(/No size chart on this card yet/i)).toBeNull();
    expect(document.querySelector(".cz-first-size-error")).toBeNull();
    // Sit options are role=radio with label+hint; name is the label text.
    await user.click(screen.getByRole("radio", { name: /Regular/i }));
    await user.click(screen.getByRole("button", { name: /Show my size/i }));
    expect(onSave).toHaveBeenCalled();
  });

  // ── D4: Type the chart inside no-chart sizing card ──────────────────────
  it("D4 FIXED: no-chart block offers Type the chart and opens typed editor", async () => {
    const user = userEvent.setup();
    renderFit(chartlessItem());
    expect(await screen.findByText("No chart for this one yet.")).toBeInTheDocument();
    const noChart = document.querySelector(".cz-sizing-nochart");
    expect(noChart).not.toBeNull();
    const typeBtn = within(noChart).getByRole("button", { name: /Type the chart/i });
    expect(typeBtn).toBeInTheDocument();
    await user.click(typeBtn);
    // Opens existing typed-chart path (useCustomerChartRead.startTyping).
    await waitFor(() => {
      expect(document.querySelector(".cz-sizing-reading")).not.toBeNull();
      expect(document.querySelector(".cz-sizing-fix")).not.toBeNull();
    });
  });

  // ── D5: one stacked column inside sizing ────────────────────────────────
  it("D5 FIXED: chooser/no-chart + chip row stack inside sizing card", async () => {
    renderFit(chartlessItem());
    await screen.findByText("No chart for this one yet.");
    const section = screen.getByRole("region", { name: "Size and fit" });
    const sizing = section.querySelector(".cz-sizing");
    const editor = section.querySelector(".cz-detail-size-editor");
    expect(sizing).not.toBeNull();
    expect(editor).not.toBeNull();
    expect(sizing.contains(editor)).toBe(true);
    // Editor is no longer a sibling of the sizing card.
    expect(editor.parentElement).not.toBe(sizing.parentElement);
  });
});
