import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
    const faces = screen.getAllByRole("button", { name: "Flip card" });
    await user.click(faces[1]);
    expect([...container.querySelectorAll(".cz-carousel-card-inner")].every((node) => !node.classList.contains("is-flipped"))).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 260));
    await user.click(faces[1]);
    await waitFor(() => expect(container.querySelectorAll(".cz-carousel-card-inner")[1]).toHaveClass("is-flipped"));
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
    await user.click(await screen.findByRole("button", { name: "Flip card" }));
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
    await user.click(await screen.findByRole("button", { name: "Flip card" }));
    await user.click(screen.getByRole("button", { name: "Photos" }));
    expect(await screen.findByLabelText("Album photos")).toBeInTheDocument();
    const thumbnails = screen.getAllByRole("button", { name: /Preview album photo/i });
    expect(thumbnails).toHaveLength(3);
    await user.click(thumbnails[1]);
    expect(screen.getByRole("dialog", { name: "Album photo preview" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use as cover" })).toBeInTheDocument();
    expect(container.querySelector("img.cz-carousel-image")?.getAttribute("src")).toBe(PHOTO_1);
    await user.click(screen.getByRole("button", { name: "Use as cover" }));
    await waitFor(() =>
      expect(container.querySelector("img.cz-carousel-image")?.getAttribute("src")).toBe(PHOTO_2)
    );
    expect(screen.queryByRole("dialog", { name: "Album photo preview" })).not.toBeInTheDocument();
  });
});
