// The artifact/extension environments provide a window.storage shim
// (see extension/src/storage-shim.js); the web app falls back to localStorage.
interface Window {
  storage?: {
    get(key: string): Promise<{ value: string } | null>;
    set(key: string, value: string): Promise<void>;
  };
}
