import { Fragment, lazy, Suspense, useState, useEffect, useRef, useMemo, useCallback } from "react";
import { flushSync } from "react-dom";
import { AnimatePresence, LazyMotion, m as motion } from "framer-motion";
import { loadMotionFeatures } from "./components/motion-features.js";
import { Check, ChevronLeft, Heart, Layers, LayoutGrid, Package, Plus, Search, Tag, X } from "lucide-react";

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
import { normalizeFindStatus } from "./credenza-find-status.js";
import { downloadHaulCsv } from "./credenza-haul-export.js";
import {
  DEFAULT_DOMESTIC_USD,
  DEFAULT_PACKAGING_GRAMS,
  DIVISORS,
  FIT_OPTIONS,
  MILESTONES,
  RECEIVED_INDEX,
  RED_REASONS,
  SHIPPING_LINES,
  firstPendingQcItem,
  haulIndexCard,
  needsYouCount,
  normalizeStage,
  normalizeVerdict,
  parcelMaths,
  resetToShelf,
  stageBar,
  toHaulItem,
  unorderedLinks,
} from "./haul-fulfillment.js";
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
  refineWeightKeyFromText,
} from "./weight-estimate.js";
import { buildSharedFit } from "./haul-fit-share.js";
import {
  AUTH_ENABLED,
  saveSession,
  sessionFromUrl,
  sendMagicLink,
  googleAuthUrl,
  getValidSession,
  loadSession,
  signOut as authSignOut,
  authHeaders,
  signInErrorMessage,
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
import { overFreeLimit, bumpUsage, planLimit, onUsageChange, PRO_LIMITS, PLAN_CAPS, usageAudience, usageTotal } from "./preview/src/usage.js";
import { limitStatus, ANON_FREE_CARDS } from "./preview/src/limits.js";
import {
  buildHaulShareSnapshot,
  makeShareCode,
  shareUrl,
} from "./credenza-share.js";
import { shareItemCard } from "./credenza-item-share.js";
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
const SearchSheet = lazy(() => import("./sheets/SearchSheet.jsx"));
const AgentSheet = lazy(() => import("./sheets/AgentSheet.jsx"));
const CurrencySheet = lazy(() => import("./sheets/CurrencySheet.jsx"));
const ImportSheet = lazy(() => import("./sheets/ImportSheet.jsx"));
const SettingsPage = lazy(() => import("./settings/SettingsPage.jsx"));
const AvatarMenu = lazy(() => import("./components/AvatarMenu.jsx"));
// Haul sharing redesign: review capture + share sheet (handoff 2b · ii–v).
// The one share sheet — v1 ShareSheet.jsx stays on disk unmounted as
// reference, the way HaulFlowBoard does.
const HaulReviewSheet = lazy(() => import("./sheets/HaulReviewSheet.jsx"));
const HaulShareSheet = lazy(() => import("./sheets/HaulShareSheet.jsx"));
// One sheet for every limit wall (Kyle 2026-07-30). Lazy: it opens on a tap or
// at a wall, never on the first paint.
const LimitsSheet = lazy(() => import("./sheets/LimitsSheet.jsx"));
const SignInModal = lazy(() => import("./sheets/SignInModal.jsx"));
// Pro's own address (sign-in handoff 2026-08-02, README screen 3). Lazy: most
// visits never reach it, and the table it carries is nine rows of text.
const UpgradePage = lazy(() => import("./components/UpgradePage.jsx"));
// QC review (haul handoff, screens 3 to 5). Lazy: it only opens from inside a
// haul that has photos waiting, which most sessions never reach.
const QcOverlay = lazy(() => import("./components/QcOverlay.jsx"));
// The item drawer inside an open haul (haul handoff, screen 8). Lazy for the
// same reason as QC review: it only opens from the stage board.
const HaulItemDrawer = lazy(() => import("./components/HaulItemDrawer.jsx"));
// The hand-off review screen (haul handoff, screen 9). Lazy: it only opens
// once a parcel has something in it.
const HaulHandoff = lazy(() => import("./components/HaulHandoff.jsx"));
// The tracking screen (haul handoff, screens 10 and 11). Lazy: it only opens
// once the parcel is with the agent.
const HaulTracking = lazy(() => import("./components/HaulTracking.jsx"));


// Always-rendered components split out of this file (2026-07-25). Static, not
// lazy: the shelf paints them on first load, so a chunk fetch would only add
// a waterfall. The circular import back into this file is safe — the helpers
// they use are hoisted function declarations.
import DigestDeck from "./components/DigestDeck.jsx";
// The title-row ⋯ menu inside an open haul (STEPS-HANDOFF item 4). HaulBoard
// and its on-page strip are gone; the file stays on disk as reference and
// keeps its own tests.
import HaulTitleMenu from "./components/HaulTitleMenu.jsx";
// The stage board inside an open haul (haul handoff, screens 2, 6 and 7).
// Static, not lazy: it paints with the haul, so a chunk fetch would show an
// empty column strip first.
import HaulSteps from "./components/HaulSteps.jsx";
import HeroStagger from "./components/HeroStagger.jsx";
import IndexingStrip from "./components/IndexingStrip.jsx";
import {
  advanceProgress,
  failReasonFor,
  gainedNothing,
  headerFor,
  isSettled,
  parseLinkMeta,
  platformTile,
  rowStageLabel,
  visibleRows,
} from "./components/indexing.js";
import { SITE_NAV } from "./components/site-nav.js";
import { takeIntent } from "./components/sign-in-intent.js";
import { TypeMark } from "./components/CardCover.jsx";
import PhotoShelfList from "./components/PhotoShelfList.jsx";
import MorphButton from "./components/MorphButton.jsx";
import HaulCoverMosaic from "./components/HaulCoverMosaic.jsx";
import {
  Caption,
  Field,
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
import SlidingTabsPill from "./components/SlidingTabsPill.jsx";
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
    /* Kimi-feel surface recipe on paper (black tints). */
    "--cz-hover": "rgba(23, 24, 26, 0.04)",
    "--cz-selected": "rgba(23, 24, 26, 0.07)",
    "--cz-card-border": "rgba(23, 24, 26, 0.10)",
    "--cz-seg-on": "#17181a",
    "--cz-seg-on-text": "#F4F4F0",
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
    /* Split-rail handoff (2026-07-28): the fit-read tolerance band and the
       pick sheen. Both are --cz-money with alpha; named so Blackout can ride
       its own green (#4ade80) without a raw rgba in the CSS.
       Kyle 2026-07-30: "more color on the actual chart" — 0.20 → 0.34. */
    "--cz-fit-band": "rgba(20, 122, 58, 0.34)",
    "--cz-sheen": "rgba(20, 122, 58, 0.16)",
    "--cz-strip-bg": "#EAEAE4",
    "--cz-footer-bg": "#EFEFE9",
    "--cz-inset-bg": "#FAFAF6",
    /* Marketplace tile colours (indexing strip + photo fallbacks). Flat colour
       plus a letter, never a logo. Values from the design system tokens; 1688
       rides the weidian tile rather than adding a fourth warm hue. */
    "--cz-tile-weidian": "rgb(255, 90, 60)",
    "--cz-tile-yupoo": "rgb(55, 178, 77)",
    "--cz-tile-taobao": "rgb(255, 80, 0)",
    "--cz-tile-1688": "rgb(255, 90, 60)",
  },
  // Blackout dark: Kimi-feel near-black field (#050506), card #0d0d10,
  // white tints only. Money green + heart red are the only hue.
  rainbow: {
    "--cz-bg": "#050506",
    "--cz-bg-elevated": "#0d0d10",
    "--cz-card": "rgba(13, 13, 16, 0.92)",
    /* Kimi recipe: one dark card solid + thin 10% white border. */
    "--cz-card-solid": "#0d0d10",
    "--cz-hair": "rgba(255, 255, 255, 0.10)",
    "--cz-hair-strong": "rgba(255, 255, 255, 0.15)",
    /* Kyle 2026-08-01: "lighten up the text… sharper… clearer" on Blackout.
       Keep near-white primary; lift supporting and meta grays one step. */
    "--cz-ink": "#fafafa",
    "--cz-sub": "#c8c8d0",
    "--cz-faint": "#a3a3ab",
    // Same three values as Gallery — see the note there.
    "--cz-brand-ground": "#0f1114",
    "--cz-brand-c": "#e9edf2",
    "--cz-brand-rule": "#4da3ff",
    "--cz-seg": "rgba(255, 255, 255, 0.04)",
    /* Kimi hover 4% / selected 7% / segment solid white on pick. */
    "--cz-hover": "rgba(255, 255, 255, 0.04)",
    "--cz-selected": "rgba(255, 255, 255, 0.07)",
    "--cz-card-border": "rgba(255, 255, 255, 0.10)",
    "--cz-seg-on": "#ffffff",
    "--cz-seg-on-text": "#000000",
    "--cz-accent": "#fafafa",
    "--cz-accent-bg": "rgba(255, 255, 255, 0.07)",
    "--cz-accent-deep": "#ffffff",
    "--cz-favorite": "#fafafa",
    // Near-white face carries the black label at ~17:1 (Kyle spec: Buy action
    // fill near-white with black text; floor per audit S2 table is 4.5:1).
    "--cz-action-fill": "#fafafa",
    "--cz-action-text": "#000000",
    "--cz-action-text-divider": "rgba(0, 0, 0, 0.18)",
    "--cz-action-muted-bg": "rgba(255, 255, 255, 0.10)",
    "--cz-action-muted-text": "#fafafa",
    /* Kyle 2026-07-30 (#design): "take out these white lines that always
       populate around things, all of them." Every focus ring in the app rides
       this one token, so Blackout drops it to transparent — no white outline
       on chips, fields, or popovers any more. Trade-off, accepted by Kyle:
       keyboard Tab stops no longer draw a visible ring in dark mode. */
    "--cz-focus": "transparent",
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
    "--cz-selection": "rgba(250, 250, 250, 0.22)",
    "--cz-selection-text": "#fafafa",
    "--cz-error-bg": "rgba(244, 63, 94, 0.16)",
    "--cz-error-text": "#f08a92",
    "--cz-glow": "rgba(245, 245, 247, 0.30)",
    // The light shadow is invisible on a true-black field. Deeper and wider
    // so the button still separates from the shelf.
    "--cz-fab-shadow": "0 10px 30px rgba(0, 0, 0, 0.62)",
    "--cz-glow-weak": "rgba(13, 13, 16, 0.55)",
    "--cz-gradient-1": "#0d0d10",
    "--cz-gradient-2": "#2a2a30",
    "--cz-gradient-3": "#a3a3ab",
    /* Blackout: chip fill and raised strips step above #0d0d10. */
    "--cz-chip-fill": "rgba(255, 255, 255, 0.10)",
    "--cz-warn": "#d9a83c",
    /* On black the warning label goes light, not dark: #8a6714 would vanish.
       #e8bf63 measures ~9.6:1 on the card surface. */
    "--cz-warn-ink": "#e8bf63",
    "--cz-accent-tint": "rgba(74, 222, 128, 0.10)",
    /* Split-rail handoff (2026-07-28): Blackout rides its own money green.
       Kyle 2026-07-30: "more color on the actual chart" — 0.18 → 0.38. */
    "--cz-fit-band": "rgba(74, 222, 128, 0.38)",
    "--cz-sheen": "rgba(74, 222, 128, 0.16)",
    "--cz-strip-bg": "#0a0a0c",
    "--cz-footer-bg": "#08080a",
    "--cz-inset-bg": "#141418",
    // Marketplace tiles — same values as Gallery (see the light palette note).
    "--cz-tile-weidian": "rgb(255, 90, 60)",
    "--cz-tile-yupoo": "rgb(55, 178, 77)",
    "--cz-tile-taobao": "rgb(255, 80, 0)",
    "--cz-tile-1688": "rgb(255, 90, 60)",
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

// Type. These name the same two tokens the CSS uses, so the JSX and the
// stylesheet can never drift apart. The stacks themselves live in exactly one
// place: the :root block at the top of credenza.css. Do not spell a font
// family here (Kyle 2026-07-27: "make some font standardizations for the
// entire website … the fonts that the Credenza fashion logo is made out of").
export const FONT = "var(--cz-sans)";
export const DISPLAY = "var(--cz-display)";
export const MONO = "var(--cz-mono)";

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
    // Haul fulfillment (design/handoffs/haul). The rate table and the parcel's
    // submission state must survive a reload. The rates are the person's own
    // numbers, not Credenza's: agents change them weekly.
    ship: migrateHaulShip(raw.ship),
    history: (Array.isArray(raw.history) ? raw.history : [])
      .filter((e) => e && typeof e === "object" && e.type)
      .slice(-50)
      .map((e) => ({ at: Number(e.at) || Date.now(), type: String(e.type), detail: String(e.detail || "") })),
  };
}

// The haul's shipping settings. Absent means "never opened the parcel panel",
// so every screen falls back to the starting numbers.
export function migrateHaulShip(raw) {
  if (!raw || typeof raw !== "object") return null;
  const rates = {};
  for (const line of SHIPPING_LINES) {
    const value = raw.rates && Number(raw.rates[line.key]);
    rates[line.key] = Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : line.rate;
  }
  const packaging = Number(raw.packagingGrams);
  const declared = Number(raw.declared);
  const domestic = Number(raw.domesticUsd);
  const milestone = Number(raw.milestone);
  return {
    divisor: DIVISORS.includes(Number(raw.divisor)) ? Number(raw.divisor) : 6000,
    line: SHIPPING_LINES.some((l) => l.key === raw.line) ? raw.line : "EMS",
    rates,
    ratesEditedAt: typeof raw.ratesEditedAt === "string" ? raw.ratesEditedAt : null,
    packagingGrams:
      Number.isFinite(packaging) && packaging >= 0 && packaging <= 400
        ? Math.round(packaging / 10) * 10
        : DEFAULT_PACKAGING_GRAMS,
    domesticUsd:
      Number.isFinite(domestic) && domestic >= 0
        ? Math.round(domestic * 100) / 100
        : DEFAULT_DOMESTIC_USD,
    declared: Number.isFinite(declared) && declared >= 0 ? Math.round(declared * 100) / 100 : 0,
    submitted: raw.submitted === true,
    milestone: Number.isFinite(milestone) ? Math.min(3, Math.max(0, Math.round(milestone))) : 0,
    // When the person marked each of the four steps. Four slots, one per step,
    // so a step marked and taken back keeps the date it originally carried.
    milestoneAt: MILESTONES.map((_, i) => {
      const value = Array.isArray(raw.milestoneAt) ? raw.milestoneAt[i] : null;
      return typeof value === "string" ? value : null;
    }),
    tracking: typeof raw.tracking === "string" ? raw.tracking.slice(0, 64) : "",
  };
}

// Local category guess from free text (Yupoo title/description, review notes).
// Returns a CATEGORIES key or "" when nothing confident matches.
// Exported for Fix 3 pins (titleEn + variant re-guess after resolve).
export function guessFashionCategory(text) {
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
  // 牛仔裤 / 裤 catch jeans listings when the full original title reaches us
  // (card UI may truncate; resolve originalTitle still has the 裤 cue).
  if (/鞋|运动鞋|球鞋/.test(t)) return "shoes";
  if (/短裤/.test(t)) return "shorts";
  if (/裤|牛仔裤|长裤|西裤/.test(t)) return "pants";
  if (/卫衣|外套|棉服|羽绒服|夹克/.test(t)) return "outerwear";
  if (/袜/.test(t)) return "socks";
  if (/帽/.test(t)) return "hat";
  if (/包|背包/.test(t)) return "bag";
  if (/T恤|短袖|长袖|衬衫|球衣|卫衣/.test(t) && !/外套/.test(t)) return "shirt";
  return "";
}

// Letter + waist size tokens (S-28, XXL-36). High-precision pants signal from
// listing variants — no AI. F Fix 3 2026-08-03.
// Alpha restricted to real clothing size letters so shoe tokens (EU42, US10,
// UK09, EU-40) do not false-positive as pants (F review 2026-08-03).
export const PANTS_SIZE_TOKEN = /^(?:XS|S|M|L|XL|XXL|XXXL|[2-5]XL)-?\d{2}$/i;

/** Flatten variant group values to bare names. */
export function collectVariantNames(variants) {
  const names = [];
  for (const group of variants || []) {
    const values = group && Array.isArray(group.values) ? group.values : [];
    for (const value of values) {
      const name =
        typeof value === "string" ? value : value && value.name != null ? String(value.name) : "";
      const trimmed = name.trim();
      if (trimmed) names.push(trimmed);
    }
  }
  return names;
}

/**
 * True when >=2 variant values look like letter-dash-waist size tokens.
 * Listing-derived, no AI — false on plain S/M/L or color axes.
 */
export function inferPantsFromSizeTokens(variants) {
  let hits = 0;
  for (const name of collectVariantNames(variants)) {
    if (PANTS_SIZE_TOKEN.test(name)) hits += 1;
    if (hits >= 2) return true;
  }
  return false;
}

/**
 * Client-side category refine after resolve/enrich (Fix 3).
 * When the server left category empty or "other", try:
 *  (i) size-token pants inference on variants
 *  (ii) guessFashionCategory over titleEn + originalTitle + variant names
 * Never overrides categoryManual or a confident non-other server category.
 * Never invents pants from non-size variants (no-false-pants pin).
 *
 * @param {{
 *   category?: string,
 *   categoryManual?: boolean,
 *   title?: string,
 *   originalTitle?: string,
 *   titleEn?: string,
 *   summary?: string,
 *   sizeNotes?: string,
 *   variants?: { title?: string, values?: (string|{name?: string})[] }[],
 * }} input
 * @returns {string} a CATEGORIES key or ""
 */
export function refineItemCategory(input) {
  const category = input && input.category ? String(input.category) : "";
  if (input && input.categoryManual && category && CATEGORIES[category]) return category;
  if (category && category !== "other" && CATEGORIES[category]) return category;

  // Empty or "other" — client merge only (no enrich-prompt / resolve.js change).
  const variants = (input && input.variants) || [];
  if (inferPantsFromSizeTokens(variants)) return "pants";

  const variantText = collectVariantNames(variants).join(" ");
  const guessed = guessFashionCategory(
    [
      input && input.titleEn,
      input && input.originalTitle,
      input && input.title,
      input && input.summary,
      input && input.sizeNotes,
      variantText,
    ]
      .filter(Boolean)
      .join(" ")
  );
  if (guessed && CATEGORIES[guessed]) return guessed;

  // Stay on "other" when Claude said so and nothing local matched.
  if (category === "other") return "other";
  return "";
}

// Top-8 display currencies (lane 2, 2026-08-02). Order is the picker order.
// Stored item prices stay CNY/USD/EUR as before; the primary only changes
// what the shelf labels and totals show.
export const PRICE_PRIMARIES = ["USD", "EUR", "CNY", "GBP", "JPY", "KRW", "CAD", "AUD"];

// Whole-unit currencies round to integers so the reel never shows "¥12.34".
const WHOLE_UNIT_CODES = new Set(["CNY", "JPY", "KRW"]);

// Same fallback the resolve function uses when FX is unavailable — keeps
// shelf totals stable across devices before/without enrichment priceUsd.
// Literal form is pinned by ask-shelf-fields (one rate, three copies).
const FX_FALLBACK_USD_PER_CNY = 0.14;
// Same fallback the resolve function uses for EUR (2026-08-01): the euro is
// stronger than the dollar, so fewer CNY buy one EUR than one USD.
const FX_FALLBACK_EUR_PER_CNY = 0.13;
// Fallback units of each currency per 1 CNY. USD/EUR re-export the pinned
// literals so the three-copy check and the top-8 map never drift.
export const FX_FALLBACK_PER_CNY = {
  USD: FX_FALLBACK_USD_PER_CNY,
  EUR: FX_FALLBACK_EUR_PER_CNY,
  CNY: 1,
  GBP: 0.11,
  JPY: 21,
  KRW: 190,
  CAD: 0.19,
  AUD: 0.21,
};

export function isPricePrimary(v) {
  return PRICE_PRIMARIES.includes(v);
}

export function normalizePricePrimary(v) {
  const code = String(v || "").toUpperCase();
  return isPricePrimary(code) ? code : "USD";
}

function roundMoney(n, code) {
  if (n == null || !isFinite(Number(n))) return null;
  const v = Number(n);
  if (WHOLE_UNIT_CODES.has(code)) return Math.round(v);
  return Math.round(v * 100) / 100;
}

// formatMoney is the only place that prints a symbol; every shelf label goes
// through it so the picker never invents a second format path.
export function formatMoney(amount, currency) {
  if (amount == null || !isFinite(Number(amount))) return "";
  const code = String(currency || "").toUpperCase();
  const n = Number(amount);
  const whole = WHOLE_UNIT_CODES.has(code);
  const pretty = whole
    ? String(Math.round(n))
    : Number.isInteger(n)
      ? String(n)
      : n.toFixed(2);
  if (code === "USD") return "$" + pretty;
  if (code === "EUR") return "€" + pretty;
  if (code === "GBP") return "£" + pretty;
  if (code === "KRW") return "₩" + pretty;
  if (code === "CAD") return "C$" + pretty;
  if (code === "AUD") return "A$" + pretty;
  // CNY and JPY both use the yen/yuan mark; the picker row shows the code.
  if (code === "CNY" || code === "JPY") return "¥" + pretty;
  return code + " " + pretty;
}

function isCnyCurrency(currency) {
  const c = String(currency || "CNY").toUpperCase();
  return c === "CNY" || c === "RMB" || c === "¥" || c === "CNH";
}

// Best-effort yuan amount for conversion. Prefers a stored CNY price, then
// walks the known USD/EUR fields with the same fallbacks the per-currency
// helpers use so every direction agrees.
function itemCnyBase(item) {
  if (!item || typeof item !== "object") return null;
  const currency = String(item.currency || "CNY").toUpperCase();
  if (isCnyCurrency(currency) && item.price != null && isFinite(Number(item.price))) {
    return Number(item.price);
  }
  if (item.priceUsd != null && isFinite(Number(item.priceUsd))) {
    return Number(item.priceUsd) / FX_FALLBACK_USD_PER_CNY;
  }
  if (item.priceEur != null && isFinite(Number(item.priceEur))) {
    return Number(item.priceEur) / FX_FALLBACK_EUR_PER_CNY;
  }
  if ((currency === "USD" || currency === "$") && item.price != null && isFinite(Number(item.price))) {
    return Number(item.price) / FX_FALLBACK_USD_PER_CNY;
  }
  if ((currency === "EUR" || currency === "€") && item.price != null && isFinite(Number(item.price))) {
    return Number(item.price) / FX_FALLBACK_EUR_PER_CNY;
  }
  return null;
}

export function itemUsdAmount(item) {
  if (!item || typeof item !== "object") return null;
  if (item.priceUsd != null && isFinite(Number(item.priceUsd))) return Number(item.priceUsd);
  if (item.priceFx && item.priceFx.USD != null && isFinite(Number(item.priceFx.USD))) {
    return Number(item.priceFx.USD);
  }
  if (item.price == null || !isFinite(Number(item.price))) return null;
  const currency = String(item.currency || "CNY").toUpperCase();
  if (currency === "USD" || currency === "$") return Number(item.price);
  if (isCnyCurrency(currency)) {
    return roundMoney(Number(item.price) * FX_FALLBACK_USD_PER_CNY, "USD");
  }
  // Unknown currency: don't invent USD (would inflate the reel).
  return null;
}

// EUR mirror of itemUsdAmount (2026-08-01): prefers the resolved EUR
// conversion, falls back through the same offline rate, and never invents an
// amount for an unknown currency.
export function itemEurAmount(item) {
  if (!item || typeof item !== "object") return null;
  if (item.priceEur != null && isFinite(Number(item.priceEur))) return Number(item.priceEur);
  if (item.priceFx && item.priceFx.EUR != null && isFinite(Number(item.priceFx.EUR))) {
    return Number(item.priceFx.EUR);
  }
  if (item.price == null || !isFinite(Number(item.price))) return null;
  const currency = String(item.currency || "CNY").toUpperCase();
  if (currency === "EUR" || currency === "€") return Number(item.price);
  if (isCnyCurrency(currency)) {
    return roundMoney(Number(item.price) * FX_FALLBACK_EUR_PER_CNY, "EUR");
  }
  // Unknown currency: don't invent EUR (would inflate the reel).
  return null;
}

// CNY mirror of itemUsdAmount (Kyle 2026-07-28: "If you switch from USD to
// CNY, it doesn't change the dollar amount"). The stored CNY price wins when
// the item is priced in yuan; anything else converts through the same
// fallback rate itemUsdAmount uses, so the two directions always agree.
// Converted yuan rounds to whole ¥ — fractions of a yuan read as noise.
export function itemCnyAmount(item) {
  if (!item || typeof item !== "object") return null;
  const currency = String(item.currency || "CNY").toUpperCase();
  if (
    isCnyCurrency(currency) &&
    item.price != null &&
    isFinite(Number(item.price))
  ) {
    return Number(item.price);
  }
  if (item.priceFx && item.priceFx.CNY != null && isFinite(Number(item.priceFx.CNY))) {
    return Math.round(Number(item.priceFx.CNY));
  }
  const usd = itemUsdAmount(item);
  if (usd != null) return Math.round(usd / FX_FALLBACK_USD_PER_CNY);
  return null;
}

// Generic amount in any top-8 currency. USD/EUR/CNY keep their dedicated
// helpers (and their stored fields). Everything else prefers priceFx[code]
// from the one-shot resolve fetch, then converts from the yuan base.
export function itemAmountIn(item, code) {
  const c = normalizePricePrimary(code);
  if (c === "USD") return itemUsdAmount(item);
  if (c === "EUR") return itemEurAmount(item);
  if (c === "CNY") return itemCnyAmount(item);
  if (!item || typeof item !== "object") return null;
  if (item.priceFx && item.priceFx[c] != null && isFinite(Number(item.priceFx[c]))) {
    return roundMoney(item.priceFx[c], c);
  }
  const currency = String(item.currency || "CNY").toUpperCase();
  if (currency === c && item.price != null && isFinite(Number(item.price))) {
    return roundMoney(item.price, c);
  }
  const cny = itemCnyBase(item);
  if (cny == null) return null;
  const rate = FX_FALLBACK_PER_CNY[c];
  if (rate == null) return null;
  return roundMoney(cny * rate, c);
}

// One pure sum for shelf + haul totals so chips, phone tabs, and the reel
// never disagree.
//
// `excludeReturned` is a no-op since the shelf handoff (2026-07-28) cut the
// order pipeline to bought-or-not: there is no "returned" value left to drop.
// The option stays so callers and their tests keep working; a card is either
// on the shelf and counted, or deleted.
export function sumItemsUsd(items, { excludeReturned: _excludeReturned = false } = {}) {
  let sum = 0;
  for (const it of items || []) {
    const usd = itemUsdAmount(it);
    if (usd != null && isFinite(usd)) sum += usd;
  }
  return Math.round(sum * 100) / 100;
}

// EUR twin of sumItemsUsd (2026-08-01): euro is a decimal currency like the
// dollar, so the total keeps the same 2-decimal rounding.
export function sumItemsEur(items, { excludeReturned: _excludeReturned = false } = {}) {
  let sum = 0;
  for (const it of items || []) {
    const eur = itemEurAmount(it);
    if (eur != null && isFinite(eur)) sum += eur;
  }
  return Math.round(sum * 100) / 100;
}

// CNY twin of sumItemsUsd (Kyle 2026-07-28): the shelf total follows the
// primary currency now, and summing the per-item rounded yuan keeps the
// total equal to the card labels the customer can see.
export function sumItemsCny(items, { excludeReturned: _excludeReturned = false } = {}) {
  let sum = 0;
  for (const it of items || []) {
    const cny = itemCnyAmount(it);
    if (cny != null && isFinite(cny)) sum += cny;
  }
  return Math.round(sum);
}

// Sum in any top-8 currency. Whole-unit codes stay integers.
export function sumItemsIn(items, code, { excludeReturned: _excludeReturned = false } = {}) {
  const c = normalizePricePrimary(code);
  if (c === "USD") return sumItemsUsd(items);
  if (c === "EUR") return sumItemsEur(items);
  if (c === "CNY") return sumItemsCny(items);
  let sum = 0;
  for (const it of items || []) {
    const amt = itemAmountIn(it, c);
    if (amt != null && isFinite(amt)) sum += amt;
  }
  return roundMoney(sum, c) ?? 0;
}

// Primary price currency (settings-toggles.md #1, design handoff PR3 profile
// sheet): display ORDER only — stored item fields never change. The app root
// syncs this from credenza-prefs-v1; the USD default keeps tests and any
// non-app caller unchanged. Top-8 set since the currency menu (2026-08-02).
let PRICE_PRIMARY = "USD";
function setPricePrimaryPref(v) {
  PRICE_PRIMARY = normalizePricePrimary(v);
}
// Kept for tests and any leftover cycle callers. The live UI opens the
// picker instead of cycling (lane 2). Walks the top-8 list in picker order.
export function nextPricePrimary(v) {
  const cur = normalizePricePrimary(v);
  const i = PRICE_PRIMARIES.indexOf(cur);
  return PRICE_PRIMARIES[(i + 1) % PRICE_PRIMARIES.length];
}
// DetailBody price editor (and tests) read the same mirror the app syncs.
export function pricePrimaryPref() {
  return PRICE_PRIMARY;
}

// Fit summary prefs (design handoff PR4). Same module-mirror pattern as
// PRICE_PRIMARY: the App syncs these from its prefs state, and flipping the
// toggle on the size paragraph (design 1e) re-renders the tree so FitSummary
// reads fresh values.
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
  if (item.price == null && item.priceUsd == null && !(item.priceFx && typeof item.priceFx === "object")) {
    return "";
  }
  const currency = item.currency || "CNY";
  // One currency only (Kyle 2026-07-26): the primary hides every other mark.
  // Dual "$14.59 · ¥99" made the footer and cards fight the price toggle.
  // Both directions CONVERT (Kyle 2026-07-28): a USD-priced item under a CNY
  // pref shows yuan, not the dollar amount with a ¥-less label.
  // Top-8 menu (2026-08-02): every primary uses the same path.
  const primaryAmt = itemAmountIn(item, PRICE_PRIMARY);
  if (primaryAmt != null) return formatMoney(primaryAmt, PRICE_PRIMARY);
  // Fallback chain if the primary cannot convert this item.
  const cny = itemCnyAmount(item);
  if (cny != null) return formatMoney(cny, "CNY");
  const usd = itemUsdAmount(item);
  if (usd != null) return formatMoney(usd, "USD");
  if (item.price != null) return formatMoney(item.price, currency);
  return "";
}

// Pill label (Kyle 2026-07-22): one currency per chip. Follows the same
// primary pref as priceLabel (Kyle 2026-07-28) — a toggle that changes the
// label but not the amount reads as broken.
export function priceLabelShort(item) {
  const primaryAmt = itemAmountIn(item, PRICE_PRIMARY);
  if (primaryAmt != null) return formatMoney(primaryAmt, PRICE_PRIMARY);
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
// A cm value: 2–3 whole digits, optionally one or two decimals. Seller charts
// print half-centimetres constantly ("袖长 24.5"), and reading that as 24 lost
// half a centimetre on every such column (Kyle 2026-07-29 — his sleeve read
// 9.4 inches where the chart said 9.6).
//
// Only the period separates the decimals. A comma cannot: strategy 1 reads
// segments like "chest 110, length 67", so "110,67" is a list far more often
// than it is one number.
const CM_NUMBER_SRC = "\\d{2,3}(?:\\.\\d{1,2})?";
// Label → number pairs. Longest labels first so 裤长/袖长 beat 长, and
// "pants length" beats "length". cm values are realistically 20–250.
// 半胸 / 1/2 chest first so pit-to-pit labels win over bare 胸围 in the same
// segment; normalizeHalfChestRows still doubles when the column looks half.
//
// The half forms of WAIST and HIP are listed too (Kyle 2026-07-30: "half-chest
// and half-waist: can't those be easily calculated?"). Shorts charts print
// "1/2Waist 38" constantly. Without the half form in this list the label only
// matched "Waist", so nothing knew the column was half a circumference, and a
// 76cm waist was read as 38cm — a size twice as tight as the seller's.
const MEASURE_PAIR_RE = new RegExp(
  "(半胸|1\\/2\\s*胸|½\\s*胸|1\\/2\\s*chest|half[\\s-]*chest|pit[\\s-]*to[\\s-]*pit|半腰|1\\/2\\s*腰|½\\s*腰|1\\/2\\s*waist|half[\\s-]*waist|半臀|1\\/2\\s*臀|½\\s*臀|1\\/2\\s*hip|half[\\s-]*hip|胸围|胸寛|胸宽|chest|bust|肩宽|肩寛|shoulder|袖长|袖長|sleeve|腰围|腰圍|waist|臀围|臀圍|hip|裤长|褲長|pants?\\s*length|trouser\\s*length|衣长|衣長|length)\\s*[:：]?\\s*(" +
    CM_NUMBER_SRC +
    ")",
  "gi"
);
// A label that names half a circumference: flat measure, pit to pit, 半, 1/2.
const HALF_LABEL_RE = /半|1\/2|½|half|pit[\s-]*to[\s-]*pit/i;
// The bare-number scan for the positional table strategies. It must read the
// decimals too: "104.25" split into "104" and "25" put a stray 25 into the NEXT
// column, so one decimal value corrupted every measurement after it.
const CM_NUMBER_RE = new RegExp(CM_NUMBER_SRC, "g");

// The named measurement wins over the "half" word. "1/2Waist" is a waist, and
// the old order made it a chest (Kyle 2026-07-30). Only a label that names no
// measurement at all falls back to chest on the half word, which is where a
// bare "half 52" or "pit to pit 52" belongs.
function measureKeyForLabel(label) {
  const l = label.toLowerCase();
  if (/肩|shoulder/.test(l)) return "shoulder";
  if (/袖|sleeve/.test(l)) return "sleeve";
  if (/腰|waist/.test(l)) return "waist";
  if (/臀|hip/.test(l)) return "hip";
  if (/裤|褲|pants|trouser/.test(l)) return "pantsLength";
  if (/胸|chest|bust|pit|1\/2|½|half/.test(l)) return "chest";
  return "length";
}

function sizeRunHint(text) {
  if (/runs?\s*(big|large)|偏大|版型大/i.test(text)) return "big";
  if (/runs?\s*small|偏小|版型小/i.test(text)) return "small";
  if (/true\s*to\s*size|fits?\s*true|正码|正常码/i.test(text)) return "true";
  return null;
}

// `halfKeys`, when given, collects every measurement this header names as half
// a circumference, so parseSizeChart can double those columns.
function chartHeaderLabels(line, halfKeys = null) {
  const labels = [];
  // Header detection uses bare labels (no numbers required after them).
  const labelOnly = new RegExp(
    MEASURE_PAIR_RE.source.replace("\\s*[:：]?\\s*(" + CM_NUMBER_SRC + ")", ""),
    "gi"
  );
  let lm;
  while ((lm = labelOnly.exec(line))) {
    const key = measureKeyForLabel(lm[1]);
    if (halfKeys && HALF_LABEL_RE.test(lm[1])) halfKeys.add(key);
    labels.push(key);
  }
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
  const halfKeys = new Set();
  const allMentions = [];
  SIZE_MENTION_RE.lastIndex = 0;
  let m;
  while ((m = SIZE_MENTION_RE.exec(src))) allMentions.push({ size: m[1], end: m.index + m[0].length, start: m.index });
  // A numeric size token (26–40) also matches a measurement VALUE, and on a
  // shorts chart it did: "1/2Waist 38" made 38 the size name and swallowed the
  // waist column with it (Kyle 2026-07-30 — the app then read three sizes
  // called 36, 38 and 40 with no waist at all). When the chart already names
  // two or more letter sizes, the numbers are measurements, not size names.
  const letterMentions = allMentions.filter((x) => !/^\d+$/.test(x.size));
  const mentions = letterMentions.length >= 2 ? letterMentions : allMentions;
  for (let i = 0; i < mentions.length; i++) {
    const seg = src.slice(mentions[i].end, i + 1 < mentions.length ? mentions[i + 1].start : undefined);
    const row = { size: mentions[i].size.toUpperCase() };
    MEASURE_PAIR_RE.lastIndex = 0;
    let p;
    while ((p = MEASURE_PAIR_RE.exec(seg))) {
      const key = measureKeyForLabel(p[1]);
      const value = parseFloat(p[2]);
      if (row[key] == null && value >= 20 && value <= 250) {
        row[key] = value;
        if (HALF_LABEL_RE.test(p[1])) halfKeys.add(key);
      }
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
      const labels = chartHeaderLabels(lines[h], halfKeys);
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
        const nums = (lines[r].match(CM_NUMBER_RE) || [])
          .map((n) => parseFloat(n))
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
      const labels = chartHeaderLabels(lines[i], halfKeys);
      if (labels.length === 1) pendingKey = labels[0];
      if (labels.length > 1) pendingKey = labels[0]; // prefer first measure
      if (!pendingKey) continue;
      const tableRows = [];
      for (let r = i + 1; r < lines.length; r++) {
        const tm = lines[r].match(new RegExp("^(" + SIZE_TOKEN_SRC + ")\\b", "i"));
        if (!tm) {
          if (tableRows.length) break;
          // Maybe this line is another header — update pending key.
          const more = chartHeaderLabels(lines[r], halfKeys);
          if (more.length) pendingKey = more[0];
          continue;
        }
        const nums = (lines[r].match(CM_NUMBER_RE) || [])
          .map((n) => parseFloat(n))
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
  const rowsNorm = normalizeHalfBottomRows(normalizeHalfChestRows(rows, src), halfKeys);
  return { rows: rowsNorm, runHint: sizeRunHint(src) };
}

// Half waist / half hip → full circumference. Unlike the chest, these double
// ONLY when the seller's own label says half ("1/2Waist", 半臀). No size-band
// guess is allowed here: a numeric waist run of 36/38/40 is a real waist in
// inches on some charts, so a heuristic would wreck the charts it guessed
// wrong. The label is the evidence; without the label the number stands.
export function normalizeHalfBottomRows(rows, halfKeys) {
  if (!Array.isArray(rows) || !halfKeys || !halfKeys.size) return rows;
  const keys = ["waist", "hip"].filter((k) => halfKeys.has(k));
  if (!keys.length) return rows;
  return rows.map((r) => {
    if (!r) return r;
    const out = { ...r };
    for (const k of keys) {
      if (out[k] != null && isFinite(out[k])) out[k] = Math.round(out[k] * 2);
    }
    return out;
  });
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
      // Half-centimetres survive the round trip: the parser reads one decimal,
      // so writing whole cm here would round a corrected 24.5 back to 24 the
      // moment the customer edited any number on the chart. Values outside the
      // parser's own band are dropped — it would not read them back.
      if (!label || value == null || !isFinite(value)) continue;
      const n = Math.round(value * 10) / 10;
      if (n < 20 || n > 250) continue;
      parts.push(label + " " + n);
    }
    if (parts.length) lines.push(String(row.size) + ": " + parts.join(", "));
  }
  return lines.join("\n");
}

// Sleeve style of the garment: "short" | "long" | "unknown" (sleeve fix
// 2026-07-29, PLANS/SLEEVE_FIT_FIX_PLAN.md). A short-sleeve chart lists
// sleeves of 20–25 cm, so comparing them against the ~62 cm arm always
// failed the fit read with a false "does not fit". Decision order, amended
// per Oom's review: LONG title words win first — "long sleeve tee" and
// 长袖T恤 hold a short word but are long garments — then SHORT words, then
// the number rule (every chart sleeve under 40 cm means short). "polo" is
// deliberately not a short word: long-sleeve polos exist, and short-sleeve
// polo charts fall to the number rule. Chinese words do not sit on word
// boundaries, so they match as plain substrings (the weight-index PR hit
// this exact bug). Pure — no DOM, no network, no storage.
const SLEEVE_LONG_RES = [
  /long[-\s]?sleeves?\b/i,
  /(?:^|[^a-z0-9])l\/s(?:[^a-z0-9]|$)/i,
];
const SLEEVE_SHORT_RES = [
  /\btees?\b/i,
  /\bt[-\s]?shirts?\b/i,
  /short[-\s]?sleeves?\b/i,
  /(?:^|[^a-z0-9])s\/s(?:[^a-z0-9]|$)/i,
];
const SLEEVE_LONG_ZH = ["长袖"];
const SLEEVE_SHORT_ZH = ["短袖", "t恤"];
export function sleeveStyle(title, chart) {
  const t = String(title || "").toLowerCase();
  if (t) {
    if (SLEEVE_LONG_RES.some((re) => re.test(t)) || SLEEVE_LONG_ZH.some((w) => t.includes(w))) {
      return "long";
    }
    if (SLEEVE_SHORT_RES.some((re) => re.test(t)) || SLEEVE_SHORT_ZH.some((w) => t.includes(w))) {
      return "short";
    }
  }
  const sleeves = (chart && Array.isArray(chart.rows) ? chart.rows : [])
    .map((r) => (r && r.sleeve != null ? Number(r.sleeve) : null))
    .filter((v) => v != null && isFinite(v));
  if (sleeves.length > 0 && sleeves.every((v) => v < 40)) return "short";
  return "unknown";
}

// ═══ Fit engine v2 — garment type, cut, and the room each one needs ═══
//
// Kyle 2026-07-30: "a jacket, it's supposed to be a little bit bigger on you
// than, say, a fitted T shirt or a dry fit". Before this the engine had ONE
// room number per category: 16 cm for outerwear, 12 cm for every other top.
// A blazer and a parka shared 16 cm, and a dry-fit shared 12 cm with a hoodie.
//
// C's review (RESEARCH/GARMENT_FIT_INTELLIGENCE_REVIEW_2026_07_30.md) set the
// bands below and required four things this code obeys:
//   1. A tailored jacket and a coat are different products. Split them.
//   2. The shoulder is a strong score, not a universal veto.
//   3. Keep the drop-shoulder exception, but name it from the title first.
//   4. Raglan is a third construction. It has no comparable shoulder seam.
// Store decimals; round only what the customer reads.
//
// Everything here is pure, and matches sleeveStyle's shape: English regexes on
// word boundaries, Chinese words as plain substrings (they carry no boundary).

const GARMENT_RES = {
  compression: [/dry[-\s]?fit/i, /dri[-\s]?fit/i, /\bcompression\b/i, /base[-\s]?layer\b/i, /\brash\s?guard\b/i],
  woven: [/button[-\s]?(?:up|down)\b/i, /\boxford\b/i, /\bpoplin\b/i, /\bflannel\b/i, /dress\s?shirts?\b/i],
  blazer: [/\bblazers?\b/i, /suit\s?jackets?\b/i, /sport\s?coats?\b/i],
  coat: [/\bcoats?\b/i, /\bparkas?\b/i, /\bpuffers?\b/i, /down\s?jackets?\b/i, /\btrench\b/i, /\banoraks?\b/i],
  knit: [/\btees?\b/i, /\bt[-\s]?shirts?\b/i, /\bhoodies?\b/i, /\bsweatshirts?\b/i, /\bcrewnecks?\b/i, /\bpolos?\b/i, /\bsweaters?\b/i, /\bknits?\b/i],
};
const GARMENT_ZH = {
  compression: ["紧身", "速干"],
  woven: ["衬衫", "衬衣"],
  blazer: ["西装", "西服"],
  coat: ["大衣", "羽绒服", "棉服", "风衣"],
  knit: ["卫衣", "t恤", "短袖", "长袖", "毛衣", "polo衫"],
};
// Most specific first. "西装外套" holds both a blazer word and a coat word, and
// a blazer is the narrower claim, so blazer must win. compression outranks
// knit for the same reason: a dry-fit tee is a dry-fit, not a regular tee.
const GARMENT_ORDER = ["compression", "blazer", "coat", "woven", "knit"];
// Category is the fallback, never the first answer: a customer files a blazer
// under Outerwear, and Outerwear alone cannot tell a blazer from a parka.
const CATEGORY_GARMENT = {
  shirt: "knit",
  outerwear: "coat",
  pants: "pants",
  shorts: "shorts",
};

// "compression" | "knit" | "woven" | "blazer" | "coat" | "pants" | "shorts" |
// "unknown". `unknown` keeps the pre-v2 numbers — the engine never guesses.
export function garmentType(title, chart, category) {
  const t = String(title || "").toLowerCase();
  if (t) {
    for (const kind of GARMENT_ORDER) {
      if (GARMENT_RES[kind].some((re) => re.test(t))) return kind;
      if (GARMENT_ZH[kind].some((w) => t.includes(w))) return kind;
    }
  }
  return CATEGORY_GARMENT[category] || "unknown";
}

// How the sleeve joins the body, which decides whether the shoulder number
// means anything. C: name it from the title first; a wide shoulder is
// SUPPORTING evidence only, never the sole classifier.
const CUT_DROP_RES = [/drop(?:ped)?[-\s]?shoulders?\b/i, /\boversized?\b/i, /\bboxy\b/i, /\bbaggy\b/i];
const CUT_DROP_ZH = ["落肩", "廓形", "宽松", "oversize"];
const CUT_RAGLAN_RES = [/\braglan\b/i];
const CUT_RAGLAN_ZH = ["插肩"];
const CUT_SETIN_RES = [/slim[-\s]?fit\b/i, /\bfitted\b/i, /\btailored\b/i];
const CUT_SETIN_ZH = ["修身"];
// C: 5 cm of extra shoulder width is supporting evidence for a drop shoulder.
const DROP_SHOULDER_CM = 5;

// "set-in" | "drop" | "raglan" | "unknown". `unknown` scores like set-in but
// never rejects a size — an uncertain classification must not cost a customer
// a size that fits.
export function topCut(title, chart, profile) {
  const t = String(title || "").toLowerCase();
  if (t) {
    if (CUT_RAGLAN_RES.some((re) => re.test(t)) || CUT_RAGLAN_ZH.some((w) => t.includes(w))) {
      return "raglan";
    }
    if (CUT_DROP_RES.some((re) => re.test(t)) || CUT_DROP_ZH.some((w) => t.includes(w))) {
      return "drop";
    }
    if (CUT_SETIN_RES.some((re) => re.test(t)) || CUT_SETIN_ZH.some((w) => t.includes(w))) {
      return "set-in";
    }
  }
  // Supporting evidence: every shoulder the chart lists runs 5 cm past the
  // body. One wide row could be a big size the customer will never pick; all
  // of them wide is a cut, not a size.
  const body = profile && profile.shoulder != null ? Number(profile.shoulder) : null;
  if (body != null && isFinite(body)) {
    const shoulders = (chart && Array.isArray(chart.rows) ? chart.rows : [])
      .map((r) => (r && r.shoulder != null ? Number(r.shoulder) : null))
      .filter((v) => v != null && isFinite(v));
    if (shoulders.length > 0 && shoulders.every((v) => v - body >= DROP_SHOULDER_CM)) return "drop";
  }
  return "unknown";
}

// The fit the SELLER declares in the title. C required the woven-shirt band to
// be "adjusted by the declared fit", and the same words help on a knit: a
// listing that says "slim fit" is describing the cut, not the customer.
// The customer's own saved taste always beats this — it is a fallback only.
export function declaredFit(title) {
  const t = String(title || "").toLowerCase();
  if (!t) return null;
  if (CUT_DROP_RES.some((re) => re.test(t)) || CUT_DROP_ZH.some((w) => t.includes(w))) {
    return "oversized";
  }
  if (CUT_SETIN_RES.some((re) => re.test(t)) || CUT_SETIN_ZH.some((w) => t.includes(w))) {
    return "slim";
  }
  return null;
}

// Waist floor escape hatch (C's engine audit, F's spec, 2026-08-02). A
// non-stretch waistband cannot fit a body bigger than its own measurement —
// a 31.5cm waist does not hold a 33cm body. Sellers print the RELAXED number
// on an elastic or drawstring waistband, so a stated waist smaller than the
// body is normal there, not a fault. Detected from the title and the raw
// chart/notes text the customer saved, same evidence sleeveStyle and
// garmentType already read.
const ELASTIC_WAIST_RES = [/elastic(?:ated)?\b/i, /\bdrawstring\b/i];
const ELASTIC_WAIST_ZH = ["松紧", "抽绳"];
export function hasElasticWaist(...texts) {
  const t = texts.filter(Boolean).join(" ").toLowerCase();
  if (!t) return false;
  return ELASTIC_WAIST_RES.some((re) => re.test(t)) || ELASTIC_WAIST_ZH.some((w) => t.includes(w));
}

// Chest ease bands in centimetres, [low, high], from C's review table. The
// engine aims for the middle of a band and scores the distance outside it.
// Coat top widened 20 to 25 by the four-lane debate (2026-08-08): roomy
// outerwear is the cut, not a warning — Kyle's 49.6in jacket on a 40in chest
// drew red under a green header, and the screen argued with itself.
// Decimals are deliberate — do not round these to whole centimetres.
export const CHEST_EASE_BANDS = {
  compression: [-2.5, 2.5],
  knitSlim: [0, 5],
  knit: [5, 10],
  knitRelaxed: [10, 15],
  knitOver: [15, 25],
  woven: [5, 15],
  blazer: [7.5, 12.5],
  coat: [12.5, 25],
  // The oversized-taste coat band sits above the regular coat band. Without
  // it, asking for an oversized coat would be a no-op: the widened regular
  // band already covers the old knitOver top of 25.
  coatOver: [15, 30],
};

// Which band a garment reads against, once its type, cut and the customer's
// looseness taste are known. Returns null for `unknown` and for bottoms, and
// the caller then keeps the pre-v2 single number.
export function chestEaseBand(kind, cut, looseness) {
  if (kind === "compression") {
    if (looseness === "oversized" || looseness === "baggy") return CHEST_EASE_BANDS.knit;
    return CHEST_EASE_BANDS.compression;
  }
  if (kind === "blazer") {
    if (looseness === "oversized" || looseness === "baggy") return CHEST_EASE_BANDS.coat;
    return CHEST_EASE_BANDS.blazer;
  }
  if (kind === "coat") {
    if (looseness === "oversized" || looseness === "baggy") return CHEST_EASE_BANDS.coatOver;
    return CHEST_EASE_BANDS.coat;
  }
  // C: a woven shirt is one broad band "adjusted by the declared fit".
  if (kind === "woven") {
    if (looseness === "slim") return CHEST_EASE_BANDS.knitSlim;
    if (looseness === "oversized" || looseness === "baggy") return CHEST_EASE_BANDS.knitOver;
    return CHEST_EASE_BANDS.woven;
  }
  if (kind !== "knit") return null;
  if (looseness === "slim") return CHEST_EASE_BANDS.knitSlim;
  if (looseness === "oversized" || looseness === "baggy") return CHEST_EASE_BANDS.knitOver;
  // A drop-shoulder knit is cut relaxed even when the customer asked for
  // nothing. The extra width is the design, not a mistake to correct.
  if (cut === "drop") return CHEST_EASE_BANDS.knitRelaxed;
  return CHEST_EASE_BANDS.knit;
}

// One word for each garment the engine can name. The card prints it on the
// chart panel (garmentTypeWord below). A kind missing from this map, and
// "unknown", print nothing — the engine never guesses out loud.
export const GARMENT_WORD = {
  compression: "Dry-fit",
  knit: "Tee",
  woven: "Shirt",
  blazer: "Blazer",
  coat: "Coat",
  pants: "Trousers",
  shorts: "Shorts",
};

// Pick a size from a parsed chart against a body profile (all cm; weight kg).
// Tops → chest (+ease). Bottoms → waist, falling back to hip when the chart
// only lists 臀围 (common Yupoo pants/shorts sheets). Outerwear gets more ease.
// Optional fitPref (per-category length/looseness) may nudge the letter size
// after the measure pick (design turn 5). Length is metadata only.
// Returns { size, fitNote, reason, row, primaryKey, garment, body, diff,
//   lengthCheck, alt, baseSize?, prefShift?, prefReason?, fitPref? }
//   | { missing: "chest"|"waist"|"hip" } | null.
// `alt` is the runner-up size (fit-preference alternative) or null.
// Optional forceSize reads the SAME chart against the SAME body, but on the
// row the customer tapped instead of the row the score picked. The detail
// panel needs both: the recommendation for the advice line, and the tapped
// row for every number it prints (Kyle 2026-07-29 — the panel showed the
// recommendation's centimetres under whichever size he tapped). A forced read
// skips applyFitPreference: taste already moved the recommendation, and
// nudging a hand pick would answer a tap with a different size.
// Optional title (6th arg): on a confirmed short-sleeve garment the sleeve
// penalty is skipped — a tee's 22 cm sleeve is not a fit failure.
// Optional notesText (7th arg): elastic-evidence text — pass
// elasticEvidenceTextFor(item), never sizeChartTextFor(item). The latter
// returns the machine-parsed chart ALONE once one exists, which hides an
// "elastic waistband" sitting in the free-text fields beside a numeric
// chart. Read only for the waist-floor elastic escape hatch below.
export function recommendSize(
  chart,
  profile,
  category,
  fitPref = null,
  forceSize = null,
  title = null,
  notesText = null
) {
  if (!chart || !Array.isArray(chart.rows) || chart.rows.length < 2) return null;
  const p = migrateSleeveMeasurements(profile) || {};
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
  // Fit engine v2. The garment names its own room band; the band's middle
  // becomes `ease`, so every downstream reader (the target, the length pass,
  // the FIT READ table) keeps working on one number. `band` is what the score
  // actually uses: inside it costs nothing, outside it costs the distance out.
  const looseness = fitPref && !fitPref.dismissed ? fitPref.looseness : null;
  const kind = garmentType(title, chart, category);
  const cut = isBottoms ? null : topCut(title, chart, p);
  // The customer's saved taste wins. With no taste saved, the fit the seller
  // declared in the title stands in for it — "slim fit shirt" is a real signal
  // about the cut, and ignoring it made a slim shirt read as a regular one.
  const band = isBottoms ? null : chestEaseBand(kind, cut, looseness || declaredFit(title));
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
      // A named garment uses its band. An unnamed one keeps the pre-v2
      // numbers: 16 cm for outerwear, 12 cm for everything else.
      ease = band ? (band[0] + band[1]) / 2 : category === "outerwear" ? 16 : 12;
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

  // Garment runs big → the label understates it → aim smaller, and vice versa.
  const runShift = chart.runHint === "big" ? -4 : chart.runHint === "small" ? 4 : 0;
  const target = p[bodyKey] + ease + runShift;

  const candidates = rows.filter((r) => r[primaryKey] != null);
  if (candidates.length < 2) return null;
  const isTop = primaryKey === "chest";
  // ── Hard waist floor (C's audit + F's spec, 2026-08-02) ───────────────────
  // Kyle's shorts card recommended a Large whose 31.5cm waist could not fit
  // his 33cm body — primaryFits' ±6cm band let a negative-ease waist compete
  // and the leg-length pass then let it win outright. A non-stretch waistband
  // genuinely cannot do that, so the floor runs BEFORE scoring, not as a
  // score penalty: garment waist must be >= body waist. An elastic or
  // drawstring waistband is the one real exception — those charts print the
  // relaxed number — so evidence in the title or saved notes raises the
  // floor to a bounded −4cm instead of removing it.
  // C's audit, round 2: runShift must NOT enter this check. A "runs big"
  // chart's -4cm runShift is a SCORING adjustment (the label undersells the
  // garment, so aim smaller) — it is not a physical fact about the fabric.
  // Folding it into the floor let a runs-big chart pass a waist genuinely
  // 4cm smaller than the body straight through a "hard" gate. The floor
  // compares the seller's raw number against the body, full stop; runShift
  // stays where it always did, inside target/score.
  const WAIST_FLOOR_ELASTIC_CM = -4;
  const applyWaistFloor = isBottoms && primaryKey === "waist";
  const elasticWaist = applyWaistFloor && hasElasticWaist(title, notesText);
  const waistFloorOk = (r) => r[primaryKey] - p[bodyKey] >= (elasticWaist ? WAIST_FLOOR_ELASTIC_CM : 0);
  // Never return no pick (Kyle's favor-up instinct, 2026-08-01 01:04Z): when
  // every row fails the floor, keep the largest waist on the chart. It is
  // still the closest the seller offers, and the existing negative-ease
  // sentence (PR #75) already tells the customer it will fit tighter.
  let floorCandidates = candidates;
  if (applyWaistFloor) {
    const eligible = candidates.filter(waistFloorOk);
    floorCandidates =
      eligible.length > 0
        ? eligible
        : [candidates.reduce((biggest, r) => (r[primaryKey] > biggest[primaryKey] ? r : biggest))];
  }
  // Compare the seller's sleeve against the matching saved sleeve. A short
  // sleeve never reads the wrist measurement. A long or unknown sleeve keeps
  // the wrist measurement used before this split. No chart column means no
  // sleeve score because r.sleeve stays empty.
  const sleeveKind = sleeveStyle(title, chart);
  const sleeveProfileKey = sleeveKind === "short" ? "shortSleeve" : "longSleeve";
  // C: a raglan sleeve has no comparable shoulder seam, and a drop shoulder
  // hangs down the arm by design. Neither one can be graded on shoulder width.
  const skipShoulder = isTop && (cut === "drop" || cut === "raglan");
  // C: reject on the shoulder only when the cut is confirmed set-in, both
  // sides carry a number, and the gap beats a real tolerance. Applied as a
  // heavy cost, not a filter: a chart where every row fails still returns the
  // best of them instead of no size at all.
  const SHOULDER_REJECT_CM = 3;
  const SHOULDER_REJECT_COST = 100;
  // Two scores this close are a tie, and the tie goes to the bigger size.
  // Nobody likes a shirt that is too tight.
  const TIE_EPSILON = 0.5;
  const bandOf = (r) => {
    // Distance outside the band. Inside the band is a perfect read, so the
    // whole band scores 0 and the pick then turns on shoulder, sleeve, length.
    // The run hint moves the whole band, exactly as it moves the old target.
    const e = r[primaryKey] - p[bodyKey] - runShift;
    if (e < band[0]) return band[0] - e;
    if (e > band[1]) return e - band[1];
    // Inside the band every size is correct, so the pick belongs to the
    // shoulder and the sleeve. This last term only breaks a dead tie — at
    // 0.05 it can never outweigh the shoulder's 0.4.
    return Math.abs(e - (band[0] + band[1]) / 2) * 0.05;
  };
  const score = (r) => {
    let s = band && isTop ? bandOf(r) : Math.abs(r[primaryKey] - target);
    if (isTop && !skipShoulder && p.shoulder != null && r.shoulder != null) {
      s += Math.abs(r.shoulder - (p.shoulder + 2)) * 0.4;
      if (cut === "set-in" && Math.abs(r.shoulder - (p.shoulder + 2)) > SHOULDER_REJECT_CM) {
        s += SHOULDER_REJECT_COST;
      }
    }
    // Sleeves shorter than the arm are worse than sleeves that run long.
    if (isTop && p[sleeveProfileKey] != null && r.sleeve != null) {
      s += Math.max(0, p[sleeveProfileKey] - r.sleeve) * 0.6;
    }
    // Secondary hip nudge on bottoms when both sides have it.
    if (!isTop && primaryKey === "waist" && p.hip != null && r.hip != null) {
      s += Math.abs(r.hip - (p.hip + 2)) * 0.35;
    }
    return s;
  };
  // Score every row, not just the winner — the runner-up becomes the "also
  // works" second option (snugger vs roomier) Kyle asked for. Sort by score
  // alone here (F, 2026-08-01): the tie-break itself happens below, once,
  // against the true best score — not inside the comparator. A comparator
  // that calls two rows "tied" whenever they are within TIE_EPSILON of EACH
  // OTHER is not consistent (A ties B, B ties C, A does not tie C), and
  // `Array.sort` gives no guaranteed result for a comparator like that — the
  // winner could drift two sizes up instead of one.
  const scored = floorCandidates.map((r) => ({ row: r, s: score(r) })).sort((a, b) => a.s - b.s);
  // A tapped size the chart does not carry falls back to the scored winner —
  // a pick with no row has no measurements to print.
  const forcedRow = forceSize
    ? candidates.find((r) => String(r.size).toUpperCase() === String(forceSize).toUpperCase()) || null
    : null;
  // ── The length pass (Kyle 2026-07-30) ─────────────────────────────────────
  // Kyle's rule, in his words: the length breaks a tie when two sizes fit the
  // chest. So this is a filter, not a weight. A weight would need tuning and
  // could trade a good chest for a good hem at any gap; a filter cannot.
  //
  //   1. The chest scores alone, above. That winner stands unless step 3 fires.
  //   2. Eligible = every row whose chest ease is inside tolerance (the ease
  //      the pick aims for, ±6cm — the same band the FIT READ table draws).
  //   3. Among two or more eligible rows, the one closest to the wanted length
  //      wins. It is by definition a size that already fits the chest.
  //
  // BOTH winners are kept. When they differ, the caller gets lengthWin, so the
  // sentence can name what the chest paid. The app never sizes up in silence.
  // Fit engine v2: "inside tolerance" is the garment's own room band plus 4cm
  // of slack at each edge, the same slack prescriptionSentence allows before
  // it drops "meant to sit". An unnamed garment keeps the old ±6cm around the
  // single target, so nothing changes for a chart the engine cannot classify.
  const CHEST_TOLERANCE = 6;
  const CHEST_BAND_SLACK = 4;
  // Named for the chest pass that built it, but the formula is generic:
  // with no band (every bottoms row, since band is top-only) it falls
  // straight to the plain ±CHEST_TOLERANCE check on whatever primaryKey
  // is — waist or hip included. The pants/shorts length tie-break below
  // reuses it unchanged.
  const primaryFits = (r) => {
    const e = r[primaryKey] - p[bodyKey] - runShift;
    if (band && isTop) return e >= band[0] - CHEST_BAND_SLACK && e <= band[1] + CHEST_BAND_SLACK;
    return Math.abs(e - ease) <= CHEST_TOLERANCE;
  };
  // Ties go to the bigger size (F, 2026-08-01): among every row within
  // TIE_EPSILON of the true best score, the one with the larger measurement
  // wins — not the row that happens to sit later in the chart. The chart
  // parser keeps the seller's own row order and never sorts it, so a chart
  // written largest-first would have flipped "later row" into "smaller size".
  const bestScore = scored[0].s;
  const tiedForBest = scored.filter((s) => s.s - bestScore < TIE_EPSILON);
  const chestWinner = tiedForBest.reduce((biggest, s) =>
    s.row[primaryKey] > biggest.row[primaryKey] ? s : biggest
  ).row;
  let lengthWin = null;
  let lengthPick = null;
  const lengthTarget =
    isTop && p.length != null && isFinite(Number(p.length))
      ? Number(p.length) + lengthNudgeCm(fitPref)
      : null;
  if (lengthTarget != null) {
    const eligible = candidates.filter((r) => r.length != null && primaryFits(r));
    if (eligible.length >= 2) {
      const byLength = eligible
        .map((r) => ({ row: r, d: Math.abs(r.length - lengthTarget), s: score(r) }))
        // Same distance from the wanted length → the better chest wins.
        .sort((a, b) => a.d - b.d || a.s - b.s);
      lengthPick = byLength[0].row;
      if (lengthPick.size !== chestWinner.size) {
        lengthWin = {
          fromSize: chestWinner.size,
          // What the chest ease becomes, and what it was. A null body chest
          // cannot reach here: isTop means the chest led the pick.
          chestEase: lengthPick[primaryKey] - p[bodyKey],
          chestEaseBefore: chestWinner[primaryKey] - p[bodyKey],
          lengthTarget,
          length: lengthPick.length,
        };
      }
    }
  }
  // ── The pants/shorts length pass (F, 2026-08-01; tightened C/F 2026-08-02) ─
  // Same rule as the shirt length pass above, moved to the leg: the saved
  // trouser (or shorts) length only breaks a TRUE tie between sizes that
  // already fit the waist/hip about equally. It never outweighs a clear
  // waist winner. The original ±6cm primaryFits band was too wide for that
  // promise — it let a row 4cm off the winner's score still compete on
  // length alone, which is how a too-small Large beat a correct XL on Kyle's
  // shorts card. Eligibility is now the same TIE_EPSILON used to decide the
  // primary winner itself, and it runs against floorCandidates so a
  // waist-floor reject can never come back through the length door.
  // Both sides are the seller's own full outside-leg number (裤长), matching
  // what the customer saves — no inseam column, no estimate, per PR #20.
  const bodyLegKey = category === "shorts" ? "shortsLength" : "pantsLength";
  let legLengthWin = null;
  let legLengthPick = null;
  const legLengthTarget =
    catPants && p[bodyLegKey] != null && isFinite(Number(p[bodyLegKey]))
      ? Number(p[bodyLegKey])
      : null;
  if (legLengthTarget != null) {
    const eligible = floorCandidates.filter(
      (r) => r.pantsLength != null && score(r) - bestScore < TIE_EPSILON
    );
    if (eligible.length >= 2) {
      const byLength = eligible
        .map((r) => ({ row: r, d: Math.abs(r.pantsLength - legLengthTarget), s: score(r) }))
        // Same distance from the wanted length → the better waist wins.
        .sort((a, b) => a.d - b.d || a.s - b.s);
      legLengthPick = byLength[0].row;
      if (legLengthPick.size !== chestWinner.size) {
        legLengthWin = {
          fromSize: chestWinner.size,
          legLength: legLengthPick.pantsLength,
          legLengthTarget,
        };
      }
    }
  }
  // A hand pick beats every calculation. Then a length winner, then the chest/waist.
  const best = forcedRow || lengthPick || legLengthPick || chestWinner;
  // What the same body would have been given with no looseness taste. The
  // taste no longer moves a chart row (the band does the work), but the panel
  // still owes the customer the old, plain signal: "you like these oversized,
  // so this is not the size we would otherwise name." One extra pure pass, and
  // it cannot recurse — the inner call carries no looseness.
  const neutralSize =
    looseness && band && !forcedRow
      ? (recommendSize(chart, profile, category, { length: fitPref.length }, null, title, notesText) || {}).size ||
        null
      : null;
  const runnerUp = scored.map((s) => s.row).find((r) => r.size !== best.size) || null;

  const fitNote =
    chart.runHint === "big"
      ? "runs big, sized down"
      : chart.runHint === "small"
        ? "runs small, sized up"
        : chart.runHint === "true"
          ? "true to size"
          : "";
  const garment = best[primaryKey];
  const body = p[bodyKey];
  const diff = garment - body;
  // Secondary leg-length check on bottoms. Both numbers are now the seller's
  // own measurement — waistband to hem (裤长) — so this is a like-for-like
  // comparison. The pick above may already have moved to the length winner;
  // this only adds the "runs long/runs short" flag once a gap is real enough
  // to call out (F, 2026-08-01: 5cm or more), it never feeds the pick math.
  const LEG_LENGTH_WARN_CM = 5;
  const lengthCheck =
    !isTop && best.pantsLength != null && p[bodyLegKey] != null
      ? {
          garment: best.pantsLength,
          body: Number(p[bodyLegKey]),
          warn:
            Math.abs(best.pantsLength - Number(p[bodyLegKey])) >= LEG_LENGTH_WARN_CM
              ? best.pantsLength - Number(p[bodyLegKey]) > 0
                ? "long"
                : "short"
              : null,
        }
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
    // Present only when the body length moved the pick off the chest winner.
    // A hand pick clears it below: the customer chose, the app did not.
    lengthWin,
    // Same idea as lengthWin, for pants/shorts: present only when the saved
    // trouser/shorts length moved the pick off the waist/hip winner.
    legLengthWin,
    // The length the pick aimed for, taste included, or null when the customer
    // saved no shirt length. The copy needs to tell "no number" from "matched".
    lengthTargetUsed: lengthTarget,
    // Fit engine v2. The garment the engine read, how its sleeve joins the
    // body, and the room band it aimed for. The panel needs all three: the
    // reason line names the garment, and the FIT READ table must grade the
    // shoulder the same way the pick did or the two contradict each other.
    garmentKind: kind,
    cut,
    easeBand: band,
    neutralSize,
  };
  // Optional 4th arg: per-category taste (length + looseness). Looseness can
  // nudge one size up/down; the length axis moves the target length above.
  if (forcedRow) return { ...baseRec, lengthWin: null, legLengthWin: null };
  return applyFitPreference(baseRec, chart, fitPref, category, applyWaistFloor ? floorCandidates : null);
}

// ── Fit read rows (split-rail handoff 2026-07-28) ──
//
// One row per measurement on the PICKED chart row: name, theirs (garment cm),
// yours (body cm), signed ease, a mark on the tight↔loose track, and a
// three-tier verdict on the ease (Kyle 2026-08-02): GREEN inside the drafted
// Ruler, redesign 2026-08-08 (Kyle's approved mockup, spec
// docs/size-chart-redesign-spec.md): the GARMENT number pins the center of
// every bar, the "YOU" line marks the customer's body number, and the green
// band is the BODY range this cut fits. ORANGE ("soft") zones flank the band
// out to the per-measurement soft delta — "ehhh you can get away with it" —
// RED ("warn") only past that. The old ease ruler (tight↔loose, per-row
// private domain) went away: Kyle's read was "the bars are lopsided and do
// not depict the garment's true size".
//
// Rows come from the parsed chart, not a hard-coded list ("drive them from
// the parsed chart"). Order is worn-garment order per the spec: tops
// chest / length / shoulder / sleeve, bottoms waist / hip / thigh / length.
// The parser has no thigh key, so a bottoms chart shows what it has.
const FIT_READ_LABELS = {
  chest: "Chest",
  shoulder: "Shoulder",
  sleeve: "Sleeve",
  waist: "Waist",
  hip: "Hip",
  pantsLength: "Length",
  length: "Body length",
};
const FIT_READ_TOP_ORDER = ["chest", "length", "shoulder", "sleeve"];
const FIT_READ_BOTTOM_ORDER = ["waist", "hip", "pantsLength", "length"];
// Ideal wearing ease per measurement (garment minus body, cm) and the ± slack
// that still counts as inside tolerance. Chest/waist/hip mirror the targets
// recommendSize aims for; shoulder's +2/×0.4 weight becomes a wider slack.
const FIT_READ_EASE = {
  chest: { ideal: 12, span: 6 },
  shoulder: { ideal: 2, span: 3 },
  sleeve: { ideal: 1, span: 4 },
  waist: { ideal: 2, span: 3 },
  hip: { ideal: 2, span: 4 },
  // Trouser / shorts length. Ideal 0: the length the customer saves IS the
  // length they want, and both numbers are waistband to hem. Locked bands
  // (Kyle 2026-08-08, after fit research): length is the most forgiving
  // measure, so the green span widened 3 to 5.
  pantsLength: { ideal: 0, span: 5 },
  // Ideal 0: the Shirt length a customer saves IS where the hem should sit, so
  // a garment that matches it needs no ease at all. Locked bands (Kyle
  // 2026-08-08): green span widened 3 to 5, same as trouser length.
  // A length the app GUESSED from height carries no target — see fitReadRows.
  length: { ideal: 0, span: 5 },
};

// Locked soft (amber) deltas per measurement (Kyle 2026-08-08, fit research:
// docs/size-chart-redesign-spec.md). The extra freedom lives in AMBER, never
// in green. Chest stays 4 so display still agrees with the pick's
// CHEST_BAND_SLACK. Shoulder widened 4 to 6. Both lengths widened 4 to 8.
const FIT_READ_SOFT_DELTA = {
  chest: 4,
  shoulder: 6,
  sleeve: 4,
  waist: 4,
  hip: 4,
  pantsLength: 8,
  length: 8,
};
const fitReadSoftDelta = (key) =>
  FIT_READ_SOFT_DELTA[key] != null ? FIT_READ_SOFT_DELTA[key] : 4;

export function fitReadRows(chart, rec, profile, category, title = null) {
  const picked = rec && rec.row ? rec.row : null;
  const p = migrateSleeveMeasurements(profile) || {};
  const isBottoms =
    (rec && (rec.primaryKey === "waist" || rec.primaryKey === "hip")) ||
    category === "pants" ||
    category === "shorts";
  const order = isBottoms ? FIT_READ_BOTTOM_ORDER : FIT_READ_TOP_ORDER;
  // Confirmed short sleeve: the sleeve row stays (the numbers are real) but
  // becomes information only, like Body length — no ease, no mark, no warn.
  // Long/unknown keeps the verdict: when unsure, we keep the warning.
  const shortSleeve = sleeveStyle(title, chart) === "short";
  const sleeveBodyKey = shortSleeve ? "shortSleeve" : "longSleeve";
  // Fit engine v2. The table must grade a row exactly as the pick graded it,
  // or the panel argues with itself. Two rows change:
  //   Chest — the garment's own room band replaces the flat 12±6, so a blazer
  //     at +10cm reads as correct instead of tight.
  //   Shoulder — a drop-shoulder or raglan top has no comparable seam, so the
  //     row becomes information only, the same way a short sleeve already is.
  const easeBand = rec && Array.isArray(rec.easeBand) ? rec.easeBand : null;
  const cut = rec ? rec.cut : null;
  const noShoulderSeam = !isBottoms && (cut === "drop" || cut === "raglan");
  const chartRows = chart && Array.isArray(chart.rows) ? chart.rows : [];
  // Body length on a bottoms chart is the same "Length" idea as 裤长; only
  // one of the two keys renders, pantsLength first.
  const rows = [];
  for (const key of order) {
    if (isBottoms && key === "length" && picked && picked.pantsLength != null) continue;
    const theirs = picked && picked[key] != null ? picked[key] : null;
    // The bottoms Length row compares 裤长 against the customer's own saved
    // waistband-to-hem length (Kyle 2026-07-30: "the values should be the
    // values of the seller charts"). Shorts and trousers keep separate saved
    // lengths, because nobody wants both the same. A bottoms "Body length"
    // row still claims nothing — only 裤长 has a match.
    const bodyKey =
      key === "sleeve"
        ? sleeveBodyKey
        : key === "pantsLength"
        ? category === "shorts"
          ? "shortsLength"
          : "pantsLength"
        : key === "length" && isBottoms
          ? null
          : key;
    const rawYours = bodyKey != null && p[bodyKey] != null ? Number(p[bodyKey]) : null;
    let yours = rawYours != null && isFinite(rawYours) ? rawYours : null;
    // Torso estimate (Kyle approved, #design 2026-07-30): nobody tapes their
    // torso, so the Body length row estimates it from height — shoulder-to-
    // hip runs about 30% of height. Flagged so the table can label it.
    // A chest, waist or hip the app worked out from height and weight is a
    // guess too, and it must not earn a verdict either.
    let estimated =
      bodyKey != null &&
      Array.isArray(p.estimatedFields) &&
      p.estimatedFields.includes(bodyKey);
    if (yours == null && key === "length" && !isBottoms) {
      const h = Number(p.height);
      if (isFinite(h) && h >= 120 && h <= 230) {
        yours = Math.round(0.3 * h * 2) / 2;
        estimated = true;
      }
    }
    if (theirs == null && yours == null) continue;
    const infoOnly =
      (shortSleeve && key === "sleeve" && yours == null) ||
      (noShoulderSeam && key === "shoulder");
    // Oom 2026-07-29: a ragged chart can give the picked size no sleeve
    // number. The row would survive the test above on a body arm length,
    // then lose YOURS to the info-only rule and print "Sleeve — — —".
    if (infoOnly && theirs == null) continue;
    // Never grade a guess (Kyle 2026-07-30). A Body length the app estimated
    // from height carries the number and nothing else: no ease, no mark, no
    // warning. Only a length the customer measured earns a verdict.
    const graded = !infoOnly && !estimated;
    // The chest row reads against the garment's own band when the engine named
    // one. Ideal = the band's middle, span = its half-width. The band target
    // exists even when the row is not graded (estimated or info only): the
    // band is a property of the garment, so it can draw dashed.
    const bandTarget =
      key === "chest" && easeBand
        ? {
            ideal: (easeBand[0] + easeBand[1]) / 2,
            span: (easeBand[1] - easeBand[0]) / 2,
          }
        : null;
    const target = theirs != null ? bandTarget || FIT_READ_EASE[key] || null : null;
    const ease = graded && theirs != null && yours != null ? theirs - yours : null;
    let mark = null;
    let warn = false;
    let soft = false;
    let bandLeft = null;
    let bandWidth = null;
    let softLeft = null;
    let softLeftWidth = null;
    let softRight = null;
    let softRightWidth = null;
    if (theirs != null && target) {
      // Ruler, redesign 2026-08-08 (Kyle's approved mockup, spec
      // docs/size-chart-redesign-spec.md): the GARMENT number pins the center
      // (50%) of every row. The green band is the BODY range this cut fits
      // (garment minus the drafted ease range). The mark is the customer's
      // body number (the "YOU" line). Inside the band = fits, amber zone just
      // past it, red past the zone. Tier rule unchanged: read from the ease
      // VALUE so clamped pixels can never flip a color.
      const softDelta = fitReadSoftDelta(key);
      const draftedLo = target.ideal - target.span;
      const draftedHi = target.ideal + target.span;
      // Half the track must cover the soft-zone edges AND the gap between the
      // body number and EVERY size on the chart (not just the pick), or the
      // line would pin at one spot when the customer taps between sizes.
      // 10% air keeps the extreme value off the track edge.
      let need = Math.max(draftedHi + softDelta, Math.abs(softDelta - draftedLo));
      if (yours != null) {
        for (const row of chartRows) {
          const g = row[key];
          if (g != null && isFinite(Number(g))) {
            need = Math.max(need, Math.abs(yours - Number(g)));
          }
        }
      }
      const half = need > 0 ? need * 1.1 : Math.max(target.span + softDelta, 1);
      const pct = (v) => {
        const p = 50 + ((v - theirs) / half) * 50;
        return Math.max(2, Math.min(98, p));
      };
      // Band in body units: a body fits when garment minus body sits inside
      // the drafted ease range, so the fit range is theirs-draftedHi ..
      // theirs-draftedLo.
      bandLeft = pct(theirs - draftedHi);
      const bandRight = pct(theirs - draftedLo);
      bandWidth = bandRight - bandLeft;
      if (ease != null) {
        // Amber zones belong to a verdict: they draw only on a row that has
        // one (solid band). A dashed row shows the band and nothing more.
        softLeft = pct(theirs - draftedHi - softDelta);
        softLeftWidth = Math.max(0, bandLeft - softLeft);
        softRight = bandRight;
        softRightWidth = Math.max(0, pct(theirs - draftedLo + softDelta) - bandRight);
        mark = pct(yours);
        const beyond = Math.max(ease - draftedHi, draftedLo - ease);
        warn = beyond > softDelta;
        soft = !warn && beyond > 0;
      }
    }
    // Dashed = no verdict (locked legend, 2026-08-08): the body number is
    // missing, estimated, or the row is info only. The band still draws when
    // the garment number exists; the "YOU" line only draws on a real number.
    const dashed = !(graded && yours != null);
    // One plain sentence when the row can never grade. Rendered content, so
    // no em dashes (site rule). Estimated rows stay silent here; the footnote
    // already names the height estimate.
    let note = null;
    if (noShoulderSeam && key === "shoulder") {
      note = "A drop or raglan shoulder has no seam to compare. Info only.";
    } else if (shortSleeve && key === "sleeve" && infoOnly) {
      note = "A short sleeve has no fit verdict. Info only.";
    } else if (!infoOnly && !estimated && yours == null && theirs != null) {
      note =
        "Save your " +
        (FIT_READ_LABELS[key] || key).toLowerCase() +
        " under Edit my measurements to get a fit verdict.";
    }
    rows.push({
      key,
      name: FIT_READ_LABELS[key] || key,
      theirs,
      // A short sleeve with no saved short-sleeve value shows only the garment
      // number. The long-sleeve wrist value measures a different thing.
      yours: infoOnly ? null : yours,
      estimated,
      ease,
      mark,
      warn,
      soft,
      dashed,
      note,
      bandLeft,
      bandWidth,
      softLeft,
      softLeftWidth,
      softRight,
      softRightWidth,
      // Kyle 2026-07-30: say it out loud when the seller's chart has no such
      // column. The row used to print a bare "—", which reads the same as a
      // number we failed to use. An empty cell on a chart we DO hold is a
      // missing column, and the table names it in the footnote.
      notOnChart: !!chart && theirs == null,
    });
  }
  // A measured Body length is a fit verdict now (Kyle 2026-07-30). An
  // estimated one is still information only.
  return rows;
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

// Length taste → centimetres on the target body length, for tops only.
// Kyle 2026-07-30 overruled deleting these rows, so they have to do something.
// They shift the LENGTH the pick aims for; they never move the letter size on
// their own. Bottoms keep no nudge: a seller's 裤长 is an outside-leg number
// and our inseam field measures a different segment, so it stays information.
export function lengthNudgeCm(fitPref) {
  if (!fitPref || typeof fitPref !== "object" || fitPref.dismissed) return 0;
  if (fitPref.length === "cropped" || fitPref.length === "short") return -4;
  if (fitPref.length === "long") return 4;
  return 0;
}

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

// What the Cropped / Regular / Long choice DID. The old copy said "Length
// preference saved", which was true and useless — the choice changed nothing
// (Kyle 2026-07-30). Three states, in order of how much the customer gets:
//   1. No saved Shirt length → the app asks for one, because it cannot act.
//   2. A length that did not change the size → it says the size already fits.
//   3. A length that DID change the size → recLengthCostLine names the cost.
function lengthPrefLine(category, fitPref, rec) {
  const word = fitPrefLabel(category, "length", fitPref.length).toLowerCase();
  if (!word) return null;
  // The cost line owns the message when the length moved the pick.
  if (rec && rec.lengthWin) return null;
  if (!rec || rec.lengthTargetUsed == null) {
    return "Save your shirt length and we can hold this item to a " + word + " hem.";
  }
  return "Your " + word + " length matches this size.";
}

// One line naming what the engine thought it was sizing, and why that garment
// gets the room it gets (Kyle 2026-07-30: "a jacket, it's supposed to be a
// little bit bigger on you than, say, a fitted T shirt or a dry fit"). Empty
// when the engine could not name the garment — it never guesses out loud.
const GARMENT_REASON = {
  compression: "Dry-fit: sized close to the body, the way it is meant to sit.",
  knit: "Tee: sized for everyday room, not tight and not loose.",
  woven: "Shirt: sized for room to move and to tuck.",
  blazer: "Blazer: sized to close over a shirt, not over a jumper.",
  coat: "Coat: sized to layer over a tee and a jumper.",
};
export function garmentReasonLine(rec) {
  if (!rec || !rec.garmentKind || !rec.easeBand) return "";
  // A knit sized on a wider or closer band must not claim "everyday room" —
  // the line has to describe the room the pick actually used, or it argues
  // with the centimetres printed under it.
  if (rec.garmentKind === "knit") {
    const [low, high] = rec.easeBand;
    if (low === CHEST_EASE_BANDS.knitOver[0]) {
      return "Oversized tee: sized to hang loose, which is the cut.";
    }
    if (low === CHEST_EASE_BANDS.knitRelaxed[0]) {
      return "Drop-shoulder tee: sized to sit past the shoulder, which is the cut.";
    }
    if (high === CHEST_EASE_BANDS.knitSlim[1]) {
      return "Tee: sized close to the body, the way you like them.";
    }
  }
  return GARMENT_REASON[rec.garmentKind] || "";
}

// One word for the garment the engine read (Kyle 2026-07-30: "only show the
// type in the chart photo"). The reason SENTENCE is retired on the card; this
// word replaces it, sitting on the chart panel's own header. A kind the engine
// did not name returns "" and the card shows nothing at all.
export function garmentTypeWord(rec) {
  if (!rec || !rec.garmentKind) return "";
  return GARMENT_WORD[rec.garmentKind] || "";
}

// Shorts leg length (Kyle 2026-07-30: "the values should be the values of the
// seller charts").
//
// The first version of this line estimated an inside leg from the seller's 裤长
// by subtracting a guessed rise, and said so. Kyle rejected the guess. The
// saved Shorts length is now the same measurement the seller prints — the
// waistband down to the hem — so this line compares two numbers of the same
// kind and states the difference. No rise, no estimate, no "~".
const SHORTS_LENGTH_SLACK_CM = 2.5;
export function shortsLengthNote(rec, profile, category, { units = "cm" } = {}) {
  if (category !== "shorts") return "";
  const want = profile && profile.shortsLength != null ? Number(profile.shortsLength) : null;
  const theirs = rec && rec.row && rec.row.pantsLength != null ? Number(rec.row.pantsLength) : null;
  if (want == null || theirs == null || !isFinite(want) || !isFinite(theirs)) return "";
  const gap = theirs - want;
  const head =
    "This size measures " +
    formatMeasure(theirs, units) +
    " from waist to hem. You like " +
    formatMeasure(want, units) +
    ".";
  if (Math.abs(gap) <= SHORTS_LENGTH_SLACK_CM) return head + " That is the length you want.";
  return (
    head +
    " That is " +
    formatMeasure(Math.abs(gap), units) +
    (gap > 0 ? " longer" : " shorter") +
    " than you like."
  );
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

// v2 replacement for prefReasonLine on tops. The looseness taste no longer
// moves a chart row; it widens or narrows the room the pick aims for. This
// line names the room in centimetres so the change is visible, not implied.
function bandPrefLine(category, fitPref, rec) {
  const loose = fitPrefLabel(category, "looseness", fitPref.looseness).toLowerCase();
  if (!loose || !rec.easeBand) return null;
  const catWord =
    category && CATEGORIES[category] ? CATEGORIES[category].label.toLowerCase() : "this item";
  return (
    "You like " +
    catWord +
    " " +
    loose +
    ", so we sized for " +
    rec.easeBand[0] +
    "–" +
    rec.easeBand[1] +
    "cm of room in the chest."
  );
}

// Apply per-category taste to a base recommendSize result. Safe no-op when
// fitPref is null, dismissed, or has no looseness nudge.
// Optional 5th arg eligibleRows (C's audit, 2026-08-02): on a waist-floor
// chart, the Slim nudge must never step the ladder onto a row the floor
// already rejected — a full-chart ladder let a safe XL nudge back down to
// a floor-rejected L. Pass floorCandidates here to confine the nudge to
// rows that passed the floor; every other caller keeps the full chart.
export function applyFitPreference(rec, chart, fitPref, category, eligibleRows = null) {
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
  // Fit engine v2: on a top whose garment the engine named, the looseness
  // taste already chose the room band inside recommendSize (Slim → 0–5cm,
  // Oversized → 15cm+). Moving one chart row on top of that would charge the
  // customer for the same preference twice. Bottoms have no bands yet, so
  // they keep the row nudge.
  const bandDidLooseness = !!rec.easeBand;
  const nudge = bandDidLooseness ? 0 : loosenessNudge(fitPref.looseness);
  const ladder = (eligibleRows || (chart && Array.isArray(chart.rows) ? chart.rows : [])).filter(
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
    // v2: the band moved the pick instead of a row nudge, so rebuild the same
    // two signals the strike-through UI reads — the size taste took it from,
    // and which way. Without this an Oversized customer sees a size change and
    // no reason for it.
    if (bandDidLooseness && rec.neutralSize && rec.neutralSize !== rec.size) {
      const ladderIdx = (s) =>
        ladder.findIndex((r) => String(r.size).toUpperCase() === String(s).toUpperCase());
      const from = ladderIdx(rec.neutralSize);
      const to = ladderIdx(rec.size);
      next.baseSize = rec.neutralSize;
      next.prefShift = from >= 0 && to >= 0 && to < from ? "down" : "up";
    }
    if (fitPref.length || fitPref.looseness) {
      next.prefReason =
        fitPref.looseness && bandDidLooseness
          ? // v2: the taste chose the room band, so it DID something and the
            // panel must say so. The old code showed nothing here.
            bandPrefLine(category, fitPref, rec)
          : fitPref.looseness && !nudge
            ? null
            : fitPref.length
              ? lengthPrefLine(category, fitPref, rec)
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
    // Looseness moved the size AFTER the length pass, so the length's chest
    // numbers describe a size nobody is being shown now. Drop them rather than
    // print a figure that belongs to another row.
    lengthWin: null,
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
  const tailText = tail.join("; ");
  return first + ". " + tailText.charAt(0).toUpperCase() + tailText.slice(1) + ".";
}

// Primary measure clause by sign of ease (cm storage). Negative ease is not
// room (agreedRoom rule, DetailBody; Kyle 2026-08-02 Large shorts case).
// Threshold ±0.5cm. Positive wording is byte-identical to the pre-fix form.
// `roomFormatted` is formatMeasure(Math.abs(diff)); `bodyFormatted` is the
// body number already in display units.
export function easeRoomClause(diffCm, bodyFormatted, roomFormatted) {
  if (!(diffCm > -0.5)) {
    // diff <= -0.5cm: tighter than the body — never "room".
    return (
      "is " +
      roomFormatted +
      " smaller than your " +
      bodyFormatted +
      ", it will fit tighter than your body"
    );
  }
  if (diffCm < 0.5) {
    // |diff| < 0.5cm: on the body, no room claim and no tight claim.
    return "sits right at your " + bodyFormatted;
  }
  // diff >= +0.5cm: keep the historical positive form.
  return "gives you " + roomFormatted + " of room over your " + bodyFormatted;
}

// "meant to sit" only on positive or near-zero ease — never after a "smaller
// than your body" primary. Plural nouns (pants/shorts) take "these … are".
export function meantToSitClause(noun, sitsRight, diffCm) {
  if (!sitsRight || !(diffCm > -0.5)) return "";
  if (noun === "pants" || noun === "shorts") {
    return ", which is where these " + noun + " are meant to sit";
  }
  return ", which is where this " + noun + " is meant to sit";
}

// The prescription sentence for the size breakdown (handoff turn 3 §5): 1–2
// short plain sentences naming the measurement that decided the pick and what
// the next size down would do. Generated where the chart is parsed — same
// data, no server round-trip. Example: "Take the Large — its 104cm chest
// gives you 6cm of room over your 98cm, which is where this shirt is meant to
// sit. The Medium's 100cm would pull across the chest."
// `recommended` is the recommendation when `rec` describes a size the customer
// tapped instead. The two forms are fixed by the handoff copy deck (README
// section 14, "Prescription, chart, overridden"): the numbers describe the tap,
// and the closing clause still names the size we would take. Callers that pass
// no `recommended` keep the original single form.
// The promise I made Kyle 2026-07-30: the app never sizes up in silence. When
// the saved shirt length pulled the pick off the size the chest chose, this
// line names the size it left and what the chest paid for the change. Built in
// the UI's units, like the reason row, because the numbers are the point.
export function lengthCostSentence(rec, { units = "cm" } = {}) {
  const win = rec && rec.lengthWin;
  if (!win || win.chestEase == null || win.chestEaseBefore == null) return "";
  if (!isFinite(win.chestEase) || !isFinite(win.chestEaseBefore)) return "";
  const bigger = win.chestEase > win.chestEaseBefore;
  const from = formatSizeToken(win.fromSize) || win.fromSize;
  return (
    (bigger ? "Sized up for length" : "Sized down for length") +
    ", away from the " +
    from +
    ". The chest is " +
    (win.chestEase >= 0 ? "+" : "") +
    formatMeasure(win.chestEase, units) +
    " now, not " +
    (win.chestEaseBefore >= 0 ? "+" : "") +
    formatMeasure(win.chestEaseBefore, units) +
    "."
  );
}

export function prescriptionSentence(
  chart,
  rec,
  { units = "cm", category = "", detail, recommended = null } = {}
) {
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
  // pick lands on target. Fit engine v2: when the engine named the garment,
  // this sentence must read against the SAME band the pick used, or it calls a
  // correct blazer wrong. `easeBand` is absent on an unnamed garment and on
  // bottoms, and those keep the pre-v2 targets.
  const band = Array.isArray(rec.easeBand) ? rec.easeBand : null;
  const target = band
    ? (band[0] + band[1]) / 2
    : measure === "chest"
      ? category === "outerwear"
        ? 16
        : 12
      : 2;
  // Inside the band always sits right. Outside it, the old ±4cm slack applies
  // around the band's edge rather than around its middle.
  const sitsRight = band
    ? rec.diff >= band[0] - 4 && rec.diff <= band[1] + 4
    : Math.abs(rec.diff - target) <= 4;
  const easeClause = easeRoomClause(rec.diff, body, room);
  const sitClause = meantToSitClause(noun, sitsRight, rec.diff);
  // Overridden: the customer tapped a size that is not the one we scored. The
  // numbers below are the tapped row's, so the sentence must own that — "Take
  // the Small" over the Large's measurements is the contradiction Kyle saw.
  const overrideName =
    recommended && recommended.size && String(recommended.size).toUpperCase() !== String(rec.size).toUpperCase()
      ? formatSizeToken(recommended.size) || recommended.size
      : "";
  if (overrideName) {
    // Same sign-aware primary as the Take-the-X form; off-band falls back to
    // the draft comparison only when ease is positive or near zero.
    const fitClause =
      sitClause ||
      (rec.diff <= -0.5
        ? ""
        : rec.diff < target
          ? ", closer than this " + noun + " is drafted for"
          : ", roomier than this " + noun + " is drafted for");
    const picked =
      "You have picked the " +
      sizeName +
      ". Its " +
      garment +
      " " +
      measure +
      " " +
      easeClause +
      fitClause +
      ".";
    if (detail === "concise") return picked;
    return picked + " The " + overrideName + " is the one we'd take.";
  }
  const first =
    "Take the " +
    sizeName +
    ". Its " +
    garment +
    " " +
    measure +
    " " +
    easeClause +
    sitClause +
    ".";
  // CH-14: the Concise pref stops at the pick. Only the explicit opt shortens
  // the sentence — a caller that passes nothing keeps the full two-sentence
  // read, so every existing caller (and its tests) is unchanged.
  if (detail === "concise") return first;
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
// state so module-level enrichment (chart-vision) can apply the Free
// allowance without threading props through every call (Part 7e).
let planForLimits = null;
function setPlanForLimits(plan) {
  planForLimits = plan || null;
}

export function trackProductEvent(name, params = {}) {
  try {
    if (typeof window !== "undefined" && typeof window.czTrack === "function") {
      window.czTrack(name, params);
    }
  } catch {}
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

function extractValidUrls(raw) {
  return extractUrls(raw).filter((value) => {
    try {
      const url = new URL(value);
      return /^(https?:)$/.test(url.protocol) && !!url.hostname;
    } catch {
      return false;
    }
  });
}

// Chinese share-text chrome must not become a card title (parser audit
// 2026-07-27, fix 3). Bare platform tags like 【淘宝】 drop entirely; real
// text inside 【…】 survives. 复制…打开…APP tails, 「」 quotes, and markdown
// link syntax are stripped to their label.
const SHARE_PLATFORM_TAG = /^【\s*(?:淘宝|天猫|微店|闲鱼|京东|1688)\s*】/;
export function shareTextLabel(line) {
  return line
    .replace(/\[([^\]]+)\]\((?:https?:\/\/[^)\s]+)\)/g, "$1")
    .replace(/https?:\/\/[^\s<>"')\]]+/g, " ")
    .replace(SHARE_PLATFORM_TAG, " ")
    .replace(/[【】「」]/g, " ")
    .replace(/复制\S{0,40}(?:打开|APP|app)\S*/g, " ")
    .replace(/[|–—:,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Taokouling (淘口令) share tokens carry no URL. Without a title the paste
// becomes a junk fragment card (parser audit 2026-07-27, fix 4).
const TAOKOULING_RE = /[￥₤]\s*[A-Za-z0-9][A-Za-z0-9\s]{3,}?[A-Za-z0-9]\s*[￥₤]|淘口令/;
export function taokoulingTitle(text) {
  return text && TAOKOULING_RE.test(text)
    ? "Taobao share code, open in the Taobao app"
    : "";
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
// Every working Weidian item id in the corpus is 10+ digits; a shorter one
// classifies fine but resolves to nothing, and the paste produces a silent
// dead card (2026-08-04 audit). Treat it as not-a-buy-link so the card gets
// the honest "couldn't read that link" failure instead.
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
  if (id && /^\d{10,}$/.test(id)) return id;
  const pathMatch = u.pathname.match(/\/item\/(\d{10,})/);
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

// Id-less Taobao-family short links (m.tb.cn, tb.cn, s.click.taobao.com)
// carry no numeric id. The server follows them to the item page (resolve.js
// 2026-07-27), so the client gate must let them through (parser audit
// 2026-07-27, fix 5). Host family mirrors resolve.js REDIRECT_FOLLOW_HOST.
export function taobaoShortHost(raw) {
  try {
    const host = new URL(raw).hostname.toLowerCase();
    if (!/(^|\.)((taobao|tmall)\.com|tb\.cn)$/i.test(host)) return false;
    return !taobaoFamilyItemId(raw);
  } catch {
    return false;
  }
}

// First resolvable buy URL on an item: the primary URL or any paired link.
// Agent fronts (Fansbuy item-micro, Superbuy ?url=, …) resolve to marketplace.
export function resolvableBuyUrl(item) {
  const isResolvable = (raw) => {
    const buy = marketplaceBuyUrl(raw);
    return !!(
      weidianItemId(buy) ||
      taobaoFamilyItemId(buy) ||
      ali1688ItemId(buy) ||
      taobaoShortHost(buy)
    );
  };
  if (item.url && isResolvable(item.url)) return marketplaceBuyUrl(item.url);
  for (const l of item.links || []) {
    if (l && l.url && isResolvable(l.url)) return marketplaceBuyUrl(l.url);
  }
  return null;
}

// True for a Yupoo address of any shape: an album, a seller's front page, a
// search result. Says nothing about which one.
export function isYupooUrl(raw) {
  try {
    const host = new URL(raw).hostname.replace(/^www\./, "").toLowerCase();
    return /(^|\.)yupoo\.com$/.test(host);
  } catch {
    return false;
  }
}

// Kyle 2026-08-03, Yupoo seller mook-official: "it's not pulling that album for
// that shirt. It's just pulling the actual seller's profile and not the album."
// A seller's front page holds every item the seller sells. Reading it for one
// shirt's size chart finds nothing, then blames the photo. So an address only
// counts as an album when it names one: /albums/<number>. ensureYupooAlbumUid
// tests for that exact path already; this reuses the test, it does not write a
// second one.
export function isYupooAlbumUrl(raw) {
  if (!isYupooUrl(raw)) return false;
  try {
    return /\/albums\/\d+/i.test(new URL(raw).pathname);
  } catch {
    return false;
  }
}

// First Yupoo album URL on an item: the primary URL or any paired link tagged
// as photos. Used to populate the photo-orbit animation.
export function yupooAlbumUrl(item) {
  if (!item) return null;
  if (item.url && isYupooAlbumUrl(item.url)) return ensureYupooAlbumUid(item.url);
  for (const l of item.links || []) {
    if (l && l.url && isYupooAlbumUrl(l.url)) return ensureYupooAlbumUid(l.url);
  }
  // Resolve can attach bare shop hosts from Weidian desc notes.
  for (const raw of item.sellerYupooLinks || []) {
    if (typeof raw === "string" && isYupooAlbumUrl(raw)) return ensureYupooAlbumUid(raw);
  }
  return null;
}

// First Yupoo address of any shape on an item, album or not. The store link and
// the card link both need this: a seller's front page is still worth opening,
// it is only worth nothing to the chart reader.
export function yupooAnyUrl(item) {
  if (!item) return null;
  if (item.url && isYupooUrl(item.url)) return ensureYupooAlbumUid(item.url);
  for (const l of item.links || []) {
    if (l && l.url && isYupooUrl(l.url)) return ensureYupooAlbumUid(l.url);
  }
  for (const raw of item.sellerYupooLinks || []) {
    if (typeof raw === "string" && isYupooUrl(raw)) return ensureYupooAlbumUid(raw);
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
  // Any Yupoo address gives the store: this takes the host and drops the path.
  // A seller's own front page is the most direct answer of all.
  const album = yupooAnyUrl(item);
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
      : "A quiet week on the shelf. A few older cards deserve attention.";
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
      : "Stashed " + days + " days ago, still worth a look.";
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
// "You get 5 free full cards." — shown on a visitor's first paste, once per
// device. V2 shows the changed allowance once to returning visitors too.
export const FREE_NOTE_KEY = "credenza-fashion-free-note-v2";
// Onboarding README, "State machine": skipped is session-sticky. One skip
// suppresses both asks on every card for the rest of the session, and a new
// session clears it. sessionStorage IS that lifetime — a reload keeps the
// skip, a new tab asks again. We store the skip timestamp under skippedAt,
// the field name the README's data model uses.
export const FIT_SKIP_KEY = "credenza-fashion-fit-skipped-at-v1";

// Onboarding README, "A0 · Arrival": dismissal of the intro strip is permanent
// (onboarding.introDismissed, local). The strip never returns, so this one is
// localStorage, not sessionStorage.
export const INTRO_DISMISSED_KEY = "credenza-fashion-intro-dismissed-v1";

/** True when the visitor has dismissed the arrival intro strip for good. */
export function readIntroDismissed() {
  try {
    return !!window.localStorage.getItem(INTRO_DISMISSED_KEY);
  } catch {
    // No storage (private mode). Showing the strip is the right failure: it is
    // three lines and it carries a dismiss button.
    return false;
  }
}

/** Dismiss the arrival intro strip for good. Silent when storage is blocked. */
export function writeIntroDismissed() {
  try {
    window.localStorage.setItem(INTRO_DISMISSED_KEY, "1");
  } catch {
    // See readIntroDismissed: the in-memory flag still hides it this page view.
  }
}

/** Read the session skip. Returns the ISO stamp, or "" when the asks are live. */
export function readFitSkippedAt() {
  try {
    return window.sessionStorage.getItem(FIT_SKIP_KEY) || "";
  } catch {
    // No storage (private mode). The asks stay live for this page view, which
    // is the honest failure: the visitor can always skip again.
    return "";
  }
}

/** Write the session skip. Silent when storage is blocked. */
export function writeFitSkippedAt(stamp) {
  try {
    window.sessionStorage.setItem(FIT_SKIP_KEY, stamp || new Date().toISOString());
  } catch {
    // See readFitSkippedAt: the in-memory flag still holds for this page view.
  }
}

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
// revised to three tiers + trial 2026-07-27: $2.49 weekly with a 3-day free
// trial, $5.99 monthly, $44.99 yearly).
//
// Stripe Prices are immutable, so a price the app states and a price Stripe
// charges can drift apart silently — the customer sees one number on the
// button and a different number on the card. Every surface reads from here,
// and preview/test/pricing.test.js checks the static /pricing/ page against
// these same strings, because a plain HTML file cannot import them.
export const PRICING = {
  weekly: "$2.49",
  monthly: "$5.99",
  yearly: "$44.99",
  // The trial is weekly-only (checkout.js attaches trial_period_days there).
  // FTC negative-option rule: the free days, the after-trial price, and the
  // cancel path must sit next to the button that starts it.
  weeklyTrial: "3 days free",
  weeklyTrialNote: "3 days free, then $2.49 a week until you cancel",
  // 5.99 * 12 = 71.88. 71.88 - 44.99 = 26.89, which is 37% off.
  yearlySaving: "Save 37%",
  yearlyPerMonth: "$3.75 a month",
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

// Clipboard-detected capture bar (design handoff PR3): describe the first
// valid link so the bottom bar can offer one-tap capture. URL-free text stays
// out of this ambient shortcut and remains available through the Stash sheet.
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
  const links = extractValidUrls(raw);
  if (!links.length) return null;
  let host = "";
  try {
    host = new URL(links[0]).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  const hit = CLIP_PLATFORMS.find(([re]) => re.test(host));
  return {
    text: links.join("\n"),
    platform: hit ? hit[1] : "Link",
    host,
    dot: hit ? hit[2] : "var(--cz-faint)",
    fingerprint: links.map((url) => canonicalKey(classify(url), url)).join("|"),
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
export function stashPreview(raw, options = {}) {
  const text = (raw || "").trim();
  if (!text) return null;
  const row = (parsed, rawText, titleHint) => ({
    key: canonicalKey(parsed, rawText),
    title: (titleHint || "").trim() || localTitle(parsed, rawText),
    code: stashRowCode(parsed),
    platform: platformNameFor(parsed.host),
    dot: platformDotFor(parsed.host),
  });
  let rows = options.asNote
    ? [row(classify(text), text, "")]
    : parseImport(text).candidates.map((c) => row(c.parsed, c.rawText, c.titleHint));
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
    // The server refused to read this link because nobody is signed in. The
    // card says so where the size chart belongs, and fills itself in after
    // sign-in (Kyle 2026-07-30 — a blank card reads as a broken site).
    needsSignIn: false,
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
    priceEur: null,
    priceFx: null,
    category: "",
    variants: [],
    sizeNotes: "",
    sizeChartText: "",
    sizeChartSource: null,
    sizeChartNeedsClear: false,
    sizeChartIgnoreNotes: false,
    // Seller WhatsApp from resolve (wa.me contact). Empty when none.
    whatsapp: "",
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
    // Haul fulfillment (design/handoffs/haul). These live inside an open haul,
    // on items already bought. They are not findStatus, which answers one
    // question on the shelf: did you buy it, or not?
    haulStage: "toOrder",
    haulVerdict: null,
    haulReason: null,
    haulActualGrams: null,
    // When the warehouse weight was entered. Kyle 2026-08-02 wanted the app to
    // show that a weight is the warehouse's real number, not a guess. The date
    // is what proves it, so it is saved beside the number.
    haulWeighedAt: null,
    haulVolumeCm3: null,
    haulStorageDays: null,
    haulOrderNo: "",
    haulStageAt: null,
    haulFit: null,
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
// A weighed or measured number a person typed. Zero and below mean "not known
// yet", so they read back as null rather than as a real measurement.
function positiveGramsOrNull(value) {
  return typeof value === "number" && isFinite(value) && value > 0 ? Math.round(value) : null;
}

// A moment the app recorded. Every writer passes Date.now(), which is a number,
// but an older save may hold a date string. Keep both, drop anything else.
function stampOrNull(value) {
  if (typeof value === "number" && isFinite(value) && value > 0) return value;
  if (typeof value === "string" && value) return value;
  return null;
}

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
    // A card saved under the old seven-stage pipeline keeps its answer:
    // anything past "want" means the customer bought it.
    findStatus: normalizeFindStatus(old.findStatus),
    price: typeof old.price === "number" && !isNaN(old.price) ? old.price : null,
    currency: old.currency || "CNY",
    priceUsd: typeof old.priceUsd === "number" && !isNaN(old.priceUsd) ? old.priceUsd : null,
    priceEur: typeof old.priceEur === "number" && !isNaN(old.priceEur) ? old.priceEur : null,
    priceFx:
      old.priceFx && typeof old.priceFx === "object" && !Array.isArray(old.priceFx)
        ? old.priceFx
        : null,
    priceManual: old.priceManual === true,
    // CH-07 follow-up: the hand-picked-category pin must survive migration
    // (backup restore, share import), same as the hand-set-price pin above.
    categoryManual: old.categoryManual === true,
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
    // Seller WhatsApp contact (digits or +country form); empty when none.
    whatsapp:
      typeof old.whatsapp === "string" && old.whatsapp.trim().length
        ? old.whatsapp.trim().slice(0, 32)
        : "",
    sizeNotes: typeof old.sizeNotes === "string" ? old.sizeNotes : "",
    // "Sign in to finish this card" survives a reload, so a card saved while
    // signed out still shows the reason it is empty.
    needsSignIn: old.needsSignIn === true,
    // Machine-read chart text is item data. It never shares the customer's
    // free-text sizeNotes field, and it never travels between seller items.
    sizeChartText: typeof old.sizeChartText === "string" ? old.sizeChartText.slice(0, 12000) : "",
    // A legacy borrowed chart with no exact sibling match stays hidden until
    // the customer clears it. This marker survives reloads.
    sizeChartNeedsClear: old.sizeChartNeedsClear === true,
    // Clearing an unmatched borrowed chart must preserve the customer's words.
    // Ignore sizeNotes for chart parsing until the customer changes that field.
    sizeChartIgnoreNotes: old.sizeChartIgnoreNotes === true,
    // Where the size chart came from (handoff turn 3 §5 provenance footer):
    // { via: "album-text"|"album-photos"|"desc-photos"|"gallery-photos"|
    //        "customer-photo"|"image-cache",
    //   photos: N scanned, at: ISO date, seller: legacy only,
    //   imageHash: exact chart image key for safe reuse }.
    // Written by the silent chart hunt and by the customer's own read.
    // imageHash is the only cross-item reuse key — never seller name.
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
            imageHash:
              typeof old.sizeChartSource.imageHash === "string"
                ? old.sizeChartSource.imageHash.slice(0, 160)
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
    // Haul fulfillment. The person's hand marking is the only record that
    // exists, so every one of these has to survive a reload. An item saved
    // before this feature reads as "not bought yet", which is the truth.
    haulStage: normalizeStage(old.haulStage),
    haulVerdict: normalizeVerdict(old.haulVerdict),
    haulReason: RED_REASONS.some((r) => r.key === old.haulReason) ? old.haulReason : null,
    haulActualGrams: positiveGramsOrNull(old.haulActualGrams),
    haulVolumeCm3: positiveGramsOrNull(old.haulVolumeCm3),
    haulStorageDays:
      typeof old.haulStorageDays === "number" &&
      isFinite(old.haulStorageDays) &&
      old.haulStorageDays >= 0
        ? Math.round(old.haulStorageDays)
        : null,
    haulOrderNo: typeof old.haulOrderNo === "string" ? old.haulOrderNo.slice(0, 64) : "",
    // Both dates accept a number or a string. Every writer passes Date.now(),
    // which is a number. A string-only test dropped the stage date on every
    // reload, so the app forgot when an item moved (found 2026-08-02).
    haulStageAt: stampOrNull(old.haulStageAt),
    haulWeighedAt: stampOrNull(old.haulWeighedAt),
    // How the size call turned out, once the item is in the person's hands.
    // This is the one answer that makes the next recommendation better than a
    // guess, so it has to survive a reload.
    haulFit: FIT_OPTIONS.includes(old.haulFit) ? old.haulFit : null,
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
    if (trimmed.length >= 3) push(classify(trimmed), trimmed, taokoulingTitle(trimmed));
    return { candidates, provider: "paste" };
  }
  for (const lineRaw of importLines) {
    const isBullet = /^\s*(?:[-*•❯›]|\d+[.)])\s+\S/.test(lineRaw);
    // (?!\d): "8.5/10" is a rating, not list item "8." — the strip used to
    // eat the whole number and save "5/10".
    const line = lineRaw.replace(/^[\s\-*•>”"]*(?:\d+[.)](?!\d)\s*)?/, "").trim();
    if (!line || line.length < 3) continue;
    // extractUrls, not a local regex: trims trailing punctuation, repairs
    // space-broken hosts, deobfuscates Reddit markup, dedupes (audit fix 1+2).
    const urls = extractUrls(line);
    if (urls.length === 0) {
      // A bare line becomes a card ONLY when it carries a list marker — that
      // is a real list the user wrote. Unmarked bare lines in a shredded
      // paste are page chrome ("Open chat", "Upvote", "Expand user menu")
      // and must never become cards (Kyle 2026-07-24: one copied Reddit
      // page turned into 174 junk cards).
      if (isBullet && line.length >= 8 && /[a-z]/i.test(line))
        push(classify(line), line, taokoulingTitle(line));
      continue;
    }
    const label = shareTextLabel(line);
    // One line = one item. The first URL is primary; the rest become paired links
    // via createItem's rawText inference (yupoo photos + weidian buy stay together).
    const parsed = classify(urls[0]);
    if (parsed.url) push(parsed, line, label.length > 2 ? label : "");
  }
  return { candidates, provider: "paste" };
}

// Notes cap at `max` chars for storage, but the cut lands on the last word
// boundary inside the window — a mid-word slice reads as a parser bug. Falls
// back to the hard cut when the window holds no usable boundary (one giant
// word), and never cuts so early that most of the budget goes unused.
export function clipNote(note, max = 500) {
  const text = String(note || "");
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const boundary = cut.match(/\s+\S*$/);
  const end = boundary && boundary.index > max * 0.5 ? boundary.index : max;
  return cut.slice(0, end).trimEnd();
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
    // Keep free-text notes; the hard cap remains for storage, but the cut
    // lands on a word boundary instead of mid-word (DECISION 2026-08-04:
    // keep the 500 cap — overridable — only the cut point moves). Structured
    // fields above already hold fit/size so a 500-char cut is less harmful.
    if (c.note) extra.note = clipNote(c.note);
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
// onFailCode (2026-08-04): a 422 carries a `code` naming the paste mistake
// (shop root, category page) — the failure body used to be thrown away and
// the card sat blank. Optional; the return contract is unchanged.
export async function fetchYupooImages(albumUrl, { signal, onFailCode } = {}) {
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
    if (!res.ok) {
      if (onFailCode) onFailCode(await linkFailCode(res));
      return null;
    }
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

// ── "Sign in to read this link" (2026-07-30) ────────────────────────────────
//
// A signed-out visitor gets five complete cards. After that every paid
// function answers 401 with code "sign_in_required". Any OTHER 401 is a real
// authorization fault — a bad token, a forged call — and must NOT show the
// sign-in message, so the code is checked and the status alone is not enough.
async function isSignInRefusal(res) {
  if (!res || res.status !== 401) return false;
  try {
    const data = await res.clone().json();
    return !!(data && data.code === "sign_in_required");
  } catch {
    return false;
  }
}

async function allowanceRefusal(res) {
  if (!res || res.status !== 429) return null;
  try {
    const data = await res.clone().json();
    const error = String((data && data.error) || "");
    if (error.startsWith("Free ")) return "free";
    if (error.startsWith("Monthly ")) return "monthly";
  } catch {}
  return null;
}

// The 422 from resolve/yupoo carries a machine-readable `code` naming WHICH
// kind of link failed (same convention as sign_in_required above). The card
// stores it as item.failCode so DetailBody can say "that is a shop front
// page" instead of sitting blank (2026-08-04 audit: six dead links, four
// causes, one useless generic message). Unknown/absent codes stay "" — the
// UI keeps its old fallback line for those.
const LINK_FAIL_CODES = new Set([
  "shop-front",
  "agent-short",
  "yupoo-category",
  "yupoo-shop-root",
  "link-cut-off",
  "short-link-dead",
]);
async function linkFailCode(res) {
  if (!res || res.status !== 422) return "";
  try {
    const data = await res.clone().json();
    const code = data && data.code;
    return LINK_FAIL_CODES.has(code) ? code : "";
  } catch {
    return "";
  }
}

// Module-level readers (the chart hunt, the description-photo refetch) run
// outside React, so they report the refusal through this hook. The component
// registers it on mount and uses it to stop making blank cards.
let signInRequiredHook = null;
export function setSignInRequiredHook(fn) {
  signInRequiredHook = typeof fn === "function" ? fn : null;
}
function noteSignInRequired() {
  if (signInRequiredHook) signInRequiredHook();
}

let allowanceRequiredHook = null;
export function setAllowanceRequiredHook(fn) {
  allowanceRequiredHook = typeof fn === "function" ? fn : null;
}
function noteAllowanceRequired(kind, feature) {
  if (allowanceRequiredHook) allowanceRequiredHook(kind, feature);
}

// FIX 0 (2026-08-02): chart-vision 401/403 must not look like "no chart".
// A frozen sentinel (never a string) so callers can branch without parsing
// error text. Plain success stays a string; plain miss stays null.
export const CHART_AUTH_REQUIRED = Object.freeze({ authRequired: true });
export const CHART_AUTH_COPY = "You are signed out. Sign in to read charts.";
export function isChartAuthRequired(result) {
  return !!(result && typeof result === "object" && result.authRequired === true);
}
// Chart UI sign-in button must open the sign-in window itself.
// #31d (Kyle 2026-08-04): it used to ride the import wall's hook, which opens
// the plans sheet — "when you click sign in, it takes you to the pro versus
// free modal. Why are you taking me there if I just need to sign in?" The app
// registers openSignIn here on mount. The import wall keeps its own hook:
// there the plans sheet is deliberate (Rule 2: every limit wall, one sheet).
let chartSignInHook = null;
export function setChartSignInHook(fn) {
  chartSignInHook = typeof fn === "function" ? fn : null;
}
export function requestChartSignIn() {
  if (chartSignInHook) chartSignInHook();
  else noteSignInRequired();
}

// FIX 2b (2026-08-03): a spent chart-read allowance must not look like a bad
// photo. Same sentinel pattern as FIX 0. Cap-skip never counts as a read.
export const CHART_CAP_REACHED = Object.freeze({ capReached: true });
export function isChartCapReached(result) {
  return !!(result && typeof result === "object" && result.capReached === true);
}
// Kyle 2026-08-03: a slow server, a timeout, or no internet still printed
// "I could not read that photo." That blames the customer's photo for a
// failure the photo did not cause. Same sentinel pattern as FIX 0 and FIX 2b.
// A failure to REACH the reader is never a failure to READ.
export const CHART_UNAVAILABLE = Object.freeze({ unavailable: true });
export const CHART_OFFLINE = Object.freeze({ unavailable: true, offline: true });
export function isChartUnavailable(result) {
  return !!(result && typeof result === "object" && result.unavailable === true);
}
export function isChartOffline(result) {
  return isChartUnavailable(result) && result.offline === true;
}
// Kyle 2026-08-04: a 429 is not always a plan cap. The server's traffic
// guards (the per-minute window and the site-wide daily cost ceiling) carry
// their own codes now, and each gets its own sentence. Before this, every
// one of them printed "You used your 8 free chart reads" — the owner read
// that on an unlimited account while the plan was never the problem.
export const CHART_RATE_LIMITED = Object.freeze({ rateLimited: true });
export function isChartRateLimited(result) {
  return !!(result && typeof result === "object" && result.rateLimited === true);
}
export const CHART_READER_OFF = Object.freeze({ readerOff: true });
export function isChartReaderOff(result) {
  return !!(result && typeof result === "object" && result.readerOff === true);
}
export const CHART_RATE_LIMITED_COPY =
  "A lot of chart reads are happening at once. Wait one minute, then open this card again.";
export const CHART_READER_OFF_COPY =
  "The chart reader reached today's limit. It comes back tomorrow.";
export const CHART_UNAVAILABLE_COPY =
  "Credenza could not reach the chart reader. Your photo is fine. Try again in a minute.";
export const CHART_OFFLINE_COPY =
  "Your device is offline. Connect to the internet, then read this photo again.";
// The silent hunt has no customer photo behind it, so it cannot say "your
// photo is fine". It says the same thing about the item instead: unknown.
export const CHART_HUNT_UNAVAILABLE_COPY =
  "Credenza could not reach the chart reader. This item may still have a chart. Try again in a minute.";

// Free plan lifetime chart reads (must match PLAN_CAPS / server entitlements).
export function chartCapLimitN(plan = planForLimits) {
  if (plan && plan.lim && typeof plan.lim.chartVisionTotal === "number") {
    return plan.lim.chartVisionTotal;
  }
  return PLAN_CAPS.free.chartVisionTotal;
}
// Honest cap copy with the real N. Free signed-in → upgrade; guest → sign in.
// Kyle 2026-08-04 #31: the old fallback printed "Sign in for more" to EVERY
// non-free plan — the owner read that on his unlimited account. A paying
// customer gets the monthly sentence; the owner never reaches this wall (the
// server skips his cap), so anything left is a guest.
export function chartCapCopy(plan = planForLimits) {
  const n = chartCapLimitN(plan);
  if (plan && plan.state === "free") {
    return "You used your " + n + " free chart reads. Upgrade for more.";
  }
  if (plan && (plan.state === "pro" || plan.state === "grace")) {
    return "You used your monthly chart reads. More arrive next month.";
  }
  if (plan) {
    // Signed in, not free, not paying: owner. The server never caps him, so
    // this wall is a leftover from before the codes. Say nothing false.
    return CHART_HUNT_UNAVAILABLE_COPY;
  }
  return "You used your " + n + " free chart reads. Sign in for more.";
}
// True when the free signed-in plan is the one that hit the wall (upgrade CTA).
export function chartCapWantsUpgrade(plan = planForLimits) {
  return !!(plan && plan.state === "free");
}
// True when a guest hit the wall — the only state whose CTA is sign-in.
export function chartCapWantsSignIn(plan = planForLimits) {
  return !plan;
}

// Kyle 2026-08-03, Weidian item 7796666481: "why didn't this get pulled in.
// is because im out of free cards? if so we need to delegate the reason that
// this was not pulled in BECAUSE the customer is out of cards".
//
// Yes. On Weidian the size chart lives in the Product Details feed. Fetching
// that feed costs one card. fetchDescImages returns nothing once the free
// cards are spent, so the chart never becomes a read candidate. The read then
// pays for three product shots, finds no table, and blames the photo.
//
// These two say the real reason instead. The card credit and the chart read
// are separate counts, so this needs its own sentence.
export function chartCardsCapCopy(plan = planForLimits) {
  const n =
    plan && plan.lim && typeof plan.lim.resolveTotal === "number"
      ? plan.lim.resolveTotal
      : PLAN_CAPS.free.resolveTotal;
  const head = "This chart sits in the seller's product details. Reading it costs one card. ";
  if (plan && plan.state === "free") {
    return head + "You used your " + n + " free cards. Upgrade for more.";
  }
  return head + "You used your " + n + " free cards. Sign in for more.";
}
// True when the chart is out of reach only because the cards ran out: the card
// holds no chart photo and no product-details photo, the link is still
// resolvable, and the free card count is spent.
export function chartNeedsCards(item, plan = planForLimits) {
  if (!item) return false;
  const has = (list) => Array.isArray(list) && list.length > 0;
  if (has(item.descImages) || has(item.chartImages)) return false;
  if (!resolvableBuyUrl(item)) return false;
  return overFreeLimit(plan, "resolve");
}

// Limits sheet (same one the header pill opens) for the free-plan upgrade CTA.
let limitsOpenHook = null;
export function setLimitsOpenHook(fn) {
  limitsOpenHook = typeof fn === "function" ? fn : null;
}
export function requestChartLimits() {
  if (limitsOpenHook) limitsOpenHook();
}

// Ask the vision function to read a size chart out of album PHOTOS — the
// common Yupoo case where the chart exists only as a picture (Kyle's "the
// chart is right there in the photos" report, 2026-07-22). Returns chart text
// in the same format parseSizeChart reads, CHART_AUTH_REQUIRED on 401/403,
// CHART_CAP_REACHED on over-cap / 429, or null when nothing was found.
// `referer` should be the album page URL: the photo CDN rejects requests
// whose referer is not a yupoo album page.
// One poster for both chart-vision inputs. `images` are CDN URLs the server
// fetches through its allowlist; `photos` are inline base64 frames the customer
// took or picked, which no allowlist can cover because a camera frame has no
// URL. Handoff turn 9 §3: "the same parser endpoint as a clipboard paste — one
// ingest path, image or text". Two exported wrappers keep the call sites plain.
async function postChartVision({ images, photos, signal, referer }) {
  // FIX 2c: a reader we cannot REACH is not a photo we cannot READ. Both of
  // these mean the request never left the device, so they answer with the
  // unavailable sentinel and the UI keeps the customer's photo out of it.
  if (!PREVIEW_SECRET) return CHART_UNAVAILABLE;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return CHART_OFFLINE;
  // Part 7e + FIX 2b: a signed-in FREE user over the allowance skips the cloud
  // read and returns a distinct sentinel — never null, so the UI never claims
  // "could not read that photo" for a spent allowance. Cap-skip does not count.
  if (overFreeLimit(planForLimits, "chartVision")) return CHART_CAP_REACHED;
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
    // LB-59. Count AFTER the status check, never before it. The server counts a
    // chart read at chart-vision.js:281 — after Anthropic answered, so a 502
    // "Chart read failed", a 504 timeout, a 413, and the 429 plan cap itself
    // all cost the account nothing there. The client counter is the one that
    // BLOCKS (overFreeLimit above returns early on it), so a client that counted
    // failures used to spend attempts instead of successful reads and burned
    // the second one on an outage the user did not cause. Both 200 bodies still
    // count, found:true and found:false alike, because the model was called
    // either way — /guides/what-spends-a-chart-read/ says so in those words.
    if (!res.ok) {
      // FIX 0: ANY 401/403 from chart-vision is an auth wall (expired session,
      // missing bearer, free-card exhaustion with sign_in_required, etc.).
      // Map them all to the same signed-out result so the UI never claims
      // "no chart" or "could not read that photo" for a sign-in problem.
      if (res.status === 401 || res.status === 403) {
        noteSignInRequired();
        return CHART_AUTH_REQUIRED;
      }
      // FIX 2b: server plan cap (paid-gate 429) is not a bad photo. A
      // concurrency "Busy" 429 carries busy:true and is the opposite: a free,
      // retryable moment — the limiter stopped the request before the meter
      // (Kyle 2026-08-04: one Busy used to end the whole hunt).
      // Kyle 2026-08-04 #31: the limiter's other 429s carry `code` —
      // rate_limited (per-minute window) and daily_ceiling (site-wide spend
      // guard) are NOT the plan cap, and must never print the plan-cap
      // sentence. An unknown or missing code keeps the old plan-cap reading:
      // that is the only 429 a function without codes can send.
      if (res.status === 429) {
        let code = "";
        try {
          const errBody = await res.json();
          if (errBody && errBody.busy === true) return CHART_UNAVAILABLE;
          code = String((errBody && errBody.code) || "");
        } catch {
          code = "";
        }
        if (code === "rate_limited") return CHART_RATE_LIMITED;
        if (code === "daily_ceiling") return CHART_READER_OFF;
        return CHART_CAP_REACHED;
      }
      // FIX 2c: everything left here is the server failing, not the photo —
      // a 502 "Chart read failed", a 504 timeout, a 413 too-large frame.
      return CHART_UNAVAILABLE;
    }
    bumpUsage("chartVision", { audience: usageAudience(planForLimits) });
    trackProductEvent("usage_success", { plan: usageAudience(planForLimits), feature: "chart_read" });
    const data = await res.json();
    // The ONE honest "this photo has no table in it". Only this path is null.
    if (!data || !data.found || typeof data.chartText !== "string") return null;
    return data.chartText.trim() || null;
  } catch {
    // FIX 2c: a network throw or the 30s timeout above. The photo is fine.
    return CHART_UNAVAILABLE;
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

// Legacy cleanup for the removed seller-level chart fallback. Old versions
// appended another item's complete chart text to sizeNotes. Remove that block
// only when it exactly equals a sibling item's old chart text. Any unmatched
// value stays untouched and hidden until the customer clears it.
const LEGACY_READ_VIA = new Set([
  "album-text",
  "album-photos",
  "chart-photos",
  "desc-photos",
  "gallery-photos",
  "customer-photo",
]);

function legacyChartTextFor(item) {
  return [item && item.sizeNotes, item && item.summary, item && item.rawText, item && item.note]
    .filter(Boolean)
    .join("\n");
}

function stripExactAppendedChart(sizeNotes, borrowedText) {
  const notes = typeof sizeNotes === "string" ? sizeNotes : "";
  if (!borrowedText) return null;
  if (notes === borrowedText) return "";
  const suffix = "\n" + borrowedText;
  return notes.endsWith(suffix) ? notes.slice(0, -suffix.length).trimEnd() : null;
}

export function cleanLegacySellerCharts(items) {
  const list = Array.isArray(items) ? items : [];
  // This one-time legacy repair scans siblings for each imported item.
  // Shelf limits keep the quadratic scan small; correctness needs the exact match.
  return list.map((item) => {
    if (!item || !item.sizeChartSource || item.sizeChartSource.via !== "seller-cache") return item;
    const seller = String(item.sizeChartSource.seller || item.seller || "").trim().toLowerCase();
    let cleanedNotes = null;
    if (seller) {
      for (const sibling of list) {
        if (!sibling || sibling.id === item.id) continue;
        const source = sibling.sizeChartSource;
        if (!source || !LEGACY_READ_VIA.has(source.via)) continue;
        const owner = String(source.seller || sibling.seller || "").trim().toLowerCase();
        if (owner !== seller) continue;
        const siblingText = legacyChartTextFor(sibling);
        cleanedNotes = stripExactAppendedChart(item.sizeNotes, siblingText);
        if (cleanedNotes !== null) break;
      }
    }
    return {
      ...item,
      sizeNotes: cleanedNotes === null ? item.sizeNotes : cleanedNotes,
      sizeChartText: "",
      sizeChartSource: null,
      sizeChartNeedsClear: cleanedNotes === null,
    };
  });
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
  if (overFreeLimit(planForLimits, "resolve")) {
    noteAllowanceRequired("free", "resolve");
    return [];
  }
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
    // LB-59, same rule as postChartVision: resolve.js records at line 784, on
    // the 200 path only. A 422 "Not a resolvable buy link" is the common one
    // here, and charging a day's quota for pasting a link the server will not
    // even try is the worst version of the bug.
    if (!res.ok) {
      if (await isSignInRefusal(res)) noteSignInRequired();
      else {
        const allowance = await allowanceRefusal(res);
        if (allowance) noteAllowanceRequired(allowance, "resolve");
      }
      return [];
    }
    bumpUsage("resolve", { audience: usageAudience(planForLimits) });
    trackProductEvent("usage_success", { plan: usageAudience(planForLimits), feature: "card_read" });
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
/* The open haul is the one page allowed past 1080px (STEPS-HANDOFF item 3).
   The modifier rule lives in credenza-fashion.css beside the data-fashion
   shell rule it must outrank; the .cz-shell base rule itself never changes. */
@media (max-width: 480px) { .cz-shell { padding: 16px 14px 0; } }
/* Kyle 2026-07-27: "The top is a little bland." The masthead had no edge. A
   mark, a link row and an avatar floated on the bare canvas, so the page began
   with nothing — the first thing that looked like a boundary was the search
   field. The hairline gives the header a bottom, which is the whole of what a
   masthead is. The padding is what makes the rule read as the header's own
   edge rather than a stray divider. */
.cz-masthead { display: flex; align-items: center; justify-content: space-between; padding-bottom: 14px; margin-bottom: 18px; border-bottom: 1px solid var(--cz-hair); }
/* Lockup L2, stacked kicker (logo spec, Kyle 2026-07-26). "Fashion" used to
   sit on CREDENZA's baseline at a second size, weight and colour — two of
   everything on one line, so neither read as dominant. Stacking it costs zero
   horizontal room, which is why the kicker now SURVIVES the compact phone
   masthead instead of being dropped when the shelf fills. */
.cz-brand { display: inline-flex; align-items: center; gap: 12px; margin: 0; color: var(--cz-ink); font-size: 19px; font-weight: 800; letter-spacing: .16em; }
/* The lockup is a link (Kyle 2026-08-03). Inherit the lockup's look — no
   underline, no link blue — and keep the mark and the words on one flex row.
   The radius only shapes the keyboard focus ring. */
.cz-brand-link { display: inline-flex; align-items: center; gap: 12px; color: inherit; letter-spacing: inherit; text-decoration: none; border-radius: 8px; }
.cz-brand-name { display: inline-flex; flex-direction: column; align-items: flex-start; gap: 4px; line-height: 1; }
/* 19px, up from 16 (Kyle 2026-07-27: "The top is a little bland"). At 16 the
   wordmark measured smaller than the shelf's own section heading, so the page
   named its sections louder than it named itself. The phone masthead keeps its
   own compact sizes below — this is the desktop lockup only. */
.cz-brand-word { font-size: 19px; letter-spacing: .16em; line-height: 1; }
.cz-brand-sub { font-size: 10.5px; font-weight: 700; letter-spacing: .34em; line-height: 1; color: var(--cz-faint); text-transform: uppercase; }
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
// Order status display maps. FIND_STATUSES itself lives in
// credenza-find-status.js (shared with the Ask serializer); the labels and the
// colours are display-only and stay here.
//
// Two values only (shelf handoff 2026-07-28, Kyle's call). One question, one
// answer: did you buy it, or not? The seven-stage pipeline is gone. See the
// note in credenza-find-status.js for why.
export const FIND_STATUS_LABELS = {
  want: "Not bought",
  bought: "Bought",
};
export const FIND_STATUS_LONG = FIND_STATUS_LABELS;

export const FIND_STATUS_COLORS = {
  want: { bg: "oklch(0.35 0.02 280)", text: "oklch(0.85 0 0)", dot: "oklch(0.7 0.02 280)" },
  bought: { bg: "oklch(0.3 0.08 145)", text: "oklch(0.85 0.1 145)", dot: "oklch(0.6 0.14 145)" },
};

// Shelf filter strip (shelf handoff 2026-07-28). One chip is active at a time
// and every chip carries a live count. Order is fixed: the whole shelf first,
// then the three answers a customer actually asks the shelf for.
// Design 7a (2026-07-31): glyph segmented control. Key "starred" stays so
// stored prefs keep working; the face label is "Likes".
export const SHELF_FILTERS = [
  { key: "all", label: "All", Icon: LayoutGrid },
  { key: "starred", label: "Likes", Icon: Heart },
  { key: "tobuy", label: "To buy", Icon: Tag },
  { key: "bought", label: "Bought", Icon: Check },
];

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
//
// DETAIL_PHOTO_CAP is the one cap for every detail-panel photo list (round 5
// point 5.2, 2026-07-29). Two caps used to live in two files — 24 for the
// desktop strip, 12 for the sizing album — and the mismatch made the two
// photo counts disagree without saying why.
export const DETAIL_PHOTO_CAP = 24;
export function itemPhotoList(item, max) {
  const photos = mergeFashionImages(item.image ? [item.image] : [], item.gallery || []);
  return max == null ? photos : photos.slice(0, max);
}

// Manual "Read the N album photos" candidates (Fix 1, 2026-08-02).
// chartImages are held out of the swipe gallery on purpose (cover quality),
// but the album-read button exists to find a size chart — so known chart
// tiles must lead the paid list. Product photos follow. Dedupe by URL.
// Remote http(s) only: the vision door fetches CDN URLs, not data: frames.
export function sizingAlbumReadCandidates(item, max = DETAIL_PHOTO_CAP) {
  const remote = (src) => typeof src === "string" && /^https?:\/\//i.test(src);
  const charts = (Array.isArray(item && item.chartImages) ? item.chartImages : []).filter(remote);
  const product = itemPhotoList(item, max == null ? undefined : max).filter(remote);
  const seen = new Set();
  const out = [];
  for (const src of [...charts, ...product]) {
    if (seen.has(src)) continue;
    seen.add(src);
    out.push(src);
    if (max != null && out.length >= max) break;
  }
  return out;
}

// A CDN path that ends in _WIDTH_HEIGHT before the extension gives the shape
// without a download (…-unadjust_1080_776.jpg). A size table is wider than it
// is tall; a product shot is square or taller. Same 1.25 rule resolve.js uses
// to hold tables out of the gallery. Unknown shape is never a reject.
function looksChartShaped(url) {
  const m = /_(\d{2,5})_(\d{2,5})(?:\.[a-z0-9]+)?$/i.exec(String(url || "").split("?")[0]);
  if (!m) return false;
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (!w || !h) return false;
  return w / h > 1.25;
}

// Kyle 2026-08-03, Weidian item 7796666481: "why didn't this get pulled in".
// The size chart was in plain sight on the listing, and the read still failed.
//
// On Weidian the chart lives in the Product Details feed, not the gallery.
// resolve.js holds every table-shaped photo OUT of the gallery on purpose, so
// the chart reaches the card only as descImages. sizingAlbumReadCandidates
// never looked there, so pressing "Read the N album photos" paid for three
// product shots and then told the customer the photo was unreadable.
//
// This is the paid read order: known chart tiles, then Product Details with
// the table-shaped ones first, then product photos. The album row keeps its
// own list for the thumbs and the count, so the visible photo count still
// matches the swipe gallery.
export function sizingChartReadCandidates(item, max = DETAIL_PHOTO_CAP) {
  const remote = (src) => typeof src === "string" && /^https?:\/\//i.test(src);
  const charts = (Array.isArray(item && item.chartImages) ? item.chartImages : []).filter(remote);
  const desc = (Array.isArray(item && item.descImages) ? item.descImages : []).filter(remote);
  const shaped = desc.filter(looksChartShaped);
  const rest = desc.filter((src) => !looksChartShaped(src));
  const seen = new Set();
  const out = [];
  for (const src of [...charts, ...shaped, ...rest, ...sizingAlbumReadCandidates(item, max)]) {
    if (seen.has(src)) continue;
    seen.add(src);
    out.push(src);
    if (max != null && out.length >= max) break;
  }
  return out;
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

// The chip run in the detail panel (SIZE_CHIP_COMPACT_PLAN, 2026-07-29):
// four full words ("Medium", "X-Large", …) plus the Other box overflowed one
// row, so the chips print the short mark the seller wrote — "XL", not
// "X-Large". The card face and hero line keep the full words via
// formatSizeToken; Kyle's full-word ruling never named the chip row. Free-
// and one-size tokens have no short mark, so they print "Free" / "OS".
// Everything else falls back to formatSizeToken (waist numbers, odd tokens).
export function compactSizeToken(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  const key = s.toLowerCase().replace(/\s+/g, "");
  if (key === "free" || key === "f" || key === "均码") return "Free";
  if (key === "one" || key === "os") return "OS";
  // A letter size the word map knows prints as the short mark it came in as.
  if (SIZE_WORD_LABELS[key]) return s.toUpperCase();
  return formatSizeToken(s);
}

// Height + weight stand in for the tape-measure fields most customers do not
// know (Kyle 2026-07-25: he set his numbers and got no recommendation
// anywhere — recommendSize only reads chest/waist/hip). The estimate scales
// a reference build (BMI 22) by the customer's BMI: the waist tracks weight
// hardest, the chest least. Measured fields always win. The result is
// flagged `estimated` so no surface calls the pick "precise" and nothing
// persists it over a later measured profile.
export function migrateSleeveMeasurements(profile) {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) return profile;
  let changed = false;
  const next = { ...profile };
  if (Object.prototype.hasOwnProperty.call(next, "sleeve")) {
    if (next.longSleeve == null) next.longSleeve = next.sleeve;
    delete next.sleeve;
    changed = true;
  }
  if (next.garment && typeof next.garment === "object" && !Array.isArray(next.garment)) {
    const garment = { ...next.garment };
    if (Object.prototype.hasOwnProperty.call(garment, "sleeve")) {
      if (garment.shortSleeve == null) garment.shortSleeve = garment.sleeve;
      delete garment.sleeve;
      next.garment = garment;
      changed = true;
    }
  }
  return changed ? next : profile;
}

export function effectiveBodyProfile(profile) {
  if (!profile || typeof profile !== "object") return null;
  const migrated = migrateSleeveMeasurements(profile);
  const h = Number(migrated.height);
  const w = Number(migrated.weight);
  const canEstimate =
    isFinite(h) && h >= 120 && h <= 230 && isFinite(w) && w >= 35 && w <= 250;
  if (!canEstimate) return migrated;
  const bmi = Math.min(40, Math.max(16, w / Math.pow(h / 100, 2)));
  const ratio = bmi / 22;
  const half = (n) => Math.round(n * 2) / 2;
  const out = { ...migrated };
  // Which fields are guesses, not measurements. The FIT READ table warned
  // against a hip it had invented from height and weight, which breaks the
  // app's own rule: never grade a guess (Kyle 2026-07-30). Naming the guessed
  // fields lets that table show the number and pass no judgement.
  const estimatedFields = [];
  if (out.chest == null) {
    out.chest = half(0.52 * h * Math.pow(ratio, 0.6));
    estimatedFields.push("chest");
  }
  if (out.waist == null) {
    out.waist = half(0.45 * h * Math.pow(ratio, 0.85));
    estimatedFields.push("waist");
  }
  if (out.hip == null) {
    out.hip = half(0.47 * h * Math.pow(ratio, 0.7));
    estimatedFields.push("hip");
  }
  if (estimatedFields.length) {
    out.estimated = true;
    out.estimatedFields = estimatedFields;
  }
  return out;
}

export function computeRecommendedSize(item, bodyProfile, fitPrefs = null) {
  if (!item || !bodyProfile) return null;
  if (SIZE_PICK_SKIP_CATEGORIES.has(item.category)) return null;
  // AI size only when a real chart parses. A stale recommendedSize without
  // chart text must not label the card "AI size" (usual-size fallback path).
  const chart = parseSizeChart(sizeChartTextFor(item));
  if (!chart) return null;
  if (item.recommendedSize) return String(item.recommendedSize).trim() || null;
  const catPref =
    fitPrefs && item.category && fitPrefs[item.category]
      ? fitPrefs[item.category]
      : null;
  const rec = recommendSize(
    chart,
    effectiveBodyProfile(bodyProfile),
    item.category,
    catPref,
    null,
    item.title,
    elasticEvidenceTextFor(item)
  );
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

// Shoe size tokens (spec step 3, 2026-08-08). Men's US ↔ EU is EU = US + 33,
// which lands every row of the standard men's table (US 8 = EU 41, US 10 =
// EU 43). A bare number reads as EU from 35 up and as US up to 15: shoe
// listings print EU as a bare number far more often than US.
export function parseShoeSizeToken(value) {
  const s = String(value || "").trim().toUpperCase();
  if (!s) return null;
  const eu = s.match(/^EU\s?(\d{2}(?:\.5)?)$/);
  if (eu) return { system: "eu", n: parseFloat(eu[1]) };
  const us = s.match(/^US\s?(\d{1,2}(?:\.5)?)$/);
  if (us) return { system: "us", n: parseFloat(us[1]) };
  const bare = s.match(/^(\d{1,2}(?:\.5)?)$/);
  if (bare) {
    const n = parseFloat(bare[1]);
    if (n >= 35) return { system: "eu", n };
    if (n <= 15) return { system: "us", n };
  }
  return null;
}

function shoeSizeLabel(system, n) {
  return (system === "eu" ? "EU " : "US ") + n;
}

// The converted partner: EU 43 → US 10, US 10 → EU 43.
export function shoeSizeAlt(system, n) {
  if (system === "eu") return { system: "us", n: n - 33 };
  if (system === "us") return { system: "eu", n: n + 33 };
  return null;
}

// Chip face for the no-chart pick screen: "EU 43 · US 10". Empty when the
// token is not a shoe size, so letter sizes keep their plain mark.
export function shoeChipLabel(value) {
  const p = parseShoeSizeToken(value);
  if (!p) return "";
  const alt = shoeSizeAlt(p.system, p.n);
  return shoeSizeLabel(p.system, p.n) + " · " + shoeSizeLabel(alt.system, alt.n);
}

// The usual-size sentence, converted: "US 10 (about EU 43)". Empty when the
// saved usual is not a shoe size.
export function shoeUsualLabel(value) {
  const p = parseShoeSizeToken(value);
  if (!p) return "";
  const alt = shoeSizeAlt(p.system, p.n);
  return shoeSizeLabel(p.system, p.n) + " (about " + shoeSizeLabel(alt.system, alt.n) + ")";
}

// The chip run must cover the buyer's converted usual size (Kyle 2026-08-08:
// "a US 10 needs chips up to EU 43+, not 39"). The chips speak the LISTING's
// scale, so the usual converts into the run's own system before the compare.
// The run returns in numeric order: seller variant order is noise (Kyle's
// 2026-08-08 listing ran 41, 42, 43, 46, 44, 45 and the chips read as broken).
// Extends only a shoe-like run and matches the run's token style (bare number
// vs labelled). Letter runs pass through untouched.
export function extendShoeRun(runValues, usualSize) {
  const run = Array.isArray(runValues) ? runValues.slice() : [];
  const parsed = run.map((v) => parseShoeSizeToken(v));
  const first = parsed.find(Boolean);
  if (!first) return run;
  const sys = first.system;
  const entries = run.map((v, i) => ({ v, p: parsed[i] }));
  const u = parseShoeSizeToken(usualSize);
  if (u) {
    const inRunScale = sys === u.system ? u : shoeSizeAlt(u.system, u.n);
    if (!parsed.some((p) => p && p.system === sys && p.n === inRunScale.n)) {
      const bareStyle = run.some(
        (v, i) => parsed[i] && String(v).trim().toUpperCase() === String(parsed[i].n)
      );
      const token = bareStyle ? String(inRunScale.n) : shoeSizeLabel(sys, inRunScale.n);
      entries.push({ v: token, p: inRunScale });
    }
  }
  const keyOf = (p) => (p.system === sys ? p.n : shoeSizeAlt(p.system, p.n).n);
  const parseable = entries.filter((e) => e.p);
  parseable.sort((a, b) => keyOf(a.p) - keyOf(b.p));
  // Tokens the parser cannot read (rare in a shoe run) keep their relative
  // order at the end rather than vanishing.
  const rest = entries.filter((e) => !e.p);
  return [...parseable.map((e) => e.v), ...rest.map((e) => e.v)];
}

// Size options: listing variants first, then common apparel/shoe sizes.
export function sizeSuggestionsFor(item) {  const group = (item?.variants || []).find((g) => /size|尺码|尺寸/i.test(g.title || ""));
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

// A machine-read chart owns its field and wins over free text. A customer can
// still paste a chart into sizeNotes or note when the machine field is empty.
// A blocked legacy borrowed chart returns nothing until the customer clears it.
// Clearing can preserve sizeNotes while excluding that field from chart parsing.
export function sizeChartTextFor(item) {
  if (!item || item.sizeChartNeedsClear) return "";
  if (item.sizeChartText) return item.sizeChartText;
  return [
    item.sizeChartIgnoreNotes ? "" : item.sizeNotes,
    item.summary,
    item.rawText,
    item.note,
  ]
    .filter(Boolean)
    .join("\n");
}

// C's audit, round 2 (2026-08-02): sizeChartTextFor returns sizeChartText
// ALONE the moment a machine chart has parsed, which starves the waist-floor
// elastic detector — a numeric parsed chart hides "elastic waistband" sitting
// in summary/sizeNotes/rawText/note. Chart PARSING must keep that early
// return (a machine field wins, full stop); elastic EVIDENCE must not. This
// reads every free-text field regardless of which one fed the parser.
export function elasticEvidenceTextFor(item) {
  if (!item) return "";
  return [item.sizeChartText, item.sizeNotes, item.summary, item.rawText, item.note]
    .filter(Boolean)
    .join("\n");
}

// A customer-provided sizeNotes value is new evidence. Let the chart parser
// read it again after a blocked legacy chart made the old field untrusted.
export function restoreChartNotesOnEdit(patch) {
  if (
    patch &&
    typeof patch === "object" &&
    Object.prototype.hasOwnProperty.call(patch, "sizeNotes") &&
    typeof patch.sizeNotes === "string"
  ) {
    return { ...patch, sizeChartIgnoreNotes: false };
  }
  return patch;
}

// Body measurements — the input half of the size pick. Lives in prefs, edited
// from the ⋯ menu. Storage is always cm/kg; the in/cm toggle (default in for
// US) only changes what the fields show and accept — switching converts the
// draft in place so nothing typed is lost. Every field optional; the
// recommender asks for whatever it's missing.
// Kyle 2026-07-27: "I think the measurements could use a little bit of a
// bigger, better thing." Eight identical boxes in one undifferentiated grid
// asked the reader to sort them, and a person filling this in is holding a
// tape measure in the other hand. The sixth column groups them the way the
// body does — you measure yourself once, top to bottom, and each group is a
// place to stop. BODY_MEASURE_GROUPS below sets the order and the headings.
export const BODY_PROFILE_FIELDS = [
  // key, label, kind ("length"|"weight"), placeholder cm, placeholder in, group
  ["height", "Height", "length", "178", "70", "you"],
  ["weight", "Weight", "weight", "70", "154", "you"],
  ["chest", "Chest", "length", "96", "38", "top"],
  ["shoulder", "Shoulder", "length", "45", "17.7", "top"],
  ["sleeve", "Arm length", "length", "62", "24.5", "top"],
  // Kyle 2026-07-30: the seller's 衣长 had nothing to compare against, so the
  // Body length row could only ever be information. This is that missing
  // number — shoulder seam to where the hem should sit. Storage key `length`
  // matches the chart's own key, so fitReadRows finds it with no mapping.
  // NOT the same thing as fitPref.length, which is Cropped / Regular / Long.
  ["length", "Shirt length", "length", "70", "27.5", "top"],
  ["waist", "Waist", "length", "80", "31.5", "bottom"],
  ["hip", "Hip", "length", "98", "38.5", "bottom"],
  // Kyle 2026-07-30: "the values should be the values of the seller charts."
  // The old boxes asked for an INSIDE leg. Every seller prints 裤长, the
  // OUTSIDE leg from the waistband to the hem, so an inside-leg number had
  // nothing to compare against and the app could only ever estimate. These
  // two ask for the same thing the seller prints. Storage keys match the
  // chart's own key, so the Length row needs no conversion and no guess.
  // The old `inseam` and `shortsInseam` values are left unread on purpose:
  // grading an inside leg against an outside leg names a wrong size.
  ["pantsLength", "Trouser length", "length", "104", "41", "bottom"],
  ["shortsLength", "Shorts length", "length", "46", "18", "bottom"],
];

// Heading and one-line reason per group. The reason answers "why does Credenza
// want this", which is the question that stops people halfway down the form.
export const BODY_MEASURE_GROUPS = [
  ["you", "You", "Sets the baseline every chart is read against."],
  ["top", "Upper body", "Decides the size on tees, shirts, jackets and hoodies."],
  ["bottom", "Lower body", "Decides the size on trousers, shorts and skirts."],
];
// Size facts live inside SizeRecommendation now — no second "Sizes" bubble.


// ── Haul routes (STEPS-HANDOFF item 1, 2026-08-03) ──────────────────────────
// Kebab-case the haul name for the address bar. The slug is derived, never
// stored: the name on the cards stays the one truth.
const haulSlugBase = (name) =>
  String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
// Two hauls can kebab-case to the same slug ("Winter" and "winter!"). Assign
// slugs in sorted order and suffix the later ones (winter, winter-2), so the
// map built from the same names is always the same map.
const haulSlugMap = (names) => {
  const map = new Map();
  const sorted = [...new Set(names.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  for (const name of sorted) {
    const base = haulSlugBase(name) || "haul";
    let slug = base;
    let n = 2;
    while (map.has(slug)) {
      slug = base + "-" + n;
      n += 1;
    }
    map.set(slug, name);
  }
  return map;
};
// Reverse lookup for pushes: the slug a haul name currently owns.
const haulSlugForName = (name, slugMap) => {
  for (const [slug, mapped] of slugMap) if (mapped === name) return slug;
  return haulSlugBase(name) || "haul";
};
// A parcel id is the haul slug plus the parcel letter: winter-a. Only parcel
// A exists today; the shape leaves room (STEPS-HANDOFF decision 7).
const PARCEL_ID_RE = /^([a-z0-9-]+)-([a-z])$/;

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
  // The card under QC review, by item id. null = the overlay is shut. The
  // overlay is a projection of the item, so this holds the id and nothing else
  // (design/handoffs/haul, screens 3 to 5).
  const [qcItemId, setQcItemId] = useState(null);
  // The card open in the haul item drawer, by item id. Same rule as QC review:
  // the drawer is a projection of the item (design/handoffs/haul, screen 8).
  const [haulDrawerId, setHaulDrawerId] = useState(null);
  // Whether the hand-off review screen is showing (haul handoff, screen 9).
  // It reads the same parcel numbers as the board, so it holds no state of
  // its own beyond being open.
  const [handoffOpen, setHandoffOpen] = useState(false);
  // Whether the tracking screen is showing (haul handoff, screens 10 and 11).
  // Every number on it is a projection of the same parcel record, so it holds
  // no state of its own beyond being open.
  const [trackingOpen, setTrackingOpen] = useState(false);
  // Haul routing (STEPS-HANDOFF item 1). haulOverlaySeqRef counts the overlay
  // entries pushed on top of /hauls/<slug> (drawer, QC, hand-off), so Back
  // peels them one at a time. haulBootRef/parcelBootRef mark a visit that
  // LANDED on the address — it owns no earlier entry, so closing rewrites
  // the address instead of going back (same rule as settingsBootRef).
  // haulRouteRef mirrors the live values for the one popstate listener, whose
  // effect closure would otherwise read stale state.
  const haulOverlaySeqRef = useRef(0);
  const haulBootRef = useRef(false);
  const parcelBootRef = useRef(false);
  const haulBootRanRef = useRef(false);
  const haulRouteRef = useRef({
    activeHaul: null,
    haulDrawerId: null,
    qcItemId: null,
    handoffOpen: false,
    trackingOpen: false,
    view: "shelf",
    reducedMotion: true,
    slugMap: new Map(),
  });
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
  const [currencySheetOpen, setCurrencySheetOpen] = useState(false);
  // A2 money pipe: which buying agent Buy deep-links into. Soft default with a
  // visible "change anytime" path; persisted in credenza-prefs-v1. Stored item
  // links stay canonical forever — the agent wrap happens only at open time.
  const [preferredAgent, setPreferredAgent] = useState(DEFAULT_AGENT_ID);
  // One-time "Opening in X" toast per agent; re-arms when the agent changes.
  const [agentToastSeenFor, setAgentToastSeenFor] = useState(null);
  // First-load view: the list everywhere (Kyle 2026-07-28: "make the number
  // one option the list view … the carousel the secondary option"). The
  // carousel stays one tap away in the view switcher. Stored viewMode prefs
  // are intentionally not restored — every session lands on the list.
  const [viewMode, setViewMode] = useState("cards");
  const [preferencesHydrated, setPreferencesHydrated] = useState(false);
  // Shelf filter strip (shelf handoff 2026-07-28). One chip is active at a
  // time: all | starred | tobuy | bought. This replaced the lone starred
  // heart, so `sortMode` below is now a derived read of the same state — one
  // source of truth, two names, because an older browser still stores sortMode.
  const [shelfFilter, setShelfFilter] = useState("all");
  const sortMode = shelfFilter === "starred" ? "starred" : "recent";
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
  // DesktopDetailPanel registers its t-modal requestClose here so Escape and
  // other shell handlers can play the close animation (Kyle item 7).
  const desktopPanelCloseRef = useRef(null);
  const closeCarouselOverlayRef = useRef(() => {});
  const openInCarouselRef = useRef(() => {});
  const stepDetailItemRef = useRef(() => {});
  // Focus management for the overlay (Part 5 a11y): root node + the control
  // that opened it, so close can return focus.
  const overlayRef = useRef(null);
  const overlayTriggerRef = useRef(null);
  // Design handoff PR3 (2026-07-23): the capture bar and the avatar menu own
  // the old bottom-bar ⋯ menu's jobs. captureSheetOpen controls the review
  // surface behind the Stash pill.
  const [captureSheetOpen, setCaptureSheetOpen] = useState(false);
  // Mobile handoff C2/C4 (2026-07-25). The phone masthead collapsed to one
  // row, so search hides behind an icon.
  const [searchOpen, setSearchOpen] = useState(false);
  // Design 7b: "Likes only" inside the search sheet. Stays on until the
  // person turns it off, even after the sheet closes.
  const [likesOnly, setLikesOnly] = useState(false);
  // Recent search chips — last few non-empty queries the person ran.
  const [searchRecent, setSearchRecent] = useState([]);
  // Routed settings page (Profile Settings design, Phase 1). Replaces the
  // modal stack one section at a time: /settings/<section> is a real URL
  // with history, pushed on entry and peeled by the browser Back button.
  // { section } — a SETTINGS_SECTIONS key, or null for the phone's list
  // view. null settingsView = the page is closed.
  const [settingsView, setSettingsView] = useState(null);
  // The avatar's quick menu (design 1c) — the first surface behind the
  // masthead avatar; the settings page sits behind its "All settings" row.
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  // The menu's Agent row opens the agent sheet ON TOP of where the menu was.
  // Closing that sheet returns to the menu (Kyle 2026-07-28) — but only when
  // the sheet came from the menu, not from a card's Buy notch.
  const agentReturnToMenuRef = useRef(false);
  const currencyReturnToMenuRef = useRef(false);
  // LB-8: the share sheet, open on one named haul. A string, not a boolean —
  // the sheet needs to know WHICH haul, and the name is the haul's identity.
  const [shareHaulName, setShareHaulName] = useState(null);
  // Haul sharing redesign: review capture sheet for a fully received haul.
  const [reviewHaulName, setReviewHaulName] = useState(null);
  // Account (Part 7e): the Supabase session on this device + the decoded
  // entitlement snapshot (plan badge, limits). Both null when signed out or
  // when AUTH_ENABLED is false (env missing → no account UI at all).
  const [accountSession, setAccountSession] = useState(null);
  const [accountPlan, setAccountPlan] = useState(null);
  // The two caps that are not metered server allowances (LB-1, LB-2). A metered counter is
  // re-checked by the server on every call; these two never reach a server, so
  // the client is the only place they can hold. Signed out reads as free.
  const isProPlan = accountPlan
    ? accountPlan.state === "pro" || accountPlan.state === "grace" || accountPlan.state === "owner"
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
    let cancelled = false;
    const stripUrl = () => {
      try {
        window.history.replaceState(null, "", window.location.pathname);
      } catch {}
    };
    // Stripe return + portal return land on Account and plan even when
    // accounts are off in this build — the confirmation page still shows.
    const params = new URLSearchParams(window.location.search);
    if (params.get("upgraded") || params.get("upgrade")) {
      // Always clear the query string — including checkout cancelled
      // (?upgrade= without the trailing d), not only upgraded/profile.
      stripUrl();
      const upgraded = params.get("upgraded");
      if (upgraded) {
        notify("Payment received. Pro turns on in a few seconds.");
        trackProductEvent("purchase_return", { plan: "pro" });
      }
      else notify("Checkout cancelled. Nothing was charged.");
    }
    if (params.get("profile") || params.get("upgraded")) {
      stripUrl();
      setSettingsView({ section: "account" });
      settingsBootRef.current = true;
      settingsSeqRef.current = 1;
      try {
        window.history.replaceState({ czSettings: "account", seq: 1 }, "", "/settings/account");
      } catch {}
    }
    if (!AUTH_ENABLED) return;
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
          // Kyle 2026-08-03 audit, finding 2: this printed the server's own
          // words and offered no button. Now it reads a sentence, and the
          // sign-in box is one tap away. The raw text stays in the console.
          if (typeof console !== "undefined" && console.warn) {
            console.warn("[auth] sign-in link failed:", fromUrl.error);
          }
          notify(signInErrorMessage(fromUrl.error), {
            tone: "error",
            actionLabel: "Sign in",
            onAction: () => openSignIn({ kind: "shelf", returnTo: "/" }),
          });
        } else {
          saveSession(fromUrl.session);
          if (!cancelled) {
            setAccountSession(fromUrl.session);
            trackProductEvent("signup_complete", { method: "account" });
            notify("Signed in" + (fromUrl.session.user.email ? " as " + fromUrl.session.user.email : "") + ".");
          }
          await pullEntitlement(fromUrl.session);
        }
        return;
      }
      // #31 (Kyle 2026-08-04): read the saved plan BEFORE the network. An
      // expired access token makes getValidSession await a Supabase refresh,
      // and the whole wait left accountPlan null — planForLimits then guessed
      // "free", so a chart request in that window got the free-account wall
      // on the owner's unlimited account. The cache is local and
      // expiry-checked, and sign-out clears it, so it is safe to apply first.
      // The fresh pull below still replaces it moments later.
      const stored = loadSession();
      if (stored) {
        const cached = loadCachedEntitlement();
        if (cached && (!cached.sub || cached.sub === stored.user.id)) setAccountPlan(cached);
      }
      const session = await getValidSession();
      if (cancelled) return;
      setAccountSession(session);
      if (!session) return;
      if (!stored) {
        // Another tab signed in during the wait — same local read as above.
        const cached = loadCachedEntitlement();
        if (cached) setAccountPlan(cached);
      }
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

  // Settings deep links (CH-12 + Profile Settings design Phase 4). Every
  // /settings URL is a real address now: boot maps it onto the routed page
  // and the address STAYS. Legacy sections (agent, import, links) normalize
  // onto the section that owns them and the address rewrites to the
  // canonical one.
  useEffect(() => {
    const m = /^\/settings(?:\/([a-z]+))?\/?$/.exec(window.location.pathname);
    if (!m) return;
    const section = m[1] || "";
    const target = section ? normalizeSettingsSection(section) : isPhone ? null : "account";
    setSettingsView({ section: target });
    settingsBootRef.current = true;
    settingsSeqRef.current = 1;
    try {
      const url = target ? "/settings/" + target : "/settings";
      window.history.replaceState({ czSettings: target || "list", seq: 1 }, "", url);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // /upgrade is a real address too (sign-in handoff, screen 3). A visit that
  // lands here opens Pro straight away and keeps the address. netlify.toml
  // rewrites the path to index.html, the same way it does for /settings.
  useEffect(() => {
    if (!/^\/upgrade\/?$/.test(window.location.pathname)) return;
    setUpgradeView({ period: "weekly" });
    upgradeBootRef.current = true;
    upgradeSeqRef.current = 1;
    try {
      window.history.replaceState({ czUpgrade: true, seq: 1 }, "", "/upgrade");
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Haul deep links (STEPS-HANDOFF item 1). /hauls, /hauls/<slug> and
  // /parcels/<id> are real addresses: a reload on one reopens that screen.
  // The slug resolves to a haul name only after storage loads — the names
  // live on the cards — so this waits for `loaded` and runs once.
  useEffect(() => {
    if (!loaded || haulBootRanRef.current) return;
    haulBootRanRef.current = true;
    const path = window.location.pathname;
    const haulM = /^\/hauls(?:\/([^/]+))?\/?$/.exec(path);
    const parcelM = haulM ? null : /^\/parcels\/([a-z0-9-]+)\/?$/.exec(path);
    if (!haulM && !parcelM) return;
    haulBootRef.current = true;
    setView("hauls");
    const slugMap = haulRouteRef.current.slugMap;
    const parcelSlug = parcelM ? (PARCEL_ID_RE.exec(parcelM[1]) || [])[1] || null : null;
    const slug = haulM ? haulM[1] || null : parcelSlug;
    if (!slug) {
      // The index, or a parcel id with no letter suffix (not a parcel anyone
      // made): land on the hauls index.
      try {
        window.history.replaceState({ czHaul: "index", boot: true }, "", "/hauls");
      } catch {}
      return;
    }
    const name = slugMap.get(slug);
    if (!name) {
      // The haul is gone (deleted or renamed): land on the index.
      try {
        window.history.replaceState({ czHaul: "index", boot: true }, "", "/hauls");
      } catch {}
      return;
    }
    setActiveHaul(name);
    if (parcelM) {
      parcelBootRef.current = true;
      setTrackingOpen(true);
    }
    // STEPS-HANDOFF item 9: ?qc=first opens the takeover on the first
    // unreviewed warehouse item that HAS photos — a deep link never lands on
    // the empty state, only the in-app CTA does that. The address keeps the
    // param, so the link can be shared again from the open takeover.
    const wantsQc =
      !parcelM && new URLSearchParams(window.location.search).get("qc") === "first";
    if (wantsQc) {
      const firstQc = shelfAll
        .filter(
          (entry) =>
            entry && typeof entry.project === "string" && entry.project.trim() === name
        )
        .find(
          (entry) =>
            entry.haulStage === "warehouse" &&
            !entry.haulVerdict &&
            Array.isArray(entry.qcPhotos) &&
            entry.qcPhotos.filter(Boolean).length > 0
        );
      if (firstQc) setQcItemId(firstQc.id);
    }
    try {
      const url = parcelM
        ? "/parcels/" + parcelM[1]
        : "/hauls/" + slug + (wantsQc ? "?qc=first" : "");
      window.history.replaceState({ czHaul: slug, boot: true }, "", url);
    } catch {}
  }, [loaded]);

  const accountSendMagicLink = async (email) => {
    trackProductEvent("signup_start", { method: "email" });
    await sendMagicLink(email);
  };
  const accountGoogle = () => {
    trackProductEvent("signup_start", { method: "google" });
    window.location.assign(googleAuthUrl());
  };
  // Kyle 2026-08-02: a lost session used to end here in silence, and the Pro
  // button looked dead. The toast still fires. The throw carries the same
  // sentence up to whichever screen made the call, so it can print it too.
  //
  // Kyle 2026-08-03 audit, finding 3: the sentence told a person to sign in
  // again and gave them nothing to press. The button on the toast opens the
  // sign-in box, and it returns them to the screen they were already on.
  const expiredSession = (returnTo = "/") => {
    setAccountSession(null);
    const message = "Your sign-in expired. Sign in again first.";
    notify(message, {
      tone: "error",
      actionLabel: "Sign in",
      onAction: () => openSignIn({ kind: "shelf", returnTo }),
    });
    return new Error(message);
  };
  const accountUpgrade = async (price) => {
    const session = await getValidSession();
    if (!session) throw expiredSession("/upgrade");
    trackProductEvent("checkout_start", { billing: price });
    const url = await accountCheckout(session.accessToken, price);
    window.location.assign(url);
  };
  const accountOpenPortal = async () => {
    const session = await getValidSession();
    if (!session) throw expiredSession("/settings/account");
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
      // Finding 3, second site: same sentence, so it gets the same button.
      throw expiredSession("/settings/account");
    }
    await accountDeleteRequest(session.accessToken);
    await authSignOut(session); // local clear; the server user is already gone
    clearCachedEntitlement();
    setAccountSession(null);
    setAccountPlan(null);
    notify("Account deleted. Your shelf stays on this device.");
  };
  // Restore purchase (Account and plan screen): re-read the entitlement from
  // the server. On web there is no store receipt to restore — the Stripe
  // webhook moves the plan, and this pulls the current truth.
  const accountRestorePurchase = async () => {
    const session = await getValidSession();
    if (!session) {
      setAccountSession(null);
      notify("Sign in first to restore a purchase.");
      return;
    }
    const payload = await refreshEntitlement(session.accessToken);
    if (!payload) return;
    setAccountPlan(payload);
    notify(
      payload.state === "owner"
        ? "Owner access is active on this account."
        : payload.state === "pro" || payload.state === "grace"
          ? "Pro is active on this account."
        : "No paid plan found on this account."
    );
  };
  // Routed settings navigation. Entry pushes /settings/<section>; the
  // browser Back button peels it through popstate. Closing is ONE click out
  // (Kyle 2026-07-28: "Back to the shelf … just toggles you through what you
  // just had gone through"): every pushed entry carries a seq number and the
  // ref tracks the live one, so close jumps back past the whole visit.
  // A boot that LANDED on /settings/* owns no earlier in-app entry — closing
  // there rewrites the address instead, because going back would leave the
  // app (or do nothing on a fresh tab).
  const settingsSeqRef = useRef(0);
  const settingsBootRef = useRef(false);
  const navigateSettings = (section) => {
    // No section: the phone shows its list; the desktop always shows a
    // section, and account is the front door.
    const target = section || (isPhone ? null : "account");
    const seq = (settingsView ? settingsSeqRef.current : 0) + 1;
    settingsSeqRef.current = seq;
    setSettingsView({ section: target });
    try {
      const url = target ? "/settings/" + target : "/settings";
      window.history.pushState({ czSettings: target || "list", seq }, "", url);
    } catch {}
  };
  const closeSettings = () => {
    const seq = settingsSeqRef.current;
    const booted = settingsBootRef.current;
    settingsSeqRef.current = 0;
    settingsBootRef.current = false;
    if (!booted && seq > 0 && window.history.length > seq) {
      // popstate clears the view.
      try {
        window.history.go(-seq);
        return;
      } catch {}
    }
    setSettingsView(null);
    try {
      window.history.replaceState(null, "", "/");
    } catch {}
  };
  // ── "Sign in to read this link" (Kyle 2026-07-30) ─────────────────────────
  //
  // A signed-out visitor builds five complete cards. Then the server refuses,
  // and the old app made a blank card and said nothing — Kyle read that as a
  // broken site. Now the paste box stops making cards, holds the link, and
  // shows ONE notice that stays until the visitor signs in. The notice is not
  // a modal: on a phone the sign-in window opens on top of a modal, and two
  // stacked windows confuse people.
  const [signInRequired, setSignInRequired] = useState(false);
  const heldLinkRef = useRef("");
  // The id of the notice on screen. Sign-in clears THIS notice only, so a
  // later toast the visitor is reading does not disappear under them.
  const signInNoticeRef = useRef("");
  // A2 (2026-08-04): dismissing the limits sheet stays dismissed for the rest
  // of the enrichment run that opened it. Without the mute, every refused
  // card after the fifth re-fired setLimitsOpen and the sheet sprang back
  // ~1.5s after "Not now" — on a 25-card haul the visitor could dismiss it
  // forever. runImport resets the mute when a new run starts; the run's
  // finally clears it when the queue drains.
  const limitsRunMutedRef = useRef(false);
  const enrichRunDepthRef = useRef(0);
  const askForSignIn = useCallback((heldText = "") => {
    if (heldText) heldLinkRef.current = heldText;
    setSignInRequired(true);
    trackProductEvent("allowance_reached", { plan: "guest", feature: "card_read" });
    // A refused paid read is a real limit wall. Open the same limits sheet
    // used by the header meter and Ask — unless the visitor already closed it
    // during this run (A2). Keep the persistent card notice either way: it
    // owns the held link and stays until sign-in finishes the stopped work.
    if (!limitsRunMutedRef.current) setLimitsOpen(true);
    signInNoticeRef.current = notify("Sign in to read this link.", {
      sub: "Credenza reads the product, the photos, and the size chart for you.",
      persistent: true,
      // Rule 2: every wall opens the SAME sheet. This notice used to jump
      // straight to the account settings screen, so the third card met a
      // different wall from the Ask box and the header pill. The label matches
      // the free-allowance notice below, so one sheet has one name everywhere.
      actionLabel: "What do I get?",
      onAction: () => setLimitsOpen(true),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // The chart hunt and the description-photo refetch run outside React. They
  // report the same refusal through this hook.
  useEffect(() => {
    setSignInRequiredHook(() => askForSignIn());
    return () => setSignInRequiredHook(null);
  }, [askForSignIn]);

  // ── One meter, one sheet (Kyle 2026-07-30) ────────────────────────────────
  //
  // Rule 1: a pill in the header always says where this person stands.
  // Rule 2: the pill, a spent allowance, a plan cap and an ended membership
  //         all open the SAME sheet.
  // Rule 3: the last free read turns the pill amber, so nobody meets a wall
  //         they were not told about.
  // The sheet NEVER opens on its own — only on a tap or at a real wall.
  const [limitsOpen, setLimitsOpen] = useState(false);
  const [serverBlockedFeature, setServerBlockedFeature] = useState("");
  // FIX 2b: chart cap UI opens this same sheet (free-plan upgrade CTA).
  useEffect(() => {
    setLimitsOpenHook(() => setLimitsOpen(true));
    return () => setLimitsOpenHook(null);
  }, []);
  // The allowance counters live in localStorage, which never tells React that it
  // changed. Every spent read bumps this, and the pill re-reads.
  const [usageTick, setUsageTick] = useState(0);
  useEffect(() => onUsageChange(() => setUsageTick((n) => n + 1)), []);
  const signedInAccount = AUTH_ENABLED && !!accountSession;
  const limits = useMemo(
    () =>
      AUTH_ENABLED
        ? limitStatus({
            plan: accountPlan,
            signedIn: signedInAccount,
            // The server has already refused, so the true count is zero
            // whatever this device's own counter says.
            blocked: signInRequired && !signedInAccount,
            blockedFeature: serverBlockedFeature,
          })
        : null,
    // usageTick is the whole point of this dependency list: it is what makes
    // the pill re-read localStorage after a read is spent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accountPlan, signedInAccount, signInRequired, serverBlockedFeature, usageTick],
  );
  const openLimits = useCallback(() => setLimitsOpen(true), []);
  useEffect(() => {
    setAllowanceRequiredHook((kind, feature) => {
      const eventFeature = feature === "chartVision" ? "chart_read" : feature === "resolve" ? "card_read" : feature;
      trackProductEvent("allowance_reached", {
        plan: kind === "monthly" ? "paid" : "free",
        feature: eventFeature,
      });
      if (kind === "monthly") {
        notify("Your monthly allowance is used. More reads arrive next month.");
        return;
      }
      setServerBlockedFeature(feature);
      // Same spring-back guard as askForSignIn (A2): a signed-in Free user who
      // closed the sheet mid-run is not asked again for the rest of the run.
      if (!limitsRunMutedRef.current) setLimitsOpen(true);
    });
    return () => setAllowanceRequiredHook(null);
    // `notify` is intentionally read from the current mounted app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (accountPlan && accountPlan.state !== "free") setServerBlockedFeature("");
  }, [accountPlan]);
  // ── The sign-in modal (sign-in handoff README, screen 2) ──────────────────
  //
  // A modal, never a route. It opens from the cap modal, the account menu and
  // Settings, and it has to come back to wherever it was opened from. The
  // intent it carries is what makes that possible: Google, Apple and the mail
  // app all leave the page, so the return address cannot live in React state.
  // null = closed. An object = open, carrying that return intent.
  const [signInIntent, setSignInIntent] = useState(null);
  const openSignIn = useCallback((intent) => {
    setSignInIntent(intent || { kind: "shelf", returnTo: "/" });
  }, []);
  // #31d (Kyle 2026-08-04): the chart wall's "Sign in" button opens THIS
  // window — not the plans sheet it used to open by riding the import wall's
  // hook.
  useEffect(() => {
    setChartSignInHook(() => openSignIn({ kind: "shelf", returnTo: "/" }));
    return () => setChartSignInHook(null);
  }, [openSignIn]);
  // ── The upgrade route (sign-in handoff README, screen 3) ──────────────────
  //
  // Pro gets a real address, so a person can send it to someone else and come
  // back to it after signing in. There is no router in this app: the address
  // bar is driven by pushState and read back by the popstate listener below,
  // exactly the way /settings is.
  //
  // null = closed. An object = open, carrying the billing period, so a round
  // trip through the mail app comes back with the same period chosen.
  const [upgradeView, setUpgradeView] = useState(null);
  const upgradeSeqRef = useRef(0);
  const upgradeBootRef = useRef(false);
  const openUpgrade = useCallback((period) => {
    setUpgradeView((prev) => {
      const seq = (prev ? upgradeSeqRef.current : 0) + 1;
      upgradeSeqRef.current = seq;
      try {
        window.history.pushState({ czUpgrade: true, seq }, "", "/upgrade");
      } catch {}
      return { period: period || "weekly" };
    });
  }, []);
  const closeUpgrade = useCallback(() => {
    const seq = upgradeSeqRef.current;
    const booted = upgradeBootRef.current;
    upgradeSeqRef.current = 0;
    upgradeBootRef.current = false;
    // One click out, the same rule the settings page follows. A visit that
    // LANDED on /upgrade owns no earlier entry, so going back would leave the
    // app; that visit rewrites the address instead.
    if (!booted && seq > 0 && window.history.length > seq) {
      try {
        window.history.go(-seq);
        return;
      } catch {}
    }
    setUpgradeView(null);
    try {
      window.history.replaceState(null, "", "/");
    } catch {}
  }, []);
  // Rule 3, the other half: the first paste by a signed-out visitor says how
  // many free cards there are. Once per device — a line repeated on every
  // paste is nagging, and nagging drives visitors away.
  const freeNoteRef = useRef(false);
  const noteFreeAllowanceOnce = () => {
    if (!AUTH_ENABLED || signedInAccount || freeNoteRef.current) return;
    freeNoteRef.current = true;
    try {
      if (window.localStorage.getItem(FREE_NOTE_KEY)) return;
      window.localStorage.setItem(FREE_NOTE_KEY, "1");
    } catch {
      // No storage (private mode). Showing the line once this session is the
      // right failure: the visitor still learns the number.
    }
    notify("You get " + ANON_FREE_CARDS + " free full cards.", {
      sub: "Sign in for more, any time. Your shelf stays on this device.",
      actionLabel: "What do I get?",
      onAction: () => setLimitsOpen(true),
    });
  };

  // Fit preferences folded into Sizes (handoff 2026-08-01). Keep "fit" as a
  // deep-link alias so /settings/fit still opens the sizes section.
  const SETTINGS_KEYS = ["account", "sizes", "shelf", "data", "about"];
  const normalizeSettingsSection = (s) => {
    const mapped = { agent: "shelf", import: "data", links: "data", fit: "sizes" }[s] || s;
    return SETTINGS_KEYS.includes(mapped) ? mapped : "account";
  };
  useEffect(() => {
    const onPop = () => {
      // /upgrade shares this one listener. Two listeners on popstate would
      // both fire on every step and fight over which surface is open.
      if (/^\/upgrade\/?$/.test(window.location.pathname)) {
        const st = window.history.state;
        upgradeSeqRef.current = st && st.seq ? st.seq : 1;
        setUpgradeView((prev) => prev || { period: "weekly" });
        settingsSeqRef.current = 0;
        settingsBootRef.current = false;
        setSettingsView(null);
        return;
      }
      upgradeSeqRef.current = 0;
      upgradeBootRef.current = false;
      setUpgradeView(null);
      // Haul pages (STEPS-HANDOFF item 1). Back peels an open overlay first —
      // drawer, then QC, then the hand-off sheet — and only then navigates
      // (the handoff's back-button rule). Overlays push entries on top of the
      // haul address, so a peel lands on the same URL with one flag fewer.
      const haulM = /^\/hauls(?:\/([^/]+))?\/?$/.exec(window.location.pathname);
      const parcelM = haulM ? null : /^\/parcels\/([a-z0-9-]+)\/?$/.exec(window.location.pathname);
      if (haulM || parcelM) {
        settingsSeqRef.current = 0;
        settingsBootRef.current = false;
        setSettingsView(null);
        const st = window.history.state;
        const cur = haulRouteRef.current;
        // Peel the topmost overlay. QC can sit over the drawer, so the open
        // order lives in a stack — closing "the drawer first" would pull it
        // out from under an open QC screen.
        const stack = haulOverlayStackRef.current;
        const top = stack[stack.length - 1];
        if (top) {
          stack.pop();
          haulOverlaySeqRef.current = st && st.czHaulOverlay ? st.czHaulOverlay : 0;
          stack.length = Math.min(stack.length, haulOverlaySeqRef.current);
          if (top.kind === "drawer") setHaulDrawerId(null);
          else if (top.kind === "qc") setQcItemId(null);
          else setHandoffOpen(false);
          return;
        }
        haulOverlaySeqRef.current = 0;
        setView("hauls");
        const slug = haulM
          ? haulM[1] || null
          : (PARCEL_ID_RE.exec(parcelM[1]) || [])[1] || null;
        if (!slug) {
          // The index: no haul under the address any more.
          if (cur.activeHaul) {
            if (!cur.reducedMotion) setClosingHaulName(cur.activeHaul);
            setActiveHaul(null);
          }
          setHandoffOpen(false);
          setTrackingOpen(false);
          setHaulDrawerId(null);
          return;
        }
        const name = cur.slugMap.get(slug);
        if (!name) {
          // The haul is gone (deleted or renamed): land on the index.
          if (cur.activeHaul) {
            if (!cur.reducedMotion) setClosingHaulName(cur.activeHaul);
            setActiveHaul(null);
          }
          setTrackingOpen(false);
          try {
            window.history.replaceState({ czHaul: "index" }, "", "/hauls");
          } catch {}
          return;
        }
        if (cur.activeHaul !== name) {
          setActiveHaul(name);
          setExpandedId(null);
          setSelectedId(null);
        }
        setHaulDrawerId(null);
        setHandoffOpen(false);
        setTrackingOpen(!!parcelM);
        return;
      }
      // Back out of the haul pages entirely (to the shelf). Settings stays
      // out of this: the settings sheet can sit over a haul, and popping to
      // a /settings entry must not close the haul under it.
      if (!/^\/settings(?:\/|$)/.test(window.location.pathname)) {
        const cur = haulRouteRef.current;
        if (cur.view === "hauls" || cur.activeHaul || cur.trackingOpen) {
          if (cur.activeHaul && !cur.reducedMotion) setClosingHaulName(cur.activeHaul);
          setActiveHaul(null);
          setHandoffOpen(false);
          setTrackingOpen(false);
          setHaulDrawerId(null);
          haulOverlaySeqRef.current = 0;
          haulOverlayStackRef.current = [];
          const st = window.history.state;
          setView(st && st.czView === "inbox" ? "inbox" : "shelf");
        }
      }
      const m = /^\/settings(?:\/([a-z]+))?\/?$/.exec(window.location.pathname);
      if (!m) {
        settingsSeqRef.current = 0;
        settingsBootRef.current = false;
        setSettingsView(null);
        return;
      }
      const st = window.history.state;
      settingsSeqRef.current = st && st.seq ? st.seq : 1;
      const section = m[1] || "";
      setSettingsView({
        section: section ? normalizeSettingsSection(section) : isPhone ? null : "account",
      });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPhone]);
  // Module-level enrichment (chart-vision) reads the plan through the module
  // mirror — component state stays the one source of truth.
  useEffect(() => {
    // Treat a signed-in account as Free while its snapshot loads. This keeps
    // early successful calls out of the separate guest counter.
    setPlanForLimits(
      accountPlan ||
        (signedInAccount
          ? { state: "free", lim: {}, sub: accountSession && accountSession.user.id }
          : null)
    );
  }, [accountPlan, accountSession, signedInAccount]);
  // Delete confirmation (KM-02): every delete path (card-back button,
  // Backspace/Delete key) stages the id here first; the dialog shows the card
  // title and offers Keep / Delete. null = nothing staged.
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  // Search handoff 6a (2026-07-23): no more toggle — desktop gets a permanent
  // search field + a solid ＋ Stash button. Search is ambient, Stash is an
  // event; the two jobs never share one field again.
  // Clipboard fast-path: null = nothing stashable detected.
  const [clipPreview, setClipPreview] = useState(null);
  // Dismissed link fingerprint. The focus re-probe keeps the shortcut hidden
  // until the clipboard holds a different normalized link set.
  const clipDismissedRef = useRef(null);
  // Display order for dual-currency labels; synced into priceLabel's module
  // reader below. Persisted in credenza-prefs-v1.
  const [pricePrimary, setPricePrimary] = useState("USD");
  // Sync during render, not in an effect: an effect runs AFTER the tree has
  // rendered with the stale mirror, and module state triggers no re-render —
  // cards kept the old currency until something else re-rendered them (Kyle
  // 2026-07-28: "If you switch from USD to CNY, it doesn't change the dollar
  // amount"). The parent body runs before children render, so one pass is
  // enough.
  setPricePrimaryPref(pricePrimary);
  // Fit summary (design handoff PR4): show/hide + Concise/Detailed length,
  // synced into the module readers FitSummary uses. Persisted in prefs.
  const [fitSummary, setFitSummary] = useState(true);
  // Session flag: user dismissed the progressive fit prompt on a card.
  // Sticky for the session, so a reload does not re-ask. A new session can ask
  // again until a body profile exists. See FIT_SKIP_KEY.
  const [fitPromptSkipped, setFitPromptSkipped] = useState(() => !!readFitSkippedAt());
  const skipFitPrompt = () => {
    writeFitSkippedAt(new Date().toISOString());
    setFitPromptSkipped(true);
  };
  // A0 arrival strip removed (Kyle 2026-08-04): the tip card under the paste
  // bar is gone. Helpers stay for existing storage keys and unit tests.
  // The first-run intro GATE is gone (onboarding spec, Kyle 2026-07-26): a
  // cold open now lands straight on the hero, because the hero already says
  // what the intro said and the paste field is the only thing to do next.
  // The flag survives because "has this person used Credenza before" still
  // decides one thing — whether their first card ever carries the inline hint.
  // It stays in prefs under the same key so existing users are not re-taught.
  const [onboardingDone, setOnboardingDone] = useState(true);
  const [fitDetail, setFitDetail] = useState("concise");
  // Same render-time sync as pricePrimary above — the mirror must be fresh
  // before FitSummary children read it in this render pass.
  setFitPrefs({ summary: fitSummary, detail: fitDetail });
  // Body measurements powering the card-back size pick; persisted in
  // credenza-prefs-v1. Null until the user fills the sheet once. Storage is
  // always cm/kg — measureUnits only controls display/input (default "in",
  // US). Charts are metric; conversion happens at the edges.
  const [bodyProfile, setBodyProfile] = useState(null);
  const [measureUnits, setMeasureUnits] = useState("in");
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
  // Indexing strip (handoff: design_handoff_indexing_strip, 3a). One link
  // record per enriching item, in paste order; components/indexing.js owns
  // the pure transitions and copy. The records derive from the shelf items,
  // so a batch import gets one row per link with no extra wiring.
  const [indexJobs, setIndexJobs] = useState([]);
  const [indexExiting, setIndexExiting] = useState(false);
  // Every enrichment of any item flows through enrichFashionItem, which calls
  // this first — so the row paints on the same frame as the paste. A settled
  // row that gets re-enriched (a duplicate paste, the strip's own Retry) goes
  // back to fetching and counts the attempt.
  const registerIndexJob = useCallback((item) => {
    if (!item || !item.id) return;
    const url = item.url || (item.links && item.links.albumUrl) || "";
    if (!url) return; // a pasted note with no link never gets a row
    setIndexJobs((jobs) => {
      const existing = jobs.find((j) => j.id === item.id);
      if (existing) {
        if (existing.state === "indexed" || existing.state === "failed") {
          return jobs.map((j) =>
            j.id === item.id
              ? {
                  ...j,
                  state: "fetching",
                  attempts: j.attempts + 1,
                  failReason: null,
                  sawEnriching: false,
                  bornTitle: item.title || "",
                  startedAt: Date.now(),
                  doneAt: 0,
                  progress: 0.02,
                }
              : j
          );
        }
        return jobs;
      }
      const meta = parseLinkMeta(url);
      return [
        ...jobs,
        {
          id: item.id,
          url,
          platform: meta.platform,
          label: meta.label,
          state: "queued",
          thumbs: [],
          revealed: 0,
          photoTotal: 0,
          progress: 0.02,
          attempts: 0,
          failReason: null,
          sawEnriching: false,
          shown: false,
          slowTail: false,
          bornTitle: item.title || "",
          createdAt: Date.now(),
          startedAt: Date.now(),
          doneAt: 0,
        },
      ];
    });
  }, []);
  const { notification, notify, dismiss: dismissNotification, pause: pauseNotification, resume: resumeNotification } = useNotification();
  const online = useOnlineStatus();
  const undoBatchRef = useRef([]);
  const undoExpiryRef = useRef(null);
  // Bumped every time a removal raises its toast. The toast's onDismiss only
  // empties the batch if its own generation is still current, so deleting a
  // second card — which replaces the toast and dismisses the first — does not
  // discard the batch the second card just joined.
  const undoGenRef = useRef(0);
  // Kyle 2026-08-01: Blackout only. Gallery (light) is parked for now.
  // Prefs still write theme: "rainbow" so public pages stay dark too.
  const mode = "rainbow";
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", "#050506");
  }, []);
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
            "Storage was full. Removed thumbnails from " +
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
  // CH-03: the avatar shows initials when signed in. The account has no name
  // field, so the initials come from the email local part: first letters of
  // the first two dot/dash separated segments ("jo.smith@x.com" → "JS").
  const avatarInitials = useMemo(() => {
    const email = accountSession?.user?.email;
    if (!signedIn || !email) return "";
    const local = String(email).split("@")[0];
    const parts = local.split(/[^a-zA-Z0-9]+/).filter(Boolean);
    return parts.slice(0, 2).map((p) => p[0].toUpperCase()).join("");
  }, [signedIn, accountSession]);

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
            shelfFilter,
            theme: "rainbow",
            colorwayVersion: 5,
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
  }, [preferencesHydrated, storageState.status, viewMode, sortMode, shelfFilter, preferredAgent, agentToastSeenFor, bodyProfile, measureUnits, pricePrimary, fitSummary, fitDetail, onboardingDone, fitPrefs]);

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
      let it = cleanLegacySellerCharts(result.items);
      // Share-sheet / PWA share_target / bookmarklet capture. Bare `text` and
      // `url` parameters are ordinary navigation unless an explicit marker is
      // present. This prevents unrelated links from creating shelf cards.
      try {
        const params = new URLSearchParams(window.location.search);
        const captureIntent = params.has("stash") || params.get("share_target") === "1";
        if (captureIntent) {
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
              notify("Already on the shelf: “" + dup.title + "”. Opened it below.", { duration: DUPE_BANNER_MS });
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
            for (const keyName of ["stash", "text", "url", "title", "share_target"]) {
              params.delete(keyName);
            }
            const query = params.toString();
            const nextUrl =
              window.location.pathname + (query ? "?" + query : "") + window.location.hash;
            window.history.replaceState(null, "", nextUrl);
          }
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
          // The filter strip replaced the lone starred heart (2026-07-28). An
          // older browser only ever stored sortMode, so read it as a fallback.
          const storedFilter = SHELF_FILTERS.some((f) => f.key === p.shelfFilter)
            ? p.shelfFilter
            : p.sortMode === "starred"
              ? "starred"
              : "all";
          setShelfFilter(storedFilter);
          // Kyle 2026-08-01: Blackout only. Any stored Gallery (light) or older
          // colorwayVersion rewrites to Blackout and stays there.
          if (p.colorwayVersion !== 5 || p.theme !== "rainbow") {
            storageBackend
              .set(
                "credenza-prefs-v1",
                JSON.stringify({
                  // viewMode is not carried: every session lands on the list
                  // (Kyle 2026-07-28 — the carousel is the secondary option).
                  sortMode: storedFilter === "starred" ? "starred" : "recent",
                  shelfFilter: storedFilter,
                  theme: "rainbow",
                  colorwayVersion: 5,
                  preferredAgent: validStoredAgentId(p.preferredAgent),
                  agentToastSeenFor: p.agentToastSeenFor || null,
                  bodyProfile: p.bodyProfile && typeof p.bodyProfile === "object" ? p.bodyProfile : null,
                  measureUnits: p.measureUnits === "cm" ? "cm" : "in",
                  pricePrimary: normalizePricePrimary(p.pricePrimary),
                  fitSummary: p.fitSummary !== false,
                  fitDetail: p.fitDetail === "detailed" ? "detailed" : "concise",
                  onboardingDone: p.onboardingDone !== false,
                  fitPrefs: p.fitPrefs && typeof p.fitPrefs === "object" ? p.fitPrefs : {},
                })
              )
              .catch(() => {});
          }
          // A2: agent prefs. Unknown/retired stored agents fall back to the
          // soft default rather than stranding Buy buttons. Stored
          // affiliateCodes are ignored on purpose (audit 2026-07-24): codes
          // are build-time env only now.
          setPreferredAgent(validStoredAgentId(p.preferredAgent));
          if (p.agentToastSeenFor) setAgentToastSeenFor(p.agentToastSeenFor);
          if (p.bodyProfile && typeof p.bodyProfile === "object") {
            setBodyProfile(migrateSleeveMeasurements(p.bodyProfile));
          }
          if (p.measureUnits === "cm" || p.measureUnits === "in") setMeasureUnits(p.measureUnits);
          if (p.pricePrimary) setPricePrimary(normalizePricePrimary(p.pricePrimary));
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
      notify("Already on the shelf: “" + dupItem.title + "”. Refreshing it below.", { duration: DUPE_BANNER_MS });
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
    // A fresh stash lands in the Inbox while it enriches. Take the customer
    // to it — otherwise the Shelf tab says "Nothing on the shelf yet" right
    // after they stashed something (2026-07-25 mobile audit). The effect that
    // watches inboxItems snaps back to Shelf when indexing finishes. The strip
    // row itself comes from the driver below, which reads the shelf items.
    setView("inbox");
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
            "Couldn't read that Reddit post. Paste the post text here instead."
        );
      }
      return;
    }
    // Multi-line paste of post body: treat as post text so single-link QC
    // works without a fetch (Import sheet + Capture paste).
    runImport(text, { fromPost: false });
  };

  // One entry point for every capture surface. Explicit fields keep the full
  // parser. Ambient clipboard routes use linksOnly, so prose never reaches the
  // numbered-list importer. Reviewed clipboard prose can use asNote instead.
  const dispatchStash = (raw, options = {}) => {
    let text = (raw || "").trim();
    if (!text) return { status: "empty" };
    // Signed out, and the five free reads are gone. Hold the link and make no
    // card: a blank card is the fault this exists to remove. The notice on
    // screen carries the Sign in button, and the link stays in the box.
    if (signInRequired && !accountSession) {
      heldLinkRef.current = text;
      askForSignIn(text);
      return { status: "signin" };
    }
    // Rule 3: warn before the wall, never at it. The FIRST paste by a visitor
    // says how many free cards there are, once per device, so the fifth card
    // is never a surprise. It is one line, and it is not a modal.
    noteFreeAllowanceOnce();
    if (options.linksOnly) {
      const links = extractValidUrls(text);
      if (!links.length) return { status: "no-link" };
      text = links.join("\n");
      if (links.length > 1) {
        runImport(text);
        return { status: "hauling" };
      }
    }
    if (options.asNote) return stash(text);
    if (REDDIT_POST_URL_RE.test(text) || /\n/.test(text)) {
      stashRedditHaul(text);
      return { status: "hauling" };
    }
    // Fashion gate (Kyle 2026-07-23): the shelf is fashion-only. A URL with no
    // marketplace/agent/Reddit host asks first — clipboard accidents (news,
    // video, music) never become cards silently. The paste stays in the box;
    // "Stash anyway" is the override for niche shops the gate doesn't know.
    if (fashionGateStatus(text) === "gated") {
      notify("That doesn't look like a fashion link. Nothing stashed yet.", {
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
  const stashFromSheet = (raw, options = {}) => {
    const text = (raw || "").trim();
    if (!text) return { status: "empty" };
    const result = dispatchStash(text, options);
    if (result.status === "gated" || result.status === "no-link" || result.status === "signin") return result;
    setInput("");
    setCaptureSheetOpen(false);
    if (result.status !== "stashed") return result;
    beginIndexingJob(result);
    const id = result.id;
    notify("Stashed · " + (result.title || "New item"), {
      tone: "action",
      actionLabel: "Undo",
      onAction: () => {
        applyUpdate((list) => list.filter((x) => x.id !== id));
        markDeleted(id);
        setIndexJobs((jobs) => jobs.filter((j) => j.id !== id));
      },
      duration: 3000,
    });
    return result;
  };

  // The hero bar (empty shelf) stashes what sits in its field. An empty field
  // opens the Stash sheet — on desktop as well as on the phone (Kyle
  // 2026-07-27: "when you hit the stash button, it should pull up the stash to
  // shelf, how it is in the mobile"). It used to read the clipboard silently on
  // desktop, so the button did something the user never saw and never asked
  // for. The sheet shows the clipboard first and asks before it stashes.
  // One field, one button, one behavior everywhere.
  const heroStash = () => {
    const text = search.trim();
    if (text) {
      const result = dispatchStash(text);
      if (result.status === "stashed") beginIndexingJob(result);
      // "signin" keeps the link in the field, like the fashion gate does —
      // the visitor signs in and the same text is read for them.
      if (result.status !== "empty" && result.status !== "gated" && result.status !== "signin") setSearch("");
      return;
    }
    setCaptureSheetOpen(true);
  };

  // One tap: read the clipboard and stash it directly. Browsers guard clipboard
  // reads, so every failure path guides the user somewhere useful — never a dead
  // button, never a vague shrug.
  const stashClipboard = async () => {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      focusCapture();
      flashImportResult("This browser can't share the clipboard here. Paste anywhere with ⌘V instead.");
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
          ? "Clipboard access is turned off for this site. Turn it on next to the address bar, or paste anywhere with ⌘V."
          : "Clipboard needs a quick permission. Allow it when your browser asks, or paste anywhere with ⌘V."
      );
      return;
    }
    if (!text || !text.trim()) {
      flashImportResult("Clipboard's empty.");
      return;
    }
    const result = dispatchStash(text, { linksOnly: true });
    const currentPreview = clipboardPreviewFor(text);
    if (result.status === "no-link") {
      setClipPreview(null);
      flashImportResult("No links found. Open Stash to save the text as a note.");
      return;
    }
    if (currentPreview) clipDismissedRef.current = currentPreview.fingerprint;
    setClipPreview(null);
    if (result.status === "stashed") {
      beginIndexingJob(result);
      flashImportResult("Stashed from the clipboard.");
    }
  };

  // Capture focus router. The Stash sheet now opens on every screen, so a
  // blocked clipboard read has somewhere to land on desktop too: the sheet
  // opens with its paste box focused, and the user pastes into a box they can
  // see. This used to return early on desktop, which left the failure message
  // pointing at a surface that did not exist.
  function focusCapture() {
    setCaptureSheetOpen(true);
    requestAnimationFrame(() => {
      if (sheetCaptureRef.current) sheetCaptureRef.current.focus();
    });
  }

  // CO-21: link pastes stash instead of landing in search. URL-free text keeps
  // the browser's normal paste behavior, even when that text has many lines.
  const onSearchPaste = (e) => {
    const text = e.clipboardData && e.clipboardData.getData("text");
    const trimmed = (text || "").trim();
    const links = extractValidUrls(trimmed);
    if (!links.length) return;
    const linkText = links.join("\n");
    e.preventDefault();
    if (isPhone) {
      setInput(linkText);
      setCaptureSheetOpen(true);
    } else {
      const result = dispatchStash(trimmed, { linksOnly: true });
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
        if (preview && preview.fingerprint === clipDismissedRef.current) {
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

  // Remaining free card reads for THIS visitor, or null when uncapped
  // (Pro/owner, or accounts off). The anon promise is ANON_FREE_CARDS; the
  // signed-in Free cap is PLAN_CAPS.free.resolveTotal — both mirror the
  // server (limits.js / entitlements.js own the numbers).
  const freeCardsLeft = () => {
    if (!AUTH_ENABLED) return null;
    const state = accountPlan && accountPlan.state;
    if (state === "pro" || state === "grace" || state === "owner") return null;
    if (!signedInAccount) {
      return Math.max(0, ANON_FREE_CARDS - usageTotal("resolve", { audience: "anon" }));
    }
    const cap = PLAN_CAPS.free && PLAN_CAPS.free.resolveTotal;
    if (typeof cap !== "number" || cap <= 0) return null;
    return Math.max(0, cap - usageTotal("resolve", { audience: usageAudience(accountPlan, true) }));
  };

  const runImport = (text, opts = {}) => {
    const { candidates, provider } = parseImport(text, opts);
    const { fresh, dupes, duplicates } = buildImportItems(candidates, items, provider);
    if (fresh.length) applyUpdate((list) => [...fresh, ...list]);
    if (fresh.length) markActivation(storageBackend, "import");
    // A1 (2026-08-04): the paste is bigger than the visitor's remaining free
    // allowance → say so ONCE, up front, before enrichment walks the queue.
    // Without the line the wall at card M+1 arrived as a surprise on every
    // big haul. Pro/owner have no cap and never see it. The toast slot is
    // single, so the line rides as the sub of the import summary below —
    // a standalone toast here would be replaced by that summary in the same
    // tick and never read.
    const queue = [...fresh, ...duplicates];
    const left = queue.length ? freeCardsLeft() : null;
    const headsUp =
      left != null && queue.length > left
        ? "This post has " + queue.length + " items. You can do " + left + " free."
        : null;
    if (queue.length) {
      // A2: a new paste is a new run — the visitor's earlier "Not now" was
      // answered for THAT run, not this one.
      limitsRunMutedRef.current = false;
      enrichRunDepthRef.current += 1;
      Promise.resolve(enrichFashionItems(queue)).finally(() => {
        enrichRunDepthRef.current = Math.max(0, enrichRunDepthRef.current - 1);
        if (enrichRunDepthRef.current === 0) limitsRunMutedRef.current = false;
      });
    }
    setImportOpen(false);
    if (fresh.length === 0) {
      flashImportResult(
        dupes > 0
          ? "Nothing new. All " + dupes + " already on the shelf."
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
            sub: headsUp,
            actionLabel: "Undo import",
            onAction: () =>
              applyUpdate((list) => list.filter((x) => !freshIds.has(x.id))),
            duration: 12000,
          }
        );
        return;
      }
      notify(
        "Imported " +
          fresh.length +
          " " +
          (fresh.length === 1 ? "thing" : "things") +
          from +
          "." +
          (dupes > 0
            ? " " + dupes + " " + (dupes === 1 ? "was" : "were") + " already on the shelf."
            : ""),
        { sub: headsUp, duration: 5000 }
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
        onAction: () => openUpgrade(),
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
          next = cleanLegacySellerCharts([item, ...next]);
          added++;
        } catch {}
      }
      return next;
    });
    setImportOpen(false);
    flashImportResult(
      added === 0
        ? "Backup read. Everything in it is already on the shelf."
        : "Restored " + added + " " + (added === 1 ? "card" : "cards") + " from backup."
    );
  };

  const hasSamples = useMemo(() => items.some((x) => x.sourceImport === "sample"), [items]);

  // The sample shelf is retired (Kyle 2026-07-27: "this is a very old credenza
  // app, this content needs to be deleted"). Nothing adds sample cards any
  // more, but a device that loaded them before still holds 18 of them in local
  // storage, and a stale demo shelf reads as the real product. This sweeps them
  // off once, on the first render after hydration, and never runs again because
  // hasSamples is false from then on. It is deliberately silent: the person did
  // not ask for it, so a toast offering Undo would only invite them to put the
  // demo back.
  const samplePurgeRef = useRef(false);
  useEffect(() => {
    if (!preferencesHydrated || samplePurgeRef.current || !hasSamples) return;
    samplePurgeRef.current = true;
    applyUpdate((list) => list.filter((item) => item.sourceImport !== "sample"));
  }, [preferencesHydrated, hasSamples]);

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
      isProPlan ? {} : { actionLabel: "See Pro", onAction: () => openUpgrade() }
    );
    return true;
  };
  const saveEdit = (id, patch) => {
    patch = restoreChartNotesOnEdit(patch);
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
        // Order status is bought-or-not now (shelf handoff 2026-07-28). The
        // moment worth recording is the first purchase, not a QC verdict.
        if (patch.findStatus === "bought" && before.findStatus !== "bought") {
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
          ? "That is " + qcPhotoCap + " QC photos on this item. Remove one to add another."
          : qcPhotoCap +
            " QC photos an item on Free. Pro holds " +
            PRO_LIMITS.qcPhotosPerItem +
            ".",
        isProPlan ? {} : { actionLabel: "See Pro", onAction: () => openUpgrade() }
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

  const shareCard = async (item) => {
    const outcome = await shareItemCard(item, {
      savedPrice: priceLabel(item),
      resolveImage: (url) => relayImageDataUrl(url, item.url || ""),
    });
    if (outcome === "failed") {
      notify("Couldn't create the Share Card.");
    }
    return outcome;
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
    // Part 7e: signed-in Free user over the resolve allowance — skip the
    // cloud read, keep the local card (same as offline).
    if (overFreeLimit(accountPlan, "resolve")) {
      noteAllowanceRequired("free", "resolve");
      return false;
    }
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
    let refused = false;
    let allowance = null;
    let failCode = "";
    try {
      const res = await monitoredFetch(storageBackend, "resolve", RESOLVE_ENDPOINT, {
        method: "POST",
        headers: await authHeaders({ "content-type": "application/json", "x-credenza-key": PREVIEW_SECRET }),
        body: JSON.stringify({ url: buyUrl }),
        signal: controller.signal,
      });
      // LB-59. The importer's own resolve call, counted on success only.
      if (res.ok) {
        bumpUsage("resolve", { audience: usageAudience(accountPlan, signedInAccount) });
        trackProductEvent("usage_success", { plan: usageAudience(accountPlan, signedInAccount), feature: "card_read" });
        data = await res.json();
      } else {
        allowance = await allowanceRefusal(res);
        if (!allowance && (await isSignInRefusal(res))) refused = true;
        // A 422 names WHICH kind of link failed (shop front, agent short,
        // cut-off, dead short link) — keep it so the card can say so.
        if (!allowance && !refused) failCode = await linkFailCode(res);
      }
    } catch {
      data = null;
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener("abort", abort);
    }
    if (refused) {
      // No title, no price, no chart — and now the card SAYS why, instead of
      // sitting there empty and looking like a broken site.
      updateEnrichedItem(item.id, token, { status: "ready", needsSignIn: true, failCode: "" });
      askForSignIn();
      return false;
    }
    if (allowance) {
      updateEnrichedItem(item.id, token, { status: "ready" });
      noteAllowanceRequired(allowance, "resolve");
      return false;
    }
    if (!data || !data.title) {
      updateEnrichedItem(item.id, token, {
        status: "ready",
        ...(failCode ? { failCode } : {}),
      });
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
        // A successful read clears any link-failure reason a previous attempt
        // stored — the card filled, so the warning is stale.
        failCode: "",
        title: nextTitle,
        summary: data.summary || x.summary,
        // A hand-set price is pinned (priceManual): the resolve refreshes
        // everything else but never overwrites the customer's own number.
        price: x.priceManual ? x.price : data.priceCny != null ? data.priceCny : x.price,
        currency: "CNY",
        priceUsd: x.priceManual ? x.priceUsd : data.priceUsd != null ? data.priceUsd : x.priceUsd,
        // Live EUR + full top-8 map from the one rates fetch (lane 2).
        priceEur: x.priceManual ? x.priceEur : data.priceEur != null ? data.priceEur : x.priceEur,
        priceFx: x.priceManual
          ? x.priceFx
          : data.priceFx && typeof data.priceFx === "object"
            ? data.priceFx
            : x.priceFx,
        // CH-07: a hand-picked category is pinned (categoryManual), like a
        // hand-set price — the resolve never reclassifies it.
        // Fix 3: when server left empty/"other", refine client-side from
        // size-token variants + titleEn/originalTitle (no resolve.js change).
        category: refineItemCategory({
          category:
            x.categoryManual && CATEGORIES[x.category]
              ? x.category
              : CATEGORIES[data.category]
                ? data.category
                : x.category || "",
          categoryManual: x.categoryManual === true,
          title: nextTitle,
          titleEn: data.translated ? data.title : "",
          originalTitle: data.originalTitle || "",
          summary: data.summary || x.summary,
          sizeNotes: data.sizeNotes || x.sizeNotes,
          variants,
        }),
        variants,
        // First color axis value only when the card has no colorway yet.
        colorway: x.colorway || pickColorwayFromVariants(variants) || "",
        sizeNotes: data.sizeNotes || x.sizeNotes,
        descImages: Array.isArray(data.descImages) && data.descImages.length ? data.descImages : x.descImages,
        sellerYupooLinks:
          Array.isArray(data.sellerYupooLinks) && data.sellerYupooLinks.length
            ? data.sellerYupooLinks
            : x.sellerYupooLinks,
        whatsapp:
          typeof data.whatsapp === "string" && data.whatsapp.trim()
            ? data.whatsapp.trim().slice(0, 32)
            : x.whatsapp || "",
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
    registerIndexJob(item);
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
        let albumFailCode = "";
        const data = await fetchYupooImages(albumUrl, {
          signal: controller.signal,
          onFailCode: (code) => {
            albumFailCode = code;
          },
        });
        if (controller.signal.aborted || enrichmentTokensRef.current.get(item.id) !== token) return false;
        if (!data && albumFailCode) {
          // The pasted Yupoo link is a shop page or a category, never one
          // album. Name the mistake on the card instead of falling through to
          // a blank ready state (2026-08-04 audit).
          updateEnrichedItem(item.id, token, { status: "ready", failCode: albumFailCode });
          return false;
        }
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
          const albumGuessText = [
            enrichedTitle,
            data.title,
            data.sourceTitle,
            data.description,
            data.batch,
            item.title,
            item.summary,
            item.rawText,
          ]
            .filter(Boolean)
            .join(" ");
          // Category guess from album text only. Do NOT seed from the stale
          // item snapshot — a manual pick made mid-flight would be ignored.
          const albumGuessedCategory = guessFashionCategory(albumGuessText);
          const albumPatch = {
            url: item.url && yupooAlbumIdentity(item.url) ? canonicalAlbum : item.url,
            canonicalKey: canonicalKey(classify(canonicalAlbum), canonicalAlbum),
            // The album read succeeded — clear any earlier link-failure reason.
            failCode: "",
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
            price: item.price != null ? item.price : data.priceCny,
            currency: "CNY",
            sourceTitle: data.sourceTitle || item.sourceTitle || "",
            albumId: data.albumId || item.albumId || "",
            sellerAccount: data.sellerAccount || item.sellerAccount || "",
            status: data.buyUrl ? "enriching" : "ready",
          };
          // CH-07 + F 2026-08-02: hand-picked category is pinned
          // (categoryManual), like the resolve path. Functional patch so a
          // Shorts pick made while this album read was in flight is not
          // clobbered by the stale snapshot's "other".
          updateEnrichedItem(item.id, token, (x) => ({
            ...albumPatch,
            category:
              x.categoryManual && CATEGORIES[x.category]
                ? x.category
                : x.category && CATEGORIES[x.category]
                  ? x.category
                  : albumGuessedCategory || x.category || "",
          }));
          const mergedItem = {
            ...item,
            ...albumPatch,
            category:
              item.categoryManual && CATEGORIES[item.category]
                ? item.category
                : item.category && CATEGORIES[item.category]
                  ? item.category
                  : albumGuessedCategory || item.category || "",
          };
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

  // ── Finish the work the refusal stopped (Kyle 2026-07-30) ─────────────────
  //
  // The visitor signs in. Three things then happen, in this order: the notice
  // goes away, every card that says "Sign in to finish this card" is read
  // again, and the link the paste box held is stashed. Without this the
  // visitor signs in and still sees the same empty card, which is the fault
  // this whole change exists to remove.
  const signInRetryRef = useRef(false);
  useEffect(() => {
    if (!accountSession) {
      signInRetryRef.current = false;
      return;
    }
    if (signInRetryRef.current) return;
    signInRetryRef.current = true;
    setSignInRequired(false);
    if (signInNoticeRef.current && notification && notification.id === signInNoticeRef.current) {
      dismissNotification();
    }
    signInNoticeRef.current = "";
    const stranded = (shelfStateRef.current.items || []).filter((x) => x.needsSignIn === true);
    if (stranded.length) {
      setItems((list) => list.map((x) => (x.needsSignIn ? { ...x, needsSignIn: false } : x)));
      enrichFashionItems(stranded.map((x) => ({ ...x, needsSignIn: false })));
    }
    // ── The return intent (sign-in handoff README, "Interactions") ───────────
    //
    // README: "Every entry into the sign-in modal records where it came from
    // and what the user was trying to do." The modal wrote that down before
    // it navigated. This is the only place it is read back.
    //
    // It has to be read HERE, not in the boot effect, because the three ways
    // in do not share one entry: a magic link lands on a cold tab, Google
    // comes back through the URL hash, and a stored session simply resumes.
    // All three finish by setting accountSession, so all three land here.
    //
    // takeIntent clears first. A handler that throws therefore cannot leave
    // the intent to fire again on every reload.
    const intent = takeIntent();
    // The held link is the same card the "card" intent names. Prefer the
    // in-memory one: a magic link opened on a cold tab has no ref left, and
    // the intent payload is the copy that survived the round trip.
    const held = heldLinkRef.current || (intent && intent.kind === "card" && intent.payload ? intent.payload.url : "");
    heldLinkRef.current = "";
    if (held) {
      const result = dispatchStash(held);
      if (result.status === "stashed") beginIndexingJob(result);
    }
    if (!intent) return;
    // "shelf" is the default entry and wants nothing: the person is already
    // looking at the shelf, and moving them would be the surprise.
    if (intent.kind === "upgrade") {
      // Back to Pro with the period they chose, so the trip through the mail
      // app does not quietly reset weekly to monthly.
      openUpgrade(intent.payload ? intent.payload.period : undefined);
    } else if (intent.kind === "settings") {
      navigateSettings("account");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountSession]);

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
    // The line above counts the click on THIS device only, so nobody but the
    // owner of the device can read it. Buy clicks are the number the business
    // runs on, so the same click also goes to the site counter — the agent and
    // the marketplace, never the item, the title, or the link.
    // window.czTrack exists only after preview/public/analytics.js loads with a
    // real measurement id, so the guard is the whole feature switch.
    if (typeof window !== "undefined" && typeof window.czTrack === "function") {
      window.czTrack("buy_click", {
        agent: result.agentId || preferredAgent,
        marketplace,
        wrapped: result.wrapped ? "yes" : "no",
      });
    }
    if (result.wrapped && agentToastSeenFor !== result.agentId) {
      setAgentToastSeenFor(result.agentId);
      const name = (getAgent(result.agentId) || {}).name || "your agent";
      notify("Opening in " + name + " · change anytime in the Agent menu.", { duration: 6000 });
    } else if (!result.wrapped && (result.reason === "unsupported-marketplace" || result.reason === "no-item-id")) {
      const name = (getAgent(preferredAgent) || {}).name || "your agent";
      notify(name + " can't take that link. Opened the original instead.", { duration: 6000 });
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
      body: "Come back next week, or stash something worth digesting.",
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

  // ————— Indexing strip driver (handoff 3a) ————————————————————————————————
  // The records derive from the shelf items: a card in "enriching" holds a
  // live row, a card that lands "ready" settles its row. Three effects, one
  // job store:
  //   A (on items change): catch-all rows for enriching items with no record
  //     (a reload mid-job comes back at the stage it reached), stage from
  //     the item's own fields, settle rows, drop rows for deleted items.
  //   B (250ms tick): reveal photos one at a time, move the bar forward,
  //     raise the slow-tail flag, unhide rows that outlive the cache-hit
  //     window.
  //   C (exit): a fully settled, failure-free job holds INDEXED for 600ms,
  //     then the whole strip fades out over 250ms. Rows never leave one by
  //     one, and a job with failures never auto-dismisses.
  // The bar only interpolates forward: progress clamps against its last value.
  useEffect(() => {
    setIndexJobs((jobs) => {
      let changed = false;
      const next = [];
      const seen = new Set();
      for (const job of jobs) {
        const item = items.find((x) => x.id === job.id);
        if (!item) {
          changed = true;
          continue;
        }
        seen.add(item.id);
        if (job.state === "indexed" || job.state === "failed") {
          next.push(job);
          continue;
        }
        if (item.status === "enriching") {
          const photos = [];
          for (const src of [item.image, ...(item.gallery || [])]) {
            if (src && !photos.includes(src)) photos.push(src);
          }
          let total =
            item.albumPhotoCount > 0 ? Math.min(8, item.albumPhotoCount) : 8;
          if (photos.length > total) total = Math.min(8, photos.length);
          const state =
            photos.length === 0
              ? "fetching"
              : photos.length >= total
                ? "sizing"
                : "photos";
          if (
            !job.sawEnriching ||
            job.state !== state ||
            job.photoTotal !== total ||
            job.thumbs.length !== photos.length
          ) {
            changed = true;
            next.push({
              ...job,
              state,
              thumbs: photos,
              photoTotal: total,
              sawEnriching: true,
            });
          } else {
            next.push(job);
          }
          continue;
        }
        // The item is out of "enriching". A card the pool has not started yet
        // is still queued — it was born "ready" (bare) and never flinched.
        if (!job.sawEnriching) {
          next.push(job);
          continue;
        }
        // A sign-in refusal is not a dead link: the card says why, and the
        // row parks until the sign-in retry re-reads it.
        if (item.needsSignIn) {
          next.push(job.state === "queued" ? job : { ...job, state: "queued" });
          changed = changed || job.state !== "queued";
          continue;
        }
        changed = true;
        if (!online && gainedNothing(item, job.bornTitle)) {
          // Offline is not a failure. The row parks at queued and the
          // reconnect effect below re-reads the link when the network returns.
          next.push({ ...job, state: "queued", sawEnriching: false });
          continue;
        }
        const fill = Math.min(job.thumbs.length, job.photoTotal || 8);
        // Neither settle writes progress: the 100ms tick glides the bar to
        // full from wherever it stands. A raw progress: 1 here was the jump
        // Kyle saw — a third of the bar to the end in one frame.
        if (gainedNothing(item, job.bornTitle)) {
          next.push({
            ...job,
            state: "failed",
            failReason: failReasonFor(item),
            revealed: fill,
            shown: true,
            doneAt: Date.now(),
          });
        } else {
          next.push({
            ...job,
            state: "indexed",
            revealed: fill,
            shown: true,
            doneAt: Date.now(),
          });
        }
      }
      // Catch-all: an enriching item with no record (a reload mid-job, the
      // extension queue) gets a row at the stage its fields already show.
      for (const item of items) {
        if (item.status !== "enriching" || seen.has(item.id)) continue;
        if (next.some((j) => j.id === item.id)) continue;
        const url = item.url || (item.links && item.links.albumUrl) || "";
        if (!url) continue;
        const meta = parseLinkMeta(url);
        next.push({
          id: item.id,
          url,
          platform: meta.platform,
          label: meta.label,
          state: "fetching",
          thumbs: [],
          revealed: 0,
          photoTotal: 0,
          progress: 0.02,
          attempts: 0,
          failReason: null,
          sawEnriching: false,
          shown: false,
          slowTail: false,
          bornTitle: item.title || "",
          createdAt: Date.now(),
          startedAt: Date.now(),
          doneAt: 0,
        });
        changed = true;
      }
      return changed ? next : jobs;
    });
  }, [items, online]);

  useEffect(() => {
    if (!indexJobs.length) return;
    // 100ms tick. The bar eases on every tick (advanceProgress), which is
    // what makes the motion read as one continuous glide instead of steps —
    // Kyle 2026-08-04: "the green bar should be one consistent animation."
    // Photo reveals keep their own 250ms cadence inside the tick, so the
    // left-to-right cascade pace the design set does not change. Settled
    // jobs stay in the map so the completion sweep plays out on screen.
    const tick = window.setInterval(() => {
      setIndexJobs((jobs) => {
        if (!jobs.length) return jobs;
        const now = Date.now();
        let anyChanged = false;
        const next = jobs.map((job) => {
          let changed = false;
          let { revealed, lastRevealAt } = job;
          // One photo per 250ms — a resolve that lands all eight at once
          // still fills left to right, never in a single frame.
          if (revealed < job.thumbs.length && now - (lastRevealAt || 0) >= 250) {
            revealed += 1;
            lastRevealAt = now;
            changed = true;
          }
          // Past the photo stage the photo count is done. Without this snap
          // the header read "3 OF 8 PHOTOS" next to a SIZING row, which made
          // the sizing tail feel endless (Kyle 2026-08-04: "it doesn't stop
          // indexing").
          const totalPhotos = job.photoTotal || 0;
          const pastPhotos = job.state === "sizing" || isSettled(job);
          if (pastPhotos && revealed < totalPhotos) {
            revealed = totalPhotos;
            changed = true;
          }
          // Under 400ms the whole job can resolve with no strip at all (the
          // cache-hit path); a row only becomes visible past that window.
          const shown = job.shown || now - job.createdAt >= 400;
          if (shown !== job.shown) changed = true;
          // The bar starts at 0. Do not ease progress while the row is still
          // invisible — otherwise the first painted frame lands partway down
          // the track (Kyle 2026-08-04: "it starts about 1/4 of the way in").
          const progress = shown
            ? advanceProgress({ ...job, revealed, photoTotal: job.photoTotal || 8 })
            : job.progress || 0;
          if (progress !== job.progress) changed = true;
          const slowTail = job.state === "photos" && now - job.startedAt > 15000;
          if (slowTail !== !!job.slowTail) changed = true;
          if (!changed) return job;
          anyChanged = true;
          return { ...job, revealed, lastRevealAt, progress, slowTail, shown };
        });
        return anyChanged ? next : jobs;
      });
    }, 100);
    return () => window.clearInterval(tick);
  }, [indexJobs.length]);

  const indexExitArmedRef = useRef(false);
  const indexExitTimersRef = useRef(null);
  useEffect(() => {
    const cancelExit = () => {
      const timers = indexExitTimersRef.current;
      if (timers) {
        window.clearTimeout(timers.fade);
        window.clearTimeout(timers.clear);
        indexExitTimersRef.current = null;
      }
      indexExitArmedRef.current = false;
    };
    if (!indexJobs.length) {
      cancelExit();
      setIndexExiting(false);
      return;
    }
    // A fresh paste or a retry disarms a pending exit: the strip has work
    // again. Without this a link stashed inside the 750ms exit window would
    // be swept away with the finished rows.
    if (!indexJobs.every(isSettled)) {
      cancelExit();
      return;
    }
    // When failures are present the strip does not auto-dismiss: it stays
    // until each one is retried or dismissed.
    if (indexJobs.some((j) => j.state === "failed")) {
      cancelExit();
      return;
    }
    if (indexExitArmedRef.current) return;
    // Let the completion sweep finish on screen first: the bar glides to
    // full over ~900ms, and a strip that leaves mid-sweep reads as a jump.
    if (!indexJobs.every((j) => (j.progress || 0) >= 0.985)) return;
    indexExitArmedRef.current = true;
    const fade = window.setTimeout(() => setIndexExiting(true), 500);
    const clear = window.setTimeout(() => {
      // Keep only live rows: a link pasted inside the exit window survives.
      setIndexJobs((jobs) => jobs.filter((j) => !isSettled(j)));
      setIndexExiting(false);
      indexExitArmedRef.current = false;
      indexExitTimersRef.current = null;
    }, 750);
    indexExitTimersRef.current = { fade, clear };
    // No cleanup on purpose. The completion sweep ticks every 100ms and each
    // tick re-runs this effect; a cleanup would cancel the exit this run
    // just armed, and the armed flag then blocked every later try — the
    // strip stayed on screen with INDEXED forever (Kyle 2026-08-04:
    // "indexign stays on even when done indexing"). The disarm paths above
    // cancel the timers explicitly instead.
  }, [indexJobs]);

  // Unmount only: never fire a stray setState from a pending exit timer.
  useEffect(() => {
    const timers = indexExitTimersRef;
    return () => {
      if (timers.current) {
        window.clearTimeout(timers.current.fade);
        window.clearTimeout(timers.current.clear);
        timers.current = null;
      }
    };
  }, []);

  // Reconnect: rows parked at queued while offline re-read their links.
  useEffect(() => {
    if (!online) return;
    const parked = indexJobs.filter((j) => j.state === "queued" && !j.sawEnriching);
    if (!parked.length) return;
    const retryable = parked
      .map((j) => ({ job: j, item: items.find((x) => x.id === j.id) }))
      .filter(
        ({ job, item }) =>
          item && item.status === "ready" && !item.needsSignIn && gainedNothing(item, job.bornTitle)
      )
      .map(({ item }) => item);
    if (retryable.length) enrichFashionItems(retryable);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  const retryIndexJob = useCallback((id) => {
    const item = (shelfStateRef.current.items || []).find((x) => x.id === id);
    if (!item) return;
    // enrichFashionItem re-registers the row: back to fetching, attempts++.
    enrichFashionItem(item);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dismiss keeps the URL: the bare link card stays on the shelf for the
  // person to fill in by hand. Only the row leaves.
  const dismissIndexJob = useCallback((id) => {
    setIndexJobs((jobs) => jobs.filter((j) => j.id !== id));
  }, []);

  const cancelIndexJob = useCallback((id) => {
    const controller = enrichmentControllersRef.current.get(id);
    if (controller) controller.abort();
    // An aborted enrich never writes "ready" itself (the catch skips aborted
    // tokens), so the card does not spin in the Inbox forever.
    updateItem(id, { status: "ready" });
    setIndexJobs((jobs) => jobs.filter((j) => j.id !== id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const indexShownRows = useMemo(() => indexJobs.filter((j) => j.shown), [indexJobs]);
  // The paste bar carries the lead job (indexing handoff, direction 1b: "the
  // paste bar carries it"). While a job is live the desktop search field
  // swaps to the platform tile, the pasted URL, the stage label and the green
  // wash + bar; the Stash button dims and goes inert. Once everything has
  // indexed, the field holds INDEXED until the strip's own exit clears the
  // jobs. When only failures remain the field goes back to search — failure
  // copy and Retry live in the strip, not the field.
  const indexFieldJob = useMemo(() => {
    if (!indexShownRows.length) return null;
    const live = indexShownRows.find((j) => !isSettled(j));
    if (live) return live;
    if (indexShownRows.some((j) => j.state === "failed")) return null;
    return indexShownRows[indexShownRows.length - 1];
  }, [indexShownRows]);
  const indexHeader = useMemo(() => headerFor(indexShownRows), [indexShownRows]);
  // Over 6 links the strip caps at 4 visible rows and the header carries the
  // total; completed rows leave the visible set so the next queued link takes
  // the slot.
  const indexVisibleRows = useMemo(
    () => visibleRows(indexShownRows, indexShownRows.length > 6 ? 4 : indexShownRows.length || 4),
    [indexShownRows]
  );
  const indexLead = useMemo(
    () => indexVisibleRows.find((j) => !isSettled(j)) || indexVisibleRows[0] || null,
    [indexVisibleRows]
  );

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
    // Part 7e: a signed-in Free user over the Ask allowance gets the honest
    // message instead of a server 429.
    //
    // Kyle 2026-07-30, rule 2: this line no longer carries its own upgrade
    // words. Every wall opens the ONE limits sheet, and the sheet holds the
    // caps and the price, so the Ask box cannot quote a number that drifts.
    if (overFreeLimit(accountPlan, "ask")) {
      setAskState({
        status: "error",
        query,
        answer: "",
        results: [],
        error: "That is your Free Ask allowance.",
      });
      noteAllowanceRequired("free", "ask");
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
        const message = String((payload && payload.error) || "");
        if (message.startsWith("Free ")) noteAllowanceRequired("free", "ask");
        else if (message.startsWith("Monthly ")) noteAllowanceRequired("monthly", "ask");
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

      // LB-59. ask.js records at line 238, after the structured response passes
      // validation — so a 429 from Anthropic, a 502, and a malformed answer are
      // all free on the server. The client counts at the same moment, and not
      // one line earlier: this counter is what overFreeLimit blocks on, and a
      // Free users spend answers, not failed attempts.
      bumpUsage("ask", { audience: usageAudience(accountPlan, signedInAccount) });
      trackProductEvent("usage_success", { plan: usageAudience(accountPlan, signedInAccount), feature: "ask" });

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
    // Filter strip: one chip at a time. "all" is the whole shelf.
    // likesOnly (search sheet 7b) further narrows to favourites on any filter.
    if (shelfFilter === "starred" || likesOnly) a = a.filter((x) => x.favorite === true);
    if (shelfFilter === "bought")
      a = a.filter((x) => normalizeFindStatus(x.findStatus) === "bought");
    else if (shelfFilter === "tobuy")
      a = a.filter((x) => normalizeFindStatus(x.findStatus) !== "bought");
    if (q) return a;
    // Newest first — favoriting only marks the card, it never moves it.
    a.sort((x, y) => y.createdAt - x.createdAt);
    return a;
  }, [typed, q, shelfFilter, likesOnly]);

  // Live counts for the filter strip. They count the searched set, so the
  // chips agree with what a search leaves on the shelf.
  const shelfFilterCounts = useMemo(() => {
    let starred = 0;
    let bought = 0;
    for (const x of visible) {
      if (x.favorite === true) starred += 1;
      if (normalizeFindStatus(x.findStatus) === "bought") bought += 1;
    }
    return { all: visible.length, starred, bought, tobuy: visible.length - bought };
  }, [visible]);

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
  // Collect up to 4 covers — one per square of the card's 2x2 collage.
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
        // [{ image, createdAt }] — sorted newest-first for the collage.
        coverItems: [],
        // Haul-shaped copies of the same cards, for the fulfillment projections.
        haulItems: [],
      };
      cur.count += 1;
      cur.value += price;
      if (created >= cur.latest) cur.latest = created;
      if (item.image) {
        cur.coverItems.push({ image: item.image, createdAt: created });
      }
      // Haul fulfillment (design/handoffs/haul). The card's flag, note, stage
      // bar and CTA are all projections of these. Nothing is stored.
      cur.haulItems.push(
        toHaulItem(item, { estGrams: estimateItemWeightGrams(item), priceUsd: price })
      );
      map.set(name, cur);
    }
    // The shipping settings a person edited, by haul name. A haul that never
    // opened the parcel panel has none, so the card falls back to the starting
    // numbers. See migrateHaulShip.
    const shipByName = new Map(hauls.map((h) => [h.name, h.ship]));
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
        .slice(0, 4);
      const ship = shipByName.get(haul.name) || null;
      const maths = parcelMaths({
        items: haul.haulItems,
        packagingGrams: ship ? ship.packagingGrams : undefined,
        divisor: ship ? ship.divisor : undefined,
        rates: ship ? ship.rates : undefined,
      });
      const card = haulIndexCard({
        items: haul.haulItems,
        submitted: ship ? ship.submitted : false,
        milestone: ship ? ship.milestone : 0,
        maths,
        line: ship ? ship.line : undefined,
        domesticUsd: ship ? ship.domesticUsd : undefined,
      });
      return {
        name: haul.name,
        count: haul.count,
        value: haul.value,
        latest: haul.latest,
        covers,
        // Everything below is derived on every render. None of it is stored.
        flag: card.flag,
        note: card.note,
        tone: card.tone,
        cta: card.label,
        ctaVariant: card.variant,
        ctaTo: card.to,
        openQc: card.openQc,
        // The haul-shaped items ride along so the CTA can jump straight to the
        // first card waiting on a verdict, without rebuilding them.
        haulItems: haul.haulItems,
        bar: stageBar(haul.haulItems),
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
    return { hauls: active, archivedCount, needsYou: needsYouCount(active) };
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

  // The slug map for haul addresses: every name the address bar could mean,
  // from the haul records and the cards' project tags. Derived, never stored.
  const haulRouteSlugMap = useMemo(
    () =>
      haulSlugMap([
        ...hauls.map((h) => (h && typeof h.name === "string" ? h.name : "")),
        ...shelfAll.map((entry) =>
          entry && typeof entry.project === "string" ? entry.project.trim() : ""
        ),
      ]),
    [hauls, shelfAll]
  );
  // Sync during render, not in an effect — the popstate listener reads this
  // ref, and an effect would hand it one-render-old state (the pricePrimary
  // mirror above hit the same wall, Kyle 2026-07-28).
  haulRouteRef.current = {
    activeHaul,
    haulDrawerId,
    qcItemId,
    handoffOpen,
    trackingOpen,
    view,
    reducedMotion,
    slugMap: haulRouteSlugMap,
  };

  // Haul addresses (STEPS-HANDOFF item 1): the same pushState pattern as
  // /settings (navigateSettings above). Every haul screen is a real entry;
  // the one popstate listener reads it back.
  const pushHaulRoute = (url, state) => {
    try {
      window.history.pushState(state, "", url);
    } catch {}
  };
  const parcelRouteFor = (haulName) => "/parcels/" + haulSlugForName(haulName, haulRouteSlugMap) + "-a";
  // Overlays (drawer, QC, hand-off) are not routed — they push an entry on
  // top of the haul address, so Back peels them before it navigates. The
  // stack remembers the open order: QC can sit over the drawer, and the
  // topmost one must close first or Back would pull the drawer out from
  // under an open QC screen.
  const haulOverlayStackRef = useRef([]);
  const pushHaulOverlay = (kind, url) => {
    haulOverlaySeqRef.current += 1;
    haulOverlayStackRef.current.push({ kind });
    try {
      // An empty url keeps the address the haul already owns. The QC deep
      // link (item 9) passes one, so the takeover is a shareable address.
      window.history.pushState({ czHaulOverlay: haulOverlaySeqRef.current }, "", url || "");
    } catch {}
  };
  const openHaulDrawer = (id) => {
    pushHaulOverlay("drawer");
    setHaulDrawerId(id);
  };
  const openQcReview = (id) => {
    pushHaulOverlay("qc");
    setQcItemId(id);
  };
  const openHandoff = () => {
    pushHaulOverlay("handoff");
    setHandoffOpen(true);
  };
  // Closing an overlay by hand walks the same path Back would: pop the
  // overlay entry and let the popstate listener clear the state. Without an
  // entry to pop (a visit that landed with the overlay open), clear directly.
  const closeHaulOverlay = (clear) => {
    if (haulOverlaySeqRef.current > 0) {
      try {
        window.history.back();
        return;
      } catch {}
    }
    clear();
  };
  // Item 9: closing QC also drops ?qc=first. An in-app takeover rides an
  // overlay entry whose Back walk reveals the plain haul address by itself;
  // a takeover the visit LANDED on owns no entry, so the address is
  // rewritten instead (the same rule as closeHaul).
  const closeQc = () => {
    const landed = haulOverlaySeqRef.current === 0;
    closeHaulOverlay(() => setQcItemId(null));
    if (landed && window.location.search) {
      try {
        window.history.replaceState(window.history.state, "", window.location.pathname);
      } catch {}
    }
  };
  const openHaul = useCallback((haulKey) => {
    setView("hauls");
    // Kyle 2026-08-02: a haul opens on the board and the grid, never the
    // carousel. Desktop used to switch viewMode to "carousel" here, which
    // both stacked a rack under the board and silently changed the Shelf
    // tab's own view on the way back out. Both surfaces keep their own view
    // now. (The phone never took this branch: the rack does not fit a 390px
    // screen, and hijacking viewMode stranded the customer in a glitching
    // carousel until an app restart, Kyle 2026-07-25.)
    setExpandedId(null);
    setSelectedId(null);
    setActiveHaul(haulKey);
    const slug = haulSlugForName(haulKey, haulRouteRef.current.slugMap);
    pushHaulRoute("/hauls/" + slug, { czHaul: slug });
  }, []);

  // The index CTA jumps straight into QC when that is what the haul is asking
  // for. The README calls this the highest-value shortcut in the feature: from
  // "2 at QC" on the grid to the first photo, in one press.
  const openHaulCta = useCallback(
    (haul) => {
      openHaul(haul.name);
      // A parcel already with the agent is asking one question: where is it?
      // The board cannot answer that, so the CTA lands on tracking instead.
      if (haul.ctaTo === "tracking") {
        pushHaulRoute(parcelRouteFor(haul.name), { czParcel: true });
        setTrackingOpen(true);
        return;
      }
      if (!haul.openQc) return;
      const first = firstPendingQcItem(haul.haulItems || []);
      if (first) {
        // STEPS-HANDOFF item 9: the takeover owns a real address while it is
        // open. The overlay entry carries /hauls/<slug>?qc=first, so closing
        // by hand or by Back both land on the plain haul address — the param
        // cannot outlive the takeover.
        const slug = haulSlugForName(haul.name, haulRouteRef.current.slugMap);
        pushHaulOverlay("qc", "/hauls/" + slug + "?qc=first");
        setQcItemId(first.id);
      }
    },
    // openQcReview and parcelRouteFor read the route refs, which are always
    // current — listing them would only re-make the callback every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [openHaul]
  );

  // Everything the QC overlay needs, derived from the open item. The overlay
  // walks the haul's queue, so it gets the whole haul, not one card.
  const qcContext = useMemo(() => {
    if (!qcItemId) return null;
    const card = shelfAll.find((entry) => entry && entry.id === qcItemId);
    if (!card) return null;
    const name = typeof card.project === "string" ? card.project.trim() : "";
    const peers = name
      ? shelfAll.filter(
          (entry) => typeof entry.project === "string" && entry.project.trim() === name
        )
      : [card];
    return {
      items: peers.map((entry) => {
        const usd = itemUsdAmount(entry);
        return toHaulItem(entry, {
          estGrams: estimateItemWeightGrams(entry),
          priceUsd: usd != null ? usd : 0,
        });
      }),
    };
  }, [qcItemId, shelfAll]);

  // The open haul's cards, in the shape the stage board reads. Built from
  // `shelfAll`, not from the shelf surface: a search narrows what you browse,
  // it must never narrow what the parcel weighs.
  const haulFlowItems = useMemo(() => {
    if (!openHaulName) return [];
    return shelfAll
      .filter(
        (entry) => entry && typeof entry.project === "string" && entry.project.trim() === openHaulName
      )
      .map((entry) => {
        const usd = itemUsdAmount(entry);
        return toHaulItem(entry, {
          estGrams: estimateItemWeightGrams(entry),
          priceUsd: usd != null ? usd : 0,
        });
      });
  }, [openHaulName, shelfAll]);

  // How each item in the haul fitted, once it arrived. This is a real answer
  // from the person's hand, so it is saved on the card, not worked out.
  const haulFits = useMemo(() => {
    if (!openHaulName) return {};
    const map = {};
    for (const entry of shelfAll) {
      if (!entry || typeof entry.project !== "string") continue;
      if (entry.project.trim() !== openHaulName) continue;
      if (FIT_OPTIONS.includes(entry.haulFit)) map[entry.id] = entry.haulFit;
    }
    return map;
  }, [openHaulName, shelfAll]);

  // The item open in the drawer. Read out of `haulFlowItems`, so an edit in
  // the drawer repaints the board and the drawer from the same numbers.
  const haulDrawerItem = useMemo(() => {
    if (!haulDrawerId) return null;
    return haulFlowItems.find((entry) => entry && entry.id === haulDrawerId) || null;
  }, [haulDrawerId, haulFlowItems]);

  // The cover picture and the platform colour for one board tile. The board
  // holds no card, so the screen looks the card up for it.
  const haulTileFor = useCallback(
    (item) => {
      const card = shelfAll.find((entry) => entry && entry.id === item.id);
      if (!card) return { image: null, tint: null };
      return { image: card.image || null, tint: platformDotFor(card.host || "") };
    },
    [shelfAll]
  );

  // One clipboard path for every haul surface. Same shape as share-api's
  // copyLink: a blocked clipboard must never throw into the render tree.
  //
  // Kyle 2026-08-03 audit, finding 4: "Copy is blocked in this browser." was
  // the whole message. It named no other way to get the text, and the toast
  // held no button. A blocked clipboard is common — an old browser, a page
  // that is not on HTTPS, or a permission a person already refused. The text
  // now opens in a panel so they can select it and copy it by hand.
  const [copyFallbackText, setCopyFallbackText] = useState(null);
  const copyForHaul = useCallback(
    async (text, message) => {
      try {
        if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
          setCopyFallbackText(text || "");
          return;
        }
        await navigator.clipboard.writeText(text);
        notify(message);
      } catch {
        setCopyFallbackText(text || "");
      }
    },
    [notify]
  );

  // The haul's shipping settings, and one writer for them. Absent means the
  // person has never touched the parcel panel, so the starting numbers stand.
  const haulShip = useMemo(() => {
    if (!openHaulName) return null;
    const record = hauls.find((h) => h.name === openHaulName);
    return (record && record.ship) || null;
  }, [openHaulName, hauls]);

  // The open haul's parcel arithmetic. The board works this out for itself;
  // the hand-off screen needs the same numbers, so both read one source.
  const haulFlowMaths = useMemo(
    () =>
      parcelMaths({
        items: haulFlowItems,
        packagingGrams: haulShip ? haulShip.packagingGrams : undefined,
        divisor: haulShip ? haulShip.divisor : undefined,
        rates: haulShip ? haulShip.rates : undefined,
      }),
    [haulFlowItems, haulShip]
  );

  const patchHaulShip = useCallback(
    (patch, detail) => {
      if (!openHaulName) return;
      updateHaul(
        openHaulName,
        (base) => {
          const ship = migrateHaulShip(base.ship || {});
          // A patch that reads the record it edits gets it, so a caller never
          // has to migrate the record twice to change one slot of an array.
          return { ship: { ...ship, ...(typeof patch === "function" ? patch(ship) : patch) } };
        },
        { type: "ship", detail }
      );
    },
    [openHaulName, updateHaul]
  );

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
  // Top-8 menu (2026-08-02): one sum path follows pricePrimary for any code.
  const listTotalPrimary = useMemo(
    () => sumItemsIn(totalsItems, pricePrimary, { excludeReturned: !!openHaulName }),
    [totalsItems, openHaulName, pricePrimary]
  );
  // Design 7a dropped the phone weight/money summary pill. Haul weight now
  // lives only in the strip, the rail maths, and the item rows (STEPS-HANDOFF
  // § The one weight story; the legacy header that read haulPipeline is gone).
  // Desktop totals stay below.
  // Same context for the count chip — one consistent spot next to the total.
  // Starred filter MUST show through here. Keep the label short on mobile so
  // "N starred of M saved" + TOTAL SHELF COST + heart don't pile up.
  // Desktop: totals + view icons ride the right of the Shelf/Hauls tabs row
  // (Kyle 2026-08-01). Phone 7a keeps totals off the chrome (dock only).
  const shelfTotalsVisible =
    view !== "inbox" && shelfAll.length > 0 && (view !== "hauls" || openHaulName);
  // The chip already names the filter, so the count only has to say how many
  // cards it left behind. "N shown" beats repeating the chip word back.
  const totalCountLabel = openHaulName
    ? totalsItems.length + (totalsItems.length === 1 ? " item" : " items")
    : q
      ? visible.length + " found"
      : shelfFilter !== "all"
        ? totalsItems.length + " shown"
        : shelfAll.length + " saved";

  const closeHaul = useCallback(() => {
    if (!activeHaul) return;
    // The address leads (STEPS-HANDOFF item 1). A haul that was opened in-app
    // owns history entries, so "All hauls" walks back to the /hauls entry and
    // the popstate listener runs the fade and clears the state. A visit that
    // LANDED on /hauls/<slug> owns no earlier entry — going back would leave
    // the app — so it rewrites the address instead (same rule as settings).
    if (haulBootRef.current) {
      haulBootRef.current = false;
      parcelBootRef.current = false;
      if (!reducedMotion) setClosingHaulName(activeHaul);
      setActiveHaul(null);
      setExpandedId(null);
      setSelectedId(null);
      // Both of these belong to one haul. Leaving them open over a closed haul
      // shows the person a parcel that is no longer on screen.
      setHandoffOpen(false);
      setTrackingOpen(false);
      setHaulDrawerId(null);
      haulOverlaySeqRef.current = 0;
      haulOverlayStackRef.current = [];
      try {
        window.history.replaceState({ czHaul: "index" }, "", "/hauls");
      } catch {}
      return;
    }
    try {
      window.history.back();
    } catch {
      // No history to walk (should not happen): clear by hand.
      if (!reducedMotion) setClosingHaulName(activeHaul);
      setActiveHaul(null);
      setExpandedId(null);
      setSelectedId(null);
      setHandoffOpen(false);
      setTrackingOpen(false);
      setHaulDrawerId(null);
      haulOverlaySeqRef.current = 0;
      haulOverlayStackRef.current = [];
    }
  }, [activeHaul, reducedMotion]);

  // Tracking sits at /parcels/<id>. Closing walks back to the haul's entry;
  // a visit that LANDED on the parcel rewrites the address to the haul page.
  const closeTracking = () => {
    if (parcelBootRef.current) {
      parcelBootRef.current = false;
      setTrackingOpen(false);
      try {
        const slug = haulSlugForName(activeHaul, haulRouteRef.current.slugMap);
        window.history.replaceState({ czHaul: slug }, "", "/hauls/" + slug);
      } catch {}
      return;
    }
    try {
      window.history.back();
    } catch {
      setTrackingOpen(false);
    }
  };

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
  // Fully received hauls use the v2 haul share document (buildHaulShareSnapshot).
  const haulIsFullyReceived = useMemo(() => {
    if (!openHaulName || !haulShip) return false;
    if (haulShip.submitted !== true) return false;
    const step = Number(haulShip.milestone);
    return Number.isFinite(step) && step >= RECEIVED_INDEX;
  }, [openHaulName, haulShip]);

  const buildHaulShareDoc = useCallback(
    (options = {}) => {
      const name = shareHaulName || openHaulName;
      // Normalize shelf cards into the fields the v2 snapshot expects.
      const list = shareItemsFor(name).map((item) => {
        const gallery = Array.isArray(item.gallery) ? item.gallery : [];
        const photos = Array.isArray(item.photos) && item.photos.length
          ? item.photos
          : [item.image, ...gallery].filter(Boolean);
        return {
          ...item,
          photos,
          albumUrl:
            item.albumUrl ||
            (Array.isArray(item.links)
              ? (item.links.find((l) => l && l.role === "photos") || {}).url
              : null),
          seller: item.seller || item.shop || "",
        };
      });
      const record = hauls.find((h) => h.name === name) || null;
      const ship = record && record.ship ? migrateHaulShip(record.ship) : null;
      const maths = parcelMaths({
        items: list.map((item) =>
          toHaulItem(item, {
            estGrams: item.weightGrams,
            priceUsd: itemUsdAmount(item),
          })
        ),
        packagingGrams: ship ? ship.packagingGrams : undefined,
        divisor: ship ? ship.divisor : undefined,
        rates: ship ? ship.rates : undefined,
      });
      const line = ship && ship.line ? ship.line : "EMS";
      const costUsd =
        maths && maths.costs && maths.costs[line] != null ? maths.costs[line] : null;
      const shipOpts =
        ship && Number.isFinite(Number(costUsd)) && Number(costUsd) > 0
          ? {
              line,
              costUsd: Number(costUsd),
              chargeableG: maths.chargeableG,
              domesticUsd: ship.domesticUsd,
            }
          : ship
            ? {
                line: ship.line || undefined,
                chargeableG: maths.chargeableG,
                domesticUsd: ship.domesticUsd,
              }
            : null;
      const orderedAt =
        ship && Array.isArray(ship.milestoneAt) && ship.milestoneAt[0]
          ? ship.milestoneAt[0]
          : null;
      const receivedAt =
        ship && Array.isArray(ship.milestoneAt) && ship.milestoneAt[RECEIVED_INDEX]
          ? ship.milestoneAt[RECEIVED_INDEX]
          : null;
      const agentName =
        (preferredAgentInfo && preferredAgentInfo.name) ||
        (getAgent(preferredAgent) || {}).name ||
        null;
      return buildHaulShareSnapshot(list, {
        includes: options.includes,
        layout: options.layout || "both",
        title: name,
        now: Date.now(),
        agent: agentName,
        ship: shipOpts,
        orderedAt,
        receivedAt,
        profile: bodyProfile,
        buyUrlFor: (item) => {
          const url = item && (item.url || item.storeUrl);
          if (!url) return null;
          const result = buildAgentUrl(preferredAgent, url);
          return result && result.url ? result.url : null;
        },
        fitFor: (item) => {
          const chart = parseSizeChart(sizeChartTextFor(item));
          const recommended = computeRecommendedSize(item, bodyProfile, fitPrefs);
          return buildSharedFit({
            category: item.category,
            sizeBought: item.size,
            chart,
            profile: bodyProfile,
            recommendedSize: recommended,
          });
        },
        weightKeyFor: (item) =>
          refineWeightKeyFromText(
            [item && item.title, item && item.summary, item && item.note]
              .filter(Boolean)
              .join(" "),
            item && item.category
          ),
      });
    },
    [
      shareHaulName,
      openHaulName,
      shareItemsFor,
      hauls,
      preferredAgent,
      preferredAgentInfo,
      bodyProfile,
      fitPrefs,
    ]
  );

  const createHaulShareV2 = useCallback(
    async (options) => {
      const session = await getValidSession();
      if (!session) {
        setAccountSession(null);
        throw new Error("Your sign-in expired. Sign in again first.");
      }
      const doc = options.doc || buildHaulShareDoc(options);
      const result = await createShare(session.accessToken, {
        code: makeShareCode(),
        doc,
        unlisted: false,
        hideFooter: false,
        expiresAt: null,
      });
      return result.url;
    },
    [buildHaulShareDoc]
  );

  // Profile → Shared links. The list comes from the server, because a link
  // made on a phone must be deletable from a laptop and the shelf has never
  // held the codes. The server sends the code alone; the URL is built here,
  // against this origin, so a preview build lists preview links.
  const listHaulShares = useCallback(async () => {
    const session = await getValidSession();
    if (!session) {
      setAccountSession(null);
      throw new Error("Your sign-in expired. Sign in again first.");
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
      throw new Error("Your sign-in expired. Sign in again first.");
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
    currencySheetOpen,
    captureSheetOpen,
    settingsOpen: !!settingsView,
    viewMode,
    view,
    activeHaul,
    carouselOverlay,
    isWideDetail,
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
          ctx.currencySheetOpen ||
          ctx.captureSheetOpen ||
          ctx.settingsOpen
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
        ctx.currencySheetOpen ||
        ctx.captureSheetOpen ||
        ctx.settingsOpen
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

      // An open detail surface owns Left/Right first (Kyle 2026-07-28: "when
      // you click right on your keyboard, it should go to the next card.
      // That's the point of the carousel … it lets you see multiple
      // different articles of clothing fast in that view"). Step the OPEN
      // card along the shelf order, wrapping at the ends. preventDefault
      // stands the rack CoverFlow down (its window listener checks
      // defaultPrevented), so the rack behind never double-steps. The wide
      // detail panel is a native dialog — it calls the same helper through
      // its onStepItem prop (the dialog[open] stand-down above keeps this
      // handler out of its way).
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const detailId = ctx.carouselOverlay || (ctx.isWideDetail ? ctx.expandedId : null);
        if (detailId && list.length > 1) {
          e.preventDefault();
          stepDetailItemRef.current(detailId, e.key === "ArrowRight" ? 1 : -1);
          return;
        }
      }
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
          // Wide desktop panel: requestClose plays t-modal is-closing first.
          // Flip overlay: closeCarouselOverlay still owns the timer.
          closeCarouselOverlayRef.current();
          return;
        }
        // Rack-opened desktop panel (≥1024, no overlay) — same t-modal close.
        if (ctx.isWideDetail && ctx.expandedId && desktopPanelCloseRef.current) {
          desktopPanelCloseRef.current();
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
      // No type-anywhere (KM-01): printable keys never leave the field the
      // user is in, and nothing opens the Stash sheet behind their back.
      // Search is focused with ⌘K; stash is the ＋ Stash button.
    };
    const onPaste = (e) => {
      if (
        kb.current.digest ||
        kb.current.importOpen ||
        kb.current.agentSheetOpen ||
        kb.current.currencySheetOpen ||
        kb.current.captureSheetOpen ||
        kb.current.settingsOpen
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
        // A phone paste opens the review sheet. An unowned desktop paste is an
        // ambient shortcut, so only valid links can create cards there.
        if (window.matchMedia("(max-width: 767px)").matches) {
          setInput(text.trim());
          setCaptureSheetOpen(true);
        } else {
          const result = dispatchStashRef.current(text.trim(), { linksOnly: true });
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
  // Flip-card overlay (<1024): plays is-closing, then unmounts after 150ms.
  // Wide desktop panel owns its own t-modal close (DesktopDetailPanel); when
  // the panel finishes it calls hardUnmountCarouselOverlay via onClose.
  const hardUnmountCarouselOverlay = useCallback(() => {
    if (overlayCloseTimer.current) {
      clearTimeout(overlayCloseTimer.current);
      overlayCloseTimer.current = null;
    }
    setExpandedId(null);
    setCarouselOverlay(null);
    setOverlayPhase("closed");
  }, []);
  const closeCarouselOverlay = useCallback(() => {
    if (overlayPhase === "closing" || !carouselOverlay) return;
    setExpandedId(null);
    // Wide desktop card: route through the panel's requestClose so the
    // t-modal is-closing path runs (Kyle 2026-08-02 item 7).
    if (isWideDetail && desktopPanelCloseRef.current) {
      desktopPanelCloseRef.current();
      return;
    }
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
  }, [overlayPhase, carouselOverlay, isWideDetail]);
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

  // Kyle 2026-08-04: grid → detail must feel like carousel → detail. That path
  // is the t-modal (scale 0.96 → 1). The photo morph was a second entrance and
  // read as the “sucky” grid open, so the grid no longer starts a morph.
  //
  // Wide desktop rack opens DesktopDetailPanel via expandedId. Grid and narrow
  // use the same panel through the solo overlay (openInCarousel). Phone keeps
  // the bottom DetailSheet. nodes is accepted so PhotoShelfList does not change.
  const openWithMorph = (id, _nodes) => {
    setMorphOpenId(null);
    if (isPhone) {
      setDetailSheetId(id);
      return;
    }
    if (isWideDetail) {
      setSelectedId(id);
      setExpandedId(id);
      return;
    }
    openInCarousel(id);
  };

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
  // Kyle 2026-08-04: Shelf ↔ Hauls used mode="wait" (exit, blank, enter). That
  // made the page go empty for a beat. Crossfade both layers so one surface
  // is always on screen. Opacity only — no layout thrash.
  const HAUL_SURFACE_TRANSITION = {
    duration: reducedMotion ? 0 : 0.28,
    ease: [0.22, 1, 0.36, 1],
  };
  const haulDirectorySurface = (
    <motion.section
      key="directory"
      data-cz-surface="directory"
      role="tabpanel"
      id="view-panel-hauls"
      aria-labelledby="view-tab-hauls"
      className="cz-hauls-panel"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
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
        {/* How many hauls are asking for something. Silent when none are. The
            README only prints the plural, so the singular reads "1 needs you". */}
        {haulDirectory.needsYou > 0 ? (
          <div className="cz-hauls-needs-you">
            {haulDirectory.needsYou} {haulDirectory.needsYou === 1 ? "needs" : "need"} you
          </div>
        ) : null}
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
            // The whole card opens the haul, and the CTA inside it opens the
            // same haul at the step it names (haul README, "Index card"). A
            // button cannot nest inside a button, so the card takes role and
            // keyboard rather than being one.
            <div
              key={haul.name}
              role="button"
              tabIndex={0}
              className="cz-haul-card"
              data-haul-name={haul.name}
              data-tone={haul.tone}
              // The label now lives inside the aria-hidden fan, so the card
              // states its own name.
              aria-label={
                haul.name +
                ", " +
                haul.count +
                (haul.count === 1 ? " item" : " items") +
                (haul.value > 0 ? ", $" + Math.round(haul.value) : "") +
                (haul.note ? ". " + haul.note : "")
              }
              onClick={() => openHaul(haul.name)}
              onKeyDown={(e) => {
                if (e.key !== "Enter" && e.key !== " ") return;
                e.preventDefault();
                openHaul(haul.name);
              }}
            >
              {/* Kyle 2026-07-29 ("match shelf"): the haul name reads ON the
                  picture, like a Shelf card — not in a box under it. It rides
                  inside the collage so the collage clips the scrim. The collage
                  is aria-hidden, so the card carries its own name.
                  Kyle 2026-08-02: the collage is a 2x2 block of clothes now,
                  not a stack that fans out on hover. */}
              <HaulCoverMosaic
                covers={haul.covers}
                name={haul.name}
                count={haul.count}
                // The badge is absent when the haul has nothing to say. An
                // always-present badge is noise.
                badge={
                  haul.flag ? (
                    <span className="cz-haul-flag" data-tone={haul.tone}>
                      {haul.flag}
                    </span>
                  ) : null
                }
                label={
                  <div className="cz-haul-card-label">
                    <div className="cz-haul-card-name">{haul.name}</div>
                    <div className="cz-haul-card-meta">
                      {haul.count} {haul.count === 1 ? "item" : "items"}
                      {haul.value > 0 ? " · $" + Math.round(haul.value) : ""}
                    </div>
                  </div>
                }
              />
              {haul.bar.length ? (
                <div className="cz-haul-bar" aria-hidden="true">
                  {haul.bar.map((seg) => (
                    <span
                      key={seg.stage}
                      className="cz-haul-bar-seg"
                      data-stage={seg.stage}
                      style={{ flex: seg.count }}
                    />
                  ))}
                </div>
              ) : null}
              <div className="cz-haul-note" data-tone={haul.tone}>
                <span className="cz-haul-note-dot" aria-hidden="true" />
                <span>{haul.note}</span>
              </div>
              <Pill
                primary={haul.ctaVariant === "primary"}
                className="cz-pill cz-haul-cta"
                // The CTA sits inside the card, so it must not fire the card
                // as well (haul README, "Index card").
                onClick={(e) => {
                  e.stopPropagation();
                  openHaulCta(haul);
                }}
              >
                {haul.cta}
              </Pill>
            </div>
          ))}
          {/* KM-07: two haul cards sat in a large empty canvas. A dashed
              ghost tile fills the grid and teaches the next action. */}
          <button
            type="button"
            className="cz-haul-card cz-haul-card--ghost"
            onClick={() => setView("shelf")}
          >
            <div className="cz-haul-mosaic is-single is-empty">
              <div className="cz-haul-mosaic-tile is-empty">
                <div className="cz-haul-mosaic-placeholder" aria-hidden="true">
                  ＋
                </div>
              </div>
            </div>
            {/* The ghost tile is an invitation, not a haul. It has no photo, so
                its words stay under the tile, in the app's own ink. */}
            <div className="cz-haul-card-label">
              <div className="cz-haul-card-name">Start a haul</div>
              <div className="cz-haul-card-meta">Add from any card's ⋯ menu</div>
            </div>
          </button>
        </div>
      )}
    </motion.section>
  );

  // "Sizes" entries everywhere (card fit rows, the detail surfaces) land on
  // the routed settings page now — one destination, both breakpoints.
  const openSizesDestination = () => navigateSettings("sizes");

  // Plain shelf surface — also doubles as the open-haul carousel/cards/rows
  // surface when view === "hauls" && activeHaul (branches internally on viewMode).
  // Fades on every surface swap: Shelf <-> directory, directory <-> open
  // haul — one AnimatePresence at the render site drives all three (Kyle
  // 2026-08-02). In-shelf switches (viewMode, filter chips) never remount
  // the "shelf" key, so those stay instant as before.
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
      onSkipFitPrompt={skipFitPrompt}
      fitPrefs={fitPrefs}
      onSaveFitPref={saveFitPref}
      onCycleFitDetail={() => setFitDetail((v) => (v === "detailed" ? "concise" : "detailed"))}
      fitDetail={fitDetail}
      onToggleFitSummary={() => setFitSummary((v) => !v)}
      fitSummary={fitSummary}
      onOpenSizes={openSizesDestination}
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

  // Arrow keys walk the shelf order from inside an open detail (Kyle
  // 2026-07-28: "when you click right on your keyboard, it should go to the
  // next card"). One helper, two entrances: the global key handler calls it
  // through the ref (solo overlay), the wide panel through the onStepItem
  // prop. Wraps at the ends; a stepped-to card starts face-up.
  const stepDetailItem = (currentId, step) => {
    if (listItems.length < 2) return;
    const cur = listItems.findIndex((x) => x.id === currentId);
    const next = listItems[(Math.max(cur, 0) + step + listItems.length) % listItems.length];
    setSelectedId(next.id);
    if (carouselOverlay) {
      setExpandedId(null);
      setCarouselOverlay(next.id);
    } else {
      setExpandedId(next.id);
    }
  };
  stepDetailItemRef.current = stepDetailItem;

  // Fix B (handoff turn 4): the two-column no-flip detail panel at ≥1024px.
  // Shared by the grid-tap overlay and the rack-tap expansion — same item,
  // same actions, only the close target differs.
  const renderDetailPanel = (panelItem, onClose, closing = false) => (
    <DesktopDetailPanel
      item={panelItem}
      onStepItem={(step) => stepDetailItem(panelItem.id, step)}
      haulNames={haulNames}
      bodyProfile={bodyProfile}
      fitPrefs={
        panelItem.category && fitPrefs
          ? { [panelItem.category]: fitPrefs[panelItem.category] }
          : null
      }
      onSaveBodyProfile={(profile) => {
        setBodyProfile((prev) => ({ ...(prev || {}), ...profile }));
        setFitPromptSkipped(false);
        notify("Sizes updated.");
      }}
      fitPromptSkipped={fitPromptSkipped}
      onSkipFitPrompt={skipFitPrompt}
      onSaveFitPref={saveFitPref}
      onCycleFitDetail={() => setFitDetail((v) => (v === "detailed" ? "concise" : "detailed"))}
      fitDetail={fitDetail}
      onToggleFitSummary={() => setFitSummary((v) => !v)}
      fitSummary={fitSummary}
      measureUnits={measureUnits}
      onChangeUnits={setMeasureUnits}
      buyLabel={buyLabel}
      preferredAgent={preferredAgent}
      onSelectAgent={chooseBuyingAgent}
      onSaveEdit={saveEdit}
      onOpen={recordOpen}
      onAttachPhoto={attachGalleryImage}
      onRemovePhoto={removePhotoBySrc}
      onOpenSizes={openSizesDestination}
      onSetPrimaryImage={setPrimaryImage}
      onLoadPhotos={loadAlbumPhotos}
      onToggleFavorite={toggleFavorite}
      onShareCard={shareCard}
      onDelete={setPendingDeleteId}
      onClose={onClose}
      closing={closing}
      registerClose={(fn) => {
        desktopPanelCloseRef.current = fn;
      }}
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
  // morphOpenId is retired for open entrances (Kyle 2026-08-04) but kept so a
  // stale flag cannot pin a panel in morph mode forever.
  useEffect(() => {
    if (!morphOpenId) return;
    if (detailSheetId || carouselOverlay || expandedId) return;
    setMorphOpenId(null);
  }, [morphOpenId, detailSheetId, carouselOverlay, expandedId]);

  // The sheet closes itself when its card leaves the shelf (Undo expiry, a
  // filter change, a delete), so a stale id can never render an empty sheet.
  const detailItem = detailSheetId
    ? items.find((x) => x.id === detailSheetId) || null
    : null;

  const shelfSurface = (
    <motion.section
      key={openHaulName ? "haul:" + openHaulName : "shelf"}
      data-cz-surface={openHaulName ? "haul" : "shelf"}
      role="tabpanel"
      id={view === "hauls" ? "view-panel-hauls" : "view-panel-shelf"}
      aria-labelledby={view === "hauls" ? "view-tab-hauls" : "view-tab-shelf"}
      // Kyle 2026-08-04: soft crossfade only (no scale shrink). First load
      // still skips enter (AnimatePresence initial={false}). In-shelf
      // switches (viewMode, filter chips) never remount this key.
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
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
          <div className="cz-empty-panel" role="status">
            <div className="cz-empty-panel-title">
              {/* A filter that hides everything must never read as loss. The
                  handoff copy says so plainly: the cards are still there. */}
              {q
                ? "No matches for “" + search.trim() + "”."
                : shelfFilter !== "all"
                  ? "Nothing on this filter."
                  : openHaulName
                    ? "This haul is empty."
                    : "Nothing on the shelf yet."}
            </div>
            <div className="cz-copy-pretty cz-empty-panel-copy">
              {q
                // CO-06: audit copy fix — "projects" removed from search help.
                ? "Search includes titles, notes, raw links, and paired Photos or Buy URLs."
                : shelfFilter !== "all"
                  ? "Everything you saved is still on the shelf."
                  : openHaulName
                    ? "Add cards from the shelf with ⋯ → Add to haul."
                    : inboxItems.length > 0
                      // Cards are enriching in the Inbox — never tell the
                      // customer to paste again as if the stash did not work.
                      ? inboxItems.length +
                        (inboxItems.length === 1 ? " card is" : " cards are") +
                        " indexing in the Inbox. Cards land here when they are ready."
                      : "Paste anything above: a link, a Reddit post, a list."}
            </div>
            {(q || shelfFilter !== "all" || openHaulName || inboxItems.length > 0) && (
              <Pill
                primary
                onClick={() => {
                  if (q) setSearch("");
                  else if (shelfFilter !== "all") setShelfFilter("all");
                  else if (openHaulName) closeHaul();
                  else setView("inbox");
                }}
              >
                {q
                  ? "Clear search"
                  : shelfFilter !== "all"
                    ? "Show all cards"
                    : openHaulName
                      ? "All hauls"
                      : "Open Inbox"}
              </Pill>
            )}
          </div>
        )
      ) : viewMode === "carousel" && !openHaulName ? (
        // Kyle 2026-08-02: an open haul never shows the carousel. The board is
        // the whole surface there. The view switcher is already hidden inside a
        // haul, but viewMode carries over from the Shelf tab, so the carousel
        // appeared under the board without anyone asking for it. The Shelf tab
        // keeps its carousel; only the open-haul surface drops it.
        <div className="cz-haul-open-stage">{carouselElement}</div>
      ) : (
        <PhotoShelfList
          items={listItems}
          selectedId={selectedId}
          phone={isPhone}
          onOpenDetail={(item, nodes) => {
            retireFirstCardHint();
            openWithMorph(item.id, nodes);
          }}
          onToggleFavorite={toggleFavorite}
          bodyProfile={bodyProfile}
          fitPrefs={fitPrefs}
        />
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

    </motion.section>
  );

  // Design 7a (2026-07-31): on the phone with cards, the header is a title
  // masthead (Shelf + caption) with Search + Profile. Shelf / Hauls / Stash
  // live in the frosted bottom dock. Desktop keeps the brand masthead and
  // top tabs. The empty-shelf phone still shows the brand masthead above
  // the hero.
  const phoneShelfChrome = isPhone && items.length > 0;
  const mastTitle =
    view === "hauls" ? "Hauls" : view === "inbox" ? "Inbox" : "Shelf";
  const mastCaption = (() => {
    if (view === "hauls") {
      const n = haulDirectory.hauls.length;
      return n + (n === 1 ? " haul" : " hauls");
    }
    if (view === "inbox") {
      const n = inboxItems.length;
      return n + (n === 1 ? " item" : " items");
    }
    // Shelf: "4 saved · 5 free cards left". Pro has no meter, so just the count.
    const saved =
      shelfAll.length + (shelfAll.length === 1 ? " saved" : " saved");
    if (limits && limits.kind === "anon") return saved + " · " + limits.label;
    if (limits) return saved + " · " + limits.label;
    return saved;
  })();
  const rememberSearch = useCallback((raw) => {
    const t = String(raw || "").trim();
    if (t.length < 2) return;
    setSearchRecent((list) => [t, ...list.filter((x) => x !== t)].slice(0, 8));
  }, []);
  const chromeActions = (
    <div className="cz-masthead-actions">
      {/* The counter pill (Kyle 2026-07-30, rule 1). On phone 7a the free-
          card count rides the masthead caption, so the pill stays off the
          phone shelf chrome. Desktop and the empty-shelf phone still show
          it. A Pro member has no meter. */}
      {limits && !phoneShelfChrome && (
        <button
          type="button"
          className={"cz-limit-pill is-" + limits.tone}
          onClick={openLimits}
          title="What you have left"
        >
          {limits.label}
        </button>
      )}
      {/* Design 7b: the phone magnifier opens the search sheet, not an
          inline field. Desktop keeps its permanent search in the top bar.
          STEPS-HANDOFF item 6: an open haul keeps the bar quiet — no search
          entry until the person is back on the shelf or the directory. */}
      {phoneShelfChrome && !openHaulName && (
        <button
          type="button"
          className={"cz-mast-btn" + (searchOpen ? " is-active" : "")}
          aria-label="Search your shelf"
          aria-expanded={searchOpen}
          title="Search"
          onClick={() => setSearchOpen(true)}
        >
          <Search size={17} strokeWidth={2} aria-hidden="true" />
        </button>
      )}
      {/* CH-03: the ⋯ Settings button is gone. The avatar is the one
          top-right entry — initials when signed in, the word "Sign in" when
          out. It drops the quick menu (design 1c); the settings page
          sits behind the menu's "All settings" row.
          Kyle 2026-08-02: the person glyph said nothing. Signed out, the
          entry now reads "Sign in" in the display italic. The spoken name
          follows the visible word: a screen reader that says "Profile" over
          a button that reads "Sign in" is an accessibility fault.
          Kyle 2026-08-04: wrap avatar + menu so the menu can measure the
          toggle and sit fully on screen (phone was clipping the left). */}
      <div className="cz-avatar-anchor">
        <button
          type="button"
          className={"cz-avatar" + (avatarInitials ? "" : " cz-avatar--word")}
          data-cz-avatar-toggle=""
          aria-label={avatarInitials ? "Profile" : "Sign in"}
          title={avatarInitials ? "Profile" : "Sign in"}
          aria-expanded={avatarMenuOpen}
          onClick={() => setAvatarMenuOpen((v) => !v)}
        >
          {avatarInitials ? (
            <span className="cz-avatar-initials" aria-hidden="true">{avatarInitials}</span>
          ) : (
            <span className="cz-avatar-word" aria-hidden="true">Sign in</span>
          )}
        </button>
        {avatarMenuOpen && (
          <Suspense fallback={null}>
            <AvatarMenu
              accountSession={accountSession}
              accountPlan={accountPlan}
              limits={limits}
              avatarInitials={avatarInitials}
              agentLabel={agentBarLabel}
              onOpenAgent={() => {
                agentReturnToMenuRef.current = true;
                setAgentSheetOpen(true);
              }}
              pricePrimary={pricePrimary}
              onOpenCurrency={() => {
                currencyReturnToMenuRef.current = true;
                setCurrencySheetOpen(true);
              }}
              onOpenSettings={(section) => navigateSettings(section)}
              onSignIn={() => openSignIn({ kind: "shelf", returnTo: "/" })}
              onOpenUpgrade={() => openUpgrade()}
              onSignOut={accountSignOut}
              onClose={() => setAvatarMenuOpen(false)}
            />
          </Suspense>
        )}
      </div>
    </div>
  );

  return (
    <div
      className="cz-app"
      data-theme={mode}
      data-fashion="true"
      style={{
        ...PALETTES.rainbow,
        // Blackout only (Kyle 2026-08-01). "rainbow" is the prefs key.
        colorScheme: "dark",
        minHeight: "100dvh",
        background: BG,
        color: INK,
        fontFamily: FONT,
        // Padding used to live here as an inline shorthand, which no media query
        // could reach. Padding moved to credenza-fashion.css so the phone and
        // the desktop can differ — the phone shell reserves 160px under the
        // floating shelf controls (spec 5.5).
        transition: "background 250ms var(--ease-out)",
      }}
    >
      <style>{KEYFRAMES}</style>
      <RainbowBackground />
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
          onImport={runImport}
          onClose={() => setImportOpen(false)}
          onExport={exportShelf}
          onExportCsv={exportShelfCsv}
          isPro={isProPlan}
          onClearShelf={clearShelf}
          onRestore={restoreBackup}
        />
        </Suspense>
      )}
      {currencySheetOpen && (
        <Suspense fallback={null}>
        <CurrencySheet
          pricePrimary={pricePrimary}
          onSelectCurrency={(code) => {
            setPricePrimary(normalizePricePrimary(code));
            setCurrencySheetOpen(false);
            if (currencyReturnToMenuRef.current) {
              currencyReturnToMenuRef.current = false;
              setAvatarMenuOpen(true);
            }
          }}
          onClose={() => {
            setCurrencySheetOpen(false);
            if (currencyReturnToMenuRef.current) {
              currencyReturnToMenuRef.current = false;
              setAvatarMenuOpen(true);
            }
          }}
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
          onClose={() => {
            setAgentSheetOpen(false);
            if (agentReturnToMenuRef.current) {
              agentReturnToMenuRef.current = false;
              setAvatarMenuOpen(true);
            }
          }}
        />
        </Suspense>
      )}

      {/* The Stash sheet, on every screen (Kyle 2026-07-27: "when you hit the
          stash button, it should pull up the stash to shelf, how it is in the
          mobile"). It was phone-only, and desktop read the clipboard silently
          instead — one button with two different behaviors. ModalShell already
          renders a centered dialog on desktop and a bottom sheet on a phone,
          so one surface covers both. The KM-01 keystroke sink is handled
          inside the sheet: its textarea calls stopPropagation on keydown. */}
      {captureSheetOpen && (
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

      {/* Design 7b: search is a bottom sheet from the phone magnifier. The
          query filters the shelf live behind the scrim. Desktop keeps its
          permanent field in the top bar. */}
      {searchOpen && isPhone && (
        <Suspense fallback={null}>
          <SearchSheet
            query={search}
            onQuery={setSearch}
            matchCount={shelfItems.length}
            likesOnly={likesOnly}
            onLikesOnly={setLikesOnly}
            recent={searchRecent}
            onPickRecent={(chip) => {
              setSearch(chip);
              rememberSearch(chip);
            }}
            onClose={() => {
              rememberSearch(search);
              setSearchOpen(false);
            }}
          />
        </Suspense>
      )}

      {/* The one limits sheet. Every wall in the app opens THIS, so a person
          reads the same three answers wherever they met the limit. When they
          are signed out it draws the cap modal instead, which offers two
          different doors: free and instant, or Pro on its own route. */}
      {limitsOpen && (
        <Suspense fallback={null}>
          <LimitsSheet
            status={limits}
            signedIn={signedInAccount}
            onSignIn={() => {
              setLimitsOpen(false);
              // The held link is what they were reaching for. Signing in
              // finishes that card, so the intent carries it across the
              // round trip through the mail app.
              openSignIn({
                kind: heldLinkRef.current ? "card" : "shelf",
                returnTo: "/",
                payload: heldLinkRef.current ? { url: heldLinkRef.current } : null,
              });
            }}
            onUpgrade={() => {
              setLimitsOpen(false);
              // Pro is a different question, so it gets a different address.
              openUpgrade();
            }}
            onClose={() => {
              // A2: closing the sheet while an enrichment run is still walking
              // its queue mutes the wall for the rest of that run — "Not now"
              // is an answer, not a snooze button.
              if (enrichRunDepthRef.current > 0) limitsRunMutedRef.current = true;
              setLimitsOpen(false);
            }}
          />
        </Suspense>
      )}

      {/* Sign-in is a modal on top of wherever the person already was. It
          never replaces the shelf, because coming back to a blank page after
          signing in reads as losing your work. */}
      {signInIntent && (
        <Suspense fallback={null}>
          <SignInModal intent={signInIntent} onClose={() => setSignInIntent(null)} />
        </Suspense>
      )}

      {upgradeView && (
        <Suspense fallback={null}>
          <UpgradePage
            signedIn={signedInAccount}
            isPro={isProPlan}
            period={upgradeView.period}
            onStart={(period) => {
              // Signed out, the button cannot charge anyone. It opens the
              // sign-in window and records the period, so the trip through
              // the mail app comes back here with the same plan chosen.
              if (!signedInAccount) {
                openSignIn({
                  kind: "upgrade",
                  returnTo: "/upgrade",
                  payload: { period },
                });
                return;
              }
              // Stripe owns the card number. Credenza never sees one.
              return accountUpgrade(period);
            }}
            onClose={closeUpgrade}
          />
        </Suspense>
      )}

      {/* The hand-off review screen. It reads the same parcel numbers as the
          board, so nothing here is stored twice (haul handoff, screen 9). */}
      {handoffOpen && openHaulName && (
        <Suspense fallback={null}>
          <HaulHandoff
            items={haulFlowItems}
            maths={haulFlowMaths}
            line={(haulShip && haulShip.line) || "EMS"}
            declared={(haulShip && haulShip.declared) || 0}
            domesticUsd={
              haulShip && haulShip.domesticUsd != null ? haulShip.domesticUsd : DEFAULT_DOMESTIC_USD
            }
            tileFor={haulTileFor}
            onClose={() => setHandoffOpen(false)}
            onCopy={(text) =>
              copyForHaul(text, "Parcel instruction copied. Paste it into your agent's form.")
            }
            onAddToParcel={(id) => {
              updateItem(id, { haulStage: "parcel", haulStageAt: Date.now() });
              notify("Added to parcel A.");
            }}
            onSetDeclared={(value) => patchHaulShip({ declared: value }, "declared " + value)}
            onSubmit={() => {
              // Marked here only. Credenza never presses send on the agent's
              // site, and the line under the button says so.
              const now = new Date().toISOString();
              patchHaulShip(
                (base) => ({
                  submitted: true,
                  milestone: 0,
                  milestoneAt: [now, base.milestoneAt[1], base.milestoneAt[2], base.milestoneAt[3]],
                }),
                "submitted"
              );
              setHandoffOpen(false);
              // The hand-off's overlay entry is spent: drop it from the peel
              // stack so Back from the parcel lands on the haul, not on a
              // sheet that already submitted.
              const submittedStack = haulOverlayStackRef.current;
              if (submittedStack[submittedStack.length - 1]?.kind === "handoff") {
                submittedStack.pop();
                haulOverlaySeqRef.current = submittedStack.length;
              }
              // The parcel is now in flight. That is the tracking screen's
              // question, so the person lands there (README, hand-off table).
              // Tracking is the parcel's own address (STEPS-HANDOFF item 1):
              // the route outlives the haul and a notification can link to it.
              pushHaulRoute(parcelRouteFor(openHaulName), { czParcel: true });
              setTrackingOpen(true);
              notify("Parcel A marked submitted.", {
                sub: "You still have to press send on your agent's site.",
              });
            }}
          />
        </Suspense>
      )}

      {/* The tracking screen. Nothing here polls a carrier: every step is the
          person marking what already happened (haul handoff, screens 10, 11). */}
      {trackingOpen && openHaulName && (
        <Suspense fallback={null}>
          <HaulTracking
            items={haulFlowItems}
            maths={haulFlowMaths}
            line={(haulShip && haulShip.line) || "EMS"}
            domesticUsd={
              haulShip && haulShip.domesticUsd != null ? haulShip.domesticUsd : DEFAULT_DOMESTIC_USD
            }
            milestone={(haulShip && haulShip.milestone) || 0}
            stamps={(haulShip && haulShip.milestoneAt) || []}
            fits={haulFits}
            tracking={(haulShip && haulShip.tracking) || ""}
            tileFor={haulTileFor}
            onClose={closeTracking}
            onPickStep={(index) => {
              const now = new Date().toISOString();
              patchHaulShip(
                (base) => ({
                  milestone: index,
                  // Only the step just marked takes today's date. A step taken
                  // back keeps the date it already carried, because it did
                  // happen on that day.
                  milestoneAt: base.milestoneAt.map((value, i) =>
                    i === index && !value ? now : value
                  ),
                }),
                "milestone " + index
              );
            }}
            onSetTracking={(value) => patchHaulShip({ tracking: value }, "tracking")}
            onSetFit={(id, answer) => {
              // The same answer again clears it. A wrong tap has to be
              // undoable with the control that made it.
              const card = shelfAll.find((entry) => entry && entry.id === id);
              const next = card && card.haulFit === answer ? null : answer;
              updateItem(id, { haulFit: next });
            }}
          />
        </Suspense>
      )}

      {/* One item, opened from the stage board. It sits under QC review, so
          opening QC from the drawer leaves the drawer behind it and closing
          QC lands the person back on the item (haul handoff, screen 8). */}
      {haulDrawerItem && (
        <Suspense fallback={null}>
          <HaulItemDrawer
            item={haulDrawerItem}
            face={haulTileFor(haulDrawerItem)}
            onClose={() => closeHaulOverlay(() => setHaulDrawerId(null))}
            onPatch={(id, patch) => updateItem(id, patch)}
            onReviewQc={(id) => openQcReview(id)}
            onAddToParcel={(id) => {
              updateItem(id, { haulStage: "parcel", haulStageAt: Date.now() });
              notify("Added to parcel A.");
            }}
            onBackToShelf={(id) => {
              // Every fulfillment number goes with it. A stale QC verdict on a
              // freshly re-ordered item is worse than no verdict.
              updateItem(id, { ...resetToShelf(), haulStageAt: Date.now() });
              closeHaulOverlay(() => setHaulDrawerId(null));
              notify("Back on the shelf.");
            }}
          />
        </Suspense>
      )}

      {/* QC review sits on top of the open haul. Closing it puts the person
          back exactly where they were (haul handoff, screens 3 to 5). */}
      {qcContext && (
        <Suspense fallback={null}>
          <QcOverlay
            items={qcContext.items}
            itemId={qcItemId}
            cardFor={(id) => shelfAll.find((entry) => entry && entry.id === id) || null}
            allCards={shelfAll}
            onClose={closeQc}
            onVerdict={(id, verdict, reason) => {
              // A verdict is the moment the item leaves the warehouse queue.
              // Both calls are one stage move, so they write together.
              updateItem(id, {
                haulVerdict: verdict,
                haulReason: reason || null,
                haulStage: "qcd",
                haulStageAt: Date.now(),
              });
            }}
            onAddToParcel={(id) => {
              updateItem(id, { haulStage: "parcel", haulStageAt: Date.now() });
              notify("Added to parcel A.");
            }}
            onOpenItem={(id) => setQcItemId(id)}
            // STEPS-HANDOFF item 8: paste/drop in the takeover. attachQcImage
            // owns the gate (HTTPS/data-URL, plan cap, compress) and answers
            // at the cap, so the overlay just hands the files over.
            onAddPhotos={(id, files) => {
              for (const file of files || []) attachQcImage(id, file);
            }}
            // Finding 4: this was a second copy of copyForHaul, word for word.
            // One clipboard path means one blocked-clipboard answer.
            onCopy={copyForHaul}
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

      {settingsView && (
        <Suspense fallback={null}>
        <SettingsPage
          section={settingsView.section}
          onNavigate={navigateSettings}
          onClose={closeSettings}
          isPhone={isPhone}
          value={{
            accountEnabled: AUTH_ENABLED,
            accountSession,
            accountPlan,
            // The Account and plan pane reports and links (sign-in handoff,
            // screen 4). It needs the live counter and the two doors: the
            // sign-in modal and the upgrade route.
            limits,
            onSignIn: () =>
              openSignIn({ kind: "settings", returnTo: "/settings/account" }),
            onOpenUpgrade: () => openUpgrade(),
            onMagicLink: accountSendMagicLink,
            onGoogle: accountGoogle,
            onUpgrade: accountUpgrade,
            onPortal: accountOpenPortal,
            onSignOut: accountSignOut,
            onDeleteAccount: accountDelete,
            onRestorePurchase: accountRestorePurchase,
            items,
            onImport: runImport,
            onExport: exportShelf,
            onExportCsv: exportShelfCsv,
            isPro: isProPlan,
            onClearShelf: clearShelf,
            onRestore: restoreBackup,
            storageLabel: localStatus.label,
            storageColor: localStatus.color,
            onEraseData: eraseEverything,
            sharedLinks: {
              onList: listHaulShares,
              onDelete: deleteHaulShare,
              onCopy: copyLink,
            },
            // Sizes and Fit preferences sections: the same handlers the old
            // sheet sub-pages used.
            bodyProfile,
            measureUnits,
            onSaveBodyProfile: (profile) => {
              setBodyProfile(profile);
              notify("Sizes updated.");
            },
            onChangeUnits: setMeasureUnits,
            fitPrefs,
            ownedFitPrefCategories,
            onSaveFitPrefs: (draft) => {
              setFitPrefsByCat((prev) => ({ ...(prev || {}), ...(draft || {}) }));
              notify("Fit preferences updated.");
            },
            // Shelf defaults (design 1e, rows made live per Kyle 2026-07-28):
            // the same handlers the shelf chrome and the avatar menu use.
            agentLabel: agentBarLabel,
            pricePrimary,
            fitSummary,
            fitDetail,
            onOpenAgent: () => setAgentSheetOpen(true),
            onOpenCurrency: () => setCurrencySheetOpen(true),
            onToggleFitSummary: () => setFitSummary((v) => !v),
            onCycleFitDetail: () => setFitDetail((v) => (v === "detailed" ? "concise" : "detailed")),
          }}
        />
        </Suspense>
      )}

      {/* Share a haul. Every haul opens the v2 redesign sheet — Kyle
          2026-08-04 found Share in the ⋯ menu of an in-flight haul and the
          old sheet answered. One door, one page: a haul still on the way
          simply has no received date or reviews yet, and the shared page
          hides what it does not have. The app owns the network call. */}
      {shareHaulName && (
        <Suspense fallback={null}>
          <HaulShareSheet
            haulName={shareHaulName}
            items={shareHaulItems}
            previewDoc={buildHaulShareDoc({ includes: undefined, layout: "both" })}
            signedIn={AUTH_ENABLED && !!accountSession}
            onBuildDoc={buildHaulShareDoc}
            onCreate={createHaulShareV2}
            onCopy={copyLink}
            onClose={() => setShareHaulName(null)}
          />
        </Suspense>
      )}

      {/* Per-item review capture for a fully received haul (handoff 2b · ii). */}
      {reviewHaulName && (
        <Suspense fallback={null}>
          <HaulReviewSheet
            items={shareItemsFor(reviewHaulName)}
            bodyProfile={bodyProfile}
            fitPrefs={fitPrefs}
            onSaveItem={(id, patch) => updateItem(id, patch)}
            onCompressPhoto={compressImageBlob}
            onClose={() => setReviewHaulName(null)}
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
          onSaveBodyProfile={(profile) => {
            setBodyProfile((prev) => ({ ...(prev || {}), ...profile }));
            setFitPromptSkipped(false);
            notify("Sizes updated.");
          }}
          fitPromptSkipped={fitPromptSkipped}
          onSkipFitPrompt={skipFitPrompt}
          onSaveFitPref={saveFitPref}
          onCycleFitDetail={() => setFitDetail((v) => (v === "detailed" ? "concise" : "detailed"))}
          fitDetail={fitDetail}
          onToggleFitSummary={() => setFitSummary((v) => !v)}
          fitSummary={fitSummary}
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
          onShareCard={shareCard}
          onOpenSizes={openSizesDestination}
          onClose={() => setDetailSheetId(null)}
          morphing={morphOpenId === detailItem.id}
        />
      )}

      {/* Grid/list card popup only — carousel stays in-rack (Kyle 2026-07-23).
          Close (✕ / scrim at rest / Escape) plays is-closing, then unmounts.
          At ≥1024px the popup IS the two-column Fix B panel — no solo flip card. */}
      {carouselOverlay && overlayItem && viewMode !== "carousel" && (
        isWideDetail ? (
          // Panel owns t-modal open/close; hard-unmount when its timer ends.
          renderDetailPanel(overlayItem, hardUnmountCarouselOverlay, false)
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
        ? renderDetailPanel(
            expandedItem,
            () => {
              setExpandedId(null);
              desktopPanelCloseRef.current = null;
            },
            false
          )
        : null}

      {/* STEPS-HANDOFF item 3: an open haul is the one sanctioned exception
          to the 1080px shell — cz-haul-wide lifts the cap to 1400px so the
          steps and the rail are not ~40% void on a wide monitor. The
          .cz-shell rule itself is untouched; the modifier only applies
          while a haul is open. */}
      <div className={"cz-shell" + (openHaulName ? " cz-haul-wide" : "")}>
        {/* Chrome column: centered + max-width'd on desktop (Kyle 2026-07-22 —
            full-bleed capture/search/tabs on a wide monitor read as sprawl).
            The carousel/grid panels below stay full-width. */}
        <div className="cz-chrome">
        {/* Design 7a phone masthead: title + caption on the left, search and
            avatar on the right. Desktop keeps the brand masthead. The empty
            phone shelf still shows the brand above the hero. */}
        {phoneShelfChrome ? (
        <header className="cz-masthead cz-masthead-7a">
          <div className="cz-mast-title-col">
            <h1 className="cz-mast-title">{mastTitle}</h1>
            <p className="cz-mast-caption">
              {view === "shelf" && limits ? (
                <button
                  type="button"
                  className="cz-mast-caption-btn"
                  onClick={openLimits}
                >
                  {mastCaption}
                </button>
              ) : (
                mastCaption
              )}
            </p>
          </div>
          {chromeActions}
        </header>
        ) : (
        <header className="cz-masthead">
          <h1 className="cz-brand">
            {/* Kyle 2026-08-03: the lockup is the home button — and home is
                the shelf, not the marketing page. It used to link to
                /landing/; Kyle: "it should take you to your shelf." */}
            <a className="cz-brand-link" href="/" aria-label="Your shelf">
              <BrandMark size={isPhone && items.length > 0 ? 30 : 34} />
              <span className="cz-brand-name">
                <span className="cz-brand-word">CREDENZA</span>
                <span className="cz-brand-sub">Fashion</span>
              </span>
            </a>
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
              {/* Kyle 2026-07-29: our own pages stay in this tab. Only links
                  that leave Credenza still open a new one. */}
              {SITE_NAV.map(({ href, label }) => (
                <a key={href} className="cz-mast-nav-link" href={href}>
                  {label}
                </a>
              ))}
            </nav>
          )}
          {!firstRunIntro && chromeActions}
        </header>
        )}

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
              {/* A0 · Arrival tip card removed (Kyle 2026-08-04). */}
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
                {/* Was "Put it on my shelf", which loaded 18 demo cards
                    (Kyle 2026-07-27: "this is a very old credenza app, this
                    content needs to be deleted"). The sample shelf is gone.
                    The action now points at the one field that starts a REAL
                    shelf, which is what the specimen above is illustrating. */}
                <button
                  type="button"
                  className="cz-empty-hero-link is-primary"
                  disabled={interactionLocked}
                  onClick={() => heroFieldRef.current?.focus()}
                >
                  Paste your first link
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
                <a className="cz-empty-hero-link is-quiet" href="/how/stash-from-your-phone/">
                  Stash from your phone
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Desktop top bar (≥768px), CH-04: one permanent search field that
            only filters + one solid ＋ Stash button that always opens the
            shared review sheet. */}
        {items.length > 0 && (
          <div className="cz-desk-capture">
            {/* STEPS-HANDOFF item 6: an open haul shows no search field.
                The ＋ Stash button stays — stashing mid-haul is normal. */}
            {!openHaulName && (
            <label className={"cz-desk-search-shell" + (indexFieldJob ? " is-indexing" : "")}>
              {indexFieldJob ? (
                // Indexing handoff 1b: the paste bar carries the job. The
                // field keeps its own resting size (a taller field would
                // move everything below it, which the design forbids); only
                // the contents change. The wash and the bar pin to the shell
                // itself so they bleed to the field's own edges, and they
                // read the same progress the strip row reads, so the two
                // never disagree.
                <>
                <span
                  className="cz-desk-index-wash"
                  style={{ width: Math.round(indexFieldJob.progress * 100) + "%" }}
                  aria-hidden="true"
                />
                <div className="cz-desk-index" role="status" aria-live="polite">
                  {(() => {
                    const tile = platformTile(indexFieldJob.platform);
                    return (
                      <span
                        className="cz-desk-index-tile"
                        style={{ background: tile.color }}
                        aria-hidden="true"
                      >
                        {tile.letter}
                      </span>
                    );
                  })()}
                  <span className="cz-desk-index-url">{indexFieldJob.url}</span>
                  <span
                    className={
                      "cz-desk-index-stage" +
                      (indexFieldJob.state === "indexed" ? " is-done" : "")
                    }
                  >
                    {rowStageLabel(indexFieldJob, {
                      offline: !online,
                      slowTail: indexFieldJob.slowTail,
                    })}
                  </span>
                </div>
                <span
                  className="cz-desk-index-bar"
                  style={{ width: Math.round(indexFieldJob.progress * 100) + "%" }}
                  aria-hidden="true"
                />
                </>
              ) : (
              <>
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
                // CH-04: this field only ever searches. Paste lands as text
                // and filters; the ＋ Stash button owns capture. (Stash is an
                // event, search is ambient — they never share one control.)
                placeholder="Search your shelf"
              />
              </>
              )}
            </label>
            )}
            <button
              type="button"
              className={"cz-desk-stash-btn" + (indexFieldJob ? " is-inert" : "")}
              disabled={interactionLocked || !!indexFieldJob}
              onClick={() => setCaptureSheetOpen(true)}
              aria-label="Stash a link or note"
              title="Stash a link or note"
            >
              <span className="cz-desk-stash-plus" aria-hidden="true">
                ＋
              </span>
              Stash
            </button>
          </div>
        )}

        {/* Clipboard fast-path (6a): a slim dark strip under the bar, only
            when a valid link is detected. One tap stashes the current links. */}
        {items.length > 0 && clipPreview && (
          <div className="cz-desk-clip-wrap">
            <button
              type="button"
              className="cz-desk-clip-banner"
              disabled={interactionLocked}
              onClick={stashClipboard}
              aria-label={
                clipPreview.platform + " link on your clipboard: " +
                clipPreview.host +
                ". Stash it."
              }
              title="Stash it in one tap"
            >
              <span className="cz-clip-dot" style={{ background: clipPreview.dot }} aria-hidden="true" />
              <span className="cz-desk-clip-text">
                <span className="cz-desk-clip-title">
                  {clipPreview.platform + " link on your clipboard"}
                </span>
                <span className="cz-desk-clip-host">{clipPreview.host}</span>
              </span>
            </button>
          </div>
        )}

        {/* Design 7b: phone search is a sheet from the magnifier — this row
            no longer opens on a phone. Kept as a legacy surface for any
            non-phone path that still wants an inline field under the chrome.
            Desktop uses .cz-desk-capture above; CSS hides this row ≥768px. */}
        {!firstRunIntro && items.length > 0 && !isPhone && !openHaulName && (
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
            className="cz-empty-panel"
            style={{
              marginTop: 8,
              padding: "12px 14px",
              textAlign: "left",
              borderColor: askState.status === "error" ? BLUE : undefined,
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

        {/* Shelf / Hauls / Inbox tabs. Desktop: top tab row as before.
            Design 7a phone: tabs move to the frosted bottom dock — this row
            stays for desktop only. The filter strip still rides the phone
            under the title masthead as a glyph segmented control.
            STEPS-HANDOFF item 6: an open haul hides the row — the "‹ All
            hauls" link on the page is the way out, and the phone dock keeps
            its own Shelf/Hauls buttons. */}
        {items.length > 0 && (
        <div className={"cz-shelf-band" + (phoneShelfChrome ? " is-phone-7a" : "")}>
        {/* Handoff 3a: the strip is a full-width band BETWEEN the paste bar
            and the tabs, not a peer inside the tabs row. Mounted here it can
            never overlap Shelf/Hauls or the filters. */}
        {!phoneShelfChrome && !openHaulName && indexVisibleRows.length > 0 && (
          <IndexingStrip
            header={indexHeader}
            rows={indexVisibleRows}
            lead={indexLead}
            exiting={indexExiting}
            offline={!online}
            onRetry={retryIndexJob}
            onDismiss={dismissIndexJob}
            onCancel={cancelIndexJob}
          />
        )}
        {!phoneShelfChrome && !openHaulName && (
        <div className="cz-view-tabs-row">
          <div
            role="tablist"
            aria-label="Shelf views"
            className="cz-view-tabs t-tabs"
          >
            <SlidingTabsPill value={view} />
            {[
              ["shelf", "Shelf", null],
              ["hauls", "Hauls", haulDirectory.hauls.length],
              ...(inboxItems.length > 0
                ? [["inbox", "Inbox", inboxItems.length]]
                : []),
            ].map(([key, label, count]) => (
              <button
                type="button"
                role="tab"
                className="cz-tab t-tab"
                data-t-tab-value={key}
                key={key}
                id={"view-tab-" + key}
                aria-selected={view === key}
                aria-controls={"view-panel-" + key}
                onClick={() => {
                  // Leaving any surface always returns cards face-up.
                  setExpandedId(null);
                  if (key === "hauls") {
                    if (view !== "hauls") {
                      setView("hauls");
                      // Return to the directory when re-entering Hauls from another tab.
                      setActiveHaul(null);
                      pushHaulRoute("/hauls", { czView: "hauls", czHaul: "index" });
                    }
                  } else {
                    if (view === "hauls") {
                      // Leaving Hauls entirely — drop open haul so Shelf is clean.
                      setActiveHaul(null);
                      setHandoffOpen(false);
                      setTrackingOpen(false);
                      setHaulDrawerId(null);
                      haulOverlaySeqRef.current = 0;
                      haulOverlayStackRef.current = [];
                    }
                    if (key !== view) {
                      setView(key);
                      pushHaulRoute("/", { czView: key });
                    }
                  }
                }}
              >
                {label}
                {count !== null && (
                  <span className="cz-tab-count">{" · "}{count}</span>
                )}
              </button>
            ))}
          </div>
          {/* Kyle 2026-08-01: filters on the RIGHT of Shelf/Hauls, same size. */}
          {toolbarActive && !openHaulName && view === "shelf" && (
            <div
              className="cz-filter-strip is-glyph is-tabs-peer t-tabs"
              role="radiogroup"
              aria-label="Filter the shelf"
            >
              <SlidingTabsPill value={shelfFilter} />
              {SHELF_FILTERS.map((f) => {
                const active = shelfFilter === f.key;
                const Icon = f.Icon;
                const count = shelfFilterCounts[f.key];
                return (
                  <button
                    type="button"
                    role="radio"
                    key={f.key}
                    aria-checked={active}
                    aria-label={
                      f.label +
                      ", " +
                      count +
                      (count === 1 ? " card" : " cards")
                    }
                    className={
                      "cz-filter-chip t-tab" +
                      (active ? " is-active" : "") +
                      (count === 0 ? " is-zero" : "")
                    }
                    data-t-tab-value={f.key}
                    onClick={() => {
                      setShelfFilter(f.key);
                      setExpandedId(null);
                    }}
                  >
                    {Icon && (
                      <Icon
                        className="cz-filter-chip-icon"
                        size={15}
                        strokeWidth={2.2}
                        fill={
                          f.key === "starred" && active ? "currentColor" : "none"
                        }
                        aria-hidden="true"
                      />
                    )}
                    <span className="cz-filter-chip-label">
                      {f.label}
                      <span className="cz-filter-chip-count">
                        {" · "}
                        {count}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        )}

        {/* Row 2: saved count + total + view icons, under Shelf/Hauls.
            Kyle 2026-08-01 — not on the tabs row. */}
        {!phoneShelfChrome && shelfTotalsVisible && (
          <div className="cz-total-row">
            <div className="cz-total-main">
              <span className="cz-total-count cz-fade-text-in" key={totalCountLabel}>
                {totalCountLabel}
              </span>
              {!(q && visible.length === 0) && (
                <>
                  <span className="cz-total-sep" aria-hidden="true">|</span>
                  <span className="cz-total-chip" aria-live="polite">
                    <span
                      className="cz-total-chip-label cz-fade-text-in"
                      key={openHaulName ? "haul" : shelfFilter}
                    >
                      {openHaulName
                        ? "Haul"
                        : shelfFilter === "all"
                          ? "Total"
                          : SHELF_FILTERS.find((f) => f.key === shelfFilter).label}
                    </span>
                    <ReelCounter
                      value={listTotalPrimary}
                      currency={pricePrimary}
                    />
                  </span>
                </>
              )}
            </div>
            {toolbarActive && !openHaulName && (
              <div className="cz-toolbar-end cz-view-switch">
                <button
                  type="button"
                  className={"cz-view-button" + (viewMode === "carousel" ? " is-active" : "")}
                  onClick={() => setViewMode("carousel")}
                  aria-label="Carousel view"
                  aria-pressed={viewMode === "carousel"}
                  title="Carousel view"
                >
                  Carousel
                </button>
                <button
                  type="button"
                  className={"cz-view-button" + (viewMode === "cards" ? " is-active" : "")}
                  onClick={() => setViewMode("cards")}
                  aria-label="Grid view"
                  aria-pressed={viewMode === "cards"}
                  title="Grid view"
                >
                  Grid
                </button>
              </div>
            )}
          </div>
        )}

        {/* Phone indexing strip — the desk tabs row no longer mounts on
            phone 7a, so the strip rides the band alone when a card indexes. */}
        {phoneShelfChrome && indexVisibleRows.length > 0 && (
          <IndexingStrip
            header={indexHeader}
            rows={indexVisibleRows}
            lead={indexLead}
            phone
            exiting={indexExiting}
            offline={!online}
            onRetry={retryIndexJob}
            onDismiss={dismissIndexJob}
            onCancel={cancelIndexJob}
          />
        )}

        {/* Phone filter strip stays under the masthead (Design 7a). Desktop
            filters ride the tabs row above (is-tabs-peer). */}
        {phoneShelfChrome && toolbarActive && !openHaulName && view === "shelf" && (
          <div className="cz-filter-strip is-glyph t-tabs" role="radiogroup" aria-label="Filter the shelf">
            <SlidingTabsPill value={shelfFilter} />
            {SHELF_FILTERS.map((f) => {
              const active = shelfFilter === f.key;
              const Icon = f.Icon;
              const count = shelfFilterCounts[f.key];
              return (
                <button
                  type="button"
                  role="radio"
                  key={f.key}
                  aria-checked={active}
                  aria-label={
                    f.label +
                    ", " +
                    count +
                    (count === 1 ? " card" : " cards")
                  }
                  className={
                    "cz-filter-chip t-tab" +
                    (active ? " is-active" : "") +
                    (count === 0 ? " is-zero" : "")
                  }
                  data-t-tab-value={f.key}
                  onClick={() => {
                    setShelfFilter(f.key);
                    setExpandedId(null);
                  }}
                >
                  {Icon && (
                    <Icon
                      className="cz-filter-chip-icon"
                      size={15}
                      strokeWidth={2.2}
                      fill={
                        f.key === "starred" && active ? "currentColor" : "none"
                      }
                      aria-hidden="true"
                    />
                  )}
                  <span className="cz-filter-chip-label">
                    {f.label}
                    <span className="cz-filter-chip-count">
                      {" · "}
                      {count}
                    </span>
                  </span>
                </button>
              );
            })}
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
              <div className="cz-haul-open-title-block">
                <h2 className="cz-haul-open-title">{openHaulName}</h2>
                {haulIsFullyReceived ? (
                  <div className="cz-kicker cz-haul-open-kicker">
                    RECEIVED · {totalsItems.length}{" "}
                    {totalsItems.length === 1 ? "ITEM" : "ITEMS"}
                  </div>
                ) : null}
              </div>
              {/* Fully received: primary review, Share pill, ⋯ keeps budget +
                  archive (share is no longer a menu item). Other hauls keep the
                  existing menu-only Share path (LB-8). */}
              {haulIsFullyReceived ? (
                <div className="cz-haul-open-actions">
                  <Pill primary onClick={() => setReviewHaulName(openHaulName)}>
                    Write the review
                  </Pill>
                  <Pill
                    onClick={() => setShareHaulName(openHaulName)}
                    disabled={totalsItems.length === 0}
                  >
                    Share
                  </Pill>
                  <HaulTitleMenu
                    record={hauls.find((h) => h.name === openHaulName) || null}
                    canShare={false}
                    onShare={() => setShareHaulName(openHaulName)}
                    onUpdate={(patch, historyEntry) =>
                      updateHaul(openHaulName, patch, historyEntry)
                    }
                    onArchive={() => {
                      const rec = hauls.find((h) => h.name === openHaulName);
                      const next = !(rec && rec.archived);
                      const name = openHaulName;
                      updateHaul(name, { archived: next }, {
                        type: next ? "archived" : "unarchived",
                      });
                      if (next) closeHaul();
                      notify(next ? "Archived · " + name : "Back in your hauls · " + name, {
                        tone: "action",
                        actionLabel: "Undo",
                        onAction: () => {
                          updateHaul(
                            name,
                            { archived: !next },
                            { type: next ? "unarchived" : "archived" }
                          );
                        },
                        duration: 3000,
                      });
                    }}
                  />
                </div>
              ) : (
                <HaulTitleMenu
                  record={hauls.find((h) => h.name === openHaulName) || null}
                  canShare={totalsItems.length > 0}
                  onShare={() => setShareHaulName(openHaulName)}
                  onUpdate={(patch, historyEntry) =>
                    updateHaul(openHaulName, patch, historyEntry)
                  }
                  onArchive={() => {
                    const rec = hauls.find((h) => h.name === openHaulName);
                    const next = !(rec && rec.archived);
                    const name = openHaulName;
                    updateHaul(name, { archived: next }, {
                      type: next ? "archived" : "unarchived",
                    });
                    if (next) closeHaul();
                    notify(next ? "Archived · " + name : "Back in your hauls · " + name, {
                      tone: "action",
                      actionLabel: "Undo",
                      onAction: () => {
                        updateHaul(
                          name,
                          { archived: !next },
                          { type: next ? "unarchived" : "archived" }
                        );
                      },
                      duration: 3000,
                    });
                  }}
                />
              )}
            </div>
            {/* The steps page: the haul as five vertical steps beside the
                sticky parcel rail (STEPS-HANDOFF item 2). Same props the
                column board took — the stage→action dispatch in onItemAction
                is unchanged. HaulFlowBoard.jsx stays on disk as reference.
                The board hid itself on an empty haul; the steps page must
                not — its step 1 carries the empty state ("Nothing in this
                haul yet"), which is the only direction an empty haul has. */}
            <HaulSteps
                items={haulFlowItems}
                ship={haulShip}
                tileFor={haulTileFor}
                agentName={(preferredAgentInfo && preferredAgentInfo.name) || ""}
                onOpenItem={(id) => openHaulDrawer(id)}
                onItemAction={(item) => {
                  // One stage offers one move. The board decided which; the
                  // screen only knows how to carry it out.
                  if (item.stage === "toOrder") {
                    copyForHaul(item.url || "", "Link copied.");
                    return;
                  }
                  if (item.stage === "ordered") {
                    updateItem(item.id, { haulStage: "warehouse", haulStageAt: Date.now() });
                    notify("Marked as arrived at the warehouse.");
                    return;
                  }
                  if (item.stage === "warehouse") {
                    openQcReview(item.id);
                    return;
                  }
                  if (item.stage !== "qcd") return;
                  if (normalizeVerdict(item.qc) === "green") {
                    updateItem(item.id, { haulStage: "parcel", haulStageAt: Date.now() });
                    notify("Added to parcel A.");
                    return;
                  }
                  // A red light opens QC rather than copying in silence
                  // (README line 144; Kyle 2026-08-02). The person sees the
                  // photo, the reason and the message before anything reaches
                  // the clipboard. A copy with no screen in between hid the
                  // one question the person had: what is wrong with it.
                  openQcReview(item.id);
                }}
                onColumnFooter={(key) => {
                  if (key === "toOrder") {
                    const links = unorderedLinks(haulFlowItems);
                    if (!links) {
                      notify("None of those cards has a link yet.", { tone: "error" });
                      return;
                    }
                    copyForHaul(links, "Every unordered link copied.");
                    return;
                  }
                  if (key !== "warehouse") return;
                  const first = firstPendingQcItem(haulFlowItems);
                  if (first) openQcReview(first.id);
                }}
                onRemoveFromParcel={(id) => {
                  // Back to QC done, not back to the warehouse. The verdict
                  // still stands; only the packing choice changes.
                  updateItem(id, { haulStage: "qcd", haulStageAt: Date.now() });
                  notify("Taken out of parcel A.");
                }}
                onSetDivisor={(value) => patchHaulShip({ divisor: value }, "divisor " + value)}
                onSetLine={(key) => patchHaulShip({ line: key }, "line " + key)}
                onSetRate={(key, rate) => {
                  const base = migrateHaulShip(haulShip || {});
                  patchHaulShip({ rates: { ...base.rates, [key]: rate } }, "rate " + key);
                }}
                onHandOff={() => {
                  // A submitted parcel has nothing left to review, so the same
                  // button asks the only open question: where is it?
                  if (haulShip && haulShip.submitted) {
                    pushHaulRoute(parcelRouteFor(openHaulName), { czParcel: true });
                    setTrackingOpen(true);
                  } else {
                    openHandoff();
                  }
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
                className="cz-empty-panel"
                style={{
                  padding: "12px 16px",
                  textAlign: "left",
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
                    {item.status === "enriching" ? "Enhancing…" : "Couldn't enhance, still saved"}
                  </div>
                </div>
                {item.status === "failed" && aiAvailable() && (
                  <Pill onClick={() => retry(item.id)}>Retry</Pill>
                )}
              </div>
            ))}
          </div>
        ) : (
          // One swapper for every surface switch (Kyle 2026-08-04): Shelf,
          // the haul directory, and an open haul. mode="sync" keeps both
          // layers for the crossfade so the page never goes blank mid-switch.
          <div className="cz-surface-swap">
            <AnimatePresence
              mode="sync"
              initial={false}
              onExitComplete={() => setClosingHaulName(null)}
            >
              {view === "hauls" && !activeHaul ? haulDirectorySurface : shelfSurface}
            </AnimatePresence>
          </div>
        )}
        </main>
      </div>

      {/* Finding 4: a blocked clipboard used to be a dead end. The text a
          person asked for opens here instead, ready to select by hand. */}
      {copyFallbackText !== null && (
        <ModalShell
          title="Copy this by hand"
          onClose={() => setCopyFallbackText(null)}
          maxWidth={520}
        >
          <div className="cz-copyfall">
            <p className="cz-copyfall-note">
              This browser did not let Credenza reach your clipboard. Select the
              text below and copy it yourself.
            </p>
            <textarea
              className="cz-copyfall-box"
              readOnly
              rows={7}
              value={copyFallbackText}
              aria-label="The text to copy"
              onFocus={(event) => event.target.select()}
            />
            <div className="cz-copyfall-foot">
              <Pill onClick={() => setCopyFallbackText(null)}>Done</Pill>
            </div>
          </div>
        </ModalShell>
      )}

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
            {/* Kyle 2026-07-31: check for the normal tone, X for error. */}
            <span
              className="cz-toast-icon"
              data-icon={notification.tone === "error" ? "error" : "ok"}
              aria-hidden="true"
            >
              {notification.tone === "error" ? (
                <X size={15} strokeWidth={2.5} />
              ) : (
                <Check size={15} strokeWidth={2.5} />
              )}
            </span>
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

      {/* Design 7a bottom dock (F 2026-07-31): floating frosted pill —
          Shelf | Stash circle | Hauls. No money total on the shelf. Frost
          stays on the dock and sheets only; the rest of the site is flat.
          CaptureSheet opens from the + circle (5b). Hidden on the empty
          shelf — the hero already carries capture. */}
      {!firstRunIntro && phoneShelfChrome && (
        <nav className="cz-dock" aria-label="Main">
          <div className="cz-dock-pill t-tabs">
            <SlidingTabsPill value={view === "hauls" ? "hauls" : "shelf"} />
            <button
              type="button"
              className={
                "cz-dock-tab t-tab" + (view === "shelf" || view === "inbox" ? " is-active" : "")
              }
              data-t-tab-value="shelf"
              aria-current={view === "shelf" || view === "inbox" ? "page" : undefined}
              onClick={() => {
                setExpandedId(null);
                if (view === "hauls") {
                  setActiveHaul(null);
                  setHandoffOpen(false);
                  setTrackingOpen(false);
                  setHaulDrawerId(null);
                  haulOverlaySeqRef.current = 0;
                  haulOverlayStackRef.current = [];
                  setView("shelf");
                  pushHaulRoute("/", { czView: "shelf" });
                } else if (view !== "shelf") {
                  setView("shelf");
                  pushHaulRoute("/", { czView: "shelf" });
                }
              }}
            >
              <Layers size={20} strokeWidth={2.2} aria-hidden="true" />
              <span className="cz-dock-tab-label">Shelf</span>
            </button>
            <button
              type="button"
              className="cz-dock-stash"
              disabled={interactionLocked}
              onClick={() => setCaptureSheetOpen(true)}
              title="Stash a link or note"
              aria-label="Stash a link"
            >
              <Plus size={26} strokeWidth={2.2} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={"cz-dock-tab t-tab" + (view === "hauls" ? " is-active" : "")}
              data-t-tab-value="hauls"
              aria-current={view === "hauls" ? "page" : undefined}
              onClick={() => {
                setExpandedId(null);
                if (view !== "hauls") {
                  setView("hauls");
                  setActiveHaul(null);
                  pushHaulRoute("/hauls", { czView: "hauls", czHaul: "index" });
                }
              }}
            >
              {/* Box icon, not Layers — Shelf already uses the stack so the
                  two dock ends must read as different places (O 2026-08-01). */}
              <Package size={20} strokeWidth={2.2} aria-hidden="true" />
              <span className="cz-dock-tab-label">
                Hauls
                {haulDirectory.hauls.length > 0 && (
                  <span className="cz-dock-tab-count">
                    {" · "}
                    {haulDirectory.hauls.length}
                  </span>
                )}
              </span>
            </button>
          </div>
          {inboxItems.length > 0 && (
            <button
              type="button"
              className={
                "cz-dock-inbox" + (view === "inbox" ? " is-active" : "")
              }
              onClick={() => {
                setExpandedId(null);
                if (view === "hauls") {
                  setActiveHaul(null);
                  setHandoffOpen(false);
                  setTrackingOpen(false);
                  setHaulDrawerId(null);
                  haulOverlaySeqRef.current = 0;
                  haulOverlayStackRef.current = [];
                }
                if (view !== "inbox") {
                  setView("inbox");
                  pushHaulRoute("/", { czView: "inbox" });
                }
              }}
            >
              Inbox · {inboxItems.length}
            </button>
          )}
        </nav>
      )}
    </div>
  );
}
