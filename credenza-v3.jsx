import { useState, useEffect, useRef, useMemo, useId } from "react";
import {
  createStorageBackend,
  loadStoredItems,
  saveStoredItems,
} from "./credenza-storage.js";
import {
  searchItems,
  selectAskCandidates,
  serializeAskCandidates,
} from "./credenza-search.js";
import "./credenza.css";

// ═══════════════════════════════════════════════════════════════════════════════════
// ═══ CONSTANTS & THEME (Studio) ═══
// ═══════════════════════════════════════════════════════════════════════════════════

// Theme-driven palette: components reference CSS variables; the app root sets them
// per theme. Light is Frost with more contrast; dark is its charcoal mirror.
const PALETTES = {
  light: {
    "--cz-bg": "#F4F4F0",
    "--cz-card": "#FFFFFF",
    "--cz-hair": "#DEDED8",
    "--cz-ink": "#11110F",
    "--cz-sub": "#62625C",
    "--cz-faint": "#707068",
    "--cz-seg": "#ECECE7",
    "--cz-accent": "#E2573E",
    "--cz-accent-bg": "#FFF0EA",
    "--cz-accent-deep": "#8A2E20",
    "--cz-action-fill": "#B6412E",
    "--cz-action-text": "#FFFFFF",
    "--cz-action-muted-bg": "#FCE7E0",
    "--cz-action-muted-text": "#7E2B20",
    "--cz-focus": "#A93A29",
    "--cz-placeholder": "#686860",
    "--cz-selection": "#F5CFC4",
    "--cz-selection-text": "#11110F",
    "--cz-error-bg": "#FCE7E0",
    "--cz-error-text": "#7E2B20",
  },
  dark: {
    "--cz-bg": "#0F1114",
    "--cz-card": "#1A1D22",
    "--cz-hair": "#2E323B",
    "--cz-ink": "#F3F4F6",
    "--cz-sub": "#A9B0BB",
    "--cz-faint": "#7D8692",
    "--cz-seg": "#262A31",
    "--cz-accent": "#2674C8",
    "--cz-accent-bg": "#16304C",
    "--cz-accent-deep": "#B7D8FF",
    "--cz-action-fill": "#2368B5",
    "--cz-action-text": "#FFFFFF",
    "--cz-action-muted-bg": "#193856",
    "--cz-action-muted-text": "#C2DDFF",
    "--cz-focus": "#78B5F8",
    "--cz-placeholder": "#A6AFBB",
    "--cz-selection": "#244F78",
    "--cz-selection-text": "#F3F4F6",
    "--cz-error-bg": "#4A2427",
    "--cz-error-text": "#FFD5D8",
  },
};

const BG = "var(--cz-bg)";
const CARD = "var(--cz-card)";
const HAIR = "var(--cz-hair)";
const INK = "var(--cz-ink)";
const SUB = "var(--cz-sub)";
const FAINT = "var(--cz-faint)";
const BLUE = "var(--cz-accent)";
const BLUE_BG = "var(--cz-accent-bg)";
const BLUE_DK = "var(--cz-accent-deep)";
const ACTION_FILL = "var(--cz-action-fill)";
const ACTION_TEXT = "var(--cz-action-text)";
const ACTION_MUTED_BG = "var(--cz-action-muted-bg)";
const ACTION_MUTED_TEXT = "var(--cz-action-muted-text)";
const SEG = "var(--cz-seg)";

const FONT = "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const DISPLAY = "Georgia, 'Iowan Old Style', 'Times New Roman', serif";

// Internal type keys are stable (match stored data); labels are display-only.
const TYPES = {
  video: { label: "Video", dot: "#FF9500" },
  tweet: { label: "Post", dot: "#5AC8FA" },
  audio: { label: "Audio", dot: "#AF52DE" },
  article: { label: "Read", dot: "#34C759" },
  note: { label: "Note", dot: "#8E8E93" },
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
    out.push({ url, role });
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

const STORE_KEY = "credenza-items-v3";
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
    links: pairedLinksFromRawText(rawText, parsed.url),
    status: "ready",
    note: "",
    extractedIntent: "",
    project: "",
    people: [],
    useCase: "",
    importance: "medium",
    lastOpenedAt: null,
    openCount: 0,
    resurfacedCount: 0,
    lastResurfacedAt: null,
    dismissedAt: null,
    digestCount: 0,
    lastDigestAt: null,
    sourceImport: null,
    error: null,
  };
  return extra ? { ...base, ...extra } : base;
}

// Paired-links migration. Field presence is the "already migrated" marker: an item
// carrying links (even []) is left alone, so a deliberately removed link doesn't
// resurrect from the note on next load. Legacy items infer links from rawText and
// additionally lift a buy URL out of the note (note text itself stays untouched).
function migrateLinks(old, primaryUrl, rawText) {
  if (Array.isArray(old.links)) return normalizeLinks(old.links, primaryUrl);
  const links = pairedLinksFromRawText(rawText, primaryUrl);
  for (const url of extractUrls(old.note || "")) {
    if (inferLinkRole(url) === "buy") links.push({ url, role: "buy" });
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
  const item = {
    id: old.id || makeId(),
    createdAt,
    updatedAt: old.updatedAt || createdAt,
    rawText,
    url: parsed.url,
    canonicalKey: old.canonicalKey || canonicalKey(parsed, rawText),
    type: parsed.type,
    host: parsed.host,
    videoId: parsed.videoId,
    title: old.title || "",
    summary: old.summary || "",
    tags: Array.isArray(old.tags) ? old.tags : [],
    image: typeof old.image === "string" && old.image.startsWith("data:image/") ? old.image : null,
    links: migrateLinks(old, parsed.url, rawText),
    status: "ready",
    note: old.note || "",
    extractedIntent: old.extractedIntent || "",
    project: old.project || "",
    people: Array.isArray(old.people) ? old.people : [],
    useCase: old.useCase || "",
    importance: old.importance === "high" || old.importance === "low" ? old.importance : "medium",
    lastOpenedAt: old.lastOpenedAt || null,
    openCount: old.openCount || 0,
    resurfacedCount: old.resurfacedCount || 0,
    lastResurfacedAt: old.lastResurfacedAt || null,
    dismissedAt: old.dismissedAt || null,
    digestCount: old.digestCount || 0,
    lastDigestAt: old.lastDigestAt || null,
    sourceImport: old.sourceImport || null,
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
  let dupes = 0;
  for (const c of candidates) {
    if (existing.some((x) => itemMatchesCanonicalKey(x, c.key))) {
      dupes++;
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
  return { fresh, dupes };
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
@font-face {
  font-family: 'Inter';
  src: url('/fonts/InterVariable.woff2') format('woff2');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}
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

function usePrefersDark() {
  const [dark, setDark] = useState(
    () =>
      typeof window !== "undefined" &&
      !!window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setDark(mq.matches);
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);
  return dark;
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
  if (item.url) {
    const role = inferLinkRole(item.url);
    btns.push({ url: item.url, label: role === "alt" ? "Open" : LINK_ROLE_LABELS[role] });
  }
  for (const l of item.links || []) {
    if (l && l.url) btns.push({ url: l.url, label: LINK_ROLE_LABELS[l.role] || "Alt" });
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

function Card({ item, expanded, selected, onToggle, onDelete, onSaveNote, onSaveEdit, onOpen, onAttachImage, onRemoveImage, featured, flipSignal, editSignal }) {
  const [imgOk, setImgOk] = useState(true);
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
  const noteId = useId();
  const reduced = usePrefersReducedMotion();

  const imageSrc =
    item.image ||
    (item.videoId ? "https://i.ytimg.com/vi/" + item.videoId + "/hqdefault.jpg" : null);

  // A failed YouTube thumb must not suppress a later manual/auto image.
  useEffect(() => {
    setImgOk(true);
  }, [imageSrc]);

  const attach = async (file) => {
    if (!file || imageBusy) return;
    setImageBusy(true);
    try {
      await onAttachImage(item.id, file);
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
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <TypeMark item={item} />
        {item.note && (
          <span style={{ width: 5, height: 5, borderRadius: 3, background: BLUE, opacity: 0.7 }} />
        )}
        <span style={{ marginLeft: "auto", fontFamily: FONT, fontSize: 11.5, color: FAINT }}>
          {(item.host ? item.host + " · " : "") + date}
        </span>
      </div>

      {imageSrc && imgOk && (
        <img
          className="cz-card-image"
          src={imageSrc}
          alt=""
          onError={() => setImgOk(false)}
          style={{
            width: "100%",
            aspectRatio: "16/9",
            maxHeight: 220,
            objectFit: "cover",
            borderRadius: 0,
            marginBottom: 10,
            display: "block",
            // Auto-fetched thumbs land seconds after the card — ease them in.
            animation: reduced ? undefined : "credenza-fade 300ms ease-out both",
          }}
        />
      )}

      {!editing && (
        <>
          <div
            style={{
              fontFamily: DISPLAY,
              fontSize: 18,
              fontWeight: 500,
              letterSpacing: "-0.035em",
              color: INK,
              lineHeight: 1.35,
              marginBottom: item.summary ? 3 : 0,
            }}
          >
            {item.title}
          </div>
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
            label="Project"
            value={ed.project}
            onChange={(v) => setEd({ ...ed, project: v })}
            placeholder="Optional"
          />
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
          <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
            <Pill
              primary
              onClick={() => {
                onSaveEdit(item.id, {
                  title: ed.title.trim() || item.title,
                  summary: ed.summary.trim(),
                  tags: ed.tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 5),
                  project: ed.project.trim(),
                  importance: ed.importance,
                  links: normalizeLinks(extractUrls(ed.linksText || ""), item.url),
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
            attach(file);
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
            attach(file);
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
  const [viewMode, setViewMode] = useState("cards");
  const [sortMode, setSortMode] = useState("recent");
  const [typeFilter, setTypeFilter] = useState("all");
  const { notification, notify, dismiss: dismissNotification, pause: pauseNotification, resume: resumeNotification } = useNotification();
  const online = useOnlineStatus();
  const undoBatchRef = useRef([]);
  const undoExpiryRef = useRef(null);
  const [theme, setTheme] = useState(null);
  const prefersDark = usePrefersDark();
  const mode = theme || (prefersDark ? "dark" : "light");
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", mode === "dark" ? "#0F1114" : "#F4F4F0");
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
    if (["ready", "saving", "save-error"].includes(storageState.status))
      storageBackend.set("credenza-prefs-v1", JSON.stringify({ viewMode, sortMode, theme })).catch(() => {});
  }, [storageState.status, viewMode, sortMode, theme]);

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
          } else {
            const extra = { sourceImport: "share" };
            if (sharedTitle && parsed.url) extra.title = sharedTitle.slice(0, 72);
            const sharedItem = createItem(parsed, shared, extra);
            it = [sharedItem, ...it];
            flashImportResult("Stashed from share.");
            setTimeout(() => fetchAutomaticImage(sharedItem), 0);
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
    storageBackend.get("credenza-prefs-v1").then((raw) => {
      try {
        const p = JSON.parse(raw || "{}");
        if (p.viewMode === "rows" || p.viewMode === "cards") setViewMode(p.viewMode);
        if (["recent", "oldest", "importance", "unopened"].includes(p.sortMode))
          setSortMode(p.sortMode);
        if (p.theme === "dark" || p.theme === "light") setTheme(p.theme);
      } catch (e) {}
    });
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
      notify("Already on the shelf: “" + dupItem.title + "” — opened it below.", { duration: DUPE_BANNER_MS });
      setExpandedId(dupItem.id);
      setSelectedId(dupItem.id);
      return "dupe";
    }
    const item = createItem(parsed, text, extra);
    applyUpdate((list) => [item, ...list]);
    fetchAutomaticImage(item);
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
    const { fresh, dupes } = buildImportItems(candidates, items, provider);
    if (fresh.length) applyUpdate((list) => [...fresh, ...list]);
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

  // Auto-fetch a preview image after stash. Best-effort enhancement: silent on
  // every failure, never touches status, never overwrites a manual image (the
  // functional patch checks current.image in case one landed mid-flight).
  const fetchAutomaticImage = async (item) => {
    if (!PREVIEW_SECRET || item.image) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    const photos = (item.links || []).find((l) => l.role === "photos");
    const candidates = [];
    if (photos) candidates.push(photos.url);
    if (item.url && !item.videoId) candidates.push(item.url); // YouTube already has a thumb
    if (!candidates.length) return;
    for (const url of candidates.slice(0, 2)) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        const res = await fetch(PREVIEW_ENDPOINT, {
          method: "POST",
          headers: { "content-type": "application/json", "x-credenza-key": PREVIEW_SECRET },
          body: JSON.stringify({ url }),
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (!res.ok) continue;
        const blob = await res.blob();
        if (!/^image\//.test(blob.type || "")) continue;
        const dataUrl = await compressImageBlob(blob);
        updateItem(item.id, (x) => (x.image ? {} : { image: dataUrl }));
        return;
      } catch (e) {}
    }
  };

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
    for (const item of created) fetchAutomaticImage(item);
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

  const resurfacedItem =
    resurfaced && !q && view === "shelf"
      ? items.find((x) => x.id === resurfaced && x.status === "ready")
      : null;

  // ————— Browsing gear: appears only once the shelf earns it —————
  const toolbarActive = shelfAll.length >= 6;
  const presentTypes = useMemo(
    () => Object.keys(TYPES).filter((t) => shelfAll.some((x) => x.type === t)),
    [shelfAll]
  );
  const typed =
    toolbarActive && typeFilter !== "all"
      ? visible.filter((x) => x.type === typeFilter)
      : visible;
  const ordered = (() => {
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
  const shelfItems = resurfacedItem ? ordered.filter((x) => x.id !== resurfaced) : ordered;

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
  kb.current = { shelfItems, selectedId, expandedId, digest, items, importOpen };
  useEffect(() => {
    const isTyping = () => {
      const el = document.activeElement;
      return el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT");
    };
    const onKey = (e) => {
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
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          <div className="cz-brand"><span className="cz-brand-mark">C</span> CREDENZA</div>
        </div>

        <h1 className="cz-hero-title cz-title-balance">Keep the good stuff close.</h1>

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
                            setTimeout(() => {
                              const card = document.getElementById("card-" + result.id);
                              if (card) {
                                card.scrollIntoView({
                                  block: "nearest",
                                  behavior: reduced ? "auto" : "smooth",
                                });
                              }
                            }, 0);
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
              display: "inline-flex",
              background: SEG,
              borderRadius: 999,
              padding: 2,
              marginBottom: 14,
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
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: view === key ? INK : SUB,
                  background: view === key ? CARD : "transparent",
                  border: "none",
                  borderRadius: 999,
                  padding: "6px 16px",
                  cursor: "pointer",
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
            <div className="cz-section-head">
              <h2>{q ? "Results" : "The shelf"}</h2>
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
                {presentTypes.map((t) => (
                  <FilterChip
                    key={t}
                    active={typeFilter === t}
                    label={TYPES[t].label}
                    dot={TYPES[t].dot}
                    onClick={() => setTypeFilter(typeFilter === t ? "all" : t)}
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
                  <label style={{ display: "flex", alignItems: "center", gap: 6, color: SUB, fontSize: 12 }}>
                    <span className="cz-sort-label">Sort</span>
                    <select
                      className="cz-sort-select"
                      aria-label="Sort shelf"
                      value={sortMode}
                      onChange={(event) => setSortMode(event.target.value)}
                      style={{
                        minHeight: 40,
                        color: INK,
                        background: SEG,
                        border: "1px solid transparent",
                        borderRadius: 999,
                        padding: "7px 28px 7px 10px",
                        cursor: "pointer",
                      }}
                    >
                      {Object.keys(SORT_LABELS).map((key) => (
                        <option key={key} value={key}>{SORT_LABELS[key]}</option>
                      ))}
                    </select>
                  </label>
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
                </div>
              </div>
            )}

            {/* Resurfaced */}
            {resurfacedItem && (
              <div style={{ marginBottom: 18 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: 7,
                    padding: "0 2px",
                  }}
                >
                  <Caption style={{ color: BLUE }}>From the back of the shelf</Caption>
                  <button
                    onClick={dismissResurfaced}
                    style={{
                      marginLeft: "auto",
                      fontSize: 11.5,
                      fontWeight: 500,
                      background: "none",
                      border: "none",
                      color: FAINT,
                      cursor: "pointer",
                      fontFamily: FONT,
                    }}
                  >
                    Dismiss
                  </button>
                </div>
                <Card
                  item={resurfacedItem}
                  featured
                  expanded={expandedId === resurfacedItem.id}
                  selected={selectedId === resurfacedItem.id}
                  onToggle={() =>
                    setExpandedId(expandedId === resurfacedItem.id ? null : resurfacedItem.id)
                  }
                  onDelete={remove}
                  onSaveNote={saveNote}
                  onSaveEdit={saveEdit}
                  onOpen={recordOpen}
                  onAttachImage={attachImage}
                  onRemoveImage={removeImage}
                />
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
            ) : shelfItems.length === 0 && !resurfacedItem ? (
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
                    {q ? "No matches for “" + search.trim() + "”." : "No " + (TYPES[typeFilter]?.label || "matching") + " cards yet."}
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
            onClick={() => setTheme(mode === "dark" ? "light" : "dark")}
            title={mode === "dark" ? "Switch to light" : "Switch to dark"}
            aria-label="Toggle dark mode"
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
            {mode === "dark" ? "☀" : "☾"}
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
