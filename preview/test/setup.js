import "@testing-library/jest-dom/vitest";
import * as matchers from "vitest-axe/matchers";
import { expect } from "vitest";

expect.extend(matchers);

// Referral codes are build-time env (agents.js reads import.meta.env). Vite
// loads preview/.env into the test run too, so a developer with real codes
// configured saw agent tests fail while CI passed (2026-07-26). Start every
// run from "no codes"; the tests that want one call vi.stubEnv themselves.
for (const key of Object.keys(import.meta.env)) {
  if (key.startsWith("VITE_CREDENZA_REF_")) import.meta.env[key] = "";
}

// jsdom lacks matchMedia; the app reads prefers-color-scheme and
// prefers-reduced-motion through it on mount. Default is "no query matches"
// (a desktop viewport). Tests that exercise phone-only UI (the capture
// sheet) flip the phone query with window.__setMediaMatches.
const mediaMatches = new Map();
window.__setMediaMatches = (query, matches) => {
  mediaMatches.set(query, matches);
};
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: mediaMatches.get(query) ?? false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}

if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = function ({ left = 0, top = 0 } = {}) {
    this.scrollLeft = left;
    this.scrollTop = top;
  };
}
