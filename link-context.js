/**
 * link-context.js — pure offline link → community mention index (L0).
 * No DOM. No network. Spec: docs/pure-layer-exhaustiveness-plan.md §6.
 *
 * Safe framing (docs/Monetization.md Tier C):
 * - Context attaches to items the user already stashed.
 * - No public brand browse. No best-batch ranking.
 */

import { marketplaceOf } from "./agents.js";

/**
 * Canonical key for a shoppable URL.
 * Shapes: weidian:<id> | taobao:<id> | tmall:<id> | 1688:<id> | yupoo:<account>/<albumId>
 * @param {string} url
 * @returns {string | null}
 */
export function canonicalKeyFromUrl(url) {
  const raw = String(url || "").trim();
  if (!raw || !/^https?:\/\//i.test(raw)) return null;

  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }

  const host = u.hostname.replace(/^www\./, "").toLowerCase();

  // Weidian (query + path; itemID / itemId / item_id)
  if (/(^|\.)weidian\.(com|cn)$/.test(host)) {
    const id =
      u.searchParams.get("itemID") ||
      u.searchParams.get("itemId") ||
      u.searchParams.get("item_id") ||
      (u.pathname.match(/\/item\/(\d{5,})/) || [])[1];
    if (id && /^\d{5,}$/.test(id)) return `weidian:${id}`;
    return null;
  }

  // Taobao / Tmall / tb.cn with expanded id
  if (
    /(^|\.)(taobao|tmall)\.com$/.test(host) ||
    host === "m.tb.cn" ||
    /(^|\.)tb\.cn$/.test(host) ||
    /(^|\.)tmall\.hk$/.test(host)
  ) {
    const id =
      u.searchParams.get("id") ||
      u.searchParams.get("itemId") ||
      u.searchParams.get("item_id") ||
      (u.pathname.match(/\/item\/(\d{5,})/) || [])[1];
    if (id && /^\d{5,}$/.test(id)) {
      const mp = marketplaceOf(raw) || (/(^|\.)tmall\./.test(host) ? "tmall" : "taobao");
      // tb.cn short links without id cannot key yet
      if (mp === "tmall") return `tmall:${id}`;
      return `taobao:${id}`;
    }
    return null;
  }

  // 1688
  if (/(^|\.)1688\.com$/.test(host)) {
    const id =
      (u.pathname.match(/\/offer\/(\d{5,})(?:\.html)?/i) || [])[1] ||
      u.searchParams.get("offerId") ||
      u.searchParams.get("offer_id") ||
      u.searchParams.get("id");
    if (id && /^\d{5,}$/.test(id)) return `1688:${id}`;
    return null;
  }

  // Yupoo album
  if (/(^|\.)yupoo\.com$/.test(host)) {
    const album = (u.pathname.match(/\/albums\/(\d+)/i) || [])[1];
    if (!album) return null;
    const account = (host.match(/^([^.]+)(?:\.x)?\.yupoo\.com$/) || [])[1];
    if (!account || account === "x" || account === "www" || account === "photo" || account === "pic") {
      return null;
    }
    return `yupoo:${account.toLowerCase()}/${album}`;
  }

  return null;
}

/**
 * Pull height/weight pairs like "182cm 80kg" or "80kg, 182cm" from free text.
 * @param {string} text
 * @returns {Array<{ heightCm: number|null, weightKg: number|null, raw: string }>}
 */
export function extractHeightWeightPairs(text) {
  const src = String(text || "");
  if (!src.trim()) return [];
  const out = [];
  const seen = new Set();

  // 182 cm / 80 kg  OR  182cm 80kg  OR  80kg 182cm
  const re =
    /(\d{2,3})\s*cm\s*[\/|,]?\s*(\d{2,3})\s*kg|(\d{2,3})\s*kg\s*[\/|,]?\s*(\d{2,3})\s*cm|(\d{2,3})\s*cm\s+(\d{2,3})\s*kg/gi;
  let m;
  while ((m = re.exec(src)) !== null) {
    let heightCm = null;
    let weightKg = null;
    if (m[1] && m[2]) {
      heightCm = parseInt(m[1], 10);
      weightKg = parseInt(m[2], 10);
    } else if (m[3] && m[4]) {
      weightKg = parseInt(m[3], 10);
      heightCm = parseInt(m[4], 10);
    } else if (m[5] && m[6]) {
      heightCm = parseInt(m[5], 10);
      weightKg = parseInt(m[6], 10);
    }
    if (heightCm != null && (heightCm < 120 || heightCm > 230)) heightCm = null;
    if (weightKg != null && (weightKg < 35 || weightKg > 200)) weightKg = null;
    if (heightCm == null && weightKg == null) continue;
    const raw = m[0].replace(/\s+/g, " ").trim();
    if (seen.has(raw)) continue;
    seen.add(raw);
    out.push({ heightCm, weightKg, raw });
  }
  return out.slice(0, 8);
}

/**
 * Pull size worn signals from short notes (not full size charts).
 * @param {string} text
 * @returns {string[]}
 */
export function extractSizesSeen(text) {
  const src = String(text || "");
  if (!src.trim()) return [];
  const out = [];
  const seen = new Set();
  const patterns = [
    /\bsize\s*([SMLX]{1,4}|\d{2,3})\b/gi,
    /\btook\s*size\s*([SMLX]{1,4}|\d{2,3})\b/gi,
    /\b([SMLX]{1,3})\s*(?:fits|fit)\b/gi,
    /\bEU\s*(\d{2})\b/gi,
    /\bUS\s*(\d{1,2}(?:\.\d)?)\b/gi,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(src)) !== null) {
      const s = String(m[1] || "").toUpperCase();
      if (!s || seen.has(s)) continue;
      // Reject body mass false positives already handled by kg rules elsewhere
      if (/^\d{3,}$/.test(s) && Number(s) > 50) continue;
      seen.add(s);
      out.push(s);
    }
  }
  return out.slice(0, 12);
}

function mentionFromItem(post, item) {
  const url = String(item?.url || "").trim();
  const key = canonicalKeyFromUrl(url);
  if (!key) return null;
  // Never index agent register / invite URLs as item keys (canonicalKey already null for agents).
  const label = String(item?.label || item?.title || "").trim().slice(0, 120);
  const note = String(item?.note || item?.summary || "").trim().slice(0, 400);
  const category = String(item?.category || "").trim();
  return {
    key,
    url,
    postId: String(post?.id || post?.postId || ""),
    postTitle: String(post?.title || post?.postTitle || "").slice(0, 200),
    postUrl: String(post?.permalink || post?.postUrl || post?.url || ""),
    subreddit: String(post?.subreddit || "FashionReps"),
    label,
    note,
    category,
    posterStats: post?.posterStats || null,
    observedAt: post?.observedAt || post?.harvestedAt || null,
  };
}

/**
 * Build a plain-object index: key → Mention[].
 * Accepts posts with pre-extracted `items`, or a `parseHaul(text)` option.
 * Deterministic for the same posts array.
 *
 * @param {Array<object>} posts
 * @param {{ parseHaul?: (text: string, opts?: object) => { items?: object[] } | null }} [opts]
 * @returns {Record<string, object[]>}
 */
export function indexCorpus(posts, opts = {}) {
  const index = Object.create(null);
  const list = Array.isArray(posts) ? posts : [];

  for (const post of list) {
    let items = Array.isArray(post?.items) ? post.items : null;
    if (!items && typeof opts.parseHaul === "function") {
      const text = [post?.title, post?.selftext || post?.body || ""].filter(Boolean).join("\n");
      try {
        const haul = opts.parseHaul(text, { title: post?.title });
        items = haul && Array.isArray(haul.items) ? haul.items : [];
      } catch {
        items = [];
      }
    }
    if (!items) items = [];

    // Also scan raw URLs when items missed a link (QC single-link posts).
    if (items.length === 0) {
      const blob = [post?.title, post?.selftext || post?.body || ""].filter(Boolean).join("\n");
      const urls = blob.match(/https?:\/\/[^\s)\]>"']+/gi) || [];
      items = urls.map((url) => ({
        url: url.replace(/[),.;]+$/g, ""),
        label: String(post?.title || "").replace(/^\[QC\]\s*/i, "").trim().slice(0, 80),
        note: "",
        category: "",
      }));
    }

    for (const item of items) {
      const mention = mentionFromItem(post, item);
      if (!mention) continue;
      if (!index[mention.key]) index[mention.key] = [];
      // Dedupe same post + key
      const already = index[mention.key].some(
        (m) => m.postId && mention.postId && m.postId === mention.postId
      );
      if (already) continue;
      index[mention.key].push(mention);
    }
  }

  // Stable sort mentions by postId for determinism
  for (const key of Object.keys(index)) {
    index[key].sort((a, b) => String(a.postId).localeCompare(String(b.postId)));
  }
  return index;
}

/**
 * Look up community mentions for a URL (or canonical key).
 * @param {string} urlOrKey
 * @param {Record<string, object[]>} index
 */
export function lookupLinkContext(urlOrKey, index) {
  const raw = String(urlOrKey || "").trim();
  let key = null;
  if (/^(weidian|taobao|tmall|1688|yupoo):/.test(raw)) {
    key = raw;
  } else {
    key = canonicalKeyFromUrl(raw);
  }

  const mentions = key && index && Array.isArray(index[key]) ? index[key].slice() : [];
  const noteBlob = mentions.map((m) => [m.label, m.note, m.postTitle].filter(Boolean).join(" ")).join("\n");
  const sizesSeen = extractSizesSeen(noteBlob);
  const heightWeightPairs = extractHeightWeightPairs(noteBlob);

  // Prefer posterStats from post-level if present on mentions
  for (const m of mentions) {
    if (m.posterStats && typeof m.posterStats === "object") {
      const h = Number(m.posterStats.heightCm);
      const w = Number(m.posterStats.weightKg);
      if ((Number.isFinite(h) || Number.isFinite(w)) && heightWeightPairs.length === 0) {
        heightWeightPairs.push({
          heightCm: Number.isFinite(h) ? h : null,
          weightKg: Number.isFinite(w) ? w : null,
          raw: "posterStats",
        });
      }
    }
  }

  return {
    key,
    mentions,
    count: mentions.length,
    sizesSeen,
    heightWeightPairs,
    notes: mentions.map((m) => m.note).filter(Boolean),
  };
}

/**
 * True when a string looks like an agent signup / invite host (must not be an item key).
 * Defensive for future corpus noise.
 * @param {string} url
 */
export function isAgentInviteUrl(url) {
  try {
    const host = new URL(String(url || "")).hostname.toLowerCase();
    return /(register|signup|invite|partnercode)/i.test(String(url)) &&
      /(superbuy|sugargoo|cssbuy|kakobuy|hoobuy|cnfans|mulebuy|acbuy|oopbuy)/i.test(host);
  } catch {
    return false;
  }
}
