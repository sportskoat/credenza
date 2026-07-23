// ═══════════════════════════════════════════════════════════════════════════════
// reddit-haul.js — Reddit haul paste → structured cards (Monetization Tier A1)
//
// FashionReps hauls arrive as a wall of text: OP stats block, markdown links,
// tables with W2C columns, bare URLs, and review chatter between items. One paste
// here → one entry per item + poster stats, with zero network calls (enrichment
// follows async via the normal pipeline).
//
// Conservative by design: returns null for pastes that don't look haul-shaped so
// the generic parseImport path keeps its behavior.
//
// v1 landing spot for poster stats: a `posterStats` object on each imported item
// (they're a batch — the haul paste IS the haul). When the A3 pipeline board adds
// real haul objects, hoist stats there.
// ═══════════════════════════════════════════════════════════════════════════════

import { marketplaceOf } from "./agents.js";

const BUY_MARKETPLACES = ["weidian", "taobao", "tmall", "1688"];

const URL_RE = /https?:\/\/[^\s<>"')\]]+/g;
const REDDIT_POST_RE = /https?:\/\/(?:www\.)?reddit\.com\/r\/[\w-]+\/(?:comments|s)\/[^\s<>"')\]]+/;
const REDDIT_USER_RE = /\bu\/([\w-]{3,20})\b/;

// Wider net than the AGENTS registry in agents.js (people mention agents we
// don't have URL templates for) — the registry stays canonical for Buy links.
const KNOWN_AGENTS = [
  "superbuy", "sugargoo", "cssbuy", "kakobuy", "hoobuy", "cnfans",
  "mulebuy", "acbuy", "oopbuy", "basetao", "wegobuy", "pandabuy", "allchinabuy", "joyabuy",
];

// Category guesses emit the app's CATEGORIES keys (credenza-fashion.jsx) so
// item.category has one vocabulary end-to-end; order mirrors
// guessFashionCategory's precedence (hoodie → outerwear, crewneck → shirt).
const CATEGORY_KEYWORDS = [
  ["shoes", /\b(shoes?|sneakers?|jordans?|aj\s?\d{1,2}|dunks?|yeezys?|af1|air force|air max|new balance|nb\s?\d{3}|vans|old\s?skool|sk8|asics|gel-\w+|fresh foam|boots?|slides?|runners?|trainers?)\b/i],
  ["outerwear", /\b(hoodie|jacket|coat|puffer|windbreaker|parka|bomber|denim jacket|varsity)\b/i],
  ["shorts", /\bshorts?\b/i],
  ["pants", /\b(pants|jeans|trousers|cargos?|sweatpants|joggers?|track pants)\b/i],
  ["socks", /\bsocks?\b/i],
  ["hat", /\b(hat|cap|beanie)\b/i],
  ["bag", /\b(bag|backpack|tote|duffel|crossbody|shoulder bag)\b/i],
  ["accessory", /\b(belt|sunglasses|glasses|watch|ring|necklace|bracelet|wallet|scarf|gloves?)\b/i],
  ["shirt", /\b(tee|t-shirt|tshirt|shirt|polo|tank|henley|crewneck|sweatshirt|sweater|knit|cardigan|vest)\b/i],
];

function guessCategory(label) {
  if (!label) return "";
  for (const [category, re] of CATEGORY_KEYWORDS) {
    if (re.test(label)) return category;
  }
  return "";
}

// ————— Poster stats ————————————————————————————————————————————————————————————

function parseStats(text) {
  const stats = {};
  let m;
  if ((m = /(\d{3})\s?cm\b/i.exec(text))) {
    stats.heightCm = parseInt(m[1], 10);
  } else if ((m = /\b(\d)'(\d{1,2})\b/.exec(text))) {
    stats.heightCm = Math.round((parseInt(m[1], 10) * 12 + parseInt(m[2], 10)) * 2.54);
  }
  if ((m = /(\d{2,3}(?:\.\d+)?)\s?kg\b/i.exec(text))) {
    stats.weightKg = parseFloat(m[1]);
  } else if ((m = /(\d{2,3})\s?(?:lbs?|pounds?)\b/i.exec(text))) {
    stats.weightKg = Math.round(parseInt(m[1], 10) * 0.4536 * 10) / 10;
  }
  if ((m = /\b(?:usual\s+|tshirt\s+|shirt\s+)?size[:\s-]*(x{0,2}[sml]|x{0,2}l|\d{2})\b/i.exec(text))) {
    stats.usualSize = m[1].toUpperCase();
  }
  if ((m = /\bagent[:\s-]*([a-z]+)/i.exec(text))) {
    const name = m[1].toLowerCase();
    if (KNOWN_AGENTS.includes(name)) stats.agent = name;
  }
  if ((m = /(?:budget|total|spent|haul cost)[:\s]*([¥￥$€])?\s?([\d,.]+)/i.exec(text))) {
    const amount = parseFloat(m[2].replace(/,/g, ""));
    if (!Number.isNaN(amount)) {
      stats.budget = amount;
      stats.budgetCurrency = m[1] === "$" ? "USD" : m[1] === "€" ? "EUR" : "CNY";
    }
  }
  return stats;
}

// A line is "stats chatter" if it carries a stat marker and no URL — these must
// not become review snippets on the previous item.
function isStatsLine(line) {
  return (
    /\d{3}\s?cm\b/i.test(line) ||
    /\d'(\d{1,2})/.test(line) ||
    /\d{2,3}\s?(kg|lbs?|pounds?)\b/i.test(line) ||
    /\b(size|agent|budget|total|spent|stats?|height|weight|build)\s*[:：]/i.test(line) ||
    // "usually wear size M" has no colon but is stats, while "size up once" is a
    // fit note — the "usual" anchor is what tells them apart.
    /\busual(ly)?\s+(wear\s+)?size\b/i.test(line)
  );
}

// ————— Line-level item extraction —————————————————————————————————————————————

function cleanLabel(raw) {
  return (raw || "")
    .replace(/\*\*|__/g, "")
    .replace(/^[|\s\-*•>”"`]+|[|\s]+$/g, "")
    .replace(/\b(w2c|w2b|find|gp'?d|qc|in\s?hand|review|link)\b\s*[:：-]?\s*/gi, "")
    .replace(/[|–—]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Horizontal-rule lines (OPs separate items with "⸻", "---", "***") — they
// never carry content but DO mark an item-block boundary. Single "⸻" counts.
const SEPARATOR_RE = /^[\s\-–—*_=⸻―]+$/u;

// "(Size M)", "(EU42.5, TOP Batch)", "(US 9)" — a size/batch parenthetical is
// the strongest signal that a text line is an item header, not review chatter.
const HEADER_SIZE_RE = /\((?:size|eu|us|uk|cm)[\s\d][^)]{0,24}\)/i;

// FashionReps' dominant in-hand-review format puts the item block ABOVE the
// W2C link: "Name (Size M) - review text…\nW2C: https://…". When a URL line
// has no inline label, the buffered text above it is that item's header —
// attributing it to the PREVIOUS item shifts every card's note one item down
// (Kyle, 2026-07-22). headerSplit decides whether ONE buffered line is a
// header and where the name ends:
//   dash + (size|boundary) → "Name - review" at a block start or with a size
//   size + boundary        → "(Size M)" name line at a block start
//   short bare line at a boundary (no sentence punctuation/comma/haul chatter)
//                          → a product name on its own line
// Post titles ("5.5kg Haul Review — first time posting!") are rejected via the
// haul/review/weight lead-in guard so they never become an item's label.
// Anything else stays review chatter for the previous item.
// Returns { label, note } or null.
function headerSplit(line, { atBoundary }) {
  const dash = /^(.{3,90}?)\s+[-–—]\s+(.+)$/.exec(line);
  const hasSize = HEADER_SIZE_RE.test(line);
  const postChatter = (s) => /\b(haul|review)\b/i.test(s) || /^\d+(?:\.\d+)?\s?kg\b/i.test(s);
  if (dash && (hasSize || atBoundary) && !postChatter(dash[1])) {
    return { label: cleanLabel(dash[1]), note: dash[2].trim() };
  }
  if (hasSize && atBoundary && !postChatter(line)) return { label: cleanLabel(line), note: "" };
  if (
    atBoundary &&
    line.length <= 60 &&
    !/[.!?…,]$/.test(line) &&
    !/,/.test(line) &&
    !postChatter(line)
  ) {
    return { label: cleanLabel(line), note: "" };
  }
  return null;
}

function pickPrimaryUrl(urls) {
  let best = null;
  let bestRank = -1;
  for (const u of urls) {
    const mp = marketplaceOf(u);
    let rank = 0;
    if (mp && BUY_MARKETPLACES.includes(mp)) rank = 3;
    else if (mp === "yupoo") rank = 2;
    else if (u) rank = 1;
    if (rank > bestRank) {
      bestRank = rank;
      best = u;
    }
  }
  return best;
}

function extractItems(text) {
  const items = [];
  // Split on SINGLE newlines: blank lines are block boundaries, and the
  // header-vs-review decision below depends on seeing them.
  const lines = text.split("\n");
  let lastItem = null;
  // URL-free text lines since the last item. They are EITHER review chatter
  // for the previous item OR the next item's header — decided when the next
  // URL line arrives (see headerSplit).
  let pending = [];
  let pendingBoundary = true; // did the pending block start after a blank/separator?
  let boundary = true; // start-of-input counts as a boundary

  const flushPendingToNote = () => {
    if (lastItem && pending.length) {
      const snippet = pending.join(" ");
      lastItem.note = lastItem.note ? lastItem.note + " " + snippet : snippet;
    }
    pending = [];
  };

  for (const lineRaw of lines) {
    const line = lineRaw.trim();
    if (!line) {
      boundary = true;
      continue;
    }

    // Markdown links: capture label↔url pairing before generic URL matching.
    const mdLinks = [];
    const withoutMd = line.replace(/\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, (_all, label, url) => {
      mdLinks.push({ label: label.trim(), url });
      return " " + url + " "; // keep URL visible to the generic pass
    });

    const urls = withoutMd.match(URL_RE) || [];
    const shoppable = urls.filter((u) => marketplaceOf(u));

    if (shoppable.length === 0) {
      // Reddit post links aren't items; everything else URL-free is either stats
      // chatter or buffered text (header-or-note, decided later).
      if (urls.length > 0) continue;
      if (SEPARATOR_RE.test(line)) {
        boundary = true;
        continue;
      }
      const stripped = line.replace(/^[\s\-*•>”"`]*(?:\d+[.)])?\s*/, "").trim();
      if (!stripped || stripped.length < 4) continue;
      if (isStatsLine(stripped)) continue;
      if (/^(stats?|build|haul|review|w2c|qc|finds?)\b\s*[:：-]?\s*$/i.test(stripped)) continue;
      if (stripped.length <= 300) {
        if (pending.length === 0) pendingBoundary = boundary;
        pending.push(stripped);
      }
      boundary = false;
      continue;
    }

    // Table rows: label is the first non-URL, non-price cell.
    let label = "";
    if (line.startsWith("|")) {
      const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
      for (const cell of cells) {
        if (/https?:\/\//.test(cell)) continue;
        if (/^[¥￥$€]?[\d.,]+$/.test(cell) || /^-+$/.test(cell)) continue;
        label = cell;
        break;
      }
    }

    const primary = pickPrimaryUrl(urls);
    if (!label) {
      // Only trust a markdown label when it annotates the PRIMARY url — the
      // first markdown link on the line is often the Yupoo album, not the buy.
      const md = mdLinks.find((l) => l.url === primary);
      if (md && md.label) label = cleanLabel(md.label);
    }
    if (!label) {
      label = cleanLabel(
        withoutMd.replace(URL_RE, " ").replace(/^[\s\-*•>”"`]*(?:\d+[.)])?\s*/, "")
      );
    }

    // No inline label → the buffered text above is probably this item's header
    // ("Name (Size M) - review…" on the line above the W2C link). The line
    // directly above the URL is the best candidate; the block's FIRST line
    // covers "name line, then review lines" blocks. Anything before/after the
    // header keeps its old home: previous item's note / this item's note.
    let note = "";
    if (!label && pending.length) {
      const lastIdx = pending.length - 1;
      let headerIdx = -1;
      let header = headerSplit(pending[lastIdx], { atBoundary: lastIdx === 0 && pendingBoundary });
      if (header) headerIdx = lastIdx;
      else if (pending.length > 1) {
        header = headerSplit(pending[0], { atBoundary: pendingBoundary });
        if (header) headerIdx = 0;
      }
      if (header && header.label.length > 2) {
        label = header.label;
        note = [header.note, ...pending.slice(headerIdx + 1)].filter(Boolean).join(" ").trim();
        pending = pending.slice(0, headerIdx); // earlier lines stay with the previous item
      }
    }
    // Whatever the buffer wasn't consumed as a header is review chatter for
    // the previous item (the pre-2026-07-22 behavior for ALL buffered text).
    flushPendingToNote();

    const item = {
      url: primary,
      label: label.length > 2 ? label : "",
      note,
      category: guessCategory(label),
      rawLine: line,
    };
    items.push(item);
    lastItem = item;
    boundary = false;
  }
  flushPendingToNote();
  return items;
}

// ————— Public API —————————————————————————————————————————————————————————————

// Returns null when the paste isn't haul-shaped (caller falls through to the
// generic import path). Otherwise:
//   { items: [{url, label, note, category, rawLine}],
//     stats: {heightCm?, weightKg?, usualSize?, agent?, budget?, budgetCurrency?},
//     poster: string|null, sourceUrl: string|null }
export function parseRedditHaul(text) {
  if (!text || typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed || trimmed.startsWith("[") || trimmed.startsWith("<")) return null; // JSON/HTML have their own paths

  const items = extractItems(trimmed);
  if (items.length === 0) return null;

  const sourceMatch = REDDIT_POST_RE.exec(trimmed);
  const userMatch = REDDIT_USER_RE.exec(trimmed);
  const stats = parseStats(trimmed);
  const hasStats = Object.keys(stats).length > 0;

  // Haul shape: multiple shoppable links, or one link with reddit provenance or
  // a stats block. A single bare link with no context stays on the generic path.
  if (items.length === 1 && !sourceMatch && !hasStats) return null;

  return {
    items,
    stats,
    poster: userMatch ? userMatch[1] : null,
    sourceUrl: sourceMatch ? sourceMatch[0] : null,
  };
}
