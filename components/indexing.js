// ═══════════════════════════════════════════════════════════════════════════════
// indexing.js — the link indexing strip's job store (handoff: design_handoff_indexing_strip)
//
// Pure logic only: no React, no timers, no storage. credenza-fashion.jsx owns
// the driver (a 250ms tick that reads the shelf items and advances records);
// IndexingStrip.jsx owns the render. Everything both sides needs — the seven
// states, the stage labels, the header copy, the failure sentences, the
// visible-row ordering — lives here so tests pin it once.
//
// The governing constraint of the design: the shelf grid below the strip must
// not move. That is why the row order is paste order and never re-sorts while
// live, why a completed row leaves the visible set only when the job is over
// the row cap, and why failed rows sink to the bottom only after every other
// row has settled.
// ═══════════════════════════════════════════════════════════════════════════════

import { marketplaceOf } from "../agents.js";

export const INDEX_STAGES = ["queued", "fetching", "photos", "sizing", "indexed", "failed"];

// Tile letter + colour per platform. The tile is the row's only hue, flat
// colour plus a letter — never a logo. "other" is the neutral tile an
// unrecognised host gets: never reject a paste to avoid drawing a row.
export const PLATFORM_TILES = {
  yupoo: { letter: "Y", color: "var(--cz-tile-yupoo)" },
  weidian: { letter: "W", color: "var(--cz-tile-weidian)" },
  taobao: { letter: "T", color: "var(--cz-tile-taobao)" },
  tmall: { letter: "T", color: "var(--cz-tile-taobao)" },
  "1688": { letter: "1", color: "var(--cz-tile-1688)" },
  other: { letter: "·", color: "var(--cz-chip-fill)" },
};

export function platformTile(platform) {
  return PLATFORM_TILES[platform] || PLATFORM_TILES.other;
}

// Everything the row paints on the same frame as the paste comes out of the
// URL string with no request: the platform from the host, and the item or
// album ID from the path or query. The ID is the row's label until a real
// title exists — never replaced mid-flight, only on completion.
export function parseLinkMeta(url) {
  const text = String(url || "").trim();
  let parsed = null;
  try {
    parsed = new URL(text);
  } catch {
    parsed = null;
  }
  const host = parsed ? parsed.hostname.replace(/^www\./i, "") : "";
  const platform = marketplaceOf(text) || "other";
  let externalId = "";
  if (parsed) {
    const path = parsed.pathname || "";
    let m = null;
    if (platform === "yupoo") {
      m = /\/albums\/(\d+)/.exec(path);
    } else if (platform === "weidian") {
      m = /[?&]itemID=(\d+)/.exec(parsed.search) || /\/(\d+)\.html/.exec(path);
    } else if (platform === "taobao" || platform === "tmall") {
      m = /[?&]id=(\d+)/.exec(parsed.search);
    } else if (platform === "1688") {
      m = /\/offer\/(\d+)\.html/.exec(path);
    }
    if (!m) m = /(\d{5,})/.exec(path);
    externalId = m ? m[1] : "";
  }
  return {
    platform,
    host,
    externalId,
    label: externalId || host || text.slice(0, 24),
  };
}

// The client owns the sentence; the server never sends display copy.
export const FAIL_COPY = {
  private: "Couldn't read that album. It may be private.",
  dead: "That link is gone.",
  no_photos: "No photos on that page.",
  rate_limited: "Yupoo is throttling us. Try in a minute.",
  unknown: "Couldn't read that link.",
};

export function failCopy(reason) {
  return FAIL_COPY[reason] || FAIL_COPY.unknown;
}

// Stage label for the row's fixed-width status slot. The count rides in the
// same slot ("PULLING PHOTOS · 3 / 8") so a digit change cannot resize the
// row: the slot width is fixed and the numbers are tabular.
export function rowStageLabel(rec, { offline = false, slowTail = false } = {}) {
  if (!rec) return "";
  if (rec.state === "failed") return "";
  if (offline && (rec.state === "queued" || rec.state === "fetching")) {
    return "WAITING FOR NETWORK";
  }
  switch (rec.state) {
    case "queued":
      return "QUEUED";
    case "fetching":
      return "FETCHING LINK";
    case "photos": {
      const total = rec.photoTotal || 8;
      const n = Math.min(rec.revealed || 0, total);
      return (slowTail ? "STILL PULLING PHOTOS" : "PULLING PHOTOS") + " · " + n + " / " + total;
    }
    case "sizing":
      return "SIZING";
    case "indexed":
      return "INDEXED";
    default:
      return "";
  }
}

// Progress target per state, 0–1. The driver clamps against the last rendered
// value so a reordered event cannot rewind the bar — states only move forward.
export function stageProgress(rec) {
  if (!rec) return 0;
  const total = rec.photoTotal || 8;
  switch (rec.state) {
    case "queued":
      return 0.02;
    case "fetching":
      return 0.16;
    case "photos":
      return 0.16 + 0.64 * Math.min(1, (rec.revealed || 0) / total);
    case "sizing":
      return 0.8;
    case "indexed":
      return 1;
    case "failed":
      return 1;
    default:
      return 0;
  }
}

// How far the bar may go inside each state. The bar eases toward the stage
// target and keeps creeping while it waits, but it never outruns the stage
// the link is actually in — only a genuine completion reaches 1. Kyle
// 2026-08-04: "the green bar should be one consistent animation, it jumps
// from 1/3 of the way there all the way to end." The jump was the settle
// frame writing progress: 1 outright; the bar now glides everywhere.
const BAR_CEILING = { queued: 0.05, fetching: 0.28, photos: 0.78, sizing: 0.92 };

// One tick of the bar. The driver calls this every 100ms.
//  - live:    ease a fifth of the way to the stage target; when the bar has
//             caught up with reality, creep toward the ceiling so it never
//             stalls mid-stage (a slow read still moves)
//  - settled: a faster, confident sweep to full — no teleport
// The bar only moves forward: a stale event cannot rewind it.
export function advanceProgress(rec) {
  if (!rec) return 0;
  const current = rec.progress || 0;
  const settled = isSettled(rec);
  const ceiling = BAR_CEILING[rec.state];
  const target = settled ? 1 : Math.min(stageProgress(rec), ceiling == null ? 1 : ceiling);
  let next = current + (target - current) * (settled ? 0.45 : 0.22);
  // Caught up with reality: creep toward the ceiling so a slow read never
  // parks the bar mid-stage. The ceiling is the guard — the bar may fill a
  // stage, never leave it.
  if (!settled && ceiling != null && current >= target - 0.004 && current < ceiling) {
    next = Math.max(next, current + 0.006);
  }
  // The ease is asymptotic; without the snap the bar would park at 0.999.
  if (settled && next > 0.995) next = 1;
  next = Math.min(next, settled ? 1 : ceiling == null ? 1 : Math.max(ceiling, target));
  return Math.max(current, Math.round(next * 1000) / 1000);
}

export function isSettled(rec) {
  return rec.state === "indexed" || rec.state === "failed";
}

// Header line. Headline left, one detail right:
//   live:      "Indexing" / "Indexing 4 links" · "18 OF 32 PHOTOS"
//   settled:   "Indexed" / "4 links indexed" / "3 of 4 indexed" · "1 NEEDS YOU"
export function headerFor(rows) {
  const list = rows || [];
  const total = list.length;
  if (!total) return { headline: "", detail: "" };
  const failed = list.filter((r) => r.state === "failed").length;
  const indexed = list.filter((r) => r.state === "indexed").length;
  const settled = failed + indexed === total;
  let headline;
  if (settled) {
    if (failed) headline = indexed + " of " + total + " indexed";
    else headline = total === 1 ? "Indexed" : total + " links indexed";
  } else {
    headline = total === 1 ? "Indexing" : "Indexing " + total + " links";
  }
  let detail = "";
  if (failed) {
    detail = failed + " NEEDS YOU";
  } else {
    const photos = list.reduce((sum, r) => sum + Math.min(r.revealed || 0, r.photoTotal || 0), 0);
    const totalPhotos = list.reduce((sum, r) => sum + (r.photoTotal || 0), 0);
    if (totalPhotos > 0) detail = photos + " OF " + totalPhotos + " PHOTOS";
  }
  return { headline, detail };
}

// Visible-row ordering (the stability rules in code):
//  - paste order while anything is live; never re-sort mid-job
//  - over the cap, completed rows leave the visible set first so the next
//    queued link takes the slot
//  - failed rows sink to the bottom only once every other row has settled
export function visibleRows(rows, cap = 4) {
  const list = rows || [];
  if (list.length <= cap) {
    const allSettled = list.every(isSettled);
    if (!allSettled) return list.slice();
    const live = list.filter((r) => r.state !== "failed");
    const failed = list.filter((r) => r.state === "failed");
    return [...live, ...failed];
  }
  const unsettled = list.filter((r) => !isSettled(r));
  const settled = list.filter(isSettled);
  if (unsettled.length) {
    const filled = [...unsettled];
    for (const rec of settled) {
      if (filled.length >= cap) break;
      filled.push(rec);
    }
    // Keep paste order across the merged set.
    const chosen = new Set(filled.slice(0, cap).map((r) => r.id));
    return list.filter((r) => chosen.has(r.id)).slice(0, cap);
  }
  const ok = settled.filter((r) => r.state === "indexed");
  const failed = settled.filter((r) => r.state === "failed");
  return [...ok, ...failed].slice(-cap);
}

// Did the enrichment gain anything a person can see? A "ready" card that
// gained no photo, no title and no price is the failed state; a card that
// gained some of it is "thin", which the spec renders exactly like indexed —
// the card carries the gap, not the strip.
//
// bornTitle is the title the card was stashed with. The stash names a bare
// link from its URL ("Weidian item 1050…"), so a non-URL title alone proves
// nothing: a dead read keeps the placeholder and must still count as a
// failure. Only a title the page itself supplied — different from the one
// the card was born with — is a gain.
export function gainedNothing(item, bornTitle) {
  if (!item) return true;
  const hasPhoto = !!(item.image || (item.gallery || []).length);
  const hasPrice = item.price != null;
  const titled = !!(item.title && !/^https?:\/\//.test(item.title));
  const hasTitle = titled && item.title !== (bornTitle || "");
  return !hasPhoto && !hasPrice && !hasTitle;
}

// A dead read of a Yupoo album is the private case; anything else is unknown.
export function failReasonFor(item) {
  const url = (item && (item.url || (item.links && item.links.albumUrl))) || "";
  return marketplaceOf(url) === "yupoo" ? "private" : "unknown";
}
