import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildItemShareModel,
  renderItemSharePng,
  shareItemCard,
} from "../../credenza-item-share.js";

const PNG = new Blob(["png"], { type: "image/png" });

function canvasHarness({ fail = false } = {}) {
  const calls = [];
  const context = {
    beginPath: vi.fn(),
    clip: vi.fn(),
    drawImage: vi.fn((...args) => calls.push(["drawImage", ...args])),
    fill: vi.fn(),
    fillRect: vi.fn((...args) => calls.push(["fillRect", ...args])),
    fillText: vi.fn((...args) => calls.push(["fillText", ...args])),
    lineTo: vi.fn(),
    measureText: vi.fn((text) => ({ width: String(text).length * 18 })),
    moveTo: vi.fn(),
    restore: vi.fn(),
    roundRect: vi.fn(),
    save: vi.fn(),
    scale: vi.fn(),
    stroke: vi.fn(),
    strokeRect: vi.fn(),
    translate: vi.fn(),
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => context),
    toBlob: vi.fn((callback) => callback(fail ? null : PNG)),
  };
  return { calls, canvas, context, createCanvas: vi.fn(() => canvas) };
}

function downloadHarness() {
  const created = [];
  const revoked = [];
  const anchors = [];
  const urlApi = {
    createObjectURL: vi.fn((blob) => {
      created.push(blob);
      return "blob:share-" + created.length;
    }),
    revokeObjectURL: vi.fn((url) => revoked.push(url)),
  };
  const documentImpl = {
    body: { appendChild: vi.fn() },
    createElement: vi.fn((tag) => {
      expect(tag).toBe("a");
      const anchor = {
        click: vi.fn(),
        download: "",
        href: "",
        rel: "",
        remove: vi.fn(),
        style: {},
      };
      anchors.push(anchor);
      return anchor;
    }),
  };
  return { anchors, created, documentImpl, revoked, urlApi };
}

function shareDependencies(overrides = {}) {
  const canvas = canvasHarness();
  const download = downloadHarness();
  return {
    ...canvas,
    ...download,
    deps: {
      createCanvas: canvas.createCanvas,
      document: download.documentImpl,
      urlApi: download.urlApi,
      scheduleCleanup: (cleanup) => cleanup(),
      ...overrides,
    },
  };
}

describe("buildItemShareModel", () => {
  it("whitelists share fields and excludes private item details", () => {
    const model = buildItemShareModel(
      {
        id: "secret-id",
        title: "Heavyweight Hoodie",
        seller: "Example Studio",
        savedPrice: "$23.50",
        image: "data:image/png;base64,cover",
        size: "L",
        colorway: "Washed black",
        project: "Winter haul",
        batch: "B197",
        note: "private note",
        qcNote: "stitching issue",
        qcPhotos: ["data:image/png;base64,qc"],
        chartImages: ["data:image/png;base64,chart"],
      },
      { footer: "Credenza" }
    );

    expect(model).toEqual({
      masthead: "CREDENZA",
      image: "data:image/png;base64,cover",
      title: "Heavyweight Hoodie",
      seller: "Example Studio",
      savedPrice: "$23.50",
      facts: [
        { label: "Size", value: "L" },
        { label: "Colorway", value: "Washed black" },
        { label: "Haul", value: "Winter haul" },
      ],
      footer: "Credenza",
    });
    expect(JSON.stringify(model)).not.toMatch(/secret-id|B197|private|stitching|qc|chart/i);
  });

  it("uses fact priority and limits the model to four facts", () => {
    const model = buildItemShareModel({
      size: "XL",
      colorway: "Navy",
      project: "Spring",
      weightGrams: 1250,
      findStatus: "gl",
    });

    expect(model.facts).toEqual([
      { label: "Size", value: "XL" },
      { label: "Colorway", value: "Navy" },
      { label: "Haul", value: "Spring" },
      { label: "Weight", value: "1.3 kg" },
    ]);
  });

  it("prefers item.image, then the first usable gallery image", () => {
    expect(buildItemShareModel({ image: "data:image/png,a", gallery: ["data:image/png,b"] }).image).toBe(
      "data:image/png,a"
    );
    expect(buildItemShareModel({ gallery: ["", "data:image/png,b"] }).image).toBe(
      "data:image/png,b"
    );
  });
});

describe("renderItemSharePng", () => {
  it("always creates a 1200 by 1500 canvas and returns a PNG", async () => {
    const harness = canvasHarness();
    const result = await renderItemSharePng(
      { title: "Jacket", savedPrice: "$40" },
      { createCanvas: harness.createCanvas }
    );

    expect(harness.createCanvas).toHaveBeenCalledWith(1200, 1500, expect.anything());
    expect(harness.canvas.width).toBe(1200);
    expect(harness.canvas.height).toBe(1500);
    expect(result).toBe(PNG);
  });

  it("draws a neutral placeholder and never loads an unresolved remote cover", async () => {
    const harness = canvasHarness();
    const loadImage = vi.fn();
    await renderItemSharePng(
      { title: "Jacket", image: "https://remote.example/cover.jpg", savedPrice: "$40" },
      { createCanvas: harness.createCanvas, loadImage }
    );

    expect(loadImage).not.toHaveBeenCalled();
    expect(harness.context.fillText).toHaveBeenCalledWith("NO COVER IMAGE", 600, 513);
    expect(harness.context.drawImage).not.toHaveBeenCalled();
  });

  it("loads a remote cover only after an injected resolver makes it safe", async () => {
    const harness = canvasHarness();
    const image = { naturalHeight: 600, naturalWidth: 800 };
    const resolveImage = vi.fn(() => "data:image/png;base64,safe");
    const loadImage = vi.fn(() => image);
    await renderItemSharePng(
      { title: "Jacket", image: "https://remote.example/cover.jpg", savedPrice: "$40" },
      { createCanvas: harness.createCanvas, loadImage, resolveImage }
    );

    expect(resolveImage).toHaveBeenCalledWith("https://remote.example/cover.jpg");
    expect(loadImage).toHaveBeenCalledWith("data:image/png;base64,safe", expect.any(Object));
    expect(harness.context.drawImage).toHaveBeenCalled();
  });
});

describe("shareItemCard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("uses native sharing with a PNG File when supported", async () => {
    const canShare = vi.fn(() => true);
    const share = vi.fn(() => Promise.resolve());
    const createFile = vi.fn((blob, name, type) => ({ blob, name, type }));
    const harness = shareDependencies({ createFile, shareApi: { canShare, share } });

    const outcome = await shareItemCard(
      { title: "Heavyweight Hoodie", seller: "Studio", savedPrice: "$23.50" },
      harness.deps
    );

    expect(outcome).toBe("shared");
    expect(createFile).toHaveBeenCalledWith(PNG, "credenza-heavyweight-hoodie.png", "image/png");
    expect(canShare).toHaveBeenCalledWith({
      files: [{ blob: PNG, name: "credenza-heavyweight-hoodie.png", type: "image/png" }],
    });
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({
        files: [expect.objectContaining({ blob: PNG, type: "image/png" })],
        title: "Heavyweight Hoodie",
      })
    );
    expect(harness.created).toHaveLength(0);
  });

  it("downloads the generated PNG when native sharing is unsupported", async () => {
    const harness = shareDependencies({ shareApi: {} });
    const outcome = await shareItemCard(
      { title: "Jacket", savedPrice: "$40" },
      harness.deps
    );

    expect(outcome).toBe("downloaded");
    expect(harness.created).toEqual([PNG]);
    expect(harness.anchors[0].download).toBe("credenza-jacket.png");
    expect(harness.anchors[0].click).toHaveBeenCalledOnce();
  });

  it("downloads the same PNG when native sharing fails", async () => {
    const share = vi.fn(() => Promise.reject(new Error("share unavailable")));
    const harness = shareDependencies({
      createFile: (blob, name, type) => ({ blob, name, type }),
      shareApi: { canShare: () => true, share },
    });

    const outcome = await shareItemCard({ title: "Jacket", savedPrice: "$40" }, harness.deps);

    expect(outcome).toBe("downloaded");
    expect(harness.created[0]).toBe(PNG);
  });

  it("treats an AbortError as cancelled without downloading", async () => {
    const abort = new Error("cancelled");
    abort.name = "AbortError";
    const harness = shareDependencies({
      createFile: (blob, name, type) => ({ blob, name, type }),
      shareApi: { canShare: () => true, share: () => Promise.reject(abort) },
    });

    const outcome = await shareItemCard({ title: "Jacket", savedPrice: "$40" }, harness.deps);

    expect(outcome).toBe("cancelled");
    expect(harness.created).toHaveLength(0);
  });

  it("sanitizes deterministic filenames and revokes every download URL", async () => {
    const harness = shareDependencies({ shareApi: {} });
    const outcome = await shareItemCard(
      { title: "  Café / Hoodie !!!  ", savedPrice: "$40" },
      harness.deps
    );

    expect(outcome).toBe("downloaded");
    expect(harness.anchors[0].download).toBe("credenza-cafe-hoodie.png");
    expect(harness.revoked).toEqual(["blob:share-1"]);
    expect(harness.urlApi.revokeObjectURL).toHaveBeenCalledOnce();
  });

  it("revokes a resolver-created Blob URL after loading the cover", async () => {
    const harness = shareDependencies({
      loadImage: () => ({ naturalHeight: 600, naturalWidth: 800 }),
      resolveImage: () => new Blob(["cover"], { type: "image/png" }),
      shareApi: {},
    });
    const outcome = await shareItemCard(
      {
        title: "Jacket",
        image: "https://remote.example/cover.jpg",
        savedPrice: "$40",
      },
      harness.deps
    );

    expect(outcome).toBe("downloaded");
    expect(harness.urlApi.createObjectURL).toHaveBeenCalledTimes(2);
    expect(harness.urlApi.revokeObjectURL).toHaveBeenCalledTimes(2);
    expect(harness.revoked).toEqual(["blob:share-1", "blob:share-2"]);
  });

  it("returns failed when PNG generation fails", async () => {
    const harness = canvasHarness({ fail: true });
    const download = vi.fn();
    const outcome = await shareItemCard(
      { title: "Jacket", savedPrice: "$40" },
      { createCanvas: harness.createCanvas, download }
    );

    expect(outcome).toBe("failed");
    expect(download).not.toHaveBeenCalled();
  });
});
