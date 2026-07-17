export function createStorageBackend(host = typeof window !== "undefined" ? window : null) {
  const hasShim = () => !!(host && host.storage && typeof host.storage.set === "function");

  return {
    hasShim,
    async get(key) {
      if (hasShim()) {
        const result = await host.storage.get(key);
        return result ? result.value : null;
      }
      if (!host || !host.localStorage) return null;
      return host.localStorage.getItem(key);
    },
    async set(key, value) {
      if (hasShim()) {
        await host.storage.set(key, value);
        return;
      }
      if (!host || !host.localStorage) throw new Error("Storage is unavailable");
      host.localStorage.setItem(key, value);
    },
  };
}

export async function loadStoredItems({ backend, storeKey, legacyKey, migrateItem }) {
  let raw = null;
  let source = "empty";

  try {
    raw = await backend.get(storeKey);
    if (raw != null) source = "current";
    if (raw == null && legacyKey) {
      raw = await backend.get(legacyKey);
      if (raw != null) source = "legacy";
    }
  } catch (error) {
    return { status: "error", kind: "read", error, raw: null };
  }

  if (raw == null || raw === "") {
    return { status: "ok", items: [], source: "empty" };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return { status: "error", kind: "parse", error, raw };
  }

  if (!Array.isArray(parsed)) {
    return {
      status: "error",
      kind: "shape",
      error: new Error("Stored shelf is not an array"),
      raw,
    };
  }

  try {
    return { status: "ok", items: parsed.map(migrateItem), source };
  } catch (error) {
    return { status: "error", kind: "shape", error, raw };
  }
}

export function isQuotaError(error) {
  if (!error) return false;
  if (error.name === "QuotaExceededError") return true;
  if (error.code === 22 || error.code === 1014) return true;
  return /quota|QUOTA_BYTES/i.test(String(error.message || error));
}

export async function saveStoredItems({ backend, storeKey, items, pruneBatch = 3 }) {
  try {
    await backend.set(storeKey, JSON.stringify(items));
    return { items, prunedImages: 0 };
  } catch (error) {
    if (!isQuotaError(error)) throw error;
  }

  let current = items;
  let prunedImages = 0;

  while (true) {
    const withImages = current
      .filter((item) => item.image)
      .sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0));

    if (!withImages.length) {
      await backend.set(storeKey, JSON.stringify(current));
      return { items: current, prunedImages };
    }

    const dropIds = new Set(withImages.slice(0, pruneBatch).map((item) => item.id));
    current = current.map((item) => (dropIds.has(item.id) ? { ...item, image: null } : item));
    prunedImages += dropIds.size;

    try {
      await backend.set(storeKey, JSON.stringify(current));
      return { items: current, prunedImages };
    } catch (error) {
      if (!isQuotaError(error)) throw error;
    }
  }
}
