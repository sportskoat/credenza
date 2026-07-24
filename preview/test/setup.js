import "@testing-library/jest-dom/vitest";
import * as matchers from "vitest-axe/matchers";
import { expect } from "vitest";

expect.extend(matchers);

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
