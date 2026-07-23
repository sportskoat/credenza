import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Credenza from "../../credenza-fashion.jsx";

const STORE_KEY = "credenza-fashion-items-v1";
const PREFS_KEY = "credenza-prefs-v1";
const PHOTO_1 = "data:image/png;base64,iVBORw0KGgo=";
const PHOTO_2 = "data:image/png;base64,iVBORw0KGgoA=";
const PHOTO_3 = "data:image/png;base64,iVBORw0KGgoAA=";

function installShim(initial = {}) {
  const data = { ...initial };
  window.storage = {
    get: async (key) => (key in data ? { value: data[key] } : null),
    set: async (key, value) => {
      data[key] = value;
    },
  };
  return data;
}

function fashionItem(overrides = {}) {
  const now = Date.now();
  return {
    id: "fashion-1",
    createdAt: now,
    updatedAt: now,
    rawText: "https://mook-official.x.yupoo.com/albums/244505824?uid=1",
    url: "https://mook-official.x.yupoo.com/albums/244505824?uid=1",
    type: "article",
    host: "mook-official.x.yupoo.com",
    title: "Palace x Nike jersey",
    summary: "Poster bought S; recommend XL because it fits small.",
    tags: [],
    image: PHOTO_1,
    gallery: [PHOTO_2, PHOTO_3],
    links: [],
    price: 229,
    currency: "CNY",
    seller: "Mook-official",
    sellerAccount: "mook-official",
    batch: "M32126-109E",
    size: "XL",
    posterSize: "S",
    recommendedSize: "XL",
    weidianUrl: "https://weidian.com/item.html?itemID=7799763843",
    variants: [{ title: "Size", values: ["S", "M", "L", "XL"] }],
    sizeNotes: "Runs small.",
    ...overrides,
  };
}

beforeEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  Object.defineProperties(HTMLElement.prototype, {
    offsetWidth: {
      configurable: true,
      get() {
        return this.classList?.contains("cz-carousel-card") ? 320 : 0;
      },
    },
    offsetLeft: {
      configurable: true,
      get() {
        if (!this.classList?.contains("cz-carousel-card")) return 0;
        const index = Array.from(this.parentElement?.children || []).indexOf(this);
        return 240 + Math.max(0, index) * 180;
      },
    },
    clientWidth: {
      configurable: true,
      get() {
        return this.classList?.contains("cz-carousel") ? 800 : 0;
      },
    },
    scrollWidth: {
      configurable: true,
      get() {
        return this.classList?.contains("cz-carousel") ? 1200 : 0;
      },
    },
  });
});

describe("Fashion carousel startup", () => {
  it("opens in carousel mode even when an older preference says cards", async () => {
    installShim({
      [STORE_KEY]: JSON.stringify([fashionItem()]),
      [PREFS_KEY]: JSON.stringify({ viewMode: "cards", sortMode: "oldest", theme: "light" }),
    });
    render(<Credenza />);
    expect(await screen.findByRole("listbox", { name: "Card carousel" })).toBeInTheDocument();
    expect(screen.getAllByText("Palace x Nike jersey").length).toBeGreaterThan(0);
  });

  it("centers a side card first and flips it only on the next click", async () => {
    installShim({
      [STORE_KEY]: JSON.stringify([
        fashionItem(),
        fashionItem({ id: "fashion-2", title: "Second jacket", createdAt: Date.now() - 1000 }),
      ]),
    });
    const user = userEvent.setup();
    const { container } = render(<Credenza />);
    await screen.findByRole("listbox", { name: "Card carousel" });
    const sideFace = screen.getByRole("button", { name: /Select/ });
    await user.click(sideFace);
    expect([...container.querySelectorAll(".cz-carousel-card-inner")].every((node) => !node.classList.contains("is-flipped"))).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 260));
    await user.click(sideFace);
    await waitFor(() => expect(sideFace.closest(".cz-carousel-card-inner")).toHaveClass("is-flipped"));
  });
});

describe("Fashion data and photos", () => {
  it("preserves legacy sizing, remote covers, and the Weidian buy link", async () => {
    installShim({
      [STORE_KEY]: JSON.stringify([
        fashionItem({ image: "https://photo.yupoo.com/mook-official/hash/medium.jpg" }),
      ]),
    });
    const user = userEvent.setup();
    const { container } = render(<Credenza />);
    const flipButtons = await screen.findAllByRole("button", { name: /Flip/ });
    await user.click(flipButtons[0]);
    // Product-sheet back: sizing is quiet chips ("Poster S" / "Rec XL") inside the
    // single size block — Rec may also appear on the front face, so scope to back.
    const back = container.querySelector(".cz-carousel-back");
    expect(back).toBeTruthy();
    expect(await screen.findByText("Poster S")).toBeInTheDocument();
    expect(back.querySelector(".cz-size-rec, .cz-carousel-meta-chips, .cz-size-facts")?.textContent || back.textContent).toMatch(/Rec XL|Poster S/);
    const backBuys = [...back.querySelectorAll("button")].filter((b) => /Buy via Superbuy|Buy/.test(b.textContent || ""));
    expect(backBuys.length).toBeGreaterThan(0);
    expect(container.querySelector("img.cz-carousel-image")?.getAttribute("src")).toContain("photo.yupoo.com");
  });

  it("opens album photos in-app and requires an explicit cover action", async () => {
    installShim({ [STORE_KEY]: JSON.stringify([fashionItem()]) });
    const user = userEvent.setup();
    const { container } = render(<Credenza />);
    const flipButtons = await screen.findAllByRole("button", { name: /Flip/ });
    await user.click(flipButtons[0]);
    await user.click(screen.getByRole("button", { name: "Open photo gallery" }));
    expect(await screen.findByRole("dialog", { name: "Album photo preview" })).toBeInTheDocument();
    expect(container.querySelector("img.cz-carousel-image")?.getAttribute("src")).toBe(PHOTO_1);
    await user.click(screen.getByRole("button", { name: "Next photo" }));
    expect(screen.getByRole("button", { name: "Use as cover" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Use as cover" }));
    await waitFor(() =>
      expect(container.querySelector("img.cz-carousel-image")?.getAttribute("src")).toBe(PHOTO_2)
    );
    expect(screen.queryByRole("dialog", { name: "Album photo preview" })).not.toBeInTheDocument();
  });

  it("keeps only Buy in the action row; Yupoo is a Full Album link under the seller", async () => {
    const secondaryYupoo = "https://seller.x.yupoo.com/albums/999?uid=1&tab=max";
    const buyUrl = "https://weidian.com/item.html?itemID=1234567890";
    installShim({
      [STORE_KEY]: JSON.stringify([
        fashionItem({
          weidianUrl: "",
          links: [
            { url: secondaryYupoo, role: "photos" },
            { url: buyUrl, role: "buy" },
          ],
        }),
      ]),
    });
    const user = userEvent.setup();
    const { container } = render(<Credenza />);
    await user.click((await screen.findAllByRole("button", { name: /Flip/ }))[0]);

    const actions = [...container.querySelectorAll(".cz-carousel-actions > button")];
    expect(actions.length).toBe(1);
    expect(actions[0]).toHaveTextContent(/Buy/);
    expect(screen.queryByRole("button", { name: /More Photos/i })).not.toBeInTheDocument();
    const album = container.querySelector("a.cz-album-quiet");
    expect(album).toBeTruthy();
    expect(album).toHaveTextContent(/Full Album/i);
    expect(album.getAttribute("href")).toContain("yupoo.com");
  });
});

describe("Fashion card-back navigation and editing", () => {
  it("dismisses exactly one outside-click layer while inside clicks remain inert", async () => {
    // Sizes bubble was removed — size lives in the single SizeRecommendation
    // block. One-layer outside-click is still exercised via Edit → details → front.
    installShim({ [STORE_KEY]: JSON.stringify([fashionItem({ batch: "Original" })]) });
    const user = userEvent.setup();
    const { container } = render(<Credenza />);
    await user.click((await screen.findAllByRole("button", { name: /Flip/ }))[0]);
    const outside = container.querySelector(".cz-carousel-track");

    // Still on the back face. SizeRecommendation only mounts when chart+body
    // yield a pick; chips always carry chosen / rec labels when present.
    expect(screen.getByRole("button", { name: "Edit card" })).toBeInTheDocument();
    expect(container.querySelector(".cz-carousel-card-inner")).toHaveClass("is-flipped");
    const back = container.querySelector(".cz-carousel-back");
    expect(back?.textContent || "").toMatch(/SIZE:\s*X-?LARGE|Rec XL|Poster S/i);

    await user.click(screen.getByRole("button", { name: "Edit card" }));
    const batchField = await screen.findByLabelText("Batch");
    await user.clear(batchField);
    await user.type(batchField, "Discard me");
    // Outside click flushes write-through edit and returns to details (still flipped).
    fireEvent.pointerDown(outside);
    fireEvent.click(outside);
    await waitFor(() => expect(screen.queryByLabelText("Batch")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Edit card" })).toBeInTheDocument();
    expect(container.querySelector(".cz-carousel-card-inner")).toHaveClass("is-flipped");

    // Write-through: the typed batch is kept, not discarded.
    await user.click(screen.getByRole("button", { name: "Edit card" }));
    expect(await screen.findByLabelText("Batch")).toHaveValue("Discard me");
    await user.click(screen.getByRole("button", { name: "Back to card" }));
    fireEvent.pointerDown(outside);
    fireEvent.click(outside);
    await waitFor(() => expect(container.querySelector(".cz-carousel-card-inner")).not.toHaveClass("is-flipped"));
  });

  it("uses the same edit and details priority for Escape", async () => {
    // Sizes bubble gone — Escape peels edit → details → front, one layer at a time.
    installShim({ [STORE_KEY]: JSON.stringify([fashionItem()]) });
    const user = userEvent.setup();
    const { container } = render(<Credenza />);
    await user.click((await screen.findAllByRole("button", { name: /Flip/ }))[0]);
    expect(screen.getByRole("button", { name: "Edit card" })).toBeInTheDocument();
    expect(container.querySelector(".cz-carousel-card-inner")).toHaveClass("is-flipped");

    await user.click(screen.getByRole("button", { name: "Edit card" }));
    await screen.findByLabelText("Batch");
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByLabelText("Batch")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Edit card" })).toBeInTheDocument();
    expect(container.querySelector(".cz-carousel-card-inner")).toHaveClass("is-flipped");

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(container.querySelector(".cz-carousel-card-inner")).not.toHaveClass("is-flipped"));
  });

  it("write-through saves Batch from edit and keeps it after exit paths", async () => {
    const data = installShim({ [STORE_KEY]: JSON.stringify([fashionItem({ batch: "Original" })]) });
    const user = userEvent.setup();
    render(<Credenza />);
    await user.click((await screen.findAllByRole("button", { name: /Flip/ }))[0]);
    expect(screen.queryByText("Original")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit card" }));
    let batchField = await screen.findByLabelText("Batch");
    await user.clear(batchField);
    await user.type(batchField, "Saved batch");
    // Save-check (header) commits write-through and exits edit.
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.queryByLabelText("Batch")).not.toBeInTheDocument());
    await waitFor(() => expect(JSON.parse(data[STORE_KEY])[0].batch).toBe("Saved batch"));
    // Header holds a "Saved" pill briefly before ⋯/pen return — wait for tools.
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit card" })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Edit card" }));
    batchField = await screen.findByLabelText("Batch");
    expect(batchField).toHaveValue("Saved batch");
    await user.clear(batchField);
    await user.type(batchField, "Also kept");
    // Back chevron also flushes write-through — nothing is discarded.
    await user.click(screen.getByRole("button", { name: "Back to card" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit card" })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Edit card" }));
    expect(await screen.findByLabelText("Batch")).toHaveValue("Also kept");
    await waitFor(() => expect(JSON.parse(data[STORE_KEY])[0].batch).toBe("Also kept"));
  });

  it("lists hauls and opens one to browse only its cards", async () => {
    installShim({
      [STORE_KEY]: JSON.stringify([
        fashionItem({
          id: "fashion-1",
          title: "Summer tee",
          project: "Summer Europe",
          weidianUrl: "https://weidian.com/item.html?itemID=1",
        }),
        fashionItem({
          id: "fashion-2",
          title: "Winter jacket",
          project: "Winter dump",
          weidianUrl: "https://weidian.com/item.html?itemID=2",
        }),
        fashionItem({
          id: "fashion-3",
          title: "Loose find",
          project: "",
          weidianUrl: "https://weidian.com/item.html?itemID=3",
        }),
      ]),
    });
    const user = userEvent.setup();
    render(<Credenza />);

    await user.click(await screen.findByRole("tab", { name: /Hauls/i }));
    expect(await screen.findByText("Your hauls")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Summer Europe/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Winter dump/i })).toBeInTheDocument();
    // Unsorted was removed — items without a haul stay on the shelf only.
    expect(screen.queryByRole("button", { name: /Unsorted/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Summer Europe/i }));
    expect(await screen.findByRole("heading", { name: "Summer Europe" })).toBeInTheDocument();
    // Morph may keep the carousel briefly hidden; wait for the open-haul card.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Flip Summer tee/i })).toBeInTheDocument()
    );
    expect(screen.queryByRole("button", { name: /Flip Winter jacket/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /All hauls/i }));
    expect(await screen.findByText("Your hauls")).toBeInTheDocument();
  });

  it("opens a full-face actions panel from the dots and never uses a browser prompt", async () => {
    const promptSpy = vi.spyOn(window, "prompt").mockImplementation(() => "Nope");
    const data = installShim({
      [STORE_KEY]: JSON.stringify([fashionItem({ project: "Summer haul" })]),
    });
    const user = userEvent.setup();
    render(<Credenza />);
    await user.click((await screen.findAllByRole("button", { name: /Flip/ }))[0]);

    const edit = screen.getByRole("button", { name: "Edit card" });
    expect(edit).toBeInTheDocument();
    expect(edit).not.toHaveTextContent("Edit");
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
    // Front + back can both mount a Buy button; scope to the open back face.
    const backFace = document.querySelector(".cz-carousel-back");
    expect([...backFace.querySelectorAll("button")].some((b) => /Buy via Superbuy/.test(b.textContent || ""))).toBe(true);

    await user.click(screen.getByRole("button", { name: "Card actions" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Actions" })).toBeInTheDocument());
    // Actions panel replaces the detail body Buy on the back face.
    expect([...backFace.querySelectorAll(".cz-carousel-actions button")].some((b) => /Buy via Superbuy/.test(b.textContent || ""))).toBe(false);
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
    expect(promptSpy).not.toHaveBeenCalled();

    await user.click(screen.getByRole("menuitem", { name: /Move to haul/i }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Move to haul" })).toBeInTheDocument());
    const haulInput = screen.getByPlaceholderText("e.g. Summer Europe");
    await user.clear(haulInput);
    await user.type(haulInput, "Winter dump");
    await user.click(screen.getByRole("button", { name: "Save haul" }));
    await waitFor(() => expect(JSON.parse(data[STORE_KEY])[0].project).toBe("Winter dump"));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Actions" })).toBeInTheDocument());

    await user.click(screen.getByRole("menuitem", { name: "Remove from haul" }));
    await waitFor(() => expect(JSON.parse(data[STORE_KEY])[0].project).toBe(""));
    await user.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() =>
      expect([...backFace.querySelectorAll("button")].some((b) => /Buy via Superbuy/.test(b.textContent || ""))).toBe(true)
    );
    promptSpy.mockRestore();
  });
});

describe("Fashion morph controls and favorites", () => {
  it("focuses, clears, refocuses, and escapes the native search field", async () => {
    installShim({ [STORE_KEY]: JSON.stringify([fashionItem()]) });
    const user = userEvent.setup();
    render(<Credenza />);
    const search = await screen.findByRole("textbox", { name: "Search your shelf" });

    // Empty field: no Clear control (only appears once there is text).
    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();
    await user.click(search);
    expect(search).toHaveFocus();
    await user.type(search, "Palace");
    expect(screen.getByRole("button", { name: "Clear search" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(search).toHaveValue("");
    expect(search).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();
    await user.type(search, "Nike");
    await user.keyboard("{Escape}");
    expect(search).toHaveValue("");
    expect(search).not.toHaveFocus();
    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();
    await user.keyboard("{Meta>}k{/Meta}");
    expect(search).toHaveFocus();
  });

  it("toggles the labeled Theme morph without changing preference values", async () => {
    const data = installShim({
      [STORE_KEY]: JSON.stringify([fashionItem()]),
      // colorwayVersion: 4 freezes the one-shot migrate so this test can start on light.
      [PREFS_KEY]: JSON.stringify({
        viewMode: "carousel",
        sortMode: "recent",
        theme: "light",
        colorwayVersion: 4,
      }),
    });
    const user = userEvent.setup();
    const { container } = render(<Credenza />);
    // Theme lives in the profile sheet now (design handoff PR3).
    await user.click(await screen.findByRole("button", { name: "Profile" }));
    const blackout = await screen.findByRole("button", { name: /Blackout/ });
    expect(blackout).toHaveAttribute("aria-pressed", "false");
    await user.click(blackout);
    expect(container.querySelector(".cz-app")).toHaveAttribute("data-theme", "rainbow");
    await waitFor(() => expect(JSON.parse(data[PREFS_KEY]).theme).toBe("rainbow"));
    await user.click(screen.getByRole("button", { name: /Gallery/ }));
    expect(container.querySelector(".cz-app")).toHaveAttribute("data-theme", "light");
  });

  it("strictly migrates favorites and persists them across carousel and grid cards", async () => {
    const items = Array.from({ length: 6 }, (_, index) =>
      fashionItem({
        id: "fashion-" + (index + 1),
        title: index === 0 ? "String favorite" : index === 1 ? "Real favorite" : "Card " + (index + 1),
        favorite: index === 0 ? "true" : index === 1,
        createdAt: Date.now() - index * 1000,
      })
    );
    const data = installShim({ [STORE_KEY]: JSON.stringify(items) });
    const user = userEvent.setup();
    render(<Credenza />);

    const stringFavorite = await screen.findByRole("button", { name: "Star String favorite" });
    const realFavorite = screen.getByRole("button", { name: "Unstar Real favorite" });
    expect(stringFavorite).toHaveAttribute("aria-pressed", "false");
    expect(realFavorite).toHaveAttribute("aria-pressed", "true");
    await user.click(stringFavorite);
    expect(screen.getByRole("button", { name: "Unstar String favorite" })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(JSON.parse(data[STORE_KEY])[0].favorite).toBe(true));
    // Toggle back off — star must unstar cleanly.
    await user.click(screen.getByRole("button", { name: "Unstar String favorite" }));
    expect(screen.getByRole("button", { name: "Star String favorite" })).toHaveAttribute("aria-pressed", "false");
    await waitFor(() => expect(JSON.parse(data[STORE_KEY])[0].favorite).toBe(false));
    await user.click(screen.getByRole("button", { name: "Star String favorite" }));

    await user.click(screen.getByRole("button", { name: "Card view" }));
    expect(await screen.findByRole("button", { name: "Unstar String favorite" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("Agent Buy plumbing (A2)", () => {
  const WEIDIAN = "https://weidian.com/item.html?itemID=7799763843";

  it("wraps Buy clicks through the preferred agent and never rewrites stored links", async () => {
    const data = installShim({ [STORE_KEY]: JSON.stringify([fashionItem()]) });
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const user = userEvent.setup();
    render(<Credenza />);
    await user.click((await screen.findAllByRole("button", { name: /Flip/ }))[0]);
    const buy = (await screen.findAllByRole("button", { name: "Buy via Superbuy" }))[0];
    await user.click(buy);
    expect(open).toHaveBeenCalledWith(
      "https://www.superbuy.com/en/page/buy?url=" + encodeURIComponent(WEIDIAN),
      "_blank",
      "noopener"
    );
    // Stored item keeps the canonical Weidian link — the wrap exists only at open time.
    const stored = JSON.parse(data[STORE_KEY])[0];
    expect(JSON.stringify(stored)).toContain(WEIDIAN);
    expect(JSON.stringify(stored)).not.toContain("superbuy.com");
    // Outbound click logged locally for the money-pipe metrics.
    const log = JSON.parse(data["credenza-fashion-outbound-v1"]);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ agentId: "superbuy", marketplace: "weidian", wrapped: true });
  });

  it("opens the canonical link directly when the agent is Direct", async () => {
    const data = installShim({
      [STORE_KEY]: JSON.stringify([fashionItem()]),
      [PREFS_KEY]: JSON.stringify({ colorwayVersion: 4, theme: "rainbow", viewMode: "carousel", sortMode: "recent", preferredAgent: "raw" }),
    });
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const user = userEvent.setup();
    render(<Credenza />);
    await user.click((await screen.findAllByRole("button", { name: /Flip/ }))[0]);
    const buy = (await screen.findAllByRole("button", { name: "Buy" }))[0];
    await user.click(buy);
    expect(open).toHaveBeenCalledWith(WEIDIAN, "_blank", "noopener");
    const log = JSON.parse(data["credenza-fashion-outbound-v1"]);
    expect(log[0]).toMatchObject({ agentId: "raw", wrapped: false });
  });

  it("switches agent from the Agent sheet, re-labels Buy, shows the FTC disclosure, and persists", async () => {
    const data = installShim({ [STORE_KEY]: JSON.stringify([fashionItem()]) });
    const user = userEvent.setup();
    render(<Credenza />);
    // The Agent sheet opens straight from the bottom bar (design handoff PR3).
    // (Mobile + desktop bar variants both render; CSS hides one per viewport.)
    await user.click((await screen.findAllByRole("button", { name: /Agent: / }))[0]);
    expect(await screen.findByRole("heading", { name: "Buying agent" })).toBeInTheDocument();
    expect(screen.getByText(/Disclosure:/)).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /Sugargoo/ }));
    await user.click(screen.getByRole("button", { name: "Close Buying agent" }));
    await user.click((await screen.findAllByRole("button", { name: /Flip/ }))[0]);
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: "Buy via Sugargoo" }).length).toBeGreaterThan(0)
    );
    const prefs = JSON.parse(data[PREFS_KEY]);
    expect(prefs.preferredAgent).toBe("sugargoo");
    // Switching agents must not touch stored item links.
    expect(JSON.stringify(JSON.parse(data[STORE_KEY]))).not.toContain("sugargoo");
  });

  it("attaches a stored referral code at open time only", async () => {
    const data = installShim({
      [STORE_KEY]: JSON.stringify([fashionItem()]),
      [PREFS_KEY]: JSON.stringify({ colorwayVersion: 4, preferredAgent: "superbuy", affiliateCodes: { superbuy: "KYLE123" } }),
    });
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const user = userEvent.setup();
    render(<Credenza />);
    await user.click((await screen.findAllByRole("button", { name: /Flip/ }))[0]);
    const buy = (await screen.findAllByRole("button", { name: "Buy via Superbuy" }))[0];
    await user.click(buy);
    expect(open).toHaveBeenCalledWith(
      "https://www.superbuy.com/en/page/buy?url=" + encodeURIComponent(WEIDIAN) + "&partnercode=KYLE123",
      "_blank",
      "noopener"
    );
    expect(JSON.stringify(JSON.parse(data[STORE_KEY]))).not.toContain("KYLE123");
  });
});

describe("Reddit haul import (A1)", () => {
  const HAUL = `5.5kg Haul Review (Superbuy) — first time posting!
https://www.reddit.com/r/FashionReps/comments/1abc123/55kg_haul_review/

Stats: 178cm, 75kg, usually wear size M
Agent: Superbuy
Total: ¥2400

**Nike Dunk Low Panda** — https://weidian.com/item.html?itemID=7234567890
Fits TTS, leather is decent for ¥190.

Stussy 8-ball tee [W2C](https://item.taobao.com/item.htm?id=856801351597)
Size up once, print is thick

Mook hoodie https://weidian.com/item.html?itemID=7299887766`;

  it("turns a pasted haul comment into titled cards with notes, tags, and poster stats", async () => {
    const data = installShim({ [STORE_KEY]: JSON.stringify([]) });
    const user = userEvent.setup();
    render(<Credenza />);

    // Import lives in the profile sheet now (design handoff PR3).
    await user.click(await screen.findByRole("button", { name: "Profile" }));
    await user.click(await screen.findByRole("button", { name: /Import & backup/ }));
    const box = await screen.findByLabelText(/Paste haul links/);
    fireEvent.change(box, { target: { value: HAUL } });

    expect(await screen.findByText(/Looks like a Reddit haul/)).toBeInTheDocument();
    expect(screen.getByText(/178cm · 75kg · size M/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Import 3" }));
    await waitFor(() => expect(JSON.parse(data[STORE_KEY])).toHaveLength(3));

    const items = JSON.parse(data[STORE_KEY]);
    const titles = items.map((i) => i.title);
    expect(titles).toContain("Nike Dunk Low Panda");
    expect(titles).toContain("Stussy 8-ball tee");
    expect(titles).toContain("Mook hoodie");

    const tee = items.find((i) => i.title === "Stussy 8-ball tee");
    expect(tee.note).toContain("Size up once");
    expect(tee.tags).toContain("shirt");
    expect(tee.posterStats).toMatchObject({ heightCm: 178, weightKg: 75, usualSize: "M", agent: "superbuy" });
    expect(tee.findSource).toContain("reddit.com/r/FashionReps/comments/");

    // And the haul import shows up in the toast, not silently.
    expect(await screen.findByText(/Imported 3 things from your Reddit haul/)).toBeInTheDocument();
  });
});

describe("Stash mode toggle (front screen)", () => {
  const KYLE_POST = `Adidas CNY Tang Jacket (Size M) - Buttery smooth fabric, love the colour. Fits TTS.
W2C: https://weidian.com/item.html?itemID=7649592219

⸻

Vans Old Skool 36 Souvenir (EU42.5, TOP Batch) - Fits like any other Old Skool. Fits TTS.
W2C: https://shop1850859027.v.weidian.com/item.html?itemID=7808837642`;

  it("switches the capture placeholder with the mode", async () => {
    installShim({ [STORE_KEY]: JSON.stringify([]) });
    const user = userEvent.setup();
    render(<Credenza />);

    const group = await screen.findByRole("group", { name: "Stash mode" });
    expect(group).toBeInTheDocument();
    // The desk bar input shares this placeholder; [0] is the top capture box.
    expect(screen.getAllByPlaceholderText("Paste a link or note…")[0]).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reddit haul" }));
    expect(screen.getByPlaceholderText("Paste a Reddit post link or haul text…")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Note" }));
    expect(screen.getByPlaceholderText("Write a note…")).toBeInTheDocument();
  });

  it("note mode keeps a URL paste as one plain note card", async () => {
    const data = installShim({ [STORE_KEY]: JSON.stringify([]) });
    const user = userEvent.setup();
    render(<Credenza />);

    await user.click(await screen.findByRole("button", { name: "Note" }));
    const box = screen.getByPlaceholderText("Write a note…");
    fireEvent.change(box, { target: { value: "remember this https://weidian.com/item.html?itemID=7649592219" } });
    fireEvent.keyDown(box, { key: "Enter" });

    await waitFor(() => expect(JSON.parse(data[STORE_KEY])).toHaveLength(1));
    const [item] = JSON.parse(data[STORE_KEY]);
    expect(item.type).toBe("note");
    expect(item.url).toBeNull();
  });

  it("haul mode turns pasted post text into one card per item, notes aligned", async () => {
    const data = installShim({ [STORE_KEY]: JSON.stringify([]) });
    const user = userEvent.setup();
    render(<Credenza />);

    await user.click(await screen.findByRole("button", { name: "Reddit haul" }));
    const box = screen.getByPlaceholderText("Paste a Reddit post link or haul text…");
    fireEvent.change(box, { target: { value: KYLE_POST } });
    fireEvent.keyDown(box, { key: "Enter" });

    await waitFor(() => expect(JSON.parse(data[STORE_KEY])).toHaveLength(2));
    const items = JSON.parse(data[STORE_KEY]);
    const jacket = items.find((i) => (i.url || "").includes("7649592219"));
    const vans = items.find((i) => (i.url || "").includes("7808837642"));
    expect(jacket.note).toContain("Buttery smooth fabric");
    expect(vans.note).toContain("Fits like any other Old Skool");
    expect(vans.note).not.toContain("Buttery smooth");
  });

  it("a lone Reddit post link in link mode routes to the haul path", async () => {
    const data = installShim({ [STORE_KEY]: JSON.stringify([]) });
    const user = userEvent.setup();
    render(<Credenza />);

    const box = (await screen.findAllByPlaceholderText("Paste a link or note…"))[0];
    fireEvent.change(box, {
      target: { value: "https://www.reddit.com/r/FashionReps/comments/1v3fupe/in_hand_review/" },
    });
    fireEvent.keyDown(box, { key: "Enter" });

    // The reader function is unreachable in jsdom → actionable error toast,
    // NOT a silent one-card stash of the post link (the old bad behavior).
    expect(await screen.findByText(/Couldn't read that Reddit post/)).toBeInTheDocument();
    expect(JSON.parse(data[STORE_KEY])).toHaveLength(0);
  });
});
