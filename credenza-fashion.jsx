import { Fragment, lazy, Suspense, useState, useEffect, useRef, useMemo, useCallback } from "react";
import { flushSync } from "react-dom";
import { AnimatePresence, LazyMotion, m as motion } from "framer-motion";
import { loadMotionFeatures } from "./components/motion-features.js";
import { Check, ChevronLeft, Heart, MoreHorizontal, Plus, Search, User, X } from "lucide-react";
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
  getAgent,
  hashItemId,
  marketplaceOf,
  recordOutboundClick,
  unwrapAgentUrl,
} from "./agents.js";
import { parseRedditHaul, deobfuscateUrls } from "./reddit-haul.js";
import { fashionGateStatus } from "./fashion-gate.js";
import { FIND_STATUSES } from "./credenza-find-status.js";
import { downloadHaulCsv } from "./credenza-haul-export.js";
import { markActivation, monitoredFetch } from "./monitor.js";
import {
  extractWeightGramsFromText,
  pickColorwayFromVariants,
  preferCardTitle,
  shouldReplaceFashionTitle as listingShouldReplaceTitle,
} from "./listing-facts.js";
import {
  WEIGHT_BANDS,
  CATEGORY_TO_WEIGHT_KEY,
  estimateItemWeightGrams,
  estimateHaulWeightGrams,
} from "./weight-estimate.js";
import {
  AUTH_ENABLED,
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
  safeErrorMessage,
} from "./preview/src/account.js";
import { overFreeLimit, bumpUsage, planLimit, PRO_LIMITS } from "./preview/src/usage.js";
import { buildShareSnapshot, makeShareCode, expiryFromDays, shareUrl } from "./credenza-share.js";
import { createShare, listShares, deleteShare, copyLink } from "./preview/src/share-api.js";
import { SYNC_READY, pullShelf, createShelfPusher, deleteRemoteShelf } from "./preview/src/sync.js";
import {
  mergeShelves,
  addTombstones,
  clearTombstones,
  sweepTombstones,
} from "./credenza-sync-merge.js";
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
const ShareSheet = lazy(() => import("./sheets/ShareSheet.jsx"));
const SharedLinksSheet = lazy(() => import("./sheets/SharedLinksSheet.jsx"));


// Always-rendered components split out of this file (2026-07-25). Static, not
// lazy: the shelf paints them on first load, so a chunk fetch would only add
// a waterfall. The circular import back into this file is safe — the helpers
// they use are hoisted function declarations.
import DigestDeck from "./components/DigestDeck.jsx";
import HaulBoard from "./components/HaulBoard.jsx";
import HeroStagger from "./components/HeroStagger.jsx";
import { SITE_NAV } from "./components/site-nav.js";
import { TypeMark } from "./components/CardCover.jsx";
import Card from "./components/Card.jsx";
import MorphButton from "./components/MorphButton.jsx";
import HaulCoverFan from "./components/HaulCoverFan.jsx";
import {
  Caption,
  Field,
  HolographicBackground,
  Pill,
  PriceChip,
  RainbowBackground,
  ReelCounter,
  StatusPill,
} from "./components/atoms.jsx";
import ComboboxField from "./components/ComboboxField.jsx";
import CoverFlowCarousel from "./components/CoverFlowCarousel.jsx";
import DesktopDetailPanel from "./components/DesktopDetailPanel.jsx";
// NOT lazy, and §11 is why. The photo morph needs the sheet's hero to EXIST in
// the frame the browser snapshots, and a lazy component renders its Suspense
// fallback for one tick on first open — so the browser found nothing to pair the
// card photo with and the morph silently degraded to a cross-fade, on the first
// open of a session only. Preloading the chunk does not fix it: React initializes
// a lazy component on its first RENDER attempt, not when the module lands, so the
// fallback tick happens regardless. Its own chunk was 3.3kB (DetailBody already
// sits in the main bundle for the desktop panel), so a static import is the whole
// cost. Verified by scripts/probe-turn9-morph.mjs — it asserts a matching
// ::view-transition-new(cz-morph-photo), which is the browser confirming it
// accepted the pair.
import DetailSheet from "./sheets/DetailSheet.jsx";
import { ModalShell } from "./components/ModalShell.jsx";
import { BrandIcon } from "./components/BrandIcon.jsx";
import BrandMark from "./components/BrandMark.jsx";
import { HaulAccordionField } from "./components/HaulAccordionField.jsx";
import { EditPhotosManager } from "./components/EditPhotosManager.jsx";
import { SegmentedControl, StatusChips } from "./components/atoms.jsx";
// Re-exported so sheets/components that import these from this file keep working.
export { BrandIcon, Caption, ComboboxField, EditPhotosManager, Field, HaulAccordionField, ModalShell, Pill, PriceChip, SegmentedControl, StatusChips, StatusPill };

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
    // Brand mark colours are IDENTICAL in both palettes on purpose (Kyle
    // 2026-07-26). The mark is one object across the app, the marketing site
    // and the installed icon; a badge that re-tints per colourway is not a
    // logo. These are sampled from the shipped icon-192.png.
    "--cz-brand-ground": "#0f1114",
    "--cz-brand-c": "#e9edf2",
    "--cz-brand-rule": "#4da3ff",
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
    // #15803d measured 4.46:1 on --cz-money-bg — just under the 4.5:1 text
    // floor. Six units darker clears it at 4.8:1 and reads the same.
    "--cz-money": "#147a3a",
    "--cz-money-bg": "rgba(21, 128, 61, 0.09)",
    // Money green that has to sit on a photo or on the dark action fill.
    // #15803d disappears against both (mobile handoff step 5/6).
    "--cz-money-on-photo": "#7ee2a8",
    // The ONE blue on a card: the album link (handoff turn 3 §3).
    "--cz-link": "#1d5fd0",
    "--cz-link-on-photo": "#cfe0ff",
    // Status track tints (mobile handoff step 6). Bought = blue, shipped =
    // violet, QC = amber. Each pair is bg + text at >= 4.5:1.
    "--cz-status-bought-bg": "oklch(0.93 0.045 250)",
    "--cz-status-bought-text": "oklch(0.42 0.13 250)",
    "--cz-status-shipped-bg": "oklch(0.93 0.045 290)",
    "--cz-status-shipped-text": "oklch(0.42 0.13 290)",
    "--cz-status-qc-bg": "oklch(0.94 0.06 85)",
    "--cz-status-qc-text": "oklch(0.45 0.13 70)",
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
    /* #a3a3ab read airy under the sheen, but the primary Buy label sits on
       this gradient and light text over it measured ~2:1. #656a72 holds
       4.9:1 against --cz-action-text through the whole sweep. */
    "--cz-gradient-3": "#656a72",
    /* Handoff turn 9 §10. The detail view stops rendering em-dash cells and
       renders chips instead, so it needs a chip fill, a warm "no chart"
       warning pair, and three quiet surface tints (photo strip, footer,
       inset footer strip). --cz-hair-strong already exists above.
       NOTE on green: the handoff writes --cz-accent for its green. In THIS
       repo --cz-accent is ink (the chrome is deliberately near-monochrome —
       see the palette comment above), and the one green is --cz-money.
       Every turn-9 green therefore maps to --cz-money. */
    "--cz-chip-fill": "#E6E6DE",
    "--cz-warn": "#C0932a",
    /* The warning LABEL is body text on the canvas, so it needs the 4.5:1
       floor; #C0932a measures ~2.6:1 and is used for the dot only. */
    "--cz-warn-ink": "#8a6714",
    "--cz-accent-tint": "rgba(20, 122, 58, 0.06)",
    "--cz-strip-bg": "#EAEAE4",
    "--cz-footer-bg": "#EFEFE9",
    "--cz-inset-bg": "#FAFAF6",
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
    // Same three values as Gallery — see the note there.
    "--cz-brand-ground": "#0f1114",
    "--cz-brand-c": "#e9edf2",
    "--cz-brand-rule": "#4da3ff",
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
    // Blackout inverts the action fill to near-white, so the "on fill" money
    // has to go DARK here. Same token, opposite end of the ramp.
    "--cz-money-on-photo": "#137a3a",
    // The ONE blue on a card: the album link (handoff turn 3 §3).
    "--cz-link": "#7fb2ff",
    "--cz-link-on-photo": "#cfe0ff",
    "--cz-status-bought-bg": "oklch(0.30 0.06 250)",
    "--cz-status-bought-text": "oklch(0.84 0.10 250)",
    "--cz-status-shipped-bg": "oklch(0.30 0.06 290)",
    "--cz-status-shipped-text": "oklch(0.84 0.10 290)",
    "--cz-status-qc-bg": "oklch(0.32 0.07 85)",
    "--cz-status-qc-text": "oklch(0.86 0.11 85)",
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
    /* Blackout equivalents for turn 9 §10. The light values are warm paper
       tints; on a true-black field they invert to raised neutral surfaces.
       The three surface tints step ABOVE --cz-card-solid (#202024) so an
       inset strip still reads as inset, not as a hole in the card. */
    "--cz-chip-fill": "rgba(255, 255, 255, 0.10)",
    "--cz-warn": "#d9a83c",
    /* On black the warning label goes light, not dark: #8a6714 would vanish.
       #e8bf63 measures ~9.6:1 on the card surface. */
    "--cz-warn-ink": "#e8bf63",
    "--cz-accent-tint": "rgba(74, 222, 128, 0.10)",
    "--cz-strip-bg": "#151517",
    "--cz-footer-bg": "#0c0c0e",
    "--cz-inset-bg": "#26262b",
  },
};

export const BG = "var(--cz-bg)";
export const CARD = "var(--cz-card)";
export const HAIR = "var(--cz-hair)";
export const INK = "var(--cz-ink)";
export const SUB = "var(--cz-sub)";
export const FAINT = "var(--cz-faint)";
export const SEG = "var(--cz-seg)";
export const BLUE = "var(--cz-accent)";
export const BLUE_BG = "var(--cz-accent-bg)";
export const BLUE_DK = "var(--cz-accent-deep)";
export const ACTION_FILL = "var(--cz-action-fill)";

export const FONT = "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
export const DISPLAY = "Georgia, 'Iowan Old Style', 'Times New Roman', serif";

// Internal type keys are stable (match stored data); labels are display-only.
export const TYPES = {
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

// A6 (docs/Monetization.md): rough per-category ship mids in grams. Values
// come from weight-estimate WEIGHT_BANDS so haul chips match keyword bands.
// Always render with a "~" prefix. Manual item.weightGrams still wins.
export const CATEGORY_WEIGHT_GRAMS = Object.fromEntries(
  Object.entries(CATEGORY_TO_WEIGHT_KEY).map(([cat, key]) => [cat, WEIGHT_BANDS[key].mid])
);

// Effective planning ship weight: override → listing text → title keyword →
// category band (weight-estimate.js). Returns null when no signal.
export function itemWeightGrams(item) {
  return estimateItemWeightGrams(item);
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
  return estimateHaulWeightGrams(items);
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
export function formatMoney(amount, currency) {
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

export function itemUsdAmount(item) {
  if (!item || typeof item !== "object") return null;
  if (item.priceUsd != null && isFinite(Number(item.priceUsd))) return Number(item.priceUsd);
  if (item.price == null || !isFinite(Number(item.price))) return null;
  const currency = String(item.currency || "CNY").toUpperCase();
  if (currency === "USD" || currency === "$") return Number(item.price);
  if (currency === "CNY" || currency === "RMB" || currency === "¥" || currency === "CNH") {
    return Math.round(Number(item.price) * FX_FALLBACK_USD_PER_CNY * 100) / 100;
  }
  // Unknown currency: don't invent USD (would inflate the reel).
  return null;
}

// One pure sum for shelf + haul totals so chips, phone tabs, and the reel
// never disagree. Returned cards drop out of open-haul totals only.
export function sumItemsUsd(items, { excludeReturned = false } = {}) {
  let sum = 0;
  for (const it of items || []) {
    if (excludeReturned && it && it.findStatus === "returned") continue;
    const usd = itemUsdAmount(it);
    if (usd != null && isFinite(usd)) sum += usd;
  }
  return Math.round(sum * 100) / 100;
}

// Primary price currency (settings-toggles.md #1, design handoff PR3 profile
// sheet): display ORDER only — stored item fields never change. The app root
// syncs this from credenza-prefs-v1; the USD default keeps tests and any
// non-app caller unchanged.
let PRICE_PRIMARY = "USD";
function setPricePrimaryPref(v) {
  PRICE_PRIMARY = v === "CNY" ? "CNY" : "USD";
}
// DetailBody price editor (and tests) read the same mirror ProfileSheet writes.
export function pricePrimaryPref() {
  return PRICE_PRIMARY;
}

// Fit summary prefs (design handoff PR4). Same module-mirror pattern as
// PRICE_PRIMARY: the App syncs these from its prefs state, and flipping a
// ProfileSheet toggle re-renders the tree so FitSummary reads fresh values.
export let FIT_SUMMARY_ON = true;
let FIT_DETAIL = "concise"; // "concise" | "detailed"
function setFitPrefs({ summary, detail }) {
  FIT_SUMMARY_ON = summary !== false;
  FIT_DETAIL = detail === "detailed" ? "detailed" : "concise";
}
// Sheets read the same mirrors through this getter (the mobile detail sheet
// ignored both toggles until 2026-07-25 — Kyle: "it doesn't really matter
// what you put because it stays the same").
export function fitDisplayPrefs() {
  return { summary: FIT_SUMMARY_ON, detail: FIT_DETAIL };
}

export function priceLabel(item) {
  if (item.price == null && item.priceUsd == null) return "";
  const currency = item.currency || "CNY";
  const usd = itemUsdAmount(item);
  const cny =
    currency === "CNY" && item.price != null && isFinite(item.price) ? item.price : null;

  // One currency only (Kyle 2026-07-26): USD prefs hide ¥; CNY prefs hide $.
  // Dual "$14.59 · ¥99" made the footer and cards fight the price toggle.
  if (PRICE_PRIMARY === "USD") {
    if (usd != null) return formatMoney(usd, "USD");
    if (cny != null) return formatMoney(cny, "CNY");
    if (item.price != null) return formatMoney(item.price, currency);
    return "";
  }
  if (cny != null) return formatMoney(cny, "CNY");
  if (usd != null) return formatMoney(usd, "USD");
  if (item.price != null) return formatMoney(item.price, currency);
  return "";
}

// USD-only pill label (Kyle 2026-07-22): the dual-currency chip ate too much
// photo on phones. USD when known, CNY fallback, whatever-currency last.
export function priceLabelShort(item) {
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
// 半胸 / 1/2 chest first so pit-to-pit labels win over bare 胸围 in the same
// segment; normalizeHalfChestRows still doubles when the column looks half.
const MEASURE_PAIR_RE =
  /(半胸|1\/2\s*胸|½\s*胸|1\/2\s*chest|half[\s-]*chest|pit[\s-]*to[\s-]*pit|胸围|胸寛|胸宽|chest|bust|肩宽|肩寛|shoulder|袖长|袖長|sleeve|腰围|腰圍|waist|臀围|臀圍|hip|裤长|褲長|pants?\s*length|trouser\s*length|衣长|衣長|length)\s*[:：]?\s*(\d{2,3})/gi;

function measureKeyForLabel(label) {
  const l = label.toLowerCase();
  if (/半胸|1\/2|½|half|pit|胸|chest|bust/.test(l)) return "chest";
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
  // Chinese tee charts often print 半胸 / pit-to-pit (half chest). Body profile
  // and ease math need full circumference. Double when every chest column is
  // in the half-chest band, or the source text says half/flat measure.
  const rowsNorm = normalizeHalfChestRows(rows, src);
  return { rows: rowsNorm, runHint: sizeRunHint(src) };
}

// Half-chest (pit-to-pit) → full circumference. Adult full chest is almost
// never under ~80cm across a letter-size run; half-chest sits ~38–65.
export function normalizeHalfChestRows(rows, src = "") {
  if (!Array.isArray(rows) || rows.length < 2) return rows;
  const chests = rows.map((r) => r && r.chest).filter((v) => v != null && isFinite(v));
  if (chests.length < 2) return rows;
  const max = Math.max(...chests);
  const min = Math.min(...chests);
  const halfHint =
    /半胸|平量|pit[\s-]*to[\s-]*pit|half[\s-]*chest|1\/2[\s-]*chest|½[\s-]*chest|1\/2胸/i.test(
      String(src || "")
    );
  // Full adult tops: max chest usually ≥80. Half-chest runs rarely exceed 72.
  // Span cap avoids treating a weird partial full-chest column as half.
  const looksHalf = halfHint || (max <= 72 && min >= 28 && max - min <= 40);
  if (!looksHalf) return rows;
  return rows.map((r) => {
    if (!r || r.chest == null || !isFinite(r.chest)) return r;
    return { ...r, chest: Math.round(r.chest * 2) };
  });
}

// A parsed chart back to text (handoff turn 9 §3, "Fix a number").
//
// The chart is never the stored thing — `sizeNotes` is, and every render parses
// it again. So a corrected number has to become TEXT the parser reads back the
// same way, or the fix would survive one render and vanish on the next.
//
// The emitted form is strategy 1's own shape ("L: chest 120, length 72"), which
// parseSizeChart round-trips exactly. It carries no half-chest wording, so
// normalizeHalfChestRows leaves the corrected numbers alone.
export const CHART_SERIAL_LABELS = {
  chest: "chest",
  waist: "waist",
  hip: "hip",
  shoulder: "shoulder",
  sleeve: "sleeve",
  length: "length",
  pantsLength: "pants length",
};
export function serializeSizeChart(chart) {
  const rows = chart && Array.isArray(chart.rows) ? chart.rows : [];
  const lines = [];
  for (const row of rows) {
    if (!row || !row.size) continue;
    const parts = [];
    for (const key of Object.keys(row)) {
      if (key === "size") continue;
      const label = CHART_SERIAL_LABELS[key];
      const value = row[key];
      // Only whole cm in the parser's own band survive the round trip.
      if (!label || value == null || !isFinite(value)) continue;
      const n = Math.round(value);
      if (n < 20 || n > 250) continue;
      parts.push(label + " " + n);
    }
    if (parts.length) lines.push(String(row.size) + ": " + parts.join(", "));
  }
  return lines.join("\n");
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

// The prescription sentence for the size breakdown (handoff turn 3 §5): 1–2
// short plain sentences naming the measurement that decided the pick and what
// the next size down would do. Generated where the chart is parsed — same
// data, no server round-trip. Example: "Take the Large — its 104cm chest
// gives you 6cm of room over your 98cm, which is where this shirt is meant to
// sit. The Medium's 100cm would pull across the chest."
export function prescriptionSentence(chart, rec, { units = "cm", category = "" } = {}) {
  if (!chart || !rec || !rec.size || rec.garment == null || rec.body == null || rec.diff == null) return "";
  if (!isFinite(rec.garment) || !isFinite(rec.body) || !isFinite(rec.diff)) return "";
  const measure = rec.primaryKey === "waist" ? "waist" : rec.primaryKey === "hip" ? "hip" : "chest";
  const noun =
    category === "outerwear"
      ? "jacket"
      : category === "pants"
        ? "pants"
        : category === "shorts"
          ? "shorts"
          : category === "shirt"
            ? "shirt"
            : "piece";
  const sizeName = formatSizeToken(rec.size) || rec.size;
  const garment = formatMeasure(rec.garment, units);
  const body = formatMeasure(rec.body, units);
  const room = formatMeasure(Math.abs(rec.diff), units);
  // The ease targets recommendSize aims for; "meant to sit" only when the
  // pick lands on target.
  const target = measure === "chest" ? (category === "outerwear" ? 16 : 12) : 2;
  const sitsRight = Math.abs(rec.diff - target) <= 4;
  const first =
    "Take the " +
    sizeName +
    " — its " +
    garment +
    " " +
    measure +
    " gives you " +
    room +
    " of room over your " +
    body +
    (sitsRight ? ", which is where this " + noun + " is meant to sit" : "") +
    ".";
  // Next size down: the closest smaller garment on the deciding axis.
  const down = chart.rows
    .filter((r) => r && r.size !== rec.size && r[rec.primaryKey] != null && r[rec.primaryKey] < rec.garment)
    .sort((a, b) => b[rec.primaryKey] - a[rec.primaryKey])[0];
  if (!down) return first;
  const downName = formatSizeToken(down.size) || down.size;
  const downVal = formatMeasure(down[rec.primaryKey], units);
  const consequence =
    measure === "chest"
      ? "pull across the chest"
      : measure === "waist"
        ? "dig in at the waist"
        : "pull across the hips";
  return first + " The " + downName + "'s " + downVal + " would " + consequence + ".";
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
  // Agent product fronts unwrap to marketplace buy links.
  const unwrapped = unwrapAgentUrl(url);
  const target = (unwrapped && unwrapped.url) || url;
  let host = "";
  try {
    host = new URL(target).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "alt";
  }
  if (/(^|\.)yupoo\.com$/.test(host)) return "photos";
  if (/(^|\.)(weidian\.com|weidian\.cn|taobao\.com|tmall\.com|1688\.com)$/.test(host)) return "buy";
  return "alt";
}

/** Canonical marketplace product URL when `raw` is an agent front, else `raw`. */
function marketplaceBuyUrl(raw) {
  if (!raw || typeof raw !== "string") return raw;
  const unwrapped = unwrapAgentUrl(raw);
  return unwrapped && unwrapped.url ? unwrapped.url : raw;
}

/** Bare hostname (no leading www.) for a URL, or null when it does not parse. */
function hostOf(raw) {
  try {
    return new URL(raw).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

// Weidian item ID when the URL is a resolvable product page, else null. Mirrors
// the server-side check in resolve.js so the client never wastes a call.
function weidianItemId(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  if (!/(^|\.)weidian\.(com|cn)$/.test(host)) return null;
  const id = u.searchParams.get("itemID") || u.searchParams.get("itemId") || u.searchParams.get("item_id");
  if (id && /^\d{5,}$/.test(id)) return id;
  const pathMatch = u.pathname.match(/\/item\/(\d{5,})/);
  return pathMatch ? pathMatch[1] : null;
}

/** Taobao / Tmall listing id — mirrors resolve.js taobaoFamilyItemId. */
function taobaoFamilyItemId(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  const isTaobao =
    /(^|\.)(taobao|tmall)\.com$/.test(host) || host === "m.tb.cn" || /(^|\.)tb\.cn$/.test(host);
  if (!isTaobao) return null;
  const id = u.searchParams.get("id") || u.searchParams.get("itemId") || u.searchParams.get("item_id");
  if (id && /^\d{5,}$/.test(id)) return id;
  const path = u.pathname.match(/\/item\/(\d{5,})/);
  return path ? path[1] : null;
}

/** 1688 offer id — mirrors resolve.js ali1688ItemId. */
function ali1688ItemId(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  if (!/(^|\.)1688\.com$/.test(host)) return null;
  const path = u.pathname.match(/\/offer\/(\d{5,})(?:\.html)?/i);
  if (path) return path[1];
  const id =
    u.searchParams.get("offerId") ||
    u.searchParams.get("offer_id") ||
    u.searchParams.get("id");
  if (id && /^\d{5,}$/.test(id)) return id;
  return null;
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
// Agent fronts (Fansbuy item-micro, Superbuy ?url=, …) resolve to marketplace.
function resolvableBuyUrl(item) {
  const isResolvable = (raw) => {
    const buy = marketplaceBuyUrl(raw);
    return !!(weidianItemId(buy) || taobaoFamilyItemId(buy) || ali1688ItemId(buy));
  };
  if (item.url && isResolvable(item.url)) return marketplaceBuyUrl(item.url);
  for (const l of item.links || []) {
    if (l && l.url && isResolvable(l.url)) return marketplaceBuyUrl(l.url);
  }
  return null;
}

// First Yupoo album URL on an item: the primary URL or any paired link tagged
// as photos. Used to populate the photo-orbit animation.
export function yupooAlbumUrl(item) {
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
  // Resolve can attach bare shop hosts from Weidian desc notes.
  for (const raw of item.sellerYupooLinks || []) {
    if (typeof raw === "string" && isYupoo(raw)) return ensureYupooAlbumUid(raw);
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
    let url = typeof entry === "string" ? entry : entry && entry.url;
    if (!url || !/^https?:\/\//.test(url)) continue;
    // Store marketplace URLs, not agent fronts (Fansbuy item-micro, etc.).
    url = marketplaceBuyUrl(url);
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
  let url = urlMatch[0];
  // Agent fronts (Fansbuy item-micro, Superbuy ?url=, …) store as marketplace.
  const unwrapped = unwrapAgentUrl(url);
  if (unwrapped && unwrapped.url) url = unwrapped.url;
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
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
  } catch {
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
    } catch {}
  }
  // Weidian/Taobao item pages carry the id in the query — name it instead of
  // falling through to the bare host ("weidian.com" cards, 2026-07-25).
  if (/(^|\.)weidian\.com$/i.test(host)) {
    try {
      const id = new URL(url).searchParams.get("itemID");
      if (id) return "Weidian item " + id;
    } catch {}
  }
  if (/(^|\.)(taobao\.com|tb\.cn)$/i.test(host)) {
    try {
      const id = new URL(url).searchParams.get("id");
      if (id) return "Taobao item " + id;
    } catch {}
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
  } catch {}
  return host || "Saved link";
}

// Best display title from Yupoo/Weidian enrichment payloads. Prefer human
// product labels over pure batch codes when both exist.
export function fashionDisplayTitle(data) {
  if (!data || typeof data !== "object") return "";
  const candidates = [data.translatedTitle, data.productTitle, data.title, data.sourceTitle, data.batch];
  for (const raw of candidates) {
    const t = String(raw || "").trim();
    if (!t) continue;
    // Strip leading currency markers like "￥209 M29855-51E" → keep the code,
    // but if there's real words after price keep the words.
    const noPrice = t.replace(/^[￥¥$€£]\s*[\d.,]+\s*/u, "").trim();
    // Dead pages return junk markers, not titles (a dead Weidian item page
    // titles itself "<UNKNOWN>"). Skip them so the local fallback survives.
    if (!noPrice || /^<?unknown>?$/i.test(noPrice)) continue;
    return noPrice.length > 72 ? noPrice.slice(0, 69).trimEnd() + "…" : noPrice;
  }
  return "";
}

// Drain `list` through `concurrency` workers in order. A throwing worker must
// not strand the rest of the queue — each item is exactly one worker's
// problem (2026-07-25: one bad enhance killed all three workers and stranded
// a 20-link import at "Enhancing…" forever).
export async function runPool(list, worker, concurrency = 3) {
  const queue = [...list];
  const workers = Array.from(
    { length: Math.min(concurrency, queue.length) },
    async () => {
      while (queue.length) {
        const item = queue.shift();
        if (item === undefined) continue;
        try {
          await worker(item);
        } catch {}
      }
    }
  );
  await Promise.all(workers);
}

// Store homepage for a Yupoo seller (or generic host fallback).
export function sellerStoreUrl(item) {  if (!item) return null;
  const account = String(item.sellerAccount || "").trim();
  if (account) return "https://" + account + ".x.yupoo.com/";
  const album = yupooAlbumUrl(item);
  if (album) {
    try {
      const u = new URL(album);
      return u.origin + "/";
    } catch {}
  }
  if (item.url) {
    try {
      const u = new URL(item.url);
      if (/(^|\.)yupoo\.com$/i.test(u.hostname)) return u.origin + "/";
    } catch {}
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
          } catch {
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
// Deleted-card gravestones (LB-7). Kept beside the shelf, not inside it, so a
// .json backup restores cards without also restoring the record of deletions.
export const TOMBSTONE_KEY = "credenza-fashion-tombstones-v1";

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
// Inline chart frames per read (handoff turn 9 §3). Three covers a chart split
// across two frames plus a retake. chart-vision.js enforces the same cap
// server-side; this one keeps the request small before it leaves the phone.
const CHART_PHOTO_MAX = 3;

// How many photos an item KEEPS. Every stored photo is a ~32KB base64 string
// inside the item JSON, so this is a storage budget, not a display limit: 20
// photos is roughly 640KB per card. Photos the customer adds by hand — camera
// shots, QC photos, saved images — count against this and nothing else.
export const GALLERY_MAX = 20;

// How many photos we RELAY from an album (Kyle 2026-07-26: "let's only bring
// in 6 by default they can go to the album externally for the rest").
//
// This is the cost cap, and it is separate from GALLERY_MAX on purpose. Yupoo
// refuses hotlinks, so every album photo has to cross a Netlify function at
// full size, in and out. At 20 that made one pasted album cost 20 invocations
// plus its bandwidth. Six covers the front, the back, the tag and a detail
// shot — enough to judge a piece — and the album link opens the rest at the
// seller, at no cost to us. The link already reports the album's REAL count
// (see albumLinkTarget), so a 37-photo album never reads as a 6-photo one.
export const RELAY_MAX = 6;

// How many QC photos an item STORES. Same kind of budget as GALLERY_MAX, and
// deliberately equal to the Pro per-item cap: nobody can legitimately reach
// past 12, so anything beyond that is a corrupt or hand-edited record.
//
// The plan cap (4 free, 12 Pro) is a different number and lives in
// PLAN_LIMITS, server-side. This one bounds the array; that one bounds the
// add. Both the normalizer and the attach path read this, so a stored photo
// can never survive a save and then vanish on the next reload.
export const QC_PHOTOS_STORED = 12;

// The one place the subscription price is written (Kyle decided 2026-07-26,
// and made both Stripe Prices that day: $4.99 monthly, $39.99 yearly).
//
// Stripe Prices are immutable, so a price the app states and a price Stripe
// charges can drift apart silently — the customer sees one number on the
// button and a different number on the card. Every surface reads from here,
// and preview/test/pricing.test.js checks the static /pricing/ page against
// these same strings, because a plain HTML file cannot import them.
export const PRICING = {
  monthly: "$4.99",
  yearly: "$39.99",
  // 4.99 * 12 = 59.88. 59.88 - 39.99 = 19.89, which is 33% off.
  // The mock said "works out at $3 a month"; that was true of a $36 yearly
  // and is false of this one. State the saving instead — a third off reads
  // stronger than $3.33 a month, and it has the advantage of being true.
  yearlySaving: "Save 33%",
  yearlyPerMonth: "$3.33 a month",
};

async function decodeImage(blob) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(blob);
    } catch {}
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

export async function compressImageBlob(blob) {
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

function platformNameFor(host) {
  const hit = CLIP_PLATFORMS.find(([re]) => re.test(host || ""));
  return hit ? hit[1] : host || "Link";
}
function platformDotFor(host) {
  const hit = CLIP_PLATFORMS.find(([re]) => re.test(host || ""));
  return hit ? hit[2] : "var(--cz-faint)";
}

// Short mono code that names one parsed row: the marketplace item id where
// one exists, else the album id, else the host.
function stashRowCode(parsed) {
  if (!parsed.url) return "note";
  const weidian = weidianItemId(parsed.url);
  if (weidian) return "item " + weidian;
  const yupoo = yupooAlbumIdentity(parsed.url);
  if (yupoo) return "album " + yupoo.albumId;
  return parsed.host || "link";
}

// Stash sheet preview (mobile handoff step 4). Rule: nothing is stashed that
// is not on screen first. Read a paste and describe what it BECOMES, before
// any card exists. Returns null for an empty paste.
//
// `count` drives the sheet state: 1 = one card, more = a haul. `rows` carry
// what the list shows. No side effects — this never touches the shelf.
export function stashPreview(raw) {
  const text = (raw || "").trim();
  if (!text) return null;
  const row = (parsed, rawText, titleHint) => ({
    key: canonicalKey(parsed, rawText),
    title: (titleHint || "").trim() || localTitle(parsed, rawText),
    code: stashRowCode(parsed),
    platform: platformNameFor(parsed.host),
    dot: platformDotFor(parsed.host),
  });
  let rows = parseImport(text).candidates.map((c) => row(c.parsed, c.rawText, c.titleHint));
  // The parser is conservative and returns nothing for some pastes. That text
  // still stashes as one note, so the preview must say so.
  if (!rows.length) rows = [row(classify(text), text, "")];
  const platforms = new Set(rows.map((r) => r.platform));
  return {
    count: rows.length,
    rows,
    platform: platforms.size === 1 ? rows[0].platform : "mixed sources",
    label: rows[0].platform + " · " + rows[0].code,
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
    albumPhotoCount: 0,
    chartImages: [],
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
  // Items stashed before the agent unwrap landed hold the agent front as their
  // primary URL (fansbuy.com/item-micro-…). Repair them on load: the canonical
  // marketplace link is what resolve, the canonical key, and Buy all expect.
  const unwrappedPrimary = old.url ? unwrapAgentUrl(old.url) : null;
  const primaryUrl = unwrappedPrimary && unwrappedPrimary.url ? unwrappedPrimary.url : old.url || null;
  const primaryHost = unwrappedPrimary && unwrappedPrimary.url ? hostOf(primaryUrl) : old.host || null;
  const parsed = {
    type: old.type || "note",
    url: primaryUrl,
    host: primaryHost,
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
    // How many product photos the SOURCE album holds. The gallery stores a
    // compressed subset, so its length undercounts (Kyle 2026-07-26: "it'll
    // say 8 photos, but this album has 30 different photos").
    albumPhotoCount:
      typeof old.albumPhotoCount === "number" && isFinite(old.albumPhotoCount)
        ? Math.min(999, Math.max(0, Math.round(old.albumPhotoCount)))
        : 0,
    // Size-chart tiles held out of the gallery, kept for the chart hunt.
    chartImages: Array.isArray(old.chartImages)
      ? old.chartImages.filter((g) => typeof g === "string" && /^https?:\/\//i.test(g)).slice(0, 8)
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
    priceManual: old.priceManual === true,
    category: CATEGORIES[old.category]
      ? old.category
      : guessFashionCategory(
          [old.title, old.summary, old.sizeNotes, old.batch, old.rawText, old.note].filter(Boolean).join(" ")
        ),
    variants: Array.isArray(old.variants)
      ? old.variants.filter((g) => g && typeof g.title === "string" && Array.isArray(g.values))
      : [],
    // Seller description photos from resolve (size charts live here). Feed the
    // silent chart hunt; kept out of the swipe gallery on purpose.
    descImages: Array.isArray(old.descImages)
      ? old.descImages.filter((g) => typeof g === "string" && /^https?:\/\//i.test(g)).slice(0, 20)
      : [],
    // Bare Yupoo shop links from Weidian desc notes (chart hunt fallback).
    sellerYupooLinks: Array.isArray(old.sellerYupooLinks)
      ? old.sellerYupooLinks
          .filter((g) => typeof g === "string" && /^https?:\/\//i.test(g) && /yupoo\.com/i.test(g))
          .slice(0, 8)
      : [],
    sizeNotes: typeof old.sizeNotes === "string" ? old.sizeNotes : "",
    // Where the size chart came from (handoff turn 3 §5 provenance footer):
    // { via: "album-text"|"album-photos"|"desc-photos"|"gallery-photos"|
    //        "customer-photo"|"seller-cache",
    //   photos: N scanned, at: ISO date, seller: who it belongs to }.
    // Written by the silent chart hunt, and by the customer's own read (turn 9
    // §3). `seller` exists so a chart read once can size the next item from the
    // same seller — see chartCacheForSeller.
    sizeChartSource:
      old.sizeChartSource && typeof old.sizeChartSource === "object"
        ? {
            via: typeof old.sizeChartSource.via === "string" ? old.sizeChartSource.via.slice(0, 24) : "",
            photos:
              typeof old.sizeChartSource.photos === "number" && isFinite(old.sizeChartSource.photos)
                ? Math.min(99, Math.max(0, Math.round(old.sizeChartSource.photos)))
                : 0,
            at: typeof old.sizeChartSource.at === "string" ? old.sizeChartSource.at.slice(0, 40) : "",
            seller:
              typeof old.sizeChartSource.seller === "string"
                ? old.sizeChartSource.seller.slice(0, 60)
                : "",
          }
        : null,
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
      ? old.qcPhotos.filter((g) => typeof g === "string" && (g.startsWith("data:image/") || /^https?:\/\//i.test(g))).slice(0, QC_PHOTOS_STORED)
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
    } catch {}
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
  // fromPost is true when the caller fetched a post OR when the paste itself
  // is known post body (opts.fromPost). Title alone is not enough when empty.
  const haul = parseRedditHaul(text, {
    title: opts.redditTitle || opts.title || "",
    fromPost: !!(opts.fromPost || opts.redditTitle),
  });
  if (haul) {
    const stats = Object.keys(haul.stats).length ? haul.stats : undefined;
    // Fetched-post author/permalink win when the body never mentions u/…
    const posterUser = haul.poster || opts.redditAuthor || undefined;
    const findSource = haul.sourceUrl || opts.redditUrl || undefined;
    for (const it of haul.items) {
      push(classify(it.url), it.rawLine, it.label, {
        note: it.note || undefined,
        // Structured fields from the pure parser (size/weight/category).
        // category lands on item.category (not only tags) so weight defaults work.
        category: it.category || undefined,
        posterSize: it.posterSize || undefined,
        sizeNotes: it.sizeNotes || undefined,
        weightGrams:
          typeof it.weightGrams === "number" && it.weightGrams > 0
            ? it.weightGrams
            : undefined,
        tags: it.category ? [it.category] : undefined,
        posterStats: stats,
        posterUser,
        findSource,
        fromPost: !!(haul.fromPost || opts.fromPost || opts.redditTitle),
        sourceTitle: haul.title || opts.redditTitle || opts.title || undefined,
        // Keep the original paste (capped) so a later, smarter parser can
        // reparse this haul without asking the user to paste again.
        sourceText: trimmed.length <= 12000 ? trimmed : trimmed.slice(0, 12000),
      });
    }
    return {
      candidates,
      provider: "reddit-haul",
      posterStats: stats,
      poster: posterUser || haul.poster,
      fromPost: !!(haul.fromPost || opts.fromPost || opts.redditTitle),
    };
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
    // Structured size/weight/category first so the note slice cannot drop them.
    // CATEGORIES vocabulary is the same keys the pure parser emits.
    if (c.category && CATEGORIES[c.category]) extra.category = c.category;
    if (c.posterSize) extra.posterSize = String(c.posterSize).slice(0, 32);
    if (c.sizeNotes) extra.sizeNotes = String(c.sizeNotes).slice(0, 4000);
    if (typeof c.weightGrams === "number" && c.weightGrams > 0) {
      extra.weightGrams = Math.round(c.weightGrams);
    }
    // Keep free-text notes; hard cap remains for storage, but structured fields
    // above already hold fit/size so a 500-char cut is less harmful.
    if (c.note) extra.note = c.note.slice(0, 500);
    // A1: haul pastes carry poster stats (v1: on each batch item; A3 haul
    // objects will hoist these) and the source thread for provenance.
    if (c.posterStats) extra.posterStats = c.posterStats;
    if (c.posterUser) extra.posterUser = c.posterUser;
    if (c.sourceText) extra.sourceText = c.sourceText;
    if (c.findSource) extra.findSource = c.findSource;
    if (c.sourceTitle) extra.sourceTitle = String(c.sourceTitle).slice(0, 200);
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
  } catch {
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
  } catch {
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
  } catch {
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

export function mergeFashionImages(...groups) {
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

// Title replace policy lives in listing-facts.js (SKU + Weidian placeholders +
// human Reddit labels). Pure tests own the cases; product only re-exports.
function shouldReplaceFashionTitle(title, url) {
  return listingShouldReplaceTitle(title, url);
}

function mergeFashionLinks(item, { albumUrl, buyUrl } = {}) {
  const links = [...(item.links || [])];
  if (albumUrl && albumUrl !== item.url) links.push({ url: albumUrl, role: "photos", label: "Yupoo" });
  if (buyUrl && buyUrl !== item.url) links.push({ url: buyUrl, role: "buy", label: "Weidian" });
  return normalizeLinks(links, item.url);
}

// Fetch structured Yupoo album data through the same-origin Netlify function.
export async function fetchYupooImages(albumUrl, { signal } = {}) {
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
  } catch {
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
// One poster for both chart-vision inputs. `images` are CDN URLs the server
// fetches through its allowlist; `photos` are inline base64 frames the customer
// took or picked, which no allowlist can cover because a camera frame has no
// URL. Handoff turn 9 §3: "the same parser endpoint as a clipboard paste — one
// ingest path, image or text". Two exported wrappers keep the call sites plain.
async function postChartVision({ images, photos, signal, referer }) {
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
      body: JSON.stringify({
        ...(images && images.length ? { images } : {}),
        ...(photos && photos.length ? { photos } : {}),
        ...(referer ? { referer } : {}),
      }),
      signal: controller.signal,
    });
    bumpUsage("chartVision");
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.found || typeof data.chartText !== "string") return null;
    return data.chartText.trim() || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", abort);
  }
}

export async function fetchChartFromPhotos(imageUrls, { signal, referer } = {}) {
  const images = (imageUrls || []).filter((u) => typeof u === "string" && u);
  if (!images.length) return null;
  return postChartVision({ images, signal, referer });
}

// Handoff turn 9 §3: "on success the chart is cached against the seller, so the
// next item from that seller sizes instantly".
//
// The cache IS the shelf. Every item already carries its chart in sizeNotes and
// its provenance in sizeChartSource, so a separate store would be a second copy
// that can go stale against the first. This walks the shelf for another item by
// the same seller whose chart was READ (not guessed), and returns its text.
//
// Only reads that came from a real chart qualify. A fallback is not a chart, and
// copying a guess between items would spread it silently.
const CHART_CACHE_VIA = new Set([
  "album-text",
  "album-photos",
  "chart-photos",
  "desc-photos",
  "gallery-photos",
  "customer-photo",
]);

export function chartCacheForSeller(items, item) {
  const seller = String((item && item.seller) || "").trim().toLowerCase();
  if (!seller) return null;
  let best = null;
  for (const other of items || []) {
    if (!other || other.id === (item && item.id)) continue;
    const src = other.sizeChartSource;
    if (!src || !CHART_CACHE_VIA.has(src.via)) continue;
    // The chart's own seller tag wins over the item's. A chart cached from a
    // different seller must not travel just because the cards ended up adjacent.
    const owner = String(src.seller || other.seller || "").trim().toLowerCase();
    if (owner !== seller) continue;
    const text = sizeChartTextFor(other);
    if (!text || !parseSizeChart(text)) continue;
    // Newest wins: a seller who reissues a chart means the later one.
    if (!best || String(src.at || "") > String(best.at || "")) {
      best = { text, at: src.at || "", seller: other.seller || item.seller || "" };
    }
  }
  return best;
}

// Handoff turn 9 §3: the customer snapshots or uploads the chart themselves.
// Takes what a camera capture, a file picker, or an already-stored local photo
// gives you — a File/Blob, or a `data:` URL — and posts it INLINE. The server
// never fetches anything on this path, so no allowlist applies.
//
// A `data:` URL passes straight through. Local photos (gallery tiles, QC shots)
// are already compressed to ~24KB when they are saved, so re-encoding one would
// only lose detail off the chart's smallest digits.
//
// Returns chart text parseSizeChart can read, or null. Never throws: a bad
// frame is a normal outcome here, and the caller shows the retry affordance.
export async function readChartFromPhotoFiles(files, { signal, referer } = {}) {
  const list = (Array.isArray(files) ? files : [files]).filter(Boolean).slice(0, CHART_PHOTO_MAX);
  if (!list.length) return null;
  const photos = [];
  for (const file of list) {
    if (typeof file === "string") {
      if (/^data:image\//i.test(file)) photos.push(file);
      continue;
    }
    try {
      // compressImageBlob returns a whole data: URL. The function reads the
      // media type off that URL rather than trusting a separate field, so pass
      // it through unchanged.
      photos.push(await compressImageBlob(file));
    } catch {
      // One undecodable frame must not lose the others.
    }
  }
  if (!photos.length) return null;
  return postChartVision({ photos, signal, referer });
}

// Fetch the seller's Product Details photos for a card that has none (Kyle
// 2026-07-26: "the sizing charts are not picking up this 'by the way' link…
// it's got that size chart right there in the product details of the
// advertisement, but for whatever reason it doesn't want to pick it up").
//
// On Weidian the chart is usually NOT in the gallery. It lives in the
// description feed, which resolve returns as descImages. Cards saved before
// that shipped (b794602, 2026-07-25) — and cards whose resolve was skipped,
// capped, offline, or failed — hold descImages: []. The hunt then scanned the
// gallery, found nothing, and reported "No size chart on this listing" even
// though the chart was one API call away.
//
// Re-resolving is cheap and idempotent: the same call the importer makes.
// Returns a plain array of image URLs, empty when unavailable. Never throws.
export async function fetchDescImages(item, { signal } = {}) {
  if (!PREVIEW_SECRET) return [];
  if (typeof navigator !== "undefined" && navigator.onLine === false) return [];
  if (overFreeLimit(planForLimits, "resolve")) return [];
  const buyUrl = resolvableBuyUrl(item);
  if (!buyUrl) return [];
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal) {
    if (signal.aborted) return [];
    signal.addEventListener("abort", abort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await monitoredFetch(storageBackend, "resolve", RESOLVE_ENDPOINT, {
      method: "POST",
      headers: await authHeaders({ "content-type": "application/json", "x-credenza-key": PREVIEW_SECRET }),
      body: JSON.stringify({ url: buyUrl }),
      signal: controller.signal,
    });
    bumpUsage("resolve");
    if (!res.ok) return [];
    const data = await res.json();
    if (!data || !Array.isArray(data.descImages)) return [];
    return data.descImages.filter((u) => typeof u === "string" && /^https?:\/\//i.test(u));
  } catch {
    return [];
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
  } catch {
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

function scoreForgottenGem(item, _now) {
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
export const EASE = "cubic-bezier(0.2, 0.6, 0.2, 1)";
const KEYFRAMES = `
*, *::before, *::after { box-sizing: border-box; }
.cz-shell { max-width: 1080px; margin: 0 auto; padding: 28px 28px 0; }
@media (max-width: 480px) { .cz-shell { padding: 16px 14px 0; } }
.cz-masthead { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
/* Lockup L2, stacked kicker (logo spec, Kyle 2026-07-26). "Fashion" used to
   sit on CREDENZA's baseline at a second size, weight and colour — two of
   everything on one line, so neither read as dominant. Stacking it costs zero
   horizontal room, which is why the kicker now SURVIVES the compact phone
   masthead instead of being dropped when the shelf fills. */
.cz-brand { display: inline-flex; align-items: center; gap: 11px; margin: 0; color: var(--cz-ink); font-size: 16px; font-weight: 800; letter-spacing: .16em; }
.cz-brand-name { display: inline-flex; flex-direction: column; align-items: flex-start; gap: 4px; line-height: 1; }
.cz-brand-word { font-size: 16px; letter-spacing: .16em; line-height: 1; }
.cz-brand-sub { font-size: 9.5px; font-weight: 700; letter-spacing: .34em; line-height: 1; color: var(--cz-faint); text-transform: uppercase; }
.cz-tagline { font-family: ${FONT}; font-size: 13px; color: var(--cz-sub); margin: 0 0 14px; line-height: 1.35; }
/* The mark is now an inline SVG (components/BrandMark.jsx) — the ground, the
   C and the rule all live inside the viewBox, so this rule only has to size
   and place it. It no longer renders text, so no font, colour or radius here. */
.cz-brand-mark { display: block; flex: 0 0 auto; width: 34px; height: 34px; }
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

// ═══ Card → detail photo morph (handoff turn 9 §11) ═══
//
// The card's photo is the shared element: it grows from its shelf rect into the
// detail photo panel in ~280ms, the card text fades at 60ms, and the info rail
// wipes in from the photo's inner edge.
//
// This uses the BROWSER's View Transition API and nothing else. Read
// docs/carousel-canonical-state.md before changing it: two earlier morphs in
// this app cloned nodes with getBoundingClientRect(), flew the clones through a
// createPortal overlay to hand-computed landing coordinates, and handed back to
// the real element with a double-rAF plus a polling retry. Both were visibly
// glitchy and both were removed. The rule that came out of it is explicit —
// no clones, no rect measurement, no portal. A view transition satisfies it: the
// browser snapshots the old and new frames itself, so the "shared element" is
// only a matching `view-transition-name` on the two photos. There is no second
// copy of the DOM at any point.
//
// Progressive enhancement, not a dependency. Safari < 18 and Firefox have no
// startViewTransition, and jsdom has none either, so the fallback path is the
// plain state update the app did before this existed. Nothing waits on the
// transition and nothing reads its result.
export const MORPH_NAME_PHOTO = "cz-morph-photo";
export const MORPH_NAME_TEXT = "cz-morph-text";

export function supportsViewTransition() {
  return (
    typeof document !== "undefined" && typeof document.startViewTransition === "function"
  );
}

// Open a detail surface through the photo morph.
//
//   source — the tapped card's nodes: { photo, text }. The photo is the shared
//            element and carries MORPH_NAME_PHOTO; the text block carries
//            MORPH_NAME_TEXT so the CSS can fade it on its own 60ms timing.
//            Either may be missing — a photo-less card still animates its text.
//   update — applies the state change. It must be synchronous, so the caller
//            wraps it in flushSync: the browser captures the new frame the
//            moment this callback returns, and React's default batching would
//            still be holding the update at that point. The browser would
//            snapshot an unchanged DOM and animate nothing.
//
// The source tags are released INSIDE the callback, not after the transition.
// The detail panel's photo stage claims MORPH_NAME_PHOTO when it mounts, and two
// elements sharing one view-transition-name in a single frame makes the browser
// skip the entire transition. So the card owns the name for the old frame and
// hands it over for the new one.
export function runPhotoMorph({ source, update, reduced = false }) {
  const nodes = source || {};
  const pairs = [
    [nodes.photo, MORPH_NAME_PHOTO],
    [nodes.text, MORPH_NAME_TEXT],
  ];
  const tag = () => {
    for (const [el, name] of pairs) {
      if (el && el.style) el.style.viewTransitionName = name;
    }
  };
  const clear = () => {
    for (const [el] of pairs) {
      if (el && el.style) el.style.viewTransitionName = "";
    }
  };
  if (reduced || !supportsViewTransition()) {
    update();
    return Promise.resolve(false);
  }
  tag();
  let transition;
  try {
    transition = document.startViewTransition(() => {
      update();
      clear();
    });
  } catch (err) {
    // Never let a transition failure swallow the navigation itself.
    clear();
    update();
    return Promise.resolve(false);
  }
  // A skipped transition rejects BOTH `ready` and `finished`. We only await
  // `finished`, so `ready` would reject with no handler and the browser would
  // log an unhandled rejection on every fast double tap. Claim it and drop it.
  if (transition.ready && typeof transition.ready.catch === "function") {
    transition.ready.catch(() => {});
  }
  // A skipped transition (a second one started, or a duplicate name slipped
  // through) rejects `finished`. The DOM still updated, so this is not an
  // error — swallow it so the tap cannot throw either, and make sure the tags
  // come off in both outcomes.
  return transition.finished.then(
    () => {
      clear();
      return true;
    },
    () => {
      clear();
      return false;
    }
  );
}

// Touch devices and phone-width screens have no cursor to follow — ambient
// backgrounds render static there (the rAF loop + blur(60px) repaint is pure
// battery/GPU cost on mobile).
export function useCoarsePointer() {
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
    // Callers that hold state behind an Undo (the removal batch) release it
    // here rather than on their own timer. A destructive toast has no timer,
    // so "the toast is gone" is the only honest signal that Undo is over.
    const current = notificationRef.current;
    notificationRef.current = null;
    setNotification(null);
    if (current && current.onDismiss) current.onDismiss();
  };

  const schedule = (duration) => {
    clearTimer();
    if (!duration) return;
    remainingRef.current = duration;
    deadlineRef.current = Date.now() + duration;
    timerRef.current = setTimeout(dismiss, duration);
  };

  const notify = (message, options = {}) => {
    const tone = options.tone || "info";
    const next = {
      id: makeId(),
      message,
      sub: options.sub || null,
      actionLabel: options.actionLabel || null,
      onAction: options.onAction || null,
      onDismiss: options.onDismiss || null,
      tone,
      // A destructive toast is the only route back from a deleted card, so it
      // never expires on its own (toast spec, Kyle 2026-07-26). Callers can
      // still opt out with persistent: false. Routine toasts keep the 5s.
      persistent: options.persistent ?? tone === "destructive",
    };
    // A replacing toast retires the outgoing one, so state parked behind its
    // Undo is released here too — otherwise a "Copied" toast landing on top of
    // a delete toast would strand the removal batch forever.
    const outgoing = notificationRef.current;
    notificationRef.current = next;
    setNotification(next);
    schedule(next.persistent ? 0 : options.duration || 5000);
    if (outgoing && outgoing.onDismiss) outgoing.onDismiss();
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

// Live above-phone check — the detail-panel breakpoint. Above it the expanded
// card is the Fix B panel and the carousel NEVER flips (Kyle 2026-07-26: the
// flip is retired from carousel view; it was reachable at 768–1023px and via
// the Space/F/E flip signal). Below it the phone detail sheet owns detail.
// The flip machinery in CoverFlowCard stays intact and reusable — only this
// gate and the flipRequest wiring keep it dormant.
function useIsWideDetail() {
  const QUERY = "(min-width: 768px)";
  const [wide, setWide] = useState(
    () =>
      typeof window !== "undefined" &&
      !!window.matchMedia &&
      window.matchMedia(QUERY).matches
  );
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(QUERY);
    const onChange = () => setWide(mq.matches);
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);
  return wide;
}

// "Read" is v3-generic vocabulary — a Yupoo album isn't an article. Prefer the
// platform users actually recognize; fall back to the generic type label.
// One-tap findStatus pipeline chips — shared by the edit forms and the mobile
// detail sheet (audit C3). Status meanings per docs/Monetization.md §A3.
// FIND_STATUSES itself lives in credenza-find-status.js (shared with the Ask
// serializer); labels/colors are display-only and stay here.
// Short labels stay for StatusPill / dense chips. Long labels power the 4a
// stage + 4b grouped picker (no bare QC/GL/RL initials on the card back).
export const FIND_STATUS_LABELS = {
  want: "Want",
  bought: "Bought",
  shipped: "Shipped",
  qc: "QC",
  gl: "GL",
  rl: "RL",
  returned: "Returned",
};
export const FIND_STATUS_LONG = {
  want: "Want",
  bought: "Bought",
  shipped: "Shipped",
  qc: "Quality check",
  gl: "Approved · green light",
  rl: "Red light",
  returned: "Returned",
};
export const FIND_STATUS_HINTS = {
  qc: "QC photos requested",
  gl: "Cleared to ship",
  rl: "Rejected — send back or keep",
};
// Human 4-stop track (design 4a). Agent sub-states map into Bought; returned
// sits in the Received slot. Enum stays want|bought|shipped|qc|gl|rl|returned.
export const STATUS_TRACK = ["Want", "Bought", "Shipped", "Received"];
export function statusTrackIndex(status) {
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

// Handoff turn 9 §5. The track shows HOW FAR along an order is; the sub-label
// says WHERE it is right now, in the customer's own words. Both are needed —
// four dots alone cannot tell "bought" from "QC photos are waiting for you".
// Mono, right-aligned in the section header. Read as "STAGE · DETAIL".
export const FIND_STATUS_SUBLABEL = {
  want: "WANT · NOT ORDERED",
  bought: "BOUGHT · WITH THE AGENT",
  shipped: "IN TRANSIT · AGENT → YOU",
  qc: "QC · PHOTOS WAITING",
  gl: "QC PASSED · READY TO SHIP",
  rl: "QC FAILED · YOUR CALL",
  returned: "RECEIVED · DONE",
};

// The one action that moves an order forward, per current stop. A track that
// only reports state makes the customer hunt for the control that changes it.
// `null` means the stop is terminal, or the choice is not ours to make: rl
// (keep or send back) and gl (the agent ships, not the customer) both need a
// real decision, so neither gets a one-tap primary.
export const FIND_STATUS_NEXT = {
  want: { label: "Mark bought", to: "bought" },
  bought: { label: "Mark shipped", to: "shipped" },
  qc: { label: "Approve QC", to: "gl" },
  gl: { label: "Mark shipped", to: "shipped" },
  rl: null,
  shipped: { label: "Mark received", to: "returned" },
  returned: null,
};

// Off-track states (§5: "render as a labelled detour node, not a fifth step").
// These sit UNDER the current dot; they are not stops on the four-stop track.
export const FIND_STATUS_DETOUR = {
  qc: "QC photos",
  rl: "QC failed",
};

export const FIND_STATUS_COLORS = {
  want: { bg: "oklch(0.35 0.02 280)", text: "oklch(0.85 0 0)", dot: "oklch(0.7 0.02 280)" },
  bought: { bg: "oklch(0.35 0.08 250)", text: "oklch(0.9 0.1 250)", dot: "oklch(0.65 0.14 250)" },
  shipped: { bg: "oklch(0.32 0.08 290)", text: "oklch(0.85 0.1 290)", dot: "oklch(0.6 0.14 290)" },
  qc: { bg: "oklch(0.35 0.08 85)", text: "oklch(0.9 0.1 85)", dot: "oklch(0.7 0.14 85)" },
  gl: { bg: "oklch(0.3 0.08 145)", text: "oklch(0.85 0.1 145)", dot: "oklch(0.6 0.14 145)" },
  rl: { bg: "oklch(0.3 0.1 25)", text: "oklch(0.9 0.12 25)", dot: "oklch(0.65 0.18 25)" },
  returned: { bg: "oklch(0.32 0.06 55)", text: "oklch(0.9 0.08 55)", dot: "oklch(0.7 0.12 55)" },
};

// Design 4c: one auto-detected category row. Tap expands a tidy chip list.
// ═══ SHARED CARD PRIMITIVES (standardization 2026-07-22, audit workstream A) ═══
// One renderer per repeated card element. Every surface composes these instead
// of hand-rolling its own copy — FavoriteButton (components/) is the model. Positions
// stay per-surface via className; the *content* is defined exactly once.

export function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

// Deduped cover + gallery list, optionally capped. Single seed expression for
// every photo surface (edit manager, card-back fan, both openPhotos paths).
export function itemPhotoList(item, max) {
  const photos = mergeFashionImages(item.image ? [item.image] : [], item.gallery || []);
  return max == null ? photos : photos.slice(0, max);
}

// Garment categories only — shoes/hats/bags etc. don't map body cm → letter size.
// Declared here so resolveDisplaySize (and SizeRecommendation) can share it.
export const SIZE_PICK_SKIP_CATEGORIES = new Set(["shoes", "hat", "bag", "accessory", "socks"]);

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

export function formatSizeToken(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  const key = s.toLowerCase().replace(/\s+/g, "");
  if (SIZE_WORD_LABELS[key]) return SIZE_WORD_LABELS[key];
  // Pants waist "32" / "W32" stays compact; letter-ish already handled.
  if (/^w?\d{2}(\.\d)?$/i.test(s)) return s.toUpperCase().replace(/^w/i, "W");
  return s.toUpperCase();
}

// Height + weight stand in for the tape-measure fields most customers do not
// know (Kyle 2026-07-25: he set his numbers and got no recommendation
// anywhere — recommendSize only reads chest/waist/hip). The estimate scales
// a reference build (BMI 22) by the customer's BMI: the waist tracks weight
// hardest, the chest least. Measured fields always win. The result is
// flagged `estimated` so no surface calls the pick "precise" and nothing
// persists it over a later measured profile.
export function effectiveBodyProfile(profile) {
  if (!profile || typeof profile !== "object") return null;
  const h = Number(profile.height);
  const w = Number(profile.weight);
  const canEstimate =
    isFinite(h) && h >= 120 && h <= 230 && isFinite(w) && w >= 35 && w <= 250;
  if (!canEstimate) return profile;
  const bmi = Math.min(40, Math.max(16, w / Math.pow(h / 100, 2)));
  const ratio = bmi / 22;
  const half = (n) => Math.round(n * 2) / 2;
  const out = { ...profile };
  let estimated = false;
  if (out.chest == null) {
    out.chest = half(0.52 * h * Math.pow(ratio, 0.6));
    estimated = true;
  }
  if (out.waist == null) {
    out.waist = half(0.45 * h * Math.pow(ratio, 0.85));
    estimated = true;
  }
  if (out.hip == null) {
    out.hip = half(0.47 * h * Math.pow(ratio, 0.7));
    estimated = true;
  }
  if (estimated) out.estimated = true;
  return out;
}

export function computeRecommendedSize(item, bodyProfile, fitPrefs = null) {
  if (!item || !bodyProfile) return null;
  if (SIZE_PICK_SKIP_CATEGORIES.has(item.category)) return null;
  if (item.recommendedSize) return String(item.recommendedSize).trim() || null;
  const chart = parseSizeChart(sizeChartTextFor(item));
  const catPref =
    fitPrefs && item.category && fitPrefs[item.category]
      ? fitPrefs[item.category]
      : null;
  const rec = chart
    ? recommendSize(chart, effectiveBodyProfile(bodyProfile), item.category, catPref)
    : null;
  return rec && rec.size ? String(rec.size).trim() : null;
}

/**
 * Slot-specific usual size from body prefs (tops / bottoms / shoes).
 * Letter usualSize is garment-only — never used for shoes.
 * @returns {string} empty when none
 */
export function usualSizeForItem(item, bodyProfile) {
  if (!item || !bodyProfile) return "";
  const slotKey =
    item.category === "shoes"
      ? "usualShoes"
      : item.category === "pants" || item.category === "shorts"
        ? "usualBottoms"
        : "usualTops";
  const genericOk = !SIZE_PICK_SKIP_CATEGORIES.has(item.category);
  return String(
    (genericOk || slotKey === "usualShoes" ? bodyProfile[slotKey] : "") ||
      (genericOk ? bodyProfile.usualSize : "") ||
      ""
  ).trim();
}

// Card face / grid size line (handoff turn 3 §4): the LABEL says who decided.
//   user set it in Edit        →  SIZE        --cz-sub label, plain; always wins
//   chart found and read       →  AI SIZE     --cz-money label, 700 shimmer value
//   chart, estimated profile   →  AI SIZE ?   amber hedge — honest, not silence
//   no chart, profile usual    →  YOUR USUAL  --cz-faint label, plain, NO shimmer
// "(EST)" is retired: it read like an estimated price. Returns { label,
// value, kind } plus the legacy fields (text, isRec, isEstimate, size, rec)
// that DetailBody and the frozen carousel front still read.
export function resolveDisplaySize(item, bodyProfile, fitPrefs = null) {
  const NONE = { text: "", isRec: false, label: "", value: "", kind: "none" };
  if (!item) return NONE;
  const chosen = String(item.size || "").trim();
  const rec = computeRecommendedSize(item, bodyProfile, fitPrefs);
  if (!chosen && !rec) {
    // Part 5 task 11: slot-specific usual sizes (usualSizeForItem).
    const usual = usualSizeForItem(item, bodyProfile);
    if (usual) {
      const v = formatSizeToken(usual) || usual;
      return {
        label: "YOUR USUAL",
        value: v,
        kind: "usual",
        text: "YOUR USUAL " + v,
        // Not a recommendation: no shimmer (turn 3 §4).
        isRec: false,
        isEstimate: true,
        size: usual,
      };
    }
    return NONE;
  }

  // A size set in Edit always wins over any rec — plain SIZE treatment.
  if (chosen) {
    const v = formatSizeToken(chosen) || chosen;
    const differs = rec && rec.toLowerCase() !== chosen.toLowerCase();
    return {
      label: "SIZE",
      value: v,
      kind: "user",
      text: "SIZE: " + v + (differs ? " (Rec " + rec.toUpperCase() + ")" : ""),
      isRec: false,
      size: chosen,
      rec: rec || undefined,
    };
  }

  const v = formatSizeToken(rec) || rec;
  // Estimated profile (BMI-derived measurements) hedges the pick with "?".
  const estimated = !!(
    bodyProfile && effectiveBodyProfile(bodyProfile).estimated
  );
  if (estimated) {
    return {
      label: "AI SIZE",
      value: v + " ?",
      kind: "hedge",
      text: "AI SIZE " + v + " ?",
      isRec: true,
      size: rec,
      rec,
    };
  }
  return {
    label: "AI SIZE",
    value: v,
    kind: "rec",
    text: "AI SIZE " + v,
    isRec: true,
    size: rec,
    rec,
  };
}

// Size options: listing variants first, then common apparel/shoe sizes.
export function sizeSuggestionsFor(item) {
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

// ═══ UNIFIED EDIT MODEL (standardization 2026-07-22, audit workstream C) ═══
// One draft builder, one patch builder, one write-through model (600ms
// autosave). The shared DetailBody is the only edit surface — draft carries
// only fields with inputs; summary/tags/links/importance/agentLink/findSource
// have no editor and are left untouched.

export function buildEditDraft(item) {
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

export function buildEditPatch(draft, base) {
  const priceText = String(draft.price ?? "").trim();
  const parsed = priceText === "" ? null : Number(priceText);
  const manualPrice = Number.isFinite(parsed) ? parsed : null;
  const currency = String(draft.currency ?? "").trim() || "CNY";
  const priceChanged = manualPrice !== (base.price ?? null);
  const weightText = String(draft.weightGrams ?? "").trim();
  const parsedWeight = weightText === "" ? null : Number(weightText);
  return {
    title: String(draft.title ?? "").trim() || base.title,
    note: String(draft.note ?? "").trim(),
    project: String(draft.project ?? "").trim(),
    // Guard: garbage input becomes null (cleared), never NaN in storage — the
    // pre-unification carousel form saved Number("abc") straight through.
    price: manualPrice,
    currency,
    // A hand-set price invalidates the resolved USD figure. Keep the stale
    // priceUsd and the card shows the OLD converted price forever (Kyle
    // 2026-07-25: "I change it to 60, it doesn't update"). USD edits re-seed
    // it 1:1; CNY falls back to the FX constant until the next resolve.
    priceUsd: priceChanged
      ? /^(USD|\$)$/i.test(currency)
        ? manualPrice
        : null
      : base.priceUsd ?? null,
    // Pin a hand-set price so the next resolve cannot overwrite it. Clearing
    // the price lifts the pin (the resolver may refill it).
    ...(priceChanged ? { priceManual: manualPrice != null } : {}),
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
export function useWriteThroughDraft(draft, onCommit, delay = 600) {
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
export function linkButtons(item, opts = {}) {
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
// Size facts live inside SizeRecommendation now — no second "Sizes" bubble.


// ═══════════════════════════════════════════════════════════════════════════════════
// ═══ MAIN APP ═══
// ═══════════════════════════════════════════════════════════════════════════════════

// LB-11. The framer-motion feature bundle loads through LazyMotion, so it
// lands in its own chunk instead of the entry. `strict` makes a stray
// `motion.` import throw instead of silently re-inflating the entry chunk.
// See `components/motion-features.js` for why this must be `domMax`.
export default function Credenza() {
  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <CredenzaApp />
    </LazyMotion>
  );
}

function CredenzaApp() {
  const [items, setItems] = useState([]);
  // Deleted-card gravestones for cloud sync (LB-7): { id: deletedAtMs }.
  // Without these, a merge that unions two devices resurrects everything the
  // user ever removed. They must outlive a reload, so they persist next to
  // the shelf — a tombstone that only lives in memory is no tombstone at all.
  const [tombstones, setTombstones] = useState({});
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
  // ≥1024px the expanded card is the two-column Fix B panel — no flip.
  const isWideDetail = useIsWideDetail();
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
  // Settings sub-page (Kyle 2026-07-26). Sizes / fit prefs / agent / import
  // used to close their parent and open a SECOND modal — a hard cut, and the
  // way back was Close, not Back. They are now pages inside the same modal:
  // it slides sideways and resizes to the page. One of "sizes" | "fit" |
  // "agent" | "import", or null for the parent page. `settingsSubPage` is
  // the phone Settings sheet's own stack; the two never show at once.
  const [profileSubPage, setProfileSubPage] = useState(null);
  const [settingsSubPage, setSettingsSubPage] = useState(null);
  // Mobile handoff C2/C4 (2026-07-25). The phone masthead collapsed to one
  // row, so search hides behind an icon and the old bottom bar's Agent /
  // Import / Theme rows live in their own ⋯ sheet.
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsSheetOpen, setSettingsSheetOpen] = useState(false);
  // LB-8: the share sheet, open on one named haul. A string, not a boolean —
  // the sheet needs to know WHICH haul, and the name is the haul's identity.
  const [shareHaulName, setShareHaulName] = useState(null);
  // Account (Part 7e): the Supabase session on this device + the decoded
  // entitlement snapshot (plan badge, limits). Both null when signed out or
  // when AUTH_ENABLED is false (env missing → no account UI at all).
  const [accountSession, setAccountSession] = useState(null);
  const [accountPlan, setAccountPlan] = useState(null);
  // The two caps that are NOT daily counters (LB-1, LB-2). A daily counter is
  // re-checked by the server on every call; these two never reach a server, so
  // the client is the only place they can hold. Signed out reads as free.
  const isProPlan = accountPlan
    ? accountPlan.state === "pro" || accountPlan.state === "grace"
    : false;
  const qcPhotoCap = planLimit(accountPlan, "qcPhotosPerItem");
  const haulsCap = planLimit(accountPlan, "haulsMax");
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
  // The first-run intro GATE is gone (onboarding spec, Kyle 2026-07-26): a
  // cold open now lands straight on the hero, because the hero already says
  // what the intro said and the paste field is the only thing to do next.
  // The flag survives because "has this person used Credenza before" still
  // decides one thing — whether their first card ever carries the inline hint.
  // It stays in prefs under the same key so existing users are not re-taught.
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
  // Mobile detail sheet (handoff step 5). On a phone a card tap opens this
  // instead of the carousel overlay; desktop keeps the carousel unchanged.
  const [detailSheetId, setDetailSheetId] = useState(null);
  // §11: the id whose detail surface opened through the photo morph. The
  // surface reads it to claim the shared view-transition-name and to skip its
  // own entrance animation — the morph IS the entrance. Null on every other
  // open (reduced motion, no browser support, keyboard, a deep link).
  const [morphOpenId, setMorphOpenId] = useState(null);
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
  // Bumped every time a removal raises its toast. The toast's onDismiss only
  // empties the batch if its own generation is still current, so deleting a
  // second card — which replaces the toast and dismisses the first — does not
  // discard the batch the second card just joined.
  const undoGenRef = useRef(0);
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
  // Onboarding 3B: the empty hero's paste field, focused on desktop only.
  // A desktop cold open should accept ⌘V immediately. A phone must NOT —
  // focus raises the keyboard, which eats the hero the person came to read.
  const heroFieldRef = useRef(null);
  // Capture sheet's paste box (design handoff PR3). The top capture box only
  // renders on the empty shelf; everywhere else capture focus means "open the
  // sheet and focus its textarea".
  const sheetCaptureRef = useRef(null);
  const topCaptureVisibleRef = useRef(true);
  const askControllerRef = useRef(null);
  const kb = useRef({});
  const reduced = usePrefersReducedMotion();

  const applyUpdate = (fn) => setItems(fn);
  // Record a delete so a later merge does not bring the card back. Undo calls
  // forgetDeleted, which is why the tombstone is not written straight to disk
  // here — the save effect below does that once state settles.
  const markDeleted = useCallback((ids) => {
    const list = Array.isArray(ids) ? ids : [ids];
    if (!list.length) return;
    setTombstones((current) => addTombstones(current, list, Date.now()));
  }, []);
  const forgetDeleted = useCallback((ids) => {
    const list = Array.isArray(ids) ? ids : [ids];
    if (!list.length) return;
    setTombstones((current) => clearTombstones(current, list));
  }, []);
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
    // flashImportResult is re-created per render on purpose (it closes over
    // the notification helpers); the serialized guard above keeps the extra
    // runs free. Listing it would re-stringify the shelf every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canPersist, items]);

  // Gravestones persist beside the shelf. A failed write costs a resurrected
  // card on the next merge, not data — so this one stays quiet.
  useEffect(() => {
    if (!canPersist) return;
    storageBackend.set(TOMBSTONE_KEY, JSON.stringify(tombstones)).catch(() => {});
  }, [canPersist, tombstones]);

  // ————— Cloud sync (LB-7) —————————————————————————————————————————————————————
  //
  // Two halves, deliberately split by plan:
  //
  //   PULL is free. It is the restore story — a person who loses a phone signs
  //   in and their shelf is there. Paywalling that turns a lost phone into
  //   lost data, and no price is worth that.
  //   PUSH is Pro. Keeping two devices in step continuously is the feature the
  //   mock sells, and it is the one that costs us storage.
  //
  // A free account still gets ONE push after a pull, so the merged result is
  // saved rather than dropped. Otherwise the first sign-in on a second device
  // would show the merge and then quietly forget it.
  const shelfStateRef = useRef({ items: [], tombstones: {} });
  shelfStateRef.current = { items, tombstones };
  const syncedOnceRef = useRef(false);
  const pusherRef = useRef(null);
  const signedIn = SYNC_READY && !!accountSession;

  if (SYNC_READY && !pusherRef.current) {
    pusherRef.current = createShelfPusher({ getState: () => shelfStateRef.current });
  }

  // Pull on sign-in, exactly once per session. The shelf on screen is already
  // hydrated from localStorage by now, which is the point: the user never
  // waits on the network to see their own cards.
  useEffect(() => {
    if (!signedIn || !canPersist || syncedOnceRef.current) return;
    syncedOnceRef.current = true;
    let cancelled = false;
    (async () => {
      const remote = await pullShelf();
      if (cancelled) return;
      // "invalid" and "error" both mean: keep local, touch nothing. Only a
      // document we could actually read is allowed to change the shelf.
      if (remote.status !== "ok" && remote.status !== "empty") return;
      const local = shelfStateRef.current;
      const merged = mergeShelves(local, remote.status === "ok" ? remote.doc : null, {
        now: Date.now(),
      });
      if (merged.changedLocal) {
        setItems(merged.items);
        setTombstones(merged.tombstones);
        if (merged.stats.added > 0) {
          notify(
            merged.stats.added +
              (merged.stats.added === 1 ? " card" : " cards") +
              " restored from your account."
          );
        }
      }
      // Save the merge back, free plan included — see the note above.
      if (merged.changedRemote || remote.status === "empty") {
        shelfStateRef.current = { items: merged.items, tombstones: merged.tombstones };
        pusherRef.current?.flush();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, canPersist]);

  // Continuous push: Pro only, debounced, and only after the pull has run —
  // pushing before the merge would overwrite the account with this device's
  // shelf, which is the exact accident tombstones exist to prevent.
  useEffect(() => {
    if (!signedIn || !isProPlan || !canPersist || !syncedOnceRef.current) return;
    pusherRef.current?.schedule();
  }, [signedIn, isProPlan, canPersist, items, tombstones]);

  // A tab closing is the last chance to save. visibilitychange fires on phone
  // app-switch where unload does not, so it is the one that matters.
  useEffect(() => {
    if (!signedIn || !isProPlan) return;
    const flush = () => {
      if (document.visibilityState === "hidden") pusherRef.current?.flush();
    };
    document.addEventListener("visibilitychange", flush);
    return () => document.removeEventListener("visibilitychange", flush);
  }, [signedIn, isProPlan]);

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

  // Onboarding 3B: focus the hero paste field on a desktop cold open, so ⌘V
  // works with no click first. Guarded three ways — desktop width only, the
  // field must exist (it only renders on an empty shelf), and nothing else
  // may already hold focus. `preventScroll` stops Safari from jumping the
  // page to the field and cropping the headline above it.
  useEffect(() => {
    if (!heroFieldRef.current) return;
    if (!window.matchMedia("(min-width: 768px)").matches) return;
    const active = document.activeElement;
    if (active && active !== document.body && active !== heroFieldRef.current) return;
    heroFieldRef.current.focus({ preventScroll: true });
  }, [items.length]);

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
  }, []);
  useEffect(() => {
    if (!haulsHydrated) return;
    storageBackend.set(HAULS_KEY, JSON.stringify(hauls)).catch(() => {});
  }, [hauls, haulsHydrated]);
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
      } catch {}
      // Gravestones for cloud sync (LB-7). Read beside the shelf, swept of
      // anything older than the TTL. A bad read is an empty map, never a
      // reason to fail the load — the shelf itself is what matters here.
      storageBackend
        .get(TOMBSTONE_KEY)
        .then((raw) => {
          const parsed = raw ? JSON.parse(raw) : null;
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            setTombstones(sweepTombstones(parsed, Date.now()));
          }
        })
        .catch(() => {});
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
          // Only brand-new prefs (no prior onboardingDone key) count as a
          // first run. That no longer gates a screen — it gates the one-time
          // hint on the first card. Existing users never see it.
          if (Object.prototype.hasOwnProperty.call(p, "onboardingDone")) {
            setOnboardingDone(p.onboardingDone !== false);
          } else if (raw) {
            setOnboardingDone(true);
          } else {
            setOnboardingDone(false);
          }
        } catch {}
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
        // Fetched title names single-link QC posts; fromPost stays true even
        // when the title is empty so single-link QC still parses as a haul.
        // Author + permalink attach when the body never mentions u/…
        runImport(post.selftext, {
          redditTitle: post.title || "",
          fromPost: true,
          redditAuthor: post.author || "",
          redditUrl: post.url || text,
        });
      } else if (post && post.found === false && post.reason === "no-text") {
        // Link/image post: no item text exists — stash the post itself.
        stash(post.url || text);
      } else {
        // Keep the failed URL in the toast so the user can paste body text
        // without re-finding the post (403/429 fail-open recovery).
        flashImportResult(
          (post && post.error) ||
            "Couldn't read that Reddit post — paste the post text here instead."
        );
      }
      return;
    }
    // Multi-line paste of post body: treat as post text so single-link QC
    // works without a fetch (Import sheet + Capture paste).
    runImport(text, { fromPost: false });
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

  // The Stash sheet's one button (mobile handoff step 4). The sheet already
  // showed the user what this stashes, so the sheet closes on the tap and the
  // toast carries the Undo. A haul keeps runImport's own messaging: it counts
  // the cards it made, which this cannot know before the fetch returns.
  const stashFromSheet = (raw) => {
    const text = (raw || "").trim();
    if (!text) return;
    const result = dispatchStash(text);
    if (result.status === "gated") return; // the gate's toast owns this paste
    setInput("");
    setCaptureSheetOpen(false);
    if (result.status !== "stashed") return;
    beginIndexingJob(result);
    const id = result.id;
    notify("Stashed · " + (result.title || "New item"), {
      tone: "action",
      actionLabel: "Undo",
      onAction: () => {
        applyUpdate((list) => list.filter((x) => x.id !== id));
        markDeleted(id);
        setIndexingJobs((jobs) => jobs.filter((j) => j.id !== id));
      },
      duration: 3000,
    });
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
    } catch {
      let state = "";
      try {
        const p = await navigator.permissions.query({ name: "clipboard-read" });
        state = p.state;
      } catch {}
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
        // Granted ONLY. The old test bailed on "denied", so "prompt" fell
        // through and read the clipboard with no user gesture — the invisible
        // read the mobile handoff bans. No permissions API means no way to
        // prove consent, so that path stays silent too and the plain ＋ Stash
        // pill takes over.
        if (!navigator.permissions || !navigator.permissions.query) {
          if (!cancelled) setClipPreview(null);
          return;
        }
        const perm = await navigator.permissions.query({ name: "clipboard-read" });
        if (!perm || perm.state !== "granted") {
          if (!cancelled) setClipPreview(null);
          return;
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

  // CSV is the export a PERSON opens, not a tool (LB-10). The .json above is a
  // backup you re-import; this one goes into Numbers, Excel or Sheets to total
  // a haul. Pro only, and binary — there is no metered CSV allowance, so the
  // gate is isProPlan, which already reads false when signed out.
  //
  // The labels and the weight estimator are handed in rather than copied into
  // credenza-haul-export.js, so there is only ever one of each.
  const exportShelfCsv = () => {
    if (!isProPlan) {
      notify("CSV export is a Pro feature.", {
        actionLabel: "See Pro",
        onAction: () => setProfileOpen(true),
      });
      return;
    }
    if (!items.length) return;
    downloadHaulCsv(items, {
      statusLabels: FIND_STATUS_LONG,
      weightFor: itemWeightGrams,
    });
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
    const ids = backup.map((x) => x.id);
    applyUpdate(() => []);
    // Clearing is a delete of every card, so every card needs a gravestone.
    // Without them, signing in on another device pours the whole shelf back.
    markDeleted(ids);
    setImportOpen(false);
    notify("Shelf cleared", {
      tone: "destructive",
      sub: backup.length + (backup.length === 1 ? " card deleted." : " cards deleted."),
      actionLabel: "Undo",
      onAction: () => {
        applyUpdate(() => backup);
        forgetDeleted(ids);
      },
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
    // The remote row first, while the session key still exists — the sweep
    // below removes it. A failure here is not a reason to keep local data:
    // the user asked for this device to be clean, and the account sheet's
    // Delete account is the path that guarantees the server side.
    try {
      if (SYNC_READY) await deleteRemoteShelf();
    } catch {}
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
        } catch {}
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
    if (undoExpiryRef.current) {
      clearTimeout(undoExpiryRef.current);
      undoExpiryRef.current = null;
    }
    const gen = ++undoGenRef.current;
    notify("Sample shelf cleared", {
      tone: "destructive",
      sub: records.length + (records.length === 1 ? " card removed." : " cards removed."),
      actionLabel: "Undo",
      onAction: undoRemoved,
      onDismiss: () => {
        if (undoGenRef.current === gen) undoBatchRef.current = [];
      },
    });
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
  // LB-2: free holds 2 hauls, Pro holds 100. A haul is not a record the user
  // creates; it is the set of distinct `project` names across the shelf. So
  // "creating a haul" is writing a project name that no card carries yet, and
  // that is the only thing this refuses.
  //
  // WARNING: this caps CREATION only. A user who already has more hauls than
  // the cap — from a downgrade, or from an import — keeps every one of them,
  // and can still move cards between them. Never lock or delete an existing
  // haul.
  // LB-58. The cap counts ACTIVE hauls. It used to count every name on the
  // shelf, which made the free plan's own message a lie: "Archive one to start
  // another" was the Pro copy, /how/ says "archive a finished haul and the
  // shelf stays clean", and archiving freed nothing. A haul is a parcel — it
  // ends when the parcel ships — so a shelf with two shipped hauls and no way
  // to start a third is a dead end, not a limit.
  //
  // Only a haul with an explicit archived record is excluded. A name with no
  // record at all still counts, because that is the common case: the board
  // creates the record on first save, so most hauls exist as project strings.
  const blockNewHaul = (name) => {
    const clean = String(name || "").trim();
    if (!clean || haulNames.includes(clean)) return false;
    const archivedNames = new Set(hauls.filter((h) => h.archived).map((h) => h.name));
    const activeHauls = haulNames.filter((n) => !archivedNames.has(n));
    if (activeHauls.length < haulsCap) return false;
    notify(
      // Both halves say the same way out, because after LB-58 both halves have
      // one. Telling a free user only about Pro hides the free fix.
      isProPlan
        ? haulsCap + " open hauls is the limit. Archive a finished one to start another."
        : haulsCap +
          " open hauls on Free. Archive a finished one to start another, or Pro holds " +
          PRO_LIMITS.haulsMax +
          ".",
      isProPlan ? {} : { actionLabel: "See Pro", onAction: () => setProfileOpen(true) }
    );
    return true;
  };
  const saveEdit = (id, patch) => {
    if (patch && typeof patch === "object" && typeof patch.project === "string") {
      // Refuse the haul, keep the rest of the edit. A user renaming a card and
      // picking a third haul in one save should still get the rename.
      if (blockNewHaul(patch.project)) {
        const { project, ...rest } = patch;
        patch = rest;
        if (!Object.keys(patch).length) return;
      }
    }
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
    } catch {
      flashImportResult("Couldn't read that image.");
    }
  };
  const attachGalleryImage = async (id, file) => {
    if (!file) return;
    try {
      const dataUrl = await compressImageBlob(file);
      updateItem(id, (x) => ({ gallery: [...(x.gallery || []), dataUrl].slice(0, GALLERY_MAX) }));
    } catch {
      flashImportResult("Couldn't read that gallery image.");
    }
  };
  // QC photos are NOT gallery photos (docs/Monetization.md A5): the gallery is
  // what the seller shows, QC is what the agent found. §9's QC prompt writes
  // here so a warehouse photo never contaminates the product gallery.
  const attachQcImage = async (id, file) => {
    if (!file) return;
    // LB-1: free gets 4 QC photos an item, Pro gets 12 (the free row of
    // PLAN_LIMITS). The check runs BEFORE the compress, so a user at the cap
    // never waits on a read whose result we would throw away.
    //
    // WARNING: this caps ADDITIONS only. An item that already holds more than
    // the cap keeps every photo — a plan that downgrades must never delete a
    // customer's pictures.
    const current = (items.find((x) => x.id === id) || {}).qcPhotos || [];
    if (current.length >= qcPhotoCap) {
      notify(
        isProPlan
          ? "That is " + qcPhotoCap + " QC photos on this item — remove one to add another."
          : qcPhotoCap +
            " QC photos an item on Free. Pro holds " +
            PRO_LIMITS.qcPhotosPerItem +
            ".",
        isProPlan
          ? {}
          : { actionLabel: "See Pro", onAction: () => setProfileOpen(true) }
      );
      return;
    }
    try {
      const dataUrl = await compressImageBlob(file);
      updateItem(id, (x) => ({
        // QC_PHOTOS_STORED, not the plan cap: the guard above already refused
        // an add over the plan cap, so this second bound only stops a stored
        // array growing without limit. Slicing to the plan cap here would
        // delete the grandfathered photos the guard is written to protect.
        qcPhotos: [...(x.qcPhotos || []), dataUrl].slice(0, QC_PHOTOS_STORED),
      }));
    } catch {
      flashImportResult("Couldn't read that QC photo.");
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
      return { image: dataUrl, gallery: nextGallery.slice(0, GALLERY_MAX) };
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
      // GET, not POST. A POST is never CDN-cacheable, so the old shape spent
      // one function invocation per image PER CUSTOMER, every time. The query
      // string is the cache key, so a popular album is relayed once for
      // everyone. See the caching note in netlify/functions/preview.js.
      const query =
        "?url=" + encodeURIComponent(url) + (referer ? "&referer=" + encodeURIComponent(referer) : "");
      const res = await monitoredFetch(storageBackend, "preview", PREVIEW_ENDPOINT + query, {
        method: "GET",
        headers: { "x-credenza-key": PREVIEW_SECRET },
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const blob = await res.blob();
      if (!/^image\//.test(blob.type || "")) return null;
      return await compressImageBlob(blob);
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener("abort", abort);
    }
  };

  // Seeds the full-screen album: the stored images first, then the Yupoo
  // album relayed to data URLs (photo.yupoo.com hotlinks refuse to render
  // cross-origin). Restored 2026-07-25 with the gallery (Kyle: bring back
  // the old swipe-through photos).
  const loadAlbumPhotos = async (item, { signal } = {}) => {
    const isHotlink = (src) => /^https?:\/\/photo\.yupoo\.com\//i.test(src || "");
    const existing = mergeFashionImages(
      item.image ? [item.image] : [],
      item.gallery || []
    ).filter((src) => !isHotlink(src));
    const albumUrl = yupooAlbumUrl(item);
    // RELAY_MAX, not GALLERY_MAX: an item already holding six relayed photos
    // asks for no more, even though it has room to store twenty.
    if (!albumUrl || existing.length >= RELAY_MAX) return existing.slice(0, GALLERY_MAX);
    const data = await fetchYupooImages(albumUrl, { signal });
    if (!data || (signal && signal.aborted)) return existing.slice(0, GALLERY_MAX);

    const photos = [...existing];
    for (const src of mergeFashionImages(data.images || [])) {
      if (photos.length >= RELAY_MAX || (signal && signal.aborted)) break;
      const dataUrl = await relayImageDataUrl(src, data.url || albumUrl, signal);
      if (dataUrl) photos.push(dataUrl);
    }
    const merged = mergeFashionImages(photos).slice(0, GALLERY_MAX);
    if (!(signal && signal.aborted)) {
      updateItem(item.id, (current) => ({
        image: current.image || merged[0] || null,
        gallery: mergeFashionImages(
          current.gallery || [],
          merged.filter((src) => src !== current.image)
        ).slice(0, GALLERY_MAX),
        albumPhotoCount:
          typeof data.photoCount === "number" && data.photoCount > 0
            ? data.photoCount
            : current.albumPhotoCount || 0,
      }));
    }
    return merged;
  };

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
    } catch {
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
      // fashionDisplayTitle already junk-guards every candidate, data.title
      // included — no raw fallback (it bypassed the guard for "<UNKNOWN>").
      const resolvedTitle = fashionDisplayTitle(data);
      // Keep human Reddit/haul labels over bare seller SKUs (Kyle 2026-07-25).
      const nextTitle =
        preserveTitle || (yupooAlbumUrl(item) && !data.translated)
          ? x.title
          : preferCardTitle({
              currentTitle: x.title,
              resolvedTitle,
              claudeTitle: data.translated ? resolvedTitle : "",
            }) || x.title;
      const variants = Array.isArray(data.variantGroups)
        ? data.variantGroups.map((group) => ({
            title: group.title || "",
            values: (group.values || []).map((value) => (value && value.name) || String(value)),
          }))
        : x.variants;
      const weightFromText =
        x.weightGrams ||
        extractWeightGramsFromText(
          [x.note, x.title, nextTitle, data.summary, data.sizeNotes].filter(Boolean).join(" ")
        ) ||
        null;
      return {
        status: "ready",
        title: nextTitle,
        summary: data.summary || x.summary,
        // A hand-set price is pinned (priceManual): the resolve refreshes
        // everything else but never overwrites the customer's own number.
        price: x.priceManual ? x.price : data.priceCny != null ? data.priceCny : x.price,
        currency: "CNY",
        priceUsd: x.priceManual ? x.priceUsd : data.priceUsd != null ? data.priceUsd : x.priceUsd,
        category: CATEGORIES[data.category]
          ? data.category
          : x.category ||
            guessFashionCategory([data.title, data.summary, data.sizeNotes, x.title, x.summary].filter(Boolean).join(" ")),
        variants,
        // First color axis value only when the card has no colorway yet.
        colorway: x.colorway || pickColorwayFromVariants(variants) || "",
        sizeNotes: data.sizeNotes || x.sizeNotes,
        descImages: Array.isArray(data.descImages) && data.descImages.length ? data.descImages : x.descImages,
        sellerYupooLinks:
          Array.isArray(data.sellerYupooLinks) && data.sellerYupooLinks.length
            ? data.sellerYupooLinks
            : x.sellerYupooLinks,
        weightGrams: weightFromText,
        image: cover,
        gallery: mergeFashionImages(
          x.gallery || [],
          remoteImages.filter((src) => src !== cover)
        ).slice(0, GALLERY_MAX),
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
          // RELAY_MAX: every image in this list gets relayed below, one
          // function invocation each, so the cap on the list IS the cost cap.
          const albumImages = mergeFashionImages(data.images || []).slice(0, RELAY_MAX);
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
            ).slice(0, GALLERY_MAX),
            // What the album really holds, not what we stored. The card label
            // reads this so "View album · N photos" is honest.
            albumPhotoCount:
              typeof data.photoCount === "number" && data.photoCount > 0
                ? data.photoCount
                : (data.images || []).length,
            // Charts are held out of the gallery but still fed to the size hunt.
            chartImages: Array.isArray(data.chartImages) && data.chartImages.length
              ? data.chartImages.slice(0, 8)
              : item.chartImages || [],
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
                gallery: mergeFashionImages(retained, galleryImages).slice(0, GALLERY_MAX),
              };
            });
          }

          const handled = await resolvePromise;
          if (!handled) updateEnrichedItem(item.id, token, { status: "ready" });
          return true;
        }
      }

      const handled = await resolveBuyDetails(item, {
        token,
        signal: controller.signal,
        // Same policy as the Yupoo→buy path: keep human haul labels over SKUs.
        preserveTitle: !shouldReplaceFashionTitle(item.title, item.url),
      });
      if (!handled && !controller.signal.aborted) {
        await fetchAutomaticImage(item, token);
        updateEnrichedItem(item.id, token, { status: "ready" });
      }
      return handled;
    } catch {
      // A failed enhance must never strand the card in the Inbox. Keep the
      // link-only card on the shelf, the same outcome resolveBuyDetails
      // uses for a dead page (Kyle 2026-07-25: a 20-link paste left 3 cards
      // spinning on "Enhancing…" forever).
      if (!controller.signal.aborted && enrichmentTokensRef.current.get(item.id) === token) {
        updateEnrichedItem(item.id, token, { status: "ready" });
      }
      return false;
    } finally {
      if (enrichmentTokensRef.current.get(item.id) === token) {
        enrichmentTokensRef.current.delete(item.id);
        enrichmentControllersRef.current.delete(item.id);
      }
    }
  };

  const enrichFashionItems = async (list, concurrency = 3) => {
    // One throwing item must not kill its worker and strand the rest of the
    // queue — the whole paste enhances, three at a time.
    await runPool(list, enrichFashionItem, concurrency);
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
    // An agent front (Fansbuy item-micro, Superbuy ?url=, …) is NOT a canonical
    // link. Older items stored the front verbatim, so Buy re-opened the other
    // agent and lost the wrap. Unwrap first; the agent wrap below then applies.
    const url = ensureYupooAlbumUid(marketplaceBuyUrl(targetUrl || item.url));
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
  // §8: the Buy notch picks the agent where the choice matters. It uses the
  // same guard as the Profile agent sheet — a retired agent never becomes the
  // default, whatever the caller sends.
  const chooseBuyingAgent = useCallback((id) => {
    const a = getAgent(id);
    if (a && !a.retired) setPreferredAgent(a.id);
  }, []);
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
    // Lift the gravestones too. Restoring the card without clearing its
    // tombstone means the next merge deletes it a second time, and the user
    // never asked for that.
    forgetDeleted(batch.map((record) => record.item.id));
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
    markDeleted(id);
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
    // No expiry timer any more (toast spec, Kyle 2026-07-26). The destructive
    // toast does not fade, so the batch lives exactly as long as the toast
    // does and releases in onDismiss below. A 6.2s timer against a toast that
    // never closes would leave a visible Undo button that quietly does nothing.
    if (undoExpiryRef.current) {
      clearTimeout(undoExpiryRef.current);
      undoExpiryRef.current = null;
    }
    const count = undoBatchRef.current.length;
    const gen = ++undoGenRef.current;
    notify(count === 1 ? "Card removed" : count + " cards removed", {
      tone: "destructive",
      sub: count === 1 ? removed.item.title : "Undo puts them back where they were.",
      actionLabel: "Undo",
      onAction: undoRemoved,
      onDismiss: () => {
        if (undoGenRef.current === gen) undoBatchRef.current = [];
      },
    });
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

  // The "Stash this tab" button left with the old Stash sheet (mobile handoff
  // step 4 — the sheet shows one paste and one button now). The extension
  // still stashes pages: its context menu queues them, and consumePending
  // above drains that queue.

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
      // LB-42. askState.error renders below the Ask box verbatim, and ask.js
      // answers a failure with "Anthropic rate limit reached; try again
      // shortly", "Anthropic rejected the configured API key", and
      // "Server not configured: missing ANTHROPIC_API_KEY". Those name our
      // vendor and our environment to somebody who can act on neither.
      // safeErrorMessage keeps the daily-cap line, which is the one message a
      // free user needs, and replaces the rest by status code.
      if (!res.ok) {
        const err = new Error(safeErrorMessage(res.status, payload && payload.error, "Cloud Ask"));
        err.serverError = payload && payload.error;
        throw err;
      }
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
  // The intro gate is deleted (onboarding spec, Kyle 2026-07-26). Nothing
  // stands in front of the app now, so every "hide this while the intro is up"
  // condition below collapses to false. Kept as a named constant rather than
  // deleted inline: the surrounding conditions read as one rule this way.
  const firstRunIntro = false;
  // A person who has never used Credenza gets ONE inline hint, on the first
  // card that lands. It is not a tour and it is not dismissible chrome — it
  // fades in under the card and leaves the moment they flip it.
  const showFirstCardHint = !onboardingDone;
  // Opening any card is the proof they read the hint, so the hint retires
  // itself there. `onboardingDone` persists in prefs under its original key,
  // so this is a one-time event per browser, not per session.
  const retireFirstCardHint = () => {
    if (!onboardingDone) setOnboardingDone(true);
  };
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
    // Desktop browses a haul in the carousel. The phone keeps its grid — the
    // rack does not fit a 390px screen, and hijacking viewMode stranded the
    // customer in a glitching carousel until an app restart (Kyle 2026-07-25).
    if (!isPhone) setViewMode("carousel");
    setExpandedId(null);
    setSelectedId(null);
    setActiveHaul(haulKey);
  }, [isPhone]);

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
    () => sumItemsUsd(totalsItems, { excludeReturned: !!openHaulName }),
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

  // ── Shared hauls (LB-8) ──────────────────────────────────────────────────
  // The cards a share covers: the whole haul, never the search-narrowed view.
  // A person who searched "hoodie" and then tapped Share meant to share the
  // haul, not their search. Newest first, because the cap keeps the first 60.
  const shareItemsFor = useCallback(
    (haulName) => {
      const name = String(haulName || "").trim();
      if (!name) return [];
      return items
        .filter((item) => item.status === "ready" && typeof item.project === "string" && item.project.trim() === name)
        .slice()
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .map((item) => ({
          ...item,
          // The snapshot takes priceUsd only. A CNY card carries `price` and a
          // null priceUsd until enrichment fills it, so the shared page would
          // print nothing where the shelf prints a number. Normalize here,
          // where the FX fallback already lives.
          priceUsd: itemUsdAmount(item),
        }));
    },
    [items]
  );

  const shareHaulItems = useMemo(
    () => (shareHaulName ? shareItemsFor(shareHaulName) : []),
    [shareHaulName, shareItemsFor]
  );

  // Build, post, answer with the URL. Throws with the server's message so the
  // sheet can print it — an over-cap or offline share is a normal outcome.
  const createHaulShare = useCallback(
    async (options) => {
      const session = await getValidSession();
      if (!session) {
        setAccountSession(null);
        throw new Error("Your sign-in expired — sign in again first.");
      }
      const now = Date.now();
      const doc = buildShareSnapshot(shareItemsFor(shareHaulName), {
        fields: options.fields,
        title: shareHaulName,
        now,
      });
      const result = await createShare(session.accessToken, {
        code: makeShareCode(),
        doc,
        unlisted: options.unlisted,
        hideFooter: options.hideFooter,
        expiresAt: expiryFromDays(options.expiryDays, now),
      });
      return result.url;
    },
    [shareHaulName, shareItemsFor]
  );

  // Profile → Shared links. The list comes from the server, because a link
  // made on a phone must be deletable from a laptop and the shelf has never
  // held the codes. The server sends the code alone; the URL is built here,
  // against this origin, so a preview build lists preview links.
  const listHaulShares = useCallback(async () => {
    const session = await getValidSession();
    if (!session) {
      setAccountSession(null);
      throw new Error("Your sign-in expired — sign in again first.");
    }
    const rows = await listShares(session.accessToken);
    const origin =
      typeof window !== "undefined" && window.location ? window.location.origin : undefined;
    return rows.map((row) => ({ ...row, url: shareUrl(row.id, origin) }));
  }, []);

  const deleteHaulShare = useCallback(async (code) => {
    const session = await getValidSession();
    if (!session) {
      setAccountSession(null);
      throw new Error("Your sign-in expired — sign in again first.");
    }
    return deleteShare(session.accessToken, code);
  }, []);

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
  // flip requests down to the right card.
  const [flipRequest, setFlipRequest] = useState(null);
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
        // E opens the back for editing (tap a cell there). No toggle: E is an
        // "I want to edit" intent, so an already-open back stays open.
        if (e.key === "e") {
          e.preventDefault();
          setSelectedId(sel.id);
          if (!carouselPresented) {
            openInCarouselRef.current(sel.id);
            return;
          }
          if (ctx.expandedId !== sel.id) {
            setExpandedId(sel.id);
            setFlipRequest(sel.id + ":" + Date.now());
          }
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
    retireFirstCardHint();
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
    // Focus the dialog root, not the first button: with the close button
    // focused, Space natively "clicked" it and closed the overlay — Kyle
    // expects Space to flip the card (2026-07-25). Tab still reaches every
    // control; the root needs tabIndex -1 to take focus.
    root.focus();
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
      if (
        e.shiftKey &&
        (!inside || document.activeElement === firstEl || document.activeElement === root)
      ) {
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

  // §11: a card tap opens the detail through the photo morph. The card hands up
  // its photo node; that node carries the shared view-transition-name for the
  // one frame the browser needs to snapshot it, then gives it back.
  //
  // flushSync is required, not defensive. startViewTransition captures the "new"
  // frame as soon as its callback returns, and React's default batching would
  // still be holding the state update at that moment — the browser would
  // snapshot the unchanged DOM and animate nothing.
  const openWithMorph = (id, nodes) => {
    // A morph only runs when the browser can do one. The detail surface's own
    // entrance and the morph are two answers to the same question, so the
    // surface stands down for exactly the opens the morph handles.
    const morphing =
      !reducedMotion && supportsViewTransition() && !!(nodes && nodes.photo);
    runPhotoMorph({
      source: nodes,
      reduced: reducedMotion,
      update: () => {
        // The morph flag is set INSIDE this flush, with the open itself. Setting
        // it before startViewTransition looks equivalent and is not: React
        // commits it while no detail surface is mounted yet, the cleanup effect
        // below sees an id with no surface, and clears the flag again before the
        // panel ever reads it. The panel then mounts unnamed, the browser finds
        // no "new" snapshot to pair with the card photo, and the morph silently
        // degrades to a cross-fade — verified by probe-turn9-morph.mjs, which
        // reported old(cz-morph-photo) with no matching new().
        flushSync(() => {
          setMorphOpenId(morphing ? id : null);
          if (isPhone) setDetailSheetId(id);
          else openInCarousel(id);
        });
      },
    });
  };

  const renderEntry = (item) => (
    <div key={item.id}>
      <Card
        item={item}
        selected={selectedId === item.id}
        // Both halves of a 2026-07-26 merge. `main` retired the onboarding
        // hint on the first card tap; the branch routed the open through the
        // photo morph. The morph owns the open (phone sheet or carousel), so
        // the hint retires alongside it rather than duplicating that choice.
        onToggle={(nodes) => {
          retireFirstCardHint();
          openWithMorph(item.id, nodes);
        }}
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
  const renderCarousel = (carouselItems, opts) => (
    <CoverFlowCarousel
      items={carouselItems}
      sizeScale={opts && opts.sizeScale}
      expandedId={isWideDetail ? null : expandedId}
      selectedId={selectedId}
      // The flip signal sets `flipped` inside the card directly, bypassing the
      // expandedId gate — pressing E (or Space) flipped a rack card UNDER the
      // open panel. Withhold it whenever the panel owns detail; the prop stays
      // wired so the phone / future reuse path still works.
      flipRequest={isWideDetail ? null : flipRequest}
      haulNames={haulNames}
      onDelete={setPendingDeleteId}
      onSaveEdit={saveEdit}
      onOpen={recordOpen}
      buyLabel={buyLabel}
      preferredAgent={preferredAgent}
      onSelectAgent={chooseBuyingAgent}
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
        notify("Sizes updated.");
      }}
      fitPromptSkipped={fitPromptSkipped}
      onSkipFitPrompt={() => setFitPromptSkipped(true)}
      fitPrefs={fitPrefs}
      onSaveFitPref={saveFitPref}
      onOpenSizes={() => setBodySheetOpen(true)}
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

  // Fix B: the card a rack tap would flip — at ≥1024px it opens as the
  // two-column panel instead (renderCarousel gets expandedId=null there).
  const expandedItem = expandedId
    ? listItems.find((x) => x.id === expandedId) ||
      items.find((x) => x.id === expandedId) ||
      null
    : null;

  // Fix B (handoff turn 4): the two-column no-flip detail panel at ≥1024px.
  // Shared by the grid-tap overlay and the rack-tap expansion — same item,
  // same actions, only the close target differs.
  const renderDetailPanel = (panelItem, onClose, closing) => (
    <DesktopDetailPanel
      item={panelItem}
      haulNames={haulNames}
      bodyProfile={bodyProfile}
      fitPrefs={
        panelItem.category && fitPrefs
          ? { [panelItem.category]: fitPrefs[panelItem.category] }
          : null
      }
      measureUnits={measureUnits}
      buyLabel={buyLabel}
      preferredAgent={preferredAgent}
      onSelectAgent={chooseBuyingAgent}
      onSaveEdit={saveEdit}
      onOpen={recordOpen}
      onAttachPhoto={attachGalleryImage}
      onRemovePhoto={removePhotoBySrc}
      onOpenSizes={() => setBodySheetOpen(true)}
      onSetPrimaryImage={setPrimaryImage}
      onLoadPhotos={loadAlbumPhotos}
      onToggleFavorite={toggleFavorite}
      onDelete={setPendingDeleteId}
      onClose={onClose}
      closing={closing}
      // §11: true only when this panel arrived through the photo morph.
      morphing={morphOpenId === panelItem.id}
      shelfItems={items}
    />
  );

  // §11: the morph flag lives exactly as long as the surface it opened, so a
  // later keyboard open of the SAME card cannot inherit it, skip its own
  // entrance, and appear with no animation at all.
  //
  // The condition is "no surface is open", NOT "no surface has this id". The
  // stricter test clears the flag in the gap between setting it and the surface
  // mounting, which is the whole window the morph needs it in. A different card
  // opening overwrites the flag in its own flush, so the loose test is enough.
  useEffect(() => {
    if (!morphOpenId) return;
    if (detailSheetId || carouselOverlay) return;
    setMorphOpenId(null);
  }, [morphOpenId, detailSheetId, carouselOverlay]);

  // The sheet closes itself when its card leaves the shelf (Undo expiry, a
  // filter change, a delete), so a stale id can never render an empty sheet.
  const detailItem = detailSheetId
    ? items.find((x) => x.id === detailSheetId) || null
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

      {/* Onboarding 3B: the one and only hint (onboarding spec, Kyle
          2026-07-26). It waits for the first card to exist, sits in flow under
          it, and leaves for good the moment that card is flipped. Two facts
          only — what a tap does, and who takes the money. No tour, no dots,
          no dismiss button to argue with. */}
      {showFirstCardHint && items.length > 0 && (
        <p className="cz-first-hint">
          Tap the card for sizing and QC. Buy opens your agent — Credenza never
          takes payment.
        </p>
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

  // Settings sub-page bodies (Kyle 2026-07-26). Each returns the same sheet
  // component in `embedded` mode: the body only, because the modal stack
  // already owns the shell, the title, and the back button. `maxWidth` is
  // what the modal tweens to — the measurements page is wider than Profile,
  // which is the resize Kyle asked for.
  const buildSubPage = (key, back) => {
    if (!key) return null;
    const page = (title, width, node) => ({ key, title, maxWidth: width, node });
    if (key === "sizes")
      return page(
        "Your measurements",
        560,
        <Suspense fallback={null}>
          <BodyProfileSheet
            value={bodyProfile}
            units={measureUnits}
            onSave={(profile) => {
              setBodyProfile(profile);
              notify("Sizes updated.");
            }}
            onChangeUnits={setMeasureUnits}
            onClose={back}
            embedded
          />
        </Suspense>
      );
    if (key === "fit")
      return page(
        "Fit preferences",
        440,
        <Suspense fallback={null}>
          <FitPrefsSheet
            value={fitPrefs}
            ownedCategories={ownedFitPrefCategories}
            onSave={(draft) => {
              setFitPrefsByCat((prev) => ({ ...(prev || {}), ...(draft || {}) }));
              notify("Fit preferences updated.");
            }}
            onClose={back}
            embedded
          />
        </Suspense>
      );
    if (key === "agent")
      return page(
        "Buying agent",
        520,
        <Suspense fallback={null}>
          <AgentSheet
            preferredAgent={preferredAgent}
            onSelectAgent={(id) => {
              const a = getAgent(id);
              if (a && !a.retired) setPreferredAgent(a.id);
            }}
            storageBackend={storageBackend}
            onClose={back}
            embedded
          />
        </Suspense>
      );
    if (key === "import")
      return page(
        "Import & backup",
        520,
        <Suspense fallback={null}>
          <ImportSheet
            items={items}
            hasSamples={hasSamples}
            onImport={runImport}
            onAddSamples={addSamples}
            onClearSamples={clearSamples}
            onClose={back}
            onExport={exportShelf}
            onExportCsv={exportShelfCsv}
            isPro={isProPlan}
            onClearShelf={clearShelf}
            onRestore={restoreBackup}
            embedded
          />
        </Suspense>
      );
    if (key === "links")
      return page(
        "Shared links",
        480,
        <Suspense fallback={null}>
          <SharedLinksSheet
            onList={listHaulShares}
            onDelete={deleteHaulShare}
            onCopy={copyLink}
            onClose={back}
            embedded
          />
        </Suspense>
      );
    return null;
  };

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
          onExportCsv={exportShelfCsv}
          isPro={isProPlan}
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
          onSave={(profile) => {
            setBodyProfile(profile);
            notify("Sizes updated.");
          }}
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
            notify("Fit preferences updated.");
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
          onStash={stashFromSheet}
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
          onOpenAgent={() => setProfileSubPage("agent")}
          pricePrimary={pricePrimary}
          onCycleCurrency={() => setPricePrimary((v) => (v === "CNY" ? "USD" : "CNY"))}
          fitSummary={fitSummary}
          onToggleFitSummary={() => setFitSummary((v) => !v)}
          fitDetail={fitDetail}
          onCycleFitDetail={() => setFitDetail((v) => (v === "detailed" ? "concise" : "detailed"))}
          onOpenSizes={() => setProfileSubPage("sizes")}
          onOpenFitPrefs={() => setProfileSubPage("fit")}
          onOpenImport={() => setProfileSubPage("import")}
          onOpenSharedLinks={() => setProfileSubPage("links")}
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
          full={!isPhone}
          subPage={buildSubPage(profileSubPage, () => setProfileSubPage(null))}
          onBack={() => setProfileSubPage(null)}
          onClose={() => {
            setProfileOpen(false);
            setProfileSubPage(null);
          }}
        />
        </Suspense>
      )}

      {/* Settings sheet (mobile handoff step 3): the phone's ⋯ menu owns the
          look-and-fit rows. Phone only — desktop has no ⋯ button and keeps
          every row in the profile sheet (full=true). */}
      {settingsSheetOpen && (
        <Suspense fallback={null}>
        <SettingsSheet
          mode={mode}
          onCycleTheme={() => setTheme(mode === "light" ? "rainbow" : "light")}
          onOpenSizes={() => setSettingsSubPage("sizes")}
          onOpenFitPrefs={() => setSettingsSubPage("fit")}
          fitSummary={fitSummary}
          onToggleFitSummary={() => setFitSummary((v) => !v)}
          fitDetail={fitDetail}
          onCycleFitDetail={() => setFitDetail((v) => (v === "detailed" ? "concise" : "detailed"))}
          accountEnabled={AUTH_ENABLED}
          accountSession={accountSession}
          accountPlan={accountPlan}
          onOpenAccount={() => {
            setSettingsSheetOpen(false);
            setSettingsSubPage(null);
            setProfileOpen(true);
          }}
          subPage={buildSubPage(settingsSubPage, () => setSettingsSubPage(null))}
          onBack={() => setSettingsSubPage(null)}
          onClose={() => {
            setSettingsSheetOpen(false);
            setSettingsSubPage(null);
          }}
        />
        </Suspense>
      )}

      {/* Share a haul (LB-8). One sheet, opened on one named haul. It holds
          the draft toggles; the app owns the network call, because the sheet
          must never see a token. */}
      {shareHaulName && (
        <Suspense fallback={null}>
          <ShareSheet
            haulName={shareHaulName}
            itemCount={shareHaulItems.length}
            isPro={isProPlan}
            signedIn={AUTH_ENABLED && !!accountSession}
            onCreate={createHaulShare}
            onCopy={copyLink}
            onUpgrade={() => {
              setShareHaulName(null);
              setProfileOpen(true);
            }}
            onClose={() => setShareHaulName(null)}
          />
        </Suspense>
      )}

      {/* Mobile detail sheet (handoff step 5): one surface for reading AND
          editing. No edit mode, no Save button — every value is its own tap
          target and each edit writes through the shared 600ms debounce. */}
      {/* No Suspense boundary: DetailSheet is a static import now (see §11 at
          the import). A boundary here would defer the first render by a tick
          again and take the morph's landing element with it. */}
      {isPhone && detailItem && (
        <DetailSheet
          key={detailItem.id}
          item={detailItem}
          shelfItems={items}
          haulNames={haulNames}
          bodyProfile={bodyProfile}
          fitPrefs={fitPrefs}
          measureUnits={measureUnits}
          buyLabel={buyLabel}
          preferredAgent={preferredAgent}
          onSelectAgent={chooseBuyingAgent}
          onSaveEdit={saveEdit}
          onRemove={remove}
          onOpen={recordOpen}
          onAttachPhoto={attachGalleryImage}
          onRemovePhoto={removePhotoBySrc}
          onSetCover={setPrimaryImage}
          onToggleFavorite={toggleFavorite}
          onAttachQcPhoto={attachQcImage}
          onLoadPhotos={loadAlbumPhotos}
          onOpenSizes={() => {
            setDetailSheetId(null);
            setBodySheetOpen(true);
          }}
          onClose={() => setDetailSheetId(null)}
          morphing={morphOpenId === detailItem.id}
        />
      )}

      {/* Grid/list card popup only — carousel stays in-rack (Kyle 2026-07-23).
          Close (✕ / scrim at rest / Escape) plays is-closing, then unmounts.
          At ≥1024px the popup IS the two-column Fix B panel — no solo flip card. */}
      {carouselOverlay && overlayItem && viewMode !== "carousel" && (
        isWideDetail ? (
          renderDetailPanel(overlayItem, closeCarouselOverlay, overlayPhase === "closing")
        ) : (
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
          tabIndex={-1}
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
            {/* Solo card: 15% smaller than the rack card (Kyle 2026-07-25).
                The CSS width in .cz-carousel-overlay matches this scale. */}
            {renderCarousel([overlayItem], { sizeScale: 0.85 })}
          </div>
        </div>
        )
      )}

      {/* Fix B rack path: a center-card tap at ≥1024px opens the two-column
          panel above the rack (the rack itself never flips — it gets
          expandedId=null). */}
      {isWideDetail && !carouselOverlay && expandedItem
        ? renderDetailPanel(expandedItem, () => setExpandedId(null), false)
        : null}

      <div className="cz-shell">
        {/* Chrome column: centered + max-width'd on desktop (Kyle 2026-07-22 —
            full-bleed capture/search/tabs on a wide monitor read as sprawl).
            The carousel/grid panels below stay full-width. */}
        <div className="cz-chrome">
        {/* Phone masthead is ONE row (mobile handoff C2): mark + wordmark, a
            flex spacer, then Search / ⋯ Settings / Account. The 45%-viewport
            hero still drops once the shelf has items — that plus the merged
            tabs/totals row is ~150px, the difference between zero cards and
            one-and-a-half rows above the fold.
            "Fashion" no longer drops (logo spec, Kyle 2026-07-26): stacked
            under the wordmark it costs no horizontal room, so the compact
            masthead can keep the full lockup. */}
        <header className={"cz-masthead" + (isPhone && items.length > 0 ? " is-compact" : "")}>
          <h1 className="cz-brand">
            <BrandMark size={isPhone && items.length > 0 ? 30 : 34} />
            <span className="cz-brand-name">
              <span className="cz-brand-word">CREDENZA</span>
              <span className="cz-brand-sub">Fashion</span>
            </span>
          </h1>
          {/* Site navigation. The masthead used to be a brand mark, a wide
              empty middle, and one avatar (Kyle 2026-07-27, with a screenshot
              of it). Desktop and tablet get the full row; the phone masthead
              has no width for it, so ≤767px hides this and the Profile sheet
              stays the way out (LB-50). Links open in a new tab: the app is a
              PWA holding unsaved capture state, and navigating away in place
              would drop it. */}
          {!firstRunIntro && (
            <nav className="cz-mast-nav" aria-label="Credenza site">
              {SITE_NAV.map(({ href, label }) => (
                <a
                  key={href}
                  className="cz-mast-nav-link"
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                >
                  {label}
                </a>
              ))}
            </nav>
          )}
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

        {/* The .cz-onboard intro gate was deleted here (onboarding spec, Kyle
            2026-07-26). It said "One shelf for the whole haul" and offered a
            Get started button, then revealed a hero that said the same thing
            with a paste field already in it. Cold open now lands on the hero. */}

        {/* Empty shelf: centered hero. ONE capture field + ONE Stash button —
            the mobile search row below stays hidden until the shelf has items
            (Kyle 2026-07-24: four paste surfaces were three too many). The
            gray ghost tiles are gone for the same reason. */}
        {items.length === 0 && (
          <div className="cz-empty-hero">
            <div className="cz-empty-hero-main">
              <HeroStagger />
              <div className="cz-empty-hero-bar">
                <label className="cz-empty-hero-search">
                  <Search className="cz-empty-hero-search-icon" aria-hidden="true" size={16} strokeWidth={2.2} />
                  <input
                    ref={heroFieldRef}
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
              {/* Hero 2A specimen (hero spec, Kyle 2026-07-26). The empty
                  shelf used to argue for itself in words and then offer two
                  equal-weight links. It now SHOWS one finished card at 55%
                  opacity — the answer to "what do I get" is the object, not a
                  sentence about the object. The card is inert: the only way
                  in is the caption action under it. Import drops to one quiet
                  line, because a person with a whole haul to paste already
                  knows they have one; a person with nothing does not. */}
              <div className="cz-empty-hero-specimen" aria-hidden="true">
                <div className="cz-specimen-card">
                  <img
                    className="cz-specimen-photo"
                    src="/img/specimen-jersey.jpg"
                    alt=""
                    width="212"
                    height="150"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="cz-specimen-body">
                    <div className="cz-specimen-title">Mesh number jersey · black</div>
                    <div className="cz-specimen-row">
                      <span className="cz-specimen-size">SIZE L</span>
                      <span className="cz-specimen-price">¥168</span>
                    </div>
                    <div className="cz-specimen-seller">Mook-official · Weidian</div>
                  </div>
                </div>
              </div>
              <div className="cz-empty-hero-caption">
                <p className="cz-empty-hero-caption-line">
                  This is what a Weidian link becomes.
                </p>
                <button
                  type="button"
                  className="cz-empty-hero-link is-primary"
                  disabled={interactionLocked}
                  onClick={addSamples}
                >
                  Put it on my shelf
                </button>
              </div>
              {/* Two quiet exits, one row (.cz-empty-hero-secondary already
                  existed for exactly this and was unused). Stacking them would
                  have made the second read as a third-tier action. The share
                  link belongs on the empty shelf specifically: a person with no
                  cards is the one who has not set up capture yet. */}
              <div className="cz-empty-hero-secondary">
                <button
                  type="button"
                  className="cz-empty-hero-link is-quiet"
                  disabled={interactionLocked}
                  onClick={() => setImportOpen(true)}
                >
                  Import a haul
                </button>
                <a
                  className="cz-empty-hero-link is-quiet"
                  href="/how/stash-from-your-phone/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Stash from your phone
                </a>
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
              {/* LB-8. The action sits beside the title, not in the board
                  below it: sharing is something you do to this haul, and the
                  title is what a reader of the link will see at the top of
                  the page. Hidden when the haul is empty — a link to nothing
                  is not worth offering. */}
              {totalsItems.length > 0 && (
                <button
                  type="button"
                  className="cz-haul-share"
                  onClick={() => setShareHaulName(openHaulName)}
                >
                  Share
                </button>
              )}
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
            {notification.sub ? (
              <span className="cz-toast-text">
                <span className="cz-toast-message">{notification.message}</span>
                <span className="cz-toast-sub">{notification.sub}</span>
              </span>
            ) : (
              <span className="cz-toast-message">{notification.message}</span>
            )}
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
