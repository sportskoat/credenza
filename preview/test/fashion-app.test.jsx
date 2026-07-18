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
    expect(await screen.findByText("Poster wore")).toBeInTheDocument();
    expect(screen.getAllByText("S").length).toBeGreaterThan(0);
    expect(screen.getByText("Recommended")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buy" })).toBeInTheDocument();
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

  it("routes every Yupoo URL to numbered More Photos actions and keeps Buy first", async () => {
    const secondaryYupoo = "https://seller.x.yupoo.com/albums/999?uid=1&tab=max";
    const buyUrl = "https://weidian.com/item.html?itemID=1234567890";
    installShim({
      [STORE_KEY]: JSON.stringify([
        fashionItem({
          weidianUrl: "",
          links: [
            { url: secondaryYupoo, role: "buy" },
            { url: buyUrl, role: "buy" },
          ],
        }),
      ]),
    });
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const user = userEvent.setup();
    const { container } = render(<Credenza />);
    await user.click((await screen.findAllByRole("button", { name: /Flip/ }))[0]);

    const actions = [...container.querySelectorAll(".cz-carousel-actions > button")];
    expect(actions[0]).toHaveTextContent("Buy");
    expect(screen.getByRole("button", { name: "More Photos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More Photos 2" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "More Photos 2" }));
    expect(open).toHaveBeenLastCalledWith(secondaryYupoo, "_blank", "noopener");
  });
});

describe("Fashion card-back navigation and editing", () => {
  it("dismisses exactly one outside-click layer while inside clicks remain inert", async () => {
    installShim({ [STORE_KEY]: JSON.stringify([fashionItem({ batch: "Original" })]) });
    const user = userEvent.setup();
    const { container } = render(<Credenza />);
    await user.click((await screen.findAllByRole("button", { name: /Flip/ }))[0]);
    const outside = container.querySelector(".cz-carousel-track");

    await user.click(screen.getByRole("button", { name: "Sizes" }));
    expect(screen.getByText("Size info")).toBeInTheDocument();
    fireEvent.pointerDown(outside);
    fireEvent.click(outside);
    expect(screen.queryByText("Size info")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Card details" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("heading", { name: "Edit card" }));
    await user.clear(screen.getByLabelText("Batch"));
    await user.type(screen.getByLabelText("Batch"), "Discard me");
    fireEvent.pointerDown(outside);
    fireEvent.click(outside);
    expect(screen.queryByLabelText("Batch")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Card details" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Batch")).toHaveValue("Original");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.pointerDown(outside);
    fireEvent.click(outside);
    await waitFor(() => expect(container.querySelector(".cz-carousel-card-inner")).not.toHaveClass("is-flipped"));
  });

  it("uses the same bubble, edit, and details priority for Escape", async () => {
    installShim({ [STORE_KEY]: JSON.stringify([fashionItem()]) });
    const user = userEvent.setup();
    const { container } = render(<Credenza />);
    await user.click((await screen.findAllByRole("button", { name: /Flip/ }))[0]);
    await user.click(screen.getByRole("button", { name: "Sizes" }));

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByText("Size info")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Card details" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByLabelText("Batch")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Card details" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(container.querySelector(".cz-carousel-card-inner")).not.toHaveClass("is-flipped"));
  });

  it("saves Batch only from edit and discards Cancel and header-back drafts", async () => {
    const data = installShim({ [STORE_KEY]: JSON.stringify([fashionItem({ batch: "Original" })]) });
    const user = userEvent.setup();
    render(<Credenza />);
    await user.click((await screen.findAllByRole("button", { name: /Flip/ }))[0]);
    expect(screen.queryByText("Original")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByLabelText("Batch"));
    await user.type(screen.getByLabelText("Batch"), "Saved batch");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.queryByText("Saved batch")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Batch")).toHaveValue("Saved batch");
    await user.clear(screen.getByLabelText("Batch"));
    await user.type(screen.getByLabelText("Batch"), "Cancelled");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Batch")).toHaveValue("Saved batch");
    await user.clear(screen.getByLabelText("Batch"));
    await user.type(screen.getByLabelText("Batch"), "Back discarded");
    await user.click(screen.getByRole("button", { name: "Back to card details" }));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Batch")).toHaveValue("Saved batch");
    await waitFor(() => expect(JSON.parse(data[STORE_KEY])[0].batch).toBe("Saved batch"));
  });
});

describe("Fashion morph controls and favorites", () => {
  it("focuses, clears, refocuses, and escapes the native search field", async () => {
    installShim({ [STORE_KEY]: JSON.stringify([fashionItem()]) });
    const user = userEvent.setup();
    render(<Credenza />);
    const search = await screen.findByRole("searchbox", { name: "Search your shelf" });

    await user.click(screen.getByRole("button", { name: "Focus search" }));
    expect(search).toHaveFocus();
    await user.type(search, "Palace");
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(search).toHaveValue("");
    expect(search).toHaveFocus();
    await user.type(search, "Nike");
    await user.keyboard("{Escape}");
    expect(search).toHaveValue("");
    expect(search).not.toHaveFocus();
    await user.keyboard("{Meta>}k{/Meta}");
    expect(search).toHaveFocus();
  });

  it("toggles the labeled Theme morph without changing preference values", async () => {
    const data = installShim({
      [STORE_KEY]: JSON.stringify([fashionItem()]),
      [PREFS_KEY]: JSON.stringify({ viewMode: "carousel", sortMode: "recent", theme: "light" }),
    });
    const user = userEvent.setup();
    const { container } = render(<Credenza />);
    const theme = await screen.findByRole("button", { name: "Switch to rainbow theme" });
    expect(theme).toHaveTextContent("Theme");
    await user.click(theme);
    expect(container.querySelector(".cz-app")).toHaveAttribute("data-theme", "rainbow");
    expect(theme).toHaveAccessibleName("Switch to light theme");
    await waitFor(() => expect(JSON.parse(data[PREFS_KEY]).theme).toBe("rainbow"));
    await user.click(theme);
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

    const stringFavorite = await screen.findByRole("button", { name: "Add String favorite to favorites" });
    const realFavorite = screen.getByRole("button", { name: "Remove Real favorite from favorites" });
    expect(stringFavorite).toHaveAttribute("aria-pressed", "false");
    expect(realFavorite).toHaveAttribute("aria-pressed", "true");
    await user.click(stringFavorite);
    expect(screen.getByRole("button", { name: "Remove String favorite from favorites" })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(JSON.parse(data[STORE_KEY])[0].favorite).toBe(true));

    await user.click(screen.getByRole("button", { name: "Card view" }));
    expect(await screen.findByRole("button", { name: "Remove String favorite from favorites" })).toHaveAttribute("aria-pressed", "true");
  });
});
