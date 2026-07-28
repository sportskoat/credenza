import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
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

function installClipboard(readText, permissionState = "granted") {
  const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  const permissionsDescriptor = Object.getOwnPropertyDescriptor(navigator, "permissions");
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { readText },
  });
  Object.defineProperty(navigator, "permissions", {
    configurable: true,
    value: { query: vi.fn().mockResolvedValue({ state: permissionState }) },
  });
  return () => {
    if (clipboardDescriptor) Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
    else delete navigator.clipboard;
    if (permissionsDescriptor) Object.defineProperty(navigator, "permissions", permissionsDescriptor);
    else delete navigator.permissions;
  };
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
  window.history.replaceState(null, "", "/");
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
    // Unified back (2026-07-25): the back IS the phone sheet body — sizing
    // lives in the "Size · fit" spec cell, not quiet chips.
    const back = container.querySelector(".cz-carousel-back");
    expect(back).toBeTruthy();
    expect(back?.textContent || "").toMatch(/X-Large/);
    const backBuys = [...back.querySelectorAll("button")].filter((b) => /Buy via Superbuy|Buy/.test(b.textContent || ""));
    expect(backBuys.length).toBeGreaterThan(0);
    expect(container.querySelector("img.cz-carousel-image")?.getAttribute("src")).toContain("photo.yupoo.com");
  });

  it("shows album photos in the back pager and requires an explicit cover action", async () => {
    installShim({ [STORE_KEY]: JSON.stringify([fashionItem()]) });
    const user = userEvent.setup();
    const { container } = render(<Credenza />);
    const flipButtons = await screen.findAllByRole("button", { name: /Flip/ });
    await user.click(flipButtons[0]);
    // Unified back (2026-07-25): photos ride the same pager as the phone
    // sheet. The cover never changes by itself — only the explicit action.
    const track = container.querySelector(".cz-detail-hero-track");
    expect(track).toBeTruthy();
    expect(track.querySelectorAll("img").length).toBe(3);
    expect(screen.queryByRole("button", { name: "Make this photo the cover" })).not.toBeInTheDocument();
    expect(container.querySelector("img.cz-carousel-image")?.getAttribute("src")).toBe(PHOTO_1);
    // Scroll the pager to photo two; the one-tap cover action appears.
    fireEvent.scroll(track, { target: { scrollLeft: 1 } });
    await user.click(await screen.findByRole("button", { name: "Make this photo the cover" }));
    await waitFor(() =>
      expect(container.querySelector("img.cz-carousel-image")?.getAttribute("src")).toBe(PHOTO_2)
    );
  });

  it("keeps one Buy action on the card back", async () => {
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

    // Unified back (2026-07-25): one filled buy action in the pinned foot —
    // the phone-sheet rule (two filled twins read as a bug). Handoff turn 9 §8
    // adds the agent-picker chevron INSIDE that action: one container, one
    // radius, split by a hairline. So the foot holds one notch, not two buttons.
    const foot = container.querySelector(".cz-detail-foot");
    expect(foot).toBeTruthy();
    expect(foot.querySelectorAll(".cz-buy-notch").length).toBe(1);
    const buys = [...foot.querySelectorAll("button")].filter(
      (b) => !b.classList.contains("cz-buy-notch-toggle")
    );
    expect(buys.length).toBe(1);
    expect(buys[0]).toHaveTextContent(/Buy/);
    expect(screen.queryByRole("button", { name: /More Photos/i })).not.toBeInTheDocument();
  });
});

describe("Fashion card-back navigation and editing", () => {
  it("dismisses the flip on outside click and keeps write-through edits", async () => {
    // The pen edit form is gone (2026-07-25): the desktop back edits in place
    // through the shared DetailBody cells, like the phone sheet. An outside
    // click dismisses the one remaining layer — the flip — and the debounced
    // write-through still lands because the back stays mounted.
    const data = installShim({
      [STORE_KEY]: JSON.stringify([fashionItem({ colorway: "Original", batch: "Stored batch" })]),
    });
    const user = userEvent.setup();
    const { container } = render(<Credenza />);
    await user.click((await screen.findAllByRole("button", { name: /Flip/ }))[0]);
    const outside = container.querySelector(".cz-carousel-track");

    // Still on the back face. The unified back shows the chosen size in the
    // "Size · fit" spec cell, and the header carries only ⋯ (no pen).
    expect(screen.getByRole("button", { name: "Card actions" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit card" })).not.toBeInTheDocument();
    expect(container.querySelector(".cz-carousel-card-inner")).toHaveClass("is-flipped");
    const back = container.querySelector(".cz-carousel-back");
    expect(back?.textContent || "").toMatch(/X-Large/i);

    // Edit Colorway through its tab and persistent field.
    await user.click(screen.getByRole("tab", { name: "Colorway" }));
    const colorwayField = screen.getByRole("textbox", { name: "Colorway" });
    await user.clear(colorwayField);
    await user.type(colorwayField, "Bone white");
    // Outside click unflips the card (the flip is the only layer left).
    fireEvent.pointerDown(outside);
    fireEvent.click(outside);
    await waitFor(() => expect(container.querySelector(".cz-carousel-card-inner")).not.toHaveClass("is-flipped"));

    // Write-through keeps the active field and preserves the hidden Batch value.
    await waitFor(() => expect(JSON.parse(data[STORE_KEY])[0].colorway).toBe("Bone white"), { timeout: 2000 });
    expect(JSON.parse(data[STORE_KEY])[0].batch).toBe("Stored batch");
  });

  it("unflips the back with a single Escape", async () => {
    // No edit layer remains — Escape peels the flip in one step, even with a
    // cell editor open (the window handler captures before the input).
    installShim({ [STORE_KEY]: JSON.stringify([fashionItem()]) });
    const user = userEvent.setup();
    const { container } = render(<Credenza />);
    await user.click((await screen.findAllByRole("button", { name: /Flip/ }))[0]);
    expect(screen.getByRole("button", { name: "Card actions" })).toBeInTheDocument();
    expect(container.querySelector(".cz-carousel-card-inner")).toHaveClass("is-flipped");

    await user.click(screen.getByRole("tab", { name: "Colorway" }));
    const colorwayField = screen.getByRole("textbox", { name: "Colorway" });
    colorwayField.focus();
    expect(colorwayField).toHaveFocus();
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(container.querySelector(".cz-carousel-card-inner")).not.toHaveClass("is-flipped"));
  });

  it("write-through saves Colorway across exit paths and preserves Batch", async () => {
    const data = installShim({
      [STORE_KEY]: JSON.stringify([fashionItem({ colorway: "Original", batch: "Stored batch" })]),
    });
    const user = userEvent.setup();
    render(<Credenza />);
    await user.click((await screen.findAllByRole("button", { name: /Flip/ }))[0]);
    expect(screen.queryByRole("tab", { name: "Batch" })).toBeNull();

    await user.click(screen.getByRole("tab", { name: "Colorway" }));
    let colorwayField = screen.getByRole("textbox", { name: "Colorway" });
    expect(colorwayField).toHaveValue("Original");
    await user.clear(colorwayField);
    await user.type(colorwayField, "Bone white");
    // Enter blurs the field and commits the current draft.
    fireEvent.keyDown(colorwayField, { key: "Enter" });
    await waitFor(() => expect(colorwayField).not.toHaveFocus());
    await waitFor(() => expect(JSON.parse(data[STORE_KEY])[0].colorway).toBe("Bone white"), { timeout: 2000 });
    expect(JSON.parse(data[STORE_KEY])[0].batch).toBe("Stored batch");

    colorwayField = screen.getByRole("textbox", { name: "Colorway" });
    expect(colorwayField).toHaveValue("Bone white");
    await user.clear(colorwayField);
    await user.type(colorwayField, "Cream");
    // A tab change also blurs the field and keeps the write-through edit.
    await user.click(screen.getByRole("tab", { name: "Weight" }));
    expect(screen.getByRole("tab", { name: "Weight" })).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(JSON.parse(data[STORE_KEY])[0].colorway).toBe("Cream"), { timeout: 2000 });
    expect(JSON.parse(data[STORE_KEY])[0].batch).toBe("Stored batch");
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

    // The header carries only the ⋯ trigger — no pen edit form anymore.
    expect(screen.getByRole("button", { name: "Card actions" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit card" })).not.toBeInTheDocument();
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
    // Wait for the shelf to hydrate: with no stored prefs the first-run intro
    // can flash for one render (prefs resolve a tick before items), which
    // unmounts the chrome and detaches any element grabbed too early.
    await screen.findAllByText("Palace x Nike jersey");
    // Mobile + desktop search fields both exist for a stocked shelf. Prefer the
    // mobile field (cz-search-input) — it owns Clear + Cmd-K in the app.
    const search =
      document.querySelector(".cz-search-input") ||
      (await screen.findAllByRole("textbox", { name: "Search your shelf" }))[0];
    expect(search).toBeTruthy();

    // Empty field: no Clear control (only appears once there is text).
    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();
    search.focus();
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

    await user.click(screen.getByRole("button", { name: "List view" }));
    expect(await screen.findByRole("button", { name: "Unstar String favorite" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("Desktop sizing destination", () => {
  beforeEach(() => window.__setMediaMatches("(min-width: 768px)", true));
  afterEach(() => window.__setMediaMatches("(min-width: 768px)", false));

  it("routes customer sizing through Profile", async () => {
    installShim({
      [STORE_KEY]: JSON.stringify([
        fashionItem({
          category: "tops",
          sizeNotes: "S: chest 108, length 66\nM: chest 112, length 68",
        }),
      ]),
    });
    const user = userEvent.setup();
    render(<Credenza />);

    await user.click(await screen.findByRole("button", { name: "List view" }));
    await user.click(await screen.findByRole("button", { name: "Open Palace x Nike jersey" }));
    const detail = await screen.findByRole("dialog", { name: "Palace x Nike jersey" });
    const editSizes = screen.getByRole("button", { name: "Edit sizes and measurements" });

    await user.click(editSizes);
    expect(await screen.findByRole("dialog", { name: "Sizes and measurements" })).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Palace x Nike jersey" })).toBe(detail);

    await user.click(screen.getByRole("button", { name: "Close Sizes and measurements" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Sizes and measurements" })).toBeNull()
    );
    expect(screen.getByRole("dialog", { name: "Palace x Nike jersey" })).toBe(detail);
    await waitFor(() => expect(editSizes).toHaveFocus());
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
    // Wait for the shelf to hydrate — see the search-field test for why (the
    // first-run intro can flash for one render and detach early grabs).
    await screen.findAllByText("Palace x Nike jersey");
    // The bottom bar is gone (mobile handoff step 3), so the Agent sheet
    // opens from the profile sheet on desktop and from Settings on phone.
    await user.click(await screen.findByRole("button", { name: "Profile" }));
    await user.click(await screen.findByRole("button", { name: /Default agent/ }));
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

  it("ignores stored referral codes; only the build-time env code attaches (audit 2026-07-24)", async () => {
    const data = installShim({
      [STORE_KEY]: JSON.stringify([fashionItem()]),
      // A user-typed code sits in old prefs. It must NOT reach the Buy URL.
      [PREFS_KEY]: JSON.stringify({ colorwayVersion: 4, preferredAgent: "superbuy", affiliateCodes: { superbuy: "THEIRS" } }),
    });
    vi.stubEnv("VITE_CREDENZA_REF_SUPERBUY", "KYLE123");
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
    expect(open).not.toHaveBeenCalledWith(expect.stringContaining("THEIRS"), "_blank", "noopener");
    // Stored item links stay canonical either way.
    expect(JSON.stringify(JSON.parse(data[STORE_KEY]))).not.toContain("KYLE123");
    vi.unstubAllEnvs();
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

    // Import lives in the profile sheet now (design handoff PR3). The cold open
    // lands straight on the hero — the first-run intro gate is gone (2026-07-26).
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

describe("Import junk guard (Kyle 2026-07-24)", () => {
  // A copied Reddit PAGE (not a post body) is mostly UI chrome — "Open chat",
  // "Upvote", "Expand user menu". Those bare lines must never become cards.
  const PAGE_DUMP = `Skip to main content
Asics Kayano 14 Retail vs Rep (ZC Batch), how do you think? : r/FashionReps
Open menu
r/FashionReps
Search in r/FashionReps
Open chat
Create
Create post
Open inbox
Expand user menu
Upvote
34
Downvote
Reply
Share
Link ZC Batch: https://weidian.com/item.html?itemID=7783584498
View all moderators
Installed Apps`;

  it("turns a copied page dump into link cards only, never chrome cards", async () => {
    const data = installShim({ [STORE_KEY]: JSON.stringify([]) });
    const user = userEvent.setup();
    render(<Credenza />);

    await user.click(await screen.findByRole("button", { name: "Profile" }));
    await user.click(await screen.findByRole("button", { name: /Import & backup/ }));
    const box = await screen.findByLabelText(/Paste haul links/);
    fireEvent.change(box, { target: { value: PAGE_DUMP } });

    // Exactly one fresh candidate: the Weidian line. No chrome.
    await user.click(await screen.findByRole("button", { name: "Import 1" }));
    await waitFor(() => expect(JSON.parse(data[STORE_KEY])).toHaveLength(1));

    const items = JSON.parse(data[STORE_KEY]);
    expect(items[0].rawText).toContain("weidian.com/item.html?itemID=7783584498");
    expect(items.some((i) => /open chat|upvote|expand user menu/i.test(i.title || ""))).toBe(false);
  });

  it("offers Undo import on a big import and reverses it in one tap", async () => {
    const data = installShim({ [STORE_KEY]: JSON.stringify([]) });
    const user = userEvent.setup();
    render(<Credenza />);

    await user.click(await screen.findByRole("button", { name: "Profile" }));
    await user.click(await screen.findByRole("button", { name: /Import & backup/ }));
    const box = await screen.findByLabelText(/Paste haul links/);
    fireEvent.change(box, {
      target: {
        value: [
          "- black jeans size 32",
          "- kappa tee medium",
          "- carhartt socks pack",
          "- nike dunk low panda",
          "- stussy 8 ball tee",
          "- mook hoodie large",
        ].join("\n"),
      },
    });

    await user.click(await screen.findByRole("button", { name: "Import 6" }));
    await waitFor(() => expect(JSON.parse(data[STORE_KEY])).toHaveLength(6));

    await user.click(await screen.findByRole("button", { name: "Undo import" }));
    await waitFor(() => expect(JSON.parse(data[STORE_KEY])).toHaveLength(0));
  });

  it("clears the whole shelf from the import sheet, with an undo", async () => {
    const seed = [
      { id: "a", createdAt: 1, updatedAt: 1, rawText: "https://weidian.com/item.html?itemID=1", url: "https://weidian.com/item.html?itemID=1", canonicalKey: "weidian:1", type: "link", host: "weidian.com", title: "Real card one", status: "ready", tags: [], gallery: [] },
      { id: "b", createdAt: 2, updatedAt: 2, rawText: "https://weidian.com/item.html?itemID=2", url: "https://weidian.com/item.html?itemID=2", canonicalKey: "weidian:2", type: "link", host: "weidian.com", title: "Real card two", status: "ready", tags: [], gallery: [] },
    ];
    const data = installShim({ [STORE_KEY]: JSON.stringify(seed) });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    render(<Credenza />);

    // Wait for the shelf to hydrate — see the search-field test for why (the
    // first-run intro can flash for one render and detach early grabs).
    await screen.findAllByText("Real card one");
    await user.click(await screen.findByRole("button", { name: "Profile" }));
    await user.click(await screen.findByRole("button", { name: /Import & backup/ }));
    await user.click(await screen.findByRole("button", { name: /Clear the whole shelf/ }));
    await waitFor(() => expect(JSON.parse(data[STORE_KEY])).toHaveLength(0));

    await user.click(await screen.findByRole("button", { name: "Undo" }));
    await waitFor(() => expect(JSON.parse(data[STORE_KEY])).toHaveLength(2));
  });
});

// LB-68 (Kyle 2026-07-27): "The stash button just copies your clipboard in,
// but realistically, I think when you hit the stash button, it should pull up
// the stash to shelf, how it is in the mobile."
//
// The Stash button used to split: phone opened this sheet, desktop called
// stashClipboard() and read navigator.clipboard silently. One button, two
// behaviors, and the desktop one showed the user nothing before it acted.
//
// These tests run with NO phone media match, so they fail the moment the sheet
// is gated behind isPhone again. They assert the SHEET is on screen and the
// clipboard was NOT read — not that a handler was called. Deleting the sheet
// cannot make them pass.
describe("Stash sheet on desktop (LB-68, Kyle 2026-07-27)", () => {
  it("the desktop Stash button opens the sheet instead of reading the clipboard", async () => {
    installShim({ [STORE_KEY]: JSON.stringify([]) });
    const readText = vi.fn(() => Promise.resolve("https://weidian.com/item.html?itemID=1"));
    const had = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { readText },
    });
    try {
      const user = userEvent.setup();
      render(<Credenza />);
      await user.click(await screen.findByRole("button", { name: "Stash a link or note" }));

      // The sheet is on screen: its own title and its own paste box.
      expect(await screen.findByText("Stash to shelf")).toBeInTheDocument();
      expect(
        await screen.findByPlaceholderText(/Paste a link, a whole/)
      ).toBeInTheDocument();
      // And nothing was taken from the clipboard behind the user's back.
      expect(readText).not.toHaveBeenCalled();
    } finally {
      if (had) Object.defineProperty(navigator, "clipboard", had);
      else delete navigator.clipboard;
    }
  });

  it("a link typed in the desktop bar still stashes without the sheet", async () => {
    // The sheet is for an EMPTY field. Text already in the field is already
    // reviewed, so the button must keep stashing it in one press.
    const data = installShim({ [STORE_KEY]: JSON.stringify([]) });
    const user = userEvent.setup();
    render(<Credenza />);
    const field = await screen.findByPlaceholderText("Paste a link");
    fireEvent.change(field, {
      target: { value: "https://weidian.com/item.html?itemID=7649592219" },
    });
    await user.click(await screen.findByRole("button", { name: "Stash a link or note" }));

    await waitFor(() => expect(JSON.parse(data[STORE_KEY])).toHaveLength(1));
    expect(screen.queryByText("Stash to shelf")).toBeNull();
  });
});

describe("Link-only ambient clipboard capture", () => {
  it("does not show a clipboard shortcut for URL-free prose", async () => {
    installShim({ [STORE_KEY]: JSON.stringify([fashionItem()]) });
    const readText = vi.fn().mockResolvedValue(
      "2. Review risk. Apple reviews this niche hard.\n3. Check the screenshots."
    );
    const restoreClipboard = installClipboard(readText);
    try {
      render(<Credenza />);
      await screen.findAllByText("Palace x Nike jersey");
      await waitFor(() => expect(readText).toHaveBeenCalled());
      expect(screen.queryByRole("button", { name: /link on your clipboard/i })).toBeNull();
    } finally {
      restoreClipboard();
    }
  });

  it("re-reads and stashes one valid clipboard link", async () => {
    const link = "https://weidian.com/item.html?itemID=7649592219";
    const data = installShim({ [STORE_KEY]: JSON.stringify([fashionItem()]) });
    const readText = vi.fn().mockResolvedValue(link);
    const restoreClipboard = installClipboard(readText);
    try {
      render(<Credenza />);
      await waitFor(() =>
        expect(document.querySelector(".cz-desk-clip-banner")).not.toBeNull()
      );
      fireEvent.click(document.querySelector(".cz-desk-clip-banner"));

      await waitFor(() => expect(JSON.parse(data[STORE_KEY])).toHaveLength(2));
      expect(readText.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(JSON.parse(data[STORE_KEY]).some((item) => item.url === link)).toBe(true);
    } finally {
      restoreClipboard();
    }
  });

  it("imports only valid links from mixed clipboard text", async () => {
    const first = "https://weidian.com/item.html?itemID=7649592219";
    const second = "https://shop1850859027.v.weidian.com/item.html?itemID=7808837642";
    const mixed = [
      "Items from this review:",
      first,
      "2. Review risk. Apple reviews this niche hard.",
      second,
      "3. This sentence must not become a card.",
    ].join("\n");
    const data = installShim({ [STORE_KEY]: JSON.stringify([fashionItem()]) });
    const restoreClipboard = installClipboard(vi.fn().mockResolvedValue(mixed));
    try {
      render(<Credenza />);
      await waitFor(() =>
        expect(document.querySelector(".cz-desk-clip-banner")).not.toBeNull()
      );
      fireEvent.click(document.querySelector(".cz-desk-clip-banner"));

      await waitFor(() => expect(JSON.parse(data[STORE_KEY])).toHaveLength(3));
      const imported = JSON.parse(data[STORE_KEY]).filter((item) => item.id !== "fashion-1");
      expect(imported.map((item) => item.url).sort()).toEqual([first, second].sort());
      expect(imported.every((item) => item.type !== "note")).toBe(true);
      expect(imported.every((item) => !item.rawText.includes("Review risk"))).toBe(true);
    } finally {
      restoreClipboard();
    }
  });

  it("rejects a stale shortcut when the clipboard changes to prose", async () => {
    const data = installShim({ [STORE_KEY]: JSON.stringify([fashionItem()]) });
    const readText = vi
      .fn()
      .mockResolvedValueOnce("https://weidian.com/item.html?itemID=7649592219")
      .mockResolvedValue("2. Review risk. This is not a link.");
    const restoreClipboard = installClipboard(readText);
    try {
      render(<Credenza />);
      await waitFor(() =>
        expect(document.querySelector(".cz-desk-clip-banner")).not.toBeNull()
      );
      fireEvent.click(document.querySelector(".cz-desk-clip-banner"));

      expect(await screen.findByText(/No links found/)).toBeInTheDocument();
      expect(document.querySelector(".cz-desk-clip-banner")).toBeNull();
      expect(JSON.parse(data[STORE_KEY])).toHaveLength(1);
    } finally {
      restoreClipboard();
    }
  });

  it("shows a new same-host link after stashing the previous link", async () => {
    // CH-04 deleted the ✕ — the banner is informational and tappable only.
    // The fingerprint memory now guards the stash path: after a stash the
    // same link stays hidden, but a NEW link from the same host must still
    // produce a fresh banner on the next focus probe.
    const readText = vi
      .fn()
      .mockResolvedValueOnce("https://weidian.com/item.html?itemID=111") // mount probe
      .mockResolvedValueOnce("https://weidian.com/item.html?itemID=111") // stash read
      .mockResolvedValue("https://weidian.com/item.html?itemID=222"); // focus probe
    const data = installShim({ [STORE_KEY]: JSON.stringify([fashionItem()]) });
    const restoreClipboard = installClipboard(readText);
    try {
      render(<Credenza />);
      await waitFor(() =>
        expect(document.querySelector(".cz-desk-clip-banner")).not.toBeNull()
      );
      // No ✕ inside or beside the banner (CH-04 accept).
      expect(document.querySelector(".cz-desk-clip-dismiss")).toBeNull();
      fireEvent.click(document.querySelector(".cz-desk-clip-banner"));
      await waitFor(() => expect(JSON.parse(data[STORE_KEY])).toHaveLength(2));
      expect(document.querySelector(".cz-desk-clip-banner")).toBeNull();

      fireEvent.focus(window);
      await waitFor(() =>
        expect(document.querySelector(".cz-desk-clip-banner")).not.toBeNull()
      );
    } finally {
      restoreClipboard();
    }
  });

  it("ignores URL-free unowned desktop paste", async () => {
    const data = installShim({ [STORE_KEY]: JSON.stringify([fashionItem()]) });
    render(<Credenza />);
    await screen.findAllByText("Palace x Nike jersey");

    fireEvent.paste(window, {
      clipboardData: {
        getData: () => "2. Review risk.\n3. This prose has no link.",
        items: [],
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(JSON.parse(data[STORE_KEY])).toHaveLength(1);
  });

  it("leaves URL-free search paste to the browser", async () => {
    const data = installShim({ [STORE_KEY]: JSON.stringify([fashionItem()]) });
    render(<Credenza />);
    await screen.findAllByText("Palace x Nike jersey");
    const field = document.querySelector(".cz-desk-search-field");
    expect(field).not.toBeNull();
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", {
      value: { getData: () => "review notes without a link" },
    });

    fireEvent(field, event);

    expect(event.defaultPrevented).toBe(false);
    expect(JSON.parse(data[STORE_KEY])).toHaveLength(1);
  });

  it("leaves a URL search paste to the browser too (CH-04)", async () => {
    // The desktop field only ever searches. A pasted link lands as text and
    // filters the shelf; it must never become a card from this field.
    const data = installShim({ [STORE_KEY]: JSON.stringify([fashionItem()]) });
    render(<Credenza />);
    await screen.findAllByText("Palace x Nike jersey");
    const field = document.querySelector(".cz-desk-search-field");
    expect(field).not.toBeNull();
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", {
      value: { getData: () => "https://weidian.com/item.html?itemID=7649592219" },
    });

    fireEvent(field, event);

    expect(event.defaultPrevented).toBe(false);
    expect(JSON.parse(data[STORE_KEY])).toHaveLength(1);
  });
});

describe("Explicit query capture intent", () => {
  it("accepts stash capture and preserves unrelated query state", async () => {
    const link = "https://weidian.com/item.html?itemID=7649592219";
    const data = installShim({ [STORE_KEY]: JSON.stringify([]) });
    window.history.replaceState(
      null,
      "",
      "/?ref=lookbook&stash=" + encodeURIComponent(link) + "&title=Jacket#saved"
    );

    render(<Credenza />);

    await waitFor(() => expect(JSON.parse(data[STORE_KEY])).toHaveLength(1));
    expect(JSON.parse(data[STORE_KEY])[0].url).toBe(link);
    expect(window.location.search).toBe("?ref=lookbook");
    expect(window.location.hash).toBe("#saved");
  });

  it.each([
    ["text", "ordinary clipboard prose"],
    ["url", "https://weidian.com/item.html?itemID=7649592219"],
  ])("ignores a bare %s parameter", async (key, value) => {
    const data = installShim({ [STORE_KEY]: JSON.stringify([]) });
    const original = "/?" + key + "=" + encodeURIComponent(value);
    window.history.replaceState(null, "", original);

    render(<Credenza />);
    await screen.findByPlaceholderText("Paste a link");

    expect(JSON.parse(data[STORE_KEY])).toHaveLength(0);
    expect(window.location.search).toBe(new URL(original, window.location.origin).search);
  });

  it("accepts a marked text-only PWA share", async () => {
    const text = "shared note from another application";
    const data = installShim({ [STORE_KEY]: JSON.stringify([]) });
    window.history.replaceState(
      null,
      "",
      "/?share_target=1&text=" + encodeURIComponent(text)
    );

    render(<Credenza />);

    await waitFor(() => expect(JSON.parse(data[STORE_KEY])).toHaveLength(1));
    const [item] = JSON.parse(data[STORE_KEY]);
    expect(item.type).toBe("note");
    expect(item.rawText).toBe(text);
    expect(window.location.search).toBe("");
  });
});

describe("Auto-detect capture (one setup, Kyle 2026-07-24)", () => {
  // The capture sheet is the mobile bottom sheet (KM-03): these tests run on
  // an emulated phone viewport so the sheet renders at all.
  beforeEach(() => window.__setMediaMatches("(max-width: 767px)", true));
  afterEach(() => window.__setMediaMatches("(max-width: 767px)", false));

  const KYLE_POST = `Adidas CNY Tang Jacket (Size M) - Buttery smooth fabric, love the colour. Fits TTS.
W2C: https://weidian.com/item.html?itemID=7649592219

⸻

Vans Old Skool 36 Souvenir (EU42.5, TOP Batch) - Fits like any other Old Skool. Fits TTS.
W2C: https://shop1850859027.v.weidian.com/item.html?itemID=7808837642`;

  async function startFromEmptyShelf(user) {
    // Empty shelf is one field + ＋ Stash — the button opens the capture sheet.
    await user.click(await screen.findByRole("button", { name: "Stash a link or note" }));
  }

  it("shows one paste box and no mode tabs", async () => {
    installShim({ [STORE_KEY]: JSON.stringify([]) });
    const user = userEvent.setup();
    render(<Credenza />);
    await startFromEmptyShelf(user);

    expect(screen.queryByRole("group", { name: "Stash mode" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reddit haul" })).toBeNull();
    const box = await screen.findByPlaceholderText(/Paste a link, a whole/);
    expect(box).toBeInTheDocument();
    expect(box.getAttribute("aria-label")).toBe("Stash a link or note");
    // Step 4 removed the source dot row and the text-button pair.
    expect(document.querySelector(".cz-stash-sources")).toBeNull();
    expect(document.querySelector(".cz-capture-sheet-links")).toBeNull();
    // Import moved behind Profile, and the sheet says so.
    expect(screen.getByText(/Profile → Import/)).toBeInTheDocument();
  });

  it("previews what a paste becomes before it stashes anything", async () => {
    const data = installShim({ [STORE_KEY]: JSON.stringify([]) });
    const user = userEvent.setup();
    render(<Credenza />);
    await startFromEmptyShelf(user);

    const box = await screen.findByPlaceholderText(/Paste a link, a whole/);
    fireEvent.change(box, { target: { value: KYLE_POST } });

    // Two items in the paste, so the button counts them and the list shows
    // them. Nothing is on the shelf yet — the preview is read-only.
    expect(await screen.findByRole("button", { name: "Stash 2 items" })).toBeInTheDocument();
    expect(screen.getByText(/2 links in this haul/)).toBeInTheDocument();
    expect(document.querySelectorAll(".cz-stash-row")).toHaveLength(2);
    expect(JSON.parse(data[STORE_KEY])).toHaveLength(0);
  });

  it("a stash offers an Undo that takes the card back off the shelf", async () => {
    const data = installShim({ [STORE_KEY]: JSON.stringify([]) });
    const user = userEvent.setup();
    render(<Credenza />);
    await startFromEmptyShelf(user);

    const box = await screen.findByPlaceholderText(/Paste a link, a whole/);
    fireEvent.change(box, { target: { value: "https://weidian.com/item.html?itemID=7649592219" } });
    await user.click(await screen.findByRole("button", { name: /^Stash · 1 link$/ }));

    await waitFor(() => expect(JSON.parse(data[STORE_KEY])).toHaveLength(1));
    expect(await screen.findByText(/^Stashed · /)).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Undo" }));
    await waitFor(() => expect(JSON.parse(data[STORE_KEY])).toHaveLength(0));
  });

  it("a URL-free single line stashes as a plain note card", async () => {
    const data = installShim({ [STORE_KEY]: JSON.stringify([]) });
    const user = userEvent.setup();
    render(<Credenza />);
    await startFromEmptyShelf(user);

    const box = await screen.findByPlaceholderText(/Paste a link, a whole/);
    fireEvent.change(box, { target: { value: "remember the Gats in size 42" } });
    fireEvent.keyDown(box, { key: "Enter" });

    await waitFor(() => expect(JSON.parse(data[STORE_KEY])).toHaveLength(1));
    const [item] = JSON.parse(data[STORE_KEY]);
    expect(item.type).toBe("note");
    expect(item.url).toBeNull();
  });

  it("reviews URL-free clipboard prose before saving it as one note", async () => {
    const prose = [
      "2. Review risk. Apple reviews this niche hard.",
      "3. Keep replica vocabulary out of screenshots.",
      "4. Check the store metadata before launch.",
    ].join("\n");
    const data = installShim({ [STORE_KEY]: JSON.stringify([]) });
    const user = userEvent.setup();
    const restoreClipboard = installClipboard(vi.fn().mockResolvedValue(prose));
    try {
      render(<Credenza />);
      await startFromEmptyShelf(user);

      await user.click(await screen.findByRole("button", { name: "Paste & stash" }));

      const box = await screen.findByRole("textbox", { name: "Stash a link or note" });
      await waitFor(() => expect(box).toHaveValue(prose));
      expect(screen.getByText("No links found.")).toBeInTheDocument();
      expect(screen.getByText("1 note from this text")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Save as 1 note" })).toBeInTheDocument();
      expect(JSON.parse(data[STORE_KEY])).toHaveLength(0);

      await user.click(screen.getByRole("button", { name: "Save as 1 note" }));
      await waitFor(() => expect(JSON.parse(data[STORE_KEY])).toHaveLength(1));
      const [item] = JSON.parse(data[STORE_KEY]);
      expect(item.type).toBe("note");
      expect(item.url).toBeNull();
      expect(item.rawText).toBe(prose);
    } finally {
      restoreClipboard();
    }
  });

  it("clears clipboard note review when the user replaces the text", async () => {
    const data = installShim({ [STORE_KEY]: JSON.stringify([]) });
    const user = userEvent.setup();
    const restoreClipboard = installClipboard(
      vi.fn().mockResolvedValue("2. Review risk. This clipboard has no link.")
    );
    try {
      render(<Credenza />);
      await startFromEmptyShelf(user);
      await user.click(await screen.findByRole("button", { name: "Paste & stash" }));
      await screen.findByText("No links found.");

      const box = await screen.findByRole("textbox", { name: "Stash a link or note" });
      fireEvent.change(box, {
        target: { value: "https://weidian.com/item.html?itemID=7649592219" },
      });

      expect(screen.queryByText("No links found.")).toBeNull();
      expect(screen.queryByText("1 note from this text")).toBeNull();
      await user.click(screen.getByRole("button", { name: "Stash · 1 link" }));
      await waitFor(() => expect(JSON.parse(data[STORE_KEY])).toHaveLength(1));
      expect(JSON.parse(data[STORE_KEY])[0].url).toContain("7649592219");
    } finally {
      restoreClipboard();
    }
  });

  it("pasted post text becomes one card per item, notes aligned — no mode pick", async () => {
    const data = installShim({ [STORE_KEY]: JSON.stringify([]) });
    const user = userEvent.setup();
    render(<Credenza />);
    await startFromEmptyShelf(user);

    const box = await screen.findByPlaceholderText(/Paste a link, a whole/);
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

  it("a lone Reddit post link routes to the haul path", async () => {
    const data = installShim({ [STORE_KEY]: JSON.stringify([]) });
    const user = userEvent.setup();
    render(<Credenza />);
    await startFromEmptyShelf(user);

    const box = document.querySelector(".cz-stash-paste");
    expect(box).toBeTruthy();
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

describe("Storage hydration race (audit 2026-07-24)", () => {
  beforeEach(() => window.__setMediaMatches("(max-width: 767px)", true));
  afterEach(() => window.__setMediaMatches("(max-width: 767px)", false));

  it("a stash during the load window survives the delayed load", async () => {
    // Items load stays pending until the test resolves it. Prefs load
    // normally, so the intro and capture flows work.
    let resolveItems;
    const itemsGate = new Promise((res) => {
      resolveItems = res;
    });
    const data = {};
    window.storage = {
      get: async (key) => {
        if (key === STORE_KEY) return itemsGate;
        return key in data ? { value: data[key] } : null;
      },
      set: async (key, value) => {
        data[key] = value;
      },
    };
    const user = userEvent.setup();
    render(<Credenza />);

    // Stash a note while the items load is pending.
    await user.click(await screen.findByRole("button", { name: "Stash a link or note" }));
    const box = await screen.findByPlaceholderText(/Paste a link, a whole/);
    fireEvent.change(box, { target: { value: "stashed during load" } });
    fireEvent.keyDown(box, { key: "Enter" });
    // The stash is in memory only — the load has not resolved, so nothing
    // has persisted yet.
    expect(data[STORE_KEY]).toBeUndefined();

    // The delayed load resolves with one older stored item.
    resolveItems({ value: JSON.stringify([fashionItem({ id: "stored-1", title: "Stored jacket" })]) });

    // Both items survive: the stash is not replaced by the load result.
    await waitFor(() => {
      const saved = JSON.parse(data[STORE_KEY] || "[]");
      expect(saved).toHaveLength(2);
    });
    const titles = JSON.parse(data[STORE_KEY]).map((x) => x.title || x.rawText);
    expect(titles).toContain("Stored jacket");
    expect(titles.some((t) => String(t).includes("stashed during load"))).toBe(true);
  });
});

describe("Fashion accessibility (Part 5)", () => {
  it("exposes the active carousel option to assistive tech", async () => {
    installShim({ [STORE_KEY]: JSON.stringify([fashionItem()]) });
    render(<Credenza />);
    const carousel = await screen.findByRole("listbox", { name: "Card carousel" });
    expect(carousel).toHaveAttribute("aria-activedescendant", "card-fashion-1");
    expect(document.getElementById("card-fashion-1")).toHaveAttribute("aria-selected", "true");
  });

  it("carousel shelf has no axe violations", async () => {
    installShim({ [STORE_KEY]: JSON.stringify([fashionItem()]) });
    const { container } = render(<Credenza />);
    await screen.findByRole("listbox", { name: "Card carousel" });
    const results = await axe(container, {
      rules: {
        // Documented exception (Part 5): a carousel card is a rich option —
        // the Flip face wraps the Buy and flip-cue controls by design, and
        // every inner control stays independently reachable by keyboard.
        // The card shortcuts now defer to focused controls (see the global
        // key-handler guard), so the nesting is operable, not trapping.
        "nested-interactive": { enabled: false },
      },
    });
    expect(results).toHaveNoViolations();
  }, 20000);

  it("empty shelf has no axe violations", async () => {
    installShim();
    const { container } = render(<Credenza />);
    await waitFor(() =>
      expect(screen.queryByText(/opening shelf/i)).not.toBeInTheDocument()
    );
    expect(await axe(container)).toHaveNoViolations();
  }, 20000);

  it("haul listbox walks rows with arrows, wraps, and picks with Enter", async () => {
    const data = installShim({
      [STORE_KEY]: JSON.stringify([
        fashionItem({ id: "fashion-1", project: "" }),
        fashionItem({
          id: "fashion-2",
          title: "Second jacket",
          project: "Summer haul",
          createdAt: Date.now() - 1000,
        }),
        fashionItem({
          id: "fashion-3",
          title: "Third jacket",
          project: "Winter haul",
          createdAt: Date.now() - 2000,
        }),
      ]),
    });
    const user = userEvent.setup();
    const { container } = render(<Credenza />);
    const flipButtons = await screen.findAllByRole("button", { name: /Flip/ });
    await user.click(flipButtons[0]);
    // The Haul tab opens the same keyboard-operated accordion listbox.
    await user.click(screen.getByRole("tab", { name: "Haul" }));
    await user.click(screen.getByRole("button", { name: /Add to a haul/i }));
    const listbox = await screen.findByRole("listbox", { name: "Hauls" });
    const options = [...listbox.querySelectorAll('[role="option"]')];
    expect(options.length).toBeGreaterThanOrEqual(2);
    // Arrow keys walk the rows and wrap.
    options[0].focus();
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(options[1]);
    await user.keyboard("{ArrowUp}{ArrowUp}");
    // Wrapped from row one to the last row (options + add-new + maybe clear).
    const allRows = [...listbox.querySelectorAll("button, input")].filter((el) => !el.disabled);
    expect(document.activeElement).toBe(allRows[allRows.length - 1]);
    // Back to the second option; Enter picks it. The unified back saves
    // through the shared 600ms write-through debounce, so allow for it.
    options[1].focus();
    await user.keyboard("{Enter}");
    await waitFor(
      () => {
        const saved = JSON.parse(data[STORE_KEY]);
        const first = saved.find((x) => x.id === "fashion-1");
        expect(["Summer haul", "Winter haul"]).toContain(first.project);
      },
      { timeout: 2000 }
    );
  });
});

describe("Mobile detail sheet (handoff step 5, 2026-07-25)", () => {
  beforeEach(() => window.__setMediaMatches("(max-width: 767px)", true));
  afterEach(() => window.__setMediaMatches("(max-width: 767px)", false));

  async function openSheet(user) {
    await user.click(await screen.findByRole("button", { name: /^Open Palace x Nike jersey$/ }));
    return screen.findByRole("dialog", { name: "Palace x Nike jersey" });
  }

  it("a card tap opens the detail sheet, not the carousel overlay", async () => {
    installShim({ [STORE_KEY]: JSON.stringify([fashionItem()]) });
    const user = userEvent.setup();
    render(<Credenza />);

    const sheet = await openSheet(user);
    expect(sheet).toBeInTheDocument();
    expect(document.querySelector(".cz-detail-surface")).not.toBeNull();
    // The phone path never opens the carousel overlay.
    expect(document.querySelector(".cz-carousel-overlay")).toBeNull();
  });

  it("has no edit mode or Save button and exposes four detail tabs", async () => {
    installShim({ [STORE_KEY]: JSON.stringify([fashionItem()]) });
    const user = userEvent.setup();
    render(<Credenza />);
    const sheet = await openSheet(user);

    expect(within(sheet).queryByRole("button", { name: /^Save$/ })).toBeNull();
    expect(within(sheet).queryByRole("button", { name: /^Edit$/ })).toBeNull();
    expect(within(sheet).getAllByRole("tab").map((tab) => tab.textContent.trim())).toEqual([
      "Size",
      "Colorway",
      "Weight",
      "Haul",
    ]);
    expect(screen.getByRole("tab", { name: "Size" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("tab", { name: "Batch" })).toBeNull();
  });

  it("the category select row shows the auto value and a pick persists with a pin", async () => {
    const data = installShim({
      [STORE_KEY]: JSON.stringify([fashionItem({ category: "shirt" })]),
    });
    const user = userEvent.setup();
    render(<Credenza />);
    const sheet = await openSheet(user);

    // CH-07 accept: the auto-detected value is visible without opening the list.
    const row = within(sheet).getByRole("button", { name: "Category: Shirts. Change." });
    expect(row.className).toContain("cz-catselect-btn");
    expect(within(row).getByText("auto")).toBeInTheDocument();

    await user.click(row);
    const list = within(sheet).getByRole("listbox", { name: "Category" });
    const shirts = within(list).getByRole("option", { name: "Shirts" });
    expect(shirts).toHaveAttribute("aria-selected", "true");
    await user.click(within(list).getByRole("option", { name: "Pants" }));

    await waitFor(() => {
      const saved = JSON.parse(data[STORE_KEY] || "[]");
      expect(saved[0].category).toBe("pants");
      expect(saved[0].categoryManual).toBe(true);
    });
    // The row now shows the pick and drops the auto tag.
    const picked = within(sheet).getByRole("button", { name: "Category: Pants. Change." });
    expect(within(picked).queryByText("auto")).toBeNull();
  });

  it("the Colorway tab exposes one editor and the edit persists", async () => {
    const data = installShim({ [STORE_KEY]: JSON.stringify([fashionItem()]) });
    const user = userEvent.setup();
    render(<Credenza />);
    const sheet = await openSheet(user);

    await user.click(within(sheet).getByRole("tab", { name: "Colorway" }));
    const panel = within(sheet).getByRole("tabpanel");
    const input = within(panel).getByRole("textbox", { name: "Colorway" });
    // 16px is the iOS zoom floor. The editor class carries this rule.
    expect(input.className).toContain("cz-detail-editor-input");
    expect(panel.querySelectorAll(".cz-detail-editor-input")).toHaveLength(1);

    fireEvent.change(input, { target: { value: "Bone white" } });
    await waitFor(() => {
      const saved = JSON.parse(data[STORE_KEY] || "[]");
      expect(saved[0].colorway).toBe("Bone white");
    });
    expect(await screen.findByText("Saved")).toBeInTheDocument();
  });

  it("the Size tab exposes direct choices and the profile-size route", async () => {
    installShim({ [STORE_KEY]: JSON.stringify([fashionItem()]) });
    const user = userEvent.setup();
    render(<Credenza />);
    const sheet = await openSheet(user);

    const sizeTab = within(sheet).getByRole("tab", { name: "Size" });
    expect(sizeTab).toHaveAttribute("aria-selected", "true");
    const panel = within(sheet).getByRole("tabpanel");
    expect(within(panel).getByRole("button", { name: "X-Large" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(within(panel).getByRole("textbox", { name: "Custom item size" })).toHaveValue("XL");
    expect(screen.queryByLabelText("Size · fit")).toBeNull();
    expect(screen.getByRole("button", { name: "Edit sizes and measurements" })).toBeInTheDocument();
  });

  it("routes customer sizing through Settings", async () => {
    installShim({ [STORE_KEY]: JSON.stringify([fashionItem()]) });
    const user = userEvent.setup();
    render(<Credenza />);
    const detail = await openSheet(user);
    const editSizes = screen.getByRole("button", { name: "Edit sizes and measurements" });

    await user.click(editSizes);
    expect(await screen.findByRole("dialog", { name: "Sizes and measurements" })).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Palace x Nike jersey" })).toBe(detail);

    await user.click(screen.getByRole("button", { name: "Close Sizes and measurements" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Sizes and measurements" })).toBeNull()
    );
    expect(screen.getByRole("dialog", { name: "Palace x Nike jersey" })).toBe(detail);
    await waitFor(() => expect(editSizes).toHaveFocus());
  });

  it("the Size tab clears a hand size without an obsolete AI action", async () => {
    const data = installShim({
      [STORE_KEY]: JSON.stringify([
        fashionItem({
          size: "XL",
          category: "tops",
          sizeNotes:
            "S: 胸围108 衣长66\nM: 胸围112 衣长68\nL: 胸围116 衣长70\nXL: 胸围120 衣长72",
        }),
      ]),
      [PREFS_KEY]: JSON.stringify({
        colorwayVersion: 4,
        theme: "rainbow",
        bodyProfile: { chest: 100 },
        measureUnits: "cm",
      }),
    });
    const user = userEvent.setup();
    render(<Credenza />);
    await openSheet(user);

    expect(screen.getByRole("tab", { name: "Size" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("button", { name: "Use AI size" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Clear size" }));

    await waitFor(() => {
      const saved = JSON.parse(data[STORE_KEY] || "[]");
      expect(saved[0].size).toBe("");
    });
  });

  // The four tests below close the gap Kyle pointed at on 2026-07-26 ("how is
  // this the same as this"): the turn 9 mock states the size, its neighbours,
  // the next status step and a timeline on the first screen. The live sheet
  // hid all four behind a tap.
  function sizedShim(overrides = {}) {
    // Chart S–XL against a 100 cm chest → the recommender picks Medium.
    return installShim({
      [STORE_KEY]: JSON.stringify([
        fashionItem({
          size: "",
          category: "tops",
          sizeNotes:
            "S: 胸围108 衣长66\nM: 胸围112 衣长68\nL: 胸围116 衣长70\nXL: 胸围120 衣长72",
          ...overrides,
        }),
      ]),
      [PREFS_KEY]: JSON.stringify({
        colorwayVersion: 4,
        theme: "rainbow",
        bodyProfile: { chest: 100 },
        measureUnits: "cm",
      }),
    });
  }

  it("states the AI size on open, with no tap and no editor", async () => {
    sizedShim();
    const user = userEvent.setup();
    render(<Credenza />);
    await openSheet(user);

    // The sizing block is .cz-sizing, and an AI read is its default state —
    // "is-manual" is the modifier, so its ABSENCE is what proves the pick
    // came from the chart and not from a hand-typed size.
    const block = document.querySelector(".cz-sizing");
    expect(block).not.toBeNull();
    expect(block.className).not.toContain("is-manual");
    expect(block.querySelector(".cz-sizing-kicker").textContent.trim()).toBe("AI size");
    expect(block.querySelector(".cz-sizing-value").textContent.trim()).toBe("Medium");
    // The recommendation is stated, not hidden behind the fit breakdown.
    expect(document.querySelector(".cz-detail-fit")).toBeNull();
  });

  it("a Size tab choice writes the size in one tap", async () => {
    const data = sizedShim();
    const user = userEvent.setup();
    render(<Credenza />);
    await openSheet(user);

    expect(screen.getByRole("button", { name: "Small" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Large" }));

    await waitFor(() => expect(JSON.parse(data[STORE_KEY])[0].size).toBe("L"));
    expect(screen.getByRole("tab", { name: "Size" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("textbox", { name: "Custom item size" })).toHaveValue("L");
  });

  it("names the next status step and relabels it after the tap", async () => {
    const data = installShim({ [STORE_KEY]: JSON.stringify([fashionItem()]) });
    const user = userEvent.setup();
    render(<Credenza />);
    await openSheet(user);

    await user.click(screen.getByRole("button", { name: /^Mark bought/ }));
    await waitFor(() => expect(JSON.parse(data[STORE_KEY])[0].findStatus).toBe("bought"));
    expect(await screen.findByRole("button", { name: /^Mark shipped/ })).toBeInTheDocument();
  });

  it("generates a timeline from stored events", async () => {
    installShim({ [STORE_KEY]: JSON.stringify([fashionItem()]) });
    const user = userEvent.setup();
    render(<Credenza />);
    await openSheet(user);

    const timeline = document.querySelector(".cz-timeline");
    expect(timeline).not.toBeNull();
    expect(timeline.textContent).toMatch(/Clipped/);
  });

  it("the status track commits on one tap and keeps a sub-state", async () => {
    const data = installShim({
      [STORE_KEY]: JSON.stringify([fashionItem({ findStatus: "gl" })]),
    });
    const user = userEvent.setup();
    render(<Credenza />);
    await openSheet(user);

    const track = screen.getByRole("radiogroup", { name: "Order status" });
    const chips = Array.from(track.querySelectorAll("button"));
    expect(chips.map((c) => c.textContent)).toEqual(["Want", "Bought", "Shipped", "Received"]);
    // "gl" is a Bought sub-state, so Bought reads as the active stop.
    expect(chips[1].getAttribute("aria-checked")).toBe("true");

    // Re-tapping Bought must not downgrade a live gl back to plain bought.
    await user.click(chips[1]);
    await waitFor(() => expect(JSON.parse(data[STORE_KEY])[0].findStatus).toBe("gl"));

    await user.click(chips[2]);
    await waitFor(() => expect(JSON.parse(data[STORE_KEY])[0].findStatus).toBe("shipped"));
  });

  // ── Handoff turn 9 §5 / §6 ──
  it("the next-action pill advances the status in one tap", async () => {
    // §5: the four equal chips reported state but offered no way forward. A
    // single right-aligned primary owns the next transition.
    const data = installShim({
      [STORE_KEY]: JSON.stringify([fashionItem({ findStatus: "want" })]),
    });
    const user = userEvent.setup();
    render(<Credenza />);
    await openSheet(user);

    // The sub-label says where the order is, in the customer's words.
    expect(screen.getByText("WANT · NOT ORDERED")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Mark bought/ }));
    await waitFor(() => expect(JSON.parse(data[STORE_KEY])[0].findStatus).toBe("bought"));
    // The pill re-aims at the new next step; it is not a one-shot control.
    expect(await screen.findByRole("button", { name: /Mark shipped/ })).toBeInTheDocument();
  });

  it("an off-track status shows a detour node, never a fifth step", async () => {
    // §5: "Off-track states render as a labelled detour node, not a fifth
    // step." A failed QC is a decision, so it gets no one-tap primary either.
    installShim({ [STORE_KEY]: JSON.stringify([fashionItem({ findStatus: "rl" })]) });
    const user = userEvent.setup();
    render(<Credenza />);
    await openSheet(user);

    const track = screen.getByRole("radiogroup", { name: "Order status" });
    // Still four stops — the detour did not become a column.
    expect(track.querySelectorAll("button")).toHaveLength(4);
    expect(screen.getByText("QC failed")).toBeInTheDocument();
    expect(screen.getByText("QC FAILED · YOUR CALL")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Mark / })).toBeNull();
  });

  it("the timeline is generated from what the item already carries", async () => {
    // §6: "generated from existing events — no new user input". The fixture
    // has a seller, a price, a hand size, and no haul, so it earns two rows.
    installShim({ [STORE_KEY]: JSON.stringify([fashionItem({ project: "" })]) });
    const user = userEvent.setup();
    render(<Credenza />);
    await openSheet(user);

    const rows = document.querySelectorAll(".cz-timeline-row");
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("Clipped from Mook-official");
    expect(rows[1].textContent).toContain("Sized");
    // A haul row appears only when the item is in a haul.
    expect(document.querySelector(".cz-timeline").textContent).not.toContain("Added to");
  });

  // ── Handoff turn 9 §4 ──
  it("both album links return, to two different destinations", async () => {
    // §4: "These are two different destinations and must not be merged."
    // Left opens every photo of THIS item; right opens the seller's store.
    // Merging them is what lost the seller's profile.
    installShim({ [STORE_KEY]: JSON.stringify([fashionItem()]) });
    const user = userEvent.setup();
    render(<Credenza />);
    await openSheet(user);

    const row = document.querySelector(".cz-album-links");
    const tiles = row.querySelectorAll("a.cz-album-link-tile");
    expect(tiles).toHaveLength(2);
    expect(tiles[0].getAttribute("href")).toBe(
      "https://mook-official.x.yupoo.com/albums/244505824?uid=1"
    );
    expect(tiles[1].getAttribute("href")).toBe("https://mook-official.x.yupoo.com/");
    // The kickers name the KIND of destination, so the two never read alike.
    expect(tiles[0].textContent).toContain("All photos");
    expect(tiles[1].textContent).toContain("Seller");
  });

  it("the album row sits under the photo strip, not at the bottom of the rail", async () => {
    // §4: the strip and the links are "its own row below" the photo. §9 puts
    // them there in the phone order too — photo, strip, links, then title.
    installShim({ [STORE_KEY]: JSON.stringify([fashionItem()]) });
    const user = userEvent.setup();
    render(<Credenza />);
    await openSheet(user);

    const tail = document.querySelector(".cz-detail-photo-tail");
    expect(tail.querySelector(".cz-detail-photos")).not.toBeNull();
    expect(tail.querySelector(".cz-album-links")).not.toBeNull();
    // The tail precedes the title, so the photo block is one object.
    const title = document.querySelector(".cz-detail-title-btn");
    expect(tail.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("omits a tile it cannot point anywhere, never an empty one", async () => {
    // Same rule as §1: omit, never invent. No seller account means no store
    // link, so the row shows the album alone rather than a dead tile.
    installShim({
      [STORE_KEY]: JSON.stringify([fashionItem({ seller: "", sellerAccount: "" })]),
    });
    const user = userEvent.setup();
    render(<Credenza />);
    await openSheet(user);

    const tiles = document.querySelectorAll(".cz-album-links a.cz-album-link-tile");
    expect(tiles).toHaveLength(1);
    expect(tiles[0].textContent).toContain("All photos");
  });

  // ── Handoff turn 9 §7 ──
  it("notes start clamped and Expand opens the same box", async () => {
    // §7: "Never a fixed 2-line box, never a truncation with no way out."
    // The label lives inside the box, so the box reads as one object. The
    // toggle changes the box height only — it never swaps in a second field,
    // so focus and the autosave path stay on the one textarea.
    installShim({ [STORE_KEY]: JSON.stringify([fashionItem()]) });
    const user = userEvent.setup();
    render(<Credenza />);
    await openSheet(user);

    const box = document.querySelector(".cz-detail-notes-box");
    const field = screen.getByRole("textbox", { name: "Notes" });
    expect(box.contains(field)).toBe(true);
    expect(box.classList.contains("is-open")).toBe(false);

    await user.click(screen.getByRole("button", { name: /Expand/ }));
    expect(box.classList.contains("is-open")).toBe(true);
    // Same node, not a replacement — the box is the field you type in.
    expect(screen.getByRole("textbox", { name: "Notes" })).toBe(field);

    await user.click(screen.getByRole("button", { name: /Collapse/ }));
    expect(box.classList.contains("is-open")).toBe(false);
  });

  it("typing in the notes opens the box, so text is never hidden as you write", async () => {
    // A clamped box that stays clamped while you type is the truncation §7
    // rejects. Focus opens it.
    installShim({ [STORE_KEY]: JSON.stringify([fashionItem({ note: "" })]) });
    const user = userEvent.setup();
    render(<Credenza />);
    await openSheet(user);

    const box = document.querySelector(".cz-detail-notes-box");
    expect(box.classList.contains("is-open")).toBe(false);
    await user.click(screen.getByRole("textbox", { name: "Notes" }));
    expect(box.classList.contains("is-open")).toBe(true);
  });

  // ── Handoff turn 9 §8 ──
  it("the Buy notch changes the agent in place and the label follows", async () => {
    // §8: the chevron segment opens the agent list at the moment the choice
    // matters. Before this the only path was Profile → Buying agent.
    const data = installShim({
      [STORE_KEY]: JSON.stringify([fashionItem()]),
      [PREFS_KEY]: JSON.stringify({ colorwayVersion: 4, preferredAgent: "superbuy" }),
    });
    const user = userEvent.setup();
    render(<Credenza />);
    await openSheet(user);

    expect(screen.getByRole("button", { name: /Buy via Superbuy/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Choose buying agent" }));

    const list = screen.getByRole("radiogroup", { name: "Buying agent" });
    // The saved agent is the checked radio, so the list says which one is live.
    expect(screen.getByRole("radio", { name: /Superbuy/ })).toBeChecked();

    await user.click(within(list).getByRole("radio", { name: /Sugargoo/ }));
    // The choice sticks as the default — the label and the stored pref agree.
    expect(await screen.findByRole("button", { name: /Buy via Sugargoo/ })).toBeInTheDocument();
    await waitFor(() =>
      expect(JSON.parse(data[PREFS_KEY]).preferredAgent).toBe("sugargoo")
    );
    // Picking closes the list: the choice is made, the notch is the answer.
    expect(screen.queryByRole("radiogroup", { name: "Buying agent" })).toBeNull();
  });

  it("every agent row shows the same item price, because that is the truth", async () => {
    // §8: "Item price is the same everywhere — agents differ on shipping and
    // service fee." Four different numbers would lie about what an agent
    // changes, so the repetition is the message.
    installShim({
      [STORE_KEY]: JSON.stringify([fashionItem({ price: 249, currency: "CNY" })]),
      [PREFS_KEY]: JSON.stringify({ colorwayVersion: 4, preferredAgent: "superbuy" }),
    });
    const user = userEvent.setup();
    render(<Credenza />);
    await openSheet(user);
    await user.click(screen.getByRole("button", { name: "Choose buying agent" }));

    const prices = [...document.querySelectorAll(".cz-agent-pop-price")].map(
      (el) => el.textContent
    );
    expect(prices.length).toBeGreaterThan(1);
    expect(new Set(prices).size).toBe(1);
    expect(
      screen.getByText(/agents differ on shipping and service fee/i)
    ).toBeInTheDocument();
  });

  // ── Handoff turn 9 §9 ──
  it("states the price once, in the footer box next to the notch", async () => {
    // §9: "price in a white hair-bordered box + the notched Buy filling the
    // rest". §1 took the price out of the chip row, so the footer is the only
    // place the phone says the number. Two places would be two chances to
    // disagree.
    installShim({
      [STORE_KEY]: JSON.stringify([fashionItem({ price: 229, currency: "CNY" })]),
    });
    const user = userEvent.setup();
    render(<Credenza />);
    await openSheet(user);

    // 229 CNY at the 0.14 fallback rate. The box shows USD because that is
    // what priceLabelShort prefers everywhere else on the shelf.
    const box = document.querySelector(".cz-detail-foot-price");
    expect(box).not.toBeNull();
    expect(box.textContent).toBe("$32.06");
    // One box, one notch, in that order — the notch takes the rest of the row.
    const row = box.closest(".cz-detail-foot-row");
    expect(row.querySelectorAll(".cz-detail-foot-price")).toHaveLength(1);
    expect(row.querySelector(".cz-buy-notch")).not.toBeNull();
    // The detail tabs do not duplicate the footer price.
    expect(document.querySelector(".cz-detail-tabs").textContent).not.toContain("32.06");
  });

  it("opens the price editor from the footer box, in USD", async () => {
    // §1 moved price out of the chip row, and the chip was the only opener.
    // Without this the number is uneditable. It opens in USD, not CNY (Kyle
    // 2026-07-26: "shouldn't default to CNY… default to USD if we have USD").
    installShim({
      [STORE_KEY]: JSON.stringify([fashionItem({ price: 229, currency: "CNY" })]),
    });
    const user = userEvent.setup();
    render(<Credenza />);
    await openSheet(user);

    const box = document.querySelector(".cz-detail-foot-price");
    expect(box.tagName).toBe("BUTTON");
    await user.click(box);

    const editor = document.querySelector(".cz-detail-editor");
    expect(editor).not.toBeNull();
    expect(editor.textContent).toContain("USD");
    expect(editor.querySelector(".cz-detail-editor-input").value).toBe("32.06");
    // A second tap closes it, the same way a chip toggles.
    await user.click(box);
    expect(document.querySelector(".cz-detail-editor")).toBeNull();
  });

  it("leads the hero cluster with the heart, and the heart writes through", async () => {
    // §9: "one cluster, top-right" — heart, ⋯, ✕. The heart used to live in
    // the card face only, so the sheet had no way to star what you were
    // reading.
    const data = installShim({ [STORE_KEY]: JSON.stringify([fashionItem()]) });
    const user = userEvent.setup();
    render(<Credenza />);
    const sheet = await openSheet(user);

    const cluster = sheet.querySelector(".cz-detail-hero-actions");
    expect(cluster).not.toBeNull();
    const labels = [...cluster.querySelectorAll("button")].map((b) =>
      b.getAttribute("aria-label")
    );
    expect(labels).toEqual(["Star Palace x Nike jersey", "More actions", "Close"]);

    await user.click(within(cluster).getByRole("button", { name: /^Star / }));
    // The star is a real write, not a hero-only flourish.
    await waitFor(() =>
      expect(JSON.parse(data[STORE_KEY])[0].favorite).toBe(true)
    );
    expect(
      within(cluster).getByRole("button", { name: /^Unstar / })
    ).toBeInTheDocument();
  });

  it("asks for QC photos only while the order is with the agent", async () => {
    // §9: the QC prompt asks about a moment that has not happened yet, so it
    // only asks while the order can answer. A standing "add QC photos" box on
    // a WANT item asks for something that cannot exist.
    installShim({ [STORE_KEY]: JSON.stringify([fashionItem({ findStatus: "want" })]) });
    const user = userEvent.setup();
    render(<Credenza />);
    await openSheet(user);
    expect(document.querySelector(".cz-detail-qc-prompt")).toBeNull();

    cleanup();
    installShim({ [STORE_KEY]: JSON.stringify([fashionItem({ findStatus: "shipped" })]) });
    render(<Credenza />);
    await openSheet(user);
    expect(document.querySelector(".cz-detail-qc-prompt")).not.toBeNull();
    expect(
      screen.getByText(/Add QC photos when your order arrives at the agent/i)
    ).toBeInTheDocument();

    // Once a QC photo exists the question is answered, so the box goes away.
    cleanup();
    installShim({
      [STORE_KEY]: JSON.stringify([
        fashionItem({ findStatus: "shipped", qcPhotos: [PHOTO_2] }),
      ]),
    });
    render(<Credenza />);
    await openSheet(user);
    expect(document.querySelector(".cz-detail-qc-prompt")).toBeNull();
  });

  it("keeps the sticky bar out of the tree where no observer exists", async () => {
    // §9's bar is driven by IntersectionObserver, which jsdom does not have —
    // and neither does an old iOS. No observer must mean no bar, never a bar
    // stuck up over the title. The gate is the observer, so the markup is
    // present but stays in its closed state.
    installShim({ [STORE_KEY]: JSON.stringify([fashionItem()]) });
    const user = userEvent.setup();
    render(<Credenza />);
    const sheet = await openSheet(user);

    const bar = sheet.querySelector(".cz-detail-stickybar");
    expect(bar).not.toBeNull();
    expect(bar.classList.contains("is-up")).toBe(false);
    // Down means hidden: it repeats controls the sheet already shows, so a
    // screen reader gains nothing and its ✕ must not take a tab stop.
    expect(bar).toHaveAttribute("aria-hidden", "true");
    expect(bar.querySelector(".cz-detail-stickybar-close")).toHaveAttribute("tabindex", "-1");
    // It says which item you are in, and it names who chose the size.
    expect(bar.querySelector(".cz-detail-stickybar-title").textContent).toBe(
      "Palace x Nike jersey"
    );
    // "SIZE", not "AI SIZE": the fixture carries a chosen size, so the bar
    // must not upgrade a saved choice into a recommendation. The token is
    // spelled the way the sizing block spells it.
    expect(bar.querySelector(".cz-detail-stickybar-meta").textContent).toBe(
      "SIZE X-Large · $32.06"
    );
    // The bar is a SIBLING of the scroller: a child would scroll away with
    // the content it exists to outlive.
    expect(bar.parentElement.querySelector(".cz-detail-scroll")).not.toBeNull();
    expect(bar.closest(".cz-detail-scroll")).toBeNull();
  });
});

describe("Phone haul board (Kyle 2026-07-25)", () => {
  beforeEach(() => window.__setMediaMatches("(max-width: 767px)", true));
  afterEach(() => window.__setMediaMatches("(max-width: 767px)", false));

  it("opening a haul keeps the card grid — the carousel never hijacks a phone", async () => {
    // Live defect: openHaul forced viewMode "carousel" on every device. On a
    // phone the rack glitched and the grid never came back until a restart.
    installShim({
      [STORE_KEY]: JSON.stringify([fashionItem({ project: "summer" })]),
      [PREFS_KEY]: JSON.stringify({ colorwayVersion: 4, theme: "rainbow", sortMode: "recent" }),
    });
    const user = userEvent.setup();
    const { container } = render(<Credenza />);

    await user.click(await screen.findByRole("tab", { name: /Hauls/ }));
    await user.click(await screen.findByRole("button", { name: /summer/ }));
    await waitFor(() => expect(container.querySelector(".cz-haul-board")).not.toBeNull());
    expect(screen.queryByRole("listbox", { name: "Card carousel" })).toBeNull();

    // Back to the Shelf: still the grid, not the rack.
    await user.click(screen.getByRole("tab", { name: "Shelf" }));
    expect(screen.queryByRole("listbox", { name: "Card carousel" })).toBeNull();
    expect(container.querySelector(".cz-carousel")).toBeNull();
  });
});

// 2026-07-25 (Kyle): the phone's Settings and Profile sheets were duplicates.
// Settings owns look-and-fit (theme, sizes, fit); Profile owns account and
// data (agent, currency, import, storage).
// CH-03 deleted the masthead ⋯ button, so the route into Settings is now
// avatar → Profile → Settings row.
describe("Phone sheet split (Kyle 2026-07-25)", () => {
  beforeEach(() => window.__setMediaMatches("(max-width: 767px)", true));
  afterEach(() => window.__setMediaMatches("(max-width: 767px)", false));

  it("Settings shows fit rows, never agent or import", async () => {
    installShim({
      [STORE_KEY]: JSON.stringify([fashionItem()]),
      [PREFS_KEY]: JSON.stringify({ colorwayVersion: 4, theme: "rainbow", sortMode: "recent" }),
    });
    const user = userEvent.setup();
    render(<Credenza />);

    await user.click(await screen.findByRole("button", { name: "Profile" }));
    await user.click(await screen.findByRole("button", { name: /^Settings/ }));
    expect(await screen.findByRole("button", { name: /Theme: Blackout/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sizes and measurements/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Fit preferences/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Fit summary/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Buying agent/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Import from file/ })).toBeNull();
  });

  it("Profile shows agent, currency and import, never the theme picker", async () => {
    installShim({
      [STORE_KEY]: JSON.stringify([fashionItem()]),
      [PREFS_KEY]: JSON.stringify({ colorwayVersion: 4, theme: "rainbow", sortMode: "recent" }),
    });
    const user = userEvent.setup();
    render(<Credenza />);

    await user.click(await screen.findByRole("button", { name: "Profile" }));
    expect(await screen.findByRole("button", { name: /Default agent/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Primary currency/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Import & backup/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Gallery/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Fit summary/ })).toBeNull();
  });
});
