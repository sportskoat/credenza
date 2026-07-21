import { useState, useEffect, useRef, useMemo, useId, forwardRef, useImperativeHandle, useCallback } from "react";
import { flushSync } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Moon, MoreHorizontal, Pen, Plus, Search, Star, Sun, Trash2, X } from "lucide-react";
import {
  createStorageBackend,
  loadStoredItems,
  saveStoredItems,
} from "./credenza-storage.js";
import {
  searchItems,
  selectAskCandidates,
  serializeAskCandidates,
} from "./credenza-search-fashion.js";
import {
  DEFAULT_AGENT_ID,
  buildAgentUrl,
  getAgent,
  hashItemId,
  listAgents,
  loadOutboundClicks,
  marketplaceOf,
  recordOutboundClick,
  summarizeOutbound,
} from "./agents.js";
import "./credenza.css";
import "./credenza-fashion.css";

// ═══════════════════════════════════════════════════════════════════════════════════
// ═══ CONSTANTS & THEME (Studio) ═══
// ═══════════════════════════════════════════════════════════════════════════════════

// Theme-driven palette: components reference CSS variables; the app root sets them
// per theme. Two modes:
//   light  = Horizon #003973 + Mae #E5E5BE (deep ocean + soft sand)
//   rainbow (prefs key) = Moonwalker dark — pure black #000000 + slate #152331
const PALETTES = {
  // Horizon + Mae light: deep ocean field, sand ink, warm cream surfaces.
  light: {
    "--cz-bg": "#003973",
    "--cz-bg-elevated": "#0a4a8a",
    "--cz-card": "rgba(229, 229, 190, 0.14)",
    "--cz-card-solid": "#0d4a86",
    "--cz-hair": "rgba(229, 229, 190, 0.22)",
    "--cz-hair-strong": "rgba(229, 229, 190, 0.38)",
    "--cz-ink": "#E5E5BE",
    "--cz-sub": "rgba(229, 229, 190, 0.78)",
    "--cz-faint": "rgba(229, 229, 190, 0.52)",
    "--cz-seg": "rgba(229, 229, 190, 0.12)",
    "--cz-accent": "#E5E5BE",
    "--cz-accent-bg": "rgba(229, 229, 190, 0.16)",
    "--cz-accent-deep": "#f2f2d4",
    "--cz-favorite": "#E5E5BE",
    "--cz-favorite-bg": "rgba(229, 229, 190, 0.14)",
    "--cz-action-fill": "linear-gradient(135deg, #E5E5BE 0%, #f4f4dc 100%)",
    "--cz-action-text": "#003973",
    "--cz-action-muted-bg": "rgba(229, 229, 190, 0.92)",
    "--cz-action-muted-text": "#003973",
    "--cz-focus": "#E5E5BE",
    "--cz-placeholder": "rgba(229, 229, 190, 0.52)",
    "--cz-selection": "rgba(229, 229, 190, 0.28)",
    "--cz-selection-text": "#003973",
    "--cz-error-bg": "rgba(255, 120, 120, 0.16)",
    "--cz-error-text": "#ffc4c4",
    "--cz-glow": "rgba(229, 229, 190, 0.35)",
    "--cz-glow-weak": "rgba(0, 57, 115, 0.35)",
    "--cz-gradient-1": "#003973",
    "--cz-gradient-2": "#1a6bb0",
    "--cz-gradient-3": "#E5E5BE",
  },
  // Moonwalker dark: pure black field, slate surfaces (#152331), cool steel accents.
  rainbow: {
    "--cz-bg": "#000000",
    "--cz-bg-elevated": "#0a1018",
    "--cz-card": "rgba(21, 35, 49, 0.82)",
    "--cz-card-solid": "#152331",
    "--cz-hair": "rgba(255, 255, 255, 0.10)",
    "--cz-hair-strong": "rgba(255, 255, 255, 0.18)",
    "--cz-ink": "#f2f5f8",
    "--cz-sub": "#9aabba",
    "--cz-faint": "#6a7a8a",
    "--cz-seg": "rgba(255, 255, 255, 0.07)",
    "--cz-accent": "#8eb6d4",
    "--cz-accent-bg": "rgba(142, 182, 212, 0.16)",
    "--cz-accent-deep": "#b8d4ea",
    "--cz-favorite": "#8eb6d4",
    "--cz-favorite-bg": "rgba(142, 182, 212, 0.14)",
    "--cz-action-fill": "linear-gradient(135deg, #1e3a52 0%, #8eb6d4 100%)",
    "--cz-action-text": "#000000",
    "--cz-action-muted-bg": "rgba(232, 240, 248, 0.96)",
    "--cz-action-muted-text": "#152331",
    "--cz-focus": "#8eb6d4",
    "--cz-placeholder": "#6a7a8a",
    "--cz-selection": "rgba(142, 182, 212, 0.28)",
    "--cz-selection-text": "#f2f5f8",
    "--cz-error-bg": "rgba(220, 80, 90, 0.14)",
    "--cz-error-text": "#f08a92",
    "--cz-glow": "rgba(142, 182, 212, 0.32)",
    "--cz-glow-weak": "rgba(21, 35, 49, 0.55)",
    "--cz-gradient-1": "#152331",
    "--cz-gradient-2": "#2a4a66",
    "--cz-gradient-3": "#8eb6d4",
  },
};

const BG = "var(--cz-bg)";
const CARD = "var(--cz-card)";
const HAIR = "var(--cz-hair)";
const INK = "var(--cz-ink)";
const SUB = "var(--cz-sub)";
const FAINT = "var(--cz-faint)";
const SEG = "var(--cz-seg)";
const BLUE = "var(--cz-accent)";
const BLUE_BG = "var(--cz-accent-bg)";
const BLUE_DK = "var(--cz-accent-deep)";
const ACTION_FILL = "var(--cz-action-fill)";
const ACTION_TEXT = "var(--cz-action-text)";
const ACTION_MUTED_BG = "var(--cz-action-muted-bg)";
const ACTION_MUTED_TEXT = "var(--cz-action-muted-text)";

const FONT = "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const MONO = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace";
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
const CATEGORIES = {
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

function itemUsdAmount(item) {
  if (item.priceUsd != null && isFinite(item.priceUsd)) return item.priceUsd;
  if (item.price != null && isFinite(item.price) && (!item.currency || item.currency === "USD")) {
    return item.price;
  }
  return null;
}

function priceLabel(item) {
  if (item.price == null && item.priceUsd == null) return "";
  const currency = item.currency || "CNY";
  const usd = itemUsdAmount(item);
  const cny =
    currency === "CNY" && item.price != null && isFinite(item.price) ? item.price : null;

  if (usd != null) {
    let out = formatMoney(usd, "USD");
    if (cny != null) out += " · " + formatMoney(cny, "CNY");
    return out;
  }
  if (cny != null) return formatMoney(cny, "CNY");
  if (item.price != null) return formatMoney(item.price, currency);
  return "";
}

// Compact size run from resolved variants: "S · M · L" or "S–XXL · 6 sizes".
function sizeRunLabel(item) {
  const group = (item.variants || []).find((g) => /size|尺码|尺寸/i.test(g.title));
  if (!group || !group.values.length) return "";
  if (group.values.length <= 4) return group.values.join(" · ");
  return group.values[0] + "–" + group.values[group.values.length - 1] + " · " + group.values.length + " sizes";
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

const DAY_MS = 864e5;
const WEEK_MS = 7 * DAY_MS;

// Card-back "product sheet" hierarchy (price-forward, quiet haul chip, flat
// photo strip). Flip to false to restore the previous form-style back face
// without hunting through diffs — one constant, full revert.
const CARD_BACK_PRODUCT_SHEET = true;
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
// Cloud actions are optional capabilities. A Vite value is only a feature flag,
// never authentication; public enablement still requires deployment-level access.
const CLOUD_ASK_ENABLED =
  !!(import.meta.env && import.meta.env.VITE_ENABLE_CLOUD_ASK === "true");
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

const TRACKING_PARAM_RE =
  /^(utm_\w+|fbclid|gclid|gclsrc|dclid|msclkid|mc_eid|mc_cid|igshid|igsh|si|ref|ref_src|ref_url|s|t|feature|ck_subscriber_id|_hsenc|_hsmi|vero_id|twclid|ttclid)$/i;

function normalizedHostPath(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    const path = u.pathname.replace(/\/+$/, "");
    return host + path;
  } catch (e) {
    return url.toLowerCase();
  }
}

// Every http(s) URL in the text, in order, trailing punctuation trimmed, deduped.
function extractUrls(raw) {
  const out = [];
  const seen = new Set();
  const matches = (raw || "").match(/https?:\/\/[^\s]+/g) || [];
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
function itemMatchesCanonicalKey(item, key) {
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
  return (text.split(/\n/)[0] || text).trim();
}

function localTitle(parsed, rawText) {
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
      const account = (host.match(/^([^.]+)(?:\.x)?\.yupoo\.com$/) || [])[1];
      if (album) {
        // Placeholder until enrichment fills the real album/batch title.
        return account ? account + " · " + album[1] : "Album " + album[1];
      }
      if (account) return account;
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

// Local ASK: rank cards against the question and compose a plain answer.
function localAsk(q, items) {
  const hits = selectAskCandidates(q, items, 5);
  if (hits.length === 0)
    return "Nothing on the shelf matches that yet. Stash it when you find it.";
  const lines = hits.map((x) => {
    const why = x.note
      ? 'you wrote: "' + (x.note.length > 90 ? x.note.slice(0, 87) + "…" : x.note) + '"'
      : x.summary || "no note yet";
    return "• " + x.title + " — " + why;
  });
  const lead =
    hits.length === 1
      ? "One card matches:"
      : hits.length + " cards match. Closest first:";
  return lead + "\n" + lines.join("\n");
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

function droppedImageFile(e) {
  const files = (e.dataTransfer && e.dataTransfer.files) || [];
  for (const f of files) {
    if (/^image\//.test(f.type)) return f;
  }
  return null;
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
function migrateItem(old) {
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


// ═══════════════════════════════════════════════════════════════════════════════════
// ═══ IMPORT & SAMPLE DATA ═══
// Local-only imports. No scraping, passwords, cookies, or network connections.
// ═══════════════════════════════════════════════════════════════════════════════════

const SAMPLE_COUNT = 18;

const IMPORT_PROVIDERS = [
  {
    id: "paste_list",
    label: "Paste a list",
    status: "now",
    availableInArtifact: true,
    description: "Drop in old links, notes, or a messy copied list.",
  },
  {
    id: "bookmark_file",
    label: "Bookmarks file",
    status: "now",
    availableInArtifact: true,
    description: "Export bookmarks from Chrome, then choose the file here.",
  },
  {
    id: "sample_shelf",
    label: "Sample shelf",
    status: "now",
    availableInArtifact: true,
    description: SAMPLE_COUNT + " cards to poke at. Easy to clear.",
  },
  {
    id: "raindrop",
    label: "Raindrop",
    status: "now",
    availableInArtifact: true,
    description: "Settings → Backups → export CSV, then drop the file here. Folders become tags.",
  },
  {
    id: "pocket",
    label: "Pocket",
    status: "now",
    availableInArtifact: true,
    description: "getpocket.com/export gives you an HTML file — drop it here, dates intact.",
  },
  {
    id: "browser_bookmarks",
    label: "Browser bookmarks",
    status: "now",
    availableInArtifact: true,
    description: "Bookmark manager → export to HTML. Works for Chrome, Arc, Safari, Firefox.",
  },
  {
    id: "anything_else",
    label: "Shiori and everything else",
    status: "now",
    availableInArtifact: true,
    description: "Any CSV or JSON with a url column works — dates and tags come along.",
  },
];

// ————— Export-format parsers —————
// Credenza is the review layer over whatever you already use, so real exports are
// first-class citizens: Raindrop CSV, Pocket HTML, browser bookmarks, generic
// CSV/JSON. Original saved dates and tags come along — that's what lets a freshly
// imported pile yield forgotten gems on day one.

const PROVIDER_LABELS = {
  pocket: "Pocket export",
  raindrop: "Raindrop export",
  bookmarks: "browser bookmarks",
  html: "bookmarks file",
  csv: "spreadsheet",
  json: "JSON list",
  paste: "pasted list",
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

function parseImport(text) {
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

  // 4. Messy lines: one per line, prose with links inside, plain notes.
  for (const lineRaw of text.split(/\n+/)) {
    const line = lineRaw.replace(/^[\s\-*•>”"]*(?:\d+[.)])?\s*/, "").trim();
    if (!line || line.length < 3) continue;
    const urls = line.match(/https?:\/\/[^\s<>"')\]]+/g) || [];
    if (urls.length === 0) {
      if (line.length >= 8 && /[a-z]/i.test(line)) push(classify(line), line, "");
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
    fresh.push(createItem(c.parsed, c.rawText, extra));
  }
  return { fresh, dupes, duplicates };
}

function buildSampleItems() {
  const now = Date.now();
  const mk = (raw, extra, ageDays) =>
    createItem(classify(raw), raw, {
      ...extra,
      sourceImport: "sample",
      createdAt: now - ageDays * DAY_MS,
      updatedAt: now - ageDays * DAY_MS,
    });
  return [
    mk(
      "Idea: a mixtape of songs that sample rain — start from the ambient shelf",
      {},
      1
    ),
    mk(
      "https://robwalker.substack.com/p/the-art-of-noticing",
      {
        title: "The art of noticing",
        summary: "Why paying attention is a practice, not a gift.",
        tags: ["attention", "essays"],
      },
      3
    ),
    mk(
      "https://www.youtube.com/watch?v=5qap5aO4i9A",
      {
        title: "Lofi hip hop radio — beats to relax to",
        summary: "The eternal study stream.",
        tags: ["music", "focus"],
      },
      5
    ),
    mk(
      "https://x.com/visakanv/status/1024310388571713537",
      {
        title: "Post by @visakanv",
        summary: "Do a hundred reps of anything before judging yourself at it.",
        tags: ["@visakanv", "practice"],
      },
      8
    ),
    mk(
      "https://open.spotify.com/episode/7makk4oTQel546B0PZlDM5",
      {
        title: "Song Exploder — how a track gets made",
        summary: "Artists take a song apart and tell the story of how it was built.",
        tags: ["podcast", "music"],
      },
      12
    ),
    mk(
      "https://www.cs.virginia.edu/~robins/YouAndYourResearch.html",
      {
        title: "You and your research — Richard Hamming",
        summary: "The famous talk on doing work that matters.",
        tags: ["talks", "career"],
        note: "The “important problems” question — revisit this every few months.",
        importance: "high",
        extractedIntent: "Revisit the important-problems question regularly.",
      },
      40
    ),
    mk(
      "https://www.reddit.com/r/woodworking/comments/1c9r2kx/what_i_learned_building_a_walnut_record_cabinet/",
      {
        title: "What I learned building a walnut record cabinet",
        summary: "A detailed build log, including the joinery choices that did not survive the first prototype.",
        tags: ["woodworking", "furniture", "build-log"],
        note: "Save the sliding-door detail for the living room cabinet sketch.",
      },
      0
    ),
    mk(
      "https://github.com/stephango/obsidian-minimal/issues/812",
      {
        title: "Obsidian Minimal — readable line length discussion",
        summary: "A practical thread about typography, wide monitors, and keeping long notes comfortable to scan.",
        tags: ["design-systems", "typography", "knowledge-tools"],
        importance: "high",
        extractedIntent: "Compare the proposed reading-width settings with Credenza's detail view.",
        lastOpenedAt: now - 1 * DAY_MS,
      },
      2
    ),
    mk(
      "https://news.ycombinator.com/item?id=40213591",
      {
        title: "Ask HN: What small software do you happily pay for?",
        summary: "A lively inventory of narrow, durable tools people value enough to keep funding.",
        tags: ["indie-software", "pricing", "customer-research"],
        importance: "low",
      },
      7
    ),
    mk(
      "https://www.tiktok.com/@museumofmaterial/video/7368842115724184875",
      {
        title: "How conservators repair a cracked ceramic bowl",
        summary: "A quick studio demonstration of reversible fills, color matching, and patient finishing.",
        tags: ["conservation", "ceramics", "process"],
        note: "The reversible-materials principle could make a good product metaphor.",
      },
      15
    ),
    mk(
      "https://soundcloud.com/nilsfrahm/piano-day-sketch-no-4",
      {
        title: "Piano Day sketch no. 4",
        summary: "A quiet, unfinished piano miniature worth returning to during late-night writing sessions.",
        tags: ["piano", "instrumental", "late-night"],
        extractedIntent: "Add this to the next deep-writing queue.",
      },
      34
    ),
    mk(
      "https://music.apple.com/us/album/an-immense-world/1643024851?i=1643024860",
      {
        title: "An Immense World — listening beyond human senses",
        summary: "A conversation about animal perception and the hidden sensory worlds surrounding us.",
        tags: ["science", "animals", "perception"],
        importance: "high",
        lastOpenedAt: now - 2 * DAY_MS,
      },
      6
    ),
    mk(
      "https://vimeo.com/148751763",
      {
        title: "The quiet architecture of useful places",
        summary: "A conference talk on thresholds, wayfinding, and designing public rooms that invite people to linger.",
        tags: ["architecture", "public-space", "wayfinding"],
        note: "Pull the three examples of welcoming thresholds into the studio references.",
        importance: "high",
        extractedIntent: "Rewatch before the library workshop and capture the wayfinding examples.",
        lastOpenedAt: now - 5 * DAY_MS,
      },
      45
    ),
    mk(
      "https://www.linkedin.com/posts/maya-chen_product-rituals-that-survived-hypergrowth-activity-7194382219045515264",
      {
        title: "Product rituals that survived hypergrowth",
        summary: "A product lead shares which weekly habits stayed useful as one small team became six.",
        tags: ["product-ops", "teams", "rituals"],
        importance: "low",
      },
      11
    ),
    mk(
      "https://maggieappleton.com/garden-history",
      {
        title: "A brief history of digital gardens",
        summary: "Notes on the lineage of personal knowledge spaces, from early hypertext to today's evolving web gardens.",
        tags: ["digital-gardens", "web-history", "hypertext"],
        note: "Useful framing for why a shelf should feel cultivated rather than filed.",
      },
      19
    ),
    mk(
      "Draft three interview prompts about handoffs, decision logs, and lost context for Tuesday's research call",
      {
        title: "Interview prompts for the Atlas research call",
        summary: "Focus on the moments when context disappears between a decision and the person expected to carry it forward.",
        tags: ["user-research", "interviews", "handoffs"],
        importance: "high",
        extractedIntent: "Prepare and test the three prompts before Tuesday's call.",
        project: "Atlas",
        people: ["Maya Chen"],
      },
      1
    ),
    mk(
      "https://northstarreview.org/cities/libraries-as-climate-infrastructure",
      {
        title: "When the library becomes climate infrastructure",
        summary: "A reported look at how public libraries are becoming climate shelters, tool lenders, and neighborhood infrastructure during extreme heat.",
        tags: ["libraries", "climate", "civic-life"],
      },
      32
    ),
    mk(
      "https://x.com/softcorrelation/status/1769820147739218173",
      {
        title: "A field note on prototypes",
        summary: "The best prototype is sometimes the one that makes the team's disagreement visible before it becomes expensive.",
        tags: ["prototyping", "collaboration", "decisions"],
        importance: "low",
      },
      62
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
    res = await fetch("https://api.anthropic.com/v1/messages", {
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

async function aiAsk(q, candidates) {
  if (!aiAvailable()) return null;
  try {
    const compact = candidates.map((x) => ({
      title: x.title,
      summary: x.summary,
      note: x.note,
      project: x.project,
      tags: x.tags,
    }));
    return await callClaude(
      "My saved cards: " + JSON.stringify(compact) + "\nQuestion: " + q +
        "\nAnswer briefly in plain text, weighing the note fields heavily."
    );
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
    const res = await fetch(YUPOO_ENDPOINT, {
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
.cz-masthead { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
.cz-brand { display: inline-flex; align-items: center; gap: 10px; color: var(--cz-ink); font-size: 12px; font-weight: 800; letter-spacing: .12em; }
.cz-brand-mark { width: 22px; height: 22px; display: grid; place-items: center; border-radius: 50%; background: var(--cz-ink); color: var(--cz-card); font-size: 14px; line-height: 1; letter-spacing: 0; }
.cz-hero-title { max-width: 560px; margin: 0 0 24px; color: var(--cz-ink); font-family: ${DISPLAY}; font-size: clamp(34px, 4.3vw, 58px); font-weight: 500; letter-spacing: -.04em; line-height: 1; }
.cz-section-head { display: flex; align-items: baseline; justify-content: space-between; margin: 24px 0 10px; }
.cz-section-head h2 { margin: 0; font-family: ${DISPLAY}; font-size: 25px; font-weight: 500; letter-spacing: -.035em; line-height: 1.1; }
.cz-section-head span { color: var(--cz-faint); font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; font-variant-numeric: tabular-nums; }
.cz-shelf-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; align-items: stretch; }
.cz-shelf-grid > div { min-width: 0; display: flex; }
.cz-shelf-grid > div > article, .cz-shelf-grid > div > div { width: 100%; height: 100%; }
@keyframes credenza-fade { from { opacity: 0; } to { opacity: 1; } }
`;

function usePrefersReducedMotion() {
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

// Horizon + Mae ambient — deep ocean field with soft sand-light blooms that
// gently follow cursor/touch. Stays behind content; heavy blur keeps type clean.
function HolographicBackground() {
  const [pos, setPos] = useState({ x: 50, y: 30 });
  const raf = useRef(null);
  const target = useRef({ x: 50, y: 30 });

  useEffect(() => {
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
  }, []);

  const { x, y } = pos;
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        background: `
          radial-gradient(circle at ${x}% ${y}%, rgba(229, 229, 190, 0.22) 0%, transparent 42%),
          radial-gradient(circle at ${100 - x}% ${100 - y}%, rgba(26, 107, 176, 0.45) 0%, transparent 48%),
          radial-gradient(circle at ${y}% ${x}%, rgba(229, 229, 190, 0.14) 0%, transparent 46%),
          radial-gradient(circle at 50% 110%, rgba(0, 40, 90, 0.55) 0%, transparent 55%),
          radial-gradient(circle at 18% 18%, rgba(229, 229, 190, 0.10) 0%, transparent 38%),
          #003973
        `,
        filter: "blur(60px)",
        opacity: 0.95,
      }}
    />
  );
}

// Moonwalker dark ambient — pure black field with soft #152331 slate lifts.
// Quiet depth only; no loud color wash.
function RainbowBackground() {
  const [phase, setPhase] = useState(0);
  const raf = useRef(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) return;
    let t = 0;
    const update = () => {
      t += 0.0016;
      setPhase(t);
      raf.current = requestAnimationFrame(update);
    };
    raf.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf.current);
  }, [reduced]);

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
      {/* Soft slate moons — barely-there depth from #152331 */}
      <div
        style={{
          position: "absolute",
          inset: "-10%",
          background: `
            radial-gradient(ellipse 70% 55% at ${42 + driftX}% ${28 + driftY}%,
              rgba(21, 35, 49, 0.95) 0%,
              rgba(21, 35, 49, 0.45) 40%,
              transparent 72%
            ),
            radial-gradient(ellipse 55% 50% at ${72 - driftX}% ${62 + driftY}%,
              rgba(21, 35, 49, 0.72) 0%,
              rgba(14, 24, 34, 0.28) 45%,
              transparent 75%
            ),
            radial-gradient(ellipse 50% 40% at ${22 + driftY}% ${70 - driftX}%,
              rgba(30, 48, 66, 0.40) 0%,
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
      {/* Thin cool rim light at the top — moonwalk edge */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            linear-gradient(180deg, rgba(142, 182, 212, 0.06) 0%, transparent 22%),
            radial-gradient(ellipse 80% 50% at 50% 0%, rgba(21, 35, 49, 0.55) 0%, transparent 60%)
          `,
        }}
      />
    </div>
  );
}

function Pill({ children, onClick, primary, subtle, style, title, disabled = false, loading = false }) {
  const unavailable = disabled || loading;
  return (
    <button
      type="button"
      onClick={unavailable ? undefined : onClick}
      title={title}
      disabled={unavailable}
      aria-busy={loading || undefined}
      className="cz-pill"
      style={{
        fontFamily: FONT,
        fontSize: 13,
        fontWeight: 650,
        letterSpacing: "-0.01em",
        color: primary ? ACTION_TEXT : subtle ? SUB : ACTION_MUTED_TEXT,
        background: primary ? ACTION_FILL : subtle ? "transparent" : ACTION_MUTED_BG,
        border: "none",
        borderRadius: 999,
        minHeight: 40,
        padding: "8px 14px",
        cursor: unavailable ? "not-allowed" : "pointer",
        opacity: unavailable ? 0.56 : 1,
        whiteSpace: "nowrap",
        ...style,
      }}
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

function CapturePill({
  hasInput,
  canStashTab,
  onCapture,
  onStashTab,
  onStashClipboard,
  disabled = false,
}) {
  const reduced = usePrefersReducedMotion();
  const isPrimary = Boolean(hasInput);
  const suffix = canStashTab ? "this tab" : "clipboard";

  const handleClick = () => {
    if (disabled) return;
    if (isPrimary) onCapture();
    else if (canStashTab) onStashTab();
    else onStashClipboard();
  };

  return (
    <motion.button
      type="button"
      className="cz-pill cz-capture-pill"
      onClick={handleClick}
      disabled={disabled}
      title={isPrimary ? "Stash" : canStashTab ? "Stash this tab" : "Stash clipboard"}
      aria-label={isPrimary ? "Stash" : canStashTab ? "Stash this tab" : "Stash clipboard"}
      initial={false}
      style={{
        fontFamily: FONT,
        fontSize: 13,
        fontWeight: 650,
        letterSpacing: "-0.01em",
        border: "none",
        borderRadius: 999,
        minHeight: 40,
        minWidth: 0,
        padding: "8px 14px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.56 : 1,
        whiteSpace: "nowrap",
        position: "relative",
        overflow: "hidden",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        isolation: "isolate",
      }}
    >
      {/* Muted background layer */}
      <motion.span
        aria-hidden="true"
        initial={false}
        animate={{ opacity: isPrimary ? 0 : 1 }}
        transition={{ duration: reduced ? 0 : 0.18 }}
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 999,
          background: ACTION_MUTED_BG,
          zIndex: -1,
        }}
      />
      {/* Gradient action background layer */}
      <motion.span
        aria-hidden="true"
        initial={false}
        animate={{ opacity: isPrimary ? 1 : 0 }}
        transition={{
          duration: reduced ? 0 : 0.2,
          delay: reduced ? 0 : isPrimary ? 0.08 : 0,
        }}
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 999,
          background: ACTION_FILL,
          zIndex: -1,
        }}
      />
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
        <motion.span
          layout
          animate={{ color: isPrimary ? ACTION_TEXT : ACTION_MUTED_TEXT }}
          transition={{
            layout: { type: "spring", stiffness: 300, damping: 30 },
            color: { duration: reduced ? 0 : 0.15, delay: reduced ? 0 : isPrimary ? 0.06 : 0 },
          }}
        >
          Stash
        </motion.span>
        <AnimatePresence initial={false}>
          {!isPrimary && (
            <motion.span
              key={suffix}
              initial={reduced ? false : { opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={reduced ? undefined : { opacity: 0, width: 0 }}
              transition={{
                width: { duration: reduced ? 0 : 0.25, ease: "easeInOut" },
                opacity: { duration: reduced ? 0 : 0.15, ease: "easeInOut" },
              }}
              style={{
                display: "inline-block",
                overflow: "hidden",
                whiteSpace: "nowrap",
                color: ACTION_MUTED_TEXT,
              }}
            >
              <span style={{ display: "inline-block", marginLeft: "0.32em" }}>{suffix}</span>
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </motion.button>
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
      className={("cz-favorite-button t-like " + className).trim()}
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

function Caption({ children, style }) {
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
      onError={() => setOk(false)}
      style={{ borderRadius: 3, flexShrink: 0, display: "block" }}
    />
  );
}

function BrandIcon({ type, host, size = 14 }) {
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

function TypeMark({ item }) {
  const meta = TYPES[item.type] || TYPES.note;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <BrandIcon type={item.type} host={item.host} size={13} />
      {!(item.type === "note" && item.note) && (
        <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 600, color: SUB }}>
          {meta.label}
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

// Subtle tint behind a cover placeholder so cards without images still feel
// distinct and intentional. Colors are theme-agnostic low-opacity hues.
function coverTint(item) {
  const tints = {
    shirt: "255, 56, 204",
    pants: "0, 245, 255",
    shoes: "52, 199, 89",
    outerwear: "255, 149, 0",
    accessory: "175, 82, 222",
    bag: "255, 204, 0",
    hat: "0, 212, 255",
    video: "255, 45, 85",
    tweet: "120, 120, 255",
    audio: "90, 200, 250",
    reddit: "255, 69, 0",
  };
  const key = item.category || item.type || "note";
  const rgb = tints[key] || tints[item.type] || "150, 150, 170";
  return `radial-gradient(circle at 30% 30%, rgba(${rgb}, 0.18) 0%, transparent 45%), radial-gradient(circle at 80% 80%, rgba(${rgb}, 0.10) 0%, transparent 40%)`;
}

function CoverPlaceholder({ item, aspectRatio = "4/5", maxHeight, style }) {
  const loading = item.status === "enriching";
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
        background: `
          ${coverTint(item)},
          linear-gradient(135deg, var(--cz-seg) 0%, var(--cz-bg-elevated) 100%)
        `,
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
      onDragStart={(event) => event.preventDefault()}
      onError={() => setImgOk(false)}
      style={boxStyle}
    />
  );
}

function FilterChip({ active, label, dot, onClick }) {
  return (
    <button
      type="button"
      className="cz-chip"
      aria-pressed={active}
      onClick={onClick}
      style={{
        fontFamily: FONT,
        fontSize: 12,
        fontWeight: 600,
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        color: active ? INK : SUB,
        background: active ? CARD : "transparent",
        border: "none",
        borderRadius: 999,
        padding: "5px 10px",
        cursor: "pointer",
        transition: "color .15s, background .15s",
      }}
    >
      {dot && <span style={{ width: 6, height: 6, borderRadius: 3, background: dot }} />}
      {label}
    </button>
  );
}

// Compact row — the scanning gear. Two lines when a summary is available.
function Row({ item, selected, onClick }) {
  const date = new Date(item.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const summary = typeof item.summary === "string" ? item.summary.trim() : "";
  const shortHost = item.host
    ? item.host.replace(/^(www\.|open\.)/, "").split(".")[0] + " · "
    : "";
  return (
    <button
      type="button"
      id={"card-" + item.id}
      className="cz-row"
      aria-pressed={selected}
      onClick={onClick}
      style={{
        background: CARD,
        border: "1px solid " + (selected ? BLUE : HAIR),
        boxShadow: selected ? "0 0 0 3px " + BLUE_BG : "none",
        borderRadius: 0,
        padding: "9px 12px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        cursor: "pointer",
        transition: "border-color .15s, box-shadow .15s",
      }}
    >
      {item.image ? (
        <img
          src={item.image}
          alt=""
          draggable={false}
          onDragStart={(event) => event.preventDefault()}
          style={{ width: 40, height: 40, objectFit: "cover", flexShrink: 0, display: "block", userSelect: "none", WebkitUserDrag: "none" }}
        />
      ) : (
        <BrandIcon type={item.type} host={item.host} size={13} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: FONT,
            fontSize: 12.5,
            fontWeight: 500,
            color: INK,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {item.title}
        </div>
        {summary && (
          <div
            style={{
              fontFamily: FONT,
              fontSize: 11.5,
              color: SUB,
              lineHeight: 1.35,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {summary}
          </div>
        )}
      </div>
      {item.note && (
        <span
          style={{ width: 5, height: 5, borderRadius: 3, background: BLUE, opacity: 0.7, flexShrink: 0 }}
        />
      )}
      <span style={{ fontFamily: FONT, fontSize: 12, color: FAINT, flexShrink: 0 }}>
        {shortHost + date}
      </span>
    </button>
  );
}

function Field({ label, value, onChange, placeholder, rows, suggestions, onCommit, emptyHint, listLabel, allowCreate }) {
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
      if (event.key === "Escape") closeMenu();
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

  const q = String(value || "").trim().toLowerCase();
  // While "Add new" is active, show the full list unfiltered so people can still
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
                e.preventDefault();
                pick(value);
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                openMenu();
              }
            }}
            placeholder={creating ? "Name the new haul…" : placeholder}
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-controls={id + "-list"}
            aria-autocomplete="list"
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
            zIndex: 80,
          }}
        >
          {filtered.length === 0 && !showCreate && !addNewLabel && !showClear ? (
            <div className="cz-combobox-option is-empty">{emptyHint}</div>
          ) : (
            filtered.map((name) => (
              <button
                key={name}
                type="button"
                role="option"
                aria-selected={name === value}
                className={"cz-combobox-option" + (name === value ? " is-current" : "")}
                onMouseDown={(e) => e.preventDefault()}
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
// Hover fan only — never force-open on click (the click handler owns opening the haul).
function HaulCoverFan({ covers = [], name = "", count = 0 }) {
  const [hovered, setHovered] = useState(false);
  const reduced = usePrefersReducedMotion();
  // Pad to at least 1, at most 5 slots so single-item hauls still look like a card.
  const images = covers.length ? covers.slice(0, 5) : [null];
  // For single covers, still fan 3 ghost cards so multi-item hauls feel special
  // when they grow — but keep the real image on top.
  const slots =
    images.length === 1
      ? [images[0], null, null]
      : images;
  const total = slots.length;
  const angle = 36;
  const open = hovered && !reduced;

  return (
    <div
      className="cz-haul-fan"
      onMouseEnter={() => setHovered(true)}
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
              <img src={src} alt="" draggable={false} />
            ) : (
              <div className="cz-haul-fan-placeholder">
                {(name || "?").slice(0, 1).toUpperCase()}
              </div>
            )}
          </motion.div>
        );
      })}
      {count > slots.filter(Boolean).length ? (
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
  const current = String(value || "").trim();

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
          className="t-acc-head cz-haul-acc-head"
          aria-expanded={open}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
            if (open) setCreating(false);
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
          <div className="cz-haul-acc-body" role="listbox" aria-label="Hauls">
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
    return (
      <div className="cz-haul-chip-row" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="cz-haul-chip"
          onClick={() => setExpanded(true)}
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
          onClick={() => commit("")}
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
  const photos = mergeFashionImages(item.image ? [item.image] : [], item.gallery || []).slice(0, max);
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
      <img src={src} alt={"Photo " + (index + 1)} draggable={false} />
      {isCover ? <span className="cz-edit-photo-cover-badge">Cover</span> : null}
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

function Card({ item, expanded, selected, onToggle, onDelete, onSaveNote, onSaveEdit, onOpen, onAttachImage, onRemoveImage, onAttachGalleryImage, onRemoveGalleryImage, onSetPrimaryImage, onToggleFavorite, featured, flipSignal, editSignal, mode, buyLabel }) {
  const [flipped, setFlipped] = useState(false);
  const [animateFlip, setAnimateFlip] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.note || "");
  const [ed, setEd] = useState(null);
  const [summaryOverflow, setSummaryOverflow] = useState(false);
  const [summaryAtEnd, setSummaryAtEnd] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageDragActive, setImageDragActive] = useState(false);
  const summaryRef = useRef(null);
  const backTextareaRef = useRef(null);
  const imageInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const noteId = useId();
  const reduced = usePrefersReducedMotion();

  const attach = async (file) => {
    if (!file || imageBusy) return;
    setImageBusy(true);
    try {
      await onAttachImage(item.id, file);
    } finally {
      setImageBusy(false);
    }
  };

  const attachGallery = async (file) => {
    if (!file || imageBusy) return;
    setImageBusy(true);
    try {
      await onAttachGalleryImage(item.id, file);
    } finally {
      setImageBusy(false);
    }
  };

  useEffect(() => {
    setDraft(item.note || "");
  }, [item.note]);

  // Write-through: the back-of-card note saves as you type — no Save needed.
  const noteTouchedRef = useRef(false);
  useEffect(() => {
    if (!noteTouchedRef.current) return;
    const t = setTimeout(() => {
      const next = draft.trim();
      if (next !== (item.note || "")) onSaveNote(item.id, next);
    }, 600);
    return () => clearTimeout(t);
  }, [draft]);

  useEffect(() => {
    if (!expanded) {
      setFlipped(false);
      setEditing(false);
    }
  }, [expanded]);

  useEffect(() => {
    if (flipped && backTextareaRef.current) backTextareaRef.current.focus();
  }, [flipped]);

  useEffect(() => {
    const summary = summaryRef.current;
    if (!summary || !expanded) {
      setSummaryOverflow(false);
      setSummaryAtEnd(false);
      return;
    }
    const measure = () => {
      setSummaryOverflow(summary.scrollHeight > summary.clientHeight + 1);
      setSummaryAtEnd(summary.scrollTop + summary.clientHeight >= summary.scrollHeight - 1);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [expanded, item.summary]);

  // Keyboard layer: F/E on a selected card raises a per-card signal string.
  useEffect(() => {
    if (flipSignal && flipSignal.startsWith(item.id + ":")) {
      setAnimateFlip(false);
      setFlipped(true);
    }
  }, [flipSignal, item.id]);
  useEffect(() => {
    if (editSignal && editSignal.startsWith(item.id + ":")) {
      setEd({
        title: item.title,
        summary: item.summary,
        tags: (item.tags || []).join(", "),
        project: item.project || "",
        importance: item.importance || "medium",
        linksText: (item.links || []).map((l) => l.url).join("\n"),
        findStatus: item.findStatus || "want",
        category: item.category || "",
        price: item.price == null ? "" : String(item.price),
        currency: item.currency || "CNY",
        seller: item.seller || "",
        batch: item.batch || "",
        size: item.size || "",
        colorway: item.colorway || "",
        agentLink: item.agentLink || "",
        findSource: item.findSource || "",
        note: item.note || "",
      });
      setEditing(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editSignal, item.id]);

  const startEdit = () => {
    setEd({
      title: item.title,
      summary: item.summary,
      tags: (item.tags || []).join(", "),
      project: item.project || "",
      importance: item.importance || "medium",
      linksText: (item.links || []).map((l) => l.url).join("\n"),
      findStatus: item.findStatus || "want",
      category: item.category || "",
      price: item.price == null ? "" : String(item.price),
      currency: item.currency || "CNY",
      seller: item.seller || "",
      batch: item.batch || "",
      size: item.size || "",
      colorway: item.colorway || "",
      agentLink: item.agentLink || "",
      findSource: item.findSource || "",
      note: item.note || "",
    });
    setEditing(true);
  };

  const date = new Date(item.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  // Each face rotates itself (not the parent): the wrapper's overflow:hidden is a
  // CSS "grouping property" that flattens preserve-3d, which made a parent-level
  // flip render the front mirrored instead of showing the back. Per-face
  // perspective() in the transform keeps the depth cue without needing a 3D
  // context to survive the flattening.
  const faceTransition = reduced || !animateFlip ? "none" : "transform 340ms " + EASE;
  const faceFlip = (deg) => "perspective(1200px) rotateY(" + deg + "deg)";
  const front = (
    <div
      aria-hidden={flipped}
      inert={flipped ? "" : undefined}
      style={{
        gridArea: "1 / 1",
        position: flipped ? "absolute" : "relative",
        inset: flipped ? 0 : undefined,
        padding: "14px 16px",
        transform: faceFlip(flipped ? 180 : 0),
        transition: faceTransition,
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        pointerEvents: flipped ? "none" : "auto",
      }}
    >
      <button
        type="button"
        className="cz-card-toggle"
        aria-expanded={expanded}
        aria-controls={"card-details-" + item.id}
        disabled={editing}
        onClick={onToggle}
        style={{
          display: "block",
          padding: 0,
          margin: 0,
          background: "transparent",
          border: 0,
          cursor: editing ? "default" : "pointer",
        }}
      >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <TypeMark item={item} />
        {item.note && (
          <span style={{ width: 5, height: 5, borderRadius: 3, background: BLUE, opacity: 0.7 }} />
        )}
        <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 11, color: FAINT, letterSpacing: "0.02em" }}>
          {(item.host ? item.host + " · " : "") + date}
        </span>
      </div>

      <div style={{ position: "relative", marginBottom: 12 }}>
        <CoverImage
          item={item}
          aspectRatio="4/5"
          maxHeight={320}
          className="cz-card-image"
          imgStyle={{
            borderRadius: 0,
            outline: "1px solid " + (mode === "dark" ? "oklch(1 0 0 / 0.08)" : "oklch(0 0 0 / 0.08)"),
            animation: reduced ? undefined : "credenza-fade 400ms ease-out both",
          }}
        />
        {item.findStatus !== "want" && (
          <span
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              fontFamily: MONO,
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              padding: "4px 8px",
              borderRadius: 999,
              background: FIND_STATUS_COLORS[item.findStatus]?.bg || "transparent",
              color: FIND_STATUS_COLORS[item.findStatus]?.text || INK,
              boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
            }}
          >
            {item.findStatus}
          </span>
        )}
        {item.price != null && (
          <span
            style={{
              position: "absolute",
              bottom: 10,
              right: 10,
              fontFamily: MONO,
              fontSize: 13,
              fontWeight: 700,
              padding: "5px 10px",
              borderRadius: 999,
              background: mode === "dark" ? "oklch(0.15 0 0 / 0.75)" : "oklch(1 0 0 / 0.9)",
              color: INK,
              backdropFilter: "blur(8px)",
            }}
          >
            {priceLabel(item)}
          </span>
        )}
      </div>

      {!editing && (
        <>
          <div
            style={{
              fontFamily: DISPLAY,
              fontSize: 19,
              fontWeight: 500,
              letterSpacing: "-0.03em",
              color: INK,
              lineHeight: 1.25,
              marginBottom: item.summary || item.seller || item.size ? 6 : 0,
            }}
          >
            {item.title}
          </div>
          {(item.seller || item.size) && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: item.summary ? 6 : 0 }}>
              {item.seller && (
                sellerStoreUrl(item) ? (
                  <a
                    href={sellerStoreUrl(item)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cz-seller-link"
                    onClick={(e) => e.stopPropagation()}
                    style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.02em" }}
                  >
                    {item.seller}
                  </a>
                ) : (
                  <span style={{ fontFamily: MONO, fontSize: 11, color: SUB, letterSpacing: "0.02em" }}>
                    {item.seller}
                  </span>
                )
              )}
              {item.size && (
                <span style={{ fontFamily: MONO, fontSize: 11, color: SUB, letterSpacing: "0.02em" }}>
                  {item.size}
                </span>
              )}
            </div>
          )}
          {item.summary && (
            <div>
              <div
                aria-hidden={expanded}
                style={{
                  display: "grid",
                  gridTemplateRows: expanded ? "0fr" : "1fr",
                  transition: reduced ? "none" : "grid-template-rows 220ms " + EASE,
                }}
              >
                <div
                  style={{
                    minHeight: 0,
                    overflow: "hidden",
                    opacity: expanded ? 0 : 1,
                    visibility: expanded ? "hidden" : "visible",
                    transition: reduced
                      ? "none"
                      : expanded
                        ? "opacity 160ms " + EASE + ", visibility 0s 220ms"
                        : "opacity 180ms " + EASE + ", visibility 0s",
                  }}
                >
                  <div
                    style={{
                      fontFamily: FONT,
                      fontSize: 13,
                      color: SUB,
                      lineHeight: 1.5,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {item.summary}
                  </div>
                </div>
              </div>
              <div
                aria-hidden={!expanded}
                style={{
                  display: "grid",
                  gridTemplateRows: expanded ? "1fr" : "0fr",
                  transition: reduced ? "none" : "grid-template-rows 220ms " + EASE,
                }}
              >
                <div
                  style={{
                    minHeight: 0,
                    overflow: "hidden",
                    opacity: expanded ? 1 : 0,
                    visibility: expanded ? "visible" : "hidden",
                    transition: reduced
                      ? "none"
                      : expanded
                        ? "opacity 180ms " + EASE + ", visibility 0s"
                        : "opacity 160ms " + EASE + ", visibility 0s 220ms",
                  }}
                >
                  <div
                    ref={summaryRef}
                    onScroll={(e) =>
                      setSummaryAtEnd(
                        e.currentTarget.scrollTop + e.currentTarget.clientHeight >=
                          e.currentTarget.scrollHeight - 1
                      )
                    }
                    style={{
                      fontFamily: FONT,
                      fontSize: 13,
                      color: SUB,
                      lineHeight: 1.5,
                      maxHeight: 280,
                      overflowX: "hidden",
                      overflowY: "auto",
                      WebkitMaskImage:
                        summaryOverflow && !summaryAtEnd
                          ? "linear-gradient(to bottom, black calc(100% - 24px), transparent 100%)"
                          : "none",
                      maskImage:
                        summaryOverflow && !summaryAtEnd
                          ? "linear-gradient(to bottom, black calc(100% - 24px), transparent 100%)"
                          : "none",
                    }}
                  >
                    {item.summary}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      </button>

      {/* Always reachable — not only while the front face is showing. */}
      <FavoriteButton item={item} onToggle={onToggleFavorite} className="cz-grid-favorite" />

      <div
        id={"card-details-" + item.id}
        aria-hidden={!expanded || editing}
        style={{
          display: "grid",
          gridTemplateRows: expanded && !editing ? "1fr" : "0fr",
          transition: reduced ? "none" : "grid-template-rows 220ms " + EASE,
        }}
      >
        {/* Propagation guard, not a control: keeps clicks on the expanded
            details from re-toggling the card. No action is denied to keyboard. */}
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            minHeight: 0,
            overflow: "hidden",
            opacity: expanded && !editing ? 1 : 0,
            visibility: expanded && !editing ? "visible" : "hidden",
            pointerEvents: expanded && !editing ? "auto" : "none",
            transition: reduced
              ? "none"
              : expanded && !editing
                ? "opacity 180ms " + EASE + ", visibility 0s"
                : "opacity 160ms " + EASE + ", visibility 0s 220ms",
          }}
        >
          <div style={{ marginTop: 12 }}>
            {item.note && (
              <div
                style={{
                  fontFamily: DISPLAY,
                  fontStyle: "italic",
                  fontSize: 14,
                  color: SUB,
                  background: BG,
                  border: "1px solid " + HAIR,
                  padding: "10px 12px",
                  lineHeight: 1.55,
                  marginBottom: 12,
                }}
              >
                {item.note}
              </div>
            )}

            {/* Fashion find metadata */}
            {(item.findStatus !== "want" || item.price != null || item.seller || item.size || item.colorway || item.agentLink || CATEGORIES[item.category] || sizeRunLabel(item)) && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "6px 10px",
                  fontFamily: MONO,
                  fontSize: 12,
                  color: SUB,
                  marginBottom: 12,
                  padding: "10px 12px",
                  background: mode === "dark" ? "oklch(0.28 0.03 280)" : "oklch(0.96 0.01 100)",
                  borderRadius: 0,
                }}
              >
                {item.findStatus !== "want" && (
                  <span
                    style={{
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      padding: "3px 8px",
                      borderRadius: 999,
                      background: FIND_STATUS_COLORS[item.findStatus]?.bg || BLUE_BG,
                      color: FIND_STATUS_COLORS[item.findStatus]?.text || INK,
                    }}
                  >
                    {item.findStatus}
                  </span>
                )}
                {item.price != null && (
                  <span style={{ fontWeight: 600, color: INK }}>
                    {priceLabel(item)}
                  </span>
                )}
                {item.seller && (
                  sellerStoreUrl(item) ? (
                    <a
                      href={sellerStoreUrl(item)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cz-seller-link"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {item.seller}
                    </a>
                  ) : (
                    <span>{item.seller}</span>
                  )
                )}
                {item.size && <span>Size {item.size}</span>}
                {item.colorway && <span>{item.colorway}</span>}
                {CATEGORIES[item.category] && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <span
                      aria-hidden="true"
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 999,
                        background: CATEGORIES[item.category].dot,
                      }}
                    />
                    {CATEGORIES[item.category].label}
                  </span>
                )}
                {sizeRunLabel(item) && <span>{sizeRunLabel(item)}</span>}
              </div>
            )}

            {item.sizeNotes && (
              <div
                style={{
                  fontFamily: FONT,
                  fontSize: 12.5,
                  lineHeight: 1.5,
                  color: SUB,
                  marginBottom: 12,
                  padding: "8px 12px",
                  borderLeft: "2px solid " + (mode === "dark" ? "oklch(0.5 0.02 280)" : "oklch(0.8 0.01 100)"),
                }}
              >
                {item.sizeNotes}
              </div>
            )}

            {/* Gallery thumbnails */}
            {(item.gallery || []).length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                {(item.gallery || []).map((src, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onSetPrimaryImage(item.id, src)}
                    style={{
                      width: 56,
                      height: 56,
                      padding: 0,
                      border: "1px solid " + HAIR,
                      background: CARD,
                      cursor: "pointer",
                    }}
                  >
                    <img
                      src={src}
                      alt={"Gallery image " + (idx + 1)}
                      draggable={false}
                      onDragStart={(event) => event.preventDefault()}
                      style={{ width: "100%", height: "100%", objectFit: "cover", userSelect: "none", WebkitUserDrag: "none" }}
                    />
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {linkButtons(item, { buyLabel }).map((btn) => (
                <Pill key={btn.url} primary={btn.role === "buy"} onClick={() => onOpen(item, btn.url)}>
                  {btn.label}
                </Pill>
              ))}
              <Pill onClick={startEdit}>Edit</Pill>
              <Pill subtle onClick={() => onDelete(item.id)}>
                Remove
              </Pill>
            </div>
          </div>
        </div>
      </div>

      {expanded && editing && ed && (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- propagation guard around the edit form, not a control
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 8 }}
        >
          <Field label="Title" value={ed.title} onChange={(v) => setEd({ ...ed, title: v })} placeholder="Name this card" />
          <Field
            label="Notes / links"
            value={ed.note || ""}
            onChange={(v) => setEd({ ...ed, note: v })}
            placeholder="Fit notes, QC reminders, sizing, seller tips, extra links…"
            rows={3}
          />
          <Field
            label="Project / haul"
            value={ed.project}
            onChange={(v) => setEd({ ...ed, project: v })}
            placeholder="e.g., Summer haul"
            suggestions={[]}
            emptyHint="Type a new haul name"
            listLabel="Hauls"
          />
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <Field
                label="Price"
                value={ed.price}
                onChange={(v) => setEd({ ...ed, price: v })}
                placeholder="0"
              />
            </div>
            <div style={{ width: 90 }}>
              <Field
                label="Currency"
                value={ed.currency}
                onChange={(v) => setEd({ ...ed, currency: v })}
                placeholder="CNY"
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <Field label="Seller" value={ed.seller} onChange={(v) => setEd({ ...ed, seller: v })} placeholder="Store name" />
            </div>
            <div style={{ flex: 1 }}>
              <Field label="Batch" value={ed.batch} onChange={(v) => setEd({ ...ed, batch: v })} placeholder="e.g., M Batch" />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <Field
                label="Size"
                value={ed.size}
                onChange={(v) => setEd({ ...ed, size: v })}
                placeholder="EU 42"
                suggestions={sizeSuggestionsFor(item)}
                emptyHint="Type a size"
                listLabel="Sizes"
              />
            </div>
            <div style={{ flex: 1 }}>
              <Field label="Colorway" value={ed.colorway} onChange={(v) => setEd({ ...ed, colorway: v })} placeholder="Black/white" />
            </div>
          </div>
          <div
            role="radiogroup"
            aria-label="Status"
            style={{ display: "flex", flexWrap: "wrap", gap: 4, background: SEG, borderRadius: 12, padding: 2 }}
          >
            {["want", "bought", "shipped", "qc", "gl", "rl", "returned"].map((s) => (
              <button
                type="button"
                role="radio"
                aria-checked={ed.findStatus === s}
                className="cz-chip"
                key={s}
                onClick={() => setEd({ ...ed, findStatus: s })}
                style={{
                  flex: "1 0 auto",
                  fontFamily: FONT,
                  fontSize: 11,
                  fontWeight: 600,
                  color: ed.findStatus === s ? INK : SUB,
                  background: ed.findStatus === s ? CARD : "transparent",
                  border: "none",
                  borderRadius: 999,
                  padding: "6px 8px",
                  cursor: "pointer",
                }}
              >
                {s === "want" ? "Want" : s === "bought" ? "Bought" : s === "shipped" ? "Shipped" : s === "qc" ? "QC" : s === "gl" ? "GL" : s === "rl" ? "RL" : "Returned"}
              </button>
            ))}
          </div>
          <div
            role="radiogroup"
            aria-label="Category"
            style={{ display: "flex", flexWrap: "wrap", gap: 4, background: SEG, borderRadius: 12, padding: 2 }}
          >
            {Object.keys(CATEGORIES).map((c) => (
              <button
                type="button"
                role="radio"
                aria-checked={ed.category === c}
                className="cz-chip"
                key={c}
                onClick={() => setEd({ ...ed, category: ed.category === c ? "" : c })}
                style={{
                  flex: "1 0 auto",
                  fontFamily: FONT,
                  fontSize: 11,
                  fontWeight: 600,
                  color: ed.category === c ? INK : SUB,
                  background: ed.category === c ? CARD : "transparent",
                  border: "none",
                  borderRadius: 999,
                  padding: "6px 8px",
                  cursor: "pointer",
                }}
              >
                {CATEGORIES[c].label}
              </button>
            ))}
          </div>
          <div
            role="radiogroup"
            aria-label="Importance"
            style={{ display: "flex", background: SEG, borderRadius: 999, padding: 2 }}
          >
            {["low", "medium", "high"].map((lvl) => (
              <button
                type="button"
                role="radio"
                aria-checked={ed.importance === lvl}
                className="cz-chip"
                key={lvl}
                onClick={() => setEd({ ...ed, importance: lvl })}
                style={{
                  flex: 1,
                  fontFamily: FONT,
                  fontSize: 12,
                  fontWeight: 600,
                  color: ed.importance === lvl ? INK : SUB,
                  background: ed.importance === lvl ? CARD : "transparent",
                  border: "none",
                  borderRadius: 999,
                  padding: "6px 0",
                  cursor: "pointer",
                }}
              >
                {lvl === "low" ? "Low" : lvl === "medium" ? "Medium" : "High"}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                attach(e.target.files && e.target.files[0]);
                e.target.value = "";
              }}
            />
            <Pill onClick={() => imageInputRef.current && imageInputRef.current.click()}>
              {imageBusy ? "Adding…" : item.image ? "Replace image" : "Add image"}
            </Pill>
            {item.image && (
              <Pill subtle onClick={() => onRemoveImage(item.id)}>
                Remove image
              </Pill>
            )}
          </div>

          {/* Gallery management */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                attachGallery(e.target.files && e.target.files[0]);
                e.target.value = "";
              }}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Pill onClick={() => galleryInputRef.current && galleryInputRef.current.click()}>
                {imageBusy ? "Adding…" : "Add gallery image"}
              </Pill>
              <span style={{ fontFamily: FONT, fontSize: 12, color: FAINT, alignSelf: "center" }}>
                {(item.gallery || []).length}/12
              </span>
            </div>
            {(item.gallery || []).length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(item.gallery || []).map((src, idx) => (
                  <div key={idx} style={{ position: "relative", width: 56, height: 56 }}>
                    <img
                      src={src}
                      alt={"Gallery " + (idx + 1)}
                      draggable={false}
                      onDragStart={(event) => event.preventDefault()}
                      style={{ width: "100%", height: "100%", objectFit: "cover", border: "1px solid " + HAIR, userSelect: "none", WebkitUserDrag: "none" }}
                    />
                    <button
                      type="button"
                      aria-label={"Remove gallery image " + (idx + 1)}
                      onClick={() => onRemoveGalleryImage(item.id, idx)}
                      style={{
                        position: "absolute",
                        top: -6,
                        right: -6,
                        width: 18,
                        height: 18,
                        borderRadius: 999,
                        border: "none",
                        background: ACTION_FILL,
                        color: ACTION_TEXT,
                        fontSize: 10,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
            <Pill
              primary
              onClick={() => {
                const priceNum = ed.price.trim() === "" ? null : parseFloat(ed.price);
                onSaveEdit(item.id, {
                  title: ed.title.trim() || item.title,
                  summary: ed.summary.trim(),
                  tags: ed.tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 5),
                  project: ed.project.trim(),
                  importance: ed.importance,
                  links: normalizeLinks(extractUrls(ed.linksText || ""), item.url),
                  findStatus: ed.findStatus,
                  category: ed.category,
                  price: Number.isFinite(priceNum) ? priceNum : null,
                  currency: ed.currency.trim() || "CNY",
                  seller: ed.seller.trim(),
                  batch: ed.batch.trim(),
                  size: ed.size.trim(),
                  colorway: ed.colorway.trim(),
                  agentLink: ed.agentLink.trim(),
                  findSource: ed.findSource.trim(),
                  note: (ed.note || "").trim(),
                });
                setEditing(false);
              }}
            >
              Save
            </Pill>
            <Pill subtle onClick={() => setEditing(false)}>
              Cancel
            </Pill>
          </div>
        </div>
      )}
    </div>
  );

  const back = (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- propagation guard on the card back, not a control
    <div
      aria-hidden={!flipped}
      inert={!flipped ? "" : undefined}
      onClick={(e) => e.stopPropagation()}
      style={{
        gridArea: "1 / 1",
        position: flipped ? "relative" : "absolute",
        inset: flipped ? undefined : 0,
        padding: "14px 16px",
        transform: faceFlip(flipped ? 0 : -180),
        transition: faceTransition,
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        pointerEvents: flipped ? "auto" : "none",
      }}
    >
      <label
        htmlFor={noteId}
        style={{ display: "block", color: BLUE_DK, marginBottom: 8, fontSize: 12, fontWeight: 650 }}
      >
        Back of the card
      </label>
      <textarea
        id={noteId}
        className="cz-note-field"
        ref={backTextareaRef}
        value={draft}
        onChange={(e) => {
          noteTouchedRef.current = true;
          setDraft(e.target.value);
        }}
        placeholder="Why did you save this?"
        rows={3}
        style={{
          width: "100%",
          boxSizing: "border-box",
          background: "transparent",
          border: "none",
          borderBottom: "1px solid " + HAIR,
          resize: "vertical",
          color: INK,
          fontSize: 14,
          lineHeight: 1.6,
          fontFamily: FONT,
          padding: "2px 0 8px",
        }}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <Pill
          primary
          onClick={() => {
            onSaveNote(item.id, draft.trim());
            setAnimateFlip(true);
            setFlipped(false);
          }}
        >
          Save
        </Pill>
        <Pill subtle onClick={() => {
          const next = draft.trim();
          if (next !== (item.note || "")) onSaveNote(item.id, next);
          setAnimateFlip(true);
          setFlipped(false);
        }}>
          Done
        </Pill>
      </div>
    </div>
  );

  return (
    <article
      id={"card-" + item.id}
      aria-current={selected ? "true" : undefined}
      style={{ perspective: 1200, height: "100%" }}
    >
      <div
        onPaste={(e) => {
          if (!expanded) return;
          const file = clipboardImageFile(e);
          if (file) {
            e.preventDefault();
            e.stopPropagation();
            if (editing) attachGallery(file);
            else attach(file);
          }
        }}
        onDragOver={(e) => {
          if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files")) {
            e.preventDefault();
            setImageDragActive(true);
          }
        }}
        onDragLeave={() => setImageDragActive(false)}
        onDrop={(e) => {
          const file = droppedImageFile(e);
          setImageDragActive(false);
          if (file) {
            e.preventDefault();
            e.stopPropagation();
            if (editing) attachGallery(file);
            else attach(file);
          }
        }}
        style={{
          background: CARD,
          borderRadius: 0,
          border: "1px solid " + (imageDragActive ? BLUE : selected ? BLUE : featured ? BLUE_BG : HAIR),
          boxShadow: selected ? "0 0 0 3px " + BLUE_BG : "0 7px 18px rgba(20,20,16,.035)",
          overflow: "hidden",
          cursor: "default",
          display: "grid",
          position: "relative",
          transition: reduced ? "none" : "border-color .15s, box-shadow .15s",
          height: "100%",
        }}
      >
        {front}
        {back}
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

function CarouselSizeInfo({ item }) {
  // Keep the chart English-only: any fact row or variant axis carrying CJK
  // (颜色 / 尺码 / 黑色…) is dropped rather than shown untranslated.
  const hasCjk = (s) => /[㐀-䶿一-鿿豈-﫿]/.test(String(s));
  const facts = [
    ["Selected", item.size],
    ["Poster wore", item.posterSize],
    ["Recommended", item.recommendedSize],
    ["Available", sizeRunLabel(item)],
  ].filter(([, value]) => value && !hasCjk(value));
  const axes = (item.variants || []).filter(
    (group) =>
      group &&
      group.title &&
      Array.isArray(group.values) &&
      group.values.length &&
      !hasCjk(group.title) &&
      !group.values.some((v) => hasCjk(v))
  );
  if (!facts.length && !item.sizeNotes && !axes.length) return "No sizing information saved yet.";
  return (
    <div className="cz-size-info">
      {facts.map(([label, value]) => (
        <div className="cz-size-info-row" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
      {item.sizeNotes && <p>{item.sizeNotes}</p>}
      {axes.map((group) => (
        <div className="cz-size-axis" key={group.title}>
          <span>{group.title}</span>
          <div>{group.values.join(" · ")}</div>
        </div>
      ))}
    </div>
  );
}

// variant "fan"  — stacked corner fan that peels open on hover (classic)
// variant "strip" — flat equal thumbs (product-sheet hierarchy)
function CardCornerFan({ item, images, onOpenPhotos, reduced, variant = "fan", interactive = true }) {
  const [isHovered, setIsHovered] = useState(false);
  const fanRef = useRef(null);
  const [fanWidth, setFanWidth] = useState(284);
  useEffect(() => {
    const fan = fanRef.current;
    if (!fan) return;
    const update = () => setFanWidth(fan.clientWidth || 284);
    update();
    if (!window.ResizeObserver) return;
    const observer = new window.ResizeObserver(update);
    observer.observe(fan);
    return () => observer.disconnect();
  }, []);
  // Cover + 3 previews. The step contracts as needed so the fourth card never
  // escapes a narrow back face. Card width is 60px (see .cz-corner-fan-card).
  const displayed = images.slice(0, 4);
  const total = displayed.length;
  const spreadStep = total > 1 ? Math.min(66, Math.max(0, (fanWidth - 60) / (total - 1))) : 0;
  if (total === 0) return null;

  const openGallery = (e) => {
    // Side cards can still hold focus after a gallery close + scroll. Ignore
    // keyboard/mouse open unless this fan belongs to the active center card.
    if (!interactive) return;
    if (onOpenPhotos) onOpenPhotos(item, e.currentTarget);
  };

  // Product-sheet strip: equal thumbs in a row — intentional, not a leftover stack.
  if (variant === "strip") {
    return (
      <div
        ref={fanRef}
        className="cz-corner-fan is-strip"
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
        {displayed.map((src, i) => (
          <div key={src + i} className="cz-corner-fan-card is-strip-card">
            <img src={src} alt={"Gallery image " + (i + 1)} draggable={false} />
          </div>
        ))}
        {images.length > 4 && (
          <span className="cz-corner-fan-more is-strip-more">+{images.length - 4}</span>
        )}
      </div>
    );
  }

  return (
    <div
      ref={fanRef}
      className="cz-corner-fan"
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
          // Don't swallow Space on a side/stale fan — let the app flip the
          // active card instead of reopening the previous card's photos.
          if (!interactive) return;
          e.preventDefault();
          openGallery(e);
        }
      }}
    >
      {displayed.map((src, i) => {
        // Cover photo (i = 0) stays put; the rest slide out to its right in a
        // flat row on hover. Collapsed, they stack behind the cover.
        const spread = isHovered;
        const x = spread ? i * spreadStep : i * 2;
        const angle = spread ? 0 : i * 1.5;
        return (
          <motion.div
            key={src + i}
            className="cz-corner-fan-card"
            animate={{
              rotate: angle,
              x,
              y: 0,
              scale: spread && i === 0 ? 1.04 : 1,
              zIndex: 5 - i,
            }}
            transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 240, damping: 22 }}
            style={{ originX: 0.5, originY: 1 }}
          >
            <img src={src} alt={"Gallery image " + (i + 1)} draggable={false} />
          </motion.div>
        );
      })}
      {images.length > 4 && (
        <span className="cz-corner-fan-more">+{images.length - 4}</span>
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

  useEffect(() => {
    if (flipSignal && flipSignal.startsWith(item.id + ":")) setFlipped(true);
  }, [flipSignal, item.id]);

  useEffect(() => {
    if (editSignal && editSignal.startsWith(item.id + ":")) {
      setEd({
        title: item.title,
        summary: item.summary,
        tags: (item.tags || []).join(", "),
        project: item.project || "",
        importance: item.importance || "medium",
        linksText: (item.links || []).map((l) => l.url).join("\n"),
        findStatus: item.findStatus || "want",
        category: item.category || "",
        price: item.price == null ? "" : String(item.price),
        currency: item.currency || "CNY",
        seller: item.seller || "",
        batch: item.batch || "",
        size: item.size || "",
        colorway: item.colorway || "",
        agentLink: item.agentLink || "",
        findSource: item.findSource || "",
        note: item.note || "",
      });
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

  const discardEdit = useCallback(() => {
    // Write-through means there's nothing to discard — flush the last keystrokes.
    commitEditRef.current();
    setEditExitUp(false);
    setEditing(false);
    setEd(null);
  }, []);

  // Check-button save: same commit as the back chevron, but the edit sheet
  // leaves the way it came in (back up) instead of dropping down. flushSync
  // commits the direction first so the exiting sheet picks up the up-exit
  // prop in its last render before AnimatePresence removes it.
  const saveEditAndClose = useCallback(() => {
    commitEditRef.current();
    flushSync(() => setEditExitUp(true));
    setEditing(false);
    setEd(null);
  }, []);

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

  const buildEditPatch = (draft, base) => ({
    title: draft.title.trim() || base.title,
    summary: draft.summary.trim(),
    tags: draft.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 5),
    project: draft.project.trim(),
    importance: draft.importance,
    links: normalizeLinks(extractUrls(draft.linksText || ""), base.url),
    findStatus: draft.findStatus,
    category: draft.category,
    price: draft.price === "" ? null : Number(draft.price),
    currency: draft.currency.trim() || "CNY",
    seller: draft.seller.trim(),
    batch: draft.batch.trim(),
    size: draft.size.trim(),
    colorway: draft.colorway.trim(),
    agentLink: draft.agentLink.trim(),
    findSource: draft.findSource.trim(),
    note: (draft.note || "").trim(),
  });

  // Write-through commit — the edit form persists as you type, so leaving the
  // screen (back chevron, outside click, flip) never loses notes.
  const commitEditRef = useRef(() => {});
  commitEditRef.current = () => {
    if (ed) onSaveEdit(item.id, buildEditPatch(ed, item));
  };

  useEffect(() => {
    if (!editing || !ed) return;
    const t = setTimeout(() => commitEditRef.current(), 700);
    return () => clearTimeout(t);
  }, [ed, editing]);

  const startEdit = () => {
    setEd({
      title: item.title,
      summary: item.summary,
      tags: (item.tags || []).join(", "),
      project: item.project || "",
      importance: item.importance || "medium",
      linksText: (item.links || []).map((l) => l.url).join("\n"),
      findStatus: item.findStatus || "want",
      category: item.category || "",
      price: item.price == null ? "" : String(item.price),
      currency: item.currency || "CNY",
      seller: item.seller || "",
      batch: item.batch || "",
      size: item.size || "",
      colorway: item.colorway || "",
      agentLink: item.agentLink || "",
      findSource: item.findSource || "",
      note: item.note || "",
    });
    setBubble(null);
    setBackView("details");
    setEditExitUp(false);
    setEditing(true);
  };

  const galleryImages = mergeFashionImages(item.image ? [item.image] : [], item.gallery || []);
  const knownHauls = Array.from(
    new Set(
      [...(haulNames || []), item.project || ""]
        .map((name) => String(name || "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  // No autofocus on flip — the programmatic focus lit up the glow ring on
  // every flip, which reads as a highlight glitch, not affordance.

  // The heart rides the front face: mounting it the moment `flipped` goes
  // false shows it mirrored over the back header for the first half of the
  // flip-back. Gate it on the actual rotation — visible only inside the
  // front-facing 90°, same culling the faces get from backface-visibility.
  const [heartVisible, setHeartVisible] = useState(!flipped);
  const heartVisibleRef = useRef(!flipped);
  const handleCardRotate = useCallback((latest) => {
    const show = (parseFloat(latest.rotateY) || 0) < 90;
    if (show !== heartVisibleRef.current) {
      heartVisibleRef.current = show;
      setHeartVisible(show);
    }
  }, []);

  // Widen the card ~20% while editing (CSS t-resize tween), so the edit
  // form's fields aren't a squint-read.
  useEffect(() => {
    const card = rootRef.current && rootRef.current.closest(".cz-carousel-card");
    if (!card) return undefined;
    card.classList.toggle("is-editing", Boolean(editing));
    return () => card.classList.remove("is-editing");
  }, [editing]);

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
        {/* Front face */}
        <div
          className="cz-carousel-face cz-carousel-front"
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
            {item.findStatus !== "want" && (
              <span className="cz-carousel-status">{item.findStatus}</span>
            )}
            {/* Always show a price slot when we have any price figure (USD or CNY).
                Absolute to the image wrap — meta below is fixed height so chips
                land on the same baseline across every card. */}
            {priceLabel(item) ? (
              <span className="cz-carousel-price">{priceLabel(item)}</span>
            ) : null}
          </div>
          <div className="cz-carousel-front-meta">
            <div className="cz-carousel-type">
              <BrandIcon type={item.type} host={item.host} size={12} />
              <span>{(TYPES[item.type] || TYPES.note).label}</span>
            </div>
            <h3 className="cz-carousel-title">{item.title}</h3>
            {/* Always reserve the sub row so meta height is identical card-to-card
                (missing seller used to collapse this and shove the price chip). */}
            <div className="cz-carousel-sub">
              {item.seller ? (
                sellerStoreUrl(item) ? (
                  <a
                    href={sellerStoreUrl(item)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cz-seller-link"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {item.seller}
                  </a>
                ) : (
                  <span>{item.seller}</span>
                )
              ) : (
                <span className="cz-carousel-sub-empty" aria-hidden="true">
                  &nbsp;
                </span>
              )}
              {item.seller && item.size ? " · " : null}
              {item.size ? <span>{item.size}</span> : null}
            </div>
          </div>
        </div>

        {/* Heart is front-face only — gated on the live rotation so it never
            mirrors over the back header during the first half of flip-back. */}
        {heartVisible && (
          <FavoriteButton item={item} onToggle={onToggleFavorite} className="cz-carousel-favorite" />
        )}

        {/* Back-face content is inert for dismissal; only an exact outside-card
            click or an explicit navigation control removes one layer. */}
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- propagation boundary, not a control */}
        <div
          className="cz-carousel-face cz-carousel-back"
          onClick={(e) => {
            const carousel = e.currentTarget.closest(".cz-carousel");
            if (carousel && carousel.dataset.dragging === "true") {
              delete carousel.dataset.dragging;
              return;
            }
            e.stopPropagation();
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
            {editing ? (
              <div className="cz-carousel-back-actions">
                {/* Reverse of the detail view's pen→check morph: check is idle,
                    pen peeks in on hover. Saves + slides the sheet back up. */}
                <MorphButton
                  iconOnly
                  icon={Check}
                  activeIcon={Pen}
                  onClick={saveEditAndClose}
                  ariaLabel="Save changes"
                  title="Save changes"
                  className="cz-card-edit-morph cz-card-save-check"
                />
              </div>
            ) : backView === "details" && (
              <div className="cz-carousel-back-actions">
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
              </div>
            )}
          </div>

          {/* Edit slides in from above — the reverse of the content below it. */}
          <AnimatePresence mode="wait" initial={false}>
          {editing && ed ? (
            <motion.div
              key="edit"
              className="cz-carousel-edit-shell"
              initial={reduced ? false : { opacity: 0, y: -14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? undefined : { opacity: 0, y: editExitUp ? -14 : 10 }}
              transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 32 }}
            >
            <div className="cz-carousel-edit">
              <Field label="Title" value={ed.title} onChange={(v) => setEd({ ...ed, title: v })} placeholder="Name this card" />
              <Field
                label="Notes / links"
                value={ed.note || ""}
                onChange={(v) => setEd({ ...ed, note: v })}
                placeholder="Fit notes, QC reminders, sizing, seller tips, extra links…"
                rows={3}
              />
              <HaulAccordionField
                label="Haul"
                value={ed.project}
                knownHauls={knownHauls}
                onChange={(v) => setEd({ ...ed, project: v })}
                onCommit={(v) => setEd((prev) => (prev ? { ...prev, project: v } : prev))}
              />
              <EditPhotosManager
                item={item}
                onAttachPhoto={onAttachPhoto}
                onRemovePhoto={onRemovePhoto}
              />
              <div className="cz-carousel-field-grid price-grid">
                <div>
                  <Field label="Price" value={ed.price} onChange={(v) => setEd({ ...ed, price: v })} placeholder="0" />
                </div>
                <div>
                  <Field label="Currency" value={ed.currency} onChange={(v) => setEd({ ...ed, currency: v })} placeholder="CNY" />
                </div>
              </div>
              <div className="cz-carousel-field-grid">
                <div>
                  <Field label="Seller" value={ed.seller} onChange={(v) => setEd({ ...ed, seller: v })} placeholder="Store name" />
                </div>
                <div>
                  <Field label="Batch" value={ed.batch} onChange={(v) => setEd({ ...ed, batch: v })} placeholder="e.g., M Batch" />
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
                    chevronLabel="Show sizes"
                  />
                </div>
                <div>
                  <Field label="Colorway" value={ed.colorway} onChange={(v) => setEd({ ...ed, colorway: v })} placeholder="Black/white" />
                </div>
              </div>
            </div>
            </motion.div>
          ) : (
            <motion.div
              key="content"
              className="cz-carousel-back-content"
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
                    className={
                      "cz-card-details-panel" +
                      (CARD_BACK_PRODUCT_SHEET ? " cz-card-details-panel--sheet" : "")
                    }
                    initial={reduced ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduced ? undefined : { opacity: 0, y: -8 }}
                    transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 32 }}
                  >
                    <h3 className="cz-carousel-back-title">{item.title}</h3>

                    {CARD_BACK_PRODUCT_SHEET ? (
                      <>
                        {/* Product sheet: price is the secondary hero; seller is quiet. */}
                        {item.price != null && (
                          <div className="cz-carousel-price-hero">{priceLabel(item)}</div>
                        )}
                        {item.seller ? (
                          sellerStoreUrl(item) ? (
                            <a
                              href={sellerStoreUrl(item)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="cz-seller-quiet"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {item.seller}
                            </a>
                          ) : (
                            <span className="cz-seller-quiet is-text">{item.seller}</span>
                          )
                        ) : null}
                        {(item.findStatus !== "want" ||
                          item.posterSize ||
                          item.recommendedSize ||
                          item.colorway) && (
                          <div className="cz-carousel-meta-chips">
                            {item.findStatus !== "want" && (
                              <span
                                className="cz-meta-chip"
                                style={{ color: (FIND_STATUS_COLORS[item.findStatus] || {}).text || INK }}
                              >
                                {item.findStatus}
                              </span>
                            )}
                            {item.posterSize && (
                              <span className="cz-meta-chip">Poster {item.posterSize}</span>
                            )}
                            {item.recommendedSize && (
                              <span className="cz-meta-chip">Rec {item.recommendedSize}</span>
                            )}
                            {item.colorway && (
                              <span className="cz-meta-chip">{item.colorway}</span>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="cz-carousel-meta-grid">
                        {item.findStatus !== "want" && (
                          <div>
                            <span>Status</span>
                            <span style={{ color: (FIND_STATUS_COLORS[item.findStatus] || {}).text || INK }}>
                              {item.findStatus}
                            </span>
                          </div>
                        )}
                        {item.price != null && (
                          <div>
                            <span>Price</span>
                            <span className="cz-carousel-price-value">
                              {priceLabel(item)}
                            </span>
                          </div>
                        )}
                        {item.seller && (
                          <div>
                            <span>Seller</span>
                            {sellerStoreUrl(item) ? (
                              <a
                                href={sellerStoreUrl(item)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="cz-seller-link"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {item.seller}
                              </a>
                            ) : (
                              <span>{item.seller}</span>
                            )}
                          </div>
                        )}
                        {item.posterSize && (
                          <div>
                            <span>Poster wore</span>
                            <span>{item.posterSize}</span>
                          </div>
                        )}
                        {item.recommendedSize && (
                          <div>
                            <span>Recommended</span>
                            <span>{item.recommendedSize}</span>
                          </div>
                        )}
                        {item.colorway && (
                          <div>
                            <span>Colorway</span>
                            <span>{item.colorway}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Haul: quiet chip when assigned (product sheet); full accordion otherwise. */}
                    <div className="cz-carousel-haul-block" onClick={(e) => e.stopPropagation()}>
                      <CardBackHaulField
                        item={item}
                        knownHauls={knownHauls}
                        onSaveEdit={onSaveEdit}
                        compact={CARD_BACK_PRODUCT_SHEET}
                      />
                    </div>

                    {item.note && (
                      <div className="cz-carousel-note">
                        <span>Note</span>
                        <p>{item.note}</p>
                      </div>
                    )}

                    {galleryImages.length > 0 && (
                      <CardCornerFan
                        item={item}
                        images={galleryImages}
                        onOpenPhotos={onOpenPhotos}
                        reduced={reduced}
                        // Keep the peel-open fan — product-sheet hierarchy is
                        // about price/haul chrome, not killing the photo motion.
                        variant="fan"
                        // Only the centered card may open photos via Space —
                        // stale focus on a previous fan reopened the wrong album.
                        interactive={isCenter}
                      />
                    )}

                    <div className="cz-carousel-actions">
                      {linkButtons(item, { buyLabel })
                        .map((button, index) => (
                          <button
                            key={button.url + index}
                            type="button"
                            className={"cz-carousel-action-btn" + (button.role === "buy" ? " primary" : "")}
                            onClick={() => onOpen(item, button.url)}
                          >
                            {button.label}
                            {button.role === "buy" ? (
                              <span className="cz-btn-glare" aria-hidden="true" />
                            ) : null}
                          </button>
                        ))}
                      <button
                        type="button"
                        className="cz-carousel-action-btn"
                        onClick={() =>
                          openBubble(
                            "sizes",
                            "Size info",
                            <CarouselSizeInfo item={item} />
                          )
                        }
                      >
                        Sizes
                      </button>
                    </div>

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
      requestAnimationFrame(() => {
        const stage = containerRef.current;
        if (stage && typeof stage.focus === "function" && !stage.contains(document.activeElement)) {
          stage.focus({ preventScroll: true });
        }
      });
      // Never keep an album open for a card that is no longer centered.
      setGallery((current) => (current ? null : current));
    }
    activeIndexRef.current = next;
    setActiveIndexState(next);
  }, [items, expandedId, onDeactivate]);

  useEffect(() => {
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
    setActiveIndex(0);
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
    // Gallery owns Escape while open; layered card dismiss is handled by the
    // capture-phase window listener so it still works when focus is elsewhere.
    if (event.key === "Escape") return;
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
      if (document.querySelector('[role="dialog"][aria-label="Album photo preview"]')) return;
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

  const openPhotos = useCallback(async (item, trigger) => {
    // Only the centered/active card should open the gallery. A focused fan on a
    // side card (stale after close + scroll) used to reopen the wrong album.
    const center = items[activeIndexRef.current];
    if (!center || center.id !== item.id) return;
    const seed = mergeFashionImages(item.image ? [item.image] : [], item.gallery || []).slice(0, 8);
    const shouldLoad = !!yupooAlbumUrl(item) && seed.length < 8 && !!onLoadPhotos;
    galleryTriggerRef.current = trigger || null;
    setGallery({ item, images: seed, startIndex: 0 });
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
                  reduced={reduced}
                />
              </motion.div>
            );
          })}
        </div>
      </motion.div>

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
  const [cardSize, setCardSize] = useState({ width: 300, height: 400 });

  useEffect(() => {
    // Focus the close button when the gallery opens so keyboard users land inside.
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
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- backdrop click dismisses; dialog has explicit close and Escape support
      <div className="cz-photo-coverflow-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="cz-photo-coverflow" role="dialog" aria-label="Album photo preview">
          <button className="cz-photo-coverflow-close" ref={closeRef} onClick={onClose} aria-label="Close photo preview">✕</button>
          <div style={{ color: "var(--cz-sub)" }}>No photos loaded.</div>
        </div>
      </div>
    );
  }

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- backdrop click dismisses; dialog has explicit close and Escape support
    <div className="cz-photo-coverflow-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cz-photo-coverflow" role="dialog" aria-modal="true" aria-label="Album photo preview">
        <button className="cz-photo-coverflow-close" ref={closeRef} onClick={onClose} aria-label="Close photo preview">✕</button>
        <motion.div
          className="cz-photo-coverflow-stage"
          ref={containerRef}
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
                  <img src={src} alt={"Album photo " + (index + 1)} draggable={false} />
                  {index === activeIndex && (
                    <div className="cz-photo-coverflow-caption">{item.title}</div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>
        <div className="cz-photo-coverflow-controls">
          <button onClick={goPrev} aria-label="Previous photo"><ChevronLeft size={18} /></button>
          <span className="cz-photo-coverflow-counter">{activeIndex + 1} / {loadedImages.length}</span>
          <button onClick={goNext} aria-label="Next photo"><ChevronRight size={18} /></button>
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
    </div>
  );
}

function ModalShell({ title, onClose, children, maxWidth = 720 }) {
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
      <div className="cz-modal-surface">
        <div
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
              background: SEG,
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

// A2: buying-agent picker + referral slots + outbound-click counts. Buy keeps
// working with empty referral slots — codes only attach at open time (recordOpen).
function AgentSheet({ preferredAgent, onSelectAgent, affiliateCodes, onAffiliateCodeChange, storageBackend, onClose }) {
  const [summary, setSummary] = useState(null);
  useEffect(() => {
    let live = true;
    loadOutboundClicks(storageBackend).then((clicks) => {
      if (live) setSummary(summarizeOutbound(clicks));
    });
    return () => {
      live = false;
    };
  }, [storageBackend]);

  return (
    <ModalShell title="Buying agent" onClose={onClose} maxWidth={520}>
      <div style={{ padding: "20px 22px 22px", fontFamily: FONT }}>
        <Caption style={{ color: BLUE, marginBottom: 10 }}>Buy opens in</Caption>
        <div
          role="radiogroup"
          aria-label="Preferred buying agent"
          style={{ display: "grid", gap: 6 }}
        >
          {listAgents().map((agent) => {
            const active = agent.id === preferredAgent;
            const clicks = summary && summary.byAgent[agent.id];
            return (
              <button
                type="button"
                role="radio"
                aria-checked={active}
                key={agent.id}
                onClick={() => onSelectAgent(agent.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontFamily: FONT,
                  fontSize: 13,
                  fontWeight: active ? 700 : 600,
                  color: active ? INK : SUB,
                  background: active ? CARD : "transparent",
                  border: "1px solid " + (active ? "var(--cz-hair-strong)" : HAIR),
                  borderRadius: 12,
                  padding: "10px 12px",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span style={{ flex: 1 }}>{agent.name}</span>
                {clicks ? (
                  <span style={{ fontSize: 11, color: SUB, fontWeight: 600 }}>{clicks} opened</span>
                ) : null}
                {active ? <Check size={15} aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
        <p style={{ fontSize: 12, lineHeight: 1.5, color: SUB, margin: "12px 0 0" }}>
          Change anytime — your saved links are never rewritten. The agent is applied only when you
          tap Buy. Disclosure: Buy links may include a referral code; Credenza may earn a commission
          on agent shipping fees. It never changes your item price.
        </p>

        <Caption style={{ color: BLUE, margin: "18px 0 8px" }}>Referral codes (optional)</Caption>
        <div style={{ display: "grid", gap: 8 }}>
          {listAgents()
            .filter((a) => a.referralParam)
            .map((agent) => (
              <label key={agent.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: SUB }}>
                <span style={{ width: 80, flexShrink: 0, fontWeight: 600 }}>{agent.name}</span>
                <input
                  type="text"
                  value={affiliateCodes[agent.id] || ""}
                  onChange={(e) => onAffiliateCodeChange(agent.id, e.target.value)}
                  placeholder="Paste code when your affiliate account is approved"
                  style={{
                    flex: 1,
                    fontFamily: FONT,
                    fontSize: 12.5,
                    color: INK,
                    background: SEG,
                    border: "1px solid " + HAIR,
                    borderRadius: 10,
                    padding: "8px 10px",
                  }}
                />
              </label>
            ))}
        </div>

        {summary && summary.total > 0 ? (
          <p style={{ fontSize: 11.5, color: SUB, margin: "16px 0 0" }}>
            {summary.total} outbound {summary.total === 1 ? "click" : "clicks"} logged locally
            {summary.wrapped ? " · " + summary.wrapped + " through an agent" : ""}.
          </p>
        ) : null}
      </div>
    </ModalShell>
  );
}

function ImportSheet({ items, hasSamples, onImport, onAddSamples, onClearSamples, onClose, onExport, onRestore }) {
  const [text, setText] = useState("");
  const fileRef = useRef(null);
  const importTextId = useId();

  const preview = useMemo(() => {
    if (!text.trim()) return null;
    const { candidates, provider } = parseImport(text);
    const fresh = candidates.filter((c) => !items.some((x) => itemMatchesCanonicalKey(x, c.key)));
    const dates = fresh.map((c) => c.createdAt).filter(Boolean);
    const oldest = dates.length ? Math.min(...dates) : null;
    return { candidates, fresh, dupes: candidates.length - fresh.length, provider, oldest };
  }, [text, items]);

  const readFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || "");
      // A Credenza backup restores directly; anything else feeds the paste parser.
      if (/\.json$/i.test(file.name)) {
        try {
          const arr = JSON.parse(content);
          if (Array.isArray(arr) && arr.length && arr[0] && (arr[0].canonicalKey || arr[0].rawText != null)) {
            onRestore(arr);
            return;
          }
        } catch (e) {}
      }
      setText((prev) => (prev ? prev + "\n" : "") + content);
    };
    reader.readAsText(file);
  };

  return (
    <ModalShell title="Import and backup" onClose={onClose} maxWidth={520}>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
          if (f) readFile(f);
        }}
        style={{ padding: "20px 22px 22px", fontFamily: FONT }}
      >
        <Caption style={{ color: BLUE, marginBottom: 10 }}>Import</Caption>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: INK,
            marginBottom: 4,
          }}
        >
          Bring the pile from wherever it lives.
        </div>
        <div style={{ fontSize: 13, color: SUB, lineHeight: 1.55, marginBottom: 14 }}>
          Credenza isn't another save button — it's where saves come back. Export from the
          tool you already use and drop the file here. Original dates and tags come along.
        </div>

        <label className="cz-field-label" htmlFor={importTextId} style={{ marginBottom: 6 }}>
          Paste links or notes
        </label>
        <textarea
          id={importTextId}
          className="cz-field"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"https://…\nhttps://…\nor any copied text with links inside"}
          rows={5}
          style={{
            width: "100%",
            boxSizing: "border-box",
            fontFamily: FONT,
            fontSize: 13,
            color: INK,
            background: BG,
            border: "1px solid " + HAIR,
            borderRadius: 10,
            resize: "vertical",
            lineHeight: 1.55,
            padding: "10px 12px",
          }}
        />
        <div style={{ marginTop: 8 }}>
          <button
            onClick={() => fileRef.current && fileRef.current.click()}
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
            …or choose a bookmarks file or a Credenza backup (.json)
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".html,.htm,.txt,.md,.csv,.json"
            onChange={(e) => readFile(e.target.files && e.target.files[0])}
            style={{ display: "none" }}
          />
        </div>

        {preview && (
          <div
            style={{
              marginTop: 14,
              background: BG,
              borderRadius: 0,
              padding: "12px 14px",
            }}
          >
            <div style={{ fontSize: 12.5, fontWeight: 600, color: INK, marginBottom: 8 }}>
              {preview.candidates.length === 0
                ? "No links or notes found yet."
                : (preview.provider !== "paste"
                    ? "Looks like a " + PROVIDER_LABELS[preview.provider] + " · "
                    : "") +
                  preview.fresh.length +
                  " found" +
                  (preview.dupes > 0 ? " · " + preview.dupes + " already on the shelf" : "") +
                  (preview.oldest &&
                  new Date(preview.oldest).getFullYear() < new Date().getFullYear()
                    ? " · back to " + new Date(preview.oldest).getFullYear()
                    : "")}
            </div>
            {preview.fresh.slice(0, 5).map((c, i) => (
              <div
                key={i}
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "3px 0" }}
              >
                <BrandIcon type={c.parsed.type} host={c.parsed.host} size={12} />
                <span
                  style={{
                    fontSize: 12.5,
                    color: SUB,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.titleHint || localTitle(c.parsed, c.rawText)}
                </span>
              </div>
            ))}
            {preview.fresh.length > 5 && (
              <div style={{ fontSize: 12, color: FAINT, marginTop: 4 }}>
                + {preview.fresh.length - 5} more
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <Pill
            primary
            disabled={!preview || preview.fresh.length === 0}
            onClick={() => onImport(text)}
          >
            {preview && preview.fresh.length > 0
              ? "Import " + preview.fresh.length
              : "Import"}
          </Pill>
          <Pill subtle onClick={onClose}>
            Cancel
          </Pill>
        </div>

        <div style={{ borderTop: "1px solid " + HAIR, marginTop: 18, paddingTop: 14 }}>
          <Caption style={{ marginBottom: 10 }}>More ways in</Caption>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "7px 0",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>Sample shelf</div>
              <div style={{ fontSize: 12, color: SUB }}>{SAMPLE_COUNT} cards to poke at. Easy to clear.</div>
            </div>
            {hasSamples ? (
              <Pill subtle onClick={onClearSamples}>
                Clear
              </Pill>
            ) : (
              <Pill onClick={onAddSamples}>Add</Pill>
            )}
          </div>
          {items.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>Backup</div>
                <div style={{ fontSize: 12, color: SUB }}>
                  Your shelf as a file you own. Restore it with the file picker above.
                </div>
              </div>
              <Pill onClick={onExport}>Download</Pill>
            </div>
          )}
          {IMPORT_PROVIDERS.filter(
            (p) => !["paste_list", "bookmark_file", "sample_shelf"].includes(p.id)
          ).map(
            (p) => (
              <div
                key={p.id}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0" }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{p.label}</div>
                  <div style={{ fontSize: 12, color: SUB, lineHeight: 1.45 }}>
                    {p.description}
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </ModalShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════════
// ═══ MAIN APP ═══
// ═══════════════════════════════════════════════════════════════════════════════════

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
  const [resurfaced, setResurfaced] = useState(null);
  const [digest, setDigest] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [agentSheetOpen, setAgentSheetOpen] = useState(false);
  // A2 money pipe: which buying agent Buy deep-links into. Soft default with a
  // visible "change anytime" path; persisted in credenza-prefs-v1. Stored item
  // links stay canonical forever — the agent wrap happens only at open time.
  const [preferredAgent, setPreferredAgent] = useState(DEFAULT_AGENT_ID);
  const [affiliateCodes, setAffiliateCodes] = useState({});
  // One-time "Opening in X" toast per agent; re-arms when the agent changes.
  const [agentToastSeenFor, setAgentToastSeenFor] = useState(null);
  const [viewMode, setViewMode] = useState("carousel");
  const [preferencesHydrated, setPreferencesHydrated] = useState(false);
  // "recent" = newest first (default). "starred" = only starred items.
  const [sortMode, setSortMode] = useState("recent");
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
    // Moonwalker black / Horizon ocean — matches the live field for iOS chrome.
    if (meta) meta.setAttribute("content", mode === "rainbow" ? "#000000" : "#003973");
  }, [mode]);
  // A waiting service worker (see preview/src/main.jsx) means a new build is
  // staged; swapping code mid-session is the user's call, not ours.
  useEffect(() => {
    const onUpdateReady = () =>
      notify("Update ready.", {
        actionLabel: "Restart",
        onAction: () => window.dispatchEvent(new CustomEvent("credenza:apply-update")),
        persistent: true,
      });
    window.addEventListener("credenza:update-ready", onUpdateReady);
    return () => window.removeEventListener("credenza:update-ready", onUpdateReady);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const captureRef = useRef(null);
  const searchRef = useRef(null);
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
            affiliateCodes,
            agentToastSeenFor,
          })
        )
        .catch(() => {});
  }, [preferencesHydrated, storageState.status, viewMode, sortMode, theme, preferredAgent, affiliateCodes, agentToastSeenFor]);

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
      setItems(it);
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
          // One-shot colorway migrate: land on Moonwalker dark once (Horizon light is
          // the other toggle). After that, Theme preference is sticky again.
          if (p.colorwayVersion !== 4) {
            setTheme("rainbow");
            storageBackend
              .set(
                "credenza-prefs-v1",
                JSON.stringify({
                  viewMode: p.viewMode || "carousel",
                  sortMode: p.sortMode === "starred" ? "starred" : "recent",
                  theme: "rainbow",
                  colorwayVersion: 4,
                  // Agent prefs survive the one-shot colorway rewrite.
                  preferredAgent: validStoredAgentId(p.preferredAgent),
                  affiliateCodes: p.affiliateCodes && typeof p.affiliateCodes === "object" ? p.affiliateCodes : {},
                  agentToastSeenFor: p.agentToastSeenFor || null,
                })
              )
              .catch(() => {});
          } else if (["light", "rainbow"].includes(p.theme)) {
            setTheme(p.theme);
          }
          // A2: agent prefs. Unknown/retired stored agents fall back to the
          // soft default rather than stranding Buy buttons.
          setPreferredAgent(validStoredAgentId(p.preferredAgent));
          if (p.affiliateCodes && typeof p.affiliateCodes === "object") setAffiliateCodes(p.affiliateCodes);
          if (p.agentToastSeenFor) setAgentToastSeenFor(p.agentToastSeenFor);
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

  const capture = () => {
    const result = stash(input);
    if (result.status !== "empty") {
      setInput("");
      beginIndexingJob(result);
    }
  };

  // One tap: read the clipboard and stash it directly. Browsers guard clipboard
  // reads, so every failure path guides the user somewhere useful — never a dead
  // button, never a vague shrug.
  const stashClipboard = async () => {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      captureRef.current && captureRef.current.focus();
      flashImportResult("This browser can't share the clipboard here — paste with ⌘V instead.");
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
      captureRef.current && captureRef.current.focus();
      flashImportResult(
        state === "denied"
          ? "Clipboard access is turned off for this site — turn it on next to the address bar, or paste with ⌘V."
          : "Clipboard needs a quick permission — allow it when your browser asks, or paste with ⌘V."
      );
      return;
    }
    if (!text || !text.trim()) {
      flashImportResult("Clipboard's empty.");
      return;
    }
    const result = stash(text);
    if (result.status === "stashed") {
      beginIndexingJob(result);
      flashImportResult("Stashed from the clipboard.");
    }
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

  const runImport = (text) => {
    const { candidates, provider } = parseImport(text);
    const { fresh, dupes, duplicates } = buildImportItems(candidates, items, provider);
    if (fresh.length) applyUpdate((list) => [...fresh, ...list]);
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
      flashImportResult(
        "Imported " +
          fresh.length +
          " " +
          (fresh.length === 1 ? "thing" : "things") +
          from +
          "." +
          (dupes > 0
            ? " " + dupes + " " + (dupes === 1 ? "was" : "were") + " already on the shelf."
            : ""),
        fresh.length >= 5 ? "digest" : null
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

  const downloadRecoveryData = () => {
    if (storageState.raw == null) return;
    downloadJson(
      storageState.raw,
      "credenza-recovery-" + new Date().toISOString().slice(0, 10) + ".json"
    );
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

  // ————— Notes, edits, opens, removal —————
  const saveNote = (id, note) => {
    updateItem(id, { note });
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
  };

  const saveEdit = (id, patch) => updateItem(id, patch);
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
  const removeImage = (id) => updateItem(id, { image: null });

  const attachGalleryImage = async (id, file) => {
    if (!file) return;
    try {
      const dataUrl = await compressImageBlob(file);
      updateItem(id, (x) => ({ gallery: [...(x.gallery || []), dataUrl].slice(0, 12) }));
    } catch (e) {
      flashImportResult("Couldn't read that gallery image.");
    }
  };
  const removeGalleryImage = (id, index) =>
    updateItem(id, (x) => ({ gallery: (x.gallery || []).filter((_, i) => i !== index) }));
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
      const res = await fetch(PREVIEW_ENDPOINT, {
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
      const res = await fetch(RESOLVE_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json", "x-credenza-key": PREVIEW_SECRET },
        body: JSON.stringify({ url: buyUrl }),
        signal: controller.signal,
      });
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
    const result = buildAgentUrl(preferredAgent, url, { referralOverrides: affiliateCodes });
    recordOutboundClick(storageBackend, {
      ts: Date.now(),
      agentId: result.agentId || preferredAgent,
      marketplace,
      wrapped: result.wrapped,
      item: hashItemId(item.id),
    });
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
    preferredAgentInfo && (preferredAgentInfo.urlTemplate || preferredAgentInfo.idPathTemplate)
      ? "Buy via " + preferredAgentInfo.name
      : "Buy";

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
    if (selectedId === id) {
      const fallback = items[index + 1] || items[index - 1] || null;
      setSelectedId(fallback ? fallback.id : null);
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

  const dismissResurfaced = () => {
    if (resurfaced) updateItem(resurfaced, { dismissedAt: Date.now() });
    setResurfaced(null);
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
    const controller = new AbortController();
    askControllerRef.current = controller;
    const timer = setTimeout(() => controller.abort(), 35000);
    setAskState({ status: "loading", query, answer: "", results: [], error: "" });

    try {
      const res = await fetch(ASK_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json", "x-credenza-key": PREVIEW_SECRET },
        body: JSON.stringify({ query, shelf }),
        signal: controller.signal,
      });
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
    const hauls = Array.from(map.values()).map((haul) => {
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
    return { hauls };
  }, [shelfAll]);

  // Chrome + the shelf surface's item filter key off this, not raw
  // `activeHaul` — while closing, `activeHaul` is already null but
  // `closingHaulName` keeps this set until the exit fade finishes, so the
  // carousel doesn't swap to the full unfiltered shelf mid-fade.
  const openHaulName = view === "hauls" ? activeHaul || closingHaulName : null;

  // When a haul is open (or closing), only its cards are on the shelf surface.
  const listItems = useMemo(() => {
    if (!openHaulName) return shelfItems;
    return shelfItems.filter(
      (item) => typeof item.project === "string" && item.project.trim() === openHaulName
    );
  }, [openHaulName, shelfItems]);

  const openHaul = useCallback((haulKey) => {
    setView("hauls");
    setViewMode("carousel");
    setExpandedId(null);
    setSelectedId(null);
    setActiveHaul(haulKey);
  }, []);

  // USD-normalized value for the total-cost reel: prefer the resolver's USD
  // conversion, fall back to the raw price only when it's already dollars.
  const itemUsd = useCallback((it) => {
    if (it.priceUsd != null && isFinite(it.priceUsd)) return it.priceUsd;
    if (it.price != null && isFinite(it.price) && (!it.currency || it.currency === "USD"))
      return it.price;
    return 0;
  }, []);
  const totalsItems = useMemo(() => {
    if (openHaulName) {
      return shelfItems.filter(
        (item) => typeof item.project === "string" && item.project.trim() === openHaulName
      );
    }
    return listItems;
  }, [openHaulName, shelfItems, listItems]);
  // Sums exactly what's on the surface — search matches, Starred-only filter,
  // or the open haul — so the counter recalculates organically.
  const listTotalUsd = useMemo(
    () => totalsItems.reduce((sum, it) => sum + itemUsd(it), 0),
    [totalsItems, itemUsd]
  );
  // Same context for the count chip — one consistent spot next to the total.
  const totalCountLabel = openHaulName
    ? totalsItems.length + (totalsItems.length === 1 ? " item" : " items")
    : q
      ? visible.length + " found"
      : shelfAll.length + " saved";

  const closeHaul = useCallback(() => {
    if (!activeHaul) return;
    // Reduced motion skips the fade entirely, so there's nothing to bridge.
    if (!reducedMotion) setClosingHaulName(activeHaul);
    setActiveHaul(null);
    setExpandedId(null);
    setSelectedId(null);
  }, [activeHaul, reducedMotion]);

  // Time buckets give the scroll a spine — default recent shelf only, not mid-search
  // and not while filtering to Starred-only or browsing a single haul.
  let sections = null;
  if (
    view === "shelf" &&
    toolbarActive &&
    sortMode !== "starred" &&
    !q &&
    listItems.length > 0
  ) {
    const now = Date.now();
    const wk = [];
    const mo = [];
    const old = [];
    for (const it of listItems) {
      const age = now - it.createdAt;
      (age < WEEK_MS ? wk : age < 30 * DAY_MS ? mo : old).push(it);
    }
    sections = [];
    if (wk.length) sections.push(["This week", wk]);
    if (mo.length) sections.push(["Earlier this month", mo]);
    if (old.length) sections.push(["Older", old]);
  }

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
  const removeRef = useRef(remove);
  removeRef.current = remove;
  kb.current = {
    shelfItems: listItems,
    selectedId,
    expandedId,
    digest,
    items,
    importOpen,
    agentSheetOpen,
    viewMode,
    view,
    activeHaul,
  };
  useEffect(() => {
    const isTyping = () => {
      const el = document.activeElement;
      return el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.isContentEditable);
    };
    const onKey = (e) => {
      if (e.defaultPrevented) return;
      // Let the full-screen photo gallery own its own keyboard navigation.
      if (document.querySelector('[role="dialog"][aria-label="Album photo preview"]')) return;
      const ctx = kb.current;
      if (e.metaKey || e.ctrlKey) {
        if (ctx.digest || ctx.importOpen || ctx.agentSheetOpen) return;
        if (e.key === "k") {
          e.preventDefault();
          searchRef.current && searchRef.current.focus();
        }
        return;
      }
      if (ctx.digest || ctx.importOpen || ctx.agentSheetOpen) return; // overlays handle their own keys
      if (isTyping()) {
        if (e.key === "Escape") document.activeElement.blur();
        return;
      }
      const list = ctx.shelfItems;
      const idx = list.findIndex((x) => x.id === ctx.selectedId);
      if (ctx.viewMode !== "carousel" && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
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
        if (ctx.viewMode !== "carousel" || list.length === 0) return -1;
        const foreground = document.querySelector(".cz-carousel-card[data-foreground='true']");
        const match = foreground && foreground.id.match(/^card-(.+)$/);
        const found = match ? list.findIndex((x) => x.id === match[1]) : -1;
        return found >= 0 ? found : 0;
      };

      // Carousel arrows are owned by CoverFlow's window listener (wrap/nudge +
      // unflip). Don't also step selection here — that double-fired and felt dead
      // at the ends. Non-carousel views still use Up/Down above.
      if (ctx.viewMode === "carousel" && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        return;
      }
      if (e.key === "Escape") {
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
        // Space / F flips the active card. Space again (or F again while open)
        // unflips — same as clicking the center card.
        if (e.key === " " || e.key === "Spacebar" || e.key === "f") {
          e.preventDefault();
          setSelectedId(sel.id);
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
          setExpandedId(sel.id);
          setEditRequest(sel.id + ":" + Date.now());
          return;
        }
        if (e.key === "Backspace" || e.key === "Delete") {
          e.preventDefault();
          removeRef.current(sel.id);
          return;
        }
      }
      if (e.key.length === 1 && /[\w]/.test(e.key)) {
        setSelectedId(null);
        captureRef.current && captureRef.current.focus();
      }
    };
    const onPaste = (e) => {
      if (kb.current.digest || kb.current.importOpen || kb.current.agentSheetOpen) return;
      if (e.defaultPrevented) return; // card-level image paste already took it
      // Image on the clipboard + an expanded card → attach it there, even when
      // focus sits on the document (keyboard-driven expand).
      const img = clipboardImageFile(e);
      if (img && kb.current.expandedId) {
        e.preventDefault();
        attachImageRef.current(kb.current.expandedId, img);
        return;
      }
      const el = document.activeElement;
      if (el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT")) return;
      const text = e.clipboardData && e.clipboardData.getData("text");
      if (text && text.trim()) {
        setInput(text.trim());
        captureRef.current && captureRef.current.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("paste", onPaste);
    };
  }, []);

  // Row in rows mode, full card when expanded (or in cards mode). Entrance style
  // rides the wrapper so both shapes animate identically.
  const renderEntry = (item) => {
    const inRows = viewMode === "rows";
    const rowActive = inRows && expandedId !== item.id;
    const cardActive = !inRows || expandedId === item.id;
    const collapseStyle = (active) => ({
      display: "grid",
      gridTemplateRows: active ? "1fr" : "0fr",
      transition: reduced ? "none" : "grid-template-rows 220ms " + EASE,
    });
    const collapseInnerStyle = (active) => ({
      minHeight: 0,
      overflow: "hidden",
      opacity: active ? 1 : 0,
      visibility: active ? "visible" : "hidden",
      pointerEvents: active ? "auto" : "none",
      transition: reduced
        ? "none"
        : active
          ? "opacity 180ms " + EASE + ", visibility 0s"
          : "opacity 160ms " + EASE + ", visibility 0s 220ms",
    });
    const card = (
      <Card
        item={item}
        expanded={expandedId === item.id}
        selected={selectedId === item.id}
        flipSignal={flipRequest}
        editSignal={editRequest}
        onToggle={() => {
          setExpandedId(expandedId === item.id ? null : item.id);
          setSelectedId(item.id);
        }}
        onDelete={remove}
        onSaveNote={saveNote}
        onSaveEdit={saveEdit}
        onOpen={recordOpen}
        onAttachImage={attachImage}
        onRemoveImage={removeImage}
        onAttachGalleryImage={attachGalleryImage}
        onRemoveGalleryImage={removeGalleryImage}
        onSetPrimaryImage={setPrimaryImage}
        onToggleFavorite={toggleFavorite}
        mode={mode}
        buyLabel={buyLabel}
      />
    );
    return (
      <div key={item.id}>
        {inRows ? (
          <>
            <div style={collapseStyle(rowActive)} aria-hidden={!rowActive}>
              <div style={collapseInnerStyle(rowActive)}>
                <Row
                  item={item}
                  selected={selectedId === item.id}
                  onClick={() => {
                    setExpandedId(item.id);
                    setSelectedId(item.id);
                  }}
                />
              </div>
            </div>
            <div style={collapseStyle(cardActive)} aria-hidden={!cardActive}>
              <div style={collapseInnerStyle(cardActive)}>{card}</div>
            </div>
          </>
        ) : (
          card
        )}
      </div>
    );
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

  // Any view/haul surface change forces cards face-up. Navigation wins.
  useEffect(() => {
    setExpandedId(null);
  }, [view, activeHaul, viewMode]);

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
        </div>
      )}
    </motion.section>
  );

  // Plain shelf surface — also doubles as the open-haul carousel/cards/rows
  // surface when view === "hauls" && activeHaul (branches internally on viewMode).
  // Only fades when it's standing in for the open-haul carousel inside the
  // Hauls-tab AnimatePresence above; plain Shelf-tab renders skip animation
  // entirely (initial={false}) so viewMode/tab switches stay instant.
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
      {/* Starred filter + view toggles only (category chips removed).
          Hidden inside an open haul — that view stays clean. */}
      {toolbarActive && !openHaulName && (
        <div
          className="cz-shelf-toolbar"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 6,
            marginBottom: 12,
          }}
        >
          <div
            className="cz-toolbar-end"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              position: "relative",
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              className={"cz-starred-filter" + (sortMode === "starred" ? " is-active" : "")}
              aria-pressed={sortMode === "starred"}
              aria-label={sortMode === "starred" ? "Show all items" : "Show starred only"}
              title={sortMode === "starred" ? "Show all" : "Starred only"}
              onClick={() => setSortMode(sortMode === "starred" ? "recent" : "starred")}
            >
              <Star
                aria-hidden="true"
                size={16}
                strokeWidth={2}
                fill={sortMode === "starred" ? "currentColor" : "none"}
              />
            </button>
            <span style={{ width: 1, height: 14, background: HAIR }} />
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
            <button
              type="button"
              className="cz-view-button"
              onClick={() => setViewMode("rows")}
              aria-label="Row view"
              aria-pressed={viewMode === "rows"}
              title="Rows"
              style={{
                fontFamily: FONT,
                fontSize: 12,
                color: viewMode === "rows" ? INK : FAINT,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "4px 2px",
              }}
            >
              ☰
            </button>
          </div>
        </div>
      )}

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
        items.length === 0 ? (
          <div className="cz-empty-shelf">
            <div className="cz-empty-shelf-title">
              Start with what you already saved.
            </div>
            <div className="cz-empty-shelf-copy">
              Export your pile, drop it in, and the shelf starts dealing it back.
            </div>
            <div className="cz-empty-shelf-actions">
              <Pill primary onClick={() => setImportOpen(true)}>
                Import your pile
              </Pill>
              <Pill onClick={addSamples}>Try a sample shelf</Pill>
              <Pill
                subtle
                onClick={() => captureRef.current && captureRef.current.focus()}
              >
                Stash a thought
              </Pill>
            </div>
            <div style={{ fontSize: 11.5, color: FAINT, lineHeight: 1.5 }}>
              Raindrop · Pocket · browser bookmarks · any CSV — original dates and
              tags come along.
            </div>
          </div>
        ) : (
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
                ? "Search includes titles, notes, projects, raw links, and paired Photos or Buy URLs."
                : sortMode === "starred"
                  ? "Star a card from the front face, then open Starred here."
                  : openHaulName
                    ? "Add cards from the shelf with ⋯ → Add to haul."
                    : "Paste a Yupoo or Weidian link above to start a haul."}
            </div>
            {(q || sortMode === "starred" || openHaulName) && (
              <Pill
                primary
                onClick={() => {
                  if (q) setSearch("");
                  else if (sortMode === "starred") setSortMode("recent");
                  else closeHaul();
                }}
              >
                {q
                  ? "Clear search"
                  : sortMode === "starred"
                    ? "Show all cards"
                    : "All hauls"}
              </Pill>
            )}
          </div>
        )
      ) : viewMode === "carousel" ? (
        <div className="cz-haul-open-stage">
          <CoverFlowCarousel
            items={listItems}
            expandedId={expandedId}
            selectedId={selectedId}
            flipRequest={flipRequest}
            editRequest={editRequest}
            haulNames={haulNames}
            onDelete={remove}
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
              setExpandedId(id);
            }}
            onDeactivate={() => setExpandedId(null)}
            onSelect={setSelectedId}
          />
        </div>
      ) : (
        <div
          className={viewMode === "cards" && !sections ? "cz-shelf-grid" : undefined}
          style={{
            display: viewMode === "cards" && !sections ? undefined : "flex",
            flexDirection: viewMode === "cards" && !sections ? undefined : "column",
            gap: viewMode === "rows" ? 6 : 10,
          }}
        >
          {sections
            ? sections.map(([label, arr], si) => (
                <div key={label} className="cz-time-section">
                  <Caption style={{ margin: (si === 0 ? "0" : "8px") + " 2px 0" }}>
                    {label}
                  </Caption>
                  <div
                    className={viewMode === "cards" ? "cz-time-section-grid" : undefined}
                    style={
                      viewMode === "rows"
                        ? { display: "flex", flexDirection: "column", gap: 6 }
                        : undefined
                    }
                  >
                    {arr.map(renderEntry)}
                  </div>
                </div>
              ))
            : listItems.map(renderEntry)}
        </div>
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
        // CSS color-scheme only accepts light|dark — "rainbow" is our prefs key.
        colorScheme: mode === "light" ? "dark" : "dark",
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
        <ImportSheet
          items={items}
          hasSamples={hasSamples}
          onImport={runImport}
          onAddSamples={addSamples}
          onClearSamples={clearSamples}
          onClose={() => setImportOpen(false)}
          onExport={exportShelf}
          onRestore={restoreBackup}
        />
      )}
      {agentSheetOpen && (
        <AgentSheet
          preferredAgent={preferredAgent}
          onSelectAgent={(id) => {
            const a = getAgent(id);
            if (a && !a.retired) setPreferredAgent(a.id);
          }}
          affiliateCodes={affiliateCodes}
          onAffiliateCodeChange={(agentId, code) =>
            setAffiliateCodes((prev) => ({ ...prev, [agentId]: code }))
          }
          storageBackend={storageBackend}
          onClose={() => setAgentSheetOpen(false)}
        />
      )}

      <div className="cz-shell">
        <div className="cz-masthead">
          <div className="cz-brand"><span className="cz-brand-mark">C</span> CREDENZA <span style={{ opacity: 0.65, fontWeight: 400 }}>Fashion</span></div>
        </div>

        <h1 className="cz-hero-title cz-title-balance">Organize the haul.</h1>
        <p style={{
          fontFamily: FONT,
          fontSize: 15,
          color: "var(--cz-ink)",
          marginTop: -12,
          marginBottom: 28,
          lineHeight: 1.5,
          opacity: 0.82,
        }}>
          Yupoo albums, Weidian buys, Reddit finds — one shelf for the whole haul.
        </p>

        {/* Capture — rounded shell matching the search bar. */}
        <div className="cz-capture-shell">
          <textarea
            ref={captureRef}
            className="cz-capture"
            aria-label="Stash a link or note"
            disabled={interactionLocked}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                capture();
                e.target.style.height = "auto";
              }
            }}
            placeholder="Paste a link or note…"
            rows={1}
          />
          <CapturePill
            hasInput={!!input.trim()}
            canStashTab={canStashTab}
            onCapture={capture}
            onStashTab={stashCurrentTab}
            onStashClipboard={stashClipboard}
            disabled={interactionLocked}
          />
        </div>

        {/* Search — quiet field; Clear morph only appears when there is text. */}
        <div className="cz-search-row">
          <div className={"cz-search-shell" + (search ? " has-clear" : "")}>
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
                if (e.key === "Escape") {
                  setSearch("");
                  e.target.blur();
                }
              }}
              placeholder="Search your shelf"
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

        {/* Shelf / Hauls / Inbox */}
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
                      style={{ width: Math.max(6, Math.min(100, job.progress)) + "%" }}
                    />
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Floating total-cost chip — same chrome always; only numbers/label text change.
            Count + label each fade in on their own key so a haul swap reads as a
            quiet text change, not a snap — matches cz-haul-open-head below. */}
        {view !== "inbox" && shelfAll.length > 0 && (
          <div className="cz-total-row">
            <span className="cz-total-count cz-fade-text-in" key={totalCountLabel}>
              {totalCountLabel}
            </span>
            <span className="cz-total-sep" aria-hidden="true">|</span>
            <span className="cz-total-chip" aria-live="polite">
              <span
                className="cz-total-chip-label cz-fade-text-in"
                key={openHaulName ? "haul" : "shelf"}
              >
                {openHaulName ? "Total Haul Cost" : "Total Shelf Cost"}
              </span>
              <ReelCounter value={listTotalUsd} />
            </span>
          </div>
        )}

        {/* Haul chrome lives here (not inside the surface swap) so it can fade in
            when a haul opens without hopping or re-skinning. */}
        {openHaulName ? (
          <div className="cz-haul-open-head" key={openHaulName}>
            <button type="button" className="cz-haul-back" onClick={closeHaul}>
              <ChevronLeft aria-hidden="true" size={18} strokeWidth={2.2} />
              All hauls
            </button>
            <h2 className="cz-haul-open-title">{openHaulName}</h2>
          </div>
        ) : null}

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
            <span className="cz-copy-pretty" style={{ flex: 1, fontSize: 13, lineHeight: 1.45 }}>
              {notification.message}
            </span>
            {notification.actionLabel && notification.onAction && (
              <Pill
                primary
                onClick={() => {
                  notification.onAction();
                  dismissNotification();
                }}
              >
                {notification.actionLabel}
              </Pill>
            )}
            <button
              type="button"
              className="cz-icon-button"
              aria-label="Dismiss notification"
              onClick={dismissNotification}
              style={{ width: 40, height: 40, border: 0, background: "transparent", color: "inherit", cursor: "pointer" }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Fixed bottom action bar — permanent, safe-area aware */}
      <div
        className="cz-bottom-bar"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 30,
          background: CARD,
          borderTop: "1px solid " + HAIR,
          // Safe-area lives on .cz-bottom-bar-inner (credenza.css) — don't double it.
        }}
      >
        <div className="cz-bottom-bar-inner">
          <span
            className="cz-local-label"
            title={localStatus.label}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11.5,
              fontWeight: 600,
              color: localStatus.color,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 3, background: localStatus.color, flexShrink: 0 }} />
            <span>{localStatus.label}</span>
          </span>
          <span style={{ flex: 1 }} />
          <MorphButton
            label="Theme"
            icon={Moon}
            activeIcon={Sun}
            onClick={() => setTheme(mode === "rainbow" ? "light" : "rainbow")}
            title={mode === "rainbow" ? "Switch to Horizon light" : "Switch to Moonwalker dark"}
            ariaLabel={mode === "rainbow" ? "Switch to light theme" : "Switch to rainbow theme"}
          />
          <Pill
            subtle
            onClick={() => setAgentSheetOpen(true)}
            title="Choose which buying agent Buy opens in"
          >
            {preferredAgentInfo && (preferredAgentInfo.urlTemplate || preferredAgentInfo.idPathTemplate)
              ? "Agent: " + preferredAgentInfo.name
              : "Agent: Direct"}
          </Pill>
          <Pill subtle onClick={() => setImportOpen(true)}>
            Import
          </Pill>
        </div>
      </div>
    </div>
  );
}
