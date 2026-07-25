import { Fragment, lazy, Suspense, useState, useEffect, useRef, useMemo, useId, forwardRef, useImperativeHandle, useCallback } from "react";
import { flushSync } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Heart, MoreHorizontal, Pen, Plus, RefreshCw, Search, Trash2, User, X } from "lucide-react";
import {
  createStorageBackend,
  loadStoredItems,
  saveStoredItems,
  eraseAllCredenzaData,
} from "./credenza-storage.js";
import {
  searchItems,
  serializeAskCandidates,
} from "./credenza-search-fashion.js";
import {
  DEFAULT_AGENT_ID,
  buildAgentUrl,
  buildSignupUrl,
  getAgent,
  hashItemId,
  listAgents,
  loadOutboundClicks,
  marketplaceOf,
  recordOutboundClick,
  summarizeOutbound,
} from "./agents.js";
import { parseRedditHaul, deobfuscateUrls } from "./reddit-haul.js";
import { fashionGateStatus } from "./fashion-gate.js";
import { FIND_STATUSES } from "./credenza-find-status.js";
import { markActivation, monitoredFetch } from "./monitor.js";
import {
  AUTH_ENABLED,
  loadSession,
  saveSession,
  sessionFromUrl,
  sendMagicLink,
  googleAuthUrl,
  getValidSession,
  signOut as authSignOut,
  authHeaders,
} from "./preview/src/auth.js";
import {
  loadCachedEntitlement,
  refreshEntitlement,
  clearCachedEntitlement,
  checkout as accountCheckout,
  openPortal as accountPortal,
  deleteAccount as accountDeleteRequest,
} from "./preview/src/account.js";
import { overFreeLimit, bumpUsage } from "./preview/src/usage.js";
import "./credenza.css";
import "./credenza-fashion.css";

// Sheets load on first open (CO-28): each dialog is its own chunk, fetched the
// first time the user asks for it. The Suspense fallback is null — the shell
// stays put while the small chunk arrives. The circular import back into this
// file is safe: the sheet chunk evaluates only after this module is done.
const CaptureSheet = lazy(() => import("./sheets/CaptureSheet.jsx"));
const ProfileSheet = lazy(() => import("./sheets/ProfileSheet.jsx"));
const FitPrefsSheet = lazy(() => import("./sheets/FitPrefsSheet.jsx"));
const BodyProfileSheet = lazy(() => import("./sheets/BodyProfileSheet.jsx"));
const AgentSheet = lazy(() => import("./sheets/AgentSheet.jsx"));
const ImportSheet = lazy(() => import("./sheets/ImportSheet.jsx"));
const SettingsSheet = lazy(() => import("./sheets/SettingsSheet.jsx"));

// ═══════════════════════════════════════════════════════════════════════════════════
// ═══ CONSTANTS & THEME (Studio) ═══
// ═══════════════════════════════════════════════════════════════════════════════════

// Theme-driven palette: components reference CSS variables; the app root sets them
// per theme. Two modes:
//   light  = Gallery — warm-white #F4F4F0 canvas, white cards, ink #17181a
//   rainbow (prefs key) = Blackout dark — true black #000000 + neutral #1a1a1d (zero blue cast)
const PALETTES = {
  // Gallery light: warm-white canvas, white cards, neutral ink accents.
  // Chrome is near-monochrome so product photos own the color story;
  // money green + heart red are the only hue in the system.
  light: {
    "--cz-bg": "#F4F4F0",
    "--cz-bg-elevated": "#ffffff",
    "--cz-card": "rgba(255, 255, 255, 0.85)",
    "--cz-card-solid": "#ffffff",
    /* To-do 16: hairline darkened from #e2e2dc — thin borders read too faint
       on the warm-white canvas. */
    "--cz-hair": "#d2d2c9",
    "--cz-hair-strong": "rgba(23, 24, 26, 0.18)",
    "--cz-ink": "#17181a",
    "--cz-sub": "#4f545b",
    "--cz-faint": "#6b7078",
    "--cz-seg": "rgba(23, 24, 26, 0.06)",
    "--cz-accent": "#17181a",
    "--cz-accent-bg": "rgba(23, 24, 26, 0.08)",
    "--cz-accent-deep": "#3c3e44",
    "--cz-favorite": "#17181a",
    "--cz-action-fill": "#17181a",
    "--cz-action-text": "#F4F4F0",
    "--cz-action-text-divider": "rgba(244, 244, 240, 0.22)",
    "--cz-action-muted-bg": "rgba(23, 24, 26, 0.92)",
    "--cz-action-muted-text": "#F4F4F0",
    "--cz-focus": "#17181a",
    "--cz-like": "#e11d48",
    "--cz-money": "#15803d",
    "--cz-money-bg": "rgba(21, 128, 61, 0.09)",
    "--cz-selection": "rgba(23, 24, 26, 0.16)",
    "--cz-selection-text": "#17181a",
    "--cz-error-bg": "rgba(225, 29, 72, 0.10)",
    "--cz-error-text": "#be123c",
    "--cz-glow": "rgba(23, 24, 26, 0.14)",
    // Lifts the round Stash button off the shelf (mobile handoff step 3).
    "--cz-fab-shadow": "0 10px 26px rgba(23, 24, 26, 0.34)",
    "--cz-glow-weak": "rgba(244, 244, 240, 0.55)",
    "--cz-gradient-1": "#17181a",
    "--cz-gradient-2": "#565a61",
    "--cz-gradient-3": "#a3a3ab",
  },
  // Blackout dark: true-black field, neutral #1a1a1d surfaces, zero blue cast.
  // Money green + heart red are the only hue; everything else is grayscale.
  rainbow: {
    "--cz-bg": "#000000",
    "--cz-bg-elevated": "#101012",
    "--cz-card": "rgba(32, 32, 36, 0.86)",
    /* CO-19: #1a1a1d on #000 vanished — the lower half of each card merged
       into the field. Surface and hairline raised so the card edge holds. */
    "--cz-card-solid": "#202024",
    "--cz-hair": "rgba(255, 255, 255, 0.16)",
    "--cz-hair-strong": "rgba(255, 255, 255, 0.24)",
    "--cz-ink": "#f5f5f7",
    "--cz-sub": "#b7bbc2",
    "--cz-faint": "#9ea3ab",
    "--cz-seg": "rgba(255, 255, 255, 0.07)",
    "--cz-accent": "#f5f5f7",
    "--cz-accent-bg": "rgba(245, 245, 247, 0.12)",
    "--cz-accent-deep": "#ffffff",
    "--cz-favorite": "#f5f5f7",
    // Near-white face carries the black label at ~17:1 (Kyle spec: Buy action
    // fill near-white with black text; floor per audit S2 table is 4.5:1).
    "--cz-action-fill": "#f5f5f7",
    "--cz-action-text": "#000000",
    "--cz-action-text-divider": "rgba(0, 0, 0, 0.18)",
    "--cz-action-muted-bg": "rgba(245, 245, 247, 0.92)",
    "--cz-action-muted-text": "#1a1a1d",
    "--cz-focus": "#f5f5f7",
    "--cz-like": "#f40051",
    "--cz-money": "#4ade80",
    "--cz-money-bg": "rgba(74, 222, 128, 0.12)",
    "--cz-selection": "rgba(245, 245, 247, 0.22)",
    "--cz-selection-text": "#f5f5f7",
    "--cz-error-bg": "rgba(244, 63, 94, 0.16)",
    "--cz-error-text": "#f08a92",
    "--cz-glow": "rgba(245, 245, 247, 0.30)",
    // The light shadow is invisible on a true-black field. Deeper and wider
    // so the button still separates from the shelf.
    "--cz-fab-shadow": "0 10px 30px rgba(0, 0, 0, 0.62)",
    "--cz-glow-weak": "rgba(26, 26, 29, 0.55)",
    "--cz-gradient-1": "#1a1a1d",
    "--cz-gradient-2": "#3a3a40",
    "--cz-gradient-3": "#a3a3ab",
  },
};

const BG = "var(--cz-bg)";
export const CARD = "var(--cz-card)";
export const HAIR = "var(--cz-hair)";
export const INK = "var(--cz-ink)";
export const SUB = "var(--cz-sub)";
const FAINT = "var(--cz-faint)";
export const SEG = "var(--cz-seg)";
export const BLUE = "var(--cz-accent)";
const BLUE_BG = "var(--cz-accent-bg)";
const BLUE_DK = "var(--cz-accent-deep)";
const ACTION_FILL = "var(--cz-action-fill)";

export const FONT = "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const DISPLAY = "Georgia, 'Iowan Old Style', 'Times New Roman', serif";

// Internal type keys are stable (match stored data); labels are display-only.
const TYPES = {
  video: { label: "Video", dot: "#FF9500" },
  tweet: { label: "Post", dot: "#5AC8FA" },
  audio: { label: "Audio", dot: "#AF52DE" },
  article: { label: "Read", dot: "#34C759" },
  reddit: { label: "Find", dot: "#FF4500" },
  note: { label: "Note", dot: "#8E8E93" },
};

// Garment categories drive the shelf filter rail. Keys are stored on items
// (and returned by the resolver); labels are display-only.
export const CATEGORIES = {
  shirt: { label: "Shirts", dot: "#5AC8FA" },
  pants: { label: "Pants", dot: "#FF9500" },
  shorts: { label: "Shorts", dot: "#FFB340" },
  shoes: { label: "Shoes", dot: "#34C759" },
  outerwear: { label: "Outerwear", dot: "#AF52DE" },
  accessory: { label: "Accessories", dot: "#FF4500" },
  socks: { label: "Socks", dot: "#BF5AF2" },
  bag: { label: "Bags", dot: "#FFD60A" },
  hat: { label: "Hats", dot: "#64D2FF" },
  other: { label: "Other", dot: "#8E8E93" },
};

// A6 (docs/Monetization.md): rough per-category ship weights in grams. These
// are conservative middles from agent warehouse scales, not listing data —
// always render with a "~" prefix, never fake precision. A per-item
// weightGrams override (edit form) always wins.
export const CATEGORY_WEIGHT_GRAMS = {
  shirt: 250,
  pants: 600,
  shorts: 350,
  shoes: 1100,
  outerwear: 900,
  accessory: 200,
  socks: 100,
  bag: 700,
  hat: 150,
  other: 300,
};

// Effective ship weight in grams: manual override first, then the category
// default. Returns null when neither is known (no category set).
export function itemWeightGrams(item) {
  const override = Number(item?.weightGrams);
  if (Number.isFinite(override) && override > 0) return Math.round(override);
  return CATEGORY_WEIGHT_GRAMS[item?.category || ""] || null;
}

// "~1.2 kg" / "~350 g". Rounds to one decimal kg — rough by design.
export function formatWeightGrams(grams) {
  if (!Number.isFinite(grams) || grams <= 0) return "";
  if (grams < 1000) return "~" + Math.round(grams) + " g";
  return "~" + (Math.round(grams / 100) / 10) + " kg";
}

// Part 5 Tier A (task 8): the haul ship weight never counts returned items —
// they leave the warehouse back to the seller, not to you.
export function haulWeightGrams(items) {
  let sum = 0;
  let known = false;
  for (const it of items || []) {
    if ((it?.findStatus || "want") === "returned") continue;
    const w = itemWeightGrams(it);
    if (w != null) {
      sum += w;
      known = true;
    }
  }
  return known ? sum : null;
}

// Part 5 Tier A (task 9): chargeable parcel weight. Carriers bill the larger
// of actual and volumetric weight. Packaging adds a margin to the actual
// side: none +0%, standard +10%, reinforced +20%. Volumetric uses the common
// 5000 cm³/kg divisor. All inputs are optional; null = no estimate possible.
export const PACKAGING_OPTIONS = [
  { id: "none", label: "No extra packaging", factor: 1 },
  { id: "standard", label: "Standard (+10%)", factor: 1.1 },
  { id: "reinforced", label: "Reinforced (+20%)", factor: 1.2 },
];
export function volumetricWeightGrams(dims) {
  const l = Number(dims?.l);
  const w = Number(dims?.w);
  const h = Number(dims?.h);
  if (![l, w, h].every((n) => Number.isFinite(n) && n > 0)) return null;
  return Math.round((l * w * h) / 5); // (l·w·h)/5000 kg → grams
}
export function chargeableWeightGrams({ actualGrams, dims, packaging } = {}) {
  const factor = (PACKAGING_OPTIONS.find((p) => p.id === packaging) || PACKAGING_OPTIONS[0]).factor;
  const actual = Number.isFinite(Number(actualGrams)) && Number(actualGrams) > 0
    ? Math.round(Number(actualGrams) * factor)
    : null;
  const volumetric = volumetricWeightGrams(dims);
  if (actual == null && volumetric == null) return null;
  return Math.max(actual || 0, volumetric || 0);
}

// Part 5 Tier A (task 7): first-class haul record. item.project still holds
// the haul NAME (cards, imports, and Reddit hauls all speak names); the
// record adds the stable id and the haul-level data. Whitelist migration —
// unknown fields vanish, same rule as migrateItem.
export const HAULS_KEY = "credenza-fashion-hauls-v1";
export function migrateHaul(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = String(raw.name || "").trim();
  if (!name) return null;
  const budget = Number(raw.budget);
  const dims = raw.parcel && raw.parcel.dims && typeof raw.parcel.dims === "object"
    ? {
        l: Number(raw.parcel.dims.l) || null,
        w: Number(raw.parcel.dims.w) || null,
        h: Number(raw.parcel.dims.h) || null,
      }
    : null;
  const parcelWeight = raw.parcel && Number(raw.parcel.weightGrams);
  return {
    id: String(raw.id || "").trim() || "haul-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name,
    createdAt: Number(raw.createdAt) || Date.now(),
    updatedAt: Number(raw.updatedAt) || Date.now(),
    budget: Number.isFinite(budget) && budget > 0 ? Math.round(budget * 100) / 100 : null,
    currency: raw.currency === "CNY" ? "CNY" : "USD",
    archived: raw.archived === true,
    parcel: raw.parcel && typeof raw.parcel === "object"
      ? {
          weightGrams: Number.isFinite(parcelWeight) && parcelWeight > 0 ? Math.round(parcelWeight) : null,
          dims,
          packaging: ["none", "standard", "reinforced"].includes(raw.parcel.packaging)
            ? raw.parcel.packaging
            : "none",
        }
      : null,
    history: (Array.isArray(raw.history) ? raw.history : [])
      .filter((e) => e && typeof e === "object" && e.type)
      .slice(-50)
      .map((e) => ({ at: Number(e.at) || Date.now(), type: String(e.type), detail: String(e.detail || "") })),
  };
}

// Local category guess from free text (Yupoo title/description, review notes).
// Returns a CATEGORIES key or "" when nothing confident matches.
function guessFashionCategory(text) {
  const t = String(text || "").toLowerCase();
  if (!t.trim()) return "";
  if (/\b(shoe|shoes|sneaker|sneakers|jordan|dunk|af1|yeezy|boot|boots|slide|slides|sandal|loafer|trainer)\b/.test(t)) return "shoes";
  if (/\b(hoodie|hoodies|jacket|jackets|coat|coats|parka|puffer|windbreaker|outerwear|varsity|bomber)\b/.test(t)) return "outerwear";
  if (/\b(short|shorts|trunks|swim short)\b/.test(t)) return "shorts";
  if (/\b(pant|pants|jean|jeans|trouser|trousers|cargo|jogger|joggers|sweatpant)\b/.test(t)) return "pants";
  if (/\b(sock|socks|crew sock)\b/.test(t)) return "socks";
  if (/\b(hat|hats|cap|caps|beanie|bucket hat|snapback)\b/.test(t)) return "hat";
  if (/\b(bag|bags|backpack|tote|duffel|crossbody|sling)\b/.test(t)) return "bag";
  if (/\b(belt|watch|sunglass|sunglasses|wallet|scarf|glove|gloves|chain|necklace|bracelet)\b/.test(t)) return "accessory";
  if (/\b(tee|t-shirt|tshirt|shirt|shirts|jersey|jerseys|polo|top|crewneck|longsleeve|blouse)\b/.test(t)) return "shirt";
  // Chinese marketplace crumbs that sometimes appear in Yupoo descriptions.
  if (/鞋|运动鞋|球鞋/.test(t)) return "shoes";
  if (/短裤/.test(t)) return "shorts";
  if (/裤|牛仔裤/.test(t)) return "pants";
  if (/卫衣|外套|棉服|羽绒服|夹克/.test(t)) return "outerwear";
  if (/袜/.test(t)) return "socks";
  if (/帽/.test(t)) return "hat";
  if (/包|背包/.test(t)) return "bag";
  if (/T恤|短袖|长袖|衬衫|球衣|卫衣/.test(t) && !/外套/.test(t)) return "shirt";
  return "";
}

// USD-first display. Prefer the resolved USD conversion; fall back to a raw
// USD price; only show CNY alone when no USD is known. Secondary currency
// trails after a middle-dot when both are available.
// Settings will later let people flip primary currency — see
// docs/settings-toggles.md.
function formatMoney(amount, currency) {
  if (amount == null || !isFinite(Number(amount))) return "";
  const n = Number(amount);
  const pretty =
    currency === "USD"
      ? (Number.isInteger(n) ? String(n) : n.toFixed(2))
      : Number.isInteger(n)
        ? String(n)
        : String(Math.round(n * 100) / 100);
  if (currency === "USD") return "$" + pretty;
  if (currency === "CNY") return "¥" + pretty;
  return currency + " " + pretty;
}

// Same fallback the resolve function uses when FX is unavailable — keeps
// shelf totals stable across devices before/without enrichment priceUsd.
const FX_FALLBACK_USD_PER_CNY = 0.14;

function itemUsdAmount(item) {
  if (item.priceUsd != null && isFinite(item.priceUsd)) return Number(item.priceUsd);
  if (item.price == null || !isFinite(item.price)) return null;
  const currency = String(item.currency || "CNY").toUpperCase();
  if (currency === "USD" || currency === "$") return Number(item.price);
  if (currency === "CNY" || currency === "RMB" || currency === "¥" || currency === "CNH") {
    return Math.round(Number(item.price) * FX_FALLBACK_USD_PER_CNY * 100) / 100;
  }
  // Unknown currency: don't invent USD (would inflate the reel).
  return null;
}

// Primary price currency (settings-toggles.md #1, design handoff PR3 profile
// sheet): display ORDER only — stored item fields never change. The app root
// syncs this from credenza-prefs-v1; the USD default keeps tests and any
// non-app caller unchanged.
let PRICE_PRIMARY = "USD";
function setPricePrimaryPref(v) {
  PRICE_PRIMARY = v === "CNY" ? "CNY" : "USD";
}

// Fit summary prefs (design handoff PR4). Same module-mirror pattern as
// PRICE_PRIMARY: the App syncs these from its prefs state, and flipping a
// ProfileSheet toggle re-renders the tree so FitSummary reads fresh values.
let FIT_SUMMARY_ON = true;
let FIT_DETAIL = "concise"; // "concise" | "detailed"
function setFitPrefs({ summary, detail }) {
  FIT_SUMMARY_ON = summary !== false;
  FIT_DETAIL = detail === "detailed" ? "detailed" : "concise";
}

function priceLabel(item) {
  if (item.price == null && item.priceUsd == null) return "";
  const currency = item.currency || "CNY";
  const usd = itemUsdAmount(item);
  const cny =
    currency === "CNY" && item.price != null && isFinite(item.price) ? item.price : null;

  if (usd != null && cny != null) {
    return PRICE_PRIMARY === "CNY"
      ? formatMoney(cny, "CNY") + " · " + formatMoney(usd, "USD")
      : formatMoney(usd, "USD") + " · " + formatMoney(cny, "CNY");
  }
  if (usd != null) return formatMoney(usd, "USD");
  if (cny != null) return formatMoney(cny, "CNY");
  if (item.price != null) return formatMoney(item.price, currency);
  return "";
}

// USD-only pill label (Kyle 2026-07-22): the dual-currency chip ate too much
// photo on phones. USD when known, CNY fallback, whatever-currency last.
function priceLabelShort(item) {
  const usd = itemUsdAmount(item);
  if (usd != null) return formatMoney(usd, "USD");
  if (item.price != null && isFinite(item.price)) return formatMoney(item.price, item.currency || "CNY");
  return "";
}

// ═══ SIZE CHART PARSING & RECOMMENDATION (Kyle 2026-07-22) ═══
// Charts arrive as free text — Yupoo album descriptions (stored in summary),
// Weidian sizeNotes, or pasted notes. Two layouts dominate:
//   labeled:  "M: 胸围112 衣长70 肩宽48 袖长62" / "M: chest 112, length 70"
//   table:    "Size  Chest  Length\nS 110 68\nM 114 70"
// parseSizeChart normalizes both into rows keyed by size token.

// Letter sizes plus pants waists (26–40). Free-size (均码/F) counts too.
const SIZE_TOKEN_SRC = "(?:XXS|XS|S|M|L|XL|XXL|XXXL|[2-5]XL|F|均码|2[6-9]|3\\d|40)";
// A token must stand alone: separator (or string edge) before, separator after.
// The lookahead kills false hits like "M65", "300g", "30-day".
const SIZE_MENTION_RE = new RegExp(
  "(?:^|[\\s,;·|/（(\\[>])(" + SIZE_TOKEN_SRC + ")(?=[\\s码:：,，;·|/）)\\]<]|$)",
  "gm"
);
// Label → number pairs. Longest labels first so 裤长/袖长 beat 长, and
// "pants length" beats "length". cm values are realistically 20–250.
const MEASURE_PAIR_RE =
  /(胸围|胸寛|胸宽|chest|bust|肩宽|肩寛|shoulder|袖长|袖長|sleeve|腰围|腰圍|waist|臀围|臀圍|hip|裤长|褲長|pants?\s*length|trouser\s*length|衣长|衣長|length)\s*[:：]?\s*(\d{2,3})/gi;

function measureKeyForLabel(label) {
  const l = label.toLowerCase();
  if (/胸|chest|bust/.test(l)) return "chest";
  if (/肩|shoulder/.test(l)) return "shoulder";
  if (/袖|sleeve/.test(l)) return "sleeve";
  if (/腰|waist/.test(l)) return "waist";
  if (/臀|hip/.test(l)) return "hip";
  if (/裤|褲|pants|trouser/.test(l)) return "pantsLength";
  return "length";
}

function sizeRunHint(text) {
  if (/runs?\s*(big|large)|偏大|版型大/i.test(text)) return "big";
  if (/runs?\s*small|偏小|版型小/i.test(text)) return "small";
  if (/true\s*to\s*size|fits?\s*true|正码|正常码/i.test(text)) return "true";
  return null;
}

function chartHeaderLabels(line) {
  const labels = [];
  // Header detection uses bare labels (no numbers required after them).
  const labelOnly = new RegExp(MEASURE_PAIR_RE.source.replace("\\s*[:：]?\\s*(\\d{2,3})", ""), "gi");
  let lm;
  while ((lm = labelOnly.exec(line))) labels.push(measureKeyForLabel(lm[1]));
  // Dedup while keeping order — "臀围 /hip circumference" can match twice.
  const seen = new Set();
  return labels.filter((k) => (seen.has(k) ? false : (seen.add(k), true)));
}

export function parseSizeChart(text) {
  const src = String(text || "");
  if (!src.trim()) return null;

  // Strategy 1 — labeled: split the text at size-token mentions, then read
  // label+number pairs out of each token's segment.
  const rows = [];
  const seen = new Set();
  const mentions = [];
  SIZE_MENTION_RE.lastIndex = 0;
  let m;
  while ((m = SIZE_MENTION_RE.exec(src))) mentions.push({ size: m[1], end: m.index + m[0].length, start: m.index });
  for (let i = 0; i < mentions.length; i++) {
    const seg = src.slice(mentions[i].end, i + 1 < mentions.length ? mentions[i + 1].start : undefined);
    const row = { size: mentions[i].size.toUpperCase() };
    MEASURE_PAIR_RE.lastIndex = 0;
    let p;
    while ((p = MEASURE_PAIR_RE.exec(seg))) {
      const key = measureKeyForLabel(p[1]);
      const value = parseInt(p[2], 10);
      if (row[key] == null && value >= 20 && value <= 250) row[key] = value;
    }
    const measures = Object.keys(row).length - 1;
    if (measures >= 1 && !seen.has(row.size)) {
      seen.add(row.size);
      rows.push(row);
    }
  }

  // Strategy 2 — positional table: a header line naming ≥1 measurement,
  // then rows of "<size> n [n n…]" mapping numbers onto the header in order.
  // Hip-only / chest-only charts are common on Yupoo (single measure column).
  if (rows.length < 2) {
    const lines = src.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    for (let h = 0; h < lines.length; h++) {
      const labels = chartHeaderLabels(lines[h]);
      if (labels.length < 1) continue;
      const tableRows = [];
      for (let r = h + 1; r < lines.length; r++) {
        const tm = lines[r].match(new RegExp("^(" + SIZE_TOKEN_SRC + ")\\b", "i"));
        if (!tm) {
          // Allow a blank/separator line mid-table, but stop on non-size content
          // once we've started collecting rows.
          if (tableRows.length && !/^[·.\-\s]*$/.test(lines[r])) break;
          continue;
        }
        const nums = (lines[r].match(/\d{2,3}/g) || [])
          .map((n) => parseInt(n, 10))
          .filter((n) => n >= 20 && n <= 250);
        // Drop a leading number that is the size token itself (waist 28–40).
        const sizeAsNum = /^\d+$/.test(tm[1]) ? parseInt(tm[1], 10) : null;
        const measureNums =
          sizeAsNum != null && nums[0] === sizeAsNum ? nums.slice(1) : nums;
        if (measureNums.length < 1) continue;
        const row = { size: tm[1].toUpperCase() };
        labels.forEach((key, i) => {
          if (measureNums[i] != null && row[key] == null) row[key] = measureNums[i];
        });
        // Single-label header + one number: map the first measure num.
        if (labels.length === 1 && row[labels[0]] == null && measureNums[0] != null) {
          row[labels[0]] = measureNums[0];
        }
        if (Object.keys(row).length > 1 && !seen.has(row.size)) {
          seen.add(row.size);
          tableRows.push(row);
        }
      }
      if (tableRows.length >= 2) {
        rows.push(...tableRows);
        break;
      }
    }
  }

  // Strategy 3 — size + bare numbers under a nearby measure header, e.g.
  // "臀围 / hip circumference\nS 100\nM 104\nL 108\nXL 112"
  // when strategy 2 missed because the header was on a previous line with noise.
  if (rows.length < 2) {
    const lines = src.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    let pendingKey = null;
    for (let i = 0; i < lines.length; i++) {
      const labels = chartHeaderLabels(lines[i]);
      if (labels.length === 1) pendingKey = labels[0];
      if (labels.length > 1) pendingKey = labels[0]; // prefer first measure
      if (!pendingKey) continue;
      const tableRows = [];
      for (let r = i + 1; r < lines.length; r++) {
        const tm = lines[r].match(new RegExp("^(" + SIZE_TOKEN_SRC + ")\\b", "i"));
        if (!tm) {
          if (tableRows.length) break;
          // Maybe this line is another header — update pending key.
          const more = chartHeaderLabels(lines[r]);
          if (more.length) pendingKey = more[0];
          continue;
        }
        const nums = (lines[r].match(/\d{2,3}/g) || [])
          .map((n) => parseInt(n, 10))
          .filter((n) => n >= 20 && n <= 250);
        const sizeAsNum = /^\d+$/.test(tm[1]) ? parseInt(tm[1], 10) : null;
        const measureNums =
          sizeAsNum != null && nums[0] === sizeAsNum ? nums.slice(1) : nums;
        if (!measureNums.length) continue;
        const row = { size: tm[1].toUpperCase(), [pendingKey]: measureNums[0] };
        if (!seen.has(row.size)) {
          seen.add(row.size);
          tableRows.push(row);
        }
      }
      if (tableRows.length >= 2) {
        rows.push(...tableRows);
        break;
      }
    }
  }

  if (rows.length < 2) return null;
  return { rows, runHint: sizeRunHint(src) };
}

// Pick a size from a parsed chart against a body profile (all cm; weight kg).
// Tops → chest (+ease). Bottoms → waist, falling back to hip when the chart
// only lists 臀围 (common Yupoo pants/shorts sheets). Outerwear gets more ease.
// Optional fitPref (per-category length/looseness) may nudge the letter size
// after the measure pick (design turn 5). Length is metadata only.
// Returns { size, fitNote, reason, row, primaryKey, garment, body, diff,
//   lengthCheck, alt, baseSize?, prefShift?, prefReason?, fitPref? }
//   | { missing: "chest"|"waist"|"hip" } | null.
// `alt` is the runner-up size (fit-preference alternative) or null.
export function recommendSize(chart, profile, category, fitPref = null) {
  if (!chart || !Array.isArray(chart.rows) || chart.rows.length < 2) return null;
  const p = profile || {};
  const rows = chart.rows;
  const has = (key) => rows.filter((r) => r[key] != null).length >= 2;
  const catPants = category === "pants" || category === "shorts";
  const shapePants =
    (has("waist") || has("hip")) && !has("chest");
  const isBottoms = catPants || shapePants;

  // Choose the best garment measure available on the chart, then the matching
  // body field. Hip-only charts used to return null (waist required).
  let primaryKey = null;
  let bodyKey = null;
  let ease = 12;
  if (isBottoms) {
    if (has("waist") && p.waist != null) {
      primaryKey = "waist";
      bodyKey = "waist";
      ease = 2;
    } else if (has("hip") && p.hip != null) {
      primaryKey = "hip";
      bodyKey = "hip";
      ease = 2;
    } else if (has("waist")) {
      return { missing: "waist" };
    } else if (has("hip")) {
      return { missing: "hip" };
    } else {
      return null;
    }
  } else {
    // Tops / outerwear / other with chest data.
    if (has("chest") && p.chest != null) {
      primaryKey = "chest";
      bodyKey = "chest";
      ease = category === "outerwear" ? 16 : 12;
    } else if (has("chest")) {
      return { missing: "chest" };
    } else if (has("hip") && p.hip != null) {
      // Chart only has hip but item isn't classified as bottoms — still usable.
      primaryKey = "hip";
      bodyKey = "hip";
      ease = 2;
    } else if (has("waist") && p.waist != null) {
      primaryKey = "waist";
      bodyKey = "waist";
      ease = 2;
    } else if (has("hip")) {
      return { missing: "hip" };
    } else if (has("waist")) {
      return { missing: "waist" };
    } else {
      return null;
    }
  }

  let target = p[bodyKey] + ease;
  // Garment runs big → the label understates it → aim smaller, and vice versa.
  if (chart.runHint === "big") target -= 4;
  else if (chart.runHint === "small") target += 4;

  const candidates = rows.filter((r) => r[primaryKey] != null);
  if (candidates.length < 2) return null;
  const isTop = primaryKey === "chest";
  const score = (r) => {
    let s = Math.abs(r[primaryKey] - target);
    if (isTop && p.shoulder != null && r.shoulder != null) s += Math.abs(r.shoulder - (p.shoulder + 2)) * 0.4;
    // Sleeves shorter than the arm are worse than sleeves that run long.
    if (isTop && p.sleeve != null && r.sleeve != null) s += Math.max(0, p.sleeve - r.sleeve) * 0.6;
    // Secondary hip nudge on bottoms when both sides have it.
    if (!isTop && primaryKey === "waist" && p.hip != null && r.hip != null) {
      s += Math.abs(r.hip - (p.hip + 2)) * 0.35;
    }
    return s;
  };
  // Score every row, not just the winner — the runner-up becomes the "also
  // works" second option (snugger vs roomier) Kyle asked for.
  const scored = candidates.map((r) => ({ row: r, s: score(r) })).sort((a, b) => a.s - b.s);
  const best = scored[0].row;
  const runnerUp = scored.length > 1 ? scored[1].row : null;

  const fitNote =
    chart.runHint === "big"
      ? "runs big — sized down"
      : chart.runHint === "small"
        ? "runs small — sized up"
        : chart.runHint === "true"
          ? "true to size"
          : "";
  const garment = best[primaryKey];
  const body = p[bodyKey];
  const diff = garment - body;
  // Secondary leg-length check on bottoms. Seller 裤长 is OUTSEAM (inseam +
  // rise), so it never feeds the pick math — surfaced as info only.
  const lengthCheck =
    !isTop && best.pantsLength != null && p.inseam != null
      ? { garment: best.pantsLength, body: p.inseam }
      : null;
  const label = primaryKey === "waist" ? "Waist" : primaryKey === "hip" ? "Hip" : "Chest";
  const reason =
    label + " " + garment + "cm vs your " + body + "cm (" + (diff >= 0 ? "+" : "") + diff + "cm)";
  // Second-best size as a fit-preference alternative: "L also works — snugger".
  const alt =
    runnerUp && runnerUp.size !== best.size
      ? {
          size: runnerUp.size,
          garment: runnerUp[primaryKey],
          diff: runnerUp[primaryKey] - body,
          fit:
            runnerUp[primaryKey] < garment
              ? "snugger"
              : runnerUp[primaryKey] > garment
                ? "roomier"
                : "same",
        }
      : null;
  const baseRec = {
    size: best.size,
    fitNote,
    reason,
    row: best,
    // Structured parts so the UI can render the reason in inches or cm.
    primaryKey,
    garment,
    body,
    diff,
    lengthCheck,
    alt,
  };
  // Optional 4th arg: per-category taste (length + looseness). Looseness can
  // nudge one size up/down; length is metadata only (design turn 5).
  return applyFitPreference(baseRec, chart, fitPref, category);
}

// Per-category Length + Looseness axes (design 5a/5b). Unset axis = no skew.
// Only garment categories that go through recommendSize.
export const FIT_PREF_AXES = {
  shorts: {
    length: [
      { value: "short", label: "Short" },
      { value: "mid", label: "Mid" },
      { value: "long", label: "Long" },
    ],
    looseness: [
      { value: "slim", label: "Slim" },
      { value: "regular", label: "Regular" },
      { value: "baggy", label: "Baggy" },
    ],
  },
  pants: {
    length: [
      { value: "cropped", label: "Cropped" },
      { value: "regular", label: "Regular" },
      { value: "long", label: "Long" },
    ],
    looseness: [
      { value: "slim", label: "Slim" },
      { value: "regular", label: "Regular" },
      { value: "baggy", label: "Baggy" },
    ],
  },
  shirt: {
    length: [
      { value: "cropped", label: "Cropped" },
      { value: "regular", label: "Regular" },
      { value: "long", label: "Long" },
    ],
    looseness: [
      { value: "slim", label: "Slim" },
      { value: "regular", label: "Regular" },
      { value: "oversized", label: "Oversized" },
    ],
  },
  outerwear: {
    length: [
      { value: "cropped", label: "Cropped" },
      { value: "regular", label: "Regular" },
      { value: "long", label: "Long" },
    ],
    looseness: [
      { value: "slim", label: "Slim" },
      { value: "regular", label: "Regular" },
      { value: "oversized", label: "Oversized" },
    ],
  },
};

// Looseness → chart-row nudge. Regular / unset = 0. Slim = one size smaller.
// Baggy / oversized = one size larger. Length does not move the letter size.
export function loosenessNudge(looseness) {
  if (looseness === "slim") return -1;
  if (looseness === "baggy" || looseness === "oversized") return 1;
  return 0;
}

export function fitPrefHasChoice(pref) {
  if (!pref || typeof pref !== "object" || pref.dismissed) return false;
  return !!(pref.length || pref.looseness);
}

export function fitPrefLabel(category, axis, value) {
  const axes = FIT_PREF_AXES[category];
  if (!axes || !value) return value || "";
  const opt = (axes[axis] || []).find((o) => o.value === value);
  return opt ? opt.label : value;
}

function prefReasonLine(category, fitPref, nudge) {
  if (!fitPref || !nudge) return null;
  const catWord =
    category && CATEGORIES[category]
      ? CATEGORIES[category].label.toLowerCase()
      : "this item";
  const loose = fitPrefLabel(category, "looseness", fitPref.looseness).toLowerCase();
  if (!loose) return null;
  if (nudge > 0) {
    return (
      "You like " +
      catWord +
      " " +
      loose +
      ", so we bumped one size for extra room."
    );
  }
  return (
    "You like " +
    catWord +
    " " +
    loose +
    ", so we sized down one step for a closer fit."
  );
}

// Apply per-category taste to a base recommendSize result. Safe no-op when
// fitPref is null, dismissed, or has no looseness nudge.
export function applyFitPreference(rec, chart, fitPref, category) {
  if (!rec || !rec.size || rec.missing) return rec;
  if (!fitPrefHasChoice(fitPref)) {
    return {
      ...rec,
      baseSize: rec.size,
      prefShift: null,
      prefReason: null,
      fitPref: fitPref && !fitPref.dismissed ? fitPref : null,
    };
  }
  const nudge = loosenessNudge(fitPref.looseness);
  const ladder = (chart && Array.isArray(chart.rows) ? chart.rows : []).filter(
    (r) => r && r.size
  );
  const idx = ladder.findIndex(
    (r) => String(r.size).toUpperCase() === String(rec.size).toUpperCase()
  );
  let next = {
    ...rec,
    baseSize: rec.size,
    prefShift: null,
    prefReason: null,
    fitPref: {
      length: fitPref.length || null,
      looseness: fitPref.looseness || null,
    },
  };
  if (!nudge || idx < 0) {
    // Length-only prefs still surface as tags on the rec.
    if (fitPref.length || fitPref.looseness) {
      next.prefReason =
        fitPref.looseness && !nudge
          ? null
          : fitPref.length
            ? "Length preference saved for " +
              (CATEGORIES[category] ? CATEGORIES[category].label.toLowerCase() : "this item") +
              "."
            : null;
    }
    return next;
  }
  const newIdx = Math.max(0, Math.min(ladder.length - 1, idx + nudge));
  if (newIdx === idx) return next;
  const shifted = ladder[newIdx];
  const garment =
    rec.primaryKey && shifted[rec.primaryKey] != null
      ? shifted[rec.primaryKey]
      : rec.garment;
  const diff = rec.body != null && garment != null ? garment - rec.body : rec.diff;
  return {
    ...next,
    size: shifted.size,
    row: shifted,
    garment,
    diff,
    baseSize: rec.size,
    prefShift: nudge > 0 ? "up" : "down",
    prefReason: prefReasonLine(category, fitPref, nudge),
    reason:
      (rec.primaryKey === "waist" ? "Waist" : rec.primaryKey === "hip" ? "Hip" : "Chest") +
      " " +
      garment +
      "cm vs your " +
      rec.body +
      "cm (" +
      (diff >= 0 ? "+" : "") +
      diff +
      "cm) · prefer " +
      (fitPref.looseness || "fit"),
  };
}

// Fit sentence (design handoff PR4): one templated line under the
// Recommended-size block, built from the recommendSize result plus the
// chart's run hint. "concise" is the first clause only; "detailed" adds the
// run-hint / alternate-size tail after an em-dash.
export function fitSummarySentence(rec, { runHint = null, units = "cm", detail = "concise" } = {}) {
  if (!rec || !rec.size || rec.diff == null || !isFinite(rec.diff)) return "";
  const measure = rec.primaryKey === "waist" ? "waist" : rec.primaryKey === "hip" ? "hip" : "chest";
  const diff = rec.diff;
  const room = formatMeasure(Math.abs(diff), units);
  let wears;
  if (diff < 0) {
    wears = "snug";
  } else if (measure === "chest") {
    wears =
      diff >= 18
        ? "relaxed with space to layer"
        : diff >= 12
          ? "relaxed"
          : diff >= 7
            ? "regular"
            : diff >= 3
              ? "close to the body"
              : "snug";
  } else {
    wears = diff >= 6 ? "relaxed" : diff >= 2 ? "regular" : "close";
  }
  const first = "The " + rec.size + " gives about " + room + " of " + measure + " room, so it wears " + wears;
  if (detail !== "detailed") return first + ".";
  const tail = [];
  if (runHint === "big") tail.push("the chart runs big, so the pick already sized down");
  else if (runHint === "small") tail.push("the chart runs small, so the pick already sized up");
  else if (runHint === "true") tail.push("the garment runs true to size");
  if (rec.alt && rec.alt.fit && rec.alt.fit !== "same") {
    tail.push(rec.alt.size + " also works if you want it " + rec.alt.fit);
  }
  if (!tail.length) return first + ".";
  return first + " — " + tail.join("; ") + ".";
}

// Display conversion — storage is always cm/kg (seller charts are metric);
// inches/pounds only exist at the input and display edges.
export function formatMeasure(cm, units) {
  if (cm == null || !isFinite(cm)) return "";
  if (units === "in") return Math.round((cm / 2.54) * 10) / 10 + "″";
  return Math.round(cm * 10) / 10 + "cm";
}

// One display-unit string ("38.5") → storage number (cm or kg). kind is
// "length" (cm↔in) or "weight" (kg↔lb); units is the unit the string is in.
export function measureToStorage(text, units, kind) {
  const n = parseFloat(text);
  if (!isFinite(n) || n <= 0) return null;
  if (units === "in") return Math.round((kind === "weight" ? n / 2.20462 : n * 2.54) * 10) / 10;
  return Math.round(n * 10) / 10;
}

// Storage number → display-unit string for the input fields.
export function measureFromStorage(value, units, kind) {
  if (value == null || !isFinite(value)) return "";
  if (units === "in") {
    const n = kind === "weight" ? value * 2.20462 : value / 2.54;
    return String(Math.round(n * 10) / 10);
  }
  return String(value);
}

const DAY_MS = 864e5;
const WEEK_MS = 7 * DAY_MS;

const RESURFACE_MIN_AGE_MS = 14 * DAY_MS;
const GEM_MIN_AGE_MS = 30 * DAY_MS;
const DISMISS_COOLDOWN_MS = 7 * DAY_MS;
const DUPE_BANNER_MS = 3500;

// AI modes: "localOnly" (default — no network calls ever), "optionalAI" (AI enhances
// when reachable, local result stands otherwise), "connected" (future backend).
const AI_MODE = "localOnly";

// Cloud Ask is a separate, deliberately triggered service. The preview uses the
// same-origin Netlify Function by default; other builds can provide an absolute URL.
const ASK_ENDPOINT =
  (import.meta.env && import.meta.env.VITE_ASK_ENDPOINT) || "/.netlify/functions/ask";
const PREVIEW_ENDPOINT =
  (import.meta.env && import.meta.env.VITE_PREVIEW_ENDPOINT) || "/.netlify/functions/preview";
const RESOLVE_ENDPOINT =
  (import.meta.env && import.meta.env.VITE_RESOLVE_ENDPOINT) || "/.netlify/functions/resolve";
const YUPOO_ENDPOINT =
  (import.meta.env && import.meta.env.VITE_YUPOO_ENDPOINT) || "/.netlify/functions/yupoo";
const CHART_VISION_ENDPOINT =
  (import.meta.env && import.meta.env.VITE_CHART_VISION_ENDPOINT) || "/.netlify/functions/chart-vision";
const REDDIT_ENDPOINT =
  (import.meta.env && import.meta.env.VITE_REDDIT_ENDPOINT) || "/.netlify/functions/reddit";
// Cloud actions are optional capabilities. A Vite value is only a feature flag,
// never authentication; public enablement still requires deployment-level access.
const CLOUD_ASK_ENABLED =
  !!(import.meta.env && import.meta.env.VITE_ENABLE_CLOUD_ASK === "true");
// Sync does not exist yet, so the Log in / Sign up buttons stay hidden
// (CO-05). Flip this flag when sync ships and both buttons return.
export const SYNC_ENABLED =
  !!(import.meta.env && import.meta.env.VITE_ENABLE_SYNC === "true");
const PREVIEW_SECRET =
  (import.meta.env && import.meta.env.VITE_CREDENZA_SEARCH_SECRET) || "";

// ═══════════════════════════════════════════════════════════════════════════════════
// ═══ PARSING & CANONICALIZATION ═══
// ═══════════════════════════════════════════════════════════════════════════════════

function getYouTubeId(url) {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?.*v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/
  );
  return m ? m[1] : null;
}

// The signed-in user's decoded entitlement snapshot, mirrored from component
// state so module-level enrichment (chart-vision) can apply the free daily
// caps without threading props through every call (Part 7e).
let planForLimits = null;
function setPlanForLimits(plan) {
  planForLimits = plan || null;
}

const TRACKING_PARAM_RE =
  /^(utm_\w+|fbclid|gclid|gclsrc|dclid|msclkid|mc_eid|mc_cid|igshid|igsh|si|ref|ref_src|ref_url|s|t|feature|ck_subscriber_id|_hsenc|_hsmi|vero_id|twclid|ttclid)$/i;

// Every http(s) URL in the text, in order, trailing punctuation trimmed, deduped.
// Space-broken URLs ("ta oba o.co m") are repaired first — Reddit posters
// obfuscate W2C links to dodge automod.
function extractUrls(raw) {
  const out = [];
  const seen = new Set();
  const matches = deobfuscateUrls(raw || "").match(/https?:\/\/[^\s]+/g) || [];
  for (let m of matches) {
    m = m.replace(/[),.;:!?'"\]]+$/, "");
    if (!seen.has(m)) {
      seen.add(m);
      out.push(m);
    }
  }
  return out;
}

// Role of a supplementary link, inferred from its host. Generic on purpose —
// rendering only knows "photos" / "buy" / "alt", never specific sites.
function inferLinkRole(url) {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch (e) {
    return "alt";
  }
  if (/(^|\.)yupoo\.com$/.test(host)) return "photos";
  if (/(^|\.)(weidian\.com|weidian\.cn|taobao\.com|tmall\.com)$/.test(host)) return "buy";
  return "alt";
}

// Weidian item ID when the URL is a resolvable product page, else null. Mirrors
// the server-side check in resolve.js so the client never wastes a call.
function weidianItemId(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch (e) {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  if (!/(^|\.)weidian\.(com|cn)$/.test(host)) return null;
  const id = u.searchParams.get("itemID") || u.searchParams.get("itemId") || u.searchParams.get("item_id");
  if (id && /^\d{5,}$/.test(id)) return id;
  const pathMatch = u.pathname.match(/\/item\/(\d{5,})/);
  return pathMatch ? pathMatch[1] : null;
}

function yupooAlbumIdentity(raw) {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (!/(^|\.)yupoo\.com$/.test(host)) return null;
    const album = url.pathname.match(/\/albums\/(\d+)/i);
    if (!album) return null;
    const account = (host.match(/^([^.]+)(?:\.x)?\.yupoo\.com$/) || [])[1];
    return account ? { account, albumId: album[1] } : null;
  } catch {
    return null;
  }
}

// Yupoo album pages often 404 in the browser without ?uid=… — keep a supplied
// uid, otherwise default to 1 so enrichment/open never drop a working paste.
function ensureYupooAlbumUid(raw) {
  if (!raw || typeof raw !== "string") return raw;
  try {
    const url = new URL(raw.trim());
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (!/(^|\.)yupoo\.com$/.test(host)) return raw;
    if (!/\/albums\/\d+/i.test(url.pathname)) return raw;
    if (!url.searchParams.get("uid")) url.searchParams.set("uid", "1");
    return url.href;
  } catch {
    return raw;
  }
}

// First resolvable buy URL on an item: the primary URL or any paired link.
function resolvableBuyUrl(item) {
  if (item.url && weidianItemId(item.url)) return item.url;
  for (const l of item.links || []) {
    if (l && l.url && weidianItemId(l.url)) return l.url;
  }
  return null;
}

// First Yupoo album URL on an item: the primary URL or any paired link tagged
// as photos. Used to populate the photo-orbit animation.
function yupooAlbumUrl(item) {
  function isYupoo(raw) {
    try {
      const host = new URL(raw).hostname.replace(/^www\./, "").toLowerCase();
      return /(^|\.)yupoo\.com$/.test(host);
    } catch {
      return false;
    }
  }
  if (item.url && isYupoo(item.url)) return ensureYupooAlbumUid(item.url);
  for (const l of item.links || []) {
    if (l && l.url && isYupoo(l.url)) return ensureYupooAlbumUid(l.url);
  }
  return null;
}

// Normalizes a links array (strings or {url, role} objects) against the primary
// URL: http(s) only, primary removed, deduped by canonical key, roles re-inferred
// when missing/invalid. Source order preserved.
function normalizeLinks(links, primaryUrl) {
  if (!Array.isArray(links)) return [];
  const primaryKey = primaryUrl ? canonicalKey(classify(primaryUrl), primaryUrl) : null;
  const seen = new Set();
  const out = [];
  for (const entry of links) {
    const url = typeof entry === "string" ? entry : entry && entry.url;
    if (!url || !/^https?:\/\//.test(url)) continue;
    const key = canonicalKey(classify(url), url);
    if (key === primaryKey || seen.has(key)) continue;
    seen.add(key);
    const inferredRole = inferLinkRole(url);
    const role = inferredRole === "photos"
      ? "photos"
      : entry && typeof entry === "object" && ["photos", "buy", "alt"].includes(entry.role)
        ? entry.role
        : inferredRole;
    const label = entry && typeof entry === "object" && typeof entry.label === "string"
      ? entry.label.trim().slice(0, 40)
      : "";
    out.push({ url, role, ...(label ? { label } : {}) });
  }
  return out;
}

function pairedLinksFromRawText(rawText, primaryUrl) {
  const urls = extractUrls(rawText);
  return normalizeLinks(urls, primaryUrl);
}

// Dupe check that also looks at paired links, so stashing a buy URL that's
// already paired onto an existing card finds that card.
export function itemMatchesCanonicalKey(item, key) {
  if (item.canonicalKey === key) return true;
  const links = Array.isArray(item.links) ? item.links : [];
  return links.some((l) => l && l.url && canonicalKey(classify(l.url), l.url) === key);
}

function classify(raw) {
  const text = raw.trim();
  const urlMatch = text.match(/https?:\/\/[^\s]+/);
  if (!urlMatch) return { type: "note", url: null, host: null, videoId: null };
  const url = urlMatch[0];
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch (e) {
    return { type: "note", url: null, host: null, videoId: null };
  }
  const ytId = getYouTubeId(url);
  if (ytId) return { type: "video", url, host, videoId: ytId };
  if (/(^|\.)(twitter\.com|x\.com)$/.test(host))
    return { type: "tweet", url, host, videoId: null };
  if (/(^|\.)(youtube\.com|youtu\.be|tiktok\.com|vimeo\.com)$/.test(host))
    return { type: "video", url, host, videoId: null };
  if (/(^|\.)(spotify\.com|soundcloud\.com|music\.apple\.com)$/.test(host))
    return { type: "audio", url, host, videoId: null };
  if (/(^|\.)reddit\.com$/.test(host) || /(^|\.)redd\.it$/.test(host))
    return { type: "reddit", url, host, videoId: null };
  if (/(^|\.)imgur\.com$/.test(host))
    return { type: "article", url, host, videoId: null, imageHost: "imgur" };
  return { type: "article", url, host, videoId: null };
}

function canonicalKey(parsed, rawText) {
  if (!parsed.url) {
    return "note:" + rawText.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 80);
  }
  const url = parsed.url;
  const ytId = getYouTubeId(url);
  if (ytId) return "youtube:" + ytId;
  let u = null;
  try {
    u = new URL(url);
  } catch (e) {
    return "article:" + url.toLowerCase();
  }
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  const path = u.pathname.replace(/\/+$/, "");
  const weidianId = weidianItemId(url);
  if (weidianId) return "weidian:" + weidianId;
  const yupoo = yupooAlbumIdentity(url);
  if (yupoo) return "yupoo:" + yupoo.account + ":" + yupoo.albumId;
  if (/(^|\.)(twitter\.com|x\.com)$/.test(host)) {
    const st = path.match(/\/[^/]+\/status(?:es)?\/(\d+)/);
    return "x:" + (st ? st[1] : path.toLowerCase());
  }
  if (/(^|\.)tiktok\.com$/.test(host)) {
    const v = path.match(/\/video\/(\d+)/) || path.match(/\/t\/([\w]+)/);
    return "tiktok:" + (v ? v[1] : path.toLowerCase());
  }
  if (/(^|\.)spotify\.com$/.test(host)) {
    const sp = path.match(/\/(track|episode|show|album|playlist|artist)\/([\w]+)/);
    return "spotify:" + (sp ? sp[1] + "/" + sp[2] : path.toLowerCase());
  }
  if (/(^|\.)reddit\.com$/.test(host)) {
    const rp = path.match(/\/r\/[^/]+\/comments\/([a-z0-9]+)/i);
    return "reddit:" + (rp ? rp[1] : host + path.toLowerCase());
  }
  if (/(^|\.)redd\.it$/.test(host)) {
    const m = path.match(/^\/([a-z0-9]+)/i);
    return "reddit:" + (m ? m[1] : host + path.toLowerCase());
  }
  const kept = [];
  u.searchParams.forEach((val, k) => {
    if (!TRACKING_PARAM_RE.test(k)) kept.push(k + "=" + val);
  });
  return "article:" + host + path.toLowerCase() + (kept.length ? "?" + kept.sort().join("&") : "");
}

// ═══════════════════════════════════════════════════════════════════════════════════
// ═══ LOCAL INTELLIGENCE ═══
// Capture never depends on AI. These produce a usable title, summary, and tags
// instantly and locally; the optional AI adapter may later improve them.
// ═══════════════════════════════════════════════════════════════════════════════════

const STOPWORDS = new Set(
  "the a an and or but for with from this that these those what when where how why your you our its his her they them was were are is be been i we of in on at to it as by not no so if do did save saved about remember show find watch video status shorts index html www com".split(" ")
);

function prettifySlug(seg) {
  const s = decodeURIComponent(seg || "")
    .replace(/\.\w{2,5}$/, "")
    .replace(/[-_+.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!s || /^\d+$/.test(s)) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function firstLine(text) {
  // First line with a letter in it — skips decorative rules ("────", "***")
  // and quote gutters so a copied terminal block titles by its first words.
  const line = (text || "").split(/\n/).find((l) => /[a-z]/i.test(l));
  return (line || text || "").trim().replace(/^[❯›>*#\-–—|\s]+/, "");
}

export function localTitle(parsed, rawText) {
  if (parsed.type === "note") {
    const line = firstLine(rawText);
    return line.length > 64 ? line.slice(0, 61).trimEnd() + "…" : line;
  }
  const url = parsed.url || "";
  const host = parsed.host || "";
  if (parsed.videoId || /(^|\.)(youtube\.com|youtu\.be)$/.test(host)) return "YouTube video";
  if (/(^|\.)(twitter\.com|x\.com)$/.test(host)) {
    const m = url.match(/(?:twitter|x)\.com\/([^/?#]+)\/status/);
    return m ? "Post by @" + m[1] : "Post on X";
  }
  if (/(^|\.)tiktok\.com$/.test(host)) {
    const m = url.match(/tiktok\.com\/@([^/?#]+)/);
    return m ? "TikTok from @" + m[1] : "TikTok video";
  }
  if (/(^|\.)spotify\.com$/.test(host)) {
    const m = url.match(/spotify\.com\/(track|episode|show|album|playlist|artist)/);
    return m ? "Spotify " + m[1] : "On Spotify";
  }
  // Yupoo: prefer album/item codes over the generic path segment "Albums".
  if (/(^|\.)yupoo\.com$/.test(host)) {
    try {
      const u = new URL(url);
      const album = u.pathname.match(/\/albums\/(\d+)/i);
      const photos = u.pathname.match(/\/photos\/([^/?#]+)/i);
      // x.yupoo.com / www.yupoo.com are the generic photo hosts — the seller
      // lives in the /photos/<seller>/ path, not the subdomain (2026-07-25:
      // cards titled "x · 12345678"). seller.x.yupoo.com keeps the seller in
      // the subdomain.
      let account = "";
      const subx = host.match(/^([^.]+)\.x\.yupoo\.com$/i);
      const sub = host.match(/^([^.]+)\.yupoo\.com$/i);
      if (subx) account = subx[1];
      else if (sub && !/^(x|www)$/i.test(sub[1])) account = sub[1];
      if (!account && photos) account = decodeURIComponent(photos[1]);
      if (album) {
        // Placeholder until enrichment fills the real album/batch title.
        return account ? account + " · " + album[1] : "Album " + album[1];
      }
      if (account) return account;
    } catch (e) {}
  }
  // Weidian/Taobao item pages carry the id in the query — name it instead of
  // falling through to the bare host ("weidian.com" cards, 2026-07-25).
  if (/(^|\.)weidian\.com$/i.test(host)) {
    try {
      const id = new URL(url).searchParams.get("itemID");
      if (id) return "Weidian item " + id;
    } catch (e) {}
  }
  if (/(^|\.)(taobao\.com|tb\.cn)$/i.test(host)) {
    try {
      const id = new URL(url).searchParams.get("id");
      if (id) return "Taobao item " + id;
    } catch (e) {}
  }
  try {
    const path = new URL(url).pathname.replace(/\/+$/, "");
    const segs = path.split("/").filter(Boolean);
    for (let i = segs.length - 1; i >= 0; i--) {
      const t = prettifySlug(segs[i]);
      // Skip generic marketplace path crumbs that used to become the whole title.
      if (!t || t.length <= 3) continue;
      if (/^(albums?|album|collections?|categories?|items?|products?|shops?|stores?)$/i.test(t)) continue;
      return t.length > 72 ? t.slice(0, 69).trimEnd() + "…" : t;
    }
  } catch (e) {}
  return host || "Saved link";
}

// Best display title from Yupoo/Weidian enrichment payloads. Prefer human
// product labels over pure batch codes when both exist.
function fashionDisplayTitle(data) {
  if (!data || typeof data !== "object") return "";
  const candidates = [data.translatedTitle, data.productTitle, data.title, data.sourceTitle, data.batch];
  for (const raw of candidates) {
    const t = String(raw || "").trim();
    if (!t) continue;
    // Strip leading currency markers like "￥209 M29855-51E" → keep the code,
    // but if there's real words after price keep the words.
    const noPrice = t.replace(/^[￥¥$€£]\s*[\d.,]+\s*/u, "").trim();
    if (noPrice) return noPrice.length > 72 ? noPrice.slice(0, 69).trimEnd() + "…" : noPrice;
  }
  return "";
}

// Store homepage for a Yupoo seller (or generic host fallback).
function sellerStoreUrl(item) {
  if (!item) return null;
  const account = String(item.sellerAccount || "").trim();
  if (account) return "https://" + account + ".x.yupoo.com/";
  const album = yupooAlbumUrl(item);
  if (album) {
    try {
      const u = new URL(album);
      return u.origin + "/";
    } catch (e) {}
  }
  if (item.url) {
    try {
      const u = new URL(item.url);
      if (/(^|\.)yupoo\.com$/i.test(u.hostname)) return u.origin + "/";
    } catch (e) {}
  }
  return null;
}

function localSummary(parsed, rawText) {
  if (parsed.type === "note") {
    const rest = rawText.slice(firstLine(rawText).length).trim();
    return rest ? (rest.length > 140 ? rest.slice(0, 137).trimEnd() + "…" : rest) : "";
  }
  return parsed.host ? "Saved from " + parsed.host + "." : "";
}

function keywordTags(text, max) {
  const counts = {};
  (text.toLowerCase().match(/[a-z][a-z']{3,}/g) || []).forEach((w) => {
    if (!STOPWORDS.has(w)) counts[w] = (counts[w] || 0) + 1;
  });
  return Object.keys(counts)
    .sort((a, b) => counts[b] - counts[a])
    .slice(0, max);
}

function localTags(parsed, rawText) {
  const tags = [];
  if (parsed.host) {
    const root = parsed.host.split(".").slice(0, -1).join(".") || parsed.host;
    tags.push(root.replace(/\./g, " "));
  }
  const source =
    parsed.type === "note"
      ? rawText
      : (() => {
          try {
            return decodeURIComponent(new URL(parsed.url).pathname).replace(/[-_/+]+/g, " ");
          } catch (e) {
            return "";
          }
        })();
  keywordTags(source, 2).forEach((t) => {
    if (!tags.includes(t)) tags.push(t);
  });
  return tags.slice(0, 3);
}

function localEnrich(parsed, rawText) {
  return {
    title: localTitle(parsed, rawText),
    summary: localSummary(parsed, rawText),
    tags: localTags(parsed, rawText),
  };
}

// Card-back extraction: local heuristics for intent, project, people, use case,
// importance. Never blocks the note itself.
function extractIntentLocal(note) {
  const text = (note || "").trim();
  const out = { extractedIntent: "", project: "", people: [], useCase: "", importance: null };
  if (!text) return out;

  if (/\b(important|critical|must|need to|deadline|asap|urgent)\b|!!/i.test(text))
    out.importance = "high";
  else if (/\b(someday|maybe|eventually|idle|casual|no rush)\b/i.test(text))
    out.importance = "low";

  const projMatch =
    text.match(/\bfor (?:the )?([\w\s-]{2,30}?)\s*(?:project|app|site|talk|post|set)\b/i) ||
    text.match(/\bproject:\s*([\w\s-]{2,30})/i);
  if (projMatch) out.project = projMatch[1].trim();

  const handles = text.match(/@[\w]+/g) || [];
  const common = new Set(["The", "This", "That", "These", "Those", "It", "A", "An", "I", "We", "They", "He", "She"]);
  const people = [];
  const capRe = /(?:^|[.!?]\s+|\s)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g;
  let m;
  let firstWord = true;
  while ((m = capRe.exec(text)) !== null) {
    let cand = m[1];
    const startsSentence =
      firstWord || /[.!?]\s+$/.test(text.slice(0, m.index + m[0].length - cand.length));
    firstWord = false;
    if (startsSentence) {
      cand = cand.split(" ").slice(1).join(" ");
      if (!cand) continue;
    }
    if (common.has(cand)) continue;
    if (!people.includes(cand)) people.push(cand);
  }
  out.people = [...handles, ...people].slice(0, 3);

  const useMatch = text.match(/\b(to|so I can|when I)\s+([^.,;]{3,60})/i);
  if (useMatch) out.useCase = (useMatch[1] + " " + useMatch[2]).trim();

  const sentence = (text.split(/(?<=[.!?])\s+/)[0] || text).trim();
  out.extractedIntent = sentence.slice(0, 100);
  return out;
}

// Local digest copy: plain, warm, no AI required.
function localDigestCopy(picks, gem, weekCount, now) {
  const intro =
    weekCount > 0
      ? weekCount + " new " + (weekCount === 1 ? "thing" : "things") + " stashed this week."
      : "A quiet week on the shelf — a few older cards deserve attention.";
  const reasons = {};
  picks.forEach((it) => {
    if (it.note) {
      reasons[it.id] =
        'You wrote: "' + (it.note.length > 110 ? it.note.slice(0, 107) + "…" : it.note) + '"';
    } else if (!it.lastOpenedAt) {
      const days = Math.max(1, Math.floor((now - it.createdAt) / DAY_MS));
      reasons[it.id] =
        "Saved " + (days === 1 ? "yesterday" : days + " days ago") + " and never opened.";
    } else if (it.importance === "high") {
      reasons[it.id] = "You marked this one important.";
    } else {
      reasons[it.id] = it.summary || "Worth a second look.";
    }
  });
  let gemReason = "";
  if (gem) {
    const days = Math.floor((now - gem.createdAt) / DAY_MS);
    gemReason = gem.note
      ? 'From ' + days + ' days back. You wrote: "' + gem.note.slice(0, 90) + '"'
      : "Stashed " + days + " days ago — still worth a look.";
  }
  return { intro, reasons, gemReason };
}

// ═══════════════════════════════════════════════════════════════════════════════════
// ═══ STORAGE ADAPTER ═══
// window.storage when available (artifact env), localStorage otherwise. Swap this
// object for a backend client later; nothing else changes.
// ═══════════════════════════════════════════════════════════════════════════════════

const STORE_KEY = "credenza-fashion-items-v1";
const V2_KEY = "credenza-items-v1";

// When a host storage shim exists (the extension), it IS the backend — failed
// reads and writes must surface instead of silently splitting or emptying the shelf.
const storageBackend = createStorageBackend();

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ————— Image compression: any pasted/dropped/fetched image → tiny data URL —————
// Thumbnails live inside the item JSON, so the budget is tight: ~640px long edge,
// WebP (JPEG fallback), quality stepped down until the blob is ≤ ~24KB (≈32KB as
// base64). Hard cap 40KB — beyond that the image is rejected rather than looping.
const IMAGE_MAX_INPUT_BYTES = 15 * 1024 * 1024;
const IMAGE_TARGET_BYTES = 24 * 1024;
const IMAGE_HARD_CAP_BYTES = 40 * 1024;

async function decodeImage(blob) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(blob);
    } catch (e) {}
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("undecodable image"));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function compressImageBlob(blob) {
  if (!blob || !/^image\//.test(blob.type || "")) throw new Error("not an image");
  if (blob.size > IMAGE_MAX_INPUT_BYTES) throw new Error("image too large");
  const src = await decodeImage(blob);
  const w = src.width || src.naturalWidth;
  const h = src.height || src.naturalHeight;
  if (!w || !h) throw new Error("undecodable image");
  let longEdge = 640;
  let out = null;
  for (let pass = 0; pass < 3 && !out; pass++) {
    const scale = Math.min(1, longEdge / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    canvas.getContext("2d").drawImage(src, 0, 0, canvas.width, canvas.height);
    for (const type of ["image/webp", "image/jpeg"]) {
      for (const q of [0.75, 0.6, 0.45, 0.3]) {
        const b = await canvasToBlob(canvas, type, q);
        if (!b || b.type !== type) break; // encoder unsupported → next type
        if (b.size <= IMAGE_TARGET_BYTES) {
          out = b;
          break;
        }
        if (q === 0.3 && b.size <= IMAGE_HARD_CAP_BYTES) out = b;
      }
      if (out) break;
    }
    longEdge = Math.round(longEdge * 0.65); // still too big → shrink and retry
  }
  if (src.close) src.close();
  if (!out) throw new Error("couldn't compress image");
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(new Error("read failed"));
    fr.readAsDataURL(out);
  });
}

function clipboardImageFile(e) {
  const items = (e.clipboardData && e.clipboardData.items) || [];
  for (const it of items) {
    if (it.kind === "file" && /^image\//.test(it.type)) return it.getAsFile();
  }
  return null;
}

// Clipboard-detected capture bar (design handoff PR3): describe what the
// clipboard holds so the bottom bar can show "CLIPBOARD · {platform} / {host}"
// before any tap. Link pastes get a platform dot + host; plain text gets a
// Note preview of the first line. null = nothing usable on the clipboard.
const CLIP_PLATFORMS = [
  [/weidian/i, "Weidian", "#ff5a3c"],
  [/yupoo/i, "Yupoo", "#37b24d"],
  [/taobao|tmall/i, "Taobao", "#ff6a00"],
  [/1688/i, "1688", "#ff9406"],
  [/reddit/i, "Reddit", "#ff4500"],
  [/superbuy/i, "Superbuy", "#5b8def"],
  [/sugargoo/i, "Sugargoo", "#f7b500"],
  [/kakobuy/i, "Kakobuy", "#8a5cf6"],
];
function clipboardPreviewFor(raw) {
  // Repair space-broken URLs first — an obfuscated link otherwise shows as
  // "Link link on your clipboard / de" (Kyle 2026-07-23).
  const text = deobfuscateUrls(raw || "").trim();
  if (!text) return null;
  const m = /https?:\/\/[^\s]+/i.exec(text);
  let host = "";
  if (m) {
    try {
      host = new URL(m[0]).hostname.replace(/^www\./, "");
    } catch {
      host = "";
    }
  }
  if (!host) {
    const first = text.split("\n")[0].trim();
    if (!first) return null;
    return {
      text,
      platform: "Note",
      host: first.length > 42 ? first.slice(0, 42) + "…" : first,
      dot: "var(--cz-faint)",
    };
  }
  const hit = CLIP_PLATFORMS.find(([re]) => re.test(host));
  return {
    text,
    platform: hit ? hit[1] : "Link",
    host,
    dot: hit ? hit[2] : "var(--cz-faint)",
  };
}

// Item factory. Local enrichment happens at creation — the card is usable instantly.
// `extra` overrides fields (import title hints, sample data, sourceImport, ages).
// Fields marked [backend] are where future server columns go (userId, syncedAt, …).
function createItem(parsed, rawText, extra) {
  const now = Date.now();
  const enriched = localEnrich(parsed, rawText);
  const base = {
    id: makeId(),
    createdAt: now,
    updatedAt: now,
    rawText,
    url: parsed.url || null,
    canonicalKey: canonicalKey(parsed, rawText),
    type: parsed.type,
    host: parsed.host || null,
    videoId: parsed.videoId || null,
    title: enriched.title,
    summary: enriched.summary,
    tags: enriched.tags,
    image: null,
    gallery: [],
    links: pairedLinksFromRawText(rawText, parsed.url),
    status: "ready",
    note: "",
    extractedIntent: "",
    project: "",
    people: [],
    useCase: "",
    importance: "medium",
    findStatus: "want",
    price: null,
    currency: "CNY",
    priceUsd: null,
    category: "",
    variants: [],
    sizeNotes: "",
    seller: "",
    batch: "",
    size: "",
    posterSize: "",
    recommendedSize: "",
    colorway: "",
    agentLink: "",
    findSource: parsed.type === "reddit" ? parsed.url || "" : "",
    lastOpenedAt: null,
    openCount: 0,
    resurfacedCount: 0,
    lastResurfacedAt: null,
    dismissedAt: null,
    digestCount: 0,
    lastDigestAt: null,
    sourceImport: null,
    sourceTitle: "",
    albumId: "",
    sellerAccount: "",
    weightGrams: null,
    qcPhotos: [],
    qcNote: "",
    qcVerdictAt: null,
    posterStats: null,
    posterUser: "",
    sourceText: "",
    error: null,
    favorite: false,
  };
  return extra ? { ...base, ...extra } : base;
}

// Paired-links migration. Field presence is the "already migrated" marker: an item
// carrying links (even []) is left alone, so a deliberately removed link doesn't
// resurrect from the note on next load. Legacy items infer links from rawText and
// additionally lift a buy URL out of the note (note text itself stays untouched).
function migrateLinks(old, primaryUrl, rawText) {
  const links = Array.isArray(old.links) ? [...old.links] : pairedLinksFromRawText(rawText, primaryUrl);
  if (!Array.isArray(old.links)) {
    for (const url of extractUrls(old.note || "")) {
      if (inferLinkRole(url) === "buy") links.push({ url, role: "buy" });
    }
  }
  if (typeof old.weidianUrl === "string" && old.weidianUrl) {
    links.push({ url: old.weidianUrl, role: "buy", label: "Weidian" });
  }
  return normalizeLinks(links, primaryUrl);
}

// Upgrades any stored shape (v2 or earlier v3) to the current model. In localOnly
// mode nothing may sit in "raw" / "enriching" / "failed" — local enrichment makes
// every item usable immediately.
export function migrateItem(old) {
  const createdAt = old.createdAt || old.ts || Date.now();
  const rawText = old.rawText != null ? old.rawText : old.text != null ? old.text : old.url || old.title || "";
  const parsed = {
    type: old.type || "note",
    url: old.url || null,
    host: old.host || null,
    videoId: old.videoId || null,
  };
  const migratedKey = canonicalKey(parsed, rawText);
  const item = {
    id: old.id || makeId(),
    createdAt,
    updatedAt: old.updatedAt || createdAt,
    rawText,
    url: parsed.url,
    canonicalKey: /^(yupoo|weidian):/.test(migratedKey) ? migratedKey : old.canonicalKey || migratedKey,
    type: parsed.type,
    host: parsed.host,
    videoId: parsed.videoId,
    title: old.title || "",
    summary: old.summary || "",
    tags: Array.isArray(old.tags) ? old.tags : [],
    image:
      typeof old.image === "string" && (old.image.startsWith("data:image/") || /^https?:\/\//i.test(old.image))
        ? old.image
        : null,
    gallery: Array.isArray(old.gallery)
      ? old.gallery.filter((g) => typeof g === "string" && (g.startsWith("data:image/") || /^https?:\/\//i.test(g)))
      : [],
    links: migrateLinks(old, parsed.url, rawText),
    status: "ready",
    note: old.note || "",
    extractedIntent: old.extractedIntent || "",
    project: old.project || "",
    people: Array.isArray(old.people) ? old.people : [],
    useCase: old.useCase || "",
    importance: old.importance === "high" || old.importance === "low" ? old.importance : "medium",
    findStatus: ["want", "bought", "shipped", "qc", "gl", "rl", "returned"].includes(old.findStatus) ? old.findStatus : "want",
    price: typeof old.price === "number" && !isNaN(old.price) ? old.price : null,
    currency: old.currency || "CNY",
    priceUsd: typeof old.priceUsd === "number" && !isNaN(old.priceUsd) ? old.priceUsd : null,
    category: CATEGORIES[old.category]
      ? old.category
      : guessFashionCategory(
          [old.title, old.summary, old.sizeNotes, old.batch, old.rawText, old.note].filter(Boolean).join(" ")
        ),
    variants: Array.isArray(old.variants)
      ? old.variants.filter((g) => g && typeof g.title === "string" && Array.isArray(g.values))
      : [],
    sizeNotes: typeof old.sizeNotes === "string" ? old.sizeNotes : "",
    seller: old.seller || "",
    batch: old.batch || "",
    size: old.size || "",
    posterSize: old.posterSize || "",
    recommendedSize: old.recommendedSize || "",
    colorway: old.colorway || "",
    agentLink: old.agentLink || "",
    findSource: old.findSource || "",
    lastOpenedAt: old.lastOpenedAt || null,
    openCount: old.openCount || 0,
    resurfacedCount: old.resurfacedCount || 0,
    lastResurfacedAt: old.lastResurfacedAt || null,
    dismissedAt: old.dismissedAt || null,
    digestCount: old.digestCount || 0,
    lastDigestAt: old.lastDigestAt || null,
    sourceImport: old.sourceImport || null,
    sourceTitle: old.sourceTitle || "",
    albumId: old.albumId || "",
    sellerAccount: old.sellerAccount || "",
    // A6: per-item ship-weight override (grams). Same validation as the edit
    // form — positive finite number or null.
    weightGrams:
      typeof old.weightGrams === "number" && isFinite(old.weightGrams) && old.weightGrams > 0
        ? Math.round(old.weightGrams)
        : null,
    // A5: Warehouse QC — photos get the same data-URL/HTTPS gate as gallery,
    // verdict stamp is an ISO string, note is free text.
    qcPhotos: Array.isArray(old.qcPhotos)
      ? old.qcPhotos.filter((g) => typeof g === "string" && (g.startsWith("data:image/") || /^https?:\/\//i.test(g))).slice(0, 12)
      : [],
    qcNote: typeof old.qcNote === "string" ? old.qcNote : "",
    qcVerdictAt: typeof old.qcVerdictAt === "string" ? old.qcVerdictAt : null,
    // A1 poster data (audit 2026-07-24): the Reddit poster's body stats drive
    // the size decision, and the original paste lets a later parser reparse
    // the haul. Both used to vanish on reload.
    posterStats:
      old.posterStats && typeof old.posterStats === "object" && !Array.isArray(old.posterStats)
        ? old.posterStats
        : null,
    posterUser: typeof old.posterUser === "string" ? old.posterUser : "",
    sourceText: typeof old.sourceText === "string" ? old.sourceText : "",
    error: null,
    favorite: old.favorite === true,
  };
  const wasUnready = old.pending || (old.status && old.status !== "ready");
  if (!item.title || wasUnready) {
    const local = localEnrich(parsed, rawText);
    if (!item.title || item.title === item.url) item.title = local.title;
    if (!item.summary) item.summary = local.summary;
    if (!item.tags.length) item.tags = local.tags;
  }
  return item;
}

// Hydration merge (audit 2026-07-24): a stash that lands while storage is
// still loading must survive the load resolving. Keep any in-memory item the
// stored list does not have — those were created during the load window —
// ahead of the stored order. Duplicates by id keep the stored copy.
export function mergeLoadedItems(loaded, current) {
  const loadedIds = new Set(loaded.map((x) => x.id));
  const duringLoad = current.filter((x) => !loadedIds.has(x.id));
  return duringLoad.length ? [...duringLoad, ...loaded] : loaded;
}


// ═══════════════════════════════════════════════════════════════════════════════════
// ═══ IMPORT & SAMPLE DATA ═══
// Fashion-first: paste Yupoo / Weidian / Reddit haul links, or restore a Credenza
// shelf backup. Parsers still accept generic link dumps silently — no third-party
// save-app branding (Raindrop / Pocket / browser bookmarks) in the UI.
// ═══════════════════════════════════════════════════════════════════════════════════

export const SAMPLE_COUNT = 18;

// Quiet labels for the import preview line only (never shown as provider marketing).
export const PROVIDER_LABELS = {
  pocket: "link list",
  raindrop: "link list",
  bookmarks: "link list",
  html: "link list",
  csv: "link list",
  json: "JSON list",
  paste: "pasted links",
  "reddit-haul": "Reddit haul",
};

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== "")) rows.push(row);
  return rows;
}

// Epoch seconds, epoch ms, or a date string → ms (null if unreadable).
function toEpochMs(v) {
  if (!v) return null;
  const n = Number(v);
  if (Number.isFinite(n) && n > 1e8) return n < 1e12 ? n * 1000 : n;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

export function parseImport(text, opts = {}) {
  const candidates = [];
  const seen = new Set();
  const push = (parsed, rawText, titleHint, meta) => {
    if (!rawText || !rawText.trim()) return;
    const key = canonicalKey(parsed, rawText);
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({
      parsed,
      rawText,
      titleHint: (titleHint || "").trim(),
      key,
      ...(meta || {}),
    });
  };
  const attr = (s, name) => {
    const m2 = s.match(new RegExp(name + '\\s*=\\s*"([^"]*)"', "i"));
    return m2 ? m2[1] : "";
  };

  const trimmed = text.trim();

  // 1. Pasted JSON arrays of {url, title, …}. (Full Credenza backups restore via file.)
  if (trimmed.startsWith("[")) {
    try {
      const arr = JSON.parse(trimmed);
      if (Array.isArray(arr)) {
        for (const o of arr) {
          if (!o || typeof o !== "object") continue;
          const raw = String(o.url || o.link || o.href || o.text || o.title || "");
          if (!raw.trim()) continue;
          push(classify(raw), raw, o.title ? String(o.title) : "", {
            createdAt: toEpochMs(o.createdAt || o.created || o.time_added || o.date),
            tags: Array.isArray(o.tags) ? o.tags.map(String) : undefined,
            note: o.note ? String(o.note) : undefined,
          });
        }
        return { candidates, provider: "json" };
      }
    } catch (e) {}
  }

  // 2. Anchor exports: Pocket HTML carries time_added, browser bookmarks ADD_DATE.
  const anchorRe = /<a\s+([^>]*)>([^<]*)<\/a>/gi;
  let m;
  let hadAnchors = false;
  let sawPocket = false;
  let sawBookmarks = false;
  while ((m = anchorRe.exec(text)) !== null) {
    const attrs = m[1];
    const href = attr(attrs, "href");
    if (!/^https?:\/\//i.test(href)) continue;
    hadAnchors = true;
    if (attr(attrs, "time_added")) sawPocket = true;
    if (attr(attrs, "add_date")) sawBookmarks = true;
    const tagStr = attr(attrs, "tags");
    push(classify(href), href, m[2], {
      createdAt: toEpochMs(attr(attrs, "time_added") || attr(attrs, "add_date")),
      tags: tagStr
        ? tagStr.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 5)
        : undefined,
    });
  }
  if (hadAnchors)
    return { candidates, provider: sawPocket ? "pocket" : sawBookmarks ? "bookmarks" : "html" };

  // 3. CSV with a url column: Raindrop exports and any spreadsheet.
  if (/\burl\b/i.test(trimmed.split("\n")[0] || "") && trimmed.includes(",")) {
    const rows = parseCSV(trimmed);
    if (rows.length > 1) {
      const header = rows[0].map((h) => h.trim().toLowerCase());
      const col = (name) => header.indexOf(name);
      const iUrl = col("url") !== -1 ? col("url") : col("link");
      if (iUrl !== -1) {
        const isRaindrop = col("excerpt") !== -1 || col("folder") !== -1 || col("cover") !== -1;
        const iTitle = col("title");
        const iNote = col("note");
        const iTags = col("tags");
        const iCreated = col("created") !== -1 ? col("created") : col("date");
        const iFolder = col("folder");
        for (const r of rows.slice(1)) {
          const url = (r[iUrl] || "").trim();
          if (!/^https?:\/\//i.test(url)) continue;
          const tags = [];
          if (iTags !== -1 && r[iTags])
            tags.push(...r[iTags].split(/[,;]/).map((t) => t.trim().toLowerCase()).filter(Boolean));
          if (iFolder !== -1 && r[iFolder] && r[iFolder].trim().toLowerCase() !== "unsorted")
            tags.push(r[iFolder].trim().toLowerCase());
          push(classify(url), url, iTitle !== -1 ? r[iTitle] : "", {
            createdAt: iCreated !== -1 ? toEpochMs(r[iCreated]) : null,
            tags: tags.length ? tags.slice(0, 5) : undefined,
            note: iNote !== -1 && r[iNote] ? r[iNote].trim() : undefined,
          });
        }
        return { candidates, provider: isRaindrop ? "raindrop" : "csv" };
      }
    }
  }

  // 3.5. Reddit haul pastes (A1): stats block, markdown links, W2C tables,
  // review snippets. Conservative — returns null unless it's haul-shaped, in
  // which case it owns the paste (richer labels/notes than the generic path).
  // A fetched post passes its title + provenance through: single-link QC posts
  // are the most common FashionReps shape (2026-07-24 corpus).
  const haul = parseRedditHaul(text, {
    title: opts.redditTitle || "",
    fromPost: !!opts.redditTitle,
  });
  if (haul) {
    const stats = Object.keys(haul.stats).length ? haul.stats : undefined;
    for (const it of haul.items) {
      push(classify(it.url), it.rawLine, it.label, {
        note: it.note || undefined,
        tags: it.category ? [it.category] : undefined,
        posterStats: stats,
        posterUser: haul.poster || undefined,
        findSource: haul.sourceUrl || undefined,
        // Keep the original paste (capped) so a later, smarter parser can
        // reparse this haul without asking the user to paste again.
        sourceText: trimmed.length <= 12000 ? trimmed : trimmed.slice(0, 12000),
      });
    }
    return { candidates, provider: "reddit-haul", posterStats: stats, poster: haul.poster };
  }

  // 4. Messy lines: one per line, prose with links inside, plain notes.
  // Kyle 2026-07-23: a URL-free paste with no list markers is ONE wrapped
  // note (a copied paragraph, a terminal quote block) — the per-line split
  // shredded raw prose into fragment cards ("Raw text, yes, but is t…").
  const importLines = text.split(/\n+/);
  const hasAnyUrl = /https?:\/\//.test(text);
  const bulletLines = importLines.filter((l) =>
    /^\s*(?:[-*•❯›]|\d+[.)])\s+\S/.test(l)
  ).length;
  if (!hasAnyUrl && bulletLines < 2) {
    if (trimmed.length >= 3) push(classify(trimmed), trimmed, "");
    return { candidates, provider: "paste" };
  }
  for (const lineRaw of importLines) {
    const isBullet = /^\s*(?:[-*•❯›]|\d+[.)])\s+\S/.test(lineRaw);
    const line = lineRaw.replace(/^[\s\-*•>”"]*(?:\d+[.)])?\s*/, "").trim();
    if (!line || line.length < 3) continue;
    const urls = line.match(/https?:\/\/[^\s<>"')\]]+/g) || [];
    if (urls.length === 0) {
      // A bare line becomes a card ONLY when it carries a list marker — that
      // is a real list the user wrote. Unmarked bare lines in a shredded
      // paste are page chrome ("Open chat", "Upvote", "Expand user menu")
      // and must never become cards (Kyle 2026-07-24: one copied Reddit
      // page turned into 174 junk cards).
      if (isBullet && line.length >= 8 && /[a-z]/i.test(line)) push(classify(line), line, "");
      continue;
    }
    const label = line
      .replace(/https?:\/\/[^\s<>"')\]]+/g, " ")
      .replace(/[|–—:,]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    // One line = one item. The first URL is primary; the rest become paired links
    // via createItem's rawText inference (yupoo photos + weidian buy stay together).
    const parsed = classify(urls[0]);
    if (parsed.url) push(parsed, line, label.length > 2 ? label : "");
  }
  return { candidates, provider: "paste" };
}

// Splits candidates into fresh items and duplicates already on the shelf. Local
// enrichment only — imported cards are ready instantly, no AI involved.
function buildImportItems(candidates, existing, source) {
  const fresh = [];
  const duplicates = [];
  let dupes = 0;
  for (const c of candidates) {
    const duplicate = existing.find((x) => itemMatchesCanonicalKey(x, c.key));
    if (duplicate) {
      dupes++;
      if (!duplicates.some((item) => item.id === duplicate.id)) duplicates.push(duplicate);
      continue;
    }
    const extra = { sourceImport: source };
    // Prefer the pasted label over the URL slug, unless the label is filler
    // ("check out …", "read this later") and the slug gives a real title.
    const fillerLabel = /^(check(\s+out)?|see|read|watch|look(\s+at)?|via|from|this|todo|later|sometime)\b/i.test(
      c.titleHint
    );
    const slugTitle = c.parsed.url ? localTitle(c.parsed, c.rawText) : "";
    const useHint = c.titleHint && !(fillerLabel && slugTitle.split(" ").length >= 2);
    if (useHint)
      extra.title =
        c.titleHint.length > 72 ? c.titleHint.slice(0, 69).trimEnd() + "…" : c.titleHint;
    // Original saved dates and tags survive the move — the review layer needs the
    // real history, not an import-day timestamp.
    if (c.createdAt && c.createdAt < Date.now()) {
      extra.createdAt = c.createdAt;
      extra.updatedAt = c.createdAt;
    }
    if (c.tags && c.tags.length) extra.tags = c.tags.slice(0, 5);
    if (c.note) extra.note = c.note.slice(0, 500);
    // A1: haul pastes carry poster stats (v1: on each batch item; A3 haul
    // objects will hoist these) and the source thread for provenance.
    if (c.posterStats) extra.posterStats = c.posterStats;
    if (c.posterUser) extra.posterUser = c.posterUser;
    if (c.sourceText) extra.sourceText = c.sourceText;
    if (c.findSource) extra.findSource = c.findSource;
    fresh.push(createItem(c.parsed, c.rawText, extra));
  }
  return { fresh, dupes, duplicates };
}

function buildSampleItems() {
  // One realistic haul (audit 2026-07-24): the samples teach the fashion
  // flow — capture from Weidian/Yupoo/Taobao/1688/Reddit, sizing with
  // variants and poster stats, the status pipeline, Warehouse QC, and Buy.
  const now = Date.now();
  const HAUL = "Winter rotation";
  const mk = (raw, extra, ageDays) =>
    createItem(classify(raw), raw, {
      project: HAUL,
      ...extra,
      sourceImport: "sample",
      createdAt: now - ageDays * DAY_MS,
      updatedAt: now - ageDays * DAY_MS,
    });
  return [
    mk(
      "https://weidian.com/item.html?itemID=7261398445",
      {
        title: "Heavy fleece hoodie — 480g",
        seller: "Listenup",
        price: 189,
        findStatus: "bought",
        category: "outerwear",
        size: "L",
        recommendedSize: "XL",
        variants: [{ title: "Size", values: ["M", "L", "XL"] }],
        sizeNotes: "Runs one size small. M: chest 116, L: 120, XL: 124.",
        posterStats: { height: "183cm", weight: "78kg", size: "XL" },
        posterUser: "winterpicks",
        note: "Poster is 183/78 and took XL. Size up once.",
      },
      21
    ),
    mk(
      "https://weidian.com/item.html?itemID=7288102331",
      {
        title: "Boxy blank tee — 260g cotton",
        seller: "Topbasics",
        price: 89,
        findStatus: "want",
        category: "shirt",
        variants: [{ title: "Size", values: ["S", "M", "L", "XL"] }],
      },
      20
    ),
    mk(
      "https://mook-official.x.yupoo.com/albums/244505824?uid=1",
      {
        title: "Retro runner — gum sole",
        seller: "Mook-official",
        sellerAccount: "mook-official",
        price: 320,
        findStatus: "qc",
        category: "shoes",
        size: "EU 43",
        variants: [{ title: "Size", values: ["EU 42", "EU 43", "EU 44"] }],
        qcNote: "Check the stitching on the left heel before GL.",
        note: "Agent photo album. QC pics came in day 3.",
      },
      19
    ),
    mk(
      "https://weidian.com/item.html?itemID=7244551890",
      {
        title: "Straight washed jeans",
        seller: "Denimwork",
        price: 158,
        findStatus: "bought",
        category: "pants",
        size: "32",
        weightGrams: 720,
        variants: [{ title: "Size", values: ["30", "31", "32", "33"] }],
      },
      18
    ),
    mk(
      "https://weidian.com/item.html?itemID=7220773466",
      {
        title: "Quilted liner jacket",
        seller: "Northerngoods",
        price: 299,
        findStatus: "gl",
        category: "outerwear",
        size: "L",
        qcVerdictAt: new Date(now - 2 * DAY_MS).toISOString(),
        qcNote: "Zips smooth, fill even. Cleared to ship.",
      },
      17
    ),
    mk(
      "https://item.taobao.com/item.htm?id=8412905763",
      {
        title: "Ribbed beanie — charcoal",
        price: 45,
        findStatus: "want",
        category: "hat",
      },
      16
    ),
    mk(
      "https://weidian.com/item.html?itemID=7299334477",
      {
        title: "Ripstop cargo pants",
        seller: "Fieldsupply",
        price: 176,
        findStatus: "shipped",
        category: "pants",
        size: "M",
        note: "Shipped with the November parcel.",
      },
      15
    ),
    mk(
      "https://detail.1688.com/offer/7335890124.html",
      {
        title: "Crew socks — 3 pack",
        price: 25,
        findStatus: "want",
        category: "socks",
      },
      14
    ),
    mk(
      "https://topstoney.x.yupoo.com/albums/198233445?uid=1",
      {
        title: "Low court sneaker — white",
        sellerAccount: "topstoney",
        price: 380,
        findStatus: "want",
        category: "shoes",
        note: "Compare batch with the review from r/FashionReps before GP.",
      },
      13
    ),
    mk(
      "https://weidian.com/item.html?itemID=7201445998",
      {
        title: "Loopwheeled crewneck",
        seller: "Loopwheelcn",
        price: 135,
        findStatus: "bought",
        category: "shirt",
        size: "M",
        recommendedSize: "L",
        sizeNotes: "Shrinks a little on first wash.",
        note: "Fits small — L after wash.",
      },
      12
    ),
    mk(
      "https://www.reddit.com/r/FashionReps/comments/1c9r2kx/winter_rotation_review/",
      {
        title: "Review: graphic tee batch B",
        price: 95,
        findStatus: "returned",
        category: "shirt",
        qcNote: "Print sat crooked — RL'd and exchanged.",
        qcVerdictAt: new Date(now - 9 * DAY_MS).toISOString(),
        findSource: "https://www.reddit.com/r/FashionReps/comments/1c9r2kx/winter_rotation_review/",
      },
      11
    ),
    mk(
      "https://weidian.com/item.html?itemID=7277662310",
      {
        title: "Nylon swim shorts",
        price: 79,
        findStatus: "want",
        category: "shorts",
      },
      10
    ),
    mk(
      "https://item.taobao.com/item.htm?id=8455112098",
      {
        title: "Canvas tote — natural",
        price: 68,
        findStatus: "bought",
        category: "bag",
      },
      9
    ),
    mk(
      "https://weidian.com/item.html?itemID=7233889045",
      {
        title: "Bridle leather belt",
        price: 55,
        findStatus: "want",
        category: "accessory",
      },
      8
    ),
    mk(
      "https://husky-reps.x.yupoo.com/albums/209911730?uid=1",
      {
        title: "Down puffer — matte black",
        sellerAccount: "husky-reps",
        price: 450,
        findStatus: "want",
        category: "outerwear",
        sizeNotes: "Fill: 90% down. Chart in album description.",
        note: "Wait for the December restock — current batch sold out of L.",
      },
      7
    ),
    mk(
      "https://weidian.com/item.html?itemID=7215007834",
      {
        title: "Wool 6-panel cap",
        price: 49,
        findStatus: "gl",
        category: "hat",
        qcVerdictAt: new Date(now - 4 * DAY_MS).toISOString(),
      },
      6
    ),
    mk(
      "https://item.taobao.com/item.htm?id=8499001245",
      {
        title: "Brushed scarf — oatmeal",
        price: 39,
        findStatus: "want",
        category: "accessory",
      },
      5
    ),
    mk(
      "https://weidian.com/item.html?itemID=7255550199",
      {
        title: "Mesh practice jersey",
        seller: "Courtclassic",
        price: 118,
        findStatus: "bought",
        category: "shirt",
        size: "M",
        posterSize: "M",
        posterStats: { height: "178cm", weight: "70kg", size: "M" },
        note: "Poster 178/70 wears M — TTS.",
      },
      4
    ),
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════════
// ═══ AI ADAPTER (OPTIONAL) ═══
// Dormant in localOnly mode: no fetch is ever attempted, so the UI can never show a
// broken or hanging state. In optionalAI/connected modes each call enhances a result
// that local intelligence already produced — failures simply leave the local version.
// ═══════════════════════════════════════════════════════════════════════════════════

function aiAvailable() {
  return AI_MODE !== "localOnly";
}

async function callClaude(prompt, { useSearch = false, maxTokens = 800 } = {}) {
  const body = {
    model: "claude-sonnet-4-6",
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  };
  if (useSearch) body.tools = [{ type: "web_search_20250305", name: "web_search" }];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  let res;
  try {
    res = await monitoredFetch(storageBackend, "anthropic", "https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error("HTTP " + res.status);
  const data = await res.json();
  if (!data || data.error || !Array.isArray(data.content)) throw new Error("Bad response");
  return data.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
}

function safeParseJson(text) {
  if (typeof text !== "string") return null;
  try {
    const clean = text.replace(/```json|```/g, "").trim();
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    return JSON.parse(clean.slice(start, end + 1));
  } catch (e) {
    return null;
  }
}

// Returns improved {title, summary, tags} or null. Caller keeps the local version
// on null — the card is already usable either way.
async function aiEnhanceItem(item) {
  if (!aiAvailable()) return null;
  try {
    const text = await callClaude(
      "Look up this saved link and describe it: " +
        (item.url || item.rawText) +
        '\nRespond ONLY with minified JSON: {"title":"short title","summary":"one crisp sentence","tags":["a","b","c"]}',
      { useSearch: !!item.url }
    );
    const parsed = safeParseJson(text);
    if (!parsed || !parsed.title) return null;
    return {
      title: String(parsed.title),
      summary: parsed.summary ? String(parsed.summary) : item.summary,
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 4).map(String) : item.tags,
    };
  } catch (e) {
    return null;
  }
}

async function aiExtractIntent(note) {
  if (!aiAvailable()) return null;
  try {
    const text = await callClaude(
      'From this personal note, extract intent. Note: """' +
        note +
        '"""\nRespond ONLY with minified JSON: {"extractedIntent":"...","project":"...","people":["..."],"useCase":"...","importance":"low|medium|high"}',
      { maxTokens: 300 }
    );
    return safeParseJson(text);
  } catch (e) {
    return null;
  }
}

function fashionImageIdentity(raw) {
  try {
    const url = new URL(raw);
    const parts = url.pathname.split("/").filter(Boolean);
    if (url.hostname.toLowerCase() === "photo.yupoo.com" && parts.length >= 2) {
      return (parts[0] + "/" + parts[1]).toLowerCase();
    }
    return (url.hostname + url.pathname)
      .replace(/\/(?:original|origin|raw|big|large2?|medium|small|thumb|tiny)(\.[a-z0-9]+)$/i, "/asset$1")
      .replace(/_(?:o|b|l|m|s|t)(\.[a-z0-9]+)$/i, "$1")
      .toLowerCase();
  } catch {
    return String(raw || "").toLowerCase();
  }
}

function mergeFashionImages(...groups) {
  const seen = new Set();
  const images = [];
  for (const group of groups) {
    for (const src of Array.isArray(group) ? group : []) {
      if (typeof src !== "string" || !src) continue;
      const key = fashionImageIdentity(src);
      if (seen.has(key)) continue;
      seen.add(key);
      images.push(src);
    }
  }
  return images;
}

function shouldReplaceFashionTitle(title, url) {
  const clean = String(title || "").trim();
  if (!clean || clean === url) return true;
  if (/^(albums?|article|read|untitled|saved link|item)$/i.test(clean)) return true;
  // Placeholder titles from localTitle for Yupoo album/store roots.
  if (/^[a-z0-9-]+\s·\s\d+$/i.test(clean)) return true;
  if (/^album\s+\d+$/i.test(clean)) return true;
  // Pure numeric album ids or short batch-looking codes alone are fine to keep
  // once enrichment has nothing better — only replace obvious path crumbs.
  return false;
}

function mergeFashionLinks(item, { albumUrl, buyUrl } = {}) {
  const links = [...(item.links || [])];
  if (albumUrl && albumUrl !== item.url) links.push({ url: albumUrl, role: "photos", label: "Yupoo" });
  if (buyUrl && buyUrl !== item.url) links.push({ url: buyUrl, role: "buy", label: "Weidian" });
  return normalizeLinks(links, item.url);
}

// Fetch structured Yupoo album data through the same-origin Netlify function.
async function fetchYupooImages(albumUrl, { signal } = {}) {
  if (!PREVIEW_SECRET) return null;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return null;
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal) {
    if (signal.aborted) return null;
    signal.addEventListener("abort", abort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await monitoredFetch(storageBackend, "yupoo", YUPOO_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", "x-credenza-key": PREVIEW_SECRET },
      body: JSON.stringify({ url: albumUrl }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !Array.isArray(data.images)) return null;
    return data;
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", abort);
  }
}

// Ask the vision function to read a size chart out of album PHOTOS — the
// common Yupoo case where the chart exists only as a picture (Kyle's "the
// chart is right there in the photos" report, 2026-07-22). Returns chart text
// in the same format parseSizeChart reads, or null when nothing was found.
// `referer` should be the album page URL: the photo CDN rejects requests
// whose referer is not a yupoo album page.
async function fetchChartFromPhotos(imageUrls, { signal, referer } = {}) {
  if (!PREVIEW_SECRET) return null;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return null;
  // Part 7e: a signed-in FREE user over the daily cap skips the cloud read;
  // the card keeps whatever local intelligence found (same as offline).
  if (overFreeLimit(planForLimits, "chartVision")) return null;
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal) {
    if (signal.aborted) return null;
    signal.addEventListener("abort", abort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await monitoredFetch(storageBackend, "chart-vision", CHART_VISION_ENDPOINT, {
      method: "POST",
      headers: await authHeaders({ "content-type": "application/json", "x-credenza-key": PREVIEW_SECRET }),
      body: JSON.stringify({ images: imageUrls, ...(referer ? { referer } : {}) }),
      signal: controller.signal,
    });
    bumpUsage("chartVision");
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.found || typeof data.chartText !== "string") return null;
    return data.chartText.trim() || null;
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", abort);
  }
}

// A lone Reddit post URL (incl. /s/ share links and redd.it short links) —
// the whole paste is just the URL. These auto-route to the haul path.
const REDDIT_POST_URL_RE =
  /^(?:https?:\/\/(?:(?:www|old|np|amp)\.)?reddit\.com\/r\/[\w-]+\/(?:comments|s)\/[^\s]+|https?:\/\/redd\.it\/[^\s]+)$/i;

// Ask the reddit function to resolve a post URL (share links included) and
// return its text for the haul parser. Returns the parsed body on success,
// { found: false, error } on a server-side failure, or null on network/auth
// trouble — callers always have a paste-text fallback to offer.
async function fetchRedditPost(url, { signal } = {}) {
  if (!PREVIEW_SECRET) return null;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return null;
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal) {
    if (signal.aborted) return null;
    signal.addEventListener("abort", abort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await monitoredFetch(storageBackend, "reddit", REDDIT_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", "x-credenza-key": PREVIEW_SECRET },
      body: JSON.stringify({ url }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { found: false, error: (data && data.error) || "Could not read that post" };
    return data;
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", abort);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════
// ═══ SCORING UTILITIES ═══
// ═══════════════════════════════════════════════════════════════════════════════════
function scoreDigestCandidate(item, now) {
  let s = 0;
  const age = now - item.createdAt;
  if (age < WEEK_MS) s += 3;
  else if (age < 2 * WEEK_MS) s += 1;
  if (item.note) s += 3;
  if (item.importance === "high") s += 2;
  if (item.importance === "low") s -= 1;
  if (item.project || item.useCase) s += 1;
  if (!item.lastOpenedAt) s += 2;
  s -= Math.min(4, 1.5 * (item.digestCount || 0));
  s += Math.random() - 0.5;
  return s;
}

function scoreForgottenGem(item, now) {
  let s = 0;
  if (item.note) s += 3;
  if (item.importance === "high") s += 2;
  if (!item.lastOpenedAt) s += 2;
  s -= Math.min(3, item.digestCount || 0);
  s += Math.random() - 0.5;
  return s;
}

function scoreResurfaceCandidate(item, now) {
  let s = 0;
  if (item.note) s += 3;
  if (item.importance === "high") s += 2;
  if (!item.lastOpenedAt) s += 2;
  if (item.project || item.useCase || (item.people && item.people.length)) s += 1;
  s -= Math.min(4, 1.5 * (item.resurfacedCount || 0));
  if (now - item.createdAt > GEM_MIN_AGE_MS) s += 1;
  s += Math.random() - 0.5;
  return s;
}

function pickResurface(items, now) {
  const eligible = items.filter(
    (x) =>
      x.status === "ready" &&
      now - x.createdAt > RESURFACE_MIN_AGE_MS &&
      !(x.dismissedAt && now - x.dismissedAt < DISMISS_COOLDOWN_MS)
  );
  if (eligible.length === 0) return null;
  let best = null;
  let bestScore = 1.5; // require a genuinely good match, not just "old"
  for (const it of eligible) {
    const sc = scoreResurfaceCandidate(it, now);
    if (sc > bestScore) {
      bestScore = sc;
      best = it;
    }
  }
  return best;
}

// ═══════════════════════════════════════════════════════════════════════════════════
// ═══ UI PRIMITIVES ═══
// ═══════════════════════════════════════════════════════════════════════════════════

// Motion language: a drawer gliding open, cards settling into place. Quiet ease-out
// curves only — no springs, no bounce. Everything respects prefers-reduced-motion.
const EASE = "cubic-bezier(0.2, 0.6, 0.2, 1)";
const KEYFRAMES = `
*, *::before, *::after { box-sizing: border-box; }
.cz-shell { max-width: 1080px; margin: 0 auto; padding: 28px 28px 0; }
@media (max-width: 480px) { .cz-shell { padding: 16px 14px 0; } }
.cz-masthead { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.cz-brand { display: inline-flex; align-items: center; gap: 11px; margin: 0; color: var(--cz-ink); font-size: 17px; font-weight: 800; letter-spacing: .16em; }
.cz-brand-name { display: inline-flex; align-items: baseline; gap: 8px; }
.cz-brand-word { letter-spacing: .16em; }
.cz-brand-sub { font-size: 14px; font-weight: 500; letter-spacing: .04em; color: var(--cz-sub); text-transform: none; }
.cz-tagline { font-family: ${FONT}; font-size: 13px; color: var(--cz-sub); margin: 0 0 14px; line-height: 1.35; }
.cz-brand-mark { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 11px; background: var(--cz-action-fill); color: var(--cz-action-text); font-family: ${DISPLAY}; font-size: 17px; font-weight: 700; line-height: 1; letter-spacing: 0; }
.cz-hero-title { max-width: 560px; margin: 0 0 24px; color: var(--cz-ink); font-family: ${DISPLAY}; font-size: clamp(34px, 4.3vw, 58px); font-weight: 500; letter-spacing: -.04em; line-height: 1; }
.cz-section-head { display: flex; align-items: baseline; justify-content: space-between; margin: 24px 0 10px; }
.cz-section-head h2 { margin: 0; font-family: ${DISPLAY}; font-size: 25px; font-weight: 500; letter-spacing: -.035em; line-height: 1.1; }
.cz-section-head span { color: var(--cz-faint); font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; font-variant-numeric: tabular-nums; }
/* .cz-shelf-grid lives in credenza.css (responsive 2→3→4 cols) — don't duplicate it here. */
@keyframes credenza-fade { from { opacity: 0; } to { opacity: 1; } }
`;

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== "undefined" &&
      !!window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);
  return reduced;
}

// Touch devices and phone-width screens have no cursor to follow — ambient
// backgrounds render static there (the rAF loop + blur(60px) repaint is pure
// battery/GPU cost on mobile).
function useCoarsePointer() {
  const QUERY = "(pointer: coarse), (max-width: 767px)";
  const [coarse, setCoarse] = useState(
    () =>
      typeof window !== "undefined" &&
      !!window.matchMedia &&
      window.matchMedia(QUERY).matches
  );
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(QUERY);
    const onChange = () => setCoarse(mq.matches);
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);
  return coarse;
}

function useOnlineStatus() {
  const [online, setOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine !== false
  );
  useEffect(() => {
    const update = () => setOnline(navigator.onLine !== false);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

function useNotification() {
  const [notification, setNotification] = useState(null);
  const notificationRef = useRef(null);
  const timerRef = useRef(null);
  const remainingRef = useRef(0);
  const deadlineRef = useRef(0);

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const dismiss = () => {
    clearTimer();
    notificationRef.current = null;
    setNotification(null);
  };

  const schedule = (duration) => {
    clearTimer();
    if (!duration) return;
    remainingRef.current = duration;
    deadlineRef.current = Date.now() + duration;
    timerRef.current = setTimeout(dismiss, duration);
  };

  const notify = (message, options = {}) => {
    const next = {
      id: makeId(),
      message,
      actionLabel: options.actionLabel || null,
      onAction: options.onAction || null,
      tone: options.tone || "info",
      persistent: !!options.persistent,
    };
    notificationRef.current = next;
    setNotification(next);
    schedule(next.persistent ? 0 : options.duration || 5000);
    return next.id;
  };

  const pause = () => {
    if (!timerRef.current) return;
    remainingRef.current = Math.max(0, deadlineRef.current - Date.now());
    clearTimer();
  };

  const resume = () => {
    const current = notificationRef.current;
    if (!current || current.persistent || remainingRef.current <= 0) return;
    schedule(remainingRef.current);
  };

  useEffect(() => {
    const onVisibility = () => (document.hidden ? pause() : resume());
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearTimer();
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // The callbacks intentionally read refs/current notification state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { notification, notify, dismiss, pause, resume };
}

// Gallery ambient — warm-white field with soft paper-light blooms that
// gently follow cursor/touch. Stays behind content; heavy blur keeps type clean.
function HolographicBackground() {
  const [pos, setPos] = useState({ x: 50, y: 30 });
  const raf = useRef(null);
  const target = useRef({ x: 50, y: 30 });
  const calm = useCoarsePointer();

  useEffect(() => {
    if (calm) return; // static gradient on touch/phone — no loop, no listeners
    const update = () => {
      setPos((p) => ({
        x: p.x + (target.current.x - p.x) * 0.08,
        y: p.y + (target.current.y - p.y) * 0.08,
      }));
      raf.current = requestAnimationFrame(update);
    };
    raf.current = requestAnimationFrame(update);

    const onMove = (e) => {
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      target.current = { x, y };
    };
    const onTouch = (e) => {
      const t = e.touches[0];
      if (!t) return;
      target.current = {
        x: (t.clientX / window.innerWidth) * 100,
        y: (t.clientY / window.innerHeight) * 100,
      };
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });
    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onTouch);
    };
  }, [calm]);

  const { x, y } = calm ? { x: 50, y: 30 } : pos;
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        background: `
          radial-gradient(circle at ${x}% ${y}%, rgba(255, 255, 255, 0.85) 0%, transparent 42%),
          radial-gradient(circle at ${100 - x}% ${100 - y}%, rgba(226, 226, 220, 0.65) 0%, transparent 48%),
          radial-gradient(circle at ${y}% ${x}%, rgba(255, 255, 255, 0.55) 0%, transparent 46%),
          radial-gradient(circle at 50% 110%, rgba(214, 214, 207, 0.60) 0%, transparent 55%),
          radial-gradient(circle at 18% 18%, rgba(255, 255, 255, 0.45) 0%, transparent 38%),
          #F4F4F0
        `,
        filter: "blur(60px)",
        opacity: 0.95,
      }}
    />
  );
}

// Blackout dark ambient — pure black field with soft #1a1a1d neutral lifts.
// Quiet depth only; no loud color wash, zero blue cast.
function RainbowBackground() {
  const [phase, setPhase] = useState(0);
  const raf = useRef(null);
  const reduced = usePrefersReducedMotion();
  const coarse = useCoarsePointer();
  const calm = reduced || coarse; // no cursor to chase on touch — freeze the drift

  useEffect(() => {
    if (calm) return;
    let t = 0;
    const update = () => {
      t += 0.0016;
      setPhase(t);
      raf.current = requestAnimationFrame(update);
    };
    raf.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf.current);
  }, [calm]);

  const driftX = Math.sin(phase) * 3;
  const driftY = Math.cos(phase * 0.7) * 2.5;

  return (
    <div
      aria-hidden="true"
      className="cz-gradient-bg"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
        background: "#000000",
      }}
    >
      {/* Soft neutral moons — barely-there depth from #1a1a1d */}
      <div
        style={{
          position: "absolute",
          inset: "-10%",
          background: `
            radial-gradient(ellipse 70% 55% at ${42 + driftX}% ${28 + driftY}%,
              rgba(26, 26, 29, 0.95) 0%,
              rgba(26, 26, 29, 0.45) 40%,
              transparent 72%
            ),
            radial-gradient(ellipse 55% 50% at ${72 - driftX}% ${62 + driftY}%,
              rgba(26, 26, 29, 0.72) 0%,
              rgba(15, 15, 18, 0.28) 45%,
              transparent 75%
            ),
            radial-gradient(ellipse 50% 40% at ${22 + driftY}% ${70 - driftX}%,
              rgba(40, 40, 46, 0.40) 0%,
              transparent 70%
            ),
            radial-gradient(ellipse 90% 60% at 50% 100%,
              rgba(0, 0, 0, 0.98) 0%,
              transparent 55%
            )
          `,
          filter: "blur(48px)",
          opacity: 0.9,
          transform: `scale(1.05) translate(${driftX * 0.1}%, ${driftY * 0.08}%)`,
        }}
      />
      {/* Thin neutral rim light at the top — blackout edge */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            linear-gradient(180deg, rgba(245, 245, 247, 0.05) 0%, transparent 22%),
            radial-gradient(ellipse 80% 50% at 50% 0%, rgba(26, 26, 29, 0.55) 0%, transparent 60%)
          `,
        }}
      />
    </div>
  );
}

export function Pill({ children, onClick, primary, subtle, style, title, disabled = false, loading = false, ...rest }) {
  const unavailable = disabled || loading;
  // Look lives in credenza-fashion.css (.cz-pill + data-variant); callers'
  // style prop is layout-only (flex, margins, minHeight overrides).
  return (
    <button
      type="button"
      onClick={unavailable ? undefined : onClick}
      title={title}
      disabled={unavailable}
      aria-busy={loading || undefined}
      className="cz-pill"
      data-variant={primary ? "primary" : subtle ? "subtle" : undefined}
      {...rest}
      style={style}
    >
      {children}
    </button>
  );
}

// ─── Spinning reel counter (transitions.dev-style odometer) ───
// One column per digit; a clipped strip of 0-9 cells translates up, and a
// vertical-only SVG feGaussianBlur gives the motion streak while travelling.
const REEL_CELL = 16; // px per digit row
const REEL_DUR = 900; // ms per column spin
const REEL_STAGGER = 70; // ms between column starts, left to right
const REEL_BLUR = 2.5; // px vertical streak at full speed
const REEL_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

function ReelDigit({ digit, index, reduced }) {
  const [pos, setPos] = useState(reduced ? digit : 0);
  const stripRef = useRef(null);
  const blurRef = useRef(null);
  const spinningRef = useRef(false);
  const fid = "reel-blur-" + useId().replace(/[^a-zA-Z0-9]/g, "");

  // Spin forward to the new digit, plus one full revolution for flavor.
  useEffect(() => {
    const delta = (digit - (pos % 10) + 10) % 10;
    if (delta === 0) return;
    spinningRef.current = true;
    setPos(pos + delta + 10);
  }, [digit, pos]);

  // Drive the tween imperatively so the transition carries a per-column stagger.
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    if (reduced) {
      strip.style.transition = "none";
      strip.style.transform = "translateY(" + -pos * REEL_CELL + "px)";
      return;
    }
    strip.style.transition =
      "transform " + REEL_DUR + "ms " + REEL_EASE + " " + index * REEL_STAGGER + "ms";
    strip.style.transform = "translateY(" + -pos * REEL_CELL + "px)";
    // Only streak while actually travelling — the settle snap re-runs this
    // effect and must not re-arm the blur.
    if (spinningRef.current && blurRef.current)
      blurRef.current.setAttribute("stdDeviation", "0 " + REEL_BLUR);
  }, [pos, index, reduced]);

  // Settle: kill the streak and snap the strip back into the 0-9 window (same
  // digit, since cells repeat) so the strip never grows without bound.
  const settle = () => {
    if (!spinningRef.current) return;
    spinningRef.current = false;
    if (blurRef.current) blurRef.current.setAttribute("stdDeviation", "0 0");
    const strip = stripRef.current;
    if (strip) {
      strip.style.transition = "none";
      strip.style.transform = "translateY(" + -(pos % 10) * REEL_CELL + "px)";
    }
    setPos((p) => p % 10);
  };

  const cells = [];
  for (let i = 0; i <= pos; i++) cells.push(i % 10);

  return (
    <span className="t-reel-col" style={{ height: REEL_CELL }} aria-hidden="true">
      <svg className="t-reel-filter-def" focusable="false">
        <filter id={fid} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur ref={blurRef} in="SourceGraphic" stdDeviation="0 0" />
        </filter>
      </svg>
      <span
        ref={stripRef}
        className="t-reel-strip"
        style={{ transform: "translateY(" + -pos * REEL_CELL + "px)", filter: "url(#" + fid + ")" }}
        onTransitionEnd={(e) => {
          if (e.propertyName === "transform") settle();
        }}
      >
        {cells.map((d, i) => (
          <span key={i} className="t-reel-digit" style={{ height: REEL_CELL }}>
            {d}
          </span>
        ))}
      </span>
    </span>
  );
}

function ReelCounter({ value }) {
  const reduced = usePrefersReducedMotion();
  const text =
    "$" +
    Math.max(0, value).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const len = text.length;
  return (
    <span className="t-reel">
      {/* Real value for AT; the reels are decorative. */}
      <span className="t-reel-sr">{text}</span>
      {text.split("").map((ch, i) => {
        // Key from the right so columns keep their identity as the total
        // grows a new leading digit on the left.
        const keyFromRight = len - 1 - i;
        return /\d/.test(ch) ? (
          <ReelDigit key={keyFromRight} digit={Number(ch)} index={i} reduced={reduced} />
        ) : (
          <span key={keyFromRight} className="t-reel-static" aria-hidden="true">
            {ch}
          </span>
        );
      })}
    </span>
  );
}

function MorphButton({
  label,
  icon: Icon,
  activeIcon: ActiveIcon,
  onClick,
  ariaLabel,
  disabled = false,
  className = "",
  title,
  iconOnly = false,
}) {
  const reduced = usePrefersReducedMotion();
  const [engaged, setEngaged] = useState(false);
  const CurrentIcon = engaged ? ActiveIcon : Icon;
  const showLabel = Boolean(label) && !iconOnly;
  return (
    <motion.button
      type="button"
      className={("cz-morph-button " + (iconOnly || !showLabel ? "is-icon-only " : "") + className).trim()}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel || label}
      title={title || label || ariaLabel}
      onMouseEnter={() => setEngaged(true)}
      onMouseLeave={() => setEngaged(false)}
      onFocus={() => setEngaged(true)}
      onBlur={() => setEngaged(false)}
      whileHover={reduced || disabled ? undefined : { scale: 1.02 }}
      whileTap={reduced || disabled ? undefined : { scale: 0.96 }}
      transition={{ duration: reduced ? 0 : 0.16 }}
    >
      <span className="cz-morph-icon" aria-hidden="true">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={engaged ? "active" : "idle"}
            initial={reduced ? false : { opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduced ? undefined : { opacity: 0, scale: 0.5 }}
            transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 600, damping: 25 }}
          >
            <CurrentIcon size={iconOnly || !showLabel ? 18 : 16} strokeWidth={2.2} />
          </motion.span>
        </AnimatePresence>
      </span>
      {showLabel ? <span>{label}</span> : null}
    </motion.button>
  );
}

function FavoriteButton({ item, onToggle, className = "" }) {
  const favorite = item.favorite === true;
  const rootRef = useRef(null);
  const burstTimer = useRef(null);

  useEffect(() => () => clearTimeout(burstTimer.current), []);

  // transitions.dev-style burst: re-seed each dot's vector/velocity/delay/size
  // per like so the spray never repeats, then replay the animation.
  const burst = () => {
    const el = rootRef.current;
    if (!el) return;
    const dots = el.querySelectorAll(".t-like-particles i");
    dots.forEach((dot, i) => {
      const angle = (360 / dots.length) * i + (Math.random() * 2 - 1) * 16;
      const mag = 20 * (0.68 + Math.random() * 0.5);
      const rad = (angle * Math.PI) / 180;
      const s = dot.style;
      s.setProperty("--px", (Math.cos(rad) * mag).toFixed(2) + "px");
      s.setProperty("--py", (Math.sin(rad) * mag).toFixed(2) + "px");
      s.setProperty("--pdur", "calc(600ms * " + (0.78 + Math.random() * 0.44).toFixed(3) + ")");
      s.setProperty("--pdelay", Math.round(Math.random() * 70) + "ms");
      s.setProperty("--p-end-scale", (0.35 + Math.random() * 0.4).toFixed(2));
      s.setProperty("--psize", (0.6 + Math.random() * 0.8).toFixed(2));
    });
    el.classList.remove("is-bursting");
    void el.offsetWidth; // reflow so the burst replays
    el.classList.add("is-bursting");
    clearTimeout(burstTimer.current);
    burstTimer.current = setTimeout(() => el.classList.remove("is-bursting"), 750);
  };

  return (
    <button
      ref={rootRef}
      type="button"
      className={cx("cz-favorite-button t-like", className)}
      data-liked={favorite ? "true" : "false"}
      aria-pressed={favorite}
      aria-label={(favorite ? "Unstar " : "Star ") + (item.title || "item")}
      title={favorite ? "Unstar" : "Star"}
      onPointerDown={(event) => {
        // Keep carousel pan / flip from eating the heart hit.
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!favorite) burst();
        onToggle?.(item.id);
      }}
    >
      {/* Pop scale lives on the wrapper span, never the <svg> — transforming an
          inline SVG makes Chromium rasterise it at 1× (pixelated on hi-DPI). */}
      <span className="t-like-icon" aria-hidden="true">
        <svg className="t-like-heart" width="18" height="18" viewBox="0 0 16 16" fill="none">
          <path
            d="M7.99511 3.42388C6.66221 1.8656 4.4395 1.44643 2.76947 2.87334C1.09944 4.30026 0.86432 6.68598 2.17581 8.3736C3.26622 9.77674 6.56619 12.7361 7.64774 13.6939C7.76874 13.801 7.82925 13.8546 7.89982 13.8757C7.96141 13.8941 8.02881 13.8941 8.0904 13.8757C8.16097 13.8546 8.22147 13.801 8.34248 13.6939C9.42403 12.7361 12.724 9.77674 13.8144 8.3736C15.1259 6.68598 14.9195 4.28525 13.2207 2.87334C11.522 1.46144 9.32801 1.8656 7.99511 3.42388Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="t-like-particles" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <i key={i} />
        ))}
      </span>
    </button>
  );
}

export function Caption({ children, style }) {
  return (
    <div
      style={{
        fontFamily: FONT,
        fontSize: 12,
        fontWeight: 650,
        letterSpacing: "0.01em",
        color: FAINT,
        textTransform: "none",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// Brand marks: inline SVGs for the recognizable services (render offline, always),
// site favicons for other links, and the plain type dot for notes or failed loads.
function Favicon({ host, size, fallbackDot }) {
  const [ok, setOk] = useState(true);
  if (!ok)
    return (
      <span
        style={{ width: 6, height: 6, borderRadius: 3, background: fallbackDot, flexShrink: 0 }}
      />
    );
  return (
    <img
      src={"https://www.google.com/s2/favicons?domain=" + encodeURIComponent(host) + "&sz=64"}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setOk(false)}
      style={{ borderRadius: 3, flexShrink: 0, display: "block" }}
    />
  );
}

export function BrandIcon({ type, host, size = 14 }) {
  const h = (host || "").replace(/^www\./, "");
  const dot = (TYPES[type] || TYPES.note).dot;
  if (/(^|\.)(youtube\.com|youtu\.be)$/.test(h))
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} style={{ flexShrink: 0 }} aria-hidden="true">
        <path
          fill="#FF0000"
          d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81z"
        />
        <path fill="#FFFFFF" d="M9.55 15.57V8.43L15.82 12l-6.27 3.57z" />
      </svg>
    );
  if (/(^|\.)(x\.com|twitter\.com)$/.test(h))
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} style={{ flexShrink: 0 }} aria-hidden="true">
        <path
          style={{ fill: INK }}
          d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
        />
      </svg>
    );
  if (/(^|\.)spotify\.com$/.test(h))
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} style={{ flexShrink: 0 }} aria-hidden="true">
        <circle cx="12" cy="12" r="12" fill="#1DB954" />
        <path
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="1.6"
          strokeLinecap="round"
          d="M6.4 9.6c3.7-1.1 7.8-.7 11 1.2M7 12.7c3-.9 6.4-.5 9 1M7.6 15.5c2.4-.7 5-.4 7.1.9"
        />
      </svg>
    );
  if (/(^|\.)tiktok\.com$/.test(h))
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} style={{ flexShrink: 0 }} aria-hidden="true">
        <path
          style={{ fill: INK }}
          d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"
        />
      </svg>
    );
  if (/(^|\.)reddit\.com$/.test(h) || /(^|\.)redd\.it$/.test(h))
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} style={{ flexShrink: 0 }} aria-hidden="true">
        <circle cx="12" cy="12" r="12" fill="#FF4500" />
        <path
          fill="#FFFFFF"
          d="M16.68 11.55c.82 0 1.49.66 1.49 1.48 0 .4-.16.76-.42 1.03.52.98.72 2.13.42 3.28-.6 2.32-2.76 3.86-5.54 3.86-2.78 0-4.94-1.54-5.54-3.86-.3-1.15-.1-2.3.42-3.28a1.48 1.48 0 0 1-.42-1.03c0-.82.67-1.48 1.49-1.48.58 0 1.08.33 1.33.82a6.55 6.55 0 0 1 3.22-.84c1.1 0 2.14.27 3.06.74.26-.52.8-.88 1.41-.88h.08zM8.12 13.5a.95.95 0 1 0 0 1.9.95.95 0 0 0 0-1.9zm6.9 2.63c-.4.53-1.26.9-2.26.9s-1.86-.37-2.26-.9a.45.45 0 0 1 .7-.56c.24.31.82.6 1.56.6s1.32-.29 1.56-.6a.45.45 0 0 1 .7.56zm-.82-3.43a.95.95 0 1 0 0 1.9.95.95 0 0 0 0-1.9zm.7-5.02c.21.21.21.55 0 .76l-2.2 2.2c.42.34.69.86.69 1.44 0 .23-.04.45-.1.66l2.65 1.25c.24.11.34.4.23.64-.11.24-.4.34-.64.23l-2.74-1.3a2.49 2.49 0 0 1-1.63.6 2.5 2.5 0 0 1-1.64-.6l-2.73 1.3a.45.45 0 0 1-.65-.23.45.45 0 0 1 .24-.64l2.65-1.25a2.4 2.4 0 0 1-.11-.66c0-.58.27-1.1.7-1.44l-2.21-2.2a.54.54 0 0 1 0-.76.54.54 0 0 1 .76 0l2.3 2.3c.38-.16.8-.25 1.24-.25.45 0 .87.09 1.25.25l2.3-2.3a.54.54 0 0 1 .76 0z"
        />
      </svg>
    );
  if (h) return <Favicon host={h} size={size} fallbackDot={dot} />;
  return (
    <span style={{ width: 6, height: 6, borderRadius: 3, background: dot, flexShrink: 0 }} />
  );
}

// Live ≤767px check — the app's phone/desktop split in one place.
function useIsPhone() {
  const [phone, setPhone] = useState(
    () =>
      typeof window !== "undefined" &&
      !!window.matchMedia &&
      window.matchMedia("(max-width: 767px)").matches
  );
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(max-width: 767px)");
    const onChange = () => setPhone(mq.matches);
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);
  return phone;
}

// "Read" is v3-generic vocabulary — a Yupoo album isn't an article. Prefer the
// platform users actually recognize; fall back to the generic type label.
function sourceLabel(item) {
  const h = (item.host || "").toLowerCase();
  if (h.includes("yupoo")) return "Yupoo";
  if (h.includes("weidian")) return "Weidian";
  if (h.includes("taobao") || h.includes("tmall")) return "Taobao";
  if (h.includes("1688")) return "1688";
  if (h.includes("reddit")) return "Reddit";
  return (TYPES[item.type] || TYPES.note).label;
}

// One-tap findStatus pipeline chips — shared by the edit forms and the mobile
// detail sheet (audit C3). Status meanings per docs/Monetization.md §A3.
// FIND_STATUSES itself lives in credenza-find-status.js (shared with the Ask
// serializer); labels/colors are display-only and stay here.
// Short labels stay for StatusPill / dense chips. Long labels power the 4a
// stage + 4b grouped picker (no bare QC/GL/RL initials on the card back).
const FIND_STATUS_LABELS = {
  want: "Want",
  bought: "Bought",
  shipped: "Shipped",
  qc: "QC",
  gl: "GL",
  rl: "RL",
  returned: "Returned",
};
const FIND_STATUS_LONG = {
  want: "Want",
  bought: "Bought",
  shipped: "Shipped",
  qc: "Quality check",
  gl: "Approved · green light",
  rl: "Red light",
  returned: "Returned",
};
const FIND_STATUS_HINTS = {
  qc: "QC photos requested",
  gl: "Cleared to ship",
  rl: "Rejected — send back or keep",
};
// Human 4-stop track (design 4a). Agent sub-states map into Bought; returned
// sits in the Received slot. Enum stays want|bought|shipped|qc|gl|rl|returned.
const STATUS_TRACK = ["Want", "Bought", "Shipped", "Received"];
function statusTrackIndex(status) {
  switch (status) {
    case "want":
      return 0;
    case "bought":
    case "qc":
    case "gl":
    case "rl":
      return 1;
    case "shipped":
      return 2;
    case "returned":
      return 3;
    default:
      return 0;
  }
}
const FIND_STATUS_COLORS = {
  want: { bg: "oklch(0.35 0.02 280)", text: "oklch(0.85 0 0)", dot: "oklch(0.7 0.02 280)" },
  bought: { bg: "oklch(0.35 0.08 250)", text: "oklch(0.9 0.1 250)", dot: "oklch(0.65 0.14 250)" },
  shipped: { bg: "oklch(0.32 0.08 290)", text: "oklch(0.85 0.1 290)", dot: "oklch(0.6 0.14 290)" },
  qc: { bg: "oklch(0.35 0.08 85)", text: "oklch(0.9 0.1 85)", dot: "oklch(0.7 0.14 85)" },
  gl: { bg: "oklch(0.3 0.08 145)", text: "oklch(0.85 0.1 145)", dot: "oklch(0.6 0.14 145)" },
  rl: { bg: "oklch(0.3 0.1 25)", text: "oklch(0.9 0.12 25)", dot: "oklch(0.65 0.18 25)" },
  returned: { bg: "oklch(0.32 0.06 55)", text: "oklch(0.9 0.08 55)", dot: "oklch(0.7 0.12 55)" },
};
// One segmented radiogroup for every chip-style picker — unit toggles and
// other compact radios. Category uses CategorySelect (design 4c).
export function SegmentedControl({ value, onChange, options, label, allowUnset = false }) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      style={{ display: "flex", flexWrap: "wrap", gap: 4, background: SEG, borderRadius: 12, padding: 2 }}
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            type="button"
            role="radio"
            aria-checked={active}
            className="cz-chip"
            key={opt.value}
            onClick={() => onChange(active && allowUnset ? "" : opt.value)}
            style={{
              flex: "1 0 auto",
              fontFamily: FONT,
              fontSize: 11,
              fontWeight: 600,
              color: active ? INK : SUB,
              background: active ? CARD : "transparent",
              border: "none",
              borderRadius: 999,
              padding: "6px 8px",
              cursor: "pointer",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// Design handoff 4a: the 4-stop human track IS the status control — tap it
// for the grouped picker. No big serif stage line above the track (Kyle
// 2026-07-23: "take out the larger 'want', just use the line"). The current
// stop stays legible through the filled dot + green bold track label.
function StatusStage({ value, onChange, label = "Status" }) {
  const [open, setOpen] = useState(false);
  const current = value || "want";
  const trackIdx = statusTrackIndex(current);
  const stageLabel = FIND_STATUS_LONG[current] || FIND_STATUS_LABELS[current] || current;
  return (
    <div
      className={"cz-status-stage t-acc" + (open ? " is-open" : "")}
      data-open={open}
    >
      <button
        type="button"
        className="cz-status-track-btn"
        aria-label={label + ": " + stageLabel + ". Change."}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="cz-status-track" aria-hidden="true">
          {STATUS_TRACK.map((name, i) => {
            const state = i < trackIdx ? "past" : i === trackIdx ? "current" : "future";
            return (
              <div key={name} className={"cz-status-track-step is-" + state}>
                {i > 0 ? (
                  <span className={"cz-status-track-connector is-" + state} />
                ) : null}
                <span className={"cz-status-track-dot is-" + state} />
                <span
                  className={
                    "cz-status-track-label" + (i === trackIdx ? " is-current" : "")
                  }
                >
                  {name}
                </span>
              </div>
            );
          })}
        </div>
      </button>
      {/* t-acc animates the height; t-panel-slide adds the slide + blur. The
          panel stays mounted so the close animation can play; inert keeps the
          hidden options out of tab order and the a11y tree. */}
      <div
        className="t-acc-panel"
        aria-hidden={!open}
        inert={!open ? "" : undefined}
      >
        <div className="t-acc-panel-inner">
          <div
            className="cz-status-picker t-panel-slide"
            data-open={open}
            role="listbox"
            aria-label="Order status"
          >
            {FIND_STATUSES.map((s) => {
              const active = current === s;
              const hint = FIND_STATUS_HINTS[s];
              return (
                <button
                  type="button"
                  key={s}
                  role="option"
                  aria-selected={active}
                  className={
                    "cz-status-picker-option" +
                    (active ? " is-active" : "") +
                    (hint ? " has-hint" : "")
                  }
                  onClick={() => {
                    onChange && onChange(s);
                    setOpen(false);
                  }}
                >
                  <span className="cz-status-picker-option-dot" aria-hidden="true" />
                  <span className="cz-status-picker-option-text">
                    <span className="cz-status-picker-option-label">
                      {FIND_STATUS_LONG[s] || FIND_STATUS_LABELS[s]}
                    </span>
                    {hint ? (
                      <span className="cz-status-picker-option-hint">{hint}</span>
                    ) : null}
                  </span>
                  {active ? (
                    <Check size={12} strokeWidth={2.4} aria-hidden="true" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// Design handoff: status edit = underline segment row (no pill fills). Kept for
// dense forms that still want a full-width strip.
function StatusUnderline({ value, onChange, label = "Status" }) {
  const current = value || "want";
  return (
    <div className="cz-status-underline" role="radiogroup" aria-label={label}>
      {FIND_STATUSES.map((s) => {
        const active = current === s;
        return (
          <button
            type="button"
            role="radio"
            aria-checked={active}
            key={s}
            className={"cz-status-underline-btn" + (active ? " is-active" : "")}
            onClick={() => onChange(s)}
          >
            {FIND_STATUS_LABELS[s]}
          </button>
        );
      })}
    </div>
  );
}

// Shared status control.
// mode "display" | default = design 4a stage + track + grouped picker.
// mode "edit" = underline segments for dense forms.
function StatusChips({ value, onChange, label = "Status", mode = "display" }) {
  if (mode === "edit") {
    return <StatusUnderline value={value} onChange={onChange} label={label} />;
  }
  return <StatusStage value={value} onChange={onChange} label={label} />;
}

// Design 4c: one auto-detected category row. Tap expands a tidy chip list.
function CategorySelect({ value, onChange, label = "Category", auto = true }) {
  const [open, setOpen] = useState(false);
  const current = value || "";
  const currentLabel =
    current && CATEGORIES[current] ? CATEGORIES[current].label : "Not set";
  return (
    <div
      className={"cz-cat-select t-acc" + (open ? " is-open" : "")}
      data-open={open}
    >
      <div className="cz-cat-select-label">{label}</div>
      <button
        type="button"
        className="cz-cat-select-row"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="cz-cat-select-value">
          <span className="cz-cat-select-name">{currentLabel}</span>
          {auto && current ? (
            <span className="cz-cat-select-auto">auto</span>
          ) : null}
        </span>
        <span className="t-acc-chevron">
          <ChevronDown size={14} strokeWidth={2.2} aria-hidden="true" />
        </span>
      </button>
      {/* Same t-acc + t-panel-slide composite as the status picker. The panel
          stays mounted so the close animation can play; inert keeps the hidden
          chips out of tab order and the a11y tree. */}
      <div
        className="t-acc-panel"
        aria-hidden={!open}
        inert={!open ? "" : undefined}
      >
        <div className="t-acc-panel-inner">
          <div
            className="cz-cat-select-menu t-panel-slide"
            data-open={open}
            role="listbox"
            aria-label={label}
          >
            <div className="cz-cat-select-chips">
              {Object.entries(CATEGORIES).map(([key, c]) => {
                const active = current === key;
                return (
                  <button
                    type="button"
                    key={key}
                    role="option"
                    aria-selected={active}
                    className={
                      "cz-cat-select-chip" + (active ? " is-active" : "")
                    }
                    onClick={() => {
                      onChange && onChange(key);
                      setOpen(false);
                    }}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══ SHARED CARD PRIMITIVES (standardization 2026-07-22, audit workstream A) ═══
// One renderer per repeated card element. Every surface composes these instead
// of hand-rolling its own copy — FavoriteButton (above) is the model. Positions
// stay per-surface via className; the *content* is defined exactly once.

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

// Deduped cover + gallery list, optionally capped. Single seed expression for
// every photo surface (edit manager, card-back fan, both openPhotos paths).
function itemPhotoList(item, max) {
  const photos = mergeFashionImages(item.image ? [item.image] : [], item.gallery || []);
  return max == null ? photos : photos.slice(0, max);
}

// Seller name, hyperlinked to the store when we know it (Weidian/Yupoo home,
// host fallback). The one place seller renders as a link-or-text.
function SellerLink({ item, className = "cz-seller-link", style }) {
  if (!item || !item.seller) return null;
  const href = sellerStoreUrl(item);
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        style={style}
        onClick={(e) => e.stopPropagation()}
      >
        {item.seller}
      </a>
    );
  }
  return (
    <span className={className + " is-text"} style={style}>
      {item.seller}
    </span>
  );
}

// Yupoo full album — quiet hyperlink under the seller (card back). Not an
// action button: Kyle 2026-07-22 killed "More Photos" chrome in the Buy row.
function AlbumLink({ item, className = "cz-album-quiet", style }) {
  const href = item ? yupooAlbumUrl(item) : null;
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      style={style}
      onClick={(e) => e.stopPropagation()}
    >
      Full Album
    </a>
  );
}

// Garment categories only — shoes/hats/bags etc. don't map body cm → letter size.
// Declared here so resolveDisplaySize (and SizeRecommendation) can share it.
const SIZE_PICK_SKIP_CATEGORIES = new Set(["shoes", "hat", "bag", "accessory", "socks"]);

// Letter tokens → spoken labels for the card face (Kyle: "SIZE: LARGE", not bare "L").
const SIZE_WORD_LABELS = {
  xxs: "XX-Small",
  xs: "X-Small",
  s: "Small",
  m: "Medium",
  l: "Large",
  xl: "X-Large",
  xxl: "XX-Large",
  "2xl": "XX-Large",
  xxxl: "XXX-Large",
  "3xl": "XXX-Large",
  free: "Free size",
  f: "Free size",
  "均码": "Free size",
  one: "One size",
  os: "One size",
};

function formatSizeToken(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  const key = s.toLowerCase().replace(/\s+/g, "");
  if (SIZE_WORD_LABELS[key]) return SIZE_WORD_LABELS[key];
  // Pants waist "32" / "W32" stays compact; letter-ish already handled.
  if (/^w?\d{2}(\.\d)?$/i.test(s)) return s.toUpperCase().replace(/^w/i, "W");
  return s.toUpperCase();
}

function computeRecommendedSize(item, bodyProfile, fitPrefs = null) {
  if (!item || !bodyProfile) return null;
  if (SIZE_PICK_SKIP_CATEGORIES.has(item.category)) return null;
  if (item.recommendedSize) return String(item.recommendedSize).trim() || null;
  const chart = parseSizeChart(sizeChartTextFor(item));
  const catPref =
    fitPrefs && item.category && fitPrefs[item.category]
      ? fitPrefs[item.category]
      : null;
  const rec = chart
    ? recommendSize(chart, bodyProfile, item.category, catPref)
    : null;
  return rec && rec.size ? String(rec.size).trim() : null;
}

// Card face / grid size line (Kyle 2026-07-22):
//   chosen only     →  SIZE: LARGE
//   rec only        →  SIZE: MEDIUM          (isRec)
//   both, same      →  SIZE: LARGE
//   both, differ    →  SIZE: LARGE (Rec M)
// 2026-07-23 (Kyle): no chart on the item → no true rec, so most cards showed
// nothing. Fall back to the profile's usual size tagged EST — visible on
// every garment card, never reads as measured. A size set in Edit always
// wins over any rec.
function resolveDisplaySize(item, bodyProfile, fitPrefs = null) {
  if (!item) return { text: "", isRec: false };
  const chosen = String(item.size || "").trim();
  const rec = computeRecommendedSize(item, bodyProfile, fitPrefs);
  if (!chosen && !rec) {
    // Part 5 task 11: slot-specific usual sizes win over the single
    // usualSize. Shoes get their own slot — a letter "usual size" is never a
    // shoe size, so usualSize stays garment-only.
    const slotKey =
      item.category === "shoes"
        ? "usualShoes"
        : item.category === "pants" || item.category === "shorts"
          ? "usualBottoms"
          : "usualTops";
    const genericOk = !SIZE_PICK_SKIP_CATEGORIES.has(item.category);
    const usual = bodyProfile
      ? String(
          (genericOk || slotKey === "usualShoes" ? bodyProfile[slotKey] : "") ||
            (genericOk ? bodyProfile.usualSize : "") ||
            ""
        ).trim()
      : "";
    if (usual) {
      return {
        text: "SIZE: " + formatSizeToken(usual) + " (EST)",
        isRec: true,
        isEstimate: true,
        size: usual,
      };
    }
    return { text: "", isRec: false };
  }

  if (chosen && rec) {
    const same = chosen.toLowerCase() === rec.toLowerCase();
    if (same) {
      return { text: "SIZE: " + formatSizeToken(chosen), isRec: true, size: chosen, rec };
    }
    return {
      text: "SIZE: " + formatSizeToken(chosen) + " (Rec " + rec.toUpperCase() + ")",
      isRec: true,
      size: chosen,
      rec,
    };
  }
  if (chosen) {
    return { text: "SIZE: " + formatSizeToken(chosen), isRec: false, size: chosen };
  }
  return { text: "SIZE: " + formatSizeToken(rec), isRec: true, size: rec, rec };
}

// findStatus pill. "pill" = standalone overlay chip with per-status colors;
// "chip" = colored text riding a shared cz-meta-chip (card-back meta row).
// "want" renders nothing anywhere — it's the default, not a fact worth space.
function StatusPill({ status, variant = "pill", className, style }) {
  if (!status || status === "want") return null;
  const colors = FIND_STATUS_COLORS[status] || {};
  if (variant === "chip") {
    return (
      <span className={cx("cz-meta-chip", className)} style={{ color: colors.text || INK, ...style }}>
        {status}
      </span>
    );
  }
  return (
    <span
      className={cx("cz-status-pill", className)}
      style={{ background: colors.bg || "transparent", color: colors.text || INK, ...style }}
    >
      {status}
    </span>
  );
}

// Price display. "overlay" = USD-first short pill pinned over a photo;
// "hero" = full ¥+$ card-back hero; "meta" = inline full label in a text row.
function PriceChip({ item, variant = "overlay", className, style }) {
  // Hero is USD-only (Kyle 2026-07-22: "remove the yen price, keep the
  // dollar") — priceLabelShort is USD-first with a CNY fallback.
  const label = variant === "meta" ? priceLabel(item) : priceLabelShort(item);
  if (!label) return null;
  if (variant === "hero") {
    return (
      <div className={cx("cz-carousel-price-hero", className)} style={style}>
        {label}
      </div>
    );
  }
  if (variant === "meta") {
    return (
      <span className={cx("cz-price-meta", className)} style={style}>
        {label}
      </span>
    );
  }
  return (
    <span className={cx("cz-price-chip", className)} style={style}>
      {label}
    </span>
  );
}

function TypeMark({ item }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <BrandIcon type={item.type} host={item.host} size={13} />
      {!(item.type === "note" && item.note) && (
        <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 600, color: SUB }}>
          {sourceLabel(item)}
        </span>
      )}
    </span>
  );
}

// Cover icon: category-first for fashion items, type fallback for generic links.
// Simple line-art SVGs so they stay crisp at any size and work in both themes.
function CoverIcon({ item, size = 64 }) {
  const category = item.category;
  const stroke = "currentColor";
  const strokeWidth = 1.5;
  const common = { fill: "none", stroke, strokeWidth, strokeLinecap: "round", strokeLinejoin: "round" };

  if (category === "shirt") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        <path {...common} d="M7 4h3l2 3 2-3h3l3 4-2 2-1-1v11H8V9l-1 1-2-2 2-4z" />
      </svg>
    );
  }
  if (category === "pants") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        <path {...common} d="M8 4h8l-1 9-2 7-2-7-3-9z" />
      </svg>
    );
  }
  if (category === "shoes") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        <path {...common} d="M4 14c2-3 6-4 10-3l4 1c2 .5 3 2 2 4H6c-1 0-2-1-2-2z" />
        <path {...common} d="M14 12l3-4" />
      </svg>
    );
  }
  if (category === "outerwear") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        <path {...common} d="M8 3h8l3 5v13H5V8l3-5z" />
        <path {...common} d="M12 3v18" />
        <path {...common} d="M8 8h8" />
      </svg>
    );
  }
  if (category === "accessory") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        <circle {...common} cx="12" cy="12" r="7" />
        <path {...common} d="M12 8v4l3 3" />
      </svg>
    );
  }
  if (category === "bag") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        <path {...common} d="M6 9h12v10H6z" />
        <path {...common} d="M9 9V6a3 3 0 0 1 6 0v3" />
      </svg>
    );
  }
  if (category === "hat") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        <path {...common} d="M5 13h14v3H5z" />
        <path {...common} d="M7 13c0-4 2-7 5-7s5 3 5 7" />
      </svg>
    );
  }

  // Type fallback.
  const type = item.type || "note";
  if (type === "video") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        <rect {...common} x="3" y="5" width="18" height="14" rx="2" />
        <path {...common} d="M10 9l5 3-5 3V9z" />
      </svg>
    );
  }
  if (type === "tweet") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        <path {...common} d="M18.2 3H21l-7.6 8.7L22 21h-6.3l-4.9-6.4L4.5 21H2l8.1-9.3L2 3h6.5l4.5 5.9L18.2 3z" />
      </svg>
    );
  }
  if (type === "audio") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        <path {...common} d="M4 10v4M8 7v10M12 4v16M16 8v8M20 10v4" />
      </svg>
    );
  }
  if (type === "reddit") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        <circle {...common} cx="12" cy="12" r="9" />
        <circle {...common} cx="15" cy="10" r="1.5" fill="currentColor" />
        <circle {...common} cx="9" cy="10" r="1.5" fill="currentColor" />
        <path {...common} d="M9 14c1.3 1.3 4.7 1.3 6 0" />
        <path {...common} d="M16 6l2-2M8 6L6 4" />
      </svg>
    );
  }

  // Default: article / note / link.
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path {...common} d="M4 4h16v16H4z" />
      <path {...common} d="M8 9h8M8 12h8M8 15h5" />
    </svg>
  );
}

// Marketplace brand tiles for photo-less cards (Kyle 2026-07-25: the gray
// gradient box read as a broken image, not a card). A flat tile with the
// marketplace monogram + wordmark looks deliberate until photos arrive.
const MARKETPLACE_TILES = {
  weidian: { name: "Weidian", rgb: "255, 90, 60" },
  taobao: { name: "Taobao", rgb: "255, 106, 0" },
  tmall: { name: "Tmall", rgb: "255, 0, 54" },
  "1688": { name: "1688", rgb: "255, 115, 0" },
  yupoo: { name: "Yupoo", rgb: "55, 178, 77" },
};

function CoverPlaceholder({ item, aspectRatio = "4/5", maxHeight, style }) {
  const loading = item.status === "enriching";
  const tileUrl =
    item.url ||
    (Array.isArray(item.links) ? (item.links.find((l) => l.role === "buy") || {}).url : "") ||
    "";
  const tile = tileUrl ? MARKETPLACE_TILES[marketplaceOf(tileUrl)] : null;
  if (tile) {
    return (
      <div
        className="cz-cover-placeholder cz-cover-tile"
        aria-hidden="true"
        style={{
          width: "100%",
          aspectRatio,
          maxHeight,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          background:
            "linear-gradient(180deg, rgba(" + tile.rgb + ", 0.15) 0%, rgba(" + tile.rgb + ", 0.05) 100%)",
          position: "relative",
          overflow: "hidden",
          ...style,
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 56,
            height: 56,
            borderRadius: 16,
            background: "rgba(" + tile.rgb + ", 0.16)",
            border: "1px solid rgba(" + tile.rgb + ", 0.38)",
            color: "rgb(" + tile.rgb + ")",
            fontFamily: DISPLAY,
            fontSize: 26,
            fontWeight: 700,
          }}
        >
          {tile.name[0]}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 650,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--cz-sub)",
          }}
        >
          {tile.name}
        </span>
        {loading && (
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.02em", color: "var(--cz-faint)" }}>
            Loading photos…
          </span>
        )}
      </div>
    );
  }
  return (
    <div
      className="cz-cover-placeholder"
      aria-hidden="true"
      style={{
        width: "100%",
        aspectRatio,
        maxHeight,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        background: "var(--cz-bg-elevated)",
        color: "var(--cz-faint)",
        position: "relative",
        overflow: "hidden",
        ...style,
      }}
    >
      <CoverIcon item={item} size={loading ? 36 : 48} />
      {loading && (
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.02em" }}>
          Loading photos…
        </span>
      )}
    </div>
  );
}

// Shared cover image: handles broken/missing images and renders a category-aware placeholder.
function CoverImage({ item, aspectRatio = "4/5", maxHeight = 320, className, style, imgStyle, fill = false }) {
  const [imgOk, setImgOk] = useState(true);
  const imageSrc = item.image || (item.videoId ? "https://i.ytimg.com/vi/" + item.videoId + "/hqdefault.jpg" : null);

  useEffect(() => {
    setImgOk(true);
  }, [imageSrc]);

  // Carousel/card faces pass fill so the cover always paints the full image
  // slot — aspect-ratio + maxHeight made price chips land at different Ys when
  // titles/sellers reflowed the meta block under a variable-height image.
  const boxStyle = fill
    ? {
        width: "100%",
        height: "100%",
        objectFit: "cover",
        display: "block",
        userSelect: "none",
        WebkitUserDrag: "none",
        ...imgStyle,
      }
    : {
        width: "100%",
        aspectRatio,
        maxHeight,
        objectFit: "cover",
        display: "block",
        userSelect: "none",
        WebkitUserDrag: "none",
        ...imgStyle,
      };

  if (!imageSrc || !imgOk) {
    return (
      <CoverPlaceholder
        item={item}
        aspectRatio={fill ? undefined : aspectRatio}
        maxHeight={fill ? undefined : maxHeight}
        style={{
          ...(fill ? { width: "100%", height: "100%", aspectRatio: "auto", maxHeight: "none" } : null),
          ...style,
        }}
      />
    );
  }

  return (
    <img
      className={className}
      src={imageSrc}
      alt=""
      draggable={false}
      loading="lazy"
      decoding="async"
      onDragStart={(event) => event.preventDefault()}
      onError={() => setImgOk(false)}
      style={boxStyle}
    />
  );
}

export function Field({ label, value, onChange, placeholder, rows, suggestions, onCommit, emptyHint, listLabel, allowCreate }) {
  const id = useId();
  // Combobox fields use the organic transitions.dev dropdown instead of the
  // native datalist (which paints a gray OS menu on top of the card).
  if (!rows && Array.isArray(suggestions)) {
    const isHaul = label && /haul/i.test(label);
    return (
      <ComboboxField
        label={label}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        suggestions={suggestions}
        onCommit={onCommit}
        emptyHint={emptyHint}
        listLabel={listLabel}
        allowCreate={allowCreate !== false}
        createVerb={isHaul ? "Create" : "Use"}
        addNewLabel={isHaul ? "+ Add new haul" : ""}
        clearLabel={isHaul && String(value || "").trim() ? "Remove from haul" : ""}
        onClear={isHaul ? () => { onChange(""); onCommit?.(""); } : undefined}
        chevronLabel={listLabel ? "Show " + listLabel.toLowerCase() : "Show options"}
      />
    );
  }
  const common = {
    width: "100%",
    boxSizing: "border-box",
    fontFamily: FONT,
    fontSize: 14,
    color: INK,
    background: BG,
    border: "1px solid transparent",
    borderRadius: 10,
    padding: "10px 12px",
  };
  return (
    <label className="cz-field-label" htmlFor={id}>
      <span>{label}</span>
      {rows ? (
        <textarea
          id={id}
          className="cz-field"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          style={{ ...common, resize: "vertical", lineHeight: 1.5 }}
        />
      ) : (
        <input
          id={id}
          className="cz-field"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={common}
        />
      )}
    </label>
  );
}

// Shared combobox — type free text or pick from suggestions with a
// transitions.dev-style scale/fade menu (not the native OS datalist).
function ComboboxField({
  label,
  value,
  onChange,
  placeholder,
  suggestions = [],
  onCommit,
  emptyHint = "Type a value",
  listLabel = "Suggestions",
  allowCreate = true,
  // Sticky footer action: always-visible "Add new…" that focuses the input.
  addNewLabel = "",
  // Explicit clear / remove row when a value is set (e.g. "Remove from haul").
  clearLabel = "",
  onClear,
  chevronLabel = "Show options",
  createVerb = "Use",
  className = "",
}) {
  const id = useId();
  const rootRef = useRef(null);
  const controlRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [menuBox, setMenuBox] = useState(null); // fixed coords so overflow parents don't clip
  const [creating, setCreating] = useState(false);
  const closeTimer = useRef(null);
  // Keyboard-active option index (Part 5 a11y): ArrowUp/Down move it, Enter
  // picks it. -1 = no active option; typing resets it.
  const [activeIdx, setActiveIdx] = useState(-1);

  const closeMenu = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (!open && !closing) return;
    setClosing(true);
    setOpen(false);
    setCreating(false);
    closeTimer.current = setTimeout(() => {
      setClosing(false);
      closeTimer.current = null;
    }, 160);
  }, [open, closing]);

  const placeMenu = useCallback(() => {
    const el = controlRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 6;
    const maxH = 260;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const openUp = spaceBelow < 140 && rect.top > spaceBelow;
    setMenuBox({
      left: Math.max(8, rect.left),
      width: rect.width,
      top: openUp ? undefined : rect.bottom + gap,
      bottom: openUp ? window.innerHeight - rect.top + gap : undefined,
      maxHeight: Math.min(maxH, openUp ? rect.top - gap - 8 : spaceBelow - 8),
      origin: openUp ? "bottom-left" : "top-left",
    });
  }, []);

  const openMenu = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setClosing(false);
    setOpen(true);
    setActiveIdx(-1);
    // Measure after paint so the menu escapes overflow:auto card backs.
    requestAnimationFrame(placeMenu);
  }, [placeMenu]);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    []
  );

  useEffect(() => {
    if (!open) return;
    placeMenu();
    const onDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        // Fixed menu is portaled-by-position; also ignore clicks inside the menu node.
        const menu = document.getElementById(id + "-list");
        if (menu && menu.contains(event.target)) return;
        closeMenu();
      }
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        // An open menu eats Escape (2026-07-25): without stopPropagation the
        // same keypress also peeled the carousel overlay behind the menu.
        event.stopPropagation();
        closeMenu();
      }
    };
    const onReposition = () => placeMenu();
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", onReposition);
    // Reposition on any scroll (card back is overflow:auto).
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, closeMenu, placeMenu, id]);

  // Keep the keyboard-active option visible while arrows move through a
  // long list.
  useEffect(() => {
    if (!open || activeIdx < 0) return;
    const el = document.getElementById(id + "-opt-" + activeIdx);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [open, activeIdx, id]);

  const q = String(value || "").trim().toLowerCase();// While "Add new" is active, show the full list unfiltered so people can still
  // pick an existing haul; filtered list only applies to normal typing.
  const filtered = creating
    ? suggestions
    : suggestions.filter((name) => !q || String(name).toLowerCase().includes(q));
  const exact = suggestions.some((name) => String(name).toLowerCase() === q);
  const showCreate = allowCreate && q && !exact;
  const showClear = Boolean(clearLabel && String(value || "").trim());
  const menuVisible = open || closing;

  const pick = (name) => {
    const next = String(name || "").trim();
    onChange(next);
    onCommit?.(next);
    setCreating(false);
    closeMenu();
  };

  const startCreate = () => {
    setCreating(true);
    onChange("");
    openMenu();
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select?.();
    });
  };

  const clearValue = () => {
    onChange("");
    onClear?.();
    onCommit?.("");
    setCreating(false);
    closeMenu();
  };

  return (
    <div className={"cz-combobox" + (className ? " " + className : "")} ref={rootRef}>
      <label className="cz-field-label" htmlFor={id}>
        <span>{label}</span>
        <div
          className={"cz-combobox-control" + (open ? " is-open" : "")}
          ref={controlRef}
        >
          <input
            ref={inputRef}
            id={id}
            className="cz-field cz-combobox-input"
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setActiveIdx(-1);
              if (!open) openMenu();
            }}
            onFocus={openMenu}
            onBlur={() => {
              // Don't commit-close while the fixed menu is being used — picks
              // fire mousedown preventDefault; blur still commits typed text.
              const next = String(value || "").trim();
              if (next !== String(value || "")) onChange(next);
              onCommit?.(next);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                // Keep Enter inside the combobox — do NOT bubble to the
                // card-edit "Enter to save" handler (that closed the form
                // before the size list could be used).
                e.preventDefault();
                e.stopPropagation();
                if (open && activeIdx >= 0 && filtered[activeIdx] != null) {
                  pick(filtered[activeIdx]);
                } else {
                  pick(value);
                }
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                e.stopPropagation();
                if (!open) {
                  openMenu();
                } else if (filtered.length > 0) {
                  setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
                }
              } else if (e.key === "ArrowUp") {
                if (!open) return;
                e.preventDefault();
                e.stopPropagation();
                if (filtered.length > 0) {
                  setActiveIdx((i) => (i <= 0 ? filtered.length - 1 : i - 1));
                }
              } else if (e.key === "Escape" && open) {
                e.preventDefault();
                e.stopPropagation();
                closeMenu();
              }
            }}
            placeholder={creating ? "Name the new haul…" : placeholder}
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-controls={id + "-list"}
            aria-autocomplete="list"
            aria-activedescendant={
              open && activeIdx >= 0 && filtered[activeIdx] != null
                ? id + "-opt-" + activeIdx
                : undefined
            }
          />
          {showClear ? (
            <button
              type="button"
              className="cz-combobox-clear"
              tabIndex={-1}
              aria-label={clearLabel}
              title={clearLabel}
              onMouseDown={(e) => e.preventDefault()}
              onClick={clearValue}
            >
              <X size={14} strokeWidth={2.4} aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            className="cz-combobox-chevron"
            tabIndex={-1}
            aria-label={chevronLabel}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => (open ? closeMenu() : openMenu())}
          >
            <ChevronDown size={15} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
      </label>
      {menuVisible && menuBox && (
        <div
          id={id + "-list"}
          className={
            "t-dropdown cz-combobox-menu is-fixed" +
            (open && !closing ? " is-open" : "") +
            (closing ? " is-closing" : "")
          }
          data-origin={menuBox.origin || "top-left"}
          role="listbox"
          aria-label={listLabel}
          style={{
            position: "fixed",
            left: menuBox.left,
            width: menuBox.width,
            top: menuBox.top,
            bottom: menuBox.bottom,
            maxHeight: menuBox.maxHeight,
            zIndex: 240,
          }}
        >
          {filtered.length === 0 && !showCreate && !addNewLabel && !showClear ? (
            <div className="cz-combobox-option is-empty">{emptyHint}</div>
          ) : (
            filtered.map((name, optionIdx) => (
              <button
                key={name}
                id={id + "-opt-" + optionIdx}
                type="button"
                role="option"
                aria-selected={name === value}
                className={
                  "cz-combobox-option" +
                  (name === value ? " is-current" : "") +
                  (optionIdx === activeIdx ? " is-active" : "")
                }
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActiveIdx(optionIdx)}
                onClick={() => pick(name)}
              >
                <span>{name}</span>
                {name === value ? <Check size={14} strokeWidth={2.4} aria-hidden="true" /> : null}
              </button>
            ))
          )}
          {showCreate ? (
            <button
              type="button"
              role="option"
              aria-selected={false}
              className="cz-combobox-option is-create"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(value)}
            >
              {createVerb} “{String(value).trim()}”
            </button>
          ) : null}
          {addNewLabel && !showCreate ? (
            <button
              type="button"
              role="option"
              aria-selected={false}
              className="cz-combobox-option is-create is-add-new"
              onMouseDown={(e) => e.preventDefault()}
              onClick={startCreate}
            >
              {addNewLabel}
            </button>
          ) : null}
          {showClear ? (
            <button
              type="button"
              role="option"
              aria-selected={false}
              className="cz-combobox-option is-clear"
              onMouseDown={(e) => e.preventDefault()}
              onClick={clearValue}
            >
              {clearLabel}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

// Haul directory cover: multi-item corner fan (transitions.dev CardCornerFan).
// Name + price sit in a separate label box below — not attached to the stack.
// One item = one flat card (no ghost stack). Two+ items fan on hover; on touch
// they rest half-fanned so multi-item hauls still read as stacks.
function HaulCoverFan({ covers = [], name = "", count = 0 }) {
  const [hovered, setHovered] = useState(false);
  const reduced = usePrefersReducedMotion();
  const coarse = useCoarsePointer();
  // Real covers only — never invent empty ghost cards for a 1-item haul.
  const images = covers.length ? covers.slice(0, 5) : [null];
  const slots = images;
  const total = slots.length;
  const single = total <= 1 || count <= 1;
  const angle = coarse && !hovered ? 22 : 36; // resting fan is tighter than hover fan
  // Single-item hauls stay flat. Multi-item: hover (desktop) or rest-open (touch).
  const open = !single && (hovered || coarse) && !reduced;

  return (
    <div
      className={"cz-haul-fan" + (single ? " is-single" : "")}
      onMouseEnter={() => !single && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-hidden="true"
    >
      {slots.map((src, i) => {
        const offsetRatio = total <= 1 ? 0 : i / (total - 1);
        const startAngle = -10;
        const targetRotate = open ? startAngle + offsetRatio * angle : 0;
        const x = open ? (offsetRatio - 0.5) * 10 : 0;
        return (
          <motion.div
            key={(src || "empty") + "-" + i}
            className={"cz-haul-fan-card" + (src ? "" : " is-empty")}
            animate={{
              rotate: targetRotate,
              x,
              scale: open && i === Math.floor(total / 2) ? 1.03 : 1,
            }}
            transition={
              reduced
                ? { duration: 0 }
                : { type: "spring", stiffness: 180, damping: 20, mass: 0.8 }
            }
            style={{
              zIndex: total - i,
              transformOrigin: "0% 100%",
            }}
          >
            {src ? (
              <img src={src} alt="" draggable={false} loading="lazy" decoding="async" />
            ) : (
              <div className="cz-haul-fan-placeholder">
                {(name || "?").slice(0, 1).toUpperCase()}
              </div>
            )}
          </motion.div>
        );
      })}
      {!single && count > slots.filter(Boolean).length ? (
        <span className="cz-haul-fan-more">+{count - slots.filter(Boolean).length}</span>
      ) : null}
    </div>
  );
}

// Haul control as a transitions.dev accordion — expand to pick / create / remove.
// Used on the card-back details face and the edit form.
function HaulAccordionField({
  label = "Haul",
  value = "",
  knownHauls = [],
  onChange,
  onCommit,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);
  const headRef = useRef(null);
  const bodyRef = useRef(null);
  const current = String(value || "").trim();

  // Arrow keys walk the rows (Part 5 a11y): focus moves through haul options,
  // the create row/input, and the clear row. Wraps at both ends.
  const focusRow = (delta) => {
    const rows = Array.from(
      bodyRef.current?.querySelectorAll("button, input") || []
    ).filter((el) => !el.disabled);
    if (rows.length === 0) return;
    const i = rows.indexOf(document.activeElement);
    const next =
      i < 0
        ? rows[delta > 0 ? 0 : rows.length - 1]
        : rows[(i + delta + rows.length) % rows.length];
    next.focus();
  };

  const onBodyKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      focusRow(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      focusRow(-1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      setCreating(false);
      headRef.current?.focus();
    }
  };

  useEffect(() => {
    if (open && creating && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select?.();
    }
  }, [open, creating]);

  const commit = (next) => {
    const cleaned = String(next || "").trim();
    onChange?.(cleaned);
    onCommit?.(cleaned);
    setCreating(false);
    setDraft("");
    setOpen(false);
  };

  const headLabel = current || "Add to a haul…";

  return (
    <div
      className={"t-acc cz-haul-acc" + (className ? " " + className : "")}
      data-open={open ? "true" : "false"}
    >
      <div className="cz-field-label">
        <span>{label}</span>
        <button
          type="button"
          ref={headRef}
          className="t-acc-head cz-haul-acc-head"
          aria-expanded={open}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
            if (open) setCreating(false);
          }}
          onKeyDown={(e) => {
            // ArrowDown from the head opens the list and lands on row one.
            if (e.key !== "ArrowDown") return;
            e.preventDefault();
            e.stopPropagation();
            if (!open) setOpen(true);
            requestAnimationFrame(() => focusRow(1));
          }}
        >
          <span className={"cz-haul-acc-value" + (current ? "" : " is-empty")}>{headLabel}</span>
          <span className="t-acc-chevron" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="14" height="14">
              <path
                d="M4 6.5L8 10.5L12 6.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </button>
      </div>
      <div className="t-acc-panel">
        <div className="t-acc-panel-inner">
          <div
            className="cz-haul-acc-body"
            role="listbox"
            aria-label="Hauls"
            aria-orientation="vertical"
            ref={bodyRef}
            onKeyDown={onBodyKeyDown}
            // Focus moves row to row (roving DOM focus), so the listbox
            // itself stays out of the tab order but must be focusable.
            tabIndex={-1}
          >
            {knownHauls.length === 0 && !creating ? (
              <div className="cz-haul-acc-empty">No hauls yet — create one below.</div>
            ) : (
              knownHauls.map((name) => (
                <button
                  key={name}
                  type="button"
                  role="option"
                  aria-selected={name === current}
                  className={"cz-haul-acc-option" + (name === current ? " is-current" : "")}
                  onClick={(e) => {
                    e.stopPropagation();
                    commit(name);
                  }}
                >
                  <span>{name}</span>
                  {name === current ? <Check size={14} strokeWidth={2.4} aria-hidden="true" /> : null}
                </button>
              ))
            )}

            {creating ? (
              <div className="cz-haul-acc-create">
                <input
                  ref={inputRef}
                  className="cz-field cz-haul-acc-input"
                  value={draft}
                  placeholder="Name the new haul…"
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (draft.trim()) commit(draft);
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      setCreating(false);
                      setDraft("");
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  type="button"
                  className="cz-haul-acc-create-btn"
                  disabled={!draft.trim()}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (draft.trim()) commit(draft);
                  }}
                >
                  Create
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="cz-haul-acc-option is-create"
                onClick={(e) => {
                  e.stopPropagation();
                  setCreating(true);
                  setDraft("");
                }}
              >
                + Add new haul
              </button>
            )}

            {current ? (
              <button
                type="button"
                className="cz-haul-acc-option is-clear"
                onClick={(e) => {
                  e.stopPropagation();
                  commit("");
                }}
              >
                Remove from haul
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

// Card-back write-through wrapper around the haul accordion.
// compact (product sheet): assigned haul is a quiet chip until the user expands it.
function CardBackHaulField({ item, knownHauls, onSaveEdit, compact = false }) {
  const current = String(item.project || "").trim();
  const [expanded, setExpanded] = useState(!compact || !current);
  useEffect(() => {
    // Re-collapse when the assigned haul changes externally (e.g. after pick).
    if (compact && current) setExpanded(false);
    if (compact && !current) setExpanded(true);
  }, [compact, current, item.id]);

  const commit = (next) => {
    const cleaned = String(next || "").trim();
    if ((item.project || "") !== cleaned) onSaveEdit?.(item.id, { project: cleaned });
    if (compact && cleaned) setExpanded(false);
  };

  if (compact && current && !expanded) {
    // CO-29: the wrapper div carried a bare stopPropagation onClick (a11y
    // lint: static element with a click handler). The buttons own it now.
    return (
      <div className="cz-haul-chip-row">
        <button
          type="button"
          className="cz-haul-chip"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(true);
          }}
          aria-label={"Change haul, currently " + current}
        >
          <span className="cz-haul-chip-label">In</span>
          <span className="cz-haul-chip-name">{current}</span>
        </button>
        <button
          type="button"
          className="cz-haul-chip-clear"
          aria-label="Remove from haul"
          title="Remove from haul"
          onClick={(e) => {
            e.stopPropagation();
            commit("");
          }}
        >
          <X size={13} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <HaulAccordionField
      label="Haul"
      value={item.project || ""}
      knownHauls={knownHauls}
      onChange={() => {}}
      onCommit={commit}
      className="cz-carousel-haul-field"
    />
  );
}

// Edit-mode photo strip: every indexed photo with a shake-trash delete, plus
// a + tile to add ones the resolver missed.
function EditPhotosManager({ item, onAttachPhoto, onRemovePhoto, max = 12 }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const photos = itemPhotoList(item, max);
  const canAdd = photos.length < max;

  const pickFile = async (file) => {
    if (!file || !onAttachPhoto) return;
    setBusy(true);
    try {
      await onAttachPhoto(item.id, file);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cz-edit-photos">
      <div className="cz-edit-photos-label">
        <span>Photos</span>
        <span className="cz-edit-photos-count">{photos.length}/{max}</span>
      </div>
      <div className="cz-edit-photos-grid">
        {photos.map((src, idx) => (
          <EditPhotoTile
            key={src + "-" + idx}
            src={src}
            index={idx}
            isCover={idx === 0 && item.image === src}
            onRemove={() => onRemovePhoto?.(item.id, src)}
          />
        ))}
        {canAdd ? (
          <button
            type="button"
            className="cz-edit-photo-add"
            aria-label="Add photo"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
          >
            <Plus size={20} strokeWidth={2.2} aria-hidden="true" />
            <span>{busy ? "Adding…" : "Add"}</span>
          </button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files && e.target.files[0];
          e.target.value = "";
          pickFile(file);
        }}
      />
    </div>
  );
}

function EditPhotoTile({ src, index, isCover, onRemove }) {
  const [hovered, setHovered] = useState(false);
  const reduced = usePrefersReducedMotion();
  return (
    <div
      className={"cz-edit-photo-tile" + (isCover ? " is-cover" : "")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <img src={src} alt={"Photo " + (index + 1)} draggable={false} loading="lazy" decoding="async" />
      {isCover ? <span className="cz-edit-photo-cover-badge">Cover</span> : null}
      {/* No trash ON the cover photo (Kyle 2026-07-22: "what is this over the
          cover photo"). Delete the cover by deleting it after another photo
          takes over — non-cover tiles keep the quiet delete. */}
      {isCover ? null : (
        <motion.button
          type="button"
          className="cz-edit-photo-delete"
          aria-label={"Delete photo " + (index + 1)}
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
          onMouseEnter={() => setHovered(true)}
          whileHover={reduced ? undefined : { scale: 1.06 }}
          whileTap={reduced ? undefined : { scale: 0.94 }}
        >
          <motion.span
            className="cz-edit-photo-delete-icon"
            animate={
              reduced || !hovered
                ? { y: 0, rotate: 0 }
                : { y: [0, -2, 0, -2, 0], rotate: [0, -10, 10, -10, 0] }
            }
            transition={{ duration: 0.4 }}
          >
            <Trash2 size={14} strokeWidth={2.2} aria-hidden="true" />
          </motion.span>
        </motion.button>
      )}
    </div>
  );
}

// Size options: listing variants first, then common apparel/shoe sizes.
function sizeSuggestionsFor(item) {
  const group = (item?.variants || []).find((g) => /size|尺码|尺寸/i.test(g.title || ""));
  const fromVariants = group
    ? group.values.map((v) => String(v || "").trim()).filter(Boolean)
    : [];
  const defaults = [
    "XS",
    "S",
    "M",
    "L",
    "XL",
    "XXL",
    "EU 40",
    "EU 41",
    "EU 42",
    "EU 43",
    "EU 44",
    "EU 45",
    "US 8",
    "US 9",
    "US 10",
    "US 11",
  ];
  const seen = new Set();
  const out = [];
  for (const s of [...fromVariants, ...defaults]) {
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

// ═══ UNIFIED EDIT FORM (standardization 2026-07-22, audit workstream C) ═══
// One draft builder, one patch builder, one write-through model (600ms
// autosave), one field layout. Surfaces differ only in the chrome around
// <ItemEditForm>. Draft carries only fields with inputs — summary/tags/links/
// importance/agentLink/findSource have no editor and are left untouched.

function buildEditDraft(item) {
  return {
    title: item.title || "",
    note: item.note || "",
    project: item.project || "",
    price: item.price == null ? "" : String(item.price),
    currency: item.currency || "CNY",
    seller: item.seller || "",
    batch: item.batch || "",
    size: item.size || "",
    colorway: item.colorway || "",
    findStatus: item.findStatus || "want",
    category: item.category || "",
    weightGrams: item.weightGrams == null ? "" : String(item.weightGrams),
  };
}

function buildEditPatch(draft, base) {
  const priceText = String(draft.price ?? "").trim();
  const parsed = priceText === "" ? null : Number(priceText);
  const weightText = String(draft.weightGrams ?? "").trim();
  const parsedWeight = weightText === "" ? null : Number(weightText);
  return {
    title: String(draft.title ?? "").trim() || base.title,
    note: String(draft.note ?? "").trim(),
    project: String(draft.project ?? "").trim(),
    // Guard: garbage input becomes null (cleared), never NaN in storage — the
    // pre-unification carousel form saved Number("abc") straight through.
    price: Number.isFinite(parsed) ? parsed : null,
    currency: String(draft.currency ?? "").trim() || "CNY",
    seller: String(draft.seller ?? "").trim(),
    batch: String(draft.batch ?? "").trim(),
    size: String(draft.size ?? "").trim(),
    colorway: String(draft.colorway ?? "").trim(),
    findStatus: draft.findStatus || "want",
    category: draft.category || "",
    // A6 weight override: null clears back to the category default. Same
    // garbage-input guard as price.
    weightGrams:
      Number.isFinite(parsedWeight) && parsedWeight > 0 ? Math.round(parsedWeight) : null,
  };
}

// Debounced write-through: every draft change persists after `delay` ms of
// quiet, and callers flush the trailing keystrokes via the returned ref
// before unmount/close. Replaces three hand-rolled copies (600 vs 700ms).
function useWriteThroughDraft(draft, onCommit, delay = 600) {
  const commitRef = useRef(() => {});
  commitRef.current = () => {
    if (draft) onCommit(draft);
  };
  useEffect(() => {
    if (!draft) return undefined;
    const t = setTimeout(() => commitRef.current(), delay);
    return () => clearTimeout(t);
  }, [draft, delay]);
  return commitRef;
}

// The one item edit form. Field order is the standard everywhere: identity →
// context (haul/photos) → money → seller → variant → pipeline → category.
function ItemEditForm({ item, ed, setEd, knownHauls, onAttachPhoto, onRemovePhoto }) {
  const recSize = item.recommendedSize || null;
  // A6: the placeholder shows the auto estimate for the draft's category, so
  // an empty field reads as "uses the default", not "no weight".
  const autoWeight = CATEGORY_WEIGHT_GRAMS[ed.category || item.category || ""] || null;
  return (
    <div className="cz-carousel-edit">
      <Field label="Title" value={ed.title} onChange={(v) => setEd({ ...ed, title: v })} placeholder="Name this card" />
      {/* Currency is not an edit field (Kyle 2026-07-23): the listed amount
          keeps its source currency; on-screen money order follows Profile →
          Primary currency. No boxed Currency control. */}
      <div className="cz-carousel-field-grid">
        <div>
          <Field label="Price" value={ed.price} onChange={(v) => setEd({ ...ed, price: v })} placeholder="0" />
        </div>
        <div>
          <Field
            label="Weight (g)"
            value={ed.weightGrams}
            onChange={(v) => setEd({ ...ed, weightGrams: v })}
            placeholder={autoWeight ? "Auto: " + autoWeight + " g" : "Grams"}
          />
        </div>
      </div>
      <div className="cz-carousel-field-grid">
        <div>
          <Field
            label="Size"
            value={ed.size}
            onChange={(v) => setEd({ ...ed, size: v })}
            placeholder="EU 42"
            suggestions={sizeSuggestionsFor(item)}
            emptyHint="Type a size"
            listLabel="Sizes"
            allowCreate
          />
        </div>
        <div>
          <Field label="Colorway" value={ed.colorway} onChange={(v) => setEd({ ...ed, colorway: v })} placeholder="Black/white" />
        </div>
      </div>
      <div className="cz-status-edit-label">Status</div>
      <StatusChips
        mode="display"
        value={ed.findStatus || "want"}
        onChange={(s) => setEd({ ...ed, findStatus: s })}
      />
      {recSize && (
        <div className="cz-fit-auto" aria-label="Fit auto">
          <div className="cz-fit-auto-kicker">Fit · auto</div>
          <div className="cz-fit-auto-size">Recommended: {formatSizeToken(recSize) || recSize}</div>
          <div className="cz-fit-auto-note">
            Regenerates when size or measurements change.
          </div>
        </div>
      )}
      <EditPhotosManager
        item={item}
        onAttachPhoto={onAttachPhoto}
        onRemovePhoto={onRemovePhoto}
      />
      <HaulAccordionField
        label="Haul"
        value={ed.project}
        knownHauls={knownHauls}
        onChange={(v) => setEd({ ...ed, project: v })}
        onCommit={(v) => setEd((prev) => (prev ? { ...prev, project: v } : prev))}
      />
      <Field
        label="Notes / links"
        value={ed.note || ""}
        onChange={(v) => setEd({ ...ed, note: v })}
        placeholder="Fit notes, QC reminders, sizing, seller tips, extra links…"
        rows={3}
      />
      <div className="cz-carousel-field-grid">
        <div>
          <Field label="Seller" value={ed.seller} onChange={(v) => setEd({ ...ed, seller: v })} placeholder="Store name" />
        </div>
        <div>
          <Field label="Batch" value={ed.batch} onChange={(v) => setEd({ ...ed, batch: v })} placeholder="e.g., M Batch" />
        </div>
      </div>
      <CategorySelect
        value={ed.category}
        onChange={(v) => setEd({ ...ed, category: v })}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════════
// ═══ COMPONENTS ═══
// ═══════════════════════════════════════════════════════════════════════════════════

// Stored prefs may name a retired/unknown agent — fall back to the soft default
// instead of stranding Buy buttons.
function validStoredAgentId(id) {
  const a = getAgent(id);
  return a && !a.retired ? a.id : DEFAULT_AGENT_ID;
}

// Open-button list for a card. Every Yupoo URL remains an external photo action,
// even if stale stored data claims another role. Buy is stable-first and is the
// only action rendered with dominant styling. Duplicate labels stay tellable.
// opts.buyLabel overrides the Buy caption (e.g. "Buy via Superbuy"); the URL is
// untouched — the agent wrap happens in recordOpen, never in stored data.
const LINK_ROLE_LABELS = { photos: "More Photos", buy: "Buy", alt: "Alt" };
function linkButtons(item, opts = {}) {
  const btns = [];
  function roleFor(url, storedRole) {
    const inferred = inferLinkRole(url);
    return inferred === "photos" ? "photos" : storedRole || inferred;
  }
  function labelFor(role) {
    if (role === "buy" && opts.buyLabel) return opts.buyLabel;
    if (role === "alt") return "Open";
    return LINK_ROLE_LABELS[role] || "Alt";
  }
  if (item.url) {
    const role = roleFor(item.url);
    btns.push({ url: ensureYupooAlbumUid(item.url), role, label: labelFor(role) });
  }
  for (const l of item.links || []) {
    if (l && l.url) {
      const role = roleFor(l.url, l.role);
      btns.push({ url: ensureYupooAlbumUid(l.url), role, label: labelFor(role) });
    }
  }
  btns.sort((a, b) => Number(b.role === "buy") - Number(a.role === "buy"));
  const counts = {};
  for (const b of btns) counts[b.label] = (counts[b.label] || 0) + 1;
  const seen = {};
  for (const b of btns) {
    if (counts[b.label] > 1) {
      seen[b.label] = (seen[b.label] || 0) + 1;
      if (seen[b.label] > 1) b.label = b.label + " " + seen[b.label];
    }
  }
  return btns;
}

// ═══ UNIFIED CARD FRONT INFO (Kyle 2026-07-23) ═══
// Grid card and carousel front read the same, title down: size line
// (manual size from Edit overrides the rec; EST = usual-size fallback when
// the item has no chart), seller, then the price as green USD text — no ¥
// when USD is known. linkSeller=false renders the seller as plain text: the
// grid card's whole face is one button, and nested anchors are invalid.
// layout="stack" — size, seller, price on three lines. The carousel front and
// the desktop grid card use this; the carousel is frozen, so it never changes.
// layout="row" — size and price share one baseline row, seller below. Phone
// grid card only (mobile handoff step 2): one line less per card.
function CardFrontInfo({ item, bodyProfile, fitPrefs = null, linkSeller = true, layout = "stack" }) {
  const size = resolveDisplaySize(item, bodyProfile, fitPrefs);
  const price = priceLabelShort(item);
  const sizeLine = (
    <div className="cz-front-size">
      {size.text ? (
        <span
          className={
            "cz-front-size-text" + (size.isRec ? " is-rec t-shimmer" : "")
          }
          data-text={size.isRec ? size.text : undefined}
        >
          {size.text}
        </span>
      ) : (
        <span aria-hidden="true">&nbsp;</span>
      )}
    </div>
  );
  const sellerLine = (
    <div className="cz-front-seller">
      {item.seller ? (
        linkSeller ? (
          <SellerLink item={item} />
        ) : (
          <span className="cz-seller-link is-text">{item.seller}</span>
        )
      ) : (
        <span aria-hidden="true">&nbsp;</span>
      )}
    </div>
  );
  const priceLine = (
    <div className="cz-front-price">
      {price ? price : <span aria-hidden="true">&nbsp;</span>}
    </div>
  );
  if (layout === "row") {
    return (
      <>
        <div className="cz-front-meta-row">
          {sizeLine}
          {priceLine}
        </div>
        {sellerLine}
      </>
    );
  }
  return (
    <>
      {sizeLine}
      {sellerLine}
      {priceLine}
    </>
  );
}

// ═══ GRID CARD (editorial front — design handoff 2a/2b) ═══
// At rest: photo hero, status flag top-left, quiet outline heart top-right,
// serif title, green price as text. No Buy button at rest.
// Focused/hover: lift + soft ring; heart fills; Buy fades over the photo.
// Tap opens the carousel overlay (no in-grid flip).
function Card({
  item,
  selected,
  onToggle,
  onToggleFavorite,
  onOpen,
  buyLabel,
  mode,
  phone = false,
  bodyProfile = null,
  fitPrefs = null,
}) {
  const reduced = usePrefersReducedMotion();
  const buy = linkButtons(item, { buyLabel }).find((b) => b.role === "buy") || null;

  return (
    <article
      id={"card-" + item.id}
      className="cz-editorial-card"
      aria-current={selected ? "true" : undefined}
      style={{ height: "100%" }}
    >
      <div
        className={
          "cz-card cz-card-editorial" +
          (phone ? " cz-card-twoline" : "") +
          (selected ? " is-selected" : "")
        }
        style={{
          background: CARD,
          borderRadius: 16,
          border: "1px solid " + (selected ? BLUE : HAIR),
          boxShadow: selected
            ? "0 0 0 3px " + BLUE_BG + ", 0 14px 32px rgba(23, 24, 26, 0.12)"
            : "0 6px 16px rgba(23, 24, 26, 0.06)",
          overflow: "hidden",
          display: "grid",
          position: "relative",
          transition: reduced ? "none" : "border-color .2s, box-shadow .2s, transform .2s",
          height: "100%",
        }}
      >
        <div className="cz-card-body">
          <div className="cz-card-photo">
            {/* One full-size open button per card (CO-01/KM-04): the card is
                not a button, and Star + Buy are siblings of this button,
                never children — no nested interactive controls. */}
            <button
              type="button"
              className="cz-card-toggle"
              aria-label={"Open " + (item.title || "saved item") + " in carousel"}
              onClick={onToggle}
              style={{
                display: "block",
                width: "100%",
                padding: 0,
                margin: 0,
                background: "transparent",
                border: 0,
                cursor: "pointer",
              }}
            >
              <CoverImage
                item={item}
                aspectRatio="4/5"
                maxHeight={phone ? 460 : 320}
                className="cz-card-image"
                imgStyle={{
                  borderRadius: 0,
                  outline: "1px solid " + (mode !== "light" ? "oklch(1 0 0 / 0.08)" : "oklch(0 0 0 / 0.08)"),
                  animation: reduced ? undefined : "credenza-fade 400ms ease-out both",
                }}
              />
              <StatusPill status={item.findStatus} className="cz-card-status" />
            </button>
            <FavoriteButton item={item} onToggle={onToggleFavorite} className="cz-card-favorite cz-card-favorite-onphoto" />
            {/* Buy-on-hover is fine-pointer only. On phone it can never show,
                so the node is dropped instead of hidden (handoff step 2). */}
            {buy && onOpen && !phone && (
              <span className="cz-card-buy-hover">
                <button
                  type="button"
                  className="cz-buy-btn cz-border-beam"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onOpen(item, buy.url);
                  }}
                >
                  <span className="cz-buy-btn-label">{buy.label}</span>
                  <span className="cz-border-beam-glow" aria-hidden="true" />
                </button>
              </span>
            )}
          </div>

          {/* Mouse-only duplicate of the open action (click the title/meta to
              open). Keyboard + AT use the photo button above — one tab stop. */}
          <button
            type="button"
            className="cz-card-toggle"
            tabIndex={-1}
            aria-hidden="true"
            onClick={onToggle}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: 0,
              margin: 0,
              background: "transparent",
              border: 0,
              cursor: "pointer",
            }}
          >
            <div className="cz-card-title cz-card-title-serif">{item.title}</div>
            <CardFrontInfo
              item={item}
              bodyProfile={bodyProfile}
              fitPrefs={fitPrefs}
              linkSeller={false}
              layout={phone ? "row" : "stack"}
            />
          </button>
        </div>
      </div>
    </article>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════════
// ═══ CAROUSEL VIEW (Velvet) ═══
// ═══════════════════════════════════════════════════════════════════════════════════

export function findNearestCarouselIndex(centers, scrollCenter) {
  let closest = 0;
  let minDist = Infinity;
  centers.forEach((center, index) => {
    const dist = Math.abs(scrollCenter - center);
    if (dist < minDist) {
      minDist = dist;
      closest = index;
    }
  });
  return closest;
}

export function carouselForegroundWithHysteresis(centers, current, scrollCenter) {
  let foreground = Math.max(0, Math.min(centers.length - 1, current));
  const hysteresisFor = (a, b) => Math.min(20, Math.abs(centers[b] - centers[a]) * 0.08);
  while (foreground < centers.length - 1) {
    const boundary = (centers[foreground] + centers[foreground + 1]) / 2;
    if (scrollCenter <= boundary + hysteresisFor(foreground, foreground + 1)) break;
    foreground += 1;
  }
  while (foreground > 0) {
    const boundary = (centers[foreground - 1] + centers[foreground]) / 2;
    if (scrollCenter >= boundary - hysteresisFor(foreground - 1, foreground)) break;
    foreground -= 1;
  }
  return foreground;
}

export function carouselLayerZ(cardCount, index, foreground) {
  const indexDist = Math.abs(index - foreground);
  return cardCount * 2 - indexDist * 2 - (index > foreground ? 1 : 0);
}

// Size pick, "nice and in their face" (Kyle 2026-07-22). Chart text comes from
// sizeNotes/summary/rawText AND the user's own notes — Notes is the natural
// place to paste a chart, and excluding it meant a pasted chart silently did
// nothing (Kyle's "no values, no recommended size" report). If none parses,
// offer a fetch that reads the Yupoo album description ("look somewhere else")
// and caches whatever it finds back into sizeNotes so the next open is
// All the free-text fields a size chart can hide in, in priority order.
export function sizeChartTextFor(item) {
  return [item.sizeNotes, item.summary, item.rawText, item.note].filter(Boolean).join("\n");
}

// Translated chart view (Kyle 2026-07-22: "clicking recommended size pulls up
// the sizing sheet, or even a translation"). parseSizeChart already normalizes
// Chinese labels into measure keys, so translation is just a header map.
const MEASURE_COLS = [
  ["chest", "Chest"],
  ["shoulder", "Shoulder"],
  ["sleeve", "Sleeve"],
  ["waist", "Waist"],
  ["hip", "Hip"],
  ["pantsLength", "Pants length"],
  ["length", "Length"],
];

function SizeChartTable({ chart, units, highlight, highlightAlt }) {
  const cols = MEASURE_COLS.filter(([key]) => chart.rows.some((r) => r[key] != null));
  return (
    <table className="cz-size-chart-table">
      <thead>
        <tr>
          <th scope="col">Size</th>
          {cols.map(([key, label]) => (
            <th scope="col" key={key}>{label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {chart.rows.map((row) => (
          <tr
            key={row.size}
            className={
              row.size === highlight ? "is-rec" : row.size === highlightAlt ? "is-alt" : undefined
            }
          >
            <th scope="row">{row.size}</th>
            {cols.map(([key]) => (
              <td key={key}>{row[key] != null ? formatMeasure(row[key], units) : "—"}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Session-scoped guard: the silent chart hunt runs at most once per item per
// session (one album-text attempt + one vision scan of the album photos).
const chartAutoFetchTried = new Set();

// Measure fields the progressive fit ask needs for this category (design 4f).
// Tops → chest. Bottoms → waist (+ inseam when useful). Fallback → chest + waist.
function fitMeasureFieldsFor(category) {
  if (category === "pants" || category === "shorts") {
    return [
      { key: "waist", label: "Waist", kind: "length", phCm: "80", phIn: "31.5" },
      { key: "inseam", label: "Inseam", kind: "length", phCm: "81", phIn: "32" },
    ];
  }
  if (category === "outerwear" || category === "shirt") {
    return [
      { key: "chest", label: "Chest", kind: "length", phCm: "96", phIn: "38" },
    ];
  }
  return [
    { key: "chest", label: "Chest", kind: "length", phCm: "96", phIn: "38" },
    { key: "waist", label: "Waist", kind: "length", phCm: "80", phIn: "31.5" },
  ];
}

function fitHasPreciseBody(bodyProfile, category) {
  if (!bodyProfile) return false;
  if (category === "pants" || category === "shorts") {
    return bodyProfile.waist != null || bodyProfile.hip != null;
  }
  if (category === "outerwear" || category === "shirt") {
    return bodyProfile.chest != null;
  }
  return bodyProfile.chest != null || bodyProfile.waist != null || bodyProfile.hip != null;
}

// Segmented axis control for Length / Looseness (design 5a/5b).
// Empty selection = no preference. Tap active again to clear.
export function FitPrefAxis({ label, options, value, onChange }) {
  return (
    <div className="cz-fit-pref-axis">
      <div className="cz-fit-pref-axis-label">{label}</div>
      <div className="cz-fit-pref-axis-row" role="radiogroup" aria-label={label}>
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              type="button"
              key={opt.value}
              role="radio"
              aria-checked={active}
              className={"cz-fit-pref-chip" + (active ? " is-active" : "")}
              onClick={() => onChange(active ? null : opt.value)}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Design 4d–4g fit flow + turn 5 taste. Honest confidence, never a dead end
// when a chart exists. 4d nothing · 4e rough usual · 4f measure ask · 4g precise
// · 5b in-context preference · 5c pref visible on rec.
function SizeRecommendation({
  item,
  bodyProfile,
  units = "cm",
  sizeActive = false,
  onSaveEdit,
  onSaveBodyProfile,
  fitPromptSkipped = false,
  onSkipFitPrompt,
  fitPref = null,
  onSaveFitPref,
}) {
  const [chartOpen, setChartOpen] = useState(false);
  const [askingMeasures, setAskingMeasures] = useState(false);
  const [askingPref, setAskingPref] = useState(false);
  const [prefDraft, setPrefDraft] = useState({ length: null, looseness: null });
  const measureFields = fitMeasureFieldsFor(item.category);
  const [fitDraft, setFitDraft] = useState(() => {
    const d = { usualSize: "" };
    for (const f of measureFields) d[f.key] = "";
    return d;
  });
  const skipped = SIZE_PICK_SKIP_CATEGORIES.has(item.category);
  const chart = skipped ? null : parseSizeChart(sizeChartTextFor(item));
  const catAxes = FIT_PREF_AXES[item.category] || null;
  const rec =
    chart && bodyProfile
      ? recommendSize(chart, bodyProfile, item.category, fitPref)
      : null;
  const recSize = rec && rec.size ? rec.size : null;
  const hasUsual = !!(bodyProfile && bodyProfile.usualSize);
  const hasPrecise = fitHasPreciseBody(bodyProfile, item.category);
  // Need a taste prompt once per category when axes exist and user has not
  // saved or dismissed a preference yet.
  const needsPrefAsk =
    !!catAxes &&
    !!onSaveFitPref &&
    sizeActive &&
    !!chart &&
    !fitPrefHasChoice(fitPref) &&
    !(fitPref && fitPref.dismissed);
  // Persist the pick so every surface agrees with this box — meta chips and
  // edit form read item.recommendedSize. Guarded: one write when it changes.
  useEffect(() => {
    if (recSize && recSize !== item.recommendedSize) {
      onSaveEdit(item.id, { recommendedSize: recSize });
    }
  }, [recSize, item.id, item.recommendedSize, onSaveEdit]);

  // Silent chart hunt: album text first, then a vision scan of the album
  // PHOTOS (where Yupoo charts actually live). Found charts land in sizeNotes
  // and the pick simply appears — no "Find size chart" button anywhere.
  useEffect(() => {
    if (!sizeActive || skipped || chart) return;
    const album = yupooAlbumUrl(item);
    if (!album || chartAutoFetchTried.has(item.id)) return;
    chartAutoFetchTried.add(item.id);
    let cancelled = false;
    (async () => {
      const data = await fetchYupooImages(album);
      if (cancelled) return;
      const text = [data && data.description, data && data.sizeNotes].filter(Boolean).join("\n");
      if (text.trim() && parseSizeChart(text)) {
        onSaveEdit(item.id, { sizeNotes: (item.sizeNotes ? item.sizeNotes.trim() + "\n" : "") + text.trim() });
        return;
      }
      const photos = (data && data.images) || [];
      if (!photos.length) return;
      const chartText = await fetchChartFromPhotos(photos.slice(-10), { referer: album });
      if (!cancelled && chartText && parseSizeChart(chartText)) {
        onSaveEdit(item.id, { sizeNotes: (item.sizeNotes ? item.sizeNotes.trim() + "\n" : "") + chartText });
      }
    })();
    return () => { cancelled = true; };
  }, [sizeActive, skipped, chart, item, onSaveEdit]);

  // Prefill measure ask from the saved body profile when the sheet opens.
  useEffect(() => {
    if (!askingMeasures) return;
    setFitDraft((prev) => {
      const next = { ...prev };
      if (bodyProfile && bodyProfile.usualSize && !next.usualSize) {
        next.usualSize = String(bodyProfile.usualSize);
      }
      for (const f of measureFields) {
        if (!next[f.key] && bodyProfile && bodyProfile[f.key] != null) {
          next[f.key] = measureFromStorage(bodyProfile[f.key], units, f.kind);
        }
      }
      return next;
    });
  }, [askingMeasures]); // eslint-disable-line react-hooks/exhaustive-deps

  if (skipped) return null;

  const unitHint = units === "in" ? "in" : "cm";
  const catLabel =
    item.category && CATEGORIES[item.category]
      ? CATEGORIES[item.category].label.toLowerCase()
      : "this item";

  const openMeasureAsk = () => {
    const next = { usualSize: (bodyProfile && bodyProfile.usualSize) || "" };
    for (const f of measureFields) {
      next[f.key] =
        bodyProfile && bodyProfile[f.key] != null
          ? measureFromStorage(bodyProfile[f.key], units, f.kind)
          : "";
    }
    setFitDraft(next);
    setAskingMeasures(true);
  };

  const saveMeasureAsk = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onSaveBodyProfile) return;
    const next = {};
    if ((fitDraft.usualSize || "").trim()) next.usualSize = fitDraft.usualSize.trim();
    for (const f of measureFields) {
      const stored = measureToStorage(fitDraft[f.key], units, f.kind);
      if (stored != null) next[f.key] = stored;
    }
    onSaveBodyProfile(next);
    setAskingMeasures(false);
  };

  // 4f — measure ask (category-dependent fields only).
  if (askingMeasures && onSaveBodyProfile) {
    const fieldNames = measureFields.map((f) => f.label.toLowerCase()).join(" and ");
    return (
      <form className="cz-fit-prompt cz-fit4-ask" onSubmit={saveMeasureAsk}>
        <div className="cz-fit-prompt-title">Your measurements</div>
        <p className="cz-fit-prompt-copy">
          For {catLabel} we need your {fieldNames}. Saved for every item.
        </p>
        <div
          className={
            "cz-fit-prompt-fields" +
            (measureFields.length === 1 ? " is-one" : "")
          }
        >
          {measureFields.map((f) => (
            <label className="cz-fit-prompt-field" key={f.key}>
              <span className="cz-fit-prompt-label">{f.label}</span>
              <span className="cz-fit-prompt-control">
                <input
                  inputMode="decimal"
                  placeholder={units === "in" ? f.phIn : f.phCm}
                  value={fitDraft[f.key] || ""}
                  onChange={(e) =>
                    setFitDraft((d) => ({
                      ...d,
                      [f.key]: e.target.value.replace(/[^\d.]/g, ""),
                    }))
                  }
                  aria-label={f.label + " in " + unitHint}
                />
                <span className="cz-fit-prompt-unit" aria-hidden="true">
                  {unitHint}
                </span>
              </span>
            </label>
          ))}
          <label className="cz-fit-prompt-field cz-fit-prompt-size">
            <span className="cz-fit-prompt-label">Usual size (backup)</span>
            <span className="cz-fit-prompt-control">
              <input
                placeholder="M"
                value={fitDraft.usualSize || ""}
                onChange={(e) =>
                  setFitDraft((d) => ({ ...d, usualSize: e.target.value }))
                }
                aria-label="Usual size"
              />
            </span>
          </label>
        </div>
        <div className="cz-fit-prompt-actions">
          <button type="submit" className="cz-fit-prompt-save">
            Save & recalculate
          </button>
          <button
            type="button"
            className="cz-fit-prompt-skip"
            onClick={() => {
              setAskingMeasures(false);
              if (!hasUsual && onSkipFitPrompt) onSkipFitPrompt();
            }}
          >
            {hasUsual ? "Skip — keep the rough size" : "Skip for now"}
          </button>
        </div>
      </form>
    );
  }

  // 5b — in-context taste ask. Auto after a precise body exists for this
  // category, or when the user taps Edit on the rec. Measures come first.
  const showPrefAsk =
    catAxes &&
    onSaveFitPref &&
    !askingMeasures &&
    sizeActive &&
    !!bodyProfile &&
    (askingPref || needsPrefAsk);
  if (showPrefAsk) {
    const catTitle = CATEGORIES[item.category]
      ? CATEGORIES[item.category].label.toLowerCase()
      : "this item";
    return (
      <div className="cz-fit-pref-ask">
        <div className="cz-fit-pref-ask-title">How do you wear {catTitle}?</div>
        <p className="cz-fit-pref-ask-copy">
          Sets your default for all {catTitle}. Change any time in Settings.
        </p>
        <FitPrefAxis
          label="Length"
          options={catAxes.length}
          value={prefDraft.length}
          onChange={(v) => setPrefDraft((d) => ({ ...d, length: v }))}
        />
        <FitPrefAxis
          label="Looseness"
          options={catAxes.looseness}
          value={prefDraft.looseness}
          onChange={(v) => setPrefDraft((d) => ({ ...d, looseness: v }))}
        />
        <button
          type="button"
          className="cz-fit-pref-ask-save"
          onClick={() => {
            onSaveFitPref(item.category, {
              length: prefDraft.length,
              looseness: prefDraft.looseness,
              dismissed: false,
            });
            setAskingPref(false);
          }}
        >
          Save preference
        </button>
        <button
          type="button"
          className="cz-fit-prompt-skip"
          onClick={() => {
            onSaveFitPref(item.category, {
              length: null,
              looseness: null,
              dismissed: true,
            });
            setAskingPref(false);
          }}
        >
          Not sure yet
        </button>
      </div>
    );
  }

  // Chart table shared by rec blocks.
  const chartBlock =
    chartOpen && chart ? (
      <div className="cz-size-chart-wrap">
        <SizeChartTable
          chart={chart}
          units={units}
          highlight={rec && rec.size}
          highlightAlt={rec && rec.alt && rec.alt.size}
        />
      </div>
    ) : null;

  // 4d — nothing yet: no usual size, no measures. Do not fabricate a size.
  if (!bodyProfile && chart && sizeActive && !fitPromptSkipped && onSaveBodyProfile) {
    return (
      <div className="cz-fit4-empty">
        <div className="cz-fit4-empty-title">Will it fit you?</div>
        <p className="cz-fit4-empty-copy">
          Add your usual size and we will size every item on your shelf. Takes 10 seconds.
        </p>
        <button type="button" className="cz-fit4-empty-btn" onClick={openMeasureAsk}>
          Add my size
        </button>
        {onSkipFitPrompt ? (
          <button
            type="button"
            className="cz-fit-prompt-skip"
            onClick={() => onSkipFitPrompt()}
          >
            Skip for now
          </button>
        ) : null}
      </div>
    );
  }

  // Soft / missing-measure path: show usual size as a rough estimate (4e).
  const usualWord =
    hasUsual
      ? formatSizeToken(bodyProfile.usualSize) || String(bodyProfile.usualSize)
      : null;
  const isRough =
    !!usualWord &&
    (!(rec && rec.size) || (rec && rec.missing) || !hasPrecise);

  if (isRough && usualWord) {
    const missingKey =
      (rec && rec.missing) ||
      (item.category === "pants" || item.category === "shorts"
        ? "waist"
        : "chest");
    const sharpenLabel =
      item.category === "pants" || item.category === "shorts"
        ? "Add waist & inseam"
        : item.category === "shirt" || item.category === "outerwear"
          ? "Add chest"
          : "Add chest & waist";
    return (
      <div className="cz-fit4">
        <div className="cz-fit4-head">
          <div className="cz-fit4-kicker t-shimmer" data-text="We recommend">We recommend</div>
          <span className="cz-fit4-badge is-rough">
            <span className="cz-fit4-badge-dot" aria-hidden="true" />
            Rough estimate
          </span>
        </div>
        <button
          type="button"
          className="cz-fit4-size"
          aria-expanded={chartOpen}
          title={chart ? "Show the seller’s size chart" : undefined}
          onClick={(e) => {
            e.stopPropagation();
            if (chart) setChartOpen((v) => !v);
          }}
        >
          {usualWord}
        </button>
        <p className="cz-fit4-prose">
          Based on your usual size alone
          {missingKey ? ". Add your " + missingKey + " for a chart-based fit." : "."}
        </p>
        {onSaveBodyProfile ? (
          <button type="button" className="cz-fit4-sharpen" onClick={openMeasureAsk}>
            <span>{sharpenLabel}</span>
            <span className="cz-fit4-sharpen-meta">+ sharper ›</span>
          </button>
        ) : null}
        {chartBlock}
      </div>
    );
  }

  // Need measures, no usual size either — honest empty after skip.
  if (rec && rec.missing && !usualWord) {
    return (
      <div className="cz-fit4-empty">
        <div className="cz-fit4-empty-title">Need your {rec.missing}</div>
        <p className="cz-fit4-empty-copy">
          The size chart is ready. Add your {rec.missing} to get a recommendation.
        </p>
        {onSaveBodyProfile ? (
          <button type="button" className="cz-fit4-empty-btn" onClick={openMeasureAsk}>
            Add my size
          </button>
        ) : null}
      </div>
    );
  }

  if (!rec || !rec.size) return null;

  // 4g — precise fit (+ 5c preference payoff when taste shifted the size).
  const sizeWord = formatSizeToken(rec.size) || rec.size;
  const baseWord =
    rec.baseSize && String(rec.baseSize).toUpperCase() !== String(rec.size).toUpperCase()
      ? formatSizeToken(rec.baseSize) || rec.baseSize
      : null;
  const measureWord =
    rec.primaryKey === "waist" ? "waist" : rec.primaryKey === "hip" ? "hip" : "chest";
  const fitSentence = FIT_SUMMARY_ON
    ? fitSummarySentence(rec, {
        runHint: chart && chart.runHint,
        units,
        detail: "detailed",
      })
    : "";
  let preciseProse =
    rec.prefReason ||
    fitSentence ||
    ("Your " +
      formatMeasure(rec.body, units) +
      " " +
      measureWord +
      " sits on the " +
      sizeWord +
      "; the garment " +
      measureWord +
      " is " +
      formatMeasure(rec.garment, units) +
      ".");
  const easeStr =
    (rec.diff >= 0 ? "+" : "−") + formatMeasure(Math.abs(rec.diff), units);
  const runValues =
    ((item.variants || []).find((g) => /size|尺码|尺寸/i.test(g.title)) || {})
      .values || [];
  const inRun = runValues.length
    ? runValues.some((v) => String(v).toUpperCase() === rec.size)
    : true;
  const activePref = rec.fitPref || (fitPrefHasChoice(fitPref) ? fitPref : null);
  const lengthTag =
    activePref && activePref.length
      ? fitPrefLabel(item.category, "length", activePref.length)
      : null;
  const looseTag =
    activePref && activePref.looseness
      ? fitPrefLabel(item.category, "looseness", activePref.looseness)
      : null;

  return (
    <div className="cz-fit4">
      <div className="cz-fit4-head">
        <div className="cz-fit4-kicker t-shimmer" data-text="We recommend">We recommend</div>
        <span className="cz-fit4-badge is-precise">
          <span className="cz-fit4-badge-dot" aria-hidden="true" />
          Precise fit
        </span>
      </div>
      <div className="cz-fit4-size-row">
        <button
          type="button"
          className="cz-fit4-size"
          aria-expanded={chartOpen}
          title={chart ? "Show the seller’s size chart" : undefined}
          onClick={(e) => {
            e.stopPropagation();
            if (chart) setChartOpen((v) => !v);
          }}
        >
          {sizeWord}
        </button>
        {baseWord ? (
          <>
            <span className="cz-fit4-size-base" aria-label={"Base size " + baseWord}>
              {baseWord}
            </span>
            <span className="cz-fit4-size-shift">
              {rec.prefShift === "down" ? "sized down" : "sized up"}
            </span>
          </>
        ) : null}
      </div>
      <p className="cz-fit4-prose">{preciseProse}</p>
      {/* Kyle 2026-07-23: the math row is the no-preference payoff (4g). When
          taste shifted the size (5c), the reason line + pref tags carry the
          why — showing both stacked read as clutter. */}
      {!baseWord && !lengthTag && !looseTag && (
      <div className="cz-fit4-math" aria-label="Fit numbers">
        <div className="cz-fit4-math-cell">
          <div className="cz-fit4-math-k">You</div>
          <div className="cz-fit4-math-v">{formatMeasure(rec.body, units)}</div>
        </div>
        <div className="cz-fit4-math-cell">
          <div className="cz-fit4-math-k">Garment</div>
          <div className="cz-fit4-math-v">{formatMeasure(rec.garment, units)}</div>
        </div>
        <div className="cz-fit4-math-cell">
          <div className="cz-fit4-math-k">Ease</div>
          <div className="cz-fit4-math-v is-money">{easeStr}</div>
        </div>
      </div>
      )}
      {/* Pref payoff row — only when a preference is actually set. With no
          tags the bar was a bare divider + Edit; Settings → Fit covers that
          path (Kyle 2026-07-23: cut the clutter). */}
      {(lengthTag || looseTag) && catAxes ? (
        <div className="cz-fit4-pref-bar">
          <div className="cz-fit4-pref-tags">
            {lengthTag ? <span className="cz-fit4-pref-tag">{lengthTag}</span> : null}
            {looseTag ? <span className="cz-fit4-pref-tag">{looseTag}</span> : null}
          </div>
          {onSaveFitPref ? (
            <button
              type="button"
              className="cz-fit4-pref-edit"
              onClick={() => {
                setPrefDraft({
                  length: (fitPref && fitPref.length) || null,
                  looseness: (fitPref && fitPref.looseness) || null,
                });
                setAskingPref(true);
              }}
            >
              Edit
            </button>
          ) : null}
        </div>
      ) : null}
      {!inRun && (
        <p className="cz-fit4-warn">
          {rec.size} is not in this seller’s listed run ({runValues.join(" · ")}).
        </p>
      )}
      {/* The detailed fit summary already names the runner-up — only fall
          back to the bare alt line when the summary is off. */}
      {rec.alt && !baseWord && !fitSentence && (
        <p className="cz-fit4-alt">
          {rec.alt.size} also works
          {rec.alt.fit && rec.alt.fit !== "same" ? " if you want it " + rec.alt.fit : ""}.
        </p>
      )}
      {chartBlock}
    </div>
  );
}

// Body measurements — the input half of the size pick. Lives in prefs, edited
// from the ⋯ menu. Storage is always cm/kg; the in/cm toggle (default in for
// US) only changes what the fields show and accept — switching converts the
// draft in place so nothing typed is lost. Every field optional; the
// recommender asks for whatever it's missing.
export const BODY_PROFILE_FIELDS = [
  // key, label, kind ("length"|"weight"), placeholder cm, placeholder in
  ["height", "Height", "length", "178", "70"],
  ["weight", "Weight", "weight", "70", "154"],
  ["chest", "Chest", "length", "96", "38"],
  ["shoulder", "Shoulder", "length", "45", "17.7"],
  ["sleeve", "Arm length", "length", "62", "24.5"],
  ["waist", "Waist", "length", "80", "31.5"],
  ["hip", "Hip", "length", "98", "38.5"],
  ["inseam", "Inseam (leg length)", "length", "81", "32"],
];
function InfoBubble({ title, children, onClose }) {
  return (
    <div className="cz-info-bubble">
      <div className="cz-info-bubble-line" aria-hidden="true" />
      <div className="cz-info-bubble-card">
        <div className="cz-info-bubble-header">
          <span>{title}</span>
          <button type="button" onClick={onClose} aria-label="Close details">
            ×
          </button>
        </div>
        <div className="cz-info-bubble-body">{children}</div>
      </div>
    </div>
  );
}

// Size facts live inside SizeRecommendation now — no second "Sizes" bubble.

// Photo fan on the card back (Kyle 2026-07-22): keep the little-card fan
// language — flat grid looked like a dump (size-chart cells etc.).
// variant "roomy" = taller peels for the product sheet so the back isn't empty.
// variant "compact" = original 80×60 stack (legacy / tight spots).
// Tap opens the full-screen gallery. Carousel physics untouched.
function CardCornerFan({
  item,
  images,
  onOpenPhotos,
  reduced,
  interactive = true,
  variant = "compact",
}) {
  const roomy = variant === "roomy";
  const maxShow = roomy ? 6 : 4;
  const cardW = roomy ? 88 : 60;
  const [isHovered, setIsHovered] = useState(false);
  const fanRef = useRef(null);
  const [fanWidth, setFanWidth] = useState(roomy ? 320 : 284);
  useEffect(() => {
    const fan = fanRef.current;
    if (!fan) return;
    const update = () => setFanWidth(fan.clientWidth || (roomy ? 320 : 284));
    update();
    if (!window.ResizeObserver) return;
    const observer = new window.ResizeObserver(update);
    observer.observe(fan);
    return () => observer.disconnect();
  }, [roomy]);
  const list = Array.isArray(images) ? images.filter(Boolean) : [];
  const displayed = list.slice(0, maxShow);
  const total = displayed.length;
  const maxStep = roomy ? 78 : 66;
  const spreadStep =
    total > 1 ? Math.min(maxStep, Math.max(0, (fanWidth - cardW) / (total - 1))) : 0;
  if (total === 0) return null;

  const openGallery = (e) => {
    if (!interactive) return;
    e?.stopPropagation?.();
    if (onOpenPhotos) onOpenPhotos(item, e?.currentTarget);
  };

  return (
    <div
      ref={fanRef}
      className={"cz-corner-fan" + (roomy ? " is-roomy" : "")}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
      onClick={openGallery}
      role="button"
      tabIndex={interactive ? 0 : -1}
      aria-label="Open photo gallery"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          if (!interactive) return;
          e.preventDefault();
          openGallery(e);
        }
      }}
    >
      {displayed.map((src, i) => {
        // Cover left; rest peel flat on hover. Roomy starts half-open so the
        // tall product sheet already shows a fan, not a stacked stamp pile.
        const hover = isHovered;
        const restStep = roomy ? Math.min(spreadStep * 0.55, maxStep * 0.55) : 2;
        const step = hover ? spreadStep : restStep;
        const x = total <= 1 ? 0 : i * step;
        const angle = hover ? 0 : roomy ? i * 1.1 : i * 1.5;
        return (
          <motion.div
            key={src + i}
            className="cz-corner-fan-card"
            animate={{
              rotate: angle,
              x,
              y: 0,
              scale: hover && i === 0 ? 1.04 : 1,
              zIndex: maxShow + 1 - i,
            }}
            transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 240, damping: 22 }}
            style={{ originX: 0.5, originY: 1 }}
          >
            <img src={src} alt={"Gallery image " + (i + 1)} draggable={false} loading="lazy" decoding="async" />
          </motion.div>
        );
      })}
      {list.length > maxShow && (
        <span className="cz-corner-fan-more">+{list.length - maxShow}</span>
      )}
      {roomy && list.length > 1 ? (
        <span className="cz-corner-fan-caption">
          {list.length} photos · hover to fan · tap to browse
        </span>
      ) : null}
    </div>
  );
}

// ═══ STANDARDIZED CARD BACK (standardization 2026-07-22, audit workstream B) ═══
// A5 (docs/Monetization.md): Warehouse QC — the agent's check photos live
// here, distinct from the product gallery, plus one-tap GL/RL. GL clears the
// card to ship; RL sends it back. Both stamp qcVerdictAt; the note is
// optional. The section appears once a card reaches the warehouse (qc/gl/rl)
// or already has QC photos.
function WarehouseQcSection({ item, onSaveEdit, onOpenPhotos, isCenter }) {
  const qcPhotos = Array.isArray(item.qcPhotos) ? item.qcPhotos.filter(Boolean) : [];
  const [noteDraft, setNoteDraft] = useState(item.qcNote || "");
  const fileRef = useRef(null);
  useEffect(() => {
    setNoteDraft(item.qcNote || "");
  }, [item.id, item.qcNote]);

  const QC_PHOTO_CAP = 12;
  const atCap = qcPhotos.length >= QC_PHOTO_CAP;

  const attachQc = async (file) => {
    if (!file || atCap) return;
    try {
      const dataUrl = await compressImageBlob(file);
      onSaveEdit?.(item.id, (x) => ({
        qcPhotos: [...(Array.isArray(x.qcPhotos) ? x.qcPhotos : []), dataUrl].slice(0, 12),
      }));
    } catch (e) {
      // Read failure: leave the card untouched (graceful degradation, §11).
    }
  };

  // Task 10 (Part 5): pasting an image anywhere in the QC section attaches it
  // as a QC photo — agent screenshots rarely come as files. Text pastes fall
  // through to the note field untouched.
  const onPaste = (e) => {
    const clipItems = e.clipboardData?.items;
    if (!clipItems) return;
    for (const clipItem of clipItems) {
      if (clipItem.type && clipItem.type.startsWith("image/")) {
        const file = clipItem.getAsFile();
        if (file) {
          e.preventDefault();
          attachQc(file);
          return;
        }
      }
    }
  };

  const verdict = (v) =>
    onSaveEdit?.(item.id, {
      findStatus: v,
      qcVerdictAt: new Date().toISOString(),
      qcNote: String(noteDraft || "").trim(),
    });

  const verdictLabel = item.qcVerdictAt
    ? (item.findStatus === "gl" ? "GL" : item.findStatus === "rl" ? "RL" : "QC") +
      " · " +
      new Date(item.qcVerdictAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "";

  return (
    <section className="cz-sheet-section cz-qc" aria-label="Warehouse QC" onPaste={onPaste}>
      <div className="cz-qc-head">
        <span className="cz-qc-title">Warehouse QC</span>
        {verdictLabel ? <span className="cz-qc-verdict">{verdictLabel}</span> : null}
        <span className="cz-qc-cap" aria-label={qcPhotos.length + " of " + QC_PHOTO_CAP + " QC photos"}>
          {qcPhotos.length}/{QC_PHOTO_CAP}
        </span>
      </div>
      {qcPhotos.length > 0 ? (
        <div className="cz-qc-thumbs" role="list" aria-label="QC photos">
          {qcPhotos.map((src, i) => (
            <div className="cz-qc-thumb" role="listitem" key={src.slice(-24) + i}>
              <button
                type="button"
                className="cz-qc-thumb-open"
                aria-label={"Open QC photo " + (i + 1)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isCenter) return;
                  onOpenPhotos?.(item, {
                    images: qcPhotos,
                    startIndex: i,
                    trigger: e.currentTarget,
                  });
                }}
              >
                <img src={src} alt="" loading="lazy" decoding="async" />
              </button>
              <button
                type="button"
                className="cz-qc-thumb-remove"
                aria-label={"Remove QC photo " + (i + 1)}
                onClick={(e) => {
                  e.stopPropagation();
                  onSaveEdit?.(item.id, (x) => ({
                    qcPhotos: (Array.isArray(x.qcPhotos) ? x.qcPhotos : []).filter(
                      (g) => g !== src
                    ),
                  }));
                }}
              >
                <X aria-hidden="true" size={11} strokeWidth={2.6} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="cz-qc-empty">No QC photos yet. Add the ones your agent sends.</p>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="cz-qc-file"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          attachQc(e.target.files && e.target.files[0]);
          e.target.value = "";
        }}
      />
      <div className="cz-qc-actions">
        <button
          type="button"
          className="cz-qc-add"
          onClick={() => fileRef.current?.click()}
          disabled={atCap}
          title={atCap ? "Photo cap reached — remove one first" : "Add a QC photo, or paste one anywhere in this section"}
        >
          <Plus aria-hidden="true" size={13} strokeWidth={2.4} />
          Add QC photo
        </button>
        <button
          type="button"
          className={"cz-qc-verdict-btn is-gl" + (item.findStatus === "gl" ? " is-active" : "")}
          onClick={() => verdict("gl")}
        >
          GL · ship it
        </button>
        <button
          type="button"
          className={"cz-qc-verdict-btn is-rl" + (item.findStatus === "rl" ? " is-active" : "")}
          onClick={() => verdict("rl")}
        >
          RL · send back
        </button>
      </div>
      {/* Task 10 (Part 5): after an RL, record what came of it. Returned =
          money back (leaves the haul weight and the cost totals); exchange =
          back to Bought with the ask noted. */}
      {item.findStatus === "rl" ? (
        <div className="cz-qc-followup" role="group" aria-label="RL follow-up">
          <span className="cz-qc-followup-label">Sent back. Then what?</span>
          <button
            type="button"
            className="cz-qc-followup-btn"
            onClick={() => onSaveEdit?.(item.id, { findStatus: "returned" })}
          >
            Mark returned
          </button>
          <button
            type="button"
            className="cz-qc-followup-btn"
            onClick={() =>
              onSaveEdit?.(item.id, (x) => ({
                findStatus: "bought",
                qcNote: [
                  String(x.qcNote || "").trim(),
                  "Exchange asked " +
                    new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" }),
                ]
                  .filter(Boolean)
                  .join(" · "),
              }))
            }
          >
            Ask for exchange
          </button>
        </div>
      ) : null}
      <input
        type="text"
        className="cz-qc-note"
        value={noteDraft}
        placeholder="QC note (optional) — flaw, exchange ask…"
        aria-label="QC note"
        onChange={(e) => setNoteDraft(e.target.value)}
        onBlur={() => {
          const next = String(noteDraft || "").trim();
          if (next !== (item.qcNote || "")) onSaveEdit?.(item.id, { qcNote: next });
        }}
      />
    </section>
  );
}

// The one detail layout for an item — the carousel card back is the app's
// single detail surface, and this is its body. Element order is the standard:
// title → price hero (¥+$) → seller link → meta chips → haul → note → size
// pick → photos → actions. Edit lives in the shell header (MorphButton).
function ItemDetailBody({
  item,
  knownHauls,
  galleryImages,
  buyLabel,
  onSaveEdit,
  onOpen,
  onOpenPhotos,
  onOpenBubble,
  bodyProfile,
  measureUnits,
  reduced,
  isCenter,
  expanded,
  onSaveBodyProfile,
  fitPromptSkipped,
  onSkipFitPrompt,
  fitPref = null,
  onSaveFitPref,
}) {
  // Note clamp: 2 lines at rest, a small + opens the full text (Kyle
  // 2026-07-23). The + renders only when the text actually overflows.
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteClamped, setNoteClamped] = useState(false);
  const noteRef = useRef(null);
  useEffect(() => {
    setNoteOpen(false);
  }, [item.id]);
  useEffect(() => {
    if (noteOpen) return;
    const el = noteRef.current;
    setNoteClamped(!!el && el.scrollHeight > el.clientHeight + 1);
  }, [item.note, noteOpen]);
  // Size/color chips only — status + category are full pickers in the pipeline.
  const itemWeight = itemWeightGrams(item);
  const hasFactChips =
    item.size ||
    item.posterSize ||
    item.recommendedSize ||
    item.colorway ||
    itemWeight != null;
  const buyButtons = linkButtons(item, { buyLabel }).filter((b) => b.role === "buy");
  // Product-sheet order (Kyle 2026-07-22):
  // head → identity → facts → context → size → PHOTOS (fills space) →
  // pipeline (Want… / Shirts…) → Buy (pinned).
  return (
    <div className="cz-product-sheet">
      <header className="cz-sheet-head">
        <h2 className="cz-carousel-back-title">{item.title}</h2>
      </header>

      <section className="cz-sheet-section cz-sheet-identity" aria-label="Price and seller">
        <PriceChip item={item} variant="hero" />
        <div className="cz-seller-block">
          <SellerLink item={item} className="cz-seller-quiet" />
          <AlbumLink item={item} />
        </div>
      </section>

      {hasFactChips && (
        <section className="cz-sheet-section cz-sheet-facts" aria-label="Item facts">
          <div className="cz-carousel-meta-chips">
            {item.size && (
              <span className="cz-meta-chip">
                SIZE: {formatSizeToken(item.size)}
              </span>
            )}
            {item.posterSize && (
              <span className="cz-meta-chip">Poster {item.posterSize}</span>
            )}
            {item.recommendedSize &&
              String(item.recommendedSize).toLowerCase() !== String(item.size || "").toLowerCase() && (
              <span className="cz-meta-chip">Rec {String(item.recommendedSize).toUpperCase()}</span>
            )}
            {item.colorway && (
              <span className="cz-meta-chip">{item.colorway}</span>
            )}
            {/* A6: "~" flags the estimate; an override reads as exact. */}
            {itemWeight != null && (
              <span className="cz-meta-chip">
                {item.weightGrams ? Math.round(Number(item.weightGrams)) + " g" : formatWeightGrams(itemWeight)}
              </span>
            )}
          </div>
        </section>
      )}

      <section className="cz-sheet-section cz-sheet-context" aria-label="Haul and notes">
        {/* CO-29: no stopPropagation wrapper — the back-face root treats
            .cz-carousel-haul-block as inert (see the closest() list). */}
        <div className="cz-carousel-haul-block">
          <CardBackHaulField
            item={item}
            knownHauls={knownHauls}
            onSaveEdit={onSaveEdit}
            compact
          />
        </div>
        {item.note ? (
          <div className={"cz-carousel-note" + (noteOpen ? " is-open" : "")}>
            <div className="cz-carousel-note-head">
              <span>Note</span>
              {noteClamped || noteOpen ? (
                <button
                  type="button"
                  className="cz-note-toggle"
                  aria-expanded={noteOpen}
                  aria-label={noteOpen ? "Collapse note" : "Read full note"}
                  onClick={(e) => {
                    e.stopPropagation();
                    setNoteOpen((v) => !v);
                  }}
                >
                  <Plus size={12} strokeWidth={2.4} aria-hidden="true" />
                </button>
              ) : null}
            </div>
            <p ref={noteRef}>{item.note}</p>
          </div>
        ) : null}
      </section>

      {/* Design 4a–4g: fit states + status stage/track in one card. */}
      <section className="cz-sheet-section cz-sheet-size" aria-label="Size and status">
        <div className="cz-fit3b-card">
          <SizeRecommendation
            item={item}
            bodyProfile={bodyProfile}
            units={measureUnits}
            sizeActive={!!(expanded && isCenter)}
            onSaveEdit={onSaveEdit}
            onSaveBodyProfile={onSaveBodyProfile}
            fitPromptSkipped={fitPromptSkipped}
            onSkipFitPrompt={onSkipFitPrompt}
            fitPref={fitPref}
            onSaveFitPref={onSaveFitPref}
          />
          <div className="cz-fit3b-status">
            <StatusChips
              mode="display"
              value={item.findStatus || "want"}
              onChange={(s) => onSaveEdit?.(item.id, { findStatus: s })}
            />
          </div>
        </div>
      </section>

      {/* A5: Warehouse QC sits right after the pipeline — it is the next step
          once a card reaches the agent's warehouse. */}
      {["qc", "gl", "rl"].includes(item.findStatus || "") ||
      (Array.isArray(item.qcPhotos) && item.qcPhotos.length > 0) ? (
        <WarehouseQcSection
          item={item}
          onSaveEdit={onSaveEdit}
          onOpenPhotos={onOpenPhotos}
          isCenter={isCenter}
        />
      ) : null}

      {galleryImages.length > 0 && (
        <section className="cz-sheet-section cz-sheet-photos" aria-label="Photos">
          {/* Roomy fan — same language as the little cards, just taller so the
              tall product-sheet back isn't empty. Not a flat grid (Kyle). */}
          <CardCornerFan
            item={item}
            images={galleryImages}
            onOpenPhotos={onOpenPhotos}
            reduced={reduced}
            interactive={isCenter}
            variant="roomy"
          />
        </section>
      )}

      {/* Category picker removed from the card back (Kyle 2026-07-24): the row
          read as visual noise next to Buy. Category stays editable in the
          capture sheet. */}

      {buyButtons.length > 0 && (
        <div className="cz-carousel-actions cz-sheet-buy">
          {buyButtons.map((button, index) => (
            <button
              key={button.url + index}
              type="button"
              className="cz-buy-btn cz-border-beam cz-carousel-action-btn primary"
              onClick={() => onOpen(item, button.url)}
            >
              <span className="cz-buy-btn-label">{button.label}</span>
              <span className="cz-border-beam-glow" aria-hidden="true" />
            </button>
          ))}
          {/* FTC affiliate disclosure at the point of action (audit
              2026-07-24): quiet, one line, always with the Buy buttons. */}
          <p className="cz-buy-disclosure">
            Buy links may include a referral code. Credenza may earn a commission on agent
            shipping fees. It never changes your item price.
          </p>
        </div>
      )}
    </div>
  );
}

const CoverFlowCard = forwardRef(function CoverFlowCard(
  {
    item,
    expanded,
    selected,
    isCenter,
    flipSignal,
    editSignal,
    haulNames = [],
    onDelete,
    onSaveEdit,
    onOpen,
    buyLabel,
    onOpenPhotos,
    onAttachPhoto,
    onRemovePhoto,
    onToggleFavorite,
    onActivate,
    onDeactivate,
    onScrollTo,
    bodyProfile,
    measureUnits,
    onSaveBodyProfile,
    fitPromptSkipped,
    onSkipFitPrompt,
    fitPref = null,
    onSaveFitPref,
    reduced,
  },
  ref
) {
  const [flipped, setFlipped] = useState(false);
  const [editing, setEditing] = useState(false);
  const [ed, setEd] = useState(null);
  // false = edit sheet drops down out (back chevron); true = it slides back
  // up, the reverse of how it entered (save-check button).
  const [editExitUp, setEditExitUp] = useState(false);
  const [bubble, setBubble] = useState(null);
  // The whole exit runs in CSS on the live shell: framer's exit opacity freezes
  // on this shell, and a 0-height overflow-hidden shell still leaks ~14px into
  // the scroller's scrollHeight (one-frame snap at unmount). So closeBubble pins
  // the measured height, flips on .is-closing (fade + drift + contain: size —
  // which is why framer can't own this: size containment zeroes the box before
  // framer can measure it), transitions height to 0, then unmounts once the
  // shell is a contained 0-height box that leaves no residual scroll space.
  const [bubbleClosing, setBubbleClosing] = useState(false);
  const bubbleCloseTimer = useRef(null);
  const closeBubble = useCallback(() => {
    if (reduced) {
      setBubble(null);
      setBubbleClosing(false);
      return;
    }
    const el = bubbleRef.current;
    if (!el || bubbleClosing) {
      setBubble(null);
      return;
    }
    el.style.height = `${el.getBoundingClientRect().height}px`;
    // Force a style pass so the height transition starts from the pinned number
    // — without it the browser sees auto → 0, which is discrete (no transition).
    void el.offsetHeight;
    flushSync(() => setBubbleClosing(true));
    requestAnimationFrame(() => {
      el.style.height = "0px";
      // The shell is a flex item in a gapped column — the gap survives a
      // 0-height item and snaps shut at unmount. Collapse it alongside the
      // height so the whole close is one continuous motion.
      const gap = parseFloat(getComputedStyle(el.parentElement).rowGap) || 0;
      if (gap) el.style.marginBottom = `${-gap}px`;
    });
    bubbleCloseTimer.current = window.setTimeout(() => {
      setBubble(null);
      setBubbleClosing(false);
    }, 280);
  }, [reduced, bubbleClosing]);
  // details | actions | haul — actions/haul own the whole back face (no floating menus/prompts).
  const [backView, setBackView] = useState("details");
  const [haulDraft, setHaulDraft] = useState("");
  const bubbleRef = useRef(null);
  const rootRef = useRef(null);
  const haulInputRef = useRef(null);
  // Scroll-edge fade for the pinned Buy (CO-02): true when the back is at (or
  // too short to need) the scroll end, so the fade above Buy can drop.
  const [backAtEnd, setBackAtEnd] = useState(true);
  const backContentRef = useRef(null);
  const measureBackEnd = useCallback(() => {
    const el = backContentRef.current;
    if (!el) return;
    setBackAtEnd(el.scrollTop + el.clientHeight >= el.scrollHeight - 8);
  }, []);
  const handleBackScroll = useCallback(
    (e) => {
      const el = e.currentTarget;
      setBackAtEnd(el.scrollTop + el.clientHeight >= el.scrollHeight - 8);
    },
    []
  );
  useEffect(() => {
    measureBackEnd();
  }, [measureBackEnd, expanded, backView, editing, item.id]);

  useEffect(() => {
    setFlipped(Boolean(expanded));
    if (!expanded) {
      if (bubbleCloseTimer.current) {
        clearTimeout(bubbleCloseTimer.current);
        bubbleCloseTimer.current = null;
      }
      setEditing(false);
      setBubble(null);
      setBubbleClosing(false);
      setBackView("details");
      setHaulDraft("");
      // Closing the photo gallery restores focus to the fan. If the card then
      // unflips (arrow / space elsewhere), that focused fan is invisible but
      // still catches Space — blur it so keys go back to the active card.
      const active = document.activeElement;
      if (active && rootRef.current?.contains(active) && typeof active.blur === "function") {
        active.blur();
      }
    }
  }, [expanded]);

  useEffect(() => {
    if (bubble && bubbleRef.current) {
      bubbleRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [bubble]);

  useEffect(() => {
    if (backView === "haul" && haulInputRef.current) {
      haulInputRef.current.focus();
      haulInputRef.current.select?.();
    }
  }, [backView]);

  // Signals are one-shot commands, but they live in App state forever. A card
  // that MOUNTS while an old signal still matches its id would execute it
  // again (Kyle 2026-07-23: first card flipped on carousel entry after a
  // Space-flip earlier). Seed the ref with the current signal so only NEW
  // signals act.
  const lastFlipSignalRef = useRef(flipSignal);
  useEffect(() => {
    if (!flipSignal || flipSignal === lastFlipSignalRef.current) return;
    lastFlipSignalRef.current = flipSignal;
    if (flipSignal.startsWith(item.id + ":")) setFlipped(true);
  }, [flipSignal, item.id]);

  const lastEditSignalRef = useRef(editSignal);
  useEffect(() => {
    if (!editSignal || editSignal === lastEditSignalRef.current) return;
    lastEditSignalRef.current = editSignal;
    if (editSignal.startsWith(item.id + ":")) {
      setEd(buildEditDraft(item));
      setBubble(null);
      setBackView("details");
      setEditExitUp(false);
      setEditing(true);
    }
  }, [editSignal, item]);

  const activate = () => {
    if (!isCenter) {
      if (onScrollTo) onScrollTo(item.id);
      return;
    }
    if (onActivate) onActivate(item.id);
  };
  const deactivate = () => {
    if (onDeactivate) onDeactivate();
  };

  // Write-through commit — the edit form persists as you type, so leaving the
  // screen (back chevron, outside click, flip) never loses notes.
  const commitEditRef = useWriteThroughDraft(ed, (d) => onSaveEdit(item.id, buildEditPatch(d, item)));
  // "Saved" holds the top-right slot (same size as Save) so ⋯/pen don't jump.
  const [editSavedFlash, setEditSavedFlash] = useState(false);
  const editSavedTimer = useRef(null);
  useEffect(
    () => () => {
      if (editSavedTimer.current) clearTimeout(editSavedTimer.current);
    },
    []
  );

  const discardEdit = useCallback(() => {
    // Write-through means there's nothing to discard — flush the last keystrokes.
    // Leave via back chevron: no "Saved" hold — return ⋯/pen immediately.
    commitEditRef.current();
    setEditExitUp(false);
    setEditing(false);
    setEd(null);
    setEditSavedFlash(false);
    if (editSavedTimer.current) {
      clearTimeout(editSavedTimer.current);
      editSavedTimer.current = null;
    }
  }, [commitEditRef]);

  // Save: commit, slide edit sheet up, keep the TOP-RIGHT slot as a green
  // "Saved" pill (same size as Save) so ⋯/pen don't slam in and jump the
  // header. After a short beat, crossfade to the detail tools.
  // Enter uses this same path (handleEditKeyDown).
  const saveEditAndClose = useCallback(() => {
    commitEditRef.current();
    flushSync(() => setEditExitUp(true));
    setEditing(false);
    setEd(null);
    setEditSavedFlash(true);
    if (editSavedTimer.current) clearTimeout(editSavedTimer.current);
    editSavedTimer.current = setTimeout(() => setEditSavedFlash(false), 900);
  }, [commitEditRef]);

  const closeActions = useCallback(() => {
    setBackView("details");
    setHaulDraft("");
  }, []);

  const openActions = useCallback(() => {
    setBubble(null);
    setHaulDraft(item.project || "");
    setBackView("actions");
  }, [item.project]);

  const openHaulPicker = useCallback(() => {
    setBubble(null);
    setHaulDraft(item.project || "");
    setBackView("haul");
  }, [item.project]);

  const assignHaul = useCallback(
    (name) => {
      const next = String(name || "").trim();
      onSaveEdit?.(item.id, { project: next });
      setHaulDraft(next);
      setBackView("actions");
    },
    [item.id, onSaveEdit]
  );

  const dismissTopLayer = useCallback(() => {
    if (editing) {
      discardEdit();
      return true;
    }
    if (backView === "haul") {
      setBackView("actions");
      return true;
    }
    if (backView === "actions") {
      closeActions();
      return true;
    }
    if (bubble) {
      closeBubble();
      return true;
    }
    if (flipped) {
      onDeactivate?.();
      return true;
    }
    return false;
  }, [editing, backView, bubble, flipped, discardEdit, closeActions, closeBubble, onDeactivate]);

  useImperativeHandle(
    ref,
    () => ({
      dismissTopLayer,
      contains: (target) => Boolean(rootRef.current?.contains(target)),
    }),
    [dismissTopLayer]
  );

  const openBubble = (key, title, content) => {
    setBackView("details");
    setBubbleClosing(false);
    setBubble({ key, title, content });
  };

  const startEdit = () => {
    setEd(buildEditDraft(item));
    setBubble(null);
    setBackView("details");
    setEditExitUp(false);
    setEditSavedFlash(false);
    if (editSavedTimer.current) {
      clearTimeout(editSavedTimer.current);
      editSavedTimer.current = null;
    }
    setEditing(true);
  };

  // Enter saves from any plain field. Capture phase on the edit shell so it
  // always fires; skip open comboboxes (size picker) and bare textarea newlines.
  const handleEditKeyDown = useCallback(
    (e) => {
      if (!editing) return;
      if (e.key !== "Enter") return;
      const t = e.target;
      if (!t) return;
      // Size / haul combobox owns Enter while its menu is active.
      if (t.closest?.(".cz-combobox, .cz-combobox-menu, [role='listbox']")) return;
      if (t.getAttribute?.("role") === "combobox") return;
      const tag = (t.tagName || "").toUpperCase();
      if (tag === "TEXTAREA" && !(e.metaKey || e.ctrlKey)) return;
      // Don't steal Enter from chip/segment buttons (they toggle selection).
      if (tag === "BUTTON") return;
      if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") return;
      e.preventDefault();
      e.stopPropagation();
      saveEditAndClose();
    },
    [editing, saveEditAndClose]
  );

  const galleryImages = itemPhotoList(item);
  const knownHauls = Array.from(
    new Set(
      [...(haulNames || []), item.project || ""]
        .map((name) => String(name || "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  // No autofocus on flip — the programmatic focus lit up the glow ring on
  // every flip, which reads as a highlight glitch, not affordance.

  // Front-facing gate, driven by the live flip rotation (true only inside the
  // front-facing 90°). The heart rides the front face — mounting it the moment
  // `flipped` goes false shows it mirrored over the back header for the first
  // half of the flip-back. The faces themselves need the same manual culling:
  // WebKit ignores backface-visibility here (confirmed 2026-07-21, Playwright
  // WebKit headed + headless) and paints the back face mirrored over the
  // front, so face visibility is gated on this rotation value too.
  const [frontFacing, setFrontFacing] = useState(!flipped);
  const frontFacingRef = useRef(!flipped);
  const handleCardRotate = useCallback((latest) => {
    const show = (parseFloat(latest.rotateY) || 0) < 90;
    if (show !== frontFacingRef.current) {
      frontFacingRef.current = show;
      setFrontFacing(show);
    }
  }, []);

  // Edit mode must NOT move the card shell (Kyle 2026-07-22). The old
  // is-editing width widen shifted the card a few px left — removed.
  // Shared padding + scrollbar-gutter: stable keep details/edit aligned.

  return (
    <div ref={rootRef} style={{ width: "100%", height: "100%", transformStyle: "preserve-3d" }}>
      <motion.div
        className={"cz-carousel-card-inner" + (flipped ? " is-flipped" : "")}
        animate={{ rotateY: flipped ? 180 : 0 }}
        onUpdate={handleCardRotate}
        transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 26 }}
        style={{
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
          borderRadius: 24,
        }}
      >
        {/* Front face. Visibility: state-driven at rest (WebKit ignores
            backface-visibility and would paint this mirrored over the back),
            rotation-gated mid-flip so flip-back doesn't flash it early. */}
        <div
          className="cz-carousel-face cz-carousel-front"
          style={{ visibility: !flipped || frontFacing ? "visible" : "hidden" }}
          role="button"
          tabIndex={0}
          aria-label={isCenter ? `Flip ${item.title}` : `Select ${item.title}`}
          onClick={(e) => {
            const carousel = e.currentTarget.closest(".cz-carousel");
            if (carousel && carousel.dataset.dragging === "true") {
              delete carousel.dataset.dragging;
              return;
            }
            e.stopPropagation();
            activate();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              activate();
            }
          }}
        >
          <div className="cz-carousel-image-wrap">
            <CoverImage
              item={item}
              fill
              className="cz-carousel-image"
              imgStyle={{ borderRadius: 0 }}
            />
            <StatusPill status={item.findStatus} className="cz-carousel-status" />
          </div>
          <div className="cz-carousel-front-meta">
            {/* Unified with the grid card (Kyle 2026-07-23): title → size →
                seller → green USD price text. No overlay price chip, no ¥. */}
            <h2 className="cz-carousel-title">{item.title}</h2>
            <CardFrontInfo
              item={item}
              bodyProfile={bodyProfile}
              fitPrefs={fitPref && item.category ? { [item.category]: fitPref } : null}
            />
            {(() => {
              const buy = linkButtons(item, { buyLabel }).find((b) => b.role === "buy");
              if (!buy || !isCenter) return null;
              return (
                <button
                  type="button"
                  className="cz-buy-btn cz-border-beam"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onOpen?.(item, buy.url);
                  }}
                >
                  <span className="cz-buy-btn-label">{buy.label}</span>
                  <span className="cz-border-beam-glow" aria-hidden="true" />
                </button>
              );
            })()}
            {isCenter && (
              /* Unboxed cue (Kyle 2026-07-22): text + rotating icon, no pill
                 chrome — the Buy button owns the only boxed/beam look. It's a
                 real button that runs the same activate() as the face tap. */
              <motion.button
                type="button"
                className="cz-flip-cue"
                aria-label="Flip card for details"
                initial="rest"
                animate="rest"
                whileHover="hover"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  activate();
                }}
              >
                <motion.span
                  className="cz-flip-cue-icon"
                  variants={{ rest: { rotate: 0 }, hover: { rotate: 180 } }}
                  transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 25 }}
                  aria-hidden="true"
                >
                  <RefreshCw size={13} />
                </motion.span>
                <span className="cz-flip-cue-label">Flip for more</span>
              </motion.button>
            )}
          </div>
        </div>

        {/* Heart is front-face only — gated on the live rotation so it never
            mirrors over the back header during the first half of flip-back. */}
        {frontFacing && (
          <FavoriteButton item={item} onToggle={onToggleFavorite} className="cz-card-favorite" />
        )}

        {/* Back-face clicks: interactive elements keep their own behavior and
            stay inert for navigation; INERT whitespace in details mode flips
            the card back to its front (Kyle 2026-07-22 — supersedes the old
            "all inside clicks are inert" contract). Edit/actions/bubble
            layers keep clicks inert so a stray tap never exits them. */}
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- flip-back affordance, keyboard uses the header back control */}
        <div
          className="cz-carousel-face cz-carousel-back"
          style={{ visibility: flipped || !frontFacing ? "visible" : "hidden" }}
          onClick={(e) => {
            const carousel = e.currentTarget.closest(".cz-carousel");
            if (carousel && carousel.dataset.dragging === "true") {
              delete carousel.dataset.dragging;
              return;
            }
            e.stopPropagation();
            if (!flipped || editing || backView !== "details" || bubble) return;
            if (e.target.closest("a, button, input, textarea, select, label, [role='button'], [contenteditable], dialog, img, .cz-corner-fan, .cz-photo-strip, .cz-sheet-pipeline, .cz-carousel-haul-block")) return;
            const sel = window.getSelection?.();
            if (sel && !sel.isCollapsed) return;
            deactivate();
          }}
        >
          <div
            className={
              "cz-carousel-back-header" +
              (editing || backView !== "details" ? " is-editing" : "")
            }
          >
            <button
              type="button"
              className="cz-icon-button cz-carousel-close"
              onClick={(e) => {
                e.stopPropagation();
                if (editing) discardEdit();
                else if (backView === "haul") setBackView("actions");
                else if (backView === "actions") closeActions();
                else if (bubble) closeBubble();
                else deactivate();
              }}
              aria-label={
                editing
                  ? "Back to card"
                  : backView === "haul"
                    ? "Back to actions"
                    : backView === "actions"
                      ? "Done with actions"
                      : bubble
                        ? "Close details"
                        : "Flip back"
              }
            >
              <ChevronLeft aria-hidden="true" size={20} strokeWidth={2.2} />
            </button>
            <span className="cz-carousel-back-spacer" aria-hidden="true" />
            {/* Fixed-width actions slot: Save → Saved → ⋯/pen crossfade.
                Never inserts a second row (that caused the header jump). */}
            <div className="cz-carousel-back-actions">
              <AnimatePresence mode="wait" initial={false}>
                {editing ? (
                  <motion.div
                    key="save"
                    className="cz-back-actions-slot"
                    initial={reduced ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={reduced ? undefined : { opacity: 0 }}
                    transition={{ duration: reduced ? 0 : 0.16 }}
                  >
                    <button
                      type="button"
                      className="cz-card-save-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        saveEditAndClose();
                      }}
                      aria-label="Save changes"
                      title="Save (Enter)"
                    >
                      <Check aria-hidden="true" size={16} strokeWidth={2.4} />
                      <span>Save</span>
                    </button>
                  </motion.div>
                ) : editSavedFlash ? (
                  <motion.div
                    key="saved"
                    className="cz-back-actions-slot"
                    initial={reduced ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={reduced ? undefined : { opacity: 0 }}
                    transition={{ duration: reduced ? 0 : 0.18 }}
                    role="status"
                    aria-live="polite"
                  >
                    <span className="cz-card-save-btn is-saved">
                      <Check aria-hidden="true" size={16} strokeWidth={2.4} />
                      <span>Saved</span>
                    </span>
                  </motion.div>
                ) : backView === "details" ? (
                  <motion.div
                    key="tools"
                    className="cz-back-actions-slot"
                    initial={reduced ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={reduced ? undefined : { opacity: 0 }}
                    transition={{ duration: reduced ? 0 : 0.16 }}
                  >
                    <button
                      type="button"
                      className={"cz-icon-button cz-card-menu-trigger" + (backView !== "details" ? " is-open" : "")}
                      aria-label="Card actions"
                      aria-expanded={false}
                      onClick={(e) => {
                        e.stopPropagation();
                        openActions();
                      }}
                    >
                      <MoreHorizontal aria-hidden="true" size={20} strokeWidth={2.2} />
                    </button>
                    <MorphButton
                      iconOnly
                      icon={Pen}
                      activeIcon={Check}
                      onClick={startEdit}
                      ariaLabel="Edit card"
                      title="Edit"
                      className="cz-card-edit-morph"
                    />
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>

          {/* Edit slides in from above — the reverse of the content below it. */}
          <AnimatePresence mode="wait" initial={false}>
          {editing && ed ? (
            <motion.div
              key="edit"
              className="cz-carousel-edit-shell"
              initial={reduced ? false : { opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? undefined : { opacity: 0, y: editExitUp ? -10 : 8 }}
              transition={reduced ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              onKeyDownCapture={handleEditKeyDown}
            >
            <ItemEditForm
              item={item}
              ed={ed}
              setEd={setEd}
              knownHauls={knownHauls}
              onAttachPhoto={onAttachPhoto}
              onRemovePhoto={onRemovePhoto}
            />
            <p className="cz-edit-save-hint">Enter to save · Esc to close</p>
            </motion.div>
          ) : (
            <motion.div
              key="content"
              ref={backContentRef}
              onScroll={handleBackScroll}
              className={
                "cz-carousel-back-content" + (backAtEnd ? " is-at-end" : "")
              }
              initial={reduced ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? undefined : { opacity: 0, y: -10 }}
              transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 32 }}
            >
              <AnimatePresence mode="wait" initial={false}>
                {backView === "actions" ? (
                  <motion.div
                    key="actions"
                    className="cz-card-actions-panel"
                    initial={reduced ? false : { opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduced ? undefined : { opacity: 0, y: -10 }}
                    transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 32 }}
                  >
                    <div className="cz-card-actions-heading">
                      <h3>Actions</h3>
                      {item.project ? <p className="cz-card-actions-sub">In haul · {item.project}</p> : null}
                    </div>
                    <div className="cz-card-actions-list" role="menu" aria-label="Card actions">
                      <button type="button" role="menuitem" className="cz-card-action-row" onClick={openHaulPicker}>
                        <span>{item.project ? "Move to haul" : "Add to haul"}</span>
                        <span className="cz-card-action-meta">{item.project || "Choose"}</span>
                      </button>
                      {item.project ? (
                        <button
                          type="button"
                          role="menuitem"
                          className="cz-card-action-row"
                          onClick={() => {
                            onSaveEdit?.(item.id, { project: "" });
                            setHaulDraft("");
                          }}
                        >
                          <span>Remove from haul</span>
                        </button>
                      ) : null}
                      <button
                        type="button"
                        role="menuitem"
                        className="cz-card-action-row danger"
                        onClick={() => onDelete(item.id)}
                      >
                        <span>Remove card</span>
                      </button>
                    </div>
                    <button type="button" className="cz-card-actions-done" onClick={closeActions}>
                      Done
                    </button>
                  </motion.div>
                ) : backView === "haul" ? (
                  <motion.div
                    key="haul"
                    className="cz-card-actions-panel"
                    initial={reduced ? false : { opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduced ? undefined : { opacity: 0, y: -10 }}
                    transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 32 }}
                  >
                    <div className="cz-card-actions-heading">
                      <h3>{item.project ? "Move to haul" : "Add to haul"}</h3>
                      <p className="cz-card-actions-sub">Pick an existing haul or name a new one.</p>
                    </div>
                    <label className="cz-card-haul-field">
                      <span>Haul name</span>
                      <input
                        ref={haulInputRef}
                        type="text"
                        value={haulDraft}
                        placeholder="e.g. Summer Europe"
                        onChange={(e) => setHaulDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            assignHaul(haulDraft);
                          }
                        }}
                      />
                    </label>
                    {knownHauls.length > 0 && (
                      <div className="cz-card-actions-list" role="listbox" aria-label="Existing hauls">
                        {knownHauls.map((name) => (
                          <button
                            key={name}
                            type="button"
                            role="option"
                            aria-selected={item.project === name}
                            className={"cz-card-action-row" + (item.project === name ? " is-current" : "")}
                            onClick={() => assignHaul(name)}
                          >
                            <span>{name}</span>
                            {item.project === name ? <span className="cz-card-action-meta">Current</span> : null}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="cz-card-haul-footer">
                      <button
                        type="button"
                        className="cz-card-actions-done primary"
                        onClick={() => assignHaul(haulDraft)}
                        disabled={!haulDraft.trim()}
                      >
                        Save haul
                      </button>
                      <button type="button" className="cz-card-actions-done subtle" onClick={() => setBackView("actions")}>
                        Back
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="details"
                    className="cz-card-details-panel cz-card-details-panel--sheet"
                    initial={reduced ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduced ? undefined : { opacity: 0, y: -8 }}
                    transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 32 }}
                  >
                    <ItemDetailBody
                      item={item}
                      knownHauls={knownHauls}
                      galleryImages={galleryImages}
                      buyLabel={buyLabel}
                      onSaveEdit={onSaveEdit}
                      onOpen={onOpen}
                      onOpenPhotos={onOpenPhotos}
                      onOpenBubble={openBubble}
                      bodyProfile={bodyProfile}
                      measureUnits={measureUnits}
                      onSaveBodyProfile={onSaveBodyProfile}
                      fitPromptSkipped={fitPromptSkipped}
                      onSkipFitPrompt={onSkipFitPrompt}
                      fitPref={fitPref}
                      onSaveFitPref={onSaveFitPref}
                      reduced={reduced}
                      isCenter={isCenter}
                      expanded={expanded}
                    />

                    {/* The exit is fully CSS-driven (see closeBubble): the shell
                        stays mounted while .is-closing fades/drifts it and
                        transitions its pinned height to 0, then unmounts — one
                        continuous motion, no frozen-opacity blink, no unmount
                        scroll snap. */}
                    <AnimatePresence initial={false}>
                      {bubble && (
                        <motion.div
                          key={bubble.key}
                          ref={bubbleRef}
                          className={"cz-bubble-shell" + (bubbleClosing ? " is-closing" : "")}
                          initial={false}
                        >
                          <InfoBubble title={bubble.title} onClose={closeBubble}>
                            {bubble.content}
                          </InfoBubble>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
});

function CoverFlowCarousel({
  items,
  expandedId,
  selectedId,
  flipRequest,
  editRequest,
  focusSignal,
  haulNames = [],
  onDelete,
  onSaveEdit,
  onOpen,
  buyLabel,
  onSetPrimaryImage,
  onLoadPhotos,
  onAttachPhoto,
  onRemovePhoto,
  onToggleFavorite,
  onActivate,
  onDeactivate,
  onSelect,
  bodyProfile,
  measureUnits,
  onSaveBodyProfile,
  fitPromptSkipped,
  onSkipFitPrompt,
  fitPrefs = null,
  onSaveFitPref,
  // When true, skip CoverFlow springs so a haul morph can hand off silently.
  suppressMotion = false,
}) {
  const containerRef = useRef(null);
  const [activeIndex, setActiveIndexState] = useState(0);
  const activeIndexRef = useRef(0);
  const [cardSize, setCardSize] = useState({ width: 320, height: 460 });
  const reduced = usePrefersReducedMotion();
  const [gallery, setGallery] = useState(null);
  const galleryTriggerRef = useRef(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const wheelAcc = useRef(0);
  const wheelTimer = useRef(null);
  const wheelLockUntil = useRef(0);
  const cardRefs = useRef(new Map());
  const outsideDismissedRef = useRef(false);
  // Wrap-around (front ↔ back of rack) takes two intentional steps: first
  // press/swipe rubber-bands with a short nudge, second within the arm window
  // commits the wrap. Mid-shelf steps stay single-action.
  const [edgeNudgeX, setEdgeNudgeX] = useState(0);
  const edgeArmRef = useRef(null); // { dir: "prev"|"next", at: number }
  const edgeNudgeBackTimer = useRef(null);
  const edgeArmExpireTimer = useRef(null);

  const dismissActiveLayer = useCallback(() => {
    const item = items[activeIndexRef.current];
    return item ? cardRefs.current.get(item.id)?.dismissTopLayer?.() === true : false;
  }, [items]);

  useEffect(() => {
    if (!expandedId || gallery) return;
    const onPointerDown = (event) => {
      if (event.button != null && event.button !== 0) return;
      const item = items[activeIndexRef.current];
      const card = item ? cardRefs.current.get(item.id) : null;
      if (!card || card.contains?.(event.target)) return;
      if (event.target.closest?.("dialog, .cz-photo-coverflow-backdrop")) return;
      if (card.dismissTopLayer?.()) {
        outsideDismissedRef.current = true;
        setTimeout(() => {
          outsideDismissedRef.current = false;
        }, 0);
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [expandedId, gallery, items]);

  const setActiveIndex = useCallback((index) => {
    const next = Math.max(0, Math.min(items.length - 1, index));
    // Navigation always wins: leaving a centered card unflips it immediately
    // so arrow keys / swipes never fight a stuck flip state.
    if (next !== activeIndexRef.current && expandedId && onDeactivate) {
      onDeactivate();
    }
    // Drop focus trapped on the previous card's photo fan / back controls so
    // Space flips the new center card instead of reopening old photos.
    if (next !== activeIndexRef.current) {
      const prevItem = items[activeIndexRef.current];
      const prevCard = prevItem ? cardRefs.current.get(prevItem.id) : null;
      const active = document.activeElement;
      if (active && prevCard?.contains?.(active) && typeof active.blur === "function") {
        active.blur();
      }
      // Prefer landing focus on the stage after a step so keyboard stays live.
      // Never pull focus out of a field the user is typing in (KM-01 root
      // cause): a search keystroke reorders the list, selection follows, and
      // this focus() stole the caret mid-word — the next keys then hit the
      // global handler ("e" opened edit mode on a card).
      requestAnimationFrame(() => {
        const stage = containerRef.current;
        if (!stage || typeof stage.focus !== "function") return;
        const active = document.activeElement;
        if (stage.contains(active)) return;
        if (
          active &&
          (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)
        )
          return;
        stage.focus({ preventScroll: true });
      });
      // Never keep an album open for a card that is no longer centered.
      setGallery((current) => (current ? null : current));
    }
    activeIndexRef.current = next;
    setActiveIndexState(next);
  }, [items, expandedId, onDeactivate]);

  // Grid tap → "open the carousel on this item" (Kyle 2026-07-22). Additive
  // only: a signal string (id:timestamp) that jumps the rack; geometry and
  // pan physics untouched. Fires on mount when the carousel remounts for the
  // viewMode switch.
  useEffect(() => {
    if (!focusSignal) return;
    const id = String(focusSignal).split(":")[0];
    const idx = items.findIndex((c) => c.id === id);
    if (idx >= 0 && idx !== activeIndexRef.current) {
      activeIndexRef.current = idx;
      setActiveIndexState(idx);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSignal]);

  useEffect(() => {
    // Same card size for coverflow and the solo modal popup (Kyle 2026-07-23 —
    // enlarged solo cards were too big).
    const update = () => {
      const w = typeof window !== "undefined" ? window.innerWidth : 320;
      const width = w <= 480 ? w * 0.8 : Math.min(w * 0.72, 320);
      const height = w <= 480 ? 440 : 460;
      setCardSize({ width, height });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    const stage = containerRef.current?.parentElement;
    if (!stage || typeof window === "undefined" || !window.ResizeObserver) return;
    const obs = new window.ResizeObserver((entries) => {
      const cr = entries[0].contentRect;
      setStageSize({ width: cr.width, height: cr.height });
    });
    obs.observe(stage);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (items.length === 0) return;
    const expandedIdx = expandedId ? items.findIndex((i) => i.id === expandedId) : -1;
    if (expandedIdx >= 0) {
      setActiveIndex(expandedIdx);
      return;
    }
    const selectedIdx = selectedId ? items.findIndex((i) => i.id === selectedId) : -1;
    if (selectedIdx >= 0) {
      setActiveIndex(selectedIdx);
      return;
    }
    // Deleted or filtered out of the active card: stay on this index so the
    // former right neighbor becomes current. Never jump back to 0.
    const clamped = Math.min(activeIndexRef.current, items.length - 1);
    setActiveIndex(Math.max(0, clamped));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((i) => i.id).join(",")]);

  // Selection sync must be one-directional per event or the two effects echo
  // each other forever (select → center → select…). lastEmittedSelectRef marks
  // selection changes that originated here so the selectedId effect ignores
  // its own echo; only genuinely external selection (keyboard nav, grid view)
  // moves the carousel.
  const lastEmittedSelectRef = useRef(null);

  useEffect(() => {
    if (selectedId === lastEmittedSelectRef.current) return;
    const idx = items.findIndex((item) => item.id === selectedId);
    if (idx >= 0 && idx !== activeIndexRef.current) {
      setActiveIndex(idx);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    const item = items[activeIndex];
    if (item && item.id !== selectedId && onSelect) {
      lastEmittedSelectRef.current = item.id;
      onSelect(item.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  useEffect(() => {
    const item = items[activeIndex];
    if (expandedId && item && item.id !== expandedId && onDeactivate) {
      onDeactivate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  const clearEdgeArm = useCallback(() => {
    edgeArmRef.current = null;
    if (edgeNudgeBackTimer.current) {
      clearTimeout(edgeNudgeBackTimer.current);
      edgeNudgeBackTimer.current = null;
    }
    if (edgeArmExpireTimer.current) {
      clearTimeout(edgeArmExpireTimer.current);
      edgeArmExpireTimer.current = null;
    }
    setEdgeNudgeX(0);
  }, []);

  const pulseEdgeNudge = useCallback((dir) => {
    // Pull slightly against the edge so the press still feels interactive.
    const amount = dir === "prev" ? 22 : -22;
    setEdgeNudgeX(amount);
    if (edgeNudgeBackTimer.current) clearTimeout(edgeNudgeBackTimer.current);
    edgeNudgeBackTimer.current = setTimeout(() => {
      edgeNudgeBackTimer.current = null;
      setEdgeNudgeX(0);
    }, reduced ? 0 : 120);
  }, [reduced]);

  const tryEdgeStep = useCallback((dir) => {
    const len = Math.max(items.length, 1);
    if (len <= 1) return;
    const idx = activeIndexRef.current;
    const atStart = idx === 0;
    const atEnd = idx === len - 1;

    if (dir === "prev" && !atStart) {
      clearEdgeArm();
      setActiveIndex(idx - 1);
      return;
    }
    if (dir === "next" && !atEnd) {
      clearEdgeArm();
      setActiveIndex(idx + 1);
      return;
    }

    // At the edge: first attempt arms + nudges; second within the window wraps.
    const ARM_MS = 900;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const armed = edgeArmRef.current;
    if (armed && armed.dir === dir && now - armed.at < ARM_MS) {
      clearEdgeArm();
      if (dir === "prev") setActiveIndex(len - 1);
      else setActiveIndex(0);
      return;
    }

    edgeArmRef.current = { dir, at: now };
    pulseEdgeNudge(dir);
    if (edgeArmExpireTimer.current) clearTimeout(edgeArmExpireTimer.current);
    edgeArmExpireTimer.current = setTimeout(() => {
      edgeArmExpireTimer.current = null;
      // Only clear the arm if nothing re-armed it.
      if (edgeArmRef.current && edgeArmRef.current.at === now) {
        edgeArmRef.current = null;
      }
    }, ARM_MS);
  }, [items.length, setActiveIndex, clearEdgeArm, pulseEdgeNudge]);

  const goNext = useCallback(() => {
    tryEdgeStep("next");
  }, [tryEdgeStep]);

  const goPrev = useCallback(() => {
    tryEdgeStep("prev");
  }, [tryEdgeStep]);

  useEffect(
    () => () => {
      if (edgeNudgeBackTimer.current) clearTimeout(edgeNudgeBackTimer.current);
      if (edgeArmExpireTimer.current) clearTimeout(edgeArmExpireTimer.current);
    },
    []
  );

  const onKeyDown = useCallback((event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    if (event.target?.isContentEditable) return;
    // Gallery owns its keys while open: Escape (below) AND arrows — keydowns
    // from the dialog's focused button bubble through this container.
    if (event.key === "Escape") return;
    if (document.querySelector("dialog[open]")) return;
    if (suppressMotion) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      // Navigation always unflips first so keys never feel stuck.
      if (expandedId && onDeactivate) onDeactivate();
      goPrev();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      if (expandedId && onDeactivate) onDeactivate();
      goNext();
    }
  }, [goPrev, goNext, expandedId, onDeactivate, suppressMotion]);

  // Window-level arrows so keys work even when the carousel isn't focused —
  // the global app handler also moves selection, but CoverFlow owns wrap/nudge.
  useEffect(() => {
    const onWindowKey = (event) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
      if (event.target?.isContentEditable) return;
      // Gallery owns arrows while open. NOTE: <dialog> has no role ATTRIBUTE,
      // so [role="dialog"] selectors never match it — must select dialog[open].
      if (document.querySelector("dialog[open]")) return;
      if (suppressMotion) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      // Don't double-fire if the carousel element itself is already handling it.
      if (containerRef.current && containerRef.current.contains(document.activeElement)) return;
      event.preventDefault();
      if (expandedId && onDeactivate) onDeactivate();
      if (event.key === "ArrowLeft") goPrev();
      else goNext();
    };
    window.addEventListener("keydown", onWindowKey);
    return () => window.removeEventListener("keydown", onWindowKey);
  }, [goPrev, goNext, expandedId, onDeactivate, suppressMotion]);

  useEffect(() => {
    const onEscape = (event) => {
      if (event.key !== "Escape" || !expandedId || gallery) return;
      if (document.querySelector("dialog[open]")) return;
      if (dismissActiveLayer()) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("keydown", onEscape, true);
    return () => window.removeEventListener("keydown", onEscape, true);
  }, [expandedId, gallery, dismissActiveLayer]);

  const markDragging = useCallback((info) => {
    // Only mark as a drag if the pointer actually moved enough to be a swipe.
    // This prevents quick taps/clicks on side cards from being suppressed.
    if (Math.abs(info.offset.x) <= 8 && Math.abs(info.velocity.x) <= 80) return;
    const container = containerRef.current;
    if (!container) return;
    container.dataset.dragging = "true";
    if (container._dragClear) clearTimeout(container._dragClear);
    container._dragClear = setTimeout(() => {
      delete container.dataset.dragging;
    }, 50);
  }, []);

  const onPanEnd = useCallback((event, info) => {
    // Mouse needs a firmer intentional swipe than trackpad; don't let tiny
    // drags steal the card or advance the carousel.
    const threshold = cardSize.width * 0.32;
    if (info.offset.x < -threshold || info.velocity.x < -650) {
      goNext();
    } else if (info.offset.x > threshold || info.velocity.x > 650) {
      goPrev();
    }
    markDragging(info);
  }, [cardSize.width, goNext, goPrev, markDragging]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // Trackpads fire a long tail of small deltas. Step as soon as the
    // cumulative gesture crosses the threshold, then lock briefly so one
    // flick cannot multi-page the carousel while springs settle.
    const STEP_THRESHOLD = 36;
    const LOCK_MS = 280;
    const onWheel = (event) => {
      // Off-card wheel belongs to the PAGE, not the carousel (Kyle 2026-07-22:
      // the full-width track hijacked every scroll that passed over it). No
      // preventDefault here — the gesture falls through to normal page scroll.
      if (!event.target.closest?.(".cz-carousel-card")) return;
      // Wheel over a flipped card's scrollable content must scroll that
      // content, not page the carousel — never preventDefault there.
      if (event.target.closest?.(".cz-carousel-back-content, .cz-carousel-edit, .cz-carousel-edit-shell, .cz-card-actions-panel, .cz-card-haul-field")) return;
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (Math.abs(delta) < 0.5) return;
      event.preventDefault();
      const now = performance.now();
      if (now < wheelLockUntil.current) {
        wheelAcc.current = 0;
        return;
      }
      wheelAcc.current += delta;
      if (wheelAcc.current > STEP_THRESHOLD) {
        goNext();
        wheelAcc.current = 0;
        wheelLockUntil.current = now + LOCK_MS;
      } else if (wheelAcc.current < -STEP_THRESHOLD) {
        goPrev();
        wheelAcc.current = 0;
        wheelLockUntil.current = now + LOCK_MS;
      } else {
        // Quiet window: if the user stops mid-gesture without crossing the
        // threshold, drop the partial accumulation so the next flick is clean.
        if (wheelTimer.current) clearTimeout(wheelTimer.current);
        wheelTimer.current = setTimeout(() => {
          wheelTimer.current = null;
          wheelAcc.current = 0;
        }, 140);
      }
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", onWheel);
      if (wheelTimer.current) clearTimeout(wheelTimer.current);
    };
  }, [goNext, goPrev]);

  const closeGallery = useCallback(() => {
    // Do NOT restore focus to the fan trigger. Space on that control opens
    // the gallery; after scroll/unflip the trigger still owns focus and Space
    // reopens the *previous* card's photos instead of flipping the active one.
    // Land keyboard focus on the carousel stage so Space/arrows hit the right card.
    galleryTriggerRef.current = null;
    setGallery(null);
    requestAnimationFrame(() => {
      const stage = containerRef.current;
      if (stage && typeof stage.focus === "function") stage.focus({ preventScroll: true });
    });
  }, []);

  const openPhotos = useCallback(async (item, triggerOrOpts) => {
    // Only the centered/active card should open the gallery. A focused fan on a
    // side card (stale after close + scroll) used to reopen the wrong album.
    const center = items[activeIndexRef.current];
    if (!center || center.id !== item.id) return;
    // A5: callers may pass an explicit image list (Warehouse QC photos) via
    // opts.images — then the Yupoo album load is skipped, so product photos
    // never leak into the QC viewer.
    const customImages =
      triggerOrOpts &&
      typeof triggerOrOpts === "object" &&
      !(triggerOrOpts instanceof Element) &&
      Array.isArray(triggerOrOpts.images)
        ? triggerOrOpts.images.filter(Boolean)
        : null;
    const seed = customImages || itemPhotoList(item, 8);
    const shouldLoad = !customImages && !!yupooAlbumUrl(item) && seed.length < 8 && !!onLoadPhotos;
    let trigger = null;
    let startIndex = 0;
    if (typeof triggerOrOpts === "number") {
      startIndex = triggerOrOpts;
    } else if (
      triggerOrOpts &&
      typeof triggerOrOpts === "object" &&
      !(triggerOrOpts instanceof Element) &&
      ("startIndex" in triggerOrOpts || "trigger" in triggerOrOpts)
    ) {
      startIndex = Number(triggerOrOpts.startIndex) || 0;
      trigger = triggerOrOpts.trigger || null;
    } else {
      trigger = triggerOrOpts || null;
    }
    startIndex = Math.max(0, Math.min(Math.max(seed.length - 1, 0), startIndex));
    galleryTriggerRef.current = trigger;
    setGallery({ item, images: seed, startIndex });
    if (!shouldLoad) return;
    const controller = new AbortController();
    const images = await onLoadPhotos(item, { signal: controller.signal });
    setGallery((current) =>
      current && current.item.id === item.id
        ? { ...current, images: mergeFashionImages(images || [], current.images).slice(0, 8) }
        : current
    );
  }, [onLoadPhotos, items]);

  if (items.length === 0) {
    return (
      <div className="cz-carousel-empty">
        <div>No cards to flip through yet.</div>
      </div>
    );
  }

  return (
    <div className="cz-carousel-stage">
      <motion.div
        className="cz-carousel"
        ref={containerRef}
        tabIndex={0}
        role="listbox"
        aria-label="Card carousel"
        aria-orientation="horizontal"
        aria-activedescendant={
          items[activeIndex] ? "card-" + items[activeIndex].id : undefined
        }
        onKeyDown={onKeyDown}
        onPanEnd={onPanEnd}
        onClick={(e) => {
          // Fallback for clicks that land on the track/container rather than a
          // transformed side-card front face (e.g. some 3D hit-testing scenarios).
          if (e.defaultPrevented) return;
          if (outsideDismissedRef.current) {
            outsideDismissedRef.current = false;
            return;
          }
          if (e.target.closest(".cz-carousel-card")) return;
          if (e.target.closest("button, a, input, textarea, [role='button']")) return;
          const box = containerRef.current?.getBoundingClientRect();
          if (!box || items.length < 2) return;
          const x = e.clientX - box.left;
          // Dead zone equals the active card width; clicks outside it navigate.
          const threshold = cardSize.width * 0.55;
          const center = box.width / 2;
          if (x < center - threshold) goPrev();
          else if (x > center + threshold) goNext();
        }}
        style={{ touchAction: "pan-y" }}
      >
        <div className="cz-carousel-track">
          {items.map((item, index) => {
            const offset = index - activeIndex;
            const abs = Math.abs(offset);
            const isPast = index < activeIndex;
            const x = offset * (cardSize.width * 0.62) + edgeNudgeX;
            const rotateY = offset === 0 ? 0 : isPast ? 38 : -38;
            const scale = 1 - Math.min(abs * 0.08, 0.22);
            const z = -Math.min(abs * 80, 240);
            // Never animate card opacity — translucent springs made the center
            // card see-through so neighbors flashed through it mid-swipe.
            // Dim sides with --cz-card-side + solid faces instead.
            const zIndex = carouselLayerZ(items.length, index, activeIndex);
            const sideAmount = Math.min(abs, 3);
            return (
              <motion.div
                key={item.id}
                className="cz-carousel-card"
                id={"card-" + item.id}
                data-foreground={String(index === activeIndex)}
                role="option"
                aria-selected={String(index === activeIndex)}
                animate={{
                  x,
                  rotateY,
                  z,
                  scale,
                }}
                transition={
                  reduced || suppressMotion
                    ? { duration: 0 }
                    : edgeNudgeX !== 0
                      // Snappier spring for the edge rubber-band press.
                      ? { type: "spring", stiffness: 520, damping: 28 }
                      : { type: "spring", stiffness: 260, damping: 28 }
                }
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  marginLeft: -cardSize.width / 2,
                  marginTop: -cardSize.height / 2,
                  transformOrigin: "center center",
                  // Snap stacking instantly; only geometry springs.
                  zIndex,
                  opacity: 1,
                  ["--cz-card-side"]: String(sideAmount),
                }}
                onClick={(e) => {
                  if (index === activeIndexRef.current) return;
                  if (e.target.closest("button, a, input, textarea, [role='button']")) return;
                  e.stopPropagation();
                  clearEdgeArm();
                  setActiveIndex(index);
                }}
                onPointerDown={(e) => {
                  if (index === activeIndexRef.current) return;
                  if (e.target.closest("button, a, input, textarea, [role='button']")) return;
                  e.stopPropagation();
                  clearEdgeArm();
                  setActiveIndex(index);
                }}
                onPointerDownCapture={(e) => {
                  if (index === activeIndexRef.current) return;
                  if (e.target.closest("button, a, input, textarea, [role='button']")) return;
                  e.stopPropagation();
                  clearEdgeArm();
                  setActiveIndex(index);
                }}
              >
                <CoverFlowCard
                  ref={(handle) => {
                    if (handle) cardRefs.current.set(item.id, handle);
                    else cardRefs.current.delete(item.id);
                  }}
                  item={item}
                  expanded={expandedId === item.id}
                  selected={index === activeIndex}
                  isCenter={index === activeIndex}
                  flipSignal={flipRequest}
                  editSignal={editRequest}
                  haulNames={haulNames}
                  onDelete={onDelete}
                  onSaveEdit={onSaveEdit}
                  onOpen={onOpen}
                  buyLabel={buyLabel}
                  onOpenPhotos={openPhotos}
                  onAttachPhoto={onAttachPhoto}
                  onRemovePhoto={onRemovePhoto}
                  onToggleFavorite={onToggleFavorite}
                  onActivate={onActivate}
                  onDeactivate={onDeactivate}
                  onScrollTo={(id) => {
                    const idx = items.findIndex((c) => c.id === id);
                    if (idx >= 0) setActiveIndex(idx);
                  }}
                  bodyProfile={bodyProfile}
                  measureUnits={measureUnits}
                  onSaveBodyProfile={onSaveBodyProfile}
                  fitPromptSkipped={fitPromptSkipped}
                  onSkipFitPrompt={onSkipFitPrompt}
                  fitPref={
                    fitPrefs && item.category && fitPrefs[item.category]
                      ? fitPrefs[item.category]
                      : null
                  }
                  onSaveFitPref={onSaveFitPref}
                  reduced={reduced}
                />
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* A rack of one has no navigation — the solo grid-tap overlay renders
          just the card, no chevrons or lone dot (Kyle 2026-07-22). */}
      {items.length > 1 && (
        <div className="cz-coverflow-controls" role="group" aria-label="Carousel navigation">
          <button
            type="button"
            className="cz-coverflow-arrow"
            aria-label="Previous card"
            disabled={items.length <= 1}
            onClick={goPrev}
          >
            <ChevronLeft aria-hidden="true" size={14} />
          </button>
          <div className="cz-coverflow-dots">
            {items.map((item, i) => (
              <button
                key={item.id}
                type="button"
                className={"cz-coverflow-dot" + (i === activeIndex ? " is-active" : "")}
                aria-label={"Go to " + (item.title || "card " + (i + 1))}
                aria-current={i === activeIndex ? "true" : undefined}
                onClick={() => {
                  clearEdgeArm();
                  setActiveIndex(i);
                }}
              />
            ))}
          </div>
          <button
            type="button"
            className="cz-coverflow-arrow"
            aria-label="Next card"
            disabled={items.length <= 1}
            onClick={goNext}
          >
            <ChevronRight aria-hidden="true" size={14} />
          </button>
        </div>
      )}

      {gallery && (
        <PhotoCoverFlow
          item={gallery.item}
          images={gallery.images}
          startIndex={gallery.startIndex}
          stageSize={stageSize}
          onClose={closeGallery}
          onSetPrimaryImage={onSetPrimaryImage}
          onLoadPhotos={onLoadPhotos}
        />
      )}
    </div>
  );
}

function PhotoCoverFlow({ item, images, startIndex, stageSize, onClose, onSetPrimaryImage, onLoadPhotos }) {
  const [activeIndex, setActiveIndex] = useState(startIndex || 0);
  const [loadedImages, setLoadedImages] = useState(images);
  const [loading, setLoading] = useState(false);
  const reduced = usePrefersReducedMotion();
  const containerRef = useRef(null);
  const closeRef = useRef(null);
  const dialogRef = useRef(null);
  const [cardSize, setCardSize] = useState({ width: 300, height: 400 });

  useEffect(() => {
    // Native <dialog>.showModal() puts the gallery in the browser top layer
    // above any open sheet (fixed z-index cannot beat a modal dialog).
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    const t = setTimeout(() => closeRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const w = typeof window !== "undefined" ? window.innerWidth : 300;
    const width = w <= 480 ? w * 0.74 : Math.min(w * 0.7, 300);
    const height = width * (4 / 3);
    setCardSize({ width, height });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!!yupooAlbumUrl(item) && loadedImages.length < 8 && onLoadPhotos) {
        setLoading(true);
        const imgs = await onLoadPhotos(item, { signal: new AbortController().signal });
        if (!cancelled) {
          setLoadedImages((cur) => mergeFashionImages(imgs || [], cur).slice(0, 8));
          setLoading(false);
        }
      }
    };
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(loadedImages.length - 1, i + 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loadedImages.length, onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const goNext = useCallback(() => setActiveIndex((i) => Math.min(loadedImages.length - 1, i + 1)), [loadedImages.length]);
  const goPrev = useCallback(() => setActiveIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const wheelAcc = { current: 0 };
    let wheelTimer = null;
    const onWheel = (event) => {
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (Math.abs(delta) < 1) return;
      event.preventDefault();
      wheelAcc.current += delta;
      if (wheelTimer) clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => {
        if (wheelAcc.current > 40) goNext();
        else if (wheelAcc.current < -40) goPrev();
        wheelAcc.current = 0;
      }, 110);
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", onWheel);
      if (wheelTimer) clearTimeout(wheelTimer);
    };
  }, [goNext, goPrev]);

  const markDragging = (info) => {
    if (Math.abs(info.offset.x) <= 4 && Math.abs(info.velocity.x) <= 50) return;
    const container = containerRef.current;
    if (!container) return;
    container.dataset.dragging = "true";
    if (container._dragClear) clearTimeout(container._dragClear);
    container._dragClear = setTimeout(() => delete container.dataset.dragging, 50);
  };

  const onPanEnd = useCallback((event, info) => {
    const threshold = cardSize.width * 0.25;
    if (info.offset.x < -threshold || info.velocity.x < -500) goNext();
    else if (info.offset.x > threshold || info.velocity.x > 500) goPrev();
    markDragging(info);
  }, [cardSize.width, goNext, goPrev]);

  const isDragClick = () => containerRef.current?.dataset.dragging === "true";

  if (loadedImages.length === 0 && !loading) {
    return (
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdrop click + Escape close
      <dialog
        ref={dialogRef}
        className="cz-photo-coverflow-backdrop"
        aria-label="Album photo preview"
        onCancel={(e) => {
          e.preventDefault();
          onClose();
        }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="cz-photo-coverflow">
          <button className="cz-photo-coverflow-close" ref={closeRef} onClick={onClose} aria-label="Close photo preview">✕</button>
          <div style={{ color: "var(--cz-sub)" }}>No photos loaded.</div>
        </div>
      </dialog>
    );
  }

  const multiPhoto = loadedImages.length > 1;

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdrop click + Escape close
    <dialog
      ref={dialogRef}
      className="cz-photo-coverflow-backdrop"
      aria-modal="true"
      aria-label="Album photo preview"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="cz-photo-coverflow">
        <button className="cz-photo-coverflow-close" ref={closeRef} onClick={onClose} aria-label="Close photo preview">✕</button>
        <motion.div
          className="cz-photo-coverflow-stage"
          ref={containerRef}
          onPan={(_event, info) => markDragging(info)}
          onPanEnd={onPanEnd}
        >
          <div className="cz-photo-coverflow-track">
            {loadedImages.map((src, index) => {
              const offset = index - activeIndex;
              const abs = Math.abs(offset);
              const isPast = index < activeIndex;
              const x = offset * (cardSize.width * 0.55);
              const rotateY = offset === 0 ? 0 : isPast ? 35 : -35;
              const scale = 1 - Math.min(abs * 0.08, 0.22);
              const z = -Math.min(abs * 70, 210);
              const opacity = abs > 3 ? 0 : Math.max(0.5, 1 - abs * 0.2);
              return (
                <motion.div
                  key={src + index}
                  className="cz-photo-coverflow-card"
                  initial={false}
                  animate={{ x, rotateY, z, scale, opacity }}
                  transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 240, damping: 26 }}
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    marginLeft: -cardSize.width / 2,
                    marginTop: -cardSize.height / 2,
                    zIndex: 100 - abs,
                  }}
                  onClick={() => {
                    if (isDragClick()) {
                      delete containerRef.current.dataset.dragging;
                      return;
                    }
                    setActiveIndex(index);
                  }}
                >
                  <img src={src} alt={"Album photo " + (index + 1)} draggable={false} loading="lazy" decoding="async" />
                  {index === activeIndex && (
                    <div className="cz-photo-coverflow-caption">{item.title}</div>
                  )}
                </motion.div>
              );
            })}
          </div>
          {/* Frosted chevrons flanking the active photo — hidden for single-photo albums. */}
          {multiPhoto && (
            <>
              <button
                type="button"
                className="cz-photo-coverflow-nav cz-photo-coverflow-nav-prev"
                aria-label="Previous photo"
                disabled={activeIndex <= 0}
                onClick={(e) => {
                  e.stopPropagation();
                  goPrev();
                }}
              >
                <ChevronLeft aria-hidden="true" size={20} strokeWidth={2.2} />
              </button>
              <button
                type="button"
                className="cz-photo-coverflow-nav cz-photo-coverflow-nav-next"
                aria-label="Next photo"
                disabled={activeIndex >= loadedImages.length - 1}
                onClick={(e) => {
                  e.stopPropagation();
                  goNext();
                }}
              >
                <ChevronRight aria-hidden="true" size={20} strokeWidth={2.2} />
              </button>
            </>
          )}
        </motion.div>
        <div className="cz-photo-coverflow-controls">
          {multiPhoto && (
            <span className="cz-photo-coverflow-counter" aria-live="polite">
              {activeIndex + 1} / {loadedImages.length}
            </span>
          )}
          <button
            className="primary"
            onClick={() => {
              onSetPrimaryImage(item.id, loadedImages[activeIndex]);
              onClose();
            }}
          >
            Use as cover
          </button>
        </div>
        {loading && <div style={{ color: "var(--cz-sub)", fontSize: 12 }}>Loading album…</div>}
      </div>
    </dialog>
  );
}

export function ModalShell({ title, onClose, children, maxWidth = 720, trailing, surfaceClassName = "" }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const titleId = useId();
  const triggerRef = useRef(null);

  useEffect(() => {
    triggerRef.current = document.activeElement;
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    requestAnimationFrame(() => closeRef.current && closeRef.current.focus());
    return () => {
      // React removes the node without close(); a modal dialog dropped while
      // open can leave the page inert on iOS (Kyle 2026-07-24: "closing stuff
      // gives me a blank screen"). Close it first so the browser unwinds the
      // top layer and any scroll lock itself.
      if (dialog && dialog.open) dialog.close();
      const trigger = triggerRef.current;
      if (trigger && typeof trigger.focus === "function") trigger.focus();
    };
  }, []);

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdrop click-to-close; keyboard users close via Escape (onCancel)
    <dialog
      ref={dialogRef}
      className="cz-modal"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={{ maxWidth }}
    >
      <div className={("cz-modal-surface " + surfaceClassName).trim()}>
        <div
          className="cz-modal-header"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 16px",
            borderBottom: "1px solid " + HAIR,
          }}
        >
          <h2
            id={titleId}
            style={{ margin: 0, flex: 1, fontFamily: DISPLAY, fontSize: 21, fontWeight: 500, lineHeight: 1.1 }}
          >
            {title}
          </h2>
          {trailing}
          <button
            ref={closeRef}
            type="button"
            className="cz-icon-button"
            aria-label={"Close " + title}
            onClick={onClose}
            style={{
              width: 40,
              height: 40,
              border: 0,
              borderRadius: 999,
              background: "transparent",
              color: SUB,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

function DigestDeck({ slides, onClose, onOpen }) {
  const [i, setI] = useState(0);
  const slide = slides[i];
  const next = () => setI((value) => Math.min(value + 1, slides.length - 1));
  const prev = () => setI((value) => Math.max(value - 1, 0));

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        next();
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        prev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slides.length]);

  return (
    <ModalShell title="Digest" onClose={onClose} maxWidth={440}>
      <div style={{ padding: "22px 22px 18px", minHeight: 250 }} aria-live="polite">
        <Caption style={{ color: BLUE_DK, marginBottom: 14 }}>{slide.eyebrow}</Caption>
        <div
          className="cz-title-balance"
          style={{
            fontFamily: DISPLAY,
            fontSize: 24,
            fontWeight: 500,
            letterSpacing: "-0.035em",
            lineHeight: 1.15,
            marginBottom: 10,
          }}
        >
          {slide.title}
        </div>
        <div className="cz-copy-pretty" style={{ fontSize: 14, lineHeight: 1.6, color: SUB }}>
          {slide.body}
        </div>
        {slide.url && (
          <div style={{ marginTop: 18 }}>
            <Pill primary onClick={() => onOpen(slide.itemId, slide.url)}>
              Open card
            </Pill>
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "12px 14px 14px",
          borderTop: "1px solid " + HAIR,
        }}
      >
        <button
          type="button"
          className="cz-icon-button"
          aria-label="Previous digest card"
          onClick={prev}
          disabled={i === 0}
          style={{ width: 40, height: 40, border: 0, borderRadius: 999, background: SEG, color: INK }}
        >
          ‹
        </button>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
          {slides.map((_, index) => (
            <button
              type="button"
              className="cz-icon-button"
              key={index}
              aria-label={"Go to digest card " + (index + 1) + " of " + slides.length}
              aria-current={index === i ? "step" : undefined}
              onClick={() => setI(index)}
              style={{ width: 32, height: 40, border: 0, background: "transparent", padding: 0 }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: "block",
                  width: index === i ? 16 : 6,
                  height: 6,
                  margin: "0 auto",
                  borderRadius: 999,
                  background: index === i ? ACTION_FILL : HAIR,
                  transition: "background-color 160ms " + EASE,
                }}
              />
            </button>
          ))}
        </div>
        <button
          type="button"
          className="cz-icon-button"
          aria-label="Next digest card"
          onClick={next}
          disabled={i === slides.length - 1}
          style={{ width: 40, height: 40, border: 0, borderRadius: 999, background: SEG, color: INK }}
        >
          ›
        </button>
      </div>
      <div className="cz-status-number" style={{ padding: "0 16px 14px", textAlign: "center", fontSize: 12, color: FAINT }}>
        Card {i + 1} of {slides.length}
      </div>
    </ModalShell>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════════
// ═══ MAIN APP ═══
// ═══════════════════════════════════════════════════════════════════════════════════

// Empty-shelf hero with the transitions.dev staggered text reveal. is-shown
// lands one frame after mount so the entrance transition actually plays.
// Copy: design handoff 4 §10 / 7a (no em dash; names all sources).
function HeroStagger() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className={"t-stagger" + (shown ? " is-shown" : "")}>
      <p className="cz-hero-title cz-title-balance t-stagger-line t-stagger-line--1">
        One shelf for the whole haul.
      </p>
      <p
        className="cz-tagline t-stagger-line t-stagger-line--2"
        style={{ fontSize: 15, color: "var(--cz-sub)", marginBottom: 22, lineHeight: 1.55 }}
      >
        Drop in a Weidian, Taobao or Yupoo link, a Reddit haul post, even a comment. Price, photos and your size land on the card.
      </p>
    </div>
  );
}

// Part 5 Tier A (tasks 7 + 9): the haul board. Budget vs spend, the parcel
// estimator, and the archive switch. Sits in the open-haul head under the
// pipeline chips. Everything persists on the haul record through onUpdate —
// item.project (the name join key) is never touched here.
function HaulBoard({ record, pipeline, totalUsd, onUpdate, onArchive }) {
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState("");
  const [parcelOpen, setParcelOpen] = useState(false);
  const [parcelDraft, setParcelDraft] = useState(null);

  const budget = record && typeof record.budget === "number" ? record.budget : null;
  const currency = record && record.currency === "CNY" ? "CNY" : "USD";
  const parcel = record && record.parcel ? record.parcel : null;
  const archived = record && record.archived === true;
  const spent = Math.round((totalUsd || 0) * 100) / 100;

  const savedChargeable = parcel
    ? chargeableWeightGrams({
        actualGrams: parcel.weightGrams,
        dims: parcel.dims,
        packaging: parcel.packaging,
      })
    : null;
  const draftChargeable = parcelDraft
    ? chargeableWeightGrams({
        actualGrams: Number(parcelDraft.weight),
        dims: { l: Number(parcelDraft.l), w: Number(parcelDraft.w), h: Number(parcelDraft.h) },
        packaging: parcelDraft.packaging,
      })
    : null;

  const openBudget = () => {
    setBudgetDraft(budget != null ? String(budget) : "");
    setBudgetOpen(true);
  };
  const saveBudget = () => {
    const n = Math.round(Number(budgetDraft) * 100) / 100;
    const next = Number.isFinite(n) && n > 0 ? n : null;
    onUpdate(
      { budget: next },
      { type: "budget", detail: next != null ? formatMoney(next, currency) : "cleared" }
    );
    setBudgetOpen(false);
  };

  const openParcel = () => {
    setParcelDraft({
      weight:
        parcel && parcel.weightGrams
          ? String(parcel.weightGrams)
          : pipeline && pipeline.weightGrams
            ? String(pipeline.weightGrams)
            : "",
      l: parcel && parcel.dims && parcel.dims.l ? String(parcel.dims.l) : "",
      w: parcel && parcel.dims && parcel.dims.w ? String(parcel.dims.w) : "",
      h: parcel && parcel.dims && parcel.dims.h ? String(parcel.dims.h) : "",
      packaging: (parcel && parcel.packaging) || "standard",
    });
    setParcelOpen(true);
  };
  const saveParcel = () => {
    const w = Number(parcelDraft.weight);
    const dims = {
      l: Number(parcelDraft.l) || null,
      w: Number(parcelDraft.w) || null,
      h: Number(parcelDraft.h) || null,
    };
    const hasDims = dims.l && dims.w && dims.h;
    const next =
      (Number.isFinite(w) && w > 0) || hasDims
        ? {
            weightGrams: Number.isFinite(w) && w > 0 ? Math.round(w) : null,
            dims: hasDims ? dims : null,
            packaging: parcelDraft.packaging,
          }
        : null;
    onUpdate(
      { parcel: next },
      { type: "parcel", detail: next ? "estimate saved" : "cleared" }
    );
    setParcelOpen(false);
  };

  return (
    <div className="cz-haul-board" aria-label="Haul board">
      <div className="cz-haul-board-row">
        {budget != null ? (
          <button type="button" className="cz-haul-board-stat" onClick={openBudget}>
            Budget {formatMoney(budget, currency)} · spent {formatMoney(spent, "USD")}
            {budget > 0 ? " (" + Math.min(999, Math.round((spent / budget) * 100)) + "%)" : ""}
          </button>
        ) : (
          <button type="button" className="cz-haul-board-btn" onClick={openBudget}>
            Set a budget
          </button>
        )}
        {savedChargeable != null ? (
          <button type="button" className="cz-haul-board-stat" onClick={openParcel}>
            Parcel {formatWeightGrams(savedChargeable)} chargeable
          </button>
        ) : (
          <button type="button" className="cz-haul-board-btn" onClick={openParcel}>
            Estimate the parcel
          </button>
        )}
        <button
          type="button"
          className="cz-haul-board-btn cz-haul-board-archive"
          onClick={onArchive}
        >
          {archived ? "Unarchive" : "Archive"}
        </button>
      </div>

      {budgetOpen ? (
        <div className="cz-haul-board-editor" role="group" aria-label="Haul budget">
          <label className="cz-haul-board-label" htmlFor="cz-haul-budget-input">
            Budget ({currency})
          </label>
          <input
            id="cz-haul-budget-input"
            className="cz-haul-board-input"
            type="number"
            min="0"
            step="1"
            inputMode="decimal"
            value={budgetDraft}
            onChange={(e) => setBudgetDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveBudget();
              if (e.key === "Escape") setBudgetOpen(false);
            }}
          />
          <button type="button" className="cz-haul-board-save" onClick={saveBudget}>
            Save
          </button>
          <button type="button" className="cz-haul-board-btn" onClick={() => setBudgetOpen(false)}>
            Cancel
          </button>
        </div>
      ) : null}

      {parcelOpen && parcelDraft ? (
        <div className="cz-haul-board-editor cz-haul-board-parcel" role="group" aria-label="Parcel estimate">
          <label className="cz-haul-board-label" htmlFor="cz-haul-parcel-weight">
            Weight (g)
          </label>
          <input
            id="cz-haul-parcel-weight"
            className="cz-haul-board-input"
            type="number"
            min="0"
            step="10"
            inputMode="numeric"
            value={parcelDraft.weight}
            onChange={(e) => setParcelDraft({ ...parcelDraft, weight: e.target.value })}
          />
          <span className="cz-haul-board-label" id="cz-haul-parcel-dims-label">
            L × W × H (cm)
          </span>
          <div className="cz-haul-board-dims" role="group" aria-labelledby="cz-haul-parcel-dims-label">
            {["l", "w", "h"].map((axis) => (
              <input
                key={axis}
                className="cz-haul-board-input"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                aria-label={axis === "l" ? "Length (cm)" : axis === "w" ? "Width (cm)" : "Height (cm)"}
                value={parcelDraft[axis]}
                onChange={(e) => setParcelDraft({ ...parcelDraft, [axis]: e.target.value })}
              />
            ))}
          </div>
          <label className="cz-haul-board-label" htmlFor="cz-haul-parcel-pack">
            Packaging
          </label>
          <select
            id="cz-haul-parcel-pack"
            className="cz-haul-board-input"
            value={parcelDraft.packaging}
            onChange={(e) => setParcelDraft({ ...parcelDraft, packaging: e.target.value })}
          >
            {PACKAGING_OPTIONS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          {draftChargeable != null ? (
            <span className="cz-haul-board-result">
              Chargeable {formatWeightGrams(draftChargeable)}
            </span>
          ) : null}
          <p className="cz-haul-board-note">
            Estimate only. The buying agent weighs and measures the final parcel.
          </p>
          <div className="cz-haul-board-actions">
            <button type="button" className="cz-haul-board-save" onClick={saveParcel}>
              Save
            </button>
            <button type="button" className="cz-haul-board-btn" onClick={() => setParcelOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function Credenza() {
  const [items, setItems] = useState([]);
  const [storageState, setStorageState] = useState({ status: "loading", raw: null, error: null });
  const loaded = storageState.status !== "loading";
  const canPersist = storageState.status === "ready" || storageState.status === "save-error";
  const interactionLocked = storageState.status === "load-error";
  const [input, setInput] = useState("");
  const [view, setView] = useState("shelf");
  // null = haul directory; otherwise haul name string.
  const [activeHaul, setActiveHaul] = useState(null);
  // Set by closeHaul() and held until the exit fade finishes, so the open-haul
  // chrome/item-filter don't snap away before the carousel is done fading out
  // (that snap was collapsing the head's height mid-animation — cards "jumped
  // up" as the layout above them disappeared out from under the fade).
  const [closingHaulName, setClosingHaulName] = useState(null);
  const reducedMotion = usePrefersReducedMotion();
  const [search, setSearch] = useState("");
  const [askState, setAskState] = useState({
    status: "idle",
    query: "",
    answer: "",
    results: [],
    error: "",
  });
  const [expandedId, setExpandedId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  // Visible shelf order for delete-neighbor selection (newest/haul/search).
  const listItemsRef = useRef([]);
  const [resurfaced, setResurfaced] = useState(null);
  const [digest, setDigest] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [agentSheetOpen, setAgentSheetOpen] = useState(false);
  // A2 money pipe: which buying agent Buy deep-links into. Soft default with a
  // visible "change anytime" path; persisted in credenza-prefs-v1. Stored item
  // links stay canonical forever — the agent wrap happens only at open time.
  const [preferredAgent, setPreferredAgent] = useState(DEFAULT_AGENT_ID);
  // One-time "Opening in X" toast per agent; re-arms when the agent changes.
  const [agentToastSeenFor, setAgentToastSeenFor] = useState(null);
  // First-load view: carousel is the desktop showpiece; on phones the grid is
  // the sane default (460px card + chrome doesn't fit a 390px screen). Stored
  // viewMode prefs are intentionally not restored — every device lands on its
  // own sane default each session.
  const [viewMode, setViewMode] = useState(() =>
    typeof window !== "undefined" &&
    !!window.matchMedia &&
    window.matchMedia("(max-width: 767px)").matches
      ? "cards"
      : "carousel"
  );
  const [preferencesHydrated, setPreferencesHydrated] = useState(false);
  // "recent" = newest first (default). "starred" = only starred items.
  const [sortMode, setSortMode] = useState("recent");
  // One detail surface everywhere (Kyle 2026-07-22): tapping any grid card
  // opens the carousel on that item; the carousel back holds details + edit.
  const isPhone = useIsPhone();
  // Grid tap presents ONE card as a layer OVER the grid (Kyle 2026-07-22):
  // the tapped item's carousel card pops up solo — no rack, no nav chrome —
  // and the grid stays mounted underneath, so closing lands back on the same
  // scroll position. Value is the tapped item's id (null = closed). The
  // toolbar's carousel view still swaps the whole surface with the full rack.
  const [carouselOverlay, setCarouselOverlay] = useState(null);
  // t-modal phase for the card popup (open | closing). Closing keeps the node
  // mounted for --modal-close-dur so the scale/fade can finish.
  const [overlayPhase, setOverlayPhase] = useState("closed");
  const overlayCloseTimer = useRef(null);
  const closeCarouselOverlayRef = useRef(() => {});
  const openInCarouselRef = useRef(() => {});
  // Focus management for the overlay (Part 5 a11y): root node + the control
  // that opened it, so close can return focus.
  const overlayRef = useRef(null);
  const overlayTriggerRef = useRef(null);
  // Design handoff PR3 (2026-07-23): the capture bar + profile own the old
  // bottom-bar ⋯ menu's jobs. captureSheetOpen = the review surface behind
  // the Stash pill; profileOpen = account/settings sheet from the masthead
  // avatar; bodySheetOpen = the body-measurements form (renamed from
  // profileSheetOpen — "profile" now means the account sheet).
  const [captureSheetOpen, setCaptureSheetOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  // Mobile handoff C2/C4 (2026-07-25). The phone masthead collapsed to one
  // row, so search hides behind an icon and the old bottom bar's Agent /
  // Import / Theme rows live in their own ⋯ sheet.
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsSheetOpen, setSettingsSheetOpen] = useState(false);
  // Account (Part 7e): the Supabase session on this device + the decoded
  // entitlement snapshot (plan badge, limits). Both null when signed out or
  // when AUTH_ENABLED is false (env missing → no account UI at all).
  const [accountSession, setAccountSession] = useState(null);
  const [accountPlan, setAccountPlan] = useState(null);
  // One delayed entitlement retry per boot after a Stripe return (webhook lag).
  const upgradedRetryRef = useRef(false);
  // Account boot (Part 7e). Three entry shapes:
  //   1. Return from a magic link / Google: the session rides the URL hash.
  //      Store it, strip the hash, fetch the entitlement snapshot.
  //   2. Return from Stripe Checkout: ?upgraded=1 / ?upgrade=cancelled. The
  //      webhook moves the plan; refresh now and once more after a beat.
  //   3. Plain open: restore the stored session + cached snapshot, then
  //      refresh the snapshot in the background (offline keeps the cache).
  useEffect(() => {
    if (!AUTH_ENABLED) return;
    let cancelled = false;
    const stripUrl = () => {
      try {
        window.history.replaceState(null, "", window.location.pathname);
      } catch {}
    };
    const pullEntitlement = async (session) => {
      try {
        const payload = await refreshEntitlement(session.accessToken);
        if (!cancelled && payload) setAccountPlan(payload);
      } catch {
        // Offline or the function is not deployed yet — the cache carries on.
      }
    };
    const boot = async () => {
      const fromUrl = sessionFromUrl(window.location.href);
      if (fromUrl) {
        stripUrl();
        if (fromUrl.error) {
          notify("Sign-in failed: " + fromUrl.error);
        } else {
          saveSession(fromUrl.session);
          if (!cancelled) {
            setAccountSession(fromUrl.session);
            notify("Signed in" + (fromUrl.session.user.email ? " as " + fromUrl.session.user.email : "") + ".");
          }
          await pullEntitlement(fromUrl.session);
        }
        return;
      }
      const params = new URLSearchParams(window.location.search);
      if (params.get("upgraded") || params.get("upgrade")) {
        const upgraded = params.get("upgraded");
        stripUrl();
        if (upgraded) notify("Payment received — Pro turns on in a few seconds.");
        else notify("Checkout cancelled — nothing was charged.");
      }
      // Return from the Stripe Customer Portal: land on the Profile sheet,
      // where billing lives (portal.js builds this return URL).
      if (params.get("profile")) {
        stripUrl();
        setProfileOpen(true);
      }
      const session = await getValidSession();
      if (cancelled) return;
      setAccountSession(session);
      if (!session) return;
      const cached = loadCachedEntitlement();
      if (cached) setAccountPlan(cached);
      await pullEntitlement(session);
      if (upgradedRetryRef.current) return; // one delayed retry per boot
      if (params.get("upgraded")) {
        upgradedRetryRef.current = true;
        setTimeout(async () => {
          const fresh = await getValidSession();
          if (fresh && !cancelled) await pullEntitlement(fresh);
        }, 5000);
      }
    };
    boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const accountSendMagicLink = async (email) => {
    await sendMagicLink(email);
  };
  const accountGoogle = () => {
    window.location.assign(googleAuthUrl());
  };
  const accountUpgrade = async (price) => {
    const session = await getValidSession();
    if (!session) {
      setAccountSession(null);
      notify("Your sign-in expired — sign in again first.");
      return;
    }
    const url = await accountCheckout(session.accessToken, price);
    window.location.assign(url);
  };
  const accountOpenPortal = async () => {
    const session = await getValidSession();
    if (!session) {
      setAccountSession(null);
      notify("Your sign-in expired — sign in again first.");
      return;
    }
    const url = await accountPortal(session.accessToken);
    window.location.assign(url);
  };
  const accountSignOut = async () => {
    await authSignOut(accountSession);
    clearCachedEntitlement();
    setAccountSession(null);
    setAccountPlan(null);
    notify("Signed out. Your shelf stays on this device.");
  };
  const accountDelete = async () => {
    const session = await getValidSession();
    if (!session) {
      setAccountSession(null);
      notify("Your sign-in expired — sign in again first.");
      return;
    }
    await accountDeleteRequest(session.accessToken);
    await authSignOut(session); // local clear; the server user is already gone
    clearCachedEntitlement();
    setAccountSession(null);
    setAccountPlan(null);
    notify("Account deleted. Your shelf stays on this device.");
  };
  // Module-level enrichment (chart-vision) reads the plan through the module
  // mirror — component state stays the one source of truth.
  useEffect(() => {
    setPlanForLimits(accountPlan);
  }, [accountPlan]);
  // Delete confirmation (KM-02): every delete path (card-back button,
  // Backspace/Delete key) stages the id here first; the dialog shows the card
  // title and offers Keep / Delete. null = nothing staged.
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  // Search handoff 6a (2026-07-23): no more toggle — desktop gets a permanent
  // search field + a solid ＋ Stash button. Search is ambient, Stash is an
  // event; the two jobs never share one field again.
  // Clipboard fast-path: null = nothing stashable detected.
  const [clipPreview, setClipPreview] = useState(null);
  // Dismissed banner identity ("platform|host"). The focus re-probe keeps the
  // banner hidden until the clipboard holds something new (Kyle 2026-07-24).
  const clipDismissedRef = useRef(null);
  // Display order for dual-currency labels; synced into priceLabel's module
  // reader below. Persisted in credenza-prefs-v1.
  const [pricePrimary, setPricePrimary] = useState("USD");
  useEffect(() => {
    setPricePrimaryPref(pricePrimary);
  }, [pricePrimary]);
  // Fit summary (design handoff PR4): show/hide + Concise/Detailed length,
  // synced into the module readers FitSummary uses. Persisted in prefs.
  const [fitSummary, setFitSummary] = useState(true);
  // Session flag: user dismissed the progressive fit prompt on a card.
  // Not persisted — next session can ask again until a body profile exists.
  const [fitPromptSkipped, setFitPromptSkipped] = useState(false);
  // First-run intro (onboarding step 1). Once dismissed, stays off via prefs.
  const [onboardingDone, setOnboardingDone] = useState(true);
  const [fitDetail, setFitDetail] = useState("concise");
  useEffect(() => {
    setFitPrefs({ summary: fitSummary, detail: fitDetail });
  }, [fitSummary, fitDetail]);
  // Body measurements powering the card-back size pick; persisted in
  // credenza-prefs-v1. Null until the user fills the sheet once. Storage is
  // always cm/kg — measureUnits only controls display/input (default "in",
  // US). Charts are metric; conversion happens at the edges.
  const [bodyProfile, setBodyProfile] = useState(null);
  const [measureUnits, setMeasureUnits] = useState("in");
  const [bodySheetOpen, setBodySheetOpen] = useState(false);
  // Per-category Length/Looseness taste (design turn 5). Shape:
  // { [category]: { length, looseness, dismissed } }. Persisted in prefs.
  const [fitPrefs, setFitPrefsByCat] = useState({});
  const [fitPrefsSheetOpen, setFitPrefsSheetOpen] = useState(false);
  const saveFitPref = (category, pref) => {
    if (!category) return;
    setFitPrefsByCat((prev) => ({
      ...(prev || {}),
      [category]: {
        length: pref && pref.length ? pref.length : null,
        looseness: pref && pref.looseness ? pref.looseness : null,
        dismissed: !!(pref && pref.dismissed),
      },
    }));
  };
  const ownedFitPrefCategories = useMemo(() => {
    const set = new Set();
    for (const it of items || []) {
      if (it && it.category && FIT_PREF_AXES[it.category]) set.add(it.category);
    }
    for (const k of Object.keys(fitPrefs || {})) {
      if (FIT_PREF_AXES[k]) set.add(k);
    }
    return Object.keys(FIT_PREF_AXES).filter((k) => set.has(k));
  }, [items, fitPrefs]);

  // Phones: ~400px of capture/search/tab chrome sits above the carousel, so at
  // first paint the card renders under the fixed bottom bar. Scrolling the
  // stage to the top of the viewport gives the card the full space above the
  // bar (S3/QW10 pads the stage so it always fits). App-level scroll only —
  // carousel internals untouched.
  useEffect(() => {
    if (viewMode !== "carousel") return;
    if (typeof window === "undefined" || !window.matchMedia) return;
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    const id = window.setTimeout(() => {
      document
        .querySelector(".cz-carousel-stage")
        ?.scrollIntoView({ block: "start", behavior: "smooth" });
    }, 80);
    return () => window.clearTimeout(id);
  }, [viewMode]);
  // Indexing chips next to the Inbox tab while a newly stashed item enriches.
  const [indexingJobs, setIndexingJobs] = useState([]);
  const { notification, notify, dismiss: dismissNotification, pause: pauseNotification, resume: resumeNotification } = useNotification();
  const online = useOnlineStatus();
  const undoBatchRef = useRef([]);
  const undoExpiryRef = useRef(null);
  const [theme, setTheme] = useState(null);
  // New editorial gradient is the default colorway; light stays as the alt.
  const mode = theme || "rainbow";
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    // Blackout black / Gallery warm-white — matches the live field for iOS chrome.
    if (meta) meta.setAttribute("content", mode === "rainbow" ? "#000000" : "#F4F4F0");
  }, [mode]);
  // A waiting service worker means a new build is staged. Quiet, compact toast
  // (not a sticky full-width Restart slab) — dismissible, auto-hides.
  useEffect(() => {
    const onUpdateReady = () =>
      notify("Update ready", {
        actionLabel: "Restart",
        onAction: () => window.dispatchEvent(new CustomEvent("credenza:apply-update")),
        duration: 12000,
        tone: "info",
      });
    window.addEventListener("credenza:update-ready", onUpdateReady);
    return () => window.removeEventListener("credenza:update-ready", onUpdateReady);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const searchRef = useRef(null);
  const deskSearchRef = useRef(null);
  // Capture sheet's paste box (design handoff PR3). The top capture box only
  // renders on the empty shelf; everywhere else capture focus means "open the
  // sheet and focus its textarea".
  const sheetCaptureRef = useRef(null);
  const topCaptureVisibleRef = useRef(true);
  const askControllerRef = useRef(null);
  const kb = useRef({});
  const reduced = usePrefersReducedMotion();

  const applyUpdate = (fn) => setItems(fn);
  const updateItem = (id, patch) =>
    applyUpdate((list) =>
      list.map((x) =>
        x.id === id
          ? { ...x, ...(typeof patch === "function" ? patch(x) : patch), updatedAt: Date.now() }
          : x
      )
    );
  const enrichmentTokensRef = useRef(new Map());
  const enrichmentControllersRef = useRef(new Map());
  const updateEnrichedItem = (id, token, patch) => {
    if (token && enrichmentTokensRef.current.get(id) !== token) return;
    updateItem(id, patch);
  };

  // Whole-shelf saves are chained through a promise ref so rapid image/link/edit
  // updates can't land on disk out of order. Quota pruning adopts the pruned
  // array back into state so UI and storage agree.
  const saveChainRef = useRef(Promise.resolve());
  const lastSavedRef = useRef(null);
  useEffect(() => {
    if (!canPersist) return;
    const serialized = JSON.stringify(items);
    if (serialized === lastSavedRef.current) return;
    setStorageState((state) => ({ ...state, status: "saving", error: null }));
    saveChainRef.current = saveChainRef.current.then(async () => {
      try {
        const res = await saveStoredItems({ backend: storageBackend, storeKey: STORE_KEY, items });
        lastSavedRef.current = JSON.stringify(res.items);
        setStorageState({ status: "ready", raw: null, error: null });
        if (res.prunedImages > 0) {
          setItems(res.items);
          flashImportResult(
            "Storage was full — removed thumbnails from " +
              res.prunedImages +
              " older " +
              (res.prunedImages === 1 ? "card" : "cards") +
              ". Links and notes are safe."
          );
        }
      } catch (error) {
        setStorageState({ status: "save-error", raw: null, error });
        flashImportResult("Changes aren't saved. Export a backup before closing Credenza.", null, true);
      }
    });
  }, [canPersist, items]);

  useEffect(() => {
    if (preferencesHydrated && ["ready", "saving", "save-error"].includes(storageState.status))
      storageBackend
        .set(
          "credenza-prefs-v1",
          JSON.stringify({
            viewMode,
            sortMode,
            theme: theme || "rainbow",
            colorwayVersion: 4,
            preferredAgent,
            agentToastSeenFor,
            bodyProfile,
            measureUnits,
            pricePrimary,
            fitSummary,
            fitDetail,
            onboardingDone,
            fitPrefs,
          })
        )
        .catch(() => {});
  }, [preferencesHydrated, storageState.status, viewMode, sortMode, theme, preferredAgent, agentToastSeenFor, bodyProfile, measureUnits, pricePrimary, fitSummary, fitDetail, onboardingDone, fitPrefs]);

  // Part 5 Tier A: first-class haul records (budget, parcel, archive state,
  // history). item.project keeps the haul NAME; the record adds the rest.
  const [hauls, setHauls] = useState([]);
  const [haulsHydrated, setHaulsHydrated] = useState(false);
  const [showArchivedHauls, setShowArchivedHauls] = useState(false);
  useEffect(() => {
    let cancelled = false;
    storageBackend
      .get(HAULS_KEY)
      .then((raw) => {
        if (cancelled) return;
        try {
          // The backend resolves with the raw string (null when unset),
          // same contract as the prefs load below.
          const parsed = raw ? JSON.parse(raw) : [];
          setHauls((Array.isArray(parsed) ? parsed : []).map(migrateHaul).filter(Boolean));
        } catch {
          setHauls([]);
        }
        setHaulsHydrated(true);
      })
      .catch(() => {
        if (!cancelled) setHaulsHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [storageBackend]);
  useEffect(() => {
    if (!haulsHydrated) return;
    storageBackend.set(HAULS_KEY, JSON.stringify(hauls)).catch(() => {});
  }, [hauls, haulsHydrated, storageBackend]);
  // Find-or-create by name, apply the patch, append one history line.
  const updateHaul = useCallback((name, patch, historyEntry) => {
    const clean = String(name || "").trim();
    if (!clean) return;
    setHauls((list) => {
      const idx = list.findIndex((h) => h.name === clean);
      const base = idx >= 0 ? list[idx] : migrateHaul({ name: clean, history: [] });
      const applied = typeof patch === "function" ? patch(base) : patch;
      let next = { ...base, ...applied, updatedAt: Date.now() };
      if (historyEntry) {
        next = {
          ...next,
          history: [...(base.history || []), { at: Date.now(), ...historyEntry }].slice(-50),
        };
      }
      return idx >= 0 ? list.map((h, i) => (i === idx ? next : h)) : [...list, next];
    });
  }, []);

  useEffect(() => {
    loadStoredItems({
      backend: storageBackend,
      storeKey: STORE_KEY,
      legacyKey: V2_KEY,
      migrateItem,
    }).then((result) => {
      if (result.status === "error") {
        setStorageState({ status: "load-error", raw: result.raw, error: result.error });
        return;
      }
      lastSavedRef.current = JSON.stringify(result.items);
      let it = result.items;
      // Share-sheet / PWA share_target / bookmarklet capture: /?stash=<url or text>.
      // Consumed before first paint so the card is just *there*, then scrubbed from
      // the URL so refreshes don't re-stash.
      try {
        const params = new URLSearchParams(window.location.search);
        // Share sheets often split the URL and accompanying text across params
        // (e.g. yupoo link in one, weidian link in the other) — combine, don't pick.
        const pieces = [];
        for (const k of ["stash", "text", "url"]) {
          const v = (params.get(k) || "").trim();
          if (v && !pieces.includes(v)) pieces.push(v);
        }
        const shared = pieces.join("\n");
        if (shared) {
          const sharedTitle = (params.get("title") || "").trim();
          const parsed = classify(shared);
          const key = canonicalKey(parsed, shared);
          const dup = it.find((x) => itemMatchesCanonicalKey(x, key));
          if (dup) {
            notify("Already on the shelf: “" + dup.title + "” — opened it below.", { duration: DUPE_BANNER_MS });
            setExpandedId(dup.id);
            setTimeout(() => enrichFashionItem(dup), 0);
          } else {
            const extra = { sourceImport: "share" };
            if (sharedTitle && parsed.url) extra.title = sharedTitle.slice(0, 72);
            const sharedItem = createItem(parsed, shared, extra);
            it = [sharedItem, ...it];
            flashImportResult("Stashed from share.");
            setTimeout(() => enrichFashionItem(sharedItem), 0);
          }
          window.history.replaceState(null, "", window.location.pathname);
        }
      } catch (e) {}
      // Merge, do not replace (audit 2026-07-24): a stash during the load
      // window used to vanish here. lastSavedRef keeps the stored snapshot,
      // so the save effect persists the merged list once status is ready.
      setItems((current) => mergeLoadedItems(it, current));
      setStorageState({ status: "ready", raw: null, error: null });
      const pick = pickResurface(it, Date.now());
      if (pick) {
        setResurfaced(pick.id);
        updateItem(pick.id, (x) => ({
          resurfacedCount: (x.resurfacedCount || 0) + 1,
          lastResurfacedAt: Date.now(),
        }));
      }
    });
    storageBackend
      .get("credenza-prefs-v1")
      .then((raw) => {
        try {
          const p = JSON.parse(raw || "{}");
          // Older prefs used multi-sort pills; map anything unknown back to recent,
          // and keep only the Starred filter as a first-class mode.
          if (p.sortMode === "starred") setSortMode("starred");
          else setSortMode("recent");
          // One-shot colorway migrate: land on Blackout dark once (Gallery light is
          // the other toggle). After that, Theme preference is sticky again.
          if (p.colorwayVersion !== 4) {
            setTheme("rainbow");
            storageBackend
              .set(
                "credenza-prefs-v1",
                JSON.stringify({
                  // "rows" view was scrapped (Kyle 2026-07-22) — anything
                  // stored other than cards falls back to carousel.
                  viewMode: p.viewMode === "cards" ? "cards" : "carousel",
                  sortMode: p.sortMode === "starred" ? "starred" : "recent",
                  theme: "rainbow",
                  colorwayVersion: 4,
                  // Agent prefs survive the one-shot colorway rewrite.
                  preferredAgent: validStoredAgentId(p.preferredAgent),
                  agentToastSeenFor: p.agentToastSeenFor || null,
                  bodyProfile: p.bodyProfile && typeof p.bodyProfile === "object" ? p.bodyProfile : null,
                  measureUnits: p.measureUnits === "cm" ? "cm" : "in",
                  pricePrimary: p.pricePrimary === "CNY" ? "CNY" : "USD",
                  fitSummary: p.fitSummary !== false,
                  fitDetail: p.fitDetail === "detailed" ? "detailed" : "concise",
                  onboardingDone: p.onboardingDone !== false,
                  fitPrefs: p.fitPrefs && typeof p.fitPrefs === "object" ? p.fitPrefs : {},
                })
              )
              .catch(() => {});
          } else if (["light", "rainbow"].includes(p.theme)) {
            setTheme(p.theme);
          }
          // A2: agent prefs. Unknown/retired stored agents fall back to the
          // soft default rather than stranding Buy buttons. Stored
          // affiliateCodes are ignored on purpose (audit 2026-07-24): codes
          // are build-time env only now.
          setPreferredAgent(validStoredAgentId(p.preferredAgent));
          if (p.agentToastSeenFor) setAgentToastSeenFor(p.agentToastSeenFor);
          if (p.bodyProfile && typeof p.bodyProfile === "object") setBodyProfile(p.bodyProfile);
          if (p.measureUnits === "cm" || p.measureUnits === "in") setMeasureUnits(p.measureUnits);
          if (p.pricePrimary === "CNY" || p.pricePrimary === "USD") setPricePrimary(p.pricePrimary);
          if (p.fitSummary === false) setFitSummary(false);
          if (p.fitDetail === "concise" || p.fitDetail === "detailed") setFitDetail(p.fitDetail);
          if (p.fitPrefs && typeof p.fitPrefs === "object") setFitPrefsByCat(p.fitPrefs);
          // First-run intro: only brand-new prefs (no prior onboardingDone key)
          // show the Get started screen. Existing users stay on the shelf.
          if (Object.prototype.hasOwnProperty.call(p, "onboardingDone")) {
            setOnboardingDone(p.onboardingDone !== false);
          } else if (raw) {
            setOnboardingDone(true);
          } else {
            setOnboardingDone(false);
          }
        } catch (e) {}
      })
      .catch(() => {})
      .finally(() => setPreferencesHydrated(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ————— Capture: instant, local, never lost —————
  // Shared pipeline for the capture box and one-tap clipboard stash.
  // Returns a status string; when stashed, also returns the new item id so the
  // indexing chip can track enrichment progress next to the Inbox tab.
  const stash = (raw, extra) => {
    const text = (raw || "").trim();
    if (!text) return { status: "empty" };
    const parsed = classify(text);
    const key = canonicalKey(parsed, text);
    const dupItem = items.find((x) => itemMatchesCanonicalKey(x, key)) || null;
    if (dupItem) {
      notify("Already on the shelf: “" + dupItem.title + "” — refreshing it below.", { duration: DUPE_BANNER_MS });
      setExpandedId(dupItem.id);
      setSelectedId(dupItem.id);
      enrichFashionItem(dupItem);
      return { status: "dupe", id: dupItem.id };
    }
    const item = createItem(parsed, text, extra);
    applyUpdate((list) => [item, ...list]);
    markActivation(storageBackend, "capture");
    // Yupoo albums and marketplace links share one guarded enrichment pipeline.
    enrichFashionItem(item);
    // Optional AI pass — enhances the already-usable card; failures change nothing.
    if (aiAvailable()) {
      updateItem(item.id, { status: "enriching" });
      aiEnhanceItem(item).then((info) => {
        if (info) updateItem(item.id, { ...info, status: "ready" });
        else updateItem(item.id, { status: "ready" });
      });
    }
    return { status: "stashed", id: item.id, title: item.title || "" };
  };

  const beginIndexingJob = useCallback((result) => {
    if (!result || result.status !== "stashed" || !result.id) return;
    const id = result.id;
    // A fresh stash lands in the Inbox while it enriches. Take the customer
    // to it — otherwise the Shelf tab says "Nothing on the shelf yet" right
    // after they stashed something (2026-07-25 mobile audit). The effect that
    // watches inboxItems snaps back to Shelf when indexing finishes.
    setView("inbox");
    setIndexingJobs((jobs) => {
      const without = jobs.filter((j) => j.id !== id);
      return [
        ...without,
        {
          id,
          title: result.title || "New item",
          progress: 12,
          phase: "indexing",
          startedAt: Date.now(),
        },
      ].slice(-4);
    });
  }, []);

  // Haul mode: a lone Reddit post link is read server-side and its text goes
  // through the haul parser; anything else (the copied post text itself, a
  // comment wall) imports directly. One paste → one card per item.
  const stashRedditHaul = async (raw) => {
    const text = (raw || "").trim();
    if (!text) return;
    if (REDDIT_POST_URL_RE.test(text)) {
      if (!PREVIEW_SECRET) {
        // No reader configured — the raw paste still imports what it can.
        runImport(text);
        return;
      }
      notify("Reading that Reddit post…", { duration: 4000 });
      const post = await fetchRedditPost(text);
      if (post && post.found && post.selftext) {
        // The fetched title names single-link QC posts (corpus 2026-07-24).
        runImport(post.selftext, { redditTitle: post.title || "" });
      } else if (post && post.found === false && post.reason === "no-text") {
        // Link/image post: no item text exists — stash the post itself.
        stash(post.url || text);
      } else {
        flashImportResult(
          (post && post.error) ||
            "Couldn't read that Reddit post — paste the post text here instead."
        );
      }
      return;
    }
    runImport(text);
  };

  // One entry point for every capture surface (Kyle 2026-07-24: "one
  // congruent setup" — the mode tabs are gone). The paste itself decides:
  // a Reddit post link is fetched and chopped into items; any multi-line
  // paste goes through the import parser (haul-shaped text becomes one card
  // per item, a plain note stays whole); a single line stashes as one card
  // through the fashion gate.
  const dispatchStash = (raw) => {
    const text = (raw || "").trim();
    if (!text) return { status: "empty" };
    if (REDDIT_POST_URL_RE.test(text) || /\n/.test(text)) {
      stashRedditHaul(text);
      return { status: "hauling" };
    }
    // Fashion gate (Kyle 2026-07-23): the shelf is fashion-only. A URL with no
    // marketplace/agent/Reddit host asks first — clipboard accidents (news,
    // video, music) never become cards silently. The paste stays in the box;
    // "Stash anyway" is the override for niche shops the gate doesn't know.
    if (fashionGateStatus(text) === "gated") {
      notify("That doesn't look like a fashion link — nothing stashed yet.", {
        actionLabel: "Stash anyway",
        onAction: () => {
          const result = stash(text);
          if (result.status === "stashed") beginIndexingJob(result);
        },
        duration: 8000,
      });
      return { status: "gated" };
    }
    return stash(text);
  };

  const capture = () => {
    const result = dispatchStash(input);
    if (result.status === "empty" || result.status === "gated") return; // gated keeps the paste
    setInput("");
    if (result.status === "stashed") beginIndexingJob(result);
  };

  // The hero bar (empty shelf) stashes what sits in its field. An empty field
  // opens the phone capture sheet, or reads the clipboard on desktop. One
  // field, one button, one behavior everywhere (Kyle 2026-07-24).
  const heroStash = () => {
    const text = search.trim();
    if (text) {
      const result = dispatchStash(text);
      if (result.status === "stashed") beginIndexingJob(result);
      if (result.status !== "empty" && result.status !== "gated") setSearch("");
      return;
    }
    if (isPhone) setCaptureSheetOpen(true);
    else stashClipboard();
  };

  // One tap: read the clipboard and stash it directly. Browsers guard clipboard
  // reads, so every failure path guides the user somewhere useful — never a dead
  // button, never a vague shrug.
  const stashClipboard = async () => {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      focusCapture();
      flashImportResult("This browser can't share the clipboard here — paste anywhere with ⌘V instead.");
      return;
    }
    let text = "";
    try {
      text = await navigator.clipboard.readText();
    } catch (e) {
      let state = "";
      try {
        const p = await navigator.permissions.query({ name: "clipboard-read" });
        state = p.state;
      } catch (e2) {}
      focusCapture();
      flashImportResult(
        state === "denied"
          ? "Clipboard access is turned off for this site — turn it on next to the address bar, or paste anywhere with ⌘V."
          : "Clipboard needs a quick permission — allow it when your browser asks, or paste anywhere with ⌘V."
      );
      return;
    }
    if (!text || !text.trim()) {
      flashImportResult("Clipboard's empty.");
      return;
    }
    const result = dispatchStash(text);
    if (result.status === "stashed") {
      beginIndexingJob(result);
      flashImportResult("Stashed from the clipboard.");
    }
  };

  // Capture focus router (phone only — KM-03 removed the desktop sheet). On
  // desktop the flash message already tells the user to paste with ⌘V, and
  // the paste handler stashes that paste directly.
  function focusCapture() {
    if (!isPhone) return;
    setCaptureSheetOpen(true);
    requestAnimationFrame(() => {
      if (sheetCaptureRef.current) sheetCaptureRef.current.focus();
    });
  }

  // CO-21: the empty shelf invites "Paste a link" — honor it. A pasted link
  // stashes instead of landing in the search box (the window paste handler
  // ignores pastes focused in inputs). Non-link text falls through to normal
  // editing so search still works.
  const onSearchPaste = (e) => {
    const text = e.clipboardData && e.clipboardData.getData("text");
    const trimmed = (text || "").trim();
    // Multi-line pastes (Reddit hauls, lists) and Reddit post links cannot
    // live in a one-line input: the field strips the newlines and the haul
    // mangles into one junk card (2026-07-25 haul audit — a 5-item HIPOBUY
    // post became a single "1688 Offer" card). Route them exactly like the
    // window-level paste handler does: review sheet on the phone, straight
    // into the import parser on desktop.
    const haulShape = /\n/.test(trimmed) || REDDIT_POST_URL_RE.test(trimmed);
    if (!/^https?:\/\/\S+$/i.test(trimmed) && !haulShape) return;
    e.preventDefault();
    if (isPhone) {
      setInput(trimmed);
      setCaptureSheetOpen(true);
    } else {
      const result = dispatchStash(trimmed);
      if (result.status === "stashed") beginIndexingJob(result);
    }
  };

  // Clipboard-detected split pill (design handoff PR3): browsers only allow a
  // SILENT clipboard read when the site already holds clipboard-read
  // permission, so probe the permission first and never trigger a prompt from
  // here. Granted → read on mount + window focus and show what the clipboard
  // holds; anything else → the bar falls back to the plain ＋ Stash pill (a
  // tap is a user gesture, which is allowed to prompt).
  useEffect(() => {
    if (!navigator.clipboard || !navigator.clipboard.readText) return;
    let cancelled = false;
    const probe = async () => {
      try {
        if (navigator.permissions && navigator.permissions.query) {
          const perm = await navigator.permissions.query({ name: "clipboard-read" });
          if (perm && perm.state === "denied") {
            if (!cancelled) setClipPreview(null);
            return;
          }
        }
        const text = await navigator.clipboard.readText();
        if (cancelled) return;
        const preview = clipboardPreviewFor(text);
        if (preview && preview.platform + "|" + preview.host === clipDismissedRef.current) {
          setClipPreview(null);
        } else {
          setClipPreview(preview);
        }
      } catch {
        if (!cancelled) setClipPreview(null);
      }
    };
    probe();
    window.addEventListener("focus", probe);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", probe);
    };
  }, []);

  // X on the banner: hide it and remember what was dismissed so the focus
  // re-probe does not bring the same clipboard content back (Kyle 2026-07-24).
  const dismissClipPreview = () => {
    if (clipPreview) clipDismissedRef.current = clipPreview.platform + "|" + clipPreview.host;
    setClipPreview(null);
  };

  // ————— Import: local parsing, local enrichment, dedupe against the shelf —————
  // Notifications own their timers so stale messages cannot dismiss newer ones.
  const flashImportResult = (message, action, persistent = false) =>
    notify(message, {
      actionLabel: action === "digest" ? "Deal the digest" : null,
      onAction: action === "digest" ? buildDigest : null,
      duration: action ? 9000 : 5000,
      persistent,
      tone: persistent ? "error" : "info",
    });

  const runImport = (text, opts = {}) => {
    const { candidates, provider } = parseImport(text, opts);
    const { fresh, dupes, duplicates } = buildImportItems(candidates, items, provider);
    if (fresh.length) applyUpdate((list) => [...fresh, ...list]);
    if (fresh.length) markActivation(storageBackend, "import");
    if (fresh.length || duplicates.length) enrichFashionItems([...fresh, ...duplicates]);
    setImportOpen(false);
    if (fresh.length === 0) {
      flashImportResult(
        dupes > 0
          ? "Nothing new — all " + dupes + " already on the shelf."
          : "No links or notes found in that paste."
      );
    } else {
      const from =
        provider !== "paste" ? " from your " + PROVIDER_LABELS[provider] : "";
      // Big imports get an Undo (Kyle 2026-07-24 — one bad paste should never
      // mean deleting a pile of cards by hand). This takes the action slot
      // that "Deal the digest" had at >= 5.
      if (fresh.length >= 5) {
        const freshIds = new Set(fresh.map((x) => x.id));
        notify(
          "Imported " + fresh.length + " things" + from + ".",
          {
            actionLabel: "Undo import",
            onAction: () =>
              applyUpdate((list) => list.filter((x) => !freshIds.has(x.id))),
            duration: 12000,
          }
        );
        return;
      }
      flashImportResult(
        "Imported " +
          fresh.length +
          " " +
          (fresh.length === 1 ? "thing" : "things") +
          from +
          "." +
          (dupes > 0
            ? " " + dupes + " " + (dupes === 1 ? "was" : "were") + " already on the shelf."
            : "")
      );
    }
  };

  // ————— Backup: the shelf as a file you own —————
  const downloadJson = (contents, filename) => {
    const blob = new Blob([contents], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const exportShelf = () => {
    downloadJson(
      JSON.stringify(items, null, 2),
      "credenza-shelf-" + new Date().toISOString().slice(0, 10) + ".json"
    );
  };

  // Clear the whole shelf — the escape hatch for a bad bulk import (Kyle
  // 2026-07-24: 174 junk cards from one page paste). Confirm first; the toast
  // still offers an Undo for 12s after.
  const clearShelf = () => {
    if (!items.length) return;
    const confirmed = window.confirm(
      "Delete all " +
        items.length +
        " cards on the shelf? Download a .json backup first if you want one."
    );
    if (!confirmed) return;
    const backup = items;
    applyUpdate(() => []);
    setImportOpen(false);
    notify("Shelf cleared — " + backup.length + " cards deleted.", {
      actionLabel: "Undo",
      onAction: () => applyUpdate(() => backup),
      duration: 12000,
    });
  };

  const downloadRecoveryData = () => {
    if (storageState.raw == null) return;
    downloadJson(
      storageState.raw,
      "credenza-recovery-" + new Date().toISOString().slice(0, 10) + ".json"
    );
  };

  // Erase EVERY Credenza record on this device — shelf, preferences, body
  // measurements, outbound click log, service-worker caches (Execution-Plan
  // Part 4; the old Clear left all but the shelf behind). No Undo: the point
  // is that nothing stays. Reloads so in-memory state cannot resurrect a key.
  const eraseEverything = async () => {
    const confirmed = window.confirm(
      "Delete ALL Credenza data on this device? This removes the shelf, your sizes, every preference, and the click log. There is no Undo. Download a .json backup first if you want one."
    );
    if (!confirmed) return;
    try {
      await eraseAllCredenzaData(window);
    } catch {}
    window.location.reload();
  };

  const continueSessionOnly = () => {
    setItems([]);
    setStorageState({ status: "session-only", raw: storageState.raw, error: storageState.error });
    notify("Session-only mode. Changes will disappear when this window closes.", {
      persistent: true,
      tone: "error",
    });
  };

  const startEmptyShelf = async () => {
    const confirmed = window.confirm(
      "Replace the unreadable local shelf with an empty one? Download recovery data first if it is available."
    );
    if (!confirmed) return;
    await storageBackend.set(STORE_KEY, "[]");
    lastSavedRef.current = "[]";
    setItems([]);
    setStorageState({ status: "ready", raw: null, error: null });
    notify("Started an empty shelf.");
  };

  const restoreBackup = (arr) => {
    if (["load-error", "session-only"].includes(storageState.status)) {
      lastSavedRef.current = null;
      setStorageState({ status: "ready", raw: null, error: null });
    }
    let added = 0;
    applyUpdate((list) => {
      let next = list;
      for (const raw of arr) {
        try {
          const item = migrateItem(raw);
          if (next.some((x) => itemMatchesCanonicalKey(x, item.canonicalKey))) continue;
          next = [item, ...next];
          added++;
        } catch (e) {}
      }
      return next;
    });
    setImportOpen(false);
    flashImportResult(
      added === 0
        ? "Backup read — everything in it is already on the shelf."
        : "Restored " + added + " " + (added === 1 ? "card" : "cards") + " from backup."
    );
  };

  const hasSamples = useMemo(() => items.some((x) => x.sourceImport === "sample"), [items]);

  const addSamples = () => {
    if (hasSamples) return;
    const samples = buildSampleItems();
    applyUpdate((list) => [...samples, ...list]);
    setImportOpen(false);
    flashImportResult(SAMPLE_COUNT + " sample cards on the shelf. Clear them anytime.");
    const pick = pickResurface(samples, Date.now());
    if (pick && !resurfaced) {
      setResurfaced(pick.id);
      updateItem(pick.id, (x) => ({
        resurfacedCount: (x.resurfacedCount || 0) + 1,
        lastResurfacedAt: Date.now(),
      }));
    }
  };

  const clearSamples = () => {
    const records = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.sourceImport === "sample")
      .map((record) => ({
        ...record,
        wasSelected: selectedId === record.item.id,
        wasExpanded: expandedId === record.item.id,
        wasResurfaced: resurfaced === record.item.id,
      }));
    if (!records.length) return;
    undoBatchRef.current = records;
    applyUpdate((list) => list.filter((item) => item.sourceImport !== "sample"));
    if (records.some((record) => record.wasSelected)) setSelectedId(null);
    if (records.some((record) => record.wasExpanded)) setExpandedId(null);
    if (records.some((record) => record.wasResurfaced)) setResurfaced(null);
    if (importOpen) setImportOpen(false);
    if (undoExpiryRef.current) clearTimeout(undoExpiryRef.current);
    undoExpiryRef.current = setTimeout(() => {
      undoBatchRef.current = [];
      undoExpiryRef.current = null;
    }, 6200);
    notify("Sample shelf cleared.", { actionLabel: "Undo", onAction: undoRemoved, duration: 6000 });
  };

  const retry = (id) => {
    const it = items.find((x) => x.id === id);
    if (!it || !aiAvailable()) return;
    updateItem(id, { status: "enriching", error: null });
    aiEnhanceItem(it).then((info) => {
      if (info) updateItem(id, { ...info, status: "ready" });
      else updateItem(id, { status: "failed", error: "Couldn't reach the assistant." });
    });
  };

  // ————— Edits, opens, removal —————
  const saveEdit = (id, patch) => {
    updateItem(id, patch);
    // Activation milestones (Part 6 task 4): mark on TRANSITIONS only, so a
    // debounced draft re-save of an already-GL card does not count as a fresh
    // QC decision. Function patches carry no inspectable intent — skipped.
    if (patch && typeof patch === "object") {
      const before = items.find((x) => x.id === id) || null;
      if (before) {
        if (!before.project && typeof patch.project === "string" && patch.project.trim()) {
          markActivation(storageBackend, "haulNamed");
        }
        if (
          (patch.findStatus === "gl" || patch.findStatus === "rl") &&
          before.findStatus !== patch.findStatus
        ) {
          markActivation(storageBackend, "qcDecision");
        }
        if (!before.size && typeof patch.size === "string" && patch.size.trim()) {
          markActivation(storageBackend, "sizeDecision");
        }
      }
    }
    // Note edits used to flow through a dedicated saveNote that re-ran intent
    // extraction; the unified edit form saves notes through here instead.
    if (Object.prototype.hasOwnProperty.call(patch, "note")) {
      const note = patch.note || "";
      const applyExtraction = (ex) => {
        if (!ex) return;
        updateItem(id, (x) => ({
          extractedIntent: ex.extractedIntent || x.extractedIntent,
          project: ex.project || x.project,
          people: ex.people && ex.people.length ? ex.people : x.people,
          useCase: ex.useCase || x.useCase,
          importance:
            ex.importance && x.importance === "medium" ? ex.importance : x.importance,
        }));
      };
      applyExtraction(extractIntentLocal(note));
      if (aiAvailable()) aiExtractIntent(note).then(applyExtraction);
    }
  };
  const toggleFavorite = (id) => {
    updateItem(id, (item) => ({ favorite: item.favorite !== true }));
  };

  // Manual image attach: compress then store. Manual always wins over auto-fetch.
  const attachImage = async (id, file) => {
    if (!file) return;
    try {
      const dataUrl = await compressImageBlob(file);
      updateItem(id, { image: dataUrl });
    } catch (e) {
      flashImportResult("Couldn't read that image.");
    }
  };
  const attachGalleryImage = async (id, file) => {
    if (!file) return;
    try {
      const dataUrl = await compressImageBlob(file);
      updateItem(id, (x) => ({ gallery: [...(x.gallery || []), dataUrl].slice(0, 12) }));
    } catch (e) {
      flashImportResult("Couldn't read that gallery image.");
    }
  };
  // Remove by exact src so edit-mode can drop either the cover or a gallery tile.
  // If the cover is deleted, promote the first remaining gallery image.
  const removePhotoBySrc = (id, src) =>
    updateItem(id, (x) => {
      if (!src) return {};
      if (x.image === src) {
        const rest = (x.gallery || []).filter((g) => g !== src);
        return { image: rest[0] || null, gallery: rest.slice(1) };
      }
      return { gallery: (x.gallery || []).filter((g) => g !== src) };
    });
  const setPrimaryImage = (id, dataUrl) =>
    updateItem(id, (x) => {
      const nextGallery = (x.gallery || []).filter((g) => g !== dataUrl);
      if (x.image) nextGallery.unshift(x.image);
      return { image: dataUrl, gallery: nextGallery.slice(0, 12) };
    });

  // Relay one URL through the preview function and return a compressed data
  // URL, or null. The relay follows og:image for pages and streams direct
  // image URLs (e.g. Weidian CDN) as-is.
  const relayImageDataUrl = async (url, referer = "", signal = null) => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal) {
      if (signal.aborted) return null;
      signal.addEventListener("abort", abort, { once: true });
    }
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await monitoredFetch(storageBackend, "preview", PREVIEW_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json", "x-credenza-key": PREVIEW_SECRET },
        body: JSON.stringify({ url, ...(referer ? { referer } : {}) }),
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const blob = await res.blob();
      if (!/^image\//.test(blob.type || "")) return null;
      return await compressImageBlob(blob);
    } catch (e) {
      return null;
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener("abort", abort);
    }
  };

  const loadAlbumPhotos = async (item, { signal } = {}) => {
    const isHotlink = (src) => /^https?:\/\/photo\.yupoo\.com\//i.test(src || "");
    const existing = mergeFashionImages(
      item.image ? [item.image] : [],
      item.gallery || []
    ).filter((src) => !isHotlink(src));
    const albumUrl = yupooAlbumUrl(item);
    if (!albumUrl || existing.length >= 8) return existing.slice(0, 8);
    const data = await fetchYupooImages(albumUrl, { signal });
    if (!data || (signal && signal.aborted)) return existing.slice(0, 8);

    const photos = [...existing];
    for (const src of mergeFashionImages(data.images || [])) {
      if (photos.length >= 8 || (signal && signal.aborted)) break;
      const dataUrl = await relayImageDataUrl(src, data.url || albumUrl, signal);
      if (dataUrl) photos.push(dataUrl);
    }
    const merged = mergeFashionImages(photos).slice(0, 8);
    if (!(signal && signal.aborted)) {
      updateItem(item.id, (current) => ({
        image: current.image || merged[0] || null,
        gallery: mergeFashionImages(
          current.gallery || [],
          merged.filter((src) => src !== current.image)
        ).slice(0, 12),
      }));
    }
    return merged;
  };

  // Opens the app-level album with the item's stored images as the seed;
  // PhotoCoverFlow lazily loads the full Yupoo album itself via onLoadPhotos.
  // Auto-fetch a preview image after stash. Best-effort enhancement: silent on
  // every failure, never touches status, never overwrites a manual image (the
  // functional patch checks current.image in case one landed mid-flight).
  const fetchAutomaticImage = async (item, token = null) => {
    if (!PREVIEW_SECRET || item.image) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    const photos = (item.links || []).find((l) => l.role === "photos");
    const candidates = [];
    if (photos) candidates.push(photos.url);
    if (item.url && !item.videoId) candidates.push(item.url); // YouTube already has a thumb
    if (!candidates.length) return;
    for (const url of candidates.slice(0, 2)) {
      const dataUrl = await relayImageDataUrl(url);
      if (dataUrl) {
        updateEnrichedItem(item.id, token, (x) => (x.image ? {} : { image: dataUrl }));
        return;
      }
    }
  };

  // Buy-link resolver. Weidian product pages are empty JS shells, so the
  // resolve function reads Weidian's own item API server-side, translates the
  // Chinese listing via Claude, and returns price / sizes / images in one shot.
  // Best-effort like every cloud enhancement: any failure leaves the local
  // card exactly as local intelligence made it. Returns true when it handled
  // images itself (so the caller can skip fetchAutomaticImage).
  const resolveBuyDetails = async (item, { token = null, signal = null, preserveTitle = false } = {}) => {
    if (!PREVIEW_SECRET) return false;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
    // Part 7e: signed-in FREE user over the daily resolve cap — skip the
    // cloud read, keep the local card (same as offline).
    if (overFreeLimit(accountPlan, "resolve")) return false;
    const buyUrl = resolvableBuyUrl(item);
    if (!buyUrl) return false;
    updateEnrichedItem(item.id, token, { status: "enriching" });
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal) {
      if (signal.aborted) return false;
      signal.addEventListener("abort", abort, { once: true });
    }
    const timer = setTimeout(() => controller.abort(), 30000);
    let data = null;
    try {
      const res = await monitoredFetch(storageBackend, "resolve", RESOLVE_ENDPOINT, {
        method: "POST",
        headers: await authHeaders({ "content-type": "application/json", "x-credenza-key": PREVIEW_SECRET }),
        body: JSON.stringify({ url: buyUrl }),
        signal: controller.signal,
      });
      bumpUsage("resolve");
      if (res.ok) data = await res.json();
    } catch (e) {
      data = null;
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener("abort", abort);
    }
    if (!data || !data.title) {
      updateEnrichedItem(item.id, token, { status: "ready" });
      return false;
    }
    const remoteImages = mergeFashionImages(
      data.mainImage ? [data.mainImage] : [],
      data.images || []
    ).slice(0, 10);
    updateEnrichedItem(item.id, token, (x) => {
      const cover = x.image || remoteImages[0] || null;
      const resolvedTitle = fashionDisplayTitle(data) || data.title;
      return {
        status: "ready",
        title:
          preserveTitle || (yupooAlbumUrl(item) && !data.translated)
            ? x.title
            : resolvedTitle || x.title,
        summary: data.summary || x.summary,
        price: data.priceCny != null ? data.priceCny : x.price,
        currency: "CNY",
        priceUsd: data.priceUsd != null ? data.priceUsd : x.priceUsd,
        category: CATEGORIES[data.category]
          ? data.category
          : x.category ||
            guessFashionCategory([data.title, data.summary, data.sizeNotes, x.title, x.summary].filter(Boolean).join(" ")),
        variants: Array.isArray(data.variantGroups)
          ? data.variantGroups.map((group) => ({
              title: group.title || "",
              values: (group.values || []).map((value) => (value && value.name) || String(value)),
            }))
          : x.variants,
        sizeNotes: data.sizeNotes || x.sizeNotes,
        image: cover,
        gallery: mergeFashionImages(
          x.gallery || [],
          remoteImages.filter((src) => src !== cover)
        ).slice(0, 12),
        links: mergeFashionLinks(x, { buyUrl: data.url || buyUrl }),
      };
    });
    return true;
  };

  const enrichFashionItem = async (item) => {
    if (!item || !item.id) return false;
    const previous = enrichmentControllersRef.current.get(item.id);
    if (previous) previous.abort();
    const controller = new AbortController();
    const token = Symbol(item.id);
    enrichmentControllersRef.current.set(item.id, controller);
    enrichmentTokensRef.current.set(item.id, token);

    try {
      const albumUrl = yupooAlbumUrl(item);
      if (albumUrl) {
        updateEnrichedItem(item.id, token, { status: "enriching" });
        const data = await fetchYupooImages(albumUrl, { signal: controller.signal });
        if (controller.signal.aborted || enrichmentTokensRef.current.get(item.id) !== token) return false;
        if (data) {
          const albumImages = mergeFashionImages(data.images || []).slice(0, 8);
          const canonicalAlbum = data.url || albumUrl;
          const links = mergeFashionLinks(item, {
            albumUrl: canonicalAlbum,
            buyUrl: data.buyUrl || null,
          });
          const cover = item.image || albumImages[0] || null;
          const enrichedTitle = fashionDisplayTitle(data);
          const guessedCategory =
            item.category && CATEGORIES[item.category]
              ? item.category
              : guessFashionCategory(
                  [enrichedTitle, data.title, data.sourceTitle, data.description, data.batch, item.title, item.summary, item.rawText]
                    .filter(Boolean)
                    .join(" ")
                );
          const albumPatch = {
            url: item.url && yupooAlbumIdentity(item.url) ? canonicalAlbum : item.url,
            canonicalKey: canonicalKey(classify(canonicalAlbum), canonicalAlbum),
            title:
              enrichedTitle && shouldReplaceFashionTitle(item.title, item.url)
                ? enrichedTitle
                : item.title,
            summary: item.summary || data.description || "",
            image: cover,
            gallery: mergeFashionImages(
              item.gallery || [],
              albumImages.filter((src) => src !== cover)
            ).slice(0, 12),
            links,
            seller: item.seller || data.seller || data.sellerAccount || "",
            batch: item.batch || data.batch || "",
            category: guessedCategory || item.category || "",
            price: item.price != null ? item.price : data.priceCny,
            currency: "CNY",
            sourceTitle: data.sourceTitle || item.sourceTitle || "",
            albumId: data.albumId || item.albumId || "",
            sellerAccount: data.sellerAccount || item.sellerAccount || "",
            status: data.buyUrl ? "enriching" : "ready",
          };
          updateEnrichedItem(item.id, token, albumPatch);
          const mergedItem = { ...item, ...albumPatch };
          const resolvePromise = data.buyUrl
            ? resolveBuyDetails(mergedItem, {
                token,
                signal: controller.signal,
                preserveTitle: !shouldReplaceFashionTitle(item.title, item.url),
              })
            : Promise.resolve(true);

          // Yupoo blocks ordinary hotlinks. Relay each selected product image with
          // the album as Referer, compress it locally, and progressively persist it.
          const relayed = [];
          const replaceAutoCover = !item.image || albumImages.includes(item.image);
          for (const src of albumImages) {
            if (controller.signal.aborted) break;
            const dataUrl = await relayImageDataUrl(src, canonicalAlbum, controller.signal);
            if (!dataUrl) continue;
            relayed.push(dataUrl);
            updateEnrichedItem(item.id, token, (x) => {
              const retained = (x.gallery || []).filter((image) => !albumImages.includes(image));
              const image = replaceAutoCover ? relayed[0] : x.image;
              const galleryImages = replaceAutoCover ? relayed.slice(1) : relayed;
              return {
                image,
                gallery: mergeFashionImages(retained, galleryImages).slice(0, 12),
              };
            });
          }

          const handled = await resolvePromise;
          if (!handled) updateEnrichedItem(item.id, token, { status: "ready" });
          return true;
        }
      }

      const handled = await resolveBuyDetails(item, { token, signal: controller.signal });
      if (!handled && !controller.signal.aborted) {
        await fetchAutomaticImage(item, token);
        updateEnrichedItem(item.id, token, { status: "ready" });
      }
      return handled;
    } finally {
      if (enrichmentTokensRef.current.get(item.id) === token) {
        enrichmentTokensRef.current.delete(item.id);
        enrichmentControllersRef.current.delete(item.id);
      }
    }
  };

  const enrichFashionItems = async (list, concurrency = 3) => {
    const queue = [...list];
    const workers = Array.from(
      { length: Math.min(concurrency, queue.length) },
      async () => {
        while (queue.length) {
          const item = queue.shift();
          if (item) await enrichFashionItem(item);
        }
      }
    );
    await Promise.all(workers);
  };

  useEffect(
    () => () => {
      enrichmentControllersRef.current.forEach((controller) => controller.abort());
      enrichmentControllersRef.current.clear();
      enrichmentTokensRef.current.clear();
    },
    []
  );

  const recordOpen = (item, targetUrl) => {
    updateItem(item.id, (x) => ({
      lastOpenedAt: Date.now(),
      openCount: (x.openCount || 0) + 1,
    }));
    const url = ensureYupooAlbumUid(targetUrl || item.url);
    if (!url) return;
    const marketplace = marketplaceOf(url);
    // Photos/alt links (Yupoo, Reddit, anything off-marketplace) open untouched
    // and stay out of the agent analytics.
    if (!marketplace || marketplace === "yupoo") {
      window.open(url, "_blank", "noopener");
      return;
    }
    // A2: the agent wrap happens here and only here — stored links stay canonical.
    // Referral codes are build-time env only (audit 2026-07-24) — no per-user
    // override reaches this call.
    const result = buildAgentUrl(preferredAgent, url);
    recordOutboundClick(storageBackend, {
      ts: Date.now(),
      agentId: result.agentId || preferredAgent,
      marketplace,
      wrapped: result.wrapped,
      item: hashItemId(item.id),
    });
    markActivation(storageBackend, "buyClick");
    if (result.wrapped && agentToastSeenFor !== result.agentId) {
      setAgentToastSeenFor(result.agentId);
      const name = (getAgent(result.agentId) || {}).name || "your agent";
      notify("Opening in " + name + " · change anytime in the Agent menu.", { duration: 6000 });
    } else if (!result.wrapped && (result.reason === "unsupported-marketplace" || result.reason === "no-item-id")) {
      const name = (getAgent(preferredAgent) || {}).name || "your agent";
      notify(name + " can't take that link — opened the original instead.", { duration: 6000 });
    }
    window.open(result.url, "_blank", "noopener");
  };

  // Buy caption reflects the chosen agent; the URL doesn't (wrap is open-time
  // only). Raw/no-agent keeps the plain "Buy".
  const preferredAgentInfo = getAgent(preferredAgent);
  const buyLabel =
    preferredAgentInfo && (preferredAgentInfo.urlTemplate || preferredAgentInfo.idPathTemplate || preferredAgentInfo.idUrlTemplate)
      ? "Buy via " + preferredAgentInfo.name
      : "Buy";
  const agentBarLabel =
    preferredAgentInfo && (preferredAgentInfo.urlTemplate || preferredAgentInfo.idPathTemplate || preferredAgentInfo.idUrlTemplate)
      ? preferredAgentInfo.name
      : "Direct";

  const undoRemoved = () => {
    const batch = [...undoBatchRef.current].sort((a, b) => a.index - b.index);
    if (!batch.length) return;
    undoBatchRef.current = [];
    if (undoExpiryRef.current) clearTimeout(undoExpiryRef.current);
    undoExpiryRef.current = null;
    applyUpdate((list) => {
      const next = [...list];
      for (const record of batch) {
        if (next.some((item) => item.id === record.item.id)) continue;
        next.splice(Math.min(record.index, next.length), 0, record.item);
      }
      return next;
    });
    const restore = batch[batch.length - 1];
    if (restore.wasSelected) setSelectedId(restore.item.id);
    if (restore.wasExpanded) setExpandedId(restore.item.id);
    if (restore.wasResurfaced) setResurfaced(restore.item.id);
    dismissNotification();
  };

  const remove = (id) => {
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return;
    // Prefer the neighbor on the visible shelf (newest-first / haul / search),
    // not raw storage order — storage order jumps the viewport to another section.
    const viewList = listItemsRef.current;
    const viewIdx = viewList.findIndex((item) => item.id === id);
    const removed = {
      item: items[index],
      index,
      wasSelected: selectedId === id,
      wasExpanded: expandedId === id,
      wasResurfaced: resurfaced === id,
    };
    applyUpdate((list) => list.filter((item) => item.id !== id));
    undoBatchRef.current.push(removed);
    if (expandedId === id) setExpandedId(null);
    // Move focus to the right neighbor whenever this card was the active one
    // (selected and/or expanded). Keeps carousel/grid from jumping away.
    if (selectedId === id || expandedId === id) {
      const viewFallback =
        viewIdx >= 0 ? viewList[viewIdx + 1] || viewList[viewIdx - 1] : null;
      const fallback = viewFallback || items[index + 1] || items[index - 1] || null;
      setSelectedId(fallback && fallback.id !== id ? fallback.id : null);
    }
    if (resurfaced === id) setResurfaced(null);
    if (undoExpiryRef.current) clearTimeout(undoExpiryRef.current);
    undoExpiryRef.current = setTimeout(() => {
      undoBatchRef.current = [];
      undoExpiryRef.current = null;
    }, 6200);
    const count = undoBatchRef.current.length;
    notify(
      count === 1 ? "Removed “" + removed.item.title + "”." : count + " cards removed.",
      { actionLabel: "Undo", onAction: undoRemoved, duration: 6000 }
    );
  };

  // ————— Digest: local scoring, local copy —————
  const buildDigest = () => {
    const now = Date.now();
    const all = items.filter((x) => x.status === "ready");
    if (all.length === 0) {
      notify("Save at least one card before dealing a digest.");
      return;
    }
    const weekCount = all.filter((x) => now - x.createdAt < WEEK_MS).length;
    const picks = [...all]
      .map((x) => ({ item: x, score: scoreDigestCandidate(x, now) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((s) => s.item);
    const pickIds = new Set(picks.map((p) => p.id));
    const gemPool = all.filter((x) => now - x.createdAt > GEM_MIN_AGE_MS && !pickIds.has(x.id));
    const gem =
      gemPool.length > 0
        ? gemPool
            .map((x) => ({ item: x, score: scoreForgottenGem(x, now) }))
            .sort((a, b) => b.score - a.score)[0].item
        : null;
    const copy = localDigestCopy(picks, gem, weekCount, now);

    const slides = [
      {
        eyebrow: "This week on the shelf",
        title: weekCount > 0 ? "A fresh stack" : "The standing stack",
        body: copy.intro,
      },
    ];
    picks.forEach((it, idx) => {
      slides.push({
        eyebrow: "Worth your time · " + (idx + 1),
        title: it.title,
        body: copy.reasons[it.id] || it.summary || "",
        url: it.url,
        itemId: it.id,
      });
    });
    if (gem)
      slides.push({
        eyebrow: "From the back of the shelf",
        title: gem.title,
        body: copy.gemReason,
        url: gem.url,
        itemId: gem.id,
      });
    slides.push({
      eyebrow: "That's the deck",
      title: "Shelf's in good shape.",
      body: "Come back next week — or stash something worth digesting.",
    });
    setDigest(slides);
    const featured = [...picks, ...(gem ? [gem] : [])];
    featured.forEach((it) =>
      updateItem(it.id, (x) => ({
        digestCount: (x.digestCount || 0) + 1,
        lastDigestAt: now,
      }))
    );
  };

  // ————— Chrome extension hooks (feature-detected; inert on the web) —————
  // The context menu queues captures in chrome.storage even while the panel is
  // closed; the panel drains the queue on load and live via onChanged.
  const EXT =
    typeof chrome !== "undefined" && chrome.storage && chrome.storage.local ? chrome : null;

  const consumePending = (pending) => {
    if (!pending || !pending.length) return;
    let added = 0;
    const created = [];
    applyUpdate((list) => {
      let next = list;
      for (const p of pending) {
        const raw = (p.raw || "").trim();
        if (!raw) continue;
        const parsed = classify(raw);
        const key = canonicalKey(parsed, raw);
        if (next.some((x) => itemMatchesCanonicalKey(x, key))) continue;
        const extra = { sourceImport: "tab" };
        if (p.title && parsed.url) extra.title = String(p.title).slice(0, 72);
        const item = createItem(parsed, raw, extra);
        created.push(item);
        next = [item, ...next];
        added++;
      }
      return next;
    });
    if (created.length) enrichFashionItems(created);
    if (added > 0)
      flashImportResult("Stashed " + added + " " + (added === 1 ? "thing" : "things") + " from the browser.");
  };
  const consumePendingRef = useRef(consumePending);
  consumePendingRef.current = consumePending;

  useEffect(() => {
    if (!["ready", "save-error", "session-only"].includes(storageState.status) || !EXT) return;
    const drain = async () => {
      const o = await EXT.storage.local.get("credenza-pending");
      const pending = o["credenza-pending"] || [];
      if (pending.length) {
        await EXT.storage.local.set({ "credenza-pending": [] });
        consumePendingRef.current(pending);
      }
    };
    drain();
    const onChanged = (changes, area) => {
      if (area === "local" && changes["credenza-pending"]) {
        const val = changes["credenza-pending"].newValue || [];
        if (val.length) drain();
      }
    };
    EXT.storage.onChanged.addListener(onChanged);
    return () => EXT.storage.onChanged.removeListener(onChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageState.status]);

  const canStashTab = !!(EXT && EXT.tabs && EXT.tabs.query);
  const stashCurrentTab = () => {
    if (!canStashTab) return;
    EXT.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab || !tab.url || !/^https?:/.test(tab.url)) {
        flashImportResult("Nothing stashable on this tab.");
        return;
      }
      const r = stash(tab.url, {
        sourceImport: "tab",
        ...(tab.title ? { title: tab.title.slice(0, 72) } : {}),
      });
      if (r.status === "stashed") {
        beginIndexingJob(r);
        flashImportResult("Stashed this tab.");
      }
    });
  };

  // ————— Derived lists —————
  const inboxItems = useMemo(
    () => items.filter((x) => x.status === "enriching" || x.status === "failed"),
    [items]
  );
  const shelfAll = useMemo(() => items.filter((x) => x.status === "ready"), [items]);

  // Drive indexing chips: advance while enriching, complete when ready, drop after a beat.
  useEffect(() => {
    if (!indexingJobs.length) return;
    const tick = window.setInterval(() => {
      setIndexingJobs((jobs) => {
        if (!jobs.length) return jobs;
        let changed = false;
        const next = [];
        for (const job of jobs) {
          const item = items.find((x) => x.id === job.id);
          if (!item) {
            changed = true;
            continue;
          }
          if (job.phase === "done") {
            // Keep done chips briefly so the check is readable.
            if (Date.now() - (job.doneAt || 0) > 1600) {
              changed = true;
              continue;
            }
            next.push(job);
            continue;
          }
          const ready = item.status === "ready";
          const failed = item.status === "failed";
          if (ready || failed) {
            changed = true;
            next.push({
              ...job,
              title: item.title || job.title,
              progress: 100,
              phase: "done",
              doneAt: Date.now(),
            });
            continue;
          }
          // Soft progress while still enriching — never quite finishes until ready.
          const elapsed = Date.now() - (job.startedAt || Date.now());
          const soft = Math.min(88, 12 + elapsed / 90);
          if (soft > job.progress + 0.5) {
            changed = true;
            next.push({ ...job, progress: soft, title: item.title || job.title });
          } else {
            next.push(job);
          }
        }
        return changed ? next : jobs;
      });
    }, 120);
    return () => window.clearInterval(tick);
  }, [indexingJobs.length, items]);

  const runCloudAsk = async () => {
    const query = search.trim();
    if (!CLOUD_ASK_ENABLED || askState.status === "loading") return;
    if (!query) {
      setAskState({
        status: "error",
        query: "",
        answer: "",
        results: [],
        error: "Type a question before asking the cloud shelf.",
      });
      return;
    }

    const shelf = serializeAskCandidates(query, shelfAll, { limit: 25 });
    // Part 7e: a signed-in FREE user over the daily ask cap gets the honest
    // message + the upgrade path instead of a server 429.
    if (overFreeLimit(accountPlan, "ask")) {
      setAskState({
        status: "error",
        query,
        answer: "",
        results: [],
        error: "That is today's free Ask limit. Upgrade to Pro in Profile for 200 asks a day.",
      });
      return;
    }
    const controller = new AbortController();
    askControllerRef.current = controller;
    const timer = setTimeout(() => controller.abort(), 35000);
    setAskState({ status: "loading", query, answer: "", results: [], error: "" });

    try {
      const res = await monitoredFetch(storageBackend, "ask", ASK_ENDPOINT, {
        method: "POST",
        headers: await authHeaders({ "content-type": "application/json", "x-credenza-key": PREVIEW_SECRET }),
        body: JSON.stringify({ query, shelf }),
        signal: controller.signal,
      });
      bumpUsage("ask");
      let payload;
      try {
        payload = await res.json();
      } catch {
        throw new Error("Cloud Ask returned an unreadable response.");
      }
      if (!res.ok) throw new Error(payload.error || "Cloud Ask could not answer right now.");
      const knownIds = new Set(shelfAll.map((item) => item.id));
      const valid =
        payload &&
        typeof payload.answer === "string" &&
        Array.isArray(payload.results) &&
        payload.results.every(
          (item) =>
            item &&
            typeof item.id === "string" &&
            knownIds.has(item.id) &&
            typeof item.why === "string"
        );
      if (!valid) throw new Error("Cloud Ask returned an invalid response.");

      setAskState({
        status: "success",
        query,
        answer: payload.answer,
        results: payload.results,
        error: "",
      });
      setView("shelf");
      if (payload.results.length > 0) {
        setExpandedId(payload.results[0].id);
        setSelectedId(payload.results[0].id);
      }
    } catch (error) {
      if (error && error.name === "AbortError" && askControllerRef.current !== controller) return;
      setAskState({
        status: "error",
        query,
        answer: "",
        results: [],
        error:
          error && error.name === "AbortError"
            ? "Cloud Ask timed out. Try again in a moment."
            : error.message || "Cloud Ask could not answer right now.",
      });
    } finally {
      clearTimeout(timer);
      if (askControllerRef.current === controller) askControllerRef.current = null;
    }
  };

  const cancelCloudAsk = () => {
    if (askControllerRef.current) askControllerRef.current.abort();
    askControllerRef.current = null;
    setAskState({ status: "idle", query: "", answer: "", results: [], error: "" });
  };

  useEffect(
    () => () => {
      if (askControllerRef.current) askControllerRef.current.abort();
    },
    []
  );

  const q = search.trim().toLowerCase();
  const visible = useMemo(() => searchItems(shelfAll, q), [shelfAll, q]);

  // Starred filter + view toggles only — no category chip rail.
  const toolbarActive = shelfAll.length >= 1;
  // First run: the intro replaces the app shell (CO-04). No search field, no
  // tabs, no bottom bar, no agent tile — on phone AND desktop.
  const firstRunIntro = items.length === 0 && !onboardingDone;
  const typed = visible;
  const shelfItems = useMemo(() => {
    let a = [...typed];
    // Starred mode = only favorited cards. Default = whole shelf.
    if (sortMode === "starred") a = a.filter((x) => x.favorite === true);
    if (q) return a;
    // Newest first — favoriting only marks the card, it never moves it.
    a.sort((x, y) => y.createdAt - x.createdAt);
    return a;
  }, [typed, q, sortMode]);

  // Existing haul names from project strings — used by the in-card haul picker.
  const haulNames = useMemo(() => {
    const names = new Set();
    for (const item of items) {
      const name = typeof item.project === "string" ? item.project.trim() : "";
      if (name) names.add(name);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [items]);

  // Directory cards for the Hauls tab — named hauls only. Items without a
  // project stay on the shelf; they are not a fake "Unsorted" haul.
  // Collect up to 5 covers so multi-item hauls can render as a fan spread.
  const haulDirectory = useMemo(() => {
    const map = new Map();
    for (const item of shelfAll) {
      const name = typeof item.project === "string" ? item.project.trim() : "";
      if (!name) continue;
      const usd = itemUsdAmount(item);
      const price = usd != null ? usd : 0;
      const created = item.createdAt || 0;
      const cur = map.get(name) || {
        name,
        count: 0,
        value: 0,
        latest: 0,
        // [{ image, createdAt }] — sorted newest-first for the fan spread.
        coverItems: [],
      };
      cur.count += 1;
      cur.value += price;
      if (created >= cur.latest) cur.latest = created;
      if (item.image) {
        cur.coverItems.push({ image: item.image, createdAt: created });
      }
      map.set(name, cur);
    }
    const dirs = Array.from(map.values()).map((haul) => {
      const seen = new Set();
      const covers = haul.coverItems
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((c) => c.image)
        .filter((src) => {
          if (seen.has(src)) return false;
          seen.add(src);
          return true;
        })
        .slice(0, 5);
      return {
        name: haul.name,
        count: haul.count,
        value: haul.value,
        latest: haul.latest,
        covers,
      };
    }).sort((a, b) => {
      if (b.latest !== a.latest) return b.latest - a.latest;
      return a.name.localeCompare(b.name);
    });
    // Archive state comes from the haul records (Part 5). Archived hauls hide
    // from the directory until "Archived (N)" is tapped; items stay untouched.
    const archivedNames = new Set(hauls.filter((h) => h.archived).map((h) => h.name));
    const active = (showArchivedHauls ? dirs : dirs.filter((h) => !archivedNames.has(h.name))).map(
      (h) => ({ ...h, archived: archivedNames.has(h.name) })
    );
    const archivedCount = dirs.filter((h) => archivedNames.has(h.name)).length;
    return { hauls: active, archivedCount };
  }, [shelfAll, hauls, showArchivedHauls]);

  // Chrome + the shelf surface's item filter key off this, not raw
  // `activeHaul` — while closing, `activeHaul` is already null but
  // `closingHaulName` keeps this set until the exit fade finishes, so the
  // carousel doesn't swap to the full unfiltered shelf mid-fade.
  const openHaulName = view === "hauls" ? activeHaul || closingHaulName : null;

  // When a haul is open (or closing), only its cards are on the shelf surface.
  // Base on `visible`, not `shelfItems` (Kyle 2026-07-24): the shelf's Starred
  // filter must NOT shrink an open haul — a haul always shows every card in
  // it. Search still narrows within the haul.
  const listItems = useMemo(() => {
    if (!openHaulName) return shelfItems;
    return visible.filter(
      (item) => typeof item.project === "string" && item.project.trim() === openHaulName
    );
  }, [openHaulName, shelfItems, visible]);
  listItemsRef.current = listItems;

  const openHaul = useCallback((haulKey) => {
    setView("hauls");
    setViewMode("carousel");
    setExpandedId(null);
    setSelectedId(null);
    setActiveHaul(haulKey);
  }, []);

  // USD-normalized value for the total-cost reel — single helper so haul
  // directory, chips, and the reel never disagree (CNY falls back to 0.14).
  const totalsItems = useMemo(() => {
    if (openHaulName) {
      return visible.filter(
        (item) => typeof item.project === "string" && item.project.trim() === openHaulName
      );
    }
    return listItems;
  }, [openHaulName, visible, listItems]);
  // Sums exactly what's on the surface — search matches, Starred-only filter,
  // or the open haul — so the counter recalculates organically.
  // A3: inside a haul the total covers non-returned items only — a returned
  // card is money coming back, not money in the parcel.
  const listTotalUsd = useMemo(
    () =>
      totalsItems.reduce(
        (sum, it) =>
          sum + (openHaulName && it.findStatus === "returned" ? 0 : (itemUsdAmount(it) || 0)),
        0
      ),
    [totalsItems, openHaulName]
  );
  // A3 + A6 haul pipeline board: per-status counts, the ready-to-ship count
  // (bought + GL per docs/Monetization.md §A3), and the rough ship weight.
  // Computed over the whole haul (totalsItems), so search inside the haul
  // narrows the cards but never the board.
  const haulPipeline = useMemo(() => {
    if (!openHaulName) return null;
    const counts = {};
    for (const it of totalsItems) {
      const s = it.findStatus || "want";
      counts[s] = (counts[s] || 0) + 1;
    }
    // Task 8 (Part 5): returned items never count toward the ship weight.
    const weightSum = haulWeightGrams(totalsItems);
    return {
      counts,
      readyToShip: (counts.bought || 0) + (counts.gl || 0),
      weightLabel: weightSum != null ? formatWeightGrams(weightSum) : "",
      weightGrams: weightSum,
    };
  }, [openHaulName, totalsItems]);
  // Same context for the count chip — one consistent spot next to the total.
  // Starred filter MUST show through here. Keep the label short on mobile so
  // "N starred of M saved" + TOTAL SHELF COST + heart don't pile up.
  // One condition, two renderers: the phone shows these totals inside the
  // tabs row (C2), the desktop keeps its own .cz-total-row below.
  const shelfTotalsVisible =
    view !== "inbox" && shelfAll.length > 0 && (view !== "hauls" || openHaulName);
  const totalCountLabel = openHaulName
    ? totalsItems.length + (totalsItems.length === 1 ? " item" : " items")
    : q
      ? visible.length + " found"
      : sortMode === "starred"
        ? totalsItems.length + (totalsItems.length === 1 ? " starred" : " starred")
        : shelfAll.length + " saved";

  const closeHaul = useCallback(() => {
    if (!activeHaul) return;
    // Reduced motion skips the fade entirely, so there's nothing to bridge.
    if (!reducedMotion) setClosingHaulName(activeHaul);
    setActiveHaul(null);
    setExpandedId(null);
    setSelectedId(null);
  }, [activeHaul, reducedMotion]);

  useEffect(() => {
    if (view === "inbox" && inboxItems.length === 0) setView("shelf");
  }, [view, inboxItems.length]);

  useEffect(() => {
    if (view !== "hauls") return;
    if (!activeHaul) return;
    // Drop the retired Unsorted pseudo-haul, or a haul that no longer exists.
    if (activeHaul === "__unsorted__" || !haulNames.includes(activeHaul)) {
      setActiveHaul(null);
    }
  }, [view, activeHaul, haulNames]);

  // ————— Keyboard layer (Apple-style, all local) —————
  // Refs keep the one static listener wired to current logic; signal strings carry
  // F/E requests down to the right card.
  const [flipRequest, setFlipRequest] = useState(null);
  const [editRequest, setEditRequest] = useState(null);
  const buildDigestRef = useRef(buildDigest);
  buildDigestRef.current = buildDigest;
  const recordOpenRef = useRef(recordOpen);
  recordOpenRef.current = recordOpen;
  const attachImageRef = useRef(attachImage);
  attachImageRef.current = attachImage;
  const dispatchStashRef = useRef(dispatchStash);
  dispatchStashRef.current = dispatchStash;
  const beginIndexingJobRef = useRef(beginIndexingJob);
  beginIndexingJobRef.current = beginIndexingJob;
  topCaptureVisibleRef.current = items.length === 0;
  kb.current = {
    shelfItems: listItems,
    selectedId,
    expandedId,
    digest,
    items,
    importOpen,
    agentSheetOpen,
    captureSheetOpen,
    profileOpen,
    settingsSheetOpen,
    bodySheetOpen,
    viewMode,
    view,
    activeHaul,
    carouselOverlay,
  };
  useEffect(() => {
    // True when the user is already in a text field — type-anywhere must NOT
    // yank focus to Stash. Check activeElement AND the event target: some
    // mobile browsers report body as activeElement mid-key while the input
    // still has the caret, which used to dump search keystrokes into capture.
    const isTypingTarget = (node) => {
      if (!node || node === document.body || node === document.documentElement) return false;
      const el = node.nodeType === 1 ? node : node.parentElement;
      if (!el) return false;
      if (el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.isContentEditable) return true;
      if (
        el.closest?.(
          "input, textarea, [contenteditable='true'], .cz-search-shell, .cz-desk-search-shell, .cz-capture-shell"
        )
      ) {
        return true;
      }
      return false;
    };
    const isTyping = (e) =>
      isTypingTarget(document.activeElement) || (e ? isTypingTarget(e.target) : false);
    const onKey = (e) => {
      if (e.defaultPrevented) return;
      // Let the full-screen photo gallery own its own keyboard navigation.
      // (Attribute selector [role="dialog"] can't match a native <dialog>.)
      if (document.querySelector("dialog[open]")) return;
      const ctx = kb.current;
      if (e.metaKey || e.ctrlKey) {
        if (
          ctx.digest ||
          ctx.importOpen ||
          ctx.agentSheetOpen ||
          ctx.captureSheetOpen ||
          ctx.profileOpen ||
          ctx.settingsSheetOpen ||
          ctx.bodySheetOpen
        )
          return;
        if (e.key === "k") {
          e.preventDefault();
          // Desktop shows its own search field; the mobile row is display:none.
          const desk =
            window.matchMedia("(min-width: 768px)").matches && deskSearchRef.current;
          (desk || searchRef.current) && (desk || searchRef.current).focus();
        }
        return;
      }
      if (
        ctx.digest ||
        ctx.importOpen ||
        ctx.agentSheetOpen ||
        ctx.captureSheetOpen ||
        ctx.profileOpen ||
        ctx.settingsSheetOpen ||
        ctx.bodySheetOpen
      )
        return; // overlays handle their own keys
      if (isTyping(e)) {
        if (e.key === "Escape" && document.activeElement) document.activeElement.blur();
        return;
      }
      // A focused control owns its own keys (Part 5 a11y): Enter/Space on a
      // card-back button, haul option, or menu row must activate THAT
      // control, never the card shortcuts below. Without this guard the
      // global handler preventDefaulted Enter on focused buttons, so
      // keyboard users could not pick a haul or close the overlay.
      // Escape is exempt (2026-07-25): it never activates a control — it
      // peels layers. The overlay auto-focuses its first button on open, so
      // without the exemption Escape could not close the overlay at all and
      // the page sat scroll-locked behind it (Kyle's "close gives blank").
      if (
        e.key !== "Escape" &&
        e.target !== document.body &&
        e.target !== document.documentElement &&
        e.target.closest?.(
          "button, a, select, [role='button'], [role='option'], [role='radio'], [role='menuitem'], [role='tab'], [role='switch'], [role='checkbox']"
        )
      ) {
        return;
      }
      const list = ctx.shelfItems;
      const idx = list.findIndex((x) => x.id === ctx.selectedId);
      // The carousel is "presented" either as the carousel view or as the
      // grid-tap overlay layer — grid bindings must not fire underneath it.
      const carouselPresented = ctx.viewMode === "carousel" || ctx.carouselOverlay;
      if (!carouselPresented && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();
        if (list.length === 0) return;
        // Navigation always wins — unflip any open card first.
        setExpandedId(null);
        const nextIdx =
          e.key === "ArrowDown" ? Math.min(idx + 1, list.length - 1) : Math.max(idx - 1, 0);
        const id = list[nextIdx < 0 ? 0 : nextIdx].id;
        setSelectedId(id);
        const el = document.getElementById("card-" + id);
        if (el) el.scrollIntoView({ block: "nearest", behavior: "auto" });
        return;
      }
      // Resolve the active/centered carousel card when selection is empty.
      const resolveCarouselIndex = () => {
        if (idx >= 0) return idx;
        if (!carouselPresented || list.length === 0) return -1;
        const foreground = document.querySelector(".cz-carousel-card[data-foreground='true']");
        const match = foreground && foreground.id.match(/^card-(.+)$/);
        const found = match ? list.findIndex((x) => x.id === match[1]) : -1;
        return found >= 0 ? found : 0;
      };

      // Carousel arrows are owned by CoverFlow's window listener (wrap/nudge +
      // unflip). Don't also step selection here — that double-fired and felt dead
      // at the ends. Non-carousel views still use Up/Down above.
      if (carouselPresented && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        return;
      }
      if (e.key === "Escape") {
        // The grid-tap overlay is the outermost layer: card layers were already
        // peeled by the carousel's capture listener (it stopPropagations), so
        // reaching here means the rack is at rest. Selection stays so the grid
        // highlights the item you were just viewing.
        if (ctx.carouselOverlay) {
          // Close through the t-modal is-closing path (not a hard unmount).
          closeCarouselOverlayRef.current();
          return;
        }
        setExpandedId(null);
        setSelectedId(null);
        return;
      }
      const activeIdx = resolveCarouselIndex();
      const sel = activeIdx >= 0 ? list[activeIdx] : null;
      if (sel) {
        if (e.key === "Enter" || e.key === "o") {
          e.preventDefault();
          recordOpenRef.current(sel);
          return;
        }
        // Space / F flips the active carousel card (or the solo overlay card).
        // Grid: Space/F pops the card up solo in the overlay.
        if (e.key === " " || e.key === "Spacebar" || e.key === "f") {
          e.preventDefault();
          setSelectedId(sel.id);
          if (!carouselPresented) {
            openInCarouselRef.current(sel.id);
            return;
          }
          if (ctx.expandedId === sel.id) {
            setExpandedId(null);
          } else {
            setExpandedId(sel.id);
            setFlipRequest(sel.id + ":" + Date.now());
          }
          return;
        }
        if (e.key === "e") {
          e.preventDefault();
          setSelectedId(sel.id);
          if (!carouselPresented) {
            openInCarouselRef.current(sel.id);
          }
          setExpandedId(sel.id);
          setEditRequest(sel.id + ":" + Date.now());
          return;
        }
        if (e.key === "Backspace" || e.key === "Delete") {
          e.preventDefault();
          // Stage, don't delete (KM-02): the confirm dialog owns the call.
          setPendingDeleteId(sel.id);
          return;
        }
      }
      // No type-anywhere (KM-01/KM-03): printable keys never leave the field
      // the user is in, and the desktop has no capture sheet to steal focus
      // into. Search is focused with ⌘K; stash is the ＋ Stash button.
    };
    const onPaste = (e) => {
      if (
        kb.current.digest ||
        kb.current.importOpen ||
        kb.current.agentSheetOpen ||
        kb.current.captureSheetOpen ||
        kb.current.profileOpen ||
        kb.current.settingsSheetOpen ||
        kb.current.bodySheetOpen
      )
        return;
      if (e.defaultPrevented) return; // card-level image paste already took it
      // Image on the clipboard + an expanded card → attach it there, even when
      // focus sits on the document (keyboard-driven expand).
      const img = clipboardImageFile(e);
      if (img && kb.current.expandedId) {
        e.preventDefault();
        attachImageRef.current(kb.current.expandedId, img);
        return;
      }
      if (isTyping(e)) return;
      const text = e.clipboardData && e.clipboardData.getData("text");
      if (text && text.trim()) {
        // Desktop has no capture sheet (KM-03): a paste stashes straight to
        // the shelf. Phone keeps the review step in the bottom sheet.
        if (window.matchMedia("(max-width: 767px)").matches) {
          setInput(text.trim());
          setCaptureSheetOpen(true);
        } else {
          const result = dispatchStashRef.current(text.trim());
          if (result.status === "stashed") beginIndexingJobRef.current(result);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("paste", onPaste);
    };
  }, []);

  // Grid/list only: tap a card → solo t-modal over the grid. Carousel keeps
  // in-rack flip + coverflow scroll (no blurred modal — Kyle 2026-07-23).
  const openInCarousel = (id) => {
    if (overlayCloseTimer.current) {
      clearTimeout(overlayCloseTimer.current);
      overlayCloseTimer.current = null;
    }
    setSelectedId(id);
    setCarouselOverlay(id);
    // Two frames so the node mounts at scale 0.96 before is-open scales up.
    setOverlayPhase("closed");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setOverlayPhase("open"));
    });
  };
  openInCarouselRef.current = openInCarousel;
  // Closing plays is-closing, then unmounts after --modal-close-dur (150ms).
  const closeCarouselOverlay = useCallback(() => {
    if (overlayPhase === "closing" || !carouselOverlay) return;
    setExpandedId(null);
    setOverlayPhase("closing");
    if (overlayCloseTimer.current) clearTimeout(overlayCloseTimer.current);
    const dur =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : 150;
    overlayCloseTimer.current = setTimeout(() => {
      setCarouselOverlay(null);
      setOverlayPhase("closed");
      overlayCloseTimer.current = null;
    }, dur);
  }, [overlayPhase, carouselOverlay]);
  closeCarouselOverlayRef.current = closeCarouselOverlay;
  // If the open item disappears (deleted from its own card back), close.
  useEffect(() => {
    if (carouselOverlay && !items.some((x) => x.id === carouselOverlay)) {
      if (overlayCloseTimer.current) clearTimeout(overlayCloseTimer.current);
      setCarouselOverlay(null);
      setExpandedId(null);
      setOverlayPhase("closed");
    }
  }, [carouselOverlay, items]);
  useEffect(
    () => () => {
      if (overlayCloseTimer.current) clearTimeout(overlayCloseTimer.current);
    },
    []
  );
  // Lock the page behind the overlay — wheel/touch over the scrim must not
  // scroll the grid underneath.
  useEffect(() => {
    if (!carouselOverlay) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [carouselOverlay]);
  // Overlay focus (Part 5 a11y): focus the first control on open, trap Tab
  // inside, and return focus to the opener on close. Escape already closes
  // via the global key handler. A native dialog in the top layer (the photo
  // gallery) traps its own focus — stand down while one is open.
  useEffect(() => {
    if (!carouselOverlay) return;
    overlayTriggerRef.current = document.activeElement;
    const root = overlayRef.current;
    if (!root) return;
    const focusables = () =>
      Array.from(
        root.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.disabled && el.getClientRects().length > 0);
    const first = focusables()[0];
    if (first) first.focus();
    const onKeydown = (e) => {
      if (e.key !== "Tab") return;
      if (document.querySelector("dialog[open]")) return;
      const list = focusables();
      if (list.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = list[0];
      const lastEl = list[list.length - 1];
      const inside = root.contains(document.activeElement);
      if (e.shiftKey && (!inside || document.activeElement === firstEl)) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && (!inside || document.activeElement === lastEl)) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    root.addEventListener("keydown", onKeydown);
    return () => {
      root.removeEventListener("keydown", onKeydown);
      const trigger = overlayTriggerRef.current;
      if (trigger && typeof trigger.focus === "function" && document.contains(trigger)) {
        trigger.focus();
      }
    };
  }, [carouselOverlay]);

  const renderEntry = (item) => (
    <div key={item.id}>
      <Card
        item={item}
        selected={selectedId === item.id}
        onToggle={() => openInCarousel(item.id)}
        onToggleFavorite={toggleFavorite}
        onOpen={recordOpen}
        buyLabel={buyLabel}
        phone={isPhone}
        mode={mode}
        bodyProfile={bodyProfile}
        fitPrefs={fitPrefs}
      />
    </div>
  );

  
  const localStatus = (() => {
    if (storageState.status === "loading") return { label: "Opening shelf", color: FAINT };
    if (storageState.status === "load-error") return { label: "Needs recovery", color: "var(--cz-error-text)" };
    if (storageState.status === "save-error") return { label: "Changes not saved", color: "var(--cz-error-text)" };
    if (storageState.status === "session-only") return { label: "Session only", color: "var(--cz-error-text)" };
    if (storageState.status === "saving") return { label: "Saving", color: BLUE_DK };
    if (!online) return { label: "Saved · Offline", color: SUB };
    return { label: "Saved on this device", color: SUB };
  })();

  // Keep selection valid for the current surface — stale ids (left behind when
  // leaving a haul or switching tabs) make arrow keys appear dead.
  useEffect(() => {
    if (!selectedId) return;
    if (listItems.some((it) => it.id === selectedId)) return;
    setSelectedId(null);
    setExpandedId(null);
  }, [listItems, selectedId]);

  // Haul/tab surface changes force cards face-up. Navigation wins.
  useEffect(() => {
    setExpandedId(null);
  }, [view, activeHaul]);
  // Switching shelf views also unflips — except arriving IN the carousel,
  // where a grid tap / keyboard jump may deliberately land on a flipped card.
  useEffect(() => {
    if (viewMode !== "carousel") setExpandedId(null);
  }, [viewMode]);

  // Hauls directory grid. Only ever shown when no haul is open — see the
  // AnimatePresence swap against `shelfSurface` below. Declarative crossfade:
  // mode="wait" so the directory and the open-haul carousel are never both
  // mounted/interactive at once (see docs/carousel-canonical-state.md).
  const HAUL_SURFACE_TRANSITION = { duration: reducedMotion ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] };
  const haulDirectorySurface = (
    <motion.section
      key="directory"
      role="tabpanel"
      id="view-panel-hauls"
      aria-labelledby="view-tab-hauls"
      className="cz-hauls-panel"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={HAUL_SURFACE_TRANSITION}
    >
      <div className="cz-section-head" style={{ justifyContent: "space-between", gap: 12 }}>
        <div>
          <div className="cz-hauls-title">Your hauls</div>
          <div className="cz-hauls-sub">
            {haulDirectory.hauls.length
              ? haulDirectory.hauls.length +
                (haulDirectory.hauls.length === 1 ? " haul" : " hauls")
              : "Name hauls from the ⋯ menu on any card"}
          </div>
        </div>
        {haulDirectory.archivedCount > 0 ? (
          <button
            type="button"
            className="cz-hauls-archived-toggle"
            aria-pressed={showArchivedHauls}
            onClick={() => setShowArchivedHauls((v) => !v)}
          >
            {showArchivedHauls ? "Hide archived" : "Archived (" + haulDirectory.archivedCount + ")"}
          </button>
        ) : null}
      </div>

      {haulDirectory.hauls.length === 0 ? (
        <div className="cz-hauls-empty">
          <div className="cz-hauls-empty-title">No hauls yet</div>
          <p>Stash items, flip a card, open ⋯, and add them to a named haul.</p>
          <Pill primary onClick={() => setView("shelf")}>
            Back to shelf
          </Pill>
        </div>
      ) : (
        <div className="cz-hauls-grid">
          {haulDirectory.hauls.map((haul) => (
            <button
              key={haul.name}
              type="button"
              className="cz-haul-card"
              data-haul-name={haul.name}
              onClick={() => openHaul(haul.name)}
            >
              <HaulCoverFan
                covers={haul.covers}
                name={haul.name}
                count={haul.count}
              />
              <div className="cz-haul-card-label">
                <div className="cz-haul-card-name">{haul.name}</div>
                <div className="cz-haul-card-meta">
                  {haul.count} {haul.count === 1 ? "item" : "items"}
                  {haul.value > 0 ? " · $" + Math.round(haul.value) : ""}
                </div>
              </div>
            </button>
          ))}
          {/* KM-07: two haul cards sat in a large empty canvas. A dashed
              ghost tile fills the grid and teaches the next action. */}
          <button
            type="button"
            className="cz-haul-card cz-haul-card--ghost"
            onClick={() => setView("shelf")}
          >
            <div className="cz-haul-fan is-single">
              <div className="cz-haul-fan-card is-empty">
                <div className="cz-haul-fan-placeholder" aria-hidden="true">
                  ＋
                </div>
              </div>
            </div>
            <div className="cz-haul-card-label">
              <div className="cz-haul-card-name">Start a haul</div>
              <div className="cz-haul-card-meta">Add from any card's ⋯ menu</div>
            </div>
          </button>
        </div>
      )}
    </motion.section>
  );

  // Plain shelf surface — also doubles as the open-haul carousel/cards/rows
  // surface when view === "hauls" && activeHaul (branches internally on viewMode).
  // Only fades when it's standing in for the open-haul carousel inside the
  // Hauls-tab AnimatePresence above; plain Shelf-tab renders skip animation
  // entirely (initial={false}) so viewMode/tab switches stay instant.
  // One carousel renderer, two presentations (Kyle 2026-07-22): the toolbar's
  // carousel view swaps the surface and gets the full list; a grid tap pops
  // just the tapped card up in the overlay layer below — same props, same
  // behavior, only the item list and the chrome around it differ.
  const renderCarousel = (carouselItems) => (
    <CoverFlowCarousel
      items={carouselItems}
      expandedId={expandedId}
      selectedId={selectedId}
      flipRequest={flipRequest}
      editRequest={editRequest}
      haulNames={haulNames}
      onDelete={setPendingDeleteId}
      onSaveEdit={saveEdit}
      onOpen={recordOpen}
      buyLabel={buyLabel}
      onSetPrimaryImage={setPrimaryImage}
      onLoadPhotos={loadAlbumPhotos}
      onAttachPhoto={attachGalleryImage}
      onRemovePhoto={removePhotoBySrc}
      onToggleFavorite={toggleFavorite}
      onActivate={(id) => {
        setSelectedId(id);
        // Coverflow + solo overlay: flip in place. Grid opens via openInCarousel.
        setExpandedId(id);
      }}
      onDeactivate={() => setExpandedId(null)}
      onSelect={setSelectedId}
      bodyProfile={bodyProfile}
      measureUnits={measureUnits}
      onSaveBodyProfile={(profile) => {
        setBodyProfile((prev) => ({ ...(prev || {}), ...profile }));
        setFitPromptSkipped(false);
      }}
      fitPromptSkipped={fitPromptSkipped}
      onSkipFitPrompt={() => setFitPromptSkipped(true)}
      fitPrefs={fitPrefs}
      onSaveFitPref={saveFitPref}
    />
  );
  const carouselElement = renderCarousel(listItems);
  // The overlay's solo card — resolved live so edits/hearts/photo loads on
  // the open card reflect immediately.
  const overlayItem = carouselOverlay
    ? listItems.find((x) => x.id === carouselOverlay) ||
      items.find((x) => x.id === carouselOverlay) ||
      null
    : null;

  const shelfSurface = (
    <motion.section
      key={openHaulName ? "haul:" + openHaulName : "shelf"}
      role="tabpanel"
      id={view === "hauls" ? "view-panel-hauls" : "view-panel-shelf"}
      aria-labelledby={view === "hauls" ? "view-tab-hauls" : "view-tab-shelf"}
      initial={openHaulName ? { opacity: 0, scale: 0.98 } : false}
      animate={{ opacity: 1, scale: 1 }}
      exit={openHaulName ? { opacity: 0, scale: 0.98 } : undefined}
      transition={HAUL_SURFACE_TRANSITION}
    >
      {/* Shelf */}
      {!loaded ? (
        <div style={{ color: SUB, fontSize: 13, padding: "36px 0", textAlign: "center" }}>
          Opening the credenza…
        </div>
      ) : storageState.status === "load-error" ? (
        <div
          role="alert"
          style={{
            background: CARD,
            border: "1px solid " + HAIR,
            padding: "28px 24px",
            maxWidth: 620,
          }}
        >
          <div className="cz-title-balance" style={{ fontFamily: DISPLAY, fontSize: 24, lineHeight: 1.15, marginBottom: 8 }}>
            Credenza couldn’t open this shelf.
          </div>
          <div className="cz-copy-pretty" style={{ color: SUB, fontSize: 14, lineHeight: 1.6, maxWidth: "62ch" }}>
            Nothing has been overwritten. Retry the local storage read, restore a backup, or download the unread data before starting over.
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 18 }}>
            <Pill primary onClick={() => window.location.reload()}>Try again</Pill>
            {storageState.raw != null && <Pill onClick={downloadRecoveryData}>Download recovery data</Pill>}
            <Pill onClick={() => setImportOpen(true)}>Restore a backup</Pill>
            <Pill subtle onClick={continueSessionOnly}>Continue without saving</Pill>
          </div>
          <div style={{ borderTop: "1px solid " + HAIR, marginTop: 22, paddingTop: 16 }}>
            <button
              type="button"
              className="cz-interactive"
              onClick={startEmptyShelf}
              style={{ border: 0, background: "transparent", color: SUB, padding: "10px 0", cursor: "pointer", fontWeight: 650 }}
            >
              Start an empty shelf…
            </button>
          </div>
        </div>
      ) : listItems.length === 0 ? (
        // Brand-new empty shelf is sold by the 7a hero above the tabs.
        // This branch only covers filtered empty (search / starred / open haul).
        items.length === 0 ? null : (
          <div
            style={{
              background: CARD,
              border: "1px solid " + HAIR,
              borderRadius: 0,
              padding: "40px 24px",
              textAlign: "center",
              color: SUB,
              fontSize: 13.5,
              lineHeight: 1.65,
            }}
          >
            <div style={{ fontFamily: DISPLAY, fontSize: 21, color: INK, marginBottom: 7 }}>
              {q
                ? "No matches for “" + search.trim() + "”."
                : sortMode === "starred"
                  ? "No starred items yet."
                  : openHaulName
                    ? "This haul is empty."
                    : "Nothing on the shelf yet."}
            </div>
            <div className="cz-copy-pretty" style={{ marginBottom: 14 }}>
              {q
                // CO-06: audit copy fix — "projects" removed from search help.
                ? "Search includes titles, notes, raw links, and paired Photos or Buy URLs."
                : sortMode === "starred"
                  ? "Star a card from the front face, then open Starred here."
                  : openHaulName
                    ? "Add cards from the shelf with ⋯ → Add to haul."
                    : inboxItems.length > 0
                      // Cards are enriching in the Inbox — never tell the
                      // customer to paste again as if the stash did not work.
                      ? inboxItems.length +
                        (inboxItems.length === 1 ? " card is" : " cards are") +
                        " indexing in the Inbox — cards land here when they are ready."
                      : "Paste anything above — a link, a Reddit post, a list."}
            </div>
            {(q || sortMode === "starred" || openHaulName || inboxItems.length > 0) && (
              <Pill
                primary
                onClick={() => {
                  if (q) setSearch("");
                  else if (sortMode === "starred") setSortMode("recent");
                  else if (openHaulName) closeHaul();
                  else setView("inbox");
                }}
              >
                {q
                  ? "Clear search"
                  : sortMode === "starred"
                    ? "Show all cards"
                    : openHaulName
                      ? "All hauls"
                      : "Open Inbox"}
              </Pill>
            )}
          </div>
        )
      ) : viewMode === "carousel" ? (
        <div className="cz-haul-open-stage">{carouselElement}</div>
      ) : (
        // Time-bucket sections ("This week" / "Earlier this month" / "Older")
        // removed 2026-07-22 — Kyle: not relevant. One flat grid.
        <div className="cz-shelf-grid">{listItems.map(renderEntry)}</div>
      )}

      {/* Sample cleanup */}
      {hasSamples && (
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <button
            onClick={clearSamples}
            style={{
              fontFamily: FONT,
              fontSize: 12,
              fontWeight: 600,
              color: SUB,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            Clear sample shelf
          </button>
        </div>
      )}
    </motion.section>
  );

  return (
    <div
      className="cz-app"
      data-theme={mode}
      data-fashion="true"
      style={{
        ...PALETTES[mode],
        // Gallery is a genuine light theme, so native form chrome and
        // scrollbars follow the mode. ("rainbow" is the prefs key for Blackout.)
        colorScheme: mode === "light" ? "light" : "dark",
        minHeight: "100dvh",
        background: BG,
        color: INK,
        fontFamily: FONT,
        // Bottom padding clears the fixed action bar; env() keeps both edges out of
        // the iPhone notch / home-indicator zones in standalone PWA mode.
        padding:
          "env(safe-area-inset-top, 0px) 0 calc(104px + env(safe-area-inset-bottom, 0px))",
        transition: "background .25s",
      }}
    >
      <style>{KEYFRAMES}</style>
      {mode === "rainbow" ? <RainbowBackground /> : <HolographicBackground />}
      {digest && (
        <DigestDeck
          slides={digest}
          onClose={() => setDigest(null)}
          onOpen={(itemId, url) => {
            const it = items.find((x) => x.id === itemId);
            if (it) recordOpen(it);
            else if (url) window.open(ensureYupooAlbumUid(url), "_blank", "noopener");
          }}
        />
      )}
      {importOpen && (
        <Suspense fallback={null}>
        <ImportSheet
          items={items}
          hasSamples={hasSamples}
          onImport={runImport}
          onAddSamples={addSamples}
          onClearSamples={clearSamples}
          onClose={() => setImportOpen(false)}
          onExport={exportShelf}
          onClearShelf={clearShelf}
          onRestore={restoreBackup}
        />
        </Suspense>
      )}
      {agentSheetOpen && (
        <Suspense fallback={null}>
        <AgentSheet
          preferredAgent={preferredAgent}
          onSelectAgent={(id) => {
            const a = getAgent(id);
            if (a && !a.retired) setPreferredAgent(a.id);
          }}
          storageBackend={storageBackend}
          onClose={() => setAgentSheetOpen(false)}
        />
        </Suspense>
      )}

      {bodySheetOpen && (
        <Suspense fallback={null}>
        <BodyProfileSheet
          value={bodyProfile}
          units={measureUnits}
          onSave={setBodyProfile}
          onChangeUnits={setMeasureUnits}
          onClose={() => setBodySheetOpen(false)}
        />
        </Suspense>
      )}

      {fitPrefsSheetOpen && (
        <Suspense fallback={null}>
        <FitPrefsSheet
          value={fitPrefs}
          ownedCategories={ownedFitPrefCategories}
          onSave={(draft) => {
            setFitPrefsByCat((prev) => ({ ...(prev || {}), ...(draft || {}) }));
          }}
          onClose={() => setFitPrefsSheetOpen(false)}
        />
        </Suspense>
      )}

      {/* Capture sheet is the mobile bottom sheet only (KM-03): the desktop
          modal read as the wrong shell and was the KM-01 keystroke sink.
          Desktop stashes via the ＋ Stash button (one-tap clipboard) or ⌘V. */}
      {isPhone && captureSheetOpen && (
        <Suspense fallback={null}>
        <CaptureSheet
          clip={clipPreview}
          input={input}
          onInput={setInput}
          canStashTab={canStashTab}
          onStashTab={stashCurrentTab}
          onStash={() => {
            if (input.trim()) {
              capture();
              setCaptureSheetOpen(false);
              return;
            }
            stashClipboard();
          }}
          onClose={() => setCaptureSheetOpen(false)}
          textareaRef={sheetCaptureRef}
        />
        </Suspense>
      )}

      {pendingDeleteId && (
        <ModalShell
          title="Delete this card?"
          onClose={() => setPendingDeleteId(null)}
          maxWidth={420}
        >
          <div className="cz-delete-confirm">
            <p className="cz-delete-confirm-text">
              <strong className="cz-delete-confirm-title">
                {(items.find((x) => x.id === pendingDeleteId) || {}).title || "This card"}
              </strong>
              leaves the shelf for good. There is no undo.
            </p>
            <div className="cz-delete-confirm-actions">
              <button
                type="button"
                className="cz-delete-confirm-keep"
                onClick={() => setPendingDeleteId(null)}
              >
                Keep
              </button>
              <button
                type="button"
                className="cz-delete-confirm-delete"
                onClick={() => {
                  remove(pendingDeleteId);
                  setPendingDeleteId(null);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {profileOpen && (
        <Suspense fallback={null}>
        <ProfileSheet
          mode={mode}
          onTheme={setTheme}
          agentLabel={agentBarLabel}
          onOpenAgent={() => {
            setProfileOpen(false);
            setAgentSheetOpen(true);
          }}
          pricePrimary={pricePrimary}
          onCycleCurrency={() => setPricePrimary((v) => (v === "CNY" ? "USD" : "CNY"))}
          fitSummary={fitSummary}
          onToggleFitSummary={() => setFitSummary((v) => !v)}
          fitDetail={fitDetail}
          onCycleFitDetail={() => setFitDetail((v) => (v === "detailed" ? "concise" : "detailed"))}
          onOpenSizes={() => {
            setProfileOpen(false);
            setBodySheetOpen(true);
          }}
          onOpenFitPrefs={() => {
            setProfileOpen(false);
            setFitPrefsSheetOpen(true);
          }}
          onOpenImport={() => {
            setProfileOpen(false);
            setImportOpen(true);
          }}
          storageLabel={localStatus.label}
          storageColor={localStatus.color}
          onEraseData={eraseEverything}
          accountEnabled={AUTH_ENABLED}
          accountSession={accountSession}
          accountPlan={accountPlan}
          onMagicLink={accountSendMagicLink}
          onGoogle={accountGoogle}
          onUpgrade={accountUpgrade}
          onPortal={accountOpenPortal}
          onSignOut={accountSignOut}
          onDeleteAccount={accountDelete}
          onClose={() => setProfileOpen(false)}
        />
        </Suspense>
      )}

      {/* Settings sheet (mobile handoff step 3): the rows the deleted bottom
          bar used to carry. Phone only — the masthead ⋯ button is phone only,
          and desktop keeps the same rows in the profile sheet. */}
      {settingsSheetOpen && (
        <Suspense fallback={null}>
        <SettingsSheet
          agentLabel={agentBarLabel}
          onOpenAgent={() => {
            setSettingsSheetOpen(false);
            setAgentSheetOpen(true);
          }}
          onOpenImport={() => {
            setSettingsSheetOpen(false);
            setImportOpen(true);
          }}
          onExport={exportShelf}
          mode={mode}
          onCycleTheme={() => setTheme(mode === "light" ? "rainbow" : "light")}
          onOpenSizes={() => {
            setSettingsSheetOpen(false);
            setBodySheetOpen(true);
          }}
          storageLabel={localStatus.label}
          storageColor={localStatus.color}
          onClose={() => setSettingsSheetOpen(false)}
        />
        </Suspense>
      )}

      {/* Grid/list card popup only — carousel stays in-rack (Kyle 2026-07-23).
          Close (✕ / scrim at rest / Escape) plays is-closing, then unmounts. */}
      {carouselOverlay && overlayItem && viewMode !== "carousel" && (
        <div
          key="carousel-overlay"
          ref={overlayRef}
          className={
            "cz-carousel-overlay" +
            (overlayPhase === "open" ? " is-open" : "") +
            (overlayPhase === "closing" ? " is-closing" : "")
          }
          role="dialog"
          aria-modal="true"
          aria-label={overlayItem.title || "Saved item"}
          onPointerDown={(e) => {
            // Scrim tap closes — but only at rest: while the card is
            // flipped, the carousel's own capture listener peels its
            // layers instead.
            if (expandedId) return;
            if (overlayPhase === "closing") return;
            if (document.querySelector("dialog[open]")) return;
            if (
              e.target.closest(
                ".cz-carousel-card, .cz-coverflow-controls, .cz-carousel-overlay-close, .cz-photo-coverflow-backdrop, dialog"
              )
            )
              return;
            closeCarouselOverlay();
          }}
        >
          <button
            type="button"
            className="cz-carousel-overlay-close"
            aria-label="Close"
            onClick={closeCarouselOverlay}
          >
            <X aria-hidden="true" size={18} />
          </button>
          <div
            className={
              "cz-carousel-overlay-stage t-modal" +
              (overlayPhase === "open" ? " is-open" : "") +
              (overlayPhase === "closing" ? " is-closing" : "")
            }
          >
            {renderCarousel([overlayItem])}
          </div>
        </div>
      )}

      <div className="cz-shell">
        {/* Chrome column: centered + max-width'd on desktop (Kyle 2026-07-22 —
            full-bleed capture/search/tabs on a wide monitor read as sprawl).
            The carousel/grid panels below stay full-width. */}
        <div className="cz-chrome">
        {/* Phone masthead is ONE row (mobile handoff C2): mark + wordmark, a
            flex spacer, then Search / ⋯ Settings / Account. The "Fashion"
            sub-word and the 45%-viewport hero drop once the shelf has items —
            that plus the merged tabs/totals row is ~150px, the difference
            between zero cards and one-and-a-half rows above the fold. */}
        <header className={"cz-masthead" + (isPhone && items.length > 0 ? " is-compact" : "")}>
          <h1 className="cz-brand">
            <span className="cz-brand-mark">C</span>
            <span className="cz-brand-name">
              <span className="cz-brand-word">CREDENZA</span>
              {!(isPhone && items.length > 0) && (
                <span className="cz-brand-sub">Fashion</span>
              )}
            </span>
          </h1>
          {!firstRunIntro && (
          <div className="cz-masthead-actions">
            {/* Search collapses to this icon on phone; the pill below reveals
                on tap and keeps its query while open. */}
            {isPhone && items.length > 0 && (
              <button
                type="button"
                className={"cz-mast-btn" + (searchOpen ? " is-active" : "")}
                aria-label={searchOpen ? "Hide search" : "Search your shelf"}
                aria-expanded={searchOpen}
                title="Search"
                onClick={() => {
                  const next = !searchOpen;
                  setSearchOpen(next);
                  if (next) setTimeout(() => searchRef.current?.focus(), 0);
                }}
              >
                <Search size={17} strokeWidth={2.2} aria-hidden="true" />
              </button>
            )}
            {/* Agent, Import, Export, Theme and Sizes moved here when the
                fixed bottom bar became the single Stash button (C4). */}
            {isPhone && items.length > 0 && (
              <button
                type="button"
                className="cz-mast-btn"
                aria-label="Settings"
                title="Settings"
                onClick={() => setSettingsSheetOpen(true)}
              >
                <MoreHorizontal size={18} strokeWidth={2.2} aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              className="cz-avatar"
              aria-label="Profile"
              title="Profile"
              onClick={() => setProfileOpen(true)}
            >
              <User size={17} strokeWidth={2.2} aria-hidden="true" />
            </button>
          </div>
          )}
        </header>

        {/* Onboarding step 1 (no hard gate): value line + Get started. After
            that the empty shelf is the capture surface. Sign-in stays optional.
            First run shows this intro INSTEAD of the app shell (CO-04). */}
        {firstRunIntro && (
          <div className="cz-onboard">
            <p className="cz-onboard-title">One shelf for the whole haul.</p>
            <p className="cz-onboard-copy">
              Paste a link, get a clean card — price, photos, and your size, all sorted.
            </p>
            <div className="cz-onboard-actions">
              <button
                type="button"
                className="cz-onboard-primary"
                onClick={() => setOnboardingDone(true)}
              >
                Get started
              </button>
              {/* Hidden until sync exists (CO-05). */}
              {SYNC_ENABLED && (
              <button
                type="button"
                className="cz-onboard-quiet"
                onClick={() => {
                  setOnboardingDone(true);
                  setProfileOpen(true);
                }}
              >
                Log in
              </button>
              )}
            </div>
          </div>
        )}

        {/* Empty shelf: centered hero. ONE capture field + ONE Stash button —
            the mobile search row below stays hidden until the shelf has items
            (Kyle 2026-07-24: four paste surfaces were three too many). The
            gray ghost tiles are gone for the same reason. */}
        {items.length === 0 && onboardingDone && (
          <div className="cz-empty-hero">
            <div className="cz-empty-hero-main">
              <HeroStagger />
              <div className="cz-empty-hero-bar">
                <label className="cz-empty-hero-search">
                  <Search className="cz-empty-hero-search-icon" aria-hidden="true" size={16} strokeWidth={2.2} />
                  <input
                    className="cz-empty-hero-search-field"
                    type="text"
                    inputMode="search"
                    enterKeyHint="search"
                    autoComplete="off"
                    aria-label="Search your shelf"
                    disabled={interactionLocked}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Escape") {
                        setSearch("");
                        e.target.blur();
                      }
                    }}
                    onPaste={onSearchPaste}
                    placeholder="Paste a link"
                  />
                </label>
                <button
                  type="button"
                  className="cz-empty-hero-stash"
                  disabled={interactionLocked}
                  onClick={heroStash}
                  aria-label="Stash a link or note"
                >
                  <span className="cz-empty-hero-stash-plus" aria-hidden="true">
                    ＋
                  </span>
                  Stash
                </button>
              </div>
              <div className="cz-empty-hero-secondary">
                <button
                  type="button"
                  className="cz-empty-hero-link is-primary"
                  disabled={interactionLocked}
                  onClick={() => setImportOpen(true)}
                >
                  Import a haul
                </button>
                <button
                  type="button"
                  className="cz-empty-hero-link"
                  disabled={interactionLocked}
                  onClick={addSamples}
                >
                  Try a sample shelf
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Desktop top bar (≥768px), search handoff 6a: one permanent search
            field + one solid ＋ Stash button. Search is ambient (filters the
            shelf); Stash is the one-tap clipboard stash (KM-03 — the desktop
            capture sheet is gone). Agent lives on Buy + profile. */}
        {items.length > 0 && (
          <div className="cz-desk-capture">
            <label className="cz-desk-search-shell">
              <Search className="cz-desk-search-leading" aria-hidden="true" size={16} strokeWidth={2.2} />
              <input
                ref={deskSearchRef}
                className="cz-desk-search-field"
                type="text"
                inputMode="search"
                enterKeyHint="search"
                autoComplete="off"
                aria-label="Search your shelf"
                disabled={interactionLocked}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  if (askState.status !== "idle") {
                    setAskState({
                      status: "idle",
                      query: "",
                      answer: "",
                      results: [],
                      error: "",
                    });
                  }
                }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Escape") {
                    setSearch("");
                    e.target.blur();
                  }
                }}
                // Same paste-to-stash as the mobile row below — a URL pasted
                // here stashes instead of searching for nothing (Part 6).
                onPaste={onSearchPaste}
                placeholder="Search your shelf"
              />
            </label>
            <button
              type="button"
              className="cz-desk-stash-btn"
              disabled={interactionLocked}
              onClick={stashClipboard}
              aria-label="Stash the clipboard in one tap"
              title="Stash the clipboard in one tap"
            >
              <span className="cz-desk-stash-plus" aria-hidden="true">
                ＋
              </span>
              Stash
            </button>
          </div>
        )}

        {/* Clipboard fast-path (6a): a slim dark strip under the bar, only
            when a stashable link/note is detected. One tap stashes it. It is
            informational only — no buttons inside; the bar's ＋ Stash is the
            canonical action. */}
        {items.length > 0 && clipPreview && (
          <div className="cz-desk-clip-wrap">
            <button
              type="button"
              className="cz-desk-clip-banner"
              disabled={interactionLocked}
              onClick={stashClipboard}
              aria-label={
                (clipPreview.platform === "Note"
                  ? "Note on your clipboard: "
                  : clipPreview.platform + " link on your clipboard: ") +
                clipPreview.host +
                ". Stash it."
              }
              title="Stash it in one tap"
            >
              <span className="cz-clip-dot" style={{ background: clipPreview.dot }} aria-hidden="true" />
              <span className="cz-desk-clip-text">
                <span className="cz-desk-clip-title">
                  {clipPreview.platform === "Note"
                    ? "Note on your clipboard"
                    : clipPreview.platform + " link on your clipboard"}
                </span>
                <span className="cz-desk-clip-host">{clipPreview.host}</span>
              </span>
            </button>
            <button
              type="button"
              className="cz-desk-clip-dismiss"
              onClick={dismissClipPreview}
              aria-label="Dismiss the clipboard banner"
              title="Dismiss"
            >
              <X size={14} strokeWidth={2.2} aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Mobile search — quiet field. Hidden on desktop (glass toggle owns it),
            on the first-run intro (CO-04), and on the empty shelf — the hero
            field is the ONE capture surface there (Kyle 2026-07-24).
            C2 (2026-07-25): on phone it also stays collapsed until the
            masthead Search icon opens it. A live query keeps it open, so
            filtered results never lose their field. */}
        {!firstRunIntro && items.length > 0 && (!isPhone || searchOpen || search) && (
        <div className="cz-search-row">
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- shell-padding mousedown only focuses the input; the input itself owns keyboard interaction (CO-29) */}
          <div
            className={"cz-search-shell" + (search ? " has-clear" : "")}
            onMouseDown={(e) => {
              // Don't steal focus from the Clear button / morph.
              if (e.target.closest("button")) return;
              if (document.activeElement !== searchRef.current) {
                // preventDefault keeps the caret from jumping after focus.
                e.preventDefault();
                searchRef.current?.focus();
              }
            }}
          >
            <Search className="cz-search-leading" aria-hidden="true" size={16} strokeWidth={2.2} />
            <input
              className="cz-search-input"
              ref={searchRef}
              type="text"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              aria-label="Search your shelf"
              disabled={interactionLocked}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (askState.status !== "idle") {
                  setAskState({
                    status: "idle",
                    query: "",
                    answer: "",
                    results: [],
                    error: "",
                  });
                }
              }}
              onKeyDown={(e) => {
                // Stop the window type-anywhere listener from ever seeing
                // search keystrokes (capture-phase safety net).
                e.stopPropagation();
                if (e.key === "Escape") {
                  setSearch("");
                  e.target.blur();
                }
              }}
              onPaste={onSearchPaste}
              placeholder="Search or paste a link"
            />
            {search ? (
              <MorphButton
                label="Clear"
                icon={X}
                activeIcon={X}
                disabled={interactionLocked}
                ariaLabel="Clear search"
                title="Clear search"
                className="cz-search-morph is-clear"
                onClick={() => {
                  setSearch("");
                  searchRef.current?.focus();
                }}
              />
            ) : null}
          </div>
          {CLOUD_ASK_ENABLED && (
            <Pill
              primary
              title={askState.status === "loading" ? "Cancel Cloud Ask" : "Ask the private cloud shelf"}
              onClick={askState.status === "loading" ? cancelCloudAsk : runCloudAsk}
              style={{ minWidth: 86 }}
            >
              {askState.status === "loading" ? "Cancel" : "Cloud Ask"}
            </Pill>
          )}
        </div>
        )}

        {(askState.status === "success" || askState.status === "error") && (
          <div
            role={askState.status === "error" ? "alert" : "status"}
            style={{
              marginTop: 8,
              background: CARD,
              border: "1px solid " + (askState.status === "error" ? BLUE : HAIR),
              borderRadius: 0,
              padding: "12px 14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <Caption style={{ color: askState.status === "error" ? BLUE : FAINT }}>
                {askState.status === "error" ? "Cloud Ask" : "Cloud answer"}
              </Caption>
              <button
                onClick={() =>
                  setAskState({
                    status: "idle",
                    query: "",
                    answer: "",
                    results: [],
                    error: "",
                  })
                }
                aria-label="Dismiss Cloud Ask response"
                style={{
                  marginLeft: "auto",
                  background: "transparent",
                  border: "none",
                  color: FAINT,
                  cursor: "pointer",
                  padding: 0,
                  fontFamily: FONT,
                }}
              >
                ✕
              </button>
            </div>
            {askState.status === "error" ? (
              <div style={{ marginTop: 6, color: SUB, fontSize: 12.5, lineHeight: 1.5 }}>
                {askState.error}
              </div>
            ) : (
              <>
                <div
                  style={{
                    marginTop: 6,
                    color: INK,
                    fontFamily: DISPLAY,
                    fontSize: 17,
                    lineHeight: 1.4,
                  }}
                >
                  {askState.answer}
                </div>
                {askState.results.length > 0 && (
                  <div style={{ marginTop: 9, borderTop: "1px solid " + HAIR }}>
                    {askState.results.map((result) => {
                      const item = shelfAll.find((candidate) => candidate.id === result.id);
                      if (!item) return null;
                      return (
                        <button
                          key={result.id}
                          onClick={() => {
                            setSearch("");
                            setView("shelf");
                            setExpandedId(result.id);
                            setSelectedId(result.id);
                            if (viewMode !== "carousel") {
                              setTimeout(() => {
                                const card = document.getElementById("card-" + result.id);
                                if (card) {
                                  card.scrollIntoView({
                                    block: "nearest",
                                    behavior: reduced ? "auto" : "smooth",
                                  });
                                }
                              }, 0);
                            }
                          }}
                          style={{
                            display: "block",
                            width: "100%",
                            textAlign: "left",
                            background: "transparent",
                            border: "none",
                            borderBottom: "1px solid " + HAIR,
                            borderRadius: 0,
                            padding: "9px 0",
                            cursor: "pointer",
                            fontFamily: FONT,
                          }}
                        >
                          <span style={{ display: "block", color: INK, fontSize: 12.5, fontWeight: 650 }}>
                            {item.title}
                          </span>
                          <span style={{ display: "block", color: SUB, fontSize: 11.5, lineHeight: 1.45 }}>
                            {result.why}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Shelf / Hauls / Inbox — hidden on a brand-new empty shelf so the 7a
            hero stays the full welcome (tabs return once something is stashed). */}
        {items.length > 0 && (
        <div className="cz-view-tabs-row">
          <div
            role="tablist"
            aria-label="Shelf views"
            className="cz-view-tabs"
          >
            {[
              ["shelf", "Shelf"],
              ["hauls", "Hauls · " + haulDirectory.hauls.length],
              ...(inboxItems.length > 0
                ? [["inbox", "Inbox · " + inboxItems.length]]
                : []),
            ].map(([key, label]) => (
              <button
                type="button"
                role="tab"
                className="cz-tab"
                key={key}
                id={"view-tab-" + key}
                aria-selected={view === key}
                aria-controls={"view-panel-" + key}
                onClick={() => {
                  // Leaving any surface always returns cards face-up.
                  setExpandedId(null);
                  if (key === "hauls") {
                    setView("hauls");
                    // Return to the directory when re-entering Hauls from another tab.
                    if (view !== "hauls") setActiveHaul(null);
                  } else {
                    setView(key);
                    // Leaving Hauls entirely — drop open haul so Shelf is clean.
                    if (view === "hauls") setActiveHaul(null);
                  }
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {/* Phone (C2): the shelf totals ride the tabs row instead of taking
              a second full-width line. Count + total + starred filter only —
              the long "TOTAL SHELF COST" wording and the view toggles are
              dropped here; the toggles live in the ⋯ Settings sheet. */}
          {isPhone && shelfTotalsVisible && (
            <div className="cz-tabs-totals">
              <span className="cz-tabs-count cz-fade-text-in" key={totalCountLabel}>
                {totalCountLabel}
              </span>
              {/* CO-10: a zero-result search must not show a green $0.00 —
                  it read as a real balance. */}
              {!(q && visible.length === 0) && (
                <span className="cz-tabs-total" aria-live="polite">
                  <ReelCounter value={listTotalUsd} />
                </span>
              )}
              {toolbarActive && !openHaulName && (
                <button
                  type="button"
                  className={"cz-starred-filter" + (sortMode === "starred" ? " is-active" : "")}
                  aria-pressed={sortMode === "starred"}
                  aria-label={sortMode === "starred" ? "Show all items" : "Show starred only"}
                  title={sortMode === "starred" ? "Show all" : "Starred only"}
                  onClick={() => setSortMode(sortMode === "starred" ? "recent" : "starred")}
                >
                  <Heart
                    aria-hidden="true"
                    size={16}
                    strokeWidth={2}
                    fill={sortMode === "starred" ? "currentColor" : "none"}
                  />
                </button>
              )}
            </div>
          )}
          {indexingJobs.length > 0 && (
            <div className="cz-index-chip-row" aria-live="polite">
              {indexingJobs.map((job) => (
                <div
                  key={job.id}
                  className={"cz-index-chip" + (job.phase === "done" ? " is-done" : "")}
                  title={job.title}
                >
                  <span className="cz-index-chip-icon" aria-hidden="true">
                    {job.phase === "done" ? (
                      <Check size={12} strokeWidth={2.6} />
                    ) : (
                      <span className="cz-index-chip-dot" />
                    )}
                  </span>
                  <span className="cz-index-chip-label">
                    {job.phase === "done" ? "Indexed" : "Indexing"}
                  </span>
                  <span className="cz-index-chip-bar" aria-hidden="true">
                    <span
                      className="cz-index-chip-fill"
                      style={{
                        transform:
                          "scaleX(" + Math.max(6, Math.min(100, job.progress)) / 100 + ")",
                      }}
                    />
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {/* Shelf meta row: count + cost on the left, filter/view on the right.
            One quiet row — no sticky bar, no full-width black strip. The old
            wrap + marginLeft:auto put the icons on their own tall empty line
            that read as a solid black bar; keep both groups on one row.
            On the Hauls tab the row only renders inside an open haul: the
            directory has its own "N hauls" head, and the shelf totals and
            toggles do not apply to hauls (KM-05 / CO-09).
            Phone (C2): this row is gone — the tabs row above absorbed it. */}
        {!isPhone && shelfTotalsVisible && (
          <div className="cz-total-row">
            <div className="cz-total-main">
              <span className="cz-total-count cz-fade-text-in" key={totalCountLabel}>
                {totalCountLabel}
              </span>
              {/* CO-10: a zero-result search showed "0 FOUND | TOTAL $0.00" —
                  the green money token read as a real balance. Hide it. */}
              {!(q && visible.length === 0) && (
                <>
                  <span className="cz-total-sep" aria-hidden="true">|</span>
                  <span className="cz-total-chip" aria-live="polite">
                    <span
                      className="cz-total-chip-label cz-fade-text-in"
                      key={openHaulName ? "haul" : sortMode === "starred" ? "star" : "shelf"}
                    >
                      {openHaulName ? "Haul" : sortMode === "starred" ? "Starred" : "Total"}
                    </span>
                    <ReelCounter value={listTotalUsd} />
                  </span>
                </>
              )}
            </div>
            {/* Starred filter + view toggles. Hidden inside an open haul. */}
            {toolbarActive && !openHaulName && (
              <div className="cz-toolbar-end">
                <button
                  type="button"
                  className={"cz-starred-filter" + (sortMode === "starred" ? " is-active" : "")}
                  aria-pressed={sortMode === "starred"}
                  aria-label={sortMode === "starred" ? "Show all items" : "Show starred only"}
                  title={sortMode === "starred" ? "Show all" : "Starred only"}
                  onClick={() => setSortMode(sortMode === "starred" ? "recent" : "starred")}
                >
                  <Heart
                    aria-hidden="true"
                    size={16}
                    strokeWidth={2}
                    fill={sortMode === "starred" ? "currentColor" : "none"}
                  />
                </button>
                <span className="cz-toolbar-sep" aria-hidden="true" />
                <button
                  type="button"
                  className="cz-view-button"
                  onClick={() => setViewMode("carousel")}
                  aria-label="Carousel view"
                  aria-pressed={viewMode === "carousel"}
                  title="Carousel"
                  style={{
                    fontFamily: FONT,
                    fontSize: 12,
                    color: viewMode === "carousel" ? INK : FAINT,
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: "4px 2px",
                  }}
                >
                  ◈
                </button>
                <button
                  type="button"
                  className="cz-view-button"
                  onClick={() => setViewMode("cards")}
                  aria-label="Card view"
                  aria-pressed={viewMode === "cards"}
                  title="Cards"
                  style={{
                    fontFamily: FONT,
                    fontSize: 12,
                    color: viewMode === "cards" ? INK : FAINT,
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: "4px 2px",
                  }}
                >
                  ▦
                </button>
              </div>
            )}
          </div>
        )}

        {/* Haul chrome lives here (not inside the surface swap) so it can fade in
            when a haul opens without hopping or re-skinning. */}
        {openHaulName ? (
          <div className="cz-haul-open-head" key={openHaulName}>
            <div className="cz-haul-open-head-row">
              <button type="button" className="cz-haul-back" onClick={closeHaul}>
                <ChevronLeft aria-hidden="true" size={18} strokeWidth={2.2} />
                All hauls
              </button>
              <h2 className="cz-haul-open-title">{openHaulName}</h2>
            </div>
            {/* A3 + A6 pipeline board: where every card sits in the buy →
                warehouse → ship flow, the ready-to-ship count, and the rough
                parcel weight. Covers the whole haul, not the search-narrowed
                cards. */}
            {haulPipeline && totalsItems.length > 0 ? (
              <div className="cz-haul-open-stats" aria-label="Haul pipeline">
                {FIND_STATUSES.map((s) =>
                  haulPipeline.counts[s] ? (
                    <span key={s} className={"cz-haul-stat cz-haul-stat-" + s}>
                      {FIND_STATUS_LABELS[s]} {haulPipeline.counts[s]}
                    </span>
                  ) : null
                )}
                {haulPipeline.readyToShip > 0 ? (
                  <span className="cz-haul-stat cz-haul-stat-ready">
                    Ready to ship {haulPipeline.readyToShip}
                  </span>
                ) : null}
                {haulPipeline.weightLabel ? (
                  <span className="cz-haul-stat cz-haul-stat-weight">
                    {haulPipeline.weightLabel}
                  </span>
                ) : null}
              </div>
            ) : null}
            {/* Part 5 Tier A: budget, parcel estimate, archive. The record is
                find-or-create on first save, so the board also works for
                hauls that only exist as item.project names so far. */}
            <HaulBoard
              record={hauls.find((h) => h.name === openHaulName) || null}
              pipeline={haulPipeline}
              totalUsd={listTotalUsd}
              onUpdate={(patch, historyEntry) => updateHaul(openHaulName, patch, historyEntry)}
              onArchive={() => {
                const rec = hauls.find((h) => h.name === openHaulName);
                const next = !(rec && rec.archived);
                updateHaul(openHaulName, { archived: next }, { type: next ? "archived" : "unarchived" });
                // Archiving hides the haul from the directory — leave it.
                if (next) closeHaul();
              }}
            />
          </div>
        ) : null}
        </div>{/* /.cz-chrome */}

        <main>
        {view === "inbox" ? (
          <div
            role="tabpanel"
            id="view-panel-inbox"
            aria-labelledby="view-tab-inbox"
            style={{ display: "flex", flexDirection: "column", gap: 10 }}
          >
            {inboxItems.map((item) => (
              <div
                key={item.id}
                style={{
                  background: CARD,
                  border: "1px solid " + HAIR,
                  borderRadius: 0,
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <TypeMark item={item} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13.5,
                      fontWeight: 500,
                      color: INK,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.title || item.rawText}
                  </div>
                  <div style={{ fontSize: 11.5, color: FAINT }}>
                    {item.status === "enriching" ? "Enhancing…" : "Couldn't enhance — still saved"}
                  </div>
                </div>
                {item.status === "failed" && aiAvailable() && (
                  <Pill onClick={() => retry(item.id)}>Retry</Pill>
                )}
              </div>
            ))}
          </div>
        ) : view === "hauls" ? (
          <AnimatePresence
            mode="wait"
            initial={false}
            onExitComplete={() => setClosingHaulName(null)}
          >
            {activeHaul ? shelfSurface : haulDirectorySurface}
          </AnimatePresence>
        ) : (
          shelfSurface
        )}
        </main>
      </div>

      {notification && (
        <div className="cz-toast-region" aria-live="polite">
          <div
            className="cz-toast"
            data-tone={notification.tone}
            role={notification.tone === "error" ? "alert" : "status"}
            onMouseEnter={pauseNotification}
            onMouseLeave={resumeNotification}
            onFocus={pauseNotification}
            onBlur={resumeNotification}
          >
            <span className="cz-toast-message">{notification.message}</span>
            {notification.actionLabel && notification.onAction && (
              <button
                type="button"
                className="cz-toast-action"
                onClick={() => {
                  notification.onAction();
                  dismissNotification();
                }}
              >
                {notification.actionLabel}
              </button>
            )}
            <button
              type="button"
              className="cz-toast-dismiss"
              aria-label="Dismiss notification"
              onClick={dismissNotification}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Stash button — MOBILE ONLY (≤767px). It replaces the fixed bottom bar
          (mobile handoff step 3). Desktop capture lives under the masthead, and
          Agent moved into the Settings sheet, so one round button is the whole
          bar now. Hidden on the first-run intro (CO-04) and on the brand-new
          empty shelf: the hero already carries capture there (Kyle: "too many
          buttons"). Same rule as the tabs row — it returns once something is
          stashed.
          The container spans the viewport but passes taps through; only the
          button and the clip pill take pointer events. */}
      {!firstRunIntro && items.length > 0 && (
      <div className="cz-stash-dock">
        {/* 1-tap capture survives the bar deletion: with a link on the
            clipboard this pill stashes it without opening the sheet. */}
        {clipPreview && (
          <button
            type="button"
            className="cz-stash-clip"
            disabled={interactionLocked}
            onClick={stashClipboard}
            title="Stash the clipboard in one tap"
            aria-label={"Stash the clipboard: " + clipPreview.host}
          >
            <span className="cz-stash-clip-dot" style={{ background: clipPreview.dot }} aria-hidden="true" />
            <span className="cz-stash-clip-host">{clipPreview.host}</span>
            <span className="cz-stash-clip-verb">Stash ↑</span>
          </button>
        )}
        <button
          type="button"
          className="cz-stash-fab"
          disabled={interactionLocked}
          onClick={() => setCaptureSheetOpen(true)}
          title="Stash a link or note"
          aria-label={
            clipPreview
              ? "Stash to shelf. A link is on your clipboard."
              : "Stash to shelf"
          }
        >
          <Plus size={24} strokeWidth={2.2} aria-hidden="true" />
          {/* Badge = "your clipboard has something". The pill beside it says
              what; this only has to be visible from across the screen. */}
          {clipPreview && <span className="cz-stash-fab-badge" aria-hidden="true" />}
        </button>
      </div>
      )}
    </div>
  );
}
