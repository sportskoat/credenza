import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Motion-token guard (audit M1–M4, 2026-07-27). Discrete UI durations and the
// shared ease-out curve must live on tokens. This test fails the build when a
// new bare 120/140/150/160/250ms duration (or any other unlisted literal)
// lands on a transition/animation property outside the allowlist.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../..");

const SOURCE_OF_TRUTH = path.join(REPO, "credenza.css");
const FASHION = path.join(REPO, "credenza-fashion.css");

// Literal durations still allowed on transition/animation properties after the
// M1/M2 sweep. Keep this short: new unlisted hardcodes must fail the build.
// Each key is the exact CSS time token; the comment is the justification.
const ALLOWED_LITERAL_DURATIONS = new Set([
  // Reduced-motion universal reset (credenza.css M4) + legacy scoped block.
  "0.01ms",
  // Instant kill on stagger hide (transform/filter 0s linear).
  "0s",
  // Carousel settle snap (.cz-carousel-card) — out of scale, linear.
  "90ms",
  // Focus/glow micro-pairs not on the 120/140/150/160/250 scale.
  "180ms",
  // Legacy mid-scale stragglers: .cz-modal-surface, .cz-card-buy-hover,
  // article lift, page-fade override, morph-adjacent fades.
  "200ms",
  // Detail rail wipe (cz-morph-rail-in) — shared-element companion.
  "220ms",
  // Capture bubble line/height exits (cz-line-out / height 240ms).
  "240ms",
  // Entrance/settle: cz-bubble-card, cz-detail-up (different curve; out of M1).
  "260ms",
  // Photo morph contract (P2 animation-duration), haul-head, bubble-enter.
  "280ms",
  // Coverflow-dot indicator contract (P1) — literal 300ms stays.
  "300ms",
  // Shelf enter + protected t-like-pop (P3) bounce.
  "350ms",
  // First-hint entrance (cz-hint-in).
  "380ms",
  // Large card expand (transform 400ms).
  "400ms",
  // Entrance animations ≥400ms: orbit, specimen (duration only; delay separate).
  "420ms",
  // Hero entrance.
  "500ms",
  // Ambient loops (not discrete UI).
  "0.85s",
  "1.1s",
  // Split-rail pick sheen loop (spec Motion: "the pick sheen (6s)").
  "6s",
  "1.5s",
  "2.4s",
  "2.6s",
  "5.5s",
  "18s",
  // Fit-hunt pulse loop.
  "1400ms",
  // OUR PICK cell pulse ×3 on panel open (Kyle 2026-07-30) — discrete
  // entrance, between the 500ms hero and the 1.1s ambient loops.
  "0.9s",
  // Protected view-transition morph text fade (P2).
  "60ms",
]);

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Strip var(...) including one level of nested parens (fallback args). */
function stripVars(value) {
  let out = value;
  for (let i = 0; i < 8; i++) {
    const next = out.replace(/var\((?:[^()]|\([^()]*\))*\)/g, "VAR");
    if (next === out) break;
    out = next;
  }
  return out;
}

/**
 * Collect bare <number>ms|s duration literals from transition/animation
 * properties. Skips animation-delay, transition-delay, and the delay slot
 * inside an `animation:` shorthand (the second time value).
 */
function literalDurations(cssText) {
  const text = stripComments(cssText);
  const propRe =
    /(?:^|[;{\s])((?:transition|animation)(?:-duration)?)\s*:\s*([^;}{]+)/gm;
  const timeRe = /(?<![-\w])(\d*\.?\d+)(ms|s)\b/g;
  const found = [];

  let m;
  while ((m = propRe.exec(text))) {
    const prop = m[1];
    const raw = m[2];
    if (prop === "animation-delay" || prop === "transition-delay") continue;

    const cleaned = stripVars(raw);
    const times = [...cleaned.matchAll(timeRe)].map((t) => t[0]);
    if (!times.length) continue;

    if (prop === "animation") {
      // First time = duration; further times in the shorthand are delays.
      found.push(times[0]);
    } else {
      for (const t of times) found.push(t);
    }
  }
  return found;
}

describe("Motion tokens (M1–M4)", () => {
  it("credenza.css defines ease + duration tokens in :root", () => {
    const css = stripComments(fs.readFileSync(SOURCE_OF_TRUTH, "utf8"));
    // Tokens must appear as definitions inside the file (source of truth).
    expect(css).toMatch(/--ease-out:\s*cubic-bezier\(0\.23,\s*1,\s*0\.32,\s*1\)/);
    expect(css).toMatch(/--dur-press:\s*120ms/);
    expect(css).toMatch(/--dur-micro:\s*140ms/);
    expect(css).toMatch(/--dur-open:\s*250ms/);
    expect(css).toMatch(/--dur-resize:\s*300ms/);

    for (const token of [
      "--ease-out",
      "--dur-press",
      "--dur-micro",
      "--dur-open",
      "--dur-resize",
    ]) {
      const hits = css.match(new RegExp(`${token}\\s*:`, "g")) || [];
      expect(hits, `${token} definitions in credenza.css`).toHaveLength(1);
    }
  });

  it("no unlisted bare duration on transition/animation properties", () => {
    for (const [rel, file] of [
      ["credenza.css", SOURCE_OF_TRUTH],
      ["credenza-fashion.css", FASHION],
    ]) {
      const literals = literalDurations(fs.readFileSync(file, "utf8"));
      for (const dur of literals) {
        expect(
          ALLOWED_LITERAL_DURATIONS.has(dur),
          `${rel} uses bare duration ${dur} on a transition/animation property — tokenize it or add a justified allowlist entry`
        ).toBe(true);
      }
    }
  });

  it("scale tokens 120/140/150/160/250ms never appear as bare durations", () => {
    // Hard ban on the four scale values that must always be tokenized when used
    // as a duration. (Delays and comments are excluded by the extractor.)
    const banned = new Set(["120ms", "140ms", "150ms", "160ms", "250ms", "0.15s"]);
    for (const [rel, file] of [
      ["credenza.css", SOURCE_OF_TRUTH],
      ["credenza-fashion.css", FASHION],
    ]) {
      for (const dur of literalDurations(fs.readFileSync(file, "utf8"))) {
        expect(
          banned.has(dur),
          `${rel} still has scale duration ${dur} as a bare literal`
        ).toBe(false);
      }
    }
  });
});
