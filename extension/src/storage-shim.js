// Backs the app's window.storage contract with chrome.storage.local, so the
// shelf lives in extension storage (survives cache clears, syncs to nothing).
// Same {get -> {value} | null, set} shape the artifact environment provides.
if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
  window.storage = {
    get: async (key) => {
      const o = await chrome.storage.local.get(key);
      return o[key] == null ? null : { value: o[key] };
    },
    set: async (key, value) => {
      await chrome.storage.local.set({ [key]: value });
    },
  };
}
