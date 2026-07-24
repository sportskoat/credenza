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

  const attempt = async () => {
    try {
      await backend.set(storeKey, JSON.stringify(current));
      return true;
    } catch (error) {
      if (!isQuotaError(error)) throw error;
      return false;
    }
  };

  // Pass A (Part 5 quota recovery): inline QC + gallery photos go first.
  // They are the largest payloads and the least needed for browsing; cover
  // images stay until nothing else is left.
  const INLINE = (s) => typeof s === "string" && s.startsWith("data:image/");
  const hasInlineExtras = (item) =>
    (Array.isArray(item.qcPhotos) && item.qcPhotos.some(INLINE)) ||
    (Array.isArray(item.gallery) && item.gallery.some(INLINE));
  while (true) {
    const withExtras = current
      .filter(hasInlineExtras)
      .sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0));
    if (!withExtras.length) break;
    const dropIds = new Set(withExtras.slice(0, pruneBatch).map((item) => item.id));
    current = current.map((item) =>
      dropIds.has(item.id)
        ? {
            ...item,
            qcPhotos: (Array.isArray(item.qcPhotos) ? item.qcPhotos : []).filter((s) => !INLINE(s)),
            gallery: (Array.isArray(item.gallery) ? item.gallery : []).filter((s) => !INLINE(s)),
          }
        : item
    );
    prunedImages += dropIds.size;
    if (await attempt()) return { items: current, prunedImages };
  }

  // Pass B: cover thumbnails, oldest first (original behavior).
  while (true) {
    const withImages = current
      .filter((item) => typeof item.image === "string" && item.image.startsWith("data:image/"))
      .sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0));

    if (!withImages.length) {
      await backend.set(storeKey, JSON.stringify(current));
      return { items: current, prunedImages };
    }

    const dropIds = new Set(withImages.slice(0, pruneBatch).map((item) => item.id));
    current = current.map((item) => (dropIds.has(item.id) ? { ...item, image: null } : item));
    prunedImages += dropIds.size;

    if (await attempt()) return { items: current, prunedImages };
  }
}

// Every Credenza record this app can write, for the shim path. The shim has
// no delete and no key list, so known keys are blanked; the localStorage path
// below sweeps by prefix and needs no list. Keep current when a key is added:
// the items store, the legacy v1 store, the prefs, the outbound click log.
export const CREDENZA_KNOWN_KEYS = [
  "credenza-fashion-items-v1",
  "credenza-items-v1",
  "credenza-prefs-v1",
  "credenza-fashion-outbound-v1",
  "credenza-fashion-hauls-v1",
  "credenza-fashion-errors-v1",
  "credenza-fashion-activation-v1",
];

// Erase ALL Credenza data on this device (Execution-Plan Part 4): the shelf,
// the preferences (incl. body measurements), the outbound click log, and the
// service-worker caches. The old Clear only emptied the shelf and left the
// rest behind. Returns the count of removed storage keys.
export async function eraseAllCredenzaData(host = typeof window !== "undefined" ? window : null) {
  if (!host) return { removed: 0, caches: 0 };
  let removed = 0;

  if (host.localStorage) {
    const doomed = [];
    for (let i = 0; i < host.localStorage.length; i++) {
      const key = host.localStorage.key(i);
      if (key && key.startsWith("credenza")) doomed.push(key);
    }
    for (const key of doomed) host.localStorage.removeItem(key);
    removed = doomed.length;
  }

  if (host.storage && typeof host.storage.set === "function") {
    for (const key of CREDENZA_KNOWN_KEYS) {
      try {
        await host.storage.set(key, "");
        removed++;
      } catch {}
    }
  }

  let cachesCleared = 0;
  if (host.caches && typeof host.caches.keys === "function") {
    try {
      const names = await host.caches.keys();
      for (const name of names) {
        if (!/credenza/i.test(name)) continue;
        await host.caches.delete(name);
        cachesCleared++;
      }
    } catch {}
  }

  return { removed, caches: cachesCleared };
}
