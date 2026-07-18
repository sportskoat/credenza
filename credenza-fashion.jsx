import { useState, useEffect, useRef, useMemo, useId, forwardRef, useImperativeHandle, useCallback } from "react";
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
import "./credenza.css";
import "./credenza-fashion.css";

// ═══════════════════════════════════════════════════════════════════════════════════
// ═══ CONSTANTS & THEME (Studio) ═══
// ═══════════════════════════════════════════════════════════════════════════════════

// Theme-driven palette: components reference CSS variables; the app root sets them
// per theme. Two modes: light (deep violet, current default) and rainbow (dark
// base with a luminous rainbow arc across the top).
const PALETTES = {
  // Light variant: deep violet-black with hot-pink / cyan accents.
  light: {
    "--cz-bg": "#0d0818",
    "--cz-bg-elevated": "#130d22",
    "--cz-card": "rgba(26, 18, 48, 0.68)",
    "--cz-card-solid": "#1a1330",
    "--cz-hair": "rgba(255, 255, 255, 0.11)",
    "--cz-hair-strong": "rgba(255, 255, 255, 0.20)",
    "--cz-ink": "#f8f7ff",
    "--cz-sub": "#a8a5c2",
    "--cz-faint": "#716d8f",
    "--cz-seg": "rgba(255, 255, 255, 0.08)",
    "--cz-accent": "#ff38cc",
    "--cz-accent-bg": "rgba(255, 56, 204, 0.18)",
    "--cz-accent-deep": "#ff7ae8",
    "--cz-action-fill": "linear-gradient(135deg, #ff38cc 0%, #00f5ff 100%)",
    "--cz-action-text": "#050208",
    "--cz-action-muted-bg": "rgba(255, 56, 204, 0.14)",
    "--cz-action-muted-text": "#ff7ae8",
    "--cz-focus": "#ff38cc",
    "--cz-placeholder": "#716d8f",
    "--cz-selection": "rgba(255, 56, 204, 0.30)",
    "--cz-selection-text": "#f8f7ff",
    "--cz-error-bg": "rgba(255, 56, 204, 0.12)",
    "--cz-error-text": "#ff7ae8",
    "--cz-glow": "rgba(255, 56, 204, 0.45)",
    "--cz-glow-weak": "rgba(0, 245, 255, 0.18)",
    "--cz-gradient-1": "#ff38cc",
    "--cz-gradient-2": "#ff7ae8",
    "--cz-gradient-3": "#00f5ff",
  },
  // Rainbow variant: very dark base with a large luminous rainbow arc across the
  // top. Text stays white; accents pull from the arc (red → orange → yellow →
  // green → blue).
  rainbow: {
    "--cz-bg": "#05070a",
    "--cz-bg-elevated": "#080b14",
    "--cz-card": "rgba(10, 12, 22, 0.72)",
    "--cz-card-solid": "#0a0c16",
    "--cz-hair": "rgba(255, 255, 255, 0.10)",
    "--cz-hair-strong": "rgba(255, 255, 255, 0.18)",
    "--cz-ink": "#f8f9ff",
    "--cz-sub": "#a8adc2",
    "--cz-faint": "#6b7188",
    "--cz-seg": "rgba(255, 255, 255, 0.07)",
    "--cz-accent": "#00d4ff",
    "--cz-accent-bg": "rgba(0, 212, 255, 0.18)",
    "--cz-accent-deep": "#5ce1ff",
    "--cz-action-fill": "linear-gradient(135deg, #ff2d55 0%, #ff9500 50%, #00a8e8 100%)",
    "--cz-action-text": "#050208",
    "--cz-action-muted-bg": "rgba(0, 212, 255, 0.14)",
    "--cz-action-muted-text": "#5ce1ff",
    "--cz-focus": "#00d4ff",
    "--cz-placeholder": "#6b7188",
    "--cz-selection": "rgba(0, 212, 255, 0.30)",
    "--cz-selection-text": "#f8f9ff",
    "--cz-error-bg": "rgba(255, 45, 85, 0.12)",
    "--cz-error-text": "#ff5c7c",
    "--cz-glow": "rgba(0, 212, 255, 0.45)",
    "--cz-glow-weak": "rgba(255, 149, 0, 0.18)",
    "--cz-gradient-1": "#ff2d55",
    "--cz-gradient-2": "#ff9500",
    "--cz-gradient-3": "#00a8e8",
    "--cz-rainbow-red": "#ff2d55",
    "--cz-rainbow-orange": "#ff9500",
    "--cz-rainbow-yellow": "#ffcc00",
    "--cz-rainbow-green": "#34c759",
    "--cz-rainbow-blue": "#00a8e8",
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
  shoes: { label: "Shoes", dot: "#34C759" },
  outerwear: { label: "Outerwear", dot: "#AF52DE" },
  accessory: { label: "Accessories", dot: "#FF4500" },
  bag: { label: "Bags", dot: "#FFD60A" },
  hat: { label: "Hats", dot: "#64D2FF" },
  other: { label: "Other", dot: "#8E8E93" },
};

// "¥78 · $11.50" — original price with the resolver's USD conversion when known.
function priceLabel(item) {
  if (item.price == null) return "";
  const sym = item.currency === "CNY" ? "¥" : item.currency === "USD" ? "$" : item.currency + " ";
  let out = sym + item.price;
  if (item.priceUsd != null && item.currency !== "USD") {
    out += " · $" + (Number.isInteger(item.priceUsd) ? item.priceUsd : item.priceUsd.toFixed(2));
  }
  return out;
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
  if (item.url && isYupoo(item.url)) return item.url;
  for (const l of item.links || []) {
    if (l && l.url && isYupoo(l.url)) return l.url;
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
    const role = entry && typeof entry === "object" && ["photos", "buy", "alt"].includes(entry.role)
      ? entry.role
      : inferLinkRole(url);
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
  try {
    const path = new URL(url).pathname.replace(/\/+$/, "");
    const segs = path.split("/").filter(Boolean);
    for (let i = segs.length - 1; i >= 0; i--) {
      const t = prettifySlug(segs[i]);
      if (t && t.length > 3) return t.length > 72 ? t.slice(0, 69).trimEnd() + "…" : t;
    }
  } catch (e) {}
  return host || "Saved link";
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
    category: CATEGORIES[old.category] ? old.category : "",
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
  return /^(albums?|article|read|untitled|saved link|item)$/i.test(clean);
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

// Mouse-reactive holographic background. Multiple bright gradient blooms follow
// the cursor/touch, blended screen-style over a dark base. Keeps text readable
// by staying behind everything and using heavy blur + low opacity.
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
          radial-gradient(circle at ${x}% ${y}%, rgba(255, 0, 212, 0.28) 0%, transparent 42%),
          radial-gradient(circle at ${100 - x}% ${100 - y}%, rgba(0, 255, 255, 0.24) 0%, transparent 42%),
          radial-gradient(circle at ${y}% ${x}%, rgba(255, 140, 0, 0.20) 0%, transparent 46%),
          radial-gradient(circle at 50% 110%, rgba(120, 0, 255, 0.22) 0%, transparent 55%),
          radial-gradient(circle at 20% 20%, rgba(0, 120, 255, 0.14) 0%, transparent 35%)
        `,
        backgroundBlendMode: "screen",
        filter: "blur(70px)",
        opacity: 0.85,
      }}
    />
  );
}

// Luminous rainbow arc background. A large, soft gradient wave spans the top of
// the viewport (red → orange → yellow → green → blue) over a near-black base.
// Kept behind all content with heavy blur + low opacity so text stays readable.
function RainbowBackground() {
  const [phase, setPhase] = useState(0);
  const raf = useRef(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) return;
    let t = 0;
    const update = () => {
      t += 0.003;
      setPhase(t);
      raf.current = requestAnimationFrame(update);
    };
    raf.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf.current);
  }, [reduced]);

  const drift = Math.sin(phase) * 3;
  const drift2 = Math.cos(phase * 0.7) * 4;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        background: `
          radial-gradient(ellipse 130% 90% at ${50 + drift}% ${-10 + drift2}%,
            rgba(255, 45, 85, 0.55) 0%,
            rgba(255, 149, 0, 0.45) 18%,
            rgba(255, 204, 0, 0.38) 36%,
            rgba(52, 199, 89, 0.32) 54%,
            rgba(0, 168, 232, 0.28) 72%,
            transparent 92%
          ),
          radial-gradient(ellipse 100% 60% at 80% 10%, rgba(0, 212, 255, 0.18) 0%, transparent 60%),
          radial-gradient(ellipse 100% 60% at 20% 15%, rgba(255, 45, 85, 0.16) 0%, transparent 55%),
          radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.04) 0%, transparent 50%),
          #05070a
        `,
        filter: "blur(60px)",
        opacity: 0.9,
      }}
    />
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
  return (
    <div
      className="cz-cover-placeholder"
      aria-hidden="true"
      style={{
        width: "100%",
        aspectRatio,
        maxHeight,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
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
      <CoverIcon item={item} size={48} />
    </div>
  );
}

// Shared cover image: handles broken/missing images and renders a category-aware placeholder.
function CoverImage({ item, aspectRatio = "4/5", maxHeight = 320, className, style, imgStyle }) {
  const [imgOk, setImgOk] = useState(true);
  const imageSrc = item.image || (item.videoId ? "https://i.ytimg.com/vi/" + item.videoId + "/hqdefault.jpg" : null);

  useEffect(() => {
    setImgOk(true);
  }, [imageSrc]);

  if (!imageSrc || !imgOk) {
    return (
      <CoverPlaceholder
        item={item}
        aspectRatio={aspectRatio}
        maxHeight={maxHeight}
        style={style}
      />
    );
  }

  return (
    <img
      className={className}
      src={imageSrc}
      alt=""
      onError={() => setImgOk(false)}
      style={{
        width: "100%",
        aspectRatio,
        maxHeight,
        objectFit: "cover",
        display: "block",
        ...imgStyle,
      }}
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
          style={{ width: 40, height: 40, objectFit: "cover", flexShrink: 0, display: "block" }}
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

function Field({ label, value, onChange, placeholder, rows }) {
  const id = useId();
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

// ═══════════════════════════════════════════════════════════════════════════════════
// ═══ COMPONENTS ═══
// ═══════════════════════════════════════════════════════════════════════════════════

// Open-button list for a card: primary URL first (labeled by its role), then each
// paired link. Colliding labels get numbered so two "Alt" buttons stay tellable.
const LINK_ROLE_LABELS = { photos: "Photos", buy: "Buy", alt: "Alt" };
function linkButtons(item) {
  const btns = [];
  function labelFor(url, role) {
    if (role === "alt") return "Open";
    // A Yupoo album link is surfaced by the Photos orbit; label it Album so the
    // back face doesn't show two Photos buttons.
    if (role === "photos" && /yupoo\.com/i.test(url || "")) return "Album";
    return LINK_ROLE_LABELS[role] || "Alt";
  }
  if (item.url) {
    const role = inferLinkRole(item.url);
    btns.push({ url: item.url, role, label: labelFor(item.url, role) });
  }
  for (const l of item.links || []) {
    if (l && l.url) btns.push({ url: l.url, role: l.role, label: labelFor(l.url, l.role) });
  }
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

function Card({ item, expanded, selected, onToggle, onDelete, onSaveNote, onSaveEdit, onOpen, onAttachImage, onRemoveImage, onAttachGalleryImage, onRemoveGalleryImage, onSetPrimaryImage, featured, flipSignal, editSignal, mode }) {
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
              marginBottom: item.summary || item.seller || item.batch ? 6 : 0,
            }}
          >
            {item.title}
          </div>
          {(item.seller || item.batch) && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: item.summary ? 6 : 0 }}>
              {item.seller && (
                <span style={{ fontFamily: MONO, fontSize: 11, color: SUB, letterSpacing: "0.02em" }}>
                  {item.seller}
                </span>
              )}
              {item.batch && (
                <span style={{ fontFamily: MONO, fontSize: 11, color: SUB, letterSpacing: "0.02em" }}>
                  {item.batch}
                </span>
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
            {(item.findStatus !== "want" || item.price != null || item.seller || item.batch || item.size || item.colorway || item.agentLink || CATEGORIES[item.category] || sizeRunLabel(item)) && (
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
                {item.seller && <span>{item.seller}</span>}
                {item.batch && <span>{item.batch}</span>}
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
                {item.agentLink && (
                  <Pill subtle onClick={() => onOpen(item, item.agentLink)}>Agent</Pill>
                )}
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
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {linkButtons(item).map((btn, i) => (
                <Pill key={btn.url} primary={i === 0} onClick={() => onOpen(item, btn.url)}>
                  {btn.label}
                </Pill>
              ))}
              <Pill onClick={() => { setAnimateFlip(true); setFlipped(true); }}>Flip</Pill>
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
            label="Summary"
            value={ed.summary}
            onChange={(v) => setEd({ ...ed, summary: v })}
            placeholder="A short reminder"
            rows={2}
          />
          <Field
            label="Tags"
            value={ed.tags}
            onChange={(v) => setEd({ ...ed, tags: v })}
            placeholder="Separated by commas"
          />
          <Field
            label="Project / haul"
            value={ed.project}
            onChange={(v) => setEd({ ...ed, project: v })}
            placeholder="e.g., Summer haul"
          />
          <Field
            label="Agent link"
            value={ed.agentLink}
            onChange={(v) => setEd({ ...ed, agentLink: v })}
            placeholder="https://..."
          />
          <Field
            label="Source Reddit post"
            value={ed.findSource}
            onChange={(v) => setEd({ ...ed, findSource: v })}
            placeholder="https://reddit.com/r/..."
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
              <Field label="Size" value={ed.size} onChange={(v) => setEd({ ...ed, size: v })} placeholder="EU 42" />
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
          <Field
            label="Paired links"
            value={ed.linksText}
            onChange={(v) => setEd({ ...ed, linksText: v })}
            placeholder="One URL per line"
            rows={2}
          />
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
                      style={{ width: "100%", height: "100%", objectFit: "cover", border: "1px solid " + HAIR }}
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
        onChange={(e) => setDraft(e.target.value)}
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
        <Pill subtle onClick={() => { setAnimateFlip(true); setFlipped(false); }}>
          Flip back
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
  const facts = [
    ["Selected", item.size],
    ["Poster wore", item.posterSize],
    ["Recommended", item.recommendedSize],
    ["Available", sizeRunLabel(item)],
  ].filter(([, value]) => value);
  const axes = (item.variants || []).filter(
    (group) => group && group.title && Array.isArray(group.values) && group.values.length
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

const CarouselCard = forwardRef(function CarouselCard(
  {
    item,
    expanded,
    selected,
    isCenter,
    flipSignal,
    editSignal,
    onDelete,
    onSaveEdit,
    onOpen,
    onSetPrimaryImage,
    onOpenPhotos,
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
  const [bubble, setBubble] = useState(null);
  const bubbleRef = useRef(null);
  const innerRef = useRef(null);

  useImperativeHandle(ref, () => innerRef.current);

  useEffect(() => {
    setFlipped(Boolean(expanded));
    if (!expanded) {
      setEditing(false);
      setBubble(null);
    }
  }, [expanded]);

  useEffect(() => {
    if (bubble && bubbleRef.current) {
      bubbleRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [bubble]);

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
      });
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

  const openBubble = (key, title, content) => {
    setBubble({ key, title, content });
  };

  const saveEdit = () => {
    if (!ed) return;
    onSaveEdit(item.id, {
      title: ed.title,
      summary: ed.summary,
      tags: ed.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 5),
      project: ed.project,
      importance: ed.importance,
      linksText: ed.linksText,
      findStatus: ed.findStatus,
      category: ed.category,
      price: ed.price === "" ? null : Number(ed.price),
      currency: ed.currency,
      seller: ed.seller,
      batch: ed.batch,
      size: ed.size,
      colorway: ed.colorway,
      agentLink: ed.agentLink,
      findSource: ed.findSource,
    });
    setEditing(false);
    setEd(null);
  };

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
    });
    setEditing(true);
  };

  return (
    <div
      className="cz-carousel-card"
      id={"card-" + item.id}
      ref={innerRef}
      role="option"
      aria-current={selected ? "true" : undefined}
      aria-selected={selected ? "true" : "false"}
    >
      <div
        className={"cz-carousel-card-inner" + (flipped ? " is-flipped" : "")}
        style={{
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          transition: !reduced ? "transform 420ms " + EASE : "none",
        }}
      >
        {/* Front face */}
        <div
          className="cz-carousel-face cz-carousel-front"
          role="button"
          tabIndex={0}
          aria-label="Flip card"
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
              aspectRatio="4/5"
              className="cz-carousel-image"
              imgStyle={{ borderRadius: 0 }}
            />
            {item.findStatus !== "want" && (
              <span className="cz-carousel-status">{item.findStatus}</span>
            )}
            {item.price != null && (
              <span className="cz-carousel-price">
                {priceLabel(item)}
              </span>
            )}
          </div>
          <div className="cz-carousel-front-meta">
            <div className="cz-carousel-type">
              <BrandIcon type={item.type} host={item.host} size={12} />
              <span>{(TYPES[item.type] || TYPES.note).label}</span>
            </div>
            <h3 className="cz-carousel-title">{item.title}</h3>
            {(item.seller || item.batch || item.size) && (
              <div className="cz-carousel-sub">
                {[item.seller, item.batch, item.size].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>
        </div>

        {/* Back face: click empty space to close bubble, or flip back if no bubble */}
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- empty-area dismissal on a visual card; keyboard users use the explicit close button */}
        <div
          className="cz-carousel-face cz-carousel-back"
          onClick={(e) => {
            const carousel = e.currentTarget.closest(".cz-carousel");
            if (carousel && carousel.dataset.dragging === "true") {
              delete carousel.dataset.dragging;
              return;
            }
            const interactive = e.target.closest(
              "button, a, input, textarea, .cz-info-bubble, [role='button']"
            );
            if (interactive) return;
            e.stopPropagation();
            if (bubble) setBubble(null);
            else deactivate();
          }}
        >
          <button
            type="button"
            className="cz-carousel-close"
            onClick={(e) => {
              e.stopPropagation();
              deactivate();
            }}
            aria-label="Flip back"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
          </button>

          {editing && ed ? (
            <div className="cz-carousel-edit">
              <Field label="Title" value={ed.title} onChange={(v) => setEd({ ...ed, title: v })} placeholder="Name this card" />
              <Field label="Summary" value={ed.summary} onChange={(v) => setEd({ ...ed, summary: v })} placeholder="A short reminder" rows={2} />
              <Field label="Tags" value={ed.tags} onChange={(v) => setEd({ ...ed, tags: v })} placeholder="Separated by commas" />
              <Field label="Project / haul" value={ed.project} onChange={(v) => setEd({ ...ed, project: v })} placeholder="e.g., Summer haul" />
              <Field label="Agent link" value={ed.agentLink} onChange={(v) => setEd({ ...ed, agentLink: v })} placeholder="https://..." />
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <Field label="Price" value={ed.price} onChange={(v) => setEd({ ...ed, price: v })} placeholder="0" />
                </div>
                <div style={{ width: 90 }}>
                  <Field label="Currency" value={ed.currency} onChange={(v) => setEd({ ...ed, currency: v })} placeholder="CNY" />
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
                  <Field label="Size" value={ed.size} onChange={(v) => setEd({ ...ed, size: v })} placeholder="EU 42" />
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="Colorway" value={ed.colorway} onChange={(v) => setEd({ ...ed, colorway: v })} placeholder="Black/white" />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <Pill primary onClick={saveEdit}>
                  Save
                </Pill>
                <Pill subtle onClick={() => { setEditing(false); setEd(null); }}>
                  Cancel
                </Pill>
              </div>
            </div>
          ) : (
            <div className="cz-carousel-back-content">
              <h3 className="cz-carousel-back-title">{item.title}</h3>

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
                    <span>
                      {priceLabel(item)}
                    </span>
                  </div>
                )}
                {item.seller && (
                  <div>
                    <span>Seller</span>
                    <span>{item.seller}</span>
                  </div>
                )}
                {item.batch && (
                  <div>
                    <span>Batch</span>
                    <span>{item.batch}</span>
                  </div>
                )}
                {item.size && (
                  <div>
                    <span>Size</span>
                    <span>{item.size}</span>
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

              {item.note && (
                <div className="cz-carousel-note">
                  <span>Note</span>
                  <p>{item.note}</p>
                </div>
              )}

              {(item.gallery || []).length > 0 && (
                <div className="cz-carousel-gallery">
                  {(item.gallery || []).map((src, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => onSetPrimaryImage(item.id, src)}
                      title="Set as primary image"
                    >
                      <img src={src} alt={"Gallery image " + (idx + 1)} />
                    </button>
                  ))}
                </div>
              )}

              <div className="cz-carousel-actions">
                {linkButtons(item)
                  .filter((button) => button.role !== "photos")
                  .map((button, index) => (
                    <button
                      key={button.url + index}
                      type="button"
                      className={"cz-carousel-action-btn" + (button.role === "buy" ? " primary" : "")}
                      onClick={() => onOpen(item, button.url)}
                    >
                      {button.label}
                    </button>
                  ))}
                <button
                  type="button"
                  className="cz-carousel-action-btn"
                  onClick={(event) => {
                    if (!yupooAlbumUrl(item) && !(item.gallery || []).length && !item.image) {
                      openBubble("photos", "Photos", "No gallery or Yupoo album yet.");
                      return;
                    }
                    if (onOpenPhotos) onOpenPhotos(item, event.currentTarget);
                  }}
                >
                  Photos
                </button>
                <button
                  type="button"
                  className="cz-carousel-action-btn"
                  onClick={() =>
                    openBubble("sizes", "Size info", <CarouselSizeInfo item={item} />)
                  }
                >
                  Sizes
                </button>
                <button
                  type="button"
                  className="cz-carousel-action-btn"
                  onClick={() =>
                    openBubble(
                      "seller",
                      "Seller",
                      item.seller ? item.seller : "No seller set."
                    )
                  }
                >
                  Seller
                </button>
                {item.agentLink && (
                  <button
                    type="button"
                    className="cz-carousel-action-btn"
                    onClick={() => onOpen(item, item.agentLink)}
                  >
                    Agent
                  </button>
                )}
                <button type="button" className="cz-carousel-action-btn" onClick={startEdit}>
                  Edit
                </button>
                <button
                  type="button"
                  className="cz-carousel-action-btn danger"
                  onClick={() => onDelete(item.id)}
                >
                  Remove
                </button>
              </div>

              {bubble && (
                <div ref={bubbleRef}>
                  <InfoBubble title={bubble.title} onClose={() => setBubble(null)}>
                    {bubble.content}
                  </InfoBubble>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
function CarouselView({
  items,
  expandedId,
  selectedId,
  flipRequest,
  editRequest,
  onDelete,
  onSaveEdit,
  onOpen,
  onSetPrimaryImage,
  onLoadPhotos,
  onActivate,
  onDeactivate,
  onSelect,
}) {
  const stageRef = useRef(null);
  const containerRef = useRef(null);
  const trackRef = useRef(null);
  const cardRefs = useRef([]);
  const metricsRef = useRef({ centers: [], widths: [], containerWidth: 0 });
  const foregroundRef = useRef(0);
  const programmaticTargetRef = useRef(null);
  const wheelActiveRef = useRef(false);
  const scrollRafRef = useRef(null);
  const settleTimerRef = useRef(null);
  const [foregroundIndex, setForegroundIndex] = useState(0);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [orbit, setOrbit] = useState(null);
  const orbitRef = useRef(null);
  const orbitRequestRef = useRef(null);
  const orbitTriggerRef = useRef(null);
  const reduced = usePrefersReducedMotion();

  orbitRef.current = orbit;

  const closeOrbit = useCallback((restoreFocus = true) => {
    if (orbitRequestRef.current) orbitRequestRef.current.abort();
    orbitRequestRef.current = null;
    setOrbit(null);
    if (restoreFocus) {
      requestAnimationFrame(() => orbitTriggerRef.current?.focus());
    }
  }, []);

  const openPhotos = useCallback(async (item, trigger) => {
    closeOrbit(false);
    orbitTriggerRef.current = trigger || null;
    const seed = mergeFashionImages(item.image ? [item.image] : [], item.gallery || []).slice(0, 8);
    const shouldLoad = !!yupooAlbumUrl(item) && seed.length < 8 && !!onLoadPhotos;
    setOrbit({ itemId: item.id, images: seed, loading: shouldLoad, previewIndex: null });
    if (!shouldLoad) return;

    const controller = new AbortController();
    orbitRequestRef.current = controller;
    const images = await onLoadPhotos(item, { signal: controller.signal });
    if (controller.signal.aborted || orbitRequestRef.current !== controller) return;
    orbitRequestRef.current = null;
    setOrbit((current) =>
      current && current.itemId === item.id
        ? { ...current, images: mergeFashionImages(images || [], current.images).slice(0, 8), loading: false }
        : current
    );
  }, [closeOrbit, onLoadPhotos]);

  const setForeground = useCallback((index) => {
    const next = Math.max(0, Math.min(items.length - 1, index));
    if (!Number.isFinite(next) || foregroundRef.current === next) return next;
    foregroundRef.current = next;
    setForegroundIndex(next);
    return next;
  }, [items.length]);

  // Read layout geometry, never projected/transformed geometry. Negative margins
  // remain part of offsetLeft, so the intentional card overlap is measured exactly.
  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const centers = [];
    const widths = [];
    for (const card of cardRefs.current) {
      if (!card) {
        centers.push(0);
        widths.push(0);
        continue;
      }
      const width = card.offsetWidth;
      centers.push(card.offsetLeft + width / 2);
      widths.push(width);
    }
    metricsRef.current = { centers, widths, containerWidth: container.clientWidth };
  }, []);

  const nearestIndex = useCallback(() => {
    const container = containerRef.current;
    const { centers, containerWidth } = metricsRef.current;
    if (!container || centers.length === 0) return 0;
    const scrollCenter = container.scrollLeft + containerWidth / 2;
    return findNearestCarouselIndex(centers, scrollCenter);
  }, []);

  const updateCards = useCallback(() => {
    const container = containerRef.current;
    const cards = cardRefs.current;
    const { centers, widths, containerWidth } = metricsRef.current;
    if (!container || cards.length === 0 || centers.length === 0) return;

    const scrollCenter = container.scrollLeft + containerWidth / 2;
    let foreground = programmaticTargetRef.current;
    if (foreground == null) {
      foreground = carouselForegroundWithHysteresis(
        centers,
        foregroundRef.current,
        scrollCenter
      );
      if (foreground !== foregroundRef.current) setForeground(foreground);
    }

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      if (!card) continue;
      const px = scrollCenter - centers[i];
      const dist = Math.abs(px);
      const isForeground = i === foreground;
      // The right-hand card loses exact-distance ties, preventing paint-order
      // oscillation when two overlapped cards straddle the midpoint.
      const zIndex = carouselLayerZ(cards.length, i, foreground);

      card.dataset.foreground = String(isForeground);
      card.setAttribute("aria-selected", String(isForeground));
      card.style.zIndex = String(zIndex);
      card.style.opacity = "1";
      card.style.setProperty("--cz-card-side", String(Math.min(1, dist / Math.max(widths[i] || 1, 1))));

      if (reduced) {
        card.style.transform = "none";
        card.style.transformOrigin = "center center";
        continue;
      }

      const maxRotateDeg = 11;
      const rotateDeg = Math.max(-maxRotateDeg, Math.min(maxRotateDeg, -px * 0.023));
      const frontEdgeZ = ((widths[i] || 0) / 2) * Math.sin(Math.abs(rotateDeg * Math.PI / 180));
      const z = -Math.min(dist * 0.1 + frontEdgeZ + (isForeground ? 0 : 5), 76);
      const scale = Math.max(0.915, 1 - dist * 0.00025);
      card.style.transformOrigin = "center center";
      card.style.transform =
        "translate3d(0,0," + z + "px) rotateY(" + rotateDeg + "deg) scale(" + scale + ")";
    }
  }, [reduced, setForeground]);

  const finishMovement = useCallback(() => {
    const container = containerRef.current;
    if (!container || items.length === 0 || wheelActiveRef.current) return;
    const index = nearestIndex();
    programmaticTargetRef.current = null;
    setForeground(index);
    container.classList.remove("is-moving", "is-dragging");
    container.style.scrollSnapType = "";
    container.style.scrollBehavior = "";
    container.style.cursor = "";
    updateCards();
    if (onSelect && items[index]) onSelect(items[index].id);
  }, [items, nearestIndex, onSelect, setForeground, updateCards]);

  const queueMovementEnd = useCallback((delay = 150) => {
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    settleTimerRef.current = setTimeout(() => {
      settleTimerRef.current = null;
      finishMovement();
    }, delay);
  }, [finishMovement]);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (orbitRef.current) closeOrbit(false);
    container.classList.add("is-moving");
    if (expandedId && programmaticTargetRef.current == null) {
      const { centers, containerWidth } = metricsRef.current;
      const current = foregroundRef.current;
      const center = container.scrollLeft + containerWidth / 2;
      if (centers[current] != null && Math.abs(center - centers[current]) > 10 && onDeactivate) {
        onDeactivate();
      }
    }
    if (scrollRafRef.current == null) {
      scrollRafRef.current = requestAnimationFrame(() => {
        scrollRafRef.current = null;
        updateCards();
      });
    }
    queueMovementEnd();
  }, [closeOrbit, expandedId, onDeactivate, queueMovementEnd, updateCards]);

  const scrollToIndex = useCallback((index, options = {}) => {
    const container = containerRef.current;
    if (!container || items.length === 0) return;
    if (metricsRef.current.centers.length !== items.length) measure();
    const target = Math.max(0, Math.min(items.length - 1, index));
    const center = metricsRef.current.centers[target];
    if (!Number.isFinite(center)) return;
    const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
    const left = Math.max(0, Math.min(maxScroll, center - container.clientWidth / 2));
    const behavior = options.behavior || (reduced ? "auto" : "smooth");

    if (expandedId && target !== foregroundRef.current && onDeactivate) onDeactivate();
    programmaticTargetRef.current = target;
    setForeground(target);
    container.classList.add("is-moving");
    container.scrollTo({ left, behavior });
    updateCards();

    if (behavior === "auto") finishMovement();
    else queueMovementEnd(220);
  }, [expandedId, finishMovement, items.length, measure, onDeactivate, queueMovementEnd, reduced, setForeground, updateCards]);

  useEffect(() => {
    cardRefs.current.length = items.length;
    measure();
    const selected = items.findIndex((item) => item.id === selectedId);
    const initial = selected >= 0 ? selected : Math.min(foregroundRef.current, items.length - 1);
    if (items.length > 0) scrollToIndex(Math.max(0, initial), { behavior: "auto" });
    return () => {
      if (scrollRafRef.current != null) cancelAnimationFrame(scrollRafRef.current);
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    };
    // Item content/order updates are handled by the selectedId effect below; this
    // mount path intentionally runs only when the number of rendered cards changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, measure]);

  useEffect(() => {
    const stage = stageRef.current;
    const container = containerRef.current;
    const track = trackRef.current;
    if (!container || typeof window === "undefined" || typeof window.ResizeObserver === "undefined") return;
    const observer = new window.ResizeObserver(() => {
      measure();
      updateCards();
      if (stage) setStageSize({ width: stage.clientWidth, height: stage.clientHeight });
    });
    if (stage) observer.observe(stage);
    observer.observe(container);
    if (track) observer.observe(track);
    return () => observer.disconnect();
  }, [measure, updateCards]);

  useEffect(() => {
    const index = items.findIndex((item) => item.id === selectedId);
    if (index >= 0 && index !== foregroundRef.current) scrollToIndex(index);
  }, [items, scrollToIndex, selectedId]);

  useEffect(() => {
    if (!orbit) return;
    const foregroundItem = items[foregroundIndex];
    if (!foregroundItem || foregroundItem.id !== orbit.itemId || expandedId !== orbit.itemId) {
      closeOrbit(false);
    }
  }, [closeOrbit, expandedId, foregroundIndex, items, orbit]);

  useEffect(() => {
    if (!orbit) return;
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (orbit.previewIndex != null) {
        setOrbit((current) => (current ? { ...current, previewIndex: null } : current));
      } else {
        closeOrbit();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeOrbit, orbit]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onScrollEnd = () => {
      if (!wheelActiveRef.current) finishMovement();
    };
    container.addEventListener("scrollend", onScrollEnd);
    return () => container.removeEventListener("scrollend", onScrollEnd);
  }, [finishMovement]);

  // Keep native wheel/trackpad movement, but suspend CSS snap while wheel events
  // are arriving. One deliberate settle runs after the gesture goes quiet, so the
  // browser cannot start a competing snap between tiny reverse-direction deltas.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let wheelEndTimer = null;
    const onWheel = (event) => {
      if (!event.shiftKey && Math.abs(event.deltaX) < Math.abs(event.deltaY)) return;
      wheelActiveRef.current = true;
      programmaticTargetRef.current = null;
      if (settleTimerRef.current) {
        clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }
      container.style.scrollSnapType = "none";
      container.style.scrollBehavior = "auto";
      container.scrollTo({ left: container.scrollLeft, behavior: "auto" });
      container.classList.add("is-moving");
      if (wheelEndTimer) clearTimeout(wheelEndTimer);
      wheelEndTimer = setTimeout(() => {
        wheelEndTimer = null;
        wheelActiveRef.current = false;
        container.style.scrollSnapType = "";
        container.style.scrollBehavior = "";
        scrollToIndex(nearestIndex());
      }, 110);
    };
    container.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      container.removeEventListener("wheel", onWheel);
      wheelActiveRef.current = false;
      if (wheelEndTimer) clearTimeout(wheelEndTimer);
    };
  }, [nearestIndex, scrollToIndex]);

  // Native trackpad/touch scrolling remains untouched. Pointer capture is used
  // only for mouse/pen dragging, and only after the gesture clears the threshold.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let pointerId = null;
    let startX = 0;
    let startScroll = 0;
    let latestScroll = 0;
    let dragging = false;
    let moveRaf = null;

    const interactiveTarget = (target) =>
      target && target.closest && target.closest("button, a, input, textarea, select, [role='button']");

    const restore = () => {
      if (moveRaf != null) {
        cancelAnimationFrame(moveRaf);
        moveRaf = null;
        container.scrollLeft = latestScroll;
      }
      const capturedPointer = pointerId;
      pointerId = null;
      if (capturedPointer != null && container.hasPointerCapture?.(capturedPointer)) {
        container.releasePointerCapture(capturedPointer);
      }
      container.style.scrollSnapType = "";
      container.style.scrollBehavior = "";
      container.style.cursor = "";
      container.classList.remove("is-dragging");
    };

    const onPointerDown = (event) => {
      if (event.pointerType === "touch") {
        programmaticTargetRef.current = null;
        if (settleTimerRef.current) {
          clearTimeout(settleTimerRef.current);
          settleTimerRef.current = null;
        }
        container.style.scrollBehavior = "auto";
        container.scrollTo({ left: container.scrollLeft, behavior: "auto" });
        return;
      }
      if ((event.pointerType !== "mouse" && event.pointerType !== "pen") || event.button !== 0) return;
      if (interactiveTarget(event.target)) return;
      pointerId = event.pointerId;
      startX = event.clientX;
      startScroll = container.scrollLeft;
      latestScroll = startScroll;
      dragging = false;
    };

    const onPointerMove = (event) => {
      if (event.pointerId !== pointerId) return;
      const dx = startX - event.clientX;
      if (!dragging && Math.abs(dx) <= 5) return;
      if (!dragging) {
        dragging = true;
        programmaticTargetRef.current = null;
        if (settleTimerRef.current) {
          clearTimeout(settleTimerRef.current);
          settleTimerRef.current = null;
        }
        container.setPointerCapture?.(pointerId);
        container.style.scrollSnapType = "none";
        container.style.scrollBehavior = "auto";
        container.style.cursor = "grabbing";
        container.classList.add("is-dragging", "is-moving");
        if (expandedId && onDeactivate) onDeactivate();
      }
      event.preventDefault();
      latestScroll = startScroll + dx;
      if (moveRaf == null) {
        moveRaf = requestAnimationFrame(() => {
          moveRaf = null;
          container.scrollLeft = latestScroll;
        });
      }
    };

    const endPointer = (event, cancelled = false) => {
      if (event.pointerId !== pointerId) return;
      const didDrag = dragging;
      restore();
      dragging = false;
      if (!didDrag) return;
      container.dataset.dragging = "true";
      setTimeout(() => delete container.dataset.dragging, 0);
      if (cancelled) finishMovement();
      else scrollToIndex(nearestIndex());
    };

    const onPointerUp = (event) => endPointer(event, false);
    const onPointerCancel = (event) => endPointer(event, true);

    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("pointermove", onPointerMove, { passive: false });
    container.addEventListener("pointerup", onPointerUp);
    container.addEventListener("pointercancel", onPointerCancel);
    container.addEventListener("lostpointercapture", onPointerCancel);
    return () => {
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerup", onPointerUp);
      container.removeEventListener("pointercancel", onPointerCancel);
      container.removeEventListener("lostpointercapture", onPointerCancel);
      if (moveRaf != null) cancelAnimationFrame(moveRaf);
    };
  }, [expandedId, finishMovement, nearestIndex, onDeactivate, scrollToIndex]);

  if (items.length === 0) {
    return (
      <div className="cz-carousel-empty">
        <div>No cards to flip through yet.</div>
      </div>
    );
  }

  const orbitWidth = stageSize.width || 720;
  const orbitHeight = stageSize.height || 560;
  const orbitPhotoSize = orbitWidth <= 480 ? 54 : 68;
  const orbitRadiusX = Math.max(72, Math.min(360, (orbitWidth - orbitPhotoSize - 24) / 2));
  const orbitRadiusY = Math.max(138, Math.min(228, (orbitHeight - orbitPhotoSize - 56) / 2));
  const previewImage =
    orbit && orbit.previewIndex != null ? orbit.images[orbit.previewIndex] : null;

  return (
    <div className="cz-carousel-stage" ref={stageRef}>
      <div
        className="cz-carousel"
        ref={containerRef}
        onScroll={handleScroll}
        onClick={(event) => {
          if (event.target !== event.currentTarget && !event.target.classList.contains("cz-carousel-track")) return;
          if (event.currentTarget.dataset.dragging === "true") {
            delete event.currentTarget.dataset.dragging;
            return;
          }
          if (onDeactivate) onDeactivate();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && expandedId) {
            event.preventDefault();
            if (onDeactivate) onDeactivate();
            return;
          }
          if (event.metaKey || event.ctrlKey || event.altKey) return;
          if (event.target && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            event.stopPropagation();
            scrollToIndex(foregroundRef.current + (event.key === "ArrowRight" ? 1 : -1));
          }
        }}
        tabIndex={0}
        role="listbox"
        aria-label="Card carousel"
      >
        <div className="cz-carousel-track" ref={trackRef}>
          {items.map((item, index) => (
            <CarouselCard
              key={item.id}
              ref={(element) => { cardRefs.current[index] = element; }}
              item={item}
              expanded={expandedId === item.id}
              selected={foregroundIndex === index}
              isCenter={foregroundIndex === index}
              flipSignal={flipRequest}
              editSignal={editRequest}
              onDelete={onDelete}
              onSaveEdit={onSaveEdit}
              onOpen={onOpen}
              onSetPrimaryImage={onSetPrimaryImage}
              onOpenPhotos={openPhotos}
              onActivate={onActivate}
              onDeactivate={onDeactivate}
              onScrollTo={(id) => {
                const target = items.findIndex((candidate) => candidate.id === id);
                if (target >= 0) scrollToIndex(target);
              }}
              reduced={reduced}
            />
          ))}
        </div>
      </div>

      {orbit && (
        <div className="cz-carousel-orbit" aria-label="Album photos">
          <button
            type="button"
            className="cz-carousel-orbit-close"
            onClick={() => closeOrbit()}
            aria-label="Close album photos"
          >
            ×
          </button>
          {orbit.images.map((src, index) => {
            const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(orbit.images.length, 1);
            const x = Math.cos(angle) * orbitRadiusX;
            const y = Math.sin(angle) * orbitRadiusY;
            return (
              <button
                key={src + index}
                type="button"
                className="cz-carousel-orbit-photo"
                style={{
                  "--orbit-x": x + "px",
                  "--orbit-y": y + "px",
                  "--orbit-delay": index * 35 + "ms",
                }}
                onClick={() => setOrbit((current) => (current ? { ...current, previewIndex: index } : current))}
                aria-label={"Preview album photo " + (index + 1)}
              >
                <img src={src} alt={"Album photo " + (index + 1)} draggable={false} />
              </button>
            );
          })}
          {orbit.loading && <div className="cz-carousel-orbit-loading">Loading album…</div>}
          {orbit.images.length === 0 && !orbit.loading && (
            <div className="cz-carousel-orbit-empty">No photos loaded.</div>
          )}
        </div>
      )}

      {orbit && previewImage && (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- backdrop click dismisses; dialog has explicit close and Escape support
        <div
          className="cz-photo-preview-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setOrbit((current) => (current ? { ...current, previewIndex: null } : current));
            }
          }}
        >
          <div className="cz-photo-preview" role="dialog" aria-modal="true" aria-label="Album photo preview">
            <button
              type="button"
              className="cz-photo-preview-close"
              onClick={() => setOrbit((current) => (current ? { ...current, previewIndex: null } : current))}
              aria-label="Close photo preview"
            >
              ×
            </button>
            <img src={previewImage} alt={"Album photo " + (orbit.previewIndex + 1)} />
            <div className="cz-photo-preview-controls">
              <button
                type="button"
                onClick={() =>
                  setOrbit((current) =>
                    current
                      ? {
                          ...current,
                          previewIndex:
                            (current.previewIndex - 1 + current.images.length) % current.images.length,
                        }
                      : current
                  )
                }
                aria-label="Previous photo"
              >
                ←
              </button>
              <span>{orbit.previewIndex + 1} / {orbit.images.length}</span>
              <button
                type="button"
                onClick={() =>
                  setOrbit((current) =>
                    current
                      ? { ...current, previewIndex: (current.previewIndex + 1) % current.images.length }
                      : current
                  )
                }
                aria-label="Next photo"
              >
                →
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => {
                  onSetPrimaryImage(orbit.itemId, previewImage);
                  closeOrbit();
                }}
              >
                Use as cover
              </button>
            </div>
          </div>
        </div>
      )}
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
  const [viewMode, setViewMode] = useState("carousel");
  const [preferencesHydrated, setPreferencesHydrated] = useState(false);
  const [sortMode, setSortMode] = useState("recent");
  const [typeFilter, setTypeFilter] = useState("all");
  const { notification, notify, dismiss: dismissNotification, pause: pauseNotification, resume: resumeNotification } = useNotification();
  const online = useOnlineStatus();
  const undoBatchRef = useRef([]);
  const undoExpiryRef = useRef(null);
  const [theme, setTheme] = useState(null);
  const mode = theme || "light";
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", mode === "rainbow" ? "#05070a" : "#0d0818");
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
      storageBackend.set("credenza-prefs-v1", JSON.stringify({ viewMode, sortMode, theme })).catch(() => {});
  }, [preferencesHydrated, storageState.status, viewMode, sortMode, theme]);

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
          if (["recent", "oldest", "importance", "unopened"].includes(p.sortMode))
            setSortMode(p.sortMode);
          if (["light", "rainbow"].includes(p.theme)) setTheme(p.theme);
        } catch (e) {}
      })
      .catch(() => {})
      .finally(() => setPreferencesHydrated(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ————— Capture: instant, local, never lost —————
  // Shared pipeline for the capture box and one-tap clipboard stash.
  const stash = (raw, extra) => {
    const text = (raw || "").trim();
    if (!text) return "empty";
    const parsed = classify(text);
    const key = canonicalKey(parsed, text);
    const dupItem = items.find((x) => itemMatchesCanonicalKey(x, key)) || null;
    if (dupItem) {
      notify("Already on the shelf: “" + dupItem.title + "” — refreshing it below.", { duration: DUPE_BANNER_MS });
      setExpandedId(dupItem.id);
      setSelectedId(dupItem.id);
      enrichFashionItem(dupItem);
      return "dupe";
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
    return "stashed";
  };

  const capture = () => {
    if (stash(input) !== "empty") setInput("");
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
    if (stash(text) === "stashed") flashImportResult("Stashed from the clipboard.");
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
      return {
        status: "ready",
        title:
          preserveTitle || (yupooAlbumUrl(item) && !data.translated)
            ? x.title
            : data.title,
        summary: data.summary || x.summary,
        price: data.priceCny != null ? data.priceCny : x.price,
        currency: "CNY",
        priceUsd: data.priceUsd != null ? data.priceUsd : x.priceUsd,
        category: CATEGORIES[data.category] ? data.category : x.category,
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
          const albumPatch = {
            url: item.url && yupooAlbumIdentity(item.url) ? canonicalAlbum : item.url,
            canonicalKey: canonicalKey(classify(canonicalAlbum), canonicalAlbum),
            title:
              data.title && shouldReplaceFashionTitle(item.title, item.url)
                ? data.title
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
    const url = targetUrl || item.url;
    if (url) window.open(url, "_blank", "noopener");
  };

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
      if (r === "stashed") flashImportResult("Stashed this tab.");
    });
  };

  // ————— Derived lists —————
  const inboxItems = useMemo(
    () => items.filter((x) => x.status === "enriching" || x.status === "failed"),
    [items]
  );
  const shelfAll = useMemo(() => items.filter((x) => x.status === "ready"), [items]);

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
        headers: { "content-type": "application/json" },
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

  // ————— Browsing gear: appears only once the shelf earns it —————
  const toolbarActive = shelfAll.length >= 6;
  // Filter rail runs on garment category. Uncategorized cards (notes, posts,
  // anything the resolver hasn't seen) live under "other" so every card stays
  // reachable from the rail.
  const itemCategory = (x) => (CATEGORIES[x.category] ? x.category : "other");
  const presentCategories = useMemo(
    () => Object.keys(CATEGORIES).filter((c) => shelfAll.some((x) => itemCategory(x) === c)),
    [shelfAll]
  );
  const typed =
    toolbarActive && typeFilter !== "all"
      ? visible.filter((x) => itemCategory(x) === typeFilter)
      : visible;
  const shelfItems = (() => {
    const a = [...typed];
    if (q) return a;
    if (!toolbarActive || sortMode === "recent") a.sort((x, y) => y.createdAt - x.createdAt);
    else if (sortMode === "oldest") a.sort((x, y) => x.createdAt - y.createdAt);
    else if (sortMode === "importance") {
      const rank = { high: 0, medium: 1, low: 2 };
      a.sort(
        (x, y) =>
          (rank[x.importance] ?? 1) - (rank[y.importance] ?? 1) || y.createdAt - x.createdAt
      );
    } else if (sortMode === "unopened")
      a.sort(
        (x, y) => (x.lastOpenedAt ? 1 : 0) - (y.lastOpenedAt ? 1 : 0) || y.createdAt - x.createdAt
      );
    return a;
  })();

  // Time buckets give the scroll a spine — recent sort only, and not mid-search.
  let sections = null;
  if (toolbarActive && sortMode === "recent" && !q && shelfItems.length > 0) {
    const now = Date.now();
    const wk = [];
    const mo = [];
    const old = [];
    for (const it of shelfItems) {
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
  kb.current = { shelfItems, selectedId, expandedId, digest, items, importOpen, viewMode };
  useEffect(() => {
    const isTyping = () => {
      const el = document.activeElement;
      return el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT");
    };
    const onKey = (e) => {
      if (e.defaultPrevented) return;
      const ctx = kb.current;
      if (e.metaKey || e.ctrlKey) {
        if (ctx.digest || ctx.importOpen) return;
        if (e.key === "k") {
          e.preventDefault();
          searchRef.current && searchRef.current.focus();
        }
        if (e.key === "d") {
          e.preventDefault();
          buildDigestRef.current();
        }
        return;
      }
      if (ctx.digest || ctx.importOpen) return; // overlays handle their own keys
      if (isTyping()) {
        if (e.key === "Escape") document.activeElement.blur();
        return;
      }
      const list = ctx.shelfItems;
      const idx = list.findIndex((x) => x.id === ctx.selectedId);
      if (ctx.viewMode !== "carousel" && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();
        if (list.length === 0) return;
        const nextIdx =
          e.key === "ArrowDown" ? Math.min(idx + 1, list.length - 1) : Math.max(idx - 1, 0);
        const id = list[nextIdx < 0 ? 0 : nextIdx].id;
        setSelectedId(id);
        const el = document.getElementById("card-" + id);
        if (el) el.scrollIntoView({ block: "nearest", behavior: "auto" });
        return;
      }
      if (e.key === "Escape") {
        setExpandedId(null);
        setSelectedId(null);
        return;
      }
      const sel = idx >= 0 ? list[idx] : null;
      if (sel) {
        if (e.key === "Enter" || e.key === "o") {
          e.preventDefault();
          recordOpenRef.current(sel);
          return;
        }
        if (e.key === "f") {
          e.preventDefault();
          setExpandedId(sel.id);
          setFlipRequest(sel.id + ":" + Date.now());
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
      if (kb.current.digest || kb.current.importOpen) return;
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
        mode={mode}
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

  const SORT_LABELS = {
    recent: "Recent",
    oldest: "Oldest",
    importance: "Importance",
    unopened: "Never opened",
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

  return (
    <div
      className="cz-app"
      data-theme={mode}
      data-fashion="true"
      style={{
        ...PALETTES[mode],
        colorScheme: mode,
        minHeight: "100vh",
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
            else if (url) window.open(url, "_blank", "noopener");
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

      <div className="cz-shell">
        <div className="cz-masthead">
          <div className="cz-brand"><span className="cz-brand-mark">C</span> CREDENZA <span style={{ opacity: 0.65, fontWeight: 400 }}>Fashion</span></div>
        </div>

        <h1 className="cz-hero-title cz-title-balance">Save the finds. Track the drip.</h1>
        <p style={{
          fontFamily: FONT,
          fontSize: 15,
          color: SUB,
          marginTop: -12,
          marginBottom: 28,
          lineHeight: 1.5,
        }}>
          Reddit W2Cs, Weidian links, QC photos — all in one place.
        </p>

        {/* Capture */}
        <div
          className="cz-capture-shell"
          style={{
            display: "flex",
            gap: 8,
            alignItems: "flex-end",
            background: CARD,
            border: "1px solid " + (mode === "dark" ? "rgba(243,244,246,0.20)" : "rgba(17,17,15,0.20)"),
            borderRadius: 0,
            padding: 10,
            marginBottom: 24,
            boxShadow: "0 10px 28px rgba(20,20,16,.055)",
          }}
        >
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
            placeholder="Paste a link, or write what you want to remember…"
            rows={1}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              resize: "none",
              color: INK,
              fontSize: 14,
              lineHeight: 1.45,
              fontFamily: FONT,
              padding: "7px 6px",
            }}
          />
          {input.trim() ? (
            <Pill primary disabled={interactionLocked} onClick={capture}>
              Stash
            </Pill>
          ) : canStashTab ? (
            <Pill disabled={interactionLocked} onClick={stashCurrentTab} title="Stash the page you're looking at">
              Stash this tab
            </Pill>
          ) : (
            <Pill disabled={interactionLocked} onClick={stashClipboard} title="Stash whatever's on the clipboard, one tap">
              Stash clipboard
            </Pill>
          )}
        </div>

        {/* Search — native-feeling field: filled, glyph, clear button, ⌘K badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 0,
          }}
        >
          <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center" }}>
            <svg
              viewBox="0 0 24 24"
              width={13}
              height={13}
              aria-hidden="true"
              style={{
                position: "absolute",
                left: 12,
                pointerEvents: "none",
                stroke: SUB,
                fill: "none",
                strokeWidth: 2.4,
                strokeLinecap: "round",
              }}
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20.5 20.5l-4.8-4.8" />
            </svg>
            <input
              className="cz-search-input"
              ref={searchRef}
              type="search"
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
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: SEG,
                border: "1px solid transparent",
                borderRadius: 999,
                color: INK,
                fontSize: 13.5,
                padding: "9px 40px 9px 33px",
                fontFamily: FONT,
              }}
            />
            {search ? (
              <button
                type="button"
                className="cz-icon-button"
                onClick={() => {
                  setSearch("");
                  searchRef.current && searchRef.current.focus();
                }}
                aria-label="Clear search"
                style={{
                  position: "absolute",
                  right: 2,
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  background: "transparent",
                  color: FAINT,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 14,
                  lineHeight: "40px",
                  padding: 0,
                  textAlign: "center",
                }}
              >
                ✕
              </button>
            ) : (
              <span
                style={{
                  position: "absolute",
                  right: 10,
                  fontFamily: FONT,
                  fontSize: 10.5,
                  color: FAINT,
                  border: "1px solid " + HAIR,
                  borderRadius: 999,
                  padding: "1px 5px",
                  pointerEvents: "none",
                }}
              >
                ⌘K
              </span>
            )}
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

        {/* Shelf / Inbox tabs — only when the inbox has something */}
        {inboxItems.length > 0 && (
          <div
            role="tablist"
            aria-label="Shelf views"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              borderBottom: "1px solid " + HAIR,
              marginBottom: 16,
            }}
          >
            {[
              ["shelf", "Shelf"],
              ["inbox", "Inbox · " + inboxItems.length],
            ].map(([key, label]) => (
              <button
                type="button"
                role="tab"
                className="cz-tab"
                key={key}
                id={"view-tab-" + key}
                aria-selected={view === key}
                aria-controls={"view-panel-" + key}
                onClick={() => setView(key)}
                style={{
                  fontFamily: FONT,
                  fontSize: 13,
                  fontWeight: view === key ? 650 : 500,
                  color: view === key ? INK : SUB,
                  background: "transparent",
                  border: "none",
                  borderBottom: view === key ? "2px solid " + BLUE : "2px solid transparent",
                  borderRadius: 0,
                  padding: "9px 0 11px",
                  marginBottom: -1,
                  cursor: "pointer",
                  transition: "color 150ms",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

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
        ) : (
          <section role="tabpanel" id="view-panel-shelf" aria-labelledby="view-tab-shelf">
            <div className="cz-section-head" style={{ justifyContent: "flex-end" }}>
              <span>{q ? visible.length + " found" : shelfAll.length + " saved"}</span>
            </div>
            {/* Browsing toolbar — hidden until the shelf has enough to browse */}
            {toolbarActive && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  flexWrap: "wrap",
                  marginBottom: 12,
                    }}
              >
                <FilterChip
                  active={typeFilter === "all"}
                  label="All"
                  onClick={() => setTypeFilter("all")}
                />
                {presentCategories.map((c) => (
                  <FilterChip
                    key={c}
                    active={typeFilter === c}
                    label={CATEGORIES[c].label}
                    dot={CATEGORIES[c].dot}
                    onClick={() => setTypeFilter(typeFilter === c ? "all" : c)}
                  />
                ))}
                <div
                  style={{
                    marginLeft: "auto",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    position: "relative",
                  }}
                >
                  <div
                    role="group"
                    aria-label="Sort shelf"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      background: SEG,
                      borderRadius: 999,
                      padding: 2,
                    }}
                  >
                    {Object.keys(SORT_LABELS).map((key) => (
                      <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={sortMode === key}
                        onClick={() => setSortMode(key)}
                        style={{
                          fontFamily: FONT,
                          fontSize: 11,
                          fontWeight: 600,
                          color: sortMode === key ? ACTION_TEXT : SUB,
                          background: sortMode === key ? ACTION_FILL : "transparent",
                          border: "none",
                          borderRadius: 999,
                          padding: "6px 10px",
                          cursor: "pointer",
                          transition: "color 150ms, background 150ms",
                        }}
                      >
                        {SORT_LABELS[key]}
                      </button>
                    ))}
                  </div>
                  <span style={{ width: 1, height: 14, background: HAIR }} />
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
            ) : shelfItems.length === 0 ? (
              items.length === 0 ? (
                <div
                  style={{
                    background: CARD,
                    border: "1px solid " + HAIR,
                    borderRadius: 0,
                    padding: "36px 28px 32px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: 17,
                      fontWeight: 700,
                      letterSpacing: "-0.02em",
                      color: INK,
                      marginBottom: 6,
                    }}
                  >
                    Start with what you already saved.
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: SUB,
                      lineHeight: 1.6,
                      maxWidth: 390,
                      margin: "0 auto 18px",
                    }}
                  >
                    Export your pile, drop it in, and the shelf starts dealing it back.
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      justifyContent: "center",
                      flexWrap: "wrap",
                      marginBottom: 16,
                    }}
                  >
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
                    {q ? "No matches for “" + search.trim() + "”." : "No " + (CATEGORIES[typeFilter]?.label.toLowerCase() || "matching") + " on the shelf yet."}
                  </div>
                  <div className="cz-copy-pretty" style={{ marginBottom: 14 }}>
                    {q
                      ? "Search includes titles, notes, projects, raw links, and paired Photos or Buy URLs."
                      : "The rest of the shelf is still here."}
                  </div>
                  <Pill
                    primary
                    onClick={() => {
                      if (q) setSearch("");
                      else setTypeFilter("all");
                    }}
                  >
                    {q ? "Clear search" : "Show all cards"}
                  </Pill>
                </div>
              )
            ) : viewMode === "carousel" ? (
              <CarouselView
                items={shelfItems}
                expandedId={expandedId}
                selectedId={selectedId}
                flipRequest={flipRequest}
                editRequest={editRequest}
                onDelete={remove}
                onSaveEdit={saveEdit}
                onOpen={recordOpen}
                onSetPrimaryImage={setPrimaryImage}
                onLoadPhotos={loadAlbumPhotos}
                onActivate={(id) => {
                  setSelectedId(id);
                  setExpandedId(id);
                }}
                onDeactivate={() => setExpandedId(null)}
                onSelect={setSelectedId}
              />
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
                  : shelfItems.map(renderEntry)}
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
          </section>
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
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 30,
          background: CARD,
          borderTop: "1px solid " + HAIR,
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
          <button
            type="button"
            className="cz-icon-button"
            onClick={() => setTheme(mode === "rainbow" ? "light" : "rainbow")}
            title={mode === "rainbow" ? "Switch to light" : "Switch to rainbow"}
            aria-label="Toggle rainbow theme"
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              background: SEG,
              color: SUB,
              border: "none",
              cursor: "pointer",
              fontSize: 14,
              lineHeight: "40px",
              padding: 0,
              textAlign: "center",
              fontFamily: FONT,
            }}
          >
            {mode === "rainbow" ? "☀" : "🌈"}
          </button>
          <Pill subtle onClick={() => setImportOpen(true)}>
            Import
          </Pill>
          <Pill
            onClick={buildDigest}
            disabled={shelfAll.length === 0}
            title={shelfAll.length > 0 ? "⌘D" : "Save a card to deal a digest"}
          >
            Digest
          </Pill>
        </div>
      </div>
    </div>
  );
}
