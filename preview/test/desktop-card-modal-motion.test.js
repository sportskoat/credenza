/**
 * Kyle 2026-08-02 item 7 — desktop card open/close is transitions.dev t-modal.
 * Pins the duration/scale/bezier values and reduced-motion guard.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const FASHION_CSS = readFileSync(join(root, "credenza-fashion.css"), "utf8");
const BASE_CSS = readFileSync(join(root, "credenza.css"), "utf8");

describe("desktop card modal motion (t-modal)", () => {
  it("pins open/close duration, scale, and ease on :root", () => {
    const start = FASHION_CSS.indexOf("/* ─── Modal open / close");
    expect(start).toBeGreaterThan(-1);
    const block = FASHION_CSS.slice(start, start + 900);
    expect(block).toMatch(/--modal-open-dur:\s*250ms/);
    expect(block).toMatch(/--modal-close-dur:\s*150ms/);
    expect(block).toMatch(/--modal-scale:\s*0\.96/);
    expect(block).toMatch(/--modal-scale-close:\s*0\.96/);
    expect(block).toMatch(
      /--modal-ease:\s*cubic-bezier\(\s*0\.22\s*,\s*1\s*,\s*0\.36\s*,\s*1\s*\)/
    );
  });

  it("scales the dpanel surface on is-open / is-closing", () => {
    expect(FASHION_CSS).toMatch(
      /\.cz-dpanel-scrim\.t-modal\.is-open\s+\.cz-dpanel\s*\{[^}]*transform:\s*scale\(1\)/s
    );
    expect(FASHION_CSS).toMatch(
      /\.cz-dpanel-scrim\.t-modal\.is-closing\s+\.cz-dpanel\s*\{[^}]*scale\(var\(--modal-scale-close\)\)/s
    );
    expect(FASHION_CSS).toMatch(
      /\.cz-dpanel-scrim\.t-modal\s+\.cz-dpanel\s*\{[^}]*scale\(var\(--modal-scale\)\)/s
    );
  });

  it("fades the painted scrim on the same clock as the card", () => {
    expect(FASHION_CSS).toMatch(
      /\.cz-dpanel-scrim\.t-modal\.is-open\s*\{[^}]*opacity:\s*1/s
    );
    expect(FASHION_CSS).toMatch(
      /\.cz-dpanel-scrim\.t-modal\.is-closing\s*\{[^}]*opacity:\s*0/s
    );
  });

  it("zeros transitions under prefers-reduced-motion", () => {
    const start = FASHION_CSS.indexOf(
      "@media (prefers-reduced-motion: reduce) {\n  .t-modal { transition: none !important; }"
    );
    expect(start).toBeGreaterThan(-1);
    const block = FASHION_CSS.slice(start, start + 350);
    expect(block).toMatch(/\.cz-dpanel-scrim\.t-modal/);
    expect(block).toMatch(/transition:\s*none\s*!important/);
  });

  it("retires the old flat 200ms scale(0.98) surface entrance", () => {
    // Tombstone comment must remain; the animated rule must not.
    expect(BASE_CSS).toMatch(/Tombstone 2026-08-02.*item 7/s);
    expect(BASE_CSS).not.toMatch(
      /\.cz-modal-surface\s*\{[^}]*transition:\s*opacity 200ms/s
    );
    expect(BASE_CSS).not.toMatch(
      /\.cz-modal:not\(\[open\]\)\s+\.cz-modal-surface\s*\{[^}]*scale\(0\.98\)/s
    );
  });
});
