import { describe, it, expect, vi } from "vitest";
import {
  createStorageBackend,
  loadStoredItems,
  saveStoredItems,
  isQuotaError,
} from "../../credenza-storage.js";

const identity = (x) => x;

function memoryBackend(initial = {}) {
  const data = { ...initial };
  return {
    data,
    backend: {
      async get(key) {
        return key in data ? data[key] : null;
      },
      async set(key, value) {
        data[key] = value;
      },
    },
  };
}

describe("loadStoredItems", () => {
  it("returns empty ok state when nothing is stored", async () => {
    const { backend } = memoryBackend();
    const result = await loadStoredItems({ backend, storeKey: "k", migrateItem: identity });
    expect(result).toEqual({ status: "ok", items: [], source: "empty" });
  });

  it("loads and migrates current data", async () => {
    const { backend } = memoryBackend({ k: JSON.stringify([{ id: "a" }]) });
    const migrate = vi.fn((x) => ({ ...x, migrated: true }));
    const result = await loadStoredItems({ backend, storeKey: "k", migrateItem: migrate });
    expect(result.status).toBe("ok");
    expect(result.source).toBe("current");
    expect(result.items).toEqual([{ id: "a", migrated: true }]);
  });

  it("falls back to the legacy key", async () => {
    const { backend } = memoryBackend({ old: JSON.stringify([{ id: "v2" }]) });
    const result = await loadStoredItems({
      backend,
      storeKey: "k",
      legacyKey: "old",
      migrateItem: identity,
    });
    expect(result.source).toBe("legacy");
    expect(result.items).toHaveLength(1);
  });

  it("reports read failures distinctly and preserves nothing as items", async () => {
    const backend = {
      get: async () => {
        throw new Error("io");
      },
      set: vi.fn(),
    };
    const result = await loadStoredItems({ backend, storeKey: "k", migrateItem: identity });
    expect(result.status).toBe("error");
    expect(result.kind).toBe("read");
    expect(result.items).toBeUndefined();
    expect(backend.set).not.toHaveBeenCalled();
  });

  it("reports malformed JSON with the raw payload for recovery", async () => {
    const { backend } = memoryBackend({ k: "{not json" });
    const result = await loadStoredItems({ backend, storeKey: "k", migrateItem: identity });
    expect(result.status).toBe("error");
    expect(result.kind).toBe("parse");
    expect(result.raw).toBe("{not json");
  });

  it("reports a non-array shelf as a shape error", async () => {
    const { backend } = memoryBackend({ k: JSON.stringify({ nope: true }) });
    const result = await loadStoredItems({ backend, storeKey: "k", migrateItem: identity });
    expect(result.status).toBe("error");
    expect(result.kind).toBe("shape");
  });

  it("reports a throwing migration as a shape error, never dropping raw data", async () => {
    const { backend } = memoryBackend({ k: JSON.stringify([{ id: "a" }]) });
    const result = await loadStoredItems({
      backend,
      storeKey: "k",
      migrateItem: () => {
        throw new Error("bad item");
      },
    });
    expect(result.status).toBe("error");
    expect(result.kind).toBe("shape");
    expect(result.raw).toBe(JSON.stringify([{ id: "a" }]));
  });
});

describe("saveStoredItems quota recovery", () => {
  function quotaError() {
    const err = new Error("quota");
    err.name = "QuotaExceededError";
    return err;
  }

  it("saves normally when there is room", async () => {
    const { backend, data } = memoryBackend();
    const items = [{ id: "a" }];
    const result = await saveStoredItems({ backend, storeKey: "k", items });
    expect(result.prunedImages).toBe(0);
    expect(JSON.parse(data.k)).toEqual(items);
  });

  it("prunes only thumbnails — never items, notes, or links — on quota errors", async () => {
    let failures = 1;
    const { backend, data } = memoryBackend();
    const realSet = backend.set;
    backend.set = async (key, value) => {
      if (failures > 0) {
        failures -= 1;
        throw quotaError();
      }
      return realSet(key, value);
    };
    const items = [
      { id: "old", image: "data:x", note: "keep", links: [{ url: "u", role: "buy" }], updatedAt: 1 },
      { id: "new", image: "data:y", updatedAt: 2 },
      { id: "plain", note: "also keep" },
    ];
    const result = await saveStoredItems({ backend, storeKey: "k", items, pruneBatch: 3 });
    expect(result.prunedImages).toBeGreaterThan(0);
    const saved = JSON.parse(data.k);
    expect(saved).toHaveLength(3);
    expect(saved.find((i) => i.id === "old").note).toBe("keep");
    expect(saved.find((i) => i.id === "old").links).toEqual([{ url: "u", role: "buy" }]);
    expect(saved.find((i) => i.id === "old").image).toBeNull();
  });

  it("rethrows non-quota save errors untouched", async () => {
    const backend = {
      get: async () => null,
      set: async () => {
        throw new Error("disk on fire");
      },
    };
    await expect(
      saveStoredItems({ backend, storeKey: "k", items: [{ id: "a" }] })
    ).rejects.toThrow("disk on fire");
  });
});

describe("isQuotaError", () => {
  it("recognizes the browser quota shapes", () => {
    expect(isQuotaError({ name: "QuotaExceededError" })).toBe(true);
    expect(isQuotaError({ code: 22 })).toBe(true);
    expect(isQuotaError(new Error("QUOTA_BYTES exceeded"))).toBe(true);
    expect(isQuotaError(new Error("nope"))).toBe(false);
    expect(isQuotaError(null)).toBe(false);
  });
});

describe("createStorageBackend", () => {
  it("prefers the window.storage shim when present", async () => {
    const host = {
      storage: {
        get: vi.fn(async () => ({ value: "shimmed" })),
        set: vi.fn(async () => {}),
      },
      localStorage: { getItem: vi.fn(), setItem: vi.fn() },
    };
    const backend = createStorageBackend(host);
    expect(await backend.get("k")).toBe("shimmed");
    await backend.set("k", "v");
    expect(host.storage.set).toHaveBeenCalledWith("k", "v");
    expect(host.localStorage.getItem).not.toHaveBeenCalled();
  });

  it("falls back to localStorage without the shim", async () => {
    const store = {};
    const host = {
      localStorage: {
        getItem: (k) => (k in store ? store[k] : null),
        setItem: (k, v) => {
          store[k] = v;
        },
      },
    };
    const backend = createStorageBackend(host);
    await backend.set("k", "v");
    expect(await backend.get("k")).toBe("v");
  });

  it("surfaces set failures when no storage exists at all", async () => {
    const backend = createStorageBackend({});
    await expect(backend.set("k", "v")).rejects.toThrow();
  });
});
